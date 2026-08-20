import { useEffect, useMemo, useState, type ReactNode } from 'react';
import * as XLSX from 'xlsx';
import { useManagerShellNavigation } from '../ManagerShell';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { enterpriseGroupsService, type ManagerSalesModuleResponse } from '../../services/enterprise-groups.service';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { CalendarDays, ChevronLeft, ChevronRight, CreditCard, Download, FileText, LayoutGrid, List, Loader2, Receipt, RefreshCw, Search, ShoppingCart, TrendingUp, Truck, UserRound, Users } from 'lucide-react';
import { cn } from '../ui/utils';
import { MANAGER_SALES_VIEWS, type ManagerSalesView } from './manager-sales.types';

type BranchOption = { id: string; name: string; businessUnitId?: string | null };
type LayoutMode = 'table' | 'cards';

const numberFormat = new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 });
const formatNumber = (value: unknown) => numberFormat.format(Number(value || 0));
const formatMoney = (value: unknown, currency = 'NIO') => `${currency} ${formatNumber(value)}`;
const formatDate = (value: unknown, includeTime = false) => {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-NI', includeTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' });
};

const viewLabels: Record<ManagerSalesView, string> = Object.fromEntries(MANAGER_SALES_VIEWS.map((item) => [item.id, item.label])) as Record<ManagerSalesView, string>;

const statusOptions: Partial<Record<ManagerSalesView, Array<{ value: string; label: string }>>> = {
  quotes: [{ value: 'DRAFT', label: 'Borrador' }, { value: 'SENT', label: 'Enviada' }, { value: 'APPROVED', label: 'Aprobada' }, { value: 'CANCELLED', label: 'Cancelada' }],
  orders: [{ value: 'DRAFT', label: 'Borrador' }, { value: 'CONFIRMED', label: 'Confirmada' }, { value: 'IN_PROGRESS', label: 'En proceso' }, { value: 'DELIVERED', label: 'Entregada' }, { value: 'CANCELLED', label: 'Cancelada' }],
  invoices: [{ value: 'PENDING', label: 'Pendiente' }, { value: 'PARTIAL', label: 'Parcial' }, { value: 'PAID', label: 'Pagada' }, { value: 'CREDIT', label: 'A crédito' }, { value: 'OVERDUE', label: 'Vencida' }, { value: 'CANCELLED', label: 'Cancelada' }],
  recurring: [{ value: 'ACTIVE', label: 'Activa' }, { value: 'PAUSED', label: 'Pausada' }, { value: 'EXPIRED', label: 'Vencida' }, { value: 'CANCELLED', label: 'Cancelada' }],
  payments: [{ value: 'CASH', label: 'Efectivo' }, { value: 'TRANSFER', label: 'Transferencia' }, { value: 'CHECK', label: 'Cheque' }, { value: 'CARD', label: 'Tarjeta' }],
  creditnotes: [{ value: 'ISSUED', label: 'Emitida' }, { value: 'PARTIAL', label: 'Parcial' }, { value: 'APPLIED', label: 'Aplicada' }, { value: 'PAID', label: 'Pagada' }, { value: 'VOIDED', label: 'Anulada' }],
  deliveries: [{ value: 'PENDING', label: 'Pendiente' }, { value: 'DELIVERED', label: 'Entregada' }],
  cash: [{ value: 'OPEN', label: 'Abierta' }, { value: 'CLOSING', label: 'En cierre' }, { value: 'CLOSED', label: 'Cerrada' }],
};

const statusLabel = (value: unknown) => String(value || '—').replaceAll('_', ' ');

