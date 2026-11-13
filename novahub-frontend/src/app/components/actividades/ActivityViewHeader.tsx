import type { ReactNode } from 'react';
import { InventoryViewTutorial } from '../inventory/InventoryViewTutorial';

interface ActivityViewHeaderProps {
  /** Título de la vista: va siempre arriba de todo, antes de las tarjetas. */
  title: string;
  /** Prefijo de los pasos de la guía; la guía usa `${prefix}-title`, `${prefix}-data` y `${prefix}-actions`. */
  tourPrefix: string;
  helpLabel: string;
  helpTitle: string;
  helpDescription: string;
  dataTitle: string;
  dataDescription: string;
  actionsTitle: string;
  actionsDescription: string;
  /** Frase corta bajo el título: para qué sirve la vista. */
  purpose?: ReactNode;
}

/** Cabecera estándar de las vistas de Actividades: título editorial, «?» junto al título y, si se quiere, para qué sirve. */
export function ActivityViewHeader({ title, tourPrefix, helpLabel, helpTitle, helpDescription, dataTitle, dataDescription, actionsTitle, actionsDescription, purpose }: ActivityViewHeaderProps) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex min-w-0 items-center gap-2">
        <h2 className="nh-module-title break-words" data-tour={`${tourPrefix}-title`}>{title}</h2>
        <InventoryViewTutorial
          label={helpLabel}
          targetPrefix={tourPrefix}
          compact
          stepKeys={['title', 'data', 'actions']}
          copy={{
            title: { title: helpTitle, description: helpDescription },
            data: { title: dataTitle, description: dataDescription },
            actions: { title: actionsTitle, description: actionsDescription },
          }}
        />
      </div>
      {purpose && (
        <p
          className="text-xs leading-5 text-muted-foreground"
          style={{
            // La página mide la barra de pestañas que flota a la derecha y deja estas dos medidas (ver ActividadesPage).
            maxWidth: 'min(48rem, calc(100% - var(--activities-nav-clear, 0px)))',
            marginTop: 'calc(0.25rem + var(--activities-nav-push, 0px))',
          }}
        >
          {purpose}
        </p>
      )}
    </div>
  );
}
