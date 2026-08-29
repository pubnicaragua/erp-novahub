import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useManagerShellNavigation } from '../ManagerShell';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { enterpriseGroupsService, type ManagerCustomerDetailResponse, type ManagerQuoteDetailResponse, type ManagerSalesCashSessionDetailResponse, type ManagerSalesDeliveryDetailResponse, type ManagerSalesDocumentDetailResponse, type ManagerSalesModuleResponse, type ManagerSalesPriceListDetailResponse } from '../../services/enterprise-groups.service';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Activity, ArrowUpRight, Building2, Calendar, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, Download, FileCog, FileSpreadsheet, FileText, History, LayoutGrid, List, Loader2, Mail, MapPin, Phone, Receipt, RefreshCw, Search, ShoppingCart, TrendingUp, Truck, UserRound, Users } from 'lucide-react';
import { cn } from '../ui/utils';
import { useCardsOnlyBelowTableBreakpoint } from '../ui/ViewLayoutSelect';
import { MANAGER_SALES_VIEWS, type ManagerSalesView } from './manager-sales.types';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../ui/sheet';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Skeleton } from '../ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { generateSalesTransactionPDF } from '../../utils/pdfGenerator';
import type { PdfDownloadFormat } from '../../utils/pdfDownloadFormats';
import { exportManagerQuotesExcel, exportManagerQuotesPdf } from '../../utils/managerQuotesExport';
import { exportManagerSalesExcel, exportManagerSalesPdf } from '../../utils/managerSalesExport';
import { exportCustomerTransactionsPdf } from '../../utils/customerTransactionsExport';
import { formatCurrencyAmount, formatCurrencyDescriptor, getCurrencyMetadata } from '../../utils/currency';
import { normalizeSalesExtraCharges } from '../../utils/salesCharges';
import { SalesDocumentDetailSheet, type SalesDocumentPanelData } from '../ventas/SalesDocumentDetailSheet';
import { publicAccessService, publicLinkUrl } from '../../services/public-access.service';
import { ColumnFilterMenu, type ColumnSort, type ColumnSortType } from '../ui/ColumnFilterMenu';
import { toast } from 'sonner';
import { ManagerSalesCashSheet, ManagerSalesDeliverySheet, ManagerSalesPriceListSheet } from './ManagerSalesOperationalSheets';
import { ManagerInvoiceSeriesSettings } from './ManagerInvoiceSeriesSettings';
import { PdfDownloadButton } from '../ui/PdfDownloadButton';
import { useDetailOpeningFeedback } from '../../hooks/useDetailOpeningFeedback';

type BranchOption = { id: string; name: string; businessUnitId?: string | null };
type LayoutMode = 'table' | 'cards';

const numberFormat = new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 });
const formatNumber = (value: unknown) => numberFormat.format(Number(value || 0));
const formatMoney = (value: unknown, currency?: string | null, includeCode = false) => formatCurrencyAmount(value, currency || 'NIO', includeCode);
const additionalChargesLabel = (document: any, includeZero = false) => {
  const charges = normalizeSalesExtraCharges(document)
    .filter((charge) => includeZero || charge.amount > 0)
    .map((charge, index) => `${charge.description || `Coste extra ${index + 1}`}: ${formatMoney(charge.amount, document.currency, true)}`);
  const deliveryAmount = Number(document?.deliveryAmount || 0);
  if (deliveryAmount > 0) charges.push(`${document?.deliveryDescription || 'Delivery'}: ${formatMoney(deliveryAmount, document.currency, true)}`);
  return charges.join(' · ') || '—';
};
const formatDate = (value: unknown, includeTime = false) => {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-NI', includeTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' });
};

const viewLabels: Record<ManagerSalesView, string> = Object.fromEntries(MANAGER_SALES_VIEWS.map((item) => [item.id, item.label])) as Record<ManagerSalesView, string>;

const statusOptions: Partial<Record<ManagerSalesView, Array<{ value: string; label: string }>>> = {
  quotes: [{ value: 'DRAFT', label: 'Borrador' }, { value: 'IN_PROCESS', label: 'En proceso' }, { value: 'APPROVED', label: 'Aprobada' }, { value: 'CANCELLED', label: 'Cancelada' }],
  orders: [{ value: 'DRAFT', label: 'Borrador' }, { value: 'IN_PROCESS', label: 'En proceso' }, { value: 'APPROVED', label: 'Aprobada' }, { value: 'CANCELLED', label: 'Cancelada' }],
  invoices: [{ value: 'PENDING', label: 'Pendiente' }, { value: 'PARTIAL', label: 'Parcial' }, { value: 'PAID', label: 'Pagada' }, { value: 'CREDIT', label: 'A crédito' }, { value: 'OVERDUE', label: 'Vencida' }, { value: 'CANCELLED', label: 'Cancelada' }],
  recurring: [{ value: 'ACTIVE', label: 'Activa' }, { value: 'PAUSED', label: 'Pausada' }, { value: 'EXPIRED', label: 'Vencida' }, { value: 'CANCELLED', label: 'Cancelada' }],
  payments: [{ value: 'CASH', label: 'Efectivo' }, { value: 'TRANSFER', label: 'Transferencia' }, { value: 'CHECK', label: 'Cheque' }, { value: 'CARD', label: 'Tarjeta' }],
  creditnotes: [{ value: 'ISSUED', label: 'Emitida' }, { value: 'PARTIAL', label: 'Parcial' }, { value: 'APPLIED', label: 'Aplicada' }, { value: 'PAID', label: 'Pagada' }, { value: 'VOIDED', label: 'Anulada' }],
  deliveries: [{ value: 'PENDING', label: 'Pendiente' }, { value: 'DELIVERED', label: 'Entregada' }],
  cash: [{ value: 'OPEN', label: 'Abierta' }, { value: 'COUNTING', label: 'En conteo' }, { value: 'CLOSED', label: 'Cerrada' }],
  pricelists: [{ value: 'ACTIVE', label: 'Activa' }, { value: 'INACTIVE', label: 'Inactiva' }],
};

const statusLabel = (value: unknown) => {
  const normalized = String(value || '').toUpperCase();
  const labels: Record<string, string> = {
    DRAFT: 'Borrador', IN_PROCESS: 'En proceso', SENT: 'Enviada', APPROVED: 'Aprobada', CANCELLED: 'Cancelada',
    CONFIRMED: 'Aprobada', PENDING_REVIEW: 'Pendiente de revisión', IN_PROGRESS: 'En proceso', SHIPPED: 'Enviada', DELIVERED: 'Entregada', PROCESSED: 'Procesada',
    PENDING: 'Pendiente', PARTIAL: 'Parcial', PAID: 'Pagada', CREDIT: 'A crédito', OVERDUE: 'Vencida',
    ACTIVE: 'Activa', PAUSED: 'Pausada', EXPIRED: 'Vencida',
    CASH: 'Efectivo', TRANSFER: 'Transferencia', BANK_TRANSFER: 'Transferencia bancaria', CHECK: 'Cheque', CARD: 'Tarjeta', CREDIT_CARD: 'Tarjeta de crédito', DEBIT_CARD: 'Tarjeta de débito',
    ISSUED: 'Emitida', APPLIED: 'Aplicada', VOIDED: 'Anulada', REJECTED: 'Rechazada',
    OPEN: 'Abierta', COUNTING: 'En conteo', CLOSING: 'En conteo', CLOSED: 'Cerrada',
    DAILY: 'Diaria', WEEKLY: 'Semanal', BIWEEKLY: 'Quincenal', MONTHLY: 'Mensual', QUARTERLY: 'Trimestral', YEARLY: 'Anual', ANNUAL: 'Anual', CUSTOM: 'Personalizada',
  };
  return labels[normalized] || String(value || '—').replaceAll('_', ' ');
};

const statusBadgeClass = (value: unknown) => {
  const normalized = String(value || '').toUpperCase();
  if (['APPROVED', 'PAID', 'ACTIVE', 'DELIVERED', 'PROCESSED', 'APPLIED'].includes(normalized)) return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (['SENT', 'CONFIRMED', 'PARTIAL', 'IN_PROGRESS', 'IN_PROCESS', 'PENDING', 'ISSUED', 'OPEN'].includes(normalized)) return 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300';
  if (['REJECTED', 'CANCELLED', 'VOIDED', 'OVERDUE', 'CLOSED'].includes(normalized)) return 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300';
  return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300';
};

const statusBadge = (value: unknown) => <Badge variant="outline" className={cn('font-black', statusBadgeClass(value))}>{statusLabel(value)}</Badge>;

