import { useMemo, useState } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../components/ui/utils';
import { ERP_GUIDES } from './catalog';
import { startGuide } from './events';
import { matchGuides } from './match';
import type { ErpGuide } from './types';

/** Categoría del Centro de Capacitación a la que pertenece cada área. */
const CATEGORY_BY_AREA: Record<string, string> = {
  Ventas: 'SALES', Restaurante: 'SALES', Compras: 'PURCHASES', Inventario: 'INVENTORY',
  Finanzas: 'FINANCIAL', Contabilidad: 'FINANCIAL', Reportes: 'FINANCIAL',
  'Recursos Humanos': 'HR', Actividades: 'ACTIVITIES', Configuración: 'CONFIGURATION', 'Mi Sucursal': 'CONFIGURATION', Ayuda: 'CONFIGURATION',
};

/** Lista de todas las guías paso a paso, con búsqueda y botón para iniciarlas. */
export function GuidesLibrary({ category, search }: { category: string; search: string }) {
  const { hasAccess } = useAuth();
  const [openId, setOpenId] = useState<string | null>(null);

  const guides = useMemo(() => {
    const allowed = ERP_GUIDES.filter((guide) => hasAccess(guide.module) && (category === 'ALL' || CATEGORY_BY_AREA[guide.area] === category));
    if (!search.trim()) return allowed;
    return matchGuides(search, allowed, 12).map((match) => match.guide);
  }, [category, hasAccess, search]);

  const byArea = useMemo(() => {
    const groups = new Map<string, ErpGuide[]>();
    for (const guide of guides) groups.set(guide.area, [...(groups.get(guide.area) || []), guide]);
    return [...groups.entries()];
  }, [guides]);

  return (
    <section className="space-y-3" aria-labelledby="step-guides-title" data-testid="training-step-guides">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-primary">Aprende haciendo</p>
          <h2 id="step-guides-title" className="text-2xl font-black uppercase italic tracking-tight">Guías paso a paso</h2>
        </div>
        <p className="max-w-md text-xs text-muted-foreground">Presiona «Guíame» y el sistema te lleva a la pantalla y te marca cada botón. También puedes preguntarle a Nova «¿cómo…?».</p>
      </div>
      {!byArea.length && <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No hay guías que coincidan. Prueba con otras palabras o pregúntale a Nova.</p>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {byArea.map(([area, items]) => (
          <div key={area} className="min-w-0 rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
            <h3 className="px-2 pb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">{area}</h3>
            <ul className="divide-y divide-border/50">
              {items.map((guide) => {
                const open = openId === guide.id;
                return (
                  <li key={guide.id} className="py-1.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <button type="button" onClick={() => setOpenId(open ? null : guide.id)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold hover:bg-muted/60">
                        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
                        <span className="min-w-0">{guide.title}</span>
                      </button>
                      <button type="button" onClick={() => startGuide(guide.id)} className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90" aria-label={`Guíame: ${guide.title}`}>
                        <MapPin className="size-3.5" /> Guíame
                      </button>
                    </div>
                    {open && (
                      <div className="space-y-2 px-3 pb-2 pt-1 text-sm">
                        <p className="text-muted-foreground">{guide.summary}</p>
                        {guide.requires && <p className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-200">{guide.requires}</p>}
                        <ol className="list-decimal space-y-1 pl-5">
                          {guide.steps.map((step, index) => <li key={index}>{step.text}</li>)}
                        </ol>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
