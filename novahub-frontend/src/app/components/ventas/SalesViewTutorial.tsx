import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { Button } from '../ui/button';
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';

export type SalesTutorialView =
  | 'quotes'
  | 'orders'
  | 'invoices'
  | 'recurring'
  | 'payments'
  | 'returns'
  | 'credit-notes';

type SalesTutorial = { title: string; description: string; kpis: string; filters: string; actions: string; pagination: string; tip: string };

const TUTORIALS: Record<SalesTutorialView, SalesTutorial> = {
  quotes: { title: 'Cotizaciones', description: 'Crea propuestas comerciales, consulta su estado y envíalas a una orden de venta cuando estén aprobadas.', kpis: 'El total cotizado es un indicador monetario. Las tarjetas de Enviadas y Aprobadas son filtros: haz clic para ver solo ese estado y vuelve a hacer clic para quitarlo.', filters: 'Busca por número, cliente o estado y usa Desde/Hasta para acotar la fecha de emisión. Al cambiar un filtro la página vuelve al inicio.', actions: 'Desde cada fila puedes aprobar y enviar a Orden de Venta, descargar el PDF, ver el detalle o cancelar la cotización.', pagination: 'Selecciona 50, 100 o 200 registros por página. Revisa el rango mostrado y usa primera, anterior, siguiente o última página.', tip: 'Usa Guardar borrador para continuar después o Enviar cotización para iniciar el flujo comercial.' },
  orders: { title: 'Órdenes de Venta', description: 'Gestiona las órdenes confirmadas, revisa sus datos y envíalas a facturación cuando estén listas.', kpis: 'Órdenes Abiertas y En Proceso son filtros por estado. Monto Confirmado y Total del Mes son indicadores informativos; no cambian la lista al hacer clic.', filters: 'Busca por orden, cliente o referencia y filtra por fechas. Confirma el estado activo en la tarjeta KPI antes de ejecutar una acción.', actions: 'Desde cada fila puedes aprobar y enviar a Factura, ver el detalle, exportar el PDF o cancelar la orden. Los documentos conservan sus líneas para abrirlos en detalle.', pagination: 'Elige el tamaño de página y navega con los cuatro controles. El contador indica exactamente qué registros estás viendo del total.', tip: 'Las órdenes conservan los precios, impuestos, descuentos y cargos configurados en el documento de origen.' },
  invoices: { title: 'Facturas', description: 'Consulta las facturas, emítelas y controla sus acciones de pago, descarga y cancelación.', kpis: 'Facturado Total, Por Cobrar y Cobrado son indicadores en la moneda elegida. Por Cobrar y Vencidas funcionan como filtros para priorizar la gestión.', filters: 'Busca por número, cliente o referencia y usa el rango de emisión. El filtro de estado se combina con la búsqueda y reinicia la página.', actions: 'Desde cada fila puedes descargar el PDF, consultar el historial, marcar como pagada, ver el detalle o cancelar la factura.', pagination: 'Cambia 50/100/200 filas por página, consulta el rango y usa primera/anterior/siguiente/última. La paginación conserva la búsqueda y las fechas activas.', tip: 'Marcar una factura como pagada registra el ingreso correspondiente en finanzas y contabilidad.' },
  recurring: { title: 'Facturas Recurrentes', description: 'Administra los contratos y servicios que generan facturación periódica para tus clientes.', kpis: 'MRR y ARR son indicadores de ingreso recurrente. Activas es un filtro; Próximas 7 días te ayuda a planificar emisiones sin modificar la lista.', filters: 'Busca por cliente, concepto o contrato y revisa las fechas configuradas. Usa el filtro Activas para separar contratos vigentes de pausados.', actions: 'Desde cada fila puedes pausar o reanudar, descargar el PDF, ver el detalle o eliminar la factura recurrente.', pagination: 'Usa el selector de cantidad para definir cuántos contratos se muestran y los controles para avanzar sin perder el filtro actual.', tip: 'Revisa la configuración de periodicidad y los conceptos antes de guardar el documento.' },
  payments: { title: 'Pagos Recibidos', description: 'Registra y consulta los pagos aplicados a facturas para mantener actualizado el saldo de tus clientes.', kpis: 'Total Recaudado y Método Principal son indicadores. Con Factura es un filtro para encontrar pagos que ya tienen documento relacionado.', filters: 'Busca por cliente, recibo o factura y aplica el rango de fecha. Usa Con Factura para auditar la trazabilidad del ingreso.', actions: 'Desde cada fila puedes descargar el PDF, ver el detalle o anular el pago recibido. Revisa primero la factura vinculada y el método.', pagination: 'Ajusta el número de pagos por página, valida el rango mostrado y usa los botones de navegación para revisar todo el historial.', tip: 'Relaciona cada pago con la factura correcta para conservar la trazabilidad contable.' },
  returns: { title: 'Devoluciones de Venta', description: 'Registra devoluciones, revisa sus productos o servicios y consulta el estado de cada operación.', kpis: 'Total Devuelto es un indicador. Pendientes, Aprobadas y Rechazadas son filtros que permiten separar el flujo de revisión.', filters: 'Busca por devolución, cliente o documento de origen y filtra por fecha. Verifica el estado activo antes de aprobar o eliminar.', actions: 'Desde cada fila puedes aprobar la devolución, descargar el PDF, ver el detalle o eliminarla. El detalle muestra motivos, cantidades y líneas.', pagination: 'El selector define cuántas devoluciones cargar; el rango y las flechas permiten auditar la lista completa por páginas.', tip: 'Verifica cantidades y motivos antes de confirmar la devolución.' },
  'credit-notes': { title: 'Notas de Crédito', description: 'Crea y consulta notas de crédito emitidas para corregir o ajustar operaciones de venta.', kpis: 'Total Emitido y Crédito Vivo son indicadores monetarios. Borradores y Emitidas son filtros por estado.', filters: 'Busca por número, cliente o factura relacionada y acota por fecha. Combina el estado con la búsqueda para localizar el ajuste.', actions: 'Desde cada fila puedes emitir la nota, descargar el PDF, ver el detalle o eliminarla. Antes de emitir, revisa factura, motivo, monto e impuestos.', pagination: 'Selecciona el tamaño de página y usa primera/anterior/siguiente/última para revisar el historial sin perder los criterios de búsqueda.', tip: 'Relaciona la nota con la factura correspondiente para mantener el historial completo.' },
};

