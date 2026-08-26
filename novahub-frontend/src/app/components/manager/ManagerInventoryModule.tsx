import { Fragment, createElement, useMemo, useState, type ReactNode } from 'react';
import { useMutation } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { ArrowRight, ArrowUpRight, Boxes, Building2, CalendarDays, ChevronRight, ClipboardCheck, Download, Eye, FileUp, History, Landmark, Package, Plus, RefreshCw, Search, Scale, ShieldCheck, TrendingDown, TrendingUp, Warehouse, Wrench } from 'lucide-react';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { enterpriseGroupsService, type ManagerInventoryModuleResponse } from '../../services/enterprise-groups.service';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ManagerInventoryAdjustmentsView } from './ManagerInventoryAdjustmentsView';
import { ManagerInventoryImportView } from './ManagerInventoryImportDialog';
import { MANAGER_INVENTORY_VIEWS, type ManagerInventoryView } from './manager-inventory.types';
import { useManagerShellNavigation } from '../ManagerShell';

type BranchOption = { id: string; name: string; businessUnitId?: string | null };
type WarehouseOption = { id: string; name: string; scopeType: string; clientTenantId: string | null; businessUnitId?: string | null; authorizedBranchIds?: string[] };
type BusinessUnitOption = { id: string; name: string; isActive?: boolean };

const viewLabels: Record<ManagerInventoryView, string> = {
  overview: 'Resumen de inventario', branchInventory: 'Inventario de mi sucursal', corporateInventory: 'Inventario de almacén corporativo', products: 'Productos', services: 'Servicios', warehouses: 'Bodegas', corporateWarehouses: 'Almacenes', transfers: 'Transferencias', adjustments: 'Ajustes', audits: 'Auditorías', losses: 'Pérdidas', movements: 'Movimientos', assets: 'Mobiliario y equipos',
};
const statusLabels: Record<string, string> = { PENDING: 'Pendiente', IN_TRANSIT: 'En tránsito', COMPLETED: 'Completada', APPROVED: 'Aprobada', CANCELLED: 'Cancelada', OPEN: 'Abierta', IN_PROGRESS: 'En progreso', CLOSED: 'Cerrada', REOPENED: 'Reabierta', DISPOSED: 'Dada de baja', DAMAGED: 'Dañada' };
const movementTypeLabels: Record<string, string> = { IN: 'Entrada', OUT: 'Salida', TRANSFER_IN: 'Transferencia de entrada', TRANSFER_OUT: 'Transferencia de salida', ADJUSTMENT: 'Ajuste' };
const formatStatus = (value: unknown) => statusLabels[String(value || '').toUpperCase()] || String(value || '—');
const formatMovementType = (value: unknown) => movementTypeLabels[String(value || '').toUpperCase()] || String(value || '—');
const formatMovementReference = (value: unknown) => {
  const reference = String(value || '').trim();
  if (!reference) return '—';
  return reference.replace(/\s*(?:·\s*)?MANAGER_IMPORT:[^\s]+/i, '').trim() || '—';
};
const formatNumber = (value: unknown) => new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 }).format(Number(value || 0));
const formatMoney = (value: unknown, currency = 'NIO') => `${currency} ${formatNumber(value)}`;
const formatDate = (value: unknown) => value ? new Intl.DateTimeFormat('es-NI', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(String(value))) : '—';
const formatApproverName = (approver: unknown) => {
  if (typeof approver === 'string' && approver.trim()) return approver.trim();
  if (approver && typeof approver === 'object') {
    const record = approver as { name?: string | null; email?: string | null };
    return record.name || record.email || 'No registrado';
  }
  return 'No registrado';
};
function normalizeAuditItem(item: any) {
  const originalStock = Number(item.originalSystemStock ?? item.systemStock ?? item.snapshotStock ?? item.theoreticalStock ?? 0);
  const countedStock = Number(item.countedStock ?? 0);
  const difference = item.difference === null || item.difference === undefined ? countedStock - originalStock : Number(item.difference);
  return {
    code: item.code || item.productCode || '—',
    name: item.name || item.productName || 'Producto',
    variantName: item.variantName,
    originalStock,
    countedStock,
    difference,
    finalStock: item.adjustedStock ?? item.finalStock ?? item.stockFinal,
  };
}
const viewIcon = (view: ManagerInventoryView) => ({ overview: Boxes, branchInventory: Package, corporateInventory: Warehouse, products: Package, services: Wrench, warehouses: Warehouse, corporateWarehouses: Warehouse, transfers: ArrowRight, adjustments: Scale, audits: ClipboardCheck, losses: TrendingDown, movements: History, assets: Landmark }[view] || Package);

