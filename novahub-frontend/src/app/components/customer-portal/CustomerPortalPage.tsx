import { Fragment, useEffect, useMemo, useState } from 'react';
import { BarChart3, Boxes, Building2, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, DollarSign, Download, FileSpreadsheet, FileText, Loader2, LogOut, Package, RefreshCw, ShieldCheck, Store, WalletCards } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { customerPortalService, type CustomerPortalInventoryRow, type CustomerPortalInventoryVariant, type CustomerPortalSummary } from '../../services/customer-portal.service';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { toast } from 'sonner';

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

const salesStatusLabel = (value: unknown) => {
  const normalized = String(value || '').toUpperCase();
  const labels: Record<string, string> = { PAID: 'Pagada', PARTIALLY_PAID: 'Pagada parcialmente', ISSUED: 'Emitida', POSTED: 'Registrada', OPEN: 'Pendiente', OVERDUE: 'Vencida', CANCELLED: 'Cancelada', DRAFT: 'Borrador' };
  return labels[normalized] || normalized.replace(/_/g, ' ').toLowerCase() || 'Sin estado';
};

export function CustomerPortalPage() {
  const { user, logout } = useAuth();
  const { formatAmount } = useCurrency();
  const [tab, setTab] = useState<PortalTab>('summary');
  const [summary, setSummary] = useState<CustomerPortalSummary>(emptySummary);
  const [inventory, setInventory] = useState<CustomerPortalInventoryRow[]>([]);
  const [inventoryCurrency, setInventoryCurrency] = useState('NIO');
  const [sales, setSales] = useState<any[]>([]);
  const [customer, setCustomer] = useState<any>(null);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);

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
      setInventoryCurrency(inventoryResponse?.currency || summaryResponse?.currency || 'NIO');
      setInventory(inventoryResponse?.data || []);
      setSales(salesResponse?.data || []);
    } catch (loadError: any) {
      setError(loadError?.message || 'No se pudo cargar la información de tus marcas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadPortal(); }, []);

  const availableUnits = useMemo(() => inventory.reduce((sum, product) => {
    const fallback = product.inventory.reduce((stock, level) => stock + Number(level.available || 0), 0);
    return sum + (Number.isFinite(Number(product.available)) ? Number(product.available) : fallback);
  }, 0), [inventory]);
  const money = (value: number, sourceCurrency?: string, sourceExchangeRate?: number) => formatAmount(Number(value || 0), sourceCurrency as any, sourceExchangeRate);
  const summaryMoney = (value: number) => money(value, summary.currency);

  const exportPortal = async (format: 'excel' | 'pdf') => {
    setExporting(format);
    try {
      const exportOptions = {
        customerName: customer?.name || user?.name || 'Mi cuenta',
        tenantName: user?.clientTenant?.name || 'NovaHub',
        tenantLogo: user?.clientTenant?.logo || null,
        summary,
        inventory,
        sales,
        currency: inventoryCurrency || summary.currency || 'NIO',
        money,
      };
      const { exportCustomerPortalExcel, exportCustomerPortalPdf } = await import('../../utils/customerPortalExport');
      if (format === 'excel') {
        await exportCustomerPortalExcel(exportOptions);
        toast.success('Excel del portal descargado.');
      } else {
        await exportCustomerPortalPdf(exportOptions);
        toast.success('PDF del portal descargado.');
      }
    } catch (exportError: any) {
      toast.error(exportError?.message || 'No se pudo generar la exportación.');
    } finally {
      setExporting(null);
    }
  };

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
              <div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Nova Hub · Mi portal</p><p className="text-xs text-muted-foreground">{user?.clientTenant?.name || 'Mi empresa'}</p></div>
            </div>
            <h1 className="max-w-3xl text-3xl font-black uppercase tracking-tight sm:text-5xl">Mi operación, en una sola vista.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Aquí puedes consultar tu inventario, tus ventas y tus facturas en un solo lugar.</p>
          </div>
          <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
            <Badge variant="outline" className="h-9 gap-2 rounded-full border-primary/30 bg-primary/5 px-3 text-primary"><ShieldCheck className="size-3.5" /> Solo lectura</Badge>
            <Button variant="outline" className="h-9 gap-2 rounded-full" onClick={() => void exportPortal('excel')} disabled={loading || exporting !== null} title="Descargar resumen, inventario y ventas en Excel"><FileSpreadsheet className="size-4 text-emerald-600" />{exporting === 'excel' ? <Loader2 className="size-4 animate-spin" /> : 'Excel'}</Button>
            <Button variant="outline" className="h-9 gap-2 rounded-full" onClick={() => void exportPortal('pdf')} disabled={loading || exporting !== null} title="Descargar resumen, inventario y ventas en PDF"><Download className="size-4 text-rose-600" />{exporting === 'pdf' ? <Loader2 className="size-4 animate-spin" /> : 'PDF'}</Button>
            <Button variant="outline" className="h-9 gap-2 rounded-full" onClick={handleLogout}><LogOut className="size-4" /> Salir</Button>
          </div>
        </header>

        <nav className="mb-6 flex max-w-full gap-2 overflow-x-auto rounded-2xl border border-border/60 bg-card/70 p-1.5 shadow-sm" aria-label="Secciones del portal">
          {([
            ['summary', 'Mi resumen', BarChart3],
            ['inventory', 'Mi inventario', Boxes],
            ['sales', 'Mis ventas y facturas', FileText],
          ] as const).map(([value, label, Icon]) => <button key={value} type="button" onClick={() => setTab(value)} aria-pressed={tab === value} className={`flex-none rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-colors ${tab === value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><Icon className="mr-2 inline size-4" />{label}</button>)}
        </nav>

        {error && <Card className="mb-6 border-destructive/30 bg-destructive/5"><CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><span>{error}</span><Button variant="outline" size="sm" onClick={() => void loadPortal()}><RefreshCw className="mr-2 size-4" /> Reintentar</Button></CardContent></Card>}

        {loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Card className="h-32 animate-pulse bg-muted/40" /><Card className="h-32 animate-pulse bg-muted/40" /><Card className="h-32 animate-pulse bg-muted/40" /><Card className="h-32 animate-pulse bg-muted/40" /></div> : <>
          {tab === 'summary' && <div className="space-y-6">
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard icon={CalendarDays} label="Mis ventas de hoy" value={summaryMoney(summary.today.sales)} detail={`${summary.today.invoices} factura${summary.today.invoices === 1 ? '' : 's'}`} />
              <SummaryCard icon={BarChart3} label="Mis ventas del mes" value={summaryMoney(summary.month.sales)} detail={`${summary.month.invoices} factura${summary.month.invoices === 1 ? '' : 's'}`} />
              <SummaryCard icon={Package} label="Mis unidades disponibles" value={availableUnits.toLocaleString('es-NI')} detail={`${inventory.length} productos agrupados`} />
              <SummaryCard icon={WalletCards} label="Mi saldo pendiente" value={summaryMoney(summary.pendingBalance)} detail="De mis líneas" accent />
            </section>
            <section className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
              <Card className="overflow-hidden rounded-3xl border-border/60 shadow-sm"><CardHeader className="border-b border-border/50"><CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest"><Building2 className="size-4 text-primary" /> Mis marcas</CardTitle></CardHeader><CardContent className="grid gap-3 p-5 sm:grid-cols-2">{brands.length ? brands.map((brand) => <div key={brand.id} className="rounded-2xl border border-border/60 bg-muted/20 p-4"><div className="flex items-center justify-between gap-3"><p className="truncate font-black uppercase tracking-tight">{brand.name}</p><Badge variant="secondary" className="shrink-0">{brand.productCount} prod.</Badge></div><p className="mt-2 text-xs text-muted-foreground">{Number(brand.availableUnits || 0).toLocaleString('es-NI')} unidades disponibles</p></div>) : <EmptyState text="Todavía no tienes marcas asignadas." />}</CardContent></Card>
              <Card className="rounded-3xl border-border/60 shadow-sm"><CardHeader><CardTitle className="text-sm font-black uppercase tracking-widest">Mi resumen financiero</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><Metric label="Total de mis facturas" value={summaryMoney(summary.totalInvoiced)} /><Metric label="Total que he pagado" value={summaryMoney(summary.totalPaid)} tone="text-emerald-600" /><Metric label="Mis devoluciones" value={summaryMoney(summary.returnsTotal)} tone="text-amber-600" /><Metric label="Mis notas de crédito" value={summaryMoney(summary.creditNotesTotal)} tone="text-rose-600" /><p className="border-t border-border/50 pt-3 text-xs leading-5 text-muted-foreground">Mis importes se calculan únicamente sobre las líneas de venta asociadas a mis productos. El costo configurado está disponible en Mi inventario.</p></CardContent></Card>
            </section>
          </div>}

          {tab === 'inventory' && <PortalInventory inventory={inventory} currency={inventoryCurrency} money={money} />}
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

type PortalInventoryTotals = { quantity: number; reserved: number; available: number; inventoryValue: number; availableInventoryValue: number };

const portalVariantWarehouseRows = (variant: CustomerPortalInventoryVariant) => {
  const grouped = new Map<string, { warehouseId?: string | null; warehouseName: string; quantity: number; reserved: number; available: number }>();
  for (const level of variant.inventory || []) {
    const key = String(level.warehouseId || level.warehouseName || 'warehouse');
    const current = grouped.get(key);
    if (current) {
      current.quantity += Number(level.quantity || 0);
      current.reserved += Number(level.reserved || 0);
      current.available += Number(level.available || 0);
    } else {
      grouped.set(key, {
        warehouseId: level.warehouseId,
        warehouseName: level.warehouseName || 'Bodega',
        quantity: Number(level.quantity || 0),
        reserved: Number(level.reserved || 0),
        available: Number(level.available || 0),
      });
    }
  }
  return [...grouped.values()];
};

const portalInventoryLevelTotals = (levels: CustomerPortalInventoryRow['inventory']) => levels.reduce((totals, level) => ({
  quantity: totals.quantity + Number(level.quantity || 0),
  reserved: totals.reserved + Number(level.reserved || 0),
  available: totals.available + Number(level.available || 0),
}), { quantity: 0, reserved: 0, available: 0 });

const portalProductTotals = (product: CustomerPortalInventoryRow): PortalInventoryTotals => {
  const fallback = portalInventoryLevelTotals(product.inventory || []);
  return {
    quantity: Number.isFinite(Number(product.quantity)) ? Number(product.quantity) : fallback.quantity,
    reserved: Number.isFinite(Number(product.reserved)) ? Number(product.reserved) : fallback.reserved,
    available: Number.isFinite(Number(product.available)) ? Number(product.available) : fallback.available,
    inventoryValue: Number.isFinite(Number(product.inventoryValue)) ? Number(product.inventoryValue) : 0,
    availableInventoryValue: Number.isFinite(Number(product.availableInventoryValue)) ? Number(product.availableInventoryValue) : 0,
  };
};

function PortalInventory({ inventory, currency, money }: { inventory: CustomerPortalInventoryRow[]; currency: string; money: (value: number, sourceCurrency?: string, sourceExchangeRate?: number) => string }) {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  const quantityLabel = (value: number) => value.toLocaleString('es-NI', { maximumFractionDigits: 2 });
  const totals = useMemo(() => inventory.reduce((result, product) => {
    const current = portalProductTotals(product);
    return {
      quantity: result.quantity + current.quantity,
      reserved: result.reserved + current.reserved,
      available: result.available + current.available,
      inventoryValue: result.inventoryValue + current.inventoryValue,
      availableInventoryValue: result.availableInventoryValue + current.availableInventoryValue,
    };
  }, { quantity: 0, reserved: 0, available: 0, inventoryValue: 0, availableInventoryValue: 0 }), [inventory]);
  const variantCount = inventory.reduce((total, product) => total + (product.variants?.length || 0), 0);

  const toggleProduct = (productId: string) => {
    setExpandedProducts((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const attributesLabel = (attributes: CustomerPortalInventoryRow['variants'][number]['attributes']) => attributes.length
    ? attributes.map((attribute) => `${attribute.attributeName || attribute.name || 'Atributo'}: ${attribute.value || '—'}`).join(' · ')
    : 'Sin atributos';
  const costSourceLabel = (source: CustomerPortalInventoryRow['variants'][number]['costSource']) => source === 'VARIANT'
    ? 'Costo propio'
    : source === 'PRODUCT_PLUS_MODIFIER'
      ? 'Base + ajuste'
      : 'Heredado del producto';
  const formatCost = (value: number) => money(value, currency);

  return (
    <Card className="rounded-3xl border-border/60 shadow-sm">
      <CardHeader className="flex flex-col gap-2 border-b border-border/50 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-sm font-black uppercase tracking-widest">Mi inventario disponible</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Aquí ves tus productos agrupados, sus costos y el detalle de cada variante por bodega.</p>
        </div>
        <Badge variant="outline" className="w-fit rounded-full">{inventory.length} productos · {variantCount} variantes</Badge>
      </CardHeader>
      <CardContent className="p-0">
        {inventory.length ? (
          <>
            <div className="grid gap-3 border-b border-border/50 p-5 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard icon={Package} label="Unidades físicas" value={quantityLabel(totals.quantity)} detail="Existencia total" />
              <SummaryCard icon={Boxes} label="Unidades disponibles" value={quantityLabel(totals.available)} detail={`${quantityLabel(totals.reserved)} reservadas`} />
              <SummaryCard icon={DollarSign} label="Valor del inventario" value={formatCost(totals.inventoryValue)} detail={`Costo físico · ${currency}`} />
              <SummaryCard icon={WalletCards} label="Valor disponible" value={formatCost(totals.availableInventoryValue)} detail={`Después de reservas · ${currency}`} accent />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead className="bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="w-12 px-3 py-4" aria-label="Detalles" />
                    <th className="px-4 py-4">Producto</th>
                    <th className="px-4 py-4">Marca</th>
                    <th className="px-4 py-4 text-right">Costo base</th>
                    <th className="px-4 py-4 text-right">Costo configurado</th>
                    <th className="px-4 py-4 text-right">Unidades</th>
                    <th className="px-4 py-4 text-right">Reservado</th>
                    <th className="px-4 py-4 text-right">Disponible</th>
                    <th className="px-4 py-4 text-right">Valor inventario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {inventory.map((product) => {
                    const isExpanded = expandedProducts.has(product.id);
                    const current = portalProductTotals(product);
                    const variants = product.variants || [];
                    return (
                      <Fragment key={product.id}>
                        <tr className="align-top hover:bg-muted/20">
                          <td className="px-3 py-4">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 rounded-lg"
                              aria-label={`${isExpanded ? 'Ocultar' : 'Mostrar'} variantes de ${product.name}`}
                              aria-expanded={isExpanded}
                              onClick={() => toggleProduct(product.id)}
                            >
                              {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                            </Button>
                          </td>
                          <td className="px-4 py-4">
                            <p className="font-bold text-foreground">{product.name}</p>
                            <p className="font-mono text-xs text-muted-foreground">{product.code}</p>
                            <p className="mt-1 text-[10px] text-muted-foreground">{variants.length} variante{variants.length === 1 ? '' : 's'} · abre para ver el detalle</p>
                          </td>
                          <td className="px-4 py-4 text-muted-foreground">{product.brandName || 'Sin marca'}</td>
                          <td className="px-4 py-4 text-right">
                            <p className="font-semibold tabular-nums">{formatCost(product.costPrice)}</p>
                            <p className="text-[10px] text-muted-foreground">Base del producto</p>
                          </td>
                          <td className="px-4 py-4 text-right">
                            {product.configuredCost === null ? <span className="text-xs text-muted-foreground">Varía por variante</span> : <p className="font-semibold tabular-nums">{formatCost(product.configuredCost)}</p>}
                          </td>
                          <td className="px-4 py-4 text-right font-mono tabular-nums">{quantityLabel(current.quantity)}</td>
                          <td className="px-4 py-4 text-right font-mono tabular-nums text-amber-600">{quantityLabel(current.reserved)}</td>
                          <td className="px-4 py-4 text-right font-black tabular-nums text-primary">{quantityLabel(current.available)}</td>
                          <td className="px-4 py-4 text-right font-black tabular-nums">{formatCost(current.inventoryValue)}</td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${product.id}-details`} className="bg-muted/10">
                            <td colSpan={9} className="p-0">
                              <div className="border-y border-border/40 px-4 py-4 sm:px-6">
                                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <p className="text-xs font-black uppercase tracking-widest text-primary">Mis variantes</p>
                                    <p className="mt-1 text-xs text-muted-foreground">Cada variante aparece una sola vez y reúne sus bodegas, SKU, atributos y costos.</p>
                                  </div>
                                  <Badge variant="secondary" className="rounded-full">{variants.length} variante{variants.length === 1 ? '' : 's'}</Badge>
                                </div>
                                <div className="overflow-x-auto rounded-2xl border border-border/50 bg-background/60">
                                  <table className="w-full min-w-[940px] text-xs">
                                    <thead className="bg-muted/40 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                      <tr>
                                        <th className="px-3 py-3">Variante / SKU</th>
                                        <th className="px-3 py-3">Atributos</th>
                                        <th className="px-3 py-3">Bodegas</th>
                                        <th className="px-3 py-3 text-right">Costo configurado</th>
                                        <th className="px-3 py-3 text-right">Cantidad</th>
                                        <th className="px-3 py-3 text-right">Reservado</th>
                                        <th className="px-3 py-3 text-right">Disponible</th>
                                        <th className="px-3 py-3 text-right">Valor</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                      {variants.map((variant) => {
                                        const warehouses = portalVariantWarehouseRows(variant);
                                        const variantTotals = portalInventoryLevelTotals(variant.inventory || []);
                                        const quantity = Number.isFinite(Number(variant.quantity)) ? Number(variant.quantity) : variantTotals.quantity;
                                        const reserved = Number.isFinite(Number(variant.reserved)) ? Number(variant.reserved) : variantTotals.reserved;
                                        const available = Number.isFinite(Number(variant.available)) ? Number(variant.available) : variantTotals.available;
                                        return (
                                          <tr key={variant.id} className="align-top hover:bg-muted/20">
                                            <td className="max-w-[210px] px-3 py-3">
                                              <p className="font-bold">{variant.name}</p>
                                              <p className="font-mono text-[10px] text-muted-foreground">{variant.sku}</p>
                                            </td>
                                            <td className="max-w-[240px] px-3 py-3 break-words text-muted-foreground [overflow-wrap:anywhere]">{attributesLabel(variant.attributes)}</td>
                                            <td className="min-w-[230px] px-3 py-3 text-muted-foreground">
                                              {warehouses.length ? <div className="space-y-1.5">{warehouses.map((warehouse) => <div key={`${variant.id}-${warehouse.warehouseId || warehouse.warehouseName}`} className="rounded-lg border border-border/40 bg-muted/20 px-2 py-1"><span className="font-semibold text-foreground">{warehouse.warehouseName}</span><span className="ml-1">· {quantityLabel(warehouse.quantity)} u. · {quantityLabel(warehouse.available)} disp.</span></div>)}</div> : 'Sin existencias registradas'}
                                            </td>
                                            <td className="px-3 py-3 text-right">
                                              <p className="font-semibold tabular-nums">{formatCost(variant.configuredCost)}</p>
                                              <p className="text-[10px] text-muted-foreground">Base: {formatCost(variant.baseCost)}</p>
                                              <Badge variant="outline" className="mt-1 rounded-full text-[9px]">{costSourceLabel(variant.costSource)}</Badge>
                                            </td>
                                            <td className="px-3 py-3 text-right font-mono tabular-nums">{quantityLabel(quantity)}</td>
                                            <td className="px-3 py-3 text-right font-mono tabular-nums text-amber-600">{quantityLabel(reserved)}</td>
                                            <td className="px-3 py-3 text-right font-black font-mono tabular-nums text-primary">{quantityLabel(available)}</td>
                                            <td className="px-3 py-3 text-right font-black tabular-nums">{formatCost(Number(variant.inventoryValue || quantity * variant.configuredCost))}</td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 border-border bg-muted/30 text-sm">
                  <tr>
                    <td colSpan={5} className="px-4 py-4 font-black uppercase tracking-widest">Recuento total de unidades</td>
                    <td className="px-4 py-4 text-right font-black tabular-nums">{quantityLabel(totals.quantity)}</td>
                    <td className="px-4 py-4 text-right font-black tabular-nums text-amber-600">{quantityLabel(totals.reserved)}</td>
                    <td className="px-4 py-4 text-right font-black tabular-nums text-primary">{quantityLabel(totals.available)}</td>
                    <td className="px-4 py-4 text-right font-black tabular-nums">{formatCost(totals.inventoryValue)}</td>
                  </tr>
                  <tr className="border-t border-border/50 text-xs">
                    <td colSpan={8} className="px-4 py-3 text-right text-muted-foreground">Valor total disponible después de reservas</td>
                    <td className="px-4 py-3 text-right font-black tabular-nums">{formatCost(totals.availableInventoryValue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : <EmptyState text="No hay productos asignados a tu cuenta." />}
      </CardContent>
    </Card>
  );
}

function PortalSales({ sales, money }: { sales: any[]; money: (value: number, sourceCurrency?: string, sourceExchangeRate?: number) => string }) {
  return <Card className="rounded-3xl border-border/60 shadow-sm"><CardHeader className="flex flex-col gap-2 border-b border-border/50 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-sm font-black uppercase tracking-widest">Mis ventas y facturas</CardTitle><p className="mt-1 text-xs text-muted-foreground">Aquí ves las líneas asociadas a tus productos.</p></div><Badge variant="outline" className="w-fit rounded-full">{sales.length} documentos</Badge></CardHeader><CardContent className="p-0">{sales.length ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><tr><th className="px-5 py-4">Fecha</th><th className="px-5 py-4">Factura</th><th className="px-5 py-4">Mis productos</th><th className="px-5 py-4">Estado</th><th className="px-5 py-4 text-right">Total de mis productos</th></tr></thead><tbody className="divide-y divide-border/50">{sales.map((invoice) => <tr key={invoice.id} className="hover:bg-muted/20"><td className="px-5 py-4 text-muted-foreground">{dateLabel(invoice.date)}</td><td className="px-5 py-4 font-bold">{invoice.number}</td><td className="max-w-[280px] px-5 py-4"><p className="truncate font-medium">{(invoice.items || []).map((item: any) => item.description).join(', ') || '—'}</p><p className="mt-1 text-xs text-muted-foreground">{(invoice.items || []).length} línea{(invoice.items || []).length === 1 ? '' : 's'}</p></td><td className="px-5 py-4"><Badge variant={String(invoice.status).toUpperCase() === 'PAID' ? 'default' : 'secondary'} className="gap-1 rounded-full"><CheckCircle2 className="size-3" />{salesStatusLabel(invoice.status)}</Badge></td><td className="px-5 py-4 text-right font-black">{money(invoice.total, invoice.currency, invoice.exchangeRate)}</td></tr>)}</tbody></table></div> : <EmptyState text="Todavía no tienes ventas asociadas a tus productos." />}</CardContent></Card>;
}
