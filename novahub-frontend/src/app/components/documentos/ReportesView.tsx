import { useState } from 'react';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { Report } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, FileBarChart, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { reportsService } from '../../services/documentos.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';

interface ReportesViewProps {
  data: Report[];
  loading: boolean;
  onRefresh: () => void;
}

export const ReportesView: React.FC<ReportesViewProps> = ({ data, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { canPerform } = useAuth();

  const columns: ColumnDef<Report>[] = [
    { key: 'title', header: 'Título', width: '40%', editable: canPerform('DOCUMENTS_REPORTS', 'edit') },
    { key: 'type', header: 'Tipo', width: '20%', editable: canPerform('DOCUMENTS_REPORTS', 'edit') },
    { key: 'format', header: 'Formato', width: '100px', editable: canPerform('DOCUMENTS_REPORTS', 'edit'), type: 'select', options: [{label: 'PDF', value: 'PDF'}, {label: 'EXCEL', value: 'EXCEL'}, {label: 'CSV', value: 'CSV'}] },
    { key: 'generatedDate', header: 'Generado', width: '150px', type: 'date', render: (val: any) => val ? format(new Date(val), 'MMM dd, yyyy') : '-' },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Report>) => {
    try { await reportsService.update(id as string, updates); toast.success('Reporte actualizado'); onRefresh(); }
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar'); }
  };

  const handleAdd = async () => {
    try {
      await reportsService.create({ title: 'Nuevo Reporte de Ventas', type: 'Ventas', format: 'PDF', generatedDate: new Date().toISOString() });
      toast.success('Reporte generado'); onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al generar'); }
  };

  const kpis = [
    { title: 'Total Reportes',  value: data.length,                                                                    icon: FileBarChart,  color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Formato PDF',     value: data.filter(r => (r.format||'').toUpperCase() === 'PDF').length,                icon: FileText,      color: 'text-rose-500',   bg: 'bg-rose-500/10'    },
    { title: 'Formato Excel',   value: data.filter(r => (r.format||'').toUpperCase() === 'EXCEL').length,              icon: FileSpreadsheet, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Generados Hoy',   value: data.filter(r => { const d=new Date(r.generatedDate); return d.toDateString()===new Date().toDateString() }).length, icon: Download, color: 'text-purple-500', bg: 'bg-purple-500/10'  },
  ];

  const filtered = data.filter(r => r.title?.toLowerCase().includes(searchTerm.toLowerCase()) || r.type?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="min-w-0 space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="border-none bg-background/50 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("p-3 rounded-2xl flex items-center justify-center", kpi.bg)}><kpi.icon className={cn("size-6", kpi.color)} /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.title}</p><p className="text-2xl font-black tracking-tight">{kpi.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="min-w-0 overflow-hidden border-none bg-background/50 backdrop-blur-xl shadow-sm">
        <div className="p-4 border-b border-border/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight">Reportes</h2></div>
          <div className="erp-list-toolbar flex min-w-0 flex-wrap items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            {canPerform('DOCUMENTS_REPORTS', 'create') && (
              <Button data-toolbar-role="primary" onClick={handleAdd} className="bg-purple-600 hover:bg-purple-700 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nuevo Reporte</Button>
            )}
          </div>
        </div>
        <EditableDataTable 
          data={filtered} 
          columns={columns} 
          onRowUpdate={canPerform('DOCUMENTS_REPORTS', 'edit') ? handleUpdate : undefined} 
          isLoading={loading} 
          onRowDelete={canPerform('DOCUMENTS_REPORTS', 'delete') ? async (id) => { try { await reportsService.delete(id as string); toast.success('Eliminado'); onRefresh(); } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar reporte'); } } : undefined} 
        />
      </Card>
    </div>
  );
};

