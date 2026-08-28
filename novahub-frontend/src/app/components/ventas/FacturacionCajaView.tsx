import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  Calculator, Plus, Trash2, Loader2, Receipt, Search,
  CreditCard, Clock, CircleHelp, ShoppingCart, List, LayoutGrid,
  AlertCircle, Coins, Settings2, Store, BellRing, RefreshCw, CheckCircle2
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { safeGetItem, safeSetItem } from '../../services/safe-storage';
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
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '../ui/utils';
import {
  cajaService,
  type CashRegister,
  type PosProduct,
  type PosProductVariant,
  type PosCustomer,
  type PosInvoice,
  type PosInvoiceItem,
  type PosPaymentLine,
  type CashRegisterSession,
  type CashRegisterAvailability,
  type PosWarehouseOption,
  type PotentialDuplicateSale,
  type BranchProductAvailability,
  type CreatePosHoldDto,
  type PosHoldItemInput,
  type InvoiceCashQueue,
  type CashQueueDocument,
  consumeInvoiceCashQueueEvents,
} from '../../services/caja.service';
import { VariantPickerModal } from './VariantPickerModal';
import { AdministrarCajasModal } from './caja/AdministrarCajasModal';
import { BranchAvailabilityModal, type HoldReservationSelection } from './caja/BranchAvailabilityModal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { brandingService } from '../../services/branding.service';
import { createIdempotencyKey } from '../../services/api';
import { Skeleton as BoneyardSkeleton } from 'boneyard-js/react';
import { priceListsService, type PriceList } from '../../services/price-lists.service';
import { PriceMissingBadge, SalesLinePriceListSelect } from './SalesLinePriceListSelect';
import { formatSalesAmount, getMissingSalesPriceMessage, getSalesUnitPrice, hasSalesProductPriceListConflict, hasSalesProductPriceListConflicts, sameSalesId, unwrapSalesPriceListMatrix } from '../../utils/salesPriceList';
import { getLegacySalesExtraCostFields, getSalesExtraChargesAmount, getSalesExtraChargesPayload, normalizeSalesExtraCharges, type SalesExtraChargeLine } from '../../utils/salesCharges';
import { getSalesInvoiceStatusColor } from '../../utils/salesStatus';
import { isBankPaymentMethod, requiresPaymentReference, isCardPaymentMethod, calculateCardCommission, formatCommissionPercent } from '../../utils/paymentMethods';
import { getPdfDesignSettings } from '../../utils/pdfGenerator';
import { SalesAccountingLegend } from './SalesAccountingLegend';
import { BankAccountSelect } from '../ui/BankAccountSelect';
import { CurrencySelector } from '../ui/CurrencySelector';
import { playNotificationSound } from '../../utils/notificationSound';
import { SalesWarehouseStockHint } from './SalesWarehouseStockHint';
import { getCustomerFavorAmount, getMaximumCustomerFavorToApply } from '../../utils/customerBalance';

interface CartItem extends PosInvoiceItem {
  productId: string;
  variantId?: string;
  lineTotal: number;
  taxRate: number;
  discount: number;
  irRate?: number;
  irTaxId?: string | null;
  priceListId?: string;
  priceMissing?: boolean;
}

type PricingMode = 'global' | 'individual';

interface CartSession {
  cart: CartItem[];
  selectedCustomerId: string | undefined;
  emitDate: string;
  discountPercent: number;
  extraCharges: SalesExtraChargeLine[];
  deliveryDescription: string;
  deliveryAmount: number;
  selectedWarehouseId: string;
  includeTax: boolean;
  pricingMode: PricingMode;
}

interface PosDraftStorage {
  version: 1;
  branchId?: string;
  selectedRegisterId: string;
  selectedWarehouseId: string;
  selectedCustomerId?: string;
  selectedPriceListId: string;
  emitDate: string;
  discountPercent: number;
  extraCharges: SalesExtraChargeLine[];
  deliveryDescription: string;
  deliveryAmount: number;
  includeTax: boolean;
  pricingMode: PricingMode;
  productSearch: string;
  catalogItemFilter: CatalogItemFilter;
  cart: CartItem[];
  sessions: Record<string, CartSession>;
}

interface InvoiceSummary {
  subtotal: number;
  tax: number;
  discount: number;
  ir: number;
  extraCost: number;
  delivery: number;
  total: number;
}

type CatalogViewMode = 'list' | 'catalog';
type CatalogItemFilter = 'ALL' | 'PRODUCT' | 'SERVICE';

const CATALOG_VIEW_STORAGE_KEY = 'novahub-pos-catalog-view';
const POS_SHOW_AVAILABILITY_KEY = 'novahub-pos-show-availability';
const POS_DRAFT_STORAGE_PREFIX = 'novahub-pos-draft:';

function getPosDraftStorageKey(userId?: string | null, tenantId?: string | null) {
  return `${POS_DRAFT_STORAGE_PREFIX}${tenantId || 'tenant'}:${userId || 'user'}`;
}

function readPosDraft(storageKey: string): PosDraftStorage | null {
  try {
    const parsed = JSON.parse(safeGetItem(storageKey) || 'null') as Partial<PosDraftStorage> | null;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.cart)) return null;
    return {
      version: 1,
      branchId: typeof parsed.branchId === 'string' ? parsed.branchId : undefined,
      selectedRegisterId: typeof parsed.selectedRegisterId === 'string' ? parsed.selectedRegisterId : '',
      selectedWarehouseId: typeof parsed.selectedWarehouseId === 'string' ? parsed.selectedWarehouseId : '',
      selectedCustomerId: typeof parsed.selectedCustomerId === 'string' ? parsed.selectedCustomerId : undefined,
      selectedPriceListId: typeof parsed.selectedPriceListId === 'string' ? parsed.selectedPriceListId : '',
      emitDate: typeof parsed.emitDate === 'string' ? parsed.emitDate : getTodayInputDate(),
      discountPercent: Number(parsed.discountPercent || 0),
      extraCharges: Array.isArray(parsed.extraCharges) ? parsed.extraCharges : [],
      deliveryDescription: typeof parsed.deliveryDescription === 'string' ? parsed.deliveryDescription : '',
      deliveryAmount: Number(parsed.deliveryAmount || 0),
      includeTax: parsed.includeTax !== false,
      pricingMode: parsed.pricingMode === 'individual' ? 'individual' : 'global',
      productSearch: typeof parsed.productSearch === 'string' ? parsed.productSearch : '',
      catalogItemFilter: parsed.catalogItemFilter === 'PRODUCT' || parsed.catalogItemFilter === 'SERVICE' ? parsed.catalogItemFilter : 'ALL',
      cart: parsed.cart as CartItem[],
      sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions as Record<string, CartSession> : {},
    };
  } catch {
    return null;
  }
}

function getInitialCatalogView(): CatalogViewMode {
  try {
    return localStorage.getItem(CATALOG_VIEW_STORAGE_KEY) === 'catalog' ? 'catalog' : 'list';
  } catch {
    return 'list';
  }
}

function getInitialShowAvailability(): boolean {
  try {
    return localStorage.getItem(POS_SHOW_AVAILABILITY_KEY) === '1';
  } catch {
    return false;
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

async function printPosTicket(invoice: PosInvoice, cart: CartItem[], payments: PosPaymentLine[], currency: PaymentCurrency, exchangeRate: number, companyName: string, companyLogo?: string, paperSize: 'ticket' | 'letter' = 'ticket') {
  const isTicket = paperSize === 'ticket';
  const winWidth = isTicket ? 420 : 900;
  const winHeight = isTicket ? 700 : 700;
  const win = window.open('', '_blank', `width=${winWidth},height=${winHeight}`);
  if (!win) return;
  // Se consulta la vista específica para que el ticket no herede la plantilla de una factura.
  const ticketSettings = await getPdfDesignSettings('ventas.cash-ticket');
  // Las impresoras térmicas deben recibir una salida monocromática, aunque la
  // plantilla general de documentos tenga una paleta corporativa.
  const ticketPrimary = isTicket ? '#000' : (typeof ticketSettings.primaryColor === 'string' ? ticketSettings.primaryColor : '#000');
  const ticketText = isTicket ? '#000' : (typeof ticketSettings.textColor === 'string' ? ticketSettings.textColor : '#000');
  const ticketFont = typeof ticketSettings.fontFamily === 'string' ? ticketSettings.fontFamily.replace(/["'<>]/g, '') : 'monospace';
  const logo = ticketSettings.logoUrl || companyLogo;
  const money = (value: number) => `${currency === 'USD' ? '$' : 'C$'} ${formatSalesAmount(value)}`;
  const paidDisplay = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const paidLocal = paidDisplay * (currency === 'USD' ? exchangeRate : 1);
  const changeLocal = Math.max(0, paidLocal - Number(invoice.total));
  const customerName = invoice.customer?.name || invoice.customCustomerName || GENERAL_CUSTOMER_NAME;
  const customerPhone = invoice.customer?.phone;
  const paymentLabel = (method: PosPaymentLine['method']) => method === 'CASH' ? 'Efectivo' : method === 'CARD' ? 'Tarjeta' : method === 'CHECK' ? 'Cheque' : method === 'CUSTOMER_BALANCE' ? 'Saldo a favor' : 'Transferencia';
  const paymentRows = payments.map((payment) => {
    const paymentCurrency = payment.currency || currency;
    const paymentSymbol = paymentCurrency === 'USD' ? '$' : 'C$';
    return `<div class="row"><span>${paymentLabel(payment.method)}</span><span>${paymentSymbol} ${formatSalesAmount(Number(payment.amount || 0))}</span></div>`;
  }).join('');
  const itemRows = cart.map(item => `<div class="item"><div>${escapeTicketHtml(item.description)}</div><div class="row"><span>${item.quantity} x ${money(item.unitPrice / (currency === 'USD' ? exchangeRate : 1))}</span><span>${money(item.lineTotal / (currency === 'USD' ? exchangeRate : 1))}</span></div></div>`).join('');
  const discount = Number(invoice.discountAmount || 0);
  const delivery = Number(invoice.deliveryAmount || 0);
  const extraCharges = normalizeSalesExtraCharges(invoice).filter((charge) => charge.amount > 0);
  const additionalRows = `${extraCharges.map((charge) => `<div class="row"><span>${escapeTicketHtml(charge.description || 'Coste extra')}</span><span>${money(charge.amount / (currency === 'USD' ? exchangeRate : 1))}</span></div>`).join('')}${delivery > 0 ? `<div class="row"><span>${escapeTicketHtml(invoice.deliveryDescription || 'Delivery')}</span><span>${money(delivery / (currency === 'USD' ? exchangeRate : 1))}</span></div>` : ''}`;
  const totalRecibidoHtml = payments.length > 1 ? `<div class="row"><span>Total recibido</span><span>${money(paidDisplay)}</span></div>` : '';
  const registerCode = invoice.register?.code || 'N/D';

  const pageStyle = isTicket
    ? '@page{size:80mm auto;margin:0}*{box-sizing:border-box}html{width:80mm;min-width:80mm;max-width:80mm;margin:0;padding:0;background:#fff}body{display:flex;justify-content:center;align-items:flex-start;width:80mm;min-width:80mm;max-width:80mm;margin:0;padding:0;background:#fff;color:#000;font:10px monospace;filter:grayscale(1);-webkit-filter:grayscale(1)}body>div{width:72mm;max-width:72mm;margin:0;padding:4mm 0}.center{text-align:center;line-height:1.35}.line{border-top:1px dashed #000;margin:8px 0 0;padding:6px 0 0}.label{font-weight:800;letter-spacing:.08em;margin:4px 0}.item{padding:3px 0;border-bottom:1px dotted #555}.row{display:flex;justify-content:space-between;gap:8px;line-height:1.35}.row>span:first-child{min-width:0;overflow-wrap:anywhere}.row>span:last-child{flex:0 0 auto;text-align:right}.totals{margin-top:6px}.total{font-weight:800;border-top:1px solid #000;margin-top:4px;padding-top:4px}.footer{text-align:center;border-top:1px dashed #000;margin-top:10px;padding-top:6px}.company-logo{filter:grayscale(1);-webkit-filter:grayscale(1)}'
    : '@page{size:letter portrait;margin:15mm}body{margin:0;padding:0;font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif;font-size:11pt;color:#000;background:#fff}';

  const containerStyle = isTicket
    ? ''
    : 'style="max-width:800px;margin:0 auto;padding:20px;"';

  const logoHtml = logo
    ? `<img src="${escapeTicketHtml(logo)}" alt="Logo" style="display:block;width:auto;height:auto;max-width:${isTicket ? '42mm' : '180px'};max-height:${isTicket ? '16mm' : '55px'};object-fit:contain;margin:0 auto 6px;" />`
    : '';
  const headerHtml = isTicket
    ? `${logoHtml}<h2>${escapeTicketHtml(companyName)}</h2><h3>Comprobante de venta</h3>`
    : `<div style="text-align:center;margin-bottom:20px;padding-bottom:15px;border-bottom:2px solid #000;">${logoHtml}<h1 style="font-size:18pt;font-weight:800;margin:0 0 5px;text-transform:uppercase;">${escapeTicketHtml(companyName)}</h1><p style="font-size:10pt;color:#555;margin:0;">Comprobante de venta</p></div>`;

  win.document.write(`<html><head><title>${escapeTicketHtml(invoice.number)}</title><style>${pageStyle}</style></head><body><div ${containerStyle}>${headerHtml}<div class="center">Factura: ${escapeTicketHtml(invoice.number)}<br>Caja: ${escapeTicketHtml(registerCode)}<br>Fecha: ${new Date().toLocaleString('es-NI')}</div><div class="line"><div class="label">CLIENTE</div><div>${escapeTicketHtml(customerName)}</div>${customerPhone ? `<div>Tel: ${escapeTicketHtml(customerPhone)}</div>` : ''}</div><div class="label">DETALLE</div>${itemRows}<div class="line totals"><div class="row"><span>Subtotal</span><span>${money(Number(invoice.subtotal) / (currency === 'USD' ? exchangeRate : 1))}</span></div>${discount > 0 ? `<div class="row"><span>Descuento</span><span>- ${money(discount / (currency === 'USD' ? exchangeRate : 1))}</span></div>` : ''}<div class="row"><span>IVA</span><span>${money(Number(invoice.taxAmount) / (currency === 'USD' ? exchangeRate : 1))}</span></div>${additionalRows}<div class="row total"><span>TOTAL</span><span>${money(Number(invoice.total) / (currency === 'USD' ? exchangeRate : 1))}</span></div></div><div class="line"><div class="label">PAGO</div>${paymentRows}${totalRecibidoHtml}<div class="row"><span>Cambio / vuelto</span><span>C$ ${formatSalesAmount(changeLocal)}</span></div></div><div class="footer">Gracias por su compra</div></div></body></html>`);
  const designStyle = win.document.createElement('style');
  designStyle.textContent = ['body{font-family:', ticketFont, ';color:', ticketText, '}', 'h2,.label,.total{color:', ticketPrimary, '}', '.line{border-color:', ticketPrimary, '}', isTicket ? '.company-logo{filter:grayscale(1);-webkit-filter:grayscale(1)}' : ''].join('');
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
  return taxable + tax;
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
  pricingMode: PricingMode = 'global',
  extraCostAmount = 0,
  deliveryAmount = 0,
): InvoiceSummary {
  const additionalCharges = Math.max(0, Number(extraCostAmount || 0)) + Math.max(0, Number(deliveryAmount || 0));
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
    return { subtotal, tax, discount, ir: 0, extraCost: Math.max(0, Number(extraCostAmount || 0)), delivery: Math.max(0, Number(deliveryAmount || 0)), total: subtotal + tax - discount + additionalCharges };
  }
  const discount = subtotal * (discountPercent / 100);
  const taxableSubtotal = Math.max(0, subtotal - discount);
  const tax = includeTax ? taxableSubtotal * (NICARAGUA_IVA_RATE / 100) : 0;
  return {
    subtotal,
    tax,
    discount,
    ir: 0,
    extraCost: Math.max(0, Number(extraCostAmount || 0)),
    delivery: Math.max(0, Number(deliveryAmount || 0)),
    total: subtotal + tax - discount + additionalCharges,
  };
}

function buildInvoiceItems(cart: CartItem[]): PosInvoiceItem[] {
  return cart.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    priceListId: item.priceListId,
    taxRate: item.taxRate,
    discount: item.discount,
    irRate: 0,
    irTaxId: null,
    warehouseId: item.warehouseId,
  }));
}

