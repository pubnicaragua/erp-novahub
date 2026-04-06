import { useState, useEffect } from 'react';
import { 
  FileStack, Plus, Search, Eye, Trash2, Clock, AlertTriangle, CheckCircle2, ChevronLeft, Download
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { billsService, suppliersService, purchaseOrdersService } from '../../services/compras.service';
import type { SupplierInvoice, Supplier } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { generateSupplierInvoicePDF } from '../../utils/pdfGenerator';

interface Props { data: SupplierInvoice[]; loading: boolean; onRefresh: () => void; draftInvoiceFromOrder?: any; onDraftConsumed?: () => void; }

const statusOpts = [
  { label: 'Pendiente',   value: 'PENDING',  color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Parcial',     value: 'PARTIAL',  color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Pagada',      value: 'PAID',     color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Vencida',     value: 'OVERDUE',  color: 'bg-rose-500/10 text-rose-500' },
  { label: 'Reembolsada', value: 'REFUNDED', color: 'bg-muted/30 text-muted-foreground/50' },
];

export function FacturasProveedorView({ data, loading, onRefresh, draftInvoiceFromOrder, onDraftConsumed }: Props) {
  const { canPerform, user } = useAuth();
  const { exchangeRate: globalRate, displayCurrency, formatConvertedAmount, convertAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<SupplierInvoice> | null>(null);
  const generateSupplierInvoiceNumber = () => `INV-${Date.now().toString().slice(-6)}`;

  useEffect(() => {
    suppliersService.getAll().then(res => {
      const list = Array.isArray(res) ? res : (res as any).data || [];
      setSuppliers(list);
    }).catch();
  }, []);

  useEffect(() => {
    if (draftInvoiceFromOrder) {
      setLocalDoc({ number: generateSupplierInvoiceNumber(), ...draftInvoiceFromOrder, _fromDraft: true });
      setEditingId('NEW');
      if (onDraftConsumed) onDraftConsumed();
    }
  }, [draftInvoiceFromOrder]);

  useEffect(() => {
    if (editingId && editingId !== 'NEW') {
       const found = data.find(x => x.id === editingId);
       setLocalDoc(found ? JSON.parse(JSON.stringify(found)) : null);
    }
  }, [editingId, data]);

  const handleCreateNew = () => {
    setLocalDoc({
      supplierId: '',
      date: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      currency: displayCurrency,
      exchangeRate: globalRate,
      status: 'PENDING',
      number: generateSupplierInvoiceNumber(),
      items: [],
      subtotal: 0,
      taxAmount: 0,
      total: 0
    });
    setEditingId('NEW');
  };

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filtered = data.filter((b) => {
    if (!normalizedSearchTerm) return true;
    const haystack = [
      b.number,
      b.supplier?.name,
      b.supplier?.code,
      b.supplier?.email,
      b.supplier?.phone,
      b.notes,
      b.status,
      b.date ? new Date(b.date).toLocaleDateString() : '',
      b.dueDate ? new Date(b.dueDate).toLocaleDateString() : '',
      String(b.total ?? ''),
      String(b.amountPaid ?? ''),
      String(b.balance ?? ''),
      ...(b.items || []).map((item: any) => item.description),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedSearchTerm);
  });

  const isSupplierActive = (supplierId?: string) =>
    !!supplierId && (suppliers.find((s) => s.id === supplierId)?.status || '').toUpperCase() === 'ACTIVE';
  const isPayingStatus = (status?: string) => ['PAID', 'PARTIAL'].includes((status || '').toUpperCase());

  const ensureFinanceExpenseForInvoice = async (_invoice: Partial<SupplierInvoice>) => {
    return;
  };

  const columns: ColumnDef<SupplierInvoice>[] = [
    { key: 'number',   header: 'Factura #',   width: '120px',
      render: (val) => <span className="font-black font-mono text-primary text-xs">{val||'-'}</span> },
    { key: 'supplier', header: 'Proveedor',
      render: (_v, row) => <span className="font-bold text-sm">{row.supplier?.name||'-'}</span> },
    { key: 'date',     header: 'Emisión',     width: '110px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'dueDate',  header: 'Vencimiento', width: '110px',
      render: (val) => { const isLate = new Date(val).getTime() < Date.now(); return <span className={cn("text-xs", isLate && "text-rose-500 font-bold")}>{val ? new Date(val).toLocaleDateString() : '-'}</span>; } },
    { key: 'total',    header: 'Total',       width: '130px',
      render: (val, row) => (
        <span className="font-black tabular-nums text-rose-500">
          {formatConvertedAmount(Number(val || 0), row.currency, row.exchangeRate)}

        </span>
      ) },
    { key: 'status',   header: 'Estado',      width: '110px', editable: canPerform('compras', 'edit'), type: 'select', options: statusOpts,
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<SupplierInvoice>) => {
    const currentInvoice = data.find((x) => x.id === id);
    const previousStatus = String(currentInvoice?.status || '').toUpperCase();
    const statusToApply = (updates.status || currentInvoice?.status || '').toString();
    if (isPayingStatus(statusToApply) && currentInvoice?.supplierId && !isSupplierActive(currentInvoice.supplierId)) {
      toast.error('No se puede registrar pago en facturas de proveedores inactivos');
      return;
    }
    try {
      const updatedResponse = await billsService.update(id as string, updates);
      const updatedInvoice = (updatedResponse as any)?.data || updatedResponse;
      const nextStatus = String(updatedInvoice?.status || updates.status || previousStatus).toUpperCase();
      if (!isPayingStatus(previousStatus) && isPayingStatus(nextStatus)) {
        await ensureFinanceExpenseForInvoice({
          ...(currentInvoice || {}),
          ...(updatedInvoice || {}),
          id: String(id),
          status: nextStatus,
        });
      }
      toast.success('Factura actualizada');
      onRefresh();
    }
    catch { toast.error('Error al actualizar'); }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    setDeleteLoading(true);
    try {
      await billsService.delete(pendingDeleteId);
      toast.success('Factura eliminada correctamente');
      setPendingDeleteId(null);
      if (editingId === pendingDeleteId) {
        setEditingId(null);
        setLocalDoc(null);
      }
      onRefresh();
    } catch {
      toast.error('Error al eliminar factura');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSaveDoc = async () => {
    if (!localDoc?.supplierId) return toast.error('Debe seleccionar un proveedor');
    if (isPayingStatus(String(localDoc.status || '')) && !isSupplierActive(localDoc.supplierId)) {
      return toast.error('No se puede registrar pago en facturas de proveedores inactivos');
    }
    
    try {
      if (editingId === 'NEW') {
        const payloadToSave: any = { ...localDoc };
        delete payloadToSave._sourceOrderId;
        delete payloadToSave._fromDraft;

        if (payloadToSave.purchaseOrderId) {
          const duplicateForOrder = data.some((inv) => inv.purchaseOrderId === payloadToSave.purchaseOrderId);
          if (duplicateForOrder) {
            return toast.error('Ya existe una factura para esta orden de compra');
          }
        }

        const createdResponse = await billsService.create({
          ...payloadToSave,
          number: payloadToSave.number || generateSupplierInvoiceNumber(),
        });
        const created = (createdResponse as any)?.data || createdResponse;
        await ensureFinanceExpenseForInvoice(created);
        
        if ((localDoc as any)._sourceOrderId) {
          try {
            await purchaseOrdersService.update((localDoc as any)._sourceOrderId, { status: 'RECEIVED' });
          } catch (err) {
            console.error('Failed to update source order status', err);
          }
        }
        
        toast.success('Factura creada exitosamente');
        setEditingId(null);
        setLocalDoc(null);
      } else {
        const existingInvoice = data.find((x) => x.id === editingId);
        const previousStatus = String(existingInvoice?.status || '').toUpperCase();
        const updatedResponse = await billsService.update(editingId!, localDoc as any);
        const updatedInvoice = (updatedResponse as any)?.data || updatedResponse;
        const nextStatus = String(updatedInvoice?.status || localDoc.status || '').toUpperCase();
        if (!isPayingStatus(previousStatus) && isPayingStatus(nextStatus)) {
          await ensureFinanceExpenseForInvoice({
            ...(existingInvoice || {}),
            ...(updatedInvoice || {}),
            id: editingId!,
            status: nextStatus,
          });
        }
        toast.success('Factura guardada');
        setLocalDoc((prev) => prev ? { ...prev } : prev);
        setEditingId(editingId);
      }
      onRefresh();
    } catch (e: any) {
      toast.error('Error al guardar: ' + (e.response?.data?.message || 'Error'));
    }
  };

  const handleDeleteItem = (idx: number) => {
    if (!localDoc) return;
    const newItems = [...(localDoc.items || [])];
    newItems.splice(idx, 1);
    recalculateTotals(newItems);
  };

  const handleItemChange = (idx: number, field: string, value: any) => {
    if (!localDoc) return;
    const newItems = [...(localDoc.items || [])];
    newItems[idx] = { ...newItems[idx], [field]: value };
    
    if (['quantity', 'unitPrice', 'taxRate'].includes(field)) {
       const q = Number(newItems[idx].quantity || 0);
       const p = Number(newItems[idx].unitPrice || 0);
       const t = Number(newItems[idx].taxRate || 0);
       const sub = q * p;
       const tax = sub * (t / 100);
       newItems[idx].total = sub + tax;
    }
    recalculateTotals(newItems);
  };

  const recalculateTotals = (items: any[]) => {
    const subtotal = items.reduce((acc, it) => acc + (Number(it.quantity||0) * Number(it.unitPrice||0)), 0);
    const taxAmount = items.reduce((acc, it) => acc + ((Number(it.quantity||0) * Number(it.unitPrice||0)) * (Number(it.taxRate||0)/100)), 0);
    const total = subtotal + taxAmount;
    setLocalDoc(prev => ({ ...prev!, items, subtotal, taxAmount, total }));
  };

  if (editingId && localDoc) {
    const isNew = editingId === 'NEW';
    const currentStatus = statusOpts.find(s => s.value === (localDoc.status||'').toUpperCase());
    
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => { setEditingId(null); setLocalDoc(null); }} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isNew ? 'Nueva Factura de Proveedor' : `Factura ${localDoc.number||''}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Detalle financiero</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {!isNew && (
               <Button
                 variant="outline"
                 className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4"
                 onClick={() => generateSupplierInvoicePDF({
                   invoice: localDoc,
                   tenantName: user?.tenantName || 'Nova Hub',
                   formatAmount: (amount: number, currency?: string, rate?: number) =>
                     formatConvertedAmount(Number(amount || 0), currency || (localDoc.currency as any), rate || localDoc.exchangeRate),
                 })}
               >
                 <Download className="size-3 mr-2" /> Descargar
               </Button>
             )}
             {!isNew && canPerform('compras', 'delete') && (
                <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => setPendingDeleteId(editingId)}>
                  <Trash2 className="size-3 mr-2" /> Eliminar
                </Button>
             )}
            {((isNew && canPerform('compras', 'create')) || (!isNew && canPerform('compras', 'edit'))) && (
              <Button onClick={handleSaveDoc} className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6">
                Guardar Factura
              </Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Número de Factura</p>
                  <Input 
                    disabled
                    value={localDoc.number || ''} 
                    className="h-8 text-xs font-black uppercase" 
                    placeholder="Se genera automáticamente" 
                  />
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Proveedor</p>
                  <Combobox 
                    disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                    options={suppliers
                      .filter(s => (s.status || '').toUpperCase() === 'ACTIVE' || s.id === localDoc.supplierId)
                      .map(s => ({ label: s.name, value: s.id, description: (s.code ? `[${s.code}] ` : '') + (s.phone || 'Sin teléfono') }))}
                    value={localDoc.supplierId || ''}
                    onChange={(val) => setLocalDoc({ ...localDoc, supplierId: val })}
                    placeholder="Seleccionar Proveedor"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha Emisión</p>
                  <Input 
                    disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                    type="date" 
                    value={localDoc.date ? new Date(localDoc.date).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, date: new Date(e.target.value).toISOString() })} 
                    className="h-8 text-xs" 
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha Vencimiento</p>
                  <Input 
                    disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                    type="date" 
                    value={localDoc.dueDate ? new Date(localDoc.dueDate).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, dueDate: new Date(e.target.value).toISOString() })} 
                    className="h-8 text-xs" 
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                  <select 
                    disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                    value={localDoc.status || 'PENDING'} 
                    onChange={(e) => setLocalDoc({ ...localDoc, status: e.target.value as any })}
                    className={cn("h-8 w-full rounded-md border border-input px-2 text-xs font-bold uppercase", currentStatus?.color || 'bg-background')}
                  >
                    {statusOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Moneda</p>
                  <select 
                    disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                    value={localDoc.currency || 'NIO'} 
                    onChange={(e) => setLocalDoc({ ...localDoc, currency: e.target.value as any })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase"
                  >
                    <option value="NIO">NIO (Cordobas)</option>
                    <option value="USD">USD (Dolares)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 flex flex-col justify-center h-full space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumen Financiero</p>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-bold tabular-nums">${Number(localDoc.subtotal||0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Impuesto</span>
                  <span className="font-bold tabular-nums text-rose-500">${Number(localDoc.taxAmount||0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-base border-t pt-3 border-border/50">
                  <span className="font-black uppercase text-xs tracking-widest">Total</span>
                  <span className="font-black text-xl text-primary tabular-nums text-right">
                     {localDoc.currency === 'USD' ? '$' : 'C$'} {Number(localDoc.total||0).toLocaleString()}
                     {localDoc.currency === 'NIO' && <span className="block text-[9px] text-muted-foreground mt-1">≈ $ {(Number(localDoc.total||0) / (localDoc.exchangeRate || globalRate)).toLocaleString(undefined, {maximumFractionDigits:2})}</span>}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Ítems a Facturar</p>
              {((isNew && canPerform('compras', 'create')) || (!isNew && canPerform('compras', 'edit'))) && (
                <Button variant="outline" size="sm" onClick={() => {
                  const newItems = [...(localDoc.items || []), { id: `new-${Date.now()}`, description: '', quantity: 1, unitPrice: 0, taxRate: 0, total: 0 }];
                  setLocalDoc({ ...localDoc, items: newItems as any });
                }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl">
                  <Plus className="size-3 mr-2" /> Agregar Item
                </Button>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                <div className="col-span-4">Descripción</div>
                <div className="col-span-2 text-right">Cant.</div>
                <div className="col-span-2 text-right">Precio Unitario</div>
                <div className="col-span-2 text-right">Imp. %</div>
                <div className="col-span-2 text-right">Total</div>
              </div>
              {(localDoc.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4">
                    <Input 
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                      value={item.description || ''} 
                      onChange={(e) => handleItemChange(idx, 'description', e.target.value)} 
                      className="h-8 text-xs" 
                      placeholder="Concepto" 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                      type="number" 
                      min="0" 
                      value={item.quantity === 0 ? '' : item.quantity} 
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)} 
                      className="h-8 text-xs text-right" 
                      placeholder="0" 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                      type="number" 
                      min="0" 
                      value={item.unitPrice === 0 ? '' : item.unitPrice} 
                      onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)} 
                      className="h-8 text-xs text-right" 
                      placeholder="0" 
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                      type="number" 
                      min="0" 
                      value={item.taxRate === 0 ? '' : item.taxRate} 
                      onChange={(e) => handleItemChange(idx, 'taxRate', e.target.value)} 
                      className="h-8 text-xs text-right" 
                      placeholder="0" 
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <span className="text-xs font-black w-20 text-right tabular-nums">${Number(item.total || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    {((isNew && canPerform('compras', 'create')) || (!isNew && canPerform('compras', 'edit'))) && (
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

  const pendingTotalInDisplayCurrency = data
    .filter(invoice => ['PENDING', 'PARTIAL'].includes((invoice.status || '').toUpperCase()))
    .reduce((acc, invoice) => acc + convertAmount(invoice.total || 0, invoice.currency, invoice.exchangeRate), 0);

  const kpis = [
     { title: 'Facturas',        value: data.length,                   icon: FileStack, color: 'text-blue-500',   bg: 'bg-blue-500/10'    },
     {
       title: `Por Pagar (${displayCurrency})`,
       value: `${displayCurrency === 'USD' ? '$' : 'C$'} ${pendingTotalInDisplayCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
       icon: Clock,
       color: 'text-amber-500',
       bg: 'bg-amber-500/10',
     },
     { title: 'Vencidas',        value: data.filter(b => new Date(b.dueDate).getTime() < Date.now() && (b.status||'').toUpperCase() !== 'PAID').length, icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
     { title: 'Pagadas (Mes)',   value: data.filter(b => (b.status||'').toUpperCase() === 'PAID').length, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
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
          <div><h2 className="text-xl font-black uppercase tracking-tight">Facturas de Proveedor</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Cuentas por pagar</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            {canPerform('compras', 'create') && (
              <Button onClick={handleCreateNew} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nueva Factura</Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading}
          onBulkDelete={canPerform('compras', 'delete') ? async (ids) => {
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await billsService.delete(id as string);
              }
              toast.success('Elementos eliminados');
              onRefresh();
            } catch (e) {
              toast.error('Error al eliminar');
            }
          } : undefined}
          actions={(row) => (
            <div className="flex gap-1">
              <Button title={canPerform('compras', 'edit') ? "Editar" : "Ver"} variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
              {canPerform('compras', 'delete') && (
                <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
              )}
            </div>
          )}
        />
        <ConfirmDialog
          open={!!pendingDeleteId}
          onOpenChange={(open) => !open && setPendingDeleteId(null)}
          title="Eliminar Factura"
          description="¿Estás seguro de que deseas eliminar esta factura? Esta acción no se puede deshacer."
          confirmLabel="Eliminar Factura"
          onConfirm={handleDeleteConfirm}
          loading={deleteLoading}
        />
      </div>
    </div>
  );
}
