import React, { useState, useEffect } from 'react';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { Message } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { MultiSelect } from '../ui/MultiSelect';
import { Plus, Search, MessageSquare, Mail, UserCheck, Inbox, Globe, User, ShieldCheck, Reply, CornerDownRight } from 'lucide-react';
import { messagesService } from '../../services/notificaciones.service';
import { tenantsService } from '../../services/tenants.service';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { format } from 'date-fns';

interface MensajesViewProps {
  data: Message[];
  loading: boolean;
  onRefresh: () => void;
}

export const MensajesView: React.FC<MensajesViewProps> = ({ data, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const { user } = useAuth();

  // New Message form state
  const [newMessage, setNewMessage] = useState({
    title: '',
    content: '',
    scope: 'PERSONAL',
    targetRole: 'EMPLOYEE',
    userIds: [] as string[]
  });

  // Reply form state
  const [replyContent, setReplyContent] = useState('');

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

  const columns: ColumnDef<Message>[] = [
    { key: 'title', header: 'Asunto', width: '25%', render: (val, row) => (
      <div className="flex flex-col">
        <span className="font-bold">{val}</span>
        {row.parentId && <span className="text-[9px] text-muted-foreground flex items-center gap-1 italic"><Reply className="size-2" /> Respuesta</span>}
      </div>
    )},
    { key: 'content', header: 'Mensaje', width: '35%' },
    { key: 'replies', header: 'Hilo', width: '80px', render: (val: any) => val?.length > 0 ? <Badge variant="secondary" className="text-[9px] font-black">{val.length} Rsp.</Badge> : null },
    { key: 'isRead', header: 'Estado', width: '100px', render: (val: any) => <Badge variant="outline" className={cn('text-[9px] uppercase border-none', val ? 'bg-muted/20 text-muted-foreground' : 'bg-primary/10 text-primary')}>{val ? 'Leído' : 'Nuevo'}</Badge> },
    { key: 'createdAt', header: 'Enviado', width: '130px', type: 'date', render: (val: any) => val ? format(new Date(val), 'MMM dd, HH:mm') : '-' },
    {
      key: 'actions', header: 'Acciones', width: '140px', render: (_val: any, row: any) => {
        return (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 hover:bg-primary/10 hover:text-primary" title="Responder" onClick={() => { setSelectedMessage(row); setIsReplyOpen(true); }}>
              <Reply className="size-3.5" />
            </Button>
            {(row.title === 'Nueva tarea asignada' || (row.content && String(row.content).startsWith('TAREA:'))) && (
              <Button size="sm" variant="outline" className="h-7 text-[9px] font-black uppercase px-2" onClick={() => window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module: 'actividades', subModule: 'tareas' }}))}>
                Tarea
              </Button>
            )}
          </div>
        );
      }
    }
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Message>) => {
    try { await messagesService.update(id as string, updates); toast.success('Mensaje actualizado'); onRefresh(); }
    catch { toast.error('Error al actualizar'); }
  };

  const handleCreate = async () => {
    if (!newMessage.title || !newMessage.content) {
      toast.error('Título y mensaje son requeridos');
      return;
    }
    try {
      await messagesService.create(newMessage);
      toast.success('Mensaje enviado correctamente');
      setIsAddOpen(false);
      setNewMessage({ title: '', content: '', scope: 'PERSONAL', targetRole: 'EMPLOYEE', userIds: [] });
      onRefresh();
    } catch {
      toast.error('Error al enviar el mensaje');
    }
  };

  const handleReply = async () => {
    if (!replyContent || !selectedMessage) return;
    try {
      await messagesService.create({
        title: `Re: ${selectedMessage.title}`,
        content: replyContent,
        parentId: selectedMessage.id,
        scope: 'PERSONAL',
        userIds: [selectedMessage.userId].filter(Boolean) as string[]
      });
      toast.success('Respuesta enviada');
      setIsReplyOpen(false);
      setReplyContent('');
      setSelectedMessage(null);
      onRefresh();
    } catch {
      toast.error('Error al responder');
    }
  };

  const kpis = [
    { title: 'Bandeja Entrada', value: data.length,                                         icon: Inbox,         color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'No Leídos',       value: data.filter(m => !m.isRead).length,                    icon: Mail,          color: 'text-amber-500',  bg: 'bg-amber-500/10'   },
    { title: 'Enviados Hoy',    value: data.filter(m => { const d=new Date(m.createdAt||Date.now()); return d.toDateString()===new Date().toDateString()}).length, icon: MessageSquare, color: 'text-primary', bg: 'bg-primary/10' },
    { title: 'Conversaciones',  value: data.filter(m => !m.parentId).length,                 icon: UserCheck,     color: 'text-purple-500',  bg: 'bg-purple-500/10'  },
  ];

  const filtered = data.filter(m => m.title?.toLowerCase().includes(searchTerm.toLowerCase()) || m.content?.toLowerCase().includes(searchTerm.toLowerCase()));

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
          <div><h2 className="text-xl font-black uppercase tracking-tight">Mensajería Interna</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Hilo de comunicación del equipo</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={() => setIsAddOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20"><Plus className="size-4" /> Nuevo Mensaje</Button>
          </div>
        </div>
        <EditableDataTable 
          data={filtered} 
          columns={columns} 
          onRowUpdate={handleUpdate} 
          isLoading={loading} 
          allowAddRow={false}
          onRowDelete={async (id) => { try { await messagesService.delete(id as string); toast.success('Eliminado'); onRefresh(); } catch { toast.error('Error'); } }} 
        />
      </Card>

      {/* New Message Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2">
              <MessageSquare className="size-5 text-primary" />
              Enviar Nuevo Mensaje
            </DialogTitle>
            <DialogDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 italic">Define el asunto y los destinatarios</DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-5 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-[10px] font-black uppercase tracking-widest opacity-70">Asunto</Label>
              <Input className="col-span-3 rounded-xl bg-muted/20 border-none font-bold" placeholder="Ej: Reunión de Planificación" value={newMessage.title} onChange={e => setNewMessage({...newMessage, title: e.target.value})} />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right text-[10px] font-black uppercase tracking-widest opacity-70">Mensaje</Label>
              <Input className="col-span-3 rounded-xl bg-muted/20 border-none font-bold" placeholder="Escribe tu mensaje aquí..." value={newMessage.content} onChange={e => setNewMessage({...newMessage, content: e.target.value})} />
            </div>

            <div className="border-t border-border/40 pt-5 mt-2">
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right text-[10px] font-black uppercase tracking-widest opacity-70 mt-3">Destino</Label>
                <div className="col-span-3 space-y-4">
                  <Select value={newMessage.scope} onValueChange={val => setNewMessage({...newMessage, scope: val})}>
                    <SelectTrigger className="rounded-xl bg-primary/5 border-primary/20 font-black uppercase text-[10px] tracking-widest"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="GLOBAL" className="text-[10px] font-black uppercase"><div className="flex items-center gap-2"><Globe className="size-3" /> Todos (Anuncio Global)</div></SelectItem>
                      <SelectItem value="ROLE" className="text-[10px] font-black uppercase"><div className="flex items-center gap-2"><ShieldCheck className="size-3" /> Por Rol Específico</div></SelectItem>
                      <SelectItem value="PERSONAL" className="text-[10px] font-black uppercase"><div className="flex items-center gap-2"><User className="size-3" /> Usuarios Específicos</div></SelectItem>
                    </SelectContent>
                  </Select>

                  {newMessage.scope === 'ROLE' && (
                    <Select value={newMessage.targetRole} onValueChange={val => setNewMessage({...newMessage, targetRole: val})}>
                      <SelectTrigger className="rounded-xl bg-muted/20 border-none font-bold text-xs"><SelectValue placeholder="Seleccionar Rol..." /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="ADMIN">ADMINISTRADORES</SelectItem>
                        <SelectItem value="MANAGER">GERENTES</SelectItem>
                        <SelectItem value="EMPLOYEE">EMPLEADOS</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {newMessage.scope === 'PERSONAL' && (
                    <MultiSelect
                      options={employees.map(emp => ({ label: emp.name, value: emp.id, description: emp.email }))}
                      selected={newMessage.userIds}
                      onChange={values => setNewMessage({ ...newMessage, userIds: values })}
                      placeholder="Seleccionar destinatarios..."
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl font-black uppercase text-[10px] tracking-widest">Cancelar</Button>
            <Button onClick={handleCreate} className="rounded-xl bg-primary shadow-xl shadow-primary/20 font-black uppercase text-[10px] tracking-widest px-8">Enviar Mensaje</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reply Dialog */}
      <Dialog open={isReplyOpen} onOpenChange={setIsReplyOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2">
              <Reply className="size-5 text-primary" /> Responder Mensaje
            </DialogTitle>
            <DialogDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 italic">Hilo de conversación con {selectedMessage?.from || 'el equipo'}</DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
               <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-1">Mensaje Original:</p>
               <p className="text-xs font-bold leading-relaxed">{selectedMessage?.content}</p>
            </div>

            {selectedMessage?.replies?.length > 0 && (
              <div className="space-y-3 pl-4 border-l-2 border-primary/20 max-h-[200px] overflow-y-auto custom-scrollbar">
                {selectedMessage.replies.map((rep: any) => (
                  <div key={rep.id} className="bg-background/50 p-3 rounded-lg border border-border/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black uppercase tracking-tighter text-primary">Respuesta</span>
                      <span className="text-[8px] text-muted-foreground">{format(new Date(rep.createdAt), 'HH:mm')}</span>
                    </div>
                    <p className="text-[11px] font-medium">{rep.content}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 pt-2">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-70 ml-1">Tu Respuesta</Label>
              <Input 
                className="rounded-xl bg-muted/20 border-none font-bold py-6" 
                placeholder="Escribe tu respuesta..." 
                value={replyContent}
                onChange={e => setReplyContent(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReplyOpen(false)} className="rounded-xl font-black uppercase text-[10px] tracking-widest">Cancelar</Button>
            <Button onClick={handleReply} className="rounded-xl bg-primary shadow-xl shadow-primary/20 font-black uppercase text-[10px] tracking-widest px-8">Responder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
