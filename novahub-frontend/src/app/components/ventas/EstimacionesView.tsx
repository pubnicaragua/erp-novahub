import React, { useState } from 'react';
import { 
  FileSpreadsheet, Plus, Search, TrendingUp, Clock, CheckCircle2, FilePlus, Eye, Trash2, ChevronLeft
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { estimatesService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import type { Estimate } from '../../types';
import { Badge } from '../ui/badge';

interface EstimacionesViewProps {
  data: Estimate[];
  loading: boolean;
  onRefresh: () => void;
}

const statusOptions = [
  { label: 'Borrador',  value: 'DRAFT',     color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Enviada',  value: 'SENT',      color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Aprobada', value: 'APPROVED',  color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Rechazada',value: 'REJECTED',  color: 'bg-rose-500/10 text-rose-500' },
  { label: 'Cancelada',value: 'CANCELLED', color: 'bg-muted/20 text-muted-foreground' },
];

export function EstimacionesView({ data, loading, onRefresh }: EstimacionesViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = data.filter(e => 
    e.number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (e.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdate = async (id: string | number, updates: Partial<Estimate>) => {
    try {
      await estimatesService.update(id.toString(), updates);
      toast.success('Cotización actualizada');
      onRefresh();
    } catch (error) {
      toast.error('Error al actualizar');
      throw error;
    }
  };

  const handleAddEstimate = async () => {
    try {
      await estimatesService.create({
        customerId: data[0]?.customerId || 'temp-customer-id',
        date: new Date().toISOString(),
        items: [],
        notes: 'Nueva cotización',
        number: `COT-${Date.now().toString().slice(-6)}`,
        subtotal: 0, 
        taxAmount: 0, 
        discountAmount: 0, 
        total: 0,
        expiryDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        status: 'DRAFT' as any,
        currency: 'USD',
      } as any);
      toast.success('Nueva cotización creada - doble clic para editar');
      onRefresh();
    } catch (e) { toast.error('Error al crear cotización'); }
  };

  const handleConvert = async (row: Estimate) => {
    try {
      await estimatesService.convertToOrder(row.id);
      toast.success(`Cotización ${row.number} convertida a orden`);
      onRefresh();
    } catch (e) { toast.error('Error al convertir'); }
  };

  const columns: ColumnDef<Estimate>[] = [
    { 
      key: 'number', 
      header: 'Número', 
      width: '140px',
      render: (val, row) => (
        <span 
          className="text-xs font-black font-mono text-primary cursor-pointer hover:underline"
          onClick={() => setEditingId(row.id)}
        >
          {val}
        </span>
      )
    },
    { 
      key: 'customerId', 
      header: 'Cliente', 
      render: (val, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Varios'}</span>
    },
    { 
      key: 'date', 
      header: 'Fecha Emisión', 
      render: (val) => <span className="text-xs font-medium text-muted-foreground">{new Date(val).toLocaleDateString()}</span>
    },
    { 
      key: 'total', 
      header: 'Total Neto', 
      width: '150px',
      render: (val) => (
        <span className="text-[13px] font-black tabular-nums text-foreground">
          ${val.toLocaleString()}
        </span>
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
      key: 'expiryDate', 
      header: 'Validez', 
      render: (val) => (
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
           <Clock className="size-3" />
           {new Date(val).toLocaleDateString()}
        </div>
      )
    }
  ];

  const kpis = [
    { title: 'Total Cotizado', value: `$${data.reduce((acc, e) => acc + Number(e.total || 0), 0).toLocaleString()}`, icon: FileSpreadsheet, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Tasa Conversión', value: `${((data.filter(e => (e.status||'').toUpperCase() === 'APPROVED').length / (data.length || 1)) * 100).toFixed(0)}%`, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Enviadas', value: data.filter(e => (e.status||'').toUpperCase() === 'SENT').length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { title: 'Aprobadas', value: data.filter(e => (e.status||'').toUpperCase() === 'APPROVED').length, icon: CheckCircle2, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

  if (editingId) {
    const est = data.find(e => e.id === editingId);
    const statusOpt = statusOptions.find(o => o.value === (est?.status || '').toUpperCase());
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setEditingId(null)} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Cotización {est?.number}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Detalle de la cotización comercial</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="rounded-xl border-border/50 font-black uppercase text-[10px] tracking-widest px-6"
              onClick={() => { handleUpdate(est!.id, { status: 'DRAFT' as any }); setEditingId(null); }}>
              Guardar Borrador
            </Button>
            <Button className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6"
              onClick={() => { handleUpdate(est!.id, { status: 'SENT' as any }); setEditingId(null); toast.success('Cotización enviada'); }}>
              Marcar como Enviada
            </Button>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-[10px] text-muted-foreground">Número</p><p className="font-black">{est?.number}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Estado</p>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${statusOpt?.color || 'bg-muted/20 text-muted-foreground'}`}>{statusOpt?.label || est?.status}</span>
                </div>
                <div><p className="text-[10px] text-muted-foreground">Cliente</p><p className="font-bold">{est?.customer?.name || 'Sin asignar'}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Fecha</p><p className="font-bold">{est?.date ? new Date(est.date).toLocaleDateString() : '-'}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Válida hasta</p><p className="font-bold">{est?.expiryDate ? new Date(est.expiryDate).toLocaleDateString() : '-'}</p></div>
                <div><p className="text-[10px] text-muted-foreground">Moneda</p><p className="font-bold">{est?.currency || 'USD'}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumen Financiero</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="font-bold">${Number(est?.subtotal||0).toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Descuento</span><span className="font-bold text-rose-500">-${Number(est?.discountAmount||0).toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Impuesto (IVA)</span><span className="font-bold">${Number(est?.taxAmount||0).toLocaleString()}</span></div>
                <div className="flex justify-between text-base border-t pt-2 border-border/50"><span className="font-black">Total</span><span className="font-black text-primary">${Number(est?.total||0).toLocaleString()}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>
        {est?.notes && (
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Notas</p><p className="text-sm">{est.notes}</p></CardContent>
          </Card>
        )}
      </div>
    );
  }

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
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Estimaciones & Cotizaciones</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Negociaciones en tiempo real sin modals ni esperas.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input 
                placeholder="Buscar cotización..." 
                className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold uppercase tracking-widest"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button onClick={handleAddEstimate} className="bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-emerald-500/20 border border-emerald-500/20">
              <Plus className="size-4" /> Nueva Cotización
            </Button>
          </div>
        </div>

        <EditableDataTable 
          data={filtered}
          onBulkDelete={async (ids) => {
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await estimatesService.delete(id as string);
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
               <Button title="Convertir a Orden" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors" onClick={() => handleConvert(row)}><FilePlus className="size-4" /></Button>
               <Button title="Ver detalle" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
               <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 transition-colors" onClick={async () => { await estimatesService.delete(row.id); onRefresh(); }}><Trash2 className="size-4" /></Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
