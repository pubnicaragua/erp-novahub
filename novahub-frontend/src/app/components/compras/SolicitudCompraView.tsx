import { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ClipboardList, Search, Eye, X, AlertTriangle,
  CheckCircle, Send, Ban,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Card, CardContent } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { purchaseRequestsService, purchaseManagementService, purchaseOrdersService } from '../../services/compras.service';
import type { Product, PurchaseRequest, PurchaseManagement, Warehouse, Supplier } from '../../types';
import type { SalesPaginationControls } from '../../types';
import { cn } from '../ui/utils';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PromptDialog } from '../ui/PromptDialog';
import { PurchaseKpiCard } from './PurchaseKpiCard';
import { PurchaseViewTutorial } from './PurchaseViewTutorial';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { PurchaseAlertsButton, type PurchaseAlertDetail } from './PurchaseAlertsButton';
import { EditableDataTable, type ColumnDef } from '../ui/EditableDataTable';
import { PdfDownloadButton } from '../ui/PdfDownloadButton';
import type { PdfDownloadFormat } from '../../utils/pdfDownloadFormats';
import { generatePurchaseListPDF, generatePurchaseRecordPDF } from '../../utils/purchaseExports';
import { SalesDocumentDetailSheet, type SalesDocumentPanelData } from '../ventas/SalesDocumentDetailSheet';
import { getPurchasePriorityOption } from '../../utils/purchasePriority';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-muted/20 text-muted-foreground',
  SUBMITTED: 'bg-primary/10 text-primary',
  RECEIVED: 'bg-primary/10 text-primary',
  IN_REVIEW: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  IN_QUOTATION: 'bg-primary/10 text-primary',
  PENDING_APPROVAL: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  APPROVED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  REJECTED: 'bg-destructive/10 text-destructive',
  RETURNED_FOR_CORRECTION: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  CONVERTED_TO_ORDER: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  CLOSED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

const PRIORITY_STYLES: Record<string, string> = {
  NORMAL: 'bg-primary/10 text-primary',
  URGENT: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  CRITICAL: 'bg-destructive/10 text-destructive',
};

function PurchasePriorityBadge({ value, className }: { value: unknown; className?: string }) {
  const priority = getPurchasePriorityOption(value);
  return <Badge variant="outline" className={cn(className, 'border-none px-2 py-0.5 text-[9px] font-black uppercase tracking-widest', PRIORITY_STYLES[priority.value])}>{priority.label}</Badge>;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Pendiente', SUBMITTED: 'Pendiente', RECEIVED: 'Pendiente',
  IN_REVIEW: 'Pendiente', IN_QUOTATION: 'Pendiente',
  PENDING_APPROVAL: 'Pendiente', APPROVED: 'Aprobada',
  REJECTED: 'Anulada', RETURNED_FOR_CORRECTION: 'Pendiente',
  CONVERTED_TO_ORDER: 'Aprobada', CLOSED: 'Aprobada', CANCELLED: 'Anulada',
};

const REQUEST_STATUS_OPTIONS = ['PENDING_APPROVAL', 'APPROVED', 'CANCELLED'] as const;

type RequestActionState = {
  request: PurchaseRequest;
  action: 'approve' | 'cancel';
};

function normalizeRequestStatus(status?: string): 'PENDING_APPROVAL' | 'APPROVED' | 'CANCELLED' {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'APPROVED' || normalized === 'CONVERTED_TO_ORDER' || normalized === 'CLOSED') return 'APPROVED';
  if (normalized === 'CANCELLED' || normalized === 'REJECTED') return 'CANCELLED';
  return 'PENDING_APPROVAL';
}

interface SolicitudCompraViewProps {
  data: PurchaseRequest[];
  loading?: boolean;
  onRefresh: () => void;
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  onStatusChange?: (value: string) => void;
  purchaseAlert?: PurchaseAlertDetail;
  warehouseCatalog?: Warehouse[];
  supplierCatalog?: Supplier[];
  productCatalog?: Product[];
}

