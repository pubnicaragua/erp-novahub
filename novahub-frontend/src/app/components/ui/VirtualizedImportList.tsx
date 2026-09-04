import { useEffect, useRef, type RefObject, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export type ImportScrollRef = RefObject<HTMLDivElement | null>;
export type ImportRowEstimate = number | ((index: number) => number);

/**
 * Shared virtualization primitives for import previews. The complete dataset
 * remains available for validation and submission, while only visible rows
 * are mounted in the DOM.
 */
export function useVirtualizedImportRows(
  count: number,
  scrollRef: ImportScrollRef,
  estimateSize: ImportRowEstimate,
  options: { overscan?: number } = {},
) {
  return useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => typeof estimateSize === 'function' ? estimateSize(index) : estimateSize,
    // Mantener pocas filas fuera del viewport evita trabajo innecesario al
    // desplazarse por archivos grandes y sigue el patrón optimizado de
    // Productos para todas las importaciones.
    overscan: options.overscan ?? 2,
    getItemKey: (index) => index,
  });
}

interface VirtualizedImportListProps {
  count: number;
  scrollRef?: ImportScrollRef;
  estimateSize: number;
  className?: string;
  overscan?: number;
  renderItem: (index: number) => ReactNode;
}

/** Virtualized mobile/card layout used by all import previews. */
export function VirtualizedImportList({
  count,
  scrollRef,
  estimateSize,
  className = '',
  overscan,
  renderItem,
}: VirtualizedImportListProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const resolvedRef = scrollRef || internalRef;
  const virtualizer = useVirtualizedImportRows(count, resolvedRef, estimateSize, { overscan });

  // The scroll element is assigned after the first render. Measuring here
  // makes the initial range deterministic even when the preview was opened
  // inside a flex container or changed from desktop to mobile.
  useEffect(() => {
    virtualizer.measure();
  }, [count, virtualizer]);

  return (
    <div
      ref={resolvedRef}
      data-import-preview-list="true"
      className={`min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-overlay ${className}`}
      style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0 w-full"
            style={{ transform: `translateY(${virtualItem.start}px)` }}
          >
            {renderItem(virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
