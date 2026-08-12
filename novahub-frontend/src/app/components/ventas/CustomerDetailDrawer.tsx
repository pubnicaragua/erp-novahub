'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  FileText,
  History,
  Calendar,
  DollarSign,
  AlertCircle,
  Info,
  ChevronRight,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Tag,
  Hash,
  Activity,
  Link2,
  Copy,
  RefreshCcw,
  X,
  FileDown,
  TrendingUp,
  Banknote,
} from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../ui/sheet';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Label } from '../ui/label';
import { Skeleton } from '../ui/skeleton';
import { ScrollArea } from '../ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  auditService,
  customersService,
  invoicesService,
  estimatesService,
  salesOrdersService,
  paymentsService,
  recurringInvoicesService,
  salesReturnsService,
  creditNotesService,
} from '../../services/ventas.service';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { publicAccessService, publicLinkUrl } from '../../services/public-access.service';
import { generateEstimatePDF } from '../../utils/pdfGenerator';
import { toast } from 'sonner';
import type { Customer, Invoice } from '../../types';

interface CustomerDetailDrawerProps {
  customerId: string | null;
  onOpenChange: (open: boolean) => void;
  customerSnapshot?: Customer | null;
}

type TabKey = 'general' | 'facturas' | 'historial';

type RelatedTransaction = {
  id: string;
  kind: string;
  number: string;
  date?: string;
  status?: string;
  amount?: number;
  currency?: string;
  exchangeRate?: number;
  description?: string;
};

const unwrapList = (response: any): any[] => {
  const value = response?.data?.data ?? response?.data ?? response;
  return Array.isArray(value) ? value : [];
};

const getInvoiceStatusInfo = (status?: string) => {
  const normalized = String(status || '').toUpperCase();
  const labels: Record<string, string> = {
    DRAFT: 'Borrador',
    PENDING: 'Pendiente de pago',
    PARTIAL: 'Pago parcial',
    PAID: 'Pagada',
    OVERDUE: 'Vencida',
    CANCELLED: 'Anulada',
  };
  return { label: labels[normalized] || 'Emitida', normalized };
};

const getTransactionStatus = (status?: string) => {
  const normalized = String(status || '').toUpperCase();
  const labels: Record<string, string> = {
    DRAFT: 'Borrador',
    SENT: 'Enviada',
    APPROVED: 'Aprobada',
    CONFIRMED: 'Confirmada',
    PENDING: 'Pendiente',
    PARTIAL: 'Pago parcial',
    PAID: 'Pagada',
    OVERDUE: 'Vencida',
    ACTIVE: 'Activa',
    PAUSED: 'Pausada',
    PROCESSED: 'Procesada',
    ISSUED: 'Emitida',
    APPLIED: 'Aplicada',
    CANCELLED: 'Anulada',
    REJECTED: 'Rechazada',
  };
  return labels[normalized] || status || 'Registrado';
};

