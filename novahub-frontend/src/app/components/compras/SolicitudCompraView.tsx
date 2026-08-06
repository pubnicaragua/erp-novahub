import { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  ClipboardList, Search, Eye, X,
  CheckCircle, Clock, Printer,
  Building2, ArrowUpRight, Plus,
  Loader2, Package,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { purchaseRequestsService, purchaseManagementService } from '../../services/compras.service';
import { inventoryService } from '../../services/inventario.service';
import type { PurchaseRequest, PurchaseManagement, Warehouse } from '../../types';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PromptDialog } from '../ui/PromptDialog';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  SUBMITTED: 'bg-blue-100 text-blue-700 border-blue-200',
  RECEIVED: 'bg-purple-100 text-purple-700 border-purple-200',
  IN_REVIEW: 'bg-amber-100 text-amber-700 border-amber-200',
  IN_QUOTATION: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  PENDING_APPROVAL: 'bg-orange-100 text-orange-700 border-orange-200',
  APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
  RETURNED_FOR_CORRECTION: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  CONVERTED_TO_ORDER: 'bg-teal-100 text-teal-700 border-teal-200',
  CLOSED: 'bg-slate-100 text-slate-700 border-slate-200',
  CANCELLED: 'bg-gray-100 text-gray-400 border-gray-200',
};

const PRIORITY_STYLES: Record<string, string> = {
  NORMAL: 'bg-blue-100 text-blue-700',
  URGENT: 'bg-amber-100 text-amber-700',
  CRITICAL: 'bg-red-100 text-red-700',
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
}

