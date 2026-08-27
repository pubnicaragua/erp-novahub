import { useState, useEffect, useRef } from 'react';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { 
  FileSpreadsheet, Plus, Search, TrendingUp, Clock, CheckCircle2, ArrowRightCircle, Eye, Trash2, Ban, ChevronLeft
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { ViewLayoutSelect, type ViewLayoutMode } from '../ui/ViewLayoutSelect';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { estimatesService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import type { Estimate, Customer, Product, SalesPaginationControls } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { generateEstimatePDF, previewSalesTransactionPDF } from '../../utils/pdfGenerator';
import { storageService } from '../../services/storage.service';
import { publicAccessService, publicLinkUrl } from '../../services/public-access.service';
import { PriceMissingBadge, SalesLinePriceListSelect } from './SalesLinePriceListSelect';
import { formatSalesAmount, getMissingSalesPriceMessage, hasSalesProductPriceListConflict, hasSalesProductPriceListConflicts } from '../../utils/salesPriceList';
import { SalesDateRangeFilter } from './SalesDateRangeFilter';
import { SalesViewTutorial } from './SalesViewTutorial';
import { SalesKpiCard } from './SalesKpiCard';
import { resolveCustomerPhone, WhatsAppActionButton } from './WhatsAppActionButton';
import { PurchaseAlertsButton, type PurchaseAlertDetail } from '../compras/PurchaseAlertsButton';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { formatDateEs } from '../../utils/dateFormat';
import { SALES_WORKFLOW_STATUS_COLORS } from '../../utils/salesStatus';
import { SalesDocumentDetailSheet, type SalesDocumentPanelData } from './SalesDocumentDetailSheet';
import type { PdfDownloadFormat } from '../../utils/pdfDownloadFormats';
import { EstimacionesKanban } from './EstimacionesKanban';
import { getLegacySalesExtraCostFields, getSalesExtraChargesAmount, getSalesExtraChargesPayload, normalizeSalesExtraCharges, type SalesExtraChargeLine } from '../../utils/salesCharges';
import { SalesWarehouseSelect, getDefaultSalesWarehouseId } from './SalesWarehouseSelect';
import { SalesWarehouseStockHint } from './SalesWarehouseStockHint';
import { clearSalesEditorDraft, getSalesEditorDraftKey, readSalesEditorDraft, writeSalesEditorDraft } from '../../services/sales-draft-storage';

interface EstimacionesViewProps {
  data: Estimate[];
  loading: boolean;
  onRefresh: () => Promise<void> | void;
  onConvertedToOrder?: (orderId: string) => void;
  customers?: Customer[];
  products?: Product[];
  warehouses?: any[];
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateRangeChange?: (dateFrom: string, dateTo: string) => void;
  salesAlert?: PurchaseAlertDetail;
}

const statusOptions = [
  { label: 'Borrador',  value: 'DRAFT',     color: SALES_WORKFLOW_STATUS_COLORS.DRAFT },
  { label: 'En proceso', value: 'IN_PROCESS', color: SALES_WORKFLOW_STATUS_COLORS.IN_PROCESS },
  { label: 'Aprobada', value: 'APPROVED',  color: SALES_WORKFLOW_STATUS_COLORS.APPROVED },
  { label: 'Cancelada',value: 'CANCELLED', color: SALES_WORKFLOW_STATUS_COLORS.CANCELLED },
];
type EstimateWorkflowStatus = 'DRAFT' | 'IN_PROCESS' | 'APPROVED' | 'CANCELLED';
const normalizeEstimateStatus = (status: unknown) => String(status || '').toUpperCase() === 'SENT' ? 'IN_PROCESS' : String(status || '').toUpperCase();
const getEstimateWorkflowIssues = (estimate: Estimate | null | undefined): string[] => {
  if (!estimate) return ['Información general'];
  const issues: string[] = [];
  if (!estimate.customerId && !String((estimate as any).customCustomerName || '').trim()) issues.push('Cliente');
  if (!estimate.date || Number.isNaN(new Date(estimate.date).getTime())) issues.push('Fecha');
  if (!estimate.expiryDate || Number.isNaN(new Date(estimate.expiryDate).getTime())) issues.push('Válida hasta');
  const items = Array.isArray(estimate.items) ? estimate.items : [];
  if (!items.length) issues.push('al menos un producto o servicio');
  items.forEach((item: any, index) => {
    const label = `Ítem ${index + 1}`;
    if (!item.productId && !String(item.description || '').trim()) issues.push(`${label}: producto o servicio`);
    if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) issues.push(`${label}: cantidad mayor que cero`);
    if (!Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) < 0) issues.push(`${label}: precio válido`);
  });
  return issues;
};
const isLocalEstimate = (id: string | number | undefined | null) => String(id || '').startsWith('local-');
const actionButtonClass = 'text-muted-foreground hover:bg-muted/40 hover:text-muted-foreground transition-colors';
const actionIconClass = 'size-4 text-muted-foreground';

