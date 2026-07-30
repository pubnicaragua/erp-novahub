import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';

interface HorizontalTableScrollerProps {
  children: ReactNode;
  label?: string;
  className?: string;
  tableClassName?: string;
}

/** Scroll container shared by import previews and other wide tables. */
export function HorizontalTableScroller({ children, label = 'Desplazamiento horizontal', className, tableClassName }: HorizontalTableScrollerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pointerInside = useRef(false);
  const [scrollState, setScrollState] = useState({ left: false, right: false });

  const updateScrollState = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    setScrollState({
      left: element.scrollLeft > 4,
      right: element.scrollLeft + element.clientWidth < element.scrollWidth - 4,
    });
  }, []);

  const getColumnTargets = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return [0];
    const headers = Array.from(element.querySelectorAll<HTMLElement>('thead th'));
    const containerLeft = element.getBoundingClientRect().left;
    const targets = [0, ...headers.map((header) => Math.max(0, header.getBoundingClientRect().right - containerLeft + element.scrollLeft))];
    targets.push(Math.max(0, element.scrollWidth - element.clientWidth));
    return [...new Set(targets)].sort((a, b) => a - b);
  }, []);

  const scrollByColumn = useCallback((direction: 'left' | 'right') => {
    const element = scrollRef.current;
    if (!element) return;
    const targets = getColumnTargets();
    const current = element.scrollLeft;
    const next = direction === 'right'
      ? targets.find((target) => target > current + 4) ?? targets[targets.length - 1]
      : [...targets].reverse().find((target) => target < current - 4) ?? targets[0];
    element.scrollTo({ left: next, behavior: 'smooth' });
  }, [getColumnTargets]);

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
    };
  }, [updateScrollState]);

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
  }, [scrollByColumn]);

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
      <div ref={scrollRef} tabIndex={0} onKeyDownCapture={handleTableKeyDown} onMouseDown={() => scrollRef.current?.focus({ preventScroll: true })} aria-label={`${label}. Usa las flechas izquierda y derecha para moverte por columna.`} className={cn('min-h-0 min-w-0 flex-1 overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-primary/40', tableClassName)}>
        {children}
      </div>
    </div>
  );
}
