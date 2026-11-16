import { useMemo, useState } from 'react';
import { Banknote, CalendarClock, CircleDollarSign, Search, Wallet, AlertTriangle, ChevronLeft, ChevronRight, Plus, Eye } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Combobox } from '../ui/Combobox';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { SalesKpiCard } from './SalesKpiCard';
import { CustomerLoansPanel } from './CustomerLoansPanel';
import { CustomerCreditSettingsButton } from './CustomerCreditSettingsButton';
import { CustomerCreditPaymentDialog, type CustomerPaymentTarget } from './CustomerCreditPaymentDialog';
import { customersService, customerLoansService } from '../../services/ventas.service';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { formatCurrencyAmount } from '../../utils/currency';
import type { Customer, CustomerLoan } from '../../types';
import { toast } from '@/app/services/toast';

const readList = (response: any) => Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : [];
const statusLabel: Record<string, string> = { ISSUED: 'Activo', PARTIAL: 'Pago parcial', OVERDUE: 'Vencido', PAID: 'Liquidado' };
const statusClass: Record<string, string> = {
  ISSUED: 'border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  PARTIAL: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  OVERDUE: 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  PAID: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
};
const localDate = (value?: string | null) => {
  if (!value) return '—';
  const raw = String(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(raw);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' });
};
const currencyRows = (rows: Array<{ currency: string; amount: number }> | undefined, baseCurrency: string) => {
  const values = rows || [];
  return values.length ? values.map((row) => <span key={row.currency} className="block whitespace-nowrap">{formatCurrencyAmount(row.amount, row.currency)}</span>) : <span>{formatCurrencyAmount(0, baseCurrency)}</span>;
};

export function CustomerLoansView({ enabled, selectedBranchId, onRefresh }: { enabled: boolean; selectedBranchId?: string; onRefresh?: () => void }) {
  const { user, canPerform } = useAuth();
  const { baseCurrency } = useCurrency();
  const queryClient = useQueryClient();
  const tenantId = String(user?.clientTenantId || user?.tenantId || '');
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [selectedLoanRow, setSelectedLoanRow] = useState<any | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<CustomerPaymentTarget | null>(null);
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSearchDebounced] = useDebouncedValue(customerSearch, 250);
  const [createCustomer, setCreateCustomer] = useState<Customer | null>(null);
  const pageSize = 25;
  const canRead = canPerform('SALES_CUSTOMER_LOANS', 'view');
  const canPay = canPerform('SALES_CREDIT_NOTES', 'pay');
  const canCreateLoan = canPerform('SALES_INVOICES', 'create') && canPerform('SALES_INVOICES', 'submit');
  const canCreateMora = canPerform('SALES_CLIENTS', 'create');
  const canEditMora = canPerform('SALES_CLIENTS', 'edit');
  const canEditConfiguration = canPerform('SALES_CREDIT_NOTES', 'edit');

  const loansQuery = useTenantQuery<any>(
    ['sales', 'customer-loans', tenantId, selectedBranchId || 'all-branches', debouncedSearch, status, page, pageSize],
    (signal) => customerLoansService.getAll({
      ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
      ...(status !== 'ALL' ? { status } : {}),
      ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
      page,
      pageSize,
    }, signal),
    { enabled: Boolean(enabled && canRead && tenantId), onError: (error) => toast.error(error.message || 'No se pudieron cargar los préstamos.') },
  );
  const loanData = loansQuery.data || {};
  const loans = readList(loanData) as CustomerLoan[];
  const pagination = loanData.meta || {};
  const summary = loanData.summary || {};
  const totalPages = Math.max(1, Number(pagination.totalPages || 1));
  const customerLookup = useTenantQuery<any[]>(
    ['sales', 'customer-loan-customer-picker', tenantId, customerSearchDebounced],
    async (signal) => readList(await customersService.getLookup({ search: customerSearchDebounced || undefined, status: 'ACTIVE', page: 1, pageSize: 60 }, signal)),
    { enabled: Boolean(createCustomerOpen && canCreateLoan && tenantId), onError: (error) => toast.error(error.message || 'No se pudieron cargar los clientes.') },
  );
  const detailQuery = useTenantQuery<any>(
    ['sales', 'customer-loan-detail', tenantId, selectedLoanRow?.id],
    async (signal) => customerLoansService.getById(String(selectedLoanRow?.id || ''), signal),
    { enabled: Boolean(enabled && selectedLoanRow?.id), onError: (error) => toast.error(error.message || 'No se pudo cargar el préstamo.') },
  );
  const detail = detailQuery.data || selectedLoanRow;
  const customer = detail?.customer || selectedLoanRow?.customer;
  const isPayable = Boolean(detail && Number(detail.invoice?.balance ?? detail.balance ?? 0) > 0.01);
  const customerOptions = useMemo(() => (customerLookup.data || []).map((item: any) => ({
    value: String(item.id),
    label: String(item.name || 'Cliente'),
    description: [item.code, item.phone || item.contactPhone].filter(Boolean).join(' · '),
  })), [customerLookup.data]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['tenant-module', tenantId, 'sales', 'customer-loans'] });
    await queryClient.invalidateQueries({ queryKey: ['tenant-module', tenantId, 'sales', 'customer-loan-detail'] });
    onRefresh?.();
  };
  const openDetail = (row: CustomerLoan) => setSelectedLoanRow(row);
  const openPayment = () => {
    if (!detail) return;
    setPaymentTarget({
      id: detail.id,
      kind: 'CUSTOMER_LOAN',
      number: detail.invoice?.number || detail.number,
      total: detail.total,
      balance: detail.invoice?.balance ?? detail.balance,
      amountPaid: detail.invoice?.amountPaid,
      currency: detail.currency || detail.invoice?.currency,
      exchangeRate: detail.exchangeRate || detail.invoice?.exchangeRate,
      customerId: detail.customerId,
      customer: detail.customer,
      invoice: detail.invoice,
      planEnabled: detail.planEnabled,
      nextInstallment: detail.nextInstallment,
    });
  };

  if (!enabled || !canRead) return null;

  return <section className="min-w-0 max-w-full space-y-5 overflow-x-hidden" aria-label="Préstamos a clientes">
    <header className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Banknote className="size-6" /></div><div className="min-w-0"><h1 className="break-words text-lg font-black uppercase italic tracking-tight text-foreground sm:text-xl">Préstamos a clientes</h1><p className="text-xs text-muted-foreground">Cartera, cuotas, mora y desembolsos por sucursal.</p></div></div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <CustomerCreditSettingsButton canEdit={canEditConfiguration} />
        {canCreateLoan && <Button type="button" onClick={() => { setCustomerSearch(''); setCreateCustomerOpen(true); }} className="h-10 rounded-xl px-4"><Plus className="mr-2 size-4" /> Nuevo préstamo</Button>}
      </div>
    </header>

    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SalesKpiCard title="Contratos totales" icon={Banknote} value={Number(summary.totalContracts ?? pagination.total ?? 0).toLocaleString('es-NI')} />
      <SalesKpiCard title="Contratos activos" icon={CalendarClock} value={Number(summary.activeContracts ?? 0).toLocaleString('es-NI')} />
      <SalesKpiCard title="Saldo pendiente" icon={Wallet} value={currencyRows(summary.outstandingByCurrency, baseCurrency)} />
      <SalesKpiCard title="Saldo vencido" icon={AlertTriangle} value={currencyRows(summary.overdueByCurrency, baseCurrency)} tone={(summary.overdueByCurrency || []).some((row: any) => Number(row.amount) > 0) ? 'bad' : 'default'} />
    </div>

    <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm sm:p-5">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Buscar por cliente o número de préstamo…" className="h-10 max-w-full pl-10" /></div>
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:min-w-[360px]"><Label className="sr-only" htmlFor="customer-loan-status">Estado</Label><Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}><SelectTrigger id="customer-loan-status" className="max-w-full"><SelectValue placeholder="Todos los estados" /></SelectTrigger><SelectContent><SelectItem value="ALL">Todos los estados</SelectItem><SelectItem value="ISSUED">Activos</SelectItem><SelectItem value="PARTIAL">Pago parcial</SelectItem><SelectItem value="OVERDUE">Vencidos</SelectItem><SelectItem value="PAID">Liquidados</SelectItem></SelectContent></Select><p className="flex items-center text-xs text-muted-foreground">{Number(pagination.total || 0).toLocaleString('es-NI')} contratos</p></div>
      </div>
    </Card>

    <Card className="min-w-0 overflow-hidden rounded-2xl border-border/60 bg-card shadow-sm">
      {loansQuery.isPending ? <div role="status" className="p-10 text-center text-sm text-muted-foreground">Cargando préstamos…</div> : loansQuery.isError ? <div role="alert" className="flex flex-col items-center gap-3 p-10 text-center text-sm text-destructive"><p>No se pudo cargar la cartera.</p><Button type="button" variant="outline" onClick={() => void loansQuery.refetch()}>Reintentar</Button></div> : !loans.length ? <div className="p-10 text-center"><Banknote className="mx-auto size-8 text-muted-foreground/40" /><p className="mt-2 text-sm font-bold">Sin préstamos para mostrar</p><p className="mt-1 text-xs text-muted-foreground">Cambia los filtros o registra un préstamo nuevo.</p></div> : <div className="sales-responsive-table max-w-full overflow-x-auto">
        <Table className="min-w-[860px]">
          <TableHeader><TableRow><TableHead>Préstamo</TableHead><TableHead>Cliente</TableHead><TableHead>Fecha</TableHead><TableHead>Próxima cuota</TableHead><TableHead>Vencido</TableHead><TableHead>Saldo</TableHead><TableHead>Estado</TableHead><TableHead><span className="sr-only">Acciones</span></TableHead></TableRow></TableHeader>
          <TableBody>{loans.map((loan: any) => {
            const balance = Number(loan.invoice?.balance ?? loan.balance ?? 0);
            const rawStatus = String(loan.status || loan.invoice?.status || (balance <= 0.01 ? 'PAID' : 'ISSUED')).toUpperCase();
            const loanStatus = ['PENDING', 'CREDIT'].includes(rawStatus) ? 'ISSUED' : rawStatus;
            return <TableRow key={loan.id} className="cursor-pointer" onClick={() => openDetail(loan)} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDetail(loan); } }}>
              <TableCell className="font-semibold text-primary">{loan.invoice?.number || loan.number || '—'}</TableCell>
              <TableCell className="max-w-[240px] whitespace-normal break-words">{loan.customer?.name || 'Cliente'}</TableCell>
              <TableCell>{localDate(loan.invoice?.date || loan.disbursedAt || loan.createdAt)}</TableCell>
              <TableCell>{loan.nextInstallment ? `${localDate(loan.nextInstallment.dueDate)} · ${formatCurrencyAmount(loan.nextInstallment.remainingAmount, loan.currency || baseCurrency)}` : '—'}</TableCell>
              <TableCell className="font-semibold text-rose-600 dark:text-rose-400">{formatCurrencyAmount(loan.overdueBalance || 0, loan.currency || baseCurrency)}</TableCell>
              <TableCell className="font-black tabular-nums">{formatCurrencyAmount(balance, loan.currency || baseCurrency)}</TableCell>
              <TableCell><Badge variant="outline" className={statusClass[loanStatus] || statusClass.ISSUED}>{statusLabel[loanStatus] || loanStatus}</Badge></TableCell>
              <TableCell><Button type="button" size="icon" variant="ghost" className="size-8" aria-label={`Ver préstamo ${loan.invoice?.number || loan.number || ''}`} onClick={(event) => { event.stopPropagation(); openDetail(loan); }}><Eye className="size-4" /></Button></TableCell>
            </TableRow>;
          })}</TableBody>
        </Table>
      </div>}
      {!loansQuery.isPending && !loansQuery.isError && totalPages > 1 && <div className="flex items-center justify-between gap-3 border-t border-border/50 px-4 py-3"><p className="text-xs text-muted-foreground">Página {page} de {totalPages}</p><div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loansQuery.isFetching}><ChevronLeft className="size-4" /> Anterior</Button><Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || loansQuery.isFetching}>Siguiente <ChevronRight className="size-4" /></Button></div></div>}
    </Card>

    <Sheet open={Boolean(selectedLoanRow)} onOpenChange={(open) => !open && setSelectedLoanRow(null)}>
      <SheetContent side="right" className="flex h-[100dvh] w-[min(100vw,900px)] max-w-full flex-col overflow-hidden p-0">
        <SheetHeader className="shrink-0 border-b border-border/50 p-5 pr-12"><SheetTitle className="text-left">Detalle del préstamo</SheetTitle></SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {detailQuery.isPending ? <p role="status" className="p-8 text-center text-sm text-muted-foreground">Cargando detalle…</p> : detailQuery.isError ? <p role="alert" className="p-8 text-center text-sm text-destructive">No se pudo cargar el detalle del préstamo.</p> : detail && <div className="min-w-0 space-y-4">
            <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="break-all text-lg font-black text-foreground">{detail.invoice?.number || detail.number || 'Préstamo'}</p><p className="mt-1 text-sm text-muted-foreground">{customer?.name || 'Cliente'} · {localDate(detail.invoice?.date || detail.disbursedAt)}</p><p className="mt-2 text-xl font-black text-primary">Saldo: {formatCurrencyAmount(detail.invoice?.balance ?? detail.balance ?? 0, detail.currency || baseCurrency)}</p></div>{canPay && isPayable && <Button type="button" onClick={openPayment} className="shrink-0"><CircleDollarSign className="mr-2 size-4" /> Registrar abono</Button>}</div>
            <CustomerLoansPanel customerId={detail.customerId} customerName={customer?.name || 'Cliente'} moraTypeId={customer?.moraTypeId} moraType={customer?.moraType} enabled={enabled && Boolean(detail.customerId)} canCreateLoan={canCreateLoan} canCreateMora={canCreateMora} canEditMora={canEditMora} onUpdated={() => void invalidate()} focusLoanId={detail.id} />
          </div>}
        </div>
      </SheetContent>
    </Sheet>

    <Dialog open={createCustomerOpen} onOpenChange={setCreateCustomerOpen}>
      <DialogContent className="w-[calc(100%-1rem)] rounded-2xl sm:max-w-lg">
        <DialogHeader><DialogTitle>Seleccionar cliente</DialogTitle><DialogDescription>El nuevo préstamo se registrará para este cliente y conservará el flujo de desembolso actual.</DialogDescription></DialogHeader>
        <div className="space-y-1.5"><Label htmlFor="loan-customer-search">Cliente</Label><Input id="loan-customer-search" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Buscar cliente…" /><Combobox options={customerOptions} value="" onChange={(id) => {
          const selected = (customerLookup.data || []).find((item: any) => String(item.id) === id);
          if (!selected) return;
          setCreateCustomerOpen(false);
          void customersService.getById(String(selected.id)).then((fullCustomer) => setCreateCustomer(fullCustomer as Customer)).catch(() => setCreateCustomer(selected as Customer));
        }} placeholder={customerLookup.isPending ? 'Cargando clientes…' : 'Seleccionar cliente'} /></div>
        {customerLookup.isError && <p role="alert" className="text-xs text-destructive">No se pudieron cargar los clientes.</p>}
        <DialogFooter><Button type="button" variant="outline" onClick={() => setCreateCustomerOpen(false)}>Cancelar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    {createCustomer && canCreateLoan && <CustomerLoansPanel customerId={createCustomer.id} customerName={createCustomer.name} moraTypeId={createCustomer.moraTypeId} moraType={createCustomer.moraType as any} enabled={enabled} canCreateLoan canCreateMora={canCreateMora} canEditMora={canEditMora} dialogOnly initialCreateOpen onUpdated={() => { setCreateCustomer(null); void invalidate(); }} />}
    <CustomerCreditPaymentDialog target={paymentTarget} open={Boolean(paymentTarget)} onOpenChange={(open) => !open && setPaymentTarget(null)} onPaid={() => { setPaymentTarget(null); void invalidate(); }} />
  </section>;
}
