import { useState, useEffect } from 'react';
import { CalendarClock, Plus, Search, Eye, RotateCcw, TrendingDown, Clock, Trash2, ChevronLeft } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { recurringExpensesService, suppliersService } from '../../services/compras.service';
import { accountsService } from '../../services/finanzas.service';
import type { RecurringExpense, Supplier, Account } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';

interface Props { data: RecurringExpense[]; loading: boolean; onRefresh: () => void; }

const freqOpts = [
  { label: 'Semanal',    value: 'WEEKLY' },  
  { label: 'Mensual',    value: 'MONTHLY' },
  { label: 'Trimestral', value: 'QUARTERLY' }, 
  { label: 'Anual',      value: 'YEARLY' },
];
const freqMap: Record<string,string> = { WEEKLY:'Semanal', MONTHLY:'Mensual', QUARTERLY:'Trimestral', YEARLY:'Anual' };
const statusOpts = [
  { label: 'Activo',     value: 'ACTIVE',    color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Pausado',    value: 'PAUSED',    color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Finalizado', value: 'CANCELLED', color: 'bg-rose-500/10 text-rose-500' },
];

export function GastosRecurrentesView({ data, loading, onRefresh }: Props) {
  const { exchangeRate: globalRate, displayCurrency, formatConvertedAmount, convertAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<RecurringExpense> | null>(null);

  useEffect(() => {
    suppliersService.getAll().then(res => {
      const list = Array.isArray(res) ? res : (res as any).data || [];
      setSuppliers(list);
    }).catch();

    accountsService.getAll().then(res => {
      const list = Array.isArray(res) ? res : (res as any).data || [];
      setAccounts(list);
    }).catch();
  }, []);

  useEffect(() => {
    if (editingId) {
      if (editingId === 'NEW') {
         setLocalDoc({
           accountId: '',
           description: '',
           frequency: 'monthly',
           startDate: new Date().toISOString(),
           amount: 0,
           currency: 'NIO',
           exchangeRate: globalRate,
           status: 'active',
           category: 'OPERACIONAL'
         });
      } else {
         const found = data.find(x => x.id === editingId);
         setLocalDoc(found ? JSON.parse(JSON.stringify(found)) : null);
      }
    } else {
      setLocalDoc(null);
    }
  }, [editingId, data, globalRate]);

  const filtered = data.filter(e => (e.description||'').toLowerCase().includes(searchTerm.toLowerCase()));

  const columns: ColumnDef<RecurringExpense>[] = [
    { key: 'description', header: 'Descripción', editable: true },
    { key: 'amount',      header: 'Monto',       width: '130px',
      render: (val, row) => (
        <span className="font-black tabular-nums text-rose-500">
          {formatConvertedAmount(Number(val || 0), row.currency, row.exchangeRate)}
        </span>
      ) },
    { key: 'frequency',   header: 'Frecuencia',  width: '120px', editable: true, type: 'select', options: freqOpts,
      render: (val) => <Badge variant="outline" className="text-[9px] uppercase bg-blue-500/10 text-blue-500 border-none">{freqMap[(val||'').toUpperCase()]||val}</Badge> },
    { key: 'startDate',   header: 'Inicio',      width: '110px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'status',      header: 'Estado',      width: '110px', editable: true, type: 'select', options: statusOpts,
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<RecurringExpense>) => {
    try { await recurringExpensesService.update(id as string, updates); toast.success('Actualizado'); onRefresh(); } 
    catch { toast.error('Error al actualizar'); throw new Error(); }
  };

  const handleSaveDoc = async () => {
    if (!localDoc?.description) return toast.error('La descripción es obligatoria');
    if (!localDoc?.amount || localDoc.amount <= 0) return toast.error('El monto debe ser mayor a 0');
    if (!localDoc?.accountId) return toast.error('Debe seleccionar una cuenta contable');
    
    // Clean data
    const cleanedDoc = {
      ...localDoc,
      amount: Number(localDoc.amount),
      exchangeRate: Number(localDoc.exchangeRate),
      baseAmount: Number(localDoc.baseAmount),
    };
    delete (cleanedDoc as any).account;
    delete (cleanedDoc as any).supplier;

    try {
      if (editingId === 'NEW') {
        await recurringExpensesService.create(cleanedDoc as any);
        toast.success('Gasto recurrente configurado');
      } else {
        await recurringExpensesService.update(editingId!, cleanedDoc as any);
        toast.success('Gasto recurrente actualizado');
      }
      setEditingId(null);
      onRefresh();
    } catch (e: any) { 
        toast.error('Error al guardar: ' + (e.response?.data?.message || 'Verifica los campos requeridos')); 
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
              <h2 className="text-xl font-black uppercase tracking-tight">{isNew ? 'Nuevo Gasto Recurrente' : 'Editar Recurrencia'}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Suscripciones y automatizaciones</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {!isNew && (
                <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={async () => {
                     {
                         try { await recurringExpensesService.delete(editingId); toast.success('Eliminado'); setEditingId(null); onRefresh(); } catch { toast.error('Error al eliminar'); }
                     }
                  }}>
                  <Trash2 className="size-3 mr-2" /> Eliminar
                </Button>
             )}
            <Button onClick={handleSaveDoc} className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6">
              Guardar Configuración
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50 col-span-2">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Detalles del Servicio/Concepto</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="md:col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Descripción / Nombre</p>
                  <Input value={localDoc.description || ''} onChange={(e) => setLocalDoc({ ...localDoc, description: e.target.value })} className="h-8 text-xs font-bold" placeholder="Ej. Suscripción a Software, AWS, etc" />
                </div>
                <div className="md:col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Proveedor (Opcional)</p>
                  <Combobox
                    options={suppliers.map(s => ({ label: s.name, value: s.id, description: s.phone || 'Sin teléfono' }))}
                    value={localDoc.supplierId || ''}
                    onChange={(val) => setLocalDoc({ ...localDoc, supplierId: val })}
                    placeholder="Asociar a un proveedor..."
                  />
                </div>
                <div className="md:col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1 font-black uppercase text-primary">Cuenta Contable (Egreso)</p>
                  <Combobox 
                    options={accounts.filter(a => a.type?.toLowerCase() === 'expense' || a.type?.toLowerCase() === 'asset').map(a => ({ label: `${a.code} - ${a.name}`, value: a.id, description: a.type }))}
                    value={localDoc.accountId || ''}
                    onChange={(val) => setLocalDoc({ ...localDoc, accountId: val })}
                    placeholder="Seleccionar Cuenta de Gasto..."
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha de Inicio</p>
                  <Input type="date" value={localDoc.startDate ? new Date(localDoc.startDate).toISOString().split('T')[0] : ''} onChange={(e) => setLocalDoc({ ...localDoc, startDate: new Date(e.target.value).toISOString() })} className="h-8 text-xs" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha de Fin (Opcional)</p>
                  <Input type="date" value={localDoc.endDate ? new Date(localDoc.endDate).toISOString().split('T')[0] : ''} onChange={(e) => setLocalDoc({ ...localDoc, endDate: new Date(e.target.value).toISOString() })} className="h-8 text-xs" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Categoría</p>
                  <Input value={localDoc.category || ''} onChange={(e) => setLocalDoc({ ...localDoc, category: e.target.value })} className="h-8 text-xs uppercase" placeholder="OPERACIONAL" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Frecuencia</p>
                  <select 
                    value={localDoc.frequency || 'MONTHLY'} 
                    onChange={(e) => setLocalDoc({ ...localDoc, frequency: e.target.value as RecurringExpense['frequency'] })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase text-primary"
                  >
                    {freqOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                  <select 
                    value={localDoc.status || 'ACTIVE'} 
                    onChange={(e) => setLocalDoc({ ...localDoc, status: e.target.value as any })}
                    className={cn("h-8 w-full rounded-md border border-input px-2 text-xs font-bold uppercase", currentStatus?.color || 'bg-background')}
                  >
                    {statusOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 col-span-2 md:col-span-1">
             <CardContent className="p-6">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Monto Automático Promedio</p>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm border-b border-border/50 pb-4">
                     <div className="w-1/2">
                        <p className="text-[10px] text-muted-foreground mb-1">Moneda</p>
                        <select 
                          value={localDoc.currency || 'NIO'} 
                          onChange={(e) => setLocalDoc({ ...localDoc, currency: e.target.value as any, exchangeRate: globalRate })}
                          className="h-8 w-full max-w-[120px] rounded-md border border-input bg-background px-2 text-xs font-bold uppercase"
                        >
                          <option value="NIO">NIO</option>
                          <option value="USD">USD</option>
                        </select>
                     </div>
                     <div className="w-1/2 flex flex-col items-end">
                        <p className="text-[10px] text-muted-foreground mb-1">Monto Fijo Estimado</p>
                        <Input type="number" min="0" value={localDoc.amount || ''} onChange={(e) => setLocalDoc({ ...localDoc, amount: Number(e.target.value) })} className="h-10 text-xl font-black text-rose-500 text-right w-full max-w-[150px]" placeholder="0.00" />
                     </div>
                  </div>
                  <div className="flex justify-between items-center text-base pt-2">
                    <span className="font-black uppercase text-[10px] tracking-widest">Base Estimada</span>
                    <span className="font-black text-muted-foreground tabular-nums text-xs text-right">
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

  const monthly = data
    .filter(e => (e.frequency || '').toUpperCase() === 'MONTHLY')
    .reduce((acc, e) => acc + convertAmount(e.amount || 0, e.currency, e.exchangeRate), 0);
  const kpis = [
    { title: 'Total Recurrentes', value: data.length,                                                            icon: CalendarClock, color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Activos',           value: data.filter(e => (e.status||'').toUpperCase() === 'ACTIVE').length,     icon: RotateCcw,     color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    {
      title: `Est. Mensual (${displayCurrency})`,
      value: `${displayCurrency === 'USD' ? '$' : 'C$'} ${monthly.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      icon: TrendingDown,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
    },
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
            <Button onClick={() => setEditingId('NEW')} className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nuevo Recurrente</Button>
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
              <Button title="Editar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
              <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
