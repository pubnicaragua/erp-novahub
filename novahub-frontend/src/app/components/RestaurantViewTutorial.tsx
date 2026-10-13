import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { Button } from './ui/button';
import { GuidedTour, type GuidedTourStep } from './ui/GuidedTour';

export type RestaurantTutorialView = 'pos' | 'salon' | 'comandas' | 'cocina' | 'delivery' | 'carta' | 'reportes' | 'configuracion';

type RestaurantTutorial = { label: string; title: string; steps: GuidedTourStep[] };

const TUTORIALS: Record<RestaurantTutorialView, RestaurantTutorial> = {
  pos: {
    label: 'Cómo usar Operación POS',
    title: 'Operación POS · paso a paso',
    steps: [
      { target: '[data-tour="restaurant-pos"]', title: 'Venta y cuenta', description: 'Selecciona productos, aplica variantes y extras, abre la cuenta y envíala a cocina o cobra desde el mismo flujo.', placement: 'bottom' },
      { target: '[data-tour="restaurant-header"]', title: 'Sucursal y actualización', description: 'Selecciona la sucursal activa y actualiza los datos operativos cuando lo necesites.', placement: 'bottom' },
    ],
  },
  salon: {
    label: 'Cómo usar Salón y POS',
    title: 'Salón y POS · paso a paso',
    steps: [
      { target: '[data-tour="restaurant-salon"]', title: 'Mesas y zonas', description: 'Consulta el estado de cada mesa, abre una mesa y administra el salón desde esta vista.', placement: 'bottom' },
      { target: '[data-tour="restaurant-header"]', title: 'Actualizar y sucursal', description: 'Selecciona el alcance de la sucursal y actualiza los datos operativos cuando lo necesites.', placement: 'bottom' },
    ],
  },
  comandas: {
    label: 'Cómo usar Comandas',
    title: 'Comandas · paso a paso',
    steps: [
      { target: '[data-tour="restaurant-orders"]', title: 'Comandas', description: 'Revisa los pedidos abiertos, envíalos a cocina y avanza su estado según el flujo del restaurante.', placement: 'bottom' },
      { target: '[data-tour="restaurant-header"]', title: 'Actualizar operación', description: 'Usa Actualizar para traer las comandas y estados más recientes.', placement: 'bottom' },
    ],
  },
  cocina: {
    label: 'Cómo usar Cocina',
    title: 'Cocina · paso a paso',
    steps: [
      { target: '[data-tour="restaurant-kitchen"]', title: 'Tickets de cocina', description: 'Organiza los tickets pendientes y cambia su estado cuando avanzan en preparación.', placement: 'bottom' },
      { target: '[data-tour="restaurant-header"]', title: 'Actualizar tickets', description: 'Actualiza la vista para recibir las nuevas comandas enviadas a cocina.', placement: 'bottom' },
    ],
  },
  delivery: {
    label: 'Cómo usar Entrega y retiro',
    title: 'Entrega y retiro · paso a paso',
    steps: [
      { target: '[data-tour="restaurant-delivery"]', title: 'Pedidos de entrega', description: 'Filtra pedidos, registra al responsable y avanza cada entrega o retiro hasta completarlo.', placement: 'bottom' },
      { target: '[data-tour="restaurant-header"]', title: 'Actualizar operación', description: 'Actualiza para recibir los cambios más recientes de delivery y retiro.', placement: 'bottom' },
    ],
  },
  carta: {
    label: 'Cómo usar Carta',
    title: 'Carta · paso a paso',
    steps: [
      { target: '[data-tour="restaurant-menu"]', title: 'Carta y platillos', description: 'Administra categorías, platillos, precios, estación de preparación y disponibilidad.', placement: 'bottom' },
      { target: '[data-tour="restaurant-header"]', title: 'Sincronizar cambios', description: 'Actualiza después de guardar para ver la carta operativa disponible en el POS.', placement: 'bottom' },
    ],
  },
  reportes: {
    label: 'Cómo usar Reportes',
    title: 'Reportes de restaurante · paso a paso',
    steps: [
      { target: '[data-tour="restaurant-reports"]', title: 'Resumen operativo', description: 'Consulta ventas, comandas y actividad del restaurante con los datos del período disponible.', placement: 'bottom' },
      { target: '[data-tour="restaurant-header"]', title: 'Actualizar reportes', description: 'Actualiza para recalcular los indicadores con las operaciones más recientes.', placement: 'bottom' },
    ],
  },
  configuracion: {
    label: 'Cómo configurar Restaurante',
    title: 'Configuración de Restaurante · paso a paso',
    steps: [
      { target: '[data-tour="restaurant-configuration"]', title: 'Configuración central', description: 'Administra el perfil, canales, inventario, cocina, pedidos, cobros y permisos desde la configuración del restaurante.', placement: 'bottom' },
      { target: '[data-tour="restaurant-header"]', title: 'Guardar cambios', description: 'Revisa la sucursal activa y guarda la configuración para aplicar las reglas a la operación.', placement: 'bottom' },
    ],
  },
};

export function RestaurantViewTutorial({ view, className = '' }: { view: RestaurantTutorialView; className?: string }) {
  const [open, setOpen] = useState(false);
  const tutorial = TUTORIALS[view] || TUTORIALS.salon;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        data-toolbar-role="help"
        data-tutorial-trigger="true"
        title={tutorial.label}
        aria-label={tutorial.label}
        className={`size-8 shrink-0 rounded-lg text-muted-foreground ${className}`}
      >
        <CircleHelp className="size-4" />
      </Button>
      {open && <GuidedTour steps={tutorial.steps} onClose={() => setOpen(false)} title={tutorial.title} allowTargetInteraction />}
    </>
  );
}
