import { CircleHelp } from 'lucide-react';
import { Button } from '../ui/button';
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';
import { useState } from 'react';

type InventoryFormStep = 'title' | 'data' | 'items' | 'summary' | 'actions';
type InventoryTutorialCopy = { title: string; description: string; placement: GuidedTourStep['placement']; tip?: string };

const DEFAULT_COPY: Record<InventoryFormStep, InventoryTutorialCopy> = {
  title: { title: 'Acción de inventario', description: 'Sigue este flujo para completar la operación de inventario.', placement: 'bottom' },
  data: { title: 'Datos principales', description: 'Completa la información requerida y revisa que los valores correspondan al movimiento.', placement: 'bottom' },
  items: { title: 'Detalle de productos', description: 'Agrega o revisa los productos, cantidades, ubicaciones y demás datos del detalle.', placement: 'top' },
  summary: { title: 'Revisión', description: 'Verifica el resumen, los totales y las advertencias antes de confirmar.', placement: 'left' },
  actions: { title: 'Guardar o confirmar', description: 'Usa la acción principal cuando la información esté completa.', placement: 'bottom' },
};

export function InventoryViewTutorial({
  label,
  context: _context = 'form',
  targetPrefix = 'inventory-form',
  stepKeys = ['title', 'data', 'actions'],
  copy = {},
  className = '',
}: {
  label: string;
  context?: 'form';
  targetPrefix?: string;
  stepKeys?: InventoryFormStep[];
  copy?: Partial<Record<InventoryFormStep, Partial<InventoryTutorialCopy>>>;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const steps: GuidedTourStep[] = stepKeys.map((key) => {
    const base = DEFAULT_COPY[key];
    const override = copy[key] || {};
    return {
      target: `[data-tour="${targetPrefix}-${key}"]`,
      title: override.title || base.title,
      description: override.description || base.description,
      tip: override.tip || base.tip,
      placement: override.placement || base.placement,
    };
  });

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        data-toolbar-role="help"
        data-tutorial-trigger="true"
        title={label}
        className={`size-8 shrink-0 rounded-lg text-muted-foreground ${className}`}
        aria-label={label}
      >
        <CircleHelp className="size-4" />
      </Button>
      {open && <GuidedTour steps={steps} onClose={() => setOpen(false)} title={label} allowTargetInteraction />}
    </>
  );
}
