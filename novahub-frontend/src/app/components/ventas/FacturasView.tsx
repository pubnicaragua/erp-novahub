import { useState, useEffect, useRef } from 'react';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import {
  FileText, Plus, Search, TrendingUp, CheckCircle2, AlertCircle, CreditCard, Eye, Trash2, Ban, ChevronLeft, Send
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
import type { Invoice, Customer, Product, PaymentReceived, SalesPaginationControls } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { BankAccountSelect } from '../ui/BankAccountSelect';
import { CurrencySelector } from '../ui/CurrencySelector';
import { Switch } from '../ui/switch';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { previewSalesTransactionPDF } from '../../utils/pdfGenerator';
import type { PdfDownloadFormat } from '../../utils/pdfDownloadFormats';
import { publicAccessService, publicLinkUrl } from '../../services/public-access.service';
import { InvoiceDetailSheet } from './InvoiceDetailSheet';
import { SalesLinePriceListSelect, PriceMissingBadge } from './SalesLinePriceListSelect';
import { formatSalesAmount, getMissingSalesPriceMessage, hasSalesProductPriceListConflict, hasSalesProductPriceListConflicts } from '../../utils/salesPriceList';
import { getSalesInvoiceOriginBadge } from '../../utils/document-origin-badges';
import { SalesDateRangeFilter } from './SalesDateRangeFilter';
import { SalesViewTutorial } from './SalesViewTutorial';
import { SalesKpiCard } from './SalesKpiCard';
import { resolveCustomerPhone, WhatsAppActionButton } from './WhatsAppActionButton';
import { PurchaseAlertsButton, type PurchaseAlertDetail } from '../compras/PurchaseAlertsButton';
import { cajaService, type CashRegister, type CashRegisterSession } from '../../services/caja.service';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { formatDateEs } from '../../utils/dateFormat';
import { SALES_STATUS_COLORS, SALES_WORKFLOW_STATUS_COLORS } from '../../utils/salesStatus';
import { getInvoicePaymentPresentation, hasPaymentReferenceField, isBankPaymentMethod, requiresPaymentReference, isCardPaymentMethod, calculateCardCommission, formatCommissionPercent, paymentMethodLabel } from '../../utils/paymentMethods';
import { getSalesAdditionalCharges } from '../../utils/salesCharges';
import { PdfDownloadButton } from '../ui/PdfDownloadButton';
import { clearSalesEditorDraft, getSalesEditorDraftKey, readSalesEditorDraft, writeSalesEditorDraft } from '../../services/sales-draft-storage';
import { SalesWarehouseStockHint } from './SalesWarehouseStockHint';
import { SalesVariantSelect } from './SalesVariantSelect';
import { getCustomerDebtAmount, getCustomerFavorAmount, getMaximumCustomerFavorToApply } from '../../utils/customerBalance';
import { summarizeAmountsByCurrency } from '../../utils/currency';
import { allocatePaymentLinesToBalance, cashCoversPaymentChange, getPaymentCashBase, getPaymentChangeBase } from '../../utils/paymentSettlement';

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
  { label: 'Borrador', value: 'DRAFT', color: SALES_WORKFLOW_STATUS_COLORS.DRAFT },
  { label: 'En proceso', value: 'PENDING', color: SALES_WORKFLOW_STATUS_COLORS.IN_PROCESS },
  { label: 'A crédito', value: 'CREDIT', color: SALES_STATUS_COLORS.CREDIT },
  { label: 'Pagada', value: 'PAID', color: SALES_STATUS_COLORS.PAID },
  { label: 'Anulada', value: 'CANCELLED', color: SALES_WORKFLOW_STATUS_COLORS.CANCELLED },
  { label: 'Vencida', value: 'OVERDUE', color: SALES_STATUS_COLORS.OVERDUE },
  { label: 'Parcial', value: 'PARTIAL', color: SALES_STATUS_COLORS.PARTIAL },
];

