import { useMemo, useState } from 'react';
import { Truck, ArrowRight, Search, Plus, Check, X, CircleHelp } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Combobox } from '../ui/Combobox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { inventoryService } from '../../services/inventario.service';
import { useAuth } from '../../contexts/AuthContext';
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';
import { InventoryDetailPanel } from './InventoryDetailPanel';
import type { SalesPaginationControls } from '../../types';

interface TransferenciasViewProps {
  transfers: any[];
  warehouses: any[];
  products: any[];
  series?: any[];
  onRefresh: () => void;
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  onStatusChange?: (value: string) => void;
}

const TRANSFER_TOUR_STEPS: GuidedTourStep[] = [
  {
    target: '[data-tour="transfer-title"]',
    title: 'Transferencias',
    description: 'Registra transferencias de inventario entre almacenes o sucursales. Cada transferencia tiene un origen y un destino.',
    tip: 'Al confirmar una transferencia, el stock se descuenta del origen y se agrega al destino de inmediato.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="transfer-search"]',
    title: 'Buscar Transferencias',
    description: 'Filtra por número de guía o nombre de almacén para encontrar rápidamente una transferencia específica.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="transfer-new-btn"]',
    title: 'Nueva Transferencia',
    description: 'Crea una nueva transferencia seleccionando el almacén origen, destino, producto y cantidad. También puedes asignar IMEI/Series si el producto lo requiere.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="transfer-table"]',
    title: 'Listado de Transferencias',
    description: 'Aquí ves todas las transferencias con su guía, origen, destino, cantidad de items. Las transferencias confirmadas mueven el stock automáticamente.',
    placement: 'top',
  },
  {
    target: '[data-tour="transfer-pagination"]',
    title: 'Paginación',
    description: 'Selecciona la cantidad de registros por página y utiliza los controles para revisar todas las transferencias sin perder el filtro activo.',
    placement: 'top',
  },
];

