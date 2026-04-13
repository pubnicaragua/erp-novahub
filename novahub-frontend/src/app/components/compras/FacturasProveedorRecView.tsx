import { useState, useEffect } from 'react';
import { RotateCcw, Plus, Search, Eye, TrendingDown, CheckCircle2, Clock, ChevronLeft, Trash2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { recurringSupplierInvoicesService, suppliersService } from '../../services/compras.service';
import type { RecurringSupplierInvoice, Supplier } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';

interface Props { data: RecurringSupplierInvoice[]; loading: boolean; onRefresh: () => void; }

const freqOpts = [
  { label: 'Semanal',    value: 'weekly' },  
  { label: 'Mensual',    value: 'monthly' },
  { label: 'Trimestral', value: 'quarterly' }, 
  { label: 'Anual',      value: 'yearly' },
];
const freqMap: Record<string,string> = { weekly:'Semanal', monthly:'Mensual', quarterly:'Trimestral', yearly:'Anual' };
const statusOpts = [
  { label: 'Activo',     value: 'ACTIVE',    color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Pausado',    value: 'PAUSED',    color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Cancelado',  value: 'CANCELLED', color: 'bg-rose-500/10 text-rose-500' },
];

export function FacturasProveedorRecView({ data, loading, onRefresh }: Props) {
  const { canPerform } = useAuth();
  const { exchangeRate: globalRate, displayCurrency, formatConvertedAmount, convertAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<RecurringSupplierInvoice> | null>(null);

  useEffect(() => {
    suppliersService.getAll().then(res => {
      const list = Array.isArray(res) ? res : (res as any).data || [];
      setSuppliers(list);
    }).catch();
  }, []);

  useEffect(() => {
    if (editingId) {
      if (editingId === 'NEW') {
         const nextMonth = new Date();
         nextMonth.setMonth(nextMonth.getMonth() + 1);
         setLocalDoc({
           supplierId: '',
           frequency: 'monthly',
           startDate: new Date().toISOString(),
           nextInvoiceDate: nextMonth.toISOString(),
            currency: displayCurrency,
           exchangeRate: globalRate,
           status: 'ACTIVE',
           items: [],
           total: 0
         } as any);
      } else {
         const found = data.find(x => x.id === editingId);
         setLocalDoc(found ? JSON.parse(JSON.stringify(found)) : null);
      }
    } else {
      setLocalDoc(null);
    }
  }, [editingId, data, globalRate]);

  const filtered = data.filter(r =>
    ((r as any).description||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
    ((r as any).supplier?.name||'').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: ColumnDef<RecurringSupplierInvoice>[] = [
    { key: 'description' as any, header: 'Descripción', editable: canPerform('PURCHASES_INVOICES_REC', 'edit'), 
      render: (_, row) => <span className="text-xs font-bold text-primary">{(row as any).description || 'Factura Automática'}</span> },
    { key: 'supplier' as any,    header: 'Proveedor',
      render: (_, row) => <span className="font-bold text-sm">{(row as any).supplier?.name||'-'}</span> },
    { key: 'total' as any,       header: 'Monto Estimado',       width: '120px',
      render: (val, row) => (
        <span className="font-black tabular-nums text-rose-500">
          {formatConvertedAmount(Number(val || (row as any).amount || 0), row.currency, row.exchangeRate)}
        </span>
      ) },
    { key: 'frequency' as any,   header: 'Frecuencia',  width: '120px', editable: canPerform('PURCHASES_INVOICES_REC', 'edit'), type: 'select', options: freqOpts,
      render: (val) => <Badge variant="outline" className="text-[9px] uppercase bg-purple-500/10 text-purple-500 border-none">{freqMap[(val||'').toLowerCase()]||val||'-'}</Badge> },
    { key: 'status' as any,      header: 'Estado',      width: '110px', editable: canPerform('PURCHASES_INVOICES_REC', 'edit'), type: 'select', options: statusOpts,
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: any) => {
    try { await recurringSupplierInvoicesService.update(id as string, updates); toast.success('Actualizado'); onRefresh(); }
    catch { toast.error('Error al actualizar'); throw new Error(); }
  };

  const handleSaveDoc = async () => {
    if (!localDoc?.supplierId) return toast.error('Seleccione un proveedor');
    if (!localDoc?.nextInvoiceDate) return toast.error('Debe configurar la próxima fecha de factura');

    try {
      const finalDoc = { ...localDoc, total: localDoc.total || (localDoc as any).amount || 0 };
      if (editingId === 'NEW') {
        await recurringSupplierInvoicesService.create(finalDoc as any);
        toast.success('Factura recurrente creada');
      } else {
        await recurringSupplierInvoicesService.update(editingId!, finalDoc as any);
        toast.success('Factura recurrente guardada');
      }
      setEditingId(null);
      onRefresh();
    } catch (e: any) { 
        toast.error('Error al guardar: ' + (e.response?.data?.message || 'Revisa los campos requeridos')); 
    }
  };

  const handleDeleteItem = (idx: number) => {
    if (!localDoc) return;
    const newItems = [...((localDoc as any).items || [])];
    newItems.splice(idx, 1);
    recalculateTotals(newItems);
  };

  const handleItemChange = (idx: number, field: string, value: any) => {
    if (!localDoc) return;
    const newItems = [...((localDoc as any).items || [])];
    newItems[idx] = { ...newItems[idx], [field]: value };
    
    if (['quantity', 'unitPrice'].includes(field)) {
       const q = Number(newItems[idx].quantity || 0);
       const p = Number(newItems[idx].unitPrice || 0);
       newItems[idx].total = q * p;
    }
    recalculateTotals(newItems);
  };

  const recalculateTotals = (items: any[]) => {
    const total = items.reduce((acc, it) => acc + (Number(it.quantity||0) * Number(it.unitPrice||0)), 0);
    setLocalDoc(prev => ({ ...prev!, items, total } as any));
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
              <h2 className="text-xl font-black uppercase tracking-tight">{isNew ? 'Agregar Factura Recurrente' : 'Editar Factura Recurrente'}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Creación automática de facturas</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {!isNew && canPerform('PURCHASES_INVOICES_REC', 'delete') && (
                <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => setPendingDeleteId(editingId)}>
                  <Trash2 className="size-3 mr-2" /> Eliminar
                </Button>
             )}
            {((isNew && canPerform('PURCHASES_INVOICES_REC', 'create')) || (!isNew && canPerform('PURCHASES_INVOICES_REC', 'edit'))) && (
              <Button onClick={handleSaveDoc} className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6">
                Guardar Factura Recurrente
              </Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50 col-span-2">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Reglas de Generación</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="md:col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Nombre Descriptivo</p>
                  <Input 
                    disabled={isNew ? !canPerform('PURCHASES_INVOICES_REC', 'create') : !canPerform('PURCHASES_INVOICES_REC', 'edit')}
                    value={(localDoc as any).description || ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, description: e.target.value } as any)} 
                    className="h-8 text-xs font-bold" 
                    placeholder="Ej. Alquiler de Local (Oficina 2) Mensual" 
                  />
                </div>
                <div className="md:col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Proveedor Obligatorio</p>
                  <Combobox
                    disabled={isNew ? !canPerform('PURCHASES_INVOICES_REC', 'create') : !canPerform('PURCHASES_INVOICES_REC', 'edit')}
                    options={suppliers
                      .filter(s => (s.status || '').toUpperCase() === 'ACTIVE' || s.id === localDoc.supplierId)
                      .map(s => ({ label: s.name, value: s.id, description: (s.code ? `[${s.code}] ` : '') + (s.phone || 'Sin teléfono') }))}
                    value={localDoc.supplierId || ''}
                    onChange={(val) => setLocalDoc({ ...localDoc, supplierId: val })}
                    placeholder="Seleccionar proveedor de la factura..."
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Frecuencia</p>
                  <select 
                    disabled={isNew ? !canPerform('PURCHASES_INVOICES_REC', 'create') : !canPerform('PURCHASES_INVOICES_REC', 'edit')}
                    value={localDoc.frequency || 'monthly'} 
                    onChange={(e) => setLocalDoc({ ...localDoc, frequency: e.target.value as any })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase text-primary"
                  >
                    {freqOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha de Inicio</p>
                  <Input 
                    disabled={isNew ? !canPerform('PURCHASES_INVOICES_REC', 'create') : !canPerform('PURCHASES_INVOICES_REC', 'edit')}
                    type="date" 
                    value={localDoc.startDate ? new Date(localDoc.startDate).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, startDate: new Date(e.target.value).toISOString() })} 
                    className="h-8 text-xs" 
                  />
                </div>
                <div>
                  <p className="text-[10px] font-black text-rose-500 mb-1 tracking-widest">Siguiente Factura *</p>
                  <Input 
                    disabled={isNew ? !canPerform('PURCHASES_INVOICES_REC', 'create') : !canPerform('PURCHASES_INVOICES_REC', 'edit')}
                    type="date" 
                    value={(localDoc as any).nextInvoiceDate ? new Date((localDoc as any).nextInvoiceDate).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, nextInvoiceDate: new Date(e.target.value).toISOString() } as any)} 
                    className="h-8 text-xs font-bold border-rose-500/50" 
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                  <select 
                    disabled={isNew ? !canPerform('PURCHASES_INVOICES_REC', 'create') : !canPerform('PURCHASES_INVOICES_REC', 'edit')}
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

          <Card className="rounded-2xl border-border/50 col-span-2">
             <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Plantilla de Ítems</p>
                  {((isNew && canPerform('PURCHASES_INVOICES_REC', 'create')) || (!isNew && canPerform('PURCHASES_INVOICES_REC', 'edit'))) && (
                    <Button variant="outline" size="sm" onClick={() => {
                      const newItems = [...((localDoc as any).items || []), { id: `new-${Date.now()}`, description: '', quantity: 1, unitPrice: 0, total: 0 }];
                      setLocalDoc({ ...localDoc, items: newItems } as any);
                    }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl">
                      <Plus className="size-3 mr-2" /> Agregar Item
                    </Button>
                  )}
                </div>
              
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                    <div className="col-span-6">Concepto a Facturar</div>
                    <div className="col-span-2 text-right">Cant.</div>
                    <div className="col-span-2 text-right">Precio Unitario</div>
                    <div className="col-span-2 text-right">Total Base</div>
                  </div>
                  {((localDoc as any).items || []).map((item: any, idx: number) => (
                    <div key={item.id || idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-6">
                        <Input 
                          disabled={isNew ? !canPerform('PURCHASES_INVOICES_REC', 'create') : !canPerform('PURCHASES_INVOICES_REC', 'edit')}
                          value={item.description || ''} 
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)} 
                          className="h-8 text-xs" 
                          placeholder="Concepto (mensualidad, alquiler, etc.)" 
                        />
                      </div>
                      <div className="col-span-2">
                        <Input 
                          disabled={isNew ? !canPerform('PURCHASES_INVOICES_REC', 'create') : !canPerform('PURCHASES_INVOICES_REC', 'edit')}
                          type="number" 
                          min="0" 
                          value={item.quantity === 0 ? '' : item.quantity} 
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)} 
                          className="h-8 text-xs text-right" 
                          placeholder="0" 
                        />
                      </div>
                      <div className="col-span-2">
                        <Input 
                          disabled={isNew ? !canPerform('PURCHASES_INVOICES_REC', 'create') : !canPerform('PURCHASES_INVOICES_REC', 'edit')}
                          type="number" 
                          min="0" 
                          value={item.unitPrice === 0 ? '' : item.unitPrice} 
                          onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)} 
                          className="h-8 text-xs text-right" 
                          placeholder="0" 
                        />
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <span className="text-xs font-black w-20 text-right tabular-nums">${Number(item.total || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                        {((isNew && canPerform('PURCHASES_INVOICES_REC', 'create')) || (!isNew && canPerform('PURCHASES_INVOICES_REC', 'edit'))) && (
                          <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 rounded-md" onClick={() => handleDeleteItem(idx)}>
                            <Trash2 className="size-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!(localDoc as any).items || (localDoc as any).items.length === 0) && (
                    <div className="text-center py-6 text-xs text-muted-foreground/50 italic border border-dashed border-border/50 rounded-xl bg-muted/10">
                      Plantilla vacía. Agrega los ítems que se generarán automáticamente.
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end mt-4">
                   <div className="w-64 space-y-4 text-sm bg-muted/10 p-4 rounded-xl border border-border/50">
                      <div className="flex justify-between items-center text-sm border-b border-border/50 pb-2">
                         <div className="w-1/2">
                            <select 
                              disabled={isNew ? !canPerform('PURCHASES_INVOICES_REC', 'create') : !canPerform('PURCHASES_INVOICES_REC', 'edit')}
                              value={localDoc.currency || 'NIO'} 
                              onChange={(e) => setLocalDoc({ ...localDoc, currency: e.target.value, exchangeRate: globalRate } as any)}
                              className="h-6 w-full max-w-[80px] rounded-md border border-input bg-background px-1 text-[10px] font-bold uppercase"
                            >
                              <option value="NIO">NIO</option>
                              <option value="USD">USD</option>
                            </select>
                         </div>
                      </div>
                      <div className="flex justify-between items-center text-[10px] uppercase tracking-widest font-black text-rose-500">
                         <span>Suma Estimada:</span>
                         <span className="text-sm">{localDoc.currency === 'USD' ? '$' : 'C$'} {Number((localDoc as any).total||(localDoc as any).amount||0).toLocaleString()}</span>
                      </div>
                   </div>
                </div>
             </CardContent>
          </Card>
        </div>
        <ConfirmDialog
          open={!!pendingDeleteId}
          onOpenChange={(open) => !open && setPendingDeleteId(null)}
          loading={deleteLoading}
          title="Eliminar Factura Recurrente"
          description="¿Estás seguro de eliminar esta factura recurrente? No se generarán más facturas automáticamente."
          onConfirm={async () => {
            if (!pendingDeleteId) return;
            setDeleteLoading(true);
            try {
               await recurringSupplierInvoicesService.delete(pendingDeleteId);
               toast.success('Eliminado');
               setPendingDeleteId(null);
               setEditingId(null);
               onRefresh();
            } catch { toast.error('Error al eliminar'); }
            finally { setDeleteLoading(false); }
          }}
        />
      </div>
    );
  }

  const monthly = data
    .filter(r => ((r as any).frequency || '').toLowerCase() === 'monthly')
    .reduce((acc, recurring) => {
      const sourceAmount = (recurring as any).total ?? (recurring as any).amount ?? 0;
      return acc + convertAmount(sourceAmount, recurring.currency, recurring.exchangeRate);
    }, 0);
  const kpis = [
    { title: 'Activas',         value: data.filter(r => ((r as any).status||'').toUpperCase()==='ACTIVE').length,  icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Total Recurrentes', value: data.length,                                                                icon: RotateCcw,     color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    {
      title: `Est. Mensual (${displayCurrency})`,
      value: `${displayCurrency === 'USD' ? '$' : 'C$'} ${monthly.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      icon: TrendingDown,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
    },
    { title: 'Pausadas',        value: data.filter(r => ((r as any).status||'').toUpperCase()==='PAUSED').length,   icon: Clock,         color: 'text-amber-500',  bg: 'bg-amber-500/10'   },
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
          <div><h2 className="text-xl font-black uppercase tracking-tight">Facturas Recurrentes</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Servicios y pagos automáticos</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            {canPerform('PURCHASES_INVOICES_REC', 'create') && (
              <Button onClick={() => setEditingId('NEW')} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Agregar Factura Recurrente</Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading}
          onBulkDelete={canPerform('PURCHASES_INVOICES_REC', 'delete') ? async (ids) => {
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await recurringSupplierInvoicesService.delete(id as string);
              }
              toast.success('Elementos eliminados');
              onRefresh();
            } catch (e) {
              toast.error('Error al eliminar');
            }
          } : undefined}
          actions={(row) => (
            <div className="flex gap-1">
              <Button title={canPerform('PURCHASES_INVOICES_REC', 'edit') ? "Editar" : "Ver"} variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
              {canPerform('PURCHASES_INVOICES_REC', 'delete') && (
                <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
              )}
            </div>
          )}
        />
      </div>
    </div>
  );
}

