import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Check,
  ChefHat,
  ClipboardList,
  Clock3,
  CreditCard,
  Eye,
  EyeOff,
  LayoutGrid,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Send,
  ShieldAlert,
  Settings2,
  ShoppingBag,
  Utensils,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { useBranchScope } from '../hooks/useBranchScope';
import { useAuth } from '../contexts/AuthContext';
import { getApiErrorMessage } from '../services/api';
import { cajaService } from '../services/caja.service';
import { CurrencyValuationBanner } from './ui/CurrencyValuation';
import {
  restaurantService,
  type RestaurantKitchenTicket,
  type RestaurantMenuCategory,
  type RestaurantMenuItem,
  type RestaurantOrder,
  type RestaurantSummary,
  type RestaurantTable,
} from '../services/restaurant.service';

type RestaurantTab = 'salon' | 'comandas' | 'cocina' | 'carta' | 'reportes';

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
  IN_PREPARATION: 'Preparando',
  READY: 'Listo',
  SERVED: 'Servido',
  PARTIALLY_PAID: 'Pago parcial',
  PAID: 'Pagado',
  CANCELLED: 'Cancelado',
};

const kitchenStatus: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Pendiente', className: 'bg-amber-50 text-amber-700' },
  IN_PREPARATION: { label: 'Preparando', className: 'bg-blue-50 text-blue-700' },
  READY: { label: 'Listo', className: 'bg-emerald-50 text-emerald-700' },
  SERVED: { label: 'Entregado', className: 'bg-slate-100 text-slate-600' },
  CANCELLED: { label: 'Cancelado', className: 'bg-rose-50 text-rose-700' },
};

