import { useState, useEffect } from 'react';
import { 
  PackageCheck, Plus, Search, Eye, Trash2, CheckCircle2, ChevronLeft, FileInput,
  AlertTriangle, XCircle, ArrowDown
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { purchaseReceiptsService } from '../../services/compras.service';
import { useCurrency } from '../../contexts/CurrencyContext';
import { inventoryService } from '../../services/inventario.service';
import type { PurchaseReceipt, Supplier, PurchaseOrder, Warehouse } from '../../types';
import type { SalesPaginationControls } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { TaxTypeSelect } from '../ui/TaxSelector';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { PurchaseAuditButton } from './PurchaseAuditButton';
import { PurchaseKpiCard } from './PurchaseKpiCard';
import { PurchaseViewTutorial } from './PurchaseViewTutorial';

interface Props { data: PurchaseReceipt[]; loading: boolean; onRefresh: () => void; supplierCatalog?: Supplier[]; accountCatalog?: any[]; warehouseCatalog?: Warehouse[]; orderCatalog?: PurchaseOrder[]; onConvertToInvoice?: (draft: any) => void; pagination?: SalesPaginationControls; onSearchChange?: (value: string) => void; }

const statusOpts = [
  { label: 'Pendiente',     value: 'PENDING',        color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Recibido',      value: 'RECEIVED',       color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Parcial',       value: 'PARTIAL',        color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Con Incidencias', value: 'WITH_INCIDENTS', color: 'bg-orange-500/10 text-orange-500' },
  { label: 'Rechazado',     value: 'REJECTED',       color: 'bg-rose-500/10 text-rose-500' },
];

const incidenciaIcons: Record<string, any> = {
  faltante: ArrowDown,
  rechazado: XCircle,
  incidencia: AlertTriangle,
};

export function RecepcionesCompraView({ data, loading, onRefresh, supplierCatalog = [], accountCatalog = [], warehouseCatalog = [], orderCatalog = [], onConvertToInvoice, pagination, onSearchChange }: Props) {
  const { canPerform, user } = useAuth();
  const { exchangeRate: globalRate, displayCurrency } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'RECEIVED' | 'WITH_INCIDENTS'>('ALL');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<PurchaseReceipt> | null>(null);

  useEffect(() => {
    setSuppliers(supplierCatalog);
    setOrders(orderCatalog);
    setWarehouses(warehouseCatalog);
    setAccounts(accountCatalog);
  }, [supplierCatalog, orderCatalog, warehouseCatalog, accountCatalog]);

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

  const filtered = data.filter(r => {
    const status = String(r.status || '').toUpperCase();
    if (statusFilter !== 'ALL' && status !== statusFilter) return false;
    return (r.number||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.supplier?.name||'').toLowerCase().includes(searchTerm.toLowerCase());
  });

  const columns: ColumnDef<PurchaseReceipt>[] = [
    { key: 'number',    header: 'Recibo #',    width: '120px',
      render: (val) => <span className="font-black font-mono text-primary text-xs">{val}</span> },
    { key: 'supplier',  header: 'Proveedor',   width: '200px',
      render: (_v, row) => <span className="font-bold text-sm">{row.supplier?.name||'-'}</span> },
    { key: 'date',      header: 'Fecha',       width: '110px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'items',     header: 'Ítems',       width: '140px',
      render: (_v, row) => {
        const items = row.items || [];
        const total = items.length;
        const faltantes = items.filter(i => Number(i.quantityReceived) < Number(i.quantityOrdered));
        const rechazados = items.filter(i => Number(i.quantityRejected||0) > 0);
        return <div className="flex items-center gap-2">
          <span className="text-xs font-black tabular-nums">{total} art.</span>
          {faltantes.length > 0 && <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">{faltantes.length} falt.</span>}
          {rechazados.length > 0 && <span className="text-[9px] font-black text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded-full">{rechazados.length} recha.</span>}
        </div>;
      } },
    { key: 'status',    header: 'Estado',      width: '130px', editable: false, type: 'select', options: statusOpts,
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
      const updatedResponse = await purchaseReceiptsService.update(id as string, updates);
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
        const updatedResponse = await purchaseReceiptsService.update(editingId!, localDoc as any);
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
    const autoStatus = calcStatus(newItems);
    setLocalDoc({ ...localDoc, items: newItems as any, status: autoStatus as any });
  };

  const calcStatus = (items: any[]) => {
    if (!items || items.length === 0) return 'PENDING';
    const hasRejected = items.some(it => Number(it.quantityRejected||0) > 0);
    const allReceived = items.every(it => Number(it.quantityReceived||0) >= Number(it.quantityOrdered||0));
    const anyReceived = items.some(it => Number(it.quantityReceived||0) > 0);
    if (hasRejected) return 'WITH_INCIDENTS';
    if (allReceived) return 'RECEIVED';
    if (anyReceived) return 'PARTIAL';
    return 'PENDING';
  };

  const handleItemChange = (idx: number, field: string, value: any) => {
    if (!localDoc) return;
    const newItems = [...(localDoc.items || [])];
    newItems[idx] = { ...newItems[idx], [field]: value };
    const autoStatus = calcStatus(newItems);
    setLocalDoc({ ...localDoc, items: newItems as any, status: autoStatus as any });
  };

  const currentAvailableOrders = orders.filter(o => o.supplierId === localDoc?.supplierId && ['APPROVED'].includes((o.status||'').toUpperCase()));

  if (editingId && localDoc) {
    const isNew = editingId === 'NEW';
    const currentStatus = statusOpts.find(s => s.value === (localDoc.status||'PENDING').toUpperCase());
    
    return (
      <div className="min-w-0 max-w-full space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setEditingId(null)} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black uppercase tracking-tight">{isNew ? 'Nueva Recepción' : `Recepción ${localDoc.number||''}`}</h2>
                <Badge variant="outline" className={cn('text-[8px] font-black uppercase px-1.5 py-0 border-none', currentStatus?.color||'bg-muted/20 text-muted-foreground')}>{currentStatus?.label||'Pendiente'}</Badge>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Inventario ingresado</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isNew && String(localDoc.status || '').toUpperCase() === 'RECEIVED' && onConvertToInvoice && (
              <Button variant="outline" className="rounded-xl border-primary/50 text-primary hover:bg-primary/10 font-black uppercase text-[10px] tracking-widest px-4"
                onClick={() => {
                  const draft = {
                    supplierId: localDoc.supplierId,
                    purchaseOrderId: localDoc.purchaseOrderId,
                    purchaseReceiptId: localDoc.id,
                    date: new Date().toISOString(),
                    dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
                    currency: 'NIO',
                    exchangeRate: 1,
                    status: 'PENDING',
                    items: (localDoc.items || []).map((it: any) => ({
                      description: it.description || '',
                      quantity: Number(it.quantityReceived || 0),
                      unitPrice: Number(it.unitPrice || 0),
                      productId: it.productId || null,
                      taxType: it.taxType || 'GRAVADO',
                      taxRate: it.taxType === 'EXENTO' || it.taxType === 'NO_GRAVADO' ? 0 : Number(it.taxRate || 15),
                      taxBase: it.taxType === 'EXENTO' || it.taxType === 'NO_GRAVADO' ? 0 : Number(it.taxBase || 0),
                      taxAmount: Number(it.taxAmount || 0),
                      withholdingType: it.withholdingType || 'NONE',
                      withholdingRate: Number(it.withholdingRate || 0),
                      withholdingBase: it.withholdingType === 'NONE' ? 0 : Number(it.withholdingBase || 0),
                      accountId: it.accountId || null,
                      total: Number((it.unitPrice||0) * (it.quantityReceived||0)),
                    })),
                    subtotal: (localDoc.items || []).reduce((a: number, it: any) => a + Number((it.unitPrice||0) * (it.quantityReceived||0)), 0),
                    taxAmount: 0,
                    withholdingTotal: 0,
                    withholdingBase: 0,
                    total: (localDoc.items || []).reduce((a: number, it: any) => a + Number((it.unitPrice||0) * (it.quantityReceived||0)), 0),
                  };
                  onConvertToInvoice(draft);
                  toast.success('Abriendo formulario de factura...', { position: 'bottom-right' });
                }}
              >
                <FileInput className="size-3 mr-2" /> Convertir a Factura
              </Button>
            )}
            {isNew && canPerform('PURCHASES_RECEIPTS', 'create') && (
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
                          unitPrice: (it as any).unitPrice || 0,
                          taxType: (it as any).taxType || 'GRAVADO',
                          taxRate: (it as any).taxRate || 15,
                          withholdingType: (it as any).withholdingType || 'NONE',
                          withholdingRate: (it as any).withholdingRate || 0,
                          accountId: (it as any).accountId || '',
                          costCenterId: (it as any).costCenterId || null,
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

        {(localDoc.items || []).some((it: any) => {
          const qOrd = Number(it.quantityOrdered||0);
          const qRec = Number(it.quantityReceived||0);
          const qRej = Number(it.quantityRejected||0);
          return qRec < qOrd || qRej > 0;
        }) && (
          <Card className="rounded-2xl border-orange-500/30 bg-orange-500/5">
            <CardContent className="p-4 flex items-center gap-4 flex-wrap">
              <AlertTriangle className="size-5 text-orange-500 shrink-0" />
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">Incidencias detectadas</p>
              {(localDoc.items || []).map((it: any, i: number) => {
                const qOrd = Number(it.quantityOrdered||0);
                const qRec = Number(it.quantityReceived||0);
                const qRej = Number(it.quantityRejected||0);
                const falt = Math.max(0, qOrd - qRec);
                return <div key={i} className="text-[9px] font-bold text-muted-foreground">
                  {it.description || `Ítem ${i+1}`}: {falt > 0 && <span className="text-amber-500">{falt} faltante(s) </span>}
                  {qRej > 0 && <span className="text-rose-500">{qRej} rechazado(s)</span>}
                  {(falt <= 0 && qRej <= 0) && <span className="text-emerald-500">Completo</span>}
                  {i < (localDoc.items||[]).length - 1 && <span className="mx-1.5 text-muted-foreground/30">|</span>}
                </div>;
              })}
            </CardContent>
          </Card>
        )}

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Productos Recibidos</p>
              {((isNew && canPerform('PURCHASES_RECEIPTS', 'create')) || (!isNew && canPerform('PURCHASES_RECEIPTS', 'edit'))) && (
                <Button variant="outline" size="sm" onClick={() => {
                  const newItems = [...(localDoc.items || []), { id: `new-${Date.now()}`, description: '', quantityOrdered: 0, quantityReceived: 1, unitPrice: 0, taxType: 'GRAVADO', taxRate: 15, withholdingType: 'NONE', accountId: '' }];
                  setLocalDoc({ ...localDoc, items: newItems as any });
                }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl">
                  <Plus className="size-3 mr-2" /> Agregar Item
                </Button>
              )}
            </div>
            
            <div className="space-y-3">
              {(localDoc.items || []).map((item: any, idx: number) => {
                const qOrdered = Number(item.quantityOrdered || 0);
                const qReceived = Number(item.quantityReceived || 0);
                const qRejected = Number(item.quantityRejected || 0);
                const faltante = qReceived < qOrdered && qReceived >= 0;
                const rechazado = qRejected > 0;
                return (
                <div key={item.id || idx} className={cn('group relative rounded-2xl border p-4 space-y-3 transition-all duration-200', (faltante || rechazado) ? 'border-orange-500/30 bg-orange-500/5 hover:border-orange-500/50' : 'border-border/40 bg-background/60 backdrop-blur-sm hover:border-primary/30 hover:shadow-md')}>
                  {((faltante || rechazado) && !isNew) && (
                    <div className="flex items-center gap-1.5 mb-2">
                      {faltante && <Badge variant="outline" className="text-[8px] font-black uppercase px-1.5 py-0 border-none bg-amber-500/10 text-amber-500"><ArrowDown className="size-2.5 mr-1" /> Faltante: {qOrdered - qReceived} uds.</Badge>}
                      {rechazado && <Badge variant="outline" className="text-[8px] font-black uppercase px-1.5 py-0 border-none bg-rose-500/10 text-rose-500"><XCircle className="size-2.5 mr-1" /> Rechazado: {qRejected} uds.</Badge>}
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1.5">Descripción del Producto</p>
                      <Input 
                        disabled={isNew ? !canPerform('PURCHASES_RECEIPTS', 'create') : !canPerform('PURCHASES_RECEIPTS', 'edit')}
                        value={item.description || ''} 
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)} 
                        className="h-8 text-xs font-bold" 
                        placeholder="Ej. Llantas Michelin" 
                      />
                    </div>
                    {((isNew && canPerform('PURCHASES_RECEIPTS', 'create')) || (!isNew && canPerform('PURCHASES_RECEIPTS', 'edit'))) && (
                      <Button variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground/40 hover:bg-rose-500/10 hover:text-rose-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all" onClick={() => handleDeleteItem(idx)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="purchase-item-fields grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Cant. Ordenada</p>
                      <Input 
                        disabled={isNew ? !canPerform('PURCHASES_RECEIPTS', 'create') : !canPerform('PURCHASES_RECEIPTS', 'edit')}
                        type="number" min="0" 
                        value={item.quantityOrdered === 0 ? '' : item.quantityOrdered} 
                        onChange={(e) => handleItemChange(idx, 'quantityOrdered', e.target.value)} 
                        className="h-8 text-xs text-right bg-muted/20" placeholder="0" 
                      />
                    </div>
                    <div className="col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Cant. Recibida</p>
                      <Input 
                        disabled={isNew ? !canPerform('PURCHASES_RECEIPTS', 'create') : !canPerform('PURCHASES_RECEIPTS', 'edit')}
                        type="number" min="0" 
                        value={item.quantityReceived === 0 ? '' : item.quantityReceived} 
                        onChange={(e) => handleItemChange(idx, 'quantityReceived', e.target.value)} 
                        className={cn('h-8 text-xs text-right font-bold', faltante ? 'text-amber-500 border-amber-500/50' : 'text-emerald-500 border-emerald-500/50')} placeholder="0" 
                      />
                    </div>
                    <div className="col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Cant. Rechazada</p>
                      <Input 
                        disabled={isNew ? !canPerform('PURCHASES_RECEIPTS', 'create') : !canPerform('PURCHASES_RECEIPTS', 'edit')}
                        type="number" min="0" 
                        value={item.quantityRejected === 0 ? '' : item.quantityRejected} 
                        onChange={(e) => handleItemChange(idx, 'quantityRejected', e.target.value)} 
                        className={cn('h-8 text-xs text-right font-bold', rechazado ? 'text-rose-500 border-rose-500/50' : '')} placeholder="0" 
                      />
                    </div>
                    <div className="col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Precio U.</p>
                      <Input 
                        disabled={isNew ? !canPerform('PURCHASES_RECEIPTS', 'create') : !canPerform('PURCHASES_RECEIPTS', 'edit')}
                        type="number" min="0" 
                        value={item.unitPrice === 0 ? '' : item.unitPrice} 
                        onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)} 
                        className="h-8 text-xs text-right" placeholder="0" 
                      />
                    </div>
                    <div className="col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Tipo IVA</p>
                      <TaxTypeSelect
                        type="TAX"
                        value={item.taxType || ''}
                        onChange={(v) => {
                          handleItemChange(idx, 'taxType', v)
                          if (v === 'GRAVADO_15' || v === 'GRAVADO') { handleItemChange(idx, 'taxRate', 15) }
                          else { handleItemChange(idx, 'taxRate', 0) }
                        }}
                      />
                    </div>
                    <div className="col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">Bodega</p>
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
                        placeholder="Bodega"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1 mr-auto">Cuenta Contable</p>
                    <select
                      disabled={isNew ? !canPerform('PURCHASES_RECEIPTS', 'create') : !canPerform('PURCHASES_RECEIPTS', 'edit')}
                      value={item.accountId || ''}
                      onChange={(e) => handleItemChange(idx, 'accountId', e.target.value)}
                      className="h-7 rounded-md border border-input bg-background px-1 text-[10px] font-bold max-w-[250px]"
                    >
                      <option value="">Seleccionar...</option>
                      {accounts
                        .filter((a: any) => (a.isActive ?? true) !== false)
                        .map((a: any) => (
                          <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                        ))}
                    </select>
                    <div className="flex items-center gap-2 ml-2">
                      <TaxTypeSelect
                        type="WITHHOLDING"
                        value={item.withholdingType || 'NONE'}
                        onChange={(v) => {
                          handleItemChange(idx, 'withholdingType', v)
                          if (v !== 'NONE') {
                            const rates: Record<string, number> = { IR_1:1, IR_2:2, IR_5:5, IR_10:10, IR_15:15, IR_20:20, IR_25:25, IVA_1:1, IVA_2:2, IVA_3:3, IR_BIENES_2:2, IR_SERVICIOS_2:2, IR_BIENES_1:1, IR_HONORARIOS_10:10, IR_ALQUILERES_15:15, IR_OTROS_20:20 }
                            handleItemChange(idx, 'withholdingRate', rates[v] || 0)
                          } else {
                            handleItemChange(idx, 'withholdingRate', 0)
                          }
                        }}
                      />
                      <span className="text-xs font-black tabular-nums">
                        {localDoc.currency === 'USD' ? '$' : 'C$'} {Number((item.unitPrice||0) * (item.quantityReceived||0)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                );
              })}
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

  const totalItemsReceived = data.reduce((acc, r) => acc + (r.items?.reduce((a,i:any) => a + Number(i.quantityReceived||0),0)||0), 0);
  const totalFaltantes = data.reduce((acc, r) => acc + (r.items?.reduce((a,i:any) => a + Math.max(0, Number(i.quantityOrdered||0) - Number(i.quantityReceived||0)),0)||0), 0);
  const totalRechazados = data.reduce((acc, r) => acc + (r.items?.reduce((a,i:any) => a + Number(i.quantityRejected||0),0)||0), 0);
  const withIncidencias = data.filter(r => String(r.status||'').toUpperCase() === 'WITH_INCIDENTS').length;

  const kpis = [
    { title: 'Recepciones',   value: data.length, icon: PackageCheck, color: 'text-blue-500', bg: 'bg-blue-500/10', kind: 'indicator' as const },
    { title: 'Ítems Recibidos', value: totalItemsReceived, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', kind: 'filter' as const, filter: 'RECEIVED' as const },
    { title: 'Faltantes', value: totalFaltantes, icon: ArrowDown, color: 'text-amber-500', bg: 'bg-amber-500/10', kind: 'indicator' as const },
    { title: 'Incidencias', value: `${withIncidencias} rec. / ${totalRechazados} rech.`, icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10', kind: 'filter' as const, filter: 'WITH_INCIDENTS' as const },
  ];

  return (
    <div className="min-w-0 max-w-full space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <PurchaseKpiCard key={i} title={k.title} value={k.value} icon={k.icon} color={k.color} bg={k.bg} kind={k.kind} active={k.filter === statusFilter} onClick={k.filter ? () => setStatusFilter(statusFilter === k.filter ? 'ALL' : k.filter) : undefined} />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight" data-tour="purchases-list-title">Recepciones</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Inventario entregado por proveedores</p></div>
          <div className="flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto" data-tour="purchases-list-actions">
            <PurchaseViewTutorial view="receipts" />
            <div className="relative flex-1 min-w-0"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-full sm:w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }} /></div>
            {canPerform('PURCHASES_RECEIPTS', 'create') && (
              <Button onClick={() => setEditingId('NEW')} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nueva Recepción</Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} pagination={pagination}
          onBulkDelete={canPerform('PURCHASES_RECEIPTS', 'delete') ? async (ids) => {
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                const receipt = data.find(r => r.id === id);
                const st = String(receipt?.status||'').toUpperCase();
                if (st !== 'PENDING' && st !== '') {
                  toast.error(`No se puede eliminar la recepción "${receipt?.number||id}" porque ya está ${statusOpts.find(s=>s.value===st)?.label?.toLowerCase()||'procesada'}. Solo se anulan.`);
                  continue;
                }
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
              {canPerform('PURCHASES_RECEIPTS', 'delete') && (() => {
                const st = String(row.status||'').toUpperCase();
                const isDeletable = st === 'PENDING' || st === '';
                return isDeletable ? (
                  <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
                ) : (
                  <Button title="Las recepciones procesadas solo se anulan, no se eliminan" variant="ghost" size="icon" className="size-8 rounded-lg opacity-30 cursor-not-allowed" disabled><Trash2 className="size-4" /></Button>
                );
              })()}
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