export function ManagerInventoryModule({ view, onViewChange, groupId, businessUnitId, branchId, branches, warehouses, businessUnits, canCreateTransfers, canImportInventory, canViewInventoryCost, corporateWarehouseContent, onEnterBranch, canEnterBranch = false, onRefreshScope }: { view: ManagerInventoryView; onViewChange: (view: ManagerInventoryView) => void; groupId: string; businessUnitId?: string; branchId?: string; branches: BranchOption[]; warehouses: WarehouseOption[]; businessUnits: BusinessUnitOption[]; canCreateTransfers: boolean; canImportInventory: boolean; canViewInventoryCost: boolean; corporateWarehouseContent?: ReactNode; onEnterBranch?: (groupId: string, branchId: string) => Promise<void>; canEnterBranch?: boolean; onRefreshScope?: () => Promise<unknown> | void }) {
  const { sidebarCollapsed } = useManagerShellNavigation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [movementType, setMovementType] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [catalogBranchId, setCatalogBranchId] = useState('');
  const [warehouseType, setWarehouseType] = useState<'' | 'BODEGA' | 'ALMACEN'>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<any | null>(null);
  const [createTransferOpen, setCreateTransferOpen] = useState(false);
  const [sourceBranchId, setSourceBranchId] = useState(branchId || branches[0]?.id || '');
  const [destBranchId, setDestBranchId] = useState(branchId || branches[0]?.id || '');
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [transferProductId, setTransferProductId] = useState('');
  const [transferQuantity, setTransferQuantity] = useState('1');
  const [exporting, setExporting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const selectedBranchId = branchId || catalogBranchId;
  const effectiveWarehouseType: '' | 'BODEGA' | 'ALMACEN' = view === 'branchInventory' ? 'BODEGA' : view === 'corporateInventory' ? 'ALMACEN' : warehouseType;
  const moduleQuery = useTenantQuery(
    ['manager-inventory-module', groupId, view, businessUnitId || 'all', selectedBranchId || 'all', effectiveWarehouseType || 'all', warehouseId || 'all', status || 'all', movementType || 'all', search, dateFrom, dateTo, page],
    (signal) => enterpriseGroupsService.getInventoryModule(groupId, { view, businessUnitId, branchId: selectedBranchId || undefined, warehouseId: warehouseId || undefined, warehouseType: effectiveWarehouseType || undefined, status: status || undefined, type: movementType || undefined, search, dateFrom, dateTo, page, pageSize: 25 }, signal),
    { enabled: Boolean(groupId) && !importOpen && view !== 'adjustments' && view !== 'corporateWarehouses' },
  );
  const response = moduleQuery.data as ManagerInventoryModuleResponse | undefined;
  const rows = response?.data || [];
  const metrics = response?.metrics || {};
  const activeViewLabel = viewLabels[view];
  const showImportSubview = view === 'products' && importOpen;
  const branchWarehouseCount = warehouses.filter((warehouse) => Boolean(warehouse.clientTenantId)).length;
  const corporateWarehouseCount = warehouses.filter((warehouse) => !warehouse.clientTenantId).length;

  const transferProductsQuery = useTenantQuery(
    ['manager-inventory-transfer-products', groupId, businessUnitId || 'all', sourceBranchId],
    (signal) => enterpriseGroupsService.getInventoryModule(groupId, { view: 'branchInventory', businessUnitId, branchId: sourceBranchId, report: true, page: 1, pageSize: 5000 }, signal),
    { enabled: view === 'transfers' && createTransferOpen && Boolean(sourceBranchId) },
  );
  const transferProducts = transferProductsQuery.data?.data || [];
  const sourceWarehouses = useMemo(() => warehousesForBranch(warehouses, sourceBranchId), [warehouses, sourceBranchId]);
  const destinationWarehouses = useMemo(() => warehousesForBranch(warehouses, destBranchId), [warehouses, destBranchId]);
  const visibleBranches = useMemo(() => branches.filter((branch) => !businessUnitId || !branch.businessUnitId || branch.businessUnitId === businessUnitId), [branches, businessUnitId]);
  const visibleWarehouses = useMemo(() => warehouses.filter((warehouse) => !businessUnitId || !warehouse.businessUnitId || warehouse.businessUnitId === businessUnitId), [warehouses, businessUnitId]);
  const filteredWarehouses = useMemo(() => visibleWarehouses.filter((warehouse) => {
    const belongsToBranch = !selectedBranchId || warehouse.clientTenantId === selectedBranchId || (!warehouse.clientTenantId && (!warehouse.authorizedBranchIds?.length || warehouse.authorizedBranchIds.includes(selectedBranchId)));
    const matchesType = !effectiveWarehouseType || (effectiveWarehouseType === 'BODEGA' ? warehouse.scopeType === 'BRANCH' : warehouse.scopeType === 'BUSINESS_UNIT');
    return belongsToBranch && matchesType;
  }), [visibleWarehouses, selectedBranchId, effectiveWarehouseType]);

  const transferMutation = useMutation({
    mutationFn: () => enterpriseGroupsService.createInterTenantTransfer(groupId, { sourceBranchId, destBranchId, fromWarehouseId, toWarehouseId, items: [{ productId: transferProductId, quantity: Number(transferQuantity) }] }),
    onSuccess: () => { toast.success('Transferencia creada'); setCreateTransferOpen(false); setTransferProductId(''); setTransferQuantity('1'); void moduleQuery.refetch(); },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateFilter = (setter: (value: string) => void, value: string) => { setter(value); setPage(1); };
  const clearFilters = () => { setSearch(''); setStatus(''); setMovementType(''); setCatalogBranchId(''); setWarehouseType(''); setWarehouseId(''); setDateFrom(''); setDateTo(''); setPage(1); };

  const exportReport = async () => {
    setExporting(true);
    try {
      const report = await enterpriseGroupsService.getInventoryModule(groupId, { view, businessUnitId, branchId: selectedBranchId || undefined, warehouseId: warehouseId || undefined, warehouseType: effectiveWarehouseType || undefined, status: status || undefined, type: movementType || undefined, search, dateFrom, dateTo, report: true, page: 1, pageSize: 5000 });
      const exportRows = report.data.map((row: any) => exportRow(view, row, canViewInventoryCost));
      if (!exportRows.length) { toast.info('No hay datos para exportar'); return; }
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows), viewLabels[view].slice(0, 31));
      XLSX.writeFile(workbook, `inventario-manager-${view}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo generar el reporte');
    } finally {
      setExporting(false);
    }
  };

  const hasFilters = Boolean(search || status || movementType || catalogBranchId || warehouseType || warehouseId || dateFrom || dateTo);
  return <div className="inventory-module mx-auto min-w-0 w-full max-w-[1700px] space-y-4 overflow-x-hidden p-3 pb-20 sm:p-6 md:p-10">
    <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-[66px] shrink-0 items-center justify-center rounded-xl bg-primary/10"><Boxes className="size-9 text-primary" /></div>
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-3xl font-black uppercase italic leading-none tracking-tighter sm:text-4xl">Inventario <span className="text-primary">de Mercancías</span></h1>
          <div className="mt-2 flex items-center gap-2"><Badge className="border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary">{branches.length} sucursales · {branchWarehouseCount} bodegas · {corporateWarehouseCount} almacenes corporativos · vista Manager</Badge></div>
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
        {!showImportSubview && <><>{view === 'products' && canImportInventory && <Button type="button" size="sm" className="min-w-0 flex-1 rounded-xl font-bold sm:flex-none" onClick={() => setImportOpen(true)}><FileUp className="mr-2 size-4" />Importar por rubro</Button>}</><Button type="button" variant="outline" size="sm" className="min-w-0 flex-1 rounded-xl font-bold sm:flex-none" onClick={() => { setRefreshKey((current) => current + 1); void moduleQuery.refetch(); if (onRefreshScope) void onRefreshScope(); }} disabled={moduleQuery.isFetching}><RefreshCw className={`mr-2 size-4 ${moduleQuery.isFetching ? 'animate-spin' : ''}`} />Actualizar</Button>{view !== 'corporateWarehouses' && <Button type="button" variant="outline" size="sm" className="min-w-0 flex-1 rounded-xl font-bold sm:flex-none" onClick={exportReport} disabled={exporting || moduleQuery.isLoading}><Download className="mr-2 size-4" />{exporting ? 'Preparando…' : 'Exportar'}</Button>}</>}
      </div>
    </div>

    {!showImportSubview && sidebarCollapsed && <Tabs value={view} onValueChange={(value) => onViewChange(value as ManagerInventoryView)} className="w-full">
      <div className="mb-6 w-full overflow-x-auto custom-scrollbar">
        <TabsList className="flex h-auto w-max min-w-full gap-1.5 rounded-2xl border border-border/40 bg-gradient-to-br from-muted/30 to-muted/50 p-1.5 backdrop-blur-sm [&>button]:flex-none [&>button]:shrink-0 [&>button]:text-muted-foreground [&>button]:hover:bg-muted/50 [&>button]:hover:text-foreground sm:min-w-0">
          {MANAGER_INVENTORY_VIEWS.map((item) => { const Icon = viewIcon(item.id); return <TabsTrigger key={item.id} value={item.id} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest transition-all data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg"><Icon className="size-4" /><span className="hidden sm:inline">{item.label}</span></TabsTrigger>; })}
        </TabsList>
      </div>
    </Tabs>}

    {!showImportSubview && <div className="flex min-w-0 flex-col gap-1 px-1">
      <h2 className="text-2xl font-black uppercase italic leading-none tracking-tight">{activeViewLabel}</h2>
    </div>}

    {showImportSubview ? <ManagerInventoryImportView onBack={() => setImportOpen(false)} groupId={groupId} businessUnitId={businessUnitId} businessUnits={businessUnits} onImported={() => { setRefreshKey((current) => current + 1); void moduleQuery.refetch(); }} /> : view === 'corporateWarehouses' ? corporateWarehouseContent : view === 'adjustments' ? <><ManagerInventoryAdjustmentsView groupId={groupId} businessUnitId={businessUnitId} branchId={branchId} branches={branches} warehouses={warehouses} canViewInventoryCost={canViewInventoryCost} onDetail={setDetail} embedded refreshKey={refreshKey} /><InventoryDetailSheet view={view} row={detail} canViewInventoryCost={canViewInventoryCost} groupId={groupId} onEnterBranch={onEnterBranch} canEnterBranch={canEnterBranch} onClose={() => setDetail(null)} /></> : <>

    <Metrics view={view} metrics={metrics} branchWarehouseCount={branchWarehouseCount} canViewInventoryCost={canViewInventoryCost} />
    {view !== 'overview' && <Card className="rounded-3xl border-border/60 shadow-sm"><CardHeader className="gap-4 pb-4"><CardTitle className="flex items-center gap-2 text-base font-black uppercase italic tracking-tight"><Search className="size-5 text-primary" />Filtros de consulta</CardTitle><div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"><label className="min-w-0 space-y-1.5 text-xs font-bold text-muted-foreground xl:col-span-2"><span>Buscar</span><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => updateFilter(setSearch, event.target.value)} placeholder="Código, nombre, número…" className="pl-9" /></div></label><FilterSelect label="Sucursal" value={selectedBranchId} onChange={(value) => updateFilter(setCatalogBranchId, value)} options={visibleBranches.map((branch) => ({ value: branch.id, label: branch.name }))} disabled={Boolean(branchId)} /><FilterSelect label="Tipo de ubicación" value={effectiveWarehouseType} onChange={(value) => { setWarehouseType(value as '' | 'BODEGA' | 'ALMACEN'); setWarehouseId(''); setPage(1); }} options={view === 'branchInventory' ? [{ value: 'BODEGA', label: 'Bodega de sucursal' }] : view === 'corporateInventory' ? [{ value: 'ALMACEN', label: 'Almacén corporativo' }] : [{ value: 'BODEGA', label: 'Bodega de sucursal' }, { value: 'ALMACEN', label: 'Almacén corporativo' }]} disabled={view === 'branchInventory' || view === 'corporateInventory'} /><FilterSelect label="Bodega / almacén" value={warehouseId} onChange={(value) => updateFilter(setWarehouseId, value)} options={filteredWarehouses.map((warehouse) => ({ value: warehouse.id, label: `${warehouse.name}${warehouse.scopeType === 'BUSINESS_UNIT' ? ' · Corporativo' : ''}` }))} />{['transfers', 'audits', 'losses', 'assets'].includes(view) && <FilterSelect label="Estado" value={status} onChange={(value) => updateFilter(setStatus, value)} options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))} />}{view === 'movements' && <FilterSelect label="Tipo de movimiento" value={movementType} onChange={(value) => updateFilter(setMovementType, value)} options={[{ value: 'IN', label: 'Entrada' }, { value: 'OUT', label: 'Salida' }, { value: 'TRANSFER_IN', label: 'Transferencia entrada' }, { value: 'TRANSFER_OUT', label: 'Transferencia salida' }, { value: 'ADJUSTMENT', label: 'Ajuste' }]} />}{['transfers', 'audits', 'losses', 'movements'].includes(view) && <DateFilter label="Desde" value={dateFrom} onChange={(value) => updateFilter(setDateFrom, value)} />}{['transfers', 'audits', 'losses', 'movements'].includes(view) && <DateFilter label="Hasta" value={dateTo} onChange={(value) => updateFilter(setDateTo, value)} />}</div><div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{response?.meta.total || 0} registro(s) en el alcance seleccionado</span>{hasFilters && <Button type="button" variant="ghost" size="sm" className="rounded-lg" onClick={clearFilters}>Limpiar filtros</Button>}</div></CardHeader></Card>}

    {view === 'overview' && <OverviewPanel branches={branches} warehouses={warehouses} />}
    {moduleQuery.isLoading && <div className="flex min-h-[240px] items-center justify-center text-muted-foreground"><RefreshCw className="mr-2 size-5 animate-spin" />Cargando vista del alcance…</div>}
    {moduleQuery.isError && <Card className="rounded-3xl border-destructive/40"><CardContent className="p-10 text-center text-sm text-destructive">No se pudo cargar esta vista. {moduleQuery.error.message}</CardContent></Card>}
    {!moduleQuery.isLoading && !moduleQuery.isError && view !== 'overview' && !rows.length && <Card className="rounded-3xl border-dashed"><CardContent className="p-10 text-center text-sm text-muted-foreground">No hay información para el alcance y filtros seleccionados.</CardContent></Card>}
    {!moduleQuery.isLoading && !moduleQuery.isError && rows.length > 0 && <ViewTable view={view} rows={rows} onDetail={setDetail} canViewInventoryCost={canViewInventoryCost} onCreateTransfer={canCreateTransfers ? () => { setSourceBranchId(branchId || branches[0]?.id || ''); setDestBranchId(branchId || branches[0]?.id || ''); setCreateTransferOpen(true); } : undefined} />}
    {response?.meta && response.meta.totalPages > 1 && <Pagination page={response.meta.page} totalPages={response.meta.totalPages} onChange={setPage} />}

    {view === 'products' ? <ProductDetailSheet key={detail?.id || 'empty'} row={detail} canViewInventoryCost={canViewInventoryCost} groupId={groupId} onEnterBranch={onEnterBranch} canEnterBranch={canEnterBranch} onClose={() => setDetail(null)} /> : <InventoryDetailSheet view={view} row={detail} canViewInventoryCost={canViewInventoryCost} groupId={groupId} onEnterBranch={onEnterBranch} canEnterBranch={canEnterBranch} onClose={() => setDetail(null)} />}
    {view === 'transfers' && canCreateTransfers && <Dialog open={createTransferOpen} onOpenChange={setCreateTransferOpen}><DialogContent className="max-w-3xl rounded-3xl"><DialogHeader><DialogTitle className="text-xl font-black uppercase italic">Nueva transferencia</DialogTitle><DialogDescription>Transfiere existencias entre una bodega de sucursal y un almacén corporativo, o entre dos ubicaciones autorizadas del mismo rubro.</DialogDescription></DialogHeader><div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2"><SelectField label="Sucursal origen" value={sourceBranchId} onChange={(value) => { setSourceBranchId(value); setFromWarehouseId(''); }} options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} /><SelectField label="Sucursal destino" value={destBranchId} onChange={(value) => { setDestBranchId(value); setToWarehouseId(''); }} options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} /><SelectField label="Origen" value={fromWarehouseId} onChange={setFromWarehouseId} options={sourceWarehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))} /><SelectField label="Destino" value={toWarehouseId} onChange={setToWarehouseId} options={destinationWarehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))} /><SelectField label="Producto" value={transferProductId} onChange={setTransferProductId} options={transferProducts.map((product: any) => ({ value: product.productId || product.id, label: `${product.code} · ${product.name}` }))} /><label className="space-y-1.5 text-xs font-bold text-muted-foreground"><span>Cantidad</span><Input type="number" min="0.01" step="0.01" value={transferQuantity} onChange={(event) => setTransferQuantity(event.target.value)} /></label></div><DialogFooter><Button type="button" variant="outline" className="rounded-xl" onClick={() => setCreateTransferOpen(false)}>Cancelar</Button><Button type="button" className="rounded-xl" disabled={!sourceBranchId || !destBranchId || !fromWarehouseId || !toWarehouseId || !transferProductId || Number(transferQuantity) <= 0 || transferMutation.isPending} onClick={() => transferMutation.mutate()}>{transferMutation.isPending ? 'Creando…' : 'Crear transferencia'}</Button></DialogFooter></DialogContent></Dialog>}
    </>}
  </div>;
}

function Metrics({ view, metrics, branchWarehouseCount, canViewInventoryCost }: { view: ManagerInventoryView; metrics: Record<string, number>; branchWarehouseCount: number; canViewInventoryCost: boolean }) {
  const cards: Array<{ label: string; value: unknown; icon: any; tone?: string }> = view === 'overview'
    ? [{ label: 'Productos', value: metrics.products, icon: Package }, { label: 'Servicios', value: metrics.services, icon: Wrench, tone: 'text-sky-600 bg-sky-500/10' }, { label: 'Stock de mi sucursal', value: metrics.branchInventoryUnits, icon: Package, tone: 'text-emerald-600 bg-emerald-500/10' }, { label: 'Stock corporativo', value: metrics.corporateInventoryUnits, icon: Warehouse, tone: 'text-violet-600 bg-violet-500/10' }, { label: 'Bodegas', value: branchWarehouseCount, icon: Warehouse, tone: 'text-amber-600 bg-amber-500/10' }, { label: 'Transferencias', value: metrics.transfers, icon: ArrowRight, tone: 'text-violet-600 bg-violet-500/10' }, { label: 'Movimientos', value: metrics.movements, icon: History, tone: 'text-cyan-600 bg-cyan-500/10' }, { label: 'Auditorías', value: metrics.audits, icon: ClipboardCheck, tone: 'text-orange-600 bg-orange-500/10' }]
    : view === 'branchInventory' || view === 'corporateInventory'
      ? [{ label: 'Líneas visibles', value: metrics.lines, icon: Package }, { label: 'Productos', value: metrics.products, icon: ShieldCheck, tone: 'text-sky-600 bg-sky-500/10' }, { label: 'Stock disponible', value: metrics.availableUnits, icon: Boxes, tone: view === 'branchInventory' ? 'text-emerald-600 bg-emerald-500/10' : 'text-violet-600 bg-violet-500/10' }, { label: 'Reservado', value: metrics.reservedUnits, icon: Scale, tone: 'text-amber-600 bg-amber-500/10' }]
    : view === 'products' || view === 'services'
      ? [{ label: view === 'products' ? 'Productos por sucursal' : 'Servicios', value: metrics.products, icon: view === 'products' ? Package : Wrench }, { label: 'Sucursales', value: metrics.branches, icon: ShieldCheck, tone: 'text-sky-600 bg-sky-500/10' }, { label: 'Bodegas', value: branchWarehouseCount, icon: Warehouse, tone: 'text-amber-600 bg-amber-500/10' }, { label: view === 'products' ? 'Stock de sucursal' : 'Unidades', value: metrics.inventoryUnits, icon: Boxes, tone: 'text-emerald-600 bg-emerald-500/10' }, { label: 'Valor al costo', value: formatMoney(metrics.inventoryValue), icon: Scale, tone: 'text-violet-600 bg-violet-500/10' }]
      : view === 'warehouses' ? [{ label: 'Ubicaciones activas', value: metrics.warehouses, icon: Warehouse }, { label: 'Almacenes corporativos', value: metrics.corporateWarehouses, icon: Landmark, tone: 'text-violet-600 bg-violet-500/10' }, { label: 'Bodegas de sucursal', value: metrics.branchWarehouses, icon: Boxes, tone: 'text-amber-600 bg-amber-500/10' }, { label: 'Sucursales abastecidas', value: metrics.linkedBranches, icon: ShieldCheck, tone: 'text-emerald-600 bg-emerald-500/10' }, { label: 'Unidades ubicadas', value: metrics.inventoryUnits, icon: Package, tone: 'text-sky-600 bg-sky-500/10' }]
      : view === 'transfers' ? [{ label: 'Transferencias', value: metrics.transfers, icon: ArrowRight }, { label: 'Pendientes', value: metrics.pending, icon: RefreshCw, tone: 'text-amber-600 bg-amber-500/10' }, { label: 'Completadas', value: metrics.completed, icon: ShieldCheck, tone: 'text-emerald-600 bg-emerald-500/10' }, { label: 'Unidades movilizadas', value: metrics.units, icon: Boxes, tone: 'text-sky-600 bg-sky-500/10' }]
      : view === 'audits' ? [{ label: 'Auditorías', value: metrics.audits, icon: ClipboardCheck }, { label: 'Abiertas', value: metrics.open, icon: Search, tone: 'text-amber-600 bg-amber-500/10' }, { label: 'En progreso', value: metrics.inProgress, icon: RefreshCw, tone: 'text-sky-600 bg-sky-500/10' }, { label: 'Diferencia registrada', value: metrics.differences, icon: Scale, tone: 'text-rose-600 bg-rose-500/10' }]
      : view === 'losses' ? [{ label: 'Registros con pérdida', value: metrics.losses, icon: TrendingDown, tone: 'text-rose-600 bg-rose-500/10' }, { label: 'Unidades perdidas', value: metrics.units, icon: Boxes, tone: 'text-amber-600 bg-amber-500/10' }, { label: 'Productos afectados', value: metrics.products, icon: Package }, { label: 'Monto de pérdida', value: formatMoney(metrics.amount), icon: Scale, tone: 'text-violet-600 bg-violet-500/10' }]
      : view === 'movements' ? [{ label: 'Movimientos', value: metrics.movements, icon: History }, { label: 'Entradas', value: metrics.entries, icon: TrendingUp, tone: 'text-emerald-600 bg-emerald-500/10' }, { label: 'Salidas', value: metrics.exits, icon: TrendingDown, tone: 'text-rose-600 bg-rose-500/10' }, { label: 'Unidades salientes', value: metrics.unitsOut, icon: Boxes, tone: 'text-amber-600 bg-amber-500/10' }]
      : [{ label: 'Activos registrados', value: metrics.assets, icon: Wrench }, { label: 'Activos activos', value: metrics.active, icon: ShieldCheck, tone: 'text-emerald-600 bg-emerald-500/10' }, { label: 'Valor acumulado', value: formatMoney(metrics.value), icon: Landmark, tone: 'text-violet-600 bg-violet-500/10' }];
  const visibleCards = canViewInventoryCost ? cards : cards.filter((card) => !['Valor al costo', 'Monto de pérdida', 'Valor acumulado'].includes(card.label));
  return <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{visibleCards.map((card) => <Card key={card.label} className="rounded-2xl border-border/60 shadow-sm"><CardContent className="flex min-w-0 items-center gap-3 p-4"><div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${card.tone || 'text-primary bg-primary/10'}`}><card.icon className="size-5" /></div><div className="min-w-0"><p className="truncate text-[10px] font-black uppercase tracking-widest text-muted-foreground">{card.label}</p><p className="mt-1 truncate text-xl font-black tracking-tight">{card.value === undefined || card.value === null ? '—' : typeof card.value === 'number' ? formatNumber(card.value) : String(card.value)}</p></div></CardContent></Card>)}</div>;
}

function OverviewPanel({ branches, warehouses }: { branches: BranchOption[]; warehouses: WarehouseOption[] }) {
  return <Card className="rounded-3xl border-border/60 bg-gradient-to-br from-primary/5 via-card to-card shadow-sm"><CardContent className="grid min-w-0 gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] md:p-7"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Mapa operativo</p><h3 className="mt-2 text-2xl font-black uppercase italic tracking-tight">Existencias con contexto</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">El Manager puede leer el catálogo compartido dentro del rubro, la existencia por sucursal y el desglose por bodega o almacén autorizado. Las cuentas de cada sucursal siguen separadas.</p><div className="mt-5 flex flex-wrap gap-2">{branches.map((branch) => <Badge key={branch.id} variant="outline" className="rounded-full px-3 py-1">{branch.name}</Badge>)}{!branches.length && <span className="text-sm text-muted-foreground">No hay sucursales visibles.</span>}</div></div><div className="rounded-2xl border border-border/60 bg-background/70 p-4"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Alcance físico</p><div className="mt-4 space-y-3">{warehouses.slice(0, 5).map((warehouse) => <div key={warehouse.id} className="flex items-start gap-3"><div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Warehouse className="size-4" /></div><div className="min-w-0"><p className="truncate text-sm font-semibold">{warehouse.name}</p><p className="text-xs text-muted-foreground">{warehouse.scopeType === 'BUSINESS_UNIT' ? 'Almacén corporativo' : 'Bodega de sucursal'}</p></div></div>)}{!warehouses.length && <p className="text-sm text-muted-foreground">No hay ubicaciones visibles.</p>}</div></div></CardContent></Card>;
}

function ViewTable({ view, rows, onDetail, canViewInventoryCost, onCreateTransfer }: { view: ManagerInventoryView; rows: any[]; onDetail: (row: any) => void; canViewInventoryCost: boolean; onCreateTransfer?: () => void }) {
  if (view === 'branchInventory' || view === 'corporateInventory') {
    const corporate = view === 'corporateInventory';
    return <Card className="rounded-3xl border-border/60 shadow-sm"><CardHeader><CardTitle className="flex flex-wrap items-center gap-2 text-lg font-black uppercase italic tracking-tight"><span>{corporate ? 'Inventario de almacén corporativo' : 'Inventario de mi sucursal'}</span><Badge variant="outline" className="normal-case not-italic">Stock independiente</Badge></CardTitle><p className="text-sm text-muted-foreground">{corporate ? 'Existencias de abastecimiento del almacén autorizado para esta sucursal.' : 'Existencias físicas disponibles en la sucursal seleccionada.'}</p></CardHeader><CardContent className="p-0"><ResponsiveTable><TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Código / SKU</TableHead><TableHead>{corporate ? 'Almacén corporativo' : 'Bodega de sucursal'}</TableHead><TableHead>Sucursal</TableHead><TableHead>Stock</TableHead><TableHead>Reservado</TableHead><TableHead>Disponible</TableHead><TableHead /></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell><p className="font-semibold">{row.name}</p><p className="text-xs text-muted-foreground">{row.variantName || row.unit}</p></TableCell><TableCell><span className="font-mono font-bold">{row.code}</span><p className="text-xs text-muted-foreground">{row.sku || '—'}</p></TableCell><TableCell>{row.warehouseName}</TableCell><TableCell>{row.branchName}</TableCell><TableCell className="font-black">{formatNumber(row.quantity)}</TableCell><TableCell>{formatNumber(row.reserved)}</TableCell><TableCell className="font-black text-emerald-600">{formatNumber(row.available)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" className="rounded-lg" onClick={() => onDetail(row)}><Eye className="mr-1.5 size-4" />Detalle</Button></TableCell></TableRow>)}</TableBody></ResponsiveTable></CardContent></Card>;
  }
  if (view === 'transfers') return <Card className="rounded-3xl border-border/60 shadow-sm"><CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle className="text-lg font-black uppercase italic tracking-tight">Historial de transferencias</CardTitle>{onCreateTransfer && <Button type="button" className="rounded-xl" onClick={onCreateTransfer}><Plus className="mr-2 size-4" />Nueva transferencia</Button>}</CardHeader><CardContent className="p-0"><ResponsiveTable><TableHeader><TableRow><TableHead>Transferencia</TableHead><TableHead>Fecha</TableHead><TableHead>Origen</TableHead><TableHead>Destino</TableHead><TableHead>Productos</TableHead><TableHead>Unidades</TableHead><TableHead>Estado</TableHead><TableHead /></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell className="font-bold">{row.number}</TableCell><TableCell>{formatDate(row.date)}</TableCell><TableCell>{row.from?.name || '—'}<p className="text-xs text-muted-foreground">{row.sourceBranchName}</p></TableCell><TableCell>{row.to?.name || '—'}</TableCell><TableCell>{formatNumber(row.itemCount)}</TableCell><TableCell>{formatNumber(row.units)}</TableCell><TableCell><Badge variant="outline">{formatStatus(row.status)}</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" className="rounded-lg" onClick={() => onDetail(row)}><Eye className="mr-1.5 size-4" />Detalle</Button></TableCell></TableRow>)}</TableBody></ResponsiveTable></CardContent></Card>;
  if (view === 'products' || view === 'services') return <ProductCatalogTable view={view} rows={rows} onDetail={onDetail} canViewInventoryCost={canViewInventoryCost} />;
  if (view === 'warehouses') return <Card className="rounded-3xl border-border/60 shadow-sm"><CardHeader><CardTitle className="text-lg font-black uppercase italic tracking-tight">Bodegas y almacenes por rubro</CardTitle></CardHeader><CardContent className="grid min-w-0 grid-cols-1 gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">{rows.map((row) => <button type="button" key={row.id} onClick={() => onDetail(row)} className="min-w-0 rounded-2xl border border-border/60 bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Warehouse className="size-5" /></div><div className="min-w-0"><p className="truncate font-bold">{row.name}</p><p className="truncate text-xs text-muted-foreground">{row.businessUnitName || 'Sin rubro'}</p></div></div><Badge variant="outline">{row.isCorporate ? 'Corporativo' : 'Bodega'}</Badge></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-muted/30 px-3 py-2"><p className="text-muted-foreground">Stock visible</p><p className="mt-1 font-black">{formatNumber(row.stockTotal)}</p></div><div className="rounded-xl bg-muted/30 px-3 py-2"><p className="text-muted-foreground">Disponible</p><p className="mt-1 font-black text-emerald-600">{formatNumber(row.availableTotal)}</p></div></div><p className="mt-4 text-xs text-muted-foreground">{row.isCorporate ? 'Sucursales que puede abastecer:' : 'Sucursal propietaria:'}</p><div className="mt-2 flex flex-wrap gap-1.5">{row.branches.map((branch: any) => <Badge key={branch.id} variant="secondary" className="max-w-full truncate">{branch.name}</Badge>)}{!row.branches.length && <span className="text-xs text-muted-foreground">Sin sucursal vinculada</span>}</div></button>)}</CardContent></Card>;
  if (view === 'audits') return <SimpleTable title="Recuento de auditorías" headers={['Acta', 'Fecha', 'Sucursal', 'Ubicación', 'Responsable', 'Productos', 'Diferencia', 'Estado']} rows={rows} onDetail={onDetail} render={(row) => [row.number, formatDate(row.auditDate), row.branchName, row.warehouseName, row.supervisorName || row.stockKeeperName || '—', formatNumber(row.itemCount), formatNumber(row.difference), formatStatus(row.status)]} />;
  if (view === 'losses') return <SimpleTable title="Pérdidas registradas" headers={canViewInventoryCost ? ['Ajuste', 'Fecha', 'Sucursal', 'Ubicación', 'Unidades', 'Monto', 'Motivo'] : ['Ajuste', 'Fecha', 'Sucursal', 'Ubicación', 'Unidades', 'Motivo']} rows={rows} onDetail={onDetail} render={(row) => canViewInventoryCost ? [row.number, formatDate(row.date), row.branchName, row.warehouseName, formatNumber(row.lossUnits), formatMoney(row.lossAmount), row.reason || '—'] : [row.number, formatDate(row.date), row.branchName, row.warehouseName, formatNumber(row.lossUnits), row.reason || '—']} />;
  if (view === 'movements') return <SimpleTable title="Kardex por ubicación" headers={['Fecha', 'Producto', 'Sucursal', 'Ubicación', 'Tipo', 'Cantidad', 'Saldo resultante', 'Referencia']} rows={rows} onDetail={onDetail} render={(row) => [formatDate(row.date), `${row.product?.code || '—'} · ${row.product?.name || 'Producto'}`, row.branchName, row.warehouse?.name || '—', formatMovementType(row.type), formatNumber(row.quantity), formatNumber(row.resultingQty), formatMovementReference(row.reference)]} />;
  return <SimpleTable title="Mobiliario y equipos" headers={canViewInventoryCost ? ['Código', 'Activo', 'Categoría', 'Sucursal', 'Estado', 'Costo', 'Ubicación'] : ['Código', 'Activo', 'Categoría', 'Sucursal', 'Estado', 'Ubicación']} rows={rows} onDetail={onDetail} render={(row) => canViewInventoryCost ? [row.code, row.name, row.category, row.branchName, formatStatus(row.status), formatMoney(row.cost, row.currency || 'NIO'), row.location || '—'] : [row.code, row.name, row.category, row.branchName, formatStatus(row.status), row.location || '—']} />;
}

function ProductCatalogTable({ view, rows, onDetail, canViewInventoryCost }: { view: 'products' | 'services'; rows: any[]; onDetail: (row: any) => void; canViewInventoryCost: boolean }) {
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const catalogRows = useMemo(() => consolidateProductRows(rows), [rows]);
  const isProductView = view === 'products';
  const columnCount = canViewInventoryCost ? 10 : 9;
  const toggleProduct = (row: any) => setExpandedProductId((current) => current === row.id ? null : row.id);

  return <Card className="rounded-3xl border-border/60 shadow-sm"><CardHeader><CardTitle className="text-lg font-black uppercase italic tracking-tight">{isProductView ? 'Catálogo por SKU · stock separado por ubicación' : 'Catálogo de servicios'}</CardTitle><p className="text-sm text-muted-foreground">Cada SKU aparece una sola vez; el detalle conserva la sucursal, bodega o almacén de cada existencia.</p></CardHeader><CardContent className="p-0"><ResponsiveTable><TableHeader><TableRow><TableHead>Sucursales</TableHead><TableHead>Código / SKU</TableHead><TableHead>Producto / servicio</TableHead><TableHead>Categoría</TableHead><TableHead>Unidad</TableHead>{canViewInventoryCost && <TableHead>Costo</TableHead>}<TableHead>{isProductView ? 'Stock total' : 'Unidades'}</TableHead><TableHead>Disponible</TableHead><TableHead>Ubicaciones</TableHead><TableHead /></TableRow></TableHeader><TableBody>{catalogRows.map((row) => {
    const isExpanded = isProductView && expandedProductId === row.id;
    return <Fragment key={row.id}>
      <TableRow tabIndex={0} role="button" aria-label={`${isExpanded ? 'Contraer' : 'Expandir'} ${row.name || 'producto'}`} aria-expanded={isProductView ? isExpanded : undefined} className={`cursor-pointer transition-colors hover:bg-muted/35 focus-visible:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 ${isExpanded ? 'bg-primary/5' : ''}`} onClick={() => isProductView ? toggleProduct(row) : onDetail(row)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (isProductView) toggleProduct(row); else onDetail(row); } }}>
        <TableCell><p className="font-semibold">{row.branchCount || 0}</p><p className="max-w-40 whitespace-normal break-words text-xs text-muted-foreground">{row.branchNames?.join(' · ') || '—'}</p></TableCell><TableCell><span className="font-mono font-bold">{row.code}</span><p className="text-xs text-muted-foreground">SKU: {row.sku || row.code || '—'}</p></TableCell><TableCell><p className="font-semibold">{row.name}</p><p className="text-xs text-muted-foreground">Identidad consolidada por SKU</p></TableCell><TableCell>{row.category}</TableCell><TableCell>{row.unit}</TableCell>{canViewInventoryCost && <TableCell>{formatMoney(row.costPrice)}</TableCell>}<TableCell>{isProductView ? formatNumber(row.branchStock) : '—'}</TableCell><TableCell className="font-bold text-emerald-600">{isProductView ? formatNumber(row.branchAvailable) : '—'}</TableCell><TableCell>{formatNumber(row.locationCount)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" className="rounded-lg" onClick={(event) => { event.stopPropagation(); onDetail(row); }}><Eye className="mr-1.5 size-4" />Detalle</Button></TableCell>
      </TableRow>
      {isExpanded && <TableRow className="bg-muted/5"><TableCell colSpan={columnCount} className="p-0"><div id={`product-distribution-${row.id}`} className="border-y border-primary/10 bg-muted/5 px-4 py-4 sm:px-6"><ProductDistribution row={row} canViewInventoryCost={canViewInventoryCost} compact /></div></TableCell></TableRow>}
    </Fragment>;
  })}</TableBody></ResponsiveTable></CardContent></Card>;
}

function consolidateProductRows(rows: any[]) {
  const grouped = new Map<string, any>();
  rows.forEach((row, index) => {
    const identity = String(row.sku || row.code || row.productId || row.id || `product-${index}`).trim().toUpperCase();
    const current = grouped.get(identity) || { ...row, id: row.id || identity, locations: [], pricesByBranch: [], branchNames: [] };
    const sourceLocations = Array.isArray(row.locations) ? row.locations : [];
    current.locations = mergeLocationRows(current.locations, sourceLocations);
    current.pricesByBranch = mergeBranchPrices(current.pricesByBranch, Array.isArray(row.pricesByBranch) ? row.pricesByBranch : []);
    current.branchNames = uniqueStrings([
      ...current.branchNames,
      ...(Array.isArray(row.branchNames) ? row.branchNames : []),
    ]);
    grouped.set(identity, current);
  });

  return Array.from(grouped.values()).map((row) => {
    const hasLocations = row.locations.length > 0;
    const branchNames = row.branchNames.length ? row.branchNames : uniqueStrings(row.locations.map((location: any) => location.branchName));
    const branchStock = hasLocations ? row.locations.reduce((total: number, location: any) => total + Number(location.quantity || 0), 0) : Number(row.branchStock || 0);
    const branchAvailable = hasLocations ? row.locations.reduce((total: number, location: any) => total + locationAvailable(location), 0) : Number(row.branchAvailable || 0);
    return { ...row, branchNames, branchCount: branchNames.length || row.branchCount || 0, locationCount: row.locations.length || row.locationCount || 0, branchStock, branchAvailable };
  });
}

function mergeLocationRows(existingLocations: any[], incomingLocations: any[]) {
  const merged = new Map<string, any>();
  [...existingLocations, ...incomingLocations].forEach((location, index) => {
    const key = `${location.branchId || location.branchName || 'branch'}:${location.warehouseId || location.warehouseName || `location-${index}`}`;
    const current = merged.get(key);
    if (!current) {
      merged.set(key, { ...location, quantity: Number(location.quantity || 0), reserved: Number(location.reserved || 0), available: locationAvailable(location) });
      return;
    }
    current.quantity += Number(location.quantity || 0);
    current.reserved += Number(location.reserved || 0);
    current.available += locationAvailable(location);
  });
  return Array.from(merged.values());
}

function mergeBranchPrices(existingPrices: any[], incomingPrices: any[]) {
  const merged = new Map<string, any>();
  [...existingPrices, ...incomingPrices].forEach((price, index) => {
    const key = String(price.branchId || price.branchName || `branch-${index}`);
    if (!merged.has(key)) merged.set(key, price);
  });
  return Array.from(merged.values());
}

function uniqueStrings(values: unknown[]) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function SimpleTable({ title, headers, rows, render, onDetail }: { title: string; headers: string[]; rows: any[]; render: (row: any) => unknown[]; onDetail: (row: any) => void }) {
  return <Card className="rounded-3xl border-border/60 shadow-sm"><CardHeader><CardTitle className="text-lg font-black uppercase italic tracking-tight">{title}</CardTitle></CardHeader><CardContent className="p-0"><ResponsiveTable><TableHeader><TableRow>{headers.map((header) => <TableHead key={header}>{header}</TableHead>)}<TableHead /></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}>{render(row).map((cell, index) => <TableCell key={`${row.id}-${index}`} className="max-w-56 truncate">{String(cell ?? '—')}</TableCell>)}<TableCell className="text-right"><Button variant="ghost" size="sm" className="rounded-lg" onClick={() => onDetail(row)}><Eye className="mr-1.5 size-4" />Detalle</Button></TableCell></TableRow>)}</TableBody></ResponsiveTable></CardContent></Card>;
}

