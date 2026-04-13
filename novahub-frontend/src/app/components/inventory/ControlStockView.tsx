import React, { useMemo, useState } from 'react';
import { Scale, Plus, Check, X, CheckCircle, Receipt, Trash2 } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { inventoryService } from '../../services/inventario.service';

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
      case 'APPROVED': return 'bg-green-500/10 text-green-600';
      case 'DRAFT': return 'bg-orange-500/10 text-orange-600';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="p-4 border bg-card rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Ajustes de Inventario</h3>
          <p className="text-sm text-muted-foreground">{adjustments.length} ajustes registrados</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl font-black text-[10px] uppercase tracking-widest h-10 px-4"
            onClick={() => setIsSerialAdjustOpen(true)}
          >
            IMEI / Series
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl font-black text-[10px] uppercase tracking-widest h-10 px-4"
            onClick={() => setIsReceptionOpen(true)}
          >
            <Receipt className="size-4 mr-2" />
            Registrar Recepción
          </Button>
          <Button 
            size="sm" 
            className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all gap-2 font-black text-xs uppercase tracking-widest h-10 px-6"
            onClick={() => setIsCreating(true)}
            disabled={isCreating}
          >
            <Plus className="size-4" />
            Nuevo Ajuste
          </Button>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 border-b border-border/50">
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-28">Número</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Almacén</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest">Razón</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-center w-20">Items</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-28">Fecha</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest w-28">Estado</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest text-right w-24">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isCreating && (
              <TableRow className="bg-blue-500/5">
                <TableCell className="text-xs text-muted-foreground">Auto</TableCell>
                <TableCell>
                  <Select value={newAdjustment.warehouseId} onValueChange={(v) => setNewAdjustment({ ...newAdjustment, warehouseId: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Almacén" /></SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={newAdjustment.reason} onValueChange={(v) => setNewAdjustment({ ...newAdjustment, reason: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REASON_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={newAdjustment.productId} onValueChange={(v) => setNewAdjustment({ ...newAdjustment, productId: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Producto" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Input 
                      type="number" 
                      placeholder="Actual"
                      value={newAdjustment.actualStock} 
                      onChange={(e) => setNewAdjustment({ ...newAdjustment, actualStock: parseInt(e.target.value, 10) || 0 })}
                      className="h-8 text-xs w-16"
                    />
                  </div>
                </TableCell>
                <TableCell className="text-xs">Borrador</TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" className="size-7 text-green-600" onClick={handleCreateAdjustment} disabled={saving}>
                      {saving ? <div className="size-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Check className="size-4" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7 text-red-600" onClick={() => setIsCreating(false)} disabled={saving}>
                      <X className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            
            {adjustments.length === 0 && !isCreating ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <Scale className="size-10 mx-auto mb-2 opacity-20" />
                  <p className="font-medium">No hay ajustes</p>
                </TableCell>
              </TableRow>
            ) : (
              adjustments.map((adj: any) => {
                const isApproving = approvingId === adj.id;
                return (
                  <TableRow key={adj.id} className="group hover:bg-muted/30">
                    <TableCell className="font-mono text-xs">{adj.number}</TableCell>
                    <TableCell className="text-sm">{adj.warehouse?.name || '-'}</TableCell>
                    <TableCell className="text-xs">{REASON_OPTIONS.find((r) => r.value === adj.reason)?.label || adj.reason}</TableCell>
                    <TableCell className="text-center font-medium">{adj.items?.length || 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(adj.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${getStatusBadge(adj.status)}`}>
                        {adj.status === 'APPROVED' ? 'Aprobado' : 'Borrador'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {adj.status === 'DRAFT' && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 text-xs text-green-600 hover:bg-green-500/10 gap-1"
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

      <div className="mt-3 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
        Los ajustes en borrador deben ser aprobados para aplicar cambios al stock
      </div>

      <Dialog open={isSerialAdjustOpen} onOpenChange={setIsSerialAdjustOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Ajustar IMEI / Series</DialogTitle>
            <DialogDescription>
              Alta o baja puntual de IMEI con movimiento auditado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Acción</p>
                <Select value={serialAdjustment.action} onValueChange={(v) => setSerialAdjustment({ ...serialAdjustment, action: v })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADD">Agregar</SelectItem>
                    <SelectItem value="REMOVE">Remover</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <p className="text-[10px] text-muted-foreground mb-1">Producto</p>
                <Select value={serialAdjustment.productId} onValueChange={(v) => setSerialAdjustment({ ...serialAdjustment, productId: v })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Seleccionar producto" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Almacén</p>
                <Select value={serialAdjustment.warehouseId} onValueChange={(v) => setSerialAdjustment({ ...serialAdjustment, warehouseId: v })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Seleccionar almacén" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">IMEI / Serie</p>
                <Input
                  value={serialAdjustment.serialNumber}
                  onChange={(e) => setSerialAdjustment({ ...serialAdjustment, serialNumber: e.target.value })}
                  className="h-9 text-xs font-mono"
                  placeholder="Ej. 356938035643809"
                />
              </div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Nota (opcional)</p>
              <Input
                value={serialAdjustment.notes}
                onChange={(e) => setSerialAdjustment({ ...serialAdjustment, notes: e.target.value })}
                className="h-9 text-xs"
                placeholder="Motivo del ajuste"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSerialAdjustOpen(false)}>Cancelar</Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleSerialAdjustment}
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar ajuste'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isReceptionOpen} onOpenChange={setIsReceptionOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar Recepción de Stock</DialogTitle>
            <DialogDescription>
              Registra entrada por producto, distribuye unidades por bodega y agrega IMEI/series.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Producto</p>
                <Select value={newReception.productId} onValueChange={(v) => setNewReception({ ...newReception, productId: v })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Seleccionar producto" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Cantidad total recibida</p>
                <Input
                  type="number"
                  min={1}
                  value={newReception.totalQuantity || ''}
                  onChange={(e) => setNewReception({ ...newReception, totalQuantity: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  className="h-9 text-xs"
                  placeholder="Ej. 40"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">Distribución por bodega/sucursal</p>
                <Button variant="outline" size="sm" className="h-8 text-[10px] uppercase tracking-widest" onClick={addAllocationRow}>
                  <Plus className="size-3 mr-1" /> Agregar fila
                </Button>
              </div>
              {allocations.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_120px_36px] gap-2 items-center">
                  <Select value={item.warehouseId} onValueChange={(v) => updateAllocation(item.id, { warehouseId: v })}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Bodega/Sucursal" /></SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    value={item.quantity || ''}
                    onChange={(e) => updateAllocation(item.id, { quantity: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    className="h-9 text-xs text-right"
                    placeholder="Cantidad"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-rose-500 hover:bg-rose-500 hover:text-white"
                    onClick={() => removeAllocationRow(item.id)}
                    disabled={allocations.length <= 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total distribuido</span>
                <span className={totalAllocated === Number(newReception.totalQuantity || 0) ? 'font-black text-emerald-500' : 'font-black text-rose-500'}>
                  {totalAllocated} / {Number(newReception.totalQuantity || 0)}
                </span>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-muted-foreground mb-1">IMEI / Series (uno por línea, opcional)</p>
              <textarea
                value={newReception.imeiText}
                onChange={(e) => setNewReception({ ...newReception, imeiText: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs min-h-[120px]"
                placeholder={'Ejemplo:\n356938035643809\n356938035643810\n356938035643811'}
              />
              <p className="text-[10px] text-muted-foreground mt-1">{imeiList.length} IMEI/series capturados</p>
            </div>

            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Referencia / Nota (opcional)</p>
              <Input
                value={newReception.notes}
                onChange={(e) => setNewReception({ ...newReception, notes: e.target.value })}
                className="h-9 text-xs"
                placeholder="Ej. Recepción OC-2026-001 / Lote abril"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsReceptionOpen(false); resetReception(); }}>
              Cancelar
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleCreateReception}
              disabled={saving}
            >
              {saving ? 'Guardando...' : 'Guardar recepción'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

