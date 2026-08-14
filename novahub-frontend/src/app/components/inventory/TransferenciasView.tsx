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
import { InventoryViewTutorial } from './InventoryViewTutorial';

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

interface TransferItemDraft {
  key: string;
  productId: string;
  quantity: number;
  serials: string[];
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
  const [serialPickerItemKey, setSerialPickerItemKey] = useState<string | null>(null);
  const [serialSearch, setSerialSearch] = useState('');
  const [newTransfer, setNewTransfer] = useState({
    fromId: '',
    toId: '',
    items: [] as TransferItemDraft[],
    date: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);

  const nextItemKey = () => `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const addItem = () => {
    setNewTransfer((prev) => ({ ...prev, items: [...prev.items, { key: nextItemKey(), productId: '', quantity: 1, serials: [] }] }));
  };

  const updateItem = (key: string, patch: Partial<TransferItemDraft>) => {
    setNewTransfer((prev) => ({ ...prev, items: prev.items.map((item) => (item.key === key ? { ...item, ...patch } : item)) }));
  };

  const removeItem = (key: string) => {
    setNewTransfer((prev) => ({ ...prev, items: prev.items.filter((item) => item.key !== key) }));
  };

  const handleItemProductChange = (key: string, productId: string) => {
    const duplicate = newTransfer.items.some((item) => item.key !== key && item.productId === productId);
    if (duplicate) {
      toast.error('Ese producto ya está en la transferencia');
      return;
    }
    updateItem(key, { productId, serials: [] });
  };

  const serialItem = serialPickerItemKey ? newTransfer.items.find((item) => item.key === serialPickerItemKey) : null;
  const serialProduct = serialItem ? products.find((p: any) => p.id === serialItem.productId) : null;

  const productWarehouseIds = (product: any): Set<string> => {
    const ids: string[] = [
      ...(Array.isArray(product?.stockLevels) ? product.stockLevels.map((l: any) => l.warehouseId || l.warehouse?.id) : []),
      ...(Array.isArray(product?.warehouseCatalogs) ? product.warehouseCatalogs.map((c: any) => c.warehouseId || c.warehouse?.id) : []),
      ...(Array.isArray(product?.allocations) ? product.allocations.map((a: any) => a.warehouseId || a.warehouse?.id) : []),
    ];
    return new Set(ids.filter(Boolean));
  };

  // Solo productos presentes en el almacén origen seleccionado.
  const productOptions = useMemo(() => {
    const warehouseId = newTransfer.fromId;
    return products
      .filter((p: any) => warehouseId && productWarehouseIds(p).has(warehouseId))
      .sort((a: any, b: any) => String(a.code || '').localeCompare(String(b.code || ''), 'es', { numeric: true, sensitivity: 'base' }))
      .map((p: any) => ({ label: `${p.code} — ${p.name}`, value: p.id }));
  }, [products, newTransfer.fromId]);

  const handleFromWarehouseChange = (value: string) => {
    setNewTransfer((prev) => ({ ...prev, fromId: value, items: [] }));
  };

  const isSerialTracked = (product: any) =>
    Boolean(
      product?.trackSerialNumbers ||
      product?.serialTracking ||
      product?.serialNumberTracking ||
      String(product?.trackingType || '').toUpperCase() === 'SERIAL',
    );

  const getAvailableSerials = (productId: string) => {
    if (!productId) return [];
    return series
      .filter((s: any) => {
        const sameProduct = s.productId === productId || s.product?.id === productId;
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
  };

  const filteredTransfers = transfers.filter(t => 
    !searchTerm || 
    t.number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.from?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.to?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const transferUnits = (t: any) => (t.items || []).reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);

  const renderStockDelta = (transfer: any) => {
    const units = transferUnits(transfer);
    return (
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[9px] font-black">-{units}</Badge>
        <span className="max-w-28 truncate text-[10px] text-muted-foreground">{transfer.from?.name || '—'}</span>
        <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] font-black">+{units}</Badge>
        <span className="max-w-28 truncate text-[10px] text-muted-foreground">{transfer.to?.name || '—'}</span>
      </div>
    );
  };

  const handleCreateTransfer = async () => {
    if (!newTransfer.fromId || !newTransfer.toId) {
      toast.error('Selecciona el almacén origen y el destino');
      return;
    }
    const draftItems = newTransfer.items.filter((item) => item.productId);
    if (draftItems.length === 0) {
      toast.error('Agrega al menos un producto a la transferencia');
      return;
    }

    // Validar cada artículo y resolver su variantId.
    const resolved: { product: any; variantId: string; quantity: number }[] = [];
    for (const item of draftItems) {
      const product = products.find((p: any) => p.id === item.productId);
      const variantId = product?.variants?.[0]?.id || product?.id;
      if (!product || !variantId) {
        toast.error(`El producto "${product?.name || item.productId}" no tiene variantes configuradas`);
        return;
      }
      const serialRequired = isSerialTracked(product);
      const quantity = serialRequired ? item.serials.length : Number(item.quantity || 0);
      if (quantity <= 0) {
        toast.error(`La cantidad de "${product.name}" debe ser mayor a cero`);
        return;
      }
      if (serialRequired && item.serials.length === 0) {
        toast.error(`Selecciona los IMEI/series de "${product.name}"`);
        return;
      }
      if (serialRequired && item.serials.length !== Number(item.quantity || 0)) {
        toast.error(`La cantidad de "${product.name}" debe coincidir con sus IMEI`);
        return;
      }
      resolved.push({ product, variantId, quantity });
    }

    // Agrupar por producto + variante para no transferir dos veces el mismo.
    const aggregated = new Map<string, { product: any; variantId: string; quantity: number }>();
    for (const entry of resolved) {
      const key = `${entry.product.id}|${entry.variantId}`;
      const prev = aggregated.get(key);
      if (prev) prev.quantity += entry.quantity;
      else aggregated.set(key, { product: entry.product, variantId: entry.variantId, quantity: entry.quantity });
    }

    setSaving(true);
    try {
      // 1) Validar stock disponible en el almacén origen (solo lectura)
      const stockRes: any = await inventoryService.getAllStock();
      const stockLevels = Array.isArray(stockRes) ? stockRes : (stockRes?.data || []);
      const findLevelQty = (warehouseId: string, productId: string, variantId: string) => {
        const level = stockLevels.find((l: any) => {
          const lWarehouseId = l.warehouseId || l.warehouse?.id;
          const lVariantId = l.variantId || l.variant?.id;
          const lProductId = l.productId || l.product?.id;
          return lWarehouseId === warehouseId && (lVariantId === variantId || lProductId === productId);
        });
        return Number(level?.quantity || 0);
      };
      const checks: { product: any; variantId: string; quantity: number; fromQty: number; toQty: number }[] = [];
      for (const entry of aggregated.values()) {
        const fromQty = findLevelQty(newTransfer.fromId, entry.product.id, entry.variantId);
        const toQty = findLevelQty(newTransfer.toId, entry.product.id, entry.variantId);
        if (fromQty < entry.quantity) {
          toast.error(`Stock insuficiente de "${entry.product.name}" en el origen (disponible: ${fromQty})`);
          return;
        }
        checks.push({ ...entry, fromQty, toQty });
      }

      // 2) Crear la transferencia con todos los artículos
      await inventoryService.createTransfer({
        fromId: newTransfer.fromId,
        toId: newTransfer.toId,
        items: checks.map((c) => ({ variantId: c.variantId, quantity: c.quantity })),
      } as any);

      // 3) Restar del almacén origen y sumar en el destino por cada artículo
      for (const c of checks) {
        await inventoryService.updateStockLevel({
          productId: c.product.id,
          warehouseId: newTransfer.fromId,
          variantId: c.variantId,
          quantity: c.fromQty - c.quantity,
        });
        await inventoryService.updateStockLevel({
          productId: c.product.id,
          warehouseId: newTransfer.toId,
          variantId: c.variantId,
          quantity: c.toQty + c.quantity,
        });
      }

      const totalUnits = checks.reduce((sum, c) => sum + c.quantity, 0);
      toast.success(`Transferencia creada con ${checks.length} ${checks.length === 1 ? 'producto' : 'productos'} (${totalUnits} unidades)`);
      setIsCreating(false);
      setSerialPickerItemKey(null);
      setSerialSearch('');
      setNewTransfer({
        fromId: '',
        toId: '',
        items: [],
        date: new Date().toISOString().split('T')[0],
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
              <CircleHelp className="size-3.5 mr-1" /> Cómo transferir inventario
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
            {isCreating && <Card className="rounded-2xl border-primary/30 bg-primary/5 p-4" data-tour="inventory-transfer-form-data">
          <div className="mb-3 flex items-center justify-between" data-tour="inventory-transfer-form-title"><div><p className="text-[10px] font-black uppercase tracking-widest text-primary">Nueva transferencia</p><InventoryViewTutorial label="Cómo crear transferencia" targetPrefix="inventory-transfer-form" copy={{ data: { description: 'Selecciona origen, destino, productos, cantidades y fecha.' }, actions: { description: 'Guarda la transferencia para mover existencias entre almacenes.' } }} /></div><div className="flex gap-1" data-tour="inventory-transfer-form-actions"><Button type="button" variant="ghost" size="icon" className="size-8 text-emerald-500" onClick={handleCreateTransfer} disabled={saving} aria-label="Guardar transferencia">{saving ? <div className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Check className="size-4" />}</Button><Button type="button" variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setIsCreating(false)} disabled={saving} aria-label="Cancelar transferencia"><X className="size-4" /></Button></div></div>
          <div className="grid gap-3 sm:grid-cols-2"><Select value={newTransfer.fromId} onValueChange={handleFromWarehouseChange}><SelectTrigger><SelectValue placeholder="Almacén origen" /></SelectTrigger><SelectContent>{warehouses.map((warehouse: any) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}</SelectContent></Select><Select value={newTransfer.toId} onValueChange={(value) => setNewTransfer({ ...newTransfer, toId: value })}><SelectTrigger><SelectValue placeholder="Almacén destino" /></SelectTrigger><SelectContent>{warehouses.filter((warehouse) => warehouse.id !== newTransfer.fromId).map((warehouse: any) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}</SelectContent></Select><div className="flex flex-col gap-2 sm:col-span-2">{newTransfer.items.map((item) => { const itemProduct = products.find((p: any) => p.id === item.productId); const itemSerialRequired = isSerialTracked(itemProduct); return (<div key={item.key} className="flex flex-wrap items-center gap-2"><Combobox options={productOptions} value={item.productId} onChange={(value) => handleItemProductChange(item.key, value)} placeholder="Buscar producto..." searchPlaceholder="Buscar por código o nombre..." emptyMessage={newTransfer.fromId ? 'No hay productos en este almacén.' : 'Selecciona primero el almacén.'} maxVisibleOptions={productOptions.length} className="min-w-0 flex-1" disabled={saving} />{itemSerialRequired && <Button type="button" variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => { setSerialPickerItemKey(item.key); setSerialSearch(''); }} disabled={saving}>IMEI ({item.serials.length})</Button>}<Input type="number" min={1} value={itemSerialRequired ? item.serials.length : item.quantity} onChange={(event) => updateItem(item.key, { quantity: Number(event.target.value) || 1 })} disabled={saving || itemSerialRequired} placeholder="Cantidad" className="w-20" /><Button type="button" variant="ghost" size="icon" className="size-8 text-red-600" onClick={() => removeItem(item.key)} disabled={saving} aria-label="Quitar producto"><X className="size-4" /></Button></div>); })}<Button type="button" variant="outline" size="sm" className="h-8 w-fit gap-1 text-[10px] uppercase tracking-wider" onClick={addItem} disabled={saving || !newTransfer.fromId}><Plus className="size-3.5" /> Agregar producto</Button></div><Input className="sm:col-span-2" type="date" value={newTransfer.date} onChange={(event) => setNewTransfer({ ...newTransfer, date: event.target.value })} /></div>
        </Card>}
        {filteredTransfers.length === 0 && !isCreating ? <Card className="rounded-2xl border-dashed p-8 text-center text-muted-foreground"><Truck className="mx-auto mb-2 size-9 opacity-20" /><p>No hay transferencias</p></Card> : filteredTransfers.map((transfer: any) => <Card key={transfer.id} className="min-w-0 cursor-pointer rounded-2xl border-border/50 bg-card/70 p-4 shadow-sm transition-colors hover:bg-muted/30" onClick={() => setSelectedTransfer(transfer)}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-mono font-bold">{transfer.number}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(transfer.date).toLocaleDateString()}</p></div><Badge variant="outline" className="shrink-0 bg-emerald-500/10 text-[9px] font-black uppercase tracking-widest text-emerald-600"><Check className="mr-1 size-3" /> Completada</Badge></div><div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-border/40 pt-3 text-xs"><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Origen</p><p className="truncate font-medium">{transfer.from?.name || '—'}</p></div><ArrowRight className="size-4 text-muted-foreground" /><div className="min-w-0 text-right"><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Destino</p><p className="truncate font-medium">{transfer.to?.name || '—'}</p></div></div><div className="mt-3 flex justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground"><div className="flex flex-wrap items-center gap-1.5">{renderStockDelta(transfer)}</div></div></Card>)}
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
                <TableCell className="text-xs text-muted-foreground" data-tour="inventory-transfer-form-title"><div className="space-y-1"><span>Auto</span><InventoryViewTutorial label="Cómo crear transferencia" targetPrefix="inventory-transfer-form" copy={{ data: { description: 'Selecciona origen, destino, productos, cantidades y fecha.' }, actions: { description: 'Guarda la transferencia para mover existencias entre almacenes.' } }} /></div></TableCell>
                <TableCell data-tour="inventory-transfer-form-data">
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
                  <div className="flex min-w-72 flex-col gap-2">
                    {newTransfer.items.map((item) => {
                      const itemProduct = products.find((p: any) => p.id === item.productId);
                      const itemSerialRequired = isSerialTracked(itemProduct);
                      return (
                        <div key={item.key} className="flex flex-wrap items-center gap-2">
                          <Combobox
                            options={productOptions}
                            value={item.productId}
                            onChange={(v) => handleItemProductChange(item.key, v)}
                            placeholder="Buscar producto..."
                            searchPlaceholder="Buscar por código o nombre..."
                            emptyMessage={newTransfer.fromId ? 'No hay productos en este almacén.' : 'Selecciona primero el almacén.'}
                            maxVisibleOptions={productOptions.length}
                            className="w-48 min-w-48"
                            disabled={saving}
                          />
                          <Input
                            type="number"
                            value={itemSerialRequired ? item.serials.length : item.quantity}
                            onChange={(e) => updateItem(item.key, { quantity: parseInt(e.target.value) || 1 })}
                            className="h-8 text-xs w-20"
                            min={1}
                            disabled={saving || itemSerialRequired}
                          />
                          {itemSerialRequired && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-[10px] uppercase tracking-wider"
                              onClick={() => { setSerialPickerItemKey(item.key); setSerialSearch(''); }}
                              disabled={saving}
                            >
                              IMEI ({item.serials.length})
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="size-7 text-red-600 hover:bg-red-500/10" onClick={() => removeItem(item.key)} disabled={saving} aria-label="Quitar producto">
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-fit gap-1 text-[10px] uppercase tracking-wider"
                      onClick={addItem}
                      disabled={saving || !newTransfer.fromId}
                    >
                      <Plus className="size-3.5" /> Agregar producto
                    </Button>
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
                  <div className="flex gap-1" data-tour="inventory-transfer-form-actions">
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
                    <TableCell className="text-center">
                      {renderStockDelta(trf)}
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
      <Dialog open={serialPickerItemKey !== null} onOpenChange={(open) => { if (!open) setSerialPickerItemKey(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader data-tour="inventory-transfer-serial-title">
            <DialogTitle>Seleccionar IMEI / Series{serialProduct?.name ? ` · ${serialProduct.name}` : ''}</DialogTitle>
            <DialogDescription>
              Selecciona los IMEI disponibles del almacén origen para la transferencia.
            </DialogDescription>
            <InventoryViewTutorial label="Cómo asignar IMEI o series" targetPrefix="inventory-transfer-serial" copy={{ data: { description: 'Busca y marca las series disponibles del almacén origen.' }, actions: { description: 'Confirma la selección para asociarla a la transferencia.' } }} />
          </DialogHeader>
          <div className="space-y-3" data-tour="inventory-transfer-serial-data">
            <Input
              value={serialSearch}
              onChange={(e) => setSerialSearch(e.target.value)}
              placeholder="Buscar IMEI..."
              className="h-9 text-xs"
            />
            <div className="max-h-72 overflow-auto rounded-md border p-2 space-y-1">
              {getAvailableSerials(serialItem?.productId || '')
                .filter((item) => !serialSearch || String(item.number || '').toLowerCase().includes(serialSearch.toLowerCase()))
                .map((item) => {
                  const checked = (serialItem?.serials || []).includes(item.number);
                  return (
                    <label key={item.id} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-muted/40 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            if (!serialPickerItemKey) return;
                            const next = v
                              ? [...new Set([...(serialItem?.serials || []), item.number])]
                              : (serialItem?.serials || []).filter((n) => n !== item.number);
                            updateItem(serialPickerItemKey, { serials: next, quantity: next.length || 1 });
                          }}
                        />
                        <span className="text-xs font-mono">{item.number}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{item.warehouseName || '-'}</span>
                    </label>
                  );
                })}
              {getAvailableSerials(serialItem?.productId || '').length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">No hay seriales disponibles para este producto.</p>
              )}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Seleccionados</span>
              <Badge variant="outline">{(serialItem?.serials || []).length}</Badge>
            </div>
          </div>
          <DialogFooter data-tour="inventory-transfer-serial-actions">
            <Button variant="outline" onClick={() => setSerialPickerItemKey(null)}>Cerrar</Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => setSerialPickerItemKey(null)}
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

