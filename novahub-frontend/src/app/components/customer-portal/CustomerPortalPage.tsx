import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Boxes, Building2, CalendarDays, CheckCircle2, FileText, LogOut, Package, RefreshCw, ShieldCheck, Store, WalletCards } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { customerPortalService, type CustomerPortalInventoryRow, type CustomerPortalSummary } from '../../services/customer-portal.service';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';

type PortalTab = 'summary' | 'inventory' | 'sales';

const emptySummary: CustomerPortalSummary = {
  currency: 'NIO',
  today: { sales: 0, invoices: 0 },
  month: { sales: 0, invoices: 0 },
  totalInvoiced: 0,
  totalPaid: 0,
  pendingBalance: 0,
  returnsTotal: 0,
  creditNotesTotal: 0,
};

const dateLabel = (value: unknown) => {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' });
};

export function CustomerPortalPage() {
  const { user, logout } = useAuth();
  const { formatAmount } = useCurrency();
  const [tab, setTab] = useState<PortalTab>('summary');
  const [summary, setSummary] = useState<CustomerPortalSummary>(emptySummary);
  const [inventory, setInventory] = useState<CustomerPortalInventoryRow[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [customer, setCustomer] = useState<any>(null);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPortal = async () => {
    setLoading(true);
    setError('');
    try {
      const [me, summaryResponse, inventoryResponse, salesResponse] = await Promise.all([
        customerPortalService.getMe(),
        customerPortalService.getSummary(),
        customerPortalService.getInventory(),
        customerPortalService.getSales(),
      ]);
      setCustomer(me.customer);
      setBrands(me.brands || []);
      setSummary(summaryResponse || emptySummary);
      setInventory(inventoryResponse?.data || []);
      setSales(salesResponse?.data || []);
    } catch (loadError: any) {
      setError(loadError?.message || 'No se pudo cargar la información de tus marcas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadPortal(); }, []);

  const availableUnits = useMemo(() => inventory.reduce((sum, product) => sum + product.inventory.reduce((stock, level) => stock + Number(level.available || 0), 0), 0), [inventory]);
  const money = (value: number, sourceCurrency?: string, sourceExchangeRate?: number) => formatAmount(Number(value || 0), sourceCurrency as any, sourceExchangeRate);
  const summaryMoney = (value: number) => money(value, summary.currency);

  const handleLogout = () => {
    logout();
    window.location.reload();
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-primary/10 via-background to-background text-foreground">
      <div className="mx-auto min-h-screen w-full max-w-[1500px] px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-4 flex items-center gap-3">
              {user?.clientTenant?.logo ? <img src={user.clientTenant.logo} alt="" className="size-11 rounded-2xl object-cover shadow-sm" /> : <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><Store className="size-5" /></div>}
              <div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Nova Hub · Vista de propietario</p><p className="text-xs text-muted-foreground">{user?.clientTenant?.name || 'Tienda colectiva'}</p></div>
            </div>
            <h1 className="max-w-3xl text-3xl font-black uppercase tracking-tight sm:text-5xl">Tu operación, en una sola vista.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Consulta el inventario disponible, las ventas y las facturas de los productos que pertenecen a <span className="font-bold text-foreground">{customer?.name || user?.name || 'tu cuenta'}</span>.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className="h-9 gap-2 rounded-full border-primary/30 bg-primary/5 px-3 text-primary"><ShieldCheck className="size-3.5" /> Solo lectura</Badge>
            <Button variant="outline" className="h-9 gap-2 rounded-full" onClick={handleLogout}><LogOut className="size-4" /> Salir</Button>
          </div>
        </header>

        <nav className="mb-6 flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-border/60 bg-card/70 p-1.5 shadow-sm" aria-label="Secciones del portal">
          {([
            ['summary', 'Resumen', BarChart3],
            ['inventory', 'Inventario', Boxes],
            ['sales', 'Ventas y facturas', FileText],
          ] as const).map(([value, label, Icon]) => <button key={value} type="button" onClick={() => setTab(value)} aria-pressed={tab === value} className={`flex-none rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-colors ${tab === value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><Icon className="mr-2 inline size-4" />{label}</button>)}
        </nav>

        {error && <Card className="mb-6 border-destructive/30 bg-destructive/5"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><span>{error}</span><Button variant="outline" size="sm" onClick={() => void loadPortal()}><RefreshCw className="mr-2 size-4" /> Reintentar</Button></CardContent></Card>}

        {loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Card className="h-32 animate-pulse bg-muted/40" /><Card className="h-32 animate-pulse bg-muted/40" /><Card className="h-32 animate-pulse bg-muted/40" /><Card className="h-32 animate-pulse bg-muted/40" /></div> : <>
          {tab === 'summary' && <div className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard icon={CalendarDays} label="Ventas de hoy" value={summaryMoney(summary.today.sales)} detail={`${summary.today.invoices} factura${summary.today.invoices === 1 ? '' : 's'}`} />
              <SummaryCard icon={BarChart3} label="Ventas del mes" value={summaryMoney(summary.month.sales)} detail={`${summary.month.invoices} factura${summary.month.invoices === 1 ? '' : 's'}`} />
              <SummaryCard icon={Package} label="Unidades disponibles" value={availableUnits.toLocaleString('es-NI')} detail={`${inventory.length} productos asignados`} />
              <SummaryCard icon={WalletCards} label="Saldo pendiente" value={summaryMoney(summary.pendingBalance)} detail="Atribuido a tus líneas" accent />
            </section>
            <section className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
              <Card className="overflow-hidden rounded-3xl border-border/60 shadow-sm"><CardHeader className="border-b border-border/50"><CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest"><Building2 className="size-4 text-primary" /> Marcas asignadas</CardTitle></CardHeader><CardContent className="grid gap-3 p-5 sm:grid-cols-2">{brands.length ? brands.map((brand) => <div key={brand.id} className="rounded-2xl border border-border/60 bg-muted/20 p-4"><div className="flex items-center justify-between gap-3"><p className="truncate font-black uppercase tracking-tight">{brand.name}</p><Badge variant="secondary" className="shrink-0">{brand.productCount} prod.</Badge></div><p className="mt-2 text-xs text-muted-foreground">{Number(brand.availableUnits || 0).toLocaleString('es-NI')} unidades disponibles</p></div>) : <EmptyState text="Todavía no tienes marcas asignadas." />}</CardContent></Card>
              <Card className="rounded-3xl border-border/60 shadow-sm"><CardHeader><CardTitle className="text-sm font-black uppercase tracking-widest">Resumen financiero</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><Metric label="Total facturado" value={summaryMoney(summary.totalInvoiced)} /><Metric label="Total pagado" value={summaryMoney(summary.totalPaid)} tone="text-emerald-600" /><Metric label="Devoluciones" value={summaryMoney(summary.returnsTotal)} tone="text-amber-600" /><Metric label="Notas de crédito" value={summaryMoney(summary.creditNotesTotal)} tone="text-rose-600" /><p className="border-t border-border/50 pt-3 text-xs leading-5 text-muted-foreground">Los importes se calculan únicamente sobre las líneas de venta atribuidas a tus productos. Los costos de compra y las operaciones de otros propietarios no están disponibles.</p></CardContent></Card>
            </section>
          </div>}

          {tab === 'inventory' && <PortalInventory inventory={inventory} />}
          {tab === 'sales' && <PortalSales sales={sales} money={money} />}
        </>}
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, detail, accent = false }: { icon: typeof BarChart3; label: string; value: string; detail: string; accent?: boolean }) {
  return <Card className={`rounded-3xl border-border/60 shadow-sm transition-transform hover:-translate-y-0.5 ${accent ? 'bg-primary/[0.08]' : 'bg-card/80'}`}><CardContent className="p-5"><div className="mb-6 flex items-center justify-between"><span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{label}</span><span className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="size-4" /></span></div><p className="truncate text-2xl font-black tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card>;
}

function Metric({ label, value, tone = 'text-foreground' }: { label: string; value: string; tone?: string }) { return <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className={`font-black ${tone}`}>{value}</span></div>; }

function EmptyState({ text }: { text: string }) { return <div className="col-span-full rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>; }

function PortalInventory({ inventory }: { inventory: CustomerPortalInventoryRow[] }) {
  return <Card className="rounded-3xl border-border/60 shadow-sm"><CardHeader className="flex flex-col gap-2 border-b border-border/50 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-sm font-black uppercase tracking-widest">Inventario disponible</CardTitle><p className="mt-1 text-xs text-muted-foreground">Cantidad física menos unidades reservadas, por bodega.</p></div><Badge variant="outline" className="w-fit rounded-full">{inventory.length} productos</Badge></CardHeader><CardContent className="p-0">{inventory.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><tr><th className="px-5 py-4">Producto</th><th className="px-5 py-4">Marca</th><th className="px-5 py-4">Bodega</th><th className="px-5 py-4 text-right">Cantidad</th><th className="px-5 py-4 text-right">Reservado</th><th className="px-5 py-4 text-right">Disponible</th></tr></thead><tbody className="divide-y divide-border/50">{inventory.flatMap((product) => product.inventory.length ? product.inventory.map((level, index) => <tr key={`${product.id}-${level.warehouseId || index}`} className="hover:bg-muted/20"><td className="px-5 py-4"><p className="font-bold">{product.name}</p><p className="text-xs text-muted-foreground">{product.code}</p></td><td className="px-5 py-4 text-muted-foreground">{product.brandName || 'Sin marca'}</td><td className="px-5 py-4 text-muted-foreground">{level.warehouseName}</td><td className="px-5 py-4 text-right">{level.quantity.toLocaleString('es-NI')}</td><td className="px-5 py-4 text-right text-amber-600">{level.reserved.toLocaleString('es-NI')}</td><td className="px-5 py-4 text-right font-black text-primary">{level.available.toLocaleString('es-NI')}</td></tr>) : [<tr key={`${product.id}-empty`}><td className="px-5 py-4"><p className="font-bold">{product.name}</p><p className="text-xs text-muted-foreground">{product.code}</p></td><td className="px-5 py-4 text-muted-foreground">{product.brandName || 'Sin marca'}</td><td className="px-5 py-4 text-muted-foreground">Sin existencias registradas</td><td colSpan={3} className="px-5 py-4 text-right text-muted-foreground">0</td></tr>])}</tbody></table></div> : <EmptyState text="No hay productos asignados a tu cuenta." />}</CardContent></Card>;
}

function PortalSales({ sales, money }: { sales: any[]; money: (value: number, sourceCurrency?: string, sourceExchangeRate?: number) => string }) {
  return <Card className="rounded-3xl border-border/60 shadow-sm"><CardHeader className="flex flex-col gap-2 border-b border-border/50 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-sm font-black uppercase tracking-widest">Ventas y facturas</CardTitle><p className="mt-1 text-xs text-muted-foreground">Solo se muestran las líneas atribuidas a tus productos.</p></div><Badge variant="outline" className="w-fit rounded-full">{sales.length} documentos</Badge></CardHeader><CardContent className="p-0">{sales.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><tr><th className="px-5 py-4">Fecha</th><th className="px-5 py-4">Factura</th><th className="px-5 py-4">Productos</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4 text-right">Total atribuido</th></tr></thead><tbody className="divide-y divide-border/50">{sales.map((invoice) => <tr key={invoice.id} className="hover:bg-muted/20"><td className="px-5 py-4 text-muted-foreground">{dateLabel(invoice.date)}</td><td className="px-5 py-4 font-bold">{invoice.number}</td><td className="max-w-[280px] px-5 py-4"><p className="truncate font-medium">{(invoice.items || []).map((item: any) => item.description).join(', ') || '—'}</p><p className="mt-1 text-xs text-muted-foreground">{(invoice.items || []).length} línea{(invoice.items || []).length === 1 ? '' : 's'}</p></td><td className="px-5 py-4"><Badge variant={String(invoice.status).toUpperCase() === 'PAID' ? 'default' : 'secondary'} className="gap-1 rounded-full"><CheckCircle2 className="size-3" />{String(invoice.status || '').toLowerCase()}</Badge></td><td className="px-5 py-4 text-right font-black">{money(invoice.total, invoice.currency, invoice.exchangeRate)}</td></tr>)}</tbody></table></div> : <EmptyState text="Todavía no hay ventas atribuidas a tus productos." />}</CardContent></Card>;
}
