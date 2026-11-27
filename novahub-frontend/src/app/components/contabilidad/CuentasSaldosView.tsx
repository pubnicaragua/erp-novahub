import { useEffect, useState, type ReactNode } from 'react';
import { BadgeCheck, CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, Clock3, FileText, RefreshCw, Search, UserRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { contabilidadService, type AccountingBalanceDetails, type AccountingBalanceDocument, type AccountingBalanceSide } from '../../services/contabilidad.service';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { cn } from '../ui/utils';
import { SalesKpiCard } from '../ventas/SalesKpiCard';

const PAGE_SIZE = 25;
const money = (amount: unknown, currency = 'NIO') => {
  const code = String(currency || 'NIO').toUpperCase();
  try {
    return new Intl.NumberFormat('es-NI', { style: 'currency', currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(amount || 0));
  } catch {
    return `${code} ${Number(amount || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
};
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const docLabel: Record<string, string> = {
  INVOICE: 'Factura', CUSTOMER_LOAN: 'Préstamo', CUSTOMER_CREDIT: 'Crédito de cliente',
  SUPPLIER_INVOICE: 'Factura de proveedor', PURCHASE_RECEIPT: 'Recepción de compra',
};

export function CuentasSaldosView({ side }: { side: AccountingBalanceSide }) {
  const { canPerform } = useAuth();
  const permission = side === 'RECEIVABLES' ? 'ACCOUNTING_RECEIVABLES' : 'ACCOUNTING_PAYABLES';
  const title = side === 'RECEIVABLES' ? 'Cuentas por Cobrar' : 'Cuentas por Pagar';
  const partyLabel = side === 'RECEIVABLES' ? 'Cliente' : 'Proveedor';
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('PENDING');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AccountingBalanceDocument | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const query = useTenantQuery(
    ['accounting-balances', side, debouncedSearch, status, dateFrom, dateTo, page],
    (signal) => contabilidadService.getReceivablesPayables({ side, search: debouncedSearch || undefined, status: status || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page, pageSize: PAGE_SIZE, includeSummary: true }, signal),
    { enabled: canPerform(permission, 'view') },
  );
  const response = query.data;
  const rows = response?.data || [];
  const totalRows = response?.meta.total || 0;
  const totalPages = response?.meta.totalPages || 1;
  const summary = response?.summary;
  const pendingBalanceByCurrency = summary?.pendingBalanceByCurrency || [];
  const details = useTenantQuery<AccountingBalanceDetails>(
    ['accounting-balance-detail', selected?.side, selected?.documentType, selected?.sourceId],
    (signal) => contabilidadService.getReceivablePayableDetails(selected!.side, selected!.documentType, selected!.sourceId, signal),
    { enabled: Boolean(selected) && canPerform(permission, 'view') },
  );

  const resetFilters = () => { setSearch(''); setStatus('PENDING'); setDateFrom(''); setDateTo(''); setPage(1); };

  return (
    <div className="min-w-0 space-y-5 overflow-x-hidden">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Contabilidad</p>
          <h2 className="nh-module-title mt-1">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Un registro por documento. Los abonos parciales conservan el estado pendiente y muestran el saldo restante.</p>
        </div>
        <Badge variant="outline" className="w-fit shrink-0">{totalRows.toLocaleString('es-NI')} documento(s) {status === 'PENDING' ? 'pendientes' : status === 'PAID' ? 'pagados' : 'en total'}</Badge>
      </div>

      <section className="min-w-0 space-y-2" aria-label={`Indicadores de ${title.toLowerCase()}`} aria-busy={query.isLoading}>
        <p className="text-xs text-muted-foreground">Resumen del período y búsqueda seleccionados; el estado solo filtra la lista.</p>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SalesKpiCard title="Documentos" value={summary ? summary.total.toLocaleString('es-NI') : '—'} icon={FileText} />
          <SalesKpiCard title={side === 'RECEIVABLES' ? 'Por cobrar' : 'Por pagar'} value={summary ? summary.pending.toLocaleString('es-NI') : '—'} icon={Clock3} />
          <SalesKpiCard title="Pagados" value={summary ? summary.paid.toLocaleString('es-NI') : '—'} icon={BadgeCheck} />
          <SalesKpiCard
            title="Saldo pendiente"
            value={pendingBalanceByCurrency.length ? <span className="block text-base leading-tight">{pendingBalanceByCurrency.map((entry) => <span key={entry.currency} className="block">{money(entry.amount, entry.currency)}</span>)}</span> : summary ? 'Sin saldo' : '—'}
            icon={CircleDollarSign}
          />
        </div>
      </section>

      <Card className="min-w-0 rounded-2xl border-border/60 shadow-sm">
        <CardContent className="grid min-w-0 grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.5fr)_minmax(150px,.8fr)_minmax(150px,.8fr)_minmax(150px,.8fr)_auto] xl:items-end">
          <label className="min-w-0 space-y-1.5 text-xs font-bold text-muted-foreground">
            <span>Buscar {partyLabel.toLowerCase()} o documento</span>
            <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o número de documento" className="pl-9" /></div>
          </label>
          <label className="min-w-0 space-y-1.5 text-xs font-bold text-muted-foreground"><span>Estado</span>
            <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="erp-filter-select h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal">
              <option value="PENDING">{side === 'RECEIVABLES' ? 'Por cobrar' : 'Por pagar'}</option><option value="PAID">Pagado</option>
            </select>
          </label>
          <label className="min-w-0 space-y-1.5 text-xs font-bold text-muted-foreground"><span>Desde</span><Input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} /></label>
          <label className="min-w-0 space-y-1.5 text-xs font-bold text-muted-foreground"><span>Hasta</span><Input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} /></label>
          <Button type="button" variant="outline" onClick={resetFilters} className="h-10 rounded-xl">Limpiar</Button>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="border-b border-border/50 px-4 py-4 sm:px-5">
          <CardTitle className="flex items-center gap-2 text-base font-black"><FileText className="size-4 text-primary" />{title}<span className="text-xs font-medium text-muted-foreground">· {totalRows.toLocaleString('es-NI')} documento(s)</span></CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 p-0">
          {query.isLoading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground"><RefreshCw className="size-4 animate-spin" />Cargando documentos…</div>
            : query.error ? <div className="p-8 text-center"><p className="font-bold">No se pudieron cargar los documentos</p><Button variant="outline" className="mt-3" onClick={() => void query.refetch()}>Reintentar</Button></div>
              : rows.length === 0 ? <div className="p-10 text-center"><CircleDollarSign className="mx-auto mb-3 size-8 text-muted-foreground/50" /><p className="font-bold">Sin documentos</p><p className="mt-1 text-sm text-muted-foreground">No hay registros para el estado y los filtros seleccionados.</p></div>
                : <>
                  <div className="hidden overflow-x-auto xl:block">
                    <Table responsiveCards={false} className="min-w-[880px]">
                      <TableHeader><TableRow><TableHead>{partyLabel}</TableHead><TableHead>Documento</TableHead><TableHead>Emisión</TableHead><TableHead>Vencimiento</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Abonado</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead>Estado</TableHead><TableHead /></TableRow></TableHeader>
                      <TableBody>{rows.map((row) => <TableRow key={row.id} className="cursor-pointer" onClick={() => setSelected(row)}>
                        <TableCell><p className="max-w-48 truncate font-semibold">{row.partyName}</p>{row.partyCode && <p className="text-xs text-muted-foreground">{row.partyCode}</p>}</TableCell>
                        <TableCell><p className="font-mono text-sm font-semibold">{row.number}</p><p className="text-xs text-muted-foreground">{docLabel[row.documentType] || 'Documento'}</p></TableCell>
                        <TableCell className="whitespace-nowrap">{dateLabel(row.date)}</TableCell><TableCell className="whitespace-nowrap">{dateLabel(row.dueDate)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">{money(row.total, row.currency)}</TableCell><TableCell className="whitespace-nowrap text-right tabular-nums">{money(row.amountPaid, row.currency)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right font-bold tabular-nums">{money(row.balance, row.currency)}</TableCell>
                        <TableCell><StatusBadge status={row.status} side={side} /></TableCell><TableCell><Button variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); setSelected(row); }}>Detalle</Button></TableCell>
                      </TableRow>)}</TableBody>
                    </Table>
                  </div>
                  <div className="grid grid-cols-1 gap-3 p-3 xl:hidden">
                    {rows.map((row) => <button key={row.id} type="button" onClick={() => setSelected(row)} className="min-w-0 rounded-2xl border border-border/60 bg-card p-4 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-border/50 pb-3">
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-bold">{row.partyName}</p>
                          {row.partyCode && <p className="mt-0.5 break-all text-xs text-muted-foreground">{row.partyCode}</p>}
                          <p className="mt-1 break-all font-mono text-xs text-primary">{row.number}</p>
                        </div>
                        <StatusBadge status={row.status} side={side} />
                      </div>
                      <div className="mt-3 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{docLabel[row.documentType] || 'Documento'}</span>
                        <span className="whitespace-nowrap">Emisión: {dateLabel(row.date)}</span>
                        <span className="whitespace-nowrap">Vencimiento: {dateLabel(row.dueDate)}</span>
                      </div>
                      <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 border-t border-border/50 pt-3 sm:grid-cols-3">
                        <MoneyField label="Total" value={row.total} currency={row.currency} />
                        <MoneyField label="Abonado" value={row.amountPaid} currency={row.currency} />
                        <MoneyField label="Saldo pendiente" value={row.balance} currency={row.currency} emphasized />
                      </div>
                    </button>)}
                  </div>
                  <div className="flex flex-col gap-3 border-t border-border/50 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>{totalRows ? `Mostrando ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, totalRows)} de ${totalRows}` : '0 documentos'}</span>
                    <div className="flex items-center gap-2 self-end sm:self-auto"><Button variant="outline" size="icon" className="size-9" aria-label="Página anterior" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}><ChevronLeft className="size-4" /></Button><span className="min-w-24 text-center text-xs font-semibold">Página {page} de {totalPages}</span><Button variant="outline" size="icon" className="size-9" aria-label="Página siguiente" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}><ChevronRight className="size-4" /></Button></div>
                  </div>
                </>}
        </CardContent>
      </Card>

      <AccountingBalanceDetailSheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }} document={selected} details={details.data} loading={details.isLoading} error={Boolean(details.error)} side={side} />
    </div>
  );
}

export function AccountingBalanceDetailSheet({ open, onOpenChange, document, details, loading, error, side, branchName }: {
  open: boolean; onOpenChange: (open: boolean) => void; document: AccountingBalanceDocument | null;
  details?: AccountingBalanceDetails; loading: boolean; error: boolean; side: AccountingBalanceSide; branchName?: string;
}) {
  const partyLabel = side === 'RECEIVABLES' ? 'Cliente' : 'Proveedor';
  const selected = details?.document || document;
  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="erp-detail-panel flex w-full min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
      <SheetHeader className="shrink-0 border-b border-border/60 px-5 py-5 pr-12 text-left sm:px-6">
        <div className="flex min-w-0 items-start gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileText className="size-5" /></div><div className="min-w-0"><SheetTitle className="truncate text-lg font-black">{document?.number || 'Detalle del documento'}</SheetTitle><SheetDescription className="mt-1">{docLabel[document?.documentType || ''] || 'Documento'} · {partyLabel.toLowerCase()} y aplicación de pagos</SheetDescription></div></div>
      </SheetHeader>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
        {branchName && <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm"><span className="text-muted-foreground">Sucursal:</span> <strong>{branchName}</strong></div>}
        {loading ? <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground"><RefreshCw className="size-4 animate-spin" />Cargando detalle…</div>
          : error ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">No se pudo consultar el detalle de este documento.</div>
            : selected ? <>
              <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailField label={partyLabel} value={selected.partyName} icon={<UserRound className="size-4" />} />
                <DetailField label="Estado" value={<StatusBadge status={selected.status} side={side} />} />
                <DetailField label="Fecha de emisión" value={dateLabel(selected.date)} icon={<CalendarDays className="size-4" />} />
                <DetailField label="Vencimiento" value={dateLabel(selected.dueDate)} icon={<CalendarDays className="size-4" />} />
                <MoneyField label="Total del documento" value={selected.total} currency={selected.currency} />
                <MoneyField label="Total abonado" value={selected.amountPaid} currency={selected.currency} />
                <MoneyField label="Saldo restante" value={selected.balance} currency={selected.currency} emphasized />
              </section>
              {selected.partyCode && <p className="text-xs text-muted-foreground">Código de {partyLabel.toLowerCase()}: {selected.partyCode}</p>}
              <section className="space-y-3"><SectionTitle title="Pagos y abonos" count={details?.payments.length || 0} />
                {details?.payments.length ? <div className="space-y-2">{details.payments.map((payment) => <div key={payment.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-xl border border-border/60 p-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{payment.number || 'Pago'}</p><p className="mt-1 break-words text-xs text-muted-foreground">{dateLabel(payment.date)} · {payment.method || '—'}{payment.reference ? ` · Ref. ${payment.reference}` : ''}</p></div><p className="whitespace-nowrap text-sm font-black tabular-nums">{money(payment.amount, payment.currency || selected.currency)}</p></div>)}</div>
                  : <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No hay pagos vinculados a este documento.</p>}
              </section>
              <section className="space-y-3"><SectionTitle title="Asientos contables relacionados" count={details?.journalEntries.length || 0} />
                {details?.journalEntries.length ? <div className="space-y-3">{details.journalEntries.map((entry) => <article key={entry.id} className="overflow-hidden rounded-xl border border-border/60"><div className="flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-border/50 bg-muted/20 px-3 py-3"><div className="min-w-0"><p className="font-mono text-sm font-bold">{entry.number}</p><p className="mt-1 break-words text-xs text-muted-foreground">{entry.description}</p></div><div className="flex shrink-0 items-center gap-2"><span className="text-xs text-muted-foreground">{dateLabel(entry.date)}</span><Badge variant="outline" className="text-[10px]">{journalStatusLabel(entry.status)}</Badge></div></div>
                    <div className="divide-y divide-border/40">{entry.lines.map((line) => <div key={line.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] gap-3 px-3 py-2.5 text-xs"><div className="min-w-0"><p className="truncate font-semibold">{line.account?.code || '—'} · {line.account?.name || 'Cuenta'}</p>{line.description && <p className="mt-1 break-words text-muted-foreground">{line.description}</p>}</div><div className="whitespace-nowrap text-right"><span className="block text-[9px] uppercase text-muted-foreground">Debe</span><span className="font-semibold tabular-nums">{money(line.debit, selected.currency)}</span></div><div className="whitespace-nowrap text-right"><span className="block text-[9px] uppercase text-muted-foreground">Haber</span><span className="font-semibold tabular-nums">{money(line.credit, selected.currency)}</span></div></div>)}</div>
                  </article>)}</div>
                  : <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No hay asientos directamente vinculados. El asiento puede depender de la configuración contable del documento.</p>}
              </section>
            </> : <p className="text-sm text-muted-foreground">Selecciona un documento para consultar sus pagos y asientos.</p>}
      </div>
    </SheetContent>
  </Sheet>;
}

function StatusBadge({ status, side }: { status: string; side: AccountingBalanceSide }) {
  const paid = status === 'PAID';
  return <Badge variant="outline" className={cn('min-w-0 max-w-full whitespace-normal break-words [overflow-wrap:anywhere]', paid ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600' : 'border-amber-500/30 bg-amber-500/10 text-amber-600')}>{paid ? 'Pagado' : side === 'RECEIVABLES' ? 'Por cobrar' : 'Por pagar'}</Badge>;
}

function journalStatusLabel(status?: string): string {
  const labels: Record<string, string> = { DRAFT: 'Borrador', POSTED: 'Contabilizado', VOIDED: 'Anulado' };
  return labels[String(status || '').toUpperCase()] || 'Sin estado';
}

function MoneyField({ label, value, currency, emphasized = false }: { label: string; value: unknown; currency?: string; emphasized?: boolean }) {
  return <div className="min-w-0 rounded-xl border border-border/50 bg-muted/10 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className={cn('mt-1 break-words text-sm tabular-nums', emphasized ? 'font-black text-primary' : 'font-semibold')}>{money(value, currency)}</p></div>;
}

function DetailField({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  return <div className="min-w-0 rounded-xl border border-border/50 bg-muted/10 p-3"><p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{icon}{label}</p><div className="mt-1 break-words text-sm font-semibold">{value}</div></div>;
}

function SectionTitle({ title, count }: { title: string; count: number }) {
  return <h3 className="flex items-center justify-between gap-2 text-sm font-black"><span>{title}</span><Badge variant="secondary" className="shrink-0">{count}</Badge></h3>;
}