export function ManagerSalesModule({ view, onViewChange, groupId, businessUnitId, branchId, branches, reportCurrency, onEnterBranch, canEnterBranch = false }: { view: ManagerSalesView; onViewChange: (view: ManagerSalesView) => void; groupId: string; businessUnitId?: string; branchId?: string; branches: BranchOption[]; reportCurrency: string; onEnterBranch?: (groupId: string, branchId: string) => Promise<void>; canEnterBranch?: boolean }) {
  const { sidebarCollapsed } = useManagerShellNavigation();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [customerType, setCustomerType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [registerId, setRegisterId] = useState('');
  const [deliveryBranchId, setDeliveryBranchId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [priceListMode, setPriceListMode] = useState<'lists' | 'prices'>('lists');
  const [columnSorts, setColumnSorts] = useState<Record<string, ColumnSort>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('table');
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<any | null>(null);
  const [quoteDetail, setQuoteDetail] = useState<ManagerQuoteDetailResponse | null>(null);
  const [selectedSalesDocument, setSelectedSalesDocument] = useState<{ entity: string; row: any } | null>(null);
  const [salesDocumentDetail, setSalesDocumentDetail] = useState<ManagerSalesDocumentDetailResponse | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<any | null>(null);
  const [deliveryDetail, setDeliveryDetail] = useState<ManagerSalesDeliveryDetailResponse | null>(null);
  const [deliveryDetailLoading, setDeliveryDetailLoading] = useState(false);
  const [selectedCashSession, setSelectedCashSession] = useState<any | null>(null);
  const [cashSessionDetail, setCashSessionDetail] = useState<ManagerSalesCashSessionDetailResponse | null>(null);
  const [cashSessionDetailLoading, setCashSessionDetailLoading] = useState(false);
  const [selectedPriceList, setSelectedPriceList] = useState<any | null>(null);
  const [priceListDetail, setPriceListDetail] = useState<ManagerSalesPriceListDetailResponse | null>(null);
  const [priceListDetailLoading, setPriceListDetailLoading] = useState(false);
  const [exportingCustomerHistory, setExportingCustomerHistory] = useState(false);
  const isCompactTableViewport = useCardsOnlyBelowTableBreakpoint();
  const effectiveLayoutMode: LayoutMode = isCompactTableViewport ? 'cards' : layoutMode;
  const [exporting, setExporting] = useState(false);
  const { user } = useAuth();
  const { themeConfig } = useTheme();
  const isInvoiceSeriesView = view === 'invoice-series';
  const query = useTenantQuery<ManagerSalesModuleResponse>(
    ['manager-sales', groupId, view, businessUnitId || 'all', branchId || 'all', debouncedSearch, status, customerType, dateFrom, dateTo, registerId, deliveryBranchId, paymentStatus, priceListMode, reportCurrency || 'group-default', page, pageSize],
    (signal) => enterpriseGroupsService.getSalesModule(groupId, { view, businessUnitId, branchId, search: debouncedSearch || undefined, status: status || undefined, customerType: customerType || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, registerId: registerId || undefined, deliveryBranchId: deliveryBranchId || undefined, paymentStatus: paymentStatus || undefined, priceListMode: view === 'pricelists' ? priceListMode : undefined, reportCurrency: reportCurrency || undefined, page, pageSize }, signal),
    { enabled: Boolean(groupId) && !isInvoiceSeriesView },
  );
  const response = query.data;
  const rows = response?.data || [];
  const metrics = response?.metrics || {};
  const multipleBranches = !branchId && branches.length > 1;
  const activeReportCurrency = reportCurrency || metrics.consolidationCurrency || 'NIO';
  const displayColumns = useMemo(() => tableColumns(view, multipleBranches, activeReportCurrency, priceListMode), [view, multipleBranches, activeReportCurrency, priceListMode]);
  const displayRows = useMemo(() => sortRows(rows, displayColumns, columnSorts, view), [rows, displayColumns, columnSorts, view]);
  const activeStatusOptions = statusOptions[view] || [];
  const selectedQuoteBranchId = String(quoteDetail?.quote?.branchId || selectedQuote?.branchId || '');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const changeView = (next: ManagerSalesView) => {
    setPage(1);
    setSearch('');
    setStatus('');
    setCustomerType('');
    setDateFrom('');
    setDateTo('');
    setRegisterId('');
    setDeliveryBranchId('');
    setPaymentStatus('');
    setPriceListMode('lists');
    setSelectedCustomer(null);
    setSelectedQuote(null);
    setQuoteDetail(null);
    setSelectedSalesDocument(null);
    setSalesDocumentDetail(null);
    setSelectedDelivery(null);
    setDeliveryDetail(null);
    setSelectedCashSession(null);
    setCashSessionDetail(null);
    setSelectedPriceList(null);
    setPriceListDetail(null);
    onViewChange(next);
  };

  const changeColumnSort = (sortKey: string, nextSort: ColumnSort) => {
    setColumnSorts((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${view}:`))) as Record<string, ColumnSort>;
      if (nextSort) next[`${view}:${sortKey}`] = nextSort;
      return next;
    });
  };

  const openQuoteDetail = (row: any) => {
    setSelectedQuote(row);
    setQuoteDetail(null);
    void enterpriseGroupsService.getSalesQuoteDetail(groupId, row.id, row.reportCurrency || reportCurrency || metrics.consolidationCurrency)
      .then((detail) => setQuoteDetail(detail))
      .catch(() => setQuoteDetail(null))
  };

  const openSalesDocumentDetail = (row: any) => {
    if (!['orders', 'invoices', 'recurring', 'payments', 'creditnotes', 'credits'].includes(view)) return;
    setSelectedSalesDocument({ entity: view, row });
    setSalesDocumentDetail(null);
    void enterpriseGroupsService.getSalesDocumentDetail(groupId, view, row.id, reportCurrency || metrics.consolidationCurrency || 'NIO')
      .then((detail) => setSalesDocumentDetail(detail))
      .catch(() => setSalesDocumentDetail(null));
  };

  const openDeliveryDetail = (row: any) => {
    setSelectedDelivery(row);
    setDeliveryDetail(null);
    setDeliveryDetailLoading(true);
    void enterpriseGroupsService.getSalesDeliveryDetail(groupId, row.id, reportCurrency || metrics.consolidationCurrency || 'NIO')
      .then((detail) => setDeliveryDetail(detail))
      .catch(() => setDeliveryDetail(null))
      .finally(() => setDeliveryDetailLoading(false));
  };

  const openCashSessionDetail = (row: any) => {
    setSelectedCashSession(row);
    setCashSessionDetail(null);
    setCashSessionDetailLoading(true);
    void enterpriseGroupsService.getSalesCashSessionDetail(groupId, row.id, reportCurrency || metrics.consolidationCurrency || 'NIO')
      .then((detail) => setCashSessionDetail(detail))
      .catch(() => setCashSessionDetail(null))
      .finally(() => setCashSessionDetailLoading(false));
  };

  const openPriceListDetail = (row: any) => {
    const priceListId = row.priceListId || row.id;
    if (!priceListId) return;
    setSelectedPriceList(row);
    setPriceListDetail(null);
    setPriceListDetailLoading(true);
    void enterpriseGroupsService.getSalesPriceListDetail(groupId, priceListId, reportCurrency || metrics.consolidationCurrency || 'NIO')
      .then((detail) => setPriceListDetail(detail))
      .catch(() => setPriceListDetail(null))
      .finally(() => setPriceListDetailLoading(false));
  };

  const openOperationalDetail = (row: any) => {
    if (view === 'deliveries') return openDeliveryDetail(row);
    if (view === 'cash') return openCashSessionDetail(row);
    if (view === 'pricelists') return openPriceListDetail(row);
    if (view === 'customers') return setSelectedCustomer(row);
    if (view === 'quotes') return openQuoteDetail(row);
    if (['orders', 'invoices', 'recurring', 'payments', 'creditnotes', 'credits'].includes(view)) return openSalesDocumentDetail(row);
  };

  const quoteReportParams = {
    view: 'quotes' as const,
    businessUnitId,
    branchId,
    search: search || undefined,
    status: status || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    reportCurrency: reportCurrency || undefined,
    page: 1,
    pageSize: 5000,
    report: true,
  };

  const quoteFilterSummary = [
    search ? `búsqueda: ${search}` : '',
    status ? `estado: ${statusLabel(status)}` : '',
    customerType ? `tipo de cliente: ${customerTypeLabel(customerType)}` : '',
    dateFrom ? `desde: ${formatDate(dateFrom)}` : '',
    dateTo ? `hasta: ${formatDate(dateTo)}` : '',
    registerId ? `caja: ${String(metrics.registers?.find((register: any) => register.id === registerId)?.name || 'seleccionada')}` : '',
    deliveryBranchId ? `entrega en: ${branches.find((branch) => branch.id === deliveryBranchId)?.name || 'seleccionada'}` : '',
    paymentStatus ? `cobro: ${statusLabel(paymentStatus)}` : '',
    view === 'pricelists' ? `modo: ${priceListMode === 'prices' ? 'precios por producto' : 'listas'}` : '',
    reportCurrency ? `moneda: ${formatCurrencyDescriptor(reportCurrency)}` : '',
    branchId ? `sucursal: ${branches.find((branch) => branch.id === branchId)?.name || 'seleccionada'}` : '',
  ].filter(Boolean).join(' · ');

  const exportReport = async () => {
    setExporting(true);
    try {
      if (view === 'quotes') {
        const report = await enterpriseGroupsService.getSalesModule(groupId, quoteReportParams);
        await exportManagerQuotesExcel({
          rows: report.data,
          tenantName: themeConfig?.tenantName || user?.tenantName || 'Empresa',
          primaryColor: themeConfig?.colors?.primary,
          filterSummary: quoteFilterSummary,
          dateFrom,
          dateTo,
          metrics: report.metrics,
        });
        return;
      }
      const report = await enterpriseGroupsService.getSalesModule(groupId, { view, businessUnitId, branchId, search: search || undefined, status: status || undefined, customerType: customerType || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, registerId: registerId || undefined, deliveryBranchId: deliveryBranchId || undefined, paymentStatus: paymentStatus || undefined, priceListMode: view === 'pricelists' ? priceListMode : undefined, reportCurrency: reportCurrency || undefined, page: 1, pageSize: 5000, report: true });
      const data = (report.data || []).map((row: any) => exportRow(view, row, reportCurrency || report.metrics?.amountCurrency || 'NIO'));
      const options = { rows: data, tenantName: themeConfig?.tenantName || user?.tenantName || 'Empresa', tenantLogo: themeConfig?.logo, primaryColor: themeConfig?.colors?.primary, title: viewLabels[view], fileBase: `reporte_ventas_${viewLabels[view]}`, reportCurrency: reportCurrency || report.metrics?.amountCurrency || 'NIO', filterSummary: quoteFilterSummary, dateFrom, dateTo, metrics: report.metrics, extraSheets: view === 'cash' ? [{ name: 'Resumen por caja', rows: (report.metrics?.registerSummary || []).map((row: any) => cashSummaryExportRow(row, reportCurrency || report.metrics?.amountCurrency || 'NIO')) }] : undefined };
      await exportManagerSalesExcel(options);
    } finally {
      setExporting(false);
    }
  };

  const exportQuotesPdf = async () => {
    setExporting(true);
    try {
      const report = await enterpriseGroupsService.getSalesModule(groupId, quoteReportParams);
      await exportManagerQuotesPdf({
        rows: report.data,
        tenantName: themeConfig?.tenantName || user?.tenantName || 'Empresa',
        tenantLogo: themeConfig?.logo,
        primaryColor: themeConfig?.colors?.primary,
        filterSummary: quoteFilterSummary,
        metrics: report.metrics,
      });
    } finally {
      setExporting(false);
    }
  };

  const downloadQuotePdf = async (format: PdfDownloadFormat) => {
    const quote = quoteDetail?.quote || selectedQuote;
    if (!quote) return;
    await generateSalesTransactionPDF({
      document: quote,
      tenantName: themeConfig?.tenantName || user?.tenantName || 'Empresa',
      tenantLogo: themeConfig?.logo,
      formatAmount: (amount, currency) => formatMoney(amount, currency),
      documentType: 'estimate',
      format,
      designOverride: quote.pdfDesign || undefined,
    });
  };

  const downloadSalesDocumentPdf = async (format: PdfDownloadFormat) => {
    const selected = salesDocumentDetail?.document || selectedSalesDocument?.row;
    const entity = selectedSalesDocument?.entity;
    if (!selected || !entity) return;
    const documentType = entity === 'orders' ? 'order' : entity === 'recurring' ? 'recurring' : entity === 'payments' ? 'payment' : entity === 'creditnotes' ? 'credit-note' : 'invoice';
    await generateSalesTransactionPDF({
      document: selected,
      tenantName: themeConfig?.tenantName || user?.tenantName || 'Empresa',
      tenantLogo: themeConfig?.logo,
      formatAmount: (amount, currency) => formatMoney(amount, currency),
      documentType,
      format,
      designOverride: selected.pdfDesign || undefined,
    });
  };

  const openSalesDocumentWhatsApp = async () => {
    const selected = salesDocumentDetail?.document || selectedSalesDocument?.row;
    if (!selected) return;
    const phone = String(selected.customerPhone || selected.customer?.phone || selected.customCustomerPhone || '').replace(/\D/g, '');
    if (!phone) {
      toast.error('El cliente no tiene un teléfono registrado para WhatsApp.');
      return;
    }
    const title = selected.title || viewLabels[selectedSalesDocument?.entity as ManagerSalesView] || 'documento';
    const amount = formatMoney(selected.total ?? selected.amount, selected.currency, true);
    let message = `Hola ${selected.customerName || selected.customer?.name || 'cliente'}, te compartimos el ${title.toLowerCase()} ${selected.number || ''}${amount ? ` por ${amount}` : ''}.`;
    const preparingToastId = toast.loading('Preparando el enlace para WhatsApp...');
    try {
      const publicType = ({ orders: 'sales-order', invoices: 'invoice', recurring: 'recurring-invoice', payments: 'payment-received', creditnotes: 'credit-note', credits: 'invoice' } as Record<string, string>)[selectedSalesDocument?.entity || ''];
      if (selected.customerId && selected.id && publicType) {
        const [documentLink, portalLink] = await Promise.all([
          publicAccessService.createDocumentLink({ customerId: selected.customerId, documentType: publicType, documentId: selected.id, allowPrint: true, allowDownload: true, allowRelated: true }),
          publicAccessService.createPortalLink({ customerId: selected.customerId }),
        ]);
        message += `\n\nPodés consultar el documento de forma segura aquí:\n${publicLinkUrl(documentLink.path)}\n\nPortal del cliente (historial y saldo):\n${publicLinkUrl(portalLink.path)}`;
      } else {
        message += '\n\nPodés consultar el detalle desde este mensaje.';
      }
    } catch {
      message += '\n\nPodés consultar el detalle desde este mensaje.';
    }
    const phoneWithCode = phone.length === 8 ? `505${phone}` : (phone.startsWith('505') ? phone : `505${phone}`);
    window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    toast.success('WhatsApp quedó preparado con el documento', { id: preparingToastId });
  };

  const downloadCustomerHistory = async () => {
    if (!selectedCustomer?.id) return;
    setExportingCustomerHistory(true);
    try {
      const response = await enterpriseGroupsService.getSalesCustomerTransactions(groupId, selectedCustomer.id);
      const customer = response.customer || selectedCustomer;
      const rows = response.transactions || [];
      if (!rows.length) {
        toast.info('Este cliente todavía no tiene transacciones para descargar.');
        return;
      }
      const options = {
        rows,
        customerName: customer.name || selectedCustomer.name || 'Cliente',
        branchName: customer.branchName || selectedCustomer.branchName,
        tenantName: themeConfig?.tenantName || user?.tenantName || 'Empresa',
        tenantLogo: themeConfig?.logo,
        primaryColor: themeConfig?.colors?.primary,
        pdfDesign: customer.pdfDesign,
      };
      await exportCustomerTransactionsPdf(options);
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo descargar el historial del cliente.');
    } finally {
      setExportingCustomerHistory(false);
    }
  };

  return <div className="sales-module min-w-0 space-y-5 overflow-x-hidden p-4 sm:p-6 md:p-8">
    <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">{isInvoiceSeriesView ? <FileCog className="size-6" /> : <ShoppingCart className="size-6" />}</div>
        <div className="min-w-0"><h1 className="truncate text-3xl font-black uppercase italic tracking-tighter sm:text-4xl">{isInvoiceSeriesView ? 'Facturación y reportes' : 'Ventas'}</h1><Badge variant="outline" className="mt-3 border-primary/20 bg-primary/10 text-[10px] font-black uppercase tracking-widest text-primary">{branches.length} sucursal(es) en el alcance</Badge></div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {!isInvoiceSeriesView && <Button variant="outline" className="rounded-xl" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className={cn('mr-2 size-4', query.isFetching && 'animate-spin')} />Actualizar</Button>}
        {!isInvoiceSeriesView && (view === 'quotes' ? <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="rounded-xl" disabled={exporting}>{exporting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}Exportar</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5">
            <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onClick={() => void exportReport()}><FileSpreadsheet className="size-4 text-primary" /> Excel (.xlsx)</DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onClick={() => void exportQuotesPdf()}><FileText className="size-4 text-primary" /> PDF (.pdf)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu> : <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="outline" className="rounded-xl" disabled={exporting}>{exporting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}Exportar</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5">
            <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onClick={() => void exportReport()}><FileSpreadsheet className="size-4 text-primary" /> Excel (.xlsx)</DropdownMenuItem>
            <DropdownMenuItem className="gap-2 rounded-xl py-2.5" onClick={async () => {
              setExporting(true);
              try {
      const report = await enterpriseGroupsService.getSalesModule(groupId, { view, businessUnitId, branchId, search: search || undefined, status: status || undefined, customerType: customerType || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, registerId: registerId || undefined, deliveryBranchId: deliveryBranchId || undefined, paymentStatus: paymentStatus || undefined, priceListMode: view === 'pricelists' ? priceListMode : undefined, reportCurrency: reportCurrency || undefined, page: 1, pageSize: 5000, report: true });
                const data = (report.data || []).map((row: any) => exportRow(view, row, reportCurrency || report.metrics?.amountCurrency || 'NIO'));
                await exportManagerSalesPdf({ rows: data, tenantName: themeConfig?.tenantName || user?.tenantName || 'Empresa', tenantLogo: themeConfig?.logo, primaryColor: themeConfig?.colors?.primary, title: viewLabels[view], fileBase: `reporte_ventas_${viewLabels[view]}`, reportCurrency: reportCurrency || report.metrics?.amountCurrency || 'NIO', filterSummary: quoteFilterSummary, dateFrom, dateTo, metrics: report.metrics });
              } finally { setExporting(false); }
            }}><FileText className="size-4 text-primary" /> PDF (.pdf)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>)}
      </div>
    </div>

    {sidebarCollapsed && <div className="sales-subnav flex min-w-0 gap-2 overflow-x-auto rounded-2xl border border-border/60 bg-muted/30 p-1.5">{MANAGER_SALES_VIEWS.map((item) => <button key={item.id} type="button" onClick={() => changeView(item.id)} className={cn('flex-none rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wide text-muted-foreground transition-colors hover:bg-card hover:text-foreground', view === item.id && 'bg-primary text-primary-foreground shadow-sm')}><span className="sm:hidden">{item.label.slice(0, 3)}</span><span className="hidden sm:inline">{item.label}</span></button>)}</div>}

    {view === 'invoice-series' ? <ManagerInvoiceSeriesSettings groupId={groupId} businessUnitId={businessUnitId} branchId={branchId} /> : view === 'overview' ? <SalesOverview metrics={metrics} reportCurrency={activeReportCurrency} /> : <>
      <SalesFilters view={view} search={search} setSearch={(value) => { setSearch(value); setPage(1); }} status={status} setStatus={(value) => { setStatus(value); setPage(1); }} customerType={customerType} setCustomerType={(value) => { setCustomerType(value); setPage(1); }} dateFrom={dateFrom} setDateFrom={(value) => { setDateFrom(value); setPage(1); }} dateTo={dateTo} setDateTo={(value) => { setDateTo(value); setPage(1); }} statusOptions={activeStatusOptions} layoutMode={effectiveLayoutMode} setLayoutMode={setLayoutMode} registerId={registerId} setRegisterId={(value) => { setRegisterId(value); setPage(1); }} registerOptions={metrics.registers || []} deliveryBranchId={deliveryBranchId} setDeliveryBranchId={(value) => { setDeliveryBranchId(value); setPage(1); }} branches={branches} paymentStatus={paymentStatus} setPaymentStatus={(value) => { setPaymentStatus(value); setPage(1); }} priceListMode={priceListMode} setPriceListMode={(value) => { setPriceListMode(value); setPage(1); }} />
      <SalesKpis view={view} metrics={metrics} reportCurrency={activeReportCurrency} status={status} onStatusChange={(value) => { setStatus(value); setPage(1); }} />
      {view === 'cash' && <CashRegisterSummary rows={metrics.registerSummary || []} reportCurrency={activeReportCurrency} />}
      {query.isLoading ? <LoadingState /> : query.error ? <EmptyState title="No se pudo cargar la vista" description="Verifica el permiso Manager de Ventas y vuelve a actualizar." /> : effectiveLayoutMode === 'cards' ? <SalesCards view={view} rows={displayRows} showBranch={multipleBranches} reportCurrency={activeReportCurrency} onDetail={openOperationalDetail} priceListMode={priceListMode} /> : <SalesTable view={view} rows={displayRows} showBranch={multipleBranches} reportCurrency={activeReportCurrency} sortState={columnSorts} onSort={changeColumnSort} onDetail={openOperationalDetail} priceListMode={priceListMode} />}
      <Pagination page={response?.meta.page || page} totalPages={response?.meta.totalPages || 1} total={response?.meta.total || 0} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} />
      <ManagerCustomerDetailSheet groupId={groupId} customer={selectedCustomer} reportCurrency={activeReportCurrency} onOpenChange={(open) => { if (!open) setSelectedCustomer(null); }} onEnterBranch={onEnterBranch} canEnterBranch={canEnterBranch} onExportHistory={() => { void downloadCustomerHistory(); }} exportingHistory={exportingCustomerHistory} />
      <SalesDocumentDetailSheet
        key={selectedQuote?.id || 'manager-quote-detail'}
        document={selectedQuote ? buildManagerQuotePanel(quoteDetail?.quote || selectedQuote, quoteDetail?.history) : null}
        entity="ESTIMATE"
        open={Boolean(selectedQuote)}
        onClose={() => { setSelectedQuote(null); setQuoteDetail(null); }}
        onDownloadPdf={(format) => { void downloadQuotePdf(format); }}
        onGoToBranch={onEnterBranch && canEnterBranch && selectedQuoteBranchId ? () => { void onEnterBranch(groupId, selectedQuoteBranchId); } : undefined}
      />
      <SalesDocumentDetailSheet
        key={selectedSalesDocument ? `${selectedSalesDocument.entity}-${selectedSalesDocument.row.id}` : 'manager-sales-document-detail'}
        document={selectedSalesDocument ? buildManagerSalesDocumentPanel(salesDocumentDetail?.document || selectedSalesDocument.row, selectedSalesDocument.entity, salesDocumentDetail?.history) : null}
        entity={managerSalesAuditEntity(selectedSalesDocument?.entity)}
        open={Boolean(selectedSalesDocument)}
        onClose={() => { setSelectedSalesDocument(null); setSalesDocumentDetail(null); }}
        onDownloadPdf={(format) => { void downloadSalesDocumentPdf(format); }}
        onGoToBranch={onEnterBranch && canEnterBranch && String(salesDocumentDetail?.document?.branchId || selectedSalesDocument?.row?.branchId || '') ? () => { void onEnterBranch(groupId, String(salesDocumentDetail?.document?.branchId || selectedSalesDocument?.row?.branchId)); } : undefined}
        onWhatsApp={openSalesDocumentWhatsApp}
        hasWhatsApp={Boolean(salesDocumentDetail?.document?.customerPhone || selectedSalesDocument?.row?.customerPhone || selectedSalesDocument?.row?.customer?.phone || selectedSalesDocument?.row?.customCustomerPhone)}
      />
      <ManagerSalesDeliverySheet open={Boolean(selectedDelivery)} onOpenChange={(open) => { if (!open) { setSelectedDelivery(null); setDeliveryDetail(null); } }} loading={deliveryDetailLoading} delivery={deliveryDetail?.delivery || selectedDelivery} history={deliveryDetail?.history} reportCurrency={activeReportCurrency} onDownload={deliveryDetail?.delivery ? () => { void exportManagerSalesPdf({ rows: [exportRow('deliveries', deliveryDetail.delivery, activeReportCurrency)], tenantName: themeConfig?.tenantName || user?.tenantName || 'Empresa', tenantLogo: themeConfig?.logo, primaryColor: themeConfig?.colors?.primary, title: 'Detalle de entrega', fileBase: `detalle_entrega_${deliveryDetail.delivery.number || 'sin_numero'}`, reportCurrency: activeReportCurrency, metrics, pdfDesign: deliveryDetail.delivery.pdfDesign }); } : undefined} onGoToBranch={onEnterBranch && canEnterBranch ? (targetBranchId) => { void onEnterBranch(groupId, targetBranchId); } : undefined} onWhatsApp={deliveryDetail?.delivery?.customerPhone ? () => { const phone = String(deliveryDetail.delivery.customerPhone).replace(/\D/g, ''); const phoneWithCode = phone.length === 8 ? `505${phone}` : (phone.startsWith('505') ? phone : `505${phone}`); window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(`Hola ${deliveryDetail.delivery.customerName || 'cliente'}, te compartimos la información de tu entrega ${deliveryDetail.delivery.number || ''}.`)}`, '_blank', 'noopener,noreferrer'); } : undefined} />
      <ManagerSalesCashSheet open={Boolean(selectedCashSession)} onOpenChange={(open) => { if (!open) { setSelectedCashSession(null); setCashSessionDetail(null); } }} loading={cashSessionDetailLoading} session={cashSessionDetail?.session || selectedCashSession} invoices={cashSessionDetail?.invoices} log={cashSessionDetail?.log} reportCurrency={activeReportCurrency} onDownload={cashSessionDetail?.session ? () => { void exportManagerSalesPdf({ rows: [exportRow('cash', cashSessionDetail.session, activeReportCurrency)], tenantName: themeConfig?.tenantName || user?.tenantName || 'Empresa', tenantLogo: themeConfig?.logo, primaryColor: themeConfig?.colors?.primary, title: 'Detalle de sesión de caja', fileBase: `detalle_sesion_caja_${cashSessionDetail.session.register?.code || 'sin_caja'}`, reportCurrency: activeReportCurrency, metrics, pdfDesign: cashSessionDetail.session.pdfDesign }); } : undefined} onGoToBranch={onEnterBranch && canEnterBranch ? (targetBranchId) => { void onEnterBranch(groupId, targetBranchId); } : undefined} />
      <ManagerSalesPriceListSheet open={Boolean(selectedPriceList)} onOpenChange={(open) => { if (!open) { setSelectedPriceList(null); setPriceListDetail(null); } }} loading={priceListDetailLoading} priceList={priceListDetail?.priceList || selectedPriceList} items={priceListDetail?.items} reportCurrency={activeReportCurrency} onDownload={priceListDetail?.priceList ? () => { void exportManagerSalesPdf({ rows: (priceListDetail.items || []).map((item: any) => exportRow('pricelists', { ...item, priceListId: priceListDetail.priceList.id, branchName: priceListDetail.priceList.branchName }, activeReportCurrency)), tenantName: themeConfig?.tenantName || user?.tenantName || 'Empresa', tenantLogo: themeConfig?.logo, primaryColor: themeConfig?.colors?.primary, title: `Lista ${priceListDetail.priceList.name}`, fileBase: `lista_de_precios_${priceListDetail.priceList.code || priceListDetail.priceList.name || 'sin_codigo'}`, reportCurrency: activeReportCurrency, filterSummary: quoteFilterSummary, metrics, pdfDesign: priceListDetail.priceList.pdfDesign }); } : undefined} onGoToBranch={onEnterBranch && canEnterBranch ? (targetBranchId) => { void onEnterBranch(groupId, targetBranchId); } : undefined} />
    </>}
  </div>;
}

function SalesOverview({ metrics, reportCurrency }: { metrics: Record<string, any>; reportCurrency: string }) {
  const cards = [
    ['Clientes', metrics.customers, UserRound, 'text-primary bg-primary/10'],
    ['Cotizaciones', metrics.quotes, FileText, 'text-primary bg-primary/10'],
    ['Órdenes de venta', metrics.orders, ShoppingCart, 'text-primary bg-primary/10'],
    ['Facturas', metrics.invoices, Receipt, 'text-primary bg-primary/10'],
    ['Pagos recibidos', metrics.payments, CreditCard, 'text-primary bg-primary/10'],
    ['Entregas', metrics.deliveries, Truck, 'text-primary bg-primary/10'],
    ['Saldo de clientes', formatMoney(metrics.customerBalance, 'NIO', true), TrendingUp, 'text-primary bg-primary/10'],
    ['Facturado por caja', formatMoney(metrics.billed, reportCurrency, true), Receipt, 'text-primary bg-primary/10'],
  ] as const;
  return <div className="space-y-5"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value, Icon, tone]) => <Card key={label} className="rounded-2xl border-border/60 shadow-sm"><CardContent className="flex items-center gap-4 p-5"><div className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', tone)}><Icon className="size-5" /></div><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-1 truncate text-2xl font-black tracking-tight">{typeof value === 'number' ? formatNumber(value) : value || '0'}</p></div></CardContent></Card>)}</div><p className="text-[10px] font-bold text-muted-foreground">Los importes de caja se muestran en {formatCurrencyDescriptor(reportCurrency)}; el saldo del cliente conserva la moneda funcional de su sucursal.</p><Card className="rounded-3xl border-primary/20 bg-primary/5"><CardHeader><CardTitle className="text-lg font-black uppercase italic tracking-tight">Lectura del alcance</CardTitle></CardHeader><CardContent className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3"><div><p className="text-muted-foreground">Sucursal con más clientes</p><p className="mt-1 font-black">{metrics.topBranchName || 'Sin datos'}{metrics.topBranchCount ? ` · ${formatNumber(metrics.topBranchCount)}` : ''}</p></div><div><p className="text-muted-foreground">Créditos pendientes</p><p className="mt-1 font-black">{formatNumber(metrics.credits || 0)}</p></div><div><p className="text-muted-foreground">Sesiones de caja</p><p className="mt-1 font-black">{formatNumber(metrics.cashSessions || 0)}</p></div></CardContent></Card></div>;
}

