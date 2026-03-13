import React, { useState } from 'react';
import { 
  FileOutput, Plus, Search, TrendingUp, Clock, AlertTriangle, FileMinus, Eye, Trash2
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { salesReturnsService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import type { SalesReturn } from '../../types';
import { Badge } from '../ui/badge';

interface DevolucionesViewProps {
  data: SalesReturn[];
  loading: boolean;
  onRefresh: () => void;
}

const statusOptions = [
  { label: 'Pendiente', value: 'pending', color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Aprobada', value: 'approved', color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Rechazada', value: 'rejected', color: 'bg-rose-500/10 text-rose-500' },
];

export function DevolucionesView({ data, loading, onRefresh }: DevolucionesViewProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = data.filter(d => 
    (d as any).number?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (d.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdate = async (id: string | number, updates: Partial<SalesReturn>) => {
    try {
      // Assuming approved endpoint exists or we use update
      if (updates.status === 'approved') {
         await salesReturnsService.approve(id.toString());
         toast.success('Retorno aprobado');
      } else {
         // Generic update if needed
         toast.info('Actualización de metadatos');
      }
      onRefresh();
    } catch (error) {
      toast.error('Error al actualizar');
      throw error;
    }
  };

  const columns: ColumnDef<SalesReturn>[] = [
    { 
      key: 'id', 
      header: 'ID Retorno', 
      width: '120px',
      render: (val) => <span className="text-[11px] font-black font-mono text-muted-foreground/60">{val.slice(0, 8)}</span>
    },
    { 
      key: 'customer', 
      header: 'Cliente', 
      render: (val, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Cliente'}</span>
    },
    { 
      key: 'invoiceId', 
      header: 'Referencia / Factura', 
      render: (val) => <span className="text-xs font-bold text-rose-500">{val || 'S/V'}</span>
    },
    { 
      key: 'date', 
      header: 'Fecha', 
      render: (val) => <span className="text-xs font-medium text-muted-foreground">{new Date(val).toLocaleDateString()}</span>
    },
    { 
      key: 'total', 
      header: 'Monto Crédito', 
      width: '150px',
      render: (val) => <span className="text-[13px] font-black tabular-nums text-rose-500">${(val || 0).toLocaleString()}</span>
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
    { title: 'Devoluciones Mes', value: `$${data.reduce((acc, d) => acc + (d.total || 0), 0).toLocaleString()}`, icon: FileOutput, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { title: 'Por Aprobar', value: data.filter(d => d.status === 'pending').length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { title: 'Crédito Emitido', value: `$${(data.filter(d => d.status === 'approved').reduce((acc, d) => acc + (d.total || 0), 0)).toLocaleString()}`, icon: FileMinus, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Tasa Devolución', value: '2.4%', icon: AlertTriangle, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

  const handleAddReturn = async () => {
    try {
      await salesReturnsService.create({
        reason: 'Nueva Devolución',
        status: 'pending',
        date: new Date().toISOString(),
        total: 0
      });
      toast.success('Nueva factura recurrente creada');
      onRefresh();
    } catch (error) {
      toast.error('Error al registrar retorno');
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
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Devoluciones & Notas de Crédito</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Gestión de retornos de mercadería y ajustes de cuenta por cobrar.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input 
                placeholder="Buscar devolución..." 
                className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold uppercase tracking-widest"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button 
               onClick={handleAddReturn}
               className="bg-rose-500 hover:bg-rose-600 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-rose-500/20 border border-rose-500/20"
            >
              <Plus className="size-4" /> Registrar Retorno
            </Button>
          </div>
        </div>

        <EditableDataTable 
          data={filtered}
          columns={columns}
          onRowUpdate={handleUpdate}
          onAddRow={handleAddReturn}
          isLoading={loading}
          actions={(row) => (
            <div className="flex items-center gap-1">
               <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"><Eye className="size-4" /></Button>
               <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 transition-colors"><Trash2 className="size-4" /></Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
