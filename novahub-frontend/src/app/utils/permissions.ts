export const PERMISSION_ACTION_DEFINITIONS = [
  { key: 'read', label: 'Ver', description: 'Permite entrar a la vista y consultar sus registros.' },
  { key: 'create', label: 'Crear', description: 'Permite agregar nuevos registros o borradores.' },
  { key: 'edit', label: 'Editar', description: 'Permite modificar los datos de un registro existente.' },
  { key: 'delete', label: 'Eliminar', description: 'Permite eliminar, inhabilitar, cancelar, rechazar o revertir según la vista.' },
  { key: 'approve', label: 'Aprobar', description: 'Permite resolver aprobaciones explícitas del proceso.' },
  { key: 'startTask', label: 'Iniciar tarea', description: 'Permite mover una tarea pendiente a En progreso.' },
  { key: 'returnTaskToPending', label: 'Devolver a pendientes', description: 'Permite mover una tarea en progreso a Pendiente.' },
  { key: 'manageSubtasks', label: 'Administrar subtareas', description: 'Permite crear, editar, completar y eliminar subtareas.' },
  { key: 'reassign', label: 'Reasignar tarea', description: 'Permite reasignar una tarea a otra persona del tenant.' },
  { key: 'startTimeTracking', label: 'Iniciar cronómetro', description: 'Permite iniciar el registro de tiempo de una tarea.' },
  { key: 'stopTimeTracking', label: 'Detener cronómetro', description: 'Permite detener el registro de tiempo en curso.' },
  { key: 'addManualTimeEntry', label: 'Registrar tiempo manual', description: 'Permite agregar tiempo trabajado manualmente a una tarea.' },
  { key: 'manageGuests', label: 'Administrar invitados', description: 'Permite agregar o quitar invitados de eventos y reuniones.' },
  { key: 'sendInvitations', label: 'Enviar invitaciones', description: 'Permite enviar y compartir invitaciones de eventos o reuniones.' },
  { key: 'scheduleMeeting', label: 'Programar videollamada', description: 'Permite crear o actualizar enlaces de Meet, Teams o Zoom.' },
  { key: 'changeStatus', label: 'Cambiar estado', description: 'Permite cambiar el estado operativo cuando el flujo lo ofrece.' },
  { key: 'startTicket', label: 'Iniciar ticket', description: 'Permite mover un ticket abierto a En progreso.' },
  { key: 'returnTicketToOpen', label: 'Devolver a abierto', description: 'Permite regresar un ticket en progreso a Abierto.' },
  { key: 'resolveTicket', label: 'Resolver ticket', description: 'Permite registrar la resolución y mover un ticket a Resuelto.' },
  { key: 'closeTicket', label: 'Cerrar ticket', description: 'Permite cerrar un ticket que ya está resuelto.' },
  { key: 'reopenTicket', label: 'Reabrir ticket', description: 'Permite reabrir un ticket resuelto o cerrado con un motivo.' },
  { key: 'commentTicket', label: 'Comentar ticket', description: 'Permite agregar comentarios internos o públicos a un ticket.' },
  { key: 'startCase', label: 'Iniciar caso legal', description: 'Permite cambiar un caso legal a En proceso.' },
  { key: 'requestCaseDocuments', label: 'Solicitar documentos', description: 'Permite cambiar un caso legal a Esperando documentos.' },
  { key: 'returnCaseToPending', label: 'Devolver caso a pendiente', description: 'Permite devolver un caso legal a Pendiente.' },
  { key: 'completeCase', label: 'Completar caso legal', description: 'Permite marcar un caso legal como completado.' },
  { key: 'cancelCase', label: 'Cancelar caso legal', description: 'Permite marcar un caso legal como cancelado.' },
  { key: 'assignCase', label: 'Asignar caso legal', description: 'Permite asignar o cambiar el responsable de un caso legal.' },
  { key: 'addCaseNote', label: 'Agregar nota legal', description: 'Permite agregar notas internas o externas al expediente.' },
  { key: 'attachCaseDocument', label: 'Adjuntar documento legal', description: 'Permite adjuntar documentos al expediente.' },
  { key: 'sendCaseMessage', label: 'Enviar mensaje del caso', description: 'Permite enviar mensajes o archivos por el chat del expediente.' },
  { key: 'manageMembers', label: 'Administrar miembros', description: 'Permite agregar o remover integrantes de un proyecto.' },
  { key: 'comment', label: 'Agregar comentarios', description: 'Permite registrar comentarios o actualizaciones en el proyecto o sus tareas.' },
  { key: 'reorder', label: 'Reordenar tablero', description: 'Permite reordenar tareas, columnas o partidas dentro de la vista.' },
  { key: 'react', label: 'Reaccionar a tareas', description: 'Permite agregar o retirar reacciones en tareas del proyecto.' },
  { key: 'linkErp', label: 'Vincular registro ERP', description: 'Permite vincular una tarea con documentos transaccionales del ERP.' },
  { key: 'autoPlan', label: 'Distribuir tareas', description: 'Permite ejecutar la planificación automática semanal de tareas.' },
  { key: 'updateProgress', label: 'Actualizar avance de hito', description: 'Permite modificar ponderación y avance de los hitos del proyecto.' },
  { key: 'manageMaterials', label: 'Administrar materiales cotizados', description: 'Permite agregar y quitar materiales requeridos en una cotización.' },
  { key: 'sendToSuppliers', label: 'Enviar cotización a proveedor', description: 'Permite asignar proveedores y generar o renovar sus enlaces de cotización.' },
  { key: 'manualFill', label: 'Registrar oferta manual', description: 'Permite registrar precios de proveedor manualmente.' },
  { key: 'reviewOverwrite', label: 'Revisar actualización de oferta', description: 'Permite descartar el aviso de sobrescritura después de revisar una oferta.' },
  { key: 'selectOffers', label: 'Seleccionar ofertas', description: 'Permite elegir las ofertas que se incorporarán al costo del proyecto.' },
  { key: 'applyCostTemplate', label: 'Aplicar plantilla de costeo', description: 'Permite reemplazar o crear las partidas 6D desde una plantilla.' },
  { key: 'editPricing', label: 'Editar parámetros de precios', description: 'Permite editar parámetros fiscales, márgenes y precios del proyecto.' },
  { key: 'syncPricing', label: 'Sincronizar precios', description: 'Permite copiar al proyecto la configuración global de precios.' },
  { key: 'manageCalculationMemory', label: 'Guardar memoria de cálculo', description: 'Permite guardar los insumos y resultados de la memoria técnica del proyecto.' },
  { key: 'recordProgress', label: 'Registrar avance físico', description: 'Permite registrar el porcentaje y la nota de avance físico del proyecto.' },
  { key: 'editCurve', label: 'Editar curva planificada', description: 'Permite cambiar la curva de avance planificado del proyecto.' },
  { key: 'createCapture', label: 'Agregar evidencia de avance', description: 'Permite subir una captura fotográfica del avance del proyecto.' },
  { key: 'deleteCapture', label: 'Eliminar evidencia de avance', description: 'Permite eliminar capturas fotográficas del avance del proyecto.' },
  { key: 'managePublicLinks', label: 'Administrar enlaces públicos', description: 'Permite generar y revocar enlaces de consulta para clientes.' },
  { key: 'start', label: 'Iniciar', description: 'Permite iniciar una etapa operativa del flujo.' },
  { key: 'startReview', label: 'Iniciar revisión', description: 'Cambia una solicitud de financiamiento a En revisión.' },
  { key: 'disburse', label: 'Marcar desembolso', description: 'Cambia una solicitud aprobada a Desembolsada.' },
  { key: 'addDocument', label: 'Adjuntar documento', description: 'Permite adjuntar documentos a una solicitud de financiamiento.' },
  { key: 'addNote', label: 'Agregar nota del revisor', description: 'Permite agregar notas internas de revisión a una solicitud de financiamiento.' },
  { key: 'importProspects', label: 'Importar prospectos', description: 'Permite importar, capturar y sincronizar los datos base de negocios.' },
  { key: 'updateProspect', label: 'Editar prospecto', description: 'Permite actualizar datos de contacto y seguimiento de un prospecto.' },
  { key: 'changeStage', label: 'Cambiar etapa comercial', description: 'Permite agregar prospectos al Kanban o cambiar su etapa comercial.' },
  { key: 'registerVisit', label: 'Registrar visita', description: 'Permite registrar una visita individual o desde una ruta comercial.' },
  { key: 'discardProspect', label: 'Descartar prospecto', description: 'Permite descartar prospectos y registrar el motivo.' },
  { key: 'assignProspect', label: 'Asignar prospecto', description: 'Permite asignar prospectos y zonas a un vendedor.' },
  { key: 'attachEvidence', label: 'Adjuntar evidencia comercial', description: 'Permite subir y vincular evidencia a un prospecto.' },
  { key: 'manageConsent', label: 'Gestionar consentimiento', description: 'Permite registrar o retirar el consentimiento de WhatsApp.' },
  { key: 'createRoute', label: 'Crear ruta comercial', description: 'Permite crear una ruta con paradas ordenadas.' },
  { key: 'editRoute', label: 'Editar ruta comercial', description: 'Permite editar los datos y el orden de paradas de una ruta.' },
  { key: 'assignRoute', label: 'Asignar ruta comercial', description: 'Permite asignar o reasignar una ruta a un vendedor.' },
  { key: 'changeRouteStatus', label: 'Cambiar estado de ruta', description: 'Permite cambiar manualmente el estado de una ruta.' },
  { key: 'completeRouteStop', label: 'Completar parada', description: 'Permite completar una parada y registrar la visita asociada.' },
  { key: 'updatePresence', label: 'Compartir ubicación', description: 'Permite publicar ubicación y actividad propias en el mapa.' },
  { key: 'hidePresence', label: 'Ocultar ubicación', description: 'Permite ocultar la ubicación propia si la política lo autoriza.' },
  { key: 'configureLocation', label: 'Configurar ubicación', description: 'Permite configurar cuándo la empresa exige compartir ubicación.' },
  { key: 'configureRestaurant', label: 'Configurar restaurante', description: 'Permite cambiar la operación, perfil, canales, cocina, inventario y caja del restaurante.' },
  { key: 'closeTable', label: 'Liberar mesa', description: 'Permite cerrar o liberar una mesa sin comandas abiertas.' },
  { key: 'changeTableStatus', label: 'Cambiar estado de mesa', description: 'Permite actualizar manualmente el estado operativo de una mesa.' },
  { key: 'shareQr', label: 'Compartir QR de mesa', description: 'Permite consultar, imprimir o compartir el enlace público de pedidos de una mesa.' },
  { key: 'rotateQr', label: 'Rotar QR de mesa', description: 'Permite invalidar el enlace público anterior y generar uno nuevo.' },
  { key: 'addOrderItems', label: 'Agregar productos a comanda', description: 'Permite agregar una nueva ronda de productos a una comanda abierta.' },
  { key: 'confirmOrder', label: 'Confirmar comanda', description: 'Permite confirmar una comanda pendiente.' },
  { key: 'markOrderReady', label: 'Marcar comanda lista', description: 'Permite avanzar una comanda a lista para servir o entregar.' },
  { key: 'serveOrder', label: 'Marcar comanda servida', description: 'Permite confirmar que la comanda o ticket fue servido.' },
  { key: 'cancelOrder', label: 'Cancelar comanda', description: 'Permite cancelar una comanda y aplicar la devolución de inventario configurada.' },
  { key: 'sendToKitchen', label: 'Enviar a cocina', description: 'Permite enviar una comanda o ronda a preparación y crear sus tickets.' },
  { key: 'startPreparation', label: 'Iniciar preparación', description: 'Permite iniciar la preparación de una comanda o ticket de cocina.' },
  { key: 'markKitchenReady', label: 'Marcar ticket listo', description: 'Permite marcar como listo un ticket de cocina.' },
  { key: 'cancelKitchenTicket', label: 'Cancelar ticket de cocina', description: 'Permite cancelar un ticket de cocina antes de servirlo.' },
  { key: 'editDeliveryDetails', label: 'Editar datos de entrega', description: 'Permite actualizar dirección, referencia y responsable de una entrega o retiro.' },
  { key: 'queueDelivery', label: 'Poner entrega pendiente', description: 'Permite devolver una entrega o retiro a la cola pendiente.' },
  { key: 'startDeliveryPreparation', label: 'Iniciar preparación de entrega', description: 'Permite iniciar la preparación de un pedido para entrega o retiro.' },
  { key: 'markDeliveryReady', label: 'Marcar entrega lista', description: 'Permite marcar listo para entrega o retiro.' },
  { key: 'dispatchDelivery', label: 'Enviar entrega en ruta', description: 'Permite asignar repartidor y despachar un pedido de delivery.' },
  { key: 'markDelivered', label: 'Confirmar entrega', description: 'Permite confirmar que el pedido fue entregado o retirado.' },
  { key: 'cancelDelivery', label: 'Cancelar entrega', description: 'Permite cancelar el seguimiento de una entrega o retiro.' },
  { key: 'createRoomType', label: 'Crear tipo de habitación', description: 'Permite registrar tipos de habitación con su tarifa de servicio.' },
  { key: 'editRoomType', label: 'Editar tipo de habitación', description: 'Permite cambiar el nombre, capacidad, código o tarifa del tipo.' },
  { key: 'changeRoomTypeAvailability', label: 'Cambiar disponibilidad del tipo', description: 'Permite habilitar o inhabilitar un tipo de habitación.' },
  { key: 'createRoom', label: 'Crear habitación', description: 'Permite registrar una habitación física en la sucursal.' },
  { key: 'editRoom', label: 'Editar habitación', description: 'Permite cambiar el código, nombre, piso o tipo asignado a una habitación.' },
  { key: 'changeRoomAvailability', label: 'Cambiar disponibilidad de habitación', description: 'Permite habilitar o inhabilitar una habitación física.' },
  { key: 'checkIn', label: 'Registrar check-in', description: 'Permite iniciar una estadía confirmada y registrar la llegada del huésped.' },
  { key: 'checkOut', label: 'Registrar check-out', description: 'Permite finalizar una estadía y emitir su factura de alojamiento.' },
  { key: 'payAtCheckout', label: 'Cobrar en check-out', description: 'Permite registrar el pago al emitir la factura del alojamiento.' },
  { key: 'cancelReservation', label: 'Cancelar reserva', description: 'Permite cancelar una reserva confirmada e invalidar su enlace de huésped.' },
  { key: 'markNoShow', label: 'Marcar huésped no presentado', description: 'Permite cerrar una reserva confirmada como inasistencia.' },
  { key: 'issueGuestLink', label: 'Emitir enlace de huésped', description: 'Permite generar y compartir un enlace de servicios para la estadía.' },
  { key: 'revokeGuestLink', label: 'Revocar enlace de huésped', description: 'Permite invalidar el enlace activo de servicios para la estadía.' },
  { key: 'lookup', label: 'Consultar transportista', description: 'Permite consultar al transportista y registrar la respuesta del envío.' },
  { key: 'sync', label: 'Sincronizar tracking', description: 'Permite actualizar un envío existente desde el servicio del transportista.' },
  { key: 'registerEvent', label: 'Registrar evento manual', description: 'Permite agregar manualmente un evento al historial de tracking.' },
  { key: 'bill', label: 'Facturar paquetes', description: 'Permite emitir la factura de venta para los paquetes seleccionados.' },
  { key: 'submit', label: 'Enviar a pendientes', description: 'Permite enviar un borrador a la bandeja de pendientes de aprobación.' },
  { key: 'requestPayment', label: 'Solicitar pago', description: 'Permite enviar una solicitud de pago de nómina, beneficio o capacitación a Contabilidad.' },
  { key: 'pay', label: 'Registrar pago', description: 'Permite registrar el pago o cobro que ofrece el flujo de esta vista.' },
  { key: 'assign', label: 'Asignar empleados', description: 'Permite asignar empleados a beneficios.' },
  { key: 'enroll', label: 'Inscribir empleados', description: 'Permite inscribir empleados en una capacitación.' },
  { key: 'process', label: 'Procesar', description: 'Permite ejecutar el procesamiento que completa el flujo del registro.' },
  { key: 'confirm', label: 'Confirmar', description: 'Permite confirmar la operación pendiente.' },
  { key: 'reconcile', label: 'Reconciliar', description: 'Permite revisar y sincronizar registros pendientes de la bandeja.' },
  { key: 'close', label: 'Cerrar sesión', description: 'Permite cerrar una sesión operativa.' },
  { key: 'receive', label: 'Recepcionar mercancía', description: 'Permite confirmar las cantidades recibidas y procesar su entrada al inventario.' },
  { key: 'retryInventory', label: 'Reintentar inventario', description: 'Permite reintentar la sincronización de inventario de una recepción.' },
  { key: 'registerInvoice', label: 'Registrar factura de proveedor', description: 'Permite registrar la factura o evidencia fiscal vinculada a una compra.' },
  { key: 'cancelInvoice', label: 'Anular factura de proveedor', description: 'Permite anular una factura y revertir su efecto en cuentas por pagar.' },
  { key: 'issue', label: 'Emitir crédito', description: 'Permite emitir un crédito y aplicar los efectos definidos por su flujo.' },
  { key: 'apply', label: 'Aplicar crédito', description: 'Permite aplicar un crédito emitido al registro correspondiente.' },
  { key: 'void', label: 'Anular crédito', description: 'Permite anular un crédito de proveedor todavía no aplicado.' },
  { key: 'pause', label: 'Pausar', description: 'Permite pausar una programación recurrente.' },
  { key: 'resume', label: 'Reanudar', description: 'Permite reanudar una programación recurrente pausada.' },
  { key: 'cancel', label: 'Anular', description: 'Permite cancelar el registro cuando su flujo ofrece esa acción.' },
  { key: 'reopen', label: 'Reabrir', description: 'Permite reabrir un registro cerrado cuando su flujo lo admite.' },
  { key: 'reject', label: 'Rechazar gestión', description: 'Permite rechazar una gestión de compra y registrar el motivo.' },
  { key: 'convert', label: 'Convertir registro', description: 'Permite convertir el registro al documento siguiente del flujo.' },
  { key: 'closeByException', label: 'Cerrar por excepci\u00f3n', description: 'Permite cerrar un contenedor que no cumple los m\u00ednimos, con motivo obligatorio. No se hereda de Aprobar ni de Editar.' },
  { key: 'reopenContainer', label: 'Reabrir contenedor', description: 'Permite reabrir un contenedor cerrado, con motivo obligatorio y registro de auditor\u00eda. No se hereda de Aprobar ni de Editar.' },
  { key: 'send', label: 'Enviar', description: 'Permite iniciar envíos manuales o pruebas desde la vista.' },
  { key: 'sendToCredit', label: 'Enviar a crédito', description: 'Permite trasladar el saldo pendiente al crédito del cliente.' },
  { key: 'sendToCash', label: 'Enviar a caja', description: 'Permite enviar el documento a la cola de caja.' },
  { key: 'assignPackages', label: 'Asignar paquetes', description: 'Permite asignar paquetes recibidos a un contenedor.' },
  { key: 'unassignPackages', label: 'Desasignar paquetes', description: 'Permite devolver paquetes de un contenedor abierto a la bodega de origen.' },
  { key: 'movePackages', label: 'Mover paquetes', description: 'Permite trasladar paquetes entre contenedores y registrar la trazabilidad del movimiento.' },
  { key: 'consolidate', label: 'Consolidar contenedor', description: 'Permite cambiar el estado operativo de un contenedor a consolidado.' },
  { key: 'dispatch', label: 'Despachar contenedor', description: 'Permite poner el contenedor y sus paquetes en tránsito.' },
  { key: 'sendToCustoms', label: 'Enviar a aduana', description: 'Permite poner el contenedor y sus paquetes en proceso aduanal.' },
  { key: 'addExpense', label: 'Registrar gasto de importación', description: 'Permite agregar gastos de aduana y logística a un contenedor.' },
  { key: 'claim', label: 'Tomar gestión', description: 'Permite tomar la gestión asignada a esta bandeja.' },
  { key: 'release', label: 'Liberar gestión', description: 'Permite liberar una gestión tomada para que pueda procesarla otra persona.' },
  { key: 'post', label: 'Contabilizar', description: 'Permite contabilizar y aplicar el efecto del asiento o ajuste.' },
  { key: 'saveRun', label: 'Guardar ejecución', description: 'Permite guardar una ejecución contable para conservar sus datos y resultados.' },
  { key: 'createJournal', label: 'Crear asiento borrador', description: 'Permite crear un asiento borrador a partir del proceso contable.' },
  { key: 'createReversal', label: 'Crear reversión', description: 'Permite crear el asiento borrador que revierte una ejecución contable.' },
  { key: 'generateProjection', label: 'Generar proyección', description: 'Permite calcular y guardar la proyección operativa de depreciación.' },
  { key: 'processDepreciation', label: 'Procesar depreciación', description: 'Permite procesar depreciación y generar sus asientos contables.' },
  { key: 'updateBalance', label: 'Actualizar saldos', description: 'Permite actualizar los saldos inicial y final del estado bancario.' },
  { key: 'autoMatch', label: 'Aplicar coincidencias automáticas', description: 'Permite asociar automáticamente movimientos bancarios con registros contables.' },
  { key: 'addMovement', label: 'Agregar movimiento', description: 'Permite agregar un movimiento manual al estado bancario.' },
  { key: 'editMovement', label: 'Editar movimiento', description: 'Permite editar monto bancario y notas de un movimiento de conciliación.' },
  { key: 'matchMovement', label: 'Conciliar movimiento', description: 'Permite marcar o desmarcar la coincidencia de un movimiento bancario.' },
  { key: 'complete', label: 'Completar', description: 'Permite completar el flujo después de cumplir sus validaciones.' },
  { key: 'completeEnrollment', label: 'Completar matrícula', description: 'Permite marcar como completada la participación de una persona en una capacitación.' },
  { key: 'lock', label: 'Bloquear período', description: 'Permite bloquear un período contable cerrado.' },
  { key: 'audit', label: 'Auditar facturas', description: 'Permite ejecutar y registrar la revisión de facturas seleccionadas.' },
  { key: 'sendToCorrect', label: 'Enviar a corregir', description: 'Permite trasladar facturas con anomalías al flujo de corrección.' },
  { key: 'reissueInvoice', label: 'Registrar reemisión', description: 'Permite vincular la factura corregida con la factura anulada.' },
  { key: 'approveCancellation', label: 'Aprobar anulación', description: 'Permite aprobar una solicitud pendiente de anulación de factura.' },
  { key: 'rejectCancellation', label: 'Rechazar solicitud', description: 'Permite rechazar una solicitud de anulación de factura.' },
  { key: 'deliver', label: 'Entregar', description: 'Permite confirmar la entrega del registro.' },
  { key: 'open', label: 'Abrir sesión', description: 'Permite abrir una sesión operativa.' },
  { key: 'movement', label: 'Registrar movimiento', description: 'Permite registrar un movimiento manual de efectivo.' },
  { key: 'count', label: 'Registrar arqueo', description: 'Permite registrar el conteo de efectivo de una sesión.' },
  { key: 'resolve', label: 'Resolver faltante', description: 'Permite cobrar o condonar un faltante de caja.' },
  { key: 'configure', label: 'Configurar caja', description: 'Permite actualizar normas y opciones de cierre de caja.' },
  { key: 'import', label: 'Importar', description: 'Permite cargar registros desde archivos o cargas masivas.' },
  { key: 'export', label: 'Exportar', description: 'Permite descargar o exportar información de la vista.' },
  { key: 'viewOtherLocations', label: 'Consultar otras ubicaciones', description: 'Permite consultar existencias del producto en sucursales y almacenes activos del mismo grupo y rubro.' },
  { key: 'manage', label: 'Administrar caja', description: 'Permite mostrar y usar el botón para crear, editar y configurar cajas registradoras.' },
] as const;

