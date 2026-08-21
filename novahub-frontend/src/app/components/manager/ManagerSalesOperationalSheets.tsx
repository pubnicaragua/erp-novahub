import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { cn } from '../ui/utils';
import { Banknote, Building2, CalendarDays, CheckCircle2, Clock3, Download, FileText, History, List, MapPin, MessageCircle, Package, Receipt, UserRound, WalletCards } from 'lucide-react';
import { formatCurrencyAmount, formatCurrencyDescriptor } from '../../utils/currency';

const numberFormat = new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 });
const formatNumber = (value: unknown) => numberFormat.format(Number(value || 0));
const formatMoney = (value: unknown, currency?: string | null) => formatCurrencyAmount(value, currency || 'NIO', true);
const formatDate = (value: unknown, includeTime = false) => {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-NI', includeTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' });
};
const statusText = (value: unknown) => ({ PENDING: 'Pendiente', DELIVERED: 'Entregada', READY: 'Lista para entregar', CANCELLED: 'Cancelada', PAID: 'Pagada', NO_PAYMENT: 'Sin cobro', OPEN: 'Abierta', COUNTING: 'En conteo', CLOSED: 'Cerrada', ACTIVE: 'Activa', INACTIVE: 'Inactiva' } as Record<string, string>)[String(value || '').toUpperCase()] || String(value || '—').replaceAll('_', ' ');
const statusClass = (value: unknown) => {
  const normalized = String(value || '').toUpperCase();
  if (['DELIVERED', 'PAID', 'ACTIVE'].includes(normalized)) return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (['PENDING', 'READY', 'OPEN', 'COUNTING'].includes(normalized)) return 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  if (['CANCELLED', 'CLOSED', 'INACTIVE'].includes(normalized)) return 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300';
  return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300';
};
const statusBadge = (value: unknown) => <Badge variant="outline" className={cn('font-black', statusClass(value))}>{statusText(value)}</Badge>;

type CommonSheetProps = { open: boolean; onOpenChange: (open: boolean) => void; loading?: boolean; onDownload?: () => void; onGoToBranch?: (branchId: string) => void };

function Field({ label, value, icon: Icon = FileText, mono = false }: { label: string; value: React.ReactNode; icon?: typeof FileText; mono?: boolean }) {
  return <div className="min-w-0"><p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground"><Icon className="size-3" />{label}</p><p className={cn('mt-1 break-words text-sm font-semibold', mono && 'font-mono text-xs')}>{value || '—'}</p></div>;
}

function SheetActions({ onDownload, onGoToBranch, branchId, onWhatsApp, hasWhatsApp }: { onDownload?: () => void; onGoToBranch?: (branchId: string) => void; branchId?: string | null; onWhatsApp?: () => void; hasWhatsApp?: boolean }) {
  return <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
    {onDownload && <Button variant="outline" className="rounded-xl" onClick={onDownload}><Download className="mr-2 size-4" />Descargar</Button>}
    {onWhatsApp && hasWhatsApp && <Button variant="outline" className="rounded-xl" onClick={onWhatsApp}><MessageCircle className="mr-2 size-4" />WhatsApp</Button>}
    {onGoToBranch && branchId && <Button variant="outline" className="rounded-xl" onClick={() => onGoToBranch(branchId)}><Building2 className="mr-2 size-4" />Ir a la sucursal</Button>}
  </div>;
}

