import React, { useState, useEffect } from 'react';
import { Activity, Plus, Search, Clock, CheckCircle, Circle, AlertCircle, Calendar, Edit, Trash2, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './line-wrapping-fix'; // Just a joke, I will use regular Label
import { Label as UILabel } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { activitiesService } from '../services/activities.service';
import { usersService } from '../services/users.service';
import { toast } from 'sonner';
import type { Activity as ActivityType, TaskStatus, ActivityType as TypeOfActivity, User } from '../types';

const prioridadColors: Record<string, string> = {
  'High': 'bg-red-500/10 text-red-400 border-red-500/20',
  'Medium': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  'Low': 'bg-green-500/10 text-green-400 border-green-500/20',
};

const estadoIcons: Record<string, React.ReactNode> = {
  'PENDING': <Circle className="size-4 text-yellow-500" />,
  'IN_PROGRESS': <AlertCircle className="size-4 text-blue-500" />,
  'COMPLETED': <CheckCircle className="size-4 text-emerald-500" />,
  'CANCELLED': <X className="size-4 text-red-500" />,
};

const statusLabels: Record<string, string> = {
  'PENDING': 'Pendiente',
  'IN_PROGRESS': 'En Progreso',
  'COMPLETED': 'Completada',
  'CANCELLED': 'Cancelada',
};

const typeLabels: Record<string, string> = {
    'TASK': 'Tarea',
    'MEETING': 'Reunión',
    'CALL': 'Llamada',
    'EMAIL': 'Email',
    'OTHER': 'Otro',
    'DEADLINE': 'Fecha Límite'
};

export function ActividadesPage() {
  const [actividadesState, setActividadesState] = useState<ActivityType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAct, setEditingAct] = useState<ActivityType | null>(null);

  const [formData, setFormData] = useState<Partial<ActivityType>>({
    title: '',
    description: '',
    type: 'TASK' as any,
    assignedToId: '',
    dueDate: new Date().toISOString().split('T')[0],
    status: 'PENDING' as any
  });

  useEffect(() => {
    fetchActividades();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await usersService.getAll();
      setUsers(res.data || []);
    } catch (e) { console.error('Error fetching users', e); }
  };

  const fetchActividades = async () => {
    try {
      setLoading(true);
      const res = await activitiesService.getAll();
      setActividadesState(res.data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
      toast.error('Error al cargar actividades');
    } finally {
      setLoading(false);
    }
  };

  const filtered = actividadesState.filter(a => 
    a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (a.assignedTo?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenDialog = (act: ActivityType | null = null) => {
    if (act) {
      setEditingAct(act);
      setFormData({
        title: act.title,
        description: act.description || '',
        type: act.type,
        assignedToId: act.assignedToId,
        dueDate: act.dueDate ? new Date(act.dueDate).toISOString().split('T')[0] : '',
        status: act.status
      });
    } else {
      setEditingAct(null);
      setFormData({ 
        title: '', 
        description: '', 
        type: 'TASK' as any, 
        assignedToId: '', 
        dueDate: new Date().toISOString().split('T')[0], 
        status: 'PENDING' as any 
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.assignedToId) {
      toast.error('Nombre y responsable son requeridos');
      return;
    }
    try {
      if (editingAct) {
        await activitiesService.update(editingAct.id, formData);
        toast.success('Actividad actualizada');
      } else {
        await activitiesService.create(formData as any);
        toast.success('Actividad creada exitosamente');
      }
      fetchActividades();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving activity:', error);
      toast.error('Error al guardar la actividad');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Eliminar esta actividad?')) {
      try {
        await activitiesService.delete(id);
        toast.success('Actividad eliminada');
        fetchActividades();
      } catch (error) {
        console.error('Error deleting activity:', error);
        toast.error('Error al eliminar');
      }
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Activity className="size-6 text-primary" /> Actividades
          </h1>
          <p className="text-sm text-muted-foreground">Gestión de tareas, reuniones y seguimiento operativo del equipo.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="shadow-lg shadow-primary/20">
              <Plus className="mr-2 size-4" /> Nueva Actividad
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingAct ? 'Editar Actividad' : 'Nueva Actividad'}</DialogTitle>
              <DialogDescription>
                {editingAct ? 'Modifica los detalles de la actividad seleccionada.' : 'Define una nueva tarea o evento para el equipo.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <UILabel>Nombre de la actividad</UILabel>
                <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Ej. Presentación de resultados" />
              </div>
              <div className="grid gap-2">
                <UILabel>Descripción</UILabel>
                <textarea 
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.description} 
                  onChange={e => setFormData({ ...formData, description: e.target.value })} 
                  placeholder="Detalles adicionales..."
                />
              </div>
              <div className="grid gap-2">
                <UILabel>Responsable</UILabel>
                <Select value={formData.assignedToId} onValueChange={v => setFormData({ ...formData, assignedToId: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar usuario" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <UILabel>Tipo</UILabel>
                  <Select value={formData.type} onValueChange={(v: any) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TASK">Tarea</SelectItem>
                      <SelectItem value="MEETING">Reunión</SelectItem>
                      <SelectItem value="CALL">Llamada</SelectItem>
                      <SelectItem value="EMAIL">Email</SelectItem>
                      <SelectItem value="DEADLINE">Plazo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <UILabel>Fecha</UILabel>
                  <Input type="date" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <UILabel>Estado</UILabel>
                <Select value={formData.status} onValueChange={(v: any) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pendiente</SelectItem>
                    <SelectItem value="IN_PROGRESS">En Progreso</SelectItem>
                    <SelectItem value="COMPLETED">Completada</SelectItem>
                    <SelectItem value="CANCELLED">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Guardar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-transparent">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Pendientes</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-yellow-500">{actividadesState.filter(a => a.status.toUpperCase() === 'PENDING').length}</div></CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">En Progreso</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-blue-500">{actividadesState.filter(a => a.status.toUpperCase() === 'IN_PROGRESS').length}</div></CardContent>
        </Card>
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Completadas</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-emerald-500">{actividadesState.filter(a => a.status.toUpperCase() === 'COMPLETED').length}</div></CardContent>
        </Card>
        <Card className="border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Vencidas</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-500">{actividadesState.filter(a => a.dueDate && new Date(a.dueDate) < new Date() && a.status.toUpperCase() !== 'COMPLETED').length}</div></CardContent>
        </Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar actividades..." className="pl-9 bg-muted/30 border-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                <Activity className="size-12 text-muted-foreground/20 mx-auto" />
                <h3 className="mt-4 text-lg font-medium">No hay actividades</h3>
                <p className="text-sm text-muted-foreground">Las actividades aparecerán aquí.</p>
            </div>
        ) : (
            filtered.map(act => (
                <Card key={act.id} className="transition-all hover:shadow-md hover:shadow-primary/5 group border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="mt-1">{estadoIcons[act.status.toUpperCase()] || <Circle className="size-4" />}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-base font-semibold group-hover:text-primary transition-colors">{act.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{act.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                                <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                    {(act.assignedTo?.name || '?').charAt(0)}
                                </div>
                                <span className="text-xs text-muted-foreground font-medium">{act.assignedTo?.name || 'No asignado'}</span>
                            </div>
                          </div>
                          <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider ${act.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : ''}`}>
                              {statusLabels[act.status.toUpperCase()] || act.status}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                          <div className="flex items-center gap-4 text-muted-foreground">
                            <span className="flex items-center gap-1.5 text-xs font-medium">
                                <Calendar className="size-3.5" /> {act.dueDate ? new Date(act.dueDate).toLocaleDateString([], { day: '2-digit', month: 'long' }) : 'Sin fecha'}
                            </span>
                            <Badge variant="secondary" className="text-[10px] py-0 px-2 h-5 bg-primary/5 text-primary border-primary/10">
                                {typeLabels[act.type.toUpperCase()] || act.type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="size-8 rounded-full" onClick={() => handleOpenDialog(act)}><Edit className="size-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="size-8 rounded-full text-red-500 hover:text-red-500 hover:bg-red-500/10" onClick={() => handleDelete(act.id)}><Trash2 className="size-3.5" /></Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
            ))
        )}
      </div>
    </div>
  );
}
