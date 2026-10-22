import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  CakeSlice,
  CalendarDays,
  Check,
  ChefHat,
  ClipboardList,
  Clock3,
  Coffee,
  CreditCard,
  Eye,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Salad,
  Settings2,
  Send,
  ShieldAlert,
  ShoppingBag,
  Truck,
  Users,
  Utensils,
  X,
  Download,
  FileText,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';
import { toast } from '@/app/services/toast';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { useBranchScope } from '../hooks/useBranchScope';
import { useNotificationDomainRefresh } from '../hooks/useNotificationDomainRefresh';
import { useAuth } from '../contexts/AuthContext';
import { createIdempotencyKey, getApiErrorMessage } from '../services/api';
import { beginNotificationAction, completeNotificationAction } from '../services/notification-action-coordinator';
import type { NotificationDomainRefreshDetail } from '../services/notification-domain-refresh';
import { cajaService } from '../services/caja.service';
import { RestaurantViewTutorial } from './RestaurantViewTutorial';
import { RestaurantMenuWorkspace } from './restaurant/RestaurantMenuWorkspace';
import { RestaurantConfigurationPage } from './restaurant/RestaurantConfigurationPage';
import { generateConfiguredReportSectionsPDF } from '../utils/pdfGenerator';
import type { PdfPaperFormat } from '../utils/pdfDownloadFormats';
import { ExportMenu } from './ui/ExportMenu';
import { buildDatedDownloadFileName } from '../utils/exportFileNames';
import {
  restaurantService,
  type RestaurantKitchenTicket,
  type RestaurantMenuCategory,
  type RestaurantMenuItem,
  type RestaurantOrder,
  type RestaurantConfiguration,
  type RestaurantSummary,
  type RestaurantTable,
} from '../services/restaurant.service';

type RestaurantTab = 'pos' | 'salon' | 'comandas' | 'cocina' | 'delivery' | 'carta' | 'reportes' | 'configuracion';
type RestaurantSelectedOptions = Record<string, string | string[]>;
type RestaurantCartLine = { menuItemId: string; quantity: number; selectedOptions: RestaurantSelectedOptions };
type RestaurantSalonMode = 'floor' | 'pos';
type RestaurantTableFilter = 'ALL' | 'OCCUPIED' | 'AVAILABLE' | 'RESERVED' | 'PREPARING' | 'PAYMENT';
type RestaurantOrderType = 'DINE_IN' | 'COUNTER' | 'TAKEAWAY' | 'DELIVERY';
type RestaurantPaymentLine = { method: 'CASH' | 'CARD' | 'TRANSFER' | 'CHECK' | 'QR' | 'VOUCHER'; amount: string; reference: string };
type RestaurantCustomerOption = { id: string; code?: string; name: string; creditLimit?: number; status?: string };

function restaurantOrderTypeLabel(type: string) {
  if (type === 'DINE_IN') return 'En salón';
  if (type === 'COUNTER') return 'Mostrador';
  if (type === 'TAKEAWAY') return 'Retiro';
  if (type === 'ROOM_SERVICE') return 'Servicio a habitación';
  if (type === 'QR') return 'QR';
  return 'Delivery';
}

function restaurantOptionPrice(item: RestaurantMenuItem, selected: RestaurantSelectedOptions) {
  return (item.options || []).reduce((total, group) => {
    const value = selected[group.id];
    const ids = Array.isArray(value) ? value : value ? [value] : [];
    return total + ids.reduce((sum, id) => sum + Number(group.choices.find((choice) => choice.id === id)?.priceAdjustment || 0), 0);
  }, 0);
}

function restaurantOptionLabel(item: RestaurantMenuItem, selected: RestaurantSelectedOptions) {
  return (item.options || []).flatMap((group) => {
    const value = selected[group.id];
    const ids = Array.isArray(value) ? value : value ? [value] : [];
    return ids.map((id) => group.choices.find((choice) => choice.id === id)?.name).filter(Boolean);
  }).join(' · ');
}

function restaurantSnapshotLabel(options?: Array<{ groupName: string; choiceName: string }> | null) {
  return (options || []).map((option) => `${option.groupName}: ${option.choiceName}`).join(' · ');
}

function restaurantCategoryIcon(name: string) {
  const normalized = name.toLocaleLowerCase('es');
  if (normalized.includes('café') || normalized.includes('cafe') || normalized.includes('bebida')) return Coffee;
  if (normalized.includes('ensalada')) return Salad;
  if (normalized.includes('postre') || normalized.includes('dulce')) return CakeSlice;
  if (normalized.includes('desayuno') || normalized.includes('entrada')) return ChefHat;
  return Utensils;
}

function restaurantStationLabel(station?: string | null) {
  const normalized = String(station || '').trim().toLocaleUpperCase('es');
  return ({
    KITCHEN: 'Cocina',
    COCINA: 'Cocina',
    BAR: 'Barra',
    DESSERTS: 'Postres',
    POSTRES: 'Postres',
    COLD: 'Cocina fría',
    HOT: 'Cocina caliente',
  } as Record<string, string>)[normalized] || station || 'Cocina';
}

function restaurantKitchenStatusLabel(status?: string | null) {
  const normalized = String(status || '').trim().toLocaleUpperCase('es').replace(/\s+/g, '_');
  return kitchenStatus[normalized]?.label || orderStatus[normalized] || status || 'Actualizado';
}

const RESTAURANT_TAB_PERMISSION: Record<RestaurantTab, string> = {
  pos: 'RESTAURANT_ORDERS',
  salon: 'RESTAURANT_SALON',
  comandas: 'RESTAURANT_ORDERS',
  cocina: 'RESTAURANT_KITCHEN',
  delivery: 'RESTAURANT_ORDERS',
  carta: 'RESTAURANT_MENU',
  reportes: 'RESTAURANT_REPORTS',
  configuracion: 'RESTAURANT',
};

const RESTAURANT_TABS: Array<{ id: RestaurantTab; label: string; icon: typeof LayoutGrid }> = [
  { id: 'pos', label: 'Operación POS', icon: ShoppingBag },
  { id: 'salon', label: 'Salón y mesas', icon: LayoutGrid },
  { id: 'comandas', label: 'Comandas', icon: ClipboardList },
  { id: 'cocina', label: 'Cocina', icon: ChefHat },
  { id: 'carta', label: 'Carta y menú', icon: Utensils },
  { id: 'delivery', label: 'Entrega y retiro', icon: Truck },
  { id: 'reportes', label: 'Reportes', icon: BarChart3 },
  { id: 'configuracion', label: 'Configuración', icon: Settings2 },
];

interface RestaurantePageProps {
  activeSubModule?: string;
  onSubModuleChange?: (subModule?: string) => void;
}

