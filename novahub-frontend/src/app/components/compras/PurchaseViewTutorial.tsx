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

type PurchaseTutorial = { title: string; description: string; kpis: string; filters: string; actions: string; pagination: string; tip: string };

const TUTORIALS: Record<PurchaseTutorialView, PurchaseTutorial> = {
  requests: {
    title: 'Solicitudes de Compra',
    description: 'Registra necesidades de compra, consulta su flujo de aprobación y conviértelas en órdenes cuando estén listas.',
    kpis: 'Total y estados pendientes son indicadores y filtros del flujo. Haz clic en un KPI de estado para mostrar solo esas solicitudes y vuelve a pulsarlo para restablecer.',
    filters: 'Busca por número, solicitante, proveedor o bodega y usa el selector de estado. La paginación de la barra permite avanzar sin perder el criterio.',
    actions: 'Desde cada fila puedes consultar el detalle, avanzar el estado, aprobar la gestión o convertirla en una orden de compra.',
    pagination: 'Cuando el servicio entrega paginación, revisa el total mostrado y usa anterior/siguiente. Si no hay más páginas, los controles quedan deshabilitados.',
    tip: 'Completa la bodega, prioridad y artículos solicitados para que la solicitud pueda procesarse sin devoluciones.',
  },
  suppliers: {
    title: 'Proveedores',
    description: 'Administra el directorio de proveedores, sus datos de contacto, estado y saldo comercial.',
    kpis: 'Total, activos e inactivos son indicadores; los KPI de estado funcionan como filtros rápidos y muestran visualmente cuál está activo.',
    filters: 'Busca por nombre, código o contacto y combina el texto con el estado. Cambiar criterios vuelve a cargar la primera página.',
    actions: 'Desde cada fila puedes consultar el historial, editar datos permitidos o desactivar el proveedor.',
    pagination: 'Selecciona cuántos proveedores mostrar, consulta el rango del total y navega a primera, anterior, siguiente o última página.',
    tip: 'Usa la importación para cargar varios proveedores y revisa el resultado antes de continuar con nuevas operaciones.',
  },
  expenses: {
    title: 'Gastos',
    description: 'Registra y controla los egresos operativos y administrativos de la empresa.',
    kpis: 'Los KPI de pendientes y categorías son filtros: al pulsarlos la tabla se reduce a ese grupo. El total monetario y el conteo general son indicadores informativos.',
    filters: 'Busca por descripción, proveedor o categoría. Puedes combinar el texto con el KPI activo y revisar la etiqueta de filtro para limpiarlo.',
    actions: 'Usa los KPI para filtrar pendientes o categorías, busca por texto, descarga soportes y abre el detalle de cada gasto.',
    pagination: 'Cambia el tamaño de página, valida el rango de gastos visible y recorre las páginas para no confundir el total filtrado con el total general.',
    tip: 'Adjunta evidencia y selecciona la cuenta contable correcta para mantener la trazabilidad del gasto.',
  },
  'recurring-expenses': {
    title: 'Gastos Recurrentes',
    description: 'Configura compromisos fijos periódicos y controla cuáles están activos o pausados.',
    kpis: 'El conteo de activos es un filtro; los importes y próximas fechas son indicadores de planificación. Un KPI activo se identifica con el estado visual de la tarjeta.',
    filters: 'Busca por proveedor, concepto o frecuencia y separa activos de pausados. Los filtros se mantienen al navegar entre páginas.',
    actions: 'Desde cada fila puedes editar la periodicidad, consultar el detalle, revisar auditoría o eliminar el registro.',
    pagination: 'Usa 50, 100 o 200 filas por página y los controles de navegación para auditar todos los compromisos periódicos.',
    tip: 'Verifica la próxima fecha y la cuenta de pago antes de guardar un gasto recurrente.',
  },
  orders: {
    title: 'Órdenes de Compra',
    description: 'Gestiona los pedidos enviados a proveedores y controla su aprobación, recepción y facturación.',
    kpis: 'Los estados de la orden son filtros rápidos; el monto total y la cantidad de órdenes son indicadores. Al activar un KPI, las acciones se aplican solo a las filas visibles.',
    filters: 'Busca por número, proveedor o solicitante y usa fechas/estado. Restablece el filtro antes de revisar el universo completo.',
    actions: 'Usa los KPI para filtrar órdenes, convierte una orden en factura, consulta auditoría, descarga el PDF o anúlala.',
    pagination: 'Elige el tamaño de página y recorre primera/anterior/siguiente/última. El contador confirma cuántas órdenes estás revisando del total.',
    tip: 'Una orden aprobada conserva sus cantidades, precios e impuestos para facilitar la recepción y facturación posteriores.',
  },
  receipts: {
    title: 'Recepciones',
    description: 'Registra la entrada de mercancía y documenta faltantes, rechazos e incidencias.',
    kpis: 'Recibidas, pendientes e incidencias son filtros del control de recepción; los totales de unidades y montos son indicadores.',
    filters: 'Busca por recepción, proveedor, orden o bodega y combina el estado con el rango de fecha de entrada.',
    actions: 'Desde cada fila puedes editar la recepción, consultar auditoría, convertirla en factura o eliminarla cuando aún está pendiente.',
    pagination: 'Ajusta la cantidad por página y usa la navegación para revisar faltantes e incidencias de todas las recepciones.',
    tip: 'Selecciona la bodega de cada artículo recibido antes de marcar la recepción como procesada.',
  },
  invoices: {
    title: 'Facturas de Proveedor',
    description: 'Controla las cuentas por pagar, sus vencimientos, saldos y pagos asociados.',
    kpis: 'Pendientes, vencidas y pagadas son filtros rápidos. El saldo total y el monto pagado son indicadores para priorizar cuentas por pagar.',
    filters: 'Busca por factura, proveedor o número de orden y combina el estado con las fechas de vencimiento o emisión.',
    actions: 'Usa los KPI para filtrar pendientes, vencidas o pagadas; también puedes registrar un pago, descargar el PDF y consultar auditoría.',
    pagination: 'Selecciona 50/100/200 filas, consulta el rango y navega por todas las facturas para evitar omitir vencimientos.',
    tip: 'Registrar el pago desde la factura conserva la relación entre el documento, el proveedor y el desembolso.',
  },
  'recurring-invoices': {
    title: 'Facturas Recurrentes',
    description: 'Administra contratos y servicios que generan facturas de proveedor de forma periódica.',
    kpis: 'Activas y pausadas son filtros por estado; el monto recurrente y la próxima emisión funcionan como indicadores de planificación.',
    filters: 'Busca por proveedor, concepto o contrato y revisa la frecuencia antes de cambiar de página.',
    actions: 'Desde cada fila puedes editar la frecuencia, consultar el detalle, revisar auditoría o eliminar la configuración.',
    pagination: 'Define el tamaño de página y usa los controles de primera, anterior, siguiente y última para revisar todos los contratos.',
    tip: 'Revisa la próxima fecha de emisión y la moneda antes de guardar el contrato.',
  },
  payments: {
    title: 'Pagos Realizados',
    description: 'Consulta los desembolsos aplicados a proveedores y conserva su trazabilidad contable.',
    kpis: 'Monto desembolsado y cantidad de pagos son indicadores. Si existe un KPI de estado o método, úsalo como filtro y confirma la selección en la tabla.',
    filters: 'Busca por comprobante, proveedor o factura y usa el rango de fecha del pago. Al modificarlo se reinicia la paginación.',
    actions: 'Desde cada fila puedes descargar el comprobante, consultar auditoría, ver el detalle o anular el pago.',
    pagination: 'Cambia la cantidad de pagos por página y revisa el rango total antes de navegar para conciliar el desembolso completo.',
    tip: 'Relaciona cada pago con la factura correcta para actualizar el saldo pendiente del proveedor.',
  },
  credits: {
    title: 'Créditos de Proveedor',
    description: 'Registra y consulta notas de crédito y saldos a favor emitidos por proveedores.',
    kpis: 'Créditos emitidos, aplicados y pendientes son indicadores; los estados disponibles se comportan como filtros rápidos cuando tienen interacción.',
    filters: 'Busca por número, proveedor o documento de origen y filtra por estado o fecha para encontrar el crédito exacto.',
    actions: 'Desde cada fila puedes consultar el detalle, revisar auditoría o eliminar una nota según tus permisos.',
    pagination: 'Selecciona el tamaño de página y usa el contador junto con primera/anterior/siguiente/última para revisar todos los saldos a favor.',
    tip: 'Relaciona el crédito con el documento de origen y verifica el monto antes de aplicarlo.',
  },
};