/** Permisos de datos sensibles que solo aplican a filas concretas de la matriz. */
export const SENSITIVE_PERMISSION_ACTION_DEFINITIONS = [
  { key: 'viewCost', label: 'Ver costo', description: 'Permite ver costos, valores de inventario y últimos costos de compra.' },
] as const;

/** Vistas de inventario que contienen costos o valoraciones monetarias visibles. */
export const INVENTORY_COST_PERMISSION_MODULES = [
  'INVENTORY',
  'INVENTORY_PRODUCTS',
  'INVENTORY_SERVICES',
  'INVENTORY_ADJUSTMENTS',
  'INVENTORY_MOVEMENTS',
  'INVENTORY_LOSSES',
  'INVENTORY_ASSETS',
] as const;

export function supportsInventoryCostPermission(module: string): boolean {
  return INVENTORY_COST_PERMISSION_MODULES.includes(String(module || '').toUpperCase() as typeof INVENTORY_COST_PERMISSION_MODULES[number]);
}

export type PermissionMatrixAction =
  | typeof PERMISSION_ACTION_DEFINITIONS[number]['key']
  | typeof SENSITIVE_PERMISSION_ACTION_DEFINITIONS[number]['key'];

const GRANULAR_PERMISSION_ACTIONS = new Set<PermissionMatrixAction>([
  'submit', 'requestPayment', 'pay', 'assign', 'enroll', 'cancel', 'cancelInvoice', 'reject', 'convert', 'receive', 'retryInventory', 'confirm', 'completeEnrollment',
  'registerInvoice', 'issue', 'apply', 'void', 'pause', 'resume', 'send', 'sendToCredit', 'sendToCash',
  'claim', 'release', 'deliver', 'open', 'start', 'close', 'reopen', 'movement', 'count', 'resolve', 'configure', 'process',
  'lookup', 'sync', 'registerEvent', 'bill', 'assignPackages', 'unassignPackages', 'movePackages', 'consolidate', 'dispatch', 'sendToCustoms', 'addExpense',
  'post', 'saveRun', 'createJournal', 'createReversal', 'generateProjection', 'processDepreciation', 'updateBalance', 'autoMatch',
  'addMovement', 'editMovement', 'matchMovement', 'complete', 'lock', 'audit', 'sendToCorrect', 'reissueInvoice', 'approveCancellation', 'rejectCancellation',
  'startReview', 'disburse', 'addDocument', 'addNote',
  'startTask', 'returnTaskToPending', 'manageSubtasks', 'startTimeTracking', 'stopTimeTracking', 'addManualTimeEntry',
  'manageGuests', 'sendInvitations', 'scheduleMeeting', 'changeStatus', 'reassign',
  'manageMembers', 'comment', 'reorder', 'react', 'linkErp', 'autoPlan', 'updateProgress',
  'manageMaterials', 'sendToSuppliers', 'manualFill', 'reviewOverwrite', 'selectOffers',
  'applyCostTemplate', 'editPricing', 'syncPricing', 'manageCalculationMemory', 'recordProgress',
  'editCurve', 'createCapture', 'deleteCapture', 'managePublicLinks',
  'importProspects', 'updateProspect', 'changeStage', 'registerVisit', 'discardProspect', 'assignProspect',
  'attachEvidence', 'manageConsent', 'createRoute', 'editRoute', 'assignRoute', 'changeRouteStatus',
  'completeRouteStop', 'updatePresence', 'hidePresence', 'configureLocation', 'configureRestaurant',
  'startTicket', 'returnTicketToOpen', 'resolveTicket', 'closeTicket', 'reopenTicket', 'commentTicket',
  'startCase', 'requestCaseDocuments', 'returnCaseToPending', 'completeCase', 'cancelCase', 'assignCase',
  'addCaseNote', 'attachCaseDocument', 'sendCaseMessage',
  'closeTable', 'changeTableStatus', 'shareQr', 'rotateQr', 'addOrderItems', 'confirmOrder',
  'markOrderReady', 'serveOrder', 'cancelOrder', 'sendToKitchen', 'startPreparation',
  'markKitchenReady', 'cancelKitchenTicket', 'editDeliveryDetails', 'queueDelivery', 'startDeliveryPreparation',
  'markDeliveryReady', 'dispatchDelivery', 'markDelivered', 'cancelDelivery',
  'createRoomType', 'editRoomType', 'changeRoomTypeAvailability', 'createRoom', 'editRoom', 'changeRoomAvailability',
  'checkIn', 'checkOut', 'payAtCheckout', 'cancelReservation', 'markNoShow', 'issueGuestLink', 'revokeGuestLink',
]);

