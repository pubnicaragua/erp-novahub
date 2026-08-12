import { useState, useEffect } from 'react';
import { BadgeDollarSign, Plus, Search, Eye, Pencil, TrendingUp, Hash, Trash2, ChevronLeft, Send, CheckCircle2, Lock, FileText } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { vendorCreditsService } from '../../services/compras.service';
import type { SupplierCredit, Supplier, SupplierInvoice } from '../../types';
import type { SalesPaginationControls } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PurchaseAuditButton } from './PurchaseAuditButton';
import { PurchaseKpiCard } from './PurchaseKpiCard';
import { PurchaseViewTutorial } from './PurchaseViewTutorial';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';

interface Props { data: SupplierCredit[]; loading: boolean; onRefresh: () => void; supplierCatalog?: Supplier[]; supplierInvoices?: SupplierInvoice[]; pagination?: SalesPaginationControls; onSearchChange?: (value: string) => void; }

const statusOpts = [
  { label: 'Borrador',  value: 'draft',   color: 'bg-muted/20 text-muted-foreground' },
  { label: 'Emitido',   value: 'issued',  color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Aplicado',  value: 'applied', color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Parcial',   value: 'partial', color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Pagado',    value: 'paid',    color: 'bg-emerald-600/10 text-emerald-600' },
  { label: 'Anulado',   value: 'voided',  color: 'bg-rose-500/10 text-rose-500' },
];

const PAYMENT_METHOD_OPTIONS = [
  { label: 'Efectivo', value: 'CASH' },
  { label: 'Transferencia', value: 'TRANSFER' },
  { label: 'Cheque', value: 'CHECK' },
  { label: 'Tarjeta', value: 'CARD' },
  { label: 'Otro', value: 'OTHER' },
];

export function CreditosProveedorView({ data, loading, onRefresh, supplierCatalog = [], supplierInvoices = [], pagination, onSearchChange }: Props) {
  const { canPerform } = useAuth();
  const { displayCurrency, baseCurrency, valuationMode, valuationModeSuffix, toBaseAmount, formatConvertedAmount, formatCurrentAmount, convertAmount, convertCurrentAmount, exchangeRate } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('purchases-credits-layout', 'table', 24 * 365);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ISSUED' | 'APPLIED'>('ALL');
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<SupplierCredit> | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [pendingIssueId, setPendingIssueId] = useState<string | null>(null);
  const [issueLoading, setIssueLoading] = useState(false);
  const [applyTarget, setApplyTarget] = useState<SupplierCredit | null>(null);
  const [applyMethod, setApplyMethod] = useState<string>('CASH');
  const [applyLoading, setApplyLoading] = useState(false);

  useEffect(() => { setSuppliers(supplierCatalog); }, [supplierCatalog]);

  const openEditor = (id: string | null) => {
    setEditingId(id);
    if (id === 'NEW') {
      setLocalDoc({
        supplierId: '',
        date: new Date().toISOString(),
        reason: '',
        status: 'draft',
        items: [],
        total: 0,
      });
    } else if (id) {
      const found = data.find(x => x.id === id);
      setLocalDoc(found ? JSON.parse(JSON.stringify(found)) : null);
    } else {
      setLocalDoc(null);
    }
  };

  const filtered = data.filter(c => {
    const status = String(c.status || '').toLowerCase();
    if (statusFilter === 'ISSUED' && status !== 'issued') return false;
    if (statusFilter === 'APPLIED' && !['applied', 'partial', 'paid'].includes(status)) return false;
    if (!searchTerm) return true;
    return (c.number||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.supplier?.name||'').toLowerCase().includes(searchTerm.toLowerCase());
  });

  const resolveSourceCurrency = (value?: string) => ((value || '').toUpperCase() === 'USD' ? 'USD' : 'NIO');

  const columns: ColumnDef<SupplierCredit>[] = [
    { key: 'number',   header: 'Nota #',     width: '110px',
      render: (_v, row) => <span className="font-black font-mono text-primary text-xs">{row.number||row.id?.slice(0,8)}</span> },
    { key: 'supplier', header: 'Proveedor',  width: '160px',
      render: (_v, row) => <span className="font-bold text-sm">{row.supplier?.name||'-'}</span> },
    { key: 'supplierInvoice', header: 'Doc. Origen', width: '110px',
      render: (_v, row) => row.supplierInvoice ? <span className="flex items-center gap-1 text-xs font-mono font-bold text-muted-foreground"><FileText className="size-3 text-primary/60" />{row.supplierInvoice.number}</span> : <span className="text-xs text-muted-foreground/40">—</span> },
    { key: 'date',     header: 'Fecha',      width: '100px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'total',    header: 'Total',      width: '110px',
      render: (val, row) => <CurrencyValuationAmount amount={Number(val || 0)} sourceCurrency={resolveSourceCurrency((row as any)?.currency)} sourceExchangeRate={(row as any)?.exchangeRate} className="font-black" /> },
    { key: 'status',   header: 'Estado',     width: '100px',
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toLowerCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<SupplierCredit>) => {
    try { await vendorCreditsService.update(id as string, updates); toast.success('Crédito actualizado'); onRefresh(); }
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar'); throw new Error('Update failed', { cause: e }); }
  };

  const handleIssueConfirm = async () => {
    if (!pendingIssueId) return;
    setIssueLoading(true);
    const toastId = toast.loading('Emitiendo crédito de proveedor...');
    try {
      await vendorCreditsService.issue(pendingIssueId);
      toast.success('Crédito emitido correctamente', { id: toastId });
      setPendingIssueId(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo emitir el crédito', { id: toastId });
    } finally {
      setIssueLoading(false);
    }
  };

  const handleApplyConfirm = async () => {
    if (!applyTarget) return;
    setApplyLoading(true);
    const toastId = toast.loading('Aplicando crédito de proveedor...');
    try {
      await vendorCreditsService.apply(applyTarget.id, { paymentMethod: applyMethod });
      toast.success('Crédito aplicado correctamente', { id: toastId });
      setApplyTarget(null);
      setApplyMethod('CASH');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo aplicar el crédito', { id: toastId });
    } finally {
      setApplyLoading(false);
    }
  };

  const recalculatedTotal = (localDoc?.items || []).reduce((acc, it) => acc + (Number(it.quantity || 0) * Number(it.unitPrice || 0)), 0);
  
  const handleSaveDoc = async () => {
    if (!localDoc?.supplierId) return toast.error('Seleccione un proveedor');
    
    const saveToastId = toast.loading(editingId === 'NEW' ? 'Registrando crédito de proveedor...' : 'Guardando crédito de proveedor...');
    try {
      const creditCurrency = localDoc.currency || displayCurrency;
      const creditRate = creditCurrency === baseCurrency
        ? 1
        : (Number(localDoc.exchangeRate || 0) > 1 ? Number(localDoc.exchangeRate) : exchangeRate);
      const finalDoc = {
          ...localDoc,
          total: recalculatedTotal,
          currency: creditCurrency,
          exchangeRate: creditRate,
          baseTotal: toBaseAmount(recalculatedTotal, creditCurrency, creditRate),
          status: editingId === 'NEW' ? 'draft' : (localDoc.status || 'draft'),
      };
      if (editingId === 'NEW') {
        await vendorCreditsService.create(finalDoc as any);
        toast.success('Crédito registrado exitosamente', { id: saveToastId });
      } else {
        await vendorCreditsService.update(editingId!, finalDoc as any);
        toast.success('Crédito guardado', { id: saveToastId });
      }
      openEditor(null);
      onRefresh();
    } catch (e: any) { 
        toast.error(e?.response?.data?.message || e?.message || 'Error al registrar', { id: saveToastId });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    setDeleteLoading(true);
    const deleteToastId = toast.loading('Eliminando crédito de proveedor...');
    try {
      await vendorCreditsService.delete(pendingDeleteId);
      toast.success('Crédito eliminado exitosamente', { id: deleteToastId });
      setPendingDeleteId(null);
      openEditor(null);
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error al eliminar', { id: deleteToastId });
    } finally {
      setDeleteLoading(false);
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
    
    if (['quantity', 'unitPrice'].includes(field)) {
       const q = Number(newItems[idx].quantity || 0);
       const p = Number(newItems[idx].unitPrice || 0);
       newItems[idx].total = q * p;
    }
    setLocalDoc({ ...localDoc, items: newItems as any });
  };

  if (editingId && localDoc) {
    const isNew = editingId === 'NEW';
    const currentStatus = statusOpts.find(s => s.value === (localDoc.status||'').toLowerCase());
    const isLocked = !isNew && ['applied', 'partial', 'paid', 'voided'].includes(String(localDoc.status || '').toLowerCase());
    const canMutate = isNew ? canPerform('PURCHASES_RETURNS', 'create') : (canPerform('PURCHASES_RETURNS', 'edit') && !isLocked);
    const invoiceOptions = supplierInvoices
      .filter(inv => !localDoc.supplierId || inv.supplierId === localDoc.supplierId)
      .filter(inv => String(inv.status || '').toUpperCase() !== 'CANCELLED')
      .map(inv => ({ label: `${inv.number} · ${inv.status || ''}`, value: inv.id, description: `${new Date(inv.date || Date.now()).toLocaleDateString()} · ${formatConvertedAmount(Number(inv.total || 0), resolveSourceCurrency((inv as any)?.currency), (inv as any)?.exchangeRate)}` }));

    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => openEditor(null)} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isNew ? 'Nueva Nota de Crédito' : `Nota ${localDoc.number || 'de Crédito'}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Saldos a favor de proveedores</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
             {!isNew && canPerform('PURCHASES_RETURNS', 'delete') && !isLocked && (
                <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => setPendingDeleteId(editingId)}>
                  <Trash2 className="size-3 mr-2" /> Eliminar
                </Button>
             )}
            {isLocked && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                <Lock className="size-3.5" /> Crédito {currentStatus?.label?.toLowerCase()} · Solo lectura
              </div>
            )}
            {((isNew && canPerform('PURCHASES_RETURNS', 'create')) || (!isNew && canPerform('PURCHASES_RETURNS', 'edit'))) && !isLocked && (
              <Button onClick={handleSaveDoc} className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6">
                Guardar Nota
              </Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50 col-span-2">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Datos del Crédito</p>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div className="md:col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Proveedor</p>
                  <Combobox
                    disabled={!canMutate}
                    options={suppliers
                      .filter(s => (s.status || '').toUpperCase() === 'ACTIVE' || s.id === localDoc.supplierId)
                      .map(s => ({ label: s.name, value: s.id, description: (s.code ? `[${s.code}] ` : '') + (s.phone || 'Sin teléfono') }))}
                    value={localDoc.supplierId || ''}
                    onChange={(val) => setLocalDoc({ ...localDoc, supplierId: val, supplierInvoiceId: undefined })}
                    placeholder="Seleccionar proveedor..."
                  />
                </div>
                <div className="md:col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Documento de origen (factura a la que aplica)</p>
                  <Combobox
                    disabled={!canMutate}
                    options={invoiceOptions}
                    value={localDoc.supplierInvoiceId || ''}
                    onChange={(val) => setLocalDoc({ ...localDoc, supplierInvoiceId: val || undefined })}
                    placeholder="Sin factura vinculada (crédito general)"
                  />
                  {isNew && localDoc.supplierId && (
                    <p className="mt-1 text-[10px] text-muted-foreground">Al vincular una factura, el crédito descuenta el saldo pendiente de esa factura.</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha Emisión</p>
                  <Input 
                    disabled={!canMutate}
                    type="date" 
                    value={localDoc.date ? new Date(localDoc.date).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, date: new Date(e.target.value).toISOString() })} 
                    className="h-8 text-xs" 
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                  <div className="flex h-8 items-center"><Badge variant="outline" className={cn('text-[9px] font-black uppercase border-none', currentStatus?.color || 'bg-muted/20 text-muted-foreground')}>{currentStatus?.label || localDoc.status || 'Borrador'}</Badge></div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Moneda</p>
                  <select
                    disabled={!canMutate}
                    value={localDoc.currency || displayCurrency}
                    onChange={(e) => {
                      const newCurrency = e.target.value;
                      setLocalDoc({
                        ...localDoc,
                        currency: newCurrency as any,
                        exchangeRate: newCurrency === 'NIO' ? 1 : (localDoc.exchangeRate || 1),
                      });
                    }}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase">
                    <option value="NIO">C$ (NIO)</option>
                    <option value="USD">$ (USD)</option>
                  </select>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">T.C.</p>
                  <Input
                    disabled={!canMutate || localDoc.currency === 'NIO'}
                    type="number" min="0" step="0.01"
                    value={localDoc.exchangeRate || 1}
                    onChange={(e) => setLocalDoc({ ...localDoc, exchangeRate: Number(e.target.value) })}
                    className="h-8 text-xs font-bold tabular-nums" />
                </div>
                <div className="md:col-span-4">
                  <p className="text-[10px] text-muted-foreground mb-1">Razón / Concepto</p>
                  <Input 
                    disabled={!canMutate}
                    value={localDoc.reason || ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, reason: e.target.value })} 
                    className="h-8 text-xs" 
                    placeholder="Ej. Devolución de mercadería, descuento comercial, bonificación" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 col-span-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Detalles</p>
                {canMutate && (
                  <Button variant="outline" size="sm" onClick={() => {
                    const newItems = [...(localDoc.items || []), { id: `new-${Date.now()}`, description: '', quantity: 1, unitPrice: 0, total: 0 }];
                    setLocalDoc({ ...localDoc, items: newItems as any });
                  }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl">
                    <Plus className="size-3 mr-2" /> Agregar Item
                  </Button>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                  <div className="col-span-5">Descripción</div>
                  <div className="col-span-2 text-right">Cant.</div>
                  <div className="col-span-3 text-right">Precio Unitario</div>
                  <div className="col-span-2 text-right">Total</div>
                </div>
                {(localDoc.items || []).map((item: any, idx: number) => (
                  <div key={item.id || idx} data-item-layout="credit" className="purchase-item-row grid min-w-0 grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <Input 
                        disabled={!canMutate}
                        value={item.description || ''} 
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)} 
                        className="h-8 text-xs" 
                        placeholder="Concepto" 
                      />
                    </div>
                    <div className="col-span-2">
                      <Input 
                        disabled={!canMutate}
                        type="number" 
                        min="0" 
                        value={item.quantity === 0 ? '' : item.quantity} 
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)} 
                        className="h-8 text-xs text-right" 
                        placeholder="0" 
                      />
                    </div>
                    <div className="col-span-3">
                      <Input 
                        disabled={!canMutate}
                        type="number" 
                        min="0" 
                        value={item.unitPrice === 0 ? '' : item.unitPrice} 
                        onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)} 
                        className="h-8 text-xs text-right" 
                        placeholder="0" 
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <span className="text-xs font-black w-20 text-right tabular-nums">{formatConvertedAmount(Number(item.total || 0), resolveSourceCurrency((localDoc as any)?.currency), (localDoc as any)?.exchangeRate)}</span>
                      {canMutate && (
                        <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 rounded-md" onClick={() => handleDeleteItem(idx)}>
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
               <div className="flex justify-end mt-4">
                  <div className="w-64 space-y-2 text-sm bg-muted/10 p-4 rounded-xl border border-border/50">
                     <div className="flex justify-between pt-2 border-t font-black"><span className="uppercase text-[10px] tracking-widest">Total</span><span className="text-lg text-primary">{formatConvertedAmount(recalculatedTotal, resolveSourceCurrency((localDoc as any)?.currency), (localDoc as any)?.exchangeRate)}</span></div>
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>

      </div>
    );
  }

  const toDisplayAmount = (amount: number, currency?: string, rate?: number) => valuationMode === 'CURRENT'
    ? convertCurrentAmount(amount, currency)
    : convertAmount(amount, currency, rate || exchangeRate);
  const disponible = data
    .filter(c => (c.status || '').toLowerCase() === 'issued')
    .reduce((a, c) => a + toDisplayAmount(Number((c as any).total ?? (c as any).baseTotal ?? 0), resolveSourceCurrency((c as any)?.currency), (c as any)?.exchangeRate), 0);
  const aplicados = data
    .filter(c => ['applied', 'partial', 'paid'].includes((c.status || '').toLowerCase()))
    .reduce((a, c) => a + toDisplayAmount(Number((c as any).total ?? (c as any).baseTotal ?? 0), resolveSourceCurrency((c as any)?.currency), (c as any)?.exchangeRate), 0);
  const kpis = [
    { title: `Crédito Disponible (${displayCurrency}${valuationModeSuffix})`, value: formatCurrentAmount(disponible, displayCurrency), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', kind: 'indicator' as const },
    { title: 'Total Notas', value: data.length, icon: Hash, color: 'text-blue-500', bg: 'bg-blue-500/10', kind: 'indicator' as const },
    { title: 'Emitidas', value: data.filter(c => (c.status||'').toLowerCase() === 'issued').length, icon: BadgeDollarSign, color: 'text-purple-500', bg: 'bg-purple-500/10', kind: 'filter' as const, filter: 'ISSUED' as const },
    { title: `Aplicadas (${displayCurrency}${valuationModeSuffix})`, value: formatCurrentAmount(aplicados, displayCurrency), icon: CheckCircle2, color: 'text-teal-500', bg: 'bg-teal-500/10', kind: 'filter' as const, filter: 'APPLIED' as const },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="purchases-list-kpis">
        {kpis.map((k, i) => (
          <PurchaseKpiCard key={i} title={k.title} value={k.value} icon={k.icon} color={k.color} bg={k.bg} kind={k.kind} active={k.filter === statusFilter} onClick={k.filter ? () => setStatusFilter(statusFilter === k.filter ? 'ALL' : k.filter) : undefined} />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight" data-tour="purchases-list-title">Créditos de Proveedor</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Saldos a favor · Emitir para reservar el monto, Aplicar para liquidarlo</p></div>
          <div className="flex flex-wrap items-center justify-end gap-3" data-tour="purchases-list-actions">
            <PurchaseViewTutorial view="credits" />
            <ViewLayoutSelect value={layoutMode} onChange={setLayoutMode} ariaLabel="Elegir distribución de créditos de proveedor" />
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }} /></div>
            {canPerform('PURCHASES_RETURNS', 'create') && (
              <Button onClick={() => openEditor('NEW')} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nuevo Crédito</Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} pagination={pagination} layoutMode={layoutMode}
          actions={(row) => {
            const status = String(row.status || '').toUpperCase();
            return (
             <div className="flex gap-1">
              {canPerform('PURCHASES_RETURNS', 'approve') && status === 'DRAFT' && (
                <Button title="Emitir crédito (reserva el monto a favor del proveedor)" aria-label="Emitir crédito" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-blue-500/10 hover:text-blue-500" onClick={() => setPendingIssueId(row.id)}>
                  <Send className="size-4" />
                </Button>
              )}
              {canPerform('PURCHASES_RETURNS', 'approve') && status === 'ISSUED' && (
                <Button title="Aplicar crédito (genera asiento contable y pago)" aria-label="Aplicar crédito" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500" onClick={() => { setApplyTarget(row); setApplyMethod('CASH'); }}>
                  <CheckCircle2 className="size-4" />
                </Button>
              )}
              {!['APPLIED', 'PARTIAL', 'PAID', 'VOIDED'].includes(status) && (
                <Button title={canPerform('PURCHASES_RETURNS', 'edit') ? "Editar" : "Ver"} variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => openEditor(row.id)}>{canPerform('PURCHASES_RETURNS', 'edit') ? <Pencil className="size-4" /> : <Eye className="size-4" />}</Button>
              )}
              {['APPLIED', 'PARTIAL', 'PAID', 'VOIDED'].includes(status) && (
                <Button title="Ver (solo lectura)" aria-label="Ver crédito" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-muted/40" onClick={() => openEditor(row.id)}><Lock className="size-4" /></Button>
              )}
              <PurchaseAuditButton entity="SUPPLIER_CREDIT" entityId={row.id} title="Auditoria del Credito" />
              {canPerform('PURCHASES_RETURNS', 'delete') && ['DRAFT', 'ISSUED'].includes(status) && (
                <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
              )}
            </div>
          );
          }}
        />
      </div>

      <ConfirmDialog
        open={pendingIssueId !== null}
        onOpenChange={(open) => !open && setPendingIssueId(null)}
        loading={issueLoading}
        title="Emitir crédito de proveedor"
        description="Al emitir la nota de crédito se reservará el monto a favor del proveedor y, si está vinculada a una factura, se reducirá su saldo pendiente. ¿Deseas continuar?"
        confirmLabel="Emitir crédito"
        onConfirm={handleIssueConfirm}
      />

      <Dialog open={applyTarget !== null} onOpenChange={(open) => !open && setApplyTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-500" /> Aplicar crédito {applyTarget?.number}</DialogTitle>
            <DialogDescription>
              Al aplicar la nota de crédito se generará el asiento contable correspondiente y se registrará la liquidación como un pago al proveedor. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          {applyTarget && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Proveedor</span><b>{applyTarget.supplier?.name || '-'}</b></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Monto</span><b className="text-emerald-600"><CurrencyValuationAmount amount={Number(applyTarget.total || 0)} sourceCurrency={resolveSourceCurrency((applyTarget as any)?.currency)} sourceExchangeRate={(applyTarget as any)?.exchangeRate} /></b></div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Método de pago</p>
                <select
                  value={applyMethod}
                  onChange={(e) => setApplyMethod(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase"
                >
                  {PAYMENT_METHOD_OPTIONS.map(method => (
                    <option key={method.value} value={method.value}>{method.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyTarget(null)}>Cancelar</Button>
            <Button onClick={handleApplyConfirm} disabled={applyLoading} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 className="size-4" /> {applyLoading ? 'Aplicando...' : 'Aplicar crédito'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        loading={deleteLoading}
        title="Eliminar Crédito"
        description="¿Estás seguro de eliminar esta nota de crédito? Esta acción no se puede deshacer y los montos a favor del proveedor serán revertidos."
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
