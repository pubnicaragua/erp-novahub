import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BadgeDollarSign,
  ChevronDown,
  ChevronRight,
  Clock3,
  CreditCard,
  Download,
  FileText,
  LayoutGrid,
  List,
  ReceiptText,
  RefreshCw,
  Users,
  WalletCards,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { cn } from '../ui/utils';
import { hrService } from '../../services/hr.service';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { SalesKpiCard } from '../ventas/SalesKpiCard';
import { buildDateFilteredDownloadFileName } from '../../utils/exportFileNames';

type CommissionLayout = 'table' | 'cards';
type CommissionTab = 'sellers' | 'recent';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente de cobro',
  EARNED: 'Pendiente de nómina',
  PAID_IN_PAYROLL: 'Pagada en nómina',
  PAID: 'Pagada en nómina',
  PARTIAL: 'Pago parcial',
  OVERDUE: 'Vencida',
  CREDIT: 'A crédito',
  CANCELLED: 'Anulada',
};

const STATUS_TONES: Record<string, string> = {
  PENDING: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  EARNED: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-300',
  PAID_IN_PAYROLL: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  PAID: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  CANCELLED: 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300',
};

const fmt = (value: number, currency: string) =>
  new Intl.NumberFormat('es-NI', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(value) || 0);

const fmtQuantity = (value: unknown) =>
  new Intl.NumberFormat('es-NI', { maximumFractionDigits: 0 }).format(Math.round(Number(value) || 0));

const parseDate = (value: unknown) => {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value: unknown) => {
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date) : '—';
};

const formatTime = (value: unknown) => {
  const date = parseDate(value);
  return date ? new Intl.DateTimeFormat('es-NI', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date) : '—';
};

const formatDateTime = (value: unknown) => {
  const date = parseDate(value);
  return date ? `${formatDate(value)} ${formatTime(value)}` : '—';
};

const statusLabel = (status: unknown) => STATUS_LABELS[String(status || '').toUpperCase()] || String(status || 'Pendiente');
const statusClass = (status: unknown) => STATUS_TONES[String(status || '').toUpperCase()] || 'border-border bg-muted text-muted-foreground';

function StatusBadge({ status }: { status: unknown }) {
  return <Badge variant="outline" className={cn('whitespace-nowrap text-[9px] font-black uppercase tracking-widest', statusClass(status))}>{statusLabel(status)}</Badge>;
}

function getCommissionLines(item: any, baseCurrency: string) {
  const invoice = item.invoice || {};
  const sourceLines = Array.isArray(invoice.commissionLines) && invoice.commissionLines.length
    ? invoice.commissionLines
    : [{
        date: invoice.date,
        code: '—',
        quantity: 1,
        salePrice: Number(invoice.subtotal || invoice.total || 0),
        productSubtotal: Number(invoice.subtotal || invoice.total || 0),
        totalSale: Number(invoice.total || 0),
        commission: Number(item.amount || 0),
        priceType: 'Precio Normal',
        invoiceNumber: invoice.number || '',
        customer: invoice.customer || invoice.customCustomerName || 'Cliente General',
        paymentForm: invoice.paymentMethod || 'Pendiente',
        paymentDetail: 'Pendiente',
        status: item.status,
        currency: invoice.currency || baseCurrency,
      }];

  return sourceLines.map((line: any) => ({
    date: line.date || invoice.date,
    code: line.code || line.sku || '—',
    quantity: Number(line.quantity ?? 0),
    salePrice: Number(line.salePrice ?? line.price1 ?? 0),
    productSubtotal: Number(line.productSubtotal ?? line.totalP1 ?? line.totalSale ?? invoice.subtotal ?? invoice.total ?? 0),
    totalSale: Number(line.totalSale ?? invoice.total ?? 0),
    commission: Number(line.commission ?? item.amount ?? 0),
    priceType: line.priceType || 'Precio Normal',
    invoiceNumber: line.invoiceNumber || invoice.number || '',
    customer: line.customer || invoice.customer || invoice.customCustomerName || 'Cliente General',
    paymentForm: line.paymentForm || 'Pendiente',
    paymentDetail: line.paymentDetail || 'Pendiente',
    status: line.status || item.status,
    currency: line.currency || invoice.currency || baseCurrency,
  }));
}