function getInvoiceCustomerName(invoice: PosInvoice) {
  return invoice.customer?.name || invoice.customCustomerName || GENERAL_CUSTOMER_NAME;
}

interface FacturacionCajaViewProps {
  onNavigateToControlCaja?: (registerId?: string) => void;
  branchId?: string;
}

export function FacturacionCajaView({ onNavigateToControlCaja, branchId }: FacturacionCajaViewProps) {
  const { formatConvertedAmount: formatCurrency, displayCurrency, baseCurrency, exchangeRate: globalRate, convertBetweenCurrencies, toBaseAmount } = useCurrency();
  const { user, canPerform } = useAuth();
  const canPayPos = canPerform('RETAIL_POS', 'pay');
  // El comprobante se genera localmente después de un cobro POS exitoso.
  // Todo usuario que puede cobrar debe poder imprimir su voucher/ticket,
  // aunque su rol granular no tenga el flag histórico `print`.
  const canPrintPos = canPayPos || canPerform('RETAIL_POS', 'print');
  const queryClient = useQueryClient();
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [manageCajasOpen, setManageCajasOpen] = useState(false);
  const [registerAvailability, setRegisterAvailability] = useState<CashRegisterAvailability | null>(null);
  const [warehouseOptions, setWarehouseOptions] = useState<PosWarehouseOption[]>([]);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<PosInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const checkoutIdempotencyKey = useRef<string | null>(null);

  const [selectedRegisterId, setSelectedRegisterId] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [priceListItems, setPriceListItems] = useState<Array<{ priceListId: string; productId: string; price: number; currency: string; exchangeRate: number; basePrice: number }>>([]);
  const [selectedPriceListId, setSelectedPriceListId] = useState('');
  const [emitDate, setEmitDate] = useState(getTodayInputDate());
  const [discountPercent, setDiscountPercent] = useState(0);
  const [extraCharges, setExtraCharges] = useState<SalesExtraChargeLine[]>([]);
  const [deliveryDescription, setDeliveryDescription] = useState('');
  const [deliveryAmount, setDeliveryAmount] = useState(0);
  const [pricingMode, setPricingMode] = useState<PricingMode>('global');
  const [irTaxId] = useState<string | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const skipInitialProductSearchRef = useRef(false);
  const [catalogItemFilter, setCatalogItemFilter] = useState<CatalogItemFilter>('ALL');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartSessionRevision, setCartSessionRevision] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [includeTax, setIncludeTax] = useState(true);
  const [catalogView, setCatalogView] = useState<CatalogViewMode>(getInitialCatalogView);
  const [showAvailabilityAction, setShowAvailabilityAction] = useState<boolean>(getInitialShowAvailability);
  const [showPayment, setShowPayment] = useState(false);
  const [mixedPaymentEnabled, setMixedPaymentEnabled] = useState(false);
  const [paymentCurrency, setPaymentCurrency] = useState<PaymentCurrency>(displayCurrency);
  const [activeSession, setActiveSession] = useState<CashRegisterSession | null>(null);
  const [payments, setPayments] = useState<PosPaymentLine[]>([{ method: 'CASH', amount: 0, currency: displayCurrency, exchangeRate: displayCurrency === baseCurrency ? 1 : globalRate }]);
  const [createdInvoice, setCreatedInvoice] = useState<PosInvoice | null>(null);
  const [createdTicketCart, setCreatedTicketCart] = useState<CartItem[]>([]);
  const [createdPaymentLines, setCreatedPaymentLines] = useState<PosPaymentLine[]>([]);
  const [createdExchangeRate, setCreatedExchangeRate] = useState(1);
  const [createdPaymentCurrency, setCreatedPaymentCurrency] = useState<PaymentCurrency>(displayCurrency);
  const [createdOperationLabel, setCreatedOperationLabel] = useState('Factura emitida correctamente');
  const [companyName, setCompanyName] = useState('Empresa');
  const [companyLogo, setCompanyLogo] = useState('');
  const [duplicateMatches, setDuplicateMatches] = useState<PotentialDuplicateSale[]>([]);
  const [cashQueue, setCashQueue] = useState<InvoiceCashQueue[]>([]);
  const [cashQueueLoading, setCashQueueLoading] = useState(false);
  const [cashQueueError, setCashQueueError] = useState<string | null>(null);
  const [cashQueueLastSyncAt, setCashQueueLastSyncAt] = useState<Date | null>(null);
  const [cashQueueConnection, setCashQueueConnection] = useState<'CONNECTING' | 'LIVE' | 'RECONNECTING' | 'ERROR'>('CONNECTING');
  const cashQueueRequestRef = useRef<Promise<void> | null>(null);
  const cashQueueEnabledRef = useRef(false);
  const [queueInvoice, setQueueInvoice] = useState<InvoiceCashQueue | null>(null);
  const [queuePayments, setQueuePayments] = useState<PosPaymentLine[]>([]);
  const [queueMixedPaymentEnabled, setQueueMixedPaymentEnabled] = useState(false);
  const [queueSubmitting, setQueueSubmitting] = useState(false);
  const queueSubmittingRef = useRef(false);
  const [queueClaimingId, setQueueClaimingId] = useState<string | null>(null);
  const [queueReleasingId, setQueueReleasingId] = useState<string | null>(null);
  const [reconcilingQueue, setReconcilingQueue] = useState(false);
  const queueClaimingRef = useRef<string | null>(null);
  const queueReleasingRef = useRef<string | null>(null);
  const reconcilingQueueRef = useRef(false);
  const cartSessions = useRef<Map<string, CartSession>>(new Map());
  const selectedRegisterIdRef = useRef('');
  const selectedWarehouseIdRef = useRef('');
  const posDraftHydratedRef = useRef(false);
  const posDraftStorageKey = useMemo(
    () => getPosDraftStorageKey(user?.id, user?.tenantId),
    [user?.id, user?.tenantId],
  );

  useEffect(() => {
    selectedRegisterIdRef.current = selectedRegisterId;
  }, [selectedRegisterId]);

  useEffect(() => {
    selectedWarehouseIdRef.current = selectedWarehouseId;
  }, [selectedWarehouseId]);

  const getQueueDocument = (queue: InvoiceCashQueue): CashQueueDocument | null => queue.invoice || queue.creditNote || null;

  const normalizedExtraCharges = useMemo(
    () => getSalesExtraChargesPayload({ extraCharges }),
    [extraCharges],
  );
  const legacyExtraCostFields = useMemo(
    () => getLegacySalesExtraCostFields(normalizedExtraCharges),
    [normalizedExtraCharges],
  );
  const extraCostAmount = useMemo(
    () => getSalesExtraChargesAmount({ extraCharges }),
    [extraCharges],
  );

  const paymentLineRate = (currency: PaymentCurrency) => currency === baseCurrency ? 1 : Number(globalRate || 1);
  const paymentLine = (method: PosPaymentLine['method'], amount = 0, currency: PaymentCurrency = displayCurrency): PosPaymentLine => ({
    method,
    amount,
    currency,
    exchangeRate: paymentLineRate(currency),
  });

  const getCustomerFavorBase = (customerId?: string | null) => getCustomerFavorAmount(
    customers.find((customer) => customer.id === customerId),
  );

  const getPaymentLineBase = (payment: PosPaymentLine, fallbackCurrency: PaymentCurrency) => toBaseAmount(
    Number(payment.amount || 0),
    payment.currency || fallbackCurrency,
    (payment.currency || fallbackCurrency) === baseCurrency
      ? 1
      : Number(payment.exchangeRate || globalRate || activeSession?.exchangeRateUSD || 1),
  );

  const hasOpenCashSession = Boolean(
    selectedRegisterId && activeSession?.id && activeSession.status === 'OPEN',
  );
  cashQueueEnabledRef.current = hasOpenCashSession;

  const loadCashQueue = useCallback(async () => {
    if (!user?.tenantId || !hasOpenCashSession) {
      setCashQueue([]);
      setCashQueueError(null);
      setCashQueueLastSyncAt(null);
      setCashQueueLoading(false);
      return;
    }
    if (cashQueueRequestRef.current) return cashQueueRequestRef.current;
    setCashQueueLoading(true);
    const request = (async () => {
      try {
        const response = await cajaService.getInvoiceCashQueue({ status: 'PENDING,CLAIMED', page: 1, pageSize: 50 });
        const payload = (response as any)?.data || response;
        if (!Array.isArray(payload?.items)) throw new Error('La respuesta de la cola de caja no es válida.');
        if (!cashQueueEnabledRef.current) return;
        setCashQueue(payload.items);
        setCashQueueError(null);
        setCashQueueLastSyncAt(new Date());
      } catch (error: unknown) {
        if ((error as any)?.name !== 'AbortError') {
          setCashQueueError(getErrorMessage(error, 'No se pudo sincronizar la cola de caja.'));
        }
      } finally {
        setCashQueueLoading(false);
        cashQueueRequestRef.current = null;
      }
    })();
    cashQueueRequestRef.current = request;
    return request;
  }, [hasOpenCashSession, user?.tenantId]);

  useEffect(() => {
    void loadCashQueue();
    const timer = window.setInterval(() => void loadCashQueue(), 60000);
    return () => window.clearInterval(timer);
  }, [loadCashQueue]);

  useEffect(() => {
    if (!user?.tenantId || !hasOpenCashSession) {
      setCashQueueConnection('CONNECTING');
      return;
    }
    const controller = new AbortController();
    let retryTimer: number | null = null;
    let retryAttempt = 0;
    const connect = async () => {
      if (controller.signal.aborted) return;
      setCashQueueConnection(retryAttempt > 0 ? 'RECONNECTING' : 'CONNECTING');
      try {
        await consumeInvoiceCashQueueEvents(
          controller.signal,
          (event) => {
            if (controller.signal.aborted) return;
            setCashQueueConnection('LIVE');
            if (event.status === 'PENDING') playNotificationSound();
            void loadCashQueue();
          },
          () => {
            retryAttempt = 0;
            setCashQueueConnection('LIVE');
          },
        );
        if (!controller.signal.aborted) {
          retryAttempt += 1;
          setCashQueueConnection('RECONNECTING');
          retryTimer = window.setTimeout(() => void connect(), 1000);
        }
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        retryAttempt += 1;
        setCashQueueConnection('ERROR');
        const delay = Math.min(10000, 1000 * Math.max(1, retryAttempt));
        retryTimer = window.setTimeout(() => void connect(), delay);
      }
    };
    void connect();
    return () => {
      controller.abort();
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, [hasOpenCashSession, loadCashQueue, user?.tenantId]);

  const handleClaimCashQueue = async (queue: InvoiceCashQueue) => {
    if (queueClaimingRef.current) return;
    if (!selectedRegisterId || !activeSession) {
      toast.error('Apertura una sesión de caja para tomar la factura.');
      onNavigateToControlCaja?.(selectedRegisterId);
      return;
    }
    queueClaimingRef.current = queue.id;
    setQueueClaimingId(queue.id);
    try {
      const response = await cajaService.claimInvoiceCashQueue(queue.id, { registerId: selectedRegisterId, sessionId: activeSession.id });
      const claimed = (response as any)?.data || response;
      const claimedQueue = claimed?.invoice || claimed?.creditNote ? claimed : queue;
      const document = getQueueDocument(claimedQueue);
      if (!document) throw new Error('La entrada de la cola no tiene un documento cobrable.');
      setQueueInvoice(claimedQueue);
      setQueuePayments([paymentLine('CASH', Number(document.balance || 0), document.currency)]);
      setQueueMixedPaymentEnabled(false);
      await loadCashQueue();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'El documento ya fue tomado o no se pudo reservar en esta caja.'));
      void loadCashQueue();
    } finally {
      queueClaimingRef.current = null;
      setQueueClaimingId(null);
    }
  };

  const handleReleaseCashQueue = async (queue: InvoiceCashQueue) => {
    if (queueReleasingRef.current) return;
    queueReleasingRef.current = queue.id;
    setQueueReleasingId(queue.id);
    try {
      await cajaService.releaseInvoiceCashQueue(queue.id, { claimToken: queue.claimToken || undefined, reason: 'MANUAL' });
      if (queueInvoice?.id === queue.id) {
        setQueueInvoice(null);
        setQueuePayments([]);
        setQueueMixedPaymentEnabled(false);
      }
      const document = getQueueDocument(queue);
      toast.success(`${document?.number || 'Documento'} liberado para cualquier cajero.`);
      await loadCashQueue();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'No se pudo liberar la factura. Actualiza la cola e inténtalo nuevamente.'));
      void loadCashQueue();
    } finally {
      queueReleasingRef.current = null;
      setQueueReleasingId(null);
    }
  };

  const handleReconcileCashQueue = async () => {
    if (reconcilingQueueRef.current) return;
    reconcilingQueueRef.current = true;
    setReconcilingQueue(true);
    try {
      const response = await cajaService.reconcileInvoiceCashQueue();
      const result = (response as any)?.data || response;
      toast.success(`Reconciliación completada: ${Number(result?.released || 0) + Number(result?.markedPaid || 0)} reserva(s) corregida(s).`);
      await loadCashQueue();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'No se pudo reconciliar la cola de caja.'));
    } finally {
      reconcilingQueueRef.current = false;
      setReconcilingQueue(false);
    }
  };

  useEffect(() => {
    if (!queueInvoice || !activeSession || !selectedRegisterId || !queueInvoice.claimToken) return;
    let disposed = false;
    const heartbeat = async () => {
      try {
        const response = await cajaService.heartbeatInvoiceCashQueue(queueInvoice.id, {
          registerId: selectedRegisterId,
          sessionId: activeSession.id,
          claimToken: queueInvoice.claimToken || undefined,
        });
        if (!disposed) {
          const renewed = (response as any)?.data || response;
          setQueueInvoice((current) => current?.id === queueInvoice.id ? { ...current, claimExpiresAt: renewed.claimExpiresAt, lastActivityAt: renewed.lastActivityAt } : current);
        }
      } catch (error: unknown) {
        if (disposed) return;
        setQueueInvoice(null);
        setQueuePayments([]);
        toast.error(getErrorMessage(error, 'La reserva expiró. Toma nuevamente la factura antes de cobrar.'));
        void loadCashQueue();
      }
    };
    void heartbeat();
    const timer = window.setInterval(() => void heartbeat(), 60000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [activeSession, loadCashQueue, queueInvoice?.claimToken, queueInvoice?.id, selectedRegisterId]);

  const getQueuePaymentSummary = () => {
    if (!queueInvoice || !activeSession) return { totalBase: 0, paidBase: 0, changeBase: 0, missingBase: 0 };
    const document = getQueueDocument(queueInvoice);
    if (!document) return { totalBase: 0, paidBase: 0, changeBase: 0, missingBase: 0 };
    const invoiceCurrency = document.currency;
    const invoiceRate = invoiceCurrency === baseCurrency ? 1 : Number(activeSession.exchangeRateUSD || globalRate || 1);
    const totalBase = toBaseAmount(Number(document.balance || 0), invoiceCurrency, invoiceRate);
    const paidBase = queuePayments.reduce((sum, payment) => sum + toBaseAmount(
      Number(payment.amount || 0),
      payment.currency || invoiceCurrency,
      (payment.currency || invoiceCurrency) === baseCurrency ? 1 : Number(payment.exchangeRate || activeSession.exchangeRateUSD || globalRate || 1),
    ), 0);
    return {
      totalBase,
      paidBase,
      changeBase: !queueMixedPaymentEnabled && queuePayments.length === 1 && queuePayments[0]?.method !== 'CASH'
        ? 0
        : Math.max(0, paidBase - totalBase),
      missingBase: Math.max(0, totalBase - paidBase),
    };
  };

  const getQueuePaymentApplications = () => {
    if (!queueInvoice || !activeSession) return [] as PosPaymentLine[];
    const document = getQueueDocument(queueInvoice);
    if (!document) return [] as PosPaymentLine[];
    const invoiceCurrency = document.currency;
    let remainingBase = getQueuePaymentSummary().totalBase;
    return queuePayments.flatMap((payment) => {
      if (remainingBase <= 0.005) return [];
      const currency = payment.currency || invoiceCurrency;
      const exchangeRate = currency === baseCurrency
        ? 1
        : Number(payment.exchangeRate || activeSession.exchangeRateUSD || globalRate || 1);
      const lineBase = toBaseAmount(Number(payment.amount || 0), currency, exchangeRate);
      const appliedBase = Math.min(lineBase, remainingBase);
      if (appliedBase <= 0.005) return [];
      remainingBase = Math.max(0, remainingBase - appliedBase);
      return [{
        ...payment,
        amount: Number(convertBetweenCurrencies(appliedBase, baseCurrency, currency, 1, exchangeRate).toFixed(2)),
        currency,
        exchangeRate,
      }];
    });
  };

  const submitCashQueuePayment = async () => {
    if (!queueInvoice || !activeSession || !selectedRegisterId || queueSubmittingRef.current) return;
    const queueReceipt = queueInvoice;
    const document = getQueueDocument(queueReceipt);
    const isCreditQueue = Boolean(queueReceipt.creditNoteId || queueReceipt.creditNote);
    if (!document) return void toast.error('La entrada de la cola no tiene un documento cobrable.');
    const { totalBase, paidBase } = getQueuePaymentSummary();
    const queueCustomerFavorBase = getCustomerFavorBase(document.customerId);
    const queueCustomerFavorAppliedBase = queuePayments
      .filter((payment) => payment.method === 'CUSTOMER_BALANCE')
      .reduce((sum, payment) => sum + getPaymentLineBase(payment, document.currency), 0);
    if (queueCustomerFavorAppliedBase > queueCustomerFavorBase + 0.01) {
      toast.error(`El saldo a favor disponible es de ${formatCurrency(queueCustomerFavorBase, baseCurrency)}.`);
      return;
    }
    if (queueCustomerFavorAppliedBase > 0.01 && !document.customerId) {
      toast.error('Esta factura no tiene un cliente al cual aplicar saldo a favor.');
      return;
    }
    if (!isCreditQueue && paidBase + 0.005 < totalBase) { toast.error('El monto recibido debe cubrir el saldo pendiente.'); return; }
    if (!queueMixedPaymentEnabled && queuePayments.length === 1 && queuePayments[0]?.method !== 'CASH' && paidBase > totalBase + 0.005) {
      toast.error('El monto solo puede superar el total cuando el método es efectivo.');
      return;
    }
    if (queuePayments.some((payment) => requiresPaymentReference(payment.method) && !payment.reference?.trim())) { toast.error('La referencia es obligatoria para transferencia, tarjeta y cheque.'); return; }
    if (queuePayments.some((payment) => isBankPaymentMethod(payment.method, true) && !payment.bankAccountId)) { toast.error('Selecciona el banco para cada pago con tarjeta, transferencia o cheque.'); return; }
    const appliedPayments = getQueuePaymentApplications();
    if (!appliedPayments.length) { toast.error('Registra un monto válido para cubrir el saldo pendiente.'); return; }
    const changeBase = Math.max(0, paidBase - totalBase);
    queueSubmittingRef.current = true;
    setQueueSubmitting(true);
    try {
      await cajaService.payInvoiceCashQueue(queueInvoice.id, { registerId: selectedRegisterId, sessionId: activeSession.id, claimToken: queueInvoice.claimToken || undefined, payments: appliedPayments }, createIdempotencyKey('invoice-cash-queue'));
      const paidInvoice = {
        ...document,
        customerId: document.customerId || '',
        date: document.date || new Date().toISOString(),
        subtotal: Number(document.subtotal ?? document.total ?? 0),
        taxAmount: Number(document.taxAmount || 0),
        discountAmount: Number(document.discountAmount || 0),
        total: Number(document.total || 0),
        balance: Math.max(0, Number(document.balance || 0) - Number(convertBetweenCurrencies(Math.min(paidBase, totalBase), baseCurrency, document.currency, 1, Number(document.exchangeRate || 1)))),
        status: paidBase + 0.005 >= totalBase ? 'PAID' : 'PARTIAL',
        register: queueReceipt.register ? { ...queueReceipt.register } as CashRegister : undefined,
      } as PosInvoice;
      const receiptCart: CartItem[] = (document.items || []).map((item) => ({
        productId: item.id,
        description: item.description,
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        lineTotal: Number(item.total ?? Number(item.quantity || 0) * Number(item.unitPrice || 0)),
        taxRate: 0,
        discount: 0,
      }));
      setCreatedInvoice(paidInvoice);
      setCreatedTicketCart(receiptCart);
       // El comprobante debe conservar lo recibido para poder mostrar el
       // vuelto; `appliedPayments` contiene únicamente lo aplicado al saldo.
       setCreatedPaymentLines([...queuePayments]);
      setCreatedExchangeRate(Number(document.exchangeRate || activeSession.exchangeRateUSD || 1));
      setCreatedPaymentCurrency(document.currency);
      setCreatedOperationLabel('Cobro realizado correctamente');
      toast.success(`${isCreditQueue ? 'Crédito' : 'Factura'} ${document.number} cobrado en caja.${changeBase > 0.005 ? ` Cambio: ${baseCurrency === 'USD' ? '$' : 'C$'} ${formatSalesAmount(changeBase)}` : ''}`);
      setQueueInvoice(null);
      setQueuePayments([]);
      await Promise.all([loadCashQueue(), queryClient.invalidateQueries({ queryKey: ['sales'] }), queryClient.invalidateQueries({ queryKey: ['finance'] }), queryClient.invalidateQueries({ queryKey: ['accounting'] })]);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'No se pudo registrar el cobro de la factura.'));
    } finally {
      queueSubmittingRef.current = false;
      setQueueSubmitting(false);
    }
  };

  // --- Venta suspendida / reservada inter-sucursal ---
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [availabilityProduct, setAvailabilityProduct] = useState<PosProduct | null>(null);
  const [availabilityQuantity, setAvailabilityQuantity] = useState(1);
  const [availabilityRows, setAvailabilityRows] = useState<BranchProductAvailability[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [holdSubmitting, setHoldSubmitting] = useState(false);
  const holdSubmittingRef = useRef(false);
  const [holdCreateDto, setHoldCreateDto] = useState<CreatePosHoldDto | null>(null);
  const selectedPaymentCustomerId = holdCreateDto?.customerId || selectedCustomerId;
  const selectedPaymentCustomerFavorBase = getCustomerFavorBase(selectedPaymentCustomerId);
  const selectedPaymentCustomerFavorAppliedBase = payments
    .filter((payment) => payment.method === 'CUSTOMER_BALANCE')
    .reduce((sum, payment) => sum + getPaymentLineBase(payment, paymentCurrency), 0);
  const selectedPaymentCustomerFavorExceeded = selectedPaymentCustomerFavorAppliedBase > selectedPaymentCustomerFavorBase + 0.01;
  const handlePaymentMethodChange = (index: number, nextMethod: PosPaymentLine['method']) => {
    setPayments((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const nextLine = {
        ...item,
        method: nextMethod,
        reference: requiresPaymentReference(nextMethod) ? item.reference : undefined,
        bankAccountId: isBankPaymentMethod(nextMethod, true) ? item.bankAccountId : undefined,
        cardCommissionPercent: nextMethod === 'CARD' ? item.cardCommissionPercent : 0,
        cardCommissionAmount: nextMethod === 'CARD' ? item.cardCommissionAmount : 0,
      };
      if (nextMethod !== 'CUSTOMER_BALANCE') return nextLine;
      const currentLineBase = getPaymentLineBase(item, paymentCurrency);
      const otherPaymentsBase = current.reduce((sum, payment) => sum + getPaymentLineBase(payment, paymentCurrency), 0) - currentLineBase;
      const documentRate = paymentCurrency === baseCurrency ? 1 : Number(globalRate || activeSession?.exchangeRateUSD || 1);
      const maximumBase = getMaximumCustomerFavorToApply(
        selectedPaymentCustomerFavorBase,
        toBaseAmount(summary.total, paymentCurrency, documentRate),
        otherPaymentsBase,
      );
      return { ...nextLine, amount: maximumBase, currency: baseCurrency, exchangeRate: 1 };
    }));
  };
  const [variantPickerOpen, setVariantPickerOpen] = useState(false);
  const [variantPickerProduct, setVariantPickerProduct] = useState<PosProduct | null>(null);

  useEffect(() => {
    if (!user?.tenantId) return;
    setPriceLists([]);
    setPriceListItems([]);
    setSelectedPriceListId('');
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
      setSelectedPriceListId((current) => {
        if (current) return current;
        const retailList = normalizedLists.find((list: PriceList) => String(list.code || '').toUpperCase() === 'RETAIL' || String(list.name || '').toLowerCase().includes('minorista'));
        return retailList?.id || normalizedLists.find((list: PriceList) => list.isDefault)?.id || normalizedLists[0]?.id || '';
      });
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
        selectedWarehouseId,
        extraCharges,
        deliveryDescription,
        deliveryAmount,
        includeTax,
        pricingMode,
      });
      setCartSessionRevision((current) => current + 1);
    }

    // Restaurar sesión de la nueva caja
    const savedSession = cartSessions.current.get(newRegisterId);
    if (savedSession) {
      setCart(savedSession.cart);
      setSelectedCustomerId(savedSession.selectedCustomerId);
      setEmitDate(savedSession.emitDate);
      setDiscountPercent(savedSession.discountPercent);
      setSelectedWarehouseId(savedSession.selectedWarehouseId || warehouseOptions.find((warehouse) => warehouse.canOperate)?.id || '');
      setExtraCharges(savedSession.extraCharges || []);
      setDeliveryDescription(savedSession.deliveryDescription || '');
      setDeliveryAmount(Number(savedSession.deliveryAmount || 0));
      setIncludeTax(savedSession.includeTax);
      setPricingMode(savedSession.pricingMode || 'global');
    } else {
      // Estado fresco
      setCart([]);
      setSelectedCustomerId(undefined);
      setEmitDate(getTodayInputDate());
      setDiscountPercent(0);
      setSelectedWarehouseId(warehouseOptions.find((warehouse) => warehouse.canOperate)?.id || '');
      setExtraCharges([]);
      setDeliveryDescription('');
      setDeliveryAmount(0);
      setIncludeTax(true);
      setPricingMode('global');
    }

    setSelectedRegisterId(newRegisterId);
  };


  const loadInitialData = useCallback(async () => {
    setLoading(true);
    skipInitialProductSearchRef.current = true;
    try {
      const [cashRegisters, registeredCustomers, posWarehouses] = await Promise.all([
        cajaService.getRegisters(),
        cajaService.getCustomers(),
        cajaService.getPosWarehouses(),
      ]);
      const branchRegisters = cashRegisters;
      setRegisters(branchRegisters);
      setWarehouseOptions(posWarehouses);

      if (branchRegisters.length === 0) {
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

      const storedDraft = readPosDraft(posDraftStorageKey);
      const canRestoreDraft = Boolean(
        storedDraft
        && (!storedDraft.branchId || !branchId || storedDraft.branchId === branchId),
      );
      const draft = canRestoreDraft ? storedDraft : null;
      const currentRegisterId = selectedRegisterIdRef.current;
      const openRegister = branchRegisters.find((register) => register.hasActiveSession);
      const fallbackRegisterId = openRegister?.id || branchRegisters[0]?.id || '';
      const draftRegisterId = draft?.selectedRegisterId && branchRegisters.some((register) => register.id === draft.selectedRegisterId)
        ? draft.selectedRegisterId
        : '';
      const initialRegisterId = currentRegisterId && branchRegisters.some((register) => register.id === currentRegisterId)
        ? currentRegisterId
        : draftRegisterId || fallbackRegisterId;
      if (initialRegisterId !== currentRegisterId) setSelectedRegisterId(initialRegisterId);

      const currentWarehouseId = selectedWarehouseIdRef.current;
      const firstWarehouseId = posWarehouses.find((warehouse) => warehouse.canOperate)?.id || '';
      const draftWarehouseId = draft?.selectedWarehouseId && posWarehouses.some((warehouse) => warehouse.id === draft.selectedWarehouseId && warehouse.canOperate)
        ? draft.selectedWarehouseId
        : '';
      const initialWarehouseId = currentWarehouseId && posWarehouses.some((warehouse) => warehouse.id === currentWarehouseId && warehouse.canOperate)
        ? currentWarehouseId
        : draftWarehouseId || firstWarehouseId;
      if (initialWarehouseId !== currentWarehouseId) setSelectedWarehouseId(initialWarehouseId);

      if (!posDraftHydratedRef.current) {
        if (draft) {
          cartSessions.current = new Map(
            Object.entries(draft.sessions).filter(([, session]) => Boolean(session && Array.isArray(session.cart))),
          );
          setCart(draft.cart);
          setSelectedCustomerId(draft.selectedCustomerId);
          setSelectedPriceListId(draft.selectedPriceListId);
          setEmitDate(draft.emitDate);
          setDiscountPercent(draft.discountPercent);
          setExtraCharges(draft.extraCharges);
          setDeliveryDescription(draft.deliveryDescription);
          setDeliveryAmount(draft.deliveryAmount);
          setIncludeTax(draft.includeTax);
          setPricingMode(draft.pricingMode);
          setProductSearch(draft.productSearch);
          setCatalogItemFilter(draft.catalogItemFilter);
        }
        posDraftHydratedRef.current = true;
      }

      const availableProducts = await cajaService.getProducts(undefined, initialWarehouseId || undefined);
      setProducts(availableProducts);
      setCustomers(registeredCustomers);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Error al cargar datos de caja'));
    } finally {
      setLoading(false);
    }
  }, [branchId, posDraftStorageKey]);

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
    brandingService.getCurrent().then((branding) => {
      if (branding?.companyName?.trim()) setCompanyName(branding.companyName.trim());
      if (branding?.logo) setCompanyLogo(branding.logo);
    }).catch(() => undefined);
  }, [loadInitialData]);

  useEffect(() => {
    if (!user?.id || !posDraftHydratedRef.current) return;
    safeSetItem(posDraftStorageKey, JSON.stringify({
      version: 1,
      branchId,
      selectedRegisterId,
      selectedWarehouseId,
      selectedCustomerId,
      selectedPriceListId,
      emitDate,
      discountPercent,
      extraCharges,
      deliveryDescription,
      deliveryAmount,
      includeTax,
      pricingMode,
      productSearch,
      catalogItemFilter,
      cart,
      sessions: Object.fromEntries(cartSessions.current.entries()),
    } satisfies PosDraftStorage));
  }, [
    branchId,
    cart,
    cartSessionRevision,
    catalogItemFilter,
    deliveryAmount,
    deliveryDescription,
    discountPercent,
    emitDate,
    extraCharges,
    includeTax,
    posDraftStorageKey,
    pricingMode,
    productSearch,
    selectedCustomerId,
    selectedPriceListId,
    selectedRegisterId,
    selectedWarehouseId,
    user?.id,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedRegisterId) {
      setActiveSession(null);
      return () => { cancelled = true; };
    }
    setActiveSession(null);
    cajaService.getActiveSession(selectedRegisterId)
      .then((session) => {
        if (!cancelled) setActiveSession(session?.status === 'OPEN' ? session : null);
      })
      .catch(() => {
        if (!cancelled) setActiveSession(null);
      });
    return () => { cancelled = true; };
  }, [selectedRegisterId]);

  useEffect(() => {
    if (!hasOpenCashSession) {
      setCashQueue([]);
      setQueueInvoice(null);
      setQueuePayments([]);
      setQueueMixedPaymentEnabled(false);
    }
  }, [hasOpenCashSession]);

  useEffect(() => {
    try {
      safeSetItem(CATALOG_VIEW_STORAGE_KEY, catalogView);
    } catch {
      // La preferencia es opcional; la vista sigue funcionando sin almacenamiento local.
    }
  }, [catalogView]);

  useEffect(() => {
    try {
      safeSetItem(POS_SHOW_AVAILABILITY_KEY, showAvailabilityAction ? '1' : '0');
    } catch {
      // La preferencia es opcional; la tabla sigue funcionando sin almacenamiento local.
    }
  }, [showAvailabilityAction]);

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
    if (!selectedRegisterId) return;
    if (!productSearch.trim() && skipInitialProductSearchRef.current) {
      skipInitialProductSearchRef.current = false;
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const availableProducts = await cajaService.getProducts(productSearch.trim() || undefined, selectedWarehouseId || undefined, controller.signal);
        if (!controller.signal.aborted) setProducts(availableProducts);
      } catch (error) {
        if (!controller.signal.aborted) console.error('Error fetching products:', error);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [productSearch, selectedRegisterId, selectedWarehouseId]);

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

  const openAvailabilityFor = async (product: PosProduct, quantity: number) => {
    setAvailabilityProduct(product);
    setAvailabilityQuantity(Math.max(1, quantity));
    setAvailabilityRows([]);
    setAvailabilityOpen(true);
    setAvailabilityLoading(true);
    try {
      setAvailabilityRows(await cajaService.getProductAvailability(product.id, Math.max(1, quantity)));
    } catch (error: unknown) {
      setAvailabilityRows([]);
      toast.error(getErrorMessage(error, 'Error al consultar disponibilidad'));
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const stockBlockedMessage = (product: PosProduct, globalQty: number) => {
    return globalQty > 0
      ? `Stock insuficiente para ${product.name}. Tienes ${globalQty} separadas en otras cajas y solo hay ${product.currentStock} disponibles acá.`
      : `Stock insuficiente para ${product.name}. Solo hay ${product.currentStock} unidades disponibles en esta sucursal.`;
  };

  const handleAddOrCheck = (product: PosProduct) => {
    if (product.itemType === 'SERVICE') {
      addItem(product);
      return;
    }
    if (product.isVariable && product.variants && product.variants.length > 1) {
      setVariantPickerProduct(product);
      setVariantPickerOpen(true);
      return;
    }
    if (product.trackInventory && product.currentStock !== null && product.currentStock !== undefined && product.currentStock <= 0) {
      void openAvailabilityFor(product, 1);
      return;
    }
    addItem(product);
  };

  const handleVariantSelected = (product: PosProduct, variant: PosProductVariant) => {
    const isService = product.itemType === 'SERVICE';
    const warehouseId = isService ? undefined : (selectedWarehouseId || undefined);
    const configuredPrice = isService ? Number(product.salePrice || 0) : getConfiguredPrice(selectedPriceListId, product.id);
    const priceMissing = !isService && (configuredPrice === undefined || configuredPrice === 0);
    const variantDescription = variant.attributes?.length
      ? `${product.name} - ${variant.attributes.map((a) => a.value).join(' / ')}`
      : product.name;
    const globalQty = getGlobalCartQuantity(product.id);
    const existing = cart.find((i) => i.productId === product.id && i.variantId === variant.id && i.warehouseId === warehouseId);
    const requestedQty = (existing?.quantity || 0) + 1;

    if (!isService && hasSalesProductPriceListConflict(cart, product.id, selectedPriceListId, existing ? cart.indexOf(existing) : -1, selectedPriceListId)) {
      toast.error('Este producto ya está agregado con la misma lista de precios.');
      return;
    }

    if (product.trackInventory && !warehouseId) {
      toast.error('Selecciona una bodega de salida antes de agregar el producto.');
      return;
    }

    if (product.trackInventory && variant.currentStock != null && requestedQty + globalQty > variant.currentStock) {
      toast.error(`Stock insuficiente para ${variantDescription}. Disponible: ${variant.currentStock}`);
      return;
    }

    setCart((prev) => {
      const current = prev.find((i) => i.productId === product.id && i.variantId === variant.id && i.warehouseId === warehouseId);
      if (current) {
        return prev.map((i) =>
          i.productId === product.id && i.variantId === variant.id && i.warehouseId === warehouseId
            ? { ...i, quantity: i.quantity + 1, lineTotal: calculateLineTotal(i.quantity + 1, i.unitPrice) }
            : i,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          variantId: variant.id,
          warehouseId,
          description: variantDescription,
          quantity: 1,
          unitPrice: configuredPrice ?? 0,
          priceListId: isService ? undefined : selectedPriceListId,
          priceMissing,
          discount: 0,
          taxRate: NICARAGUA_IVA_RATE,
          lineTotal: calculateLineTotal(1, configuredPrice ?? 0),
        },
      ];
    });
  };

  const addItem = (product: PosProduct) => {
    const isService = product.itemType === 'SERVICE';
    const warehouseId = isService ? undefined : (selectedWarehouseId || undefined);
    if (product.trackInventory && !warehouseId) {
      toast.error('Selecciona una bodega de salida antes de agregar el producto.');
      return;
    }
    const configuredPrice = isService ? Number(product.salePrice || 0) : getConfiguredPrice(selectedPriceListId, product.id);
    const priceMissing = !isService && configuredPrice === undefined;
    if (priceMissing) {
      toast.warning(`El producto "${product.name}" no tiene precio en esta lista. Puedes agregarlo, pero selecciona otra lista antes de emitir.`);
    }
    const existing = cart.find((i) => i.productId === product.id && i.warehouseId === warehouseId);
    const globalQty = getGlobalCartQuantity(product.id);
    const requestedQty = (existing?.quantity || 0) + 1;

    if (!isService && hasSalesProductPriceListConflict(cart, product.id, selectedPriceListId, existing ? cart.indexOf(existing) : -1, selectedPriceListId)) {
      toast.error('Este producto ya está agregado con la misma lista de precios.');
      return;
    }

    if (product.trackInventory && product.currentStock !== null && product.currentStock !== undefined && requestedQty + globalQty > product.currentStock) {
      toast.error(stockBlockedMessage(product, globalQty), {
        action: {
          label: 'Ver otras sucursales',
          onClick: () => void openAvailabilityFor(product, requestedQty),
        },
      });
      return;
    }

    setCart((prev) => {
      const current = prev.find((i) => i.productId === product.id && i.warehouseId === warehouseId);

      if (current) {
        return prev.map((i) =>
          i.productId === product.id && i.warehouseId === warehouseId
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
          warehouseId,
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

  const updateQty = (productId: string, quantity: number, variantId?: string, warehouseId?: string) => {
    const product = productsById.get(productId);
    let finalQty = quantity;
    if (product && product.trackInventory && product.currentStock !== null && product.currentStock !== undefined) {
      const globalQty = getGlobalCartQuantity(productId);
      if (quantity + globalQty > product.currentStock) {
        toast.error(stockBlockedMessage(product, globalQty), {
          action: {
            label: 'Ver otras sucursales',
            onClick: () => void openAvailabilityFor(product, quantity),
          },
        });
        finalQty = Math.max(1, product.currentStock - globalQty);
      }
    }

    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId
          && (variantId ? item.variantId === variantId : !item.variantId)
          && item.warehouseId === warehouseId
          ? { ...item, quantity: finalQty, lineTotal: calculateLineTotal(finalQty, item.unitPrice) }
          : item,
      ),
    );
  };

  const removeItem = (productId: string, variantId?: string, warehouseId?: string) => {
    setCart((prev) => prev.filter((item) => !(
      item.productId === productId
      && (variantId ? item.variantId === variantId : !item.variantId)
      && item.warehouseId === warehouseId
    )));
  };

  const refreshCatalog = useCallback(async () => {
    try {
      setProducts(await cajaService.getProducts(productSearch.trim() || undefined, selectedWarehouseId || undefined));
    } catch {
      // Se conserva el catálogo actual si el refresco falla.
    }
  }, [selectedWarehouseId, productSearch]);

  const handleHoldReservation = async (selection: HoldReservationSelection) => {
    if (holdSubmittingRef.current) return;
    if (!availabilityProduct) return;
    if (!selectedRegisterId) {
      toast.error('Seleccioná una caja');
      return;
    }
    if (!activeSession) {
      toast.error('La caja no tiene una sesión activa');
      return;
    }

    const product = availabilityProduct;
    const isService = product.itemType === 'SERVICE';
    const configuredPrice = isService ? Number(product.salePrice || 0) : getConfiguredPrice(selectedPriceListId, product.id);
    const items: PosHoldItemInput[] = [{
      productId: product.id,
      description: product.name,
      quantity: availabilityQuantity,
      unitPrice: configuredPrice ?? 0,
      priceListId: isService ? undefined : selectedPriceListId,
      taxRate: NICARAGUA_IVA_RATE,
      deliveryWarehouseId: selection.deliveryWarehouseId || undefined,
    }];
    const dto: CreatePosHoldDto = {
      registerId: selectedRegisterId,
      sessionId: activeSession.id,
      customerId: selectedCustomerId,
      date: emitDate,
      discountPercent: pricingMode === 'global' ? discountPercent || undefined : undefined,
      extraCostDescription: legacyExtraCostFields.extraCostDescription,
      extraCostAmount: legacyExtraCostFields.extraCostAmount > 0 ? legacyExtraCostFields.extraCostAmount : undefined,
      extraCharges: normalizedExtraCharges,
      deliveryDescription: deliveryDescription.trim() || undefined,
      deliveryAmount: deliveryAmount > 0 ? deliveryAmount : undefined,
      pricingMode,
      irRate: 0,
      irTaxId: undefined,
      includeTax,
      priceListId: selectedPriceListId || undefined,
      deliveryClientTenantId: selection.deliveryClientTenantId,
      items,
      currency: 'NIO',
      exchangeRate: Number(activeSession.exchangeRateUSD),
      payNow: false,
      notes: selection.notes,
    };

    if (selection.payNow) {
      setHoldCreateDto(dto);
      setAvailabilityOpen(false);
      setPayments([paymentLine('CASH', 0, 'NIO')]);
      setMixedPaymentEnabled(false);
      setPaymentCurrency('NIO');
      setShowPayment(true);
      return;
    }

    holdSubmittingRef.current = true;
    setHoldSubmitting(true);
    try {
      const res = await cajaService.createHold(dto, createIdempotencyKey('hold'));
      const created = (res as any)?.data || res;
      toast.success(`Venta ${created.number} reservada. El cliente deberá retirarla en la sucursal seleccionada.`);
      setAvailabilityOpen(false);
      setAvailabilityProduct(null);
      void refreshCatalog();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Error al reservar la venta'));
    } finally {
      holdSubmittingRef.current = false;
      setHoldSubmitting(false);
    }
  };

  const submitHoldCreatePayment = async () => {
    if (!holdCreateDto || !activeSession || submittingRef.current) return;
    const holdTotal = calculateInvoiceSummary(
      holdCreateDto.items.map((item) => ({
        productId: item.productId || '',
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate || 0,
        discount: item.discount || 0,
        irRate: 0,
        lineTotal: 0,
      })),
      holdCreateDto.discountPercent || 0,
      holdCreateDto.includeTax !== false,
      holdCreateDto.pricingMode,
      getSalesExtraChargesAmount({ extraCharges: holdCreateDto.extraCharges }),
      holdCreateDto.deliveryAmount || 0,
    ).total;
    const holdTotalBase = toBaseAmount(holdTotal, 'NIO', 1);
    const receivedBase = payments.reduce((sum, payment) => sum + toBaseAmount(
      Number(payment.amount || 0),
      payment.currency || 'NIO',
      (payment.currency || 'NIO') === baseCurrency ? 1 : Number(payment.exchangeRate || globalRate || activeSession.exchangeRateUSD || 1),
    ), 0);
    const customerFavorBase = getCustomerFavorBase(holdCreateDto.customerId || selectedCustomerId);
    const customerFavorAppliedBase = payments
      .filter((payment) => payment.method === 'CUSTOMER_BALANCE')
      .reduce((sum, payment) => sum + getPaymentLineBase(payment, 'NIO'), 0);
    if (customerFavorAppliedBase > customerFavorBase + 0.01) {
      toast.error(`El saldo a favor disponible es de ${formatCurrency(customerFavorBase, baseCurrency)}.`);
      return;
    }
    if (customerFavorAppliedBase > 0.01 && !holdCreateDto.customerId && !selectedCustomerId) {
      toast.error('Selecciona un cliente para aplicar su saldo a favor.');
      return;
    }
    if (receivedBase + 0.005 < holdTotalBase) {
      toast.error('El monto recibido debe ser igual o mayor al total');
      return;
    }
    if (!mixedPaymentEnabled && payments.length === 1 && payments[0]?.method !== 'CASH' && receivedBase > holdTotalBase + 0.005) {
      toast.error('El monto solo puede superar el total cuando el método es efectivo.');
      return;
    }
    if (payments.some((payment) => payment.method === 'TRANSFER' && !payment.reference?.trim())) {
      toast.error('La transferencia requiere una referencia');
      return;
    }
    if (payments.some((payment) => ['CARD', 'TRANSFER'].includes(payment.method) && !payment.bankAccountId)) {
      toast.error('Selecciona el banco global para cada pago con tarjeta o transferencia');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    const submitToastId = toast.loading('Cobrando y reservando venta...');
    try {
      const res = await cajaService.createHold(
        { ...holdCreateDto, payments, currency: 'NIO', exchangeRate: Number(activeSession.exchangeRateUSD), payNow: true },
        createIdempotencyKey('hold'),
      );
      const created = (res as any)?.data || res;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sales'] }),
        queryClient.invalidateQueries({ queryKey: ['finance'] }),
        queryClient.invalidateQueries({ queryKey: ['accounting'] }),
      ]);
      toast.success(`Venta ${created.number} cobrada. Factura ${created.invoiceNumber || ''} emitida desde esta caja.`, { id: submitToastId });
      setShowPayment(false);
      setHoldCreateDto(null);
      setMixedPaymentEnabled(false);
      setAvailabilityProduct(null);
      void refreshCatalog();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Error al cobrar la venta'), { id: submitToastId });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
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

  const updateCartItemCharges = (
    productId: string,
    changes: Partial<Pick<CartItem, 'taxRate' | 'discount'>>,
    variantId?: string,
    warehouseId?: string,
  ) => {
    setCart((current) => current.map((item) => item.productId === productId
      && item.variantId === variantId
      && item.warehouseId === warehouseId
      ? { ...item, ...changes, taxRate: Math.min(100, Math.max(0, Number(changes.taxRate ?? item.taxRate) || 0)), discount: Math.min(100, Math.max(0, Number(changes.discount ?? item.discount) || 0)) }
      : item));
  };

  const summary = useMemo(
    () => calculateInvoiceSummary(cart, discountPercent, includeTax, pricingMode, extraCostAmount, deliveryAmount),
    [cart, discountPercent, includeTax, pricingMode, extraCostAmount, deliveryAmount],
  );
  const missingPriceMessage = useMemo(() => getMissingSalesPriceMessage(cart), [cart]);

  const selectedRegister = registers.find((r) => r.id === selectedRegisterId);
  const directWarehouseOptions = useMemo(
    () => warehouseOptions.filter((warehouse) => warehouse.canOperate),
    [warehouseOptions],
  );

  const changeCartItemWarehouse = (item: CartItem, warehouseId: string) => {
    const nextWarehouseId = warehouseId || undefined;
    const product = productsById.get(item.productId);
    if (product?.trackInventory && !nextWarehouseId) {
      toast.error('Selecciona una bodega de salida para este producto.');
      return;
    }
    const nextCart = cart.map((line) => (
      line.productId === item.productId
        && line.variantId === item.variantId
        && line.warehouseId === item.warehouseId
        ? { ...line, warehouseId: nextWarehouseId }
        : line
    ));
    if (hasSalesProductPriceListConflicts(nextCart, selectedPriceListId)) {
      toast.error('No se puede cambiar la bodega: el producto ya usa esa lista de precios en otra línea.');
      return;
    }
    setCart(nextCart);
  };

  const handleCustomerChange = (value: string) => {
    const customerId = value === GENERAL_CUSTOMER_SELECT_VALUE ? undefined : value;
    const customer = customers.find((item) => item.id === customerId);
    const retailList = priceLists.find((list) => String(list.code || '').toUpperCase() === 'RETAIL' || String(list.name || '').toLowerCase().includes('minorista'));
    const nextListId = customer
      ? customer.priceListId || priceLists.find((list) => list.isDefault)?.id || priceLists[0]?.id || ''
      : retailList?.id || priceLists.find((list) => list.isDefault)?.id || priceLists[0]?.id || '';
    const nextCart = cart.map((item) => {
      const isService = productsById.get(item.productId)?.itemType === 'SERVICE';
      const price = isService ? Number(productsById.get(item.productId)?.salePrice || item.unitPrice || 0) : getConfiguredPrice(nextListId, item.productId);
      return price === undefined
        ? { ...item, priceListId: nextListId, unitPrice: 0, lineTotal: 0, priceMissing: true }
        : { ...item, priceListId: isService ? undefined : nextListId, unitPrice: price, lineTotal: calculateLineTotal(item.quantity, price), priceMissing: false };
    });
    if (hasSalesProductPriceListConflicts(nextCart, nextListId)) {
      toast.error('No se puede aplicar esta lista: hay productos repetidos con la misma lista de precios.');
      return;
    }
    setSelectedCustomerId(customerId);
    setSelectedPriceListId(nextListId);
    setCart(nextCart);
  };

  const handlePay = () => {
    if (!canPayPos) return;
    if (cart.length === 0) {
      toast.error('Agregá al menos un producto');
      return;
    }
    if (hasSalesProductPriceListConflicts(cart, selectedPriceListId)) {
      toast.error('No se puede emitir: hay productos repetidos con la misma lista de precios.');
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
    for (const item of cart) {
      const product = productsById.get(item.productId);
      if (product?.itemType === 'SERVICE' && product.isActive === false) {
        toast.error(`El servicio ${product.name || item.description || ''} no está disponible`);
        return;
      }
    }
    setPayments([paymentLine('CASH')]);
    setMixedPaymentEnabled(false);
    setPaymentCurrency(displayCurrency);
    setCreatedInvoice(null);
    setCreatedTicketCart([...cart]);
    setCreatedPaymentLines([]);
    checkoutIdempotencyKey.current = null;
    setHoldCreateDto(null);
    setShowPayment(true);
  };

  const submitPayment = async (confirmedDuplicate = false) => {
    if (holdCreateDto) {
      await submitHoldCreatePayment();
      return;
    }
    if (!canPayPos) return;
    if (submittingRef.current) return;
    if (!activeSession) return;
    if (missingPriceMessage) {
      toast.error(missingPriceMessage);
      return;
    }
    const documentRate = paymentCurrency === baseCurrency ? 1 : Number(globalRate || activeSession.exchangeRateUSD || 1);
    const totalBase = toBaseAmount(summary.total, paymentCurrency, documentRate);
    const receivedBase = payments.reduce((sum, payment) => sum + toBaseAmount(
      Number(payment.amount || 0),
      payment.currency || paymentCurrency,
      (payment.currency || paymentCurrency) === baseCurrency ? 1 : Number(payment.exchangeRate || globalRate || activeSession.exchangeRateUSD || 1),
    ), 0);
    const customerFavorBase = getCustomerFavorBase(selectedCustomerId);
    const customerFavorAppliedBase = payments
      .filter((payment) => payment.method === 'CUSTOMER_BALANCE')
      .reduce((sum, payment) => sum + getPaymentLineBase(payment, paymentCurrency), 0);
    if (customerFavorAppliedBase > customerFavorBase + 0.01) {
      toast.error(`El saldo a favor disponible es de ${formatCurrency(customerFavorBase, baseCurrency)}.`);
      return;
    }
    if (customerFavorAppliedBase > 0.01 && !selectedCustomerId) {
      toast.error('Selecciona un cliente para aplicar su saldo a favor.');
      return;
    }
    if (receivedBase + 0.005 < totalBase) {
      toast.error('El monto recibido debe ser igual o mayor al total');
      return;
    }
    if (!mixedPaymentEnabled && payments.length === 1 && payments[0]?.method !== 'CASH' && receivedBase > totalBase + 0.005) {
      toast.error('El monto solo puede superar el total cuando el método es efectivo.');
      return;
    }
    if (payments.some((payment) => requiresPaymentReference(payment.method) && !payment.reference?.trim())) {
      toast.error('La referencia es obligatoria para transferencia, tarjeta y cheque');
      return;
    }
    if (payments.some((payment) => isBankPaymentMethod(payment.method, true) && !payment.bankAccountId)) {
      toast.error('Selecciona el banco global para cada pago con tarjeta, transferencia o cheque');
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    const submitToastId = toast.loading(confirmedDuplicate ? 'Emitiendo factura...' : 'Verificando y preparando la factura...');
    try {
      const checkoutPayload = {
        registerId: selectedRegisterId,
        sessionId: activeSession.id,
        customerId: selectedCustomerId,
        customCustomerName: selectedCustomerId ? undefined : GENERAL_CUSTOMER_NAME,
        date: emitDate,
        discountPercent: discountPercent || undefined,
        extraCostDescription: legacyExtraCostFields.extraCostDescription,
        extraCostAmount: legacyExtraCostFields.extraCostAmount > 0 ? legacyExtraCostFields.extraCostAmount : undefined,
        extraCharges: normalizedExtraCharges,
        deliveryDescription: deliveryDescription.trim() || undefined,
        deliveryAmount: deliveryAmount > 0 ? deliveryAmount : undefined,
        pricingMode,
        irRate: 0,
        irTaxId: irTaxId || undefined,
        priceListId: selectedPriceListId || undefined,
        items: buildInvoiceItems(cart),
        includeTax,
        currency: paymentCurrency,
        exchangeRate: documentRate,
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
          toast.info('Se requiere confirmar la posible venta duplicada', { id: submitToastId });
          return;
        }
      }

      const idempotencyKey = checkoutIdempotencyKey.current || createIdempotencyKey('checkout');
      checkoutIdempotencyKey.current = idempotencyKey;
      const createdResponse = await cajaService.createInvoice(checkoutPayload, idempotencyKey);
      const created = (createdResponse as any)?.data || createdResponse;

      // Una venta POS crea factura, pago recibido, ingreso financiero y un
      // único asiento contable dentro de la misma transacción. Invalidamos
      // todos los consumidores para que no sigan mostrando una instantánea
      // anterior mientras conservan su staleTime local.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['sales'] }),
        queryClient.invalidateQueries({ queryKey: ['finance'] }),
        queryClient.invalidateQueries({ queryKey: ['accounting'] }),
      ]);

      toast.success('Factura emitida exitosamente', { id: submitToastId });
      setCreatedInvoice(created);
      setCreatedPaymentLines([...payments]);
      setCreatedExchangeRate(Number(activeSession.exchangeRateUSD));
      setCreatedPaymentCurrency(paymentCurrency);
      setCreatedOperationLabel('Factura emitida correctamente');
      setShowPayment(false);
      setMixedPaymentEnabled(false);
      setDuplicateMatches([]);
      checkoutIdempotencyKey.current = null;

      // Limpiar datos en memoria de esta caja
      setCart([]);
      setDiscountPercent(0);
      setExtraCharges([]);
      setDeliveryDescription('');
      setDeliveryAmount(0);
      cartSessions.current.delete(selectedRegisterId);
      setCartSessionRevision((current) => current + 1);

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
        toast.info('Se requiere confirmar la posible venta duplicada', { id: submitToastId });
        return;
      }
      toast.error(getErrorMessage(error, 'Error al emitir factura'), { id: submitToastId });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setExtraCharges([]);
    setDeliveryDescription('');
    setDeliveryAmount(0);
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
          <Button onClick={() => setManageCajasOpen(true)} className="gap-2 rounded-xl font-bold">
            <Settings2 className="size-4" /> Configurar caja
          </Button>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-4">
      {hasOpenCashSession && <Card className="overflow-hidden border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.07] via-card to-primary/[0.04] shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500/15 p-2.5 text-emerald-600"><BellRing className="size-5" /></div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight">Documentos enviados a caja</h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Toma una factura o crédito pendiente y registra el cobro desde esta sesión.</p>
              </div>
              <Badge className="border-none bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">{cashQueue.length}</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(['ADMIN', 'SUPER_ADMIN', 'SUPERADMIN', 'ADMINISTRADOR'].includes(String(user?.role || '').toUpperCase()) || user?.isPlatformAdmin) && <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-bold" onClick={() => void handleReconcileCashQueue()} disabled={reconcilingQueue}>{reconcilingQueue ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />} {reconcilingQueue ? 'Reconciliando…' : 'Reconciliar'}</Button>}
              <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-xs font-bold" onClick={() => void loadCashQueue()} disabled={cashQueueLoading}>
                <RefreshCw className={cn('size-3.5', cashQueueLoading && 'animate-spin')} /> Actualizar
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground" aria-live="polite">
            <span className={cn('inline-flex items-center gap-1.5', cashQueueConnection === 'LIVE' ? 'text-emerald-600 dark:text-emerald-400' : cashQueueConnection === 'ERROR' ? 'text-destructive' : 'text-amber-600 dark:text-amber-400')}>
              <span className={cn('size-1.5 rounded-full', cashQueueConnection === 'LIVE' ? 'bg-emerald-500' : cashQueueConnection === 'ERROR' ? 'bg-destructive' : 'bg-amber-500 animate-pulse')} />
              {cashQueueConnection === 'LIVE' ? 'En vivo' : cashQueueConnection === 'RECONNECTING' ? 'Reconectando' : cashQueueConnection === 'ERROR' ? 'Canal no disponible' : 'Conectando'}
            </span>
            <span>Última sincronización: {cashQueueLastSyncAt ? cashQueueLastSyncAt.toLocaleTimeString('es-NI') : 'Sin sincronización confirmada'}</span>
          </div>
          {cashQueueError && (
            <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <span><AlertCircle className="mr-1.5 inline size-4" />{cashQueueError}{cashQueue.length > 0 ? ' Se conservan los datos de la última sincronización correcta.' : ''}</span>
              <Button type="button" variant="outline" size="sm" className="h-7 border-destructive/30 text-xs text-destructive" onClick={() => void loadCashQueue()} disabled={cashQueueLoading}>Reintentar</Button>
            </div>
          )}
          {cashQueue.length > 0 ? (
            <div className="mt-4 grid gap-2 lg:grid-cols-2">
              {cashQueue.map((queue) => {
                const document = getQueueDocument(queue);
                if (!document) return null;
                const isCreditQueue = Boolean(queue.creditNoteId || queue.creditNote);
                const customer = document.customer?.name || document.customCustomerName || GENERAL_CUSTOMER_NAME;
                const isMine = queue.status === 'CLAIMED' && queue.claimedById === user?.id;
                const canForceRelease = ['ADMIN', 'SUPER_ADMIN', 'SUPERADMIN', 'ADMINISTRADOR'].includes(String(user?.role || '').toUpperCase()) || Boolean(user?.isPlatformAdmin);
                const canRelease = isMine || canForceRelease;
                return (
                  <div key={queue.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-background/80 p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><span className="font-black">{document.number}</span><Badge variant="outline" className="text-[9px]">{isCreditQueue ? 'Crédito' : 'Factura'}</Badge><Badge variant="outline" className="text-[9px]">{queue.status === 'PENDING' ? 'Pendiente' : isMine ? 'Tomada por mí' : `Tomada por ${queue.claimedBy?.name || 'otro cajero'}`}</Badge></div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{customer}</p>
                      <p className="mt-1 font-mono text-sm font-black text-primary">{document.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(Number(document.balance || 0))} <span className="font-sans text-[10px] font-medium text-muted-foreground">pendiente</span></p>
                      {queue.status === 'CLAIMED' && queue.claimExpiresAt && <p className="mt-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">Reserva hasta {new Date(queue.claimExpiresAt).toLocaleTimeString('es-NI')}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {queue.status === 'PENDING' && <Button type="button" size="sm" className="h-9 rounded-lg bg-emerald-600 text-xs font-black text-white hover:bg-emerald-700" onClick={() => void handleClaimCashQueue(queue)} disabled={queueClaimingId !== null}><CheckCircle2 className={cn('mr-1.5 size-4', queueClaimingId === queue.id && 'animate-pulse')} /> {queueClaimingId === queue.id ? 'Tomando…' : `Tomar ${isCreditQueue ? 'crédito' : 'factura'}`}</Button>}
                      {queue.status === 'CLAIMED' && canRelease && <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg border-amber-500/40 text-xs font-black text-amber-700 dark:text-amber-300" onClick={() => void handleReleaseCashQueue(queue)} disabled={queueReleasingId !== null}>{queueReleasingId === queue.id ? 'Liberando…' : 'Liberar'}</Button>}
                      {isMine && <Button type="button" size="sm" className="h-9 rounded-lg bg-primary text-xs font-black" onClick={() => { setQueueInvoice(queue); setQueuePayments([paymentLine('CASH', Number(document.balance || 0), document.currency)]); setQueueMixedPaymentEnabled(false); }}>Cobrar ahora</Button>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : cashQueueError ? null : (
            <p className="mt-4 rounded-xl border border-dashed border-border/60 px-3 py-3 text-xs text-muted-foreground">No hay facturas pendientes enviadas a caja.</p>
          )}
        </CardContent>
      </Card>}

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
                <SalesAccountingLegend flow="pos" paymentMethod={payments[0]?.method} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  <div className="space-y-1.5" data-tour="pos-warehouse">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bodega de salida</Label>
                    <div className="relative">
                      <Store className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-primary" />
                      <Select
                        value={selectedWarehouseId}
                        onValueChange={(value) => setSelectedWarehouseId(value)}
                        disabled={isRegisterDisabled || directWarehouseOptions.length === 0}
                      >
                        <SelectTrigger className="!h-11 rounded-xl border-primary/20 bg-primary/[0.04] pl-10 pr-3 shadow-sm">
                          <SelectValue placeholder={directWarehouseOptions.length > 0 ? 'Seleccionar bodega' : 'Sin bodegas operativas'} />
                        </SelectTrigger>
                        <SelectContent>
                          {directWarehouseOptions.map((warehouse) => (
                            <SelectItem key={warehouse.id} value={warehouse.id}>
                              <span className="truncate font-semibold">{warehouse.name}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
                <div className="mb-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight">Catálogo de venta</h3>
                    <p className="mt-1 text-[11px] text-muted-foreground">{filteredProducts.length} {catalogItemFilter === 'SERVICE' ? 'servicios' : catalogItemFilter === 'PRODUCT' ? 'productos' : 'artículos'} disponibles</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      title="Muestra en cada producto un botón para consultar su disponibilidad en otras sucursales"
                      className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-2.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground select-none"
                    >
                      <input
                        type="checkbox"
                        checked={showAvailabilityAction}
                        onChange={(event) => setShowAvailabilityAction(event.target.checked)}
                        className="size-3.5 accent-primary"
                      />
                      Disponibilidad
                    </label>
                    <div className="inline-flex h-8 items-center rounded-xl border border-border/60 bg-muted/30 p-1" role="group" aria-label="Vista del catálogo">
                      <button
                        type="button"
                        aria-pressed={catalogView === 'list'}
                        onClick={() => setCatalogView('list')}
                        className={`flex h-6 items-center gap-1 rounded-lg px-2.5 text-[10px] font-black uppercase tracking-wider transition-all ${catalogView === 'list' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                          }`}
                      >
                        <List className="size-3" /> Lista
                      </button>
                      <button
                        type="button"
                        aria-pressed={catalogView === 'catalog'}
                        onClick={() => setCatalogView('catalog')}
                        className={`flex h-6 items-center gap-1 rounded-lg px-2.5 text-[10px] font-black uppercase tracking-wider transition-all ${catalogView === 'catalog' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                          }`}
                      >
                        <LayoutGrid className="size-3" /> Catálogo
                      </button>
                    </div>
                    <div className="relative min-w-0 flex-1 sm:flex-none sm:w-72">
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
                        className="pl-9 h-8 rounded-lg text-xs focus-visible:ring-primary focus-visible:border-primary"
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
                  <div className="overflow-x-auto rounded-xl border border-border/50">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full min-w-[520px] table-fixed text-xs md:min-w-0">
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
                                  {prod.itemType === 'SERVICE' ? (
                                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${prod.isActive !== false ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5" : "text-rose-500 border-rose-500/30 bg-rose-500/5"}`}>
                                      {prod.isActive !== false ? 'Disponible' : 'No disp.'}
                                    </Badge>
                                  ) : (
                                    prod.trackInventory && (
                                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${prod.currentStock && prod.currentStock > 0 ? "text-emerald-500 border-emerald-500/30" : "text-rose-500 border-rose-500/30"}`}>
                                        {prod.currentStock ?? 0} unid.
                                      </Badge>
                                    )
                                  )}
                                </div>
                                {prod.itemType !== 'SERVICE' && prod.trackInventory && (
                                  <SalesWarehouseStockHint
                                    product={prod}
                                    warehouses={directWarehouseOptions}
                                    warehouseId={selectedWarehouseId}
                                    className="mt-1 px-0"
                                  />
                                )}
                                {prod.description && <p className="max-w-[320px] truncate text-[10px] text-muted-foreground">{prod.description}</p>}
                              </td>
                              <td className="px-2 sm:px-3 py-2.5 text-right font-mono whitespace-nowrap">
                                {getCatalogPrice(prod) === undefined ? <span className="text-[10px] font-black uppercase text-rose-500">Sin precio</span> : formatCurrency(getCatalogPrice(prod) ?? 0)}
                              </td>
                              <td data-actions-column="compact" className="px-2 sm:px-3 py-2.5 text-center">
                                <div className="flex flex-wrap items-center justify-center gap-1">
                                  {showAvailabilityAction && prod.itemType !== 'SERVICE' && prod.trackInventory && (
                                    <Button size="sm" variant="outline"
                                      onClick={() => void openAvailabilityFor(prod, cart.find((item) => item.productId === prod.id)?.quantity || 1)}
                                      disabled={isRegisterDisabled}
                                      title={`Consultar disponibilidad de ${prod.name} en otras sucursales`}
                                      className="h-7 whitespace-nowrap rounded-lg px-1.5 sm:px-2 text-[10px] font-bold text-primary hover:bg-primary/10 disabled:opacity-50">
                                      <Store className="mr-1 size-3" /> Disponibilidad
                                    </Button>
                                  )}
                                  <Button size="sm" variant="ghost" onClick={() => handleAddOrCheck(prod)}
                                    disabled={isRegisterDisabled || (prod.itemType === 'SERVICE' ? prod.isActive === false : false)}
                                    className="h-7 max-w-full whitespace-nowrap rounded-lg px-1.5 sm:px-2 text-[10px] font-bold text-primary hover:bg-primary/10 disabled:opacity-50">
                                    <Plus className="mr-1 size-3" /> {prod.itemType === 'SERVICE' ? (prod.isActive === false ? 'No Disp.' : 'Agregar') : (prod.trackInventory && (!prod.currentStock || prod.currentStock <= 0) ? 'Ver otras sucursales' : 'Agregar')}
                                  </Button>
                                </div>
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
                                    {prod.itemType === 'SERVICE' ? (
                                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-mono ${prod.isActive !== false ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5" : "text-rose-500 border-rose-500/30 bg-rose-500/5"}`}>
                                        {prod.isActive !== false ? 'Disponible' : 'No disponible'}
                                      </Badge>
                                    ) : (
                                      prod.trackInventory && (
                                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-mono ${prod.currentStock && prod.currentStock > 0 ? "text-emerald-500 border-emerald-500/30" : "text-rose-500 border-rose-500/30"}`}>
                                          {prod.currentStock ?? 0} unid.
                                        </Badge>
                                      )
                                    )}
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1">
                                    {showAvailabilityAction && prod.itemType !== 'SERVICE' && prod.trackInventory && (
                                      <Button size="icon" variant="ghost"
                                        onClick={() => void openAvailabilityFor(prod, cart.find((item) => item.productId === prod.id)?.quantity || 1)}
                                        disabled={isRegisterDisabled}
                                        title={`Consultar disponibilidad de ${prod.name} en otras sucursales`}
                                        className="size-6 rounded-lg text-primary hover:bg-primary/10 disabled:opacity-50">
                                        <Store className="size-3.5" />
                                      </Button>
                                    )}
                                    <span className="font-mono text-sm font-black text-primary">{getCatalogPrice(prod) === undefined ? 'Sin precio' : formatCurrency(getCatalogPrice(prod) ?? 0)}</span>
                                  </div>
                                </div>
                                <h4 className="truncate text-sm font-black">{prod.name}</h4>
                                <p className="mt-1 line-clamp-2 min-h-8 text-[11px] leading-4 text-muted-foreground">
                                  {prod.description || (prod.itemType === 'SERVICE' ? 'Servicio disponible para facturación inmediata.' : 'Producto disponible para facturación inmediata.')}
                                </p>
                                {prod.itemType !== 'SERVICE' && prod.trackInventory && (
                                  <SalesWarehouseStockHint
                                    product={prod}
                                    warehouses={directWarehouseOptions}
                                    warehouseId={selectedWarehouseId}
                                    className="mt-1 px-0"
                                  />
                                )}
                              </div>
                              <Button
                                onClick={() => handleAddOrCheck(prod)}
                                disabled={isRegisterDisabled || (prod.itemType === 'SERVICE' ? prod.isActive === false : false)}
                                className="h-9 w-full rounded-xl text-[10px] font-black uppercase tracking-wider"
                              >
                                <ShoppingCart className="mr-2 size-3.5" />
                                {prod.itemType === 'SERVICE' ? (prod.isActive === false ? 'No Disponible' : 'Agregar a factura') : (prod.trackInventory && (!prod.currentStock || prod.currentStock <= 0) ? 'Ver otras sucursales' : 'Agregar a factura')}
                              </Button>
                              {showAvailabilityAction && prod.itemType !== 'SERVICE' && prod.trackInventory && (
                                <Button
                                  variant="outline"
                                  onClick={() => void openAvailabilityFor(prod, cart.find((item) => item.productId === prod.id)?.quantity || 1)}
                                  disabled={isRegisterDisabled}
                                  className="h-8 w-full rounded-xl text-[10px] font-black uppercase tracking-wider"
                                >
                                  <Store className="mr-2 size-3" /> Disponibilidad
                                </Button>
                              )}
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
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-black uppercase tracking-tight">
                    Detalle Factura{' '}
                    {selectedRegister && (
                      <span className="text-primary">({selectedRegister.code} - {selectedRegister.name})</span>
                    )}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isRegisterDisabled}
                      onClick={() => setExtraCharges((current) => [...current, { id: `extra-${Date.now()}`, description: '', amount: 0 }])}
                      className="h-8 rounded-xl border-primary/25 px-2.5 text-[10px] font-black uppercase tracking-wider text-primary hover:bg-primary/10"
                    >
                      <Plus className="mr-1.5 size-3" /> Agregar coste extra
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isRegisterDisabled || Boolean(deliveryDescription) || deliveryAmount > 0}
                      title={deliveryDescription || deliveryAmount > 0 ? 'Solo se permite un delivery por factura' : undefined}
                      onClick={() => { setDeliveryDescription('Delivery'); setDeliveryAmount(0); }}
                      className="h-8 rounded-xl border-emerald-500/25 px-2.5 text-[10px] font-black uppercase tracking-wider text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                    >
                      <Plus className="mr-1.5 size-3" /> Agregar delivery
                    </Button>
                  </div>
                </div>
                {cart.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    No hay ítems agregados en esta caja{selectedRegister ? ` (${selectedRegister.code} - ${selectedRegister.name})` : ''}.
                  </p>
                ) : (
                  <div className="border border-border/50 rounded-xl overflow-x-auto">
                    <table className="w-full min-w-[920px] text-xs xl:min-w-0">
                      <thead>
                        <tr className="bg-muted/30 border-b border-border/30">
                          <th className="px-3 py-2.5 text-left font-black uppercase tracking-widest text-[10px] text-muted-foreground">Descripción</th>
                          <th className="px-3 py-2.5 text-left font-black uppercase tracking-widest text-[10px] text-muted-foreground">Bodega de salida</th>
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
                          <tr key={`${item.productId}-${item.variantId || 'base'}-${item.warehouseId || 'service'}`} className="hover:bg-muted/20 transition-colors">
                            <td className="px-3 py-2 font-bold">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <span className="min-w-0 flex-1">{item.description}</span>
                                <SalesLinePriceListSelect productId={item.productId} productCode={productsById.get(item.productId)?.code} itemType={productsById.get(item.productId)?.itemType} value={item.priceListId} defaultPriceListId={selectedPriceListId} lineItems={cart} lineIndex={cart.indexOf(item)} currency={paymentCurrency} exchangeRate={Number(activeSession?.exchangeRateUSD || 1)} disabled={isRegisterDisabled} onChange={(priceListId, result) => { setCart((current) => current.map((line) => line.productId === item.productId && line.variantId === item.variantId && line.warehouseId === item.warehouseId ? { ...line, priceListId, unitPrice: result.unitPrice || 0, priceMissing: result.priceMissing, lineTotal: calculateLineTotal(line.quantity, result.unitPrice || 0) } : line)); }} />
                                {item.priceMissing && <PriceMissingBadge className="basis-full" />}
                              </div>
                              {productsById.get(item.productId)?.itemType !== 'SERVICE' && (
                                <SalesWarehouseStockHint
                                  product={productsById.get(item.productId)}
                                  warehouses={directWarehouseOptions}
                                  warehouseId={item.warehouseId}
                                  variantId={item.variantId}
                                  className="mt-1 px-0"
                                />
                              )}
                            </td>
                            <td className="px-3 py-2 align-top">
                              {productsById.get(item.productId)?.itemType === 'SERVICE' ? (
                                <span className="text-[10px] text-muted-foreground">No aplica</span>
                              ) : (
                                <Select
                                  value={item.warehouseId || ''}
                                  onValueChange={(value) => changeCartItemWarehouse(item, value)}
                                  disabled={isRegisterDisabled || directWarehouseOptions.length === 0}
                                >
                                  <SelectTrigger className="h-8 min-w-[190px] rounded-lg text-[10px]">
                                    <SelectValue placeholder="Seleccionar bodega" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {directWarehouseOptions.map((warehouse) => (
                                      <SelectItem key={warehouse.id} value={warehouse.id}>{warehouse.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {pricingMode === 'individual' ? (
                                <label className="inline-flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                                  <input
                                    type="checkbox"
                                    checked={Number(item.taxRate || 0) > 0}
                                    onChange={(event) => updateCartItemCharges(item.productId, { taxRate: event.target.checked ? NICARAGUA_IVA_RATE : 0 }, item.variantId, item.warehouseId)}
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
                                  onChange={(event) => updateCartItemCharges(item.productId, { discount: Number(event.target.value) || 0 }, item.variantId, item.warehouseId)}
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
                                      item.variantId,
                                      item.warehouseId,
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
                              <Button variant="ghost" onClick={() => removeItem(item.productId, item.variantId, item.warehouseId)}
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
                {(extraCharges.length > 0 || Boolean(deliveryDescription) || deliveryAmount > 0) && (
                  <div className="mt-5 space-y-2 rounded-xl border border-border/50 bg-muted/10 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cargos adicionales</p>
                        <p className="text-[9px] text-muted-foreground/70">Se agregan como líneas al detalle y al asiento contable.</p>
                      </div>
                      <span className="text-[10px] font-black text-muted-foreground">{paymentCurrency === 'USD' ? 'Dólares (US$)' : 'Córdobas (C$)'}</span>
                    </div>
                    {extraCharges.map((charge, index) => (
                      <div key={charge.id} className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-border/40 bg-background/60 p-2">
                        <span className="w-full text-[9px] font-black uppercase tracking-widest text-muted-foreground sm:w-auto">Coste extra {index + 1}</span>
                        <Input
                          value={charge.description}
                          onChange={(event) => setExtraCharges((current) => current.map((item) => item.id === charge.id ? { ...item, description: event.target.value } : item))}
                          placeholder="Descripción"
                          className="h-8 min-w-0 flex-1 text-xs"
                          disabled={isRegisterDisabled}
                        />
                        <div className="flex min-w-[8.5rem] items-center gap-1 rounded-md border border-input bg-background px-2">
                          <span className="text-[10px] font-black text-muted-foreground">{paymentCurrency === 'USD' ? '$' : 'C$'}</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={charge.amount || ''}
                            onChange={(event) => setExtraCharges((current) => current.map((item) => item.id === charge.id ? { ...item, amount: Math.max(0, Number(event.target.value) || 0) } : item))}
                            placeholder="Monto"
                            className="h-8 border-0 px-0 text-right text-xs shadow-none focus-visible:ring-0"
                            disabled={isRegisterDisabled}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Eliminar coste extra ${index + 1}`}
                          className="size-7 shrink-0 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
                          onClick={() => setExtraCharges((current) => current.filter((item) => item.id !== charge.id))}
                          disabled={isRegisterDisabled}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                    {(Boolean(deliveryDescription) || deliveryAmount > 0) && (
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-background/60 p-2">
                        <span className="w-full text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 sm:w-auto">Delivery</span>
                        <Input
                          value={deliveryDescription}
                          onChange={(event) => setDeliveryDescription(event.target.value)}
                          placeholder="Descripción"
                          className="h-8 min-w-0 flex-1 text-xs"
                          disabled={isRegisterDisabled}
                        />
                        <div className="flex min-w-[8.5rem] items-center gap-1 rounded-md border border-input bg-background px-2">
                          <span className="text-[10px] font-black text-muted-foreground">{paymentCurrency === 'USD' ? '$' : 'C$'}</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={deliveryAmount || ''}
                            onChange={(event) => setDeliveryAmount(Math.max(0, Number(event.target.value) || 0))}
                            placeholder="Monto"
                            className="h-8 border-0 px-0 text-right text-xs shadow-none focus-visible:ring-0"
                            disabled={isRegisterDisabled}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Eliminar delivery"
                          className="size-7 shrink-0 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
                          onClick={() => { setDeliveryDescription(''); setDeliveryAmount(0); }}
                          disabled={isRegisterDisabled}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5 sticky top-24">
            <Card className="border-border/50 shadow-sm" data-tour="pos-summary">
              <CardContent className="p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-tight">
                    <Calculator className="size-4 text-primary" /> Resumen Financiero
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowTutorial(true)}
                    className="h-9 shrink-0 rounded-xl border-primary/30 bg-background/80 px-3 text-[10px] font-black text-primary shadow-sm hover:bg-primary/10"
                    aria-label="Abrir guía Cómo facturar"
                  >
                    <CircleHelp className="mr-1.5 size-3.5" /> Cómo facturar
                  </Button>
                </div>
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
                  {normalizedExtraCharges.filter((charge) => charge.amount > 0).map((charge, index) => <div key={`${charge.description}-${index}`} className="flex justify-between gap-3 text-xs"><span className="min-w-0 truncate text-muted-foreground">{charge.description || `Coste extra ${index + 1}`}:</span><span className="shrink-0 font-mono">{formatCurrency(charge.amount)}</span></div>)}
                  {summary.delivery > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">{deliveryDescription.trim() || 'Delivery'}:</span><span className="font-mono">{formatCurrency(summary.delivery)}</span></div>}
                </div>
                <div className="pt-3 border-t border-border/30">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-black">Total a Pagar:</span>
                    <span className="text-xl font-black text-primary">{formatCurrency(summary.total)}</span>
                  </div>
                </div>
                {canPayPos && <Button
                  size="lg"
                  data-tour="pos-pay"
                  onClick={handlePay}
                  disabled={submitting || cart.length === 0 || isRegisterDisabled || Boolean(missingPriceMessage)}
                  className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-widest gap-2 shadow-lg shadow-primary/20"
                >
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                  Pagar y Emitir Factura
                </Button>}
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
                              <Badge className={cn('border-none text-[9px]', getSalesInvoiceStatusColor(inv.status))}>{statusLabel}</Badge>
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
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">{createdOperationLabel}</p>
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
                      <span>{payment.method === 'CASH' ? 'Efectivo' : payment.method === 'CARD' ? 'Tarjeta' : payment.method === 'CHECK' ? 'Cheque' : payment.method === 'CUSTOMER_BALANCE' ? 'Saldo a favor' : 'Transferencia'}</span>
                      <span className="font-mono font-bold">{(payment.currency || paymentCurrency) === 'USD' ? '$' : 'C$'} {formatSalesAmount(payment.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">Total factura</p>
                <p className="mt-2 text-2xl font-black text-primary">{formatCurrency(Number(createdInvoice.total))}</p>
                {Number(createdInvoice.discountAmount) > 0 && <p className="mt-1 text-[11px] text-rose-600">Descuento: - {formatCurrency(Number(createdInvoice.discountAmount))}</p>}
                <p className="mt-1 text-[11px] text-muted-foreground">IVA: {formatCurrency(Number(createdInvoice.taxAmount))}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Recibido (base): C$ {formatSalesAmount(createdPaymentLines.reduce((sum, payment) => sum + Number(payment.amount || 0) * ((payment.currency || createdPaymentCurrency) === 'USD' ? createdExchangeRate : 1), 0))}</p>
                <p className="text-[11px] font-bold text-emerald-600">Cambio: C$ {formatSalesAmount(Math.max(0, createdPaymentLines.reduce((sum, payment) => sum + Number(payment.amount || 0) * ((payment.currency || createdPaymentCurrency) === 'USD' ? createdExchangeRate : 1), 0) - Number(createdInvoice.total) * (createdPaymentCurrency === 'USD' ? createdExchangeRate : 1)))}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setCreatedInvoice(null)} className="rounded-xl font-black">Cerrar</Button>
              {canPrintPos && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => void printPosTicket(createdInvoice, createdTicketCart, createdPaymentLines, createdPaymentCurrency, createdExchangeRate, companyName, companyLogo, 'ticket')} className="gap-2 rounded-xl font-black">
                    <Receipt className="size-4" /> Imprimir voucher
                  </Button>
                  <Button onClick={() => void printPosTicket(createdInvoice, createdTicketCart, createdPaymentLines, createdPaymentCurrency, createdExchangeRate, companyName, companyLogo, 'letter')} className="gap-2 rounded-xl font-black">
                    <Receipt className="size-4" /> Imprimir
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {showPayment && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl border bg-background p-5 shadow-2xl sm:p-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-black">Checkout / Pago</h2>
                {holdCreateDto && <p className="text-xs font-bold text-primary">Reserva con cobro inmediato</p>}
              </div>
               <Button variant="ghost" onClick={() => { setShowPayment(false); setHoldCreateDto(null); setMixedPaymentEnabled(false); }}>✕</Button>
            </div>

            {(() => {
              const holdTotal = holdCreateDto
                ? calculateInvoiceSummary(
                  holdCreateDto.items.map((item) => ({
                    productId: item.productId || '',
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    taxRate: item.taxRate || 0,
                    discount: item.discount || 0,
                    irRate: 0,
                    lineTotal: 0,
                  })),
                  holdCreateDto.discountPercent || 0,
                  holdCreateDto.includeTax !== false,
                  holdCreateDto.pricingMode,
                  getSalesExtraChargesAmount({ extraCharges: holdCreateDto.extraCharges }),
                  holdCreateDto.deliveryAmount || 0,
                ).total
                : null;
              const documentRate = paymentCurrency === baseCurrency ? 1 : Number(globalRate || activeSession.exchangeRateUSD || 1);
              const totalToPayBase = holdTotal !== null
                ? toBaseAmount(holdTotal, 'NIO', 1)
                : toBaseAmount(summary.total, paymentCurrency, documentRate);
              const totalPaidBase = payments.reduce((sum, item) => sum + toBaseAmount(
                Number(item.amount || 0),
                item.currency || paymentCurrency,
                (item.currency || paymentCurrency) === baseCurrency ? 1 : Number(item.exchangeRate || globalRate || activeSession.exchangeRateUSD || 1),
              ), 0);
              const changeLocal = !mixedPaymentEnabled && payments.length === 1 && payments[0]?.method !== 'CASH'
                ? 0
                : Math.max(0, totalPaidBase - totalToPayBase);

              return (
                <>
                  <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-xl bg-primary/10 p-3">
                      <span className="text-xs text-primary font-bold">Total a pagar</span>
                      <div className="text-xl font-black text-primary">{baseCurrency === 'USD' ? '$' : 'C$'} {formatSalesAmount(totalToPayBase)}</div>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3 border border-border/50">
                      <span className="text-xs text-muted-foreground">Pagado</span>
                      <div className="text-xl font-black">{baseCurrency === 'USD' ? '$' : 'C$'} {formatSalesAmount(totalPaidBase)}</div>
                    </div>
                    <div className={cn("rounded-xl p-3 border", changeLocal > 0 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-muted/20 border-border/30 text-muted-foreground")}>
                      <span className="text-xs font-bold">Cambio</span>
                      <div className="text-xl font-black">{baseCurrency === 'USD' ? '$' : 'C$'} {formatSalesAmount(changeLocal)}</div>
                    </div>
                  </div>

                   <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                     <div>
                       <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Forma de pago</p>
                       <p className="mt-1 text-[10px] text-muted-foreground">Activa pago mixto para combinar varios medios.</p>
                     </div>
                     <label className="flex cursor-pointer items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                       <Switch
                         checked={mixedPaymentEnabled}
                         onCheckedChange={(checked) => {
                           setMixedPaymentEnabled(checked);
                           if (!checked) setPayments((current) => current.slice(0, 1));
                         }}
                         disabled={submitting}
                         aria-label="Activar pago mixto"
                       />
                       Pago mixto
                     </label>
                   </div>

                   <div className="space-y-3">
                    {payments.map((payment, index) => (
                      <div key={`${payment.method}-${index}`} className="rounded-xl border p-3">
                        <div className="grid grid-cols-[minmax(0,1fr)_minmax(8rem,10rem)_minmax(7rem,10rem)_auto] gap-2">
                           <Select value={payment.method} onValueChange={(value: PosPaymentLine['method']) => handlePaymentMethodChange(index, value)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CASH">Efectivo</SelectItem>
                              <SelectItem value="CARD">Tarjeta</SelectItem>
                              <SelectItem value="TRANSFER">Transferencia</SelectItem>
                              <SelectItem value="CHECK">Cheque</SelectItem>
                              {selectedPaymentCustomerFavorBase > 0.01 && <SelectItem value="CUSTOMER_BALANCE">Saldo a favor</SelectItem>}
                            </SelectContent>
                          </Select>
                          <CurrencySelector value={payment.currency || paymentCurrency} baseCurrency={baseCurrency} exchangeRate={globalRate} label="Moneda" hideLabel rateDecimals={2} disabled={payment.method === 'CUSTOMER_BALANCE' || submitting} onChange={(nextCurrency) => setPayments(current => current.map((item, itemIndex) => {
                            if (itemIndex !== index) return item;
                            const previousCurrency = item.currency || paymentCurrency;
                            const previousRate = previousCurrency === baseCurrency ? 1 : Number(item.exchangeRate || globalRate || activeSession.exchangeRateUSD || 1);
                            const nextRate = paymentLineRate(nextCurrency);
                            return { ...item, amount: Number(convertBetweenCurrencies(Number(item.amount || 0), previousCurrency, nextCurrency, previousRate, nextRate).toFixed(2)), currency: nextCurrency, exchangeRate: nextRate };
                          }))} />
                          <Input type="number" min="0" step="0.01" placeholder={`Monto (${payment.currency || paymentCurrency})`} value={payment.amount || ''} onChange={(event) => setPayments(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: Number(event.target.value) || 0, cardCommissionAmount: isCardPaymentMethod(item.method) ? calculateCardCommission(Number(event.target.value) || 0, Number(item.cardCommissionPercent || 0)) : item.cardCommissionAmount } : item))} />
                          <Button variant="ghost" disabled={payments.length === 1} onClick={() => setPayments(current => current.filter((_, itemIndex) => itemIndex !== index))}>✕</Button>
                        </div>
                        {payment.method === 'CUSTOMER_BALANCE' && <p className="mt-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Disponible a favor: {formatCurrency(selectedPaymentCustomerFavorBase, baseCurrency)}. Puedes aplicar solo una parte.</p>}
                        {payment.method === 'CARD' && <Input className="mt-2" placeholder="Voucher / referencia *" value={payment.reference || ''} onChange={(event) => setPayments(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, reference: event.target.value } : item))} />}
                        {payment.method === 'TRANSFER' && (
                          <Input className="mt-2" placeholder="ID de referencia *" value={payment.reference || ''} onChange={(event) => setPayments(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, reference: event.target.value } : item))} />
                        )}
                        {payment.method === 'CHECK' && <Input className="mt-2" placeholder="Número de cheque *" value={payment.reference || ''} onChange={(event) => setPayments(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, reference: event.target.value } : item))} />}
                        {isBankPaymentMethod(payment.method, true) && <BankAccountSelect className="mt-2" value={payment.bankAccountId} onChange={(bankAccountId) => setPayments(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, bankAccountId } : item))} onAccountSelect={(account) => setPayments(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, cardCommissionPercent: account?.cardCommissionPercent || 0, cardCommissionAmount: isCardPaymentMethod(item.method) ? calculateCardCommission(Number(item.amount || 0), account?.cardCommissionPercent || 0) : 0, cardCommissionAccountId: account?.cardCommissionAccountId || undefined } : item))} label="Banco global de destino" />}
                        {isCardPaymentMethod(payment.method) && payment.bankAccountId && Number(payment.cardCommissionPercent || 0) > 0 && (
                          <div className="mt-2 flex items-center gap-3 rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-[10px]">
                            <span className="font-black uppercase tracking-widest text-purple-600">Comisión:</span>
                            <span className="font-mono font-bold">{formatCommissionPercent(payment.cardCommissionPercent)}</span>
                            <span className="text-muted-foreground">|</span>
                            <span className="font-black uppercase tracking-widest text-muted-foreground">Monto:</span>
                            <span className="font-mono font-bold text-purple-600">{payment.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(Number(payment.cardCommissionAmount || calculateCardCommission(Number(payment.amount || 0), Number(payment.cardCommissionPercent || 0))))}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {mixedPaymentEnabled && <Button variant="outline" className="mt-3 w-full" onClick={() => setPayments(current => [...current, paymentLine('CARD')])}>+ Agregar pago mixto</Button>}
                </>
              );
            })()}
            <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => { setShowPayment(false); setHoldCreateDto(null); setMixedPaymentEnabled(false); }}>Cancelar</Button><Button onClick={() => void submitPayment()} disabled={submitting || selectedPaymentCustomerFavorExceeded || payments.some((payment) => requiresPaymentReference(payment.method) && !payment.reference?.trim()) || payments.some((payment) => isBankPaymentMethod(payment.method, true) && !payment.bankAccountId)}>{submitting ? <Loader2 className="size-4 animate-spin" /> : holdCreateDto ? 'Cobrar venta' : 'Confirmar y emitir'}</Button></div>

          </div>
        </div>
      )}
      {queueInvoice && (() => {
        const document = getQueueDocument(queueInvoice);
        if (!document) return null;
        const isCreditQueue = Boolean(queueInvoice.creditNoteId || queueInvoice.creditNote);
        const handleQueuePaymentMethodChange = (index: number, nextMethod: PosPaymentLine['method']) => {
          setQueuePayments((current) => current.map((item, itemIndex) => {
            if (itemIndex !== index) return item;
            const nextLine = {
              ...item,
              method: nextMethod,
              reference: requiresPaymentReference(nextMethod) ? item.reference : undefined,
              bankAccountId: isBankPaymentMethod(nextMethod, true) ? item.bankAccountId : undefined,
            };
            if (nextMethod !== 'CUSTOMER_BALANCE') return nextLine;
            const currentLineBase = getPaymentLineBase(item, document.currency);
            const otherPaymentsBase = current.reduce((sum, payment) => sum + getPaymentLineBase(payment, document.currency), 0) - currentLineBase;
            const documentRate = document.currency === baseCurrency
              ? 1
              : Number(document.exchangeRate || activeSession?.exchangeRateUSD || globalRate || 1);
            const maximumBase = getMaximumCustomerFavorToApply(
              getCustomerFavorBase(document.customerId),
              toBaseAmount(Number(document.balance || 0), document.currency, documentRate),
              otherPaymentsBase,
            );
            return { ...nextLine, amount: maximumBase, currency: baseCurrency, exchangeRate: 1 };
          }));
        };
        return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="queue-payment-title">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-3xl border border-border/60 bg-card p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Cobro desde cola de caja</p><h2 id="queue-payment-title" className="mt-1 text-xl font-black uppercase tracking-tight">{isCreditQueue ? 'Crédito' : 'Factura'} {document.number}</h2><p className="mt-1 text-sm text-muted-foreground">{document.customer?.name || document.customCustomerName || GENERAL_CUSTOMER_NAME}</p></div>
               <Button type="button" variant="ghost" size="icon" className="rounded-xl" onClick={() => { if (!queueSubmitting) { setQueueInvoice(null); setQueuePayments([]); setQueueMixedPaymentEnabled(false); } }} aria-label="Cerrar cobro">×</Button>
            </div>
            <div className="mt-5 rounded-2xl bg-primary/10 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Saldo pendiente</p><p className="mt-1 font-mono text-2xl font-black text-primary">{document.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(Number(document.balance || 0))}</p>{isCreditQueue && <p className="mt-1 text-xs font-semibold text-muted-foreground">Puedes registrar un abono o cancelar todo el saldo.</p>}</div>
             <div className="mt-5 space-y-3">
               <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                 <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Forma de pago</p>
                   <p className="mt-1 text-[10px] text-muted-foreground">Activa pago mixto para combinar varios medios.</p>
                 </div>
                 <label className="flex cursor-pointer items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                   <Switch
                     checked={queueMixedPaymentEnabled}
                     onCheckedChange={(checked) => {
                       setQueueMixedPaymentEnabled(checked);
                       if (!checked) setQueuePayments((current) => current.slice(0, 1));
                     }}
                     disabled={queueSubmitting}
                     aria-label="Activar pago mixto"
                   />
                   Pago mixto
                 </label>
               </div>
               {queuePayments.map((payment, index) => (
                <div key={`${payment.method}-${index}`} className="rounded-xl border border-border/50 bg-muted/10 p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_9rem_9rem_auto]">
                    <Select value={payment.method} onValueChange={(value: PosPaymentLine['method']) => handleQueuePaymentMethodChange(index, value)}>
                      <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CASH">Efectivo</SelectItem><SelectItem value="CARD">Tarjeta</SelectItem><SelectItem value="TRANSFER">Transferencia</SelectItem><SelectItem value="CHECK">Cheque</SelectItem>{getCustomerFavorBase(document.customerId) > 0.01 && <SelectItem value="CUSTOMER_BALANCE">Saldo a favor</SelectItem>}</SelectContent>
                    </Select>
                    <CurrencySelector value={payment.currency || document.currency} baseCurrency={baseCurrency} exchangeRate={globalRate} label="Moneda" hideLabel rateDecimals={2} disabled={payment.method === 'CUSTOMER_BALANCE' || queueSubmitting} onChange={(nextCurrency) => setQueuePayments((current) => current.map((item, itemIndex) => { if (itemIndex !== index) return item; const previousCurrency = item.currency || document.currency; const previousRate = previousCurrency === baseCurrency ? 1 : Number(item.exchangeRate || activeSession?.exchangeRateUSD || globalRate || 1); const nextRate = nextCurrency === baseCurrency ? 1 : Number(activeSession?.exchangeRateUSD || globalRate || 1); return { ...item, amount: Number(convertBetweenCurrencies(Number(item.amount || 0), previousCurrency, nextCurrency, previousRate, nextRate).toFixed(2)), currency: nextCurrency, exchangeRate: nextRate }; }))} />
                  <Input type="number" min="0" step="0.01" value={payment.amount || ''} onChange={(event) => setQueuePayments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: Number(event.target.value) || 0 } : item))} placeholder="Monto" />
                    <Button type="button" variant="ghost" disabled={queuePayments.length === 1} onClick={() => setQueuePayments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</Button>
                  </div>
                  {payment.method === 'CUSTOMER_BALANCE' && <p className="mt-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Disponible a favor: {formatCurrency(getCustomerFavorBase(document.customerId), baseCurrency)}. Puedes aplicar solo una parte.</p>}
                  {requiresPaymentReference(payment.method) && <Input className="mt-2" placeholder="Referencia obligatoria" value={payment.reference || ''} onChange={(event) => setQueuePayments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, reference: event.target.value } : item))} />}
                  {isBankPaymentMethod(payment.method, true) && <BankAccountSelect className="mt-2" value={payment.bankAccountId} onChange={(bankAccountId) => setQueuePayments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, bankAccountId } : item))} label="Banco de destino" />}
                </div>
              ))}
               {queueMixedPaymentEnabled && <Button type="button" variant="outline" className="w-full rounded-xl" onClick={() => setQueuePayments((current) => [...current, paymentLine('CARD', 0, document.currency)])}>+ Agregar pago mixto</Button>}
             </div>
            {(() => {
              const paymentSummary = getQueuePaymentSummary();
              return (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total a pagar</p><p className="mt-1 font-mono text-lg font-black text-primary">{baseCurrency === 'USD' ? '$' : 'C$'} {formatSalesAmount(paymentSummary.totalBase)}</p></div>
                  <div className="rounded-xl border border-border/50 bg-muted/20 p-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pagado</p><p className="mt-1 font-mono text-lg font-black">{baseCurrency === 'USD' ? '$' : 'C$'} {formatSalesAmount(paymentSummary.paidBase)}</p></div>
                  <div className={cn('rounded-xl border p-3', paymentSummary.changeBase > 0 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-border/50 bg-muted/20 text-muted-foreground')}><p className="text-[10px] font-black uppercase tracking-widest">Cambio / vuelto</p><p className="mt-1 font-mono text-lg font-black">{baseCurrency === 'USD' ? '$' : 'C$'} {formatSalesAmount(paymentSummary.changeBase)}</p></div>
                </div>
              );
            })()}
             <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-border/50 pt-4"><Button type="button" variant="outline" onClick={() => { setQueueInvoice(null); setQueuePayments([]); setQueueMixedPaymentEnabled(false); }} disabled={queueSubmitting}>Cancelar</Button><Button type="button" onClick={() => void submitCashQueuePayment()} disabled={queueSubmitting}>{queueSubmitting ? <Loader2 className="size-4 animate-spin" /> : 'Confirmar cobro'}</Button></div>
          </div>
        </div>
        );
      })()}
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
      <VariantPickerModal
        open={variantPickerOpen}
        onOpenChange={setVariantPickerOpen}
        product={variantPickerProduct}
        onSelect={(variant) => {
          if (variantPickerProduct) handleVariantSelected(variantPickerProduct, variant);
        }}
      />
      <BranchAvailabilityModal
        open={availabilityOpen}
        onOpenChange={(open) => {
          setAvailabilityOpen(open);
          if (!open) setAvailabilityProduct(null);
        }}
        product={availabilityProduct}
        requestedQuantity={availabilityQuantity}
        availability={availabilityRows}
        loading={availabilityLoading}
        submitting={holdSubmitting}
        onSubmit={(selection) => void handleHoldReservation(selection)}
      />
      <AdministrarCajasModal
        open={manageCajasOpen}
        onOpenChange={setManageCajasOpen}
        onRegistersChanged={() => {
          loadInitialData();
          setActiveSession(null);
        }}
      />
    </div>
  );
}
