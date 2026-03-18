import React, { useState } from 'react';
import { PackageCheck, Plus, Search, Eye, Truck, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { purchaseReceiptsService } from '../../services/compras.service';
import type { PurchaseReceipt } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { cn } from '../ui/utils';

interface Props { data: PurchaseReceipt[]; loading: boolean; onRefresh: () => void; }

export function RecepcionesCompraView({ data, loading, onRefresh }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const filtered = data.filter(r =>
    (r.number||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.supplier?.name||'').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusOpts = [
    { label: 'Pendiente', value: 'pending',  color: 'bg-amber-500/10 text-amber-500' },
    { label: 'Parcial',   value: 'partial',  color: 'bg-blue-500/10 text-blue-500' },
    { label: 'Recibido',  value: 'received', color: 'bg-emerald-500/10 text-emerald-500' },
    { label: 'Rechazado', value: 'rejected', color: 'bg-rose-500/10 text-rose-500' },
  ];

  const columns: ColumnDef<PurchaseReceipt>[] = [
    { key: 'number',   header: 'Número',   width: '120px',
      render: (val) => <span className="font-black font-mono text-primary text-xs">{val||'-'}</span> },
    { key: 'supplier', header: 'Proveedor',
      render: (_v, row) => <span className="font-bold text-sm">{row.supplier?.name||'-'}</span> },
    { key: 'date',     header: 'Fecha Rec.', width: '110px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'notes',    header: 'Notas',
      render: (val) => <span className="text-xs text-muted-foreground truncate max-w-xs">{val||'-'}</span> },
    { key: 'status',   header: 'Estado',    width: '120px', editable: true, type: 'select', options: statusOpts,
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toLowerCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<PurchaseReceipt>) => {
    try { toast.success('Recepción actualizada'); onRefresh(); } catch { toast.error('Error'); }
  };

  const handleAdd = async () => {
    try {
      await purchaseReceiptsService.create({ purchaseOrderId: data[0]?.purchaseOrderId || 'temp-order-id', date: new Date().toISOString(), items: [] });
      toast.success('Recepción registrada'); onRefresh();
    } catch { toast.error('Error al registrar'); }
  };

  const kpis = [
    { title: 'Total',      value: data.length,                                                     icon: PackageCheck, color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Pendientes', value: data.filter(r => r.status === 'pending').length,                 icon: Clock,        color: 'text-amber-500',  bg: 'bg-amber-500/10'   },
    { title: 'Recibidas',  value: data.filter(r => r.status === 'received').length,                icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Parciales',  value: data.filter(r => r.status === 'partial').length,                 icon: Truck,        color: 'text-purple-500', bg: 'bg-purple-500/10'  },
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
          <div><h2 className="text-xl font-black uppercase tracking-tight">Recepciones de Compra</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Entrada de mercancía</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={handleAdd} className="bg-purple-600 hover:bg-purple-700 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Registrar Entrada</Button>
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading}
          onBulkDelete={async (ids) => {
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await purchaseReceiptsService.delete(id as string);
              }
              toast.success('Elementos eliminados');
              onRefresh();
            } catch (e) {
              toast.error('Error al eliminar');
            }
          }}
          actions={(row) => (
            <Button title="Ver" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary"
              onClick={() => toast.info(`Recepción ${row.number} | ${row.supplier?.name||'N/A'} | ${row.status}`)}>
              <Eye className="size-4" />
            </Button>
          )}
        />
      </div>
    </div>
  );
}
