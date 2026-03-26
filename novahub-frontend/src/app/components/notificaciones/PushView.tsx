import React, { useState } from 'react';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { PushNotification } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, Send, Smartphone, Wifi, CheckCircle2 } from 'lucide-react';
import { pushNotificationsService } from '../../services/notificaciones.service';
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

  const columns: ColumnDef<PushNotification>[] = [
    { key: 'title', header: 'Título', width: '30%', editable: true },
    { key: 'content', header: 'Contenido', width: '40%', editable: true },
    { key: 'type', header: 'Tipo', width: '120px', editable: true, type: 'select', options: [{label: 'Marketing', value: 'MARKETING'}, {label: 'Sistema', value: 'SYSTEM'}, {label: 'Actualización', value: 'UPDATE'}] },
    { key: 'sent', header: 'Estado', width: '100px', render: (val: any) => <Badge variant="outline" className={cn('text-[9px] uppercase border-none', val ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500')}>{val ? 'Enviada' : 'Pendiente'}</Badge> },
    { key: 'createdAt', header: 'Fecha', width: '150px', type: 'date', render: (val: any) => val ? format(new Date(val), 'MMM dd, HH:mm') : '-' },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<PushNotification>) => {
    try { await pushNotificationsService.update(id as string, updates); toast.success('Notificación actualizada'); onRefresh(); }
    catch { toast.error('Error al actualizar'); }
  };

  const handleAdd = async () => {
    try {
      await pushNotificationsService.create({ title: 'Nueva Notificación Push', content: 'Contenido...', type: 'SYSTEM', sent: false });
      toast.success('Notificación creada'); onRefresh();
    } catch { toast.error('Error al crear'); }
  };

  const kpis = [
    { title: 'Total Enviadas',  value: data.filter(p => p.sent).length,                                 icon: Send,          color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Pendientes',      value: data.filter(p => !p.sent).length,                                icon: Wifi,          color: 'text-amber-500',  bg: 'bg-amber-500/10'   },
    { title: 'Dispositivos',    value: new Set(data.filter(p => p.deviceId).map(p => p.deviceId)).size || '-',  icon: Smartphone,    color: 'text-purple-500',  bg: 'bg-purple-500/10'  },
    { title: 'Tasa Entrega',    value: data.length ? `${Math.round((data.filter(p=>p.sent).length/data.length)*100)}%` : '0%', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
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
          <div><h2 className="text-xl font-black uppercase tracking-tight">Push Notifications</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Comunicación a dispositivos</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={handleAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Enviar Push</Button>
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} onRowDelete={async (id) => { try { await pushNotificationsService.delete(id as string); toast.success('Eliminada'); onRefresh(); } catch { toast.error('Error'); } }} />
      </Card>
    </div>
  );
};
