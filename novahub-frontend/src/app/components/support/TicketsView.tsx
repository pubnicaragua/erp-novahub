import { useEffect, useState } from 'react';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { Ticket, TicketAudit, TicketComment, TicketProductLink } from '../../types';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
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
  Pencil,
  ImagePlus,
  Building2,
  UserRound,
  Link2,
  Paperclip,
  FileText,
  Tags,
  RotateCcw,
  ArrowRightLeft,
  CircleHelp,
} from 'lucide-react';
import { supportService } from '../../services/support.service';
import { toast } from '@/app/services/toast';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { TicketFormModal } from './TicketFormModal';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { SalesKpiCard } from '../ventas/SalesKpiCard';

interface TicketsViewProps {
  data: Ticket[];
  customerCatalog?: any[];
  categoryCatalog?: any[];
  agentCatalog?: any[];
  invoiceCatalog?: any[];
  productCatalog?: any[];
  loading: boolean;
  onRefresh: () => void;
  onHelp: () => void;
  targetTicketId?: string | null;
  onTargetTicketHandled?: () => void;
}

const useCurrentTimestamp = () => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  return now;
};

const isTicketAdmin = (user?: { role?: string; isPlatformAdmin?: boolean } | null) => {
  const role = String(user?.role || '').toLowerCase();
  return Boolean(user?.isPlatformAdmin)
    || ['admin', 'administrador', 'superadmin', 'super_admin', 'platform_admin'].includes(role);
};

const isTerminalTicket = (ticket?: Ticket | null) => ['RESOLVED', 'CLOSED'].includes(String(ticket?.status || '').toUpperCase());

const formatTicketDate = (value?: string | null) => value ? format(new Date(value), 'dd/MM/yyyy HH:mm') : 'Sin fecha';

const auditActionLabels: Record<string, string> = {
  TICKET_CREATED: 'Ticket creado',
  STATUS_CHANGED: 'Estado cambiado',
  PRIORITY_CHANGED: 'Prioridad cambiada',
  ASSIGNED_CHANGED: 'Responsable cambiado',
  CUSTOMER_CHANGED: 'Cliente actualizado',
  CATEGORY_CHANGED: 'Categoría actualizada',
  RELATION_UPDATED: 'Relaciones actualizadas',
  SUBJECT_UPDATED: 'Asunto actualizado',
  DESCRIPTION_UPDATED: 'Descripción actualizada',
  SLA_UPDATED: 'SLA actualizado',
  COMMENT_ADDED: 'Comentario agregado',
  ATTACHMENT_ADDED: 'Adjunto agregado',
  ATTACHMENT_REMOVED: 'Adjunto eliminado',
  TICKET_REOPENED: 'Ticket reabierto',
};

const auditStatusLabels: Record<string, string> = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En progreso',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
};

const auditPriorityLabels: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Crítica',
};

const translateAuditMessage = (event: TicketAudit, agentCatalog: any[]) => {
  const message = String(event.message || '');
  if (event.action === 'STATUS_CHANGED') {
    const match = message.match(/Estado:\s*([^\s]+)\s*->\s*([^\s]+)/i);
    if (match) return `Estado: ${auditStatusLabels[match[1].toUpperCase()] || match[1]} → ${auditStatusLabels[match[2].toUpperCase()] || match[2]}`;
  }
  if (event.action === 'PRIORITY_CHANGED') {
    const match = message.match(/Prioridad:\s*([^\s]+)\s*->\s*([^\s]+)/i);
    if (match) return `Prioridad: ${auditPriorityLabels[match[1].toUpperCase()] || match[1]} → ${auditPriorityLabels[match[2].toUpperCase()] || match[2]}`;
  }
  if (event.action === 'ASSIGNED_CHANGED') {
    const match = message.match(/Asignación:\s*(.*?)\s*->\s*(.*)$/i);
    if (match) {
      const resolveName = (value: string) => {
        const candidate = agentCatalog.find((agent: any) => agent.id === value.trim());
        return candidate?.name || value.trim();
      };
      return `Responsable: ${resolveName(match[1])} → ${resolveName(match[2])}`;
    }
  }
  if (event.action === 'TICKET_CREATED') {
    const match = message.match(/prioridad\s+(.+)$/i);
    if (match) return `Ticket creado con prioridad ${auditPriorityLabels[match[1].toUpperCase()] || match[1]}`;
  }
  return message;
};

