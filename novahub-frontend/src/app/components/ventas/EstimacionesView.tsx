import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, Plus, Search, Send, TrendingUp, Clock, CheckCircle2, FilePlus, Eye, Trash2, ChevronLeft, PlusCircle, FileDown, XCircle
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { estimatesService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import type { Estimate, Customer, Product } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { generateEstimatePDF } from '../../utils/pdfGenerator';

interface EstimacionesViewProps {
  data: Estimate[];
  loading: boolean;
  onRefresh: () => Promise<void> | void;
  customers?: Customer[];
  products?: Product[];
}

const statusOptions = [
  { label: 'Borrador',  value: 'DRAFT',     color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Pendiente', value: 'SENT',      color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Aprobada',  value: 'APPROVED',  color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Cancelada', value: 'CANCELLED', color: 'bg-muted/20 text-muted-foreground' },
];

export function EstimacionesView({ data, loading: _loading, onRefresh, customers = [], products = [] }: EstimacionesViewProps) {
  const { user, canPerform } = useAuth();
  const { themeConfig } = useTheme();
  const { exchangeRate: globalRate, displayCurrency, formatConvertedAmount, convertAmount } = useCurrency();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Estimate | null>(null);




  const [stateChangePending, setStateChangePending] = useState<{ id: string; status: string; label: string } | null>(null);
  const [isCustomCustomer, setIsCustomCustomer] = useState(false);

  const handleUpdate = async (id: string | number, updates: Partial<Estimate>) => {
    if (id === 'new') {
      setLocalDoc(prev => {
        const next = prev ? { ...prev, ...updates } : null;
        if (next && next.date && next.expiryDate) {
            if (new Date(next.expiryDate) < new Date(next.date)) {
                toast.error('Fecha de vencimiento no puede ser menor a emisión');
                next.expiryDate = new Date(new Date(next.date).getTime() + 86400000).toISOString();
            }
        }
        return next as any;
      });
      return;
    }
    try {
      if (updates.expiryDate && localDoc?.date) {
          if (new Date(updates.expiryDate) < new Date(localDoc.date)) {
              toast.error('Fecha inválida');
              return;
          }
      }
      await estimatesService.update(id.toString(), updates);
      if (updates.status === 'APPROVED') {
        toast.info('Generando Orden de Venta automáticamente...');
        await estimatesService.convertToOrder(id.toString());
        toast.success('Cotización aprobada y convertida a Orden de Venta');
      } else {
        const labelMap: Record<string, string> = { SENT: 'PENDIENTE', CANCELLED: 'CANCELADA', DRAFT: 'BORRADOR', APPROVED: 'APROBADA' };
        toast.success(`Estado actualizado a ${labelMap[updates.status || ''] || updates.status}`);
      }
      onRefresh();
    } catch (error) {
      toast.error('Error al actualizar');
      throw error;
    }
  };

  const handleAddEstimate = () => {
    setIsCustomCustomer(false);
    setEditingId('new');
    setLocalDoc({
      id: 'new',
      number: `COT-${Math.floor(Math.random() * 900000) + 100000}`,
      customerId: '',
      date: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      items: [],
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      total: 0,
      currency: displayCurrency as any,
      exchangeRate: globalRate,
      status: 'DRAFT' as any
    } as any);
  };

  const handleSaveDoc = async (status: string) => {
    if (!localDoc?.customerId && !localDoc?.customCustomerName) {
        toast.error('Selecciona un cliente o ingresa el nombre de la empresa');
        return;
    }
    try {
      const finalDoc = { ...localDoc, status, currency: displayCurrency, exchangeRate: globalRate };
      if (editingId === 'new') {
          await estimatesService.create(finalDoc);
          toast.success('Cotización creada exitosamente');
      } else {
          await estimatesService.update(editingId!, finalDoc);
          toast.success('Cambios guardados');
      }
      setEditingId(null);
      onRefresh();
    } catch (e) {
      toast.error('Error al guardar');
    }
  };

  const handleDeleteEstimate = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPendingDeleteId(id);
  };

  const calculateRates = (doc: any) => {
    const sub = Number(doc?.subtotal || 0);
    if (sub === 0) return { dRate: 0, tRate: 0 };
    const dAmount = Number(doc?.discountAmount || 0);
    const dRate = (dAmount / sub) * 100;
    const base = sub - dAmount;
    const tAmount = Number(doc?.taxAmount || 0);
    const tRate = base > 0 ? (tAmount / base) * 100 : 0;
    return { dRate: Math.round(dRate * 100) / 100, tRate: Math.round(tRate * 100) / 100 };
  };

  // Keep virtual rates to auto-apply when subtotal changes
  const [localRates, setLocalRates] = useState({ dRate: 0, tRate: 0 });

  useEffect(() => {
    if (editingId && editingId !== 'new') {
      const e = data.find(x => x.id === editingId);
      setLocalDoc(e ? JSON.parse(JSON.stringify(e)) : null);
      if (e) {
          setLocalRates(calculateRates(e));
          setIsCustomCustomer(!!e.customCustomerName && !e.customerId);
      }
    } else if (editingId === 'new') {
       // already handled by handleAddEstimate
    } else {
      setLocalDoc(null);
      setLocalRates({ dRate: 0, tRate: 0 });
    }
  }, [editingId]);

  useEffect(() => {
    if (localDoc) {
       setLocalDoc(prev => prev ? { ...prev, currency: displayCurrency as any, exchangeRate: globalRate } : null);
    }
  }, [displayCurrency, globalRate]);


  const columns: ColumnDef<Estimate>[] = [
    { 
      key: 'number', 
      header: 'Número', 
      width: '140px',
      render: (val, row) => (
        <span 
          className={cn(
            "text-xs font-black font-mono text-primary",
            canPerform('SALES_QUOTES', 'edit') ? "cursor-pointer hover:underline" : "cursor-default"
          )}
          onClick={() => canPerform('SALES_QUOTES', 'edit') && setEditingId(row.id)}
        >
          {val}
        </span>
      )
    },
    { 
      key: 'customerId', 
      header: 'Cliente', 
      render: (_val, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || row.customCustomerName || 'Varios'}</span>
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
      render: (val, row) => (
        <span className="text-[13px] font-black tabular-nums text-foreground">
          {formatConvertedAmount(Number(val || 0), row.currency, row.exchangeRate)}
        </span>
      )
    },
    { 
      key: 'status', 
      header: 'Estado', 
      width: '130px',
      editable: false,
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

  const quotedTotalInDisplayCurrency = data.reduce(
    (acc, estimate) => acc + convertAmount(estimate.total || 0, estimate.currency, estimate.exchangeRate),
    0,
  );

  const kpis = [
    {
      title: `Total Cotizado (${displayCurrency})`,
      value: formatConvertedAmount(quotedTotalInDisplayCurrency, displayCurrency),
      icon: FileSpreadsheet,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    { title: 'Tasa Conversión', value: `${((data.filter(e => (e.status||'').toUpperCase() === 'APPROVED').length / (data.length || 1)) * 100).toFixed(0)}%`, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Pendientes', value: data.filter(e => (e.status||'').toUpperCase() === 'SENT').length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { title: 'Aprobadas', value: data.filter(e => (e.status||'').toUpperCase() === 'APPROVED').length, icon: CheckCircle2, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

  if (editingId && localDoc) {
    const statusOpt = statusOptions.find(o => o.value === (localDoc?.status || '').toUpperCase());
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setEditingId(null)} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Cotización {localDoc?.number}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Detalle de la cotización comercial</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {canPerform('SALES_QUOTES', 'edit') && (
              <>
                <Button 
                  variant="outline" 
                  className="rounded-xl border-border/50 font-black uppercase text-[10px] tracking-widest px-6"
                  onClick={() => handleSaveDoc('DRAFT')}
                >
                  Guardar Borrador
                </Button>
                <Button 
                  className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6"
                  onClick={() => handleSaveDoc('SENT')}
                >
                  Crear Cotización
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase font-black">Número</p>
                  <Input value={localDoc?.number} readOnly className="h-9 text-xs font-black uppercase bg-muted/10 cursor-not-allowed" />
                </div>
                <div className="col-span-1 sm:col-span-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground uppercase font-black">Cliente / Empresa</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-[9px] font-black uppercase tracking-tighter hover:bg-primary/10 hover:text-primary rounded-lg px-2"
                      onClick={() => {
                        const next = !isCustomCustomer;
                        setIsCustomCustomer(next);
                        if (next) {
                          setLocalDoc({ ...localDoc, customerId: '' } as any);
                        } else {
                          setLocalDoc({ ...localDoc, customCustomerName: '', customCustomerEmail: '', customCustomerPhone: '' } as any);
                        }
                      }}
                    >
                      {isCustomCustomer ? 'Cambiar a Cliente Registrado' : '¿Empresa No Registrada?'}
                    </Button>
                  </div>
                  {!isCustomCustomer ? (
                    <Combobox 
                      options={(customers || [])
                        .filter(c => (c.status || '').toUpperCase() === 'ACTIVE' || c.id === localDoc?.customerId)
                        .map(c => ({ label: c.name, value: c.id, description: (c.code ? `[${c.code}] ` : '') + (c.phone || 'Sin teléfono') }))}
                      value={localDoc?.customerId || ''}
                      onChange={(val) => setLocalDoc({ ...localDoc, customerId: val } as any)}
                      placeholder="Seleccionar Cliente"
                    />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="sm:col-span-1">
                        <Input 
                          placeholder="Nombre Empresa" 
                          value={localDoc?.customCustomerName || ''} 
                          onChange={(e) => setLocalDoc({ ...localDoc, customCustomerName: e.target.value } as any)}
                          className="h-9 text-xs font-bold"
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <Input 
                          placeholder="Email" 
                          value={localDoc?.customCustomerEmail || ''} 
                          onChange={(e) => setLocalDoc({ ...localDoc, customCustomerEmail: e.target.value } as any)}
                          className="h-9 text-xs font-bold"
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <Input 
                          placeholder="Teléfono" 
                          value={localDoc?.customCustomerPhone || ''} 
                          onChange={(e) => setLocalDoc({ ...localDoc, customCustomerPhone: e.target.value } as any)}
                          className="h-9 text-xs font-bold"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase font-black">Fecha Emisión</p>
                  <Input 
                    type="date" 
                    value={typeof localDoc?.date === 'string' && localDoc.date.includes('T') ? localDoc.date.split('T')[0] : localDoc?.date || ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, date: e.target.value } as any)} 
                    className="h-9 text-xs font-bold" 
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase font-black">Válida hasta</p>
                  <Input 
                    type="date" 
                    min={localDoc?.date ? localDoc.date.split('T')[0] : ''}
                    value={typeof localDoc?.expiryDate === 'string' && localDoc.expiryDate.includes('T') ? localDoc.expiryDate.split('T')[0] : localDoc?.expiryDate || ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, expiryDate: e.target.value } as any)} 
                    className="h-9 text-xs font-bold" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumen Financiero</p>
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <div className="flex items-center gap-2">{localDoc?.currency === 'USD' ? '$' : 'C$'} <Input type="number" min="0" value={Number(localDoc?.subtotal||0)} readOnly className="w-28 h-8 text-right font-bold bg-muted/20" /></div>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 text-sm">
                  <span className="text-muted-foreground">Descuento</span>
                  <div className="flex items-center gap-2 text-rose-500">
                    <div className="flex items-center mr-2"><Input type="number" min="0" max="100" value={localRates.dRate || ''} placeholder="0" onChange={(e) => {
                      const newRate = Number(e.target.value);
                      const dAmount = Number(localDoc?.subtotal||0) * (newRate / 100);
                      const base = Number(localDoc?.subtotal||0) - dAmount;
                      const tAmount = base * (localRates.tRate / 100);
                      const newTotal = base + tAmount;
                      setLocalRates(prev => ({ ...prev, dRate: newRate }));
                      setLocalDoc({ ...localDoc, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                    }} onBlur={(e) => {
                      const newRate = Number(e.target.value);
                      const dAmount = Number(localDoc?.subtotal||0) * (newRate / 100);
                      const base = Number(localDoc?.subtotal||0) - dAmount;
                      const tAmount = base * (localRates.tRate / 100);
                      const newTotal = base + tAmount;
                      handleUpdate(localDoc!.id, { discountAmount: dAmount, taxAmount: tAmount, total: newTotal });
                    }} className="w-16 h-8 text-right font-bold text-rose-500 bg-transparent" /> <span className="ml-1 text-xs font-black">%</span></div>
                    -{localDoc?.currency === 'USD' ? '$' : 'C$'} {Number(localDoc?.discountAmount||0).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2 text-sm">
                  <span className="text-muted-foreground">Impuesto (IVA)</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center mr-2"><Input type="number" min="0" max="100" value={localRates.tRate || ''} placeholder="0" onChange={(e) => {
                      const newRate = Number(e.target.value);
                      const dAmount = Number(localDoc?.subtotal||0) * (localRates.dRate / 100);
                      const base = Number(localDoc?.subtotal||0) - dAmount;
                      const tAmount = base * (newRate / 100);
                      const newTotal = base + tAmount;
                      setLocalRates(prev => ({ ...prev, dRate: dAmount / (Number(localDoc?.subtotal||1)), tRate: newRate })); // Error in original logic fixed: tRate should map to localRates.tRate
                      setLocalRates(prev => ({ ...prev, tRate: newRate }));
                      setLocalDoc({ ...localDoc, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                    }} onBlur={(e) => {
                      const newRate = Number(e.target.value);
                      const dAmount = Number(localDoc?.subtotal||0) * (localRates.dRate / 100);
                      const base = Number(localDoc?.subtotal||0) - dAmount;
                      const tAmount = base * (newRate / 100);
                      const newTotal = base + tAmount;
                      handleUpdate(localDoc!.id, { discountAmount: dAmount, taxAmount: tAmount, total: newTotal });
                    }} className="w-16 h-8 text-right font-bold bg-transparent" /> <span className="ml-1 text-xs font-black">%</span></div>
                    {localDoc?.currency === 'USD' ? '$' : 'C$'} {Number(localDoc?.taxAmount||0).toLocaleString()}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 border-t pt-3 border-border/50">
                  <span className="font-black">Total</span>
                  <div className="flex flex-col items-end w-full sm:w-auto">
                    <div className="flex items-center gap-2 text-primary font-black ml-auto">
                      {localDoc?.currency === 'USD' ? '$' : 'C$'} 
                      <Input type="number" value={Number(localDoc?.total||0)} readOnly className="w-28 h-8 text-right font-black text-primary bg-muted/20" />
                    </div>
                    {localDoc?.currency === 'USD' && (
                      <p className="text-[10px] font-bold text-muted-foreground mt-1 italic">
                        ≈ C$ {(Number(localDoc?.total || 0) * (localDoc?.exchangeRate || globalRate)).toLocaleString()}
                      </p>
                    )}
                    {localDoc?.currency === 'NIO' && (
                      <p className="text-[10px] font-bold text-muted-foreground mt-1 italic">
                        ≈ $ {(Number(localDoc?.total || 0) / (localDoc?.exchangeRate || globalRate)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- PRODUCT LINE ITEMS --- */}
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Productos / Servicios</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  const newItems = [...(localDoc.items || []), { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0, total: 0 }] as any[];
                  setLocalDoc({ ...localDoc, items: newItems } as any);
                  handleUpdate(localDoc!.id, { items: newItems });
                }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl">
                  <PlusCircle className="size-3 mr-2" /> Agregar Item
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="hidden md:grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                <div className="col-span-6">Descripción</div>
                <div className="col-span-2 text-right">Cant.</div>
                <div className="col-span-2 text-right">Precio U.</div>
                <div className="col-span-2 text-right">Total</div>
              </div>
              {(localDoc.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} className="flex flex-col md:grid md:grid-cols-12 gap-4 md:gap-2 items-start md:items-center p-4 md:p-0 border md:border-none rounded-2xl md:rounded-none bg-muted/5 md:bg-transparent relative group">
                  <div className="w-full md:col-span-6 space-y-1">
                    <label className="md:hidden text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Producto / Servicio</label>
                      <Combobox 
                        options={products.map(p => ({ label: `${p.code} - ${p.name}`, value: p.id }))}
                        value={item.productId || ''}
                        onChange={(val) => {
                          const newItems = [...(localDoc.items || [])] as any[];
                          const selectedProd = products.find(p => p.id === val);
                          newItems[idx].productId = val;
                          if (selectedProd) {
                            newItems[idx].description = selectedProd.name;
                            newItems[idx].unitPrice = Number(selectedProd.price || 0);
                            newItems[idx].total = Number(newItems[idx].quantity) * Number(newItems[idx].unitPrice);
                          } else {
                            newItems[idx].description = 'Producto Customizado';
                            newItems[idx].unitPrice = 0;
                            newItems[idx].total = 0;
                          }
                          const newSubtotal = newItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
                          const dAmount = newSubtotal * (localRates.dRate / 100);
                          const base = newSubtotal - dAmount;
                          const tAmount = base * (localRates.tRate / 100);
                          const newTotal = base + tAmount;
                          setLocalDoc({ ...localDoc, items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                        }}
                        placeholder="Seleccionar Producto..."
                      />
                  </div>
                  <div className="flex gap-4 w-full md:contents">
                    <div className="flex-1 md:col-span-2 space-y-1">
                      <label className="md:hidden text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Cant.</label>
                      <Input 
                        type="number" 
                        min="0"
                        value={Number(item.quantity) || ''} 
                        placeholder="0"
                        onChange={(e) => {
                          const newItems = [...(localDoc.items || [])] as any[];
                          newItems[idx].quantity = Number(e.target.value);
                          newItems[idx].total = Number(newItems[idx].quantity) * Number(newItems[idx].unitPrice || 0);
                          const newSubtotal = newItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
                          const dAmount = newSubtotal * (localRates.dRate / 100);
                          const base = newSubtotal - dAmount;
                          const tAmount = base * (localRates.tRate / 100);
                          const newTotal = base + tAmount;
                          setLocalDoc({ ...localDoc, items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                        }}
                        className="h-9 md:h-8 text-xs md:text-right font-bold" 
                      />
                    </div>
                    <div className="flex-1 md:col-span-2 space-y-1">
                      <label className="md:hidden text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Precio U.</label>
                      <Input 
                        type="number" 
                        min="0"
                        value={Number(item.unitPrice) || ''} 
                        placeholder="0"
                        onChange={(e) => {
                          const newItems = [...(localDoc.items || [])] as any[];
                          newItems[idx].unitPrice = Number(e.target.value);
                          newItems[idx].total = Number(newItems[idx].quantity || 0) * Number(newItems[idx].unitPrice);
                          const newSubtotal = newItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
                          const dAmount = newSubtotal * (localRates.dRate / 100);
                          const base = newSubtotal - dAmount;
                          const tAmount = base * (localRates.tRate / 100);
                          const newTotal = base + tAmount;
                          setLocalDoc({ ...localDoc, items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                        }}
                        className="h-9 md:h-8 text-xs md:text-right font-bold" 
                      />
                    </div>
                  </div>
                  <div className="w-full md:col-span-2 flex items-center justify-between md:justify-end gap-2 border-t md:border-none pt-3 md:pt-0 mt-2 md:mt-0">
                    <div className="md:hidden">
                       <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 leading-none mb-1">Total Item</p>
                       <p className="text-sm font-black text-primary">{localDoc?.currency === 'USD' ? '$' : 'C$'}{Number(item.total || 0).toLocaleString()}</p>
                    </div>
                    <span className="hidden md:block text-xs font-black w-24 text-right tabular-nums">
                      {localDoc?.currency === 'USD' ? '$' : 'C$'}{Number(item.total || 0).toLocaleString()}
                    </span>
                    <Button variant="ghost" size="icon" className="size-8 md:size-6 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 rounded-lg md:rounded-md" onClick={() => {
                        const newItems = [...(localDoc.items || [])] as any[];
                        newItems.splice(idx, 1);
                        const newSubtotal = newItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
                        const newTotal = newSubtotal + Number(localDoc.taxAmount || 0) - Number(localDoc.discountAmount || 0);
                        setLocalDoc({ ...localDoc, items: newItems, subtotal: newSubtotal, total: newTotal } as any);
                        handleUpdate(localDoc!.id, { items: newItems, subtotal: newSubtotal, total: newTotal });
                    }}>
                      <Trash2 className="size-4 md:size-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {(!localDoc.items || localDoc.items.length === 0) && (
                <div className="text-center py-6 text-xs text-muted-foreground/50 italic border border-dashed border-border/50 rounded-xl bg-muted/10">
                  No hay productos o servicios asignados a esta cotización. Haz clic en "Agregar Item".
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {localDoc?.notes && (
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Notas</p><p className="text-sm">{localDoc.notes}</p></CardContent>
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Estimaciones & Cotizaciones</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Negociaciones en tiempo real sin modals ni esperas.</p>
          </div>
          <div className="flex items-center gap-3">
            {canPerform('SALES_QUOTES', 'create') && (
              <Button onClick={handleAddEstimate} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20">
                <FilePlus className="size-4" /> Nueva Cotización
              </Button>
            )}
          </div>
        </div>

        <EditableDataTable 
          data={data}
          showSelection={false}
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
          onRowDelete={async (id) => handleDeleteEstimate(id as string, { stopPropagation: () => {} } as any)} 
          allowAddRow={false}
          actions={(row) => (
            <>
              {canPerform('SALES_QUOTES', 'edit') && row.status === 'DRAFT' && (
                <>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    title="Pasar a Pendiente"
                    className="size-8 rounded-lg text-blue-500 hover:bg-blue-500/10 hover:text-blue-500 transition-colors" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setStateChangePending({ id: row.id, status: 'SENT', label: 'PENDIENTE' });
                    }}
                  >
                    <Send className="size-4" />
                  </Button>
                </>
              )}

              {canPerform('SALES_QUOTES', 'edit') && row.status === 'SENT' && (
                <>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    title="Enviar a Orden de Venta"
                    className="size-8 rounded-lg text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setStateChangePending({ id: row.id, status: 'APPROVED', label: 'APROBADA' });
                    }}
                  >
                    <CheckCircle2 className="size-4" />
                  </Button>
                </>
              )}

              {canPerform('SALES_QUOTES', 'edit') && row.status === 'CANCELLED' && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  title="Re-activar a Pendiente"
                  className="size-8 rounded-lg text-blue-500 hover:bg-blue-500/10 hover:text-blue-500 transition-colors" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setStateChangePending({ id: row.id, status: 'SENT', label: 'PENDIENTE' });
                  }}
                >
                  <Send className="size-4" />
                </Button>
              )}

              {canPerform('SALES_QUOTES', 'edit') && (row.status === 'DRAFT' || row.status === 'SENT') && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  title="Cancelar"
                  className="size-8 rounded-lg text-rose-500 hover:bg-rose-500/10 hover:text-rose-500 transition-colors" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setStateChangePending({ id: row.id, status: 'CANCELLED', label: 'CANCELADA' });
                  }}
                >
                  <XCircle className="size-4" />
                </Button>
              )}

              <Button variant="ghost" title="Descargar PDF" size="icon" className="size-8 rounded-lg text-slate-500 hover:bg-slate-500/10 hover:text-slate-500 transition-colors" onClick={(e) => { 
                e.stopPropagation(); 
                generateEstimatePDF({
                  estimate: {...row, customer: customers.find(c => c.id === row.customerId) || row.customer},
                  tenantName: themeConfig?.tenantName || user?.tenantName || 'Empresa',
                  tenantLogo: themeConfig?.logo,
                  formatAmount: formatConvertedAmount,
                  primaryColor: themeConfig?.colors.primary
                });
                toast.success('Generando PDF...');
              }}>
                <FileDown className="size-4" />
              </Button>

              <Button variant="ghost" size="icon" className="size-8 rounded-lg text-primary hover:bg-primary/10 hover:text-primary transition-colors" onClick={(e) => { e.stopPropagation(); setEditingId(row.id); }}>
                <Eye className="size-4" />
              </Button>

              {canPerform('SALES_QUOTES', 'delete') && (
                <Button variant="ghost" size="icon" className="size-8 rounded-lg text-rose-500 hover:bg-rose-500/10 hover:text-rose-500 transition-colors" onClick={() => setPendingDeleteId(row.id)}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </>
          )}
        />
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
        title={"¿Eliminar cotización?"}
        description="¿Estás seguro de que deseas eliminar esta cotización? Si tiene órdenes o facturas vinculadas, no se podrá eliminar."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={async () => {
          if (!pendingDeleteId) return;
          try {
            setDeleteLoading(true);
            await estimatesService.delete(pendingDeleteId);
            toast.success('Cotización eliminada');
            setEditingId(null);
            onRefresh();
          } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || '';
            if (msg.includes('foreign') || msg.includes('constraint') || msg.includes('reference') || error?.status === 409) {
              toast.error('No se puede eliminar: esta cotización tiene órdenes de venta o facturas vinculadas.');
            } else {
              toast.error(`Error al eliminar: ${msg || 'Error desconocido'}`);
            }
          } finally {
            setDeleteLoading(false);
            setPendingDeleteId(null);
          }
        }}
      />
      <ConfirmDialog
        open={stateChangePending !== null}
        onOpenChange={(open) => { if (!open) setStateChangePending(null); }}
        title={`Actualizar a ${stateChangePending?.label}`}
        description={`Vas a cambiar el estado de la cotización. Esto mantendrá el flujo de ventas actualizado.`}
        confirmLabel="Continuar"
        variant="default"
        onConfirm={async () => {
          if (!stateChangePending) return;
          await handleUpdate(stateChangePending.id, { status: stateChangePending.status as any });
          setStateChangePending(null);
        }}
      />
    </div>
  );
}

