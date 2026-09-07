import { useEffect, useState } from 'react';
import { EditableDataTable } from '../ui/EditableDataTable';
import { Task } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, CheckCircle2, Clock, AlertTriangle, ListTodo, Paperclip, Eye, CalendarClock, Flag, UsersRound, AlignLeft } from 'lucide-react';
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
import { asList, useTenantQuery } from '../../hooks/useTenantQuery';
import { playNotificationSound } from '../../utils/notificationSound';
import { ActivityDetailSheet } from './ActivityDetailSheet';

interface TareasViewProps {
  data: Task[];
  loading: boolean;
  onRefresh: () => void;
}

const getTaskDisplayStatus = (task: any) => {
  const status = String(task?.status || 'PENDING').toUpperCase();
  const dueTime = task?.dueDate ? new Date(task.dueDate).getTime() : Number.NaN;
  return ['PENDING', 'IN_PROGRESS'].includes(status) && Number.isFinite(dueTime) && dueTime < Date.now()
    ? 'OVERDUE'
    : status;
};

export const TareasView: React.FC<TareasViewProps> = ({ data, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [detailTask, setDetailTask] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Add Task form state
  const [newTask, setNewTask] = useState({ title: '', description: '', dueDate: '', priority: 'MEDIUM', assignedTo: [] as string[] });

  // Complete Task form state
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [, setCurrentTime] = useState(() => Date.now());
  const { canPerform } = useAuth();
  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);
  const usersQuery = useTenantQuery<any[]>(['activities', 'task-users'], signal => usersService.getAll(undefined, signal), {
    enabled: isAddOpen,
  });
  const employees = asList(usersQuery.data);

  const statusOpts = [
    { value: 'PENDING', label: 'Pendiente', color: 'bg-amber-500/10 text-amber-500' },
    { value: 'IN_PROGRESS', label: 'En Progreso', color: 'bg-blue-500/10 text-blue-500' },
    { value: 'COMPLETED', label: 'Completada', color: 'bg-emerald-500/10 text-emerald-500' },
    { value: 'CANCELLED', label: 'Cancelada', color: 'bg-rose-500/10 text-rose-500' },
  ];

  const priorityOpts = [
    { value: 'LOW', label: 'Baja', color: 'text-slate-500' },
    { value: 'MEDIUM', label: 'Media', color: 'text-blue-500' },
    { value: 'HIGH', label: 'Alta', color: 'text-amber-500' },
    { value: 'URGENT', label: 'Urgente', color: 'text-rose-500' },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Task>) => {
    try { await tasksService.update(id as string, updates); toast.success('Tarea actualizada'); onRefresh(); }
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar tarea'); }
  };

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
        assignedTo: newTask.assignedTo as any
      });
      toast.success('Tarea creada exitosamente');
      playNotificationSound();
      setIsAddOpen(false);
      setNewTask({ title: '', description: '', dueDate: '', priority: 'MEDIUM', assignedTo: [] });
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
      let fileUrl = evidenceUrl.trim();
      if (evidenceFile) {
        const uploaded = await storageService.uploadFile('task-evidence', evidenceFile, { folder: selectedTask.id });
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
    }
  };

  const toggleAssignee = (empId: string) => {
    setNewTask(prev => {
      const isAssigned = prev.assignedTo.includes(empId);
      return {
        ...prev,
        assignedTo: isAssigned 
          ? prev.assignedTo.filter(id => id !== empId)
          : [...prev.assignedTo, empId]
      };
    });
  };

  const columns = [
    { key: 'title', header: 'Título', width: '25%', editable: canPerform('ACTIVITIES_TASKS', 'edit') },
    { 
      key: 'assignments', header: 'Asignados', width: '20%', editable: false,
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
      }
    },
    {
      key: 'priority', header: 'Prioridad', width: '100px', editable: canPerform('ACTIVITIES_TASKS', 'edit'), type: 'select' as const, options: priorityOpts,
      render: (val: any) => { const o = priorityOpts.find(x => x.value === (val || '').toUpperCase()); return <span className={cn('text-[10px] font-bold uppercase', o?.color || 'text-muted-foreground')}>{o?.label || val}</span>; }
    },
    { key: 'dueDate', header: 'Vencimiento', width: '100px', editable: canPerform('ACTIVITIES_TASKS', 'edit'), type: 'datetime-local' as const, render: (val: any) => val ? format(new Date(val), 'dd/MM/yyyy HH:mm') : '-' },
    { 
      // Completar una tarea es una transición de flujo: no debe poder
      // hacerse editando la celda y saltándose el permiso Aprobar.
      key: 'status', header: 'Estado', width: '120px', editable: false, type: 'select' as const, options: statusOpts,
      render: (val: any, row: any) => { const status = getTaskDisplayStatus({ ...row, status: val }); const o = statusOpts.find(x => x.value === status); const label = status === 'OVERDUE' ? 'Vencida' : o?.label || val; return <Badge variant="outline" className={cn('px-2 py-0.5 text-[9px] font-black uppercase', status === 'OVERDUE' ? 'border-rose-500/20 bg-rose-500/10 text-rose-600' : o?.color || 'border-none bg-muted/20 text-muted-foreground')}>{label}</Badge>; }
    },
  ];

  const kpis = [
    { title: 'Total Tareas', value: data.length, icon: ListTodo, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Pendientes', value: data.filter(t => getTaskDisplayStatus(t) === 'PENDING').length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { title: 'Vencidas', value: data.filter(t => getTaskDisplayStatus(t) === 'OVERDUE').length, icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { title: 'Urgentes', value: data.filter(t => (t.priority || '').toUpperCase() === 'URGENT').length, icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { title: 'Completadas', value: data.filter(t => (t.status || '').toUpperCase() === 'COMPLETED').length, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ];

  const filtered = data.filter(t => t.title?.toLowerCase().includes(searchTerm.toLowerCase()) || t.description?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi, i) => (
          <Card key={i} className="min-w-0 rounded-2xl border-border/50 bg-card/80 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("p-3 rounded-2xl flex items-center justify-center", kpi.bg)}><kpi.icon className={cn("size-6", kpi.color)} /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.title}</p><p className="text-2xl font-black tracking-tight">{kpi.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="min-w-0 overflow-hidden rounded-3xl border-border/50 bg-card/80 shadow-sm">
        <div className="flex min-w-0 flex-col gap-4 border-b border-border/50 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0"><h2 className="break-words text-xl font-black uppercase tracking-tight">Tareas</h2></div>
          <div className="erp-list-toolbar flex min-w-0 flex-wrap items-center gap-3">
            <InventoryViewTutorial label="Qué son las Tareas" targetPrefix="tareas-tutorial" compact stepKeys={['title', 'data', 'actions']} copy={{ title: { title: 'Tareas', description: 'Las tareas te permiten crear, asignar y dar seguimiento a actividades pendientes. Cada tarea puede tener prioridad, fecha de vencimiento y un responsable. Al completarla, queda registrada en la bitácora.' }, data: { title: 'Crear y asignar', description: 'Haz clic en "Nueva Tarea" para crear una. Asigna un responsable, prioridad y fecha de vencimiento.' }, actions: { title: 'Gestionar', description: 'Edita directamente en la tabla, cambia el estado a "Completada" cuando termines, o elimina tareas obsoletas.' } }} />
            <div className="relative w-full sm:w-56"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="h-10 w-full rounded-xl border-border/50 bg-background/50 pl-9 text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            {canPerform('ACTIVITIES_TASKS', 'create') && (
              <Button data-toolbar-role="primary" variant="default" onClick={() => setIsAddOpen(true)} className="shrink-0 rounded-xl px-4 h-10 gap-2 font-black uppercase text-[10px] tracking-widest"><Plus className="size-4" /> Nueva Tarea</Button>
            )}
          </div>
        </div>
        <EditableDataTable 
          data={filtered} 
          columns={columns} 
          onRowUpdate={canPerform('ACTIVITIES_TASKS', 'edit') ? handleUpdate : undefined} 
          onRowClick={(row) => setDetailTask(row)}
          isLoading={loading} 
          onRowDelete={canPerform('ACTIVITIES_TASKS', 'delete') ? async (id) => { try { await tasksService.delete(id as string); toast.success('Tarea eliminada'); onRefresh(); } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar tarea'); } } : undefined}
          actions={(row: any) => (
            <div className="flex min-w-max items-center justify-end gap-1" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
              <Button type="button" variant="ghost" size="icon" title="Ver detalle de la tarea" aria-label="Ver detalle de la tarea" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary" onClick={() => setDetailTask(row)}><Eye className="size-4" /></Button>
              {String(row.status || '').toUpperCase() !== 'COMPLETED' && canPerform('ACTIVITIES_TASKS', 'approve') && <Button type="button" variant="ghost" size="icon" title="Completar tarea" aria-label="Completar tarea" className="size-8 rounded-lg text-emerald-600 hover:bg-emerald-500/10" onClick={() => { setDetailTask(null); setSelectedTask(row); setIsCompleteOpen(true); }}><CheckCircle2 className="size-4" /></Button>}
              {String(row.status || '').toUpperCase() === 'COMPLETED' && row.evidences?.[0]?.fileUrl && <a href={row.evidences[0].fileUrl} target="_blank" rel="noreferrer" title="Abrir evidencia" aria-label="Abrir evidencia" className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"><Paperclip className="size-4" /></a>}
            </div>
          )}
          actionsWidth="w-40"
        />
      </Card>

      <ActivityDetailSheet kind="task" item={detailTask} onOpenChange={(open) => { if (!open) setDetailTask(null); }} />

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto rounded-3xl border-border/60 bg-background/95 p-0 shadow-2xl sm:max-w-2xl">
          <DialogHeader className="border-b border-border/50 bg-gradient-to-br from-primary/10 via-background to-background px-6 py-5 sm:px-8">
            <div className="flex items-start gap-3 pr-6"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ListTodo className="size-5" /></div><div><DialogTitle className="font-black tracking-tight sm:text-lg">Crear nueva tarea</DialogTitle><p className="mt-1 text-xs text-muted-foreground">Define el objetivo, la prioridad y quién dará seguimiento.</p></div></div>
          </DialogHeader>
          <div className="grid gap-5 px-6 py-6 sm:px-8">
            <div className="space-y-2">
              <Label className="flex items-center gap-1 text-xs font-bold text-foreground">Título de la tarea <span className="text-destructive">*</span></Label>
              <Input autoFocus placeholder="Ej. Revisar inventario" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} className="h-11 rounded-xl bg-background" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-bold text-foreground"><AlignLeft className="size-3.5 text-primary" />Descripción <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <Textarea placeholder="Agrega contexto, entregables o instrucciones..." value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} className="min-h-28 resize-y rounded-xl bg-background" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs font-bold text-foreground"><CalendarClock className="size-3.5 text-primary" />Vencimiento</Label>
                <Input type="datetime-local" value={newTask.dueDate} onChange={e => setNewTask({...newTask, dueDate: e.target.value})} className="h-11 rounded-xl bg-background" />
                <p className="text-[11px] text-muted-foreground">Si lo dejas vacío, se registra ahora.</p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs font-bold text-foreground"><Flag className="size-3.5 text-primary" />Prioridad</Label>
                <select className="flex h-11 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-sm" value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value})}>
                  <option value="LOW">Baja</option>
                  <option value="MEDIUM">Media</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-bold text-foreground"><UsersRound className="size-3.5 text-primary" />Asignar responsables <span className="font-normal text-muted-foreground">(opcional)</span></Label>
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-input bg-muted/[0.12] p-2">
                {usersQuery.isLoading ? <p className="text-xs text-muted-foreground">Cargando usuarios disponibles...</p> : usersQuery.isError ? <p className="text-xs text-destructive">No se pudieron cargar los usuarios disponibles.</p> : employees.length === 0 && <p className="text-xs text-muted-foreground">No hay usuarios disponibles</p>}
                {employees.map(emp => (
                  <label key={emp.id} htmlFor={`emp-${emp.id}`} className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-background", newTask.assignedTo.includes(emp.id) && "bg-primary/10") }>
                    <input type="checkbox" id={`emp-${emp.id}`} checked={newTask.assignedTo.includes(emp.id)} onChange={() => toggleAssignee(emp.id)} className="size-4 rounded border-input accent-primary" />
                    <span className="min-w-0"><span className="block truncate text-sm font-semibold">{emp.name}</span><span className="block truncate text-[11px] text-muted-foreground">{emp.email}</span></span>
                    {newTask.assignedTo.includes(emp.id) && <CheckCircle2 className="ml-auto size-4 shrink-0 text-primary" />}
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">Selecciona uno o varios usuarios para dar seguimiento.</p>
            </div>
          </div>
          <DialogFooter className="border-t border-border/50 bg-muted/[0.12] px-6 py-4 sm:px-8">
            <Button variant="outline" className="rounded-xl" onClick={() => setIsAddOpen(false)} disabled={isCreating}>Cancelar</Button>
            <Button onClick={handleCreateTask} disabled={isCreating || !newTask.title.trim()} className="rounded-xl px-5">{isCreating ? 'Creando…' : <><Plus className="mr-2 size-4" />Crear tarea</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCompleteOpen} onOpenChange={setIsCompleteOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-h-[85vh] overflow-y-auto rounded-3xl border-border/60 bg-background/95 p-0 shadow-2xl sm:max-w-[480px]">
          <DialogHeader className="border-b border-border/50 bg-gradient-to-br from-emerald-500/10 via-background to-background px-6 py-5 sm:px-8">
            <div className="flex items-start gap-3 pr-6"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="size-5" /></div><div><DialogTitle className="font-black tracking-tight sm:text-lg">Completar tarea</DialogTitle><p className="mt-1 text-xs text-muted-foreground">Agrega una evidencia para dejar constancia del cierre.</p></div></div>
          </DialogHeader>
          <div className="grid gap-5 px-6 py-6 sm:px-8">
            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4"><p className="text-sm leading-6 text-muted-foreground">Estás a punto de marcar la tarea <strong className="text-foreground">{selectedTask?.title}</strong> como completada.</p></div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">Archivo de evidencia</Label>
              <Input type="file" onChange={e => setEvidenceFile(e.target.files?.[0] || null)} className="h-11 rounded-xl bg-background file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:font-bold file:text-primary" />
              <Label className="text-xs font-semibold text-muted-foreground">O usa un enlace externo</Label>
              <Input 
                placeholder="https://ejemplo.com/imagen.jpg" 
                value={evidenceUrl} 
                onChange={e => setEvidenceUrl(e.target.value)} 
                className="h-11 rounded-xl bg-background"
              />
              <p className="text-[10px] text-muted-foreground">El archivo se guarda de forma privada y solo usuarios autorizados podrán abrirlo.</p>
            </div>
          </div>
          <DialogFooter className="border-t border-border/50 bg-muted/[0.12] px-6 py-4 sm:px-8">
            <Button variant="outline" className="rounded-xl" onClick={() => setIsCompleteOpen(false)}>Cancelar</Button>
            {canPerform('ACTIVITIES_TASKS', 'approve') && <Button onClick={handleCompleteTask} className="rounded-xl px-5">Confirmar cierre</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