export function SolicitudCompraView({ data, loading, onRefresh }: SolicitudCompraViewProps) {
  const { user } = useAuth();
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

  const fm = (n: number | string | undefined | null) =>
    new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));

  const statusOptions = Object.keys(STATUS_STYLES);

  // ─── Nueva Solicitud ──────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [createForm, setCreateForm] = useState({
    priority: 'NORMAL' as string,
    justification: '',
    warehouseId: '',
    requiredDate: '',
    notes: '',
  });
  const [createItems, setCreateItems] = useState<Array<{
    productId: string; productName: string; description: string; quantity: number; observations: string;
    currentStock: number; minStock: number;
  }>>([]);
  const [creating, setCreating] = useState(false);

  const loadWarehouses = async () => {
    try {
      const res = await inventoryService.getWarehouses();
      setWarehouses(Array.isArray(res) ? res : []);
    } catch { /* ignore */ }
  };

  const searchProducts = async (q: string) => {
    if (!q || q.length < 2) { setProducts([]); return; }
    try {
      const res = await inventoryService.getProducts({ search: q, pageSize: 10 });
      const list = Array.isArray(res) ? res : (res as any)?.data || [];
      setProducts(list);
    } catch { setProducts([]); }
  };

  useEffect(() => {
    const timer = setTimeout(() => searchProducts(productSearch), 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const addItem = (product: any) => {
    setCreateItems(prev => [...prev, {
      productId: product.id, productName: product.name, description: product.name,
      quantity: 1, observations: '', currentStock: Number(product.stock || 0),
      minStock: Number(product.minStock || 0),
    }]);
    setProductSearch('');
    setProducts([]);
  };

  const updateItem = (idx: number, patch: Partial<typeof createItems[0]>) => {
    setCreateItems(prev => prev.map((item, i) => i === idx ? { ...item, ...patch } : item));
  };

  const removeItem = (idx: number) => {
    setCreateItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCreate = async () => {
    if (createItems.length === 0) { toast.error('Agrega al menos un artículo'); return; }
    if (!createForm.warehouseId) { toast.error('Selecciona una bodega'); return; }
    setCreating(true);
    try {
      const payload = {
        priority: createForm.priority,
        justification: createForm.justification || undefined,
        warehouseId: createForm.warehouseId,
        requiredDate: createForm.requiredDate || undefined,
        notes: createForm.notes || undefined,
        requestedById: user?.id,
        items: createItems.map(item => ({
          productId: item.productId, description: item.description,
          quantity: item.quantity, observations: item.observations || undefined,
          currentStock: item.currentStock, minStock: item.minStock,
          warehouseId: createForm.warehouseId,
        })),
      };
      await purchaseRequestsService.create(payload as any);
      toast.success('Solicitud de compra creada');
      setCreateOpen(false);
      setCreateForm({ priority: 'NORMAL', justification: '', warehouseId: '', requiredDate: '', notes: '' });
      setCreateItems([]);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || 'Error al crear solicitud');
    } finally {
      setCreating(false);
    }
  };

  const openCreateDialog = () => {
    loadWarehouses();
    setCreateOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ClipboardList className="size-6 text-primary" />
          <h2 className="text-xl font-bold">Solicitudes de Compra</h2>
          <Badge variant="secondary" className="text-xs">{data.length}</Badge>
        </div>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="size-3.5 mr-1" /> Nueva Solicitud
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Buscar por número, solicitante, proveedor, bodega..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
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
        <div className="rounded-xl border border-border/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border/30">
                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">N°</th>
                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</th>
                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prioridad</th>
                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Proveedor</th>
                  <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cotización</th>
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
                          <Badge className="ml-1 text-[8px] bg-orange-100 text-orange-700 border-orange-200">Gestión</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={cn('text-[9px]', PRIORITY_STYLES[req.priority])}>{req.priority}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs">{mgmt?.supplier?.name || <span className="text-muted-foreground/50">—</span>}</td>
                      <td className="px-4 py-3 text-xs font-mono">{mgmt?.quotationNumber || <span className="text-muted-foreground/50">—</span>}</td>
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
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-red-600 hover:text-red-700" onClick={() => handleRejectManagement(mgmt)} disabled={actionLoading === mgmt.id}>
                                <X className="size-3.5" />
                              </Button>
                            </>
                          )}
                          {mgmt?.status === 'APPROVED' && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-teal-600" onClick={() => handleConvertToOrder(mgmt)} disabled={actionLoading === mgmt.id}>
                              <ArrowUpRight className="size-3.5" />
                            </Button>
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
                      <thead><tr className="bg-muted/30"><th className="text-left p-2 text-[10px] font-bold">Producto</th><th className="text-left p-2 text-[10px] font-bold">Descripción</th><th className="text-right p-2 text-[10px] font-bold">Cant.</th><th className="text-right p-2 text-[10px] font-bold">Stock</th><th className="text-right p-2 text-[10px] font-bold">Stock Min</th><th className="text-left p-2 text-[10px] font-bold">Obs.</th></tr></thead>
                      <tbody>
                        {detailOpen.items.map((item, i) => (
                          <tr key={item.id || i} className="border-t">
                            <td className="p-2 text-xs font-mono">{item.productId ? item.productId.slice(0, 8) : '—'}</td>
                            <td className="p-2 text-xs">{item.description}</td>
                            <td className="p-2 text-right text-xs font-mono">{item.quantity}</td>
                            <td className="p-2 text-right text-xs font-mono">{item.currentStock}</td>
                            <td className="p-2 text-right text-xs font-mono">{item.minStock}</td>
                            <td className="p-2 text-xs">{item.observations || '—'}</td>
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
                          {mgmt.items.map((item, i) => (
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
                    {mgmt.rejectionReason && <p className="text-sm text-red-600 mt-2">Motivo de rechazo: {mgmt.rejectionReason}</p>}
                  </div>
                )}

                <DialogFooter className="gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-3.5 mr-1" /> Imprimir</Button>
                  <Button variant="ghost" size="sm" onClick={() => setDetailOpen(null)}>Cerrar</Button>
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

      {/* Create Solicitud Dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); setCreateItems([]); }}}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4" /> Nueva Solicitud de Compra
            </DialogTitle>
            <DialogDescription>Completa los datos para crear una solicitud. Se creará en estado Borrador.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Prioridad</label>
                <Select value={createForm.priority} onValueChange={(v) => setCreateForm(prev => ({ ...prev, priority: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="URGENT">Urgente</SelectItem>
                    <SelectItem value="CRITICAL">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Bodega</label>
                <Select value={createForm.warehouseId} onValueChange={(v) => setCreateForm(prev => ({ ...prev, warehouseId: v }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map(w => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold">Fecha Requerida</label>
                <Input type="date" className="h-9" value={createForm.requiredDate}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, requiredDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold">Justificación</label>
              <textarea className="w-full min-h-[60px] rounded-lg border border-input bg-background p-3 text-sm"
                value={createForm.justification}
                onChange={(e) => setCreateForm(prev => ({ ...prev, justification: e.target.value }))}
                placeholder="Motivo de la solicitud..." />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold">Notas</label>
              <textarea className="w-full min-h-[50px] rounded-lg border border-input bg-background p-3 text-sm"
                value={createForm.notes}
                onChange={(e) => setCreateForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notas adicionales..." />
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold">Artículos</label>
                <Badge variant="secondary" className="text-[10px]">{createItems.length} items</Badge>
              </div>
              {createItems.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-muted/30">
                      <th className="text-left p-2 text-[10px] font-bold">Producto</th>
                      <th className="text-left p-2 text-[10px] font-bold">Cant.</th>
                      <th className="text-left p-2 text-[10px] font-bold">Obs.</th>
                      <th className="w-10" />
                    </tr></thead>
                    <tbody>
                      {createItems.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">
                            <span className="text-xs font-medium">{item.productName}</span>
                          </td>
                          <td className="p-2 w-24">
                            <Input type="number" min={1} className="h-8 text-xs" value={item.quantity}
                              onChange={(e) => updateItem(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
                          </td>
                          <td className="p-2">
                            <Input className="h-8 text-xs" value={item.observations} placeholder="Obs."
                              onChange={(e) => updateItem(idx, { observations: e.target.value })} />
                          </td>
                          <td className="p-2">
                            <button onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700 p-1">
                              <X className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Product search */}
              <div className="relative">
                <Input placeholder="Buscar producto por nombre o código..." className="h-9 pl-8"
                  value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                {products.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border bg-background shadow-lg max-h-48 overflow-y-auto">
                    {products.map((p: any) => (
                      <button key={p.id} type="button" className="w-full flex items-center gap-3 px-3 py-2 text-left text-xs hover:bg-muted/50 transition-colors"
                        onClick={() => addItem(p)}>
                        <Package className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{p.name}</span>
                        <span className="text-muted-foreground font-mono shrink-0">{p.code}</span>
                        <span className="text-muted-foreground shrink-0">Stock: {p.stock || 0}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setCreateItems([]); }} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="size-3.5 mr-1 animate-spin" />}
              Crear Solicitud
            </Button>
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