const getStatusBadge = (status?: string) => {
  const s = String(status || '').toUpperCase();
  switch (s) {
    case 'ACTIVE':
    case 'ACTIVO':
      return { label: 'Activo', className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
    case 'INACTIVE':
    case 'INACTIVO':
      return { label: 'Inactivo', className: 'bg-primary/10 text-primary border-primary/20' };
    default:
      return { label: status || '—', className: 'bg-muted text-muted-foreground border-border' };
  }
};

const getTypeBadge = (type?: string) => {
  const t = String(type || '').toUpperCase();
  switch (t) {
    case 'COMPANY':
    case 'EMPRESA':
      return { label: 'Empresa', className: 'bg-primary/10 text-primary border-primary/20', icon: Building2 };
    default:
      return { label: 'Particular', className: 'bg-primary/10 text-primary border-primary/20', icon: User };
  }
};

export function CustomerDetailDrawer({
  customerId,
  onOpenChange,
  customerSnapshot,
}: CustomerDetailDrawerProps) {
  const { baseCurrency, formatConvertedAmount } = useCurrency();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [detail, setDetail] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [relatedTransactions, setRelatedTransactions] = useState<RelatedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [publicLinks, setPublicLinks] = useState<any[]>([]);
  const [publicLinksLoading, setPublicLinksLoading] = useState(false);
  const [creatingPortalLink, setCreatingPortalLink] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setDetail(null);
      setInvoices([]);
      setHistory([]);
      setRelatedTransactions([]);
      setLoadingRelated(false);
      setSelectedInvoiceId(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setSelectedInvoiceId(null);
    setRelatedTransactions([]);
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const resp: any = await customersService.getById(customerId);
        const cust = resp?.data?.data || resp?.data || resp;
        if (cancelled) return;
        if (cust && typeof cust === 'object' && cust.id) {
          setDetail(cust);
        }
      } catch (e: any) {
        if (!cancelled && !customerSnapshot) {
          setError(e?.message || 'No se pudo cargar la información del cliente');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Fetch facturas asociadas
    setLoadingInvoices(true);
    (async () => {
      try {
        const resp: any = await invoicesService.getAll({ customerId, pageSize: 50 } as any);
        const list = unwrapList(resp);
        if (!cancelled) {
          setInvoices(Array.isArray(list) ? list : []);
        }
      } catch {
        if (!cancelled) setInvoices([]);
      } finally {
        if (!cancelled) setLoadingInvoices(false);
      }
    })();

    (async () => {
      try {
        const response: any = await auditService.getEntityHistory('CUSTOMER', customerId);
        const list = response?.data?.data || response?.data || response;
        if (!cancelled) setHistory(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setHistory([]);
      }
    })();

    setLoadingRelated(true);
    (async () => {
      const filter = { customerId, pageSize: 50 } as any;
      const results = await Promise.allSettled([
        estimatesService.getAll(filter),
        salesOrdersService.getAll(filter),
        invoicesService.getAll(filter),
        paymentsService.getAll(filter),
        recurringInvoicesService.getAll(filter),
        salesReturnsService.getAll(filter),
        creditNotesService.getAll(filter),
      ]);
      if (cancelled) return;

      const [estimates, orders, invoiceRecords, payments, recurring, returns, creditNotes] = results.map((result) =>
        result.status === 'fulfilled' ? unwrapList(result.value) : [],
      );
      const transactions: RelatedTransaction[] = [
        ...estimates.map((item: any) => ({ id: item.id, kind: 'Cotización', number: item.number, date: item.date, status: item.status, amount: Number(item.total || 0), currency: item.currency })),
        ...orders.map((item: any) => ({ id: item.id, kind: 'Orden de venta', number: item.number, date: item.date, status: item.status, amount: Number(item.total || 0), currency: item.currency })),
        ...invoiceRecords.map((item: any) => ({ id: item.id, kind: 'Factura', number: item.number, date: item.date, status: item.status, amount: Number(item.total || 0), currency: item.currency })),
        ...payments.map((item: any) => ({ id: item.id, kind: 'Pago recibido', number: item.number, date: item.date, status: item.isActive === false ? 'CANCELLED' : 'PAID', amount: Number(item.amount || 0), currency: item.currency, description: item.invoice?.number ? `Aplicado a ${item.invoice.number}` : item.reference })),
        ...recurring.map((item: any) => ({ id: item.id, kind: 'Factura recurrente', number: item.number || item.id.slice(0, 8), date: item.nextInvoiceDate || item.createdAt, status: item.status, amount: Number(item.total || 0), currency: item.currency, description: 'Programación de facturación' })),
        ...returns.map((item: any) => ({ id: item.id, kind: 'Nota de crédito', number: item.number, date: item.date, status: item.status, amount: Number(item.total || 0), currency: item.currency, description: item.reason })),
        ...creditNotes.map((item: any) => ({ id: item.id, kind: 'Crédito', number: item.number, date: item.date, status: item.status, amount: Number(item.total || 0), currency: item.currency, description: item.reason })),
      ].sort((a, b) => {
        const aDate = a.date ? new Date(a.date).getTime() : 0;
        const bDate = b.date ? new Date(b.date).getTime() : 0;
        return bDate - aDate;
      });
      setRelatedTransactions(transactions);
      setLoadingRelated(false);
    })();

    (async () => {
      setPublicLinksLoading(true);
      try { const links = await publicAccessService.list(customerId); if (!cancelled) setPublicLinks(links || []); }
      catch { if (!cancelled) setPublicLinks([]); }
      finally { if (!cancelled) setPublicLinksLoading(false); }
    })();

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  useEffect(() => {
    setActiveTab('general');
  }, [customerId]);

  const customer = detail ?? customerSnapshot ?? null;
  const isOpen = Boolean(customerId);
  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId) || null;

  const statusInfo = getStatusBadge(customer?.status);
  const typeInfo = getTypeBadge(customer?.type);
  const TypeIcon = typeInfo.icon;

  const creditLimit = Number(customer?.creditLimit ?? 0);
  const balance = Number(customer?.balance ?? 0);
  const creditDays = customer?.creditDays != null ? Number(customer.creditDays) : 0;

  const toBaseValue = (value: number, currency?: string, exchangeRate?: number) => {
    const amount = Number(value || 0);
    const rate = Number(exchangeRate || 1);
    return String(currency || baseCurrency).toUpperCase() === baseCurrency
      ? amount
      : baseCurrency === 'NIO'
        ? amount * rate
        : amount / Math.max(rate, 0.000001);
  };
  const cashTotal = invoices
    .filter((inv) => String(inv.status || '').toUpperCase() === 'PAID')
    .reduce((sum, inv) => sum + toBaseValue(inv.total, inv.currency, inv.exchangeRate), 0);
  const creditOutstanding = invoices
    .filter((inv) => ['PENDING', 'PARTIAL', 'OVERDUE'].includes(String(inv.status || '').toUpperCase()))
    .reduce((sum, inv) => sum + toBaseValue(inv.balance, inv.currency, inv.exchangeRate), 0);
  const creditUsagePct = creditLimit > 0 ? Math.min(100, (balance / creditLimit) * 100) : 0;

  const createPortalLink = async () => {
    if (!customer?.id) return;
    setCreatingPortalLink(true);
    try {
      const created = await publicAccessService.createPortalLink({ customerId: customer.id });
      const url = publicLinkUrl(created.path);
      await navigator.clipboard?.writeText(url);
      toast.success('Portal generado y enlace copiado');
      setPublicLinks(await publicAccessService.list(customer.id));
    } catch (e: any) { toast.error(e?.message || 'No se pudo generar el portal'); }
    finally { setCreatingPortalLink(false); }
  };

  const revokePublicLink = async (id: string) => {
    try { await publicAccessService.revoke(id); setPublicLinks(await publicAccessService.list(customer?.id)); toast.success('Enlace revocado'); }
    catch (e: any) { toast.error(e?.message || 'No se pudo revocar el enlace'); }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="customer-detail-panel w-full sm:max-w-3xl p-0 flex flex-col gap-0 border-l border-border/50 bg-background"
      >
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabKey)}
          className="flex flex-col flex-1 min-h-0 gap-0"
        >
          {/* Header Sticky */}
          <SheetHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border/50 px-6 py-4 space-y-3">
            <div className="flex items-start gap-4 pr-8">
              <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center font-black text-primary text-base border border-primary/20 shrink-0 shadow-inner">
                {String(customer?.name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <SheetTitle className="text-lg font-black uppercase tracking-tight truncate text-foreground">
                    {customer?.name || 'Cargando…'}
                  </SheetTitle>
                  {customer?.status && (
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-black uppercase tracking-wider border ${statusInfo.className}`}
                    >
                      {statusInfo.label}
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={`text-[9px] font-black uppercase tracking-wider border ${typeInfo.className}`}
                  >
                    <TypeIcon className="size-3 mr-1" />
                    {typeInfo.label}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono flex-wrap">
                  <span className="font-bold">{customer?.code || customer?.id?.slice(0, 8) || '—'}</span>
                  {customer?.createdAt && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-sans text-[11px]">
                        <Calendar className="size-3" />
                        Registrado {format(new Date(customer.createdAt), 'dd MMM yyyy', { locale: es })}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <TabsList className="w-full justify-start h-9 overflow-x-auto bg-muted/40 p-1 rounded-xl border border-border/40 font-bold text-xs">
              <TabsTrigger value="general" className="rounded-lg text-xs font-bold gap-1.5 px-3 py-1">
                <User className="size-3.5" /> General
              </TabsTrigger>
              <TabsTrigger value="facturas" className="rounded-lg text-xs font-bold gap-1.5 px-3 py-1">
                <FileText className="size-3.5" /> Facturas ({invoices.length})
              </TabsTrigger>
              <TabsTrigger value="historial" className="rounded-lg text-xs font-bold gap-1.5 px-3 py-1">
                <History className="size-3.5" /> Historial
              </TabsTrigger>
            </TabsList>
          </SheetHeader>

          <ScrollArea className="customer-detail-scroll min-h-0 flex-1 overflow-hidden">
            <div className="p-6 space-y-6">
              {error && (
                <Card className="p-4 bg-destructive/10 border-destructive/20 text-destructive flex items-center gap-3">
                  <AlertCircle className="size-5 shrink-0" />
                  <p className="text-xs font-bold">{error}</p>
                </Card>
              )}

              {/* Tab General */}
              <TabsContent value="general" className="mt-0 space-y-6 outline-none">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <MetricCard label="Saldo" value={formatConvertedAmount(balance, baseCurrency)} icon={DollarSign} accent={balance < 0 ? 'text-destructive' : 'text-emerald-500'} loading={loading} />
                  <MetricCard label="Límite Crédito" value={formatConvertedAmount(creditLimit, baseCurrency)} icon={CreditCard} accent="text-primary" loading={loading} />
                  <MetricCard label="Tipo Cliente" value={typeInfo.label} icon={TypeIcon} accent="text-primary" loading={loading} />
                  <MetricCard label="Estado" value={statusInfo.label} icon={CheckCircle2} accent={String(customer?.status || '').toUpperCase() === 'ACTIVE' ? 'text-emerald-500' : 'text-primary'} loading={loading} />
                </div>

                <Card className="p-5 bg-card border-border/60 rounded-2xl space-y-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
                      <CreditCard className="size-4 text-primary" /> Crédito del Cliente
                    </h3>
                    <Badge variant="outline" className="border-none bg-primary/10 text-[9px] font-black text-primary uppercase tracking-widest">
                      Plazo: {creditDays > 0 ? `${creditDays} días` : 'Contado'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-border/50 bg-muted/10 p-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Saldo deudor actual</p>
                      <p className={`mt-1 font-mono text-sm font-black ${balance > 0 ? 'text-destructive' : 'text-emerald-600'}`}>{formatConvertedAmount(balance, baseCurrency)}</p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-muted/10 p-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">De contado (pagado)</p>
                      <p className="mt-1 font-mono text-sm font-black text-foreground">{formatConvertedAmount(cashTotal, baseCurrency)}</p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-muted/10 p-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">En crédito (pendiente)</p>
                      <p className={`mt-1 font-mono text-sm font-black ${creditOutstanding > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{formatConvertedAmount(creditOutstanding, baseCurrency)}</p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-muted/10 p-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Límite de crédito</p>
                      <p className="mt-1 font-mono text-sm font-black text-primary">{formatConvertedAmount(creditLimit, baseCurrency)}</p>
                    </div>
                  </div>
                  {creditLimit > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                        <span className="uppercase tracking-widest">Uso del crédito</span>
                        <span className={`font-mono ${creditUsagePct >= 90 ? 'text-destructive' : creditUsagePct >= 70 ? 'text-amber-600' : 'text-emerald-600'}`}>{creditUsagePct.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
                        <div className={`h-full rounded-full transition-all ${creditUsagePct >= 90 ? 'bg-destructive' : creditUsagePct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${creditUsagePct}%` }} />
                      </div>
                      {creditUsagePct >= 100 && (
                        <p className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-[10px] font-bold text-destructive">
                          <AlertCircle className="size-3" /> Límite alcanzado: no se puede emitir más crédito hasta registrar pagos.
                        </p>
                      )}
                    </div>
                  )}
                </Card>

                <Card className="p-5 bg-card border-border/60 rounded-2xl space-y-4 shadow-sm">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
                    <MapPin className="size-4 text-primary" /> Contacto y Ubicación
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <InfoField label="Correo Electrónico" value={customer?.email || 'Sin correo'} icon={Mail} muted={!customer?.email} />
                    <InfoField label="Teléfono" value={customer?.phone || 'Sin teléfono'} icon={Phone} mono muted={!customer?.phone} />
                    <InfoField label="Dirección" value={customer?.address || 'Sin dirección'} icon={MapPin} muted={!customer?.address} />
                    <InfoField label="Ciudad" value={customer?.city || 'Sin ciudad'} icon={MapPin} muted={!customer?.city} />
                    <InfoField label="Departamento" value={customer?.department || 'Sin departamento'} icon={MapPin} muted={!customer?.department} />
                    <InfoField label="País" value={customer?.country || 'Sin país'} icon={MapPin} muted={!customer?.country} />
                  </div>
                </Card>

                <Card className="p-5 bg-card border-border/60 rounded-2xl space-y-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2"><Link2 className="size-4 text-primary" /> Accesos públicos seguros</h3>
                      <p className="mt-1 text-[11px] text-muted-foreground">Genera enlaces temporales para que el cliente consulte documentos o su portal sin tener una cuenta interna.</p>
                    </div>
                    <Button size="sm" onClick={createPortalLink} disabled={creatingPortalLink || !customer?.id} className="shrink-0 gap-1.5 rounded-xl text-xs font-bold"><RefreshCcw className={`size-3.5 ${creatingPortalLink ? 'animate-spin' : ''}`} /> Portal</Button>
                  </div>
                  {publicLinksLoading ? <Skeleton className="h-12 w-full rounded-xl" /> : publicLinks.length === 0 ? <p className="rounded-xl border border-dashed border-border/50 p-4 text-xs text-muted-foreground">Todavía no hay enlaces activos para este cliente.</p> : <div className="space-y-2">{publicLinks.filter(link => link.isActive).slice(0, 8).map(link => <div key={link.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/10 p-3"><div className="min-w-0"><p className="text-xs font-bold">{link.accessType === 'PORTAL' ? 'Portal del cliente' : `Documento · ${link.documentType || 'PDF'}`}</p><p className="text-[10px] text-muted-foreground">{link.expiresAt ? `Expira ${format(new Date(link.expiresAt), 'dd/MM/yyyy')}` : 'Sin fecha de expiración'}</p></div><div className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" className="size-8" title="Copiar enlace" onClick={() => toast.info('Para copiar un enlace existente, genéralo nuevamente desde Portal')}><Copy className="size-3.5" /></Button><Button variant="ghost" size="icon" className="size-8 text-primary" title="Revocar enlace" onClick={() => revokePublicLink(link.id)}><ShieldAlert className="size-3.5" /></Button></div></div>)}</div>}
                </Card>

                <Card className="p-5 bg-card border-border/60 rounded-2xl space-y-4 shadow-sm">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
                    <Building2 className="size-4 text-primary" /> Datos Fiscales y Financieros
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    <InfoField label="RUC" value={customer?.ruc || '—'} icon={Hash} mono muted={!customer?.ruc} />
                    <InfoField label="Identificación Fiscal" value={customer?.taxId || 'No registrado'} icon={Hash} mono muted={!customer?.taxId} />
                    <InfoField label="Régimen Fiscal" value={customer?.fiscalRegime || 'No registrado'} icon={ShieldAlert} muted={!customer?.fiscalRegime} />
                    <InfoField label="Lista de Precios" value={customer?.priceList?.name || 'Sin lista asignada'} icon={Tag} muted={!customer?.priceList} />
                    <InfoField label="Límite de Crédito Concedido" value={formatConvertedAmount(creditLimit, baseCurrency)} icon={DollarSign} mono />
                    <InfoField label="Plazo de Crédito" value={creditDays > 0 ? `${creditDays} días` : 'Contado (0 días)'} icon={Clock} mono />
                    <InfoField label="Saldo Deudor Actual" value={formatConvertedAmount(balance, baseCurrency)} icon={DollarSign} mono />
                    <InfoField label="Código Interno" value={customer?.code || '—'} icon={Tag} mono />
                  </div>

                  {customer?.notes && (
                    <div className="pt-2 border-t border-border/40 space-y-1">
                      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 font-bold">
                        <Info className="size-3" /> Observaciones / Notas
                      </Label>
                      <p className="text-xs text-muted-foreground bg-muted/20 p-3 rounded-xl border border-border/30">
                        {customer.notes}
                      </p>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* Tab Facturas */}
              <TabsContent value="facturas" className="mt-0 space-y-4 outline-none">
                {loadingInvoices ? (
                  <div className="space-y-3 p-4">
                    <Skeleton className="h-10 w-full rounded-xl" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                    <Skeleton className="h-10 w-full rounded-xl" />
                  </div>
                ) : invoices.length === 0 ? (
                  <EmptyState icon={FileText} title="Sin facturas registradas" description="Este cliente aún no registra facturas de venta en el sistema." />
                ) : (
                  <>
                  <Card className="hidden rounded-2xl border border-border/60 overflow-hidden shadow-sm xl:block">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">N.º de factura</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Fecha</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Vencimiento</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Total</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Detalle</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((inv) => (
                          <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedInvoiceId(inv.id)}>
                            <TableCell className="font-mono text-xs font-bold text-foreground">{inv.number}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{inv.date ? format(new Date(inv.date), 'dd/MM/yyyy') : '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{inv.dueDate ? format(new Date(inv.dueDate), 'dd/MM/yyyy') : '—'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[9px] font-black tracking-wider border-none bg-muted/50 text-muted-foreground">
                                {getInvoiceStatusInfo(inv.status).label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-black text-right tabular-nums text-foreground">{formatConvertedAmount(inv.total, inv.currency || 'NIO', inv.exchangeRate)}</TableCell>
                            <TableCell className="text-right"><Button type="button" variant="ghost" size="sm" className="h-7 gap-1 rounded-lg px-2 text-[10px] font-bold text-muted-foreground" onClick={(event) => { event.stopPropagation(); setSelectedInvoiceId(inv.id); }}>Ver detalle <ChevronRight className="size-3" /></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                  <div className="h-[calc(100dvh-15rem)] min-h-[24rem] max-h-none space-y-3 overflow-y-auto rounded-2xl border border-border/60 bg-muted/5 p-3 xl:hidden">
                    {invoices.map((inv) => (
                        <article key={inv.id} className="cursor-pointer rounded-2xl border border-border/50 bg-card p-4 shadow-sm" onClick={() => setSelectedInvoiceId(inv.id)}>
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-mono text-sm font-black text-foreground">{inv.number}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">{inv.date ? format(new Date(inv.date), 'dd/MM/yyyy') : '—'}</p>
                          </div>
                          <Badge variant="outline" className="shrink-0 border-none bg-muted/50 text-[9px] font-black tracking-wider text-muted-foreground">
                            {getInvoiceStatusInfo(inv.status).label}
                          </Badge>
                        </div>
                        <div className="mt-4 flex items-end justify-between gap-3 border-t border-border/40 pt-3">
                          <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total</p>
                            <p className="text-[10px] font-bold text-muted-foreground">Pagado: {formatConvertedAmount(inv.amountPaid || 0, inv.currency || 'NIO', inv.exchangeRate)}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-base font-black text-foreground">{formatConvertedAmount(inv.total, inv.currency || 'NIO', inv.exchangeRate)}</p>
                            <p className={`text-[10px] font-black ${Number(inv.balance || 0) > 0 ? 'text-destructive' : 'text-primary'}`}>
                              {Number(inv.balance || 0) > 0 ? `Saldo: ${formatConvertedAmount(inv.balance, inv.currency || 'NIO', inv.exchangeRate)}` : 'Pagada'}
                            </p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                  {selectedInvoice && (
                    <InvoiceInlineDetail invoice={selectedInvoice} onClose={() => setSelectedInvoiceId(null)} formatAmount={formatConvertedAmount} tenantName={user?.tenantName || 'Empresa'} />
                  )}
                  </>
                )}
              </TabsContent>

              {/* Tab Historial */}
              <TabsContent value="historial" className="mt-0 space-y-4 outline-none">
                <Card className="rounded-2xl border-border/60 bg-card p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/80">
                        <Activity className="size-4 text-primary" /> Transacciones del cliente
                      </h3>
                      <p className="mt-1 text-[11px] text-muted-foreground">Cotizaciones, órdenes, facturas, pagos y demás operaciones relacionadas con este cliente.</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[9px] font-black">{relatedTransactions.length}</Badge>
                  </div>
                  {loadingRelated ? (
                    <div className="mt-4 space-y-2">
                      <Skeleton className="h-12 w-full rounded-xl" />
                      <Skeleton className="h-12 w-full rounded-xl" />
                      <Skeleton className="h-12 w-full rounded-xl" />
                    </div>
                  ) : relatedTransactions.length === 0 ? (
                    <p className="mt-4 rounded-xl border border-dashed border-border/50 p-4 text-xs text-muted-foreground">Aún no hay transacciones comerciales registradas para este cliente.</p>
                  ) : (
                    <div className="mt-4 divide-y divide-border/40 rounded-xl border border-border/50">
                      {relatedTransactions.slice(0, 50).map((transaction) => (
                        <div key={`${transaction.kind}-${transaction.id}`} className="flex items-center justify-between gap-3 p-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground"><FileText className="size-4" /></div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-foreground">{transaction.kind}</p>
                              <p className="truncate font-mono text-[10px] text-muted-foreground">{transaction.number || 'Sin número'}{transaction.description ? ` · ${transaction.description}` : ''}</p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[10px] font-bold text-muted-foreground">{transaction.date ? format(new Date(transaction.date), 'dd/MM/yyyy') : '—'}</p>
                            <p className="text-[10px] font-black text-foreground">{transaction.amount !== undefined ? formatConvertedAmount(transaction.amount, transaction.currency || 'NIO', transaction.exchangeRate) : getTransactionStatus(transaction.status)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="p-5 bg-card border-border/60 rounded-2xl space-y-4 shadow-sm">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
                    <History className="size-4 text-primary" /> Cambios del registro del cliente
                  </h3>
                  <div className="space-y-4 pl-2 border-l-2 border-border/40 ml-2 pt-1">
                    {history.length > 0 ? history.slice(0, 30).map((event: any) => {
                      let details: any = {};
                      try { details = event.details ? JSON.parse(event.details) : {}; } catch { details = {}; }
                      const changes = details.commercial_changes ? Object.entries(details.commercial_changes).map(([field, values]: any) => `${field}: ${values.before ?? '—'} → ${values.after ?? '—'}`).join(' · ') : '';
                      return <div key={event.id} className="relative pl-4 space-y-1"><div className="absolute -left-[21px] top-1 size-3 rounded-full border-2 border-background bg-primary" /><p className="text-xs font-bold text-foreground">{event.action === 'CREATE' ? 'Cliente registrado' : 'Datos comerciales actualizados'}</p><p className="text-[11px] text-muted-foreground">{changes || details.fields_updated || 'Actualización registrada'}</p><p className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono"><Clock className="size-3" />{event.createdAt ? format(new Date(event.createdAt), 'PPP p', { locale: es }) : '—'}</p></div>;
                    }) : <>
                    {customer?.createdAt && (
                      <div className="relative pl-4 space-y-1">
                        <div className="absolute -left-[21px] top-1 size-3 rounded-full bg-primary border-2 border-background" />
                        <p className="text-xs font-bold text-foreground">Cliente Registrado</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                          <Clock className="size-3" />
                          {format(new Date(customer.createdAt), 'PPP p', { locale: es })}
                        </p>
                      </div>
                    )}
                    {customer?.updatedAt && (
                      <div className="relative pl-4 space-y-1">
                        <div className="absolute -left-[21px] top-1 size-3 rounded-full bg-primary border-2 border-background" />
                        <p className="text-xs font-bold text-foreground">Última Actualización</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                          <Clock className="size-3" />
                          {format(new Date(customer.updatedAt), 'PPP p', { locale: es })}
                        </p>
                      </div>
                    )}
                    </>}
                  </div>
                </Card>
              </TabsContent>
            </div>
          </ScrollArea>

          {/* Footer Sticky */}
          <div className="sticky bottom-0 z-10 bg-background/95 backdrop-blur-md border-t border-border/50 px-6 py-3 flex items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Detalle del Cliente</p>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="gap-1.5 font-bold rounded-xl text-xs">
              Cerrar <ChevronRight className="size-3" />
            </Button>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

// Auxiliares
interface MetricCardProps { label: string; value: string; icon: React.ComponentType<{ className?: string }>; accent?: string; loading?: boolean; }
function MetricCard({ label, value, icon: Icon, accent = 'text-foreground', loading }: MetricCardProps) {
  return (
    <Card className="p-3.5 border-border/60 hover:border-primary/30 transition-all rounded-xl shadow-xs">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-black">{label}</p>
        <Icon className={`size-3.5 ${accent}`} />
      </div>
      {loading ? <Skeleton className="h-5 w-3/4 mt-2" /> : <p className={`text-sm font-black tabular-nums ${accent} truncate mt-1`} title={value}>{value}</p>}
    </Card>
  );
}

interface InfoFieldProps { label: string; value: string; icon: React.ComponentType<{ className?: string }>; mono?: boolean; muted?: boolean; }
function InfoField({ label, value, icon: Icon, mono, muted }: InfoFieldProps) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 font-bold"><Icon className="size-3" />{label}</Label>
      <p className={`text-xs ${mono ? 'font-mono' : 'font-bold'} ${muted ? 'text-muted-foreground/60 italic' : 'text-foreground'} break-words`}>{value}</p>
    </div>
  );
}

interface EmptyStateProps { icon: React.ComponentType<{ className?: string }>; title: string; description: string; }
function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <Card className="p-8 gap-2 flex flex-col items-center text-center border-dashed border-border/60 bg-muted/10 rounded-2xl">
      <div className="size-10 rounded-full bg-muted/40 flex items-center justify-center"><Icon className="size-5 text-muted-foreground" /></div>
      <p className="text-xs font-bold text-foreground mt-1">{title}</p>
      <p className="text-[11px] text-muted-foreground max-w-xs">{description}</p>
    </Card>
  );
}

interface InvoiceInlineDetailProps {
  invoice: Invoice;
  onClose: () => void;
  formatAmount: (amount: number, currency?: any, exchangeRate?: number) => string;
  tenantName?: string;
}

function InvoiceInlineDetail({ invoice, onClose, formatAmount, tenantName }: InvoiceInlineDetailProps) {
  const statusInfo = getInvoiceStatusInfo(invoice.status);
  const handleDownloadPdf = async () => {
    const pdfToastId = toast.loading('Generando PDF de la factura...');
    try {
      await generateEstimatePDF({
        estimate: invoice as any,
        tenantName: tenantName || 'Empresa',
        formatAmount: formatAmount as any,
        documentType: 'invoice' as any,
      });
      toast.success('PDF descargado', { id: pdfToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo descargar el PDF', { id: pdfToastId });
    }
  };
  return (
    <Card className="rounded-2xl border-primary/20 bg-primary/[0.03] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-black uppercase tracking-tight">Detalle de factura</h3>
            <Badge variant="outline" className="border-none bg-muted/50 text-[9px] font-black text-muted-foreground">{statusInfo.label}</Badge>
          </div>
          <p className="mt-1 font-mono text-xs font-bold text-muted-foreground">{invoice.number}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant="ghost" size="icon" title="Descargar detalle de la factura en PDF" aria-label="Descargar detalle de la factura en PDF" className="size-8 rounded-lg text-muted-foreground hover:text-primary" onClick={handleDownloadPdf}>
            <FileDown className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" title="Cerrar detalle" aria-label="Cerrar detalle" className="size-8 rounded-lg text-muted-foreground" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <InfoField label="Fecha de emisión" value={invoice.date ? format(new Date(invoice.date), 'dd/MM/yyyy') : '—'} icon={Calendar} />
        <InfoField label="Fecha de vencimiento" value={invoice.dueDate ? format(new Date(invoice.dueDate), 'dd/MM/yyyy') : '—'} icon={Clock} />
        <InfoField label="Total" value={formatAmount(Number(invoice.total || 0), invoice.currency, invoice.exchangeRate)} icon={DollarSign} mono />
        <InfoField label="Saldo pendiente" value={formatAmount(Number(invoice.balance || 0), invoice.currency, invoice.exchangeRate)} icon={CreditCard} mono />
      </div>

      {(invoice.paymentMethod || (invoice as any).paymentDetails) && (
        <div className="mt-4 rounded-xl border border-border/50 bg-muted/20 p-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Banknote className="size-3" /> Forma de cobro: <span className="text-foreground uppercase">{invoice.paymentMethod || '—'}</span>
          </p>
          {(() => {
            const details = (invoice as any).paymentDetails;
            if (!details) return null;
            if (invoice.paymentMethod === 'TRANSFER' && Array.isArray(details.transfers) && details.transfers.length > 0) {
              return (
                <div className="mt-2 space-y-1">
                  {details.transfers.map((t: any, i: number) => (
                    <p key={i} className="text-xs font-mono text-muted-foreground">
                      {t.bank ? `${t.bank} · ` : ''}Cuenta: <span className="font-bold text-foreground">{t.accountNumber || '—'}</span>
                    </p>
                  ))}
                </div>
              );
            }
            if (invoice.paymentMethod === 'CHECK' && Array.isArray(details.checks) && details.checks.length > 0) {
              return (
                <div className="mt-2 space-y-1">
                  {details.checks.map((c: any, i: number) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      Cheque <span className="font-mono font-bold text-foreground">{c.checkNumber || '—'}</span>
                      {c.bank ? ` · ${c.bank}` : ''}
                      {c.holder ? ` · ${c.holder}` : ''}
                    </p>
                  ))}
                </div>
              );
            }
            if (invoice.paymentMethod === 'CARD' && details.card) {
              return (
                <p className="mt-2 text-xs font-mono text-muted-foreground">
                  Tarjeta: <span className="font-bold text-foreground">{details.card.cardNumber || '—'}</span>
                  {details.card.bank ? ` · ${details.card.bank}` : ''}
                  {details.card.holder ? ` · ${details.card.holder}` : ''}
                </p>
              );
            }
            return null;
          })()}
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-xl border border-border/50 bg-background/40">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Concepto</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Cantidad</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Precio</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(invoice.items || []).map((item) => (
              <TableRow key={item.id}>
                <TableCell className="max-w-[16rem] text-xs font-bold">{item.description || 'Producto o servicio'}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{Number(item.quantity || 0)}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{formatAmount(Number(item.unitPrice || 0), invoice.currency, invoice.exchangeRate)}</TableCell>
                <TableCell className="text-right text-xs font-black">{formatAmount(Number(item.total || 0), invoice.currency, invoice.exchangeRate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex flex-col items-end gap-1 text-xs">
        <p className="text-muted-foreground">Subtotal: <span className="font-bold text-foreground">{formatAmount(Number(invoice.subtotal || 0), invoice.currency, invoice.exchangeRate)}</span></p>
        <p className="text-muted-foreground">Impuestos: <span className="font-bold text-foreground">{formatAmount(Number(invoice.taxAmount || 0), invoice.currency, invoice.exchangeRate)}</span></p>
        <p className="text-muted-foreground">Pagado: <span className="font-bold text-foreground">{formatAmount(Number(invoice.amountPaid || 0), invoice.currency, invoice.exchangeRate)}</span></p>
        <p className="text-sm font-black">Total: <span className="text-primary">{formatAmount(Number(invoice.total || 0), invoice.currency, invoice.exchangeRate)}</span></p>
      </div>
      {invoice.notes && <p className="mt-4 rounded-xl border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground"><span className="font-bold text-foreground">Notas:</span> {invoice.notes}</p>}
    </Card>
  );
}

export default CustomerDetailDrawer;