export function EstimacionesView({ data, loading: _loading, onRefresh, onConvertedToOrder, customers = [], products = [], warehouses = [], pagination, onSearchChange, dateFrom = '', dateTo = '', onDateRangeChange, salesAlert }: EstimacionesViewProps) {
  const { user, canPerform } = useAuth();
  const { themeConfig } = useTheme();
  const { exchangeRate: globalRate, displayCurrency, baseCurrency, formatConvertedAmount, toBaseAmount } = useCurrency();
  const salesDraftStorageKey = getSalesEditorDraftKey('estimate', user?.tenantId, user?.id);
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutMode, setLayoutMode] = useLocalStorageState<ViewLayoutMode>('sales-estimates-layout', 'table', 24 * 365);
  const [statusFilter, setStatusFilter] = useState<'ALL' | EstimateWorkflowStatus>('ALL');
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Estimate | null>(null);
  const [detailEstimate, setDetailEstimate] = useState<Estimate | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [highlightedAlertId, setHighlightedAlertId] = useState<string | null>(null);
  const [localRates, setLocalRates] = useState({ dRate: 0, tRate: 0, irRate: 0, irTaxId: '' });
  const [pricingMode, setPricingMode] = useState<'global' | 'individual'>('global');
  const localDraftRef = useRef<Estimate | null>(null);
  const savingEstimateRef = useRef(false);
  const localDocRef = useRef<Estimate | null>(null);
  const hydratedDraftKeyRef = useRef<string | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);

  const commitLocalDoc = (nextDoc: Estimate | null) => {
    localDocRef.current = nextDoc;
    if (nextDoc && isLocalEstimate(nextDoc.id)) localDraftRef.current = nextDoc;
    setLocalDoc(nextDoc);
  };

  useEffect(() => {
    localDocRef.current = localDoc;
  }, [localDoc]);

  useEffect(() => {
    if (!salesDraftStorageKey || hydratedDraftKeyRef.current === salesDraftStorageKey) return;
    hydratedDraftKeyRef.current = salesDraftStorageKey;
    const stored = readSalesEditorDraft<Estimate>(salesDraftStorageKey);
    const timer = window.setTimeout(() => {
      if (stored) {
        if (stored.document) commitLocalDoc(stored.document);
        if (stored.editingId) setEditingId(stored.editingId);
        const rates = stored.metadata?.localRates;
        if (rates && typeof rates === 'object') setLocalRates(rates as { dRate: number; tRate: number; irRate: number; irTaxId: string });
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
  const productCatalog = products.filter((p) => p.itemType !== 'SERVICE');
  const serviceCatalog = products.filter((p) => p.itemType === 'SERVICE');
  const resolveItemType = (item: any) => item.itemType || (products.find((p) => p.id === item.productId)?.itemType === 'SERVICE' ? 'SERVICE' : 'PRODUCT');

  const handleConvertToOrder = async (estimate: Estimate) => {
    if (!canPerform('SALES_QUOTES', 'approve')) {
      toast.error('No tienes permiso para aprobar y enviar cotizaciones');
      return;
    }
    if (convertingId) return;
    const currentStatus = String(estimate.status || '').toUpperCase();
    if (!['IN_PROCESS', 'SENT'].includes(currentStatus)) {
      toast.info('La cotización debe estar en proceso antes de aprobarla');
      return;
    }
    if (!estimate.items?.length) {
      toast.error('La cotización debe contener al menos un producto o servicio');
      return;
    }
    const priceMessage = getMissingSalesPriceMessage(estimate.items);
    if (priceMessage) {
      toast.error(priceMessage);
      return;
    }
    setConvertingId(estimate.id);
    const conversionToastId = toast.loading('Generando orden de venta desde la cotización...');
    try {
      const order = await estimatesService.convertToOrder(estimate.id);
      toast.success('Cotización aprobada y enviada a Orden de Venta', { id: conversionToastId });
      onConvertedToOrder?.(order.id);
      await onRefresh();
      clearSalesEditorDraft(salesDraftStorageKey);
      localDraftRef.current = null;
      localDocRef.current = null;
      setEditingId(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo enviar la cotización', { id: conversionToastId });
    } finally {
      setConvertingId(null);
    }
  };

  const filtered = data.filter(e => {
    const matchesStatus = statusFilter === 'ALL' || normalizeEstimateStatus(e.status) === statusFilter;
    const search = searchTerm.toLowerCase();
    return matchesStatus && (e.number.toLowerCase().includes(search) || (e.customer?.name || '').toLowerCase().includes(search));
  });

  const colFilters = useColumnFilters();
  const filterGetters = {
    customerId: (row: Estimate) => row.customer?.name || 'Varios',
    date: (row: Estimate) => (row.date ? new Date(row.date).getTime() : null),
    status: (row: Estimate) => normalizeEstimateStatus(row.status),
  };
  const filteredData = colFilters.applyTo(filtered, filterGetters);
  const distinctCustomers = [...new Map(filtered.map((e) => [e.customer?.name || 'Varios', e.customer?.name || 'Varios'])).entries()]
    .map(([, label]) => ({ value: label, label, count: filtered.filter((e) => (e.customer?.name || 'Varios') === label).length }));
  const statusOptionsForFilter = statusOptions.map((option) => ({ value: option.value, label: option.label, count: filtered.filter((e) => normalizeEstimateStatus(e.status) === option.value).length }));

  const handleUpdate = async (id: string | number, updates: Partial<Estimate>) => {
    try {
      if (isLocalEstimate(id)) {
        const baseDoc = localDraftRef.current?.id === String(id)
          ? localDraftRef.current
          : localDocRef.current?.id === String(id)
            ? localDocRef.current
            : localDoc;
        if (!baseDoc) return;
        const nextDoc = { ...baseDoc, ...updates, items: updates.items ?? baseDoc.items } as Estimate;
        localDraftRef.current = nextDoc;
        commitLocalDoc(nextDoc);
        return;
      }
      await estimatesService.update(id.toString(), updates);
      await onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar');
      throw e;
    }
  };

  const handleKanbanStatusChange = async (estimateId: string, newStatus: string, estimate: Estimate) => {
    if (savingEstimateRef.current) return;
    savingEstimateRef.current = true;
    const toastId = toast.loading(`Moviendo cotización a ${newStatus}...`);
    try {
      await estimatesService.update(estimateId, {
        number: estimate.number,
        customerId: estimate.customerId || null,
        date: estimate.date,
        expiryDate: estimate.expiryDate,
        subtotal: estimate.subtotal,
        taxAmount: estimate.taxAmount,
        discountAmount: estimate.discountAmount,
        irRate: 0,
        irTaxId: null,
        irAmount: 0,
        priceListId: estimate.priceListId || null,
        total: estimate.total,
        extraCostDescription: estimate.extraCostDescription || null,
        extraCostAmount: estimate.extraCostAmount || 0,
        extraCharges: getSalesExtraChargesPayload(estimate),
        deliveryDescription: estimate.deliveryDescription || null,
        deliveryAmount: estimate.deliveryAmount || 0,
        currency: estimate.currency,
        exchangeRate: estimate.exchangeRate,
        warehouseId: estimate.warehouseId || null,
        status: newStatus as any,
        notes: estimate.notes,
        items: (estimate.items || []).map((item) => ({
          id: item.id,
          productId: item.productId,
          productCode: (item as any).productCode || products.find((product) => product.id === item.productId)?.code,
          description: item.description,
          quantity: Number(item.quantity || 0),
          unitPrice: Number(item.unitPrice || 0),
          discount: Number((item as any).discount || 0),
          taxRate: Number((item as any).taxRate || 0),
          irRate: 0,
          irAmount: 0,
          total: Number(item.total || 0),
          itemType: (item as any).itemType || 'PRODUCT',
          priceListId: (item as any).priceListId || null,
        })),
      } as any);
      toast.success(`Cotización movida a ${newStatus}`, { id: toastId });
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo cambiar el estado', { id: toastId });
    } finally {
      savingEstimateRef.current = false;
    }
  };

  const buildEstimateStatusPayload = (status: 'DRAFT' | 'IN_PROCESS') => ({
    number: localDoc?.number,
    customerId: localDoc?.customerId || null,
    date: localDoc?.date,
    expiryDate: localDoc?.expiryDate,
    subtotal: localDoc?.subtotal,
    taxAmount: localDoc?.taxAmount,
    discountAmount: localDoc?.discountAmount,
    irRate: 0,
    irTaxId: null,
    irAmount: 0,
    priceListId: localDoc?.priceListId || null,
    total: localDoc?.total,
    extraCostDescription: localDoc?.extraCostDescription || null,
    extraCostAmount: localDoc?.extraCostAmount || 0,
    extraCharges: getSalesExtraChargesPayload(localDoc),
    deliveryDescription: localDoc?.deliveryDescription || null,
    deliveryAmount: localDoc?.deliveryAmount || 0,
    currency: localDoc?.currency,
    exchangeRate: localDoc?.exchangeRate,
    baseTotal: (localDoc as any)?.baseTotal,
    warehouseId: localDoc?.warehouseId || null,
    notes: localDoc?.notes,
    items: (localDoc?.items || []).map((item: any) => ({
      ...item,
      productCode: item.productCode || item.code || products.find((product) => product.id === item.productId)?.code,
    })),
    status,
  } as Partial<Estimate>);

  const handleSaveEstimate = async (status: 'DRAFT' | 'IN_PROCESS') => {
    if (!localDoc) return;
    if (savingEstimateRef.current) return;
    if (status === 'IN_PROCESS') {
      const workflowIssues = getEstimateWorkflowIssues(localDoc);
      if (workflowIssues.length) {
        toast.error(`No se puede marcar la cotización en proceso. Faltan o están incompletos: ${workflowIssues.join('; ')}.`);
        return;
      }
      const priceMessage = getMissingSalesPriceMessage((localDoc.items || []).filter((item: any) => item.productId || String(item.description || '').trim()));
      if (priceMessage) {
        toast.error(priceMessage);
        return;
      }
    }
    const saveToastId = toast.loading(status === 'IN_PROCESS' ? 'Marcando cotización en proceso...' : 'Guardando cotización...');
    savingEstimateRef.current = true;
    try {
      if (isLocalEstimate(localDoc.id)) {
        const created = await estimatesService.create({ ...buildEstimateStatusPayload(status), number: undefined } as any);
        localDraftRef.current = created;
        commitLocalDoc(created);
        await onRefresh();
      } else {
        await handleUpdate(localDoc.id, buildEstimateStatusPayload(status));
      }
      clearSalesEditorDraft(salesDraftStorageKey);
      localDraftRef.current = null;
      localDocRef.current = null;
      setEditingId(null);
      toast.success(status === 'IN_PROCESS' ? 'Cotización marcada en proceso' : 'Cotización guardada como borrador', { id: saveToastId });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo guardar la cotización', { id: saveToastId });
    } finally {
      savingEstimateRef.current = false;
    }
  };

  const getCustomerPhone = (estimate: Estimate | null = localDoc): string | null => {
    if (!estimate) return null;
    return resolveCustomerPhone(estimate.customerId, estimate.customer, customers);
  };

  const handleWhatsApp = async (estimateOverride?: Estimate) => {
    const estimate = estimateOverride || localDoc;
    const phone = getCustomerPhone(estimate);
    if (!phone) {
      toast.error('El cliente no tiene un número asociado para enviar la cotización por WhatsApp');
      return;
    }

    let secureDocumentUrl: string | null = null;
    let securePortalUrl: string | null = null;
    let publicPdfUrl: string | null = null;

    const preparingToastId = estimate ? toast.loading('Generando PDF y preparando enlaces seguros...') : undefined;
    if (estimate) {
      const currentCustomer = customers.find((c) => c.id === estimate.customerId) || estimate.customer;
      try {
        if (estimate.customerId) {
          const [documentLink, portalLink] = await Promise.all([
            publicAccessService.createDocumentLink({ customerId: estimate.customerId, documentType: 'estimate', documentId: estimate.id, allowPrint: true, allowDownload: true, allowRelated: true }),
            publicAccessService.createPortalLink({ customerId: estimate.customerId }),
          ]);
          secureDocumentUrl = publicLinkUrl(documentLink.path);
          securePortalUrl = publicLinkUrl(portalLink.path);
        }
        if (!secureDocumentUrl) {
          const { blob } = await generateEstimatePDF({
            estimate: { ...estimate, customer: currentCustomer },
            tenantName: user?.sessionBranding?.name || themeConfig?.tenantName || user?.tenantName || 'Empresa',
            tenantLogo: themeConfig?.logo,
            formatAmount: formatConvertedAmount,
            save: true,
          });
          // Compatibilidad: solo usa el enlace legado si el servicio seguro no está disponible.
          const fileName = `${estimate.number || 'Cotizacion'}_${Date.now()}.pdf`;
          const pdfFile = new File([blob], fileName, { type: 'application/pdf' });
          const uploaded = await storageService.uploadFile('documents', pdfFile, { folder: 'cotizaciones' });
          if (uploaded?.url) publicPdfUrl = uploaded.url;
        }
      } catch (err) {
        console.warn('No se pudo generar enlace en la nube, usando modo estándar:', err);
      }
    }

    const digits = phone.replace(/\D/g, '');
    const phoneWithCode = digits.length === 8 ? '505' + digits : (digits.startsWith('505') ? digits : '505' + digits);
    const customerName = estimate?.customer?.name || customers.find((c) => c.id === estimate?.customerId)?.name || '';
    const totalFormatted = `${estimate?.currency === 'USD' ? 'US$' : 'C$'}${formatSalesAmount(estimate?.total)}`;

    let message = `Hola ${customerName}, te compartimos la cotización ${estimate?.number || ''} por un total de ${totalFormatted}.`;
    if (secureDocumentUrl) {
      message += `\n\nPodés consultar la cotización de forma segura aquí:\n${secureDocumentUrl}`;
      if (securePortalUrl) message += `\n\nTambién podés consultar tu historial y saldo en el portal del cliente:\n${securePortalUrl}`;
    } else if (publicPdfUrl) {
      message += `\n\nPodés ver o descargar el documento PDF directamente desde este enlace:\n${publicPdfUrl}`;
    } else {
      message += ` Adjunto encontrarás el documento PDF con todos los detalles.`;
    }

    const text = encodeURIComponent(message);
    window.open(`https://wa.me/${phoneWithCode}?text=${text}`, '_blank');

    if (publicPdfUrl) {
      toast.success('¡Enlace público del PDF generado e incluido en el mensaje de WhatsApp!', preparingToastId ? { id: preparingToastId } : undefined);
    } else {
      toast.success('PDF descargado. ¡Se abrió WhatsApp para que lo adjuntes!', { ...(preparingToastId ? { id: preparingToastId } : {}), duration: 5000 });
    }
  };

  const handleExportPDF = async (estimate: Estimate, format: PdfDownloadFormat = 'configured') => {
    const previewToastId = toast.loading('Preparando la previsualización de la cotización...');
    try {
      await previewSalesTransactionPDF({
        document: { ...estimate, customer: customers.find((customer) => customer.id === estimate.customerId) || estimate.customer },
        tenantName: user?.sessionBranding?.name || themeConfig?.tenantName || user?.tenantName || 'Empresa',
        tenantLogo: themeConfig?.logo,
        formatAmount: formatConvertedAmount as any,
        documentType: 'estimate',
        format,
      });
      toast.success('Previsualización abierta. Descargá el PDF desde el visor del navegador.', { id: previewToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo abrir la previsualización', { id: previewToastId });
    }
  };

  const buildEstimatePanel = (estimate: Estimate): SalesDocumentPanelData => ({
    id: estimate.id,
    number: estimate.number,
    title: 'Cotización',
    customerName: estimate.customer?.name || customers.find((customer) => customer.id === estimate.customerId)?.name || 'Varios',
    status: normalizeEstimateStatus(estimate.status),
    totalLabel: formatConvertedAmount(Number(estimate.total || 0), estimate.currency, estimate.exchangeRate),
    summaryDetails: [
      { label: 'Moneda', value: estimate.currency || 'NIO' },
      { label: 'Líneas', value: String(estimate.items?.length || 0) },
      ...normalizeSalesExtraCharges(estimate)
        .filter((charge) => charge.amount > 0)
        .map((charge, index) => ({ label: charge.description || `Coste extra ${index + 1}`, value: formatConvertedAmount(charge.amount, estimate.currency, estimate.exchangeRate) })),
      ...(Number(estimate.deliveryAmount || 0) > 0 ? [{ label: estimate.deliveryDescription || 'Delivery', value: formatConvertedAmount(Number(estimate.deliveryAmount), estimate.currency, estimate.exchangeRate) }] : []),
    ],
    metadata: [
      { label: 'Fecha de emisión', value: formatDateEs(estimate.date) },
      { label: 'Vigencia', value: formatDateEs(estimate.expiryDate) },
    ],
    lines: (estimate.items || []).map((item) => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity || 0),
      unitPriceLabel: formatConvertedAmount(Number(item.unitPrice || 0), estimate.currency, estimate.exchangeRate),
      totalLabel: formatConvertedAmount(Number(item.total || 0), estimate.currency, estimate.exchangeRate),
    })),
    notes: estimate.notes,
  });

  const handleAddEstimate = () => {
    const now = new Date().toISOString();
    const draft = {
      id: `local-${Date.now()}`,
      number: '',
      customerId: '',
      date: now,
      expiryDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      items: [],
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      irRate: 0,
      irAmount: 0,
      total: 0,
      extraCostDescription: null,
      extraCostAmount: 0,
      extraCharges: [],
      deliveryDescription: null,
      deliveryAmount: 0,
      baseTotal: 0,
      currency: displayCurrency,
      exchangeRate: globalRate,
      warehouseId: getDefaultSalesWarehouseId(warehouses) || null,
      status: 'DRAFT',
    } as Estimate;
    localDraftRef.current = draft;
    commitLocalDoc(draft);
    setLocalRates({ dRate: 0, tRate: 0, irRate: 0, irTaxId: '' });
    setPricingMode('global');
    setEditingId(draft.id);
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
    const nextDoc = { ...localDoc, extraCharges: charges, ...legacyFields } as Estimate;
    const baseTotal = Number(localDoc.total || 0) - additionalChargesTotal(localDoc);
    const total = baseTotal + additionalChargesTotal(nextDoc);
    setLocalDoc({ ...nextDoc, total });
    void handleUpdate(localDoc.id, { extraCharges: payload, ...legacyFields, total } as Partial<Estimate>);
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
    const nextDoc = { ...localDoc, ...updates } as Estimate;
    const baseTotal = Number(localDoc.total || 0) - additionalChargesTotal(localDoc);
    const total = baseTotal + additionalChargesTotal(nextDoc);
    setLocalDoc({ ...nextDoc, total });
    void handleUpdate(localDoc.id, { ...updates, total } as Partial<Estimate>);
  };

  // Keep virtual rates to auto-apply when subtotal changes
  const recalcIndividualTotals = (items: any[]) => {
    const pricedItems = items.map((line: any) => {
      const gross = Number(line.quantity || 0) * Number(line.unitPrice || 0);
      const discount = gross * Number(line.discount || 0) / 100;
      const taxable = gross - discount;
      const tax = taxable * Number(line.taxRate || 0) / 100;
      return { ...line, irRate: 0, irTaxId: null, irAmount: 0, total: taxable + tax };
    });
    const subtotal = pricedItems.reduce((sum: number, line: any) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);
    const discountAmount = pricedItems.reduce((sum: number, line: any) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0) * Number(line.discount || 0) / 100, 0);
    const taxAmount = pricedItems.reduce((sum: number, line: any) => {
      const gross = Number(line.quantity || 0) * Number(line.unitPrice || 0);
      return sum + (gross - gross * Number(line.discount || 0) / 100) * Number(line.taxRate || 0) / 100;
    }, 0);
    return { items: pricedItems, subtotal, discountAmount, taxAmount, irAmount: 0, total: subtotal - discountAmount + taxAmount + additionalChargesTotal() };
  };
  const recalcGlobalTotals = (items: any[], dRate: number, tRate: number, _irRate = 0) => {
    const normalizedItems = items.map((line: any) => ({ ...line, irRate: 0, irTaxId: null, irAmount: 0, total: Number(line.quantity || 0) * Number(line.unitPrice || 0) }));
    const subtotal = normalizedItems.reduce((sum: number, line: any) => sum + Number(line.total || 0), 0);
    const discountAmount = subtotal * Math.max(0, Math.min(100, Number(dRate || 0))) / 100;
    const base = subtotal - discountAmount;
    const taxAmount = base * Math.max(0, Number(tRate || 0)) / 100;
    return { items: normalizedItems, subtotal, discountAmount, taxAmount, irAmount: 0, total: base + taxAmount + additionalChargesTotal() };
  };
  useEffect(() => {
    if (!draftHydrated) return;
    const timer = setTimeout(() => {
      if (editingId) {
        const localSnapshot = localDraftRef.current?.id === editingId
          ? localDraftRef.current
          : localDocRef.current?.id === editingId
            ? localDocRef.current
            : null;
        if (localSnapshot) {
          commitLocalDoc(localSnapshot);
        } else {
          const e = data.find(x => x.id === editingId);
          if (e) {
            const cloned = JSON.parse(JSON.stringify(e)) as Estimate;
            commitLocalDoc(cloned);
            setLocalRates({ ...calculateRates(e), irRate: 0, irTaxId: '' });
            setPricingMode((e.items || []).some((line: any) => Number(line.discount || 0) !== 0 || Number(line.taxRate || 0) !== 0) ? 'individual' : 'global');
          }
        }
      } else {
      clearSalesEditorDraft(salesDraftStorageKey);
      localDraftRef.current = null;
        localDocRef.current = null;
        commitLocalDoc(null);
        setLocalRates({ dRate: 0, tRate: 0, irRate: 0, irTaxId: '' });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [draftHydrated, editingId, data]);

  const columns: ColumnDef<Estimate>[] = [
    { 
      key: 'number', 
      header: 'Número', 
      width: '140px',
      render: (val, row) => (
        <span 
          className={cn(
            "text-xs font-black font-mono text-primary",
            canPerform('SALES_QUOTES', 'edit') ? "cursor-pointer hover:underline" : "cursor-default"
          )}
          onClick={() => setDetailEstimate(row)}
        >
          {val}
        </span>
      )
    },
    { 
      key: 'customerId', 
      header: 'Cliente', 
      headerExtra: <ColumnFilterMenu label="Cliente" options={distinctCustomers} selected={colFilters.state.customerId?.values || []} onSelect={(values) => colFilters.setValues('customerId', values)} sort={colFilters.state.customerId?.sort || null} onSort={(sort) => colFilters.setSort('customerId', sort)} />,
      render: (_val, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Varios'}</span>
    },
    { 
      key: 'date', 
      header: 'Fecha Emisión', 
      headerExtra: <ColumnFilterMenu label="Fecha Emisión" sort={colFilters.state.date?.sort || null} onSort={(sort) => colFilters.setSort('date', sort)} sortOptions={[{ value: 'desc', label: 'Más recientes' }, { value: 'asc', label: 'Más antiguas' }]} />,
      render: (val) => <span className="text-xs font-medium text-muted-foreground">{formatDateEs(val)}</span>
    },
    { 
      key: 'total', 
      header: 'Total Neto', 
      width: '150px',
      render: (val, row) => (
        <span className="text-[13px] font-black tabular-nums text-foreground">
          {formatConvertedAmount(Number(val || 0), row.currency, row.exchangeRate)}
        </span>
      )
    },
    { 
      key: 'status', 
      header: 'Estado', 
      width: '135px',
      editable: false,
      headerExtra: <ColumnFilterMenu label="Estado" options={statusOptionsForFilter} selected={colFilters.state.status?.values || []} onSelect={(values) => colFilters.setValues('status', values)} sort={colFilters.state.status?.sort || null} onSort={(sort) => colFilters.setSort('status', sort)} />,
      render: (val) => {
        const opt = statusOptions.find(o => o.value === normalizeEstimateStatus(val));
        return (
          <Badge variant="outline" className={cn(
            "whitespace-nowrap text-[9px] font-black uppercase tracking-wider px-2 py-0.5 border-none shadow-none",
            opt?.color || 'bg-muted/20 text-muted-foreground'
          )}>
            {opt?.label || val}
          </Badge>
        );
      }
    },
    { 
      key: 'expiryDate', 
      header: 'Validez', 
      render: (val) => (
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
           <Clock className="size-3" />
           {formatDateEs(val)}
        </div>
      )
    }
  ];

  const quotedTotalInDisplayCurrency = data.reduce(
    (acc, estimate) => acc + ((estimate as any).baseTotal !== null && (estimate as any).baseTotal !== undefined
      ? Number((estimate as any).baseTotal)
      : toBaseAmount(estimate.total || 0, estimate.currency, estimate.exchangeRate || globalRate)),
    0,
  );

  if (editingId && localDoc) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300" data-tour="sales-form-title">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => { clearSalesEditorDraft(salesDraftStorageKey); localDraftRef.current = null; localDocRef.current = null; setEditingId(null); }} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isLocalEstimate(localDoc?.id) ? 'Nueva Cotización' : `Cotización ${localDoc?.number}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Detalle de la cotización comercial</p>
            </div>
          </div>
          <div className="flex items-center gap-3" data-tour="sales-form-actions">
            <SalesViewTutorial view="quotes" context="form" />
            {localDoc?.customerId && (
              <Button variant="outline" onClick={() => void handleWhatsApp()} className="rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-400/30 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300 gap-2 font-black uppercase text-[10px] tracking-widest px-4">
                <WhatsAppIcon fontSize="inherit" className="size-4" style={{ width: '1rem', height: '1rem', fontSize: '1rem' }} aria-hidden="true" /> WhatsApp
              </Button>
            )}
            {canPerform('SALES_QUOTES', 'edit') && !['APPROVED', 'CANCELLED'].includes(normalizeEstimateStatus(localDoc?.status)) && (
              <>
                {normalizeEstimateStatus(localDoc?.status) === 'DRAFT' && <>
                  <Button variant="outline" className="rounded-xl border-border/50 hover:bg-muted/70 hover:text-foreground font-black uppercase text-[10px] tracking-widest px-6"
                    onClick={() => void handleSaveEstimate('DRAFT')}>
                    Guardar Borrador
                  </Button>
                  <Button className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6"
                    onClick={() => void handleSaveEstimate('IN_PROCESS')}>
                    Marcar En Proceso
                  </Button>
                </>}
                {normalizeEstimateStatus(localDoc?.status) === 'IN_PROCESS' && canPerform('SALES_QUOTES', 'approve') && <Button className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6"
                  onClick={() => void handleConvertToOrder(localDoc)}>
                  Aprobar y enviar a Orden
                </Button>}
              </>
            )}
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50" data-tour="sales-form-data">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
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
                  required={normalizeEstimateStatus(localDoc?.status) === 'IN_PROCESS'}
                  helpText="La cotización conservará esta bodega al convertirse en orden."
                />
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha</p>
                  <Input type="date" defaultValue={typeof localDoc?.date === 'string' && localDoc.date.includes('T') ? localDoc.date.split('T')[0] : localDoc?.date || ''} onBlur={(e) => handleUpdate(localDoc!.id, { date: new Date(e.target.value).toISOString() })} className="h-8 text-xs" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Válida hasta</p>
                  <Input type="date" defaultValue={typeof localDoc?.expiryDate === 'string' && localDoc.expiryDate.includes('T') ? localDoc.expiryDate.split('T')[0] : localDoc?.expiryDate || ''} onBlur={(e) => handleUpdate(localDoc!.id, { expiryDate: new Date(e.target.value).toISOString() })} className="h-8 text-xs" />
                </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Moneda de la cotización</p>
                    <Select value={localDoc?.currency || 'NIO'} onValueChange={(currency) => {
                      const exchangeRate = currency === 'NIO' ? 1 : Number(globalRate || 1);
                      const previousCurrency = localDoc?.currency || 'NIO';
                      const previousRate = previousCurrency === 'NIO' ? 1 : Number(localDoc?.exchangeRate || globalRate || 1);
                      const convertedItems = (localDoc?.items || []).map((item: any) => {
                        const basePrice = previousCurrency === 'USD' ? Number(item.unitPrice || 0) * previousRate : Number(item.unitPrice || 0);
                        return { ...item, unitPrice: currency === 'USD' ? basePrice / exchangeRate : basePrice };
                      });
                      const recalculated = pricingMode === 'individual'
                        ? recalcIndividualTotals(convertedItems)
                        : recalcGlobalTotals(convertedItems, localRates.dRate, localRates.tRate, localRates.irRate);
                      setLocalDoc({ ...localDoc, currency, exchangeRate, ...recalculated } as any);
                      void handleUpdate(localDoc!.id, { currency, exchangeRate, ...recalculated } as any);
                    }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar moneda" /></SelectTrigger>
                      <SelectContent><SelectItem value="NIO">Córdobas (C$)</SelectItem><SelectItem value="USD">Dólares (US$)</SelectItem></SelectContent>
                    </Select>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">Tasa configurada: <span className="font-bold">{localDoc?.currency === 'NIO' ? '1.00' : Number(localDoc?.exchangeRate || globalRate || 1).toFixed(2)}</span></p>
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
                  const recalculated = recalcGlobalTotals(items, localRates.dRate, localRates.tRate, localRates.irRate);
                  setPricingMode('global');
                  setLocalDoc({ ...localDoc, ...recalculated } as any);
                  void handleUpdate(localDoc.id, recalculated as any);
                }}>Global</Button>
                <Button type="button" size="sm" variant={pricingMode === 'individual' ? 'default' : 'outline'} className="h-7 rounded-lg px-2 text-[10px]" onClick={() => setPricingMode('individual')}>Por producto</Button>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <div className="flex min-w-[9rem] items-center justify-end gap-2"><span className="w-8 shrink-0 text-right text-xs font-black">{localDoc?.currency === 'USD' ? '$' : 'C$'}</span><Input type="text" value={formatSalesAmount(localDoc?.subtotal)} readOnly className="w-28 h-8 text-right font-bold tabular-nums bg-muted/20" /></div>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Descuento</span>
                  <div className="flex min-w-[9rem] items-center justify-end gap-2 text-rose-500">
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
                    <span className="min-w-[7.5rem] text-right tabular-nums">-{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(localDoc?.discountAmount)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Impuesto (IVA)</span>
                  <div className="flex min-w-[9rem] items-center justify-end gap-2">
                    {pricingMode === 'global' && <label className="flex h-8 items-center gap-1.5 rounded-md bg-muted/30 px-2 text-xs font-black">
                      <input type="checkbox" checked={Number(localRates.tRate || 0) > 0} onChange={(e) => {
                        const newRate = e.target.checked ? 15 : 0;
                        const dAmount = Number(localDoc?.subtotal || 0) * (localRates.dRate / 100);
                        const base = Number(localDoc?.subtotal || 0) - dAmount;
                        const tAmount = base * (newRate / 100);
                        setLocalRates(prev => ({ ...prev, tRate: newRate }));
                        setLocalDoc({ ...localDoc, discountAmount: dAmount, taxAmount: tAmount, total: base + tAmount + additionalChargesTotal() } as any);
                        void handleUpdate(localDoc!.id, { discountAmount: dAmount, taxAmount: tAmount, total: base + tAmount + additionalChargesTotal() } as any);
                      }} /> Aplicar
                    </label>}
                    <span className="min-w-[7.5rem] text-right text-xs font-black tabular-nums">{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(localDoc?.taxAmount)}</span>
                  </div>
                </div>
                {normalizeSalesExtraCharges(localDoc).filter((charge) => charge.amount > 0).map((charge, index) => <div key={charge.id} className="flex justify-between items-center text-sm"><span className="text-muted-foreground">{charge.description || `Coste extra ${index + 1}`}</span><span className="min-w-[7.5rem] text-right font-mono tabular-nums">{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(charge.amount)}</span></div>)}
                {Number(localDoc?.deliveryAmount || 0) > 0 && <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">{localDoc?.deliveryDescription || 'Delivery'}</span><span className="min-w-[7.5rem] text-right font-mono tabular-nums">{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(localDoc?.deliveryAmount)}</span></div>}
                <div className="flex justify-between items-center text-base border-t pt-3 border-border/50">
                  <span className="font-black">Total</span>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2 text-primary font-black">
                      <span className="w-8 shrink-0 text-right text-xs font-black">{localDoc?.currency === 'USD' ? '$' : 'C$'}</span>
                      <Input type="number" value={Number(localDoc?.total||0)} readOnly className="w-28 h-8 text-right font-black tabular-nums text-primary bg-muted/20" />
                    </div>
                    {localDoc?.currency === 'USD' && (
                      <p className="text-[10px] font-bold text-muted-foreground mt-1 italic">
                      ≈ C$ {formatSalesAmount(Number(localDoc?.total || 0) * (localDoc?.exchangeRate || globalRate))}
                      </p>
                    )}
                    {localDoc?.currency === 'NIO' && (
                      <p className="text-[10px] font-bold text-muted-foreground mt-1 italic">
                        ≈ $ {formatSalesAmount(Number(localDoc?.total || 0) / (localDoc?.exchangeRate || globalRate))}
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
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Productos / Servicios</p>
              <div className="flex flex-wrap gap-2">
                {(['PRODUCT', 'SERVICE'] as const).map((itemType) => <Button key={itemType} type="button" variant="outline" size="sm" disabled={!localDoc?.customerId} onClick={() => {
                  const newItems = [...(localDoc.items || []), { id: Date.now().toString(), itemType, productId: '', description: '', quantity: 1, unitPrice: 0, total: 0 }] as any[];
                  commitLocalDoc({ ...localDoc, items: newItems } as Estimate);
                }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl"><Plus className="size-3 mr-2" /> Agregar {itemType === 'PRODUCT' ? 'Producto' : 'Servicio'}</Button>)}
                <Button type="button" variant="outline" size="sm" disabled={!localDoc?.customerId} onClick={() => updateExtraCharges([...normalizeSalesExtraCharges(localDoc), { id: `extra-${Date.now()}`, description: '', amount: 0 }])} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl">
                  <Plus className="size-3 mr-2" /> Agregar coste extra
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={!localDoc?.customerId || Boolean(localDoc?.deliveryDescription) || Number(localDoc?.deliveryAmount || 0) > 0} title={localDoc?.deliveryDescription || Number(localDoc?.deliveryAmount || 0) > 0 ? 'Solo se permite un delivery por cotización' : undefined} onClick={() => updateDelivery({ deliveryDescription: 'Delivery', deliveryAmount: 0 })} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl">
                  <Plus className="size-3 mr-2" /> Agregar delivery
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="hidden xl:grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                <div className="col-span-5">Descripción</div>
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
                  <div className={cn("min-w-0 xl:col-span-5", pricingMode === 'individual' && "xl:col-span-5")}>
                      <div className="flex min-w-0 flex-wrap items-center gap-1"><div className="min-w-0 flex-1"><Combobox
                      options={(resolveItemType(item) === 'SERVICE' ? serviceCatalog : productCatalog).map(p => ({ label: `${resolveItemType(item) === 'SERVICE' ? 'Servicio' : 'Producto'} · ${p.code} - ${p.name}`, value: p.id }))}
                      value={item.productId || ''}
                      onChange={(val) => {
                        const newItems = [...(localDoc.items || [])] as any[];
                        const selectedProd = (resolveItemType(item) === 'SERVICE' ? serviceCatalog : productCatalog).find(p => p.id === val);
                        const effectivePriceListId = (item as any).priceListId || (localDoc as any).priceListId || null;
                        if (val && hasSalesProductPriceListConflict(newItems, val, effectivePriceListId, idx, (localDoc as any).priceListId || null)) {
                          toast.error('Este producto ya está agregado con la misma lista de precios.');
                          return;
                        }
                        newItems[idx].productId = val;
                        if (selectedProd) {
                          newItems[idx].description = selectedProd.name;
                          newItems[idx].productCode = selectedProd.code;
                          const baseSalePrice = Number(selectedProd.salePrice ?? selectedProd.price ?? 0);
                          newItems[idx].unitPrice = localDoc?.currency === 'USD' ? baseSalePrice / Number(localDoc?.exchangeRate || globalRate || 1) : baseSalePrice;
                          newItems[idx].total = Number(newItems[idx].quantity) * Number(newItems[idx].unitPrice);
                        } else {
                          newItems[idx].description = 'Producto Customizado';
                          newItems[idx].unitPrice = 0;
                          newItems[idx].total = 0;
                        }
                        const newSubtotal = newItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
                        const dAmount = newSubtotal * (localRates.dRate / 100);
                        const base = newSubtotal - dAmount;
                        const tAmount = base * (localRates.tRate / 100);
                        const newTotal = base + tAmount + additionalChargesTotal();
                        const nextDoc = { ...localDoc, items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any;
                         commitLocalDoc(nextDoc);
                        void handleUpdate(localDoc!.id, {
                          items: newItems,
                          subtotal: newSubtotal,
                          discountAmount: dAmount,
                          taxAmount: tAmount,
                          total: newTotal,
                        } as any);
                      }}
                      placeholder={resolveItemType(item) === 'SERVICE' ? 'Seleccionar servicio...' : 'Seleccionar producto...'}
                      disabled={!localDoc?.customerId}
                    /></div><SalesLinePriceListSelect
                      productId={(products.find((product) => product.id === item.productId) || products.find((product) => String(product.name).trim().toLowerCase() === String(item.description || '').trim().toLowerCase()))?.id || item.productId}
                      productCode={(products.find((product) => product.id === item.productId) || products.find((product) => String(product.name).trim().toLowerCase() === String(item.description || '').trim().toLowerCase()))?.code || item.productCode || item.code}
                      productName={item.description}
                      itemType={item.itemType}
                      value={item.priceListId}
                      defaultPriceListId={localDoc?.priceListId}
                      lineItems={localDoc?.items || []}
                      lineIndex={idx}
                      currency={localDoc?.currency}
                      exchangeRate={Number(localDoc?.exchangeRate || globalRate || 1)}
                      onChange={(priceListId, result, source) => {
                      const nextItems = [...(localDoc.items || [])] as any[];
                      const matchedProduct = products.find((product) => product.id === nextItems[idx].productId)
                        || products.find((product) => String(product.name).trim().toLowerCase() === String(nextItems[idx].description || '').trim().toLowerCase());
                      nextItems[idx] = { ...nextItems[idx], productId: matchedProduct?.id || nextItems[idx].productId, productCode: matchedProduct?.code || nextItems[idx].productCode || nextItems[idx].code, priceListId, unitPrice: result.unitPrice ?? 0, priceMissing: result.priceMissing };
                      const calculated = pricingMode === 'individual' ? recalcIndividualTotals(nextItems) : recalcGlobalTotals(nextItems, localRates.dRate, localRates.tRate, localRates.irRate);
                       commitLocalDoc({ ...localDoc, ...calculated, priceListId } as Estimate);
                      if (source !== 'initial') void handleUpdate(localDoc!.id, { ...calculated, priceListId, items: calculated.items } as any);
                      }}
                    /></div>
                    {item.productId && resolveItemType(item) !== 'SERVICE' && (
                      <SalesWarehouseStockHint
                        product={products.find((product) => product.id === item.productId)}
                        warehouses={warehouses}
                        warehouseId={localDoc?.warehouseId}
                        variantId={item.variantId}
                        className="basis-full"
                      />
                    )}
                    {item.priceMissing && <PriceMissingBadge className="mt-1" />}
                  </div>
                  {pricingMode === 'individual' && (
                    <div className="col-span-2 mt-0 grid min-w-0 grid-cols-2 items-start gap-1.5 self-start text-[10px]">
                      <label className="relative flex min-w-0 flex-1 items-center font-black uppercase tracking-wider">
                        <span className="flex h-8 w-full items-center gap-1.5 rounded-md bg-muted/30 px-2">
                          <input type="checkbox" checked={Number(item.taxRate || 0) > 0} onChange={(event) => {
                            const nextItems = [...(localDoc.items || [])];
                            nextItems[idx] = { ...nextItems[idx], taxRate: event.target.checked ? 15 : 0 };
                            const recalculated = recalcIndividualTotals(nextItems);
                            setLocalDoc({ ...localDoc, ...recalculated });
                            void handleUpdate(localDoc!.id, recalculated as any);
                          }} />
                          <span className="text-xs">IVA</span>
                        </span>
                      </label>
                      <label className="relative flex min-w-0 flex-1 items-center font-black uppercase tracking-wider">
                        <Input type="number" min="0" max="100" value={item.discount || ''} onChange={(event) => {
                          const nextItems = [...(localDoc.items || [])];
                          nextItems[idx] = { ...nextItems[idx], discount: Number(event.target.value) || 0 };
                          const recalculated = recalcIndividualTotals(nextItems);
                          setLocalDoc({ ...localDoc, ...recalculated });
                          void handleUpdate(localDoc!.id, recalculated as any);
                        }} className="w-full pr-6 text-left text-xs" />
                        <span className="pointer-events-none absolute right-2 text-[10px] text-muted-foreground">%</span>
                      </label>
                    </div>
                  )}
                  <div className={cn("min-w-0 xl:col-span-2", pricingMode === 'individual' && "xl:col-span-1")}>
                    <Input 
                      type="number"
                      min="0"
                      value={Number(item.quantity) || ''} 
                      placeholder="0"
                      onChange={(e) => {
                        const newItems = [...(localDoc.items || [])] as any[];
                        newItems[idx].quantity = Number(e.target.value);
                        newItems[idx].total = Number(newItems[idx].quantity) * Number(newItems[idx].unitPrice || 0);
                        const newSubtotal = newItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
                        const dAmount = newSubtotal * (localRates.dRate / 100);
                        const base = newSubtotal - dAmount;
                        const tAmount = base * (localRates.tRate / 100);
                        const newTotal = base + tAmount + additionalChargesTotal();
                        setLocalDoc({ ...localDoc, items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                      }}
                      onBlur={() => handleUpdate(localDoc!.id, { items: localDoc.items, subtotal: localDoc.subtotal, discountAmount: localDoc.discountAmount, taxAmount: localDoc.taxAmount, total: localDoc.total })}
                    />
                  </div>
                  <div className={cn("col-span-2", pricingMode === 'individual' && "xl:col-span-1")}>
                    <Input 
                      type="text" 
                      min="0"
                      value={item.unitPrice === undefined || item.unitPrice === null ? '' : formatSalesAmount(item.unitPrice)}
                      placeholder="0"
                      readOnly
                      className="w-full text-right text-xs"
                      onChange={(e) => {
                        const newItems = [...(localDoc.items || [])] as any[];
                        newItems[idx].unitPrice = Number(e.target.value);
                        newItems[idx].total = Number(newItems[idx].quantity || 0) * Number(newItems[idx].unitPrice);
                        const newSubtotal = newItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
                        const dAmount = newSubtotal * (localRates.dRate / 100);
                        const base = newSubtotal - dAmount;
                        const tAmount = base * (localRates.tRate / 100);
                        const newTotal = base + tAmount + additionalChargesTotal();
                        setLocalDoc({ ...localDoc, items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                      }}
                      onBlur={() => handleUpdate(localDoc!.id, { items: localDoc.items, subtotal: localDoc.subtotal, discountAmount: localDoc.discountAmount, taxAmount: localDoc.taxAmount, total: localDoc.total })}
                    />
                  </div>
                  {pricingMode === 'individual' && (
                    <div className="flex min-w-0 h-9 items-center justify-end xl:col-span-1">
                      <Input
                        type="text"
                        readOnly
                        value={formatSalesAmount(((Number(item.quantity || 0) * Number(item.unitPrice || 0)) - (Number(item.quantity || 0) * Number(item.unitPrice || 0) * Number(item.discount || 0) / 100)) * Number(item.taxRate || 0) / 100)}
                        className="h-9 w-16 border-none bg-transparent px-0 text-right text-xs font-black shadow-none focus-visible:ring-0 focus-visible:border-transparent"
                      />
                    </div>
                  )}
                  <div className="flex min-w-0 items-center justify-end gap-3 whitespace-nowrap xl:col-span-2">
                    <span className="min-w-[7rem] shrink-0 text-right text-sm font-black">{localDoc?.currency === 'USD' ? '$' : 'C$'}{formatSalesAmount(item.total)}</span>
                    <Button variant="ghost" size="icon" className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500" onClick={() => {
                        const newItems = [...(localDoc.items || [])] as any[];
                        newItems.splice(idx, 1);
                        const recalculated = pricingMode === 'individual'
                          ? recalcIndividualTotals(newItems)
                          : recalcGlobalTotals(newItems, localRates.dRate, localRates.tRate, localRates.irRate);
                        setLocalDoc({ ...localDoc, ...recalculated } as any);
                    }}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {(!localDoc.items || localDoc.items.length === 0) && (
                <div className="text-center py-6 text-xs text-muted-foreground/50 italic border border-dashed border-border/50 rounded-xl bg-muted/10">
                  No hay productos o servicios asignados a esta cotización. Haz clic en "Agregar Item".
                </div>
              )}
            </div>
            {(normalizeSalesExtraCharges(localDoc).length > 0 || localDoc.deliveryDescription || Number(localDoc.deliveryAmount || 0) > 0) && (
              <div className="mt-5 space-y-2 rounded-xl border border-border/50 bg-muted/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cargos adicionales</p>
                    <p className="text-[9px] text-muted-foreground/70">Se suman al total en la moneda de la cotización.</p>
                  </div>
                  <span className="text-[10px] font-black text-muted-foreground">{localDoc.currency === 'USD' ? 'Dólares (US$)' : 'Córdobas (C$)'}</span>
                </div>
                {normalizeSalesExtraCharges(localDoc).map((charge, index) => (
                  <div key={charge.id} data-item-layout="extra-charge" className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-border/40 bg-background/60 p-2">
                    <span className="w-full text-[9px] font-black uppercase tracking-widest text-muted-foreground sm:w-auto">Coste extra {index + 1}</span>
                    <Input value={charge.description} onChange={(event) => editExtraChargeDescription(index, event.target.value)} onBlur={persistExtraCharges} placeholder="Descripción" className="h-8 min-w-0 flex-1 text-xs" />
                    <div className="flex min-w-[8.5rem] items-center gap-1 rounded-md border border-input bg-background px-2">
                      <span className="text-[10px] font-black text-muted-foreground">{localDoc.currency === 'USD' ? '$' : 'C$'}</span>
                      <Input type="number" min="0" step="0.01" value={charge.amount || ''} onChange={(event) => updateExtraCharges(normalizeSalesExtraCharges(localDoc).map((item, itemIndex) => itemIndex === index ? { ...item, amount: Math.max(0, Number(event.target.value) || 0) } : item))} placeholder="Monto" className="h-8 border-0 px-0 text-right text-xs shadow-none focus-visible:ring-0" />
                    </div>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Eliminar coste extra ${index + 1}`} className="size-7 shrink-0 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500" onClick={() => updateExtraCharges(normalizeSalesExtraCharges(localDoc).filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="size-3.5" /></Button>
                  </div>
                ))}
                {(localDoc.deliveryDescription || Number(localDoc.deliveryAmount || 0) > 0) && (
                  <div data-item-layout="delivery" className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-border/40 bg-background/60 p-2">
                    <span className="w-full text-[9px] font-black uppercase tracking-widest text-muted-foreground sm:w-auto">Delivery</span>
                    <Input value={localDoc.deliveryDescription || ''} onChange={(event) => setLocalDoc({ ...localDoc, deliveryDescription: event.target.value })} onBlur={() => updateDelivery({ deliveryDescription: localDoc.deliveryDescription || null })} placeholder="Descripción" className="h-8 min-w-0 flex-1 text-xs" />
                    <div className="flex min-w-[8.5rem] items-center gap-1 rounded-md border border-input bg-background px-2">
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
        <SalesKpiCard title={`Total Cotizado (${displayCurrency})`} value={formatConvertedAmount(quotedTotalInDisplayCurrency, baseCurrency)} icon={FileSpreadsheet} color="text-blue-500" bg="bg-blue-500/10" />
        <SalesKpiCard title="Tasa Conversión" value={`${((data.filter(e => (e.status||'').toUpperCase() === 'APPROVED').length / (data.length || 1)) * 100).toFixed(0)}%`} icon={TrendingUp} color="text-emerald-500" bg="bg-emerald-500/10" />
        <SalesKpiCard title="En proceso" value={data.filter(e => normalizeEstimateStatus(e.status) === 'IN_PROCESS').length} icon={Clock} color="text-blue-500" bg="bg-blue-500/10" active={statusFilter === 'IN_PROCESS'} onClick={() => setStatusFilter(statusFilter === 'IN_PROCESS' ? 'ALL' : 'IN_PROCESS')} />
        <SalesKpiCard title="Aprobadas" value={data.filter(e => (e.status||'').toUpperCase() === 'APPROVED').length} icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-500/10" active={statusFilter === 'APPROVED'} onClick={() => setStatusFilter(statusFilter === 'APPROVED' ? 'ALL' : 'APPROVED')} />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-2">
          <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-foreground" data-tour="sales-list-title">Cotizaciones</h2>
          </div>
          <div className="erp-list-toolbar flex flex-wrap items-center justify-end gap-3" data-tour="sales-list-actions">
            <SalesViewTutorial view="quotes" />
            <ViewLayoutSelect value={layoutMode} onChange={setLayoutMode} ariaLabel="Elegir distribución de cotizaciones" />
            <SalesDateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChange={onDateRangeChange || (() => undefined)} />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input 
                placeholder="Buscar cotización..." 
                className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold tracking-widest"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }}
              />
            </div>
            {salesAlert && <PurchaseAlertsButton alert={salesAlert} sectionLabel="ventas" storageNamespace="erp-sales-alerts" onItemSelect={setHighlightedAlertId} />}
            {canPerform('SALES_QUOTES', 'create') && (
              <Button onClick={handleAddEstimate} data-toolbar-role="primary" className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20">
                <Plus className="size-4" /> Nueva Cotización
              </Button>
            )}
          </div>
        </div>
        {layoutMode === 'kanban' ? (
          <EstimacionesKanban
            data={data}
            onRefresh={onRefresh}
            onStatusChange={handleKanbanStatusChange}
            onViewDetail={(est) => { setDetailEstimate(null); setEditingId(est.id); }}
            canEdit={canPerform('SALES_QUOTES', 'edit')}
          />
        ) : (
        <EditableDataTable 
          data={filteredData}
          pagination={pagination}
          columns={columns}
          onRowUpdate={handleUpdate}
          onRowClick={(row) => setDetailEstimate(row)}
          highlightedRowId={highlightedAlertId}
          actionsWidth="w-56"
          fitContent
          layoutMode={layoutMode}
          showHorizontalControls
          actions={(row) => (
            <div className="flex min-w-max items-center justify-end gap-1" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
              <WhatsAppActionButton
                phone={resolveCustomerPhone(row.customerId, row.customer, customers)}
                documentLabel="cotización"
                onSend={() => handleWhatsApp(row)}
              />
              {canPerform('SALES_QUOTES', 'approve') &&
                normalizeEstimateStatus(row.status) === 'IN_PROCESS' && (
                <Button
                  variant="ghost"
                  title="Aprobar y enviar a Orden de Venta"
                  aria-label="Aprobar y enviar a Orden de Venta"
                  size="icon"
                  disabled={convertingId === row.id}
                  onClick={(e) => { e.stopPropagation(); void handleConvertToOrder(row); }}
                  className={actionButtonClass}
                >
                  <ArrowRightCircle className={cn(actionIconClass, convertingId === row.id && 'animate-pulse')} />
                </Button>
              )}
              <Button variant="ghost" title="Ver cotización completa" aria-label="Ver cotización completa" size="icon" className={actionButtonClass} onClick={() => { setDetailEstimate(null); setEditingId(row.id); }}>
                <Eye className={actionIconClass} />
              </Button>
              {canPerform('SALES_QUOTES', 'edit') && ['DRAFT', 'IN_PROCESS'].includes(normalizeEstimateStatus(row.status)) && (
                <Button type="button" title="Cancelar cotización" variant="ghost" size="icon" className={actionButtonClass} onClick={() => setPendingCancelId(row.id)}>
                  <Ban className={actionIconClass} />
                </Button>
              )}
            </div>
          )}
        />
        )}
      </div>

      <SalesDocumentDetailSheet
        key={detailEstimate?.id || 'estimate-detail'}
        document={detailEstimate ? buildEstimatePanel(detailEstimate) : null}
        entity="ESTIMATE"
        open={Boolean(detailEstimate)}
        onClose={() => setDetailEstimate(null)}
        onOpenDocument={() => {
          if (!detailEstimate) return;
          setDetailEstimate(null);
          setEditingId(detailEstimate.id);
        }}
        onDownloadPdf={(format) => { if (detailEstimate) void handleExportPDF(detailEstimate, format); }}
      />

      <ConfirmDialog
        open={pendingCancelId !== null}
        onOpenChange={(open) => { if (!open) setPendingCancelId(null); }}
        title={"¿Cancelar cotización?"}
        description="La cotización quedará cancelada y ya no podrá enviarse a una orden de venta. El registro se conservará en el historial."
        confirmLabel="Cancelar cotización"
        variant="destructive"
        loading={cancelLoading}
        onConfirm={async () => {
          if (!pendingCancelId) return;
          const cancelToastId = toast.loading('Cancelando cotización...');
          try {
            setCancelLoading(true);
            await estimatesService.update(pendingCancelId, { status: 'CANCELLED' as any });
            toast.success('Cotización cancelada', { id: cancelToastId });
            clearSalesEditorDraft(salesDraftStorageKey);
            localDraftRef.current = null;
            localDocRef.current = null;
            setEditingId(null);
            onRefresh();
          } catch (error: any) {
            toast.error(error?.response?.data?.message || error?.message || 'No se pudo cancelar la cotización', { id: cancelToastId });
          } finally {
            setCancelLoading(false);
            setPendingCancelId(null);
          }
        }}
      />
    </div>
  );
}
