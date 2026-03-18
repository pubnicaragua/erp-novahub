import React, { useState } from 'react';
import { EditableDataTable } from '../ui/EditableDataTable';
import { ActivityLog } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Search, Activity, MousePointerClick, RefreshCcw, Database } from 'lucide-react';
import { activityLogsService } from '../../services/actividades.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';

interface BitacoraViewProps {
  data: ActivityLog[];
  loading: boolean;
  onRefresh: () => void;
}

export const BitacoraView: React.FC<BitacoraViewProps> = ({ data, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const columns = [
    { key: 'action', header: 'Acción', width: '150px',
      render: (val: any) => { 
        const colors: Record<string, string> = { CREATE: 'bg-emerald-500/10 text-emerald-500', UPDATE: 'bg-blue-500/10 text-blue-500', DELETE: 'bg-rose-500/10 text-rose-500' };
        return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', colors[(val||'').toUpperCase()] || 'bg-muted/20 text-muted-foreground')}>{val}</Badge>; 
      } 
    },
    { key: 'entity', header: 'Entidad', width: '20%' },
    { key: 'details', header: 'Detalles', width: '40%' },
    { key: 'timestamp', header: 'Fecha', width: '150px', render: (val: any) => val ? format(new Date(val), 'MMM dd, yyyy HH:mm:ss') : '-' },
  ];

  const handleUpdate = async () => { /* Log is usually read-only */ };

  const kpis = [
    { title: 'Total Registros', value: data.length,                                                               icon: Activity,           color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Creaciones',      value: data.filter(l => (l.action||'').toUpperCase() === 'CREATE').length,        icon: Database,           color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Actualizaciones', value: data.filter(l => (l.action||'').toUpperCase() === 'UPDATE').length,        icon: RefreshCcw,         color: 'text-amber-500',   bg: 'bg-amber-500/10'   },
    { title: 'Eliminaciones',   value: data.filter(l => (l.action||'').toUpperCase() === 'DELETE').length,        icon: MousePointerClick,  color: 'text-rose-500',    bg: 'bg-rose-500/10'    },
  ];

  const filtered = data.filter(l => l.entity?.toLowerCase().includes(searchTerm.toLowerCase()) || l.details?.toLowerCase().includes(searchTerm.toLowerCase()) || l.action?.toLowerCase().includes(searchTerm.toLowerCase()));

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
          <div><h2 className="text-xl font-black uppercase tracking-tight">Bitácora de Auditoría</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Registro de actividades del sistema</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar evento..." className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} />
      </Card>
    </div>
  );
};
