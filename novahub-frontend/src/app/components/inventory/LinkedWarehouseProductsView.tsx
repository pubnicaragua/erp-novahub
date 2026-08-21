import { useEffect, useMemo, useState } from 'react';
import { Loader2, PackageSearch, Warehouse } from 'lucide-react';
import { api, getApiErrorMessage } from '../../services/api';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

type LinkedWarehouse = {
  id: string;
  name: string;
  location?: string | null;
  scopeType?: string;
  authorizedBranches?: Array<{ clientTenantId: string }>;
};

type WarehouseLevel = {
  id: string;
  warehouseId: string;
  productId: string;
  variantId?: string | null;
  quantity: number | string;
  reserved: number | string;
  available: number | string;
  minStock?: number | string;
  product?: { id: string; code: string; name: string; type?: string } | null;
  variant?: { id: string; sku?: string | null; name?: string | null } | null;
  warehouse?: { id: string; name: string } | null;
};

type OptionsResponse = {
  sources?: LinkedWarehouse[];
};

const unwrap = <T,>(value: T | { data?: T }): T => {
  if (value && typeof value === 'object' && 'data' in (value as object)) {
    return ((value as { data?: T }).data ?? value) as T;
  }
  return value as T;
};

const numberFormat = new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 });

export function LinkedWarehouseProductsView({ selectedBranchId }: { selectedBranchId?: string }) {
  const [warehouses, setWarehouses] = useState<LinkedWarehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [levels, setLevels] = useState<WarehouseLevel[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(true);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [error, setError] = useState('');

  const selectedWarehouse = useMemo(
    () => warehouses.find((warehouse) => warehouse.id === selectedWarehouseId),
    [warehouses, selectedWarehouseId],
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingWarehouses(true);
    setError('');
    void api.get<OptionsResponse>('/inventory/warehouse-supply-requests/options', {
      params: selectedBranchId ? { branchId: selectedBranchId } : undefined,
    }).then((response) => {
      if (cancelled) return;
      const options = unwrap(response) || {};
      const nextWarehouses = (options.sources || []).filter((warehouse) =>
        !selectedBranchId || warehouse.authorizedBranches?.some((branch) => branch.clientTenantId === selectedBranchId),
      );
      setWarehouses(nextWarehouses);
      setSelectedWarehouseId((current) => nextWarehouses.some((warehouse) => warehouse.id === current) ? current : nextWarehouses[0]?.id || '');
    }).catch((requestError: unknown) => {
      if (cancelled) return;
      setWarehouses([]);
      setSelectedWarehouseId('');
      setError(getApiErrorMessage(requestError, 'No se pudieron cargar los almacenes vinculados'));
    }).finally(() => {
      if (!cancelled) setLoadingWarehouses(false);
    });
    return () => { cancelled = true; };
  }, [selectedBranchId]);

  useEffect(() => {
    if (!selectedWarehouseId) {
      setLevels([]);
      return;
    }
    let cancelled = false;
    setLoadingLevels(true);
    setError('');
    void api.get<{ levels?: WarehouseLevel[] }>('/inventory/warehouse-supply-requests/inventory', {
      params: {
        warehouseId: selectedWarehouseId,
        ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
      },
    }).then((response) => {
      if (cancelled) return;
      const inventory = unwrap(response) || {};
      setLevels(Array.isArray(inventory.levels) ? inventory.levels : []);
    }).catch((requestError: unknown) => {
      if (cancelled) return;
      setLevels([]);
      setError(getApiErrorMessage(requestError, 'No se pudo cargar el inventario del almacén'));
    }).finally(() => {
      if (!cancelled) setLoadingLevels(false);
    });
    return () => { cancelled = true; };
  }, [selectedWarehouseId, selectedBranchId]);

  const totalUnits = levels.reduce((sum, level) => sum + Number(level.quantity || 0), 0);
  const availableUnits = levels.reduce((sum, level) => sum + Number(level.available ?? Number(level.quantity || 0) - Number(level.reserved || 0)), 0);

  return (
    <div className="space-y-5">
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="gap-3 pb-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Warehouse className="size-5" /></div>
            <div className="min-w-0">
              <CardTitle className="text-lg font-black uppercase italic tracking-tight">Productos de los almacenes vinculados</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Consulta cada almacén por separado; sus existencias no se mezclan con las bodegas de la sucursal.</p>
            </div>
          </div>
          {warehouses.length > 0 && (
            <Tabs value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
              <div className="w-full overflow-x-auto custom-scrollbar">
                <TabsList className="flex h-auto w-max gap-1.5 rounded-2xl border border-border/40 bg-muted/20 p-1.5">
                  {warehouses.map((warehouse) => (
                    <TabsTrigger key={warehouse.id} value={warehouse.id} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <Warehouse className="size-4" />{warehouse.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            </Tabs>
          )}
        </CardHeader>
      </Card>

      {loadingWarehouses && <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-5 animate-spin" />Cargando almacenes vinculados…</div>}
      {!loadingWarehouses && error && <Card className="rounded-2xl border-destructive/30"><CardContent className="p-8 text-center text-sm text-destructive">{error}</CardContent></Card>}
      {!loadingWarehouses && !error && warehouses.length === 0 && <Card className="rounded-2xl border-dashed"><CardContent className="p-10 text-center text-sm text-muted-foreground"><Warehouse className="mx-auto mb-3 size-9 opacity-30" /><p>No hay almacenes corporativos vinculados a esta sucursal.</p></CardContent></Card>}

      {!loadingWarehouses && !error && selectedWarehouse && (
        <Tabs value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
          {warehouses.map((warehouse) => (
            <TabsContent key={warehouse.id} value={warehouse.id} className="m-0 space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Card className="rounded-2xl border-border/60"><CardContent className="p-4"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Productos</p><p className="mt-1 text-2xl font-black tabular-nums">{levels.length}</p></CardContent></Card>
                <Card className="rounded-2xl border-border/60"><CardContent className="p-4"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Existencias</p><p className="mt-1 text-2xl font-black tabular-nums">{numberFormat.format(totalUnits)}</p></CardContent></Card>
                <Card className="rounded-2xl border-border/60"><CardContent className="p-4"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Disponibles</p><p className="mt-1 text-2xl font-black tabular-nums text-emerald-600">{numberFormat.format(availableUnits)}</p></CardContent></Card>
              </div>

              {loadingLevels && <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-5 animate-spin" />Cargando productos de {warehouse.name}…</div>}
              {!loadingLevels && !levels.length && <Card className="rounded-2xl border-dashed"><CardContent className="p-10 text-center text-sm text-muted-foreground"><PackageSearch className="mx-auto mb-3 size-9 opacity-30" /><p>Este almacén no tiene productos registrados para la sucursal.</p></CardContent></Card>}
              {!loadingLevels && levels.length > 0 && <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm"><CardHeader className="border-b border-border/40 bg-muted/10 py-4"><CardTitle className="text-base font-black">Inventario de {warehouse.name}</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table className="min-w-[760px]"><TableHeader><TableRow className="bg-muted/30"><TableHead>Código</TableHead><TableHead>Producto</TableHead><TableHead>Variante</TableHead><TableHead className="text-right">Existencia</TableHead><TableHead className="text-right">Reservado</TableHead><TableHead className="text-right">Disponible</TableHead><TableHead className="text-right">Mínimo</TableHead></TableRow></TableHeader><TableBody>{levels.map((level) => <TableRow key={level.id}><TableCell className="font-mono font-bold">{level.product?.code || '—'}</TableCell><TableCell className="font-semibold">{level.product?.name || 'Producto'}</TableCell><TableCell>{level.variant?.sku || level.variant?.name || 'Estándar'}</TableCell><TableCell className="text-right font-bold tabular-nums">{numberFormat.format(Number(level.quantity || 0))}</TableCell><TableCell className="text-right tabular-nums">{numberFormat.format(Number(level.reserved || 0))}</TableCell><TableCell className="text-right font-bold tabular-nums text-emerald-600">{numberFormat.format(Number(level.available ?? Number(level.quantity || 0) - Number(level.reserved || 0)))}</TableCell><TableCell className="text-right tabular-nums">{numberFormat.format(Number(level.minStock || 0))}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
