import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { CalendarDays, ClipboardCheck, Clock3, Download, Eye, FileDown, Package, Search, Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { enterpriseGroupsService, type ManagerInventoryAdjustmentsResponse } from '../../services/enterprise-groups.service';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import type { ManagerInventoryView } from './manager-inventory.types';

type BranchOption = { id: string; name: string; businessUnitId?: string | null };
type WarehouseOption = { id: string; name: string; scopeType: string; clientTenantId: string | null; businessUnitId?: string | null; authorizedBranchIds?: string[] };

const statusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviado',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  CANCELLED: 'Cancelado',
};

const reasonLabels: Record<string, string> = {
  DISCREPANCY: 'Diferencia de inventario',
  DAMAGE: 'Daño',
  EXPIRATION: 'Vencimiento',
  THEFT: 'Pérdida / robo',
  OTHER: 'Otro',
};

const numberFormat = new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 });
const formatNumber = (value: unknown) => numberFormat.format(Number(value || 0));
const formatCurrency = (value: unknown, currency = 'NIO') => `${currency} ${numberFormat.format(Number(value || 0))}`;
const formatDate = (value: unknown) => value ? new Intl.DateTimeFormat('es-NI', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(String(value))) : '—';
const statusLabel = (value: unknown) => statusLabels[String(value || '').toUpperCase()] || String(value || 'Sin estado');
const reasonLabel = (value: unknown) => reasonLabels[String(value || '').toUpperCase()] || String(value || 'Sin motivo');

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'APPROVED') return 'default';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'destructive';
  if (status === 'SENT') return 'secondary';
  return 'outline';
}

