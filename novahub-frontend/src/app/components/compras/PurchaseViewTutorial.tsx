import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { Button } from '../ui/button';
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';

export type PurchaseTutorialView =
  | 'requests'
  | 'suppliers'
  | 'expenses'
  | 'recurring-expenses'
  | 'orders'
  | 'receipts'
  | 'invoices'
  | 'recurring-invoices'
  | 'payments'
  | 'credits';

export type PurchaseTutorialContext = 'list' | 'form';
type FormStepKey = 'title' | 'data' | 'items' | 'summary' | 'actions';

type PurchaseTutorial = {
  title: string;
  listLabel: string;
  description: string;
  kpis: string;
  filters: string;
  actions: string;
  pagination: string;
  tip: string;
  form: {
    label: string;
    description: string;
    data: string;
    items?: string;
    summary: string;
    actions: string;
    tip: string;
    steps: FormStepKey[];
  };
};

const TUTORIALS: Record<PurchaseTutorialView, PurchaseTutorial> = {
  requests: {
    title: 'Solicitudes de Compra', listLabel: 'Cómo gestionar solicitudes',
    description: 'Registra necesidades de compra, consulta su flujo de aprobación y conviértelas en órdenes cuando estén listas.',
    kpis: 'Total y estados pendientes son indicadores y filtros del flujo. Haz clic en un KPI de estado para mostrar solo esas solicitudes y vuelve a pulsarlo para restablecer.',
    filters: 'Busca por número, solicitante, proveedor o bodega y usa el selector de estado. La paginación de la barra permite avanzar sin perder el criterio.',
    actions: 'Desde cada fila puedes consultar el detalle, avanzar el estado, aprobar la gestión o convertirla en una orden de compra.',
    pagination: 'Cuando el servicio entrega paginación, revisa el total mostrado y usa anterior/siguiente. Si no hay más páginas, los controles quedan deshabilitados.',
    tip: 'Completa la bodega, prioridad y artículos solicitados para que la solicitud pueda procesarse sin devoluciones.',
    form: { label: 'Cómo revisar solicitud', description: 'Consulta el detalle y el avance de una solicitud antes de convertirla en una orden de compra.', data: 'Revisa solicitante, prioridad, bodega, fecha requerida y observaciones.', summary: 'Valida artículos, cantidades y estado de aprobación antes de avanzar el flujo.', actions: 'Usa las acciones disponibles para aprobar, rechazar o convertir la solicitud en una orden.', tip: 'Una solicitud completa reduce aclaraciones al momento de comprar.', steps: ['title', 'data', 'summary', 'actions'] },
  },
  suppliers: {
    title: 'Proveedores', listLabel: 'Cómo gestionar proveedores',
    description: 'Administra el directorio de proveedores, sus datos de contacto, estado y saldo comercial.',
    kpis: 'Total, activos e inactivos son indicadores; los KPI de estado funcionan como filtros rápidos y muestran visualmente cuál está activo.',
    filters: 'Busca por nombre, código o contacto y combina el texto con el estado. Cambiar criterios vuelve a cargar la primera página.',
    actions: 'Desde cada fila puedes consultar el historial, editar datos permitidos o desactivar el proveedor.',
    pagination: 'Selecciona cuántos proveedores mostrar, consulta el rango del total y navega a primera, anterior, siguiente o última página.',
    tip: 'Usa la importación para cargar varios proveedores y revisa el resultado antes de continuar con nuevas operaciones.',
    form: { label: 'Cómo crear proveedor', description: 'Registra un proveedor con sus datos fiscales, contacto y condiciones comerciales.', data: 'Completa nombre, identificación, contacto y dirección del proveedor.', summary: 'Revisa estado, condiciones de pago y datos bancarios antes de guardar.', actions: 'Guarda el proveedor y verifica que aparezca activo en el directorio.', tip: 'Mantén un proveedor por razón social para conservar la trazabilidad de sus facturas y pagos.', steps: ['title', 'data', 'summary', 'actions'] },
  },
  expenses: {
    title: 'Gastos', listLabel: 'Cómo registrar gastos',
    description: 'Registra y controla los egresos operativos y administrativos de la empresa.',
    kpis: 'Los KPI de pendientes y categorías son filtros: al pulsarlos la tabla se reduce a ese grupo. El total monetario y el conteo general son indicadores informativos.',
    filters: 'Busca por descripción, proveedor o categoría. Puedes combinar el texto con el KPI activo y revisar la etiqueta de filtro para limpiarlo.',
    actions: 'Usa los KPI para filtrar pendientes o categorías, busca por texto, descarga soportes y abre el detalle de cada gasto.',
    pagination: 'Cambia el tamaño de página, valida el rango de gastos visible y recorre las páginas para no confundir el total filtrado con el total general.',
    tip: 'Adjunta evidencia y selecciona la cuenta contable correcta para mantener la trazabilidad del gasto.',
    form: { label: 'Cómo registrar gasto', description: 'Registra un egreso con concepto, proveedor, fecha, cuenta de origen y soporte.', data: 'Captura descripción, categoría, fecha, proveedor, beneficiario y referencia.', summary: 'Confirma moneda, monto total, cuenta de origen y evidencia adjunta.', actions: 'Guarda el gasto cuando la información esté completa para que quede disponible en el control de egresos.', tip: 'Adjuntar el comprobante facilita la revisión y conciliación posterior.', steps: ['title', 'data', 'summary', 'actions'] },
  },
  'recurring-expenses': {
    title: 'Gastos Recurrentes', listLabel: 'Cómo programar gastos recurrentes',
    description: 'Configura compromisos fijos periódicos y controla cuáles están activos o pausados.',
    kpis: 'El conteo de activos es un filtro; los importes y próximas fechas son indicadores de planificación. Un KPI activo se identifica con el estado visual de la tarjeta.',
    filters: 'Busca por proveedor, concepto o frecuencia y separa activos de pausados. Los filtros se mantienen al navegar entre páginas.',
    actions: 'Desde cada fila puedes editar la periodicidad, consultar el detalle, revisar auditoría o eliminar el registro.',
    pagination: 'Usa 50, 100 o 200 filas por página y los controles de navegación para auditar todos los compromisos periódicos.',
    tip: 'Verifica la próxima fecha y la cuenta de pago antes de guardar un gasto recurrente.',
    form: { label: 'Cómo programar gastos recurrentes', description: 'Configura un compromiso periódico para registrar sus próximos egresos de forma ordenada.', data: 'Define proveedor, concepto, frecuencia, fechas, moneda y cuenta de pago.', summary: 'Revisa importe, impuestos, próxima emisión y estado activo antes de guardar.', actions: 'Guarda la configuración y utiliza el listado para pausarla o reanudarla.', tip: 'La próxima fecha debe coincidir con el calendario real del proveedor.', steps: ['title', 'data', 'summary', 'actions'] },
  },
  orders: {
    title: 'Órdenes de Compra', listLabel: 'Cómo crear orden de compra',
    description: 'Gestiona los pedidos enviados a proveedores y controla su aprobación, recepción y facturación.',
    kpis: 'Los estados de la orden son filtros rápidos; el monto total y la cantidad de órdenes son indicadores. Al activar un KPI, las acciones se aplican solo a las filas visibles.',
    filters: 'Busca por número, proveedor o solicitante y usa fechas/estado. Restablece el filtro antes de revisar el universo completo.',
    actions: 'Usa los KPI para filtrar órdenes, convierte una orden en factura, consulta auditoría, descarga el PDF o anúlala.',
    pagination: 'Elige el tamaño de página y recorre primera/anterior/siguiente/última. El contador confirma cuántas órdenes estás revisando del total.',
    tip: 'Una orden aprobada conserva sus cantidades, precios e impuestos para facilitar la recepción y facturación posteriores.',
    form: { label: 'Cómo crear orden de compra', description: 'Prepara un pedido para un proveedor con fechas, bodega y detalle de productos o servicios.', data: 'Selecciona proveedor, solicitante, fechas, bodega, moneda y condiciones de la orden.', items: 'Agrega productos o servicios y valida cantidades, precios, impuestos y descuentos por línea.', summary: 'Revisa subtotal, impuestos, retenciones y total antes de guardar o aprobar.', actions: 'Guarda el borrador para revisarlo o aprueba la orden cuando esté lista para recepción.', tip: 'Una orden aprobada conserva el detalle necesario para recibir la mercancía sin recapturarla.', steps: ['title', 'data', 'items', 'summary', 'actions'] },
  },
  receipts: {
    title: 'Recepciones', listLabel: 'Cómo registrar recepción',
    description: 'Registra la entrada de mercancía y documenta faltantes, rechazos e incidencias.',
    kpis: 'Recibidas, pendientes e incidencias son filtros del control de recepción; los totales de unidades y montos son indicadores.',
    filters: 'Busca por recepción, proveedor, orden o bodega y combina el estado con el rango de fecha de entrada.',
    actions: 'Desde cada fila puedes editar la recepción, consultar auditoría, convertirla en factura o eliminarla cuando aún está pendiente.',
    pagination: 'Ajusta la cantidad por página y usa la navegación para revisar faltantes e incidencias de todas las recepciones.',
    tip: 'Selecciona la bodega de cada artículo recibido antes de marcar la recepción como procesada.',
    form: { label: 'Cómo registrar recepción', description: 'Registra lo que realmente ingresó a la bodega y deja evidencia de diferencias frente a la orden.', data: 'Selecciona orden, proveedor, fecha y bodega de recepción.', items: 'Captura cantidades recibidas, rechazadas, faltantes, lotes, series y ubicación por artículo.', summary: 'Revisa incidencias, documentos y estado antes de confirmar la recepción.', actions: 'Guarda la recepción o márcala como recibida cuando la mercancía haya sido verificada.', tip: 'La cantidad recibida debe reflejar físicamente lo que entró a inventario.', steps: ['title', 'data', 'items', 'summary', 'actions'] },
  },
  invoices: {
    title: 'Facturas de Proveedor', listLabel: 'Cómo registrar factura de proveedor',
    description: 'Controla las cuentas por pagar, sus vencimientos, saldos y pagos asociados.',
    kpis: 'Pendientes, vencidas y pagadas son filtros rápidos. El saldo total y el monto pagado son indicadores para priorizar cuentas por pagar.',
    filters: 'Busca por factura, proveedor o número de orden y combina el estado con las fechas de vencimiento o emisión.',
    actions: 'Usa los KPI para filtrar pendientes, vencidas o pagadas; también puedes registrar un pago, descargar el PDF y consultar auditoría.',
    pagination: 'Selecciona 50/100/200 filas, consulta el rango y navega por todas las facturas para evitar omitir vencimientos.',
    tip: 'Registrar el pago desde la factura conserva la relación entre el documento, el proveedor y el desembolso.',
    form: { label: 'Cómo registrar factura de proveedor', description: 'Registra una factura recibida y relaciona sus importes con el proveedor y la orden correspondiente.', data: 'Completa proveedor, número, fechas, orden de compra, moneda y condiciones de pago.', items: 'Agrega los productos o servicios facturados y revisa cantidades, precios, impuestos y descuentos.', summary: 'Confirma total, vencimiento, cuenta por pagar y comprobantes adjuntos.', actions: 'Guarda la factura y registra el pago desde el documento cuando corresponda.', tip: 'Relacionar la factura con su orden evita diferencias entre lo pedido, recibido y facturado.', steps: ['title', 'data', 'items', 'summary', 'actions'] },
  },
  'recurring-invoices': {
    title: 'Facturas Recurrentes', listLabel: 'Cómo programar facturas de proveedor',
    description: 'Administra contratos y servicios que generan facturas de proveedor de forma periódica.',
    kpis: 'Activas y pausadas son filtros por estado; el monto recurrente y la próxima emisión funcionan como indicadores de planificación.',
    filters: 'Busca por proveedor, concepto o contrato y revisa la frecuencia antes de cambiar de página.',
    actions: 'Desde cada fila puedes editar la frecuencia, consultar el detalle, revisar auditoría o eliminar la configuración.',
    pagination: 'Define el tamaño de página y usa los controles de primera, anterior, siguiente y última para revisar todos los contratos.',
    tip: 'Revisa la próxima fecha de emisión y la moneda antes de guardar el contrato.',
    form: { label: 'Cómo programar facturas de proveedor', description: 'Configura un contrato periódico para controlar las próximas facturas que recibirás.', data: 'Define proveedor, concepto, frecuencia, fechas, moneda y referencia del contrato.', items: 'Agrega los productos o servicios incluidos en cada factura recurrente.', summary: 'Revisa importe, impuestos, vencimiento y próxima emisión.', actions: 'Guarda la programación y confirma que quede activa en el listado.', tip: 'Mantén actualizada la próxima emisión para que el control de cuentas por pagar sea confiable.', steps: ['title', 'data', 'items', 'summary', 'actions'] },
  },
  payments: {
    title: 'Pagos Realizados', listLabel: 'Cómo registrar pagos',
    description: 'Consulta los desembolsos aplicados a proveedores y conserva su trazabilidad contable.',
    kpis: 'Monto desembolsado y cantidad de pagos son indicadores. Si existe un KPI de estado o método, úsalo como filtro y confirma la selección en la tabla.',
    filters: 'Busca por comprobante, proveedor o factura y usa el rango de fecha del pago. Al modificarlo se reinicia la paginación.',
    actions: 'Desde cada fila puedes descargar el comprobante, consultar auditoría, ver el detalle o anular el pago.',
    pagination: 'Cambia la cantidad de pagos por página y revisa el rango total antes de navegar para conciliar el desembolso completo.',
    tip: 'Relaciona cada pago con la factura correcta para actualizar el saldo pendiente del proveedor.',
    form: { label: 'Cómo registrar pagos', description: 'Registra un desembolso y aplícalo a la factura correcta del proveedor.', data: 'Selecciona proveedor, factura, fecha, método, cuenta de salida y referencia.', summary: 'Confirma monto, moneda y observaciones antes de guardar.', actions: 'Verifica los datos y confirma el pago una sola vez para evitar duplicidades.', tip: 'Un pago relacionado actualiza el saldo de la factura y deja la trazabilidad contable.', steps: ['title', 'data', 'summary', 'actions'] },
  },
  credits: {
    title: 'Créditos de Proveedor', listLabel: 'Cómo registrar crédito de proveedor',
    description: 'Registra y consulta notas de crédito y saldos a favor emitidos por proveedores.',
    kpis: 'Créditos emitidos, aplicados y pendientes son indicadores; los estados disponibles se comportan como filtros rápidos cuando tienen interacción.',
    filters: 'Busca por número, proveedor o documento de origen y filtra por estado o fecha para encontrar el crédito exacto.',
    actions: 'Desde cada fila puedes consultar el detalle, revisar auditoría o eliminar una nota según tus permisos.',
    pagination: 'Selecciona el tamaño de página y usa el contador junto con primera/anterior/siguiente/última para revisar todos los saldos a favor.',
    tip: 'Relaciona el crédito con el documento de origen y verifica el monto antes de aplicarlo.',
    form: { label: 'Cómo registrar crédito de proveedor', description: 'Registra una nota de crédito otorgada por el proveedor y controla su saldo a favor.', data: 'Selecciona proveedor, documento de origen, fechas, moneda y motivo.', items: 'Agrega productos o servicios relacionados con la devolución o bonificación.', summary: 'Revisa impuestos, descuentos, interés y total antes de guardar o emitir.', actions: 'Guarda el crédito y aplícalo cuando el proveedor haya confirmado el saldo.', tip: 'Aplicar un crédito liquida el saldo a favor contra una cuenta por pagar.', steps: ['title', 'data', 'items', 'summary', 'actions'] },
  },
};

