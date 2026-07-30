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

const TUTORIALS: Record<SalesTutorialView, { title: string; description: string; actions: string; tip: string }> = {
  quotes: { title: 'Cotizaciones', description: 'Crea propuestas comerciales, consulta su estado y envíalas a una orden de venta cuando estén aprobadas.', actions: 'Desde cada fila puedes aprobar y enviar a Orden de Venta, descargar el PDF, ver el detalle o cancelar la cotización.', tip: 'Usa Guardar borrador para continuar después o Enviar cotización para iniciar el flujo comercial.' },
  orders: { title: 'Órdenes de Venta', description: 'Gestiona las órdenes confirmadas, revisa sus datos y envíalas a facturación cuando estén listas.', actions: 'Desde cada fila puedes aprobar y enviar a Factura, ver el detalle, exportar el PDF o cancelar la orden.', tip: 'Las órdenes conservan los precios, impuestos, descuentos y cargos configurados en el documento de origen.' },
  invoices: { title: 'Facturas', description: 'Consulta las facturas, emítelas y controla sus acciones de pago, descarga y cancelación.', actions: 'Desde cada fila puedes descargar el PDF, consultar el historial, marcar como pagada, ver el detalle o cancelar la factura.', tip: 'Marcar una factura como pagada registra el ingreso correspondiente en finanzas y contabilidad.' },
  recurring: { title: 'Facturas Recurrentes', description: 'Administra los contratos y servicios que generan facturación periódica para tus clientes.', actions: 'Desde cada fila puedes pausar o reanudar, descargar el PDF, ver el detalle o eliminar la factura recurrente.', tip: 'Revisa la configuración de periodicidad y los conceptos antes de guardar el documento.' },
  payments: { title: 'Pagos Recibidos', description: 'Registra y consulta los pagos aplicados a facturas para mantener actualizado el saldo de tus clientes.', actions: 'Desde cada fila puedes descargar el PDF, ver el detalle o anular el pago recibido.', tip: 'Relaciona cada pago con la factura correcta para conservar la trazabilidad contable.' },
  returns: { title: 'Devoluciones de Venta', description: 'Registra devoluciones, revisa sus productos o servicios y consulta el estado de cada operación.', actions: 'Desde cada fila puedes aprobar la devolución, descargar el PDF, ver el detalle o eliminarla.', tip: 'Verifica cantidades y motivos antes de confirmar la devolución.' },
  'credit-notes': { title: 'Notas de Crédito', description: 'Crea y consulta notas de crédito emitidas para corregir o ajustar operaciones de venta.', actions: 'Desde cada fila puedes emitir la nota, descargar el PDF, ver el detalle o eliminarla.', tip: 'Relaciona la nota con la factura correspondiente para mantener el historial completo.' },
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
      target: '[data-tour="sales-list-actions"]',
      title: 'Buscar y filtrar',
      description: 'Usa el buscador y el rango Desde/Hasta para encontrar rápidamente los registros que necesitas.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="sales-data-table"]',
      title: 'Tabla y acciones',
      description: `${tutorial.actions} También puedes desplazarte horizontalmente por la tabla cuando haya más columnas y usar sus controles de teclado.`,
      tip: tutorial.tip,
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
