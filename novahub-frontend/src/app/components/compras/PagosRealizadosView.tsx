import { useState, useEffect } from 'react';
import { Plus, Search, Eye, Pencil, CheckCircle2, TrendingDown, Hash, ChevronLeft, Trash2, Ban, Download, FileDown } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { paymentsService } from '../../services/compras.service';
import type { PaymentMade, Supplier, SupplierInvoice } from '../../types';
import type { SalesPaginationControls } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { generateExpensePDF } from '../../utils/pdfGenerator';
import { PurchaseAuditButton } from './PurchaseAuditButton';
import { PurchaseKpiCard } from './PurchaseKpiCard';
import { PurchaseViewTutorial } from './PurchaseViewTutorial';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';

interface Props {
  data: PaymentMade[];
  loading: boolean;
  onRefresh: () => void;
  supplierInvoices?: SupplierInvoice[];
  supplierCatalog?: Supplier[];
  draftPaymentFromInvoice?: Partial<PaymentMade> | null;
  onDraftConsumed?: () => void;
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  targetId?: string | null;
  onClearTargetId?: () => void;
}

const methodOpts = [
  { label: 'Transferencia',   value: 'TRANSFER' },
  { label: 'Efectivo',        value: 'CASH' },
  { label: 'Cheque',          value: 'CHECK' },
  { label: 'Tarjeta',         value: 'CARD' },
  { label: 'Otro',            value: 'OTHER' },
];

