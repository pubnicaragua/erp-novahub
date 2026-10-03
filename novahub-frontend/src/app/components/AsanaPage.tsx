import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ClipboardPen, Loader2, Plus, RefreshCw, Sparkles } from 'lucide-react';
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

type Section = { id: string; name: string; color?: string | null; sortOrder: number };
type Board = { id: string; name: string; description?: string | null; branchId: string; sections?: Section[] };
type Task = { id: string; title: string; sectionId?: string | null; dueDate?: string | null };
type Branch = { id: string; name: string };
type BoardDetailResponse = Board & { tasks?: Task[] };
type BoardViewProps = { board: Board | null; sections: Section[]; tasks: Task[]; loading: boolean; failed: boolean; canCreateTask: boolean; quickTitles: Record<string, string>; creating: boolean; onBack: () => void; onRefresh: () => void; onTitleChange: (sectionId: string, title: string) => void; onCreateTask: (sectionId: string, title: string) => void };
type CreateBoardDialogProps = { open: boolean; pending: boolean; name: string; description: string; branchId: string; branches: Branch[]; onOpenChange: (open: boolean) => void; onNameChange: (value: string) => void; onDescriptionChange: (value: string) => void; onBranchChange: (value: string) => void; onCreate: () => void };

const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

const boardKey = ['asana', 'boards'];

export function AsanaPage() {
  const { canPerform } = useAuth();
  const { accessibleBranches, selectedBranchId, isLoading: branchesLoading } = useBranchScope();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [branchId, setBranchId] = useState('');
  const [quickTitles, setQuickTitles] = useState<Record<string, string>>({});

  const boardsQuery = useTenantQuery<Board[]>(boardKey, async () => asList(await api.get('/asana/boards')));
  const visibleBoards = useMemo(() => boardsQuery.data?.filter((board) => !selectedBranchId || board.branchId === selectedBranchId) ?? [], [boardsQuery.data, selectedBranchId]);
  const selectedBoard = useMemo(() => boardsQuery.data?.find((board) => board.id === selectedBoardId) ?? null, [boardsQuery.data, selectedBoardId]);
  const detailQuery = useTenantQuery<Board | null>(['asana', 'board', selectedBoardId], async () => selectedBoardId ? await api.get(`/asana/boards/${selectedBoardId}`) : null, { enabled: Boolean(selectedBoardId) });
  const tasksQuery = useTenantQuery<Task[]>(['asana', 'board', selectedBoardId, 'tasks'], async () => {
    if (!selectedBoardId) return [];
    const detail = await api.get<BoardDetailResponse>(`/asana/boards/${selectedBoardId}`);
    return asList(detail?.tasks);
  }, { enabled: Boolean(selectedBoardId) });

  const createBoard = useMutation({
    mutationFn: () => api.post('/asana/boards', { name: name.trim(), description: description.trim() || undefined, branchId }),
    onSuccess: (board: Board) => {
      invalidateTenantQueries(queryClient);
      setCreateOpen(false); setName(''); setDescription(''); setBranchId(''); setSelectedBoardId(board.id);
      toast.success('Tablero creado');
    },
    onError: (error: unknown) => toast.error(errorMessage(error, 'No se pudo crear el tablero')),
  });
  const createTask = useMutation({
    mutationFn: ({ sectionId, title }: { sectionId: string; title: string }) => api.post(`/asana/boards/${selectedBoardId}/tasks`, { title, sectionId }),
    onSuccess: (_, variables) => {
      invalidateTenantQueries(queryClient);
      setQuickTitles((current) => ({ ...current, [variables.sectionId]: '' }));
      toast.success('Tarea creada');
    },
    onError: (error: unknown) => toast.error(errorMessage(error, 'No se pudo crear la tarea')),
  });

  const detail = detailQuery.data || selectedBoard;
  const sections = detail?.sections ?? [];
  const canCreateBoard = canPerform('ASANA', 'create');
  const canCreateTask = canPerform('ASANA_TASKS', 'create');
  const openCreate = () => { setBranchId(selectedBranchId || accessibleBranches[0]?.id || ''); setCreateOpen(true); };

  if (selectedBoardId) return <BoardView board={detail} sections={sections} tasks={tasksQuery.data ?? []} loading={detailQuery.isLoading} failed={detailQuery.isError} canCreateTask={canCreateTask} quickTitles={quickTitles} creating={createTask.isPending} onBack={() => setSelectedBoardId(null)} onRefresh={() => void detailQuery.refetch()} onTitleChange={(sectionId, title) => setQuickTitles((current) => ({ ...current, [sectionId]: title }))} onCreateTask={(sectionId, title) => createTask.mutate({ sectionId, title })} />;

  return <div className="min-h-full bg-background p-4 sm:p-6 md:p-8"><div className="mx-auto max-w-[1500px]"><header className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-primary"><ClipboardPen className="size-5" /><span className="text-xs font-bold uppercase tracking-[0.18em]">Gestión de trabajo</span></div><h1 className="text-3xl font-bold tracking-tight">Asana</h1><p className="mt-2 text-sm text-muted-foreground">Organiza el trabajo de tu equipo en tableros y secciones.</p></div><div className="flex flex-wrap items-center gap-2"><BranchScopeFilter showLabel={false} />{canCreateBoard && <Button onClick={openCreate}><Plus className="mr-2 size-4" />Nuevo tablero</Button>}</div></header>{boardsQuery.isLoading || branchesLoading ? <Loading /> : boardsQuery.isError ? <ErrorState onRetry={() => void boardsQuery.refetch()} /> : !visibleBoards.length ? <EmptyState canCreate={canCreateBoard} onCreate={openCreate} /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visibleBoards.map((board) => <button key={board.id} type="button" onClick={() => setSelectedBoardId(board.id)} className="group rounded-2xl border border-border/70 bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold group-hover:text-primary">{board.name}</h2><p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{board.description || 'Sin descripción'}</p></div><Sparkles className="size-5 text-primary/70" /></div><p className="mt-5 text-xs text-muted-foreground">{board.sections?.length || 3} secciones</p></button>)}</div>}</div><CreateBoardDialog open={createOpen} pending={createBoard.isPending} name={name} description={description} branchId={branchId} branches={accessibleBranches} onOpenChange={setCreateOpen} onNameChange={setName} onDescriptionChange={setDescription} onBranchChange={setBranchId} onCreate={() => createBoard.mutate()} /></div>;
}

