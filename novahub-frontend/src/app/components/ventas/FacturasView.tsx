import React, { useState } from 'react';
import { 
  FileText, Plus, Search, TrendingUp, Clock, CheckCircle2, CreditCard, AlertCircle, Eye, Trash2, Banknote
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { invoicesService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import type { Invoice } from '../../types';
import { Badge } from '../ui/badge';

interface FacturasViewProps {
  data: Invoice[];
  loading: boolean;
  onRefresh: () => void;
  onMarkAsPaid: (invoice: Invoice) => void;
}

const statusOptions = [
  { label: 'Borrador', value: 'draft', color: 'bg-muted/20 text-muted-foreground' },
  { label: 'Pendiente', value: 'pending', color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Pagada', value: 'paid', color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Vencida', value: 'overdue', color: 'bg-rose-500/10 text-rose-500' },
  { label: 'Anulada', value: 'void', color: 'bg-muted/20 text-muted-foreground' },
];

export function FacturasView({ data, loading, onRefresh, onMarkAsPaid }: FacturasViewProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = data.filter(f => 
    f.number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (f.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdate = async (id: string | number, updates: Partial<Invoice>) => {
    try {
      await invoicesService.update(id.toString(), updates);
      toast.success('Factura actualizada');
      onRefresh();
    } catch (error) {
      toast.error('Error al actualizar');
      throw error;
    }
  };

  const handleBatchPay = async (ids: (string | number)[]) => {
    try {
       const promises = ids.map(id => invoicesService.markAsPaid(id.toString()));
       await Promise.all(promises);
       toast.success(`${ids.length} Facturas marcadas como pagadas`);
       onRefresh();
    } catch (error) {
       toast.error('Error al procesar pagos masivos');
    }
  };

  const columns: ColumnDef<Invoice>[] = [
    { 
      key: 'number', 
      header: 'Nº Factura', 
      width: '140px',
      render: (val) => <span className="text-xs font-black font-mono text-primary cursor-pointer hover:underline">{val}</span>
    },
    { 
      key: 'customer', 
      header: 'Cliente', 
      render: (val, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Varios'}</span>
    },
    { 
      key: 'date', 
      header: 'Fecha Emisión', 
      render: (val) => <span className="text-xs font-medium text-muted-foreground">{new Date(val).toLocaleDateString()}</span>
    },
    { 
      key: 'dueDate', 
      header: 'Vencimiento', 
      render: (val, row) => (
        <span className={cn(
          "text-xs font-bold",
          row.status === 'overdue' ? 'text-rose-500' : 'text-muted-foreground'
        )}>
          {new Date(val).toLocaleDateString()}
        </span>
      )
    },
    { 
      key: 'total', 
      header: 'Total Neto', 
      width: '150px',
      render: (val) => <span className="text-[13px] font-black tabular-nums text-foreground">${val.toLocaleString()}</span>
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
    }
  ];

  const kpis = [
    { title: 'Facturado Mes', value: `$${data.reduce((acc, f) => acc + f.total, 0).toLocaleString()}`, icon: FileText, color: 'text-primary', bg: 'bg-primary/10' },
    { title: 'Por Cobrar', value: `$${data.filter(f => f.status === 'pending' || f.status === 'overdue').reduce((acc, f) => acc + f.total, 0).toLocaleString()}`, icon: TrendingUp, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { title: 'Vencidas', value: data.filter(f => f.status === 'overdue').length, icon: AlertCircle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { title: 'Cobrado (7d)', value: `$${(data.filter(f => f.status === 'paid').reduce((acc, f) => acc + f.total, 0) * 0.4).toLocaleString()}`, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ];

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
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Control de Facturación</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Gestión de recaudos masivos sin fricción.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input 
                placeholder="Buscar factura..." 
                className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold uppercase tracking-widest"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20">
              <Plus className="size-4" /> Nueva Factura
            </Button>
          </div>
        </div>

        <EditableDataTable 
          data={filtered}
          columns={columns}
          onRowUpdate={handleUpdate}
          onBulkDelete={async (ids) => {
            await Promise.all(ids.map(id => invoicesService.delete(id.toString())));
            toast.success(`${ids.length} Facturas eliminadas`);
            onRefresh();
          }}
          isLoading={loading}
          bulkActions={(ids) => (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-[10px] font-black uppercase tracking-wider text-emerald-500 hover:bg-emerald-500/10 border-emerald-500/20"
              onClick={() => handleBatchPay(ids)}
            >
              <Banknote className="size-3 mr-2" /> Registrar Pago ({ids.length})
            </Button>
          )}
          actions={(row) => (
            <div className="flex items-center gap-1">
               {row.status !== 'paid' && (
                 <Button 
                   title="Marcar como Pagada" 
                   onClick={() => onMarkAsPaid(row)}
                   variant="ghost" 
                   size="icon" 
                   className="size-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
                 >
                   <CreditCard className="size-4" />
                 </Button>
               )}
               <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"><Eye className="size-4" /></Button>
               <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 transition-colors" onClick={() => invoicesService.delete(row.id).then(() => onRefresh())}><Trash2 className="size-4" /></Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