export function PurchaseViewTutorial({ view, className = '' }: { view: PurchaseTutorialView; className?: string }) {
  const [open, setOpen] = useState(false);
  const tutorial = TUTORIALS[view];
  const steps: GuidedTourStep[] = [
    {
      target: '[data-tour="purchases-list-title"]',
      title: tutorial.title,
      description: tutorial.description,
      placement: 'bottom',
    },
    {
      target: '[data-tour="purchases-list-kpis"]',
      title: 'KPIs: indicadores y filtros',
      description: tutorial.kpis,
      placement: 'bottom',
    },
    {
      target: '[data-tour="purchases-list-actions"]',
      title: 'Búsqueda, filtros y acciones',
      description: tutorial.filters,
      placement: 'bottom',
    },
    {
      target: '[data-tour="sales-data-table"]',
      title: 'Tabla y acciones',
      description: tutorial.actions,
      tip: tutorial.tip,
      placement: 'top',
    },
    {
      target: '[data-tour="purchases-list-pagination"]',
      title: 'Paginación y cantidad de registros',
      description: tutorial.pagination,
      placement: 'top',
    },
  ];

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className={`h-10 min-w-0 rounded-xl border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest ${className}`}
      >
        <CircleHelp className="mr-2 size-4" /> Tutorial
      </Button>
      {open && <GuidedTour steps={steps} onClose={() => setOpen(false)} title={tutorial.title} allowTargetInteraction />}
    </>
  );
}
