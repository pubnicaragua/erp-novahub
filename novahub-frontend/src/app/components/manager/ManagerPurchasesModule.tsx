import { useEffect, useMemo, useState, type ReactNode } from 'react';
import * as XLSX from 'xlsx';
import { useManagerShellNavigation } from '../ManagerShell';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { enterpriseGroupsService, type ManagerPurchasesModuleResponse } from '../../services/enterprise-groups.service';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Banknote, CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList, CreditCard, Download, FileText, LayoutDashboard, LayoutGrid, List, Loader2, PackageCheck, Receipt, RefreshCw, Search, Tags, Truck, UserRound, Users, WalletCards } from 'lucide-react';
import { cn } from '../ui/utils';
import { MANAGER_PURCHASES_VIEWS, type ManagerPurchasesView } from './manager-purchases.types';

type BranchOption = { id: string; name: string; businessUnitId?: string | null };
type LayoutMode = 'table' | 'cards';
type Column = { label: string; numeric?: boolean; render: (row: any) => ReactNode };

const numberFormat = new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 });
const formatNumber = (value: unknown) => numberFormat.format(Number(value || 0));
const formatMoney = (value: unknown, currency = 'NIO') => `${currency} ${formatNumber(value)}`;
const formatDate = (value: unknown, includeTime = false) => {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-NI', includeTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' });
};
const statusLabel = (value: unknown) => String(value || '—').replaceAll('_', ' ');
const viewLabels: Record<ManagerPurchasesView, string> = Object.fromEntries(MANAGER_PURCHASES_VIEWS.map((item) => [item.id, item.label])) as Record<ManagerPurchasesView, string>;

const statusOptions: Partial<Record<ManagerPurchasesView, Array<{ value: string; label: string }>>> = {
  orders: [{ value: 'DRAFT', label: 'Borrador' }, { value: 'PENDING', label: 'Pendiente' }, { value: 'APPROVED', label: 'Aprobada' }, { value: 'CANCELLED', label: 'Cancelada' }],
  receipts: [{ value: 'PENDING', label: 'Pendiente' }, { value: 'RECEIVED', label: 'Recibida' }, { value: 'PARTIAL', label: 'Parcial' }, { value: 'REJECTED', label: 'Rechazada' }, { value: 'WITH_INCIDENTS', label: 'Con incidencias' }],
  invoices: [{ value: 'PENDING', label: 'Pendiente' }, { value: 'PARTIAL', label: 'Parcial' }, { value: 'PAID', label: 'Pagada' }, { value: 'OVERDUE', label: 'Vencida' }, { value: 'CANCELLED', label: 'Cancelada' }],
  recurring: [{ value: 'ACTIVE', label: 'Activa' }, { value: 'PAUSED', label: 'Pausada' }, { value: 'EXPIRED', label: 'Vencida' }, { value: 'CANCELLED', label: 'Cancelada' }],
  payments: [{ value: 'CASH', label: 'Efectivo' }, { value: 'TRANSFER', label: 'Transferencia' }, { value: 'CHECK', label: 'Cheque' }, { value: 'CARD', label: 'Tarjeta' }, { value: 'OTHER', label: 'Otro' }],
  credits: [{ value: 'DRAFT', label: 'Borrador' }, { value: 'ISSUED', label: 'Emitido' }, { value: 'APPLIED', label: 'Aplicado' }, { value: 'PAID', label: 'Pagado' }, { value: 'VOIDED', label: 'Anulado' }],
  expenses: [{ value: 'DRAFT', label: 'Borrador' }, { value: 'PENDING', label: 'Pendiente' }, { value: 'APPROVED', label: 'Aprobado' }, { value: 'PAID', label: 'Pagado' }, { value: 'REJECTED', label: 'Rechazado' }],
  recurringexpenses: [{ value: 'ACTIVE', label: 'Activa' }, { value: 'PAUSED', label: 'Pausada' }, { value: 'EXPIRED', label: 'Vencida' }, { value: 'CANCELLED', label: 'Cancelada' }],
  requests: [{ value: 'DRAFT', label: 'Borrador' }, { value: 'PENDING_APPROVAL', label: 'Pendiente de aprobación' }, { value: 'APPROVED', label: 'Aprobada' }, { value: 'REJECTED', label: 'Rechazada' }, { value: 'CLOSED', label: 'Cerrada' }, { value: 'CANCELLED', label: 'Cancelada' }],
  management: [{ value: 'DRAFT', label: 'Borrador' }, { value: 'PENDING_APPROVAL', label: 'Pendiente de aprobación' }, { value: 'APPROVED', label: 'Aprobada' }, { value: 'REJECTED', label: 'Rechazada' }, { value: 'CONVERTED_TO_ORDER', label: 'Convertida a orden' }],
};

