import { useState, useEffect, useRef } from 'react';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { 
  Plus, Search, TrendingUp, Clock, ArrowRightCircle, Eye, Ban, ChevronLeft, Trash2, Settings2, Check
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { salesOrdersService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import type { SalesOrder, Customer, Product, Employee, SalesPaginationControls } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { useCurrency } from '../../contexts/CurrencyContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { generateEstimatePDF, previewSalesTransactionPDF } from '../../utils/pdfGenerator';
import { buildPdfFileName } from '../../utils/exportFileNames';
import { storageService } from '../../services/storage.service';
import { publicAccessService, publicLinkUrl } from '../../services/public-access.service';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { SalesLinePriceListSelect, PriceMissingBadge } from './SalesLinePriceListSelect';
import { SalesAccountingLegend } from './SalesAccountingLegend';
import { formatSalesAmount, getMissingSalesPriceMessage, hasSalesProductPriceListConflict, hasSalesProductPriceListConflicts } from '../../utils/salesPriceList';
import { SalesDateRangeFilter } from './SalesDateRangeFilter';
import { SalesViewTutorial } from './SalesViewTutorial';
import type { PdfDownloadFormat } from '../../utils/pdfDownloadFormats';
import { SalesKpiCard } from './SalesKpiCard';
import { resolveCustomerPhone, WhatsAppActionButton } from './WhatsAppActionButton';
import { PurchaseAlertsButton, type PurchaseAlertDetail } from '../compras/PurchaseAlertsButton';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { formatDateEs } from '../../utils/dateFormat';
import { getSalesStatusColor, SALES_WORKFLOW_STATUS_COLORS } from '../../utils/salesStatus';
import { SalesDocumentDetailSheet, getSalesLineIdentifiers, type SalesDocumentPanelData } from './SalesDocumentDetailSheet';
import { getLegacySalesExtraCostFields, getSalesExtraChargesAmount, getSalesExtraChargesPayload, normalizeSalesExtraCharges, type SalesExtraChargeLine } from '../../utils/salesCharges';
import { summarizeAmountsByCurrency } from '../../utils/currency';
import { SalesWarehouseSelect, getProductStockForSalesWarehouse } from './SalesWarehouseSelect';
import { SalesWarehouseStockHint } from './SalesWarehouseStockHint';
import { SalesVariantSelect } from './SalesVariantSelect';
import { clearSalesEditorDraft, getSalesEditorDraftKey, readSalesEditorDraft, writeSalesEditorDraft } from '../../services/sales-draft-storage';
import { getSalesOrderOriginBadge } from '../../utils/document-origin-badges';
import { getLoggedInSellerEmployeeId } from '../../utils/salesSeller';

const paymentMethodOptions = [
  { label: 'Efectivo', value: 'CASH' },
  { label: 'Tarjeta', value: 'CARD' },
  { label: 'Transferencia', value: 'TRANSFER' },
  { label: 'Cheque', value: 'CHECK' },
  { label: 'Crédito', value: 'CREDIT' },
  { label: 'Otro', value: 'OTHER' },
];

interface OrdenesVentaViewProps {
  data: SalesOrder[];
  loading: boolean;
  onRefresh: () => Promise<void> | void;
  onGenerateInvoice: (order: SalesOrder) => Promise<void> | void;
  targetOrderId?: string | null;
  onClearTargetOrderId?: () => void;
  customers?: Customer[];
  products?: Product[];
  warehouses?: any[];
  employees?: Employee[];
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateRangeChange?: (dateFrom: string, dateTo: string) => void;
  statusFilter?: OrderStatusFilter;
  onStatusFilterChange?: (value: OrderStatusFilter) => void;
  salesAlert?: PurchaseAlertDetail;
}

const statusOptions = [
  { label: 'Borrador',       value: 'DRAFT',       color: SALES_WORKFLOW_STATUS_COLORS.DRAFT },
  { label: 'En proceso',     value: 'IN_PROCESS',  color: SALES_WORKFLOW_STATUS_COLORS.IN_PROCESS },
  { label: 'Aprobada',       value: 'APPROVED',    color: SALES_WORKFLOW_STATUS_COLORS.APPROVED },
  { label: 'Cancelada',      value: 'CANCELLED',   color: SALES_WORKFLOW_STATUS_COLORS.CANCELLED },
];

export type OrderStatusFilter = 'ALL' | 'DRAFT' | 'IN_PROCESS' | 'APPROVED' | 'CANCELLED';
type OrderWorkflowStatus = 'DRAFT' | 'IN_PROCESS' | 'APPROVED';

const normalizeOrderStatus = (status: unknown) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'CONFIRMED') return 'APPROVED';
  if (normalized === 'IN_PROGRESS') return 'IN_PROCESS';
  if (normalized === 'SHIPPED' || normalized === 'DELIVERED') return 'APPROVED';
  return normalized;
};

const getOrderWorkflowIssues = (order: SalesOrder | null | undefined): string[] => {
  if (!order) return ['Información general'];
  const issues: string[] = [];
  if (!order.customerId && !String((order as any).customCustomerName || '').trim()) issues.push('Cliente');
  if (!order.date || Number.isNaN(new Date(order.date).getTime())) issues.push('Fecha');
  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) issues.push('al menos un producto o servicio');
  items.forEach((item: any, index) => {
    const label = `Ítem ${index + 1}`;
    if (!item.productId && !String(item.description || '').trim()) issues.push(`${label}: producto o servicio`);
    if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) issues.push(`${label}: cantidad mayor que cero`);
    if (!Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) < 0) issues.push(`${label}: precio válido`);
  });
  return issues;
};