export const PERMISSION_ACTION_KEYS = PERMISSION_ACTION_DEFINITIONS.map(action => action.key);

/**
 * Vistas que tienen una acción de flujo además del CRUD: aprobar, enviar a
 * otra vista, confirmar una transacción, aplicar/contabilizar o registrar un
 * pago. La matriz no muestra "Aprobar" en las demás vistas para no crear
 * permisos ambiguos.
 */
export const APPROVAL_PERMISSION_MODULES = [
  'SALES_QUOTES',
  'SALES_ORDERS',
  'SALES_INVOICES',
  'SALES_RETURNS',
  'SALES_CREDIT_NOTES',
  'SALES_PAYMENTS',
  'RETAIL_POS',
  'RETAIL_CASH_CONTROL',
  'HOTEL_RESERVATIONS',
  'PURCHASES_REQUESTS',
  'PURCHASES_ORDERS',
  'PURCHASES_RECEIPTS',
  'PURCHASES_RETURNS',
  'PURCHASES_PAYMENTS',
  'INVENTORY_ADJUSTMENTS',
  'INVENTORY_AUDITS',
  'HR_EMPLOYEES',
  'HR_LEAVES',
  'ACCOUNTING_HR_PAYMENT_REQUESTS',
  'ACCOUNTING_JOURNAL',
  'ACCOUNTING_RECONCILIATION',
  'ACCOUNTING_EXCHANGE_DIFFERENCES',
  'ACCOUNTING_PERIODS',
  'ACCOUNTING_ASSETS',
  'ACTIVITIES_TASKS',
  'FINANCING',
  'PROJECTS_EXPENSES',
] as const;

