import { useState, useEffect } from 'react';
import { Plus, Search, Eye, CheckCircle2, TrendingDown, Hash, ChevronLeft, Trash2, Download } from 'lucide-react';
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
import { generateExpensePDF } from '../../utils/pdfGenerator';

interface Props {
  data: PaymentMade[];
  loading: boolean;
  onRefresh: () => void;
  draftPaymentFromInvoice?: Partial<PaymentMade> | null;
  onDraftConsumed?: () => void;
}

const methodOpts = [
  { label: 'Transferencia', value: 'transfer' },
  { label: 'Efectivo',      value: 'cash' },
  { label: 'Cheque',        value: 'check' },
  { label: 'Tarjeta',       value: 'card' },
];

export function PagosRealizadosView({ data, loading, onRefresh, draftPaymentFromInvoice, onDraftConsumed }: Props) {
  const { canPerform, user } = useAuth();
  const { exchangeRate: globalRate, displayCurrency, formatConvertedAmount, convertAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [bills, setBills] = useState<SupplierInvoice[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<PaymentMade> | null>(null);

  useEffect(() => {
    suppliersService.getAll().then(res => {
      const list = Array.isArray(res) ? res : (res as any).data || [];
      setSuppliers(list);
    }).catch();
    billsService.getAll().then(res => setBills(res.data || [])).catch();
  }, []);

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
           currency: displayCurrency,
           exchangeRate: globalRate,
           method: (prefilled.method as any) || 'transfer',
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

  useEffect(() => {
    if (editingId === 'NEW') {
      setLocalDoc((prev) => (prev ? { ...prev, currency: displayCurrency, exchangeRate: globalRate } : prev));
    }
  }, [displayCurrency, globalRate, editingId]);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const getMethodLabel = (method?: string) => methodOpts.find((opt) => opt.value === String(method || '').toLowerCase())?.label || method || '-';
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
    { key: 'reference', header: 'Referencia', width: '130px', editable: canPerform('compras', 'edit') },
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
    { key: 'method',    header: 'Método',     width: '120px', editable: canPerform('compras', 'edit'), type: 'select', options: methodOpts,
      render: (val) => { const o = methodOpts.find(x => x.value === (val||'').toLowerCase()); return <Badge variant="outline" className="text-[9px] uppercase bg-blue-500/10 text-blue-500 border-none">{o?.label||val||'-'}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<PaymentMade>) => {
    try { await paymentsService.update(id as string, updates); toast.success('Pago actualizado'); onRefresh(); }
    catch { toast.error('Error al actualizar'); throw new Error('Update failed'); }
  };

  const handleSaveDoc = async () => {
    if (!localDoc?.supplierId) return toast.error('Seleccione un proveedor');
    if (!localDoc?.amount || localDoc.amount <= 0) return toast.error('El monto debe ser mayor a 0');
    if (!isSupplierActive(localDoc.supplierId)) return toast.error('No se pueden registrar pagos a proveedores inactivos');
    
    try {
      if (editingId === 'NEW') {
        await paymentsService.create(localDoc as any);
        toast.success('Pago registrado exitosamente');
      } else {
        await paymentsService.update(editingId!, localDoc as any);
        toast.success('Pago guardado');
      }
      setEditingId(null);
      onRefresh();
    } catch (e: any) { 
        toast.error('Error al registrar: ' + (e.response?.data?.message || 'Error')); 
    }
  };

  const currentBills = bills.filter(b => b.supplierId === localDoc?.supplierId && ['PENDING', 'PARTIAL'].includes((b.status||'').toUpperCase()));

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
                    formatAmount: (amount: number, currency?: string, rate?: number) =>
                      formatConvertedAmount(Number(amount || 0), currency || (localDoc.currency as any), rate || localDoc.exchangeRate),
                  })}
                >
                  <Download className="size-3 mr-2" /> Descargar PDF
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Proveedor</p>
                    <Combobox
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
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
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                      options={currentBills.map(s => ({ label: `${s.number} (Total: ${s.total})`, value: s.id }))}
                      value={localDoc.supplierInvoiceId || ''}
                      onChange={(val) => {
                          const b = currentBills.find(x => x.id === val);
                          setLocalDoc({ ...localDoc, supplierInvoiceId: val, amount: b ? b.total : localDoc.amount });
                      }}
                      placeholder={localDoc.supplierId ? "Seleccionar factura abierta" : "Primero seleccione un proveedor"}
                      emptyMessage="No hay facturas abiertas para este proveedor."
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Fecha de Pago</p>
                    <Input 
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                      type="date" 
                      value={localDoc.date ? new Date(localDoc.date).toISOString().split('T')[0] : ''} 
                      onChange={(e) => setLocalDoc({ ...localDoc, date: new Date(e.target.value).toISOString() })} 
                      className="h-8 text-xs" 
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Método de Pago</p>
                    <select 
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                      value={localDoc.method || 'transfer'} 
                      onChange={(e) => setLocalDoc({ ...localDoc, method: e.target.value as any })}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs uppercase"
                    >
                      {methodOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Referencia / Transferencia #</p>
                    <Input 
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                      value={localDoc.reference || ''} 
                      onChange={(e) => setLocalDoc({ ...localDoc, reference: e.target.value })} 
                      className="h-8 text-xs font-mono" 
                      placeholder="Ej. TRANSF-001" 
                    />
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Notas ADicionales</p>
                    <Input 
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
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
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Monto Pagado</p>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm border-b border-border/50 pb-4">
                   <div className="w-1/2">
                      <p className="text-[10px] text-muted-foreground mb-1">Moneda de Pago</p>
                        <select 
                          disabled
                          value={displayCurrency}
                          onChange={(e) => setLocalDoc({ ...localDoc, currency: e.target.value as any, exchangeRate: globalRate })}
                          className="h-8 w-full max-w-[120px] rounded-md border border-input bg-background px-2 text-xs font-bold uppercase"
                        >
                        <option value={displayCurrency}>{displayCurrency}</option>
                       </select>
                    </div>
                   <div className="w-1/2 flex flex-col items-end">
                      <p className="text-[10px] text-muted-foreground mb-1">Monto de Salida</p>
                      <Input 
                        disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                        type="number" 
                        min="0" 
                        value={localDoc.amount || ''} 
                        onChange={(e) => setLocalDoc({ ...localDoc, amount: Number(e.target.value) })} 
                        className="h-10 text-xl font-black text-emerald-500 text-right w-full max-w-[150px]" 
                        placeholder="0.00" 
                      />
                   </div>
                </div>
                
                <div className="flex justify-between items-center text-base pt-2">
                  <span className="font-black uppercase text-xs tracking-widest">Base Estimada</span>
                  <span className="font-black text-muted-foreground tabular-nums text-right">
                     {localDoc.currency === 'USD' ? `C$ ${(Number(localDoc.amount||0) * (localDoc.exchangeRate || globalRate)).toLocaleString()}` : `$ ${(Number(localDoc.amount||0) / (localDoc.exchangeRate || globalRate)).toLocaleString(undefined, {maximumFractionDigits:2})}`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const paidTotalInDisplayCurrency = data.reduce(
    (acc, payment) => acc + convertAmount(payment.amount || 0, payment.currency, payment.exchangeRate),
    0,
  );

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
          <div><h2 className="text-xl font-black uppercase tracking-tight">Pagos Realizados</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Desembolsos a proveedores</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
             {canPerform('compras', 'create') && (
               <Button onClick={() => setEditingId('NEW')} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Registrar Pago</Button>
             )}
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading}
          onBulkDelete={canPerform('compras', 'delete') ? async (ids) => {
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await paymentsService.delete(id as string);
              }
              toast.success('Elementos eliminados');
              onRefresh();
            } catch (e) {
              toast.error('Error al eliminar');
            }
          } : undefined}
           actions={(row) => (
              <div className="flex gap-1">
               <Button
                 title="Descargar PDF"
                 variant="ghost"
                 size="icon"
                 className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                 onClick={() => generateExpensePDF({
                   expense: toExpensePayload(row, row.supplier?.name),
                   tenantName: user?.tenantName || 'Nova Hub',
                   formatAmount: (amount: number, currency?: string, rate?: number) =>
                     formatConvertedAmount(Number(amount || 0), currency || row.currency, rate || row.exchangeRate),
                 })}
               >
                 <Download className="size-4" />
               </Button>
               <Button title={canPerform('compras', 'edit') ? "Editar" : "Ver"} variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
              {canPerform('compras', 'delete') && (
                <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={async () => { await paymentsService.delete(row.id); onRefresh(); }}><Trash2 className="size-4" /></Button>
              )}
            </div>
          )}
        />
      </div>
    </div>
  );
}
