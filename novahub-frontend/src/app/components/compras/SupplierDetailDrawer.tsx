import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Activity,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
  FileText,
  History,
  Mail,
  MapPin,
  Phone,
  ReceiptText,
  Truck,
  User,
  Loader2,
} from 'lucide-react';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '../ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Skeleton } from '../ui/skeleton';
import {
  expensesService,
  purchaseOrdersService,
  recurringExpensesService,
  supplierInvoicesService,
} from '../../services/compras.service';
import { suppliersService } from '../../services/compras.service';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import type { Supplier } from '../../types';
import { cn } from '../ui/utils';
import { getSupplierDebtAmount, getSupplierFavorAmount } from '../../utils/supplierBalance';
import { generateSupplierHistoryPDF } from '../../utils/pdfGenerator';
import { fetchSupplierHistoryItems, type SupplierHistoryItem } from '../../utils/supplierHistory';
import { formatCurrencyAmount } from '../../utils/currency';
import { toast } from 'sonner';

interface SupplierDetailDrawerProps {
  supplierId: string | null;
  supplierSnapshot?: Supplier | null;
  onOpenChange: (open: boolean) => void;
}

type SupplierTab = 'general' | 'historial';
type HistoryExportScope = 'ALL' | 'FILTERED';
type HistoryExportCurrency = 'NIO' | 'USD';

type SupplierTransaction = {
  id: string;
  type: string;
  number: string;
  date?: string;
  status?: string;
  amount: number;
  currency?: string;
  exchangeRate?: number;
};

const unwrap = (response: any): any => response?.data?.data ?? response?.data ?? response;

const toList = (response: any): any[] => {
  const value = unwrap(response);
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.items)) return value.items;
  return [];
};