/**
 * Acciones que realmente se consumen por cada vista del catálogo de Roles.
 *
 * La pantalla no debe ofrecer una matriz CRUD idéntica para todas las vistas:
 * un reporte no crea registros y un dashboard no elimina datos. Los permisos
 * históricos que no aparecen aquí siguen siendo aceptados por el backend y
 * se conservan al editar un rol, pero no se ofrecen como nuevas opciones.
 */
const VIEW_PERMISSION_ACTIONS: Record<string, readonly PermissionMatrixAction[]> = {
  DASHBOARD: ['read', 'export'],
  FINANCING: ['read', 'create', 'edit', 'approve', 'startReview', 'reject', 'disburse', 'reopen', 'export'],
  SALES: ['read'],
  RESTAURANT: ['read', 'configureRestaurant', 'export'],
  HOTEL: ['read'],
  TRACKING: ['read', 'export'],
  PURCHASES: ['read', 'create', 'delete'],
  INVENTORY: ['read', 'export', 'viewCost'],
  FINANCIAL: ['read', 'export'],
  ACCOUNTING: ['read', 'create', 'edit', 'delete', 'import', 'export'],
  HR: ['read', 'export'],
  ACTIVITIES: ['read', 'export'],
  ASANA: ['read', 'create', 'edit', 'delete', 'export'],
  ASANA_TASKS: ['read', 'create', 'edit', 'delete', 'export'],
  PROJECTS: ['read', 'create', 'edit', 'delete', 'export'],
  FORCE_SALES: [
    'read', 'create', 'edit', 'importProspects', 'updateProspect', 'changeStage', 'registerVisit',
    'discardProspect', 'assignProspect', 'attachEvidence', 'manageConsent', 'send', 'createRoute',
    'editRoute', 'assignRoute', 'changeRouteStatus', 'completeRouteStop', 'updatePresence', 'hidePresence',
    'configureLocation',
  ],
  TICKETS: ['read', 'create', 'edit', 'delete', 'export'],
  HR_TRAINING: ['read', 'create', 'edit', 'delete', 'enroll', 'start', 'complete', 'completeEnrollment', 'cancel', 'requestPayment'],
  SUPPORT_TECH: ['read', 'create', 'edit', 'delete'],
  LEGAL: ['read'],
  NOVACHAT: ['read', 'create', 'edit', 'delete'],
  DOCUMENTS: ['read'],
  NOTIFICATIONS: ['read'],
  REPORTS: ['read', 'export'],
  MY_COMPANY: ['read'],
  CONFIGURATION: ['read', 'edit'],

  SALES_CLIENTS: ['read', 'create', 'edit', 'delete', 'import', 'export'],
  SALES_QUOTES: ['read', 'create', 'edit', 'delete', 'submit', 'convert', 'cancel', 'export', 'viewOtherLocations'],
  SALES_ORDERS: ['read', 'create', 'edit', 'submit', 'approve', 'convert', 'cancel', 'export', 'viewOtherLocations'],
  SALES_INVOICES: ['read', 'create', 'edit', 'delete', 'submit', 'sendToCredit', 'sendToCash', 'cancel', 'export', 'viewOtherLocations'],
  SALES_RECURRING: ['read', 'create', 'edit', 'pause', 'resume', 'cancel', 'export', 'viewOtherLocations'],
  SALES_PAYMENTS: ['read', 'edit', 'pay', 'cancel', 'export'],
  SALES_RETURNS: ['read', 'create', 'edit', 'approve', 'process', 'reject', 'export'],
  SALES_CREDIT_NOTES: ['read', 'create', 'edit', 'issue', 'send', 'pay', 'cancel', 'export', 'viewOtherLocations'],
  SALES_PRICE_LISTS: ['read', 'create', 'edit', 'import', 'export'],
  RETAIL_POS: ['read', 'create', 'edit', 'delete', 'pay', 'reconcile', 'claim', 'release', 'confirm', 'deliver', 'cancel', 'export', 'viewOtherLocations'],
  RETAIL_CASH_CONTROL: ['read', 'create', 'edit', 'delete', 'open', 'movement', 'count', 'close', 'resolve', 'configure', 'export', 'manage'],


  // IDs separados para las pestañas del POS de restaurante.
  RESTAURANT_TABLES: ['read', 'export'],
  RESTAURANT_SALON: ['read', 'create', 'edit', 'closeTable', 'changeTableStatus', 'shareQr', 'rotateQr', 'export'],
  RESTAURANT_ORDERS: ['read', 'create', 'edit', 'addOrderItems', 'confirmOrder', 'sendToKitchen', 'startPreparation', 'markOrderReady', 'serveOrder', 'cancelOrder', 'pay', 'editDeliveryDetails', 'queueDelivery', 'startDeliveryPreparation', 'markDeliveryReady', 'dispatchDelivery', 'markDelivered', 'cancelDelivery', 'export'],
  RESTAURANT_MENU: ['read', 'create', 'edit', 'export'],
  RESTAURANT_KITCHEN: ['read', 'sendToKitchen', 'startPreparation', 'markKitchenReady', 'serveOrder', 'cancelKitchenTicket', 'export'],
  RESTAURANT_REPORTS: ['read', 'export'],
  HOTEL_ROOMS: ['read', 'createRoomType', 'editRoomType', 'changeRoomTypeAvailability', 'createRoom', 'editRoom', 'changeRoomAvailability', 'export'],
  HOTEL_RESERVATIONS: ['read', 'create', 'edit', 'checkIn', 'checkOut', 'payAtCheckout', 'cancelReservation', 'markNoShow', 'issueGuestLink', 'revokeGuestLink', 'export'],

  PURCHASES_REQUESTS: ['read', 'create', 'edit', 'delete', 'submit', 'approve', 'cancel', 'reject', 'convert', 'export'],
  PURCHASES_PROVIDERS: ['read', 'create', 'edit', 'delete', 'import', 'export'],
  PURCHASES_EXPENSES: ['read', 'create', 'edit', 'delete', 'submit', 'pay', 'import', 'export'],
  PURCHASES_EXPENSES_REC: ['read', 'create', 'edit', 'delete', 'pause', 'resume', 'export'],
  PURCHASES_ORDERS: ['read', 'create', 'edit', 'submit', 'approve', 'reject', 'import', 'export'],
  PURCHASES_RECEIPTS: ['read', 'create', 'edit', 'receive', 'cancel', 'cancelInvoice', 'retryInventory', 'registerInvoice', 'export'],
  PURCHASES_INVOICES_REC: ['read', 'create', 'edit', 'delete', 'pause', 'resume', 'cancel', 'export'],
  PURCHASES_PAYMENTS: ['read', 'pay', 'edit', 'cancel', 'export'],
  PURCHASES_RETURNS: ['read', 'create', 'edit', 'delete', 'issue', 'apply', 'void', 'import', 'export'],
  TRACKING_TRANSIT: ['read', 'create', 'delete', 'lookup', 'sync', 'registerEvent', 'export'],
  TRACKING_RECEPTION: ['read', 'receive', 'export'],
  TRACKING_BATCHES: ['read', 'create', 'edit', 'delete', 'confirm', 'export'],
  TRACKING_PACKAGES: ['read', 'import', 'export'],
  TRACKING_RECONCILIATION: ['read', 'confirm', 'export'],
  TRACKING_BILLING: ['read', 'bill', 'deliver', 'send', 'issue', 'cancel', 'export'],
  TRACKING_CONFIG: ['read', 'edit', 'delete'],

  IMPORT_INTL: ['read'],
  IMPORT_INTL_ORIGIN: ['read', 'create', 'edit', 'delete', 'registerEvent', 'deliver', 'cancel'],
  IMPORT_INTL_CONTAINERS: ['read', 'create', 'edit', 'delete', 'assignPackages', 'unassignPackages', 'movePackages', 'consolidate', 'dispatch', 'sendToCustoms', 'cancel'],
  IMPORT_INTL_CUSTOMS: ['read', 'addExpense', 'close', 'closeByException', 'reopenContainer'],
  // Las reglas de factor se administran aquí, por eso create/delete.
  IMPORT_INTL_CONFIG: ['read', 'create', 'edit', 'delete'],

  INVENTORY_PRODUCTS: ['read', 'create', 'edit', 'delete', 'import', 'export', 'viewCost'],
  INVENTORY_SERVICES: ['read', 'create', 'edit', 'delete', 'import', 'export', 'viewCost'],
  INVENTORY_ATTRIBUTES: ['read', 'create', 'edit', 'delete', 'export'],
  INVENTORY_WAREHOUSES: ['read', 'create', 'edit', 'delete', 'export'],
  INVENTORY_TRANSFERS: ['read', 'create', 'edit', 'export'],
  INVENTORY_ADJUSTMENTS: ['read', 'create', 'approve', 'export', 'viewCost'],
  INVENTORY_MOVEMENTS: ['read', 'create', 'export', 'viewCost'],
  INVENTORY_AUDITS: ['read', 'create', 'delete', 'start', 'close', 'approve', 'reopen', 'cancel', 'export'],
  INVENTORY_LOSSES: ['read', 'export', 'viewCost'],
  INVENTORY_ASSETS: ['read', 'create', 'edit', 'delete', 'import', 'export', 'viewCost'],
  INVENTORY_CONFIG: ['read', 'edit'],

  FINANCIAL_DASHBOARD: ['read', 'export'],
  FINANCIAL_BANK: ['read', 'export'],
  FINANCIAL_RECEIVABLES: ['read', 'export'],
  FINANCIAL_PAYABLES: ['read', 'export'],
  FINANCIAL_INCOMES: ['read', 'create', 'edit', 'delete', 'import', 'export'],
  FINANCIAL_EXPENSES: ['read', 'create', 'edit', 'delete', 'submit', 'pay', 'import', 'export'],
  FINANCIAL_EXPENSES_REC: ['read', 'create', 'edit', 'delete', 'export'],
  FINANCIAL_CALENDAR: ['read', 'export'],
  FINANCIAL_ANALYSIS: ['read', 'export'],
  FINANCIAL_BALANCE: ['read', 'export'],
  FINANCIAL_LOSSES: ['read', 'export'],
  FINANCIAL_INCOMES_REC: ['read', 'create', 'edit', 'delete', 'export'],
  FINANCIAL_ACCOUNTS: ['read', 'create', 'edit', 'delete'],
  FINANCIAL_JOURNAL: ['read', 'export'],
  FINANCIAL_LEDGER: ['read', 'export'],
  FINANCIAL_BUDGET: ['read', 'create', 'edit', 'delete', 'export'],
  FINANCIAL_REPORTS: ['read', 'export'],

  HR_DASHBOARD: ['read', 'export'],
  HR_EMPLOYEES: ['read', 'create', 'edit', 'delete', 'import', 'export', 'submit', 'approve', 'reject'],
  HR_DEPARTMENTS: ['read', 'create', 'edit', 'delete', 'export'],
  HR_PAYROLL: ['read', 'create', 'edit', 'delete', 'import', 'export', 'process', 'requestPayment'],
  HR_COMMISSIONS: ['read', 'export'],
  HR_COMMISSIONS_CONFIG: ['read', 'edit'],
  HR_ATTENDANCE: ['read', 'create', 'import', 'export'],
  HR_LEAVES: ['read', 'create', 'edit', 'delete', 'approve', 'reject', 'export'],
  HR_PERFORMANCE: ['read', 'create', 'edit', 'export'],
  HR_BENEFITS: ['read', 'create', 'edit', 'delete', 'assign', 'requestPayment', 'export'],
  HR_PAYROLL_CONFIG: ['read', 'create', 'edit'],

  ACTIVITIES_TASKS: ['read', 'create', 'edit', 'delete', 'startTask', 'returnTaskToPending', 'submit', 'complete', 'approve', 'reject', 'claim', 'reassign', 'manageSubtasks', 'startTimeTracking', 'stopTimeTracking', 'addManualTimeEntry', 'export'],
  ACTIVITIES_EVENTS: ['read', 'create', 'edit', 'delete', 'complete', 'cancel', 'manageGuests', 'sendInvitations', 'scheduleMeeting', 'export'],
  ACTIVITIES_REMINDERS: ['read', 'create', 'edit', 'delete', 'changeStatus', 'export'],
  ACTIVITIES_LOGS: ['read', 'create', 'edit', 'delete', 'export'],
  ACTIVITIES_CALENDAR: ['read', 'export'],
  ACTIVITIES_MEETINGS: ['read', 'create', 'edit', 'delete', 'complete', 'cancel', 'manageGuests', 'sendInvitations', 'scheduleMeeting', 'export'],

  PROJECTS_LIST: ['read', 'create', 'edit', 'delete', 'complete', 'cancel', 'changeStatus', 'manageMembers', 'comment', 'export'],
  PROJECTS_TASKS: ['read', 'create', 'edit', 'delete', 'complete', 'cancel', 'changeStatus', 'reorder', 'comment', 'react', 'linkErp', 'autoPlan', 'export'],
  PROJECTS_MILESTONES: ['read', 'create', 'edit', 'delete', 'complete', 'cancel', 'changeStatus', 'updateProgress', 'export'],
  PROJECTS_QUOTATIONS: ['read', 'create', 'edit', 'delete', 'manageMaterials', 'sendToSuppliers', 'manualFill', 'reviewOverwrite', 'selectOffers', 'export'],
  PROJECTS_EXPENSES: ['read', 'create', 'edit', 'approve', 'reorder', 'applyCostTemplate', 'createJournal', 'editPricing', 'syncPricing', 'manageCalculationMemory', 'export'],
  PROJECTS_DOCUMENTS: ['read', 'create', 'delete', 'export'],
  PROJECTS_TIME: ['read', 'export'],
  PROJECTS_PROGRESS: ['read', 'recordProgress', 'editCurve', 'createCapture', 'deleteCapture', 'managePublicLinks', 'export'],

  DOCUMENTS_FILES: ['read', 'create', 'edit', 'delete'],
  DOCUMENTS_CONTRACTS: ['read', 'create', 'edit', 'delete'],
  DOCUMENTS_INVOICES: ['read', 'create', 'edit', 'delete'],
  DOCUMENTS_REPORTS: ['read', 'create', 'edit', 'delete'],
  DOCUMENTS_FOLDERS: ['read', 'create', 'edit', 'delete'],
  DOCUMENTS_STORAGE_PLANS: ['read'],
  NOTIFICATIONS_ALERTS: ['read', 'create', 'edit', 'delete'],
  NOTIFICATIONS_MESSAGES: ['read', 'create', 'edit', 'delete'],
  NOTIFICATIONS_PUSH: ['read', 'create', 'edit', 'delete'],
  TICKETS_KNOWLEDGE_BASE: ['read', 'create', 'edit', 'delete'],
  TICKETS_AGENTS: ['read'],
  // TICKETS_LIST es la vista del sidebar. TICKETS_VIEW se conserva como
  // alias de compatibilidad para roles históricos.
  TICKETS_LIST: ['read', 'create', 'edit', 'delete', 'startTicket', 'returnTicketToOpen', 'resolveTicket', 'closeTicket', 'reopenTicket', 'commentTicket', 'export'],
  TICKETS_VIEW: ['read', 'create', 'edit', 'delete', 'startTicket', 'returnTicketToOpen', 'resolveTicket', 'closeTicket', 'reopenTicket', 'commentTicket', 'export'],
  LEGAL_CASES: ['read', 'create', 'edit', 'startCase', 'requestCaseDocuments', 'returnCaseToPending', 'completeCase', 'cancelCase', 'assignCase', 'addCaseNote', 'attachCaseDocument', 'sendCaseMessage'],
  LEGAL_REMINDERS: ['read', 'create', 'delete'],

  REPORTS_SALES: ['read', 'export'],
  REPORTS_PURCHASES: ['read', 'export'],
  REPORTS_FINANCIAL: ['read', 'export'],
  REPORTS_INVENTORY: ['read', 'export'],
  REPORTS_CLIENTS: ['read', 'export'],
  REPORTS_PROVIDERS: ['read', 'export'],
  REPORTS_HR: ['read', 'export'],

  FINANCING_APPLICATIONS: ['read', 'create', 'edit', 'addDocument', 'addNote', 'export'],
  FINANCING_CALCULATOR: ['read'],

  ACCOUNTING_CHART: ['read', 'create', 'edit', 'delete', 'import', 'export'],
  ACCOUNTING_JOURNAL: ['read', 'create', 'edit', 'delete', 'post', 'void', 'export'],
  ACCOUNTING_HR_PAYMENT_REQUESTS: ['read', 'delete', 'approve', 'reject', 'pay', 'export'],
  ACCOUNTING_LEDGER: ['read', 'export'],
  ACCOUNTING_TRIAL_BALANCE: ['read', 'export'],
  ACCOUNTING_PROFIT_LOSS: ['read', 'export'],
  ACCOUNTING_BALANCE_SHEET: ['read', 'export'],
  ACCOUNTING_CASH_FLOW: ['read', 'export'],
  ACCOUNTING_EXCHANGE_DIFFERENCES: ['read', 'saveRun', 'createJournal', 'post', 'createReversal', 'export'],
  ACCOUNTING_EQUITY: ['read', 'export'],
  ACCOUNTING_ASSETS: ['read', 'create', 'edit', 'delete', 'import', 'generateProjection', 'processDepreciation', 'export'],
  ACCOUNTING_RECONCILIATION: ['read', 'create', 'edit', 'updateBalance', 'autoMatch', 'addMovement', 'editMovement', 'matchMovement', 'complete', 'export'],
  ACCOUNTING_PERIODS: ['read', 'create', 'close', 'reopen', 'lock'],
  ACCOUNTING_FISCAL: ['read', 'create', 'delete', 'export'],
  ACCOUNTING_INVOICE_AUDIT: ['read', 'audit', 'sendToCorrect', 'cancelInvoice', 'reissueInvoice', 'approveCancellation', 'rejectCancellation'],
  ACCOUNTING_BUDGET: ['read', 'create', 'edit', 'delete', 'export'],
  ACCOUNTING_EXPENSE_CATEGORIES: ['read', 'create', 'edit', 'delete'],
  ACCOUNTING_CONFIG: ['read', 'create', 'edit', 'delete', 'import', 'export'],

  CONFIG_BRANDING: ['read', 'edit'],
  CONFIG_PDF: ['read', 'create', 'edit', 'delete', 'import'],
  CONFIG_SECURITY: ['read', 'edit'],
  AUDIT_LOGS: ['read', 'export'],
  CONFIG_CURRENCY: ['read', 'edit'],
  CONFIG_COMPANY: ['read', 'create', 'edit', 'delete'],
  SUBSCRIPTIONS: ['read', 'create', 'edit'],
  CONFIG_USERS: ['read', 'create', 'edit', 'delete'],
  CONFIG_ROLES: ['read', 'create', 'edit', 'delete'],
  CONFIG_DEPARTMENTS: ['read', 'create', 'edit', 'delete'],
  CONFIG_NOVA_PULSE: ['read', 'edit', 'send'],
  CONFIG_DOMAINS: ['read'],
};

