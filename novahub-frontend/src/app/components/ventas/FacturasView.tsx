import React, { useState, useEffect } from 'react';
import { 
  FileText, Plus, Search, TrendingUp, Clock, CheckCircle2, CreditCard, AlertCircle, Eye, Trash2, Banknote, ChevronLeft
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { invoicesService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import type { Invoice, Customer, Product } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { useCurrency } from '../../contexts/CurrencyContext';

interface FacturasViewProps {
  data: Invoice[];
  loading: boolean;
  onRefresh: () => void;
  onMarkAsPaid: (invoice: Invoice) => void;
  customers?: Customer[];
  products?: Product[];
}

const statusOptions = [
  { label: 'Borrador',  value: 'DRAFT',    color: 'bg-muted/20 text-muted-foreground' },
  { label: 'Pendiente', value: 'PENDING',  color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Parcial',   value: 'PARTIAL',  color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Pagada',    value: 'PAID',     color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Vencida',   value: 'OVERDUE',  color: 'bg-rose-500/10 text-rose-500' },
  { label: 'Reembolso', value: 'REFUNDED', color: 'bg-blue-500/10 text-blue-500' },
];

export function FacturasView({ data, loading, onRefresh, onMarkAsPaid, customers = [], products = [] }: FacturasViewProps) {
  const { exchangeRate: globalRate } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<any>(null);
  const [localRates, setLocalRates] = useState({ dRate: 0, tRate: 15 });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (editingId) {
      const inv = data.find(x => x.id === editingId);
      if (inv) {
        setLocalDoc(JSON.parse(JSON.stringify(inv)));
        const sub = Number(inv.subtotal || 0);
        if (sub > 0) {
          const dRate = (Number(inv.discountAmount || 0) / sub) * 100;
          const base = sub - Number(inv.discountAmount || 0);
          const tRate = base > 0 ? (Number(inv.taxAmount || 0) / base) * 100 : 0;
          setLocalRates({ dRate: Math.round(dRate * 100) / 100, tRate: Math.round(tRate * 100) / 100 });
        }
      }
    } else if (!isCreating) {
      setLocalDoc(null);
    }
  }, [editingId]);

  const filtered = data.filter(f => 
    f.number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (f.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdate = async (id: string | number, updates: Partial<Invoice>) => {
    try {
      await invoicesService.update(id.toString(), updates);
      toast.success('Factura actualizada');
      onRefresh();
    } catch (error) {
      toast.error('Error al actualizar');
      throw error;
    }
  };

  const startNewInvoice = () => {
    setIsCreating(true);
    setEditingId(null);
    setLocalDoc({
      customerId: '',
      number: `FAC-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      currency: 'NIO',
      exchangeRate: globalRate,
      items: [],
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      total: 0,
      notes: '',
    });
    setLocalRates({ dRate: 0, tRate: 15 });
  };

  const handleSaveInvoice = async (emitir = false) => {
    if (!localDoc) return;
    if (!localDoc.customerId) {
      toast.error('Selecciona un cliente');
      return;
    }
    if (!localDoc.items || localDoc.items.length === 0) {
      toast.error('Agrega al menos un producto');
      return;
    }
    try {
      if (isCreating) {
        await invoicesService.create({
          customerId: localDoc.customerId,
          number: localDoc.number,
          date: new Date(localDoc.date).toISOString(),
          dueDate: new Date(localDoc.dueDate).toISOString(),
          currency: localDoc.currency,
          exchangeRate: localDoc.exchangeRate || globalRate,
          items: localDoc.items.map((item: any) => ({
            productId: item.productId || undefined,
            description: item.description || '',
            quantity: Number(item.quantity || 1),
            unitPrice: Number(item.unitPrice || 0),
            taxRate: Number(item.taxRate || 0),
            discount: Number(item.discount || 0),
            total: Number(item.total || 0),
          })),
          subtotal: localDoc.subtotal,
          taxAmount: localDoc.taxAmount,
          discountAmount: localDoc.discountAmount,
          total: localDoc.total,
          status: emitir ? 'PENDING' : 'DRAFT',
          notes: localDoc.notes,
        } as any);
        toast.success(emitir ? 'Factura emitida exitosamente' : 'Factura guardada como borrador');
      } else {
        await handleUpdate(localDoc.id, {
          ...localDoc,
          items: localDoc.items,
          status: emitir ? 'PENDING' : localDoc.status,
        });
      }
      setIsCreating(false);
      setEditingId(null);
      setLocalDoc(null);
      onRefresh();
    } catch (e) {
      toast.error('Error al guardar la factura');
    }
  };

  const recalcTotals = (items: any[], dRate: number, tRate: number) => {
    const subtotal = items.reduce((acc: number, it: any) => acc + Number(it.total || 0), 0);
    const discountAmount = subtotal * (dRate / 100);
    const base = subtotal - discountAmount;
    const taxAmount = base * (tRate / 100);
    const total = base + taxAmount;
    return { subtotal, discountAmount, taxAmount, total };
  };

  const handleBatchPay = async (ids: (string | number)[]) => {
    try {
       const promises = ids.map(id => invoicesService.markAsPaid(id.toString()));
       await Promise.all(promises);
       toast.success(`${ids.length} Facturas marcadas como pagadas`);
       onRefresh();
    } catch (error) {
       toast.error('Error al procesar pagos masivos');
    }
  };

  const columns: ColumnDef<Invoice>[] = [
    { 
      key: 'number', 
      header: 'Nº Factura', 
      width: '140px',
      render: (val, row) => <span className="text-xs font-black font-mono text-primary cursor-pointer hover:underline" onClick={() => setEditingId(row.id)}>{val}</span>
    },
    { 
      key: 'customer', 
      header: 'Cliente', 
      render: (val, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Varios'}</span>
    },
    { 
      key: 'date', 
      header: 'Fecha Emisión', 
      render: (val) => <span className="text-xs font-medium text-muted-foreground">{new Date(val).toLocaleDateString()}</span>
    },
    { 
      key: 'dueDate', 
      header: 'Vencimiento', 
      render: (val, row) => (
        <span className={cn(
          "text-xs font-bold",
          (row.status||'').toUpperCase() === 'OVERDUE' ? 'text-rose-500' : 'text-muted-foreground'
        )}>
          {new Date(val).toLocaleDateString()}
        </span>
      )
    },
    { 
      key: 'total', 
      header: 'Total Neto', 
      width: '150px',
      render: (val, row) => (
        <span className="text-[13px] font-black tabular-nums text-foreground">
          {row.currency === 'NIO' ? `C$ ${Number(val||0).toLocaleString()}` : `$ ${Number(val||0).toLocaleString()}`}
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
        const opt = statusOptions.find(o => o.value === (val||'').toUpperCase());
        return (
          <Badge variant="outline" className={cn(
            "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none",
            opt?.color || 'bg-muted/20 text-muted-foreground'
          )}>
            {opt?.label || val}
          </Badge>
        );
      }
    }
  ];

  const kpis = [
    { title: 'Facturado Total (NIO)',  value: `C$ ${data.reduce((acc, f) => acc + (f.baseTotal || (f.currency === 'USD' ? f.total * globalRate : f.total)), 0).toLocaleString()}`,                                                                            icon: FileText,     color: 'text-primary',      bg: 'bg-primary/10'      },
    { title: 'Por Cobrar (NIO)',       value: `C$ ${data.filter(f => ['PENDING','OVERDUE','PARTIAL'].includes((f.status||'').toUpperCase())).reduce((acc, f) => acc + (f.baseTotal || (f.currency === 'USD' ? f.total * globalRate : f.total)), 0).toLocaleString()}`, icon: TrendingUp,   color: 'text-orange-500',   bg: 'bg-orange-500/10'   },
    { title: 'Vencidas',               value: data.filter(f => (f.status||'').toUpperCase() === 'OVERDUE').length,                                                                                                                                           icon: AlertCircle,  color: 'text-rose-500',     bg: 'bg-rose-500/10'     },
    { title: 'Cobrado (NIO)',          value: `C$ ${data.filter(f => (f.status||'').toUpperCase() === 'PAID').reduce((acc, f) => acc + (f.baseTotal || (f.currency === 'USD' ? f.total * globalRate : f.total)), 0).toLocaleString()}`,                      icon: CheckCircle2, color: 'text-emerald-500',  bg: 'bg-emerald-500/10'  },
  ];

  // ─── INLINE EDITOR VIEW ────────────────────────────────────────────────
  if ((editingId || isCreating) && localDoc) {
    const statusOpt = statusOptions.find(o => o.value === (localDoc?.status || '').toUpperCase());
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => { setEditingId(null); setIsCreating(false); setLocalDoc(null); }} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isCreating ? 'Nueva Factura' : `Factura ${localDoc?.number}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{isCreating ? 'Completar datos para crear factura' : 'Detalle de la factura'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isCreating && (
              <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                onClick={async () => { await invoicesService.delete(localDoc.id); setEditingId(null); onRefresh(); }}>
                <Trash2 className="size-3 mr-2" /> Eliminar
              </Button>
            )}
            <Button variant="outline" className="rounded-xl border-border/50 font-black uppercase text-[10px] tracking-widest px-6"
              onClick={() => handleSaveInvoice(false)}>
              Guardar Borrador
            </Button>
            <Button className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6"
              onClick={() => handleSaveInvoice(true)}>
              Emitir Factura
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Número</p>
                  <Input value={localDoc?.number || ''} onChange={(e) => setLocalDoc({ ...localDoc, number: e.target.value })} className="h-8 text-xs font-black uppercase" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                  {isCreating ? (
                    <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-muted/20 text-muted-foreground">Nuevo</span>
                  ) : (
                    <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${statusOpt?.color || 'bg-muted/20 text-muted-foreground'}`}>{statusOpt?.label || localDoc?.status}</span>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Cliente</p>
                  <Combobox 
                    options={customers.map(c => ({ label: c.name, value: c.id }))}
                    value={localDoc?.customerId || ''}
                    onChange={(val) => setLocalDoc({ ...localDoc, customerId: val })}
                    placeholder="Seleccionar Cliente"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha Emisión</p>
                  <Input type="date" value={localDoc?.date ? (typeof localDoc.date === 'string' && localDoc.date.includes('T') ? localDoc.date.split('T')[0] : localDoc.date) : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, date: e.target.value })} className="h-8 text-xs" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Vencimiento</p>
                  <Input type="date" value={localDoc?.dueDate ? (typeof localDoc.dueDate === 'string' && localDoc.dueDate.includes('T') ? localDoc.dueDate.split('T')[0] : localDoc.dueDate) : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, dueDate: e.target.value })} className="h-8 text-xs" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Moneda</p>
                  <select value={localDoc?.currency || 'NIO'} onChange={(e) => setLocalDoc({ ...localDoc, currency: e.target.value, exchangeRate: globalRate })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase">
                    <option value="NIO">NIO (Córdobas)</option>
                    <option value="USD">USD (Dólares)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumen Financiero</p>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Subtotal</span>
                  <div className="flex items-center gap-2">{localDoc?.currency === 'USD' ? '$' : 'C$'} <Input type="number" min="0" value={Number(localDoc?.subtotal||0)} readOnly className="w-28 h-8 text-right font-bold bg-muted/20" /></div></div>
                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">Descuento</span>
                  <div className="flex items-center gap-2 text-rose-500">
                    <div className="flex items-center mr-2"><Input type="number" min="0" max="100" value={localRates.dRate || ''} placeholder="0" onChange={(e) => {
                      const newRate = Number(e.target.value); setLocalRates(p => ({ ...p, dRate: newRate }));
                      const calc = recalcTotals(localDoc?.items || [], newRate, localRates.tRate);
                      setLocalDoc({ ...localDoc, ...calc });
                    }} className="w-16 h-8 text-right font-bold text-rose-500 bg-transparent" /> <span className="ml-1 text-xs font-black">%</span></div>
                    -{localDoc?.currency === 'USD' ? '$' : 'C$'} {Number(localDoc?.discountAmount||0).toLocaleString()}
                  </div></div>
                <div className="flex justify-between items-center text-sm"><span className="text-muted-foreground">IVA</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center mr-2"><Input type="number" min="0" max="100" value={localRates.tRate || ''} placeholder="0" onChange={(e) => {
                      const newRate = Number(e.target.value); setLocalRates(p => ({ ...p, tRate: newRate }));
                      const calc = recalcTotals(localDoc?.items || [], localRates.dRate, newRate);
                      setLocalDoc({ ...localDoc, ...calc });
                    }} className="w-16 h-8 text-right font-bold bg-transparent" /> <span className="ml-1 text-xs font-black">%</span></div>
                    {localDoc?.currency === 'USD' ? '$' : 'C$'} {Number(localDoc?.taxAmount||0).toLocaleString()}
                  </div></div>
                <div className="flex justify-between items-center text-base border-t pt-3 border-border/50">
                  <span className="font-black">Total</span>
                  <div className="flex flex-col items-end">
                    <span className="text-primary font-black text-lg">{localDoc?.currency === 'USD' ? '$' : 'C$'} {Number(localDoc?.total||0).toLocaleString()}</span>
                    {localDoc?.currency === 'USD' && <p className="text-[10px] font-bold text-muted-foreground mt-1 italic">≈ C$ {(Number(localDoc?.total || 0) * (localDoc?.exchangeRate || globalRate)).toLocaleString()}</p>}
                    {localDoc?.currency === 'NIO' && <p className="text-[10px] font-bold text-muted-foreground mt-1 italic">≈ $ {(Number(localDoc?.total || 0) / (localDoc?.exchangeRate || globalRate)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Items */}
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Productos / Servicios</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  const newItems = [...(localDoc.items || []), { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, total: 0, productId: null }];
                  setLocalDoc({ ...localDoc, items: newItems });
                }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl">
                  <Plus className="size-3 mr-2" /> Agregar Item
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                <div className="col-span-5">Descripción</div>
                <div className="col-span-2 text-right">Cant.</div>
                <div className="col-span-2 text-right">Precio U.</div>
                <div className="col-span-2 text-right">Total</div>
                <div className="col-span-1"></div>
              </div>
              {(localDoc.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <Combobox 
                      options={products.map(p => ({ label: `${p.code} - ${p.name}`, value: p.id }))}
                      value={item.productId || ''}
                      onChange={(val) => {
                        const newItems = [...(localDoc.items || [])];
                        const selectedProd = products.find(p => p.id === val);
                        newItems[idx] = { ...newItems[idx], productId: val };
                        if (selectedProd) {
                          newItems[idx].description = selectedProd.name;
                          newItems[idx].unitPrice = Number(selectedProd.price || 0);
                          newItems[idx].total = Number(newItems[idx].quantity) * Number(newItems[idx].unitPrice);
                        }
                        const calc = recalcTotals(newItems, localRates.dRate, localRates.tRate);
                        setLocalDoc({ ...localDoc, items: newItems, ...calc });
                      }}
                      placeholder="Seleccionar Producto..."
                    />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" min="0" value={Number(item.quantity) || ''} placeholder="0"
                      onChange={(e) => {
                        const newItems = [...(localDoc.items || [])];
                        newItems[idx] = { ...newItems[idx], quantity: Number(e.target.value), total: Number(e.target.value) * Number(newItems[idx].unitPrice || 0) };
                        const calc = recalcTotals(newItems, localRates.dRate, localRates.tRate);
                        setLocalDoc({ ...localDoc, items: newItems, ...calc });
                      }} className="h-8 text-xs text-right" />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" min="0" value={Number(item.unitPrice) || ''} placeholder="0"
                      onChange={(e) => {
                        const newItems = [...(localDoc.items || [])];
                        newItems[idx] = { ...newItems[idx], unitPrice: Number(e.target.value), total: Number(newItems[idx].quantity || 1) * Number(e.target.value) };
                        const calc = recalcTotals(newItems, localRates.dRate, localRates.tRate);
                        setLocalDoc({ ...localDoc, items: newItems, ...calc });
                      }} className="h-8 text-xs text-right" />
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="text-xs font-black">{localDoc?.currency === 'USD' ? '$' : 'C$'} {Number(item.total || 0).toLocaleString()}</span>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 rounded-md" onClick={() => {
                        const newItems = [...(localDoc.items || [])]; newItems.splice(idx, 1);
                        const calc = recalcTotals(newItems, localRates.dRate, localRates.tRate);
                        setLocalDoc({ ...localDoc, items: newItems, ...calc });
                    }}><Trash2 className="size-3" /></Button>
                  </div>
                </div>
              ))}
              {(!localDoc.items || localDoc.items.length === 0) && (
                <div className="text-center py-6 text-xs text-muted-foreground/50 italic border border-dashed border-border/50 rounded-xl bg-muted/10">
                  No hay productos asignados. Haz clic en "Agregar Item".
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Notas</p>
            <textarea value={localDoc?.notes || ''} onChange={(e) => setLocalDoc({ ...localDoc, notes: e.target.value })}
              className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" placeholder="Agregar notas..." />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── TABLE VIEW ─────────────────────────────────────────────────────────
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
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Control de Facturación</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Gestión de recaudos masivos sin fricción.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input 
                placeholder="Buscar factura..." 
                className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold uppercase tracking-widest"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button onClick={startNewInvoice} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20">
              <Plus className="size-4" /> Nueva Factura
            </Button>
          </div>
        </div>

        <EditableDataTable 
          data={filtered}
          columns={columns}
          onRowUpdate={handleUpdate}
          onBulkDelete={async (ids) => {
            await Promise.all(ids.map(id => invoicesService.delete(id.toString())));
            toast.success(`${ids.length} Facturas eliminadas`);
            onRefresh();
          }}
          isLoading={loading}
          bulkActions={(ids) => (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 text-[10px] font-black uppercase tracking-wider text-emerald-500 hover:bg-emerald-500/10 border-emerald-500/20"
              onClick={() => handleBatchPay(ids)}
            >
              <Banknote className="size-3 mr-2" /> Registrar Pago ({ids.length})
            </Button>
          )}
          actions={(row) => (
            <div className="flex items-center gap-1">
               {(row.status||'').toUpperCase() !== 'PAID' && (
                 <Button 
                   title="Marcar como Pagada" 
                   onClick={() => onMarkAsPaid(row)}
                   variant="ghost" 
                   size="icon" 
                   className="size-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
                 >
                   <CreditCard className="size-4" />
                 </Button>
               )}
               <Button title="Ver detalle" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
               <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 transition-colors" onClick={async () => { await invoicesService.delete(row.id); onRefresh(); }}><Trash2 className="size-4" /></Button>
            </div>
          )}
        />
      </div>
    </div>
  );
}
