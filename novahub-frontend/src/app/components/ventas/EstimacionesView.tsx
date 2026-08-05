import { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, Plus, Search, TrendingUp, Clock, CheckCircle2, ArrowRightCircle, FileDown, Eye, Trash2, Ban, ChevronLeft, MessageCircle
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { estimatesService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import type { Estimate, Customer, Product, SalesPaginationControls } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { generateEstimatePDF } from '../../utils/pdfGenerator';
import { storageService } from '../../services/storage.service';
import { publicAccessService, publicLinkUrl } from '../../services/public-access.service';
import { PriceMissingBadge, SalesLinePriceListSelect } from './SalesLinePriceListSelect';
import { AccountingAccountSelect } from '../ui/AccountingAccountSelect';
import { formatSalesAmount, getMissingSalesPriceMessage } from '../../utils/salesPriceList';
import { SalesDateRangeFilter } from './SalesDateRangeFilter';
import { SalesViewTutorial } from './SalesViewTutorial';
import { SalesKpiCard } from './SalesKpiCard';

interface EstimacionesViewProps {
  data: Estimate[];
  loading: boolean;
  onRefresh: () => Promise<void> | void;
  onConvertedToOrder?: (orderId: string) => void;
  customers?: Customer[];
  products?: Product[];
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateRangeChange?: (dateFrom: string, dateTo: string) => void;
}

const statusOptions = [
  { label: 'Borrador',  value: 'DRAFT',     color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Enviada',  value: 'SENT',      color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Aprobada', value: 'APPROVED',  color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Rechazada',value: 'REJECTED',  color: 'bg-rose-500/10 text-rose-500' },
  { label: 'Cancelada',value: 'CANCELLED', color: 'bg-muted/20 text-muted-foreground' },
];
const editableStatusOptions = statusOptions.filter((status) => status.value !== 'APPROVED');
const actionButtonClass = 'text-muted-foreground hover:bg-muted/40 hover:text-muted-foreground transition-colors';
const actionIconClass = 'size-4 text-muted-foreground';

export function EstimacionesView({ data, loading: _loading, onRefresh, onConvertedToOrder, customers = [], products = [], pagination, onSearchChange, dateFrom = '', dateTo = '', onDateRangeChange }: EstimacionesViewProps) {
  const { user, canPerform } = useAuth();
  const { themeConfig } = useTheme();
  const { exchangeRate: globalRate, displayCurrency, baseCurrency, formatConvertedAmount, toBaseAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SENT' | 'APPROVED'>('ALL');
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Estimate | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const productCatalog = products.filter((p) => p.itemType !== 'SERVICE');
  const serviceCatalog = products.filter((p) => p.itemType === 'SERVICE');
  const resolveItemType = (item: any) => item.itemType || (products.find((p) => p.id === item.productId)?.itemType === 'SERVICE' ? 'SERVICE' : 'PRODUCT');

  const handleConvertToOrder = async (estimate: Estimate) => {
    if (!canPerform('SALES_ORDERS', 'create')) {
      toast.error('No tienes permiso para crear órdenes de venta');
      return;
    }
    if (convertingId) return;
    const currentStatus = String(estimate.status || '').toUpperCase();
    if (!['DRAFT', 'SENT'].includes(currentStatus)) {
      toast.info('Solo se pueden aprobar cotizaciones en borrador o enviadas');
      return;
    }
    if (!estimate.items?.length) {
      toast.error('La cotización debe contener al menos un producto o servicio');
      return;
    }
    const priceMessage = getMissingSalesPriceMessage(estimate.items);
    if (priceMessage) {
      toast.error(priceMessage);
      return;
    }
    setConvertingId(estimate.id);
    try {
      if (currentStatus === 'DRAFT') {
        await estimatesService.update(estimate.id, {
          number: estimate.number,
          customerId: estimate.customerId || null,
          date: estimate.date,
          expiryDate: estimate.expiryDate,
          subtotal: estimate.subtotal,
          taxAmount: estimate.taxAmount,
          discountAmount: estimate.discountAmount,
          irRate: estimate.irRate || 0,
          irTaxId: estimate.irTaxId || null,
          irAmount: estimate.irAmount || 0,
          priceListId: estimate.priceListId || null,
          total: estimate.total,
          currency: estimate.currency,
          exchangeRate: estimate.exchangeRate,
          baseTotal: estimate.baseTotal,
          notes: estimate.notes,
          items: estimate.items || [],
          status: 'SENT',
        } as Partial<Estimate>);
      }
      const order = await estimatesService.convertToOrder(estimate.id);
      toast.success('Cotización enviada a Orden de Venta');
      onConvertedToOrder?.(order.id);
      await onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo enviar la cotización');
    } finally {
      setConvertingId(null);
    }
  };

  const filtered = data.filter(e => 
    (statusFilter === 'ALL' || String(e.status || '').toUpperCase() === statusFilter) &&
    e.number.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (statusFilter === 'ALL' || String(e.status || '').toUpperCase() === statusFilter) &&
    (e.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdate = async (id: string | number, updates: Partial<Estimate>) => {
    try {
      await estimatesService.update(id.toString(), updates);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar');
      throw e;
    }
  };

  const buildEstimateStatusPayload = (status: 'DRAFT' | 'SENT') => ({
    number: localDoc?.number,
    customerId: localDoc?.customerId || null,
    date: localDoc?.date,
    expiryDate: localDoc?.expiryDate,
    subtotal: localDoc?.subtotal,
    taxAmount: localDoc?.taxAmount,
    discountAmount: localDoc?.discountAmount,
    irRate: (localDoc as any)?.irRate || 0,
    irTaxId: (localDoc as any)?.irTaxId || null,
    irAmount: (localDoc as any)?.irAmount || 0,
    priceListId: localDoc?.priceListId || null,
    total: localDoc?.total,
    currency: localDoc?.currency,
    exchangeRate: localDoc?.exchangeRate,
    baseTotal: (localDoc as any)?.baseTotal,
    accountId: (localDoc as any)?.accountId || null,
    notes: localDoc?.notes,
    items: localDoc?.items || [],
    status,
  } as Partial<Estimate>);

  const handleSaveEstimate = async (status: 'DRAFT' | 'SENT') => {
    if (!localDoc) return;
    if (status === 'SENT') {
      const priceMessage = getMissingSalesPriceMessage(localDoc.items || []);
      if (priceMessage) {
        toast.error(priceMessage);
        return;
      }
    }
    try {
      await handleUpdate(localDoc.id, buildEstimateStatusPayload(status));
      setEditingId(null);
      toast.success(status === 'SENT' ? 'Cotización enviada' : 'Cotización guardada como borrador');
    } catch {
      // handleUpdate already shows the error
    }
  };

  const getCustomerPhone = (): string | null => {
    if (!localDoc?.customerId) return null;
    const customer = customers.find((c) => c.id === localDoc.customerId);
    return customer?.phone || null;
  };

  const handleWhatsApp = async () => {
    const phone = getCustomerPhone();
    if (!phone) {
      toast.error('El cliente no tiene número de teléfono registrado');
      return;
    }

    let secureDocumentUrl: string | null = null;
    let securePortalUrl: string | null = null;
    let publicPdfUrl: string | null = null;

    if (localDoc) {
      const currentCustomer = customers.find((c) => c.id === localDoc.customerId) || localDoc.customer;
      try {
        toast.info('Generando PDF y preparando enlaces seguros...');
        if (localDoc.customerId) {
          const [documentLink, portalLink] = await Promise.all([
            publicAccessService.createDocumentLink({ customerId: localDoc.customerId, documentType: 'estimate', documentId: localDoc.id, allowPrint: true, allowDownload: true, allowRelated: true }),
            publicAccessService.createPortalLink({ customerId: localDoc.customerId }),
          ]);
          secureDocumentUrl = publicLinkUrl(documentLink.path);
          securePortalUrl = publicLinkUrl(portalLink.path);
        }
        if (!secureDocumentUrl) {
          const { blob } = await generateEstimatePDF({
            estimate: { ...localDoc, customer: currentCustomer },
            tenantName: themeConfig?.tenantName || user?.tenantName || 'Empresa',
            tenantLogo: themeConfig?.logo,
            formatAmount: formatConvertedAmount,
            save: true,
          });
          // Compatibilidad: solo usa el enlace legado si el servicio seguro no está disponible.
          const fileName = `${localDoc.number || 'Cotizacion'}_${Date.now()}.pdf`;
          const pdfFile = new File([blob], fileName, { type: 'application/pdf' });
          const uploaded = await storageService.uploadFile('documents', pdfFile, { folder: 'cotizaciones' });
          if (uploaded?.url) publicPdfUrl = uploaded.url;
        }
      } catch (err) {
        console.warn('No se pudo generar enlace en la nube, usando modo estándar:', err);
      }
    }

    const digits = phone.replace(/\D/g, '');
    const phoneWithCode = digits.length === 8 ? '505' + digits : (digits.startsWith('505') ? digits : '505' + digits);
    const customerName = localDoc?.customer?.name || customers.find((c) => c.id === localDoc?.customerId)?.name || '';
    const totalFormatted = formatConvertedAmount(Number(localDoc?.total || 0), localDoc?.currency || 'NIO');

    let message = `Hola ${customerName}, te compartimos la cotización ${localDoc?.number || ''} por un total de ${totalFormatted}.`;
    if (secureDocumentUrl) {
      message += `\n\nPodés consultar la cotización de forma segura aquí:\n${secureDocumentUrl}`;
      if (securePortalUrl) message += `\n\nTambién podés consultar tu historial y saldo en el portal del cliente:\n${securePortalUrl}`;
    } else if (publicPdfUrl) {
      message += `\n\nPodés ver o descargar el documento PDF directamente desde este enlace:\n${publicPdfUrl}`;
    } else {
      message += ` Adjunto encontrarás el documento PDF con todos los detalles.`;
    }

    const text = encodeURIComponent(message);
    window.open(`https://wa.me/${phoneWithCode}?text=${text}`, '_blank');

    if (publicPdfUrl) {
      toast.success('¡Enlace público del PDF generado e incluido en el mensaje de WhatsApp!');
    } else {
      toast.success('PDF descargado. ¡Se abrió WhatsApp para que lo adjuntes!', { duration: 5000 });
    }
  };

  const handleAddEstimate = async () => {
    const createToastId = toast.loading('Creando estimación...');
    try {
      const newEst = await estimatesService.create({
        date: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        items: [],
        subtotal: 0,
        taxAmount: 0,
        discountAmount: 0,
        total: 0,
        currency: displayCurrency,
        exchangeRate: globalRate,
        status: 'DRAFT' as any,
        number: `COT-${Date.now().toString().slice(-6)}`
      });
      await onRefresh();
      toast.success('Estimación creada como borrador', { id: createToastId });
      setEditingId(newEst.id);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo crear la estimación', { id: createToastId });
    }
  };

  const calculateRates = (doc: any) => {
    const sub = Number(doc?.subtotal || 0);
    if (sub === 0) return { dRate: 0, tRate: 0 };
    const dAmount = Number(doc?.discountAmount || 0);
    const dRate = (dAmount / sub) * 100;
    const base = sub - dAmount;
    const tAmount = Number(doc?.taxAmount || 0);
    const tRate = base > 0 ? (tAmount / base) * 100 : 0;
    return { dRate: Math.round(dRate * 100) / 100, tRate: Math.round(tRate * 100) / 100 };
  };

  // Keep virtual rates to auto-apply when subtotal changes
  const recalcIndividualTotals = (items: any[]) => {
    const pricedItems = items.map((line: any) => {
      const gross = Number(line.quantity || 0) * Number(line.unitPrice || 0);
      const discount = gross * Number(line.discount || 0) / 100;
      const taxable = gross - discount;
      const tax = taxable * Number(line.taxRate || 0) / 100;
      const ir = taxable * Number(line.irRate || 0) / 100;
      return { ...line, irAmount: ir, total: taxable + tax - ir };
    });
    const subtotal = pricedItems.reduce((sum: number, line: any) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);
    const discountAmount = pricedItems.reduce((sum: number, line: any) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0) * Number(line.discount || 0) / 100, 0);
    const taxAmount = pricedItems.reduce((sum: number, line: any) => {
      const gross = Number(line.quantity || 0) * Number(line.unitPrice || 0);
      return sum + (gross - gross * Number(line.discount || 0) / 100) * Number(line.taxRate || 0) / 100;
    }, 0);
    const irAmount = pricedItems.reduce((sum: number, line: any) => {
      const gross = Number(line.quantity || 0) * Number(line.unitPrice || 0);
      const net = gross - gross * Number(line.discount || 0) / 100;
      return sum + net * Number(line.irRate || 0) / 100;
    }, 0);
    return { items: pricedItems, subtotal, discountAmount, taxAmount, irAmount, total: subtotal - discountAmount + taxAmount - irAmount };
  };
  const recalcGlobalTotals = (items: any[], dRate: number, tRate: number, irRate = 0) => {
    const normalizedItems = items.map((line: any) => ({ ...line, total: Number(line.quantity || 0) * Number(line.unitPrice || 0) }));
    const subtotal = normalizedItems.reduce((sum: number, line: any) => sum + Number(line.total || 0), 0);
    const discountAmount = subtotal * Math.max(0, Math.min(100, Number(dRate || 0))) / 100;
    const base = subtotal - discountAmount;
    const taxAmount = base * Math.max(0, Number(tRate || 0)) / 100;
    const irAmount = base * Math.max(0, Number(irRate || 0)) / 100;
    return { items: normalizedItems, subtotal, discountAmount, taxAmount, irAmount, total: base + taxAmount - irAmount };
  };
  const [localRates, setLocalRates] = useState({ dRate: 0, tRate: 0, irRate: 0, irTaxId: '' });
  const [pricingMode, setPricingMode] = useState<'global' | 'individual'>('global');

  useEffect(() => {
    if (editingId) {
      const e = data.find(x => x.id === editingId);
      setLocalDoc(e ? JSON.parse(JSON.stringify(e)) : null);
      if (e) {
        setLocalRates({ ...calculateRates(e), irRate: Number((e as any).irRate || 0), irTaxId: (e as any).irTaxId || '' });
        setPricingMode((e.items || []).some((line: any) => Number(line.discount || 0) !== 0 || Number(line.taxRate || 0) !== 0 || Number(line.irRate || 0) !== 0) ? 'individual' : 'global');
      }
    } else {
      setLocalDoc(null);
      setLocalRates({ dRate: 0, tRate: 0, irRate: 0, irTaxId: '' });
    }
  }, [editingId]); // Intentionally removed 'data' to prevent server-refreshes from destroying mid-edit local states


  const columns: ColumnDef<Estimate>[] = [
    { 
      key: 'number', 
      header: 'Número', 
      width: '140px',
      render: (val, row) => (
        <span 
          className={cn(
            "text-xs font-black font-mono text-primary",
            canPerform('SALES_QUOTES', 'edit') ? "cursor-pointer hover:underline" : "cursor-default"
          )}
          onClick={() => canPerform('SALES_QUOTES', 'edit') && setEditingId(row.id)}
        >
          {val}
        </span>
      )
    },
    { 
      key: 'customerId', 
      header: 'Cliente', 
      render: (_val, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Varios'}</span>
    },
    { 
      key: 'date', 
      header: 'Fecha Emisión', 
      render: (val) => <span className="text-xs font-medium text-muted-foreground">{new Date(val).toLocaleDateString()}</span>
    },
    { 
      key: 'total', 
      header: 'Total Neto', 
      width: '150px',
      render: (val, row) => (
        <span className="text-[13px] font-black tabular-nums text-foreground">
          {formatConvertedAmount(Number(val || 0), row.currency, row.exchangeRate)}
        </span>
      )
    },
    { 
      key: 'status', 
      header: 'Estado', 
      width: '135px',
      editable: false,
      type: 'select',
                  options: editableStatusOptions,
      render: (val) => {
        const opt = statusOptions.find(o => o.value === String(val || '').toUpperCase());
        return (
          <Badge variant="outline" className={cn(
            "whitespace-nowrap text-[9px] font-black uppercase tracking-wider px-2 py-0.5 border-none shadow-none",
            opt?.color || 'bg-muted/20 text-muted-foreground'
          )}>
            {opt?.label || val}
          </Badge>
        );
      }
    },
    { 
      key: 'expiryDate', 
      header: 'Validez', 
      render: (val) => (
        <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
           <Clock className="size-3" />
           {new Date(val).toLocaleDateString()}
        </div>
      )
    }
  ];

  const quotedTotalInDisplayCurrency = data.reduce(
    (acc, estimate) => acc + ((estimate as any).baseTotal !== null && (estimate as any).baseTotal !== undefined
      ? Number((estimate as any).baseTotal)
      : toBaseAmount(estimate.total || 0, estimate.currency, estimate.exchangeRate || globalRate)),
    0,
  );

  if (editingId && localDoc) {
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setEditingId(null)} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Cotización {localDoc?.number}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Detalle de la cotización comercial</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {localDoc?.customerId && (
              <Button variant="outline" onClick={handleWhatsApp} className="rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50 gap-2 font-black uppercase text-[10px] tracking-widest px-4">
                <MessageCircle className="size-3.5" /> WhatsApp
              </Button>
            )}
            {canPerform('SALES_QUOTES', 'edit') && !['APPROVED', 'CANCELLED', 'REJECTED'].includes(String(localDoc?.status || '').toUpperCase()) && (
              <>
                <Button variant="outline" className="rounded-xl border-border/50 font-black uppercase text-[10px] tracking-widest px-6"
                  onClick={() => void handleSaveEstimate('DRAFT')}>
                  Guardar Borrador
                </Button>
                <Button className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6"
                  onClick={() => void handleSaveEstimate('SENT')}>
                  Enviar Cotización
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Número</p>
                  <Input defaultValue={localDoc?.number} onBlur={(e) => handleUpdate(localDoc!.id, { number: e.target.value })} className="h-8 text-xs font-black uppercase" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Cliente</p>
                  <Combobox 
                    options={(customers || [])
                      .filter(c => (c.status || '').toUpperCase() === 'ACTIVE' || c.id === localDoc?.customerId)
                      .map(c => ({ label: c.name, value: c.id, description: (c.code ? `[${c.code}] ` : '') + (c.phone || 'Sin teléfono') }))}
                    value={localDoc?.customerId || ''}
                    onChange={(val) => {
                      const customer = customers.find((entry) => entry.id === val);
                      const priceListId = customer?.priceListId || null;
                      const items = (localDoc?.items || []).map((item: any) => item.productId
                        ? { ...item, priceListId, unitPrice: 0, total: 0, priceMissing: false }
                        : { ...item, priceListId });
                      setLocalDoc({ ...localDoc, customerId: val, priceListId, items } as any);
                      void handleUpdate(localDoc!.id, { customerId: val, priceListId, items } as any);
                    }}
                    placeholder="Seleccionar Cliente"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha</p>
                  <Input type="date" defaultValue={typeof localDoc?.date === 'string' && localDoc.date.includes('T') ? localDoc.date.split('T')[0] : localDoc?.date || ''} onBlur={(e) => handleUpdate(localDoc!.id, { date: new Date(e.target.value).toISOString() })} className="h-8 text-xs" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Válida hasta</p>
                  <Input type="date" defaultValue={typeof localDoc?.expiryDate === 'string' && localDoc.expiryDate.includes('T') ? localDoc.expiryDate.split('T')[0] : localDoc?.expiryDate || ''} onBlur={(e) => handleUpdate(localDoc!.id, { expiryDate: new Date(e.target.value).toISOString() })} className="h-8 text-xs" />
                </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Moneda de la transacción</p>
                    <Select value={localDoc?.currency || 'NIO'} onValueChange={(currency) => {
                      const exchangeRate = currency === 'NIO' ? 1 : Number(globalRate || 1);
                      const previousCurrency = localDoc?.currency || 'NIO';
                      const previousRate = previousCurrency === 'NIO' ? 1 : Number(localDoc?.exchangeRate || globalRate || 1);
                      const convertedItems = (localDoc?.items || []).map((item: any) => {
                        const basePrice = previousCurrency === 'USD' ? Number(item.unitPrice || 0) * previousRate : Number(item.unitPrice || 0);
                        return { ...item, unitPrice: currency === 'USD' ? basePrice / exchangeRate : basePrice };
                      });
                      const recalculated = pricingMode === 'individual'
                        ? recalcIndividualTotals(convertedItems)
                        : recalcGlobalTotals(convertedItems, localRates.dRate, localRates.tRate, localRates.irRate);
                      setLocalDoc({ ...localDoc, currency, exchangeRate, ...recalculated } as any);
                      void handleUpdate(localDoc!.id, { currency, exchangeRate, ...recalculated } as any);
                    }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar moneda" /></SelectTrigger>
                      <SelectContent><SelectItem value="NIO">Córdobas (C$)</SelectItem><SelectItem value="USD">Dólares (US$)</SelectItem></SelectContent>
                    </Select>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">Tasa configurada: <span className="font-bold">{localDoc?.currency === 'NIO' ? '1.00' : Number(localDoc?.exchangeRate || globalRate || 1).toFixed(2)}</span></p>
                  </div>
                <div className="sm:col-span-2">
                  <AccountingAccountSelect
                    value={(localDoc as any)?.accountId || ''}
                    onChange={(accountId) => {
                      setLocalDoc({ ...localDoc, accountId } as any);
                      void handleUpdate(localDoc!.id, { accountId } as any);
                    }}
                    label="Cuenta contable de ingresos"
                    incomeOnly
                    required
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">Necesaria para enviar este borrador a orden de venta o emitirlo como factura.</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumen Financiero</p>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-muted/10 p-2 text-[10px] font-black uppercase tracking-widest">
                <span className="text-muted-foreground">Aplicar impuestos/descuentos:</span>
                <Button type="button" size="sm" variant={pricingMode === 'global' ? 'default' : 'outline'} className="h-7 rounded-lg px-2 text-[10px]" onClick={() => {
                  const items = (localDoc.items || []).map((line: any) => ({ ...line, taxRate: 0, discount: 0, irRate: 0, irTaxId: null, irAmount: 0 }));
                  const recalculated = recalcGlobalTotals(items, localRates.dRate, localRates.tRate, localRates.irRate);
                  setPricingMode('global');
                  setLocalDoc({ ...localDoc, ...recalculated } as any);
                  void handleUpdate(localDoc.id, recalculated as any);
                }}>Global</Button>
                <Button type="button" size="sm" variant={pricingMode === 'individual' ? 'default' : 'outline'} className="h-7 rounded-lg px-2 text-[10px]" onClick={() => setPricingMode('individual')}>Por producto</Button>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <div className="flex items-center gap-2">{localDoc?.currency === 'USD' ? '$' : 'C$'} <Input type="text" value={formatSalesAmount(localDoc?.subtotal)} readOnly className="w-28 h-8 text-right font-bold bg-muted/20" /></div>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Descuento</span>
                  <div className="flex items-center gap-2 text-rose-500">
                    <div className="flex items-center mr-2">{pricingMode === 'global' ? <Input type="number" min="0" max="100" value={localRates.dRate || ''} placeholder="0" onChange={(e) => {
                      const newRate = Number(e.target.value);
                      const dAmount = Number(localDoc?.subtotal||0) * (newRate / 100);
                      const base = Number(localDoc?.subtotal||0) - dAmount;
                      const tAmount = base * (localRates.tRate / 100);
                      const newTotal = base + tAmount;
                      setLocalRates(prev => ({ ...prev, dRate: newRate }));
                      setLocalDoc({ ...localDoc, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                    }} onBlur={(e) => {
                      const newRate = Number(e.target.value);
                      const dAmount = Number(localDoc?.subtotal||0) * (newRate / 100);
                      const base = Number(localDoc?.subtotal||0) - dAmount;
                      const tAmount = base * (localRates.tRate / 100);
                      const newTotal = base + tAmount;
                      handleUpdate(localDoc!.id, { discountAmount: dAmount, taxAmount: tAmount, total: newTotal });
                    }} className="w-16 h-8 text-right font-bold text-rose-500 bg-transparent" /> : null} {pricingMode === 'global' && <span className="ml-1 text-xs font-black">%</span>}</div>
                    -{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(localDoc?.discountAmount)}
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Impuesto (IVA)</span>
                  <div className="flex items-center gap-2">
                    {pricingMode === 'global' && <label className="flex h-8 items-center gap-1.5 rounded-md bg-muted/30 px-2 text-xs font-black">
                      <input type="checkbox" checked={Number(localRates.tRate || 0) > 0} onChange={(e) => {
                        const newRate = e.target.checked ? 15 : 0;
                        const dAmount = Number(localDoc?.subtotal || 0) * (localRates.dRate / 100);
                        const base = Number(localDoc?.subtotal || 0) - dAmount;
                        const tAmount = base * (newRate / 100);
                        setLocalRates(prev => ({ ...prev, tRate: newRate }));
                        setLocalDoc({ ...localDoc, discountAmount: dAmount, taxAmount: tAmount, total: base + tAmount } as any);
                        void handleUpdate(localDoc!.id, { discountAmount: dAmount, taxAmount: tAmount, total: base + tAmount } as any);
                      }} /> Aplicar
                    </label>}
                    {localDoc?.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(localDoc?.taxAmount)}
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">IR</span>
                </div>
                <div className="flex justify-between items-center text-base border-t pt-3 border-border/50">
                  <span className="font-black">Total</span>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2 text-primary font-black">
                      {localDoc?.currency === 'USD' ? '$' : 'C$'} 
                      <Input type="number" value={Number(localDoc?.total||0)} readOnly className="w-28 h-8 text-right font-black text-primary bg-muted/20" />
                    </div>
                    {localDoc?.currency === 'USD' && (
                      <p className="text-[10px] font-bold text-muted-foreground mt-1 italic">
                      ≈ C$ {formatSalesAmount(Number(localDoc?.total || 0) * (localDoc?.exchangeRate || globalRate))}
                      </p>
                    )}
                    {localDoc?.currency === 'NIO' && (
                      <p className="text-[10px] font-bold text-muted-foreground mt-1 italic">
                        ≈ $ {formatSalesAmount(Number(localDoc?.total || 0) / (localDoc?.exchangeRate || globalRate))}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* --- PRODUCT LINE ITEMS --- */}
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Productos / Servicios</p>
              <div className="flex flex-wrap gap-2">
                {(['PRODUCT', 'SERVICE'] as const).map((itemType) => <Button key={itemType} type="button" variant="outline" size="sm" disabled={!localDoc?.customerId} onClick={() => {
                  const newItems = [...(localDoc.items || []), { id: Date.now().toString(), itemType, productId: '', description: '', quantity: 1, unitPrice: 0, total: 0 }] as any[];
                  setLocalDoc({ ...localDoc, items: newItems } as any);
                }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl"><Plus className="size-3 mr-2" /> Agregar {itemType === 'PRODUCT' ? 'Producto' : 'Servicio'}</Button>)}
              </div>
            </div>
            <div className="space-y-2">
              <div className="hidden xl:grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                <div className="col-span-5">Descripción</div>
                {pricingMode === 'individual' && <div className="col-span-2" />}
                <div className={cn("col-span-2 text-right", pricingMode === 'individual' && "xl:col-span-1")}>Cant.</div>
                <div className="col-span-2 text-right">Precio U.</div>
                <div className="col-span-2 text-right">Total</div>
              </div>
              {(localDoc.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} data-item-layout="standard" className="sales-item-row grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-border/50 bg-muted/5 p-3 items-start xl:grid-cols-12 xl:gap-2 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0">
                  <div className={cn("min-w-0 xl:col-span-5", pricingMode === 'individual' && "xl:col-span-5")}>
                      <div className="flex min-w-0 flex-wrap items-center gap-1"><div className="min-w-0 flex-1"><Combobox
                      options={(resolveItemType(item) === 'SERVICE' ? serviceCatalog : productCatalog).map(p => ({ label: `${resolveItemType(item) === 'SERVICE' ? 'Servicio' : 'Producto'} · ${p.code} - ${p.name}`, value: p.id }))}
                      value={item.productId || ''}
                      onChange={(val) => {
                        const newItems = [...(localDoc.items || [])] as any[];
                        const selectedProd = (resolveItemType(item) === 'SERVICE' ? serviceCatalog : productCatalog).find(p => p.id === val);
                        newItems[idx].productId = val;
                        if (selectedProd) {
                          newItems[idx].description = selectedProd.name;
                          const baseSalePrice = Number(selectedProd.salePrice ?? selectedProd.price ?? 0);
                          newItems[idx].unitPrice = localDoc?.currency === 'USD' ? baseSalePrice / Number(localDoc?.exchangeRate || globalRate || 1) : baseSalePrice;
                          newItems[idx].total = Number(newItems[idx].quantity) * Number(newItems[idx].unitPrice);
                        } else {
                          newItems[idx].description = 'Producto Customizado';
                          newItems[idx].unitPrice = 0;
                          newItems[idx].total = 0;
                        }
                        const newSubtotal = newItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
                        const dAmount = newSubtotal * (localRates.dRate / 100);
                        const base = newSubtotal - dAmount;
                        const tAmount = base * (localRates.tRate / 100);
                        const newTotal = base + tAmount;
                        const nextDoc = { ...localDoc, items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any;
                        setLocalDoc(nextDoc);
                        void handleUpdate(localDoc!.id, {
                          items: newItems,
                          subtotal: newSubtotal,
                          discountAmount: dAmount,
                          taxAmount: tAmount,
                          total: newTotal,
                        } as any);
                      }}
                      placeholder={resolveItemType(item) === 'SERVICE' ? 'Seleccionar servicio...' : 'Seleccionar producto...'}
                      disabled={!localDoc?.customerId}
                    /></div><SalesLinePriceListSelect
                      productId={item.productId}
                      productCode={products.find((product) => product.id === item.productId)?.code || item.code}
                      productName={item.description}
                      itemType={item.itemType}
                      value={item.priceListId}
                      defaultPriceListId={localDoc?.priceListId}
                      currency={localDoc?.currency}
                      exchangeRate={Number(localDoc?.exchangeRate || globalRate || 1)}
                      onChange={(priceListId, result, source) => {
                      const nextItems = [...(localDoc.items || [])] as any[];
                      nextItems[idx] = { ...nextItems[idx], priceListId, unitPrice: result.unitPrice ?? 0, priceMissing: result.priceMissing };
                      const calculated = pricingMode === 'individual' ? recalcIndividualTotals(nextItems) : recalcGlobalTotals(nextItems, localRates.dRate, localRates.tRate, localRates.irRate);
                      setLocalDoc({ ...localDoc, ...calculated, priceListId });
                      if (source !== 'initial') void handleUpdate(localDoc!.id, { ...calculated, priceListId, items: calculated.items } as any);
                      }}
                    /></div>
                    {item.priceMissing && <PriceMissingBadge className="mt-1" />}
                  </div>
                  {pricingMode === 'individual' && (
                    <div className="col-span-2 mt-0 grid min-w-0 grid-cols-2 items-start gap-1.5 self-start text-[10px]">
                      <label className="relative flex min-w-0 flex-1 flex-col items-start gap-1 font-black uppercase tracking-wider">
                        <span className="flex h-8 w-full items-center gap-1.5 rounded-md bg-muted/30 px-2">
                          <input type="checkbox" checked={Number(item.taxRate || 0) > 0} onChange={(event) => {
                            const nextItems = [...(localDoc.items || [])];
                            nextItems[idx] = { ...nextItems[idx], taxRate: event.target.checked ? 15 : 0 };
                            const recalculated = recalcIndividualTotals(nextItems);
                            setLocalDoc({ ...localDoc, ...recalculated });
                            void handleUpdate(localDoc!.id, recalculated as any);
                          }} />
                          <span className="text-xs">Aplicar</span>
                        </span>
                      </label>
                      <label className="relative flex min-w-0 flex-1 flex-col items-start gap-1 font-black uppercase tracking-wider">
                        <Input type="number" min="0" max="100" value={item.discount || ''} onChange={(event) => {
                          const nextItems = [...(localDoc.items || [])];
                          nextItems[idx] = { ...nextItems[idx], discount: Number(event.target.value) || 0 };
                          const recalculated = recalcIndividualTotals(nextItems);
                          setLocalDoc({ ...localDoc, ...recalculated });
                          void handleUpdate(localDoc!.id, recalculated as any);
                        }} className="h-8 w-full rounded-md bg-muted/30 text-right text-xs" />
                      </label>
                    </div>
                  )}
                  <div className={cn("min-w-0 xl:col-span-2", pricingMode === 'individual' && "xl:col-span-1")}>
                    <Input 
                      type="number"
                      min="0"
                      value={Number(item.quantity) || ''} 
                      placeholder="0"
                      onChange={(e) => {
                        const newItems = [...(localDoc.items || [])] as any[];
                        newItems[idx].quantity = Number(e.target.value);
                        newItems[idx].total = Number(newItems[idx].quantity) * Number(newItems[idx].unitPrice || 0);
                        const newSubtotal = newItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
                        const dAmount = newSubtotal * (localRates.dRate / 100);
                        const base = newSubtotal - dAmount;
                        const tAmount = base * (localRates.tRate / 100);
                        const newTotal = base + tAmount;
                        setLocalDoc({ ...localDoc, items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                      }}
                      onBlur={() => handleUpdate(localDoc!.id, { items: localDoc.items, subtotal: localDoc.subtotal, discountAmount: localDoc.discountAmount, taxAmount: localDoc.taxAmount, total: localDoc.total })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      type="text" 
                      min="0"
                      value={item.unitPrice === undefined || item.unitPrice === null ? '' : formatSalesAmount(item.unitPrice)}
                      placeholder="0"
                      readOnly
                      className="h-8 bg-muted/20 text-right text-xs"
                      onChange={(e) => {
                        const newItems = [...(localDoc.items || [])] as any[];
                        newItems[idx].unitPrice = Number(e.target.value);
                        newItems[idx].total = Number(newItems[idx].quantity || 0) * Number(newItems[idx].unitPrice);
                        const newSubtotal = newItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
                        const dAmount = newSubtotal * (localRates.dRate / 100);
                        const base = newSubtotal - dAmount;
                        const tAmount = base * (localRates.tRate / 100);
                        const newTotal = base + tAmount;
                        setLocalDoc({ ...localDoc, items: newItems, subtotal: newSubtotal, discountAmount: dAmount, taxAmount: tAmount, total: newTotal } as any);
                      }}
                      onBlur={() => handleUpdate(localDoc!.id, { items: localDoc.items, subtotal: localDoc.subtotal, discountAmount: localDoc.discountAmount, taxAmount: localDoc.taxAmount, total: localDoc.total })}
                    />
                  </div>
                  <div className="flex min-w-0 items-center justify-end gap-3 whitespace-nowrap xl:col-span-2">
                    <span className="min-w-[7rem] shrink-0 text-right text-xs font-black">{localDoc?.currency === 'USD' ? '$' : 'C$'}{formatSalesAmount(item.total)}</span>
                    <Button variant="ghost" size="icon" className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500" onClick={() => {
                        const newItems = [...(localDoc.items || [])] as any[];
                        newItems.splice(idx, 1);
                        const newSubtotal = newItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
                        const newTotal = newSubtotal + Number(localDoc.taxAmount || 0) - Number(localDoc.discountAmount || 0);
                        setLocalDoc({ ...localDoc, items: newItems, subtotal: newSubtotal, total: newTotal } as any);
                    }}>
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {(!localDoc.items || localDoc.items.length === 0) && (
                <div className="text-center py-6 text-xs text-muted-foreground/50 italic border border-dashed border-border/50 rounded-xl bg-muted/10">
                  No hay productos o servicios asignados a esta cotización. Haz clic en "Agregar Item".
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {localDoc?.notes && (
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Notas</p><p className="text-sm">{localDoc.notes}</p></CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="sales-list-kpis">
        <SalesKpiCard title={`Total Cotizado (${displayCurrency})`} value={formatConvertedAmount(quotedTotalInDisplayCurrency, baseCurrency)} icon={FileSpreadsheet} color="text-blue-500" bg="bg-blue-500/10" />
        <SalesKpiCard title="Tasa Conversión" value={`${((data.filter(e => (e.status||'').toUpperCase() === 'APPROVED').length / (data.length || 1)) * 100).toFixed(0)}%`} icon={TrendingUp} color="text-emerald-500" bg="bg-emerald-500/10" />
        <SalesKpiCard title="Enviadas" value={data.filter(e => (e.status||'').toUpperCase() === 'SENT').length} icon={Clock} color="text-amber-500" bg="bg-amber-500/10" active={statusFilter === 'SENT'} onClick={() => setStatusFilter(statusFilter === 'SENT' ? 'ALL' : 'SENT')} />
        <SalesKpiCard title="Aprobadas" value={data.filter(e => (e.status||'').toUpperCase() === 'APPROVED').length} icon={CheckCircle2} color="text-purple-500" bg="bg-purple-500/10" active={statusFilter === 'APPROVED'} onClick={() => setStatusFilter(statusFilter === 'APPROVED' ? 'ALL' : 'APPROVED')} />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-2">
          <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-foreground" data-tour="sales-list-title">Cotizaciones</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Negociaciones en tiempo real sin modals ni esperas.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3" data-tour="sales-list-actions">
            <SalesViewTutorial view="quotes" />
            <SalesDateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChange={onDateRangeChange || (() => undefined)} />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input 
                placeholder="Buscar cotización..." 
                className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold tracking-widest"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }}
              />
            </div>
            {canPerform('SALES_QUOTES', 'create') && (
              <Button onClick={handleAddEstimate} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20">
                <Plus className="size-4" /> Nueva Cotización
              </Button>
            )}
          </div>
        </div>
        <EditableDataTable 
          data={filtered}
          pagination={pagination}
          columns={columns}
          onRowUpdate={handleUpdate}
          onRowClick={(row) => setEditingId(row.id)}
          actionsWidth="w-52"
          fitContent
          showHorizontalControls
          actions={(row) => (
            <>
              {canPerform('SALES_ORDERS', 'create') &&
                ['DRAFT', 'SENT'].includes(String(row.status || '').toUpperCase()) && (
                <Button
                  variant="ghost"
                  title="Aprobar y enviar a Orden de Venta"
                  aria-label="Aprobar y enviar a Orden de Venta"
                  size="icon"
                  disabled={convertingId === row.id}
                  onClick={(e) => { e.stopPropagation(); void handleConvertToOrder(row); }}
                  className={actionButtonClass}
                >
                  <ArrowRightCircle className={cn(actionIconClass, convertingId === row.id && 'animate-pulse')} />
                </Button>
              )}
              <Button type="button" variant="ghost" title="Descargar PDF" size="icon" className={cn('relative z-20', actionButtonClass)} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => {
                e.stopPropagation();
                void (async () => {
                  try {
                    await generateEstimatePDF({
                      estimate: {...row, customer: customers.find(c => c.id === row.customerId) || row.customer},
                      tenantName: themeConfig?.tenantName || user?.tenantName || 'Empresa',
                      tenantLogo: themeConfig?.logo,
                      formatAmount: formatConvertedAmount
                    });
                    toast.success('PDF descargado');
                  } catch (error: any) {
                    toast.error(error?.message || 'No se pudo descargar el PDF');
                  }
                })();
              }}>
                <FileDown className={actionIconClass} />
              </Button>
              <Button variant="ghost" size="icon" className={actionButtonClass} onClick={(e) => { e.stopPropagation(); setEditingId(row.id); }}>
                <Eye className={actionIconClass} />
              </Button>
              {canPerform('SALES_QUOTES', 'edit') && !['CANCELLED', 'APPROVED'].includes(String(row.status).toUpperCase()) && (
                <Button type="button" title="Cancelar cotización" variant="ghost" size="icon" className={actionButtonClass} onClick={() => setPendingCancelId(row.id)}>
                  <Ban className={actionIconClass} />
                </Button>
              )}
            </>
          )}
        />
      </div>

      <ConfirmDialog
        open={pendingCancelId !== null}
        onOpenChange={(open) => { if (!open) setPendingCancelId(null); }}
        title={"¿Cancelar cotización?"}
        description="La cotización quedará cancelada y ya no podrá enviarse a una orden de venta. El registro se conservará en el historial."
        confirmLabel="Cancelar cotización"
        variant="destructive"
        loading={cancelLoading}
        onConfirm={async () => {
          if (!pendingCancelId) return;
          try {
            setCancelLoading(true);
            await estimatesService.update(pendingCancelId, { status: 'CANCELLED' as any });
            toast.success('Cotización cancelada');
            setEditingId(null);
            onRefresh();
          } catch (error: any) {
            toast.error(error?.response?.data?.message || error?.message || 'No se pudo cancelar la cotización');
          } finally {
            setCancelLoading(false);
            setPendingCancelId(null);
          }
        }}
      />
    </div>
  );
}

