import { useState, useEffect } from 'react';
import { Plus, Search, Eye, CheckCircle2, TrendingDown, Hash, ChevronLeft, Trash2, Download, Clock, CircleDollarSign } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { paymentsService, suppliersService, billsService } from '../../services/compras.service';
import type { PaymentMade, Supplier, SupplierInvoice } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { generateExpensePDF } from '../../utils/pdfGenerator';

interface Props {
  data: PaymentMade[];
  loading: boolean;
  onRefresh: () => void;
  supplierInvoices?: SupplierInvoice[];
  draftPaymentFromInvoice?: Partial<PaymentMade> | null;
  onDraftConsumed?: () => void;
}

const methodOpts = [
  { label: 'Transferencia', value: 'TRANSFER' },
  { label: 'Efectivo',      value: 'CASH' },
  { label: 'Cheque',        value: 'CHECK' },
  { label: 'Tarjeta',       value: 'CARD' },
];

export function PagosRealizadosView({ data, loading, onRefresh, supplierInvoices = [], draftPaymentFromInvoice, onDraftConsumed }: Props) {
  const { canPerform, user } = useAuth();
  const { themeConfig } = useTheme();
  const { exchangeRate: globalRate, displayCurrency, formatConvertedAmount, convertAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [bills, setBills] = useState<SupplierInvoice[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<PaymentMade> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const normalizeMethod = (method?: string): 'CASH' | 'TRANSFER' | 'CHECK' | 'CARD' | 'OTHER' => {
    const normalized = String(method || 'TRANSFER').toUpperCase();
    if (['CASH', 'TRANSFER', 'CHECK', 'CARD', 'OTHER'].includes(normalized)) {
      return normalized as 'CASH' | 'TRANSFER' | 'CHECK' | 'CARD' | 'OTHER';
    }
    return 'TRANSFER';
  };

  useEffect(() => {
    suppliersService.getAll().then(res => {
      const list = Array.isArray(res) ? res : (res as any).data || [];
      setSuppliers(list);
    }).catch();
    billsService.getAll().then(res => {
      const list = Array.isArray(res) ? res : (res as any).data || [];
      setBills(list);
    }).catch();
  }, []);

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
  }, [editingId, data, globalRate, displayCurrency, draftPaymentFromInvoice, onDraftConsumed]);

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

  const columns: ColumnDef<PaymentMade>[] = [
    { 
      key: 'reference', header: 'Referencia', width: '130px', 
      render: (val, row) => {
        const isUUID = val && /SC-[0-9a-f]{8}-[0-9a-f]{4}/i.test(val);
        const displayVal = isUUID ? 'Crédito Proveedor' : (val || '-');
        return (
          <div className="flex flex-col">
            <span className="text-xs font-bold text-rose-500">{displayVal}</span>
            {row.notes && row.notes.includes('Crédito') && (
              <span className="text-[9px] text-muted-foreground/60 italic truncate max-w-[120px]">{row.notes}</span>
            )}
          </div>
        );
      }
    },
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
        <span className="font-black tabular-nums text-emerald-500">
          {formatConvertedAmount(Number(val || 0), row.currency, row.exchangeRate)}
        </span>
      ) },
    { key: 'method',    header: 'Método',     width: '120px',
      render: (val) => { const o = methodOpts.find(x => x.value === normalizeMethod(String(val || ''))); return <Badge variant="outline" className="text-[9px] uppercase bg-blue-500/10 text-blue-500 border-none">{o?.label||val||'-'}</Badge>; } },
  ];

  const syncLinkedInvoiceStatus = async (paymentDraft: Partial<PaymentMade>, paymentIdToUpsert?: string) => {
    const invoiceId = String(paymentDraft.supplierInvoiceId || '');
    if (!invoiceId) return;

    const [invoiceResponse, paymentsResponse] = await Promise.all([
      billsService.getById(invoiceId),
      paymentsService.getAll(),
    ]);
    const invoice = (invoiceResponse as any)?.data || invoiceResponse;
    const allPayments = ((paymentsResponse as any)?.data || []) as PaymentMade[];

    const paymentsForInvoice = allPayments.filter((payment) => String(payment.supplierInvoiceId || '') === invoiceId);
    const nextAmount = Number(paymentDraft.amount || 0);
    const nextPaymentEntry = {
      id: paymentIdToUpsert || `draft-${Date.now()}`,
      supplierInvoiceId: invoiceId,
      amount: nextAmount,
    };

    const mergedPayments = paymentIdToUpsert
      ? (() => {
          const replaced = paymentsForInvoice.map((payment) =>
            String(payment.id) === String(paymentIdToUpsert) ? ({ ...payment, ...nextPaymentEntry } as any) : payment,
          );
          const exists = replaced.some((payment) => String(payment.id) === String(paymentIdToUpsert));
          return exists ? replaced : [...replaced, nextPaymentEntry as any];
        })()
      : [...paymentsForInvoice, nextPaymentEntry as any];

    const totalPaid = mergedPayments.reduce((acc, payment: any) => acc + Number(payment.amount || 0), 0);
    const invoiceTotal = Number(invoice?.total || 0);
    const nextAmountPaid = Math.min(invoiceTotal, totalPaid);
    const nextBalance = Math.max(invoiceTotal - nextAmountPaid, 0);
    const nextStatus = nextAmountPaid <= 0 ? 'PENDING' : nextBalance <= 0 ? 'PAID' : 'PARTIAL';

    await billsService.update(invoiceId, {
      amountPaid: nextAmountPaid,
      balance: nextBalance,
      status: nextStatus as any,
    } as any);
  };

  const isSupplierActive = (supplierId?: string) =>
    !!supplierId && (suppliers.find((s) => s.id === supplierId)?.status || '').toUpperCase() === 'ACTIVE';

  const handleUpdate = async (id: string | number, updates: Partial<PaymentMade>) => {
    try {
      const payload = { ...updates } as any;
      if (payload.method) payload.method = normalizeMethod(payload.method);
      await paymentsService.update(id as string, payload);
      const updatedPayment = {
        ...(data.find((p) => p.id === id) || {}),
        ...payload,
      } as Partial<PaymentMade>;
      if (updatedPayment.supplierInvoiceId && Number(updatedPayment.amount || 0) > 0) {
        await syncLinkedInvoiceStatus(updatedPayment, String(id));
      }
      toast.success('Pago actualizado');
      onRefresh();
    }
    catch { toast.error('Error al actualizar'); throw new Error('Update failed'); }
  };

  const handleSaveDoc = async () => {
    if (!localDoc?.supplierId) return toast.error('Seleccione un proveedor');
    if (!localDoc?.amount || localDoc.amount <= 0) return toast.error('El monto debe ser mayor a 0');
    if (!isSupplierActive(localDoc.supplierId)) return toast.error('No se pueden registrar pagos a proveedores inactivos');
    
    try {
      setIsSaving(true);
      const payload = {
        ...localDoc,
        method: normalizeMethod(localDoc.method as any),
      } as any;
      if (editingId === 'NEW') {
        const created = await paymentsService.create(payload);
        const createdPayment = (created as any)?.data || created;
        if (payload.supplierInvoiceId) {
          try {
            await syncLinkedInvoiceStatus(
              { ...payload, id: createdPayment?.id || createdPayment?.number },
              String(createdPayment?.id || ''),
            );
          } catch (syncError: any) {
             console.error(syncError);
          }
        }
        toast.success('Pago registrado');
      } else {
        await paymentsService.update(editingId!, payload);
        if (payload.supplierInvoiceId) {
          try {
            await syncLinkedInvoiceStatus({ ...payload, id: editingId }, String(editingId));
          } catch (syncError: any) {
             console.error(syncError);
          }
        }
        toast.success('Pago guardado');
      }
      setEditingId(null);
      onRefresh();
    } catch (e: any) { 
        toast.error('Error al registrar: ' + (e.response?.data?.message || 'Error')); 
    } finally {
      setIsSaving(false);
    }
  };

  const currentBills = bills.filter((b) => {
    if (!localDoc?.supplierId) return false;
    const sameSupplier = String(b.supplierId || '') === String(localDoc.supplierId || '');
    const isOpen = ['PENDING', 'PARTIAL'].includes(String(b.status || '').toUpperCase());
    return sameSupplier && isOpen;
  });

  const paidTotalInDisplayCurrency = data.reduce(
    (acc, payment) => acc + convertAmount(payment.amount || 0, payment.currency, payment.exchangeRate),
    0,
  );

  const todayStr = new Date().toLocaleDateString();
  const kpis = [
    { title: 'Transacciones',   value: data.length,                   icon: Hash,         color: 'text-blue-500',   bg: 'bg-blue-500/10'    },
    {
      title: `Pagos Realizados (${displayCurrency})`,
      value: `${displayCurrency === 'USD' ? '$' : 'C$'} ${paidTotalInDisplayCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      icon: TrendingDown,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
    },
    { title: 'Conciliados',     value: data.length,                   icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Pagos Hoy',       value: data.filter(p => p.date && new Date(p.date).toLocaleDateString() === todayStr).length, icon: Clock, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

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
                    tenantName: user?.tenantName || 'Empresa',
                    tenantLogo: themeConfig?.logo,
                    formatAmount: (amount: number, currency?: string, rate?: number) =>
                      formatConvertedAmount(Number(amount || 0), currency || (localDoc.currency as any), rate || localDoc.exchangeRate),
                  })}
                >
                  <Download className="size-3 mr-2" /> PDF
                </Button>
              )}
             {!isNew && canPerform('compras', 'delete') && (
                <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={async () => {
                     if(confirm('¿Seguro que deseas eliminar este pago?')){
                         try { await paymentsService.delete(editingId); toast.success('Eliminado'); setEditingId(null); onRefresh(); } catch { toast.error('Error al eliminar'); }
                     }
                  }}>
                  <Trash2 className="size-3 mr-2" /> Eliminar
                </Button>
             )}
            {((isNew && canPerform('compras', 'create')) || (!isNew && canPerform('compras', 'edit'))) && (
              <Button 
                onClick={handleSaveDoc} 
                disabled={isSaving}
                className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6"
              >
                {isSaving ? 'Guardando...' : 'Guardar'}
              </Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50 col-span-2 md:col-span-1">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Proveedor</p>
                  <Combobox 
                    options={suppliers.map(s => ({ label: s.name, value: s.id }))}
                    value={localDoc.supplierId || ''}
                    onChange={(val) => setLocalDoc({ ...localDoc, supplierId: val, supplierInvoiceId: '' })}
                  />
                </div>
                <div className="md:col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Factura (Opcional)</p>
                  <Combobox 
                    options={currentBills.map(b => ({ label: b.number, value: b.id }))}
                    value={localDoc.supplierInvoiceId || ''}
                    onChange={(val) => {
                       const b = currentBills.find(x => x.id === val);
                       setLocalDoc({ ...localDoc, supplierInvoiceId: val, amount: b ? b.total : localDoc.amount });
                    }}
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha</p>
                  <Input type="date" value={localDoc.date ? new Date(localDoc.date).toISOString().split('T')[0] : ''} onChange={e => setLocalDoc({ ...localDoc, date: new Date(e.target.value).toISOString() })} className="h-9 text-xs font-bold" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Método</p>
                  <select value={normalizeMethod(localDoc.method as any)} onChange={e => setLocalDoc({ ...localDoc, method: e.target.value as any })} className="h-8 w-full rounded-md border text-xs">
                    {methodOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Monto</p>
              <Input type="number" value={localDoc.amount || ''} onChange={e => setLocalDoc({ ...localDoc, amount: Number(e.target.value) })} className="h-12 text-2xl font-black text-emerald-500" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Pagos Realizados</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 text-left">Control de desembolsos a proveedores</p>
          </div>
          {canPerform('compras', 'create') && (
            <Button onClick={() => setEditingId('NEW')} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6 h-10 rounded-xl gap-2 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
              <CircleDollarSign className="size-4" /> Nuevo Pago
            </Button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-muted/5 p-2 rounded-2xl border border-border/40">
           <div className="flex items-center gap-2 flex-1">
              <Badge variant="outline" className="h-9 px-4 rounded-xl border-border/50 bg-background/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                {data.length} Pagos Registrados
              </Badge>
           </div>
           
           <div className="relative w-full lg:w-72">
             <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
             <Input 
               placeholder="Buscar..." 
               className="pl-9 h-10 w-full bg-background border-border/50 rounded-xl text-xs focus:ring-primary/20" 
               value={searchTerm} 
               onChange={e => setSearchTerm(e.target.value)} 
             />
           </div>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
          <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} allowAddRow={false}
            onBulkDelete={canPerform('compras', 'delete') ? async (ids) => {
              try {
                for (const id of ids) {
                   if (String(id).startsWith('new-')) continue;
                   await paymentsService.delete(id as string);
                }
                toast.success('Eliminados');
                onRefresh();
              } catch { toast.error('Error al eliminar'); }
            } : undefined}
            actions={(row) => (
              <div className="flex gap-1">
                 <Button
                    title="Exportar PDF"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-lg text-slate-500 hover:bg-slate-500/10 hover:text-slate-500 transition-colors"
                    onClick={() => generateExpensePDF({
                      expense: toExpensePayload(row, row.supplier?.name),
                      tenantName: user?.tenantName || 'Empresa',
                      tenantLogo: themeConfig?.logo,
                      formatAmount: (amount: number, currency?: string, rate?: number) =>
                        formatConvertedAmount(Number(amount || 0), currency || row.currency, rate || row.exchangeRate),
                    })}
                  >
                    <Download className="size-4" />
                  </Button>
                <Button title="Ver detalle" variant="ghost" size="icon" className="size-8 rounded-lg text-primary hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
                {canPerform('compras', 'delete') && (
                   <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg text-rose-500 hover:bg-rose-500/10 hover:text-rose-500 transition-colors" onClick={async () => { if(confirm('¿Eliminar Pago?')) { await paymentsService.delete(row.id); onRefresh(); } }}><Trash2 className="size-4" /></Button>
                )}
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}
