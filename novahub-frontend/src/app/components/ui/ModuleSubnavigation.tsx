import { useEffect, useRef, type ReactNode, type Ref } from 'react';
import { getSidebarAwareNavigationClass } from '../../utils/sidebarNavigation.mjs';
import { cn } from './utils';

export interface ModuleSubnavigationItem {
  id: string;
  label: string;
  icon?: ReactNode;
  dataAuditNav?: string;
}

interface ModuleSubnavigationProps {
  items: readonly ModuleSubnavigationItem[];
  value: string;
  onValueChange: (value: string) => void;
  isSidebarCollapsed?: boolean;
  ariaLabel: string;
  className?: string;
  dataTour?: string;
  listRef?: Ref<HTMLDivElement>;
}

/** Navigation controls shared by module shells when the sidebar is collapsed. */
export function ModuleSubnavigation({
  items,
  value,
  onValueChange,
  isSidebarCollapsed,
  ariaLabel,
  className,
  dataTour,
  listRef,
}: ModuleSubnavigationProps) {
  const navRef = useRef<HTMLElement>(null);
  // En celular solo cabe parte de la barra: la pestaña activa se lleva a la vista para que siempre se vea dónde estás.
  useEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (active && typeof active.scrollIntoView === 'function') active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [value]);
  return (
    <nav
      ref={navRef}
      aria-label={ariaLabel}
      data-tour={dataTour}
      className={cn(
        getSidebarAwareNavigationClass(isSidebarCollapsed),
        'mb-4 w-full min-w-0 overflow-x-auto overscroll-x-contain custom-scrollbar',
        className,
      )}
    >
      <div ref={listRef} className="flex h-auto w-max min-w-full gap-1.5 rounded-2xl border border-border/40 bg-gradient-to-br from-muted/30 to-muted/50 p-1.5 backdrop-blur-sm">
        {items.map((item) => {
          const isActive = value === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              data-state={isActive ? 'active' : 'inactive'}
              data-audit-nav={item.dataAuditNav}
              onClick={() => onValueChange(item.id)}
              className={cn(
                'flex min-h-10 flex-none shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black uppercase tracking-widest transition-[background-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] sm:px-4',
                isActive
                  ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              {item.icon}
              {/* En celular, las demás pestañas muestran solo su ícono; la activa dice su nombre para que se entienda dónde estás. */}
              <span className={item.icon && !isActive ? 'hidden sm:inline' : 'inline whitespace-nowrap'}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
