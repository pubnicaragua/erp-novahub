import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ClipboardList, Loader2, PackageSearch, Send, Warehouse } from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';

type SupplyWarehouse = {
  id: string;
  name: string;
  location?: string | null;
  scopeType: 'BRANCH' | 'BUSINESS_UNIT' | 'GROUP';
  clientTenantId?: string | null;
  clientTenant?: { id: string; name: string } | null;
  kind?: string;
};

type SupplyLevel = {
  id: string;
  warehouseId: string;
  productId: string;
  variantId: string;
  quantity: number | string;
  reserved: number | string;
  available: number | string;
  product?: { id: string; code: string; name: string } | null;
  variant?: { id: string; sku?: string | null; name?: string | null } | null;
  warehouse?: { id: string; name: string; scopeType: string; clientTenant?: { name: string } | null } | null;
};

type SupplyRequest = {
  id: string;
  number: string;
  status: string;
  date: string;
  sourceWarehouse?: { name: string } | null;
  destinationWarehouse?: { name: string } | null;
  items?: Array<{ quantity: number | string; product?: { code: string; name: string } | null }>;
};

type OptionsResponse = {
  sources?: SupplyWarehouse[];
  destinations?: SupplyWarehouse[];
};

const unwrap = <T,>(value: T | { data?: T }): T => {
  if (value && typeof value === 'object' && 'data' in (value as object)) {
    return ((value as { data?: T }).data ?? value) as T;
  }
  return value as T;
};

const statusLabel: Record<string, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  IN_TRANSIT: 'En tránsito',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
};

