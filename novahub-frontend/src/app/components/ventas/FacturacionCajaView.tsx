import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calculator, Plus, Trash2, Loader2, Receipt, Search,
  CreditCard, Clock, Settings2, Banknote, Edit2
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { inventoryService } from '../../services/inventario.service';
import {
  cajaService,
  type CashRegister,
  type PosProduct,
  type PosCustomer,
  type PosInvoice,
  type PosInvoiceItem,
} from '../../services/caja.service';

interface CartItem extends PosInvoiceItem {
  productId: string;
  lineTotal: number;
}

interface InvoiceSummary {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
}

const GENERAL_CUSTOMER_SELECT_VALUE = '__general_customer__';
const GENERAL_CUSTOMER_NAME = 'Cliente General';
const MIN_QUANTITY = 1;
const MIN_DISCOUNT_PERCENT = 0;
const MAX_DISCOUNT_PERCENT = 100;

function getTodayInputDate() {
  return new Date().toISOString().split('T')[0];
}

function formatCurrency(value: number | string) {
  return `C$ ${Number(value).toFixed(2)}`;
}

function formatInvoiceDate(date: string) {
  return new Date(date).toLocaleDateString('es-NI');
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function calculateLineTotal(quantity: number, unitPrice: number) {
  return quantity * unitPrice;
}

function normalizeQuantity(value: string, fallback: number) {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity >= MIN_QUANTITY ? quantity : fallback;
}

function normalizeDiscountPercent(value: string) {
  const discount = Number(value);
  if (!Number.isFinite(discount)) return MIN_DISCOUNT_PERCENT;
  return Math.min(Math.max(discount, MIN_DISCOUNT_PERCENT), MAX_DISCOUNT_PERCENT);
}

function calculateInvoiceSummary(
  cart: CartItem[],
  productsById: Map<string, PosProduct>,
  discountPercent: number,
): InvoiceSummary {
  const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const tax = cart.reduce((sum, item) => {
    const product = productsById.get(item.productId);
    return sum + (product ? item.lineTotal * (product.taxRate / 100) : 0);
  }, 0);
  const discount = subtotal * (discountPercent / 100);

  return {
    subtotal,
    tax,
    discount,
    total: subtotal + tax - discount,
  };
}

function buildInvoiceItems(cart: CartItem[]): PosInvoiceItem[] {
  return cart.map((item) => ({
    productId: item.productId,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }));
}

function getInvoiceCustomerName(invoice: PosInvoice) {
  return invoice.customer?.name || invoice.customCustomerName || GENERAL_CUSTOMER_NAME;
}

export function FacturacionCajaView() {
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<PosInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [selectedRegisterId, setSelectedRegisterId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [emitDate, setEmitDate] = useState(getTodayInputDate());
  const [discountPercent, setDiscountPercent] = useState(0);
  const [productSearch, setProductSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { user } = useAuth();

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [cashRegisters, availableProducts, registeredCustomers] = await Promise.all([
        cajaService.getRegisters(),
        cajaService.getProducts(),
        cajaService.getCustomers(),
      ]);
      setRegisters(cashRegisters);
      setProducts(availableProducts);
      setCustomers(registeredCustomers);
      if (cashRegisters.length > 0) {
        setSelectedRegisterId(cashRegisters[0].id);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Error al cargar datos de caja'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRecentInvoices = useCallback(async (registerId: string) => {
    try {
      setRecentInvoices(await cajaService.getRecentInvoices(registerId));
    } catch (error: unknown) {
      setRecentInvoices([]);
      toast.error(getErrorMessage(error, 'Error al cargar historial de caja'));
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (!selectedRegisterId) {
      setRecentInvoices([]);
      return;
    }

    void loadRecentInvoices(selectedRegisterId);
  }, [loadRecentInvoices, selectedRegisterId]);

  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  // Búsqueda dinámica en el backend
  useEffect(() => {
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const availableProducts = await cajaService.getProducts(productSearch.trim() || undefined);
        setProducts(availableProducts);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [productSearch]);

  const filteredProducts = products; // Ya están filtrados por el backend

  const addItem = (product: PosProduct) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id
            ? {
                ...i,
                quantity: i.quantity + 1,
                lineTotal: calculateLineTotal(i.quantity + 1, i.unitPrice),
              }
            : i,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          description: product.name,
          quantity: 1,
          unitPrice: product.salePrice,
          lineTotal: calculateLineTotal(1, product.salePrice),
        },
      ];
    });
  };

  const updateQty = (productId: string, quantity: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, quantity, lineTotal: calculateLineTotal(quantity, item.unitPrice) }
          : item,
      ),
    );
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const summary = useMemo(
    () => calculateInvoiceSummary(cart, productsById, discountPercent),
    [cart, discountPercent, productsById],
  );

  const selectedRegister = registers.find((r) => r.id === selectedRegisterId);

  const handleCustomerChange = (value: string) => {
    setSelectedCustomerId(
      value === GENERAL_CUSTOMER_SELECT_VALUE ? undefined : value,
    );
  };

  const handlePay = async () => {
    if (cart.length === 0) {
      toast.error('Agregá al menos un producto');
      return;
    }

    if (!selectedRegisterId) {
      toast.error('Seleccioná una caja');
      return;
    }

    setSubmitting(true);
    try {
      await cajaService.createInvoice({
        registerId: selectedRegisterId,
        customerId: selectedCustomerId,
        customCustomerName: selectedCustomerId ? undefined : GENERAL_CUSTOMER_NAME,
        date: emitDate,
        discountPercent: discountPercent || undefined,
        items: buildInvoiceItems(cart),
      });
      toast.success('Factura emitida exitosamente');
      setCart([]);
      setDiscountPercent(0);
      setSelectedCustomerId(undefined);
      await loadRecentInvoices(selectedRegisterId);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Error al emitir factura'));
    } finally {
      setSubmitting(false);
    }
  };

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }



  if (registers.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="size-20 rounded-full bg-rose-500/10 flex items-center justify-center mb-6">
            <CreditCard className="size-10 text-rose-500" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-foreground mb-2 uppercase">Acceso Restringido a POS</h2>
          <p className="text-muted-foreground max-w-md mb-6">
            No tienes cajas autorizadas asignadas a tu usuario o no hay cajas activas en el sistema. 
            Contacta al administrador para que te asigne acceso a una sucursal/caja desde la configuración del equipo.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        <div className="space-y-5">
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                <Receipt className="size-4 text-primary" /> Configuración de Emisión
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Caja Operativa</Label>
                <Select value={selectedRegisterId} onValueChange={setSelectedRegisterId}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Seleccionar caja" /></SelectTrigger>
                  <SelectContent>
                    {registers.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.code} - {r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Cliente / Empresa</Label>
                <Select
                  value={selectedCustomerId ?? GENERAL_CUSTOMER_SELECT_VALUE}
                  onValueChange={handleCustomerChange}
                >
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder={GENERAL_CUSTOMER_NAME} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={GENERAL_CUSTOMER_SELECT_VALUE}>{GENERAL_CUSTOMER_NAME}</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Fecha de Emisión</Label>
                <Input type="date" value={emitDate} onChange={(e) => setEmitDate(e.target.value)} className="h-11 rounded-xl" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-tight">Catálogo de Productos</h3>
              <div className="relative max-w-xs">
                {isSearching ? (
                  <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" />
                ) : (
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                )}
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar producto..."
                  className="pl-9 h-9 rounded-lg text-xs focus-visible:ring-primary focus-visible:border-primary"
                />
              </div>
            </div>
            <div className="border border-border/50 rounded-xl overflow-hidden">
              <div className="overflow-y-auto max-h-56">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/30">
                      <th className="px-3 py-2.5 text-left font-black uppercase tracking-widest text-[10px] text-muted-foreground">Código</th>
                      <th className="px-3 py-2.5 text-left font-black uppercase tracking-widest text-[10px] text-muted-foreground">Descripción del Producto</th>
                      <th className="px-3 py-2.5 text-right font-black uppercase tracking-widest text-[10px] text-muted-foreground">Precio Unit. (C$)</th>
                      <th className="px-3 py-2.5 text-center font-black uppercase tracking-widest text-[10px] text-muted-foreground">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {filteredProducts.map((prod) => (
                      <tr key={prod.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2 font-mono text-primary font-bold">{prod.code}</td>
                        <td className="px-3 py-2 font-bold">{prod.name}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatCurrency(prod.salePrice)}</td>
                        <td className="px-3 py-2 text-center">
                          <Button size="sm" variant="ghost" onClick={() => addItem(prod)}
                            className="h-7 px-2 text-[10px] font-bold text-primary hover:bg-primary/10 rounded-lg">
                            <Plus className="size-3 mr-1" /> Agregar
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filteredProducts.length === 0 && (
                      <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No hay productos disponibles</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <h3 className="text-sm font-black uppercase tracking-tight mb-4">
              Detalle Factura{' '}
              {selectedRegister && (
                <span className="text-primary">({selectedRegister.code} - {selectedRegister.name})</span>
              )}
            </h3>
            {cart.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No hay ítems agregados en esta caja{selectedRegister ? ` (${selectedRegister.code} - ${selectedRegister.name})` : ''}.
              </p>
            ) : (
              <div className="border border-border/50 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/30">
                      <th className="px-3 py-2.5 text-left font-black uppercase tracking-widest text-[10px] text-muted-foreground">Descripción</th>
                      <th className="px-3 py-2.5 text-center font-black uppercase tracking-widest text-[10px] text-muted-foreground">Cant</th>
                      <th className="px-3 py-2.5 text-right font-black uppercase tracking-widest text-[10px] text-muted-foreground">Precio Unit.</th>
                      <th className="px-3 py-2.5 text-right font-black uppercase tracking-widest text-[10px] text-muted-foreground">Subtotal</th>
                      <th className="px-3 py-2.5 text-center font-black uppercase tracking-widest text-[10px] text-muted-foreground">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {cart.map((item) => (
                      <tr key={item.productId} className="hover:bg-muted/20 transition-colors">
                        <td className="px-3 py-2 font-bold">{item.description}</td>
                        <td className="px-3 py-2 text-center">
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              updateQty(
                                item.productId,
                                normalizeQuantity(e.target.value, item.quantity),
                              )
                            }
                            className="h-7 w-16 rounded-lg text-center text-xs font-mono"
                            min={1}
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold">{formatCurrency(item.lineTotal)}</td>
                        <td className="px-3 py-2 text-center">
                          <Button variant="ghost" onClick={() => removeItem(item.productId)}
                            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 rounded-lg">
                            <Trash2 className="size-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="border-border/50 shadow-sm sticky top-24">
          <CardContent className="p-5 space-y-4">
            <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
              <Calculator className="size-4 text-primary" /> Resumen Financiero
            </h3>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Aplicar Descuento (%)</Label>
              <Input
                type="number"
                value={discountPercent || ''}
                onChange={(e) => setDiscountPercent(normalizeDiscountPercent(e.target.value))}
                placeholder="0"
                className="h-10 rounded-xl"
                min={0}
                max={100}
              />
            </div>
            <div className="space-y-2 pt-2 border-t border-border/30">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Subtotal Bruto:</span>
                <span className="font-mono">{formatCurrency(summary.subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Descuento aplicado:</span>
                <span className="font-mono text-destructive">- {formatCurrency(summary.discount)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">IVA calculado:</span>
                <span className="font-mono">{formatCurrency(summary.tax)}</span>
              </div>
            </div>
            <div className="pt-3 border-t border-border/30">
              <div className="flex justify-between items-center">
                <span className="text-sm font-black">Total a Pagar:</span>
                <span className="text-xl font-black text-primary">{formatCurrency(summary.total)}</span>
              </div>
            </div>
            <Button
              size="lg"
              onClick={handlePay}
              disabled={submitting || cart.length === 0}
              className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest gap-2 shadow-lg shadow-primary/20"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
              Pagar y Emitir Factura
            </Button>
            <Button variant="outline" onClick={clearCart} className="w-full h-10 rounded-xl font-bold text-xs gap-2">
              Limpiar
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2 mb-3">
              <Clock className="size-4 text-primary" /> Historial Reciente por Caja
            </h3>
            {recentInvoices.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No hay facturas emitidas en esta sesión.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {recentInvoices.map((inv) => (
                  <div key={inv.id} className="rounded-xl border border-border/30 px-3 py-2 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">{inv.number}</span>
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[9px]">{inv.status}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {getInvoiceCustomerName(inv)} &middot; {formatInvoiceDate(inv.date)}
                      </p>
                    </div>
                    <span className="text-xs font-black font-mono shrink-0">{formatCurrency(inv.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  </>
);
}
