import React, { useState, useEffect } from 'react';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { PushNotification } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { MultiSelect } from '../ui/MultiSelect';
import { Plus, Search, Send, Smartphone, Wifi, CheckCircle2, Globe, User, ShieldCheck, Tag } from 'lucide-react';
import { pushNotificationsService } from '../../services/notificaciones.service';
import { tenantsService } from '../../services/tenants.service';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { format } from 'date-fns';

interface PushViewProps {
  data: PushNotification[];
  loading: boolean;
  onRefresh: () => void;
}

export const PushView: React.FC<PushViewProps> = ({ data, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCatOpen, setIsCatOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const { user } = useAuth();

  // New Push form state
  const [newPush, setNewPush] = useState({
    title: '',
    content: '',
    type: '', // Ahora dinámico
    scope: 'PERSONAL',
    targetRole: 'EMPLOYEE',
    userIds: [] as string[]
  });

  const fetchCategories = async () => {
    try {
      const cats = await pushNotificationsService.getCategories();
      setCategories(cats);
      if (cats.length > 0 && !newPush.type) {
        setNewPush(prev => ({ ...prev, type: cats[0].name }));
      }
    } catch (e) {
      console.error('Error loading categories', e);
    }
  };

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
    fetchCategories();
  }, [user]);

  const columns: ColumnDef<PushNotification>[] = [
    { key: 'title', header: 'Título', width: '25%', editable: true },
    { key: 'content', header: 'Contenido', width: '35%', editable: true },
    { key: 'type', header: 'Categoría', width: '120px', render: (val: any) => <Badge variant="secondary" className="text-[9px] uppercase font-black">{val || 'SISTEMA'}</Badge> },
    { key: 'sent', header: 'Estado', width: '100px', render: (val: any) => <Badge variant="outline" className={cn('text-[9px] uppercase border-none', val ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-500')}>{val ? 'Enviada' : 'Pendiente'}</Badge> },
    { key: 'createdAt', header: 'Fecha', width: '130px', type: 'date', render: (val: any) => val ? format(new Date(val), 'MMM dd, HH:mm') : '-' },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<PushNotification>) => {
    try { await pushNotificationsService.update(id as string, updates); toast.success('Notificación actualizada'); onRefresh(); }
    catch { toast.error('Error al actualizar'); }
  };

  const handleCreate = async () => {
    if (!newPush.title || !newPush.content) {
      toast.error('Título y contenido son requeridos');
      return;
    }
    try {
      await pushNotificationsService.create(newPush);
      toast.success('Notificación Push enviada');
      setIsAddOpen(false);
      setNewPush({ title: '', content: '', type: categories[0]?.name || 'SISTEMA', scope: 'PERSONAL', targetRole: 'EMPLOYEE', userIds: [] });
      onRefresh();
    } catch {
      toast.error('Error al enviar la notificación');
    }
  };

  const handleCreateCategory = async () => {
    if (!newCatName) return;
    try {
      await pushNotificationsService.createCategory(newCatName);
      toast.success('Categoría creada');
      setNewCatName('');
      setIsCatOpen(false);
      fetchCategories();
    } catch {
      toast.error('Error al crear categoría');
    }
  };

  const kpis = [
    { title: 'Total Enviadas',  value: data.filter(p => p.sent).length,                                 icon: Send,          color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Pendientes',      value: data.filter(p => !p.sent).length,                                icon: Wifi,          color: 'text-amber-500',  bg: 'bg-amber-500/10'   },
    { title: 'Categorías',    value: categories.length,                                               icon: Tag,           color: 'text-purple-500',  bg: 'bg-purple-500/10'  },
    { title: 'Tasa Entrega',    value: data.length ? `${Math.round((data.filter(p=>p.sent).length/data.length)*100)}%` : '0%', icon: CheckCircle2, color: 'text-primary', bg: 'bg-primary/10' },
  ];

  const filtered = data.filter(p => p.title?.toLowerCase().includes(searchTerm.toLowerCase()) || p.content?.toLowerCase().includes(searchTerm.toLowerCase()));

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
          <div><h2 className="text-xl font-black uppercase tracking-tight">Push Notifications</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Comunicación móvil e inmediata</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={() => setIsAddOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20"><Plus className="size-4" /> Enviar Push</Button>
          </div>
        </div>
        <EditableDataTable 
          data={filtered} 
          columns={columns} 
          onRowUpdate={handleUpdate} 
          isLoading={loading} 
          allowAddRow={false}
          onRowDelete={async (id) => { try { await pushNotificationsService.delete(id as string); toast.success('Eliminada'); onRefresh(); } catch { toast.error('Error'); } }} 
        />
      </Card>

      {/* New Push Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2">
              <Send className="size-5 text-primary" />
              Lanzar Notificación Push
            </DialogTitle>
            <DialogDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 italic">Envío inmediato a dispositivos vinculados</DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-5 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-[10px] font-black uppercase tracking-widest opacity-70">Título</Label>
              <Input className="col-span-3 rounded-xl bg-muted/20 border-none font-bold" placeholder="Ej: Nueva Actualización Disponible" value={newPush.title} onChange={e => setNewPush({...newPush, title: e.target.value})} />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-[10px] font-black uppercase tracking-widest opacity-70">Contenido</Label>
              <Input className="col-span-3 rounded-xl bg-muted/20 border-none font-bold" placeholder="Mensaje push corto..." value={newPush.content} onChange={e => setNewPush({...newPush, content: e.target.value})} />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-[10px] font-black uppercase tracking-widest opacity-70">Categoría</Label>
              <div className="col-span-3 flex gap-2">
                <Select value={newPush.type} onValueChange={val => setNewPush({...newPush, type: val})}>
                  <SelectTrigger className="flex-1 rounded-xl bg-muted/20 border-none font-bold text-xs">
                    <SelectValue placeholder="Seleccionar Categoría..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {categories.length > 0 ? (
                      categories.map(cat => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)
                    ) : (
                      <SelectItem value="SISTEMA">SISTEMA (Default)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" onClick={() => setIsCatOpen(true)} title="Nueva Categoría"><Plus className="size-4" /></Button>
              </div>
            </div>

            <div className="border-t border-border/40 pt-5 mt-2">
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right text-[10px] font-black uppercase tracking-widest opacity-70 mt-3">Alcance</Label>
                <div className="col-span-3 space-y-4">
                  <Select value={newPush.scope} onValueChange={val => setNewPush({...newPush, scope: val})}>
                    <SelectTrigger className="rounded-xl bg-primary/5 border-primary/20 font-black uppercase text-[10px] tracking-widest"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="GLOBAL" className="text-[10px] font-black uppercase"><div className="flex items-center gap-2"><Globe className="size-3" /> Todos los Dispositivos</div></SelectItem>
                      <SelectItem value="ROLE" className="text-[10px] font-black uppercase"><div className="flex items-center gap-2"><ShieldCheck className="size-3" /> Por Rol Específico</div></SelectItem>
                      <SelectItem value="PERSONAL" className="text-[10px] font-black uppercase"><div className="flex items-center gap-2"><User className="size-3" /> Usuarios Específicos</div></SelectItem>
                    </SelectContent>
                  </Select>

                  {newPush.scope === 'ROLE' && (
                    <Select value={newPush.targetRole} onValueChange={val => setNewPush({...newPush, targetRole: val})}>
                      <SelectTrigger className="rounded-xl bg-muted/20 border-none font-bold text-xs"><SelectValue placeholder="Seleccionar Rol..." /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="ADMIN">ADMINISTRADORES</SelectItem>
                        <SelectItem value="MANAGER">GERENTES</SelectItem>
                        <SelectItem value="EMPLOYEE">EMPLEADOS</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {newPush.scope === 'PERSONAL' && (
                    <MultiSelect
                      options={employees.map(emp => ({ label: emp.name, value: emp.id, description: emp.email }))}
                      selected={newPush.userIds}
                      onChange={values => setNewPush({ ...newPush, userIds: values })}
                      placeholder="Seleccionar destinatarios..."
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl font-black uppercase text-[10px] tracking-widest">Cancelar</Button>
            <Button onClick={handleCreate} className="rounded-xl bg-primary shadow-xl shadow-primary/20 font-black uppercase text-[10px] tracking-widest px-8">Enviar Push</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Category Dialog */}
      <Dialog open={isCatOpen} onOpenChange={setIsCatOpen}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">Nueva Categoría</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
             <Label className="text-[10px] font-black uppercase tracking-widest opacity-70 ml-1">Nombre de la Categoría</Label>
             <Input 
               className="rounded-xl bg-muted/20 border-none font-bold" 
               placeholder="Ej: Mantenimiento, Ventas..." 
               value={newCatName}
               onChange={e => setNewCatName(e.target.value.toUpperCase())}
             />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCatOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateCategory} className="bg-primary shadow-lg shadow-primary/20">Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
