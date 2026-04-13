import React, { useState, useEffect } from 'react';
import { EditableDataTable } from '../ui/EditableDataTable';
import { Task } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, CheckCircle2, Clock, AlertTriangle, ListTodo, Paperclip } from 'lucide-react';
import { tasksService } from '../../services/actividades.service';
import { tenantsService } from '../../services/tenants.service';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';

interface TareasViewProps {
  data: Task[];
  loading: boolean;
  onRefresh: () => void;
}

export const TareasView: React.FC<TareasViewProps> = ({ data, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  // Add Task form state
  const [newTask, setNewTask] = useState({ title: '', description: '', dueDate: '', priority: 'MEDIUM', assignedTo: [] as string[] });

  // Complete Task form state
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const { user } = useAuth();
  
  useEffect(() => {
    const fetchUsers = async () => {
      if (!user?.tenantId) return;
      try {
        const u = await tenantsService.getUsers(user.tenantId);
        setEmployees(Array.isArray(u) ? u : ((u as any).data || []));
      } catch (e) {
        console.error('Failed to load users', e);
      }
    };
    fetchUsers();
  }, [user]);

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
    catch { toast.error('Error al actualizar tarea'); }
  };

  const handleCreateTask = async () => {
    if (!newTask.title) {
      toast.error('El título es requerido');
      return;
    }
    try {
      await tasksService.create({
        title: newTask.title,
        description: newTask.description,
        dueDate: newTask.dueDate ? new Date(newTask.dueDate).toISOString() : new Date().toISOString(),
        priority: newTask.priority as any,
        assignedTo: newTask.assignedTo as any
      });
      toast.success('Tarea creada exitosamente');
      setIsAddOpen(false);
      setNewTask({ title: '', description: '', dueDate: '', priority: 'MEDIUM', assignedTo: [] });
      onRefresh();
    } catch {
      toast.error('Error al crear tarea');
    }
  };

  const handleCompleteTask = async () => {
    if (!selectedTask) return;
    try {
      await tasksService.complete(selectedTask.id, { fileUrl: evidenceUrl });
      toast.success('Tarea completada exitosamente con evidencia');
      setIsCompleteOpen(false);
      setEvidenceUrl('');
      setSelectedTask(null);
      onRefresh();
    } catch {
      toast.error('Error al completar la tarea');
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
    { key: 'title', header: 'Título', width: '25%', editable: true },
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
      key: 'priority', header: 'Prioridad', width: '100px', editable: true, type: 'select' as const, options: priorityOpts,
      render: (val: any) => { const o = priorityOpts.find(x => x.value === (val || '').toUpperCase()); return <span className={cn('text-[10px] font-bold uppercase', o?.color || 'text-muted-foreground')}>{o?.label || val}</span>; }
    },
    { key: 'dueDate', header: 'Vencimiento', width: '100px', editable: true, type: 'datetime-local' as const, render: (val: any) => val ? format(new Date(val), 'dd/MM/yyyy HH:mm') : '-' },
    {
      key: 'status', header: 'Estado', width: '120px', editable: true, type: 'select' as const, options: statusOpts,
      render: (val: any) => { const o = statusOpts.find(x => x.value === (val || '').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color || 'bg-muted/20 text-muted-foreground')}>{o?.label || val}</Badge>; }
    },
    {
      key: 'actions', header: 'Acciones', width: '100px', editable: false,
      render: (val: any, row: any) => {
        if (row.status !== 'COMPLETED') {
          return (
            <Button size="sm" variant="default" className="h-7 text-xs"
              onClick={() => { setSelectedTask(row); setIsCompleteOpen(true); }}
            >
              <CheckCircle2 className="size-3 mr-1" /> Marcar como Completada
            </Button>
          );
        } else {
          const evidence = row.evidences?.[0];
          return evidence ? (
            <a href={evidence.fileUrl} target="_blank" rel="noreferrer" className="flex items-center text-[10px] text-blue-500 hover:underline">
              <Paperclip className="size-3 mr-1" /> Evidencia
            </a>
          ) : <span className="text-[10px] text-muted-foreground">Sin evidencia</span>;
        }
      }
    }
  ];

  const kpis = [
    { title: 'Total Tareas', value: data.length, icon: ListTodo, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Pendientes', value: data.filter(t => (t.status || '').toUpperCase() === 'PENDING').length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { title: 'Urgentes', value: data.filter(t => (t.priority || '').toUpperCase() === 'URGENT').length, icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { title: 'Completadas', value: data.filter(t => (t.status || '').toUpperCase() === 'COMPLETED').length, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ];

  const filtered = data.filter(t => t.title?.toLowerCase().includes(searchTerm.toLowerCase()) || t.description?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="border-none bg-background/50 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("p-3 rounded-2xl flex items-center justify-center", kpi.bg)}><kpi.icon className={cn("size-6", kpi.color)} /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.title}</p><p className="text-2xl font-black tracking-tight">{kpi.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none bg-background/50 backdrop-blur-xl shadow-sm">
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight">Tareas</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Gestión de tareas pendientes</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button variant="default" onClick={() => setIsAddOpen(true)} className="font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nueva Tarea</Button>
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} onRowDelete={async (id) => { try { await tasksService.delete(id as string); toast.success('Tarea eliminada'); onRefresh(); } catch { toast.error('Error al eliminar'); } }} />
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">Crear Nueva Tarea</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Título de la Tarea</Label>
              <Input placeholder="Ej. Revisar inventario" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input placeholder="Detalles de la tarea..." value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha de Vencimiento</Label>
                <Input type="datetime-local" value={newTask.dueDate} onChange={e => setNewTask({...newTask, dueDate: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Prioridad</Label>
                <select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm" value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value})}>
                  <option value="LOW">Baja</option>
                  <option value="MEDIUM">Media</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Asignar a Usuarios (Opcional)</Label>
              <div className="border border-input rounded-md p-3 max-h-40 overflow-y-auto bg-background space-y-2">
                {employees.length === 0 && <p className="text-xs text-muted-foreground">No hay usuarios disponibles</p>}
                {employees.map(emp => (
                  <div key={emp.id} className="flex items-center gap-2">
                    <input type="checkbox" id={`emp-${emp.id}`} checked={newTask.assignedTo.includes(emp.id)} onChange={() => toggleAssignee(emp.id)} className="rounded border-input" />
                    <label htmlFor={`emp-${emp.id}`} className="text-sm font-medium leading-none cursor-pointer">
                      {emp.name} ({emp.email})
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Selecciona uno o varios usuarios.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateTask}>Crear Tarea</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCompleteOpen} onOpenChange={setIsCompleteOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">Completar Tarea</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-sm text-muted-foreground">Estás a punto de marcar la tarea <strong>{selectedTask?.title}</strong> como completada.</p>
            <div className="space-y-2 mt-2">
              <Label>Evidencia (URL de archivo / imagen)</Label>
              <Input 
                placeholder="https://ejemplo.com/imagen.jpg" 
                value={evidenceUrl} 
                onChange={e => setEvidenceUrl(e.target.value)} 
              />
              <p className="text-[10px] text-muted-foreground">Puedes adjuntar el link del archivo o imagen como comprobante del trabajo realizado.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCompleteOpen(false)}>Cancelar</Button>
            <Button onClick={handleCompleteTask} variant="default">Confirmar Cierre</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

