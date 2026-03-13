import React, { useState } from 'react';
import { 
  FileSpreadsheet, Plus, Search, TrendingUp, Clock, CheckCircle2, FilePlus, Eye, Trash2, ChevronLeft
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { estimatesService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import type { Estimate } from '../../types';
import { Badge } from '../ui/badge';

interface EstimacionesViewProps {
  data: Estimate[];
  loading: boolean;
  onRefresh: () => void;
}

const statusOptions = [
  { label: 'Borrador', value: 'draft', color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Enviada', value: 'active', color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Aprobada', value: 'approved', color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Rechazada', value: 'rejected', color: 'bg-rose-500/10 text-rose-500' },
  { label: 'Expirada', value: 'expired', color: 'bg-muted/20 text-muted-foreground' },
];

export function EstimacionesView({ data, loading, onRefresh }: EstimacionesViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = data.filter(e => 
    e.number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (e.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdate = async (id: string | number, updates: Partial<Estimate>) => {
    try {
      await estimatesService.update(id.toString(), updates);
      toast.success('Estimación actualizada');
      onRefresh();
    } catch (error) {
      toast.error('Error al actualizar');
      throw error;
    }
  };

  const columns: ColumnDef<Estimate>[] = [
    { 
      key: 'number', 
      header: 'Número', 
      width: '140px',
      render: (val, row) => (
        <span 
          className="text-xs font-black font-mono text-primary cursor-pointer hover:underline"
          onClick={() => setEditingId(row.id)}
        >
          {val}
        </span>
      )
    },
    { 
      key: 'customerId', 
      header: 'Cliente', 
      render: (val, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Varios'}</span>
    },
    { 
      key: 'date', 
      header: 'Fecha Emisión', 
      render: (val) => <span className="text-xs font-medium text-muted-foreground">{new Date(val).toLocaleDateString()}</span>
    },
    { 
      key: 'total', 
      header: 'Total Neto', 
      width: '150px',
      render: (val) => (
        <span className="text-[13px] font-black tabular-nums text-foreground">
          ${val.toLocaleString()}
        </span>
      )
    },
    { 
      key: 'status', 
      header: 'Estado', 
      width: '130px',
      editable: true,
      type: 'select',
      options: statusOptions,
      render: (val) => {
        const opt = statusOptions.find(o => o.value === val);
        return (
          <Badge variant="outline" className={cn(
            "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none",
            opt?.color || 'bg-muted/20 text-muted-foreground'
          )}>
            {opt?.label || val}
          </Badge>
        );
      }
    },
    { 
      key: 'expiryDate', 
      header: 'Validez', 
      render: (val) => (
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
           <Clock className="size-3" />
           {new Date(val).toLocaleDateString()}
        </div>
      )
    }
  ];

  const kpis = [
    { title: 'Total Cotizado', value: `$${data.reduce((acc, e) => acc + e.total, 0).toLocaleString()}`, icon: FileSpreadsheet, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Tasa Conversión', value: `${((data.filter(e => e.status === 'approved').length / (data.length || 1)) * 100).toFixed(0)}%`, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Pendientes', value: data.filter(e => e.status === 'sent').length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { title: 'Vencen Pronto', value: '4', icon: CheckCircle2, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

  if (editingId) {
    const estimate = data.find(e => e.id === editingId);
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
         <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
               <Button variant="ghost" size="icon" onClick={() => setEditingId(null)} className="rounded-full">
                  <ChevronLeft className="size-5" />
               </Button>
               <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">Editar Estimación {estimate?.number}</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Detalle de líneas y productos.</p>
               </div>
            </div>
            <div className="flex items-center gap-3">
               <Button variant="outline" className="rounded-xl border-border/50 font-black uppercase text-[10px] tracking-widest px-6">
                  Guardar Borrador
               </Button>
               <Button className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6">
                  Aprobar y Enviar
               </Button>
            </div>
         </div>
         
         <Card className="rounded-2xl border-border/50 bg-card/10 backdrop-blur-xl overflow-hidden min-h-[500px] flex items-center justify-center">
            <CardContent className="flex flex-col items-center gap-4 py-20">
               <div className="p-6 bg-primary/10 rounded-full">
                  <FileSpreadsheet className="size-12 text-primary animate-bounce" />
               </div>
               <div className="text-center">
                  <p className="text-xl font-black uppercase tracking-tighter">Editor Excel-like en Carga</p>
                  <p className="text-xs font-medium text-muted-foreground/60 max-w-sm mt-2">Próximamente podrás editar ítems, impuestos y descuentos directamente en esta vista sin pop-ups.</p>
               </div>
            </CardContent>
         </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden relative group">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-xl shadow-inner", kpi.bg, kpi.color)}>
                  <kpi.icon className="size-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.title}</p>
                  <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">{kpi.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Estimaciones & Cotizaciones</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Negociaciones en tiempo real sin modals ni esperas.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input 
                placeholder="Buscar cotización..." 
                className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold uppercase tracking-widest"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-emerald-500/20 border border-emerald-500/20">
              <Plus className="size-4" /> Nueva Cotización
            </Button>
          </div>
        </div>

        <EditableDataTable 
          data={filtered}
          columns={columns}
          onRowUpdate={handleUpdate}
          isLoading={loading}
          actions={(row) => (
            <div className="flex items-center gap-1">
               <Button title="Convertir a Orden" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors" onClick={() => estimatesService.convertToOrder(row.id).then(() => onRefresh())}><FilePlus className="size-4" /></Button>
               <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
               <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 transition-colors" onClick={() => estimatesService.delete(row.id).then(() => onRefresh())}><Trash2 className="size-4" /></Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
