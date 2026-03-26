import React, { useState } from 'react';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { Message } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, MessageSquare, Mail, UserCheck, Inbox } from 'lucide-react';
import { messagesService } from '../../services/notificaciones.service';
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

  const columns: ColumnDef<Message>[] = [
    { key: 'from', header: 'De', width: '20%', editable: true },
    { key: 'to', header: 'Para', width: '20%', editable: true },
    { key: 'title', header: 'Asunto', width: '30%', editable: true },
    { key: 'isRead', header: 'Estado', width: '100px', render: (val: any) => <Badge variant="outline" className={cn('text-[9px] uppercase border-none', val ? 'bg-muted/20 text-muted-foreground' : 'bg-blue-500/10 text-blue-500')}>{val ? 'Leído' : 'Nuevo'}</Badge> },
    { key: 'createdAt', header: 'Enviado', width: '150px', type: 'date', render: (val: any) => val ? format(new Date(val), 'MMM dd, HH:mm') : '-' },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Message>) => {
    try { await messagesService.update(id as string, updates); toast.success('Mensaje actualizado'); onRefresh(); }
    catch { toast.error('Error al actualizar'); }
  };

  const handleAdd = async () => {
    try {
      await messagesService.create({ title: 'Nuevo Mensaje', content: '', from: 'Sistema', to: 'Todos', isRead: false });
      toast.success('Mensaje enviado'); onRefresh();
    } catch { toast.error('Error al enviar'); }
  };

  const kpis = [
    { title: 'Bandeja Entrada', value: data.length,                                         icon: Inbox,         color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'No Leídos',       value: data.filter(m => !m.isRead).length,                    icon: Mail,          color: 'text-amber-500',  bg: 'bg-amber-500/10'   },
    { title: 'Enviados Hoy',    value: data.filter(m => { const d=new Date(m.createdAt||Date.now()); return d.toDateString()===new Date().toDateString()}).length, icon: MessageSquare, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Remitentes',      value: new Set(data.filter(m => m.from).map(m => m.from)).size,                 icon: UserCheck,     color: 'text-purple-500',  bg: 'bg-purple-500/10'  },
  ];

  const filtered = data.filter(m => m.title?.toLowerCase().includes(searchTerm.toLowerCase()) || m.from?.toLowerCase().includes(searchTerm.toLowerCase()) || m.to?.toLowerCase().includes(searchTerm.toLowerCase()));

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
          <div><h2 className="text-xl font-black uppercase tracking-tight">Mensajes</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Comunicación interna</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nuevo Mensaje</Button>
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} onRowDelete={async (id) => { try { await messagesService.delete(id as string); toast.success('Eliminado'); onRefresh(); } catch { toast.error('Error'); } }} />
      </Card>
    </div>
  );
};