export function getPermissionActionKeys(module: string): readonly PermissionMatrixAction[] {
  return VIEW_PERMISSION_ACTIONS[String(module || '').toUpperCase()] || ['read'];
}

export function supportsPermissionAction(module: string, action: PermissionMatrixAction): boolean {
  if (action === 'viewCost') return supportsInventoryCostPermission(module);
  return getPermissionActionKeys(module).includes(action);
}

export function permissionValue(permission: any, action: PermissionMatrixAction, module?: string): boolean {
  if (!permission) return false;
  const permissionModule = String(module || permission.module || '').toUpperCase();
  if (action === 'viewCost') return permission.viewCost === true || permission.canViewCost === true;
  if (action === 'read') return permission.read === true || permission.view === true || permission.canView === true;
  if (action === 'import' && permissionModule === 'TRACKING_PACKAGES') {
    return approvalActionValue(permission, action, permissionModule);
  }
  if (GRANULAR_PERMISSION_ACTIONS.has(action)) return approvalActionValue(permission, action, permissionModule);
  if (action === 'delete' && permissionModule === 'PURCHASES_REQUESTS') {
    if (permission.delete !== undefined) return permission.delete === true;
    if (permission.canDelete !== undefined) return permission.canDelete === true;
    return false;
  }
  // Los roles existentes pueden guardar la misma capacidad con los nombres
  // históricos "deactivate", "cancel", "reject" o "reverse". Se muestran y editan como Eliminar.
  if (action === 'delete' && (
    permission.delete === true || permission.deactivate === true || permission.cancel === true || permission.reject === true || permission.reverse === true
    || permission.canDelete === true || permission.canDeactivate === true || permission.canCancel === true || permission.canReject === true || permission.canReverse === true
  )) return true;
  if (permission[action] !== undefined) return permission[action] === true;
  const frontendKey = `can${action.charAt(0).toUpperCase()}${action.slice(1)}`;
  if (permission[frontendKey] !== undefined) return permission[frontendKey] === true;
  if ((action === 'create' || action === 'edit') && permission.write === true) return true;
  return false;
}

