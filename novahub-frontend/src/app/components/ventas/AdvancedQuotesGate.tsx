import { useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { tenantQuotesService } from '../../services/tenant-quotes.service';
import { PlatformQuotesPanel, type QuoteApi } from '../admin/PlatformQuotesPanel';
import { ImportQuotesButton } from './ImportQuotesButton';
import { cn } from '../ui/utils';

const tenantQuoteApi: QuoteApi = {
  list: (params, signal) => tenantQuotesService.list(params, signal),
  create: (body) => tenantQuotesService.create(body),
  update: (id, body) => tenantQuotesService.update(id, body),
  updateStatus: (id, status) => tenantQuotesService.updateStatus(id, status),
  remove: (id) => tenantQuotesService.remove(id),
};

/**
 * Si la empresa tiene la función «Cotizaciones avanzadas», Ventas > Cotizaciones ofrece el mismo constructor de
 * propuestas del SuperAdmin con los datos propios de la empresa, junto a las cotizaciones simples de siempre.
 * Sin la función, muestra únicamente las cotizaciones simples (sin cambios para el resto de empresas).
 */
export function AdvancedQuotesGate({ simple }: { simple: ReactNode }) {
  const { canPerform } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'proposals' | 'simple'>('proposals');
  const capabilities = useTenantQuery(['sales', 'proposals-capabilities'], (signal) => tenantQuotesService.getCapabilities(signal), { staleTime: 5 * 60_000, retry: 0 });
  const canCreate = canPerform('SALES_QUOTES', 'create');
  const extraActions = useMemo(() => canCreate ? <ImportQuotesButton onImported={() => { void queryClient.invalidateQueries({ queryKey: ['tenant-module'] }); }} /> : null, [canCreate, queryClient]);

  if (!capabilities.data?.advancedQuotes) return <>{simple}</>;
  const tabs: Array<{ id: 'proposals' | 'simple'; label: string }> = [{ id: 'proposals', label: 'Propuestas comerciales' }, { id: 'simple', label: 'Cotizaciones simples' }];
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/30 p-1" role="tablist" aria-label="Tipo de cotización">
        {tabs.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}
            className={cn('whitespace-nowrap rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wider transition-colors', tab === item.id ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'proposals'
        ? <PlatformQuotesPanel variant="tenant" api={tenantQuoteApi} canCreate={canCreate} extraActions={extraActions} />
        : simple}
    </div>
  );
}