export function WarehouseSupplyPanel() {
  const { canPerform } = useAuth();
  const canRequestSupply = canPerform('INVENTORY', 'write');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<OptionsResponse>({});
  const [levels, setLevels] = useState<SupplyLevel[]>([]);
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [sourceWarehouseId, setSourceWarehouseId] = useState('');
  const [destinationWarehouseId, setDestinationWarehouseId] = useState('');
  const [levelId, setLevelId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');

  const selectedLevel = levels.find((level) => level.id === levelId);
  const sourceLevels = useMemo(
    () => levels.filter((level) => !sourceWarehouseId || level.warehouseId === sourceWarehouseId),
    [levels, sourceWarehouseId],
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const [optionsResponse, inventoryResponse, requestsResponse] = await Promise.all([
        api.get<OptionsResponse>('/inventory/warehouse-supply-requests/options'),
        api.get<{ levels?: SupplyLevel[] }>('/inventory/warehouse-supply-requests/inventory'),
        api.get<SupplyRequest[]>('/inventory/warehouse-supply-requests'),
      ]);
      const nextOptions = unwrap(optionsResponse) || {};
      const nextInventory = unwrap(inventoryResponse) || {};
      setOptions(nextOptions);
      setLevels(Array.isArray(nextInventory.levels) ? nextInventory.levels : []);
      setRequests(Array.isArray(unwrap(requestsResponse)) ? unwrap(requestsResponse) : []);
      setDestinationWarehouseId((current) => current || nextOptions.destinations?.[0]?.id || '');
      setSourceWarehouseId((current) => current || nextOptions.sources?.[0]?.id || '');
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo cargar el abastecimiento'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void loadData();
  }, [open]);

  useEffect(() => {
    if (levelId && !sourceLevels.some((level) => level.id === levelId)) setLevelId('');
  }, [levelId, sourceLevels]);

  const handleCreate = async () => {
    if (!sourceWarehouseId || !destinationWarehouseId || !selectedLevel) {
      toast.error('Selecciona el almacén origen, la bodega destino y el producto.');
      return;
    }
    const requestedQuantity = Number(quantity);
    if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
      toast.error('La cantidad debe ser mayor que cero.');
      return;
    }
    setSaving(true);
    try {
      await api.idempotentPost('/inventory/warehouse-supply-requests', {
        sourceWarehouseId,
        destinationWarehouseId,
        items: [{ productId: selectedLevel.productId, variantId: selectedLevel.variantId, quantity: requestedQuantity }],
        notes: notes.trim() || undefined,
      });
      toast.success('Solicitud de abastecimiento creada');
      setLevelId('');
      setQuantity('1');
      setNotes('');
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear la solicitud'));
    } finally {
      setSaving(false);
    }
  };

  if (!canRequestSupply) return null;

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="h-10 w-full min-w-0 rounded-xl px-3 sm:w-auto" onClick={() => setOpen(true)}>
        <Send className="mr-1 size-3.5" /> Solicitar abastecimiento
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="!w-[calc(100vw-2rem)] !max-w-[min(94vw,960px)] max-h-[min(88vh,calc(100dvh-3rem))] overflow-y-auto rounded-3xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black"><Warehouse className="size-5 text-primary" /> Abastecimiento por rubro</DialogTitle>
            <DialogDescription>
              Consulta inventario de almacenes y bodegas autorizadas del mismo rubro y solicita una transferencia hacia esta sucursal.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex min-h-48 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 size-5 animate-spin" /> Cargando inventario visible…</div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 rounded-2xl border border-border/60 bg-muted/10 p-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Almacén corporativo origen</Label>
                  <Select value={sourceWarehouseId} onValueChange={(value) => { setSourceWarehouseId(value); setLevelId(''); }}>
                    <SelectTrigger><SelectValue placeholder="Selecciona un almacén" /></SelectTrigger>
                    <SelectContent>
                      {(options.sources || []).map((warehouse) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {(options.sources || []).length === 0 && <p className="text-xs text-muted-foreground">No hay almacenes corporativos autorizados para esta sucursal.</p>}
                </div>
                <div className="space-y-2">
                  <Label>Bodega destino</Label>
                  <Select value={destinationWarehouseId} onValueChange={setDestinationWarehouseId}>
                    <SelectTrigger><SelectValue placeholder="Selecciona una bodega" /></SelectTrigger>
                    <SelectContent>
                      {(options.destinations || []).map((warehouse) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Producto / variante</Label>
                  <Select value={levelId} onValueChange={setLevelId}>
                    <SelectTrigger><SelectValue placeholder="Selecciona un producto del almacén" /></SelectTrigger>
                    <SelectContent>
                      {sourceLevels.map((level) => <SelectItem key={level.id} value={level.id}>
                        {level.product?.code || 'Producto'} · {level.product?.name || 'Sin nombre'} · {level.variant?.sku || level.variant?.name || 'Estándar'} · disponible {Number(level.available || 0)}
                      </SelectItem>)}
                    </SelectContent>
                  </Select>
                  {sourceWarehouseId && sourceLevels.length === 0 && <p className="text-xs text-muted-foreground">Ese almacén todavía no tiene productos catalogados o niveles visibles.</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supply-quantity">Cantidad solicitada</Label>
                  <Input id="supply-quantity" type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="supply-notes">Observaciones</Label>
                  <Textarea id="supply-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" />
                </div>
                {selectedLevel && <div className="flex items-center gap-2 text-xs text-muted-foreground md:col-span-2"><PackageSearch className="size-4" /> Existencia actual en la bodega origen: <span className="font-bold text-foreground">{Number(selectedLevel.available || 0)}</span><ArrowRight className="size-3.5" /> la transferencia moverá stock al completarse.</div>}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2"><PackageSearch className="size-4 text-primary" /><h3 className="font-bold">Inventario visible del mismo rubro</h3><span className="text-xs text-muted-foreground">{levels.length} registro(s)</span></div>
                {levels.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No hay existencias catalogadas en el alcance visible.</p> : (
                  <div className="max-h-64 overflow-auto rounded-xl border">
                    <table className="w-full min-w-[760px] text-sm"><thead className="sticky top-0 bg-muted/80 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-2">Ubicación</th><th className="px-3 py-2">Sucursal</th><th className="px-3 py-2">Producto</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2 text-right">Disponible</th></tr></thead><tbody>
                      {levels.slice(0, 100).map((level) => <tr key={level.id} className="border-t"><td className="px-3 py-2 font-medium">{level.warehouse?.name || 'Bodega'}</td><td className="px-3 py-2 text-muted-foreground">{level.warehouse?.clientTenant?.name || 'Almacén corporativo'}</td><td className="px-3 py-2">{level.product?.code || '—'} · {level.product?.name || 'Sin nombre'}{level.variant?.sku ? ` · ${level.variant.sku}` : ''}</td><td className="px-3 py-2"><Badge variant="outline">{level.warehouse?.scopeType === 'BUSINESS_UNIT' ? 'Almacén' : 'Bodega'}</Badge></td><td className="px-3 py-2 text-right font-bold tabular-nums">{Number(level.available || 0)}</td></tr>)}
                    </tbody></table>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2"><ClipboardList className="size-4 text-primary" /><h3 className="font-bold">Solicitudes de esta sucursal</h3></div>
                {requests.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Aún no hay solicitudes.</p> : (
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full min-w-[680px] text-sm"><thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-2">Solicitud</th><th className="px-3 py-2">Origen</th><th className="px-3 py-2">Destino</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2">Fecha</th></tr></thead><tbody>
                      {requests.slice(0, 20).map((request) => <tr key={request.id} className="border-t"><td className="px-3 py-2 font-medium">{request.number}</td><td className="px-3 py-2">{request.sourceWarehouse?.name || '—'}</td><td className="px-3 py-2">{request.destinationWarehouse?.name || '—'}</td><td className="px-3 py-2"><Badge variant="outline">{statusLabel[request.status] || request.status}</Badge></td><td className="px-3 py-2 text-muted-foreground">{request.date ? new Date(request.date).toLocaleDateString() : '—'}</td></tr>)}
                    </tbody></table>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cerrar</Button>
            <Button type="button" onClick={handleCreate} disabled={saving || loading || !selectedLevel || !sourceWarehouseId || !destinationWarehouseId}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />} Crear solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