export function ManagerPurchasesModule({ view, onViewChange, groupId, businessUnitId, branchId, branches }: { view: ManagerPurchasesView; onViewChange: (view: ManagerPurchasesView) => void; groupId: string; businessUnitId?: string; branchId?: string; branches: BranchOption[] }) {
  const { sidebarCollapsed } = useManagerShellNavigation();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [supplierType, setSupplierType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('table');
  const [exporting, setExporting] = useState(false);
  const query = useTenantQuery<ManagerPurchasesModuleResponse>(
    ['manager-purchases', groupId, view, businessUnitId || 'all', branchId || 'all', debouncedSearch, status, supplierType, dateFrom, dateTo, page, pageSize],
    (signal) => enterpriseGroupsService.getPurchasesModule(groupId, { view, businessUnitId, branchId, search: debouncedSearch || undefined, status: view === 'payments' ? undefined : status || undefined, method: view === 'payments' ? status || undefined : undefined, supplierType: supplierType || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page, pageSize }, signal),
    { enabled: Boolean(groupId) },
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

  const changeView = (next: ManagerPurchasesView) => {
    setPage(1); setSearch(''); setStatus(''); setSupplierType(''); setDateFrom(''); setDateTo(''); onViewChange(next);
  };

  const exportReport = async () => {
    setExporting(true);
    try {
      const report = await enterpriseGroupsService.getPurchasesModule(groupId, { view, businessUnitId, branchId, search: search || undefined, status: view === 'payments' ? undefined : status || undefined, method: view === 'payments' ? status || undefined : undefined, supplierType: supplierType || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page: 1, pageSize: 5000, report: true });
      const workbook = XLSX.utils.book_new();
      const data = (report.data || []).map((row: any) => exportRow(view, row));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.length ? data : [{ Mensaje: 'Sin registros para el alcance seleccionado' }]), 'Compras');
      XLSX.writeFile(workbook, `manager-compras-${view}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return <div className="purchases-module min-w-0 space-y-5 overflow-x-hidden p-4 sm:p-6 md:p-8">
    <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Truck className="size-6" /></div>
        <div className="min-w-0"><h1 className="truncate text-3xl font-black uppercase italic tracking-tighter sm:text-4xl">Compras <span className="text-primary">consolidadas</span></h1><p className="mt-1 text-sm text-muted-foreground">Consulta proveedores, abastecimiento y compromisos de compra por rubro y sucursal.</p><Badge variant="outline" className="mt-3 border-primary/20 bg-primary/10 text-[10px] font-black uppercase tracking-widest text-primary">{branches.length} sucursal(es) en el alcance</Badge></div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2"><Button variant="outline" className="rounded-xl" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className={cn('mr-2 size-4', query.isFetching && 'animate-spin')} />Actualizar</Button><Button variant="outline" className="rounded-xl" onClick={() => void exportReport()} disabled={exporting}>{exporting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}Exportar Excel</Button></div>
    </div>

    {sidebarCollapsed && <div className="manager-module-subnav flex min-w-0 gap-2 overflow-x-auto rounded-2xl border border-border/60 bg-muted/30 p-1.5">{MANAGER_PURCHASES_VIEWS.map((item) => <button key={item.id} type="button" onClick={() => changeView(item.id)} className={cn('flex-none rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wide text-muted-foreground transition-colors hover:bg-card hover:text-foreground', view === item.id && 'bg-primary text-primary-foreground shadow-sm')}><span className="sm:hidden">{item.label.slice(0, 3)}</span><span className="hidden sm:inline">{item.label}</span></button>)}</div>}

    {view === 'overview' ? <PurchasesOverview metrics={metrics} /> : <>
      <PurchaseFilters view={view} search={search} setSearch={(value) => { setSearch(value); setPage(1); }} status={status} setStatus={(value) => { setStatus(value); setPage(1); }} supplierType={supplierType} setSupplierType={(value) => { setSupplierType(value); setPage(1); }} dateFrom={dateFrom} setDateFrom={(value) => { setDateFrom(value); setPage(1); }} dateTo={dateTo} setDateTo={(value) => { setDateTo(value); setPage(1); }} statusOptions={activeStatusOptions} layoutMode={layoutMode} setLayoutMode={setLayoutMode} />
      <PurchaseKpis view={view} metrics={metrics} />
      {query.isLoading ? <LoadingState /> : query.error ? <EmptyState title="No se pudo cargar la vista" description="Verifica el permiso Manager de Compras y vuelve a actualizar." /> : layoutMode === 'cards' ? <PurchaseCards view={view} rows={rows} showBranch={multipleBranches} /> : <PurchaseTable view={view} rows={rows} showBranch={multipleBranches} />}
      <Pagination page={response?.meta.page || page} totalPages={response?.meta.totalPages || 1} total={response?.meta.total || 0} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} />
    </>}
  </div>;
}

function PurchasesOverview({ metrics }: { metrics: Record<string, any> }) {
  const cards = [
    ['Proveedores', metrics.suppliers, Users, 'text-primary bg-primary/10'], ['Órdenes de compra', metrics.orders, ClipboardList, 'text-primary bg-primary/10'], ['Recepciones', metrics.receipts, PackageCheck, 'text-primary bg-primary/10'], ['Facturas de proveedor', metrics.invoices, Receipt, 'text-primary bg-primary/10'], ['Pagos realizados', metrics.payments, CreditCard, 'text-primary bg-primary/10'], ['Gastos', metrics.expenses, WalletCards, 'text-primary bg-primary/10'], ['Compras ordenadas', formatMoney(metrics.orderedAmount), Truck, 'text-primary bg-primary/10'], ['Saldo a proveedores', formatMoney(metrics.supplierBalance), Banknote, 'text-primary bg-primary/10'],
  ] as const;
  return <div className="space-y-5"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, Icon, tone]) => <Card key={label} className="rounded-2xl border-border/60 shadow-sm"><CardContent className="flex items-center gap-4 p-5"><div className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', tone)}><Icon className="size-5" /></div><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-1 truncate text-2xl font-black tracking-tight">{typeof value === 'number' ? formatNumber(value) : value || '0'}</p></div></CardContent></Card>)}</div><Card className="rounded-3xl border-primary/20 bg-primary/5"><CardHeader><CardTitle className="text-lg font-black uppercase italic tracking-tight">Lectura del abastecimiento</CardTitle></CardHeader><CardContent className="grid grid-cols-1 gap-4 text-sm md:grid-cols-4"><div><p className="text-muted-foreground">Sucursal con más órdenes</p><p className="mt-1 font-black">{metrics.topBranchName || 'Sin datos'}{metrics.topBranchCount ? ` · ${formatNumber(metrics.topBranchCount)}` : ''}</p></div><div><p className="text-muted-foreground">Facturado por proveedores</p><p className="mt-1 font-black">{formatMoney(metrics.invoicedAmount)}</p></div><div><p className="text-muted-foreground">Saldo pendiente</p><p className="mt-1 font-black">{formatMoney(metrics.invoiceBalance)}</p></div><div><p className="text-muted-foreground">Pagos registrados</p><p className="mt-1 font-black">{formatMoney(metrics.paidAmount)}</p></div></CardContent></Card></div>;
}

function PurchaseFilters({ view, search, setSearch, status, setStatus, supplierType, setSupplierType, dateFrom, setDateFrom, dateTo, setDateTo, statusOptions, layoutMode, setLayoutMode }: { view: ManagerPurchasesView; search: string; setSearch: (value: string) => void; status: string; setStatus: (value: string) => void; supplierType: string; setSupplierType: (value: string) => void; dateFrom: string; setDateFrom: (value: string) => void; dateTo: string; setDateTo: (value: string) => void; statusOptions: Array<{ value: string; label: string }>; layoutMode: LayoutMode; setLayoutMode: (value: LayoutMode) => void }) {
  return <Card className="rounded-3xl border-border/60 shadow-sm"><CardContent className="grid min-w-0 grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_minmax(150px,0.7fr)_minmax(150px,0.7fr)_minmax(150px,0.7fr)_auto] xl:items-end"><label className="min-w-0 space-y-1.5 text-xs font-bold text-muted-foreground"><span>Buscar</span><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={view === 'suppliers' ? 'Código, proveedor, RUC...' : 'Número, proveedor o referencia...'} className="pl-9" /></div></label>{view === 'suppliers' ? <label className="space-y-1.5 text-xs font-bold text-muted-foreground"><span>Tipo de proveedor</span><select value={supplierType} onChange={(event) => setSupplierType(event.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal"><option value="">Todos</option><option value="COMPANY">Empresas</option><option value="INDIVIDUAL">Particulares</option></select></label> : <label className="space-y-1.5 text-xs font-bold text-muted-foreground"><span>{view === 'payments' ? 'Método de pago' : 'Estado'}</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal"><option value="">Todos</option>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}<DateInput label="Fecha desde" value={dateFrom} onChange={setDateFrom} /><DateInput label="Fecha hasta" value={dateTo} onChange={setDateTo} /><div className="flex items-center justify-end gap-1 rounded-xl border border-border/60 bg-muted/20 p-1"><Button type="button" variant={layoutMode === 'table' ? 'secondary' : 'ghost'} size="icon" className="size-9 rounded-lg" onClick={() => setLayoutMode('table')} aria-label="Vista tabla"><List className="size-4" /></Button><Button type="button" variant={layoutMode === 'cards' ? 'secondary' : 'ghost'} size="icon" className="size-9 rounded-lg" onClick={() => setLayoutMode('cards')} aria-label="Vista tarjetas"><LayoutGrid className="size-4" /></Button></div></CardContent></Card>;
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="min-w-0 space-y-1.5 text-xs font-bold text-muted-foreground"><span>{label}</span><div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" /><Input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="pl-9" /></div></label>; }

function PurchaseKpis({ view, metrics }: { view: ManagerPurchasesView; metrics: Record<string, any> }) {
  const cards = useMemo(() => {
    const total = Number(metrics.total || 0);
    if (view === 'suppliers') return [['Proveedores', total], ['Empresas', metrics.companies], ['Particulares', metrics.individuals], ['Saldo', formatMoney(metrics.balance)]];
    if (view === 'invoices') return [['Facturas', total], ['Total facturado', formatMoney(metrics.amount)], ['Pagado', formatMoney(metrics.paidTotal)], ['Saldo pendiente', formatMoney(metrics.pendingBalance)]];
    if (view === 'payments') return [['Pagos', total], ['Monto pagado', formatMoney(metrics.amount)], ['Sucursal principal', metrics.topBranchName || 'Sin datos'], ['Registros principales', metrics.topBranchCount || 0]];
    if (view === 'expenses' || view === 'recurringexpenses') return [['Registros', total], ['Monto acumulado', formatMoney(metrics.amount)], ['Sucursal principal', metrics.topBranchName || 'Sin datos'], ['Registros principales', metrics.topBranchCount || 0]];
    return [['Registros', total], ['Monto acumulado', formatMoney(metrics.amount)], ['Sucursal principal', metrics.topBranchName || 'Sin datos'], ['Registros principales', metrics.topBranchCount || 0]];
  }, [metrics, view]);
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-2 truncate text-xl font-black">{typeof value === 'number' ? formatNumber(value) : value || '0'}</p></div>)}</div>;
}

function PurchaseTable({ view, rows, showBranch }: { view: ManagerPurchasesView; rows: any[]; showBranch: boolean }) {
  const columns = tableColumns(view, showBranch);
  return <Card className="overflow-hidden rounded-3xl border-border/60 shadow-sm"><CardHeader className="border-b border-border/60"><CardTitle className="text-lg font-black uppercase italic tracking-tight">{viewLabels[view]}</CardTitle><p className="text-sm text-muted-foreground">Ordenado de lo más reciente a lo más antiguo. Los datos son de solo lectura.</p></CardHeader><CardContent className="p-0">{rows.length ? <div className="sales-responsive-table overflow-x-auto"><Table className="min-w-[980px]"><TableHeader><TableRow>{columns.map((column) => <TableHead key={column.label}>{column.label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}>{columns.map((column) => <TableCell key={`${row.id}-${column.label}`} className={cn('max-w-64', column.numeric && 'text-right font-semibold')}>{column.render(row)}</TableCell>)}</TableRow>)}</TableBody></Table></div> : <EmptyState title="Sin registros" description="No hay información para el rubro, sucursal y filtros seleccionados." />}</CardContent></Card>;
}

function PurchaseCards({ view, rows, showBranch }: { view: ManagerPurchasesView; rows: any[]; showBranch: boolean }) {
  if (!rows.length) return <EmptyState title="Sin registros" description="No hay información para el rubro, sucursal y filtros seleccionados." />;
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map((row) => <Card key={row.id} className="rounded-2xl border-border/60 shadow-sm"><CardContent className="space-y-3 p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-base font-black">{row.number || row.name || row.id.slice(0, 8)}</p><p className="text-xs text-muted-foreground">{row.supplierName || row.category || viewLabels[view]}</p></div>{row.status && <Badge variant="outline" className="shrink-0 capitalize">{statusLabel(row.status)}</Badge>}</div><div className="grid grid-cols-2 gap-2 text-sm"><div><p className="text-xs text-muted-foreground">Fecha</p><p className="font-semibold">{formatDate(row.date || row.createdAt || row.nextExecutionDate)}</p></div><div><p className="text-xs text-muted-foreground">Monto</p><p className="font-black">{formatMoney(row.total ?? row.amount ?? row.unitPrice, row.currency)}</p></div></div>{showBranch && <p className="border-t border-border/60 pt-2 text-xs font-semibold text-primary">{row.branchName || 'Sucursal'}</p>}</CardContent></Card>)}</div>;
}

function tableColumns(view: ManagerPurchasesView, showBranch: boolean): Column[] {
  const branch = (row: any) => <span className="font-semibold text-primary">{row.branchName || 'Sucursal'}</span>;
  const columns: Record<ManagerPurchasesView, Column[]> = {
    overview: [],
    suppliers: [{ label: 'Código', render: (row) => row.code || '—' }, { label: 'Proveedor', render: (row) => <span className="font-semibold">{row.name}</span> }, { label: 'Tipo', render: (row) => row.type === 'INDIVIDUAL' ? 'Particular' : 'Empresa' }, { label: 'Contacto', render: (row) => row.email || row.phone || '—' }, { label: 'Saldo', numeric: true, render: (row) => formatMoney(row.balance, row.currency) }, { label: 'Estado', render: (row) => <Badge variant="outline" className="capitalize">{statusLabel(row.status)}</Badge> }],
    orders: [{ label: 'Orden', render: (row) => <span className="font-semibold">{row.number}</span> }, { label: 'Fecha', render: (row) => formatDate(row.date) }, { label: 'Proveedor', render: (row) => row.supplierName }, { label: 'Tipo', render: (row) => statusLabel(row.purchaseType) }, { label: 'Estado', render: (row) => <Badge variant="outline" className="capitalize">{statusLabel(row.status)}</Badge> }, { label: 'Entrega', render: (row) => formatDate(row.expectedDelivery) }, { label: 'Total', numeric: true, render: (row) => formatMoney(row.total, row.currency) }],
    receipts: [{ label: 'Recepción', render: (row) => <span className="font-semibold">{row.number}</span> }, { label: 'Fecha', render: (row) => formatDate(row.date) }, { label: 'Orden', render: (row) => row.purchaseOrderNumber }, { label: 'Proveedor', render: (row) => row.supplierName }, { label: 'Estado', render: (row) => <Badge variant="outline" className="capitalize">{statusLabel(row.status)}</Badge> }, { label: 'Total', numeric: true, render: (row) => formatMoney(row.total, row.currency) }, { label: 'Inventario', render: (row) => row.inventoryProcessedAt ? 'Procesado' : 'Pendiente' }],
    invoices: [{ label: 'Factura', render: (row) => <span className="font-semibold">{row.number}</span> }, { label: 'Fecha', render: (row) => formatDate(row.date) }, { label: 'Vencimiento', render: (row) => formatDate(row.dueDate) }, { label: 'Proveedor', render: (row) => row.supplierName }, { label: 'Estado', render: (row) => <Badge variant="outline" className="capitalize">{statusLabel(row.status)}</Badge> }, { label: 'Total', numeric: true, render: (row) => formatMoney(row.total, row.currency) }, { label: 'Saldo', numeric: true, render: (row) => formatMoney(row.balance, row.currency) }],
    recurring: [{ label: 'Registro', render: (row) => <span className="font-semibold">{row.number}</span> }, { label: 'Próxima', render: (row) => formatDate(row.nextInvoiceDate) }, { label: 'Proveedor', render: (row) => row.supplierName }, { label: 'Frecuencia', render: (row) => statusLabel(row.frequency) }, { label: 'Estado', render: (row) => <Badge variant="outline" className="capitalize">{statusLabel(row.status)}</Badge> }, { label: 'Total', numeric: true, render: (row) => formatMoney(row.total, row.currency) }],
    payments: [{ label: 'Pago', render: (row) => <span className="font-semibold">{row.number}</span> }, { label: 'Fecha', render: (row) => formatDate(row.date) }, { label: 'Proveedor', render: (row) => row.supplierName }, { label: 'Factura', render: (row) => row.invoiceNumber }, { label: 'Método', render: (row) => statusLabel(row.method) }, { label: 'Referencia', render: (row) => row.reference || '—' }, { label: 'Monto', numeric: true, render: (row) => formatMoney(row.amount, row.currency) }],
    credits: [{ label: 'Crédito', render: (row) => <span className="font-semibold">{row.number}</span> }, { label: 'Fecha', render: (row) => formatDate(row.date) }, { label: 'Proveedor', render: (row) => row.supplierName }, { label: 'Factura', render: (row) => row.invoiceNumber }, { label: 'Estado', render: (row) => <Badge variant="outline" className="capitalize">{statusLabel(row.status)}</Badge> }, { label: 'Motivo', render: (row) => row.reason || '—' }, { label: 'Total', numeric: true, render: (row) => formatMoney(row.total, row.currency) }],
    expenses: [{ label: 'Gasto', render: (row) => <span className="font-semibold">{row.number}</span> }, { label: 'Fecha', render: (row) => formatDate(row.date) }, { label: 'Proveedor', render: (row) => row.supplierName || row.paidTo || '—' }, { label: 'Categoría', render: (row) => row.category || '—' }, { label: 'Descripción', render: (row) => row.description || '—' }, { label: 'Estado', render: (row) => <Badge variant="outline" className="capitalize">{statusLabel(row.status)}</Badge> }, { label: 'Monto', numeric: true, render: (row) => formatMoney(row.amount, row.currency) }],
    recurringexpenses: [{ label: 'Registro', render: (row) => <span className="font-semibold">{row.number}</span> }, { label: 'Próxima', render: (row) => formatDate(row.nextExecutionDate) }, { label: 'Proveedor', render: (row) => row.supplierName || '—' }, { label: 'Categoría', render: (row) => row.category || '—' }, { label: 'Frecuencia', render: (row) => statusLabel(row.frequency) }, { label: 'Estado', render: (row) => <Badge variant="outline" className="capitalize">{statusLabel(row.status)}</Badge> }, { label: 'Monto', numeric: true, render: (row) => formatMoney(row.amount, row.currency) }],
    requests: [{ label: 'Solicitud', render: (row) => <span className="font-semibold">{row.number}</span> }, { label: 'Fecha', render: (row) => formatDate(row.date) }, { label: 'Requerida', render: (row) => formatDate(row.requiredDate) }, { label: 'Proveedor', render: (row) => row.supplierName }, { label: 'Prioridad', render: (row) => statusLabel(row.priority) }, { label: 'Estado', render: (row) => <Badge variant="outline" className="capitalize">{statusLabel(row.status)}</Badge> }, { label: 'Bodega', render: (row) => row.warehouseName }],
    management: [{ label: 'Gestión', render: (row) => <span className="font-semibold">{row.number}</span> }, { label: 'Fecha', render: (row) => formatDate(row.date) }, { label: 'Proveedor', render: (row) => row.supplierName }, { label: 'Cotización', render: (row) => row.quotationNumber || '—' }, { label: 'Estado', render: (row) => <Badge variant="outline" className="capitalize">{statusLabel(row.status)}</Badge> }, { label: 'Entrega', render: (row) => formatDate(row.expectedDelivery) }, { label: 'Total', numeric: true, render: (row) => formatMoney(row.total, row.currency) }],
    supplierprices: [{ label: 'Fecha', render: (row) => formatDate(row.date) }, { label: 'Proveedor', render: (row) => row.supplierName }, { label: 'Producto', render: (row) => row.productId || '—' }, { label: 'Descripción', render: (row) => row.description || '—' }, { label: 'Precio', numeric: true, render: (row) => formatMoney(row.unitPrice, row.currency) }, { label: 'Notas', render: (row) => row.notes || '—' }],
  };
  return showBranch ? [...columns[view], { label: 'Sucursal', render: branch }] : columns[view];
}

function exportRow(view: ManagerPurchasesView, row: any) {
  return { Vista: viewLabels[view], Identificador: row.number || row.name || row.id, Fecha: formatDate(row.date || row.createdAt || row.nextInvoiceDate || row.nextExecutionDate), Proveedor: row.supplierName || '', Estado: statusLabel(row.status), Monto: row.total ?? row.amount ?? row.unitPrice ?? '', Moneda: row.currency || '', Sucursal: row.branchName || '', Rubro: row.businessUnitName || '' };
}

function Pagination({ page, totalPages, total, pageSize, onPageChange, onPageSizeChange }: { page: number; totalPages: number; total: number; pageSize: number; onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void }) { return <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{formatNumber(total)} registro(s)</span><div className="flex items-center gap-2"><select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-9 rounded-lg border border-border bg-background px-2 text-xs"><option value={25}>25 / página</option><option value={50}>50 / página</option><option value={100}>100 / página</option></select><Button variant="outline" size="icon" className="size-9 rounded-lg" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}><ChevronLeft className="size-4" /></Button><span className="min-w-20 text-center text-xs font-semibold">Página {page} de {totalPages}</span><Button variant="outline" size="icon" className="size-9 rounded-lg" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}><ChevronRight className="size-4" /></Button></div></div>; }
function LoadingState() { return <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"><RefreshCw className="mr-2 size-5 animate-spin" />Cargando compras consolidadas...</div>; }
function EmptyState({ title, description }: { title: string; description: string }) { return <div className="rounded-3xl border border-dashed border-border p-10 text-center"><p className="font-black">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>; }