export function ManagerSalesModule({ view, onViewChange, groupId, businessUnitId, branchId, branches }: { view: ManagerSalesView; onViewChange: (view: ManagerSalesView) => void; groupId: string; businessUnitId?: string; branchId?: string; branches: BranchOption[] }) {
  const { sidebarCollapsed } = useManagerShellNavigation();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [customerType, setCustomerType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('table');
  const [exporting, setExporting] = useState(false);
  const query = useTenantQuery<ManagerSalesModuleResponse>(
    ['manager-sales', groupId, view, businessUnitId || 'all', branchId || 'all', debouncedSearch, status, customerType, dateFrom, dateTo, page, pageSize],
    (signal) => enterpriseGroupsService.getSalesModule(groupId, { view, businessUnitId, branchId, search: debouncedSearch || undefined, status: status || undefined, customerType: customerType || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page, pageSize }, signal),
    { enabled: Boolean(groupId) && view !== 'pricelists' },
  );
  const response = query.data;
  const rows = response?.data || [];
  const metrics = response?.metrics || {};
  const multipleBranches = !branchId && branches.length > 1;
  const activeStatusOptions = statusOptions[view] || [];

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const changeView = (next: ManagerSalesView) => {
    setPage(1);
    setSearch('');
    setStatus('');
    setCustomerType('');
    setDateFrom('');
    setDateTo('');
    onViewChange(next);
  };

  const exportReport = async () => {
    if (view === 'pricelists') return;
    setExporting(true);
    try {
      const report = await enterpriseGroupsService.getSalesModule(groupId, { view, businessUnitId, branchId, search: search || undefined, status: status || undefined, customerType: customerType || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page: 1, pageSize: 5000, report: true });
      const workbook = XLSX.utils.book_new();
      const data = (report.data || []).map((row: any) => exportRow(view, row));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.length ? data : [{ Mensaje: 'Sin registros para el alcance seleccionado' }]), 'Ventas');
      XLSX.writeFile(workbook, `manager-ventas-${view}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return <div className="sales-module min-w-0 space-y-5 overflow-x-hidden p-4 sm:p-6 md:p-8">
    <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ShoppingCart className="size-6" /></div>
        <div className="min-w-0"><h1 className="truncate text-3xl font-black uppercase italic tracking-tighter sm:text-4xl">Ventas <span className="text-primary">consolidadas</span></h1><p className="mt-1 text-sm text-muted-foreground">Consulta comercial por rubro y sucursal, con trazabilidad del origen y sin modificar registros operativos.</p><Badge variant="outline" className="mt-3 border-primary/20 bg-primary/10 text-[10px] font-black uppercase tracking-widest text-primary">{branches.length} sucursal(es) en el alcance</Badge></div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button variant="outline" className="rounded-xl" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className={cn('mr-2 size-4', query.isFetching && 'animate-spin')} />Actualizar</Button>
        <Button variant="outline" className="rounded-xl" onClick={() => void exportReport()} disabled={exporting || view === 'pricelists'}>{exporting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}Exportar Excel</Button>
      </div>
    </div>

    {sidebarCollapsed && <div className="sales-subnav flex min-w-0 gap-2 overflow-x-auto rounded-2xl border border-border/60 bg-muted/30 p-1.5">{MANAGER_SALES_VIEWS.map((item) => <button key={item.id} type="button" onClick={() => changeView(item.id)} className={cn('flex-none rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wide text-muted-foreground transition-colors hover:bg-card hover:text-foreground', view === item.id && 'bg-primary text-primary-foreground shadow-sm')}><span className="sm:hidden">{item.label.slice(0, 3)}</span><span className="hidden sm:inline">{item.label}</span></button>)}</div>}

    {view === 'pricelists' ? <PriceListsPlaceholder /> : view === 'overview' ? <SalesOverview metrics={metrics} /> : <>
      <SalesFilters view={view} search={search} setSearch={(value) => { setSearch(value); setPage(1); }} status={status} setStatus={(value) => { setStatus(value); setPage(1); }} customerType={customerType} setCustomerType={(value) => { setCustomerType(value); setPage(1); }} dateFrom={dateFrom} setDateFrom={(value) => { setDateFrom(value); setPage(1); }} dateTo={dateTo} setDateTo={(value) => { setDateTo(value); setPage(1); }} statusOptions={activeStatusOptions} layoutMode={layoutMode} setLayoutMode={setLayoutMode} />
      <SalesKpis view={view} metrics={metrics} />
      {query.isLoading ? <LoadingState /> : query.error ? <EmptyState title="No se pudo cargar la vista" description="Verifica el permiso Manager de Ventas y vuelve a actualizar." /> : layoutMode === 'cards' ? <SalesCards view={view} rows={rows} showBranch={multipleBranches} /> : <SalesTable view={view} rows={rows} showBranch={multipleBranches} />}
      <Pagination page={response?.meta.page || page} totalPages={response?.meta.totalPages || 1} total={response?.meta.total || 0} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} />
    </>}
  </div>;
}

function SalesOverview({ metrics }: { metrics: Record<string, any> }) {
  const cards = [
    ['Clientes', metrics.customers, UserRound, 'text-primary bg-primary/10'],
    ['Cotizaciones', metrics.quotes, FileText, 'text-primary bg-primary/10'],
    ['Órdenes de venta', metrics.orders, ShoppingCart, 'text-primary bg-primary/10'],
    ['Facturas', metrics.invoices, Receipt, 'text-primary bg-primary/10'],
    ['Pagos recibidos', metrics.payments, CreditCard, 'text-primary bg-primary/10'],
    ['Entregas', metrics.deliveries, Truck, 'text-primary bg-primary/10'],
    ['Saldo de clientes', formatMoney(metrics.customerBalance), TrendingUp, 'text-primary bg-primary/10'],
    ['Facturado por caja', formatMoney(metrics.billed), Receipt, 'text-primary bg-primary/10'],
  ] as const;
  return <div className="space-y-5"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, Icon, tone]) => <Card key={label} className="rounded-2xl border-border/60 shadow-sm"><CardContent className="flex items-center gap-4 p-5"><div className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', tone)}><Icon className="size-5" /></div><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-1 truncate text-2xl font-black tracking-tight">{typeof value === 'number' ? formatNumber(value) : value || '0'}</p></div></CardContent></Card>)}</div><Card className="rounded-3xl border-primary/20 bg-primary/5"><CardHeader><CardTitle className="text-lg font-black uppercase italic tracking-tight">Lectura del alcance</CardTitle></CardHeader><CardContent className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3"><div><p className="text-muted-foreground">Sucursal con más clientes</p><p className="mt-1 font-black">{metrics.topBranchName || 'Sin datos'}{metrics.topBranchCount ? ` · ${formatNumber(metrics.topBranchCount)}` : ''}</p></div><div><p className="text-muted-foreground">Créditos pendientes</p><p className="mt-1 font-black">{formatNumber(metrics.credits || 0)}</p></div><div><p className="text-muted-foreground">Sesiones de caja</p><p className="mt-1 font-black">{formatNumber(metrics.cashSessions || 0)}</p></div></CardContent></Card></div>;
}

function SalesFilters({ view, search, setSearch, status, setStatus, customerType, setCustomerType, dateFrom, setDateFrom, dateTo, setDateTo, statusOptions, layoutMode, setLayoutMode }: { view: ManagerSalesView; search: string; setSearch: (value: string) => void; status: string; setStatus: (value: string) => void; customerType: string; setCustomerType: (value: string) => void; dateFrom: string; setDateFrom: (value: string) => void; dateTo: string; setDateTo: (value: string) => void; statusOptions: Array<{ value: string; label: string }>; layoutMode: LayoutMode; setLayoutMode: (value: LayoutMode) => void }) {
  const dateLabel = view === 'cash' ? 'Apertura desde' : 'Fecha desde';
  return <Card className="rounded-3xl border-border/60 shadow-sm"><CardContent className="grid min-w-0 grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_minmax(150px,0.7fr)_minmax(150px,0.7fr)_minmax(150px,0.7fr)_auto] xl:items-end"><label className="min-w-0 space-y-1.5 text-xs font-bold text-muted-foreground"><span>Buscar</span><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Número, cliente o referencia..." className="pl-9" /></div></label>{view === 'customers' ? <label className="space-y-1.5 text-xs font-bold text-muted-foreground"><span>Tipo de cliente</span><select value={customerType} onChange={(event) => setCustomerType(event.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal"><option value="">Todos</option><option value="INDIVIDUAL">Particulares</option><option value="COMPANY">Empresas</option></select></label> : <label className="space-y-1.5 text-xs font-bold text-muted-foreground"><span>{statusOptions.length ? (view === 'payments' ? 'Método' : 'Estado') : 'Estado'}</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal"><option value="">Todos</option>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}<DateInput label={dateLabel} value={dateFrom} onChange={setDateFrom} /><DateInput label="Fecha hasta" value={dateTo} onChange={setDateTo} /><div className="flex items-center justify-end gap-1 rounded-xl border border-border/60 bg-muted/20 p-1"><Button type="button" variant={layoutMode === 'table' ? 'secondary' : 'ghost'} size="icon" className="size-9 rounded-lg" onClick={() => setLayoutMode('table')} aria-label="Vista tabla"><List className="size-4" /></Button><Button type="button" variant={layoutMode === 'cards' ? 'secondary' : 'ghost'} size="icon" className="size-9 rounded-lg" onClick={() => setLayoutMode('cards')} aria-label="Vista tarjetas"><LayoutGrid className="size-4" /></Button></div></CardContent></Card>;
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="min-w-0 space-y-1.5 text-xs font-bold text-muted-foreground"><span>{label}</span><div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" /><Input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="pl-9" /></div></label>; }

function SalesKpis({ view, metrics }: { view: ManagerSalesView; metrics: Record<string, any> }) {
  const cards = useMemo(() => {
    const total = Number(metrics.total || 0);
    if (view === 'customers') return [['Clientes', total], ['Particulares', metrics.individuals], ['Empresas', metrics.companies], ['Saldo', formatMoney(metrics.balance)], ['Mayor recuento', metrics.topBranchName || 'Sin datos']];
    if (view === 'cash') return [['Sesiones', total], ['Abiertas', metrics.openSessions], ['Cerradas', metrics.closedSessions], ['Facturado', formatMoney(metrics.billed)], ['Hora media de cierre', metrics.averageClosingHour == null ? '—' : `${Number(metrics.averageClosingHour).toFixed(1)} h`]];
    if (view === 'credits') return [['Créditos', total], ['Saldo pendiente', formatMoney(metrics.amount)], ['Vencidos', metrics.overdue], ['Sucursal principal', metrics.topBranchName || 'Sin datos']];
    return [['Registros', total], ['Monto acumulado', formatMoney(metrics.amount)], ['Sucursal principal', metrics.topBranchName || 'Sin datos'], ['Registros principales', metrics.topBranchCount || 0]];
  }, [metrics, view]);
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-2 truncate text-xl font-black">{typeof value === 'number' ? formatNumber(value) : value || '0'}</p></div>)}</div>;
}

function SalesTable({ view, rows, showBranch }: { view: ManagerSalesView; rows: any[]; showBranch: boolean }) {
  const columns = tableColumns(view, showBranch);
  return <Card className="overflow-hidden rounded-3xl border-border/60 shadow-sm"><CardHeader className="border-b border-border/60"><CardTitle className="text-lg font-black uppercase italic tracking-tight">{viewLabels[view]}</CardTitle><p className="text-sm text-muted-foreground">Ordenado de lo más reciente a lo más antiguo. Los datos son de solo lectura.</p></CardHeader><CardContent className="p-0">{rows.length ? <div className="sales-responsive-table overflow-x-auto"><Table className="min-w-[980px]"><TableHeader><TableRow>{columns.map((column) => <TableHead key={column.label}>{column.label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}>{columns.map((column) => <TableCell key={`${row.id}-${column.label}`} className={cn('max-w-64', column.numeric && 'text-right font-semibold')}>{column.render(row)}</TableCell>)}</TableRow>)}</TableBody></Table></div> : <EmptyState title="Sin registros" description="No hay información para el rubro, sucursal y filtros seleccionados." />}</CardContent></Card>;
}

function SalesCards({ view, rows, showBranch }: { view: ManagerSalesView; rows: any[]; showBranch: boolean }) {
  if (!rows.length) return <EmptyState title="Sin registros" description="No hay información para el rubro, sucursal y filtros seleccionados." />;
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map((row) => <Card key={row.id} className="rounded-2xl border-border/60 shadow-sm"><CardContent className="space-y-3 p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-base font-black">{row.number || row.name || row.registerName || row.id.slice(0, 8)}</p><p className="text-xs text-muted-foreground">{row.customerName || row.status || viewLabels[view]}</p></div><Badge variant="outline" className="shrink-0">{statusLabel(row.status || row.deliveryStatus)}</Badge></div><div className="grid grid-cols-2 gap-2 text-sm"><div><p className="text-xs text-muted-foreground">Fecha</p><p className="font-semibold">{formatDate(row.date || row.openedAt || row.nextInvoiceDate)}</p></div><div><p className="text-xs text-muted-foreground">Monto</p><p className="font-black">{formatMoney(row.total ?? row.amount ?? row.balance ?? row.billed, row.currency)}</p></div></div>{showBranch && <Badge variant="secondary" className="max-w-full truncate">{row.branchName}</Badge>}</CardContent></Card>)}</div>;
}

type TableColumn = { label: string; numeric?: boolean; render: (row: any) => ReactNode };
function tableColumns(view: ManagerSalesView, showBranch: boolean): TableColumn[] {
  const branch = showBranch ? [{ label: 'Sucursal', render: (row: any) => <Badge variant="secondary" className="max-w-44 truncate">{row.branchName}</Badge> }] : [];
  if (view === 'customers') return [{ label: 'Código', render: (row) => <span className="font-mono font-bold">{row.code}</span> }, { label: 'Cliente', render: (row) => <span className="font-semibold">{row.name}</span> }, { label: 'Tipo', render: (row) => row.type === 'INDIVIDUAL' ? 'Particular' : 'Empresa' }, { label: 'Identificación', render: (row) => row.ruc || row.taxId || '—' }, { label: 'Saldo', numeric: true, render: (row) => formatMoney(row.balance) }, ...branch];
  if (view === 'quotes') return [{ label: 'Número', render: (row) => <span className="font-mono font-bold">{row.number}</span> }, { label: 'Fecha', render: (row) => formatDate(row.date) }, { label: 'Cliente', render: (row) => row.customerName }, { label: 'Estado', render: (row) => <Badge variant="outline">{statusLabel(row.status)}</Badge> }, { label: 'Total', numeric: true, render: (row) => formatMoney(row.total, row.currency) }, ...branch];
  if (view === 'orders') return [{ label: 'Número', render: (row) => <span className="font-mono font-bold">{row.number}</span> }, { label: 'Fecha', render: (row) => formatDate(row.date) }, { label: 'Cliente', render: (row) => row.customerName }, { label: 'Entrega', render: (row) => formatDate(row.expectedDelivery) }, { label: 'Estado', render: (row) => <Badge variant="outline">{statusLabel(row.status)}</Badge> }, { label: 'Total', numeric: true, render: (row) => formatMoney(row.total, row.currency) }, ...branch];
  if (view === 'invoices') return [{ label: 'Factura', render: (row) => <span className="font-mono font-bold">{row.number}</span> }, { label: 'Fecha', render: (row) => formatDate(row.date) }, { label: 'Cliente', render: (row) => row.customerName }, { label: 'Estado', render: (row) => <Badge variant="outline">{statusLabel(row.status)}</Badge> }, { label: 'Total', numeric: true, render: (row) => formatMoney(row.total, row.currency) }, { label: 'Saldo', numeric: true, render: (row) => formatMoney(row.balance, row.currency) }, ...branch];
  if (view === 'recurring') return [{ label: 'Contrato', render: (row) => <span className="font-mono font-bold">{row.number}</span> }, { label: 'Cliente', render: (row) => row.customerName }, { label: 'Frecuencia', render: (row) => statusLabel(row.frequency) }, { label: 'Próxima emisión', render: (row) => formatDate(row.nextInvoiceDate) }, { label: 'Estado', render: (row) => <Badge variant="outline">{statusLabel(row.status)}</Badge> }, { label: 'Total', numeric: true, render: (row) => formatMoney(row.total, row.currency) }, ...branch];
  if (view === 'payments') return [{ label: 'Pago', render: (row) => <span className="font-mono font-bold">{row.number}</span> }, { label: 'Fecha', render: (row) => formatDate(row.date) }, { label: 'Cliente', render: (row) => row.customerName }, { label: 'Método', render: (row) => statusLabel(row.method) }, { label: 'Documento', render: (row) => row.documentNumber || '—' }, { label: 'Monto', numeric: true, render: (row) => formatMoney(row.amount, row.currency) }, ...branch];
  if (view === 'creditnotes') return [{ label: 'Nota', render: (row) => <span className="font-mono font-bold">{row.number}</span> }, { label: 'Fecha', render: (row) => formatDate(row.date) }, { label: 'Cliente', render: (row) => row.customerName }, { label: 'Estado', render: (row) => <Badge variant="outline">{statusLabel(row.status)}</Badge> }, { label: 'Total', numeric: true, render: (row) => formatMoney(row.total, row.currency) }, { label: 'Saldo', numeric: true, render: (row) => formatMoney(row.balance, row.currency) }, ...branch];
  if (view === 'credits') return [{ label: 'Factura', render: (row) => <span className="font-mono font-bold">{row.number}</span> }, { label: 'Cliente', render: (row) => row.customerName }, { label: 'Vencimiento', render: (row) => formatDate(row.dueDate) }, { label: 'Estado', render: (row) => <Badge variant="outline">{statusLabel(row.status)}</Badge> }, { label: 'Saldo', numeric: true, render: (row) => formatMoney(row.balance, row.currency) }, ...branch];
  if (view === 'deliveries') return [{ label: 'Entrega', render: (row) => <span className="font-mono font-bold">{row.number}</span> }, { label: 'Fecha', render: (row) => formatDate(row.date) }, { label: 'Cliente', render: (row) => row.customerName }, { label: 'Facturación', render: (row) => row.billingBranchName }, { label: 'Entrega en', render: (row) => row.deliveryBranchName }, { label: 'Estado', render: (row) => <Badge variant="outline">{statusLabel(row.deliveryStatus)}</Badge> }, ...branch];
  return [{ label: 'Caja', render: (row) => <span className="font-semibold">{row.registerName} · {row.registerCode || '—'}</span> }, { label: 'Apertura', render: (row) => formatDate(row.openedAt, true) }, { label: 'Sucursal', render: (row) => row.branchName }, { label: 'Estado', render: (row) => <Badge variant="outline">{statusLabel(row.status)}</Badge> }, { label: 'Facturas', numeric: true, render: (row) => formatNumber(row.invoiceCount) }, { label: 'Diferencia NIO', numeric: true, render: (row) => formatMoney(row.differenceNIO) }];
}

function exportRow(view: ManagerSalesView, row: any) {
  const base = { Sucursal: row.branchName, Fecha: formatDate(row.date || row.openedAt || row.nextInvoiceDate), Estado: statusLabel(row.status || row.deliveryStatus) };
  if (view === 'customers') return { Código: row.code, Cliente: row.name, Tipo: row.type === 'INDIVIDUAL' ? 'Particular' : 'Empresa', Identificación: row.ruc || row.taxId, Saldo: row.balance, ...base };
  if (view === 'payments') return { Pago: row.number, Cliente: row.customerName, Método: row.method, Documento: row.documentNumber, Monto: row.amount, ...base };
  if (view === 'cash') return { Caja: row.registerName, Apertura: formatDate(row.openedAt, true), Facturas: row.invoiceCount, Diferencia: row.differenceNIO, ...base };
  if (view === 'deliveries') return { Entrega: row.number, Cliente: row.customerName, Facturación: row.billingBranchName, 'Entrega en': row.deliveryBranchName, Monto: row.total, ...base };
  return { Número: row.number, Cliente: row.customerName, Total: row.total, 'Saldo pendiente': row.balance, Moneda: row.currency, ...base };
}

function Pagination({ page, totalPages, total, pageSize, onPageChange, onPageSizeChange }: { page: number; totalPages: number; total: number; pageSize: number; onPageChange: (page: number) => void; onPageSizeChange: (pageSize: number) => void }) { return <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">{formatNumber(total)} registro(s) · Página {page} de {totalPages}</span><div className="flex flex-wrap items-center gap-2"><select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-9 rounded-lg border border-border bg-background px-2 text-xs"><option value={25}>25 por página</option><option value={50}>50 por página</option><option value={100}>100 por página</option></select><Button variant="outline" size="icon" className="size-9 rounded-lg" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Página anterior"><ChevronLeft className="size-4" /></Button><Button variant="outline" size="icon" className="size-9 rounded-lg" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Página siguiente"><ChevronRight className="size-4" /></Button></div></div>; }

function PriceListsPlaceholder() { return <Card className="rounded-3xl border-primary/20 bg-primary/5"><CardHeader><CardTitle className="flex items-center gap-2 text-xl font-black uppercase italic tracking-tight"><List className="size-5 text-primary" />Listas de precios</CardTitle></CardHeader><CardContent className="space-y-4 text-sm text-muted-foreground"><p>Esta vista queda preparada, pero no mezcla listas entre rubros porque cada rubro puede tener un catálogo y precios de venta diferentes.</p><div className="rounded-2xl border border-border/60 bg-card p-4"><p className="font-black text-foreground">Enfoque recomendado</p><p className="mt-2 leading-relaxed">Mostrar las listas únicamente después de seleccionar un rubro. Dentro del rubro se consolidan por código de lista, se comparan sus precios por sucursal y se conserva el precio de costo común. La edición o creación debe seguir ocurriendo dentro de la sucursal; el Manager solo consultará y exportará.</p></div></CardContent></Card>; }
function LoadingState() { return <div className="flex min-h-[240px] items-center justify-center rounded-3xl border border-border/60 bg-card text-muted-foreground"><RefreshCw className="mr-2 size-5 animate-spin" />Cargando información consolidada...</div>; }
function EmptyState({ title, description }: { title: string; description: string }) { return <div className="flex min-h-[180px] flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-card px-5 text-center"><Users className="size-8 text-muted-foreground/40" /><p className="mt-3 font-black">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>; }
