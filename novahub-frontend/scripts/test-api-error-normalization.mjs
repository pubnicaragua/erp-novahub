import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ApiRequestError,
  apiErrorToastVariant,
  classifyApiError,
  classifyLocalNotice,
  getRegisteredApiErrorCategory,
  getRegisteredApiErrorRequestId,
  normalizeLocalNoticeMessage,
  normalizeApiErrorBody,
  addApiErrorContext,
  registerApiErrorCategory,
} from '../src/app/services/api-error.ts';

test('normalizes Nest HttpException payloads with business fields nested in message', () => {
  const normalized = normalizeApiErrorBody({
    statusCode: 409,
    category: 'BUSINESS_RULE',
    requestId: 'req-business',
    details: ['SKU ya existe.'],
    message: {
      code: 'PRODUCT_SIMILAR_MATCH',
      message: 'Se encontró una posible coincidencia.',
      matches: [{ inputKey: 'SKU-NUEVO', matches: [] }],
    },
  });

  assert.equal(normalized?.code, 'PRODUCT_SIMILAR_MATCH');
  assert.equal(normalized?.message, 'Se encontró una posible coincidencia.');
  assert.deepEqual(normalized?.matches, [{ inputKey: 'SKU-NUEVO', matches: [] }]);
  assert.equal(normalized?.statusCode, 409);
  assert.equal(normalized?.category, 'BUSINESS_RULE');
  assert.equal(normalized?.requestId, 'req-business');
  assert.deepEqual(normalized?.details, ['SKU ya existe.']);
});

test('preserves flat errors and non-object validation messages', () => {
  const flat = { statusCode: 409, code: 'SKU_CONFLICT', message: 'SKU repetido.' };
  assert.deepEqual(normalizeApiErrorBody(flat), flat);
  assert.deepEqual(normalizeApiErrorBody({ statusCode: 400, message: ['Falta el nombre.'] }), {
    statusCode: 400,
    message: ['Falta el nombre.'],
  });
});

test('classifies explicit categories before status-based fallbacks', () => {
  assert.equal(classifyApiError({
    status: 409,
    data: {
      statusCode: 409,
      category: 'VALIDATION',
      message: 'Revisa el campo.',
      requestId: 'req-explicit',
    },
  }), 'VALIDATION');
});

test('classifies DTO validation arrays and known non-technical HTTP statuses', () => {
  assert.equal(classifyApiError({ status: 400, data: { statusCode: 400, message: ['name should not be empty'] } }), 'VALIDATION');
  assert.equal(classifyApiError({ status: 403, data: { statusCode: 403, message: 'No tienes permiso.' } }), 'AUTHORIZATION');
  assert.equal(classifyApiError({ status: 404, data: { statusCode: 404, message: 'No encontrado.' } }), 'NOT_FOUND');
  assert.equal(classifyApiError({ status: 409, data: { statusCode: 409, message: 'El estado no permite esta acción.' } }), 'BUSINESS_RULE');
  assert.equal(classifyApiError({ status: 400, data: { statusCode: 400, message: 'No se pudo aplicar esta regla.' } }), 'UNCLASSIFIED');
});

test('classifies server and network failures as technical without coercing unknown 4xx', () => {
  assert.equal(classifyApiError({ status: 503, data: { statusCode: 503, requestId: 'req-503' } }), 'TECHNICAL');
  assert.equal(classifyApiError(new TypeError('Failed to fetch')), 'TECHNICAL');
  assert.equal(classifyApiError(new Error('No se pudo completar la consulta')), 'TECHNICAL');
  assert.equal(classifyApiError(new Error('El monto debe ser mayor a 0')), 'VALIDATION');
  assert.equal(classifyApiError({ status: 418, data: { statusCode: 418 } }), 'UNCLASSIFIED');
});

test('routes a registered business-rule message from toast.error(error.message) to warning', () => {
  const message = 'La cuenta no puede modificarse mientras tenga movimientos.';
  const data = {
    statusCode: 400,
    code: 'CREDIT_LIMIT_EXCEEDED',
    category: 'BUSINESS_RULE',
    details: ['El crédito disponible no alcanza.'],
    requestId: 'req-credit-limit',
  };
  const error = new ApiRequestError(
    message,
    400,
    '/sales/customers/customer-1/credit-limit',
    'CREDIT_LIMIT_EXCEEDED',
    ['El crédito disponible no alcanza.'],
    data,
    'BUSINESS_RULE',
    'req-credit-limit',
  );

  const category = getRegisteredApiErrorCategory(error.message);
  assert.equal(category, 'BUSINESS_RULE');
  assert.equal(getRegisteredApiErrorRequestId(error.message), 'req-credit-limit');
  assert.equal(apiErrorToastVariant(category, 'error'), 'warning');
  assert.equal(error.status, 400);
  assert.equal(error.code, 'CREDIT_LIMIT_EXCEEDED');
  assert.deepEqual(error.details, ['El crédito disponible no alcanza.']);
  assert.equal(error.data, data);
  assert.equal(error.requestId, 'req-credit-limit');
});