export function PurchaseViewTutorial({ view, context = 'list', className = '', labelOverride, stepKeys, targetPrefix = 'purchases-form' }: { view: PurchaseTutorialView; context?: PurchaseTutorialContext; className?: string; labelOverride?: string; stepKeys?: FormStepKey[]; targetPrefix?: string }) {
  const [open, setOpen] = useState(false);
  const tutorial = TUTORIALS[view];
  const formLabel = labelOverride || tutorial.form.label;
  const formTargetLabels: Record<FormStepKey, GuidedTourStep> = {
    title: { target: `[data-tour="${targetPrefix}-title"]`, title: formLabel, description: tutorial.form.description, placement: 'bottom' },
    data: { target: `[data-tour="${targetPrefix}-data"]`, title: 'Datos principales', description: tutorial.form.data, placement: 'bottom' },
    items: { target: `[data-tour="${targetPrefix}-items"]`, title: 'Detalle de productos y servicios', description: tutorial.form.items || tutorial.form.summary, placement: 'top' },
    summary: { target: `[data-tour="${targetPrefix}-summary"]`, title: 'Revisión antes de guardar', description: tutorial.form.summary, placement: 'left' },
    actions: { target: `[data-tour="${targetPrefix}-actions"]`, title: 'Guardar o confirmar', description: tutorial.form.actions, tip: tutorial.form.tip, placement: 'bottom' },
  };
  const steps: GuidedTourStep[] = context === 'form'
    ? (stepKeys || tutorial.form.steps).map((key) => formTargetLabels[key])
    : [
        { target: '[data-tour="purchases-list-title"]', title: tutorial.title, description: tutorial.description, placement: 'bottom' },
        { target: '[data-tour="purchases-list-kpis"]', title: 'KPIs: indicadores y filtros', description: tutorial.kpis, placement: 'bottom' },
        { target: '[data-tour="purchases-list-actions"]', title: 'Búsqueda, filtros y acciones', description: tutorial.filters, placement: 'bottom' },
        { target: '[data-tour="sales-data-table"]', title: 'Tabla y acciones', description: tutorial.actions, tip: tutorial.tip, placement: 'top' },
        { target: '[data-tour="purchases-list-pagination"]', title: 'Paginación y cantidad de registros', description: tutorial.pagination, placement: 'top' },
      ];
  const buttonLabel = context === 'form' ? formLabel : tutorial.listLabel;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        data-toolbar-role="help"
        className={`h-10 min-w-0 rounded-xl border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest ${className}`}
        aria-label={buttonLabel}
      >
        <CircleHelp className="mr-2 size-4" /> {buttonLabel}
      </Button>
      {open && <GuidedTour steps={steps} onClose={() => setOpen(false)} title={context === 'form' ? formLabel : tutorial.title} allowTargetInteraction />}
    </>
  );
}
