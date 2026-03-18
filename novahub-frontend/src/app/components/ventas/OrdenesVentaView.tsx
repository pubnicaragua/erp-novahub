import React, { useState } from 'react';
import { 
  ClipboardList, Plus, Search, TrendingUp, Clock, FilePlus, Package, Eye, Trash2
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { salesOrdersService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import type { SalesOrder } from '../../types';
import { Badge } from '../ui/badge';

interface OrdenesVentaViewProps {
  data: SalesOrder[];
  loading: boolean;
  onRefresh: () => void;
  onGenerateInvoice: (order: SalesOrder) => void;
}

const statusOptions = [
  { label: 'Borrador',       value: 'DRAFT',       color: 'bg-muted/20 text-muted-foreground' },
  { label: 'Confirmada',     value: 'CONFIRMED',   color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'En Proceso',     value: 'IN_PROGRESS', color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Enviada',        value: 'SHIPPED',     color: 'bg-purple-500/10 text-purple-500' },
  { label: 'Entregada',      value: 'DELIVERED',   color: 'bg-cyan-500/10 text-cyan-500' },
  { label: 'Cancelada',      value: 'CANCELLED',   color: 'bg-rose-500/10 text-rose-500' },
];

export function OrdenesVentaView({ data, loading, onRefresh, onGenerateInvoice }: OrdenesVentaViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = data.filter(o => 
    o.number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (o.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdate = async (id: string | number, updates: Partial<SalesOrder>) => {
    try {
      await salesOrdersService.update(id.toString(), updates);
      toast.success('Orden actualizada');
      onRefresh();
    } catch (error) {
      toast.error('Error al actualizar');
      throw error;
    }
  };

  const handleAddOrder = async () => {
    try {
      await salesOrdersService.create({
        customerId: data[0]?.customerId || 'temp-customer-id',
        date: new Date().toISOString(),
        items: [],
        notes: 'Nueva orden',
        status: 'DRAFT' as any,
      } as any);
      toast.success('Nueva orden creada — doble clic en la fila para editar');
      onRefresh();
    } catch (e) { toast.error('Error al crear orden'); }
  };

  const columns: ColumnDef<SalesOrder>[] = [
    { 
      key: 'number', 
      header: 'Número de Orden', 
      width: '160px',
      render: (val) => <span className="text-xs font-black font-mono text-primary cursor-pointer hover:underline">{val}</span>
    },
    { 
      key: 'customer', 
      header: 'Cliente', 
      render: (val, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Varios'}</span>
    },
    { 
      key: 'itemCount', 
      header: 'Items', 
      width: '100px',
      render: (val, row) => <span className="text-xs font-medium text-muted-foreground">{row.items?.length || 0} art.</span>
    },
    { 
      key: 'total', 
      header: 'Monto Total', 
      width: '150px',
      render: (val) => <span className="text-[13px] font-black tabular-nums text-emerald-500">${Number(val||0).toLocaleString()}</span>
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
      key: 'date', 
      header: 'Fecha Compromiso', 
      render: (val) => (
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
           <Clock className="size-3" />
           {new Date(val).toLocaleDateString()}
        </div>
      )
    }
  ];

  const kpis = [
    { title: 'Órdenes Abiertas',  value: data.filter(o => (o.status||'').toUpperCase() === 'CONFIRMED').length, icon: Package, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { title: 'Monto Confirmado', value: `$${data.filter(o => (o.status||'').toUpperCase() === 'CONFIRMED').reduce((acc, o) => acc + Number(o.total||0), 0).toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'En Proceso',        value: data.filter(o => (o.status||'').toUpperCase() === 'IN_PROGRESS').length, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Total del Mes',     value: data.length, icon: ClipboardList, color: 'text-purple-500', bg: 'bg-purple-500/10' },
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
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Órdenes de Venta</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Órdenes confirmadas listas para preparación y facturación.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input 
                placeholder="Buscar orden..." 
                className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold uppercase tracking-widest"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button onClick={handleAddOrder} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20">
              <Plus className="size-4" /> Nueva Orden
            </Button>
          </div>
        </div>

        <EditableDataTable 
          data={filtered}
          onBulkDelete={async (ids) => {
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await salesOrdersService.delete(id as string);
              }
              toast.success('Elementos eliminados');
              onRefresh();
            } catch (e) {
              toast.error('Error al eliminar');
            }
          }}
          columns={columns}
          onRowUpdate={handleUpdate}
          isLoading={loading}
          actions={(row) => (
            <div className="flex items-center gap-1">
               {row.status === 'confirmed' && (
                 <Button 
                   title="Generar Factura" 
                   onClick={() => onGenerateInvoice(row)}
                   variant="ghost" 
                   size="icon" 
                   className="size-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
                 >
                   <FilePlus className="size-4" />
                 </Button>
               )}
               <Button title="Ver detalle" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
               <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 transition-colors" onClick={async () => { await salesOrdersService.delete(row.id); onRefresh(); }}><Trash2 className="size-4" /></Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
