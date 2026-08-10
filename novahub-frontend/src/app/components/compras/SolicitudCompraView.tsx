import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ClipboardList, Search, Eye, X, AlertTriangle,
  CheckCircle, FileDown, ThumbsUp, Ban,
  Building2, ArrowUpRight,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { purchaseRequestsService, purchaseManagementService } from '../../services/compras.service';
import type { PurchaseRequest, PurchaseManagement, Warehouse, PurchaseOrder } from '../../types';
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
import { generatePurchaseRequestPDF } from '../../utils/pdfGenerator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '../ui/sheet';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-muted/50 text-muted-foreground border-border/50',
  SUBMITTED: 'bg-primary/10 text-primary border-primary/20',
  RECEIVED: 'bg-primary/10 text-primary border-primary/20',
  IN_REVIEW: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  IN_QUOTATION: 'bg-primary/10 text-primary border-primary/20',
  PENDING_APPROVAL: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  APPROVED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  REJECTED: 'bg-red-500/10 text-red-500 border-red-500/20',
  RETURNED_FOR_CORRECTION: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  CONVERTED_TO_ORDER: 'bg-primary/10 text-primary border-primary/20',
  CLOSED: 'bg-muted/50 text-muted-foreground border-border/50',
  CANCELLED: 'bg-muted/50 text-muted-foreground border-border/50',
};

const PRIORITY_STYLES: Record<string, string> = {
  NORMAL: 'bg-primary/10 text-primary',
  URGENT: 'bg-amber-500/10 text-amber-500',
  CRITICAL: 'bg-red-500/10 text-red-500',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Pendiente', SUBMITTED: 'Pendiente', RECEIVED: 'Pendiente',
  IN_REVIEW: 'Pendiente', IN_QUOTATION: 'Pendiente',
  PENDING_APPROVAL: 'Pendiente', APPROVED: 'Aprobada',
  REJECTED: 'Anulada', RETURNED_FOR_CORRECTION: 'Pendiente',
  CONVERTED_TO_ORDER: 'Aprobada', CLOSED: 'Aprobada', CANCELLED: 'Anulada',
};

const REQUEST_STATUS_OPTIONS = ['PENDING_APPROVAL', 'APPROVED', 'CANCELLED'] as const;

function normalizeRequestStatus(status?: string): 'PENDING_APPROVAL' | 'APPROVED' | 'CANCELLED' {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'APPROVED' || normalized === 'CONVERTED_TO_ORDER' || normalized === 'CLOSED') return 'APPROVED';
  if (normalized === 'CANCELLED' || normalized === 'REJECTED') return 'CANCELLED';
  return 'PENDING_APPROVAL';
}

function requestWasSentToOrder(request: PurchaseRequest): boolean {
  return Boolean(
    request.purchaseOrder?.id
    || String(request.status || '').toUpperCase() === 'CONVERTED_TO_ORDER'
    || request.management?.some((management) => String(management.status || '').toUpperCase() === 'CONVERTED_TO_ORDER'),
  );
}

interface SolicitudCompraViewProps {
  data: PurchaseRequest[];
  loading?: boolean;
  onRefresh: () => void;
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  onStatusChange?: (value: string) => void;
  warehouseCatalog?: Warehouse[];
  onOpenOrderWithDraft?: (doc: Partial<PurchaseOrder>) => void;
}

