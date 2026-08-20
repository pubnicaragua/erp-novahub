import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  ChefHat,
  ClipboardList,
  Clock3,
  CreditCard,
  LayoutGrid,
  Plus,
  QrCode,
  RefreshCw,
  Send,
  Settings2,
  ShoppingBag,
  Utensils,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { useBranchScope } from '../hooks/useBranchScope';
import { getApiErrorMessage } from '../services/api';
import { cajaService } from '../services/caja.service';
import {
  restaurantService,
  type RestaurantKitchenTicket,
  type RestaurantMenuCategory,
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
  const { accessibleBranches, selectedBranchId, setSelectedBranchId } = useBranchScope();
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
      setTables(nextTables || []);
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
    const controller = new AbortController();
    // La carga inicial sincroniza la pantalla con el API; el abort evita
    // actualizar estado si el usuario cambia de módulo antes de responder.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData(controller.signal);
    return () => controller.abort();
  }, [loadData]);

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

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground"><RefreshCw className="mr-2 size-4 animate-spin" />Cargando Restaurante POS…</div>;

  return (
    <div className="min-h-full bg-[#f7f8fb] px-4 py-5 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <header className="overflow-hidden rounded-3xl bg-slate-950 p-5 text-white shadow-xl shadow-slate-200 sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-cyan-300"><ChefHat className="size-4" /> NovaHub Restaurante</div>
              <h1 className="max-w-2xl text-3xl font-black tracking-tight sm:text-5xl">Cada mesa, cada comanda, bajo control.</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Opera el salón, envía pedidos a cocina y cobra desde la misma sesión POS. El cobro reutiliza caja, inventario y contabilidad del ERP.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)} className="h-10 rounded-xl border border-white/15 bg-white/10 px-3 text-sm text-white outline-none">
                <option value="" className="text-slate-900">Todas las sucursales</option>
                {accessibleBranches.map((branch: { id: string; name: string }) => <option key={branch.id} value={branch.id} className="text-slate-900">{branch.name}</option>)}
              </select>
              <Button variant="secondary" size="sm" onClick={refresh} disabled={refreshing}><RefreshCw className={refreshing ? 'size-4 animate-spin' : 'size-4'} />Actualizar</Button>
            </div>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[['Mesas activas', openTables, 'de ' + tables.length], ['Comandas hoy', summary?.orders || 0, 'operativas'], ['Ventas del período', money(summary?.total), 'contabilizadas al cobrar'], ['En cocina', pendingTickets, 'pendientes']].map(([label, value, hint]) => (
              <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.07] p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p><p className="mt-2 text-2xl font-black">{value}</p><p className="mt-1 text-xs text-slate-400">{hint}</p></div>
            ))}
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${tab === id ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}><Icon className="size-4" />{label}</button>)}
        </nav>

        {tab === 'salon' && <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.7fr)]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Vista de salón</p><h2 className="mt-1 text-2xl font-black">Mesas y zonas</h2></div><Button size="sm" onClick={() => setShowTableForm((value) => !value)}><Plus className="size-4" />Nueva mesa</Button></div>
            {showTableForm && <div className="mb-5 grid gap-2 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4 sm:grid-cols-4"><Input placeholder="Código" value={newTable.code} onChange={(e) => setNewTable({ ...newTable, code: e.target.value })} /><Input placeholder="Nombre" value={newTable.name} onChange={(e) => setNewTable({ ...newTable, name: e.target.value })} /><Input placeholder="Zona" value={newTable.zone} onChange={(e) => setNewTable({ ...newTable, zone: e.target.value })} /><div className="flex gap-2"><Input type="number" min="1" placeholder="Sillas" value={newTable.seats} onChange={(e) => setNewTable({ ...newTable, seats: e.target.value })} /><Button onClick={createTable}>Guardar</Button></div></div>}
            {tables.length === 0 ? <EmptyState icon={<LayoutGrid className="size-8" />} title="Aún no hay mesas configuradas" description="Crea la primera mesa para comenzar a operar el salón." action={<Button size="sm" onClick={() => setShowTableForm(true)}><Plus className="size-4" />Crear mesa</Button>} /> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{tables.map((table) => { const status = tableStatus[table.status] || tableStatus.AVAILABLE; return <button key={table.id} onClick={() => setSelectedTableId(table.id)} className={`group relative min-h-32 rounded-2xl border-2 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${selectedTableId === table.id ? 'border-cyan-500 ring-4 ring-cyan-100' : 'border-slate-100'}`}><div className="flex items-start justify-between"><span className="text-2xl font-black">{table.code}</span><Badge className={status.className}>{status.label}</Badge></div><p className="mt-2 text-sm font-semibold text-slate-600">{table.name}</p><p className="mt-1 text-xs text-slate-400">{table.zone || 'Salón principal'} · {table.seats} puestos</p><button onClick={(event) => { event.stopPropagation(); void copyQrLink(table); }} className="absolute bottom-3 right-3 rounded-lg p-1.5 text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-900 group-hover:opacity-100" title="Copiar enlace QR"><QrCode className="size-4" /></button></button>; })}</div>}
          </section>
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Nueva comanda</p><h2 className="mt-1 text-2xl font-black">{selectedTable ? `Mesa ${selectedTable.code}` : 'Selecciona una mesa'}</h2></div><ShoppingBag className="size-5 text-slate-300" /></div>{selectedTable && <div className="mb-4 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">{selectedTable.name} · {selectedTable.zone || 'Salón principal'} <span className="float-right font-bold text-slate-700">{money(cartTotal)}</span></div>}<div className="max-h-[430px] space-y-4 overflow-y-auto pr-1">{menu.map((category) => <div key={category.id}><p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-400">{category.name}</p><div className="space-y-2">{category.items.filter((item) => item.isAvailable).map((item) => <button key={item.id} onClick={() => addToCart(item.id)} className="flex w-full items-center justify-between rounded-xl border border-slate-100 p-3 text-left transition hover:border-cyan-300 hover:bg-cyan-50/40"><span><span className="block text-sm font-bold">{item.name}</span><span className="block text-xs text-slate-400">{item.prepStation}</span></span><span className="font-black text-cyan-700">{money(item.price, item.currency)}</span></button>)}</div></div>)}{menu.length === 0 && <EmptyState icon={<Utensils className="size-8" />} title="Carta sin configurar" description="Crea las categorías y platillos en Carta para operar." />}</div><div className="mt-5 border-t border-slate-100 pt-4">{cartLines.length > 0 && <div className="mb-3 space-y-2">{cartLines.map(({ item, quantity }) => <div key={item.id} className="flex items-center justify-between text-sm"><span>{quantity} × {item.name}</span><div className="flex items-center gap-2"><button onClick={() => removeFromCart(item.id)} className="rounded bg-slate-100 px-2 py-0.5">−</button><button onClick={() => addToCart(item.id)} className="rounded bg-slate-100 px-2 py-0.5">+</button></div></div>)}</div>}<Button className="w-full" disabled={!selectedTable || cartLines.length === 0} onClick={createOrder}><Send className="size-4" />Enviar comanda a cocina</Button></div></section>
        </div>}

        {tab === 'comandas' && <OrderBoard orders={orders} onSend={async (order) => { try { await restaurantService.sendToKitchen(order.id); await loadData(); } catch (error: unknown) { toast.error(getApiErrorMessage(error, 'No se pudo enviar a cocina.')); } }} onStatus={changeOrderStatus} onCheckout={openCheckout} />}
        {tab === 'cocina' && <KitchenBoard tickets={tickets} onStatus={updateKitchen} />}
        {tab === 'carta' && <MenuBoard menu={menu} />}
        {tab === 'reportes' && <ReportsBoard summary={summary} />}
      </div>

      {checkoutOrder && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Cobro POS</p><h2 className="mt-1 text-2xl font-black">Pedido {checkoutOrder.number}</h2></div><button onClick={() => setCheckoutOrder(null)} className="rounded-xl p-2 hover:bg-slate-100"><X className="size-5" /></button></div><div className="my-5 rounded-2xl bg-slate-950 p-5 text-white"><p className="text-xs uppercase tracking-widest text-slate-400">Total a cobrar</p><p className="mt-1 text-3xl font-black">{money(checkoutOrder.total, checkoutOrder.currency)}</p></div><label className="text-sm font-bold">Caja registradora<select value={checkoutRegisterId} onChange={(event) => setCheckoutRegisterId(event.target.value)} className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">{registers.length === 0 && <option value="">No hay cajas disponibles</option>}{registers.map((register) => <option key={register.id} value={register.id}>{register.name}</option>)}</select></label><p className="mt-3 text-xs leading-5 text-slate-500">El cobro valida la sesión activa, emite la factura POS, descuenta inventario y genera el asiento contable existente.</p><Button className="mt-5 w-full" disabled={!checkoutRegisterId} onClick={checkout}><CreditCard className="size-4" />Cobrar en efectivo</Button></div></div>}
    </div>
  );
}

