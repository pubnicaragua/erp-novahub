'use client';

import { Fragment, useEffect, useState } from 'react';
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
  TrendingUp,
  Banknote,
  Download,
  Loader2,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { getSalesInvoiceStatusColor, getSalesStatusColor } from '../../utils/salesStatus';
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
import { useTheme } from '../../contexts/ThemeContext';
import { publicAccessService, publicLinkUrl } from '../../services/public-access.service';
import { previewSalesTransactionPDF } from '../../utils/pdfGenerator';
import { exportCustomerTransactionsPdf } from '../../utils/customerTransactionsExport';
import { PdfDownloadButton } from '../ui/PdfDownloadButton';
import type { PdfDownloadFormat } from '../../utils/pdfDownloadFormats';
import { getInvoicePaymentPresentation, paymentMethodLabel } from '../../utils/paymentMethods';
import { normalizeSalesExtraCharges } from '../../utils/salesCharges';
import { getCustomerDebtAmount, getCustomerFavorAmount } from '../../utils/customerBalance';
import { toast } from 'sonner';
import type { Customer, Estimate, Invoice } from '../../types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';

interface CustomerDetailDrawerProps {
  customerId: string | null;
  onOpenChange: (open: boolean) => void;
  customerSnapshot?: Customer | null;
}

type TabKey = 'general' | 'movimientos' | 'historial';
type MovementFilter = 'ALL' | 'Factura' | 'Orden de venta' | 'Cotización' | 'Nota de crédito' | 'Crédito' | 'Pago recibido' | 'Factura recurrente';
type HistoryExportScope = 'ALL' | 'FILTERED';
type HistoryExportCurrency = 'NIO' | 'USD';

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
  document?: any;
};

const unwrapList = (response: any): any[] => {
  const value = response?.data?.data ?? response?.data ?? response;
  return Array.isArray(value) ? value : [];
};

const fetchAllCustomerRecords = async (fetcher: (filters: any) => Promise<any>, customerId: string) => {
  const first = await fetcher({ customerId, page: 1, pageSize: 5000, report: true });
  const totalPages = Math.max(1, Number(first?.meta?.totalPages || 1));
  const remaining = totalPages > 1
    ? await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => fetcher({ customerId, page: index + 2, pageSize: 5000, report: true })))
    : [];
  return [first, ...remaining].flatMap(unwrapList);
};