const paymentMethodOptions = [
  { label: 'Efectivo', value: 'CASH' },
  { label: 'Tarjeta', value: 'CARD' },
  { label: 'Transferencia', value: 'TRANSFER' },
  { label: 'Cheque', value: 'CHECK' },
  { label: 'Saldo a favor', value: 'CUSTOMER_BALANCE' },
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

type InvoiceSaveAction = 'SAVE' | 'DRAFT' | 'PENDING' | 'PAYMENT' | 'CREDIT';

export function FacturasView({ data, loading, onRefresh, customers = [], products = [], series = [], warehouses = [], employees = [], invoiceDraft, onClearInvoiceDraft, targetInvoiceId, onClearTargetInvoiceId, pagination, onSearchChange, dateFrom = '', dateTo = '', onDateRangeChange, salesAlert }: FacturasViewProps) {
  const {
    exchangeRate: globalRate,
    displayCurrency,
    baseCurrency,
    valuationMode,
    valuationModeLabel,
    valuationModeSuffix,
    displayMode,
    showValuationLegend,
    formatConvertedAmount,
    formatHistoricalAmount,
    formatCurrentAmount,
    convertAmount,
    convertCurrentAmount,
    convertBetweenCurrencies,
    formatExplicitAmount,
    toBaseAmount,
  } = useCurrency();
  const { user, canPerform } = useAuth();
  const { themeConfig } = useTheme();
  const salesDraftStorageKey = getSalesEditorDraftKey('invoice', user?.tenantId, user?.id);
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

  const getCatalogItemType = (product: any) => String(product?.itemType || product?.type || 'PRODUCT').toUpperCase();
  const productCatalog = products.filter((p) => getCatalogItemType(p) !== 'SERVICE');
  const serviceCatalog = products.filter((p) => getCatalogItemType(p) === 'SERVICE');
  const findProductForItem = (item: any) => products.find((product: any) => String(product.id) === String(item?.productId))
    || products.find((product: any) => product.code && String(product.code).trim().toUpperCase() === String(item?.code || item?.productCode || '').trim().toUpperCase())
    || products.find((product: any) => String(product.name || '').trim().toLowerCase() === String(item?.description || '').trim().toLowerCase());
  const resolveItemType = (item: any) => {
    const catalogType = getCatalogItemType(findProductForItem(item));
    return catalogType === 'SERVICE' ? 'SERVICE' : (item.itemType || 'PRODUCT');
  };
  const getItemCatalog = (item: any) => {
    const catalog = resolveItemType(item) === 'SERVICE' ? serviceCatalog : productCatalog;
    if (!item?.productId || catalog.some((product) => product.id === item.productId)) return catalog;
    const linkedProduct = products.find((product) => product.id === item.productId);
    return [...catalog, linkedProduct || { id: item.productId, code: '', name: item.description || 'Artículo vinculado', itemType: item.itemType || 'PRODUCT' }];
  };
  const getProductStockForWarehouse = (product: any, warehouseId?: string | null, variantId?: string | null) => {
    if (!product) return 0;
    const normalizedWarehouseId = String(warehouseId || '').trim();
    const normalizedVariantId = String(variantId || '').trim();
    const stockLevels = Array.isArray(product.stockLevels) ? product.stockLevels : [];
    const variantLevels = normalizedVariantId
      ? stockLevels.filter((level: any) => String(level?.variantId || '').trim() === normalizedVariantId)
      : stockLevels;
    if (!normalizedWarehouseId) {
      if (normalizedVariantId) return variantLevels.reduce((sum: number, level: any) => sum + Number(level?.quantity || level?.stock || 0), 0);
      return Number(product.stock || 0);
    }
    if (variantLevels.length === 0) return 0;
    return variantLevels
      .filter((level: any) => String(level?.warehouseId || '') === normalizedWarehouseId)
      .reduce((sum: number, level: any) => sum + Number(level?.quantity || 0), 0);
  };
  const getDefaultWarehouseId = () => {
    const activeWarehouses = warehouses.filter((warehouse: any) => warehouse?.isActive !== false);
    // La API devuelve la bodega más reciente primero. Preferimos una bodega
    // activa con inventario para que el stock mostrado coincida con la salida.
    return activeWarehouses.find((warehouse: any) => Number(warehouse?.stockCount || 0) > 0)?.id
      || activeWarehouses[0]?.id
      || warehouses[0]?.id
      || '';
  };
  const getItemWarehouseId = (item: any) => item?.warehouseId || localDoc?.warehouseId || getDefaultWarehouseId();
  const getItemStock = (item: any, product?: any) => getProductStockForWarehouse(product || findProductForItem(item), getItemWarehouseId(item), item?.variantId);
  const [localRates, setLocalRates] = useState({ dRate: 0, tRate: 15 });
  const [pricingMode, setPricingMode] = useState<'global' | 'individual'>('global');
  const [isCreating, setIsCreating] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [partialPaymentEnabled, setPartialPaymentEnabled] = useState(false);
  const [mixedPaymentEnabled, setMixedPaymentEnabled] = useState(false);
  const [paymentLines, setPaymentLines] = useState<InvoicePaymentLine[]>([]);
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentVoucher, setPaymentVoucher] = useState<{ payment: PaymentReceived; invoice: Invoice; remaining: number; change: number } | null>(null);
  const [cashRegisters, setCashRegisters] = useState<CashRegister[]>([]);
  const [cashRegisterId, setCashRegisterId] = useState('');
  const [cashSession, setCashSession] = useState<CashRegisterSession | null>(null);
  const [cashLoading, setCashLoading] = useState(false);
  const [creditInvoice, setCreditInvoice] = useState<Invoice | null>(null);
  const [creditDueDate, setCreditDueDate] = useState('');
  const [creditLoading, setCreditLoading] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const localDocRef = useRef<any>(null);
  const hydratedDraftKeyRef = useRef<string | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);

  const commitLocalDoc = (nextDoc: any) => {
    const normalizedDoc = nextDoc && Array.isArray(nextDoc.items)
      ? {
        ...nextDoc,
        items: nextDoc.items.map((item: any) => resolveItemType(item) === 'SERVICE'
          ? { ...item, itemType: 'SERVICE', taxRate: 0, priceListId: null, variantId: null, warehouseId: undefined }
          : item),
      }
      : nextDoc;
    localDocRef.current = normalizedDoc;
    setLocalDoc(normalizedDoc);
  };

  useEffect(() => {
    localDocRef.current = localDoc;
  }, [localDoc]);

  useEffect(() => {
    if (!salesDraftStorageKey || hydratedDraftKeyRef.current === salesDraftStorageKey) return;
    hydratedDraftKeyRef.current = salesDraftStorageKey;
    if (invoiceDraft) {
      const timer = window.setTimeout(() => setDraftHydrated(true), 0);
      return () => window.clearTimeout(timer);
    }
    const stored = readSalesEditorDraft<any>(salesDraftStorageKey);
    const timer = window.setTimeout(() => {
      if (stored) {
        if (stored.document) commitLocalDoc(stored.document);
        if (stored.editingId) setEditingId(stored.editingId);
        setIsCreating(Boolean(stored.isCreating));
        const rates = stored.metadata?.localRates;
        if (rates && typeof rates === 'object') setLocalRates(rates as { dRate: number; tRate: number });
        const storedPricingMode = stored.metadata?.pricingMode;
        if (storedPricingMode === 'global' || storedPricingMode === 'individual') setPricingMode(storedPricingMode);
      }
      setDraftHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [invoiceDraft, salesDraftStorageKey]);

  useEffect(() => {
    if (!draftHydrated || !salesDraftStorageKey || invoiceDraft) return;
    if (!localDoc || (!editingId && !isCreating)) {
      clearSalesEditorDraft(salesDraftStorageKey);
      return;
    }
    writeSalesEditorDraft(salesDraftStorageKey, {
      editingId,
      isCreating,
      document: localDoc,
      metadata: { localRates, pricingMode },
    });
  }, [draftHydrated, editingId, invoiceDraft, isCreating, localDoc, localRates, pricingMode, salesDraftStorageKey]);

  const paymentCurrency = paymentLines[0]?.currency || displayCurrency;
  const paymentLineRate = (currency: 'NIO' | 'USD') => currency === baseCurrency ? 1 : Number(globalRate || 1);
  const paymentLine = (method: string, amount = 0, currency: 'NIO' | 'USD' = displayCurrency): InvoicePaymentLine => ({
    method,
    amount,
    currency,
    exchangeRate: paymentLineRate(currency),
  });

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
    if (!invoice?.id) {
      toast.info('Guarda la factura como borrador para habilitar el envío por WhatsApp.');
      return;
    }
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
      Number(line.discount || 0) !== 0 || Number(line.taxRate || 0) !== 0,
    ) ? 'individual' : 'global'
  );

  type ExtraChargeLine = { id: string; description: string; amount: number };

  const normalizeExtraCharges = (doc: any): ExtraChargeLine[] => {
    if (Array.isArray(doc?.extraCharges)) {
      return doc.extraCharges.map((charge: any, index: number) => ({
        id: String(charge?.id || `extra-${index}`),
        description: String(charge?.description || ''),
        amount: Math.max(0, Number(charge?.amount || 0)),
      }));
    }
    const amount = Math.max(0, Number(doc?.extraCostAmount || 0));
    const description = String(doc?.extraCostDescription || '').trim();
    return amount > 0 || description
      ? [{ id: 'legacy-extra-0', description, amount }]
      : [];
  };

  const getExtraChargesPayload = (doc: any = localDoc) => normalizeExtraCharges(doc)
    .map(({ description, amount }) => ({ description: description.trim(), amount: Math.max(0, Number(amount || 0)) }))
    .filter((charge) => charge.amount > 0 || charge.description);

  const getExtraChargesAmount = (doc: any = localDoc) => getExtraChargesPayload(doc)
    .reduce((sum, charge) => sum + Number(charge.amount || 0), 0);

  const getLegacyExtraCostFields = (charges: Array<{ description: string; amount: number }>) => ({
    extraCostDescription: charges.length === 1
      ? charges[0].description || null
      : charges.length > 1 ? 'Varios costes extra' : null,
    extraCostAmount: charges.reduce((sum, charge) => sum + Number(charge.amount || 0), 0),
  });

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
    const draftWarehouseId = String(draftSnapshot.warehouseId || '').trim()
      || (!isExistingInvoice ? getDefaultWarehouseId() : '');
    const draftItems = (draftSnapshot.items || []).map((item: any) => ({
      ...item,
      warehouseId: item.warehouseId || draftWarehouseId || undefined,
    }));
    setLocalDoc({
      ...draftSnapshot,
      warehouseId: draftWarehouseId || draftSnapshot.warehouseId || null,
      items: draftItems,
      extraCharges: normalizeExtraCharges(draftSnapshot),
    });
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
    if (!draftHydrated) return;
    if (invoiceDraft) return;
    if (editingId) {
      const localSnapshot = localDocRef.current?.id === editingId ? localDocRef.current : null;
      if (localSnapshot) {
        setIsCreating(false);
      } else {
        const inv = data.find(x => x.id === editingId);
        if (inv) {
          setIsCreating(false);
          const invoiceSnapshot = JSON.parse(JSON.stringify(inv));
          commitLocalDoc({ ...invoiceSnapshot, extraCharges: normalizeExtraCharges(invoiceSnapshot) });
          setPricingMode(inferPricingMode(invoiceSnapshot));
          const sub = Number(inv.subtotal || 0);
          if (sub > 0) {
            const dRate = (Number(inv.discountAmount || 0) / sub) * 100;
            const base = sub - Number(inv.discountAmount || 0);
            const tRate = base > 0 ? (Number(inv.taxAmount || 0) / base) * 100 : 0;
            setLocalRates({ dRate: Math.round(dRate * 100) / 100, tRate: Math.round(tRate * 100) / 100 });
          }
        }
      }
    } else if (!isCreating) {
      localDocRef.current = null;
      commitLocalDoc(null);
    }
    // `data` se usa únicamente para inicializar al cambiar de factura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, draftHydrated, editingId, invoiceDraft, isCreating]);

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
    setPartialPaymentEnabled(false);
    setMixedPaymentEnabled(false);
    setPaymentDate(today);
    setPaymentDueDate(existingDueDate && existingDueDate >= today ? existingDueDate : today);
    setCashRegisterId('');
    setCashSession(null);
    setPaymentDialogOpen(true);
  };

  const getInvoiceBalanceInBase = (invoice: Invoice) => toBaseAmount(
    getInvoiceBalance(invoice),
    invoice.currency,
    Number(invoice.exchangeRate || 1),
  );

  const getInvoiceCreditAvailable = (invoice: Invoice) => {
    const apiAvailable = Number(invoice.creditAvailableBase);
    if (Number.isFinite(apiAvailable)) return Math.max(0, apiAvailable);

    // Compatibilidad con respuestas antiguas: el saldo firmado incluye la
    // factura actual, por lo que se excluye antes de calcular lo disponible.
    const customer = invoice.customer || customers.find((item) => item.id === invoice.customerId);
    const limitCurrency = customer?.creditLimitCurrency === 'USD' ? 'USD' : 'NIO';
    const limit = Math.max(0, toBaseAmount(
      Number(customer?.creditLimit || 0),
      limitCurrency,
      limitCurrency === baseCurrency ? 1 : Number(globalRate || 1),
    ));
    const currentDebt = getCustomerDebtAmount(customer);
    const debtWithoutInvoice = Math.max(0, currentDebt - getInvoiceBalanceInBase(invoice));
    return Math.max(0, Number((limit - debtWithoutInvoice).toFixed(2)));
  };

  const openInvoiceDetail = async (invoice: Invoice) => {
    setDetailInvoice(invoice);
    try {
      const fullInvoice = await invoicesService.getById(invoice.id);
      setDetailInvoice(fullInvoice);
    } catch (error) {
      // El resumen de la tabla sigue siendo suficiente para consultar la factura.
      console.warn('No se pudo cargar el historial completo de la factura.', error);
    }
  };

  const invoiceFitsAvailableCredit = (invoice: Invoice) =>
    getInvoiceCreditAvailable(invoice) + 0.01 >= getInvoiceBalanceInBase(invoice);

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
    if (!invoiceFitsAvailableCredit(actionInvoice)) {
      const available = getInvoiceCreditAvailable(actionInvoice);
      const required = getInvoiceBalanceInBase(actionInvoice);
      const currencyLabel = baseCurrency === 'USD' ? '$' : 'C$';
      toast.error(`El saldo pendiente (${currencyLabel} ${formatSalesAmount(required)}) supera el crédito disponible (${currencyLabel} ${formatSalesAmount(available)})`);
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

  const handleInvoicePayment = async () => {
    if (!paymentInvoice) return;
    const cashControlAlreadyLinked = Boolean(paymentInvoice.registerId || paymentInvoice.sessionId);
    const maxAmount = getInvoiceBalance(paymentInvoice);
    const getLineBaseAmount = (line: InvoicePaymentLine) => {
      const lineRate = line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate || 1);
      return toBaseAmount(Number(line.amount || 0), line.currency, lineRate);
    };
    const balanceBase = getInvoiceBalanceInBase(paymentInvoice);
    const changeBase = getPaymentChangeBase(paymentLines, balanceBase, getLineBaseAmount);
    if (changeBase > 0.01 && !cashCoversPaymentChange(paymentLines, balanceBase, getLineBaseAmount)) {
      toast.error('No se puede dar vuelto de una tarjeta, transferencia o banco. El excedente debe cubrirse con efectivo.');
      return;
    }
    const submittedPaymentLines = allocatePaymentLinesToBalance(
      paymentLines,
      balanceBase,
      getLineBaseAmount,
      (appliedBase, line) => {
        const lineRate = line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate || 1);
        return Number(convertBetweenCurrencies(appliedBase, baseCurrency, line.currency, 1, lineRate).toFixed(2));
      },
    );
    const amount = Number(submittedPaymentLines.reduce((sum, line) => sum + Number(line.amount || 0), 0).toFixed(2));
    if (!paymentDate || Number.isNaN(new Date(`${paymentDate}T12:00:00`).getTime())) {
      toast.error('Selecciona una fecha válida para registrar el pago');
      return;
    }
    const paymentBaseAmount = Number(submittedPaymentLines.reduce((sum, line) => sum + toBaseAmount(
      Number(line.amount || 0),
      line.currency,
      line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
    ), 0).toFixed(2));
    const paymentCustomer = paymentInvoice.customer || customers.find((customer) => customer.id === paymentInvoice.customerId);
    const customerFavorBase = getCustomerFavorAmount(paymentCustomer);
    const customerFavorAppliedBase = Number(submittedPaymentLines
      .filter((line) => line.method === 'CUSTOMER_BALANCE')
      .reduce((sum, line) => sum + toBaseAmount(
        Number(line.amount || 0),
        line.currency,
        line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
      ), 0).toFixed(2));
    if (customerFavorAppliedBase > customerFavorBase + 0.01) {
      toast.error(`El saldo a favor disponible es de ${formatConvertedAmount(customerFavorBase, baseCurrency)}.`);
      return;
    }
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
      toast.error('La referencia es obligatoria para tarjeta, transferencia y cheque');
      return;
    }
    if (paymentLines.some((line) => isBankPaymentMethod(line.method, true) && !line.bankAccountId)) {
      toast.error('Selecciona el banco global para cada tarjeta, transferencia o cheque');
      return;
    }
    const remaining = Math.max(0, Number((maxAmount - amountAppliedToInvoice).toFixed(2)));
    if (remaining > 0.01 && !paymentPartialActive) {
      toast.error('Marca "Pago parcial" para dejar un saldo pendiente');
      return;
    }
    if (remaining > 0.01 && !paymentDueDate) {
      toast.error('Selecciona la fecha en que se pagará el saldo restante');
      return;
    }
    const hasActiveCredit = (paymentInvoice.creditNotes || [])
      .some((credit) => ['ISSUED', 'PARTIAL', 'APPLIED'].includes(String(credit.status).toUpperCase()));
    const remainingBase = toBaseAmount(
      remaining,
      invoiceCurrency,
      Number(paymentInvoice.exchangeRate || 1),
    );
    const availableCreditBase = getInvoiceCreditAvailable(paymentInvoice);
    if (remaining > 0.01 && !hasActiveCredit && remainingBase > availableCreditBase + 0.01) {
      toast.error('El saldo restante supera el crédito disponible del cliente, considerando sus créditos y facturas pendientes');
      return;
    }
    const invoice = paymentInvoice;
    if (!invoice.id) {
      setPaymentDialogOpen(false);
      try {
        setPaymentLoading(true);
        await handleSaveInvoice('PAYMENT', {
          payments: submittedPaymentLines,
          currency: submittedPaymentLines[0]?.currency || paymentCurrency,
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
      const registeredPayment = await paymentsService.createMixed({
        customerId: invoice.customerId,
        invoiceId: activeCredit ? undefined : invoice.id,
        creditNoteId: activeCredit?.id,
        date: new Date(`${paymentDate}T12:00:00`).toISOString(),
        amount,
        currency: paymentCurrency,
        exchangeRate: paymentLineRate(paymentCurrency),
        method: submittedPaymentLines[0]?.method || 'CASH',
        payments: submittedPaymentLines,
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

      const creditForVoucher = activeCredit
        ? {
          ...activeCredit,
          invoiceId: invoice.id,
          amountPaid: Math.max(0, Number(activeCredit.total || 0) - remaining),
          balance: remaining,
          status: remaining > 0.01 ? 'PARTIAL' : 'PAID',
        }
        : registeredPayment?.creditNote;
      const paymentForVoucher = registeredPayment
        ? ({ ...registeredPayment, invoice: registeredPayment.invoice || invoice, creditNote: creditForVoucher, customer: registeredPayment.customer || invoice.customer, paymentLabel: creditForVoucher && remaining <= 0.01 ? 'Crédito cancelado' : remaining > 0.01 ? 'Pago parcial' : 'Pago completo' } as PaymentReceived)
        : null;
      toast.success(remaining > 0.01 ? `Pago parcial registrado. Saldo restante: ${formatInvoiceAmount(remaining, invoice.currency, invoice.exchangeRate)}` : `Factura ${invoice.number} pagada`, {
        id: payToastId,
      });
      if (paymentForVoucher) setPaymentVoucher({ payment: paymentForVoucher, invoice, remaining, change: paymentChangeInInvoiceCurrency });
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

  const startNewInvoice = () => {
    clearSalesEditorDraft(salesDraftStorageKey);
    localDocRef.current = null;
    setIsCreating(true);
    setEditingId(null);
    const newInvoiceDraft = {
      customerId: '',
      number: '',
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      currency: displayCurrency as any,
      exchangeRate: globalRate,
      warehouseId: getDefaultWarehouseId(),
      items: [],
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      extraCostDescription: null,
      extraCostAmount: 0,
      extraCharges: [],
      deliveryDescription: null,
      deliveryAmount: 0,
      total: 0,
      status: 'DRAFT',
      notes: '',
      sellerEmployeeId: '',
      commissionType: 'PERCENTAGE',
      commissionRate: 0,
      commissionAmount: 0,
    };
    commitLocalDoc(newInvoiceDraft);
    setLocalRates({ dRate: 0, tRate: 15 });
  };

  const handleSaveInvoice = async (
    action: InvoiceSaveAction = 'PENDING',
    settlement?: { payments?: InvoicePaymentLine[]; currency?: string; exchangeRate?: number; paymentDate?: string; dueDate?: string; cashRegisterId?: string; cashSessionId?: string },
  ) => {
    if (!localDoc) return;
    const isDraftAction = action === 'DRAFT';
    if (!isDraftAction && !localDoc.customerId) {
      toast.error('Selecciona un cliente');
      return;
    }
    if (!isDraftAction && (!localDoc.items || localDoc.items.length === 0)) {
      toast.error('Agrega al menos un producto');
      return;
    }
    if (!isDraftAction) {
      const priceMessage = getMissingSalesPriceMessage(localDoc.items);
      if (priceMessage) {
        toast.error(priceMessage);
        return;
      }
    }
    if (!isDraftAction && !localDoc.salesOrderId) {
      for (const item of localDoc.items || []) {
        if (resolveItemType(item) !== 'SERVICE') continue;
        const p = findProductForItem(item);
        if (p && p.isActive === false) {
          toast.error(`El servicio ${p.name || item.description || ''} no está disponible`);
          return;
        }
      }
    }
    const serialRows = isDraftAction ? [] : (localDoc.items || []).filter((item: any) => {
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
      action === 'DRAFT'
        ? 'Guardando factura como borrador...'
        : action === 'PAYMENT'
        ? 'Creando y registrando pago...'
        : action === 'CREDIT'
          ? 'Creando y enviando a crédito...'
          : 'Guardando factura en proceso...',
    );
    try {
      if (isCreating) {
        await invoicesService.create({
          customerId: localDoc.customerId || undefined,
          date: new Date(localDoc.date).toISOString(),
          dueDate: new Date(localDoc.dueDate).toISOString(),
          currency: localDoc.currency,
          exchangeRate: Number(localDoc.exchangeRate || globalRate),
          warehouseId: (localDoc as any).warehouseId || warehouses[0]?.id || undefined,
          priceListId: localDoc.priceListId || undefined,
          items: localDoc.items.map((item: any) => ({
            productId: item.productId || undefined,
            itemType: resolveItemType(item),
            variantId: resolveItemType(item) === 'SERVICE' ? undefined : item.variantId || undefined,
            warehouseId: resolveItemType(item) === 'SERVICE' ? undefined : item.warehouseId || undefined,
            description: item.description || '',
            commercialNoteSnapshot: item.commercialNoteSnapshot || findProductForItem(item)?.commercialNote || null,
            quantity: Number(item.quantity || 1),
            unitPrice: Number(item.unitPrice || 0),
            productCode: item.productCode || item.code || findProductForItem(item)?.code || undefined,
            taxRate: resolveItemType(item) === 'SERVICE' ? 0 : Number(item.taxRate || 0),
            discount: Number(item.discount || 0),
            priceListId: resolveItemType(item) === 'SERVICE' ? undefined : item.priceListId || localDoc.priceListId || undefined,
            total: Number(item.total || 0),
          })),
          subtotal: Number(localDoc.subtotal || 0),
          taxAmount: Number(localDoc.taxAmount || 0),
          discountAmount: Number(localDoc.discountAmount || 0),
          extraCostDescription: localDoc.extraCostDescription || null,
          extraCostAmount: Number(localDoc.extraCostAmount || 0),
          extraCharges: getExtraChargesPayload(localDoc),
          deliveryDescription: localDoc.deliveryDescription || null,
          deliveryAmount: Number(localDoc.deliveryAmount || 0),
          total: Number(localDoc.total || 0),
          pricingMode,
          status: action === 'DRAFT' ? 'DRAFT' : 'PENDING',
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
          action === 'DRAFT' ? 'Factura guardada como borrador'
            : action === 'PAYMENT' ? 'Factura creada y pago registrado'
            : action === 'CREDIT' ? 'Factura creada y enviada a Créditos'
              : 'Factura guardada en proceso',
          { id: saveToastId },
        );
      } else {
        const invoiceUpdates = { ...localDoc };
        delete invoiceUpdates.paymentMethod;
        delete invoiceUpdates.paymentDetails;
        delete invoiceUpdates.status;
        const updates: Partial<Invoice> = {
          ...invoiceUpdates,
          items: localDoc.items,
          notes: finalNotes,
        };
        if (action === 'DRAFT') updates.status = 'DRAFT';
        if (action === 'PENDING') updates.status = 'PENDING';
        await handleUpdate(localDoc.id, updates);
        toast.success(
          action === 'DRAFT' ? 'Factura guardada como borrador' : action === 'PENDING' ? 'Factura guardada en proceso' : 'Cambios guardados',
          { id: saveToastId },
        );
      }
      setIsCreating(false);
      setEditingId(null);
      clearSalesEditorDraft(salesDraftStorageKey);
      localDocRef.current = null;
      commitLocalDoc(null);
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
  const paymentInvoiceTotal = paymentInvoice ? Math.max(0, Number(paymentInvoice.total || 0)) : 0;
  const paymentInvoiceAlreadyPaid = paymentInvoice ? Math.max(0, Number(paymentInvoice.amountPaid || 0)) : 0;
  const paymentInvoiceCurrentBalance = paymentInvoice ? getInvoiceBalance(paymentInvoice) : 0;
  const paymentHasActiveCredit = Boolean(paymentInvoice?.creditNotes?.some((credit) => ['ISSUED', 'PARTIAL', 'APPLIED'].includes(String(credit.status).toUpperCase())));
  const paymentCreditAvailableBase = paymentInvoice ? getInvoiceCreditAvailable(paymentInvoice) : 0;
  const paymentRemainingBase = paymentInvoice
    ? toBaseAmount(paymentRemainingInInvoiceCurrency, paymentInvoice.currency, Number(paymentInvoice.exchangeRate || 1))
    : 0;
  const paymentCreditAfterBase = Math.max(0, Number((paymentCreditAvailableBase - paymentRemainingBase).toFixed(2)));
  const paymentPartialCreditFits = paymentHasActiveCredit || paymentRemainingBase <= paymentCreditAvailableBase + 0.01;
  const paymentPartialActive = partialPaymentEnabled && paymentPartialCreditFits;
  const paymentCustomer = paymentInvoice?.customer || (paymentInvoice?.customerId ? customers.find((customer) => customer.id === paymentInvoice.customerId) : undefined);
  const paymentCustomerFavorBase = getCustomerFavorAmount(paymentCustomer);
  const paymentCustomerFavorAppliedBase = Number(paymentLines
    .filter((line) => line.method === 'CUSTOMER_BALANCE')
    .reduce((sum, line) => sum + toBaseAmount(
      Number(line.amount || 0),
      line.currency,
      line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
    ), 0).toFixed(2));
  const paymentCustomerFavorExceeded = paymentCustomerFavorAppliedBase > paymentCustomerFavorBase + 0.01;
  const handlePaymentMethodChange = (index: number, nextMethod: string) => {
    setPaymentLines((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const nextLine = {
        ...item,
        method: nextMethod,
        bankAccountId: undefined,
        reference: '',
        cardCommissionPercent: nextMethod === 'CARD' ? item.cardCommissionPercent : 0,
        cardCommissionAmount: nextMethod === 'CARD' ? item.cardCommissionAmount : 0,
      };
      if (nextMethod !== 'CUSTOMER_BALANCE' || !paymentInvoice) return nextLine;
      const currentLineBase = toBaseAmount(
        Number(item.amount || 0),
        item.currency,
        item.currency === baseCurrency ? 1 : Number(item.exchangeRate || globalRate),
      );
      const otherPaymentsBase = paymentTotalBase - currentLineBase;
      const maximumBase = getMaximumCustomerFavorToApply(
        paymentCustomerFavorBase,
        getInvoiceBalanceInBase(paymentInvoice),
        otherPaymentsBase,
      );
      return { ...nextLine, amount: maximumBase, currency: baseCurrency, exchangeRate: 1 };
    }));
  };
  const paymentBalanceBase = paymentInvoice ? getInvoiceBalanceInBase(paymentInvoice) : 0;
  const paymentCashTotalBase = getPaymentCashBase(paymentLines, (line) => toBaseAmount(
    Number(line.amount || 0),
    line.currency,
    line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
  ));
  const paymentChangeBase = getPaymentChangeBase(paymentLines, paymentBalanceBase, (line) => toBaseAmount(
    Number(line.amount || 0),
    line.currency,
    line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate),
  ));
  const paymentChangeUnsupported = paymentChangeBase > 0.01 && paymentCashTotalBase + 0.01 < paymentChangeBase;
  const paymentChangeInInvoiceCurrency = paymentInvoice
    ? convertBetweenCurrencies(paymentChangeBase, baseCurrency, paymentInvoiceCurrency, 1, paymentInvoice.exchangeRate)
    : 0;
  const paymentHasRemaining = paymentRemainingInInvoiceCurrency > 0.01;
  const paymentHasChange = !paymentHasRemaining && paymentChangeBase > 0.01;
  const paymentSettlementLabel = paymentHasRemaining
    ? 'Pendiente'
    : paymentHasChange ? 'Vuelto por dar' : 'Saldo cubierto';
  const paymentSettlementAmount = paymentHasRemaining
    ? paymentRemainingInInvoiceCurrency
    : paymentChangeInInvoiceCurrency;

  const additionalChargesTotal = (doc: any = localDoc) => getExtraChargesAmount(doc) + Math.max(0, Number(doc?.deliveryAmount || 0));

  const updateExtraCharges = (charges: ExtraChargeLine[]) => {
    if (!localDoc) return;
    const payload = getExtraChargesPayload({ extraCharges: charges });
    const legacyFields = getLegacyExtraCostFields(payload);
    const nextDoc = { ...localDoc, extraCharges: charges, ...legacyFields };
    const baseTotal = Number(localDoc.total || 0) - additionalChargesTotal(localDoc);
    const total = baseTotal + additionalChargesTotal(nextDoc);
    setLocalDoc({ ...nextDoc, total });
    if (!isCreating) void handleUpdate(localDoc.id, { extraCharges: payload, ...legacyFields, total } as any);
  };

  const editExtraChargeDescription = (index: number, description: string) => {
    if (!localDoc) return;
    setLocalDoc({
      ...localDoc,
      extraCharges: normalizeExtraCharges(localDoc).map((item, itemIndex) => itemIndex === index ? { ...item, description } : item),
    });
  };

  const persistExtraCharges = () => {
    if (localDoc) updateExtraCharges(normalizeExtraCharges(localDoc));
  };

  const updateDelivery = (updates: Record<string, unknown>) => {
    if (!localDoc) return;
    const nextDoc = { ...localDoc, ...updates };
    const baseTotal = Number(localDoc.total || 0) - additionalChargesTotal(localDoc);
    const total = baseTotal + additionalChargesTotal(nextDoc);
    setLocalDoc({ ...nextDoc, total });
    if (!isCreating) void handleUpdate(localDoc.id, { ...updates, total } as any);
  };

  const recalcTotals = (items: any[], dRate: number, tRate: number) => {
    if (pricingMode === 'individual') return recalcIndividualTotals(items);
    const subtotal = items.reduce((acc: number, it: any) => acc + Number(it.quantity || 0) * Number(it.unitPrice || 0), 0);
    const discountAmount = subtotal * (dRate / 100);
    const productSubtotal = items.filter((it: any) => resolveItemType(it) !== 'SERVICE')
      .reduce((acc: number, it: any) => acc + Number(it.quantity || 0) * Number(it.unitPrice || 0), 0);
    const taxAmount = Math.max(0, productSubtotal - productSubtotal * (dRate / 100)) * (tRate / 100);
    const total = base + taxAmount + additionalChargesTotal();
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
      const tax = resolveItemType(line) === 'SERVICE' ? 0 : taxable * (Number(line.taxRate || 0) / 100);
      return { ...line, total: taxable + tax };
    });
    const subtotal = pricedItems.reduce((sum: number, line: any) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);
    const discountAmount = pricedItems.reduce((sum: number, line: any) => sum + (Number(line.quantity || 0) * Number(line.unitPrice || 0) * Number(line.discount || 0) / 100), 0);
    const taxAmount = pricedItems.reduce((sum: number, line: any) => {
      const gross = Number(line.quantity || 0) * Number(line.unitPrice || 0);
      return sum + (resolveItemType(line) === 'SERVICE' ? 0 : (gross - gross * Number(line.discount || 0) / 100) * Number(line.taxRate || 0) / 100);
    }, 0);
    return { items: pricedItems, subtotal, discountAmount, taxAmount, total: subtotal - discountAmount + taxAmount + additionalChargesTotal() };
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

  const getPaymentAppliedAmountInInvoiceCurrency = (payment: PaymentReceived, invoice: Invoice) => {
    const sourceCurrency = (payment.currency || invoice.currency || baseCurrency) as 'NIO' | 'USD';
    const targetCurrency = (invoice.currency || baseCurrency) as 'NIO' | 'USD';
    const sourceRate = Number(payment.exchangeRate || (sourceCurrency === baseCurrency ? 1 : globalRate) || 1);
    const targetRate = Number(invoice.exchangeRate || (targetCurrency === baseCurrency ? 1 : globalRate) || 1);
    return convertBetweenCurrencies(
      Number(payment.amount || 0),
      sourceCurrency,
      targetCurrency,
      sourceRate,
      targetRate,
    );
  };

  const getHistoricalPaymentRemaining = (payment: PaymentReceived, invoice: Invoice) => {
    const payments = [...(invoice.payments || [])].sort((left, right) => {
      const dateDifference = new Date(left.date || left.createdAt).getTime() - new Date(right.date || right.createdAt).getTime();
      if (dateDifference !== 0) return dateDifference;
      return String(left.createdAt || '').localeCompare(String(right.createdAt || ''));
    });
    const paymentIndex = payments.findIndex((candidate) => candidate.id === payment.id);
    if (paymentIndex < 0) return getInvoiceBalance(invoice);
    const cumulativePaid = payments
      .slice(0, paymentIndex + 1)
      .reduce((sum, candidate) => sum + getPaymentAppliedAmountInInvoiceCurrency(candidate, invoice), 0);
    return Math.max(0, Number((Number(invoice.total || 0) - cumulativePaid).toFixed(2)));
  };

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
        tenantName: user?.sessionBranding?.name || user?.tenantName || 'Empresa',
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

  const handleDownloadPaymentVoucher = async (payment: PaymentReceived, invoice: Invoice, format: PdfDownloadFormat = 'configured', remainingOverride?: number) => {
    const paymentRows = payment.payments?.length ? payment.payments : [payment];
    const documentReference = invoice.number || payment.invoice?.number || 'Factura';
    const sameCurrency = paymentRows.every((row) => String(row.currency || '').toUpperCase() === String(paymentRows[0]?.currency || '').toUpperCase());
    const voucherCurrency = sameCurrency ? (paymentRows[0]?.currency || invoice.currency) : baseCurrency;
    const voucherRate = sameCurrency ? Number(paymentRows[0]?.exchangeRate || 1) : 1;
    const total = sameCurrency
      ? paymentRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
      : paymentRows.reduce((sum, row) => sum + Number(row.baseAmount ?? toBaseAmount(Number(row.amount || 0), row.currency, row.exchangeRate)), 0);
    const remaining = Math.max(0, Number(remainingOverride ?? getInvoiceBalance(invoice) ?? 0));
    const creditSource = payment.creditNote || invoice.creditNotes?.find((credit) => credit.id === payment.creditNoteId);
    const creditForVoucher = payment.creditNoteId && creditSource
      ? {
        ...creditSource,
        invoiceId: invoice.id,
        amountPaid: Math.max(0, Number(creditSource.total || 0) - remaining),
        balance: remaining,
        status: remaining > 0.01 ? 'PARTIAL' : 'PAID',
      }
      : payment.creditNote;
    const voucher = {
      ...payment,
      invoice,
      creditNote: creditForVoucher,
      customer: payment.customer || invoice.customer,
      number: payment.number || `PAGO-${documentReference}`,
      currency: voucherCurrency,
      exchangeRate: voucherRate,
      remaining,
      balance: remaining,
      paymentLabel: remainingOverride !== undefined
        ? (creditForVoucher && remaining <= 0.01 ? 'Crédito cancelado' : remaining > 0.01 ? 'Pago parcial' : 'Pago completo')
        : payment.paymentLabel || (creditForVoucher && remaining <= 0.01 ? 'Crédito cancelado' : remaining > 0.01 ? 'Pago parcial' : 'Pago completo'),
      total,
      items: paymentRows.map((row) => ({
        description: `Pago ${String(row.method || payment.method || '').toUpperCase()}${row.reference ? ` · Ref. ${row.reference}` : ''}`,
        quantity: 1,
        unitPrice: Number(row.amount || 0),
        total: Number(row.amount || 0),
      })),
      notes: `${payment.notes || ''}${payment.notes ? '\n' : ''}Factura aplicada: ${documentReference}`,
    };
    const previewToastId = toast.loading('Preparando el voucher del pago...');
    try {
      await previewSalesTransactionPDF({
        document: voucher,
        tenantName: user?.sessionBranding?.name || user?.tenantName || 'Empresa',
        formatAmount: formatConvertedAmount as any,
        tenantLogo: themeConfig?.logo,
        documentType: 'payment',
        format,
      });
      toast.success('Voucher listo para descargar desde el visor del navegador.', { id: previewToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo preparar el voucher del pago', { id: previewToastId });
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
      header: 'N° Factura',
      width: '140px',
      render: (val, row) => {
        const source = getSalesInvoiceOriginBadge(row);
        return (
          <div className="flex min-w-0 flex-col items-start gap-1">
            <span className="text-xs font-black font-mono text-primary cursor-pointer hover:underline" onClick={(event) => { event.stopPropagation(); void openInvoiceDetail(row); }}>{val}</span>
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
          (row.status || '').toUpperCase() === 'OVERDUE' ? 'text-orange-500' : 'text-muted-foreground'
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
        const presentation = getInvoicePaymentPresentation({ ...row, paymentMethod: val || row.paymentMethod });
        if (!presentation.method && !presentation.isCredit) return <span className="text-[11px] font-medium text-muted-foreground">—</span>;
        return (
          <div className="flex flex-col items-start gap-0.5">
            <Badge className={cn('border-none px-2 py-0.5 text-[8px] font-black uppercase tracking-widest', presentation.isCredit ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400')}>
              {presentation.modalityLabel}
            </Badge>
            {presentation.methodLabel && <span className="text-[9px] font-bold uppercase text-muted-foreground/70">{presentation.methodLabel}</span>}
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
  const originalBilled = summarizeAmountsByCurrency(data, (invoice) => Number(invoice.total ?? invoice.baseTotal ?? 0), (invoice) => invoice.currency, baseCurrency);
  const originalReceivable = summarizeAmountsByCurrency(
    data.filter(invoice => ['PENDING', 'OVERDUE', 'PARTIAL', 'CREDIT'].includes((invoice.status || '').toUpperCase())),
    getInvoiceBalance,
    (invoice) => invoice.currency,
    baseCurrency,
  );
  const originalPaid = summarizeAmountsByCurrency(data, (invoice) => Number(invoice.amountPaid || 0), (invoice) => invoice.currency, baseCurrency);

  // ─── INLINE EDITOR VIEW ────────────────────────────────────────────────
  if ((editingId || isCreating) && localDoc && !paymentDialogOpen && !creditInvoice) {
    const isInvoiceLocked = !isCreating && ['PAID', 'CANCELLED'].includes(String(localDoc?.status || '').toUpperCase());
    const isDraftInvoice = isCreating || String(localDoc?.status || '').toUpperCase() === 'DRAFT';
    return (
      <div className="sales-document-editor min-w-0 space-y-6 animate-in slide-in-from-right duration-300" data-tour="sales-form-title">
        <div className="sales-document-header flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => { clearSalesEditorDraft(salesDraftStorageKey); localDocRef.current = null; setEditingId(null); setIsCreating(false); commitLocalDoc(null); onClearInvoiceDraft?.(); }} className="shrink-0 rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black uppercase tracking-tight">{isCreating ? 'Nueva Factura' : `Factura ${localDoc?.number}`}</h2>
                {!isCreating && (() => {
                  const source = getSalesInvoiceOriginBadge(localDoc);
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
          <div className="flex min-w-0 flex-wrap items-stretch justify-start gap-2 sm:justify-end" data-tour="sales-form-actions">
            <SalesViewTutorial view="invoices" context="form" />
            {localDoc?.customerId && getCustomerPhone(localDoc) && (
            <Button
                variant="outline"
                title={isCreating ? 'Guarda la factura como borrador para enviarla por WhatsApp' : 'Enviar factura por WhatsApp'}
                onClick={() => void handleWhatsApp()}
                className="w-full rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-400/30 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300 gap-2 font-black uppercase text-[10px] tracking-widest px-4 sm:w-auto"
              >
                <WhatsAppIcon fontSize="inherit" className="size-4" style={{ width: '1rem', height: '1rem', fontSize: '1rem' }} aria-hidden="true" /> WhatsApp
              </Button>
            )}
            {!isInvoiceLocked && ((isCreating && canPerform('SALES_INVOICES', 'create')) || (!isCreating && canPerform('SALES_INVOICES', 'edit'))) && (
              <>
                {isDraftInvoice && (
                  <Button
                    variant="outline"
                    className="w-full rounded-xl border-border/50 hover:bg-muted/70 hover:text-foreground font-black uppercase text-[10px] tracking-widest px-4 sm:w-auto"
                    onClick={() => void handleSaveInvoice('DRAFT')}
                  >
                    Guardar Borrador
                  </Button>
                )}
                <Button
                  variant="default"
                  className="w-full rounded-xl bg-primary px-4 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-xl shadow-primary/20 hover:bg-primary/90 hover:text-primary-foreground sm:w-auto"
                  onClick={() => void handleSaveInvoice(isDraftInvoice ? 'PENDING' : 'SAVE')}
                >
                  Guardar
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="rounded-2xl border-border/50" data-tour="sales-form-data">
            <CardContent className="min-w-0 space-y-3 p-4 sm:p-6">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
              <div className="grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-2">
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
                        ? resolveItemType(item) === 'SERVICE'
                          ? { ...item, itemType: 'SERVICE', priceListId: null, priceMissing: false }
                          : { ...item, priceListId, unitPrice: 0, total: 0, priceMissing: false }
                        : { ...item, priceListId });
                      if (hasSalesProductPriceListConflicts(items, priceListId)) {
                        toast.error('No se puede aplicar esta lista: hay productos repetidos con la misma lista de precios.');
                        return;
                      }
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
                  <p className="text-[10px] text-muted-foreground mb-1">Bodega de salida</p>
                  <Select
                    value={localDoc?.warehouseId || ''}
                    onValueChange={(warehouseId) => {
                      const items = (localDoc.items || []).map((item: any) => ({
                        ...item,
                        warehouseId,
                        serialNumbers: [],
                      }));
                      const nextDoc = { ...localDoc, warehouseId, items };
                      setLocalDoc(nextDoc);
                      if (!isCreating) void handleUpdate(localDoc!.id, { warehouseId, items } as any);
                    }}
                    disabled={isInvoiceLocked || warehouses.length === 0}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar bodega" /></SelectTrigger>
                    <SelectContent>
                      {warehouses
                        .filter((warehouse: any) => warehouse?.isActive !== false || warehouse.id === localDoc?.warehouseId)
                        .map((warehouse: any) => <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[10px] text-muted-foreground/70">El stock y la salida se validan en esta bodega.</p>
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
                  <div className="flex min-w-[9rem] items-center justify-end gap-2"><span className="w-8 shrink-0 text-right text-xs font-black">{localDoc?.currency === 'USD' ? '$' : 'C$'}</span><Input type="text" value={formatSalesAmount(localDoc?.subtotal)} readOnly className="h-8 w-24 max-w-full text-right font-bold tabular-nums bg-muted/20" /></div></div>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">Descuento</span>
                  <div className="flex min-w-[9rem] flex-wrap items-center justify-end gap-2 text-rose-500">
                    <div className="flex items-center mr-2">{pricingMode === 'global' ? <Input type="number" min="0" max="100" value={localRates.dRate || ''} placeholder="0" onChange={(e) => {
                      const newRate = Number(e.target.value); setLocalRates(p => ({ ...p, dRate: newRate }));
                      const calc = recalcTotals(localDoc?.items || [], newRate, localRates.tRate);
                      setLocalDoc({ ...localDoc, ...calc });
                     }} className="w-16 h-8 text-right font-bold text-rose-500 bg-transparent" disabled={isInvoiceLocked} /> : null} {pricingMode === 'global' && <span className="ml-1 text-xs font-black">%</span>}</div>
                    <span className="min-w-[7.5rem] text-right tabular-nums">-{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(localDoc?.discountAmount)}</span>
                  </div></div>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">IVA de productos</span>
                  <div className="flex min-w-[9rem] flex-wrap items-center justify-end gap-2">
                    {pricingMode === 'global' && <label className="flex h-8 items-center gap-1.5 rounded-md bg-muted/30 px-2 text-xs font-black">
                      <input type="checkbox" checked={Number(localRates.tRate || 0) > 0} onChange={(e) => {
                        const newRate = e.target.checked ? 15 : 0;
                        const calc = recalcTotals(localDoc?.items || [], localRates.dRate, newRate);
                        setLocalRates(p => ({ ...p, tRate: newRate }));
                        setLocalDoc({ ...localDoc, ...calc });
                       }} disabled={isInvoiceLocked} /> Aplicar
                    </label>}
                    <span className="min-w-[7.5rem] text-right text-xs font-black tabular-nums">{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(localDoc?.taxAmount)}</span>
                  </div></div>
                {getExtraChargesPayload(localDoc).map((charge, index) => <div key={`summary-extra-${index}`} className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">{charge.description || 'Coste extra'}</span><span className="min-w-[7.5rem] text-right font-mono tabular-nums">{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(charge.amount)}</span></div>)}
                {Number(localDoc?.deliveryAmount || 0) > 0 && <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">{localDoc?.deliveryDescription || 'Delivery'}</span><span className="min-w-[7.5rem] text-right font-mono tabular-nums">{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(localDoc?.deliveryAmount)}</span></div>}
                <div className="flex justify-between items-center text-base border-t pt-3 border-border/50">
                  <span className="font-black">Total</span>
                  <div className="flex flex-col items-end">
                    <span className="flex min-w-[9rem] items-center justify-end gap-2 text-primary font-black text-lg"><span className="w-8 shrink-0 text-right text-xs">{localDoc?.currency === 'USD' ? '$' : 'C$'}</span><span className="min-w-[7.5rem] text-right tabular-nums">{formatSalesAmount(localDoc?.total)}</span></span>
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
            <div className="flex min-w-0 flex-col items-stretch justify-between gap-3 mb-4 sm:flex-row sm:items-center">
               <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Productos / Servicios</p>
               <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                 {(['PRODUCT', 'SERVICE'] as const).map((itemType) => <Button key={itemType} type="button" variant="outline" size="sm" disabled={isInvoiceLocked} onClick={() => {
                   const newItems = [...(localDoc.items || []), { id: Date.now().toString(), itemType, description: '', quantity: 1, unitPrice: 0, total: 0, productId: null, warehouseId: itemType === 'SERVICE' ? undefined : localDoc?.warehouseId || getDefaultWarehouseId(), taxRate: itemType === 'SERVICE' ? 0 : 0, priceListId: itemType === 'SERVICE' ? null : localDoc?.priceListId || undefined, serialNumbers: [] }];
                   setLocalDoc({ ...localDoc, items: newItems });
                 }} className="h-8 w-full rounded-xl text-[10px] font-black uppercase tracking-widest sm:w-auto"><Plus className="size-3 mr-2" /> Agregar {itemType === 'PRODUCT' ? 'Producto' : 'Servicio'}</Button>)}
                 <Button type="button" variant="outline" size="sm" disabled={isInvoiceLocked} onClick={() => updateExtraCharges([...normalizeExtraCharges(localDoc), { id: `extra-${Date.now()}`, description: '', amount: 0 }])} className="h-8 w-full rounded-xl text-[10px] font-black uppercase tracking-widest sm:w-auto">
                   <Plus className="size-3 mr-2" /> Agregar coste extra
                 </Button>
                 <Button type="button" variant="outline" size="sm" disabled={isInvoiceLocked || Boolean(localDoc?.deliveryDescription) || Number(localDoc?.deliveryAmount || 0) > 0} title={localDoc?.deliveryDescription || Number(localDoc?.deliveryAmount || 0) > 0 ? 'Solo se permite un delivery por factura' : undefined} onClick={() => updateDelivery({ deliveryDescription: 'Delivery', deliveryAmount: 0 })} className="h-8 w-full rounded-xl text-[10px] font-black uppercase tracking-widest sm:w-auto">
                   <Plus className="size-3 mr-2" /> Agregar delivery
                 </Button>
               </div>
            </div>
            <div className="space-y-2">
              <div className="hidden xl:grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                <div className={cn("sales-line-product-header xl:col-span-6", pricingMode === 'individual' && "xl:col-span-5")}>
                  <span>Descripción</span>
                  <span>Variante</span>
                  <span>Tipo de precio</span>
                </div>
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
                <div key={item.id || idx} data-item-layout="standard" data-pricing-mode={pricingMode} className="sales-item-row grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-border/50 bg-muted/5 p-3 items-start xl:grid-cols-12 xl:gap-2 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0">
                  <div data-item-role="product-area" className={cn("min-w-0 xl:col-span-6", pricingMode === 'individual' && "xl:col-span-5")}>
                    <div className="sales-line-product-fields">
                      <div data-item-role="product-picker" className="sales-line-product-picker min-w-0">
                        <Combobox
                          options={getItemCatalog(item).map(p => ({ label: `${String(p.itemType || resolveItemType(item)).toUpperCase() === 'SERVICE' ? 'Servicio' : 'Producto'} · ${p.code || ''} - ${p.name}`, value: p.id, description: p.commercialNote ? `Nota: ${p.commercialNote}` : undefined }))}
                          value={item.productId || ''}
                          onChange={(val) => {
                        const newItems = [...(localDoc.items || [])];
                        const selectedProd = (resolveItemType(item) === 'SERVICE' ? serviceCatalog : productCatalog).find(p => String(p.id) === String(val));
                        const selectedItemType = selectedProd ? getCatalogItemType(selectedProd) : resolveItemType(item);
                        const effectivePriceListId = newItems[idx].priceListId || localDoc.priceListId || getCustomerPriceListId(localDoc.customerId);
                        if (selectedItemType !== 'SERVICE' && val && hasSalesProductPriceListConflict(newItems, val, effectivePriceListId, idx, localDoc.priceListId || getCustomerPriceListId(localDoc.customerId))) {
                          toast.error('Este producto ya está agregado con la misma lista de precios.');
                          return;
                        }
                        newItems[idx] = {
                          ...newItems[idx],
                          productId: val,
                          variantId: null,
                          variantSku: null,
                          variantName: null,
                          variantAttributes: null,
                          productCode: selectedProd?.code || newItems[idx].productCode,
                          itemType: selectedItemType,
                          priceListId: selectedItemType === 'SERVICE'
                            ? null
                            : (newItems[idx].priceListId || localDoc.priceListId || getCustomerPriceListId(localDoc.customerId)),
                          warehouseId: selectedItemType === 'SERVICE' ? undefined : newItems[idx].warehouseId || localDoc?.warehouseId || getDefaultWarehouseId(),
                          taxRate: selectedItemType === 'SERVICE' ? 0 : Number(newItems[idx].taxRate || 0),
                          serialNumbers: [],
                        };
                        if (selectedProd) {
                          newItems[idx].description = selectedProd.name;
                          newItems[idx].commercialNoteSnapshot = selectedProd.commercialNote || null;
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
                      <SalesVariantSelect
                        className="sales-line-variant"
                        product={findProductForItem(item)}
                        value={item.variantId}
                        disabled={isInvoiceLocked}
                        onChange={(variantId, variant) => {
                          const nextItems = [...(localDoc.items || [])] as any[];
                          nextItems[idx] = {
                            ...nextItems[idx],
                            variantId,
                            variantSku: variant?.sku || null,
                            variantName: variant?.name || null,
                            variantAttributes: variant?.attributes || null,
                          };
                          setLocalDoc({ ...localDoc, items: nextItems });
                          if (!isCreating) void handleUpdate(localDoc!.id, { items: nextItems } as any);
                        }}
                      />
                      <SalesLinePriceListSelect
                        className="sales-line-price-list"
                        labelLayout="stacked"
                        productId={findProductForItem(item)?.id || item.productId}
                        variantId={item.variantId}
                        productCode={findProductForItem(item)?.code || (item as any).productCode || (item as any).code}
                        productName={item.description}
                        itemType={item.itemType}
                        value={item.priceListId}
                        defaultPriceListId={localDoc?.priceListId || getCustomerPriceListId(localDoc?.customerId)}
                        lineItems={localDoc?.items || []}
                        lineIndex={idx}
                        fallbackPrice={Number(findProductForItem(item)?.salePrice || 0)}
                        currency={localDoc?.currency}
                        exchangeRate={Number(localDoc?.exchangeRate || globalRate || 1)}
                        disabled={isInvoiceLocked}
                        onChange={(priceListId, result, source) => {
                          const nextItems = [...(localDoc.items || [])] as any[];
                          const matchedProduct = findProductForItem(nextItems[idx]);
                          nextItems[idx] = {
                            ...nextItems[idx],
                            productId: matchedProduct?.id || nextItems[idx].productId,
                            productCode: matchedProduct?.code || nextItems[idx].productCode || nextItems[idx].code,
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
                              </>
                            );
                          }
                          const warehouseId = getItemWarehouseId(item);
                          const stock = getProductStockForWarehouse(p, warehouseId);
                          return (
                            <>
                              <Badge variant="outline" className={cn(
                                "text-[9px] font-black border-none px-1.5 py-0 h-4 bg-muted/20",
                                stock <= 0 ? "text-rose-500 bg-rose-500/10" : "text-emerald-500 bg-emerald-500/10"
                              )}>
                                STOCK EN BODEGA: {stock}
                              </Badge>
                              <SalesWarehouseStockHint
                                product={p}
                                warehouses={warehouses}
                                warehouseId={warehouseId}
                                variantId={item.variantId}
                                className="basis-full"
                              />
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
                      {resolveItemType(item) === 'SERVICE' ? <span className="flex h-8 items-center rounded-md bg-muted/30 px-2 text-xs font-bold text-muted-foreground">Exento</span> : <label className="relative flex min-w-0 flex-1 items-center font-black uppercase tracking-wider">
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
                      </label>}
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
                    <Input type="number" min="0" max={resolveItemType(item) === 'SERVICE' ? 1000000 : Math.max(0, getItemStock(item))} value={Number(item.quantity) || ''} placeholder="0"
                      onChange={(e) => {
                        let newQty = Number(e.target.value);
                        const p = findProductForItem(item);
                        const availableStock = getItemStock(item, p);
                        if (p && resolveItemType(item) !== 'SERVICE' && newQty > availableStock) {
                          toast.warning(`Stock insuficiente en la bodega seleccionada. Disponible: ${availableStock}`, { id: `stock-warn-${idx}` });
                          newQty = availableStock;
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
                    <Input type="number" inputMode="decimal" min="0" step="any" value={item.unitPrice === undefined || item.unitPrice === null ? '' : item.unitPrice} placeholder="0"
                      readOnly={Boolean(item.productId)}
                      title={item.productId ? 'Precio definido por la lista de precios' : 'Precio personalizado'}
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
                  <div data-item-role="total-actions" className="flex min-w-0 items-center justify-end gap-2 text-right xl:col-span-2">
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
            {(normalizeExtraCharges(localDoc).length > 0 || localDoc.deliveryDescription || Number(localDoc.deliveryAmount || 0) > 0) && (
              <div className="mt-5 space-y-2 rounded-xl border border-border/50 bg-muted/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cargos adicionales</p>
                    <p className="text-[9px] text-muted-foreground/70">Se suman al total en la moneda de la factura.</p>
                  </div>
                  <span className="text-[10px] font-black text-muted-foreground">{localDoc.currency === 'USD' ? 'Dólares (US$)' : 'Córdobas (C$)'}</span>
                </div>
                {normalizeExtraCharges(localDoc).map((charge, index) => (
                  <div key={charge.id} data-item-layout="extra-charge" className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-border/40 bg-background/60 p-2">
                    <span className="w-full text-[9px] font-black uppercase tracking-widest text-muted-foreground sm:w-auto">Coste extra {index + 1}</span>
                    <Input value={charge.description} onChange={(event) => editExtraChargeDescription(index, event.target.value)} onBlur={persistExtraCharges} placeholder="Descripción" className="h-8 w-full min-w-0 text-xs sm:flex-1" disabled={isInvoiceLocked} />
                    <div className="flex w-full min-w-0 items-center gap-1 rounded-md border border-input bg-background px-2 sm:w-auto sm:min-w-[8.5rem]">
                      <span className="text-[10px] font-black text-muted-foreground">{localDoc.currency === 'USD' ? '$' : 'C$'}</span>
                      <Input type="number" min="0" step="0.01" value={charge.amount || ''} onChange={(event) => updateExtraCharges(normalizeExtraCharges(localDoc).map((item, itemIndex) => itemIndex === index ? { ...item, amount: Math.max(0, Number(event.target.value) || 0) } : item))} placeholder="Monto" className="h-8 border-0 px-0 text-right text-xs shadow-none focus-visible:ring-0" disabled={isInvoiceLocked} />
                    </div>
                    {!isInvoiceLocked && <Button type="button" variant="ghost" size="icon" aria-label={`Eliminar coste extra ${index + 1}`} className="size-7 shrink-0 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500" onClick={() => updateExtraCharges(normalizeExtraCharges(localDoc).filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="size-3.5" /></Button>}
                  </div>
                ))}
                {(localDoc.deliveryDescription || Number(localDoc.deliveryAmount || 0) > 0) && (
                  <div data-item-layout="delivery" className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-border/40 bg-background/60 p-2">
                    <span className="w-full text-[9px] font-black uppercase tracking-widest text-muted-foreground sm:w-auto">Delivery</span>
                    <Input value={localDoc.deliveryDescription || ''} onChange={(event) => setLocalDoc({ ...localDoc, deliveryDescription: event.target.value })} onBlur={() => !isCreating && void handleUpdate(localDoc.id, { deliveryDescription: localDoc.deliveryDescription || null } as any)} placeholder="Descripción" className="h-8 w-full min-w-0 text-xs sm:flex-1" disabled={isInvoiceLocked} />
                    <div className="flex w-full min-w-0 items-center gap-1 rounded-md border border-input bg-background px-2 sm:w-auto sm:min-w-[8.5rem]">
                      <span className="text-[10px] font-black text-muted-foreground">{localDoc.currency === 'USD' ? '$' : 'C$'}</span>
                      <Input type="number" min="0" step="0.01" value={localDoc.deliveryAmount || ''} onChange={(event) => updateDelivery({ deliveryAmount: Math.max(0, Number(event.target.value) || 0) })} placeholder="Monto" className="h-8 border-0 px-0 text-right text-xs shadow-none focus-visible:ring-0" disabled={isInvoiceLocked} />
                    </div>
                    {!isInvoiceLocked && <Button type="button" variant="ghost" size="icon" aria-label="Eliminar delivery" className="size-7 shrink-0 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500" onClick={() => updateDelivery({ deliveryDescription: null, deliveryAmount: 0 })}><Trash2 className="size-3.5" /></Button>}
                  </div>
                )}
              </div>
            )}
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-tour="sales-list-kpis">
        {displayMode === 'ORIGINAL'
          ? originalBilled.map((summary) => <SalesKpiCard key={`billed-${summary.currency}`} title={`Facturado Total (${summary.currency})`} value={formatExplicitAmount(summary.amount, summary.currency)} icon={FileText} color="text-primary" bg="bg-primary/10" />)
          : <SalesKpiCard title={`Facturado Total (${displayCurrency}${valuationModeSuffix})`} value={formatExplicitAmount(totalBilledInDisplayCurrency, displayCurrency)} icon={FileText} color="text-primary" bg="bg-primary/10" />}
        {displayMode === 'ORIGINAL'
          ? originalReceivable.map((summary) => <SalesKpiCard key={`receivable-${summary.currency}`} title={`Por Cobrar (${summary.currency})`} value={formatExplicitAmount(summary.amount, summary.currency)} icon={TrendingUp} color="text-orange-500" bg="bg-orange-500/10" active={statusFilter === 'RECEIVABLE'} onClick={() => setStatusFilter(statusFilter === 'RECEIVABLE' ? 'ALL' : 'RECEIVABLE')} />)
          : <SalesKpiCard title={`Por Cobrar (${displayCurrency}${valuationModeSuffix})`} value={formatExplicitAmount(accountsReceivableInDisplayCurrency, displayCurrency)} icon={TrendingUp} color="text-orange-500" bg="bg-orange-500/10" active={statusFilter === 'RECEIVABLE'} onClick={() => setStatusFilter(statusFilter === 'RECEIVABLE' ? 'ALL' : 'RECEIVABLE')} />}
        <SalesKpiCard title="Vencidas" value={data.filter(f => (f.status || '').toUpperCase() === 'OVERDUE').length} icon={AlertCircle} color="text-orange-500" bg="bg-orange-500/10" active={statusFilter === 'OVERDUE'} onClick={() => setStatusFilter(statusFilter === 'OVERDUE' ? 'ALL' : 'OVERDUE')} />
        {displayMode === 'ORIGINAL'
          ? originalPaid.map((summary) => <SalesKpiCard key={`paid-${summary.currency}`} title={`Cobrado (${summary.currency})`} value={formatExplicitAmount(summary.amount, summary.currency)} icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-500/10" active={statusFilter === 'PAID'} onClick={() => setStatusFilter(statusFilter === 'PAID' ? 'ALL' : 'PAID')} />)
          : <SalesKpiCard title={`Cobrado (${displayCurrency}${valuationModeSuffix})`} value={formatExplicitAmount(paidInDisplayCurrency, displayCurrency)} icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-500/10" active={statusFilter === 'PAID'} onClick={() => setStatusFilter(statusFilter === 'PAID' ? 'ALL' : 'PAID')} />}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-2">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground" data-tour="sales-list-title">Control de Facturación</h2>
          </div>
          <div className="erp-list-toolbar flex flex-wrap items-center justify-end gap-3" data-tour="sales-list-actions">
            <SalesViewTutorial view="invoices" />
            <ViewLayoutSelect value={layoutMode} onChange={(value) => setLayoutMode(value === 'kanban' ? 'table' : value)} ariaLabel="Elegir distribución de facturas" />
            <SalesDateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChange={onDateRangeChange || (() => undefined)} />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input
                placeholder="Buscar factura..."
                className="pl-9 h-10 w-full sm:w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold tracking-widest"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }}
              />
            </div>
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
        actionsWidth="w-44"
        fitContent
          layoutMode={layoutMode}
          highlightedRowId={highlightedAlertId}
          isRowSelectable={isInvoiceCancellableFromList}
          onRowUpdate={async (id, updates) => { await handleUpdate(id, updates); }}
          onRowClick={(row) => { void openInvoiceDetail(row); }}
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
            const bulkCancelToastId = toast.loading(`Enviando ${rowsToCancel.length} solicitud${rowsToCancel.length === 1 ? '' : 'es'} a Contabilidad...`);
            try {
              await Promise.all(rowsToCancel.map((invoice) => invoicesService.requestCancellation(invoice.id, 'Solicitud de anulación masiva')));
              toast.success(`${rowsToCancel.length} solicitud${rowsToCancel.length === 1 ? '' : 'es'} enviada${rowsToCancel.length === 1 ? '' : 's'} a Contabilidad`, { id: bulkCancelToastId });
              onRefresh();
            } catch (e: any) {
              toast.error(e?.response?.data?.message || e?.message || 'No se pudieron anular las facturas', { id: bulkCancelToastId });
            }
          }}
          bulkAction="cancel"
          isLoading={loading}
          bulkActions={() => null}
          actions={(row) => (
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1 pr-1 xl:min-w-max xl:flex-nowrap">
              <WhatsAppActionButton
                phone={resolveCustomerPhone(row.customerId, row.customer, customers)}
                documentLabel="factura"
                onSend={() => handleWhatsApp(row)}
              />
              {canPerform('SALES_INVOICES', 'approve') && canPerform('SALES_CREDIT_NOTES', 'approve') &&
                !['PAID', 'CANCELLED', 'CREDIT'].includes(String(row.status).toUpperCase()) &&
                !row.creditNotes?.some((credit) => ['ISSUED', 'PARTIAL', 'APPLIED'].includes(String(credit.status).toUpperCase())) &&
                getInvoiceBalance(row) > 0.01 &&
                invoiceFitsAvailableCredit(row) && (
                <Button type="button" title="Enviar saldo a crédito" aria-label={`Enviar saldo a crédito de ${row.number}`} variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg text-primary hover:bg-primary/10 transition-colors" onClick={() => openInvoiceCredit(row)}>
                  <Send className="size-4" />
                </Button>
              )}
              {canPerform('SALES_INVOICES', 'approve') && canPerform('SALES_PAYMENTS', 'create') && canPerform('SALES_PAYMENTS', 'approve') &&
                !['PAID', 'CANCELLED'].includes(String(row.status).toUpperCase()) &&
                getInvoiceBalance(row) > 0 && (
                <Button type="button" title="Registrar pago parcial o total" aria-label={`Registrar pago de ${row.number}`} variant="ghost" size="icon" disabled={paymentLoading && paymentInvoice?.id === row.id} className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-muted-foreground transition-colors" onClick={() => openInvoicePayment(row)}>
                  {paymentLoading && paymentInvoice?.id === row.id ? <CreditCard className="size-4 animate-pulse text-primary" /> : <CreditCard className="size-4" />}
                </Button>
              )}
              {canPerform('SALES_INVOICES', 'delete') && isInvoiceCancellableFromList(row) && (
                <Button type="button" title="Solicitar anulación a Contabilidad" aria-label={`Solicitar anulación de ${row.number}`} variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors" onClick={() => { setPendingCancelId(row.id); setCancelReason(''); }}>
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
        sourceBadge={getSalesInvoiceOriginBadge(detailInvoice)}
        open={Boolean(detailInvoice)}
        onClose={() => setDetailInvoice(null)}
        onOpenInvoice={(invoice) => { setDetailInvoice(null); setEditingId(invoice.id); }}
        onDownloadPdf={(invoice, format) => { void handleDownloadInvoicePdf(invoice, format); }}
        onDownloadPayment={(payment, invoice, format, remainingOverride) => { void handleDownloadPaymentVoucher(payment, invoice, format, remainingOverride); }}
        getPaymentRemaining={getHistoricalPaymentRemaining}
        getBalance={getInvoiceBalance}
        formatAmount={formatInvoiceAmount}
        formatDate={formatDateSafe}
      />

      <ConfirmDialog
        open={pendingCancelId !== null}
        onOpenChange={(open) => { if (!open) { setPendingCancelId(null); setCancelReason(''); } }}
        title={"¿Solicitar anulación?"}
        description="La factura no se anulará ahora. Se enviará una solicitud a Contabilidad para revisión y aprobación."
        confirmLabel="Enviar solicitud"
        variant="destructive"
        loading={cancelLoading}
        disabled={!cancelReason.trim()}
        onConfirm={async () => {
          if (!pendingCancelId || !cancelReason.trim()) return;
          const cancelToastId = toast.loading('Enviando solicitud a Contabilidad...');
          try {
            setCancelLoading(true);
            await invoicesService.requestCancellation(pendingCancelId, cancelReason.trim());
            toast.success('Solicitud enviada a Contabilidad', { id: cancelToastId });
            setEditingId(null);
            setIsCreating(false);
            onRefresh();
          } catch (error: any) {
            toast.error(error?.response?.data?.message || error?.message || 'No se pudo enviar la solicitud de anulación', { id: cancelToastId });
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
              <Send className="size-5 text-primary" /> Enviar factura a crédito
            </DialogTitle>
            <DialogDescription>
              Se trasladará únicamente el saldo pendiente a Créditos y se validará el límite disponible del cliente.
            </DialogDescription>
          </DialogHeader>
          {creditInvoice && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{creditInvoice.number} · {creditInvoice.customer?.name || 'Cliente'}</p>
                <p className="mt-1 text-2xl font-black text-primary">Saldo a crédito: {formatInvoiceAmount(getInvoiceBalance(creditInvoice), creditInvoice.currency, creditInvoice.exchangeRate)}</p>
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
            <Button type="button" onClick={() => void handleSendInvoiceToCredit()} disabled={creditLoading || !creditDueDate} className="bg-primary font-black text-primary-foreground hover:bg-primary/90">
              {creditLoading ? 'Enviando...' : 'Confirmar crédito'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={(open) => { if (!open) closeInvoicePayment(); }}>
        <DialogContent className="!flex !flex-col !max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] !max-w-xl !overflow-hidden rounded-3xl p-4 sm:w-[calc(100%-2rem)] sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
              <CreditCard className="size-5 text-primary" /> Registrar pago de factura
            </DialogTitle>
          </DialogHeader>
          {paymentInvoice && (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-3 [scrollbar-gutter:stable]">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{paymentInvoice.number} · {paymentInvoice.customer?.name || 'Cliente'}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total factura</p>
                    <p className="mt-0.5 text-lg font-black text-foreground">{formatInvoiceAmount(paymentInvoiceTotal, paymentInvoice.currency, paymentInvoice.exchangeRate)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Abonado</p>
                    <p className="mt-0.5 text-lg font-black text-foreground">{formatInvoiceAmount(paymentInvoiceAlreadyPaid, paymentInvoice.currency, paymentInvoice.exchangeRate)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Saldo actual</p>
                    <p className="mt-0.5 text-lg font-black text-primary">{formatInvoiceAmount(paymentInvoiceCurrentBalance, paymentInvoice.currency, paymentInvoice.exchangeRate)}</p>
                  </div>
                </div>
              </div>
              {!paymentInvoice.registerId && !paymentInvoice.sessionId && (
                <div className="space-y-2 rounded-xl border border-border/60 bg-muted/10 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Caja (opcional)</p>
                    {cashSession && <span className="text-[10px] font-black text-emerald-600">Abierta</span>}
                  </div>
                  {cashRegisters.length > 0 ? (
                    <Select value={cashRegisterId || '__none__'} onValueChange={(value) => setCashRegisterId(value === '__none__' ? '' : value)} disabled={cashLoading || paymentLoading}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Selecciona la caja donde se recibió el pago" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No asociar a una caja</SelectItem>
                        {cashRegisters.map((register) => (
                          <SelectItem key={register.id} value={register.id}>{register.name} ({register.code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-[10px] font-medium text-muted-foreground">Sin caja abierta. El pago se registrará sin movimiento en Control de Caja.</p>
                  )}
                </div>
              )}
              <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Forma de pago</p>
                  <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
                    <label
                      className={cn(
                        'flex items-center gap-2 text-[10px] font-black uppercase tracking-widest',
                        paymentPartialCreditFits ? 'cursor-pointer text-muted-foreground' : 'cursor-not-allowed text-muted-foreground/50',
                      )}
                      title={!paymentPartialCreditFits ? 'El saldo restante supera el crédito disponible del cliente' : undefined}
                    >
                      <Switch
                        checked={paymentPartialActive}
                        onCheckedChange={(checked) => setPartialPaymentEnabled(checked)}
                        disabled={paymentLoading || !paymentPartialCreditFits}
                        aria-label="Activar pago parcial"
                      />
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
                {paymentHasRemaining && !paymentPartialCreditFits && !paymentHasActiveCredit && (
                  <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                    El saldo restante supera el crédito disponible del cliente. Reduce el monto del pago para habilitar Pago parcial.
                  </p>
                )}
                {paymentLines.map((line, index) => (
                  <div key={`${index}-${line.method}`} className="rounded-xl border border-border/60 bg-background/70 p-3 space-y-2">
                    <div className="flex items-end gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Método</p>
                        <Select value={line.method} onValueChange={(nextMethod) => handlePaymentMethodChange(index, nextMethod)}>
                          <SelectTrigger size="sm" className="h-9 w-full rounded-lg border-input bg-background px-2 text-xs font-bold uppercase"><SelectValue /></SelectTrigger>
                          <SelectContent>{paymentMethodOptions.filter((method) => method.value !== 'CUSTOMER_BALANCE' || paymentCustomerFavorBase > 0.01).map((method) => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}</SelectContent>
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
                          disabled={line.method === 'CUSTOMER_BALANCE' || paymentLoading}
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
                    {hasPaymentReferenceField(line.method) && <div className="mt-2">
                      <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Referencia *</p>
                      <Input value={line.reference || ''} onChange={(event) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, reference: event.target.value } : item))} placeholder="Transferencia, voucher, cheque..." required={requiresPaymentReference(line.method)} className="h-9 text-xs" />
                    </div>}
                    {line.method === 'CUSTOMER_BALANCE' && <p className="mt-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Disponible a favor: {formatConvertedAmount(paymentCustomerFavorBase, baseCurrency)}. Puedes aplicar solo una parte.</p>}
                  </div>
                ))}
                {mixedPaymentEnabled && (
                  <Button type="button" variant="outline" className="w-full border-dashed text-[10px] font-black uppercase tracking-widest" onClick={() => setPaymentLines((current) => [...current, paymentLine('CARD')])}>
                    <Plus className="mr-2 size-4" /> Agregar pago mixto
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha del pago *</p>
                  <Input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
                </div>
                <div className="rounded-xl border border-border/50 bg-background/60 p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Este pago</p>
                  <p className="mt-1 text-lg font-black text-foreground">{formatInvoiceAmount(paymentTotalInInvoiceCurrency, paymentInvoice.currency, paymentInvoice.exchangeRate)}</p>
                </div>
              </div>
              <div className={cn('rounded-xl border p-3', paymentHasRemaining ? 'border-primary/25 bg-primary/5' : paymentChangeUnsupported ? 'border-rose-500/30 bg-rose-500/5' : paymentHasChange ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-border/50 bg-muted/20')}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{paymentSettlementLabel}</p>
                    <p className={cn('mt-1 text-xl font-black', paymentChangeUnsupported ? 'text-rose-600 dark:text-rose-400' : paymentHasChange ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary')}>
                      {formatInvoiceAmount(paymentSettlementAmount, paymentInvoice.currency, paymentInvoice.exchangeRate)}
                    </p>
                  </div>
                </div>
                {paymentChangeUnsupported && (
                  <p className="mt-2 border-t border-rose-500/15 pt-2 text-[10px] font-bold text-rose-600 dark:text-rose-400">No se puede dar vuelto de una tarjeta, transferencia o banco. Reduce esos montos o agrega suficiente efectivo para cubrir el excedente.</p>
                )}
                {paymentHasChange && !paymentChangeUnsupported && (
                  <p className="mt-2 border-t border-emerald-500/15 pt-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">El pago supera el saldo de la factura y el excedente se devolverá al cliente.</p>
                )}
                {paymentHasRemaining && (
                  paymentHasActiveCredit ? (
                    <p className="mt-2 border-t border-primary/15 pt-2 text-[10px] font-bold text-primary">El saldo restante ya pertenece al crédito activo de esta factura; el abono continuará sobre ese crédito.</p>
                  ) : (
                    <div className="mt-2 space-y-1 border-t border-primary/15 pt-2 text-[10px]">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Crédito disponible considerando deuda activa</span>
                        <span className="font-black text-foreground">{formatConvertedAmount(paymentCreditAvailableBase, baseCurrency)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Disponible después de este saldo</span>
                        <span className={cn('font-black', paymentPartialCreditFits ? 'text-emerald-600' : 'text-rose-600')}>{formatConvertedAmount(paymentCreditAfterBase, baseCurrency)}</span>
                      </div>
                      <p className={cn('font-bold', paymentPartialCreditFits ? 'text-emerald-600' : 'text-rose-600')}>
                        {paymentPartialCreditFits
                          ? 'El saldo restante se enviará a crédito con la fecha indicada.'
                          : 'El saldo restante supera el límite de crédito disponible.'}
                      </p>
                    </div>
                  )
                )}
                {paymentCustomerFavorAppliedBase > 0.01 && <p className="mt-2 border-t border-emerald-500/15 pt-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Aplicado desde saldo a favor: {formatConvertedAmount(paymentCustomerFavorAppliedBase, baseCurrency)}{paymentCustomerFavorExceeded ? ' · supera el disponible' : ''}</p>}
              </div>
              {paymentRemainingInInvoiceCurrency > 0.01 && (
                <div>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha del saldo pendiente *</p>
                  <Input type="date" value={paymentDueDate} onChange={(event) => setPaymentDueDate(event.target.value)} />
                </div>
              )}
            </div>
          )}
          <DialogFooter className="shrink-0">
            <Button type="button" variant="outline" onClick={closeInvoicePayment} disabled={paymentLoading}>Cancelar</Button>
            <Button onClick={() => void handleInvoicePayment()} disabled={paymentLoading || cashLoading || paymentChangeUnsupported || paymentCustomerFavorExceeded || (!paymentHasActiveCredit && paymentRemainingBase > paymentCreditAvailableBase + 0.01) || paymentLines.some((line) => requiresPaymentReference(line.method) && !line.reference?.trim()) || paymentLines.some((line) => isBankPaymentMethod(line.method, true) && !line.bankAccountId)} className="bg-primary font-black">
              {paymentLoading ? 'Registrando...' : 'Confirmar pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(paymentVoucher)} onOpenChange={(open) => { if (!open) setPaymentVoucher(null); }}>
        <DialogContent className="w-[calc(100%-2rem)] !max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
              <CheckCircle2 className="size-5 text-primary" />
              {(paymentVoucher?.payment.creditNoteId || paymentVoucher?.payment.creditNote) && paymentVoucher.remaining <= 0.01
                ? 'Crédito cancelado'
                : paymentVoucher?.remaining && paymentVoucher.remaining > 0.01 ? 'Pago parcial registrado' : 'Pago registrado'}
            </DialogTitle>
            <DialogDescription>
              Revisa el resultado del cobro y descarga el Voucher desde este comprobante.
            </DialogDescription>
          </DialogHeader>
          {paymentVoucher && (() => {
            const paymentRows = paymentVoucher.payment.payments?.length ? paymentVoucher.payment.payments : [paymentVoucher.payment];
            const invoiceCurrency = paymentVoucher.invoice.currency || baseCurrency;
            const isPartial = paymentVoucher.remaining > 0.01;
            const invoiceTotal = Number(paymentVoucher.invoice.total || 0);
            const accumulatedPaid = Math.min(invoiceTotal, Math.max(0, invoiceTotal - paymentVoucher.remaining));
            const extraCharges = getSalesAdditionalCharges(paymentVoucher.invoice).filter((charge) => charge.amount > 0.001);
            const hasFinancialBreakdown = Number(paymentVoucher.invoice.subtotal || 0) > 0.001
              || Number(paymentVoucher.invoice.discountAmount || 0) > 0.001
              || Number(paymentVoucher.invoice.taxAmount || 0) > 0.001
              || extraCharges.length > 0;
            const isCreditSettlement = Boolean(paymentVoucher.payment.creditNoteId || paymentVoucher.payment.creditNote) && !isPartial;
            return (
              <div className="max-h-[min(70vh,40rem)] space-y-4 overflow-y-auto pr-1">
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {paymentVoucher.payment.number || 'Pago registrado'} · {paymentVoucher.invoice.number}
                  </p>
                  <p className="mt-1 text-2xl font-black text-primary">
                    {isCreditSettlement ? 'Crédito cancelado' : isPartial ? 'Abono aplicado' : 'Pago completo'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cliente: {paymentVoucher.invoice.customer?.name || paymentVoucher.payment.customer?.name || 'Cliente'}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border/50 bg-background/60 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Monto total</p>
                    <p className="mt-1 text-lg font-black">{formatInvoiceAmount(invoiceTotal, invoiceCurrency, paymentVoucher.invoice.exchangeRate)}</p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background/60 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Abonado</p>
                    <p className="mt-1 text-lg font-black">{formatInvoiceAmount(accumulatedPaid, invoiceCurrency, paymentVoucher.invoice.exchangeRate)}</p>
                  </div>
                  <div className={cn('rounded-xl border p-3', isPartial ? 'border-primary/25 bg-primary/5' : 'border-emerald-500/20 bg-emerald-500/5')}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Saldo pendiente</p>
                    <p className={cn('mt-1 text-lg font-black', isPartial ? 'text-primary' : 'text-emerald-600')}>
                      {formatInvoiceAmount(paymentVoucher.remaining, invoiceCurrency, paymentVoucher.invoice.exchangeRate)}
                    </p>
                  </div>
                </div>
                {paymentVoucher.change > 0.01 && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Cambio / vuelto entregado</p>
                    <p className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-400">{formatInvoiceAmount(paymentVoucher.change, invoiceCurrency, paymentVoucher.invoice.exchangeRate)}</p>
                  </div>
                )}
                {hasFinancialBreakdown && (
                  <div className="rounded-2xl border border-border/50 bg-muted/10 p-4">
                    <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resumen del documento</p>
                    <div className="space-y-2 text-xs">
                      {Number(paymentVoucher.invoice.subtotal || 0) > 0.001 && <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Subtotal</span><span className="font-bold tabular-nums">{formatInvoiceAmount(Number(paymentVoucher.invoice.subtotal || 0), invoiceCurrency, paymentVoucher.invoice.exchangeRate)}</span></div>}
                      {Number(paymentVoucher.invoice.discountAmount || 0) > 0.001 && <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Descuento</span><span className="font-bold tabular-nums text-rose-500">- {formatInvoiceAmount(Number(paymentVoucher.invoice.discountAmount || 0), invoiceCurrency, paymentVoucher.invoice.exchangeRate)}</span></div>}
                      {Number(paymentVoucher.invoice.taxAmount || 0) > 0.001 && <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">IVA</span><span className="font-bold tabular-nums">{formatInvoiceAmount(Number(paymentVoucher.invoice.taxAmount || 0), invoiceCurrency, paymentVoucher.invoice.exchangeRate)}</span></div>}
                      {extraCharges.map((charge) => <div key={charge.id} className="flex items-center justify-between gap-3"><span className="min-w-0 truncate text-muted-foreground">{charge.description || 'Coste extra'}</span><span className="shrink-0 font-bold tabular-nums">{formatInvoiceAmount(charge.amount, invoiceCurrency, paymentVoucher.invoice.exchangeRate)}</span></div>)}
                    </div>
                  </div>
                )}
                <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Formas de pago</p>
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">{isCreditSettlement ? 'Cancelado' : isPartial ? 'Abono' : 'Liquidado'}</span>
                  </div>
                  <div className="space-y-2">
                    {paymentRows.map((row, index) => (
                      <div key={`${row.id || row.method}-${index}`} className="rounded-xl border border-border/50 bg-background/70 px-3 py-2">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-bold">{paymentMethodLabel(String(row.method || '').toUpperCase())}</span>
                          <span className="font-black tabular-nums">{formatInvoiceAmount(Number(row.amount || 0), row.currency, row.exchangeRate)}</span>
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Moneda: {row.currency || paymentVoucher.payment.currency}
                          {row.reference ? ` · Referencia: ${row.reference}` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setPaymentVoucher(null)}>Cerrar</Button>
            {paymentVoucher && <PdfDownloadButton onDownload={(format) => { void handleDownloadPaymentVoucher(paymentVoucher.payment, paymentVoucher.invoice, format, paymentVoucher.remaining); }} />}
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
