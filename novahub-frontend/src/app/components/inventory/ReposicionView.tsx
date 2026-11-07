import { Fragment, useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronRight, PackagePlus, PackageX, Search, Sparkles, TrendingDown, Wallet } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { cn } from '../ui/utils';
import { toast } from '../../services/toast';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { inventoryService, type ReplenishmentRow, type ReplenishmentUrgency } from '../../services/inventario.service';
import { purchaseOrdersService } from '../../services/compras.service';

interface Props {
  warehouses: Array<{ id: string; name: string }>;
}

const URGENCY_META: Record<ReplenishmentUrgency, { label: string; className: string }> = {
  OUT_OF_STOCK: { label: 'Agotado', className: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
  CRITICAL: { label: 'Crítico', className: 'bg-orange-500/15 text-orange-700 dark:text-orange-300' },
  SOON: { label: 'Pronto', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  OK: { label: 'Al día', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  OVERSTOCK: { label: 'Sobrestock', className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  NO_MOVEMENT: { label: 'Sin movimiento', className: 'bg-slate-500/15 text-slate-700 dark:text-slate-300' },
};
const URGENCY_FILTERS: Array<{ id: ReplenishmentUrgency | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'Todos' },
  { id: 'OUT_OF_STOCK', label: 'Agotados' },
  { id: 'CRITICAL', label: 'Críticos' },
  { id: 'SOON', label: 'Pronto' },
  { id: 'OVERSTOCK', label: 'Sobrestock' },
  { id: 'NO_MOVEMENT', label: 'Sin movimiento' },
];
const PAGE_SIZES = [50, 100, 200] as const;
const number = (value: number, digits = 0) => value.toLocaleString('es-NI', { maximumFractionDigits: digits });

/**
 * Reposición inteligente: sugiere qué comprar y cuánto según la demanda real, el plazo de entrega del
 * proveedor y el stock de seguridad. Desde aquí se crean órdenes de compra en borrador por proveedor.
 */
export function ReposicionView({ warehouses }: Props) {
  const { canPerform } = useAuth();
  const { baseCurrency, formatExplicitAmount } = useCurrency();
  const queryClient = useQueryClient();
  const canCreateOrders = canPerform('PURCHASES_ORDERS', 'create');
  const money = (amount: number | null | undefined) => (amount === null || amount === undefined ? '—' : formatExplicitAmount(amount, baseCurrency));

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [urgency, setUrgency] = useState<ReplenishmentUrgency | 'ALL'>('ALL');
  const [onlyActionable, setOnlyActionable] = useState(true);
  const [warehouseId, setWarehouseId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(50);
  const [coverDays, setCoverDays] = useState('30');
  const [serviceLevel, setServiceLevel] = useState('95');
  const [leadTime, setLeadTime] = useState('7');
  const [applied, setApplied] = useState({ coverDays: '30', serviceLevel: '95', leadTime: '7' });
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const query = useTenantQuery(
    ['inventory', 'replenishment', search, urgency, onlyActionable, warehouseId, page, pageSize, applied.coverDays, applied.serviceLevel, applied.leadTime],
    (signal) => inventoryService.getReplenishment({
      search: search || undefined,
      urgency: urgency === 'ALL' ? undefined : urgency,
      onlyActionable: onlyActionable || undefined,
      warehouseId: warehouseId || undefined,
      page, pageSize,
      coverDays: applied.coverDays, serviceLevel: applied.serviceLevel, leadTimeDays: applied.leadTime,
    }, signal),
    { placeholderData: keepPreviousData, staleTime: 30_000 },
  );
  const rows = useMemo(() => query.data?.data ?? [], [query.data]);
  const summary = query.data?.summary;
  const meta = query.data?.meta;

  const selectedRows = useMemo(() => rows.filter((row) => selected[row.key] !== undefined), [rows, selected]);
  const toggleRow = (row: ReplenishmentRow, checked: boolean) => setSelected((current) => {
    const next = { ...current };
    if (checked) next[row.key] = Math.max(1, row.suggestedQty);
    else delete next[row.key];
    return next;
  });
  const selectableRows = rows.filter((row) => row.suggestedQty > 0);
  const allChecked = selectableRows.length > 0 && selectableRows.every((row) => selected[row.key] !== undefined);

  // Las filas elegidas se agrupan por proveedor y bodega: una orden de compra en borrador por grupo.
  const groups = useMemo(() => {
    const map = new Map<string, { supplierId: string; supplierName: string; warehouseId: string; warehouseName: string; rows: ReplenishmentRow[] }>();
    for (const row of selectedRows) {
      if (!row.supplierId) continue;
      const key = `${row.supplierId}|${row.warehouseId}`;
      const group = map.get(key) || { supplierId: row.supplierId, supplierName: row.supplierName || 'Proveedor', warehouseId: row.warehouseId, warehouseName: row.warehouseName, rows: [] };
      group.rows.push(row);
      map.set(key, group);
    }
    return [...map.values()];
  }, [selectedRows]);
  const withoutSupplier = selectedRows.filter((row) => !row.supplierId);

  const createOrders = async () => {
    setCreating(true);
    const today = new Date().toISOString().slice(0, 10);
    const created: string[] = [];
    const failed: string[] = [];
    for (const group of groups) {
      try {
        const order = await purchaseOrdersService.create({
          supplierId: group.supplierId,
          warehouseId: group.warehouseId,
          date: today,
          status: 'DRAFT',
          purchaseType: 'INVENTORY',
          notes: 'Generada desde Reposición inteligente. Revisa cantidades y precios antes de aprobar.',
          items: group.rows.map((row) => ({
            productId: row.productId,
            variantId: row.variantId || undefined,
            code: row.productCode,
            name: row.productName,
            description: row.productName,
            quantity: selected[row.key],
            unitPrice: row.unitCost ?? 0,
            stockApplies: true,
          })),
        } as unknown as Parameters<typeof purchaseOrdersService.create>[0]);
        created.push(order?.number || group.supplierName);
      } catch (error) {
        const detail = error as { response?: { data?: { message?: string } }; message?: string };
        failed.push(`${group.supplierName}: ${detail?.response?.data?.message || detail?.message || 'no se pudo crear'}`);
      }
    }
    setCreating(false);
    if (created.length) toast.success(`Órdenes en borrador creadas: ${created.join(', ')}.`);
    if (failed.length) toast.error(failed.join(' · '));
    if (created.length) {
      setSelected({});
      setConfirmOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['purchases'] });
      void query.refetch();
    }
  };

  const kpis = [
    { label: 'Agotados / críticos', value: summary ? number(summary.byUrgency.OUT_OF_STOCK + summary.byUrgency.CRITICAL) : '—', icon: PackageX, tone: 'text-rose-500 bg-rose-500/10' },
    { label: 'Conviene comprar', value: summary ? number(summary.toBuy) : '—', icon: PackagePlus, tone: 'text-amber-500 bg-amber-500/10' },
    { label: 'Inversión estimada', value: summary ? money(summary.estimatedInvestment) : '—', icon: Wallet, tone: 'text-emerald-500 bg-emerald-500/10' },
    { label: 'Capital inmovilizado', value: summary ? money(summary.overstockValue) : '—', icon: TrendingDown, tone: 'text-sky-500 bg-sky-500/10' },
  ];

  return (
    <div className="min-w-0 space-y-4" data-testid="inventory-replenishment">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-black uppercase tracking-tight"><Sparkles className="size-5 text-primary" aria-hidden /> Reposición inteligente</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Calcula qué comprar y cuánto con tus ventas de los últimos 90 días (sin contar los días en que el producto estuvo agotado), el plazo real de tu proveedor y un stock de seguridad según la variabilidad de la demanda.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <span className={cn('flex size-10 items-center justify-center rounded-xl', kpi.tone)}><kpi.icon className="size-5" aria-hidden /></span>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-black uppercase tracking-widest text-muted-foreground">{kpi.label}</p>
                <p className="truncate text-lg font-black tabular-nums">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" aria-hidden />
              <Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Buscar producto o código" className="h-10 pl-9" aria-label="Buscar producto o código" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bodega</Label>
              <select value={warehouseId} onChange={(event) => { setWarehouseId(event.target.value); setPage(1); }} className="h-10 rounded-md border border-input bg-background px-2 text-sm" aria-label="Filtrar por bodega">
                <option value="">Todas</option>
                {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
              </select>
            </div>
            <label className="flex h-10 items-center gap-2 text-xs font-semibold">
              <Checkbox checked={onlyActionable} onCheckedChange={(checked) => { setOnlyActionable(checked === true); setPage(1); }} aria-label="Mostrar solo lo que conviene comprar" />
              Solo lo que conviene comprar
            </label>
          </div>

          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-border p-3">
            <div className="space-y-1">
              <Label htmlFor="rep-cover" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Días a cubrir</Label>
              <Input id="rep-cover" type="number" min={1} max={365} value={coverDays} onChange={(event) => setCoverDays(event.target.value)} className="h-9 w-24 tabular-nums" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rep-service" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nivel de servicio %</Label>
              <Input id="rep-service" type="number" min={50} max={99.9} step="0.5" value={serviceLevel} onChange={(event) => setServiceLevel(event.target.value)} className="h-9 w-28 tabular-nums" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="rep-lead" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Plazo si no hay historial (días)</Label>
              <Input id="rep-lead" type="number" min={1} max={120} value={leadTime} onChange={(event) => setLeadTime(event.target.value)} className="h-9 w-28 tabular-nums" />
            </div>
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => { setApplied({ coverDays, serviceLevel, leadTime }); setPage(1); setSelected({}); }}>Recalcular</Button>
            <p className="min-w-[220px] flex-1 text-[11px] text-muted-foreground">Un nivel de servicio más alto reserva más stock de seguridad. El plazo real se toma de tus recepciones anteriores.</p>
          </div>

          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por urgencia">
            {URGENCY_FILTERS.map((filter) => {
              const count = filter.id === 'ALL' ? summary?.total : summary?.byUrgency[filter.id];
              return (
                <Button key={filter.id} type="button" size="sm" variant={urgency === filter.id ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => { setUrgency(filter.id); setPage(1); }}>
                  {filter.label}{count !== undefined ? ` · ${count}` : ''}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {canCreateOrders && selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3" role="status">
          <p className="text-sm font-semibold">{selectedRows.length} artículo(s) elegidos · {groups.length} orden(es) por proveedor{withoutSupplier.length ? ` · ${withoutSupplier.length} sin proveedor (se omiten)` : ''}</p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected({})}>Quitar selección</Button>
            <Button type="button" size="sm" disabled={groups.length === 0} onClick={() => setConfirmOpen(true)}>Crear órdenes de compra en borrador</Button>
          </div>
        </div>
      )}

      {query.isError && <p className="text-sm text-destructive" role="alert">No se pudieron calcular las sugerencias. Intenta de nuevo.</p>}
      {query.isLoading && <p className="text-sm text-muted-foreground" role="status">Calculando sugerencias…</p>}

      {!query.isLoading && rows.length === 0 && !query.isError && (
        <Card className="rounded-2xl border-dashed"><CardContent className="p-8 text-center text-sm text-muted-foreground">
          No hay artículos para mostrar con estos filtros. Si acabas de cargar el inventario, la sugerencia aparece cuando hay existencias por bodega y ventas registradas.
        </CardContent></Card>
      )}

      {rows.length > 0 && (
        <Card className="min-w-0 overflow-hidden rounded-2xl border-border/60 shadow-sm">
          <Table containerClassName="max-h-[560px]" className="min-w-[1100px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {canCreateOrders && (
                  <TableHead className="w-10">
                    <Checkbox checked={allChecked} aria-label="Elegir todo lo sugerido en esta página"
                      onCheckedChange={(checked) => setSelected((current) => {
                        const next = { ...current };
                        selectableRows.forEach((row) => { if (checked === true) next[row.key] = Math.max(1, row.suggestedQty); else delete next[row.key]; });
                        return next;
                      })} />
                  </TableHead>
                )}
                {['Artículo', 'Bodega', 'Disponible', 'En camino', 'Demanda/día', 'Cobertura', 'Plazo', 'Reorden', 'Sugerido', 'Proveedor', 'Estado'].map((heading) => (
                  <TableHead key={heading} className="whitespace-nowrap text-[10px] uppercase tracking-widest">{heading}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const meta = URGENCY_META[row.urgency];
                const open = expanded === row.key;
                return (
                  <Fragment key={row.key}>
                    <TableRow className={cn(row.urgency === 'OUT_OF_STOCK' && 'bg-rose-500/5')}>
                      {canCreateOrders && (
                        <TableCell>
                          <Checkbox checked={selected[row.key] !== undefined} disabled={row.suggestedQty <= 0} aria-label={`Elegir ${row.productName}`} onCheckedChange={(checked) => toggleRow(row, checked === true)} />
                        </TableCell>
                      )}
                      <TableCell className="min-w-[200px]">
                        <button type="button" className="flex items-start gap-1 text-left" onClick={() => setExpanded(open ? null : row.key)} aria-expanded={open} aria-label={`Ver el detalle de ${row.productName}`}>
                          {open ? <ChevronDown className="mt-0.5 size-4 shrink-0" aria-hidden /> : <ChevronRight className="mt-0.5 size-4 shrink-0" aria-hidden />}
                          <span>
                            <span className="block font-bold">{row.productName}</span>
                            <span className="block text-[11px] text-muted-foreground">{row.productCode} · ABC {row.abcClass}{row.category ? ` · ${row.category}` : ''}</span>
                          </span>
                        </button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{row.warehouseName}</TableCell>
                      <TableCell className="tabular-nums">{number(row.available, 2)}</TableCell>
                      <TableCell className="tabular-nums">
                        {number(row.incoming, 2)}
                        {row.draftQty > 0 && <Badge variant="outline" className="ml-1 text-[9px]">+{number(row.draftQty)} borrador</Badge>}
                      </TableCell>
                      <TableCell className="tabular-nums">{number(row.dailyDemand, 2)}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{row.daysOfCover === null ? '—' : `${number(row.daysOfCover, 0)} d`}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{number(row.leadTimeDays, 0)} d{row.leadTimeSource === 'DEFAULT' ? ' (est.)' : ''}</TableCell>
                      <TableCell className="tabular-nums">{number(row.reorderPoint)}</TableCell>
                      <TableCell>
                        {row.suggestedQty > 0 && canCreateOrders && selected[row.key] !== undefined ? (
                          <Input type="number" min={1} value={selected[row.key]} aria-label={`Cantidad a pedir de ${row.productName}`} className="h-8 w-24 tabular-nums"
                            onChange={(event) => setSelected((current) => ({ ...current, [row.key]: Math.max(1, Number(event.target.value) || 1) }))} />
                        ) : (
                          <span className="font-black tabular-nums">{row.suggestedQty > 0 ? number(row.suggestedQty) : '—'}</span>
                        )}
                      </TableCell>
                      <TableCell className="min-w-[140px]">{row.supplierName || <span className="text-xs text-muted-foreground">Sin proveedor previo</span>}</TableCell>
                      <TableCell><Badge className={cn('border-none text-[10px] font-black uppercase', meta.className)}>{meta.label}</Badge></TableCell>
                    </TableRow>
                    {open && (
                      <TableRow key={`${row.key}-detail`} className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={canCreateOrders ? 12 : 11}>
                          <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                            <p><span className="font-bold">Stock de seguridad:</span> {number(row.safetyStock)} u.</p>
                            <p><span className="font-bold">Existencia objetivo:</span> {number(row.targetStock)} u.</p>
                            <p><span className="font-bold">Vendido en 90 días:</span> {number(row.unitsSoldInPeriod, 1)} u.</p>
                            <p><span className="font-bold">Patrón de demanda:</span> {({ NONE: 'Sin ventas', SMOOTH: 'Regular', ERRATIC: 'Irregular', INTERMITTENT: 'Esporádica' } as const)[row.demandPattern]}</p>
                            <p><span className="font-bold">Mínimo configurado:</span> {number(row.minStock)} u.</p>
                            <p><span className="font-bold">Costo estimado:</span> {money(row.unitCost)} c/u</p>
                            <p className="sm:col-span-2"><span className="font-bold">Inversión sugerida:</span> {money(row.estimatedCost)}</p>
                          </div>
                          {row.reasons.length > 0 && (
                            <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                              {row.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                            </ul>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
          {meta && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-3 text-xs">
              <span>{number(meta.total)} artículo(s) · página {meta.page} de {meta.totalPages}</span>
              <div className="flex items-center gap-2">
                <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value) as (typeof PAGE_SIZES)[number]); setPage(1); }} className="h-8 rounded-md border border-input bg-background px-2" aria-label="Filas por página">
                  {PAGE_SIZES.map((size) => <option key={size} value={size}>{size} por página</option>)}
                </select>
                <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Anterior</Button>
                <Button type="button" size="sm" variant="outline" disabled={page >= meta.totalPages} onClick={() => setPage((current) => current + 1)}>Siguiente</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Dialog open={confirmOpen} onOpenChange={(open) => { if (!creating) setConfirmOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crear órdenes de compra en borrador</DialogTitle>
            <DialogDescription>Se creará una orden por proveedor y bodega. Quedan en borrador: podrás revisarlas, ajustar precios y aprobarlas desde Compras.</DialogDescription>
          </DialogHeader>
          <ul className="max-h-64 space-y-2 overflow-auto text-sm">
            {groups.map((group) => (
              <li key={`${group.supplierId}|${group.warehouseId}`} className="rounded-lg border border-border p-2">
                <p className="font-bold">{group.supplierName}</p>
                <p className="text-xs text-muted-foreground">Bodega {group.warehouseName} · {group.rows.length} artículo(s) · {number(group.rows.reduce((sum, row) => sum + (selected[row.key] || 0), 0))} unidades</p>
              </li>
            ))}
          </ul>
          {withoutSupplier.length > 0 && (
            <p className="flex items-start gap-2 text-xs text-amber-600"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {withoutSupplier.length} artículo(s) no tienen proveedor previo y no se incluirán. Créalos manualmente desde Compras.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={creating} onClick={() => setConfirmOpen(false)}>Cancelar</Button>
            <Button type="button" disabled={creating || groups.length === 0} onClick={() => void createOrders()}>{creating ? 'Creando…' : 'Crear borradores'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
