import { useEffect, useRef, useState } from 'react';
import {
  BadgeDollarSign, Plus, Search, TrendingUp, Clock, CheckCircle2, CircleDollarSign,
  Eye, Trash2, ChevronLeft, Send, CreditCard, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { creditNotesService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import type { CreditNote, Customer, Product, SalesPaginationControls } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { BankAccountSelect } from '../ui/BankAccountSelect';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { previewSalesTransactionPDF } from '../../utils/pdfGenerator';
import { SalesAccountingLegend } from './SalesAccountingLegend';
import { SalesDateRangeFilter } from './SalesDateRangeFilter';
import { SalesViewTutorial } from './SalesViewTutorial';
import type { PdfDownloadFormat } from '../../utils/pdfDownloadFormats';
import { SalesKpiCard } from './SalesKpiCard';
import { SalesLinePriceListSelect, PriceMissingBadge } from './SalesLinePriceListSelect';
import { hasSalesProductPriceListConflict, hasSalesProductPriceListConflicts } from '../../utils/salesPriceList';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { formatDateEs } from '../../utils/dateFormat';
import { SALES_STATUS_COLORS, SALES_WORKFLOW_STATUS_COLORS } from '../../utils/salesStatus';
import { isBankPaymentMethod, requiresManualPaymentAccount, requiresPaymentReference, isCardPaymentMethod, calculateCardCommission, formatCommissionPercent } from '../../utils/paymentMethods';
import { SalesDocumentDetailSheet, type SalesDocumentPanelData } from './SalesDocumentDetailSheet';
import { CurrencySelector } from '../ui/CurrencySelector';
import { Switch } from '../ui/switch';
import { SalesWarehouseSelect, getDefaultSalesWarehouseId } from './SalesWarehouseSelect';
import { clearSalesEditorDraft, getSalesEditorDraftKey, readSalesEditorDraft, writeSalesEditorDraft } from '../../services/sales-draft-storage';
import { SalesWarehouseStockHint } from './SalesWarehouseStockHint';
import { getCustomerAvailableCreditAmount, getCustomerDebtAmount, getCustomerFavorAmount, getMaximumCustomerFavorToApply } from '../../utils/customerBalance';

interface NotasCreditoViewProps {
  data: CreditNote[];
  loading: boolean;
  onRefresh: () => void;
  customers?: Customer[];
  products?: Product[];
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
  { label: 'Cancelado', value: 'PAID', color: SALES_WORKFLOW_STATUS_COLORS.CANCELLED },
  { label: 'Anulado', value: 'VOIDED', color: SALES_STATUS_COLORS.VOIDED },
];

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

export function NotasCreditoView({ data, loading, onRefresh, customers = [], products = [], warehouses = [], pagination, onSearchChange, dateFrom = '', dateTo = '', onDateRangeChange }: NotasCreditoViewProps) {
  const { exchangeRate: globalRate, displayCurrency, baseCurrency, formatConvertedAmount, toBaseAmount, convertBetweenCurrencies } = useCurrency();
  const { user, canPerform } = useAuth();
  const { themeConfig } = useTheme();
  const salesDraftStorageKey = getSalesEditorDraftKey('credit-note', user?.tenantId, user?.id);
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('sales-credits-layout', 'table', 24 * 365);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'ISSUED' | 'PARTIAL' | 'APPLIED' | 'PAID'>('ALL');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<any>(null);
  const [detailCredit, setDetailCredit] = useState<CreditNote | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [paymentCredit, setPaymentCredit] = useState<CreditNote | null>(null);
  const [paymentLines, setPaymentLines] = useState<CreditPaymentLine[]>([]);
  const [mixedPaymentEnabled, setMixedPaymentEnabled] = useState(false);
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
      if (stored) {
        if (stored.document) commitLocalDoc(stored.document);
        if (stored.editingId) setEditingId(stored.editingId);
        setIsCreating(Boolean(stored.isCreating));
      }
      setDraftHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [salesDraftStorageKey]);

  useEffect(() => {
    if (!draftHydrated || !salesDraftStorageKey) return;
    if (!localDoc || (!editingId && !isCreating)) {
      clearSalesEditorDraft(salesDraftStorageKey);
      return;
    }
    writeSalesEditorDraft(salesDraftStorageKey, { editingId, isCreating, document: localDoc });
  }, [draftHydrated, editingId, isCreating, localDoc, salesDraftStorageKey]);

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
  const paymentChangeInCreditCurrency = !mixedPaymentEnabled && paymentLines.length === 1 && paymentLines[0]?.method === 'CASH'
    ? Math.max(0, paymentReceivedInCreditCurrency - paymentCreditBalance)
    : 0;
  // Un abono menor al saldo es válido para cualquier método. Solo se bloquea
  // el sobrepago en pagos mixtos o métodos que no permiten cambio; efectivo
  // puede exceder el saldo porque handlePayment calcula el vuelto y aplica
  // únicamente lo necesario al crédito.
  const paymentAmountMismatch = paymentTotalBase > paymentCreditBalanceBase + 0.01
    && (mixedPaymentEnabled || paymentLines.length !== 1 || paymentLines[0]?.method !== 'CASH');

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
      return { ...nextLine, amount: maximumBase.toFixed(2), currency: baseCurrency, exchangeRate: 1 };
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
  const getItemCatalog = (item: any) => {
    const catalog = resolveItemType(item) === 'SERVICE' ? serviceCatalog : productCatalog;
    if (!item?.productId || catalog.some((product) => product.id === item.productId)) return catalog;
    const linkedProduct = products.find((product) => product.id === item.productId);
    return [...catalog, linkedProduct || { id: item.productId, code: '', name: item.description || 'Artículo vinculado', itemType: item.itemType || 'PRODUCT' }];
  };
  const customerName = (row: CreditNote) => row.customer?.name || customerFor(row.customerId)?.name || 'Cliente';
  const sourceInvoiceTotal = (row: CreditNote) => Number(row.invoice?.total ?? row.total ?? 0);
  const sourceInvoicePaid = (row: CreditNote) => {
    if (!row.invoice) return Number(row.amountPaid ?? 0);
    const reportedPaid = Number(row.invoice.amountPaid);
    if (Number.isFinite(reportedPaid) && reportedPaid > 0.01) return reportedPaid;
    // Compatibilidad con respuestas antiguas que todavía no incluyen
    // invoice.amountPaid: el crédito conserva exactamente el saldo pendiente.
    return Math.max(0, Number((sourceInvoiceTotal(row) - creditDebt(row)).toFixed(2)));
  };
  const sourceCurrency = (row: CreditNote) => row.invoice?.currency || row.currency;
  const sourceExchangeRate = (row: CreditNote) => row.invoice?.exchangeRate || row.exchangeRate;
  const creditDebt = (row: CreditNote) => Number(row.balance ?? row.total ?? 0);
  const normalizeStatus = (status?: string) => String(status || '').toUpperCase();
  const statusFor = (status?: string) => statusOptions.find((option) => option.value === normalizeStatus(status));
  const recalculateItems = (items: any[]) => {
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
      total: subtotal - discountAmount + taxAmount,
    };
  };
  const formatDate = (value?: string | null) => value ? formatDateEs(value) : 'Sin fecha';
  const availableCreditFor = (customer?: Customer) => {
    return getCustomerAvailableCreditAmount(customer);
  };

  const goToCustomers = () => {
    window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module: 'ventas', subModule: 'clientes' } }));
  };

  const showCreditLimitRequired = () => {
    toast.error('El cliente no tiene un límite de crédito configurado. Ve a Clientes para configurarlo.', {
      action: { label: 'Ir a Clientes', onClick: goToCustomers },
    });
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
    if (!record) return;
    clearSalesEditorDraft(salesDraftStorageKey);
    setEditingId(id);
    setIsCreating(false);
    commitLocalDoc(JSON.parse(JSON.stringify(record)));
  };

  const startNew = () => {
    clearSalesEditorDraft(salesDraftStorageKey);
    setIsCreating(true);
    setEditingId(null);
    commitLocalDoc({
      customerId: '',
      date: new Date().toISOString().split('T')[0],
      dueDate: addDays(new Date(), 30),
      reason: '',
      items: [],
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      total: 0,
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
    const saveToastId = toast.loading(isCreating ? 'Creando crédito...' : 'Guardando crédito...');
    try {
      const payload: any = {
        customerId: localDoc.customerId,
        date: new Date(localDoc.date).toISOString(),
        dueDate: new Date(localDoc.dueDate).toISOString(),
        reason: String(localDoc.reason).trim(),
        priceListId: localDoc.priceListId || undefined,
        items: localDoc.items.map((item: any) => ({
          productId: item.productId || undefined,
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
    if (!canPerform('SALES_CREDIT_NOTES', 'approve')) return;
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

  const openPayment = (credit: CreditNote) => {
    setPaymentCredit(credit);
    const nextCurrency = displayCurrency === 'USD' ? 'USD' : 'NIO';
    const nextRate = paymentLineRate(nextCurrency);
    const creditCurrency = credit.currency === 'USD' ? 'USD' : 'NIO';
    const creditBalance = Number(credit.balance ?? Number(credit.total || 0) - Number(credit.amountPaid || 0));
    const initialAmount = convertBetweenCurrencies(creditBalance, creditCurrency, nextCurrency, Number(credit.exchangeRate || globalRate || 1), nextRate);
    setPaymentLines([{ ...paymentLine('TRANSFER', initialAmount.toFixed(2), nextCurrency), reference: credit.number }]);
    setMixedPaymentEnabled(false);
  };

  const handlePayment = async () => {
    if (!canPerform('SALES_CREDIT_NOTES', 'approve')) return;
    if (!paymentCredit) return;
    const effectiveLines = paymentLines
      .map((line) => ({ ...line, amount: String(line.amount || '').replace(/,/g, ''), reference: String(line.reference || '').trim() }))
      .filter((line) => Number(line.amount) > 0);
    if (!effectiveLines.length) return void toast.error('Agrega al menos un medio de pago con monto mayor que cero');
    if (effectiveLines.some((line) => requiresManualPaymentAccount(line.method) && !line.accountId)) return void toast.error('Selecciona la cuenta contable para cada medio de pago');
    if (effectiveLines.some((line) => isBankPaymentMethod(line.method, true) && !line.bankAccountId)) return void toast.error('Selecciona el banco global para cada medio de pago bancario');
    if (effectiveLines.some((line) => requiresPaymentReference(line.method) && !line.reference)) return void toast.error('La referencia es obligatoria para transferencia, tarjeta o cheque');
    const creditCurrency = paymentCredit.currency === 'USD' ? 'USD' : 'NIO';
    const creditBalance = Number(paymentCredit.balance ?? Number(paymentCredit.total || 0) - Number(paymentCredit.amountPaid || 0));
    const creditBalanceBase = toBaseAmount(creditBalance, creditCurrency, Number(paymentCredit.exchangeRate || globalRate || 1));
    const submittedLines = !mixedPaymentEnabled && effectiveLines.length === 1 && effectiveLines[0].method === 'CASH'
      ? (() => {
        const line = effectiveLines[0];
        const lineRate = line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate || 1);
        const receivedBase = toBaseAmount(Number(line.amount || 0), line.currency, lineRate);
        if (receivedBase <= creditBalanceBase + 0.01) return effectiveLines;
        return [{
          ...line,
          amount: convertBetweenCurrencies(creditBalanceBase, baseCurrency, line.currency, 1, lineRate).toFixed(2),
        }];
      })()
      : effectiveLines;
    const submittedPaymentTotalBase = submittedLines.reduce((sum, line) => sum + toBaseAmount(
      Number(line.amount || 0),
      line.currency,
      line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
    ), 0);
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
    const paymentToastId = toast.loading('Registrando pago del crédito...');
    try {
      setPaymentLoading(true);
      const firstLine = submittedLines[0];
      await creditNotesService.apply(paymentCredit.id, {
        amount: Number(firstLine.amount),
        currency: firstLine.currency,
        paymentMethod: firstLine.method,
        accountId: requiresManualPaymentAccount(firstLine.method) ? firstLine.accountId : undefined,
        bankAccountId: isBankPaymentMethod(firstLine.method, true) ? firstLine.bankAccountId : undefined,
        reference: requiresPaymentReference(firstLine.method) ? firstLine.reference : undefined,
        payments: submittedLines.map((line) => ({
          method: line.method,
          amount: Number(line.amount),
          currency: line.currency,
          exchangeRate: line.exchangeRate,
          accountId: requiresManualPaymentAccount(line.method) ? line.accountId : undefined,
          bankAccountId: isBankPaymentMethod(line.method, true) ? line.bankAccountId : undefined,
          reference: requiresPaymentReference(line.method) ? line.reference : undefined,
        })),
      });
      toast.success('Pago registrado y enviado a Pagos Recibidos', { id: paymentToastId });
      setPaymentCredit(null);
      setPaymentLines([]);
      setMixedPaymentEnabled(false);
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo registrar el pago', { id: paymentToastId });
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleExportPDF = async (row: CreditNote, format: PdfDownloadFormat = 'configured') => {
    const previewToastId = toast.loading('Preparando la previsualización del crédito...');
    try {
      await previewSalesTransactionPDF({ document: { ...row, customer: row.customer || customerFor(row.customerId) }, tenantName: user?.sessionBranding?.name || user?.tenantName || 'Mi Empresa', formatAmount: formatConvertedAmount as any, tenantLogo: themeConfig?.logo, documentType: 'credit-note', format });
      toast.success('Previsualización abierta. Descargá el PDF desde el visor del navegador.', { id: previewToastId });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo abrir la previsualización', { id: previewToastId });
    }
  };

  const handleSendToCash = async (credit: CreditNote) => {
    if (!canPerform('SALES_CREDIT_NOTES', 'approve')) return;
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

  const buildCreditPanel = (row: CreditNote): SalesDocumentPanelData => ({
    id: row.id,
    number: row.number,
    title: 'Crédito',
    customerName: customerName(row),
    status: String(row.status || ''),
    sourceLabel: row.invoice?.number ? `Factura origen: ${row.invoice.number}` : undefined,
    totalLabel: formatConvertedAmount(Number(row.total || 0), row.currency, row.exchangeRate),
    summaryDetails: [
      { label: 'Pagado', value: formatConvertedAmount(Number(row.amountPaid || 0), row.currency, row.exchangeRate) },
      { label: 'Saldo', value: formatConvertedAmount(Number(row.balance ?? row.total ?? 0), row.currency, row.exchangeRate) },
    ],
    metadata: [
      { label: 'Fecha', value: formatDate(row.date) },
      { label: 'Vencimiento', value: formatDate(row.dueDate) },
      ...(row.invoice?.number ? [{ label: 'Factura origen', value: row.invoice.number }] : []),
    ],
    lines: (row.items || []).map((item) => ({
      id: item.id,
      description: item.description,
      secondaryLabel: item.commercialNoteSnapshot ? `Nota: ${item.commercialNoteSnapshot}` : undefined,
      quantity: Number(item.quantity || 0),
      unitPriceLabel: formatConvertedAmount(Number(item.unitPrice || 0), row.currency, row.exchangeRate),
      totalLabel: formatConvertedAmount(Number(item.total || 0), row.currency, row.exchangeRate),
    })),
    reason: row.reason,
  });

  const addItem = (itemType: 'PRODUCT' | 'SERVICE') => {
    if (Number(customerFor(localDoc?.customerId)?.creditLimit || 0) <= 0) {
      showCreditLimitRequired();
      return;
    }
    const items = [...(localDoc.items || []), { id: `${Date.now()}-${itemType}`, itemType, productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 0, discount: 0, total: 0, priceListId: itemType === 'SERVICE' ? null : (localDoc?.priceListId || null), priceMissing: false }];
    setLocalDoc({ ...localDoc, ...recalculateItems(items) });
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
    const convertedItems = (localDoc.items || []).map((item: any) => {
      const basePrice = previousCurrency === 'USD' ? Number(item.unitPrice || 0) * previousRate : Number(item.unitPrice || 0);
      const unitPrice = currency === 'USD' ? basePrice / exchangeRate : basePrice;
      return { ...item, unitPrice };
    });
    setLocalDoc({ ...localDoc, currency, exchangeRate, ...recalculateItems(convertedItems) });
  };

  const columns: ColumnDef<CreditNote>[] = [
    { key: 'number', header: 'N° Nota de crédito', width: '140px', render: (value, row) => <span className={cn('text-xs font-black font-mono text-primary', 'cursor-pointer hover:underline')} onClick={() => setDetailCredit(row)}>{value}</span> },
    { key: 'customerId', header: 'Cliente', headerExtra: <ColumnFilterMenu label="Cliente" options={distinctCustomers} selected={colFilters.state.customerId?.values || []} onSelect={(values) => colFilters.setValues('customerId', values)} sort={colFilters.state.customerId?.sort || null} onSort={(sort) => colFilters.setSort('customerId', sort)} />, render: (_, row) => <span className="text-[13px] font-bold text-foreground">{customerName(row)}</span> },
    { key: 'invoiceId', header: 'Factura origen', width: '135px', render: (_, row) => row.invoice?.number ? <Badge className="border-none bg-violet-500/10 px-2 py-0.5 text-[9px] font-black text-violet-600 dark:text-violet-400">{row.invoice.number}</Badge> : <span className="text-xs text-muted-foreground">Crédito directo</span> },
    { key: 'dueDate', header: 'Vence', headerExtra: <ColumnFilterMenu label="Vence" sort={colFilters.state.dueDate?.sort || null} onSort={(sort) => colFilters.setSort('dueDate', sort)} sortOptions={[{ value: 'asc', label: 'Más antiguas' }, { value: 'desc', label: 'Más recientes' }]} />, render: (value) => <span className="text-xs font-medium text-muted-foreground">{formatDate(value as string)}</span> },
    { key: 'total', header: 'Monto total', width: '135px', headerExtra: <ColumnFilterMenu label="Monto total" sort={colFilters.state.total?.sort || null} onSort={(sort) => colFilters.setSort('total', sort)} />, render: (_, row) => <span className="text-[13px] font-black tabular-nums text-primary">{formatConvertedAmount(sourceInvoiceTotal(row), sourceCurrency(row), sourceExchangeRate(row))}</span> },
    { key: 'amountPaid', header: 'Abonado', width: '125px', headerExtra: <ColumnFilterMenu label="Abonado" sort={colFilters.state.amountPaid?.sort || null} onSort={(sort) => colFilters.setSort('amountPaid', sort)} />, render: (_, row) => <span className="text-[13px] font-black tabular-nums text-foreground">{formatConvertedAmount(sourceInvoicePaid(row), sourceCurrency(row), sourceExchangeRate(row))}</span> },
    { key: 'balance', header: 'En deuda', width: '125px', headerExtra: <ColumnFilterMenu label="En deuda" sort={colFilters.state.balance?.sort || null} onSort={(sort) => colFilters.setSort('balance', sort)} />, render: (_, row) => <span className={cn('text-[13px] font-black tabular-nums', creditDebt(row) > 0 ? 'text-amber-500' : 'text-emerald-500')}>{formatConvertedAmount(creditDebt(row), sourceCurrency(row), sourceExchangeRate(row))}</span> },
    { key: 'status', header: 'Estado', width: '115px', render: (value) => { const option = statusFor(value as string); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none', option?.color || 'bg-muted/20 text-muted-foreground')}>{option?.label || value}</Badge>; } },
  ];

  const totalIssued = data.filter((credit) => ['ISSUED', 'PARTIAL', 'PAID'].includes(normalizeStatus(credit.status))).reduce((sum, credit) => sum + toBaseAmount(Number(credit.total || 0), credit.currency, credit.exchangeRate), 0);
  const totalOpen = data.filter((credit) => ['ISSUED', 'PARTIAL', 'APPLIED'].includes(normalizeStatus(credit.status))).reduce((sum, credit) => sum + toBaseAmount(Number(credit.balance ?? credit.total ?? 0), credit.currency, credit.exchangeRate), 0);
  const overdueCount = data.filter((credit) => Number(credit.balance ?? 0) > 0 && credit.dueDate && new Date(credit.dueDate).getTime() < referenceNow).length;

  if ((editingId || isCreating) && localDoc) {
    const statusOption = statusFor(localDoc.status);
    const canIssue = !isCreating && normalizeStatus(localDoc.status) === 'DRAFT';
    const selectedCustomer = customerFor(localDoc.customerId);
    const availableCredit = availableCreditFor(selectedCustomer);
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300" data-tour="sales-form-title">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4"><Button variant="ghost" size="icon" onClick={closeEditor} className="rounded-full"><ChevronLeft className="size-5" /></Button><div><h2 className="text-xl font-black uppercase tracking-tight">{isCreating ? 'Nuevo Crédito' : `Crédito ${localDoc.number}`}</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Productos y servicios entregados a crédito</p></div></div>
          <div className="flex flex-wrap items-center gap-3">{canPerform('SALES_CREDIT_NOTES', 'edit') && <><Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300 font-black uppercase text-[10px] tracking-widest" onClick={async () => { const id = toast.loading('Eliminando crédito...'); try { await creditNotesService.delete(localDoc.id); toast.success('Crédito eliminado', { id }); closeEditor(); onRefresh(); } catch (error: any) { toast.error(error?.response?.data?.message || 'No se pudo eliminar', { id }); } }} disabled={isCreating}><Trash2 className="mr-2 size-3" /> Eliminar</Button>{canIssue && canPerform('SALES_CREDIT_NOTES', 'approve') && <Button variant="outline" className="rounded-xl border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300 font-black uppercase text-[10px] tracking-widest" onClick={() => handleIssue(localDoc.id)}><CheckCircle2 className="mr-2 size-3" /> Emitir Crédito</Button>}<Button className="rounded-xl bg-primary font-black uppercase text-[10px] tracking-widest" onClick={handleSave}>{isCreating ? 'Crear Crédito' : 'Guardar'}</Button></>}</div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]" data-tour="sales-form-data">
           <Card className="rounded-2xl border-border/50"><CardContent className="space-y-4 p-6"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Condiciones del crédito</p><SalesAccountingLegend flow="creditNote" /><div className="grid gap-3 sm:grid-cols-2"><div><p className="mb-1 text-[10px] text-muted-foreground">Cliente</p><Combobox options={customers.filter((customer) => String(customer.status || '').toUpperCase() === 'ACTIVE' || customer.id === localDoc.customerId).map((customer) => ({ label: customer.name, value: customer.id, description: `${customer.code ? `[${customer.code}] ` : ''}Límite: ${formatConvertedAmount(Number(customer.creditLimit || 0), baseCurrency)}` }))} value={localDoc.customerId || ''} onChange={(value) => { const priceListId = getCustomerPriceListId(value); const items = (localDoc.items || []).map((item: any) => resolveItemType(item) === 'SERVICE' ? { ...item, priceListId: null } : item.productId ? { ...item, priceListId, unitPrice: 0, total: 0, priceMissing: false } : { ...item, priceListId }); if (hasSalesProductPriceListConflicts(items, priceListId)) { toast.error('No se puede aplicar esta lista: hay productos repetidos con la misma lista de precios.'); return; } setLocalDoc({ ...localDoc, customerId: value, priceListId, ...recalculateItems(items) }); }} placeholder="Seleccionar cliente" /></div><SalesWarehouseSelect warehouses={warehouses} value={localDoc.warehouseId} onChange={(warehouseId) => setLocalDoc({ ...localDoc, warehouseId })} required helpText="Se usará al emitir el crédito y devolver productos al inventario." /><div><p className="mb-1 text-[10px] text-muted-foreground">Fecha del crédito</p><Input type="date" value={isoDate(localDoc.date)} onChange={(event) => setLocalDoc({ ...localDoc, date: event.target.value })} className="h-8 text-xs" /></div><div><p className="mb-1 text-[10px] text-muted-foreground">Fecha límite de pago</p><Input type="date" value={isoDate(localDoc.dueDate)} onChange={(event) => setLocalDoc({ ...localDoc, dueDate: event.target.value })} className="h-8 text-xs" /></div><div><p className="mb-1 text-[10px] text-muted-foreground">Moneda de la transacción</p><Select value={localDoc.currency || 'NIO'} onValueChange={(value) => handleCurrencyChange(value as 'NIO' | 'USD')}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar moneda" /></SelectTrigger><SelectContent><SelectItem value="NIO">Córdobas (C$)</SelectItem><SelectItem value="USD">Dólares (US$)</SelectItem></SelectContent></Select><p className="mt-1 text-[10px] text-muted-foreground/70">Tasa configurada: <span className="font-bold">{localDoc.currency === 'NIO' ? '1.00' : Number(localDoc.exchangeRate || globalRate || 1).toFixed(2)}</span></p></div>{!isCreating && <div><p className="mb-1 text-[10px] text-muted-foreground">Estado</p><span className={cn('inline-flex rounded-lg px-2 py-1 text-xs font-black', statusOption?.color)}>{statusOption?.label || localDoc.status}</span></div>}</div><div><p className="mb-1 text-[10px] text-muted-foreground">Descripción / motivo</p><textarea value={localDoc.reason || ''} onChange={(event) => setLocalDoc({ ...localDoc, reason: event.target.value })} className="h-20 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Ej. Venta de productos con pago a 30 días..." /></div></CardContent></Card>
          <Card className="rounded-2xl border-border/50"><CardContent className="space-y-4 p-6"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Capacidad de pago</p><div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-border/50 bg-muted/10 p-3"><p className="text-[9px] font-black uppercase text-muted-foreground">Límite</p><p className="mt-1 text-lg font-black">{formatConvertedAmount(Number(selectedCustomer?.creditLimit || 0), baseCurrency)}</p></div><div className="rounded-xl border border-border/50 bg-muted/10 p-3"><p className="text-[9px] font-black uppercase text-muted-foreground">Disponible</p><p className={cn('mt-1 text-lg font-black', availableCredit > 0 ? 'text-emerald-500' : 'text-rose-500')}>{formatConvertedAmount(availableCredit, baseCurrency)}</p></div></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">Saldo pendiente</p><p className="mt-1 text-2xl font-black text-rose-600 dark:text-rose-400">{formatConvertedAmount(getCustomerDebtAmount(selectedCustomer), baseCurrency)}</p></div><div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Saldo a favor</p><p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatConvertedAmount(getCustomerFavorAmount(selectedCustomer), baseCurrency)}</p></div></div>{selectedCustomer && Number(selectedCustomer.creditLimit || 0) <= 0 && <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[10px] text-amber-700 dark:text-amber-300"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /><span>Este cliente no tiene límite de crédito. Configúralo en <button type="button" className="font-black underline underline-offset-2" onClick={goToCustomers}>Clientes</button> para continuar.</span></div>}<div className="flex items-start gap-2 text-[10px] text-muted-foreground"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />La emisión valida que el total no supere el límite disponible.</div></CardContent></Card>
        </div>
        <div className="flex justify-end" data-tour="sales-form-actions"><SalesViewTutorial view="credit-notes" context="form" /></div>
        <Card className="rounded-2xl border-border/50" data-tour="sales-form-items">
          <CardContent className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Productos y servicios</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => addItem('PRODUCT')} disabled={!localDoc.customerId} className="h-8 rounded-xl text-[10px] font-black uppercase tracking-widest"><Plus className="mr-2 size-3" /> Producto</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => addItem('SERVICE')} disabled={!localDoc.customerId} className="h-8 rounded-xl text-[10px] font-black uppercase tracking-widest"><Plus className="mr-2 size-3" /> Servicio</Button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="hidden px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground xl:grid xl:grid-cols-12 xl:gap-2">
                <div className="col-span-5">Descripción</div>
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
                  <div key={item.id || index} data-item-layout="standard" className="sales-item-row grid min-w-0 grid-cols-1 items-start gap-3 rounded-xl border border-border/50 bg-muted/5 p-3 xl:grid-cols-12 xl:gap-2 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0">
                    <div className="min-w-0 xl:col-span-5">
                      <div className="flex min-w-0 flex-wrap items-center gap-1">
                        <div className="min-w-0 flex-1">
                          <Combobox
                            options={catalog.map((entry) => ({ label: `${itemType === 'SERVICE' ? 'Servicio' : 'Producto'} · ${entry.code || ''} - ${entry.name}`, value: entry.id, description: entry.commercialNote ? `Nota: ${entry.commercialNote}` : undefined }))}
                            value={item.productId || ''}
                            onChange={(value) => {
                              const selectedProduct = catalog.find((entry) => entry.id === value);
                              const baseSalePrice = Number(selectedProduct?.salePrice ?? selectedProduct?.price ?? 0);
                              const unitPrice = localDoc?.currency === 'USD'
                                ? baseSalePrice / Number(localDoc?.exchangeRate || globalRate || 1)
                                : baseSalePrice;
                              updateItem(index, {
                                productId: value,
                                description: selectedProduct?.name || '',
                                commercialNoteSnapshot: selectedProduct?.commercialNote || null,
                                priceListId: itemType === 'SERVICE' ? null : (localDoc?.priceListId || getCustomerPriceListId(localDoc?.customerId)),
                                unitPrice,
                                priceMissing: false,
                              });
                            }}
                            placeholder={itemType === 'SERVICE' ? 'Seleccionar servicio...' : 'Seleccionar producto...'}
                          />
                        </div>
                        <SalesLinePriceListSelect
                          productId={item.productId}
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
                             if (hasSalesProductPriceListConflict(localDoc.items || [], item.productId, priceListId, index, localDoc.priceListId || getCustomerPriceListId(localDoc.customerId))) {
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
                        />
                      </div>
                      {item.productId && product && (
                        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 px-1">
                          <Badge variant="outline" className={cn('border-none px-1.5 py-0 text-[9px] font-black', itemType === 'SERVICE' ? 'bg-emerald-500/10 text-emerald-500' : Number(product.stock || 0) <= 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500')}>
                            {itemType === 'SERVICE' ? 'DISPONIBLE' : `STOCK: ${Number(product.stock || 0)}`}
                          </Badge>
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
                      <Input type="text" inputMode="decimal" min="0" value={item.unitPrice === undefined || item.unitPrice === null ? '' : item.unitPrice} onChange={(event) => updateItem(index, { unitPrice: Number(String(event.target.value).replace(/,/g, '')) || 0 })} placeholder="0" />
                    </div>
                    <div className="col-span-2 flex items-center justify-end xl:col-span-1">
                      <Input type="text" readOnly value={formatConvertedAmount(((Number(item.quantity || 0) * Number(item.unitPrice || 0)) - (Number(item.quantity || 0) * Number(item.unitPrice || 0) * Number(item.discount || 0) / 100)) * Number(item.taxRate || 0) / 100, localDoc.currency, localDoc.exchangeRate)} className="h-8 w-16 border-none bg-transparent px-0 text-right text-xs font-black shadow-none focus-visible:border-transparent focus-visible:ring-0" />
                    </div>
                    <div className="flex min-w-0 items-center justify-end gap-2 text-right xl:col-span-2">
                      <span className="text-sm font-black text-primary">{formatConvertedAmount(Number(item.total || 0), localDoc.currency, localDoc.exchangeRate)}</span>
                      <Button type="button" variant="ghost" size="icon" title="Quitar línea" aria-label="Quitar línea" className="size-6 rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500" onClick={() => { const items = [...localDoc.items]; items.splice(index, 1); setLocalDoc({ ...localDoc, ...recalculateItems(items) }); }}><Trash2 className="size-3" /></Button>
                    </div>
                  </div>
                );
              })}
              {!localDoc.items?.length && <div className="rounded-xl border border-dashed border-border/50 py-8 text-center text-xs text-muted-foreground">Agrega los productos o servicios que se entregarán a crédito.</div>}
            </div>
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
              <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2 mt-2">
                <span className="text-sm font-black uppercase tracking-widest">Total del crédito</span>
                <span className="text-xl font-black text-primary tabular-nums">{formatConvertedAmount(Number(localDoc.total || 0), localDoc.currency, localDoc.exchangeRate)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-tour="sales-list-kpis"><SalesKpiCard title={`Crédito emitido (${baseCurrency})`} value={formatConvertedAmount(totalIssued, baseCurrency)} icon={BadgeDollarSign} color="text-primary" bg="bg-primary/10" /><SalesKpiCard title={`Saldo abierto (${baseCurrency})`} value={formatConvertedAmount(totalOpen, baseCurrency)} icon={TrendingUp} color="text-amber-500" bg="bg-amber-500/10" /><SalesKpiCard title="Activos" value={data.filter((credit) => ['ISSUED', 'PARTIAL'].includes(normalizeStatus(credit.status))).length} icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-500/10" /><SalesKpiCard title="Por vencer / vencidos" value={overdueCount} icon={Clock} color="text-rose-500" bg="bg-rose-500/10" /></div>
      <div className="flex flex-col gap-4"><div className="flex flex-col justify-between gap-4 py-2 lg:flex-row lg:items-center"><div><h2 className="text-xl font-black uppercase tracking-tight text-foreground" data-tour="sales-list-title">Créditos</h2><p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">Productos y servicios entregados con límite y fecha de pago.</p></div><div className="erp-list-toolbar flex flex-wrap items-center justify-end gap-3" data-tour="sales-list-actions"><SalesViewTutorial view="credit-notes" /><ViewLayoutSelect value={layoutMode} onChange={(value) => setLayoutMode(value === 'kanban' ? 'table' : value)} ariaLabel="Elegir distribución de créditos" /><SalesDateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChange={onDateRangeChange || (() => undefined)} /><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar crédito..." className="h-10 w-64 rounded-xl border-border/50 bg-background/50 pl-9 text-xs font-bold tracking-widest" value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); onSearchChange?.(event.target.value); }} /></div><Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}><SelectTrigger aria-label="Filtrar créditos por estado" className="h-10 min-w-[8.5rem] rounded-xl border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest"><SelectValue /></SelectTrigger><SelectContent align="end"><SelectItem value="ALL">Todos los estados</SelectItem>{statusOptions.filter((option) => option.value !== 'VOIDED').map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>{canPerform('SALES_CREDIT_NOTES', 'create') && <Button onClick={startNew} className="h-10 rounded-xl bg-primary px-4 text-[10px] font-black uppercase tracking-widest text-primary-foreground"><Plus className="mr-2 size-4" /> Nuevo Crédito</Button>}</div></div>
        <EditableDataTable data={filteredData} pagination={pagination} onBulkDelete={async (ids) => { const id = toast.loading(`Eliminando ${ids.length} crédito${ids.length === 1 ? '' : 's'}...`); try { for (const recordId of ids) await creditNotesService.delete(recordId as string); toast.success('Créditos eliminados', { id }); onRefresh(); } catch (error: any) { toast.error(error?.response?.data?.message || error?.message || 'No se pudieron eliminar', { id }); } }} columns={columns} onRowUpdate={async () => {}} onRowClick={(row) => setDetailCredit(row)} isLoading={loading} actionsWidth="w-36" fitContent showHorizontalControls layoutMode={layoutMode} actions={(row) => { const activeQueue = ['PENDING', 'CLAIMED'].includes(normalizeStatus(row.cashQueue?.status)); return <div className="flex items-center gap-1" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>{canPerform('SALES_CREDIT_NOTES', 'approve') && normalizeStatus(row.status) === 'DRAFT' && <Button title="Emitir crédito" variant="ghost" size="icon" className="size-8 rounded-lg text-emerald-500" onClick={() => handleIssue(row.id)}><CheckCircle2 className="size-4" /></Button>}{canPerform('SALES_CREDIT_NOTES', 'approve') && ['ISSUED', 'PARTIAL', 'APPLIED'].includes(normalizeStatus(row.status)) && Number(row.balance ?? row.total) > 0.01 && <Button title={activeQueue ? 'Crédito ya enviado a Caja' : 'Enviar crédito a Caja'} aria-label={activeQueue ? 'Crédito ya enviado a Caja' : 'Enviar crédito a Caja'} variant="ghost" size="icon" className={cn('size-8 rounded-lg', activeQueue ? 'text-amber-500' : 'text-emerald-500')} onClick={() => void handleSendToCash(row)} disabled={activeQueue}><Send className="size-4" /></Button>}{canPerform('SALES_CREDIT_NOTES', 'approve') && ['ISSUED', 'PARTIAL', 'APPLIED'].includes(normalizeStatus(row.status)) && Number(row.balance ?? row.total) > 0.01 && <Button title="Registrar pago" variant="ghost" size="icon" className="size-8 rounded-lg text-primary" onClick={() => openPayment(row)}><CreditCard className="size-4" /></Button>}<Button title="Ver crédito completo" aria-label="Ver crédito completo" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:text-primary" onClick={() => { setDetailCredit(null); startEdit(row.id); }}><Eye className="size-4" /></Button>{canPerform('SALES_CREDIT_NOTES', 'delete') && <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:text-rose-500" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>}</div>; }} />
      </div>

      <SalesDocumentDetailSheet
        key={detailCredit?.id || 'credit-detail'}
        document={detailCredit ? buildCreditPanel(detailCredit) : null}
        entity="CREDIT_NOTE"
        open={Boolean(detailCredit)}
        onClose={() => setDetailCredit(null)}
        onOpenDocument={() => {
          if (!detailCredit) return;
          setDetailCredit(null);
          startEdit(detailCredit.id);
        }}
        onDownloadPdf={(format) => { if (detailCredit) void handleExportPDF(detailCredit, format); }}
      />

      <ConfirmDialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)} title="¿Eliminar crédito?" description="Solo deben eliminarse créditos que aún no hayan sido emitidos." confirmLabel="Eliminar" variant="destructive" loading={deleteLoading} onConfirm={async () => { if (!pendingDeleteId) return; const id = toast.loading('Eliminando crédito...'); try { setDeleteLoading(true); await creditNotesService.delete(pendingDeleteId); toast.success('Crédito eliminado', { id }); onRefresh(); } catch (error: any) { toast.error(error?.response?.data?.message || error?.message || 'No se pudo eliminar', { id }); } finally { setDeleteLoading(false); setPendingDeleteId(null); } }} />

      <Dialog open={Boolean(paymentCredit)} onOpenChange={(open) => !open && !paymentLoading && setPaymentCredit(null)}>
        <DialogContent className="w-[calc(100%-2rem)] !max-w-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight"><CircleDollarSign className="size-5 text-primary" /> Registrar pago del crédito</DialogTitle>
            <DialogDescription>El pago quedará guardado también en Pagos Recibidos y actualizará el saldo del crédito.</DialogDescription>
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
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Forma de pago</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">Activa pago mixto solo cuando necesites combinar varios medios.</p>
                  </div>
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
                <div className="space-y-3">
                  {paymentLines.map((line, index) => (
                    <div key={`${index}-${line.method}`} className="rounded-xl border border-border/60 bg-background/70 p-3">
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(7rem,10rem)_minmax(7rem,10rem)_auto] sm:items-start">
                        <div><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Método</p><Select value={line.method} onValueChange={(nextMethod) => handlePaymentMethodChange(index, nextMethod as CreditPaymentLine['method'])} disabled={paymentLoading}><SelectTrigger size="sm" className="h-9 w-full rounded-lg border-input bg-background px-2 text-xs font-bold uppercase"><SelectValue /></SelectTrigger><SelectContent>{methodOptions.filter((method) => method.value !== 'CUSTOMER_BALANCE' || paymentCustomerFavorBase > 0.01).map((method) => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}</SelectContent></Select></div>
                        <CurrencySelector value={line.currency} baseCurrency={baseCurrency} exchangeRate={globalRate} rateDecimals={2} label="Moneda" disabled={paymentLoading || line.method === 'CUSTOMER_BALANCE'} onChange={(nextCurrency) => setPaymentLines((current) => current.map((item, itemIndex) => {
                          if (itemIndex !== index) return item;
                          const previousRate = item.currency === baseCurrency ? 1 : Number(item.exchangeRate || globalRate);
                          const nextRate = paymentLineRate(nextCurrency);
                          return { ...item, amount: convertBetweenCurrencies(Number(String(item.amount || '').replace(/,/g, '') || 0), item.currency, nextCurrency, previousRate, nextRate).toFixed(2), currency: nextCurrency, exchangeRate: nextRate };
                        }))} />
                        <div><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Monto ({line.currency})</p><Input type="number" min="0" step="0.01" value={line.amount} onChange={(event) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value, cardCommissionAmount: isCardPaymentMethod(item.method) ? calculateCardCommission(Number(event.target.value || 0), Number(item.cardCommissionPercent || 0)) : item.cardCommissionAmount } : item))} disabled={paymentLoading} className="h-9 text-xs tabular-nums" /></div>
                        <Button type="button" variant="ghost" size="icon" disabled={paymentLines.length === 1 || paymentLoading} onClick={() => setPaymentLines((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Eliminar medio de pago" className="size-9 shrink-0 text-muted-foreground hover:text-rose-500"><Trash2 className="size-4" /></Button>
                      </div>
                      {line.method === 'CUSTOMER_BALANCE' && <p className="mt-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Disponible a favor: {formatConvertedAmount(paymentCustomerFavorBase, baseCurrency)}. Puedes aplicar solo una parte.</p>}
                      {isBankPaymentMethod(line.method, true) && <BankAccountSelect value={line.bankAccountId} onChange={(bankAccountId) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, bankAccountId } : item))} onAccountSelect={(account) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, cardCommissionPercent: account?.cardCommissionPercent || 0, cardCommissionAmount: isCardPaymentMethod(item.method) ? calculateCardCommission(Number(String(item.amount || '').replace(/,/g, '') || 0), account?.cardCommissionPercent || 0) : 0, cardCommissionAccountId: account?.cardCommissionAccountId || undefined } : item))} label="Banco global de destino" className="mt-2" />}
                      {isCardPaymentMethod(line.method) && line.bankAccountId && Number(line.cardCommissionPercent || 0) > 0 && (
                        <div className="mt-2 flex items-center gap-3 rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-[10px]">
                          <span className="font-black uppercase tracking-widest text-purple-600">Comisión:</span>
                          <span className="font-mono font-bold">{formatCommissionPercent(line.cardCommissionPercent)}</span>
                          <span className="text-muted-foreground">|</span>
                          <span className="font-black uppercase tracking-widest text-muted-foreground">Monto:</span>
                          <span className="font-mono font-bold text-purple-600">{line.currency === 'USD' ? '$' : 'C$'} {formatConvertedAmount(Number(line.cardCommissionAmount || calculateCardCommission(Number(String(line.amount || '').replace(/,/g, '') || 0), Number(line.cardCommissionPercent || 0))), baseCurrency)}</span>
                        </div>
                      )}
                      {requiresPaymentReference(line.method) && <div className="mt-2"><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Referencia *</p><Input value={line.reference || ''} onChange={(event) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, reference: event.target.value } : item))} placeholder="Transferencia, voucher o cheque..." disabled={paymentLoading} className="h-9 text-xs" /></div>}
                    </div>
                  ))}
                  {mixedPaymentEnabled && <Button type="button" variant="outline" className="w-full rounded-xl border-dashed text-[10px] font-black uppercase tracking-widest" onClick={() => setPaymentLines((current) => [...current, paymentLine('CASH', '', displayCurrency === 'USD' ? 'USD' : 'NIO')])} disabled={paymentLoading}><Plus className="mr-2 size-4" /> Agregar pago mixto</Button>}
                </div>
                {!mixedPaymentEnabled ? (
                  <div className="mt-3 grid gap-3 border-t border-border/50 pt-3 sm:grid-cols-3">
                    <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total a pagar</p><p className="mt-1 font-black text-primary">{formatConvertedAmount(paymentCreditBalance, paymentCreditCurrency, paymentCredit.exchangeRate)}</p></div>
                    <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Pagado</p><p className="mt-1 font-black text-foreground">{formatConvertedAmount(paymentReceivedInCreditCurrency, paymentCreditCurrency, paymentCredit.exchangeRate)}</p></div>
                    <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cambio / vuelto</p><p className={cn('mt-1 font-black', paymentChangeInCreditCurrency > 0.01 ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground')}>{formatConvertedAmount(paymentChangeInCreditCurrency, paymentCreditCurrency, paymentCredit.exchangeRate)}</p></div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3 text-xs"><span className="font-black uppercase tracking-widest text-muted-foreground">Total aplicado (base)</span><span className="font-black text-primary">{formatConvertedAmount(paymentTotalBase, baseCurrency)}</span></div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentCredit(null)} disabled={paymentLoading}>Cancelar</Button>
            <Button onClick={handlePayment} disabled={paymentLoading || paymentCustomerFavorExceeded || !paymentLines.some((line) => Number(String(line.amount || '').replace(/,/g, '')) > 0) || paymentLines.some((line) => requiresManualPaymentAccount(line.method) && !line.accountId) || paymentLines.some((line) => isBankPaymentMethod(line.method, true) && !line.bankAccountId) || paymentLines.some((line) => requiresPaymentReference(line.method) && !line.reference?.trim()) || paymentAmountMismatch} className="bg-primary font-black">{paymentLoading ? 'Registrando...' : 'Confirmar pago'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