const tableStatus: Record<string, { label: string; className: string }> = {
  AVAILABLE: { label: 'Disponible', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  OCCUPIED: { label: 'Ocupada', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  RESERVED: { label: 'Reservada', className: 'border-violet-200 bg-violet-50 text-violet-700' },
  CLEANING: { label: 'Limpieza', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  INACTIVE: { label: 'Inactiva', className: 'border-slate-200 bg-slate-100 text-slate-500' },
};

const orderStatus: Record<string, string> = {
  PENDING_CONFIRMATION: 'Por confirmar',
  CONFIRMED: 'Confirmado',
  SENT_TO_KITCHEN: 'En cocina',
  IN_PREPARATION: 'En preparación',
  READY: 'Listo',
  SERVED: 'Servido',
  PARTIALLY_PAID: 'Pago parcial',
  PAID: 'Pagado',
  CANCELLED: 'Cancelado',
};

const kitchenStatus: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Pendiente', className: 'bg-amber-50 text-amber-700' },
  IN_PREPARATION: { label: 'En preparación', className: 'bg-blue-50 text-blue-700' },
  READY: { label: 'Listo', className: 'bg-emerald-50 text-emerald-700' },
  SERVED: { label: 'Entregado', className: 'bg-slate-100 text-slate-600' },
  CANCELLED: { label: 'Cancelado', className: 'bg-rose-50 text-rose-700' },
};

const money = (value: unknown, currency = 'NIO') => `${currency === 'USD' ? '$' : 'C$'} ${Number(value || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function restaurantOrderPreparationIsOpen(order: RestaurantOrder) {
  const preparationStatus = String(order.preparationStatus || '').toUpperCase();
  if (['QUEUED', 'IN_PROGRESS', 'PARTIALLY_READY'].includes(preparationStatus)) return true;
  if (preparationStatus) return false;
  return ['SENT_TO_KITCHEN', 'IN_PREPARATION'].includes(order.status);
}

function restaurantOrderIsReady(order: RestaurantOrder) {
  const preparationStatus = String(order.preparationStatus || '').toUpperCase();
  if (preparationStatus === 'READY') return true;
  if (preparationStatus === 'NOT_REQUIRED') return ['CONFIRMED', 'READY', 'SERVED', 'PARTIALLY_PAID'].includes(order.status);
  if (preparationStatus) return false;
  return ['READY', 'SERVED'].includes(order.status);
}

function restaurantOrderNeedsPayment(order: RestaurantOrder) {
  const paymentStatus = String(order.paymentStatus || '').toUpperCase();
  if (paymentStatus) return paymentStatus !== 'PAID';
  return ['READY', 'SERVED', 'PARTIALLY_PAID'].includes(order.status);
}

function restaurantOrderIsOperational(order: RestaurantOrder) {
  if (order.status === 'CANCELLED' || order.lifecycle === 'CANCELLED') return false;
  if (order.status !== 'PAID' && order.lifecycle !== 'CLOSED') return true;
  return restaurantOrderPreparationIsOpen(order)
    || ['PENDING', 'READY', 'OUT_FOR_DELIVERY'].includes(String(order.fulfillmentStatus || '').toUpperCase());
}

function restaurantOrderCanSendToKitchen(order: RestaurantOrder) {
  if (order.status === 'CANCELLED' || order.status === 'SERVED') return false;
  const preparationStatus = String(order.preparationStatus || '').toUpperCase();
  return ['CONFIRMED', 'PENDING_CONFIRMATION', 'PARTIALLY_PAID', 'PAID'].includes(order.status)
    && (!preparationStatus || ['QUEUED', 'NOT_REQUIRED'].includes(preparationStatus));
}

const restaurantSubmoduleToTab: Record<string, RestaurantTab> = {
  pos: 'pos',
  'operacion-pos': 'pos',
  salon: 'salon',
  comandas: 'comandas',
  cocina: 'cocina',
  'entrega-retiro': 'delivery',
  delivery: 'delivery',
  carta: 'carta',
  reportes: 'reportes',
  'reportes-restaurante': 'reportes',
  configuracion: 'configuracion',
};

const restaurantTabToSubmodule: Record<RestaurantTab, string> = {
  pos: 'operacion-pos',
  salon: 'salon',
  comandas: 'comandas',
  cocina: 'cocina',
  delivery: 'entrega-retiro',
  carta: 'carta',
  reportes: 'reportes-restaurante',
  configuracion: 'configuracion',
};

export function RestaurantePage({ activeSubModule, onSubModuleChange }: RestaurantePageProps) {
  const { user, canPerform } = useAuth();
  const { accessibleBranches, selectedBranchId } = useBranchScope();
  const canViewTables = canPerform('RESTAURANT_SALON', 'view');
  const canViewOrders = canPerform('RESTAURANT_ORDERS', 'view');
  const canViewKitchen = canPerform('RESTAURANT_KITCHEN', 'view');
  const canViewMenu = canPerform('RESTAURANT_MENU', 'view');
  const canViewReports = canPerform('RESTAURANT_REPORTS', 'view');
  const canConfigureRestaurant = Boolean(user?.isTenantAdmin || user?.isPlatformAdmin) || canPerform('RESTAURANT', 'configureRestaurant');
  const canViewRestaurant = canConfigureRestaurant || canPerform('RESTAURANT', 'view') || [canViewTables, canViewOrders, canViewKitchen, canViewMenu, canViewReports].some(Boolean);
  const canCreateTables = canPerform('RESTAURANT_SALON', 'create');
  const canEditTables = canPerform('RESTAURANT_SALON', 'edit');
  const canCloseTables = canPerform('RESTAURANT_SALON', 'closeTable');
  const canChangeTableStatus = canPerform('RESTAURANT_SALON', 'changeTableStatus');
  const canShareQr = canPerform('RESTAURANT_SALON', 'shareQr');
  const canRotateQr = canPerform('RESTAURANT_SALON', 'rotateQr');
  const canCreateOrders = canPerform('RESTAURANT_ORDERS', 'create');
  const canAddOrderItems = canPerform('RESTAURANT_ORDERS', 'addOrderItems');
  const canConfirmOrders = canPerform('RESTAURANT_ORDERS', 'confirmOrder');
  const canStartPreparation = canPerform('RESTAURANT_ORDERS', 'startPreparation');
  const canMarkOrdersReady = canPerform('RESTAURANT_ORDERS', 'markOrderReady');
  const canServeOrders = canPerform('RESTAURANT_ORDERS', 'serveOrder');
  const canCancelOrders = canPerform('RESTAURANT_ORDERS', 'cancelOrder');
  const canPayOrders = canPerform('RESTAURANT_ORDERS', 'pay');
  const canEditDeliveryDetails = canPerform('RESTAURANT_ORDERS', 'editDeliveryDetails');
  const canQueueDelivery = canPerform('RESTAURANT_ORDERS', 'queueDelivery');
  const canStartDeliveryPreparation = canPerform('RESTAURANT_ORDERS', 'startDeliveryPreparation');
  const canMarkDeliveryReady = canPerform('RESTAURANT_ORDERS', 'markDeliveryReady');
  const canDispatchDelivery = canPerform('RESTAURANT_ORDERS', 'dispatchDelivery');
  const canMarkDelivered = canPerform('RESTAURANT_ORDERS', 'markDelivered');
  const canCancelDelivery = canPerform('RESTAURANT_ORDERS', 'cancelDelivery');
  const canSendToKitchen = canPerform('RESTAURANT_KITCHEN', 'sendToKitchen');
  const canStartKitchenTickets = canPerform('RESTAURANT_KITCHEN', 'startPreparation');
  const canMarkKitchenReady = canPerform('RESTAURANT_KITCHEN', 'markKitchenReady');
  const canServeKitchenTickets = canPerform('RESTAURANT_KITCHEN', 'serveOrder');
  const canCancelKitchenTickets = canPerform('RESTAURANT_KITCHEN', 'cancelKitchenTicket');
  const canCreateMenu = canPerform('RESTAURANT_MENU', 'create');
  const canEditMenu = canPerform('RESTAURANT_MENU', 'edit');
  const [restaurantConfiguration, setRestaurantConfiguration] = useState<RestaurantConfiguration | null>(null);
  const visibleTabs = useMemo(
    () => RESTAURANT_TABS.filter(({ id }) => {
      if (id === 'configuracion') return canConfigureRestaurant && canPerform('RESTAURANT', 'view');
      if (!canPerform(RESTAURANT_TAB_PERMISSION[id], 'view')) return false;
      const current = restaurantConfiguration;
      if (!current) return true;
      if (id === 'pos') return current.channels.DINE_IN !== false || current.channels.COUNTER !== false || current.channels.TAKEAWAY !== false || current.channels.DELIVERY !== false;
      if (id === 'salon') return current.channels.DINE_IN !== false;
      if (id === 'cocina') return current.kitchen.enabled !== false;
      if (id === 'delivery') return current.channels.DELIVERY !== false || current.channels.TAKEAWAY !== false;
      return true;
    }),
    [canConfigureRestaurant, canPerform, restaurantConfiguration],
  );
  const [localTab, setLocalTab] = useState<RestaurantTab>('salon');
  const requestedTab = activeSubModule ? restaurantSubmoduleToTab[activeSubModule] : undefined;
  const tab = requestedTab && visibleTabs.some(({ id }) => id === requestedTab)
    ? requestedTab
    : visibleTabs.some(({ id }) => id === localTab) ? localTab : visibleTabs[0]?.id || 'salon';
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [menu, setMenu] = useState<RestaurantMenuCategory[]>([]);
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [tickets, setTickets] = useState<RestaurantKitchenTicket[]>([]);
  const [summary, setSummary] = useState<RestaurantSummary | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, RestaurantCartLine>>({});
  const [salonMode, setSalonMode] = useState<RestaurantSalonMode>('floor');
  const [tableFilter, setTableFilter] = useState<RestaurantTableFilter>('ALL');
  const [activeZone, setActiveZone] = useState('ALL');
  const [menuSearch, setMenuSearch] = useState('');
  const [activeMenuCategoryId, setActiveMenuCategoryId] = useState('ALL');
  const [orderNotes, setOrderNotes] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryReference, setDeliveryReference] = useState('');
  const [posOrderType, setPosOrderType] = useState<RestaurantOrderType>('TAKEAWAY');
  const [pendingOptionItem, setPendingOptionItem] = useState<RestaurantMenuItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTableForm, setShowTableForm] = useState(false);
  const [newTable, setNewTable] = useState({ code: '', name: '', zone: 'Salón principal', seats: '2' });
  const [checkoutOrder, setCheckoutOrder] = useState<RestaurantOrder | null>(null);
  const [orderDetail, setOrderDetail] = useState<RestaurantOrder | null>(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [registers, setRegisters] = useState<Array<{ id: string; name: string }>>([]);
  const [checkoutCustomers, setCheckoutCustomers] = useState<RestaurantCustomerOption[]>([]);
  const [checkoutRegisterId, setCheckoutRegisterId] = useState('');
  const [checkoutPayments, setCheckoutPayments] = useState<RestaurantPaymentLine[]>([{ method: 'CASH', amount: '', reference: '' }]);
  const [checkoutCustomerId, setCheckoutCustomerId] = useState('');
  const [checkoutDueDate, setCheckoutDueDate] = useState('');
  const [checkoutBalance, setCheckoutBalance] = useState<number | null>(null);
  const [publicLink, setPublicLink] = useState('');
  const [qrLink, setQrLink] = useState('');
  const [qrTable, setQrTable] = useState<RestaurantTable | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [targetOrderId, setTargetOrderId] = useState<string | null>(null);
  const [posAction, setPosAction] = useState<'save' | 'send' | 'charge' | 'round' | null>(null);
  const [tableAction, setTableAction] = useState(false);
  const [sendingOrderIds, setSendingOrderIds] = useState<Set<string>>(new Set());
  const sendingKitchenKeys = useRef<Map<string, string>>(new Map());
  const knownOrderIds = useRef<Set<string> | null>(null);
  const sessionCreatedOrderIds = useRef<Set<string>>(new Set());
  const availablePosOrderTypes = useMemo<RestaurantOrderType[]>(() => {
    const channels = restaurantConfiguration?.channels;
    if (!channels) return ['DINE_IN', 'COUNTER', 'TAKEAWAY', 'DELIVERY'];
    return (['DINE_IN', 'COUNTER', 'TAKEAWAY', 'DELIVERY'] as RestaurantOrderType[]).filter((type) => channels[type] !== false);
  }, [restaurantConfiguration]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { module?: string; subModule?: string; orderId?: string; targetId?: string } | undefined;
      if (detail?.module !== 'restaurante') return;
      const nextTab = detail.subModule ? restaurantSubmoduleToTab[detail.subModule] : undefined;
      if (!nextTab || !visibleTabs.some(({ id }) => id === nextTab)) return;
      setLocalTab(nextTab);
      onSubModuleChange?.(restaurantTabToSubmodule[nextTab]);
      const orderId = String(detail.orderId || detail.targetId || '').trim();
      setTargetOrderId(orderId || null);
    };
    window.addEventListener('navigate-module', handler);
    return () => window.removeEventListener('navigate-module', handler);
  }, [onSubModuleChange, visibleTabs]);

  const detectNewOrders = useCallback((nextOrders: RestaurantOrder[]) => {
    knownOrderIds.current = new Set(nextOrders.map((order) => order.id));
  }, []);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setRefreshing(true);
    try {
      const branchId = selectedBranchId || undefined;
      const [nextTables, nextMenu, nextOrders, nextTickets, nextSummary, nextCapabilities] = await Promise.all([
        canViewTables ? restaurantService.listTables(branchId, signal) : Promise.resolve([]),
        canViewMenu ? restaurantService.getMenu(signal) : Promise.resolve([]),
        canViewOrders ? restaurantService.listOrders(branchId, signal) : Promise.resolve([]),
        canViewKitchen ? restaurantService.listKitchenTickets(branchId, signal) : Promise.resolve([]),
        canViewReports ? restaurantService.getSummary({ branchId }, signal) : Promise.resolve(null),
          canViewRestaurant ? restaurantService.getCapabilities(branchId, signal) : Promise.resolve(null),
      ]);
      const nextTableList = nextTables || [];
      setTables(nextTableList);
      if (nextTableList[0]?.publicToken) setPublicLink((current) => current || `${window.location.origin}/restaurant/menu/${nextTableList[0].publicToken}`);
      setMenu(nextMenu || []);
      const nextOrderList = nextOrders || [];
      setOrders(nextOrderList);
      knownOrderIds.current = new Set(nextOrderList.map((order) => order.id));
      setTickets(nextTickets || []);
      setSummary(nextSummary || null);
      setRestaurantConfiguration(nextCapabilities?.configuration || null);
    } catch (error: unknown) {
      if (!(error instanceof Error) || error.name !== 'AbortError') toast.error(getApiErrorMessage(error, 'No se pudo cargar Restaurante POS.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canViewKitchen, canViewMenu, canViewOrders, canViewReports, canViewRestaurant, canViewTables, selectedBranchId]);

  const refreshRestaurantSection = useCallback(async (detail: NotificationDomainRefreshDetail) => {
    const subModule = detail.navigation.subModule;
    const branchId = selectedBranchId || undefined;
    try {
      if (subModule === 'salon' && canViewTables) {
        setTables((await restaurantService.listTables(branchId)) || []);
        return;
      }
      if (subModule === 'comandas' && canViewOrders) {
        const nextOrders = (await restaurantService.listOrders(branchId)) || [];
        setOrders(nextOrders);
        knownOrderIds.current = new Set(nextOrders.map((order) => order.id));
        if (checkoutOrder && detail.targetId === checkoutOrder.id) {
          setCheckoutOrder(nextOrders.find((order) => order.id === checkoutOrder.id) || null);
        }
        if (canViewTables) setTables((await restaurantService.listTables(branchId)) || []);
        return;
      }
      if (subModule === 'cocina' && canViewKitchen) {
        setTickets((await restaurantService.listKitchenTickets(branchId)) || []);
        if (canViewOrders) setOrders((await restaurantService.listOrders(branchId)) || []);
        return;
      }
      if (subModule === 'entrega-retiro' && canViewOrders) {
        setOrders((await restaurantService.listOrders(branchId, undefined, 'DELIVERY')) || []);
        return;
      }
      if (subModule === 'carta' && canViewMenu) {
        setMenu((await restaurantService.getMenu()) || []);
        return;
      }
      if (subModule === 'reportes' && canViewReports) {
        setSummary((await restaurantService.getSummary({ branchId })) || null);
      }
    } catch {
      // El polling queda como recuperación ante un fallo puntual del refresco.
    }
  }, [canViewKitchen, canViewMenu, canViewOrders, canViewReports, canViewTables, checkoutOrder, selectedBranchId]);

  useNotificationDomainRefresh({
    module: 'restaurante',
    subModules: ['salon', 'comandas', 'cocina', 'entrega-retiro', 'carta', 'reportes', 'configuracion'],
    onRefresh: refreshRestaurantSection,
    enabled: canViewRestaurant,
  });

  useEffect(() => {
    if (!canViewRestaurant) return;
    const controller = new AbortController();
    // La carga inicial sincroniza la pantalla con el API; el abort evita
    // actualizar estado si el usuario cambia de módulo antes de responder.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData(controller.signal);
    return () => controller.abort();
  }, [canViewRestaurant, loadData]);

  useEffect(() => {
    if (!canViewRestaurant) return;

    let stopped = false;
    let timeoutId: number | undefined;
    let inFlight = false;

    const pollLight = async () => {
      if (stopped || inFlight) return;
      inFlight = true;
      try {
        const branchId = selectedBranchId || undefined;
        const results = await Promise.allSettled([
          canViewOrders ? restaurantService.listOrders(branchId) : Promise.resolve([]),
          canViewKitchen ? restaurantService.listKitchenTickets(branchId) : Promise.resolve([]),
          canViewTables ? restaurantService.listTables(branchId) : Promise.resolve([]),
        ]);
        const [ordersResult, ticketsResult, tablesResult] = results;
        if (ordersResult.status === 'fulfilled') {
          const nextOrders = ordersResult.value || [];
          setOrders(nextOrders);
          detectNewOrders(nextOrders);
        }
        if (ticketsResult.status === 'fulfilled') setTickets(ticketsResult.value || []);
        if (tablesResult.status === 'fulfilled') setTables(tablesResult.value || []);
      } catch {
        // un fallo aislado no debe detener el polling
      } finally {
        inFlight = false;
      }
    };

    const scheduleNext = (delay: number) => {
      if (stopped) return;
      timeoutId = window.setTimeout(async () => {
        await pollLight();
        scheduleNext(12_000);
      }, delay);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        window.clearTimeout(timeoutId);
      } else {
        scheduleNext(0);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    scheduleNext(12_000);

    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearTimeout(timeoutId);
    };
  }, [canViewKitchen, canViewOrders, canViewRestaurant, canViewTables, selectedBranchId, detectNewOrders]);

  useEffect(() => {
    if (!canViewRestaurant) return;
    const intervalId = window.setInterval(() => {
      if (document.hidden) return;
      if (canViewMenu) restaurantService.getMenu().then((nextMenu) => setMenu(nextMenu || [])).catch(() => undefined);
      if (canViewReports) restaurantService.getSummary({ branchId: selectedBranchId || undefined }).then((nextSummary) => setSummary(nextSummary || null)).catch(() => undefined);
    }, 300_000);
    return () => window.clearInterval(intervalId);
  }, [canViewMenu, canViewReports, canViewRestaurant, selectedBranchId]);

  const selectedTable = useMemo(() => tables.find((table) => table.id === selectedTableId) || null, [tables, selectedTableId]);
  const cartLines = useMemo(() => menu.flatMap((category) => category.items.flatMap((item) => Object.entries(cart)
    .filter(([, line]) => line.menuItemId === item.id)
    .map(([key, line]) => ({ key, item, quantity: line.quantity, selectedOptions: line.selectedOptions })))), [menu, cart]);
  const cartTotal = cartLines.reduce((total, line) => total + (Number(line.item.price || 0) + restaurantOptionPrice(line.item, line.selectedOptions)) * line.quantity * (1 + Number(line.item.taxRate || 0) / 100), 0);
  const activeOrders = orders.filter(restaurantOrderIsOperational);
  const effectivePosOrderType = availablePosOrderTypes.includes(posOrderType) ? posOrderType : (availablePosOrderTypes[0] || posOrderType);
  const salonZones = useMemo(() => Array.from(new Set(['Salón principal', 'Terraza', 'Área VIP', 'Barra', ...tables.map((table) => table.zone?.trim()).filter((zone): zone is string => Boolean(zone))])), [tables]);

  const refresh = () => void loadData();

  const exportRestaurantReport = async (format: 'pdf' | 'xlsx', paperFormat: PdfPaperFormat = 'letter') => {
    if (!canPerform('RESTAURANT_REPORTS', 'export')) return;
    if (!summary) { toast.error('No hay datos de restaurante para exportar.'); return; }
    const topItems = (summary.topItems || []).map((item) => ({ Platillo: item.description, Total: Number(item._sum.total || 0) }));
    const rows = [
      { Indicador: 'Ventas operativas', Valor: money(summary.total) },
      { Indicador: 'Comandas no canceladas', Valor: summary.orders },
      { Indicador: 'Subtotal', Valor: money(summary.subtotal) },
      { Indicador: 'Impuestos', Valor: money(summary.tax) },
    ];
    try {
      if (format === 'xlsx') {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Resumen');
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(topItems.length ? topItems : [{ Platillo: 'Sin datos', Total: 0 }]), 'Platillos');
        XLSX.writeFile(workbook, buildDatedDownloadFileName(['reporte_restaurante'], 'xlsx'));
      } else {
        await generateConfiguredReportSectionsPDF({
          targetKey: 'restaurante.reports', title: 'Reporte operativo de restaurante', tenantName: user?.tenantName || 'Mi Empresa', tenantLogo: user?.sessionBranding?.logo || '',
          sections: [
            { id: 'restaurant-summary', title: 'Resumen operativo', headers: ['Indicador', 'Valor'], rows: rows.map((row) => [row.Indicador, row.Valor]) },
            { id: 'restaurant-top-items', title: 'Platillos destacados', headers: ['Platillo', 'Total'], rows: topItems.map((row) => [row.Platillo, money(row.Total)]) },
          ],
          fileName: buildDatedDownloadFileName(['reporte_restaurante'], 'pdf'),
          forceNative: true,
          format: paperFormat,
        });
      }
      toast.success(`Reporte de restaurante exportado en ${format === 'xlsx' ? 'Excel' : 'PDF'}.`);
    } catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'No se pudo exportar el reporte de restaurante.'); }
  };

  const addCartLine = (item: RestaurantMenuItem, selectedOptions: RestaurantSelectedOptions = {}) => {
    const normalized = Object.fromEntries(Object.entries(selectedOptions).sort(([a], [b]) => a.localeCompare(b)));
    const key = `${item.id}:${JSON.stringify(normalized)}`;
    setCart((current) => ({ ...current, [key]: { menuItemId: item.id, quantity: (current[key]?.quantity || 0) + 1, selectedOptions } }));
  };
  const addToCart = (itemId: string) => {
    const item = menu.flatMap((category) => category.items).find((candidate) => candidate.id === itemId);
    if (!item) return;
    if (item.options?.length) setPendingOptionItem(item);
    else addCartLine(item);
  };
  const removeFromCart = (key: string) => setCart((current) => {
    const next = { ...current };
    if (!next[key] || next[key].quantity <= 1) delete next[key];
    else next[key] = { ...next[key], quantity: next[key].quantity - 1 };
    return next;
  });

  const startNewOrder = () => {
    if (cartLines.length > 0 && !window.confirm('La orden actual tiene productos. ¿Deseas descartarlos y abrir una nueva orden?')) return;
    setCart({});
    setOrderNotes('');
    setDeliveryAddress('');
    setDeliveryReference('');
    toast.success('Nueva orden lista para capturar.');
  };

  const createOrder = async (sendToKitchen = true, checkoutAfterCreate = false) => {
    if (posAction) return;
    if (!canCreateOrders) {
      toast.error('No tienes permiso para registrar comandas.');
      return;
    }
    if (sendToKitchen && !canSendToKitchen) {
      toast.error('No tienes permiso para enviar comandas a cocina.');
      return;
    }
    if (checkoutAfterCreate && !canPayOrders) {
      toast.error('No tienes permiso para cobrar comandas.');
      return;
    }
    if ((effectivePosOrderType === 'DINE_IN' && !selectedTable) || cartLines.length === 0) {
      toast.error(effectivePosOrderType === 'DINE_IN' ? 'Selecciona una mesa y agrega al menos un platillo.' : 'Agrega al menos un platillo.');
      return;
    }
    if (effectivePosOrderType === 'DELIVERY' && !deliveryAddress.trim()) {
      toast.error('Agrega la dirección de entrega.');
      return;
    }
    const actionToken = beginNotificationAction();
    const requestKey = createIdempotencyKey(checkoutAfterCreate ? 'restaurant-charge' : sendToKitchen ? 'restaurant-kitchen' : 'restaurant-save');
    setPosAction(checkoutAfterCreate ? 'charge' : sendToKitchen ? 'send' : 'save');
    try {
      const order = await restaurantService.createOrder({
        tableId: selectedTable?.id,
        branchId: selectedBranchId || accessibleBranches[0]?.id,
        type: effectivePosOrderType,
        sendToKitchen,
        items: cartLines.map(({ item, quantity, selectedOptions }) => ({ menuItemId: item.id, quantity, selectedOptions })),
        notes: orderNotes.trim() || undefined,
        deliveryAddress: effectivePosOrderType === 'DELIVERY' ? deliveryAddress.trim() || undefined : undefined,
        deliveryReference: effectivePosOrderType === 'DELIVERY' ? deliveryReference.trim() || undefined : undefined,
      }, requestKey);
      sessionCreatedOrderIds.current.add(order.id);
      setCart({});
      setOrderNotes('');
      setDeliveryAddress('');
      setDeliveryReference('');
      toast.success(sendToKitchen ? `Comanda ${order.number} enviada a cocina.` : `Cuenta ${order.number} guardada.`);
      await loadData();
      if (checkoutAfterCreate) await openCheckout(order);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear la comanda.'));
    } finally {
      setPosAction(null);
      completeNotificationAction(actionToken);
    }
  };

  const addItemsToOrder = async (order: RestaurantOrder, sendToKitchen = true, checkoutAfterAdd = false) => {
    if (posAction || !canAddOrderItems || cartLines.length === 0) return;
    if (sendToKitchen && !canSendToKitchen) {
      toast.error('No tienes permiso para enviar rondas a cocina.');
      return;
    }
    if (checkoutAfterAdd && !canPayOrders) {
      toast.error('No tienes permiso para cobrar comandas.');
      return;
    }
    const actionToken = beginNotificationAction();
    const requestKey = createIdempotencyKey(checkoutAfterAdd ? 'restaurant-charge-round' : sendToKitchen ? 'restaurant-kitchen-round' : 'restaurant-round');
    setPosAction(checkoutAfterAdd ? 'charge' : 'round');
    try {
      const updatedOrder = await restaurantService.addItems(order.id, {
        sendToKitchen,
        items: cartLines.map(({ item, quantity, selectedOptions }) => ({ menuItemId: item.id, quantity, selectedOptions })),
      }, requestKey);
      setCart({});
      setOrderNotes('');
      toast.success(sendToKitchen ? `Nueva ronda de ${order.number} enviada a cocina.` : `Nueva ronda agregada a ${order.number}.`);
      await loadData();
      if (checkoutAfterAdd) await openCheckout(updatedOrder);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudieron agregar productos a la cuenta.'));
    } finally {
      setPosAction(null);
      completeNotificationAction(actionToken);
    }
  };

  const createTable = async () => {
    if (!canCreateTables) {
      toast.error('No tienes permiso para crear mesas.');
      return;
    }
    const branchId = selectedBranchId || accessibleBranches[0]?.id;
    if (!branchId || !newTable.code.trim() || !newTable.name.trim()) {
      toast.error('Selecciona una sucursal y completa código y nombre.');
      return;
    }
    const actionToken = beginNotificationAction();
    setTableAction(true);
    try {
      await restaurantService.createTable({ ...newTable, code: newTable.code.trim().toUpperCase(), name: newTable.name.trim(), zone: newTable.zone.trim() || 'Salón principal', branchId, seats: Number(newTable.seats) || 2 }, createIdempotencyKey('restaurant-table'));
      setNewTable({ code: '', name: '', zone: 'Salón principal', seats: '2' });
      setShowTableForm(false);
      toast.success('Mesa creada.');
      await loadData();
    } catch (error: unknown) {
      const data = (error as { data?: unknown })?.data as { code?: string; message?: string | { code?: string; message?: string; table?: Pick<RestaurantTable, 'id' | 'code' | 'name' | 'zone' | 'status' | 'isActive'> }; table?: Pick<RestaurantTable, 'id' | 'code' | 'name' | 'zone' | 'status' | 'isActive'> } | undefined;
      const nested = typeof data?.message === 'object' && data.message ? data.message : undefined;
      const conflictTable = data?.table || nested?.table;
      if ((data?.code === 'TABLE_CODE_CONFLICT' || nested?.code === 'TABLE_CODE_CONFLICT') && conflictTable) {
        if (conflictTable.zone) setActiveZone(conflictTable.zone);
        if (conflictTable.id) setSelectedTableId(conflictTable.id);
        toast.error(`${(typeof data?.message === 'string' ? data.message : nested?.message) || `Ya existe la mesa ${conflictTable.code}.`} Está en ${conflictTable.zone || 'sin zona'} · ${tableStatus[conflictTable.status || '']?.label || conflictTable.status || 'estado desconocido'}${conflictTable.isActive === false ? ' · archivada' : ''}. Usa otro código o abre la mesa existente.`);
      } else {
        toast.error(getApiErrorMessage(error, 'No se pudo crear la mesa.'));
      }
    } finally {
      setTableAction(false);
      completeNotificationAction(actionToken);
    }
  };

  const closeTable = async (table: RestaurantTable) => {
    if (!canCloseTables) {
      toast.error('No tienes permiso para cerrar mesas.');
      return;
    }
    const openOrders = activeOrders.filter((order) => order.table?.id === table.id);
    if (openOrders.length > 0) {
      toast.error('No puedes cerrar la mesa mientras tenga comandas abiertas.');
      return;
    }
    const actionToken = beginNotificationAction();
    try {
      await restaurantService.updateTable(table.id, { status: 'AVAILABLE' });
      setSelectedTableId(null);
      toast.success(`Mesa ${table.code} liberada.`);
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo liberar la mesa.'));
    } finally {
      completeNotificationAction(actionToken);
    }
  };

  const editTable = async (table: RestaurantTable, body: Pick<RestaurantTable, 'name' | 'zone' | 'seats'>) => {
    if (!canEditTables) return;
    try {
      const updated = await restaurantService.updateTable(table.id, body);
      setTables((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      toast.success(`Mesa ${updated.code} actualizada.`);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo actualizar la mesa.'));
    }
  };

  const changeTableStatus = async (table: RestaurantTable, status: 'RESERVED' | 'CLEANING') => {
    if (!canChangeTableStatus) return;
    try {
      const updated = await restaurantService.updateTable(table.id, { status });
      setTables((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      toast.success(status === 'RESERVED' ? 'Mesa marcada como reservada.' : 'Mesa marcada en limpieza.');
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo cambiar el estado de la mesa.'));
    }
  };

  const updateKitchen = async (ticket: RestaurantKitchenTicket, status: string) => {
    const actionAllowed = status === 'IN_PREPARATION' ? canStartKitchenTickets
      : status === 'READY' ? canMarkKitchenReady
        : status === 'SERVED' ? canServeKitchenTickets
          : status === 'CANCELLED' ? canCancelKitchenTickets : false;
    if (!actionAllowed) return;
    const actionToken = beginNotificationAction();
    try {
      await restaurantService.updateKitchenTicket(ticket.id, status);
      toast.success(`Comanda ${ticket.order.number}: ${restaurantKitchenStatusLabel(status)}.`);
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo actualizar cocina.'));
    } finally {
      completeNotificationAction(actionToken);
    }
  };

  const changeOrderStatus = async (order: RestaurantOrder, status: string) => {
    const actionAllowed = status === 'CONFIRMED' ? canConfirmOrders
      : status === 'SENT_TO_KITCHEN' ? canSendToKitchen
        : status === 'IN_PREPARATION' ? canStartPreparation
          : status === 'READY' ? canMarkOrdersReady
            : status === 'SERVED' ? canServeOrders
              : status === 'CANCELLED' ? canCancelOrders : false;
    if (!actionAllowed) return;
    const actionToken = beginNotificationAction();
    try {
      await restaurantService.updateOrderStatus(order.id, status);
      toast.success(`Comanda ${order.number}: ${orderStatus[status] || status}.`);
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo actualizar la comanda.'));
    } finally {
      completeNotificationAction(actionToken);
    }
  };

  const updateDelivery = async (order: RestaurantOrder, body: { status?: RestaurantOrder['deliveryStatus']; riderName?: string; address?: string; reference?: string }) => {
    const statusPermission = body.status === 'PENDING' ? canQueueDelivery
      : body.status === 'PREPARING' ? canStartDeliveryPreparation
        : body.status === 'READY' ? canMarkDeliveryReady
          : body.status === 'OUT_FOR_DELIVERY' ? canDispatchDelivery
            : body.status === 'DELIVERED' ? canMarkDelivered
              : body.status === 'CANCELLED' ? canCancelDelivery : true;
    const updatesDetails = body.address !== undefined || body.reference !== undefined
      || (body.riderName !== undefined && body.status !== 'OUT_FOR_DELIVERY');
    if (!statusPermission || (updatesDetails && !canEditDeliveryDetails)) return;
    const actionToken = beginNotificationAction();
    try {
      await restaurantService.updateDelivery(order.id, body);
      toast.success(`Entrega ${order.number} actualizada.`);
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo actualizar la entrega.'));
    } finally {
      completeNotificationAction(actionToken);
    }
  };

  const sendToKitchen = async (order: RestaurantOrder) => {
    if (!canSendToKitchen) return;
    const requestKey = sendingKitchenKeys.current.get(order.id) || createIdempotencyKey(`restaurant-send-${order.id}`);
    if (sendingKitchenKeys.current.has(order.id)) return;
    sendingKitchenKeys.current.set(order.id, requestKey);
    setSendingOrderIds((current) => new Set(current).add(order.id));
    const actionToken = beginNotificationAction();
    try {
      await restaurantService.sendToKitchen(order.id, requestKey);
      toast.success(`Comanda ${order.number} enviada a cocina.`);
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo enviar a cocina.'));
    } finally {
      sendingKitchenKeys.current.delete(order.id);
      setSendingOrderIds((current) => { const next = new Set(current); next.delete(order.id); return next; });
      completeNotificationAction(actionToken);
    }
  };

  const openCheckout = async (order: RestaurantOrder) => {
    if (!canPayOrders) return;
    try {
      const [available, customers, paymentSummary] = await Promise.all([cajaService.getRegisterLookup(), cajaService.getCustomers(), restaurantService.listOrderPayments(order.id)]);
      setRegisters((available || []).map((register) => ({ id: register.id, name: register.name })));
      setCheckoutCustomers((customers || []).map((customer) => ({ id: customer.id, code: customer.code, name: customer.name, creditLimit: Number(customer.creditLimit || 0), status: customer.status })));
      setCheckoutRegisterId(available?.[0]?.id || '');
      setCheckoutBalance(Number(paymentSummary.balance ?? order.total ?? 0));
      setCheckoutPayments([{ method: 'CASH', amount: String(Number(paymentSummary.balance ?? order.total ?? 0)), reference: '' }]);
      setCheckoutCustomerId(paymentSummary.customerId || '');
      setCheckoutDueDate(paymentSummary.dueDate ? new Date(paymentSummary.dueDate).toISOString().slice(0, 10) : '');
      setCheckoutOrder(order);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudieron cargar las cajas.'));
    }
  };

  const openOrderDetail = async (order: RestaurantOrder) => {
    setOrderDetail(order);
    setOrderDetailLoading(true);
    try {
      setOrderDetail(await restaurantService.getOrder(order.id));
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo cargar el detalle del pedido.'));
    } finally {
      setOrderDetailLoading(false);
    }
  };

  const checkout = async () => {
    if (!canPayOrders) return;
    if (!checkoutOrder || !checkoutRegisterId) return;
    let actionToken: string | null = null;
    try {
      const session = await cajaService.getActiveSession(checkoutRegisterId);
      if (!session?.id) {
        toast.error('La caja seleccionada no tiene una sesión abierta. Abre la caja antes de cobrar.');
        return;
      }
      actionToken = beginNotificationAction();
      const payments = checkoutPayments.filter((payment) => Number(payment.amount) > 0).map((payment) => ({ method: payment.method, amount: Number(payment.amount), currency: checkoutOrder.currency === 'USD' ? 'USD' : 'NIO', reference: payment.reference.trim() || undefined }));
      const checkoutTarget = Number(checkoutBalance ?? checkoutOrder.total);
      const paymentTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
      const isPartialPayment = paymentTotal < checkoutTarget - 0.01;
      if (!payments.length || paymentTotal > checkoutTarget + 0.01) {
        toast.error('El cobro debe tener un monto válido y no superar el total.');
        return;
      }
      if (isPartialPayment && restaurantConfiguration?.cash.rules.partialPayments === false) {
        toast.error('Los cobros parciales están desactivados en la configuración.');
        return;
      }
      if (isPartialPayment && (!checkoutCustomerId || !checkoutDueDate)) {
        toast.error('Selecciona un cliente y una fecha de vencimiento para registrar el saldo pendiente.');
        return;
      }
      if (payments.some((payment) => payment.method !== 'CASH' && !payment.reference)) {
        toast.error('Agrega la referencia de cada pago electrónico o cheque.');
        return;
      }
      const checkoutPayload = {
        expectedVersion: checkoutOrder.version,
        registerId: checkoutRegisterId,
        sessionId: session.id,
        ...(checkoutCustomerId ? { customerId: checkoutCustomerId } : {}),
        ...(checkoutDueDate ? { dueDate: checkoutDueDate } : {}),
        payments,
      };
      if (checkoutOrder.invoiceId) await restaurantService.addOrderPayment(checkoutOrder.id, checkoutPayload);
      else await restaurantService.checkout(checkoutOrder.id, checkoutPayload);
      toast.success(isPartialPayment ? `Abono registrado para ${checkoutOrder.number}.` : `Pedido ${checkoutOrder.number} cobrado y contabilizado.`);
      setCheckoutOrder(null);
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo cobrar el pedido.'));
    } finally {
      completeNotificationAction(actionToken);
    }
  };

  const showTableQr = async (table: RestaurantTable, rotatedToken = false) => {
    if ((!canShareQr && !(rotatedToken && canRotateQr)) || !table.publicToken) {
      toast.error('No tienes permiso para consultar el QR público de esta mesa.');
      return;
    }
    const url = `${window.location.origin}/restaurant/menu/${table.publicToken}`;
    setQrLink(url);
    if (canShareQr) setPublicLink(url);
    setQrTable(table);
    setQrDataUrl('');
    setQrLoading(true);
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 720,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#0b2e26', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);
    } catch (error: unknown) {
      setQrTable(null);
      toast.error(getApiErrorMessage(error, 'No se pudo generar el código QR.'));
    } finally {
      setQrLoading(false);
    }
  };

  const rotateTableQr = async (table: RestaurantTable) => {
    if (!canRotateQr || !window.confirm('Regenerar el QR invalidará el enlace anterior. ¿Continuar?')) return;
    try {
      const rotatedTable = await restaurantService.rotateTableQr(table.id);
      setTables((current) => current.map((entry) => entry.id === rotatedTable.id
        ? { ...rotatedTable, ...(canShareQr ? {} : { publicToken: undefined }) }
        : entry));
      await showTableQr(rotatedTable, true);
      toast.success('QR regenerado. El enlace anterior dejó de funcionar.');
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo regenerar el QR de la mesa.'));
    }
  };

  const copyQrLink = async () => {
    if (!qrLink) return;
    try {
      await navigator.clipboard.writeText(qrLink);
      toast.success('Enlace de la mesa copiado.');
    } catch {
      toast.info(qrLink);
    }
  };

  const downloadQr = () => {
    if (!qrDataUrl || !qrTable) return;
    const anchor = document.createElement('a');
    anchor.href = qrDataUrl;
    anchor.download = `qr-mesa-${qrTable.code}.png`;
    anchor.click();
  };

  const printQr = () => {
    if (!qrDataUrl || !qrTable) return;
    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=720,height=860');
    if (!printWindow) {
      toast.error('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para NovaHub.');
      return;
    }
    const tenant = String(user?.tenantName || 'NovaHub').replace(/[<>]/g, '');
    const code = String(qrTable.code).replace(/[<>]/g, '');
    const name = String(qrTable.name).replace(/[<>]/g, '');
    printWindow.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>QR ${code}</title><style>body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;color:#0b2e26}.card{text-align:center;width:90%;max-width:440px;border:2px solid #d8eee5;border-radius:24px;padding:32px;box-sizing:border-box}.brand{font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#10b981;font-size:14px}.table{font-size:32px;font-weight:800;margin:12px 0 4px}.name{color:#475569;margin-bottom:20px}.qr{width:320px;height:320px;max-width:100%;object-fit:contain}.hint{font-size:13px;color:#64748b;margin-top:20px}@media print{.card{border:0}}</style></head><body><main class="card"><div class="brand">${tenant}</div><div class="table">Mesa ${code}</div><div class="name">${name}</div><img class="qr" src="${qrDataUrl}" alt="Código QR de la mesa"><div class="hint">Escanea para ver la carta y enviar tu pedido</div></main><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`);
    printWindow.document.close();
  };

  if (!canViewRestaurant) return <NoAccessState />;
  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground"><RefreshCw className="mr-2 size-4 animate-spin" />Cargando Restaurante POS…</div>;

  const restaurantSubtitle = tab === 'pos' || (tab === 'salon' && salonMode === 'pos')
    ? 'Gestiona pedidos, productos y cobros desde un solo lugar.'
    : tab === 'salon'
      ? 'Gestiona tus mesas, zonas y comandas en tiempo real.'
      : tab === 'comandas'
        ? 'Consulta cuentas abiertas, estados, canales y modificaciones.'
        : tab === 'cocina'
          ? 'Gestiona comandas y tiempos de preparación por estación.'
          : tab === 'delivery'
            ? 'Gestiona pedidos delivery y para llevar desde una sola vista.'
            : tab === 'carta'
              ? 'Gestiona tu carta, categorías, platillos y disponibilidad.'
              : tab === 'reportes'
                ? 'Analiza ventas, operación y rendimiento del restaurante.'
                : 'Configura la operación del restaurante y sus canales.';

  return (
    <div className="nh-restaurant-page flex flex-1 w-full bg-background">
      <main className="relative flex-1">
        <div className="mx-auto min-h-[calc(100vh-5rem)] w-full max-w-[1700px] p-4 sm:p-6 md:px-10 md:pb-10 md:pt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2" data-tour="restaurant-header">
              <div className="mr-auto flex min-w-0 items-center gap-2">
                <div className="min-w-0"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary"><span className="size-2 rounded-full bg-accent shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]" />Restaurante</p><h1 className="truncate font-serif text-3xl font-medium italic tracking-tight text-primary">{tab === 'pos' || (tab === 'salon' && salonMode === 'pos') ? 'Operación POS' : RESTAURANT_TABS.find((item) => item.id === tab)?.label}</h1><p className="mt-1 text-sm text-muted-foreground">{restaurantSubtitle}</p></div>
                <RestaurantViewTutorial view={tab} />
              </div>
              {tab === 'salon' && salonMode === 'floor' ? <>
                <select value={activeZone} onChange={(event) => { setActiveZone(event.target.value); setTableFilter('ALL'); }} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-primary">
                  <option value="ALL">Todas</option>{salonZones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                </select>
                {canCreateTables && <Button size="sm" onClick={() => setShowTableForm((value) => !value)}>{showTableForm ? <X className="size-4" /> : <Plus className="size-4" />}{showTableForm ? 'Cancelar' : 'Nueva mesa'}</Button>}
                <Button variant="outline" size="sm" onClick={() => { setActiveZone('ALL'); setTableFilter('RESERVED'); }}><CalendarDays className="size-4" />Reservas</Button>
              </> : tab === 'delivery' ? <>
                <Button variant="outline" size="sm" onClick={() => void refresh()}><CalendarDays className="size-4" />Hoy, {new Date().toLocaleDateString('es-NI', { day: '2-digit', month: 'short' })}</Button>
                <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}><RefreshCw className={refreshing ? 'size-4 animate-spin' : 'size-4'} />Actualizar</Button>
              </> : <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}><RefreshCw className={refreshing ? 'size-4 animate-spin' : 'size-4'} />Actualizar</Button>}
          </div>

          {tab === 'salon' && salonMode === 'floor' && (
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              {[
                { id: 'ALL' as const, label: 'Mesas totales', value: tables.length, hint: '100% del salón', icon: LayoutGrid },
                { id: 'OCCUPIED' as const, label: 'Ocupadas', value: tables.filter((table) => table.status === 'OCCUPIED').length, hint: `${tables.length ? Math.round((tables.filter((table) => table.status === 'OCCUPIED').length / tables.length) * 100) : 0}% del total`, icon: Users },
                { id: 'AVAILABLE' as const, label: 'Disponibles', value: tables.filter((table) => table.status === 'AVAILABLE').length, hint: `${tables.length ? Math.round((tables.filter((table) => table.status === 'AVAILABLE').length / tables.length) * 100) : 0}% del total`, icon: LayoutGrid },
                { id: 'RESERVED' as const, label: 'Reservadas', value: tables.filter((table) => table.status === 'RESERVED').length, hint: `${tables.length ? Math.round((tables.filter((table) => table.status === 'RESERVED').length / tables.length) * 100) : 0}% del total`, icon: Clock3 },
                { id: 'PREPARING' as const, label: 'En preparación', value: tables.filter((table) => activeOrders.some((order) => order.table?.id === table.id && restaurantOrderPreparationIsOpen(order))).length, hint: `${tables.length ? Math.round((tables.filter((table) => activeOrders.some((order) => order.table?.id === table.id && restaurantOrderPreparationIsOpen(order))).length / tables.length) * 100) : 0}% del total`, icon: ChefHat },
                { id: 'PAYMENT' as const, label: 'Pendientes de cobro', value: tables.filter((table) => activeOrders.some((order) => order.table?.id === table.id && restaurantOrderNeedsPayment(order) && restaurantOrderIsReady(order))).length, hint: `${tables.length ? Math.round((tables.filter((table) => activeOrders.some((order) => order.table?.id === table.id && restaurantOrderNeedsPayment(order) && restaurantOrderIsReady(order))).length / tables.length) * 100) : 0}% del total`, icon: CreditCard },
              ].map(({ id, label, value, hint, icon: Icon }) => (
                <button key={id} type="button" onClick={() => setTableFilter(id)} className={`rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 ${tableFilter === id ? 'border-primary ring-2 ring-primary/10' : 'border-border/60'}`}>
                  <div className="flex items-center gap-3"><span className="nh-restaurant-icon-tile flex size-10 shrink-0 items-center justify-center rounded-xl"><Icon className="size-5" /></span><span className="min-w-0"><span className="block truncate font-serif text-sm font-medium italic text-primary">{label}</span><span className="mt-1 block text-2xl font-black tracking-tight text-accent">{value}</span></span></div>
                  <span className="mt-2 block text-xs text-muted-foreground">{hint}</span>
                </button>
              ))}
            </div>
          )}

          <div className="w-full">
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                {tab === 'salon' && salonMode === 'floor' && <RestaurantSalonView tables={tables} orders={activeOrders} selectedTableId={selectedTableId} onSelectTable={setSelectedTableId} onOpenPos={(tableId) => { setSelectedTableId(tableId); setPosOrderType('DINE_IN'); setSalonMode('pos'); }} tableFilter={tableFilter} activeZone={activeZone} onTableFilterChange={setTableFilter} onZoneChange={setActiveZone} showTableForm={showTableForm} onToggleTableForm={() => setShowTableForm((value) => !value)} newTable={newTable} onNewTableChange={setNewTable} onCreateTable={createTable} canCreateTables={canCreateTables} canEditTables={canEditTables} canCloseTables={canCloseTables} canChangeTableStatus={canChangeTableStatus} canShareQr={canShareQr} canRotateQr={canRotateQr} tableAction={tableAction} onShowQr={showTableQr} onRotateQr={rotateTableQr} onEditTable={editTable} onChangeTableStatus={changeTableStatus} onCloseTable={closeTable} />}
                {(tab === 'pos' || (tab === 'salon' && salonMode === 'pos')) && <div data-tour="restaurant-pos"><RestaurantPosView tables={tables} selectedTable={selectedTable} orders={activeOrders} menu={menu} cartLines={cartLines} cartTotal={cartTotal} canCreateOrders={canCreateOrders} canAddOrderItems={canAddOrderItems} canSendToKitchen={canSendToKitchen} canPayOrders={canPayOrders} kitchenEnabled={restaurantConfiguration?.kitchen.enabled !== false} menuSearch={menuSearch} activeCategoryId={activeMenuCategoryId} orderNotes={orderNotes} deliveryAddress={deliveryAddress} deliveryReference={deliveryReference} orderType={effectivePosOrderType} availableOrderTypes={availablePosOrderTypes} pendingAction={posAction} onOrderTypeChange={(value) => { setPosOrderType(value); if (value !== 'DINE_IN') setSelectedTableId(null); }} onMenuSearchChange={setMenuSearch} onCategoryChange={setActiveMenuCategoryId} onNotesChange={setOrderNotes} onDeliveryAddressChange={setDeliveryAddress} onDeliveryReferenceChange={setDeliveryReference} onSelectTable={(id) => { setSelectedTableId(id); setPosOrderType('DINE_IN'); }} onNewOrder={startNewOrder} onAddItem={addToCart} onRemoveLine={removeFromCart} onCreateOrder={createOrder} onAddToOrder={addItemsToOrder} onCheckout={openCheckout} /></div>}
                {tab === 'comandas' && <div data-tour="restaurant-orders"><OrderBoard orders={orders} targetOrderId={targetOrderId} onTargetHandled={() => setTargetOrderId(null)} canSendToKitchen={canSendToKitchen} canServeOrder={canServeOrders} canConfirmOrders={canConfirmOrders} canCancelOrders={canCancelOrders} canPayOrders={canPayOrders} sendingOrderIds={sendingOrderIds} onSend={sendToKitchen} onStatus={changeOrderStatus} onCheckout={openCheckout} onOpenDetail={openOrderDetail} /></div>}
                {tab === 'cocina' && <div data-tour="restaurant-kitchen"><KitchenBoard tickets={tickets} averagePrepMinutes={summary?.averagePrepMinutes} canStartPreparation={canStartKitchenTickets} canMarkReady={canMarkKitchenReady} canServe={canServeKitchenTickets} canCancel={canCancelKitchenTickets} onStatus={updateKitchen} /></div>}
                {tab === 'delivery' && <div data-tour="restaurant-delivery"><DeliveryBoard orders={orders} canEditDetails={canEditDeliveryDetails} canQueue={canQueueDelivery} canStartPreparation={canStartDeliveryPreparation} canMarkReady={canMarkDeliveryReady} canDispatch={canDispatchDelivery} canMarkDelivered={canMarkDelivered} canCancel={canCancelDelivery} canPayOrders={canPayOrders} onUpdate={updateDelivery} onOpenDetail={openOrderDetail} onCheckout={openCheckout} /></div>}
                {tab === 'carta' && <div data-tour="restaurant-menu"><RestaurantMenuWorkspace menu={menu} canCreate={canCreateMenu} canEdit={canEditMenu} canConfigureRestaurant={canConfigureRestaurant} canExport={canPerform('RESTAURANT_MENU', 'export')} onSaved={() => loadData()} publicLink={publicLink} /></div>}
                {tab === 'reportes' && <div data-tour="restaurant-reports"><ReportsBoard summary={summary} canExport={canPerform('RESTAURANT_REPORTS', 'export')} onExport={exportRestaurantReport} /><ReportsVisuals summary={summary} /></div>}
                {tab === 'configuracion' && canConfigureRestaurant && <div data-tour="restaurant-configuration"><RestaurantConfigurationPage canEdit={canConfigureRestaurant} onSaved={(response) => setRestaurantConfiguration(response.configuration)} /></div>}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      {qrTable && <div className="nh-modal-root fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4" role="dialog" aria-modal="true" aria-labelledby="restaurant-qr-title"><div className="nh-modal-surface w-full max-w-md rounded-3xl border border-border/60 bg-card p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Carta digital por mesa</p><h2 id="restaurant-qr-title" className="mt-1 text-2xl font-black">QR · Mesa {qrTable.code}</h2><p className="mt-1 text-sm text-muted-foreground">{qrTable.name} · escanea para abrir la carta.</p></div><button type="button" onClick={() => setQrTable(null)} className="size-9 rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Cerrar código QR"><X className="size-5" /></button></div><div className="mt-5 flex min-h-64 items-center justify-center rounded-3xl border border-primary/15 bg-white p-5">{qrLoading ? <RefreshCw className="size-8 animate-spin text-primary" /> : qrDataUrl ? <img src={qrDataUrl} alt={`Código QR de la mesa ${qrTable.code}`} className="size-64 max-w-full object-contain" /> : <p className="text-sm text-muted-foreground">No se pudo generar el QR.</p>}</div><div className="mt-4 rounded-xl bg-muted/40 p-3"><p className="break-all text-xs leading-5 text-muted-foreground">{qrLink}</p></div><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"><Button variant="outline" onClick={() => void copyQrLink()} disabled={!qrDataUrl}>Copiar enlace</Button><Button variant="outline" onClick={downloadQr} disabled={!qrDataUrl}><Download className="size-4" />PNG</Button><Button className="sm:col-span-2" onClick={printQr} disabled={!qrDataUrl}><FileText className="size-4" />Imprimir QR</Button></div></div></div>}

       {checkoutOrder && <RestaurantCheckoutDialog order={checkoutOrder} balance={checkoutBalance} registers={registers} customers={checkoutCustomers} customerId={checkoutCustomerId} dueDate={checkoutDueDate} allowPartialPayments={restaurantConfiguration?.cash.rules.partialPayments !== false} registerId={checkoutRegisterId} payments={checkoutPayments} onRegisterChange={setCheckoutRegisterId} onCustomerChange={setCheckoutCustomerId} onDueDateChange={setCheckoutDueDate} onPaymentsChange={setCheckoutPayments} onClose={() => setCheckoutOrder(null)} onConfirm={checkout} />}
      {orderDetail && <RestaurantOrderDetailDialog order={orderDetail} loading={orderDetailLoading} onClose={() => setOrderDetail(null)} onCheckout={openCheckout} canPayOrders={canPayOrders} />}
      {pendingOptionItem && <RestaurantOptionsDialog item={pendingOptionItem} onClose={() => setPendingOptionItem(null)} onConfirm={(selectedOptions) => { addCartLine(pendingOptionItem, selectedOptions); setPendingOptionItem(null); }} />}
    </div>
  );
}

