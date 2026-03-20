import React, { useState } from 'react';
import { Wallet, Plus, Search, Eye, Trash2, TrendingDown, Clock, Tag } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { expensesService } from '../../services/compras.service';
import type { Expense } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';

interface GastosViewProps { data: Expense[]; loading: boolean; onRefresh: () => void; }

export function GastosView({ data, loading, onRefresh }: GastosViewProps) {
  const { exchangeRate: globalRate } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const filtered = data.filter(e =>
    (e.description||'').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusOpts = [
    { label: 'Pendiente', value: 'PENDING', color: 'bg-amber-500/10 text-amber-500' },
    { label: 'Aprobado',  value: 'APPROVED', color: 'bg-blue-500/10 text-blue-500' },
    { label: 'Pagado',    value: 'PAID',    color: 'bg-emerald-500/10 text-emerald-500' },
    { label: 'Rechazado', value: 'REJECTED', color: 'bg-rose-500/10 text-rose-500' },
  ];

  const columns: ColumnDef<Expense>[] = [
    { key: 'number',      header: 'Número',      width: '110px' },
    { key: 'description', header: 'Descripción', editable: true },
    { key: 'category',    header: 'Categoría',   width: '120px', editable: true,
      render: (val) => <Badge variant="outline" className="text-[9px] uppercase tracking-widest bg-blue-500/10 text-blue-500 border-none">{val||'-'}</Badge>
    },
    { key: 'amount', header: 'Monto', width: '130px',
      render: (val, row) => <span className="font-black tabular-nums text-rose-500">{row.currency === 'NIO' ? `C$ ${Number(val||0).toLocaleString()}` : `$ ${Number(val||0).toLocaleString()}`}</span>
    },
    { key: 'date', header: 'Fecha', width: '120px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span>
    },
    { key: 'status', header: 'Estado', width: '120px', editable: true, type: 'select', options: statusOpts,
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; }
    },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Expense>) => {
    try { await expensesService.update(id as string, updates); toast.success('Gasto actualizado'); onRefresh(); }
    catch { toast.error('Error al actualizar'); }
  };

  const handleAdd = async () => {
    try {
      await expensesService.create({ accountId: 'temp-account-id', description: 'Nuevo gasto', amount: 0, currency: 'NIO', exchangeRate: globalRate, date: new Date().toISOString() });
      toast.success('Gasto registrado'); onRefresh();
    } catch { toast.error('Error al registrar gasto'); }
  };

  const kpis = [
    { title: 'Total Gastos (NIO)',  value: `C$ ${data.reduce((a, e) => a + (e.baseAmount || (e.currency === 'USD' ? e.amount * globalRate : e.amount)), 0).toLocaleString()}`, icon: TrendingDown, color: 'text-rose-500',   bg: 'bg-rose-500/10'   },
    { title: 'Pendientes',    value: data.filter(e => (e.status||'').toUpperCase() === 'PENDING').length,                                                       icon: Clock,        color: 'text-amber-500', bg: 'bg-amber-500/10'  },
    { title: 'Pagados',       value: data.filter(e => (e.status||'').toUpperCase() === 'PAID').length,                                                          icon: Wallet,       color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Categorías',    value: new Set(data.map(e => e.category)).size,                                                                                 icon: Tag,          color: 'text-blue-500',  bg: 'bg-blue-500/10'   },
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
          <div><h2 className="text-xl font-black uppercase tracking-tight">Gastos</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Registro de gastos operativos</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={handleAdd} className="bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Registrar Gasto</Button>
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading}
          onBulkDelete={async (ids) => {
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await expensesService.delete(id as string);
              }
              toast.success('Elementos eliminados');
              onRefresh();
            } catch (e) {
              toast.error('Error al eliminar');
            }
          }}
          actions={(row) => (
            <div className="flex gap-1">
              <Button title="Ver" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => toast.info(`${row.description||'Gasto'} | $${Number(row.amount||0).toLocaleString()} | ${row.status}`)}><Eye className="size-4" /></Button>
              <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={async () => { await expensesService.delete(row.id); onRefresh(); }}><Trash2 className="size-4" /></Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