function ResponsiveTable({ children }: { children: ReactNode }) { return <div className="sales-responsive-table overflow-x-auto"><Table className="min-w-[980px]">{children}</Table></div>; }
function FilterSelect({ label, value, onChange, options, disabled = false }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; disabled?: boolean }) { return <label className="min-w-0 space-y-1.5 text-xs font-bold text-muted-foreground"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="h-9 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"><option value="">Todos</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="min-w-0 space-y-1.5 text-xs font-bold text-muted-foreground"><span>{label}</span><div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="pl-9" /></div></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) { return <label className="min-w-0 space-y-1.5 text-xs font-bold text-muted-foreground"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm font-normal text-foreground"><option value="">Seleccionar</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) { return <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">Página {page} de {totalPages}</span><div className="flex gap-2"><Button variant="outline" size="sm" className="rounded-lg" disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</Button><Button variant="outline" size="sm" className="rounded-lg" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Siguiente</Button></div></div>; }

function ProductDetailSheet({ row, canViewInventoryCost, groupId, onEnterBranch, canEnterBranch = false, onClose }: { row: any | null; canViewInventoryCost: boolean; groupId: string; onEnterBranch?: (groupId: string, branchId: string) => Promise<void>; canEnterBranch?: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'general' | 'distribution'>('general');
  const locations = Array.isArray(row?.locations) ? row.locations : [];
  const branchTargets = resolveRecordBranchTargets(row);

  return <Sheet open={Boolean(row)} onOpenChange={(open) => !open && onClose()}>
    <SheetContent side="right" className="flex w-full min-w-0 flex-col gap-0 overflow-hidden border-l border-border/50 bg-background p-0 sm:max-w-3xl">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'general' | 'distribution')} className="flex min-h-0 flex-1 flex-col gap-0">
        <SheetHeader className="sticky top-0 z-10 space-y-3 border-b border-border/50 bg-background/95 px-6 py-5 backdrop-blur-md">
          <div className="flex items-start gap-4 pr-8">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-inner"><Package className="size-6" /></div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="truncate text-lg font-black uppercase tracking-tight text-foreground">{row?.name || 'Detalle del producto'}</SheetTitle>
                {row && <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider">Producto</Badge>}
              </div>
              <SheetDescription className="flex flex-wrap items-center gap-2 text-xs"><span className="font-mono font-bold">{row?.code || '—'}</span><span>·</span><span>SKU: {row?.sku || row?.code || '—'}</span><span>·</span><span className="font-semibold text-primary">{row?.branchNames?.join(' · ') || 'Sucursales del alcance'}</span></SheetDescription>
            </div>
          </div>
          <TabsList className="h-9 w-full justify-start overflow-x-auto rounded-xl border border-border/40 bg-muted/40 p-1 text-xs font-bold">
            <TabsTrigger value="general" className="gap-1.5 rounded-lg px-3 py-1 text-xs font-bold"><Package className="size-3.5" /> General</TabsTrigger>
            <TabsTrigger value="distribution" className="gap-1.5 rounded-lg px-3 py-1 text-xs font-bold"><Warehouse className="size-3.5" /> Distribución ({locations.length})</TabsTrigger>
          </TabsList>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 overflow-hidden">
          <div className="space-y-5 p-6">
            <TabsContent value="general" className="mt-0 space-y-5 outline-none">
              <Card className="rounded-2xl border-primary/20 bg-primary/5 p-5 shadow-sm"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><ProductDetailField label="Código / SKU" value={`${row?.code || '—'} · ${row?.sku || row?.code || '—'}`} mono /><ProductDetailField label="Sucursales" value={row?.branchNames?.join(' · ') || row?.branchName || '—'} /><ProductDetailField label="Categoría" value={row?.category || '—'} /><ProductDetailField label="Unidad" value={row?.unit || '—'} /><ProductDetailField label="Stock total" value={formatNumber(row?.branchStock)} /><ProductDetailField label="Disponible total" value={formatNumber(row?.branchAvailable)} /></div></Card>
              <ProductDetailSection title="Identificación del producto"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><ProductDetailField label="Nombre" value={row?.name || '—'} /><ProductDetailField label="Ubicaciones" value={`${formatNumber(row?.locationCount || locations.length)} ubicación(es)`} /><ProductDetailField label="Sucursal(es) visibles" value={row?.branchNames?.join(' · ') || '—'} /><ProductDetailField label="Tipo" value={row?.type === 'SERVICE' ? 'Servicio' : 'Producto'} /></div></ProductDetailSection>
              {canViewInventoryCost && <ProductDetailSection title="Valoración"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><ProductDetailField label="Costo unitario" value={formatMoney(row?.costPrice)} /><ProductDetailField label="Valor del stock" value={formatMoney(Number(row?.branchStock || 0) * Number(row?.costPrice || 0))} /></div></ProductDetailSection>}
            </TabsContent>
            <TabsContent value="distribution" className="mt-0 outline-none">{row && <ProductDistribution row={row} canViewInventoryCost={canViewInventoryCost} />}</TabsContent>
          </div>
        </ScrollArea>
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 bg-background/95 px-6 py-3 backdrop-blur-md"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Consulta de solo lectura</p><div className="flex flex-wrap items-center justify-end gap-2">{onEnterBranch && canEnterBranch && branchTargets.map((branch) => <Button key={branch.id} variant="outline" size="sm" onClick={() => { onClose(); void onEnterBranch(groupId, branch.id); }} className="gap-1.5 rounded-xl text-xs font-bold text-primary hover:text-primary"><Building2 className="size-3.5" /> {branchTargets.length === 1 ? 'Ir a su sucursal' : `Ir a ${branch.name}`} <ArrowUpRight className="size-3.5" /></Button>)}<Button variant="outline" size="sm" onClick={onClose} className="gap-1.5 rounded-xl text-xs font-bold">Cerrar <ChevronRight className="size-3" /></Button></div></div>
      </Tabs>
    </SheetContent>
  </Sheet>;
}

