import { useState, useEffect } from 'react';
import { 
  ClipboardList, Plus, Search, TrendingUp, Clock, FilePlus, Package, Eye, Trash2, ChevronLeft
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
import { FileDown } from 'lucide-react';

interface OrdenesVentaViewProps {
  data: SalesOrder[];
  loading: boolean;
  onRefresh: () => Promise<void> | void;
  onGenerateInvoice: (order: SalesOrder) => void;
  customers?: Customer[];
  products?: Product[];
}

const statusOptions = [
  { label: 'Pendiente Revisión', value: 'PENDING_REVIEW', color: 'bg-orange-500/10 text-orange-500' },
  { label: 'Borrador',       value: 'DRAFT',       color: 'bg-muted/20 text-muted-foreground' },
  { label: 'Confirmada',     value: 'CONFIRMED',   color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'En Proceso',     value: 'IN_PROGRESS', color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Enviada',        value: 'SHIPPED',     color: 'bg-purple-500/10 text-purple-500' },
  { label: 'Entregada',      value: 'DELIVERED',   color: 'bg-cyan-500/10 text-cyan-500' },
  { label: 'Cancelada',      value: 'CANCELLED',   color: 'bg-rose-500/10 text-rose-500' },
];

export function OrdenesVentaView({ data, loading, onRefresh, onGenerateInvoice, customers = [], products = [] }: OrdenesVentaViewProps) {
  const { exchangeRate: globalRate, displayCurrency, formatConvertedAmount, convertAmount, formatAmount } = useCurrency();
  const { user, canPerform } = useAuth();
  const { themeConfig } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<SalesOrder | null>(null);

  useEffect(() => {
    if (editingId) {
      const e = data.find(x => x.id === editingId);
      setLocalDoc(e ? JSON.parse(JSON.stringify(e)) : null);
    } else {
      setLocalDoc(null);
    }
  }, [editingId, data]);

  const filtered = data.filter(o => 
    o.number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (o.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdate = async (id: string | number, updates: Partial<SalesOrder>) => {
    try {
      if (updates.status && String(updates.status).toUpperCase() === 'SHIPPED') {
        const orderToConvert = data.find(o => o.id === id) || localDoc;
        if (orderToConvert) {
          await salesOrdersService.update(id.toString(), { status: 'SHIPPED' as any });
          toast.success('Orden enviada. Redirigiendo a factura...');
          onRefresh(); // trigger background refresh
          onGenerateInvoice({ ...orderToConvert, status: 'SHIPPED' as any });
          return;
        }
      }

      await salesOrdersService.update(id.toString(), updates);
      toast.success('Orden actualizada');
      onRefresh();
    } catch (error: any) {
       const msg = error.response?.data?.message;
       toast.error(`Error al actualizar status: ${Array.isArray(msg) ? msg.join(', ') : (msg || error.message)}`);
       throw error;
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
    if (editingId) {
      const e = data.find(x => x.id === editingId);
      setLocalDoc(e ? JSON.parse(JSON.stringify(e)) : null);
      if (e) setLocalRates(calculateRates(e));
    } else {
      setLocalDoc(null);
      setLocalRates({ dRate: 0, tRate: 0 });
    }
  }, [editingId]); // Intentionally removed 'data' to prevent server-refreshes from destroying mid-edit local states

  const handleAddOrder = async () => {
    if (!customers || customers.length === 0) {
      toast.error('Debe registrar al menos un cliente primero');
      return;
    }
    try {
      toast.info('Creando orden de venta...');
      const newOrd = await salesOrdersService.create({
        customerId: customers[0].id,
        date: new Date().toISOString(),
        expectedDelivery: new Date(Date.now() + 7 * 86400000).toISOString(),
        discountAmount: 0,
        total: 0,
        currency: displayCurrency as any,
        exchangeRate: globalRate,
        status: 'DRAFT' as any,
        items: [],
        number: `ORD-${Date.now().toString().slice(-6)}`
      });
      await onRefresh();
      toast.success('Nueva orden de venta en borrador creada exitosamente');
      setEditingId(newOrd.id);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al crear la orden de venta');
    }
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
      editable: canPerform('SALES_ORDERS', 'edit'),
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

  const confirmedAmountInDisplayCurrency = data
    .filter(order => (order.status || '').toUpperCase() === 'CONFIRMED')
    .reduce((acc, order) => acc + convertAmount(order.total || 0, order.currency, order.exchangeRate), 0);

  const kpis = [
    { title: 'Órdenes Abiertas',  value: data.filter(o => (o.status||'').toUpperCase() === 'CONFIRMED').length, icon: Package, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    {
      title: `Monto Confirmado (${displayCurrency})`,
      value: formatConvertedAmount(confirmedAmountInDisplayCurrency, displayCurrency),
      icon: TrendingUp,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    { title: 'En Proceso',        value: data.filter(o => (o.status||'').toUpperCase() === 'IN_PROGRESS').length, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Total del Mes',     value: data.length, icon: ClipboardList, color: 'text-purple-500', bg: 'bg-purple-500/10' },
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
              <h2 className="text-xl font-black uppercase tracking-tight">Orden {localDoc?.number}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Detalle de la orden de venta</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {canPerform('SALES_ORDERS', 'edit') && (
              <>
                <Button variant="outline" className="rounded-xl border-border/50 font-black uppercase text-[10px] tracking-widest px-6"
                  onClick={() => { handleUpdate(localDoc!.id, { status: 'DRAFT' as any }); setEditingId(null); }}>
                  Guardar Borrador
                </Button>
                <Button className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6"
                  onClick={() => { handleUpdate(localDoc!.id, { status: 'CONFIRMED' as any }); setEditingId(null); toast.success('Orden confirmada'); }}>
                  Confirmar Orden
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Número</p>
                  <Input defaultValue={localDoc?.number} onBlur={(e) => handleUpdate(localDoc!.id, { number: e.target.value })} className="h-8 text-xs font-black uppercase" />
                </div>
                <div><p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${statusOpt?.color || 'bg-muted/20 text-muted-foreground'}`}>{statusOpt?.label || localDoc?.status}</span>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Cliente</p>
                  <Combobox 
                    options={(customers || [])
                      .filter(c => (c.status || '').toUpperCase() === 'ACTIVE' || c.id === localDoc?.customerId)
                      .map(c => ({ label: c.name, value: c.id, description: (c.code ? `[${c.code}] ` : '') + (c.phone || 'Sin teléfono') }))}
                    value={localDoc?.customerId || ''}
                    onChange={(val) => handleUpdate(localDoc!.id, { customerId: val })}
                    placeholder="Seleccionar Cliente"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha Emisión</p>
                  <Input type="date" defaultValue={localDoc?.date ? new Date(localDoc.date).toISOString().split('T')[0] : ''} onBlur={(e) => handleUpdate(localDoc!.id, { date: new Date(e.target.value).toISOString() })} className="h-8 text-xs" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Entrega Esperada</p>
                  <Input type="date" defaultValue={localDoc?.expectedDelivery ? new Date(localDoc.expectedDelivery).toISOString().split('T')[0] : ''} onBlur={(e) => handleUpdate(localDoc!.id, { expectedDelivery: new Date(e.target.value).toISOString() })} className="h-8 text-xs" />
                </div>
                {/* Moneda se sincroniza dinamicamente con Topbar */}
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumen Financiero</p>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <div className="flex items-center gap-2">{localDoc?.currency === 'USD' ? '$' : 'C$'} <Input type="number" min="0" value={Number(localDoc?.subtotal||0)} readOnly className="w-28 h-8 text-right font-bold bg-muted/20" /></div>
                </div>
                <div className="flex justify-between items-center text-sm">
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
                <div className="flex justify-between items-center text-sm">
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
                <div className="flex justify-between items-center text-base border-t pt-3 border-border/50">
                  <span className="font-black">Total</span>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2 text-primary font-black">
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
                  <Plus className="size-3 mr-2" /> Agregar Item
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                <div className="col-span-6">Descripción</div>
                <div className="col-span-2 text-right">Cant.</div>
                <div className="col-span-2 text-right">Precio U.</div>
                <div className="col-span-2 text-right">Total</div>
              </div>
              {(localDoc.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-6">
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
                      <div className="mt-1 flex items-center gap-2 px-1">
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
                                Costo: {formatConvertedAmount(Number(p.costPrice || 0), 'NIO')} | Venta: {formatConvertedAmount(Number(p.salePrice || 0), 'NIO')}
                              </span>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                  <div className="col-span-2">
                    <Input 
                      type="number" 
                      min="0"
                      max={Number(products.find(x => x.id === item.productId)?.stock || 1000000)}
                      value={Number(item.quantity) || ''} 
                      placeholder="0"
                      onChange={(e) => {
                        let newQty = Number(e.target.value);
                        const p = products.find(x => x.id === item.productId);
                        if (p && newQty > Number(p.stock || 0)) {
                          toast.warning(`Stock insuficiente. Disponible: ${p.stock}`, { id: `stock-warn-${idx}` });
                          newQty = Number(p.stock || 0);
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
                      onBlur={() => {
                        handleUpdate(localDoc!.id, { items: localDoc.items, subtotal: localDoc.subtotal, discountAmount: localDoc.discountAmount, taxAmount: localDoc.taxAmount, total: localDoc.total });
                      }}
                      className="h-8 text-xs text-right" 
                    />
                  </div>
                  <div className="col-span-2">
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
                      onBlur={() => {
                        handleUpdate(localDoc!.id, { items: localDoc.items, subtotal: localDoc.subtotal, discountAmount: localDoc.discountAmount, taxAmount: localDoc.taxAmount, total: localDoc.total });
                      }}
                      className="h-8 text-xs text-right" 
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <span className="text-xs font-black w-16 text-right">{localDoc?.currency === 'USD' ? '$' : 'C$'} {Number(item.total || 0).toLocaleString()}</span>
                    <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 rounded-md" onClick={() => {
                        const newItems = [...(localDoc.items || [])] as any[];
                        newItems.splice(idx, 1);
                        const newSubtotal = newItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
                        const dAmount = newSubtotal * (localRates.dRate / 100);
                        const base = newSubtotal - dAmount;
                        const tAmount = base * (localRates.tRate / 100);
                        const newTotal = base + tAmount;
                        setLocalDoc({ ...localDoc, items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                        handleUpdate(localDoc!.id, { items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal });
                    }}>
                      <Trash2 className="size-3" />
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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-2">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Órdenes de Venta</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Órdenes confirmadas listas para preparación y facturación.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input 
                placeholder="Buscar orden..." 
                className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold tracking-widest"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {canPerform('SALES_ORDERS', 'create') && (
              <Button onClick={handleAddOrder} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20">
                <Plus className="size-4" /> Nueva Orden
              </Button>
            )}
          </div>
        </div>

        <EditableDataTable 
          data={filtered}
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
          actions={(row) => (
            <div className="flex items-center gap-1">
                {row.status === 'confirmed' && canPerform('SALES_ORDERS', 'edit') && (
                  <Button 
                    title="Generar Factura" 
                    onClick={() => onGenerateInvoice(row)}
                    variant="ghost" 
                    size="icon" 
                    className="size-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
                  >
                    <FilePlus className="size-4" />
                  </Button>
                )}
                <Button title="Ver detalle" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
                <Button title="Exportar PDF" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-slate-500/10 hover:text-slate-500 transition-colors" onClick={async () => { try { toast.promise(generateEstimatePDF({ estimate: row, tenantName: user?.tenantName || 'Empresa', formatAmount, tenantLogo: themeConfig?.logo, documentType: 'order' }), { loading: 'Generando PDF...', success: 'PDF generado exitosamente', error: 'Error al generar PDF' }); } catch(e) { console.error(e) } }}><FileDown className="size-4" /></Button>
                {canPerform('SALES_ORDERS', 'delete') && (
                  <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500 transition-colors" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
                )}
             </div>
           )}
         />
       </div>

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

