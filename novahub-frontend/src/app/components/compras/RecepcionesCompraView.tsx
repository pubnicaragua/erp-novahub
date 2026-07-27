import { useState, useEffect } from 'react';
import { 
  PackageCheck, Plus, Search, Eye, Trash2, CheckCircle2, ChevronLeft
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { purchaseReceiptsService, suppliersService, purchaseOrdersService } from '../../services/compras.service';
import { inventoryService } from '../../services/inventario.service';
import type { PurchaseReceipt, Supplier, PurchaseOrder, Warehouse } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { PurchaseAuditButton } from './PurchaseAuditButton';

interface Props { data: PurchaseReceipt[]; loading: boolean; onRefresh: () => void; }

const statusOpts = [
  { label: 'Pendiente',  value: 'PENDING',  color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Parcial',    value: 'PARTIAL',  color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Recibido',   value: 'RECEIVED', color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Rechazado',  value: 'REJECTED', color: 'bg-rose-500/10 text-rose-500' },
];

export function RecepcionesCompraView({ data, loading, onRefresh }: Props) {
  const { canPerform } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<PurchaseReceipt> | null>(null);

  useEffect(() => {
    suppliersService.getAll().then(res => {
      const list = Array.isArray(res) ? res : (res as any).data || [];
      setSuppliers(list);
    }).catch();
    purchaseOrdersService.getAll().then(res => {
      const list = Array.isArray(res) ? res : (res as any).data || [];
      setOrders(list);
    }).catch();
    inventoryService.getWarehouses().then((res: any) => {
      const list = Array.isArray(res) ? res : (res as any).data || [];
      setWarehouses(list);
    }).catch();
  }, []);

  useEffect(() => {
    if (editingId) {
      if (editingId === 'NEW') {
         setLocalDoc({
           supplierId: '',
           purchaseOrderId: '',
           date: new Date().toISOString(),
           status: 'PENDING' as any,
           items: [],
         });
      } else {
         const found = data.find(x => x.id === editingId);
         setLocalDoc(found ? JSON.parse(JSON.stringify(found)) : null);
      }
    } else {
      setLocalDoc(null);
    }
  }, [editingId, data]);

  const filtered = data.filter(r =>
    (r.number||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.supplier?.name||'').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: ColumnDef<PurchaseReceipt>[] = [
    { key: 'number',    header: 'Recibo #',    width: '120px',
      render: (val) => <span className="font-black font-mono text-primary text-xs">{val}</span> },
    { key: 'supplier',  header: 'Proveedor',   width: '200px',
      render: (_v, row) => <span className="font-bold text-sm">{row.supplier?.name||'-'}</span> },
    { key: 'date',      header: 'Fecha',       width: '110px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'items',     header: 'Total Ítems', width: '100px',
      render: (val) => <span className="text-xs font-black tabular-nums">{Array.isArray(val) ? val.length : 0} art.</span> },
    { key: 'status',    header: 'Estado',      width: '120px', editable: canPerform('PURCHASES_RECEIPTS', 'edit'), type: 'select', options: statusOpts,
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<PurchaseReceipt>) => {
    try {
      const currentReceipt = data.find((x) => x.id === id);
      const previousStatus = String(currentReceipt?.status || '').toUpperCase();
      const requestedStatus = String(updates.status || currentReceipt?.status || '').toUpperCase();
      if (!['RECEIVED', 'PARTIAL'].includes(previousStatus) && ['RECEIVED', 'PARTIAL'].includes(requestedStatus)) {
        const missingWarehouse = (currentReceipt?.items || []).some((item: any) =>
          Number(item?.quantityReceived || 0) > 0 && !String(item?.warehouseId || '').trim(),
        );
        if (missingWarehouse) {
          toast.error('Selecciona la bodega para cada ítem recibido antes de marcar la recepción');
          return;
        }
      }
      const updatedResponse = await (purchaseReceiptsService as any).update(id as string, updates);
      const updatedReceipt = (updatedResponse as any)?.data || updatedResponse;
      const nextStatus = String(updatedReceipt?.status || updates.status || previousStatus).toUpperCase();
      if (!['RECEIVED', 'PARTIAL'].includes(previousStatus) && ['RECEIVED', 'PARTIAL'].includes(nextStatus)) {
        try {
          await ensureInventoryEntriesForReceipt({
            ...(currentReceipt || {}),
            ...(updatedReceipt || {}),
            id: String(id),
            status: nextStatus as any,
          });
        } catch (syncError: any) {
          toast.warning(`Recepción actualizada, pero no se pudo sincronizar inventario: ${syncError?.message || 'Error de sincronización'}`);
        }
      }
      toast.success('Recepción actualizada');
      onRefresh();
    }
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar'); throw new Error('Update failed'); }
  };

  const ensureInventoryEntriesForReceipt = async (receipt: Partial<PurchaseReceipt>) => {
    const nextStatus = String(receipt.status || '').toUpperCase();
    if (!['RECEIVED', 'PARTIAL'].includes(nextStatus)) return;
    if (!receipt.id) return;
    const receiptItems = Array.isArray(receipt.items) ? receipt.items : [];
    if (receiptItems.length === 0) return;

    const movementsResponse = await inventoryService.getMovements({ type: 'IN', limit: 1000 }).catch(() => []);
    const existingMovements = Array.isArray(movementsResponse)
      ? movementsResponse
      : (movementsResponse as any)?.data || [];

    for (const [index, item] of receiptItems.entries()) {
      const quantityReceived = Number((item as any)?.quantityReceived || 0);
      if (quantityReceived <= 0) continue;
      const productId = String((item as any)?.productId || '').trim();
      const warehouseId = String((item as any)?.warehouseId || '').trim();
      if (!productId) continue;
      if (!warehouseId) {
        throw new Error(`Debe seleccionar bodega para el ítem ${index + 1}`);
      }

      const movementReference = `PURCHASE_RECEIPT:${receipt.id}:${(item as any)?.id || productId}:${warehouseId}`;
      const alreadySynced = existingMovements.some((movement: any) => String(movement?.reference || '') === movementReference);
      if (alreadySynced) continue;

      await inventoryService.createMovement({
        productId,
        warehouseId,
        type: 'IN',
        quantity: quantityReceived,
        reference: movementReference,
      } as any);
    }
  };

  const handleSaveDoc = async () => {
    if (!localDoc?.supplierId) return toast.error('Debe seleccionar un proveedor');
    if (!localDoc?.purchaseOrderId) return toast.error('Debe seleccionar una orden de compra');
    const isReceiving = ['RECEIVED', 'PARTIAL'].includes(String(localDoc.status || '').toUpperCase());
    if (isReceiving) {
      const missingWarehouse = (localDoc.items || []).some((item: any) =>
        Number(item?.quantityReceived || 0) > 0 && !String(item?.warehouseId || '').trim(),
      );
      if (missingWarehouse) {
        return toast.error('Debe seleccionar una bodega para cada ítem recibido');
      }
    }
    
    try {
      if (editingId === 'NEW') {
        const createdResponse = await purchaseReceiptsService.create(localDoc as any);
        const createdReceipt = (createdResponse as any)?.data || createdResponse;
        if (['RECEIVED', 'PARTIAL'].includes(String(createdReceipt?.status || localDoc.status || '').toUpperCase())) {
          try {
            await ensureInventoryEntriesForReceipt({
              ...(localDoc || {}),
              ...(createdReceipt || {}),
            });
          } catch (syncError: any) {
            toast.warning(`Recepción creada, pero no se pudo sincronizar inventario: ${syncError?.message || 'Error de sincronización'}`);
          }
        }
        toast.success('Recepción creada');
      } else {
        const currentReceipt = data.find((x) => x.id === editingId);
        const previousStatus = String(currentReceipt?.status || '').toUpperCase();
        const updatedResponse = await (purchaseReceiptsService as any).update(editingId!, localDoc as any);
        const updatedReceipt = (updatedResponse as any)?.data || updatedResponse;
        const nextStatus = String(updatedReceipt?.status || localDoc.status || previousStatus).toUpperCase();
        if (!['RECEIVED', 'PARTIAL'].includes(previousStatus) && ['RECEIVED', 'PARTIAL'].includes(nextStatus)) {
          try {
            await ensureInventoryEntriesForReceipt({
              ...(currentReceipt || {}),
              ...(updatedReceipt || {}),
              id: editingId!,
              status: nextStatus as any,
            });
          } catch (syncError: any) {
            toast.warning(`Recepción guardada, pero no se pudo sincronizar inventario: ${syncError?.message || 'Error de sincronización'}`);
          }
        }
        toast.success('Recepción guardada');
      }
      setEditingId(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al guardar la recepción');
    }
  };

  const handleDeleteItem = (idx: number) => {
    if (!localDoc) return;
    const newItems = [...(localDoc.items || [])];
    newItems.splice(idx, 1);
    setLocalDoc({ ...localDoc, items: newItems as any });
  };

  const handleItemChange = (idx: number, field: string, value: any) => {
    if (!localDoc) return;
    const newItems = [...(localDoc.items || [])];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setLocalDoc({ ...localDoc, items: newItems as any });
  };

  const currentAvailableOrders = orders.filter(o => o.supplierId === localDoc?.supplierId && ['APPROVED'].includes((o.status||'').toUpperCase()));

  if (editingId && localDoc) {
    const isNew = editingId === 'NEW';
    const currentStatus = statusOpts.find(s => s.value === (localDoc.status||'').toUpperCase());
    
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setEditingId(null)} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isNew ? 'Nueva Recepción' : `Recepción ${localDoc.number||''}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Inventario ingresado</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {!isNew && canPerform('PURCHASES_RECEIPTS', 'delete') && (
                <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => setPendingDeleteId(editingId)}>
                  <Trash2 className="size-3 mr-2" /> Eliminar
                </Button>
             )}
            {((isNew && canPerform('PURCHASES_RECEIPTS', 'create')) || (!isNew && canPerform('PURCHASES_RECEIPTS', 'edit'))) && (
              <Button onClick={handleSaveDoc} className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6">
                Guardar
              </Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50 col-span-2">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Proveedor</p>
                  <Combobox 
                    disabled={isNew ? !canPerform('PURCHASES_RECEIPTS', 'create') : !canPerform('PURCHASES_RECEIPTS', 'edit')}
                    options={suppliers
                      .filter(s => (s.status || '').toUpperCase() === 'ACTIVE' || s.id === localDoc.supplierId)
                      .map(s => ({ label: s.name, value: s.id, description: (s.code ? `[${s.code}] ` : '') + (s.phone || 'Sin teléfono') }))}
                    value={localDoc.supplierId || ''}
                    onChange={(val) => setLocalDoc({ ...localDoc, supplierId: val, purchaseOrderId: '' })}
                    placeholder="Seleccionar Proveedor"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Orden de Compra</p>
                  <Combobox 
                    disabled={isNew ? !canPerform('PURCHASES_RECEIPTS', 'create') : !canPerform('PURCHASES_RECEIPTS', 'edit')}
                    options={currentAvailableOrders.map(c => ({ label: `${c.number} (Total: ${c.total})`, value: c.id }))}
                    value={localDoc.purchaseOrderId || ''}
                    onChange={(val) => {
                       const ord = currentAvailableOrders.find(x => x.id === val);
                       const newItems = ord?.items?.map(it => ({
                          description: (it as any).description,
                          quantityOrdered: (it as any).quantity,
                          quantityReceived: (it as any).quantity,
                          productId: (it as any).productId,
                          warehouseId: warehouses.find((w) => (w as any)?.isMain)?.id || '',
                        })) || [];
                        setLocalDoc({ ...localDoc, purchaseOrderId: val, items: newItems as any });
                     }}
                    placeholder={localDoc.supplierId ? "Seleccionar Orden" : "Seleccione un proveedor primero"}
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha Recepción</p>
                  <Input 
                    disabled={isNew ? !canPerform('PURCHASES_RECEIPTS', 'create') : !canPerform('PURCHASES_RECEIPTS', 'edit')}
                    type="date" 
                    value={localDoc.date ? new Date(localDoc.date).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, date: new Date(e.target.value).toISOString() })} 
                    className="h-8 text-xs" 
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                  <select 
                    disabled={isNew ? !canPerform('PURCHASES_RECEIPTS', 'create') : !canPerform('PURCHASES_RECEIPTS', 'edit')}
                    value={localDoc.status || 'PENDING'} 
                    onChange={(e) => setLocalDoc({ ...localDoc, status: e.target.value as any })}
                    className={cn("h-8 w-full rounded-md border border-input px-2 text-xs font-bold uppercase", currentStatus?.color || 'bg-background')}
                  >
                    {statusOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Productos Recibidos</p>
              {((isNew && canPerform('PURCHASES_RECEIPTS', 'create')) || (!isNew && canPerform('PURCHASES_RECEIPTS', 'edit'))) && (
                <Button variant="outline" size="sm" onClick={() => {
                  const newItems = [...(localDoc.items || []), { id: `new-${Date.now()}`, description: '', quantityOrdered: 0, quantityReceived: 1 }];
                  setLocalDoc({ ...localDoc, items: newItems as any });
                }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl">
                  <Plus className="size-3 mr-2" /> Agregar Item
                </Button>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                <div className="col-span-4">Descripción del Producto</div>
                <div className="col-span-2 text-right">Cant. Ordenada</div>
                <div className="col-span-2 text-right">Cant. Recibida</div>
                <div className="col-span-3">Bodega</div>
                <div className="col-span-1 text-right"></div>
              </div>
              {(localDoc.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <Input 
                      disabled={isNew ? !canPerform('PURCHASES_RECEIPTS', 'create') : !canPerform('PURCHASES_RECEIPTS', 'edit')}
                      value={item.description || ''} 
                      onChange={(e) => handleItemChange(idx, 'description', e.target.value)} 
                      className="h-8 text-xs font-bold text-primary" 
                      placeholder="Ej. Llantas Michelin" 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      disabled={isNew ? !canPerform('PURCHASES_RECEIPTS', 'create') : !canPerform('PURCHASES_RECEIPTS', 'edit')}
                      type="number" 
                      min="0" 
                      value={item.quantityOrdered === 0 ? '' : item.quantityOrdered} 
                      onChange={(e) => handleItemChange(idx, 'quantityOrdered', e.target.value)} 
                      className="h-8 text-xs text-right bg-muted/20" 
                      placeholder="0" 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      disabled={isNew ? !canPerform('PURCHASES_RECEIPTS', 'create') : !canPerform('PURCHASES_RECEIPTS', 'edit')}
                      type="number" 
                      min="0" 
                      value={item.quantityReceived === 0 ? '' : item.quantityReceived} 
                      onChange={(e) => handleItemChange(idx, 'quantityReceived', e.target.value)} 
                      className="h-8 text-xs text-right font-bold text-emerald-500 border-emerald-500/50" 
                      placeholder="0" 
                    />
                  </div>
                  <div className="col-span-3">
                    <Combobox
                      disabled={isNew ? !canPerform('PURCHASES_RECEIPTS', 'create') : !canPerform('PURCHASES_RECEIPTS', 'edit')}
                      options={warehouses
                        .filter((w) => (w as any)?.isActive !== false)
                        .map((w) => ({
                          label: w.name,
                          value: w.id,
                          description: w.code ? `[${w.code}] ${w.location || ''}` : (w.location || ''),
                        }))}
                      value={item.warehouseId || ''}
                      onChange={(val) => handleItemChange(idx, 'warehouseId', val)}
                      placeholder="Seleccionar bodega"
                    />
                  </div>
                  <div className="col-span-1 flex items-center justify-end gap-2">
                    {((isNew && canPerform('PURCHASES_RECEIPTS', 'create')) || (!isNew && canPerform('PURCHASES_RECEIPTS', 'edit'))) && (
                      <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 rounded-md" onClick={() => handleDeleteItem(idx)}>
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {(!localDoc.items || localDoc.items.length === 0) && (
                <div className="text-center py-6 text-xs text-muted-foreground/50 italic border border-dashed border-border/50 rounded-xl bg-muted/10">
                  No hay ítems registrados.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const kpis = [
    { title: 'Recepciones',   value: data.length,                                                                                  icon: PackageCheck, color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Ítems Recibidos', value: data.reduce((acc, r) => acc + (r.items?.reduce((a,i:any) => a + Number(i.quantityReceived||0),0)||0), 0), icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <Card key={i} className="bg-card border-border/50 rounded-2xl shadow-sm">
            <CardContent className="p-5"><div className="flex items-center gap-4">
              <div className={cn('p-3 rounded-xl', k.bg, k.color)}><k.icon className="size-5" /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{k.title}</p><p className="text-2xl font-black tabular-nums">{k.value}</p></div>
            </div></CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight">Recepciones</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Inventario entregado por proveedores</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            {canPerform('PURCHASES_RECEIPTS', 'create') && (
              <Button onClick={() => setEditingId('NEW')} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nueva Recepción</Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading}
          onBulkDelete={canPerform('PURCHASES_RECEIPTS', 'delete') ? async (ids) => {
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await purchaseReceiptsService.delete(id as string);
              }
              toast.success('Elementos eliminados');
              onRefresh();
            } catch (e: any) {
              toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar');
            }
          } : undefined}
          actions={(row) => (
            <div className="flex gap-1">
              <Button title={canPerform('PURCHASES_RECEIPTS', 'edit') ? "Editar" : "Ver"} variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
              <PurchaseAuditButton entity="PURCHASE_RECEIPT" entityId={row.id} title="Auditoria de la Recepcion" />
              {canPerform('PURCHASES_RECEIPTS', 'delete') && (
                <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
              )}
            </div>
          )}
        />
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
        title={"¿Eliminar recepción?"}
        description="¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={async () => {
          if (!pendingDeleteId) return;
          try {
            setDeleteLoading(true);
            await purchaseReceiptsService.delete(pendingDeleteId);
            toast.success('Registro eliminado');
            onRefresh();
          } catch (error: any) {
            toast.error(error?.message || 'Error al eliminar');
          } finally {
            setDeleteLoading(false);
            setPendingDeleteId(null);
          }
        }}
      />
    </div>
  );
}