function ProductDetailSection({ title, children }: { title: string; children: ReactNode }) {
  return <Card className="space-y-4 rounded-2xl border-border/60 bg-card p-5 shadow-sm"><h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/80"><Package className="size-4 text-primary" />{title}</h3>{children}</Card>;
}

function ProductDetailField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p><p className={`mt-1 break-words text-sm font-semibold ${mono ? 'font-mono text-xs' : ''}`}>{value}</p></div>;
}

function DetailMetric({ label, value, tone = 'text-foreground' }: { label: string; value: string; tone?: string }) {
  return <div className="rounded-2xl border border-border/60 bg-muted/20 p-3"><p className="truncate text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p><p className={`mt-1 text-lg font-black tabular-nums ${tone}`}>{value}</p></div>;
}

function ProductDistribution({ row, canViewInventoryCost, compact = false }: { row: any; canViewInventoryCost: boolean; compact?: boolean }) {
  const locations = Array.isArray(row.locations) ? row.locations : [];
  const prices = Array.isArray(row.pricesByBranch) ? row.pricesByBranch : [];
  const groups = groupLocationsByBranch(locations);
  const totalStock = Number(row.branchStock ?? locations.reduce((total: number, location: any) => total + Number(location.quantity || 0), 0));
  const totalAvailable = Number(row.branchAvailable ?? locations.reduce((total: number, location: any) => total + locationAvailable(location), 0));

  if (compact) return <ExpandedProductDistribution row={row} groups={groups} canViewInventoryCost={canViewInventoryCost} />;

  return <div className={compact ? 'space-y-0' : 'space-y-4'}>
    {!compact && <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Distribución por sucursal</p>
          <p className="mt-1 text-sm text-muted-foreground">Cada ubicación conserva su existencia independiente.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{groups.length} sucursal(es)</Badge>
          <Badge variant="outline">{locations.length} ubicación(es)</Badge>
          <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600">{formatNumber(totalAvailable)} disponibles</Badge>
        </div>
      </div>
    </div>}

    {locations.length === 0 ? <DetailList title="Desglose por sucursal y ubicación" rows={[]} /> : <div className="overflow-x-auto rounded-2xl border border-border/60">
      <Table className="min-w-[760px]">
        <TableHeader><TableRow className="bg-muted/30"><TableHead>Sucursal</TableHead><TableHead>Bodega / almacén</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Disponible</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
        <TableBody>
          {groups.map((group) => <Fragment key={group.key}>
            <TableRow className="bg-muted/15">
              <TableCell><p className="font-semibold">{group.locations.length}</p><p className="text-xs text-muted-foreground">{group.name}</p></TableCell>
              <TableCell className="text-xs text-muted-foreground">{group.locations.length === 1 ? '1 ubicación' : `${group.locations.length} ubicaciones`}</TableCell>
              <TableCell className="text-right font-black tabular-nums">{formatNumber(group.stock)}</TableCell>
              <TableCell className="text-right font-black tabular-nums text-emerald-600">{formatNumber(group.available)}</TableCell>
              <TableCell><DistributionStatus available={group.available} quantity={group.stock} /></TableCell>
            </TableRow>
            {group.locations.map((location: any, index: number) => <TableRow key={`${group.key}-${location.warehouseId || location.warehouseName || index}`} className="hover:bg-muted/20">
              <TableCell className="pl-10 text-xs text-muted-foreground"><span className="mr-2 text-border">└</span>{group.name}</TableCell>
              <TableCell><div className="flex items-center gap-2"><Warehouse className="size-3.5 text-muted-foreground" /><span className="font-medium">{location.warehouseName || 'Sin bodega'}</span>{location.isCorporate && <Badge variant="outline" className="text-[9px]">Corporativo</Badge>}</div></TableCell>
              <TableCell className="text-right font-mono tabular-nums">{formatNumber(location.quantity)}</TableCell>
              <TableCell className="text-right font-mono font-bold tabular-nums text-emerald-600">{formatNumber(locationAvailable(location))}</TableCell>
              <TableCell><DistributionStatus available={locationAvailable(location)} quantity={Number(location.quantity || 0)} /></TableCell>
            </TableRow>)}
          </Fragment>)}
        </TableBody>
      </Table>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 bg-muted/15 px-4 py-3 text-xs"><span className="font-bold">Total distribuido</span><span className="tabular-nums">{formatNumber(totalStock)} stock · <span className="font-bold text-emerald-600">{formatNumber(totalAvailable)} disponibles</span></span></div>
    </div>}

    {!compact && prices.length > 0 && <DetailList title="Precios por sucursal" rows={prices.map((price: any) => `${price.branchName || 'Sucursal'}: ${formatMoney(price.price, price.currency)}`)} />}
    {!compact && canViewInventoryCost && <p className="text-[10px] text-muted-foreground">La distribución muestra existencias físicas por ubicación; los valores de costo permanecen en el resumen del producto.</p>}
  </div>;
}

