import React, { useState } from 'react';
import { EditableDataTable } from '../ui/EditableDataTable';
import { Reminder } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, Bell, BellRing, BellOff, Clock } from 'lucide-react';
import { remindersService } from '../../services/actividades.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { format } from 'date-fns';

interface RecordatoriosViewProps {
  data: Reminder[];
  loading: boolean;
  onRefresh: () => void;
}

export const RecordatoriosView: React.FC<RecordatoriosViewProps> = ({ data, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const statusOpts = [
    { value: 'PENDING', label: 'Pendiente', color: 'bg-amber-500/10 text-amber-500' },
    { value: 'SENT', label: 'Enviado', color: 'bg-emerald-500/10 text-emerald-500' },
    { value: 'SNOOZED', label: 'Pospuesto', color: 'bg-blue-500/10 text-blue-500' },
    { value: 'CANCELLED', label: 'Cancelado', color: 'bg-rose-500/10 text-rose-500' },
  ];

  const columns = [
    { key: 'title', header: 'Recordatorio', width: '30%', editable: true },
    { key: 'description', header: 'Detalles', width: '40%', editable: true },
    { key: 'reminderDate', header: 'Fecha Aviso', width: '150px', editable: true, type: 'date' as const, render: (val: any) => val ? format(new Date(val), 'MMM dd, yyyy HH:mm') : '-' },
    { key: 'status', header: 'Estado', width: '120px', editable: true, type: 'select' as const, options: statusOpts,
      render: (val: any) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Reminder>) => {
    try { await remindersService.update(id as string, updates); toast.success('Recordatorio actualizado'); onRefresh(); }
    catch { toast.error('Error al actualizar recordatorio'); }
  };

  const handleAdd = async () => {
    try {
      await remindersService.create({ title: 'Nuevo Recordatorio', reminderDate: new Date(Date.now() + 86400000).toISOString(), status: 'PENDING' });
      toast.success('Recordatorio creado'); onRefresh();
    } catch { toast.error('Error al crear recordatorio'); }
  };

  const kpis = [
    { title: 'Total Avisos',    value: data.length,                                                                    icon: Bell,      color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Pendientes',      value: data.filter(r => (r.status||'').toUpperCase() === 'PENDING').length,            icon: Clock,     color: 'text-amber-500',  bg: 'bg-amber-500/10'   },
    { title: 'Enviados',        value: data.filter(r => (r.status||'').toUpperCase() === 'SENT').length,               icon: BellRing,  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Cancelados',      value: data.filter(r => (r.status||'').toUpperCase() === 'CANCELLED').length,          icon: BellOff,   color: 'text-rose-500',   bg: 'bg-rose-500/10'    },
  ];

  const filtered = data.filter(r => r.title?.toLowerCase().includes(searchTerm.toLowerCase()) || r.description?.toLowerCase().includes(searchTerm.toLowerCase()));

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
          <div><h2 className="text-xl font-black uppercase tracking-tight">Recordatorios</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Alertas programadas</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={handleAdd} className="bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nuevo Aviso</Button>
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} onRowDelete={async (id) => { try { await remindersService.delete(id as string); toast.success('Recordatorio eliminado'); onRefresh(); } catch { toast.error('Error al eliminar'); } }} />
      </Card>
    </div>
  );
};