export function OrdenesVentaView({ data, loading, onRefresh, onGenerateInvoice, targetOrderId, onClearTargetOrderId, customers = [], products = [], warehouses = [], employees = [], pagination, onSearchChange, dateFrom = '', dateTo = '', onDateRangeChange, statusFilter: controlledStatusFilter, onStatusFilterChange, salesAlert }: OrdenesVentaViewProps) {
  const { exchangeRate: globalRate, displayCurrency, baseCurrency, displayMode, formatConvertedAmount, formatExplicitAmount, toBaseAmount, formatAmount } = useCurrency();
  const { user, canPerform } = useAuth();
  const tenantKey = user?.tenantId || user?.clientTenantId || 'anonymous';
  const { themeConfig } = useTheme();
  const salesDraftStorageKey = getSalesEditorDraftKey('sales-order', user?.tenantId, user?.id);
  const [searchTerm, setSearchTerm] = useState('');
  const [localStatusFilter, setLocalStatusFilter] = useState<OrderStatusFilter>('ALL');
  const statusFilter = controlledStatusFilter ?? localStatusFilter;
  const setStatusFilter = (value: OrderStatusFilter) => {
    onStatusFilterChange?.(value);
    if (controlledStatusFilter === undefined) setLocalStatusFilter(value);
  };
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<SalesOrder | null>(null);
  const [detailOrder, setDetailOrder] = useState<SalesOrder | null>(null);
  const [highlightedAlertId, setHighlightedAlertId] = useState<string | null>(null);
  const [columnConfigOpen, setColumnConfigOpen] = useState(false);
  const [visibleColumnKeys, setVisibleColumnKeys] = useLocalStorageState<string[]>(`sales-orders-columns-${tenantKey}`, [
    'number', 'customer', 'itemCount', 'total', 'status', 'date',
    'paymentMethod', 'invoiceNumber', 'invoicedAt', 'invoicedBy',
  ],24 * 365);
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('sales-orders-layout', 'table', 24 * 365);
  const productCatalog = products.filter((p) => p.itemType !== 'SERVICE');
  const serviceCatalog = products.filter((p) => p.itemType === 'SERVICE');
  const resolveItemType = (item: any) => item.itemType || (products.find((p) => p.id === item.productId)?.itemType === 'SERVICE' ? 'SERVICE' : 'PRODUCT');
  const findProductForItem = (item: any) => {
    const itemCode = String(item?.productCode || item?.code || '').trim().toLowerCase();
    const itemName = String(item?.description || '').trim().toLowerCase();
    return products.find((product) => product.id === item?.productId)
      || (itemCode ? products.find((product) => String(product.code || '').trim().toLowerCase() === itemCode) : undefined)
      || (itemName ? products.find((product) => String(product.name || '').trim().toLowerCase() === itemName) : undefined);
  };
  const getLineProductOptions = (item: any) => {
    const itemType = resolveItemType(item);
    const catalog = itemType === 'SERVICE' ? serviceCatalog : productCatalog;
    const options = catalog.map((product) => ({
      label: `${itemType === 'SERVICE' ? 'Servicio' : 'Producto'} · ${product.code} - ${product.name}`,
      value: product.id,
      description: product.commercialNote ? `Nota: ${product.commercialNote}` : undefined,
    }));
    const hasSelectedOption = Boolean(item.productId) && options.some((option) => option.value === item.productId);
    if (item.productId && !hasSelectedOption && String(item.description || '').trim()) {
      options.unshift({
        label: `${itemType === 'SERVICE' ? 'Servicio' : 'Producto'} · ${item.description}`,
        value: item.productId,
        description: item.commercialNoteSnapshot ? `Nota: ${item.commercialNoteSnapshot}` : undefined,
      });
    }
    return options;
  };
  const showVariantColumn = (localDoc?.items || []).some((item: any) => {
    const product = findProductForItem(item);
    return String(resolveItemType(item)).toUpperCase() !== 'SERVICE'
      && (product?.variants || []).filter((variant: any) => variant.isActive !== false).length > 1;
  });
  const showPriceTypeColumn = (localDoc?.items || []).some((item: any) => (
    Boolean(item.productId) && String(resolveItemType(item)).toUpperCase() !== 'SERVICE'
  ));
  const productHeaderColumnClass = showVariantColumn && showPriceTypeColumn
    ? undefined
    : showVariantColumn || showPriceTypeColumn
      ? 'sales-line-product-header--two-columns'
      : 'sales-line-product-header--one-column';
  const [invoicingOrderId, setInvoicingOrderId] = useState<string | null>(null);
  const savingOrderRef = useRef(false);
  const [pricingMode, setPricingMode] = useState<'global' | 'individual'>('global');
  const [localRates, setLocalRates] = useState({ dRate: 0, tRate: 0 });
  const localDocRef = useRef<SalesOrder | null>(null);
  const hydratedDraftKeyRef = useRef<string | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);

  const commitLocalDoc = (nextDoc: SalesOrder | null) => {
    localDocRef.current = nextDoc;
    setLocalDoc(nextDoc);
  };

  useEffect(() => {
    localDocRef.current = localDoc;
  }, [localDoc]);

  useEffect(() => {
    if (!salesDraftStorageKey || hydratedDraftKeyRef.current === salesDraftStorageKey) return;
    hydratedDraftKeyRef.current = salesDraftStorageKey;
    const stored = readSalesEditorDraft<SalesOrder>(salesDraftStorageKey);
    const timer = window.setTimeout(() => {
      if (stored) {
        if (stored.document) commitLocalDoc(stored.document);
        if (stored.editingId) setEditingId(stored.editingId);
        const rates = stored.metadata?.localRates;
        if (rates && typeof rates === 'object') setLocalRates(rates as { dRate: number; tRate: number });
        const storedPricingMode = stored.metadata?.pricingMode;
        if (storedPricingMode === 'global' || storedPricingMode === 'individual') setPricingMode(storedPricingMode);
      }
      setDraftHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [salesDraftStorageKey]);

  useEffect(() => {
    if (!draftHydrated || !salesDraftStorageKey || hydratedDraftKeyRef.current !== salesDraftStorageKey) return;
    if (!editingId || !localDoc) {
      clearSalesEditorDraft(salesDraftStorageKey);
      return;
    }
    writeSalesEditorDraft(salesDraftStorageKey, {
      editingId,
      document: localDoc,
      metadata: { localRates, pricingMode },
    });
  }, [draftHydrated, editingId, localDoc, localRates, pricingMode, salesDraftStorageKey]);

  useEffect(() => {
    if (!highlightedAlertId) return;
    const timeout = window.setTimeout(() => setHighlightedAlertId(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [highlightedAlertId]);

  const handleInvoiceOrder = async (order: SalesOrder) => {
    if (!canPerform('SALES_ORDERS', 'approve')) {
      toast.error('No tienes permiso para aprobar y enviar órdenes a factura');
      return;
    }
    if (invoicingOrderId) return;
    let orderForConversion = localDoc?.id === order.id
      ? {
          ...order,
          sellerEmployeeId: localDoc.sellerEmployeeId,
        }
      : order;
    const customer = orderForConversion.customer || customers.find((item) => item.id === orderForConversion.customerId);
    if (!customer || String(customer.status || '').toUpperCase() !== 'ACTIVE') {
      toast.error('El cliente de la orden no está activo');
      return;
    }
    if (!orderForConversion.items?.length) {
      toast.error('La orden debe contener al menos un producto o servicio');
      return;
    }
    const priceMessage = getMissingSalesPriceMessage(orderForConversion.items);
    if (priceMessage) {
      toast.error(priceMessage);
      return;
    }
    for (const item of orderForConversion.items) {
      if (!item.description?.trim() || Number(item.quantity) <= 0 || Number(item.unitPrice) < 0) {
        toast.error('La orden contiene productos o servicios con datos inválidos');
        return;
      }
      if (item.productId) {
        const product = findProductForItem(item);
        if (product && String(product.status || '').toUpperCase() === 'INACTIVE') {
          toast.error(`El producto ${item.description} ya no está disponible`);
          return;
        }
        const availableStock = product && product.itemType !== 'SERVICE'
          ? getProductStockForSalesWarehouse(product, orderForConversion.warehouseId, item.variantId)
          : undefined;
        if (availableStock !== undefined && availableStock < Number(item.quantity)) {
          toast.error(`Stock insuficiente para ${item.description} en la bodega seleccionada`);
          return;
        }
      }
    }
    if (orderForConversion.invoiceId || orderForConversion.invoiceNumber) {
      toast.info(`La orden ya está facturada${orderForConversion.invoiceNumber ? ` con ${orderForConversion.invoiceNumber}` : ''}`);
      return;
    }
    setInvoicingOrderId(order.id);
    const invoiceToastId = toast.loading('Generando factura desde la orden de venta...');
    try {
      const currentStatus = normalizeOrderStatus(orderForConversion.status);
      if (!['IN_PROCESS', 'APPROVED'].includes(currentStatus)) {
        toast.error('La orden debe estar en proceso o aprobada antes de enviarse a factura', { id: invoiceToastId });
        return;
      }
      await onGenerateInvoice({ ...orderForConversion, status: 'APPROVED' as any });
      toast.success('Factura generada desde la orden de venta', { id: invoiceToastId });
      await onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo abrir la factura', { id: invoiceToastId });
    } finally {
      setInvoicingOrderId(null);
    }
  };

  const handleWhatsApp = async (order: SalesOrder) => {
    const phone = resolveCustomerPhone(order.customerId, order.customer, customers);
    if (!phone) {
      toast.error('El cliente no tiene un número asociado para enviar la orden de venta por WhatsApp');
      return;
    }

    const customer = order.customer || customers.find((entry) => entry.id === order.customerId);
    let secureDocumentUrl: string | null = null;
    let securePortalUrl: string | null = null;
    let publicPdfUrl: string | null = null;

    const preparingToastId = toast.loading('Generando PDF y preparando el mensaje...');
    try {
      if (order.customerId) {
        const [documentLink, portalLink] = await Promise.all([
          publicAccessService.createDocumentLink({ customerId: order.customerId, documentType: 'sales-order', documentId: order.id, allowPrint: true, allowDownload: true, allowRelated: true }),
          publicAccessService.createPortalLink({ customerId: order.customerId }),
        ]);
        secureDocumentUrl = publicLinkUrl(documentLink.path);
        securePortalUrl = publicLinkUrl(portalLink.path);
      }

      if (!secureDocumentUrl) {
        const { blob } = await generateEstimatePDF({
          estimate: { ...order, customer },
          tenantName: user?.sessionBranding?.name || themeConfig?.tenantName || user?.tenantName || 'Empresa',
          tenantLogo: themeConfig?.logo,
          formatAmount,
          documentType: 'order',
          save: true,
        });
        const pdfFile = new File([blob], buildPdfFileName(['orden_de_venta', order.number || 'sin_numero']), { type: 'application/pdf' });
        const uploaded = await storageService.uploadFile('documents', pdfFile, { folder: 'ordenes-venta' });
        if (uploaded?.url) publicPdfUrl = uploaded.url;
      }
    } catch (error) {
      console.warn('No se pudo generar enlace seguro de la orden, usando modo estándar:', error);
    }

    const digits = phone.replace(/\D/g, '');
    const phoneWithCode = digits.length === 8 ? `505${digits}` : (digits.startsWith('505') ? digits : `505${digits}`);
    const totalFormatted = `${order.currency === 'USD' ? 'US$' : 'C$'}${formatSalesAmount(order.total)}`;
    let message = `Hola ${customer?.name || ''}, te compartimos la orden de venta ${order.number || ''} por un total de ${totalFormatted}.`;
    if (secureDocumentUrl) {
      message += `\n\nPodés consultar la orden de forma segura aquí:\n${secureDocumentUrl}`;
      if (securePortalUrl) message += `\n\nTambién podés consultar tu historial y saldo en el portal del cliente:\n${securePortalUrl}`;
    } else if (publicPdfUrl) {
      message += `\n\nPodés ver o descargar la orden en PDF desde este enlace:\n${publicPdfUrl}`;
    } else {
      message += ' Adjunto encontrarás el documento PDF con todos los detalles.';
    }

    window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(message)}`, '_blank');
    toast.success('¡Se abrió WhatsApp con la orden de venta preparada!', { id: preparingToastId });
  };

  const handleExportPDF = async (order: SalesOrder, format: PdfDownloadFormat = 'configured') => {
    const previewToastId = toast.loading('Preparando la previsualización de la orden de venta...');
    try {
      await previewSalesTransactionPDF({
        document: { ...order, customer: customers.find((customer) => customer.id === order.customerId) || order.customer },
        tenantName: user?.sessionBranding?.name || user?.tenantName || 'Empresa',
        formatAmount,
        tenantLogo: themeConfig?.logo,
        documentType: 'order',
        format,
      });
      toast.success('Previsualización abierta. Descargá el PDF desde el visor del navegador.', { id: previewToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo abrir la previsualización', { id: previewToastId });
    }
  };

  const buildOrderPanel = (order: SalesOrder): SalesDocumentPanelData => ({
    id: order.id,
    number: order.number,
    title: 'Orden de venta',
    customerName: order.customer?.name || customers.find((customer) => customer.id === order.customerId)?.name || 'Varios',
    status: String(order.status || ''),
    sourceLabel: order.estimateId ? 'Desde cotización' : undefined,
    totalLabel: formatConvertedAmount(Number(order.total || 0), order.currency, order.exchangeRate),
    sourceCurrency: order.currency,
    sourceExchangeRate: order.exchangeRate,
    summaryDetails: [
      { label: 'Moneda', value: order.currency || 'NIO' },
      { label: 'Líneas', value: String(order.items?.length || 0) },
      ...normalizeSalesExtraCharges(order)
        .filter((charge) => charge.amount > 0)
        .map((charge, index) => ({ label: charge.description || `Coste extra ${index + 1}`, value: formatConvertedAmount(charge.amount, order.currency, order.exchangeRate) })),
      ...(Number(order.deliveryAmount || 0) > 0 ? [{ label: order.deliveryDescription || 'Delivery', value: formatConvertedAmount(Number(order.deliveryAmount), order.currency, order.exchangeRate) }] : []),
    ],
    metadata: [
      { label: 'Fecha', value: formatDateEs(order.date) },
      { label: 'Entrega estimada', value: order.expectedDelivery ? formatDateEs(order.expectedDelivery) : 'No definida' },
      ...(order.invoiceNumber ? [{ label: 'Factura relacionada', value: order.invoiceNumber }] : []),
    ],
    lines: (order.items || []).map((item) => ({
      id: item.id,
      description: item.description,
      ...getSalesLineIdentifiers(item, products),
      secondaryLabel: item.commercialNoteSnapshot ? `Nota: ${item.commercialNoteSnapshot}` : undefined,
      quantity: Number(item.quantity || 0),
      unitPriceLabel: formatConvertedAmount(Number(item.unitPrice || 0), order.currency, order.exchangeRate),
      totalLabel: formatConvertedAmount(Number(item.total || 0), order.currency, order.exchangeRate),
    })),
    notes: order.notes,
  });

  useEffect(() => {
    if (!targetOrderId) return;
    const timer = setTimeout(() => {
      if (data.some((order) => order.id === targetOrderId)) {
        setEditingId(targetOrderId);
        onClearTargetOrderId?.();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [targetOrderId, data, onClearTargetOrderId]);

  const filtered = data.filter((order) => {
    const status = normalizeOrderStatus(order.status);
    const matchesStatus = statusFilter === 'ALL' || status === statusFilter;
    const search = searchTerm.trim().toLowerCase();
    const matchesSearch = !search
      || String(order.number || '').toLowerCase().includes(search)
      || String(order.customer?.name || '').toLowerCase().includes(search);
    return matchesStatus && matchesSearch;
  });

  const getDocumentNumber = (value: unknown) => {
    const match = String(value || '').match(/(\d+)(?!.*\d)/);
    return match ? Number(match[1]) : Number.NEGATIVE_INFINITY;
  };
  const statusOrdered = [...filtered].sort((a, b) => {
    const numberDifference = getDocumentNumber(b.number) - getDocumentNumber(a.number);
    if (Number.isFinite(numberDifference) && numberDifference !== 0) return numberDifference;
    return new Date(b.createdAt || b.date || 0).getTime() - new Date(a.createdAt || a.date || 0).getTime();
  });

  const colFilters = useColumnFilters();
  const filterGetters = {
    number: (row: SalesOrder) => row.number || '',
    customer: (row: SalesOrder) => row.customer?.name || 'Varios',
    total: (row: SalesOrder) => Number(row.total || 0),
    date: (row: SalesOrder) => (row.date ? new Date(row.date).getTime() : null),
    invoicedAt: (row: SalesOrder) => (row.invoicedAt ? new Date(row.invoicedAt).getTime() : null),
  };
  const filteredData = colFilters.applyTo(statusOrdered, filterGetters);
  const distinctCustomers = [...new Map(filtered.map((o) => [o.customer?.name || 'Varios', o.customer?.name || 'Varios'])).entries()]
    .map(([, label]) => ({ value: label, label, count: filtered.filter((o) => (o.customer?.name || 'Varios') === label).length }));

  const handleUpdate = async (id: string | number, updates: Partial<SalesOrder>) => {
    try {
      if (String(id).startsWith('local-')) {
        const baseDoc = localDocRef.current?.id === String(id) ? localDocRef.current : localDoc;
        if (!baseDoc) return;
        commitLocalDoc({ ...baseDoc, ...updates, items: updates.items ?? baseDoc.items } as SalesOrder);
        return;
      }
      await salesOrdersService.update(id.toString(), updates);
      onRefresh();
    } catch (error: any) {
       const msg = error.response?.data?.message;
       toast.error(`Error al actualizar status: ${Array.isArray(msg) ? msg.join(', ') : (msg || error.message)}`);
       throw error;
    }
  };

  const buildOrderStatusPayload = (status: OrderWorkflowStatus) => ({
    number: localDoc?.number,
    customerId: localDoc?.customerId || null,
    sellerEmployeeId: localDoc?.sellerEmployeeId || null,
    commissionType: localDoc?.commissionType,
    commissionRate: localDoc?.commissionRate || 0,
    commissionAmount: localDoc?.commissionAmount || 0,
    extraCostDescription: localDoc?.extraCostDescription || null,
    extraCostAmount: localDoc?.extraCostAmount || 0,
    extraCharges: getSalesExtraChargesPayload(localDoc),
    deliveryDescription: localDoc?.deliveryDescription || null,
    deliveryAmount: localDoc?.deliveryAmount || 0,
    priceListId: localDoc?.priceListId || null,
    date: localDoc?.date,
    expectedDelivery: localDoc?.expectedDelivery || null,
    subtotal: localDoc?.subtotal,
    taxAmount: localDoc?.taxAmount,
    discountAmount: localDoc?.discountAmount,
    irRate: 0,
    irTaxId: null,
    irAmount: 0,
    total: localDoc?.total,
    currency: localDoc?.currency,
    exchangeRate: localDoc?.exchangeRate,
    baseTotal: localDoc?.baseTotal,
    warehouseId: localDoc?.warehouseId || null,
    notes: localDoc?.notes,
    paymentMethod: localDoc?.paymentMethod || null,
    items: localDoc?.items || [],
    status,
  } as Partial<SalesOrder>);

  const handleSaveOrder = async (status: OrderWorkflowStatus): Promise<boolean> => {
    if (!localDoc) return false;
    if (savingOrderRef.current) return false;
    if (status !== 'DRAFT') {
      const workflowIssues = getOrderWorkflowIssues(localDoc);
      if (workflowIssues.length) {
        toast.error(`No se puede ${status === 'APPROVED' ? 'aprobar' : 'marcar en proceso'} la orden. Faltan o están incompletos: ${workflowIssues.join('; ')}.`);
        return false;
      }
      const priceMessage = getMissingSalesPriceMessage(localDoc.items || []);
      if (priceMessage) {
        toast.error(priceMessage);
        return false;
      }
      for (const item of localDoc.items || []) {
        if (resolveItemType(item) !== 'SERVICE') continue;
        const p = findProductForItem(item);
        if (p && p.isActive === false) {
          toast.error(`El servicio ${p.name || item.description || ''} no está disponible`);
          return false;
        }
      }
    }
    const saveToastId = toast.loading(
      status === 'APPROVED' ? 'Aprobando orden de venta...' : status === 'IN_PROCESS' ? 'Marcando orden en proceso...' : 'Guardando orden de venta...',
    );
    savingOrderRef.current = true;
    try {
      if (String(localDoc.id).startsWith('local-')) {
        const created = await salesOrdersService.create({ ...buildOrderStatusPayload(status), number: undefined } as any);
        commitLocalDoc(created);
        await onRefresh();
      } else {
        await handleUpdate(localDoc.id, buildOrderStatusPayload(status));
      }
      clearSalesEditorDraft(salesDraftStorageKey);
      localDocRef.current = null;
      setEditingId(null);
      toast.success(
        status === 'APPROVED' ? 'Orden aprobada' : status === 'IN_PROCESS' ? 'Orden marcada en proceso' : 'Orden guardada como borrador',
        { id: saveToastId },
      );
      return true;
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo guardar la orden de venta', { id: saveToastId });
      return false;
    } finally {
      savingOrderRef.current = false;
    }
  };

  const handleSaveCurrentOrder = () => {
    const currentStatus = normalizeOrderStatus(localDoc?.status);
    return handleSaveOrder(currentStatus === 'DRAFT' ? 'DRAFT' : 'IN_PROCESS');
  };

  const calculateRates = (doc: any) => {
    const sub = Number(doc?.subtotal || 0);
    if (sub === 0) return { dRate: 0, tRate: 0 };
    const dAmount = Number(doc?.discountAmount || 0);
    const dRate = (dAmount / sub) * 100;
    const base = sub - dAmount;
    const tAmount = Number(doc?.taxAmount || 0);
    const tRate = base > 0 ? (tAmount / base) * 100 : 0;
    return { dRate: Math.round(dRate * 100) / 100, tRate: Math.round(tRate * 100) / 100 };
  };

  const additionalChargesTotal = (doc: any = localDoc) => getSalesExtraChargesAmount(doc) + Math.max(0, Number(doc?.deliveryAmount || 0));

  const updateExtraCharges = (charges: SalesExtraChargeLine[]) => {
    if (!localDoc) return;
    const payload = getSalesExtraChargesPayload({ extraCharges: charges });
    const legacyFields = getLegacySalesExtraCostFields(payload);
    const nextDoc = { ...localDoc, extraCharges: charges, ...legacyFields } as SalesOrder;
    const baseTotal = Number(localDoc.total || 0) - additionalChargesTotal(localDoc);
    const total = baseTotal + additionalChargesTotal(nextDoc);
    setLocalDoc({ ...nextDoc, total });
    void handleUpdate(localDoc.id, { extraCharges: payload, ...legacyFields, total } as Partial<SalesOrder>);
  };

  const editExtraChargeDescription = (index: number, description: string) => {
    if (!localDoc) return;
    setLocalDoc({
      ...localDoc,
      extraCharges: normalizeSalesExtraCharges(localDoc).map((item, itemIndex) => itemIndex === index ? { ...item, description } : item),
    });
  };

  const persistExtraCharges = () => {
    if (localDoc) updateExtraCharges(normalizeSalesExtraCharges(localDoc));
  };

  const updateDelivery = (updates: Record<string, unknown>) => {
    if (!localDoc) return;
    const nextDoc = { ...localDoc, ...updates } as SalesOrder;
    const baseTotal = Number(localDoc.total || 0) - additionalChargesTotal(localDoc);
    const total = baseTotal + additionalChargesTotal(nextDoc);
    setLocalDoc({ ...nextDoc, total });
    void handleUpdate(localDoc.id, { ...updates, total } as Partial<SalesOrder>);
  };

  const recalculateIndividualPricing = (items: any[]) => {
    const pricedItems = items.map((line) => {
      const gross = Number(line.quantity || 0) * Number(line.unitPrice || 0);
      const discount = gross * (Number(line.discount || 0) / 100);
      const taxable = gross - discount;
      const tax = taxable * (Number(line.taxRate || 0) / 100);
      return { ...line, total: taxable + tax };
    });
    const subtotal = pricedItems.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);
    const discountAmount = pricedItems.reduce((sum, line) => sum + (Number(line.quantity || 0) * Number(line.unitPrice || 0) * Number(line.discount || 0) / 100), 0);
    const taxAmount = pricedItems.reduce((sum, line) => {
      const gross = Number(line.quantity || 0) * Number(line.unitPrice || 0);
      return sum + ((gross - gross * Number(line.discount || 0) / 100) * Number(line.taxRate || 0) / 100);
    }, 0);
    return { items: pricedItems, subtotal, discountAmount, taxAmount, total: subtotal - discountAmount + taxAmount + additionalChargesTotal() };
  };

  const recalculateGlobalPricing = (items: any[]) => {
    const normalizedItems = items.map((line: any) => ({ ...line, total: Number(line.quantity || 0) * Number(line.unitPrice || 0) }));
    const subtotal = normalizedItems.reduce((sum: number, line: any) => sum + Number(line.total || 0), 0);
    const discountAmount = subtotal * (Number(localRates.dRate || 0) / 100);
    const base = subtotal - discountAmount;
    const taxAmount = base * (Number(localRates.tRate || 0) / 100);
    return { items: normalizedItems, subtotal, discountAmount, taxAmount, total: base + taxAmount + additionalChargesTotal() };
  };


  const formatNumber2 = (value: number) => formatSalesAmount(value);
  const priceInCurrency = (basePrice: number, currency: string, rate: number) => currency === 'USD' ? basePrice / (rate || 1) : basePrice;

  useEffect(() => {
    if (!draftHydrated) return;
    const timer = setTimeout(() => {
      if (editingId) {
        const localSnapshot = localDocRef.current?.id === editingId ? localDocRef.current : null;
        if (localSnapshot) {
          commitLocalDoc(localSnapshot);
        } else {
          const e = data.find(x => x.id === editingId);
          if (e) {
            const cloned = JSON.parse(JSON.stringify(e)) as SalesOrder;
            commitLocalDoc(cloned);
            setLocalRates(calculateRates(e));
            setPricingMode((e.items || []).some((line: any) => Number(line.discount || 0) !== 0 || Number(line.taxRate || 0) !== 0) ? 'individual' : 'global');
          }
        }
      } else {
        localDocRef.current = null;
        commitLocalDoc(null);
        setLocalRates({ dRate: 0, tRate: 0 });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [draftHydrated, editingId, data]);

  const handleAddOrder = () => {
    const draft = { id: `local-${Date.now()}`, number: '', customerId: '', sellerEmployeeId: getLoggedInSellerEmployeeId(user) || undefined, date: new Date().toISOString(), expectedDelivery: new Date(Date.now() + 7 * 86400000).toISOString(), discountAmount: 0, extraCostDescription: null, extraCostAmount: 0, extraCharges: [], deliveryDescription: null, deliveryAmount: 0, total: 0, subtotal: 0, taxAmount: 0, currency: displayCurrency as any, exchangeRate: globalRate, status: 'DRAFT', items: [], warehouseId: undefined } as any as SalesOrder;
    commitLocalDoc(draft);
    setLocalRates({ dRate: 0, tRate: 0 });
    setPricingMode('global');
    setEditingId(draft.id);
  };

  const columns: ColumnDef<SalesOrder>[] = [
    { 
      key: 'number', 
      header: 'N° Orden',
      width: '200px',
      headerExtra: <ColumnFilterMenu label="N° Orden" sort={colFilters.state.number?.sort || null} onSort={(sort) => colFilters.setSort('number', sort)} />,
      render: (val, row) => (
        <div className="flex min-w-0 flex-col items-start gap-1">
          <span 
            className={cn(
              "text-xs font-black font-mono text-primary",
              canPerform('SALES_ORDERS', 'edit') ? "cursor-pointer hover:underline" : "cursor-default"
            )} 
            onClick={() => setDetailOrder(row)}
          >
            {val}
          </span>
          {(() => {
            const source = getSalesOrderOriginBadge(row);
            return source ? <Badge className={cn('max-w-full rounded-md whitespace-normal break-words text-left leading-tight border-none px-1.5 py-0 text-[8px] font-black', source.className)}>{source.label}</Badge> : null;
          })()}
        </div>
      )
    },
    { 
      key: 'customer', 
      header: 'Cliente', 
      headerExtra: <ColumnFilterMenu label="Cliente" options={distinctCustomers} selected={colFilters.state.customer?.values || []} onSelect={(values) => colFilters.setValues('customer', values)} sort={colFilters.state.customer?.sort || null} onSort={(sort) => colFilters.setSort('customer', sort)} />,
      render: (_val, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Varios'}</span>
    },
    { 
      key: 'itemCount', 
      header: 'Items', 
      width: '100px',
      render: (_val, row) => <span className="text-xs font-medium text-muted-foreground">{row.items?.length || 0} art.</span>
    },
    { 
      key: 'total', 
      header: 'Monto Total', 
      width: '150px',
      headerExtra: <ColumnFilterMenu label="Monto Total" sort={colFilters.state.total?.sort || null} onSort={(sort) => colFilters.setSort('total', sort)} />,
      render: (val, row) => (
        <span className="text-[13px] font-black tabular-nums text-emerald-500">
          {formatConvertedAmount(Number(val || 0), row.currency, row.exchangeRate)}
        </span>
      )
    },
    { 
      key: 'status', 
      header: 'Estado', 
      width: '135px',
      editable: false,
      render: (val) => {
        const normalizedStatus = normalizeOrderStatus(val);
        const opt = statusOptions.find(o => o.value === normalizedStatus);
        return (
          <Badge variant="outline" className={cn(
            "whitespace-nowrap text-[9px] font-black uppercase tracking-wider px-2 py-0.5 border-none shadow-none",
            opt?.color || 'bg-muted/20 text-muted-foreground'
          )}>
            {opt?.label || normalizedStatus || val}
          </Badge>
        );
      }
    },
    { 
      key: 'date', 
      header: 'Fecha Compromiso', 
      headerExtra: <ColumnFilterMenu label="Fecha Compromiso" sort={colFilters.state.date?.sort || null} onSort={(sort) => colFilters.setSort('date', sort)} sortOptions={[{ value: 'desc', label: 'Más recientes' }, { value: 'asc', label: 'Más antiguas' }]} />,
      render: (val) => (
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
           <Clock className="size-3" />
           {formatDateEs(val)}
        </div>
      )
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
    { key: 'invoiceNumber', header: 'Factura relacionada', render: (val, row) => <span className="text-xs font-mono font-bold text-primary">{val || row.invoiceId || '—'}</span> },
    { key: 'invoicedAt', header: 'Fecha facturación', headerExtra: <ColumnFilterMenu label="Fecha facturación" sort={colFilters.state.invoicedAt?.sort || null} onSort={(sort) => colFilters.setSort('invoicedAt', sort)} sortOptions={[{ value: 'desc', label: 'Más recientes' }, { value: 'asc', label: 'Más antiguas' }]} />, render: (val) => <span className="text-xs text-muted-foreground">{val ? formatDateEs(val) : '—'}</span> },
    { key: 'invoicedBy', header: 'Facturado por', render: (_val, row) => <span className="text-xs text-muted-foreground">{row.invoicedBy?.name || '—'}</span> },
    { key: 'paymentNumber', header: 'Pago relacionado', render: (val, row) => <span className="text-xs font-mono font-bold text-emerald-500">{val || (row.invoiceId ? 'Pendiente' : '—')}</span> },
    { key: 'paymentDate', header: 'Fecha pago', render: (val) => <span className="text-xs text-muted-foreground">{val ? formatDateEs(val) : '—'}</span> },
    {
      key: 'paymentStatus',
      header: 'Estado pago',
      render: (val, row) => {
        const status = String(val || '').toUpperCase();
        const labels: Record<string, string> = { PAID: 'Pagada', PARTIAL: 'Parcial', PENDING: 'Pendiente', OVERDUE: 'Vencida' };
        return row.invoiceId ? (
          <Badge variant="outline" className={cn(
            'whitespace-nowrap border-none px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-none',
            getSalesStatusColor(status),
          )}>
            {labels[status] || status || 'Pendiente'}
          </Badge>
        ) : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
  ];

  const visibleColumns = columns.filter((column) => visibleColumnKeys.includes(String(column.key)));
  const columnOptions = [
    { key: 'number', label: 'N° Orden' },
    { key: 'customer', label: 'Cliente' },
    { key: 'itemCount', label: 'Artículos' },
    { key: 'total', label: 'Monto total' },
    { key: 'status', label: 'Estado de la orden' },
    { key: 'date', label: 'Fecha compromiso' },
    { key: 'paymentMethod', label: 'Forma de pago' },
    { key: 'invoiceNumber', label: 'Factura relacionada' },
    { key: 'invoicedAt', label: 'Fecha facturación' },
    { key: 'invoicedBy', label: 'Facturado por' },
    { key: 'paymentNumber', label: 'Pago relacionado' },
    { key: 'paymentDate', label: 'Fecha de pago' },
    { key: 'paymentStatus', label: 'Estado de pago' },
  ];

  const approvedAmountInDisplayCurrency = data
    .filter(order => normalizeOrderStatus(order.status) === 'APPROVED')
    // `total` + la tasa histórica son la fuente de verdad. `baseTotal` puede
    // pertenecer a registros antiguos que quedaron desfasados.
    .reduce((acc, order) => acc + toBaseAmount(order.total || 0, order.currency, order.exchangeRate), 0);
  const originalApprovedAmounts = summarizeAmountsByCurrency(
    data.filter(order => normalizeOrderStatus(order.status) === 'APPROVED'),
    (order) => Number(order.total || 0),
    (order) => order.currency,
    baseCurrency,
  );

  if (editingId && localDoc) {
    return (
      <div className="sales-document-editor min-w-0 space-y-6 animate-in slide-in-from-right duration-300" data-tour="sales-form-title">
        <div className="sales-document-header flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
            <Button variant="ghost" size="icon" onClick={() => { clearSalesEditorDraft(salesDraftStorageKey); localDocRef.current = null; setEditingId(null); }} className="shrink-0 rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div className="min-w-0">
              <h2 className="text-xl font-black uppercase tracking-tight">{String(localDoc?.id).startsWith('local-') ? 'Nueva Orden' : `Orden ${localDoc?.number}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Detalle de la orden de venta</p>
            </div>
          </div>
          <div className="sales-document-actions flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end" data-tour="sales-form-actions">
            <SalesViewTutorial view="orders" context="form" />
            {canPerform('SALES_ORDERS', 'edit') && !['APPROVED', 'CANCELLED'].includes(normalizeOrderStatus(localDoc?.status)) && (
              <>
                {normalizeOrderStatus(localDoc?.status) === 'DRAFT' && <>
                  <Button variant="outline" className="w-full rounded-xl border-border/50 px-6 font-black uppercase text-[10px] tracking-widest hover:bg-muted/70 hover:text-foreground sm:w-auto"
                    onClick={() => void handleSaveOrder('DRAFT')}>
                    Guardar Borrador
                  </Button>
                  <Button className="w-full rounded-xl bg-primary px-6 font-black uppercase text-[10px] tracking-widest text-primary-foreground shadow-xl shadow-primary/20 hover:bg-primary/90 hover:text-primary-foreground sm:w-auto"
                    onClick={() => void handleSaveOrder('IN_PROCESS')}>
                    Guardar
                  </Button>
                </>}
                {normalizeOrderStatus(localDoc?.status) === 'IN_PROCESS' && <Button variant="default" className="w-full rounded-xl bg-primary px-6 font-black uppercase text-[10px] tracking-widest text-primary-foreground shadow-xl shadow-primary/20 hover:bg-primary/90 hover:text-primary-foreground sm:w-auto"
                  onClick={() => void handleSaveCurrentOrder()}>
                  Guardar
                </Button>}
              </>
            )}
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="rounded-2xl border-border/50" data-tour="sales-form-data">
            <CardContent className="min-w-0 space-y-3 p-4 sm:p-6">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
              <SalesAccountingLegend flow="order" />
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Cliente</p>
                  <Combobox
                    options={(customers || [])
                      .filter(c => (c.status || '').toUpperCase() === 'ACTIVE' || c.id === localDoc?.customerId)
                      .map(c => ({ label: c.name, value: c.id, description: (c.code ? `[${c.code}] ` : '') + (c.phone || 'Sin teléfono') }))}
                    value={localDoc?.customerId || ''}
                    onChange={(val) => {
                      const customer = customers.find((entry) => entry.id === val);
                      const priceListId = customer?.priceListId || null;
                      const items = (localDoc?.items || []).map((item: any) => item.productId
                        ? { ...item, priceListId, unitPrice: 0, total: 0, priceMissing: false }
                        : { ...item, priceListId });
                      if (hasSalesProductPriceListConflicts(items, priceListId)) {
                        toast.error('No se puede aplicar esta lista: hay productos repetidos con la misma lista de precios.');
                        return;
                      }
                      setLocalDoc({ ...localDoc, customerId: val, priceListId, items } as any);
                      void handleUpdate(localDoc!.id, { customerId: val, priceListId, items } as any);
                    }}
                    placeholder="Seleccionar Cliente"
                  />
                </div>
                <SalesWarehouseSelect
                  warehouses={warehouses}
                  value={localDoc?.warehouseId}
                  onChange={(warehouseId) => {
                    setLocalDoc({ ...localDoc, warehouseId } as any);
                    void handleUpdate(localDoc!.id, { warehouseId } as any);
                  }}
                  required={['IN_PROCESS', 'APPROVED'].includes(normalizeOrderStatus(localDoc?.status))}
                  helpText="La orden y la factura usarán esta bodega de salida."
                />
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Vendedor</p>
                  <Combobox
                    options={employees.map((employee) => ({ label: `${employee.firstName} ${employee.lastName}`, value: employee.id }))}
                    value={localDoc?.sellerEmployeeId || ''}
                    onChange={(val) => { setLocalDoc({ ...localDoc, sellerEmployeeId: val }); void handleUpdate(localDoc!.id, { sellerEmployeeId: val }); }}
                    placeholder="Seleccionar vendedor"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Tipo de comisión</p>
                  <Select
                    value={localDoc?.commissionType || 'PERCENTAGE'}
                    disabled={!localDoc?.sellerEmployeeId}
                    onValueChange={(commissionType) => {
                      const nextType = commissionType as 'PERCENTAGE' | 'FIXED';
                      const updates = nextType === 'FIXED'
                        ? { commissionType: nextType, commissionRate: 0 }
                        : { commissionType: nextType, commissionAmount: 0 };
                      setLocalDoc({ ...localDoc, ...updates } as any);
                      void handleUpdate(localDoc!.id, updates as any);
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
                    disabled={!localDoc?.sellerEmployeeId}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setLocalDoc({ ...localDoc, ...(localDoc?.commissionType === 'FIXED' ? { commissionAmount: value } : { commissionRate: value }) } as any);
                    }}
                    onBlur={() => {
                      if (!localDoc?.sellerEmployeeId) return;
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
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha Emisión</p>
                  <Input type="date" defaultValue={localDoc?.date ? new Date(localDoc.date).toISOString().split('T')[0] : ''} onBlur={(e) => handleUpdate(localDoc!.id, { date: new Date(e.target.value).toISOString() })} className="h-8 text-xs" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Entrega Esperada</p>
                  <Input type="date" defaultValue={localDoc?.expectedDelivery ? new Date(localDoc.expectedDelivery).toISOString().split('T')[0] : ''} onBlur={(e) => handleUpdate(localDoc!.id, { expectedDelivery: new Date(e.target.value).toISOString() })} className="h-8 text-xs" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Moneda de la transacción</p>
                  <Select
                    value={localDoc?.currency || 'NIO'}
                    onValueChange={(currency) => {
                      const exchangeRate = currency === 'NIO' ? 1 : Number(globalRate || 1);
                      const previousCurrency = localDoc?.currency || 'NIO';
                      const previousRate = previousCurrency === 'NIO' ? 1 : Number(localDoc?.exchangeRate || globalRate || 1);
                      const convertedItems = (localDoc?.items || []).map((line: any) => {
                        const basePrice = previousCurrency === 'USD' ? Number(line.unitPrice || 0) * previousRate : Number(line.unitPrice || 0);
                        const unitPrice = priceInCurrency(basePrice, currency, exchangeRate);
                        return { ...line, unitPrice, total: Number(line.quantity || 0) * unitPrice };
                      });
                      const recalculated = pricingMode === 'individual'
                        ? recalculateIndividualPricing(convertedItems)
                        : (() => {
                            const subtotal = convertedItems.reduce((sum: number, line: any) => sum + Number(line.total || 0), 0);
                            const discountAmount = subtotal * (localRates.dRate / 100);
                            const base = subtotal - discountAmount;
                            const taxAmount = base * (localRates.tRate / 100);
                            return { items: convertedItems, subtotal, discountAmount, taxAmount, total: base + taxAmount + additionalChargesTotal() };
                          })();
                      setLocalDoc({ ...localDoc, currency, exchangeRate, ...recalculated } as any);
                      void handleUpdate(localDoc!.id, { currency, exchangeRate, ...recalculated } as any);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar moneda" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NIO">Córdobas (C$)</SelectItem>
                      <SelectItem value="USD">Dólares (US$)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[10px] text-muted-foreground/70">
                    Tasa de cambio configurada: <span className="font-bold">{formatNumber2(Number(localDoc?.currency === 'NIO' ? 1 : localDoc?.exchangeRate || globalRate || 1))}</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Forma de pago</p>
                  <Select
                    value={localDoc?.paymentMethod || ''}
                    onValueChange={(paymentMethod) => {
                      setLocalDoc({ ...localDoc, paymentMethod } as any);
                      void handleUpdate(localDoc!.id, { paymentMethod } as Partial<SalesOrder>);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar forma de pago" /></SelectTrigger>
                    <SelectContent>
                      {paymentMethodOptions.map((method) => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/50" data-tour="sales-form-summary">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumen Financiero</p>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-muted/10 p-2 text-[10px] font-black uppercase tracking-widest">
                <span className="text-muted-foreground">Aplicar impuestos/descuentos:</span>
                <Button type="button" size="sm" variant={pricingMode === 'global' ? 'default' : 'outline'} className="h-7 rounded-lg px-2 text-[10px]" onClick={() => {
                  const items = (localDoc.items || []).map((line: any) => ({ ...line, taxRate: 0, discount: 0, irRate: 0, irTaxId: null, irAmount: 0 }));
                  const recalculated = recalculateGlobalPricing(items);
                  setPricingMode('global');
                  setLocalDoc({ ...localDoc, ...recalculated } as any);
                  void handleUpdate(localDoc.id, recalculated as any);
                }}>Global</Button>
                <Button type="button" size="sm" variant={pricingMode === 'individual' ? 'default' : 'outline'} className="h-7 rounded-lg px-2 text-[10px]" onClick={() => { setPricingMode('individual'); setLocalRates({ dRate: 0, tRate: 0 }); }}>Por producto</Button>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <div className="flex min-w-[9rem] items-center justify-end gap-2"><span className="w-8 shrink-0 text-right text-xs font-black">{localDoc?.currency === 'USD' ? '$' : 'C$'}</span><Input type="text" value={formatSalesAmount(localDoc?.subtotal)} readOnly className="w-28 h-8 text-right font-bold tabular-nums bg-muted/20" /></div>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Descuento</span>
                  <div className="flex items-center gap-2 text-rose-500">
                    <div className="flex items-center mr-2">{pricingMode === 'global' ? <Input type="number" min="0" max="100" value={localRates.dRate || ''} placeholder="0" onChange={(e) => {
                      const newRate = Number(e.target.value);
                      const dAmount = Number(localDoc?.subtotal||0) * (newRate / 100);
                      const base = Number(localDoc?.subtotal||0) - dAmount;
                      const tAmount = base * (localRates.tRate / 100);
                      const newTotal = base + tAmount + additionalChargesTotal();
                      setLocalRates(prev => ({ ...prev, dRate: newRate }));
                      setLocalDoc({ ...localDoc, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                    }} onBlur={(e) => {
                      const newRate = Number(e.target.value);
                      const dAmount = Number(localDoc?.subtotal||0) * (newRate / 100);
                      const base = Number(localDoc?.subtotal||0) - dAmount;
                      const tAmount = base * (localRates.tRate / 100);
                      const newTotal = base + tAmount + additionalChargesTotal();
                      handleUpdate(localDoc!.id, { discountAmount: dAmount, taxAmount: tAmount, total: newTotal });
                    }} className="w-16 h-8 text-right font-bold text-rose-500 bg-transparent" /> : null} {pricingMode === 'global' && <span className="ml-1 text-xs font-black">%</span>}</div>
                    <span className="min-w-[7.5rem] text-right tabular-nums">-{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatNumber2(Number(localDoc?.discountAmount || 0))}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Impuesto (IVA)</span>
                  <div className="flex items-center gap-2">
                    {pricingMode === 'global' ? (
                      <label className="flex h-8 items-center gap-1.5 rounded-md bg-muted/30 px-2 text-xs font-black">
                        <input
                          type="checkbox"
                          checked={Number(localRates.tRate || 0) > 0}
                          onChange={(e) => {
                            const newRate = e.target.checked ? 15 : 0;
                            const dAmount = Number(localDoc?.subtotal || 0) * (localRates.dRate / 100);
                            const base = Number(localDoc?.subtotal || 0) - dAmount;
                            const tAmount = base * (newRate / 100);
                            const newTotal = base + tAmount + additionalChargesTotal();
                            setLocalRates(prev => ({ ...prev, tRate: newRate }));
                            setLocalDoc({ ...localDoc, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                            void handleUpdate(localDoc!.id, { discountAmount: dAmount, taxAmount: tAmount, total: newTotal });
                          }}
                        />
                        Aplicar
                      </label>
                    ) : null}
                    <span className="min-w-[7.5rem] text-right text-xs font-black tabular-nums">{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatNumber2(Number(localDoc?.taxAmount || 0))}</span>
                  </div>
                </div>
                {normalizeSalesExtraCharges(localDoc).filter((charge) => charge.amount > 0).map((charge, index) => <div key={charge.id} className="flex justify-between items-center text-sm"><span className="text-muted-foreground">{charge.description || `Coste extra ${index + 1}`}</span><span className="font-mono">{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatNumber2(charge.amount)}</span></div>)}
                {Number(localDoc?.deliveryAmount || 0) > 0 && <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">{localDoc?.deliveryDescription || 'Delivery'}</span><span className="font-mono">{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatNumber2(Number(localDoc?.deliveryAmount || 0))}</span></div>}
                <div className="flex justify-between items-center text-base border-t pt-3 border-border/50">
                  <span className="font-black">Total</span>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2 text-primary font-black">
                      {localDoc?.currency === 'USD' ? '$' : 'C$'} 
                      <Input type="text" value={formatSalesAmount(localDoc?.total)} readOnly className="w-28 h-8 text-right font-black tabular-nums text-primary bg-muted/20" />
                    </div>
                    {localDoc?.currency === 'USD' && (
                      <p className="text-[10px] font-bold text-muted-foreground mt-1 italic">
                        ≈ C$ {formatNumber2(Number(localDoc?.total || 0) * (localDoc?.exchangeRate || globalRate))}
                      </p>
                    )}
                    {localDoc?.currency === 'NIO' && (
                      <p className="text-[10px] font-bold text-muted-foreground mt-1 italic">
                        ≈ $ {formatNumber2(Number(localDoc?.total || 0) / (localDoc?.exchangeRate || globalRate))}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- PRODUCT LINE ITEMS --- */}
        <Card className="rounded-2xl border-border/50" data-tour="sales-form-items">
          <CardContent className="min-w-0 p-4 sm:p-6">
            <div className="flex min-w-0 flex-col items-stretch justify-between gap-3 mb-4 sm:flex-row sm:items-center">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Productos / Servicios</p>
              <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                {(['PRODUCT', 'SERVICE'] as const).map((itemType) => <Button key={itemType} type="button" variant="outline" size="sm" onClick={() => {
                  const newItems = [...(localDoc.items || []), { id: Date.now().toString(), itemType, productId: '', description: '', quantity: 1, unitPrice: 0, total: 0 }] as any[];
                  setLocalDoc({ ...localDoc, items: newItems } as any);
                }} className="h-8 w-full rounded-xl text-[10px] font-black uppercase tracking-widest sm:w-auto"><Plus className="size-3 mr-2" /> Agregar {itemType === 'PRODUCT' ? 'Producto' : 'Servicio'}</Button>)}
                <Button type="button" variant="outline" size="sm" disabled={!localDoc?.customerId} onClick={() => updateExtraCharges([...normalizeSalesExtraCharges(localDoc), { id: `extra-${Date.now()}`, description: '', amount: 0 }])} className="h-8 w-full rounded-xl text-[10px] font-black uppercase tracking-widest sm:w-auto">
                  <Plus className="size-3 mr-2" /> Agregar coste extra
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={!localDoc?.customerId || Boolean(localDoc?.deliveryDescription) || Number(localDoc?.deliveryAmount || 0) > 0} title={localDoc?.deliveryDescription || Number(localDoc?.deliveryAmount || 0) > 0 ? 'Solo se permite un delivery por orden de venta' : undefined} onClick={() => updateDelivery({ deliveryDescription: 'Delivery', deliveryAmount: 0 })} className="h-8 w-full rounded-xl text-[10px] font-black uppercase tracking-widest sm:w-auto">
                  <Plus className="size-3 mr-2" /> Agregar delivery
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="hidden xl:grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                <div className={cn('sales-line-product-header col-span-6', pricingMode === 'individual' && 'xl:col-span-5', productHeaderColumnClass)}>
                  <span>Descripción</span>
                  {showVariantColumn && <span>Variante</span>}
                  {showPriceTypeColumn && <span>Tipo de precio</span>}
                </div>
                {pricingMode === 'individual' && <div className="col-span-2 grid grid-cols-2 gap-1.5">
                  <div>Aplicar</div>
                  <div className="text-right">Desc.</div>
                </div>}
                <div className={cn('col-span-2 text-right', pricingMode === 'individual' && 'xl:col-span-1')}>Cant.</div>
                <div className={cn('col-span-2 text-right', pricingMode === 'individual' && 'xl:col-span-1')}>Precio U.</div>
                {pricingMode === 'individual' && <div className="col-span-2 text-right xl:col-span-1">IVA</div>}
                <div className="col-span-2 text-right">Total</div>
              </div>
              {(localDoc.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} data-item-layout="standard" data-pricing-mode={pricingMode} className={cn('sales-item-row grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-border/50 bg-muted/5 p-3 items-start xl:grid-cols-12 xl:gap-2 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0', pricingMode === 'individual' && 'pricing-individual')}>
                  <div data-item-role="product-area" className={cn('min-w-0 xl:col-span-6', pricingMode === 'individual' && 'xl:col-span-5')}>
                    <div className="sales-line-product-fields">
                      <div data-item-role="product-picker" className="sales-line-product-picker min-w-0">
                        <Combobox 
                          options={getLineProductOptions(item)}
                          value={item.productId || ''}
                          onChange={(val) => {
                            const newItems = [...(localDoc.items || [])] as any[];
                            const selectedProd = (resolveItemType(item) === 'SERVICE' ? serviceCatalog : productCatalog).find(p => p.id === val);
                            const effectivePriceListId = newItems[idx].priceListId || localDoc.priceListId || null;
                            if (val && hasSalesProductPriceListConflict(newItems, val, effectivePriceListId, idx, localDoc.priceListId || null)) {
                              toast.error('Este producto ya está agregado con la misma lista de precios.');
                              return;
                            }
                            newItems[idx].productId = val;
                            newItems[idx].variantId = null;
                            newItems[idx].variantSku = null;
                            newItems[idx].variantName = null;
                            newItems[idx].variantAttributes = null;
                            if (selectedProd) {
                              newItems[idx].description = selectedProd.name;
                              newItems[idx].commercialNoteSnapshot = selectedProd.commercialNote || null;
                              const baseSalePrice = Number(selectedProd.salePrice ?? selectedProd.price ?? 0);
                              newItems[idx].unitPrice = priceInCurrency(baseSalePrice, localDoc?.currency || 'NIO', Number(localDoc?.exchangeRate || globalRate || 1));
                              newItems[idx].total = Number(newItems[idx].quantity) * Number(newItems[idx].unitPrice);
                            } else {
                              newItems[idx].description = 'Producto Customizado';
                              newItems[idx].commercialNoteSnapshot = null;
                              newItems[idx].unitPrice = 0;
                              newItems[idx].total = 0;
                            }
                            const newSubtotal = newItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
                            const dAmount = newSubtotal * (localRates.dRate / 100);
                            const base = newSubtotal - dAmount;
                            const tAmount = base * (localRates.tRate / 100);
                            const newTotal = base + tAmount + additionalChargesTotal();
                            setLocalDoc({ ...localDoc, items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                            void handleUpdate(localDoc!.id, { items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                          }}
                          placeholder={resolveItemType(item) === 'SERVICE' ? 'Seleccionar servicio...' : 'Seleccionar producto...'}
                          disabled={!localDoc?.customerId}
                        />
                      </div>
                      {String(resolveItemType(item)).toUpperCase() !== 'SERVICE' && (
                        <SalesVariantSelect
                          className="sales-line-variant"
                          product={products.find((product) => product.id === item.productId)}
                          value={item.variantId}
                          onChange={(variantId, variant) => setLocalDoc({
                            ...localDoc,
                            items: (localDoc.items || []).map((line: any, lineIndex: number) => lineIndex === idx
                              ? { ...line, variantId, variantSku: variant?.sku || null, variantName: variant?.name || null, variantAttributes: variant?.attributes || null }
                              : line),
                          } as any)}
                        />
                      )}
                      {item.productId && String(resolveItemType(item)).toUpperCase() !== 'SERVICE' && (
                        <SalesLinePriceListSelect
                          className="sales-line-price-list"
                          labelLayout="stacked"
                          productId={(productCatalog.find((product) => product.id === item.productId) || productCatalog.find((product) => String(product.name).trim() === String(item.description || '').trim()))?.id || item.productId}
                          variantId={item.variantId}
                          productCode={(productCatalog.find((product) => product.id === item.productId) || productCatalog.find((product) => String(product.name).trim() === String(item.description || '').trim()))?.code || item.code}
                          itemType={item.itemType}
                          value={item.priceListId}
                          defaultPriceListId={localDoc?.priceListId}
                          lineItems={localDoc?.items || []}
                          lineIndex={idx}
                          currency={localDoc?.currency}
                          exchangeRate={Number(localDoc?.exchangeRate || globalRate || 1)}
                          onChange={(priceListId, result) => {
                            const currentItem = localDoc?.items?.[idx];
                            // Guarda de idempotencia: no actualizar si el precio ya está aplicado
                            if (
                              currentItem &&
                              currentItem.priceListId === priceListId &&
                              Math.abs(Number(currentItem.unitPrice || 0) - Number(result.unitPrice || 0)) < 0.01 &&
                              !!currentItem.priceMissing === !!result.priceMissing
                            ) return;
                            const nextItems = [...(localDoc.items || [])] as any[];
                            nextItems[idx] = {
                              ...nextItems[idx],
                              productId: (productCatalog.find((product) => product.id === item.productId) || productCatalog.find((product) => String(product.name).trim() === String(item.description || '').trim()))?.id || nextItems[idx].productId,
                              priceListId,
                              unitPrice: result.unitPrice ?? 0,
                              total: Number(nextItems[idx].quantity || 1) * Number(result.unitPrice ?? 0),
                              priceMissing: result.priceMissing
                            };
                            const next = pricingMode === 'individual' ? recalculateIndividualPricing(nextItems) : recalculateGlobalPricing(nextItems);
                            // Solo actualiza estado local — sin handleUpdate para evitar el loop
                            // PATCH → onRefresh → deleteMany+create → IDs cambian → re-mount → loop
                            // El precio se persiste en el próximo save explícito (cantidad, guardar borrador, etc.)
                            setLocalDoc({ ...localDoc, ...next } as any);
                          }}
                        />
                      )}
                    </div>

                    {item.productId && (
                      <div className="mt-1 flex min-h-4 flex-wrap items-center gap-x-2 gap-y-1 px-1">
                        {(() => {
                          const p = products.find(x => x.id === item.productId);
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
                          const stock = getProductStockForSalesWarehouse(p, localDoc?.warehouseId, item.variantId);
                          return (
                            <>
                              <Badge variant="outline" className={cn(
                                "text-[9px] font-black border-none px-1.5 py-0 h-4 bg-muted/20",
                                stock <= 0 ? "text-rose-500 bg-rose-500/10" : "text-emerald-500 bg-emerald-500/10"
                              )}>
                                STOCK: {stock}
                              </Badge>
                              <SalesWarehouseStockHint
                                product={p}
                                warehouses={warehouses}
                                warehouseId={localDoc?.warehouseId}
                                variantId={item.variantId}
                                className="basis-full"
                              />
                              {item.priceMissing && <PriceMissingBadge />}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                  {pricingMode === 'individual' && (
                    <div className="col-span-2 mt-0 grid min-w-0 grid-cols-2 items-start gap-1.5 self-start text-[10px]">
                      <label className="relative flex min-w-0 flex-1 items-center font-black uppercase tracking-wider">
                        <span className="flex h-8 w-full items-center gap-1.5 rounded-md bg-muted/30 px-2">
                          <input
                            type="checkbox"
                            checked={Number(item.taxRate || 0) > 0}
                            onChange={(event) => {
                              const nextItems = [...(localDoc.items || [])] as any[];
                              nextItems[idx] = { ...nextItems[idx], taxRate: event.target.checked ? 15 : 0 };
                              const next = recalculateIndividualPricing(nextItems);
                              setLocalDoc({ ...localDoc, ...next } as any);
                              void handleUpdate(localDoc!.id, next as any);
                            }}
                          />
                          <span className="text-xs">IVA</span>
                        </span>
                      </label>
                      <label className="relative flex min-w-0 flex-1 items-center font-black uppercase tracking-wider">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discount || ''}
                          onChange={(event) => {
                            const nextItems = [...(localDoc.items || [])] as any[];
                            nextItems[idx] = { ...nextItems[idx], discount: Number(event.target.value) || 0 };
                            const next = recalculateIndividualPricing(nextItems);
                            setLocalDoc({ ...localDoc, ...next } as any);
                            void handleUpdate(localDoc!.id, next as any);
                          }}
                          className="w-full pr-6 text-left text-xs"
                        />
                        <span className="pointer-events-none absolute right-2 text-[10px] text-muted-foreground">%</span>
                      </label>
                    </div>
                  )}
                  <div className={cn('min-w-0 xl:col-span-2', pricingMode === 'individual' && 'xl:col-span-1')}>
                    <Input 
                      type="number" 
                      min="0"
                       max={resolveItemType(item) === 'SERVICE' ? 1000000 : (products.find(x => x.id === item.productId) ? getProductStockForSalesWarehouse(products.find(x => x.id === item.productId), localDoc?.warehouseId, item.variantId) : 1000000)}
                      value={Number(item.quantity) || ''} 
                      placeholder="0"
                      onChange={(e) => {
                        let newQty = Number(e.target.value);
                        const p = products.find(x => x.id === item.productId);
                        const availableStock = p && resolveItemType(item) !== 'SERVICE'
                          ? getProductStockForSalesWarehouse(p, localDoc?.warehouseId, item.variantId)
                          : undefined;
                        if (availableStock !== undefined && newQty > availableStock) {
                          toast.warning(`Stock insuficiente en la bodega seleccionada. Disponible: ${availableStock}`, { id: `stock-warn-${idx}` });
                          newQty = availableStock;
                        }
                        const newItems = [...(localDoc.items || [])] as any[];
                        newItems[idx].quantity = newQty;
                        newItems[idx].total = newQty * Number(newItems[idx].unitPrice || 0);
                        const newSubtotal = newItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
                        const dAmount = newSubtotal * (localRates.dRate / 100);
                        const base = newSubtotal - dAmount;
                        const tAmount = base * (localRates.tRate / 100);
                        const newTotal = base + tAmount + additionalChargesTotal();
                        setLocalDoc({ ...localDoc, items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                        void handleUpdate(localDoc!.id, { items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                      }}
                      onBlur={() => {
                        handleUpdate(localDoc!.id, { items: localDoc.items, subtotal: localDoc.subtotal, discountAmount: localDoc.discountAmount, taxAmount: localDoc.taxAmount, total: localDoc.total });
                      }}
                      className="h-8 text-xs text-right" 
                    />
                  </div>
                  <div className={cn('col-span-2 min-w-0', pricingMode === 'individual' && 'xl:col-span-1')}>
                    <Input 
                      min="0"
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={item.unitPrice === undefined || item.unitPrice === null ? '' : item.unitPrice}
                      placeholder="0"
                      readOnly={Boolean(item.productId)}
                      title={item.productId ? 'Precio definido por la lista de precios' : 'Precio personalizado'}
                      onChange={(e) => {
                        const newItems = [...(localDoc.items || [])] as any[];
                        newItems[idx].unitPrice = Number(String(e.target.value).replace(/,/g, ''));
                        newItems[idx].total = Number(newItems[idx].quantity || 0) * Number(newItems[idx].unitPrice);
                        const newSubtotal = newItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
                        const dAmount = newSubtotal * (localRates.dRate / 100);
                        const base = newSubtotal - dAmount;
                        const tAmount = base * (localRates.tRate / 100);
                        const newTotal = base + tAmount + additionalChargesTotal();
                        setLocalDoc({ ...localDoc, items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                      }}
                      onBlur={() => {
                        handleUpdate(localDoc!.id, { items: localDoc.items, subtotal: localDoc.subtotal, discountAmount: localDoc.discountAmount, taxAmount: localDoc.taxAmount, total: localDoc.total });
                      }}
                      className="h-8 text-xs text-right" 
                    />
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
                  <div data-item-role="total-actions" className="col-span-2 flex items-center justify-end gap-2">
                    <span className="text-sm font-black w-16 text-right">{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(item.total)}</span>
                    <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 rounded-md" onClick={() => {
                        const newItems = [...(localDoc.items || [])] as any[];
                        newItems.splice(idx, 1);
                        const newSubtotal = newItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
                        const dAmount = newSubtotal * (localRates.dRate / 100);
                        const base = newSubtotal - dAmount;
                        const tAmount = base * (localRates.tRate / 100);
                        const newTotal = base + tAmount + additionalChargesTotal();
                        setLocalDoc({ ...localDoc, items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                        void handleUpdate(localDoc!.id, { items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                    }}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {(!localDoc.items || localDoc.items.length === 0) && (
                <div className="text-center py-6 text-xs text-muted-foreground/50 italic border border-dashed border-border/50 rounded-xl bg-muted/10">
                  No hay productos o servicios asignados a esta orden. Haz clic en "Agregar Item".
                </div>
              )}
            </div>
            {(normalizeSalesExtraCharges(localDoc).length > 0 || localDoc.deliveryDescription || Number(localDoc.deliveryAmount || 0) > 0) && (
              <div className="mt-5 space-y-2 rounded-xl border border-border/50 bg-muted/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cargos adicionales</p>
                    <p className="text-[9px] text-muted-foreground/70">Se suman al total en la moneda de la orden.</p>
                  </div>
                  <span className="text-[10px] font-black text-muted-foreground">{localDoc.currency === 'USD' ? 'Dólares (US$)' : 'Córdobas (C$)'}</span>
                </div>
                {normalizeSalesExtraCharges(localDoc).map((charge, index) => (
                  <div key={charge.id} data-item-layout="extra-charge" className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-border/40 bg-background/60 p-2">
                    <span className="w-full text-[9px] font-black uppercase tracking-widest text-muted-foreground sm:w-auto">Coste extra {index + 1}</span>
                    <Input value={charge.description} onChange={(event) => editExtraChargeDescription(index, event.target.value)} onBlur={persistExtraCharges} placeholder="Descripción" className="h-8 w-full min-w-0 text-xs sm:flex-1" />
                    <div className="flex w-full min-w-0 items-center gap-1 rounded-md border border-input bg-background px-2 sm:w-auto sm:min-w-[8.5rem]">
                      <span className="text-[10px] font-black text-muted-foreground">{localDoc.currency === 'USD' ? '$' : 'C$'}</span>
                      <Input type="number" min="0" step="0.01" value={charge.amount || ''} onChange={(event) => updateExtraCharges(normalizeSalesExtraCharges(localDoc).map((item, itemIndex) => itemIndex === index ? { ...item, amount: Math.max(0, Number(event.target.value) || 0) } : item))} placeholder="Monto" className="h-8 border-0 px-0 text-right text-xs shadow-none focus-visible:ring-0" />
                    </div>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Eliminar coste extra ${index + 1}`} className="size-7 shrink-0 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500" onClick={() => updateExtraCharges(normalizeSalesExtraCharges(localDoc).filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="size-3.5" /></Button>
                  </div>
                ))}
                {(localDoc.deliveryDescription || Number(localDoc.deliveryAmount || 0) > 0) && (
                  <div data-item-layout="delivery" className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-border/40 bg-background/60 p-2">
                    <span className="w-full text-[9px] font-black uppercase tracking-widest text-muted-foreground sm:w-auto">Delivery</span>
                    <Input value={localDoc.deliveryDescription || ''} onChange={(event) => setLocalDoc({ ...localDoc, deliveryDescription: event.target.value })} onBlur={() => updateDelivery({ deliveryDescription: localDoc.deliveryDescription || null })} placeholder="Descripción" className="h-8 w-full min-w-0 text-xs sm:flex-1" />
                    <div className="flex w-full min-w-0 items-center gap-1 rounded-md border border-input bg-background px-2 sm:w-auto sm:min-w-[8.5rem]">
                      <span className="text-[10px] font-black text-muted-foreground">{localDoc.currency === 'USD' ? '$' : 'C$'}</span>
                      <Input type="number" min="0" step="0.01" value={localDoc.deliveryAmount || ''} onChange={(event) => updateDelivery({ deliveryAmount: Math.max(0, Number(event.target.value) || 0) })} placeholder="Monto" className="h-8 border-0 px-0 text-right text-xs shadow-none focus-visible:ring-0" />
                    </div>
                    <Button type="button" variant="ghost" size="icon" aria-label="Eliminar delivery" className="size-7 shrink-0 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500" onClick={() => updateDelivery({ deliveryDescription: null, deliveryAmount: 0 })}><Trash2 className="size-3.5" /></Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {localDoc?.notes && (
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Notas</p><p className="text-sm">{localDoc.notes}</p></CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="sales-list-kpis">
        <SalesKpiCard title="Órdenes en Proceso" value={data.filter(o => normalizeOrderStatus(o.status) === 'IN_PROCESS').length} icon={Clock} color="text-blue-500" bg="bg-blue-500/10" active={statusFilter === 'IN_PROCESS'} onClick={() => setStatusFilter(statusFilter === 'IN_PROCESS' ? 'ALL' : 'IN_PROCESS')} />
        {displayMode === 'ORIGINAL'
          ? originalApprovedAmounts.map((summary) => <SalesKpiCard key={`approved-${summary.currency}`} title={`Monto Aprobado (${summary.currency})`} value={formatExplicitAmount(summary.amount, summary.currency)} icon={TrendingUp} color="text-emerald-500" bg="bg-emerald-500/10" />)
          : <SalesKpiCard title={`Monto Aprobado (${displayCurrency})`} value={formatConvertedAmount(approvedAmountInDisplayCurrency, baseCurrency)} icon={TrendingUp} color="text-emerald-500" bg="bg-emerald-500/10" />}
        <SalesKpiCard title="Órdenes Aprobadas" value={data.filter(o => normalizeOrderStatus(o.status) === 'APPROVED').length} icon={Check} color="text-emerald-500" bg="bg-emerald-500/10" active={statusFilter === 'APPROVED'} onClick={() => setStatusFilter(statusFilter === 'APPROVED' ? 'ALL' : 'APPROVED')} />
        <SalesKpiCard title="Órdenes en Borrador" value={data.filter(o => normalizeOrderStatus(o.status) === 'DRAFT').length} icon={Eye} color="text-amber-500" bg="bg-amber-500/10" active={statusFilter === 'DRAFT'} onClick={() => setStatusFilter(statusFilter === 'DRAFT' ? 'ALL' : 'DRAFT')} />
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-2">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground" data-tour="sales-list-title">Órdenes de Venta</h2>
          </div>
          <div className="erp-list-toolbar flex flex-wrap items-center justify-end gap-3" data-tour="sales-list-actions">
            <SalesViewTutorial view="orders" />
            <SalesDateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChange={onDateRangeChange || (() => undefined)} />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as OrderStatusFilter)}>
              <SelectTrigger className="h-10 w-full rounded-xl border-border/50 bg-background/50 text-[10px] font-black uppercase tracking-widest sm:w-44"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                <SelectItem value="DRAFT">Borradores</SelectItem>
                <SelectItem value="IN_PROCESS">En proceso</SelectItem>
                <SelectItem value="APPROVED">Aprobadas</SelectItem>
                <SelectItem value="CANCELLED">Canceladas</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input 
                placeholder="Buscar orden..." 
                className="pl-9 h-10 w-full sm:w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold tracking-widest"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setColumnConfigOpen(true)}
              className="h-10 rounded-xl border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest"
            >
              <Settings2 className="mr-2 size-4" /> Columnas <span className="ml-1 text-muted-foreground">{visibleColumns.length}</span>
            </Button>
            <ViewLayoutSelect value={layoutMode} onChange={(value) => setLayoutMode(value === 'kanban' ? 'table' : value)} ariaLabel="Elegir distribución de órdenes" />
            {salesAlert && <PurchaseAlertsButton alert={salesAlert} sectionLabel="ventas" storageNamespace="erp-sales-alerts" onItemSelect={setHighlightedAlertId} />}
            {canPerform('SALES_ORDERS', 'create') && (
              <Button onClick={handleAddOrder} data-toolbar-role="primary" className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20">
                <Plus className="size-4" /> Nueva Orden
              </Button>
            )}
          </div>
        </div>
        <EditableDataTable 
          data={filteredData}
          pagination={pagination}
          showHorizontalControls
          actionsWidth="w-56"
          fitContent
          columns={visibleColumns}
          layoutMode={layoutMode}
          onRowUpdate={handleUpdate}
          onRowClick={(row) => setDetailOrder(row)}
          highlightedRowId={highlightedAlertId}
          isLoading={loading}
          isRowSelectable={(row) => ['DRAFT', 'IN_PROCESS'].includes(normalizeOrderStatus(row.status)) && !row.invoiceId && !row.invoiceNumber}
           actions={(row) => (
             <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 pr-1 xl:min-w-max xl:flex-nowrap" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                <WhatsAppActionButton
                  phone={resolveCustomerPhone(row.customerId, row.customer, customers)}
                  documentLabel="orden de venta"
                  onSend={() => handleWhatsApp(row)}
                />
                 {canPerform('SALES_ORDERS', 'approve') && ['IN_PROCESS', 'APPROVED'].includes(normalizeOrderStatus(row.status)) && !row.invoiceId && !row.invoiceNumber && (
                  <Button 
                    type="button"
                    title={normalizeOrderStatus(row.status) === 'IN_PROCESS' ? 'Aprobar y enviar a Factura' : 'Enviar a Factura'}
                    aria-label={normalizeOrderStatus(row.status) === 'IN_PROCESS' ? 'Aprobar y enviar a Factura' : 'Enviar a Factura'}
                    onClick={() => void handleInvoiceOrder(row)}
                    disabled={invoicingOrderId === row.id}
                    variant="ghost" 
                    size="icon" 
                    className="size-8 shrink-0 rounded-lg text-primary hover:bg-primary/10 hover:text-primary transition-colors"
                    style={{ color: themeConfig?.colors?.primary || undefined }}
                  >
                    <ArrowRightCircle className={cn('size-4', invoicingOrderId === row.id && 'animate-pulse')} />
                  </Button>
                )}
                <Button type="button" title="Ver orden completa" aria-label="Ver orden completa" variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-muted-foreground transition-colors" onClick={() => { setDetailOrder(null); setEditingId(row.id); }}><Eye className="size-4 text-muted-foreground" /></Button>
                {canPerform('SALES_ORDERS', 'delete') &&
                  ['DRAFT', 'IN_PROCESS'].includes(normalizeOrderStatus(row.status)) &&
                  !row.invoiceId && !row.invoiceNumber && (
                  <Button
                    type="button"
                    title="Cancelar orden"
                    aria-label="Cancelar orden"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-muted-foreground transition-colors"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setPendingCancelId(row.id);
                    }}
                  >
                  <Ban className="size-4 text-muted-foreground" />
                  </Button>
                )}
             </div>
         )}
         />
       </div>

      <SalesDocumentDetailSheet
        key={detailOrder?.id || 'order-detail'}
        document={detailOrder ? buildOrderPanel(detailOrder) : null}
        entity="SALES_ORDER"
        open={Boolean(detailOrder)}
        onClose={() => setDetailOrder(null)}
        onOpenDocument={() => {
          if (!detailOrder) return;
          setDetailOrder(null);
          setEditingId(detailOrder.id);
        }}
        onDownloadPdf={(format) => { if (detailOrder) void handleExportPDF(detailOrder, format); }}
      />

      <Dialog open={columnConfigOpen} onOpenChange={setColumnConfigOpen}>
        <DialogContent className="w-[calc(100%-2rem)] !max-w-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Settings2 className="size-5 text-primary" /> Configurar columnas</DialogTitle>
            <DialogDescription>Elige qué información quieres ver en la lista o en las tarjetas de órdenes de venta. Los cambios se reflejan inmediatamente.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {columnOptions.map((option) => {
              const active = visibleColumnKeys.includes(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setVisibleColumnKeys((current) => active
                    ? (current.length > 1 ? current.filter((key) => key !== option.key) : current)
                    : [...current, option.key])}
                  className={cn(
                    'flex min-h-11 items-center justify-between rounded-xl border px-3 text-left text-xs font-bold transition-colors',
                    active ? 'border-primary bg-primary/10 text-foreground' : 'border-border/60 bg-muted/10 text-muted-foreground hover:border-primary/50',
                  )}
                >
                  <span>{option.label}</span>
                  {active && <Check className="size-4 text-primary" />}
                </button>
              );
            })}
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setVisibleColumnKeys(columnOptions.map((option) => option.key))}>Mostrar todas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingCancelId !== null}
        onOpenChange={(open) => { if (!open && !cancelLoading) setPendingCancelId(null); }}
        title="¿Cancelar orden de venta?"
        description="La orden quedará cancelada y ya no podrá continuar al proceso de facturación."
        confirmLabel="Cancelar orden"
        variant="destructive"
        loading={cancelLoading}
        onConfirm={async () => {
          if (!pendingCancelId) return;
          const cancelToastId = toast.loading('Cancelando orden de venta...');
          try {
            setCancelLoading(true);
            await salesOrdersService.update(pendingCancelId, { status: 'CANCELLED' as any });
            toast.success('Orden cancelada', { id: cancelToastId });
            clearSalesEditorDraft(salesDraftStorageKey);
            localDocRef.current = null;
            if (editingId === pendingCancelId) setEditingId(null);
            await onRefresh();
          } catch (error: any) {
            const message = error?.response?.data?.message || error?.message || 'Error al cancelar la orden';
            toast.error(Array.isArray(message) ? message.join(', ') : message, { id: cancelToastId });
          } finally {
            setCancelLoading(false);
            setPendingCancelId(null);
          }
        }}
      />

    </div>
  );
}
