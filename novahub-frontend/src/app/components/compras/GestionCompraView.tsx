import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ClipboardCheck, Plus, Search, Eye, CheckCircle, XCircle,
  Send, ArrowUpRight, Trash2,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { purchaseManagementService } from '../../services/compras.service';
import type { PurchaseManagement } from '../../types';
import { cn } from '../ui/utils';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  PENDING_APPROVAL: 'bg-orange-100 text-orange-700 border-orange-200',
  APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
  RETURNED_FOR_CORRECTION: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  CONVERTED_TO_ORDER: 'bg-teal-100 text-teal-700 border-teal-200',
  CANCELLED: 'bg-gray-100 text-gray-400 border-gray-200',
};

interface GestionCompraViewProps {
  data: PurchaseManagement[];
  loading?: boolean;
  onRefresh: () => void;
}

export function GestionCompraView({ data, loading, onRefresh }: GestionCompraViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [detailOpen, setDetailOpen] = useState<PurchaseManagement | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return data.filter(m => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return m.number.toLowerCase().includes(s)
        || (m.supplier?.name?.toLowerCase().includes(s));
    });
  }, [data, search, statusFilter]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await purchaseManagementService.approve(id);
      toast.success('Gestión aprobada');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || 'Error al aprobar');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt('Motivo del rechazo:');
    if (reason === null) return;
    setActionLoading(id);
    try {
      await purchaseManagementService.reject(id, reason || undefined);
      toast.success('Gestión rechazada');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || 'Error al rechazar');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConvertToOrder = async (id: string) => {
    if (!window.confirm('¿Generar orden de compra a partir de esta gestión?')) return;
    setActionLoading(id);
    try {
      const order = await purchaseManagementService.convertToOrder(id);
      toast.success(`Orden de compra #${order.number} generada`);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || 'Error al convertir');
    } finally {
      setActionLoading(null);
    }
  };

  const fm = (n: number | string | undefined | null) =>
    new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="size-6 text-primary" />
          <h2 className="text-xl font-bold">Gestión de Compras</h2>
          <Badge variant="secondary" className="text-xs">{data.length}</Badge>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número o proveedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.keys(STATUS_STYLES).map(s => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">Cargando...</CardContent></Card>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No hay gestiones de compra</CardContent></Card>
        ) : (
          filtered.map((m) => (
            <motion.div key={m.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-sm font-mono font-bold">{m.number}</CardTitle>
                      {m.purchaseRequest && (
                        <Badge variant="outline" className="text-[10px]">SOL: {m.purchaseRequest.number}</Badge>
                      )}
                      <Badge className={cn('text-[10px] font-bold border', STATUS_STYLES[m.status])}>
                        {m.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button variant="ghost" size="sm" onClick={() => setDetailOpen(m)}>
                        <Eye className="size-4 mr-1" /> Ver
                      </Button>
                      {m.status === 'PENDING_APPROVAL' && (
                        <>
                          <Button variant="default" size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(m.id)} disabled={actionLoading === m.id}>
                            <CheckCircle className="size-4 mr-1" /> Aprobar
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleReject(m.id)} disabled={actionLoading === m.id}>
                            <XCircle className="size-4 mr-1" /> Rechazar
                          </Button>
                        </>
                      )}
                      {m.status === 'APPROVED' && (
                        <Button variant="default" size="sm" onClick={() => handleConvertToOrder(m.id)} disabled={actionLoading === m.id}>
                          <ArrowUpRight className="size-4 mr-1" /> Generar OC
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Proveedor</p>
                      <p className="font-medium">{m.supplier?.name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Cotización</p>
                      <p className="font-medium">{m.quotationNumber || '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Total</p>
                      <p className="font-medium font-mono">{fm(m.total)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Moneda</p>
                      <p className="font-medium">{m.currency}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Artículos</p>
                      <p className="font-medium">{m.items?.length || 0}</p>
                    </div>
                  </div>
                  {m.internalNotes && (
                    <p className="text-sm text-muted-foreground mt-2 italic">{m.internalNotes}</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      <Dialog open={!!detailOpen} onOpenChange={(o) => { if (!o) setDetailOpen(null); }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {detailOpen && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Gestión {detailOpen.number}
                  <Badge className={cn('text-[10px] font-bold border', STATUS_STYLES[detailOpen.status])}>
                    {detailOpen.status.replace(/_/g, ' ')}
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">Proveedor:</span> {detailOpen.supplier?.name || '—'}</div>
                <div><span className="text-muted-foreground">Cotización:</span> {detailOpen.quotationNumber || '—'}</div>
                <div><span className="text-muted-foreground">Moneda:</span> {detailOpen.currency}</div>
                <div><span className="text-muted-foreground">Contacto:</span> {detailOpen.supplierContact || '—'}</div>
                <div><span className="text-muted-foreground">Pago:</span> {detailOpen.paymentTerms || '—'} {detailOpen.creditDays ? `(${detailOpen.creditDays} días)` : ''}</div>
                <div><span className="text-muted-foreground">Anticipo:</span> {fm(detailOpen.advancePayment)}</div>
                <div><span className="text-muted-foreground">Envío:</span> {fm(detailOpen.shippingCost)}</div>
                <div><span className="text-muted-foreground">Entrega estimada:</span> {detailOpen.expectedDelivery ? new Date(detailOpen.expectedDelivery).toLocaleDateString() : '—'}</div>
                <div><span className="text-muted-foreground">Total:</span> <span className="font-bold font-mono">{fm(detailOpen.total)}</span></div>
              </div>
              <div className="border rounded-lg overflow-hidden mt-4">
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted/50"><th className="text-left p-2">Producto</th><th className="text-left p-2">Descripción</th><th className="text-right p-2">Sol.</th><th className="text-right p-2">Prop.</th><th className="text-right p-2">Precio</th><th className="text-right p-2">Dto%</th><th className="text-right p-2">Subtotal</th><th className="text-right p-2">Total</th></tr></thead>
                  <tbody>
                    {detailOpen.items.map((item, i) => (
                      <tr key={item.id || i} className="border-t">
                        <td className="p-2 font-mono text-xs">{item.productId?.slice(0, 8) || '—'}</td>
                        <td className="p-2">{item.description}</td>
                        <td className="p-2 text-right font-mono">{item.quantityRequested}</td>
                        <td className="p-2 text-right font-mono">{item.quantityProposed}</td>
                        <td className="p-2 text-right font-mono">{fm(item.unitPrice)}</td>
                        <td className="p-2 text-right font-mono">{item.discount}%</td>
                        <td className="p-2 text-right font-mono">{fm(item.subtotal)}</td>
                        <td className="p-2 text-right font-mono font-bold">{fm(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {detailOpen.internalNotes && <p className="text-sm text-muted-foreground mt-2">Notas internas: {detailOpen.internalNotes}</p>}
              {detailOpen.notes && <p className="text-sm text-muted-foreground">Notas: {detailOpen.notes}</p>}
              {detailOpen.approvedBy && <p className="text-sm text-muted-foreground mt-2">Aprobado por: {detailOpen.approvedBy.name} {detailOpen.approvedAt ? `el ${new Date(detailOpen.approvedAt).toLocaleDateString()}` : ''}</p>}
              {detailOpen.rejectionReason && <p className="text-sm text-red-600 mt-2">Motivo de rechazo: {detailOpen.rejectionReason}</p>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