function SalesFilters({ view, search, setSearch, status, setStatus, customerType, setCustomerType, dateFrom, setDateFrom, dateTo, setDateTo, statusOptions, layoutMode, setLayoutMode, registerId, setRegisterId, registerOptions, deliveryBranchId, setDeliveryBranchId, branches, paymentStatus, setPaymentStatus, priceListMode, setPriceListMode }: { view: ManagerSalesView; search: string; setSearch: (value: string) => void; status: string; setStatus: (value: string) => void; customerType: string; setCustomerType: (value: string) => void; dateFrom: string; setDateFrom: (value: string) => void; dateTo: string; setDateTo: (value: string) => void; statusOptions: Array<{ value: string; label: string }>; layoutMode: LayoutMode; setLayoutMode: (value: LayoutMode) => void; registerId: string; setRegisterId: (value: string) => void; registerOptions: any[]; deliveryBranchId: string; setDeliveryBranchId: (value: string) => void; branches: BranchOption[]; paymentStatus: string; setPaymentStatus: (value: string) => void; priceListMode: 'lists' | 'prices'; setPriceListMode: (value: 'lists' | 'prices') => void }) {
  const dateLabel = view === 'cash' ? 'Apertura desde' : 'Fecha desde';
  const searchPlaceholder = view === 'customers' ? 'Código, cliente, cédula, RUC o correo...' : 'Número, cliente o referencia...';
  const selectClass = 'erp-filter-select h-10 w-full rounded-xl border border-border/50 bg-background/50 px-3 text-xs font-bold tracking-wide outline-none focus:border-primary';
  return <Card className="rounded-2xl border-border/50 bg-card/40 shadow-sm"><CardContent className="flex min-w-0 flex-col gap-4 p-4 lg:flex-row lg:flex-wrap lg:items-end"><label className="min-w-0 space-y-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground lg:min-w-[280px] lg:flex-1"><span>Buscar</span><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder} className="h-10 w-full rounded-xl border-border/50 bg-background/50 pl-9 text-xs font-bold tracking-wide focus-visible:ring-primary/30" /></div></label>{view === 'customers' ? <label className="min-w-0 space-y-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground lg:w-48"><span>Tipo de cliente</span><select value={customerType} onChange={(event) => setCustomerType(event.target.value)} className={selectClass}><option value="">Todos</option><option value="INDIVIDUAL">Particulares</option><option value="COMPANY">Empresas</option></select></label> : <label className="min-w-0 space-y-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground lg:w-48"><span>{statusOptions.length ? (view === 'payments' ? 'Método' : 'Estado') : 'Estado'}</span><select value={status} onChange={(event) => setStatus(event.target.value)} className={selectClass}><option value="">Todos</option>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}{view === 'cash' && <label className="min-w-0 space-y-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground lg:w-52"><span>Caja</span><select value={registerId} onChange={(event) => setRegisterId(event.target.value)} className={selectClass}><option value="">Todas las cajas</option>{registerOptions.map((register: any) => <option key={register.id} value={register.id}>{register.code ? `${register.code} · ` : ''}{register.name}</option>)}</select></label>}{view === 'deliveries' && <><label className="min-w-0 space-y-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground lg:w-52"><span>Sucursal de entrega</span><select value={deliveryBranchId} onChange={(event) => setDeliveryBranchId(event.target.value)} className={selectClass}><option value="">Todas las sucursales</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="min-w-0 space-y-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground lg:w-44"><span>Cobro</span><select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)} className={selectClass}><option value="">Todos</option><option value="PAID">Pagado</option><option value="PENDING">Pendiente</option><option value="NO_PAYMENT">Sin cobro</option></select></label></>}{view === 'pricelists' && <label className="min-w-0 space-y-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground lg:w-52"><span>Modo de consulta</span><select value={priceListMode} onChange={(event) => setPriceListMode(event.target.value as 'lists' | 'prices')} className={selectClass}><option value="lists">Listas</option><option value="prices">Precios por producto</option></select></label>}{view !== 'pricelists' && <DateInput label={dateLabel} value={dateFrom} onChange={setDateFrom} />}{view !== 'pricelists' && view !== 'cash' && <DateInput label="Fecha hasta" value={dateTo} onChange={setDateTo} />}{view === 'cash' && <DateInput label="Apertura hasta" value={dateTo} onChange={setDateTo} />}<div data-responsive-layout-toggle className="flex shrink-0 items-center justify-end gap-1 rounded-xl border border-border/60 bg-muted/20 p-1"><Button data-layout="table" type="button" variant={layoutMode === 'table' ? 'secondary' : 'ghost'} size="icon" className="size-9 rounded-lg" onClick={() => setLayoutMode('table')} aria-label="Vista tabla"><List className="size-4" /></Button><Button data-layout="cards" type="button" variant={layoutMode === 'cards' ? 'secondary' : 'ghost'} size="icon" className="size-9 rounded-lg" onClick={() => setLayoutMode('cards')} aria-label="Vista tarjetas"><LayoutGrid className="size-4" /></Button></div></CardContent></Card>;
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="min-w-0 space-y-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground lg:w-44"><span>{label}</span><div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" /><Input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-xl border-border/50 bg-background/50 pl-9 text-xs font-bold tracking-wide" /></div></label>; }

