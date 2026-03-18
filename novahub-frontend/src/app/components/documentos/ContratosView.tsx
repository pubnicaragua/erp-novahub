import React, { useState } from 'react';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { Contract } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, CheckCircle2, Clock, AlertTriangle, Scale } from 'lucide-react';
import { contractsService } from '../../services/documentos.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { format } from 'date-fns';

interface ContratosViewProps {
  data: Contract[];
  loading: boolean;
  onRefresh: () => void;
}

export const ContratosView: React.FC<ContratosViewProps> = ({ data, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const statusOpts = [
    { value: 'DRAFT', label: 'Borrador', color: 'bg-muted/20 text-muted-foreground' },
    { value: 'ACTIVE', label: 'Activo', color: 'bg-emerald-500/10 text-emerald-500' },
    { value: 'EXPIRED', label: 'Vencido', color: 'bg-rose-500/10 text-rose-500' },
    { value: 'TERMINATED', label: 'Terminado', color: 'bg-amber-500/10 text-amber-500' },
  ];

  const columns: ColumnDef<Contract>[] = [
    { key: 'number', header: 'No.', width: '100px', editable: true },
    { key: 'title', header: 'Título', width: '30%', editable: true },
    { key: 'value', header: 'Valor', width: '120px', editable: true, type: 'number', render: (val: any) => val ? `$${Number(val).toLocaleString()}` : '-' },
    { key: 'endDate', header: 'Vencimiento', width: '140px', editable: true, type: 'date', render: (val: any) => val ? format(new Date(val), 'MMM dd, yyyy') : '-' },
    { key: 'status', header: 'Estado', width: '120px', editable: true, type: 'select', options: statusOpts,
      render: (val: any) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Contract>) => {
    try { await contractsService.update(id as string, updates); toast.success('Contrato actualizado'); onRefresh(); }
    catch { toast.error('Error al actualizar'); }
  };

  const handleAdd = async () => {
    try {
      await contractsService.create({ number: `CTR-${Date.now().toString().slice(-5)}`, title: 'Nuevo Contrato', status: 'DRAFT' as any, value: 0 });
      toast.success('Contrato creado'); onRefresh();
    } catch { toast.error('Error al crear'); }
  };

  const kpis = [
    { title: 'Total Contratos', value: data.length,                                                                    icon: Scale,         color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Activos',         value: data.filter(c => (c.status||'').toUpperCase() === 'ACTIVE').length,             icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Por Vencer',      value: data.filter(c => c.endDate && new Date(c.endDate) < new Date(Date.now() + 30*86400000) && (c.status||'').toUpperCase() === 'ACTIVE').length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { title: 'Valor Total',     value: `$${data.reduce((a,c) => a + Number(c.value||0), 0).toLocaleString()}`,         icon: AlertTriangle, color: 'text-purple-500',  bg: 'bg-purple-500/10'  },
  ];

  const filtered = data.filter(c => c.title?.toLowerCase().includes(searchTerm.toLowerCase()) || c.number?.toLowerCase().includes(searchTerm.toLowerCase()));

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
          <div><h2 className="text-xl font-black uppercase tracking-tight">Contratos</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Gestión legal</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={handleAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nuevo Contrato</Button>
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} onRowDelete={async (id) => { try { await contractsService.delete(id as string); toast.success('Eliminado'); onRefresh(); } catch { toast.error('Error al eliminar'); } }} />
      </Card>
    </div>
  );
};