function ExpandedProductDistribution({ row, groups, canViewInventoryCost }: { row: any; groups: Array<{ key: string; name: string; locations: any[]; stock: number; available: number }>; canViewInventoryCost: boolean }) {
  const locationRows = groups.flatMap((group) => group.locations.map((location: any, groupIndex: number) => ({ group, location, groupIndex })));
  const columnCount = canViewInventoryCost ? 9 : 8;

  return <div className="space-y-2">
    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Distribución del producto por sucursal y ubicación</p>
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-background/60">
      <Table className="min-w-[980px]">
        <TableHeader><TableRow className="bg-muted/30"><TableHead>Sucursales</TableHead><TableHead>Código / SKU</TableHead><TableHead>Producto / servicio</TableHead><TableHead>Categoría</TableHead><TableHead>Unidad</TableHead>{canViewInventoryCost && <TableHead>Costo</TableHead>}<TableHead>Stock total</TableHead><TableHead>Disponible</TableHead><TableHead>Ubicaciones</TableHead></TableRow></TableHeader>
        <TableBody>
          {locationRows.length === 0 ? <TableRow><TableCell colSpan={columnCount} className="py-6 text-center text-sm text-muted-foreground">Sin ubicaciones registradas.</TableCell></TableRow> : locationRows.map(({ group, location, groupIndex }, index) => <TableRow key={`${group.key}-${location.warehouseId || location.warehouseName || index}`} className="hover:bg-muted/20">
            {groupIndex === 0 && <TableCell rowSpan={group.locations.length} className="align-top"><p className="font-semibold">{group.locations.length}</p><p className="text-xs text-muted-foreground">{group.name}</p><p className="mt-1 text-[10px] text-muted-foreground">{group.locations.length === 1 ? '1 ubicación' : `${group.locations.length} ubicaciones`}</p></TableCell>}
            {index === 0 && <>
              <TableCell rowSpan={locationRows.length} className="align-top"><span className="font-mono font-bold">{row.code || '—'}</span><p className="text-xs text-muted-foreground">SKU: {row.sku || row.code || '—'}</p></TableCell>
              <TableCell rowSpan={locationRows.length} className="align-top"><p className="font-semibold">{row.name || 'Producto'}</p></TableCell>
              <TableCell rowSpan={locationRows.length} className="align-top">{row.category || '—'}</TableCell>
              <TableCell rowSpan={locationRows.length} className="align-top">{row.unit || '—'}</TableCell>
              {canViewInventoryCost && <TableCell rowSpan={locationRows.length} className="align-top">{formatMoney(row.costPrice)}</TableCell>}
            </>}
            <TableCell className="font-mono tabular-nums">{formatNumber(location.quantity)}</TableCell>
            <TableCell className="font-mono font-bold tabular-nums text-emerald-600">{formatNumber(locationAvailable(location))}</TableCell>
            <TableCell className="font-medium"><div className="flex items-center gap-2"><Warehouse className="size-3.5 text-muted-foreground" /><span>{location.warehouseName || 'Sin bodega'}</span>{location.isCorporate && <Badge variant="outline" className="text-[9px]">Corporativo</Badge>}</div></TableCell>
          </TableRow>)}
        </TableBody>
      </Table>
    </div>
  </div>;
}

