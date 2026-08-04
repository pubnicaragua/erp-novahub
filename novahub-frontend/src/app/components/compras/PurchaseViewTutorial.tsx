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

const TUTORIALS: Record<PurchaseTutorialView, { title: string; description: string; actions: string; tip: string }> = {
  requests: {
    title: 'Solicitudes de Compra',
    description: 'Registra necesidades de compra, consulta su flujo de aprobación y conviértelas en órdenes cuando estén listas.',
    actions: 'Desde cada fila puedes consultar el detalle, avanzar el estado, aprobar la gestión o convertirla en una orden de compra.',
    tip: 'Completa la bodega, prioridad y artículos solicitados para que la solicitud pueda procesarse sin devoluciones.',
  },
  suppliers: {
    title: 'Proveedores',
    description: 'Administra el directorio de proveedores, sus datos de contacto, estado y saldo comercial.',
    actions: 'Desde cada fila puedes consultar el historial, editar datos permitidos o desactivar el proveedor.',
    tip: 'Usa la importación para cargar varios proveedores y revisa el resultado antes de continuar con nuevas operaciones.',
  },
  expenses: {
    title: 'Gastos',
    description: 'Registra y controla los egresos operativos y administrativos de la empresa.',
    actions: 'Usa los KPI para filtrar pendientes o categorías, busca por texto, descarga soportes y abre el detalle de cada gasto.',
    tip: 'Adjunta evidencia y selecciona la cuenta contable correcta para mantener la trazabilidad del gasto.',
  },
  'recurring-expenses': {
    title: 'Gastos Recurrentes',
    description: 'Configura compromisos fijos periódicos y controla cuáles están activos o pausados.',
    actions: 'Desde cada fila puedes editar la periodicidad, consultar el detalle, revisar auditoría o eliminar el registro.',
    tip: 'Verifica la próxima fecha y la cuenta de pago antes de guardar un gasto recurrente.',
  },
  orders: {
    title: 'Órdenes de Compra',
    description: 'Gestiona los pedidos enviados a proveedores y controla su aprobación, recepción y facturación.',
    actions: 'Usa los KPI para filtrar órdenes, convierte una orden en factura, consulta auditoría, descarga el PDF o anúlala.',
    tip: 'Una orden aprobada conserva sus cantidades, precios e impuestos para facilitar la recepción y facturación posteriores.',
  },
  receipts: {
    title: 'Recepciones',
    description: 'Registra la entrada de mercancía y documenta faltantes, rechazos e incidencias.',
    actions: 'Desde cada fila puedes editar la recepción, consultar auditoría, convertirla en factura o eliminarla cuando aún está pendiente.',
    tip: 'Selecciona la bodega de cada artículo recibido antes de marcar la recepción como procesada.',
  },
  invoices: {
    title: 'Facturas de Proveedor',
    description: 'Controla las cuentas por pagar, sus vencimientos, saldos y pagos asociados.',
    actions: 'Usa los KPI para filtrar pendientes, vencidas o pagadas; también puedes registrar un pago, descargar el PDF y consultar auditoría.',
    tip: 'Registrar el pago desde la factura conserva la relación entre el documento, el proveedor y el desembolso.',
  },
  'recurring-invoices': {
    title: 'Facturas Recurrentes',
    description: 'Administra contratos y servicios que generan facturas de proveedor de forma periódica.',
    actions: 'Desde cada fila puedes editar la frecuencia, consultar el detalle, revisar auditoría o eliminar la configuración.',
    tip: 'Revisa la próxima fecha de emisión y la moneda antes de guardar el contrato.',
  },
  payments: {
    title: 'Pagos Realizados',
    description: 'Consulta los desembolsos aplicados a proveedores y conserva su trazabilidad contable.',
    actions: 'Desde cada fila puedes descargar el comprobante, consultar auditoría, ver el detalle o anular el pago.',
    tip: 'Relaciona cada pago con la factura correcta para actualizar el saldo pendiente del proveedor.',
  },
  credits: {
    title: 'Créditos de Proveedor',
    description: 'Registra y consulta notas de crédito y saldos a favor emitidos por proveedores.',
    actions: 'Desde cada fila puedes consultar el detalle, revisar auditoría o eliminar una nota según tus permisos.',
    tip: 'Relaciona el crédito con el documento de origen y verifica el monto antes de aplicarlo.',
  },
};

export function PurchaseViewTutorial({ view }: { view: PurchaseTutorialView }) {
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
      target: '[data-tour="purchases-list-actions"]',
      title: 'Buscar y filtrar',
      description: 'Usa el buscador, los filtros y los KPI interactivos para encontrar rápidamente los registros que necesitas.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="sales-data-table"]',
      title: 'Tabla y acciones',
      description: `${tutorial.actions} En pantallas estrechas la tabla mantiene sus acciones visibles y permite desplazamiento localizado cuando sea necesario.`,
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