function BoardView({ board, sections, tasks, loading, failed, canCreateTask, quickTitles, creating, onBack, onRefresh, onTitleChange, onCreateTask }: BoardViewProps) {
  if (loading) return <div className="min-h-full bg-background p-8"><Loading /></div>;
  if (failed || !board) return <div className="min-h-full bg-background p-8"><ErrorState onRetry={onRefresh} /></div>;
  return <div className="min-h-full bg-background p-4 sm:p-6 md:p-8"><div className="mx-auto max-w-[1700px]"><header className="mb-6 flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><Button variant="outline" size="icon" aria-label="Volver a tableros" onClick={onBack}><ArrowLeft className="size-4" /></Button><div><h1 className="text-2xl font-bold tracking-tight">{board.name}</h1>{board.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{board.description}</p>}</div></div><Button variant="outline" size="sm" onClick={onRefresh}><RefreshCw className="mr-2 size-4" />Actualizar</Button></header><div className="grid min-w-0 gap-4 lg:grid-flow-col lg:auto-cols-[minmax(280px,1fr)] lg:overflow-x-auto lg:pb-4">{sections.map((section: Section) => { const sectionTasks = tasks.filter((task: Task) => task.sectionId === section.id); const title = quickTitles[section.id] || ''; return <section key={section.id} className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm"><div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-semibold">{section.name}</h2><span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{sectionTasks.length}</span></div><div className="space-y-2">{sectionTasks.map((task: Task) => <article key={task.id} className="rounded-xl border border-border/60 bg-background p-3"><p className="text-sm font-medium">{task.title}</p>{task.dueDate && <p className="mt-1 text-xs text-muted-foreground">Vence {new Date(task.dueDate).toLocaleDateString('es-NI')}</p>}</article>)}{!sectionTasks.length && <p className="rounded-xl border border-dashed border-border/70 p-3 text-sm text-muted-foreground">Sin tareas todavía.</p>}</div>{canCreateTask && <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); if (title.trim()) onCreateTask(section.id, title.trim()); }}><Input value={title} onChange={(event) => onTitleChange(section.id, event.target.value)} placeholder="Añadir tarea" disabled={creating} /><Button type="submit" size="icon" disabled={!title.trim() || creating} aria-label={`Añadir tarea a ${section.name}`}>{creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}</Button></form>}</section>; })}</div></div></div>;
}

function CreateBoardDialog({ open, pending, name, description, branchId, branches, onOpenChange, onNameChange, onDescriptionChange, onBranchChange, onCreate }: CreateBoardDialogProps) { return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Crear tablero</DialogTitle><DialogDescription>El tablero quedará disponible para la sucursal seleccionada.</DialogDescription></DialogHeader><div className="space-y-4"><Input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Nombre del tablero" autoFocus /><Textarea value={description} onChange={(event) => onDescriptionChange(event.target.value)} placeholder="Descripción opcional" /><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={branchId} onChange={(event) => onBranchChange(event.target.value)}><option value="">Selecciona una sucursal</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button><Button onClick={onCreate} disabled={!name.trim() || !branchId || pending}>{pending && <Loader2 className="mr-2 size-4 animate-spin" />}Crear tablero</Button></DialogFooter></DialogContent></Dialog>; }
function Loading() { return <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-5 animate-spin" />Cargando Asana...</div>; }
function ErrorState({ onRetry }: { onRetry: () => void }) { return <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center"><p className="font-medium">No se pudo cargar Asana.</p><Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>Reintentar</Button></div>; }
function EmptyState({ canCreate, onCreate }: { canCreate: boolean; onCreate: () => void }) { return <div className="rounded-2xl border border-dashed border-border p-12 text-center"><ClipboardPen className="mx-auto size-9 text-muted-foreground" /><h2 className="mt-4 font-semibold">Todavía no hay tableros</h2><p className="mt-2 text-sm text-muted-foreground">Crea el primer tablero para organizar el trabajo.</p>{canCreate && <Button className="mt-5" onClick={onCreate}><Plus className="mr-2 size-4" />Crear tablero</Button>}</div>; }
