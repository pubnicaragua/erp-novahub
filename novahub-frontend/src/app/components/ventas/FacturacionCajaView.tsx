import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calculator, Plus, Trash2, Loader2, Receipt, Search,
  CreditCard, Clock, CircleHelp, ShoppingCart, List, LayoutGrid,
  UserPlus, PackagePlus, AlertCircle
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { Switch } from '../ui/switch';
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';
import { ProductThumbnail } from '../ui/ProductImage';
import { useCurrency } from '../../contexts/CurrencyContext';
import {
  cajaService,
  type CashRegister,
  type PosProduct,
  type PosCustomer,
  type PosInvoice,
  type PosInvoiceItem,
} from '../../services/caja.service';
import { AddProductsModal } from '../inventory/AddProductsModal';
import { QuickAddCustomerModal } from './QuickAddCustomerModal';

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

type CatalogViewMode = 'list' | 'catalog';

const CATALOG_VIEW_STORAGE_KEY = 'novahub-pos-catalog-view';

function getInitialCatalogView(): CatalogViewMode {
  try {
    return localStorage.getItem(CATALOG_VIEW_STORAGE_KEY) === 'catalog' ? 'catalog' : 'list';
  } catch {
    return 'list';
  }
}

const GENERAL_CUSTOMER_SELECT_VALUE = '__general_customer__';
const GENERAL_CUSTOMER_NAME = 'Cliente General';
const MIN_QUANTITY = 1;
const MIN_DISCOUNT_PERCENT = 0;
const MAX_DISCOUNT_PERCENT = 100;

const POS_TOUR_STEPS: GuidedTourStep[] = [
  {
    target: '[data-tour="pos-register"]',
    title: '1. Selecciona la caja operativa',
    description: 'Toda factura debe registrarse en una caja. Elige la caja donde estás atendiendo para que el ingreso, el movimiento de caja y la contabilidad queden relacionados correctamente.',
    tip: 'Si no aparece ninguna opción, primero debes crear o habilitar una caja desde el módulo de Caja.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="pos-customer"]',
    title: '2. Identifica al cliente',
    description: 'Selecciona un cliente registrado cuando necesites conservar su historial y saldo. Para una venta rápida sin datos específicos, puedes dejar “Cliente General”.',
    tip: 'Usar un cliente registrado facilita después consultar facturas, pagos y cuentas pendientes.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="pos-date"]',
    title: '3. Confirma la fecha de emisión',
    description: 'Esta fecha se guardará como la fecha oficial de la venta y se utilizará en los reportes financieros y contables.',
    tip: 'Normalmente se utiliza la fecha de hoy. Cámbiala solamente cuando estés registrando una operación autorizada de otra fecha.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="pos-catalog"]',
    title: '4. Agrega productos desde el catálogo',
    description: 'Busca por código o nombre y presiona “Agregar”. Puedes agregar varios productos; si agregas el mismo nuevamente, aumentará su cantidad en la factura.',
    tip: 'El precio mostrado proviene del catálogo de inventario. Verifica que productos, precios e IVA estén configurados antes de facturar.',
    placement: 'right',
  },
  {
    target: '[data-tour="pos-cart"]',
    title: '5. Revisa el detalle de la factura',
    description: 'Aquí puedes cambiar cantidades, comprobar precios y eliminar líneas antes de cobrar. El subtotal se recalcula automáticamente con cada ajuste.',
    tip: 'Revisa cuidadosamente el detalle antes de emitir: después de facturar, las correcciones deben manejarse mediante los procesos de devolución o nota de crédito.',
    placement: 'right',
  },
  {
    target: '[data-tour="pos-summary"]',
    title: '6. Comprueba descuento, IVA y total',
    description: 'Aplica un descuento porcentual si corresponde. El sistema calcula el IVA según la tasa configurada en cada producto y muestra el total final en córdobas (C$).',
    tip: 'El descuento afecta el subtotal. El IVA no se escribe manualmente aquí: se toma de la configuración del producto.',
    placement: 'left',
  },
  {
    target: '[data-tour="pos-pay"]',
    title: '7. Cobra y emite la factura',
    description: 'Cuando todo esté correcto, presiona “Pagar y Emitir Factura”. El sistema registrará la venta y alimentará los movimientos financieros, de caja y contabilidad.',
    tip: 'El botón solo se habilita cuando agregas al menos un producto y existe una caja seleccionada.',
    placement: 'left',
  },
  {
    target: '[data-tour="pos-history"]',
    title: '8. Verifica la operación en el historial',
    description: 'Después de emitir, la factura aparecerá aquí con su número, cliente, fecha, estado y total. El historial cambia cuando seleccionas otra caja.',
    tip: 'Ya conoces el flujo completo. Puedes volver a abrir este tutorial cuando quieras desde el botón “Cómo facturar”.',
    placement: 'left',
  },
];

