import React, { useState } from 'react';
import { ClipboardList, Plus, Search, Eye, Trash2, CheckCircle2, Clock, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { purchaseOrdersService } from '../../services/compras.service';
import type { PurchaseOrder } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';

interface Props { data: PurchaseOrder[]; loading: boolean; onRefresh: () => void; }

export function OrdenesCompraView({ data, loading, onRefresh }: Props) {
  const { exchangeRate: globalRate } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const filtered = data.filter(o =>
    (o.number||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.supplier?.name||'').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusOpts = [
    { label: 'Borrador',   value: 'DRAFT',      color: 'bg-muted/20 text-muted-foreground' },
    { label: 'Enviada',    value: 'SENT',       color: 'bg-blue-500/10 text-blue-500' },
    { label: 'Aprobada',   value: 'APPROVED',   color: 'bg-emerald-500/10 text-emerald-500' },
    { label: 'Recibida',   value: 'RECEIVED',   color: 'bg-purple-500/10 text-purple-500' },
    { label: 'Cancelada',  value: 'CANCELLED',  color: 'bg-rose-500/10 text-rose-500' },
  ];

  const columns: ColumnDef<PurchaseOrder>[] = [
    { key: 'number',   header: 'Número',   width: '120px',
      render: (val) => <span className="font-black font-mono text-primary text-xs">{val}</span> },
    { key: 'supplier', header: 'Proveedor',
      render: (_v, row) => <span className="font-bold text-sm">{row.supplier?.name||'-'}</span> },
    { key: 'date',     header: 'Fecha',     width: '110px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'total',    header: 'Total',     width: '130px',
      render: (val, row) => <span className="font-black tabular-nums text-foreground">{row.currency === 'NIO' ? `C$ ${Number(val||0).toLocaleString()}` : `$ ${Number(val||0).toLocaleString()}`}</span> },
    { key: 'status',   header: 'Estado',    width: '120px', editable: true, type: 'select', options: statusOpts,
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<PurchaseOrder>) => {
    try { await purchaseOrdersService.update(id as string, updates); toast.success('Orden actualizada'); onRefresh(); }
    catch { toast.error('Error al actualizar'); }
  };

  const handleAdd = async () => {
    try {
      await purchaseOrdersService.create({ supplierId: data[0]?.supplierId || 'temp-supplier-id', currency: 'NIO', exchangeRate: globalRate, date: new Date().toISOString(), items: [] });
      toast.success('Orden de compra creada'); onRefresh();
    } catch { toast.error('Error al crear orden'); }
  };

  const kpis = [
    { title: 'Total Ordenes',   value: data.length,                                                                     icon: ClipboardList, color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Por Aprobar',     value: data.filter(o => (o.status||'').toUpperCase() === 'SENT').length,                 icon: Clock,         color: 'text-amber-500',  bg: 'bg-amber-500/10'   },
    { title: 'Aprobadas',       value: data.filter(o => (o.status||'').toUpperCase() === 'APPROVED').length,             icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Monto Total (NIO)', value: `C$ ${data.reduce((a,o) => a + (o.baseTotal || (o.currency === 'USD' ? o.total * globalRate : o.total)), 0).toLocaleString()}`,             icon: TrendingDown,  color: 'text-rose-500',   bg: 'bg-rose-500/10'    },
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
          <div><h2 className="text-xl font-black uppercase tracking-tight">Órdenes de Compra</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Pedidos a proveedores</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={handleAdd} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nueva Orden</Button>
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading}
          onBulkDelete={async (ids) => {
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await purchaseOrdersService.delete(id as string);
              }
              toast.success('Elementos eliminados');
              onRefresh();
            } catch (e) {
              toast.error('Error al eliminar');
            }
          }}
          actions={(row) => (
            <div className="flex gap-1">
              <Button title="Ver" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => toast.info(`${row.number} | ${row.supplier?.name||'N/A'} | $${Number(row.total||0).toLocaleString()}`)}><Eye className="size-4" /></Button>
              <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={async () => { try { await purchaseOrdersService.update(row.id, { status: 'CANCELLED' as any }); onRefresh(); } catch { toast.error('Error'); } }}><Trash2 className="size-4" /></Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