const statusInfo = (supplier?: Supplier | null) => {
  const inactive = (supplier as any)?.isActive === false || String((supplier as any)?.status || '').toUpperCase() === 'INACTIVE';
  return inactive
    ? { label: 'Inactivo', className: 'bg-muted/20 text-muted-foreground border-border/40' }
    : { label: 'Activo', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' };
};

const typeInfo = (type?: string) => String(type || 'COMPANY').toUpperCase() === 'INDIVIDUAL'
  ? { label: 'Individual', icon: User }
  : { label: 'Empresa', icon: Building2 };

const transactionStatus = (status?: string) => {
  const normalized = String(status || '').toUpperCase();
  const labels: Record<string, string> = {
    DRAFT: 'Borrador',
    SENT: 'Enviada',
    CONFIRMED: 'Confirmada',
    APPROVED: 'Aprobada',
    PAID: 'Pagada',
    PARTIAL: 'Pago parcial',
    CANCELLED: 'Anulada',
    ACTIVE: 'Activa',
    PAUSED: 'Pausada',
  };
  return labels[normalized] || status || 'Registrado';
};

export function SupplierDetailDrawer({
  supplierId,
  supplierSnapshot,
  onOpenChange,
}: SupplierDetailDrawerProps) {
  const { baseCurrency, formatConvertedAmount, convertBetweenCurrencies, exchangeRate } = useCurrency();
  const { user } = useAuth();
  const { themeConfig } = useTheme();
  const [activeTab, setActiveTab] = useState<SupplierTab>('general');
  const [detail, setDetail] = useState<Supplier | null>(supplierSnapshot || null);
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [exportingHistory, setExportingHistory] = useState(false);
  const [historyExportDialogOpen, setHistoryExportDialogOpen] = useState(false);
  const [historyExportScope, setHistoryExportScope] = useState<HistoryExportScope>('ALL');
  const [historyExportFilter, setHistoryExportFilter] = useState('ALL');
  const [historyExportCurrency, setHistoryExportCurrency] = useState<HistoryExportCurrency>(baseCurrency);
  const [historyExportItems, setHistoryExportItems] = useState<SupplierHistoryItem[]>([]);
  const [historyExportLoading, setHistoryExportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supplierId) {
      setDetail(null);
      setTransactions([]);
      setHistoryExportItems([]);
      setHistoryExportDialogOpen(false);
      setError(null);
      setActiveTab('general');
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setDetail(supplierSnapshot || null);
    setActiveTab('general');
    setError(null);
    setLoading(true);
    setLoadingTransactions(true);

    void Promise.allSettled([
      suppliersService.getById(supplierId),
      purchaseOrdersService.getAll({ supplierId, page: 1, pageSize: 50 } as any, controller.signal),
      supplierInvoicesService.getAll({ supplierId, page: 1, pageSize: 50 } as any, controller.signal),
      expensesService.getAll({ supplierId, page: 1, pageSize: 50 } as any, controller.signal),
      recurringExpensesService.getAll({ supplierId, page: 1, pageSize: 50 } as any, controller.signal),
    ]).then(([supplierResult, ordersResult, invoicesResult, expensesResult, recurringResult]) => {
      if (cancelled) return;

      if (supplierResult.status === 'fulfilled') {
        const value = unwrap(supplierResult.value);
        if (value?.id) setDetail(value);
      } else if (!supplierSnapshot) {
        setError('No se pudo cargar el detalle del proveedor.');
      }
      setLoading(false);

      const nextTransactions: SupplierTransaction[] = [];
      if (ordersResult.status === 'fulfilled') {
        toList(ordersResult.value).forEach((item: any) => nextTransactions.push({
          id: `order-${item.id}`,
          type: 'Orden de compra',
          number: item.number || 'Sin número',
          date: item.date || item.createdAt,
          status: item.status,
          amount: Number(item.total || 0),
          currency: item.currency,
          exchangeRate: item.exchangeRate,
        }));
      }
      if (invoicesResult.status === 'fulfilled') {
        toList(invoicesResult.value).forEach((item: any) => nextTransactions.push({
          id: `invoice-${item.id}`,
          type: 'Factura de proveedor',
          number: item.number || 'Sin número',
          date: item.date || item.createdAt,
          status: item.status,
          amount: Number(item.total || 0),
          currency: item.currency,
          exchangeRate: item.exchangeRate,
        }));
      }
      if (expensesResult.status === 'fulfilled') {
        toList(expensesResult.value).forEach((item: any) => nextTransactions.push({
          id: `expense-${item.id}`,
          type: 'Gasto',
          number: item.number || item.category || 'Gasto',
          date: item.date || item.createdAt,
          status: item.status,
          amount: Number(item.amount || 0),
          currency: item.currency,
          exchangeRate: item.exchangeRate,
        }));
      }
      if (recurringResult.status === 'fulfilled') {
        toList(recurringResult.value).forEach((item: any) => nextTransactions.push({
          id: `recurring-${item.id}`,
          type: 'Gasto recurrente',
          number: item.description || 'Gasto recurrente',
          date: item.startDate || item.createdAt,
          status: item.status,
          amount: Number(item.amount || 0),
          currency: item.currency,
          exchangeRate: item.exchangeRate,
        }));
      }
      nextTransactions.sort((left, right) => new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime());
      setTransactions(nextTransactions);
      setLoadingTransactions(false);
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [supplierId, supplierSnapshot]);

  const supplier = detail ?? supplierSnapshot ?? null;
  const isOpen = Boolean(supplierId);
  const currentStatus = statusInfo(supplier);
  const currentType = typeInfo(supplier?.type);
  const TypeIcon = currentType.icon;
  const supplierDebt = getSupplierDebtAmount(supplier);
  const supplierFavor = getSupplierFavorAmount(supplier);
  const totalCommitted = useMemo(() => transactions.reduce(
    (sum, item) => sum + convertBetweenCurrencies(item.amount, item.currency, baseCurrency, item.exchangeRate, item.exchangeRate),
    0,
  ), [baseCurrency, convertBetweenCurrencies, transactions]);
  const orderCount = transactions.filter((item) => item.type === 'Orden de compra').length;
  const invoiceCount = transactions.filter((item) => item.type === 'Factura de proveedor').length;
  const historyExportTypeOptions = Array.from(new Set(historyExportItems.map((item) => item.type).filter(Boolean)));
  const selectedHistoryItems = historyExportScope === 'FILTERED' && historyExportFilter !== 'ALL'
    ? historyExportItems.filter((item) => item.type === historyExportFilter)
    : historyExportItems;

  const openHistoryExportDialog = () => {
    if (!supplier || exportingHistory) return;
    setHistoryExportScope('ALL');
    setHistoryExportFilter('ALL');
    setHistoryExportCurrency(baseCurrency);
    setHistoryExportItems([]);
    setHistoryExportDialogOpen(true);
    setHistoryExportLoading(true);
    void fetchSupplierHistoryItems(supplier.id)
      .then((items) => setHistoryExportItems(items))
      .catch((error: any) => {
        setHistoryExportItems([]);
        toast.error(error?.message || 'No se pudo cargar el historial del proveedor.');
      })
      .finally(() => setHistoryExportLoading(false));
  };

  const confirmHistoryExport = async () => {
    if (!supplier || exportingHistory || historyExportLoading) return;
    if (!selectedHistoryItems.length) {
      toast.info('Este proveedor todavía no tiene transacciones para descargar.');
      return;
    }
    const exportToastId = toast.loading('Generando historial del proveedor...');
    setHistoryExportDialogOpen(false);
    setExportingHistory(true);
    try {
      const outputItems = selectedHistoryItems.map((item) => ({
        ...item,
        unitPrice: Number(convertBetweenCurrencies(Number(item.unitPrice || 0), item.currency, historyExportCurrency, item.exchangeRate, exchangeRate).toFixed(2)),
        total: Number(convertBetweenCurrencies(Number(item.total || 0), item.currency, historyExportCurrency, item.exchangeRate, exchangeRate).toFixed(2)),
        currency: historyExportCurrency,
        exchangeRate: 1,
      }));
      await generateSupplierHistoryPDF({
        supplier,
        items: outputItems,
        tenantName: user?.sessionBranding?.name || user?.tenantName || 'Nuestra Empresa',
        tenantLogo: themeConfig?.logo,
        formatAmount: (amount: number, currency?: string) => formatCurrencyAmount(amount, currency, true),
        outputCurrency: historyExportCurrency,
      });
      toast.success('Historial del proveedor descargado', { id: exportToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo descargar el historial del proveedor.', { id: exportToastId });
    } finally {
      setExportingHistory(false);
    }
  };

  return (
    <>
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="supplier-detail-panel flex w-full flex-col gap-0 overflow-hidden border-l border-border/50 bg-background p-0 sm:max-w-3xl">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SupplierTab)} className="flex min-h-0 flex-1 flex-col gap-0">
          <SheetHeader className="sticky top-0 z-10 space-y-3 border-b border-border/50 bg-background/95 px-6 py-4 backdrop-blur-md" data-tour="supplier-detail-title">
            <div className="flex items-start gap-4 pr-8">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-base font-black text-primary shadow-inner">
                {String(supplier?.name || '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="truncate text-lg font-black uppercase tracking-tight text-foreground">
                    {supplier?.name || 'Cargando…'}
                  </SheetTitle>
                  {supplier && <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-wider', currentStatus.className)}>{currentStatus.label}</Badge>}
                  <Badge variant="outline" className="border-primary/20 bg-primary/10 text-[9px] font-black uppercase tracking-wider text-primary">
                    <TypeIcon className="mr-1 size-3" /> {currentType.label}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground">
                  <span className="font-bold">{supplier?.code || supplier?.id?.slice(0, 8) || '—'}</span>
                  {supplier?.createdAt && <span className="flex items-center gap-1 font-sans text-[11px]"><Calendar className="size-3" /> Registrado {format(new Date(supplier.createdAt), 'dd MMM yyyy', { locale: es })}</span>}
                  {(loading || loadingTransactions) && <span role="status" className="inline-flex items-center gap-1 font-sans text-[10px] font-bold text-primary"><Loader2 className="size-3 animate-spin" /> Cargando detalle…</span>}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2" data-tour="supplier-detail-actions">
              {supplier && <Button type="button" variant="outline" onClick={openHistoryExportDialog} disabled={exportingHistory} className="max-w-full gap-1.5 rounded-xl text-xs font-bold">
                <Download className="size-4 shrink-0 text-primary" />
                <span className="truncate">Exportar historial del proveedor</span>
              </Button>}
            </div>
            <TabsList className="h-9 w-full justify-start overflow-x-auto rounded-xl border border-border/40 bg-muted/40 p-1 font-bold text-xs">
              <TabsTrigger value="general" className="gap-1.5 rounded-lg px-3 py-1 text-xs font-bold"><Truck className="size-3.5" /> General</TabsTrigger>
              <TabsTrigger value="historial" className="gap-1.5 rounded-lg px-3 py-1 text-xs font-bold"><History className="size-3.5" /> Historial ({transactions.length})</TabsTrigger>
            </TabsList>
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1 overflow-hidden">
            <div className="space-y-6 p-6" data-tour="supplier-detail-data">
              {error && <Card className="flex items-center gap-3 border-destructive/20 bg-destructive/10 p-4 text-destructive"><Activity className="size-5 shrink-0" /><p className="text-xs font-bold">{error}</p></Card>}

              <TabsContent value="general" className="mt-0 space-y-6 outline-none">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                  <MetricCard label="Saldo pendiente" value={formatConvertedAmount(supplierDebt, baseCurrency)} icon={CircleDollarSign} accent="text-rose-600 dark:text-rose-400" loading={loading} />
                  <MetricCard label="Saldo a favor" value={formatConvertedAmount(supplierFavor, baseCurrency)} icon={Banknote} accent="text-emerald-600 dark:text-emerald-400" loading={loading} />
                  <MetricCard label="Órdenes" value={String(orderCount)} icon={ReceiptText} accent="text-primary" loading={loadingTransactions} />
                  <MetricCard label="Facturas" value={String(invoiceCount)} icon={FileText} accent="text-primary" loading={loadingTransactions} />
                  <MetricCard label="Estado" value={currentStatus.label} icon={CheckCircle2} accent={currentStatus.label === 'Activo' ? 'text-emerald-500' : 'text-muted-foreground'} loading={loading} />
                </div>

                <Card className="space-y-4 rounded-2xl border-border/60 bg-card p-5 shadow-sm">
                  <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/80"><MapPin className="size-4 text-primary" /> Contacto y ubicación</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <InfoField label="Correo electrónico" value={supplier?.email || 'Sin correo'} icon={Mail} muted={!supplier?.email} />
                    <InfoField label="Teléfono" value={supplier?.phone || 'Sin teléfono'} icon={Phone} muted={!supplier?.phone} />
                    <InfoField label="Persona de contacto" value={supplier?.contactName || 'Sin contacto'} icon={User} muted={!supplier?.contactName} />
                    <InfoField label="Dirección" value={supplier?.address || 'Sin dirección'} icon={MapPin} muted={!supplier?.address} />
                    <InfoField label="Ciudad" value={supplier?.city || 'Sin ciudad'} icon={MapPin} muted={!supplier?.city} />
                    <InfoField label="País" value={supplier?.country || 'Sin país'} icon={MapPin} muted={!supplier?.country} />
                  </div>
                </Card>

                <Card className="space-y-4 rounded-2xl border-border/60 bg-card p-5 shadow-sm">
                  <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/80"><FileText className="size-4 text-primary" /> Información comercial</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <InfoField label="Código interno" value={supplier?.code || '—'} icon={Truck} mono />
                    <InfoField label="RUC / identificación" value={supplier?.ruc || supplier?.taxId || 'No registrado'} icon={FileText} mono muted={!supplier?.ruc && !supplier?.taxId} />
                    <InfoField label="Condiciones de pago" value={supplier?.paymentTerms || 'No configuradas'} icon={Clock3} muted={!supplier?.paymentTerms} />
                    <InfoField label="Total relacionado" value={formatConvertedAmount(totalCommitted, baseCurrency)} icon={CircleDollarSign} mono />
                  </div>
                  {supplier?.notes && <div className="border-t border-border/40 pt-3"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notas</p><p className="mt-2 rounded-xl border border-border/30 bg-muted/20 p-3 text-xs text-muted-foreground">{supplier.notes}</p></div>}
                </Card>
              </TabsContent>

              <TabsContent value="historial" className="mt-0 space-y-4 outline-none">
                <Card className="rounded-2xl border-border/60 bg-card p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/80"><History className="size-4 text-primary" /> Operaciones recientes</h3><p className="mt-1 text-[11px] text-muted-foreground">Órdenes, facturas y gastos relacionados con este proveedor.</p></div><Badge variant="outline" className="shrink-0 text-[9px] font-black">{transactions.length}</Badge></div>
                  {loadingTransactions ? <div className="mt-4 space-y-2"><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-12 w-full rounded-xl" /></div> : transactions.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-border/50 p-4 text-xs text-muted-foreground">Aún no hay operaciones registradas para este proveedor.</p> : <div className="mt-4 divide-y divide-border/40 rounded-xl border border-border/50">{transactions.slice(0, 50).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 p-3"><div className="flex min-w-0 items-center gap-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground"><FileText className="size-4" /></div><div className="min-w-0"><p className="truncate text-xs font-bold">{item.type}</p><p className="truncate font-mono text-[10px] text-muted-foreground">{item.number}</p></div></div><div className="shrink-0 text-right"><p className="text-[10px] font-bold text-muted-foreground">{item.date ? format(new Date(item.date), 'dd/MM/yyyy') : '—'}</p><p className="text-[10px] font-black">{formatConvertedAmount(item.amount, item.currency, item.exchangeRate)}</p><p className="text-[9px] text-muted-foreground">{transactionStatus(item.status)}</p></div></div>)}</div>}
                </Card>
              </TabsContent>
            </div>
          </ScrollArea>
          <SheetFooter className="border-t border-border/50 bg-background/95 px-6 py-3 backdrop-blur-md">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="ml-auto gap-1.5 rounded-xl font-bold text-xs">
              Cerrar <ChevronRight className="size-3" />
            </Button>
          </SheetFooter>
        </Tabs>
      </SheetContent>
    </Sheet>
    <Dialog open={historyExportDialogOpen} onOpenChange={setHistoryExportDialogOpen}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black">
            <FileText className="size-5 text-primary" /> Exportar historial del proveedor
          </DialogTitle>
          <DialogDescription>
            Selecciona todas las operaciones o filtra por tipo. También puedes elegir la moneda del PDF.
          </DialogDescription>
        </DialogHeader>
        {historyExportLoading ? (
          <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin text-primary" /> Cargando operaciones para configurar la exportación…
          </div>
        ) : (
          <>
            <div className="space-y-2" role="radiogroup" aria-label="Alcance de transacciones a exportar">
              <button
                type="button"
                role="radio"
                aria-checked={historyExportScope === 'ALL'}
                onClick={() => setHistoryExportScope('ALL')}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${historyExportScope === 'ALL' ? 'border-primary bg-primary/5' : 'border-border/50 hover:bg-muted/40'}`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-foreground">Todas las operaciones</span>
                  <span className="block text-[11px] text-muted-foreground">Incluye todo el historial relacionado con este proveedor.</span>
                </span>
                <span className="shrink-0 text-xs font-black text-primary">{historyExportItems.length}</span>
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
                    {historyExportFilter === 'ALL' ? 'Selecciona el tipo de operación que deseas incluir.' : `Tipo: ${historyExportFilter}.`}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-black text-primary">{historyExportScope === 'FILTERED' ? selectedHistoryItems.length : historyExportItems.length}</span>
              </button>
            </div>
            {historyExportScope === 'FILTERED' && (
              <div className="mt-4 space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo de operación</Label>
                <Select value={historyExportFilter} onValueChange={setHistoryExportFilter}>
                  <SelectTrigger className="h-9 rounded-xl text-xs font-bold">
                    <SelectValue placeholder="Selecciona un tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {historyExportTypeOptions.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
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
          <Button type="button" onClick={() => void confirmHistoryExport()} disabled={historyExportLoading || !selectedHistoryItems.length || exportingHistory} className="gap-2">
            {exportingHistory && <Loader2 className="size-4 animate-spin" />}
            {exportingHistory ? 'Generando…' : `Exportar ${selectedHistoryItems.length} registros`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

function MetricCard({ label, value, icon: Icon, accent, loading }: { label: string; value: string; icon: typeof CircleDollarSign; accent: string; loading?: boolean }) {
  return <Card className="rounded-2xl border-border/50 bg-card p-3 shadow-sm"><div className={cn('mb-2 flex size-8 items-center justify-center rounded-xl bg-muted/40', accent)}><Icon className="size-4" /></div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>{loading ? <Skeleton className="mt-1 h-5 w-20" /> : <p className="mt-1 truncate text-sm font-black tabular-nums text-foreground">{value}</p>}</Card>;
}

function InfoField({ label, value, icon: Icon, mono = false, muted = false }: { label: string; value: string; icon: typeof Mail; mono?: boolean; muted?: boolean }) {
  return <div className="min-w-0"><p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground"><Icon className="size-3" /> {label}</p><p className={cn('mt-1 break-words text-sm font-semibold', mono && 'font-mono text-xs', muted ? 'text-muted-foreground/60' : 'text-foreground')}>{value}</p></div>;
}
