import React, { useState } from 'react';
import { EditableDataTable } from '../ui/EditableDataTable';
import { Reminder } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, Bell, BellRing, BellOff, Clock } from 'lucide-react';
import { remindersService } from '../../services/actividades.service';
import { tenantsService } from '../../services/tenants.service';
import { hrService } from '../../services/hr.service';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

interface RecordatoriosViewProps {
  data: Reminder[];
  loading: boolean;
  onRefresh: () => void;
}

export const RecordatoriosView: React.FC<RecordatoriosViewProps> = ({ data, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [availableDepts, setAvailableDepts] = useState<any[]>([]);

  const { user } = useAuth();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    reminderDate: '',
    scope: 'PERSONAL',
    selectedUsers: [] as string[],
    selectedDept: ''
  });

  React.useEffect(() => {
    if (isAddOpen && user?.tenantId) {
      tenantsService.getUsers(user.tenantId)
        .then(res => setAvailableUsers(Array.isArray(res) ? res : ((res as any).data || [])))
        .catch(() => {});
      hrService.getDepartments()
        .then(res => setAvailableDepts(Array.isArray(res) ? res : ((res as any).data || [])))
        .catch(() => {});
    }
  }, [isAddOpen, user]);

  const statusOpts = [
    { value: 'PENDING', label: 'Pendiente', color: 'bg-amber-500/10 text-amber-500' },
    { value: 'SENT', label: 'Enviado', color: 'bg-emerald-500/10 text-emerald-500' },
    { value: 'SNOOZED', label: 'Pospuesto', color: 'bg-blue-500/10 text-blue-500' },
    { value: 'CANCELLED', label: 'Cancelado', color: 'bg-rose-500/10 text-rose-500' },
  ];

  const columns = [
    { key: 'title', header: 'Recordatorio', width: '30%', editable: true },
    { key: 'description', header: 'Mensaje', width: '35%', editable: true },
    { key: 'reminderDate', header: 'Fecha Aviso', width: '150px', editable: true, type: 'datetime-local' as const, render: (val: any) => val ? format(new Date(val), 'dd/MM/yyyy HH:mm') : '-' },
    {
      key: 'status', header: 'Estado', width: '120px', editable: true, type: 'select' as const, options: statusOpts,
      render: (val: any) => { const o = statusOpts.find(x => x.value === (val || '').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color || 'bg-muted/20 text-muted-foreground')}>{o?.label || val}</Badge>; }
    },
    {
      key: 'scope', header: 'Alcance', width: '120px', editable: true, type: 'select' as const, options: [
        { value: 'GLOBAL', label: 'Global' },
        { value: 'DEPARTMENT', label: 'Departamental' },
        { value: 'PERSONAL', label: 'Personal' }
      ],
      render: (val: any) => <span className="text-xs font-medium capitalize">{String(val || 'PERSONAL').toLowerCase()}</span>
    },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Reminder>) => {
    try { await remindersService.update(id as string, updates); toast.success('Recordatorio actualizado'); onRefresh(); }
    catch { toast.error('Error al actualizar recordatorio'); }
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
    } catch { toast.error('Error al crear recordatorio'); }
  };

  const kpis = [
    { title: 'Total Avisos', value: data.length, icon: Bell, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Pendientes', value: data.filter(r => (r.status || '').toUpperCase() === 'PENDING').length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { title: 'Enviados', value: data.filter(r => (r.status || '').toUpperCase() === 'SENT').length, icon: BellRing, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Cancelados', value: data.filter(r => (r.status || '').toUpperCase() === 'CANCELLED').length, icon: BellOff, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  ];

  const filtered = data.filter(r => r.title?.toLowerCase().includes(searchTerm.toLowerCase()) || r.description?.toLowerCase().includes(searchTerm.toLowerCase()));

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
            <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight">Recordatorios</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Alertas programadas</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-full sm:w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button variant="default" onClick={() => setIsAddOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20"><Plus className="size-4" /> Nuevo Aviso</Button>
          </div>
        </div>
        <div className="p-0 sm:p-2">
          <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} allowAddRow={false} onRowDelete={async (id) => { try { await remindersService.delete(id as string); toast.success('Recordatorio eliminado'); onRefresh(); } catch { toast.error('Error al eliminar'); } }} />
        </div>
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">Programar Recordatorio</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Título / Asunto</Label>
              <Input placeholder="Ej. Reunión de Equipo..." value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha y Hora</Label>
                <Input type="datetime-local" value={formData.reminderDate} onChange={e => setFormData({...formData, reminderDate: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Alcance (Scope)</Label>
                <Select value={formData.scope} onValueChange={val => setFormData({...formData, scope: val, selectedUsers: [], selectedDept: ''})}>
                  <SelectTrigger className="h-10 rounded-xl bg-background/50 border-border/50 font-bold focus:ring-primary/20 shadow-sm">
                    <SelectValue placeholder="Alcance" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/50 shadow-2xl">
                    <SelectItem value="PERSONAL" className="font-bold">Personal</SelectItem>
                    <SelectItem value="DEPARTMENT" className="font-bold">Departamento</SelectItem>
                    <SelectItem value="GLOBAL" className="font-bold">Global (Todos)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.scope === 'PERSONAL' && (
              <div className="space-y-2">
                <Label>Usuarios Destinatarios</Label>
                <div className="border border-input rounded-md p-3 max-h-40 overflow-y-auto bg-background space-y-2">
                  {availableUsers.length === 0 && <p className="text-xs text-muted-foreground">No hay usuarios disponibles</p>}
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
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Seleccionar Departamento</Label>
                <Select value={formData.selectedDept} onValueChange={val => setFormData({...formData, selectedDept: val})}>
                  <SelectTrigger className="h-11 rounded-xl bg-background/50 border-border/50 font-bold focus:ring-primary/20 shadow-sm">
                    <SelectValue placeholder="Seleccione departamento..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/50 shadow-2xl">
                    {availableDepts.map(d => (
                      <SelectItem key={d.id} value={d.id} className="font-bold">{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Detalles Especiales</Label>
              <Input placeholder="Descripción breve..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancelar</Button>
            <Button variant="default" onClick={handleAdd}>Guardar Recordatorio</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