function LayoutToggle({ value, onChange }: { value: CommissionLayout; onChange: (value: CommissionLayout) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/20 p-1" role="group" aria-label="Distribución de comisiones">
      <Button type="button" variant={value === 'table' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-1.5 rounded-lg px-2.5 text-[10px] font-black uppercase tracking-widest" onClick={() => onChange('table')} aria-pressed={value === 'table'}><List className="size-3.5" /> Lista</Button>
      <Button type="button" variant={value === 'cards' ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-1.5 rounded-lg px-2.5 text-[10px] font-black uppercase tracking-widest" onClick={() => onChange('cards')} aria-pressed={value === 'cards'}><LayoutGrid className="size-3.5" /> Tarjetas</Button>
    </div>
  );
}

function SellerDetails({ seller, rows, baseCurrency }: { seller: any; rows: any[]; baseCurrency: string }) {
  return (
    <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/[0.03] p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Detalle de ventas</p><p className="mt-1 text-xs text-muted-foreground">{seller.name} · {rows.length} registro(s) de venta</p></div><Badge variant="outline" className="text-[10px]">Comisión sobre subtotal de productos</Badge></div>
      <div className="hidden min-w-0 max-w-full overflow-x-auto rounded-xl border border-border/50 bg-background/70 scrollbar-overlay sm:block">
        <Table containerClassName="overflow-visible" className="min-w-[1760px]">
          <TableHeader><TableRow className="hover:bg-transparent">{['Fecha', 'Hora', 'SKU', 'Cantidad', 'Precio de venta', 'Subtotal productos', 'Total de venta', 'Tipo de precio', 'Comisión', 'Factura / referencia', 'Cliente', 'Forma de pago', 'Forma de pago detallada', 'Estado'].map((heading) => <TableHead key={heading} className="whitespace-nowrap text-[10px] uppercase tracking-widest">{heading}</TableHead>)}</TableRow></TableHeader>
          <TableBody>{rows.map((line: any, index: number) => <TableRow key={`${line.commissionId || seller.id}-${index}`}><TableCell className="whitespace-nowrap text-xs">{formatDate(line.date)}</TableCell><TableCell className="whitespace-nowrap text-xs tabular-nums">{formatTime(line.date)}</TableCell><TableCell className="max-w-[210px] break-all font-mono text-xs">{line.code || '—'}</TableCell><TableCell className="text-right text-xs tabular-nums">{fmtQuantity(line.quantity)}</TableCell><TableCell className="text-right text-xs tabular-nums">{fmt(line.salePrice, line.currency || baseCurrency)}</TableCell><TableCell className="text-right text-xs font-semibold tabular-nums">{fmt(line.productSubtotal, line.currency || baseCurrency)}</TableCell><TableCell className="text-right text-xs font-semibold tabular-nums">{fmt(line.totalSale, line.currency || baseCurrency)}</TableCell><TableCell className="max-w-[180px] text-xs">{line.priceType || 'Precio Normal'}</TableCell><TableCell className="text-right text-xs font-black text-primary tabular-nums">{fmt(line.commission, line.currency || baseCurrency)}</TableCell><TableCell className="whitespace-nowrap text-xs font-semibold">{line.invoiceNumber || '—'}</TableCell><TableCell className="max-w-[220px] text-xs">{line.customer || 'Cliente General'}</TableCell><TableCell className="whitespace-nowrap text-xs">{line.paymentForm || 'Pendiente'}</TableCell><TableCell className="min-w-[260px] text-xs">{line.paymentDetail || 'Pendiente'}</TableCell><TableCell><StatusBadge status={line.status} /></TableCell></TableRow>)}</TableBody>
        </Table>
      </div>
      <div className="space-y-3 sm:hidden">{rows.map((line: any, index: number) => <article key={`${line.commissionId || seller.id}-mobile-${index}`} className="rounded-xl border border-border/60 bg-background/80 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-all font-mono text-xs font-bold">{line.code || '—'}</p><p className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(line.date)} · {line.invoiceNumber || 'Sin factura'}</p></div><StatusBadge status={line.status} /></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><p className="text-[10px] text-muted-foreground">Cantidad</p><p className="font-semibold">{fmtQuantity(line.quantity)}</p></div><div><p className="text-[10px] text-muted-foreground">Precio de venta</p><p className="font-semibold">{fmt(line.salePrice, line.currency || baseCurrency)}</p></div><div><p className="text-[10px] text-muted-foreground">Subtotal productos</p><p className="font-semibold">{fmt(line.productSubtotal, line.currency || baseCurrency)}</p></div><div><p className="text-[10px] text-muted-foreground">Total de venta</p><p className="font-semibold">{fmt(line.totalSale, line.currency || baseCurrency)}</p></div><div><p className="text-[10px] text-muted-foreground">Tipo de precio</p><p className="break-words font-semibold">{line.priceType || 'Precio Normal'}</p></div><div><p className="text-[10px] text-muted-foreground">Comisión</p><p className="font-black text-primary">{fmt(line.commission, line.currency || baseCurrency)}</p></div><div className="col-span-2"><p className="text-[10px] text-muted-foreground">Cliente</p><p className="break-words font-semibold">{line.customer || 'Cliente General'}</p></div><div><p className="text-[10px] text-muted-foreground">Forma de pago</p><p className="break-words font-semibold">{line.paymentForm || 'Pendiente'}</p></div><div><p className="text-[10px] text-muted-foreground">Detalle de pago</p><p className="break-words font-semibold">{line.paymentDetail || 'Pendiente'}</p></div></div></article>)}{!rows.length && <p className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">No hay ventas detalladas en este período.</p>}</div>
    </div>
  );
}

function SellerTable({ sellers, detailRows, expanded, onToggle, baseCurrency }: { sellers: any[]; detailRows: any[]; expanded: string | null; onToggle: (id: string) => void; baseCurrency: string }) {
  return <div className="min-w-0 max-w-full overflow-x-auto rounded-2xl border border-border/50 scrollbar-overlay"><Table containerClassName="overflow-visible" className="min-w-[980px]"><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="w-10" /><TableHead>Vendedor</TableHead><TableHead>Departamento</TableHead><TableHead className="text-right">Ventas</TableHead><TableHead className="text-right">Venta base</TableHead><TableHead className="text-right">Comisión total</TableHead><TableHead className="text-right">Pendiente</TableHead><TableHead className="text-right">Pagada</TableHead></TableRow></TableHeader><TableBody>{sellers.map((seller) => { const isOpen = expanded === seller.seller.id; const rows = detailRows.filter((row) => row.seller?.id === seller.seller.id); const toggle = () => onToggle(seller.seller.id); return <Fragment key={seller.seller.id}><TableRow className="cursor-pointer" onClick={toggle} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); } }} tabIndex={0} aria-expanded={isOpen}><TableCell>{isOpen ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}</TableCell><TableCell><div className="flex min-w-0 items-center gap-2.5"><div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Users className="size-4" /></div><div className="min-w-0"><p className="truncate text-sm font-bold">{seller.seller.name}</p><p className="text-[10px] text-muted-foreground">{seller.seller.employeeNumber || 'Sin código de empleado'}</p></div></div></TableCell><TableCell className="text-sm text-muted-foreground">{seller.seller.department || '—'}</TableCell><TableCell className="text-right text-sm font-semibold tabular-nums">{seller.invoiceCount}</TableCell><TableCell className="text-right text-sm tabular-nums">{fmt(seller.salesBase, baseCurrency)}</TableCell><TableCell className="text-right text-sm font-black text-primary tabular-nums">{fmt(seller.commissionBase, baseCurrency)}</TableCell><TableCell className="text-right text-sm font-semibold text-amber-600 tabular-nums">{fmt(seller.pendingBase, baseCurrency)}</TableCell><TableCell className="text-right text-sm font-semibold text-emerald-600 tabular-nums">{fmt(seller.paidBase, baseCurrency)}</TableCell></TableRow>{isOpen && <TableRow><TableCell colSpan={8} className="border-0 p-0"><div className="p-3 sm:p-4"><SellerDetails seller={seller.seller} rows={rows} baseCurrency={baseCurrency} /></div></TableCell></TableRow>}</Fragment>; })}</TableBody></Table></div>;
}

