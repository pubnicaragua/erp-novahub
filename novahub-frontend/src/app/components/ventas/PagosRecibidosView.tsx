import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Search, TrendingUp, Clock, CheckCircle2, Wallet, Eye, ChevronLeft, Trash2
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
import { BankAccountSelect } from '../ui/BankAccountSelect';
import { CurrencySelector } from '../ui/CurrencySelector';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { previewSalesTransactionPDF } from '../../utils/pdfGenerator';
import { SalesDateRangeFilter } from './SalesDateRangeFilter';
import { SalesViewTutorial } from './SalesViewTutorial';
import type { PdfDownloadFormat } from '../../utils/pdfDownloadFormats';
import { PdfDownloadButton } from '../ui/PdfDownloadButton';
import { SalesKpiCard } from './SalesKpiCard';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { formatDateEs } from '../../utils/dateFormat';
import { hasPaymentReferenceField, isBankPaymentMethod, requiresManualPaymentAccount, requiresPaymentReference, paymentMethodLabel, isCardPaymentMethod, calculateCardCommission, formatCommissionPercent } from '../../utils/paymentMethods';
import { getSalesAdditionalCharges } from '../../utils/salesCharges';
import { cn } from '../ui/utils';
import { PurchaseAlertsButton, type PurchaseAlertDetail } from '../compras/PurchaseAlertsButton';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '../ui/sheet';
import { clearSalesEditorDraft, getSalesEditorDraftKey, readSalesEditorDraft, writeSalesEditorDraft } from '../../services/sales-draft-storage';
import { getCustomerDebtAmount, getCustomerFavorAmount, getMaximumCustomerFavorToApply } from '../../utils/customerBalance';
import { summarizeAmountsByCurrency } from '../../utils/currency';
import { cajaService, type CashRegister, type CashRegisterSession } from '../../services/caja.service';
import { allocatePaymentLinesToBalance, cashCoversPaymentChange, getPaymentCashBase, getPaymentChangeBase, getPaymentTotalBase } from '../../utils/paymentSettlement';

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
  { label: 'Saldo a favor', value: 'CUSTOMER_BALANCE', color: 'bg-emerald-500/10 text-emerald-500' },
];

const currencyLabels: Record<string, string> = {
  NIO: 'Córdobas (NIO)',
  USD: 'Dólares (USD)',
};

const paymentStatusLabels: Record<string, string> = {
  PENDING: 'Pendiente',
  PARTIAL: 'Pago parcial',
  PAID: 'Pagado',
  OVERDUE: 'Vencido',
  CREDIT: 'A crédito',
  CANCELLED: 'Cancelado',
  VOIDED: 'Anulado',
  ISSUED: 'Emitido',
  APPLIED: 'Aplicado',
  DRAFT: 'Borrador',
};

const formatPaymentStatus = (value?: unknown) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return 'Sin estado';
  return paymentStatusLabels[normalized] || normalized.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};

