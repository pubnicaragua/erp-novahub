import { useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardPen,
  Columns3,
  GitFork,
  ListTodo,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  TrendingUp,
  Paperclip,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../services/api';
import { asList, invalidateTenantQueries, useTenantQuery } from '../hooks/useTenantQuery';
import { useAuth } from '../contexts/AuthContext';
import { useBranchScope } from '../hooks/useBranchScope';
import { BranchScopeFilter } from './ui/BranchScopeFilter';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { moveAsanaTask } from './asana/moveTask';
import { TaskDetailModal } from './asana/TaskDetailModal';
import { BoardListView } from './asana/BoardListView';
import { BoardTimelineView } from './asana/BoardTimelineView';
import { BoardCalendarView } from './asana/BoardCalendarView';
import { BoardFilesView } from './asana/BoardFilesView';
import { BoardProgressView } from './asana/BoardProgressView';
import { SmartFiltersBar, type SmartFilterType } from './asana/SmartFiltersBar';

type Section = { id: string; name: string; color?: string | null; sortOrder: number };
type Board = { id: string; name: string; description?: string | null; branchId: string; sections?: Section[]; statusColor?: string; statusText?: string | null; statusUpdatedAt?: string | null; };
type Task = {
  id: string;
  title: string;
  sectionId?: string | null;
  parentTaskId?: string | null;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  startDate?: string | null;
  progress?: number;
  assigneeId?: string | null;
  assignee?: { id: string; name: string; avatar?: string; avatarUrl?: string } | null;
};
type Branch = { id: string; name: string };
type BoardDetailResponse = Board & { tasks?: Task[] };
type ViewMode = 'kanban' | 'list' | 'timeline' | 'calendar' | 'files' | 'progress';

type BoardViewProps = {
  board: Board | null;
  sections: Section[];
  allTasks: Task[];
  filteredTasks: Task[];
  loading: boolean;
  failed: boolean;
  canCreateTask: boolean;
  canMoveTask: boolean;
  canManageBoard: boolean;
  viewMode: ViewMode;
  smartFilter: SmartFilterType;
  searchQuery: string;
  quickTitles: Record<string, string>;
  creating: boolean;
  moving: boolean;
  onViewModeChange: (mode: ViewMode) => void;
  onSmartFilterChange: (filter: SmartFilterType) => void;
  onSearchQueryChange: (query: string) => void;
  onBack: () => void;
  onRefresh: () => void;
  onTitleChange: (sectionId: string, title: string) => void;
  onCreateTask: (sectionId: string, title: string) => void;
  onCreateSubtask: (parentTaskId: string, title: string) => void;
  onMoveTask: (taskId: string, sectionId: string, afterTaskId?: string) => void;
  onSelectTask: (taskId: string) => void;
  onAddSection: (name: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onToggleTask: (taskId: string, currentStatus?: string) => void;
};

type CreateBoardDialogProps = {
  open: boolean;
  pending: boolean;
  name: string;
  description: string;
  branchId: string;
  blank: boolean;
  branches: Branch[];
  onOpenChange: (open: boolean) => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onBranchChange: (value: string) => void;
  onBlankChange: (value: boolean) => void;
  onCreate: () => void;
};

const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

const boardKey = ['asana', 'boards'];

export function AsanaPage() {
  const { canPerform, user } = useAuth();
  const { accessibleBranches, selectedBranchId, isLoading: branchesLoading } = useBranchScope();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [branchId, setBranchId] = useState('');
  const [blankBoard, setBlankBoard] = useState(false);
  const [quickTitles, setQuickTitles] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [smartFilter, setSmartFilter] = useState<SmartFilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);

  // Carga de tableros del tenant autenticado mediante React Query.
  const boardsQuery = useTenantQuery<Board[]>(boardKey, async () => asList(await api.get('/asana/boards')));
  const visibleBoards = useMemo(() => boardsQuery.data?.filter((board) => !selectedBranchId || board.branchId === selectedBranchId) ?? [], [boardsQuery.data, selectedBranchId]);
  const selectedBoard = useMemo(() => boardsQuery.data?.find((board) => board.id === selectedBoardId) ?? null, [boardsQuery.data, selectedBoardId]);
  const detailQuery = useTenantQuery<Board | null>(['asana', 'board', selectedBoardId], async () => selectedBoardId ? await api.get(`/asana/boards/${selectedBoardId}`) : null, { enabled: Boolean(selectedBoardId) });
  const tasksQuery = useTenantQuery<Task[]>(['asana', 'board', selectedBoardId, 'tasks'], async () => {
    if (!selectedBoardId) return [];
    const detail = await api.get<BoardDetailResponse>(`/asana/boards/${selectedBoardId}`);
    return asList(detail?.tasks);
  }, { enabled: Boolean(selectedBoardId) });

  // Mutación para la creación de un tablero de Asana (con opción de tablero en blanco).
  const createBoard = useMutation({
    mutationFn: () =>
      api.post('/asana/boards', {
        name: name.trim(),
        description: description.trim() || undefined,
        branchId,
        blank: blankBoard || undefined,
      }),
    onSuccess: (board: Board) => {

      setCreateOpen(false);
      setName('');
      setDescription('');
      setBranchId('');
      setBlankBoard(false);
      setSelectedBoardId(board.id);
      toast.success('Tablero creado');
    },
    onError: (error: unknown) => toast.error(errorMessage(error, 'No se pudo crear el tablero')),
  });

  // Mutación para agregar una tarea rápidamente a una columna.
  const createTask = useMutation({
    mutationFn: ({ sectionId, title }: { sectionId: string; title: string }) => {
      const payload: any = { title, sectionId };
      const todayStr = new Date().toISOString().substring(0, 10);

      // Si el usuario crea una tarea estando en un filtro activo, la tarea se adapta para no desaparecer
      if (smartFilter === 'my-day') {
        payload.dueDate = `${todayStr}T23:59:59Z`;
        payload.assigneeId = user?.id;
      } else if (smartFilter === 'important') {
        payload.priority = 'HIGH';
      } else if (smartFilter === 'urgent') {
        payload.priority = 'URGENT';
      } else if (smartFilter === 'in-progress') {
        payload.status = 'IN_PROGRESS';
      } else if (smartFilter === 'planned') {
        payload.dueDate = `${todayStr}T23:59:59Z`;
      }

      return api.post(`/asana/boards/${selectedBoardId}/tasks`, payload);
    },
    onSuccess: (_, variables) => {

      void tasksQuery.refetch();
      void detailQuery.refetch();
      setQuickTitles((current) => ({ ...current, [variables.sectionId]: '' }));
      toast.success('Tarea creada');
    },
    onError: (error: unknown) => toast.error(errorMessage(error, 'No se pudo crear la tarea')),
  });

  // Mutación para agregar una subtarea rápidamente desde cualquier vista.
  const createSubtask = useMutation({
    mutationFn: ({ parentTaskId, title }: { parentTaskId: string; title: string }) =>
      api.post(`/asana/boards/${selectedBoardId}/tasks`, { title, parentTaskId }),
    onSuccess: () => {

      void tasksQuery.refetch();
      void detailQuery.refetch();
      toast.success('Subtarea creada');
    },
    onError: (error: unknown) => toast.error(errorMessage(error, 'No se pudo crear la subtarea')),
  });

  // Mutación para mover tareas entre columnas y posiciones.
  const moveTask = useMutation({
    mutationFn: ({ taskId, sectionId, afterTaskId }: { taskId: string; sectionId: string; afterTaskId?: string }) => {
      if (!selectedBoardId) throw new Error('No se seleccionó un tablero');
      return moveAsanaTask(api, selectedBoardId, taskId, sectionId, afterTaskId);
    },
    onSuccess: () => {

      void tasksQuery.refetch();
      void detailQuery.refetch();
    },
    onError: (error: unknown) => toast.error(errorMessage(error, 'No se pudo mover la tarea')),
  });

  // Mutación para alternar el estado completado de una tarea o subtarea directamente.
  const toggleTask = useMutation({
    mutationFn: ({ taskId, currentStatus }: { taskId: string; currentStatus?: string }) => {
      const nextStatus = currentStatus === 'COMPLETED' ? 'TODO' : 'COMPLETED';
      return api.patch(`/asana/boards/${selectedBoardId}/tasks/${taskId}`, { status: nextStatus });
    },
    onMutate: async ({ taskId, currentStatus }) => {
      const nextStatus = currentStatus === 'COMPLETED' ? 'TODO' : 'COMPLETED';
      const queryKey = ['asana', 'board', selectedBoardId, 'tasks'];
      await queryClient.cancelQueries({ queryKey });
      const previousTasks = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (oldTasks: Task[] | undefined) => {
        if (!oldTasks) return oldTasks;
        return oldTasks.map(t => (t.id === taskId ? { ...t, status: nextStatus } : t));
      });
      return { previousTasks, queryKey };
    },
    onSuccess: () => {
      // Background refetch instead of forced invalidation blocker
      void tasksQuery.refetch();
    },
    onError: (error: unknown, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(context.queryKey, context.previousTasks);
      }
      toast.error(errorMessage(error, 'No se pudo cambiar el estado'));
    },
  });

  // Mutación para crear una nueva sección / columna personalizada en el tablero.
  const addSection = useMutation({
    mutationFn: (sectionName: string) =>
      api.post(`/asana/boards/${selectedBoardId}/sections`, { name: sectionName }),
    onSuccess: () => {

      void detailQuery.refetch();
      toast.success('Columna añadida');
    },
    onError: (error: unknown) => toast.error(errorMessage(error, 'No se pudo crear la columna')),
  });

  // Mutación para eliminar una sección / columna del tablero.
  const deleteSection = useMutation({
    mutationFn: (sectionId: string) =>
      api.delete(`/asana/boards/${selectedBoardId}/sections/${sectionId}`),
    onSuccess: () => {

      void detailQuery.refetch();
      void tasksQuery.refetch();
      toast.success('Columna eliminada');
    },
    onError: (error: unknown) => toast.error(errorMessage(error, 'No se pudo eliminar la columna')),
  });

  const detail = detailQuery.data || selectedBoard;
  const sections = detail?.sections ?? [];
  const allTasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const canCreateBoard = canPerform('ASANA', 'create');
  
  
  const canManageBoard = canPerform('ASANA', 'edit');
  const canCreateTask = canPerform('ASANA_TASKS', 'create');
  const canMoveTask = canPerform('ASANA_TASKS', 'edit');

  // Filtrado reactivo de tareas según búsqueda y filtros inteligentes (Image 4)
  const filteredTasks = useMemo(() => {
    let list = allTasks;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q));
    }
    const todayStr = new Date().toISOString().substring(0, 10);
    switch (smartFilter) {
      case 'my-day':
        return list.filter((t) => t.assigneeId === user?.id || (t.dueDate && t.dueDate.substring(0, 10) === todayStr));
      case 'important':
        return list.filter((t) => t.priority === 'HIGH' || t.priority === 'URGENT');
      case 'planned':
        return list.filter((t) => Boolean(t.dueDate || t.startDate));
      case 'in-progress':
        return list.filter((t) => t.status === 'IN_PROGRESS');
      case 'urgent':
        return list.filter((t) => t.priority === 'URGENT');
      default:
        return list;
    }
  }, [allTasks, searchQuery, smartFilter]);

  const handleOpenTaskDetail = (taskId: string) => {
    setSelectedTaskId(taskId);
    setTaskDetailOpen(true);
  };

  // Abre el modal de creación asegurando que branchId contenga la sucursal activa.
  const openCreate = () => {
    setBranchId(selectedBranchId || accessibleBranches[0]?.id || '');
    setBlankBoard(false);
    setCreateOpen(true);
  };

  if (selectedBoardId) {
    return (
      <>
        <BoardView
          board={detail}
          sections={sections}
          allTasks={allTasks}
          filteredTasks={filteredTasks}
          loading={detailQuery.isLoading}
          failed={detailQuery.isError}
          canCreateTask={canCreateTask}
          canMoveTask={canMoveTask}
          canManageBoard={canManageBoard}
          viewMode={viewMode}
          smartFilter={smartFilter}
          searchQuery={searchQuery}
          quickTitles={quickTitles}
          creating={createTask.isPending}
          moving={moveTask.isPending}
          onViewModeChange={setViewMode}
          onSmartFilterChange={setSmartFilter}
          onSearchQueryChange={setSearchQuery}
          onBack={() => setSelectedBoardId(null)}
          onRefresh={() => {
            void detailQuery.refetch();
            void tasksQuery.refetch();
          }}
          onTitleChange={(sectionId, title) =>
            setQuickTitles((current) => ({ ...current, [sectionId]: title }))
          }
          onCreateTask={(sectionId, title) => createTask.mutate({ sectionId, title })}
          onCreateSubtask={(parentTaskId, title) => createSubtask.mutate({ parentTaskId, title })}
          onMoveTask={(taskId, sectionId, afterTaskId) =>
            moveTask.mutate({ taskId, sectionId, afterTaskId })
          }
          onSelectTask={handleOpenTaskDetail}
          onAddSection={(sectionName) => addSection.mutate(sectionName)}
          onDeleteSection={(sectionId) => deleteSection.mutate(sectionId)}
          onToggleTask={(taskId, currentStatus) => toggleTask.mutate({ taskId, currentStatus })}
        />

        {/* Modal detallado de la tarea (Fase 3: colaboración, subtareas con fecha y comentarios) */}
        {selectedBoardId && selectedTaskId && (
          <TaskDetailModal
            boardId={selectedBoardId}
            taskId={selectedTaskId}
            sections={sections}
            canEdit={canMoveTask}
            canDelete={canPerform('ASANA_TASKS', 'delete')}
            open={taskDetailOpen}
            onOpenChange={setTaskDetailOpen}
            onTaskUpdated={() => {
              void tasksQuery.refetch();
              void detailQuery.refetch();
            }}
            onTaskDeleted={() => {
              void tasksQuery.refetch();
              void detailQuery.refetch();
              setSelectedTaskId(null);
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-full bg-background p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-primary">
              <ClipboardPen className="size-5" />
              <span className="text-xs font-bold uppercase tracking-[0.18em]">Gestión de trabajo</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Asana</h1>
            <p className="mt-2 text-sm text-muted-foreground">Organiza el trabajo de tu equipo en tableros y secciones.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <BranchScopeFilter showLabel={false} />
            {canCreateBoard && (
              <Button onClick={openCreate}>
                <Plus className="mr-2 size-4" />Nuevo tablero
              </Button>
            )}
          </div>
        </header>
        {boardsQuery.isLoading || branchesLoading ? (
          <Loading />
        ) : boardsQuery.isError ? (
          <ErrorState onRetry={() => void boardsQuery.refetch()} />
        ) : !visibleBoards.length ? (
          <EmptyState canCreate={canCreateBoard} onCreate={openCreate} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleBoards.map((board) => (
              <button
                key={board.id}
                type="button"
                onClick={() => setSelectedBoardId(board.id)}
                className="group rounded-2xl border border-border/70 bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold group-hover:text-primary">{board.name}</h2>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{board.description || 'Sin descripción'}</p>
                  </div>
                  <Sparkles className="size-5 text-primary/70" />
                </div>
                <p className="mt-5 text-xs text-muted-foreground">{board.sections?.length || 0} secciones</p>
              </button>
            ))}
          </div>
        )}
      </div>
      <CreateBoardDialog
        open={createOpen}
        pending={createBoard.isPending}
        name={name}
        description={description}
        branchId={branchId}
        blank={blankBoard}
        branches={accessibleBranches}
        onOpenChange={setCreateOpen}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        onBranchChange={setBranchId}
        onBlankChange={setBlankBoard}
        onCreate={() => createBoard.mutate()}
      />
    </div>
  );
}

// Componente para la vista interactiva con selector de 4 vistas: Kanban, Lista, Cronograma (Gantt) y Calendario.
function BoardView({
  board,
  sections,
  allTasks,
  filteredTasks,
  loading,
  failed,
  canCreateTask,
  canMoveTask,
  canManageBoard,
  viewMode,
  smartFilter,
  searchQuery,
  quickTitles,
  creating,
  moving: _moving,
  onViewModeChange,
  onSmartFilterChange,
  onSearchQueryChange,
  onBack,
  onRefresh,
  onTitleChange,
  onCreateTask,
  onCreateSubtask,
  onMoveTask,
  onSelectTask,
  onAddSection,
  onDeleteSection,
  onToggleTask,
}: BoardViewProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [isAddingSection, setIsAddingSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const dragDepth = useRef<Record<string, number>>({});

  const clearDrag = () => {
    setDraggedTaskId(null);
    setDragOverSectionId(null);
    dragDepth.current = {};
  };

  const handleDragStart = (event: React.DragEvent, taskId: string) => {
    event.dataTransfer.setData('text/plain', taskId);
    event.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
  };

  const handleDragEnter = (event: React.DragEvent, sectionId: string) => {
    event.preventDefault();
    dragDepth.current[sectionId] = (dragDepth.current[sectionId] || 0) + 1;
    setDragOverSectionId(sectionId);
  };

  const handleDragLeave = (event: React.DragEvent, sectionId: string) => {
    event.preventDefault();
    dragDepth.current[sectionId] = Math.max(0, (dragDepth.current[sectionId] || 0) - 1);
    if (!dragDepth.current[sectionId]) {
      setDragOverSectionId((current) => (current === sectionId ? null : current));
    }
  };

  const handleDrop = (event: React.DragEvent, sectionId: string, targetTaskId?: string) => {
    event.preventDefault();
    event.stopPropagation();
    const taskId = event.dataTransfer.getData('text/plain');
    const task = allTasks.find((item) => item.id === taskId);
    clearDrag();
    if (!canMoveTask || !taskId || !task || taskId === targetTaskId) return;
    onMoveTask(taskId, sectionId, targetTaskId);
  };

  const handleAddSectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSectionName.trim()) {
      onAddSection(newSectionName.trim());
      setNewSectionName('');
      setIsAddingSection(false);
    }
  };

  const toggleCardSubtasks = (taskId: string) => {
    setExpandedCards((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  if (loading) return <div className="min-h-full bg-background p-8"><Loading /></div>;
  if (failed || !board) return <div className="min-h-full bg-background p-8"><ErrorState onRetry={onRefresh} /></div>;

  return (
    <div className="min-h-full bg-background p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-[1700px] space-y-5">
        {/* Encabezado del Tablero con Selector de Vistas */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" aria-label="Volver a tableros" onClick={onBack}>
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{board.name}</h1>
              {board.description && <p className="mt-0.5 text-xs text-muted-foreground">{board.description}</p>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Selector de 4 vistas: Tablero (Kanban) / Lista / Cronograma (Gantt) / Calendario */}
            <div className="flex items-center rounded-xl bg-muted/50 p-1 border">
              <button
                type="button"
                onClick={() => onViewModeChange('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'kanban'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Columns3 className="size-3.5" />
                Tablero
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'list'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ListTodo className="size-3.5" />
                Lista
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('timeline')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'timeline'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Calendar className="size-3.5" />
                Cronograma
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'calendar'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <CalendarDays className="size-3.5" />
                Calendario
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('progress')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'progress'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TrendingUp className="size-3.5" />
                Progreso
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange('files')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'files'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Paperclip className="size-3.5" />
                Archivos
              </button>
            </div>

            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="mr-2 size-4" />Actualizar
            </Button>
          </div>
        </header>

        {/* Barra de Filtros Inteligentes (Inspirado en Image 4: Mi Día, Importante, etc.) */}
        <SmartFiltersBar
          tasks={allTasks}
          activeFilter={smartFilter}
          onFilterChange={onSmartFilterChange}
          searchQuery={searchQuery}
          onSearchChange={onSearchQueryChange}
        />

        {/* 1. Vista Kanban con Subtareas Visibles en Tarjeta */}
        {viewMode === 'kanban' && (
          <div className="flex min-w-0 items-start gap-4 overflow-x-auto pb-6">
            {sections.map((section: Section) => {
              // Muestra únicamente tareas principales en las columnas Kanban
              const sectionTasks = filteredTasks.filter(
                (task: Task) => task.sectionId === section.id && !task.parentTaskId
              );
              const title = quickTitles[section.id] || '';
              const isDragOver = dragOverSectionId === section.id;

              return (
                <section
                  key={section.id}
                  className={`w-80 shrink-0 rounded-2xl border bg-card p-3 shadow-sm transition-all duration-150 group/section ${
                    isDragOver ? 'border-primary ring-2 ring-primary/20 bg-primary/[0.02]' : 'border-border/70'
                  }`}
                  onDragEnter={canMoveTask ? (event) => handleDragEnter(event, section.id) : undefined}
                  onDragLeave={canMoveTask ? (event) => handleDragLeave(event, section.id) : undefined}
                  onDragOver={canMoveTask ? (event) => event.preventDefault() : undefined}
                  onDrop={canMoveTask ? (event) => handleDrop(event, section.id) : undefined}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-sm">{section.name}</h2>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {sectionTasks.length}
                      </span>
                    </div>

                    {canManageBoard && (
                      <button
                        type="button"
                        onClick={() => onDeleteSection(section.id)}
                        className="opacity-0 group-hover/section:opacity-100 text-muted-foreground hover:text-destructive transition p-1 rounded"
                        title="Eliminar columna"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {sectionTasks.map((task: Task) => {
                      const taskSubtasks = allTasks.filter((t) => t.parentTaskId === task.id);
                      const isExpanded = expandedCards[task.id];
                      const completedCount = taskSubtasks.filter((s) => s.status === 'COMPLETED').length;

                      return (
                        <article
                          key={task.id}
                          draggable={canMoveTask}
                          onClick={() => onSelectTask(task.id)}
                          onDragStart={canMoveTask ? (event) => handleDragStart(event, task.id) : undefined}
                          onDragEnd={canMoveTask ? clearDrag : undefined}
                          onDragOver={canMoveTask ? (event) => event.preventDefault() : undefined}
                          onDrop={canMoveTask ? (event) => handleDrop(event, section.id, task.id) : undefined}
                          className={`rounded-xl border border-border/60 bg-background p-3 transition-all duration-150 cursor-pointer ${
                            canMoveTask ? 'hover:border-primary/50 hover:shadow-sm' : ''
                          } ${draggedTaskId === task.id ? 'opacity-30 scale-95' : ''}`}
                        >
                          <p className="text-sm font-medium">{task.title}</p>
                          <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
                            {task.dueDate ? (
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                                <Calendar className="size-3" />
                                {new Date(task.dueDate).toLocaleDateString('es-NI')}
                              </span>
                            ) : (
                              <div />
                            )}
                            {task.assignee && (
                              <Avatar className="size-5 shrink-0 border ml-auto shadow-sm">
                                <AvatarImage src={task.assignee.avatar || task.assignee.avatarUrl || ''} />
                                <AvatarFallback className="text-[9px]">
                                  {task.assignee.name.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>

                          {/* Vista visible de subtareas dentro de la tarjeta Kanban */}
                          {taskSubtasks.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border/40">
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1 font-medium">
                                  <GitFork className="size-3 rotate-180" />
                                  {completedCount}/{taskSubtasks.length} subtareas
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleCardSubtasks(task.id);
                                  }}
                                  className="hover:text-primary text-[10px] font-semibold transition"
                                >
                                  {isExpanded ? 'Ocultar' : 'Ver'}
                                </button>
                              </div>

                              {isExpanded && (
                                <div className="mt-1.5 space-y-1">
                                  {taskSubtasks.map((subtask) => {
                                    const isDone = subtask.status === 'COMPLETED';
                                    return (
                                      <div
                                        key={subtask.id}
                                        className="flex items-center gap-1.5 text-xs p-1 rounded bg-muted/30 hover:bg-muted/60 transition"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onSelectTask(subtask.id);
                                        }}
                                      >
                                        <button
                                          type="button"
                                          disabled={!canMoveTask}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleTask(subtask.id, subtask.status);
                                          }}
                                          className="text-muted-foreground hover:text-primary shrink-0 transition"
                                        >
                                          {isDone ? (
                                            <CheckCircle2 className="size-3 text-emerald-500" />
                                          ) : (
                                            <Circle className="size-3" />
                                          )}
                                        </button>
                                        <span
                                          className={`truncate flex-1 text-[11px] ${
                                            isDone ? 'line-through text-muted-foreground' : ''
                                          }`}
                                        >
                                          {subtask.title}
                                        </span>
                                        {subtask.dueDate && (
                                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                            {new Date(subtask.dueDate).toLocaleDateString('es-NI', { month: 'short', day: 'numeric' })}
                                          </span>
                                        )}
                                        {subtask.assignee && (
                                          <Avatar className="size-4 shrink-0 border shadow-sm ml-1">
                                            <AvatarImage src={subtask.assignee.avatar || subtask.assignee.avatarUrl || ''} />
                                            <AvatarFallback className="text-[8px]">
                                              {subtask.assignee.name.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                          </Avatar>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}

                    {!sectionTasks.length && (
                      <p className="rounded-xl border border-dashed border-border/70 p-3 text-xs text-muted-foreground text-center">
                        {canMoveTask ? 'Suelta una tarea aquí.' : 'Sin tareas todavía.'}
                      </p>
                    )}
                  </div>

                  {canCreateTask && (
                    <form
                      className="mt-3 flex gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (title.trim()) onCreateTask(section.id, title.trim());
                      }}
                    >
                      <Input
                        value={title}
                        onChange={(event) => onTitleChange(section.id, event.target.value)}
                        placeholder="Añadir tarea"
                        className="h-8 text-xs"
                        disabled={creating}
                      />
                      <Button
                        type="submit"
                        size="sm"
                        className="h-8 px-2"
                        disabled={!title.trim() || creating}
                        aria-label={`Añadir tarea a ${section.name}`}
                      >
                        {creating ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                      </Button>
                    </form>
                  )}
                </section>
              );
            })}

            {/* Añadir nueva columna / sección personalizada */}
            {canManageBoard && (
              <div className="w-72 shrink-0">
                {isAddingSection ? (
                  <form
                    onSubmit={handleAddSectionSubmit}
                    className="rounded-2xl border bg-card p-3 shadow-sm space-y-2"
                  >
                    <Input
                      value={newSectionName}
                      onChange={(e) => setNewSectionName(e.target.value)}
                      placeholder="Nombre de la nueva columna"
                      className="h-9 text-xs"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button type="submit" size="sm" className="h-8 text-xs" disabled={!newSectionName.trim()}>
                        Añadir columna
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          setIsAddingSection(false);
                          setNewSectionName('');
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingSection(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 p-4 text-xs font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary transition bg-muted/10 hover:bg-muted/20"
                  >
                    <Plus className="size-4" />
                    Añadir columna
                  </button>
                )}
              </div>
            )}

            {!sections.length && (
              <div className="w-full rounded-2xl border border-dashed border-border/70 p-12 text-center my-4">
                <Columns3 className="mx-auto size-9 text-muted-foreground" />
                <h3 className="mt-4 font-semibold text-base">Este tablero no tiene secciones aún</h3>
                <p className="mt-1 text-sm text-muted-foreground">Añade tu primera columna para empezar a organizar el trabajo a tu conveniencia.</p>
                {canManageBoard && (
                  <Button className="mt-4" size="sm" onClick={() => setIsAddingSection(true)}>
                    <Plus className="mr-2 size-4" /> Añadir primera columna
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. Vista de Lista con Subtareas Desplegables en Árbol (Image 2) */}
        {viewMode === 'list' && (
          <BoardListView
            sections={sections}
            tasks={filteredTasks}
            canCreateTask={canCreateTask}
            canEditTask={canMoveTask}
            quickTitles={quickTitles}
            creating={creating}
            onTitleChange={onTitleChange}
            onCreateTask={onCreateTask}
            onCreateSubtask={onCreateSubtask}
            onToggleTask={onToggleTask}
            onSelectTask={onSelectTask}
          />
        )}

        {/* 3. Vista de Cronograma / Gantt con Conectores de Dependencia (Image 3) */}
        {viewMode === 'timeline' && (
          <BoardTimelineView
            tasks={filteredTasks}
            onSelectTask={onSelectTask}
          />
        )}

        {/* 4. Vista de Calendario Mensual */}
        {viewMode === 'calendar' && (
          <BoardCalendarView
            tasks={filteredTasks}
            onSelectTask={onSelectTask}
          />
        )}

        {/* 5. Vista de Archivos */}
        {viewMode === 'files' && (
          <BoardFilesView boardId={board.id} />
        )}

        {/* 6. Vista de Progreso */}
        {viewMode === 'progress' && (
          <BoardProgressView
            board={board}
            allTasks={allTasks}
            canEdit={canManageBoard}
          />
        )}
      </div>
    </div>
  );
}

// Modal de diálogo para la creación de un nuevo tablero con opción de inicio en blanco.
function CreateBoardDialog({
  open,
  pending,
  name,
  description,
  branchId,
  blank,
  branches,
  onOpenChange,
  onNameChange,
  onDescriptionChange,
  onBranchChange,
  onBlankChange,
  onCreate,
}: CreateBoardDialogProps) {
  const isFormValid = name.trim().length > 0 && Boolean(branchId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear tablero</DialogTitle>
          <DialogDescription>El tablero quedará disponible para la sucursal seleccionada.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Nombre del tablero"
            autoFocus
          />
          <Textarea
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Descripción opcional"
          />
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={branchId}
            onChange={(event) => onBranchChange(event.target.value)}
          >
            <option value="">Selecciona una sucursal</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>

          {/* Opción de inicio en blanco tipo Asana */}
          <label className="flex items-center gap-2.5 cursor-pointer text-sm text-muted-foreground select-none pt-1">
            <input
              type="checkbox"
              checked={blank}
              onChange={(e) => onBlankChange(e.target.checked)}
              className="size-4 rounded border-input text-primary focus:ring-primary"
            />
            <span>Iniciar con tablero en blanco (sin columnas predeterminadas)</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={onCreate} disabled={!isFormValid || pending}>
            {pending && <Loader2 className="mr-2 size-4 animate-spin" />}Crear tablero
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Loading() {
  return (
    <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />Cargando Asana...
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
      <p className="font-medium">No se pudo cargar Asana.</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Reintentar
      </Button>
    </div>
  );
}

function EmptyState({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-12 text-center">
      <ClipboardPen className="mx-auto size-9 text-muted-foreground" />
      <h2 className="mt-4 font-semibold">Todavía no hay tableros</h2>
      <p className="mt-2 text-sm text-muted-foreground">Crea el primer tablero para organizar el trabajo.</p>
      {canCreate && (
        <Button className="mt-5" onClick={onCreate}>
          <Plus className="mr-2 size-4" />Crear tablero
        </Button>
      )}
    </div>
  );
}
