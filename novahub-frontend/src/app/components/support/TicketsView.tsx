import React, { useState } from 'react';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { Ticket } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, AlertTriangle, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { supportService } from '../../services/support.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { format } from 'date-fns';

interface TicketsViewProps {
  data: Ticket[];
  loading: boolean;
  onRefresh: () => void;
}

export const TicketsView: React.FC<TicketsViewProps> = ({ data, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const statusOpts = [
    { value: 'OPEN', label: 'Abierto', color: 'bg-amber-500/10 text-amber-500' },
    { value: 'IN_PROGRESS', label: 'En Progreso', color: 'bg-blue-500/10 text-blue-500' },
    { value: 'RESOLVED', label: 'Resuelto', color: 'bg-emerald-500/10 text-emerald-500' },
    { value: 'CLOSED', label: 'Cerrado', color: 'bg-slate-500/10 text-slate-500' },
  ];

  const priorityOpts = [
    { value: 'LOW', label: 'Baja', color: 'text-slate-500' },
    { value: 'MEDIUM', label: 'Media', color: 'text-blue-500' },
    { value: 'HIGH', label: 'Alta', color: 'text-amber-500' },
    { value: 'URGENT', label: 'Urgente', color: 'text-rose-500' },
  ];

  const columns: ColumnDef<Ticket>[] = [
    { key: 'number', header: 'Ticket', width: '100px' },
    { key: 'subject', header: 'Asunto', width: '25%', editable: true },
    { key: 'description', header: 'Descripción', width: '35%', editable: true },
    { key: 'priority', header: 'Prioridad', width: '100px', editable: true, type: 'select', options: priorityOpts,
      render: (val: any) => { const o = priorityOpts.find(x => x.value === (val||'').toUpperCase()); return <span className={cn('text-[10px] font-bold uppercase', o?.color||'text-muted-foreground')}>{o?.label||val}</span>; } },
    { key: 'status', header: 'Estado', width: '120px', editable: true, type: 'select', options: statusOpts,
      render: (val: any) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
    { key: 'createdAt', header: 'Creado', width: '120px', type: 'date', render: (val: any) => val ? format(new Date(val), 'MMM dd, yyyy') : '-' },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Ticket>) => {
    try { await supportService.update(id as string, updates); toast.success('Ticket actualizado'); onRefresh(); }
    catch { toast.error('Error al actualizar'); }
  };

  const handleAdd = async () => {
    try {
      await supportService.create({ number: `TCK-${Date.now().toString().slice(-5)}`, subject: 'Nuevo Ticket', description: 'Describa el problema aquí...', status: 'OPEN', priority: 'MEDIUM' } as any);
      toast.success('Ticket creado'); onRefresh();
    } catch { toast.error('Error al crear'); }
  };

  const kpis = [
    { title: 'Abiertos',     value: data.filter(t => (t.status||'').toUpperCase() === 'OPEN').length,        icon: AlertTriangle, color: 'text-amber-500',   bg: 'bg-amber-500/10'   },
    { title: 'En Progreso',  value: data.filter(t => (t.status||'').toUpperCase() === 'IN_PROGRESS').length, icon: Clock,         color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Resueltos',    value: data.filter(t => (t.status||'').toUpperCase() === 'RESOLVED').length,    icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Cerrados',     value: data.filter(t => (t.status||'').toUpperCase() === 'CLOSED').length,      icon: XCircle,       color: 'text-slate-500',   bg: 'bg-slate-500/10'   },
  ];

  const filtered = data.filter(t => t.subject?.toLowerCase().includes(searchTerm.toLowerCase()) || t.number?.toLowerCase().includes(searchTerm.toLowerCase()) || t.description?.toLowerCase().includes(searchTerm.toLowerCase()));

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
          <div><h2 className="text-xl font-black uppercase tracking-tight">Mesa de Ayuda</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Gestión de tickets y soporte</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={handleAdd} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nuevo Ticket</Button>
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} onRowDelete={async (id) => { try { await supportService.delete(id as string); toast.success('Eliminado'); onRefresh(); } catch { toast.error('Error al eliminar'); } }} />
      </Card>
    </div>
  );
};
