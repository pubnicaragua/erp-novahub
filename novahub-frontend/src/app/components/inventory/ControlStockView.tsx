import React, { useState } from 'react';
import { Scale, Plus, Check, X, CheckCircle } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { inventoryService } from '../../services/inventario.service';

interface ControlStockViewProps {
  adjustments: any[];
  warehouses: any[];
  products: any[];
  onRefresh: () => void;
}

const REASON_OPTIONS = [
  { value: 'DISCREPANCY', label: 'Discrepancia' },
  { value: 'DAMAGE', label: 'Daño' },
  { value: 'THEFT', label: 'Robo' },
  { value: 'EXPIRATION', label: 'Vencimiento' },
  { value: 'OTHER', label: 'Otro' },
];

export function ControlStockView({ adjustments, warehouses, products, onRefresh }: ControlStockViewProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newAdjustment, setNewAdjustment] = useState({ warehouseId: '', reason: 'DISCREPANCY', productId: '', currentStock: 0, actualStock: 0 });
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

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
        }]
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
                  <Select value={newAdjustment.warehouseId} onValueChange={(v) => setNewAdjustment({...newAdjustment, warehouseId: v})}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Almacén" /></SelectTrigger>
                    <SelectContent>
                      {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={newAdjustment.reason} onValueChange={(v) => setNewAdjustment({...newAdjustment, reason: v})}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REASON_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={newAdjustment.productId} onValueChange={(v) => setNewAdjustment({...newAdjustment, productId: v})}>
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
                      onChange={(e) => setNewAdjustment({...newAdjustment, actualStock: parseInt(e.target.value) || 0})}
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
                    <TableCell className="text-xs">{REASON_OPTIONS.find(r => r.value === adj.reason)?.label || adj.reason}</TableCell>
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
    </Card>
  );
}