export function SalesViewTutorial({ view }: { view: SalesTutorialView }) {
  const [open, setOpen] = useState(false);
  const tutorial = TUTORIALS[view];
  const steps: GuidedTourStep[] = [
    {
      target: '[data-tour="sales-list-title"]',
      title: tutorial.title,
      description: tutorial.description,
      placement: 'bottom',
    },
    {
      target: '[data-tour="sales-list-kpis"]',
      title: 'KPIs: indicadores y filtros',
      description: tutorial.kpis,
      placement: 'bottom',
    },
    {
      target: '[data-tour="sales-list-actions"]',
      title: 'Búsqueda, fechas y acciones',
      description: tutorial.filters,
      placement: 'bottom',
    },
    {
      target: '[data-tour="sales-data-table"]',
      title: 'Tabla y acciones',
      description: `${tutorial.actions} También puedes usar los controles de teclado de la tabla para recorrer sus celdas.`,
      tip: tutorial.tip,
      placement: 'top',
    },
    {
      target: '[data-tour="sales-list-pagination"]',
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
        className="h-10 rounded-xl border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest"
      >
        <CircleHelp className="mr-2 size-4" /> Tutorial
      </Button>
      {open && <GuidedTour steps={steps} onClose={() => setOpen(false)} title={tutorial.title} allowTargetInteraction />}
    </>
  );
}
