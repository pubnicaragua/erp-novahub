import { useState } from 'react';
import { FileText, Loader2, Plus, Search } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Skeleton } from '../../ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import { cn } from '../../ui/utils';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { toast } from '../../../services/toast';
import { BILLING_LABEL, CONTRACT_HEALTH_LABEL, CONTRACT_STATUS_LABEL, clientContractsService, type BillingFrequency, type ContractStatus } from '../../../services/client-contracts.service';
import { ClientContractDialog } from './ClientContractDialog';
import { getCurrencyDecimalPlaces } from '../../../utils/currency';

const failure = (error: unknown) => (error as any)?.response?.data?.message?.toString?.() || (error as Error)?.message || 'No se pudo completar la acción.';
const money = (amount: number, currency: string) => `${currency} ${new Intl.NumberFormat('es-NI', { minimumFractionDigits: getCurrencyDecimalPlaces() }).format(amount)}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-NI', { dateStyle: 'medium', timeZone: 'UTC' }) : '—');
const field = 'h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary';

function NewContractDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const quotes = useTenantQuery(['sales', 'contract-quotes'], (signal) => clientContractsService.availableQuotes(signal), { staleTime: 0 });
  const [mode, setMode] = useState<'quote' | 'manual'>('quote');
  const [quoteId, setQuoteId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [billing, setBilling] = useState<BillingFrequency>('MONTHLY');
  const [clientName, setClientName] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [busy, setBusy] = useState(false);
  const noQuotes = !quotes.isLoading && !quotes.data?.length;
  const asManual = mode === 'manual' || noQuotes;

  const create = async () => {
    setBusy(true);
    try {
      const dates = { startDate: startDate || null, endDate: endDate || null, billingFrequency: billing };
      const created = asManual
        ? await clientContractsService.create({ clientName: clientName.trim(), title: title.trim(), amount: Number(amount), currency, ...dates })
        : await clientContractsService.createFromQuote(quoteId, dates);
      toast.success(`Contrato ${created.number} creado`);
      onCreated(created.id);
    } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nuevo contrato</DialogTitle><DialogDescription>Lo normal: formalizar una propuesta que el cliente ya aceptó. Se arma el texto con sus datos y queda como borrador.</DialogDescription></DialogHeader>
        {!noQuotes && <div role="tablist" className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">{([['quote', 'Desde una propuesta aceptada'], ['manual', 'Sin propuesta']] as const).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)} className={cn('flex-1 rounded-lg px-3 py-1.5 text-xs font-bold', mode === id ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground')}>{label}</button>)}</div>}
        {noQuotes && mode === 'quote' && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">No hay propuestas aceptadas sin contrato. Cuando una propuesta pase a «Aceptada» aparecerá aquí; mientras tanto puedes crear el contrato a mano.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {asManual ? (
            <>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="nc-client">Cliente</Label><Input id="nc-client" value={clientName} maxLength={160} onChange={(e) => setClientName(e.target.value)} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="nc-title">Título</Label><Input id="nc-title" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="Servicios de implementación" /></div>
              <div className="space-y-1.5"><Label htmlFor="nc-amount">Monto</Label><Input id="nc-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} currencyPrecision /></div>
              <div className="space-y-1.5"><Label htmlFor="nc-cur">Moneda</Label><select id="nc-cur" className={field} value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="USD">USD</option><option value="NIO">NIO</option></select></div>
            </>
          ) : (
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="nc-quote">Propuesta aceptada</Label>{quotes.isLoading ? <Skeleton className="h-10 w-full" /> : <select id="nc-quote" className={field} value={quoteId} onChange={(e) => setQuoteId(e.target.value)}><option value="">Elegir…</option>{quotes.data?.map((quote) => <option key={quote.id} value={quote.id}>{quote.number} · {quote.prospectCompany} · {money(quote.total, quote.currency)}</option>)}</select>}</div>
          )}
          <div className="space-y-1.5"><Label htmlFor="nc-start">Inicio</Label><Input id="nc-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="nc-end">Fin</Label><Input id="nc-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="nc-bill">Facturación</Label><select id="nc-bill" className={field} value={billing} onChange={(e) => setBilling(e.target.value as BillingFrequency)}>{(Object.keys(BILLING_LABEL) as BillingFrequency[]).map((key) => <option key={key} value={key}>{BILLING_LABEL[key]}</option>)}</select></div>
        </div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button><Button type="button" onClick={() => void create()} disabled={busy || (asManual ? !clientName.trim() || !title.trim() || !(Number(amount) >= 0) || amount === '' : !quoteId)}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Crear borrador</Button></div>
      </DialogContent>
    </Dialog>
  );
}

/** Contratos con clientes: lo que hay que firmar, lo vigente, lo que vence y los hitos atrasados, en una sola vista. */
export function ClientContractsPanel() {
  const client = useQueryClient();
  const { canPerform } = useAuth();
  const [status, setStatus] = useState<string>('');
  const [health, setHealth] = useState<string>('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const list = useTenantQuery(['sales', 'client-contracts', status, health, search], (signal) => clientContractsService.list({ status: status || undefined, health: health || undefined, search: search || undefined }, signal), { staleTime: 15_000 });
  const refresh = () => void client.invalidateQueries({ queryKey: ['tenant-module'] });
  const summary = list.data?.summary;

  const cards: Array<{ label: string; value: string; filter?: { status?: string; health?: string }; tone?: string }> = summary ? [
    { label: 'Por firmar', value: String(summary.byStatus.PENDING_SIGNATURE), filter: { status: 'PENDING_SIGNATURE' } },
    { label: 'Vigentes', value: String(summary.byStatus.ACTIVE), filter: { status: 'ACTIVE' } },
    { label: 'Por vencer', value: String(summary.expiring), filter: { health: 'EXPIRING' }, tone: summary.expiring ? 'text-amber-700' : undefined },
    { label: 'Vencidos o con hito atrasado', value: String(summary.expired + summary.overdueMilestones), filter: { health: summary.expired ? 'EXPIRED' : 'MILESTONE_OVERDUE' }, tone: summary.expired + summary.overdueMilestones ? 'text-red-700' : undefined },
    { label: 'Valor vigente', value: summary.activeAmount.length ? summary.activeAmount.map((row) => money(row.amount, row.currency)).join(' · ') : '—' },
  ] : [];

  return (
    <div className="min-w-0 space-y-4" data-testid="client-contracts">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="flex items-center gap-2 text-lg font-black"><FileText className="size-5 text-primary" aria-hidden /> Contratos con clientes</h2><p className="text-xs text-muted-foreground">De la propuesta aceptada al contrato firmado, con hitos, renovaciones y avisos de vencimiento.</p></div>
        {canPerform('SALES_QUOTES', 'create') && <Button type="button" onClick={() => setCreating(true)}><Plus className="mr-1.5 size-4" /> Nuevo contrato</Button>}
      </div>

      {summary && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{cards.map((card) => <button key={card.label} type="button" disabled={!card.filter} onClick={() => { if (card.filter) { setStatus(card.filter.status ?? ''); setHealth(card.filter.health ?? ''); } }} className="min-w-0 rounded-xl border border-border/60 bg-card p-3 text-left shadow-sm disabled:cursor-default"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{card.label}</p><p className={cn('mt-1 break-words text-xl font-black tabular-nums', card.tone)}>{card.value}</p></button>)}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input aria-label="Buscar contrato" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Número, cliente o título" /></div>
        <select aria-label="Estado" className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos los estados</option>{(Object.keys(CONTRACT_STATUS_LABEL) as ContractStatus[]).map((key) => <option key={key} value={key}>{CONTRACT_STATUS_LABEL[key].label}</option>)}</select>
        <select aria-label="Seguimiento" className="h-10 rounded-xl border border-border/60 bg-background px-3 text-sm" value={health} onChange={(e) => setHealth(e.target.value)}><option value="">Todo el seguimiento</option><option value="EXPIRING">Por vencer</option><option value="EXPIRED">Vencidos</option><option value="MILESTONE_OVERDUE">Con hito atrasado</option></select>
        {(status || health || search) && <button type="button" className="text-xs font-semibold text-primary underline" onClick={() => { setStatus(''); setHealth(''); setSearch(''); }}>Quitar filtros</button>}
      </div>

      {list.isLoading ? <Skeleton className="h-40 w-full rounded-2xl" aria-busy="true" />
        : list.isError ? <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">No se pudieron cargar los contratos.</p>
        : !list.data?.items.length ? <Card className="rounded-2xl border-dashed p-8 text-center text-sm text-muted-foreground">{summary?.total ? 'Ningún contrato coincide con los filtros.' : 'Todavía no hay contratos. Cuando una propuesta sea aceptada, formalízala desde «Nuevo contrato».'}</Card>
        : (
          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-muted/40 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground"><tr><th className="px-3 py-2">Contrato</th><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2 text-right">Monto</th><th className="px-3 py-2">Vigencia</th><th className="px-3 py-2">Hitos</th></tr></thead>
              <tbody>
                {list.data.items.map((row) => {
                  const healthLabel = CONTRACT_HEALTH_LABEL[row.health];
                  return (
                    <tr key={row.id} className="cursor-pointer border-t border-border/40 hover:bg-muted/30" onClick={() => setOpenId(row.id)}>
                      <td className="px-3 py-2"><button type="button" className="text-left font-bold text-primary underline-offset-2 hover:underline dark:text-accent" onClick={(e) => { e.stopPropagation(); setOpenId(row.id); }}>{row.number}</button><p className="max-w-[220px] truncate text-xs text-muted-foreground">{row.title}</p></td>
                      <td className="px-3 py-2">{row.clientName}</td>
                      <td className="px-3 py-2"><span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', CONTRACT_STATUS_LABEL[row.status].tone)}>{CONTRACT_STATUS_LABEL[row.status].label}</span>{healthLabel && <span className={cn('ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', healthLabel.tone)}>{healthLabel.label}</span>}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums">{money(row.amount, row.currency)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs">{row.startDate || row.endDate ? `${day(row.startDate)} → ${day(row.endDate)}` : '—'}{row.autoRenew ? ' · se renueva' : ''}</td>
                      <td className="px-3 py-2 text-xs tabular-nums">{row.milestoneProgress.total ? `${row.milestoneProgress.done}/${row.milestoneProgress.total}` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      {creating && <NewContractDialog onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); refresh(); setOpenId(id); }} />}
      {openId && <ClientContractDialog contractId={openId} onClose={() => setOpenId(null)} onChanged={refresh} />}
    </div>
  );
}
