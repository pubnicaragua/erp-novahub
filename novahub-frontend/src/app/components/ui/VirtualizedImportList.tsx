import { useRef, type RefObject, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export type ImportScrollRef = RefObject<HTMLDivElement | null>;

/**
 * Shared virtualization primitives for import previews. The complete dataset
 * remains available for validation and submission, while only visible rows
 * are mounted in the DOM.
 */
export function useVirtualizedImportRows(
  count: number,
  scrollRef: ImportScrollRef,
  estimateSize: number,
  options: { overscan?: number } = {},
) {
  return useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan: options.overscan ?? 8,
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

  return (
    <div ref={resolvedRef} className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${className}`}>
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