export function TransferenciasView({ transfers, warehouses, products, series = [], onRefresh, pagination, onSearchChange }: TransferenciasViewProps) {
  const { canPerform } = useAuth();
  const [showTutorial, setShowTutorial] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [serialPickerOpen, setSerialPickerOpen] = useState(false);
  const [serialSearch, setSerialSearch] = useState('');
  const [newTransfer, setNewTransfer] = useState({ 
    fromId: '', 
    toId: '', 
    productId: '', 
    quantity: 1,
    date: new Date().toISOString().split('T')[0]
  });
  const [saving, setSaving] = useState(false);
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);

  const selectedProduct = useMemo(
    () => products.find((p: any) => p.id === newTransfer.productId),
    [products, newTransfer.productId],
  );

  const productWarehouseIds = (product: any): Set<string> => {
    const ids: string[] = [
      ...(Array.isArray(product?.stockLevels) ? product.stockLevels.map((l: any) => l.warehouseId || l.warehouse?.id) : []),
      ...(Array.isArray(product?.warehouseCatalogs) ? product.warehouseCatalogs.map((c: any) => c.warehouseId || c.warehouse?.id) : []),
      ...(Array.isArray(product?.allocations) ? product.allocations.map((a: any) => a.warehouseId || a.warehouse?.id) : []),
    ];
    return new Set(ids.filter(Boolean));
  };

  const isProductInWarehouse = (productId: string, warehouseId: string) => {
    const product = products.find((p: any) => p.id === productId);
    return Boolean(product && warehouseId && productWarehouseIds(product).has(warehouseId));
  };

  // Solo productos presentes en el almacén origen seleccionado.
  const productOptions = useMemo(() => {
    const warehouseId = newTransfer.fromId;
    return products
      .filter((p: any) => warehouseId && productWarehouseIds(p).has(warehouseId))
      .map((p: any) => ({ label: `${p.code} — ${p.name}`, value: p.id }));
  }, [products, newTransfer.fromId]);

  const handleFromWarehouseChange = (value: string) => {
    setNewTransfer((prev) => ({
      ...prev,
      fromId: value,
      productId: prev.productId && isProductInWarehouse(prev.productId, value) ? prev.productId : '',
    }));
    setSelectedSerials([]);
  };

  const isSerialTracked = (product: any) =>
    Boolean(
      product?.trackSerialNumbers ||
      product?.serialTracking ||
      product?.serialNumberTracking ||
      String(product?.trackingType || '').toUpperCase() === 'SERIAL',
    );

  const availableSerials = useMemo(() => {
    if (!newTransfer.productId) return [];
    return series
      .filter((s: any) => {
        const sameProduct = s.productId === newTransfer.productId || s.product?.id === newTransfer.productId;
        if (!sameProduct) return false;
        const status = String(s.status || 'AVAILABLE').toUpperCase();
        const allowedStatus = ['AVAILABLE', 'IN_STOCK', 'ACTIVE', ''];
        if (!allowedStatus.includes(status)) return false;
        if (!newTransfer.fromId) return true;
        const serialWarehouseId = s.warehouseId || s.warehouse?.id;
        return !serialWarehouseId || serialWarehouseId === newTransfer.fromId;
      })
      .map((s: any) => ({
        id: s.id || s.number,
        number: s.number,
        warehouseName: s.warehouse?.name || '',
      }));
  }, [series, newTransfer.productId, newTransfer.fromId]);

  const filteredTransfers = transfers.filter(t => 
    !searchTerm || 
    t.number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.from?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.to?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateTransfer = async () => {
    if (!newTransfer.fromId || !newTransfer.toId || !newTransfer.productId) {
      toast.error('Completa todos los campos');
      return;
    }
    
    const product = products.find((p: any) => p.id === newTransfer.productId);
    const serialRequired = isSerialTracked(product);
    if (serialRequired && selectedSerials.length === 0) {
      toast.error('Selecciona los IMEI/series a transferir');
      return;
    }
    if (serialRequired && selectedSerials.length > 0 && selectedSerials.length !== Number(newTransfer.quantity || 0)) {
      toast.error('La cantidad debe coincidir con los IMEI seleccionados');
      return;
    }
    // Use the first variant of the product, or the product's default variant
    const variantId = product?.variants?.[0]?.id || product?.id;
    
    if (!variantId) {
      toast.error('El producto no tiene variantes configuradas');
      return;
    }
    
    setSaving(true);
    try {
      await inventoryService.createTransfer({
        fromId: newTransfer.fromId,
        toId: newTransfer.toId,
        items: [{ variantId, quantity: serialRequired ? selectedSerials.length : newTransfer.quantity }],
      } as any);
      toast.success('Transferencia creada. El stock se movió al almacén de destino');
      setIsCreating(false);
      setSelectedSerials([]);
      setSerialSearch('');
      setNewTransfer({ 
        fromId: '', 
        toId: '', 
        productId: '', 
        quantity: 1,
        date: new Date().toISOString().split('T')[0]
      });
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Error al crear transferencia');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4 border bg-card rounded-xl">
      <div className="flex min-w-0 flex-col gap-3 mb-4 md:flex-row md:items-center md:justify-between" data-tour="transfer-title">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-sm" data-tour="transfer-search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por guía o almacén..." 
              className="pl-9 h-9"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }}
            />
          </div>
        </div>
        {canPerform('INVENTORY_TRANSFERS', 'create') && (
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowTutorial(true)} className="h-10 rounded-xl">
              <CircleHelp className="size-3.5 mr-1" /> Tutorial
            </Button>
            <Button 
              size="sm" 
              className="min-w-0 flex-1 rounded-xl bg-gradient-to-br from-primary to-primary/80 px-4 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl sm:flex-none"
              onClick={() => setIsCreating(true)}
              disabled={isCreating}
              data-tour="transfer-new-btn"
            >
              <Plus className="size-4" />
              Nueva Transferencia
            </Button>
          </div>
        )}
      </div>

      <div className={`grid min-w-0 grid-cols-1 gap-6 ${selectedTransfer ? 'lg:grid-cols-[13fr_7fr]' : 'lg:grid-cols-1'}`}>
        <div className="min-w-0">
          <div className="space-y-3 lg:hidden" data-tour="transfer-table">
            {isCreating && <Card className="rounded-2xl border-primary/30 bg-primary/5 p-4">
          <div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-widest text-primary">Nueva transferencia</p><div className="flex gap-1"><Button type="button" variant="ghost" size="icon" className="size-8 text-emerald-500" onClick={handleCreateTransfer} disabled={saving} aria-label="Guardar transferencia">{saving ? <div className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Check className="size-4" />}</Button><Button type="button" variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setIsCreating(false)} disabled={saving} aria-label="Cancelar transferencia"><X className="size-4" /></Button></div></div>
          <div className="grid gap-3 sm:grid-cols-2"><Select value={newTransfer.fromId} onValueChange={handleFromWarehouseChange}><SelectTrigger><SelectValue placeholder="Almacén origen" /></SelectTrigger><SelectContent>{warehouses.map((warehouse: any) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}</SelectContent></Select><Select value={newTransfer.toId} onValueChange={(value) => setNewTransfer({ ...newTransfer, toId: value })}><SelectTrigger><SelectValue placeholder="Almacén destino" /></SelectTrigger><SelectContent>{warehouses.filter((warehouse) => warehouse.id !== newTransfer.fromId).map((warehouse: any) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}</SelectContent></Select><Combobox options={productOptions} value={newTransfer.productId} onChange={(value) => { setNewTransfer({ ...newTransfer, productId: value }); setSelectedSerials([]); }} placeholder="Buscar producto..." searchPlaceholder="Buscar por código o nombre..." emptyMessage={newTransfer.fromId ? 'No hay productos en este almacén.' : 'Selecciona primero el almacén.'} maxVisibleOptions={productOptions.length} className="w-full" /><div className="flex gap-2"><Input type="number" min={1} value={isSerialTracked(selectedProduct) ? selectedSerials.length : newTransfer.quantity} onChange={(event) => setNewTransfer({ ...newTransfer, quantity: Number(event.target.value) || 1 })} disabled={isSerialTracked(selectedProduct)} placeholder="Cantidad" />{isSerialTracked(selectedProduct) && <Button type="button" variant="outline" className="shrink-0" onClick={() => setSerialPickerOpen(true)}>IMEI ({selectedSerials.length})</Button>}</div><Input className="sm:col-span-2" type="date" value={newTransfer.date} onChange={(event) => setNewTransfer({ ...newTransfer, date: event.target.value })} /></div>
        </Card>}
        {filteredTransfers.length === 0 && !isCreating ? <Card className="rounded-2xl border-dashed p-8 text-center text-muted-foreground"><Truck className="mx-auto mb-2 size-9 opacity-20" /><p>No hay transferencias</p></Card> : filteredTransfers.map((transfer: any) => <Card key={transfer.id} className="min-w-0 cursor-pointer rounded-2xl border-border/50 bg-card/70 p-4 shadow-sm transition-colors hover:bg-muted/30" onClick={() => setSelectedTransfer(transfer)}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-mono font-bold">{transfer.number}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(transfer.date).toLocaleDateString()}</p></div><Badge variant="outline" className="shrink-0 bg-emerald-500/10 text-[9px] font-black uppercase tracking-widest text-emerald-600"><Check className="mr-1 size-3" /> Completada</Badge></div><div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-border/40 pt-3 text-xs"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Origen</p><p className="truncate font-medium">{transfer.from?.name || '—'}</p></div><ArrowRight className="size-4 text-muted-foreground" /><div className="min-w-0 text-right"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Destino</p><p className="truncate font-medium">{transfer.to?.name || '—'}</p></div></div><div className="mt-3 flex justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground"><span>{(transfer.items || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0)} unidades</span></div></Card>)}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border lg:block" data-tour="transfer-table">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border/50">
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-28">Guía</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Origen</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-center">→</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Destino</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-center min-w-96">Items</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-40">Fecha</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-36">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isCreating && (
              <TableRow className="bg-blue-500/5">
                <TableCell className="text-xs text-muted-foreground">Auto</TableCell>
                <TableCell>
                  <Select value={newTransfer.fromId} onValueChange={handleFromWarehouseChange}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Origen" /></SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-center"><ArrowRight className="size-4 mx-auto text-muted-foreground" /></TableCell>
                <TableCell>
                  <Select value={newTransfer.toId} onValueChange={(v) => setNewTransfer({...newTransfer, toId: v})}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Destino" /></SelectTrigger>
                    <SelectContent>
                      {warehouses.filter(w => w.id !== newTransfer.fromId).map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <Combobox
                      options={productOptions}
                      value={newTransfer.productId}
                      onChange={(v) => { setNewTransfer({...newTransfer, productId: v}); setSelectedSerials([]); }}
                      placeholder="Buscar producto..."
                      searchPlaceholder="Buscar por código o nombre..."
                      emptyMessage={newTransfer.fromId ? 'No hay productos en este almacén.' : 'Selecciona primero el almacén.'}
                      maxVisibleOptions={productOptions.length}
                      className="w-48 min-w-48"
                    />
                    <Input 
                      type="number" 
                      value={isSerialTracked(selectedProduct) ? selectedSerials.length : newTransfer.quantity} 
                      onChange={(e) => setNewTransfer({...newTransfer, quantity: parseInt(e.target.value) || 1})}
                      className="h-8 text-xs w-24"
                      min={1}
                      disabled={isSerialTracked(selectedProduct)}
                    />
                    {isSerialTracked(selectedProduct) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px] uppercase tracking-wider"
                        onClick={() => setSerialPickerOpen(true)}
                      >
                        IMEI ({selectedSerials.length})
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Input 
                    type="date" 
                    value={newTransfer.date} 
                    onChange={(e) => setNewTransfer({...newTransfer, date: e.target.value})}
                    className="h-8 text-xs w-full min-w-[130px] pr-2"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="size-7 text-green-600" onClick={handleCreateTransfer} disabled={saving}>
                      {saving ? <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Check className="size-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7 text-red-600" onClick={() => setIsCreating(false)} disabled={saving}>
                      <X className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            
            {filteredTransfers.length === 0 && !isCreating ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <Truck className="size-10 mx-auto mb-2 opacity-20" />
                  <p className="font-medium">No hay transferencias</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredTransfers.map((trf: any) => (
                  <TableRow key={trf.id} className="group cursor-pointer hover:bg-muted/30" onClick={() => setSelectedTransfer(trf)}>
                    <TableCell className="font-mono text-xs">{trf.number}</TableCell>
                    <TableCell className="text-sm">{trf.from?.name || '-'}</TableCell>
                    <TableCell className="text-center"><ArrowRight className="size-4 mx-auto text-muted-foreground" /></TableCell>
                    <TableCell className="text-sm">{trf.to?.name || '-'}</TableCell>
                    <TableCell className="text-center font-medium">
                      {(trf.items || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(trf.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-emerald-500/10 text-[9px] font-black uppercase tracking-widest text-emerald-600">
                        <Check className="mr-1 size-3" /> Completada
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              ))
            }
          </TableBody>
        </Table>
      </div>

      <div className="mt-3 flex flex-col gap-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground sm:flex-row sm:items-center sm:justify-between" data-tour="transfer-pagination">
        {pagination?.total ?? filteredTransfers.length} transferencias
        {pagination && (
          <span className="inline-flex flex-wrap items-center gap-2 normal-case tracking-normal sm:ml-4">
            <select value={pagination.pageSize} onChange={(event) => pagination.onPageSizeChange(Number(event.target.value) as 50 | 100 | 200)} className="h-7 rounded border bg-background px-1 font-bold text-foreground">
              {[50, 100, 200].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            <button type="button" className="rounded border px-2 py-1 disabled:opacity-40" onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))} disabled={pagination.page <= 1}>‹</button>
            <span>Pág. {pagination.page}/{pagination.totalPages}</span>
            <button type="button" className="rounded border px-2 py-1 disabled:opacity-40" onClick={() => pagination.onPageChange(Math.min(pagination.totalPages, pagination.page + 1))} disabled={pagination.page >= pagination.totalPages}>›</button>
          </span>
        )}
      </div>
        </div>
        {selectedTransfer && (
          <InventoryDetailPanel
            kind="transfer"
            data={selectedTransfer}
            onClose={() => setSelectedTransfer(null)}
          />
        )}
      </div>
      <Dialog open={serialPickerOpen} onOpenChange={setSerialPickerOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Seleccionar IMEI / Series</DialogTitle>
            <DialogDescription>
              Selecciona los IMEI disponibles del almacén origen para la transferencia.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={serialSearch}
              onChange={(e) => setSerialSearch(e.target.value)}
              placeholder="Buscar IMEI..."
              className="h-9 text-xs"
            />
            <div className="max-h-72 overflow-auto rounded-md border p-2 space-y-1">
              {availableSerials
                .filter((item) => !serialSearch || String(item.number || '').toLowerCase().includes(serialSearch.toLowerCase()))
                .map((item) => {
                  const checked = selectedSerials.includes(item.number);
                  return (
                    <label key={item.id} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-muted/40 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            if (v) setSelectedSerials((prev) => [...new Set([...prev, item.number])]);
                            else setSelectedSerials((prev) => prev.filter((n) => n !== item.number));
                          }}
                        />
                        <span className="text-xs font-mono">{item.number}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{item.warehouseName || '-'}</span>
                    </label>
                  );
                })}
              {availableSerials.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">No hay seriales disponibles para este producto.</p>
              )}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Seleccionados</span>
              <Badge variant="outline">{selectedSerials.length}</Badge>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSerialPickerOpen(false)}>Cerrar</Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => {
                setNewTransfer((prev) => ({ ...prev, quantity: selectedSerials.length || 1 }));
                setSerialPickerOpen(false);
              }}
            >
              Confirmar selección
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {showTutorial && <GuidedTour steps={TRANSFER_TOUR_STEPS} onClose={() => setShowTutorial(false)} title="Transferencias" />}
    </Card>
  );
}