/**
 * Granular flow flags win when present. Old roles that only stored `approve`
 * keep their previous capability until an administrator saves an explicit
 * value for the granular action.
 */
export function approvalActionValue(permission: any, action: string, module?: string): boolean {
  if (!permission) return false;
  const actionValue = permission[action];
  const frontendKey = `can${action.charAt(0).toUpperCase()}${action.slice(1)}`;
  const frontendValue = permission[frontendKey];
  const permissionModule = String(module || permission.module || '').toUpperCase();

  const activitiesFallbacks: Record<string, Record<string, string[]>> = {
    ACTIVITIES_TASKS: {
      startTask: ['edit'], returnTaskToPending: ['edit'], submit: ['edit'], complete: ['approve'],
      reject: ['approve'], claim: ['edit'], reassign: ['edit'], manageSubtasks: ['edit'],
      startTimeTracking: ['edit'], stopTimeTracking: ['edit'], addManualTimeEntry: ['edit'],
    },
    ACTIVITIES_EVENTS: {
      complete: ['approve'], cancel: ['edit'], manageGuests: ['edit'], sendInvitations: ['edit'],
      scheduleMeeting: ['edit'], changeStatus: ['edit'],
    },
    ACTIVITIES_MEETINGS: {
      complete: ['approve'], cancel: ['edit'], manageGuests: ['edit'], sendInvitations: ['edit'],
      scheduleMeeting: ['edit'], changeStatus: ['edit'],
    },
    ACTIVITIES_CALENDAR: {
      complete: ['approve'], cancel: ['edit'], manageGuests: ['edit'], sendInvitations: ['edit'],
      scheduleMeeting: ['edit'], changeStatus: ['edit'],
    },
    ACTIVITIES_REMINDERS: { changeStatus: ['edit'] },
  };
  const activitiesLegacyActions = activitiesFallbacks[permissionModule]?.[action];
  if (activitiesLegacyActions) {
    if (typeof actionValue === 'boolean') return actionValue;
    if (typeof frontendValue === 'boolean') return frontendValue;
    if (permission.canManage === true || permission.manage === true) return true;
    return activitiesLegacyActions.some((legacyAction) => permissionValue(permission, legacyAction as PermissionMatrixAction, permissionModule));
  }

  const projectFallbacks: Record<string, Record<string, string[]>> = {
    PROJECTS_LIST: { complete: ['edit'], cancel: ['edit'], changeStatus: ['edit'], manageMembers: ['edit'], comment: ['create'] },
    PROJECTS_TASKS: {
      complete: ['edit'], cancel: ['edit'], changeStatus: ['edit'], reorder: ['edit'], comment: ['edit'],
      react: ['edit'], linkErp: ['edit'], autoPlan: ['edit'],
    },
    PROJECTS_MILESTONES: { complete: ['edit'], cancel: ['edit'], changeStatus: ['edit'], updateProgress: ['edit'] },
    PROJECTS_QUOTATIONS: {
      manageMaterials: ['edit'], sendToSuppliers: ['create', 'edit'], manualFill: ['edit'],
      reviewOverwrite: ['edit'], selectOffers: ['edit'],
    },
    PROJECTS_EXPENSES: {
      approve: ['edit'], createJournal: ['edit'], applyCostTemplate: ['edit'], editPricing: ['edit'],
      syncPricing: ['edit'], manageCalculationMemory: ['edit'], reorder: ['edit'],
    },
    PROJECTS_PROGRESS: {
      recordProgress: ['edit'], editCurve: ['edit'], createCapture: ['create'],
      deleteCapture: ['delete'], managePublicLinks: ['edit'],
    },
  };
  const projectLegacyActions = projectFallbacks[permissionModule]?.[action];
  if (projectLegacyActions) {
    if (typeof actionValue === 'boolean') return actionValue;
    if (typeof frontendValue === 'boolean') return frontendValue;
    if (permission.canManage === true || permission.manage === true) return true;
    return projectLegacyActions.some((legacyAction) => permissionValue(permission, legacyAction as PermissionMatrixAction, permissionModule));
  }

  const ticketFallbacks: Record<string, Record<string, string[]>> = {
    TICKETS_LIST: {
      startTicket: ['edit'], returnTicketToOpen: ['edit'], resolveTicket: ['edit'], closeTicket: ['edit'],
      reopenTicket: ['approve'], commentTicket: ['create'],
    },
    TICKETS_VIEW: {
      startTicket: ['edit'], returnTicketToOpen: ['edit'], resolveTicket: ['edit'], closeTicket: ['edit'],
      reopenTicket: ['approve'], commentTicket: ['create'],
    },
  };
  const ticketLegacyActions = ticketFallbacks[permissionModule]?.[action];
  if (ticketLegacyActions) {
    if (typeof actionValue === 'boolean') return actionValue;
    if (typeof frontendValue === 'boolean') return frontendValue;
    if (permission.canManage === true || permission.manage === true) return true;
    return ticketLegacyActions.some((legacyAction) => permissionValue(permission, legacyAction as PermissionMatrixAction, permissionModule));
  }

  const legalFallbacks: Record<string, Record<string, string[]>> = {
    LEGAL_CASES: {
      startCase: ['approve'], requestCaseDocuments: ['approve'], returnCaseToPending: ['approve'],
      completeCase: ['approve'], cancelCase: ['approve'], assignCase: ['create', 'approve'],
      addCaseNote: ['edit'], attachCaseDocument: ['edit'], sendCaseMessage: ['edit'],
    },
  };
  const legalLegacyActions = legalFallbacks[permissionModule]?.[action];
  if (legalLegacyActions) {
    if (typeof actionValue === 'boolean') return actionValue;
    if (typeof frontendValue === 'boolean') return frontendValue;
    if (permission.canManage === true || permission.manage === true) return true;
    return legalLegacyActions.some((legacyAction) => permissionValue(permission, legacyAction as PermissionMatrixAction, permissionModule));
  }

  const salesFallbacks: Record<string, Record<string, string[]>> = {
    SALES_QUOTES: { submit: ['create', 'edit'], convert: ['approve'], cancel: ['delete'] },
    SALES_ORDERS: { submit: ['create', 'edit'], convert: ['approve'], cancel: ['delete'] },
    SALES_INVOICES: { submit: ['create', 'edit'], sendToCredit: ['approve'], sendToCash: ['approve'], cancel: ['delete'] },
    SALES_PAYMENTS: { pay: ['approve'], cancel: ['delete'] },
    SALES_RECURRING: { pause: ['edit'], resume: ['edit'], cancel: ['delete'] },
    SALES_RETURNS: { process: ['approve'], reject: ['delete'] },
    SALES_CREDIT_NOTES: { issue: ['approve'], send: ['approve'], pay: ['approve'], cancel: ['delete'] },
    RETAIL_POS: { pay: ['approve'], reconcile: ['approve'], claim: ['edit'], release: ['delete'], confirm: ['approve'], deliver: ['approve'], cancel: ['delete'] },
    RETAIL_CASH_CONTROL: { open: ['edit'], movement: ['edit'], count: ['approve'], close: ['approve'], resolve: ['approve'], configure: ['edit'] },
  };
  const salesLegacyActions = salesFallbacks[permissionModule]?.[action];
  if (salesLegacyActions) {
    if (typeof actionValue === 'boolean') return actionValue;
    if (typeof frontendValue === 'boolean') return frontendValue;
    if (permission.canManage === true || permission.manage === true) return true;
    return salesLegacyActions.some((legacyAction) => permissionValue(permission, legacyAction as PermissionMatrixAction, permissionModule));
  }

  const purchaseFallbacks: Record<string, Record<string, string[]>> = {
    PURCHASES_ORDERS: { submit: ['create', 'edit'], reject: ['delete'] },
    PURCHASES_RECEIPTS: { receive: ['approve'], cancel: ['delete'], cancelInvoice: ['delete'], retryInventory: ['approve'], registerInvoice: ['create', 'edit'] },
    PURCHASES_PAYMENTS: { pay: ['approve'], cancel: ['delete'] },
    PURCHASES_RETURNS: { issue: ['approve'], apply: ['approve'], void: ['delete'] },
    PURCHASES_EXPENSES_REC: { pause: ['edit'], resume: ['edit'] },
    PURCHASES_INVOICES_REC: { pause: ['edit'], resume: ['edit'], cancel: ['delete'] },
  };
  const legacyActions = purchaseFallbacks[permissionModule]?.[action];
  if (legacyActions) {
    if (typeof actionValue === 'boolean') return actionValue;
    if (typeof frontendValue === 'boolean') return frontendValue;
    if (permission.canManage === true || permission.manage === true) return true;
    if (permissionModule === 'PURCHASES_PAYMENTS' && action === 'pay') {
      const canCreate = permission.create === true || permission.canCreate === true || permission.write === true || permission.canWrite === true;
      const canApprove = permission.approve === true || permission.canApprove === true;
      return canCreate && canApprove;
    }
    return legacyActions.some((legacyAction) => permissionValue(permission, legacyAction as PermissionMatrixAction, permissionModule));
  }

  const inventoryFallbacks: Record<string, Record<string, string[]>> = {
    INVENTORY_AUDITS: { start: ['approve'], close: ['approve'], reopen: ['approve'], cancel: ['delete'] },
  };
  const inventoryLegacyActions = inventoryFallbacks[permissionModule]?.[action];
  if (inventoryLegacyActions) {
    if (typeof actionValue === 'boolean') return actionValue;
    if (typeof frontendValue === 'boolean') return frontendValue;
    if (permission.canManage === true || permission.manage === true) return true;
    return inventoryLegacyActions.some((legacyAction) => permissionValue(permission, legacyAction as PermissionMatrixAction, permissionModule));
  }

  const trackingFallbacks: Record<string, Record<string, string[]>> = {
    TRACKING_TRANSIT: { lookup: ['read'], sync: ['edit'], registerEvent: ['edit'] },
    TRACKING_RECEPTION: { receive: ['create'], confirm: ['approve'] },
    TRACKING_PACKAGES: { import: ['create'] },
    TRACKING_BATCHES: { confirm: ['approve'] },
    TRACKING_RECONCILIATION: { confirm: ['approve'] },
    TRACKING_BILLING: { bill: ['approve'], deliver: ['approve'], send: ['approve'], issue: ['approve'], cancel: ['delete'] },
  };
  const trackingLegacyActions = trackingFallbacks[permissionModule]?.[action];
  if (trackingLegacyActions) {
    if (typeof actionValue === 'boolean') return actionValue;
    if (typeof frontendValue === 'boolean') return frontendValue;
    if (permission.canManage === true || permission.manage === true) return true;
    return trackingLegacyActions.some((legacyAction) => permissionValue(permission, legacyAction as PermissionMatrixAction, permissionModule));
  }

  const intlImportFallbacks: Record<string, Record<string, string[]>> = {
    IMPORT_INTL_ORIGIN: { registerEvent: ['edit'], deliver: ['edit'], cancel: ['edit'] },
    IMPORT_INTL_CONTAINERS: {
      assignPackages: ['edit'], unassignPackages: ['edit'], movePackages: ['edit'],
      consolidate: ['edit'], dispatch: ['edit'], sendToCustoms: ['edit'], cancel: ['edit'],
    },
    IMPORT_INTL_CUSTOMS: { addExpense: ['edit'], close: ['approve'] },
  };
  const intlImportLegacyActions = intlImportFallbacks[permissionModule]?.[action];
  if (intlImportLegacyActions) {
    if (typeof actionValue === 'boolean') return actionValue;
    if (typeof frontendValue === 'boolean') return frontendValue;
    if (permission.canManage === true || permission.manage === true) return true;
    return intlImportLegacyActions.some((legacyAction) => permissionValue(permission, legacyAction as PermissionMatrixAction, permissionModule));
  }

  const accountingFallbacks: Record<string, Record<string, string[]>> = {
    ACCOUNTING_JOURNAL: { post: ['approve'], void: ['delete'] },
    ACCOUNTING_HR_PAYMENT_REQUESTS: { pay: ['approve'], reject: ['delete'] },
    ACCOUNTING_EXCHANGE_DIFFERENCES: {
      saveRun: ['create'], createJournal: ['create'], post: ['approve'], createReversal: ['create'],
    },
    ACCOUNTING_ASSETS: { generateProjection: ['approve'], processDepreciation: ['approve'] },
    ACCOUNTING_RECONCILIATION: {
      updateBalance: ['edit'], autoMatch: ['edit'], addMovement: ['edit'],
      editMovement: ['edit'], matchMovement: ['edit'], complete: ['approve'],
    },
    ACCOUNTING_PERIODS: { close: ['approve'], reopen: ['approve'], lock: ['approve'] },
    ACCOUNTING_INVOICE_AUDIT: {
      audit: ['create'], sendToCorrect: ['edit'], cancelInvoice: ['approve'], reissueInvoice: ['edit'],
      approveCancellation: ['approve'], rejectCancellation: ['approve'],
    },
  };
  const accountingLegacyActions = accountingFallbacks[permissionModule]?.[action];
  if (accountingLegacyActions) {
    if (typeof actionValue === 'boolean') return actionValue;
    if (typeof frontendValue === 'boolean') return frontendValue;
    if (permission.canManage === true || permission.manage === true) return true;
    return accountingLegacyActions.some((legacyAction) => permissionValue(permission, legacyAction as PermissionMatrixAction, permissionModule));
  }

  const hrFallbacks: Record<string, Record<string, string[]>> = {
    HR_EMPLOYEES: { submit: ['approve'], reject: ['approve'] },
    HR_PAYROLL: { process: ['approve'], requestPayment: ['approve', 'submit'] },
    HR_LEAVES: { reject: ['approve'] },
    HR_TRAINING: {
      enroll: ['create'], start: ['edit'], complete: ['approve', 'edit'], completeEnrollment: ['approve', 'edit'], cancel: ['edit'], requestPayment: ['approve', 'submit'],
    },
    HR_BENEFITS: { assign: ['approve', 'create', 'edit'], requestPayment: ['approve', 'submit'] },
  };
  const hrLegacyActions = hrFallbacks[permissionModule]?.[action];
  if (hrLegacyActions) {
    if (typeof actionValue === 'boolean') return actionValue;
    if (typeof frontendValue === 'boolean') return frontendValue;
    if (permission.canManage === true || permission.manage === true) return true;
    return hrLegacyActions.some((legacyAction) => permissionValue(permission, legacyAction as PermissionMatrixAction, permissionModule));
  }

  const financingFallbacks: Record<string, Record<string, string[]>> = {
    FINANCING: { startReview: ['approve'], reject: ['approve'], disburse: ['approve'], reopen: ['approve'] },
    FINANCING_APPLICATIONS: { addNote: ['edit'], addDocument: ['edit'] },
  };
  const financingLegacyActions = financingFallbacks[permissionModule]?.[action];
  if (financingLegacyActions) {
    if (typeof actionValue === 'boolean') return actionValue;
    if (typeof frontendValue === 'boolean') return frontendValue;
    if (permission.canManage === true || permission.manage === true) return true;
    return financingLegacyActions.some((legacyAction) => permissionValue(permission, legacyAction as PermissionMatrixAction, permissionModule));
  }

  const forceSalesFallbacks: Record<string, Record<string, string[]>> = {
    FORCE_SALES: {
      importProspects: ['create'], updateProspect: ['edit'], changeStage: ['edit'], registerVisit: ['edit'],
      discardProspect: ['edit'], assignProspect: ['edit'], attachEvidence: ['edit'], manageConsent: ['edit'],
      createRoute: ['create'], editRoute: ['edit'], assignRoute: ['edit'], changeRouteStatus: ['edit'],
      completeRouteStop: ['edit'], updatePresence: ['edit'], hidePresence: ['edit'], configureLocation: ['edit'],
    },
  };
  const forceSalesLegacyActions = forceSalesFallbacks[permissionModule]?.[action];
  if (forceSalesLegacyActions) {
    if (typeof actionValue === 'boolean') return actionValue;
    if (typeof frontendValue === 'boolean') return frontendValue;
    if (permission.canManage === true || permission.manage === true) return true;
    return forceSalesLegacyActions.some((legacyAction) => permissionValue(permission, legacyAction as PermissionMatrixAction, permissionModule));
  }

  const restaurantFallbacks: Record<string, Record<string, string[]>> = {
    RESTAURANT: { configureRestaurant: ['edit'] },
    RESTAURANT_SALON: {
      closeTable: ['edit'], changeTableStatus: ['edit'], shareQr: ['read'], rotateQr: ['approve'],
    },
    RESTAURANT_TABLES: {
      closeTable: ['edit'], changeTableStatus: ['edit'], shareQr: ['read'], rotateQr: ['approve'],
    },
    RESTAURANT_ORDERS: {
      addOrderItems: ['create'], confirmOrder: ['approve'], sendToKitchen: ['approve'],
      startPreparation: ['approve'], markOrderReady: ['approve'], serveOrder: ['approve'],
      cancelOrder: ['approve'], pay: ['approve'], editDeliveryDetails: ['approve'], queueDelivery: ['approve'],
      startDeliveryPreparation: ['approve'], markDeliveryReady: ['approve'], dispatchDelivery: ['approve'],
      markDelivered: ['approve'], cancelDelivery: ['approve'],
    },
    RESTAURANT_KITCHEN: {
      sendToKitchen: ['approve'], startPreparation: ['approve'], markKitchenReady: ['approve'],
      serveOrder: ['approve'], cancelKitchenTicket: ['approve'],
    },
  };
  const restaurantLegacyActions = restaurantFallbacks[permissionModule]?.[action];
  if (restaurantLegacyActions) {
    if (typeof actionValue === 'boolean') return actionValue;
    if (typeof frontendValue === 'boolean') return frontendValue;
    if (permission.canManage === true || permission.manage === true) return true;
    return restaurantLegacyActions.some((legacyAction) => permissionValue(permission, legacyAction as PermissionMatrixAction, permissionModule));
  }

  const hotelFallbacks: Record<string, Record<string, string[]>> = {
    HOTEL_ROOMS: {
      createRoomType: ['create'], editRoomType: ['edit'], changeRoomTypeAvailability: ['edit'],
      createRoom: ['create'], editRoom: ['edit'], changeRoomAvailability: ['edit'],
    },
    HOTEL_RESERVATIONS: {
      checkIn: ['approve'], checkOut: ['approve'], payAtCheckout: ['approve'],
      cancelReservation: ['approve'], markNoShow: ['approve'], issueGuestLink: ['edit'], revokeGuestLink: ['edit'],
    },
  };
  const hotelLegacyActions = hotelFallbacks[permissionModule]?.[action];
  if (hotelLegacyActions) {
    if (typeof actionValue === 'boolean') return actionValue;
    if (typeof frontendValue === 'boolean') return frontendValue;
    if (permission.canManage === true || permission.manage === true) return true;
    return hotelLegacyActions.some((legacyAction) => permissionValue(permission, legacyAction as PermissionMatrixAction, permissionModule));
  }

  if (permissionModule === 'PURCHASES_REQUESTS' && ['submit', 'approve', 'cancel', 'reject', 'convert'].includes(action)) {
    if (typeof actionValue === 'boolean') return actionValue;
    if (typeof frontendValue === 'boolean') return frontendValue;
    if (permission.canManage === true) return true;
    if (action === 'submit') {
      if (typeof permission.edit === 'boolean') return permission.edit;
      if (typeof permission.canEdit === 'boolean') return permission.canEdit;
      return permission.write === true || permission.canWrite === true;
    }
    if (typeof permission.approve === 'boolean') return permission.approve;
    if (typeof permission.canApprove === 'boolean') return permission.canApprove;
    return false;
  }

  // Los flujos de otros módulos conservan su resolución histórica hasta que
  // cada módulo tenga su propio contrato granular.
  if (action !== 'submit' && action !== 'pay') {
    if (typeof permission.approve === 'boolean') return permission.approve;
    return actionValue === true || frontendValue === true;
  }

  if (typeof actionValue === 'boolean') return actionValue;

  if (typeof frontendValue === 'boolean') return frontendValue;

  if (typeof permission.approve === 'boolean') return permission.approve;
  if (typeof permission.canApprove === 'boolean') return permission.canApprove;
  return actionValue === true || frontendValue === true;
}

