import { useEffect, useRef, useState } from 'react';
import {
  BadgeDollarSign, Plus, Search, TrendingUp, Clock, CheckCircle2, CircleDollarSign,
  Eye, Trash2, ChevronLeft, Send, CreditCard, AlertTriangle, Ban, Bell, Mail, MessageCircle,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { creditNotesService, customerCreditRemindersService, customerLoansService } from '../../services/ventas.service';
import { createIdempotencyKey } from '../../services/api';
import { useSalesIntegrationPolicy } from '../../hooks/useSalesIntegrationPolicy';
import { toast } from '@/app/services/toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import type { CreditDocument, CreditNote, Customer, PaymentReceived, Product, SalesPaginationControls } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { BankAccountSelect } from '../ui/BankAccountSelect';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { previewSalesTransactionPDF, printSalesPaymentTicket } from '../../utils/pdfGenerator';
import { SalesAccountingLegend } from './SalesAccountingLegend';
import { SalesDateRangeFilter } from './SalesDateRangeFilter';
import { SalesViewTutorial } from './SalesViewTutorial';
import type { PdfDownloadFormat } from '../../utils/pdfDownloadFormats';
import { SalesKpiCard } from './SalesKpiCard';
import { KpiSummaryNotice } from '../ui/KpiSummaryNotice';
import { getKpiSummaryRows } from '../../utils/kpiSummary';
import { SalesLinePriceListSelect, PriceMissingBadge } from './SalesLinePriceListSelect';
import { getCatalogUnitPrice, hasSalesProductPriceListConflict, hasSalesProductPriceListConflicts } from '../../utils/salesPriceList';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { formatDateEs } from '../../utils/dateFormat';
import { SALES_STATUS_COLORS, SALES_WORKFLOW_STATUS_COLORS } from '../../utils/salesStatus';
import { hasPaymentReferenceField, isBankPaymentMethod, requiresManualPaymentAccount, requiresPaymentReference, isCardPaymentMethod, calculateCardCommission, formatCommissionPercent } from '../../utils/paymentMethods';
import { SalesDocumentDetailSheet, getSalesLineIdentifiers, type SalesDocumentPanelData } from './SalesDocumentDetailSheet';
import { CurrencySelector } from '../ui/CurrencySelector';
import { Switch } from '../ui/switch';
import { SalesWarehouseSelect, getDefaultSalesWarehouseId } from './SalesWarehouseSelect';
import { clearSalesEditorDraft, getSalesEditorDraftKey, readSalesEditorDraft, writeSalesEditorDraft } from '../../services/sales-draft-storage';
import { formatCurrencyAmount, normalizeCurrency, roundCurrencyNumber, summarizeAmountsByCurrency } from '../../utils/currency';
import { calculateCustomerCreditPlanEstimate } from '../../utils/customerCreditInstallmentPlan';
import { getPaymentLineDocumentAmount } from '../../utils/paymentSettlement';
import { SalesWarehouseStockHint } from './SalesWarehouseStockHint';
import { getSingleSalesVariant } from '../../utils/sales-stock';
import { SalesVariantSelect } from './SalesVariantSelect';
import { SalesProductPicker, type SalesCatalogItem } from './SalesProductPicker';
import { getCustomerDebtAmount, getCustomerFavorAmount, getMaximumCustomerFavorToApply } from '../../utils/customerBalance';
import { allocatePaymentLinesToBalance, cashCoversPaymentChange, getPaymentChangeBase } from '../../utils/paymentSettlement';
import { getLegacySalesExtraCostFields, getSalesExtraChargesAmount, getSalesExtraChargesPayload, normalizeSalesExtraCharges, type SalesExtraChargeLine } from '../../utils/salesCharges';
import { SalesPaymentReceiptDialog } from './SalesPaymentReceiptDialog';
import { getCurrencyDecimalPlaces } from '../../utils/currency';

interface NotasCreditoViewProps {
  data: CreditDocument[];
  summaryData?: CreditDocument[];
  summaryLoading?: boolean;
  summaryError?: boolean;
  loading: boolean;
  onRefresh: () => void;
  customers?: Customer[];
  customersError?: boolean;
  products?: Product[];
  productsLoading?: boolean;
  productsError?: boolean;
  warehouses?: any[];
  salesAlert?: unknown;
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateRangeChange?: (dateFrom: string, dateTo: string) => void;
}

const statusOptions = [
  { label: 'Borrador', value: 'DRAFT', color: SALES_WORKFLOW_STATUS_COLORS.DRAFT },
  { label: 'Activo', value: 'ISSUED', color: SALES_STATUS_COLORS.ISSUED },
  { label: 'Pago parcial', value: 'PARTIAL', color: SALES_STATUS_COLORS.PARTIAL },
  { label: 'Aplicado', value: 'APPLIED', color: SALES_STATUS_COLORS.APPLIED },
  { label: 'Vencido', value: 'OVERDUE', color: SALES_STATUS_COLORS.OVERDUE || SALES_STATUS_COLORS.PARTIAL },
  { label: 'Pagado', value: 'PAID', color: SALES_STATUS_COLORS.PAID },
  { label: 'Cancelado', value: 'VOIDED', color: SALES_WORKFLOW_STATUS_COLORS.CANCELLED },
];

function CustomerCreditReminderDialog({
  open,
  onOpenChange,
  canConfigure,
  canSend,
  formatAmount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canConfigure: boolean;
  canSend: boolean;
  formatAmount: (amount: number, currency?: string, rate?: number) => string;
}) {
  const defaults = {
    enabled: false,
    beforeDays: [] as number[],
    dueDayEnabled: true,
    firstOverdueDays: 1,
    repeatOverdueEveryDays: null as number | null,
    upcomingMessage: 'Hola {{cliente}}, el abono {{cuota}} del documento {{documento}} vence el {{fecha}}. Saldo de capital: {{saldo_capital}}; intereses: {{saldo_intereses}}.',
    dueTodayMessage: 'Hola {{cliente}}, hoy vence el abono {{cuota}} del documento {{documento}}. Saldo de capital: {{saldo_capital}}; intereses: {{saldo_intereses}}.',
    overdueMessage: 'Hola {{cliente}}, el abono {{cuota}} del documento {{documento}} venció el {{fecha}}. Atraso: {{dias_atraso}} día(s). Saldo de capital: {{saldo_capital}}; intereses: {{saldo_intereses}}.',
  };
  const [config, setConfig] = useState<any>(defaults);
  const [beforeDaysText, setBeforeDaysText] = useState('1');
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyReminderId, setBusyReminderId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [nextConfig, nextReminders] = await Promise.all([
        customerCreditRemindersService.getConfig(),
        customerCreditRemindersService.list(),
      ]);
      const normalized = { ...defaults, ...(nextConfig || {}) };
      setConfig(normalized);
      setBeforeDaysText(Array.isArray(normalized.beforeDays) ? normalized.beforeDays.join(', ') : '');
      setReminders(Array.isArray(nextReminders) ? nextReminders : []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudieron cargar los recordatorios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      const beforeDays = beforeDaysText.split(',').map((item) => Number(item.trim())).filter((item) => Number.isFinite(item) && item > 0);
      const result = await customerCreditRemindersService.saveConfig({ ...config, beforeDays });
      setConfig({ ...defaults, ...(result || {}), beforeDays });
      toast.success('Configuración de recordatorios guardada. Aplica a contratos nuevos.');
      await refresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo guardar la configuración.');
    } finally {
      setSaving(false);
    }
  };

  const openDraft = async (reminder: any, channel: 'WHATSAPP' | 'EMAIL') => {
    const draftWindow = window.open('about:blank', '_blank');
    if (draftWindow) draftWindow.opener = null;
    setBusyReminderId(reminder.id);
    try {
      const draft = await customerCreditRemindersService.openDraft(reminder.id, channel);
      const url = channel === 'WHATSAPP'
        ? `https://wa.me/${String(draft.recipient || '').replace(/\D/g, '')}?text=${encodeURIComponent(draft.message || '')}`
        : `mailto:${encodeURIComponent(draft.recipient || '')}?subject=${encodeURIComponent(`Recordatorio de pago ${draft.documentNumber || ''}`)}&body=${encodeURIComponent(draft.message || '')}`;
      if (draftWindow) draftWindow.location.href = url;
      else window.open(url, '_blank', 'noopener,noreferrer');
      await refresh();
      toast.success('Borrador preparado. Confirma el envío después de enviarlo desde la aplicación.');
    } catch (error: any) {
      draftWindow?.close();
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo preparar el borrador.');
    } finally {
      setBusyReminderId(null);
    }
  };

  const confirmSent = async (reminderId: string) => {
    setBusyReminderId(reminderId);
    try {
      await customerCreditRemindersService.confirmSent(reminderId);
      toast.success('Se registró tu confirmación. La entrega no se verifica desde NovaHub.');
      await refresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo registrar la confirmación.');
    } finally {
      setBusyReminderId(null);
    }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="!flex !max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] !max-w-3xl !flex-col !overflow-hidden rounded-3xl p-4 sm:w-[calc(100%-2rem)] sm:p-6">
      <DialogHeader><DialogTitle className="flex items-center gap-2 nh-module-title"><Bell className="size-5 text-primary" /> Recordatorios de pago</DialogTitle><DialogDescription>NovaHub prepara alertas internas y borradores de WhatsApp o correo. El envío siempre se confirma manualmente.</DialogDescription></DialogHeader>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        {canConfigure && <section className="space-y-4 rounded-2xl border border-border/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xs font-black uppercase tracking-widest">Configuración de sucursal</h3><p className="mt-1 text-[10px] text-muted-foreground">Solo se copia a créditos y préstamos emitidos mientras esté activa.</p></div><label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" className="size-4 accent-primary" checked={Boolean(config.enabled)} onChange={(event) => setConfig({ ...config, enabled: event.target.checked })} /> Activa</label></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="credit-reminder-before">Avisar antes (días, separados por coma)</Label><Input id="credit-reminder-before" value={beforeDaysText} onChange={(event) => setBeforeDaysText(event.target.value)} placeholder="3, 1" /></div>
            <div className="space-y-1.5"><Label htmlFor="credit-reminder-first-overdue">Primer aviso de atraso (días)</Label><Input id="credit-reminder-first-overdue" type="number" min="1" max="90" value={config.firstOverdueDays} onChange={(event) => setConfig({ ...config, firstOverdueDays: Number(event.target.value) })} /></div>
            <div className="space-y-1.5"><Label htmlFor="credit-reminder-repeat">Repetir atraso cada (días, opcional)</Label><Input id="credit-reminder-repeat" type="number" min="1" max="90" value={config.repeatOverdueEveryDays ?? ''} onChange={(event) => setConfig({ ...config, repeatOverdueEveryDays: event.target.value ? Number(event.target.value) : null })} placeholder="Sin repetición" /></div>
            <label className="flex items-center gap-2 self-end rounded-xl border border-border/50 p-3 text-xs font-bold"><input type="checkbox" className="size-4 accent-primary" checked={Boolean(config.dueDayEnabled)} onChange={(event) => setConfig({ ...config, dueDayEnabled: event.target.checked })} /> Avisar el día de vencimiento</label>
          </div>
          {([
            ['upcomingMessage', 'Mensaje previo'],
            ['dueTodayMessage', 'Mensaje del día'],
            ['overdueMessage', 'Mensaje de atraso'],
          ] as const).map(([key, label]) => <div key={key} className="space-y-1.5"><Label htmlFor={`credit-reminder-${key}`}>{label}</Label><textarea id={`credit-reminder-${key}`} rows={3} maxLength={1500} value={config[key]} onChange={(event) => setConfig({ ...config, [key]: event.target.value })} className="min-h-20 w-full max-w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" /></div>)}
          <p className="text-[10px] text-muted-foreground">Variables: {'{{cliente}}'}, {'{{documento}}'}, {'{{cuota}}'}, {'{{fecha}}'}, {'{{saldo_capital}}'}, {'{{saldo_intereses}}'}, {'{{dias_atraso}}'}.</p>
          <Button type="button" onClick={() => void save()} disabled={saving || loading} className="rounded-xl">{saving ? 'Guardando…' : 'Guardar configuración'}</Button>
        </section>}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-black uppercase tracking-widest">Alertas y envíos confirmados</h3><Button type="button" variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>{loading ? 'Actualizando…' : 'Actualizar'}</Button></div>
          {!reminders.length && <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">No hay alertas para contratos elegibles.</p>}
          {reminders.map((reminder) => {
            const installment = reminder.installment || {};
            const contract = installment.creditNote || installment.customerLoan || {};
            const customer = contract.customer || {};
            const overdue = String(reminder.ruleKey || '').startsWith('OVERDUE');
            const currency = contract.currency || 'NIO';
            const opened = reminder.status === 'OPENED';
            const sent = reminder.status === 'SENT';
            const hasPhone = Boolean(customer.contactPhone || customer.phone);
            const hasEmail = Boolean(customer.contactEmail || customer.email);
            return <article key={reminder.id} className="space-y-3 rounded-xl border border-border/50 bg-muted/10 p-3">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="break-words text-xs font-black">{customer.name || 'Cliente'} · {contract.number || contract.invoice?.number || 'Crédito'}</p><p className={cn('mt-1 text-[10px] font-bold', overdue ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}>{overdue ? `Atrasado ${Math.max(1, Number(reminder.daysOverdue || String(reminder.ruleKey).split('_')[1] || 1))} día(s)` : `Cuota #${installment.installmentNumber} · ${new Date(installment.dueDate).toLocaleDateString('es-NI')}`}</p><p className="mt-1 text-[10px] text-muted-foreground">Capital {formatAmount(Number(contract.principalBalance || 0), currency)} · Intereses {formatAmount(Number(contract.interestBalance || 0), currency)}</p></div><span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[9px] font-black uppercase text-primary">{sent ? 'Envío confirmado' : opened ? 'Borrador abierto' : 'Pendiente'}</span></div>
              <p className="whitespace-pre-wrap break-words rounded-lg bg-background/70 p-3 text-xs text-muted-foreground">{reminder.messageSnapshot}</p>
              {canSend && !sent && <div className="flex flex-wrap gap-2">{hasPhone && <Button type="button" variant="outline" size="sm" disabled={busyReminderId === reminder.id} onClick={() => void openDraft(reminder, 'WHATSAPP')}><MessageCircle className="mr-2 size-3.5" /> WhatsApp</Button>}{hasEmail && <Button type="button" variant="outline" size="sm" disabled={busyReminderId === reminder.id} onClick={() => void openDraft(reminder, 'EMAIL')}><Mail className="mr-2 size-3.5" /> Correo</Button>}{opened && <Button type="button" size="sm" disabled={busyReminderId === reminder.id} onClick={() => void confirmSent(reminder.id)}><CheckCircle2 className="mr-2 size-3.5" /> Confirmar que lo envié</Button>}{!hasPhone && !hasEmail && <p className="text-[10px] text-muted-foreground">Agrega un teléfono o correo al cliente para preparar el recordatorio.</p>}</div>}
            </article>;
          })}
        </section>
      </div>
      <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

const methodOptions = [
  { label: 'Transferencia', value: 'TRANSFER' },
  { label: 'Efectivo', value: 'CASH' },
  { label: 'Tarjeta', value: 'CARD' },
  { label: 'Cheque', value: 'CHECK' },
  { label: 'Saldo a favor', value: 'CUSTOMER_BALANCE' },
];

type CreditPaymentLine = {
  method: 'CASH' | 'TRANSFER' | 'CARD' | 'CHECK' | 'CUSTOMER_BALANCE';
  amount: string;
  currency: 'NIO' | 'USD';
  exchangeRate: number;
  accountId?: string;
  bankAccountId?: string;
  reference?: string;
  cardCommissionPercent?: number;
  cardCommissionAmount?: number;
  cardCommissionAccountId?: string;
};

const isoDate = (value: unknown) => {
  if (!value) return '';
  const text = String(value);
  return text.includes('T') ? text.split('T')[0] : text;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().split('T')[0];
};

const toWholeQuantity = (value: string | number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
};

export function NotasCreditoView({ data, summaryData, summaryLoading, summaryError, loading, onRefresh, customers = [], customersError = false, products = [], productsLoading = false, productsError = false, warehouses = [], pagination, onSearchChange, dateFrom = '', dateTo = '', onDateRangeChange }: NotasCreditoViewProps) {
  const { exchangeRate: globalRate, displayCurrency, baseCurrency, displayMode, formatConvertedAmount, formatExplicitAmount, toBaseAmount, convertBetweenCurrencies } = useCurrency();
  const { user, canPerform } = useAuth();
  const canConfigureCustomerCredit = canPerform('SALES_CLIENTS', 'edit') && canPerform('SALES_CLIENTS', 'view');
  const salesIntegrationQuery = useSalesIntegrationPolicy();
  const salesAccountingRequired = salesIntegrationQuery.data?.accountingRequired ?? true;
  const salesFinanceEnabled = salesIntegrationQuery.data?.financeEnabled ?? true;
  const { themeConfig } = useTheme();
  const salesDraftStorageKey = getSalesEditorDraftKey('credit-note', user?.tenantId, user?.id);
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('sales-credits-layout', 'table', 24 * 365);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'ISSUED' | 'PARTIAL' | 'APPLIED' | 'PAID'>('ALL');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<any>(null);
  const [salesProductPickerItemId, setSalesProductPickerItemId] = useState<string | null>(null);
  const [detailCredit, setDetailCredit] = useState<CreditDocument | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  // Borrador sin terminar de una visita anterior: se ofrece retomarlo, no se reabre solo.
  const [pendingDraft, setPendingDraft] = useState<any | null>(null);
  const [paymentCredit, setPaymentCredit] = useState<CreditDocument | null>(null);
  const [paymentLines, setPaymentLines] = useState<CreditPaymentLine[]>([]);
  const [paymentReceipt, setPaymentReceipt] = useState<PaymentReceived | null>(null);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [mixedPaymentEnabled, setMixedPaymentEnabled] = useState(false);
  const [partialPaymentEnabled, setPartialPaymentEnabled] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [referenceNow] = useState(() => Date.now());
  const localDocRef = useRef<any>(null);
  const hydratedDraftKeyRef = useRef<string | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);

  const commitLocalDoc = (nextDoc: any) => {
    localDocRef.current = nextDoc;
    setLocalDoc(nextDoc);
  };

  useEffect(() => {
    localDocRef.current = localDoc;
  }, [localDoc]);

  useEffect(() => {
    if (!salesDraftStorageKey || hydratedDraftKeyRef.current === salesDraftStorageKey) return;
    hydratedDraftKeyRef.current = salesDraftStorageKey;
    const stored = readSalesEditorDraft<any>(salesDraftStorageKey);
    const timer = window.setTimeout(() => {
      if (stored?.document) setPendingDraft(stored);
      setDraftHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [salesDraftStorageKey]);

  useEffect(() => {
    if (!draftHydrated || !salesDraftStorageKey) return;
    if (pendingDraft) return;
    if (!localDoc || (!editingId && !isCreating)) {
      clearSalesEditorDraft(salesDraftStorageKey);
      return;
    }
    writeSalesEditorDraft(salesDraftStorageKey, { editingId, isCreating, document: localDoc });
  }, [draftHydrated, editingId, isCreating, localDoc, pendingDraft, salesDraftStorageKey]);

  const resumePendingDraft = () => {
    if (!pendingDraft) return;
    commitLocalDoc(pendingDraft.document);
    if (pendingDraft.editingId) setEditingId(pendingDraft.editingId);
    setIsCreating(Boolean(pendingDraft.isCreating));
    setPendingDraft(null);
  };
  const discardPendingDraft = () => {
    if (salesDraftStorageKey) clearSalesEditorDraft(salesDraftStorageKey);
    setPendingDraft(null);
  };

  const paymentLineRate = (currency: 'NIO' | 'USD') => currency === baseCurrency ? 1 : Number(globalRate || 1);
  const paymentLine = (method: CreditPaymentLine['method'], amount = '', currency: 'NIO' | 'USD' = displayCurrency): CreditPaymentLine => ({
    method,
    amount,
    currency,
    exchangeRate: paymentLineRate(currency),
    reference: '',
  });
  const paymentTotalBase = paymentLines.reduce((sum, line) => sum + toBaseAmount(
    Number(String(line.amount || '').replace(/,/g, '') || 0),
    line.currency,
    line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
  ), 0);
  const paymentCustomerFavorBase = paymentCredit
    ? getCustomerFavorAmount((paymentCredit.customer as any) || customers.find((customer) => customer.id === paymentCredit.customerId))
    : 0;
  const paymentCustomerFavorAppliedBase = paymentLines
    .filter((line) => line.method === 'CUSTOMER_BALANCE')
    .reduce((sum, line) => sum + toBaseAmount(
      Number(String(line.amount || '').replace(/,/g, '') || 0),
      line.currency,
      line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
    ), 0);
  const paymentCustomerFavorExceeded = paymentCustomerFavorAppliedBase > paymentCustomerFavorBase + 0.01;
  const paymentCreditBalanceBase = paymentCredit
    ? toBaseAmount(
      Number(paymentCredit.balance ?? Number(paymentCredit.total || 0) - Number(paymentCredit.amountPaid || 0)),
      paymentCredit.currency === 'USD' ? 'USD' : 'NIO',
      Number(paymentCredit.exchangeRate || globalRate || 1),
    )
    : 0;
  const paymentCreditCurrency = paymentCredit?.currency === 'USD' ? 'USD' : 'NIO';
  const paymentCreditBalance = paymentCredit
    ? Number(paymentCredit.balance ?? Number(paymentCredit.total || 0) - Number(paymentCredit.amountPaid || 0))
    : 0;
  const paymentReceivedInCreditCurrency = paymentCredit
    ? convertBetweenCurrencies(paymentTotalBase, baseCurrency, paymentCreditCurrency, 1, Number(paymentCredit.exchangeRate || globalRate || 1))
    : 0;
  const paymentChangeBase = getPaymentChangeBase(paymentLines, paymentCreditBalanceBase, (line) => toBaseAmount(
    Number(String(line.amount || '').replace(/,/g, '') || 0),
    line.currency,
    line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
  ));
  const paymentChangeUnsupported = paymentChangeBase > 0.01 && !cashCoversPaymentChange(paymentLines, paymentCreditBalanceBase, (line) => toBaseAmount(
    Number(String(line.amount || '').replace(/,/g, '') || 0),
    line.currency,
    line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
  ));
  const paymentChangeInCreditCurrency = convertBetweenCurrencies(
    paymentChangeBase,
    baseCurrency,
    paymentCreditCurrency,
    1,
    Number(paymentCredit?.exchangeRate || globalRate || 1),
  );
  const paymentRemainingBase = Math.max(0, paymentCreditBalanceBase - paymentTotalBase);
  const paymentRemainingInCreditCurrency = convertBetweenCurrencies(
    paymentRemainingBase,
    baseCurrency,
    paymentCreditCurrency,
    1,
    Number(paymentCredit?.exchangeRate || globalRate || 1),
  );
  // Un abono menor al saldo es válido para cualquier método. Un excedente
  // mixto solo es válido cuando el efectivo alcanza para cubrir el vuelto.
  const paymentAmountMismatch = paymentChangeUnsupported;

  const handlePaymentMethodChange = (index: number, nextMethod: CreditPaymentLine['method']) => {
    setPaymentLines((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const nextLine = {
        ...item,
        method: nextMethod,
        accountId: undefined,
        bankAccountId: undefined,
        reference: '',
        cardCommissionPercent: nextMethod === 'CARD' ? item.cardCommissionPercent : 0,
        cardCommissionAmount: nextMethod === 'CARD' ? item.cardCommissionAmount : 0,
      };
      if (nextMethod !== 'CUSTOMER_BALANCE' || !paymentCredit) return nextLine;
      const currentLineBase = toBaseAmount(
        Number(String(item.amount || '').replace(/,/g, '') || 0),
        item.currency,
        item.currency === baseCurrency ? 1 : Number(item.exchangeRate || globalRate),
      );
      const otherPaymentsBase = paymentTotalBase - currentLineBase;
      const maximumBase = getMaximumCustomerFavorToApply(
        paymentCustomerFavorBase,
        paymentCreditBalanceBase,
        otherPaymentsBase,
      );
      return { ...nextLine, amount: maximumBase.toFixed(getCurrencyDecimalPlaces()), currency: baseCurrency, exchangeRate: 1 };
    }));
  };

  const productCatalog = products.filter((product) => product.itemType !== 'SERVICE');
  const serviceCatalog = products.filter((product) => product.itemType === 'SERVICE');
  const customerFor = (id?: string | null) => customers.find((customer) => customer.id === id);
  const getCustomerPriceListId = (customerId?: string | null) => {
    const customer = customerFor(customerId);
    return customer?.priceListId || (customer as any)?.priceList?.id || null;
  };
  const findProductForItem = (item: any) => products.find((product) => product.id === item?.productId)
    || products.find((product) => product.code && (product.code === item?.code || product.code === item?.productCode))
    || products.find((product) => String(product.name || '').trim().toLowerCase() === String(item?.description || '').trim().toLowerCase());
  const resolveItemType = (item: any) => item.itemType || (findProductForItem(item)?.itemType === 'SERVICE' ? 'SERVICE' : 'PRODUCT');
  const getItemCatalog = (item: any): any[] => {
    const catalog = resolveItemType(item) === 'SERVICE' ? serviceCatalog : productCatalog;
    if (!item?.productId || catalog.some((product) => product.id === item.productId)) return catalog;
    const linkedProduct = products.find((product) => product.id === item.productId);
    return [...catalog, linkedProduct || { id: item.productId, code: '', name: item.description || 'Artículo vinculado', itemType: item.itemType || 'PRODUCT' }];
  };
  const getActiveVariantCount = (product: any) => (product?.variants || []).filter((variant: any) => variant.isActive !== false).length;
  const showVariantColumn = (localDoc?.items || []).some((item: any) => (
    resolveItemType(item) !== 'SERVICE' && getActiveVariantCount(findProductForItem(item)) > 1
  ));
  const showPriceListColumn = (localDoc?.items || []).some((item: any) => (
    Boolean(item.productId)
  ));
  const productLineLayoutClass = showVariantColumn
    ? showPriceListColumn ? 'sales-quote-line-product-layout--variant-and-price' : 'sales-quote-line-product-layout--variant-only'
    : showPriceListColumn ? 'sales-quote-line-product-layout--price-only' : 'sales-quote-line-product-layout--product-only';
  const customerName = (row: CreditNote) => row.customer?.name || customerFor(row.customerId)?.name || 'Cliente';
  const sourceInvoiceTotal = (row: CreditNote) => Number(row.invoice?.total ?? row.total ?? 0);
  const sourceInvoicePaid = (row: CreditNote) => {
    if (!row.invoice) return Number(row.amountPaid ?? 0);
    const reportedPaid = Number(row.invoice.amountPaid);
    if (Number.isFinite(reportedPaid) && reportedPaid > 0.01) return reportedPaid;
    // Compatibilidad con respuestas antiguas que todavía no incluyen
    // invoice.amountPaid: el crédito conserva exactamente el saldo pendiente.
    return Math.max(0, Number((sourceInvoiceTotal(row) - creditDebt(row)).toFixed(getCurrencyDecimalPlaces())));
  };
  const sourceCurrency = (row: CreditNote) => row.invoice?.currency || row.currency;
  const sourceExchangeRate = (row: CreditNote) => row.invoice?.exchangeRate || row.exchangeRate;
  const creditDebt = (row: CreditNote) => Number(row.balance ?? row.total ?? 0);
  const normalizeStatus = (status?: string) => String(status || '').toUpperCase();
  const statusFor = (status?: string) => statusOptions.find((option) => option.value === normalizeStatus(status));
  const isPayableStatus = (status?: string) => ['ISSUED', 'PARTIAL', 'APPLIED', 'OVERDUE'].includes(normalizeStatus(status));
  const getCreditAdditionalChargesAmount = (doc: any = localDoc) => (
    getSalesExtraChargesAmount(doc) + Math.max(0, Number(doc?.deliveryAmount || 0))
  );

  const recalculateItems = (items: any[], chargesDoc: any = localDoc) => {
    let subtotal = 0;
    let discountAmount = 0;
    let taxAmount = 0;
    const normalizedItems = items.map((item) => {
      const quantity = toWholeQuantity(item.quantity || 0);
      const unitPrice = Math.max(0, Number(item.unitPrice || 0));
      const discount = Math.min(100, Math.max(0, Number(item.discount || 0)));
      const taxRate = Math.max(0, Number(item.taxRate || 0));
      const gross = quantity * unitPrice;
      const lineDiscount = gross * (discount / 100);
      const taxable = Math.max(0, gross - lineDiscount);
      const lineTax = taxable * (taxRate / 100);
      subtotal += gross;
      discountAmount += lineDiscount;
      taxAmount += lineTax;
      return { ...item, quantity, unitPrice, discount, taxRate, total: taxable + lineTax };
    });
    return {
      items: normalizedItems,
      subtotal,
      discountAmount,
      taxAmount,
      total: subtotal - discountAmount + taxAmount + getCreditAdditionalChargesAmount(chargesDoc),
    };
  };
  const formatDate = (value?: string | null) => value ? formatDateEs(value) : 'Sin fecha';
  const creditLimitBaseFor = (customer?: Customer) => {
    const currency = normalizeCurrency(customer?.creditLimitCurrency, baseCurrency);
    return toBaseAmount(
      Number(customer?.creditLimit || 0),
      currency,
      currency === baseCurrency ? 1 : Number(globalRate || 1),
    );
  };

  const availableCreditFor = (customer?: Customer) => {
    const explicit = Number(customer?.availableCredit);
    if (Number.isFinite(explicit)) return Math.max(0, explicit);
    return Math.max(0, creditLimitBaseFor(customer) - getCustomerDebtAmount(customer));
  };

  const goToCustomers = () => {
    window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module: 'ventas', subModule: 'clientes' } }));
  };

  const customerCreditLimitInstruction = () => canConfigureCustomerCredit
    ? <>Configúralo en <button type="button" className="font-black underline underline-offset-2" onClick={goToCustomers}>Clientes</button> para continuar.</>
    : <>Ve a Clientes y solicita a un usuario con permiso de edición que lo configure para continuar.</>;

  const showCreditLimitRequired = () => {
    const message = canConfigureCustomerCredit
      ? 'El cliente no tiene un límite de crédito configurado. Ve a Clientes para configurarlo.'
      : 'El cliente no tiene un límite de crédito configurado. Ve a Ventas > Clientes y solicita a un usuario con permiso de edición que lo configure.';
    if (canConfigureCustomerCredit) {
      toast.error(message, { action: { label: 'Ir a Clientes', onClick: goToCustomers } });
      return;
    }
    toast.error(message);
  };

  const filtered = data.filter((credit) => {
    const search = searchTerm.toLowerCase();
    return (statusFilter === 'ALL' || normalizeStatus(credit.status) === statusFilter)
      && ([credit.number, customerName(credit), credit.reason].join(' ').toLowerCase().includes(search));
  });

  const colFilters = useColumnFilters();
  const filterGetters = {
    customerId: (row: CreditNote) => customerName(row),
    dueDate: (row: CreditNote) => (row.dueDate ? new Date(row.dueDate).getTime() : null),
    total: (row: CreditNote) => sourceInvoiceTotal(row),
    amountPaid: (row: CreditNote) => sourceInvoicePaid(row),
    balance: (row: CreditNote) => creditDebt(row),
  };
  const filteredData = colFilters.applyTo(filtered, filterGetters);
  const resolvedSummaryRows = summaryData === undefined && !summaryLoading && !summaryError ? data : getKpiSummaryRows({ data: summaryData, isLoading: summaryLoading, isError: summaryError });
  const summarySearchRows = (resolvedSummaryRows || []).filter((credit) => {
    const search = searchTerm.toLowerCase();
    return [credit.number, customerName(credit), credit.reason].join(' ').toLowerCase().includes(search);
  });
  const summaryRowsWithoutStatusFilter = colFilters.applyTo(summarySearchRows, filterGetters);
  const summaryFilteredData = colFilters.applyTo(summarySearchRows.filter((credit) => statusFilter === 'ALL' || normalizeStatus(credit.status) === statusFilter), filterGetters);
  const distinctCustomers = [...new Map(filtered.map((credit) => [customerName(credit), customerName(credit)])).entries()]
    .map(([, label]) => ({ value: label, label, count: filtered.filter((credit) => customerName(credit) === label).length }));

  const closeEditor = () => {
    clearSalesEditorDraft(salesDraftStorageKey);
    localDocRef.current = null;
    setEditingId(null);
    setIsCreating(false);
    commitLocalDoc(null);
  };

  const startEdit = (id: string) => {
    const record = data.find((credit) => credit.id === id);
    if (!record || record.kind === 'CUSTOMER_LOAN') return;
    clearSalesEditorDraft(salesDraftStorageKey);
    setEditingId(id);
    setIsCreating(false);
    const draft = JSON.parse(JSON.stringify(record));
    draft.interestValue = draft.interestMode === 'PERCENTAGE' ? Number(draft.interestRate || 0) : Number(draft.interestAmount || 0);
    commitLocalDoc(draft);
  };

  const startNew = () => {
    clearSalesEditorDraft(salesDraftStorageKey);
    setIsCreating(true);
    setEditingId(null);
    commitLocalDoc({
      customerId: '',
      date: new Date().toISOString().split('T')[0],
      dueDate: addDays(new Date(), 30),
      firstInstallmentDate: '',
      planCalculationMode: 'AMOUNT',
      reason: '',
      items: [],
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      total: 0,
      extraCharges: [],
      extraCostDescription: null,
      extraCostAmount: 0,
      deliveryDescription: null,
      deliveryAmount: 0,
      priceListId: null,
      currency: displayCurrency,
      exchangeRate: globalRate,
      warehouseId: getDefaultSalesWarehouseId(warehouses) || null,
    });
  };

  const handleSave = async () => {
    if (!localDoc) return;
    if (!localDoc.customerId) return void toast.error('Selecciona un cliente');
    if (!localDoc.dueDate) return void toast.error('Selecciona la fecha límite de pago');
    if (!String(localDoc.reason || '').trim()) return void toast.error('Describe el motivo del crédito');
    if (!localDoc.items?.length) return void toast.error('Agrega al menos un producto o servicio');
    if (localDoc.items.some((item: any) => !item.productId)) return void toast.error('Selecciona el producto o servicio de cada línea');
    if (localDoc.items.some((item: any) => item.priceMissing)) return void toast.error('Algunos productos no tienen precio en la lista seleccionada. Elige otra lista de precios.');
    if (localDoc.items.some((item: any) => !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1)) return void toast.error('Las cantidades deben ser enteros mayores que cero');
    const customer = customerFor(localDoc.customerId);
    if (Number(customer?.creditLimit || 0) <= 0) return void showCreditLimitRequired();
    const interestModeForPlan = String(localDoc.interestMode || 'NONE');
    const interestValueForPlan = Number(localDoc.interestValue || 0);
    const planInterest = interestModeForPlan === 'PERCENTAGE'
      ? roundCurrencyNumber(Number(localDoc.total || 0) * interestValueForPlan / 100)
      : interestModeForPlan === 'FIXED_AMOUNT' ? roundCurrencyNumber(interestValueForPlan) : 0;
    const planCalculationMode = localDoc.planCalculationMode || (localDoc.firstInstallmentDate ? 'DEADLINE' : 'AMOUNT');
    const firstInstallmentDate = localDoc.firstInstallmentDate || isoDate(localDoc.dueDate);
    const installmentPlanEstimate = localDoc.planEnabled
      ? calculateCustomerCreditPlanEstimate({
        principal: Number(localDoc.total || 0),
        interest: planInterest,
        frequency: localDoc.frequency || 'WEEKLY',
        firstInstallmentDate,
        calculationMode: planCalculationMode,
        installmentAmount: localDoc.installmentAmount,
        finalDueDate: isoDate(localDoc.dueDate),
      })
      : null;
    if (localDoc.planEnabled && (!firstInstallmentDate || !installmentPlanEstimate)) {
      return void toast.error('Completa el primer abono y los datos del plan para calcular el vencimiento.');
    }
    const effectiveDueDate = localDoc.planEnabled ? installmentPlanEstimate!.finalDueDate : isoDate(localDoc.dueDate);
    const saveToastId = toast.loading(isCreating ? 'Creando crédito...' : 'Guardando crédito...');
    try {
      const payload: any = {
        customerId: localDoc.customerId,
        date: new Date(localDoc.date).toISOString(),
        dueDate: new Date(effectiveDueDate).toISOString(),
        firstInstallmentDate: localDoc.planEnabled ? new Date(firstInstallmentDate).toISOString() : undefined,
        reason: String(localDoc.reason).trim(),
        priceListId: localDoc.priceListId || undefined,
        items: localDoc.items.map((item: any) => ({
          productId: item.productId || undefined,
          variantId: item.variantId || undefined,
          priceListId: item.priceListId || undefined,
          description: item.description || '',
          commercialNoteSnapshot: item.commercialNoteSnapshot || null,
          quantity: toWholeQuantity(item.quantity || 1),
          unitPrice: Number(item.unitPrice || 0),
          taxRate: Math.max(0, Number(item.taxRate || 0)),
          discount: Math.min(100, Math.max(0, Number(item.discount || 0))),
          total: Number(item.total || 0),
        })),
        total: Number(localDoc.total || 0),
        ...getLegacySalesExtraCostFields(getSalesExtraChargesPayload(localDoc)),
        extraCharges: getSalesExtraChargesPayload(localDoc),
        deliveryDescription: String(localDoc.deliveryDescription || '').trim() || null,
        deliveryAmount: Math.max(0, Number(localDoc.deliveryAmount || 0)),
        interestMode: localDoc.interestMode || 'NONE',
        interestValue: Number(localDoc.interestValue || 0),
        planEnabled: Boolean(localDoc.planEnabled),
        planCalculationMode,
        frequency: localDoc.planEnabled ? (localDoc.frequency || 'WEEKLY') : undefined,
        installmentAmount: localDoc.planEnabled ? installmentPlanEstimate?.installmentAmount : undefined,
        currency: localDoc.currency || displayCurrency,
        exchangeRate: Number(localDoc.exchangeRate || globalRate),
        warehouseId: localDoc.warehouseId || localDoc.invoice?.warehouseId || null,
        status: 'DRAFT',
      };
      if (isCreating) {
        await creditNotesService.create(payload);
      } else {
        await creditNotesService.update(localDoc.id, payload);
      }
      toast.success(isCreating ? 'Crédito creado' : 'Crédito actualizado', { id: saveToastId });
      closeEditor();
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo guardar el crédito', { id: saveToastId });
    }
  };

  const handleIssue = async (id: string) => {
    if (!canPerform('SALES_CREDIT_NOTES', 'issue')) return;
    const issueToastId = toast.loading('Emitiendo crédito y validando el límite disponible...');
    try {
      await creditNotesService.issue(id);
      toast.success('Crédito emitido y agregado al saldo del cliente', { id: issueToastId });
      closeEditor();
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo emitir el crédito', { id: issueToastId });
    }
  };

  const openPayment = (credit: CreditDocument) => {
    setPaymentCredit(credit);
    const nextCurrency = displayCurrency === 'USD' ? 'USD' : 'NIO';
    const nextRate = paymentLineRate(nextCurrency);
    const creditCurrency = credit.currency === 'USD' ? 'USD' : 'NIO';
    const creditBalance = Number(credit.balance ?? Number(credit.total || 0) - Number(credit.amountPaid || 0));
    const initialAmount = convertBetweenCurrencies(creditBalance, creditCurrency, nextCurrency, Number(credit.exchangeRate || globalRate || 1), nextRate);
    setPaymentLines([{ ...paymentLine('TRANSFER', initialAmount.toFixed(getCurrencyDecimalPlaces()), nextCurrency), reference: credit.number }]);
    setMixedPaymentEnabled(false);
    setPartialPaymentEnabled(false);
  };

  const handlePayment = async () => {
    if (!canPerform('SALES_CREDIT_NOTES', 'pay')) return;
    if (!paymentCredit) return;
    const effectiveLines = paymentLines
      .map((line) => ({ ...line, amount: String(line.amount || '').replace(/,/g, ''), reference: String(line.reference || '').trim() }))
      .filter((line) => Number(line.amount) > 0);
    if (!effectiveLines.length) return void toast.error('Agrega al menos un medio de pago con monto mayor que cero');
    if (paymentCredit.kind === 'CUSTOMER_LOAN' && effectiveLines.some((line) => line.method === 'CUSTOMER_BALANCE')) {
      return void toast.error('Los abonos de préstamos deben registrarse con un medio de pago recibido.');
    }
    if (salesAccountingRequired && effectiveLines.some((line) => requiresManualPaymentAccount(line.method) && !line.accountId)) return void toast.error('Selecciona la cuenta contable para cada medio de pago');
    if (salesAccountingRequired && effectiveLines.some((line) => isBankPaymentMethod(line.method, true) && !line.bankAccountId)) return void toast.error('Selecciona el banco global para cada medio de pago bancario');
    if (effectiveLines.some((line) => requiresPaymentReference(line.method) && !line.reference)) return void toast.error('La referencia es obligatoria para tarjeta, transferencia o cheque');
    const creditCurrency = paymentCredit.currency === 'USD' ? 'USD' : 'NIO';
    const creditBalance = Number(paymentCredit.balance ?? Number(paymentCredit.total || 0) - Number(paymentCredit.amountPaid || 0));
    const creditBalanceBase = toBaseAmount(creditBalance, creditCurrency, Number(paymentCredit.exchangeRate || globalRate || 1));
    const lineBaseAmount = (line: CreditPaymentLine) => toBaseAmount(
      Number(String(line.amount || '').replace(/,/g, '') || 0),
      line.currency,
      line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
    );
    const changeBase = getPaymentChangeBase(effectiveLines, creditBalanceBase, lineBaseAmount);
    if (changeBase > 0.01 && !cashCoversPaymentChange(effectiveLines, creditBalanceBase, lineBaseAmount)) {
      return void toast.error('No se puede dar vuelto de una tarjeta, transferencia o banco. El excedente debe cubrirse con efectivo.');
    }
    const submittedLines = allocatePaymentLinesToBalance(
      effectiveLines,
      creditBalanceBase,
      lineBaseAmount,
      (appliedBase, line) => {
        const lineRate = line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate || 1);
        return convertBetweenCurrencies(appliedBase, baseCurrency, line.currency, 1, lineRate).toFixed(getCurrencyDecimalPlaces());
      },
    );
    const submittedPaymentTotalBase = submittedLines.reduce((sum, line) => sum + toBaseAmount(
      Number(line.amount || 0),
      line.currency,
      line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
    ), 0);
    const paymentRemainingBase = Math.max(0, creditBalanceBase - submittedPaymentTotalBase);
    const submittedCustomerFavorBase = submittedLines
      .filter((line) => line.method === 'CUSTOMER_BALANCE')
      .reduce((sum, line) => sum + toBaseAmount(
        Number(line.amount || 0),
        line.currency,
        line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
      ), 0);
    if (submittedCustomerFavorBase > paymentCustomerFavorBase + 0.01) return void toast.error(`El saldo a favor disponible es de ${formatConvertedAmount(paymentCustomerFavorBase, baseCurrency)}`);
    if (submittedCustomerFavorBase > 0.01 && !paymentCredit.customerId) return void toast.error('El crédito no tiene un cliente al cual aplicar saldo a favor');
    if (submittedPaymentTotalBase > creditBalanceBase + 0.01) return void toast.error('El pago supera el saldo disponible del crédito');
    if (paymentRemainingBase > 0.01 && !partialPaymentEnabled) return void toast.error('Activa "Pago parcial" para dejar un saldo pendiente del crédito');
    const paymentToastId = toast.loading(paymentCredit.kind === 'CUSTOMER_LOAN' ? 'Registrando abono del préstamo...' : 'Registrando pago del crédito...');
    try {
      setPaymentLoading(true);
      const firstLine = submittedLines[0];
      const paymentPayload = {
        amount: Number(firstLine.amount),
        currency: firstLine.currency,
        paymentMethod: firstLine.method,
        accountId: salesAccountingRequired && requiresManualPaymentAccount(firstLine.method) ? firstLine.accountId : undefined,
        bankAccountId: (salesAccountingRequired || salesFinanceEnabled) && isBankPaymentMethod(firstLine.method, true) ? firstLine.bankAccountId : undefined,
        cardCommissionPercent: !salesAccountingRequired && isCardPaymentMethod(firstLine.method) ? firstLine.cardCommissionPercent || undefined : undefined,
        reference: hasPaymentReferenceField(firstLine.method) ? firstLine.reference : undefined,
        payments: submittedLines.map((line) => ({
          method: line.method,
          amount: Number(line.amount),
          currency: line.currency,
          exchangeRate: line.exchangeRate,
          accountId: salesAccountingRequired && requiresManualPaymentAccount(line.method) ? line.accountId : undefined,
          bankAccountId: (salesAccountingRequired || salesFinanceEnabled) && isBankPaymentMethod(line.method, true) ? line.bankAccountId : undefined,
          cardCommissionPercent: !salesAccountingRequired && isCardPaymentMethod(line.method) ? line.cardCommissionPercent || undefined : undefined,
          reference: hasPaymentReferenceField(line.method) ? line.reference : undefined,
        })),
      };
      const updatedCredit = paymentCredit.kind === 'CUSTOMER_LOAN'
        ? await customerLoansService.applyPayment(paymentCredit.id, paymentPayload, createIdempotencyKey('customer-loan-payment'))
        : await creditNotesService.apply(paymentCredit.id, paymentPayload);
      const updatedPayment = updatedCredit as any;
      const availableRows: any[] = Array.isArray(updatedPayment?.payments)
        ? [...updatedPayment.payments]
        : updatedPayment?.number && updatedPayment?.amount !== undefined
          ? [updatedPayment]
          : [];
      availableRows.sort((left, right) => new Date(right.createdAt || right.date || 0).getTime() - new Date(left.createdAt || left.date || 0).getTime());
      const receiptRows = submittedLines.map((line) => {
        const lineAmount = Number(String(line.amount || '').replace(/,/g, '') || 0);
        const matchingIndex = availableRows.findIndex((row) =>
          String(row.method || '').toUpperCase() === String(line.method || '').toUpperCase()
          && String(row.currency || '').toUpperCase() === String(line.currency || '').toUpperCase()
          && Math.abs(Number(row.amount || 0) - lineAmount) <= 0.01
          && (!hasPaymentReferenceField(line.method) || !line.reference || String(row.reference || '').trim() === String(line.reference || '').trim()),
        );
        const matchedRow = matchingIndex >= 0 ? availableRows.splice(matchingIndex, 1)[0] : null;
        return {
          ...(matchedRow || {}),
          id: matchedRow?.id || '',
          number: matchedRow?.number || '',
          customerId: paymentCredit.customerId,
          customer: matchedRow?.customer || (updatedCredit as any)?.customer || customerFor(paymentCredit.customerId),
          invoiceId: paymentCredit.kind === 'CUSTOMER_LOAN' ? paymentCredit.invoice?.id : undefined,
          invoiceNumber: paymentCredit.kind === 'CUSTOMER_LOAN' ? paymentCredit.invoice?.number || paymentCredit.number : undefined,
          invoice: paymentCredit.kind === 'CUSTOMER_LOAN'
            ? matchedRow?.invoice || updatedPayment?.invoice || paymentCredit.invoice
            : matchedRow?.invoice,
          sourceType: paymentCredit.kind === 'CUSTOMER_LOAN' ? 'CUSTOMER_LOAN' : undefined,
          sourceLabel: paymentCredit.kind === 'CUSTOMER_LOAN' ? `Abono de préstamo ${paymentCredit.number}` : undefined,
          creditNoteId: paymentCredit.kind === 'CREDIT_NOTE' ? paymentCredit.id : undefined,
          creditNote: paymentCredit.kind === 'CREDIT_NOTE' ? updatedCredit : undefined,
          date: matchedRow?.date || new Date().toISOString(),
          amount: lineAmount,
          baseAmount: matchedRow?.baseAmount ?? toBaseAmount(lineAmount, line.currency, Number(line.exchangeRate || globalRate || 1)),
          currency: line.currency,
          exchangeRate: line.exchangeRate,
          method: line.method,
          reference: line.reference,
        } as PaymentReceived;
      });
      const sameCurrency = receiptRows.every((row) => String(row.currency || '').toUpperCase() === String(receiptRows[0]?.currency || '').toUpperCase());
      const receiptCurrency = sameCurrency ? receiptRows[0]?.currency || paymentCredit.currency : baseCurrency;
      const receiptRate = sameCurrency ? Number(receiptRows[0]?.exchangeRate || 1) : 1;
      const receiptTotal = sameCurrency
        ? receiptRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
        : receiptRows.reduce((sum, row) => sum + Number(row.baseAmount || 0), 0);
      setPaymentReceipt({
        ...receiptRows[0],
        amount: receiptTotal,
        total: receiptTotal,
        currency: receiptCurrency as any,
        exchangeRate: receiptRate,
        method: receiptRows.length > 1 ? 'MIXED' : receiptRows[0]?.method || firstLine.method,
        paymentLabel: paymentRemainingBase > 0.01 ? 'Pago parcial' : 'Pago completo',
        balanceBeforePayment: creditBalance,
        customer: (updatedCredit as any)?.customer || customerFor(paymentCredit.customerId),
        creditNote: paymentCredit.kind === 'CREDIT_NOTE' ? updatedCredit as any : undefined,
        invoice: paymentCredit.kind === 'CUSTOMER_LOAN'
          ? (updatedPayment?.invoice || receiptRows[0]?.invoice || paymentCredit.invoice)
          : receiptRows[0]?.invoice,
        creditNoteId: paymentCredit.kind === 'CREDIT_NOTE' ? paymentCredit.id : undefined,
        payments: receiptRows,
        balance: Number(
          (paymentCredit.kind === 'CUSTOMER_LOAN' ? updatedPayment?.invoice?.balance : updatedPayment?.balance)
          ?? convertBetweenCurrencies(
            paymentRemainingBase,
            baseCurrency,
            creditCurrency,
            1,
            Number(paymentCredit.exchangeRate || globalRate || 1),
          ),
        ),
      } as PaymentReceived);
      toast.success(paymentCredit.kind === 'CUSTOMER_LOAN' ? 'Abono registrado y enviado a Pagos Recibidos' : 'Pago registrado y enviado a Pagos Recibidos', { id: paymentToastId });
      setPaymentCredit(null);
      setPaymentLines([]);
      setMixedPaymentEnabled(false);
      setPartialPaymentEnabled(false);
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo registrar el pago', { id: paymentToastId });
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleExportPDF = async (row: CreditDocument, format: PdfDownloadFormat = 'configured') => {
    const previewToastId = toast.loading('Preparando el comprobante de crédito o préstamo...');
    try {
      await previewSalesTransactionPDF({ document: { ...row, customer: row.customer || customerFor(row.customerId) }, tenantName: user?.sessionBranding?.name || user?.tenantName || 'Mi Empresa', formatAmount: formatConvertedAmount as any, tenantLogo: themeConfig?.logo, documentType: 'credit', format });
      toast.success('Previsualización abierta. Descargá el PDF desde el visor del navegador.', { id: previewToastId });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo abrir la previsualización', { id: previewToastId });
    }
  };

  const handlePrintPaymentTicket = async (payment: PaymentReceived) => {
    const printToastId = toast.loading('Preparando el ticket de pago...');
    try {
      await printSalesPaymentTicket({
        payment,
        tenantName: user?.sessionBranding?.name || user?.tenantName || 'Empresa',
        formatAmount: formatConvertedAmount as any,
        tenantLogo: themeConfig?.logo,
        baseCurrency,
      });
      toast.success('Ticket abierto para imprimir.', { id: printToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo preparar el ticket de pago', { id: printToastId });
    }
  };

  const handleSendToCash = async (credit: CreditNote) => {
    if (!canPerform('SALES_CREDIT_NOTES', 'send')) return;
    const status = normalizeStatus(credit.status);
    const balance = Number(credit.balance ?? Number(credit.total || 0) - Number(credit.amountPaid || 0));
    if (!['ISSUED', 'PARTIAL', 'APPLIED'].includes(status) || balance <= 0.01) {
      toast.error('Solo se puede enviar a caja un crédito aprobado con saldo pendiente.');
      return;
    }
    const queueStatus = normalizeStatus(credit.cashQueue?.status);
    if (['PENDING', 'CLAIMED'].includes(queueStatus)) return;
    const sendToastId = toast.loading(`Enviando crédito ${credit.number} a caja...`);
    try {
      await creditNotesService.sendToCash(credit.id);
      toast.success(`Crédito ${credit.number} enviado a Caja`, { id: sendToastId });
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo enviar el crédito a caja', { id: sendToastId });
    }
  };

  const buildCreditPanel = (row: CreditDocument): SalesDocumentPanelData => ({
    id: row.id,
    number: row.number,
    title: row.kind === 'CUSTOMER_LOAN' ? 'Préstamo' : 'Crédito',
    customerName: customerName(row),
    status: String(row.status || ''),
    sourceLabel: row.invoice?.number ? `${row.kind === 'CUSTOMER_LOAN' ? 'Factura del préstamo' : 'Factura origen'}: ${row.invoice.number}` : undefined,
    totalLabel: formatConvertedAmount(Number(row.total || 0), row.currency, row.exchangeRate),
    sourceCurrency: row.currency,
    sourceExchangeRate: row.exchangeRate,
    summaryDetails: [
      ...(row.kind === 'CUSTOMER_LOAN' ? [
        { label: 'Principal', value: formatConvertedAmount(Number(row.principal || 0), row.currency, row.exchangeRate) },
        { label: 'Interés fijo', value: formatConvertedAmount(Number(row.interest || 0), row.currency, row.exchangeRate) },
      ] : []),
      { label: 'Pagado', value: formatConvertedAmount(Number(row.amountPaid || 0), row.currency, row.exchangeRate) },
      { label: 'Saldo', value: formatConvertedAmount(Number(row.balance ?? row.total ?? 0), row.currency, row.exchangeRate) },
      ...normalizeSalesExtraCharges(row)
        .filter((charge) => charge.amount > 0)
        .map((charge, index) => ({ label: charge.description || `Coste extra ${index + 1}`, value: formatConvertedAmount(charge.amount, row.currency, row.exchangeRate) })),
      ...(Number(row.deliveryAmount || 0) > 0 ? [{ label: row.deliveryDescription || 'Delivery', value: formatConvertedAmount(Number(row.deliveryAmount), row.currency, row.exchangeRate) }] : []),
    ],
    metadata: [
      { label: 'Fecha', value: formatDate(row.date) },
      { label: 'Vencimiento', value: formatDate(row.dueDate) },
      ...(row.kind === 'CUSTOMER_LOAN' ? [
        { label: 'Frecuencia', value: ({ DAILY: 'Diaria', WEEKLY: 'Semanal', BIWEEKLY: 'Quincenal', MONTHLY: 'Mensual' } as const)[row.frequency || 'WEEKLY'] },
        { label: 'Mora del cliente', value: row.customer?.moraType?.name || 'Sin clasificación asignada' },
      ] : []),
      ...(row.invoice?.number ? [{ label: 'Factura origen', value: row.invoice.number }] : []),
    ],
    lines: (row.items || []).map((item) => ({
      id: item.id,
      description: item.description,
      ...getSalesLineIdentifiers(item, products),
      secondaryLabel: item.commercialNoteSnapshot ? `Nota: ${item.commercialNoteSnapshot}` : undefined,
      quantity: Number(item.quantity || 0),
      unitPriceLabel: formatConvertedAmount(Number(item.unitPrice || 0), row.currency, row.exchangeRate),
      totalLabel: formatConvertedAmount(Number(item.total || 0), row.currency, row.exchangeRate),
    })),
    reason: row.kind === 'CUSTOMER_LOAN' ? 'Préstamo de cliente' : row.reason,
    notes: row.kind === 'CUSTOMER_LOAN' ? row.notes || undefined : undefined,
  });

  const addItem = (itemType: 'PRODUCT' | 'SERVICE') => {
    if (Number(customerFor(localDoc?.customerId)?.creditLimit || 0) <= 0) {
      showCreditLimitRequired();
      return;
    }
    const itemId = `${Date.now()}-${itemType}-${Math.random().toString(36).slice(2, 8)}`;
    const items = [...(localDoc.items || []), { id: itemId, itemType, productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 0, discount: 0, total: 0, priceListId: localDoc?.priceListId || null, priceMissing: false }];
    setLocalDoc({ ...localDoc, ...recalculateItems(items) });
    setSalesProductPickerItemId(itemId);
  };

  const updateItem = (index: number, patch: Record<string, unknown>) => {
    const items = [...(localDoc.items || [])];
    items[index] = { ...items[index], ...patch };
    setLocalDoc({ ...localDoc, ...recalculateItems(items) });
  };

  const handleCurrencyChange = (currency: 'NIO' | 'USD') => {
    if (!localDoc) return;
    const previousCurrency = localDoc.currency || 'NIO';
    const previousRate = previousCurrency === 'NIO' ? 1 : Number(localDoc.exchangeRate || globalRate || 1);
    const exchangeRate = currency === 'NIO' ? 1 : Number(globalRate || 1);
    const convertCharge = (amount: number) => {
      const baseAmount = previousCurrency === 'USD' ? amount * previousRate : amount;
      return Number((currency === 'USD' ? baseAmount / exchangeRate : baseAmount).toFixed(getCurrencyDecimalPlaces()));
    };
    const convertedItems = (localDoc.items || []).map((item: any) => {
      const basePrice = previousCurrency === 'USD' ? Number(item.unitPrice || 0) * previousRate : Number(item.unitPrice || 0);
      const unitPrice = currency === 'USD' ? basePrice / exchangeRate : basePrice;
      return { ...item, unitPrice };
    });
    const nextDoc = {
      ...localDoc,
      currency,
      exchangeRate,
      extraCharges: normalizeSalesExtraCharges(localDoc).map((charge) => ({ ...charge, amount: convertCharge(charge.amount) })),
      extraCostAmount: convertCharge(Number(localDoc.extraCostAmount || 0)),
      deliveryAmount: convertCharge(Number(localDoc.deliveryAmount || 0)),
    };
    setLocalDoc({ ...nextDoc, ...recalculateItems(convertedItems, nextDoc) });
  };

  const updateCreditExtraCharges = (charges: SalesExtraChargeLine[]) => {
    if (!localDoc) return;
    const payload = getSalesExtraChargesPayload({ extraCharges: charges });
    // Conserva las líneas vacías mientras se edita la nota; el payload final
    // sí filtra las líneas sin monto/descripción al momento de guardar.
    const nextDoc = { ...localDoc, extraCharges: charges, ...getLegacySalesExtraCostFields(payload) };
    const lineTotal = Number(localDoc.total || 0) - getCreditAdditionalChargesAmount(localDoc);
    setLocalDoc({ ...nextDoc, total: Number((lineTotal + getCreditAdditionalChargesAmount(nextDoc)).toFixed(getCurrencyDecimalPlaces())) });
  };

  const updateCreditDelivery = (updates: { deliveryDescription?: string | null; deliveryAmount?: number }) => {
    if (!localDoc) return;
    const nextDoc = {
      ...localDoc,
      ...updates,
      deliveryAmount: Math.max(0, Number(updates.deliveryAmount ?? localDoc.deliveryAmount ?? 0)),
    };
    const lineTotal = Number(localDoc.total || 0) - getCreditAdditionalChargesAmount(localDoc);
    setLocalDoc({ ...nextDoc, total: Number((lineTotal + getCreditAdditionalChargesAmount(nextDoc)).toFixed(getCurrencyDecimalPlaces())) });
  };

  const columns: ColumnDef<CreditDocument>[] = [
    { key: 'number', header: 'N° Crédito', width: '165px', render: (value, row) => <span className="inline-flex max-w-full flex-wrap items-center gap-1.5"><Badge variant="outline" className={cn('shrink-0 text-[9px]', row.kind === 'CUSTOMER_LOAN' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-primary/20 bg-primary/10 text-primary')}>{row.kind === 'CUSTOMER_LOAN' ? 'Préstamo' : 'Crédito'}</Badge><span className={cn('cursor-pointer font-mono text-xs font-black text-primary hover:underline')} onClick={() => setDetailCredit(row)}>{value}</span></span> },
    { key: 'customerId', header: 'Cliente', headerExtra: <ColumnFilterMenu label="Cliente" options={distinctCustomers} selected={colFilters.state.customerId?.values || []} onSelect={(values) => colFilters.setValues('customerId', values)} sort={colFilters.state.customerId?.sort || null} onSort={(sort) => colFilters.setSort('customerId', sort)} />, render: (_, row) => <span className="text-[13px] font-bold text-foreground">{customerName(row)}</span> },
    { key: 'invoiceId', header: 'Factura origen', width: '135px', render: (_, row) => row.invoice?.number ? <Badge className="border-none bg-primary/10 px-2 py-0.5 text-[9px] font-black text-primary">{row.invoice.number}</Badge> : <span className="text-xs text-muted-foreground">{row.kind === 'CUSTOMER_LOAN' ? 'Sin factura asociada' : 'Crédito directo'}</span> },
    { key: 'dueDate', header: 'Vence', headerExtra: <ColumnFilterMenu label="Vence" sort={colFilters.state.dueDate?.sort || null} onSort={(sort) => colFilters.setSort('dueDate', sort)} sortOptions={[{ value: 'asc', label: 'Más antiguas' }, { value: 'desc', label: 'Más recientes' }]} />, render: (value) => <span className="text-xs font-medium text-muted-foreground">{formatDate(value as string)}</span> },
    { key: 'total', header: 'Monto total', width: '135px', headerExtra: <ColumnFilterMenu label="Monto total" sort={colFilters.state.total?.sort || null} onSort={(sort) => colFilters.setSort('total', sort)} />, render: (_, row) => <span className="text-[13px] font-black tabular-nums text-primary">{formatConvertedAmount(sourceInvoiceTotal(row), sourceCurrency(row), sourceExchangeRate(row))}</span> },
    { key: 'amountPaid', header: 'Abonado', width: '125px', headerExtra: <ColumnFilterMenu label="Abonado" sort={colFilters.state.amountPaid?.sort || null} onSort={(sort) => colFilters.setSort('amountPaid', sort)} />, render: (_, row) => <span className="text-[13px] font-black tabular-nums text-foreground">{formatConvertedAmount(sourceInvoicePaid(row), sourceCurrency(row), sourceExchangeRate(row))}</span> },
    { key: 'balance', header: 'En deuda', width: '125px', headerExtra: <ColumnFilterMenu label="En deuda" sort={colFilters.state.balance?.sort || null} onSort={(sort) => colFilters.setSort('balance', sort)} />, render: (_, row) => <span className={cn('text-[13px] font-black tabular-nums', creditDebt(row) > 0 ? 'text-amber-500' : 'text-emerald-500')}>{formatConvertedAmount(creditDebt(row), sourceCurrency(row), sourceExchangeRate(row))}</span> },
    { key: 'status', header: 'Estado', width: '115px', render: (value) => { const option = statusFor(value as string); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none', option?.color || 'bg-muted/20 text-muted-foreground')}>{option?.label || value}</Badge>; } },
  ];

  const totalIssued = summaryFilteredData.filter((credit) => ['ISSUED', 'PARTIAL', 'OVERDUE', 'PAID'].includes(normalizeStatus(credit.status))).reduce((sum, credit) => sum + toBaseAmount(Number(credit.total || 0), credit.currency, credit.exchangeRate), 0);
  const totalOpen = summaryFilteredData.filter((credit) => ['ISSUED', 'PARTIAL', 'APPLIED', 'OVERDUE'].includes(normalizeStatus(credit.status))).reduce((sum, credit) => sum + toBaseAmount(Number(credit.balance ?? credit.total ?? 0), credit.currency, credit.exchangeRate), 0);
  const originalIssuedAmounts = summarizeAmountsByCurrency(
    summaryFilteredData.filter((credit) => ['ISSUED', 'PARTIAL', 'OVERDUE', 'PAID'].includes(normalizeStatus(credit.status))),
    (credit) => Number(credit.total || 0),
    (credit) => credit.currency,
    baseCurrency,
  );
  const originalOpenAmounts = summarizeAmountsByCurrency(
    summaryFilteredData.filter((credit) => ['ISSUED', 'PARTIAL', 'APPLIED', 'OVERDUE'].includes(normalizeStatus(credit.status))),
    (credit) => Number(credit.balance ?? credit.total ?? 0),
    (credit) => credit.currency,
    baseCurrency,
  );
  const overdueCount = summaryFilteredData.filter((credit) => Number(credit.balance ?? 0) > 0 && credit.dueDate && new Date(credit.dueDate).getTime() < referenceNow).length;

  if ((editingId || isCreating) && localDoc) {
    const statusOption = statusFor(localDoc.status);
    const canIssue = !isCreating && normalizeStatus(localDoc.status) === 'DRAFT';
    const canEditDocument = isCreating || normalizeStatus(localDoc.status) === 'DRAFT';
    const selectedCustomer = customerFor(localDoc.customerId);
    const availableCredit = availableCreditFor(selectedCustomer);
    const interestMode = String(localDoc.interestMode || 'NONE');
    const interestValue = Number(localDoc.interestValue ?? (interestMode === 'PERCENTAGE' ? localDoc.interestRate : localDoc.interestAmount) ?? 0);
    const principalForInterest = Number(localDoc.principalAmount || (Number(localDoc.total || 0) - Number(localDoc.interestAmount || 0)));
    const interestPreview = interestMode === 'PERCENTAGE'
      ? principalForInterest * interestValue / 100
      : interestMode === 'FIXED_AMOUNT' ? interestValue : 0;
    const planCalculationMode = localDoc.planCalculationMode || (localDoc.firstInstallmentDate ? 'DEADLINE' : 'AMOUNT');
    const firstInstallmentDate = localDoc.firstInstallmentDate || isoDate(localDoc.dueDate);
    const installmentPlanEstimate = localDoc.planEnabled
      ? calculateCustomerCreditPlanEstimate({
        principal: principalForInterest,
        interest: roundCurrencyNumber(interestPreview),
        frequency: localDoc.frequency || 'WEEKLY',
        firstInstallmentDate,
        calculationMode: planCalculationMode,
        installmentAmount: localDoc.installmentAmount,
        finalDueDate: isoDate(localDoc.dueDate),
      })
      : null;
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300" data-tour="sales-form-title">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4"><Button variant="ghost" size="icon" onClick={closeEditor} className="rounded-full"><ChevronLeft className="size-5" /></Button><div><h2 className="nh-module-title">{isCreating ? 'Nuevo Crédito' : `Crédito ${localDoc.number}`}</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Productos y servicios entregados a crédito</p></div></div>
          <div className="flex flex-wrap items-center gap-3">{canEditDocument && canPerform('SALES_CREDIT_NOTES', 'edit') && <><Button variant="outline" className="rounded-xl border-border/50 hover:bg-muted/70 hover:text-foreground font-black uppercase text-[10px] tracking-widest" onClick={handleSave}>Guardar Borrador</Button>{canIssue && canPerform('SALES_CREDIT_NOTES', 'issue') && <Button variant="outline" className="rounded-xl border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300 font-black uppercase text-[10px] tracking-widest" onClick={() => handleIssue(localDoc.id)}><CheckCircle2 className="mr-2 size-3" /> Emitir Crédito</Button>}</>}</div>
        </div>
        {!canEditDocument && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">Este crédito ya fue emitido o aplicado. Se muestra en modo consulta para proteger el saldo y la trazabilidad.</div>}
        {customersError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-700 dark:text-rose-300"><span>No se pudieron cargar los clientes ni sus límites de crédito.</span><Button type="button" variant="outline" size="sm" onClick={onRefresh}>Reintentar</Button></div>}
        <fieldset disabled={!canEditDocument} className="contents">
        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]" data-tour="sales-form-data">
           <Card className="rounded-2xl border-border/50"><CardContent className="space-y-4 p-6"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Condiciones del crédito</p><SalesAccountingLegend flow="creditNote" /><div className="grid gap-3 sm:grid-cols-2"><div><p className="mb-1 text-[10px] text-muted-foreground">Cliente</p><Combobox options={customers.filter((customer) => String(customer.status || '').toUpperCase() === 'ACTIVE' || customer.id === localDoc.customerId).map((customer) => ({ label: customer.name, value: customer.id, description: `${customer.code ? `[${customer.code}] ` : ''}Límite: ${formatConvertedAmount(Number(customer.creditLimit || 0), normalizeCurrency(customer.creditLimitCurrency, baseCurrency), globalRate)}` }))} value={localDoc.customerId || ''} onChange={(value) => { const priceListId = getCustomerPriceListId(value); const items = (localDoc.items || []).map((item: any) => item.productId ? { ...item, priceListId, unitPrice: 0, total: 0, priceMissing: false } : { ...item, priceListId }); if (hasSalesProductPriceListConflicts(items, priceListId)) { toast.error('No se puede aplicar esta lista: hay productos repetidos con la misma lista de precios.'); return; } setLocalDoc({ ...localDoc, customerId: value, priceListId, ...recalculateItems(items) }); }} placeholder="Seleccionar cliente" /></div><SalesWarehouseSelect warehouses={warehouses} value={localDoc.warehouseId} onChange={(warehouseId) => setLocalDoc({ ...localDoc, warehouseId })} required helpText="Se usará al emitir el crédito y devolver productos al inventario." /><div><p className="mb-1 text-[10px] text-muted-foreground">Fecha del crédito</p><Input type="date" value={isoDate(localDoc.date)} onChange={(event) => setLocalDoc({ ...localDoc, date: event.target.value })} className="h-8 text-xs" /></div><div><p className="mb-1 text-[10px] text-muted-foreground">{localDoc.planEnabled ? (planCalculationMode === 'AMOUNT' ? 'Fecha estimada de cancelación' : 'Fecha final de vencimiento') : 'Fecha límite de pago'}</p><Input type="date" value={localDoc.planEnabled && planCalculationMode === 'AMOUNT' ? installmentPlanEstimate?.finalDueDate || isoDate(localDoc.dueDate) : isoDate(localDoc.dueDate)} onChange={(event) => setLocalDoc({ ...localDoc, dueDate: event.target.value, ...(localDoc.planEnabled ? { planCalculationMode: 'DEADLINE' } : {}) })} className="h-8 text-xs" /></div><div><p className="mb-1 text-[10px] text-muted-foreground">Moneda de la transacción</p><Select value={localDoc.currency || 'NIO'} onValueChange={(value) => handleCurrencyChange(value as 'NIO' | 'USD')}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar moneda" /></SelectTrigger><SelectContent><SelectItem value="NIO">Córdobas (C$)</SelectItem><SelectItem value="USD">Dólares (US$)</SelectItem></SelectContent></Select><p className="mt-1 text-[10px] text-muted-foreground/70">Tasa configurada: <span className="font-bold">{localDoc.currency === 'NIO' ? '1.00' : Number(localDoc.exchangeRate || globalRate || 1).toFixed(2)}</span></p></div>{!isCreating && <div><p className="mb-1 text-[10px] text-muted-foreground">Estado</p><span className={cn('inline-flex rounded-lg px-2 py-1 text-xs font-black', statusOption?.color)}>{statusOption?.label || localDoc.status}</span></div>}</div><div><p className="mb-1 text-[10px] text-muted-foreground">Descripción / motivo</p><textarea value={localDoc.reason || ''} onChange={(event) => setLocalDoc({ ...localDoc, reason: event.target.value })} className="h-20 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Ej. Venta de productos con pago a 30 días..." /></div></CardContent></Card>
          <Card className="rounded-2xl border-border/50"><CardContent className="space-y-4 p-6"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Capacidad de pago</p><div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-border/50 bg-muted/10 p-3"><p className="text-[9px] font-black uppercase text-muted-foreground">Límite ({normalizeCurrency(selectedCustomer?.creditLimitCurrency, baseCurrency)})</p><p className="mt-1 text-lg font-black">{formatCurrencyAmount(Number(selectedCustomer?.creditLimit || 0), normalizeCurrency(selectedCustomer?.creditLimitCurrency, baseCurrency))}</p>{normalizeCurrency(selectedCustomer?.creditLimitCurrency, baseCurrency) !== baseCurrency && <p className="text-[10px] text-muted-foreground">Equivale a {formatConvertedAmount(Number(selectedCustomer?.creditLimit || 0), normalizeCurrency(selectedCustomer?.creditLimitCurrency, baseCurrency), globalRate)}</p>}</div><div className="rounded-xl border border-border/50 bg-muted/10 p-3"><p className="text-[9px] font-black uppercase text-muted-foreground">Disponible</p><p className={cn('mt-1 text-lg font-black', availableCredit > 0 ? 'text-emerald-500' : 'text-rose-500')}>{formatConvertedAmount(availableCredit, baseCurrency)}</p></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">Saldo pendiente</p><p className="mt-1 text-2xl font-black text-rose-600 dark:text-rose-400">{formatConvertedAmount(getCustomerDebtAmount(selectedCustomer), baseCurrency)}</p></div><div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Saldo a favor</p><p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatConvertedAmount(getCustomerFavorAmount(selectedCustomer), baseCurrency)}</p></div></div>{selectedCustomer && Number(selectedCustomer.creditLimit || 0) <= 0 && <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[10px] text-amber-700 dark:text-amber-300"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /><span>Este cliente no tiene límite de crédito. {customerCreditLimitInstruction()}</span></div>}<div className="flex items-start gap-2 text-[10px] text-muted-foreground"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />La emisión valida que el total no supere el límite disponible.</div></CardContent></Card>
        </div>
        <div className="flex justify-end" data-tour="sales-form-actions"><SalesViewTutorial view="credit-notes" context="form" /></div>
        <Card className="rounded-2xl border-border/50">
          <CardContent className="space-y-4 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Interés y calendario opcionales</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="flex items-end leading-tight sm:min-h-10">Interés</Label>
                <Select value={interestMode} onValueChange={(value) => setLocalDoc({ ...localDoc, interestMode: value, interestValue: value === 'NONE' ? 0 : localDoc.interestValue || '' })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="NONE">Sin interés</SelectItem><SelectItem value="FIXED_AMOUNT">Monto fijo</SelectItem><SelectItem value="PERCENTAGE">Porcentaje único</SelectItem></SelectContent>
                </Select>
              </div>
              {interestMode !== 'NONE' && <div className="space-y-1.5">
                <Label htmlFor="credit-interest-value" className="flex items-end leading-tight sm:min-h-10">{interestMode === 'PERCENTAGE' ? 'Porcentaje sobre el crédito (%)' : 'Interés fijo'}</Label>
                <Input id="credit-interest-value" type="number" min="0" step="0.01" max={interestMode === 'PERCENTAGE' ? 100 : undefined} value={localDoc.interestValue ?? ''} onChange={(event) => setLocalDoc({ ...localDoc, interestValue: event.target.value })} />
              </div>}
            </div>
            <p className="text-[10px] text-muted-foreground">Interés estimado: {formatExplicitAmount(interestPreview, localDoc.currency || displayCurrency)} · Total financiado: {formatExplicitAmount(Number(localDoc.total || 0) + interestPreview, localDoc.currency || displayCurrency)}. El porcentaje queda convertido a un monto fijo al emitir.</p>
            <div className="flex items-start gap-2 border-t border-border/40 pt-3">
              <input id="credit-plan-enabled" type="checkbox" className="mt-0.5 size-4 accent-primary" checked={Boolean(localDoc.planEnabled)} onChange={(event) => setLocalDoc({ ...localDoc, planEnabled: event.target.checked, planCalculationMode: localDoc.planCalculationMode || 'AMOUNT', firstInstallmentDate: event.target.checked ? (localDoc.firstInstallmentDate || localDoc.date) : localDoc.firstInstallmentDate, frequency: localDoc.frequency || 'WEEKLY' })} />
              <Label htmlFor="credit-plan-enabled" className="cursor-pointer text-xs">Definir un plan de abonos</Label>
            </div>
            {localDoc.planEnabled && <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="flex items-end leading-tight sm:min-h-10">Frecuencia</Label>
                <Select value={localDoc.frequency || 'WEEKLY'} onValueChange={(value) => setLocalDoc({ ...localDoc, frequency: value })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="DAILY">Diaria</SelectItem><SelectItem value="WEEKLY">Semanal</SelectItem><SelectItem value="BIWEEKLY">Cada 15 días</SelectItem><SelectItem value="MONTHLY">Mensual</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="flex items-end leading-tight sm:min-h-10">Método de cálculo</Label><Select value={planCalculationMode} onValueChange={(value) => { const mode = value as typeof planCalculationMode; setLocalDoc({ ...localDoc, planCalculationMode: mode, ...(mode === 'DEADLINE' && installmentPlanEstimate ? { dueDate: installmentPlanEstimate.finalDueDate } : {}) }); }}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AMOUNT">Monto por abono</SelectItem><SelectItem value="DEADLINE">Fecha de vencimiento</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label htmlFor="credit-first-installment" className="flex items-end leading-tight sm:min-h-10">Fecha del primer abono</Label><Input id="credit-first-installment" type="date" required value={localDoc.firstInstallmentDate || isoDate(localDoc.dueDate)} onChange={(event) => setLocalDoc({ ...localDoc, firstInstallmentDate: event.target.value })} /></div>
              {planCalculationMode === 'AMOUNT' && <div className="space-y-1.5"><Label htmlFor="credit-installment-amount" className="flex items-end leading-tight sm:min-h-10">Monto por abono</Label><Input id="credit-installment-amount" type="number" min="0.01" step="0.01" value={localDoc.installmentAmount ?? ''} onChange={(event) => setLocalDoc({ ...localDoc, planCalculationMode: 'AMOUNT', installmentAmount: event.target.value })} currencyPrecision /></div>}
              {installmentPlanEstimate && <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed sm:col-span-2"><p className="font-bold text-foreground">{planCalculationMode === 'AMOUNT' ? 'Fecha estimada de cancelación' : 'Abono estimado'}</p><p className="mt-1 text-muted-foreground">{planCalculationMode === 'AMOUNT'
                ? formatDateEs(installmentPlanEstimate.finalDueDate) + ' · ' + installmentPlanEstimate.installmentCount + ' abonos de ' + formatExplicitAmount(installmentPlanEstimate.installmentAmount, localDoc.currency) + ' aprox.'
                : installmentPlanEstimate.installmentCount + ' abonos de ' + formatExplicitAmount(installmentPlanEstimate.installmentAmount, localDoc.currency) + ' aprox. hasta ' + formatDateEs(installmentPlanEstimate.finalDueDate) + '.'} La última cuota puede ajustarse por redondeo.</p></div>}
            </div>}
            <p className="text-[10px] text-muted-foreground">Con el monto por abono se estima la fecha final; con la fecha final se calcula el abono aproximado. Se permiten pagos parciales y anticipos; un pago mayor al saldo no se acepta.</p>
          </CardContent>
        </Card>
        {!isCreating && Array.isArray(localDoc.installments) && localDoc.installments.length > 0 && <Card className="rounded-2xl border-border/50">
          <CardContent className="space-y-3 p-5">
            <div><p className="text-xs font-black uppercase tracking-widest">Calendario de abonos</p><p className="mt-1 text-[10px] text-muted-foreground">El saldo pendiente de cada cuota se paga primero a intereses y después a capital.</p></div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {localDoc.installments.map((installment: any) => <div key={installment.id} className="min-w-0 rounded-xl border border-border/50 bg-muted/10 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cuota #{installment.installmentNumber} · {formatDateEs(installment.dueDate)}</p>
                <p className="mt-1 text-sm font-black">Total {formatExplicitAmount(Number(installment.totalAmount || 0), localDoc.currency)}</p>
                <p className="mt-1 break-words text-[10px] text-muted-foreground">Capital {formatExplicitAmount(Number(installment.principalAmount || 0), localDoc.currency)} · Intereses {formatExplicitAmount(Number(installment.interestAmount || 0), localDoc.currency)}</p>
                <p className="mt-1 break-words text-[10px] text-muted-foreground">Pagado {formatExplicitAmount(Number(installment.principalPaid || 0) + Number(installment.interestPaid || 0), localDoc.currency)} · Pendiente {formatExplicitAmount(Math.max(0, Number(installment.totalAmount || 0) - Number(installment.principalPaid || 0) - Number(installment.interestPaid || 0)), localDoc.currency)}</p>
              </div>)}
            </div>
          </CardContent>
        </Card>}
        <Card className="rounded-2xl border-border/50" data-tour="sales-form-items">
          <CardContent className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Productos y servicios</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => addItem('PRODUCT')} disabled={!localDoc.customerId} className="h-8 rounded-xl text-[10px] font-black uppercase tracking-widest"><Plus className="mr-2 size-3" /> Producto</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => addItem('SERVICE')} disabled={!localDoc.customerId} className="h-8 rounded-xl text-[10px] font-black uppercase tracking-widest"><Plus className="mr-2 size-3" /> Servicio</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => updateCreditExtraCharges([...normalizeSalesExtraCharges(localDoc), { id: `extra-${Date.now()}`, description: '', amount: 0 }])} className="h-8 rounded-xl text-[10px] font-black uppercase tracking-widest"><Plus className="mr-2 size-3" /> Coste extra</Button>
                <Button type="button" variant="outline" size="sm" disabled={Number(localDoc?.deliveryAmount || 0) > 0 || Boolean(String(localDoc?.deliveryDescription || '').trim())} onClick={() => updateCreditDelivery({ deliveryDescription: 'Delivery', deliveryAmount: 0 })} className="h-8 rounded-xl text-[10px] font-black uppercase tracking-widest"><Plus className="mr-2 size-3" /> Delivery</Button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="sales-credit-note-item-grid hidden px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground xl:grid xl:grid-cols-12 xl:gap-2">
                <div className={cn('sales-line-product-header sales-quote-line-product-header col-span-6', productLineLayoutClass)}>
                  <span>Producto</span>
                  {showPriceListColumn && <span>Lista de precios</span>}
                </div>
                <div className="col-span-2 grid grid-cols-2 gap-1.5"><div>Aplicar</div><div className="text-right">Desc.</div></div>
                <div className="text-right">Cant.</div>
                <div className="text-right">Precio U.</div>
                <div className="text-right">IVA</div>
                <div className="col-span-2 text-right">Total</div>
              </div>
              {(localDoc.items || []).map((item: any, index: number) => {
                const itemType = resolveItemType(item);
                const catalog = getItemCatalog(item);
                const product = findProductForItem(item);
                return (
                  <div key={item.id || index} data-item-layout="standard" data-pricing-mode="individual" className="sales-item-row sales-credit-note-item-grid grid min-w-0 grid-cols-1 items-start gap-3 rounded-xl border border-border/50 bg-muted/5 p-3 xl:grid-cols-12 xl:gap-2 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0">
                    <div data-item-role="product-area" className="min-w-0 xl:col-span-6">
                      <div className={cn('sales-line-product-fields sales-quote-line-product-fields', productLineLayoutClass)}>
                        <div data-item-role="product-picker" className="sales-line-product-picker min-w-0">
                          <SalesProductPicker
                            otherLocationsPermissionModule="SALES_CREDIT_NOTES"
                            products={catalog as SalesCatalogItem[]}
                            value={item.productId || ''}
                            disabled={!localDoc.customerId || productsLoading}
                            itemType={itemType === 'SERVICE' ? 'SERVICE' : 'PRODUCT'}
                            warehouseId={localDoc?.warehouseId}
                            variantId={item.variantId}
                            catalogLoading={productsLoading}
                            catalogError={productsError}
                            showSelectedVariant={false}
                            showSelectedStock={false}
                            open={salesProductPickerItemId === String(item.id || index)}
                            onOpenChange={(open) => setSalesProductPickerItemId(open ? String(item.id || index) : null)}
                            onChange={(value, pickedVariant) => {
                              const selectedProduct = catalog.find((entry) => entry.id === value);
                              const selectedVariant = itemType === 'SERVICE' ? null : pickedVariant || getSingleSalesVariant(selectedProduct);
                              const unitPrice = getCatalogUnitPrice(selectedProduct, localDoc?.currency, Number(localDoc?.exchangeRate || globalRate || 1));
                              updateItem(index, {
                                productId: value,
                                variantId: selectedVariant?.id || null,
                                variantSku: selectedVariant?.sku || null,
                                variantName: selectedVariant?.name || null,
                                variantAttributes: selectedVariant?.attributes || null,
                                description: selectedProduct?.name || '',
                                commercialNoteSnapshot: selectedProduct?.commercialNote || null,
                                priceListId: localDoc?.priceListId || getCustomerPriceListId(localDoc?.customerId),
                                unitPrice,
                                priceMissing: false,
                              });
                            }}
                            placeholder={itemType === 'SERVICE' ? 'Seleccionar servicio...' : 'Seleccionar producto...'}
                          />
                        </div>
                        {itemType !== 'SERVICE' && <SalesVariantSelect
                          className="sales-line-variant sales-quote-line-variant-column"
                          labelLayout="stacked"
                          showLabel={false}
                          compactDisplay
                          placeholder="Seleccionar variante"
                          product={product}
                          warehouseId={localDoc?.warehouseId}
                          value={item.variantId}
                          onChange={(variantId, variant) => updateItem(index, {
                            variantId,
                            variantSku: variant?.sku || null,
                            variantName: variant?.name || null,
                            variantAttributes: variant?.attributes || null,
                          })}
                        />}
                        {item.productId && <SalesLinePriceListSelect
                          className="sales-line-price-list sales-quote-line-price-column"
                          labelLayout="stacked"
                          labelText="Lista de precios"
                          productId={item.productId}
                          variantId={item.variantId}
                          productCode={product?.code || item.code || item.productCode}
                          productName={item.description}
                          itemType={itemType}
                          value={item.priceListId}
                           defaultPriceListId={localDoc?.priceListId || getCustomerPriceListId(localDoc?.customerId)}
                           lineItems={localDoc?.items || []}
                           lineIndex={index}
                          currency={localDoc?.currency}
                          exchangeRate={Number(localDoc?.exchangeRate || globalRate || 1)}
                           onChange={(priceListId, result) => {
                             if (hasSalesProductPriceListConflict(localDoc.items || [], item.productId, priceListId, index, localDoc.priceListId || getCustomerPriceListId(localDoc.customerId), item.variantId)) {
                               toast.error('Este producto ya está agregado con la misma lista de precios.');
                               return;
                             }
                             const nextItems = [...(localDoc.items || [])];
                            nextItems[index] = {
                              ...nextItems[index],
                              priceListId,
                              unitPrice: result.unitPrice ?? 0,
                              priceMissing: result.priceMissing,
                            };
                            const calculated = recalculateItems(nextItems);
                            setLocalDoc({ ...localDoc, ...calculated, priceListId, items: calculated.items });
                          }}
                        />}
                      </div>
                      {item.productId && product && (
                        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 px-1">
                          {itemType === 'SERVICE' && <Badge variant="outline" className="border-none bg-emerald-500/10 px-1.5 py-0 text-[9px] font-black text-emerald-500">DISPONIBLE</Badge>}
                          {itemType !== 'SERVICE' && (
                            <SalesWarehouseStockHint
                              product={product}
                              warehouses={warehouses}
                              warehouseId={localDoc?.warehouseId}
                              variantId={item.variantId}
                              className="basis-full"
                            />
                          )}
                          {item.priceMissing && <PriceMissingBadge />}
                        </div>
                      )}
                    </div>
                    <div className="col-span-2 mt-0 grid min-w-0 grid-cols-2 items-start gap-1.5 self-start text-[10px]">
                      <label className="relative flex min-w-0 flex-1 items-center font-black uppercase tracking-wider">
                        <span className="flex h-8 w-full items-center gap-1.5 rounded-md bg-muted/30 px-2">
                          <input type="checkbox" checked={Number(item.taxRate || 0) > 0} onChange={(event) => updateItem(index, { taxRate: event.target.checked ? 15 : 0 })} />
                          <span className="text-xs">IVA</span>
                        </span>
                      </label>
                      <label className="relative flex min-w-0 flex-1 items-center font-black uppercase tracking-wider">
                        <Input type="number" min="0" max="100" step="0.01" value={item.discount ?? ''} onChange={(event) => updateItem(index, { discount: Number(event.target.value) || 0 })} className="w-full pr-6 text-left text-xs" placeholder="0" />
                        <span className="pointer-events-none absolute right-2 text-[10px] text-muted-foreground">%</span>
                      </label>
                    </div>
                    <div className="min-w-0 xl:col-span-1">
                      <Input type="number" inputMode="numeric" min="1" step="1" value={Number(item.quantity) || ''} onChange={(event) => updateItem(index, { quantity: toWholeQuantity(event.target.value) })} placeholder="1" />
                    </div>
                    <div className="min-w-0 xl:col-span-1">
                      <Input type="text" inputMode="decimal" min="0" value={item.unitPrice === undefined || item.unitPrice === null ? '' : item.unitPrice} readOnly={Boolean(item.productId)} title={item.productId ? 'Precio definido por la lista de precios' : 'Precio personalizado'} onChange={(event) => updateItem(index, { unitPrice: Number(String(event.target.value).replace(/,/g, '')) || 0 })} placeholder="0" currencyPrecision />
                    </div>
                    <div className="col-span-2 flex items-center justify-end xl:col-span-1">
                      <Input type="text" readOnly value={formatConvertedAmount(((Number(item.quantity || 0) * Number(item.unitPrice || 0)) - (Number(item.quantity || 0) * Number(item.unitPrice || 0) * Number(item.discount || 0) / 100)) * Number(item.taxRate || 0) / 100, localDoc.currency, localDoc.exchangeRate)} className="h-8 w-16 border-none bg-transparent px-0 text-right text-xs font-black shadow-none focus-visible:border-transparent focus-visible:ring-0" />
                    </div>
                    <div data-item-role="total-actions" className="flex min-w-0 items-center justify-end gap-2 text-right xl:col-span-2">
                      <span className="text-sm font-black text-primary">{formatConvertedAmount(Number(item.total || 0), localDoc.currency, localDoc.exchangeRate)}</span>
                      <Button type="button" variant="ghost" size="icon" title="Quitar línea" aria-label="Quitar línea" className="size-6 rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500" onClick={() => { const items = [...localDoc.items]; items.splice(index, 1); setLocalDoc({ ...localDoc, ...recalculateItems(items) }); }}><Trash2 className="size-3" /></Button>
                    </div>
                  </div>
                );
              })}
              {!localDoc.items?.length && <div className="rounded-xl border border-dashed border-border/50 py-8 text-center text-xs text-muted-foreground">Agrega los productos o servicios que se entregarán a crédito.</div>}
            </div>
            {(normalizeSalesExtraCharges(localDoc).length > 0 || String(localDoc?.deliveryDescription || '').trim() || Number(localDoc?.deliveryAmount || 0) > 0) && <div className="mt-5 grid gap-3 border-t border-border/50 pt-5 md:grid-cols-2">
              {normalizeSalesExtraCharges(localDoc).map((charge, index) => <div key={charge.id} className="rounded-xl border border-border/50 bg-muted/10 p-3"><div className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Coste extra {index + 1}</span><Button type="button" variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-rose-500" aria-label={`Eliminar coste extra ${index + 1}`} onClick={() => updateCreditExtraCharges(normalizeSalesExtraCharges(localDoc).filter((entry) => entry.id !== charge.id))}><Trash2 className="size-3.5" /></Button></div><div className="grid gap-2 sm:grid-cols-[1fr_130px]"><Input value={charge.description} placeholder="Descripción" onChange={(event) => updateCreditExtraCharges(normalizeSalesExtraCharges(localDoc).map((entry) => entry.id === charge.id ? { ...entry, description: event.target.value } : entry))} /><Input type="number" min="0" step="0.01" value={charge.amount || ''} placeholder="Monto" onChange={(event) => updateCreditExtraCharges(normalizeSalesExtraCharges(localDoc).map((entry) => entry.id === charge.id ? { ...entry, amount: Math.max(0, Number(event.target.value) || 0) } : entry))} currencyPrecision /></div></div>)}
              {(String(localDoc?.deliveryDescription || '').trim() || Number(localDoc?.deliveryAmount || 0) > 0) && <div className="rounded-xl border border-border/50 bg-muted/10 p-3"><div className="mb-2 flex items-center justify-between gap-2"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Delivery</span><Button type="button" variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-rose-500" aria-label="Eliminar delivery" onClick={() => updateCreditDelivery({ deliveryDescription: null, deliveryAmount: 0 })}><Trash2 className="size-3.5" /></Button></div><div className="grid gap-2 sm:grid-cols-[1fr_130px]"><Input value={localDoc.deliveryDescription || ''} placeholder="Descripción del delivery" onChange={(event) => updateCreditDelivery({ deliveryDescription: event.target.value })} /><Input type="number" min="0" step="0.01" value={localDoc.deliveryAmount || ''} placeholder="Monto" onChange={(event) => updateCreditDelivery({ deliveryAmount: Math.max(0, Number(event.target.value) || 0) })} currencyPrecision /></div></div>}
            </div>}
            <div className="mt-5 rounded-xl border border-border/50 bg-muted/10 p-4 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Resumen del crédito</p>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Subtotal (suma de líneas)</span>
                <span className="font-bold tabular-nums">{formatConvertedAmount(Number(localDoc.subtotal || 0), localDoc.currency, localDoc.exchangeRate)}</span>
              </div>
              {Number(localDoc.discountAmount || 0) > 0 && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">Descuento</span>
                  <span className="font-bold text-rose-500 tabular-nums">− {formatConvertedAmount(Number(localDoc.discountAmount || 0), localDoc.currency, localDoc.exchangeRate)}</span>
                </div>
              )}
              {Number(localDoc.taxAmount || 0) > 0 && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">IVA (15%)</span>
                  <span className="font-bold text-blue-500 tabular-nums">+ {formatConvertedAmount(Number(localDoc.taxAmount || 0), localDoc.currency, localDoc.exchangeRate)}</span>
                </div>
              )}
              {getSalesExtraChargesPayload(localDoc).map((charge, index) => <div key={`extra-summary-${index}`} className="flex items-center justify-between gap-2 text-xs"><span className="text-muted-foreground">{charge.description || `Coste extra ${index + 1}`}</span><span className="font-bold tabular-nums">+ {formatConvertedAmount(Number(charge.amount || 0), localDoc.currency, localDoc.exchangeRate)}</span></div>)}
              {Number(localDoc.deliveryAmount || 0) > 0 && <div className="flex items-center justify-between gap-2 text-xs"><span className="text-muted-foreground">{localDoc.deliveryDescription || 'Delivery'}</span><span className="font-bold tabular-nums">+ {formatConvertedAmount(Number(localDoc.deliveryAmount || 0), localDoc.currency, localDoc.exchangeRate)}</span></div>}
              <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2 mt-2">
                <span className="text-sm font-black uppercase tracking-widest">Total del crédito</span>
                <span className="text-xl font-black text-primary tabular-nums">{formatConvertedAmount(Number(localDoc.total || 0), localDoc.currency, localDoc.exchangeRate)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
        </fieldset>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {pendingDraft && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-sm font-semibold">Tienes un crédito sin terminar. Puedes retomarlo donde lo dejaste o descartarlo.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={discardPendingDraft}>Descartar</Button>
            <Button size="sm" onClick={resumePendingDraft}>Continuar borrador</Button>
          </div>
        </div>
      )}
      <div>
      <div className="flex min-w-0 items-center gap-2"><h2 className="nh-module-title text-foreground" data-tour="sales-list-title">Créditos</h2><SalesViewTutorial view="credit-notes" /></div>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">Productos y servicios entregados con límite y fecha de pago.</p>
      </div>
      <div className="space-y-2" data-tour="sales-list-kpis" aria-busy={Boolean(summaryLoading)}>
        <KpiSummaryNotice loading={summaryLoading} error={summaryError} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {!resolvedSummaryRows
          ? <SalesKpiCard title="Crédito emitido" value="—" icon={BadgeDollarSign} color="text-primary" bg="bg-primary/10" />
          : displayMode === 'ORIGINAL'
          ? originalIssuedAmounts.map((summary) => <SalesKpiCard key={`issued-${summary.currency}`} title={`Crédito emitido (${summary.currency})`} value={formatExplicitAmount(summary.amount, summary.currency)} icon={BadgeDollarSign} color="text-primary" bg="bg-primary/10" />)
          : <SalesKpiCard title={`Crédito emitido (${displayCurrency})`} value={formatConvertedAmount(totalIssued, baseCurrency)} icon={BadgeDollarSign} color="text-primary" bg="bg-primary/10" />}
        {!resolvedSummaryRows ? <SalesKpiCard title="Saldo abierto" value="—" icon={TrendingUp} color="text-primary" bg="bg-primary/10" /> : displayMode === 'ORIGINAL'
          ? originalOpenAmounts.map((summary) => <SalesKpiCard key={`open-${summary.currency}`} title={`Saldo abierto (${summary.currency})`} value={formatExplicitAmount(summary.amount, summary.currency)} icon={TrendingUp} color="text-primary" bg="bg-primary/10" />)
          : <SalesKpiCard title={`Saldo abierto (${displayCurrency})`} value={formatConvertedAmount(totalOpen, baseCurrency)} icon={TrendingUp} color="text-primary" bg="bg-primary/10" />}
        <SalesKpiCard title="Activos" value={resolvedSummaryRows ? summaryFilteredData.filter((credit) => ['ISSUED', 'PARTIAL', 'OVERDUE'].includes(normalizeStatus(credit.status))).length : '—'} icon={CheckCircle2} color="text-primary" bg="bg-primary/10" />
        <SalesKpiCard title="Por vencer / vencidos" value={resolvedSummaryRows ? overdueCount : '—'} icon={Clock} color="text-primary" bg="bg-primary/10" />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col justify-between gap-4 py-2 lg:flex-row lg:items-center">
          <div className="erp-list-toolbar flex flex-wrap items-center justify-end gap-3" data-tour="sales-list-actions">
            {(canPerform('SALES_CREDIT_NOTES', 'edit') || canPerform('SALES_CREDIT_NOTES', 'send')) && <Button type="button" variant="outline" onClick={() => setRemindersOpen(true)} className="h-10 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest"><Bell className="mr-2 size-4" /> Recordatorios</Button>}
            <ViewLayoutSelect value={layoutMode} onChange={(value) => setLayoutMode(value === 'kanban' ? 'table' : value)} ariaLabel="Elegir distribución de créditos" />
            <div className="w-full max-w-full shrink-0 sm:w-[11rem]">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                <SelectTrigger aria-label="Filtrar créditos por estado" className="h-10 w-full rounded-xl border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="ALL">Todos los estados</SelectItem>
                  {statusOptions.filter((option) => option.value !== 'VOIDED').map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <SalesDateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChange={onDateRangeChange || (() => undefined)} />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input placeholder="Buscar crédito..." className="h-10 rounded-xl border-border/50 bg-background/50 pl-9 text-xs font-bold tracking-widest w-full sm:w-80" value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); onSearchChange?.(event.target.value); }} />
            </div>
            {canPerform('SALES_CREDIT_NOTES', 'create') && <Button data-toolbar-role="primary" onClick={startNew} className="h-10 rounded-xl bg-primary px-4 text-[10px] font-black uppercase tracking-widest text-primary-foreground"><Plus className="mr-2 size-4" /> Nuevo Crédito</Button>}
          </div>
        </div>
        <EditableDataTable
          data={filteredData}
          pagination={pagination}
          bulkAction="cancel"
          showSelection={canPerform('SALES_CREDIT_NOTES', 'cancel')}
          isRowSelectable={(row) => canPerform('SALES_CREDIT_NOTES', 'cancel') && normalizeStatus(row.status) === 'DRAFT'}
          onBulkDelete={canPerform('SALES_CREDIT_NOTES', 'cancel') ? async (ids) => {
            if (!canPerform('SALES_CREDIT_NOTES', 'cancel')) return;
            const id = toast.loading(`Cancelando ${ids.length} crédito${ids.length === 1 ? '' : 's'}...`);
            try {
              for (const recordId of ids) await creditNotesService.cancel(recordId as string);
              toast.success('Créditos cancelados', { id });
              onRefresh();
            } catch (error: any) {
              toast.error(error?.response?.data?.message || error?.message || 'No se pudieron cancelar', { id });
            }
          } : undefined}
          columns={columns}
          onRowUpdate={async () => {}}
          onRowClick={(row) => setDetailCredit(row)}
          isLoading={loading}
          actionsWidth="w-32"
          fitContent
          showHorizontalControls
          layoutMode={layoutMode}
          verticalScroll
          actions={(row) => {
            const status = normalizeStatus(row.status);
            const activeQueue = ['PENDING', 'CLAIMED'].includes(normalizeStatus(row.cashQueue?.status));
            return <div className="flex items-center gap-1" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
              {row.kind === 'CREDIT_NOTE' && canPerform('SALES_CREDIT_NOTES', 'issue') && status === 'DRAFT' && <Button title="Emitir crédito" variant="ghost" size="icon" className="size-8 rounded-lg text-emerald-500" onClick={() => handleIssue(row.id)}><CheckCircle2 className="size-4" /></Button>}
              {row.kind === 'CREDIT_NOTE' && canPerform('SALES_CREDIT_NOTES', 'send') && ['ISSUED', 'PARTIAL', 'APPLIED'].includes(status) && Number(row.balance ?? row.total) > 0.01 && <Button title={activeQueue ? 'Crédito ya enviado a Caja' : 'Enviar crédito a Caja'} aria-label={activeQueue ? 'Crédito ya enviado a Caja' : 'Enviar crédito a Caja'} variant="ghost" size="icon" className={cn('size-8 rounded-lg', activeQueue ? 'text-amber-500' : 'text-emerald-500')} onClick={() => void handleSendToCash(row)} disabled={activeQueue}><Send className="size-4" /></Button>}
              {canPerform('SALES_CREDIT_NOTES', 'pay') && isPayableStatus(status) && Number(row.balance ?? row.total) > 0.01 && <Button title={row.kind === 'CUSTOMER_LOAN' ? 'Registrar abono' : 'Registrar pago'} aria-label={row.kind === 'CUSTOMER_LOAN' ? 'Registrar abono del préstamo' : 'Registrar pago del crédito'} variant="ghost" size="icon" className="size-8 rounded-lg text-primary" onClick={() => openPayment(row)}><CreditCard className="size-4" /></Button>}
              {row.kind === 'CUSTOMER_LOAN'
                ? <Button title="Ver préstamo" aria-label="Ver préstamo" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:text-primary" onClick={() => setDetailCredit(row)}><Eye className="size-4" /></Button>
                : <Button title="Ver crédito completo" aria-label="Ver crédito completo" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:text-primary" onClick={() => { setDetailCredit(null); startEdit(row.id); }}><Eye className="size-4" /></Button>}
              {row.kind === 'CREDIT_NOTE' && canPerform('SALES_CREDIT_NOTES', 'cancel') && status === 'DRAFT' && <Button title="Cancelar crédito" aria-label="Cancelar crédito" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:text-rose-500" onClick={() => setPendingDeleteId(row.id)}><Ban className="size-4" /></Button>}
            </div>;
          }}
        />
      </div>

      <SalesDocumentDetailSheet
        key={detailCredit?.id || 'credit-detail'}
        document={detailCredit ? buildCreditPanel(detailCredit) : null}
        entity="CREDIT_NOTE"
        open={Boolean(detailCredit)}
        onClose={() => setDetailCredit(null)}
        onOpenDocument={detailCredit?.kind === 'CUSTOMER_LOAN' ? undefined : () => {
          if (!detailCredit) return;
          setDetailCredit(null);
          startEdit(detailCredit.id);
        }}
        extraActions={detailCredit ? <>
          {detailCredit.kind === 'CREDIT_NOTE' && canPerform('SALES_CREDIT_NOTES', 'issue') && normalizeStatus(detailCredit.status) === 'DRAFT' && <Button type="button" className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => handleIssue(detailCredit.id)}><CheckCircle2 className="mr-2 size-4" />Emitir crédito</Button>}
          {detailCredit.kind === 'CREDIT_NOTE' && canPerform('SALES_CREDIT_NOTES', 'send') && ['ISSUED', 'PARTIAL', 'APPLIED'].includes(normalizeStatus(detailCredit.status)) && Number(detailCredit.balance ?? detailCredit.total) > 0.01 && <Button type="button" className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" disabled={['PENDING', 'CLAIMED'].includes(normalizeStatus(detailCredit.cashQueue?.status))} onClick={() => void handleSendToCash(detailCredit)}><Send className="mr-2 size-4" />Enviar a Caja</Button>}
          {canPerform('SALES_CREDIT_NOTES', 'pay') && isPayableStatus(detailCredit.status) && Number(detailCredit.balance ?? detailCredit.total) > 0.01 && <Button type="button" variant="outline" className="rounded-xl border-primary/30 text-primary hover:bg-primary/10" onClick={() => openPayment(detailCredit)}><CreditCard className="mr-2 size-4" />{detailCredit.kind === 'CUSTOMER_LOAN' ? 'Registrar abono' : 'Registrar pago'}</Button>}
          {detailCredit.kind === 'CREDIT_NOTE' && canPerform('SALES_CREDIT_NOTES', 'cancel') && normalizeStatus(detailCredit.status) === 'DRAFT' && <Button type="button" variant="outline" className="rounded-xl border-rose-500/30 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400" onClick={() => { setDetailCredit(null); setPendingDeleteId(detailCredit.id); }}><Ban className="mr-2 size-4" />Cancelar</Button>}
        </> : undefined}
        onDownloadPdf={detailCredit && canPerform('SALES_CREDIT_NOTES', 'export') ? (format) => { if (detailCredit) void handleExportPDF(detailCredit, format); } : undefined}
      />

      <ConfirmDialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)} title="¿Cancelar crédito?" description="El crédito quedará cancelado y se conservará el registro. Solo pueden cancelarse créditos pendientes de aprobación; los emitidos, aplicados o pagados no se modifican." confirmLabel="Cancelar crédito" variant="destructive" loading={deleteLoading} onConfirm={async () => { if (!canPerform('SALES_CREDIT_NOTES', 'cancel') || !pendingDeleteId) return; const id = toast.loading('Cancelando crédito...'); try { setDeleteLoading(true); await creditNotesService.cancel(pendingDeleteId); toast.success('Crédito cancelado', { id }); onRefresh(); } catch (error: any) { toast.error(error?.response?.data?.message || error?.message || 'No se pudo cancelar', { id }); } finally { setDeleteLoading(false); setPendingDeleteId(null); } }} />

      <Dialog open={Boolean(paymentCredit)} onOpenChange={(open) => !open && !paymentLoading && setPaymentCredit(null)}>
        <DialogContent className="w-[calc(100%-2rem)] !max-w-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 nh-module-title"><CircleDollarSign className="size-5 text-primary" /> {paymentCredit?.kind === 'CUSTOMER_LOAN' ? 'Registrar abono del préstamo' : 'Registrar pago del crédito'}</DialogTitle>
            <DialogDescription>{paymentCredit?.kind === 'CUSTOMER_LOAN' ? 'El abono se aplicará a la factura del préstamo y quedará registrado en Pagos Recibidos.' : 'El pago quedará guardado también en Pagos Recibidos y actualizará el saldo del crédito.'}</DialogDescription>
          </DialogHeader>
          {paymentCredit && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{paymentCredit.number} · {customerName(paymentCredit)}</p>
                    <p className="mt-1 text-2xl font-black text-primary">Saldo: {formatConvertedAmount(Number(paymentCredit.balance ?? paymentCredit.total ?? 0), paymentCredit.currency, paymentCredit.exchangeRate)}</p>
                  </div>
                  <Badge className="bg-primary/10 text-primary">{statusFor(paymentCredit.status)?.label}</Badge>
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/10 p-3">
                 <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                   <div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Forma de pago</p>
                     <p className="mt-1 text-[10px] text-muted-foreground">Activa Pago parcial para conservar saldo o Pago mixto para combinar medios.</p>
                   </div>
                   <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
                     <label className="flex cursor-pointer items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                       <Switch checked={partialPaymentEnabled} onCheckedChange={setPartialPaymentEnabled} disabled={paymentLoading} aria-label="Activar pago parcial" />
                       Pago parcial
                     </label>
                     <label className="flex cursor-pointer items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                       <Switch
                         checked={mixedPaymentEnabled}
                         onCheckedChange={(checked) => {
                           setMixedPaymentEnabled(checked);
                           if (!checked) setPaymentLines((current) => current.slice(0, 1));
                         }}
                         disabled={paymentLoading}
                         aria-label="Activar pago mixto"
                       />
                       Pago mixto
                     </label>
                   </div>
                 </div>
                <div className="space-y-3">
                  {paymentLines.map((line, index) => (
                    <div key={`${index}-${line.method}`} className="rounded-xl border border-border/60 bg-background/70 p-3">
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(7rem,10rem)_minmax(7rem,10rem)_auto] sm:items-start">
                      <div><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Método</p><Select value={line.method} onValueChange={(nextMethod) => handlePaymentMethodChange(index, nextMethod as CreditPaymentLine['method'])} disabled={paymentLoading}><SelectTrigger size="sm" className="h-9 w-full rounded-lg border-input bg-background px-2 text-xs font-bold uppercase"><SelectValue /></SelectTrigger><SelectContent>{methodOptions.filter((method) => method.value !== 'CUSTOMER_BALANCE' || (paymentCredit.kind !== 'CUSTOMER_LOAN' && paymentCustomerFavorBase > 0.01)).map((method) => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}</SelectContent></Select></div>
                        <CurrencySelector value={line.currency} baseCurrency={baseCurrency} exchangeRate={globalRate} rateDecimals={2} label="Moneda" disabled={paymentLoading || line.method === 'CUSTOMER_BALANCE'} onChange={(nextCurrency) => setPaymentLines((current) => current.map((item, itemIndex) => {
                          if (itemIndex !== index) return item;
                          const previousRate = item.currency === baseCurrency ? 1 : Number(item.exchangeRate || globalRate);
                          const nextRate = paymentLineRate(nextCurrency);
                          return { ...item, amount: convertBetweenCurrencies(Number(String(item.amount || '').replace(/,/g, '') || 0), item.currency, nextCurrency, previousRate, nextRate).toFixed(getCurrencyDecimalPlaces()), currency: nextCurrency, exchangeRate: nextRate, bankAccountId: undefined, cardCommissionPercent: 0, cardCommissionAmount: 0, cardCommissionAccountId: undefined };
                        }))} />
                        <div><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Monto ({line.currency})</p><Input type="number" min="0" step="0.01" value={line.amount} onChange={(event) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value, cardCommissionAmount: isCardPaymentMethod(item.method) ? calculateCardCommission(Number(event.target.value || 0), Number(item.cardCommissionPercent || 0)) : item.cardCommissionAmount } : item))} disabled={paymentLoading} className="h-9 text-xs tabular-nums" /></div>
                        <Button type="button" variant="ghost" size="icon" disabled={paymentLines.length === 1 || paymentLoading} onClick={() => setPaymentLines((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Eliminar medio de pago" className="size-9 shrink-0 text-muted-foreground hover:text-rose-500"><Trash2 className="size-4" /></Button>
                      </div>
                      {paymentCredit && line.currency !== paymentCreditCurrency && <p className="mt-1 text-[10px] font-bold text-muted-foreground">Equivalente crédito: {formatExplicitAmount(getPaymentLineDocumentAmount(line, paymentCreditCurrency, paymentCredit.exchangeRate, baseCurrency, convertBetweenCurrencies), paymentCreditCurrency)}</p>}
                      {line.method === 'CUSTOMER_BALANCE' && <p className="mt-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Disponible a favor: {formatConvertedAmount(paymentCustomerFavorBase, baseCurrency)}. Puedes aplicar solo una parte.</p>}
                      {(salesAccountingRequired || salesFinanceEnabled) && isBankPaymentMethod(line.method, true) && <BankAccountSelect currency={line.currency} allowUnlinked={!salesAccountingRequired && salesFinanceEnabled} required={salesAccountingRequired} endpoint="/bank-accounts/payment-options" value={line.bankAccountId} onChange={(bankAccountId) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, bankAccountId } : item))} onAccountSelect={(account) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, cardCommissionPercent: account?.cardCommissionPercent || 0, cardCommissionAmount: isCardPaymentMethod(item.method) ? calculateCardCommission(Number(String(item.amount || '').replace(/,/g, '') || 0), account?.cardCommissionPercent || 0) : 0, cardCommissionAccountId: account?.cardCommissionAccountId || undefined } : item))} label={salesAccountingRequired ? 'Banco global de destino' : 'Banco destino (opcional)'} className="mt-2" />}
                      {isCardPaymentMethod(line.method) && !salesAccountingRequired && <label className="mt-2 block max-w-40 text-[10px] font-bold text-muted-foreground">Comisión de tarjeta (%)<Input type="number" min="0" max="100" step="0.01" value={line.cardCommissionPercent || ''} onChange={(event) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, cardCommissionPercent: Number(event.target.value) || 0, cardCommissionAmount: calculateCardCommission(Number(String(item.amount || '').replace(/,/g, '') || 0), Number(event.target.value) || 0) } : item))} className="mt-1 h-9" /></label>}
                      {isCardPaymentMethod(line.method) && (line.bankAccountId || !salesAccountingRequired) && Number(line.cardCommissionPercent || 0) > 0 && (
                        <div className="mt-2 flex items-center gap-3 rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-[10px]">
                          <span className="font-black uppercase tracking-widest text-purple-600">Comisión:</span>
                          <span className="font-mono font-bold">{formatCommissionPercent(line.cardCommissionPercent)}</span>
                          <span className="text-muted-foreground">|</span>
                          <span className="font-black uppercase tracking-widest text-muted-foreground">Monto:</span>
                          <span className="font-mono font-bold text-purple-600">{formatExplicitAmount(Number(line.cardCommissionAmount || calculateCardCommission(Number(String(line.amount || '').replace(/,/g, '') || 0), Number(line.cardCommissionPercent || 0))), line.currency)}</span>
                        </div>
                      )}
                      {hasPaymentReferenceField(line.method) && <div className="mt-2"><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Referencia *</p><Input value={line.reference || ''} onChange={(event) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, reference: event.target.value } : item))} placeholder="Transferencia, voucher o cheque..." disabled={paymentLoading} required={requiresPaymentReference(line.method)} className="h-9 text-xs" /></div>}
                    </div>
                  ))}
                  {mixedPaymentEnabled && <Button type="button" variant="outline" className="w-full rounded-xl border-dashed text-[10px] font-black uppercase tracking-widest" onClick={() => setPaymentLines((current) => [...current, paymentLine('CASH', '', displayCurrency === 'USD' ? 'USD' : 'NIO')])} disabled={paymentLoading}><Plus className="mr-2 size-4" /> Agregar pago mixto</Button>}
                </div>
                {!mixedPaymentEnabled ? (
                  <div className="mt-3 grid gap-3 border-t border-border/50 pt-3 sm:grid-cols-3">
                    <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total a pagar</p><p className="mt-1 font-black text-primary">{formatConvertedAmount(paymentCreditBalance, paymentCreditCurrency, paymentCredit.exchangeRate)}</p></div>
                    <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Pagado</p><p className="mt-1 font-black text-foreground">{formatConvertedAmount(paymentReceivedInCreditCurrency, paymentCreditCurrency, paymentCredit.exchangeRate)}</p></div>
                    <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{paymentRemainingBase > 0.01 ? 'Pendiente' : paymentChangeBase > 0.01 ? 'Vuelto por dar' : 'Saldo cubierto'}</p><p className={cn('mt-1 font-black', paymentRemainingBase > 0.01 ? 'text-amber-600 dark:text-amber-300' : paymentChangeInCreditCurrency > 0.01 ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground')}>{formatConvertedAmount(paymentRemainingBase > 0.01 ? paymentRemainingInCreditCurrency : paymentChangeInCreditCurrency, paymentCreditCurrency, paymentCredit.exchangeRate)}</p></div>
                  </div>
                ) : (
                  <div className="mt-3 grid gap-3 border-t border-border/50 pt-3 sm:grid-cols-3">
                     <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total aplicado (base)</p><p className="mt-1 font-black text-primary">{formatConvertedAmount(Math.min(paymentTotalBase, paymentCreditBalanceBase), baseCurrency)}</p></div>
                     <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Recibido (base)</p><p className="mt-1 font-black text-foreground">{formatConvertedAmount(paymentTotalBase, baseCurrency)}</p></div>
                     <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{paymentRemainingBase > 0.01 ? 'Pendiente' : paymentChangeBase > 0.01 ? 'Vuelto por dar' : 'Saldo cubierto'}</p><p className={cn('mt-1 font-black', paymentChangeUnsupported ? 'text-rose-600 dark:text-rose-400' : paymentRemainingBase > 0.01 ? 'text-amber-600 dark:text-amber-300' : paymentChangeBase > 0.01 ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground')}>{formatConvertedAmount(paymentRemainingBase > 0.01 ? paymentRemainingInCreditCurrency : paymentChangeInCreditCurrency, paymentCreditCurrency)}</p></div>
                  </div>
                )}
                {paymentChangeUnsupported && <p className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-[10px] font-bold text-rose-600 dark:text-rose-400">No se puede dar vuelto de una tarjeta, transferencia o banco. Reduce esos montos o agrega suficiente efectivo para cubrir el excedente.</p>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentCredit(null)} disabled={paymentLoading}>Cancelar</Button>
            <Button onClick={handlePayment} disabled={paymentLoading || paymentCustomerFavorExceeded || !paymentLines.some((line) => Number(String(line.amount || '').replace(/,/g, '')) > 0) || (salesAccountingRequired && paymentLines.some((line) => requiresManualPaymentAccount(line.method) && !line.accountId)) || (salesAccountingRequired && paymentLines.some((line) => isBankPaymentMethod(line.method, true) && !line.bankAccountId)) || paymentLines.some((line) => requiresPaymentReference(line.method) && !line.reference?.trim()) || paymentAmountMismatch} className="bg-primary font-black">{paymentLoading ? 'Registrando...' : 'Confirmar pago'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SalesPaymentReceiptDialog
        payment={paymentReceipt}
        open={Boolean(paymentReceipt)}
        onOpenChange={(open) => !open && setPaymentReceipt(null)}
        formatAmount={formatConvertedAmount}
        onPrint={() => paymentReceipt && handlePrintPaymentTicket(paymentReceipt)}
        title="Pago del crédito registrado"
      />
      <CustomerCreditReminderDialog
        open={remindersOpen}
        onOpenChange={setRemindersOpen}
        canConfigure={canPerform('SALES_CREDIT_NOTES', 'edit')}
        canSend={canPerform('SALES_CREDIT_NOTES', 'send')}
        formatAmount={formatExplicitAmount}
      />
    </div>
  );
}
