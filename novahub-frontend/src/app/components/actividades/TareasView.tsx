import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EditableDataTable } from '../ui/EditableDataTable';
import { Task } from '../../types';
import type { ActivityCategory, ActivityCustomField } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ListTodo,
  Paperclip,
  Eye,
  CalendarClock,
  Flag,
  UsersRound,
  AlignLeft,
  Send,
  XCircle,
  Loader2,
  Filter,
  RotateCcw,
  HandHelping,
  UserCog,
  Tag,
} from 'lucide-react';
import { tasksService } from '../../services/actividades.service';
import { usersService } from '../../services/users.service';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { InventoryViewTutorial } from '../inventory/InventoryViewTutorial';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { storageService } from '../../services/storage.service';
import { asList, invalidateTenantQueries, useTenantQuery } from '../../hooks/useTenantQuery';
import { playNotificationSound } from '../../utils/notificationSound';
import { ActivityDetailSheet } from './ActivityDetailSheet';
import { ViewLayoutSelect, type ViewLayoutMode } from '../ui/ViewLayoutSelect';
import { TareasKanban } from './TareasKanban';
import { TareasCardsView } from './TareasCardsView';
import { SlaBadge } from './SlaBadge';
import { ReassignTaskModal } from './ReassignTaskModal';
import {
  ACTIVITY_CATEGORIES,
  CUSTOM_FIELD_PRESETS,
  MAX_CUSTOM_FIELD_LENGTH,
  MAX_CUSTOM_FIELDS,
  getActivityCategoryLabel,
  toCustomFieldsRecord,
} from './actividades.constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DateField } from '../ui/DateField';
import { DateTimePickerField } from '../ui/DateTimePickerField';

interface TareasViewProps {
  data: Task[];
  loading: boolean;
  onRefresh: () => void;
}

/** Valor centinela del selector de categoría del formulario (Radix no admite ''). */
const CATEGORY_NONE = 'NONE';

/** Subconjunto de `Task` que necesitan los filtros de identidad, responsable y estado. */
type TaskLike = Pick<Task, 'id' | 'status' | 'assignedToId' | 'categoryId'> & {
  assignments?: Array<{ userId?: string | null }>;
};

const getTaskDisplayStatus = (task: any) => {
  const status = String(task?.status || 'PENDING').toUpperCase();
  const dueTime = task?.dueDate ? new Date(task.dueDate).getTime() : Number.NaN;
  return ['PENDING', 'IN_PROGRESS'].includes(status) && Number.isFinite(dueTime) && dueTime < Date.now()
    ? 'OVERDUE'
    : status;
};

/** Estados finales: el SLA se apaga (§5) y no tiene sentido reasignar ni tomar. */
const isClosedTaskStatus = (task?: TaskLike | null) => {
  const status = String(task?.status || '').toUpperCase();
  return status === 'COMPLETED' || status === 'CANCELLED';
};

/** Responsable efectivo: `assignedToId` y, por compatibilidad, la asignación más reciente. */
const getTaskAssigneeId = (task?: TaskLike | null): string => {
  const direct = String(task?.assignedToId || '').trim();
  if (direct) return direct;
  const assignments = Array.isArray(task?.assignments) ? task.assignments : [];
  const fromAssignments = assignments.find((assignment) => String(assignment?.userId || '').trim());
  return String(fromAssignments?.userId || '').trim();
};

