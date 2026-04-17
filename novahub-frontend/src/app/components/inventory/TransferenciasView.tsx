import React, { useMemo, useState } from 'react';
import { Truck, ArrowRight, Search, Plus, Check, X, Package, PlusCircle, FilePlus, Calendar } from 'lucide-react';
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
import { cn } from '../ui/utils';

interface TransferenciasViewProps {
  transfers: any[];
  warehouses: any[];
  products: any[];
  series?: any[];
  onRefresh: () => void;
}

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pendiente', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  { value: 'IN_TRANSIT', label: 'En Tránsito', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  { value: 'COMPLETED', label: 'Completada', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  { value: 'CANCELLED', label: 'Cancelada', color: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
];

export function TransferenciasView({ transfers, warehouses, products, series = [], onRefresh }: TransferenciasViewProps) {
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/40" />
          <Input 
            placeholder="Buscar por guía o almacén..." 
            className="pl-9 h-10 w-full bg-background/50 border-border/50 rounded-xl text-xs"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button 
          onClick={() => setIsCreating(true)}
          disabled={isCreating}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 w-full sm:w-auto"
        >
          <PlusCircle className="size-4" /> Nueva Transferencia
        </Button>
      </div>

      {/* Mobile View (Cards) */}
      <div className="md:hidden space-y-4">
        {isCreating && (
          <Card className="p-4 border-2 border-primary/20 bg-primary/5 rounded-2xl space-y-4 shadow-xl">
             <div className="grid grid-cols-2 gap-3">
                <div>
                   <p className="text-[10px] font-black uppercase text-muted-foreground/60 mb-1">Origen</p>
                   <Select value={newTransfer.fromId} onValueChange={(v) => { setNewTransfer({...newTransfer, fromId: v}); setSelectedSerials([]); }}>
                      <SelectTrigger className="h-9 text-xs font-bold uppercase"><SelectValue placeholder="ORIGEN" /></SelectTrigger>
                      <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name.toUpperCase()}</SelectItem>)}</SelectContent>
                   </Select>
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase text-muted-foreground/60 mb-1">Destino</p>
                   <Select value={newTransfer.toId} onValueChange={(v) => setNewTransfer({...newTransfer, toId: v})}>
                      <SelectTrigger className="h-9 text-xs font-bold uppercase"><SelectValue placeholder="DESTINO" /></SelectTrigger>
                      <SelectContent>{warehouses.filter(w => w.id !== newTransfer.fromId).map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name.toUpperCase()}</SelectItem>)}</SelectContent>
                   </Select>
                </div>
             </div>
             <div className="space-y-3">
                <div>
                   <p className="text-[10px] font-black uppercase text-muted-foreground/60 mb-1">Producto</p>
                   <div className="flex gap-2">
                      <Select value={newTransfer.productId} onValueChange={(v) => { setNewTransfer({...newTransfer, productId: v}); setSelectedSerials([]); }}>
                        <SelectTrigger className="h-9 text-xs font-bold uppercase flex-1"><SelectValue placeholder="SELECCIONAR..." /></SelectTrigger>
                        <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name.toUpperCase()}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input type="number" value={isSerialTracked(selectedProduct) ? selectedSerials.length : newTransfer.quantity} onChange={(e) => setNewTransfer({...newTransfer, quantity: parseInt(e.target.value) || 1})} className="h-9 w-16 text-center font-black" disabled={isSerialTracked(selectedProduct)} />
                   </div>
                </div>
                {isSerialTracked(selectedProduct) && (
                   <Button variant="outline" className="w-full h-9 rounded-xl font-black text-[10px] uppercase tracking-widest" onClick={() => setSerialPickerOpen(true)}>
                      IMEI SELECCIONADOS ({selectedSerials.length})
                   </Button>
                )}
             </div>
             <div className="flex gap-2 pt-2">
                <Button className="flex-1 bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest h-10 rounded-xl" onClick={handleCreateTransfer} disabled={saving}>Confirmar Transferencia</Button>
                <Button variant="ghost" className="size-10 rounded-xl" onClick={() => setIsCreating(false)}><X className="size-4" /></Button>
             </div>
          </Card>
        )}

        {filteredTransfers.length === 0 && !isCreating ? (
          <div className="text-center py-20 bg-muted/5 rounded-3xl border border-dashed border-border/50">
            <Truck className="size-12 mx-auto mb-4 text-muted-foreground/20" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/40">No hay transferencias registradas</p>
          </div>
        ) : (
          filteredTransfers.map((trf: any) => {
            const statusInfo = getStatusInfo(trf.status);
            return (
              <Card key={trf.id} className="p-4 border-border/50 rounded-2xl shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-mono font-black text-xs text-primary mb-1">{trf.number}</h4>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                      <span>{trf.from?.name}</span>
                      <ArrowRight className="size-3" />
                      <span>{trf.to?.name}</span>
                    </div>
                  </div>
                  <Badge className={cn("text-[9px] font-black uppercase px-2 py-0.5 border rounded-lg shadow-none", statusInfo.color)}>
                    {statusInfo.label}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between pt-3 border-t border-border/40 text-[10px] font-black uppercase tracking-widest">
                  <div className="flex items-center gap-2 text-muted-foreground/40">
                    <Calendar className="size-3" />
                    <span>{new Date(trf.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground/40">Items:</span>
                    <Badge variant="outline" className="h-5 px-1.5 font-black bg-primary/5 border-none text-primary">{trf.items?.length || 0}</Badge>
                  </div>
                </div>

                {trf.status !== 'COMPLETED' && trf.status !== 'CANCELLED' && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Button variant="outline" className="h-8 rounded-lg text-[9px] font-black uppercase" onClick={() => handleUpdateStatus(trf.id, 'COMPLETED')}>Completar</Button>
                    <Button variant="ghost" className="h-8 rounded-lg text-[9px] font-black uppercase text-rose-500" onClick={() => handleUpdateStatus(trf.id, 'CANCELLED')}>Cancelar</Button>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Desktop View (Table) */}
      <div className="hidden md:block rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border/50">
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-28">Guía</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Origen</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-center">→</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Destino</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-center w-48">Items</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-40">Fecha</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-44 text-right">Estado / Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isCreating && (
              <TableRow className="bg-primary/5 border-b border-primary/20">
                <TableCell className="text-[10px] font-black uppercase text-primary">AUTO-GEN</TableCell>
                <TableCell>
                  <Select value={newTransfer.fromId} onValueChange={(v) => { setNewTransfer({...newTransfer, fromId: v}); setSelectedSerials([]); }}>
                    <SelectTrigger className="h-8 text-[10px] font-black uppercase rounded-lg"><SelectValue placeholder="ORIGEN" /></SelectTrigger>
                    <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name.toUpperCase()}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-center"><ArrowRight className="size-4 mx-auto text-primary/40" /></TableCell>
                <TableCell>
                  <Select value={newTransfer.toId} onValueChange={(v) => setNewTransfer({...newTransfer, toId: v})}>
                    <SelectTrigger className="h-8 text-[10px] font-black uppercase rounded-lg"><SelectValue placeholder="DESTINO" /></SelectTrigger>
                    <SelectContent>{warehouses.filter(w => w.id !== newTransfer.fromId).map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name.toUpperCase()}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2 items-center justify-center">
                    <Select value={newTransfer.productId} onValueChange={(v) => { setNewTransfer({...newTransfer, productId: v}); setSelectedSerials([]); }}>
                      <SelectTrigger className="h-8 text-[10px] font-black uppercase rounded-lg w-32"><SelectValue placeholder="PROD" /></SelectTrigger>
                      <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name.toUpperCase()}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" value={isSerialTracked(selectedProduct) ? selectedSerials.length : newTransfer.quantity} onChange={(e) => setNewTransfer({...newTransfer, quantity: parseInt(e.target.value) || 1})} className="h-8 w-14 text-center font-black" disabled={isSerialTracked(selectedProduct)} />
                    {isSerialTracked(selectedProduct) && (
                      <Button variant="outline" size="sm" className="h-8 text-[9px] font-black uppercase rounded-lg px-2" onClick={() => setSerialPickerOpen(true)}>IMEI ({selectedSerials.length})</Button>
                    )}
                  </div>
                </TableCell>
                <TableCell><Input type="date" value={newTransfer.date} onChange={(e) => setNewTransfer({...newTransfer, date: e.target.value})} className="h-8 text-[10px] font-black" /></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="size-8 rounded-lg text-emerald-500 hover:bg-emerald-500/10" onClick={handleCreateTransfer} disabled={saving}><Check className="size-4" /></Button>
                    <Button size="icon" variant="ghost" className="size-8 rounded-lg text-rose-500 hover:bg-rose-500/10" onClick={() => setIsCreating(false)}><X className="size-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            
            {filteredTransfers.length === 0 && !isCreating ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16">
                  <Truck className="size-12 mx-auto mb-4 text-muted-foreground/20" />
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/40">No hay transferencias en este momento</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredTransfers.map((trf: any) => {
                const statusInfo = getStatusInfo(trf.status);
                const isUpdating = updatingId === trf.id;
                return (
                  <TableRow key={trf.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono text-[10px] font-black text-primary">{trf.number}</TableCell>
                    <TableCell className="text-[10px] font-black uppercase tracking-tight">{trf.from?.name || '-'}</TableCell>
                    <TableCell className="text-center"><ArrowRight className="size-4 mx-auto text-muted-foreground/20" /></TableCell>
                    <TableCell className="text-[10px] font-black uppercase tracking-tight">{trf.to?.name || '-'}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-black text-[10px] bg-primary/5 border-none text-primary px-2">{trf.items?.length || 0} ITEMS</Badge>
                    </TableCell>
                    <TableCell className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest">{new Date(trf.date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Select 
                          value={trf.status} 
                          onValueChange={(v) => handleUpdateStatus(trf.id, v)}
                          disabled={isUpdating || trf.status === 'COMPLETED' || trf.status === 'CANCELLED'}
                        >
                          <SelectTrigger className={cn("h-8 text-[10px] font-black uppercase w-36 rounded-lg shadow-none", statusInfo.color)}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label.toUpperCase()}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="px-2 text-[10px] text-muted-foreground font-black uppercase tracking-widest">
        {filteredTransfers.length} transferencias registradas · NovaHub Logistics
      </div>

      <Dialog open={serialPickerOpen} onOpenChange={setSerialPickerOpen}>
        <DialogContent className="sm:max-w-2xl rounded-3xl overflow-hidden p-0 border-none shadow-2xl">
          <DialogHeader className="bg-primary p-6 text-primary-foreground">
            <DialogTitle className="font-black uppercase tracking-tighter text-2xl">Seleccionar IMEI / Series</DialogTitle>
            <DialogDescription className="text-white/60 font-bold uppercase text-[10px] tracking-widest">
              Selecciona los equipos disponibles para esta transferencia.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-6 bg-background">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/40" />
              <Input
                value={serialSearch}
                onChange={(e) => setSerialSearch(e.target.value)}
                placeholder="BUSCAR IMEI..."
                className="pl-9 h-11 text-xs font-black uppercase rounded-xl bg-muted/5 border-border/50"
              />
            </div>
            <div className="max-h-80 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {availableSerials
                .filter((item) => !serialSearch || String(item.number || '').toLowerCase().includes(serialSearch.toLowerCase()))
                .map((item) => {
                  const checked = selectedSerials.includes(item.number);
                  return (
                    <label key={item.id} className={cn("flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer", checked ? "bg-primary/5 border-primary shadow-sm" : "bg-muted/5 border-border/40 hover:border-border/80")}>
                      <div className="flex items-center gap-4">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            if (v) setSelectedSerials((prev) => [...new Set([...prev, item.number])]);
                            else setSelectedSerials((prev) => prev.filter((n) => n !== item.number));
                          }}
                          className="rounded-md size-5"
                        />
                        <span className="text-sm font-black font-mono tracking-tight">{item.number}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] font-black uppercase bg-background border-border/40 text-muted-foreground/60">{item.warehouseName || 'SIN ALMACÉN'}</Badge>
                    </label>
                  );
                })}
              {availableSerials.length === 0 && (
                <div className="text-center py-12">
                  <Package className="size-12 mx-auto mb-4 text-muted-foreground/10" />
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/30">No hay seriales disponibles</p>
                </div>
              )}
            </div>
          </div>
          <div className="p-6 bg-muted/5 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest">Seleccionados:</span>
              <Badge className="bg-primary text-primary-foreground font-black px-3">{selectedSerials.length}</Badge>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="ghost" className="rounded-xl font-black uppercase text-[10px] tracking-widest flex-1 sm:flex-none" onClick={() => setSerialPickerOpen(false)}>Cancelar</Button>
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-black uppercase text-[10px] tracking-widest h-11 px-8 flex-1 sm:flex-none"
                onClick={() => {
                  setNewTransfer((prev) => ({ ...prev, quantity: selectedSerials.length || 1 }));
                  setSerialPickerOpen(false);
                }}
              >
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

