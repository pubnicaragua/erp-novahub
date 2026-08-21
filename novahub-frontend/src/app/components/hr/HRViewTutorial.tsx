import { CircleHelp } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/button';
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';

type HRGuideStep = 'title' | 'data' | 'items' | 'summary' | 'actions';

const DEFAULT_COPY: Record<HRGuideStep, { title: string; description: string; placement: GuidedTourStep['placement'] }> = {
  title: { title: 'Flujo de Recursos Humanos', description: 'Sigue esta guía para completar la gestión de personas y procesos de talento.', placement: 'bottom' },
  data: { title: 'Información principal', description: 'Completa o revisa los datos requeridos para trabajar con este proceso.', placement: 'bottom' },
  items: { title: 'Detalle del proceso', description: 'Agrega o revisa los empleados, conceptos, períodos o elementos relacionados.', placement: 'top' },
  summary: { title: 'Revisión', description: 'Verifica los datos y resultados antes de guardar o confirmar.', placement: 'left' },
  actions: { title: 'Acciones', description: 'Usa la acción principal cuando la información esté completa.', placement: 'bottom' },
};

export function HRViewTutorial({
  label,
  targetPrefix = 'hr-form',
  stepKeys = ['title', 'data', 'actions'],
  copy = {},
  className = '',
}: {
  label: string;
  targetPrefix?: string;
  stepKeys?: HRGuideStep[];
  copy?: Partial<Record<HRGuideStep, Partial<typeof DEFAULT_COPY[HRGuideStep]>>>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const steps: GuidedTourStep[] = stepKeys.map((key) => {
    const base = DEFAULT_COPY[key];
    const override = copy[key] || {};
    return {
      target: `[data-tour="${targetPrefix}-${key}"]`,
      title: override.title || base.title,
      description: override.description || base.description,
      placement: override.placement || base.placement,
    };
  });

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        data-toolbar-role="help"
        className={`h-10 min-w-0 rounded-xl border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest ${className}`}
        aria-label={label}
      >
        <CircleHelp className="mr-2 size-4" /> {label}
      </Button>
      {open && <GuidedTour steps={steps} onClose={() => setOpen(false)} title={label} allowTargetInteraction />}
    </>
  );
}