export function PagosRealizadosView({ data, loading, onRefresh, supplierInvoices = [], supplierCatalog = [], draftPaymentFromInvoice, onDraftConsumed, pagination, onSearchChange, targetId, onClearTargetId }: Props) {
  const { canPerform, user } = useAuth();
  const { exchangeRate: globalRate, displayCurrency, baseCurrency, valuationMode, valuationModeSuffix, formatConvertedAmount, formatCurrentAmount, convertAmount, convertCurrentAmount, toBaseAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('purchases-payments-layout', 'table', 24 * 365);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [bills, setBills] = useState<SupplierInvoice[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<PaymentMade> | null>(null);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [isMixed, setIsMixed] = useState(false);

  useEffect(() => {
    if (!targetId || !data.some((payment) => payment.id === targetId)) return;
    setHighlightedTargetId(targetId);
    setEditingId(targetId);
    onClearTargetId?.();
    const timeout = window.setTimeout(() => setHighlightedTargetId(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [targetId, data, onClearTargetId]);

  const normalizeMethod = (method?: string): 'CASH' | 'TRANSFER' | 'CHECK' | 'CARD' | 'OTHER' => {
    const normalized = String(method || 'TRANSFER').toUpperCase();
    if (['CASH', 'TRANSFER', 'CHECK', 'CARD', 'OTHER'].includes(normalized)) {
      return normalized as 'CASH' | 'TRANSFER' | 'CHECK' | 'CARD' | 'OTHER';
    }
    return 'TRANSFER';
  };

  useEffect(() => {
    setSuppliers(supplierCatalog);
  }, [supplierCatalog]);

  useEffect(() => {
    if (supplierInvoices.length > 0) {
      setBills(supplierInvoices);
    }
  }, [supplierInvoices]);

  useEffect(() => {
    if (draftPaymentFromInvoice) {
      setEditingId('NEW');
    }
  }, [draftPaymentFromInvoice]);

  useEffect(() => {
    if (editingId) {
      setIsMixed(false);
      if (editingId === 'NEW') {
         const prefilled = draftPaymentFromInvoice || {};
         setLocalDoc({
           supplierId: prefilled.supplierId || '',
           supplierInvoiceId: prefilled.supplierInvoiceId || '',
            date: prefilled.date || new Date().toISOString(),
            amount: Number(prefilled.amount || 0),
            currency: (prefilled.currency as any) || displayCurrency,
            exchangeRate: prefilled.exchangeRate || globalRate,
            method: normalizeMethod(prefilled.method as any),
            reference: prefilled.reference || `PAG-${Date.now().toString().slice(-5)}`,
            notes: prefilled.notes || '',
           });
         if (draftPaymentFromInvoice && onDraftConsumed) onDraftConsumed();
       } else {
          const found = data.find(x => x.id === editingId);
          setLocalDoc(found ? JSON.parse(JSON.stringify(found)) : null);
       }
    } else {
      setLocalDoc(null);
    }
  }, [editingId, data, draftPaymentFromInvoice, onDraftConsumed]);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const getMethodLabel = (method?: string) => methodOpts.find((opt) => opt.value === normalizeMethod(method))?.label || method || '-';
  const toExpensePayload = (payment: Partial<PaymentMade>, supplierName?: string) => ({
    number: payment.number || payment.reference || payment.id || `PAG-${Date.now().toString().slice(-5)}`,
    id: payment.id,
    date: payment.date,
    amount: Number(payment.amount || 0),
    currency: payment.currency,
    exchangeRate: payment.exchangeRate,
    category: 'PAGO_PROVEEDOR',
    description: payment.notes || `Pago a proveedor ${supplierName || '-'}`,
    paidTo: supplierName || '-',
    paymentSource: getMethodLabel(payment.method),
    reference: payment.reference || '-',
    status: 'PAID',
  });

  const filtered = data.filter((payment) => {
    if (!normalizedSearchTerm) return true;
    const linkedBill = bills.find((bill) => bill.id === payment.supplierInvoiceId);
    const haystack = [
      payment.reference,
      payment.number,
      payment.supplier?.name,
      payment.supplier?.code,
      payment.notes,
      payment.date ? new Date(payment.date).toLocaleDateString() : '',
      payment.amount,
      Number(payment.amount || 0).toLocaleString(),
      getMethodLabel(payment.method),
      linkedBill?.number,
      linkedBill?.status,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedSearchTerm);
  });

  const isSupplierActive = (supplierId?: string) =>
    !!supplierId && (suppliers.find((s) => s.id === supplierId)?.status || '').toUpperCase() === 'ACTIVE';

  const columns: ColumnDef<PaymentMade>[] = [
    { key: 'reference', header: 'Referencia', width: '130px', editable: canPerform('PURCHASES_PAYMENTS', 'edit') },
    { key: 'supplierInvoiceId', header: 'Factura #', width: '120px',
      render: (val) => {
        const invoice = bills.find((bill) => bill.id === val);
        return <span className="text-xs font-bold text-primary">{invoice?.number || '-'}</span>;
      } },
    { key: 'supplier',  header: 'Proveedor',
      render: (_v, row) => <span className="font-bold text-sm">{row.supplier?.name||'-'}</span> },
    { key: 'date',      header: 'Fecha',      width: '110px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'amount',    header: 'Monto',      width: '130px',
      render: (val, row) => (
        <CurrencyValuationAmount amount={Number(val || 0)} sourceCurrency={row.currency} sourceExchangeRate={row.exchangeRate} className="font-black text-emerald-500" />
      ) },
    { key: 'method',    header: 'Método',     width: '120px', editable: canPerform('PURCHASES_PAYMENTS', 'edit'), type: 'select', options: methodOpts,
      render: (val) => { const o = methodOpts.find(x => x.value === normalizeMethod(String(val || ''))); return <Badge variant="outline" className="text-[9px] uppercase bg-blue-500/10 text-blue-500 border-none">{o?.label||val||'-'}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<PaymentMade>) => {
    const updateToastId = toast.loading('Guardando cambios en el pago...');
    try {
      const payload = { ...updates } as any;
      if (payload.method) payload.method = normalizeMethod(payload.method);
      await paymentsService.update(id as string, payload);
      toast.success('Pago actualizado', { id: updateToastId });
      onRefresh();
    }
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar', { id: updateToastId }); throw new Error('Update failed'); }
  };

  const handleSaveDoc = async () => {
    if (!localDoc?.supplierId) return toast.error('Seleccione un proveedor');
    if (!localDoc?.amount || localDoc.amount <= 0) return toast.error('El monto debe ser mayor a 0');
    if (!isSupplierActive(localDoc.supplierId)) return toast.error('No se pueden registrar pagos a proveedores inactivos');
    
    const saveToastId = toast.loading(editingId === 'NEW' ? 'Registrando pago a proveedor...' : 'Guardando pago a proveedor...');
    try {
      const payload = {
        ...localDoc,
        method: normalizeMethod(localDoc.method as any),
      } as any;
      if (isMixed) {
        const nioAmount = Number((localDoc as any).amountNio || 0);
        const usdAmount = Number((localDoc as any).amountUsd || 0);
        const rate = localDoc.exchangeRate || globalRate;
        payload.amount = nioAmount + (usdAmount * rate);
        payload.currency = 'NIO';
        payload.baseAmount = toBaseAmount(payload.amount, 'NIO', rate);
        payload.notes = [(localDoc.notes || ''), `Pago mixto: C$${nioAmount.toFixed(2)} + $${usdAmount.toFixed(2)} (TC ${rate})`].filter(Boolean).join(' | ');
        delete payload.amountNio;
        delete payload.amountUsd;
      }
      if (editingId === 'NEW') {
        const created = await paymentsService.create(payload);
        toast.success('Pago registrado exitosamente', { id: saveToastId });
      } else {
        await paymentsService.update(editingId!, payload);
        toast.success('Pago guardado', { id: saveToastId });
      }
      setEditingId(null);
      onRefresh();
    } catch (e: any) { 
        toast.error(e?.response?.data?.message || e?.message || 'Error al registrar', { id: saveToastId });
    }
  };

  const currentBills = bills.filter((b) => {
    if (!localDoc?.supplierId) return false;
    const sameSupplier = String(b.supplierId || '') === String(localDoc.supplierId || '');
    const isOpen = ['PENDING', 'PARTIAL'].includes(String(b.status || '').toUpperCase());
    return sameSupplier && isOpen;
  });

  if (editingId && localDoc) {
    const isNew = editingId === 'NEW';
    
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setEditingId(null)} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isNew ? 'Registrar Pago' : `Pago ${localDoc.reference}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Desembolsos y Abonos</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {!isNew && (
                <Button
                  variant="outline"
                  className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => generateExpensePDF({
                    expense: toExpensePayload(localDoc, suppliers.find((s) => s.id === localDoc.supplierId)?.name),
                    tenantName: user?.tenantName || 'Nova Hub',
                    targetKey: 'compras.payment-made',
                    formatAmount: (amount: number, currency?: string, rate?: number) =>
                      formatConvertedAmount(Number(amount || 0), currency || (localDoc.currency as any), rate || localDoc.exchangeRate),
                  })}
                >
                  <Download className="size-3 mr-2" /> Descargar PDF
                </Button>
              )}
             {!isNew && canPerform('PURCHASES_PAYMENTS', 'delete') && (
                 <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => { setPendingCancelId(editingId); setCancelReason(''); }}>
                  <Ban className="mr-2 size-3.5" /> Anular
                </Button>
             )}
            {((isNew && canPerform('PURCHASES_PAYMENTS', 'create') && canPerform('PURCHASES_PAYMENTS', 'approve')) || (!isNew && canPerform('PURCHASES_PAYMENTS', 'edit'))) && (
              <Button onClick={handleSaveDoc} className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6">
                Guardar Pago
              </Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50 col-span-2 md:col-span-1">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información del Pago</p>
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Proveedor</p>
                    <Combobox
                      disabled={isNew ? !canPerform('PURCHASES_PAYMENTS', 'create') : !canPerform('PURCHASES_PAYMENTS', 'edit')}
                      options={suppliers
                        .filter(s => (s.status || '').toUpperCase() === 'ACTIVE' || s.id === localDoc.supplierId)
                        .map(s => ({ label: s.name, value: s.id, description: (s.code ? `[${s.code}] ` : '') + (s.phone || 'Sin teléfono') }))}
                      value={localDoc.supplierId || ''}
                      onChange={(val) => setLocalDoc({ ...localDoc, supplierId: val, supplierInvoiceId: '' })}
                      placeholder="Seleccionar proveedor..."
                    />
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Factura a Pagar / Abono (Opcional)</p>
                    <Combobox
                      disabled={isNew ? !canPerform('PURCHASES_PAYMENTS', 'create') : !canPerform('PURCHASES_PAYMENTS', 'edit')}
                      options={currentBills.map(s => ({ label: `${s.number} (Total: ${s.total})`, value: s.id }))}
                      value={localDoc.supplierInvoiceId || ''}
                      onChange={(val) => {
                          const b = currentBills.find(x => x.id === val);
                          setLocalDoc({
                            ...localDoc,
                            supplierInvoiceId: val,
                            amount: b ? b.total : localDoc.amount,
                            currency: (b?.currency as any) || localDoc.currency || displayCurrency,
                            exchangeRate: b?.exchangeRate || localDoc.exchangeRate || globalRate,
                          });
                      }}
                      placeholder={localDoc.supplierId ? "Seleccionar factura abierta" : "Primero seleccione un proveedor"}
                      emptyMessage="No hay facturas abiertas para este proveedor."
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Fecha de Pago</p>
                    <Input 
                      disabled={isNew ? !canPerform('PURCHASES_PAYMENTS', 'create') : !canPerform('PURCHASES_PAYMENTS', 'edit')}
                      type="date" 
                      value={localDoc.date ? new Date(localDoc.date).toISOString().split('T')[0] : ''} 
                      onChange={(e) => setLocalDoc({ ...localDoc, date: new Date(e.target.value).toISOString() })} 
                      className="h-8 text-xs" 
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Método de Pago</p>
                    <select 
                      disabled={isNew ? !canPerform('PURCHASES_PAYMENTS', 'create') : !canPerform('PURCHASES_PAYMENTS', 'edit')}
                      value={normalizeMethod(localDoc.method as any)} 
                      onChange={(e) => setLocalDoc({ ...localDoc, method: e.target.value as any })}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs uppercase"
                    >
                      {methodOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Referencia / Transferencia #</p>
                    <Input 
                      disabled={isNew ? !canPerform('PURCHASES_PAYMENTS', 'create') : !canPerform('PURCHASES_PAYMENTS', 'edit')}
                      value={localDoc.reference || ''} 
                      onChange={(e) => setLocalDoc({ ...localDoc, reference: e.target.value })} 
                      className="h-8 text-xs font-mono" 
                      placeholder="Ej. TRANSF-001" 
                    />
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Notas ADicionales</p>
                    <Input 
                      disabled={isNew ? !canPerform('PURCHASES_PAYMENTS', 'create') : !canPerform('PURCHASES_PAYMENTS', 'edit')}
                      value={localDoc.notes || ''} 
                      onChange={(e) => setLocalDoc({ ...localDoc, notes: e.target.value })} 
                      className="h-8 text-xs" 
                      placeholder="Concepto interno..." 
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 flex flex-col justify-center h-full space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Monto Pagado</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isMixed} onChange={(e) => setIsMixed(e.target.checked)}
                    className="rounded border-border/50 accent-primary"
                    disabled={isNew ? !canPerform('PURCHASES_PAYMENTS', 'create') : !canPerform('PURCHASES_PAYMENTS', 'edit')} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Pago Mixto NIO+USD</span>
                </label>
              </div>
              <div className="space-y-4">
                {isMixed ? (
                  <>
                    <div className="flex items-end gap-3 border-b border-border/50 pb-4">
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground mb-1">Monto en NIO (C$)</p>
                        <Input
                          disabled={isNew ? !canPerform('PURCHASES_PAYMENTS', 'create') : !canPerform('PURCHASES_PAYMENTS', 'edit')}
                          type="number" min="0"
                          value={(localDoc as any).amountNio ?? ''}
                          onChange={(e) => setLocalDoc({ ...localDoc, ...({ amountNio: Number(e.target.value) } as any) })}
                          className="h-10 text-xl font-black tabular-nums text-right" placeholder="0.00" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground mb-1">Monto en USD ($)</p>
                        <Input
                          disabled={isNew ? !canPerform('PURCHASES_PAYMENTS', 'create') : !canPerform('PURCHASES_PAYMENTS', 'edit')}
                          type="number" min="0"
                          value={(localDoc as any).amountUsd ?? ''}
                          onChange={(e) => setLocalDoc({ ...localDoc, ...({ amountUsd: Number(e.target.value) } as any) })}
                          className="h-10 text-xl font-black tabular-nums text-right" placeholder="0.00" />
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-black uppercase text-xs tracking-widest">Tasa de Cambio</span>
                      <Input
                        disabled={isNew ? !canPerform('PURCHASES_PAYMENTS', 'create') : !canPerform('PURCHASES_PAYMENTS', 'edit')}
                        type="number" min="0" step="0.01"
                        value={localDoc.exchangeRate || globalRate}
                        onChange={(e) => setLocalDoc({ ...localDoc, exchangeRate: Number(e.target.value) })}
                        className="h-8 text-xs font-bold text-right w-28 tabular-nums" />
                    </div>
                    <div className="flex justify-between items-center text-base pt-2 border-t border-border/50">
                      <span className="font-black uppercase text-xs tracking-widest">Total en C$</span>
                      <span className="font-black text-lg text-primary tabular-nums">
                        C$ {(Number((localDoc as any).amountNio || 0) + Number((localDoc as any).amountUsd || 0) * (localDoc.exchangeRate || globalRate)).toLocaleString(undefined, {maximumFractionDigits:2})}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">Total en USD</span>
                      <span className="font-bold tabular-nums">
                        $ {(Number((localDoc as any).amountUsd || 0) + Number((localDoc as any).amountNio || 0) / (localDoc.exchangeRate || globalRate)).toLocaleString(undefined, {maximumFractionDigits:2})}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center text-sm border-b border-border/50 pb-4">
                      <div className="w-1/3">
                        <p className="text-[10px] text-muted-foreground mb-1">Moneda</p>
                        <select
                          disabled={isNew ? !canPerform('PURCHASES_PAYMENTS', 'create') : !canPerform('PURCHASES_PAYMENTS', 'edit')}
                          value={localDoc.currency || displayCurrency}
                          onChange={(e) => {
                            const newCurrency = e.target.value;
                            const rate = localDoc.exchangeRate || globalRate;
                            setLocalDoc({
                              ...localDoc,
                              currency: newCurrency as any,
                              exchangeRate: newCurrency === 'NIO' ? 1 : rate,
                            });
                          }}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase">
                          <option value="NIO">C$ (NIO)</option>
                          <option value="USD">$ (USD)</option>
                        </select>
                      </div>
                      <div className="w-1/4">
                        <p className="text-[10px] text-muted-foreground mb-1">T.C.</p>
                        <Input
                          disabled={isNew ? !canPerform('PURCHASES_PAYMENTS', 'create') : !canPerform('PURCHASES_PAYMENTS', 'edit') || localDoc.currency === 'NIO'}
                          type="number" min="0" step="0.01"
                          value={localDoc.exchangeRate || globalRate}
                          onChange={(e) => setLocalDoc({ ...localDoc, exchangeRate: Number(e.target.value) })}
                          className="h-8 text-xs font-bold text-right tabular-nums" />
                      </div>
                      <div className="w-1/3 flex flex-col items-end">
                        <p className="text-[10px] text-muted-foreground mb-1">Monto</p>
                        <Input
                          disabled={isNew ? !canPerform('PURCHASES_PAYMENTS', 'create') : !canPerform('PURCHASES_PAYMENTS', 'edit')}
                          type="number" min="0"
                          value={localDoc.amount || ''}
                          onChange={(e) => setLocalDoc({ ...localDoc, amount: Number(e.target.value) })}
                          className="h-10 text-xl font-black text-emerald-500 text-right w-full tabular-nums"
                          placeholder="0.00" />
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-base pt-2">
                      <span className="font-black uppercase text-xs tracking-widest">Base Estimada</span>
                      <span className="font-black text-muted-foreground tabular-nums text-right">
                        {localDoc.currency === 'USD'
                          ? `C$ ${(Number(localDoc.amount || 0) * (localDoc.exchangeRate || globalRate)).toLocaleString()}`
                          : `$ ${(Number(localDoc.amount || 0) / (localDoc.exchangeRate || globalRate)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const toDisplayAmount = (amount: number, currency?: string, rate?: number) => valuationMode === 'CURRENT'
    ? convertCurrentAmount(amount, currency)
    : convertAmount(amount, currency, rate || globalRate);
  const paidTotalInDisplayCurrency = data.reduce(
    (acc, payment) => acc + toDisplayAmount(Number(payment.amount ?? payment.baseAmount ?? 0), payment.currency, payment.exchangeRate),
    0,
  );

  const kpis = [
    { title: 'Transacciones',   value: data.length,                   icon: Hash,         color: 'text-blue-500',   bg: 'bg-blue-500/10'    },
    {
      title: `Pagos Realizados (${displayCurrency}${valuationModeSuffix})`,
      value: formatCurrentAmount(paidTotalInDisplayCurrency, displayCurrency),
      icon: TrendingDown,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
    },
    { title: 'Conciliados',     value: data.length,                   icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="purchases-list-kpis">
        {kpis.map((k, i) => (
          <PurchaseKpiCard key={i} title={k.title} value={k.value} icon={k.icon} color={k.color} bg={k.bg} kind="indicator" />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight" data-tour="purchases-list-title">Pagos Realizados</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Desembolsos a proveedores</p></div>
          <div className="flex flex-wrap items-center justify-end gap-3" data-tour="purchases-list-actions">
            <PurchaseViewTutorial view="payments" />
            <ViewLayoutSelect value={layoutMode} onChange={setLayoutMode} ariaLabel="Elegir distribución de pagos a proveedores" />
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }} /></div>
             {canPerform('PURCHASES_PAYMENTS', 'create') && canPerform('PURCHASES_PAYMENTS', 'approve') && (
               <Button onClick={() => setEditingId('NEW')} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Registrar Pago</Button>
             )}
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} pagination={pagination} layoutMode={layoutMode} highlightedRowId={highlightedTargetId} bulkAction="cancel"
          onBulkDelete={canPerform('PURCHASES_PAYMENTS', 'delete') ? async (ids) => {
            const cancelToastId = toast.loading(`Anulando ${ids.length} pago${ids.length === 1 ? '' : 's'}...`);
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await paymentsService.cancel(id as string, 'Anulación masiva');
              }
              toast.success('Pagos anulados', { id: cancelToastId });
              onRefresh();
            } catch (e: any) {
              toast.error(e?.response?.data?.message || e?.message || 'Error al anular', { id: cancelToastId });
            }
          } : undefined}
           actions={(row) => (
              <div className="flex gap-1">
               <Button
                 title="Descargar PDF"
                 variant="ghost"
                 size="icon"
                 className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                 onClick={() => void (async () => {
                   const pdfToastId = toast.loading('Generando comprobante de pago...');
                   try {
                     await generateExpensePDF({
                       expense: toExpensePayload(row, row.supplier?.name),
                       tenantName: user?.tenantName || 'Nova Hub',
                       targetKey: 'compras.payment-made',
                       formatAmount: (amount: number, currency?: string, rate?: number) =>
                         formatConvertedAmount(Number(amount || 0), currency || row.currency, rate || row.exchangeRate),
                     });
                     toast.success('Comprobante generado', { id: pdfToastId });
                   } catch (error: any) {
                     toast.error(error?.message || 'No se pudo generar el comprobante', { id: pdfToastId });
                   }
                 })()}
               >
                 <FileDown className="size-4" />
               </Button>
                <Button title={canPerform('PURCHASES_PAYMENTS', 'edit') ? "Editar" : "Ver"} variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setEditingId(row.id)}>{canPerform('PURCHASES_PAYMENTS', 'edit') ? <Pencil className="size-4" /> : <Eye className="size-4" />}</Button>
               <PurchaseAuditButton entity="PAYMENT_MADE" entityId={row.id} title="Auditoria del Pago" />
               {canPerform('PURCHASES_PAYMENTS', 'delete') && (
                <Button title="Anular pago" aria-label="Anular pago" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={() => { setPendingCancelId(row.id); setCancelReason(''); }}><Ban className="size-4" /></Button>
              )}
            </div>
          )}
        />
      </div>
      <ConfirmDialog
        open={pendingCancelId !== null}
        onOpenChange={(open) => { if (!open) { setPendingCancelId(null); setCancelReason(''); } }}
        title="¿Anular pago?"
        description="El pago quedará anulado y se revertirá el saldo del proveedor y la factura asociada. Esta acción no se puede deshacer."
        confirmLabel="Anular Pago"
        variant="destructive"
        loading={cancelLoading}
        disabled={!cancelReason.trim()}
        onConfirm={async () => {
          if (!pendingCancelId || !cancelReason.trim()) return;
          const cancelToastId = toast.loading('Anulando pago a proveedor...');
          try {
            setCancelLoading(true);
            await paymentsService.cancel(pendingCancelId, cancelReason.trim());
            toast.success('Pago anulado', { id: cancelToastId });
            setEditingId(null);
            onRefresh();
          } catch (e: any) {
            toast.error(e?.response?.data?.message || e?.message || 'Error al anular', { id: cancelToastId });
          } finally {
            setCancelLoading(false);
            setPendingCancelId(null);
            setCancelReason('');
          }
        }}
      >
        <div className="mt-4">
          <label className="text-sm font-medium text-foreground mb-1 block">Motivo de anulación *</label>
          <textarea
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
            rows={3}
            placeholder="Ej: Pago duplicado, error en monto..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}

