import React, { useState, useEffect } from 'react';
import { 
  Wallet, Plus, Search, Eye, Trash2, TrendingDown, Clock, Tag, ChevronLeft
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { expensesService, suppliersService } from '../../services/compras.service';
import type { Expense, Supplier } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';

interface Props { data: Expense[]; loading: boolean; onRefresh: () => void; }

const statusOpts = [
  { label: 'Pendiente', value: 'PENDING',  color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Aprobado',  value: 'APPROVED', color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Pagado',    value: 'PAID',     color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Rechazado', value: 'REJECTED', color: 'bg-rose-500/10 text-rose-500' },
];

export function GastosView({ data, loading, onRefresh }: Props) {
  const { exchangeRate: globalRate } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<Expense> | null>(null);

  useEffect(() => {
    suppliersService.getAll().then(res => {
      const list = Array.isArray(res) ? res : (res as any).data || [];
      setSuppliers(list);
    }).catch();
  }, []);

  useEffect(() => {
    if (editingId) {
      if (editingId === 'NEW') {
         setLocalDoc({
           date: new Date().toISOString(),
           amount: 0,
           currency: 'NIO',
           exchangeRate: globalRate,
           category: 'OPERACIONAL',
           description: '',
           status: 'PENDING',
           accountId: 'dummy-account-id',
         });
      } else {
         const found = data.find(x => x.id === editingId);
         setLocalDoc(found ? JSON.parse(JSON.stringify(found)) : null);
      }
    } else {
      setLocalDoc(null);
    }
  }, [editingId, data, globalRate]);

  const filtered = data.filter(g =>
    (g.description||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (g.category||'').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: ColumnDef<Expense>[] = [
    { key: 'date',        header: 'Fecha',     width: '110px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'category',    header: 'Categoría', width: '130px', editable: true, type: 'select', options: [
        {label: 'Operacional', value: 'OPERATIVO'}, {label: 'Administrativo', value: 'ADMINISTRATIVO'}, {label: 'Ventas', value: 'VENTAS'}, {label: 'Financiero', value: 'FINANCIERO'}, {label: 'Otro', value: 'OTRO'}
      ],
      render: (val) => <Badge variant="outline" className="text-[9px] uppercase bg-primary/5 text-primary border-none">{val||'-'}</Badge> },
    { key: 'description', header: 'Descripción', editable: true },
    { key: 'amount',      header: 'Monto',     width: '130px',
      render: (val, row) => <span className="font-black tabular-nums text-rose-500">{row.currency === 'NIO' ? `C$ ${Number(val||0).toLocaleString()}` : `$ ${Number(val||0).toLocaleString()}`}</span> },
    { key: 'status',      header: 'Estado',    width: '120px', editable: true, type: 'select', options: statusOpts,
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Expense>) => {
    try { await expensesService.update(id as string, updates); toast.success('Gasto actualizado'); onRefresh(); }
    catch { toast.error('Error al actualizar'); throw new Error('Update failed'); }
  };

  const handleSaveDoc = async () => {
    if (!localDoc?.description) return toast.error('La descripción es obligatoria');
    if (!localDoc?.amount || localDoc.amount <= 0) return toast.error('El monto debe ser mayor a 0');
    
    try {
      if (editingId === 'NEW') {
        await expensesService.create(localDoc as any);
        toast.success('Gasto registrado');
      } else {
        await expensesService.update(editingId!, localDoc as any);
        toast.success('Gasto guardado');
      }
      setEditingId(null);
      onRefresh();
    } catch (e: any) {
      toast.error('Error al guardar: ' + (e.response?.data?.message || 'Error'));
    }
  };

  if (editingId && localDoc) {
    const isNew = editingId === 'NEW';
    const currentStatus = statusOpts.find(s => s.value === (localDoc.status||'').toUpperCase());
    
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setEditingId(null)} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isNew ? 'Registrar Gasto' : 'Editar Gasto'}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Detalle de transacción</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {!isNew && (
                <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={async () => {
                     if(confirm('¿Seguro que deseas eliminar este gasto?')){
                         try { await expensesService.delete(editingId); toast.success('Eliminado'); setEditingId(null); onRefresh(); } catch { toast.error('Error al eliminar'); }
                     }
                  }}>
                  <Trash2 className="size-3 mr-2" /> Eliminar
                </Button>
             )}
            <Button onClick={handleSaveDoc} className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6">
              Guardar Gasto
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50 col-span-2 md:col-span-1">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información del Gasto</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Descripción / Concepto</p>
                    <Input value={localDoc.description || ''} onChange={(e) => setLocalDoc({ ...localDoc, description: e.target.value })} className="h-8 text-xs font-bold" placeholder="Ej. Pago de internet mensual" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Categoría</p>
                    <select 
                      value={localDoc.category || 'OPERATIVO'} 
                      onChange={(e) => setLocalDoc({ ...localDoc, category: e.target.value })}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs uppercase"
                    >
                      <option value="OPERATIVO">Operativo</option>
                      <option value="ADMINISTRATIVO">Administrativo</option>
                      <option value="VENTAS">Ventas / Marketing</option>
                      <option value="FINANCIERO">Financiero</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Fecha del Gasto</p>
                    <Input type="date" value={localDoc.date ? new Date(localDoc.date).toISOString().split('T')[0] : ''} onChange={(e) => setLocalDoc({ ...localDoc, date: new Date(e.target.value).toISOString() })} className="h-8 text-xs" />
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Proveedor (Opcional)</p>
                    <Combobox 
                      options={suppliers.map(c => ({ label: c.name, value: c.id, description: c.phone || 'Sin teléfono' }))}
                      value={localDoc.supplierId || ''}
                      onChange={(val) => setLocalDoc({ ...localDoc, supplierId: val })}
                      placeholder="Asignar a un proveedor (opcional)"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                    <select 
                      value={localDoc.status || 'PENDING'} 
                      onChange={(e) => setLocalDoc({ ...localDoc, status: e.target.value as any })}
                      className={cn("h-8 w-full rounded-md border border-input px-2 text-xs font-bold uppercase", currentStatus?.color || 'bg-background')}
                    >
                      {statusOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Referencia (Factura/Recibo)</p>
                    <Input value={localDoc.reference || ''} onChange={(e) => setLocalDoc({ ...localDoc, reference: e.target.value })} className="h-8 text-xs" placeholder="N° Comprobante" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 flex flex-col justify-center h-full space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Valor del Gasto</p>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm border-b border-border/50 pb-4">
                   <div className="w-1/2">
                      <p className="text-[10px] text-muted-foreground mb-1">Moneda</p>
                      <select 
                        value={localDoc.currency || 'NIO'} 
                        onChange={(e) => setLocalDoc({ ...localDoc, currency: e.target.value, exchangeRate: globalRate })}
                        className="h-8 w-full max-w-[120px] rounded-md border border-input bg-background px-2 text-xs font-bold uppercase"
                      >
                        <option value="NIO">NIO</option>
                        <option value="USD">USD</option>
                      </select>
                   </div>
                   <div className="w-1/2 flex flex-col items-end">
                      <p className="text-[10px] text-muted-foreground mb-1">Monto Total</p>
                      <Input type="number" min="0" value={localDoc.amount || ''} onChange={(e) => setLocalDoc({ ...localDoc, amount: Number(e.target.value) })} className="h-10 text-xl font-black text-rose-500 text-right w-full max-w-[150px]" placeholder="0.00" />
                   </div>
                </div>
                
                <div className="flex justify-between items-center text-base pt-2">
                  <span className="font-black uppercase text-xs tracking-widest">Equivalente Estimado</span>
                  <span className="font-black text-muted-foreground tabular-nums text-right">
                     {localDoc.currency === 'USD' ? `C$ ${(Number(localDoc.amount||0) * (localDoc.exchangeRate || globalRate)).toLocaleString()}` : `$ ${(Number(localDoc.amount||0) / (localDoc.exchangeRate || globalRate)).toLocaleString(undefined, {maximumFractionDigits:2})}`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const kpis = [
    { title: 'Gastos Operativos',  value: data.length,                                                                                  icon: Wallet,       color: 'text-blue-500',   bg: 'bg-blue-500/10'    },
    { title: 'Total del Mes (NIO)',value: `C$ ${data.filter(g => new Date(g.date).getMonth() === new Date().getMonth()).reduce((a,g) => a + (g.baseAmount || (g.currency === 'USD' ? g.amount * globalRate : g.amount)), 0).toLocaleString()}`, icon: TrendingDown, color: 'text-rose-500',   bg: 'bg-rose-500/10'    },
    { title: 'Pendientes',         value: data.filter(g => (g.status||'').toUpperCase() === 'PENDING').length,                          icon: Clock,        color: 'text-amber-500',  bg: 'bg-amber-500/10'   },
    { title: 'Por Categoría',      value: new Set(data.map(g => g.category)).size,                                                      icon: Tag,          color: 'text-purple-500', bg: 'bg-purple-500/10'  },
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
          <div><h2 className="text-xl font-black uppercase tracking-tight">Gastos</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Egresos operativos y administrativos</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={() => setEditingId('NEW')} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Registrar Gasto</Button>
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
              <Button title="Editar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
              <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={async () => { try { await expensesService.delete(row.id); onRefresh(); } catch { toast.error('Error'); } }}><Trash2 className="size-4" /></Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
