import React, { useState } from 'react';
import { BadgeDollarSign, Plus, Search, Eye, CheckCircle2, TrendingUp, Clock, Hash } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { vendorCreditsService } from '../../services/compras.service';
import type { SupplierCredit } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { cn } from '../ui/utils';

interface Props { data: SupplierCredit[]; loading: boolean; onRefresh: () => void; }

export function CreditosProveedorView({ data, loading, onRefresh }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const filtered = data.filter(c =>
    (c.number||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.supplier?.name||'').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusOpts = [
    { label: 'Borrador',  value: 'draft',   color: 'bg-muted/20 text-muted-foreground' },
    { label: 'Emitido',   value: 'issued',  color: 'bg-blue-500/10 text-blue-500' },
    { label: 'Aplicado',  value: 'applied', color: 'bg-emerald-500/10 text-emerald-500' },
    { label: 'Anulado',   value: 'voided',  color: 'bg-rose-500/10 text-rose-500' },
  ];

  const columns: ColumnDef<SupplierCredit>[] = [
    { key: 'number',   header: 'Nota #',     width: '120px',
      render: (_v, row) => <span className="font-black font-mono text-primary text-xs">{row.number||row.id?.slice(0,8)}</span> },
    { key: 'supplier', header: 'Proveedor',
      render: (_v, row) => <span className="font-bold text-sm">{row.supplier?.name||'-'}</span> },
    { key: 'date',     header: 'Fecha',      width: '110px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'total',    header: 'Total',      width: '120px',
      render: (val) => <span className="font-black tabular-nums">${Number(val||0).toLocaleString()}</span> },
    { key: 'status',   header: 'Estado',     width: '110px', editable: true, type: 'select', options: statusOpts,
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toLowerCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<SupplierCredit>) => {
    try { await vendorCreditsService.update(id as string, updates); toast.success('Crédito actualizado'); onRefresh(); }
    catch { toast.error('Error al actualizar'); }
  };

  const handleAdd = async () => {
    try {
      await vendorCreditsService.create({ supplierId: data[0]?.supplierId || 'temp-supplier-id', total: 0, date: new Date().toISOString(), reason: 'Nuevo crédito' } as any);
      toast.success('Crédito creado'); onRefresh();
    } catch { toast.error('Error al crear'); }
  };

  const disponible = data.filter(c => (c.status||'') === 'issued').reduce((a,c) => a+Number(c.total||0), 0);
  const kpis = [
    { title: 'Crédito Disponible', value: `$${disponible.toLocaleString()}`,                                                icon: TrendingUp,      color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Total Notas',        value: data.length,                                                                         icon: Hash,            color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Emitidas',           value: data.filter(c => (c.status||'') === 'issued').length,                                icon: BadgeDollarSign, color: 'text-purple-500',  bg: 'bg-purple-500/10'  },
    { title: 'Aplicadas',          value: data.filter(c => (c.status||'') === 'applied').length,                              icon: CheckCircle2,    color: 'text-muted-foreground', bg: 'bg-muted/10'   },
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
          <div><h2 className="text-xl font-black uppercase tracking-tight">Créditos de Proveedor</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Notas de crédito y saldos a favor</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={handleAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nuevo Crédito</Button>
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading}
          onBulkDelete={async (ids) => {
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await supplierCreditsService.delete(id as string);
              }
              toast.success('Elementos eliminados');
              onRefresh();
            } catch (e) {
              toast.error('Error al eliminar');
            }
          }}
          actions={(row) => (
            <Button title="Ver" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary"
              onClick={() => toast.info(`${row.number||'NC'} | ${row.supplier?.name||'N/A'} | Total: $${Number(row.total||0).toLocaleString()}`)}>
              <Eye className="size-4" />
            </Button>
          )}
        />
      </div>
    </div>
  );
}
