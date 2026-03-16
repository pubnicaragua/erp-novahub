import React, { useState } from 'react';
import { Truck, ArrowRight, Search, Plus, Check, X, Package } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { inventoryService } from '../../services/inventario.service';

interface TransferenciasViewProps {
  transfers: any[];
  warehouses: any[];
  products: any[];
  onRefresh: () => void;
}

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pendiente', color: 'bg-orange-500/10 text-orange-600' },
  { value: 'IN_TRANSIT', label: 'En Tránsito', color: 'bg-blue-500/10 text-blue-600' },
  { value: 'COMPLETED', label: 'Completada', color: 'bg-green-500/10 text-green-600' },
  { value: 'CANCELLED', label: 'Cancelada', color: 'bg-red-500/10 text-red-600' },
];

export function TransferenciasView({ transfers, warehouses, products, onRefresh }: TransferenciasViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newTransfer, setNewTransfer] = useState({ 
    fromId: '', 
    toId: '', 
    productId: '', 
    quantity: 1,
    date: new Date().toISOString().split('T')[0]
  });
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
    const variantSku = `SKU-${product?.code}`;
    
    setSaving(true);
    try {
      await inventoryService.createTransfer({
        fromId: newTransfer.fromId,
        toId: newTransfer.toId,
        items: [{ variantId: variantSku, quantity: newTransfer.quantity }]
      });
      toast.success('Transferencia creada');
      setIsCreating(false);
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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por guía o almacén..." 
              className="pl-9 h-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <Button 
          size="sm" 
          className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all gap-2 font-black text-xs uppercase tracking-widest h-10 px-6"
          onClick={() => setIsCreating(true)}
          disabled={isCreating}
        >
          <Plus className="size-4" />
          Nueva Transferencia
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
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
                  <Select value={newTransfer.fromId} onValueChange={(v) => setNewTransfer({...newTransfer, fromId: v})}>
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
                    <Select value={newTransfer.productId} onValueChange={(v) => setNewTransfer({...newTransfer, productId: v})}>
                      <SelectTrigger className="h-8 text-xs w-28"><SelectValue placeholder="Prod" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.code}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input 
                      type="number" 
                      value={newTransfer.quantity} 
                      onChange={(e) => setNewTransfer({...newTransfer, quantity: parseInt(e.target.value) || 1})}
                      className="h-8 text-xs w-16"
                      min={1}
                    />
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
                        disabled={isUpdating || trf.status === 'COMPLETED' || trf.status === 'CANCELLED'}
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
        {filteredTransfers.length} transferencias
      </div>
    </Card>
  );
}