const SlaStatusBadge: React.FC<{ ticket: Ticket }> = ({ ticket }) => {
  const now = useCurrentTimestamp();
  const dueAt = ticket.slaDueAt ? new Date(ticket.slaDueAt).getTime() : null;
  const resolved = ['RESOLVED', 'CLOSED'].includes((ticket.status || '').toUpperCase());

  if (!dueAt) {
    return <Badge className="bg-slate-500/10 text-slate-500 border-none text-[9px] font-black uppercase">SLA no configurado</Badge>;
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

const ticketProductLinks = (ticket?: Ticket | null): TicketProductLink[] => {
  if (ticket?.ticketProducts?.length) return ticket.ticketProducts;
  if (ticket?.product) {
    return [{ id: `legacy-${ticket.product.id}`, productId: ticket.product.id, product: ticket.product }];
  }
  return [];
};

export const TicketsView: React.FC<TicketsViewProps> = ({ data, customerCatalog = [], categoryCatalog = [], agentCatalog = [], invoiceCatalog = [], productCatalog = [], loading, onRefresh, onHelp, targetTicketId, onTargetTicketHandled }) => {
  const { canPerform, user } = useAuth();
  const canInteractWithTicket = (ticket?: Ticket | null) => Boolean(
    ticket && user && (isTicketAdmin(user) || ticket.createdById === user.id || ticket.assignedToId === user.id),
  );
  const canChangeTicketStatus = (ticket?: Ticket | null) => Boolean(
    ticket
      && canPerform('TICKETS_LIST', 'edit')
      && canInteractWithTicket(ticket)
      && (isTicketAdmin(user) || ticket.assignedToId === user?.id)
      && String(ticket.status || '').toUpperCase() !== 'CLOSED',
  );
  const canEditTicket = (ticket?: Ticket | null) => canPerform('TICKETS_LIST', 'edit') && canInteractWithTicket(ticket) && !isTerminalTicket(ticket);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [customerFilter, setCustomerFilter] = useState('ALL');
  const [invoiceFilter, setInvoiceFilter] = useState('ALL');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [highlightedTicketId, setHighlightedTicketId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [commentInternal, setCommentInternal] = useState(true);
  const [commentLoading, setCommentLoading] = useState(false);
  const [pendingDeleteTicket, setPendingDeleteTicket] = useState<Ticket | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenLoading, setReopenLoading] = useState(false);
  const [statusDialogTicket, setStatusDialogTicket] = useState<Ticket | null>(null);
  const [nextStatus, setNextStatus] = useState('');
  const [statusResolutionNote, setStatusResolutionNote] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryColor, setCategoryColor] = useState('#64748b');
  const [categorySaving, setCategorySaving] = useState(false);
  const activeSelectedTicket = selectedTicket
    ? data.find((item) => item.id === selectedTicket.id) || selectedTicket
    : null;

  useEffect(() => {
    if (!targetTicketId) return;
    const targetTicket = data.find((ticket) => String(ticket.id) === String(targetTicketId));
    if (!targetTicket) return;
    let highlightTimeout: number | undefined;
    const focusTimeout = window.setTimeout(() => {
      setSelectedTicket(targetTicket);
      setHighlightedTicketId(targetTicket.id);
      onTargetTicketHandled?.();
      highlightTimeout = window.setTimeout(() => setHighlightedTicketId(null), 6000);
    }, 0);
    return () => {
      window.clearTimeout(focusTimeout);
      if (highlightTimeout) window.clearTimeout(highlightTimeout);
    };
  }, [data, onTargetTicketHandled, targetTicketId]);

  const commentsQuery = useTenantQuery<TicketComment[]>(
    ['support', 'ticket-comments', activeSelectedTicket?.id],
    signal => supportService.getComments(activeSelectedTicket!.id, signal),
    { enabled: Boolean(activeSelectedTicket?.id) },
  );
  const auditQuery = useTenantQuery<TicketAudit[]>(
    ['support', 'ticket-audit', activeSelectedTicket?.id],
    signal => supportService.getAudit(activeSelectedTicket!.id, signal),
    { enabled: Boolean(activeSelectedTicket?.id) },
  );
  const ticketDetailQuery = useTenantQuery<Ticket>(
    ['support', 'ticket-detail', activeSelectedTicket?.id],
    signal => supportService.getOne(activeSelectedTicket!.id, signal),
    { enabled: Boolean(activeSelectedTicket?.id) },
  );
  const customerHistoryQuery = useTenantQuery<{ data?: Ticket[] }>(
    ['support', 'customer-history', activeSelectedTicket?.customerId],
    signal => supportService.getAll({ customerId: activeSelectedTicket!.customerId!, page: 1, pageSize: 10 }, signal),
    { enabled: Boolean(activeSelectedTicket?.customerId) },
  );
  const detailTicket = ticketDetailQuery.data || activeSelectedTicket;
  const detailProductLinks = ticketProductLinks(detailTicket);
  const comments = Array.isArray(commentsQuery.data) ? commentsQuery.data : [];
  const audit = Array.isArray(auditQuery.data) ? auditQuery.data : [];
  const detailLoading = commentsQuery.isLoading || auditQuery.isLoading || commentsQuery.isFetching || auditQuery.isFetching;

  const statusOpts = [
    { value: 'OPEN', label: 'Abierto', color: 'bg-amber-500/10 text-amber-500' },
    { value: 'IN_PROGRESS', label: 'En Progreso', color: 'bg-blue-500/10 text-blue-500' },
    { value: 'RESOLVED', label: 'Resuelto', color: 'bg-emerald-500/10 text-emerald-500' },
    { value: 'CLOSED', label: 'Cerrado', color: 'bg-slate-500/10 text-slate-500' },
  ];

  const openStatusDialog = (ticket: Ticket) => {
    const currentStatus = String(ticket.status || '').toUpperCase();
    const defaultNextStatus = currentStatus === 'OPEN'
      ? 'IN_PROGRESS'
      : currentStatus === 'IN_PROGRESS'
        ? 'RESOLVED'
        : 'CLOSED';
    setStatusDialogTicket(ticket);
    setNextStatus(defaultNextStatus);
    setStatusResolutionNote(ticket.resolutionNote || '');
  };

  const priorityOpts = [
    { value: 'LOW', label: 'Baja', color: 'text-slate-500' },
    { value: 'MEDIUM', label: 'Media', color: 'text-blue-500' },
    { value: 'HIGH', label: 'Alta', color: 'text-amber-500' },
    { value: 'URGENT', label: 'Urgente', color: 'text-rose-500' },
  ];

  const columns: ColumnDef<Ticket>[] = [
    { key: 'number', header: 'Ticket', width: '115px' },
    {
      key: 'subject',
      header: 'Asunto',
      width: '28%',
      editable: canPerform('TICKETS_LIST', 'edit'),
      render: (val: any, row: Ticket) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{val || 'Sin asunto'}</p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{row.customer?.name || 'Caso interno'}</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Cliente',
      width: '160px',
      render: (_: any, row: Ticket) => <span className="truncate text-xs text-muted-foreground">{row.customer?.name || 'Caso interno'}</span>,
    },
    {
      key: 'invoice',
      header: 'Factura',
      width: '135px',
      render: (_: any, row: Ticket) => <span className="truncate text-xs text-muted-foreground">{row.invoice?.number || '—'}</span>,
    },
    {
      key: 'ticketProducts',
      header: 'Productos / servicios',
      width: '220px',
      render: (_: any, row: Ticket) => {
        const products = ticketProductLinks(row);
        return products.length > 0 ? (
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {products.slice(0, 2).map((relation) => (
              <span key={relation.id} className="max-w-[9rem] truncate rounded-md bg-primary/5 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                {relation.product?.name || relation.productId}
              </span>
            ))}
            {products.length > 2 && <Badge variant="outline" className="shrink-0 text-[9px]">+{products.length - 2}</Badge>}
          </div>
        ) : <span className="text-xs text-muted-foreground">—</span>;
      },
    },
    {
      key: 'createdBy',
      header: 'Usuario',
      width: '150px',
      render: (_: any, row: Ticket) => <span className="truncate text-xs text-muted-foreground">{row.createdBy?.name || '—'}</span>,
    },
    {
      key: 'clientTenant',
      header: 'Sucursal',
      width: '150px',
      render: (_: any, row: Ticket) => <span className="truncate text-xs text-muted-foreground">{row.clientTenant?.name || 'Sucursal actual'}</span>,
    },
    {
      key: 'category',
      header: 'Categoría',
      width: '135px',
      render: (_: any, row: Ticket) => <span className="truncate text-xs text-muted-foreground">{row.category?.name || 'Sin categoría'}</span>,
    },
    {
      key: 'priority',
      header: 'Prioridad',
      width: '110px',
      editable: canPerform('TICKETS_LIST', 'edit'),
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
      editable: canPerform('TICKETS_LIST', 'edit'),
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
      key: 'assignedTo',
      header: 'Responsable',
      width: '150px',
      render: (_: any, row: Ticket) => <span className="truncate text-xs text-muted-foreground">{row.assignedTo?.name || 'Sin asignar'}</span>,
    },
    {
      key: 'slaDueAt',
      header: 'SLA',
      width: '220px',
      render: (_: any, row: Ticket) => (
        <div className="flex flex-col gap-1">
          <SlaStatusBadge ticket={row} />
          <span className="text-[10px] text-muted-foreground">
            {row.slaDueAt ? format(new Date(row.slaDueAt), 'MMM dd, yyyy HH:mm') : 'No configurado'}
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
    const ticket = data.find((item) => String(item.id) === String(id));
    if (!canEditTicket(ticket)) {
      if (isTerminalTicket(ticket)) toast.error('Reabre el ticket antes de modificarlo');
      else toast.error('Solo el creador, responsable o administrador puede interactuar con este ticket');
      return;
    }
    try {
      await supportService.update(id as string, updates);
      toast.success('Ticket actualizado');
      onRefresh();
    } catch {
      toast.error('Error al actualizar');
    }
  };

  const handleAdd = () => {
    setEditingTicket(null);
    setFormOpen(true);
  };

  const handleEdit = (ticket: Ticket) => {
    setEditingTicket(ticket);
    setFormOpen(true);
  };

  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setCategoryName('');
    setCategoryColor('#64748b');
  };

  const saveCategory = async () => {
    const name = categoryName.trim();
    if (!name) {
      toast.error('El nombre de la categoría es obligatorio');
      return;
    }
    const currentId = editingCategoryId;
    try {
      setCategorySaving(true);
      if (currentId) {
        await supportService.updateCategory(currentId, { name, color: categoryColor });
      } else {
        await supportService.createCategory({ name, color: categoryColor });
      }
      resetCategoryForm();
      await onRefresh();
      toast.success(currentId ? 'Categoría actualizada' : 'Categoría creada');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'No se pudo guardar la categoría');
    } finally {
      setCategorySaving(false);
    }
  };

  const toggleCategory = async (category: any) => {
    try {
      await supportService.updateCategory(category.id, { isActive: category.isActive === false });
      await onRefresh();
    } catch {
      toast.error('No se pudo actualizar la categoría');
    }
  };

  const handleDelete = async (ticket: Ticket) => {
    if (!canInteractWithTicket(ticket)) {
      toast.error('Solo el creador, responsable o administrador puede interactuar con este ticket');
      return;
    }
    try {
      await supportService.delete(ticket.id);
      toast.success('Ticket eliminado');
      if (activeSelectedTicket?.id === ticket.id) {
        setSelectedTicket(null);
      }
      onRefresh();
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const handleReopen = async () => {
    if (!activeSelectedTicket?.id) return;
    const reason = reopenReason.trim();
    if (!reason) {
      toast.error('Escribe el motivo de reapertura');
      return;
    }
    try {
      setReopenLoading(true);
      await supportService.reopen(activeSelectedTicket.id, reason);
      setReopenDialogOpen(false);
      setReopenReason('');
      setSelectedTicket(null);
      onRefresh();
      toast.success('Ticket reabierto');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'No se pudo reabrir el ticket');
    } finally {
      setReopenLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!statusDialogTicket?.id || !canChangeTicketStatus(statusDialogTicket)) {
      toast.error('Solo el responsable o un administrador puede cambiar el estado');
      return;
    }
    const currentStatus = String(statusDialogTicket.status || '').toUpperCase();
    if (currentStatus === 'CLOSED') return;
    if (nextStatus === 'RESOLVED' && !statusResolutionNote.trim()) {
      toast.error('Escribe las observaciones de resolución');
      return;
    }
    try {
      setStatusSaving(true);
      await supportService.update(statusDialogTicket.id, {
        status: nextStatus as Ticket['status'],
        ...(nextStatus === 'RESOLVED' ? { resolutionNote: statusResolutionNote.trim() } : {}),
      });
      setStatusDialogTicket(null);
      setStatusResolutionNote('');
      onRefresh();
      toast.success('Estado actualizado');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'No se pudo cambiar el estado');
    } finally {
      setStatusSaving(false);
    }
  };

  const sendComment = async () => {
    if (!activeSelectedTicket?.id) return;
    if (!canInteractWithTicket(activeSelectedTicket)) {
      toast.error('Solo el creador, responsable o administrador puede interactuar con este ticket');
      return;
    }
    const message = newComment.trim();
    if (!message) return;

    try {
      setCommentLoading(true);
      await supportService.addComment(activeSelectedTicket.id, message, commentInternal);
      setNewComment('');
      await Promise.all([commentsQuery.refetch(), auditQuery.refetch()]);
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

  const normalizedSearch = searchTerm.toLowerCase();
  const registeredCustomerIds = new Set(data.map((ticket) => ticket.customerId).filter(Boolean));
  const registeredInvoiceIds = new Set(data.map((ticket) => ticket.invoiceId).filter(Boolean));
  const registeredCustomers = data.reduce<any[]>((items, ticket) => {
    if (!ticket.customerId || items.some((item) => item.id === ticket.customerId)) return items;
    const catalogCustomer = customerCatalog.find((customer: any) => customer.id === ticket.customerId);
    items.push(catalogCustomer || { id: ticket.customerId, name: ticket.customer?.name || ticket.customerId });
    return items;
  }, []).filter((customer) => registeredCustomerIds.has(customer.id));
  const registeredInvoices = data.reduce<any[]>((items, ticket) => {
    if (!ticket.invoiceId || items.some((item) => item.id === ticket.invoiceId)) return items;
    const catalogInvoice = invoiceCatalog.find((invoice: any) => invoice.id === ticket.invoiceId);
    items.push(catalogInvoice || { id: ticket.invoiceId, number: ticket.invoice?.number || ticket.invoiceId });
    return items;
  }, []).filter((invoice) => registeredInvoiceIds.has(invoice.id));
  const filtered = data.filter((t) => {
    const matchesStatus = statusFilter === 'ALL' || (t.status || '').toUpperCase() === statusFilter;
    const matchesPriority = priorityFilter === 'ALL' || (t.priority || '').toUpperCase() === priorityFilter;
    const matchesCategory = categoryFilter === 'ALL' || t.categoryId === categoryFilter;
    const matchesAssignee = assigneeFilter === 'ALL' || t.assignedToId === assigneeFilter;
    const matchesCustomer = customerFilter === 'ALL' || t.customerId === customerFilter;
    const matchesInvoice = invoiceFilter === 'ALL' || t.invoiceId === invoiceFilter;
    const createdAt = t.createdAt ? new Date(t.createdAt).getTime() : 0;
    const matchesDateFrom = !dateFromFilter || createdAt >= new Date(`${dateFromFilter}T00:00:00`).getTime();
    const matchesDateTo = !dateToFilter || createdAt <= new Date(`${dateToFilter}T23:59:59.999`).getTime();
    if (!matchesStatus || !matchesPriority || !matchesCategory || !matchesAssignee || !matchesCustomer || !matchesInvoice || !matchesDateFrom || !matchesDateTo) return false;
    if (!normalizedSearch) return true;
    return [t.subject, t.number, t.customer?.name, t.invoice?.number, t.assignedTo?.name, ...ticketProductLinks(t).map((relation) => relation.product?.name)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch));
  });

  return (
    <>
    <div className="min-w-0 space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <SalesKpiCard key={kpi.title} title={kpi.title} value={kpi.value} icon={kpi.icon} color={kpi.color} bg={kpi.bg} kind="indicator" />
        ))}
      </div>

      <Card className="min-w-0 max-w-full overflow-hidden border-none bg-background/50 backdrop-blur-xl shadow-sm">
          <div className="flex min-w-0 flex-col justify-between gap-4 border-b border-border/50 p-4 lg:flex-row lg:items-center">
            <div className="min-w-0">
              <h2 className="text-xl font-black uppercase tracking-tight">Mesa de Ayuda</h2>
              <p className="mt-1 text-xs text-muted-foreground">Selecciona un ticket para abrir su detalle, seguimiento e historial.</p>
            </div>
            <div className="erp-list-toolbar flex min-w-0 flex-wrap items-center gap-3">
              <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg text-muted-foreground" onClick={onHelp} aria-label="Cómo gestionar tickets" title="Cómo gestionar tickets">
                <CircleHelp className="size-4" />
              </Button>
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
                <Input
                  placeholder="Buscar..."
                  className="h-10 w-full rounded-xl border-border/50 bg-background/50 pl-9 text-xs"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              {canPerform('TICKETS_LIST', 'edit') && (
                <Button type="button" variant="outline" onClick={() => setCategoryManagerOpen(true)} className="h-10 shrink-0 gap-2 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest">
                  <Tags className="size-4" /> Categorías
                </Button>
              )}
              {canPerform('TICKETS_LIST', 'create') && (
                <Button
                  data-testid="tickets-new-ticket"
                  data-toolbar-role="primary"
                  onClick={handleAdd}
                  className="h-10 shrink-0 gap-2 rounded-xl bg-primary px-4 font-black uppercase text-[10px] tracking-widest text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="size-4" />
                  Nuevo Ticket
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-4 py-3">
            {[{ value: 'ALL', label: 'Todos' }, ...statusOpts].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors',
                  statusFilter === option.value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
            <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{filtered.length} resultado(s)</span>
          </div>

          <div className="grid grid-cols-1 gap-2 border-b border-border/40 bg-muted/10 px-4 py-3 sm:grid-cols-3 lg:grid-cols-8">
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="h-9 rounded-xl bg-background text-xs"><SelectValue placeholder="Todas las prioridades" /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">Todas las prioridades</SelectItem>{priorityOpts.map((option) => <SelectItem key={option.value} value={option.value}>Prioridad: {option.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 rounded-xl bg-background text-xs"><SelectValue placeholder="Todas las categorías" /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">Todas las categorías</SelectItem>{categoryCatalog.map((category: any) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="h-9 rounded-xl bg-background text-xs"><SelectValue placeholder="Todos los responsables" /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">Todos los responsables</SelectItem>{agentCatalog.map((agent: any) => <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={customerFilter} onValueChange={setCustomerFilter}>
              <SelectTrigger className="h-9 rounded-xl bg-background text-xs"><SelectValue placeholder="Todos los clientes" /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">Todos los clientes</SelectItem>{registeredCustomers.map((customer: any) => <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={invoiceFilter} onValueChange={setInvoiceFilter}>
              <SelectTrigger className="h-9 rounded-xl bg-background text-xs"><SelectValue placeholder="Todas las facturas" /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">Todas las facturas</SelectItem>{registeredInvoices.map((invoice: any) => <SelectItem key={invoice.id} value={invoice.id}>{invoice.number}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="date" value={dateFromFilter} onChange={(event) => setDateFromFilter(event.target.value)} className="h-9 rounded-xl bg-background text-xs" aria-label="Fecha desde" />
            <Input type="date" value={dateToFilter} onChange={(event) => setDateToFilter(event.target.value)} className="h-9 rounded-xl bg-background text-xs" aria-label="Fecha hasta" />
            {(priorityFilter !== 'ALL' || categoryFilter !== 'ALL' || assigneeFilter !== 'ALL' || customerFilter !== 'ALL' || invoiceFilter !== 'ALL' || dateFromFilter || dateToFilter) && (
              <Button type="button" variant="ghost" className="h-9 justify-start rounded-xl text-xs text-muted-foreground" onClick={() => { setPriorityFilter('ALL'); setCategoryFilter('ALL'); setAssigneeFilter('ALL'); setCustomerFilter('ALL'); setInvoiceFilter('ALL'); setDateFromFilter(''); setDateToFilter(''); }}>
                Limpiar filtros
              </Button>
            )}
          </div>

          <EditableDataTable
            data={filtered}
            columns={columns}
            layoutMode="responsive"
            canEdit={false}
            onRowUpdate={handleUpdate}
            onRowClick={setSelectedTicket}
            isLoading={loading}
            highlightedRowId={highlightedTicketId}
            actions={(row) => (
              <div className="flex justify-end items-center gap-1">
                {canChangeTicketStatus(row) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Cambiar estado"
                    aria-label="Cambiar estado"
                    className="size-8 text-muted-foreground hover:bg-blue-500/10 hover:text-blue-600"
                    onClick={() => openStatusDialog(row)}
                  >
                    <ArrowRightLeft className="size-4" />
                  </Button>
                )}
                {canPerform('TICKETS_LIST', 'edit') && canInteractWithTicket(row) && isTerminalTicket(row) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    title="Reabrir ticket"
                    aria-label="Reabrir ticket"
                    className="size-8 text-amber-600 hover:bg-amber-500/10"
                    onClick={() => { setSelectedTicket(row); setReopenDialogOpen(true); }}
                  >
                    <RotateCcw className="size-4" />
                  </Button>
                )}
                {canEditTicket(row) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg"
                    onClick={() => handleEdit(row)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-500/10 rounded-lg"
                  onClick={() => setSelectedTicket(row)}
                >
                  <Eye className="size-4" />
                </Button>
                {canPerform('TICKETS_LIST', 'delete') && canInteractWithTicket(row) && (
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
            actionsWidth="w-44"
          />
      </Card>
    </div>

      <Sheet open={Boolean(activeSelectedTicket)} onOpenChange={(open) => { if (!open) setSelectedTicket(null); }}>
        <SheetContent side="right" className="erp-detail-panel flex w-full min-w-0 flex-col gap-0 overflow-hidden border-l border-border/50 bg-background p-0 sm:max-w-xl">
          <SheetHeader className="sticky top-0 z-10 border-b border-border/50 bg-background/95 px-5 py-5 pr-12 backdrop-blur-md sm:px-6">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <SheetTitle className="truncate text-lg font-black uppercase tracking-tight">Detalle del ticket</SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono font-bold">{activeSelectedTicket?.number || '—'}</span>
                  <span>·</span>
                  <span className="truncate">{activeSelectedTicket?.subject || 'Ticket de soporte'}</span>
                </SheetDescription>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {activeSelectedTicket && canChangeTicketStatus(activeSelectedTicket) && <Button type="button" variant="outline" size="sm" className="shrink-0 rounded-xl text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-500/10" onClick={() => openStatusDialog(activeSelectedTicket)}><ArrowRightLeft className="mr-1.5 size-3.5" />Cambiar estado</Button>}
                {activeSelectedTicket && canInteractWithTicket(activeSelectedTicket) && (
                  isTerminalTicket(activeSelectedTicket) ? (
                    <Button type="button" variant="outline" size="sm" className="shrink-0 rounded-xl border-amber-500/30 text-[10px] font-black uppercase tracking-widest text-amber-600 hover:bg-amber-500/10" onClick={() => setReopenDialogOpen(true)}>
                      <RotateCcw className="mr-1.5 size-3.5" /> Reabrir
                    </Button>
                  ) : canEditTicket(activeSelectedTicket) ? (
                    <Button type="button" variant="outline" size="sm" className="shrink-0 rounded-xl text-[10px] font-black uppercase tracking-widest" onClick={() => { setSelectedTicket(null); handleEdit(activeSelectedTicket); }}>
                      <Pencil className="mr-1.5 size-3.5" /> Editar
                    </Button>
                  ) : null
                )}
                {activeSelectedTicket && canPerform('TICKETS_LIST', 'delete') && canInteractWithTicket(activeSelectedTicket) && <Button type="button" variant="outline" size="sm" className="shrink-0 rounded-xl border-rose-500/30 text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-500/10 dark:text-rose-400" onClick={() => { setSelectedTicket(null); setPendingDeleteTicket(activeSelectedTicket); }}><Trash2 className="mr-1.5 size-3.5" />Eliminar</Button>}
              </div>
            </div>
          </SheetHeader>

          {!activeSelectedTicket ? null : (
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-lg border-primary/20 bg-primary/10 text-[10px] font-black uppercase text-primary">{activeSelectedTicket.number}</Badge>
                  <SlaStatusBadge ticket={detailTicket || activeSelectedTicket} />
                </div>
                <h3 className="pt-2 text-xl font-black tracking-tight">{detailTicket?.subject || activeSelectedTicket.subject}</h3>
                <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{detailTicket?.description || activeSelectedTicket.description || 'Sin descripción.'}</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70"><Building2 className="size-3.5 text-primary" /> Sucursal</p>
                  <p className="mt-1 truncate text-sm font-semibold">{detailTicket?.clientTenant?.name || activeSelectedTicket.clientTenant?.name || 'Sucursal actual'}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70"><UserRound className="size-3.5 text-primary" /> Usuario creador</p>
                  <p className="mt-1 truncate text-sm font-semibold">{detailTicket?.createdBy?.name || activeSelectedTicket.createdBy?.name || 'Usuario actual'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                {[
                  ['Fecha de creación', detailTicket?.createdAt || activeSelectedTicket.createdAt],
                  ['Última actualización', detailTicket?.updatedAt || activeSelectedTicket.updatedAt],
                  ['Fecha de resolución', detailTicket?.resolvedAt || activeSelectedTicket.resolvedAt],
                  ['Fecha de cierre', detailTicket?.closedAt || activeSelectedTicket.closedAt],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">{label}</p>
                    <p className="mt-1 text-sm font-semibold">{formatTicketDate(value)}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary">SLA</p>
                    <p className="mt-1 text-sm font-semibold">
                      {(detailTicket?.slaDueAt || activeSelectedTicket.slaDueAt) ? `Fecha límite: ${formatTicketDate(detailTicket?.slaDueAt || activeSelectedTicket.slaDueAt)}` : 'No configurado'}
                    </p>
                  </div>
                  <SlaStatusBadge ticket={detailTicket || activeSelectedTicket} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Estado</p>
                  <p className="mt-1 text-sm font-semibold">{statusOpts.find((option) => option.value === (detailTicket?.status || activeSelectedTicket.status)?.toUpperCase())?.label || detailTicket?.status || activeSelectedTicket.status}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Prioridad</p>
                  <p className="mt-1 text-sm font-semibold">{priorityOpts.find((option) => option.value === (detailTicket?.priority || activeSelectedTicket.priority)?.toUpperCase())?.label || detailTicket?.priority || activeSelectedTicket.priority}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Categoría</p>
                  <p className="mt-1 truncate text-sm font-semibold">{detailTicket?.category?.name || activeSelectedTicket.category?.name || 'Sin categoría'}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Responsable</p>
                  <p className="mt-1 truncate text-sm font-semibold">{detailTicket?.assignedTo?.name || activeSelectedTicket.assignedTo?.name || 'Sin asignar'}</p>
                </div>
              </div>

              {(detailTicket?.customer || activeSelectedTicket.customer) && (
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Cliente relacionado</p>
                  <p className="mt-1 font-semibold">{detailTicket?.customer?.name || activeSelectedTicket.customer?.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{detailTicket?.customer?.email || activeSelectedTicket.customer?.email || detailTicket?.customer?.phone || activeSelectedTicket.customer?.phone || 'Sin datos adicionales'}</p>
                  {customerHistoryQuery.data?.data && customerHistoryQuery.data.data.length > 1 && (
                    <div className="mt-3 border-t border-border/60 pt-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">Historial del cliente</p>
                      <div className="mt-2 space-y-1.5">
                        {customerHistoryQuery.data.data.filter((item) => item.id !== activeSelectedTicket.id).slice(0, 4).map((item) => (
                          <button key={item.id} type="button" onClick={() => setSelectedTicket(item)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-background/70">
                            <span className="min-w-0 truncate font-medium">{item.number} · {item.subject}</span>
                            <Badge variant="outline" className="shrink-0 text-[9px]">{item.status}</Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(detailTicket?.invoice || detailProductLinks.length > 0) && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {detailTicket?.invoice && (
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70"><Link2 className="size-3.5 text-primary" /> Factura relacionada</p>
                      <p className="mt-1 font-semibold">{detailTicket.invoice.number}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{detailTicket.invoice.date ? format(new Date(detailTicket.invoice.date), 'MMM dd, yyyy') : 'Fecha no disponible'} · {detailTicket.invoice.total ?? '—'} {detailTicket.invoice.currency || ''}</p>
                    </div>
                  )}
                  {detailProductLinks.length > 0 && (
                    <div className="min-w-0 rounded-2xl border border-border/60 bg-muted/20 p-4 sm:col-span-2">
                      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/70"><Link2 className="size-3.5 text-primary" /> Productos / servicios ({detailProductLinks.length})</p>
                      <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                        {detailProductLinks.map((relation) => (
                          <div key={relation.id} className="min-w-0 rounded-xl border border-border/60 bg-background/60 p-3">
                            <p className="truncate text-sm font-semibold">{relation.product?.name || relation.productId}</p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {relation.product?.code || 'Sin código'}
                              {relation.invoiceItem?.quantity !== undefined ? ` · Cant. ${relation.invoiceItem.quantity}` : ''}
                              {relation.invoiceItem?.total !== undefined ? ` · Total ${relation.invoiceItem.total}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detailTicket?.resolutionNote && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Resolución / cierre</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{detailTicket.resolutionNote}</p>
                </div>
              )}

              {ticketDetailQuery.isLoading && (activeSelectedTicket.evidenceUrl1 || activeSelectedTicket.evidenceUrl2) && (
                <p className="text-xs text-muted-foreground">Cargando evidencias...</p>
              )}
              {ticketDetailQuery.data && (detailTicket?.evidenceUrl1 || detailTicket?.evidenceUrl2) && (
                <div className="space-y-2 rounded-2xl border border-border/60 bg-background/40 p-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/60">
                    <ImagePlus className="size-4" /> Evidencias
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[detailTicket?.evidenceUrl1, detailTicket?.evidenceUrl2].filter(Boolean).map((url, index) => (
                      <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-border/60 bg-background">
                        <img src={url} alt={`Evidencia ${index + 1}`} className="aspect-square w-full object-cover transition-transform group-hover:scale-105" />
                        <span className="block truncate px-2 py-1.5 text-[10px] font-semibold text-primary">Abrir evidencia {index + 1}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {detailTicket?.attachments && detailTicket.attachments.length > 0 && (
                <div className="space-y-2 rounded-2xl border border-border/60 bg-background/40 p-3">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/60">
                    <Paperclip className="size-4" /> Adjuntos ({detailTicket.attachments.length})
                  </div>
                  <div className="space-y-2">
                    {detailTicket.attachments.map((attachment) => (
                      <a key={attachment.id} href={attachment.uri} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-border/60 bg-background p-2.5 transition-colors hover:border-primary/40 hover:bg-primary/5">
                        <FileText className="size-4 shrink-0 text-primary" />
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{attachment.fileName}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{attachment.byteSize ? `${Math.ceil(attachment.byteSize / 1024)} KB` : ''}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/60">
                  <MessageSquare className="size-4" />
                  Comentarios ({comments.length})
                </div>
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {detailLoading && <p className="text-xs text-muted-foreground">Cargando...</p>}
                  {!detailLoading && comments.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin comentarios aún.</p>
                  )}
                  {comments.map((comment) => (
                    <div key={comment.id} className="rounded-lg border border-border/60 bg-background/40 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold">{comment.author?.name || 'Usuario'}</p>
                        {comment.isInternal !== false && <Badge variant="outline" className="text-[9px]">Interno</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{formatTicketDate(comment.createdAt)}</p>
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
                    disabled={!canPerform('TICKETS_LIST', 'edit') || !canInteractWithTicket(activeSelectedTicket)}
                  />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input type="checkbox" checked={commentInternal} onChange={(event) => setCommentInternal(event.target.checked)} disabled={!canPerform('TICKETS_LIST', 'edit') || !canInteractWithTicket(activeSelectedTicket)} className="size-3.5 accent-primary" />
                    Comentario interno
                  </label>
                  <Button
                    onClick={sendComment}
                    disabled={commentLoading || !newComment.trim() || !canPerform('TICKETS_LIST', 'edit') || !canInteractWithTicket(activeSelectedTicket)}
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
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {detailLoading && <p className="text-xs text-muted-foreground">Cargando...</p>}
                  {!detailLoading && audit.length === 0 && (
                    <p className="text-xs text-muted-foreground">Sin eventos aún.</p>
                  )}
                  {audit.map((event) => (
                    <div key={event.id} className="rounded-lg border border-border/60 bg-background/40 p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold">{auditActionLabels[event.action] || event.action}</p>
                        {event.actor?.name && <span className="text-[10px] font-medium text-muted-foreground">Por {event.actor.name}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{formatTicketDate(event.createdAt)}</p>
                      {event.message && <p className="mt-1 text-sm">{translateAuditMessage(event, agentCatalog)}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog
        open={statusDialogTicket !== null}
        onOpenChange={(open) => {
          if (!open) {
            setStatusDialogTicket(null);
            setStatusResolutionNote('');
          }
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cambiar estado</DialogTitle>
            <DialogDescription>
              Actualiza el flujo de {statusDialogTicket?.number || 'este ticket'} desde una acción controlada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nuevo estado</label>
              <Select value={nextStatus} onValueChange={setNextStatus}>
                <SelectTrigger className="h-10 rounded-xl text-sm"><SelectValue placeholder="Selecciona un estado" /></SelectTrigger>
                <SelectContent>
                  {statusOpts
                    .filter((option) => option.value !== String(statusDialogTicket?.status || '').toUpperCase())
                    .filter((option) => !(isTerminalTicket(statusDialogTicket) && option.value === 'OPEN'))
                    .filter((option) => option.value !== 'CLOSED' || String(statusDialogTicket?.status || '').toUpperCase() === 'RESOLVED')
                    .map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {nextStatus === 'RESOLVED' && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Observaciones de resolución *</label>
                <Textarea
                  value={statusResolutionNote}
                  onChange={(event) => setStatusResolutionNote(event.target.value)}
                  placeholder="Describe la solución aplicada y el resultado de la atención..."
                  className="min-h-28 resize-y rounded-2xl text-sm"
                  autoFocus
                />
              </div>
            )}
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setStatusDialogTicket(null)} disabled={statusSaving}>Cancelar</Button>
            <Button type="button" onClick={handleStatusChange} disabled={statusSaving || !nextStatus || (nextStatus === 'RESOLVED' && !statusResolutionNote.trim())}>
              {statusSaving ? 'Guardando...' : 'Guardar estado'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reopenDialogOpen}
        onOpenChange={(open) => {
          setReopenDialogOpen(open);
          if (!open) setReopenReason('');
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reabrir ticket</DialogTitle>
            <DialogDescription>
              Registra el motivo para continuar la atención de {activeSelectedTicket?.number || 'este ticket'}.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reopenReason}
            onChange={(event) => setReopenReason(event.target.value)}
            placeholder="Ej. El problema continúa después de la solución aplicada..."
            className="min-h-28 resize-y rounded-2xl"
            autoFocus
          />
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setReopenDialogOpen(false)} disabled={reopenLoading}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleReopen} disabled={reopenLoading || !reopenReason.trim()}>
              <RotateCcw className="mr-2 size-4" />
              {reopenLoading ? 'Reabriendo...' : 'Confirmar reapertura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryManagerOpen} onOpenChange={(open) => { setCategoryManagerOpen(open); if (!open) resetCategoryForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gestionar categorías</DialogTitle>
            <DialogDescription>Clasifica los casos según las necesidades de tu empresa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_auto_auto] gap-2">
              <Input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Nombre de categoría" className="h-9 text-xs" />
              <input type="color" value={categoryColor} onChange={(event) => setCategoryColor(event.target.value)} className="h-9 w-10 cursor-pointer rounded-lg border border-border bg-background p-1" aria-label="Color de categoría" />
              <Button type="button" onClick={saveCategory} disabled={categorySaving} className="h-9 text-[10px] font-black uppercase">{editingCategoryId ? 'Guardar' : 'Agregar'}</Button>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {categoryCatalog.map((category: any) => (
                <div key={category.id} className="flex items-center gap-3 rounded-xl border border-border/60 p-2.5">
                  <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: category.color || '#64748b' }} />
                  <span className={cn('min-w-0 flex-1 truncate text-sm font-semibold', category.isActive === false && 'text-muted-foreground line-through')}>{category.name}</span>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => { setEditingCategoryId(category.id); setCategoryName(category.name); setCategoryColor(category.color || '#64748b'); }}>Editar</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-muted-foreground" onClick={() => toggleCategory(category)}>{category.isActive === false ? 'Activar' : 'Desactivar'}</Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCategoryManagerOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TicketFormModal
        key={`${formOpen ? 'open' : 'closed'}-${editingTicket?.id || 'new'}`}
        open={formOpen}
        onOpenChange={setFormOpen}
        ticket={editingTicket}
        customerCatalog={customerCatalog}
        categoryCatalog={categoryCatalog}
        agentCatalog={agentCatalog}
        invoiceCatalog={invoiceCatalog}
        productCatalog={productCatalog}
        onRefresh={onRefresh}
      />

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