function SellerCards({ sellers, detailRows, expanded, onToggle, baseCurrency }: { sellers: any[]; detailRows: any[]; expanded: string | null; onToggle: (id: string) => void; baseCurrency: string }) {
  return <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">{sellers.map((seller) => { const isOpen = expanded === seller.seller.id; const rows = detailRows.filter((row) => row.seller?.id === seller.seller.id); return <Card key={seller.seller.id} className="min-w-0 overflow-hidden rounded-2xl border-border/60 shadow-sm"><CardContent className="space-y-4 p-5"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Users className="size-5" /></div><div className="min-w-0"><p className="truncate text-base font-black">{seller.seller.name}</p><p className="truncate text-xs text-muted-foreground">{seller.seller.department || 'Sin departamento'} · {seller.seller.employeeNumber || 'Sin código'}</p></div></div><StatusBadge status={seller.paidBase > 0 && seller.pendingBase <= 0 ? 'PAID_IN_PAYROLL' : 'PENDING'} /></div><div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-xl bg-muted/30 p-3"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Ventas</p><p className="mt-1 font-black">{seller.invoiceCount}</p></div><div className="rounded-xl bg-muted/30 p-3"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Venta base</p><p className="mt-1 truncate font-black">{fmt(seller.salesBase, baseCurrency)}</p></div><div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Comisión total</p><p className="mt-1 truncate font-black text-primary">{fmt(seller.commissionBase, baseCurrency)}</p></div><div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-3"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Pendiente</p><p className="mt-1 truncate font-black text-amber-600">{fmt(seller.pendingBase, baseCurrency)}</p></div></div><Button type="button" variant="outline" className="w-full rounded-xl text-[10px] font-black uppercase tracking-widest" onClick={() => onToggle(seller.seller.id)} aria-expanded={isOpen}>{isOpen ? 'Ocultar detalle' : 'Ver detalle de ventas'} {isOpen ? <ChevronDown className="ml-2 size-4" /> : <ChevronRight className="ml-2 size-4" />}</Button>{isOpen && <SellerDetails seller={seller.seller} rows={rows} baseCurrency={baseCurrency} />}</CardContent></Card>; })}</div>;
}

