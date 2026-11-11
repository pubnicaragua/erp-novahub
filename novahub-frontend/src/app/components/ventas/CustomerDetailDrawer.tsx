'use client';

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { useInfiniteQuery } from '@tanstack/react-query';
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
  Banknote,
  Download,
  Loader2,
  Database,
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
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { useTheme } from '../../contexts/ThemeContext';
import { publicAccessService, publicLinkUrl } from '../../services/public-access.service';
import { previewSalesTransactionPDF } from '../../utils/pdfGenerator';
import { exportCustomerTransactionsPdf } from '../../utils/customerTransactionsExport';
import { PdfDownloadButton } from '../ui/PdfDownloadButton';
import type { PdfDownloadFormat, PdfPaperFormat } from '../../utils/pdfDownloadFormats';
import { getInvoicePaymentPresentation } from '../../utils/paymentMethods';
import { getSalesAdditionalCharges, normalizeSalesExtraCharges } from '../../utils/salesCharges';
import { normalizeCurrency } from '../../utils/currency';
import { getCustomerDebtAmount, getCustomerFavorAmount } from '../../utils/customerBalance';
import { runWithReportRequestLimit } from '../../utils/report-request-limiter';
import { toast } from '@/app/services/toast';
import type { Customer, Estimate, Invoice } from '../../types';
import { GoogleMap, buildMapQuery } from '../ui/GoogleMap';
import { CustomerLoansPanel } from './CustomerLoansPanel';
import { countryCodeFromLegacy, formatCustomerPhoneForDisplay } from '../../utils/customer-data';
import { getAuditOperationMethodLabel } from '../ui/audit-operation-method';
import { getCurrencyDecimalPlaces } from '../../utils/currency';

interface CustomerDetailDrawerProps {
  customerId: string | null;
  onOpenChange: (open: boolean) => void;
  customerSnapshot?: Customer | null;
  canExport?: boolean;
  extraActions?: ReactNode;
  customerLoansEnabled?: boolean;
  canCreateLoan?: boolean;
  canCreateMora?: boolean;
  canEditMora?: boolean;
  onLoansUpdated?: () => void;
}