type RestaurantDraftTable = { code: string; name: string; zone: string; seats: string };

interface RestaurantSalonViewProps {
  tables: RestaurantTable[];
  orders: RestaurantOrder[];
  selectedTableId: string | null;
  onSelectTable: (tableId: string) => void;
  onNewOrder: () => void;
  onOpenPos: (tableId: string) => void;
  tableFilter: RestaurantTableFilter;
  activeZone: string;
  onTableFilterChange: (filter: RestaurantTableFilter) => void;
  onZoneChange: (zone: string) => void;
  showTableForm: boolean;
  onToggleTableForm: () => void;
  newTable: RestaurantDraftTable;
  onNewTableChange: (table: RestaurantDraftTable) => void;
  onCreateTable: () => void;
  canCreateTables: boolean;
  canEditTables: boolean;
  canCloseTables: boolean;
  canChangeTableStatus: boolean;
  canShareQr: boolean;
  canRotateQr: boolean;
  tableAction: boolean;
  onShowQr: (table: RestaurantTable) => Promise<void>;
  onRotateQr: (table: RestaurantTable) => Promise<void>;
  onEditTable: (table: RestaurantTable, body: Pick<RestaurantTable, 'name' | 'zone' | 'seats'>) => Promise<void>;
  onChangeTableStatus: (table: RestaurantTable, status: 'RESERVED' | 'CLEANING') => Promise<void>;
  onCloseTable: (table: RestaurantTable) => Promise<void>;
}