function SalesKpis({ view, metrics, reportCurrency, status, onStatusChange }: { view: ManagerSalesView; metrics: Record<string, any>; reportCurrency: string; status: string; onStatusChange: (value: string) => void }) {
  const cards = useMemo(() => {
    const total = Number(metrics.total || 0);
    if (view === 'customers') return [['Clientes', total], ['Particulares', metrics.individuals], ['Empresas', metrics.companies], ['Sucursal con más clientes', metrics.topBranchName || 'Sin datos']];
    if (view === 'quotes') return [];
    if (view === 'cash') return [['Sesiones', total], ['Abiertas', metrics.openSessions], ['En conteo', metrics.countingSessions || 0], ['Cerradas', metrics.closedSessions], [`Facturado · ${getCurrencyMetadata(reportCurrency).code}`, formatMoney(metrics.billed, reportCurrency, true)]];
    if (view === 'deliveries') return [['Entregas', total], ['Pendientes', metrics.pending], ['Listas', metrics.ready || 0], ['Entregadas', metrics.delivered || 0], [`Monto · ${getCurrencyMetadata(reportCurrency).code}`, formatMoney(metrics.amount, reportCurrency, true)]];
    if (view === 'pricelists') return [['Listas', total], ['Activas', metrics.activeLists || 0], ['Predeterminadas', metrics.defaultLists || 0], ['Productos con precio', metrics.productsWithPrice || metrics.totalPriceItems || 0]];
    if (view === 'credits') return [['Créditos', total], [`Saldo pendiente · ${getCurrencyMetadata(reportCurrency).code}`, formatMoney(metrics.amount, reportCurrency, true)], ['Vencidos', metrics.overdue], ['Sucursal principal', metrics.topBranchName || 'Sin datos']];
    return [['Registros', total], [`Monto total · ${getCurrencyMetadata(reportCurrency).code}`, formatMoney(metrics.amount, reportCurrency, true)], ['Sucursal principal', metrics.topBranchName || 'Sin datos'], ['Registros principales', metrics.topBranchCount || 0]];
  }, [metrics, view, reportCurrency]);
  if (view === 'quotes') {
    const quoteStatusCards = [
      { key: '', label: 'Total de cotizaciones', value: Number(metrics.total || 0) },
      { key: '__amount__', label: 'Monto total', value: formatMoney(metrics.amount, reportCurrency, true), detail: `Referencia: ${formatCurrencyDescriptor(reportCurrency)}${metrics.aggregationComplete === false ? ` · cálculo hasta ${metrics.aggregationLimit || 5000} registros` : ''}` },
      { key: 'APPROVED', label: 'Aprobadas', value: Number(metrics.statusCounts?.APPROVED || 0) },
      { key: 'DRAFT', label: 'Borradores', value: Number(metrics.statusCounts?.DRAFT || 0) },
      { key: 'IN_PROCESS', label: 'En proceso', value: Number(metrics.statusCounts?.IN_PROCESS || 0) },
      { key: 'CANCELLED', label: 'Canceladas', value: Number(metrics.statusCounts?.CANCELLED || 0) },
    ];
    return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{quoteStatusCards.map((card) => {
      const isAmount = card.key === '__amount__';
      const active = !isAmount && (status || '') === card.key;
      return <button key={card.key || 'all'} type="button" disabled={isAmount} onClick={() => !isAmount && onStatusChange(active ? '' : card.key)} className={cn('rounded-2xl border bg-card p-4 text-left shadow-sm transition-colors', isAmount ? 'cursor-default border-primary/30 bg-primary/[0.04]' : 'border-border/60 hover:border-primary/40 hover:bg-primary/[0.04]', active && 'border-primary/60 bg-primary/10 ring-1 ring-primary/30')}>
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{card.label}</p>
        <p className="mt-2 truncate text-xl font-black">{typeof card.value === 'number' ? formatNumber(card.value) : card.value}</p>
        {isAmount ? <p className="mt-1 text-[10px] font-bold text-primary">{card.detail}</p> : <span className={cn('mt-2 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider', card.key ? statusBadgeClass(card.key) : 'border-border/60 bg-muted/30 text-muted-foreground')}>{card.key ? statusLabel(card.key) : status ? 'Filtro activo' : 'Todos'}</span>}
      </button>;
    })}</div>;
  }
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-2 truncate text-xl font-black">{typeof value === 'number' ? formatNumber(value) : value || '0'}</p></div>)}</div>;
}