const money = (value: unknown, currency = 'NIO') => `${currency === 'USD' ? '$' : 'C$'} ${Number(value || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function RestaurantePage() {
  const { canPerform } = useAuth();
  const { accessibleBranches, selectedBranchId, setSelectedBranchId } = useBranchScope();
  const canViewRestaurant = canPerform('RESTAURANT', 'view');
  const [tab, setTab] = useState<RestaurantTab>('salon');
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [menu, setMenu] = useState<RestaurantMenuCategory[]>([]);
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [tickets, setTickets] = useState<RestaurantKitchenTicket[]>([]);
  const [summary, setSummary] = useState<RestaurantSummary | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTableForm, setShowTableForm] = useState(false);
  const [newTable, setNewTable] = useState({ code: '', name: '', zone: '', seats: '2' });
  const [checkoutOrder, setCheckoutOrder] = useState<RestaurantOrder | null>(null);
  const [registers, setRegisters] = useState<Array<{ id: string; name: string }>>([]);
  const [checkoutRegisterId, setCheckoutRegisterId] = useState('');
  const [publicLink, setPublicLink] = useState('');

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setRefreshing(true);
    try {
      const branchId = selectedBranchId || undefined;
      const [nextTables, nextMenu, nextOrders, nextTickets, nextSummary] = await Promise.all([
        restaurantService.listTables(branchId, signal),
        restaurantService.getMenu(signal),
        restaurantService.listOrders(branchId, signal),
        restaurantService.listKitchenTickets(branchId, signal),
        restaurantService.getSummary({ branchId }, signal),
      ]);
      const nextTableList = nextTables || [];
      setTables(nextTableList);
      if (nextTableList[0]?.publicToken) setPublicLink((current) => current || `${window.location.origin}/restaurant/menu/${nextTableList[0].publicToken}`);
      setMenu(nextMenu || []);
      setOrders(nextOrders || []);
      setTickets(nextTickets || []);
      setSummary(nextSummary || null);
    } catch (error: unknown) {
      if (!(error instanceof Error) || error.name !== 'AbortError') toast.error(getApiErrorMessage(error, 'No se pudo cargar Restaurante POS.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    if (!canViewRestaurant) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    // La carga inicial sincroniza la pantalla con el API; el abort evita
    // actualizar estado si el usuario cambia de módulo antes de responder.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData(controller.signal);
    return () => controller.abort();
  }, [canViewRestaurant, loadData]);

  const selectedTable = useMemo(() => tables.find((table) => table.id === selectedTableId) || null, [tables, selectedTableId]);
  const cartLines = useMemo(() => menu.flatMap((category) => category.items
    .filter((item) => cart[item.id])
    .map((item) => ({ item, quantity: cart[item.id] }))), [menu, cart]);
  const cartTotal = cartLines.reduce((total, line) => total + Number(line.item.price || 0) * line.quantity, 0);
  const openTables = tables.filter((table) => ['OCCUPIED', 'RESERVED', 'CLEANING'].includes(table.status)).length;
  const pendingTickets = tickets.filter((ticket) => ['PENDING', 'IN_PREPARATION'].includes(ticket.status)).length;

  const refresh = () => void loadData();

  const addToCart = (itemId: string) => setCart((current) => ({ ...current, [itemId]: (current[itemId] || 0) + 1 }));
  const removeFromCart = (itemId: string) => setCart((current) => {
    const next = { ...current };
    if ((next[itemId] || 0) <= 1) delete next[itemId];
    else next[itemId] -= 1;
    return next;
  });

  const createOrder = async () => {
    if (!selectedTable || cartLines.length === 0) {
      toast.error('Selecciona una mesa y agrega al menos un platillo.');
      return;
    }
    try {
      const order = await restaurantService.createOrder({
        tableId: selectedTable.id,
        items: cartLines.map(({ item, quantity }) => ({ menuItemId: item.id, quantity })),
      });
      await restaurantService.sendToKitchen(order.id);
      setCart({});
      toast.success(`Comanda ${order.number} enviada a cocina.`);
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear la comanda.'));
    }
  };

  const createTable = async () => {
    const branchId = selectedBranchId || accessibleBranches[0]?.id;
    if (!branchId || !newTable.code.trim() || !newTable.name.trim()) {
      toast.error('Selecciona una sucursal y completa código y nombre.');
      return;
    }
    try {
      await restaurantService.createTable({ ...newTable, branchId, seats: Number(newTable.seats) || 2 });
      setNewTable({ code: '', name: '', zone: '', seats: '2' });
      setShowTableForm(false);
      toast.success('Mesa creada.');
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear la mesa.'));
    }
  };

  const updateKitchen = async (ticket: RestaurantKitchenTicket, status: string) => {
    try {
      await restaurantService.updateKitchenTicket(ticket.id, status);
      toast.success(`Comanda ${ticket.order.number}: ${kitchenStatus[status]?.label || status}.`);
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo actualizar cocina.'));
    }
  };

  const changeOrderStatus = async (order: RestaurantOrder, status: string) => {
    try {
      await restaurantService.updateOrderStatus(order.id, status);
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo actualizar la comanda.'));
    }
  };

  const openCheckout = async (order: RestaurantOrder) => {
    try {
      const available = await cajaService.getRegisters();
      setRegisters((available || []).map((register) => ({ id: register.id, name: register.name })));
      setCheckoutRegisterId(available?.[0]?.id || '');
      setCheckoutOrder(order);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudieron cargar las cajas.'));
    }
  };

  const checkout = async () => {
    if (!checkoutOrder || !checkoutRegisterId) return;
    try {
      const session = await cajaService.getActiveSession(checkoutRegisterId);
      if (!session?.id) {
        toast.error('La caja seleccionada no tiene una sesión abierta. Abre la caja antes de cobrar.');
        return;
      }
      await restaurantService.checkout(checkoutOrder.id, {
        registerId: checkoutRegisterId,
        sessionId: session.id,
        payments: [{ method: 'CASH', amount: Number(checkoutOrder.total), currency: checkoutOrder.currency === 'USD' ? 'USD' : 'NIO' }],
      });
      toast.success(`Pedido ${checkoutOrder.number} cobrado y contabilizado.`);
      setCheckoutOrder(null);
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'No se pudo cobrar el pedido.'));
    }
  };

  const copyQrLink = async (table: RestaurantTable) => {
    const url = `${window.location.origin}/restaurant/menu/${table.publicToken}`;
    setPublicLink(url);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Enlace QR copiado. Puedes convertirlo en QR desde tu herramienta de impresión.');
    } catch {
      toast.info(url);
    }
  };

  const tabs: Array<{ id: RestaurantTab; label: string; icon: typeof LayoutGrid }> = [
    { id: 'salon', label: 'Salón y POS', icon: LayoutGrid },
    { id: 'comandas', label: 'Comandas', icon: ClipboardList },
    { id: 'cocina', label: 'Cocina', icon: ChefHat },
    { id: 'carta', label: 'Carta', icon: Utensils },
    { id: 'reportes', label: 'Reportes', icon: BarChart3 },
  ];

  if (!canViewRestaurant) return <NoAccessState />;
  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground"><RefreshCw className="mr-2 size-4 animate-spin" />Cargando Restaurante POS…</div>;

  return (
    <div className="flex flex-1 w-full bg-background">
      <main className="relative flex-1">
        <div className="mx-auto min-h-[calc(100vh-5rem)] w-full max-w-[1700px] p-4 sm:p-6 md:p-10">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-[66px] shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <ChefHat className="size-9 text-primary" />
              </div>
              <div>
                <h1 className="flex flex-wrap items-center gap-x-3 text-3xl font-black uppercase italic leading-none tracking-tighter sm:text-4xl">
                  Restaurante <span className="text-primary">POS</span>
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={selectedBranchId || ''} onChange={(event) => setSelectedBranchId(event.target.value || null)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary">
                <option value="">Todas las sucursales</option>
                {accessibleBranches.map((branch: { id: string; name: string }) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
              <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}><RefreshCw className={refreshing ? 'size-4 animate-spin' : 'size-4'} />Actualizar</Button>
            </div>
          </div>

          <CurrencyValuationBanner className="mb-6" />

          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Mesas activas', openTables, `de ${tables.length}`],
              ['Comandas hoy', summary?.orders || 0, 'operativas'],
              ['Ventas del período', money(summary?.total), 'contabilizadas al cobrar'],
              ['En cocina', pendingTickets, 'pendientes'],
            ].map(([label, value, hint]) => (
              <div key={String(label)} className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{label}</p>
                <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
              </div>
            ))}
          </div>

          <Tabs value={tab} className="w-full" onValueChange={(value) => setTab(value as RestaurantTab)}>
            <div className="mb-6 w-full overflow-x-auto custom-scrollbar">
              <TabsList className="flex h-auto w-max min-w-full gap-1.5 rounded-2xl border border-border/40 bg-gradient-to-br from-muted/30 to-muted/50 p-1.5 backdrop-blur-sm [&>button]:flex-none [&>button]:shrink-0 [&>button]:text-muted-foreground [&>button]:hover:bg-muted/50 [&>button]:hover:text-foreground">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <TabsTrigger key={id} value={id} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
                    <Icon className="size-4" /><span className="hidden sm:inline">{label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
                {tab === 'salon' && <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.7fr)]">
                  <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
                    <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Vista de salón</p><h2 className="mt-1 text-2xl font-black">Mesas y zonas</h2></div><Button size="sm" onClick={() => setShowTableForm((value) => !value)}><Plus className="size-4" />Nueva mesa</Button></div>
                    {showTableForm && <div className="mb-5 grid gap-2 rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 sm:grid-cols-4"><Input placeholder="Código" value={newTable.code} onChange={(e) => setNewTable({ ...newTable, code: e.target.value })} /><Input placeholder="Nombre" value={newTable.name} onChange={(e) => setNewTable({ ...newTable, name: e.target.value })} /><Input placeholder="Zona" value={newTable.zone} onChange={(e) => setNewTable({ ...newTable, zone: e.target.value })} /><div className="flex gap-2"><Input type="number" min="1" placeholder="Sillas" value={newTable.seats} onChange={(e) => setNewTable({ ...newTable, seats: e.target.value })} /><Button onClick={createTable}>Guardar</Button></div></div>}
                    {tables.length === 0 ? <EmptyState icon={<LayoutGrid className="size-8" />} title="Aún no hay mesas configuradas" description="Crea la primera mesa para comenzar a operar el salón." action={<Button size="sm" onClick={() => setShowTableForm(true)}><Plus className="size-4" />Crear mesa</Button>} /> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{tables.map((table) => { const status = tableStatus[table.status] || tableStatus.AVAILABLE; return <div key={table.id} role="button" tabIndex={0} onClick={() => setSelectedTableId(table.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedTableId(table.id); }} className={`group relative min-h-32 cursor-pointer rounded-2xl border-2 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${selectedTableId === table.id ? 'border-primary ring-4 ring-primary/10' : 'border-border/60'}`}><div className="flex items-start justify-between"><span className="text-2xl font-black">{table.code}</span><Badge className={status.className}>{status.label}</Badge></div><p className="mt-2 text-sm font-semibold text-foreground">{table.name}</p><p className="mt-1 text-xs text-muted-foreground">{table.zone || 'Salón principal'} · {table.seats} puestos</p><button type="button" onClick={(event) => { event.stopPropagation(); void copyQrLink(table); }} className="absolute bottom-3 right-3 rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground" title="Ver enlace QR" aria-label={`Ver enlace QR de ${table.name}`}><QrCode className="size-4" /></button></div>; })}</div>}
                    {publicLink && <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/[0.03] p-4"><p className="text-xs font-black uppercase tracking-widest text-primary">Enlace público para clientes</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input readOnly value={publicLink} aria-label="Enlace público del menú" /><Button variant="outline" onClick={() => void navigator.clipboard.writeText(publicLink)}>Copiar</Button><a className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90" href={publicLink} target="_blank" rel="noreferrer">Abrir menú</a></div><p className="mt-2 text-xs text-muted-foreground">Este enlace abre la carta de la mesa y permite enviar pedidos sin iniciar sesión.</p></div>}
                  </section>
                  <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Nueva comanda</p><h2 className="mt-1 text-2xl font-black">{selectedTable ? `Mesa ${selectedTable.code}` : 'Selecciona una mesa'}</h2></div><ShoppingBag className="size-5 text-muted-foreground/40" /></div>{selectedTable && <div className="mb-4 rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{selectedTable.name} · {selectedTable.zone || 'Salón principal'} <span className="float-right font-bold text-foreground">{money(cartTotal)}</span></div>}<div className="max-h-[430px] space-y-4 overflow-y-auto pr-1">{menu.map((category) => <div key={category.id}><p className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground/70">{category.name}</p><div className="space-y-2">{category.items.filter((item) => item.isAvailable).map((item) => <button type="button" key={item.id} onClick={() => addToCart(item.id)} className="flex w-full items-center justify-between rounded-xl border border-border/60 p-3 text-left transition hover:border-primary/40 hover:bg-primary/[0.03]"><span><span className="block text-sm font-bold">{item.name}</span><span className="block text-xs text-muted-foreground">{item.prepStation}</span></span><span className="font-black text-primary">{money(item.price, item.currency)}</span></button>)}</div></div>)}{menu.length === 0 && <EmptyState icon={<Utensils className="size-8" />} title="Carta sin configurar" description="Crea las categorías y platillos en Carta para operar." />}</div><div className="mt-5 border-t border-border/60 pt-4">{cartLines.length > 0 && <div className="mb-3 space-y-2">{cartLines.map(({ item, quantity }) => <div key={item.id} className="flex items-center justify-between text-sm"><span>{quantity} × {item.name}</span><div className="flex items-center gap-2"><button type="button" onClick={() => removeFromCart(item.id)} className="rounded bg-muted px-2 py-0.5">−</button><button type="button" onClick={() => addToCart(item.id)} className="rounded bg-muted px-2 py-0.5">+</button></div></div>)}</div>}<Button className="w-full" disabled={!selectedTable || cartLines.length === 0} onClick={createOrder}><Send className="size-4" />Enviar comanda a cocina</Button></div></section>
                </div>}
                {tab === 'comandas' && <OrderBoard orders={orders} onSend={async (order) => { try { await restaurantService.sendToKitchen(order.id); await loadData(); } catch (error: unknown) { toast.error(getApiErrorMessage(error, 'No se pudo enviar a cocina.')); } }} onStatus={changeOrderStatus} onCheckout={openCheckout} />}
                {tab === 'cocina' && <KitchenBoard tickets={tickets} onStatus={updateKitchen} />}
                {tab === 'carta' && <MenuBoard menu={menu} onSaved={() => loadData()} />}
                {tab === 'reportes' && <ReportsBoard summary={summary} />}
              </motion.div>
            </AnimatePresence>
          </Tabs>
        </div>
      </main>

      {checkoutOrder && <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"><div className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Cobro POS</p><h2 className="mt-1 text-2xl font-black">Pedido {checkoutOrder.number}</h2></div><button type="button" onClick={() => setCheckoutOrder(null)} className="rounded-xl p-2 hover:bg-muted" aria-label="Cerrar cobro"><X className="size-5" /></button></div><div className="my-5 rounded-2xl bg-primary p-5 text-primary-foreground"><p className="text-xs uppercase tracking-widest text-primary-foreground/70">Total a cobrar</p><p className="mt-1 text-3xl font-black">{money(checkoutOrder.total, checkoutOrder.currency)}</p></div><label className="text-sm font-bold">Caja registradora<select value={checkoutRegisterId} onChange={(event) => setCheckoutRegisterId(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">{registers.length === 0 && <option value="">No hay cajas disponibles</option>}{registers.map((register) => <option key={register.id} value={register.id}>{register.name}</option>)}</select></label><p className="mt-3 text-xs leading-5 text-muted-foreground">El cobro valida la sesión activa, emite la factura POS, descuenta inventario y genera el asiento contable existente.</p><Button className="mt-5 w-full" disabled={!checkoutRegisterId} onClick={checkout}><CreditCard className="size-4" />Cobrar en efectivo</Button></div></div>}
    </div>
  );
}

function NoAccessState() {
  return (
    <div className="flex flex-1 items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-2xl border border-border/60 bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
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

function OrderBoard({ orders, onSend, onStatus, onCheckout }: { orders: RestaurantOrder[]; onSend: (order: RestaurantOrder) => void; onStatus: (order: RestaurantOrder, status: string) => void; onCheckout: (order: RestaurantOrder) => void }) {
  return <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Flujo de servicio</p><h2 className="mt-1 text-2xl font-black">Comandas recientes</h2></div><ClipboardList className="size-6 text-muted-foreground/40" /></div>{orders.length === 0 ? <EmptyState icon={<ClipboardList className="size-8" />} title="No hay comandas" description="Las comandas creadas desde Salón y POS aparecerán aquí." /> : <div className="grid gap-3 lg:grid-cols-2">{orders.map((order) => <div key={order.id} className="rounded-2xl border border-border/60 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-black">{order.number}</p><p className="text-xs text-muted-foreground">{order.table ? `Mesa ${order.table.code} · ${order.table.name}` : order.type}</p></div><Badge variant="outline">{orderStatus[order.status] || order.status}</Badge></div><div className="mt-4 space-y-1 text-sm">{order.items.map((item) => <div key={item.id} className="flex justify-between"><span>{Number(item.quantity)} × {item.description}</span><span className="font-semibold">{money(item.total, order.currency)}</span></div>)}</div><div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3"><span className="font-black">{money(order.total, order.currency)}</span><div className="flex gap-2">{['CONFIRMED', 'PENDING_CONFIRMATION'].includes(order.status) && <Button size="sm" variant="outline" onClick={() => onSend(order)}><Send className="size-3" />Cocina</Button>}{['READY', 'SERVED'].includes(order.status) && <Button size="sm" variant="outline" onClick={() => onCheckout(order)}><CreditCard className="size-3" />Cobrar</Button>}{order.status === 'READY' && <Button size="sm" onClick={() => onStatus(order, 'SERVED')}>Servido</Button>}</div></div></div>)}</div>}</section>;
}

function KitchenBoard({ tickets, onStatus }: { tickets: RestaurantKitchenTicket[]; onStatus: (ticket: RestaurantKitchenTicket, status: string) => void }) {
  const columns = ['PENDING', 'IN_PREPARATION', 'READY'];
  return <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm"><div className="mb-5"><p className="text-xs font-black uppercase tracking-widest text-primary">Kitchen display</p><h2 className="mt-1 text-2xl font-black">Centro de preparación</h2></div><div className="grid gap-4 lg:grid-cols-3">{columns.map((column) => <div key={column} className="min-h-64 rounded-2xl border border-border/50 bg-muted/20 p-3"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-black uppercase tracking-widest text-muted-foreground">{kitchenStatus[column].label}</span><Badge variant="outline">{tickets.filter((ticket) => ticket.status === column).length}</Badge></div><div className="space-y-3">{tickets.filter((ticket) => ticket.status === column).map((ticket) => <div key={ticket.id} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm"><div className="flex justify-between"><span className="font-black">{ticket.order.number}</span><span className="text-xs text-muted-foreground">{ticket.station}</span></div><p className="mt-1 text-xs text-muted-foreground">Mesa {ticket.order.table?.code || '—'}</p><div className="mt-3 space-y-1 text-sm">{ticket.items.map(({ item }) => <p key={item.description}>{Number(item.quantity)} × {item.description}</p>)}</div>{column === 'PENDING' && <Button className="mt-4 w-full" size="sm" onClick={() => onStatus(ticket, 'IN_PREPARATION')}><Clock3 className="size-3" />Iniciar</Button>}{column === 'IN_PREPARATION' && <Button className="mt-4 w-full" size="sm" onClick={() => onStatus(ticket, 'READY')}>Marcar listo</Button>}{column === 'READY' && <Button className="mt-4 w-full" size="sm" variant="secondary" onClick={() => onStatus(ticket, 'SERVED')}>Entregar</Button>}</div>)}</div></div>)}</div></section>;
}

function MenuBoard({ menu, onSaved }: { menu: RestaurantMenuCategory[]; onSaved: () => Promise<void> }) {
  const emptyForm = { categoryId: '', name: '', description: '', price: '', taxRate: '15', prepStation: 'KITCHEN' };
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');
  const [itemForm, setItemForm] = useState(emptyForm);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!itemForm.categoryId && menu[0]) setItemForm((current) => ({ ...current, categoryId: menu[0].id }));
  }, [itemForm.categoryId, menu]);

  const saveCategory = async () => {
    if (!categoryName.trim()) { toast.error('Escribe el nombre de la categoría.'); return; }
    setSaving(true);
    try {
      await restaurantService.createCategory({ name: categoryName.trim(), description: categoryDescription.trim() || undefined });
      setCategoryName(''); setCategoryDescription('');
      toast.success('Categoría creada.'); await onSaved();
    } catch (error: unknown) { toast.error(getApiErrorMessage(error, 'No se pudo crear la categoría.')); }
    finally { setSaving(false); }
  };

  const saveItem = async () => {
    const price = Number(itemForm.price);
    if (!itemForm.categoryId || !itemForm.name.trim() || !Number.isFinite(price) || price < 0) {
      toast.error('Completa categoría, nombre y un precio válido.'); return;
    }
    setSaving(true);
    try {
      if (editingItemId) {
        await restaurantService.updateMenuItem(editingItemId, { name: itemForm.name.trim(), description: itemForm.description.trim() || null, price, taxRate: Number(itemForm.taxRate) || 0, prepStation: itemForm.prepStation });
        toast.success('Platillo actualizado.');
      } else {
        await restaurantService.createMenuItem({ categoryId: itemForm.categoryId, name: itemForm.name.trim(), description: itemForm.description.trim() || undefined, price, taxRate: Number(itemForm.taxRate) || 0, prepStation: itemForm.prepStation });
        toast.success('Platillo agregado a la carta.');
      }
      setItemForm({ ...emptyForm, categoryId: itemForm.categoryId }); setEditingItemId(null); await onSaved();
    } catch (error: unknown) { toast.error(getApiErrorMessage(error, 'No se pudo guardar el platillo.')); }
    finally { setSaving(false); }
  };

  const editItem = (categoryId: string, item: RestaurantMenuItem) => {
    setEditingItemId(item.id);
    setItemForm({ categoryId, name: item.name, description: item.description || '', price: String(item.price), taxRate: String(item.taxRate || 0), prepStation: item.prepStation || 'KITCHEN' });
  };

  const toggleItem = async (item: RestaurantMenuItem) => {
    setSaving(true);
    try { await restaurantService.updateMenuItem(item.id, { isAvailable: !item.isAvailable }); toast.success(item.isAvailable ? 'Platillo ocultado del menú público.' : 'Platillo publicado en el menú.'); await onSaved(); }
    catch (error: unknown) { toast.error(getApiErrorMessage(error, 'No se pudo cambiar la disponibilidad.')); }
    finally { setSaving(false); }
  };

  return <section className="space-y-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-black uppercase tracking-widest text-primary">Administración de carta</p><h2 className="mt-1 text-2xl font-black">Menú, precios y estaciones</h2><p className="mt-1 text-sm text-muted-foreground">Los platillos disponibles también aparecen en el enlace público de cada mesa.</p></div><Settings2 className="size-6 text-muted-foreground/40" /></div>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <div className="space-y-5 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div><p className="text-xs font-black uppercase tracking-widest text-primary">Nueva categoría</p><h3 className="mt-1 text-lg font-black">Organiza tu carta</h3></div>
        <Input placeholder="Ej. Postres" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
        <Input placeholder="Descripción (opcional)" value={categoryDescription} onChange={(event) => setCategoryDescription(event.target.value)} />
        <Button className="w-full" onClick={saveCategory} disabled={saving}><Plus className="size-4" />Crear categoría</Button>
        <div className="border-t border-border/60 pt-4"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Categorías activas</p><div className="mt-3 flex flex-wrap gap-2">{menu.map((category) => <Badge key={category.id} variant="outline" className="rounded-full">{category.name} · {category.items.length}</Badge>)}{!menu.length && <span className="text-sm text-muted-foreground">Aún no hay categorías.</span>}</div></div>
      </div>
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-primary">{editingItemId ? 'Editar platillo' : 'Nuevo platillo'}</p><h3 className="mt-1 text-lg font-black">Contenido del menú</h3></div>{editingItemId && <Button variant="ghost" size="sm" onClick={() => { setEditingItemId(null); setItemForm({ ...emptyForm, categoryId: itemForm.categoryId }); }}>Cancelar</Button>}</div>
        <div className="grid gap-3 sm:grid-cols-2"><select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={itemForm.categoryId} onChange={(event) => setItemForm({ ...itemForm, categoryId: event.target.value })}><option value="">Selecciona categoría</option>{menu.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><Input placeholder="Nombre del platillo" value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })} /><Input placeholder="Descripción" value={itemForm.description} onChange={(event) => setItemForm({ ...itemForm, description: event.target.value })} /><Input type="number" min="0" step="0.01" placeholder="Precio NIO" value={itemForm.price} onChange={(event) => setItemForm({ ...itemForm, price: event.target.value })} /><Input type="number" min="0" max="100" step="0.01" placeholder="Impuesto %" value={itemForm.taxRate} onChange={(event) => setItemForm({ ...itemForm, taxRate: event.target.value })} /><select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={itemForm.prepStation} onChange={(event) => setItemForm({ ...itemForm, prepStation: event.target.value })}><option value="KITCHEN">Cocina</option><option value="GRILL">Parrilla</option><option value="FRYER">Freidora</option><option value="BAR">Bar</option></select></div>
        <Button className="mt-4" onClick={saveItem} disabled={saving || !menu.length}><Check className="size-4" />{editingItemId ? 'Guardar cambios' : 'Agregar platillo'}</Button>
      </div>
    </div>
    {!menu.length ? <EmptyState icon={<Utensils className="size-8" />} title="Carta sin configurar" description="Crea una categoría y luego agrega tus primeros platillos." /> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{menu.map((category) => <div key={category.id} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{category.name}</h3><p className="mt-1 text-xs text-muted-foreground">{category.description || 'Sin descripción'}</p></div><Badge variant="outline">{category.items.length}</Badge></div><div className="mt-4 space-y-2">{category.items.map((item) => <div key={item.id} className="rounded-xl border border-border/50 bg-muted/20 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.prepStation} · {item.productId ? 'Inventario vinculado' : 'Sin inventario vinculado'}</p></div><span className="shrink-0 font-black text-primary">{money(item.price, item.currency)}</span></div><div className="mt-3 flex items-center justify-between gap-2"><Badge className={item.isAvailable ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'}>{item.isAvailable ? 'Publicado' : 'Oculto'}</Badge><div className="flex gap-1"><Button variant="ghost" size="icon" className="size-8" onClick={() => editItem(category.id, item)} aria-label={`Editar ${item.name}`}><Pencil className="size-3.5" /></Button><Button variant="ghost" size="icon" className="size-8" onClick={() => void toggleItem(item)} disabled={saving} aria-label={item.isAvailable ? `Ocultar ${item.name}` : `Publicar ${item.name}`}>{item.isAvailable ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}</Button></div></div></div>)}</div></div>)}</div>}
  </section>;
}

function ReportsBoard({ summary }: { summary: RestaurantSummary | null }) {
  return <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm"><div className="mb-5"><p className="text-xs font-black uppercase tracking-widest text-primary">Rendimiento de restaurante</p><h2 className="mt-1 text-2xl font-black">Ventas y productos destacados</h2></div>{!summary ? <EmptyState icon={<BarChart3 className="size-8" />} title="Sin datos todavía" description="El resumen aparecerá cuando se registren comandas." /> : <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]"><div className="rounded-2xl bg-primary p-5 text-primary-foreground"><p className="text-xs uppercase tracking-widest text-primary-foreground/70">Ventas operativas</p><p className="mt-2 text-4xl font-black">{money(summary.total)}</p><p className="mt-2 text-sm text-primary-foreground/70">{summary.orders} comandas no canceladas</p><div className="mt-6 space-y-3 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{money(summary.subtotal)}</span></div><div className="flex justify-between"><span>Impuestos</span><span>{money(summary.tax)}</span></div></div></div><div><h3 className="font-black">Top de platillos</h3><div className="mt-3 space-y-2">{summary.topItems?.map((item) => <div key={item.description} className="flex items-center justify-between rounded-xl border border-border/60 p-3"><span className="text-sm font-semibold">{item.description}</span><span className="text-sm font-black">{money(item._sum.total)}</span></div>)}</div></div></div>}</section>;
}
