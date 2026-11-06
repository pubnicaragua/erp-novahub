import { useCallback, useEffect, useState } from 'react';

export type ForceSalesReportHistoryEntry = {
  id: string;
  createdAt: string;
  format: 'Excel' | 'PDF';
  fileName: string;
  from: string;
  to: string;
  hourFrom: string;
  hourTo: string;
  assignedToId: string;
  routeId: string;
  managerLabel: string;
  routeLabel: string;
  records: number;
};

const MAX_ENTRIES = 50;

/**
 * Historial de reportes descargados en Fuerza Comercial. Se guarda en este navegador,
 * separado por empresa y usuario, para que lo descargado siga visible en la vista y
 * se pueda volver a consultar con los mismos filtros.
 */
export function useForceSalesReportHistory(tenantId?: string | null, userId?: string | null) {
  const storageKey = `nh-force-sales-report-history:${tenantId || 'sin-empresa'}:${userId || 'sin-usuario'}`;
  const read = useCallback((): ForceSalesReportHistoryEntry[] => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [storageKey]);
  const [entries, setEntries] = useState<ForceSalesReportHistoryEntry[]>(read);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setEntries(read()); }, [read]);

  const persist = useCallback((next: ForceSalesReportHistoryEntry[]) => {
    setEntries(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* sin espacio o modo privado: queda solo en memoria */ }
  }, [storageKey]);

  const add = useCallback((entry: Omit<ForceSalesReportHistoryEntry, 'id' | 'createdAt'>) => {
    const created: ForceSalesReportHistoryEntry = { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString() };
    persist([created, ...read()].slice(0, MAX_ENTRIES));
  }, [persist, read]);
  const remove = useCallback((id: string) => persist(read().filter((entry) => entry.id !== id)), [persist, read]);
  const clear = useCallback(() => persist([]), [persist]);

  return { entries, add, remove, clear };
}
