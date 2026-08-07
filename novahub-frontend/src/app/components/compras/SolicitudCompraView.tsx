import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ClipboardList, Search, Eye, X, AlertTriangle,
  CheckCircle, Clock, Printer,
  Building2, ArrowUpRight,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { purchaseRequestsService, purchaseManagementService, suppliersService } from '../../services/compras.service';
import { inventoryService } from '../../services/inventario.service';
import type { PurchaseRequest, PurchaseManagement, Warehouse, PurchaseOrder } from '../../types';
import type { SalesPaginationControls } from '../../types';
import { cn } from '../ui/utils';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PromptDialog } from '../ui/PromptDialog';
import { PurchaseKpiCard } from './PurchaseKpiCard';
import { PurchaseViewTutorial } from './PurchaseViewTutorial';

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
  DRAFT: 'Borrador', SUBMITTED: 'Enviado', RECEIVED: 'Recibido',
  IN_REVIEW: 'En Revisión', IN_QUOTATION: 'En Cotización',
  PENDING_APPROVAL: 'Pendiente Aprobación', APPROVED: 'Aprobado',
  REJECTED: 'Rechazado', RETURNED_FOR_CORRECTION: 'Devuelto',
  CONVERTED_TO_ORDER: 'Convertido a OC', CLOSED: 'Cerrado', CANCELLED: 'Anulado',
};

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
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [detailOpen, setDetailOpen] = useState<PurchaseRequest | null>(null);
  const [statusChangeOpen, setStatusChangeOpen] = useState(false);
  const [selectedForStatus, setSelectedForStatus] = useState<PurchaseRequest | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [reason, setReason] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingRejectManagement, setPendingRejectManagement] = useState<PurchaseManagement | null>(null);
  const [pendingConvertManagement, setPendingConvertManagement] = useState<PurchaseManagement | null>(null);
  const [pendingRejectRequest, setPendingRejectRequest] = useState<PurchaseRequest | null>(null);
  const [pendingOrderRequest, setPendingOrderRequest] = useState<PurchaseRequest | null>(null);
  const [orderSuppliers, setOrderSuppliers] = useState<any[]>([]);
  const [orderSupplierId, setOrderSupplierId] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderCategories, setOrderCategories] = useState<any[]>([]);

  const filtered = useMemo(() => {
    return data.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
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

  const allowedTransitions: Record<string, string[]> = {
    DRAFT: ['SUBMITTED', 'CANCELLED'],
    SUBMITTED: ['RECEIVED', 'IN_REVIEW', 'CANCELLED'],
    RECEIVED: ['IN_REVIEW', 'CANCELLED'],
    IN_REVIEW: ['IN_QUOTATION', 'RETURNED_FOR_CORRECTION', 'CANCELLED'],
    IN_QUOTATION: ['PENDING_APPROVAL', 'RETURNED_FOR_CORRECTION', 'CANCELLED'],
    PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'RETURNED_FOR_CORRECTION'],
    APPROVED: ['CLOSED', 'CONVERTED_TO_ORDER'],
    RETURNED_FOR_CORRECTION: ['IN_REVIEW', 'CANCELLED'],
    REJECTED: ['IN_REVIEW', 'CANCELLED'],
    CLOSED: [], CONVERTED_TO_ORDER: [], CANCELLED: [],
  };

  const handleStatusChange = async () => {
    if (!selectedForStatus || !newStatus) return;
    setStatusLoading(true);
    try {
      await purchaseRequestsService.changeStatus(selectedForStatus.id, newStatus, reason || undefined);
      toast.success(`${selectedForStatus.number} → ${STATUS_LABELS[newStatus] || newStatus}`);
      setStatusChangeOpen(false);
      setSelectedForStatus(null); setNewStatus(''); setReason('');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || 'Error al cambiar estado');
    } finally { setStatusLoading(false); }
  };

  const handleApproveManagement = async (mgmt: PurchaseManagement) => {
    setActionLoading(mgmt.id);
    try { await purchaseManagementService.approve(mgmt.id); toast.success('Gestión aprobada'); onRefresh(); }
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

  const handleRequestGoInReview = async (req: PurchaseRequest) => {
    setActionLoading(req.id);
    try {
      await purchaseRequestsService.changeStatus(req.id, 'IN_REVIEW');
      toast.success(`${req.number} → En Revisión`);
      onRefresh();
    } catch (e: any) { toast.error(e?.message || 'Error al cambiar estado'); }
    finally { setActionLoading(null); }
  };

  const handleRequestReject = (req: PurchaseRequest) => {
    setPendingRejectRequest(req);
  };

  const confirmRequestReject = async (rejectReason: string) => {
    if (!pendingRejectRequest) return;
    const req = pendingRejectRequest;
    setActionLoading(req.id);
    try {
      await purchaseRequestsService.changeStatus(req.id, 'REJECTED', rejectReason || undefined);
      toast.success(`${req.number} → Rechazado`);
      setPendingRejectRequest(null);
      onRefresh();
    } catch (e: any) { toast.error(e?.message || 'Error al rechazar'); }
    finally { setActionLoading(null); }
  };

  const handleRequestApproveAndOrder = async (req: PurchaseRequest) => {
    setPendingOrderRequest(req);
    setOrderSupplierId('');
    try {
      const [res, catRes] = await Promise.all([
        suppliersService.getAll({ page: 1, pageSize: 200 }),
        inventoryService.getCategories(),
      ]);
      const list = Array.isArray(res) ? res : ((res as any)?.data || []);
      if (list.length > 0) setOrderSupplierId(list[0]?.id || '');
      setOrderSuppliers(list);
const cats = Array.isArray(catRes) ? catRes : ((catRes as any)?.data || []);
      setOrderCategories(cats);
    } catch { setOrderSuppliers([]); setOrderCategories([]); }
  };

  const confirmRequestApproveAndOrder = async () => {
    if (!pendingOrderRequest) return;
    const req = pendingOrderRequest;
    if (!orderSupplierId) { toast.error('Selecciona un proveedor'); return; }
    setOrderLoading(true);
    try {
      const categoryMap = new Map(orderCategories.map((c: any) => [c.id, c.name || c._name]));
      const requester = req.requestedBy
        ? `${req.requestedBy.firstName || ''} ${req.requestedBy.lastName || ''}`.trim()
        : (req.requestedById || 'Admin');
      const items = (req.items || []).map((it: any) => {
        const product = it.product || {};
        const categoryId = product.categoryId || it.categoryId || null;
        return {
          productId: it.productId || product.id || null,
          code: product.code || product.sku || it.code || '',
          name: product.name || it.description || it.productName || '',
          description: it.description || product.name || '',
          category: categoryId ? (categoryMap.get(categoryId) || '') : (product.category?.name || ''),
          categoryId,
          stock: Number(it.currentStock ?? 0),
          quantity: Number(it.quantity ?? 1),
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
        };
      });
      const orderDoc: any = {
        supplierId: orderSupplierId,
        date: new Date().toISOString(),
        expectedDelivery: new Date(Date.now() + 7 * 86400000).toISOString(),
        currency: 'NIO',
        exchangeRate: 1,
        status: 'DRAFT',
        purchaseType: 'INVENTORY',
        isService: false,
        requestedBy: requester,
        address: '',
        purchaseRequestId: req.id,
        purchaseRequestNumber: req.number,
        notes: req.notes || req.justification || '',
        taxRate: 0,
        withholdingRate: 0,
        subtotal: 0,
        taxAmount: 0,
        withholdingTotal: 0,
        withholdingBase: 0,
        total: 0,
        items,
      };
      setPendingOrderRequest(null);
      setOrderSupplierId('');
      onOpenOrderWithDraft?.(orderDoc as Partial<PurchaseOrder>);
      toast.success('Solicitud enviada. Completa y guarda la orden de compra para aprobarla.');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || 'Error al preparar la orden de compra');
    } finally {
      setOrderLoading(false);
    }
  };

  const requestIsTerminal = (status?: string) =>
    status === 'REJECTED' || status === 'CLOSED' || status === 'CONVERTED_TO_ORDER' || status === 'CANCELLED';

  const fm = (n: number | string | undefined | null) =>
    new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));

  const statusOptions = Object.keys(STATUS_STYLES);
  const requestKpis = [
    { title: 'Solicitudes', value: data.length, icon: ClipboardList, color: 'text-blue-500', bg: 'bg-blue-500/10', kind: 'indicator' as const },
    { title: 'Pendientes', value: data.filter(r => r.status === 'PENDING_APPROVAL').length, icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10', kind: 'filter' as const, filter: 'PENDING_APPROVAL' },
    { title: 'En Revisión', value: data.filter(r => r.status === 'IN_REVIEW').length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', kind: 'filter' as const, filter: 'IN_REVIEW' },
    { title: 'Aprobadas', value: data.filter(r => r.status === 'APPROVED').length, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10', kind: 'filter' as const, filter: 'APPROVED' },
    { title: 'Rechazadas', value: data.filter(r => r.status === 'REJECTED').length, icon: X, color: 'text-rose-500', bg: 'bg-rose-500/10', kind: 'filter' as const, filter: 'REJECTED' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" data-tour="purchases-list-kpis">
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
            {statusOptions.map(s => (<SelectItem key={s} value={s}>{STATUS_LABELS[s] || s.replace(/_/g, ' ')}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Cargando...</CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No hay solicitudes de compra</CardContent></Card>
      ) : (
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
                        <Badge className={cn('text-[9px] font-bold border whitespace-nowrap', STATUS_STYLES[req.status])}>
                          {STATUS_LABELS[req.status] || req.status.replace(/_/g, ' ')}
                        </Badge>
                        {mgmt && mgmt.status === 'PENDING_APPROVAL' && (
                          <Badge className="ml-1 border-orange-500/20 bg-orange-500/10 text-[8px] text-orange-500">Gestión</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={cn('text-[9px]', PRIORITY_STYLES[req.priority])}>{req.priority}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs">{mgmt?.supplier?.name || <span className="text-muted-foreground/50">—</span>}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono font-bold">{mgmt ? fm(mgmt.total) : <span className="text-muted-foreground/50">—</span>}</td>
                      <td className="px-4 py-3 text-center text-xs">{req.items?.length || 0}</td>
                      <td className="px-4 py-3 text-xs">{req.requestedBy?.firstName} {req.requestedBy?.lastName}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(req.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setDetailOpen(req)}>
                            <Eye className="size-3.5" />
                          </Button>
                          {allowedTransitions[req.status]?.length > 0 && (
                            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => { setSelectedForStatus(req); setNewStatus(''); setReason(''); setStatusChangeOpen(true); }}>
                              <Clock className="size-3.5" />
                            </Button>
                          )}
                          {mgmt?.status === 'PENDING_APPROVAL' && (
                            <>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-emerald-600 hover:text-emerald-700" onClick={() => handleApproveManagement(mgmt)} disabled={actionLoading === mgmt.id}>
                                <CheckCircle className="size-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-red-500 hover:text-red-400" onClick={() => handleRejectManagement(mgmt)} disabled={actionLoading === mgmt.id}>
                                <X className="size-3.5" />
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
      )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailOpen} onOpenChange={(o) => { if (!o) setDetailOpen(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          {detailOpen && (() => {
            const mgmt = getActiveManagement(detailOpen);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 flex-wrap">
                    Solicitud {detailOpen.number}
                    <Badge className={cn('text-[10px] font-bold border', STATUS_STYLES[detailOpen.status])}>
                      {STATUS_LABELS[detailOpen.status] || detailOpen.status.replace(/_/g, ' ')}
                    </Badge>
                    {mgmt && (
                      <Badge className={cn('text-[10px] font-bold border', STATUS_STYLES[mgmt.status])}>
                        Gestión: {STATUS_LABELS[mgmt.status] || mgmt.status.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </DialogTitle>
                  <DialogDescription>{detailOpen.justification || 'Sin justificación'}</DialogDescription>
                </DialogHeader>

                {/* Solicitud Info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm p-4 rounded-xl bg-muted/20">
                  <div><span className="text-muted-foreground text-[10px] font-bold uppercase">Solicitante</span><p className="font-medium">{detailOpen.requestedBy?.firstName} {detailOpen.requestedBy?.lastName}</p></div>
                  <div><span className="text-muted-foreground text-[10px] font-bold uppercase">Bodega</span><p className="font-medium">{detailOpen.warehouse?.name || '—'}</p></div>
                  <div><span className="text-muted-foreground text-[10px] font-bold uppercase">Prioridad</span><p><Badge className={cn('text-[9px]', PRIORITY_STYLES[detailOpen.priority])}>{detailOpen.priority}</Badge></p></div>
                  <div><span className="text-muted-foreground text-[10px] font-bold uppercase">Fecha Requerida</span><p className="font-medium">{detailOpen.requiredDate ? new Date(detailOpen.requiredDate).toLocaleDateString() : '—'}</p></div>
                </div>

                {/* Items */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Artículos Solicitados</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-muted/30"><th className="text-left p-2 text-[10px] font-bold">Producto</th><th className="text-left p-2 text-[10px] font-bold">Descripción</th><th className="text-right p-2 text-[10px] font-bold">Cant.</th><th className="text-right p-2 text-[10px] font-bold">Stock</th><th className="text-left p-2 text-[10px] font-bold">Proveedor</th><th className="text-right p-2 text-[10px] font-bold">Total</th></tr></thead>
                      <tbody>
                        {detailOpen.items.map((item, i) => (
                          <tr key={item.id || i} className="border-t">
                            <td className="p-2 text-xs font-mono">{item.productId ? item.productId.slice(0, 8) : '—'}</td>
                            <td className="p-2 text-xs">{item.description}</td>
                            <td className="p-2 text-right text-xs font-mono">{item.quantity}</td>
                            <td className="p-2 text-right text-xs font-mono">{item.currentStock}</td>
                            <td className="p-2 text-xs">{mgmt?.supplier?.name || '—'}</td>
                            <td className="p-2 text-right text-xs font-mono">{mgmt ? fm(mgmt.total) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {detailOpen.notes && <p className="text-sm text-muted-foreground">Notas: {detailOpen.notes}</p>}

                {/* Management Section */}
                {mgmt && (
                  <div className="border-t pt-4 mt-2">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                      <Building2 className="size-3.5" /> Gestión de Compra
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm p-4 rounded-xl bg-muted/20 mb-3">
                      <div><span className="text-muted-foreground text-[10px] font-bold uppercase">Proveedor</span><p className="font-medium">{mgmt.supplier?.name || '—'}</p></div>
                      <div><span className="text-muted-foreground text-[10px] font-bold uppercase">Cotización</span><p className="font-mono">{mgmt.quotationNumber || '—'}</p></div>
                      <div><span className="text-muted-foreground text-[10px] font-bold uppercase">Total</span><p className="font-bold font-mono">{fm(mgmt.total)}</p></div>
                      <div><span className="text-muted-foreground text-[10px] font-bold uppercase">Moneda</span><p>{mgmt.currency}</p></div>
                      <div><span className="text-muted-foreground text-[10px] font-bold uppercase">Contacto</span><p>{mgmt.supplierContact || '—'}</p></div>
                      <div><span className="text-muted-foreground text-[10px] font-bold uppercase">Pago</span><p>{mgmt.paymentTerms || '—'}{mgmt.creditDays ? ` (${mgmt.creditDays}d)` : ''}</p></div>
                      <div><span className="text-muted-foreground text-[10px] font-bold uppercase">Anticipo</span><p className="font-mono">{fm(mgmt.advancePayment)}</p></div>
                      <div><span className="text-muted-foreground text-[10px] font-bold uppercase">Envío</span><p className="font-mono">{fm(mgmt.shippingCost)}</p></div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead><tr className="bg-muted/30"><th className="text-left p-2 text-[10px] font-bold">Producto</th><th className="text-left p-2 text-[10px] font-bold">Descripción</th><th className="text-right p-2 text-[10px] font-bold">Sol.</th><th className="text-right p-2 text-[10px] font-bold">Prop.</th><th className="text-right p-2 text-[10px] font-bold">Precio</th><th className="text-right p-2 text-[10px] font-bold">Dto%</th><th className="text-right p-2 text-[10px] font-bold">Total</th></tr></thead>
                        <tbody>
                          {(mgmt.items || []).map((item, i) => (
                            <tr key={item.id || i} className="border-t">
                              <td className="p-2 text-xs font-mono">{item.productId?.slice(0, 8) || '—'}</td>
                              <td className="p-2 text-xs">{item.description}</td>
                              <td className="p-2 text-right text-xs font-mono">{item.quantityRequested}</td>
                              <td className="p-2 text-right text-xs font-mono">{item.quantityProposed}</td>
                              <td className="p-2 text-right text-xs font-mono">{fm(item.unitPrice)}</td>
                              <td className="p-2 text-right text-xs font-mono">{item.discount}%</td>
                              <td className="p-2 text-right text-xs font-mono font-bold">{fm(item.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {mgmt.internalNotes && <p className="text-sm text-muted-foreground mt-2">Notas internas: {mgmt.internalNotes}</p>}
                    {mgmt.notes && <p className="text-sm text-muted-foreground">Notas: {mgmt.notes}</p>}
                    {mgmt.approvedBy && <p className="text-sm text-muted-foreground mt-2">Aprobado por: {mgmt.approvedBy.name} {mgmt.approvedAt ? `el ${new Date(mgmt.approvedAt).toLocaleDateString()}` : ''}</p>}
                    {mgmt.rejectionReason && <p className="mt-2 text-sm text-red-500">Motivo de rechazo: {mgmt.rejectionReason}</p>}
                  </div>
                )}

                <DialogFooter className="gap-2">
                  {detailOpen && (() => {
                    const isApproved = detailOpen.status === 'APPROVED' || detailOpen.status === 'CONVERTED_TO_ORDER';
                    const busy = actionLoading === detailOpen.id;
                    return (
                      <div className="mb-3 flex w-full flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 print:hidden">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Acciones de la solicitud</span>
                          <Button variant="outline" size="sm" className="h-9 shrink-0 px-3" onClick={() => window.print()} disabled={!isApproved} title={isApproved ? 'Imprimir solicitud' : 'Solo se puede imprimir cuando la solicitud está aprobada'}>
                            <Printer className="size-3.5 mr-1.5" /> Imprimir
                          </Button>
                        </div>
                        {!requestIsTerminal(detailOpen.status) && (
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_auto_1fr]">
                            <Button variant="outline" size="sm" className="h-9 justify-center whitespace-nowrap px-3 text-amber-600 text-xs" onClick={() => handleRequestGoInReview(detailOpen)} disabled={isApproved || busy}>
                              <Clock className="size-3.5 mr-1.5" /> En revisión
                            </Button>
                            <Button variant="outline" size="sm" className="h-9 justify-center whitespace-nowrap px-3 text-red-600 text-xs" onClick={() => handleRequestReject(detailOpen)} disabled={isApproved || busy}>
                              <X className="size-3.5 mr-1.5" /> Rechazar
                            </Button>
                            <Button size="sm" className="h-9 w-full justify-center whitespace-nowrap px-3 text-xs" onClick={() => handleRequestApproveAndOrder(detailOpen)} disabled={isApproved || busy}>
                              <CheckCircle className="size-3.5 mr-1.5" /> Aprobar y enviar a OC
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={statusChangeOpen} onOpenChange={(o) => { if (!o) { setStatusChangeOpen(false); setSelectedForStatus(null); }}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Estado</DialogTitle>
            <DialogDescription>
              {selectedForStatus?.number} — Estado actual: {STATUS_LABELS[selectedForStatus?.status || ''] || selectedForStatus?.status?.replace(/_/g, ' ')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nuevo estado</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue placeholder="Seleccionar estado..." /></SelectTrigger>
                <SelectContent>
                  {allowedTransitions[selectedForStatus?.status || '']?.map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s] || s.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(newStatus === 'REJECTED' || newStatus === 'RETURNED_FOR_CORRECTION' || newStatus === 'CANCELLED') && (
              <div>
                <label className="text-sm font-medium">Motivo</label>
                <textarea className="w-full min-h-[80px] rounded-lg border border-input bg-background p-3 text-sm" value={reason} onChange={e => setReason(e.target.value)} placeholder="Indique el motivo..." />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStatusChangeOpen(false)}>Cancelar</Button>
            <Button onClick={handleStatusChange} disabled={!newStatus || statusLoading}>{statusLoading ? 'Actualizando...' : 'Actualizar Estado'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
      <PromptDialog
        open={Boolean(pendingRejectRequest)}
        onOpenChange={open => { if (!open && !actionLoading) setPendingRejectRequest(null); }}
        title="Rechazar solicitud"
        description="Indica el motivo para que quede registrado en el historial de la solicitud."
        label="Motivo del rechazo"
        placeholder="Escribe el motivo…"
        confirmLabel="Rechazar"
        onConfirm={confirmRequestReject}
        loading={Boolean(actionLoading && pendingRejectRequest)}
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

      <Dialog open={Boolean(pendingOrderRequest)} onOpenChange={(o) => { if (!o && !orderLoading) { setPendingOrderRequest(null); setOrderSupplierId(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="size-4 text-emerald-600" /> Aprobar y enviar a orden de compra
            </DialogTitle>
            <DialogDescription>
              {pendingOrderRequest?.number} — se abrirá el modal de nueva orden de compra con sus artículos precargados. La solicitud se aprobará solo cuando guardes la orden. Selecciona el proveedor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold">Proveedor *</label>
              <Select value={orderSupplierId} onValueChange={setOrderSupplierId} disabled={orderLoading}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar proveedor..." /></SelectTrigger>
                <SelectContent>
                  {orderSuppliers.length === 0 && <SelectItem value="__none__" disabled>No hay proveedores registrados</SelectItem>}
                  {orderSuppliers.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Se crearán {pendingOrderRequest?.items?.length || 0} artículo(s). Los precios se podrán ajustar en la orden de compra.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setPendingOrderRequest(null); setOrderSupplierId(''); }} disabled={orderLoading}>Cancelar</Button>
            <Button onClick={confirmRequestApproveAndOrder} disabled={orderLoading || !orderSupplierId}>
              {orderLoading && <span className="mr-2 inline-block size-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              Abrir orden de compra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
