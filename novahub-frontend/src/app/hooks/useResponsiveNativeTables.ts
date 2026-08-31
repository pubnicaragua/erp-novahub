import { useEffect } from 'react';

function normalizeLabel(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

/**
 * Native tables still exist in reports, configuration screens and a few
 * legacy panels. Add the same semantic labels used by the shared Table
 * primitive so the global compact-card CSS can present those records without
 * rewriting every legacy renderer in one risky change.
 */
function enhanceNativeTables(scope?: Iterable<HTMLTableElement>) {
  if (typeof document === 'undefined') return;

  const tables = scope
    ? Array.from(scope)
    : Array.from(document.querySelectorAll<HTMLTableElement>('table:not([data-slot="table"]):not([data-responsive-cards="false"])'));

  tables.forEach((table) => {
    if (table.matches('[data-slot="table"], [data-responsive-cards="false"]')) return;
    const headerRow = table.tHead?.rows[0];
    const labels = headerRow
      ? Array.from(headerRow.cells).map((cell) => normalizeLabel(cell.textContent))
      : [];

    Array.from(table.tBodies).forEach((body) => {
      Array.from(body.rows).forEach((row) => {
        Array.from(row.cells).forEach((cell, index) => {
          if (cell.hasAttribute('colspan')) return;
          const label = labels[index] || `Campo ${index + 1}`;
          if (cell.dataset.label !== label) cell.dataset.label = label;
        });
      });
    });

    table.dataset.responsiveCards = 'true';
    table.parentElement?.setAttribute('data-responsive-cards-container', 'true');
  });
}

/** Keep legacy/native tables aligned when lazy modules or dialogs mount. */
export function useResponsiveNativeTables() {
  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;

    let frame = 0;
    const pendingTables = new Set<HTMLTableElement>();
    const addTablesFromNode = (node: Node) => {
      if (!(node instanceof Element)) return;
      const table = node.closest<HTMLTableElement>('table');
      if (table) pendingTables.add(table);
      node.querySelectorAll<HTMLTableElement>('table').forEach((nestedTable) => pendingTables.add(nestedTable));
    };
    const scheduleScan = (records?: MutationRecord[]) => {
      records?.forEach((record) => {
        addTablesFromNode(record.target);
        record.addedNodes.forEach(addTablesFromNode);
      });
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const tables = pendingTables.size ? new Set(pendingTables) : undefined;
        pendingTables.clear();
        enhanceNativeTables(tables);
      });
    };

    enhanceNativeTables();
    const observer = new MutationObserver(scheduleScan);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
}