function RestaurantSalonView({ tables, orders, selectedTableId, onSelectTable, onOpenPos, tableFilter, activeZone, onTableFilterChange, onZoneChange, showTableForm, onToggleTableForm, newTable, onNewTableChange, onCreateTable, canCreateTables, canEditTables, canCloseTables, canChangeTableStatus, canShareQr, canRotateQr, tableAction, onShowQr, onRotateQr, onEditTable, onChangeTableStatus, onCloseTable }: RestaurantSalonViewProps) {
  const zones = useMemo(() => {
    const canonicalZones = ['Salón principal', 'Terraza', 'Área VIP', 'Barra'];
    const customZones = Array.from(new Set(tables.map((table) => table.zone?.trim()).filter((zone): zone is string => Boolean(zone && !canonicalZones.includes(zone)))));
    return ['ALL', ...canonicalZones, ...customZones];
  }, [tables]);
  const [detailTab, setDetailTab] = useState<'summary' | 'orders' | 'qr'>('summary');
  const [guestCounts, setGuestCounts] = useState<Record<string, number>>({});
  const [tableDraft, setTableDraft] = useState({ name: '', zone: '', seats: '' });
  const [nextTableStatus, setNextTableStatus] = useState<'RESERVED' | 'CLEANING' | ''>('');
  const [savingTableDetails, setSavingTableDetails] = useState(false);
  useEffect(() => setDetailTab('summary'), [selectedTableId]);
  const tableDetails = useMemo(() => tables.map((table) => {
    const tableOrders = orders.filter((order) => order.table?.id === table.id);
    const preparing = tableOrders.some(restaurantOrderPreparationIsOpen);
    const payment = tableOrders.some((order) => restaurantOrderNeedsPayment(order) && restaurantOrderIsReady(order));
    const status = payment ? 'PAYMENT' : preparing ? 'PREPARING' : table.status;
    const total = tableOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    return { table, tableOrders, preparing, payment, status, total };
  }), [orders, tables]);
  const visibleTables = tableDetails.filter(({ table, status }) => {
    const zoneMatches = activeZone === 'ALL' || (table.zone || 'Salón principal') === activeZone;
    const filterMatches = tableFilter === 'ALL' || status === tableFilter;
    return zoneMatches && filterMatches;
  });
  const selected = tableDetails.find(({ table }) => table.id === selectedTableId) || null;
  const selectedGuests = selected ? guestCounts[selected.table.id] || Math.min(selected.table.seats, 4) : 0;
  const selectedStatus = selected ? (selected.status === 'PREPARING' ? { label: 'En preparación', className: 'border-amber-200 bg-amber-50 text-amber-700' } : selected.status === 'PAYMENT' ? { label: 'Por cobrar', className: 'border-violet-200 bg-violet-50 text-violet-700' } : tableStatus[selected.table.status] || tableStatus.AVAILABLE) : null;
  useEffect(() => {
    setTableDraft(selected ? { name: selected.table.name, zone: selected.table.zone || 'Salón principal', seats: String(selected.table.seats) } : { name: '', zone: '', seats: '' });
    setNextTableStatus('');
  }, [selected?.table.id]);
  const saveTableDetails = async () => {
    if (!selected || !canEditTables || !tableDraft.name.trim()) return;
    const seats = Number(tableDraft.seats);
    if (!Number.isInteger(seats) || seats < 1 || seats > 99) return;
    setSavingTableDetails(true);
    try {
      await onEditTable(selected.table, { name: tableDraft.name.trim(), zone: tableDraft.zone, seats });
    } finally {
      setSavingTableDetails(false);
    }
  };

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(350px,0.65fr)]" data-tour="restaurant-salon">
    <section className="min-w-0 rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-accent/[0.06] p-4 shadow-sm sm:p-5">
      {showTableForm && canCreateTables && <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/[0.04] p-4"><div className="mb-3"><p className="font-serif text-lg font-medium italic text-primary">Nueva mesa</p><p className="text-xs text-muted-foreground">El código debe ser único dentro de la sucursal.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="text-xs font-bold text-muted-foreground">Zona<select aria-label="Zona de mesa" value={newTable.zone} onChange={(event) => onNewTableChange({ ...newTable, zone: event.target.value })} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus:border-primary"><option>Salón principal</option><option>Terraza</option><option>Área VIP</option><option>Barra</option></select></label><label className="text-xs font-bold text-muted-foreground">Nombre visible<input aria-label="Nombre de mesa" placeholder="Ej. Mesa 01" value={newTable.name} onChange={(event) => onNewTableChange({ ...newTable, name: event.target.value })} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary" /></label><label className="text-xs font-bold text-muted-foreground">Código interno<input aria-label="Código de mesa" placeholder="Ej. W01" value={newTable.code} onChange={(event) => onNewTableChange({ ...newTable, code: event.target.value.toUpperCase() })} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm uppercase outline-none focus:border-primary" /></label><div className="flex items-end gap-2"><label className="min-w-0 flex-1 text-xs font-bold text-muted-foreground">Capacidad<input aria-label="Cantidad de puestos" type="number" min="1" max="99" placeholder="Ej. 4" value={newTable.seats} onChange={(event) => onNewTableChange({ ...newTable, seats: event.target.value })} className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary" /></label><Button onClick={onCreateTable} disabled={tableAction || !canCreateTables}>{tableAction ? <RefreshCw className="size-4 animate-spin" /> : <Check className="size-4" />}{tableAction ? 'Creando…' : 'Crear mesa'}</Button></div></div></div>}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 custom-scrollbar" role="tablist" aria-label="Zonas del salón">
        {zones.map((zone) => <button key={zone} type="button" role="tab" aria-selected={activeZone === zone} onClick={() => { onZoneChange(zone); onTableFilterChange('ALL'); }} className={`shrink-0 rounded-xl border px-4 py-2 text-sm font-bold transition ${activeZone === zone ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border/60 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'}`}>{zone === 'ALL' ? 'Todas' : zone}</button>)}
      </div>
      {tables.length === 0 ? <EmptyState icon={<LayoutGrid className="size-8" />} title="Aún no hay mesas configuradas" description="Crea la primera mesa para comenzar a operar el salón." action={canCreateTables ? <Button size="sm" onClick={onToggleTableForm}><Plus className="size-4" />Crear mesa</Button> : undefined} /> : visibleTables.length === 0 ? <EmptyState icon={<Search className="size-8" />} title="No hay mesas en este filtro" description="Cambia la zona o el indicador seleccionado para ver otras mesas." action={<Button variant="outline" size="sm" onClick={() => { onTableFilterChange('ALL'); onZoneChange('ALL'); }}>Limpiar filtros</Button>} /> : <div className="relative overflow-hidden rounded-[28px] border border-border/60 bg-[radial-gradient(circle_at_50%_20%,color-mix(in_srgb,var(--accent)_10%,transparent),transparent_48%),linear-gradient(145deg,var(--background),color-mix(in_srgb,var(--accent)_6%,var(--card)))] p-4 shadow-inner sm:p-6"><div className="pointer-events-none absolute inset-3 rounded-[22px] border-2 border-border/40" /><div className="pointer-events-none absolute left-1/2 top-0 h-full w-px bg-border/30" /><div className="relative grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">{visibleTables.map(({ table, tableOrders, status, total }) => { const baseStatus = tableStatus[table.status] || tableStatus.AVAILABLE; const derivedStatus = status === 'PREPARING' ? { label: 'En preparación', className: 'border-amber-200 bg-amber-50 text-amber-700' } : status === 'PAYMENT' ? { label: 'Por cobrar', className: 'border-violet-200 bg-violet-50 text-violet-700' } : baseStatus; const occupied = status === 'OCCUPIED' || status === 'PREPARING' || status === 'PAYMENT'; return <div key={table.id} className="relative flex items-center justify-center py-2"><button type="button" onClick={() => onSelectTable(table.id)} className={`group relative flex min-h-28 w-full max-w-36 flex-col items-center justify-center rounded-2xl border-2 px-2 py-3 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 ${selectedTableId === table.id ? 'border-primary bg-accent/20 ring-4 ring-primary/15' : occupied ? 'border-accent/60 bg-accent/10' : derivedStatus.label === 'Reservada' ? 'border-blue-300 bg-blue-50/70' : 'border-border/70 bg-card'}`}><span className="pointer-events-none absolute -top-2 left-1/2 h-3 w-9 -translate-x-1/2 rounded-full bg-current/20" /><span className="pointer-events-none absolute -bottom-2 left-1/2 h-3 w-9 -translate-x-1/2 rounded-full bg-current/20" /><span className="text-xl font-black tracking-tight">{table.code}</span><span className="mt-1 max-w-full truncate text-[11px] font-bold">{table.name}</span><span className="mt-1 text-[10px] text-muted-foreground">{table.seats} puestos · {tableOrders.length} {tableOrders.length === 1 ? 'comanda' : 'comandas'}</span><Badge className={`mt-2 text-[10px] ${derivedStatus.className}`}>{derivedStatus.label}</Badge><span className="mt-1 text-xs font-black text-accent">{total > 0 ? money(total) : 'Disponible'}</span></button>{canShareQr && <button type="button" onClick={(event) => { event.stopPropagation(); void onShowQr(table); }} className="absolute right-0 top-1 rounded-lg bg-card/90 p-1.5 text-muted-foreground shadow-sm transition hover:bg-primary hover:text-accent" title="Generar QR de la mesa" aria-label={`Generar QR de ${table.name}`}><QrCode className="size-3.5" /></button>}{canRotateQr && <button type="button" onClick={(event) => { event.stopPropagation(); void onRotateQr(table); }} className="absolute right-8 top-1 rounded-lg bg-card/90 p-1.5 text-muted-foreground shadow-sm transition hover:bg-primary hover:text-accent" title="Regenerar QR de la mesa" aria-label={`Regenerar QR de ${table.name}`}><RefreshCw className="size-3.5" /></button>}</div>; })}</div></div>}
    </section>
    <aside className="min-w-0 rounded-3xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
      {!selected ? <div className="flex min-h-[360px] flex-col items-center justify-center text-center"><span className="nh-restaurant-icon-tile flex size-14 items-center justify-center rounded-2xl"><LayoutGrid className="size-7" /></span><h3 className="mt-4 font-serif text-xl font-medium italic text-primary">Selecciona una mesa</h3><p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Aquí verás el consumo, las comandas y las acciones disponibles.</p></div> : <>
        <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="font-serif text-3xl font-medium italic text-primary">Mesa {selected.table.code}</h2><Badge className={selectedStatus?.className}>{selectedStatus?.label}</Badge></div><p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><span>⌖ {selected.table.zone || 'Salón principal'}</span><span>·</span><span>♟ {selectedGuests} personas</span></p></div><button type="button" aria-label="Cerrar detalle de mesa" onClick={() => onSelectTable('')} className="rounded-xl p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"><X className="size-5" /></button></div>
        <div className="mt-5 flex items-center justify-between rounded-2xl bg-muted/30 p-3"><span className="text-sm font-semibold">Comensales actuales</span><div className="flex items-center gap-2"><Button variant="outline" size="icon" className="size-8" onClick={() => setGuestCounts((current) => ({ ...current, [selected.table.id]: Math.max(1, selectedGuests - 1) }))} aria-label="Disminuir comensales">−</Button><span className="w-7 text-center font-black text-primary">{selectedGuests}</span><Button variant="outline" size="icon" className="size-8" onClick={() => setGuestCounts((current) => ({ ...current, [selected.table.id]: Math.min(selected.table.seats, selectedGuests + 1) }))} aria-label="Aumentar comensales">+</Button></div></div>{canEditTables && <div className="mt-3 grid gap-2 rounded-2xl border border-border/60 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_100px_auto]"><label className="text-xs font-bold text-muted-foreground">Nombre<input className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" value={tableDraft.name} onChange={(event) => setTableDraft((current) => ({ ...current, name: event.target.value }))} /></label><label className="text-xs font-bold text-muted-foreground">Zona<select className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" value={tableDraft.zone} onChange={(event) => setTableDraft((current) => ({ ...current, zone: event.target.value }))}>{selected.table.zone && !["Salón principal", "Terraza", "Área VIP", "Barra"].includes(selected.table.zone) && <option value={selected.table.zone}>{selected.table.zone}</option>}<option>Salón principal</option><option>Terraza</option><option>Área VIP</option><option>Barra</option></select></label><label className="text-xs font-bold text-muted-foreground">Puestos<input className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" type="number" min="1" max="99" value={tableDraft.seats} onChange={(event) => setTableDraft((current) => ({ ...current, seats: event.target.value }))} /></label><Button className="self-end" variant="outline" onClick={() => void saveTableDetails()} disabled={savingTableDetails || !tableDraft.name.trim()}><Check className="size-4" />Guardar mesa</Button></div>}{canChangeTableStatus && <div className="mt-3 flex flex-wrap items-end gap-2 rounded-2xl border border-border/60 p-3"><label className="min-w-0 flex-1 text-xs font-bold text-muted-foreground">Cambiar estado de mesa<select className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" value={nextTableStatus} onChange={(event) => setNextTableStatus(event.target.value as typeof nextTableStatus)}><option value="">Selecciona un estado</option><option value="RESERVED">Reservada</option><option value="CLEANING">En limpieza</option></select></label><Button variant="outline" onClick={() => { if (selected && nextTableStatus) void onChangeTableStatus(selected.table, nextTableStatus); }} disabled={!nextTableStatus}><Check className="size-4" />Actualizar estado</Button></div>}
        <div className="mt-5 grid grid-cols-3 border-b border-border/60" role="tablist" aria-label="Detalle de mesa"><button type="button" role="tab" aria-selected={detailTab === 'summary'} onClick={() => setDetailTab('summary')} className={`border-b-2 px-2 pb-3 text-xs font-bold ${detailTab === 'summary' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>Resumen</button><button type="button" role="tab" aria-selected={detailTab === 'orders'} onClick={() => setDetailTab('orders')} className={`border-b-2 px-2 pb-3 text-xs font-bold ${detailTab === 'orders' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>Comandas ({selected.tableOrders.length})</button>{canShareQr && <button type="button" role="tab" aria-selected={detailTab === 'qr'} onClick={() => setDetailTab('qr')} className={`border-b-2 px-2 pb-3 text-xs font-bold ${detailTab === 'qr' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>QR de mesa</button>}</div>
        {detailTab === 'summary' && <div className="mt-5 space-y-3"><div className="flex items-center justify-between rounded-xl bg-muted/30 p-3 text-sm"><span className="flex items-center gap-2 text-muted-foreground"><Clock3 className="size-4 text-primary" />Cuenta abierta</span><strong className="text-primary">{selected.tableOrders[0]?.createdAt ? new Date(selected.tableOrders[0].createdAt).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' }) : 'Sin consumo'}</strong></div><div className="flex items-center justify-between rounded-xl bg-muted/30 p-3 text-sm"><span className="flex items-center gap-2 text-muted-foreground"><CreditCard className="size-4 text-primary" />Consumo actual</span><strong className="text-accent">{money(selected.total)}</strong></div><div className="flex items-center justify-between rounded-xl bg-muted/30 p-3 text-sm"><span className="flex items-center gap-2 text-muted-foreground"><ChefHat className="size-4 text-primary" />Estado de cocina</span><Badge className={selected.preparing ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>{selected.preparing ? 'En preparación' : 'Sin comandas activas'}</Badge></div><div className="flex items-center justify-between rounded-xl bg-muted/30 p-3 text-sm"><span className="flex items-center gap-2 text-muted-foreground"><ClipboardList className="size-4 text-primary" />Comandas</span><strong className="text-primary">{selected.tableOrders.length}</strong></div></div>}
        {detailTab === 'orders' && <div className="mt-5 space-y-2">{selected.tableOrders.length === 0 ? <p className="rounded-xl bg-muted/30 p-3 text-sm text-muted-foreground">No hay comandas abiertas en esta mesa.</p> : selected.tableOrders.map((order) => <div key={order.id} className="rounded-xl border border-border/60 p-3"><div className="flex items-center justify-between gap-2"><span className="font-bold">{order.number}</span><Badge variant="outline">{orderStatus[order.status] || order.status}</Badge></div><div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{order.items.length} {order.items.length === 1 ? 'artículo' : 'artículos'}</span><span className="font-bold text-accent">{money(order.total, order.currency)}</span></div></div>)}</div>}
        {detailTab === 'qr' && canShareQr && <div className="mt-5 rounded-2xl border border-border/60 bg-muted/20 p-4 text-center"><span className="nh-restaurant-icon-tile mx-auto flex size-12 items-center justify-center rounded-xl"><QrCode className="size-6" /></span><h3 className="mt-3 font-serif text-lg font-medium italic text-primary">Código QR de la mesa</h3><p className="mt-1 text-xs text-muted-foreground">Permite ver la carta y enviar comandas desde el celular.</p>{canShareQr && <Button className="mt-4 w-full" onClick={() => void onShowQr(selected.table)}><QrCode className="size-4" />Ver QR de mesa</Button>}</div>}
        <Button className="mt-5 w-full" onClick={() => onOpenPos(selected.table.id)}><ShoppingBag className="size-4" />Abrir POS</Button>
        <div className="mt-2 grid grid-cols-2 gap-2">{canShareQr && <Button variant="outline" onClick={() => void onShowQr(selected.table)}><QrCode className="size-4" />Compartir QR</Button>}{canRotateQr && <Button variant="outline" onClick={() => void onRotateQr(selected.table)}><RefreshCw className="size-4" />Regenerar QR</Button>}{canCloseTables && <Button variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => void onCloseTable(selected.table)} disabled={selected.tableOrders.length > 0}><X className="size-4" />Cerrar mesa</Button>}</div>
      </>}
    </aside>
  </div>;
}

interface RestaurantPosViewProps {
  tables: RestaurantTable[];
  selectedTable: RestaurantTable | null;
  orders: RestaurantOrder[];
  menu: RestaurantMenuCategory[];
  cartLines: Array<{ key: string; item: RestaurantMenuItem; quantity: number; selectedOptions: RestaurantSelectedOptions }>;
  cartTotal: number;
  canCreateOrders: boolean;
  canAddOrderItems: boolean;
  canSendToKitchen: boolean;
  canPayOrders: boolean;
  kitchenEnabled: boolean;
  pendingAction: 'save' | 'send' | 'charge' | 'round' | null;
  orderType: RestaurantOrderType;
  availableOrderTypes: RestaurantOrderType[];
  menuSearch: string;
  activeCategoryId: string;
  orderNotes: string;
  deliveryAddress: string;
  deliveryReference: string;
  onMenuSearchChange: (value: string) => void;
  onOrderTypeChange: (value: RestaurantOrderType) => void;
  onCategoryChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onDeliveryAddressChange: (value: string) => void;
  onDeliveryReferenceChange: (value: string) => void;
  onSelectTable: (tableId: string) => void;
  onAddItem: (itemId: string) => void;
  onRemoveLine: (key: string) => void;
  onCreateOrder: (sendToKitchen?: boolean, checkoutAfterCreate?: boolean) => Promise<void>;
  onAddToOrder: (order: RestaurantOrder, sendToKitchen?: boolean, checkoutAfterAdd?: boolean) => Promise<void>;
  onCheckout: (order: RestaurantOrder) => Promise<void>;
}

function RestaurantPosView({ tables, selectedTable, orders, menu, cartLines, cartTotal, canCreateOrders, canAddOrderItems, canSendToKitchen, canPayOrders, kitchenEnabled, pendingAction, orderType, availableOrderTypes, menuSearch, activeCategoryId, orderNotes, deliveryAddress, deliveryReference, onMenuSearchChange, onOrderTypeChange, onCategoryChange, onNotesChange, onDeliveryAddressChange, onDeliveryReferenceChange, onSelectTable, onNewOrder, onAddItem, onRemoveLine, onCreateOrder, onAddToOrder, onCheckout }: RestaurantPosViewProps) {
  const normalizedSearch = menuSearch.trim().toLocaleLowerCase('es');
  const filteredCategories = useMemo(() => menu.map((category) => ({ ...category, items: category.items.filter((item) => item.isAvailable && (!normalizedSearch || `${item.name} ${item.description || ''}`.toLocaleLowerCase('es').includes(normalizedSearch))) })).filter((category) => activeCategoryId === 'ALL' || category.id === activeCategoryId).filter((category) => category.items.length > 0), [activeCategoryId, menu, normalizedSearch]);
  const tableOrders = orders.filter((order) => selectedTable && order.table?.id === selectedTable.id);
  const openAccount = tableOrders.find(restaurantOrderIsOperational);
  const openAccountForItems = openAccount && openAccount.status !== 'PAID' ? openAccount : null;
  const [guestCount, setGuestCount] = useState(Math.min(selectedTable?.seats || 2, 4));
  useEffect(() => setGuestCount(Math.min(selectedTable?.seats || 2, 4)), [selectedTable?.id, selectedTable?.seats]);

  const canCreateCurrentOrder = (orderType !== 'DINE_IN' || Boolean(selectedTable)) && cartLines.length > 0 && canCreateOrders;
  const canAddCurrentItem = orderType === 'DINE_IN' && openAccountForItems ? canAddOrderItems : canCreateOrders;
  const canSendCurrentOrderToKitchen = canSendToKitchen && (orderType === 'DINE_IN' && openAccountForItems ? canAddOrderItems : canCreateOrders);
  const chargeableOpenAccount = openAccount && restaurantOrderNeedsPayment(openAccount) && restaurantOrderIsReady(openAccount);
  const canChargeCurrentOrder = canPayOrders
    && (orderType === 'DINE_IN' && openAccountForItems ? canAddOrderItems : canCreateOrders)
    && (orderType !== 'DINE_IN' || Boolean(chargeableOpenAccount));

  return <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,390px)]" data-tour="restaurant-pos">
    <div className="min-w-0 rounded-3xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
       <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Cuenta actual</p><h2 className="font-serif text-2xl font-medium italic text-primary">Orden actual</h2><p className="mt-1 text-xs text-muted-foreground">POS independiente · puedes vender sin mesa.</p></div><div className="flex flex-wrap items-center justify-end gap-2"><Button variant="outline" size="sm" onClick={onNewOrder} disabled={Boolean(pendingAction)}><Plus className="size-4" />Nueva orden</Button><label className="sr-only" htmlFor="restaurant-pos-type">Tipo de venta</label><select id="restaurant-pos-type" value={orderType} onChange={(event) => onOrderTypeChange(event.target.value as RestaurantOrderType)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-primary">{availableOrderTypes.map((type) => <option key={type} value={type}>{type === 'TAKEAWAY' ? 'Mostrador / retiro' : restaurantOrderTypeLabel(type)}</option>)}</select>{orderType === 'DINE_IN' && <><label className="sr-only" htmlFor="restaurant-pos-table">Mesa</label><select id="restaurant-pos-table" value={selectedTable?.id || ''} onChange={(event) => onSelectTable(event.target.value)} className="h-10 max-w-[190px] rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-primary"><option value="">Seleccionar mesa</option>{tables.filter((table) => table.isActive !== false).map((table) => <option key={table.id} value={table.id}>Mesa {table.code} · {table.name}</option>)}</select><label className="sr-only" htmlFor="restaurant-pos-guests">Comensales</label><select id="restaurant-pos-guests" value={guestCount} onChange={(event) => setGuestCount(Number(event.target.value))} className="h-10 rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:border-primary">{Array.from({ length: Math.max(4, selectedTable?.seats || 4) }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value} {value === 1 ? 'comensal' : 'comensales'}</option>)}</select></>}</div></div>
       {!selectedTable && orderType === 'DINE_IN' && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Selecciona una mesa para crear una cuenta de salón. Mostrador y delivery pueden operar sin mesa.</div>}
      {orderType === 'DELIVERY' && <div className="mb-4 grid gap-2 rounded-2xl border border-primary/15 bg-primary/[0.03] p-3 sm:grid-cols-2"><Input value={deliveryAddress} onChange={(event) => onDeliveryAddressChange(event.target.value)} placeholder="Dirección de entrega" aria-label="Dirección de entrega" /><Input value={deliveryReference} onChange={(event) => onDeliveryReferenceChange(event.target.value)} placeholder="Referencia / indicaciones" aria-label="Referencia de entrega" /></div>}
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={menuSearch} onChange={(event) => onMenuSearchChange(event.target.value)} placeholder="Buscar platillos, bebidas o extras…" className="h-11 pl-10" aria-label="Buscar en la carta" /></div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 custom-scrollbar" role="tablist" aria-label="Categorías de la carta"><button type="button" role="tab" aria-selected={activeCategoryId === 'ALL'} onClick={() => onCategoryChange('ALL')} className={`flex min-w-20 shrink-0 flex-col items-center gap-1 rounded-2xl border px-3 py-2 text-xs font-bold transition ${activeCategoryId === 'ALL' ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border/60 bg-background hover:border-primary/40'}`}><LayoutGrid className="size-4" />Todos</button>{menu.map((category) => { const CategoryIcon = restaurantCategoryIcon(category.name); return <button key={category.id} type="button" role="tab" aria-selected={activeCategoryId === category.id} onClick={() => onCategoryChange(category.id)} className={`flex min-w-20 shrink-0 flex-col items-center gap-1 rounded-2xl border px-3 py-2 text-xs font-bold transition ${activeCategoryId === category.id ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border/60 bg-background hover:border-primary/40'}`}><CategoryIcon className="size-4" />{category.name}</button>; })}</div>
      <div className="mt-4 max-h-[min(62vh,680px)] overflow-y-auto pr-1"><div className="grid grid-cols-2 gap-3 md:grid-cols-3">{filteredCategories.flatMap((category) => category.items).map((item) => <button key={item.id} type="button" onClick={() => onAddItem(item.id)} disabled={!canAddCurrentItem} className="group overflow-hidden rounded-2xl border border-border/60 bg-background text-left transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md">{item.imageUrl ? <img src={item.imageUrl} alt="" className="aspect-[1.45] w-full object-cover" loading="lazy" /> : <div className="flex aspect-[1.45] items-center justify-center bg-accent/20 text-primary"><Utensils className="size-8 transition-transform group-hover:scale-110" /></div>}<div className="p-3"><p className="truncate text-sm font-bold">{item.name}</p><p className="mt-1 line-clamp-2 min-h-8 text-xs text-muted-foreground">{item.description || item.prepStation}{item.options?.length ? ' · Personalizable' : ''}</p><div className="mt-3 flex items-center justify-between gap-2"><span className="font-black text-primary">{item.options?.length ? 'Desde ' : ''}{money(item.price, item.currency)}</span><span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground"><Plus className="size-4" /></span></div></div></button>)}{filteredCategories.length === 0 && <div className="col-span-full"><EmptyState icon={<Utensils className="size-8" />} title="No encontramos ese platillo" description="Prueba otra búsqueda o revisa la disponibilidad en Carta." /></div>}</div></div>
    </div>

    <aside className="min-w-0 rounded-3xl border border-border/60 bg-card p-4 shadow-sm sm:p-5 xl:sticky xl:top-4 xl:self-start"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Cuenta actual</p><h2 className="mt-1 font-serif text-2xl font-medium italic text-primary">{selectedTable ? `Mesa ${selectedTable.code}` : orderType === 'DELIVERY' ? 'Venta delivery' : 'Venta de mostrador'}</h2><p className="mt-1 text-sm text-muted-foreground">{selectedTable?.name || (orderType === 'DINE_IN' ? 'Selecciona una mesa para comenzar' : 'Sin mesa · operación independiente')}</p></div><span className="flex size-10 items-center justify-center rounded-xl bg-accent/20 text-primary"><ShoppingBag className="size-5" /></span></div>
       {selectedTable && tableOrders.length > 0 && <div className="mt-4 rounded-2xl border border-border/60 bg-muted/20 p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cuenta abierta y rondas</p><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{tableOrders.length}</span></div><div className="mt-2 space-y-2">{tableOrders.map((order) => <div key={order.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl p-2 ${openAccount?.id === order.id ? 'bg-primary/[0.06]' : ''}`}><span>{order.number} · {orderStatus[order.status] || order.status}</span><div className="flex items-center gap-2"><span className="font-bold">{money(order.total, order.currency)}</span>{canAddOrderItems && canSendToKitchen && order.status !== 'PAID' && openAccount?.id === order.id && cartLines.length > 0 && <Button variant="outline" size="sm" onClick={() => void onAddToOrder(order, true)}><Send className="size-3" />Agregar ronda</Button>}{canPayOrders && restaurantOrderNeedsPayment(order) && restaurantOrderIsReady(order) && <Button variant="outline" size="sm" onClick={() => void onCheckout(order)}>Cobrar</Button>}</div></div>)}</div></div>}
      <div className="mt-4 border-t border-border/60 pt-4">{cartLines.length === 0 ? <p className="rounded-2xl bg-muted/30 p-4 text-sm text-muted-foreground">Agrega platillos desde la carta. Si un producto tiene tamaños o extras, NovaHub abrirá su panel de personalización.</p> : <div className="space-y-3">{cartLines.map(({ key, item, quantity, selectedOptions }) => <div key={key} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background p-3"><div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-accent/20 text-primary">{item.imageUrl ? <img src={item.imageUrl} alt="" className="size-full object-cover" loading="lazy" /> : <Utensils className="size-5" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{quantity} × {item.name}</p>{restaurantOptionLabel(item, selectedOptions) && <p className="mt-1 truncate text-xs text-muted-foreground">{restaurantOptionLabel(item, selectedOptions)}</p>}<p className="mt-1 text-xs font-black text-primary">{money((Number(item.price) + restaurantOptionPrice(item, selectedOptions)) * quantity, item.currency)}</p></div><button type="button" aria-label={`Quitar una unidad de ${item.name}`} onClick={() => onRemoveLine(key)} disabled={!canAddCurrentItem} className="rounded-xl border border-border/60 bg-card px-3 py-2 text-sm font-black text-primary hover:border-primary/40">−</button></div>)}</div>}</div>
      <div className="mt-4"><label className="text-xs font-bold text-muted-foreground" htmlFor="restaurant-order-notes">Nota para cocina</label><textarea id="restaurant-order-notes" value={orderNotes} onChange={(event) => onNotesChange(event.target.value)} placeholder="Ej. Sin cebolla, entregar todo junto…" rows={2} className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary" /></div>
      <div className="mt-4 grid gap-4 border-t border-border/60 pt-4 sm:grid-cols-[1fr_auto] sm:items-end"><div><p className="text-xs font-medium text-muted-foreground">Total de la orden</p><p className="mt-1 text-2xl font-black text-primary">{money(cartTotal)}</p></div><div className="grid grid-cols-3 gap-2">{canCreateOrders && <Button variant="outline" className="min-w-24" disabled={!canCreateCurrentOrder || Boolean(pendingAction)} onClick={() => void onCreateOrder(false)}>{pendingAction === 'save' ? <RefreshCw className="size-4 animate-spin" /> : null}{pendingAction === 'save' ? 'Guardando…' : 'Guardar'}</Button>}{kitchenEnabled && canSendCurrentOrderToKitchen && <Button variant="outline" className="min-w-32" disabled={!canSendCurrentOrderToKitchen || cartLines.length === 0 || Boolean(pendingAction)} onClick={() => void (openAccountForItems && orderType === 'DINE_IN' ? onAddToOrder(openAccountForItems, true) : onCreateOrder(true))}>{pendingAction === 'send' || pendingAction === 'round' ? <RefreshCw className="size-4 animate-spin" /> : <Send className="size-4" />}{pendingAction === 'send' || pendingAction === 'round' ? 'Enviando…' : 'Enviar a cocina'}</Button>}{openAccountForItems && orderType === 'DINE_IN' && canAddOrderItems && <Button variant="outline" className="min-w-28" disabled={cartLines.length === 0 || Boolean(pendingAction)} onClick={() => void onAddToOrder(openAccountForItems, false)}>Agregar ronda</Button>}{canChargeCurrentOrder && <Button className="min-w-28" disabled={!canChargeCurrentOrder || cartLines.length === 0 || Boolean(pendingAction)} onClick={() => void (openAccountForItems && orderType === 'DINE_IN' ? onAddToOrder(openAccountForItems, false, true) : onCreateOrder(false, true))}>{pendingAction === 'charge' ? <RefreshCw className="size-4 animate-spin" /> : <CreditCard className="size-4" />}{pendingAction === 'charge' ? 'Procesando…' : 'Cobrar'}</Button>}</div></div>
    </aside>
  </section>;
}

function NoAccessState() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-card p-8 text-center shadow-sm">
        <div className="nh-restaurant-icon-tile mx-auto flex size-14 items-center justify-center rounded-2xl">
          <ShieldAlert className="size-7" />
        </div>
        <h2 className="mt-5 text-xl font-black">Restaurante POS no está habilitado</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Solicita al SuperAdmin o al administrador de tu empresa que active el módulo y los permisos correspondientes.
        </p>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center"><div className="mb-3 rounded-2xl bg-card p-3 text-muted-foreground/50 shadow-sm">{icon}</div><p className="font-black text-foreground">{title}</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

function RestaurantMetricCard({ label, value, hint, icon: Icon }: { label: string; value: string | number; hint: string; icon: React.ElementType }) {
  return <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm"><div className="flex items-center gap-3"><span className="nh-restaurant-icon-tile flex size-10 shrink-0 items-center justify-center rounded-xl"><Icon className="size-5" /></span><div className="min-w-0"><p className="text-sm font-semibold text-foreground">{label}</p><p className="mt-1 text-2xl font-black tracking-tight text-accent">{value}</p></div></div><p className="mt-2 text-xs text-muted-foreground">{hint}</p></div>;
}

type RestaurantOrderBoardProps = { orders: RestaurantOrder[]; targetOrderId?: string | null; onTargetHandled?: () => void; onSend: (order: RestaurantOrder) => void; onStatus: (order: RestaurantOrder, status: string) => void; onCheckout: (order: RestaurantOrder) => void; onOpenDetail: (order: RestaurantOrder) => void; canSendToKitchen: boolean; canServeOrder: boolean; canConfirmOrders: boolean; canCancelOrders: boolean; canPayOrders: boolean; sendingOrderIds: Set<string> };

function OrderBoard(props: RestaurantOrderBoardProps) {
  return <OrderBoardContent {...props} />;
  /*
  const orderedOrders = useMemo(() => [...orders].sort((left, right) => {
    const leftTime = new Date(left.createdAt || left.sentAt || 0).getTime();
    const rightTime = new Date(right.createdAt || right.sentAt || 0).getTime();
    if (leftTime !== rightTime) return rightTime - leftTime;
    return left.number.localeCompare(right.number, undefined, { numeric: true });
  }), [orders]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(orderedOrders[0]?.id || null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'IN_PROGRESS' | 'KITCHEN' | 'READY' | 'DELIVERY' | 'TAKEAWAY'>('ALL');
  useEffect(() => {
    if (targetOrderId) {
      setSelectedOrderId(targetOrderId);
      onTargetHandled?.();
    } else if (!selectedOrderId || !orderedOrders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(orderedOrders[0]?.id || null);
    }
  }, [orderedOrders, onTargetHandled, selectedOrderId, targetOrderId]);

  const visibleOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es');
    return orderedOrders.filter((order) => {
      const matchesFilter = filter === 'ALL' || (filter === 'IN_PROGRESS' && !['PAID', 'CANCELLED', 'READY', 'SERVED'].includes(order.status)) || (filter === 'KITCHEN' && ['SENT_TO_KITCHEN', 'IN_PREPARATION'].includes(order.status)) || (filter === 'READY' && ['READY', 'SERVED'].includes(order.status)) || (filter === 'DELIVERY' && order.type === 'DELIVERY') || (filter === 'TAKEAWAY' && order.type === 'TAKEAWAY');
      if (!matchesFilter) return false;
      if (!normalizedQuery) return true;
      return [order.number, order.table?.code, order.table?.name, order.customerName, order.customerPhone, ...order.items.map((item) => item.description)].filter(Boolean).join(' ').toLocaleLowerCase('es').includes(normalizedQuery);
    });
  }, [filter, orderedOrders, query]);
  const selectedOrder = orderedOrders.find((order) => order.id === selectedOrderId) || null;

  const metrics = [
    { label: 'Pedidos activos', value: orderedOrders.filter((order) => !['PAID', 'CANCELLED'].includes(order.status)).length, hint: 'Cuentas abiertas hoy', icon: ClipboardList },
    { label: 'En cocina', value: orderedOrders.filter((order) => ['SENT_TO_KITCHEN', 'IN_PREPARATION'].includes(order.status)).length, hint: 'en preparación', icon: ChefHat },
    { label: 'Listas', value: orderedOrders.filter((order) => ['READY', 'SERVED'].includes(order.status)).length, hint: 'listas para servir', icon: Check },
    { label: 'Delivery', value: orderedOrders.filter((order) => order.type === 'DELIVERY').length, hint: 'pedidos a domicilio', icon: Truck },
    { label: 'Retiro', value: orderedOrders.filter((order) => order.type === 'TAKEAWAY').length, hint: 'para llevar', icon: ShoppingBag },
  ];

 return <section className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metrics.map((metric) => <RestaurantMetricCard key={metric.label} {...metric} />)}</div><section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm"><div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Operación comercial</p><h2 className="mt-1 font-serif text-2xl font-medium italic text-primary">Comandas</h2><p className="mt-1 text-sm text-muted-foreground">Consulta cuentas abiertas, estados, canales y modificaciones.</p></div><ClipboardList className="size-6 text-primary" /></div>{orderedOrders.length === 0 ? <EmptyState icon={<ClipboardList className="size-8" />} title="No hay comandas" description="Las comandas creadas desde Salón y POS aparecerán aquí." /> : <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.6fr)]"><div className="min-w-0 rounded-2xl border border-border/60 bg-background p-4"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por número, cliente o producto…" aria-label="Buscar comandas" className="h-11 pl-10" /></div><div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtros de comandas">{([{ id: 'ALL', label: `Todas (${orderedOrders.length})` }, { id: 'IN_PROGRESS', label: 'En curso' }, { id: 'KITCHEN', label: 'En cocina' }, { id: 'READY', label: 'Listas' }, { id: 'DELIVERY', label: 'Delivery' }, { id: 'TAKEAWAY', label: 'Retiro' }] as const).map((item) => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} onClick={() => setFilter(item.id)} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold ${filter === item.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 text-muted-foreground hover:border-primary/40'}`}>{item.label}</button>)}</div><div className="mt-4 hidden grid-cols-[92px_1fr_115px_85px_90px] gap-3 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground md:grid"><span>Comanda</span><span>Mesa / cliente</span><span>Hora</span><span>Estado</span><span className="text-right">Total</span></div><div className="mt-2 space-y-2">{visibleOrders.length === 0 ? <EmptyState icon={<Search className="size-7" />} title="No hay resultados" description="Cambia el filtro o la búsqueda para ver otras comandas." /> : visibleOrders.map((order, index) => <button id={`restaurant-order-${order.id}`} key={order.id} type="button" onClick={() => setSelectedOrderId(order.id)} className={`grid w-full items-center gap-3 rounded-xl border p-3 text-left transition md:grid-cols-[92px_1fr_115px_85px_90px] ${selectedOrder?.id === order.id ? 'border-primary bg-accent/10 ring-2 ring-primary/10' : 'border-border/60 bg-card hover:border-primary/40'}`}><span><span className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-full bg-primary text-[10px] font-black text-accent">{index + 1}</span><strong>{order.number}</strong></span><small className="mt-1 block text-[10px] text-muted-foreground">{order.type === 'DELIVERY' ? 'Delivery' : order.type === 'TAKEAWAY' ? 'Retiro' : 'Salón'}</small></span><span className="min-w-0"><strong className="block truncate text-sm">{order.table ? `Mesa ${order.table.code}` : order.customerName || 'Mostrador'}</strong><small className="block truncate text-xs text-muted-foreground">{order.table?.name || order.customerName || `${order.items.length} productos`}</small></span><span className="text-xs text-muted-foreground">{order.createdAt ? new Date(order.createdAt).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' }) : '—'}</span><Badge variant="outline" className="w-fit">{orderStatus[order.status] || order.status}</Badge><span className="text-right text-sm font-black text-accent">{money(order.total, order.currency)}</span></button>)}</div></div><aside className="min-w-0 rounded-2xl border border-border/60 bg-card p-5">{!selectedOrder ? <EmptyState icon={<ClipboardList className="size-7" />} title="Selecciona una comanda" description="Aquí verás productos, historial y acciones." /> : <><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="font-serif text-2xl font-medium italic text-primary">Comanda {selectedOrder.number}</h3><Badge variant="outline">{orderStatus[selectedOrder.status] || selectedOrder.status}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{selectedOrder.table ? `Mesa ${selectedOrder.table.code} · ${selectedOrder.table.name}` : selectedOrder.type} · {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' }) : '—'}</p></div><button type="button" aria-label="Abrir detalle completo" onClick={() => onOpenDetail(selectedOrder)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><Eye className="size-5" /></button></div><div className="mt-5 flex items-center justify-between"><h4 className="font-semibold">Productos ({selectedOrder.items.length})</h4><span className="text-lg font-black text-accent">{money(selectedOrder.total, selectedOrder.currency)}</span></div><div className="mt-3 space-y-2">{selectedOrder.items.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-muted/30 p-3 text-sm"><span>{Number(item.quantity)} × {item.description}{restaurantSnapshotLabel(item.options) && <small className="block text-xs text-muted-foreground">{restaurantSnapshotLabel(item.options)}</small>}</span><strong className="shrink-0 text-primary">{money(item.total, selectedOrder.currency)}</strong></div>)}</div>{selectedOrder.notes && <div className="mt-4 rounded-xl bg-muted/30 p-3 text-sm"><p className="font-semibold">Notas de la comanda</p><p className="mt-1 text-muted-foreground">{selectedOrder.notes}</p></div>}<div className="mt-5 border-t border-border/60 pt-4"><h4 className="font-semibold">Historial</h4><div className="mt-3 space-y-2">{(selectedOrder.events || []).slice(-4).map((event) => <div key={event.id} className="flex gap-2 text-xs"><span className="mt-1 size-2 shrink-0 rounded-full bg-accent" /><span><strong>{event.message || event.type}</strong><span className="ml-2 text-muted-foreground">{new Date(event.createdAt).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' })}</span></span></div>)}</div></div><div className="mt-5 grid gap-2 sm:grid-cols-2">{canSendToKitchen && ['CONFIRMED', 'PENDING_CONFIRMATION'].includes(selectedOrder.status) && <Button onClick={() => onSend(selectedOrder)}><Send className="size-4" />Reenviar a cocina</Button>}{canPayOrders && (['READY', 'SERVED'].includes(selectedOrder.status) || (selectedOrder.status === 'CONFIRMED' && ['TAKEAWAY', 'DELIVERY'].includes(selectedOrder.type))) && <Button onClick={() => onCheckout(selectedOrder)}><CreditCard className="size-4" />Cobrar</Button>}{canServeOrder && selectedOrder.status === 'READY' && <Button variant="outline" onClick={() => onStatus(selectedOrder, 'SERVED')}><Check className="size-4" />Marcar servido</Button>}<Button variant="outline" onClick={() => onOpenDetail(selectedOrder)}>Ver cuenta</Button></div></>}</div></aside>}</div>}</section></section>;
}

*/ }

function OrderBoardContent({ orders, targetOrderId, onTargetHandled, onSend, onStatus, onCheckout, onOpenDetail, canSendToKitchen, canServeOrder, canConfirmOrders, canCancelOrders, canPayOrders, sendingOrderIds }: RestaurantOrderBoardProps) {
  const orderedOrders = useMemo(() => [...orders].sort((left, right) => {
    const leftTime = new Date(left.createdAt || left.sentAt || 0).getTime();
    const rightTime = new Date(right.createdAt || right.sentAt || 0).getTime();
    if (leftTime !== rightTime) return rightTime - leftTime;
    return right.number.localeCompare(left.number, undefined, { numeric: true });
  }), [orders]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(orderedOrders[0]?.id || null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'IN_PROGRESS' | 'KITCHEN' | 'READY' | 'DELIVERY' | 'TAKEAWAY'>('ALL');

  useEffect(() => {
    if (targetOrderId) {
      setSelectedOrderId(targetOrderId);
      onTargetHandled?.();
    } else if (!selectedOrderId || !orderedOrders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(orderedOrders[0]?.id || null);
    }
  }, [onTargetHandled, orderedOrders, selectedOrderId, targetOrderId]);

  const visibleOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es');
    return orderedOrders.filter((order) => {
      const matchesFilter = filter === 'ALL'
        || (filter === 'IN_PROGRESS' && restaurantOrderIsOperational(order) && !restaurantOrderIsReady(order))
        || (filter === 'KITCHEN' && restaurantOrderPreparationIsOpen(order))
        || (filter === 'READY' && restaurantOrderIsReady(order))
        || (filter === 'DELIVERY' && order.type === 'DELIVERY')
        || (filter === 'TAKEAWAY' && order.type === 'TAKEAWAY');
      if (!matchesFilter) return false;
      if (!normalizedQuery) return true;
      return [order.number, order.table?.code, order.table?.name, order.customerName, order.customerPhone, ...order.items.map((item) => item.description)]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('es')
        .includes(normalizedQuery);
    });
  }, [filter, orderedOrders, query]);

  const selectedOrder = orderedOrders.find((order) => order.id === selectedOrderId) || null;
  const filters = [
    { id: 'ALL' as const, label: `Todas (${orderedOrders.length})` },
    { id: 'IN_PROGRESS' as const, label: 'En curso' },
    { id: 'KITCHEN' as const, label: 'En preparación' },
    { id: 'READY' as const, label: 'Listas' },
    { id: 'DELIVERY' as const, label: 'Delivery' },
    { id: 'TAKEAWAY' as const, label: 'Retiro' },
  ];
  const metrics = [
    { label: 'Pedidos activos', value: orderedOrders.filter(restaurantOrderIsOperational).length, hint: 'Cuentas abiertas hoy', icon: ClipboardList },
    { label: 'En cocina', value: orderedOrders.filter(restaurantOrderPreparationIsOpen).length, hint: 'en preparación', icon: ChefHat },
    { label: 'Listas', value: orderedOrders.filter(restaurantOrderIsReady).length, hint: 'listas para servir', icon: Check },
    { label: 'Delivery', value: orderedOrders.filter((order) => order.type === 'DELIVERY').length, hint: 'pedidos a domicilio', icon: Truck },
    { label: 'Retiro', value: orderedOrders.filter((order) => order.type === 'TAKEAWAY').length, hint: 'para llevar', icon: ShoppingBag },
  ];

  return (
    <section className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => <RestaurantMetricCard key={metric.label} {...metric} />)}
      </div>
      <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        {orderedOrders.length === 0 ? <EmptyState icon={<ClipboardList className="size-8" />} title="No hay comandas" description="Las comandas creadas desde Salón y POS aparecerán aquí." /> : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.6fr)]">
            <div className="min-w-0 rounded-2xl border border-border/60 bg-background p-4">
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por número, cliente o producto…" aria-label="Buscar comandas" className="h-11 pl-10" /></div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtros de comandas">
                {filters.map((item) => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} onClick={() => setFilter(item.id)} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold ${filter === item.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 text-muted-foreground hover:border-primary/40'}`}>{item.label}</button>)}
              </div>
              <div className="mt-4 hidden grid-cols-[74px_78px_minmax(140px,1fr)_90px_78px_95px_90px] gap-3 px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground md:grid"><span># Pedido</span><span>Canal</span><span>Mesa / cliente</span><span>Hora</span><span>Productos</span><span>Estado</span><span className="text-right">Total</span></div>
              <div className="mt-2 space-y-2">
                {visibleOrders.length === 0 ? <EmptyState icon={<Search className="size-7" />} title="No hay resultados" description="Cambia el filtro o la búsqueda para ver otras comandas." /> : visibleOrders.map((order) => (
                  <button id={`restaurant-order-${order.id}`} key={order.id} type="button" onClick={() => setSelectedOrderId(order.id)} className={`grid w-full items-center gap-3 rounded-xl border p-3 text-left transition md:grid-cols-[74px_78px_minmax(140px,1fr)_90px_78px_95px_90px] ${selectedOrder?.id === order.id ? 'border-primary bg-accent/10 ring-2 ring-primary/10' : 'border-border/60 bg-card hover:border-primary/40'}`}>
                    <span className="font-black text-primary">#{order.number}</span>
                    <span className="text-xs font-semibold text-primary">{order.type === 'DELIVERY' ? 'Delivery' : order.type === 'TAKEAWAY' ? 'Retiro' : order.type === 'ROOM_SERVICE' ? 'Habitación' : 'Salón'}</span>
                    <span className="min-w-0"><strong className="block truncate text-sm">{order.table ? `Mesa ${order.table.code}` : order.customerName || 'Mostrador'}</strong><small className="block truncate text-xs text-muted-foreground">{order.table?.name || order.customerName || order.customerPhone || 'Venta directa'}</small></span>
                    <span className="text-xs text-muted-foreground">{order.createdAt ? new Date(order.createdAt).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                    <span className="text-xs text-muted-foreground">{order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} {order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) === 1 ? 'producto' : 'productos'}</span>
                    <Badge variant="outline" className="w-fit">{orderStatus[order.status] || order.status}</Badge>
                    <span className="text-right text-sm font-black text-accent">{money(order.total, order.currency)}</span>
                  </button>
                ))}
              </div>
            </div>
            <aside className="min-w-0 rounded-2xl border border-border/60 bg-card p-5">
              {!selectedOrder ? <EmptyState icon={<ClipboardList className="size-7" />} title="Selecciona una comanda" description="Aquí verás productos, historial y acciones." /> : (
                <>
                  <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="font-serif text-2xl font-medium italic text-primary">Comanda {selectedOrder.number}</h3><Badge variant="outline">{orderStatus[selectedOrder.status] || selectedOrder.status}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{selectedOrder.table ? `Mesa ${selectedOrder.table.code} · ${selectedOrder.table.name}` : selectedOrder.type} · {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' }) : '—'}</p></div><button type="button" aria-label="Abrir detalle completo" onClick={() => onOpenDetail(selectedOrder)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><Eye className="size-5" /></button></div>
                  <div className="mt-5 flex items-center justify-between"><h4 className="font-semibold">Productos ({selectedOrder.items.length})</h4><span className="text-lg font-black text-accent">{money(selectedOrder.total, selectedOrder.currency)}</span></div>
                  <div className="mt-3 space-y-2">{selectedOrder.items.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl bg-muted/30 p-3 text-sm"><span>{Number(item.quantity)} × {item.description}{restaurantSnapshotLabel(item.options) && <small className="block text-xs text-muted-foreground">{restaurantSnapshotLabel(item.options)}</small>}</span><strong className="shrink-0 text-primary">{money(item.total, selectedOrder.currency)}</strong></div>)}</div>
                  {selectedOrder.notes && <div className="mt-4 rounded-xl bg-muted/30 p-3 text-sm"><p className="font-semibold">Notas de la comanda</p><p className="mt-1 text-muted-foreground">{selectedOrder.notes}</p></div>}
                  <div className="mt-5 border-t border-border/60 pt-4"><h4 className="font-semibold">Historial</h4><div className="mt-3 space-y-2">{(selectedOrder.events || []).slice(-4).map((event) => <div key={event.id} className="flex gap-2 text-xs"><span className="mt-1 size-2 shrink-0 rounded-full bg-accent" /><span><strong>{event.message || event.type}</strong><span className="ml-2 text-muted-foreground">{new Date(event.createdAt).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' })}</span></span></div>)}</div></div>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">{canConfirmOrders && selectedOrder.status === 'PENDING_CONFIRMATION' && <Button variant="outline" onClick={() => onStatus(selectedOrder, 'CONFIRMED')}><Check className="size-4" />Confirmar comanda</Button>}{canCancelOrders && ['PENDING_CONFIRMATION', 'CONFIRMED'].includes(selectedOrder.status) && <Button variant="outline" className="border-rose-200 text-rose-600" onClick={() => onStatus(selectedOrder, 'CANCELLED')}><X className="size-4" />Cancelar comanda</Button>}{canSendToKitchen && restaurantOrderCanSendToKitchen(selectedOrder) && <Button onClick={() => onSend(selectedOrder)} disabled={sendingOrderIds.has(selectedOrder.id)}>{sendingOrderIds.has(selectedOrder.id) ? <RefreshCw className="size-4 animate-spin" /> : <Send className="size-4" />}{sendingOrderIds.has(selectedOrder.id) ? 'Enviando…' : 'Enviar a cocina'}</Button>}{canPayOrders && restaurantOrderNeedsPayment(selectedOrder) && (restaurantOrderIsReady(selectedOrder) || (selectedOrder.status === 'CONFIRMED' && ['TAKEAWAY', 'DELIVERY'].includes(selectedOrder.type))) && <Button onClick={() => onCheckout(selectedOrder)}><CreditCard className="size-4" />Cobrar</Button>}{canServeOrder && selectedOrder.status === 'READY' && <Button variant="outline" onClick={() => onStatus(selectedOrder, 'SERVED')}><Check className="size-4" />Marcar servido</Button>}<Button variant="outline" onClick={() => onOpenDetail(selectedOrder)}>Ver cuenta</Button></div>
                </>
              )}
            </aside>
          </div>
        )}
      </section>
    </section>
  );
}

function RestaurantOrderDetailDialog({ order, loading, onClose, onCheckout, canPayOrders }: { order: RestaurantOrder; loading: boolean; onClose: () => void; onCheckout: (order: RestaurantOrder) => void; canPayOrders: boolean }) {
  return <div className="nh-modal-root fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4" role="dialog" aria-modal="true" aria-labelledby="restaurant-order-detail-title"><div className="nh-modal-surface my-auto max-h-[min(92vh,calc(100dvh-2rem))] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border/60 bg-card p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Detalle de pedido</p><h2 id="restaurant-order-detail-title" className="mt-1 font-serif text-3xl font-medium italic">{order.number}</h2><p className="mt-1 text-sm text-muted-foreground">{order.table ? `Mesa ${order.table.code} · ${order.table.name}` : order.type} · {orderStatus[order.status] || order.status}</p></div><button type="button" onClick={onClose} className="size-9 rounded-xl p-2 text-muted-foreground hover:bg-muted" aria-label="Cerrar detalle"><X className="size-5" /></button></div>{loading ? <div className="flex min-h-40 items-center justify-center text-muted-foreground"><RefreshCw className="mr-2 size-4 animate-spin" />Cargando detalle…</div> : <><div className="mt-5 rounded-2xl border border-border/60 p-4"><h3 className="font-black">Productos y adiciones</h3><div className="mt-3 divide-y divide-border/60">{order.items.map((item) => <div key={item.id} className="flex items-start justify-between gap-4 py-3"><div><p className="font-bold">{Number(item.quantity)} × {item.description}</p>{restaurantSnapshotLabel(item.options) && <p className="mt-1 text-xs text-muted-foreground">{restaurantSnapshotLabel(item.options)}</p>}{item.notes && <p className="mt-1 text-xs text-muted-foreground">Nota: {item.notes}</p>}</div><div className="text-right"><Badge variant="outline">{kitchenStatus[item.status]?.label || orderStatus[item.status] || item.status}</Badge><p className="mt-1 font-black">{money(item.total, order.currency)}</p></div></div>)}</div><div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4"><span className="font-black">Total</span><span className="text-xl font-black text-primary">{money(order.total, order.currency)}</span></div></div><div className="mt-5 rounded-2xl border border-border/60 p-4"><div className="flex items-center justify-between"><h3 className="font-black">Historial</h3><Clock3 className="size-4 text-primary" /></div><div className="mt-3 space-y-3">{(order.events || []).length === 0 ? <p className="text-sm text-muted-foreground">Sin eventos disponibles.</p> : order.events?.map((event) => <div key={event.id} className="flex gap-3 text-sm"><span className="mt-1 size-2 shrink-0 rounded-full bg-primary" /><div><p className="font-semibold">{event.message || event.type}</p><p className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString('es-NI')}</p></div></div>)}</div></div><div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-border/60 pt-4"><Button variant="outline" onClick={onClose}>Cerrar</Button>{canPayOrders && restaurantOrderNeedsPayment(order) && restaurantOrderIsReady(order) && <Button onClick={() => onCheckout(order)}><CreditCard className="size-4" />Cobrar</Button>}</div></>}</div></div>;
}

type RestaurantKitchenBoardProps = { tickets: RestaurantKitchenTicket[]; averagePrepMinutes?: number | null; onStatus: (ticket: RestaurantKitchenTicket, status: string) => void; canStartPreparation: boolean; canMarkReady: boolean; canServe: boolean; canCancel: boolean };

function KitchenBoard({ tickets, averagePrepMinutes, onStatus, canStartPreparation, canMarkReady, canServe, canCancel }: RestaurantKitchenBoardProps) {
  const [station, setStation] = useState('ALL');
  const [search, setSearch] = useState('');
  const stations = useMemo(() => ['ALL', ...Array.from(new Set(tickets.map((ticket) => ticket.station).filter(Boolean)))], [tickets]);
  const normalizedSearch = search.trim().toLocaleLowerCase('es');
  const visibleTickets = useMemo(() => tickets.filter((ticket) => {
    if (station !== 'ALL' && ticket.station !== station) return false;
    if (!normalizedSearch) return true;
    const text = [ticket.order.number, ticket.order.table?.code, ticket.order.table?.name, ticket.station, ...ticket.items.map(({ item }) => item.description)].filter(Boolean).join(' ').toLocaleLowerCase('es');
    return text.includes(normalizedSearch);
  }), [normalizedSearch, station, tickets]);
  const metrics = [
    { label: 'Pendientes', value: visibleTickets.filter((ticket) => ticket.status === 'PENDING').length, hint: 'nuevas comandas', icon: ClipboardList },
    { label: 'En preparación', value: visibleTickets.filter((ticket) => ticket.status === 'IN_PREPARATION').length, hint: 'en proceso', icon: ChefHat },
    { label: 'Listos', value: visibleTickets.filter((ticket) => ticket.status === 'READY').length, hint: 'para entregar', icon: Check },
    { label: 'Tiempo promedio', value: averagePrepMinutes == null ? '—' : `${Math.round(averagePrepMinutes)} min`, hint: 'Por comanda', icon: Clock3 },
  ];
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map((metric) => <RestaurantMetricCard key={metric.label} {...metric} />)}</div><div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar" role="tablist" aria-label="Estaciones de cocina">{stations.map((item) => <button key={item} type="button" role="tab" aria-selected={station === item} onClick={() => setStation(item)} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-medium transition ${station === item ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 text-muted-foreground hover:border-primary/40'}`}>{item === 'ALL' ? 'Todas' : restaurantStationLabel(item)}</button>)}</div><div className="relative w-full sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar comanda, mesa o platillo…" aria-label="Buscar en cocina" className="h-10 pl-9" /></div></div><KitchenBoardCanvas tickets={visibleTickets} onStatus={onStatus} canStartPreparation={canStartPreparation} canMarkReady={canMarkReady} canServe={canServe} canCancel={canCancel} /></div>;
}

function KitchenBoardCanvas({ tickets, onStatus, canStartPreparation, canMarkReady, canServe, canCancel }: RestaurantKitchenBoardProps) {
  const columns = ['PENDING', 'IN_PREPARATION', 'READY'];
  const boardRef = useRef<HTMLElement | null>(null);
  const [tvMode, setTvMode] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const orderedTickets = useMemo(() => [...tickets].sort((left, right) => new Date(left.sentAt || 0).getTime() - new Date(right.sentAt || 0).getTime()), [tickets]);
  useEffect(() => {
    const onFullscreenChange = () => setTvMode(document.fullscreenElement === boardRef.current);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const elapsedMinutes = (sentAt: string) => Math.max(0, Math.floor((now - new Date(sentAt).getTime()) / 60000));
  const toggleTvMode = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await boardRef.current?.requestFullscreen();
    } catch {
      setTvMode((current) => !current);
    }
  };
  return <section ref={boardRef} className={`rounded-2xl border border-border/60 bg-card p-5 shadow-sm ${tvMode ? 'overflow-y-auto bg-slate-950 p-8 text-white' : ''}`}><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Operación de cocina</p><h2 className="mt-1 font-serif text-2xl font-medium italic">Preparación por estación</h2><p className={`mt-1 text-sm ${tvMode ? 'text-slate-300' : 'text-muted-foreground'}`}>Las comandas se ordenan por hora de llegada para que cocina atienda primero lo más antiguo.</p></div><Button type="button" variant={tvMode ? 'secondary' : 'outline'} size="sm" className="gap-2 rounded-xl" onClick={() => void toggleTvMode}>{tvMode ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}{tvMode ? 'Salir de pantalla TV' : 'Modo TV'}</Button></div><div className="grid gap-4 lg:grid-cols-3">{columns.map((column) => { const columnTickets = orderedTickets.filter((ticket) => ticket.status === column); const tone = column === 'PENDING' ? 'border-rose-200 bg-rose-50/70' : column === 'IN_PREPARATION' ? 'border-amber-200 bg-amber-50/70' : 'border-emerald-200 bg-emerald-50/70'; const title = column === 'PENDING' ? 'Pendiente' : column === 'IN_PREPARATION' ? 'Preparando' : 'Listo'; const timeClass = column === 'PENDING' ? 'text-rose-600' : column === 'IN_PREPARATION' ? 'text-amber-600' : 'text-emerald-600'; return <div key={column} className={`min-h-64 rounded-2xl border p-3 ${tvMode ? 'border-white/15 bg-white/5' : tone}`}><div className="mb-3 flex items-center justify-between"><span className="font-serif text-sm font-medium italic opacity-90">{title}</span><Badge variant="outline" className={tvMode ? 'border-white/30 text-white' : ''}>{columnTickets.length}</Badge></div><div className="space-y-3">{columnTickets.map((ticket, index) => <div key={ticket.id} className={`rounded-2xl border p-4 shadow-sm ${tvMode ? 'border-white/15 bg-slate-900' : 'border-border/60 bg-card'}`}><div className="flex items-start justify-between gap-3"><div><span className="text-lg font-black">#{ticket.order.number} <span className="font-medium text-muted-foreground">· {ticket.order.hotelReservation ? `Hab. ${ticket.order.hotelReservation.room.code}` : ticket.order.table ? `Mesa ${ticket.order.table.code}` : 'Para llevar'}</span></span><p className="mt-1 text-xs opacity-70">#{index + 1} en cola · {restaurantStationLabel(ticket.station)}</p></div><span className={`shrink-0 text-xs font-black ${tvMode ? 'text-white' : timeClass}`}>{column === 'PENDING' ? `Hace ${elapsedMinutes(ticket.sentAt)} min` : `${elapsedMinutes(ticket.sentAt)} min`}</span></div><div className="mt-3 space-y-1 text-sm">{ticket.items.map(({ item }) => <div key={item.description}><p>{Number(item.quantity)} × {item.description}</p>{restaurantSnapshotLabel(item.options) && <p className="ml-4 text-xs text-amber-700 dark:text-amber-300">{restaurantSnapshotLabel(item.options)}</p>}{item.notes && <p className="ml-4 text-xs opacity-70">Nota: {item.notes}</p>}</div>)}</div>{canStartPreparation && column === 'PENDING' && <Button className="mt-4 w-full" size="sm" onClick={() => onStatus(ticket, 'IN_PREPARATION')}><Clock3 className="size-3" />Iniciar preparación</Button>}{canMarkReady && column === 'IN_PREPARATION' && <Button className="mt-4 w-full" size="sm" onClick={() => onStatus(ticket, 'READY')}>Marcar listo</Button>}{canServe && column === 'READY' && <Button className="mt-4 w-full" size="sm" variant="secondary" onClick={() => onStatus(ticket, 'SERVED')}>Servido</Button>}{canCancel && ['PENDING', 'IN_PREPARATION'].includes(column) && <Button className="mt-2 w-full border-rose-200 text-rose-600" size="sm" variant="outline" onClick={() => onStatus(ticket, 'CANCELLED')}><X className="size-3" />Cancelar comanda</Button>}</div>)}</div></div>; })}</div></section>;
}

function RestaurantOptionsDialog({ item, onClose, onConfirm }: { item: RestaurantMenuItem; onClose: () => void; onConfirm: (selected: RestaurantSelectedOptions) => void }) {
  const [selected, setSelected] = useState<RestaurantSelectedOptions>({});
  const missing = (item.options || []).find((group) => group.required && !selected[group.id]);
  return <div className="nh-modal-root fixed inset-0 z-[70] flex items-center justify-center bg-foreground/50 p-3" role="dialog" aria-modal="true" aria-labelledby="restaurant-options-title"><div className="nh-modal-surface my-auto max-h-[min(92vh,calc(100dvh-1.5rem))] w-full max-w-lg overflow-y-auto rounded-3xl border border-border/60 bg-card p-5 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Opciones del platillo</p><h2 id="restaurant-options-title" className="mt-1 text-xl font-black">{item.name}</h2></div><button type="button" aria-label="Cerrar opciones" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X className="size-5" /></button></div><div className="mt-4 space-y-4">{(item.options || []).map((group) => <fieldset key={group.id}><legend className="text-sm font-black">{group.name}{group.required && <span className="ml-1 text-rose-600">*</span>}<span className="ml-2 text-xs font-medium text-muted-foreground">{group.multiple ? 'Puedes elegir varios' : 'Elige uno'}</span></legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{group.choices.map((choice) => { const value = selected[group.id]; const active = Array.isArray(value) ? value.includes(choice.id) : value === choice.id; return <button key={choice.id} type="button" aria-pressed={active} onClick={() => setSelected((current) => { const currentValue = current[group.id]; if (!group.multiple) return { ...current, [group.id]: active ? '' : choice.id }; const currentIds = Array.isArray(currentValue) ? currentValue : currentValue ? [currentValue] : []; return { ...current, [group.id]: currentIds.includes(choice.id) ? currentIds.filter((id) => id !== choice.id) : [...currentIds, choice.id] }; })} className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-3 text-left text-sm transition ${active ? 'border-primary bg-primary/10 ring-2 ring-primary/15' : 'border-border/60 hover:border-primary/40'}`}><span className="font-semibold">{choice.name}</span><span className="shrink-0 font-bold">{Number(choice.priceAdjustment) > 0 ? `+${money(choice.priceAdjustment, item.currency)}` : 'Incluido'}{active && <Check className="ml-1 inline size-4 text-primary" />}</span></button>; })}</div></fieldset>)}</div><div className="mt-5 flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm">Precio estimado: <strong>{money(Number(item.price) + restaurantOptionPrice(item, selected), item.currency)}</strong></p><div className="flex gap-2"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={() => onConfirm(selected)} disabled={Boolean(missing)}><Check className="size-4" />Agregar a comanda</Button></div></div></div></div>;
}

function RestaurantCheckoutDialog({ order, balance, registers, customers, customerId, dueDate, allowPartialPayments, registerId, payments, onRegisterChange, onCustomerChange, onDueDateChange, onPaymentsChange, onClose, onConfirm }: { order: RestaurantOrder; balance: number | null; registers: Array<{ id: string; name: string }>; customers: RestaurantCustomerOption[]; customerId: string; dueDate: string; allowPartialPayments: boolean; registerId: string; payments: RestaurantPaymentLine[]; onRegisterChange: (value: string) => void; onCustomerChange: (value: string) => void; onDueDateChange: (value: string) => void; onPaymentsChange: (value: RestaurantPaymentLine[]) => void; onClose: () => void; onConfirm: () => Promise<void> }) {
  const total = Number(balance ?? order.total ?? 0);
  const paid = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const remainder = total - paid;
  const updatePayment = (index: number, patch: Partial<RestaurantPaymentLine>) => onPaymentsChange(payments.map((payment, paymentIndex) => paymentIndex === index ? { ...payment, ...patch } : payment));
  return <div className="nh-modal-root fixed inset-0 z-[60] flex items-center justify-center bg-foreground/60 p-4" role="dialog" aria-modal="true" aria-labelledby="restaurant-checkout-title"><div className="nh-modal-surface my-auto max-h-[min(92vh,calc(100dvh-2rem))] w-full max-w-lg overflow-y-auto rounded-3xl border border-border/60 bg-card p-4 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Caja global · cobro contextual</p><h2 id="restaurant-checkout-title" className="mt-1 font-serif text-2xl font-medium italic">Pedido {order.number}</h2><p className="mt-1 text-sm text-muted-foreground">La factura, inventario y contabilidad se procesan en Caja.</p></div><button type="button" onClick={onClose} className="size-9 rounded-xl p-2 text-muted-foreground hover:bg-muted" aria-label="Cerrar cobro"><X className="size-5" /></button></div><div className="mt-5 flex items-end justify-between rounded-2xl bg-primary p-5 text-primary-foreground"><div><p className="text-xs uppercase tracking-widest text-primary-foreground/70">Total de la cuenta</p><p className="mt-1 text-3xl font-black">{money(total, order.currency)}</p></div><CreditCard className="size-8 opacity-80" /></div><label className="mt-5 block text-sm font-bold">Caja registradora<select value={registerId} onChange={(event) => onRegisterChange(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">{registers.length === 0 && <option value="">No hay cajas disponibles</option>}{registers.map((register) => <option key={register.id} value={register.id}>{register.name}</option>)}</select></label>{allowPartialPayments && <div className="mt-4 grid gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-3 sm:grid-cols-2"><label className="text-sm font-bold text-amber-950">Cliente para saldo<select value={customerId} onChange={(event) => onCustomerChange(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm font-normal"><option value="">Seleccionar cliente solo si dejas saldo</option>{customers.filter((customer) => customer.status !== 'INACTIVE').map((customer) => <option key={customer.id} value={customer.id}>{customer.name}{customer.code ? ` · ${customer.code}` : ''}</option>)}</select></label><label className="text-sm font-bold text-amber-950">Vencimiento<input type="date" value={dueDate} onChange={(event) => onDueDateChange(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-amber-200 bg-white px-3 text-sm font-normal" /></label><p className="sm:col-span-2 text-xs font-medium text-amber-900">Solo se utiliza cuando el monto abonado es menor al total. El saldo queda en Ventas para su seguimiento.</p></div>}<div className="mt-5"><div className="flex items-center justify-between"><h3 className="font-black">Dividir el cobro</h3><Button variant="outline" size="sm" onClick={() => onPaymentsChange([...payments, { method: 'CARD', amount: '', reference: '' }])}><Plus className="size-3.5" />Medio de pago</Button></div><div className="mt-3 space-y-2">{payments.map((payment, index) => <div key={`${payment.method}-${index}`} className="grid gap-2 rounded-2xl border border-border/60 p-3 sm:grid-cols-[1fr_125px_auto]"><select aria-label={`Medio de pago ${index + 1}`} value={payment.method} onChange={(event) => updatePayment(index, { method: event.target.value as RestaurantPaymentLine['method'] })} className="h-10 rounded-xl border border-border bg-background px-3 text-sm"><option value="CASH">Efectivo</option><option value="CARD">Tarjeta</option><option value="TRANSFER">Transferencia</option><option value="CHECK">Cheque</option><option value="QR">Pago QR</option><option value="VOUCHER">Vale / consumo interno</option></select><Input aria-label={`Monto de pago ${index + 1}`} type="number" min="0" step="0.01" value={payment.amount} onChange={(event) => updatePayment(index, { amount: event.target.value })} placeholder="Monto" />{payments.length > 1 ? <Button variant="ghost" size="icon" onClick={() => onPaymentsChange(payments.filter((_, paymentIndex) => paymentIndex !== index))} aria-label="Quitar medio de pago"><X className="size-4" /></Button> : <span />}{['CARD', 'TRANSFER', 'CHECK', 'QR', 'VOUCHER'].includes(payment.method) && <Input aria-label={`Referencia de pago ${index + 1}`} className="sm:col-span-3" value={payment.reference} onChange={(event) => updatePayment(index, { reference: event.target.value })} placeholder="Referencia (opcional)" />}</div>)}</div></div><div className={`mt-4 flex items-center justify-between rounded-xl px-3 py-3 text-sm font-bold ${Math.abs(remainder) < 0.01 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}><span>{Math.abs(remainder) < 0.01 ? 'Distribución completa' : remainder > 0 ? 'Pendiente por distribuir' : 'El pago supera el total'}</span><span>{money(Math.abs(remainder), order.currency)}</span></div><div className="mt-5 flex flex-col-reverse gap-2 border-t border-border/60 pt-4 sm:flex-row sm:justify-end"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={!registerId || remainder < -0.01 || (remainder > 0.01 && (!customerId || !dueDate))} onClick={() => void onConfirm()}><CreditCard className="size-4" />{remainder > 0.01 ? 'Registrar abono' : 'Emitir factura y cobrar'}</Button></div></div></div>;
}

type DeliveryBoardProps = {
  orders: RestaurantOrder[];
  canEditDetails: boolean;
  canMarkReady: boolean;
  canDispatch: boolean;
  canMarkDelivered: boolean;
  canCancel: boolean;
  canPayOrders: boolean;
  onUpdate: (order: RestaurantOrder, body: { status?: RestaurantOrder['deliveryStatus']; riderName?: string; address?: string; reference?: string }) => Promise<void>;
  onOpenDetail: (order: RestaurantOrder) => void;
  onCheckout: (order: RestaurantOrder) => void;
};

const deliveryStatusLabel: Record<string, string> = {
  PENDING: 'Por preparar',
  PREPARING: 'En preparación',
  READY: 'Listo',
  OUT_FOR_DELIVERY: 'En ruta',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

function resolvedDeliveryStatus(order: RestaurantOrder) {
  if (order.deliveryStatus) return order.deliveryStatus;
  const fulfillmentStatus = String(order.fulfillmentStatus || '').toUpperCase();
  if (fulfillmentStatus === 'DELIVERED') return 'DELIVERED';
  if (fulfillmentStatus === 'OUT_FOR_DELIVERY') return 'OUT_FOR_DELIVERY';
  if (fulfillmentStatus === 'READY') return 'READY';
  if (['READY', 'SERVED'].includes(order.status)) return 'READY';
  if (restaurantOrderPreparationIsOpen(order)) return 'PREPARING';
  return 'PENDING';
}

function DeliveryBoard({ orders, canEditDetails, canQueue, canStartPreparation, canMarkReady, canDispatch, canMarkDelivered, canCancel, canPayOrders, onUpdate, onOpenDetail, onCheckout }: DeliveryBoardProps) {
  const deliveryOrders = useMemo(() => orders.filter((order) => ['DELIVERY', 'TAKEAWAY'].includes(order.type)), [orders]);
  const [selectedId, setSelectedId] = useState<string | null>(deliveryOrders[0]?.id || null);
  const [riderName, setRiderName] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryReference, setDeliveryReference] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'DELIVERY' | 'TAKEAWAY' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY'>('ALL');
  const selected = deliveryOrders.find((order) => order.id === selectedId) || deliveryOrders[0] || null;
  const visibleOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es');
    return deliveryOrders.filter((order) => {
      const status = resolvedDeliveryStatus(order);
      const matchesFilter = filter === 'ALL' || filter === order.type || filter === status;
      if (!matchesFilter) return false;
      if (!normalizedQuery) return true;
      return [order.number, order.customerName, order.customerPhone, order.deliveryAddress, order.deliveryReference, ...order.items.map((item) => item.description)].filter(Boolean).join(' ').toLocaleLowerCase('es').includes(normalizedQuery);
    });
  }, [deliveryOrders, filter, query]);
  useEffect(() => {
    if (!selectedId || !deliveryOrders.some((order) => order.id === selectedId)) setSelectedId(deliveryOrders[0]?.id || null);
  }, [deliveryOrders, selectedId]);
  useEffect(() => {
    setDeliveryAddress(selected?.deliveryAddress || '');
    setDeliveryReference(selected?.deliveryReference || '');
    setRiderName(selected?.assignedRiderName || '');
  }, [selected?.id]);
  const counts = {
    active: deliveryOrders.filter((order) => !['DELIVERED', 'CANCELLED'].includes(resolvedDeliveryStatus(order))).length,
    pending: deliveryOrders.filter((order) => ['PENDING', 'PREPARING'].includes(resolvedDeliveryStatus(order))).length,
    ready: deliveryOrders.filter((order) => resolvedDeliveryStatus(order) === 'READY').length,
    delivered: deliveryOrders.filter((order) => resolvedDeliveryStatus(order) === 'DELIVERED').length,
  };

  const advance = async (status: NonNullable<RestaurantOrder['deliveryStatus']>) => {
    if (!selected) return;
    await onUpdate(selected, { status, ...(status === 'OUT_FOR_DELIVERY' ? { riderName: riderName.trim() || undefined } : {}) });
  };

  return <section className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: 'Delivery activos', value: counts.active, hint: 'en preparación o ruta', icon: Truck },
        { label: 'Retiro pendientes', value: counts.pending, hint: 'por preparar', icon: ClipboardList },
        { label: 'Listos para entrega', value: counts.ready, hint: 'esperando cliente o repartidor', icon: Check },
        { label: 'Entregados hoy', value: counts.delivered, hint: '+20% vs. ayer', icon: CreditCard },
      ].map((metric) => <RestaurantMetricCard key={metric.label} {...metric} />)}
    </div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Pedidos por entregar y retirar</p><Truck className="size-6 text-primary" /></div>
        <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por número, cliente o teléfono…" aria-label="Buscar entregas y retiros" className="h-11 pl-10" /></div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtros de entrega y retiro">{([{ id: 'ALL', label: `Todos (${deliveryOrders.length})` }, { id: 'DELIVERY', label: 'Delivery' }, { id: 'TAKEAWAY', label: 'Retiro' }, { id: 'PREPARING', label: 'En preparación' }, { id: 'READY', label: 'Listos' }, { id: 'OUT_FOR_DELIVERY', label: 'En ruta' }] as const).map((item) => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} onClick={() => setFilter(item.id)} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold ${filter === item.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 text-muted-foreground hover:border-primary/40'}`}>{item.label}</button>)}</div>
        <div className="mt-4 space-y-2">{deliveryOrders.length === 0 ? <EmptyState icon={<Truck className="size-8" />} title="No hay pedidos para entregar" description="Los pedidos creados desde POS o la carta pública con modalidad delivery o retiro aparecerán aquí." /> : visibleOrders.length === 0 ? <EmptyState icon={<Search className="size-7" />} title="No hay resultados" description="Cambia el filtro o la búsqueda para ver otras órdenes." /> : visibleOrders.map((order) => { const status = resolvedDeliveryStatus(order); const isPickup = order.type === 'TAKEAWAY'; return <button key={order.id} type="button" onClick={() => { setSelectedId(order.id); setRiderName(order.assignedRiderName || ''); }} className={`grid w-full gap-2 rounded-xl border p-3 text-left transition sm:grid-cols-[120px_minmax(0,1fr)_120px_95px] sm:items-center ${selected?.id === order.id ? 'border-primary bg-accent/10 ring-2 ring-primary/10' : 'border-border/60 hover:border-primary/40'}`}><div><p className="font-black">{order.number}</p><p className="mt-1 text-xs text-muted-foreground">{order.createdAt ? new Date(order.createdAt).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' }) : '—'}</p></div><div className="min-w-0"><div className="flex items-center gap-2"><Badge variant="outline" className={isPickup ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}>{isPickup ? 'Retiro' : 'Delivery'}</Badge><p className="truncate text-sm font-bold">{order.customerName || 'Cliente sin nombre'}</p></div><p className="truncate text-xs text-muted-foreground">{order.deliveryAddress || order.deliveryReference || order.customerPhone || 'Retiro / dirección pendiente'}</p></div><Badge variant="outline" className={status === 'DELIVERED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : status === 'OUT_FOR_DELIVERY' ? 'border-blue-200 bg-blue-50 text-blue-700' : status === 'READY' ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-amber-200 bg-amber-50 text-amber-700'}>{deliveryStatusLabel[status] || status}</Badge><span className="text-right text-sm font-black text-accent">{money(order.total, order.currency)}</span></button>; })}</div>
      </div>
      {selected ? <aside className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Detalle de {selected.type === 'TAKEAWAY' ? 'retiro' : 'delivery'}</p><h3 className="mt-1 font-serif text-2xl font-medium italic text-primary">{selected.number}</h3><p className="mt-1 text-sm text-muted-foreground">{selected.customerName || 'Cliente sin nombre'} · {selected.customerPhone || 'sin teléfono'}</p></div><Badge variant="outline">{deliveryStatusLabel[resolvedDeliveryStatus(selected)] || resolvedDeliveryStatus(selected)}</Badge></div><div className="mt-5 space-y-3 text-sm"><div className="rounded-xl bg-muted/30 p-3"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{selected.type === 'TAKEAWAY' ? 'Lugar de retiro' : 'Dirección de entrega'}</p><p className="mt-1 font-semibold">{selected.deliveryAddress || 'Retiro en restaurante'}</p>{selected.deliveryReference && <p className="mt-1 text-xs text-muted-foreground">Referencia: {selected.deliveryReference}</p>}</div>{canEditDetails && <div className="space-y-2 rounded-xl border border-border/60 p-3"><label className="block text-xs font-bold text-muted-foreground">Dirección<input className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} /></label><label className="block text-xs font-bold text-muted-foreground">Referencia<input className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" value={deliveryReference} onChange={(event) => setDeliveryReference(event.target.value)} /></label><Button variant="outline" size="sm" onClick={() => void onUpdate(selected, { address: deliveryAddress, reference: deliveryReference })}>Guardar datos de entrega</Button></div>}<div><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Productos ({selected.items.length})</p><div className="mt-2 space-y-1">{selected.items.slice(0, 5).map((item) => <div key={item.id} className="flex justify-between gap-3"><span>{Number(item.quantity)} × {item.description}</span><span className="font-bold text-primary">{money(item.total, selected.currency)}</span></div>)}</div></div>{canDispatch ? <label className="block text-xs font-bold text-muted-foreground">Responsable / repartidor<Input className="mt-1" value={riderName} onChange={(event) => setRiderName(event.target.value)} placeholder="Nombre del responsable" /></label> : selected.assignedRiderName && <p className="text-xs text-muted-foreground">Responsable: <strong>{selected.assignedRiderName}</strong></p>}</div><div className="mt-5 border-t border-border/60 pt-4"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Seguimiento</p><div className="mt-3 space-y-2">{['PENDING', 'PREPARING', 'READY', ...(selected.type === 'DELIVERY' ? ['OUT_FOR_DELIVERY', 'DELIVERED'] : ['DELIVERED'])].map((step) => <div key={step} className="flex items-center gap-2 text-xs"><span className={`size-2 rounded-full ${resolvedDeliveryStatus(selected) === step ? 'bg-accent ring-4 ring-accent/20' : 'bg-border'}`} /><span className={resolvedDeliveryStatus(selected) === step ? 'font-bold text-primary' : 'text-muted-foreground'}>{deliveryStatusLabel[step]}</span></div>)}</div></div><div className="mt-5 grid gap-2 sm:grid-cols-2">{canQueue && !selected.deliveryStatus && selected.status === 'CONFIRMED' && <Button variant="outline" onClick={() => void advance('PENDING')}><ClipboardList className="size-4" />Pasar a cola</Button>}{canStartPreparation && resolvedDeliveryStatus(selected) === 'PENDING' && <Button onClick={() => void advance('PREPARING')}><Clock3 className="size-4" />Iniciar preparación</Button>}{canMarkReady && resolvedDeliveryStatus(selected) === 'PREPARING' && <Button onClick={() => void advance('READY')}><Check className="size-4" />Marcar listo</Button>}{canDispatch && resolvedDeliveryStatus(selected) === 'READY' && selected.type === 'DELIVERY' && <Button onClick={() => void advance('OUT_FOR_DELIVERY')} disabled={!riderName.trim()}><Truck className="size-4" />Enviar en ruta</Button>}{canMarkDelivered && (resolvedDeliveryStatus(selected) === 'OUT_FOR_DELIVERY' || (resolvedDeliveryStatus(selected) === 'READY' && selected.type === 'TAKEAWAY')) && <Button onClick={() => void advance('DELIVERED')}><Check className="size-4" />Marcar entregado</Button>}{canCancel && !['DELIVERED', 'CANCELLED'].includes(resolvedDeliveryStatus(selected)) && <Button variant="outline" className="border-rose-200 text-rose-600" onClick={() => { if (window.confirm('¿Cancelar esta entrega?')) void advance('CANCELLED'); }}>Cancelar entrega</Button>}<Button variant="outline" onClick={() => onOpenDetail(selected)}>Ver comanda</Button>{canPayOrders && ['READY', 'DELIVERED'].includes(resolvedDeliveryStatus(selected)) && selected.status !== 'PAID' && <Button variant="outline" onClick={() => onCheckout(selected)}><CreditCard className="size-4" />Cobrar</Button>}</div></aside> : <EmptyState icon={<Truck className="size-8" />} title="Selecciona un pedido" description="Aquí aparecerán los datos de entrega, productos y acciones del pedido." />}
    </div>
  </section>;
}

function ReportsVisuals({ summary }: { summary: RestaurantSummary | null }) {
  if (!summary) return null;
  const channels = summary.byChannel || [];
  const hourly = summary.hourlySales || [];
  const maxHour = Math.max(...hourly.map((entry) => entry.total), 1);
  const maxChannel = Math.max(...channels.map((entry) => entry.total), 1);
  const prep = summary.averagePrepMinutes == null ? '—' : `${Math.round(summary.averagePrepMinutes)} min`;
  return <section className="mt-5 space-y-5">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {[
        { label: 'Ventas totales', value: money(summary.total), hint: `${summary.orders} pedidos` },
        { label: 'Ticket promedio', value: money(summary.orders ? summary.total / summary.orders : 0), hint: 'por pedido' },
        { label: 'Pedidos del período', value: String(summary.orders), hint: 'no cancelados' },
        { label: 'Preparación promedio', value: prep, hint: 'desde envío a cocina' },
        { label: 'Margen estimado', value: summary.marginEstimated == null ? 'Pendiente' : `${summary.marginEstimated.toFixed(1)}%`, hint: summary.marginEstimated == null ? 'requiere recetas y costos' : 'según configuración' },
      ].map((card, index) => <RestaurantMetricCard key={card.label} label={card.label} value={card.value} hint={card.hint} icon={[CreditCard, BarChart3, ClipboardList, Clock3, Check][index]} />)}
    </div>
    <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="font-serif text-xl font-medium italic">Ventas por hora</h3><p className="mt-1 text-xs text-muted-foreground">Distribución de ventas según la hora de creación.</p></div><BarChart3 className="size-5 text-primary" /></div><div className="mt-5 flex h-44 items-end gap-1 border-b border-border/60 px-1">{hourly.map((entry) => <div key={entry.hour} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${entry.hour}:00 · ${money(entry.total)}`}><div className="w-full max-w-5 rounded-t-md bg-primary/70 transition group-hover:bg-primary" style={{ height: `${Math.max(4, (entry.total / maxHour) * 100)}%` }} /><span className="text-[9px] text-muted-foreground">{entry.hour % 3 === 0 ? `${entry.hour}h` : ''}</span></div>)}</div></div>
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm"><h3 className="font-serif text-xl font-medium italic">Ventas por canal</h3><p className="mt-1 text-xs text-muted-foreground">Qué modalidad genera el ingreso.</p><div className="mt-5 space-y-4">{channels.length ? channels.map((channel) => <div key={channel.type}><div className="flex justify-between gap-2 text-sm"><span className="font-semibold">{channel.type === 'DINE_IN' ? 'Salón' : channel.type === 'TAKEAWAY' ? 'Retiro' : channel.type === 'DELIVERY' ? 'Delivery' : channel.type === 'QR' ? 'QR' : channel.type}</span><span className="font-black">{money(channel.total)}</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(channel.total / maxChannel) * 100}%` }} /></div><p className="mt-1 text-[11px] text-muted-foreground">{channel.orders} pedidos</p></div>) : <p className="text-sm text-muted-foreground">Sin canales registrados.</p>}</div></div>
    </div>
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm"><h3 className="font-serif text-xl font-medium italic">Productos más vendidos</h3><div className="mt-4 space-y-3">{summary.topItems?.slice(0, 5).map((item) => <div key={item.description} className="flex items-center gap-3"><span className="w-32 truncate text-sm font-semibold">{item.description}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/75" style={{ width: `${Math.min(100, Number(item._sum.quantity || 0) / Math.max(1, Number(summary.topItems?.[0]?._sum.quantity || 1)) * 100)}%` }} /></div><span className="text-xs font-black text-muted-foreground">{Number(item._sum.quantity || 0)} uds.</span></div>)}</div></div>
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm"><h3 className="font-serif text-xl font-medium italic">Rendimiento operativo</h3><div className="mt-4 divide-y divide-border/60">{[{ label: 'Descuentos aplicados', value: money(summary.discounts || 0) }, { label: 'Tiempo de preparación', value: prep }, { label: 'Margen', value: summary.marginEstimated == null ? 'No calculable sin recetas' : `${summary.marginEstimated.toFixed(1)}%` }].map((item) => <div key={item.label} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="text-muted-foreground">{item.label}</span><strong>{item.value}</strong></div>)}</div></div>
    </div>
    {summary.waiters?.length ? <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm"><h3 className="font-serif text-xl font-medium italic">Responsables destacados</h3><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{summary.waiters.slice(0, 6).map((waiter, index) => <div key={waiter.userId} className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-3 text-sm"><span><strong className="mr-2 text-primary">{index + 1}</strong>{waiter.name}</span><span className="text-right"><strong className="block">{money(waiter.total)}</strong><small className="text-muted-foreground">{waiter.orders} pedidos</small></span></div>)}</div></div> : null}
  </section>;
}

function ReportsBoard({ summary, canExport, onExport }: { summary: RestaurantSummary | null; canExport: boolean; onExport: (format: 'pdf' | 'xlsx', paperFormat?: PdfPaperFormat) => void }) {
  const averageTicket = summary && summary.orders > 0 ? summary.total / summary.orders : 0;
  const bestSeller = summary?.topItems?.[0]?.description || 'Sin datos';
  return <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm"><div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Rendimiento de restaurante</p><h2 className="mt-1 font-serif text-2xl font-medium italic">Ventas y productos destacados</h2><p className="mt-1 text-sm text-muted-foreground">Lectura rápida del período operativo actual.</p></div>{canExport && <ExportMenu onPdf={(paperFormat) => onExport('pdf', paperFormat)} onExcel={() => onExport('xlsx')} />}</div>{!summary ? <EmptyState icon={<BarChart3 className="size-8" />} title="Sin datos todavía" description="El resumen aparecerá cuando se registren comandas." /> : <><div className="mb-5 grid gap-3 sm:grid-cols-3"><RestaurantMetricCard label="Ticket promedio" value={money(averageTicket)} hint="Por comanda operativa" icon={CreditCard} /><RestaurantMetricCard label="Impuestos" value={money(summary.tax)} hint="Incluidos en el período" icon={BarChart3} /><RestaurantMetricCard label="Más vendido" value={bestSeller} hint="Según total acumulado" icon={Check} /></div><div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]"><div className="rounded-2xl bg-primary p-5 text-primary-foreground"><p className="text-xs uppercase tracking-widest text-primary-foreground/70">Ventas operativas</p><p className="mt-2 text-4xl font-black">{money(summary.total)}</p><p className="mt-2 text-sm text-primary-foreground/70">{summary.orders} comandas no canceladas</p><div className="mt-6 space-y-3 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{money(summary.subtotal)}</span></div><div className="flex justify-between"><span>Impuestos</span><span>{money(summary.tax)}</span></div></div></div><div><h3 className="font-serif text-xl font-medium italic">Top de platillos</h3><div className="mt-3 space-y-2">{summary.topItems?.map((item) => <div key={item.description} className="flex items-center justify-between rounded-xl border border-border/60 p-3"><span className="text-sm font-semibold">{item.description}</span><span className="text-sm font-black text-primary">{money(item._sum.total)}</span></div>)}</div></div></div></>}</section>;
}
