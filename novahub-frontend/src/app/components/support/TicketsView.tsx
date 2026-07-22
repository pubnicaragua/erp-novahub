import React, { useEffect, useMemo, useState } from 'react';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { Ticket, TicketAudit, TicketComment } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  Plus,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  History,
  Eye,
  Trash2,
} from 'lucide-react';
import { supportService } from '../../services/support.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface TicketsViewProps {
  data: Ticket[];
  loading: boolean;
  onRefresh: () => void;
}

const SlaStatusBadge: React.FC<{ ticket: Ticket }> = ({ ticket }) => {
  const now = Date.now();
  const dueAt = ticket.slaDueAt ? new Date(ticket.slaDueAt).getTime() : null;
  const resolved = ['RESOLVED', 'CLOSED'].includes((ticket.status || '').toUpperCase());

  if (!dueAt) {
    return <Badge className="bg-slate-500/10 text-slate-500 border-none text-[9px] font-black uppercase">Sin SLA</Badge>;
  }

  if (resolved) {
    const breached = !!ticket.slaBreachedAt || (ticket.closedAt ? new Date(ticket.closedAt).getTime() > dueAt : false);
    return (
      <Badge className={cn('border-none text-[9px] font-black uppercase', breached ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500')}>
        {breached ? 'Resuelto fuera SLA' : 'Resuelto en SLA'}
      </Badge>
    );
  }

  if (ticket.slaBreachedAt || dueAt <= now) {
    return <Badge className="bg-rose-500/10 text-rose-500 border-none text-[9px] font-black uppercase">SLA vencido</Badge>;
  }

  if (dueAt - now <= 2 * 60 * 60 * 1000) {
    return <Badge className="bg-amber-500/10 text-amber-500 border-none text-[9px] font-black uppercase">Próximo a vencer</Badge>;
  }

  return <Badge className="bg-blue-500/10 text-blue-500 border-none text-[9px] font-black uppercase">En tiempo</Badge>;
};

export const TicketsView: React.FC<TicketsViewProps> = ({ data, loading, onRefresh }) => {
  const { canPerform } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [audit, setAudit] = useState<TicketAudit[]>([]);
  const [newComment, setNewComment] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [pendingDeleteTicket, setPendingDeleteTicket] = useState<Ticket | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const statusOpts = [
    { value: 'OPEN', label: 'Abierto', color: 'bg-amber-500/10 text-amber-500' },
    { value: 'IN_PROGRESS', label: 'En Progreso', color: 'bg-blue-500/10 text-blue-500' },
    { value: 'RESOLVED', label: 'Resuelto', color: 'bg-emerald-500/10 text-emerald-500' },
    { value: 'CLOSED', label: 'Cerrado', color: 'bg-slate-500/10 text-slate-500' },
  ];

  const priorityOpts = [
    { value: 'LOW', label: 'Baja', color: 'text-slate-500' },
    { value: 'MEDIUM', label: 'Media', color: 'text-blue-500' },
    { value: 'HIGH', label: 'Alta', color: 'text-amber-500' },
    { value: 'URGENT', label: 'Urgente', color: 'text-rose-500' },
  ];

  const loadTicketDetails = async (ticketId: string) => {
    try {
      setDetailLoading(true);
      const [commentsRes, auditRes] = await Promise.all([
        supportService.getComments(ticketId),
        supportService.getAudit(ticketId),
      ]);
      setComments(Array.isArray(commentsRes) ? commentsRes : []);
      setAudit(Array.isArray(auditRes) ? auditRes : []);
    } catch (error) {
      toast.error('Error al cargar detalle del ticket');
      setComments([]);
      setAudit([]);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedTicket?.id) return;
    loadTicketDetails(selectedTicket.id);
  }, [selectedTicket?.id]);

  useEffect(() => {
    if (!selectedTicket?.id) return;
    const updated = data.find((item) => item.id === selectedTicket.id);
    if (updated) setSelectedTicket(updated);
  }, [data, selectedTicket?.id]);

  const columns: ColumnDef<Ticket>[] = [
    { key: 'number', header: 'Ticket', width: '110px' },
    { key: 'subject', header: 'Asunto', width: '20%', editable: canPerform('TICKETS', 'edit') },
    { key: 'description', header: 'Descripción', width: '28%', editable: canPerform('TICKETS', 'edit') },
    {
      key: 'priority',
      header: 'Prioridad',
      width: '110px',
      editable: canPerform('TICKETS', 'edit'),
      type: 'select',
      options: priorityOpts,
      render: (val: any) => {
        const option = priorityOpts.find((x) => x.value === (val || '').toUpperCase());
        return (
          <span className={cn('text-[10px] font-bold uppercase', option?.color || 'text-muted-foreground')}>
            {option?.label || val}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Estado',
      width: '120px',
      editable: canPerform('TICKETS', 'edit'),
      type: 'select',
      options: statusOpts,
      render: (val: any) => {
        const option = statusOpts.find((x) => x.value === (val || '').toUpperCase());
        return (
          <Badge
            variant="outline"
            className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', option?.color || 'bg-muted/20 text-muted-foreground')}
          >
            {option?.label || val}
          </Badge>
        );
      },
    },
    {
      key: 'slaDueAt',
      header: 'SLA',
      width: '220px',
      render: (_: any, row: Ticket) => (
        <div className="flex flex-col gap-1">
          <SlaStatusBadge ticket={row} />
          <span className="text-[10px] text-muted-foreground">
            {row.slaDueAt ? format(new Date(row.slaDueAt), 'MMM dd, yyyy HH:mm') : '-'}
          </span>
        </div>
      ),
    },
    {
      key: '_count',
      header: 'Comentarios',
      width: '110px',
      render: (_: any, row: Ticket) => <span className="text-xs font-semibold">{row?._count?.comments || 0}</span>,
    },
    {
      key: 'createdAt',
      header: 'Creado',
      width: '130px',
      render: (val: any) => (val ? format(new Date(val), 'MMM dd, yyyy') : '-'),
    },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Ticket>) => {
    try {
      await supportService.update(id as string, updates);
      toast.success('Ticket actualizado');
      onRefresh();
    } catch {
      toast.error('Error al actualizar');
    }
  };

  const handleAdd = async () => {
    try {
      await supportService.create({
        subject: 'Nuevo Ticket',
        description: 'Describa el problema aquí...',
        status: 'OPEN',
        priority: 'MEDIUM',
      } as any);
      toast.success('Ticket creado');
      onRefresh();
    } catch {
      toast.error('Error al crear');
    }
  };

  const handleDelete = async (ticket: Ticket) => {
    try {
      await supportService.delete(ticket.id);
      toast.success('Ticket eliminado');
      if (selectedTicket?.id === ticket.id) {
        setSelectedTicket(null);
        setComments([]);
        setAudit([]);
      }
      onRefresh();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const sendComment = async () => {
    if (!selectedTicket?.id) return;
    const message = newComment.trim();
    if (!message) return;

    try {
      setCommentLoading(true);
      await supportService.addComment(selectedTicket.id, message);
      setNewComment('');
      await loadTicketDetails(selectedTicket.id);
      onRefresh();
      toast.success('Comentario agregado');
    } catch {
      toast.error('Error al agregar comentario');
    } finally {
      setCommentLoading(false);
    }
  };

  const kpis = [
    {
      title: 'Abiertos',
      value: data.filter((t) => (t.status || '').toUpperCase() === 'OPEN').length,
      icon: AlertTriangle,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
    {
      title: 'En Progreso',
      value: data.filter((t) => (t.status || '').toUpperCase() === 'IN_PROGRESS').length,
      icon: Clock,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'Resueltos',
      value: data.filter((t) => (t.status || '').toUpperCase() === 'RESOLVED').length,
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      title: 'SLA Vencido',
      value: data.filter((t) => !!t.slaBreachedAt && !['RESOLVED', 'CLOSED'].includes((t.status || '').toUpperCase())).length,
      icon: XCircle,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
    },
  ];

  const filtered = useMemo(
    () =>
      data.filter(
        (t) =>
          t.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.description?.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [data, searchTerm],
  );

  return (
    <>
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="border-none bg-background/50 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn('p-3 rounded-2xl flex items-center justify-center', kpi.bg)}>
                <kpi.icon className={cn('size-6', kpi.color)} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.title}</p>
                <p className="text-2xl font-black tracking-tight">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <Card className="xl:col-span-8 border-none bg-background/50 backdrop-blur-xl shadow-sm">
          <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Mesa de Ayuda</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Gestión de tickets y soporte</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
                <Input
                  placeholder="Buscar..."
                  className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {canPerform('TICKETS', 'create') && (
                <Button
                  onClick={handleAdd}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"
                >
                  <Plus className="size-4" />
                  Nuevo Ticket
                </Button>
              )}
            </div>
          </div>

          <EditableDataTable
            data={filtered}
            columns={columns}
            onRowUpdate={handleUpdate}
            isLoading={loading}
            actions={(row) => (
              <div className="flex justify-end items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10 rounded-lg"
                  onClick={() => setSelectedTicket(row)}
                >
                  <Eye className="size-4" />
                </Button>
                {canPerform('TICKETS', 'delete') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                    onClick={() => setPendingDeleteTicket(row)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            )}
          />
        </Card>

        <Card className="xl:col-span-4 border-none bg-background/50 backdrop-blur-xl shadow-sm">
          <div className="p-4 border-b border-border/50">
            <h3 className="text-lg font-black uppercase tracking-tight">Detalle del Ticket</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
              Comentarios y trazabilidad
            </p>
          </div>

          {!selectedTicket ? (
            <div className="p-6 text-sm text-muted-foreground">Selecciona un ticket para ver comentarios e historial.</div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{selectedTicket.number}</p>
                <p className="font-semibold">{selectedTicket.subject}</p>
                <SlaStatusBadge ticket={selectedTicket} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/60">
                  <MessageSquare className="size-4" />
                  Comentarios ({comments.length})
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {detailLoading && <p className="text-xs text-muted-foreground">Cargando...</p>}
                  {!detailLoading && comments.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin comentarios aún.</p>
                  )}
                  {comments.map((comment) => (
                    <div key={comment.id} className="rounded-lg border border-border/60 bg-background/40 p-2">
                      <p className="text-xs font-semibold">{comment.author?.name || 'Usuario'}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(comment.createdAt), 'MMM dd, yyyy HH:mm')}</p>
                      <p className="text-sm mt-1">{comment.message}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <Textarea
                    placeholder="Agregar comentario..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-20"
                    disabled={!canPerform('TICKETS', 'edit')}
                  />
                  <Button
                    onClick={sendComment}
                    disabled={commentLoading || !newComment.trim() || !canPerform('TICKETS', 'edit')}
                    className="w-full h-9 text-[10px] font-black uppercase tracking-widest"
                  >
                    {commentLoading ? 'Guardando...' : 'Comentar'}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/60">
                  <History className="size-4" />
                  Historial
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {detailLoading && <p className="text-xs text-muted-foreground">Cargando...</p>}
                  {!detailLoading && audit.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin eventos aún.</p>
                  )}
                  {audit.map((event) => (
                    <div key={event.id} className="rounded-lg border border-border/60 bg-background/40 p-2">
                      <p className="text-xs font-semibold">{event.action}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(event.createdAt), 'MMM dd, yyyy HH:mm')}</p>
                      {event.message && <p className="text-sm mt-1">{event.message}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>

      <ConfirmDialog
        open={pendingDeleteTicket !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteTicket(null); }}
        title="¿Eliminar ticket?"
        description={`¿Estás seguro de que deseas eliminar el ticket ${pendingDeleteTicket?.number || ''}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={async () => {
          if (!pendingDeleteTicket) return;
          try {
            setDeleteLoading(true);
            await handleDelete(pendingDeleteTicket);
          } finally {
            setDeleteLoading(false);
            setPendingDeleteTicket(null);
          }
        }}
      />
    </>
  );
};