test('does not guess when the same message is registered with conflicting categories', () => {
  const message = 'El registro cambió.';
  registerApiErrorCategory(message, 'BUSINESS_RULE');
  registerApiErrorCategory(message, 'TECHNICAL');
  assert.equal(getRegisteredApiErrorCategory(message), undefined);
});

test('does not attach the wrong request id when equal messages come from different requests', () => {
  const message = 'El servidor no pudo guardar el registro.';
  registerApiErrorCategory(message, 'TECHNICAL', 'req-one');
  registerApiErrorCategory(message, 'TECHNICAL', 'req-two');
  assert.equal(getRegisteredApiErrorRequestId(message), undefined);
});

test('does not retain oversized messages in the toast category registry', () => {
  const message = 'x'.repeat(2_049);
  registerApiErrorCategory(message, 'BUSINESS_RULE');
  assert.equal(getRegisteredApiErrorCategory(message), undefined);
});

test('classifies a meaningful untagged 400 business notice without a generic prefix', () => {
  const message = 'El límite de crédito disponible es insuficiente.';
  assert.equal(classifyApiError({ status: 400, data: { statusCode: 400, message } }), 'BUSINESS_RULE');
  const normalized = addApiErrorContext(message, 400, 'guardar información en Ventas');
  assert.equal(normalized, message);
  const category = getRegisteredApiErrorCategory(normalized);
  assert.equal(category, 'BUSINESS_RULE');
  assert.equal(apiErrorToastVariant(category, 'error'), 'warning');

  const conflictMessage = 'La operación ya fue procesada.';
  assert.equal(addApiErrorContext(conflictMessage, 409, 'guardar la operación'), conflictMessage);
  assert.equal(getRegisteredApiErrorCategory(conflictMessage), 'UNCLASSIFIED');
});

test('classifies local validation, permission, and business notices as non-technical', () => {
  assert.equal(classifyLocalNotice('Selecciona la fecha de pago del crédito.'), 'VALIDATION');
  assert.equal(classifyLocalNotice('No tienes permiso para enviar esta factura a crédito.'), 'AUTHORIZATION');
  assert.equal(classifyLocalNotice('Necesitas permiso para administrar invitados.'), 'AUTHORIZATION');
  assert.equal(classifyLocalNotice('Todos los campos personalizados necesitan una clave'), 'VALIDATION');
  assert.equal(classifyLocalNotice('El título es requerido'), 'VALIDATION');
  assert.equal(classifyLocalNotice('Formato de correo no válido'), 'VALIDATION');
  assert.equal(classifyLocalNotice('Seleccione un proveedor'), 'VALIDATION');
  assert.equal(classifyLocalNotice('La capacidad máxima es de 20 personas'), 'VALIDATION');
  assert.equal(classifyLocalNotice('No se puede filtrar a una fecha anterior a la fecha inicial'), 'VALIDATION');
  assert.equal(classifyLocalNotice('El monto debe ser mayor a 0'), 'VALIDATION');
  assert.equal(classifyLocalNotice('El archivo debe ser Excel (.xlsx o .xls)'), 'VALIDATION');
  assert.equal(classifyLocalNotice('No autorizado'), 'AUTHORIZATION');
  assert.equal(classifyLocalNotice('Solo el creador, responsable o administrador puede interactuar con este ticket'), 'AUTHORIZATION');
  assert.equal(classifyLocalNotice('No puedes editar roles de otra empresa'), 'AUTHORIZATION');
  assert.equal(classifyLocalNotice('El navegador bloqueó la ventana de WhatsApp. Permite ventanas emergentes e inténtalo de nuevo.'), 'BUSINESS_RULE');
  assert.equal(classifyLocalNotice('Tu navegador bloqueó la ventana de impresión. Permite las ventanas emergentes.'), 'BUSINESS_RULE');
  assert.equal(classifyLocalNotice('Este invitado no tiene un correo registrado'), 'BUSINESS_RULE');
  assert.equal(classifyLocalNotice('El saldo a favor disponible es de 1,200 NIO.'), 'BUSINESS_RULE');
  assert.equal(classifyLocalNotice('Stock insuficiente para este producto. Disponible en el origen: 3.'), 'BUSINESS_RULE');
  assert.equal(classifyLocalNotice('La factura debe generarse desde una orden de compra.'), 'BUSINESS_RULE');
  assert.equal(classifyLocalNotice('El pago quedó registrado, pero no se pudo guardar la evidencia.'), 'BUSINESS_RULE');
  assert.equal(classifyLocalNotice('No se encontró la plantilla que aparece en la vista previa.'), 'NOT_FOUND');
  assert.equal(classifyLocalNotice('El empleado solo tiene 3 días de vacaciones disponibles para 2026'), 'BUSINESS_RULE');
  assert.equal(classifyLocalNotice('Importación terminada: 2 confirmados; 1 no confirmado. Revisa el registro.'), 'BUSINESS_RULE');
  assert.equal(classifyLocalNotice('El navegador no permitió abrir la impresión.'), 'BUSINESS_RULE');
  assert.equal(classifyLocalNotice('No se pudo entregar la prueba. Vuelve a activar las notificaciones en este dispositivo.'), 'BUSINESS_RULE');
  assert.equal(classifyLocalNotice('No se pudo leer la imagen “menú.webp”.'), 'VALIDATION');
  assert.equal(classifyLocalNotice('No se pudo leer el archivo Excel'), 'VALIDATION');
  assert.equal(classifyLocalNotice('Ingresá el número de teléfono del cliente'), 'VALIDATION');
  assert.equal(classifyLocalNotice('Hay números de serie repetidos en la lista.'), 'VALIDATION');
  assert.equal(classifyLocalNotice('Archivo: tipo de archivo no permitido (exe)'), 'VALIDATION');
  assert.equal(classifyLocalNotice('1 asignación(es) no se pudieron guardar. Actualiza la lista para revisar el resultado.'), 'BUSINESS_RULE');
  assert.equal(classifyLocalNotice('Los roles del sistema no se pueden eliminar'), 'BUSINESS_RULE');
  assert.equal(classifyLocalNotice('Apertura una sesión de caja para tomar la factura.'), 'BUSINESS_RULE');
  assert.equal(classifyLocalNotice('El monto recibido debe cubrir el saldo pendiente.'), 'BUSINESS_RULE');
  assert.equal(classifyLocalNotice('Algunos productos no tienen precio en la lista seleccionada. Elige otra lista de precios.'), 'BUSINESS_RULE');
  assert.equal(classifyLocalNotice('La moneda del límite de crédito debe ser NIO o USD'), 'VALIDATION');
  assert.equal(classifyLocalNotice('La orden debe estar en proceso o aprobada antes de enviarse a factura'), 'BUSINESS_RULE');
  assert.equal(classifyLocalNotice('Sesión no encontrada'), 'NOT_FOUND');
  assert.equal(classifyLocalNotice('El crédito supera el límite disponible del cliente. Disponible: 3436.25 NIO.'), 'BUSINESS_RULE');
  assert.equal(classifyLocalNotice('No se pudo guardar la información. Inténtalo de nuevo.'), 'TECHNICAL');
  const wrappedCreditNotice = 'No se pudo actualizar información de Ventas. El crédito supera el límite disponible del cliente. Disponible: 3436.25 NIO.';
  assert.equal(classifyLocalNotice(wrappedCreditNotice), 'BUSINESS_RULE');
  assert.equal(normalizeLocalNoticeMessage(wrappedCreditNotice), 'El crédito supera el límite disponible del cliente. Disponible: 3436.25 NIO.');
  const wrappedPluralNotice = 'No se pudieron importar los datos: Corrige los errores antes de importar';
  assert.equal(classifyLocalNotice(wrappedPluralNotice), 'VALIDATION');
  assert.equal(normalizeLocalNoticeMessage(wrappedPluralNotice), 'Corrige los errores antes de importar');
});

