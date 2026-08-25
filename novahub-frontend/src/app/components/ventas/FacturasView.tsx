import { useState, useEffect } from 'react';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import {
  FileText, Plus, Search, TrendingUp, CheckCircle2, AlertCircle, AlertTriangle, CreditCard, Eye, Trash2, Ban, ChevronLeft, Send, Loader2
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { invoicesService, paymentsService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import type { Invoice, Customer, Product, SalesPaginationControls } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { BankAccountSelect } from '../ui/BankAccountSelect';
import { CurrencySelector } from '../ui/CurrencySelector';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { previewSalesTransactionPDF } from '../../utils/pdfGenerator';
import type { PdfDownloadFormat } from '../../utils/pdfDownloadFormats';
import { publicAccessService, publicLinkUrl } from '../../services/public-access.service';
import { InvoiceDetailSheet } from './InvoiceDetailSheet';
import { SalesLinePriceListSelect, PriceMissingBadge } from './SalesLinePriceListSelect';
import { SalesAccountingLegend } from './SalesAccountingLegend';
import { formatSalesAmount, getMissingSalesPriceMessage } from '../../utils/salesPriceList';
import { SalesDateRangeFilter } from './SalesDateRangeFilter';
import { SalesViewTutorial } from './SalesViewTutorial';
import { SalesKpiCard } from './SalesKpiCard';
import { resolveCustomerPhone, WhatsAppActionButton } from './WhatsAppActionButton';
import { PurchaseAlertsButton, type PurchaseAlertDetail } from '../compras/PurchaseAlertsButton';
import { cajaService, type CashRegister, type CashRegisterSession } from '../../services/caja.service';
import { InvoiceCashQueueBell } from './caja/InvoiceCashQueueBell';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { formatDateEs } from '../../utils/dateFormat';
import { isBankPaymentMethod, requiresPaymentReference, isCardPaymentMethod, calculateCardCommission, formatCommissionPercent } from '../../utils/paymentMethods';

interface FacturasViewProps {
  data: Invoice[];
  loading: boolean;
  onRefresh: () => void;
  customers?: Customer[];
  products?: Product[];
  series?: any[];
  warehouses?: any[];
  employees?: any[];
  invoiceDraft?: Partial<Invoice>;
  onClearInvoiceDraft?: () => void;
  targetInvoiceId?: string | null;
  onClearTargetInvoiceId?: () => void;
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateRangeChange?: (dateFrom: string, dateTo: string) => void;
  salesAlert?: PurchaseAlertDetail;
}

// Todos los estados posibles (para visualización en badges)
const statusOptions = [
  { label: 'Borrador', value: 'DRAFT', color: 'bg-slate-500/10 text-slate-500' },
  { label: 'Pendiente', value: 'PENDING', color: 'bg-amber-500/10 text-amber-500' },
  { label: 'A crédito', value: 'CREDIT', color: 'bg-violet-500/10 text-violet-500' },
  { label: 'Pagada', value: 'PAID', color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Anulada', value: 'CANCELLED', color: 'bg-rose-500/10 text-rose-500' },
  { label: 'Vencida', value: 'OVERDUE', color: 'bg-orange-500/10 text-orange-500' },
  { label: 'Parcial', value: 'PARTIAL', color: 'bg-blue-500/10 text-blue-500' },
];

const paymentMethodOptions = [
  { label: 'Efectivo', value: 'CASH' },
  { label: 'Tarjeta', value: 'CARD' },
  { label: 'Transferencia', value: 'TRANSFER' },
  { label: 'Cheque', value: 'CHECK' },
];

const isInvoiceInCashQueue = (invoice?: Partial<Invoice> | null) =>
  ['PENDING', 'CLAIMED'].includes(String(invoice?.cashQueue?.status || '').toUpperCase());

type InvoicePaymentLine = {
  method: string;
  amount: number;
  currency: 'NIO' | 'USD';
  exchangeRate: number;
  bankAccountId?: string;
  reference?: string;
  cardCommissionPercent?: number;
  cardCommissionAmount?: number;
  cardCommissionAccountId?: string;
};

type InvoiceSaveAction = 'DRAFT' | 'PENDING' | 'PAYMENT' | 'CREDIT';

const getInvoiceSourceBadge = (invoice: Partial<Invoice> | null | undefined) => {
  const sourceType = String(invoice?.sourceType || '').toUpperCase();
  if (sourceType === 'CASH_SALE' || invoice?.registerId || invoice?.sessionId) {
    return { label: 'Desde Facturación por Caja', className: 'bg-cyan-500/10 text-cyan-500' };
  }
  if (sourceType === 'ESTIMATE') {
    return { label: 'Desde Cotización', className: 'bg-violet-500/10 text-violet-500' };
  }
  if (sourceType === 'SALES_ORDER' || invoice?.salesOrderId) {
    return { label: 'Desde Orden de Venta', className: 'bg-orange-500/10 text-orange-500' };
  }
  if (
    sourceType === 'RECURRING' ||
    String(invoice?.number || '').toUpperCase().startsWith('FAC-REC-') ||
    String(invoice?.notes || '').toLowerCase().includes('desde recurrente')
  ) {
    return { label: 'Desde Facturas Recurrentes', className: 'bg-purple-500/10 text-purple-500' };
  }
  return null;
};

export function FacturasView({ data, loading, onRefresh, customers = [], products = [], series = [], warehouses = [], employees = [], invoiceDraft, onClearInvoiceDraft, targetInvoiceId, onClearTargetInvoiceId, pagination, onSearchChange, dateFrom = '', dateTo = '', onDateRangeChange, salesAlert }: FacturasViewProps) {
  const {
    exchangeRate: globalRate,
    displayCurrency,
    baseCurrency,
    valuationMode,
    valuationModeLabel,
    valuationModeSuffix,
    showValuationLegend,
    formatConvertedAmount,
    formatHistoricalAmount,
    formatCurrentAmount,
    convertAmount,
    convertCurrentAmount,
    convertBetweenCurrencies,
    toBaseAmount,
  } = useCurrency();
  const { user, canPerform } = useAuth();
  const { themeConfig } = useTheme();
  const [searchTerm, setSearchTerm] = useState(() => {
    try {
      if (sessionStorage.getItem('global-search-module') !== 'facturas') return '';
      sessionStorage.removeItem('global-search-module');
      return sessionStorage.getItem('global-search-term') || '';
    } catch {
      return '';
    }
  });
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('sales-invoices-layout', 'table', 24 * 365);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'RECEIVABLE' | 'OVERDUE' | 'PAID'>('ALL');
  useEffect(() => { try { sessionStorage.removeItem('global-search-term') } catch {} }, [])
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<any>(null);
  const [highlightedAlertId, setHighlightedAlertId] = useState<string | null>(null);

  const productCatalog = products.filter((p) => p.itemType !== 'SERVICE');
  const serviceCatalog = products.filter((p) => p.itemType === 'SERVICE');
  const findProductForItem = (item: any) => products.find((product: any) => product.id === item?.productId)
    || products.find((product: any) => product.code && (product.code === item?.code || product.code === item?.productCode))
    || products.find((product: any) => String(product.name || '').trim().toLowerCase() === String(item?.description || '').trim().toLowerCase());
  const resolveItemType = (item: any) => item.itemType || (findProductForItem(item)?.itemType === 'SERVICE' ? 'SERVICE' : 'PRODUCT');
  const getItemCatalog = (item: any) => {
    const catalog = resolveItemType(item) === 'SERVICE' ? serviceCatalog : productCatalog;
    if (!item?.productId || catalog.some((product) => product.id === item.productId)) return catalog;
    const linkedProduct = products.find((product) => product.id === item.productId);
    return [...catalog, linkedProduct || { id: item.productId, code: '', name: item.description || 'Artículo vinculado', itemType: item.itemType || 'PRODUCT' }];
  };
  const [localRates, setLocalRates] = useState({ dRate: 0, tRate: 15 });
  const [pricingMode, setPricingMode] = useState<'global' | 'individual'>('global');
  const [isCreating, setIsCreating] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentLines, setPaymentLines] = useState<InvoicePaymentLine[]>([]);
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [cashRegisterId, setCashRegisterId] = useState('');
  const [cashSession, setCashSession] = useState<CashRegisterSession | null>(null);
  const [cashLoading, setCashLoading] = useState(false);
  const [creditInvoice, setCreditInvoice] = useState<Invoice | null>(null);
  const [creditDueDate, setCreditDueDate] = useState('');
  const [creditLoading, setCreditLoading] = useState(false);
  const [cashSendingInvoiceId, setCashSendingInvoiceId] = useState<string | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [accountingPreflight, setAccountingPreflight] = useState<{ ready: boolean; hasInventoryItems?: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [accountingPreflightLoading, setAccountingPreflightLoading] = useState(false);

  const paymentCurrency = paymentLines[0]?.currency || displayCurrency;
  const paymentLineRate = (currency: 'NIO' | 'USD') => currency === baseCurrency ? 1 : Number(globalRate || 1);
  const paymentLine = (method: string, amount = 0, currency: 'NIO' | 'USD' = displayCurrency): InvoicePaymentLine => ({
    method,
    amount,
    currency,
    exchangeRate: paymentLineRate(currency),
  });

  const accountingPreflightSignature = isCreating || editingId
    ? JSON.stringify({
      warehouseId: localDoc?.warehouseId || warehouses[0]?.id || '',
      items: (localDoc?.items || []).map((item: any) => ({ productId: item.productId || '', warehouseId: item.warehouseId || '' })),
    })
    : '';

  useEffect(() => {
    if (!accountingPreflightSignature || !localDoc?.items?.length) {
      setAccountingPreflight(null);
      setAccountingPreflightLoading(false);
      return;
    }
    let active = true;
    setAccountingPreflightLoading(true);
    const payload = JSON.parse(accountingPreflightSignature);
    invoicesService.accountingPreflight(payload)
      .then((result: any) => { if (active) setAccountingPreflight(result); })
      .catch(() => { if (active) setAccountingPreflight({ ready: false, hasInventoryItems: true, errors: ['No se pudo validar la configuración contable del inventario.'], warnings: [] }); })
      .finally(() => { if (active) setAccountingPreflightLoading(false); });
    return () => { active = false; };
  }, [accountingPreflightSignature, localDoc?.items?.length]);

  useEffect(() => {
    if (!paymentDialogOpen || !paymentInvoice) return;
    let active = true;
    setCashLoading(true);
    setCashSession(null);
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
  }, [paymentDialogOpen, paymentInvoice?.id]);

  useEffect(() => {
    if (!paymentDialogOpen || !cashRegisterId) {
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
  }, [paymentDialogOpen, cashRegisterId]);

  useEffect(() => {
    if (!highlightedAlertId) return;
    const timeout = window.setTimeout(() => setHighlightedAlertId(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [highlightedAlertId]);

  const getCustomerPriceListId = (customerId?: string | null) => {
    const customer = customers.find((entry: any) => entry.id === customerId);
    return customer?.priceListId || (customer as any)?.priceList?.id || null;
  };

  const getCustomerPhone = (invoice: Invoice | null = localDoc): string | null => {
    if (!invoice) return null;
    return resolveCustomerPhone(invoice.customerId, invoice.customer, customers);
  };

  const handleWhatsApp = async (invoiceOverride?: Invoice) => {
    const invoice = invoiceOverride || localDoc;
    const phone = getCustomerPhone(invoice);
    if (!phone) { toast.error('El cliente no tiene un número asociado para enviar la factura por WhatsApp'); return; }
    const whatsappToastId = toast.loading('Preparando factura para WhatsApp...');
    const digits = phone.replace(/\D/g, '');
    const phoneWithCode = digits.length === 8 ? '505' + digits : (digits.startsWith('505') ? digits : '505' + digits);
    const customerName = invoice?.customer?.name || customers.find((entry) => entry.id === invoice?.customerId)?.name || '';
    let message = `Hola ${customerName}, te compartimos la factura ${invoice?.number} por un total de ${invoice?.currency === 'USD' ? '$' : 'C$'}${formatSalesAmount(invoice?.total)}.`;
    try {
      if (invoice?.customerId && invoice?.id) {
        const [documentLink, portalLink] = await Promise.all([
          publicAccessService.createDocumentLink({ customerId: invoice.customerId, documentType: 'invoice', documentId: invoice.id, allowPrint: true, allowDownload: true, allowRelated: true }),
          publicAccessService.createPortalLink({ customerId: invoice.customerId }),
        ]);
        message += `\n\nPodés consultar la factura de forma segura aquí:\n${publicLinkUrl(documentLink.path)}`;
        message += `\n\nPortal del cliente (historial y saldo):\n${publicLinkUrl(portalLink.path)}`;
      } else {
        message += ' Adjunto encontrarás el documento PDF con todos los detalles.';
      }
    } catch (error) {
      console.warn('No se pudo crear el enlace seguro de la factura, se conserva el mensaje actual.', error);
      message += ' Adjunto encontrarás el documento PDF con todos los detalles.';
    }
    const text = encodeURIComponent(message);
    window.open(`https://wa.me/${phoneWithCode}?text=${text}`, '_blank');
    toast.success('Factura preparada y WhatsApp abierto', { id: whatsappToastId });
  };

  const isSerialTracked = (product: any) =>
    Boolean(
      product?.trackSerialNumbers ||
      product?.serialTracking ||
      product?.serialNumberTracking ||
      String(product?.trackingType || '').toUpperCase() === 'SERIAL',
    );

  const getAvailableSeriesForItem = (item: any) => {
    if (!item?.productId) return [];
    return series.filter((s: any) => {
      const sameProduct = s.productId === item.productId || s.product?.id === item.productId;
      if (!sameProduct) return false;
      if (item.warehouseId) {
        const serialWh = s.warehouseId || s.warehouse?.id;
        if (serialWh && serialWh !== item.warehouseId) return false;
      }
      const status = String(s.status || 'AVAILABLE').toUpperCase();
      return ['AVAILABLE', 'IN_STOCK', 'ACTIVE', ''].includes(status);
    });
  };

  // La factura no tiene una columna propia para el modo de cargos. Se conserva
  // mediante los campos del documento: cargos en las líneas significan
  // "Por producto"; cargos solo en el encabezado significan "Global".
  const inferPricingMode = (doc: any): 'global' | 'individual' => (
    (doc?.items || []).some((line: any) =>
      Number(line.discount || 0) !== 0 || Number(line.taxRate || 0) !== 0 || Number(line.irRate || 0) !== 0,
    ) ? 'individual' : 'global'
  );

  // Helper para mostrar la fecha sin desfase de zona horaria (UTC-local)
  const formatDateSafe = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const [y, m, d] = clean.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    return formatDateEs(new Date(y, m - 1, d));
  };

  useEffect(() => {
    if (!invoiceDraft) return;

    const draftId = (invoiceDraft as Partial<Invoice>).id;
    const isExistingInvoice = Boolean(draftId);
    setIsCreating(!isExistingInvoice);
    setEditingId(isExistingInvoice ? draftId! : null);
    const draftSnapshot = JSON.parse(JSON.stringify(invoiceDraft));
    setLocalDoc(draftSnapshot);
    setPricingMode(inferPricingMode(draftSnapshot));

    const sub = Number(invoiceDraft.subtotal || 0);
    if (sub > 0) {
      const dRate = (Number(invoiceDraft.discountAmount || 0) / sub) * 100;
      const base = sub - Number(invoiceDraft.discountAmount || 0);
      const tRate = base > 0 ? (Number(invoiceDraft.taxAmount || 0) / base) * 100 : 0;
      setLocalRates({ dRate: Math.round(dRate * 100) / 100, tRate: Math.round(tRate * 100) / 100 });
    } else {
      setLocalRates({ dRate: 0, tRate: 15 });
    }

    if (onClearInvoiceDraft && !isExistingInvoice) {
      setTimeout(() => onClearInvoiceDraft(), 0);
    }
  }, [invoiceDraft]);

  // El documento abierto es un snapshot local. Las actualizaciones de la
  // lista paginada no deben reemplazarlo con una respuesta parcial sin líneas.
  useEffect(() => {
    if (invoiceDraft) return;
    if (editingId) {
      const inv = data.find(x => x.id === editingId);
      if (inv) {
        setIsCreating(false);
        const invoiceSnapshot = JSON.parse(JSON.stringify(inv));
        setLocalDoc(invoiceSnapshot);
        setPricingMode(inferPricingMode(invoiceSnapshot));
        const sub = Number(inv.subtotal || 0);
        if (sub > 0) {
          const dRate = (Number(inv.discountAmount || 0) / sub) * 100;
          const base = sub - Number(inv.discountAmount || 0);
          const tRate = base > 0 ? (Number(inv.taxAmount || 0) / base) * 100 : 0;
          setLocalRates({ dRate: Math.round(dRate * 100) / 100, tRate: Math.round(tRate * 100) / 100 });
        }
      }
    } else if (!isCreating) {
      setLocalDoc(null);
    }
    // `data` se usa únicamente para inicializar al cambiar de factura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, invoiceDraft, isCreating]);

  useEffect(() => {
    if (targetInvoiceId) {
      const exists = data.find(x => x.id === targetInvoiceId);
      if (exists) {
        setEditingId(targetInvoiceId);
        setIsCreating(false);
        onClearTargetInvoiceId?.();
      }
    }
  }, [targetInvoiceId, data, onClearTargetInvoiceId]);

  const filtered = data.filter(f =>
    (statusFilter === 'ALL' || (statusFilter === 'RECEIVABLE' && ['PENDING', 'OVERDUE', 'PARTIAL', 'CREDIT'].includes(String(f.status || '').toUpperCase())) || String(f.status || '').toUpperCase() === statusFilter) &&
    (f.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const colFilters = useColumnFilters();
  const filterGetters = {
    customer: (row: Invoice) => row.customer?.name || 'Varios',
    date: (row: Invoice) => (row.date ? new Date(row.date).getTime() : null),
    dueDate: (row: Invoice) => (row.dueDate ? new Date(row.dueDate).getTime() : null),
    total: (row: Invoice) => Number(row.total || 0),
    balance: (row: Invoice) => getInvoiceBalance(row),
  };
  const filteredData = colFilters.applyTo(filtered, filterGetters);
  const distinctCustomers = [...new Map(filtered.map((f) => [f.customer?.name || 'Varios', f.customer?.name || 'Varios'])).entries()]
    .map(([, label]) => ({ value: label, label, count: filtered.filter((f) => (f.customer?.name || 'Varios') === label).length }));

  const handleUpdate = async (id: string | number, updates: Partial<Invoice>) => {
    try {
      await invoicesService.update(id.toString(), updates);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar');
      throw e;
    }
  };

  const openInvoicePayment = (invoice: Invoice) => {
    if (!canPerform('SALES_INVOICES', 'approve') || !canPerform('SALES_PAYMENTS', 'create') || !canPerform('SALES_PAYMENTS', 'approve')) {
      toast.error('No tienes permisos para aprobar y registrar el pago de esta factura');
      return;
    }
    const invoiceStatus = String(invoice.status || (!invoice.id ? 'DRAFT' : '')).toUpperCase();
    if (invoiceStatus === 'PAID') return;
    if (!['DRAFT', 'PENDING', 'PARTIAL', 'OVERDUE', 'CREDIT'].includes(invoiceStatus)) {
      toast.error('Solo se pueden pagar facturas en borrador o emitidas');
      return;
    }

    const amount = invoiceStatus === 'DRAFT'
      ? Math.max(0, Number(invoice.total || 0) - Number(invoice.amountPaid || 0))
      : getInvoiceBalance(invoice);
    if (amount <= 0) {
      toast.error('La factura no tiene saldo pendiente');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const existingDueDate = invoice.dueDate ? String(invoice.dueDate).split('T')[0] : '';
    // El borrador se presenta como pendiente únicamente dentro del modal. El
    // backend lo crea y liquida en una sola transacción al confirmar.
    setPaymentInvoice(invoiceStatus === 'DRAFT' ? ({ ...invoice, status: 'PENDING' } as Invoice) : invoice);
    const invoiceCurrency = String(invoice.currency || baseCurrency).toUpperCase() === 'USD' ? 'USD' : 'NIO';
    const initialCurrency = displayCurrency;
    const initialAmount = Number(convertBetweenCurrencies(
      amount,
      invoiceCurrency,
      initialCurrency,
      Number(invoice.exchangeRate || 1),
      paymentLineRate(initialCurrency),
    ).toFixed(2));
    setPaymentLines([paymentLine('CASH', initialAmount, initialCurrency)]);
    setPaymentDate(today);
    setPaymentDueDate(existingDueDate && existingDueDate >= today ? existingDueDate : today);
    setCashRegisterId('');
    setCashSession(null);
    setPaymentDialogOpen(true);
  };

  const getCustomerCreditAvailable = (customerId?: string | null) => {
    if (!customerId) return 0;
    const customer = customers.find((item) => item.id === customerId);
    const limit = Math.max(0, Number(customer?.creditLimit || 0));
    const currentDebt = Math.max(0, -Number(customer?.balance || 0));
    return Math.max(0, Number((limit - currentDebt).toFixed(2)));
  };

  const closeInvoicePayment = () => {
    if (paymentLoading) return;
    // Conserva el contenido durante la animación de salida. Los campos se
    // reinicializan al abrir el siguiente pago para evitar un modal fantasma.
    setPaymentDialogOpen(false);
  };

  const openInvoiceCredit = (invoice: Invoice) => {
    if (!canPerform('SALES_INVOICES', 'approve') || !canPerform('SALES_CREDIT_NOTES', 'approve')) {
      toast.error('No tienes permisos para enviar esta factura a crédito');
      return;
    }
    const status = String(invoice.status || (!invoice.id ? 'DRAFT' : '')).toUpperCase();
    const actionInvoice = !invoice.id && status === 'DRAFT'
      ? ({ ...invoice, status: 'PENDING' } as Invoice)
      : invoice;
    if (!['PENDING', 'PARTIAL', 'OVERDUE'].includes(String(actionInvoice.status || '').toUpperCase()) || getInvoiceBalance(actionInvoice) <= 0.01) {
      toast.error('Solo se puede enviar a crédito una factura con saldo pendiente');
      return;
    }
    if (getCustomerCreditAvailable(invoice.customerId) <= 0.01) {
      toast.error('El cliente no tiene límite de crédito disponible para esta operación');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const existingDueDate = invoice.dueDate ? String(invoice.dueDate).split('T')[0] : '';
    setCreditInvoice(actionInvoice);
    setCreditDueDate(existingDueDate && existingDueDate >= today ? existingDueDate : today);
  };

  const handleSendInvoiceToCredit = async () => {
    if (!creditInvoice || !creditDueDate) {
      toast.error('Selecciona la fecha de pago del crédito');
      return;
    }
    const invoice = creditInvoice;
    if (!invoice.id) {
      setCreditInvoice(null);
      await handleSaveInvoice('CREDIT', { dueDate: new Date(`${creditDueDate}T12:00:00`).toISOString() });
      return;
    }
    const creditToastId = toast.loading(`Enviando factura ${invoice.number} a crédito...`);
    try {
      setCreditLoading(true);
      await invoicesService.sendToCredit(invoice.id, { dueDate: new Date(`${creditDueDate}T12:00:00`).toISOString() });
      toast.success(`Factura ${invoice.number} enviada a Créditos por su saldo pendiente`, { id: creditToastId });
      setCreditInvoice(null);
      if (localDoc?.id === invoice.id) {
        setEditingId(null);
        setIsCreating(false);
        setLocalDoc(null);
      }
      await onRefresh();
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'No se pudo enviar la factura a crédito';
      toast.error(Array.isArray(message) ? message[0] : message, { id: creditToastId });
    } finally {
      setCreditLoading(false);
    }
  };

  const handleSendInvoiceToCash = async (invoice: Invoice) => {
    if (!invoice.id) return;
    if (!canPerform('SALES_INVOICES', 'approve')) {
      toast.error('No tienes permiso para enviar facturas a caja');
      return;
    }
    if (['PAID', 'CANCELLED'].includes(String(invoice.status || '').toUpperCase()) || getInvoiceBalance(invoice) <= 0.01) {
      toast.error('La factura no tiene saldo pendiente para enviar a caja');
      return;
    }
    if (isInvoiceInCashQueue(invoice)) {
      toast.info(`La factura ${invoice.number} ya está en la cola de caja; no se duplicará.`);
      return;
    }
    setCashSendingInvoiceId(invoice.id);
    try {
      await invoicesService.sendToCash(invoice.id);
      toast.success(`Factura ${invoice.number} enviada a la cola de caja`);
      onRefresh();
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'No se pudo enviar la factura a caja';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setCashSendingInvoiceId(null);
    }
  };

  const handleInvoicePayment = async () => {
    if (!paymentInvoice) return;
    const cashControlAlreadyLinked = Boolean(paymentInvoice.registerId || paymentInvoice.sessionId);
    const maxAmount = getInvoiceBalance(paymentInvoice);
    const amount = Number(paymentLines.reduce((sum, line) => sum + Number(line.amount || 0), 0).toFixed(2));
    if (!paymentDate || Number.isNaN(new Date(`${paymentDate}T12:00:00`).getTime())) {
      toast.error('Selecciona una fecha válida para registrar el pago');
      return;
    }
    const paymentBaseAmount = Number(paymentLines.reduce((sum, line) => sum + toBaseAmount(
      Number(line.amount || 0),
      line.currency,
      line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
    ), 0).toFixed(2));
    const invoiceCurrency = String(paymentInvoice.currency || baseCurrency).toUpperCase() === 'USD' ? 'USD' : 'NIO';
    const amountAppliedToInvoice = Number(convertBetweenCurrencies(
      paymentBaseAmount,
      baseCurrency,
      invoiceCurrency,
      1,
      paymentInvoice.exchangeRate,
    ).toFixed(2));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('El monto del pago debe ser mayor que cero');
      return;
    }
    if (amountAppliedToInvoice > maxAmount + 0.01) {
      toast.error('El pago no puede superar el saldo pendiente de la factura');
      return;
    }
    if (paymentLines.some((line) => requiresPaymentReference(line.method) && !line.reference?.trim())) {
      toast.error('La referencia es obligatoria para transferencia, tarjeta y cheque');
      return;
    }
    if (paymentLines.some((line) => isBankPaymentMethod(line.method, true) && !line.bankAccountId)) {
      toast.error('Selecciona el banco global para cada tarjeta, transferencia o cheque');
      return;
    }
    const remaining = Math.max(0, Number((maxAmount - amountAppliedToInvoice).toFixed(2)));
    if (remaining > 0.01 && !paymentDueDate) {
      toast.error('Selecciona la fecha en que se pagará el saldo restante');
      return;
    }
    if (!cashControlAlreadyLinked && (!cashRegisterId || !cashSession)) {
      toast.error('Selecciona una caja con sesión abierta para registrar el pago en Control de Caja');
      return;
    }

    const invoice = paymentInvoice;
    if (!invoice.id) {
      setPaymentDialogOpen(false);
      try {
        setPaymentLoading(true);
        await handleSaveInvoice('PAYMENT', {
          payments: paymentLines,
          currency: paymentCurrency,
          exchangeRate: paymentLineRate(paymentCurrency),
          paymentDate: new Date(`${paymentDate}T12:00:00`).toISOString(),
          dueDate: remaining > 0.01 ? new Date(`${paymentDueDate}T12:00:00`).toISOString() : undefined,
          cashRegisterId,
          cashSessionId: cashSession?.id,
        });
      } finally {
        setPaymentLoading(false);
      }
      return;
    }
    const payToastId = toast.loading(`Registrando pago de factura ${invoice.number}...`);
    try {
      setPaymentLoading(true);
      if (String(invoice.status || '').toUpperCase() === 'DRAFT') {
        // Formalizar el borrador antes del cobro para que se descuente stock,
        // se genere el asiento de venta y luego el pago pueda conciliarse.
        await invoicesService.update(invoice.id, {
          status: 'PENDING',
          items: (invoice as any).items || [],
        } as any);
      }
      const activeCredit = (invoice.creditNotes || []).find((credit) => ['ISSUED', 'PARTIAL', 'APPLIED'].includes(String(credit.status).toUpperCase()));
      await paymentsService.createMixed({
        customerId: invoice.customerId,
        invoiceId: activeCredit ? undefined : invoice.id,
        creditNoteId: activeCredit?.id,
        date: new Date(`${paymentDate}T12:00:00`).toISOString(),
        amount,
        currency: paymentCurrency,
        exchangeRate: paymentLineRate(paymentCurrency),
        method: paymentLines[0]?.method || 'CASH',
        payments: paymentLines,
        dueDate: remaining > 0.01 ? new Date(`${paymentDueDate}T12:00:00`).toISOString() : undefined,
        cashRegisterId: cashControlAlreadyLinked ? undefined : cashRegisterId,
        cashSessionId: cashControlAlreadyLinked ? undefined : cashSession?.id,
        notes: `Cobro registrado desde Facturas (${invoice.number})`,
      } as any);

      if (localDoc?.id === invoice.id) {
        setEditingId(null);
        setIsCreating(false);
        setLocalDoc(null);
      }

      toast.success(remaining > 0.01 ? `Pago parcial registrado. Saldo restante: ${formatInvoiceAmount(remaining, invoice.currency, invoice.exchangeRate)}` : `Factura ${invoice.number} pagada`, { id: payToastId });
      setPaymentDialogOpen(false);
      await onRefresh();
    } catch (e: any) {
      console.error('Error al pagar factura:', e);
      const msg = e.response?.data?.message || e.message || 'No se pudo registrar el pago';
      toast.error(Array.isArray(msg) ? msg[0] : msg, { id: payToastId });
    } finally {
      setPaymentLoading(false);
    }
  };

  const startNewInvoice = async () => {
    setIsCreating(true);
    setEditingId(null);
    const newInvoiceDraft = {
      customerId: '',
      number: '',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      currency: displayCurrency as any,
      exchangeRate: globalRate,
      items: [],
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      total: 0,
      notes: '',
      sellerEmployeeId: '',
      commissionType: 'PERCENTAGE',
      commissionRate: 0,
      commissionAmount: 0,
    };
    setLocalDoc(newInvoiceDraft);
    setLocalRates({ dRate: 0, tRate: 15 });

    try {
      const nextNumber = await invoicesService.getNextNumber();
      setLocalDoc((current: any) => current ? { ...current, number: nextNumber } : current);
    } catch (error) {
      console.warn('No se pudo consultar la vista previa del número de factura.', error);
    }
  };

  const handleSaveInvoice = async (
    action: InvoiceSaveAction = 'DRAFT',
    settlement?: { payments?: InvoicePaymentLine[]; currency?: string; exchangeRate?: number; paymentDate?: string; dueDate?: string; cashRegisterId?: string; cashSessionId?: string },
  ) => {
    if (!localDoc) return;
    const emitir = action !== 'DRAFT';
    if (!localDoc.customerId) {
      toast.error('Selecciona un cliente');
      return;
    }
    if (!localDoc.items || localDoc.items.length === 0) {
      toast.error('Agrega al menos un producto');
      return;
    }
    if (emitir) {
      const priceMessage = getMissingSalesPriceMessage(localDoc.items);
      if (priceMessage) {
        toast.error(priceMessage);
        return;
      }
      if (!localDoc.salesOrderId) {
        for (const item of localDoc.items || []) {
          if (resolveItemType(item) !== 'SERVICE') continue;
          const p = findProductForItem(item);
          if (p && p.isActive === false) {
            toast.error(`El servicio ${p.name || item.description || ''} no está disponible`);
            return;
          }
        }
      }
    }
    const serialRows = (localDoc.items || []).filter((item: any) => {
      const p = findProductForItem(item);
      return isSerialTracked(p);
    });
    const seenSerials = new Set<string>();
    for (const row of serialRows) {
      if (!row.warehouseId) {
        toast.error('Selecciona almacén origen para cada producto serializado');
        return;
      }
      const serialNumbers = (row.serialNumbers || []).map((n: string) => String(n || '').trim()).filter(Boolean);
      const unique = new Set(serialNumbers);
      if (serialNumbers.length !== unique.size) {
        toast.error('Hay IMEI repetidos en la misma línea');
        return;
      }
      if (Number(row.quantity || 0) !== serialNumbers.length) {
        toast.error('La cantidad debe coincidir con los IMEI seleccionados');
        return;
      }
      const available = getAvailableSeriesForItem(row).map((s: any) => String(s.number || '').trim());
      for (const serial of serialNumbers) {
        if (seenSerials.has(serial)) {
          toast.error(`El IMEI ${serial} está repetido en más de una línea`);
          return;
        }
        seenSerials.add(serial);
        if (available.length > 0 && !available.includes(serial)) {
          toast.error(`El IMEI ${serial} no está disponible para el producto/almacén seleccionado`);
          return;
        }
      }
    }

    const serialNotes = serialRows.length > 0
      ? `\n[SERIALES]\n${serialRows.map((row: any) => {
          const prod = findProductForItem(row);
          const wh = warehouses.find((w: any) => w.id === row.warehouseId);
          return `${prod?.code || row.productId} (${wh?.name || 'Sin almacén'}): ${(row.serialNumbers || []).join(', ')}`;
        }).join('\n')}`
      : '';

    const baseNotes = String(localDoc.notes || '').split('\n[SERIALES]\n')[0];
    const finalNotes = `${baseNotes}${serialNotes}`.trim();

    const saveToastId = toast.loading(
      action === 'PAYMENT'
        ? 'Creando y registrando pago...'
        : action === 'CREDIT'
          ? 'Creando y enviando a crédito...'
          : action === 'PENDING'
            ? 'Emitiendo factura pendiente...'
            : (isCreating ? 'Guardando factura como borrador...' : 'Guardando factura...'),
    );
    try {
      if (isCreating) {
        await invoicesService.create({
          customerId: localDoc.customerId,
          date: new Date(localDoc.date).toISOString(),
          dueDate: new Date(localDoc.dueDate).toISOString(),
          currency: localDoc.currency,
          exchangeRate: Number(localDoc.exchangeRate || globalRate),
          warehouseId: (localDoc as any).warehouseId || warehouses[0]?.id || undefined,
          priceListId: localDoc.priceListId || undefined,
          items: localDoc.items.map((item: any) => ({
            productId: item.productId || undefined,
            warehouseId: item.warehouseId || undefined,
            description: item.description || '',
            quantity: Number(item.quantity || 1),
            unitPrice: Number(item.unitPrice || 0),
            taxRate: Number(item.taxRate || 0),
            discount: Number(item.discount || 0),
            priceListId: item.priceListId || undefined,
            total: Number(item.total || 0),
          })),
          subtotal: Number(localDoc.subtotal || 0),
          taxAmount: Number(localDoc.taxAmount || 0),
          discountAmount: Number(localDoc.discountAmount || 0),
          total: Number(localDoc.total || 0),
          pricingMode,
          status: action === 'PENDING' ? 'PENDING' : 'DRAFT',
          initialAction: action === 'PAYMENT' || action === 'CREDIT' ? action : undefined,
          initialPayment: action === 'PAYMENT' ? {
            payments: settlement?.payments || [],
            currency: settlement?.currency,
            paymentDate: settlement?.paymentDate,
            dueDate: settlement?.dueDate,
            cashRegisterId: settlement?.cashRegisterId,
            cashSessionId: settlement?.cashSessionId,
          } : undefined,
          initialCreditDueDate: action === 'CREDIT' ? settlement?.dueDate : undefined,
          expectedDelivery: localDoc.expectedDelivery ? new Date(localDoc.expectedDelivery).toISOString() : undefined,
          notes: finalNotes,
          salesOrderId: localDoc.salesOrderId || undefined,
          sellerEmployeeId: localDoc.sellerEmployeeId || undefined,
          commissionType: localDoc.commissionType || 'PERCENTAGE',
          commissionRate: localDoc.commissionRate || undefined,
          commissionAmount: localDoc.commissionAmount || undefined,
        } as any);
        toast.success(
          action === 'PAYMENT' ? 'Factura creada y pago registrado'
            : action === 'CREDIT' ? 'Factura creada y enviada a Créditos'
              : action === 'PENDING' ? 'Factura emitida como pendiente'
                : 'Factura guardada como borrador',
          { id: saveToastId },
        );
      } else {
        const invoiceUpdates = { ...localDoc };
        delete invoiceUpdates.paymentMethod;
        delete invoiceUpdates.paymentDetails;
        await handleUpdate(localDoc.id, {
          ...invoiceUpdates,
          items: localDoc.items,
          notes: finalNotes,
          status: action === 'PENDING' ? 'PENDING' : localDoc.status,
        });
        toast.success(action === 'PENDING' ? 'Factura emitida como pendiente' : 'Factura guardada como borrador', { id: saveToastId });
      }
      setIsCreating(false);
      setEditingId(null);
      setLocalDoc(null);
      onRefresh();
    } catch (e: any) {
      const msg = e.response?.data?.message;
      toast.error(`No se pudo guardar: ${Array.isArray(msg) ? msg.join(', ') : (msg || e.message)}`, { id: saveToastId });
    }
  };

  const paymentTotalBase = paymentLines.reduce((sum, line) => sum + toBaseAmount(
    Number(line.amount || 0),
    line.currency,
    line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
  ), 0);
  const paymentInvoiceCurrency = paymentInvoice && String(paymentInvoice.currency || baseCurrency).toUpperCase() === 'USD' ? 'USD' : 'NIO';
  const paymentTotalInInvoiceCurrency = paymentInvoice
    ? convertBetweenCurrencies(paymentTotalBase, baseCurrency, paymentInvoiceCurrency, 1, paymentInvoice.exchangeRate)
    : paymentTotalBase;
  const paymentRemainingInInvoiceCurrency = paymentInvoice
    ? Math.max(0, getInvoiceBalance(paymentInvoice) - paymentTotalInInvoiceCurrency)
    : 0;

  const recalcTotals = (items: any[], dRate: number, tRate: number) => {
    if (pricingMode === 'individual') return recalcIndividualTotals(items);
    const subtotal = items.reduce((acc: number, it: any) => acc + Number(it.total || 0), 0);
    const discountAmount = subtotal * (dRate / 100);
    const base = subtotal - discountAmount;
    const taxAmount = base * (tRate / 100);
    const total = base + taxAmount;
    // Mantener las líneas en ambos modos. El selector de lista de precios
    // también recalcula los totales cuando su matriz termina de cargar; si
    // este retorno no incluye `items`, esa actualización visualiza la factura
    // sin líneas aunque la base de datos las conserve.
    return { items, subtotal, discountAmount, taxAmount, total };
  };

  const recalcIndividualTotals = (items: any[]) => {
    const pricedItems = items.map((line: any) => {
      const gross = Number(line.quantity || 0) * Number(line.unitPrice || 0);
      const discount = gross * (Number(line.discount || 0) / 100);
      const taxable = gross - discount;
      const tax = taxable * (Number(line.taxRate || 0) / 100);
      return { ...line, total: taxable + tax };
    });
    const subtotal = pricedItems.reduce((sum: number, line: any) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);
    const discountAmount = pricedItems.reduce((sum: number, line: any) => sum + (Number(line.quantity || 0) * Number(line.unitPrice || 0) * Number(line.discount || 0) / 100), 0);
    const taxAmount = pricedItems.reduce((sum: number, line: any) => {
      const gross = Number(line.quantity || 0) * Number(line.unitPrice || 0);
      return sum + ((gross - gross * Number(line.discount || 0) / 100) * Number(line.taxRate || 0) / 100);
    }, 0);
    return { items: pricedItems, subtotal, discountAmount, taxAmount, total: subtotal - discountAmount + taxAmount };
  };

  function getInvoiceBalance(invoice: Partial<Invoice>) {
    const status = String(invoice.status || '').toUpperCase();
    if (status === 'DRAFT' || status === 'CANCELLED') return 0;
    const total = Number(invoice.total);
    const amountPaid = Number(invoice.amountPaid || 0);
    if (Number.isFinite(total)) {
      // `total` ya incluye subtotal, impuestos (incluido IVA), descuentos y
      // retenciones. El saldo no debe depender del campo persistido `balance`.
      return Math.max(0, Number((total - amountPaid).toFixed(2)));
    }
    return Math.max(0, Number(invoice.balance || 0));
  }

  const formatInvoiceAmount = (amount: number, currency?: string, rate?: number) => (
    valuationMode === 'CURRENT'
      ? formatCurrentAmount(amount, currency)
      : formatHistoricalAmount(amount, currency, rate)
  );

  const isInvoiceCancellableFromList = (invoice: Partial<Invoice>) => {
    const status = String(invoice.status || '').toUpperCase();
    return !['PAID', 'PARTIAL', 'CANCELLED', 'CREDIT'].includes(status) && Number(invoice.amountPaid || 0) <= 0.01;
  };

  const handleDownloadInvoicePdf = async (invoice: Invoice, format: PdfDownloadFormat = 'configured') => {
    const previewToastId = toast.loading('Preparando la previsualización de la factura...');
    try {
      await previewSalesTransactionPDF({
        document: invoice,
        tenantName: user?.tenantName || 'Empresa',
        formatAmount: formatConvertedAmount as any,
        tenantLogo: themeConfig?.logo,
        documentType: 'invoice',
        format,
      });
      toast.success('Previsualización abierta. Descargá el PDF desde el visor del navegador.', { id: previewToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo abrir la previsualización', { id: previewToastId });
    }
  };

  const getInvoiceExchangeDifference = (amount: number, currency?: string, rate?: number) => {
    const sourceCurrency = String(currency || baseCurrency).toUpperCase();
    if (!amount || sourceCurrency === baseCurrency || sourceCurrency === displayCurrency) return 0;
    return convertCurrentAmount(amount, currency) - convertAmount(amount, currency, rate || globalRate);
  };


  const columns: ColumnDef<Invoice>[] = [
    {
      key: 'number',
      header: 'Nº Factura',
      width: '140px',
      render: (val, row) => {
        const source = getInvoiceSourceBadge(row);
        return (
          <div className="flex min-w-0 flex-col items-start gap-1">
            <span className="text-xs font-black font-mono text-primary cursor-pointer hover:underline" onClick={(event) => { event.stopPropagation(); setDetailInvoice(row); }}>{val}</span>
            {source && <Badge className={cn('border-none px-1.5 py-0 text-[8px] font-black', source.className)}>{source.label}</Badge>}
          </div>
        );
      }
    },
    {
      key: 'customer',
      header: 'Cliente',
      headerExtra: <ColumnFilterMenu label="Cliente" options={distinctCustomers} selected={colFilters.state.customer?.values || []} onSelect={(values) => colFilters.setValues('customer', values)} sort={colFilters.state.customer?.sort || null} onSort={(sort) => colFilters.setSort('customer', sort)} />,
      render: (_val, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Varios'}</span>
    },
    {
      key: 'date',
      header: 'Fecha Emisión',
      headerExtra: <ColumnFilterMenu label="Fecha Emisión" sort={colFilters.state.date?.sort || null} onSort={(sort) => colFilters.setSort('date', sort)} sortOptions={[{ value: 'desc', label: 'Más recientes' }, { value: 'asc', label: 'Más antiguas' }]} />,
      render: (val) => <span className="text-xs font-medium text-muted-foreground">{formatDateSafe(val)}</span>
    },
    {
      key: 'dueDate',
      header: 'Vencimiento',
      headerExtra: <ColumnFilterMenu label="Vencimiento" sort={colFilters.state.dueDate?.sort || null} onSort={(sort) => colFilters.setSort('dueDate', sort)} sortOptions={[{ value: 'asc', label: 'Próximos a vencer' }, { value: 'desc', label: 'Más lejanos' }]} />,
      render: (val, row) => (
        <span className={cn(
          "text-xs font-bold",
          (row.status || '').toUpperCase() === 'OVERDUE' ? 'text-rose-500' : 'text-muted-foreground'
        )}>
          {formatDateSafe(val)}
        </span>
      )
    },
    {
      key: 'total',
      header: 'Total Neto',
      width: '150px',
      headerExtra: <ColumnFilterMenu label="Total Neto" sort={colFilters.state.total?.sort || null} onSort={(sort) => colFilters.setSort('total', sort)} />,
      render: (val, row) => {
        const amount = Number(val || 0);
        const difference = getInvoiceExchangeDifference(amount, row.currency, row.exchangeRate);
        return (
          <div className="min-w-0">
            <span className="text-[13px] font-black tabular-nums text-foreground">
              {formatInvoiceAmount(amount, row.currency, row.exchangeRate)}
            </span>
            {showValuationLegend && <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              {valuationModeLabel}
              {valuationMode === 'CURRENT' && Math.abs(difference) >= 0.005 && (
                <span className={cn('ml-1', difference > 0 ? 'text-orange-500' : 'text-emerald-500')}>
                  · Δ {formatCurrentAmount(difference, displayCurrency)}
                </span>
              )}
            </div>}
          </div>
        );
      }
    },
    {
      key: 'balance',
      header: 'Saldo pendiente',
      width: '150px',
      headerExtra: <ColumnFilterMenu label="Saldo pendiente" sort={colFilters.state.balance?.sort || null} onSort={(sort) => colFilters.setSort('balance', sort)} />,
      render: (_val, row) => {
        const balance = getInvoiceBalance(row);
        const difference = getInvoiceExchangeDifference(balance, row.currency, row.exchangeRate);
        return (
          <div className="min-w-0">
            <span className={cn(
              "text-[13px] font-black tabular-nums",
              balance > 0 ? "text-orange-500" : "text-emerald-500"
            )}>
              <span title="Total de la factura, incluido el IVA, menos pagos y aplicaciones">
                {formatInvoiceAmount(balance, row.currency, row.exchangeRate)}
              </span>
            </span>
            {showValuationLegend && <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              {valuationModeLabel}
              {valuationMode === 'CURRENT' && Math.abs(difference) >= 0.005 && (
                <span className={cn('ml-1', difference > 0 ? 'text-orange-500' : 'text-emerald-500')}>
                  · Δ {formatCurrentAmount(difference, displayCurrency)}
                </span>
              )}
            </div>}
          </div>
        );
      }
    },
    {
      key: 'paymentMethod',
      header: 'Forma de Pago',
      width: '130px',
      render: (val, row) => {
        const method = String(val || row.paymentMethod || '').toUpperCase();
        if (!method) return <span className="text-[11px] font-medium text-muted-foreground">—</span>;
        const isCredit = method === 'CREDIT';
        const labels: Record<string, string> = {
          CREDIT: 'Crédito', CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia', CHECK: 'Cheque', OTHER: 'Otro',
        };
        return (
          <div className="flex flex-col items-start gap-0.5">
            <Badge className={cn('border-none px-2 py-0.5 text-[8px] font-black uppercase tracking-widest', isCredit ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400')}>
              {isCredit ? 'A Crédito' : 'Contado'}
            </Badge>
            {!isCredit && <span className="text-[9px] font-bold uppercase text-muted-foreground/70">{labels[method] || method}</span>}
          </div>
        );
      }
    },
    {
      key: 'status',
      header: 'Estado',
      width: '110px',
      render: (val) => {
        const opt = statusOptions.find(o => o.value === (val || '').toUpperCase());
        return (
          <Badge variant="outline" className={cn(
            "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none",
            opt?.color || 'bg-muted/20 text-muted-foreground'
          )}>
            {opt?.label || val}
          </Badge>
        );
      }
    }
  ];

  const displayInvoiceAmount = (amount: number, currency?: string, rate?: number) => (
    valuationMode === 'CURRENT'
      ? convertCurrentAmount(amount, currency)
      : convertAmount(amount, currency, rate || globalRate)
  );

  const totalBilledInDisplayCurrency = data.reduce(
    (acc, invoice) => acc + displayInvoiceAmount(Number(invoice.total ?? invoice.baseTotal ?? 0), invoice.currency, invoice.exchangeRate),
    0,
  );
  const accountsReceivableInDisplayCurrency = data
    .filter(invoice => ['PENDING', 'OVERDUE', 'PARTIAL', 'CREDIT'].includes((invoice.status || '').toUpperCase()))
    .reduce((acc, invoice) => acc + displayInvoiceAmount(getInvoiceBalance(invoice), invoice.currency, invoice.exchangeRate), 0);
  const paidInDisplayCurrency = data.reduce(
    (acc, invoice) => acc + displayInvoiceAmount(Number(invoice.amountPaid || 0), invoice.currency, invoice.exchangeRate),
    0,
  );

  // ─── INLINE EDITOR VIEW ────────────────────────────────────────────────
  if ((editingId || isCreating) && localDoc && !paymentDialogOpen && !creditInvoice) {
    const isInvoiceLocked = !isCreating && ['PAID', 'CANCELLED'].includes(String(localDoc?.status || '').toUpperCase());
    const isCashRegisterInvoice = !isCreating && Boolean(localDoc?.registerId || localDoc?.sessionId);
    const hasInventoryLines = (localDoc?.items || []).some((item: any) => item?.productId && resolveItemType(item) !== 'SERVICE');
    const accountingBlocked = hasInventoryLines && (accountingPreflightLoading || !accountingPreflight?.ready);
    const accountingErrors = accountingPreflight?.errors || [];
    const hasCreditAvailable = getCustomerCreditAvailable(localDoc?.customerId) > 0.01;
    const canCreateCredit = !isInvoiceLocked
      && hasCreditAvailable
      && canPerform('SALES_INVOICES', 'approve')
      && canPerform('SALES_CREDIT_NOTES', 'approve');
    const canRegisterPayment = !isInvoiceLocked
      && canPerform('SALES_INVOICES', 'approve')
      && canPerform('SALES_PAYMENTS', 'create')
      && canPerform('SALES_PAYMENTS', 'approve');
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300" data-tour="sales-form-title">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setEditingId(null); setIsCreating(false); setLocalDoc(null); onClearInvoiceDraft?.(); }} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black uppercase tracking-tight">{isCreating ? 'Nueva Factura' : `Factura ${localDoc?.number}`}</h2>
                {!isCreating && (() => {
                  const source = getInvoiceSourceBadge(localDoc);
                  return source ? <Badge className={cn('border-none px-2 py-0.5 text-[8px] font-black', source.className)}>{source.label}</Badge> : null;
                })()}
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{isCreating ? 'Completar datos para crear factura' : 'Detalle de la factura'}</p>
              {!isCreating && isInvoiceInCashQueue(localDoc as Invoice) && (
                <Badge className="mt-2 border-amber-500/30 bg-amber-500/10 text-[9px] font-black uppercase text-amber-700 dark:text-amber-300">
                  En cola de caja · {String(localDoc?.cashQueue?.status || '').toUpperCase() === 'CLAIMED' ? 'tomada; también puede pagarse aquí' : 'disponible para Caja'}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2" data-tour="sales-form-actions">
            <SalesViewTutorial view="invoices" context="form" />
            {!isCreating && localDoc?.customerId && (
              <Button variant="outline" onClick={() => void handleWhatsApp()} className="rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-400/30 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300 gap-2 font-black uppercase text-[10px] tracking-widest px-4">
                <WhatsAppIcon fontSize="inherit" className="size-4" style={{ width: '1rem', height: '1rem', fontSize: '1rem' }} aria-hidden="true" /> WhatsApp
              </Button>
            )}
            {!isInvoiceLocked && ((isCreating && canPerform('SALES_INVOICES', 'create')) || (!isCreating && canPerform('SALES_INVOICES', 'edit'))) && (
              <>
                <Button variant="outline" className="rounded-xl border-border/50 hover:bg-muted/70 hover:text-foreground font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => handleSaveInvoice('DRAFT')}>
                  Guardar Borrador
                </Button>
                <Button variant="outline" className="rounded-xl border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300 font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => handleSaveInvoice('PENDING')} disabled={accountingBlocked}>
                  Guardar como pendiente
                </Button>
                {canCreateCredit && (
                  <Button variant="outline" className="rounded-xl border-violet-500/30 text-violet-600 hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300 font-black uppercase text-[10px] tracking-widest px-4"
                    onClick={() => openInvoiceCredit(localDoc as Invoice)} disabled={accountingBlocked}>
                    Enviar a crédito
                  </Button>
                )}
                {!isInvoiceLocked && !isInvoiceInCashQueue(localDoc as Invoice) && canPerform('SALES_INVOICES', 'approve') && getInvoiceBalance(localDoc as Invoice) > 0.01 && (
                  <Button variant="outline" className="rounded-xl border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 font-black uppercase text-[10px] tracking-widest px-4"
                    onClick={() => void handleSendInvoiceToCash(localDoc as Invoice)} disabled={cashSendingInvoiceId === localDoc.id || accountingBlocked}>
                    <Send className="mr-2 size-4" /> {cashSendingInvoiceId === localDoc.id ? 'Enviando...' : 'Enviar a caja'}
                  </Button>
                )}
                {canRegisterPayment && (
                  <Button className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4"
                    onClick={() => openInvoicePayment(localDoc as Invoice)}>
                    Registrar pago
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50" data-tour="sales-form-data">
            <CardContent className="min-w-0 p-4 space-y-3 sm:p-6">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
              <SalesAccountingLegend
                flow={isCashRegisterInvoice ? 'pos' : 'invoice'}
              />
              {hasInventoryLines && (accountingPreflightLoading || accountingErrors.length > 0) && (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  <div className="space-y-1 text-[11px]">
                    <p className="font-black uppercase tracking-wider">Advertencia contable antes de emitir</p>
                    <p>{accountingPreflightLoading ? 'Validando Costo de Ventas y cuenta de Inventario del almacén…' : accountingErrors.join(' ')}</p>
                    {!accountingPreflightLoading && accountingErrors.length > 0 && (
                      <p className="font-semibold">Configura la cuenta indicada antes de guardar la factura. No se registrará hasta que la validación sea correcta.</p>
                    )}
                  </div>
                </div>
              )}
              <div className="grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Número</p>
                   <Input value={localDoc?.number || ''} readOnly={isCreating} className="h-8 text-xs font-black uppercase" disabled={isInvoiceLocked} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Cliente</p>
                  <Combobox
                    options={customers
                      .filter(c => (c.status || '').toUpperCase() === 'ACTIVE' || c.id === localDoc?.customerId)
                      .map(c => ({ label: c.name, value: c.id, description: (c.code ? `[${c.code}] ` : '') + (c.phone || 'Sin teléfono') }))}
                    value={localDoc?.customerId || ''}
                    onChange={(val) => {
                      const priceListId = getCustomerPriceListId(val);
                      const items = (localDoc.items || []).map((item: any) => item.productId
                        ? { ...item, priceListId, unitPrice: 0, total: 0, priceMissing: false }
                        : { ...item, priceListId });
                      setLocalDoc({ ...localDoc, customerId: val, priceListId, items });
                      if (!isCreating) handleUpdate(localDoc!.id, { customerId: val, priceListId, items });
                    }}
                    placeholder="Seleccionar Cliente"
                    disabled={isInvoiceLocked}
                  />
                  <p className="mt-2 text-[10px] font-bold text-muted-foreground">
                    El límite de crédito se valida únicamente al registrar un pago parcial o emitir una venta a crédito.
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha Emisión</p>
                  <Input type="date" value={localDoc?.date ? (typeof localDoc.date === 'string' && localDoc.date.includes('T') ? localDoc.date.split('T')[0] : localDoc.date) : ''}
                    onChange={(e) => setLocalDoc({ ...localDoc, date: e.target.value })} className="h-8 text-xs" disabled={isInvoiceLocked} />
                </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Vencimiento</p>
                  <Input type="date" value={localDoc?.dueDate ? (typeof localDoc.dueDate === 'string' && localDoc.dueDate.includes('T') ? localDoc.dueDate.split('T')[0] : localDoc.dueDate) : ''}
                    onChange={(e) => setLocalDoc({ ...localDoc, dueDate: e.target.value })} className="h-8 text-xs" disabled={isInvoiceLocked} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Vendedor (Opcional)</p>
                  <Combobox
                    options={(employees || []).map(e => ({ label: `${e.firstName} ${e.lastName}`, value: e.id, description: e.position?.title }))}
                    value={localDoc?.sellerEmployeeId || ''}
                    onChange={(val) => { setLocalDoc({ ...localDoc, sellerEmployeeId: val }); if (!isCreating) handleUpdate(localDoc!.id, { sellerEmployeeId: val }); }}
                    placeholder="Seleccionar Vendedor"
                    disabled={isInvoiceLocked}
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Tipo de comisión</p>
                  <Select
                    value={localDoc?.commissionType || 'PERCENTAGE'}
                     disabled={isInvoiceLocked || !localDoc?.sellerEmployeeId}
                    onValueChange={(commissionType) => {
                      const nextType = commissionType as 'PERCENTAGE' | 'FIXED';
                      const updates = nextType === 'FIXED'
                        ? { commissionType: nextType, commissionRate: 0 }
                        : { commissionType: nextType, commissionAmount: 0 };
                      setLocalDoc({ ...localDoc, ...updates } as any);
                      if (!isCreating) void handleUpdate(localDoc!.id, updates as any);
                    }}
                  >
                    <SelectTrigger className={cn("h-8 text-xs", !localDoc?.sellerEmployeeId && "opacity-50 cursor-not-allowed bg-muted/20")}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENTAGE">Porcentaje</SelectItem>
                      <SelectItem value="FIXED">Monto fijo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">{localDoc?.commissionType === 'FIXED' ? 'Monto de comisión' : '% Comisión'}</p>
                  <Input
                    type="number"
                    min="0"
                    max={localDoc?.commissionType === 'FIXED' ? undefined : 100}
                    value={localDoc?.commissionType === 'FIXED' ? (localDoc?.commissionAmount || '') : (localDoc?.commissionRate || '')}
                    placeholder="0"
                     disabled={isInvoiceLocked || !localDoc?.sellerEmployeeId}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setLocalDoc({ ...localDoc, ...(localDoc?.commissionType === 'FIXED' ? { commissionAmount: value } : { commissionRate: value }) } as any);
                    }}
                    onBlur={() => {
                      if (isCreating || !localDoc?.sellerEmployeeId) return;
                      const updates = localDoc.commissionType === 'FIXED'
                        ? { commissionAmount: Number(localDoc.commissionAmount || 0), commissionRate: 0 }
                        : { commissionRate: Number(localDoc.commissionRate || 0), commissionAmount: 0 };
                      void handleUpdate(localDoc.id, updates as any);
                    }}
                    className={cn("h-8 text-xs", !localDoc?.sellerEmployeeId && "opacity-50 cursor-not-allowed bg-muted/20")}
                  />
                  {!localDoc?.sellerEmployeeId && <p className="text-[9px] text-muted-foreground/60 mt-0.5 italic">Selecciona un empleado primero</p>}
                </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Moneda de la transacción</p>
                     <Select disabled={isInvoiceLocked} value={localDoc?.currency || 'NIO'} onValueChange={(currency) => {
                      const exchangeRate = currency === 'NIO' ? 1 : Number(globalRate || 1);
                      setLocalDoc({ ...localDoc, currency, exchangeRate } as any);
                      void handleUpdate(localDoc!.id, { currency, exchangeRate } as any);
                    }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar moneda" /></SelectTrigger>
                      <SelectContent><SelectItem value="NIO">Córdobas (C$)</SelectItem><SelectItem value="USD">Dólares (US$)</SelectItem></SelectContent>
                    </Select>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">Tasa configurada: <span className="font-bold">{localDoc?.currency === 'NIO' ? '1.00' : Number(localDoc?.exchangeRate || globalRate || 1).toFixed(2)}</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Entrega estimada (opcional)</p>
                    <Input type="date" value={localDoc?.expectedDelivery ? (typeof localDoc.expectedDelivery === 'string' && localDoc.expectedDelivery.includes('T') ? localDoc.expectedDelivery.split('T')[0] : localDoc.expectedDelivery) : ''}
                      onChange={(event) => setLocalDoc({ ...localDoc, expectedDelivery: event.target.value || null })} className="h-8 text-xs" disabled={isInvoiceLocked} />
                    <p className="mt-1 text-[10px] text-muted-foreground/70">Se usa para alertar si el pago queda parcial antes de la entrega.</p>
                  </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50" data-tour="sales-form-summary">
            <CardContent className="min-w-0 p-4 space-y-3 sm:p-6">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumen Financiero</p>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-muted/10 p-2 text-[10px] font-black uppercase tracking-widest">
                <span className="text-muted-foreground">Aplicar impuestos/descuentos:</span>
                 <Button type="button" disabled={isInvoiceLocked} size="sm" variant={pricingMode === 'global' ? 'default' : 'outline'} className="h-7 rounded-lg px-2 text-[10px]" onClick={() => { setPricingMode('global'); setLocalRates({ dRate: 0, tRate: 15 }); }}>Global</Button>
                 <Button type="button" disabled={isInvoiceLocked} size="sm" variant={pricingMode === 'individual' ? 'default' : 'outline'} className="h-7 rounded-lg px-2 text-[10px]" onClick={() => { setPricingMode('individual'); setLocalRates({ dRate: 0, tRate: 0 }); }}>{'Por producto'}</Button>
              </div>
              <div className="space-y-3">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">Subtotal</span>
                  <div className="flex min-w-0 items-center gap-2">{localDoc?.currency === 'USD' ? '$' : 'C$'} <Input type="text" value={formatSalesAmount(localDoc?.subtotal)} readOnly className="h-8 w-24 max-w-full text-right font-bold bg-muted/20" /></div></div>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">Descuento</span>
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-rose-500">
                    <div className="flex items-center mr-2">{pricingMode === 'global' ? <Input type="number" min="0" max="100" value={localRates.dRate || ''} placeholder="0" onChange={(e) => {
                      const newRate = Number(e.target.value); setLocalRates(p => ({ ...p, dRate: newRate }));
                      const calc = recalcTotals(localDoc?.items || [], newRate, localRates.tRate);
                      setLocalDoc({ ...localDoc, ...calc });
                     }} className="w-16 h-8 text-right font-bold text-rose-500 bg-transparent" disabled={isInvoiceLocked} /> : null} {pricingMode === 'global' && <span className="ml-1 text-xs font-black">%</span>}</div>
                    -{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(localDoc?.discountAmount)}
                  </div></div>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">IVA</span>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {pricingMode === 'global' && <label className="flex h-8 items-center gap-1.5 rounded-md bg-muted/30 px-2 text-xs font-black">
                      <input type="checkbox" checked={Number(localRates.tRate || 0) > 0} onChange={(e) => {
                        const newRate = e.target.checked ? 15 : 0;
                        const calc = recalcTotals(localDoc?.items || [], localRates.dRate, newRate);
                        setLocalRates(p => ({ ...p, tRate: newRate }));
                        setLocalDoc({ ...localDoc, ...calc });
                       }} disabled={isInvoiceLocked} /> Aplicar
                    </label>}
                    {localDoc?.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(localDoc?.taxAmount)}
                  </div></div>
                <div className="flex justify-between items-center text-base border-t pt-3 border-border/50">
                  <span className="font-black">Total</span>
                  <div className="flex flex-col items-end">
                    <span className="text-primary font-black text-lg">{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(localDoc?.total)}</span>
                    {localDoc?.currency === 'USD' && <p className="text-[10px] font-bold text-muted-foreground mt-1 italic">≈ C$ {formatSalesAmount(Number(localDoc?.total || 0) * (localDoc?.exchangeRate || globalRate))}</p>}
                    {localDoc?.currency === 'NIO' && <p className="text-[10px] font-bold text-muted-foreground mt-1 italic">≈ $ {formatSalesAmount(Number(localDoc?.total || 0) / (localDoc?.exchangeRate || globalRate))}</p>}
                  </div>
                </div>
                {!isCreating && String(localDoc?.status || '').toUpperCase() !== 'DRAFT' && (
                  <div className="flex justify-between items-center border-t border-border/40 pt-3">
                    <div>
                      <span className="text-sm font-black text-orange-500">Saldo pendiente</span>
                      <p className="text-[10px] text-muted-foreground">Total incluido IVA − pagos aplicados</p>
                    </div>
                    <span className="text-orange-500 font-black text-lg" title="Total incluido IVA menos pagos aplicados">{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(getInvoiceBalance(localDoc))}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Items */}
        <Card className="rounded-2xl border-border/50" data-tour="sales-form-items">
            <CardContent className="min-w-0 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Productos / Servicios</p>
              <div className="flex flex-wrap gap-2">
                {(['PRODUCT', 'SERVICE'] as const).map((itemType) => <Button key={itemType} type="button" variant="outline" size="sm" disabled={isInvoiceLocked} onClick={() => {
                  const newItems = [...(localDoc.items || []), { id: Date.now().toString(), itemType, description: '', quantity: 1, unitPrice: 0, total: 0, productId: null, warehouseId: '', serialNumbers: [] }];
                  setLocalDoc({ ...localDoc, items: newItems });
                }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl"><Plus className="size-3 mr-2" /> Agregar {itemType === 'PRODUCT' ? 'Producto' : 'Servicio'}</Button>)}
              </div>
            </div>
            <div className="space-y-2">
              <div className="hidden xl:grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                <div className={cn("xl:col-span-6", pricingMode === 'individual' && "xl:col-span-5")}>Descripción</div>
                {pricingMode === 'individual' && <div className="col-span-2 grid grid-cols-2 gap-1.5">
                  <div>Aplicar</div>
                  <div className="text-right">Desc.</div>
                </div>}
                <div className={cn("col-span-2 text-right", pricingMode === 'individual' && "xl:col-span-1")}>Cant.</div>
                <div className={cn("col-span-2 text-right", pricingMode === 'individual' && "xl:col-span-1")}>Precio U.</div>
                {pricingMode === 'individual' && <div className="col-span-2 text-right xl:col-span-1">IVA</div>}
                <div className="col-span-2 text-right">Total</div>
              </div>
              {(localDoc.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} data-item-layout="standard" className="sales-item-row grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-border/50 bg-muted/5 p-3 items-start xl:grid-cols-12 xl:gap-2 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0">
                  <div className={cn("min-w-0 xl:col-span-6", pricingMode === 'individual' && "xl:col-span-5")}>
                    <div className="flex min-w-0 flex-wrap items-center gap-1">
                      <div className="min-w-0 flex-1">
                        <Combobox
                          options={getItemCatalog(item).map(p => ({ label: `${String(p.itemType || resolveItemType(item)).toUpperCase() === 'SERVICE' ? 'Servicio' : 'Producto'} · ${p.code || ''} - ${p.name}`, value: p.id }))}
                          value={item.productId || ''}
                          onChange={(val) => {
                        const newItems = [...(localDoc.items || [])];
                        const selectedProd = (resolveItemType(item) === 'SERVICE' ? serviceCatalog : productCatalog).find(p => p.id === val);
                        newItems[idx] = { ...newItems[idx], productId: val, warehouseId: '', serialNumbers: [] };
                        if (selectedProd) {
                          newItems[idx].description = selectedProd.name;
                          const baseSalePrice = Number(selectedProd.salePrice ?? selectedProd.price ?? 0);
                          newItems[idx].unitPrice = localDoc?.currency === 'USD' ? baseSalePrice / Number(localDoc?.exchangeRate || globalRate || 1) : baseSalePrice;
                          newItems[idx].total = Number(newItems[idx].quantity) * Number(newItems[idx].unitPrice);
                        }
                        const calc = recalcTotals(newItems, localRates.dRate, localRates.tRate);
                        setLocalDoc({ ...localDoc, items: newItems, ...calc });
                        if (!isCreating) {
                          handleUpdate(localDoc!.id, { items: newItems, ...calc });
                        }
                          }}
                          placeholder={resolveItemType(item) === 'SERVICE' ? 'Seleccionar servicio...' : 'Seleccionar producto...'}
                          disabled={isInvoiceLocked}
                        />
                      </div>
                      <SalesLinePriceListSelect
                        productId={item.productId}
                        productCode={products.find((product) => product.id === item.productId)?.code || (item as any).code}
                        productName={item.description}
                        itemType={item.itemType}
                        value={item.priceListId}
                        defaultPriceListId={localDoc?.priceListId || getCustomerPriceListId(localDoc?.customerId)}
                        currency={localDoc?.currency}
                        exchangeRate={Number(localDoc?.exchangeRate || globalRate || 1)}
                        disabled={isInvoiceLocked}
                        onChange={(priceListId, result, source) => {
                          const nextItems = [...(localDoc.items || [])] as any[];
                          nextItems[idx] = {
                            ...nextItems[idx],
                            priceListId,
                            unitPrice: result.unitPrice ?? 0,
                            total: Number(nextItems[idx].quantity || 1) * Number(result.unitPrice ?? 0),
                            priceMissing: result.priceMissing,
                          };
                          const calc = recalcTotals(nextItems, localRates.dRate, localRates.tRate);
                          setLocalDoc({ ...localDoc, ...calc, priceListId, items: calc.items } as any);
                          if (!isCreating && source !== 'initial') void handleUpdate(localDoc!.id, { ...calc, priceListId, items: calc.items } as any);
                        }}
                      />
                    </div>
                    {item.productId && (
                      <div className="mt-1 flex items-center gap-2 px-1">
                        {(() => {
                          const p = findProductForItem(item);
                          if (!p) return null;
                          if (resolveItemType(item) === 'SERVICE') {
                            const available = p.isActive !== false;
                            return (
                              <>
                                <Badge variant="outline" className={cn(
                                  "text-[9px] font-black border-none px-1.5 py-0 h-4 bg-muted/20",
                                  available ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10"
                                )}>
                                  {available ? 'DISPONIBLE' : 'NO DISPONIBLE'}
                                </Badge>
                                {item.priceMissing && <PriceMissingBadge />}
                              </>
                            );
                          }
                          const stock = Number(p.stock || 0);
                          return (
                            <>
                              <Badge variant="outline" className={cn(
                                "text-[9px] font-black border-none px-1.5 py-0 h-4 bg-muted/20",
                                stock <= 0 ? "text-rose-500 bg-rose-500/10" : "text-emerald-500 bg-emerald-500/10"
                              )}>
                                STOCK: {stock}
                              </Badge>
                              {item.priceMissing && <PriceMissingBadge />}
                            </>
                          );
                        })()}
                      </div>
                    )}
                    {item.productId && isSerialTracked(findProductForItem(item)) && (
                      <div className="mt-2 space-y-2 rounded-md border border-border/50 p-2 bg-muted/10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Almacén origen</p>
                            <Select disabled={isInvoiceLocked}
                              value={item.warehouseId || ''}
                              onValueChange={(val) => {
                                const newItems = [...(localDoc.items || [])];
                                newItems[idx] = { ...newItems[idx], warehouseId: val, serialNumbers: [] };
                                setLocalDoc({ ...localDoc, items: newItems });
                              }}
                            >
                              <SelectTrigger className="h-8 text-[10px]"><SelectValue placeholder="Seleccionar almacén" /></SelectTrigger>
                              <SelectContent>
                                {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">IMEI/Series (uno por línea)</p>
                            <textarea
                              value={(item.serialNumbers || []).join('\n')}
                              onChange={(e) => {
                                const serialNumbers = e.target.value
                                  .split('\n')
                                  .map((n) => n.trim())
                                  .filter(Boolean);
                                const newItems = [...(localDoc.items || [])];
                                newItems[idx] = {
                                  ...newItems[idx],
                                  serialNumbers,
                                  quantity: serialNumbers.length > 0 ? serialNumbers.length : Number(newItems[idx].quantity || 1),
                                  total: (serialNumbers.length > 0 ? serialNumbers.length : Number(newItems[idx].quantity || 1)) * Number(newItems[idx].unitPrice || 0),
                                };
                                const calc = recalcTotals(newItems, localRates.dRate, localRates.tRate);
                                setLocalDoc({ ...localDoc, items: newItems, ...calc });
                              }}
                              disabled={isInvoiceLocked}
                              className="w-full h-20 rounded-md border border-input bg-background px-2 py-1 text-[10px] font-mono"
                              placeholder="Pega o escanea IMEI..."
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Disponibles: {getAvailableSeriesForItem(item).length} · Seleccionados: {(item.serialNumbers || []).length}
                        </p>
                      </div>
                    )}
                  </div>
                  {pricingMode === 'individual' && (
                    <div className="col-span-2 mt-0 grid min-w-0 grid-cols-2 items-start gap-1.5 self-start text-[10px]">
                      <label className="relative flex min-w-0 flex-1 items-center font-black uppercase tracking-wider">
                        <span className="flex h-8 w-full items-center gap-1.5 rounded-md bg-muted/30 px-2">
                          <input type="checkbox" checked={Number(item.taxRate || 0) > 0} onChange={(event) => {
                            const nextItems = [...(localDoc.items || [])];
                            nextItems[idx] = { ...nextItems[idx], taxRate: event.target.checked ? 15 : 0 };
                            const recalculated = recalcTotals(nextItems, 0, 0);
                            setLocalDoc({ ...localDoc, ...recalculated });
                            if (!isCreating) void handleUpdate(localDoc!.id, recalculated as any);
                       }} disabled={isInvoiceLocked} />
                          <span className="text-xs">IVA</span>
                        </span>
                      </label>
                      <label className="relative flex min-w-0 flex-1 items-center font-black uppercase tracking-wider">
                        <Input type="number" min="0" max="100" value={item.discount || ''} onChange={(event) => {
                          const nextItems = [...(localDoc.items || [])];
                          nextItems[idx] = { ...nextItems[idx], discount: Number(event.target.value) || 0 };
                          const recalculated = recalcTotals(nextItems, 0, 0);
                          setLocalDoc({ ...localDoc, ...recalculated });
                          if (!isCreating) void handleUpdate(localDoc!.id, recalculated as any);
                         }} className="w-full pr-6 text-left text-xs" disabled={isInvoiceLocked} />
                        <span className="pointer-events-none absolute right-2 text-[10px] text-muted-foreground">%</span>
                      </label>
                    </div>
                  )}
                  <div className={cn("min-w-0 xl:col-span-2", pricingMode === 'individual' && "xl:col-span-1")}>
                    <Input type="number" min="0" max={resolveItemType(item) === 'SERVICE' ? 1000000 : Number(findProductForItem(item)?.stock || 1000000)} value={Number(item.quantity) || ''} placeholder="0"
                      onChange={(e) => {
                        let newQty = Number(e.target.value);
                        const p = findProductForItem(item);
                        if (p && resolveItemType(item) !== 'SERVICE' && newQty > Number(p.stock || 0)) {
                          toast.warning(`Stock insuficiente. Disponible: ${p.stock}`, { id: `stock-warn-${idx}` });
                          newQty = Number(p.stock || 0);
                        }
                        const newItems = [...(localDoc.items || [])];
                        newItems[idx] = { ...newItems[idx], quantity: newQty, total: newQty * Number(newItems[idx].unitPrice || 0) };
                        const calc = recalcTotals(newItems, localRates.dRate, localRates.tRate);
                        setLocalDoc({ ...localDoc, items: newItems, ...calc });
                      }} onBlur={() => {
                        if (!isCreating) {
                          const calc = recalcTotals(localDoc.items || [], localRates.dRate, localRates.tRate);
                          handleUpdate(localDoc!.id, { items: localDoc.items, ...calc });
                        }
                       }} className="h-8 w-full text-xs text-right" disabled={Boolean(item.productId && isSerialTracked(findProductForItem(item))) || isInvoiceLocked} />
                  </div>
                  <div className={cn("col-span-2", pricingMode === 'individual' && "xl:col-span-1")}>
                    <Input type="text" inputMode="decimal" min="0" value={item.unitPrice === undefined || item.unitPrice === null ? '' : formatSalesAmount(item.unitPrice)} placeholder="0"
                      onChange={(e) => {
                        const newItems = [...(localDoc.items || [])];
                        const unitPrice = Number(String(e.target.value).replace(/,/g, '')) || 0;
                        newItems[idx] = { ...newItems[idx], unitPrice, total: Number(newItems[idx].quantity || 1) * unitPrice };
                        const calc = recalcTotals(newItems, localRates.dRate, localRates.tRate);
                        setLocalDoc({ ...localDoc, items: newItems, ...calc });
                      }} onBlur={() => {
                        if (!isCreating) {
                          const calc = recalcTotals(localDoc.items || [], localRates.dRate, localRates.tRate);
                          handleUpdate(localDoc!.id, { items: localDoc.items, ...calc });
                        }
                       }} className="h-8 w-full text-xs text-right" disabled={isInvoiceLocked} />
                  </div>
                  {pricingMode === 'individual' && (
                    <div className="col-span-2 flex items-center justify-end xl:col-span-1">
                      <Input
                        type="text"
                        readOnly
                        value={formatSalesAmount(((Number(item.quantity || 0) * Number(item.unitPrice || 0)) - (Number(item.quantity || 0) * Number(item.unitPrice || 0) * Number(item.discount || 0) / 100)) * Number(item.taxRate || 0) / 100)}
                        className="h-8 w-16 border-none bg-transparent px-0 text-right text-xs font-black shadow-none focus-visible:ring-0 focus-visible:border-transparent"
                      />
                    </div>
                  )}
                  <div className="flex min-w-0 items-center justify-end gap-2 text-right xl:col-span-2">
                    <span className="text-sm font-black">{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(item.total)}</span>
                     <Button type="button" variant="ghost" size="icon" disabled={isInvoiceLocked} className="size-6 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 rounded-md" onClick={() => {
                      const newItems = [...(localDoc.items || [])]; newItems.splice(idx, 1);
                      const calc = recalcTotals(newItems, localRates.dRate, localRates.tRate);
                      setLocalDoc({ ...localDoc, items: newItems, ...calc });
                    }}><Trash2 className="size-3" /></Button>
                  </div>
                </div>
              ))}
              {(!localDoc.items || localDoc.items.length === 0) && (
                <div className="text-center py-6 text-xs text-muted-foreground/50 italic border border-dashed border-border/50 rounded-xl bg-muted/10">
                  No hay productos asignados. Haz clic en "Agregar Item".
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Notas</p>
            <textarea disabled={isInvoiceLocked} value={localDoc?.notes || ''} onChange={(e) => setLocalDoc({ ...localDoc, notes: e.target.value })}
              className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" placeholder="Agregar notas..." />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── TABLE VIEW ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="sales-list-kpis">
        <SalesKpiCard title={`Facturado Total (${displayCurrency}${valuationModeSuffix})`} value={formatCurrentAmount(totalBilledInDisplayCurrency, displayCurrency)} icon={FileText} color="text-primary" bg="bg-primary/10" />
        <SalesKpiCard title={`Por Cobrar (${displayCurrency}${valuationModeSuffix})`} value={formatCurrentAmount(accountsReceivableInDisplayCurrency, displayCurrency)} icon={TrendingUp} color="text-orange-500" bg="bg-orange-500/10" active={statusFilter === 'RECEIVABLE'} onClick={() => setStatusFilter(statusFilter === 'RECEIVABLE' ? 'ALL' : 'RECEIVABLE')} />
        <SalesKpiCard title="Vencidas" value={data.filter(f => (f.status || '').toUpperCase() === 'OVERDUE').length} icon={AlertCircle} color="text-rose-500" bg="bg-rose-500/10" active={statusFilter === 'OVERDUE'} onClick={() => setStatusFilter(statusFilter === 'OVERDUE' ? 'ALL' : 'OVERDUE')} />
        <SalesKpiCard title={`Cobrado (${displayCurrency}${valuationModeSuffix})`} value={formatCurrentAmount(paidInDisplayCurrency, displayCurrency)} icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-500/10" active={statusFilter === 'PAID'} onClick={() => setStatusFilter(statusFilter === 'PAID' ? 'ALL' : 'PAID')} />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-2">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground" data-tour="sales-list-title">Control de Facturación</h2>
          </div>
          <div className="erp-list-toolbar flex flex-wrap items-center justify-end gap-3" data-tour="sales-list-actions">
            <SalesViewTutorial view="invoices" />
            <ViewLayoutSelect value={layoutMode} onChange={setLayoutMode} ariaLabel="Elegir distribución de facturas" />
            <SalesDateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChange={onDateRangeChange || (() => undefined)} />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input
                placeholder="Buscar factura..."
                className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold tracking-widest"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }}
              />
            </div>
            {canPerform('RETAIL_POS', 'read') && <InvoiceCashQueueBell onItemSelect={() => window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module: 'ventas', subModule: 'facturacion-caja' } }))} />}
            {salesAlert && <PurchaseAlertsButton alert={salesAlert} sectionLabel="ventas" storageNamespace="erp-sales-alerts" onItemSelect={setHighlightedAlertId} />}
            {canPerform('SALES_INVOICES', 'create') && (
              <Button onClick={startNewInvoice} data-toolbar-role="primary" className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20">
                <Plus className="size-4" /> Nueva Factura
              </Button>
            )}
          </div>
        </div>
        <EditableDataTable
          data={filteredData}
          pagination={pagination}
        columns={columns}
        showHorizontalControls
        actionsWidth="w-52"
        fitContent
        layoutMode={layoutMode}
        highlightedRowId={highlightedAlertId}
          onRowUpdate={async (id, updates) => { await handleUpdate(id, updates); }}
          onRowClick={(row) => setDetailInvoice(row)}
          onBulkDelete={async (ids) => {
            const rowsToCancel = data.filter((invoice) => ids.includes(invoice.id) && isInvoiceCancellableFromList(invoice));
            const skippedCount = ids.length - rowsToCancel.length;
            if (!rowsToCancel.length) {
              toast.error('Las facturas pagadas o con pagos parciales no se pueden anular desde esta vista');
              return;
            }
            if (skippedCount > 0) {
              toast.info(`${skippedCount} factura${skippedCount === 1 ? '' : 's'} pagada${skippedCount === 1 ? '' : 's'} o parcial${skippedCount === 1 ? '' : 'es'} se omitió${skippedCount === 1 ? '' : 'eron'}`);
            }
            const bulkCancelToastId = toast.loading(`Anulando ${rowsToCancel.length} factura${rowsToCancel.length === 1 ? '' : 's'}...`);
            try {
              await Promise.all(rowsToCancel.map((invoice) => invoicesService.cancel(invoice.id, 'Anulación masiva')));
              toast.success(`${rowsToCancel.length} factura${rowsToCancel.length === 1 ? '' : 's'} anulada${rowsToCancel.length === 1 ? '' : 's'}`, { id: bulkCancelToastId });
              onRefresh();
            } catch (e: any) {
              toast.error(e?.response?.data?.message || e?.message || 'No se pudieron anular las facturas', { id: bulkCancelToastId });
            }
          }}
          bulkAction="cancel"
          isLoading={loading}
          bulkActions={() => null}
          actions={(row) => (
            <div className="flex min-w-max items-center justify-end gap-1 pr-1">
              <WhatsAppActionButton
                phone={resolveCustomerPhone(row.customerId, row.customer, customers)}
                documentLabel="factura"
                onSend={() => handleWhatsApp(row)}
              />
              {canPerform('SALES_INVOICES', 'approve') && canPerform('SALES_CREDIT_NOTES', 'approve') &&
                !['PAID', 'CANCELLED', 'CREDIT'].includes(String(row.status).toUpperCase()) &&
                !row.creditNotes?.some((credit) => ['ISSUED', 'PARTIAL', 'APPLIED'].includes(String(credit.status).toUpperCase())) &&
                getInvoiceBalance(row) > 0.01 && (
                <Button type="button" title="Enviar saldo a crédito" aria-label={`Enviar saldo a crédito de ${row.number}`} variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg text-violet-500 hover:bg-violet-500/10 transition-colors" onClick={() => openInvoiceCredit(row)}>
                  <Send className="size-4" />
                </Button>
              )}
              {canPerform('SALES_INVOICES', 'approve') &&
                !['PAID', 'CANCELLED'].includes(String(row.status).toUpperCase()) &&
                !isInvoiceInCashQueue(row) &&
                getInvoiceBalance(row) > 0.01 && (
                <Button type="button" title="Enviar factura a caja" aria-label={`Enviar factura ${row.number} a caja`} variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg text-emerald-600 hover:bg-emerald-500/10 transition-colors" onClick={() => void handleSendInvoiceToCash(row)} disabled={cashSendingInvoiceId === row.id}>
                  {cashSendingInvoiceId === row.id ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              )}
              {canPerform('SALES_INVOICES', 'approve') && canPerform('SALES_PAYMENTS', 'create') && canPerform('SALES_PAYMENTS', 'approve') &&
                !['PAID', 'CANCELLED'].includes(String(row.status).toUpperCase()) &&
                getInvoiceBalance(row) > 0 && (
                <Button type="button" title="Registrar pago parcial o total" aria-label={`Registrar pago de ${row.number}`} variant="ghost" size="icon" disabled={paymentLoading && paymentInvoice?.id === row.id} className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-muted-foreground transition-colors" onClick={() => openInvoicePayment(row)}>
                  {paymentLoading && paymentInvoice?.id === row.id ? <CreditCard className="size-4 animate-pulse text-primary" /> : <CheckCircle2 className="size-4 text-muted-foreground" />}
                </Button>
              )}
              {canPerform('SALES_INVOICES', 'delete') && isInvoiceCancellableFromList(row) && (
                <Button type="button" title="Anular factura" aria-label={`Anular factura ${row.number}`} variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors" onClick={() => { setPendingCancelId(row.id); setCancelReason(''); }}>
                  <Ban className="size-4" />
                </Button>
              )}
              <Button type="button" title="Ver factura completa" aria-label={`Ver factura completa ${row.number}`} variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setDetailInvoice(null); setEditingId(row.id); }}>
                <Eye className="size-4" />
              </Button>
            </div>
          )}
        />
      </div>

      <InvoiceDetailSheet
        key={detailInvoice?.id || 'invoice-detail'}
        invoice={detailInvoice}
        sourceBadge={getInvoiceSourceBadge(detailInvoice)}
        open={Boolean(detailInvoice)}
        onClose={() => setDetailInvoice(null)}
        onOpenInvoice={(invoice) => { setDetailInvoice(null); setEditingId(invoice.id); }}
        onDownloadPdf={(invoice, format) => { void handleDownloadInvoicePdf(invoice, format); }}
        getBalance={getInvoiceBalance}
        formatAmount={formatInvoiceAmount}
        formatDate={formatDateSafe}
      />

      <ConfirmDialog
        open={pendingCancelId !== null}
        onOpenChange={(open) => { if (!open) { setPendingCancelId(null); setCancelReason(''); } }}
        title={"¿Cancelar factura?"}
        description="La factura quedará cancelada y no afectará reportes financieros. Esta acción no se puede deshacer."
        confirmLabel="Cancelar factura"
        variant="destructive"
        loading={cancelLoading}
        disabled={!cancelReason.trim()}
        onConfirm={async () => {
          if (!pendingCancelId || !cancelReason.trim()) return;
          const cancelToastId = toast.loading('Anulando factura...');
          try {
            setCancelLoading(true);
            await invoicesService.cancel(pendingCancelId, cancelReason.trim());
            toast.success('Factura anulada', { id: cancelToastId });
            setEditingId(null);
            setIsCreating(false);
            onRefresh();
          } catch (error: any) {
            toast.error(error?.response?.data?.message || error?.message || 'Error al anular factura', { id: cancelToastId });
          } finally {
            setCancelLoading(false);
            setPendingCancelId(null);
            setCancelReason('');
          }
        }}
      >
        <div className="mt-4">
          <label className="text-sm font-medium text-foreground mb-1 block">Motivo de cancelación *</label>
          <textarea
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
            rows={3}
            placeholder="Ej: Cliente solicitó cancelación, error en datos fiscales..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </div>
      </ConfirmDialog>

      <Dialog open={!!creditInvoice} onOpenChange={(open) => { if (!open && !creditLoading) setCreditInvoice(null); }}>
        <DialogContent className="w-[calc(100%-2rem)] !max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
              <Send className="size-5 text-violet-500" /> Enviar factura a crédito
            </DialogTitle>
            <DialogDescription>
              Se trasladará únicamente el saldo pendiente a Créditos y se validará el límite disponible del cliente.
            </DialogDescription>
          </DialogHeader>
          {creditInvoice && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{creditInvoice.number} · {creditInvoice.customer?.name || 'Cliente'}</p>
                <p className="mt-1 text-2xl font-black text-violet-600 dark:text-violet-400">Saldo a crédito: {formatInvoiceAmount(getInvoiceBalance(creditInvoice), creditInvoice.currency, creditInvoice.exchangeRate)}</p>
                <p className="mt-2 text-[10px] font-bold text-muted-foreground">La factura conservará el estado A CRÉDITO y el registro aparecerá en la vista Créditos.</p>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha de pago *</p>
                <Input type="date" value={creditDueDate} onChange={(event) => setCreditDueDate(event.target.value)} />
                <p className="mt-1 text-[10px] text-muted-foreground">Se enviará una notificación interna un día antes.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreditInvoice(null)} disabled={creditLoading}>Cancelar</Button>
            <Button type="button" onClick={() => void handleSendInvoiceToCredit()} disabled={creditLoading || !creditDueDate} className="bg-violet-600 font-black text-white hover:bg-violet-700">
              {creditLoading ? 'Enviando...' : 'Confirmar crédito'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={(open) => { if (!open) closeInvoicePayment(); }}>
        <DialogContent className="w-[calc(100%-2rem)] !max-w-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
              <CreditCard className="size-5 text-primary" /> Registrar pago de factura
            </DialogTitle>
            <DialogDescription>
              El método pertenece al cobro, igual que en Créditos y Facturación por Caja. Puedes registrar un pago parcial y completar el saldo después.
            </DialogDescription>
          </DialogHeader>
          {paymentInvoice && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{paymentInvoice.number} · {paymentInvoice.customer?.name || 'Cliente'}</p>
                    <p className="mt-1 text-2xl font-black text-primary">Saldo: {formatInvoiceAmount(getInvoiceBalance(paymentInvoice), paymentInvoice.currency, paymentInvoice.exchangeRate)}</p>
                  </div>
                  <Badge className={cn('border-none px-2 py-1 text-[9px] font-black uppercase', String(paymentInvoice.status).toUpperCase() === 'PARTIAL' ? 'bg-blue-500/10 text-blue-500' : String(paymentInvoice.status).toUpperCase() === 'CREDIT' ? 'bg-violet-500/10 text-violet-500' : 'bg-amber-500/10 text-amber-500')}>
                    {String(paymentInvoice.status).toUpperCase() === 'PARTIAL' ? 'Pago parcial' : String(paymentInvoice.status).toUpperCase() === 'CREDIT' ? 'A crédito' : 'Pendiente'}
                  </Badge>
                </div>
                {paymentInvoice.expectedDelivery && (
                  <p className="mt-3 flex items-start gap-2 text-[10px] font-bold text-muted-foreground">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                    Entrega estimada: {formatDateSafe(paymentInvoice.expectedDelivery)}. Si el pago queda parcial, se generará una alerta de seguimiento.
                  </p>
                )}
              </div>
              {!paymentInvoice.registerId && !paymentInvoice.sessionId && (
                <div className="space-y-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400">Control de Caja</p>
                    {cashSession && <span className="text-[10px] font-black text-emerald-600">Sesión abierta</span>}
                  </div>
                  {cashRegisters.length > 0 ? (
                    <Select value={cashRegisterId} onValueChange={setCashRegisterId} disabled={cashLoading || paymentLoading}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Selecciona la caja donde se recibió el pago" />
                      </SelectTrigger>
                      <SelectContent>
                        {cashRegisters.map((register) => (
                          <SelectItem key={register.id} value={register.id}>{register.name} ({register.code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-[10px] font-medium text-muted-foreground">No hay una caja abierta disponible. Apertura una sesión en Control de Caja para registrar este pago allí.</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">El efectivo afectará el esperado físico; tarjeta, transferencia y cheque quedarán visibles sin sumarse al efectivo.</p>
                </div>
              )}
              <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Formas de pago</p>
                  <span className="text-[10px] font-black text-primary">Mixto permitido</span>
                </div>
                {paymentLines.map((line, index) => (
                  <div key={`${index}-${line.method}`} className="rounded-xl border border-border/60 bg-background/70 p-3 space-y-2">
                    <div className="flex items-end gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Método</p>
                        <Select value={line.method} onValueChange={(nextMethod) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, method: nextMethod, bankAccountId: undefined, reference: '', cardCommissionPercent: nextMethod === 'CARD' ? item.cardCommissionPercent : 0, cardCommissionAmount: nextMethod === 'CARD' ? item.cardCommissionAmount : 0 } : item))}>
                          <SelectTrigger size="sm" className="h-9 w-full rounded-lg border-input bg-background px-2 text-xs font-bold uppercase"><SelectValue /></SelectTrigger>
                          <SelectContent>{paymentMethodOptions.map((method) => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <Button type="button" variant="ghost" size="icon" disabled={paymentLines.length === 1} onClick={() => setPaymentLines((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Eliminar forma de pago" className="size-9 shrink-0 text-muted-foreground hover:text-rose-500"><Trash2 className="size-4" /></Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(7rem,10rem)] sm:items-end">
                      <CurrencySelector
                        value={line.currency}
                        baseCurrency={baseCurrency}
                        exchangeRate={globalRate}
                        label=""
                        hideLabel
                        rateDecimals={2}
                        onChange={(nextCurrency) => setPaymentLines((current) => current.map((item, itemIndex) => {
                          if (itemIndex !== index) return item;
                          const previousRate = item.currency === baseCurrency ? 1 : Number(item.exchangeRate || globalRate);
                          const nextRate = paymentLineRate(nextCurrency);
                          return {
                            ...item,
                            amount: Number(convertBetweenCurrencies(item.amount, item.currency, nextCurrency, previousRate, nextRate).toFixed(2)),
                            currency: nextCurrency,
                            exchangeRate: nextRate,
                          };
                        }))}
                      />
                      <div>
                        <Input type="number" min="0.01" step="0.01" value={line.amount || ''} onChange={(event) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: Number(event.target.value) || 0, cardCommissionAmount: isCardPaymentMethod(item.method) ? calculateCardCommission(Number(event.target.value) || 0, Number(item.cardCommissionPercent || 0)) : item.cardCommissionAmount } : item))} autoFocus={index === 0} placeholder="Monto" className="h-9 text-xs tabular-nums" />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Tasa global aplicada: <span className="font-bold">{line.currency === baseCurrency ? '1.00' : Number(line.exchangeRate || globalRate || 1).toFixed(2)}</span> · moneda base</p>
                    {isBankPaymentMethod(line.method, true) && <BankAccountSelect className="mt-2" value={line.bankAccountId} onChange={(bankAccountId) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, bankAccountId } : item))} onAccountSelect={(account) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, cardCommissionPercent: account?.cardCommissionPercent || 0, cardCommissionAmount: isCardPaymentMethod(item.method) ? calculateCardCommission(Number(item.amount || 0), account?.cardCommissionPercent || 0) : 0, cardCommissionAccountId: account?.cardCommissionAccountId || undefined } : item))} label="Banco global de destino" />}
                    {isCardPaymentMethod(line.method) && line.bankAccountId && Number(line.cardCommissionPercent || 0) > 0 && (
                      <div className="mt-2 flex items-center gap-3 rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-[10px]">
                        <span className="font-black uppercase tracking-widest text-purple-600">Comisión:</span>
                        <span className="font-mono font-bold">{formatCommissionPercent(line.cardCommissionPercent)}</span>
                        <span className="text-muted-foreground">|</span>
                        <span className="font-black uppercase tracking-widest text-muted-foreground">Monto:</span>
                        <span className="font-mono font-bold text-purple-600">{line.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(Number(line.cardCommissionAmount || calculateCardCommission(Number(line.amount || 0), Number(line.cardCommissionPercent || 0))))}</span>
                      </div>
                    )}
                    {requiresPaymentReference(line.method) && <div className="mt-2">
                      <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Referencia *</p>
                      <Input value={line.reference || ''} onChange={(event) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, reference: event.target.value } : item))} placeholder="Transferencia, voucher, cheque..." className="h-9 text-xs" />
                    </div>}
                  </div>
                ))}
                <Button type="button" variant="outline" className="w-full border-dashed text-[10px] font-black uppercase tracking-widest" onClick={() => setPaymentLines((current) => [...current, paymentLine('CARD')])}>
                  <Plus className="mr-2 size-4" /> Agregar pago mixto
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha del pago *</p>
                  <Input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
                  <p className="mt-1 text-[10px] text-muted-foreground">Se usará también en Caja, Bancos y Libro Diario.</p>
                </div>
                <div className="rounded-xl border border-border/50 bg-background/60 p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total aplicado</p>
                  <p className="mt-1 text-lg font-black text-foreground">{baseCurrency === 'USD' ? '$' : 'C$'} {formatSalesAmount(paymentTotalBase)}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Cada línea conserva su moneda y tasa global.</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Equivale a {formatInvoiceAmount(paymentTotalInInvoiceCurrency, paymentInvoice.currency, paymentInvoice.exchangeRate)}</p>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Saldo que quedará como deuda</p>
                  <p className="mt-1 text-lg font-black text-primary">{formatInvoiceAmount(paymentRemainingInInvoiceCurrency, paymentInvoice.currency, paymentInvoice.exchangeRate)}</p>
                </div>
              </div>
              {paymentRemainingInInvoiceCurrency > 0.01 && (
                <div>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha del saldo pendiente *</p>
                  <Input type="date" value={paymentDueDate} onChange={(event) => setPaymentDueDate(event.target.value)} />
                  <p className="mt-1 text-[10px] text-muted-foreground">El sistema notificará un día antes del vencimiento.</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeInvoicePayment} disabled={paymentLoading}>Cancelar</Button>
            <Button onClick={() => void handleInvoicePayment()} disabled={paymentLoading || cashLoading || (!paymentInvoice?.registerId && !paymentInvoice?.sessionId && !cashSession) || paymentLines.some((line) => requiresPaymentReference(line.method) && !line.reference?.trim()) || paymentLines.some((line) => isBankPaymentMethod(line.method, true) && !line.bankAccountId)} className="bg-primary font-black">
              {paymentLoading ? 'Registrando...' : 'Confirmar pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
