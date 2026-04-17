import React, { useMemo, useState } from 'react';
import { Scale, Plus, Check, X, CheckCircle, Receipt, Trash2, PlusCircle, FilePlus, Calendar, Box } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { inventoryService } from '../../services/inventario.service';
import { cn } from '../ui/utils';

interface ControlStockViewProps {
  adjustments: any[];
  warehouses: any[];
  products: any[];
  series?: any[];
  onRefresh: () => void;
}

interface ReceptionAllocation {
  id: string;
  warehouseId: string;
  quantity: number;
}

const REASON_OPTIONS = [
  { value: 'DISCREPANCY', label: 'Discrepancia' },
  { value: 'DAMAGE', label: 'Daño' },
  { value: 'THEFT', label: 'Robo' },
  { value: 'EXPIRATION', label: 'Vencimiento' },
  { value: 'OTHER', label: 'Otro' },
];

export function ControlStockView({ adjustments, warehouses, products, series = [], onRefresh }: ControlStockViewProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [isReceptionOpen, setIsReceptionOpen] = useState(false);
  const [isSerialAdjustOpen, setIsSerialAdjustOpen] = useState(false);
  const [newAdjustment, setNewAdjustment] = useState({ warehouseId: '', reason: 'DISCREPANCY', productId: '', currentStock: 0, actualStock: 0 });
  const [newReception, setNewReception] = useState({
    productId: '',
    totalQuantity: 0,
    notes: '',
    imeiText: '',
  });
  const [allocations, setAllocations] = useState<ReceptionAllocation[]>([
    { id: `alloc-${Date.now()}`, warehouseId: '', quantity: 0 },
  ]);
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [serialAdjustment, setSerialAdjustment] = useState({
    action: 'ADD',
    productId: '',
    warehouseId: '',
    serialNumber: '',
    notes: '',
  });

  const totalAllocated = useMemo(
    () => allocations.reduce((acc, item) => acc + Number(item.quantity || 0), 0),
    [allocations],
  );

  const imeiList = useMemo(
    () =>
      newReception.imeiText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    [newReception.imeiText],
  );

  const isSerialTracked = (product: any) =>
    Boolean(
      product?.trackSerialNumbers ||
      product?.serialTracking ||
      product?.serialNumberTracking ||
      String(product?.trackingType || '').toUpperCase() === 'SERIAL',
    );

  const selectedReceptionProduct = useMemo(
    () => products.find((p: any) => p.id === newReception.productId),
    [products, newReception.productId],
  );

  const existingSeriesNumbers = useMemo(
    () => new Set(series.map((s: any) => String(s.number || '').trim()).filter(Boolean)),
    [series],
  );

  const handleCreateAdjustment = async () => {
    if (!newAdjustment.warehouseId || !newAdjustment.productId) {
      toast.error('Selecciona almacén y producto');
      return;
    }
    
    setSaving(true);
    try {
      await inventoryService.createAdjustment({
        warehouseId: newAdjustment.warehouseId,
        reason: newAdjustment.reason,
        items: [{
          productId: newAdjustment.productId,
          currentStock: newAdjustment.currentStock,
          actualStock: newAdjustment.actualStock,
        }],
      });
      toast.success('Ajuste creado');
      setIsCreating(false);
      setNewAdjustment({ warehouseId: '', reason: 'DISCREPANCY', productId: '', currentStock: 0, actualStock: 0 });
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Error al crear ajuste');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveAdjustment = async (id: string) => {
    setApprovingId(id);
    try {
      await inventoryService.approveAdjustment(id);
      toast.success('Ajuste aprobado y aplicado');
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Error al aprobar');
    } finally {
      setApprovingId(null);
    }
  };

  const updateAllocation = (id: string, patch: Partial<ReceptionAllocation>) => {
    setAllocations((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addAllocationRow = () => {
    setAllocations((prev) => [...prev, { id: `alloc-${Date.now()}-${prev.length}`, warehouseId: '', quantity: 0 }]);
  };

  const removeAllocationRow = (id: string) => {
    setAllocations((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));
  };

  const resetReception = () => {
    setNewReception({ productId: '', totalQuantity: 0, notes: '', imeiText: '' });
    setAllocations([{ id: `alloc-${Date.now()}`, warehouseId: '', quantity: 0 }]);
  };

  const handleCreateReception = async () => {
    if (!newReception.productId) return toast.error('Selecciona un producto');
    if (Number(newReception.totalQuantity || 0) <= 0) return toast.error('La cantidad total debe ser mayor a 0');

    const validAllocations = allocations.filter(
      (item) => item.warehouseId && Number(item.quantity || 0) > 0,
    );

    if (validAllocations.length === 0) {
      return toast.error('Debes distribuir al menos en una bodega');
    }

    if (totalAllocated !== Number(newReception.totalQuantity || 0)) {
      return toast.error('La distribución por bodegas debe sumar la cantidad total recibida');
    }

    const uniqueWarehouses = new Set(validAllocations.map((item) => item.warehouseId));
    if (uniqueWarehouses.size !== validAllocations.length) {
      return toast.error('No repitas la misma bodega en la distribución');
    }

    if (imeiList.length > 0 && imeiList.length !== Number(newReception.totalQuantity || 0)) {
      return toast.error('La cantidad de IMEI/series debe coincidir con la cantidad total recibida');
    }

    const normalizedImeis = imeiList.map((n) => n.trim()).filter(Boolean);
    const uniqueInputImeis = new Set(normalizedImeis);
    if (normalizedImeis.length !== uniqueInputImeis.size) {
      return toast.error('No repitas IMEI/series en la misma recepción');
    }

    const serialRequired = isSerialTracked(selectedReceptionProduct);
    if (serialRequired && normalizedImeis.length !== Number(newReception.totalQuantity || 0)) {
      return toast.error('Este producto requiere IMEI/series por cada unidad recibida');
    }

    const repeatedExisting = normalizedImeis.find((num) => existingSeriesNumbers.has(num));
    if (repeatedExisting) {
      return toast.error(`El IMEI/serie ${repeatedExisting} ya existe en inventario`);
    }

    setSaving(true);
    const reference = `REC-${Date.now().toString().slice(-8)}`;

    try {
      await Promise.all(
        validAllocations.map((item) =>
          inventoryService.createMovement({
            productId: newReception.productId,
            warehouseId: item.warehouseId,
            type: 'IN',
            quantity: Number(item.quantity || 0),
            reference: `${reference}${newReception.notes ? ` - ${newReception.notes}` : ''}`,
          }),
        ),
      );

      if (normalizedImeis.length > 0) {
        await Promise.all(
          normalizedImeis.map((seriesNumber) =>
            inventoryService.createSeries({
              productId: newReception.productId,
              number: seriesNumber,
            }),
          ),
        );
      }

      toast.success(`Recepción registrada: ${newReception.totalQuantity} unidades${imeiList.length ? ` + ${imeiList.length} IMEI/series` : ''}`);
      setIsReceptionOpen(false);
      resetReception();
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Error al registrar recepción');
    } finally {
      setSaving(false);
    }
  };

  const handleSerialAdjustment = async () => {
    const serial = serialAdjustment.serialNumber.trim();
    if (!serial || !serialAdjustment.productId || !serialAdjustment.warehouseId) {
      toast.error('Completa producto, almacén e IMEI/serie');
      return;
    }

    const exists = series.find(
      (s: any) =>
        String(s.number || '').trim() === serial &&
        (s.productId === serialAdjustment.productId || s.product?.id === serialAdjustment.productId),
    );

    if (serialAdjustment.action === 'ADD' && exists) {
      toast.error('Ese IMEI/serie ya existe para el producto seleccionado');
      return;
    }
    if (serialAdjustment.action === 'REMOVE' && !exists) {
      toast.error('No se encontró ese IMEI/serie para removerlo');
      return;
    }

    setSaving(true);
    const reference = `AJUSTE-IMEI-${Date.now().toString().slice(-8)}${serialAdjustment.notes ? ` - ${serialAdjustment.notes}` : ''}`;
    try {
      if (serialAdjustment.action === 'ADD') {
        await inventoryService.createSeries({
          productId: serialAdjustment.productId,
          number: serial,
        });
        await inventoryService.createMovement({
          productId: serialAdjustment.productId,
          warehouseId: serialAdjustment.warehouseId,
          type: 'IN',
          quantity: 1,
          reference: `${reference} [${serial}]`,
        });
      } else {
        if (exists?.id) {
          await inventoryService.deleteSeries(exists.id);
        }
        await inventoryService.createMovement({
          productId: serialAdjustment.productId,
          warehouseId: serialAdjustment.warehouseId,
          type: 'OUT',
          quantity: 1,
          reference: `${reference} [${serial}]`,
        });
      }

      toast.success(serialAdjustment.action === 'ADD' ? 'IMEI/serie agregado' : 'IMEI/serie ajustado');
      setIsSerialAdjustOpen(false);
      setSerialAdjustment({ action: 'ADD', productId: '', warehouseId: '', serialNumber: '', notes: '' });
      onRefresh();
    } catch (e: any) {
      toast.error(e.message || 'Error al ajustar IMEI/serie');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'DRAFT': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      default: return 'bg-muted text-muted-foreground border-border/50';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 py-2">
        <div>
          <h3 className="text-xl font-black uppercase tracking-tight italic">Ajustes de Inventario</h3>
          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] mt-1">
            {adjustments.length} ajustes registrados · Auditoría y control de stock
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none rounded-xl font-black text-[10px] uppercase tracking-widest h-10 px-4"
            onClick={() => setIsSerialAdjustOpen(true)}
          >
            IMEI / Series
          </Button>
          <Button
            variant="outline"
            className="flex-1 sm:flex-none rounded-xl font-black text-[10px] uppercase tracking-widest h-10 px-4"
            onClick={() => setIsReceptionOpen(true)}
          >
            <Receipt className="size-4 mr-2 text-primary" /> Registrar Recepción
          </Button>
          <Button 
            onClick={() => setIsCreating(true)}
            disabled={isCreating}
            className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20"
          >
            <FilePlus className="size-4" /> Nuevo Ajuste
          </Button>
        </div>
      </div>

      {/* Mobile View (Cards) */}
      <div className="md:hidden space-y-4">
        {isCreating && (
          <Card className="p-4 border-2 border-primary/20 bg-primary/5 rounded-2xl space-y-4 shadow-xl">
             <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                     <p className="text-[10px] font-black uppercase text-muted-foreground/60 mb-1">Almacén</p>
                     <Select value={newAdjustment.warehouseId} onValueChange={(v) => setNewAdjustment({ ...newAdjustment, warehouseId: v })}>
                        <SelectTrigger className="h-9 text-xs font-bold uppercase"><SelectValue placeholder="ORIGEN" /></SelectTrigger>
                        <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name.toUpperCase()}</SelectItem>)}</SelectContent>
                     </Select>
                  </div>
                  <div>
                     <p className="text-[10px] font-black uppercase text-muted-foreground/60 mb-1">Razón</p>
                     <Select value={newAdjustment.reason} onValueChange={(v) => setNewAdjustment({ ...newAdjustment, reason: v })}>
                        <SelectTrigger className="h-9 text-xs font-bold uppercase"><SelectValue /></SelectTrigger>
                        <SelectContent>{REASON_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label.toUpperCase()}</SelectItem>)}</SelectContent>
                     </Select>
                  </div>
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase text-muted-foreground/60 mb-1">Producto</p>
                   <Select value={newAdjustment.productId} onValueChange={(v) => setNewAdjustment({ ...newAdjustment, productId: v })}>
                      <SelectTrigger className="h-9 text-xs font-bold uppercase"><SelectValue placeholder="SELECCIONAR PRODUCTO" /></SelectTrigger>
                      <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name.toUpperCase()}</SelectItem>)}</SelectContent>
                   </Select>
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase text-muted-foreground/60 mb-1">Stock Actual (Físico)</p>
                   <Input type="number" placeholder="CANTIDAD" value={newAdjustment.actualStock} onChange={(e) => setNewAdjustment({ ...newAdjustment, actualStock: parseInt(e.target.value, 10) || 0 })} className="h-10 text-xs font-black" />
                </div>
             </div>
             <div className="flex gap-2 pt-2">
                <Button className="flex-1 bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest h-10 rounded-xl shadow-lg" onClick={handleCreateAdjustment} disabled={saving}>Guardar Ajuste</Button>
                <Button variant="ghost" className="size-10 rounded-xl" onClick={() => setIsCreating(false)}><X className="size-4" /></Button>
             </div>
          </Card>
        )}

        {adjustments.length === 0 && !isCreating ? (
          <div className="text-center py-20 bg-muted/5 rounded-3xl border border-dashed border-border/50">
            <Scale className="size-12 mx-auto mb-4 text-muted-foreground/20" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/40">No hay ajustes pendientes</p>
          </div>
        ) : (
          adjustments.map((adj: any) => {
            const statusClass = getStatusBadge(adj.status);
            return (
              <Card key={adj.id} className="p-4 border-border/50 rounded-2xl shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-mono font-black text-xs text-primary mb-1">{adj.number}</h4>
                    <p className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">{adj.warehouse?.name || 'ALMACÉN DESCONOCIDO'}</p>
                  </div>
                  <Badge className={cn("text-[9px] font-black uppercase px-2 py-0.5 border rounded-lg shadow-none", statusClass)}>
                    {adj.status === 'APPROVED' ? 'APROBADO' : 'BORRADOR'}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 py-3 border-y border-border/40">
                  <div>
                    <p className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-widest mb-0.5">Razón</p>
                    <p className="text-xs font-black uppercase tracking-tight">{REASON_OPTIONS.find((r) => r.value === adj.reason)?.label || adj.reason}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-widest mb-0.5">Items</p>
                    <Badge variant="outline" className="font-black h-5 px-1.5 bg-primary/5 text-primary border-none">{adj.items?.length || 0}</Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest">
                    <Calendar className="size-3" />
                    <span>{new Date(adj.date).toLocaleDateString()}</span>
                  </div>
                  {adj.status === 'DRAFT' && (
                    <Button variant="outline" size="sm" className="h-8 rounded-lg text-[9px] font-black uppercase text-emerald-500 gap-1" onClick={() => handleApproveAdjustment(adj.id)} disabled={approvingId === adj.id}>
                       <CheckCircle className="size-3" /> Aprobar
                    </Button>
                  )}
                </div>
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
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-32">Número</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Almacén</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-40">Razón</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-center w-24">Items</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-40">Fecha</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-32">Estado</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isCreating && (
              <TableRow className="bg-primary/5 border-b border-primary/20">
                <TableCell className="text-[10px] font-black uppercase text-primary">AUTO-GEN</TableCell>
                <TableCell>
                  <Select value={newAdjustment.warehouseId} onValueChange={(v) => setNewAdjustment({ ...newAdjustment, warehouseId: v })}>
                    <SelectTrigger className="h-8 text-[10px] font-black uppercase rounded-lg"><SelectValue placeholder="ALMACÉN" /></SelectTrigger>
                    <SelectContent>{warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name.toUpperCase()}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={newAdjustment.reason} onValueChange={(v) => setNewAdjustment({ ...newAdjustment, reason: v })}>
                    <SelectTrigger className="h-8 text-[10px] font-black uppercase rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>{REASON_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label.toUpperCase()}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2 items-center justify-center">
                    <Select value={newAdjustment.productId} onValueChange={(v) => setNewAdjustment({ ...newAdjustment, productId: v })}>
                      <SelectTrigger className="h-8 text-[10px] font-black uppercase rounded-lg w-32"><SelectValue placeholder="PRODUCTO" /></SelectTrigger>
                      <SelectContent>{products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" placeholder="FIS" value={newAdjustment.actualStock} onChange={(e) => setNewAdjustment({ ...newAdjustment, actualStock: parseInt(e.target.value, 10) || 0 })} className="h-8 w-14 text-center font-black" />
                  </div>
                </TableCell>
                <TableCell><span className="text-[10px] font-black uppercase text-primary/40">HOY</span></TableCell>
                <TableCell><Badge variant="outline" className="text-[9px] font-black bg-amber-500/10 text-amber-600 border-amber-500/20">BORRADOR</Badge></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="size-8 rounded-lg text-emerald-500 hover:bg-emerald-500/10" onClick={handleCreateAdjustment} disabled={saving}><Check className="size-4" /></Button>
                    <Button size="icon" variant="ghost" className="size-8 rounded-lg text-rose-500 hover:bg-rose-500/10" onClick={() => setIsCreating(false)}><X className="size-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            
            {adjustments.length === 0 && !isCreating ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16">
                  <Scale className="size-12 mx-auto mb-4 text-muted-foreground/20" />
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/40">No hay registros de ajustes</p>
                </TableCell>
              </TableRow>
            ) : (
              adjustments.map((adj: any) => {
                const isApproving = approvingId === adj.id;
                const statusClass = getStatusBadge(adj.status);
                return (
                  <TableRow key={adj.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono text-[10px] font-black text-primary">{adj.number}</TableCell>
                    <TableCell className="text-[10px] font-black uppercase tracking-tight">{adj.warehouse?.name || '-'}</TableCell>
                    <TableCell className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{REASON_OPTIONS.find((r) => r.value === adj.reason)?.label || adj.reason}</TableCell>
                    <TableCell className="text-center">
                       <Badge variant="outline" className="font-black text-[10px] bg-primary/5 border-none text-primary px-2">{adj.items?.length || 0} ITEMS</Badge>
                    </TableCell>
                    <TableCell className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest">{new Date(adj.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge className={cn("text-[9px] font-black uppercase px-2 py-0 border shadow-none", statusClass)}>
                        {adj.status === 'APPROVED' ? 'APROBADO' : 'BORRADOR'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {adj.status === 'DRAFT' && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 text-[10px] font-black uppercase text-emerald-500 hover:bg-emerald-500/10 gap-1 rounded-xl"
                          onClick={() => handleApproveAdjustment(adj.id)}
                          disabled={isApproving}
                        >
                          {isApproving ? <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="size-3" />}
                          Aprobar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="px-2 text-[10px] text-muted-foreground font-black uppercase tracking-widest flex items-center justify-between">
        <span>Ajustes auditados por NovaHub Inventory</span>
        <span className="hidden sm:block">Los ajustes aprobados actualizan el stock físico de forma inmediata</span>
      </div>

      <Dialog open={isSerialAdjustOpen} onOpenChange={setIsSerialAdjustOpen}>
        <DialogContent className="sm:max-w-xl rounded-3xl overflow-hidden p-0 border-none shadow-2xl">
          <DialogHeader className="bg-primary p-6 text-primary-foreground">
            <DialogTitle className="font-black uppercase tracking-tighter text-2xl">Ajustar IMEI / Series</DialogTitle>
            <DialogDescription className="text-white/60 font-bold uppercase text-[10px] tracking-widest">
              Alta o baja manual de equipos serializados.
            </DialogDescription>
          </DialogHeader>
          <div className="p-6 space-y-4 bg-background">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground/40 mb-1 tracking-widest">Acción</p>
                <Select value={serialAdjustment.action} onValueChange={(v) => setSerialAdjustment({ ...serialAdjustment, action: v })}>
                  <SelectTrigger className="h-10 text-xs font-black uppercase rounded-xl border-border/50 bg-muted/5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADD">AGREGAR</SelectItem>
                    <SelectItem value="REMOVE">REMOVER</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <p className="text-[10px] font-black uppercase text-muted-foreground/40 mb-1 tracking-widest">Producto</p>
                <Select value={serialAdjustment.productId} onValueChange={(v) => setSerialAdjustment({ ...serialAdjustment, productId: v })}>
                  <SelectTrigger className="h-10 text-xs font-black uppercase rounded-xl border-border/50 bg-muted/5"><SelectValue placeholder="SELECCIONAR..." /></SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground/40 mb-1 tracking-widest">Almacén</p>
                <Select value={serialAdjustment.warehouseId} onValueChange={(v) => setSerialAdjustment({ ...serialAdjustment, warehouseId: v })}>
                  <SelectTrigger className="h-10 text-xs font-black uppercase rounded-xl border-border/50 bg-muted/5"><SelectValue placeholder="SELECCIONAR..." /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground/40 mb-1 tracking-widest">IMEI / Serie</p>
                <Input
                  value={serialAdjustment.serialNumber}
                  onChange={(e) => setSerialAdjustment({ ...serialAdjustment, serialNumber: e.target.value })}
                  className="h-10 text-xs font-mono font-black border-border/50 bg-muted/5 rounded-xl uppercase"
                  placeholder="DIGITE SERIE..."
                />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground/40 mb-1 tracking-widest">Motivo (Opcional)</p>
              <Input
                value={serialAdjustment.notes}
                onChange={(e) => setSerialAdjustment({ ...serialAdjustment, notes: e.target.value })}
                className="h-10 text-xs font-bold uppercase border-border/50 bg-muted/5 rounded-xl"
                placeholder="DETALLE DEL AJUSTE..."
              />
            </div>
          </div>
          <DialogFooter className="p-6 pt-0 bg-background flex flex-col sm:flex-row gap-2">
            <Button variant="ghost" className="rounded-xl font-black uppercase text-[10px] tracking-widest flex-1 sm:flex-none" onClick={() => setIsSerialAdjustOpen(false)}>Cancelar</Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-black uppercase text-[10px] tracking-widest h-11 px-8 flex-1 sm:flex-none shadow-lg shadow-primary/20"
              onClick={handleSerialAdjustment}
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Aplicar Ajuste IMEI'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReceptionOpen} onOpenChange={setIsReceptionOpen}>
        <DialogContent className="sm:max-w-2xl rounded-3xl overflow-hidden p-0 border-none shadow-2xl">
          <DialogHeader className="bg-primary p-6 text-primary-foreground relative">
             <div className="absolute top-0 right-0 p-8 opacity-10"><Box className="size-32" /></div>
            <DialogTitle className="font-black uppercase tracking-tighter text-2xl relative z-10">Recepción de Stock</DialogTitle>
            <DialogDescription className="text-white/60 font-bold uppercase text-[10px] tracking-widest relative z-10">
              Registra entrada de mercancía y distribuye por bodega.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-6 bg-background">
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground/40 mb-1 tracking-widest">Producto</p>
                <Select value={newReception.productId} onValueChange={(v) => setNewReception({ ...newReception, productId: v })}>
                  <SelectTrigger className="h-11 text-xs font-black uppercase rounded-xl border-border/50 bg-muted/5"><SelectValue placeholder="SELECCIONAR PRODUCTO..." /></SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground/40 mb-1 tracking-widest">Cant. Total</p>
                <Input
                  type="number"
                  min={1}
                  value={newReception.totalQuantity || ''}
                  onChange={(e) => setNewReception({ ...newReception, totalQuantity: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  className="h-11 text-center text-lg font-black rounded-xl border-border/50 bg-muted/5"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest">Distribución Logística</p>
                <Button variant="ghost" size="sm" className="h-8 text-[9px] font-black uppercase text-primary hover:bg-primary/5 rounded-lg" onClick={addAllocationRow}>
                  <Plus className="size-3 mr-1" /> Agregar Bodega
                </Button>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {allocations.map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_100px_40px] gap-2 items-center">
                    <Select value={item.warehouseId} onValueChange={(v) => updateAllocation(item.id, { warehouseId: v })}>
                      <SelectTrigger className="h-10 text-[10px] font-black uppercase border-border/50 bg-muted/5 rounded-xl"><SelectValue placeholder="BODEGA..." /></SelectTrigger>
                      <SelectContent>
                        {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name.toUpperCase()}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={0}
                      value={item.quantity || ''}
                      onChange={(e) => updateAllocation(item.id, { quantity: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      className="h-10 text-xs font-black text-center border-border/50 bg-muted/5 rounded-xl"
                      placeholder="CANT"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10 text-rose-500 hover:bg-rose-500/10 rounded-xl"
                      onClick={() => removeAllocationRow(item.id)}
                      disabled={allocations.length <= 1}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/5 border border-border/40">
                <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">Estado de distribución</span>
                <span className={cn("text-xs font-black", totalAllocated === Number(newReception.totalQuantity || 0) ? 'text-emerald-500' : 'text-rose-500')}>
                  {totalAllocated} / {Number(newReception.totalQuantity || 0)} ASIGNADOS
                </span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
               <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground/40 mb-1 tracking-widest">Series / IMEI (Uno por línea)</p>
                  <textarea
                    value={newReception.imeiText}
                    onChange={(e) => setNewReception({ ...newReception, imeiText: e.target.value })}
                    className="w-full rounded-xl border border-border/50 bg-muted/5 px-3 py-2 text-xs font-mono font-bold min-h-[100px] focus:ring-1 focus:ring-primary outline-none uppercase"
                    placeholder={'3569380356...\n3569380357...'}
                  />
                  <p className="text-[9px] font-black uppercase text-primary mt-1 tracking-widest">{imeiList.length} SERIES DETECTADAS</p>
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground/40 mb-1 tracking-widest">Referencia / Observación</p>
                  <textarea
                    value={newReception.notes}
                    onChange={(e) => setNewReception({ ...newReception, notes: e.target.value })}
                    className="w-full rounded-xl border border-border/50 bg-muted/5 px-3 py-2 text-xs font-bold min-h-[100px] focus:ring-1 focus:ring-primary outline-none uppercase"
                    placeholder="EJ. FACTURA PROVEEDOR #123..."
                  />
               </div>
            </div>
          </div>

          <DialogFooter className="p-6 pt-0 bg-background">
            <Button variant="ghost" className="rounded-xl font-black uppercase text-[10px] tracking-widest px-8" onClick={() => { setIsReceptionOpen(false); resetReception(); }}>
              Cancelar
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-black uppercase text-[10px] tracking-widest h-11 px-10 shadow-xl shadow-primary/20"
              onClick={handleCreateReception}
              disabled={saving}
            >
              {saving ? 'Procesando...' : 'Confirmar Recepción'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