test('classifies cause-free operation failure notices as technical with an error presentation', () => {
  const category = classifyLocalNotice('Error al eliminar');

  assert.equal(category, 'TECHNICAL');
  assert.equal(apiErrorToastVariant(category, 'info'), 'error');
});

test('extracts an explained user cause from a wrapped operation failure', () => {
  const message = 'Error al actualizar Ventas: El crédito supera el límite disponible del cliente. Disponible: 3436.25 NIO.';

  assert.equal(classifyLocalNotice(message), 'BUSINESS_RULE');
  assert.equal(normalizeLocalNoticeMessage(message), 'El crédito supera el límite disponible del cliente. Disponible: 3436.25 NIO.');
});

test('classifies generic exports, loads, and recovery failures as technical notices', () => {
  for (const message of [
    'Error',
    'Error generando PDF',
    'Error cargando suscripciones',
    'Ocurrió un error al persistir las memorias de cálculo',
    'No pudimos abrir el producto encontrado. Tus datos siguen disponibles; inténtalo nuevamente.',
    'No se pudo descargar la imagen. Inténtalo nuevamente.',
  ]) {
    assert.equal(classifyLocalNotice(message), 'TECHNICAL', message);
  }
});

test('classifies missing selected records as informational rather than technical failures', () => {
  const message = 'No encontramos todos los productos seleccionados en la lista cargada. Actualiza el inventario y vuelve a seleccionarlos.';

  assert.equal(classifyLocalNotice(message), 'NOT_FOUND');
  assert.equal(classifyLocalNotice('No se pudieron cargar todos los productos seleccionados. Actualiza el inventario e inténtalo nuevamente.'), 'NOT_FOUND');
  assert.equal(classifyLocalNotice('No se pudieron resolver todos los productos seleccionados. Actualiza la vista e inténtalo de nuevo.'), 'NOT_FOUND');
  assert.equal(apiErrorToastVariant('NOT_FOUND', 'info'), 'info');
});
