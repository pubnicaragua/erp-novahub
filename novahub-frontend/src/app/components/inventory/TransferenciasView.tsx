import { useMemo, useState } from 'react';
import { Truck, ArrowRight, Search, Plus, Check, X, Package, CircleHelp } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { inventoryService } from '../../services/inventario.service';
import { useAuth } from '../../contexts/AuthContext';
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';
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

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pendiente', color: 'bg-orange-500/10 text-orange-600' },
  { value: 'IN_TRANSIT', label: 'En Tránsito', color: 'bg-blue-500/10 text-blue-600' },
  { value: 'COMPLETED', label: 'Completada', color: 'bg-green-500/10 text-green-600' },
  { value: 'CANCELLED', label: 'Cancelada', color: 'bg-red-500/10 text-red-600' },
];

const TRANSFER_TOUR_STEPS: GuidedTourStep[] = [
  {
    target: '[data-tour="transfer-title"]',
    title: 'Transferencias',
    description: 'Registra transferencias de inventario entre almacenes o sucursales. Cada transferencia tiene un origen, un destino y puede estar en diferentes estados.',
    tip: 'Las transferencias pendientes no afectan el stock hasta que se completan.',
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
    description: 'Aquí ves todas las transferencias con su guía, origen, destino, cantidad de items y estado.',
    placement: 'top',
  },
  {
    target: '[data-tour="transfer-status"]',
    title: 'Estado de Transferencia',
    description: 'Puedes cambiar el estado de una transferencia. Los estados disponibles son: Pendiente, En Tránsito, Completada y Cancelada.',
    tip: 'Completar una transferencia descuenta del origen y agrega al destino automáticamente.',
    placement: 'left',
  },
];

export function TransferenciasView({ transfers, warehouses, products, series = [], onRefresh, pagination, onSearchChange, onStatusChange }: TransferenciasViewProps) {
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
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);

  const selectedProduct = useMemo(
    () => products.find((p: any) => p.id === newTransfer.productId),
    [products, newTransfer.productId],
  );

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

  const getStatusInfo = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  };

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
      toast.success('Transferencia creada');
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

  const handleUpdateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await inventoryService.updateTransferStatus(id, status as any);
      toast.success('Estado actualizado');
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Error al actualizar');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Card className="p-4 border bg-card rounded-xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4" data-tour="transfer-title">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm" data-tour="transfer-search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por guía o almacén..." 
              className="pl-9 h-9"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }}
            />
          </div>
          {pagination && <Select defaultValue="ALL" onValueChange={(value) => onStatusChange?.(value)}>
            <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent><SelectItem value="ALL">Todos</SelectItem>{STATUS_OPTIONS.map((status) => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}</SelectContent>
          </Select>}
        </div>
        {canPerform('INVENTORY_TRANSFERS', 'create') && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowTutorial(true)} className="mr-1">
              <CircleHelp className="size-3.5 mr-1" /> Tutorial
            </Button>
            <Button 
              size="sm" 
              className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all gap-2 font-black text-xs uppercase tracking-widest h-10 px-6"
              onClick={() => setIsCreating(true)}
              disabled={isCreating}
              data-tour="transfer-new-btn"
            >
              <Plus className="size-4" />
              Nueva Transferencia
            </Button>
          </>
        )}
      </div>

      <div className="rounded-lg border overflow-hidden" data-tour="transfer-table">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border/50">
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-28">Guía</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Origen</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-center">→</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Destino</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-center w-48">Items</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-40">Fecha</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-36">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isCreating && (
              <TableRow className="bg-blue-500/5">
                <TableCell className="text-xs text-muted-foreground">Auto</TableCell>
                <TableCell>
                  <Select value={newTransfer.fromId} onValueChange={(v) => { setNewTransfer({...newTransfer, fromId: v}); setSelectedSerials([]); }}>
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
                  <div className="flex gap-2 items-center">
                    <Select value={newTransfer.productId} onValueChange={(v) => { setNewTransfer({...newTransfer, productId: v}); setSelectedSerials([]); }}>
                      <SelectTrigger className="h-8 text-xs w-28"><SelectValue placeholder="Prod" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input 
                      type="number" 
                      value={isSerialTracked(selectedProduct) ? selectedSerials.length : newTransfer.quantity} 
                      onChange={(e) => setNewTransfer({...newTransfer, quantity: parseInt(e.target.value) || 1})}
                      className="h-8 text-xs w-16"
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
              filteredTransfers.map((trf: any) => {
                const statusInfo = getStatusInfo(trf.status);
                const isUpdating = updatingId === trf.id;
                return (
                  <TableRow key={trf.id} className="group hover:bg-muted/30">
                    <TableCell className="font-mono text-xs">{trf.number}</TableCell>
                    <TableCell className="text-sm">{trf.from?.name || '-'}</TableCell>
                    <TableCell className="text-center"><ArrowRight className="size-4 mx-auto text-muted-foreground" /></TableCell>
                    <TableCell className="text-sm">{trf.to?.name || '-'}</TableCell>
                    <TableCell className="text-center font-medium">{trf.items?.length || 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(trf.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Select 
                        value={trf.status} 
                        onValueChange={(v) => handleUpdateStatus(trf.id, v)}
                        disabled={!canPerform('INVENTORY_TRANSFERS', 'edit') || isUpdating || trf.status === 'COMPLETED' || trf.status === 'CANCELLED'}
                        data-tour="transfer-status"
                      >
                        <SelectTrigger className={`h-7 text-[10px] font-medium ${statusInfo.color}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-3 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
        {pagination?.total ?? filteredTransfers.length} transferencias
        {pagination && (
          <span className="ml-4 inline-flex items-center gap-2 normal-case tracking-normal">
            <select value={pagination.pageSize} onChange={(event) => pagination.onPageSizeChange(Number(event.target.value) as 50 | 100 | 200)} className="h-7 rounded border bg-background px-1 font-bold text-foreground">
              {[50, 100, 200].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
            <button type="button" className="rounded border px-2 py-1 disabled:opacity-40" onClick={() => pagination.onPageChange(Math.max(1, pagination.page - 1))} disabled={pagination.page <= 1}>‹</button>
            <span>Pág. {pagination.page}/{pagination.totalPages}</span>
            <button type="button" className="rounded border px-2 py-1 disabled:opacity-40" onClick={() => pagination.onPageChange(Math.min(pagination.totalPages, pagination.page + 1))} disabled={pagination.page >= pagination.totalPages}>›</button>
          </span>
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

