import type { ReactNode, RefObject } from 'react';
import { DataTableViewport } from './DataTableViewport';

export interface HorizontalTableScrollerProps {
  children: ReactNode;
  label?: string;
  className?: string;
  tableClassName?: string;
  scrollRef?: RefObject<HTMLDivElement | null>;
  scrollBehavior?: ScrollBehavior;
  verticalWheelBehavior?: 'container' | 'page';
  compact?: boolean;
  /** Kept opt-in for import previews; operational lists should use the shared viewport default. */
  verticalScroll?: boolean;
  allowPageScrollAtEdges?: boolean;
}

/**
 * Backward-compatible name for wide/import tables.
 * The scroll and sticky-header implementation lives in DataTableViewport so
 * both legacy consumers and operational tables use the same behavior.
 */
export function HorizontalTableScroller({
  children,
  verticalScroll = false,
  allowPageScrollAtEdges = true,
  ...props
}: HorizontalTableScrollerProps) {
  return (
    <DataTableViewport
      {...props}
      verticalScroll={verticalScroll}
      allowPageScrollAtEdges={allowPageScrollAtEdges}
      showHorizontalControls
    >
      {children}
    </DataTableViewport>
  );
}
