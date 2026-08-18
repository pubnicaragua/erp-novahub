import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, TrendingUp, Clock, CheckCircle2, Wallet, Eye, ChevronLeft, FileDown
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { paymentsService } from '../../services/ventas.service';
import { toast } from 'sonner';
import type { PaymentReceived, Customer, Invoice, CreditNote, SalesPaginationControls } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { AccountingAccountSelect } from '../ui/AccountingAccountSelect';
import { BankAccountSelect } from '../ui/BankAccountSelect';
import { CurrencySelector } from '../ui/CurrencySelector';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { generateEstimatePDF } from '../../utils/pdfGenerator';
import { formatSalesAmount } from '../../utils/salesPriceList';
import { SalesDateRangeFilter } from './SalesDateRangeFilter';
import { SalesViewTutorial } from './SalesViewTutorial';
import { SalesKpiCard } from './SalesKpiCard';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { formatDateEs } from '../../utils/dateFormat';
import { isBankPaymentMethod, requiresManualPaymentAccount, requiresPaymentReference, paymentMethodLabel } from '../../utils/paymentMethods';
import { cn } from '../ui/utils';
import { PurchaseAlertsButton, type PurchaseAlertDetail } from '../compras/PurchaseAlertsButton';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';

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

function groupReceivedPayments(
  rows: PaymentReceived[],
  baseCurrency: string,
  globalRate: number,
  toBaseAmount: (amount: number, currency?: string, exchangeRate?: number) => number,
) {
  const groups = new Map<string, PaymentReceived[]>();
  rows.forEach((row) => {
    const key = row.invoiceId ? `invoice:${row.invoiceId}` : row.creditNoteId ? `credit:${row.creditNoteId}` : `payment:${row.id}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  });

  return [...groups.values()].map((children) => {
    const ordered = [...children].sort((a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime());
    const active = ordered.filter((row) => row.isActive !== false);
    const effective = active.length ? active : ordered;
    const first = effective[0] || ordered[0];
    const currencies = new Set(effective.map((row) => row.currency));
    const baseAmount = Number(effective.reduce((sum, row) => sum + (row.baseAmount !== undefined && row.baseAmount !== null
      ? Number(row.baseAmount)
      : toBaseAmount(Number(row.amount || 0), row.currency, Number(row.exchangeRate || globalRate))), 0).toFixed(2));
    const sameCurrency = currencies.size <= 1;
    const amount = sameCurrency
      ? Number(effective.reduce((sum, row) => sum + Number(row.amount || 0), 0).toFixed(2))
      : baseAmount;
    const methods = new Set(effective.map((row) => String(row.method || '').toUpperCase()));
    const isMixed = methods.size > 1 || effective.some((row) => /pago mixto/i.test(String(row.notes || '')));
    const invoiceStatus = String(first.invoice?.status || first.creditNote?.status || '').toUpperCase();
    const hasPartialSettlement = children.length > 1 || ['PARTIAL', 'OVERDUE'].includes(invoiceStatus);
    const paymentLabel = isMixed
      ? hasPartialSettlement && invoiceStatus === 'PAID' ? 'Pago mixto · liquidado' : hasPartialSettlement ? 'Pago mixto · parcial' : 'Pago mixto'
      : hasPartialSettlement && invoiceStatus === 'PAID' ? 'Pago parcial · liquidado' : hasPartialSettlement ? 'Pago parcial' : 'Pago único';

    return {
      ...first,
      amount,
      currency: sameCurrency ? first.currency : baseCurrency as any,
      exchangeRate: sameCurrency ? Number(first.exchangeRate || 1) : 1,
      baseAmount,
      method: isMixed ? 'MIXED' : first.method,
      payments: ordered,
      paymentLabel,
      paymentCount: children.length,
      isGroupedPayment: isMixed || children.length > 1,
    } as PaymentReceived;
  });
}

export function PagosRecibidosView({ data, loading, onRefresh, customers = [], invoices = [], credits = [], pagination, onSearchChange, dateFrom = '', dateTo = '', onDateRangeChange, salesAlert }: PagosRecibidosViewProps) {
  const { exchangeRate: globalRate, displayCurrency, baseCurrency, formatConvertedAmount, convertBetweenCurrencies, toBaseAmount } = useCurrency();
  const { user, canPerform } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('sales-payments-layout', 'table', 24 * 365);
  const [invoiceFilter, setInvoiceFilter] = useState<'ALL' | 'WITH_INVOICE'>('ALL');
  const [isCreating, setIsCreating] = useState(false);
  const [localDoc, setLocalDoc] = useState<any>(null);
  const [detailPayment, setDetailPayment] = useState<PaymentReceived | null>(null);
  const [highlightedAlertId, setHighlightedAlertId] = useState<string | null>(null);

  const groupedPayments = useMemo(
    () => groupReceivedPayments(data, baseCurrency, globalRate, toBaseAmount),
    [data, baseCurrency, globalRate, toBaseAmount],
  );

  useEffect(() => {
    if (!highlightedAlertId) return;
    const timeout = window.setTimeout(() => setHighlightedAlertId(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [highlightedAlertId]);

  const filtered = groupedPayments.filter(p =>
    (invoiceFilter === 'ALL' || Boolean(p.invoice?.number || p.creditNote?.number)) &&
    (p.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.invoice?.number || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const colFilters = useColumnFilters();
  const filterGetters = {
    customer: (row: PaymentReceived) => row.customer?.name || 'Cliente',
    date: (row: PaymentReceived) => (row.date ? new Date(row.date).getTime() : null),
    amount: (row: PaymentReceived) => Number(row.amount || 0),
  };
  const filteredData = colFilters.applyTo(filtered, filterGetters);
  const distinctCustomers = [...new Map(filtered.map((p) => [p.customer?.name || 'Cliente', p.customer?.name || 'Cliente'])).entries()]
    .map(([, label]) => ({ value: label, label, count: filtered.filter((p) => (p.customer?.name || 'Cliente') === label).length }));

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
      bankAccountId: '',
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
    if (requiresPaymentReference(localDoc.method) && !String(localDoc.reference || '').trim()) { toast.error('La referencia es obligatoria para transferencia, tarjeta o cheque'); return; }
    if (requiresManualPaymentAccount(localDoc.method) && !localDoc.accountId) { toast.error('Selecciona la cuenta contable que recibirá el pago'); return; }
    if (isBankPaymentMethod(localDoc.method, true) && !localDoc.bankAccountId) { toast.error('Selecciona el banco global donde se recibió el pago'); return; }
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
        accountId: requiresManualPaymentAccount(localDoc.method) ? localDoc.accountId : undefined,
        bankAccountId: isBankPaymentMethod(localDoc.method, true) ? localDoc.bankAccountId : undefined,
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
    { key: 'customer', header: 'Cliente', headerExtra: <ColumnFilterMenu label="Cliente" options={distinctCustomers} selected={colFilters.state.customer?.values || []} onSelect={(values) => colFilters.setValues('customer', values)} sort={colFilters.state.customer?.sort || null} onSort={(sort) => colFilters.setSort('customer', sort)} />, render: (_, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Cliente'}</span> },
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
    { key: 'date', header: 'Fecha', headerExtra: <ColumnFilterMenu label="Fecha" sort={colFilters.state.date?.sort || null} onSort={(sort) => colFilters.setSort('date', sort)} sortOptions={[{ value: 'desc', label: 'Más recientes' }, { value: 'asc', label: 'Más antiguas' }]} />, render: (val) => {
      if (!val) return <span className="text-xs text-muted-foreground">N/A</span>;
      const clean = String(val).includes('T') ? String(val).split('T')[0] : String(val);
      const [y, m, d] = clean.split('-').map(Number);
      return <span className="text-xs font-medium text-muted-foreground">{(!y||!m||!d) ? val : formatDateEs(new Date(y, m-1, d))}</span>;
    } },
    {
      key: 'amount', header: 'Monto', width: '150px', headerExtra: <ColumnFilterMenu label="Monto" sort={colFilters.state.amount?.sort || null} onSort={(sort) => colFilters.setSort('amount', sort)} />, render: (val, row) => (
        <span className="text-[13px] font-black tabular-nums text-emerald-500">
          {formatConvertedAmount(Number(val || 0), row.currency, row.exchangeRate)}
        </span>)
    },
    {
      key: 'method', header: 'Método', width: '160px',
      render: (val, row) => {
        const method = paymentMethodLabel(String(val || '').toUpperCase());
        return <div className="flex min-w-0 flex-col items-start gap-1"><Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none bg-blue-500/10 text-blue-500">{method}</Badge><span className="text-[9px] font-bold text-muted-foreground">{row.paymentLabel || 'Pago único'}{row.paymentCount && row.paymentCount > 1 ? ` · ${row.paymentCount} movimientos` : ''}</span></div>;
      }
    },
  ];

  const rawMainMethod = groupedPayments.length > 0
    ? Object.entries(groupedPayments.reduce((acc, p) => { const m = (p.method || 'TRANSFER').toUpperCase(); acc[m] = (acc[m] || 0) + 1; return acc; }, {} as Record<string, number>))
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A'
    : 'N/A';
  
  const mainMethodMap: Record<string, string> = { TRANSFER: 'Transferencia', CASH: 'Efectivo', CARD: 'Tarjeta', CHECK: 'Cheque', 'N/A': 'N/A' };
  const mainMethod = mainMethodMap[rawMainMethod] || rawMainMethod;

  const totalCollectedInDisplayCurrency = groupedPayments.reduce(
    (acc, payment) => acc + (payment.baseAmount !== null && payment.baseAmount !== undefined
      ? Number(payment.baseAmount)
      : toBaseAmount(payment.amount || 0, payment.currency, payment.exchangeRate || globalRate)),
    0,
  );

  // ─── INLINE FORM ────────────────────────────────────────────────────
  if (isCreating && localDoc) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300" data-tour="sales-form-title">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => { setIsCreating(false); setLocalDoc(null); }} className="rounded-full"><ChevronLeft className="size-5" /></Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Registrar Pago</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Completar datos del pago recibido</p>
            </div>
          </div>
          <div className="flex items-center gap-3" data-tour="sales-form-actions">
            <SalesViewTutorial view="payments" context="form" />
            {canPerform('SALES_PAYMENTS', 'create') && canPerform('SALES_PAYMENTS', 'approve') && (
            <Button className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6" onClick={handleSave} disabled={requiresPaymentReference(localDoc.method) && !String(localDoc.reference || '').trim()}>
              Confirmar Pago
            </Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50" data-tour="sales-form-data">
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
                    setLocalDoc({ ...localDoc, invoiceId: val, creditNoteId: '', amount: inv ? Number(convertBetweenCurrencies(Number(inv.balance || 0), inv.currency, localDoc.currency, inv.exchangeRate, localDoc.exchangeRate || globalRate).toFixed(2)) : localDoc.amount });
                    }} placeholder="Sin factura (anticipo)" /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Crédito a liquidar (Opcional)</p>
                  <Combobox options={credits.filter((credit) => credit.customerId === localDoc.customerId && ['ISSUED', 'PARTIAL', 'APPLIED'].includes(String(credit.status || '').toUpperCase()) && Number(credit.balance ?? credit.total ?? 0) > 0).map((credit) => ({
                    label: `${credit.number} — ${formatConvertedAmount(Number(credit.balance ?? credit.total ?? 0), credit.currency, credit.exchangeRate)} pend.`,
                    value: credit.id,
                  }))}
                    value={localDoc.creditNoteId} onChange={(val) => {
                      const credit = credits.find((item) => item.id === val);
                      setLocalDoc({ ...localDoc, creditNoteId: val, invoiceId: '', amount: credit ? Number(convertBetweenCurrencies(Number(credit.balance ?? credit.total ?? 0), credit.currency, localDoc.currency, credit.exchangeRate, localDoc.exchangeRate || globalRate).toFixed(2)) : localDoc.amount });
                    }} placeholder="Sin crédito" /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Fecha</p>
                  <Input type="date" value={localDoc.date} onChange={(e) => setLocalDoc({ ...localDoc, date: e.target.value })} className="h-8 text-xs" /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Método de Pago</p>
                  <select value={localDoc.method} onChange={(e) => { const nextMethod = e.target.value; setLocalDoc({ ...localDoc, method: nextMethod, accountId: requiresManualPaymentAccount(nextMethod) ? localDoc.accountId : '', bankAccountId: isBankPaymentMethod(nextMethod, true) ? localDoc.bankAccountId : '', reference: requiresPaymentReference(nextMethod) ? localDoc.reference : '' }); }} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase">
                    {methodOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select></div>

                {requiresManualPaymentAccount(localDoc.method) && <AccountingAccountSelect
                  value={localDoc.accountId}
                  onChange={(accountId) => setLocalDoc({ ...localDoc, accountId })}
                  assetOnly
                  label="Cuenta del pago"
                />}

                {isBankPaymentMethod(localDoc.method, true) && <BankAccountSelect value={localDoc.bankAccountId} onChange={(bankAccountId) => setLocalDoc({ ...localDoc, bankAccountId })} label="Banco global de destino" />}

                {requiresPaymentReference(localDoc.method) && <div><p className="text-[10px] text-muted-foreground mb-1">Referencia *</p>
                  <Input value={localDoc.reference} onChange={(e) => setLocalDoc({ ...localDoc, reference: e.target.value })} className="h-8 text-xs" placeholder="Nº transferencia, cheque..." /></div>}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50" data-tour="sales-form-summary">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Monto</p>
              <div className="space-y-4">
                <CurrencySelector
                  value={localDoc.currency}
                  baseCurrency={baseCurrency}
                  exchangeRate={globalRate}
                  label="Moneda recibida"
                  onChange={(currency) => {
                    const nextRate = currency === baseCurrency ? 1 : globalRate;
                    setLocalDoc({
                      ...localDoc,
                      amount: Number(convertBetweenCurrencies(Number(localDoc.amount || 0), localDoc.currency, currency, localDoc.exchangeRate || globalRate, nextRate).toFixed(2)),
                      currency,
                      exchangeRate: nextRate,
                    });
                  }}
                />
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
        <SalesKpiCard title="Pagos" value={groupedPayments.length} icon={CheckCircle2} color="text-blue-500" bg="bg-blue-500/10" />
        <SalesKpiCard title="Con documento" value={groupedPayments.filter(p => p.invoice?.number || p.creditNote?.number).length} icon={Clock} color="text-amber-500" bg="bg-amber-500/10" active={invoiceFilter === 'WITH_INVOICE'} onClick={() => setInvoiceFilter(invoiceFilter === 'WITH_INVOICE' ? 'ALL' : 'WITH_INVOICE')} />
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
        <EditableDataTable data={filteredData}
          pagination={pagination}
          columns={columns} onRowUpdate={handleUpdate} isLoading={loading} actionsWidth="w-28" fitContent showHorizontalControls
          showSelection={false}
          layoutMode={layoutMode}
          highlightedRowId={highlightedAlertId}
          actions={(row) => (
            <div className="flex items-center gap-1">
              <Button title="PDF" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => handleExportPDF(row)}><FileDown className="size-4" /></Button>
              <Button title="Ver detalle" aria-label={`Ver detalle del pago ${row.number}`} variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setDetailPayment(row)}><Eye className="size-4" /></Button>
            </div>
          )}
        />
      </div>

      <Sheet open={Boolean(detailPayment)} onOpenChange={(open) => { if (!open) setDetailPayment(null); }}>
        <SheetContent side="right" className="flex w-full min-w-0 flex-col gap-0 border-l border-border/50 bg-background p-0 sm:max-w-xl">
          <SheetHeader className="sticky top-0 z-10 space-y-3 border-b border-border/50 bg-background/95 px-5 py-5 pr-12 backdrop-blur-md sm:px-6" data-tour="sales-payment-detail-title">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Wallet className="size-5" /></div>
              <div className="min-w-0">
                <SheetTitle className="truncate text-lg font-black uppercase tracking-tight">Detalle del pago</SheetTitle>
                <SheetDescription className="mt-1 truncate text-xs">{detailPayment?.number || 'Pago recibido'}</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          {detailPayment && (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-6" data-tour="sales-payment-detail-data">
              <div className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monto recibido</p>
                <p className="mt-1 text-3xl font-black tabular-nums text-primary">{formatConvertedAmount(Number(detailPayment.amount || 0), detailPayment.currency, detailPayment.exchangeRate)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Badge className="border-none bg-emerald-500/10 text-emerald-600">Registrado</Badge>
                  <Badge variant="outline" className="border-primary/20 text-primary">{detailPayment.paymentLabel || 'Pago único'}</Badge>
                  <span>{detailPayment.currency || baseCurrency}</span>
                </div>
              </div>

              {detailPayment.payments && detailPayment.payments.length > 1 && (
                <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Desglose del registro</p>
                    <span className="text-[10px] font-black text-primary">{detailPayment.payments.length} movimientos</span>
                  </div>
                  <div className="space-y-2">
                    {detailPayment.payments.map((child) => (
                      <div key={child.id} className="rounded-xl border border-border/50 bg-background/70 p-3">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="font-black">{paymentMethodLabel(String(child.method || '').toUpperCase())}</span>
                          <span className="font-black tabular-nums text-emerald-600">{formatConvertedAmount(Number(child.amount || 0), child.currency, child.exchangeRate)}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                          <span>{child.number}</span>
                          <span>Referencia: {child.reference || 'Sin referencia'}</span>
                          {child.bankAccount?.bankName && <span>{child.bankAccount.bankName}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/50 bg-muted/10 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente</p><p className="mt-1 break-words text-sm font-bold">{detailPayment.customer?.name || 'Cliente'}</p></div>
                <div className="rounded-xl border border-border/50 bg-muted/10 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha</p><p className="mt-1 text-sm font-bold">{formatDateEs(detailPayment.date, true) || '—'}</p></div>
                <div className="rounded-xl border border-border/50 bg-muted/10 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Método</p><p className="mt-1 text-sm font-bold">{paymentMethodLabel(String(detailPayment.method || '').toUpperCase())}</p></div>
                <div className="rounded-xl border border-border/50 bg-muted/10 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Documento</p><p className="mt-1 break-words text-sm font-bold text-primary">{detailPayment.invoice?.number || detailPayment.creditNote?.number || detailPayment.reference || 'Anticipo'}</p></div>
              </div>

              <div className="space-y-3 rounded-2xl border border-border/50 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Información de conciliación</p>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><p className="text-[10px] text-muted-foreground">Origen</p><p className="mt-1 font-semibold">{detailPayment.sourceLabel || (detailPayment.invoice?.number ? 'Factura' : detailPayment.creditNote?.number ? 'Crédito' : 'Anticipo')}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Referencia</p><p className="mt-1 break-words font-semibold">{detailPayment.reference || 'Sin referencia'}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Cuenta contable</p><p className="mt-1 break-words font-semibold">{(detailPayment as any).account?.name || detailPayment.accountId || 'No especificada'}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">Banco</p><p className="mt-1 break-words font-semibold">{detailPayment.bankAccount?.bankName || detailPayment.bankAccount?.accountNumber || detailPayment.bankAccountId || 'No especificado'}</p></div>
                </div>
              </div>

              {detailPayment.notes && <div className="rounded-2xl border border-border/50 bg-muted/10 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notas</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{detailPayment.notes}</p></div>}
            </div>
          )}
        </SheetContent>
      </Sheet>

    </div>
  );
}