export function ManagerSalesDeliverySheet({ open, onOpenChange, loading, delivery, history = [], reportCurrency, onDownload, onGoToBranch, onWhatsApp }: CommonSheetProps & { delivery: any | null; history?: any[]; reportCurrency: string; onWhatsApp?: () => void }) {
  const hasWhatsApp = Boolean(delivery?.customerPhone);
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-2xl">
    <ScrollArea className="h-full"><div className="space-y-5 p-5 sm:p-7">
      <SheetHeader className="text-left"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Control de entrega</p><SheetTitle className="mt-1 truncate font-mono text-2xl font-black">{delivery?.number || 'Detalle de entrega'}</SheetTitle><SheetDescription className="mt-1">Consulta de la reserva, sus sucursales, artículos e historial.</SheetDescription></div>{delivery && statusBadge(delivery.deliveryStatus)}</div></SheetHeader>
      {loading ? <LoadingDetail /> : delivery ? <>
        <Card className="rounded-2xl border-primary/20 bg-primary/[0.04] p-4"><div className="grid grid-cols-2 gap-4 sm:grid-cols-4"><Field label="Cliente" value={delivery.customerName} icon={UserRound} /><Field label="Artículos" value={formatNumber(delivery.itemCount)} icon={Package} /><Field label="Cobro" value={statusBadge(delivery.paymentStatus)} icon={WalletCards} /><Field label="Total" value={<><span className="block">{formatMoney(delivery.total, delivery.currency)}</span><span className="text-[10px] font-bold text-primary">Equiv. {formatMoney(delivery.reportTotal, reportCurrency)}</span></>} icon={Receipt} /></div></Card>
        <DetailSection title="Origen y destino" icon={MapPin}><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Sucursal facturadora" value={delivery.billingBranchName} icon={Building2} /><Field label="Sucursal de entrega" value={delivery.deliveryBranchName} icon={Building2} /><Field label="Factura" value={delivery.invoiceNumber || delivery.invoice?.number || 'Sin factura'} icon={Receipt} mono /><Field label="Fecha de orden" value={formatDate(delivery.date, true)} icon={CalendarDays} /></div></DetailSection>
        <DetailSection title="Artículos" icon={Package}>{delivery.items?.length ? <div className="space-y-2">{delivery.items.map((item: any) => <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-border/50 bg-background/30 p-3 text-sm"><div className="min-w-0"><p className="font-semibold">{item.productName || item.description}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.productCode || 'Sin código'} · {formatNumber(item.quantity)} × {formatMoney(item.unitPrice, delivery.currency)}</p></div><span className="shrink-0 font-black">{formatMoney(item.total, delivery.currency)}</span></div>)}</div> : <p className="text-sm text-muted-foreground">No hay artículos registrados.</p>}</DetailSection>
        <DetailSection title="Historial" icon={History}><div className="space-y-3">{[...(delivery.timeline || []), ...history.map((item: any) => ({ key: item.id, label: item.action || item.entity || 'Auditoría', date: item.createdAt, user: item.user?.name || item.user?.email }))].map((item: any, index: number) => <div key={`${item.key}-${index}`} className="flex gap-3"><div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><CheckCircle2 className="size-4" /></div><div className="min-w-0"><p className="text-sm font-black">{item.label}</p><p className="text-xs text-muted-foreground">{formatDate(item.date, true)}{item.user ? ` · ${item.user}` : ''}</p></div></div>)}{!delivery.timeline?.length && !history.length && <p className="text-sm text-muted-foreground">No hay eventos registrados.</p>}</div></DetailSection>
        <SheetActions onDownload={onDownload} onGoToBranch={onGoToBranch} branchId={delivery.billingTenantId || delivery.branchId} onWhatsApp={onWhatsApp} hasWhatsApp={hasWhatsApp} />
      </> : <EmptyDetail />}
    </div></ScrollArea>
  </SheetContent></Sheet>;
}

export function ManagerSalesCashSheet({ open, onOpenChange, loading, session, invoices = [], log = [], reportCurrency, onDownload, onGoToBranch }: CommonSheetProps & { session: any | null; invoices?: any[]; log?: any[]; reportCurrency: string }) {
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-2xl"><ScrollArea className="h-full"><div className="space-y-5 p-5 sm:p-7">
    <SheetHeader className="text-left"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Sesión de caja</p><SheetTitle className="mt-1 truncate text-2xl font-black">{session?.registerName || 'Detalle de caja'}</SheetTitle><SheetDescription className="mt-1">Apertura, facturación, movimientos y cierre de la sesión.</SheetDescription></div>{session && statusBadge(session.status)}</div></SheetHeader>
    {loading ? <LoadingDetail /> : session ? <>
      <Card className="rounded-2xl border-primary/20 bg-primary/[0.04] p-4"><div className="grid grid-cols-2 gap-4 sm:grid-cols-4"><Field label="Sucursal" value={session.branchName} icon={Building2} /><Field label="Código" value={session.registerCode} icon={Banknote} mono /><Field label="Facturas" value={formatNumber(session.invoiceCount)} icon={Receipt} /><Field label="Diferencia" value={<><span className="block">{formatMoney(session.differenceNIO, 'NIO')}</span><span className="text-[10px] font-bold text-primary">Equiv. {formatMoney(session.reportDifferenceNIO, reportCurrency)}</span></>} icon={WalletCards} /></div></Card>
      <DetailSection title="Apertura y cierre" icon={Clock3}><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field label="Apertura" value={formatDate(session.openedAt, true)} icon={CalendarDays} /><Field label="Cierre" value={formatDate(session.closedAt, true)} icon={CalendarDays} /><Field label="Abrió" value={session.openedBy?.name || session.openedBy?.email} icon={UserRound} /><Field label="Cerró" value={session.closedBy?.name || session.closedBy?.email} icon={UserRound} /><Field label="Monto inicial" value={<>{formatMoney(session.initialAmountNIO, 'NIO')}<span className="block text-[10px] text-primary">Equiv. {formatMoney(session.reportInitialAmountNIO, reportCurrency)}</span></>} icon={Banknote} /><Field label="Monto esperado" value={<>{formatMoney(session.expectedAmountNIO, 'NIO')}<span className="block text-[10px] text-primary">Equiv. {formatMoney(session.reportExpectedAmountNIO, reportCurrency)}</span></>} icon={Banknote} /><Field label="Monto final" value={<>{formatMoney(session.finalAmountNIO, 'NIO')}<span className="block text-[10px] text-primary">Equiv. {formatMoney(session.reportFinalAmountNIO, reportCurrency)}</span></>} icon={Banknote} /><Field label="Tasa aplicada" value={`${session.reportRateLabel || '—'} · ${formatCurrencyDescriptor(reportCurrency)}`} icon={WalletCards} /></div></DetailSection>
      <DetailSection title="Facturas de la sesión" icon={Receipt}>{invoices.length ? <div className="space-y-2">{invoices.map((invoice: any) => <div key={invoice.id} className="flex items-start justify-between gap-3 rounded-xl border border-border/50 bg-background/30 p-3 text-sm"><div className="min-w-0"><p className="font-mono font-black text-primary">{invoice.number}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{invoice.customerName} · {formatDate(invoice.date)}</p><p className="mt-1 text-xs">{statusText(invoice.status)} · {statusText(invoice.paymentMethod)}</p></div><div className="shrink-0 text-right"><p className="font-black">{formatMoney(invoice.total, invoice.currency)}</p><p className="text-[10px] font-bold text-primary">Equiv. {formatMoney(invoice.reportTotal, reportCurrency)}</p></div></div>)}</div> : <p className="text-sm text-muted-foreground">No hay facturas asociadas.</p>}</DetailSection>
      <DetailSection title="Movimientos" icon={History}>{log.length ? <div className="space-y-2">{log.map((item: any) => <div key={item.id} className="rounded-xl border border-border/50 p-3 text-sm"><div className="flex items-start justify-between gap-3"><p className="font-black">{statusText(item.type)}</p><span className="text-xs text-muted-foreground">{formatDate(item.createdAt, true)}</span></div><p className="mt-1 text-muted-foreground">{item.description}</p>{item.paymentMethod && <p className="mt-1 text-xs">Método: {statusText(item.paymentMethod)}{item.reference ? ` · ${item.reference}` : ''}</p>}</div>)}</div> : <p className="text-sm text-muted-foreground">No hay movimientos registrados.</p>}</DetailSection>
      <SheetActions onDownload={onDownload} onGoToBranch={onGoToBranch} branchId={session.branchId} />
    </> : <EmptyDetail />}
  </div></ScrollArea></SheetContent></Sheet>;
}

export function ManagerSalesPriceListSheet({ open, onOpenChange, loading, priceList, items = [], reportCurrency, onDownload, onGoToBranch }: CommonSheetProps & { priceList: any | null; items?: any[]; reportCurrency: string }) {
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-2xl"><ScrollArea className="h-full"><div className="space-y-5 p-5 sm:p-7">
    <SheetHeader className="text-left"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Lista de precios</p><SheetTitle className="mt-1 truncate font-mono text-2xl font-black">{priceList?.code || 'Detalle de lista'}</SheetTitle><SheetDescription className="mt-1">Consulta de precios por producto y sucursal. La edición permanece en la sucursal.</SheetDescription></div>{priceList && <Badge variant="outline" className={cn('font-black', priceList.isActive ? statusClass('ACTIVE') : statusClass('INACTIVE'))}>{priceList.isActive ? 'Activa' : 'Inactiva'}</Badge>}</div></SheetHeader>
    {loading ? <LoadingDetail /> : priceList ? <>
      <Card className="rounded-2xl border-primary/20 bg-primary/[0.04] p-4"><div className="grid grid-cols-2 gap-4 sm:grid-cols-4"><Field label="Nombre" value={priceList.name} icon={List} /><Field label="Sucursal" value={priceList.branchName} icon={Building2} /><Field label="Productos" value={formatNumber(priceList.itemCount)} icon={Package} /><Field label="Predeterminada" value={priceList.isDefault ? 'Sí' : 'No'} icon={CheckCircle2} /></div></Card>
      <DetailSection title="Precios de la lista" icon={Package}><div className="mb-3 rounded-xl border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">Moneda de reporte: <span className="font-black text-primary">{formatCurrencyDescriptor(reportCurrency)}</span>. Se conserva la moneda original de cada precio.</div>{items.length ? <div className="space-y-2">{items.map((item: any) => <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-border/50 bg-background/30 p-3 text-sm"><div className="min-w-0"><p className="font-semibold">{item.productName}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.productCode}{item.variantName ? ` · ${item.variantName}` : ''}</p><p className="mt-1 text-xs text-muted-foreground">Costo de referencia: {formatMoney(item.costPrice, item.currency)}</p></div><div className="shrink-0 text-right"><p className="font-black">{formatMoney(item.price, item.currency)}</p><p className="text-[10px] font-bold text-primary">Equiv. {formatMoney(item.reportPrice, reportCurrency)}</p></div></div>)}</div> : <p className="text-sm text-muted-foreground">Esta lista no tiene productos asociados.</p>}</DetailSection>
      <SheetActions onDownload={onDownload} onGoToBranch={onGoToBranch} branchId={priceList.branchId} />
    </> : <EmptyDetail />}
  </div></ScrollArea></SheetContent></Sheet>;
}

function DetailSection({ title, icon: Icon, children }: { title: string; icon: typeof FileText; children: React.ReactNode }) {
  return <Card className="space-y-4 rounded-2xl border-border/60 bg-card p-5 shadow-sm"><h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/80"><Icon className="size-4 text-primary" />{title}</h3>{children}</Card>;
}

function LoadingDetail() { return <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground"><Clock3 className="mr-2 size-4 animate-pulse" />Cargando detalle...</div>; }
function EmptyDetail() { return <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">No se pudo cargar el detalle.</div>; }