function CashRegisterSummary({ rows, reportCurrency }: { rows: any[]; reportCurrency: string }) {
  if (!rows.length) return null;
  return <Card className="rounded-3xl border-primary/20 bg-primary/[0.03] shadow-sm"><CardHeader className="border-b border-border/50"><CardTitle className="flex items-center gap-2 text-base font-black uppercase italic tracking-tight"><CreditCard className="size-4 text-primary" />Resumen por caja</CardTitle><p className="text-xs text-muted-foreground">Consolidado del alcance y período seleccionados. Los importes de facturación se muestran en la moneda del Topbar.</p></CardHeader><CardContent className="p-0"><div className="sales-responsive-table overflow-x-auto"><Table className="min-w-[920px]"><TableHeader><TableRow><TableHead>Caja</TableHead><TableHead>Sucursal</TableHead><TableHead className="text-right">Sesiones</TableHead><TableHead className="text-right">Facturas</TableHead><TableHead className="text-right">Facturado equivalente</TableHead><TableHead className="text-right">Esperado</TableHead><TableHead className="text-right">Diferencia</TableHead></TableRow></TableHeader><TableBody>{rows.map((row: any) => <TableRow key={`${row.branchId}-${row.registerId || 'none'}`}><TableCell><div className="font-semibold">{row.registerName}</div><div className="font-mono text-xs text-muted-foreground">{row.registerCode || 'Sin código'}</div></TableCell><TableCell>{row.branchName}</TableCell><TableCell className="text-right font-semibold">{formatNumber(row.sessions)}</TableCell><TableCell className="text-right font-semibold">{formatNumber(row.invoices)}</TableCell><TableCell className="text-right"><span className="font-black text-primary">{formatMoney(row.reportBilled, reportCurrency, true)}</span></TableCell><TableCell className="text-right"><span className="font-black">{formatMoney(row.expectedAmountNIO, 'NIO', true)}</span><span className="block text-[10px] font-bold text-primary">Equiv. {formatMoney(row.reportExpectedAmountNIO, reportCurrency, true)}</span></TableCell><TableCell className="text-right"><span className="font-black">{formatMoney(row.differenceNIO, 'NIO', true)}</span><span className="block text-[10px] font-bold text-primary">Equiv. {formatMoney(row.reportDifferenceNIO, reportCurrency, true)}</span></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>;
}

function SalesTable({ view, rows, showBranch, reportCurrency, sortState, onSort, onDetail, priceListMode = 'lists' }: { view: ManagerSalesView; rows: any[]; showBranch: boolean; reportCurrency: string; sortState: Record<string, ColumnSort>; onSort: (key: string, sort: ColumnSort) => void; onDetail?: (row: any) => void; priceListMode?: 'lists' | 'prices' }) {
  const columns = tableColumns(view, showBranch, reportCurrency, priceListMode);
  const isCustomerTable = view === 'customers';
  const isQuoteTable = view === 'quotes';
  const isDocumentTable = ['orders', 'invoices', 'recurring', 'payments', 'creditnotes', 'credits'].includes(view);
  const { openingId, startOpening } = useDetailOpeningFeedback();
  const openDetail = (row: any) => startOpening(row.id, () => onDetail?.(row));
  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: any) => {
    if (!onDetail || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    openDetail(row);
  };
  return <Card className="overflow-hidden rounded-3xl border-border/60 shadow-sm"><CardHeader className="border-b border-border/60"><CardTitle className="text-lg font-black uppercase italic tracking-tight">{viewLabels[view]}</CardTitle><p className="text-sm text-muted-foreground">{isCustomerTable ? 'Selecciona cualquier parte del registro para consultar el detalle del cliente.' : isQuoteTable ? 'Selecciona una cotización para consultar sus líneas y el historial de aprobación.' : isDocumentTable || ['deliveries', 'cash', 'pricelists'].includes(view) ? 'Selecciona cualquier parte del registro para consultar el detalle, historial y acciones disponibles.' : 'Ordena los registros desde los encabezados. Los datos son de solo lectura.'}</p></CardHeader><CardContent className="p-0">{rows.length ? <div className="sales-responsive-table overflow-x-auto"><Table className={cn(isCustomerTable ? 'min-w-[1480px]' : isQuoteTable ? 'min-w-[1280px]' : isDocumentTable || ['deliveries', 'cash', 'pricelists'].includes(view) ? 'min-w-[1280px]' : 'min-w-[980px]')}><TableHeader><TableRow>{columns.map((column) => <TableHead key={column.label} className={cn(column.numeric && 'text-right')}><div className={cn('flex items-center gap-1.5', column.numeric && 'justify-end')}><span>{column.label}</span>{column.sortKey && <ColumnFilterMenu label={column.label} compact sort={sortState[`${view}:${column.sortKey}`] || null} onSort={(sort) => onSort(column.sortKey!, sort)} sortType={column.sortType} />}</div></TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row) => { const isOpening = openingId != null && String(openingId) === String(row.id); return <TableRow key={row.id} tabIndex={onDetail ? 0 : undefined} role={onDetail ? 'button' : undefined} aria-busy={isOpening || undefined} data-detail-opening={isOpening ? 'true' : undefined} aria-label={onDetail ? `Ver detalle de ${row.number || row.name || viewLabels[view]}` : undefined} className={cn(onDetail && 'cursor-pointer transition-colors hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40')} onClick={() => openDetail(row)} onKeyDown={(event) => handleRowKeyDown(event, row)}>{columns.map((column, index) => <TableCell key={`${row.id}-${column.label}`} className={cn('max-w-64 align-top whitespace-normal', column.numeric && 'text-right font-semibold')}><div className={index === 0 ? 'flex min-w-0 items-center gap-2' : undefined}>{column.render(row)}{index === 0 && isOpening && <span role="status" className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-primary"><Loader2 className="size-3 animate-spin" /> Abriendo…</span>}</div></TableCell>)}</TableRow>; })}</TableBody></Table></div> : <EmptyState title="Sin registros" description="No hay información para el rubro, sucursal y filtros seleccionados." />}</CardContent></Card>;
}

function SalesCards({ view, rows, showBranch, reportCurrency, onDetail, priceListMode = 'lists' }: { view: ManagerSalesView; rows: any[]; showBranch: boolean; reportCurrency: string; onDetail?: (row: any) => void; priceListMode?: 'lists' | 'prices' }) {
  const { openingId, startOpening } = useDetailOpeningFeedback();
  const openDetail = (row: any) => startOpening(row.id, () => onDetail?.(row));
  if (!rows.length) return <EmptyState title="Sin registros" description="No hay información para el rubro, sucursal y filtros seleccionados." />;
  return <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map((row) => view === 'customers' ? <CustomerCard key={row.id} customer={row} onDetail={openDetail} openingId={openingId} /> : view === 'quotes' ? <QuoteCard key={row.id} quote={row} onDetail={openDetail} openingId={openingId} /> : <ManagerSalesRecordCard key={row.id} view={view} row={row} showBranch={showBranch} reportCurrency={reportCurrency} onDetail={openDetail} openingId={openingId} priceListMode={priceListMode} />)}</div>;
}

function ManagerSalesRecordCard({ view, row, showBranch, reportCurrency, onDetail, openingId, priceListMode = 'lists' }: { view: ManagerSalesView; row: any; showBranch: boolean; reportCurrency: string; onDetail?: (row: any) => void; openingId?: string | number | null; priceListMode?: 'lists' | 'prices' }) {
  const isOpening = openingId != null && String(openingId) === String(row.id);
  const documentView = ['orders', 'invoices', 'recurring', 'payments', 'creditnotes', 'credits'].includes(view);
  const title = row.number || row.name || row.productName || row.listName || row.registerName || String(row.id || '').slice(0, 8) || 'Registro';
  const status = view === 'pricelists' ? (row.isActive == null ? (row.listActive ? 'ACTIVE' : 'INACTIVE') : (row.isActive ? 'ACTIVE' : 'INACTIVE')) : row.status || row.paymentStatus || row.deliveryStatus;
  const amount = row.total ?? row.amount ?? row.balance ?? row.billed;
  const values = view === 'orders'
    ? [['Cliente', row.customerName || 'Cliente ocasional'], ['Artículos', formatNumber(row.itemCount)], ['Total', <MoneyPair row={row} original={row.total} equivalent={row.reportTotal} reportCurrency={reportCurrency} compact />], ['Facturado por', row.invoicedByName || '—'], ['Fecha', formatDate(row.date)]]
    : view === 'invoices'
      ? [['Cliente', row.customerName || 'Cliente ocasional'], ['Emisión', formatDate(row.date)], ['Vencimiento', formatDate(row.dueDate)], ['Total neto', <MoneyPair row={row} original={row.subtotal ?? row.total} equivalent={row.reportSubtotal ?? row.reportTotal} reportCurrency={reportCurrency} compact />], ['Saldo pendiente', <MoneyPair row={row} original={row.balance} equivalent={row.reportBalance} reportCurrency={reportCurrency} compact />], ['Forma de pago', statusLabel(row.paymentMethod)]]
      : view === 'recurring'
        ? [['Cliente', row.customerName || 'Cliente ocasional'], ['Frecuencia', statusLabel(row.frequency)], ['Monto de ciclo', <MoneyPair row={row} original={row.total} equivalent={row.reportTotal} reportCurrency={reportCurrency} compact />], ['Próxima fecha', formatDate(row.nextInvoiceDate)]]
        : view === 'payments'
          ? [['Cliente', row.customerName || 'Cliente ocasional'], ['Fecha', formatDate(row.date)], ['Monto', <MoneyPair row={row} original={row.amount} equivalent={row.reportAmount} reportCurrency={reportCurrency} compact />], ['Forma de pago', statusLabel(row.method)], ['Documento', row.documentNumber || row.reference || 'Anticipo']]
          : view === 'creditnotes'
            ? [['Cliente', row.customerName || 'Cliente ocasional'], ['Fecha', formatDate(row.date)], ['Total', <MoneyPair row={row} original={row.total} equivalent={row.reportTotal} reportCurrency={reportCurrency} compact />], ['Saldo', <MoneyPair row={row} original={row.balance} equivalent={row.reportBalance} reportCurrency={reportCurrency} compact />], ['Factura origen', row.documentNumber || 'Crédito directo']]
            : view === 'credits'
              ? [['Cliente', row.customerName || 'Cliente ocasional'], ['Vencimiento', formatDate(row.dueDate)], ['Total', <MoneyPair row={row} original={row.total} equivalent={row.reportTotal} reportCurrency={reportCurrency} compact />], ['Saldo pendiente', <MoneyPair row={row} original={row.balance} equivalent={row.reportBalance} reportCurrency={reportCurrency} compact />]]
              : view === 'deliveries'
                ? [['Cliente', row.customerName || 'Cliente ocasional'], ['Facturación', row.billingBranchName], ['Entrega en', row.deliveryBranchName], ['Artículos', formatNumber(row.itemCount)], ['Monto', <MoneyPair row={row} original={row.total} equivalent={row.reportTotal} reportCurrency={reportCurrency} compact />], ['Cobro', statusLabel(row.paymentStatus)], ['Fecha', formatDate(row.date)]]
                : view === 'cash'
                  ? [['Sucursal', row.branchName], ['Apertura', formatDate(row.openedAt, true)], ['Cierre', formatDate(row.closedAt, true)], ['Facturas', formatNumber(row.invoiceCount)], ['Diferencia', <MoneyPair row={row} original={row.differenceNIO} equivalent={row.reportDifferenceNIO} reportCurrency={reportCurrency} compact />]]
                  : view === 'pricelists'
                    ? (priceListMode === 'prices' || row.productName ? [['Producto', row.productName], ['Lista', row.listName], ['Sucursal', row.branchName], ['Precio', <MoneyPair row={{ ...row, reportTotal: row.reportPrice }} original={row.price} equivalent={row.reportPrice} reportCurrency={reportCurrency} compact />], ['Estado', statusLabel(row.listActive ? 'ACTIVE' : 'INACTIVE')]] : [['Sucursal', row.branchName], ['Productos', formatNumber(row.itemCount)], ['Precios en', row.currencies?.join(' / ') || row.currency || 'NIO'], ['Estado', row.isActive == null ? statusLabel(row.listActive ? 'ACTIVE' : 'INACTIVE') : statusLabel(row.isActive ? 'ACTIVE' : 'INACTIVE')], ['Actualizada', formatDate(row.updatedAt)]])
                    : [['Fecha', formatDate(row.date || row.openedAt || row.nextInvoiceDate)], ['Monto', <MoneyPair row={row} original={amount} equivalent={row.reportDifferenceNIO || row.reportAmount || row.reportTotal} reportCurrency={reportCurrency} compact />]];
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onDetail || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onDetail(row);
  };
  return <Card role={onDetail ? 'button' : undefined} tabIndex={onDetail ? 0 : undefined} aria-label={onDetail ? `Ver detalle de ${title}` : undefined} onClick={() => onDetail?.(row)} onKeyDown={handleKeyDown} className={cn('rounded-2xl border-border/60 shadow-sm', onDetail && 'cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40')}>
    <CardContent className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-mono text-base font-black text-primary">{title}</p>{documentView ? <p className="mt-1 flex items-start gap-1.5 text-xs font-semibold text-primary"><Building2 className="mt-0.5 size-3.5 shrink-0" /><span className="break-words">{row.branchName || 'Sucursal no identificada'}</span></p> : showBranch && <Badge variant="secondary" className="mt-1 max-w-full truncate">{row.branchName}</Badge>}</div><div className="flex shrink-0 items-center gap-2">{isOpening && <span role="status" className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-primary"><Loader2 className="size-3 animate-spin" /> Abriendo…</span>}{statusBadge(status)}</div></div>
      <div className="space-y-2">{values.map(([label, value]) => <div key={label} className="flex items-start justify-between gap-3 text-sm"><span className="shrink-0 text-xs text-muted-foreground">{label}</span><span className="min-w-0 break-words text-right font-semibold">{value}</span></div>)}</div>
      {onDetail && <p className="border-t border-border/50 pt-3 text-[10px] font-black uppercase tracking-widest text-primary">Abrir detalle e historial</p>}
    </CardContent>
  </Card>;
}

type TableColumn = { label: string; numeric?: boolean; sortKey?: string; sortType?: ColumnSortType; getSortValue?: (row: any) => unknown; render: (row: any) => ReactNode };
const customerTypeLabel = (type: unknown) => String(type || '').toUpperCase() === 'INDIVIDUAL' ? 'Particular' : 'Empresa';
const customerStatusInfo = (status: unknown) => String(status || '').toUpperCase() === 'ACTIVE'
  ? { label: 'Activo', className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' }
  : { label: 'Inactivo', className: 'border-muted-foreground/20 bg-muted/30 text-muted-foreground' };
const customerValue = (value: unknown, fallback = 'No registrado') => String(value ?? '').trim() || fallback;
const dateSortValue = (value: unknown) => value ? new Date(String(value)).getTime() : 0;
const quoteRateText = (row: any) => row.reportRateLabel || `1 ${row.reportCurrency || 'NIO'} = 1 ${row.baseCurrency || row.currency || 'NIO'}`;
const quoteRateSourceLabel = (value: unknown) => ({ HISTORICAL: 'Tasa histórica', CURRENT_CONFIGURATION: 'Tasa vigente de configuración', SAME_CURRENCY: 'Misma moneda', TRANSACTION: 'Tasa registrada en la operación' } as Record<string, string>)[String(value || '').toUpperCase()] || String(value || 'Tasa de la operación');
const quoteRateSubtext = (row: any) => `${quoteRateText(row)} · ${quoteRateSourceLabel(row.reportRateSource)} · ${formatDate(row.reportRateEffectiveAt || row.date)}`;
function MoneyPair({ row, original, equivalent, reportCurrency, compact = false }: { row: any; original: unknown; equivalent: unknown; reportCurrency: string; compact?: boolean }) {
  const originalCurrency = row.currency || row.baseCurrency || 'NIO';
  const hasEquivalent = equivalent != null && Number.isFinite(Number(equivalent));
  return <div className={cn('space-y-0.5', compact ? 'min-w-28' : 'min-w-36')}>
    <span className="block font-black">{formatMoney(original, originalCurrency, true)}</span>
    <span className="block text-[10px] font-bold text-primary">Equiv. {hasEquivalent ? formatMoney(equivalent, reportCurrency, true) : 'No disponible'}</span>
    <span className="block text-[9px] font-semibold leading-3 text-muted-foreground">{quoteRateSubtext({ ...row, reportCurrency })}</span>
  </div>;
}

function tableColumns(view: ManagerSalesView, showBranch: boolean, reportCurrency: string, priceListMode: 'lists' | 'prices' = 'lists'): TableColumn[] {
  const branch: TableColumn[] = showBranch ? [{ label: 'Sucursal', sortKey: 'branchName', sortType: 'text', render: (row: any) => <Badge variant="secondary" className="max-w-44 truncate">{row.branchName}</Badge> }] : [];
  if (view === 'customers') return [
    { label: 'Código / sucursal', sortKey: 'code', sortType: 'text', render: (row) => <div className="min-w-40 space-y-1"><span className="block font-mono font-bold">{customerValue(row.code, row.id?.slice(0, 8) || '—')}</span><span className="flex items-start gap-1.5 text-xs font-semibold text-primary"><Building2 className="mt-0.5 size-3.5 shrink-0" /> <span className="break-words">{customerValue(row.branchName, 'Sucursal no identificada')}</span></span></div> },
    { label: 'Cliente', sortKey: 'name', sortType: 'text', render: (row) => <span className="font-semibold">{customerValue(row.name)}</span> },
    { label: 'Tipo', sortKey: 'type', sortType: 'text', render: (row) => customerTypeLabel(row.type) },
    { label: 'Cédula', sortKey: 'taxId', sortType: 'text', render: (row) => <span className={cn(!row.taxId && 'text-muted-foreground')}>{customerValue(row.taxId)}</span> },
    { label: 'RUC', sortKey: 'ruc', sortType: 'text', render: (row) => <span className={cn(!row.ruc && 'text-muted-foreground')}>{customerValue(row.ruc)}</span> },
    { label: 'Régimen fiscal', sortKey: 'fiscalRegime', sortType: 'text', render: (row) => customerValue(row.fiscalRegime) },
    { label: 'Correo', sortKey: 'email', sortType: 'text', render: (row) => <span className="break-words">{customerValue(row.email)}</span> },
    { label: 'Teléfono', sortKey: 'phone', sortType: 'text', render: (row) => customerValue(row.phone) },
    { label: 'Departamento', sortKey: 'department', sortType: 'text', render: (row) => customerValue(row.department) },
    { label: 'Estado', sortKey: 'status', sortType: 'text', render: (row) => { const info = customerStatusInfo(row.status); return <Badge variant="outline" className={cn('font-black', info.className)}>{info.label}</Badge>; } },
  ];
  if (view === 'quotes') return [
    { label: 'Número', sortKey: 'number', sortType: 'text', render: (row) => <div className="min-w-40"><span className="block font-mono font-bold text-primary">{row.number || '—'}</span><span className="mt-1 flex items-start gap-1.5 text-xs font-semibold text-primary"><Building2 className="mt-0.5 size-3.5 shrink-0" /><span className="break-words">{row.branchName || 'Sucursal no identificada'}</span></span></div> },
    { label: 'Cliente', sortKey: 'customerName', sortType: 'text', render: (row) => row.customerName || 'Cliente ocasional' },
    { label: 'Fecha de emisión', sortKey: 'date', sortType: 'date', getSortValue: (row) => dateSortValue(row.date), render: (row) => formatDate(row.date) },
    { label: 'Total original', sortKey: 'total', sortType: 'number', numeric: true, render: (row) => <div><span className="block font-black">{formatMoney(row.total, row.currency, true)}</span><span className="text-[10px] font-normal text-muted-foreground">{formatCurrencyDescriptor(row.currency)}</span></div> },
    { label: `Equivalencia ${getCurrencyMetadata(reportCurrency).symbol}`, sortKey: 'reportTotal', sortType: 'number', numeric: true, render: (row) => <div><span className="block font-black text-primary">{row.reportTotal == null ? 'No disponible' : formatMoney(row.reportTotal, reportCurrency, true)}</span><span className="block text-[10px] font-bold text-muted-foreground">{quoteRateSubtext(row)}</span></div> },
    { label: 'Estado', sortKey: 'status', sortType: 'text', render: (row) => statusBadge(row.status) },
    { label: 'Validez', sortKey: 'expiryDate', sortType: 'date', getSortValue: (row) => dateSortValue(row.expiryDate), render: (row) => <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Calendar className="size-3.5" />{formatDate(row.expiryDate)}</div> },
  ];
  const documentNumber = (row: any, fallback = 'Sin número') => <div className="min-w-44 space-y-1"><span className="block font-mono font-bold text-primary">{row.number || fallback}</span><span className="flex items-start gap-1.5 text-xs font-semibold text-primary"><Building2 className="mt-0.5 size-3.5 shrink-0" /><span className="break-words">{row.branchName || 'Sucursal no identificada'}</span></span></div>;
  if (view === 'orders') return [{ label: 'Número / sucursal', sortKey: 'number', sortType: 'text', render: (row) => documentNumber(row) }, { label: 'Cliente', sortKey: 'customerName', sortType: 'text', render: (row) => row.customerName || 'Cliente ocasional' }, { label: 'Artículos', sortKey: 'itemCount', sortType: 'number', numeric: true, render: (row) => formatNumber(row.itemCount) }, { label: 'Monto total', sortKey: 'total', sortType: 'number', numeric: true, render: (row) => <MoneyPair row={row} original={row.total} equivalent={row.reportTotal} reportCurrency={reportCurrency} /> }, { label: 'Estado', sortKey: 'status', sortType: 'text', render: (row) => statusBadge(row.status) }, { label: 'Facturado por', sortKey: 'invoicedByName', sortType: 'text', render: (row) => row.invoicedByName || '—' }, { label: 'Fecha', sortKey: 'date', sortType: 'date', getSortValue: (row) => dateSortValue(row.date), render: (row) => formatDate(row.date) }];
  if (view === 'invoices') return [{ label: 'Factura / sucursal', sortKey: 'number', sortType: 'text', render: (row) => documentNumber(row) }, { label: 'Cliente', sortKey: 'customerName', sortType: 'text', render: (row) => row.customerName || 'Cliente ocasional' }, { label: 'Fecha de emisión', sortKey: 'date', sortType: 'date', getSortValue: (row) => dateSortValue(row.date), render: (row) => formatDate(row.date) }, { label: 'Fecha de vencimiento', sortKey: 'dueDate', sortType: 'date', getSortValue: (row) => dateSortValue(row.dueDate), render: (row) => formatDate(row.dueDate) }, { label: 'Total neto', sortKey: 'subtotal', sortType: 'number', numeric: true, getSortValue: (row) => row.subtotal ?? row.total, render: (row) => <MoneyPair row={row} original={row.subtotal ?? row.total} equivalent={row.reportSubtotal ?? row.reportTotal} reportCurrency={reportCurrency} /> }, { label: 'Saldo pendiente', sortKey: 'balance', sortType: 'number', numeric: true, render: (row) => <MoneyPair row={row} original={row.balance} equivalent={row.reportBalance} reportCurrency={reportCurrency} /> }, { label: 'Forma de pago', sortKey: 'paymentMethod', sortType: 'text', render: (row) => statusLabel(row.paymentMethod) }, { label: 'Estado', sortKey: 'status', sortType: 'text', render: (row) => statusBadge(row.status) }];
  if (view === 'recurring') return [{ label: 'Referencia / sucursal', sortKey: 'id', sortType: 'text', render: (row) => documentNumber(row) }, { label: 'Cliente', sortKey: 'customerName', sortType: 'text', render: (row) => row.customerName || 'Cliente ocasional' }, { label: 'Frecuencia', sortKey: 'frequency', sortType: 'text', render: (row) => statusLabel(row.frequency) }, { label: 'Monto de ciclo', sortKey: 'total', sortType: 'number', numeric: true, render: (row) => <MoneyPair row={row} original={row.total} equivalent={row.reportTotal} reportCurrency={reportCurrency} /> }, { label: 'Estado', sortKey: 'status', sortType: 'text', render: (row) => statusBadge(row.status) }, { label: 'Próxima fecha', sortKey: 'nextInvoiceDate', sortType: 'date', getSortValue: (row) => dateSortValue(row.nextInvoiceDate), render: (row) => formatDate(row.nextInvoiceDate) }];
  if (view === 'payments') return [{ label: 'Pago / sucursal', sortKey: 'number', sortType: 'text', render: (row) => documentNumber(row) }, { label: 'Cliente', sortKey: 'customerName', sortType: 'text', render: (row) => row.customerName || 'Cliente ocasional' }, { label: 'Fecha', sortKey: 'date', sortType: 'date', getSortValue: (row) => dateSortValue(row.date), render: (row) => formatDate(row.date) }, { label: 'Monto', sortKey: 'amount', sortType: 'number', numeric: true, render: (row) => <MoneyPair row={row} original={row.amount} equivalent={row.reportAmount} reportCurrency={reportCurrency} /> }, { label: 'Forma de pago', sortKey: 'method', sortType: 'text', render: (row) => statusLabel(row.method) }, { label: 'Documento relacionado', sortKey: 'documentNumber', sortType: 'text', getSortValue: (row) => row.documentNumber || row.reference || 'Anticipo', render: (row) => row.documentNumber || row.reference || 'Anticipo' }, { label: 'Estado', sortKey: 'status', sortType: 'text', render: () => statusBadge('PAID') }];
  if (view === 'creditnotes') return [{ label: 'Nota / sucursal', sortKey: 'number', sortType: 'text', render: (row) => documentNumber(row) }, { label: 'Cliente', sortKey: 'customerName', sortType: 'text', render: (row) => row.customerName || 'Cliente ocasional' }, { label: 'Fecha', sortKey: 'date', sortType: 'date', getSortValue: (row) => dateSortValue(row.date), render: (row) => formatDate(row.date) }, { label: 'Total', sortKey: 'total', sortType: 'number', numeric: true, render: (row) => <MoneyPair row={row} original={row.total} equivalent={row.reportTotal} reportCurrency={reportCurrency} /> }, { label: 'Saldo pendiente', sortKey: 'balance', sortType: 'number', numeric: true, render: (row) => <MoneyPair row={row} original={row.balance} equivalent={row.reportBalance} reportCurrency={reportCurrency} /> }, { label: 'Estado', sortKey: 'status', sortType: 'text', render: (row) => statusBadge(row.status) }];
  if (view === 'credits') return [{ label: 'Factura / sucursal', sortKey: 'number', sortType: 'text', render: (row) => documentNumber(row) }, { label: 'Cliente', sortKey: 'customerName', sortType: 'text', render: (row) => row.customerName || 'Cliente ocasional' }, { label: 'Fecha de vencimiento', sortKey: 'dueDate', sortType: 'date', getSortValue: (row) => dateSortValue(row.dueDate), render: (row) => formatDate(row.dueDate) }, { label: 'Total', sortKey: 'total', sortType: 'number', numeric: true, render: (row) => <MoneyPair row={row} original={row.total} equivalent={row.reportTotal} reportCurrency={reportCurrency} /> }, { label: 'Saldo pendiente', sortKey: 'balance', sortType: 'number', numeric: true, render: (row) => <MoneyPair row={row} original={row.balance} equivalent={row.reportBalance} reportCurrency={reportCurrency} /> }, { label: 'Estado', sortKey: 'status', sortType: 'text', render: (row) => statusBadge(row.status) }];
  if (view === 'deliveries') return [{ label: 'Entrega / sucursal', sortKey: 'number', sortType: 'text', render: (row) => <div className="min-w-40"><span className="block font-mono font-bold text-primary">{row.number}</span><span className="mt-1 flex items-start gap-1.5 text-xs font-semibold text-primary"><Building2 className="mt-0.5 size-3.5 shrink-0" /><span className="break-words">{row.billingBranchName || 'Sucursal no identificada'}</span></span></div> }, { label: 'Cliente', sortKey: 'customerName', sortType: 'text', render: (row) => row.customerName }, { label: 'Entrega en', sortKey: 'deliveryBranchName', sortType: 'text', render: (row) => row.deliveryBranchName }, { label: 'Factura', sortKey: 'invoiceNumber', sortType: 'text', render: (row) => row.invoiceNumber || 'Sin factura' }, { label: 'Artículos', sortKey: 'itemCount', sortType: 'number', numeric: true, render: (row) => formatNumber(row.itemCount) }, { label: 'Monto', sortKey: 'total', sortType: 'number', numeric: true, render: (row) => <MoneyPair row={row} original={row.total} equivalent={row.reportTotal} reportCurrency={reportCurrency} /> }, { label: 'Cobro', sortKey: 'paymentStatus', sortType: 'text', render: (row) => statusBadge(row.paymentStatus) }, { label: 'Entrega', sortKey: 'deliveryStatus', sortType: 'text', render: (row) => statusBadge(row.deliveryStatus) }, { label: 'Fecha', sortKey: 'date', sortType: 'date', getSortValue: (row) => dateSortValue(row.date), render: (row) => formatDate(row.date) }, ...branch];
  if (view === 'cash') return [{ label: 'Caja', sortKey: 'registerName', sortType: 'text', render: (row) => <div className="min-w-36"><span className="block font-semibold">{row.registerName} · {row.registerCode || '—'}</span><span className="mt-1 flex items-start gap-1.5 text-xs font-semibold text-primary"><Building2 className="mt-0.5 size-3.5 shrink-0" /><span className="break-words">{row.branchName || 'Sucursal no identificada'}</span></span></div> }, { label: 'Apertura', sortKey: 'openedAt', sortType: 'date', getSortValue: (row) => dateSortValue(row.openedAt), render: (row) => formatDate(row.openedAt, true) }, { label: 'Cierre', sortKey: 'closedAt', sortType: 'date', getSortValue: (row) => dateSortValue(row.closedAt), render: (row) => formatDate(row.closedAt, true) }, { label: 'Abrió', sortKey: 'openedByName', sortType: 'text', render: (row) => row.openedByName || '—' }, { label: 'Facturas', sortKey: 'invoiceCount', sortType: 'number', numeric: true, render: (row) => formatNumber(row.invoiceCount) }, { label: 'Diferencia', sortKey: 'differenceNIO', sortType: 'number', numeric: true, render: (row) => <MoneyPair row={row} original={row.differenceNIO} equivalent={row.reportDifferenceNIO} reportCurrency={reportCurrency} /> }, { label: 'Estado', sortKey: 'status', sortType: 'text', render: (row) => statusBadge(row.status) }];
  if (view === 'pricelists') {
    if (priceListMode === 'prices') return [{ label: 'Producto / SKU', sortKey: 'productName', sortType: 'text', render: (row) => <div className="min-w-48"><span className="block font-semibold">{row.productName}</span><span className="mt-1 font-mono text-xs text-muted-foreground">{row.productCode}</span></div> }, { label: 'Lista', sortKey: 'listName', sortType: 'text', render: (row) => <div><span className="block font-semibold">{row.listName}</span><span className="text-xs text-muted-foreground">{row.listCode}</span></div> }, { label: 'Sucursal', sortKey: 'branchName', sortType: 'text', render: (row) => row.branchName }, { label: 'Precio', sortKey: 'price', sortType: 'number', numeric: true, render: (row) => <MoneyPair row={{ ...row, reportTotal: row.reportPrice }} original={row.price} equivalent={row.reportPrice} reportCurrency={reportCurrency} /> }, { label: 'Costo referencia', sortKey: 'costPrice', sortType: 'number', numeric: true, render: (row) => formatMoney(row.costPrice, row.currency, true) }, { label: 'Estado', sortKey: 'listActive', sortType: 'text', render: (row) => statusBadge(row.listActive ? 'ACTIVE' : 'INACTIVE') }];
    return [{ label: 'Lista / sucursal', sortKey: 'code', sortType: 'text', render: (row) => <div className="min-w-44"><span className="block font-mono font-bold text-primary">{row.code}</span><span className="mt-1 flex items-start gap-1.5 text-xs font-semibold text-primary"><Building2 className="mt-0.5 size-3.5 shrink-0" /><span className="break-words">{row.branchName}</span></span></div> }, { label: 'Nombre / precios', sortKey: 'name', sortType: 'text', render: (row) => <div><span className="block font-semibold">{row.name}</span><span className="text-xs text-muted-foreground">Precios en {row.currencies?.join(' / ') || row.currency || 'NIO'}</span></div> }, { label: 'Productos', sortKey: 'itemCount', sortType: 'number', numeric: true, render: (row) => formatNumber(row.itemCount) }, { label: 'Predeterminada', sortKey: 'isDefault', sortType: 'text', render: (row) => row.isDefault ? <Badge variant="outline" className={statusBadgeClass('ACTIVE')}>Sí</Badge> : 'No' }, { label: 'Estado', sortKey: 'isActive', sortType: 'text', render: (row) => statusBadge(row.isActive ? 'ACTIVE' : 'INACTIVE') }, { label: 'Actualizada', sortKey: 'updatedAt', sortType: 'date', getSortValue: (row) => dateSortValue(row.updatedAt), render: (row) => formatDate(row.updatedAt) }];
  }
  return [];
}

function sortRows(rows: any[], columns: TableColumn[], state: Record<string, ColumnSort>, view: ManagerSalesView) {
  const activeColumn = columns.find((column) => column.sortKey && state[`${view}:${column.sortKey}`]);
  if (!activeColumn?.sortKey) return rows;
  const direction = state[`${view}:${activeColumn.sortKey}`] === 'desc' ? -1 : 1;
  const readValue = (row: any) => activeColumn.getSortValue ? activeColumn.getSortValue(row) : row[activeColumn.sortKey!];
  return [...rows].sort((left, right) => {
    const a = readValue(left);
    const b = readValue(right);
    if (activeColumn.sortType === 'number' || activeColumn.sortType === 'date') return (Number(a || 0) - Number(b || 0)) * direction;
    return String(a ?? '').localeCompare(String(b ?? ''), 'es', { sensitivity: 'base', numeric: true }) * direction;
  });
}

function QuoteCard({ quote, onDetail, openingId }: { quote: any; onDetail?: (row: any) => void; openingId?: string | number | null }) {
  const isOpening = openingId != null && String(openingId) === String(quote.id);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onDetail || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onDetail(quote);
  };
  return <Card role={onDetail ? 'button' : undefined} tabIndex={onDetail ? 0 : undefined} aria-label={onDetail ? `Ver detalle de ${quote.number || 'cotización'}` : undefined} onClick={() => onDetail?.(quote)} onKeyDown={handleKeyDown} className={cn('rounded-2xl border-border/60 shadow-sm', onDetail && 'cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40')}>
    <CardContent className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="truncate font-mono text-base font-black text-primary">{quote.number || 'Sin número'}</p><p className="mt-1 flex items-start gap-1.5 text-xs font-semibold text-primary"><Building2 className="mt-0.5 size-3.5 shrink-0" /><span className="break-words">{quote.branchName || 'Sucursal no identificada'}</span></p></div>
        <div className="flex shrink-0 items-center gap-2">{isOpening && <span role="status" className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-primary"><Loader2 className="size-3 animate-spin" /> Abriendo…</span>}{statusBadge(quote.status)}</div>
      </div>
      <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente</p><p className="mt-1 truncate text-sm font-bold">{quote.customerName || 'Cliente ocasional'}</p></div>
      <div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Emisión</p><p className="font-semibold">{formatDate(quote.date)}</p></div><div><p className="text-xs text-muted-foreground">Validez</p><p className="font-semibold">{formatDate(quote.expiryDate)}</p></div></div>
      <div className="space-y-2 border-t border-border/50 pt-3"><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total original</span><span className="font-black">{formatMoney(quote.total, quote.currency, true)}</span></div><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Equivalencia</span><span className="font-black text-primary">{quote.reportTotal == null ? 'No disponible' : formatMoney(quote.reportTotal, quote.reportCurrency, true)}</span></div><p className="text-right text-[10px] font-bold text-muted-foreground">{quoteRateSubtext(quote)}</p></div>
      {onDetail && <p className="text-[10px] font-black uppercase tracking-widest text-primary">Abrir detalle e historial</p>}
    </CardContent>
  </Card>;
}

function buildManagerQuotePanel(quote: any, history?: any[]): SalesDocumentPanelData {
  const customerName = quote.customer?.name || quote.customerName || quote.customCustomerName || 'Cliente ocasional';
  const currency = quote.currency || 'NIO';
  const reportCurrency = quote.reportCurrency || 'NIO';
  const quoteFactor = Number(quote.total || 0) !== 0 && quote.reportTotal != null ? Number(quote.reportTotal) / Number(quote.total) : null;
  const lineEquivalent = (value: unknown) => quoteFactor == null ? 'No disponible' : formatMoney(Number(value || 0) * quoteFactor, reportCurrency, true);
  return {
    id: quote.id,
    number: quote.number || 'Sin número',
    title: 'Cotización',
    customerName,
    status: String(quote.status || ''),
    sourceLabel: quote.branchName || 'Sucursal no identificada',
    totalLabel: formatMoney(quote.total, currency, true),
    summaryDetails: [
      { label: 'Sucursal', value: quote.branchName || 'Sucursal no identificada' },
      { label: 'Moneda original', value: formatCurrencyDescriptor(currency) },
      { label: 'Equivalencia', value: quote.reportTotal == null ? 'No disponible' : formatMoney(quote.reportTotal, reportCurrency, true) },
      { label: 'Moneda de referencia', value: formatCurrencyDescriptor(reportCurrency) },
      { label: 'Moneda funcional', value: formatCurrencyDescriptor(quote.baseCurrency || 'NIO') },
      { label: 'Líneas', value: String(quote.items?.length || quote.itemCount || 0) },
    ],
    metadata: [
      { label: 'Fecha de emisión', value: formatDate(quote.date) },
      { label: 'Validez', value: formatDate(quote.expiryDate) },
      { label: 'Subtotal neto', value: formatMoney(quote.subtotal, currency) },
      { label: 'Impuestos', value: formatMoney(quote.taxAmount, currency) },
      { label: 'Descuento', value: formatMoney(quote.discountAmount, currency) },
      ...(additionalChargesLabel(quote) !== '—' ? [{ label: 'Cargos adicionales', value: additionalChargesLabel(quote) }] : []),
      { label: 'Total en moneda funcional', value: formatMoney(quote.baseTotal, quote.baseCurrency, true) },
      { label: 'Tasa utilizada', value: quote.reportRateLabel || '1:1' },
      { label: 'Fuente de tasa', value: quote.reportRateSource || '—' },
      { label: 'Tipo de valoración', value: quote.reportValuationLabel || 'Valor histórico' },
      { label: 'Fecha de tasa', value: formatDate(quote.reportRateEffectiveAt) },
    ],
    lines: (quote.items || []).map((item: any) => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity || 0),
      unitPriceLabel: `${formatMoney(item.unitPrice, currency)} · Equiv. ${lineEquivalent(item.unitPrice)}`,
      totalLabel: `${formatMoney(item.total, currency)} · Equiv. ${lineEquivalent(item.total)}`,
    })),
    notes: quote.notes,
    history: history || [],
  };
}

function managerSalesAuditEntity(entity?: string) {
  return ({ orders: 'SALES_ORDER', invoices: 'INVOICE', recurring: 'RECURRING_INVOICE', payments: 'PAYMENT_RECEIVED', creditnotes: 'CREDIT_NOTE', credits: 'INVOICE' } as Record<string, string>)[entity || ''] || 'INVOICE';
}

function buildManagerSalesDocumentPanel(document: any, entity: string, history?: any[]): SalesDocumentPanelData {
  const title = document.title || ({ orders: 'Orden de venta', invoices: 'Factura', recurring: 'Factura recurrente', payments: 'Pago recibido', creditnotes: 'Nota de crédito', credits: 'Crédito' } as Record<string, string>)[entity] || 'Documento';
  const customerName = document.customerName || document.customer?.name || document.customCustomerName || 'Cliente ocasional';
  const currency = document.currency || 'NIO';
  const reportCurrency = document.reportCurrency || 'NIO';
  const total = document.total ?? document.amount ?? 0;
  const status = document.status || (entity === 'payments' ? 'PAID' : '');
  const invoicedBy = document.invoicedByName || document.invoicedBy?.name || '—';
  const detailMoney = (original: unknown, equivalent: unknown = document.reportTotal) => `${formatMoney(original, currency, true)} · Equiv. ${equivalent == null ? 'No disponible' : formatMoney(equivalent, reportCurrency, true)}`;
  const documentFactor = Number(total || 0) !== 0 && document.reportTotal != null ? Number(document.reportTotal) / Number(total) : null;
  const lineEquivalent = (value: unknown) => documentFactor == null ? 'No disponible' : formatMoney(Number(value || 0) * documentFactor, reportCurrency, true);
  const summaryDetails = entity === 'orders'
    ? [{ label: 'Sucursal', value: document.branchName || 'Sucursal no identificada' }, { label: 'Artículos', value: formatNumber(document.items?.length || document.itemCount) }, { label: 'Total original / equivalencia', value: detailMoney(document.total) }, { label: 'Facturado por', value: invoicedBy }]
    : entity === 'invoices'
      ? [{ label: 'Sucursal', value: document.branchName || 'Sucursal no identificada' }, { label: 'Total neto', value: detailMoney(document.subtotal ?? document.total, document.reportSubtotal ?? document.reportTotal) }, { label: 'Saldo pendiente', value: detailMoney(document.balance, document.reportBalance) }]
      : entity === 'recurring'
        ? [{ label: 'Sucursal', value: document.branchName || 'Sucursal no identificada' }, { label: 'Frecuencia', value: statusLabel(document.frequency) }, { label: 'Monto de ciclo', value: detailMoney(total) }]
        : entity === 'payments'
          ? [{ label: 'Sucursal', value: document.branchName || 'Sucursal no identificada' }, { label: 'Monto original / equivalencia', value: detailMoney(document.amount, document.reportAmount) }, { label: 'Forma de pago', value: statusLabel(document.method) }, { label: 'Documento', value: document.invoice?.number || document.creditNote?.number || document.relatedInvoiceNumber || document.reference || 'Anticipo' }]
          : [{ label: 'Sucursal', value: document.branchName || 'Sucursal no identificada' }, { label: 'Saldo pendiente', value: detailMoney(document.balance, document.reportBalance) }, ...(document.relatedInvoiceNumber ? [{ label: 'Factura origen', value: document.relatedInvoiceNumber }] : [])];
  const chargeMetadata = additionalChargesLabel(document) !== '—' ? [{ label: 'Cargos adicionales', value: additionalChargesLabel(document) }] : [];
  const metadata = entity === 'orders'
    ? [{ label: 'Fecha de la orden', value: formatDate(document.date) }, { label: 'Entrega estimada', value: formatDate(document.expectedDelivery) }, { label: 'Forma de pago', value: statusLabel(document.paymentMethod) }, ...chargeMetadata, ...(document.relatedInvoiceNumber ? [{ label: 'Factura relacionada', value: document.relatedInvoiceNumber }] : [])]
    : entity === 'invoices'
      ? [{ label: 'Fecha de emisión', value: formatDate(document.date) }, { label: 'Fecha de vencimiento', value: formatDate(document.dueDate) }, { label: 'Subtotal neto', value: detailMoney(document.subtotal, document.reportSubtotal) }, { label: 'Impuestos', value: detailMoney(document.taxAmount, document.reportTaxAmount) }, { label: 'Descuento', value: detailMoney(document.discountAmount, document.reportDiscountAmount) }, ...chargeMetadata, { label: 'Forma de pago', value: statusLabel(document.paymentMethod) }, { label: 'Pagos registrados', value: formatNumber(document.paymentCount) }, ...(document.relatedOrderNumber ? [{ label: 'Orden relacionada', value: document.relatedOrderNumber }] : [])]
      : entity === 'recurring'
        ? [{ label: 'Fecha de inicio', value: formatDate(document.startDate) }, { label: 'Próxima fecha', value: formatDate(document.nextInvoiceDate) }, { label: 'Fecha final', value: formatDate(document.endDate) }, { label: 'Subtotal neto', value: detailMoney(document.subtotal, document.reportSubtotal) }, { label: 'Impuestos', value: detailMoney(document.taxAmount, document.reportTaxAmount) }]
        : entity === 'payments'
          ? [{ label: 'Fecha del pago', value: formatDate(document.date) }, { label: 'Monto original / equivalencia', value: detailMoney(document.amount, document.reportAmount) }, { label: 'Forma de pago', value: statusLabel(document.method) }, { label: 'Referencia', value: document.reference || 'Sin referencia' }, { label: 'Documento relacionado', value: document.invoice?.number || document.creditNote?.number || document.relatedInvoiceNumber || 'Anticipo' }, { label: 'Cuenta contable', value: document.account?.name || document.accountId || 'No especificada' }, { label: 'Banco', value: document.bankAccount?.bankName || document.bankAccountId || 'No especificado' }]
          : [{ label: 'Fecha', value: formatDate(document.date) }, { label: 'Fecha de vencimiento', value: formatDate(document.dueDate) }, { label: 'Subtotal neto', value: detailMoney(document.subtotal, document.reportSubtotal) }, { label: 'Impuestos', value: detailMoney(document.taxAmount, document.reportTaxAmount) }, { label: 'Monto aplicado', value: detailMoney(document.amountPaid, document.reportAmountPaid) }, ...(document.relatedInvoiceNumber ? [{ label: 'Factura origen', value: document.relatedInvoiceNumber }] : [])];
  const lines = entity === 'payments'
    ? [{ id: document.id, description: `Pago ${statusLabel(document.method)}${document.reference ? ` · Ref. ${document.reference}` : ''}`, quantity: 1, totalLabel: `${formatMoney(document.amount, currency, true)} · Equiv. ${formatMoney(document.reportAmount, reportCurrency, true)}` }]
    : (document.items || []).map((item: any) => ({ id: item.id, description: item.description || 'Artículo sin descripción', quantity: Number(item.quantity || 0), unitPriceLabel: `${formatMoney(item.unitPrice, currency)} · Equiv. ${lineEquivalent(item.unitPrice)}`, totalLabel: `${formatMoney(item.total, currency)} · Equiv. ${lineEquivalent(item.total)}` }));
  const currencyMetadata = [{ label: 'Moneda original', value: formatCurrencyDescriptor(currency) }, { label: 'Moneda de referencia', value: formatCurrencyDescriptor(reportCurrency) }, { label: 'Tasa utilizada', value: document.reportRateLabel || '1:1' }, { label: 'Fuente de tasa', value: quoteRateSourceLabel(document.reportRateSource) }, { label: 'Tipo de valoración', value: document.reportValuationLabel || 'Valor histórico' }, { label: 'Fecha de tasa', value: formatDate(document.reportRateEffectiveAt || document.date) }];
  return { id: document.id, number: document.number || 'Sin número', title, customerName, status: String(status), sourceLabel: document.branchName || 'Sucursal no identificada', totalLabel: detailMoney(total), summaryDetails, metadata: [...currencyMetadata, ...metadata], lines, notes: document.notes, reason: document.reason, history: history || [] };
}

function CustomerCard({ customer, onDetail, openingId }: { customer: any; onDetail?: (row: any) => void; openingId?: string | number | null }) {
  const isOpening = openingId != null && String(openingId) === String(customer.id);
  const status = customerStatusInfo(customer.status);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onDetail || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onDetail(customer);
  };
  return <Card role={onDetail ? 'button' : undefined} tabIndex={onDetail ? 0 : undefined} aria-label={onDetail ? `Ver detalle de ${customerValue(customer.name, 'cliente')}` : undefined} onClick={() => onDetail?.(customer)} onKeyDown={handleKeyDown} className={cn('rounded-2xl border-border/60 shadow-sm', onDetail && 'cursor-pointer transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40')}>
    <CardContent className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-black">{customerValue(customer.name, 'Cliente')}</p>
          <p className="mt-1 flex items-start gap-1.5 text-xs font-semibold text-primary"><Building2 className="mt-0.5 size-3.5 shrink-0" /><span className="break-words">{customerValue(customer.branchName, 'Sucursal no identificada')}</span></p>
        </div>
        <div className="flex shrink-0 items-center gap-2">{isOpening && <span role="status" className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-primary"><Loader2 className="size-3 animate-spin" /> Abriendo…</span>}<Badge variant="outline" className={cn('shrink-0 font-black', status.className)}>{status.label}</Badge></div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-lg bg-muted/40 px-2 py-1 font-mono font-bold">{customerValue(customer.code, customer.id?.slice(0, 8) || '—')}</span><Badge variant="secondary">{customerTypeLabel(customer.type)}</Badge></div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <CompactValue label="Cédula" value={customerValue(customer.taxId)} />
        <CompactValue label="RUC" value={customerValue(customer.ruc)} />
        <CompactValue label="Régimen fiscal" value={customerValue(customer.fiscalRegime)} />
        <CompactValue label="Departamento" value={customerValue(customer.department)} />
        <CompactValue label="Correo" value={customerValue(customer.email)} className="col-span-2" />
        <CompactValue label="Teléfono" value={customerValue(customer.phone)} />
      </div>
      {onDetail && <p className="border-t border-border/50 pt-3 text-[10px] font-black uppercase tracking-widest text-primary">Abrir detalle del cliente</p>}
    </CardContent>
  </Card>;
}

function ManagerCustomerDetailSheet({ groupId, customer, reportCurrency, onOpenChange, onEnterBranch, canEnterBranch = false, onExportHistory, exportingHistory = false }: { groupId: string; customer: any | null; reportCurrency: string; onOpenChange: (open: boolean) => void; onEnterBranch?: (groupId: string, branchId: string) => Promise<void>; canEnterBranch?: boolean; onExportHistory?: () => void; exportingHistory?: boolean }) {
  const [activeTab, setActiveTab] = useState<'general' | 'facturas' | 'historial'>('general');
  const [detail, setDetail] = useState<ManagerCustomerDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const customerId = String(customer?.id || '');
    if (!customerId) {
      setDetail(null);
      setError(null);
      setLoading(false);
      setActiveTab('general');
      return;
    }

    const controller = new AbortController();
    setDetail(null);
    setError(null);
    setLoading(true);
    setActiveTab('general');
    void enterpriseGroupsService.getSalesCustomerDetail(groupId, customerId, reportCurrency, controller.signal)
      .then((response) => setDetail(response))
      .catch((cause: any) => {
        if (!controller.signal.aborted) setError(cause?.message || 'No se pudo cargar el detalle del cliente');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [customer?.id, groupId, reportCurrency]);

  const record = detail?.customer ?? customer;
  const status = customerStatusInfo(record?.status);
  const invoices = detail?.invoices || [];
  const transactions = detail?.transactions || [];
  const duplicateCustomers = detail?.duplicateCustomers || [];
  const recordBranchId = String(record?.branchId || '');

  return <Sheet open={Boolean(customer)} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="flex w-full min-w-0 flex-col gap-0 overflow-hidden border-l border-border/50 bg-background p-0 sm:max-w-3xl">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'general' | 'facturas' | 'historial')} className="flex min-h-0 flex-1 flex-col gap-0">
        <SheetHeader className="sticky top-0 z-10 space-y-3 border-b border-border/50 bg-background/95 px-6 py-5 backdrop-blur-md">
          <div className="flex items-start gap-4 pr-8">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-base font-black text-primary shadow-inner">{String(record?.name || '?').charAt(0).toUpperCase()}</div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="truncate text-lg font-black uppercase tracking-tight text-foreground">{customerValue(record?.name, 'Detalle del cliente')}</SheetTitle>
                {record && <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-wider', status.className)}>{status.label}</Badge>}
              </div>
              <SheetDescription className="flex flex-wrap items-center gap-2 text-xs"><span className="font-mono font-bold">{customerValue(record?.code, record?.id?.slice(0, 8) || '—')}</span><span>·</span><span>{customerTypeLabel(record?.type)}</span><span>·</span><span className="font-semibold text-primary">{customerValue(record?.branchName, 'Sucursal no identificada')}</span></SheetDescription>
            </div>
          </div>
          <div className="flex justify-end" data-tour="manager-customer-detail-actions">
            <PdfDownloadButton
              label="Exportar"
              includeRoll={false}
              showStandardOptions={false}
              onDownload={() => undefined}
              firstOption={{ label: 'Historial de transacciones', description: 'Todas las operaciones del cliente', onSelect: () => onExportHistory?.() }}
              disabled={!customer || loading || exportingHistory || transactions.length === 0}
            />
          </div>
          <TabsList className="h-9 w-full justify-start overflow-x-auto rounded-xl border border-border/40 bg-muted/40 p-1 text-xs font-bold">
            <TabsTrigger value="general" className="gap-1.5 rounded-lg px-3 py-1 text-xs font-bold"><UserRound className="size-3.5" /> General</TabsTrigger>
            <TabsTrigger value="facturas" className="gap-1.5 rounded-lg px-3 py-1 text-xs font-bold"><FileText className="size-3.5" /> Facturas ({invoices.length})</TabsTrigger>
            <TabsTrigger value="historial" className="gap-1.5 rounded-lg px-3 py-1 text-xs font-bold"><History className="size-3.5" /> Historial ({transactions.length})</TabsTrigger>
          </TabsList>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1 overflow-hidden">
          <div className="space-y-5 p-6">
            {error && <Card className="flex items-center gap-3 rounded-2xl border-destructive/20 bg-destructive/10 p-4 text-destructive"><Activity className="size-5 shrink-0" /><p className="text-xs font-bold">{error}</p></Card>}
            <TabsContent value="general" className="mt-0 space-y-5 outline-none">
              <Card className="rounded-2xl border-primary/20 bg-primary/5 p-5 shadow-sm"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><InfoField label="Código automático" value={customerValue(record?.code, record?.id?.slice(0, 8) || '—')} icon={FileText} mono /><InfoField label="Sucursal de origen" value={customerValue(record?.branchName)} icon={Building2} /><InfoField label="Tipo de cliente" value={customerTypeLabel(record?.type)} icon={record?.type === 'INDIVIDUAL' ? UserRound : Building2} /><InfoField label="Registrado" value={formatDate(record?.createdAt)} icon={Calendar} /></div></Card>
              <DetailSection title="Identificación y régimen fiscal" icon={FileText}><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><InfoField label="Cédula" value={customerValue(record?.taxId)} icon={FileText} mono muted={!record?.taxId} /><InfoField label="RUC" value={customerValue(record?.ruc)} icon={FileText} mono muted={!record?.ruc} /><InfoField label="DV del RUC" value={customerValue(record?.dv)} icon={FileText} mono muted={!record?.dv} /><InfoField label="Régimen fiscal" value={customerValue(record?.fiscalRegime)} icon={FileText} muted={!record?.fiscalRegime} /><InfoField label="Razón social" value={customerValue(record?.razonSocial)} icon={Building2} muted={!record?.razonSocial} /></div></DetailSection>
              <DetailSection title="Contacto" icon={Mail}><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><InfoField label="Correo electrónico" value={customerValue(record?.email)} icon={Mail} muted={!record?.email} /><InfoField label="Teléfono" value={customerValue(record?.phone)} icon={Phone} muted={!record?.phone} /><InfoField label="Persona de contacto" value={customerValue(record?.contactName)} icon={UserRound} muted={!record?.contactName} /><InfoField label="Correo del contacto" value={customerValue(record?.contactEmail)} icon={Mail} muted={!record?.contactEmail} /><InfoField label="Teléfono del contacto" value={customerValue(record?.contactPhone)} icon={Phone} muted={!record?.contactPhone} /></div></DetailSection>
              <DetailSection title="Ubicación" icon={MapPin}><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><InfoField label="Departamento" value={customerValue(record?.department)} icon={MapPin} muted={!record?.department} /><InfoField label="Ciudad" value={customerValue(record?.city)} icon={MapPin} muted={!record?.city} /><InfoField label="Dirección" value={customerValue(record?.address)} icon={MapPin} muted={!record?.address} /><InfoField label="País" value={customerValue(record?.country)} icon={MapPin} muted={!record?.country} /></div></DetailSection>
              {record?.notes && <Card className="rounded-2xl border-border/60 p-5 shadow-sm"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notas</p><p className="mt-2 break-words text-sm leading-6 text-muted-foreground">{record.notes}</p></Card>}
              <DuplicateCustomerSection matches={duplicateCustomers} loading={loading} hasIdentifiers={Boolean(record?.taxId || record?.ruc)} />
            </TabsContent>
            <TabsContent value="facturas" className="mt-0 outline-none"><ManagerCustomerInvoices invoices={invoices} loading={loading} reportCurrency={reportCurrency} /></TabsContent>
            <TabsContent value="historial" className="mt-0 outline-none"><ManagerCustomerHistory transactions={transactions} loading={loading} reportCurrency={reportCurrency} /></TabsContent>
          </div>
        </ScrollArea>
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 bg-background/95 px-6 py-3 backdrop-blur-md"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Consulta de solo lectura</p><div className="flex flex-wrap items-center justify-end gap-2">{onEnterBranch && canEnterBranch && recordBranchId && <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); void onEnterBranch(groupId, recordBranchId); }} className="gap-1.5 rounded-xl text-xs font-bold text-primary hover:text-primary"><Building2 className="size-3.5" /> Ir a su sucursal <ArrowUpRight className="size-3.5" /></Button>}<Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="gap-1.5 rounded-xl text-xs font-bold">Cerrar <ChevronRight className="size-3" /></Button></div></div>
      </Tabs>
    </SheetContent>
  </Sheet>;
}

function DuplicateCustomerSection({ matches, loading, hasIdentifiers }: { matches: any[]; loading: boolean; hasIdentifiers: boolean }) {
  return <Card className={cn('space-y-4 rounded-2xl p-5 shadow-sm', matches.length ? 'border-amber-500/30 bg-amber-500/5' : 'border-border/60 bg-card')}>
    <div className="flex items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/80"><CheckCircle2 className={cn('size-4', matches.length ? 'text-amber-500' : 'text-primary')} /> Coincidencias entre sucursales</h3><p className="mt-1 text-[11px] text-muted-foreground">Se comparan Cédula y RUC dentro de las sucursales visibles para este Manager.</p></div>{loading ? <Skeleton className="h-6 w-24 rounded-full" /> : <Badge variant="outline" className="shrink-0 text-[9px] font-black">{matches.length ? `${matches.length} coincidencia(s)` : 'Sin coincidencias'}</Badge>}</div>
    {loading ? <div className="space-y-2"><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-12 w-full rounded-xl" /></div> : !hasIdentifiers ? <p className="rounded-xl border border-dashed border-border/50 p-4 text-xs text-muted-foreground">Este cliente no tiene Cédula ni RUC para realizar la comparación.</p> : matches.length === 0 ? <p className="rounded-xl border border-dashed border-border/50 p-4 text-xs text-muted-foreground">No se encontró otro registro con la misma Cédula o RUC en las sucursales visibles.</p> : <div className="space-y-2">{matches.map((match) => <div key={match.id} className="flex items-start justify-between gap-3 rounded-xl border border-amber-500/20 bg-background/60 p-3"><div className="min-w-0"><p className="truncate text-xs font-black">{customerValue(match.name, 'Cliente')}</p><p className="mt-1 flex items-start gap-1.5 text-[11px] font-semibold text-primary"><Building2 className="mt-0.5 size-3 shrink-0" />{customerValue(match.branchName, 'Sucursal no identificada')}</p></div><div className="shrink-0 text-right"><Badge variant="secondary" className="text-[9px]">Coincide por {(match.matchedBy || []).join(' y ') || 'identificación'}</Badge><p className="mt-1 font-mono text-[10px] text-muted-foreground">{customerValue(match.code, '—')}</p></div></div>)}</div>}
  </Card>;
}

function ManagerCustomerInvoices({ invoices, loading, reportCurrency }: { invoices: any[]; loading: boolean; reportCurrency: string }) {
  if (loading) return <div className="space-y-2"><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-12 w-full rounded-xl" /></div>;
  if (!invoices.length) return <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 px-5 text-center"><FileText className="size-8 text-muted-foreground/40" /><p className="mt-3 font-black">Sin facturas registradas</p><p className="mt-1 text-xs text-muted-foreground">Este cliente aún no registra facturas de venta en su sucursal.</p></div>;
  return <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm"><div className="hidden overflow-x-auto xl:block"><Table className="min-w-[800px]"><TableHeader><TableRow><TableHead>Factura</TableHead><TableHead>Fecha</TableHead><TableHead>Vencimiento</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Total original / equivalencia</TableHead></TableRow></TableHeader><TableBody>{invoices.map((invoice) => <TableRow key={invoice.id}><TableCell className="font-mono text-xs font-bold">{customerValue(invoice.number, 'Sin número')}</TableCell><TableCell className="text-xs text-muted-foreground">{formatDate(invoice.date)}</TableCell><TableCell className="text-xs text-muted-foreground">{formatDate(invoice.dueDate)}</TableCell><TableCell><Badge variant="outline" className="text-[9px] font-black">{statusLabel(invoice.status)}</Badge></TableCell><TableCell className="text-right"><MoneyPair row={invoice} original={invoice.total} equivalent={invoice.reportTotal} reportCurrency={reportCurrency} compact /></TableCell></TableRow>)}</TableBody></Table></div><div className="space-y-3 p-3 xl:hidden">{invoices.map((invoice) => <article key={invoice.id} className="rounded-xl border border-border/50 bg-muted/10 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-sm font-black">{customerValue(invoice.number, 'Sin número')}</p><p className="mt-1 text-[11px] text-muted-foreground">{formatDate(invoice.date)} · Vence {formatDate(invoice.dueDate)}</p></div><Badge variant="outline" className="shrink-0 text-[9px] font-black">{statusLabel(invoice.status)}</Badge></div><div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total original</span><MoneyPair row={invoice} original={invoice.total} equivalent={invoice.reportTotal} reportCurrency={reportCurrency} compact /></div></article>)}</div></Card>;
}

function ManagerCustomerHistory({ transactions, loading, reportCurrency }: { transactions: ManagerCustomerDetailResponse['transactions']; loading: boolean; reportCurrency: string }) {
  return <Card className="rounded-2xl border-border/60 bg-card p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/80"><Activity className="size-4 text-primary" /> Operaciones relacionadas</h3><p className="mt-1 text-[11px] text-muted-foreground">Cotizaciones, órdenes, facturas, pagos y notas vinculadas a este cliente.</p></div><Badge variant="outline" className="shrink-0 text-[9px] font-black">{loading ? '…' : transactions.length}</Badge></div>{loading ? <div className="mt-4 space-y-2"><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-12 w-full rounded-xl" /></div> : transactions.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-border/50 p-4 text-xs text-muted-foreground">Aún no hay operaciones comerciales registradas para este cliente.</p> : <div className="mt-4 divide-y divide-border/40 rounded-xl border border-border/50">{transactions.slice(0, 50).map((transaction) => <div key={`${transaction.kind}-${transaction.id}`} className="flex items-center justify-between gap-3 p-3"><div className="flex min-w-0 items-center gap-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground"><FileText className="size-4" /></div><div className="min-w-0"><p className="truncate text-xs font-bold">{transaction.kind}</p><p className="truncate font-mono text-[10px] text-muted-foreground">{customerValue(transaction.number, 'Sin número')}{transaction.description ? ` · ${transaction.description}` : ''}</p></div></div><div className="shrink-0 text-right"><p className="text-[10px] font-bold text-muted-foreground">{formatDate(transaction.date)}</p><p className="text-[10px] font-black">{transaction.amount == null ? statusLabel(transaction.status) : formatMoney(transaction.amount, transaction.currency)}</p>{transaction.amount != null && <p className="text-[9px] font-bold text-primary">Equiv. {transaction.reportAmount == null ? 'No disponible' : formatMoney(transaction.reportAmount, reportCurrency, true)}</p>}<p className="text-[9px] text-muted-foreground">{statusLabel(transaction.status)}</p></div></div>)}</div>}</Card>;
}

function DetailSection({ title, icon: Icon, children }: { title: string; icon: typeof FileText; children: ReactNode }) {
  return <Card className="space-y-4 rounded-2xl border-border/60 bg-card p-5 shadow-sm"><h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/80"><Icon className="size-4 text-primary" />{title}</h3>{children}</Card>;
}

function InfoField({ label, value, icon: Icon, mono = false, muted = false }: { label: string; value: string; icon: typeof FileText; mono?: boolean; muted?: boolean }) {
  return <div className="min-w-0"><p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground"><Icon className="size-3" />{label}</p><p className={cn('mt-1 break-words text-sm font-semibold', mono && 'font-mono text-xs', muted ? 'text-muted-foreground/60' : 'text-foreground')}>{value}</p></div>;
}

function CompactValue({ label, value, className }: { label: string; value: string; className?: string }) {
  return <div className={cn('min-w-0', className)}><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-1 break-words text-xs font-semibold">{value}</p></div>;
}

function cashSummaryExportRow(row: any, reportCurrency: string) {
  return { Caja: row.registerName, Código: row.registerCode, Sucursal: row.branchName, Sesiones: row.sessions, Facturas: row.invoices, 'Facturado equivalente': formatMoney(row.reportBilled, reportCurrency, true), 'Monto esperado equivalente': formatMoney(row.reportExpectedAmountNIO, reportCurrency, true), 'Diferencia equivalente': formatMoney(row.reportDifferenceNIO, reportCurrency, true) };
}

function exportRow(view: ManagerSalesView, row: any, reportCurrency: string) {
  const currency = row.currency || 'NIO';
  const rateContext = { 'Tasa utilizada': row.reportRateLabel || '1:1', 'Fuente de tasa': quoteRateSourceLabel(row.reportRateSource), 'Fecha de tasa': formatDate(row.reportRateEffectiveAt || row.date || row.openedAt) };
  const base = { Sucursal: row.branchName, Fecha: formatDate(row.date || row.openedAt || row.nextInvoiceDate), Estado: statusLabel(row.status || row.deliveryStatus), ...rateContext };
  if (view === 'customers') return { Código: row.code, Cliente: row.name, Tipo: customerTypeLabel(row.type), Cédula: row.taxId, RUC: row.ruc, 'Régimen fiscal': row.fiscalRegime, Correo: row.email, Teléfono: row.phone, Departamento: row.department, Estado: customerStatusInfo(row.status).label, Sucursal: row.branchName };
  if (view === 'payments') return { Pago: row.number, Cliente: row.customerName, Método: row.method, Documento: row.documentNumber, 'Monto original': formatMoney(row.amount, currency, true), Equivalencia: row.reportAmount == null ? 'No disponible' : formatMoney(row.reportAmount, reportCurrency, true), ...base };
  if (view === 'cash') return { Caja: row.registerName, Código: row.registerCode, Apertura: formatDate(row.openedAt, true), Cierre: formatDate(row.closedAt, true), 'Abrió': row.openedByName, 'Cerró': row.closedByName, Facturas: row.invoiceCount, 'Diferencia original': formatMoney(row.differenceNIO, 'NIO', true), Equivalencia: row.reportDifferenceNIO == null ? 'No disponible' : formatMoney(row.reportDifferenceNIO, reportCurrency, true), ...base };
  if (view === 'deliveries') return { Entrega: row.number, Cliente: row.customerName, Facturación: row.billingBranchName, 'Entrega en': row.deliveryBranchName, Factura: row.invoiceNumber, Artículos: row.itemCount, Cobro: statusLabel(row.paymentStatus), 'Monto original': formatMoney(row.total, currency, true), Equivalencia: row.reportTotal == null ? 'No disponible' : formatMoney(row.reportTotal, reportCurrency, true), ...base };
  if (view === 'pricelists') return row.productName ? { Lista: row.listName, Código: row.listCode, Sucursal: row.branchName, SKU: row.productCode, Producto: row.productName, Variante: row.variantName, 'Precio original': formatMoney(row.price, currency, true), 'Costo referencia': formatMoney(row.costPrice, currency, true), Equivalencia: row.reportPrice == null ? 'No disponible' : formatMoney(row.reportPrice, reportCurrency, true), 'Tasa aplicada': row.reportRateLabel || '—', Estado: statusLabel(row.listActive ? 'ACTIVE' : 'INACTIVE'), Actualizada: formatDate(row.updatedAt) } : { Código: row.code, Lista: row.name, Sucursal: row.branchName, Productos: row.itemCount, 'Precios en': row.currencies?.join(' / ') || row.currency, Predeterminada: row.isDefault ? 'Sí' : 'No', Estado: statusLabel(row.isActive ? 'ACTIVE' : 'INACTIVE'), Actualizada: formatDate(row.updatedAt) };
  return { Número: row.number, Cliente: row.customerName, 'Total original': formatMoney(row.total, currency, true), Equivalencia: row.reportTotal == null ? 'No disponible' : formatMoney(row.reportTotal, reportCurrency, true), 'Cargos adicionales': additionalChargesLabel(row), 'Saldo original': row.balance == null ? '—' : formatMoney(row.balance, currency, true), 'Saldo equivalente': row.reportBalance == null ? '—' : formatMoney(row.reportBalance, reportCurrency, true), ...base };
}

function Pagination({ page, totalPages, total, pageSize, onPageChange, onPageSizeChange }: { page: number; totalPages: number; total: number; pageSize: number; onPageChange: (page: number) => void; onPageSizeChange: (pageSize: number) => void }) { return <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">{formatNumber(total)} registro(s) · Página {page} de {totalPages}</span><div className="flex flex-wrap items-center gap-2"><select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-9 rounded-lg border border-border bg-background px-2 text-xs"><option value={25}>25 por página</option><option value={50}>50 por página</option><option value={100}>100 por página</option></select><Button variant="outline" size="icon" className="size-9 rounded-lg" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Página anterior"><ChevronLeft className="size-4" /></Button><Button variant="outline" size="icon" className="size-9 rounded-lg" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Página siguiente"><ChevronRight className="size-4" /></Button></div></div>; }

function LoadingState() { return <div className="flex min-h-[240px] items-center justify-center rounded-3xl border border-border/60 bg-card text-muted-foreground"><RefreshCw className="mr-2 size-5 animate-spin" />Cargando información...</div>; }
function EmptyState({ title, description }: { title: string; description: string }) { return <div className="flex min-h-[180px] flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-card px-5 text-center"><Users className="size-8 text-muted-foreground/40" /><p className="mt-3 font-black">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>; }
