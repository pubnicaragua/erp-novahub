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
  | 'credit-notes'
  | 'customers'
  | 'price-lists'
  | 'cash-registers';

export type SalesTutorialContext = 'list' | 'form';

type FormStepKey = 'title' | 'data' | 'items' | 'summary' | 'actions';
type SalesTutorial = {
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

const TUTORIALS: Record<SalesTutorialView, SalesTutorial> = {
  quotes: { title: 'Cotizaciones', listLabel: 'Cómo cotizar', description: 'Crea propuestas comerciales, retómalas desde Borrador, pásalas a En proceso y envíalas a una orden de venta al aprobarlas.', kpis: 'El total cotizado es un indicador monetario. La tarjeta En proceso funciona como filtro; haz clic para ver ese estado y vuelve a hacer clic para quitarlo.', filters: 'Busca por número, cliente o estado y usa Desde/Hasta para acotar la fecha de emisión. Al cambiar un filtro la página vuelve al inicio.', actions: 'Desde cada fila puedes aprobar y enviar a Orden de Venta cuando esté En proceso, descargar el PDF, ver el detalle o cancelar la cotización.', pagination: 'Selecciona 50, 100 o 200 registros por página. Revisa el rango mostrado y usa primera, anterior, siguiente o última página.', tip: 'El borrador se conserva para retomarlo; al marcarlo En proceso queda listo para aprobación.', form: { label: 'Cómo cotizar', description: 'Prepara una propuesta comercial con cliente, vigencia y líneas de productos o servicios.', data: 'Selecciona el cliente, confirma las fechas y elige la moneda. Estos datos definen el contexto de la propuesta.', items: 'Agrega productos o servicios, revisa cantidades y precios y confirma que no existan líneas sin precio.', summary: 'Verifica descuentos e impuestos y el total antes de marcar la cotización En proceso.', actions: 'Guarda un borrador para continuar después o marca la cotización En proceso cuando esté lista.', tip: 'Una cotización aprobada se convierte en una orden de venta y deja de estar disponible para edición.', steps: ['title', 'data', 'items', 'summary', 'actions'] } },
  orders: { title: 'Órdenes de Venta', listLabel: 'Cómo crear orden de venta', description: 'Gestiona órdenes en borrador, en proceso, aprobadas y canceladas.', kpis: 'Órdenes Aprobadas y Órdenes en Proceso funcionan como filtros por estado. Los demás indicadores son informativos.', filters: 'Busca por orden o cliente, filtra por estado —borrador, en proceso, aprobada o cancelada— y usa el rango de fechas.', actions: 'Desde cada fila puedes aprobar y enviar a Factura una orden en borrador o en proceso, ver el detalle, exportar el PDF o cancelarla.', pagination: 'Elige el tamaño de página y navega con los cuatro controles. El contador indica exactamente qué registros estás viendo del total.', tip: 'Las órdenes conservan los precios, impuestos, descuentos y cargos configurados en el documento de origen.', form: { label: 'Cómo crear orden de venta', description: 'Construye una orden con cliente, vendedor, entrega y el detalle que pasará a facturación.', data: 'Define cliente, vendedor, fechas de emisión y entrega, moneda y comisión cuando corresponda.', items: 'Agrega productos o servicios y revisa cantidad, precio, lista aplicada e impuestos de cada línea.', summary: 'Comprueba descuentos, IVA y el monto antes de guardar.', actions: 'Guarda como borrador, márcala En proceso o apruébala y envíala a facturación cuando esté lista.', tip: 'Una orden aprobada conserva su trazabilidad y queda relacionada con la factura generada.', steps: ['title', 'data', 'items', 'summary', 'actions'] } },
  invoices: { title: 'Facturas', listLabel: 'Cómo facturar', description: 'Consulta las facturas, emítelas y controla sus acciones de pago, crédito, descarga y cancelación.', kpis: 'Facturado Total, Por Cobrar y Cobrado son indicadores en la moneda elegida. Por Cobrar y Vencidas funcionan como filtros para priorizar la gestión.', filters: 'Busca por número, cliente o referencia y usa el rango de emisión. El filtro de estado se combina con la búsqueda y reinicia la página.', actions: 'Desde cada fila puedes descargar el PDF, consultar el historial, registrar un pago mixto o parcial, enviar el saldo a crédito, ver el detalle o cancelar la factura.', pagination: 'Cambia 50/100/200 filas por página, consulta el rango y usa primera/anterior/siguiente/última. La paginación conserva la búsqueda y las fechas activas.', tip: 'Los cobros parciales validan el límite disponible y generan el asiento del pago; el saldo a crédito queda visible en Créditos.', form: { label: 'Cómo crear factura', description: 'Completa una factura con cliente, condiciones de cobro y el detalle que respalda el ingreso.', data: 'Selecciona cliente, fechas, moneda, vendedor y forma de cobro. Si es a crédito, revisa también el vencimiento.', items: 'Agrega productos o servicios, verifica precios, cantidades, inventario y datos adicionales de cada línea.', summary: 'Revisa subtotal, descuentos, IVA y saldo antes de emitir el documento.', actions: 'Elige Guardar borrador, Guardar como pendiente, Enviar a crédito o Registrar pago. El pago puede ser completo, parcial o mixto.', tip: 'La emisión actualiza la trazabilidad financiera y contable de la venta.', steps: ['title', 'data', 'items', 'summary', 'actions'] } },
  recurring: { title: 'Facturas Recurrentes', listLabel: 'Cómo programar facturas recurrentes', description: 'Administra los contratos y servicios que generan facturación periódica para tus clientes.', kpis: 'MRR y ARR son indicadores de ingreso recurrente. Activas es un filtro; Próximas 7 días te ayuda a planificar emisiones sin modificar la lista.', filters: 'Busca por cliente, concepto o contrato y revisa las fechas configuradas. Usa el filtro Activas para separar contratos vigentes de pausados.', actions: 'Desde cada fila puedes pausar o reanudar, descargar el PDF, ver el detalle o eliminar la factura recurrente.', pagination: 'Usa el selector de cantidad para definir cuántos contratos se muestran y los controles para avanzar sin perder el filtro actual.', tip: 'Revisa la configuración de periodicidad y los conceptos antes de guardar el documento.', form: { label: 'Cómo programar facturas recurrentes', description: 'Configura un servicio periódico para que el ERP pueda generar sus facturas conforme al calendario definido.', data: 'Selecciona cliente, concepto, moneda, fecha inicial y próxima emisión.', items: 'Agrega los productos o servicios que forman parte del contrato recurrente y valida sus precios.', summary: 'Confirma periodicidad, vigencia, impuestos y el importe esperado de cada emisión.', actions: 'Guarda la configuración y revisa su estado en el listado para pausarla o reanudarla cuando sea necesario.', tip: 'Mantén actualizados el concepto y la periodicidad para evitar emisiones incorrectas.', steps: ['title', 'data', 'items', 'summary', 'actions'] } },
  payments: { title: 'Pagos Recibidos', listLabel: 'Cómo registrar pagos', description: 'Registra y consulta los pagos aplicados a facturas para mantener actualizado el saldo de tus clientes.', kpis: 'Total Recaudado y Método Principal son indicadores. Con Factura es un filtro para encontrar pagos que ya tienen documento relacionado.', filters: 'Busca por cliente, recibo o factura y aplica el rango de fecha. Usa Con Factura para auditar la trazabilidad del ingreso.', actions: 'Desde cada fila puedes descargar el PDF, ver el detalle o anular el pago recibido. Revisa primero la factura vinculada y el método.', pagination: 'Ajusta el número de pagos por página, valida el rango mostrado y usa los botones de navegación para revisar todo el historial.', tip: 'Relaciona cada pago con la factura correcta para conservar la trazabilidad contable.', form: { label: 'Cómo registrar pagos', description: 'Registra un ingreso y aplícalo a una factura o crédito para actualizar el saldo del cliente.', data: 'Selecciona cliente, factura o crédito, fecha, método, cuenta receptora y referencia.', summary: 'Confirma el monto, moneda y notas antes de guardar el pago.', actions: 'Verifica los datos y confirma el pago una sola vez para evitar duplicidades.', tip: 'Relacionar el pago con su documento mantiene actualizado el saldo y la trazabilidad.', steps: ['title', 'data', 'summary', 'actions'] } },
  returns: { title: 'Notas de Crédito', listLabel: 'Cómo gestionar devoluciones', description: 'Registra retornos totales o parciales desde una factura, decide el destino de cada producto y aplica el saldo a favor.', kpis: 'Saldo a favor generado es un indicador. Pendientes y Aprobadas son filtros para separar la revisión y aplicación.', filters: 'Busca por nota, cliente o factura de origen y filtra por fecha. Verifica cantidades, destino de inventario y motivos de descarte.', actions: 'Desde cada fila puedes aprobar, aplicar el saldo, descargar el PDF, ver el detalle o eliminar la nota.', pagination: 'El selector define cuántas notas cargar; el rango y las flechas permiten auditar la lista completa por páginas.', tip: 'Una nota puede ser parcial: registra qué cantidad vuelve a inventario y qué cantidad se descarta.', form: { label: 'Cómo gestionar devoluciones', description: 'Genera una nota de crédito a partir de una factura y decide cómo se recibe cada producto devuelto.', data: 'Selecciona cliente, factura de origen, fecha y motivo de la devolución.', items: 'Define cantidades devueltas, qué vuelve a inventario y qué se descarta, incluyendo el motivo cuando aplique.', summary: 'Revisa el subtotal, impuestos y saldo a favor antes de guardar o aprobar.', actions: 'Guarda la nota, apruébala y luego aplica el saldo cuando la revisión esté completa.', tip: 'Una devolución parcial permite separar los productos reintegrados al inventario de los descartados.', steps: ['title', 'data', 'items', 'summary', 'actions'] } },
  'credit-notes': { title: 'Créditos', listLabel: 'Cómo registrar crédito', description: 'Registra productos y servicios entregados a crédito con límite y fecha de pago.', kpis: 'Crédito Emitido y Saldo Abierto son indicadores monetarios. Activos permite priorizar los créditos pendientes.', filters: 'Busca por número, cliente o motivo y acota por fecha. Revisa la fecha de vencimiento para anticipar la cobranza.', actions: 'Desde cada fila puedes emitir el crédito, registrar pagos, descargar el PDF, ver el detalle o eliminar borradores.', pagination: 'Selecciona el tamaño de página y usa primera/anterior/siguiente/última para revisar el historial sin perder los criterios de búsqueda.', tip: 'Al registrar un pago se actualizan el crédito, el saldo del cliente y Pagos Recibidos.', form: { label: 'Cómo registrar crédito', description: 'Registra una venta a crédito con límite, vencimiento y seguimiento de saldo.', data: 'Selecciona cliente, fecha del crédito, vencimiento y moneda de la transacción.', items: 'Agrega los productos o servicios entregados y valida sus precios, cantidades e impuestos.', summary: 'Revisa el crédito emitido y el saldo abierto antes de guardar o emitir.', actions: 'Guarda el borrador para revisarlo o emite el crédito cuando el acuerdo esté confirmado.', tip: 'El vencimiento facilita priorizar la cobranza desde Créditos y Pagos Recibidos.', steps: ['title', 'data', 'items', 'actions'] } },
  customers: { title: 'Clientes', listLabel: 'Cómo gestionar clientes', description: 'Administra el directorio comercial y sus condiciones de crédito.', kpis: '', filters: '', actions: '', pagination: '', tip: '', form: { label: 'Cómo crear cliente', description: 'Registra un cliente con la información necesaria para vender, facturar y dar seguimiento a su saldo.', data: 'Captura nombre, tipo e identificación fiscal. El RUC es obligatorio para empresas.', summary: 'Completa contacto, ubicación, régimen fiscal, crédito y lista de precios cuando corresponda.', actions: 'Guarda un cliente o agrégalo a la lista para preparar varios registros antes de confirmar.', tip: 'Un cliente con datos fiscales y lista de precios correcta reduce errores en cotizaciones y facturas.', steps: ['title', 'data', 'summary', 'actions'] } },
  'price-lists': { title: 'Listas de precios', listLabel: 'Cómo actualizar precios', description: 'Administra las tarifas que se aplican a clientes y documentos de venta.', kpis: '', filters: '', actions: '', pagination: '', tip: '', form: { label: 'Cómo crear lista de precios', description: 'Crea una tarifa adicional para mostrarla en la matriz y asignarla a clientes.', data: 'Escribe un nombre claro para identificar el propósito de la lista.', summary: 'Revisa la matriz y asigna los precios de los productos después de crearla.', actions: 'Confirma la creación y verifica que la nueva lista aparezca como columna disponible.', tip: 'Usa nombres consistentes como Mayorista, Distribuidor o Promocional para encontrarlas rápidamente.', steps: ['title', 'data', 'actions'] } },
  'cash-registers': { title: 'Cajas', listLabel: 'Cómo administrar cajas', description: 'Administra las cajas y sus accesos para la operación de ventas.', kpis: '', filters: '', actions: '', pagination: '', tip: '', form: { label: 'Cómo crear caja', description: 'Configura una caja operativa para que pueda abrir sesión y recibir facturación POS.', data: 'Define nombre, código, ubicación, sucursal y estado activo.', summary: 'Verifica que la caja quede activa y asociada a la sucursal correcta.', actions: 'Guarda la caja y luego asigna los usuarios que podrán operarla.', tip: 'El código debe ser fácil de identificar en tickets, aperturas y cierres de caja.', steps: ['title', 'data', 'summary', 'actions'] } },
};

export function SalesViewTutorial({ view, context = 'list', className }: { view: SalesTutorialView; context?: SalesTutorialContext; className?: string }) {
  const [open, setOpen] = useState(false);
  const tutorial = TUTORIALS[view];
  const formTargetLabels: Record<FormStepKey, GuidedTourStep> = {
    title: { target: '[data-tour="sales-form-title"]', title: tutorial.form.label, description: tutorial.form.description, placement: 'bottom' },
    data: { target: '[data-tour="sales-form-data"]', title: 'Datos principales', description: tutorial.form.data, placement: 'bottom' },
    items: { target: '[data-tour="sales-form-items"]', title: 'Detalle de productos y servicios', description: tutorial.form.items || tutorial.form.summary, placement: 'top' },
    summary: { target: '[data-tour="sales-form-summary"]', title: 'Revisión antes de guardar', description: tutorial.form.summary, placement: 'left' },
    actions: { target: '[data-tour="sales-form-actions"]', title: 'Guardar o confirmar', description: tutorial.form.actions, tip: tutorial.form.tip, placement: 'bottom' },
  };
  const steps: GuidedTourStep[] = context === 'form'
    ? tutorial.form.steps.map((key) => formTargetLabels[key])
    : [
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
  const buttonLabel = context === 'form' ? tutorial.form.label : tutorial.listLabel;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        data-toolbar-role="help"
        className={className || 'h-10 rounded-xl border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest'}
        aria-label={buttonLabel}
      >
        <CircleHelp className="mr-2 size-4" /> {buttonLabel}
      </Button>
      {open && <GuidedTour steps={steps} onClose={() => setOpen(false)} title={context === 'form' ? tutorial.form.label : tutorial.title} allowTargetInteraction />}
    </>
  );
}
