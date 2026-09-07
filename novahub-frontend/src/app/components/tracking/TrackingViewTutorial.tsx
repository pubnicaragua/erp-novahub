import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { Button } from '../ui/button';
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';

export type TrackingTutorialView = 'transit' | 'reception' | 'packages' | 'reconciliation' | 'billing' | 'config';

type TrackingTutorial = { label: string; title: string; steps: GuidedTourStep[] };

const TUTORIALS: Record<TrackingTutorialView, TrackingTutorial> = {
  transit: {
    label: 'Cómo usar En tránsito',
    title: 'En tránsito · paso a paso',
    steps: [
      { target: '[data-tour="log-transit-title"]', title: 'En tránsito', description: 'Aquí ves los envíos de tus clientes que todavía están en camino y su estado actual.', placement: 'bottom' },
      { target: '[data-tour="log-transit-search"]', title: '1. Consultar un código', description: 'Escribe el código de tracking (ej. GFUS01065222301697) y pulsa Consultar. El sistema pregunta al transportista (AWBOX o CargoTrack) y te muestra dónde está el paquete.', placement: 'bottom' },
      { target: '[data-tour="log-transit-create"]', title: '2. Nuevo ticket', description: 'Si el transportista aún no tiene el envío, puedes registrarlo a mano: código, transportista, cliente, origen, destino y fecha estimada.', placement: 'bottom' },
      { target: '[data-tour="log-transit-table"]', title: '3. Lista de envíos', description: 'Cada fila es un envío. Pulsa sobre uno para ver su detalle: historial de estados, sincronizar con el transportista y copiar el enlace público para tu cliente.', placement: 'top' },
    ],
  },
  reception: {
    label: 'Cómo usar Recepción',
    title: 'Recepción · paso a paso',
    steps: [
      { target: '[data-tour="log-reception-title"]', title: 'Recepción', description: 'Aquí registras los paquetes que llegan a tu bodega, todo en una sola vista.', placement: 'bottom' },
      { target: '[data-tour="log-reception-wizard"]', title: '1. Registrar uno', description: 'Llena tipo de envío, tracking, peso, subagencia y bodega en un solo formulario y pulsa Registrar paquete. Sin pasos intermedios.', placement: 'bottom' },
      { target: '[data-tour="log-reception-save"]', title: '2. Guardar', description: 'Pulsa Registrar paquete: queda registrado. Si el código ya existía, el sistema avisa y no lo duplica.', placement: 'top' },
      { target: '[data-tour="log-wizard-open-batch"]', title: '3. Varios / PDF', description: 'Pulsa Lote / PDF del proveedor: crea una referencia (REF-######), importa el PDF del ticket (AWBOX u OGLOBAL) y guarda todos los paquetes de una vez.', placement: 'bottom' },
    ],
  },
  packages: {
    label: 'Cómo usar Paquetes recibidos',
    title: 'Paquetes recibidos · paso a paso',
    steps: [
      { target: '[data-tour="log-packages-kpis"]', title: 'Indicadores', description: 'Arriba ves los números de tu bodega: total de paquetes, libras aéreas, libras marítimas, pendientes de compra y disponibles para facturar.', placement: 'bottom' },
      { target: '[data-tour="log-packages-search"]', title: 'Buscar y filtrar', description: 'Escribe tracking, cliente o bodega para encontrar un paquete. Usa los filtros por tipo, sucursal, usuario o fecha.', placement: 'bottom' },
      { target: '[data-tour="log-reception-quick"]', title: 'Recepción rápida', description: 'Registra varios paquetes a la vez en una tabla. Ideal cuando llegan muchos de una vez.', placement: 'bottom' },
      { target: '[data-tour="log-reception-import"]', title: 'Importar Excel', description: 'Sube un archivo (puedes descargar la plantilla) y el sistema valida cada fila antes de guardar.', placement: 'bottom' },
      { target: '[data-tour="log-packages-table"]', title: 'Lista de paquetes', description: 'Cada paquete muestra su estado en español (Disponible, Facturado, Entregado). Pulsa Ver para abrir el detalle y editar tarifas o entregarlo.', placement: 'top' },
    ],
  },
  reconciliation: {
    label: 'Cómo usar Conciliación',
    title: 'Conciliación de compras · paso a paso',
    steps: [
      { target: '[data-tour="log-recon-search"]', title: '1. Buscar paquetes', description: 'Aquí aparecen los paquetes recibidos que aún no están vinculados a una compra. Búscalos por tracking, cliente o SKU.', placement: 'bottom' },
      { target: '[data-tour="log-recon-table"]', title: '2. Seleccionar paquetes', description: 'Marca con la casilla los paquetes que pertenecen a una misma compra al proveedor. Puedes pulsar la fila completa para seleccionarla.', placement: 'top' },
      { target: '[data-tour="log-recon-form"]', title: '3. Proveedor y OC', description: 'Elige el proveedor y su orden de compra aprobada. Si no existen, créalos primero en el módulo Compras.', placement: 'bottom' },
      { target: '[data-tour="log-recon-preview"]', title: '4. Preparar conciliación', description: 'Pulsa Preparar conciliación para ver el resumen (pesos y costo total) y después Confirmar para emitir la factura del proveedor.', placement: 'bottom' },
    ],
  },
  billing: {
    label: 'Cómo usar Facturar',
    title: 'Disponibles para facturar · paso a paso',
    steps: [
      { target: '[data-tour="log-billing-table"]', title: '1. Seleccionar paquetes', description: 'Marca los paquetes que vas a cobrar. Solo aparecen los que ya tienen costo y están listos para facturar.', placement: 'top' },
      { target: '[data-tour="log-billing-form"]', title: '2. Cliente y tarifa', description: 'Escribe el cliente, la fecha y la tarifa por libra (lo que cobras por cada libra). Hay un botón para aplicar la tarifa del tipo de envío.', placement: 'bottom' },
      { target: '[data-tour="log-billing-preview"]', title: '3. Previsualizar', description: 'Revisa el desglose: libras × tarifa = total con impuestos. Así ves cuánto cobrarás antes de emitir.', placement: 'bottom' },
      { target: '[data-tour="log-billing-confirm"]', title: '4. Confirmar factura', description: 'Emite la factura: el paquete pasa a Facturado y sale de la lista. El cobro se registra luego en Ventas.', placement: 'bottom' },
      { target: '[data-tour="log-billing-deliver"]', title: '5. Entregar paquetes', description: 'Cuando el cliente recoge, márcalo como Entregado. Un paquete entregado ya no se puede modificar.', placement: 'bottom' },
    ],
  },
  config: {
    label: 'Cómo usar Configuración',
    title: 'Configuración · paso a paso',
    steps: [
      { target: '[data-tour="log-config-tabs"]', title: 'Secciones', description: 'Reglas de peso, Bodegas / País, Tipos de envío, Prefijos y Campos personalizados. Pulsa cada botón para ver su sección.', placement: 'bottom' },
      { target: '[data-tour="log-config-form"]', title: 'Agregar datos', description: 'En Tipos de envío agregas Aéreo, Marítimo, Courier… (aparecen luego en Recepción). En Bodegas creas tus bodegas por país.', placement: 'bottom' },
      { target: '[data-tour="log-config-save"]', title: 'Guardar', description: 'Pulsa Guardar o el botón + para guardar cada cambio. Los cambios se reflejan de inmediato en las demás pestañas.', placement: 'bottom' },
    ],
  },
};

export function TrackingViewTutorial({ view, className = '' }: { view: TrackingTutorialView; className?: string }) {
  const [open, setOpen] = useState(false);
  const tutorial = TUTORIALS[view];
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        data-toolbar-role="help"
        className={`h-10 min-w-0 rounded-xl border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest ${className}`}
        aria-label={tutorial.label}
      >
        <CircleHelp className="mr-2 size-4" /> {tutorial.label}
      </Button>
      {open && <GuidedTour steps={tutorial.steps} onClose={() => setOpen(false)} title={tutorial.title} allowTargetInteraction />}
    </>
  );
}