type ReceivedPaymentLine = {
  method: 'CASH' | 'TRANSFER' | 'CARD' | 'CHECK' | 'CUSTOMER_BALANCE';
  amount: number;
  currency: 'NIO' | 'USD';
  exchangeRate: number;
  accountId?: string;
  bankAccountId?: string;
  reference?: string;
  cardCommissionPercent?: number;
  cardCommissionAmount?: number;
  cardCommissionAccountId?: string;
};

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
    const ordered = [...children].sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
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
    const isCreditSettled = Boolean(first.creditNoteId || first.creditNote) && invoiceStatus === 'PAID';
    const paymentLabel = isCreditSettled
      ? 'Crédito cancelado'
      : isMixed
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
  const { exchangeRate: globalRate, displayCurrency, baseCurrency, displayMode, formatConvertedAmount, formatExplicitAmount, convertBetweenCurrencies, toBaseAmount } = useCurrency();
  const { user, canPerform } = useAuth();
  const { themeConfig } = useTheme();
  const salesDraftStorageKey = getSalesEditorDraftKey('payment', user?.tenantId, user?.id);
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('sales-payments-layout', 'table', 24 * 365);
  const [invoiceFilter, setInvoiceFilter] = useState<'ALL' | 'WITH_INVOICE'>('ALL');
  const [isCreating, setIsCreating] = useState(false);
  const [localDoc, setLocalDoc] = useState<any>(null);
  const [paymentLines, setPaymentLines] = useState<ReceivedPaymentLine[]>([]);
  const [mixedPaymentEnabled, setMixedPaymentEnabled] = useState(false);
  const [partialPaymentEnabled, setPartialPaymentEnabled] = useState(false);
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [cashRegisterId, setCashRegisterId] = useState('');
  const [cashSession, setCashSession] = useState<CashRegisterSession | null>(null);
  const [cashLoading, setCashLoading] = useState(false);
  const [detailPayment, setDetailPayment] = useState<PaymentReceived | null>(null);
  const [highlightedAlertId, setHighlightedAlertId] = useState<string | null>(null);
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
      if (stored) {
        if (stored.document) commitLocalDoc(stored.document);
        setIsCreating(Boolean(stored.isCreating));
        const paymentLines = stored.metadata?.paymentLines;
        if (Array.isArray(paymentLines)) setPaymentLines(paymentLines as ReceivedPaymentLine[]);
        setMixedPaymentEnabled(Boolean(stored.metadata?.mixedPaymentEnabled));
        setPartialPaymentEnabled(Boolean(stored.metadata?.partialPaymentEnabled));
      }
      setDraftHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [salesDraftStorageKey]);

  useEffect(() => {
    if (!draftHydrated || !salesDraftStorageKey) return;
    if (!localDoc || !isCreating) {
      clearSalesEditorDraft(salesDraftStorageKey);
      return;
    }
    writeSalesEditorDraft(salesDraftStorageKey, {
      editingId: null,
      isCreating: true,
      document: localDoc,
      metadata: { paymentLines, mixedPaymentEnabled, partialPaymentEnabled },
    });
  }, [draftHydrated, isCreating, localDoc, mixedPaymentEnabled, partialPaymentEnabled, paymentLines, salesDraftStorageKey]);

  useEffect(() => {
    if (!isCreating) {
      setCashRegisters([]);
      setCashRegisterId('');
      setCashSession(null);
      return;
    }
    let active = true;
    setCashLoading(true);
    cajaService.getRegisters()
      .then((response: any) => {
        if (!active) return;
        const registers = (Array.isArray(response) ? response : response?.data || [])
          .filter((register: CashRegister) => register.hasActiveSession);
        setCashRegisters(registers);
        setCashRegisterId((current) => registers.some((register: CashRegister) => register.id === current)
          ? current
          : registers.length === 1 ? registers[0].id : '');
      })
      .catch(() => {
        if (active) {
          setCashRegisters([]);
          setCashRegisterId('');
        }
      })
      .finally(() => { if (active) setCashLoading(false); });
    return () => { active = false; };
  }, [isCreating]);

  useEffect(() => {
    if (!isCreating || !cashRegisterId) {
      setCashSession(null);
      return;
    }
    let active = true;
    setCashLoading(true);
    cajaService.getActiveSession(cashRegisterId)
      .then((session) => { if (active) setCashSession(session?.status === 'OPEN' ? session : null); })
      .catch(() => { if (active) setCashSession(null); })
      .finally(() => { if (active) setCashLoading(false); });
    return () => { active = false; };
  }, [isCreating, cashRegisterId]);

  const paymentLineRate = (currency: 'NIO' | 'USD') => currency === baseCurrency ? 1 : Number(globalRate || 1);
  const paymentLine = (method: ReceivedPaymentLine['method'], amount = 0, currency: 'NIO' | 'USD' = displayCurrency): ReceivedPaymentLine => ({
    method,
    amount,
    currency,
    exchangeRate: paymentLineRate(currency),
    reference: '',
  });
  const getPaymentLineBase = (line: ReceivedPaymentLine) => toBaseAmount(
    Number(line.amount || 0),
    line.currency,
    line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
  );
  const paymentTotalBase = getPaymentTotalBase(paymentLines, getPaymentLineBase);
  const paymentCustomerFavorBase = getCustomerFavorAmount(
    customers.find((customer) => customer.id === localDoc?.customerId),
  );
  const paymentCustomerFavorAppliedBase = paymentLines
    .filter((line) => line.method === 'CUSTOMER_BALANCE')
    .reduce((sum, line) => sum + toBaseAmount(
      Number(line.amount || 0),
      line.currency,
      line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
    ), 0);
  const paymentCustomerFavorExceeded = paymentCustomerFavorAppliedBase > paymentCustomerFavorBase + 0.01;
  const linkedPaymentDocument = localDoc?.invoiceId
    ? invoices.find((invoice) => invoice.id === localDoc.invoiceId)
    : localDoc?.creditNoteId
      ? credits.find((credit) => credit.id === localDoc.creditNoteId)
      : undefined;
  const linkedDocumentBalanceBase = linkedPaymentDocument
    ? toBaseAmount(
      Number((linkedPaymentDocument as any).balance ?? (linkedPaymentDocument as any).total ?? 0),
      (linkedPaymentDocument as any).currency,
      Number((linkedPaymentDocument as any).exchangeRate || globalRate),
    )
    : 0;
  const paymentChangeBase = linkedPaymentDocument
    ? getPaymentChangeBase(paymentLines, linkedDocumentBalanceBase, getPaymentLineBase)
    : 0;
  const paymentCashBase = getPaymentCashBase(paymentLines, getPaymentLineBase);
  const paymentChangeUnsupported = paymentChangeBase > 0.01 && !cashCoversPaymentChange(paymentLines, linkedDocumentBalanceBase, getPaymentLineBase);
  const paymentRemainingBase = Math.max(0, linkedDocumentBalanceBase - paymentTotalBase);
  const paymentHasActiveCredit = Boolean(
    localDoc?.invoiceId
      && (linkedPaymentDocument as any)?.creditNotes?.some((credit: any) => ['ISSUED', 'PARTIAL', 'APPLIED'].includes(String(credit.status || '').toUpperCase())),
  );
  const paymentCreditAvailableBase = linkedPaymentDocument && localDoc?.invoiceId
    ? (() => {
      const apiAvailable = Number((linkedPaymentDocument as any).creditAvailableBase);
      if (Number.isFinite(apiAvailable)) return Math.max(0, apiAvailable);
      const customer = customers.find((item) => item.id === (linkedPaymentDocument as any).customerId);
      const limitCurrency = customer?.creditLimitCurrency === 'USD' ? 'USD' : 'NIO';
      const creditLimitBase = toBaseAmount(
        Number(customer?.creditLimit || 0),
        limitCurrency,
        limitCurrency === baseCurrency ? 1 : Number(globalRate || 1),
      );
      const debtWithoutInvoice = Math.max(0, getCustomerDebtAmount(customer) - linkedDocumentBalanceBase);
      return Math.max(0, Number((creditLimitBase - debtWithoutInvoice).toFixed(2)));
    })()
    : 0;
  const paymentPartialCreditFits = !linkedPaymentDocument
    || !localDoc?.invoiceId
    || paymentHasActiveCredit
    || paymentRemainingBase <= paymentCreditAvailableBase + 0.01;
  const paymentPartialActive = partialPaymentEnabled && paymentPartialCreditFits;
  const paymentSettlementLabel = paymentRemainingBase > 0.01
    ? 'Falta por pagar'
    : paymentChangeBase > 0.01 ? 'Vuelto por dar' : linkedPaymentDocument ? 'Saldo cubierto' : 'Anticipo';
  const handlePaymentMethodChange = (index: number, nextMethod: ReceivedPaymentLine['method']) => {
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
      if (nextMethod !== 'CUSTOMER_BALANCE') return nextLine;
      const currentLineBase = toBaseAmount(
        Number(item.amount || 0),
        item.currency,
        item.currency === baseCurrency ? 1 : Number(item.exchangeRate || globalRate),
      );
      const otherPaymentsBase = paymentTotalBase - currentLineBase;
      const maximumBase = getMaximumCustomerFavorToApply(
        paymentCustomerFavorBase,
        linkedDocumentBalanceBase,
        otherPaymentsBase,
      );
      return { ...nextLine, amount: maximumBase, currency: baseCurrency, exchangeRate: 1 };
    }));
  };

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
    clearSalesEditorDraft(salesDraftStorageKey);
    const initialLine = paymentLine('TRANSFER');
    setIsCreating(true);
    setPaymentLines([initialLine]);
    setMixedPaymentEnabled(false);
    setPartialPaymentEnabled(false);
    commitLocalDoc({
      customerId: '',
      invoiceId: '',
      creditNoteId: '',
      date: new Date().toISOString().split('T')[0],
      dueDate: '',
      amount: 0,
      currency: initialLine.currency,
      exchangeRate: initialLine.exchangeRate,
      method: initialLine.method,
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
    const effectiveLines = paymentLines
      .map((line) => ({ ...line, amount: Number(line.amount || 0), reference: String(line.reference || '').trim() }))
      .filter((line) => line.amount > 0);
    if (!effectiveLines.length) { toast.error('Agrega al menos un medio de pago con monto mayor a 0'); return; }
    const linkedDocument = linkedPaymentDocument;
    const documentBalanceBase = linkedDocumentBalanceBase;
    if (linkedDocument && paymentChangeBase > 0.01 && !cashCoversPaymentChange(effectiveLines, documentBalanceBase, getPaymentLineBase)) {
      toast.error('No se puede dar vuelto de una tarjeta, transferencia o banco. Reduce ese excedente o agrega efectivo.');
      return;
    }
    const submittedLines = linkedDocument
      ? allocatePaymentLinesToBalance(
        effectiveLines,
        documentBalanceBase,
        getPaymentLineBase,
        (appliedBase, line) => {
          const lineRate = line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate);
          return Number(convertBetweenCurrencies(appliedBase, baseCurrency, line.currency, 1, lineRate).toFixed(2));
        },
      )
      : effectiveLines;
    const appliedBase = linkedDocument ? getPaymentTotalBase(submittedLines, getPaymentLineBase) : 0;
    const remainingToApplyBase = linkedDocument ? Math.max(0, documentBalanceBase - appliedBase) : 0;
    if (linkedDocument && !submittedLines.length) {
      toast.error('El documento seleccionado no tiene saldo pendiente.');
      return;
    }
    if (linkedDocument && remainingToApplyBase > 0.01 && !partialPaymentEnabled) {
      toast.error('Activa "Pago parcial" para registrar un importe menor al saldo del documento.');
      return;
    }
    if (linkedDocument && localDoc.invoiceId && remainingToApplyBase > 0.01 && !paymentPartialCreditFits) {
      toast.error('El saldo restante supera el crédito disponible del cliente. Reduce el monto del pago para habilitar Pago parcial.');
      return;
    }
    if (linkedDocument && remainingToApplyBase > 0.01 && !localDoc.dueDate) {
      toast.error('Indica la fecha límite para el saldo restante.');
      return;
    }
    const customerFavorAppliedBase = submittedLines
      .filter((line) => line.method === 'CUSTOMER_BALANCE')
      .reduce((sum, line) => sum + toBaseAmount(
        line.amount,
        line.currency,
        line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
      ), 0);
    if (customerFavorAppliedBase > paymentCustomerFavorBase + 0.01) { toast.error(`El saldo a favor disponible es de ${formatConvertedAmount(paymentCustomerFavorBase, baseCurrency)}`); return; }
    if (customerFavorAppliedBase > 0.01 && !localDoc.invoiceId && !localDoc.creditNoteId) { toast.error('Selecciona una factura o crédito pendiente para aplicar el saldo a favor'); return; }
    if (submittedLines.some((line) => requiresPaymentReference(line.method) && !line.reference)) { toast.error('La referencia es obligatoria para tarjeta, transferencia o cheque'); return; }
    if (submittedLines.some((line) => requiresManualPaymentAccount(line.method) && !line.accountId)) { toast.error('Selecciona la cuenta contable que recibirá cada pago'); return; }
    if (submittedLines.some((line) => isBankPaymentMethod(line.method, true) && !line.bankAccountId)) { toast.error('Selecciona el banco global donde se recibió cada pago'); return; }
    const saveToastId = toast.loading('Registrando pago...');
    try {
      const firstLine = submittedLines[0];
      const payload = {
        customerId: localDoc.customerId,
        invoiceId: localDoc.invoiceId || undefined,
        creditNoteId: localDoc.creditNoteId || undefined,
        date: new Date(localDoc.date).toISOString(),
        amount: Number(submittedLines.reduce((sum, line) => sum + line.amount, 0).toFixed(2)),
        currency: firstLine.currency,
        exchangeRate: firstLine.exchangeRate,
        method: firstLine.method,
        accountId: requiresManualPaymentAccount(firstLine.method) ? firstLine.accountId : undefined,
        bankAccountId: isBankPaymentMethod(firstLine.method, true) ? firstLine.bankAccountId : undefined,
        reference: hasPaymentReferenceField(firstLine.method) ? firstLine.reference : undefined,
        notes: localDoc.notes || undefined,
        dueDate: remainingToApplyBase > 0.01 ? new Date(`${localDoc.dueDate}T12:00:00`).toISOString() : undefined,
        cashRegisterId: cashRegisterId || undefined,
        cashSessionId: cashSession?.id || undefined,
        cardCommissionPercent: isCardPaymentMethod(firstLine.method) ? firstLine.cardCommissionPercent || undefined : undefined,
        cardCommissionAmount: isCardPaymentMethod(firstLine.method) ? firstLine.cardCommissionAmount || undefined : undefined,
        cardCommissionAccountId: isCardPaymentMethod(firstLine.method) ? firstLine.cardCommissionAccountId || undefined : undefined,
      } as any;
      if (submittedLines.length > 1) {
        await paymentsService.createMixed({
          ...payload,
          payments: submittedLines.map((line) => ({
            method: line.method,
            amount: line.amount,
            currency: line.currency,
            exchangeRate: line.exchangeRate,
            accountId: requiresManualPaymentAccount(line.method) ? line.accountId : undefined,
            bankAccountId: isBankPaymentMethod(line.method, true) ? line.bankAccountId : undefined,
            reference: hasPaymentReferenceField(line.method) ? line.reference : undefined,
            notes: localDoc.notes || undefined,
            cardCommissionPercent: isCardPaymentMethod(line.method) ? line.cardCommissionPercent || undefined : undefined,
            cardCommissionAmount: isCardPaymentMethod(line.method) ? line.cardCommissionAmount || undefined : undefined,
            cardCommissionAccountId: isCardPaymentMethod(line.method) ? line.cardCommissionAccountId || undefined : undefined,
          })),
        } as any);
      } else {
        await paymentsService.create(payload as any);
      }
      toast.success('Pago registrado', { id: saveToastId });
      clearSalesEditorDraft(salesDraftStorageKey);
      localDocRef.current = null;
      setIsCreating(false); commitLocalDoc(null); setPaymentLines([]); setMixedPaymentEnabled(false); setPartialPaymentEnabled(false); onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'No se pudo registrar el pago', { id: saveToastId }); }
  };

  const handleExportPDF = async (row: PaymentReceived, format: PdfDownloadFormat = 'configured') => {
    const previewToastId = toast.loading('Preparando la previsualización del comprobante...');
    try {
      const tenantName = user?.sessionBranding?.name || user?.tenantName || 'Mi Empresa';
      const paymentRows = row.payments?.length ? row.payments : [row];
      const documentReference = row.invoice?.number || row.creditNote?.number || 'Anticipo';
      await previewSalesTransactionPDF({
        document: {
          ...row,
          number: row.number,
          customer: row.customer,
          notes: `${row.notes || ''}${row.notes ? '\n' : ''}Documento aplicado: ${documentReference}`,
          items: paymentRows.map((payment) => ({
            description: `Pago ${paymentMethodLabel(String(payment.method || row.method).toUpperCase())}${payment.reference ? ` · Ref. ${payment.reference}` : ''}`,
            quantity: 1,
            unitPrice: Number(payment.amount || 0),
            total: Number(payment.amount || 0),
            currency: payment.currency,
          })),
        },
        tenantName,
        formatAmount: formatConvertedAmount,
        tenantLogo: themeConfig?.logo,
        documentType: 'payment',
        format,
      });
      toast.success('Previsualización abierta. Descargá el PDF desde el visor del navegador.', { id: previewToastId });
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'No se pudo abrir la previsualización', { id: previewToastId }); }
  };

  // Invoices filtered by selected customer
  const customerInvoices = localDoc?.customerId
    ? invoices.filter(i => i.customerId === localDoc.customerId && ['PENDING', 'PARTIAL', 'OVERDUE', 'CREDIT'].includes((i.status || '').toUpperCase()))
    : [];

  const setPaymentDocument = (kind: 'invoice' | 'creditNote', id: string) => {
    const document = kind === 'invoice'
      ? invoices.find((invoice) => invoice.id === id)
      : credits.find((credit) => credit.id === id);
    const currentLine = paymentLines[0] || paymentLine('TRANSFER');
    const sourceAmount = document
      ? Number((document as any).balance ?? (document as any).total ?? 0)
      : 0;
    const amount = document
      ? Number(convertBetweenCurrencies(
        sourceAmount,
        (document as any).currency,
        currentLine.currency,
        Number((document as any).exchangeRate || globalRate),
        currentLine.exchangeRate,
      ).toFixed(2))
      : 0;
    const nextLines = paymentLines.length
      ? paymentLines.map((line, index) => index === 0 ? { ...line, amount } : line)
      : [{ ...currentLine, amount }];
    setPaymentLines(nextLines);
    setPartialPaymentEnabled(false);
    setLocalDoc({
      ...localDoc,
      invoiceId: kind === 'invoice' ? id : '',
      creditNoteId: kind === 'creditNote' ? id : '',
      amount,
      currency: currentLine.currency,
      exchangeRate: currentLine.exchangeRate,
      dueDate: '',
    });
  };

  const columns: ColumnDef<PaymentReceived>[] = [
    { key: 'number', header: 'N° Pago', width: '120px', render: (val) => <span className="text-[11px] font-black font-mono text-muted-foreground/60">{val}</span> },
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
      if (!val) return <span className="text-xs text-muted-foreground">Sin fecha</span>;
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

  const paymentMethodCounts = groupedPayments.reduce((acc, payment) => {
    // Un pago mixto se representa como una fila agrupada en la tabla, pero sus
    // métodos reales viven en `payments`. El KPI debe contar esas líneas y no
    // la etiqueta sintética MIXED del grupo.
    const movements = payment.payments?.length ? payment.payments : [payment];
    movements
      .filter((movement) => movement.isActive !== false)
      .forEach((movement) => {
        const method = String(movement.method || '').trim().toUpperCase();
        if (method) acc[method] = (acc[method] || 0) + 1;
      });
    return acc;
  }, {} as Record<string, number>);

  const rawMainMethod = Object.entries(paymentMethodCounts)
    .sort(([methodA, countA], [methodB, countB]) => countB - countA || methodA.localeCompare(methodB))[0]?.[0] || 'SIN_DATOS';
  const mainMethod = rawMainMethod === 'SIN_DATOS' ? 'Sin datos' : paymentMethodLabel(rawMainMethod);

  const totalCollectedInDisplayCurrency = groupedPayments.reduce(
    (acc, payment) => acc + (payment.baseAmount !== null && payment.baseAmount !== undefined
      ? Number(payment.baseAmount)
      : toBaseAmount(payment.amount || 0, payment.currency, payment.exchangeRate || globalRate)),
    0,
  );
  const originalCollectedAmounts = summarizeAmountsByCurrency(
    data.filter((payment) => payment.isActive !== false),
    (payment) => Number(payment.amount || 0),
    (payment) => payment.currency,
    baseCurrency,
  );

  const detailDocument = detailPayment?.invoice || detailPayment?.creditNote?.invoice || detailPayment?.creditNote;
  const detailCharges = getSalesAdditionalCharges(detailDocument).filter((charge) => charge.amount > 0.001);
  const detailTotal = Number(detailDocument?.total || 0);
  const detailBalance = Math.max(0, Number(detailDocument?.balance ?? detailTotal - Number(detailDocument?.amountPaid || 0)));
  const detailPaid = detailTotal > 0 ? Math.min(detailTotal, Math.max(0, detailTotal - detailBalance)) : 0;
  const detailFinancialRows = [
    { label: 'Subtotal', amount: Math.max(0, Number(detailDocument?.subtotal || 0)) },
    { label: 'Descuento', amount: Math.max(0, Number(detailDocument?.discountAmount || 0)), negative: true },
    { label: 'IVA', amount: Math.max(0, Number(detailDocument?.taxAmount || 0)) },
    ...detailCharges.map((charge) => ({ label: charge.description || 'Coste extra', amount: charge.amount, negative: false })),
  ].filter((row) => row.amount > 0.001);
  const showDetailFinancials = Boolean(detailDocument && (detailFinancialRows.length || detailTotal > 0));
  const detailCurrency = String(detailDocument?.currency || detailPayment?.currency || baseCurrency).toUpperCase();
  const detailRate = Number(detailDocument?.exchangeRate || detailPayment?.exchangeRate || 1) || 1;
  const detailIsCreditSettled = Boolean(detailPayment?.creditNoteId || detailPayment?.creditNote)
    && String(detailPayment?.creditNote?.status || detailPayment?.invoice?.status || '').toUpperCase() === 'PAID';
  const detailDocumentStatus = detailPayment?.invoice?.status || detailPayment?.creditNote?.status;

  // ─── INLINE FORM ────────────────────────────────────────────────────
  if (isCreating && localDoc) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300" data-tour="sales-form-title">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => { clearSalesEditorDraft(salesDraftStorageKey); localDocRef.current = null; setIsCreating(false); commitLocalDoc(null); setPaymentLines([]); setMixedPaymentEnabled(false); setPartialPaymentEnabled(false); }} className="rounded-full"><ChevronLeft className="size-5" /></Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Registrar Pago</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Completar datos del pago recibido</p>
            </div>
          </div>
          <div className="flex items-center gap-3" data-tour="sales-form-actions">
            <SalesViewTutorial view="payments" context="form" />
            {canPerform('SALES_PAYMENTS', 'create') && canPerform('SALES_PAYMENTS', 'approve') && (
            <Button className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6" onClick={handleSave} disabled={paymentCustomerFavorExceeded || paymentChangeUnsupported || Boolean(cashRegisterId && (cashLoading || !cashSession)) || (Boolean(linkedPaymentDocument) && paymentRemainingBase > 0.01 && (!partialPaymentEnabled || !paymentPartialCreditFits || !localDoc.dueDate)) || !paymentLines.some((line) => Number(line.amount || 0) > 0) || paymentLines.some((line) => requiresPaymentReference(line.method) && !String(line.reference || '').trim()) || paymentLines.some((line) => requiresManualPaymentAccount(line.method) && !line.accountId) || paymentLines.some((line) => isBankPaymentMethod(line.method, true) && !line.bankAccountId)}>
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
                    onChange={(val) => { setLocalDoc({ ...localDoc, customerId: val, invoiceId: '', creditNoteId: '', amount: 0 }); setPaymentLines((current) => current.map((line, index) => index === 0 ? { ...line, amount: 0 } : line)); }}
                    placeholder="Seleccionar Cliente" 
                  /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Factura (Opcional)</p>
                  <Combobox options={customerInvoices.map(i => ({
                    label: `${i.number} — ${formatConvertedAmount(Number(i.balance || 0), i.currency, i.exchangeRate)} pend.`,
                    value: i.id,
                  }))}
                    value={localDoc.invoiceId} onChange={(val) => setPaymentDocument('invoice', val)} placeholder="Sin factura (anticipo)" /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Crédito a liquidar (Opcional)</p>
                  <Combobox options={credits.filter((credit) => credit.customerId === localDoc.customerId && ['ISSUED', 'PARTIAL', 'APPLIED'].includes(String(credit.status || '').toUpperCase()) && Number(credit.balance ?? credit.total ?? 0) > 0).map((credit) => ({
                    label: `${credit.number} — ${formatConvertedAmount(Number(credit.balance ?? credit.total ?? 0), credit.currency, credit.exchangeRate)} pend.`,
                    value: credit.id,
                  }))}
                    value={localDoc.creditNoteId} onChange={(val) => setPaymentDocument('creditNote', val)} placeholder="Sin crédito" /></div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Fecha</p>
                  <Input type="date" value={localDoc.date} onChange={(e) => setLocalDoc({ ...localDoc, date: e.target.value })} className="h-8 text-xs" /></div>
                <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3 text-xs text-muted-foreground sm:col-span-2">
                  Selecciona una o varias formas de pago. Cada línea puede llevar su propia moneda, banco y referencia.
                </div>
                {linkedPaymentDocument && <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-3 sm:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">Liquidación del documento</p><p className="mt-1 text-xs text-muted-foreground">Puedes registrar solo una parte y completar el saldo después.</p></div>
                  </div>
                  {partialPaymentEnabled && <div className="mt-3 max-w-xs"><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Fecha límite del saldo restante</p><Input type="date" value={localDoc.dueDate || ''} onChange={(event) => setLocalDoc({ ...localDoc, dueDate: event.target.value })} className="h-9 text-xs" /></div>}
                </div>}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50" data-tour="sales-form-summary">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Monto</p>
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Formas de pago</p>
                    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
                      {linkedPaymentDocument && <label
                        className={cn(
                          'flex items-center gap-2 text-[10px] font-black uppercase tracking-widest',
                          paymentPartialCreditFits ? 'cursor-pointer text-muted-foreground' : 'cursor-not-allowed text-muted-foreground/50',
                        )}
                        title={!paymentPartialCreditFits ? 'El saldo restante supera el crédito disponible del cliente' : undefined}
                      >
                        <Switch checked={paymentPartialActive} onCheckedChange={setPartialPaymentEnabled} disabled={!paymentPartialCreditFits} aria-label="Activar pago parcial" />
                        Pago parcial
                      </label>}
                      <label className="flex cursor-pointer items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        <Switch
                          checked={mixedPaymentEnabled}
                          onCheckedChange={(checked) => {
                            setMixedPaymentEnabled(checked);
                            if (!checked) setPaymentLines((current) => current.slice(0, 1));
                          }}
                          aria-label="Activar pago mixto"
                        />
                        Pago mixto
                      </label>
                    </div>
                  </div>
                  {linkedPaymentDocument && paymentRemainingBase > 0.01 && !paymentPartialCreditFits && !paymentHasActiveCredit && <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400">El saldo restante supera el crédito disponible del cliente. Reduce el monto del pago para habilitar Pago parcial.</p>}
                  {paymentLines.map((line, index) => (
                    <div key={`${index}-${line.method}`} className="rounded-xl border border-border/60 bg-background/70 p-3">
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(7rem,10rem)_minmax(7rem,10rem)_auto] sm:items-start">
                        <div><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Método</p><Select value={line.method} onValueChange={(nextMethod) => handlePaymentMethodChange(index, nextMethod as ReceivedPaymentLine['method'])}><SelectTrigger size="sm" className="h-9 w-full rounded-lg border-input bg-background px-2 text-xs font-bold uppercase"><SelectValue /></SelectTrigger><SelectContent>{methodOptions.filter((method) => method.value !== 'CUSTOMER_BALANCE' || (paymentCustomerFavorBase > 0.01 && Boolean(localDoc.invoiceId || localDoc.creditNoteId))).map((method) => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}</SelectContent></Select></div>
                        <CurrencySelector value={line.currency} baseCurrency={baseCurrency} exchangeRate={globalRate} label="Moneda" disabled={line.method === 'CUSTOMER_BALANCE'} onChange={(nextCurrency) => setPaymentLines((current) => current.map((item, itemIndex) => {
                          if (itemIndex !== index) return item;
                          const previousRate = item.currency === baseCurrency ? 1 : Number(item.exchangeRate || globalRate);
                          const nextRate = paymentLineRate(nextCurrency);
                          return { ...item, amount: Number(convertBetweenCurrencies(Number(item.amount || 0), item.currency, nextCurrency, previousRate, nextRate).toFixed(2)), currency: nextCurrency, exchangeRate: nextRate };
                        }))} />
                        <div><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Monto ({line.currency})</p><Input type="number" min="0" step="0.01" value={line.amount || ''} onChange={(event) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: Number(event.target.value) || 0, cardCommissionAmount: isCardPaymentMethod(item.method) ? calculateCardCommission(Number(event.target.value) || 0, Number(item.cardCommissionPercent || 0)) : item.cardCommissionAmount } : item))} className="h-9 text-xs tabular-nums" /></div>
                        <Button type="button" variant="ghost" size="icon" disabled={paymentLines.length === 1} onClick={() => setPaymentLines((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Eliminar medio de pago" className="size-9 shrink-0 text-muted-foreground hover:text-rose-500"><Trash2 className="size-4" /></Button>
                      </div>
                      {line.method === 'CUSTOMER_BALANCE' && <p className="mt-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Disponible a favor: {formatConvertedAmount(paymentCustomerFavorBase, baseCurrency)}. Puedes aplicar solo una parte.</p>}
                      {isBankPaymentMethod(line.method, true) && <BankAccountSelect value={line.bankAccountId} onChange={(bankAccountId) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, bankAccountId } : item))} onAccountSelect={(account) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, cardCommissionPercent: account?.cardCommissionPercent || 0, cardCommissionAmount: isCardPaymentMethod(item.method) ? calculateCardCommission(Number(item.amount || 0), account?.cardCommissionPercent || 0) : 0, cardCommissionAccountId: account?.cardCommissionAccountId || undefined } : item))} label="Banco global de destino" className="mt-2" />}
                      {isCardPaymentMethod(line.method) && line.bankAccountId && Number(line.cardCommissionPercent || 0) > 0 && (
                        <div className="mt-2 flex items-center gap-3 rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-[10px]">
                          <span className="font-black uppercase tracking-widest text-purple-600">Comisión:</span>
                          <span className="font-mono font-bold">{formatCommissionPercent(line.cardCommissionPercent)}</span>
                          <span className="text-muted-foreground">|</span>
                          <span className="font-black uppercase tracking-widest text-muted-foreground">Monto:</span>
                          <span className="font-mono font-bold text-purple-600">{line.currency === 'USD' ? '$' : 'C$'} {formatConvertedAmount(Number(line.cardCommissionAmount || calculateCardCommission(Number(line.amount || 0), Number(line.cardCommissionPercent || 0))), baseCurrency)}</span>
                        </div>
                      )}
                      {hasPaymentReferenceField(line.method) && <div className="mt-2"><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Referencia *</p><Input value={line.reference || ''} onChange={(event) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, reference: event.target.value } : item))} placeholder="Transferencia, voucher o cheque..." required={requiresPaymentReference(line.method)} className="h-9 text-xs" /></div>}
                    </div>
                  ))}
                  {mixedPaymentEnabled && <Button type="button" variant="outline" className="w-full rounded-xl border-dashed text-[10px] font-black uppercase tracking-widest" onClick={() => setPaymentLines((current) => [...current, paymentLine('CASH')])}><Plus className="mr-2 size-4" /> Agregar pago mixto</Button>}
                  <div className="flex items-center justify-between border-t border-border/50 pt-3 text-xs"><span className="font-black uppercase tracking-widest text-muted-foreground">Total aplicado (base)</span><span className="font-black text-primary">{formatConvertedAmount(paymentTotalBase, baseCurrency)}</span></div>
                   {linkedPaymentDocument && <div className="flex items-center justify-between text-xs"><span className={cn("font-black uppercase tracking-widest", paymentSettlementLabel === 'Falta por pagar' ? 'text-amber-600' : 'text-muted-foreground')}>{paymentSettlementLabel}</span><span className={cn("font-black", paymentSettlementLabel === 'Falta por pagar' ? 'text-amber-600' : 'text-emerald-600 dark:text-emerald-400')}>{formatConvertedAmount(paymentSettlementLabel === 'Falta por pagar' ? paymentRemainingBase : paymentChangeBase, baseCurrency)}</span></div>}
                  {!linkedPaymentDocument && <div className="flex items-center justify-between text-xs"><span className="font-black uppercase tracking-widest text-muted-foreground">Destino</span><span className="font-black text-muted-foreground">Anticipo de cliente</span></div>}
                   {paymentChangeBase > 0.01 && <p className={cn("rounded-lg px-3 py-2 text-[10px] font-bold", paymentChangeUnsupported ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600')}>{paymentChangeUnsupported ? 'No se puede dar vuelto de una tarjeta, transferencia o banco. El excedente debe ser efectivo.' : `Vuelto por dar: ${formatConvertedAmount(paymentChangeBase, baseCurrency)} · efectivo disponible: ${formatConvertedAmount(paymentCashBase, baseCurrency)}`}</p>}
                </div>
                {linkedPaymentDocument && <div className="space-y-2 rounded-xl border border-border/60 bg-muted/10 p-3">
                  <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Caja (opcional)</p>{cashSession && <span className="text-[10px] font-black text-emerald-600">Abierta</span>}</div>
                  {cashRegisters.length > 0 ? <Select value={cashRegisterId || '__none__'} onValueChange={(value) => setCashRegisterId(value === '__none__' ? '' : value)} disabled={cashLoading}><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Selecciona la caja donde se recibió el pago" /></SelectTrigger><SelectContent><SelectItem value="__none__">Sin caja</SelectItem>{cashRegisters.map((register) => <SelectItem key={register.id} value={register.id}>{register.name} · {register.code}</SelectItem>)}</SelectContent></Select> : <p className="text-[10px] font-medium text-muted-foreground">Sin caja abierta. El pago se registrará sin movimiento en Control de Caja.</p>}
                  {cashRegisterId && !cashSession && !cashLoading && <p className="text-[10px] text-rose-600">La caja seleccionada no tiene una sesión abierta disponible.</p>}
                </div>}
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
        {displayMode === 'ORIGINAL'
          ? originalCollectedAmounts.map((summary) => <SalesKpiCard key={`collected-${summary.currency}`} title={`Total Recaudado (${summary.currency})`} value={formatExplicitAmount(summary.amount, summary.currency)} icon={TrendingUp} color="text-emerald-500" bg="bg-emerald-500/10" />)
          : <SalesKpiCard title={`Total Recaudado (${displayCurrency})`} value={formatConvertedAmount(totalCollectedInDisplayCurrency, baseCurrency)} icon={TrendingUp} color="text-emerald-500" bg="bg-emerald-500/10" />}
        <SalesKpiCard title="Pagos" value={groupedPayments.length} icon={CheckCircle2} color="text-blue-500" bg="bg-blue-500/10" />
        <SalesKpiCard title="Con documento" value={groupedPayments.filter(p => p.invoice?.number || p.creditNote?.number).length} icon={Clock} color="text-amber-500" bg="bg-amber-500/10" active={invoiceFilter === 'WITH_INVOICE'} onClick={() => setInvoiceFilter(invoiceFilter === 'WITH_INVOICE' ? 'ALL' : 'WITH_INVOICE')} />
        <SalesKpiCard title="Método Principal" value={mainMethod} icon={Wallet} color="text-purple-500" bg="bg-purple-500/10" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-2">
          <div><h2 className="text-xl font-black uppercase tracking-tight text-foreground" data-tour="sales-list-title">Pagos Recibidos</h2>
            </div>
          <div className="erp-list-toolbar flex flex-wrap items-center justify-end gap-3" data-tour="sales-list-actions">
            <SalesViewTutorial view="payments" />
            <ViewLayoutSelect value={layoutMode} onChange={(value) => setLayoutMode(value === 'kanban' ? 'table' : value)} ariaLabel="Elegir distribución de pagos recibidos" />
            <SalesDateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChange={onDateRangeChange || (() => undefined)} />
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input placeholder="Buscar pago..." className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold tracking-widest" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }} /></div>
            {salesAlert && <PurchaseAlertsButton alert={salesAlert} sectionLabel="ventas" storageNamespace="erp-sales-alerts" onItemSelect={setHighlightedAlertId} />}
            {canPerform('SALES_PAYMENTS', 'create') && canPerform('SALES_PAYMENTS', 'approve') && (
              <Button onClick={startNew} data-toolbar-role="primary" className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20">
                <Plus className="size-4" /> Registrar Pago</Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filteredData}
          pagination={pagination}
          columns={columns} onRowUpdate={handleUpdate} onRowClick={(row) => setDetailPayment(row)} isLoading={loading} actionsWidth="w-28" fitContent showHorizontalControls
          showSelection={false}
          layoutMode={layoutMode}
          highlightedRowId={highlightedAlertId}
          actions={(row) => (
            <div className="flex items-center gap-1">
              <Button title="Ver detalle" aria-label={`Ver detalle del pago ${row.number}`} variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setDetailPayment(row)}><Eye className="size-4" /></Button>
            </div>
          )}
        />
      </div>

      <Sheet open={Boolean(detailPayment)} onOpenChange={(open) => { if (!open) setDetailPayment(null); }}>
        <SheetContent side="right" className="erp-detail-panel erp-detail-panel--compact flex w-full min-w-0 flex-col gap-0 overflow-hidden border-l border-border/50 bg-background p-0">
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
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-bold tracking-wider text-muted-foreground">
                  <Badge className={cn('border-none', detailIsCreditSettled ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600')}>{detailIsCreditSettled ? 'Cancelado' : 'Registrado'}</Badge>
                  <Badge variant="outline" className="border-primary/20 text-primary">{detailPayment.paymentLabel || 'Pago único'}</Badge>
                  {detailDocumentStatus && <Badge variant="outline" className="border-amber-500/30 text-amber-700 dark:text-amber-300">Estado: {formatPaymentStatus(detailDocumentStatus)}</Badge>}
                  <span>Moneda: {currencyLabels[String(detailPayment.currency || baseCurrency).toUpperCase()] || 'No especificada'}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <PdfDownloadButton onDownload={(format) => { void handleExportPDF(detailPayment, format); }} />
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

              {showDetailFinancials && detailDocument && (
                <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/[0.03] p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resumen del documento</p>
                  <div className="space-y-2 text-sm">
                    {detailFinancialRows.map((row) => (
                      <div key={row.label} className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-semibold tabular-nums">{row.negative ? '- ' : ''}{formatConvertedAmount(row.amount, detailCurrency, detailRate)}</span>
                      </div>
                    ))}
                    <div className="border-t border-border/50 pt-2">
                      <div className="flex items-center justify-between gap-4"><span className="font-black">Monto total</span><span className="font-black tabular-nums text-primary">{formatConvertedAmount(detailTotal, detailCurrency, detailRate)}</span></div>
                      <div className="mt-2 flex items-center justify-between gap-4"><span className="text-muted-foreground">Abonado</span><span className="font-semibold tabular-nums text-emerald-600">{formatConvertedAmount(detailPaid, detailCurrency, detailRate)}</span></div>
                      <div className="mt-2 flex items-center justify-between gap-4"><span className="text-muted-foreground">Saldo pendiente</span><span className={cn('font-semibold tabular-nums', detailBalance > 0.001 ? 'text-amber-600' : 'text-emerald-600')}>{formatConvertedAmount(detailBalance, detailCurrency, detailRate)}</span></div>
                    </div>
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
          <SheetFooter className="flex-row flex-wrap justify-end border-t border-border/50 px-5 py-3 sm:px-6">
            <Button type="button" variant="outline" className="min-w-24 rounded-xl" onClick={() => setDetailPayment(null)}>Cerrar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

    </div>
  );
}

