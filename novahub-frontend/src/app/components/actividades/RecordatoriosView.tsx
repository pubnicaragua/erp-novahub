import React from 'react';
import { useState } from 'react';
import { EditableDataTable } from '../ui/EditableDataTable';
import { Reminder } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, Bell, BellRing, BellOff, Clock, Eye } from 'lucide-react';
import { remindersService } from '../../services/actividades.service';
import { usersService } from '../../services/users.service';
import { hrService } from '../../services/hr.service';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { InventoryViewTutorial } from '../inventory/InventoryViewTutorial';
import { Label } from '../ui/label';
import { asList, useTenantQuery } from '../../hooks/useTenantQuery';
import { ActivityDetailSheet } from './ActivityDetailSheet';

interface RecordatoriosViewProps {
  data: Reminder[];
  loading: boolean;
  onRefresh: () => void;
}

export const RecordatoriosView: React.FC<RecordatoriosViewProps> = ({ data, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);

  const { canPerform } = useAuth();
  const canViewHr = canPerform('HR', 'view');
  const usersQuery = useTenantQuery<any[]>(['activities', 'reminder-users'], signal => usersService.getAll(undefined, signal), {
    enabled: Boolean(isAddOpen || selectedReminder),
  });
  const departmentsQuery = useTenantQuery<any[]>(['activities', 'departments'], signal => hrService.getDepartments(signal), {
    enabled: isAddOpen && canViewHr,
  });
  const availableUsers = asList(usersQuery.data);
  const availableDepts = asList(departmentsQuery.data);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    reminderDate: '',
    scope: 'PERSONAL',
    selectedUsers: [] as string[],
    selectedDept: ''
  });

  const statusOpts = [
    { value: 'PENDING', label: 'Pendiente', color: 'bg-amber-500/10 text-amber-500' },
    { value: 'SENT', label: 'Enviado', color: 'bg-emerald-500/10 text-emerald-500' },
    { value: 'SNOOZED', label: 'Pospuesto', color: 'bg-blue-500/10 text-blue-500' },
    { value: 'CANCELLED', label: 'Cancelado', color: 'bg-rose-500/10 text-rose-500' },
  ];

  const columns = [
    { key: 'title', header: 'Recordatorio', width: '30%', editable: canPerform('ACTIVITIES_REMINDERS', 'edit') },
    { key: 'description', header: 'Mensaje', width: '35%', editable: canPerform('ACTIVITIES_REMINDERS', 'edit') },
    { key: 'reminderDate', header: 'Fecha Aviso', width: '150px', editable: canPerform('ACTIVITIES_REMINDERS', 'edit'), type: 'datetime-local' as const, render: (val: any) => val ? format(new Date(val), 'dd/MM/yyyy HH:mm') : '-' },
    {
      key: 'status', header: 'Estado', width: '120px', editable: canPerform('ACTIVITIES_REMINDERS', 'edit'), type: 'select' as const, options: statusOpts,
      render: (val: any) => { const o = statusOpts.find(x => x.value === (val || '').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color || 'bg-muted/20 text-muted-foreground')}>{o?.label || val}</Badge>; }
    },
    {
      key: 'scope', header: 'Alcance', width: '120px', editable: canPerform('ACTIVITIES_REMINDERS', 'edit'), type: 'select' as const, options: [
        { value: 'GLOBAL', label: 'Global' },
        { value: 'DEPARTMENT', label: 'Departamental' },
        { value: 'PERSONAL', label: 'Personal' }
      ],
      render: (val: any) => <span className="text-xs font-medium capitalize">{String(val || 'PERSONAL').toLowerCase()}</span>
    },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Reminder>) => {
    try { await remindersService.update(id as string, updates); toast.success('Recordatorio actualizado'); onRefresh(); }
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar recordatorio'); }
  };

  const handleAdd = async () => {
    try {
      if (!formData.title) {
        toast.error('El título es requerido');
        return;
      }
      
      let targetId = '';
      if (formData.scope === 'PERSONAL') {
        if (formData.selectedUsers.length === 0) { toast.error('Selecciona al menos un usuario'); return; }
        targetId = JSON.stringify(formData.selectedUsers);
      } else if (formData.scope === 'DEPARTMENT') {
        if (!formData.selectedDept) { toast.error('Selecciona un departamento'); return; }
        targetId = formData.selectedDept;
      } else {
        targetId = 'ALL'; // GLOBAL
      }

      await remindersService.create({ 
        title: formData.title, 
        description: formData.description,
        reminderDate: formData.reminderDate ? new Date(formData.reminderDate).toISOString() : new Date().toISOString(), 
        status: 'PENDING', 
        scope: formData.scope,
        targetId
      });
      toast.success('Recordatorio programado'); 
      setIsAddOpen(false);
      setFormData({ title: '', description: '', reminderDate: '', scope: 'PERSONAL', selectedUsers: [], selectedDept: '' });
      onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al crear recordatorio'); }
  };

  const kpis = [
    { title: 'Total Avisos', value: data.length, icon: Bell, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Pendientes', value: data.filter(r => (r.status || '').toUpperCase() === 'PENDING').length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { title: 'Enviados', value: data.filter(r => (r.status || '').toUpperCase() === 'SENT').length, icon: BellRing, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Cancelados', value: data.filter(r => (r.status || '').toUpperCase() === 'CANCELLED').length, icon: BellOff, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  ];

  const filtered = data.filter(r => r.title?.toLowerCase().includes(searchTerm.toLowerCase()) || r.description?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div className="p-4 border-b border-border/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0"><h2 className="break-words text-xl font-black uppercase tracking-tight">Recordatorios</h2></div>
          <div className="erp-list-toolbar flex min-w-0 flex-wrap items-center gap-3">
            <InventoryViewTutorial label="Qué son los Recordatorios" targetPrefix="recordatorios-tutorial" compact stepKeys={['title', 'data', 'actions']} copy={{ title: { title: 'Recordatorios', description: 'Los recordatorios envían alertas automáticas en la fecha y hora que indiques. Pueden ser globales (para todo el equipo), departamentales o personales.' }, data: { title: 'Crear recordatorio', description: 'Haz clic en "Nuevo Aviso". Define el título, mensaje, fecha de envío y alcance (global/departamento/personal).' }, actions: { title: 'Gestionar', description: 'Revisa el estado (Pendiente/Enviado/Cancelado), edita o elimina avisos que ya no necesites.' } }} />
            <div className="relative w-full sm:w-56"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="h-10 w-full rounded-xl border-border/50 bg-background/50 pl-9 text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            {canPerform('ACTIVITIES_REMINDERS', 'create') && (
              <Button data-toolbar-role="primary" variant="default" onClick={() => setIsAddOpen(true)} className="font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nuevo Aviso</Button>
            )}
          </div>
        </div>
        <EditableDataTable 
          data={filtered} 
          columns={columns} 
          onRowUpdate={canPerform('ACTIVITIES_REMINDERS', 'edit') ? handleUpdate : undefined} 
          onRowClick={(row) => setSelectedReminder(row)}
          isLoading={loading} 
          onRowDelete={canPerform('ACTIVITIES_REMINDERS', 'delete') ? async (id) => { try { await remindersService.delete(id as string); toast.success('Recordatorio eliminado'); onRefresh(); } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar recordatorio'); } } : undefined} 
          actions={(row: Reminder) => (
            <div className="flex min-w-max items-center justify-end gap-1" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
              <Button type="button" variant="ghost" size="icon" title="Ver detalle del recordatorio" aria-label="Ver detalle del recordatorio" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary" onClick={() => setSelectedReminder(row)}><Eye className="size-4" /></Button>
            </div>
          )}
        />
      </Card>

      <ActivityDetailSheet kind="reminder" item={selectedReminder} users={availableUsers} onOpenChange={(open) => { if (!open) setSelectedReminder(null); }} />

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto rounded-3xl border-border/60 bg-background/95 p-0 shadow-2xl sm:max-w-xl">
          <DialogHeader className="border-b border-border/50 bg-gradient-to-br from-amber-500/10 via-background to-background px-6 py-5 sm:px-8">
            <div className="flex items-start gap-3 pr-6"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600"><BellRing className="size-5" /></div><div><DialogTitle className="font-black tracking-tight sm:text-lg">Programar recordatorio</DialogTitle><p className="mt-1 text-xs text-muted-foreground">Define cuándo avisar y quién debe recibir la notificación.</p></div></div>
          </DialogHeader>
          <div className="grid gap-5 px-6 py-6 sm:px-8">
            <div className="space-y-2">
              <Label className="text-xs font-bold">Título o asunto</Label>
              <Input placeholder="Ej. Reunión de equipo" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="h-11 rounded-xl bg-background" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-bold">Fecha y hora</Label>
                <Input type="datetime-local" value={formData.reminderDate} onChange={e => setFormData({...formData, reminderDate: e.target.value})} className="h-11 rounded-xl bg-background" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold">Alcance</Label>
                <select className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={formData.scope} onChange={e => setFormData({...formData, scope: e.target.value, selectedUsers: [], selectedDept: ''})}>
                  <option value="PERSONAL">Personal</option>
                  <option value="DEPARTMENT">Departamento</option>
                  <option value="GLOBAL">Global (Todos)</option>
                </select>
              </div>
            </div>

            {formData.scope === 'PERSONAL' && (
              <div className="space-y-2">
                <Label className="text-xs font-bold">Usuarios destinatarios</Label>
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-input bg-muted/[0.12] p-2">
                  {usersQuery.isLoading ? <p className="text-xs text-muted-foreground">Cargando usuarios disponibles...</p> : usersQuery.isError ? <p className="text-xs text-destructive">No se pudieron cargar los usuarios disponibles.</p> : availableUsers.length === 0 && <p className="text-xs text-muted-foreground">No hay usuarios disponibles</p>}
                  {availableUsers.map(u => (
                    <div key={u.id} className="flex items-center gap-2">
                      <input type="checkbox" id={`usr-${u.id}`} checked={formData.selectedUsers.includes(u.id)} onChange={() => {
                        const newU = formData.selectedUsers.includes(u.id) ? formData.selectedUsers.filter(x => x !== u.id) : [...formData.selectedUsers, u.id];
                        setFormData({...formData, selectedUsers: newU});
                      }} className="rounded border-input" />
                      <label htmlFor={`usr-${u.id}`} className="text-sm font-medium leading-none cursor-pointer">
                        {u.name} ({u.email})
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {formData.scope === 'DEPARTMENT' && (
              <div className="space-y-2">
                <Label className="text-xs font-bold">Seleccionar departamento</Label>
                <select className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={formData.selectedDept} onChange={e => setFormData({...formData, selectedDept: e.target.value})}>
                  <option value="" disabled>Seleccione departamento...</option>
                  {availableDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs font-bold">Detalles adicionales</Label>
              <Input placeholder="Descripción breve..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="h-11 rounded-xl bg-background" />
            </div>
          </div>
          <DialogFooter className="border-t border-border/50 bg-muted/[0.12] px-6 py-4 sm:px-8">
            <Button variant="outline" className="rounded-xl" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
            <Button variant="default" className="rounded-xl px-5" onClick={handleAdd}>Guardar recordatorio</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
