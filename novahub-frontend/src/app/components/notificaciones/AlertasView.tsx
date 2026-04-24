import React, { useState, useEffect } from 'react';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { Alert } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { MultiSelect } from '../ui/MultiSelect';
import { Plus, Search, AlertTriangle, Info, AlertCircle, Eye, Globe, Users, User, ShieldCheck } from 'lucide-react';
import { alertsService } from '../../services/notificaciones.service';
import { tenantsService } from '../../services/tenants.service';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { format } from 'date-fns';

interface AlertasViewProps {
  data: Alert[];
  loading: boolean;
  onRefresh: () => void;
}

export const AlertasView: React.FC<AlertasViewProps> = ({ data, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const { user } = useAuth();

  // New Alert form state
  const [newAlert, setNewAlert] = useState({
    title: '',
    content: '',
    severity: 'MEDIUM',
    scope: 'PERSONAL',
    targetRole: 'EMPLOYEE',
    userIds: [] as string[]
  });

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

  const severityOpts = [
    { value: 'LOW', label: 'Baja', color: 'text-blue-500' },
    { value: 'MEDIUM', label: 'Media', color: 'text-amber-500' },
    { value: 'HIGH', label: 'Alta', color: 'text-rose-500' },
    { value: 'CRITICAL', label: 'Crítica', color: 'text-purple-500' },
  ];

  const columns: ColumnDef<Alert>[] = [
    { key: 'title', header: 'Título', width: '30%', editable: true },
    { key: 'content', header: 'Mensaje', width: '40%', editable: true },
    { key: 'severity', header: 'Severidad', width: '120px', editable: true, type: 'select', options: severityOpts,
      render: (val: any) => { const o = severityOpts.find(x => x.value === (val||'').toUpperCase()); return <span className={cn('text-[10px] font-bold uppercase', o?.color||'text-muted-foreground')}>{o?.label||val}</span>; } },
    { key: 'isRead', header: 'Leída', width: '100px', render: (val: any) => <Badge variant="outline" className={cn('text-[9px] uppercase border-none', val ? 'bg-primary/10 text-primary' : 'bg-rose-500/10 text-rose-500')}>{val ? 'Sí' : 'No'}</Badge> },
    { key: 'createdAt', header: 'Fecha', width: '150px', type: 'date', render: (val: any) => val ? format(new Date(val), 'MMM dd, HH:mm') : '-' },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Alert>) => {
    try { await alertsService.update(id as string, updates); toast.success('Alerta actualizada'); onRefresh(); }
    catch { toast.error('Error al actualizar'); }
  };

  const handleCreate = async () => {
    if (!newAlert.title || !newAlert.content) {
      toast.error('Título y contenido son requeridos');
      return;
    }
    try {
      await alertsService.create(newAlert);
      toast.success('Alerta enviada correctamente');
      setIsAddOpen(false);
      setNewAlert({ title: '', content: '', severity: 'MEDIUM', scope: 'PERSONAL', targetRole: 'EMPLOYEE', userIds: [] });
      onRefresh();
    } catch {
      toast.error('Error al crear la alerta');
    }
  };

  const kpis = [
    { title: 'Total Alertas',   value: data.length,                                                              icon: AlertCircle,   color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Críticas',        value: data.filter(a => (a.severity||'').toUpperCase() === 'CRITICAL').length,    icon: AlertTriangle, color: 'text-rose-500',   bg: 'bg-rose-500/10'    },
    { title: 'No Leídas',       value: data.filter(a => !a.isRead).length,                                         icon: Info,          color: 'text-amber-500',  bg: 'bg-amber-500/10'   },
    { title: 'Leídas',          value: data.filter(a => a.isRead).length,                                          icon: Eye,           color: 'text-primary', bg: 'bg-primary/10' },
  ];

  const filtered = data.filter(a => a.title?.toLowerCase().includes(searchTerm.toLowerCase()) || a.content?.toLowerCase().includes(searchTerm.toLowerCase()));

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
          <div><h2 className="text-xl font-black uppercase tracking-tight">Alertas del Sistema</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Avisos y eventos críticos</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={() => setIsAddOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20"><Plus className="size-4" /> Crear Alerta</Button>
          </div>
        </div>
        <EditableDataTable 
          data={filtered} 
          columns={columns} 
          onRowUpdate={handleUpdate} 
          isLoading={loading} 
          allowAddRow={false}
          onRowDelete={async (id) => { try { await alertsService.delete(id as string); toast.success('Eliminada'); onRefresh(); } catch { toast.error('Error'); } }} 
        />
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2">
              <AlertTriangle className="size-5 text-primary" />
              Lanzar Nueva Alerta
            </DialogTitle>
            <DialogDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 italic">Configura el alcance y prioridad de la alerta</DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-5 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-[10px] font-black uppercase tracking-widest opacity-70">Título</Label>
              <Input 
                className="col-span-3 rounded-xl bg-muted/20 border-none font-bold" 
                placeholder="Ej: Stock Crítico de Alimento" 
                value={newAlert.title}
                onChange={e => setNewAlert({...newAlert, title: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-[10px] font-black uppercase tracking-widest opacity-70">Contenido</Label>
              <Input 
                className="col-span-3 rounded-xl bg-muted/20 border-none font-bold" 
                placeholder="Describe el evento..." 
                value={newAlert.content}
                onChange={e => setNewAlert({...newAlert, content: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-[10px] font-black uppercase tracking-widest opacity-70">Prioridad</Label>
              <div className="col-span-3 flex gap-2">
                {severityOpts.map(opt => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={newAlert.severity === opt.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setNewAlert({...newAlert, severity: opt.value})}
                    className={cn(
                      "flex-1 text-[9px] font-black uppercase rounded-lg border-border/40 transition-all",
                      newAlert.severity === opt.value ? "bg-primary text-primary-foreground shadow-lg" : "hover:bg-primary/5"
                    )}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="border-t border-border/40 pt-5 mt-2">
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right text-[10px] font-black uppercase tracking-widest opacity-70 mt-3">Alcance</Label>
                <div className="col-span-3 space-y-4">
                  <Select value={newAlert.scope} onValueChange={val => setNewAlert({...newAlert, scope: val})}>
                    <SelectTrigger className="rounded-xl bg-primary/5 border-primary/20 font-black uppercase text-[10px] tracking-widest">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="GLOBAL" className="text-[10px] font-black uppercase"><div className="flex items-center gap-2"><Globe className="size-3" /> Todos los Usuarios</div></SelectItem>
                      <SelectItem value="ROLE" className="text-[10px] font-black uppercase"><div className="flex items-center gap-2"><ShieldCheck className="size-3" /> Por Rol Específico</div></SelectItem>
                      <SelectItem value="PERSONAL" className="text-[10px] font-black uppercase"><div className="flex items-center gap-2"><User className="size-3" /> Usuarios Seleccionados</div></SelectItem>
                    </SelectContent>
                  </Select>

                  {newAlert.scope === 'ROLE' && (
                    <Select value={newAlert.targetRole} onValueChange={val => setNewAlert({...newAlert, targetRole: val})}>
                      <SelectTrigger className="rounded-xl bg-muted/20 border-none font-bold text-xs">
                        <SelectValue placeholder="Seleccionar Rol..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="ADMIN">ADMINISTRADORES</SelectItem>
                        <SelectItem value="MANAGER">GERENTES</SelectItem>
                        <SelectItem value="EMPLOYEE">EMPLEADOS</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {newAlert.scope === 'PERSONAL' && (
                    <MultiSelect
                      options={employees.map(emp => ({ label: emp.name, value: emp.id, description: emp.email }))}
                      selected={newAlert.userIds}
                      onChange={values => setNewAlert({ ...newAlert, userIds: values })}
                      placeholder="Seleccionar destinatarios..."
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl font-black uppercase text-[10px] tracking-widest">Cancelar</Button>
            <Button onClick={handleCreate} className="rounded-xl bg-primary shadow-xl shadow-primary/20 font-black uppercase text-[10px] tracking-widest px-8">Lanzar Alerta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