/**
 * Devuelve el alcance de listas de precios del usuario. `null` representa el
 * comportamiento legado: todas las listas están disponibles. Un arreglo vacío
 * es deliberado y significa que el rol aún no tiene listas asignadas.
 */
export function getAllowedPriceListIds(user: any): string[] | null {
  const permission = (Array.isArray(user?.permissions) ? user.permissions : [])
    .find((candidate: any) => String(candidate?.module || '').trim().toUpperCase() === 'SALES_PRICE_LISTS');
  if (!permission || !Object.prototype.hasOwnProperty.call(permission, 'allowedPriceListIds')) return null;
  if (!Array.isArray(permission.allowedPriceListIds)) return [];
  const allowedIds = permission.allowedPriceListIds.reduce((ids: string[], id: unknown) => {
    const normalizedId = String(id || '').trim();
    if (normalizedId) ids.push(normalizedId);
    return ids;
  }, []);
  return [...new Set<string>(allowedIds)];
}

export function filterAllowedPriceLists<T extends { id: string }>(lists: T[], user: any): T[] {
  const allowedIds = getAllowedPriceListIds(user);
  return allowedIds === null ? lists : lists.filter((list) => allowedIds.includes(list.id));
}

/**
 * El alcance del rol debe salir de las filas con permiso de lectura. Mantener
 * este cálculo en un único lugar evita que una pantalla guarde switches
 * activos sin actualizar `allowedModules`.
 */