function getTodayInputDate() {
  return new Date().toISOString().split('T')[0];
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
  includeTax: boolean
): InvoiceSummary {
  const subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const tax = includeTax ? cart.reduce((sum, item) => {
    return sum + (item.lineTotal * 0.15);
  }, 0) : 0;
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
  const { formatConvertedAmount: formatCurrency } = useCurrency();
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<PosInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);

  const [selectedRegisterId, setSelectedRegisterId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [emitDate, setEmitDate] = useState(getTodayInputDate());
  const [discountPercent, setDiscountPercent] = useState(0);
  const [productSearch, setProductSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [includeTax, setIncludeTax] = useState(true);
  const [catalogView, setCatalogView] = useState<CatalogViewMode>(getInitialCatalogView);

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);

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

  const handleProductCreated = useCallback(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const handleCustomerCreated = useCallback(() => {
    cajaService.getCustomers().then(setCustomers);
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    try {
      localStorage.setItem(CATALOG_VIEW_STORAGE_KEY, catalogView);
    } catch {
      // La preferencia es opcional; la vista sigue funcionando sin almacenamiento local.
    }
  }, [catalogView]);

  useEffect(() => {
    if (!selectedRegisterId) {
      setRecentInvoices([]);
      setHasActiveSession(false);
      return;
    }

    void loadRecentInvoices(selectedRegisterId);
    
    setCheckingSession(true);
    cajaService.getActiveSession(selectedRegisterId).then(session => {
      setHasActiveSession(!!session);
      setCheckingSession(false);
    }).catch(() => {
      setHasActiveSession(false);
      setCheckingSession(false);
    });
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
    () => calculateInvoiceSummary(cart, productsById, discountPercent, includeTax),
    [cart, discountPercent, productsById, includeTax],
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
        includeTax,
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/40 bg-gradient-to-r from-primary/10 via-background to-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/15 p-2.5"><ShoppingCart className="size-5 text-primary" /></div>
          <div>
            <h2 className="text-base font-black uppercase tracking-tight">Facturación por Caja</h2>
            <p className="text-xs text-muted-foreground">Venta rápida, cobro y registro contable en un mismo flujo.</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddCustomer(true)}
            className="h-10 gap-2 px-3 text-xs font-black rounded-xl border-primary/30 hover:bg-primary/10 shadow-sm bg-background/80"
          >
            <UserPlus className="size-4 text-primary" /> Agregar Cliente
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddProduct(true)}
            className="h-10 gap-2 px-3 text-xs font-black rounded-xl border-primary/30 hover:bg-primary/10 shadow-sm bg-background/80"
          >
            <PackagePlus className="size-4 text-primary" /> Agregar Producto
          </Button>
          <Button type="button" variant="outline" onClick={() => setShowTutorial(true)} className="h-10 rounded-xl border-primary/30 bg-background/80 text-xs font-black text-primary shadow-sm hover:bg-primary/10">
            <CircleHelp className="mr-2 size-4" /> Cómo facturar
          </Button>
        </div>
      </div>
      
      {!checkingSession && !hasActiveSession && selectedRegisterId && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="size-5 shrink-0" />
          <div>
            <p className="font-bold text-sm">Caja Cerrada</p>
            <p className="text-xs">Debe aperturar esta caja en la pestaña "Control de Caja" antes de poder emitir facturas.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
      <div className="space-y-5">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <h3 className="text-sm font-black uppercase tracking-tight mb-4 flex items-center gap-2">
              <Receipt className="size-4 text-primary" /> Configuración de Emisión
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5" data-tour="pos-register">
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
              <div className="space-y-1.5" data-tour="pos-customer">
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
              <div className="space-y-1.5" data-tour="pos-date">
                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Fecha de Emisión</Label>
                <Input type="date" value={emitDate} onChange={(e) => setEmitDate(e.target.value)} className="h-11 rounded-xl" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm" data-tour="pos-catalog">
          <CardContent className="p-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight">Catálogo de Productos</h3>
                <p className="mt-1 text-[11px] text-muted-foreground">{filteredProducts.length} productos disponibles</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="inline-flex h-9 items-center rounded-xl border border-border/60 bg-muted/30 p-1" role="group" aria-label="Vista del catálogo">
                  <button
                    type="button"
                    aria-pressed={catalogView === 'list'}
                    onClick={() => setCatalogView('list')}
                    className={`flex h-7 items-center gap-1.5 rounded-lg px-3 text-[10px] font-black uppercase tracking-wider transition-all ${
                      catalogView === 'list' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <List className="size-3.5" /> Lista
                  </button>
                  <button
                    type="button"
                    aria-pressed={catalogView === 'catalog'}
                    onClick={() => setCatalogView('catalog')}
                    className={`flex h-7 items-center gap-1.5 rounded-lg px-3 text-[10px] font-black uppercase tracking-wider transition-all ${
                      catalogView === 'catalog' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <LayoutGrid className="size-3.5" /> Catálogo
                  </button>
                </div>
                <div className="relative w-full sm:w-64">
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
            </div>
            {catalogView === 'list' ? (
              <div className="overflow-hidden rounded-xl border border-border/50">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/30">
                        <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">Código</th>
                        <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descripción del Producto</th>
                        <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Precio Unit. (C$)</th>
                        <th className="px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {filteredProducts.map((prod) => (
                        <tr key={prod.id} className="transition-colors hover:bg-muted/20">
                          <td className="px-3 py-2.5 font-mono font-bold text-primary">{prod.code}</td>
                          <td className="px-3 py-2.5">
                            <p className="truncate font-bold">{prod.name}</p>
                            {prod.description && <p className="max-w-[320px] truncate text-[10px] text-muted-foreground">{prod.description}</p>}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">{formatCurrency(prod.salePrice)}</td>
                          <td className="px-3 py-2.5 text-center">
                            <Button size="sm" variant="ghost" onClick={() => addItem(prod)}
                              className="h-7 rounded-lg px-2 text-[10px] font-bold text-primary hover:bg-primary/10">
                              <Plus className="mr-1 size-3" /> Agregar
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {filteredProducts.length === 0 && (
                        <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">No hay productos disponibles</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="max-h-[34rem] overflow-y-auto pr-1">
                {filteredProducts.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                    {filteredProducts.map((prod) => (
                      <article key={prod.id} className="group overflow-hidden rounded-2xl border border-border/60 bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
                        <ProductThumbnail
                          src={prod.imageUrl}
                          alt={prod.name}
                          size="catalog"
                          fit="contain"
                          className="rounded-none border-x-0 border-t-0 bg-muted/25 p-3 shadow-none"
                        />
                        <div className="space-y-3 p-4">
                          <div>
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                              <Badge variant="outline" className="font-mono text-[9px] text-primary">{prod.code}</Badge>
                              <span className="font-mono text-sm font-black text-primary">{formatCurrency(prod.salePrice)}</span>
                            </div>
                            <h4 className="truncate text-sm font-black">{prod.name}</h4>
                            <p className="mt-1 line-clamp-2 min-h-8 text-[11px] leading-4 text-muted-foreground">
                              {prod.description || 'Producto disponible para facturación inmediata.'}
                            </p>
                          </div>
                          <Button onClick={() => addItem(prod)} className="h-9 w-full rounded-xl text-[10px] font-black uppercase tracking-wider">
                            <ShoppingCart className="mr-2 size-3.5" /> Agregar a factura
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
                    No hay productos disponibles
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm" data-tour="pos-cart">
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
        <Card className="border-border/50 shadow-sm sticky top-24" data-tour="pos-summary">
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
            <div className="flex items-center justify-between pt-2">
              <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Incluir IVA</Label>
              <Switch checked={includeTax} onCheckedChange={setIncludeTax} />
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
              data-tour="pos-pay"
              onClick={handlePay}
              disabled={submitting || cart.length === 0 || !hasActiveSession || checkingSession}
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

        <Card className="border-border/50 shadow-sm" data-tour="pos-history">
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
      {showTutorial && <GuidedTour steps={POS_TOUR_STEPS} onClose={() => setShowTutorial(false)} title="Facturación por Caja" />}
      <AddProductsModal
        open={showAddProduct}
        onOpenChange={setShowAddProduct}
        onRefresh={handleProductCreated}
      />
      <QuickAddCustomerModal
        open={showAddCustomer}
        onOpenChange={setShowAddCustomer}
        onSuccess={handleCustomerCreated}
      />
    </div>
  );
}
