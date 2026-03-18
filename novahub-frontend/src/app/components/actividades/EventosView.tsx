import React, { useState } from 'react';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { Event } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, Calendar, CalendarCheck, CalendarDays, Users } from 'lucide-react';
import { eventsService } from '../../services/actividades.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { format } from 'date-fns';

interface EventosViewProps {
  data: Event[];
  loading: boolean;
  onRefresh: () => void;
}

export const EventosView: React.FC<EventosViewProps> = ({ data, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const columns: ColumnDef<Event>[] = [
    { key: 'title', header: 'Evento', width: '30%', editable: true },
    { key: 'description', header: 'Descripción', width: '30%', editable: true },
    { key: 'location', header: 'Ubicación', width: '20%', editable: true },
    { key: 'startDate', header: 'Fecha Inicio', width: '140px', editable: true, type: 'date', render: (val: any) => val ? format(new Date(val), 'MMM dd, yyyy HH:mm') : '-' },
    { key: 'endDate', header: 'Fecha Fin', width: '140px', editable: true, type: 'date', render: (val: any) => val ? format(new Date(val), 'MMM dd, yyyy HH:mm') : '-' },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Event>) => {
    try { await eventsService.update(id as string, updates); toast.success('Evento actualizado'); onRefresh(); }
    catch { toast.error('Error al actualizar evento'); }
  };

  const handleAdd = async () => {
    try {
      await eventsService.create({ title: 'Nuevo Evento', startDate: new Date().toISOString(), endDate: new Date(Date.now() + 3600000).toISOString() });
      toast.success('Evento creado'); onRefresh();
    } catch { toast.error('Error al crear evento'); }
  };

  const kpis = [
    { title: 'Total Eventos',   value: data.length,                                                                                                     icon: CalendarDays,  color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Próximos 7 Días', value: data.filter(e => new Date(e.startDate) > new Date() && new Date(e.startDate) < new Date(Date.now() + 7*86400000)).length, icon: Calendar,      color: 'text-amber-500',  bg: 'bg-amber-500/10'   },
    { title: 'Completados',     value: data.filter(e => new Date(e.endDate) < new Date()).length,                                                       icon: CalendarCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Con Invitados',   value: data.filter(e => e.attendees && e.attendees.length > 0).length,                                                  icon: Users,         color: 'text-purple-500',  bg: 'bg-purple-500/10'  },
  ];

  const filtered = data.filter(e => e.title?.toLowerCase().includes(searchTerm.toLowerCase()) || e.location?.toLowerCase().includes(searchTerm.toLowerCase()));

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
          <div><h2 className="text-xl font-black uppercase tracking-tight">Eventos</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Calendario y reuniones</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nuevo Evento</Button>
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} onRowDelete={async (id) => { try { await eventsService.delete(id as string); toast.success('Evento eliminado'); onRefresh(); } catch { toast.error('Error al eliminar'); } }} />
      </Card>
    </div>
  );
};
