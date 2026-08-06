import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  Calculator, Plus, Trash2, Loader2, Receipt, Search,
  CreditCard, Clock, CircleHelp, ShoppingCart, List, LayoutGrid,
  UserPlus, AlertCircle, Coins
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
import { Combobox } from '../ui/Combobox';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../ui/utils';
import {
  cajaService,
  type CashRegister,
  type PosProduct,
  type PosCustomer,
  type PosInvoice,
  type PosInvoiceItem,
  type PosPaymentLine,
  type CashRegisterSession,
  type CashRegisterAvailability,
  type PotentialDuplicateSale,
} from '../../services/caja.service';
import { accountsService } from '../../services/finanzas.service';
import type { Account } from '../../types';
import { QuickAddCustomerModal } from './QuickAddCustomerModal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { brandingService } from '../../services/branding.service';
import { createIdempotencyKey } from '../../services/api';
import { Skeleton as BoneyardSkeleton } from 'boneyard-js/react';
import { priceListsService, type PriceList } from '../../services/price-lists.service';
import { PriceMissingBadge, SalesLinePriceListSelect } from './SalesLinePriceListSelect';
import { SalesIrSelector } from './SalesIrSelector';
import { formatSalesAmount, getMissingSalesPriceMessage, getSalesUnitPrice, sameSalesId, unwrapSalesPriceListMatrix } from '../../utils/salesPriceList';
import { getPdfDesignSettings } from '../../utils/pdfGenerator';

interface CartItem extends PosInvoiceItem {
  productId: string;
  lineTotal: number;
  taxRate: number;
  discount: number;
  irRate?: number;
  irTaxId?: string | null;
  priceListId?: string;
}

type PricingMode = 'global' | 'individual';

interface CartSession {
  cart: CartItem[];
  selectedCustomerId: string | undefined;
  emitDate: string;
  discountPercent: number;
  includeTax: boolean;
  pricingMode: PricingMode;
}

interface InvoiceSummary {
  subtotal: number;
  tax: number;
  discount: number;
  ir: number;
  total: number;
}

type CatalogViewMode = 'list' | 'catalog';
type CatalogItemFilter = 'ALL' | 'PRODUCT' | 'SERVICE';

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
// IVA general vigente para ventas en Nicaragua. Se usa como regla de cálculo
// del POS; no depende de un porcentaje guardado en el catálogo del producto.
const NICARAGUA_IVA_RATE = 15;

type PaymentCurrency = 'NIO' | 'USD';

function escapeTicketHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character] || character));
}

