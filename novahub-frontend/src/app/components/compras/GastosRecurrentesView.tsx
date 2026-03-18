import React, { useState } from 'react';
import { CalendarClock, Plus, Search, Eye, RotateCcw, TrendingDown, Clock } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { recurringExpensesService } from '../../services/compras.service';
import type { RecurringExpense } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { cn } from '../ui/utils';

interface Props { data: RecurringExpense[]; loading: boolean; onRefresh: () => void; }

export function GastosRecurrentesView({ data, loading, onRefresh }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const filtered = data.filter(e => (e.description||'').toLowerCase().includes(searchTerm.toLowerCase()));

  const freqOpts = [
    { label: 'Semanal', value: 'WEEKLY' }, { label: 'Mensual', value: 'MONTHLY' },
    { label: 'Trimestral', value: 'QUARTERLY' }, { label: 'Anual', value: 'YEARLY' },
  ];
  const freqMap: Record<string,string> = { WEEKLY:'Semanal', MONTHLY:'Mensual', QUARTERLY:'Trimestral', YEARLY:'Anual' };
  const statusOpts = [
    { label: 'Activo',     value: 'ACTIVE',    color: 'bg-emerald-500/10 text-emerald-500' },
    { label: 'Pausado',    value: 'PAUSED',    color: 'bg-amber-500/10 text-amber-500' },
    { label: 'Finalizado', value: 'CANCELLED', color: 'bg-muted/20 text-muted-foreground' },
  ];

  const columns: ColumnDef<RecurringExpense>[] = [
    { key: 'description', header: 'Descripción', editable: true },
    { key: 'amount',      header: 'Monto',       width: '130px',
      render: (val) => <span className="font-black tabular-nums text-rose-500">${Number(val||0).toLocaleString()}</span> },
    { key: 'frequency',   header: 'Frecuencia',  width: '120px', editable: true, type: 'select', options: freqOpts,
      render: (val) => <Badge variant="outline" className="text-[9px] uppercase bg-blue-500/10 text-blue-500 border-none">{freqMap[(val||'').toUpperCase()]||val}</Badge> },
    { key: 'startDate',   header: 'Inicio',      width: '110px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'status',      header: 'Estado',      width: '110px', editable: true, type: 'select', options: statusOpts,
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<RecurringExpense>) => {
    try { toast.success('Actualizado'); onRefresh(); } catch { toast.error('Error'); }
  };

  const handleAdd = async () => {
    try {
      await recurringExpensesService.create({ accountId: 'temp-account-id', description: 'Gasto recurrente', amount: 0, frequency: 'MONTHLY', startDate: new Date().toISOString() });
      toast.success('Gasto recurrente creado'); onRefresh();
    } catch { toast.error('Error al crear'); }
  };

  const monthly = data.filter(e => (e.frequency||'').toUpperCase() === 'MONTHLY').reduce((a,e) => a + Number(e.amount||0), 0);
  const kpis = [
    { title: 'Total Recurrentes', value: data.length,                                                            icon: CalendarClock, color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Activos',           value: data.filter(e => (e.status||'').toUpperCase() === 'ACTIVE').length,     icon: RotateCcw,     color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Mensual Estimado',  value: `$${monthly.toLocaleString()}`,                                          icon: TrendingDown,  color: 'text-rose-500',   bg: 'bg-rose-500/10'    },
    { title: 'Pendientes',        value: data.filter(e => (e.status||'').toUpperCase() === 'PAUSED').length,     icon: Clock,         color: 'text-amber-500',  bg: 'bg-amber-500/10'   },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <Card key={i} className="bg-card border-border/50 rounded-2xl shadow-sm">
            <CardContent className="p-5"><div className="flex items-center gap-4">
              <div className={cn('p-3 rounded-xl', k.bg, k.color)}><k.icon className="size-5" /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{k.title}</p><p className="text-2xl font-black tabular-nums">{k.value}</p></div>
            </div></CardContent>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight">Gastos Recurrentes</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Compromisos fijos periódicos</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nuevo Recurrente</Button>
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading}
          onBulkDelete={async (ids) => {
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await recurringExpensesService.delete(id as string);
              }
              toast.success('Elementos eliminados');
              onRefresh();
            } catch (e) {
              toast.error('Error al eliminar');
            }
          }}
          actions={(row) => (
            <div className="flex gap-1">
              <Button title="Ver" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => toast.info(`${row.description} | $${Number(row.amount||0).toLocaleString()} | ${row.frequency}`)}><Eye className="size-4" /></Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