export function SolicitudCompraView({ data, loading, onRefresh, pagination, onSearchChange, onStatusChange, purchaseAlert, warehouseCatalog, supplierCatalog = [], productCatalog = [] }: SolicitudCompraViewProps) {
  const { user, canPerform } = useAuth();
  const canExportRequests = canPerform('PURCHASES_REQUESTS', 'export');
  const canApproveRequests = canPerform('PURCHASES_REQUESTS', 'approve');
  const canCancelRequests = canPerform('PURCHASES_REQUESTS', 'cancel');
  // La gestión ocurre dentro de la vista Solicitudes; no es una vista
  // independiente del sidebar ni necesita una fila propia en la matriz.
  const canApproveManagement = canPerform('PURCHASES_REQUESTS', 'approve');
  const canRejectManagement = canPerform('PURCHASES_REQUESTS', 'reject');
  const canConvertManagement = canPerform('PURCHASES_REQUESTS', 'convert');
  const { exchangeRate: globalRate, displayCurrency, formatConvertedAmount } = useCurrency();
  const [search, setSearch] = useState('');
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('purchases-requests-layout', 'table', 24 * 365);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [highlightedAlertId, setHighlightedAlertId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightedAlertId) return;
    const timeout = window.setTimeout(() => setHighlightedAlertId(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [highlightedAlertId]);
  const [detailOpen, setDetailOpen] = useState<PurchaseRequest | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingApproveManagement, setPendingApproveManagement] = useState<PurchaseManagement | null>(null);
  const [pendingRejectManagement, setPendingRejectManagement] = useState<PurchaseManagement | null>(null);
  const [pendingConvertManagement, setPendingConvertManagement] = useState<PurchaseManagement | null>(null);
  const [pendingRequestAction, setPendingRequestAction] = useState<RequestActionState | null>(null);
  // Radix mantiene el contenido montado durante el cierre animado. Conservamos
  // la intención visual para evitar que el título cambie a "Anular" un instante
  // antes de desmontar el diálogo de aprobación.
  const [requestActionPresentation, setRequestActionPresentation] = useState<RequestActionState | null>(null);
  const [approvalSupplierId, setApprovalSupplierId] = useState('');

  const filtered = useMemo(() => {
    return data.filter(r => {
      if (statusFilter !== 'all' && normalizeRequestStatus(r.status) !== statusFilter) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return (r.number || '').toLowerCase().includes(s)
        || (r.requestedBy?.firstName?.toLowerCase().includes(s))
        || (r.requestedBy?.lastName?.toLowerCase().includes(s))
        || (r.warehouse?.name?.toLowerCase().includes(s))
        || (r.supplier?.name?.toLowerCase().includes(s))
        || (r.management?.[0]?.supplier?.name?.toLowerCase().includes(s));
    });
  }, [data, search, statusFilter]);

  const handleExportListPdf = async (format: PdfDownloadFormat) => {
    const exportToastId = toast.loading('Generando reporte de solicitudes...');
    try {
      await generatePurchaseListPDF({
        title: 'Solicitudes de compra',
        rows: filtered,
        tenantName: user?.tenantName || 'Empresa',
        tenantLogo: user?.sessionBranding?.logo || null,
        format,
        targetKey: 'compras.purchase-request',
        columns: [
          { label: 'N° Solicitud', value: (row) => row.number },
          { label: 'Proveedor', value: (row) => row.supplier?.name || row.management?.[0]?.supplier?.name || 'Sin proveedor' },
          { label: 'Fecha', value: (row) => row.date ? new Date(row.date).toLocaleDateString('es-NI') : '—' },
          { label: 'Total', align: 'right', value: (row) => { const management = row.management?.[0]; return management ? formatRequestAmount(management.total, management.currency, management.exchangeRate) : '—'; } },
          { label: 'Estado', align: 'center', value: (row) => STATUS_LABELS[normalizeRequestStatus(row.status)] },
        ],
      });
      toast.success('Reporte PDF descargado', { id: exportToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo generar el reporte', { id: exportToastId });
    }
  };

  const getActiveManagement = (pr: PurchaseRequest): PurchaseManagement | undefined =>
    pr.management?.[0];
  const getRequestSupplierId = (pr: PurchaseRequest) => pr.supplierId || getActiveManagement(pr)?.supplierId || '';
  const actionButtonClass = 'rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors';
  const actionIconClass = 'size-3.5';

  const renderRequestActions = (req: PurchaseRequest, card = false) => {
    const requestStatus = normalizeRequestStatus(req.status);
    const isPending = requestStatus === 'PENDING_APPROVAL';
    const isLoading = actionLoading === req.id;
    const buttonClass = 'size-8 rounded-lg';
    return (
      <div className={cn('flex flex-wrap items-center justify-end gap-1', card && 'w-full')} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
        <Button type="button" variant="ghost" size="icon" className={cn(actionButtonClass, buttonClass)} onClick={() => setDetailOpen(req)} title="Ver detalle" aria-label="Ver detalle de la solicitud">
          <Eye className={actionIconClass} />
        </Button>
        {canApproveRequests && isPending && (
          <Button type="button" variant="ghost" size="icon" className={cn(actionButtonClass, buttonClass)} onClick={() => handleRequestApprove(req)} disabled={isLoading} title="Aprobar solicitud y enviar a órdenes de compra" aria-label="Aprobar solicitud y enviar a órdenes de compra">
            <Send className={actionIconClass} />
          </Button>
        )}
        {canCancelRequests && isPending && (
          <Button type="button" variant="ghost" size="icon" className={cn(actionButtonClass, buttonClass)} onClick={() => handleRequestCancel(req)} disabled={isLoading} title="Anular solicitud de compra" aria-label="Anular solicitud de compra">
            <Ban className={actionIconClass} />
          </Button>
        )}
      </div>
    );
  };

  const columns: ColumnDef<PurchaseRequest>[] = [
    {
      key: 'number',
      header: 'N° Solicitud',
      width: '140px',
      render: (value) => <span className="font-mono text-xs font-black text-primary">{value}</span>,
    },
    {
      key: 'status',
      header: 'Estado',
      width: '150px',
      render: (_value, row) => {
        const mgmt = getActiveManagement(row);
        const status = normalizeRequestStatus(row.status);
        return (
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="outline" className={cn('whitespace-nowrap border-none px-2 py-0.5 text-[9px] font-black uppercase tracking-widest', STATUS_STYLES[status])}>
              {STATUS_LABELS[status]}
            </Badge>
            {mgmt && mgmt.status === 'PENDING_APPROVAL' && (
              <Badge className="border-orange-500/20 bg-orange-500/10 text-[8px] text-orange-500">Gestión</Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'priority',
      header: 'Prioridad',
      width: '115px',
      render: (value) => <PurchasePriorityBadge value={value} />,
    },
    {
      key: 'supplier',
      header: 'Proveedor',
      width: '210px',
      render: (_value, row) => {
        const mgmt = getActiveManagement(row);
        return <span className="text-sm font-bold">{row.supplier?.name || mgmt?.supplier?.name || <span className="text-muted-foreground/50">—</span>}</span>;
      },
    },
    {
      key: 'total',
      header: 'Total',
      width: '150px',
      render: (_value, row) => {
        const mgmt = getActiveManagement(row);
        return mgmt
          ? <span className="font-mono text-xs font-black tabular-nums">{formatRequestAmount(mgmt.total, mgmt.currency, mgmt.exchangeRate)}</span>
          : <span className="text-muted-foreground/50">—</span>;
      },
    },
    {
      key: 'items',
      header: 'Ítems',
      width: '85px',
      render: (_value, row) => <span className="text-xs font-semibold tabular-nums">{row.items?.length || 0}</span>,
    },
    {
      key: 'requestedBy',
      header: 'Solicitante',
      width: '190px',
      render: (_value, row) => <span className="text-xs">{`${row.requestedBy?.firstName || ''} ${row.requestedBy?.lastName || ''}`.trim() || '—'}</span>,
    },
    {
      key: 'date',
      header: 'Fecha',
      width: '115px',
      render: (value) => <span className="text-xs text-muted-foreground">{value ? new Date(value).toLocaleDateString() : '—'}</span>,
    },
  ];

  const handleApproveManagement = (mgmt: PurchaseManagement) => {
    if (!canApproveManagement) return;
    setPendingApproveManagement(mgmt);
  };

  const confirmApproveManagement = async () => {
    if (!canApproveManagement) return;
    if (!pendingApproveManagement) return;
    const mgmt = pendingApproveManagement;
    setActionLoading(mgmt.id);
    const approveToastId = toast.loading('Aprobando gestión de compra...');
    try { await purchaseManagementService.approve(mgmt.id); toast.success('Gestión aprobada', { id: approveToastId }); setPendingApproveManagement(null); onRefresh(); }
    catch (e: any) { toast.error(e?.message || 'Error al aprobar', { id: approveToastId }); }
    finally { setActionLoading(null); }
  };

  const handleRejectManagement = async (mgmt: PurchaseManagement) => {
    if (!canRejectManagement) return;
    setPendingRejectManagement(mgmt);
  };

  const confirmRejectManagement = async (rejectReason: string) => {
    if (!canRejectManagement) return;
    if (!pendingRejectManagement) return;
    const mgmt = pendingRejectManagement;
    setActionLoading(mgmt.id);
    const rejectToastId = toast.loading('Rechazando gestión de compra...');
    try { await purchaseManagementService.reject(mgmt.id, rejectReason || undefined); toast.success('Gestión rechazada', { id: rejectToastId }); setPendingRejectManagement(null); onRefresh(); }
    catch (e: any) { toast.error(e?.message || 'Error al rechazar', { id: rejectToastId }); }
    finally { setActionLoading(null); }
  };

  const handleConvertToOrder = async (mgmt: PurchaseManagement) => {
    if (!canConvertManagement) return;
    setPendingConvertManagement(mgmt);
  };

  const confirmConvertToOrder = async () => {
    if (!canConvertManagement) return;
    if (!pendingConvertManagement) return;
    const mgmt = pendingConvertManagement;
    setActionLoading(mgmt.id);
    const convertToastId = toast.loading('Generando orden de compra desde la gestión...');
    try {
      const order = await purchaseManagementService.convertToOrder(mgmt.id);
      toast.success(`Orden de compra #${order.number} generada`, { id: convertToastId });
      setPendingConvertManagement(null);
      onRefresh();
    } catch (e: any) { toast.error(e?.message || 'Error al convertir', { id: convertToastId }); }
    finally { setActionLoading(null); }
  };

  const handleRequestApprove = (req: PurchaseRequest) => {
    if (!canApproveRequests) return;
    if (normalizeRequestStatus(req.status) !== 'PENDING_APPROVAL') return;
    setApprovalSupplierId(getRequestSupplierId(req));
    const action: RequestActionState = { request: req, action: 'approve' };
    setRequestActionPresentation(action);
    setPendingRequestAction(action);
  };

  const handleRequestCancel = (req: PurchaseRequest) => {
    if (!canCancelRequests) return;
    if (normalizeRequestStatus(req.status) !== 'PENDING_APPROVAL') return;
    setApprovalSupplierId('');
    const action: RequestActionState = { request: req, action: 'cancel' };
    setRequestActionPresentation(action);
    setPendingRequestAction(action);
  };

  const buildOrderFromRequest = (request: PurchaseRequest, supplierId: string) => {
    // Las solicitudes antiguas pueden traer la relación `warehouse` sin el
    // campo plano. Conservamos siempre la bodega elegida en la solicitud.
    const requestWarehouseId = String(
      request.warehouseId
      || request.warehouse?.id
      || request.items?.find((item) => item.warehouseId)?.warehouseId
      || '',
    ).trim();
    const requester = request.requestedBy
      ? `${request.requestedBy.firstName || ''} ${request.requestedBy.lastName || ''}`.trim()
      : (request.requestedById || 'Admin');
    const items = (request.items || []).map((item: any) => {
      const product = item.product || productCatalog.find((candidate) => String(candidate.id) === String(item.productId));
      const priceCandidates = [item.unitPrice, product?.lastPurchasePrice, product?.costPrice, product?.cost, product?.price]
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0);
      const unitPrice = priceCandidates[0] || 0;
      const quantity = Math.max(0, Number(item.quantity || 0));
      const taxRateValue = Number(product?.taxRate);
      const taxRate = Number.isFinite(taxRateValue) && taxRateValue >= 0
        ? (taxRateValue > 0 && taxRateValue <= 1 ? taxRateValue * 100 : taxRateValue)
        : 15;
      const taxType = String(item.taxType || (taxRate > 0 ? 'GRAVADO' : 'EXENTO')).toUpperCase();
      const lineSubtotal = Number((quantity * unitPrice).toFixed(2));
      const taxBase = taxType === 'GRAVADO' ? lineSubtotal : 0;
      const taxAmount = Number((taxBase * (taxType === 'GRAVADO' ? taxRate : 0) / 100).toFixed(2));

      return {
        productId: item.productId || null,
        variantId: item.variantId || null,
        code: item.code || product?.code || product?.sku || '',
        name: item.name || product?.name || item.description || '',
        description: item.description || product?.name || '',
        category: item.category || (product as any)?.category?.name || (product as any)?.category || '',
        categoryId: item.categoryId || product?.categoryId || null,
        stock: Number(item.currentStock || product?.stock || 0),
        stockApplies: product?.itemType !== 'SERVICE',
        quantity,
        unitPrice,
        total: lineSubtotal,
        taxType,
        taxRate: taxType === 'GRAVADO' ? taxRate : 0,
        taxBase,
        taxAmount,
        withholdingType: 'NONE',
        withholdingRate: 0,
        withholdingBase: 0,
      };
    });
    const subtotal = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const taxAmount = items.reduce((sum, item) => sum + Number(item.taxAmount || 0), 0);

    return {
      supplierId,
      date: new Date().toISOString(),
      expectedDelivery: request.requiredDate || new Date(Date.now() + 7 * 86400000).toISOString(),
      warehouseId: requestWarehouseId,
      currency: displayCurrency,
      exchangeRate: globalRate,
      status: 'DRAFT',
      purchaseType: 'INVENTORY',
      requestedBy: requester,
      purchaseRequestId: request.id,
      purchaseRequestNumber: request.number,
      notes: request.notes || request.justification || '',
      subtotal,
      taxAmount,
      withholdingTotal: 0,
      withholdingBase: 0,
      total: subtotal + taxAmount,
      items,
    };
  };

  const confirmRequestAction = async () => {
    if (!pendingRequestAction) return;
    const { request: req, action } = pendingRequestAction;
    if (action === 'approve' && !approvalSupplierId) {
      toast.error('Seleccione un proveedor para aprobar la solicitud.');
      return;
    }
    setActionLoading(req.id);
    const requestToastId = toast.loading(action === 'approve' ? 'Aprobando solicitud y generando orden de compra...' : 'Anulando solicitud de compra...');
    try {
      if (action === 'approve') {
        await purchaseOrdersService.create(buildOrderFromRequest(req, approvalSupplierId));
        toast.success(`${req.number} aprobada y enviada a órdenes de compra`, { id: requestToastId });
      } else {
        await purchaseRequestsService.changeStatus(req.id, 'CANCELLED');
        toast.success(`${req.number} → Anulada`, { id: requestToastId });
      }
      setPendingRequestAction(null);
      setApprovalSupplierId('');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || `Error al ${action === 'approve' ? 'aprobar y enviar' : 'anular'} la solicitud`, { id: requestToastId });
    }
    finally { setActionLoading(null); }
  };

  const formatRequestAmount = (amount: number | string | undefined | null, currency?: string, rate?: number) =>
    formatConvertedAmount(Number(amount || 0), (currency || displayCurrency) as any, rate ?? globalRate);

  const handleDownloadRequestPdf = async (request: PurchaseRequest, format: PdfDownloadFormat = 'configured') => {
    if (!canExportRequests) return;
    const pdfToastId = toast.loading('Generando PDF de la solicitud de compra...');
    try {
      const management = getActiveManagement(request);
      await generatePurchaseRecordPDF({
        format,
        targetKey: 'compras.purchase-request',
        document: {
          title: 'Solicitud de compra',
          number: request.number,
          date: request.date ? new Date(request.date).toLocaleDateString('es-NI') : undefined,
          status: STATUS_LABELS[normalizeRequestStatus(request.status)],
          supplier: request.supplier?.name || management?.supplier?.name || 'Sin proveedor',
          fields: [
            { label: 'Solicitante', value: `${request.requestedBy?.firstName || ''} ${request.requestedBy?.lastName || ''}`.trim() || '—' },
            { label: 'Bodega', value: request.warehouse?.name || '—' },
            { label: 'Prioridad', value: getPurchasePriorityOption(request.priority).label },
            { label: 'Fecha requerida', value: request.requiredDate ? new Date(request.requiredDate).toLocaleDateString('es-NI') : '—' },
            ...(management ? [{ label: 'Cotización', value: management.quotationNumber || '—' }, { label: 'Proveedor cotizado', value: management.supplier?.name || '—' }] : []),
          ],
          lines: management?.items?.length
            ? management.items.map((item: any) => ({ description: item.description || 'Artículo sin descripción', quantity: item.quantityProposed || item.quantityRequested || 0, unitPrice: formatRequestAmount(item.unitPrice, management.currency, management.exchangeRate), total: formatRequestAmount(item.total, management.currency, management.exchangeRate) }))
            : (request.items || []).map((item: any) => ({ description: item.description || item.name || 'Artículo sin descripción', quantity: item.quantity || 0, secondary: `Stock actual: ${item.currentStock ?? '—'} · Stock mínimo: ${item.minStock ?? '—'}` })),
          total: management ? formatRequestAmount(management.total, management.currency, management.exchangeRate) : undefined,
          totalLabel: 'Total cotizado',
          notes: request.notes || request.justification,
        },
        tenantName: user?.tenantName || 'Nova Hub',
        tenantLogo: user?.sessionBranding?.logo || null,
      });
      toast.success('PDF descargado', { id: pdfToastId });
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo generar el PDF', { id: pdfToastId });
    }
  };

  const buildRequestPanel = (request: PurchaseRequest): SalesDocumentPanelData => {
    const management = getActiveManagement(request);
    return {
      id: request.id,
      number: request.number,
      title: 'Solicitud de compra',
      customerName: request.supplier?.name || management?.supplier?.name || 'Sin proveedor',
      hideCustomer: true,
      status: normalizeRequestStatus(request.status),
      sourceLabel: management ? 'Gestión de compra' : undefined,
      totalLabel: management ? formatRequestAmount(management.total, management.currency, management.exchangeRate) : 'Sin cotización',
      sourceCurrency: management?.currency,
      sourceExchangeRate: management?.exchangeRate,
      summaryDetails: [
        { label: 'Artículos', value: String(request.items?.length || 0) },
        { label: 'Prioridad', value: getPurchasePriorityOption(request.priority).label },
        { label: 'Bodega', value: request.warehouse?.name || 'No indicada' },
      ],
      metadata: [
        { label: 'Solicitante', value: `${request.requestedBy?.firstName || ''} ${request.requestedBy?.lastName || ''}`.trim() || 'No disponible' },
        { label: 'Proveedor', value: request.supplier?.name || management?.supplier?.name || 'No asignado' },
        { label: 'Fecha requerida', value: request.requiredDate ? new Date(request.requiredDate).toLocaleDateString('es-NI') : 'No disponible' },
        ...(management ? [{ label: 'Cotización', value: management.quotationNumber || 'No indicada' }] : []),
      ],
      lines: management?.items?.length
        ? management.items.map((item: any, index) => ({ id: String(item.id || index), description: item.description || 'Artículo sin descripción', quantity: Number(item.quantityProposed || item.quantityRequested || 0), unitPriceLabel: formatRequestAmount(item.unitPrice, management.currency, management.exchangeRate), totalLabel: formatRequestAmount(item.total, management.currency, management.exchangeRate), secondaryLabel: `Solicitado: ${item.quantityRequested || 0} · Propuesto: ${item.quantityProposed || 0}` }))
        : (request.items || []).map((item: any, index) => ({ id: String(item.id || index), description: item.description || item.name || 'Artículo sin descripción', quantity: Number(item.quantity || 0), secondaryLabel: `Stock actual: ${item.currentStock ?? '—'} · Stock mínimo: ${item.minStock ?? '—'}` })),
      notes: request.notes || request.justification,
    };
  };

  const requestKpis = [
    { title: 'Solicitudes', value: data.length, icon: ClipboardList, color: 'text-blue-500', bg: 'bg-blue-500/10', kind: 'indicator' as const },
    { title: 'Pendientes', value: data.filter(r => normalizeRequestStatus(r.status) === 'PENDING_APPROVAL').length, icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10', kind: 'filter' as const, filter: 'PENDING_APPROVAL' },
    { title: 'Aprobadas', value: data.filter(r => normalizeRequestStatus(r.status) === 'APPROVED').length, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10', kind: 'filter' as const, filter: 'APPROVED' },
    { title: 'Anuladas', value: data.filter(r => normalizeRequestStatus(r.status) === 'CANCELLED').length, icon: Ban, color: 'text-rose-500', bg: 'bg-rose-500/10', kind: 'filter' as const, filter: 'CANCELLED' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="purchases-list-kpis">
        {requestKpis.map((k) => (
          <PurchaseKpiCard
            key={k.title}
            title={k.title}
            value={k.value}
            icon={k.icon}
            color={k.color}
            bg={k.bg}
            kind={k.kind}
            active={k.filter === statusFilter}
            onClick={k.filter ? () => {
              const next = statusFilter === k.filter ? 'all' : k.filter;
              setStatusFilter(next);
              onStatusChange?.(next);
            } : undefined}
          />
        ))}
      </div>
      <div className="flex flex-col gap-4">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ClipboardList className="size-6 text-primary" />
          <h2 className="text-xl font-black uppercase tracking-tight" data-tour="purchases-list-title">Solicitudes de Compra</h2>
          <Badge variant="secondary" className="text-xs">{data.length}</Badge>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
        <PdfDownloadButton label="Exportar" includeRoll={false} onDownload={(format) => void handleExportListPdf(format)} />
        <PurchaseViewTutorial view="requests" />
        <ViewLayoutSelect value={layoutMode} onChange={(value) => setLayoutMode(value === 'kanban' ? 'table' : value)} ariaLabel="Elegir distribución de solicitudes de compra" />
        </div>
      </div>

      <div className="erp-list-toolbar flex flex-col sm:flex-row gap-3" data-tour="purchases-list-actions">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Buscar por número, solicitante, proveedor, bodega..." value={search} onChange={e => { setSearch(e.target.value); onSearchChange?.(e.target.value); }} className="pl-9" />
        </div>
        {purchaseAlert && <PurchaseAlertsButton alert={purchaseAlert} onItemSelect={setHighlightedAlertId} />}
        <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); onStatusChange?.(value); }}>
          <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Filtrar por estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {REQUEST_STATUS_OPTIONS.map(s => (<SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Cargando...</CardContent></Card>
      ) : layoutMode !== 'cards' ? (
        <EditableDataTable
          data={filtered}
          columns={columns}
          isLoading={loading}
          pagination={pagination}
          layoutMode="responsive"
          highlightedRowId={highlightedAlertId}
          actionsWidth="w-64"
          onRowClick={(req) => setDetailOpen(req)}
          actions={(req) => renderRequestActions(req)}
        />
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No hay solicitudes de compra</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" data-tour="sales-data-cards">
          {filtered.map((req) => {
            const mgmt = getActiveManagement(req);
            return (
              <motion.article key={req.id} layout className={cn('overflow-hidden rounded-2xl border border-border/50 bg-card/70 shadow-sm', highlightedAlertId === String(req.id) && 'border-primary ring-2 ring-primary/40 bg-primary/10')}>
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-black text-primary">{req.number}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{new Date(req.date).toLocaleDateString()}</p>
                    </div>
                    <Badge variant="outline" className={cn('shrink-0 border-none px-2 py-0.5 text-[9px] font-black uppercase tracking-widest', STATUS_STYLES[normalizeRequestStatus(req.status)])}>
                      {STATUS_LABELS[normalizeRequestStatus(req.status)]}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Proveedor</p>
                      <p className="mt-1 truncate font-semibold">{req.supplier?.name || mgmt?.supplier?.name || 'Sin asignar'}</p>
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total</p>
                      <p className="mt-1 font-mono font-black">{mgmt ? formatRequestAmount(mgmt.total, mgmt.currency, mgmt.exchangeRate) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prioridad</p>
                      <PurchasePriorityBadge value={req.priority} className="mt-1" />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Artículos</p>
                      <p className="mt-1 font-semibold">{req.items?.length || 0}</p>
                    </div>
                  </div>
                  <div className="border-t border-border/30 pt-3">
                    <p className="truncate text-xs text-muted-foreground">
                      Solicitante: <span className="font-semibold text-foreground">{req.requestedBy?.firstName} {req.requestedBy?.lastName}</span>
                    </p>
                    <div className="mt-3">{renderRequestActions(req, true)}</div>
                  </div>
                </CardContent>
              </motion.article>
            );
          })}
        </div>
      )}
      </div>

      <SalesDocumentDetailSheet
        key={detailOpen?.id || 'purchase-request-detail'}
        document={detailOpen ? buildRequestPanel(detailOpen) : null}
        entity="PURCHASE_REQUEST"
        open={Boolean(detailOpen)}
        onClose={() => setDetailOpen(null)}
        extraActions={detailOpen && (() => {
          const management = getActiveManagement(detailOpen);
          return <>
            {management && management.status === 'PENDING_APPROVAL' && canApproveManagement && <Button type="button" variant="outline" className="gap-2 rounded-xl text-xs" onClick={() => handleApproveManagement(management)} disabled={actionLoading === management.id}><CheckCircle className="size-4" /> Aprobar gestión</Button>}
            {management && management.status === 'PENDING_APPROVAL' && canRejectManagement && <Button type="button" variant="outline" className="gap-2 rounded-xl text-xs text-rose-500" onClick={() => handleRejectManagement(management)} disabled={actionLoading === management.id}><X className="size-4" /> Rechazar gestión</Button>}
            {management && management.status === 'APPROVED' && canConvertManagement && <Button type="button" variant="outline" className="gap-2 rounded-xl text-xs text-primary" onClick={() => handleConvertToOrder(management)} disabled={actionLoading === management.id}><Send className="size-4" /> Convertir a orden</Button>}
          </>;
        })()}
        onDownloadPdf={canExportRequests ? (format) => detailOpen ? void handleDownloadRequestPdf(detailOpen, format) : undefined : undefined}
      />

      <PromptDialog
        open={Boolean(pendingRejectManagement)}
        onOpenChange={open => { if (!open && !actionLoading) setPendingRejectManagement(null); }}
        title="Rechazar gestión"
        description="Indica el motivo para que quede registrado en el historial de la gestión."
        label="Motivo del rechazo"
        placeholder="Escribe el motivo…"
        confirmLabel="Rechazar"
        onConfirm={confirmRejectManagement}
        loading={Boolean(actionLoading && pendingRejectManagement)}
      />
      <ConfirmDialog
        open={Boolean(pendingApproveManagement)}
        onOpenChange={open => { if (!open && !actionLoading) setPendingApproveManagement(null); }}
        title="¿Aprobar gestión de compra?"
        description="La gestión quedará aprobada y podrá convertirse en una orden de compra."
        confirmLabel="Aprobar gestión"
        variant="default"
        onConfirm={confirmApproveManagement}
        loading={Boolean(pendingApproveManagement && actionLoading === pendingApproveManagement.id)}
      />
      <ConfirmDialog
        open={Boolean(pendingRequestAction)}
        onOpenChange={open => { if (!open && !actionLoading) { setPendingRequestAction(null); setApprovalSupplierId(''); } }}
        title={requestActionPresentation?.action === 'approve' ? '¿Aprobar y enviar a orden de compra?' : '¿Anular solicitud?'}
        description={requestActionPresentation?.action === 'approve'
          ? 'Selecciona el proveedor. La solicitud quedará aprobada y se creará una orden de compra sin cambiar de vista.'
          : 'La solicitud quedará anulada y no podrá aprobarse desde este flujo.'}
        confirmLabel={requestActionPresentation?.action === 'approve' ? 'Aprobar y enviar' : 'Anular'}
        variant={requestActionPresentation?.action === 'cancel' ? 'destructive' : 'default'}
        onConfirm={confirmRequestAction}
        closeOnConfirm={false}
        disabled={pendingRequestAction?.action === 'approve' && !approvalSupplierId}
        loading={Boolean(pendingRequestAction && actionLoading === pendingRequestAction.request.id)}
      >
        {pendingRequestAction?.action === 'approve' && (
          <div className="mt-4 space-y-2 text-left">
            <Label htmlFor="purchase-request-approval-supplier" className="text-xs font-bold uppercase tracking-wider">
              Proveedor <span className="text-destructive">*</span>
            </Label>
            <Select value={approvalSupplierId} onValueChange={setApprovalSupplierId}>
              <SelectTrigger id="purchase-request-approval-supplier" className="h-11 w-full">
                <SelectValue placeholder="Seleccionar proveedor..." />
              </SelectTrigger>
              <SelectContent>
                {supplierCatalog.filter(supplier => String(supplier.status || '').toUpperCase() === 'ACTIVE' || supplier.id === approvalSupplierId).map(supplier => (
                  <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                ))}
                {supplierCatalog.filter(supplier => String(supplier.status || '').toUpperCase() === 'ACTIVE' || supplier.id === approvalSupplierId).length === 0 && (
                  <SelectItem value="__no_active_suppliers" disabled>No hay proveedores activos</SelectItem>
                )}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">El proveedor seleccionado quedará vinculado a la solicitud y a la orden de compra que se creará.</p>
          </div>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={Boolean(pendingConvertManagement)}
        onOpenChange={open => { if (!open && !actionLoading) setPendingConvertManagement(null); }}
        title="¿Generar orden de compra?"
        description="Se creará una orden de compra a partir de esta gestión aprobada."
        confirmLabel="Generar orden"
        variant="default"
        onConfirm={confirmConvertToOrder}
        loading={Boolean(actionLoading && pendingConvertManagement)}
      />

    </div>
  );
}