export function SolicitudCompraView({ data, loading, onRefresh, pagination, onSearchChange, onStatusChange, onOpenOrderWithDraft }: SolicitudCompraViewProps) {
  const { user } = useAuth();
  const { exchangeRate: globalRate, displayCurrency, formatConvertedAmount } = useCurrency();
  const [search, setSearch] = useState('');
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('purchases-requests-layout', 'table', 24 * 365);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [detailOpen, setDetailOpen] = useState<PurchaseRequest | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingApproveManagement, setPendingApproveManagement] = useState<PurchaseManagement | null>(null);
  const [pendingRejectManagement, setPendingRejectManagement] = useState<PurchaseManagement | null>(null);
  const [pendingConvertManagement, setPendingConvertManagement] = useState<PurchaseManagement | null>(null);
  const [pendingRequestAction, setPendingRequestAction] = useState<{ request: PurchaseRequest; action: 'approve' | 'cancel' | 'send' } | null>(null);

  const filtered = useMemo(() => {
    return data.filter(r => {
      if (statusFilter !== 'all' && normalizeRequestStatus(r.status) !== statusFilter) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return r.number.toLowerCase().includes(s)
        || (r.requestedBy?.firstName?.toLowerCase().includes(s))
        || (r.requestedBy?.lastName?.toLowerCase().includes(s))
        || (r.warehouse?.name?.toLowerCase().includes(s))
        || (r.management?.[0]?.supplier?.name?.toLowerCase().includes(s));
    });
  }, [data, search, statusFilter]);

  const getActiveManagement = (pr: PurchaseRequest): PurchaseManagement | undefined =>
    pr.management?.[0];
  const actionButtonClass = 'rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors';
  const actionIconClass = 'size-3.5';

  const handleApproveManagement = (mgmt: PurchaseManagement) => {
    setPendingApproveManagement(mgmt);
  };

  const confirmApproveManagement = async () => {
    if (!pendingApproveManagement) return;
    const mgmt = pendingApproveManagement;
    setActionLoading(mgmt.id);
    try { await purchaseManagementService.approve(mgmt.id); toast.success('Gestión aprobada'); setPendingApproveManagement(null); onRefresh(); }
    catch (e: any) { toast.error(e?.message || 'Error al aprobar'); }
    finally { setActionLoading(null); }
  };

  const handleRejectManagement = async (mgmt: PurchaseManagement) => {
    setPendingRejectManagement(mgmt);
  };

  const confirmRejectManagement = async (rejectReason: string) => {
    if (!pendingRejectManagement) return;
    const mgmt = pendingRejectManagement;
    setActionLoading(mgmt.id);
    try { await purchaseManagementService.reject(mgmt.id, rejectReason || undefined); toast.success('Gestión rechazada'); setPendingRejectManagement(null); onRefresh(); }
    catch (e: any) { toast.error(e?.message || 'Error al rechazar'); }
    finally { setActionLoading(null); }
  };

  const handleConvertToOrder = async (mgmt: PurchaseManagement) => {
    setPendingConvertManagement(mgmt);
  };

  const confirmConvertToOrder = async () => {
    if (!pendingConvertManagement) return;
    const mgmt = pendingConvertManagement;
    setActionLoading(mgmt.id);
    try {
      const order = await purchaseManagementService.convertToOrder(mgmt.id);
      toast.success(`Orden de compra #${order.number} generada`);
      setPendingConvertManagement(null);
      onRefresh();
    } catch (e: any) { toast.error(e?.message || 'Error al convertir'); }
    finally { setActionLoading(null); }
  };

  const handleRequestApprove = (req: PurchaseRequest) => {
    if (normalizeRequestStatus(req.status) !== 'PENDING_APPROVAL') return;
    setPendingRequestAction({ request: req, action: 'approve' });
  };

  const handleRequestCancel = (req: PurchaseRequest) => {
    if (normalizeRequestStatus(req.status) !== 'PENDING_APPROVAL') return;
    setPendingRequestAction({ request: req, action: 'cancel' });
  };

  const handleRequestSend = (req: PurchaseRequest) => {
    if (normalizeRequestStatus(req.status) !== 'APPROVED' || requestWasSentToOrder(req)) return;
    setPendingRequestAction({ request: req, action: 'send' });
  };

  const confirmRequestAction = async () => {
    if (!pendingRequestAction) return;
    const { request: req, action } = pendingRequestAction;
    if (action === 'send') {
      handleOpenOrder(req);
      setPendingRequestAction(null);
      return;
    }
    setActionLoading(req.id);
    try {
      const nextStatus = action === 'approve' ? 'APPROVED' : 'CANCELLED';
      await purchaseRequestsService.changeStatus(req.id, nextStatus);
      toast.success(`${req.number} → ${action === 'approve' ? 'Aprobada' : 'Anulada'}`);
      setPendingRequestAction(null);
      onRefresh();
    } catch (e: any) { toast.error(e?.message || `Error al ${action === 'approve' ? 'aprobar' : 'anular'} la solicitud`); }
    finally { setActionLoading(null); }
  };

  const formatRequestAmount = (amount: number | string | undefined | null, currency?: string, rate?: number) =>
    formatConvertedAmount(Number(amount || 0), (currency || displayCurrency) as any, rate ?? globalRate);

  const handleDownloadRequestPdf = async (request: PurchaseRequest) => {
    try {
      await generatePurchaseRequestPDF({
        request,
        tenantName: user?.tenantName || 'Nova Hub',
        formatAmount: (amount, currency, rate) => formatRequestAmount(amount, currency, rate),
      });
      toast.success('PDF descargado');
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo generar el PDF');
    }
  };

  const handleOpenOrder = (request: PurchaseRequest) => {
    if (normalizeRequestStatus(request.status) !== 'APPROVED' || !onOpenOrderWithDraft) return;
    const requester = request.requestedBy
      ? `${request.requestedBy.firstName || ''} ${request.requestedBy.lastName || ''}`.trim()
      : (request.requestedById || 'Admin');
    onOpenOrderWithDraft({
      supplierId: '',
      date: new Date().toISOString(),
      expectedDelivery: request.requiredDate || new Date(Date.now() + 7 * 86400000).toISOString(),
      currency: displayCurrency,
      exchangeRate: globalRate,
      status: 'DRAFT',
      purchaseType: 'INVENTORY',
      isService: false,
      requestedBy: requester,
      address: '',
      purchaseRequestId: request.id,
      purchaseRequestNumber: request.number,
      notes: request.notes || request.justification || '',
      taxRate: 0,
      withholdingRate: 0,
      subtotal: 0,
      taxAmount: 0,
      withholdingTotal: 0,
      withholdingBase: 0,
      total: 0,
      items: (request.items || []).map((item: any) => ({
        productId: item.productId || null,
        code: item.product?.code || '',
        name: item.product?.name || item.description || '',
        description: item.description || item.product?.name || '',
        category: item.product?.category?.name || '',
        categoryId: item.product?.categoryId || null,
        stock: Number(item.currentStock || 0),
        quantity: Number(item.quantity || 0),
        unitPrice: 0,
        total: 0,
        taxType: 'GRAVADO',
        taxRate: 15,
        taxBase: 0,
        taxAmount: 0,
        withholdingType: 'NONE',
        withholdingRate: 0,
        withholdingBase: 0,
        accountId: null,
        costCenterId: null,
        stockApplies: true,
      })),
    } as Partial<PurchaseOrder>);
    setDetailOpen(null);
    toast.success('Solicitud enviada a orden de compra. Completa el proveedor y los precios.');
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
        <PurchaseViewTutorial view="requests" />
        <ViewLayoutSelect value={layoutMode} onChange={setLayoutMode} ariaLabel="Elegir distribución de solicitudes de compra" />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3" data-tour="purchases-list-actions">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Buscar por número, solicitante, proveedor, bodega..." value={search} onChange={e => { setSearch(e.target.value); onSearchChange?.(e.target.value); }} className="pl-9" />
        </div>
        {pagination && (
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground" data-tour="purchases-list-pagination">
            <span>Mostrando {filtered.length} de {pagination.total} solicitudes</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="size-8" onClick={() => pagination.onPageChange(pagination.page - 1)} disabled={pagination.page <= 1}><ChevronLeft className="size-4" /></Button>
              <span className="min-w-20 text-center font-bold text-foreground">Pág. {pagination.page} / {Math.max(1, pagination.totalPages)}</span>
              <Button variant="outline" size="icon" className="size-8" onClick={() => pagination.onPageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages}><ChevronRight className="size-4" /></Button>
            </div>
          </div>
        )}
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
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No hay solicitudes de compra</CardContent></Card>
      ) : layoutMode === 'table' ? (
        <div className="rounded-xl border border-border/40 overflow-hidden" data-tour="sales-data-table">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border/30">
                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">N°</th>
                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</th>
                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prioridad</th>
                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Proveedor</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total</th>
                  <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Items</th>
                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Solicitante</th>
                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha</th>
                  <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((req) => {
                  const mgmt = getActiveManagement(req);
                  return (
                    <motion.tr key={req.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="border-b border-border/10 hover:bg-muted/10 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-xs">{req.number}</td>
                      <td className="px-4 py-3">
                        <Badge className={cn('text-[9px] font-bold border whitespace-nowrap', STATUS_STYLES[normalizeRequestStatus(req.status)])}>
                          {STATUS_LABELS[normalizeRequestStatus(req.status)]}
                        </Badge>
                        {mgmt && mgmt.status === 'PENDING_APPROVAL' && (
                          <Badge className="ml-1 border-orange-500/20 bg-orange-500/10 text-[8px] text-orange-500">Gestión</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={cn('text-[9px]', PRIORITY_STYLES[req.priority])}>{req.priority}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs">{mgmt?.supplier?.name || <span className="text-muted-foreground/50">—</span>}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono font-bold">{mgmt ? formatRequestAmount(mgmt.total, mgmt.currency, mgmt.exchangeRate) : <span className="text-muted-foreground/50">—</span>}</td>
                      <td className="px-4 py-3 text-center text-xs">{req.items?.length || 0}</td>
                      <td className="px-4 py-3 text-xs">{req.requestedBy?.firstName} {req.requestedBy?.lastName}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(req.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <Button title="Descargar PDF" aria-label="Descargar PDF" variant="ghost" size="sm" className={cn(actionButtonClass, 'h-7 px-2')} onClick={() => void handleDownloadRequestPdf(req)}>
                            <FileDown className={actionIconClass} />
                          </Button>
                          <Button title="Ver detalle" aria-label="Ver detalle" variant="ghost" size="sm" className={cn(actionButtonClass, 'h-7 px-2')} onClick={() => setDetailOpen(req)}>
                            <Eye className={actionIconClass} />
                          </Button>
                          {normalizeRequestStatus(req.status) === 'PENDING_APPROVAL' && <>
                            <Button title="Aprobar solicitud" aria-label="Aprobar solicitud" variant="ghost" size="sm" className={cn(actionButtonClass, 'h-7 px-2')} onClick={() => handleRequestApprove(req)} disabled={actionLoading === req.id}>
                              <ThumbsUp className={actionIconClass} />
                            </Button>
                            <Button title="Anular solicitud" aria-label="Anular solicitud" variant="ghost" size="sm" className={cn(actionButtonClass, 'h-7 px-2')} onClick={() => handleRequestCancel(req)} disabled={actionLoading === req.id}>
                              <Ban className={actionIconClass} />
                            </Button>
                          </>}
                          {normalizeRequestStatus(req.status) === 'APPROVED' && !requestWasSentToOrder(req) && (
                            <Button title="Enviar a orden de compra" aria-label="Enviar a orden de compra" variant="ghost" size="sm" className={cn(actionButtonClass, 'h-7 px-2')} onClick={() => handleRequestSend(req)} disabled={actionLoading === req.id}>
                              <ArrowUpRight className={actionIconClass} />
                            </Button>
                          )}
                          {normalizeRequestStatus(req.status) !== 'CANCELLED' && mgmt?.status === 'PENDING_APPROVAL' && (
                            <>
                              <Button title="Aprobar gestión" aria-label="Aprobar gestión" variant="ghost" size="sm" className={cn(actionButtonClass, 'h-7 px-2')} onClick={() => handleApproveManagement(mgmt)} disabled={actionLoading === mgmt.id}>
                                <CheckCircle className={actionIconClass} />
                              </Button>
                              <Button title="Rechazar gestión" aria-label="Rechazar gestión" variant="ghost" size="sm" className={cn(actionButtonClass, 'h-7 px-2')} onClick={() => handleRejectManagement(mgmt)} disabled={actionLoading === mgmt.id}>
                                <X className={actionIconClass} />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" data-tour="sales-data-cards">
          {filtered.map((req) => {
            const mgmt = getActiveManagement(req);
            return (
              <motion.article key={req.id} layout className="overflow-hidden rounded-2xl border border-border/50 bg-card/70 shadow-sm">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-black text-primary">{req.number}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{new Date(req.date).toLocaleDateString()}</p>
                    </div>
                    <Badge className={cn('shrink-0 text-[9px] font-bold border', STATUS_STYLES[normalizeRequestStatus(req.status)])}>
                      {STATUS_LABELS[normalizeRequestStatus(req.status)]}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Proveedor</p>
                      <p className="mt-1 truncate font-semibold">{mgmt?.supplier?.name || 'Sin asignar'}</p>
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total</p>
                      <p className="mt-1 font-mono font-black">{mgmt ? formatRequestAmount(mgmt.total, mgmt.currency, mgmt.exchangeRate) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prioridad</p>
                      <Badge className={cn('mt-1 text-[9px]', PRIORITY_STYLES[req.priority])}>{req.priority}</Badge>
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
                    <div className="mt-3 flex flex-wrap justify-end gap-1">
                      <Button variant="ghost" size="sm" className={cn(actionButtonClass, 'h-8 px-2')} onClick={() => void handleDownloadRequestPdf(req)} title="Descargar PDF" aria-label="Descargar PDF">
                        <FileDown className={actionIconClass} />
                      </Button>
                      <Button variant="ghost" size="sm" className={cn(actionButtonClass, 'h-8 px-2')} onClick={() => setDetailOpen(req)} title="Ver detalle" aria-label="Ver detalle">
                        <Eye className={actionIconClass} />
                      </Button>
                      {normalizeRequestStatus(req.status) === 'PENDING_APPROVAL' && <>
                        <Button variant="ghost" size="sm" className={cn(actionButtonClass, 'h-8 px-2')} onClick={() => handleRequestApprove(req)} disabled={actionLoading === req.id} title="Aprobar solicitud" aria-label="Aprobar solicitud">
                          <ThumbsUp className={actionIconClass} />
                        </Button>
                        <Button variant="ghost" size="sm" className={cn(actionButtonClass, 'h-8 px-2')} onClick={() => handleRequestCancel(req)} disabled={actionLoading === req.id} title="Anular solicitud" aria-label="Anular solicitud">
                          <Ban className={actionIconClass} />
                        </Button>
                      </>}
                      {normalizeRequestStatus(req.status) === 'APPROVED' && !requestWasSentToOrder(req) && (
                        <Button variant="ghost" size="sm" className={cn(actionButtonClass, 'h-8 px-2')} onClick={() => handleRequestSend(req)} disabled={actionLoading === req.id} title="Enviar a orden de compra" aria-label="Enviar a orden de compra">
                          <ArrowUpRight className={actionIconClass} />
                        </Button>
                      )}
                      {normalizeRequestStatus(req.status) !== 'CANCELLED' && mgmt?.status === 'PENDING_APPROVAL' && (
                        <>
                          <Button variant="ghost" size="sm" className={cn(actionButtonClass, 'h-8 px-2')} onClick={() => handleApproveManagement(mgmt)} disabled={actionLoading === mgmt.id} title="Aprobar gestión">
                            <CheckCircle className={actionIconClass} />
                          </Button>
                          <Button variant="ghost" size="sm" className={cn(actionButtonClass, 'h-8 px-2')} onClick={() => handleRejectManagement(mgmt)} disabled={actionLoading === mgmt.id} title="Rechazar gestión">
                            <X className={actionIconClass} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </motion.article>
            );
          })}
        </div>
      )}
      </div>

      {/* Detail drawer */}
      <Sheet open={Boolean(detailOpen)} onOpenChange={(open) => { if (!open) setDetailOpen(null); }}>
        <SheetContent side="right" className="w-full gap-0 border-l border-border/50 bg-background p-0 sm:max-w-2xl">
          {detailOpen && (() => {
            const mgmt = getActiveManagement(detailOpen);
            const requestStatus = normalizeRequestStatus(detailOpen.status);
            return (
              <>
                <SheetHeader className="sticky top-0 z-10 space-y-3 border-b border-border/50 bg-background/95 px-5 py-5 pr-12 backdrop-blur-md sm:px-6">
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                      <ClipboardList className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <SheetTitle className="flex flex-wrap items-center gap-2 text-lg font-black uppercase tracking-tight">
                    Solicitud {detailOpen.number}
                        <Badge className={cn('text-[10px] font-bold border', STATUS_STYLES[requestStatus])}>
                          {STATUS_LABELS[requestStatus]}
                        </Badge>
                      </SheetTitle>
                      <SheetDescription className="mt-1 line-clamp-2 text-xs">
                        {detailOpen.justification || 'Solicitud generada desde inventario'}
                      </SheetDescription>
                    </div>
                  </div>
                  {mgmt && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>Gestión de compra</span>
                      <Badge className={cn('text-[10px] font-bold border', STATUS_STYLES[mgmt.status])}>
                        {STATUS_LABELS[mgmt.status] || mgmt.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  )}
                </SheetHeader>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div className="rounded-xl border border-border/50 bg-muted/20 p-3"><span className="text-[10px] font-bold uppercase text-muted-foreground">Solicitante</span><p className="mt-1 break-words font-medium">{detailOpen.requestedBy?.firstName} {detailOpen.requestedBy?.lastName}</p></div>
                    <div className="rounded-xl border border-border/50 bg-muted/20 p-3"><span className="text-[10px] font-bold uppercase text-muted-foreground">Bodega</span><p className="mt-1 break-words font-medium">{detailOpen.warehouse?.name || '—'}</p></div>
                    <div className="rounded-xl border border-border/50 bg-muted/20 p-3"><span className="text-[10px] font-bold uppercase text-muted-foreground">Prioridad</span><p className="mt-1"><Badge className={cn('text-[9px]', PRIORITY_STYLES[detailOpen.priority])}>{detailOpen.priority}</Badge></p></div>
                    <div className="rounded-xl border border-border/50 bg-muted/20 p-3"><span className="text-[10px] font-bold uppercase text-muted-foreground">Fecha requerida</span><p className="mt-1 font-medium">{detailOpen.requiredDate ? new Date(detailOpen.requiredDate).toLocaleDateString() : '—'}</p></div>
                  </div>

                  <section className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Artículos solicitados</h4>
                      <Badge variant="outline" className="text-[10px]">{detailOpen.items?.length || 0} artículos</Badge>
                    </div>
                    <div className="space-y-2">
                      {(detailOpen.items || []).map((item, i) => {
                        const managementItem = (mgmt?.items || []).find((candidate: any) => (
                          (candidate.productId && item.productId && candidate.productId === item.productId)
                          || (candidate.description && item.description && candidate.description === item.description)
                        ));
                        return (
                          <div key={item.id || i} className="rounded-xl border border-border/50 bg-card/60 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="break-words text-sm font-semibold">{item.description || 'Producto sin descripción'}</p>
                                <p className="mt-1 font-mono text-[10px] text-muted-foreground">{item.productId ? item.productId.slice(0, 8) : 'Sin código'}{mgmt?.supplier?.name ? ` · ${mgmt.supplier.name}` : ''}</p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="font-mono text-sm font-black">{item.quantity}</p>
                                <p className="text-[10px] text-muted-foreground">solicitadas</p>
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/30 pt-2 text-xs">
                              <span className="text-muted-foreground">Stock actual <b className="ml-1 text-foreground">{item.currentStock}</b></span>
                              <span className="text-right text-muted-foreground">Total <b className="ml-1 font-mono text-foreground">{managementItem ? formatRequestAmount(managementItem.total, mgmt?.currency, mgmt?.exchangeRate) : '—'}</b></span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {detailOpen.notes && <p className="rounded-xl border border-border/50 bg-muted/20 p-3 text-sm text-muted-foreground">Notas: {detailOpen.notes}</p>}

                  {mgmt && (
                    <section className="space-y-3 border-t border-border/50 pt-5">
                      <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary"><Building2 className="size-3.5" /> Gestión de compra</h4>
                      <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/50 bg-muted/20 p-4 text-sm sm:grid-cols-4">
                        <div><span className="text-[10px] font-bold uppercase text-muted-foreground">Proveedor</span><p className="mt-1 break-words font-medium">{mgmt.supplier?.name || '—'}</p></div>
                        <div><span className="text-[10px] font-bold uppercase text-muted-foreground">Cotización</span><p className="mt-1 font-mono">{mgmt.quotationNumber || '—'}</p></div>
                        <div><span className="text-[10px] font-bold uppercase text-muted-foreground">Total ({displayCurrency})</span><p className="mt-1 font-mono font-bold">{formatRequestAmount(mgmt.total, mgmt.currency, mgmt.exchangeRate)}</p></div>
                        <div><span className="text-[10px] font-bold uppercase text-muted-foreground">Moneda origen</span><p className="mt-1">{mgmt.currency || displayCurrency}</p></div>
                        <div><span className="text-[10px] font-bold uppercase text-muted-foreground">Contacto</span><p className="mt-1 break-words">{mgmt.supplierContact || '—'}</p></div>
                        <div><span className="text-[10px] font-bold uppercase text-muted-foreground">Pago</span><p className="mt-1 break-words">{mgmt.paymentTerms || '—'}{mgmt.creditDays ? ` (${mgmt.creditDays}d)` : ''}</p></div>
                        <div><span className="text-[10px] font-bold uppercase text-muted-foreground">Anticipo</span><p className="mt-1 font-mono">{formatRequestAmount(mgmt.advancePayment, mgmt.currency, mgmt.exchangeRate)}</p></div>
                        <div><span className="text-[10px] font-bold uppercase text-muted-foreground">Envío</span><p className="mt-1 font-mono">{formatRequestAmount(mgmt.shippingCost, mgmt.currency, mgmt.exchangeRate)}</p></div>
                      </div>

                      <div className="space-y-2">
                        {(mgmt.items || []).map((item, i) => (
                          <div key={item.id || i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-xl border border-border/50 p-3 text-xs">
                            <div className="min-w-0"><p className="break-words font-semibold">{item.description}</p><p className="mt-1 text-muted-foreground">Solicitado {item.quantityRequested} · Propuesto {item.quantityProposed} · Dto. {item.discount}%</p></div>
                            <div className="text-right"><p className="font-mono">{formatRequestAmount(item.unitPrice, mgmt.currency, mgmt.exchangeRate)} / ud.</p><p className="mt-1 font-mono font-bold text-primary">{formatRequestAmount(item.total, mgmt.currency, mgmt.exchangeRate)}</p></div>
                          </div>
                        ))}
                      </div>
                      {mgmt.internalNotes && <p className="text-sm text-muted-foreground">Notas internas: {mgmt.internalNotes}</p>}
                      {mgmt.notes && <p className="text-sm text-muted-foreground">Notas: {mgmt.notes}</p>}
                      {mgmt.approvedBy && <p className="text-sm text-muted-foreground">Aprobado por: {mgmt.approvedBy.name} {mgmt.approvedAt ? `el ${new Date(mgmt.approvedAt).toLocaleDateString()}` : ''}</p>}
                      {mgmt.rejectionReason && <p className="text-sm text-red-500">Motivo de rechazo: {mgmt.rejectionReason}</p>}
                    </section>
                  )}
                </div>

                <SheetFooter className="border-t border-border/50 bg-background px-5 py-4 sm:px-6">
                  <div className="w-full">
                    <Button variant="outline" className="h-10 w-full gap-2" onClick={() => void handleDownloadRequestPdf(detailOpen)}>
                      <FileDown className="size-4" /> Descargar PDF
                    </Button>
                  </div>
                </SheetFooter>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

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
        onOpenChange={open => { if (!open && !actionLoading) setPendingRequestAction(null); }}
        title={pendingRequestAction?.action === 'approve' ? '¿Aprobar solicitud?' : pendingRequestAction?.action === 'cancel' ? '¿Anular solicitud?' : '¿Enviar a orden de compra?'}
        description={pendingRequestAction?.action === 'approve'
          ? 'La solicitud quedará aprobada y ya no podrá volver a pendiente.'
          : pendingRequestAction?.action === 'cancel'
            ? 'La solicitud quedará anulada y no podrá aprobarse desde este flujo.'
            : 'Se abrirá una orden de compra con los artículos precargados para completar proveedor y precios.'}
        confirmLabel={pendingRequestAction?.action === 'approve' ? 'Aprobar' : pendingRequestAction?.action === 'cancel' ? 'Anular' : 'Enviar a orden'}
        variant={pendingRequestAction?.action === 'cancel' ? 'destructive' : 'default'}
        onConfirm={confirmRequestAction}
        loading={Boolean(pendingRequestAction && actionLoading === pendingRequestAction.request.id)}
      />
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