type TabKey = 'general' | 'movimientos' | 'resumen-historico' | 'historial' | 'prestamos';
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
      return { label: 'Activo', className: 'bg-primary/10 text-primary border-primary/20' };
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
  canExport = true,
  extraActions,
  customerLoansEnabled = false,
  canCreateLoan = false,
  canCreateMora = false,
  canEditMora = false,
  onLoansUpdated,
}: CustomerDetailDrawerProps) {
  const { baseCurrency, formatConvertedAmount, formatExplicitAmount, convertBetweenCurrencies, exchangeRate } = useCurrency();
  const { user, selectedBranchId } = useAuth();
  const { themeConfig } = useTheme();
  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [detail, setDetail] = useState<Customer | null>(null);
  const [exportRows, setExportRows] = useState<RelatedTransaction[]>([]);
  const [loadingExportRows, setLoadingExportRows] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<RelatedTransaction | null>(null);
  const [movementFilter, setMovementFilter] = useState<MovementFilter>('ALL');
  const [publicLinks, setPublicLinks] = useState<any[]>([]);
  const [publicLinksLoading, setPublicLinksLoading] = useState(false);
  const [publicLinksExpanded, setPublicLinksExpanded] = useState(false);
  const [publicLinksLoaded, setPublicLinksLoaded] = useState(false);
  const [creatingPortalLink, setCreatingPortalLink] = useState(false);
  const [exportingHistory, setExportingHistory] = useState(false);
  const [historyExportDialogOpen, setHistoryExportDialogOpen] = useState(false);
  const [historyExportScope, setHistoryExportScope] = useState<HistoryExportScope>('ALL');
  const [historyExportFilter, setHistoryExportFilter] = useState<string>('ALL');
  const [historyExportCurrency, setHistoryExportCurrency] = useState<HistoryExportCurrency>(baseCurrency);
  const drawerStartedAt = useRef<number | null>(null);
  const profileReadyMeasured = useRef(false);
  const tabStartedAt = useRef<Partial<Record<TabKey, number>>>({});
  const profileSpan = useRef<ReturnType<typeof Sentry.startInactiveSpan> | null>(null);
  const generalSpan = useRef<ReturnType<typeof Sentry.startInactiveSpan> | null>(null);
  const tabSpans = useRef<Partial<Record<TabKey, ReturnType<typeof Sentry.startInactiveSpan>>>>({});

  const measureReady = (name: string, startedAt: number | null | undefined) => {
    if (startedAt == null || typeof performance === 'undefined') return;
    performance.measure(name, { start: startedAt, end: performance.now() });
  };

  const scopeKey = selectedBranchId || 'all-branches';
  const overviewQuery = useTenantQuery(
    ['sales', 'customer-overview', customerId || 'none', scopeKey],
    (signal) => customersService.getOverview(customerId!, signal),
    { enabled: Boolean(customerId), staleTime: 30_000 },
  );
  const movementQuery = useInfiniteQuery({
    queryKey: ['sales', 'customer-movements', user?.clientTenantId || user?.tenantId || 'current', scopeKey, customerId, movementFilter],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => customersService.getMovements(customerId!, { limit: 50, cursor: pageParam || undefined, kind: movementFilter === 'ALL' ? undefined : movementFilter }, signal),
    getNextPageParam: (page) => page.hasMore ? page.nextCursor || undefined : undefined,
    enabled: Boolean(customerId && activeTab === 'movimientos'),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const historyQuery = useInfiniteQuery({
    queryKey: ['sales', 'customer-audit', user?.clientTenantId || user?.tenantId || 'current', scopeKey, customerId],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => auditService.getEntityHistoryPage('CUSTOMER', customerId!, { limit: 50, cursor: pageParam || undefined }, signal),
    getNextPageParam: (page) => page.hasMore ? page.nextCursor || undefined : undefined,
    enabled: Boolean(customerId && activeTab === 'historial'),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const historicalSummaryQuery = useTenantQuery(
    ['sales', 'customer-historical-summaries', customerId || 'none', scopeKey],
    (signal) => customersService.getHistoricalSummaries(customerId!, signal),
    { enabled: Boolean(customerId && ['movimientos', 'resumen-historico'].includes(activeTab)), staleTime: 5 * 60_000 },
  );
  const relatedTransactions: RelatedTransaction[] = movementQuery.data?.pages.flatMap((page) => page.data) || [];
  const history = historyQuery.data?.pages.flatMap((page) => page.data) || [];
  const historicalSummaries = historicalSummaryQuery.data || [];
  const historyLoading = historyQuery.isPending;
  const loading = overviewQuery.isPending;
  const loadingRelated = movementQuery.isPending;
  const selectedDocumentKind = selectedInvoiceId ? 'Factura' : selectedMovement?.kind;
  const selectedDocumentId = selectedInvoiceId || selectedMovement?.id;
  const selectedDocumentQuery = useTenantQuery(
    ['sales', 'customer-movement-document', customerId || 'none', scopeKey, selectedDocumentKind || 'none', selectedDocumentId || 'none'],
    (signal) => {
      const id = selectedDocumentId!;
      switch (selectedDocumentKind) {
        case 'Factura': return invoicesService.getById(id, signal);
        case 'Cotización': return estimatesService.getById(id, signal);
        case 'Orden de venta': return salesOrdersService.getById(id, signal);
        case 'Pago recibido': return paymentsService.getById(id, signal);
        case 'Factura recurrente': return recurringInvoicesService.getById(id, signal);
        case 'Devolución': return salesReturnsService.getById(id, signal);
        case 'Nota de crédito': return salesReturnsService.getById(id, signal);
        case 'Crédito': return creditNotesService.getById(id, signal);
        default: return Promise.reject(new Error('Tipo de movimiento no reconocido.'));
      }
    },
    { enabled: Boolean(customerId && selectedDocumentId && selectedDocumentKind), staleTime: 30_000 },
  );

  useEffect(() => {
    if (customerId && typeof performance !== 'undefined') drawerStartedAt.current = performance.now();
    else drawerStartedAt.current = null;
    profileReadyMeasured.current = false;
    tabStartedAt.current = {};
    profileSpan.current = customerId ? Sentry.startInactiveSpan({ op: 'ui.load', name: 'Customer drawer profile ready' }) : null;
    generalSpan.current = customerId ? Sentry.startInactiveSpan({ op: 'ui.load', name: 'Customer drawer general ready' }) : null;
    setDetail(null);
    setExportRows([]);
    setPublicLinks([]);
    setPublicLinksLoaded(false);
    setPublicLinksExpanded(false);
    setSelectedInvoiceId(null);
    setSelectedMovement(null);
    setMovementFilter('ALL');
    setHistoryExportDialogOpen(false);
    return () => {
      [profileSpan.current, generalSpan.current, ...Object.values(tabSpans.current)].forEach((span) => {
        if (span) { span.setAttribute('outcome', 'cancelled'); span.end(); }
      });
      profileSpan.current = null;
      generalSpan.current = null;
      tabSpans.current = {};
    };
  }, [customerId]);

  useEffect(() => {
    setActiveTab('general');
  }, [customerId]);

  useEffect(() => {
    if (customerId && customerSnapshot && !profileReadyMeasured.current) {
      measureReady('novahub.customer.drawer.profile-ready', drawerStartedAt.current);
      profileReadyMeasured.current = true;
      profileSpan.current?.setAttribute('outcome', 'success');
      profileSpan.current?.end();
      profileSpan.current = null;
    }
  }, [customerId, customerSnapshot]);

  useEffect(() => {
    if (customerId && overviewQuery.isSuccess) {
      measureReady('novahub.customer.drawer.general-ready', drawerStartedAt.current);
      drawerStartedAt.current = null;
      if (profileSpan.current) {
        profileSpan.current.setAttribute('outcome', 'success');
        profileSpan.current.end();
        profileSpan.current = null;
      }
      generalSpan.current?.setAttribute('outcome', 'success');
      generalSpan.current?.end();
      generalSpan.current = null;
    }
  }, [customerId, overviewQuery.isSuccess, overviewQuery.isError, overviewQuery.dataUpdatedAt]);

  useEffect(() => {
    if (overviewQuery.isError) {
      generalSpan.current?.setAttribute('outcome', 'error');
      generalSpan.current?.end();
      generalSpan.current = null;
    }
  }, [overviewQuery.isError]);

  useEffect(() => {
    if (!customerId || activeTab === 'general') return;
    return () => {
      const span = tabSpans.current[activeTab];
      if (span) { span.setAttribute('outcome', 'cancelled'); span.end(); delete tabSpans.current[activeTab]; }
    };
  }, [customerId, activeTab]);

  const activateTab = (value: string) => {
    const nextTab = value as TabKey;
    if (nextTab !== activeTab && nextTab !== 'general' && customerId) {
      const spanNames: Record<Exclude<TabKey, 'general'>, string> = {
        movimientos: 'Customer movements ready',
        'resumen-historico': 'Customer historical summary ready',
        historial: 'Customer audit history ready',
        prestamos: 'Customer loans ready',
      };
      if (typeof performance !== 'undefined') tabStartedAt.current[nextTab] = performance.now();
      tabSpans.current[nextTab] = Sentry.startInactiveSpan({ op: 'ui.load', name: spanNames[nextTab] });
    }
    setActiveTab(nextTab);
  };

  useEffect(() => {
    if (activeTab !== 'movimientos' || !movementQuery.isSuccess) return;
    measureReady('novahub.customer.movements-ready', tabStartedAt.current.movimientos);
    delete tabStartedAt.current.movimientos;
    tabSpans.current.movimientos?.setAttribute('outcome', 'success');
    tabSpans.current.movimientos?.end();
    delete tabSpans.current.movimientos;
  }, [activeTab, movementQuery.isSuccess, movementQuery.dataUpdatedAt]);

  useEffect(() => {
    if (activeTab !== 'historial' || !historyQuery.isSuccess) return;
    measureReady('novahub.customer.audit-ready', tabStartedAt.current.historial);
    delete tabStartedAt.current.historial;
    tabSpans.current.historial?.setAttribute('outcome', 'success');
    tabSpans.current.historial?.end();
    delete tabSpans.current.historial;
  }, [activeTab, historyQuery.isSuccess, historyQuery.dataUpdatedAt]);

  useEffect(() => {
    if (activeTab !== 'resumen-historico' || !historicalSummaryQuery.isSuccess) return;
    measureReady('novahub.customer.historical-summary-ready', tabStartedAt.current['resumen-historico']);
    delete tabStartedAt.current['resumen-historico'];
    tabSpans.current['resumen-historico']?.setAttribute('outcome', 'success');
    tabSpans.current['resumen-historico']?.end();
    delete tabSpans.current['resumen-historico'];
  }, [activeTab, historicalSummaryQuery.isSuccess, historicalSummaryQuery.dataUpdatedAt]);

  const customer = detail ?? overviewQuery.data?.customer ?? customerSnapshot ?? null;
  const showCustomerLoans = customerLoansEnabled;
  const customerCountryCode = String(customer?.countryCode || countryCodeFromLegacy(customer?.country) || 'NI');
  const customerTaxLabel = customerCountryCode === 'NI' ? 'Cédula' : customerCountryCode === 'CL' ? 'RUT' : 'Identificación fiscal';
  const customerRucLabel = customerCountryCode === 'CL' ? 'RUT / identificación' : customerCountryCode === 'PE' ? 'RUC' : 'RUC';
  const isOpen = Boolean(customerId);
  const selectedInvoice = selectedInvoiceId && selectedDocumentQuery.data
    ? selectedDocumentQuery.data as Invoice
    : null;
  const selectedMovementDetail = selectedMovement
    ? { ...selectedMovement, document: selectedDocumentQuery.data }
    : null;

  const openMovementDetail = (transaction: RelatedTransaction) => {
    if (transaction.kind === 'Factura') {
      if (selectedInvoiceId === transaction.id) {
        setSelectedInvoiceId(null);
        return;
      }
      setSelectedInvoiceId(transaction.id);
      setSelectedMovement(null);
      return;
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
  const creditLimitCurrency = normalizeCurrency(customer?.creditLimitCurrency, baseCurrency);
  const customerDebt = getCustomerDebtAmount(customer);
  const customerFavor = getCustomerFavorAmount(customer);
  const customerDebtByCurrency = customer?.balanceDueOriginalCurrencyBreakdown || [];
  const customerFavorByCurrency = customer?.balanceFavorOriginalCurrencyBreakdown || [];
  const creditDays = customer?.creditDays == null ? null : Number(customer.creditDays);

  const toBaseValue = (value: number, currency?: string, exchangeRate?: number) => {
    const amount = Number(value || 0);
    const rate = Number(exchangeRate || 1);
    return String(currency || baseCurrency).toUpperCase() === baseCurrency
      ? amount
      : baseCurrency === 'NIO'
        ? amount * rate
        : amount / Math.max(rate, 0.000001);
  };
  const cashTotal = overviewQuery.data?.totals.cashTotal ?? null;
  const creditOutstanding = overviewQuery.data?.totals.creditOutstanding ?? null;
  const creditLimitBase = toBaseValue(creditLimit, creditLimitCurrency, exchangeRate);
  const creditUsagePct = creditLimitBase > 0 ? Math.min(100, (customerDebt / creditLimitBase) * 100) : 0;
  const visibleMovements = relatedTransactions;
  const historyExportTypeOptions = Array.from(
    new Set(exportRows.map((transaction) => transaction.kind).filter(Boolean)),
  );
  const selectedHistoryRows = historyExportScope === 'FILTERED' && historyExportFilter !== 'ALL'
    ? exportRows.filter((transaction) => transaction.kind === historyExportFilter)
    : exportRows;

  const auditEventsByNewest = [...history].sort((left, right) => {
    const leftTime = left?.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightTime = right?.createdAt ? new Date(right.createdAt).getTime() : 0;
    return rightTime - leftTime;
  });
  const createdAuditEvent = auditEventsByNewest.find((event) => String(event?.action || '').toUpperCase() === 'CREATE')
    || historyQuery.data?.pages[0]?.createdEvent;
  const updatedAuditEvent = auditEventsByNewest.find((event) => ['UPDATE', 'STATUS_CHANGE'].includes(String(event?.action || '').toUpperCase()))
    || historyQuery.data?.pages[0]?.updatedEvent;
  const auditActor = (event: any) => event?.user?.name || event?.user?.email || (event?.userId ? `Usuario ${String(event.userId).slice(0, 8)}` : 'No disponible');
  const auditDate = (event: any) => event?.createdAt ? format(new Date(event.createdAt), 'PPP p', { locale: es }) : 'Fecha no disponible';

  const downloadHistory = async (exportFormat: PdfPaperFormat = 'letter', scope: HistoryExportScope = 'ALL') => {
    if (!customer?.id) return;
    setExportingHistory(true);
    try {
      const rowsToExport = scope === 'FILTERED' && historyExportFilter !== 'ALL'
        ? exportRows.filter((transaction) => transaction.kind === historyExportFilter)
        : exportRows;
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
          ).toFixed(getCurrencyDecimalPlaces())),
          currency: historyExportCurrency,
        })),
        customerName: customer.name || '',
        customerData: customer ? {
          ...customer,
          balanceDue: customerDebt > 0 ? formatConvertedAmount(customerDebt, baseCurrency) : '',
          balanceFavor: customerFavor > 0 ? formatConvertedAmount(customerFavor, baseCurrency) : '',
        } : undefined,
        branchName: customer.branchName,
        tenantName: user?.sessionBranding?.name || user?.tenantName || '',
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

  const openHistoryExportDialog = async () => {
    if (!customerId || loadingExportRows) return;
    setLoadingExportRows(true);
    try {
      const rows: RelatedTransaction[] = [];
      let cursor: string | undefined;
      let hasMore = true;
      while (hasMore) {
        const page = await runWithReportRequestLimit(
          () => customersService.getMovements(customerId, { limit: 200, cursor }),
        );
        rows.push(...page.data);
        cursor = page.nextCursor || undefined;
        hasMore = Boolean(page.hasMore && cursor);
      }
      setExportRows(rows);
      if (!rows.length) {
        toast.info('Este cliente todavía no tiene transacciones para descargar.');
        return;
      }
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo cargar el historial completo del cliente.');
      return;
    } finally {
      setLoadingExportRows(false);
    }
    setHistoryExportScope('ALL');
    setHistoryExportFilter('ALL');
    setHistoryExportCurrency(baseCurrency);
    setHistoryExportDialogOpen(true);
  };

  const confirmHistoryExport = (paperFormat: PdfPaperFormat) => {
    setHistoryExportDialogOpen(false);
    void downloadHistory(paperFormat, historyExportScope);
  };

  const createPortalLink = async () => {
    if (!customer?.id) return;
    setCreatingPortalLink(true);
    try {
      const created = await publicAccessService.createPortalLink({ customerId: customer.id });
      const url = publicLinkUrl(created.path);
      await navigator.clipboard?.writeText(url);
      setPublicLinks(await publicAccessService.list(customer.id));
      setPublicLinksLoaded(true);
      toast.success('Portal generado y enlace copiado');
      setPublicLinks(await publicAccessService.list(customer.id));
    } catch (e: any) { toast.error(e?.message || 'No se pudo generar el portal'); }
    finally { setCreatingPortalLink(false); }
  };

  const loadPublicLinks = async () => {
    if (!customer?.id || publicLinksLoading) return;
    setPublicLinksLoading(true);
    try {
      setPublicLinks(await publicAccessService.list(customer.id));
      setPublicLinksLoaded(true);
    } catch (e: any) {
      toast.error(e?.message || 'No se pudieron cargar los enlaces públicos.');
    } finally {
      setPublicLinksLoading(false);
    }
  };

  const revokePublicLink = async (id: string) => {
    try { await publicAccessService.revoke(id); if (customer?.id) setPublicLinks(await publicAccessService.list(customer.id)); toast.success('Enlace revocado'); }
    catch (e: any) { toast.error(e?.message || 'No se pudo revocar el enlace'); }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="customer-detail-panel erp-detail-panel erp-detail-panel--wide w-full overflow-hidden p-0 flex flex-col gap-0 border-l border-border/50 bg-background"
      >
        <Tabs
          value={activeTab}
          onValueChange={activateTab}
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

            <div className="flex flex-wrap justify-end gap-2" data-tour="customer-detail-actions">
              {extraActions}
              {canExport && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={openHistoryExportDialog}
                  disabled={!customer || loadingExportRows || exportingHistory}
                  className="max-w-full gap-1.5 rounded-xl text-xs font-bold"
                >
                  {loadingExportRows ? <Loader2 className="size-4 shrink-0 animate-spin text-primary" /> : <Download className="size-4 shrink-0 text-primary" />}
                  <span className="truncate">Exportar historial del cliente</span>
                </Button>
              )}
            </div>

            <TabsList className="flex-nowrap w-full justify-start h-9 overflow-x-auto bg-muted/40 p-1 rounded-xl border border-border/40 font-bold text-xs">
              <TabsTrigger value="general" className="shrink-0 rounded-lg text-xs font-bold gap-1.5 px-3 py-1">
                <User className="size-3.5" /> General
              </TabsTrigger>
              <TabsTrigger value="movimientos" className="shrink-0 rounded-lg text-xs font-bold gap-1.5 px-3 py-1">
                <Activity className="size-3.5" /> Movimientos ({movementQuery.data?.pages[0]?.total ?? '…'})
              </TabsTrigger>
              <TabsTrigger value="resumen-historico" className="shrink-0 rounded-lg text-xs font-bold gap-1.5 px-3 py-1">
                <Database className="size-3.5" /> Resumen importado
              </TabsTrigger>
              <TabsTrigger value="historial" className="shrink-0 rounded-lg text-xs font-bold gap-1.5 px-3 py-1">
                <History className="size-3.5" /> Historial
              </TabsTrigger>
              {showCustomerLoans && <TabsTrigger value="prestamos" className="shrink-0 rounded-lg text-xs font-bold gap-1.5 px-3 py-1">
                <Banknote className="size-3.5" /> Préstamos
              </TabsTrigger>}
            </TabsList>
          </SheetHeader>

          <ScrollArea className="customer-detail-scroll min-h-0 flex-1 overflow-hidden">
            <div className="min-w-0 space-y-6 p-6">
              {overviewQuery.isError && (
                <Card className="flex items-center justify-between gap-3 border-destructive/20 bg-destructive/10 p-4 text-destructive">
                  <div className="flex min-w-0 items-center gap-3">
                    <AlertCircle className="size-5 shrink-0" />
                    <p className="text-xs font-bold">No se pudo cargar el resumen completo del cliente. Reintenta para mostrar los totales exactos.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => overviewQuery.refetch()} disabled={overviewQuery.isFetching}>Reintentar</Button>
                </Card>
              )}

              {/* Tab General */}
              <TabsContent value="general" className="mt-0 space-y-6 outline-none">
                <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                <MetricCard label="Saldo pendiente" value={formatConvertedAmount(customerDebt, baseCurrency)} icon={DollarSign} accent="text-rose-600 dark:text-rose-400" loading={loading} />
                  <MetricCard label="Saldo a favor" value={formatConvertedAmount(customerFavor, baseCurrency)} icon={Banknote} accent="text-emerald-600 dark:text-emerald-400" loading={loading} />
                  <MetricCard label={`Límite Crédito (${creditLimitCurrency})`} value={formatConvertedAmount(creditLimit, creditLimitCurrency, exchangeRate)} icon={CreditCard} accent="text-primary" loading={loading} />
                  <MetricCard label="Tipo Cliente" value={typeInfo.label} icon={TypeIcon} accent="text-primary" loading={loading} />
                    <MetricCard label="Estado" value={statusInfo.label} icon={CheckCircle2} accent="text-primary" loading={loading} />
                </div>

                {(customerDebtByCurrency.length > 0 || customerFavorByCurrency.length > 0) && <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                  {customerDebtByCurrency.length > 0 && <section className="min-w-0 rounded-xl border border-rose-500/20 bg-rose-500/[0.03] p-3">
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-rose-700 dark:text-rose-300">Pendiente por moneda</h3>
                    <div className="mt-2 flex flex-wrap gap-2">{customerDebtByCurrency.map((item) => <span key={`due-${item.currency}`} className="rounded-lg border border-rose-500/15 bg-background/70 px-2.5 py-1.5 text-xs font-bold tabular-nums text-foreground">{formatExplicitAmount(Number(item.amount || 0), normalizeCurrency(item.currency, baseCurrency))}</span>)}</div>
                  </section>}
                  {customerFavorByCurrency.length > 0 && <section className="min-w-0 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-3">
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">A favor por moneda</h3>
                    <div className="mt-2 flex flex-wrap gap-2">{customerFavorByCurrency.map((item) => <span key={`favor-${item.currency}`} className="rounded-lg border border-emerald-500/15 bg-background/70 px-2.5 py-1.5 text-xs font-bold tabular-nums text-foreground">{formatExplicitAmount(Number(item.amount || 0), normalizeCurrency(item.currency, baseCurrency))}</span>)}</div>
                  </section>}
                </div>}

                <Card className="p-5 bg-card border-border/60 rounded-2xl space-y-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
                      <CreditCard className="size-4 text-primary" /> Crédito del Cliente
                    </h3>
                    <Badge variant="outline" className="border-none bg-primary/10 text-[9px] font-black text-primary uppercase tracking-widest">
                      Plazo: {creditDays == null ? 'Sin plazo configurado' : creditDays === 0 ? 'Vence el mismo día' : `${creditDays} días`}
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
                      <p className="mt-1 min-h-[1.25rem] text-sm font-black tabular-nums text-foreground">{cashTotal === null ? '—' : formatConvertedAmount(cashTotal, baseCurrency)}</p>
                      <div className="mt-1 min-h-[1.5rem]" aria-hidden="true" />
                    </div>
                    <div className="flex min-w-0 min-h-[100px] flex-col rounded-xl border border-border/50 bg-muted/10 p-2.5">
                      <p className="min-h-[2rem] text-[9px] font-black uppercase leading-tight tracking-widest text-muted-foreground">En crédito (pendiente)</p>
                      <p className={`mt-1 min-h-[1.25rem] text-sm font-black tabular-nums ${Number(creditOutstanding || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{creditOutstanding === null ? '—' : formatConvertedAmount(creditOutstanding, baseCurrency)}</p>
                      <div className="mt-1 min-h-[1.5rem]" aria-hidden="true" />
                    </div>
                    <div className="flex min-w-0 min-h-[100px] flex-col rounded-xl border border-border/50 bg-muted/10 p-2.5">
                      <p className="min-h-[2rem] text-[9px] font-black uppercase leading-tight tracking-widest text-muted-foreground">Límite de crédito ({creditLimitCurrency})</p>
                      <p className="mt-1 min-h-[1.25rem] text-sm font-black tabular-nums text-primary">{formatConvertedAmount(creditLimit, creditLimitCurrency, exchangeRate)}</p>
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
                    <InfoField label="Teléfono" value={customer?.phone ? formatCustomerPhoneForDisplay(customer.phone, customerCountryCode) : 'Sin teléfono'} icon={Phone} mono muted={!customer?.phone} />
                    <InfoField label="Teléfono del contacto" value={customer?.contactPhone ? formatCustomerPhoneForDisplay(customer.contactPhone, customerCountryCode) : 'Sin teléfono de contacto'} icon={Phone} mono muted={!customer?.contactPhone} />
                    <InfoField label="Dirección" value={customer?.address || 'Sin dirección'} icon={MapPin} muted={!customer?.address} />
                    <InfoField label="Ciudad" value={customer?.city || 'Sin ciudad'} icon={MapPin} muted={!customer?.city} />
                    <InfoField label="Departamento" value={customer?.department || 'Sin departamento'} icon={MapPin} muted={!customer?.department} />
                    <InfoField label="País" value={customer?.country ? `${customer.country} (${customerCountryCode})` : 'Sin país'} icon={MapPin} muted={!customer?.country} />
                  </div>
                  <GoogleMap
                    query={buildMapQuery([customer?.address, customer?.city, customer?.department, customer?.country])}
                    label={`Ubicación de ${customer?.name || 'cliente'}`}
                    height={200}
                  />
                </Card>

                <Card className="p-5 bg-card border-border/60 rounded-2xl space-y-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2"><Link2 className="size-4 text-primary" /> Accesos públicos seguros</h3>
                      <p className="mt-1 text-[11px] text-muted-foreground">Genera enlaces temporales para que el cliente consulte documentos o su portal sin tener una cuenta interna.</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" variant="outline" onClick={() => { const next = !publicLinksExpanded; setPublicLinksExpanded(next); if (next && !publicLinksLoaded) void loadPublicLinks(); }} disabled={!customer?.id} className="rounded-xl text-xs font-bold">{publicLinksExpanded ? 'Ocultar enlaces' : 'Ver enlaces'}</Button>
                      <Button size="sm" onClick={createPortalLink} disabled={creatingPortalLink || !customer?.id} className="gap-1.5 rounded-xl text-xs font-bold"><RefreshCcw className={`size-3.5 ${creatingPortalLink ? 'animate-spin' : ''}`} /> Portal</Button>
                    </div>
                  </div>
                  {publicLinksExpanded && (publicLinksLoading ? <Skeleton className="h-12 w-full rounded-xl" /> : !publicLinksLoaded ? null : publicLinks.filter(link => link.isActive).length === 0 ? <p className="rounded-xl border border-dashed border-border/50 p-4 text-xs text-muted-foreground">Todavía no hay enlaces activos para este cliente.</p> : <div className="space-y-2">{publicLinks.filter(link => link.isActive).slice(0, 8).map(link => <div key={link.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/10 p-3"><div className="min-w-0"><p className="text-xs font-bold">{link.accessType === 'PORTAL' ? 'Portal del cliente' : `Documento · ${link.documentType || 'PDF'}`}</p><p className="text-[10px] text-muted-foreground">{link.expiresAt ? `Expira ${format(new Date(link.expiresAt), 'dd/MM/yyyy')}` : 'Sin fecha de expiración'}</p></div><div className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" className="size-8" title="Copiar enlace" onClick={() => toast.info('Para copiar un enlace existente, genéralo nuevamente desde Portal')}><Copy className="size-3.5" /></Button><Button variant="ghost" size="icon" className="size-8 text-primary" title="Revocar enlace" onClick={() => revokePublicLink(link.id)}><ShieldAlert className="size-3.5" /></Button></div></div>)}</div>)}
                </Card>

                <Card className="p-5 bg-card border-border/60 rounded-2xl space-y-4 shadow-sm">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
                    <Building2 className="size-4 text-primary" /> Datos Fiscales y Financieros
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {String(customer?.type || '').toUpperCase() === 'COMPANY' && <InfoField label="Nombre de empresa" value={customer?.companyName || 'No registrado'} icon={Building2} muted={!customer?.companyName} />}
                    <InfoField label={customerRucLabel} value={customer?.ruc || '—'} icon={Hash} mono muted={!customer?.ruc} />
                    <InfoField label={customerTaxLabel} value={customer?.taxId || 'No registrado'} icon={Hash} mono muted={!customer?.taxId} />
                    <InfoField label="Régimen Fiscal" value={customer?.fiscalRegime || 'No registrado'} icon={ShieldAlert} muted={!customer?.fiscalRegime} />
                    <InfoField label="Lista de Precios" value={customer?.priceList?.name || 'Sin lista asignada'} icon={Tag} muted={!customer?.priceList} />
                    <InfoField label={`Límite de Crédito Concedido (${creditLimitCurrency})`} value={formatConvertedAmount(creditLimit, creditLimitCurrency, exchangeRate)} icon={DollarSign} mono />
                    <InfoField label="Plazo de Crédito" value={creditDays == null ? 'Sin plazo configurado' : creditDays === 0 ? 'Vence el mismo día (0 días)' : `${creditDays} días`} icon={Clock} mono />
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
              <TabsContent value="movimientos" className="mt-0 min-w-0 space-y-4 outline-none">
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
                  {historicalSummaryQuery.isPending ? <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2"><Skeleton className="h-20 rounded-xl" /><Skeleton className="h-20 rounded-xl" /></div> : historicalSummaryQuery.isError ? (
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive"><span>No se pudo cargar el historial importado.</span><Button type="button" variant="outline" size="sm" onClick={() => historicalSummaryQuery.refetch()}>Reintentar</Button></div>
                  ) : historicalSummaries.length > 0 ? (
                    <section aria-labelledby="customer-imported-history-movements-title" className="mt-4 min-w-0 space-y-3 rounded-xl border border-primary/15 bg-primary/[0.025] p-3 sm:p-4">
                      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h4 id="customer-imported-history-movements-title" className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground/80">
                            <Database className="size-4 shrink-0 text-primary" /> Historial importado
                          </h4>
                          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">Antecedentes acumulados de la importación inicial. El resumen permanece visible con cualquier filtro.</p>
                        </div>
                        <Badge variant="outline" className="w-fit shrink-0 text-[9px]">Informativo</Badge>
                      </div>
                      <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {historicalSummaries.map((summary) => (
                          <article key={`movement-history-${summary.id}`} className="flex min-w-0 flex-col justify-between gap-3 rounded-lg border border-border/40 bg-background/70 p-3">
                            <div className="min-w-0">
                              <p className="break-words text-xs font-black text-foreground">{summary.activityType}</p>
                              <p className="mt-1 break-words text-[10px] leading-relaxed text-muted-foreground">
                                {summary.recordCountLabel || 'Registros'}: {Number(summary.recordCount || 0).toLocaleString('es-NI')}
                                {summary.measureValue !== null && summary.measureValue !== undefined ? ` · ${summary.measureLabel || 'Medida'}: ${Number(summary.measureValue).toLocaleString('es-NI')}${summary.measureUnit ? ` ${summary.measureUnit}` : ''}` : ''}
                              </p>
                            </div>
                            <div className="flex min-w-0 items-end justify-between gap-2 border-t border-border/40 pt-2">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Total acumulado · {summary.currency}</span>
                              <span className="shrink-0 text-sm font-black tabular-nums text-primary">{formatExplicitAmount(Number(summary.amount || 0), normalizeCurrency(summary.currency, baseCurrency))}</span>
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}
                  {movementQuery.isError ? (
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive">
                      <span>No se pudieron cargar los movimientos.</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => movementQuery.refetch()}>Reintentar</Button>
                    </div>
                  ) : loadingRelated ? (
                    <div className="mt-4 space-y-2"><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-12 w-full rounded-xl" /></div>
                  ) : visibleMovements.length === 0 ? (
                    <p className="mt-4 rounded-xl border border-dashed border-border/50 p-4 text-xs text-muted-foreground">No hay movimientos operativos para este filtro.</p>
                  ) : (
                    <div className="mt-4 min-w-0 divide-y divide-border/40 rounded-xl border border-border/50">
                      {visibleMovements.slice(0, 100).map((transaction) => (
                        <Fragment key={`${transaction.kind}-${transaction.id}`}>
                          <button type="button" aria-expanded={selectedInvoiceId === transaction.id || selectedMovement?.id === transaction.id} className="flex w-full min-w-0 items-start justify-between gap-3 p-3 text-left transition-colors hover:bg-primary/[0.04] focus-visible:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50" onClick={() => openMovementDetail(transaction)}>
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground"><FileText className="size-4" /></div>
                              <div className="min-w-0 flex-1"><p className="break-words text-xs font-bold text-foreground">{transaction.kind}</p><p className="whitespace-normal break-words font-mono text-[10px] leading-relaxed text-muted-foreground">{transaction.number || 'Sin número'}{transaction.description ? ` · ${transaction.description}` : ''}</p></div>
                            </div>
                            <div className="flex shrink-0 items-start gap-2 pl-2 text-right"><div className="whitespace-nowrap"><p className="text-[10px] font-bold text-muted-foreground">{transaction.date ? format(new Date(transaction.date), 'dd/MM/yyyy') : '—'}</p><p className="text-[10px] font-black text-foreground">{transaction.amount !== undefined ? formatConvertedAmount(transaction.amount, transaction.currency || 'NIO', transaction.exchangeRate) : getTransactionStatus(transaction.status)}</p></div><ChevronRight className={`mt-0.5 size-4 text-primary transition-transform ${selectedInvoiceId === transaction.id || selectedMovement?.id === transaction.id ? 'rotate-90' : ''}`} /></div>
                          </button>
                          {selectedInvoiceId === transaction.id && (selectedDocumentQuery.isFetching ? <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando factura…</div> : selectedDocumentQuery.isError ? <div className="flex items-center justify-between gap-3 p-4 text-xs text-destructive"><span>No se pudo cargar la factura.</span><Button type="button" variant="outline" size="sm" onClick={() => selectedDocumentQuery.refetch()}>Reintentar</Button></div> : selectedInvoice ? <InvoiceInlineDetail invoice={selectedInvoice} onClose={() => setSelectedInvoiceId(null)} formatAmount={formatConvertedAmount} tenantName={user?.tenantName || 'Empresa'} tenantLogo={themeConfig?.logo} /> : null)}
                          {selectedMovement?.id === transaction.id && (selectedDocumentQuery.isFetching ? <div className="flex items-center gap-2 p-4 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando documento…</div> : selectedDocumentQuery.isError ? <div className="flex items-center justify-between gap-3 p-4 text-xs text-destructive"><span>No se pudo cargar el documento.</span><Button type="button" variant="outline" size="sm" onClick={() => selectedDocumentQuery.refetch()}>Reintentar</Button></div> : <MovementInlineDetail transaction={selectedMovementDetail!} onClose={() => setSelectedMovement(null)} formatAmount={formatConvertedAmount} tenantName={user?.tenantName || 'Empresa'} tenantLogo={themeConfig?.logo} />)}
                        </Fragment>
                      ))}
                    </div>
                  )}
                  {movementQuery.hasNextPage && (
                    <div className="mt-4 flex justify-center">
                      <Button type="button" variant="outline" onClick={() => movementQuery.fetchNextPage()} disabled={movementQuery.isFetchingNextPage} className="gap-2 rounded-xl">
                        {movementQuery.isFetchingNextPage && <Loader2 className="size-4 animate-spin" />} Cargar más movimientos
                      </Button>
                    </div>
                  )}
                </Card>
              </TabsContent>

              {/* Resumen legado informativo, separado de los movimientos y de la auditoría */}
              <TabsContent value="resumen-historico" className="mt-0 min-w-0 space-y-4 outline-none">
                <Card className="space-y-4 rounded-2xl border-border/60 bg-card p-5 shadow-sm">
                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/80">
                      <Database className="size-4 text-primary" /> Resumen histórico importado
                    </h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Antecedentes acumulados que llegaron con el alta inicial del cliente. Son informativos y no representan movimientos ni saldos de NovaHub.</p>
                  </div>
                  {historicalSummaryQuery.isPending ? <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-28 rounded-xl" /></div> : historicalSummaryQuery.isError ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive"><span>No se pudo cargar el resumen histórico.</span><Button type="button" variant="outline" size="sm" onClick={() => historicalSummaryQuery.refetch()}>Reintentar</Button></div>
                  ) : historicalSummaries.length ? (
                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {historicalSummaries.map((summary) => (
                        <article key={summary.id} className="min-w-0 space-y-3 rounded-xl border border-primary/15 bg-primary/[0.025] p-4">
                          <div className="flex min-w-0 items-start justify-between gap-2">
                            <h4 className="min-w-0 break-words text-sm font-black text-foreground">{summary.activityType}</h4>
                            <Badge variant="outline" className="shrink-0 text-[9px]">Histórico</Badge>
                          </div>
                          <div className={`grid gap-2 ${summary.measureValue === null || summary.measureValue === undefined ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                            <div className="min-w-0 rounded-lg border border-border/40 bg-background/70 p-2.5">
                              <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{summary.recordCountLabel || 'Registros'}</p>
                              <p className="mt-1 break-words text-base font-black tabular-nums text-foreground">{Number(summary.recordCount || 0).toLocaleString('es-NI')}</p>
                            </div>
                            {summary.measureValue !== null && summary.measureValue !== undefined && <div className="min-w-0 rounded-lg border border-border/40 bg-background/70 p-2.5">
                              <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{summary.measureLabel || 'Medida'}</p>
                              <p className="mt-1 break-words text-sm font-bold tabular-nums text-foreground">{`${Number(summary.measureValue).toLocaleString('es-NI')}${summary.measureUnit ? ` ${summary.measureUnit}` : ''}`}</p>
                            </div>}
                          </div>
                          <div className="rounded-lg border border-primary/15 bg-background/70 p-3">
                            <p className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Total acumulado · {summary.currency}</p>
                            <p className="mt-1 break-words text-lg font-black tabular-nums text-primary">{formatExplicitAmount(Number(summary.amount || 0), normalizeCurrency(summary.currency, baseCurrency))}</p>
                          </div>
                          <div className="space-y-1 border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
                            {summary.sourceFileName && <p className="break-words">Origen: {summary.sourceFileName}</p>}
                            {summary.importedAt && <p>Importado: {format(new Date(summary.importedAt), 'PPP', { locale: es })}</p>}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : <p className="rounded-xl border border-dashed border-border/50 p-4 text-xs text-muted-foreground">Este cliente no tiene resúmenes históricos importados.</p>}
                </Card>
              </TabsContent>

              {showCustomerLoans && customer && <TabsContent value="prestamos" className="mt-0 min-w-0 space-y-4 outline-none">
                <CustomerLoansPanel
                  customerId={customer.id}
                  customerName={customer.name}
                  moraTypeId={customer.moraTypeId}
                  moraType={customer.moraType}
                  enabled={customerLoansEnabled && activeTab === 'prestamos'}
                  canCreateLoan={canCreateLoan}
                  canCreateMora={canCreateMora}
                  canEditMora={canEditMora}
                  onUpdated={onLoansUpdated}
                  onReady={() => {
                    measureReady('novahub.customer.loans-ready', tabStartedAt.current.prestamos);
                    delete tabStartedAt.current.prestamos;
                    tabSpans.current.prestamos?.setAttribute('outcome', 'success');
                    tabSpans.current.prestamos?.end();
                    delete tabSpans.current.prestamos;
                  }}
                  onMoraTypeUpdated={(nextMoraType) => setDetail((current) => ({
                    ...(current?.id === customer.id ? current : customer),
                    moraTypeId: nextMoraType?.id ?? null,
                    moraType: nextMoraType,
                  }))}
                />
              </TabsContent>}

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
                      <p className="mt-1 text-[10px] font-semibold text-muted-foreground">Vía: {createdAuditEvent ? getAuditOperationMethodLabel(createdAuditEvent) : 'Método no registrado'}</p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-muted/10 p-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Última modificación por</p>
                      <p className="mt-1 break-words text-sm font-bold text-foreground">{historyLoading ? 'Cargando…' : updatedAuditEvent ? auditActor(updatedAuditEvent) : 'Sin modificaciones registradas'}</p>
                      <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground"><Clock className="size-3" /> {historyLoading ? 'Consultando auditoría…' : updatedAuditEvent ? auditDate(updatedAuditEvent) : '—'}</p>
                      {updatedAuditEvent && <p className="mt-1 text-[10px] font-semibold text-muted-foreground">Vía: {getAuditOperationMethodLabel(updatedAuditEvent)}</p>}
                    </div>
                  </div>
                  <div className="space-y-4 pl-2 border-l-2 border-border/40 ml-2 pt-1">
                    {historyQuery.isError ? <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs text-destructive"><span>No se pudo cargar la auditoría.</span><Button type="button" variant="outline" size="sm" onClick={() => historyQuery.refetch()}>Reintentar</Button></div> : historyLoading ? <div className="space-y-3"><Skeleton className="h-14 w-full rounded-xl" /><Skeleton className="h-14 w-full rounded-xl" /></div> : history.length > 0 ? history.map((event: any) => {
                      let details: any = {};
                      try { details = event.details ? JSON.parse(event.details) : {}; } catch { details = {}; }
                      const changes = details.commercial_changes ? Object.entries(details.commercial_changes).map(([field, values]: any) => `${field}: ${values.before ?? '—'} → ${values.after ?? '—'}`).join(' · ') : '';
                      const action = String(event.action || '').toUpperCase();
                      const title = action === 'CREATE' ? 'Cliente registrado' : action === 'UPDATE' ? 'Datos del cliente modificados' : action === 'DELETE' ? 'Cliente eliminado' : 'Cambio del registro';
                      const actorLabel = action === 'CREATE' ? 'Agregado por' : 'Modificado por';
                      return <div key={event.id} className="relative space-y-1 pl-4"><div className="absolute -left-[21px] top-1 size-3 rounded-full border-2 border-background bg-primary" /><p className="text-xs font-bold text-foreground">{title}</p><p className="text-[11px] text-muted-foreground">{changes || details.fields_updated || 'Actualización registrada'}</p><p className="flex items-center gap-1 text-[11px] text-muted-foreground"><User className="size-3" />{actorLabel}: <span className="font-bold text-foreground">{auditActor(event)}</span></p><p className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground"><Clock className="size-3" />{event.createdAt ? format(new Date(event.createdAt), 'PPP p', { locale: es }) : '—'}</p><p className="text-[10px] font-semibold text-muted-foreground">Vía: {getAuditOperationMethodLabel(event)}</p></div>;
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
                  {historyQuery.hasNextPage && <div className="flex justify-center"><Button type="button" variant="outline" onClick={() => historyQuery.fetchNextPage()} disabled={historyQuery.isFetchingNextPage} className="gap-2 rounded-xl">{historyQuery.isFetchingNextPage && <Loader2 className="size-4 animate-spin" />} Cargar más historial</Button></div>}
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
              <span className="shrink-0 text-xs font-black text-primary">{exportRows.length}</span>
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
              <span className="shrink-0 text-xs font-black text-primary">{historyExportScope === 'FILTERED' ? selectedHistoryRows.length : exportRows.length}</span>
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
            <PdfDownloadButton
              label={exportingHistory ? 'Generando…' : `Exportar ${selectedHistoryRows.length} transacciones`}
              onDownload={(paperFormat) => confirmHistoryExport(paperFormat)}
              disabled={!selectedHistoryRows.length || exportingHistory}
            />
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
    <Card className="min-w-0 rounded-2xl border-primary/20 bg-primary/[0.03] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-black uppercase tracking-tight">Detalle de cotización</h3>
            <Badge variant="outline" className={`border-none text-[9px] font-black ${getSalesStatusColor(estimate.status)}`}>{getTransactionStatus(estimate.status)}</Badge>
          </div>
          <p className="mt-1 font-mono text-xs font-bold text-muted-foreground">{estimate.number}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <PdfDownloadButton onDownload={handleDownloadPdf} includePageSizes includeRoll size="sm" className="h-8 px-2 text-[10px]" />
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

      <div className="mt-5 min-w-0 overflow-x-auto rounded-xl border border-border/50 bg-background/40">
        <Table className="w-full table-fixed">
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="w-[52%] text-[10px] font-black uppercase tracking-widest">Concepto</TableHead>
              <TableHead className="w-[16%] text-right text-[10px] font-black uppercase tracking-widest">Cantidad</TableHead>
              <TableHead className="w-[16%] text-right text-[10px] font-black uppercase tracking-widest">Precio</TableHead>
              <TableHead className="w-[16%] text-right text-[10px] font-black uppercase tracking-widest">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(estimate.items || []).map((item) => (
              <TableRow key={item.id}>
                <TableCell className="w-[52%] max-w-none whitespace-normal break-words align-top text-xs font-bold leading-relaxed">
                  <span className="block break-words">{item.description || 'Producto o servicio'}</span>
                  {item.productCode && <span className="mt-1 block font-mono text-[10px] font-semibold text-primary">Código: {item.productCode}</span>}
                  {item.variantSku && <span className="mt-1 block font-mono text-[10px] font-normal text-muted-foreground">SKU variante: {item.variantSku}</span>}
                </TableCell>
                <TableCell className="w-[16%] whitespace-normal break-words text-right align-top text-xs text-muted-foreground">{Number(item.quantity || 0)}</TableCell>
                <TableCell className="w-[16%] whitespace-normal break-words text-right align-top text-xs text-muted-foreground">{formatAmount(Number(item.unitPrice || 0), estimate.currency, estimate.exchangeRate)}</TableCell>
                <TableCell className="w-[16%] whitespace-normal break-words text-right align-top text-xs font-black">{formatAmount(Number(item.total || 0), estimate.currency, estimate.exchangeRate)}</TableCell>
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
  const additionalCharges = getSalesAdditionalCharges(document);
  const deliveryAmount = Array.isArray(document.selectedCharges) ? 0 : Number(document.deliveryAmount || 0);
  const documentType = transaction.kind === 'Cotización'
    ? 'estimate'
    : transaction.kind === 'Orden de venta'
      ? 'order'
      : transaction.kind === 'Nota de crédito'
        ? 'credit-note'
        : transaction.kind === 'Crédito'
          ? 'credit'
          : transaction.kind === 'Pago recibido'
            ? 'payment'
            : transaction.kind === 'Factura recurrente'
              ? 'recurring'
              : undefined;
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
    <Card className="min-w-0 rounded-2xl border-primary/20 bg-primary/[0.03] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-4">
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-sm font-black uppercase tracking-tight">Detalle de {transaction.kind.toLowerCase()}</h3><Badge variant="outline" className={`border-none text-[9px] font-black ${getSalesStatusColor(transaction.status)}`}>{getTransactionStatus(transaction.status)}</Badge></div><p className="mt-1 break-words font-mono text-xs font-bold text-muted-foreground">{transaction.number || 'Sin número'}</p></div>
        <div className="flex shrink-0 items-center gap-1">{documentType && <PdfDownloadButton onDownload={handleDownloadPdf} includePageSizes includeRoll size="sm" className="h-8 px-2 text-[10px]" />}<Button type="button" variant="ghost" size="icon" title="Cerrar detalle" aria-label="Cerrar detalle" className="size-8 rounded-lg text-muted-foreground" onClick={onClose}><X className="size-4" /></Button></div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <InfoField label="Fecha" value={transaction.date ? format(new Date(transaction.date), 'dd/MM/yyyy') : '—'} icon={Calendar} />
        <InfoField label="Estado" value={getTransactionStatus(transaction.status)} icon={Activity} />
        <InfoField label="Total" value={formatAmount(Number(transaction.amount || document.total || 0), transaction.currency || document.currency, transaction.exchangeRate || document.exchangeRate)} icon={DollarSign} mono />
        <InfoField label="Líneas" value={String(items.length || '—')} icon={FileText} />
      </div>
      {items.length > 0 ? <div className="mt-5 overflow-x-auto rounded-xl border border-border/50 bg-background/40"><Table><TableHeader className="bg-muted/30"><TableRow><TableHead className="text-[10px] font-black uppercase tracking-widest">Concepto</TableHead><TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Cantidad</TableHead><TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Precio</TableHead><TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Total</TableHead></TableRow></TableHeader><TableBody>{items.map((item: any, index: number) => <TableRow key={item.id || `${transaction.id}-${index}`}><TableCell className="max-w-[16rem] text-xs font-bold"><span className="block">{item.description || 'Producto o servicio'}</span>{item.productCode && <span className="mt-1 block font-mono text-[10px] font-semibold text-primary">Código: {item.productCode}</span>}{item.variantSku && <span className="mt-1 block font-mono text-[10px] font-normal text-muted-foreground">SKU variante: {item.variantSku}</span>}</TableCell><TableCell className="text-right text-xs text-muted-foreground">{Number(item.quantity || 0)}</TableCell><TableCell className="text-right text-xs text-muted-foreground">{formatAmount(Number(item.unitPrice || 0), transaction.currency || document.currency, transaction.exchangeRate || document.exchangeRate)}</TableCell><TableCell className="text-right text-xs font-black">{formatAmount(Number(item.total || 0), transaction.currency || document.currency, transaction.exchangeRate || document.exchangeRate)}</TableCell></TableRow>)}</TableBody></Table></div> : <p className="mt-5 rounded-xl border border-dashed border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">{transaction.description || 'Este movimiento no tiene líneas de detalle disponibles.'}</p>}
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
          <PdfDownloadButton onDownload={handleDownloadPdf} includePageSizes includeRoll size="sm" className="h-8 px-2 text-[10px]" />
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

      <div className="mt-5 min-w-0 overflow-x-auto rounded-xl border border-border/50 bg-background/40">
        <Table className="w-full table-fixed">
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
                <TableCell className="max-w-[16rem] text-xs font-bold">
                  <span className="block">{item.description || 'Producto o servicio'}</span>
                  {item.productCode && <span className="mt-1 block font-mono text-[10px] font-semibold text-primary">Código: {item.productCode}</span>}
                  {item.variantSku && <span className="mt-1 block font-mono text-[10px] font-normal text-muted-foreground">SKU variante: {item.variantSku}</span>}
                </TableCell>
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