function RecentTable({ items, baseCurrency }: { items: any[]; baseCurrency: string }) {
  return <div className="min-w-0 max-w-full overflow-x-auto rounded-2xl border border-border/50 scrollbar-overlay"><Table containerClassName="overflow-visible" className="min-w-[1050px]"><TableHeader><TableRow className="hover:bg-transparent"><TableHead>Fecha</TableHead><TableHead>Vendedor</TableHead><TableHead>Departamento</TableHead><TableHead>Factura / referencia</TableHead><TableHead>Cliente</TableHead><TableHead className="text-right">Venta base</TableHead><TableHead className="text-right">Comisión</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>{items.map((item) => <TableRow key={item.id}><TableCell className="whitespace-nowrap text-xs">{formatDateTime(item.createdAt || item.invoice?.date)}</TableCell><TableCell className="font-semibold">{item.seller?.name || '—'}</TableCell><TableCell className="text-sm text-muted-foreground">{item.seller?.department || '—'}</TableCell><TableCell className="whitespace-nowrap font-mono text-xs">{item.invoice?.number || '—'}</TableCell><TableCell className="max-w-[220px] text-sm">{item.invoice?.customer || item.invoice?.customCustomerName || 'Cliente General'}</TableCell><TableCell className="text-right font-semibold tabular-nums">{fmt(item.invoice?.totalBase ?? item.invoice?.total, baseCurrency)}</TableCell><TableCell className="text-right font-black text-primary tabular-nums">{fmt(item.amountBase ?? item.amount, baseCurrency)}</TableCell><TableCell><StatusBadge status={item.status} /></TableCell></TableRow>)}</TableBody></Table></div>;
}

function RecentCards({ items, baseCurrency }: { items: any[]; baseCurrency: string }) {
  return <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">{items.map((item) => <Card key={item.id} className="min-w-0 rounded-2xl border-border/60"><CardContent className="space-y-3 p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-base font-black">{item.seller?.name || 'Vendedor sin identificar'}</p><p className="mt-1 break-words text-xs text-muted-foreground">{formatDateTime(item.createdAt || item.invoice?.date)} · {item.invoice?.number || 'Sin factura'}</p></div><StatusBadge status={item.status} /></div><div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-xl bg-muted/30 p-3"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Venta base</p><p className="mt-1 truncate font-black">{fmt(item.invoice?.totalBase ?? item.invoice?.total, baseCurrency)}</p></div><div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3"><p className="text-[10px] uppercase tracking-widest text-muted-foreground">Comisión</p><p className="mt-1 truncate font-black text-primary">{fmt(item.amountBase ?? item.amount, baseCurrency)}</p></div></div><div className="grid gap-1 text-xs"><p><span className="text-muted-foreground">Departamento:</span> <span className="font-semibold">{item.seller?.department || '—'}</span></p><p className="break-words"><span className="text-muted-foreground">Cliente:</span> <span className="font-semibold">{item.invoice?.customer || item.invoice?.customCustomerName || 'Cliente General'}</span></p></div></CardContent></Card>)}</div>;
}

