import { useState } from 'react';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { Alert } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, AlertTriangle, Info, AlertCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { alertsService } from '../../services/notificaciones.service';
import { format } from 'date-fns';

interface AlertasViewProps {
  data: Alert[];
  loading: boolean;
  onRefresh: () => void;
}

export const AlertasView: React.FC<AlertasViewProps> = ({ data, loading, onRefresh }) => {
  const { canPerform } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [creating, setCreating] = useState(false);

  const errMsg = (e: any, fallback: string) => e?.response?.data?.message || e?.message || fallback;

  const severityOpts = [
    { value: 'LOW', label: 'Baja', color: 'text-blue-500' },
    { value: 'MEDIUM', label: 'Media', color: 'text-amber-500' },
    { value: 'HIGH', label: 'Alta', color: 'text-rose-500' },
    { value: 'CRITICAL', label: 'Crítica', color: 'text-purple-500' },
  ];

  const columns: ColumnDef<Alert>[] = [
    { key: 'title', header: 'Título', width: '30%', editable: canPerform('NOTIFICATIONS_ALERTS', 'edit') },
    { key: 'content', header: 'Mensaje', width: '40%', editable: canPerform('NOTIFICATIONS_ALERTS', 'edit') },
    { key: 'severity', header: 'Severidad', width: '120px', editable: canPerform('NOTIFICATIONS_ALERTS', 'edit'), type: 'select', options: severityOpts,
      render: (val: any) => { const o = severityOpts.find(x => x.value === (val||'').toUpperCase()); return <span className={cn('text-[10px] font-bold uppercase', o?.color||'text-muted-foreground')}>{o?.label||val}</span>; } },
    { key: 'isRead', header: 'Leída', width: '100px', render: (val: any) => <Badge variant="outline" className={cn('text-[9px] uppercase border-none', val ? 'bg-primary/10 text-primary' : 'bg-rose-500/10 text-rose-500')}>{val ? 'Sí' : 'No'}</Badge> },
    { key: 'createdAt', header: 'Fecha', width: '150px', type: 'date', render: (val: any) => val ? format(new Date(val), 'MMM dd, HH:mm') : '-' },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Alert>) => {
    try { await alertsService.update(id as string, updates); toast.success('Alerta actualizada'); onRefresh(); }
    catch (e: any) { toast.error(errMsg(e, 'Error al actualizar')); }
  };

  const handleAdd = async () => {
    if (creating) return;
    setCreating(true);
    try {
      await alertsService.create({ title: 'Nueva Alerta', content: 'Detalles de la alerta', isRead: false, scope: 'PERSONAL' });
      toast.success('Alerta creada'); onRefresh();
    } catch (e: any) { toast.error(errMsg(e, 'Error al crear')); }
    finally { setCreating(false); }
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-tour="notificaciones-alertas-kpis">
        {kpis.map((kpi, i) => (
          <Card key={i} className="border-none bg-background/50 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("p-3 rounded-2xl flex items-center justify-center", kpi.bg)}><kpi.icon className={cn("size-6", kpi.color)} /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.title}</p><p className="text-2xl font-black tracking-tight">{kpi.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none bg-background/50 backdrop-blur-xl shadow-sm" data-tour="notificaciones-alertas-table">
        <div className="p-4 border-b border-border/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight">Alertas del Sistema</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Avisos y eventos críticos</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            {canPerform('NOTIFICATIONS_ALERTS', 'create') && (
              <Button onClick={handleAdd} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Crear Alerta</Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={canPerform('NOTIFICATIONS_ALERTS', 'edit') ? handleUpdate : undefined} isLoading={loading} onRowDelete={canPerform('NOTIFICATIONS_ALERTS', 'delete') ? async (id) => { try { await alertsService.delete(id as string); toast.success('Alerta eliminada'); onRefresh(); } catch (e: any) { toast.error(errMsg(e, 'Error al eliminar')); } } : undefined} />
      </Card>
    </div>
  );
};