export function ManagerInventorySubnav({ value, onChange }: { value: ManagerInventoryView; onChange: (value: ManagerInventoryView) => void }) {
  return (
    <div className="flex min-w-0 gap-2 overflow-x-auto rounded-2xl border border-border/60 bg-card p-2 shadow-sm" role="tablist" aria-label="Vistas del inventario Manager">
      <button type="button" role="tab" aria-selected={value === 'overview'} onClick={() => onChange('overview')} className={`flex-none rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${value === 'overview' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
        Resumen de inventario
      </button>
      <button type="button" role="tab" aria-selected={value === 'adjustments'} onClick={() => onChange('adjustments')} className={`flex-none rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${value === 'adjustments' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
        Ajustes
      </button>
    </div>
  );
}

export function ManagerInventoryAdjustmentsView({ groupId, businessUnitId, branchId, branches, warehouses, embedded = false, refreshKey = 0 }: {
  groupId: string;
  businessUnitId?: string;
  branchId?: string;
  branches: BranchOption[];
  warehouses: WarehouseOption[];
  embedded?: boolean;
  refreshKey?: number;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selectedAdjustment, setSelectedAdjustment] = useState<ManagerInventoryAdjustmentsResponse['data'][number] | null>(null);
  const [exporting, setExporting] = useState(false);
  const queryClient = useQueryClient();

  const visibleWarehouses = useMemo(() => warehouses.filter((warehouse) => {
    if (businessUnitId && warehouse.businessUnitId && warehouse.businessUnitId !== businessUnitId) return false;
    if (!branchId) return true;
    return warehouse.clientTenantId === branchId || warehouse.authorizedBranchIds?.includes(branchId) || (warehouse.scopeType === 'BUSINESS_UNIT' && warehouse.businessUnitId === businessUnitId);
  }), [branchId, businessUnitId, warehouses]);

  const query = useTenantQuery(
    ['manager-inventory-adjustments', refreshKey, groupId, businessUnitId || 'all', branchId || 'all', warehouseId || 'all', status || 'all', reason || 'all', search, dateFrom, dateTo, page],
    (signal) => enterpriseGroupsService.getAdjustments(groupId, { businessUnitId, branchId, warehouseId, status, reason, search, dateFrom, dateTo, page, pageSize: 25 }, signal),
    { enabled: Boolean(groupId) },
  );
  const response = query.data;
  const rows = response?.data || [];
  const metrics = response?.metrics;
  const meta = response?.meta;

  const resetPage = () => setPage(1);
  const updateFilter = (setter: (value: string) => void, value: string) => { setter(value); resetPage(); };

  const exportReport = async () => {
    setExporting(true);
    try {
      const report = await enterpriseGroupsService.getAdjustments(groupId, { businessUnitId, branchId, warehouseId, status, reason, search, dateFrom, dateTo, page: 1, pageSize: 5000, report: true });
      const exportRows = report.data.map((row) => ({
        Ajuste: row.number,
        Fecha: formatDate(row.date),
        Rubro: row.businessUnitName || '—',
        Sucursal: row.branchName || '—',
        Almacén: row.warehouseName || '—',
        Motivo: reasonLabel(row.reason),
        Productos: row.itemCount,
        'Unidades aumentadas': row.increasedUnits,
        'Unidades disminuidas': row.decreasedUnits,
        'Impacto monetario': row.impactAmount,
        Estado: statusLabel(row.status),
      }));
      if (!exportRows.length) return;
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(exportRows), 'Ajustes');
      XLSX.writeFile(workbook, `ajustes-manager-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['tenant-module'] }); };

  return (
    <div className="min-w-0 space-y-5">
      {!embedded && <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h3 className="truncate text-2xl font-black uppercase italic tracking-tight sm:text-3xl">Ajustes</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={exportReport} disabled={exporting || query.isLoading}><FileDown className="mr-2 size-4" />{exporting ? 'Preparando…' : 'Exportar Excel'}</Button>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => window.print()}><Download className="mr-2 size-4" />Imprimir / PDF</Button>
        </div>
      </div>}

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Ajustes encontrados" value={metrics?.total} icon={ClipboardCheck} />
        <MetricCard label="Aprobados" value={metrics?.approved} icon={Scale} tone="text-primary bg-primary/10" />
        <MetricCard label="Pendientes" value={(metrics?.drafts || 0) + (metrics?.sent || 0)} icon={Clock3} tone="text-primary bg-primary/10" />
        <MetricCard label="Productos afectados" value={metrics?.productsAffected} icon={Package} tone="text-primary bg-primary/10" />
        <MetricCard label="Unidades aumentadas" value={metrics?.increasedUnits} icon={TrendingUp} tone="text-primary bg-primary/10" />
        <MetricCard label="Unidades disminuidas" value={metrics?.decreasedUnits} icon={TrendingDown} tone="text-primary bg-primary/10" />
        <MetricCard label="Impacto monetario" value={formatCurrency(metrics?.monetaryImpact, 'NIO')} icon={Scale} tone="text-primary bg-primary/10" />
        <MetricCard label="Pérdidas registradas" value={formatCurrency(metrics?.lossAmount, 'NIO')} icon={TrendingDown} tone="text-primary bg-primary/10" />
      </div>

      <Card className="min-w-0 rounded-3xl border-border/60 shadow-sm">
        <CardHeader className="gap-4 border-b border-border/60 pb-5">
          <CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic tracking-tight"><Search className="size-5 text-primary" />Filtros de consulta</CardTitle>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <label className="min-w-0 space-y-1.5 text-xs font-bold text-muted-foreground xl:col-span-2"><span>Buscar ajuste o producto</span><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => updateFilter(setSearch, event.target.value)} placeholder="Número, nota, código…" className="pl-9" /></div></label>
            <FilterSelect label="Estado" value={status} onChange={(value) => updateFilter(setStatus, value)} options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))} />
            <FilterSelect label="Motivo" value={reason} onChange={(value) => updateFilter(setReason, value)} options={Object.entries(reasonLabels).map(([value, label]) => ({ value, label }))} />
            <FilterSelect label="Almacén / bodega" value={warehouseId} onChange={(value) => updateFilter(setWarehouseId, value)} options={visibleWarehouses.map((warehouse) => ({ value: warehouse.id, label: warehouse.name }))} />
            <label className="min-w-0 space-y-1.5 text-xs font-bold text-muted-foreground"><span>Desde</span><div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input type="date" value={dateFrom} onChange={(event) => updateFilter(setDateFrom, event.target.value)} className="pl-9" /></div></label>
            <label className="min-w-0 space-y-1.5 text-xs font-bold text-muted-foreground"><span>Hasta</span><div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input type="date" value={dateTo} onChange={(event) => updateFilter(setDateTo, event.target.value)} className="pl-9" /></div></label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>{meta?.total || 0} registro(s) en el alcance seleccionado</span><Button type="button" variant="ghost" size="sm" className="rounded-lg" onClick={() => { setSearch(''); setStatus(''); setReason(''); setWarehouseId(''); setDateFrom(''); setDateTo(''); resetPage(); refresh(); }}>Limpiar filtros</Button></div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isLoading && <div className="p-10 text-center text-sm text-muted-foreground">Cargando ajustes consolidados…</div>}
          {query.isError && <div className="p-10 text-center text-sm text-destructive">No se pudieron cargar los ajustes. {query.error.message}</div>}
          {!query.isLoading && !query.isError && !rows.length && <div className="p-10 text-center text-sm text-muted-foreground">No hay ajustes para los filtros seleccionados.</div>}
          {!query.isLoading && !query.isError && rows.length > 0 && <div className="sales-responsive-table overflow-x-auto"><Table className="min-w-[980px]"><TableHeader><TableRow><TableHead>Ajuste</TableHead><TableHead>Fecha</TableHead><TableHead>Rubro / sucursal</TableHead><TableHead>Almacén / bodega</TableHead><TableHead>Motivo</TableHead><TableHead>Productos</TableHead><TableHead>Variación</TableHead><TableHead>Impacto</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell className="font-bold">{row.number}</TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(row.date)}</TableCell><TableCell><div className="min-w-0"><p className="font-semibold">{row.branchName || '—'}</p><p className="text-xs text-muted-foreground">{row.businessUnitName || 'Sin rubro'}</p></div></TableCell><TableCell>{row.warehouseName || '—'}</TableCell><TableCell>{reasonLabel(row.reason)}</TableCell><TableCell>{formatNumber(row.itemCount)}</TableCell><TableCell><span className={row.differenceUnits < 0 ? 'font-bold text-rose-600' : row.differenceUnits > 0 ? 'font-bold text-emerald-600' : 'text-muted-foreground'}>{row.differenceUnits > 0 ? '+' : ''}{formatNumber(row.differenceUnits)}</span></TableCell><TableCell className="whitespace-nowrap">{formatCurrency(row.impactAmount, row.currency || 'NIO')}</TableCell><TableCell><Badge variant={statusVariant(String(row.status))}>{statusLabel(row.status)}</Badge></TableCell><TableCell className="text-right"><Button type="button" variant="ghost" size="sm" className="rounded-lg" onClick={() => setSelectedAdjustment(row)}><Eye className="mr-1.5 size-4" />Ver detalle</Button></TableCell></TableRow>)}</TableBody></Table></div>}
          {meta && meta.totalPages > 1 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-5 py-4 text-sm"><span className="text-muted-foreground">Página {meta.page} de {meta.totalPages}</span><div className="flex gap-2"><Button type="button" variant="outline" size="sm" className="rounded-lg" disabled={meta.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</Button><Button type="button" variant="outline" size="sm" className="rounded-lg" disabled={meta.page >= meta.totalPages} onClick={() => setPage((current) => Math.min(meta.totalPages, current + 1))}>Siguiente</Button></div></div>}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedAdjustment)} onOpenChange={(open) => !open && setSelectedAdjustment(null)}>
        <DialogContent className="!max-w-4xl rounded-3xl">
          {selectedAdjustment && <><DialogHeader><DialogTitle className="text-xl font-black uppercase italic tracking-tight">Detalle del ajuste {selectedAdjustment.number}</DialogTitle><DialogDescription>Consulta de solo lectura. La operación pertenece a {selectedAdjustment.branchName || 'la sucursal seleccionada'}.</DialogDescription></DialogHeader><div className="grid min-w-0 grid-cols-1 gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4"><InfoItem label="Fecha" value={formatDate(selectedAdjustment.date)} /><InfoItem label="Rubro" value={selectedAdjustment.businessUnitName || '—'} /><InfoItem label="Sucursal" value={selectedAdjustment.branchName || '—'} /><InfoItem label="Almacén / bodega" value={selectedAdjustment.warehouseName || '—'} /><InfoItem label="Motivo" value={reasonLabel(selectedAdjustment.reason)} /><InfoItem label="Estado" value={statusLabel(selectedAdjustment.status)} /><InfoItem label="Variación" value={formatNumber(selectedAdjustment.differenceUnits)} /><InfoItem label="Impacto" value={formatCurrency(selectedAdjustment.impactAmount, selectedAdjustment.currency || 'NIO')} /></div>{selectedAdjustment.notes && <div className="rounded-2xl border border-border/60 p-4 text-sm"><p className="mb-1 text-xs font-black uppercase tracking-widest text-muted-foreground">Notas</p><p className="whitespace-pre-wrap">{selectedAdjustment.notes}</p></div>}<div className="min-w-0 overflow-x-auto rounded-2xl border border-border/60"><Table className="min-w-[760px]"><TableHeader><TableRow><TableHead>Producto</TableHead><TableHead>Existencia actual</TableHead><TableHead>Existencia real</TableHead><TableHead>Diferencia</TableHead><TableHead>Costo unitario</TableHead><TableHead>Impacto</TableHead></TableRow></TableHeader><TableBody>{selectedAdjustment.items.map((item) => <TableRow key={item.id}><TableCell><p className="font-semibold">{item.productName || 'Producto'}</p><p className="text-xs text-muted-foreground">{item.productCode || '—'}{item.variantName ? ` · ${item.variantName}` : ''}</p></TableCell><TableCell>{formatNumber(item.currentStock)}</TableCell><TableCell>{formatNumber(item.actualStock)}</TableCell><TableCell className={item.difference < 0 ? 'font-bold text-rose-600' : item.difference > 0 ? 'font-bold text-emerald-600' : ''}>{item.difference > 0 ? '+' : ''}{formatNumber(item.difference)}</TableCell><TableCell>{formatCurrency(item.unitCost ?? item.baseCost, item.currency || 'NIO')}</TableCell><TableCell>{formatCurrency(item.impactAmount, item.currency || 'NIO')}</TableCell></TableRow>)}</TableBody></Table></div></>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, tone = 'text-primary bg-primary/10' }: { label: string; value: unknown; icon: typeof ClipboardCheck; tone?: string }) {
  return <Card className="rounded-2xl border-border/60 shadow-sm"><CardContent className="flex min-w-0 items-center gap-3 p-4"><div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="size-5" /></div><div className="min-w-0"><p className="truncate text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-1 truncate text-xl font-black tracking-tight">{value === undefined ? '—' : typeof value === 'number' ? formatNumber(value) : value}</p></div></CardContent></Card>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className="min-w-0 space-y-1.5 text-xs font-bold text-muted-foreground"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full min-w-0 rounded-md border border-border bg-background px-3 text-sm font-normal text-foreground outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"><option value="">Todos</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-1 truncate text-sm font-semibold">{value}</p></div>;
}