export const TareasView: React.FC<TareasViewProps> = ({ data, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewLayout, setViewLayout] = useState<ViewLayoutMode>('table');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [assignedFilter, setAssignedFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showFilterPanel, setShowFilterPanel] = useState<boolean>(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [isApprovalOpen, setIsApprovalOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [reassignTask, setReassignTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [detailTask, setDetailTask] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Add Task form state
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'MEDIUM',
    categoryId: CATEGORY_NONE,
    customFields: {} as Record<string, string>,
    assignedTo: [] as string[],
  });

  // Complete & Approval Task form state
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const { user, canPerform } = useAuth();
  const queryClient = useQueryClient();
  const currentUserId = user?.id ? String(user.id) : null;
  const slaNow = useMemo(() => new Date(currentTime), [currentTime]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const usersQuery = useTenantQuery<any[]>(
    ['activities', 'task-users'],
    (signal) => usersService.getLookup(undefined, signal),
    {
      enabled: isAddOpen || true,
    }
  );
  const employees = asList(usersQuery.data);

  /** Refresca la lista con TanStack Query: la clave viva es `['tenant-module', tenant, ...]`. */
  const refreshTasks = () => {
    invalidateTenantQueries(queryClient);
    onRefresh();
  };

  /** Solo una tarea libre o de otro usuario se puede tomar (§2.2). */
  const canClaimTask = (task?: TaskLike | null): boolean => {
    if (!currentUserId || isClosedTaskStatus(task)) return false;
    const assigneeId = getTaskAssigneeId(task);
    return !assigneeId || assigneeId !== currentUserId;
  };

  const isTaskMine = (task?: TaskLike | null): boolean => {
    if (!currentUserId) return false;
    const assigneeId = getTaskAssigneeId(task);
    return Boolean(assigneeId) && assigneeId === currentUserId;
  };

  const handleClaimTask = async (task: Task) => {
    if (!task?.id || !canPerform('ACTIVITIES_TASKS', 'edit')) return;
    try {
      setClaimingId(task.id);
      await tasksService.claim(task.id);
      toast.success('Tarea tomada. Ahora es tuya.');
      refreshTasks();
    } catch (e: unknown) {
      const failure = e as { response?: { data?: { message?: ReactNode } }; message?: ReactNode } | null;
      toast.error(failure?.response?.data?.message || failure?.message || 'No se pudo tomar la tarea');
    } finally {
      setClaimingId(null);
    }
  };

  const handleOpenReassign = (task: Task) => {
    if (!task?.id || !canPerform('ACTIVITIES_TASKS', 'edit')) return;
    setReassignTask(task);
    setIsReassignOpen(true);
  };

  const handleReassigned = () => {
    setReassignTask(null);
    refreshTasks();
  };

  const setCustomFieldValue = (key: string, value: string) => {
    setNewTask((prev) => {
      const next = { ...prev.customFields };
      const trimmed = value.trim();
      if (trimmed) next[key] = value;
      else delete next[key];
      return { ...prev, customFields: next };
    });
  };

  const resetNewTaskForm = () => {
    setNewTask({
      title: '',
      description: '',
      dueDate: '',
      priority: 'MEDIUM',
      categoryId: CATEGORY_NONE,
      customFields: {},
      assignedTo: [],
    });
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setAssignedFilter('ALL');
    setCategoryFilter('ALL');
    setDateFrom('');
    setDateTo('');
  };

  const statusOpts = [
    { value: 'PENDING', label: 'Pendiente', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    { value: 'IN_PROGRESS', label: 'En Progreso', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    { value: 'WAITING_APPROVAL', label: 'Por Aprobar', color: 'bg-primary/10 text-primary border-primary/20' },
    { value: 'COMPLETED', label: 'Completada', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    { value: 'CANCELLED', label: 'Cancelada', color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  ];

  const priorityOpts = [
    { value: 'LOW', label: 'Baja', color: 'text-muted-foreground' },
    { value: 'MEDIUM', label: 'Media', color: 'text-primary font-medium' },
    { value: 'HIGH', label: 'Alta', color: 'text-primary font-bold' },
    { value: 'URGENT', label: 'Urgente', color: 'text-primary font-black' },
  ];

  const categoryOpts = [
    ...ACTIVITY_CATEGORIES.map((category) => ({ value: category.value as string, label: category.label, color: '' })),
    { value: '', label: 'Sin categoría', color: '' },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Task>) => {
    try {
      await tasksService.update(id as string, updates);
      toast.success('Tarea actualizada');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar tarea');
    }
  };

  /** Serializa los campos personalizados del formulario al objeto plano de §7. */
  const buildCustomFieldsPayload = (values: Record<string, string>): Record<string, string> =>
    toCustomFieldsRecord(
      CUSTOM_FIELD_PRESETS
        .map((preset) => ({ key: preset.key, value: String(values[preset.key] ?? '') }))
        .filter((field) => Boolean(field.value.trim())) as ActivityCustomField[]
    );

  const handleCreateTask = async () => {
    if (!newTask.title) {
      toast.error('El título es requerido');
      return;
    }
    try {
      setIsCreating(true);
      await tasksService.create({
        title: newTask.title,
        description: newTask.description,
        dueDate: newTask.dueDate ? new Date(newTask.dueDate).toISOString() : new Date().toISOString(),
        priority: newTask.priority as any,
        assignedTo: newTask.assignedTo as any,
        categoryId: (newTask.categoryId === CATEGORY_NONE ? null : newTask.categoryId) as ActivityCategory | null,
        customFields: buildCustomFieldsPayload(newTask.customFields),
      });
      toast.success('Tarea creada exitosamente');
      playNotificationSound();
      setIsAddOpen(false);
      resetNewTaskForm();
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al crear tarea');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCompleteTask = async () => {
    if (!selectedTask || !canPerform('ACTIVITIES_TASKS', 'approve')) return;
    try {
      setActionLoading(true);
      let fileUrl = evidenceUrl.trim();
      if (evidenceFile) {
        const uploaded = await storageService.uploadFile('task-evidence', evidenceFile, {
          folder: selectedTask.id,
        });
        fileUrl = uploaded.uri;
      }
      await tasksService.complete(selectedTask.id, { fileUrl });
      toast.success('Tarea completada exitosamente con evidencia');
      setIsCompleteOpen(false);
      setEvidenceUrl('');
      setEvidenceFile(null);
      setSelectedTask(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al completar la tarea');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitApproval = async () => {
    if (!selectedTask) return;
    try {
      setActionLoading(true);
      let fileUrl = evidenceUrl.trim();
      if (evidenceFile) {
        const uploaded = await storageService.uploadFile('task-evidence', evidenceFile, {
          folder: selectedTask.id,
        });
        fileUrl = uploaded.uri;
      }
      await tasksService.submitApproval(selectedTask.id, {
        fileUrl,
        notes: approvalNotes.trim(),
      });
      toast.success('Tarea enviada para aprobación');
      setIsApprovalOpen(false);
      setEvidenceUrl('');
      setEvidenceFile(null);
      setApprovalNotes('');
      setSelectedTask(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al enviar a aprobación');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveTask = async (task: Task) => {
    if (!canPerform('ACTIVITIES_TASKS', 'approve')) return;
    try {
      await tasksService.approve(String(task.id));
      toast.success('Tarea aprobada y completada');
      onRefresh();
      if (detailTask?.id === task.id) setDetailTask(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al aprobar tarea');
    }
  };

  const handleRejectTask = async () => {
    if (!selectedTask || !rejectReason.trim()) {
      toast.error('Indica el motivo del rechazo');
      return;
    }
    try {
      setActionLoading(true);
      await tasksService.reject(selectedTask.id, rejectReason.trim());
      toast.warning('Tarea rechazada y devuelta a "En Progreso"');
      setIsRejectOpen(false);
      setRejectReason('');
      setSelectedTask(null);
      onRefresh();
      if (detailTask?.id === selectedTask.id) setDetailTask(null);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al rechazar tarea');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleAssignee = (empId: string) => {
    setNewTask((prev) => {
      const isAssigned = prev.assignedTo.includes(empId);
      return {
        ...prev,
        assignedTo: isAssigned ? prev.assignedTo.filter((id) => id !== empId) : [...prev.assignedTo, empId],
      };
    });
  };

  const columns = [
    { key: 'title', header: 'Título', width: '25%', editable: canPerform('ACTIVITIES_TASKS', 'edit') },
    {
      key: 'assignments',
      header: 'Asignados',
      width: '20%',
      editable: false,
      render: (_val: any, row: any) => {
        const asgs = row.assignments || [];
        if (asgs.length === 0) return <span className="text-muted-foreground text-xs">Sin asignar</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {asgs.map((a: any) => (
              <Badge key={a.id} variant="outline" className="text-[9px] bg-secondary/50">
                {a.user ? a.user.name : 'Usuario'}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      key: 'priority',
      header: 'Prioridad',
      width: '100px',
      editable: canPerform('ACTIVITIES_TASKS', 'edit'),
      type: 'select' as const,
      options: priorityOpts,
      render: (val: any) => {
        const o = priorityOpts.find((x) => x.value === (val || '').toUpperCase());
        return (
          <span className={cn('text-[10px] font-bold uppercase', o?.color || 'text-muted-foreground')}>
            {o?.label || val}
          </span>
        );
      },
    },
    {
      key: 'categoryId',
      header: 'Categoría',
      width: '130px',
      editable: canPerform('ACTIVITIES_TASKS', 'edit'),
      type: 'select' as const,
      options: categoryOpts,
      render: (val: string | null | undefined) => {
        if (!val) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <Badge variant="outline" className="min-w-0 max-w-full truncate bg-secondary/40 text-[9px] font-bold uppercase">
            {getActivityCategoryLabel(val)}
          </Badge>
        );
      },
    },
    {
      key: 'slaDueAt',
      header: 'SLA',
      width: '130px',
      editable: false,
      render: (val: string | null | undefined, row: Task) => (
        <div className="flex min-w-0 flex-wrap gap-1">
          <SlaBadge slaDueAt={val ?? row?.dueDate ?? null} status={row?.status} showRemaining now={slaNow} />
        </div>
      ),
    },
    {
      key: 'dueDate',
      header: 'Vencimiento',
      width: '100px',
      editable: canPerform('ACTIVITIES_TASKS', 'edit'),
      type: 'datetime-local' as const,
      render: (val: any) => (val ? format(new Date(val), 'dd/MM/yyyy HH:mm') : '-'),
    },
    {
      key: 'status',
      header: 'Estado',
      width: '130px',
      editable: false,
      type: 'select' as const,
      options: statusOpts,
      render: (val: any, row: any) => {
        const status = getTaskDisplayStatus({ ...row, status: val });
        const o = statusOpts.find((x) => x.value === status);
        const label = status === 'OVERDUE' ? 'Vencida' : o?.label || val;
        return (
          <Badge
            variant="outline"
            className={cn(
              'px-2 py-0.5 text-[9px] font-black uppercase',
              status === 'OVERDUE'
                ? 'border-rose-500/20 bg-rose-500/10 text-rose-600'
                : o?.color || 'border-none bg-muted/20 text-muted-foreground'
            )}
          >
            {label}
          </Badge>
        );
      },
    },
  ];

  const kpis = [
    { id: 'ALL', title: 'Total Tareas', value: data.length, icon: ListTodo, color: 'text-primary', bg: 'bg-primary/10' },
    {
      id: 'PENDING',
      title: 'Pendientes',
      value: data.filter((t) => getTaskDisplayStatus(t) === 'PENDING').length,
      icon: Clock,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      id: 'WAITING_APPROVAL',
      title: 'Por Aprobar',
      value: data.filter((t) => String(t.status || '').toUpperCase() === 'WAITING_APPROVAL').length,
      icon: Send,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      id: 'OVERDUE',
      title: 'Vencidas',
      value: data.filter((t) => getTaskDisplayStatus(t) === 'OVERDUE').length,
      icon: AlertTriangle,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
    },
    {
      id: 'COMPLETED',
      title: 'Completadas',
      value: data.filter((t) => (t.status || '').toUpperCase() === 'COMPLETED').length,
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
  ];

  const filtered = data.filter((t) => {
    // Search filter
    const matchesSearch =
      !searchTerm ||
      t.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter
    const displayStatus = getTaskDisplayStatus(t);
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'OVERDUE' ? displayStatus === 'OVERDUE' : (t.status || '').toUpperCase() === statusFilter);

    // Priority filter
    const matchesPriority = priorityFilter === 'ALL' || (t.priority || '').toUpperCase() === priorityFilter;

    // Assigned filter
    const matchesAssigned =
      assignedFilter === 'ALL' ||
      (t.assignments || []).some((a: any) => a.userId === assignedFilter || a.employeeId === assignedFilter);

    // Categoría / Departamento: catálogo cerrado (§4), filtrado en cliente.
    const taskCategory = String(t.categoryId || '').trim().toUpperCase();
    const matchesCategory = categoryFilter === 'ALL' || taskCategory === categoryFilter;

    // Date range filter
    const dueDate = t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : null;
    const matchesDateFrom = !dateFrom || (dueDate && dueDate >= dateFrom);
    const matchesDateTo = !dateTo || (dueDate && dueDate <= dateTo);

    return (
      matchesSearch &&
      matchesStatus &&
      matchesPriority &&
      matchesAssigned &&
      matchesCategory &&
      matchesDateFrom &&
      matchesDateTo
    );
  });

  const activeFiltersCount =
    (statusFilter !== 'ALL' ? 1 : 0) +
    (priorityFilter !== 'ALL' ? 1 : 0) +
    (assignedFilter !== 'ALL' ? 1 : 0) +
    (categoryFilter !== 'ALL' ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 animate-in fade-in duration-500">
      {/* Interactive KPI Cards for Quick Filtering */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => {
          const isSelected = statusFilter === kpi.id;
          return (
            <Card
              key={kpi.id}
              onClick={() => setStatusFilter((current) => (current === kpi.id ? 'ALL' : kpi.id))}
              className={cn(
                'min-w-0 cursor-pointer rounded-2xl border-border/50 bg-card/80 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md',
                isSelected && 'border-primary ring-2 ring-primary/20 bg-primary/[0.03]'
              )}
            >
              <CardContent className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={cn('p-3 rounded-2xl flex items-center justify-center', kpi.bg)}>
                    <kpi.icon className={cn('size-6', kpi.color)} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                      {kpi.title}
                    </p>
                    <p className="text-2xl font-black tracking-tight">{kpi.value}</p>
                  </div>
                </div>
                {isSelected && (
                  <Badge variant="default" className="text-[9px] font-bold px-1.5 py-0.5">
                    Filtrado
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Structured Collapsible Filter Panel (Style of Image 3) */}
      <div className="space-y-4 rounded-2xl border border-border/50 bg-muted/30 p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/80 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-foreground hover:bg-background"
            >
              <Filter className="size-3.5 text-primary" /> Filtros
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0.2 text-[9px] font-black bg-primary/20 text-primary">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
            <span className="hidden text-[10px] font-medium normal-case tracking-normal text-muted-foreground/70 sm:inline">
              Filtra y personaliza el listado de tareas por responsable, prioridad y rango de fechas
            </span>
          </div>

          {activeFiltersCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-8 text-xs font-bold text-muted-foreground hover:text-destructive gap-1.5"
            >
              <RotateCcw className="size-3.5" /> Limpiar filtros
            </Button>
          )}
        </div>

        {/* Collapsible / Always Visible Filters Grid */}
        <div className={cn('grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12', !showFilterPanel && 'hidden sm:grid')}>
          {/* Priority Filter */}
          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-1 lg:col-span-3">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              Prioridad
            </label>
            <Select value={priorityFilter} onValueChange={(val) => setPriorityFilter(val)}>
              <SelectTrigger className="h-9 w-full text-xs">
                <SelectValue placeholder="Todas las prioridades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las prioridades</SelectItem>
                <SelectItem value="LOW">Baja</SelectItem>
                <SelectItem value="MEDIUM">Media</SelectItem>
                <SelectItem value="HIGH">Alta</SelectItem>
                <SelectItem value="URGENT">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Assigned To Filter */}
          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-1 lg:col-span-3">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              Responsable
            </label>
            <Select value={assignedFilter} onValueChange={(val) => setAssignedFilter(val)}>
              <SelectTrigger className="h-9 w-full text-xs">
                <SelectValue placeholder="Todos los responsables" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los responsables</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category / Department Filter */}
          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-1 lg:col-span-3">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              Categoría / Departamento
            </label>
            <Select value={categoryFilter} onValueChange={(val) => setCategoryFilter(val)}>
              <SelectTrigger className="h-9 w-full text-xs" data-testid="activities-task-category-filter">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las categorías</SelectItem>
                {ACTIVITY_CATEGORIES.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date From */}
          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-1 lg:col-span-3">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              Vencimiento Desde
            </label>
            <DateField
              value={dateFrom}
              onChange={(val) => setDateFrom(val)}
              maxDate={dateTo || undefined}
              placeholder="Fecha inicial"
              className="w-full"
            />
          </div>

          {/* Date To */}
          <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-1 lg:col-span-3">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
              Vencimiento Hasta
            </label>
            <DateField
              value={dateTo}
              onChange={(val) => setDateTo(val)}
              minDate={dateFrom || undefined}
              placeholder="Fecha final"
              className="w-full"
            />
          </div>
        </div>
      </div>

      <Card className="min-w-0 overflow-hidden rounded-3xl border-border/50 bg-card/80 shadow-sm">
        <div className="flex min-w-0 flex-col gap-4 border-b border-border/50 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="break-words text-xl font-black uppercase tracking-tight">Tareas</h2>
          </div>
          <div className="erp-list-toolbar flex min-w-0 flex-wrap items-center gap-3">
            <InventoryViewTutorial
              label="Qué son las Tareas"
              targetPrefix="tareas-tutorial"
              compact
              stepKeys={['title', 'data', 'actions']}
              copy={{
                title: {
                  title: 'Tareas',
                  description:
                    'Las tareas te permiten crear, asignar y dar seguimiento a actividades pendientes. Cada tarea puede tener prioridad, fecha de vencimiento y un responsable. Al completarla, queda registrada en la bitácora.',
                },
                data: {
                  title: 'Crear y asignar',
                  description:
                    'Haz clic en "Nueva Tarea" para crear una. Asigna un responsable, prioridad y fecha de vencimiento.',
                },
                actions: {
                  title: 'Gestionar',
                  description:
                    'Edita directamente en la tabla o mueve tarjetas en el tablero Kanban. Puedes enviar a aprobación antes de completar.',
                },
              }}
            />

            <ViewLayoutSelect
              value={viewLayout}
              onChange={(val) => setViewLayout(val)}
              showKanban={true}
            />

            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input
                data-testid="activities-task-search"
                placeholder="Buscar por título..."
                className="h-10 w-full rounded-xl border-border/50 bg-background/50 pl-9 text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {canPerform('ACTIVITIES_TASKS', 'create') && (
              <Button
                data-toolbar-role="primary"
                data-testid="activities-new-task"
                variant="default"
                onClick={() => setIsAddOpen(true)}
                className="shrink-0 rounded-xl px-4 h-10 gap-2 font-black uppercase text-[10px] tracking-widest"
              >
                <Plus className="size-4" /> Nueva Tarea
              </Button>
            )}
          </div>
        </div>

        {viewLayout === 'kanban' ? (
          <TareasKanban
            data={filtered}
            onViewDetail={(task) => setDetailTask(task)}
            onStatusChange={async (taskId, status) => {
              await handleUpdate(taskId, { status: status as any });
            }}
            onSubmitApproval={(task) => {
              setSelectedTask(task);
              setIsApprovalOpen(true);
            }}
            onApprove={(task) => handleApproveTask(task)}
            canEdit={canPerform('ACTIVITIES_TASKS', 'edit')}
            canApprove={canPerform('ACTIVITIES_TASKS', 'approve')}
          />
        ) : viewLayout === 'cards' ? (
          <TareasCardsView
            data={filtered}
            onViewDetail={(task) => setDetailTask(task)}
            onSubmitApproval={(task) => {
              setSelectedTask(task);
              setIsApprovalOpen(true);
            }}
            onApprove={(task) => handleApproveTask(task)}
            onReject={(task) => {
              setSelectedTask(task);
              setIsRejectOpen(true);
            }}
            onComplete={(task) => {
              setDetailTask(null);
              setSelectedTask(task);
              setIsCompleteOpen(true);
            }}
            canEdit={canPerform('ACTIVITIES_TASKS', 'edit')}
            canApprove={canPerform('ACTIVITIES_TASKS', 'approve')}
            getTaskDisplayStatus={getTaskDisplayStatus}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            now={slaNow}
            currentUserId={currentUserId}
            isTaskMine={isTaskMine}
            canClaimTask={canClaimTask}
            isClaiming={claimingId}
            onClaimTask={handleClaimTask}
            onReassignTask={handleOpenReassign}
          />
        ) : (
          <EditableDataTable
            data={filtered}
            columns={columns}
            onRowUpdate={canPerform('ACTIVITIES_TASKS', 'edit') ? handleUpdate : undefined}
            onRowClick={(row) => setDetailTask(row)}
            isLoading={loading}
            onBulkDelete={
              canPerform('ACTIVITIES_TASKS', 'delete')
                ? async (selectedIds) => {
                    try {
                      await Promise.all(selectedIds.map((id) => tasksService.delete(String(id))));
                      toast.success(`${selectedIds.length} tareas eliminadas`);
                      onRefresh();
                    } catch (e: any) {
                      toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar tareas seleccionadas');
                    }
                  }
                : undefined
            }
            bulkActions={(selectedIds) => (
              <div className="flex flex-wrap items-center gap-2">
                {canPerform('ACTIVITIES_TASKS', 'edit') && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-[10px] font-black uppercase tracking-wider text-primary border-primary/30 hover:bg-primary/10"
                    onClick={async () => {
                      try {
                        await Promise.all(selectedIds.map((id) => tasksService.submitApproval(String(id))));
                        toast.success(`${selectedIds.length} tareas enviadas a aprobación`);
                        onRefresh();
                      } catch (e: any) {
                        toast.error(e?.response?.data?.message || e?.message || 'Error al enviar tareas a aprobación');
                      }
                    }}
                  >
                    <Send className="mr-1.5 size-3" /> Enviar a Aprobación ({selectedIds.length})
                  </Button>
                )}
                {canPerform('ACTIVITIES_TASKS', 'approve') && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-[10px] font-black uppercase tracking-wider text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                    onClick={async () => {
                      try {
                        await Promise.all(selectedIds.map((id) => tasksService.complete(String(id))));
                        toast.success(`${selectedIds.length} tareas completadas`);
                        onRefresh();
                      } catch (e: any) {
                        toast.error(e?.response?.data?.message || e?.message || 'Error al completar tareas seleccionadas');
                      }
                    }}
                  >
                    <CheckCircle2 className="mr-1.5 size-3" /> Completar ({selectedIds.length})
                  </Button>
                )}
              </div>
            )}
            onRowDelete={
              canPerform('ACTIVITIES_TASKS', 'delete')
                ? async (id) => {
                    try {
                      await tasksService.delete(id as string);
                      toast.success('Tarea eliminada');
                      onRefresh();
                    } catch (e: any) {
                      toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar tarea');
                    }
                  }
                : undefined
            }
            actions={(row: any) => {
              const status = String(row.status || '').toUpperCase();
              return (
                <div
                  className="flex min-w-max items-center justify-end gap-1"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    data-testid={`activities-open-detail-${row.id}`}
                    title="Ver detalle de la tarea"
                    aria-label="Ver detalle de la tarea"
                    className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    onClick={() => setDetailTask(row)}
                  >
                    <Eye className="size-4" />
                  </Button>

                  {/* Tomar Tarea: solo si la tarea no es del usuario actual (§2.2) */}
                  {canClaimTask(row) && canPerform('ACTIVITIES_TASKS', 'edit') && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      data-testid={`activities-claim-${row.id}`}
                      title="Tomar tarea"
                      aria-label="Tomar tarea"
                      disabled={claimingId === row.id}
                      className="size-8 rounded-lg text-primary hover:bg-primary/10"
                      onClick={() => void handleClaimTask(row as Task)}
                    >
                      {claimingId === row.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <HandHelping className="size-4" />
                      )}
                    </Button>
                  )}

                  {/* Reasignar responsable */}
                  {!isClosedTaskStatus(row) && canPerform('ACTIVITIES_TASKS', 'edit') && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      data-testid={`activities-reassign-${row.id}`}
                      title="Reasignar tarea"
                      aria-label="Reasignar tarea"
                      className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
                      onClick={() => handleOpenReassign(row as Task)}
                    >
                      <UserCog className="size-4" />
                    </Button>
                  )}

                  {/* Send to approval button */}
                  {['PENDING', 'IN_PROGRESS'].includes(status) && canPerform('ACTIVITIES_TASKS', 'edit') && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="Enviar a aprobación"
                      aria-label="Enviar a aprobación"
                      className="size-8 rounded-lg text-primary hover:bg-primary/10"
                      onClick={() => {
                        setSelectedTask(row);
                        setIsApprovalOpen(true);
                      }}
                    >
                      <Send className="size-4" />
                    </Button>
                  )}

                  {/* Approve / Reject buttons for Authorizers */}
                  {status === 'WAITING_APPROVAL' && canPerform('ACTIVITIES_TASKS', 'approve') && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Aprobar tarea"
                        aria-label="Aprobar tarea"
                        className="size-8 rounded-lg text-emerald-600 hover:bg-emerald-500/10"
                        onClick={() => handleApproveTask(row)}
                      >
                        <CheckCircle2 className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Rechazar tarea"
                        aria-label="Rechazar tarea"
                        className="size-8 rounded-lg text-rose-600 hover:bg-rose-500/10"
                        onClick={() => {
                          setSelectedTask(row);
                          setIsRejectOpen(true);
                        }}
                      >
                        <XCircle className="size-4" />
                      </Button>
                    </>
                  )}

                  {/* Direct complete with evidence for non-approval flow */}
                  {status !== 'COMPLETED' && status !== 'WAITING_APPROVAL' && canPerform('ACTIVITIES_TASKS', 'approve') && (
                    <Button
                      type="button"
                      data-testid={`activities-complete-${row.id}`}
                      variant="ghost"
                      size="icon"
                      title="Completar tarea directamente"
                      aria-label="Completar tarea directamente"
                      className="size-8 rounded-lg text-emerald-600 hover:bg-emerald-500/10"
                      onClick={() => {
                        setDetailTask(null);
                        setSelectedTask(row);
                        setIsCompleteOpen(true);
                      }}
                    >
                      <CheckCircle2 className="size-4" />
                    </Button>
                  )}

                  {status === 'COMPLETED' && row.evidences?.[0]?.fileUrl && (
                    <a
                      href={row.evidences[0].fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir evidencia"
                      aria-label="Abrir evidencia"
                      className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    >
                      <Paperclip className="size-4" />
                    </a>
                  )}
                </div>
              );
            }}
            actionsWidth="w-72"
          />
        )}
      </Card>

      <ActivityDetailSheet
        kind="task"
        item={detailTask}
        onUpdate={() => onRefresh()}
        extraActions={
          detailTask && (
            <div className="flex flex-wrap gap-2">
              {canClaimTask(detailTask) && canPerform('ACTIVITIES_TASKS', 'edit') && (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
                  disabled={claimingId === detailTask.id}
                  onClick={() => void handleClaimTask(detailTask as Task)}
                >
                  {claimingId === detailTask.id ? (
                    <Loader2 className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <HandHelping className="mr-1.5 size-4" />
                  )}
                  Tomar Tarea
                </Button>
              )}

              {!isClosedTaskStatus(detailTask) && canPerform('ACTIVITIES_TASKS', 'edit') && (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-border/60 bg-background text-foreground hover:bg-muted"
                  onClick={() => handleOpenReassign(detailTask as Task)}
                >
                  <UserCog className="mr-1.5 size-4" /> Reasignar
                </Button>
              )}

              {['PENDING', 'IN_PROGRESS'].includes(String(detailTask.status || '').toUpperCase()) &&
                canPerform('ACTIVITIES_TASKS', 'edit') && (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl border-primary/30 text-primary hover:bg-primary/10 bg-primary/5"
                    onClick={() => {
                      setSelectedTask(detailTask);
                      setIsApprovalOpen(true);
                    }}
                  >
                    <Send className="mr-1.5 size-4" /> Enviar a Aprobación
                  </Button>
                )}

              {String(detailTask.status || '').toUpperCase() === 'WAITING_APPROVAL' &&
                canPerform('ACTIVITIES_TASKS', 'approve') && (
                  <>
                    <Button
                      type="button"
                      className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={() => handleApproveTask(detailTask)}
                    >
                      <CheckCircle2 className="mr-1.5 size-4" /> Aprobar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl border-rose-500/30 text-rose-600 hover:bg-rose-500/10"
                      onClick={() => {
                        setSelectedTask(detailTask);
                        setIsRejectOpen(true);
                      }}
                    >
                      <XCircle className="mr-1.5 size-4" /> Rechazar
                    </Button>
                  </>
                )}

              {String(detailTask.status || '').toUpperCase() !== 'COMPLETED' &&
                String(detailTask.status || '').toUpperCase() !== 'WAITING_APPROVAL' &&
                canPerform('ACTIVITIES_TASKS', 'approve') && (
                  <Button
                    type="button"
                    className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => {
                      setSelectedTask(detailTask);
                      setIsCompleteOpen(true);
                    }}
                  >
                    <CheckCircle2 className="mr-2 size-4" /> Completar tarea
                  </Button>
                )}
            </div>
          )
        }
        onDelete={
          canPerform('ACTIVITIES_TASKS', 'delete') && detailTask
            ? async () => {
                try {
                  await tasksService.delete(String(detailTask.id));
                  toast.success('Tarea eliminada');
                  onRefresh();
                  setDetailTask(null);
                } catch (e: any) {
                  toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar tarea');
                }
              }
            : undefined
        }
        onOpenChange={(open) => {
          if (!open) setDetailTask(null);
        }}
      />

      {/* Dialog: Create Task */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto rounded-3xl border-border/60 bg-background/95 p-0 shadow-2xl sm:max-w-2xl">
          <DialogHeader className="border-b border-border/50 bg-gradient-to-br from-primary/10 via-background to-background px-6 py-5 sm:px-8">
            <div className="flex items-start gap-3 pr-6">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ListTodo className="size-5" />
              </div>
              <div>
                <DialogTitle className="font-black tracking-tight sm:text-lg">Crear nueva tarea</DialogTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Define el objetivo, la prioridad y quién dará seguimiento.
                </p>
              </div>
            </div>
          </DialogHeader>
          <div className="grid gap-5 px-6 py-6 sm:px-8">
            <div className="space-y-2">
              <Label className="flex items-center gap-1 text-xs font-bold text-foreground">
                Título de la tarea <span className="text-destructive">*</span>
              </Label>
              <Input
                autoFocus
                data-testid="activities-task-title"
                placeholder="Ej. Revisar inventario"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="h-11 rounded-xl bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-bold text-foreground">
                <AlignLeft className="size-3.5 text-primary" />
                Descripción <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <Textarea
                data-testid="activities-task-description"
                placeholder="Agrega contexto, entregables o instrucciones..."
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                className="min-h-28 resize-y rounded-xl bg-background"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <CalendarClock className="size-3.5 text-primary" />
                  Vencimiento
                </Label>
                <DateTimePickerField
                  value={newTask.dueDate}
                  onChange={(val) => setNewTask({ ...newTask, dueDate: val })}
                  placeholder="Seleccionar fecha y hora"
                  className="w-full"
                />
                <p className="text-[11px] text-muted-foreground">Si lo dejas vacío, se registra ahora.</p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Flag className="size-3.5 text-primary" />
                  Prioridad
                </Label>
                <Select value={newTask.priority} onValueChange={(val) => setNewTask({ ...newTask, priority: val })}>
                  <SelectTrigger data-testid="activities-task-priority" className="h-11 w-full text-sm rounded-xl">
                    <SelectValue placeholder="Selecciona prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Baja</SelectItem>
                    <SelectItem value="MEDIUM">Media</SelectItem>
                    <SelectItem value="HIGH">Alta</SelectItem>
                    <SelectItem value="URGENT">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <Label className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <Tag className="size-3.5 text-primary" />
                  Categoría / Departamento
                </Label>
                <Select value={newTask.categoryId} onValueChange={(val) => setNewTask({ ...newTask, categoryId: val })}>
                  <SelectTrigger
                    data-testid="activities-task-category"
                    className="h-11 w-full min-w-0 text-sm rounded-xl"
                  >
                    <SelectValue placeholder="Selecciona categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CATEGORY_NONE}>Sin categoría</SelectItem>
                    {ACTIVITY_CATEGORIES.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Agrupa la tarea para filtrar y reportar.</p>
              </div>
              <div className="min-w-0 space-y-2">
                <Label className="flex items-center gap-2 text-xs font-bold text-foreground">
                  <ListTodo className="size-3.5 text-primary" />
                  Campos personalizados <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <div className="grid min-w-0 gap-2 rounded-xl border border-input bg-muted/[0.12] p-3">
                  {CUSTOM_FIELD_PRESETS.slice(0, MAX_CUSTOM_FIELDS).map((preset) => (
                    <div key={preset.key} className="min-w-0 space-y-1">
                      <Label className="text-[10px] font-bold text-muted-foreground" htmlFor={`custom-${preset.key}`}>
                        {preset.label}
                      </Label>
                      <Input
                        id={`custom-${preset.key}`}
                        data-testid={`activities-task-custom-${preset.key}`}
                        placeholder={preset.placeholder}
                        maxLength={MAX_CUSTOM_FIELD_LENGTH}
                        value={newTask.customFields[preset.key] || ''}
                        onChange={(e) => setCustomFieldValue(preset.key, e.target.value)}
                        className="h-9 min-w-0 rounded-lg bg-background text-xs"
                      />
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground">
                    Hasta {MAX_CUSTOM_FIELDS} campos, {MAX_CUSTOM_FIELD_LENGTH} caracteres por clave y valor.
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-bold text-foreground">
                <UsersRound className="size-3.5 text-primary" />
                Asignar responsables <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-input bg-muted/[0.12] p-2">
                {usersQuery.isLoading ? (
                  <p className="text-xs text-muted-foreground">Cargando usuarios disponibles...</p>
                ) : usersQuery.isError ? (
                  <p className="text-xs text-destructive">No se pudieron cargar los usuarios disponibles.</p>
                ) : (
                  employees.length === 0 && (
                    <p className="text-xs text-muted-foreground">No hay usuarios disponibles</p>
                  )
                )}
                {employees.map((emp) => (
                  <label
                    key={emp.id}
                    htmlFor={`emp-${emp.id}`}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-background',
                      newTask.assignedTo.includes(emp.id) && 'bg-primary/10'
                    )}
                  >
                    <input
                      type="checkbox"
                      id={`emp-${emp.id}`}
                      checked={newTask.assignedTo.includes(emp.id)}
                      onChange={() => toggleAssignee(emp.id)}
                      className="size-4 rounded border-input accent-primary"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{emp.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{emp.email}</span>
                    </span>
                    {newTask.assignedTo.includes(emp.id) && (
                      <CheckCircle2 className="ml-auto size-4 shrink-0 text-primary" />
                    )}
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Selecciona uno o varios usuarios para dar seguimiento.
              </p>
            </div>
          </div>
          <DialogFooter className="border-t border-border/50 bg-muted/[0.12] px-6 py-4 sm:px-8">
            <Button variant="outline" className="rounded-xl" onClick={() => setIsAddOpen(false)} disabled={isCreating}>
              Cancelar
            </Button>
            <Button
              data-testid="activities-task-submit"
              onClick={handleCreateTask}
              disabled={isCreating || !newTask.title.trim()}
              className="rounded-xl px-5"
            >
              {isCreating ? 'Creando…' : <><Plus className="mr-2 size-4" />Crear tarea</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Complete Task (Direct closure) */}
      <Dialog open={isCompleteOpen} onOpenChange={setIsCompleteOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-h-[85vh] overflow-y-auto rounded-3xl border-border/60 bg-background/95 p-0 shadow-2xl sm:max-w-[480px]">
          <DialogHeader className="border-b border-border/50 bg-gradient-to-br from-emerald-500/10 via-background to-background px-6 py-5 sm:px-8">
            <div className="flex items-start gap-3 pr-6">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <DialogTitle className="font-black tracking-tight sm:text-lg">Completar tarea</DialogTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Agrega una evidencia para dejar constancia del cierre.
                </p>
              </div>
            </div>
          </DialogHeader>
          <div className="grid gap-5 px-6 py-6 sm:px-8">
            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4">
              <p className="text-sm leading-6 text-muted-foreground">
                Estás a punto de marcar la tarea <strong className="text-foreground">{selectedTask?.title}</strong> como completada.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">Archivo de evidencia</Label>
              <Input
                type="file"
                onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                className="h-11 rounded-xl bg-background file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:font-bold file:text-primary"
              />
              <Label className="text-xs font-semibold text-muted-foreground">O usa un enlace externo</Label>
              <Input
                placeholder="https://ejemplo.com/imagen.jpg"
                value={evidenceUrl}
                data-testid="activities-task-evidence-url"
                onChange={(e) => setEvidenceUrl(e.target.value)}
                className="h-11 rounded-xl bg-background"
              />
              <p className="text-[10px] text-muted-foreground">
                El archivo se guarda de forma privada y solo usuarios autorizados podrán abrirlo.
              </p>
            </div>
          </div>
          <DialogFooter className="border-t border-border/50 bg-muted/[0.12] px-6 py-4 sm:px-8">
            <Button variant="outline" className="rounded-xl" onClick={() => setIsCompleteOpen(false)} disabled={actionLoading}>
              Cancelar
            </Button>
            {canPerform('ACTIVITIES_TASKS', 'approve') && (
              <Button
                data-testid="activities-task-complete-submit"
                onClick={handleCompleteTask}
                disabled={actionLoading}
                className="rounded-xl px-5"
              >
                {actionLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                Confirmar cierre
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Submit Task for Approval */}
      <Dialog open={isApprovalOpen} onOpenChange={setIsApprovalOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-h-[85vh] overflow-y-auto rounded-3xl border-border/60 bg-background/95 p-0 shadow-2xl sm:max-w-[480px]">
          <DialogHeader className="border-b border-border/50 bg-gradient-to-br from-primary/10 via-background to-background px-6 py-5 sm:px-8">
            <div className="flex items-start gap-3 pr-6">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Send className="size-5" />
              </div>
              <div>
                <DialogTitle className="font-black tracking-tight sm:text-lg">Enviar a Aprobación</DialogTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Envía el entregable al supervisor para su revisión final.
                </p>
              </div>
            </div>
          </DialogHeader>
          <div className="grid gap-4 px-6 py-6 sm:px-8">
            <div className="rounded-2xl border border-primary/15 bg-primary/5 p-3.5">
              <p className="text-xs leading-5 text-muted-foreground">
                La tarea pasará al estado <strong className="text-foreground">Por Aprobar</strong>. El supervisor o aprobador será notificado para validarla.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Notas o resumen de entrega</Label>
              <Textarea
                placeholder="Indica qué se concluyó o detalles relevantes para el revisor..."
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                className="min-h-20 text-xs rounded-xl bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">Archivo o entregable de evidencia</Label>
              <Input
                type="file"
                onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                className="h-10 text-xs rounded-xl bg-background file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-xs file:font-bold file:text-primary"
              />
              <Input
                placeholder="O enlace externo https://..."
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                className="h-9 text-xs rounded-xl bg-background"
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/50 bg-muted/[0.12] px-6 py-4 sm:px-8">
            <Button variant="outline" className="rounded-xl" onClick={() => setIsApprovalOpen(false)} disabled={actionLoading}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitApproval}
              disabled={actionLoading}
              className="rounded-xl px-5"
            >
              {actionLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Send className="mr-1.5 size-4" />}
              Enviar entregable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Reject Task */}
      <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-h-[85vh] overflow-y-auto rounded-3xl border-border/60 bg-background/95 p-0 shadow-2xl sm:max-w-[440px]">
          <DialogHeader className="border-b border-border/50 bg-gradient-to-br from-rose-500/10 via-background to-background px-6 py-5 sm:px-8">
            <div className="flex items-start gap-3 pr-6">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600">
                <XCircle className="size-5" />
              </div>
              <div>
                <DialogTitle className="font-black tracking-tight sm:text-lg">Rechazar Aprobación</DialogTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Indica los motivos por los cuales no se aprueba el entregable.
                </p>
              </div>
            </div>
          </DialogHeader>
          <div className="grid gap-4 px-6 py-6 sm:px-8">
            <p className="text-xs text-muted-foreground">
              La tarea regresará a <strong className="text-foreground">En Progreso</strong> para que el responsable realice las correcciones solicitadas.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">
                Motivo del rechazo <span className="text-destructive">*</span>
              </Label>
              <Textarea
                autoFocus
                placeholder="Explica qué falta o debe corregirse..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="min-h-24 text-xs rounded-xl bg-background"
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/50 bg-muted/[0.12] px-6 py-4 sm:px-8">
            <Button variant="outline" className="rounded-xl" onClick={() => setIsRejectOpen(false)} disabled={actionLoading}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectTask}
              disabled={actionLoading || !rejectReason.trim()}
              className="rounded-xl px-5"
            >
              {actionLoading ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              Confirmar Rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Reassign Task (historial en ActivityLog, §2.1) */}
      <ReassignTaskModal
        open={isReassignOpen}
        task={reassignTask}
        onOpenChange={(open) => {
          setIsReassignOpen(open);
          if (!open) setReassignTask(null);
        }}
        onReassigned={handleReassigned}
      />
    </div>
  );
};
