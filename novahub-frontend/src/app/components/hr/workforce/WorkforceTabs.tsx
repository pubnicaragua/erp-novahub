import { useState, type ReactNode } from 'react';
import { cn } from '../../ui/utils';

export interface WorkforceTab { id: string; label: string; content: ReactNode }

/** Pestañas de una vista de Recursos Humanos: la vista de siempre primero y las nuevas herramientas a su lado. */
export function WorkforceTabs({ tabs, label }: { tabs: WorkforceTab[]; label: string }) {
  const [active, setActive] = useState(tabs[0].id);
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0];
  return (
    <div className="min-w-0 space-y-4">
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/30 p-1">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" role="tab" aria-selected={current.id === tab.id} onClick={() => setActive(tab.id)}
            className={cn('whitespace-nowrap rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors', current.id === tab.id ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{tab.label}</button>
        ))}
      </div>
      <div role="tabpanel">{current.content}</div>
    </div>
  );
}