const getInvoiceStatusInfo = (status?: string) => {
  const normalized = String(status || '').toUpperCase();
  const labels: Record<string, string> = {
    DRAFT: 'Borrador',
    PENDING: 'En proceso',
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
    IN_PROCESS: 'En proceso',
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
  const { baseCurrency, formatConvertedAmount, convertBetweenCurrencies, exchangeRate } = useCurrency();
  const { user } = useAuth();
  const { themeConfig } = useTheme();
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [detail, setDetail] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [relatedTransactions, setRelatedTransactions] = useState<RelatedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<RelatedTransaction | null>(null);
  const [movementFilter, setMovementFilter] = useState<MovementFilter>('ALL');
  const [publicLinks, setPublicLinks] = useState<any[]>([]);
  const [publicLinksLoading, setPublicLinksLoading] = useState(false);
  const [creatingPortalLink, setCreatingPortalLink] = useState(false);
  const [exportingHistory, setExportingHistory] = useState(false);
  const [historyExportDialogOpen, setHistoryExportDialogOpen] = useState(false);
  const [historyExportScope, setHistoryExportScope] = useState<HistoryExportScope>('ALL');
  const [historyExportFilter, setHistoryExportFilter] = useState<string>('ALL');
  const [historyExportCurrency, setHistoryExportCurrency] = useState<HistoryExportCurrency>(baseCurrency);

  useEffect(() => {
    if (!customerId) {
      setDetail(null);
      setInvoices([]);
      setHistory([]);
      setHistoryLoading(false);
      setRelatedTransactions([]);
      setLoadingRelated(false);
      setSelectedInvoiceId(null);
      setSelectedMovement(null);
      setMovementFilter('ALL');
      setError(null);
      return;
    }

    let cancelled = false;
    setSelectedInvoiceId(null);
    setSelectedMovement(null);
    setMovementFilter('ALL');
    setHistory([]);
    setHistoryLoading(true);
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
    (async () => {
      try {
        const resp: any = await invoicesService.getAll({ customerId, pageSize: 50 } as any);
        const list = unwrapList(resp);
        if (!cancelled) {
          setInvoices(Array.isArray(list) ? list : []);
        }
      } catch {
        if (!cancelled) setInvoices([]);
      }
    })();

    (async () => {
      try {
        const response: any = await auditService.getEntityHistory('CUSTOMER', customerId);
        const list = response?.data?.data || response?.data || response;
        if (!cancelled) setHistory(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setHistory([]);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();

    setLoadingRelated(true);
    (async () => {
      const results = await Promise.allSettled([
        fetchAllCustomerRecords((filter) => estimatesService.getAll(filter), customerId),
        fetchAllCustomerRecords((filter) => salesOrdersService.getAll(filter), customerId),
        fetchAllCustomerRecords((filter) => invoicesService.getAll(filter), customerId),
        fetchAllCustomerRecords((filter) => paymentsService.getAll(filter), customerId),
        fetchAllCustomerRecords((filter) => recurringInvoicesService.getAll(filter), customerId),
        fetchAllCustomerRecords((filter) => salesReturnsService.getAll(filter), customerId),
        fetchAllCustomerRecords((filter) => creditNotesService.getAll(filter), customerId),
      ]);
      if (cancelled) return;

      const [estimates, orders, invoiceRecords, payments, recurring, returns, creditNotes] = results.map((result) =>
        result.status === 'fulfilled' ? unwrapList(result.value) : [],
      );
      const transactions: RelatedTransaction[] = [
        ...estimates.map((item: any) => ({ id: item.id, kind: 'Cotización', number: item.number, date: item.date, status: item.status, amount: Number(item.total || 0), currency: item.currency, exchangeRate: item.exchangeRate, document: item })),
        ...orders.map((item: any) => ({ id: item.id, kind: 'Orden de venta', number: item.number, date: item.date, status: item.status, amount: Number(item.total || 0), currency: item.currency, exchangeRate: item.exchangeRate, document: item })),
        ...invoiceRecords.map((item: any) => ({ id: item.id, kind: 'Factura', number: item.number, date: item.date, status: item.status, amount: Number(item.total || 0), currency: item.currency, exchangeRate: item.exchangeRate, document: item })),
        ...payments.map((item: any) => ({ id: item.id, kind: 'Pago recibido', number: item.number, date: item.date, status: item.isActive === false ? 'CANCELLED' : 'PAID', amount: Number(item.amount || 0), currency: item.currency, exchangeRate: item.exchangeRate, description: item.invoice?.number ? `Aplicado a ${item.invoice.number}` : item.reference, document: item })),
        ...recurring.map((item: any) => ({ id: item.id, kind: 'Factura recurrente', number: item.number || item.id.slice(0, 8), date: item.nextInvoiceDate || item.createdAt, status: item.status, amount: Number(item.total || 0), currency: item.currency, exchangeRate: item.exchangeRate, description: 'Programación de facturación', document: item })),
        ...returns.map((item: any) => ({ id: item.id, kind: 'Nota de crédito', number: item.number, date: item.date, status: item.status, amount: Number(item.total || 0), currency: item.currency, exchangeRate: item.exchangeRate, description: item.reason, document: item })),
        ...creditNotes.map((item: any) => ({ id: item.id, kind: 'Crédito', number: item.number, date: item.date, status: item.status, amount: Number(item.total || 0), currency: item.currency, exchangeRate: item.exchangeRate, description: item.reason, document: item })),
      ].sort((a, b) => {
        const aDate = a.date ? new Date(a.date).getTime() : 0;
        const bDate = b.date ? new Date(b.date).getTime() : 0;
        if (bDate !== aDate) return bDate - aDate;
        const number = (value: string) => {
          const match = String(value || '').match(/(\d+)(?!.*\d)/);
          return match ? Number(match[1]) : Number.NEGATIVE_INFINITY;
        };
        return number(b.number) - number(a.number);
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

  const openMovementDetail = (transaction: RelatedTransaction) => {
    if (transaction.kind === 'Factura') {
      const invoice = (transaction.document as Invoice | undefined) || invoices.find((item) => item.id === transaction.id);
      if (invoice) {
        if (selectedInvoiceId === invoice.id) {
          setSelectedInvoiceId(null);
          return;
        }
        setSelectedInvoiceId(invoice.id);
        setSelectedMovement(null);
        return;
      }
    }
    if (selectedMovement?.id === transaction.id) {
      setSelectedMovement(null);
      return;
    }
    setSelectedInvoiceId(null);
    setSelectedMovement(transaction);
  };

  const statusInfo = getStatusBadge(customer?.status);
  const typeInfo = getTypeBadge(customer?.type);
  const TypeIcon = typeInfo.icon;

  const creditLimit = Number(customer?.creditLimit ?? 0);
  const customerDebt = getCustomerDebtAmount(customer);
  const customerFavor = getCustomerFavorAmount(customer);
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
    .filter((inv) => ['PENDING', 'PARTIAL', 'CREDIT', 'OVERDUE'].includes(String(inv.status || '').toUpperCase()))
    .reduce((sum, inv) => sum + toBaseValue(inv.balance, inv.currency, inv.exchangeRate), 0);
  const creditUsagePct = creditLimit > 0 ? Math.min(100, (customerDebt / creditLimit) * 100) : 0;
  const visibleMovements = movementFilter === 'ALL'
    ? relatedTransactions
    : relatedTransactions.filter((transaction) => transaction.kind === movementFilter);
  const historyExportTypeOptions = Array.from(
    new Set(relatedTransactions.map((transaction) => transaction.kind).filter(Boolean)),
  );
  const selectedHistoryRows = historyExportScope === 'FILTERED' && historyExportFilter !== 'ALL'
    ? relatedTransactions.filter((transaction) => transaction.kind === historyExportFilter)
    : relatedTransactions;

  const auditEventsByNewest = [...history].sort((left, right) => {
    const leftTime = left?.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right?.createdAt ? new Date(right.createdAt).getTime() : 0;
    return rightTime - leftTime;
  });
  const createdAuditEvent = auditEventsByNewest.find((event) => String(event?.action || '').toUpperCase() === 'CREATE');
  const updatedAuditEvent = auditEventsByNewest.find((event) => ['UPDATE', 'STATUS_CHANGE'].includes(String(event?.action || '').toUpperCase()));
  const auditActor = (event: any) => event?.user?.name || event?.user?.email || (event?.userId ? `Usuario ${String(event.userId).slice(0, 8)}` : 'No disponible');
  const auditDate = (event: any) => event?.createdAt ? format(new Date(event.createdAt), 'PPP p', { locale: es }) : 'Fecha no disponible';

  const downloadHistory = async (exportFormat: PdfDownloadFormat = 'configured', scope: HistoryExportScope = 'ALL') => {
    if (!customer?.id) return;
    setExportingHistory(true);
    try {
      const rowsToExport = scope === 'FILTERED' && historyExportFilter !== 'ALL'
        ? relatedTransactions.filter((transaction) => transaction.kind === historyExportFilter)
        : relatedTransactions;
      if (!rowsToExport.length) {
        toast.info('Este cliente todavía no tiene transacciones para descargar.');
        return;
      }
      const options = {
        rows: rowsToExport.map(({ document: _document, ...row }) => ({
          ...row,
          amount: Number(convertBetweenCurrencies(
            Number(row.amount || 0),
            row.currency,
            historyExportCurrency,
            row.exchangeRate,
            exchangeRate,
          ).toFixed(2)),
          currency: historyExportCurrency,
        })),
        customerName: customer.name || 'Cliente',
        customerData: customer,
        branchName: customer.branchName,
        tenantName: user?.sessionBranding?.name || user?.tenantName || 'Empresa',
        tenantLogo: themeConfig?.logo,
        primaryColor: themeConfig?.colors?.primary,
        outputCurrency: historyExportCurrency,
      };
      await exportCustomerTransactionsPdf({ ...options, pdfFormat: exportFormat });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo descargar el historial del cliente.');
    } finally {
      setExportingHistory(false);
    }
  };

  const openHistoryExportDialog = () => {
    setHistoryExportScope('ALL');
    setHistoryExportFilter('ALL');
    setHistoryExportCurrency(baseCurrency);
    setHistoryExportDialogOpen(true);
  };

  const confirmHistoryExport = () => {
    setHistoryExportDialogOpen(false);
    void downloadHistory('configured', historyExportScope);
  };

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
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="customer-detail-panel w-full overflow-hidden sm:max-w-3xl p-0 flex flex-col gap-0 border-l border-border/50 bg-background"
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
                  {(loading || loadingRelated) && <span role="status" className="inline-flex items-center gap-1 font-sans text-[10px] font-bold text-primary"><Loader2 className="size-3 animate-spin" /> Cargando detalle…</span>}
                </div>
              </div>
            </div>

            <div className="flex justify-end" data-tour="customer-detail-actions">
              <Button
                type="button"
                variant="outline"
                onClick={openHistoryExportDialog}
                disabled={!customer || loadingRelated || exportingHistory || relatedTransactions.length === 0}
                className="max-w-full gap-1.5 rounded-xl text-xs font-bold"
              >
                <Download className="size-4 shrink-0 text-primary" />
                <span className="truncate">Exportar historial del cliente</span>
              </Button>
            </div>

            <TabsList className="w-full justify-start h-9 overflow-x-auto bg-muted/40 p-1 rounded-xl border border-border/40 font-bold text-xs">
              <TabsTrigger value="general" className="rounded-lg text-xs font-bold gap-1.5 px-3 py-1">
                <User className="size-3.5" /> General
              </TabsTrigger>
              <TabsTrigger value="movimientos" className="rounded-lg text-xs font-bold gap-1.5 px-3 py-1">
                <Activity className="size-3.5" /> Movimientos ({relatedTransactions.length})
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
                <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                  <MetricCard label="Saldo pendiente" value={formatConvertedAmount(customerDebt, baseCurrency)} icon={DollarSign} accent="text-rose-600 dark:text-rose-400" loading={loading} />
                  <MetricCard label="Saldo a favor" value={formatConvertedAmount(customerFavor, baseCurrency)} icon={Banknote} accent="text-emerald-600 dark:text-emerald-400" loading={loading} />
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
                  <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-5">
                    <div className="flex min-w-0 min-h-[100px] flex-col rounded-xl border border-border/50 bg-muted/10 p-2.5">
                      <p className="min-h-[2rem] text-[9px] font-black uppercase leading-tight tracking-widest text-muted-foreground">Saldo pendiente</p>
                      <p className="mt-1 min-h-[1.25rem] text-sm font-black tabular-nums text-rose-600 dark:text-rose-400">{formatConvertedAmount(customerDebt, baseCurrency)}</p>
                      <p className="mt-1 min-h-[1.5rem] text-[10px] leading-relaxed text-muted-foreground">Pendiente por cobrar</p>
                    </div>
                    <div className="flex min-w-0 min-h-[100px] flex-col rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                      <p className="min-h-[2rem] text-[9px] font-black uppercase leading-tight tracking-widest text-muted-foreground">Saldo a favor</p>
                      <p className="mt-1 min-h-[1.25rem] text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-400">{formatConvertedAmount(customerFavor, baseCurrency)}</p>
                      <p className="mt-1 min-h-[1.5rem] text-[10px] leading-relaxed text-muted-foreground">Disponible para aplicar</p>
                    </div>
                    <div className="flex min-w-0 min-h-[100px] flex-col rounded-xl border border-border/50 bg-muted/10 p-2.5">
                      <p className="min-h-[2rem] text-[9px] font-black uppercase leading-tight tracking-widest text-muted-foreground">De contado (pagado)</p>
                      <p className="mt-1 min-h-[1.25rem] text-sm font-black tabular-nums text-foreground">{formatConvertedAmount(cashTotal, baseCurrency)}</p>
                      <div className="mt-1 min-h-[1.5rem]" aria-hidden="true" />
                    </div>
                    <div className="flex min-w-0 min-h-[100px] flex-col rounded-xl border border-border/50 bg-muted/10 p-2.5">
                      <p className="min-h-[2rem] text-[9px] font-black uppercase leading-tight tracking-widest text-muted-foreground">En crédito (pendiente)</p>
                      <p className={`mt-1 min-h-[1.25rem] text-sm font-black tabular-nums ${creditOutstanding > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{formatConvertedAmount(creditOutstanding, baseCurrency)}</p>
                      <div className="mt-1 min-h-[1.5rem]" aria-hidden="true" />
                    </div>
                    <div className="flex min-w-0 min-h-[100px] flex-col rounded-xl border border-border/50 bg-muted/10 p-2.5">
                      <p className="min-h-[2rem] text-[9px] font-black uppercase leading-tight tracking-widest text-muted-foreground">Límite de crédito</p>
                      <p className="mt-1 min-h-[1.25rem] text-sm font-black tabular-nums text-primary">{formatConvertedAmount(creditLimit, baseCurrency)}</p>
                      <div className="mt-1 min-h-[1.5rem]" aria-hidden="true" />
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
                    <InfoField label="Saldo pendiente" value={formatConvertedAmount(customerDebt, baseCurrency)} icon={DollarSign} mono />
                    <InfoField label="Saldo a favor" value={formatConvertedAmount(customerFavor, baseCurrency)} icon={Banknote} mono />
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

              {/* Tab Movimientos */}
              <TabsContent value="movimientos" className="mt-0 space-y-4 outline-none">
                <Card className="rounded-2xl border-border/60 bg-card p-5 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/80">
                        <Activity className="size-4 text-primary" /> Movimientos del cliente
                      </h3>
                      <p className="mt-1 text-[11px] text-muted-foreground">Consulta facturas, órdenes, cotizaciones, pagos, créditos y notas de crédito en un solo lugar.</p>
                    </div>
                    <div className="w-full sm:w-56">
                        <Label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mostrar</Label>
                        <Select value={movementFilter} onValueChange={(value) => { setMovementFilter(value as MovementFilter); setSelectedInvoiceId(null); setSelectedMovement(null); }}>
                          <SelectTrigger className="h-9 rounded-xl text-xs font-bold"><SelectValue placeholder="Todos los movimientos" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">Todos los movimientos</SelectItem>
                            <SelectItem value="Factura">Facturas</SelectItem>
                            <SelectItem value="Orden de venta">Órdenes de venta</SelectItem>
                            <SelectItem value="Cotización">Cotizaciones</SelectItem>
                            <SelectItem value="Nota de crédito">Notas de crédito</SelectItem>
                            <SelectItem value="Crédito">Créditos</SelectItem>
                            <SelectItem value="Pago recibido">Pagos recibidos</SelectItem>
                            <SelectItem value="Factura recurrente">Facturas recurrentes</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  {loadingRelated ? (
                    <div className="mt-4 space-y-2"><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-12 w-full rounded-xl" /></div>
                  ) : visibleMovements.length === 0 ? (
                    <p className="mt-4 rounded-xl border border-dashed border-border/50 p-4 text-xs text-muted-foreground">No hay movimientos para este filtro.</p>
                  ) : (
                    <div className="mt-4 divide-y divide-border/40 rounded-xl border border-border/50">
                      {visibleMovements.slice(0, 100).map((transaction) => (
                        <Fragment key={`${transaction.kind}-${transaction.id}`}>
                          <button type="button" aria-expanded={selectedInvoice?.id === transaction.id || selectedMovement?.id === transaction.id} className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors hover:bg-primary/[0.04] focus-visible:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50" onClick={() => openMovementDetail(transaction)}>
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground"><FileText className="size-4" /></div>
                              <div className="min-w-0"><p className="truncate text-xs font-bold text-foreground">{transaction.kind}</p><p className="truncate font-mono text-[10px] text-muted-foreground">{transaction.number || 'Sin número'}{transaction.description ? ` · ${transaction.description}` : ''}</p></div>
                            </div>
                            <div className="flex shrink-0 items-center gap-3 text-right"><div><p className="text-[10px] font-bold text-muted-foreground">{transaction.date ? format(new Date(transaction.date), 'dd/MM/yyyy') : '—'}</p><p className="text-[10px] font-black text-foreground">{transaction.amount !== undefined ? formatConvertedAmount(transaction.amount, transaction.currency || 'NIO', transaction.exchangeRate) : getTransactionStatus(transaction.status)}</p></div><ChevronRight className={`size-4 text-primary transition-transform ${selectedInvoice?.id === transaction.id || selectedMovement?.id === transaction.id ? 'rotate-90' : ''}`} /></div>
                          </button>
                          {selectedInvoice?.id === transaction.id && transaction.kind === 'Factura' && <InvoiceInlineDetail invoice={selectedInvoice} onClose={() => setSelectedInvoiceId(null)} formatAmount={formatConvertedAmount} tenantName={user?.tenantName || 'Empresa'} tenantLogo={themeConfig?.logo} />}
                          {selectedMovement?.id === transaction.id && <MovementInlineDetail transaction={selectedMovement} onClose={() => setSelectedMovement(null)} formatAmount={formatConvertedAmount} tenantName={user?.tenantName || 'Empresa'} tenantLogo={themeConfig?.logo} />}
                        </Fragment>
                      ))}
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* Tab Historial */}
              <TabsContent value="historial" className="mt-0 space-y-4 outline-none">
                <Card className="p-5 bg-card border-border/60 rounded-2xl space-y-4 shadow-sm">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
                    <History className="size-4 text-primary" /> Cambios del registro del cliente
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/50 bg-muted/10 p-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Agregado por</p>
                      <p className="mt-1 break-words text-sm font-bold text-foreground">{historyLoading ? 'Cargando…' : createdAuditEvent ? auditActor(createdAuditEvent) : 'No disponible'}</p>
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><Clock className="size-3" /> {historyLoading ? 'Consultando auditoría…' : createdAuditEvent ? auditDate(createdAuditEvent) : 'Sin registro de auditoría'}</p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-muted/10 p-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Última modificación por</p>
                      <p className="mt-1 break-words text-sm font-bold text-foreground">{historyLoading ? 'Cargando…' : updatedAuditEvent ? auditActor(updatedAuditEvent) : 'Sin modificaciones registradas'}</p>
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><Clock className="size-3" /> {historyLoading ? 'Consultando auditoría…' : updatedAuditEvent ? auditDate(updatedAuditEvent) : '—'}</p>
                    </div>
                  </div>
                  <div className="space-y-4 pl-2 border-l-2 border-border/40 ml-2 pt-1">
                    {historyLoading ? <div className="space-y-3"><Skeleton className="h-14 w-full rounded-xl" /><Skeleton className="h-14 w-full rounded-xl" /></div> : history.length > 0 ? history.slice(0, 30).map((event: any) => {
                      let details: any = {};
                      try { details = event.details ? JSON.parse(event.details) : {}; } catch { details = {}; }
                      const changes = details.commercial_changes ? Object.entries(details.commercial_changes).map(([field, values]: any) => `${field}: ${values.before ?? '—'} → ${values.after ?? '—'}`).join(' · ') : '';
                      const action = String(event.action || '').toUpperCase();
                      const title = action === 'CREATE' ? 'Cliente registrado' : action === 'UPDATE' ? 'Datos del cliente modificados' : action === 'DELETE' ? 'Cliente eliminado' : 'Cambio del registro';
                      const actorLabel = action === 'CREATE' ? 'Agregado por' : 'Modificado por';
                      return <div key={event.id} className="relative space-y-1 pl-4"><div className="absolute -left-[21px] top-1 size-3 rounded-full border-2 border-background bg-primary" /><p className="text-xs font-bold text-foreground">{title}</p><p className="text-[11px] text-muted-foreground">{changes || details.fields_updated || 'Actualización registrada'}</p><p className="flex items-center gap-1 text-[11px] text-muted-foreground"><User className="size-3" />{actorLabel}: <span className="font-bold text-foreground">{auditActor(event)}</span></p><p className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground"><Clock className="size-3" />{event.createdAt ? format(new Date(event.createdAt), 'PPP p', { locale: es }) : '—'}</p></div>;
                    }) : <>
                    {customer?.createdAt && (
                      <div className="relative pl-4 space-y-1">
                        <div className="absolute -left-[21px] top-1 size-3 rounded-full bg-primary border-2 border-background" />
                        <p className="text-xs font-bold text-foreground">Cliente Registrado</p>
                        <p className="text-[11px] text-muted-foreground"><User className="mr-1 inline size-3" />Agregado por: No disponible</p>
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
                        <p className="text-[11px] text-muted-foreground"><User className="mr-1 inline size-3" />Modificado por: No disponible</p>
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
      <Dialog open={historyExportDialogOpen} onOpenChange={setHistoryExportDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black">
              <FileText className="size-5 text-primary" /> Transacciones a exportar
            </DialogTitle>
            <DialogDescription>
              Selecciona todas las transacciones o filtra por tipo. También puedes elegir la moneda del PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2" role="radiogroup" aria-label="Alcance de transacciones a exportar">
            <button
              type="button"
              role="radio"
              aria-checked={historyExportScope === 'ALL'}
              onClick={() => setHistoryExportScope('ALL')}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${historyExportScope === 'ALL' ? 'border-primary bg-primary/5' : 'border-border/50 hover:bg-muted/40'}`}
            >
              <span className="min-w-0">
                <span className="block text-sm font-bold text-foreground">Todas las transacciones</span>
                <span className="block text-[11px] text-muted-foreground">Incluye todos los registros relacionados con este cliente.</span>
              </span>
              <span className="shrink-0 text-xs font-black text-primary">{relatedTransactions.length}</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={historyExportScope === 'FILTERED'}
              disabled={!historyExportTypeOptions.length}
              onClick={() => {
                if (!historyExportTypeOptions.length) return;
                setHistoryExportScope('FILTERED');
                if (historyExportFilter === 'ALL') setHistoryExportFilter(historyExportTypeOptions[0]);
              }}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${historyExportScope === 'FILTERED' ? 'border-primary bg-primary/5' : 'border-border/50 hover:bg-muted/40'} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <span className="min-w-0">
                <span className="block text-sm font-bold text-foreground">Aplicar filtro de exportación</span>
                <span className="block text-[11px] text-muted-foreground">
                  {historyExportFilter === 'ALL' ? 'Selecciona el tipo de transacción que deseas incluir.' : `Tipo: ${historyExportFilter}.`}
                </span>
              </span>
              <span className="shrink-0 text-xs font-black text-primary">{historyExportScope === 'FILTERED' ? selectedHistoryRows.length : relatedTransactions.length}</span>
            </button>
          </div>
          {historyExportScope === 'FILTERED' && (
            <div className="mt-4 space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo de transacción</Label>
              <Select value={historyExportFilter} onValueChange={setHistoryExportFilter}>
                <SelectTrigger className="h-9 rounded-xl text-xs font-bold">
                  <SelectValue placeholder="Selecciona un tipo" />
                </SelectTrigger>
                <SelectContent>
                  {historyExportTypeOptions.map((kind) => <SelectItem key={kind} value={kind}>{kind}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="mt-4 space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Moneda de descarga</Label>
            <Select value={historyExportCurrency} onValueChange={(value) => setHistoryExportCurrency(value as HistoryExportCurrency)}>
              <SelectTrigger className="h-9 rounded-xl text-xs font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NIO">Córdobas (NIO)</SelectItem>
                <SelectItem value="USD">Dólares (USD)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">Los montos se convertirán a la moneda seleccionada antes de generar el PDF.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setHistoryExportDialogOpen(false)} disabled={exportingHistory}>Cancelar</Button>
            <Button type="button" onClick={confirmHistoryExport} disabled={!selectedHistoryRows.length || exportingHistory} className="gap-2">
              {exportingHistory && <Loader2 className="size-4 animate-spin" />}
              {exportingHistory ? 'Generando…' : `Exportar ${selectedHistoryRows.length} transacciones`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Auxiliares
interface MetricCardProps { label: string; value: string; icon: React.ComponentType<{ className?: string }>; accent?: string; loading?: boolean; }
function MetricCard({ label, value, icon: Icon, accent = 'text-foreground', loading }: MetricCardProps) {
  return (
    <Card className="flex min-w-0 min-h-[92px] flex-col rounded-xl border-border/60 p-3 shadow-xs transition-all hover:border-primary/30">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="min-h-[2rem] min-w-0 text-[10px] font-black uppercase leading-tight tracking-widest text-muted-foreground/70">{label}</p>
        <Icon className={`size-3.5 ${accent}`} />
      </div>
      {loading ? <Skeleton className="mt-auto h-5 w-3/4" /> : <p className={`mt-auto min-w-0 truncate text-sm font-black tabular-nums ${accent}`} title={value}>{value}</p>}
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
  tenantLogo?: string;
}

interface EstimateInlineDetailProps {
  estimate: Estimate;
  onClose: () => void;
  formatAmount: (amount: number, currency?: any, exchangeRate?: number) => string;
  tenantName?: string;
  tenantLogo?: string;
}

function EstimateInlineDetail({ estimate, onClose, formatAmount, tenantName, tenantLogo }: EstimateInlineDetailProps) {
  const handleDownloadPdf = async (format: PdfDownloadFormat) => {
    const previewToastId = toast.loading('Preparando la previsualización de la cotización...');
    try {
      await previewSalesTransactionPDF({
        document: estimate as any,
        tenantName: tenantName || 'Empresa',
        formatAmount: formatAmount as any,
        tenantLogo,
        documentType: 'estimate',
        format,
      });
      toast.success('Previsualización abierta. Descargá el PDF desde el visor del navegador.', { id: previewToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo abrir la previsualización', { id: previewToastId });
    }
  };

  return (
    <Card className="rounded-2xl border-primary/20 bg-primary/[0.03] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-black uppercase tracking-tight">Detalle de cotización</h3>
            <Badge variant="outline" className={`border-none text-[9px] font-black ${getSalesStatusColor(estimate.status)}`}>{getTransactionStatus(estimate.status)}</Badge>
          </div>
          <p className="mt-1 font-mono text-xs font-bold text-muted-foreground">{estimate.number}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <PdfDownloadButton onDownload={handleDownloadPdf} size="sm" className="h-8 px-2 text-[10px]" />
          <Button type="button" variant="ghost" size="icon" title="Cerrar detalle" aria-label="Cerrar detalle" className="size-8 rounded-lg text-muted-foreground" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <InfoField label="Fecha" value={estimate.date ? format(new Date(estimate.date), 'dd/MM/yyyy') : '—'} icon={Calendar} />
        <InfoField label="Válida hasta" value={estimate.expiryDate ? format(new Date(estimate.expiryDate), 'dd/MM/yyyy') : '—'} icon={Clock} />
        <InfoField label="Total" value={formatAmount(Number(estimate.total || 0), estimate.currency, estimate.exchangeRate)} icon={DollarSign} mono />
        <InfoField label="Líneas" value={String(estimate.items?.length || 0)} icon={FileText} />
      </div>

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
            {(estimate.items || []).map((item) => (
              <TableRow key={item.id}>
                <TableCell className="max-w-[16rem] text-xs font-bold">{item.description || 'Producto o servicio'}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{Number(item.quantity || 0)}</TableCell>
                <TableCell className="text-right text-xs text-muted-foreground">{formatAmount(Number(item.unitPrice || 0), estimate.currency, estimate.exchangeRate)}</TableCell>
                <TableCell className="text-right text-xs font-black">{formatAmount(Number(item.total || 0), estimate.currency, estimate.exchangeRate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 flex flex-col items-end gap-1 text-xs">
        <p className="text-muted-foreground">Subtotal: <span className="font-bold text-foreground">{formatAmount(Number(estimate.subtotal || 0), estimate.currency, estimate.exchangeRate)}</span></p>
        <p className="text-muted-foreground">Descuento: <span className="font-bold text-foreground">{formatAmount(Number(estimate.discountAmount || 0), estimate.currency, estimate.exchangeRate)}</span></p>
        <p className="text-muted-foreground">Impuestos: <span className="font-bold text-foreground">{formatAmount(Number(estimate.taxAmount || 0), estimate.currency, estimate.exchangeRate)}</span></p>
         {normalizeSalesExtraCharges(estimate).filter((charge) => charge.amount > 0).map((charge, index) => <p key={charge.id} className="text-muted-foreground">{charge.description || `Coste extra ${index + 1}`}: <span className="font-bold text-foreground">{formatAmount(charge.amount, estimate.currency, estimate.exchangeRate)}</span></p>)}
        {Number((estimate as any).deliveryAmount || 0) > 0 && <p className="text-muted-foreground">{(estimate as any).deliveryDescription || 'Delivery'}: <span className="font-bold text-foreground">{formatAmount(Number((estimate as any).deliveryAmount || 0), estimate.currency, estimate.exchangeRate)}</span></p>}
        <p className="text-sm font-black">Total: <span className="text-primary">{formatAmount(Number(estimate.total || 0), estimate.currency, estimate.exchangeRate)}</span></p>
      </div>
      {estimate.notes && <p className="mt-4 rounded-xl border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground"><span className="font-bold text-foreground">Notas:</span> {estimate.notes}</p>}
    </Card>
  );
}

interface MovementInlineDetailProps {
  transaction: RelatedTransaction;
  onClose: () => void;
  formatAmount: (amount: number, currency?: any, exchangeRate?: number) => string;
  tenantName?: string;
  tenantLogo?: string;
}

function MovementInlineDetail({ transaction, onClose, formatAmount, tenantName, tenantLogo }: MovementInlineDetailProps) {
  const document = transaction.document || {};
  const items = Array.isArray(document.items) ? document.items : [];
  const additionalCharges = normalizeSalesExtraCharges(document).filter((charge) => charge.amount > 0);
  const deliveryAmount = Number(document.deliveryAmount || 0);
  const documentType = transaction.kind === 'Cotización' ? 'estimate' : transaction.kind === 'Orden de venta' ? 'order' : undefined;
  const handleDownloadPdf = async (format: PdfDownloadFormat) => {
    if (!documentType) return;
    const previewToastId = toast.loading(`Preparando la previsualización de ${transaction.kind.toLowerCase()}...`);
    try {
      await previewSalesTransactionPDF({ document, tenantName: tenantName || 'Empresa', formatAmount: formatAmount as any, tenantLogo, documentType, format });
      toast.success('Previsualización abierta. Descargá el PDF desde el visor del navegador.', { id: previewToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo abrir la previsualización', { id: previewToastId });
    }
  };
  return (
    <Card className="rounded-2xl border-primary/20 bg-primary/[0.03] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-4">
        <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-black uppercase tracking-tight">Detalle de {transaction.kind.toLowerCase()}</h3><Badge variant="outline" className={`border-none text-[9px] font-black ${getSalesStatusColor(transaction.status)}`}>{getTransactionStatus(transaction.status)}</Badge></div><p className="mt-1 font-mono text-xs font-bold text-muted-foreground">{transaction.number || 'Sin número'}</p></div>
        <div className="flex shrink-0 items-center gap-1">{documentType && <PdfDownloadButton onDownload={handleDownloadPdf} size="sm" className="h-8 px-2 text-[10px]" />}<Button type="button" variant="ghost" size="icon" title="Cerrar detalle" aria-label="Cerrar detalle" className="size-8 rounded-lg text-muted-foreground" onClick={onClose}><X className="size-4" /></Button></div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <InfoField label="Fecha" value={transaction.date ? format(new Date(transaction.date), 'dd/MM/yyyy') : '—'} icon={Calendar} />
        <InfoField label="Estado" value={getTransactionStatus(transaction.status)} icon={Activity} />
        <InfoField label="Total" value={formatAmount(Number(transaction.amount || document.total || 0), transaction.currency || document.currency, transaction.exchangeRate || document.exchangeRate)} icon={DollarSign} mono />
        <InfoField label="Líneas" value={String(items.length || '—')} icon={FileText} />
      </div>
      {items.length > 0 ? <div className="mt-5 overflow-x-auto rounded-xl border border-border/50 bg-background/40"><Table><TableHeader className="bg-muted/30"><TableRow><TableHead className="text-[10px] font-black uppercase tracking-widest">Concepto</TableHead><TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Cantidad</TableHead><TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Precio</TableHead><TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Total</TableHead></TableRow></TableHeader><TableBody>{items.map((item: any, index: number) => <TableRow key={item.id || `${transaction.id}-${index}`}><TableCell className="max-w-[16rem] text-xs font-bold">{item.description || 'Producto o servicio'}</TableCell><TableCell className="text-right text-xs text-muted-foreground">{Number(item.quantity || 0)}</TableCell><TableCell className="text-right text-xs text-muted-foreground">{formatAmount(Number(item.unitPrice || 0), transaction.currency || document.currency, transaction.exchangeRate || document.exchangeRate)}</TableCell><TableCell className="text-right text-xs font-black">{formatAmount(Number(item.total || 0), transaction.currency || document.currency, transaction.exchangeRate || document.exchangeRate)}</TableCell></TableRow>)}</TableBody></Table></div> : <p className="mt-5 rounded-xl border border-dashed border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">{transaction.description || 'Este movimiento no tiene líneas de detalle disponibles.'}</p>}
      {(additionalCharges.length > 0 || deliveryAmount > 0) && <div className="mt-4 flex flex-col items-end gap-1 text-xs">
        {additionalCharges.map((charge, index) => <p key={charge.id} className="text-muted-foreground">{charge.description || `Coste extra ${index + 1}`}: <span className="font-bold text-foreground">{formatAmount(charge.amount, transaction.currency || document.currency, transaction.exchangeRate || document.exchangeRate)}</span></p>)}
        {deliveryAmount > 0 && <p className="text-muted-foreground">{document.deliveryDescription || 'Delivery'}: <span className="font-bold text-foreground">{formatAmount(deliveryAmount, transaction.currency || document.currency, transaction.exchangeRate || document.exchangeRate)}</span></p>}
        <p className="text-sm font-black">Total: <span className="text-primary">{formatAmount(Number(document.total || transaction.amount || 0), transaction.currency || document.currency, transaction.exchangeRate || document.exchangeRate)}</span></p>
      </div>}
      {document.notes && <p className="mt-4 rounded-xl border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground"><span className="font-bold text-foreground">Notas:</span> {document.notes}</p>}
    </Card>
  );
}

function InvoiceInlineDetail({ invoice, onClose, formatAmount, tenantName, tenantLogo }: InvoiceInlineDetailProps) {
  const statusInfo = getInvoiceStatusInfo(invoice.status);
  const paymentPresentation = getInvoicePaymentPresentation(invoice);
  const handleDownloadPdf = async (format: PdfDownloadFormat) => {
    const previewToastId = toast.loading('Preparando la previsualización de la factura...');
    try {
      await previewSalesTransactionPDF({
        document: invoice as any,
        tenantName: tenantName || 'Empresa',
        formatAmount: formatAmount as any,
        tenantLogo,
        documentType: 'invoice',
        format,
      });
      toast.success('Previsualización abierta. Descargá el PDF desde el visor del navegador.', { id: previewToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo abrir la previsualización', { id: previewToastId });
    }
  };
  return (
    <Card className="rounded-2xl border-primary/20 bg-primary/[0.03] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-black uppercase tracking-tight">Detalle de factura</h3>
            <Badge variant="outline" className={`border-none text-[9px] font-black ${getSalesInvoiceStatusColor(invoice.status)}`}>{statusInfo.label}</Badge>
          </div>
          <p className="mt-1 font-mono text-xs font-bold text-muted-foreground">{invoice.number}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <PdfDownloadButton onDownload={handleDownloadPdf} size="sm" className="h-8 px-2 text-[10px]" />
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
            <Banknote className="size-3" /> Modalidad / forma de cobro: <span className="text-foreground">{paymentPresentation.modalityLabel}{paymentPresentation.methodLabel ? ` · ${paymentPresentation.methodLabel}` : ''}</span>
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
         {normalizeSalesExtraCharges(invoice).filter((charge) => charge.amount > 0).map((charge, index) => <p key={charge.id} className="text-muted-foreground">{charge.description || `Coste extra ${index + 1}`}: <span className="font-bold text-foreground">{formatAmount(charge.amount, invoice.currency, invoice.exchangeRate)}</span></p>)}
        {Number((invoice as any).deliveryAmount || 0) > 0 && <p className="text-muted-foreground">{(invoice as any).deliveryDescription || 'Delivery'}: <span className="font-bold text-foreground">{formatAmount(Number((invoice as any).deliveryAmount || 0), invoice.currency, invoice.exchangeRate)}</span></p>}
        <p className="text-muted-foreground">Pagado: <span className="font-bold text-foreground">{formatAmount(Number(invoice.amountPaid || 0), invoice.currency, invoice.exchangeRate)}</span></p>
        <p className="text-sm font-black">Total: <span className="text-primary">{formatAmount(Number(invoice.total || 0), invoice.currency, invoice.exchangeRate)}</span></p>
      </div>
      {invoice.notes && <p className="mt-4 rounded-xl border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground"><span className="font-bold text-foreground">Notas:</span> {invoice.notes}</p>}
    </Card>
  );
}

export default CustomerDetailDrawer;