export function allowedModulesFromPermissions(input: any): string[] {
  const permissions = Array.isArray(input)
    ? input
    : input && typeof input === 'object'
      ? Object.entries(input).map(([module, value]: [string, any]) => ({
          module,
          ...(value && typeof value === 'object' ? value : {}),
        }))
      : [];

  return [...new Set(permissions
    .map((permission: any) => ({
      module: String(permission?.module || permission?.id || '').trim().toUpperCase(),
      permission,
    }))
    .filter(({ module, permission }: { module: string; permission: any }) => module && permissionValue(permission, 'read'))
    .map(({ module }: { module: string }) => module))];
}

export function hydratePermissionActions(permission: any, module: string): Record<string, any> & { module: string; viewCost: boolean; allowedPriceListIds?: any[] } {
  const visibleActions = PERMISSION_ACTION_DEFINITIONS.filter(({ key }) => {
    if (!GRANULAR_PERMISSION_ACTIONS.has(key as PermissionMatrixAction)) return true;
    const frontendKey = `can${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    return supportsPermissionAction(module, key as PermissionMatrixAction)
      || permission?.[key] !== undefined
      || permission?.[frontendKey] !== undefined;
  });
  return {
    module,
    ...Object.fromEntries(visibleActions.map(({ key }) => [key, permissionValue(permission, key, module)])),
    viewCost: permissionValue(permission, 'viewCost'),
    ...(Object.prototype.hasOwnProperty.call(permission || {}, 'allowedPriceListIds')
      ? { allowedPriceListIds: Array.isArray(permission.allowedPriceListIds) ? [...permission.allowedPriceListIds] : [] }
      : {}),
  };
}

/**
 * Serializa la matriz del editor con las claves canónicas que consume el API.
 * Esto evita que una edición vuelva a guardar únicamente `read` cuando el
 * rol venía de una versión histórica con claves `canCreate`/`canEdit` o
 * `write`.
 */
export function serializePermissionActions(input: any): any[] {
  const entries = Array.isArray(input)
    ? input
    : input && typeof input === 'object'
      ? Object.entries(input).map(([module, value]: [string, any]) => ({
          module,
          ...(value && typeof value === 'object' ? value : {}),
        }))
      : [];

  return entries
    .filter((permission: any) => permission && typeof permission === 'object' && permission.module)
    .map((permission: any) => {
      const module = String(permission.module).trim().toUpperCase();
      const serializableActions = PERMISSION_ACTION_DEFINITIONS.filter(({ key }) => {
        if (!GRANULAR_PERMISSION_ACTIONS.has(key as PermissionMatrixAction)) return true;
        const frontendKey = `can${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        return supportsPermissionAction(module, key as PermissionMatrixAction)
          || permission[key] !== undefined
          || permission[frontendKey] !== undefined;
      });
      return {
        module,
        ...Object.fromEntries(serializableActions.map(({ key }) => [key, permissionValue(permission, key)])),
        viewCost: permissionValue(permission, 'viewCost'),
        write: permissionValue(permission, 'create') || permissionValue(permission, 'edit') || permission.write === true,
        ...(Object.prototype.hasOwnProperty.call(permission, 'allowedPriceListIds')
          ? { allowedPriceListIds: Array.isArray(permission.allowedPriceListIds) ? [...permission.allowedPriceListIds] : [] }
          : {}),
      };
    });
}
