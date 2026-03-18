import React, { useState } from 'react';
import {
  FileMinus, Plus, Search, TrendingDown, CheckCircle2, Clock, AlertTriangle, Eye, Trash2
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

interface NotasCreditoViewProps {
  data: SalesReturn[];
  loading: boolean;
  onRefresh: () => void;
}

const statusOptions = [
  { label: 'Pendiente',  value: 'PENDING',   color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Aprobada',   value: 'APPROVED',  color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Procesada',  value: 'PROCESSED', color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Rechazada',  value: 'REJECTED',  color: 'bg-rose-500/10 text-rose-500' },
];

export function NotasCreditoView({ data, loading, onRefresh }: NotasCreditoViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const approved = data.filter(d => (d.status || '').toUpperCase() === 'APPROVED');

  const filtered = approved.filter(d =>
    ((d as any).number || d.id).toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdate = async (id: string | number, updates: Partial<SalesReturn>) => {
    try {
      await salesReturnsService.update(id.toString(), updates);
      toast.success('Nota de crédito actualizada');
      onRefresh();
    } catch {
      toast.error('Error al actualizar');
    }
  };

  const handleAddCreditNote = async () => {
    try {
      await salesReturnsService.create({
        invoiceId: data[0]?.invoiceId || 'temp-invoice-id',
        customerId: data[0]?.customerId || 'temp-customer-id',
        reason: 'Nota de crédito — completar detalles',
        date: new Date().toISOString(),
        items: []
      });
      toast.success('Nota de crédito creada');
      onRefresh();
    } catch {
      toast.error('Error al crear nota de crédito');
    }
  };

  const columns: ColumnDef<SalesReturn>[] = [
    {
      key: 'id',
      header: 'N° Nota Crédito',
      width: '160px',
      render: (_val, row) => (
        <span className="text-xs font-black font-mono text-primary">
          NC-{((row as any).number || row.id.slice(0, 8)).toUpperCase()}
        </span>
      )
    },
    {
      key: 'customer',
      header: 'Cliente',
      render: (_val, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Cliente'}</span>
    },
    {
      key: 'invoiceId',
      header: 'Factura Origen',
      render: (val) => <span className="text-xs font-bold text-muted-foreground">{val || 'Sin referencia'}</span>
    },
    {
      key: 'date',
      header: 'Fecha Emisión',
      render: (val) => <span className="text-xs font-medium text-muted-foreground">{new Date(val).toLocaleDateString()}</span>
    },
    {
      key: 'total',
      header: 'Monto Crédito',
      width: '150px',
      render: (val) => (
        <span className="text-[13px] font-black tabular-nums text-blue-500">
          ${Number(val || 0).toLocaleString()}
        </span>
      )
    },
    {
      key: 'reason',
      header: 'Motivo',
      render: (val) => (
        <span className="text-xs text-muted-foreground line-clamp-1 max-w-[180px]">{val || '—'}</span>
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
        const opt = statusOptions.find(o => o.value === (val || '').toUpperCase());
        return (
          <Badge variant="outline" className={cn(
            'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none',
            opt?.color || 'bg-muted/20 text-muted-foreground'
          )}>
            {opt?.label || val}
          </Badge>
        );
      }
    }
  ];

  const kpis = [
    { title: 'Crédito Total',    value: `$${approved.reduce((acc, d) => acc + Number(d.total || 0), 0).toLocaleString()}`, icon: FileMinus,    color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Notas Emitidas',   value: approved.length,                                                                   icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Pendientes',       value: data.filter(d => (d.status || '').toUpperCase() === 'PENDING').length,             icon: Clock,        color: 'text-amber-500',  bg: 'bg-amber-500/10'   },
    { title: 'Rechazadas',       value: data.filter(d => (d.status || '').toUpperCase() === 'REJECTED').length,            icon: AlertTriangle, color: 'text-rose-500',   bg: 'bg-rose-500/10'    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className={cn('p-3 rounded-xl shadow-inner', kpi.bg, kpi.color)}>
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
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Notas de Crédito</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">
              Ajustes de saldo derivados de devoluciones aprobadas.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input
                placeholder="Buscar nota de crédito..."
                className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold uppercase tracking-widest"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button
              onClick={handleAddCreditNote}
              className="bg-blue-500 hover:bg-blue-600 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-blue-500/20 border border-blue-500/20"
            >
              <Plus className="size-4" /> Nueva Nota
            </Button>
          </div>
        </div>

        {filtered.length === 0 && !loading ? (
          <Card className="rounded-2xl border-border/50 bg-card/50">
            <CardContent className="p-12 flex flex-col items-center gap-4">
              <div className="p-5 bg-blue-500/10 rounded-full">
                <FileMinus className="size-10 text-blue-500" />
              </div>
              <div className="text-center">
                <p className="text-base font-black uppercase tracking-tighter">Sin notas de crédito</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Las devoluciones aprobadas generan notas de crédito automáticamente.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <EditableDataTable
            data={filtered}
          onBulkDelete={async (ids) => {
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await salesReturnsService.delete(id as string);
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
                <Button
                  title="Ver detalle"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                  onClick={() => setEditingId(row.id)}
                >
                  <Eye className="size-4" />
                </Button>
                <Button
                  title="Eliminar"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                  onClick={async () => { await salesReturnsService.delete(row.id); onRefresh(); }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