export function ComisionesView() {
  const { canPerform } = useAuth();
  const { baseCurrency: contextBaseCurrency, displayCurrency, displayMode, formatConvertedAmount, formatExplicitAmount } = useCurrency();
  const canViewHr = canPerform('HR', 'view');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('ALL');
  const [sellerId, setSellerId] = useState('ALL');
  const [activeTab, setActiveTab] = useState<CommissionTab>('sellers');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [layoutMode, setLayoutMode] = useLocalStorageState<CommissionLayout>('hr-commissions-layout', 'table', 8760);

  const commissionFilters = { ...(from ? { from } : {}), ...(to ? { to } : {}), ...(status !== 'ALL' ? { status } : {}), ...(sellerId !== 'ALL' ? { sellerId } : {}) };
  const query = useQuery({ queryKey: ['hr', 'comisiones', { from, to, status, sellerId }], queryFn: ({ signal }) => hrService.getCommissionReport({ ...commissionFilters, page: 1, pageSize: 500 }, signal), enabled: canViewHr });
  const rawReport = query.data as any;
  const report = rawReport?.data ?? rawReport;
  const baseCurrency = (report?.baseCurrency || contextBaseCurrency || 'NIO') as 'NIO' | 'USD';
  const sellers: any[] = report?.sellers || [];
  const summary = report?.summary || {};
  const sourceBreakdown = (key: string, fallback: number) => {
    const value = (summary as any)[key];
    return Array.isArray(value) && value.length
      ? value.map((item: any) => ({ currency: String(item.currency || baseCurrency).toUpperCase() === 'USD' ? 'USD' as const : 'NIO' as const, amount: Number(item.amount || 0) }))
      : [{ currency: baseCurrency, amount: Number(fallback || 0) }];
  };
  const renderMoneyKpis = (label: string, fallback: number, breakdownKey: string, icon: any, color: string, bg: string) => {
    const breakdown = sourceBreakdown(breakdownKey, fallback);
    return displayMode === 'ORIGINAL'
      ? breakdown.map((item) => <SalesKpiCard key={`${label}-${item.currency}`} title={`${label} (${item.currency})`} value={formatExplicitAmount(item.amount, item.currency)} icon={icon} color={color} bg={bg} />)
      : <SalesKpiCard title={`${label} (${displayMode === 'USD' ? 'USD' : displayMode === 'NIO' ? 'NIO' : displayCurrency})`} value={formatConvertedAmount(fallback, baseCurrency)} icon={icon} color={color} bg={bg} />;
  };
  const reportItems: any[] = report?.items || [];
  const sellerOptions = useMemo(() => sellers.map((seller) => seller.seller).filter(Boolean), [sellers]);
  const detailRows = useMemo(() => reportItems.flatMap((item) => getCommissionLines(item, baseCurrency).map((line: any, index: number) => ({ ...line, seller: item.seller, commissionId: item.id, lineIndex: index }))), [reportItems, baseCurrency]);
  const recentItems: any[] = useMemo(() => [...(report?.recentItems || reportItems)].sort((a, b) => new Date(b.createdAt || b.invoice?.date || 0).getTime() - new Date(a.createdAt || a.invoice?.date || 0).getTime()), [report, reportItems]);

  const toggleSeller = (id: string) => setExpanded((current) => current === id ? null : id);

  const downloadCsv = async () => {
    if (!report || query.isLoading || query.isError || exporting) return;
    setExporting(true);
    try {
      const pageSize = 500;
      const total = Number(report.total || reportItems.length || 0);
      const pageCount = Math.max(1, Math.ceil(total / pageSize));
      const remainingPages = await Promise.all(Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => hrService.getCommissionReport({ ...commissionFilters, page: index + 2, pageSize })));
      const items = [...reportItems, ...remainingPages.flatMap((page: any) => (page?.data ?? page)?.items || [])];
      if (!items.length) { toast.info('No hay comisiones para exportar con los filtros seleccionados'); return; }
      const detailHeaders = ['Vendedor', 'Fecha', 'Hora', 'SKU', 'Cantidad', 'Precio de venta', 'Subtotal productos', 'Total de venta', 'Tipo de precio', 'Comisión', 'Factura / referencia', 'Cliente', 'Forma de pago', 'Forma de pago detallada', 'Estado'];
      const detailRowsForExport: unknown[][] = [detailHeaders];
      items.forEach((item) => getCommissionLines(item, baseCurrency).forEach((line: any) => detailRowsForExport.push([item.seller?.name || '', formatDate(line.date), formatTime(line.date), line.code || '', Number(line.quantity || 0), Number(line.salePrice || 0), Number(line.productSubtotal || 0), Number(line.totalSale || 0), line.priceType || '', Number(line.commission || 0), line.invoiceNumber || item.invoice?.number || '', line.customer || '', line.paymentForm || '', line.paymentDetail || '', statusLabel(line.status)])));
      const sellerRows: unknown[][] = [['Vendedor', 'Departamento', 'Ventas', 'Venta base', 'Comisión total', 'Pendiente', 'Pagada'], ...((report.sellers || []).map((seller: any) => [seller.seller?.name || '', seller.seller?.department || '', Number(seller.invoiceCount || 0), Number(seller.salesBase || 0), Number(seller.commissionBase || 0), Number(seller.pendingBase || 0), Number(seller.paidBase || 0)]))];
      const recentRows: unknown[][] = [['Fecha', 'Vendedor', 'Departamento', 'Factura / referencia', 'Cliente', 'Venta base', 'Comisión', 'Estado'], ...items.slice().sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).map((item: any) => [formatDateTime(item.createdAt || item.invoice?.date), item.seller?.name || '', item.seller?.department || '', item.invoice?.number || '', item.invoice?.customer || item.invoice?.customCustomerName || 'Cliente General', Number(item.invoice?.totalBase ?? item.invoice?.total ?? 0), Number(item.amountBase ?? item.amount ?? 0), statusLabel(item.status)])];
      const workbook = XLSX.utils.book_new();
      const detailSheet = XLSX.utils.aoa_to_sheet(detailRowsForExport);
      const sellerSheet = XLSX.utils.aoa_to_sheet(sellerRows);
      const recentSheet = XLSX.utils.aoa_to_sheet(recentRows);
      detailSheet['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 8 }, { wch: 22 }, { wch: 10 }, { wch: 16 }, { wch: 19 }, { wch: 17 }, { wch: 20 }, { wch: 14 }, { wch: 20 }, { wch: 28 }, { wch: 17 }, { wch: 34 }, { wch: 20 }];
      sellerSheet['!cols'] = [{ wch: 25 }, { wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 16 }];
      recentSheet['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 22 }, { wch: 20 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(workbook, detailSheet, 'Detalle');
      XLSX.utils.book_append_sheet(workbook, sellerSheet, 'Por vendedor');
      XLSX.utils.book_append_sheet(workbook, recentSheet, 'Recientes');
      XLSX.writeFile(workbook, buildDateFilteredDownloadFileName(['reporte_comisiones'], 'xlsx', from, to));
      toast.success(`Reporte de comisiones descargado (${items.length} registro(s))`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo preparar el reporte de comisiones'); }
    finally { setExporting(false); }
  };

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-end"><div className="min-w-0"><div className="mb-1 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-primary"><BadgeDollarSign className="size-3.5" /> Control de comisiones</div><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Comisiones de ventas</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Consulta las ventas base de cada vendedor, lo pendiente de cobro o nómina y lo pagado por nómina.</p></div><Button variant="outline" size="sm" onClick={downloadCsv} disabled={exporting || query.isLoading || query.isError} className="h-10 shrink-0 gap-2 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest"><Download className="size-4" /> {exporting ? 'Preparando…' : 'Exportar reporte'}</Button></div>
      <Card className="rounded-2xl border-border/60 bg-card/80 shadow-sm"><CardContent className="flex flex-wrap items-end gap-3 p-3 sm:p-4"><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Desde</Label><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-10 w-full sm:w-[160px]" /></div><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Hasta</Label><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-10 w-full sm:w-[160px]" /></div><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</Label><Select value={status} onValueChange={setStatus}><SelectTrigger className="h-10 w-full sm:w-[210px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Todos</SelectItem><SelectItem value="PENDING">Pendiente</SelectItem><SelectItem value="PAID_IN_PAYROLL">Pagada en nómina</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vendedor</Label><Select value={sellerId} onValueChange={setSellerId}><SelectTrigger className="h-10 w-full sm:w-[240px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">Todos los vendedores</SelectItem>{sellerOptions.map((seller) => <SelectItem key={seller.id} value={seller.id}>{seller.name}</SelectItem>)}</SelectContent></Select></div><div className="ml-auto"><LayoutToggle value={layoutMode} onChange={setLayoutMode} /></div></CardContent></Card>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5"><SalesKpiCard title="Vendedores con ventas" value={String(summary.sellerCount || 0)} icon={Users} color="text-primary" bg="bg-primary/10" />{renderMoneyKpis('Venta total', Number(summary.salesBase || 0), 'salesOriginalCurrencyBreakdown', ReceiptText, 'text-foreground', 'bg-muted')}{renderMoneyKpis('Comisión total', Number(summary.commissionBase || 0), 'commissionOriginalCurrencyBreakdown', BadgeDollarSign, 'text-primary', 'bg-primary/10')}{renderMoneyKpis('Pendiente', Number(summary.pendingBase || 0), 'pendingOriginalCurrencyBreakdown', Clock3, 'text-amber-600', 'bg-amber-500/10')}{renderMoneyKpis('Pagada en nómina', Number(summary.paidBase || 0), 'paidOriginalCurrencyBreakdown', WalletCards, 'text-emerald-600', 'bg-emerald-500/10')}</div>
      {query.isError ? <Alert variant="destructive" className="border-red-500/30 bg-red-500/5"><AlertTriangle className="size-4" /><AlertTitle>No se pudo cargar el reporte de comisiones</AlertTitle><AlertDescription className="mt-2 flex flex-wrap items-center justify-between gap-3"><span>{query.error instanceof Error ? query.error.message : 'El servidor no devolvió el detalle de comisiones.'}</span><Button variant="outline" size="sm" onClick={() => query.refetch()} className="gap-2"><RefreshCw className="size-3.5" /> Reintentar</Button></AlertDescription></Alert> : query.isLoading ? <div className="flex h-40 items-center justify-center"><RefreshCw className="size-8 animate-spin text-primary" /></div> : <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as CommissionTab)} className="gap-4"><TabsList className="h-auto max-w-full flex-wrap justify-start gap-1 rounded-2xl border border-border/60 bg-card p-1"><TabsTrigger value="sellers" className="h-10 gap-2 px-4 text-[10px] font-black uppercase tracking-widest"><Users className="size-4" /> Comisiones por vendedor</TabsTrigger><TabsTrigger value="recent" className="h-10 gap-2 px-4 text-[10px] font-black uppercase tracking-widest"><CreditCard className="size-4" /> Comisiones recientes</TabsTrigger></TabsList><TabsContent value="sellers" className="m-0 space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-black tracking-tight">Resumen por vendedor</h2><p className="text-xs text-muted-foreground">La cantidad corresponde a vendedores con registros de venta base en el período.</p></div><Badge variant="outline" className="gap-1.5 text-[10px]"><FileText className="size-3.5" /> {sellers.length} vendedor(es)</Badge></div>{!sellers.length ? <Card className="rounded-2xl border-dashed"><CardContent className="space-y-2 p-10 text-center"><p className="text-sm font-semibold">No hay comisiones de vendedores para los filtros seleccionados.</p><p className="text-xs text-muted-foreground">Verifica que existan ventas con vendedor y comisión registrada.</p></CardContent></Card> : layoutMode === 'cards' ? <SellerCards sellers={sellers} detailRows={detailRows} expanded={expanded} onToggle={toggleSeller} baseCurrency={baseCurrency} /> : <SellerTable sellers={sellers} detailRows={detailRows} expanded={expanded} onToggle={toggleSeller} baseCurrency={baseCurrency} />}</TabsContent><TabsContent value="recent" className="m-0 space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-black tracking-tight">Comisiones recientes</h2><p className="text-xs text-muted-foreground">Cada fila representa una comisión registrada, ordenada de la más reciente a la más antigua.</p></div><Badge variant="outline" className="gap-1.5 text-[10px]"><RefreshCw className="size-3.5" /> {recentItems.length} registro(s)</Badge></div>{!recentItems.length ? <Card className="rounded-2xl border-dashed"><CardContent className="p-10 text-center text-sm text-muted-foreground">No hay comisiones recientes para los filtros seleccionados.</CardContent></Card> : layoutMode === 'cards' ? <RecentCards items={recentItems} baseCurrency={baseCurrency} /> : <RecentTable items={recentItems} baseCurrency={baseCurrency} />}</TabsContent></Tabs>}
    </div>
  );
}
