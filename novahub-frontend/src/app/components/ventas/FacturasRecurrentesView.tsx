import React, { useState } from 'react';
import { 
  RotateCcw, Plus, Search, TrendingUp, Clock, Calendar, Play, Pause, Eye, Trash2
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { recurringInvoicesService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import type { RecurringInvoice } from '../../types';
import { Badge } from '../ui/badge';

interface FacturasRecurrentesViewProps {
  data: RecurringInvoice[];
  loading: boolean;
  onRefresh: () => void;
}

const statusOptions = [
  { label: 'Activa', value: 'active', color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Pausada', value: 'paused', color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Finalizada', value: 'expired', color: 'bg-muted/20 text-muted-foreground' },
];

export function FacturasRecurrentesView({ data, loading, onRefresh }: FacturasRecurrentesViewProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = data.filter(r => 
    (r as any).profileName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (r.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdate = async (id: string | number, updates: Partial<RecurringInvoice>) => {
    try {
      await recurringInvoicesService.update(id.toString(), updates);
      toast.success('Suscripción actualizada');
      onRefresh();
    } catch (error) {
      toast.error('Error al actualizar');
      throw error;
    }
  };

  const toggleStatus = async (row: RecurringInvoice) => {
    try {
      if (row.status === 'active') {
        await recurringInvoicesService.pause(row.id);
        toast.success('Suscripción pausada');
      } else {
        await recurringInvoicesService.resume(row.id);
        toast.success('Suscripción reanudada');
      }
      onRefresh();
    } catch (error) {
      toast.error('Error al cambiar estado');
    }
  };

  const columns: ColumnDef<RecurringInvoice>[] = [
    { 
      key: 'id', 
      header: 'Referencia / Alias', 
      width: '180px',
      render: (val, row) => <span className="text-xs font-black font-mono text-primary group-hover:underline cursor-pointer">Suscripción #{row.id.slice(0, 8)}</span>
    },
    { 
      key: 'customer', 
      header: 'Cliente', 
      render: (val, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Cliente'}</span>
    },
    { 
      key: 'frequency', 
      header: 'Frecuencia', 
      width: '120px',
      editable: true,
      type: 'select',
      options: [
        { label: 'Mensual', value: 'monthly' },
        { label: 'Anual', value: 'yearly' },
        { label: 'Semanal', value: 'weekly' }
      ],
      render: (val) => (
        <Badge variant="secondary" className="text-[9px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-500 border-none">
           {val === 'monthly' ? 'Mensual' : val === 'yearly' ? 'Anual' : 'Semanal'}
        </Badge>
      )
    },
    { 
      key: 'total', 
      header: 'Monto Ciclo', 
      width: '150px',
      render: (val) => <span className="text-[13px] font-black tabular-nums text-foreground">${val.toLocaleString()}</span>
    },
    { 
      key: 'status', 
      header: 'Estado', 
      width: '130px',
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
      key: 'nextInvoiceDate', 
      header: 'Próxima Fecha', 
      render: (val) => (
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
           <Calendar className="size-3" />
           {new Date(val).toLocaleDateString()}
        </div>
      )
    }
  ];

  const kpis = [
    { title: 'MRR (Mensual)', value: `$${data.reduce((acc, r) => acc + r.total, 0).toLocaleString()}`, icon: RotateCcw, color: 'text-primary', bg: 'bg-primary/10' },
    { title: 'Suscripciones', value: data.length, icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Próximos Cobros', value: '8', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { title: 'Churn Rate', value: '1.2%', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ];

  const handleAddRecurring = async () => {
    try {
      await recurringInvoicesService.create({
        status: 'active',
        frequency: 'monthly',
        total: 0,
        subtotal: 0,
        taxAmount: 0,
        nextInvoiceDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        startDate: new Date().toISOString()
      });
      toast.success('Nueva suscripción creada');
      onRefresh();
    } catch (error) {
      toast.error('Error al crear suscripción');
    }
  };

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
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Facturación Recurrente</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Gestión de contratos, igualas y servicios por suscripción.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input 
                placeholder="Buscar suscripción..." 
                className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold uppercase tracking-widest"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button 
               onClick={handleAddRecurring}
               className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20"
            >
              <Plus className="size-4" /> Nueva Suscripción
            </Button>
          </div>
        </div>

        <EditableDataTable 
          data={filtered}
          columns={columns}
          onRowUpdate={handleUpdate}
          onAddRow={handleAddRecurring}
          isLoading={loading}
          actions={(row) => (
            <div className="flex items-center gap-1">
               {row.status === 'active' ? (
                 <Button title="Pausar" onClick={() => toggleStatus(row)} variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-amber-500/10 hover:text-amber-500 transition-colors"><Pause className="size-4" /></Button>
               ) : (
                 <Button title="Reanudar" onClick={() => toggleStatus(row)} variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"><Play className="size-4" /></Button>
               )}
               <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"><Eye className="size-4" /></Button>
               <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 transition-colors" onClick={() => recurringInvoicesService.delete(row.id).then(() => onRefresh())}><Trash2 className="size-4" /></Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
