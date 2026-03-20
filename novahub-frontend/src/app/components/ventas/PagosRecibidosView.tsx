import React, { useState } from 'react';
import { 
  CreditCard, Plus, Search, TrendingUp, Clock, CheckCircle2, Wallet, Eye, Trash2, ChevronLeft
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { paymentsService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import type { PaymentReceived, Customer, Invoice } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { useCurrency } from '../../contexts/CurrencyContext';

interface PagosRecibidosViewProps {
  data: PaymentReceived[];
  loading: boolean;
  onRefresh: () => void;
  customers?: Customer[];
  invoices?: Invoice[];
}

const methodOptions = [
  { label: 'Transferencia', value: 'TRANSFER', color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Efectivo',      value: 'CASH',     color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Tarjeta',       value: 'CARD',     color: 'bg-purple-500/10 text-purple-500' },
  { label: 'Cheque',        value: 'CHECK',    color: 'bg-amber-500/10 text-amber-500' },
];

export function PagosRecibidosView({ data, loading, onRefresh, customers = [], invoices = [] }: PagosRecibidosViewProps) {
  const { exchangeRate: globalRate } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [localDoc, setLocalDoc] = useState<any>(null);

  const filtered = data.filter(p => 
    p.number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.invoice?.number || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdate = async (id: string | number, updates: Partial<PaymentReceived>) => {
    try {
      await paymentsService.update(id.toString(), updates);
      toast.success('Pago actualizado');
      onRefresh();
    } catch (error) {
      toast.error('Error al actualizar');
      throw error;
    }
  };

  const startNew = () => {
    setIsCreating(true);
    setLocalDoc({
      customerId: '',
      invoiceId: '',
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      currency: 'NIO',
      exchangeRate: globalRate,
      method: 'TRANSFER',
      reference: '',
      notes: '',
    });
  };

  const handleSave = async () => {
    if (!localDoc) return;
    if (!localDoc.customerId) { toast.error('Selecciona un cliente'); return; }
    if (Number(localDoc.amount) <= 0) { toast.error('El monto debe ser mayor a 0'); return; }
    try {
      await paymentsService.create({
        customerId: localDoc.customerId,
        invoiceId: localDoc.invoiceId || undefined,
        date: new Date(localDoc.date).toISOString(),
        amount: Number(localDoc.amount),
        currency: localDoc.currency,
        exchangeRate: localDoc.exchangeRate || globalRate,
        method: localDoc.method,
        reference: localDoc.reference || undefined,
        notes: localDoc.notes || undefined,
      } as any);
      toast.success('Pago registrado exitosamente');
      setIsCreating(false); setLocalDoc(null); onRefresh();
    } catch { toast.error('Error al registrar pago'); }
  };

  // Invoices filtered by selected customer
  const customerInvoices = localDoc?.customerId
    ? invoices.filter(i => i.customerId === localDoc.customerId && ['PENDING', 'PARTIAL', 'OVERDUE'].includes((i.status || '').toUpperCase()))
    : [];

  const columns: ColumnDef<PaymentReceived>[] = [
    { key: 'number', header: 'ID Pago', width: '120px', render: (val) => <span className="text-[11px] font-black font-mono text-muted-foreground/60">{val}</span> },
    { key: 'customer', header: 'Cliente', render: (val, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Cliente'}</span> },
    { key: 'reference', header: 'Referencia / Factura', render: (val, row) => <span className="text-xs font-bold text-primary">{row.invoice?.number || val || 'Anticipo'}</span> },
    { key: 'date', header: 'Fecha', render: (val) => <span className="text-xs font-medium text-muted-foreground">{new Date(val).toLocaleDateString()}</span> },
    { key: 'amount', header: 'Monto', width: '150px', render: (val, row) => (
      <span className="text-[13px] font-black tabular-nums text-emerald-500">
        {row.currency === 'NIO' ? `C$ ${Number(val||0).toLocaleString()}` : `$ ${Number(val||0).toLocaleString()}`}
      </span>) },
    { key: 'method', header: 'Método', width: '120px', editable: true, type: 'select', options: methodOptions,
      render: (val) => { const methodMap: Record<string,string> = { TRANSFER:'Transferencia', CASH:'Efectivo', CARD:'Tarjeta', CHECK:'Cheque' };
        return <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none bg-blue-500/10 text-blue-500">{methodMap[(val||'').toUpperCase()] || val}</Badge>; } },
  ];

  const mainMethod = data.length > 0
    ? Object.entries(data.reduce((acc, p) => { const m = (p.method||'TRANSFER').toUpperCase(); acc[m] = (acc[m]||0)+1; return acc; }, {} as Record<string,number>))
        .sort(([,a],[,b]) => b-a)[0]?.[0] || 'N/A'
    : 'N/A';

  const kpis = [
    { title: 'Total Recaudado (NIO)', value: `C$ ${data.reduce((acc, p) => acc + (p.baseAmount || (p.currency === 'USD' ? p.amount * globalRate : p.amount)), 0).toLocaleString()}`, icon: TrendingUp,  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Pagos',           value: data.length,                                                                   icon: CheckCircle2, color: 'text-blue-500',    bg: 'bg-blue-500/10'   },
    { title: 'Con Factura',     value: data.filter(p => p.invoice?.number).length,                                    icon: Clock,        color: 'text-amber-500',  bg: 'bg-amber-500/10'  },
    { title: 'Método Principal', value: mainMethod,                                                                  icon: Wallet,       color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

  // ─── INLINE FORM ────────────────────────────────────────────────────
  if (isCreating && localDoc) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => { setIsCreating(false); setLocalDoc(null); }} className="rounded-full"><ChevronLeft className="size-5" /></Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Registrar Pago</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Completar datos del pago recibido</p>
            </div>
          </div>
          <Button className="rounded-xl bg-emerald-500 shadow-xl shadow-emerald-500/20 text-white font-black uppercase text-[10px] tracking-widest px-6" onClick={handleSave}>
            Confirmar Pago
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información del Pago</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-[10px] text-muted-foreground mb-1">Cliente</p>
                  <Combobox options={customers.map(c => ({ label: c.name, value: c.id }))} value={localDoc.customerId} onChange={(val) => setLocalDoc({ ...localDoc, customerId: val, invoiceId: '' })} placeholder="Seleccionar Cliente" /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Factura (Opcional)</p>
                  <Combobox options={customerInvoices.map(i => ({ label: `${i.number} — ${i.currency === 'NIO' ? 'C$' : '$'} ${Number(i.balance||0).toLocaleString()} pend.`, value: i.id }))} 
                    value={localDoc.invoiceId} onChange={(val) => {
                      const inv = invoices.find(i => i.id === val);
                      setLocalDoc({ ...localDoc, invoiceId: val, amount: inv ? Number(inv.balance || 0) : localDoc.amount });
                    }} placeholder="Sin factura (anticipo)" /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Fecha</p>
                  <Input type="date" value={localDoc.date} onChange={(e) => setLocalDoc({ ...localDoc, date: e.target.value })} className="h-8 text-xs" /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Método de Pago</p>
                  <select value={localDoc.method} onChange={(e) => setLocalDoc({ ...localDoc, method: e.target.value })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase">
                    {methodOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Moneda</p>
                  <select value={localDoc.currency} onChange={(e) => setLocalDoc({ ...localDoc, currency: e.target.value })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase">
                    <option value="NIO">NIO</option><option value="USD">USD</option>
                  </select></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Referencia Bancaria</p>
                  <Input value={localDoc.reference} onChange={(e) => setLocalDoc({ ...localDoc, reference: e.target.value })} className="h-8 text-xs" placeholder="Nº transferencia, cheque..." /></div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Monto</p>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-2">Monto del Pago</p>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-muted-foreground">{localDoc.currency === 'USD' ? '$' : 'C$'}</span>
                    <Input type="number" min="0" step="0.01" value={localDoc.amount || ''} onChange={(e) => setLocalDoc({ ...localDoc, amount: Number(e.target.value) })}
                      className="h-12 text-2xl font-black text-emerald-500 text-right" placeholder="0.00" />
                  </div>
                  {localDoc.currency === 'USD' && <p className="text-[10px] font-bold text-muted-foreground mt-2 italic">≈ C$ {(Number(localDoc.amount || 0) * globalRate).toLocaleString()}</p>}
                  {localDoc.currency === 'NIO' && Number(localDoc.amount) > 0 && <p className="text-[10px] font-bold text-muted-foreground mt-2 italic">≈ $ {(Number(localDoc.amount || 0) / globalRate).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Notas</p>
                  <textarea value={localDoc.notes} onChange={(e) => setLocalDoc({ ...localDoc, notes: e.target.value })}
                    className="w-full h-16 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" placeholder="Notas del pago..." />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── TABLE VIEW ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden relative group">
            <CardContent className="p-5"><div className="flex items-center gap-4"><div className={cn("p-3 rounded-xl shadow-inner", kpi.bg, kpi.color)}><kpi.icon className="size-5" /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.title}</p><p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">{kpi.value}</p></div></div></CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
          <div><h2 className="text-xl font-black uppercase tracking-tight text-foreground">Pagos Recibidos</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Historial de cobranza y conciliación de ingresos.</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input placeholder="Buscar pago..." className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold uppercase tracking-widest" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
            <Button onClick={startNew} className="bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-emerald-500/20 border border-emerald-500/20">
              <Plus className="size-4" /> Registrar Pago</Button>
          </div>
        </div>
        <EditableDataTable data={filtered}
          onBulkDelete={async (ids) => { try { for (const id of ids) { if (String(id).startsWith('new-')) continue; await paymentsService.delete(id as string); } toast.success('Eliminados'); onRefresh(); } catch { toast.error('Error al eliminar'); } }}
          columns={columns} onRowUpdate={handleUpdate} isLoading={loading}
          actions={(row) => (
            <div className="flex items-center gap-1">
               <Button title="Ver detalle" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"><Eye className="size-4" /></Button>
               <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 transition-colors" onClick={async () => { await paymentsService.delete(row.id); onRefresh(); }}><Trash2 className="size-4" /></Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
