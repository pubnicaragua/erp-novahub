import React, { useState, useEffect } from 'react';
import { EditableDataTable } from '../ui/EditableDataTable';
import { Task } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, CheckCircle2, Clock, AlertTriangle, ListTodo, ImageIcon } from 'lucide-react';
import { tasksService } from '../../services/actividades.service';
import { tenantsService } from '../../services/tenants.service';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface TareasViewProps {
  data: Task[];
  loading: boolean;
  onRefresh: () => void;
  /** Bitacora logs data for shared storage calculation */
  bitacoraData?: any[];
}

export const TareasView: React.FC<TareasViewProps> = ({ data, loading, onRefresh, bitacoraData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Add Task form state
  const [newTask, setNewTask] = useState({ title: '', description: '', dueDate: '', priority: 'MEDIUM', assignedTo: [] as string[] });

  // Complete Task form state - now file-based
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
  const { user } = useAuth();

  const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';
  
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

  /** Calculate combined storage from bitacora AND task evidences */
  const getUsedStorageBytes = (): number => {
    // Sum from bitacora logs
    const bitacoraSize = (bitacoraData || []).reduce((acc: number, log: any) => acc + (Number(log.fileSize) || 0), 0);
    // Sum from task evidences
    const taskEvidenceSize = data.reduce((acc: number, task: any) => {
      const evidences = task.evidences || [];
      return acc + evidences.reduce((eAcc: number, ev: any) => eAcc + (Number(ev.fileSize) || 0), 0);
    }, 0);
    return bitacoraSize + taskEvidenceSize;
  };

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      // Only images allowed
      if (!file.type.startsWith('image/')) {
        toast.error('Solo se permiten imágenes como evidencia (JPG, PNG, WEBP, etc.)');
        e.target.value = '';
        return;
      }
      setEvidenceFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onload = () => setEvidencePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setEvidenceFile(null);
      setEvidencePreview(null);
    }
  };

  const handleCompleteTask = async () => {
    if (!selectedTask) return;
    try {
      setIsUploading(true);
      let fileUrl = '';
      let fileName = '';
      let fileSize = 0;
      let fileType = '';

      if (evidenceFile) {
        // Check combined storage limit (1GB shared with bitacora)
        const usedBytes = getUsedStorageBytes();
        const newTotalBytes = usedBytes + evidenceFile.size;

        if (newTotalBytes > 1024 * 1024 * 1024) {
          toast.error('La imagen excede el límite de almacenamiento compartido de la empresa (1GB entre Bitácora y Tareas).');
          setIsUploading(false);
          return;
        }

        fileName = evidenceFile.name;
        fileSize = evidenceFile.size;
        fileType = evidenceFile.type;

        if (SUPABASE_URL && SUPABASE_ANON_KEY) {
          toast.info('Subiendo imagen de evidencia...');

          try {
            const fileExt = evidenceFile.name.split('.').pop();
            const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

            const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/tareas_actividades/${uniqueName}`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': evidenceFile.type || 'application/octet-stream'
              },
              body: evidenceFile
            });

            if (!uploadRes.ok) {
              const errData = await uploadRes.json().catch(() => ({}));
              console.error('Supabase upload error:', errData);
              throw new Error(errData?.message || errData?.error || 'HTTP ' + uploadRes.status);
            }

            fileUrl = `${SUPABASE_URL}/storage/v1/object/public/tareas_actividades/${uniqueName}`;
          } catch (e: any) {
            toast.error('Error al subir imagen a Supabase: ' + e.message);
            setIsUploading(false);
            return;
          }
        } else {
          toast.warning('Credenciales de Supabase ausentes. Link simulado.', { duration: 4000 });
          fileUrl = `https://mock-supabase.com/tareas_actividades/${evidenceFile.name}`;
        }
      }

      await tasksService.complete(selectedTask.id, {
        fileUrl: fileUrl || undefined,
        fileName: fileName || undefined,
        fileSize: fileSize || undefined,
        fileType: fileType || undefined,
      });

      toast.success('Tarea completada exitosamente' + (fileUrl ? ' con evidencia' : ''));
      setIsCompleteOpen(false);
      setEvidenceFile(null);
      setEvidencePreview(null);
      setSelectedTask(null);
      onRefresh();
    } catch {
      toast.error('Error al completar la tarea');
    } finally {
      setIsUploading(false);
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
              <ImageIcon className="size-3 mr-1" /> Ver Evidencia
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="border-none bg-background/50 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4">
              <div className={cn("p-2 sm:p-3 rounded-2xl flex items-center justify-center", kpi.bg)}><kpi.icon className={cn("size-5 sm:size-6", kpi.color)} /></div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 truncate">{kpi.title}</p>
                <p className="text-lg sm:text-2xl font-black tracking-tight truncate">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none bg-background/50 backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">Tareas</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Gestión de tareas pendientes</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-full sm:w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button variant="default" onClick={() => setIsAddOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20"><Plus className="size-4" /> Nueva Tarea</Button>
          </div>
        </div>
        <div className="p-0 sm:p-2">
          <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} allowAddRow={false} onRowDelete={async (id) => { try { await tasksService.delete(id as string); toast.success('Tarea eliminada'); onRefresh(); } catch { toast.error('Error al eliminar'); } }} />
        </div>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">Crear Nueva Tarea</DialogTitle>
            <DialogDescription className="sr-only">Formulario para crear una nueva tarea</DialogDescription>
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
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Prioridad</Label>
                <Select value={newTask.priority} onValueChange={val => setNewTask({...newTask, priority: val})}>
                  <SelectTrigger className="h-10 rounded-xl bg-background/50 border-border/50 font-bold focus:ring-primary/20 shadow-sm">
                    <SelectValue placeholder="Prioridad" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/50 shadow-2xl">
                    <SelectItem value="LOW" className="font-bold">Baja</SelectItem>
                    <SelectItem value="MEDIUM" className="font-bold">Media</SelectItem>
                    <SelectItem value="HIGH" className="font-bold">Alta</SelectItem>
                    <SelectItem value="URGENT" className="font-bold">Urgente</SelectItem>
                  </SelectContent>
                </Select>
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

      <Dialog open={isCompleteOpen} onOpenChange={(open) => {
        setIsCompleteOpen(open);
        if (!open) {
          setEvidenceFile(null);
          setEvidencePreview(null);
        }
      }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">Completar Tarea</DialogTitle>
            <DialogDescription className="sr-only">Subir evidencia para completar la tarea</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <p className="text-sm text-muted-foreground">Estás a punto de marcar la tarea <strong>{selectedTask?.title}</strong> como completada.</p>
            <div className="space-y-2 mt-2">
              <Label className="flex items-center gap-2">
                <ImageIcon className="size-4 text-primary" />
                Evidencia (Imagen)
              </Label>
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="text-muted-foreground file:text-primary file:font-bold"
              />
              <p className="text-[10px] text-muted-foreground">Solo imágenes (JPG, PNG, WEBP). Almacenamiento compartido con Bitácora (máx. 1GB por empresa).</p>
            </div>
            {evidencePreview && (
              <div className="mt-2 rounded-xl overflow-hidden border border-border/50 bg-muted/20">
                <img src={evidencePreview} alt="Vista previa" className="w-full max-h-48 object-contain" />
                <div className="px-3 py-2 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground truncate">{evidenceFile?.name}</span>
                  <Badge variant="outline" className="text-[9px]">
                    {((evidenceFile?.size || 0) / 1024).toFixed(1)} KB
                  </Badge>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCompleteOpen(false); setEvidenceFile(null); setEvidencePreview(null); }} disabled={isUploading}>Cancelar</Button>
            <Button onClick={handleCompleteTask} variant="default" disabled={isUploading}>
              {isUploading ? 'Subiendo...' : 'Confirmar Cierre'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