function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center"><div className="mb-3 rounded-2xl bg-white p-3 text-slate-300 shadow-sm">{icon}</div><p className="font-black text-slate-700">{title}</p><p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

function OrderBoard({ orders, onSend, onStatus, onCheckout }: { orders: RestaurantOrder[]; onSend: (order: RestaurantOrder) => void; onStatus: (order: RestaurantOrder, status: string) => void; onCheckout: (order: RestaurantOrder) => void }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Flujo de servicio</p><h2 className="mt-1 text-2xl font-black">Comandas recientes</h2></div><ClipboardList className="size-6 text-slate-300" /></div>{orders.length === 0 ? <EmptyState icon={<ClipboardList className="size-8" />} title="No hay comandas" description="Las comandas creadas desde Salón y POS aparecerán aquí." /> : <div className="grid gap-3 lg:grid-cols-2">{orders.map((order) => <div key={order.id} className="rounded-2xl border border-slate-100 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-black">{order.number}</p><p className="text-xs text-slate-500">{order.table ? `Mesa ${order.table.code} · ${order.table.name}` : order.type}</p></div><Badge variant="outline">{orderStatus[order.status] || order.status}</Badge></div><div className="mt-4 space-y-1 text-sm">{order.items.map((item) => <div key={item.id} className="flex justify-between"><span>{Number(item.quantity)} × {item.description}</span><span className="font-semibold">{money(item.total, order.currency)}</span></div>)}</div><div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"><span className="font-black">{money(order.total, order.currency)}</span><div className="flex gap-2">{['CONFIRMED', 'PENDING_CONFIRMATION'].includes(order.status) && <Button size="sm" variant="outline" onClick={() => onSend(order)}><Send className="size-3" />Cocina</Button>}{['READY', 'SERVED'].includes(order.status) && <Button size="sm" variant="outline" onClick={() => onCheckout(order)}><CreditCard className="size-3" />Cobrar</Button>}{order.status === 'READY' && <Button size="sm" onClick={() => onStatus(order, 'SERVED')}>Servido</Button>}</div></div></div>)}</div>}</section>;
}

function KitchenBoard({ tickets, onStatus }: { tickets: RestaurantKitchenTicket[]; onStatus: (ticket: RestaurantKitchenTicket, status: string) => void }) {
  const columns = ['PENDING', 'IN_PREPARATION', 'READY'];
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5"><p className="text-xs font-bold uppercase tracking-widest text-orange-600">Kitchen display</p><h2 className="mt-1 text-2xl font-black">Centro de preparación</h2></div><div className="grid gap-4 lg:grid-cols-3">{columns.map((column) => <div key={column} className="min-h-64 rounded-2xl bg-slate-50 p-3"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-black uppercase tracking-widest text-slate-500">{kitchenStatus[column].label}</span><Badge variant="outline">{tickets.filter((ticket) => ticket.status === column).length}</Badge></div><div className="space-y-3">{tickets.filter((ticket) => ticket.status === column).map((ticket) => <div key={ticket.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex justify-between"><span className="font-black">{ticket.order.number}</span><span className="text-xs text-slate-400">{ticket.station}</span></div><p className="mt-1 text-xs text-slate-500">Mesa {ticket.order.table?.code || '—'}</p><div className="mt-3 space-y-1 text-sm">{ticket.items.map(({ item }) => <p key={item.description}>{Number(item.quantity)} × {item.description}</p>)}</div>{column === 'PENDING' && <Button className="mt-4 w-full" size="sm" onClick={() => onStatus(ticket, 'IN_PREPARATION')}><Clock3 className="size-3" />Iniciar</Button>}{column === 'IN_PREPARATION' && <Button className="mt-4 w-full" size="sm" onClick={() => onStatus(ticket, 'READY')}>Marcar listo</Button>}{column === 'READY' && <Button className="mt-4 w-full" size="sm" variant="secondary" onClick={() => onStatus(ticket, 'SERVED')}>Entregar</Button>}</div>)}</div></div>)}</div></section>;
}

function MenuBoard({ menu }: { menu: RestaurantMenuCategory[] }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Catálogo operativo</p><h2 className="mt-1 text-2xl font-black">Carta y estaciones</h2></div><Settings2 className="size-6 text-slate-300" /></div>{menu.length === 0 ? <EmptyState icon={<Utensils className="size-8" />} title="Carta sin configurar" description="Configura categorías y platillos desde la administración de carta." /> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{menu.map((category) => <div key={category.id} className="rounded-2xl border border-slate-100 p-4"><h3 className="font-black">{category.name}</h3><p className="mt-1 text-xs text-slate-500">{category.description || 'Sin descripción'}</p><div className="mt-4 space-y-2">{category.items.map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><div><p className="text-sm font-bold">{item.name}</p><p className="text-xs text-slate-500">{item.prepStation} · {item.productId ? 'Inventario vinculado' : 'Requiere vincular inventario'}</p></div><span className="font-black text-cyan-700">{money(item.price, item.currency)}</span></div>)}</div></div>)}</div>}</section>;
}

function ReportsBoard({ summary }: { summary: RestaurantSummary | null }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-5"><p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Rendimiento de restaurante</p><h2 className="mt-1 text-2xl font-black">Ventas y productos destacados</h2></div>{!summary ? <EmptyState icon={<BarChart3 className="size-8" />} title="Sin datos todavía" description="El resumen aparecerá cuando se registren comandas." /> : <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]"><div className="rounded-2xl bg-slate-950 p-5 text-white"><p className="text-xs uppercase tracking-widest text-slate-400">Ventas operativas</p><p className="mt-2 text-4xl font-black">{money(summary.total)}</p><p className="mt-2 text-sm text-slate-400">{summary.orders} comandas no canceladas</p><div className="mt-6 space-y-3 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{money(summary.subtotal)}</span></div><div className="flex justify-between"><span>Impuestos</span><span>{money(summary.tax)}</span></div></div></div><div><h3 className="font-black">Top de platillos</h3><div className="mt-3 space-y-2">{summary.topItems?.map((item) => <div key={item.description} className="flex items-center justify-between rounded-xl border border-slate-100 p-3"><span className="text-sm font-semibold">{item.description}</span><span className="text-sm font-black">{money(item._sum.total)}</span></div>)}</div></div></div>}</section>;
}
