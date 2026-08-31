import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';

interface HorizontalTableScrollerProps {
  children: ReactNode;
  label?: string;
  className?: string;
  tableClassName?: string;
  scrollRef?: RefObject<HTMLDivElement | null>;
  scrollBehavior?: ScrollBehavior;
}

/** Scroll container shared by import previews and other wide tables. */
export function HorizontalTableScroller({ children, label = 'Desplazamiento horizontal', className, tableClassName, scrollRef: externalScrollRef, scrollBehavior = 'smooth' }: HorizontalTableScrollerProps) {
  const internalScrollRef = useRef<HTMLDivElement>(null);
  const scrollRef = externalScrollRef || internalScrollRef;
  const pointerInside = useRef(false);
  const scrollStateFrameRef = useRef<number | null>(null);
  const [scrollState, setScrollState] = useState({ left: false, right: false });

  const updateScrollState = useCallback(() => {
    if (scrollStateFrameRef.current !== null) return;
    scrollStateFrameRef.current = window.requestAnimationFrame(() => {
      scrollStateFrameRef.current = null;
      const element = scrollRef.current;
      if (!element) return;
      const nextState = {
        left: element.scrollLeft > 4,
        right: element.scrollLeft + element.clientWidth < element.scrollWidth - 4,
      };
      setScrollState((current) => current.left === nextState.left && current.right === nextState.right ? current : nextState);
    });
  }, [scrollRef]);

  const scrollByColumn = useCallback((direction: 'left' | 'right') => {
    const element = scrollRef.current;
    if (!element) return;
    // Mover un tramo visible hace que el desplazamiento sea evidente incluso
    // cuando la siguiente columna es muy estrecha. La barra inferior sigue
    // permitiendo llegar a cualquier columna con precisión.
    const amount = Math.max(240, Math.floor(element.clientWidth * 0.78));
    element.scrollBy({ left: direction === 'right' ? amount : -amount, behavior: scrollBehavior });
  }, [scrollBehavior, scrollRef]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    updateScrollState();
    element.addEventListener('scroll', updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(element);
    window.addEventListener('resize', updateScrollState);
    return () => {
      element.removeEventListener('scroll', updateScrollState);
      observer.disconnect();
      window.removeEventListener('resize', updateScrollState);
      if (scrollStateFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollStateFrameRef.current);
        scrollStateFrameRef.current = null;
      }
    };
  }, [scrollRef, updateScrollState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const element = scrollRef.current;
      const target = event.target as HTMLElement | null;
      const tableHasFocus = Boolean(element && document.activeElement && element.contains(document.activeElement));
      if (!element || (!pointerInside.current && !tableHasFocus)) return;
      if (target && (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable)) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      scrollByColumn(event.key === 'ArrowRight' ? 'right' : 'left');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scrollRef, scrollByColumn]);

  const handleTableKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      scrollByColumn(event.key === 'ArrowRight' ? 'right' : 'left');
    }
  };

  return (
    <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm', className)} onMouseEnter={() => { pointerInside.current = true; }} onMouseLeave={() => { pointerInside.current = false; }}>
      <div className="flex items-center justify-between gap-3 border-b border-border/40 bg-muted/10 px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</span>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" className="size-8 rounded-lg" onClick={() => scrollByColumn('left')} disabled={!scrollState.left} aria-label="Desplazar una columna a la izquierda"><ChevronLeft className="size-4" /></Button>
          <Button type="button" variant="outline" size="icon" className="size-8 rounded-lg" onClick={() => scrollByColumn('right')} disabled={!scrollState.right} aria-label="Desplazar una columna a la derecha"><ChevronRight className="size-4" /></Button>
        </div>
      </div>
      <div ref={scrollRef} data-import-preview-horizontal-scroller="true" tabIndex={0} onKeyDownCapture={handleTableKeyDown} onMouseDown={() => scrollRef.current?.focus({ preventScroll: true })} aria-label={`${label}. Usa las flechas izquierda y derecha para moverte por columna.`} className={cn('min-h-0 min-w-0 w-full flex-1 overflow-x-auto overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-primary/40 scrollbar-overlay [&_[data-slot="table-container"]]:!w-max [&_[data-slot="table-container"]]:!min-w-full [&_[data-slot="table-container"]]:!max-w-none [&_[data-slot="table-container"]]:!overflow-visible', tableClassName)} style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}>
        {children}
      </div>
    </div>
  );
}
