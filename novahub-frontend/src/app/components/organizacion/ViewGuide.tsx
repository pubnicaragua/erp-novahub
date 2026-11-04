import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { Button } from '../ui/button';
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';

export interface ViewGuideConfig { title: string; steps: GuidedTourStep[] }

/**
 * Botón «?» con el tutorial guiado de la vista. El atributo aria-label contiene «Cómo» para que
 * el asistente Nova AI y el shell de la aplicación puedan iniciarlo con el mismo mecanismo que el resto del ERP.
 */
export function ViewGuide({ guide }: { guide: ViewGuideConfig }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(true)} className="size-9 shrink-0 rounded-lg text-muted-foreground"
        aria-label={`Cómo usar ${guide.title}`} title={`Cómo usar ${guide.title}`} data-tutorial-trigger="true">
        <CircleHelp className="size-5" aria-hidden="true" />
      </Button>
      {open && <GuidedTour steps={guide.steps} title={guide.title} onClose={() => setOpen(false)} allowTargetInteraction />}
    </>
  );
}
