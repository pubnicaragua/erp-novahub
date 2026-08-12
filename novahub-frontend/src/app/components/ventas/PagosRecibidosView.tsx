import { useEffect, useState } from 'react';
import {
  Plus, Search, TrendingUp, Clock, CheckCircle2, Wallet, Eye, Trash2, ChevronLeft, FileDown
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { paymentsService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { PaymentReceived, Customer, Invoice, CreditNote, SalesPaginationControls } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { AccountingAccountSelect } from '../ui/AccountingAccountSelect';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { generateEstimatePDF } from '../../utils/pdfGenerator';
import { formatSalesAmount } from '../../utils/salesPriceList';
import { SalesDateRangeFilter } from './SalesDateRangeFilter';
import { SalesViewTutorial } from './SalesViewTutorial';
import { SalesKpiCard } from './SalesKpiCard';
import { cn } from '../ui/utils';
import { PurchaseAlertsButton, type PurchaseAlertDetail } from '../compras/PurchaseAlertsButton';

interface PagosRecibidosViewProps {
  data: PaymentReceived[];
  loading: boolean;
  onRefresh: () => void;
  customers?: Customer[];
  invoices?: Invoice[];
  credits?: CreditNote[];
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateRangeChange?: (dateFrom: string, dateTo: string) => void;
  salesAlert?: PurchaseAlertDetail;
}

const methodOptions = [
  { label: 'Transferencia', value: 'TRANSFER', color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Efectivo', value: 'CASH', color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Tarjeta', value: 'CARD', color: 'bg-purple-500/10 text-purple-500' },
  { label: 'Cheque', value: 'CHECK', color: 'bg-amber-500/10 text-amber-500' },
];

export function PagosRecibidosView({ data, loading, onRefresh, customers = [], invoices = [], credits = [], pagination, onSearchChange, dateFrom = '', dateTo = '', onDateRangeChange, salesAlert }: PagosRecibidosViewProps) {
  const { exchangeRate: globalRate, displayCurrency, baseCurrency, formatConvertedAmount, toBaseAmount } = useCurrency();
  const { user, canPerform } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('sales-payments-layout', 'table', 24 * 365);
  const [invoiceFilter, setInvoiceFilter] = useState<'ALL' | 'WITH_INVOICE'>('ALL');
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [localDoc, setLocalDoc] = useState<any>(null);
  const [highlightedAlertId, setHighlightedAlertId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightedAlertId) return;
    const timeout = window.setTimeout(() => setHighlightedAlertId(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [highlightedAlertId]);

  const filtered = data.filter(p =>
    (invoiceFilter === 'ALL' || Boolean(p.invoice?.number || p.creditNote?.number)) &&
    (p.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.invoice?.number || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleUpdate = async (id: string | number, updates: Partial<PaymentReceived>) => {
    try {
      await paymentsService.update(id.toString(), updates);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar');
      throw e;
    }
  };

  const startNew = () => {
    setIsCreating(true);
    setLocalDoc({
      customerId: '',
      invoiceId: '',
      creditNoteId: '',
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      currency: displayCurrency === 'USD' ? 'USD' : 'NIO',
      exchangeRate: globalRate,
      method: 'TRANSFER',
      accountId: '',
      reference: '',
      notes: '',
    });
  };

  // Sync currency from topbar
  const handleSave = async () => {
    if (isCreating && (!canPerform('SALES_PAYMENTS', 'create') || !canPerform('SALES_PAYMENTS', 'approve'))) return;
    if (!localDoc) return;
    if (!localDoc.customerId) { toast.error('Selecciona un cliente'); return; }
    if (Number(localDoc.amount) <= 0) { toast.error('El monto debe ser mayor a 0'); return; }
    if (!localDoc.accountId) { toast.error('Selecciona la cuenta contable que recibirá el pago'); return; }
    const saveToastId = toast.loading('Registrando pago...');
    try {
      await paymentsService.create({
        customerId: localDoc.customerId,
        invoiceId: localDoc.invoiceId || undefined,
        creditNoteId: localDoc.creditNoteId || undefined,
        date: new Date(localDoc.date).toISOString(),
        amount: Number(localDoc.amount),
        currency: localDoc.currency,
        exchangeRate: localDoc.exchangeRate || globalRate,
        method: localDoc.method,
        accountId: localDoc.accountId,
        reference: localDoc.reference || undefined,
        notes: localDoc.notes || undefined,
      } as any);
      toast.success('Pago registrado', { id: saveToastId });
      setIsCreating(false); setLocalDoc(null); onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'No se pudo registrar el pago', { id: saveToastId }); }
  };

  const handleExportPDF = async (row: PaymentReceived) => {
    const pdfToastId = toast.loading('Generando comprobante de pago...');
    try {
      const tenantName = user?.tenantName || 'Mi Empresa';
      await generateEstimatePDF({
        estimate: { ...row, number: row.number, customer: row.customer, items: [{ description: `Pago ${row.method}`, quantity: 1, unitPrice: Number(row.amount), total: Number(row.amount) }] },
        tenantName,
        formatAmount: formatConvertedAmount,
        documentType: 'payment',
      });
      toast.success('PDF generado exitosamente', { id: pdfToastId });
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al generar PDF', { id: pdfToastId }); }
  };

  // Invoices filtered by selected customer
  const customerInvoices = localDoc?.customerId
    ? invoices.filter(i => i.customerId === localDoc.customerId && ['PENDING', 'PARTIAL', 'OVERDUE'].includes((i.status || '').toUpperCase()))
    : [];

  const columns: ColumnDef<PaymentReceived>[] = [
    { key: 'number', header: 'ID Pago', width: '120px', render: (val) => <span className="text-[11px] font-black font-mono text-muted-foreground/60">{val}</span> },
    { key: 'customer', header: 'Cliente', render: (_, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Cliente'}</span> },
    { key: 'reference', header: 'Referencia / Documento', render: (val, row) => <span className="text-xs font-bold text-primary">{row.invoice?.number || row.creditNote?.number || val || 'Anticipo'}</span> },
    {
      key: 'sourceType', header: 'Origen', width: '180px', render: (_val, row) => {
        if (row.creditNote?.number) return <Badge className="border-none bg-primary/10 px-2 py-0.5 text-[9px] font-black text-primary">Crédito</Badge>;
        if (!row.invoice?.number) return <span className="text-xs text-muted-foreground">Sin documento</span>;
        const isCashSale = String(row.sourceType || row.invoice.sourceType || '').toUpperCase() === 'CASH_SALE'
          || Boolean(row.invoice.registerId || row.invoice.sessionId);
        return (
          <Badge
            className={cn(
              'border-none px-2 py-0.5 text-[9px] font-black',
              isCashSale ? 'bg-cyan-500/10 text-cyan-500' : 'bg-orange-500/10 text-orange-500',
            )}
          >
            {isCashSale ? 'Facturación por caja' : 'Factura normal'}
          </Badge>
        );
      }
    },
    { key: 'date', header: 'Fecha', render: (val) => {
      if (!val) return <span className="text-xs text-muted-foreground">N/A</span>;
      const clean = String(val).includes('T') ? String(val).split('T')[0] : String(val);
      const [y, m, d] = clean.split('-').map(Number);
      return <span className="text-xs font-medium text-muted-foreground">{(!y||!m||!d) ? val : new Date(y, m-1, d).toLocaleDateString()}</span>;
    } },
    {
      key: 'amount', header: 'Monto', width: '150px', render: (val, row) => (
        <span className="text-[13px] font-black tabular-nums text-emerald-500">
          {formatConvertedAmount(Number(val || 0), row.currency, row.exchangeRate)}
        </span>)
    },
    {
      key: 'method', header: 'Método', width: '120px', editable: canPerform('SALES_PAYMENTS', 'edit'), type: 'select', options: methodOptions,
      render: (val) => {
        const methodMap: Record<string, string> = { TRANSFER: 'Transferencia', CASH: 'Efectivo', CARD: 'Tarjeta', CHECK: 'Cheque' };
        return <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none bg-blue-500/10 text-blue-500">{methodMap[(val || '').toUpperCase()] || val}</Badge>;
      }
    },
  ];

  const rawMainMethod = data.length > 0
    ? Object.entries(data.reduce((acc, p) => { const m = (p.method || 'TRANSFER').toUpperCase(); acc[m] = (acc[m] || 0) + 1; return acc; }, {} as Record<string, number>))
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A'
    : 'N/A';
  
  const mainMethodMap: Record<string, string> = { TRANSFER: 'Transferencia', CASH: 'Efectivo', CARD: 'Tarjeta', CHECK: 'Cheque', 'N/A': 'N/A' };
  const mainMethod = mainMethodMap[rawMainMethod] || rawMainMethod;

  const totalCollectedInDisplayCurrency = data.reduce(
    (acc, payment) => acc + (payment.baseAmount !== null && payment.baseAmount !== undefined
      ? Number(payment.baseAmount)
      : toBaseAmount(payment.amount || 0, payment.currency, payment.exchangeRate || globalRate)),
    0,
  );

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
          {canPerform('SALES_PAYMENTS', 'create') && canPerform('SALES_PAYMENTS', 'approve') && (
            <Button className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6" onClick={handleSave}>
              Confirmar Pago
            </Button>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información del Pago</p>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div><p className="text-[10px] text-muted-foreground mb-1">Cliente</p>
                  <Combobox 
                    options={(customers || [])
                      .filter(c => (c.status || '').toUpperCase() === 'ACTIVE' || c.id === localDoc.customerId)
                      .map(c => ({ label: c.name, value: c.id, description: (c.code ? `[${c.code}] ` : '') + (c.phone || 'Sin teléfono') }))} 
                    value={localDoc.customerId} 
                    onChange={(val) => setLocalDoc({ ...localDoc, customerId: val, invoiceId: '', creditNoteId: '' })} 
                    placeholder="Seleccionar Cliente" 
                  /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Factura (Opcional)</p>
                  <Combobox options={customerInvoices.map(i => ({
                    label: `${i.number} — ${formatConvertedAmount(Number(i.balance || 0), i.currency, i.exchangeRate)} pend.`,
                    value: i.id,
                  }))}
                    value={localDoc.invoiceId} onChange={(val) => {
                      const inv = invoices.find(i => i.id === val);
                      setLocalDoc({ ...localDoc, invoiceId: val, creditNoteId: '', amount: inv ? Number(inv.balance || 0) : localDoc.amount });
                    }} placeholder="Sin factura (anticipo)" /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Crédito a liquidar (Opcional)</p>
                  <Combobox options={credits.filter((credit) => credit.customerId === localDoc.customerId && ['ISSUED', 'PARTIAL', 'APPLIED'].includes(String(credit.status || '').toUpperCase()) && Number(credit.balance ?? credit.total ?? 0) > 0).map((credit) => ({
                    label: `${credit.number} — ${formatConvertedAmount(Number(credit.balance ?? credit.total ?? 0), credit.currency, credit.exchangeRate)} pend.`,
                    value: credit.id,
                  }))}
                    value={localDoc.creditNoteId} onChange={(val) => {
                      const credit = credits.find((item) => item.id === val);
                      setLocalDoc({ ...localDoc, creditNoteId: val, invoiceId: '', amount: credit ? Number(credit.balance ?? credit.total ?? 0) : localDoc.amount, currency: credit?.currency || localDoc.currency, exchangeRate: credit?.exchangeRate || localDoc.exchangeRate });
                    }} placeholder="Sin crédito" /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Fecha</p>
                  <Input type="date" value={localDoc.date} onChange={(e) => setLocalDoc({ ...localDoc, date: e.target.value })} className="h-8 text-xs" /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Método de Pago</p>
                  <select value={localDoc.method} onChange={(e) => setLocalDoc({ ...localDoc, method: e.target.value })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase">
                    {methodOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select></div>

                <AccountingAccountSelect
                  value={localDoc.accountId}
                  onChange={(accountId) => setLocalDoc({ ...localDoc, accountId })}
                  assetOnly
                  label="Cuenta del pago"
                />

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
                  {localDoc.currency === 'USD' && <p className="text-[10px] font-bold text-muted-foreground mt-2 italic">≈ C$ {formatSalesAmount(Number(localDoc.amount || 0) * (localDoc.exchangeRate || globalRate))}</p>}
                  {localDoc.currency !== 'USD' && Number(localDoc.amount) > 0 && <p className="text-[10px] font-bold text-muted-foreground mt-2 italic">≈ $ {formatSalesAmount(Number(localDoc.amount || 0) / (localDoc.exchangeRate || globalRate))}</p>}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="sales-list-kpis">
        <SalesKpiCard title={`Total Recaudado (${displayCurrency})`} value={formatConvertedAmount(totalCollectedInDisplayCurrency, baseCurrency)} icon={TrendingUp} color="text-emerald-500" bg="bg-emerald-500/10" />
        <SalesKpiCard title="Pagos" value={data.length} icon={CheckCircle2} color="text-blue-500" bg="bg-blue-500/10" />
        <SalesKpiCard title="Con documento" value={data.filter(p => p.invoice?.number || p.creditNote?.number).length} icon={Clock} color="text-amber-500" bg="bg-amber-500/10" active={invoiceFilter === 'WITH_INVOICE'} onClick={() => setInvoiceFilter(invoiceFilter === 'WITH_INVOICE' ? 'ALL' : 'WITH_INVOICE')} />
        <SalesKpiCard title="Método Principal" value={mainMethod} icon={Wallet} color="text-purple-500" bg="bg-purple-500/10" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-2">
          <div><h2 className="text-xl font-black uppercase tracking-tight text-foreground" data-tour="sales-list-title">Pagos Recibidos</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Historial de cobranza y conciliación de ingresos.</p></div>
          <div className="flex flex-wrap items-center justify-end gap-3" data-tour="sales-list-actions">
            <SalesViewTutorial view="payments" />
            <ViewLayoutSelect value={layoutMode} onChange={setLayoutMode} ariaLabel="Elegir distribución de pagos recibidos" />
            <SalesDateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChange={onDateRangeChange || (() => undefined)} />
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input placeholder="Buscar pago..." className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold tracking-widest" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }} /></div>
            {salesAlert && <PurchaseAlertsButton alert={salesAlert} sectionLabel="ventas" storageNamespace="erp-sales-alerts" onItemSelect={setHighlightedAlertId} />}
            {canPerform('SALES_PAYMENTS', 'create') && canPerform('SALES_PAYMENTS', 'approve') && (
              <Button onClick={startNew} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20">
                <Plus className="size-4" /> Registrar Pago</Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filtered}
          pagination={pagination}
          onBulkDelete={async (ids) => { const cancelToastId = toast.loading(`Anulando ${ids.length} pago${ids.length === 1 ? '' : 's'}...`); try { for (const id of ids) { if (String(id).startsWith('new-')) continue; await paymentsService.cancel(id as string, 'Anulación masiva'); } toast.success('Pagos anulados', { id: cancelToastId }); onRefresh(); } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al anular', { id: cancelToastId }); } }}
          columns={columns} onRowUpdate={handleUpdate} isLoading={loading} actionsWidth="w-28" fitContent showHorizontalControls
          layoutMode={layoutMode}
          highlightedRowId={highlightedAlertId}
          actions={(row) => (
            <div className="flex items-center gap-1">
              <Button title="PDF" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => handleExportPDF(row)}><FileDown className="size-4" /></Button>
              <Button title="Ver detalle" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"><Eye className="size-4" /></Button>
              {canPerform('SALES_PAYMENTS', 'delete') && (
                <Button title="Anular" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors" onClick={() => { setPendingCancelId(row.id); setCancelReason(''); }}><Trash2 className="size-4" /></Button>
              )}
            </div>
          )}
        />
      </div>
      <ConfirmDialog
        open={pendingCancelId !== null}
        onOpenChange={(open) => { if (!open) { setPendingCancelId(null); setCancelReason(''); } }}
        title={"¿Anular pago recibido?"}
        description="El pago quedará anulado y se revertirá el saldo de la factura asociada. Esta acción no se puede deshacer."
        confirmLabel="Anular Pago"
        variant="destructive"
        loading={cancelLoading}
        disabled={!cancelReason.trim()}
        onConfirm={async () => {
          if (!pendingCancelId || !cancelReason.trim()) return;
          const cancelToastId = toast.loading('Anulando pago recibido...');
          try {
            setCancelLoading(true);
            await paymentsService.cancel(pendingCancelId, cancelReason.trim());
            toast.success('Pago anulado', { id: cancelToastId });
            onRefresh();
          } catch (error: any) {
            toast.error(error?.response?.data?.message || error?.message || 'Error al anular pago', { id: cancelToastId });
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