async function printPosTicket(invoice: PosInvoice, cart: CartItem[], payments: PosPaymentLine[], currency: PaymentCurrency, exchangeRate: number, companyName: string) {
  const win = window.open('', '_blank', 'width=420,height=700');
  if (!win) return;
  // Se consulta la vista específica para que el ticket no herede la plantilla de una factura.
  const ticketSettings = await getPdfDesignSettings('ventas.cash-ticket');
  const ticketPrimary = typeof ticketSettings.primaryColor === 'string' ? ticketSettings.primaryColor : '#000';
  const ticketText = typeof ticketSettings.textColor === 'string' ? ticketSettings.textColor : '#000';
  const ticketFont = typeof ticketSettings.fontFamily === 'string' ? ticketSettings.fontFamily.replace(/["'<>]/g, '') : 'monospace';
  const money = (value: number) => `${currency === 'USD' ? '$' : 'C$'} ${formatSalesAmount(value)}`;
  const paidDisplay = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const paidLocal = paidDisplay * (currency === 'USD' ? exchangeRate : 1);
  const changeLocal = Math.max(0, paidLocal - Number(invoice.total));
  const customerName = invoice.customer?.name || invoice.customCustomerName || GENERAL_CUSTOMER_NAME;
  const customerPhone = invoice.customer?.phone;
  const paymentLabel = (method: PosPaymentLine['method']) => method === 'CASH' ? 'Efectivo' : method === 'CARD' ? 'Tarjeta' : 'Transferencia';
  const paymentRows = payments.map((payment) => `<div class="row"><span>${paymentLabel(payment.method)}</span><span>${money(Number(payment.amount || 0))}</span></div>`).join('');
  const itemRows = cart.map(item => `<div class="item"><div>${escapeTicketHtml(item.description)}</div><div class="row"><span>${item.quantity} x ${money(item.unitPrice / (currency === 'USD' ? exchangeRate : 1))}</span><span>${money(item.lineTotal / (currency === 'USD' ? exchangeRate : 1))}</span></div></div>`).join('');
  const discount = Number(invoice.discountAmount || 0);
  const totalRecibidoHtml = payments.length > 1 ? `<div class="row"><span>Total recibido</span><span>${money(paidDisplay)}</span></div>` : '';
  const registerCode = invoice.register?.code || 'N/D';
  win.document.write(`<html><head><title>${escapeTicketHtml(invoice.number)}</title><style>@page{size:80mm auto;margin:0}body{width:72mm;margin:4mm auto;font:11px monospace;color:#000}h2{text-align:center;margin:0 0 5px;font-size:16px}h3{text-align:center;margin:0 0 8px;font-size:11px;font-weight:normal}.center{text-align:center}.row{display:flex;justify-content:space-between;gap:8px;margin:3px 0}.line{border-top:1px dashed #000;margin:8px 0}.item{margin:5px 0}.item .row{font-size:10px}.totals{margin-top:6px}.total{font-size:14px;font-weight:bold}.label{font-weight:bold;margin-top:7px}.muted{font-size:10px}.footer{text-align:center;margin-top:14px;font-size:10px}</style></head><body><h2>${escapeTicketHtml(companyName)}</h2><h3>Comprobante de venta</h3><div class="center">Factura: ${escapeTicketHtml(invoice.number)}<br>Caja: ${escapeTicketHtml(registerCode)}<br>Fecha: ${new Date().toLocaleString('es-NI')}</div><div class="line"><div class="label">CLIENTE</div><div>${escapeTicketHtml(customerName)}</div>${customerPhone ? `<div>Tel: ${escapeTicketHtml(customerPhone)}</div>` : ''}</div><div class="label">DETALLE</div>${itemRows}<div class="line totals"><div class="row"><span>Subtotal</span><span>${money(Number(invoice.subtotal) / (currency === 'USD' ? exchangeRate : 1))}</span></div>${discount > 0 ? `<div class="row"><span>Descuento</span><span>- ${money(discount / (currency === 'USD' ? exchangeRate : 1))}</span></div>` : ''}<div class="row"><span>IVA</span><span>${money(Number(invoice.taxAmount) / (currency === 'USD' ? exchangeRate : 1))}</span></div><div class="row total"><span>TOTAL</span><span>${money(Number(invoice.total) / (currency === 'USD' ? exchangeRate : 1))}</span></div></div><div class="line"><div class="label">PAGO</div>${paymentRows}${totalRecibidoHtml}<div class="row"><span>Cambio / vuelto</span><span>C$ ${formatSalesAmount(changeLocal)}</span></div></div><div class="footer">Gracias por su compra</div></body></html>`);
  const designStyle = win.document.createElement('style');
  designStyle.textContent = ['body{font-family:', ticketFont, ';color:', ticketText, '}', 'h2,.label,.total{color:', ticketPrimary, '}', '.line{border-color:', ticketPrimary, '}'].join('');
  win.document.head.appendChild(designStyle);
  win.document.close();
  // Esperar a que el documento se pinte evita que Chrome abra una vista previa en blanco.
  window.setTimeout(() => {
    win.focus();
    win.print();
  }, 300);
}

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

function calculateIndividualLineTotal(item: CartItem) {
  const gross = Number(item.quantity || 0) * Number(item.unitPrice || 0);
  const discount = gross * Number(item.discount || 0) / 100;
  const taxable = Math.max(0, gross - discount);
  const tax = taxable * Number(item.taxRate || 0) / 100;
  const ir = taxable * Number(item.irRate || 0) / 100;
  return taxable + tax - ir;
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
  discountPercent: number,
  includeTax: boolean,
  irRate = 0,
  pricingMode: PricingMode = 'global',
): InvoiceSummary {
  const subtotal = cart.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  if (pricingMode === 'individual') {
    const discount = cart.reduce((sum, item) => {
      const gross = Number(item.quantity || 0) * Number(item.unitPrice || 0);
      return sum + gross * Number(item.discount || 0) / 100;
    }, 0);
    const tax = cart.reduce((sum, item) => {
      const gross = Number(item.quantity || 0) * Number(item.unitPrice || 0);
      const taxable = Math.max(0, gross - gross * Number(item.discount || 0) / 100);
      return sum + taxable * Number(item.taxRate || 0) / 100;
    }, 0);
    const ir = cart.reduce((sum, item) => {
      const gross = Number(item.quantity || 0) * Number(item.unitPrice || 0);
      const taxable = Math.max(0, gross - gross * Number(item.discount || 0) / 100);
      return sum + taxable * Number(item.irRate || 0) / 100;
    }, 0);
    return { subtotal, tax, discount, ir, total: subtotal + tax - discount - ir };
  }
  const discount = subtotal * (discountPercent / 100);
  const taxableSubtotal = Math.max(0, subtotal - discount);
  const tax = includeTax ? taxableSubtotal * (NICARAGUA_IVA_RATE / 100) : 0;
  const ir = taxableSubtotal * (irRate / 100);

  return {
    subtotal,
    tax,
    discount,
    ir,
    total: subtotal + tax - discount - ir,
  };
}

function buildInvoiceItems(cart: CartItem[]): PosInvoiceItem[] {
  return cart.map((item) => ({
    productId: item.productId,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    priceListId: item.priceListId,
    taxRate: item.taxRate,
    discount: item.discount,
    irRate: item.irRate,
    irTaxId: item.irTaxId,
  }));
}

function getInvoiceCustomerName(invoice: PosInvoice) {
  return invoice.customer?.name || invoice.customCustomerName || GENERAL_CUSTOMER_NAME;
}

interface FacturacionCajaViewProps {
  onNavigateToControlCaja?: (registerId?: string) => void;
}

export function FacturacionCajaView({ onNavigateToControlCaja }: FacturacionCajaViewProps) {
  const { formatConvertedAmount: formatCurrency } = useCurrency();
  const { user } = useAuth();
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [registerAvailability, setRegisterAvailability] = useState<CashRegisterAvailability | null>(null);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<PosInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const checkoutIdempotencyKey = useRef<string | null>(null);

  const [selectedRegisterId, setSelectedRegisterId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [priceListItems, setPriceListItems] = useState<Array<{ priceListId: string; productId: string; price: number; currency: string; exchangeRate: number; basePrice: number }>>([]);
  const [selectedPriceListId, setSelectedPriceListId] = useState('');
  const [emitDate, setEmitDate] = useState(getTodayInputDate());
  const [discountPercent, setDiscountPercent] = useState(0);
  const [pricingMode, setPricingMode] = useState<PricingMode>('global');
  const [irRate] = useState(0);
  const [irTaxId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [catalogItemFilter, setCatalogItemFilter] = useState<CatalogItemFilter>('ALL');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [includeTax, setIncludeTax] = useState(true);
  const [catalogView, setCatalogView] = useState<CatalogViewMode>(getInitialCatalogView);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentCurrency, setPaymentCurrency] = useState<PaymentCurrency>('NIO');
  const [activeSession, setActiveSession] = useState<CashRegisterSession | null>(null);
  const [bankAccounts, setBankAccounts] = useState<Account[]>([]);
  const [payments, setPayments] = useState<PosPaymentLine[]>([{ method: 'CASH', amount: 0 }]);
  const [createdInvoice, setCreatedInvoice] = useState<PosInvoice | null>(null);
  const [createdTicketCart, setCreatedTicketCart] = useState<CartItem[]>([]);
  const [createdPaymentLines, setCreatedPaymentLines] = useState<PosPaymentLine[]>([]);
  const [createdExchangeRate, setCreatedExchangeRate] = useState(1);
  const [companyName, setCompanyName] = useState('Empresa');
  const [duplicateMatches, setDuplicateMatches] = useState<PotentialDuplicateSale[]>([]);

  const [showAddCustomer, setShowAddCustomer] = useState(false);

  const cartSessions = useRef<Map<string, CartSession>>(new Map());

  const [prevTenantId, setPrevTenantId] = useState(user?.tenantId);
  if (prevTenantId !== user?.tenantId) {
    setPrevTenantId(user?.tenantId);
    setPriceLists([]);
    setPriceListItems([]);
    setSelectedPriceListId('');
  }

  useEffect(() => {
    if (!user?.tenantId) return;
    let active = true;
    void Promise.all([priceListsService.getAll(), priceListsService.getMatrix()]).then(([lists, matrix]) => {
      if (!active) return;
      const normalizedLists = Array.isArray(lists) ? lists : ((lists as any)?.data || []);
      const normalizedMatrix = unwrapSalesPriceListMatrix(matrix);
      setPriceLists(normalizedLists);
      setPriceListItems(normalizedMatrix.items.map((item) => ({
        priceListId: String(item.priceListId),
        productId: String(item.productId),
        price: Number(item.price),
        currency: String(item.currency || 'NIO'),
        exchangeRate: Number(item.exchangeRate || 1),
        basePrice: Number(item.basePrice),
      })));
      setSelectedPriceListId((current) => current || normalizedLists.find((list: PriceList) => list.isDefault)?.id || normalizedLists[0]?.id || '');
    }).catch(() => undefined);
    return () => { active = false; };
  }, [user?.tenantId]);

  const getConfiguredPrice = (priceListId: string, productId: string) => {
    const entry = priceListItems.find((item) => sameSalesId(item.priceListId, priceListId) && sameSalesId(item.productId, productId));
    return entry ? getSalesUnitPrice(entry, paymentCurrency, Number(activeSession?.exchangeRateUSD || 1)) : undefined;
  };

  const getCatalogPrice = (product: PosProduct) => {
    if (product.itemType === 'SERVICE') return Number(product.salePrice || 0);
    return getConfiguredPrice(selectedPriceListId, product.id);
  };

  const handleRegisterChange = (newRegisterId: string, skipSave = false) => {
    // Guardar sesión de la caja actual
    if (selectedRegisterId && !skipSave) {
      cartSessions.current.set(selectedRegisterId, {
        cart,
        selectedCustomerId,
        emitDate,
        discountPercent,
        includeTax,
        pricingMode,
      });
    }

    // Restaurar sesión de la nueva caja
    const savedSession = cartSessions.current.get(newRegisterId);
    if (savedSession) {
      setCart(savedSession.cart);
      setSelectedCustomerId(savedSession.selectedCustomerId);
      setEmitDate(savedSession.emitDate);
      setDiscountPercent(savedSession.discountPercent);
      setIncludeTax(savedSession.includeTax);
      setPricingMode(savedSession.pricingMode || 'global');
    } else {
      // Estado fresco
      setCart([]);
      setSelectedCustomerId(undefined);
      setEmitDate(getTodayInputDate());
      setDiscountPercent(0);
      setIncludeTax(true);
      setPricingMode('global');
    }

    setSelectedRegisterId(newRegisterId);
  };


  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const cashRegisters = await cajaService.getRegisters();
      setRegisters(cashRegisters);

      if (cashRegisters.length === 0) {
        try {
          setRegisterAvailability(await cajaService.getRegisterAvailability());
        } catch {
          // Si el endpoint de diagnóstico no responde, se conserva el mensaje
          // de acceso como fallback y no se bloquea el resto de la vista.
          setRegisterAvailability(null);
        }
      } else {
        setRegisterAvailability(null);
      }

      let initialRegisterId = '';
      if (cashRegisters.length > 0) {
        const openRegister = cashRegisters.find(r => r.hasActiveSession);
        initialRegisterId = openRegister ? openRegister.id : cashRegisters[0].id;
        setSelectedRegisterId(initialRegisterId);
      }

      const initialWarehouseId = cashRegisters.find(r => r.id === initialRegisterId)?.resolvedWarehouseId || undefined;

      const [availableProducts, registeredCustomers] = await Promise.all([
        cajaService.getProducts(undefined, initialWarehouseId),
        cajaService.getCustomers(),
      ]);
      setProducts(availableProducts);
      setCustomers(registeredCustomers);
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

  const handleCustomerCreated = useCallback(() => {
    cajaService.getCustomers().then(setCustomers);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadInitialData, 0);
    brandingService.getCurrent().then((branding) => {
      if (branding?.companyName?.trim()) setCompanyName(branding.companyName.trim());
    }).catch(() => undefined);
    accountsService.getAll({ page: 1, pageSize: 100 }).then((response: any) => {
      const items = response?.data ?? response?.items ?? response;
      setBankAccounts(Array.isArray(items) ? items.filter((account: Account) => account.isActive && String(account.type || '').toUpperCase() === 'ASSET') : []);
    }).catch(() => setBankAccounts([]));
    return () => window.clearTimeout(timer);
  }, [loadInitialData]);

  useEffect(() => {
    if (!selectedRegisterId) return;
    cajaService.getActiveSession(selectedRegisterId).then(setActiveSession).catch(() => setActiveSession(null));
  }, [selectedRegisterId]);

  useEffect(() => {
    try {
      localStorage.setItem(CATALOG_VIEW_STORAGE_KEY, catalogView);
    } catch {
      // La preferencia es opcional; la vista sigue funcionando sin almacenamiento local.
    }
  }, [catalogView]);

  const [prevRegisterId, setPrevRegisterId] = useState(selectedRegisterId);
  if (prevRegisterId !== selectedRegisterId) {
    setPrevRegisterId(selectedRegisterId);
    if (!selectedRegisterId) setRecentInvoices([]);
  }

  useEffect(() => {
    if (!selectedRegisterId) return;

    const timer = window.setTimeout(() => loadRecentInvoices(selectedRegisterId), 0);
    return () => window.clearTimeout(timer);
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
        const selectedRegister = registers.find(r => r.id === selectedRegisterId);
        const warehouseId = selectedRegister?.resolvedWarehouseId || undefined;
        const availableProducts = await cajaService.getProducts(productSearch.trim() || undefined, warehouseId);
        setProducts(availableProducts);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [productSearch, selectedRegisterId, registers]);

  const filteredProducts = useMemo(
    () => catalogItemFilter === 'ALL'
      ? products
      : products.filter((product) => String(product.itemType || 'PRODUCT').toUpperCase() === catalogItemFilter),
    [products, catalogItemFilter],
  );

  const getGlobalCartQuantity = (productId: string) => {
    let total = 0;
    cartSessions.current.forEach((session, regId) => {
      if (regId !== selectedRegisterId) {
        const item = session.cart.find((i: any) => i.productId === productId);
        if (item) total += item.quantity;
      }
    });
    return total;
  };

  const addItem = (product: PosProduct) => {
    const isService = product.itemType === 'SERVICE';
    const configuredPrice = isService ? Number(product.salePrice || 0) : getConfiguredPrice(selectedPriceListId, product.id);
    const priceMissing = !isService && configuredPrice === undefined;
    if (priceMissing) {
      toast.warning(`El producto "${product.name}" no tiene precio en esta lista. Puedes agregarlo, pero selecciona otra lista antes de emitir.`);
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      const globalQty = getGlobalCartQuantity(product.id);

      if (existing) {
        if (product.trackInventory && product.currentStock !== null && product.currentStock !== undefined) {
          if (existing.quantity + 1 + globalQty > product.currentStock) {
            toast.error(
              globalQty > 0
                ? `Stock insuficiente. Tienes ${globalQty} unidades en otras cajas. Solo hay ${product.currentStock} en stock global.`
                : `Stock insuficiente. Solo hay ${product.currentStock} unidades disponibles.`
            );
            return prev;
          }
        }
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

      if (product.trackInventory && product.currentStock !== null && product.currentStock !== undefined) {
        if (1 + globalQty > product.currentStock) {
          toast.error(
            globalQty > 0
              ? `Stock insuficiente. Tienes ${globalQty} unidades separadas en otras cajas y solo hay ${product.currentStock} en total.`
              : `Stock insuficiente. El producto está agotado.`
          );
          return prev;
        }
      }

      return [
        ...prev,
        {
          productId: product.id,
          description: product.name,
          quantity: 1,
          unitPrice: configuredPrice ?? 0,
          priceListId: isService ? undefined : selectedPriceListId,
          priceMissing,
          discount: 0,
          // En modo global este valor se ignora; en modo por producto parte con IVA.
          taxRate: NICARAGUA_IVA_RATE,
          lineTotal: calculateLineTotal(1, configuredPrice ?? 0),
        },
      ];
    });
  };

  const updateQty = (productId: string, quantity: number) => {
    const product = productsById.get(productId);
    let finalQty = quantity;
    if (product && product.trackInventory && product.currentStock !== null && product.currentStock !== undefined) {
      const globalQty = getGlobalCartQuantity(productId);
      if (quantity + globalQty > product.currentStock) {
        toast.error(
          globalQty > 0
            ? `Stock insuficiente. Tienes ${globalQty} separadas en otras cajas y solo quedan ${Math.max(0, product.currentStock - globalQty)} disponibles acá.`
            : `Stock insuficiente. Solo hay ${product.currentStock} unidades disponibles.`
        );
        finalQty = Math.max(1, product.currentStock - globalQty);
      }
    }

    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, quantity: finalQty, lineTotal: calculateLineTotal(finalQty, item.unitPrice) }
          : item,
      ),
    );
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const changePricingMode = (mode: PricingMode) => {
    if (mode === pricingMode) return;
    if (mode === 'individual') {
      setDiscountPercent(0);
      setCart((current) => current.map((item) => ({
        ...item,
        taxRate: Number(item.taxRate || 0) > 0 ? Number(item.taxRate) : (includeTax ? NICARAGUA_IVA_RATE : 0),
      })));
    } else {
      setIncludeTax(cart.some((item) => Number(item.taxRate || 0) > 0));
      setDiscountPercent(0);
    }
    setPricingMode(mode);
  };

  const updateCartItemCharges = (productId: string, changes: Partial<Pick<CartItem, 'taxRate' | 'discount'>>) => {
    setCart((current) => current.map((item) => item.productId === productId
      ? { ...item, ...changes, taxRate: Math.min(100, Math.max(0, Number(changes.taxRate ?? item.taxRate) || 0)), discount: Math.min(100, Math.max(0, Number(changes.discount ?? item.discount) || 0)) }
      : item));
  };

  const summary = useMemo(
    () => calculateInvoiceSummary(cart, discountPercent, includeTax, irRate, pricingMode),
    [cart, discountPercent, includeTax, irRate, pricingMode],
  );
  const missingPriceMessage = useMemo(() => getMissingSalesPriceMessage(cart), [cart]);

  const selectedRegister = registers.find((r) => r.id === selectedRegisterId);

  const handleCustomerChange = (value: string) => {
    const customerId = value === GENERAL_CUSTOMER_SELECT_VALUE ? undefined : value;
    const customer = customers.find((item) => item.id === customerId);
    const nextListId = customer?.priceListId || priceLists.find((list) => list.isDefault)?.id || priceLists[0]?.id || '';
    setSelectedCustomerId(customerId);
    setSelectedPriceListId(nextListId);
    setCart((current) => current.map((item) => {
      const isService = productsById.get(item.productId)?.itemType === 'SERVICE';
      const price = isService ? Number(productsById.get(item.productId)?.salePrice || item.unitPrice || 0) : getConfiguredPrice(nextListId, item.productId);
      return price === undefined
        ? { ...item, priceListId: nextListId, unitPrice: 0, lineTotal: 0, priceMissing: true }
        : { ...item, priceListId: isService ? undefined : nextListId, unitPrice: price, lineTotal: calculateLineTotal(item.quantity, price), priceMissing: false };
    }));
  };

  const handlePay = () => {
    if (cart.length === 0) {
      toast.error('Agregá al menos un producto');
      return;
    }

    if (!selectedRegisterId) {
      toast.error('Seleccioná una caja');
      return;
    }

    if (!activeSession) {
      toast.error('La caja no tiene una sesión activa');
      return;
    }
    if (missingPriceMessage) {
      toast.error(missingPriceMessage);
      return;
    }
    setPayments([{ method: 'CASH', amount: 0 }]);
    setPaymentCurrency('NIO');
    setCreatedInvoice(null);
    setCreatedTicketCart([...cart]);
    setCreatedPaymentLines([]);
    checkoutIdempotencyKey.current = null;
    setShowPayment(true);
  };

  const submitPayment = async (confirmedDuplicate = false) => {
    if (submittingRef.current) return;
    if (!activeSession) return;
    if (missingPriceMessage) {
      toast.error(missingPriceMessage);
      return;
    }
    const totalInPaymentCurrency = paymentCurrency === 'USD' ? summary.total / Number(activeSession.exchangeRateUSD) : summary.total;
    const received = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    if (received + 0.005 < totalInPaymentCurrency) {
      toast.error('El monto recibido debe ser igual o mayor al total');
      return;
    }
    if (payments.some((payment) => !payment.accountId)) {
      toast.error('Cada método de pago requiere una cuenta contable');
      return;
    }
    if (payments.some((payment) => payment.method === 'TRANSFER' && !payment.reference?.trim())) {
      toast.error('La transferencia requiere una referencia');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const checkoutPayload = {
        registerId: selectedRegisterId,
        sessionId: activeSession.id,
        customerId: selectedCustomerId,
        customCustomerName: selectedCustomerId ? undefined : GENERAL_CUSTOMER_NAME,
        date: emitDate,
        discountPercent: discountPercent || undefined,
        pricingMode,
        irRate: irRate || undefined,
        irTaxId: irTaxId || undefined,
        priceListId: selectedPriceListId || undefined,
        items: buildInvoiceItems(cart),
        includeTax,
        currency: paymentCurrency,
        exchangeRate: Number(activeSession.exchangeRateUSD),
        payments,
        ...(confirmedDuplicate && duplicateMatches.length > 0
          ? { duplicateConfirmation: { candidateIds: duplicateMatches.map((match) => match.id) } }
          : {}),
      };

      if (!confirmedDuplicate) {
        const duplicateCheck = await cajaService.checkPotentialDuplicates(checkoutPayload);
        if (duplicateCheck.matches?.length) {
          setDuplicateMatches(duplicateCheck.matches);
          checkoutIdempotencyKey.current = null;
          return;
        }
      }

      const idempotencyKey = checkoutIdempotencyKey.current || createIdempotencyKey('checkout');
      checkoutIdempotencyKey.current = idempotencyKey;
      const createdResponse = await cajaService.createInvoice(checkoutPayload, idempotencyKey);
      const created = (createdResponse as any)?.data || createdResponse;

      toast.success('Factura emitida exitosamente');
      setCreatedInvoice(created);
      setCreatedPaymentLines([...payments]);
      setCreatedExchangeRate(Number(activeSession.exchangeRateUSD));
      setShowPayment(false);
      setDuplicateMatches([]);
      checkoutIdempotencyKey.current = null;

      // Limpiar datos en memoria de esta caja
      setCart([]);
      setDiscountPercent(0);
      cartSessions.current.delete(selectedRegisterId);

      await loadRecentInvoices(selectedRegisterId);

      // Verificamos si existen otras cajas en la "cola" con productos pendientes
      const pendingSessionEntry = Array.from(cartSessions.current.entries()).find(([_id, session]) => session.cart && session.cart.length > 0);

      if (!pendingSessionEntry) {
        setSelectedCustomerId(undefined); // Solo borrar cliente global si no hay mas cajas
      } else {
        handleRegisterChange(pendingSessionEntry[0], true); // skipSave = true
      }
    } catch (error: unknown) {
      if ((error as any)?.status) checkoutIdempotencyKey.current = null;
      const errorData = (error as any)?.data;
      if ((error as any)?.code === 'POTENTIAL_DUPLICATE_SALE' && Array.isArray(errorData?.matches)) {
        setDuplicateMatches(errorData.matches);
        checkoutIdempotencyKey.current = null;
        return;
      }
      toast.error(getErrorMessage(error, 'Error al emitir factura'));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setPricingMode('global');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const isRegisterDisabled = selectedRegister ? !selectedRegister.hasActiveSession : false;

  if (registers.length === 0) {
    const availabilityMessage = (() => {
      if (!registerAvailability) {
        return {
          title: 'No se puede verificar el acceso a POS',
          description: 'No fue posible confirmar si existen cajas o sucursales configuradas. Intenta actualizar la vista o contacta al administrador.',
        };
      }
      if (registerAvailability.totalRegisters === 0 && registerAvailability.totalBranches === 0) {
        return {
          title: 'No hay sucursales ni cajas configuradas',
          description: 'Primero registra una sucursal y crea al menos una caja activa desde la configuración del equipo para comenzar a facturar.',
        };
      }
      if (registerAvailability.totalRegisters === 0) {
        return {
          title: 'No hay cajas configuradas',
          description: 'Ya existen sucursales, pero todavía no hay cajas registradoras. Crea una caja activa desde la configuración del equipo para comenzar a facturar.',
        };
      }
      if (registerAvailability.activeBranches === 0) {
        return {
          title: 'No hay sucursales activas',
          description: 'Hay cajas registradas, pero no existe una sucursal activa a la que puedan asociarse. Activa o configura una sucursal desde la configuración del equipo.',
        };
      }
      if (registerAvailability.activeRegisters === 0) {
        return {
          title: 'No hay cajas activas',
          description: 'Las cajas registradas están inactivas. Activa al menos una caja desde la configuración del equipo para comenzar a facturar.',
        };
      }
      return {
        title: 'Acceso restringido a POS',
        description: 'Hay cajas activas en el sistema, pero tu usuario no tiene acceso a ninguna. Contacta al administrador para que te asigne una caja desde la configuración del equipo.',
      };
    })();

    if (loading) {
      return (
        <BoneyardSkeleton
          name="sales-pos-shell"
          loading
          select="viewport"
          animate="shimmer"
          fallback={<div className="space-y-4 rounded-2xl border border-border/40 p-6"><div className="h-14 w-full animate-pulse rounded-xl bg-muted/40" /><div className="h-72 w-full animate-pulse rounded-2xl bg-muted/30" /></div>}
        >
          <div />
        </BoneyardSkeleton>
      );
    }
    return (
      <>
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="size-20 rounded-full bg-rose-500/10 flex items-center justify-center mb-6">
            <CreditCard className="size-10 text-rose-500" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-foreground mb-2 uppercase">{availabilityMessage.title}</h2>
          <p className="text-muted-foreground max-w-md mb-6">
            {availabilityMessage.description}
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
            disabled={isRegisterDisabled}
            className="h-10 gap-2 px-3 text-xs font-black rounded-xl border-primary/30 hover:bg-primary/10 shadow-sm bg-background/80"
          >
            <UserPlus className="size-4 text-primary" /> Agregar Cliente
          </Button>
          <Button type="button" variant="outline" onClick={() => setShowTutorial(true)} className="h-10 rounded-xl border-primary/30 bg-background/80 text-xs font-black text-primary shadow-sm hover:bg-primary/10">
            <CircleHelp className="mr-2 size-4" /> Cómo facturar
          </Button>
        </div>
      </div>

      {isRegisterDisabled ? (
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center border-2 border-dashed border-border/50 rounded-2xl bg-muted/10">
          <div className="size-24 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
            <AlertCircle className="size-12 text-destructive" />
          </div>
          <h2 className="text-3xl font-black tracking-tight text-foreground mb-3 uppercase">Caja Cerrada</h2>
          <p className="text-muted-foreground max-w-lg mb-8 text-sm">
            Esta caja no tiene una sesión activa o ya fue cerrada. El módulo de facturación (POS) está bloqueado por seguridad.
            Debe aperturar la caja para poder agregar productos y emitir facturas.
          </p>

          <div className="flex flex-col items-center gap-6 w-full max-w-sm">
            <div className="space-y-1.5 w-full text-left" data-tour="pos-register">
              <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Cambiar Caja Operativa</Label>
              <Select value={selectedRegisterId} onValueChange={handleRegisterChange}>
                <SelectTrigger className="h-12 rounded-xl border-border/60"><SelectValue placeholder="Seleccionar caja" /></SelectTrigger>
                <SelectContent>
                  {registers.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <span className={!r.hasActiveSession ? 'text-muted-foreground' : ''}>
                        {r.code} - {r.name}{!r.hasActiveSession && ' (sin sesión)'}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              size="lg"
              onClick={() => onNavigateToControlCaja?.(selectedRegisterId)}
              className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest"
            >
              <Coins className="mr-2 size-5" />
              Ir a Control de Caja para Abrir
            </Button>
          </div>
        </div>
      ) : (
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
                    <Select value={selectedRegisterId} onValueChange={handleRegisterChange}>
                      <SelectTrigger className="!h-11 rounded-xl"><SelectValue placeholder="Seleccionar caja" /></SelectTrigger>
                      <SelectContent>
                        {registers.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            <span className={!r.hasActiveSession ? 'text-muted-foreground' : ''}>
                              {r.code} - {r.name}{!r.hasActiveSession && ' (sin sesión)'}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5" data-tour="pos-customer">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Cliente / Empresa</Label>
                    <Combobox
                      options={[
                        { label: GENERAL_CUSTOMER_NAME, value: GENERAL_CUSTOMER_SELECT_VALUE },
                        ...customers.map(c => ({ label: c.name, value: c.id, description: undefined }))
                      ]}
                      value={selectedCustomerId ?? GENERAL_CUSTOMER_SELECT_VALUE}
                      onChange={handleCustomerChange}
                      disabled={isRegisterDisabled}
                      placeholder={GENERAL_CUSTOMER_NAME}
                      emptyMessage="No se encontraron clientes"
                      className="!h-11 rounded-xl text-sm font-normal"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Lista de precios: <span className="font-semibold text-foreground">{priceLists.find((list) => sameSalesId(list.id, selectedPriceListId))?.name || 'No configurada'}</span>
                    </p>
                  </div>
                  <div className="space-y-1.5" data-tour="pos-date">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Fecha de Emisión</Label>
                    <Input type="date" value={emitDate} onChange={(e) => setEmitDate(e.target.value)} disabled={isRegisterDisabled} className="!h-11 !py-0 rounded-xl w-full flex items-center justify-between" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm" data-tour="pos-catalog">
              <CardContent className="p-5">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight">Catálogo de venta</h3>
                    <p className="mt-1 text-[11px] text-muted-foreground">{filteredProducts.length} {catalogItemFilter === 'SERVICE' ? 'servicios' : catalogItemFilter === 'PRODUCT' ? 'productos' : 'artículos'} disponibles</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="inline-flex h-9 items-center rounded-xl border border-border/60 bg-muted/30 p-1" role="group" aria-label="Vista del catálogo">
                      <button
                        type="button"
                        aria-pressed={catalogView === 'list'}
                        onClick={() => setCatalogView('list')}
                        className={`flex h-7 items-center gap-1.5 rounded-lg px-3 text-[10px] font-black uppercase tracking-wider transition-all ${catalogView === 'list' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                          }`}
                      >
                        <List className="size-3.5" /> Lista
                      </button>
                      <button
                        type="button"
                        aria-pressed={catalogView === 'catalog'}
                        onClick={() => setCatalogView('catalog')}
                        className={`flex h-7 items-center gap-1.5 rounded-lg px-3 text-[10px] font-black uppercase tracking-wider transition-all ${catalogView === 'catalog' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
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
                        placeholder="Buscar producto o servicio..."
                        disabled={isRegisterDisabled}
                        className="pl-9 h-9 rounded-lg text-xs focus-visible:ring-primary focus-visible:border-primary"
                      />
                    </div>
                  </div>
                </div>
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-muted/20 p-1.5" role="group" aria-label="Tipo de artículo">
                  <span className="px-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">Mostrar:</span>
                  {([
                    ['ALL', 'Todos'],
                    ['PRODUCT', 'Productos'],
                    ['SERVICE', 'Servicios'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={catalogItemFilter === value}
                      onClick={() => setCatalogItemFilter(value)}
                      className={cn('rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors', catalogItemFilter === value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {catalogView === 'list' ? (
                  <div className="overflow-hidden rounded-xl border border-border/50">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full table-fixed text-xs">
                        <colgroup>
                          <col className="w-[18%]" />
                          <col className="w-[38%]" />
                          <col className="w-[22%]" />
                          <col className="w-[22%]" />
                        </colgroup>
                        <thead>
                          <tr className="border-b border-border/30 bg-muted/30">
                            <th className="px-2 sm:px-3 py-2.5 text-left text-[10px] font-black uppercase leading-tight tracking-widest text-muted-foreground whitespace-nowrap">Código</th>
                            <th className="px-2 sm:px-3 py-2.5 text-left text-[10px] font-black uppercase leading-tight tracking-widest text-muted-foreground">Descripción</th>
                            <th className="px-2 sm:px-3 py-2.5 text-right text-[10px] font-black uppercase leading-tight tracking-widest text-muted-foreground whitespace-nowrap">Precio unit.</th>
                            <th data-actions-column="compact" className="px-2 sm:px-3 py-2.5 text-center text-[10px] font-black uppercase leading-tight tracking-widest text-muted-foreground whitespace-nowrap">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                          {filteredProducts.slice(0, 30).map((prod) => (
                            <tr key={prod.id} className="transition-colors hover:bg-muted/20">
                              <td className="min-w-0 px-2 sm:px-3 py-2.5 font-mono font-bold text-primary truncate">{prod.code}</td>
                              <td className="min-w-0 px-2 sm:px-3 py-2.5">
                                <div className="flex min-w-0 items-center gap-2">
                                  <div className="min-w-0">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <p className="min-w-0 truncate font-bold">{prod.name}</p>
                                      <Badge variant="secondary" className="shrink-0 text-[9px]">{prod.itemType === 'SERVICE' ? 'Servicio' : 'Producto'}</Badge>
                                    </div>
                                  </div>
                                  {prod.trackInventory && (
                                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${prod.currentStock && prod.currentStock > 0 ? "text-emerald-500 border-emerald-500/30" : "text-rose-500 border-rose-500/30"}`}>
                                      {prod.currentStock ?? 0} unid.
                                    </Badge>
                                  )}
                                </div>
                                {prod.description && <p className="max-w-[320px] truncate text-[10px] text-muted-foreground">{prod.description}</p>}
                              </td>
                              <td className="px-2 sm:px-3 py-2.5 text-right font-mono whitespace-nowrap">
                                {getCatalogPrice(prod) === undefined ? <span className="text-[10px] font-black uppercase text-rose-500">Sin precio</span> : formatCurrency(getCatalogPrice(prod))}
                              </td>
                              <td data-actions-column="compact" className="px-2 sm:px-3 py-2.5 text-center">
                                <Button size="sm" variant="ghost" onClick={() => addItem(prod)}
                                  disabled={isRegisterDisabled || (prod.trackInventory && (!prod.currentStock || prod.currentStock <= 0))}
                                  className="h-7 max-w-full whitespace-nowrap rounded-lg px-1.5 sm:px-2 text-[10px] font-bold text-primary hover:bg-primary/10 disabled:opacity-50">
                                  <Plus className="mr-1 size-3" /> {prod.trackInventory && (!prod.currentStock || prod.currentStock <= 0) ? 'Sin Stock' : 'Agregar'}
                                </Button>
                              </td>
                            </tr>
                          ))}
                          {filteredProducts.length === 0 && (
                            <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">No hay productos ni servicios disponibles</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[34rem] overflow-y-auto pr-1">
                    {filteredProducts.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                        {filteredProducts.slice(0, 30).map((prod) => (
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
                                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                    <Badge variant="outline" className="font-mono text-[9px] text-primary">{prod.code}</Badge>
                                    <Badge variant="secondary" className="text-[9px]">{prod.itemType === 'SERVICE' ? 'Servicio' : 'Producto'}</Badge>
                                    {prod.trackInventory && (
                                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-mono ${prod.currentStock && prod.currentStock > 0 ? "text-emerald-500 border-emerald-500/30" : "text-rose-500 border-rose-500/30"}`}>
                                        {prod.currentStock ?? 0} unid.
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="font-mono text-sm font-black text-primary">{getCatalogPrice(prod) === undefined ? 'Sin precio' : formatCurrency(getCatalogPrice(prod))}</span>
                                </div>
                                <h4 className="truncate text-sm font-black">{prod.name}</h4>
                                <p className="mt-1 line-clamp-2 min-h-8 text-[11px] leading-4 text-muted-foreground">
                                  {prod.description || (prod.itemType === 'SERVICE' ? 'Servicio disponible para facturación inmediata.' : 'Producto disponible para facturación inmediata.')}
                                </p>
                              </div>
                              <Button
                                onClick={() => addItem(prod)}
                                disabled={isRegisterDisabled || (prod.trackInventory && (!prod.currentStock || prod.currentStock <= 0))}
                                className="h-9 w-full rounded-xl text-[10px] font-black uppercase tracking-wider"
                              >
                                <ShoppingCart className="mr-2 size-3.5" />
                                {prod.trackInventory && (!prod.currentStock || prod.currentStock <= 0) ? 'Sin Stock' : 'Agregar a factura'}
                              </Button>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
                        No hay productos ni servicios disponibles
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
                          <th className="px-3 py-2.5 text-center font-black uppercase tracking-widest text-[10px] text-muted-foreground">IVA</th>
                          <th className="px-3 py-2.5 text-right font-black uppercase tracking-widest text-[10px] text-muted-foreground">Descuento (%)</th>
                          <th className="px-3 py-2.5 text-center font-black uppercase tracking-widest text-[10px] text-muted-foreground">Cant</th>
                          <th className="px-3 py-2.5 text-right font-black uppercase tracking-widest text-[10px] text-muted-foreground">Precio Unit.</th>
                          <th className="px-3 py-2.5 text-right font-black uppercase tracking-widest text-[10px] text-muted-foreground">Subtotal</th>
                          <th data-actions-column="compact" className="px-3 py-2.5 text-center font-black uppercase tracking-widest text-[10px] text-muted-foreground">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {cart.map((item) => (
                          <tr key={item.productId} className="hover:bg-muted/20 transition-colors">
                            <td className="px-3 py-2 font-bold"><div className="flex min-w-0 flex-wrap items-center gap-2"><span className="min-w-0 flex-1">{item.description}</span><SalesLinePriceListSelect productId={item.productId} productCode={productsById.get(item.productId)?.code} itemType={productsById.get(item.productId)?.itemType} value={item.priceListId} defaultPriceListId={selectedPriceListId} currency={paymentCurrency} exchangeRate={Number(activeSession?.exchangeRateUSD || 1)} disabled={isRegisterDisabled} onChange={(priceListId, result) => { setCart((current) => current.map((line) => line.productId === item.productId ? { ...line, priceListId, unitPrice: result.unitPrice || 0, priceMissing: result.priceMissing, lineTotal: calculateLineTotal(line.quantity, result.unitPrice || 0) } : line)); }} /><SalesIrSelector value={item.irTaxId} rate={Number(item.irRate || 0)} compact disabled={isRegisterDisabled} onChange={(option) => { setCart((current) => current.map((line) => line.productId === item.productId ? { ...line, irTaxId: option?.id || null, irRate: Number(option?.rate || 0) } : line)); }} />{item.priceMissing && <PriceMissingBadge className="basis-full" />}</div></td>
                            <td className="px-3 py-2 text-center">
                              {pricingMode === 'individual' ? (
                                <label className="inline-flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                                  <input
                                    type="checkbox"
                                    checked={Number(item.taxRate || 0) > 0}
                                    onChange={(event) => updateCartItemCharges(item.productId, { taxRate: event.target.checked ? NICARAGUA_IVA_RATE : 0 })}
                                    disabled={isRegisterDisabled}
                                    className="size-3.5 accent-primary"
                                  />
                                  {Number(item.taxRate || 0) > 0 ? `${Number(item.taxRate)}%` : 'No'}
                                </label>
                              ) : <span className="text-[10px] text-muted-foreground">Global</span>}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {pricingMode === 'individual' ? (
                                <Input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={item.discount || ''}
                                  onChange={(event) => updateCartItemCharges(item.productId, { discount: Number(event.target.value) || 0 })}
                                  disabled={isRegisterDisabled}
                                  className="ml-auto h-7 w-16 rounded-lg text-right text-xs font-mono"
                                  placeholder="0"
                                />
                              ) : <span className="text-[10px] text-muted-foreground">Global</span>}
                            </td>
                            <td data-actions-column="compact" className="px-3 py-2 text-center">
                              <div className="mx-auto w-12 max-w-12">
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateQty(
                                      item.productId,
                                      normalizeQuantity(e.target.value, item.quantity),
                                    )
                                  }
                                  disabled={isRegisterDisabled}
                                  className="!h-7 !w-12 !max-w-12 rounded-lg px-1 text-center text-xs font-mono"
                                  min={1}
                                />
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-mono">{formatCurrency(item.unitPrice)}</td>
                            <td className="px-3 py-2 text-right font-mono font-bold">{formatCurrency(pricingMode === 'individual' ? calculateIndividualLineTotal(item) : item.lineTotal)}</td>
                            <td className="px-3 py-2 text-center">
                              <Button variant="ghost" onClick={() => removeItem(item.productId)}
                                disabled={isRegisterDisabled}
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

          <div className="space-y-5 sticky top-24">
            <Card className="border-border/50 shadow-sm" data-tour="pos-summary">
              <CardContent className="p-5 space-y-4">
                <h3 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                  <Calculator className="size-4 text-primary" /> Resumen Financiero
                </h3>
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-muted/20 p-2">
                  <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Aplicar impuestos/descuentos:</span>
                  <Button type="button" size="sm" variant={pricingMode === 'global' ? 'default' : 'outline'} className="h-7 rounded-lg px-2 text-[10px]" onClick={() => changePricingMode('global')} disabled={isRegisterDisabled}>Global</Button>
                  <Button type="button" size="sm" variant={pricingMode === 'individual' ? 'default' : 'outline'} className="h-7 rounded-lg px-2 text-[10px]" onClick={() => changePricingMode('individual')} disabled={isRegisterDisabled}>Por producto</Button>
                </div>
                {pricingMode === 'global' ? (
                  <>
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
                        disabled={isRegisterDisabled}
                      />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Incluir IVA</Label>
                      <Switch checked={includeTax} onCheckedChange={setIncludeTax} disabled={isRegisterDisabled} />
                    </div>
                  </>
                ) : (
                  <p className="rounded-lg bg-primary/5 px-3 py-2 text-[11px] text-muted-foreground">
                    Configura el IVA y el descuento directamente en cada producto o servicio.
                  </p>
                )}
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
                  disabled={submitting || cart.length === 0 || isRegisterDisabled || Boolean(missingPriceMessage)}
                  className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest gap-2 shadow-lg shadow-primary/20"
                >
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                  Pagar y Emitir Factura
                </Button>
                <Button variant="outline" onClick={clearCart} disabled={isRegisterDisabled} className="w-full h-10 rounded-xl font-bold text-xs gap-2">
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
                    {recentInvoices.map((inv) => {
                      const statusLabel = inv.status === 'PAID' ? 'PAGADA' : inv.status === 'DRAFT' ? 'BORRADOR' : inv.status === 'CANCELLED' ? 'ANULADA' : inv.status;
                      return (
                        <div key={inv.id} className="rounded-xl border border-border/30 px-3 py-2 flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] text-muted-foreground">{inv.number}</span>
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[9px]">{statusLabel}</Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {getInvoiceCustomerName(inv)} &middot; {formatInvoiceDate(inv.date)}
                            </p>
                          </div>
                          <span className="text-xs font-black font-mono shrink-0">{formatCurrency(inv.total)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      {createdInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-labelledby="invoice-result-title">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border/60 bg-background p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Factura emitida correctamente</p>
                <h2 id="invoice-result-title" className="mt-1 text-2xl font-black uppercase italic tracking-tight">{createdInvoice.number}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{formatInvoiceDate(createdInvoice.date)} · {getInvoiceCustomerName(createdInvoice)}{createdInvoice.customer?.phone ? ` · ${createdInvoice.customer.phone}` : ''}</p>
                <p className="mt-1 text-xs font-bold text-primary">Caja: {createdInvoice.register?.code || 'N/D'}</p>
              </div>
              <Button variant="ghost" onClick={() => setCreatedInvoice(null)} aria-label="Cerrar detalle de factura">✕</Button>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-border/50">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border/50 bg-muted/30 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <span>Artículo</span><span>Cant.</span><span>Total</span>
              </div>
              {createdTicketCart.map((item) => (
                <div key={item.productId} className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border/30 px-4 py-3 text-sm last:border-0">
                  <span className="font-bold">{item.description}</span>
                  <span className="font-mono text-muted-foreground">{item.quantity}</span>
                  <span className="font-mono font-bold">{formatCurrency(item.lineTotal)}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-muted/30 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Métodos de pago</p>
                <div className="mt-2 space-y-1 text-sm">
                  {createdPaymentLines.map((payment, index) => (
                    <div key={`${payment.method}-${index}`} className="flex justify-between gap-3">
                      <span>{payment.method === 'CASH' ? 'Efectivo' : payment.method === 'CARD' ? 'Tarjeta' : 'Transferencia'}</span>
                      <span className="font-mono font-bold">{paymentCurrency === 'USD' ? '$' : 'C$'} {formatSalesAmount(payment.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Total factura</p>
                <p className="mt-2 text-2xl font-black text-primary">{formatCurrency(Number(createdInvoice.total))}</p>
                {Number(createdInvoice.discountAmount) > 0 && <p className="mt-1 text-[11px] text-rose-600">Descuento: - {formatCurrency(Number(createdInvoice.discountAmount))}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">IVA: {formatCurrency(Number(createdInvoice.taxAmount))}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Recibido: {paymentCurrency === 'USD' ? '$' : 'C$'} {formatSalesAmount(createdPaymentLines.reduce((sum, payment) => sum + Number(payment.amount || 0), 0))}</p>
                <p className="text-[11px] font-bold text-emerald-600">Cambio: C$ {formatSalesAmount(Math.max(0, createdPaymentLines.reduce((sum, payment) => sum + Number(payment.amount || 0), 0) * (paymentCurrency === 'USD' ? createdExchangeRate : 1) - Number(createdInvoice.total)))}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setCreatedInvoice(null)} className="rounded-xl font-black">Cerrar</Button>
              <Button onClick={() => printPosTicket(createdInvoice, createdTicketCart, createdPaymentLines, paymentCurrency, createdExchangeRate, companyName)} className="gap-2 rounded-xl font-black">
                <Receipt className="size-4" /> Imprimir ticket
              </Button>
            </div>
          </div>
        </div>
      )}
      {showPayment && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl rounded-2xl border bg-background p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-black">Checkout / Pago</h2>
                <p className="text-xs text-muted-foreground">Sesión: {activeSession.id.slice(0, 8)} · Tasa de cambio (Global): {Number(activeSession.exchangeRateUSD).toFixed(2)}</p>
              </div>
              <Button variant="ghost" onClick={() => setShowPayment(false)}>✕</Button>
            </div>

            {(() => {
              const totalToPay = paymentCurrency === 'USD' ? summary.total / Number(activeSession.exchangeRateUSD) : summary.total;
              const totalPaid = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
              const changeLocal = Math.max(0, totalPaid * (paymentCurrency === 'USD' ? Number(activeSession.exchangeRateUSD) : 1) - summary.total);

              return (
                <>
                  <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl bg-primary/10 p-3">
                      <span className="text-xs text-primary font-bold">Total a cobrar</span>
                      <div className="text-xl font-black text-primary">{paymentCurrency === 'USD' ? '$' : 'C$'} {formatSalesAmount(totalToPay)}</div>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3 border border-border/50">
                      <span className="text-xs text-muted-foreground">Total pagado</span>
                      <div className="text-xl font-black">{paymentCurrency === 'USD' ? '$' : 'C$'} {formatSalesAmount(totalPaid)}</div>
                    </div>
                    <div className={cn("rounded-xl p-3 border", changeLocal > 0 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-muted/20 border-border/30 text-muted-foreground")}>
                      <span className="text-xs font-bold">Cambio a entregar</span>
                      <div className="text-xl font-black">C$ {formatSalesAmount(changeLocal)}</div>
                    </div>
                  </div>

                  <div className="mb-4 space-y-2">
                    <Label>Moneda de pago</Label>
                    <Select value={paymentCurrency} onValueChange={(value: PaymentCurrency) => setPaymentCurrency(value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NIO">Córdobas (NIO)</SelectItem>
                        <SelectItem value="USD">Dólares (USD)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    {payments.map((payment, index) => (
                      <div key={`${payment.method}-${index}`} className="rounded-xl border p-3">
                        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                          <Select value={payment.method} onValueChange={(value: PosPaymentLine['method']) => setPayments(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, method: value, reference: value === 'TRANSFER' ? item.reference : undefined } : item))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CASH">Efectivo</SelectItem>
                              <SelectItem value="CARD">Tarjeta</SelectItem>
                              <SelectItem value="TRANSFER">Transferencia</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input type="number" min="0" step="0.01" placeholder="Monto" value={payment.amount || ''} onChange={(event) => setPayments(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: Number(event.target.value) || 0 } : item))} />
                          <Button variant="ghost" disabled={payments.length === 1} onClick={() => setPayments(current => current.filter((_, itemIndex) => itemIndex !== index))}>✕</Button>
                        </div>
                        {payment.method === 'CARD' && <Input className="mt-2" placeholder="Voucher / referencia (opcional)" value={payment.reference || ''} onChange={(event) => setPayments(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, reference: event.target.value } : item))} />}
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <Select value={payment.accountId || ''} onValueChange={(value) => setPayments(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, accountId: value } : item))}>
                            <SelectTrigger><SelectValue placeholder="Cuenta contable del cobro *" /></SelectTrigger>
                            <SelectContent>{bankAccounts.map(account => <SelectItem key={account.id} value={account.id}>{account.code} · {account.name}</SelectItem>)}</SelectContent>
                          </Select>
                          {payment.method === 'TRANSFER' && (
                            <Input placeholder="ID de referencia *" value={payment.reference || ''} onChange={(event) => setPayments(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, reference: event.target.value } : item))} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" className="mt-3 w-full" onClick={() => setPayments(current => [...current, { method: 'CARD', amount: 0 }])}>+ Agregar pago mixto</Button>
                </>
              );
            })()}
            <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setShowPayment(false)}>Cancelar</Button><Button onClick={() => void submitPayment()} disabled={submitting}>{submitting ? <Loader2 className="size-4 animate-spin" /> : 'Confirmar y emitir'}</Button></div>
          </div>
        </div>
      )}
      {showTutorial && <GuidedTour steps={POS_TOUR_STEPS} onClose={() => setShowTutorial(false)} title="Facturación por Caja" />}
      <ConfirmDialog
        open={duplicateMatches.length > 0}
        onOpenChange={(open) => {
          if (!open) {
            setDuplicateMatches([]);
            checkoutIdempotencyKey.current = null;
          }
        }}
        title="Posible venta duplicada"
        description="Encontramos ventas recientes con características similares. Revisa la información antes de continuar."
        confirmLabel="Continuar venta"
        cancelLabel="Revisar"
        variant="warning"
        loading={submitting}
        onConfirm={() => submitPayment(true)}
      >
        <div className="mt-3 max-h-52 space-y-2 overflow-y-auto text-left">
          {duplicateMatches.map((match) => (
            <div key={match.id} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs">
              <div className="flex items-center justify-between gap-2 font-bold">
                <span>{match.number}</span>
                <span>{match.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(match.total)}</span>
              </div>
              <p className="mt-1 text-muted-foreground">{match.customerName} · {match.registerName}</p>
              <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-300">Coincidencias: {match.matchedCriteria.join(', ')}</p>
            </div>
          ))}
        </div>
      </ConfirmDialog>
      <QuickAddCustomerModal
        open={showAddCustomer}
        onOpenChange={setShowAddCustomer}
        onSuccess={handleCustomerCreated}
      />
    </div>
  );
}
