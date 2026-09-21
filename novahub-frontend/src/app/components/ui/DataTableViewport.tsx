import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  type RefObject,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import { Table, TableHeader, TableHead, TableRow } from './table';
import { cn } from './utils';

export interface DataTableViewportProps {
  children: ReactNode;
  /** Content rendered after the scroll owner, normally pagination. */
  footer?: ReactNode;
  label?: string;
  className?: string;
  tableClassName?: string;
  scrollRef?: RefObject<HTMLDivElement | null>;
  scrollBehavior?: ScrollBehavior;
  /** `page` forwards vertical wheel movement to the page instead of the table. */
  verticalWheelBehavior?: 'container' | 'page';
  compact?: boolean;
  /** Keep the operational list inside a predictable vertical viewport. */
  verticalScroll?: boolean;
  showHorizontalControls?: boolean;
  /** Keep this false for import previews and other virtualized consumers. */
  allowPageScrollAtEdges?: boolean;
}

/**
 * Shared viewport for operational tables.
 *
 * The table itself remains responsible for data, filters and pagination. This
 * component only owns scroll, sticky-header and horizontal-navigation behavior
 * so modules do not need subtly different overflow rules.
 */
export function DataTableViewport({
  children,
  footer,
  label = 'Desplazamiento horizontal',
  className,
  tableClassName,
  scrollRef: externalScrollRef,
  scrollBehavior = 'smooth',
  verticalWheelBehavior = 'container',
  compact = false,
  verticalScroll = true,
  showHorizontalControls = true,
  allowPageScrollAtEdges = true,
}: DataTableViewportProps) {
  const internalScrollRef = useRef<HTMLDivElement>(null);
  const scrollRef = externalScrollRef || internalScrollRef;
  const pointerInside = useRef(false);
  const scrollStateFrameRef = useRef<number | null>(null);
  const [scrollState, setScrollState] = useState({ left: false, right: false });
  const [horizontalScrollLeft, setHorizontalScrollLeft] = useState(0);
  const [horizontalScrollWidth, setHorizontalScrollWidth] = useState(0);

  const splitTable = useMemo(() => {
    const onlyChild = Children.toArray(children);
    if (onlyChild.length !== 1 || !isValidElement(onlyChild[0]) || onlyChild[0].type !== Table) return null;

    const table = onlyChild[0] as ReactElement<ComponentProps<typeof Table>>;
    if (table.props.responsiveCards !== false) return null;

    const tableChildren = Children.toArray(table.props.children);
    const headerIndex = tableChildren.findIndex((child) => isValidElement(child) && child.type === TableHeader);
    if (headerIndex < 0) return null;

    const header = tableChildren[headerIndex] as ReactElement<ComponentProps<typeof TableHeader>>;
    const headerRow = Children.toArray(header.props.children).find((child) => isValidElement(child) && child.type === TableRow);
    const headerCells = headerRow && isValidElement(headerRow)
      ? Children.toArray(headerRow.props.children).filter((child) => isValidElement(child) && child.type === TableHead)
      : [];
    const columnGroup = (
      <colgroup aria-hidden="true">
        {headerCells.map((cell, index) => {
          const style = (cell.props as ComponentProps<typeof TableHead>).style;
          return <col key={index} style={{ width: style?.width, minWidth: style?.minWidth }} />;
        })}
      </colgroup>
    );
    const bodyChildren = tableChildren.filter((_, index) => index !== headerIndex);

    return {
      headerTable: cloneElement(table, { 'data-sticky-table': 'false', children: [columnGroup, header] }),
      bodyTable: cloneElement(table, { 'data-sticky-table': 'false', children: [columnGroup, ...bodyChildren] }),
    };
  }, [children]);

  // The ref identity is stable; the compiler cannot infer that through the
  // fallback between an external and internal ref.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
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
      setHorizontalScrollLeft((current) => current === element.scrollLeft ? current : element.scrollLeft);
      setHorizontalScrollWidth((current) => current === element.scrollWidth ? current : element.scrollWidth);
    });
  }, [scrollRef]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const scrollByColumn = useCallback((direction: 'left' | 'right') => {
    const element = scrollRef.current;
    if (!element) return;
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

  const handleTableWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (verticalWheelBehavior !== 'page' || event.ctrlKey || event.deltaY === 0 || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    const pageScroller = scrollRef.current?.closest('main') as HTMLElement | null
      || document.scrollingElement
      || document.documentElement;
    event.preventDefault();
    pageScroller.scrollBy({ top: event.deltaY, behavior: 'auto' });
  };

  return (
    <div
      className={cn('data-table-viewport flex min-h-0 min-w-0 flex-1 flex-col overflow-visible rounded-2xl border bg-card shadow-sm', className)}
      data-table-viewport="true"
      onMouseEnter={() => { pointerInside.current = true; }}
      onMouseLeave={() => { pointerInside.current = false; }}
    >
      {showHorizontalControls && (
        <div className={cn('flex items-center justify-between gap-3 border-b border-border/40 bg-muted/10 px-3', compact ? 'py-1' : 'py-2')}>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</span>
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="icon" className={cn('rounded-lg', compact ? 'size-7' : 'size-8')} onClick={() => scrollByColumn('left')} disabled={!scrollState.left} aria-label="Desplazar una columna a la izquierda"><ChevronLeft className="size-4" /></Button>
            <Button type="button" variant="outline" size="icon" className={cn('rounded-lg', compact ? 'size-7' : 'size-8')} onClick={() => scrollByColumn('right')} disabled={!scrollState.right} aria-label="Desplazar una columna a la derecha"><ChevronRight className="size-4" /></Button>
          </div>
        </div>
      )}
      {splitTable && (
        <div
          className="data-table-viewport__sticky-header sticky z-20 min-w-0 overflow-hidden border-b border-border/50 bg-card [&_[data-slot='table-container']]:!min-h-0 [&_[data-slot='table-container']]:!max-h-none [&_[data-slot='table-container']]:!overflow-y-visible"
          style={{ top: 'var(--table-sticky-top, 0px)', backgroundColor: 'var(--card)', backgroundClip: 'padding-box' }}
          data-sticky-table-header="true"
        >
          <div className="w-max min-w-full" style={{ width: horizontalScrollWidth > 0 ? `${horizontalScrollWidth}px` : undefined, transform: `translate3d(-${horizontalScrollLeft}px, 0, 0)` }}>
            {splitTable.headerTable}
          </div>
        </div>
      )}
      <div
        ref={scrollRef}
        data-table-viewport-scroll="true"
        data-import-preview-horizontal-scroller={!verticalScroll ? 'true' : undefined}
        tabIndex={0}
        onKeyDownCapture={handleTableKeyDown}
        onWheel={handleTableWheel}
        onMouseDown={() => scrollRef.current?.focus({ preventScroll: true })}
        aria-label={`${label}. Usa las flechas izquierda y derecha para moverte por columna.`}
        className={cn(
          'min-w-0 w-full flex-1 overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-primary/40 scrollbar-overlay',
          verticalScroll ? 'min-h-[36rem] max-h-[44rem] overflow-y-auto overscroll-y-auto' : 'min-h-0 overflow-y-auto',
          !allowPageScrollAtEdges && 'overscroll-contain',
          '[&_[data-slot="table-container"]]:!w-max [&_[data-slot="table-container"]]:!min-w-full [&_[data-slot="table-container"]]:!max-w-none [&_[data-slot="table-container"]]:!overflow-visible [&_[data-slot="table-container"]]:!min-h-0 [&_[data-slot="table-container"]]:!max-h-none',
          tableClassName,
        )}
        style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y', overscrollBehaviorY: allowPageScrollAtEdges ? 'auto' : 'contain' }}
      >
        {splitTable ? splitTable.bodyTable : children}
      </div>
      {footer && <div className="data-table-viewport__footer shrink-0">{footer}</div>}
    </div>
  );
}
