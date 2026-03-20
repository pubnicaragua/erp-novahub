import React, { useState } from 'react';
import { Banknote, Plus, Search, Eye, CheckCircle2, Wallet, TrendingDown, Hash } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { paymentsService } from '../../services/compras.service';
import type { PaymentMade } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';

interface Props { data: PaymentMade[]; loading: boolean; onRefresh: () => void; }

export function PagosRealizadosView({ data, loading, onRefresh }: Props) {
  const { exchangeRate: globalRate } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const filtered = data.filter(p =>
    (p.reference||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.supplier?.name||'').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const methodOpts = [
    { label: 'Transferencia', value: 'TRANSFER' },
    { label: 'Efectivo',      value: 'CASH' },
    { label: 'Cheque',        value: 'CHECK' },
    { label: 'Tarjeta',       value: 'CARD' },
  ];

  const columns: ColumnDef<PaymentMade>[] = [
    { key: 'reference', header: 'Referencia', width: '130px', editable: true },
    { key: 'supplier',  header: 'Proveedor',
      render: (_v, row) => <span className="font-bold text-sm">{row.supplier?.name||'-'}</span> },
    { key: 'date',      header: 'Fecha',      width: '110px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'amount',    header: 'Monto',      width: '130px',
      render: (val, row) => <span className="font-black tabular-nums text-emerald-500">{row.currency === 'NIO' ? `C$ ${Number(val||0).toLocaleString()}` : `$ ${Number(val||0).toLocaleString()}`}</span> },
    { key: 'method',    header: 'Método',     width: '120px', editable: true, type: 'select', options: methodOpts,
      render: (val) => <Badge variant="outline" className="text-[9px] uppercase bg-blue-500/10 text-blue-500 border-none">{val||'-'}</Badge> },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<PaymentMade>) => {
    try { await paymentsService.update(id as string, updates); toast.success('Pago actualizado'); onRefresh(); }
    catch { toast.error('Error al actualizar'); }
  };

  const handleAdd = async () => {
    try {
      await paymentsService.create({ supplierId: data[0]?.supplierId || 'temp-supplier-id', amount: 0, currency: 'NIO', exchangeRate: globalRate, date: new Date().toISOString(), method: 'transfer' } as any);
      toast.success('Pago registrado'); onRefresh();
    } catch { toast.error('Error al registrar'); }
  };

  const total = data.reduce((a, p) => a + (p.baseAmount || (p.currency === 'USD' ? p.amount * globalRate : p.amount)), 0);
  const totalNio = `C$ ${total.toLocaleString()}`;
  const kpis = [
    { title: 'Total Pagado (NIO)',    value: totalNio,  icon: TrendingDown, color: 'text-rose-500',   bg: 'bg-rose-500/10'    },
    { title: 'Transacciones',   value: data.length,                   icon: Hash,         color: 'text-blue-500',   bg: 'bg-blue-500/10'    },
    { title: 'Este Mes (NIO)',        value: `C$ ${data.filter(p => { const d=new Date(p.date||p.createdAt); return d.getMonth()===new Date().getMonth(); }).reduce((a,p) => a + (p.baseAmount || (p.currency === 'USD' ? p.amount * globalRate : p.amount)), 0).toLocaleString()}`, icon: Wallet, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Conciliados',     value: data.length,                   icon: CheckCircle2, color: 'text-purple-500', bg: 'bg-purple-500/10'  },
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
          <div><h2 className="text-xl font-black uppercase tracking-tight">Pagos Realizados</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Desembolsos a proveedores</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={handleAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Registrar Pago</Button>
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading}
          onBulkDelete={async (ids) => {
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await paymentsService.delete(id as string); // Assuming paymentsService is the correct one for deleting payments
              }
              toast.success('Elementos eliminados');
              onRefresh();
            } catch (e) {
              toast.error('Error al eliminar');
            }
          }}
          actions={(row) => (
            <Button title="Ver" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary"
              onClick={() => toast.info(`${row.reference||'PAG'} | ${row.supplier?.name||'N/A'} | $${Number(row.amount||0).toLocaleString()}`)}>
              <Eye className="size-4" />
            </Button>
          )}
        />
      </div>
    </div>
  );
}
