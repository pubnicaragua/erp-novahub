import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  ClipboardList, Plus, Search, Eye, X, AlertTriangle,
  CheckCircle, Clock, Trash2, FileText, Printer,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { purchaseRequestsService } from '../../services/compras.service';
import type { PurchaseRequest } from '../../types';
import { cn } from '../ui/utils';

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

interface SolicitudCompraViewProps {
  data: PurchaseRequest[];
  loading?: boolean;
  onRefresh: () => void;
}

export function SolicitudCompraView({ data, loading, onRefresh }: SolicitudCompraViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [detailOpen, setDetailOpen] = useState<PurchaseRequest | null>(null);
  const [statusChangeOpen, setStatusChangeOpen] = useState(false);
  const [selectedForStatus, setSelectedForStatus] = useState<PurchaseRequest | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [reason, setReason] = useState('');
  const [statusLoading, setStatusLoading] = useState(false);

  const filtered = useMemo(() => {
    return data.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return r.number.toLowerCase().includes(s)
        || (r.requestedBy?.firstName?.toLowerCase().includes(s))
        || (r.requestedBy?.lastName?.toLowerCase().includes(s))
        || (r.warehouse?.name?.toLowerCase().includes(s));
    });
  }, [data, search, statusFilter]);

  const handleStatusChange = async () => {
    if (!selectedForStatus || !newStatus) return;
    setStatusLoading(true);
    try {
      await purchaseRequestsService.changeStatus(selectedForStatus.id, newStatus, reason || undefined);
      toast.success(`Solicitud #${selectedForStatus.number} → ${newStatus}`);
      setStatusChangeOpen(false);
      setSelectedForStatus(null);
      setNewStatus('');
      setReason('');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || 'Error al cambiar estado');
    } finally {
      setStatusLoading(false);
    }
  };

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
    CLOSED: [],
    CONVERTED_TO_ORDER: [],
    CANCELLED: [],
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ClipboardList className="size-6 text-primary" />
          <h2 className="text-xl font-bold">Solicitudes de Compra</h2>
          <Badge variant="secondary" className="text-xs">{data.length}</Badge>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, solicitante, bodega..."
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
          <Card><CardContent className="p-8 text-center text-muted-foreground">No hay solicitudes de compra</CardContent></Card>
        ) : (
          filtered.map((req) => (
            <motion.div key={req.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-sm font-mono font-bold">{req.number}</CardTitle>
                      <Badge className={cn('text-[10px] font-bold border', STATUS_STYLES[req.status])}>
                        {req.status.replace(/_/g, ' ')}
                      </Badge>
                      <Badge className={cn('text-[10px]', PRIORITY_STYLES[req.priority])}>
                        {req.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setDetailOpen(req)}>
                        <Eye className="size-4 mr-1" /> Ver
                      </Button>
                      {allowedTransitions[req.status]?.length > 0 && (
                        <Button variant="outline" size="sm" onClick={() => { setSelectedForStatus(req); setNewStatus(''); setReason(''); setStatusChangeOpen(true); }}>
                          <Clock className="size-4 mr-1" /> Estado
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Solicitante</p>
                      <p className="font-medium">{req.requestedBy?.firstName} {req.requestedBy?.lastName}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Bodega</p>
                      <p className="font-medium">{req.warehouse?.name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Fecha</p>
                      <p className="font-medium">{new Date(req.date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Artículos</p>
                      <p className="font-medium">{req.items?.length || 0}</p>
                    </div>
                  </div>
                  {req.justification && (
                    <p className="text-sm text-muted-foreground mt-2 italic">"{req.justification}"</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      <Dialog open={!!detailOpen} onOpenChange={(o) => { if (!o) setDetailOpen(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {detailOpen && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Solicitud {detailOpen.number}
                  <Badge className={cn('text-[10px] font-bold border', STATUS_STYLES[detailOpen.status])}>
                    {detailOpen.status.replace(/_/g, ' ')}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {detailOpen.justification || 'Sin justificación'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Solicitante:</span> {detailOpen.requestedBy?.firstName} {detailOpen.requestedBy?.lastName}</div>
                <div><span className="text-muted-foreground">Bodega:</span> {detailOpen.warehouse?.name}</div>
                <div><span className="text-muted-foreground">Prioridad:</span> {detailOpen.priority}</div>
                <div><span className="text-muted-foreground">Fecha requerida:</span> {detailOpen.requiredDate ? new Date(detailOpen.requiredDate).toLocaleDateString() : '—'}</div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead><tr className="bg-muted/50"><th className="text-left p-2">Producto</th><th className="text-left p-2">Descripción</th><th className="text-right p-2">Cant.</th><th className="text-right p-2">Stock</th><th className="text-right p-2">Stock Min</th><th className="text-left p-2">Obs.</th></tr></thead>
                  <tbody>
                    {detailOpen.items.map((item, i) => (
                      <tr key={item.id || i} className="border-t">
                        <td className="p-2">{item.productId ? item.productId.slice(0,8) : '—'}</td>
                        <td className="p-2">{item.description}</td>
                        <td className="p-2 text-right font-mono">{item.quantity}</td>
                        <td className="p-2 text-right font-mono">{item.currentStock}</td>
                        <td className="p-2 text-right font-mono">{item.minStock}</td>
                        <td className="p-2">{item.observations || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {detailOpen.notes && <p className="text-sm text-muted-foreground">Notas: {detailOpen.notes}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => window.print()}><Printer className="size-4 mr-1" /> Imprimir</Button>
                <Button variant="ghost" onClick={() => setDetailOpen(null)}>Cerrar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={statusChangeOpen} onOpenChange={(o) => { if (!o) { setStatusChangeOpen(false); setSelectedForStatus(null); }}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar Estado</DialogTitle>
            <DialogDescription>
              Solicitud {selectedForStatus?.number} — Estado actual: {selectedForStatus?.status?.replace(/_/g, ' ')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nuevo estado</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado..." />
                </SelectTrigger>
                <SelectContent>
                  {allowedTransitions[selectedForStatus?.status || '']?.map(s => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(newStatus === 'REJECTED' || newStatus === 'RETURNED_FOR_CORRECTION' || newStatus === 'CANCELLED') && (
              <div>
                <label className="text-sm font-medium">Motivo</label>
                <textarea
                  className="w-full min-h-[80px] rounded-lg border border-input bg-background p-3 text-sm"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Indique el motivo..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStatusChangeOpen(false)}>Cancelar</Button>
            <Button onClick={handleStatusChange} disabled={!newStatus || statusLoading}>
              {statusLoading ? 'Actualizando...' : 'Actualizar Estado'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
