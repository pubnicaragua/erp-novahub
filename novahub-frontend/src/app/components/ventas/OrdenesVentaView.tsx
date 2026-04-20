import { useState, useEffect } from 'react';
import { 
  ClipboardList, PlusCircle, Search, Send, Clock, FilePlus, Package, Eye, Trash2, ChevronLeft, FileDown, CheckCircle2, XCircle, TrendingUp
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { salesOrdersService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import type { SalesOrder, Customer, Product } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { useCurrency } from '../../contexts/CurrencyContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { generateEstimatePDF } from '../../utils/pdfGenerator';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

interface OrdenesVentaViewProps {
  data: SalesOrder[];
  loading: boolean;
  onRefresh: () => Promise<void> | void;
  onGenerateInvoice: (order: SalesOrder) => void;
  customers?: Customer[];
  products?: Product[];
}

const statusOptions = [
  { label: 'BORRADOR',           value: 'DRAFT',          color: 'bg-slate-500/10 text-slate-500' },
  { label: 'PENDIENTE',          value: 'PENDING_REVIEW', color: 'bg-blue-500/10 text-blue-500' },
  { label: 'FACTURADA',          value: 'SHIPPED',        color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'CANCELADA',          value: 'CANCELLED',      color: 'bg-rose-500/10 text-rose-500' },
];

export function OrdenesVentaView({ data, loading, onRefresh, onGenerateInvoice, customers = [], products = [] }: OrdenesVentaViewProps) {
  const { exchangeRate: globalRate, displayCurrency, formatConvertedAmount, convertAmount } = useCurrency();
  const { user, canPerform } = useAuth();
  const { themeConfig } = useTheme();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<SalesOrder | null>(null);
  const [stateChangePending, setStateChangePending] = useState<{id: string | number, status: string, label: string} | null>(null);

  const handleUpdate = async (id: string | number, updates: Partial<SalesOrder>) => {
    if (id === 'new') {
        setLocalDoc(prev => prev ? ({ ...prev, ...updates } as any) : null);
        return;
    }
    try {
      if (updates.status === 'SHIPPED') {
        const orderToConvert = data.find(o => o.id === id) || localDoc;
        if (orderToConvert) {
          // Validar Stock
          for (const item of orderToConvert.items || []) {
            if (item.productId) {
              const product = products.find(p => p.id === item.productId);
              if (product && Number(item.quantity) > Number(product.stock)) {
                toast.error(`Sin stock suficiente para: ${product.name}. Disponible: ${product.stock}`);
                return;
              }
            }
          }

          await salesOrdersService.convertToInvoice(id.toString());
          toast.success('Orden de Venta enviada a facturas.');
          onRefresh();
          return;
        }
      }

      await salesOrdersService.update(id.toString(), updates);
      
      const labelMap: Record<string, string> = { PENDING_REVIEW: 'PENDIENTE', SENT: 'PENDIENTE', CANCELLED: 'CANCELADA', DRAFT: 'BORRADOR', SHIPPED: 'FACTURADA' };
      if (updates.status) {
          toast.success(`Estado actualizado a ${labelMap[updates.status] || updates.status}`);
      } else {
          toast.success('Orden actualizada');
      }
      onRefresh();
    } catch (error: any) {
       const msg = error.response?.data?.message;
       toast.error(`Error: ${Array.isArray(msg) ? msg.join(', ') : (msg || error.message)}`);
    }
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

  const [localRates, setLocalRates] = useState({ dRate: 0, tRate: 0 });

  useEffect(() => {
    if (editingId && editingId !== 'new') {
      const e = data.find(x => x.id === editingId);
      setLocalDoc(e ? JSON.parse(JSON.stringify(e)) : null);
      if (e) setLocalRates(calculateRates(e));
    } else if (editingId === 'new') {
        // Handled by handleAddOrder
    } else {
      setLocalDoc(null);
      setLocalRates({ dRate: 0, tRate: 0 });
    }
  }, [editingId, data]);

  const handleAddOrder = () => {
    const tempId = 'new';
    setEditingId(tempId);
    setLocalDoc({
      id: tempId,
      customerId: customers[0]?.id || '',
      date: new Date().toISOString(),
      expectedDelivery: new Date(Date.now() + 7 * 86400000).toISOString(),
      discountAmount: 0,
      taxAmount: 0,
      subtotal: 0,
      total: 0,
      currency: displayCurrency as any,
      exchangeRate: globalRate,
      status: 'DRAFT' as any,
      items: [],
      number: `OV-${Date.now().toString().slice(-6)}`
    } as any);
    setLocalRates({ dRate: 0, tRate: 0 });
  };

  const columns: ColumnDef<SalesOrder>[] = [
    { 
      key: 'number', 
      header: 'Número de Orden', 
      width: '200px',
      render: (val, row) => (
        <div className="flex items-center gap-2">
          <span 
            className={cn(
              "text-xs font-black font-mono text-primary",
              canPerform('SALES_ORDERS', 'edit') ? "cursor-pointer hover:underline" : "cursor-default"
            )} 
            onClick={() => canPerform('SALES_ORDERS', 'edit') && setEditingId(row.id)}
          >
            {val}
          </span>
          {row.estimateId && (
            <Badge className="text-[8px] font-black bg-orange-500/10 text-orange-500 border-none px-1.5 py-0">
              Desde Cotización
            </Badge>
          )}
        </div>
      )
    },
    { 
      key: 'customer', 
      header: 'Cliente', 
      render: (_val, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Varios'}</span>
    },
    { 
      key: 'itemCount', 
      header: 'Items', 
      width: '100px',
      render: (_val, row) => <span className="text-xs font-medium text-muted-foreground">{row.items?.length || 0} art.</span>
    },
    { 
      key: 'total', 
      header: 'Monto Total', 
      width: '150px',
      render: (val, row) => (
        <span className="text-[13px] font-black tabular-nums text-emerald-500">
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
      key: 'date', 
      header: 'Fecha Compromiso', 
      render: (val) => (
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
           <Clock className="size-3" />
           {new Date(val).toLocaleDateString()}
        </div>
      )
    }
  ];

  const totalAmountInDisplayCurrency = data.reduce(
    (acc, order) => acc + convertAmount(order.total || 0, order.currency, order.exchangeRate),
    0
  );

  const kpis = [
    { title: 'Total Órdenes',    value: data.length,                                                                    icon: ClipboardList, color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Por Confirmar',   value: data.filter(o => (o.status||'').toUpperCase() === 'PENDING_REVIEW').length,      icon: Clock,         color: 'text-amber-500',  bg: 'bg-amber-500/10'   },
    { title: 'Confirmadas',      value: data.filter(o => (o.status||'').toUpperCase() === 'CONFIRMED').length,           icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    {
      title: `Monto Total (${displayCurrency})`,
      value: `${displayCurrency === 'USD' ? '$' : 'C$'} ${totalAmountInDisplayCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
    },
  ];

  if (editingId && localDoc) {
    const statusOpt = statusOptions.find(o => o.value === (localDoc?.status || '').toUpperCase());
    
    const handleSave = async (status: string) => {
        try {
            const docToSave = { ...localDoc, status: status as any };

            // Validar Stock si se va a facturar
            if (status === 'SHIPPED') {
              for (const item of docToSave.items || []) {
                if (item.productId) {
                  const product = products.find(p => p.id === item.productId);
                  if (product && Number(item.quantity) > Number(product.stock)) {
                    toast.error(`Sin stock suficiente para: ${product.name}. Disponible: ${product.stock}`);
                    return;
                  }
                }
              }
            }

            if (editingId === 'new') {
                const { id, ...rest } = docToSave;
                const newOrder = await salesOrdersService.create({ ...rest, status: status === 'SHIPPED' ? 'PENDING_REVIEW' : status } as any);
                if (status === 'SHIPPED') {
                  await salesOrdersService.convertToInvoice(newOrder.id);
                }
                toast.success(status === 'DRAFT' ? 'Borrador guardado' : 'Orden de Venta enviada a facturas.');
            } else {
                await salesOrdersService.update(localDoc.id.toString(), { ...docToSave, status: status === 'SHIPPED' ? 'PENDING_REVIEW' : status } as any);
                if (status === 'SHIPPED') {
                  await salesOrdersService.convertToInvoice(localDoc.id.toString());
                }
                toast.success(status === 'DRAFT' ? 'Borrador actualizado' : 'Orden de Venta enviada a facturas.');
            }
            setEditingId(null);
            onRefresh();
        } catch (error) {
            toast.error('Error al guardar');
        }
    };

    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setEditingId(null)} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Orden {localDoc?.number}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 italic">Gestión de pedido de venta</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {canPerform('SALES_ORDERS', 'edit') && (
              <>
                <Button variant="outline" className="rounded-xl border-border/50 font-black uppercase text-[10px] tracking-widest px-6 h-10 hover:bg-muted/50 transition-all"
                  onClick={() => handleSave('DRAFT')}>
                  Guardar Borrador
                </Button>
                <Button className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6 h-10 hover:opacity-90 transition-all"
                  onClick={() => handleSave('SHIPPED')}>
                  Crear y Facturar
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-border/50 pb-4">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Package className="size-4" />
                </div>
                <p className="text-xs font-black uppercase tracking-widest">Información General</p>
              </div>
              
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div className="col-span-1">
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase font-black">Número de Orden</p>
                  <Input value={localDoc?.number} readOnly className="h-9 text-xs font-bold bg-muted/30 border-dashed" />
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase font-black">Cliente</p>
                  <Combobox 
                    options={(customers || [])
                      .filter(c => (c.status || '').toUpperCase() === 'ACTIVE' || c.id === localDoc?.customerId)
                      .map(c => ({ label: c.name, value: c.id, description: (c.code ? `[${c.code}] ` : '') + (c.phone || 'Sin teléfono') }))}
                    value={localDoc?.customerId || ''}
                    onChange={(val) => setLocalDoc({ ...localDoc, customerId: val } as any)}
                    placeholder="Seleccionar Cliente"
                  />
                </div>
                <div className="col-span-1">
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase font-black">Fecha Emisión</p>
                  <Input 
                    type="date" 
                    value={typeof localDoc?.date === 'string' && localDoc.date.includes('T') ? localDoc.date.split('T')[0] : localDoc?.date || ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, date: e.target.value } as any)} 
                    className="h-9 text-xs font-bold" 
                  />
                </div>
                <div className="col-span-1">
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase font-black">Entrega Esperada</p>
                  <Input 
                    type="date" 
                    min={localDoc?.date ? localDoc.date.split('T')[0] : ''}
                    value={typeof localDoc?.expectedDelivery === 'string' && localDoc.expectedDelivery.includes('T') ? localDoc.expectedDelivery.split('T')[0] : localDoc?.expectedDelivery || ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, expectedDelivery: e.target.value } as any)} 
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
                        handleUpdate(localDoc!.id, { items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal });
                      }}
                      placeholder="Seleccionar Producto..."
                    />
                    {item.productId && (
                      <div className="mt-1 flex flex-wrap items-center gap-2 px-1">
                        {(() => {
                          const p = products.find(x => x.id === item.productId);
                          if (!p) return null;
                          const stock = Number(p.stock || 0);
                          return (
                            <>
                              <Badge variant="outline" className={cn(
                                "text-[9px] font-black border-none px-1.5 py-0 h-4 bg-muted/20",
                                stock <= 0 ? "text-rose-500 bg-rose-500/10" : "text-emerald-500 bg-emerald-500/10"
                              )}>
                                STOCK: {stock}
                              </Badge>
                              <span className="text-[9px] font-bold text-muted-foreground/60 uppercase">
                                Costo: {formatConvertedAmount(Number(p.costPrice || 0))} | Venta: {formatConvertedAmount(Number(p.salePrice || 0))}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    )}
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
                          let newQty = Number(e.target.value);
                          const p = products.find(x => x.id === item.productId);
                          if (p && newQty > Number(p.stock || 0)) {
                            toast.warning(`Stock insuficiente. Disponible: ${p.stock}`, { id: `stock-warn-${idx}` });
                          }
                          const newItems = [...(localDoc.items || [])] as any[];
                          newItems[idx].quantity = newQty;
                          newItems[idx].total = newQty * Number(newItems[idx].unitPrice || 0);
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
                      {localDoc?.currency === 'USD' ? '$' : 'C$'} {Number(item.total || 0).toLocaleString()}
                    </span>
                    <Button variant="ghost" size="icon" className="size-8 md:size-6 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 rounded-lg md:rounded-md" onClick={() => {
                        const newItems = [...(localDoc.items || [])] as any[];
                        newItems.splice(idx, 1);
                        const newSubtotal = newItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
                        const dAmount = newSubtotal * (localRates.dRate / 100);
                        const base = newSubtotal - dAmount;
                        const tAmount = base * (localRates.tRate / 100);
                        const newTotal = base + tAmount;
                        setLocalDoc({ ...localDoc, items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                    }}>
                      <Trash2 className="size-4 md:size-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {(!localDoc.items || localDoc.items.length === 0) && (
                <div className="text-center py-6 text-xs text-muted-foreground/50 italic border border-dashed border-border/50 rounded-xl bg-muted/10">
                  No hay productos o servicios asignados a esta orden. Haz clic en "Agregar Item".
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
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Órdenes de Venta</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Sincronización total de pedidos y logística.</p>
          </div>
          <div className="flex items-center gap-3">
            {canPerform('SALES_ORDERS', 'create') && (
              <Button onClick={handleAddOrder} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20">
                <FilePlus className="size-4" /> Nueva Orden
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
                await salesOrdersService.delete(id as string);
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
          allowAddRow={false}
          actions={(row) => (
            <>
              {canPerform('SALES_ORDERS', 'edit') && row.status === 'DRAFT' && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  title="Pasar a Pendiente"
                  className="hover:bg-blue-500/10 text-foreground hover:text-foreground hover:scale-110 transition-transform" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setStateChangePending({ id: row.id, status: 'PENDING_REVIEW', label: 'PENDIENTE' });
                  }}
                >
                  <Send className="size-4" />
                </Button>
              )}

              {canPerform('SALES_ORDERS', 'edit') && row.status === 'PENDING_REVIEW' && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  title="Aprobar y Facturar"
                  className="size-8 rounded-lg text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setStateChangePending({ id: row.id, status: 'SHIPPED', label: 'FACTURADA' });
                  }}
                >
                  <CheckCircle2 className="size-4" />
                </Button>
              )}

              {canPerform('SALES_ORDERS', 'edit') && row.status === 'CANCELLED' && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  title="Re-activar a Pendiente"
                  className="size-8 rounded-lg text-blue-500 hover:bg-blue-500/10 hover:text-blue-500 transition-colors" 
                  onClick={(e) => {
                    e.stopPropagation();
                    setStateChangePending({ id: row.id, status: 'PENDING_REVIEW', label: 'PENDIENTE' });
                  }}
                >
                  <Send className="size-4" />
                </Button>
              )}

              {canPerform('SALES_ORDERS', 'edit') && (row.status === 'DRAFT' || row.status === 'PENDING_REVIEW') && (
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

              <Button variant="ghost" title="Descargar PDF" size="icon" className="size-8 rounded-lg text-slate-500 hover:bg-slate-500/10 hover:text-slate-500 transition-colors" onClick={async (e) => { 
                e.stopPropagation();
                try { 
                  await toast.promise(generateEstimatePDF({ 
                    estimate: row, 
                    tenantName: user?.tenantName || 'Empresa', 
                    formatAmount: formatConvertedAmount, 
                    tenantLogo: themeConfig?.logo, 
                    documentType: 'order',
                    primaryColor: themeConfig?.colors.primary
                  }), { 
                    loading: 'Generando PDF...', 
                    success: 'PDF generado', 
                    error: 'Error al generar PDF' 
                  }); 
                } catch(e) { console.error(e) } 
              }}>
                <FileDown className="size-4" />
              </Button>

              <Button variant="ghost" size="icon" className="size-8 rounded-lg text-primary hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setEditingId(row.id)}>
                <Eye className="size-4" />
              </Button>

              {canPerform('SALES_ORDERS', 'delete') && (
                <Button variant="ghost" size="icon" className="size-8 rounded-lg text-rose-500 hover:bg-rose-500/10 hover:text-rose-500 transition-colors" onClick={() => setPendingDeleteId(row.id)}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </>
          )}
        />
       </div>

      <ConfirmDialog
        open={stateChangePending !== null}
        onOpenChange={(open) => { if (!open) setStateChangePending(null); }}
        title={`Actualizar a ${stateChangePending?.label}`}
        description={`Vas a cambiar el estado de la orden de venta. Esto mantendrá el flujo de despacho actualizado.`}
        confirmLabel="Continuar"
        variant="default"
        onConfirm={async () => {
          if (!stateChangePending) return;
          await handleUpdate(stateChangePending.id, { status: stateChangePending.status as any });
          setStateChangePending(null);
        }}
      />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
        title="¿Eliminar orden de venta?"
        description="¿Estás seguro de que deseas eliminar este registro permanentemente? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={async () => {
          if (!pendingDeleteId) return;
          try {
            setDeleteLoading(true);
            await salesOrdersService.delete(pendingDeleteId);
            toast.success('Registro eliminado');
            if (editingId === pendingDeleteId) setEditingId(null);
            onRefresh();
          } catch (error: any) {
            toast.error(error?.message || 'Error al eliminar');
          } finally {
            setDeleteLoading(false);
            setPendingDeleteId(null);
          }
        }}
      />
    </div>
  );
}