function groupLocationsByBranch(locations: any[]) {
  const groups = new Map<string, { key: string; name: string; locations: any[]; stock: number; available: number }>();
  locations.forEach((location, index) => {
    const key = String(location.branchId || location.branchName || `branch-${index}`);
    const current = groups.get(key) || { key, name: location.branchName || 'Sin sucursal', locations: [] as any[], stock: 0, available: 0 };
    current.locations.push(location);
    current.stock += Number(location.quantity || 0);
    current.available += locationAvailable(location);
    groups.set(key, current);
  });
  return Array.from(groups.values());
}

function locationAvailable(location: any) {
  return Number(location.available ?? location.quantity ?? 0);
}

function DistributionStatus({ available, quantity }: { available: number; quantity: number }) {
  const status = available > 0
    ? { label: 'Disponible', className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600' }
    : quantity > 0
      ? { label: 'Reservado', className: 'border-amber-500/20 bg-amber-500/10 text-amber-600' }
      : { label: 'Sin stock', className: 'border-rose-500/20 bg-rose-500/10 text-rose-600' };
  return <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-wider ${status.className}`}>{status.label}</Badge>;
}
function InventoryDetailSheet({ view, row, canViewInventoryCost, groupId, onEnterBranch, canEnterBranch = false, onClose }: { view: ManagerInventoryView; row: any | null; canViewInventoryCost: boolean; groupId: string; onEnterBranch?: (groupId: string, branchId: string) => Promise<void>; canEnterBranch?: boolean; onClose: () => void }) {
  const recordBranchId = resolveRecordBranchId(row);
  const title = view === 'movements'
    ? row?.product?.name || 'Movimiento de inventario'
    : row?.name || row?.number || row?.code || viewLabels[view];
  const descriptor = view === 'movements'
    ? [row?.product?.code, row?.branchName, row?.warehouse?.name || row?.warehouseName].filter(Boolean).join(' · ')
    : view === 'transfers' || view === 'adjustments'
    ? `${formatDate(row?.date)} · ${formatStatus(row?.status)}`
    : [row?.code, row?.sku || row?.product?.code, row?.branchName, row?.warehouseName].filter(Boolean).join(' · ');

  return <Sheet open={Boolean(row)} onOpenChange={(open) => !open && onClose()}>
    <SheetContent side="right" className="flex w-full min-w-0 flex-col gap-0 overflow-hidden border-l border-border/50 bg-background p-0 sm:max-w-3xl">
      <SheetHeader className="sticky top-0 z-10 space-y-0 border-b border-border/50 bg-background/95 px-6 py-5 backdrop-blur-md">
        <div className="flex items-start gap-4 pr-8">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-inner">{createElement(viewIcon(view), { className: 'size-6' })}</div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <SheetTitle className="truncate text-lg font-black uppercase tracking-tight text-foreground">{title}</SheetTitle>
              {row && <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider">{viewLabels[view]}</Badge>}
            </div>
            <SheetDescription className="flex flex-wrap items-center gap-2 text-xs"><span className="font-mono font-bold">{descriptor || 'Consulta de inventario'}</span></SheetDescription>
          </div>
        </div>
      </SheetHeader>
      <ScrollArea className="min-h-0 flex-1 overflow-hidden">
        <div className="space-y-5 p-6">
          {row && <InventoryDetailContent view={view} row={row} canViewInventoryCost={canViewInventoryCost} />}
        </div>
      </ScrollArea>
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 bg-background/95 px-6 py-3 backdrop-blur-md"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Consulta de solo lectura</p><div className="flex flex-wrap items-center justify-end gap-2">{onEnterBranch && canEnterBranch && recordBranchId && <Button variant="outline" size="sm" onClick={() => { onClose(); void onEnterBranch(groupId, recordBranchId); }} className="gap-1.5 rounded-xl text-xs font-bold text-primary hover:text-primary"><Building2 className="size-3.5" /> Ir a su sucursal <ArrowUpRight className="size-3.5" /></Button>}<Button variant="outline" size="sm" onClick={onClose} className="gap-1.5 rounded-xl text-xs font-bold">Cerrar <ChevronRight className="size-3" /></Button></div></div>
    </SheetContent>
  </Sheet>;
}

function InventoryDetailContent({ view, row, canViewInventoryCost }: { view: ManagerInventoryView; row: any; canViewInventoryCost: boolean }) {
  const locations = Array.isArray(row.locations) ? row.locations : [];
  const pricesByBranch = Array.isArray(row.pricesByBranch) ? row.pricesByBranch : [];
  const branches = Array.isArray(row.branches) ? row.branches : [];

  if (view === 'branchInventory' || view === 'corporateInventory') return <>
    <Card className="rounded-2xl border-primary/20 bg-primary/5 p-5 shadow-sm"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><ProductDetailField label="Producto" value={row.name || '—'} /><ProductDetailField label="Código / SKU" value={`${row.code || '—'} · ${row.sku || row.code || '—'}`} mono /><ProductDetailField label="Sucursal" value={row.branchName || 'Almacén corporativo'} /><ProductDetailField label="Bodega / almacén" value={row.warehouseName || '—'} /><ProductDetailField label="Stock" value={formatNumber(row.quantity)} /><ProductDetailField label="Disponible" value={formatNumber(row.available)} /></div></Card>
    <ProductDetailSection title="Existencia de la ubicación"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><ProductDetailField label="Reservado" value={formatNumber(row.reserved)} /><ProductDetailField label="Stock mínimo" value={formatNumber(row.minStock)} /><ProductDetailField label="Tipo de ubicación" value={row.inventoryScope === 'CORPORATE_WAREHOUSE' ? 'Almacén corporativo' : 'Bodega de sucursal'} /><ProductDetailField label="Rubro" value={row.businessUnitName || '—'} /></div></ProductDetailSection>
  </>;

  if (view === 'services') return <>
    <InfoGrid items={[["Sucursales", row.branchNames?.join(' · ') || row.branchName || '—'], ["Código", row.code], ["SKU", row.sku || row.code || '—'], ["Nombre", row.name], ["Categoría", row.category], ["Unidad", row.unit], ...(canViewInventoryCost ? [["Costo", formatMoney(row.costPrice)] as [string, unknown]] : [])]} />
    <DetailList title="Desglose por sucursal y ubicación" rows={locations.map((location: any) => `${location.branchName} · ${location.warehouseName} · ${formatNumber(location.quantity)} unidades (${formatNumber(location.available)} disponibles)`)} />
    <DetailList title="Precios por sucursal" rows={pricesByBranch.map((price: any) => `${price.branchName}: ${formatMoney(price.price, price.currency)}`)} />
  </>;

  if (view === 'warehouses') return <>
    <Card className="rounded-2xl border-primary/20 bg-primary/5 p-5 shadow-sm"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><ProductDetailField label="Almacén / bodega" value={row.name || '—'} /><ProductDetailField label="Tipo de ubicación" value={row.isCorporate ? 'Almacén corporativo' : 'Bodega de sucursal'} /><ProductDetailField label="Rubro" value={row.businessUnitName || '—'} /><ProductDetailField label="Ubicación física" value={row.location || '—'} /></div></Card>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><DetailMetric label="Stock visible" value={formatNumber(row.stockTotal)} /><DetailMetric label="Disponible" value={formatNumber(row.availableTotal)} tone="text-emerald-600" /><DetailMetric label="Reservado" value={formatNumber(row.reservedTotal)} tone="text-amber-600" /><DetailMetric label="Líneas" value={formatNumber(row.inventoryLines)} tone="text-primary" /></div>
    <ProductDetailSection title="Cobertura de sucursales"><div className="space-y-3"><p className="text-sm text-muted-foreground">{row.isCorporate ? 'Sucursales autorizadas para abastecerse desde este almacén.' : 'Sucursal propietaria de esta bodega.'}</p><div className="flex flex-wrap gap-2">{branches.length ? branches.map((branch: any) => <Badge key={branch.id} variant="secondary" className="rounded-lg px-3 py-1.5 text-xs font-bold"><Building2 className="mr-1.5 size-3.5" />{branch.name}</Badge>) : <span className="text-sm text-muted-foreground">Sin sucursales vinculadas.</span>}</div></div></ProductDetailSection>
    <ProductDetailSection title="Capacidad operativa"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><ProductDetailField label="Líneas de inventario" value={formatNumber(row.inventoryLines)} /><ProductDetailField label="Unidades ubicadas" value={formatNumber(row.stockTotal)} /><ProductDetailField label="Unidades disponibles" value={formatNumber(row.availableTotal)} /><ProductDetailField label="Unidades reservadas" value={formatNumber(row.reservedTotal)} /></div></ProductDetailSection>
  </>;

  if (view === 'adjustments') return <>
    <InfoGrid items={[["Fecha", formatDate(row.date)], ["Rubro", row.businessUnitName || '—'], ["Sucursal", row.branchName || '—'], ["Almacén / bodega", row.warehouseName || '—'], ["Motivo", row.reason ? formatAdjustmentReason(row.reason) : '—'], ["Estado", formatAdjustmentStatus(row.status)], ["Aprobado por", formatApproverName(row.approvedBy || row.approvedByName)], ["Fecha de aprobación", formatDate(row.approvedAt)], ["Variación", formatNumber(row.differenceUnits)], ...(canViewInventoryCost ? [["Impacto", formatMoney(row.impactAmount, row.currency || 'NIO')] as [string, unknown]] : [])]} />
    {row.notes && <Card className="rounded-2xl border-border/60 p-5 shadow-sm"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notas</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{row.notes}</p></Card>}
    <div className="min-w-0 overflow-x-auto rounded-2xl border border-border/60"><Table className="min-w-[760px]"><TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Existencia actual</TableHead><TableHead>Existencia real</TableHead><TableHead>Diferencia</TableHead>{canViewInventoryCost && <><TableHead>Costo unitario</TableHead><TableHead>Impacto</TableHead></>}</TableRow></TableHeader><TableBody>{(Array.isArray(row.items) ? row.items : []).map((item: any) => <TableRow key={item.id}><TableCell><p className="font-semibold">{item.productName || 'Producto'}</p><p className="text-xs text-muted-foreground">{item.productCode || '—'}{item.variantName ? ` · ${item.variantName}` : ''}</p></TableCell><TableCell>{formatNumber(item.currentStock)}</TableCell><TableCell>{formatNumber(item.actualStock)}</TableCell><TableCell className={item.difference < 0 ? 'font-bold text-rose-600' : item.difference > 0 ? 'font-bold text-emerald-600' : ''}>{item.difference > 0 ? '+' : ''}{formatNumber(item.difference)}</TableCell>{canViewInventoryCost && <><TableCell>{formatMoney(item.unitCost ?? item.baseCost, item.currency || 'NIO')}</TableCell><TableCell>{formatMoney(item.impactAmount, item.currency || 'NIO')}</TableCell></>}</TableRow>)}</TableBody></Table></div>
  </>;

  if (view === 'transfers') return <TransferDetailContent row={row} />;

  if (view === 'audits') {
    const auditItems = Array.isArray(row.items) ? row.items : [];
    return <>
      <InfoGrid items={[["Acta", row.number], ["Fecha", formatDate(row.auditDate)], ["Sucursal", row.branchName], ["Ubicación", row.warehouseName], ["Estado", formatStatus(row.status)], ["Responsable", row.supervisorName || row.stockKeeperName || '—'], ["Productos", formatNumber(row.itemCount)], ["Diferencia", formatNumber(row.difference)]]} />
      <ProductDetailSection title="Productos inspeccionados">
        <div className="space-y-3 sm:hidden">
          {auditItems.map((item: any, index: number) => {
            const auditItem = normalizeAuditItem(item);
            return <div key={item.id || item.productId || `${auditItem.code}-${index}`} className="rounded-xl border border-border/60 bg-muted/10 p-3">
              <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-3"><div className="min-w-0"><p className="break-words font-semibold leading-4">{auditItem.name}</p>{auditItem.variantName && <p className="mt-1 text-[10px] leading-3 text-muted-foreground">{auditItem.variantName}</p>}</div><span className="shrink-0 font-mono text-[10px] font-bold text-muted-foreground">{auditItem.code}</span></div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3"><AuditValue label="Stock sistema original" value={formatNumber(auditItem.originalStock)} /><AuditValue label="Contado" value={formatNumber(auditItem.countedStock)} /><AuditValue label="Diferencia" value={`${auditItem.difference > 0 ? '+' : ''}${formatNumber(auditItem.difference)}`} tone={auditItem.difference < 0 ? 'text-rose-600' : auditItem.difference > 0 ? 'text-emerald-600' : undefined} /><AuditValue label="Stock final" value={auditItem.finalStock === null || auditItem.finalStock === undefined ? '—' : formatNumber(auditItem.finalStock)} /></div>
            </div>;
          })}
        </div>
        <div className="hidden min-w-0 overflow-hidden rounded-2xl border border-border/60 sm:block">
          <Table className="w-full table-fixed text-xs">
            <TableHeader><TableRow><TableHead className="h-auto w-[16%] whitespace-normal break-words px-2 py-2 text-[10px] leading-3">Código</TableHead><TableHead className="h-auto w-[29%] whitespace-normal break-words px-2 py-2 text-[10px] leading-3">Producto</TableHead><TableHead className="h-auto w-[20%] whitespace-normal break-words px-2 py-2 text-[10px] leading-3">Stock sistema original</TableHead><TableHead className="h-auto w-[12%] whitespace-normal break-words px-2 py-2 text-[10px] leading-3">Contado</TableHead><TableHead className="h-auto w-[12%] whitespace-normal break-words px-2 py-2 text-[10px] leading-3">Diferencia</TableHead><TableHead className="h-auto w-[11%] whitespace-normal break-words px-2 py-2 text-[10px] leading-3">Stock final</TableHead></TableRow></TableHeader>
            <TableBody>{auditItems.map((item: any, index: number) => {
              const auditItem = normalizeAuditItem(item);
              return <TableRow key={item.id || item.productId || `${item.code || 'producto'}-${index}`}>
                <TableCell className="whitespace-normal break-words px-2 py-2 align-top font-mono text-[10px] font-bold leading-3">{auditItem.code}</TableCell>
                <TableCell className="whitespace-normal break-words px-2 py-2 align-top"><p className="font-semibold leading-4">{auditItem.name}</p>{auditItem.variantName && <p className="mt-1 text-[10px] leading-3 text-muted-foreground">{auditItem.variantName}</p>}</TableCell>
                <TableCell className="whitespace-normal break-words px-2 py-2 align-top tabular-nums">{formatNumber(auditItem.originalStock)}</TableCell>
                <TableCell className="whitespace-normal break-words px-2 py-2 align-top tabular-nums">{formatNumber(auditItem.countedStock)}</TableCell>
                <TableCell className={`whitespace-normal break-words px-2 py-2 align-top tabular-nums ${auditItem.difference < 0 ? 'font-bold text-rose-600' : auditItem.difference > 0 ? 'font-bold text-emerald-600' : 'font-semibold'}`}>{auditItem.difference > 0 ? '+' : ''}{formatNumber(auditItem.difference)}</TableCell>
                <TableCell className="whitespace-normal break-words px-2 py-2 align-top tabular-nums">{auditItem.finalStock === null || auditItem.finalStock === undefined ? '—' : formatNumber(auditItem.finalStock)}</TableCell>
              </TableRow>;
            })}</TableBody>
          </Table>
        </div>
      </ProductDetailSection>
      {row.notes && <Card className="rounded-2xl border-border/60 p-5 shadow-sm"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notas</p><p className="mt-2 break-words text-sm leading-6 text-muted-foreground">{row.notes}</p></Card>}
    </>;
  }

  if (view === 'losses') return <>
    <InfoGrid items={[["Ajuste", row.number], ["Fecha", formatDate(row.date)], ["Sucursal", row.branchName], ["Ubicación", row.warehouseName], ["Unidades perdidas", formatNumber(row.lossUnits)], ["Motivo", row.reason || '—'], ...(canViewInventoryCost ? [["Monto", formatMoney(row.lossAmount)] as [string, unknown]] : [])]} />
    {row.notes && <Card className="rounded-2xl border-border/60 p-5 shadow-sm"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notas</p><p className="mt-2 break-words text-sm leading-6 text-muted-foreground">{row.notes}</p></Card>}
  </>;

  if (view === 'movements') {
    const product = row.product || {};
    return <>
      <Card className="rounded-2xl border-primary/20 bg-primary/5 p-5 shadow-sm"><div className="flex items-start gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Package className="size-5" /></div><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Producto movimentado</p><p className="mt-1 break-words text-base font-black">{product.name || 'Producto'}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{product.code || 'Código no disponible'}</p></div><Badge variant="outline" className="shrink-0 text-[9px] font-black uppercase tracking-wider">{formatMovementType(row.type)}</Badge></div></Card>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><DetailMetric label="Existencia anterior" value={formatNumber(row.previousQty)} tone="text-muted-foreground" /><DetailMetric label="Cantidad movida" value={formatNumber(row.quantity)} tone={row.type === 'OUT' ? 'text-rose-600' : 'text-emerald-600'} /><DetailMetric label="Saldo resultante" value={formatNumber(row.resultingQty)} tone="text-primary" />{canViewInventoryCost ? <DetailMetric label="Costo unitario" value={formatMoney(row.unitCost, row.currency || 'NIO')} tone="text-violet-600" /> : <DetailMetric label="Estado" value="Registrado" tone="text-emerald-600" />}</div>
      <ProductDetailSection title="Ubicación y contexto"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><ProductDetailField label="Fecha" value={formatDate(row.date)} /><ProductDetailField label="Sucursal" value={row.branchName || '—'} /><ProductDetailField label="Rubro" value={row.businessUnitName || '—'} /><ProductDetailField label="Bodega / almacén" value={row.warehouse?.name || row.warehouseName || '—'} /><ProductDetailField label="Tipo de ubicación" value={row.warehouse?.scopeType === 'BUSINESS_UNIT' ? 'Almacén corporativo' : 'Bodega de sucursal'} /></div></ProductDetailSection>
      <ProductDetailSection title="Trazabilidad"><div className="space-y-3"><ProductDetailField label="Referencia operativa" value={formatMovementReference(row.reference)} /><p className="text-xs leading-5 text-muted-foreground">Este registro refleja el cambio aplicado al saldo de inventario en la ubicación seleccionada.</p></div></ProductDetailSection>
    </>;
  }

  return <InfoGrid items={[["Código", row.code || row.id], ["Activo", row.name], ["Categoría", row.category], ["Sucursal", row.branchName], ["Estado", formatStatus(row.status)], ...(canViewInventoryCost ? [["Costo", formatMoney(row.cost, row.currency || 'NIO')] as [string, unknown]] : []), ["Ubicación", row.location || row.warehouseName || '—']]} />;
}

function TransferDetailContent({ row }: { row: any }) {
  const items = Array.isArray(row.items) ? row.items : [];
  const transferUnits = Number(row.units || items.reduce((total: number, item: any) => total + Number(item.quantity || 0), 0));
  return <>
    <Card className="rounded-2xl border-primary/20 bg-primary/5 p-5 shadow-sm"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><ProductDetailField label="Número" value={row.number || '—'} mono /><ProductDetailField label="Fecha" value={formatDate(row.date)} /><ProductDetailField label="Estado" value={formatStatus(row.status)} /><ProductDetailField label="Sucursal de origen" value={row.sourceBranchName || '—'} /><ProductDetailField label="Productos" value={formatNumber(row.itemCount)} /><ProductDetailField label="Unidades" value={formatNumber(transferUnits)} /><ProductDetailField label="Aprobado por" value={formatApproverName(row.approvedBy || row.approvedByName)} /><ProductDetailField label="Fecha de aprobación" value={formatDate(row.approvedAt)} /></div></Card>
    <ProductDetailSection title="Ruta de la transferencia"><div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr]"><TransferEndpoint label="Salida" endpoint={row.from} delta={-transferUnits} /><div className="flex items-center justify-center gap-2 rounded-full border border-border/60 bg-muted/20 px-3 py-2 text-xs font-black uppercase tracking-widest text-muted-foreground"><span className="hidden sm:inline">Transferencia</span><ArrowRight className="size-4 rotate-90 text-primary sm:rotate-0" /></div><TransferEndpoint label="Entrada" endpoint={row.to} delta={transferUnits} /></div></ProductDetailSection>
    <DetailList title="Productos transferidos" rows={items.map((item: any) => `${item.code || item.productCode || 'Producto'} · ${item.name || 'Producto'} · ${formatNumber(item.quantity)} unidades`)} />
  </>;
}

function TransferEndpoint({ label, endpoint, delta }: { label: string; endpoint?: any; delta: number }) {
  const isEntry = delta >= 0;
  return <div className={`rounded-2xl border p-4 shadow-sm ${isEntry ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/5'}`}><div className="flex items-start justify-between gap-3"><div><p className={`text-[10px] font-black uppercase tracking-widest ${isEntry ? 'text-emerald-700' : 'text-rose-700'}`}>{label}</p><p className="mt-1 font-semibold">{endpoint?.name || '—'}</p></div><Badge variant="outline" className={`shrink-0 text-sm font-black tabular-nums ${isEntry ? 'border-emerald-500/30 text-emerald-700' : 'border-rose-500/30 text-rose-700'}`}>{delta > 0 ? '+' : ''}{formatNumber(delta)}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{endpoint?.scopeType === 'BRANCH' ? 'Bodega de sucursal' : endpoint?.scopeType === 'BUSINESS_UNIT' ? 'Almacén corporativo' : 'Ubicación no especificada'}</p><p className={`mt-1 text-[10px] font-bold uppercase tracking-wider ${isEntry ? 'text-emerald-700' : 'text-rose-700'}`}>{isEntry ? 'Unidades que ingresan' : 'Unidades que salen'}</p></div>;
}

function formatAdjustmentStatus(value: unknown) {
  return ({ DRAFT: 'Borrador', SENT: 'Enviado', APPROVED: 'Aprobado', REJECTED: 'Rechazado', CANCELLED: 'Cancelado' } as Record<string, string>)[String(value || '').toUpperCase()] || String(value || 'Sin estado');
}

function formatAdjustmentReason(value: unknown) {
  return ({ DISCREPANCY: 'Diferencia de inventario', DAMAGE: 'Daño', EXPIRATION: 'Vencimiento', THEFT: 'Pérdida / robo', OTHER: 'Otro' } as Record<string, string>)[String(value || '').toUpperCase()] || String(value || 'Sin motivo');
}

function resolveRecordBranchTargets(row: any | null) {
  const candidates: Array<{ id: string; name: string }> = [];
  const directBranchId = row?.branchId || row?.clientTenantId;
  if (directBranchId) candidates.push({ id: String(directBranchId), name: String(row?.branchName || 'Sucursal') });
  if (Array.isArray(row?.branches)) row.branches.forEach((branch: any) => { if (branch?.id) candidates.push({ id: String(branch.id), name: String(branch.name || 'Sucursal') }); });
  if (Array.isArray(row?.locations)) row.locations.forEach((location: any) => { if (location?.branchId) candidates.push({ id: String(location.branchId), name: String(location.branchName || 'Sucursal') }); });

  const unique = new Map<string, { id: string; name: string }>();
  candidates.forEach((candidate) => { if (!unique.has(candidate.id)) unique.set(candidate.id, candidate); });
  return Array.from(unique.values());
}

function resolveRecordBranchId(row: any | null) {
  const directBranchId = row?.branchId || row?.clientTenantId;
  if (directBranchId) return String(directBranchId);
  const targets = resolveRecordBranchTargets(row);
  return targets.length === 1 ? targets[0].id : '';
}

function AuditValue({ label, value, tone = 'text-foreground' }: { label: string; value: string; tone?: string }) {
  return <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p><p className={`mt-1 break-words text-sm font-bold tabular-nums ${tone}`}>{value}</p></div>;
}

function InfoGrid({ items }: { items: Array<[string, unknown]> }) { return <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-3">{items.map(([label, value]) => <div key={label}><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-1 truncate text-sm font-semibold">{String(value ?? '—')}</p></div>)}</div>; }
function DetailList({ title, rows }: { title: string; rows: string[] }) { return <div className="rounded-2xl border border-border/60 p-4"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{title}</p><div className="mt-3 space-y-2">{rows.length ? rows.map((row, index) => <div key={`${row}-${index}`} className="rounded-xl bg-muted/30 px-3 py-2 text-sm">{row}</div>) : <p className="text-sm text-muted-foreground">Sin información.</p>}</div></div>; }
function warehousesForBranch(warehouses: WarehouseOption[], branchId: string) { return warehouses.filter((warehouse) => warehouse.clientTenantId === branchId || warehouse.authorizedBranchIds?.includes(branchId)); }
function exportRow(view: ManagerInventoryView, row: any, canViewInventoryCost: boolean) { if (view === 'branchInventory' || view === 'corporateInventory') return { Alcance: view === 'branchInventory' ? 'Mi sucursal' : 'Almacén corporativo', Código: row.code, Producto: row.name, SKU: row.sku, Sucursal: row.branchName, Ubicación: row.warehouseName, Stock: row.quantity, Reservado: row.reserved, Disponible: row.available }; if (view === 'products' || view === 'services') return { Sucursales: row.branchNames?.join(', ') || row.branchName, Código: row.code, SKU: row.sku || row.code, Nombre: row.name, Categoría: row.category, Unidad: row.unit, ...(canViewInventoryCost ? { Costo: row.costPrice } : {}), 'Stock total': row.branchStock, 'Disponible total': row.branchAvailable, Ubicaciones: row.locationCount, Desglose: row.locations.map((location: any) => `${location.branchName} / ${location.warehouseName}: ${location.quantity}`).join(' | ') }; if (view === 'warehouses') return { Nombre: row.name, Rubro: row.businessUnitName, Tipo: row.isCorporate ? 'Corporativo' : 'Bodega de sucursal', Sucursales: row.branches.map((branch: any) => branch.name).join(', '), Ubicación: row.location, 'Stock visible': row.stockTotal, Disponible: row.availableTotal }; if (view === 'transfers') return { Número: row.number, Fecha: formatDate(row.date), Origen: row.from?.name, Destino: row.to?.name, Estado: formatStatus(row.status), Productos: row.itemCount, Unidades: row.units }; if (view === 'audits') return { Acta: row.number, Fecha: formatDate(row.auditDate), Sucursal: row.branchName, Ubicación: row.warehouseName, Estado: formatStatus(row.status), Productos: row.itemCount, Diferencia: row.difference }; if (view === 'losses') return { Ajuste: row.number, Fecha: formatDate(row.date), Sucursal: row.branchName, Unidades: row.lossUnits, ...(canViewInventoryCost ? { Monto: row.lossAmount } : {}), Motivo: row.reason }; if (view === 'movements') return { Fecha: formatDate(row.date), Código: row.product?.code, Producto: row.product?.name, Sucursal: row.branchName, Ubicación: row.warehouse?.name, Tipo: formatMovementType(row.type), Cantidad: row.quantity, Saldo: row.resultingQty, Referencia: formatMovementReference(row.reference) }; return { Código: row.code, Activo: row.name, Categoría: row.category, Sucursal: row.branchName, Estado: formatStatus(row.status), ...(canViewInventoryCost ? { Costo: row.cost } : {}), Ubicación: row.location };
}
