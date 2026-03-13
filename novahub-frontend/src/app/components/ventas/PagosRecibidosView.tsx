import React, { useState } from 'react';
import { 
  CreditCard, Plus, Search, TrendingUp, Clock, CheckCircle2, Wallet, Eye, Trash2
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { paymentsService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import type { PaymentReceived } from '../../types';
import { Badge } from '../ui/badge';

interface PagosRecibidosViewProps {
  data: PaymentReceived[];
  loading: boolean;
  onRefresh: () => void;
}

export function PagosRecibidosView({ data, loading, onRefresh }: PagosRecibidosViewProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = data.filter(p => 
    p.number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.invoice?.number || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdate = async (id: string | number, updates: Partial<PaymentReceived>) => {
    try {
      await paymentsService.update(id.toString(), updates);
      toast.success('Pago actualizado');
      onRefresh();
    } catch (error) {
      toast.error('Error al actualizar');
      throw error;
    }
  };

  const columns: ColumnDef<PaymentReceived>[] = [
    { 
      key: 'number', 
      header: 'ID Pago', 
      width: '120px',
      render: (val) => <span className="text-[11px] font-black font-mono text-muted-foreground/60">{val}</span>
    },
    { 
      key: 'customer', 
      header: 'Cliente', 
      render: (val, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Cliente'}</span>
    },
    { 
      key: 'reference', 
      header: 'Referencia / Factura', 
      render: (val, row) => (
        <span className="text-xs font-bold text-primary">
          {row.invoice?.number || val || 'Anticipo'}
        </span>
      )
    },
    { 
      key: 'date', 
      header: 'Fecha', 
      render: (val) => <span className="text-xs font-medium text-muted-foreground">{new Date(val).toLocaleDateString()}</span>
    },
    { 
      key: 'amount', 
      header: 'Monto', 
      width: '150px',
      render: (val) => <span className="text-[13px] font-black tabular-nums text-emerald-500">${val.toLocaleString()}</span>
    },
    { 
      key: 'method', 
      header: 'Método', 
      width: '120px',
      editable: true,
      type: 'select',
      options: [
        { label: 'Transferencia', value: 'Transfer', color: 'bg-blue-500/10 text-blue-500' },
        { label: 'Efectivo', value: 'Cash', color: 'bg-emerald-500/10 text-emerald-500' },
        { label: 'Tarjeta', value: 'Card', color: 'bg-purple-500/10 text-purple-500' },
        { label: 'Cheque', value: 'Check', color: 'bg-amber-500/10 text-amber-500' },
      ],
      render: (val) => (
        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none bg-blue-500/10 text-blue-500">
          {val}
        </Badge>
      )
    }
  ];

  const kpis = [
    { title: 'Recaudado (7d)', value: `$${data.reduce((acc, p) => acc + p.amount, 0).toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Pagos Procesados', value: data.length, icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Por Conciliar', value: '$345', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { title: 'Método Principal', value: 'Transfer', icon: Wallet, color: 'text-purple-500', bg: 'bg-purple-500/10' },
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
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Pagos Recibidos</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Historial de cobranza y conciliación de ingresos.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input 
                placeholder="Buscar pago..." 
                className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold uppercase tracking-widest"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-emerald-500/20 border border-emerald-500/20">
              <Plus className="size-4" /> Registrar Pago
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
               <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"><Eye className="size-4" /></Button>
               <Button variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 transition-colors" onClick={() => paymentsService.delete(row.id).then(() => onRefresh())}><Trash2 className="size-4" /></Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
