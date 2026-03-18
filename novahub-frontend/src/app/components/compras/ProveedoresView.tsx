import React, { useState } from 'react';
import { Truck, Plus, Search, Eye, Trash2, Star, TrendingDown, CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { suppliersService } from '../../services/compras.service';
import type { Supplier } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { cn } from '../ui/utils';

interface ProveedoresViewProps { data: Supplier[]; loading: boolean; onRefresh: () => void; }

export function ProveedoresView({ data, loading, onRefresh }: ProveedoresViewProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = data.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusOptions = [
    { label: 'Activo',   value: 'ACTIVE',   color: 'bg-emerald-500/10 text-emerald-500' },
    { label: 'Inactivo', value: 'INACTIVE', color: 'bg-muted/20 text-muted-foreground' },
  ];

  const columns: ColumnDef<Supplier>[] = [
    { key: 'code',        header: 'Código',    width: '110px', editable: true },
    { key: 'name',        header: 'Nombre',    editable: true },
    { key: 'contactName', header: 'Contacto',  editable: true },
    { key: 'email',       header: 'Email',     editable: true },
    { key: 'phone',       header: 'Teléfono',  width: '130px', editable: true },
    { key: 'balance', header: 'Saldo', width: '130px',
      render: (val) => <span className="font-black text-rose-500 tabular-nums">${Number(val||0).toLocaleString()}</span>
    },
    { key: 'status', header: 'Estado', width: '120px', editable: true, type: 'select', options: statusOptions,
      render: (val) => {
        const opt = statusOptions.find(o => o.value === (val||'').toUpperCase());
        return <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none', opt?.color || 'bg-muted/20 text-muted-foreground')}>{opt?.label || val}</Badge>;
      }
    },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Supplier>) => {
    try { await suppliersService.update(id as string, updates); toast.success('Proveedor actualizado'); onRefresh(); }
    catch { toast.error('Error al actualizar'); }
  };

  const handleAdd = async () => {
    try {
      await suppliersService.create({ name: 'Nuevo Proveedor' });
      toast.success('Proveedor creado'); onRefresh();
    } catch { toast.error('Error al crear proveedor'); }
  };

  const kpis = [
    { title: 'Total',     value: data.length,                                                                              icon: Truck,         color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Activos',   value: data.filter(s => (s.status||'').toUpperCase() === 'ACTIVE').length,                       icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Saldo Total', value: `$${data.reduce((a, s) => a + Number(s.balance||0), 0).toLocaleString()}`,              icon: TrendingDown,  color: 'text-rose-500',    bg: 'bg-rose-500/10'    },
    { title: 'Rating Prom.', value: data.length ? (data.reduce((a, s) => a + Number(s.rating||0), 0) / data.length).toFixed(1) : '0', icon: Star, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <Card key={i} className="bg-card border-border/50 rounded-2xl shadow-sm">
            <CardContent className="p-5"><div className="flex items-center gap-4">
              <div className={cn('p-3 rounded-xl', k.bg, k.color)}><k.icon className="size-5" /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{k.title}</p>
                <p className="text-2xl font-black tabular-nums">{k.value}</p>
              </div>
            </div></CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight">Proveedores</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Directorio de proveedores y aliados</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input placeholder="Buscar proveedor..." className="pl-9 h-10 w-60 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <Button onClick={handleAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2">
              <Plus className="size-4" /> Nuevo Proveedor
            </Button>
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading}
          actions={(row) => (
            <div className="flex gap-1">
              <Button title="Ver" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => toast.info(`${row.name} | ${row.email||'N/A'} | Saldo: $${Number(row.balance||0).toLocaleString()}`)}><Eye className="size-4" /></Button>
              <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={async () => { await suppliersService.delete(row.id); onRefresh(); }}><Trash2 className="size-4" /></Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
