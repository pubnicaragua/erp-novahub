import { useState, useEffect } from 'react';
import {
  FileText, Plus, Search, TrendingUp, CheckCircle2, AlertCircle, Eye, Trash2, Ban, ChevronLeft, FileDown, History, MessageCircle, Loader2
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { invoicesService, paymentsService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import type { Invoice, Customer, Product, SalesPaginationControls } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useGlobalSearch } from '../hooks/useGlobalSearch';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { generateEstimatePDF } from '../../utils/pdfGenerator';
import { publicAccessService, publicLinkUrl } from '../../services/public-access.service';
import { AuditHistoryModal } from '../ui/AuditHistoryModal';
import { SalesLinePriceListSelect, PriceMissingBadge } from './SalesLinePriceListSelect';
import { AccountingAccountSelect } from '../ui/AccountingAccountSelect';
import { formatSalesAmount, getMissingSalesPriceMessage } from '../../utils/salesPriceList';
import { SalesDateRangeFilter } from './SalesDateRangeFilter';
import { SalesViewTutorial } from './SalesViewTutorial';
import { SalesKpiCard } from './SalesKpiCard';

interface FacturasViewProps {
  data: Invoice[];
  loading: boolean;
  onRefresh: () => void;
  customers?: Customer[];
  products?: Product[];
  series?: any[];
  warehouses?: any[];
  employees?: any[];
  invoiceDraft?: Partial<Invoice>;
  onClearInvoiceDraft?: () => void;
  targetInvoiceId?: string | null;
  onClearTargetInvoiceId?: () => void;
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateRangeChange?: (dateFrom: string, dateTo: string) => void;
}

// Todos los estados posibles (para visualización en badges)
const statusOptions = [
  { label: 'Borrador', value: 'DRAFT', color: 'bg-slate-500/10 text-slate-500' },
  { label: 'Pendiente', value: 'PENDING', color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Pagada', value: 'PAID', color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Anulada', value: 'CANCELLED', color: 'bg-rose-500/10 text-rose-500' },
  { label: 'Vencida', value: 'OVERDUE', color: 'bg-orange-500/10 text-orange-500' },
  { label: 'Parcial', value: 'PARTIAL', color: 'bg-blue-500/10 text-blue-500' },
];

export function FacturasView({ data, loading, onRefresh, customers = [], products = [], series = [], warehouses = [], employees = [], invoiceDraft, onClearInvoiceDraft, targetInvoiceId, onClearTargetInvoiceId, pagination, onSearchChange, dateFrom = '', dateTo = '', onDateRangeChange }: FacturasViewProps) {
  const { exchangeRate: globalRate, displayCurrency, formatConvertedAmount, convertAmount } = useCurrency();
  const { user, canPerform } = useAuth();
  const { themeConfig } = useTheme();
  const [searchTerm, setSearchTerm] = useState(sessionStorage.getItem('global-search-module') === 'facturas' ? (sessionStorage.removeItem('global-search-module') || sessionStorage.getItem('global-search-term') || '') : '');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'RECEIVABLE' | 'OVERDUE' | 'PAID'>('ALL');
  useEffect(() => { try { sessionStorage.removeItem('global-search-term') } catch {} }, [])
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<any>(null);
  const productCatalog = products.filter((p) => p.itemType !== 'SERVICE');
  const serviceCatalog = products.filter((p) => p.itemType === 'SERVICE');
  const findProductForItem = (item: any) => products.find((product: any) => product.id === item?.productId)
    || products.find((product: any) => product.code && (product.code === item?.code || product.code === item?.productCode))
    || products.find((product: any) => String(product.name || '').trim().toLowerCase() === String(item?.description || '').trim().toLowerCase());
  const resolveItemType = (item: any) => item.itemType || (findProductForItem(item)?.itemType === 'SERVICE' ? 'SERVICE' : 'PRODUCT');
  const getItemCatalog = (item: any) => {
    const catalog = resolveItemType(item) === 'SERVICE' ? serviceCatalog : productCatalog;
    if (!item?.productId || catalog.some((product) => product.id === item.productId)) return catalog;
    const linkedProduct = products.find((product) => product.id === item.productId);
    return [...catalog, linkedProduct || { id: item.productId, code: '', name: item.description || 'Artículo vinculado', itemType: item.itemType || 'PRODUCT' }];
  };
  const [localRates, setLocalRates] = useState({ dRate: 0, tRate: 15 });
  const [pricingMode, setPricingMode] = useState<'global' | 'individual'>('global');
  const [isCreating, setIsCreating] = useState(false);
  const [auditInvoiceId, setAuditInvoiceId] = useState<string | null>(null);
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);

  const getCustomerPriceListId = (customerId?: string | null) => {
    const customer = customers.find((entry: any) => entry.id === customerId);
    return customer?.priceListId || (customer as any)?.priceList?.id || null;
  };

  const getCustomerPhone = (): string | null => {
    if (!localDoc?.customerId) return null;
    const customer = customers.find((c: any) => c.id === localDoc.customerId);
    return customer?.phone || null;
  };

  const handleWhatsApp = async () => {
    const phone = getCustomerPhone();
    if (!phone) { toast.error('El cliente no tiene número de teléfono registrado'); return; }
    const digits = phone.replace(/\D/g, '');
    const phoneWithCode = digits.length === 8 ? '505' + digits : (digits.startsWith('505') ? digits : '505' + digits);
    let message = `Hola ${localDoc?.customer?.name || ''}, te compartimos la factura ${localDoc?.number} por un total de ${localDoc?.currency === 'USD' ? '$' : 'C$'}${formatSalesAmount(localDoc?.total)}.`;
    try {
      if (localDoc?.customerId && localDoc?.id) {
        const [documentLink, portalLink] = await Promise.all([
          publicAccessService.createDocumentLink({ customerId: localDoc.customerId, documentType: 'invoice', documentId: localDoc.id, allowPrint: true, allowDownload: true, allowRelated: true }),
          publicAccessService.createPortalLink({ customerId: localDoc.customerId }),
        ]);
        message += `\n\nPodés consultar la factura de forma segura aquí:\n${publicLinkUrl(documentLink.path)}`;
        message += `\n\nPortal del cliente (historial y saldo):\n${publicLinkUrl(portalLink.path)}`;
      } else {
        message += ' Adjunto encontrarás el documento PDF con todos los detalles.';
      }
    } catch (error) {
      console.warn('No se pudo crear el enlace seguro de la factura, se conserva el mensaje actual.', error);
      message += ' Adjunto encontrarás el documento PDF con todos los detalles.';
    }
    const text = encodeURIComponent(message);
    window.open(`https://wa.me/${phoneWithCode}?text=${text}`, '_blank');
  };

  const isSerialTracked = (product: any) =>
    Boolean(
      product?.trackSerialNumbers ||
      product?.serialTracking ||
      product?.serialNumberTracking ||
      String(product?.trackingType || '').toUpperCase() === 'SERIAL',
    );

  const getAvailableSeriesForItem = (item: any) => {
    if (!item?.productId) return [];
    return series.filter((s: any) => {
      const sameProduct = s.productId === item.productId || s.product?.id === item.productId;
      if (!sameProduct) return false;
      if (item.warehouseId) {
        const serialWh = s.warehouseId || s.warehouse?.id;
        if (serialWh && serialWh !== item.warehouseId) return false;
      }
      const status = String(s.status || 'AVAILABLE').toUpperCase();
      return ['AVAILABLE', 'IN_STOCK', 'ACTIVE', ''].includes(status);
    });
  };

  // La factura no tiene una columna propia para el modo de cargos. Se conserva
  // mediante los campos del documento: cargos en las líneas significan
  // "Por producto"; cargos solo en el encabezado significan "Global".
  const inferPricingMode = (doc: any): 'global' | 'individual' => (
    (doc?.items || []).some((line: any) =>
      Number(line.discount || 0) !== 0 || Number(line.taxRate || 0) !== 0 || Number(line.irRate || 0) !== 0,
    ) ? 'individual' : 'global'
  );

  // Helper para mostrar la fecha sin desfase de zona horaria (UTC-local)
  const formatDateSafe = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const [y, m, d] = clean.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    return new Date(y, m - 1, d).toLocaleDateString();
  };

  useEffect(() => {
    if (invoiceDraft) {
      setIsCreating(true);
      setEditingId(null);
      const draftSnapshot = { paymentMethod: 'CASH', accountId: '', ...JSON.parse(JSON.stringify(invoiceDraft)) };
      setLocalDoc(draftSnapshot);
      setPricingMode(inferPricingMode(draftSnapshot));

      const sub = Number(invoiceDraft.subtotal || 0);
      if (sub > 0) {
        const dRate = (Number(invoiceDraft.discountAmount || 0) / sub) * 100;
        const base = sub - Number(invoiceDraft.discountAmount || 0);
        const tRate = base > 0 ? (Number(invoiceDraft.taxAmount || 0) / base) * 100 : 0;
        setLocalRates({ dRate: Math.round(dRate * 100) / 100, tRate: Math.round(tRate * 100) / 100 });
      } else {
        setLocalRates({ dRate: 0, tRate: 15 });
      }

      if (onClearInvoiceDraft) {
        setTimeout(() => onClearInvoiceDraft(), 0);
      }
    } else if (editingId) {
      const inv = data.find(x => x.id === editingId);
      if (inv) {
        const invoiceSnapshot = JSON.parse(JSON.stringify(inv));
        setLocalDoc(invoiceSnapshot);
        setPricingMode(inferPricingMode(invoiceSnapshot));
        const sub = Number(inv.subtotal || 0);
        if (sub > 0) {
          const dRate = (Number(inv.discountAmount || 0) / sub) * 100;
          const base = sub - Number(inv.discountAmount || 0);
          const tRate = base > 0 ? (Number(inv.taxAmount || 0) / base) * 100 : 0;
          setLocalRates({ dRate: Math.round(dRate * 100) / 100, tRate: Math.round(tRate * 100) / 100 });
        }
      }
    } else if (!isCreating) {
      setLocalDoc(null);
    }
  }, [editingId, invoiceDraft, data]);

  useEffect(() => {
    if (targetInvoiceId) {
      const exists = data.find(x => x.id === targetInvoiceId);
      if (exists) {
        setEditingId(targetInvoiceId);
        setIsCreating(false);
        onClearTargetInvoiceId?.();
      }
    }
  }, [targetInvoiceId, data, onClearTargetInvoiceId]);

  const filtered = data.filter(f =>
    (statusFilter === 'ALL' || (statusFilter === 'RECEIVABLE' && ['PENDING', 'OVERDUE', 'PARTIAL'].includes(String(f.status || '').toUpperCase())) || String(f.status || '').toUpperCase() === statusFilter) &&
    (f.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleUpdate = async (id: string | number, updates: Partial<Invoice>) => {
    try {
      await invoicesService.update(id.toString(), updates);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar');
      throw e;
    }
  };

  const handlePayInvoice = async (invoice: Invoice, closeDetail = false) => {
    const invoiceStatus = String(invoice.status || '').toUpperCase();
    if (invoiceStatus === 'PAID') return;
    if (!['DRAFT', 'PENDING', 'PARTIAL', 'OVERDUE'].includes(invoiceStatus)) {
      toast.error('Solo se pueden pagar facturas en borrador o emitidas');
      return;
    }

    const amount = Number(invoice.balance ?? invoice.total ?? 0);
    if (amount <= 0) {
      toast.error('La factura no tiene saldo pendiente');
      return;
    }
    if (invoiceStatus === 'DRAFT' && !invoice.accountId) {
      toast.error('La factura necesita una cuenta contable de venta antes de cobrarla');
      return;
    }

    try {
      setPayingInvoiceId(invoice.id);
      if (invoiceStatus === 'DRAFT') {
        // Formalizar el borrador antes del cobro para que se descuente stock,
        // se genere el asiento de venta y luego el pago pueda conciliarse.
        await invoicesService.update(invoice.id, {
          status: 'PENDING',
          items: (invoice as any).items || [],
        } as any);
      }
      await paymentsService.create({
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        date: new Date().toISOString(),
        amount,
        currency: invoice.currency,
        exchangeRate: invoice.exchangeRate || globalRate,
        method: (invoice as any).paymentMethod || 'CASH',
        notes: `Cobro automático (Factura ${invoice.number})`,
      } as any);

      if (closeDetail && localDoc?.id === invoice.id) {
        setEditingId(null);
        setIsCreating(false);
        setLocalDoc(null);
      }

      toast.success(`Factura ${invoice.number} marcada como pagada y enviada a finanzas y contabilidad`);
      await onRefresh();
    } catch (e: any) {
      console.error('Error al pagar factura:', e);
      const msg = e.response?.data?.message || e.message || 'No se pudo registrar el pago';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setPayingInvoiceId(null);
    }
  };

  const startNewInvoice = () => {
    setIsCreating(true);
    setEditingId(null);
    setLocalDoc({
      customerId: '',
      number: `FAC-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      currency: displayCurrency as any,
      exchangeRate: globalRate,
      items: [],
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      total: 0,
      notes: '',
      sellerEmployeeId: '',
      commissionType: 'PERCENTAGE',
      commissionRate: 0,
      commissionAmount: 0,
      accountId: '',
      paymentMethod: 'CASH',
    });
    setLocalRates({ dRate: 0, tRate: 15 });
  };

  const handleSaveInvoice = async (emitir = false) => {
    if (!localDoc) return;
    if (!localDoc.customerId) {
      toast.error('Selecciona un cliente');
      return;
    }
    if (!localDoc.items || localDoc.items.length === 0) {
      toast.error('Agrega al menos un producto');
      return;
    }
    if (emitir) {
      const priceMessage = getMissingSalesPriceMessage(localDoc.items);
      if (priceMessage) {
        toast.error(priceMessage);
        return;
      }
    }
    if (emitir && !localDoc.accountId) {
      toast.error('Selecciona la cuenta contable de la venta antes de emitir');
      return;
    }
    const serialRows = (localDoc.items || []).filter((item: any) => {
      const p = findProductForItem(item);
      return isSerialTracked(p);
    });
    const seenSerials = new Set<string>();
    for (const row of serialRows) {
      if (!row.warehouseId) {
        toast.error('Selecciona almacén origen para cada producto serializado');
        return;
      }
      const serialNumbers = (row.serialNumbers || []).map((n: string) => String(n || '').trim()).filter(Boolean);
      const unique = new Set(serialNumbers);
      if (serialNumbers.length !== unique.size) {
        toast.error('Hay IMEI repetidos en la misma línea');
        return;
      }
      if (Number(row.quantity || 0) !== serialNumbers.length) {
        toast.error('La cantidad debe coincidir con los IMEI seleccionados');
        return;
      }
      const available = getAvailableSeriesForItem(row).map((s: any) => String(s.number || '').trim());
      for (const serial of serialNumbers) {
        if (seenSerials.has(serial)) {
          toast.error(`El IMEI ${serial} está repetido en más de una línea`);
          return;
        }
        seenSerials.add(serial);
        if (available.length > 0 && !available.includes(serial)) {
          toast.error(`El IMEI ${serial} no está disponible para el producto/almacén seleccionado`);
          return;
        }
      }
    }

    const serialNotes = serialRows.length > 0
      ? `\n[SERIALES]\n${serialRows.map((row: any) => {
          const prod = findProductForItem(row);
          const wh = warehouses.find((w: any) => w.id === row.warehouseId);
          return `${prod?.code || row.productId} (${wh?.name || 'Sin almacén'}): ${(row.serialNumbers || []).join(', ')}`;
        }).join('\n')}`
      : '';

    const baseNotes = String(localDoc.notes || '').split('\n[SERIALES]\n')[0];
    const finalNotes = `${baseNotes}${serialNotes}`.trim();

    try {
      const saveToastId = isCreating ? toast.loading(emitir ? 'Emitiendo factura...' : 'Guardando factura como borrador...') : undefined;
      if (isCreating) {
        await invoicesService.create({
          customerId: localDoc.customerId,
          number: localDoc.number,
          date: new Date(localDoc.date).toISOString(),
          dueDate: new Date(localDoc.dueDate).toISOString(),
          currency: localDoc.currency,
          exchangeRate: Number(localDoc.exchangeRate || globalRate),
          warehouseId: (localDoc as any).warehouseId || warehouses[0]?.id || undefined,
          priceListId: localDoc.priceListId || undefined,
          items: localDoc.items.map((item: any) => ({
            productId: item.productId || undefined,
            warehouseId: item.warehouseId || undefined,
            description: item.description || '',
            quantity: Number(item.quantity || 1),
            unitPrice: Number(item.unitPrice || 0),
            taxRate: Number(item.taxRate || 0),
            discount: Number(item.discount || 0),
            priceListId: item.priceListId || undefined,
            total: Number(item.total || 0),
          })),
          subtotal: Number(localDoc.subtotal || 0),
          taxAmount: Number(localDoc.taxAmount || 0),
          discountAmount: Number(localDoc.discountAmount || 0),
          total: Number(localDoc.total || 0),
          status: emitir ? 'PENDING' : 'DRAFT',
          paymentMethod: localDoc.paymentMethod || 'CASH',
          accountId: localDoc.accountId || undefined,
          notes: finalNotes,
          salesOrderId: localDoc.salesOrderId || undefined,
          sellerEmployeeId: localDoc.sellerEmployeeId || undefined,
          commissionType: localDoc.commissionType || 'PERCENTAGE',
          commissionRate: localDoc.commissionRate || undefined,
          commissionAmount: localDoc.commissionAmount || undefined,
        } as any);
        toast.success(emitir ? 'Factura emitida' : 'Factura guardada como borrador', { id: saveToastId });
      } else {
        await handleUpdate(localDoc.id, {
          ...localDoc,
          items: localDoc.items,
          notes: finalNotes,
          status: emitir ? 'PENDING' : localDoc.status,
        });
        toast.success(emitir ? 'Factura emitida' : 'Factura guardada como borrador', { id: saveToastId });
      }
      setIsCreating(false);
      setEditingId(null);
      setLocalDoc(null);
      onRefresh();
    } catch (e: any) {
      const msg = e.response?.data?.message;
      toast.error(`No se pudo guardar: ${Array.isArray(msg) ? msg.join(', ') : (msg || e.message)}`);
    }
  };

  const recalcTotals = (items: any[], dRate: number, tRate: number) => {
    if (pricingMode === 'individual') return recalcIndividualTotals(items);
    const subtotal = items.reduce((acc: number, it: any) => acc + Number(it.total || 0), 0);
    const discountAmount = subtotal * (dRate / 100);
    const base = subtotal - discountAmount;
    const taxAmount = base * (tRate / 100);
    const total = base + taxAmount;
    return { subtotal, discountAmount, taxAmount, total };
  };

  const recalcIndividualTotals = (items: any[]) => {
    const pricedItems = items.map((line: any) => {
      const gross = Number(line.quantity || 0) * Number(line.unitPrice || 0);
      const discount = gross * (Number(line.discount || 0) / 100);
      const taxable = gross - discount;
      const tax = taxable * (Number(line.taxRate || 0) / 100);
      return { ...line, total: taxable + tax };
    });
    const subtotal = pricedItems.reduce((sum: number, line: any) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);
    const discountAmount = pricedItems.reduce((sum: number, line: any) => sum + (Number(line.quantity || 0) * Number(line.unitPrice || 0) * Number(line.discount || 0) / 100), 0);
    const taxAmount = pricedItems.reduce((sum: number, line: any) => {
      const gross = Number(line.quantity || 0) * Number(line.unitPrice || 0);
      return sum + ((gross - gross * Number(line.discount || 0) / 100) * Number(line.taxRate || 0) / 100);
    }, 0);
    return { items: pricedItems, subtotal, discountAmount, taxAmount, total: subtotal - discountAmount + taxAmount };
  };

  const getInvoiceBalance = (invoice: Partial<Invoice>) => {
    const status = String(invoice.status || '').toUpperCase();
    if (status === 'DRAFT' || status === 'CANCELLED') return 0;
    return Math.max(0, Number(invoice.balance ?? invoice.total ?? 0));
  };



  const columns: ColumnDef<Invoice>[] = [
    {
      key: 'number',
      header: 'Nº Factura',
      width: '140px',
      render: (val, row) => <span className="text-xs font-black font-mono text-primary cursor-pointer hover:underline" onClick={() => setEditingId(row.id)}>{val}</span>
    },
    {
      key: 'customer',
      header: 'Cliente',
      render: (_val, row) => <span className="text-[13px] font-bold text-foreground">{row.customer?.name || 'Varios'}</span>
    },
    {
      key: 'date',
      header: 'Fecha Emisión',
      render: (val) => <span className="text-xs font-medium text-muted-foreground">{formatDateSafe(val)}</span>
    },
    {
      key: 'dueDate',
      header: 'Vencimiento',
      render: (val, row) => (
        <span className={cn(
          "text-xs font-bold",
          (row.status || '').toUpperCase() === 'OVERDUE' ? 'text-rose-500' : 'text-muted-foreground'
        )}>
          {new Date(val).toLocaleDateString()}
        </span>
      )
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
      key: 'balance',
      header: 'Saldo deudor',
      width: '150px',
      render: (_val, row) => (
        <span className={cn(
          "text-[13px] font-black tabular-nums",
          getInvoiceBalance(row) > 0 ? "text-orange-500" : "text-emerald-500"
        )}>
          {formatConvertedAmount(getInvoiceBalance(row), row.currency, row.exchangeRate)}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Estado',
      width: '110px',
      render: (val) => {
        const opt = statusOptions.find(o => o.value === (val || '').toUpperCase());
        return (
          <Badge variant="outline" className={cn(
            "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none",
            opt?.color || 'bg-muted/20 text-muted-foreground'
          )}>
            {opt?.label || val}
          </Badge>
        );
      }
    }
  ];

  const totalBilledInDisplayCurrency = data.reduce(
    (acc, invoice) => acc + convertAmount(invoice.total || 0, invoice.currency, invoice.exchangeRate),
    0,
  );
  const accountsReceivableInDisplayCurrency = data
    .filter(invoice => ['PENDING', 'OVERDUE', 'PARTIAL'].includes((invoice.status || '').toUpperCase()))
    .reduce((acc, invoice) => acc + convertAmount(getInvoiceBalance(invoice), invoice.currency, invoice.exchangeRate), 0);
  const paidInDisplayCurrency = data.reduce(
    (acc, invoice) => acc + convertAmount(Number(invoice.amountPaid || 0), invoice.currency, invoice.exchangeRate),
    0,
  );

  // ─── INLINE EDITOR VIEW ────────────────────────────────────────────────
  if ((editingId || isCreating) && localDoc) {
    const isInvoiceLocked = !isCreating && ['PAID', 'CANCELLED'].includes(String(localDoc?.status || '').toUpperCase());
    const isCashRegisterInvoice = !isCreating && Boolean(localDoc?.registerId || localDoc?.sessionId);
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => { setEditingId(null); setIsCreating(false); setLocalDoc(null); }} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isCreating ? 'Nueva Factura' : `Factura ${localDoc?.number}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{isCreating ? 'Completar datos para crear factura' : 'Detalle de la factura'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isCreating && localDoc?.customerId && (
              <Button variant="outline" onClick={handleWhatsApp} className="rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50 gap-2 font-black uppercase text-[10px] tracking-widest px-4">
                <MessageCircle className="size-3.5" /> WhatsApp
              </Button>
            )}
            {!isInvoiceLocked && ((isCreating && canPerform('SALES_INVOICES', 'create')) || (!isCreating && canPerform('SALES_INVOICES', 'edit'))) && (
              <>
                <Button variant="outline" className="rounded-xl border-border/50 font-black uppercase text-[10px] tracking-widest px-6"
                  onClick={() => handleSaveInvoice(false)}>
                  Guardar Borrador
                </Button>
                <Button className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6"
                  onClick={() => handleSaveInvoice(true)}>
                  Emitir Factura
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50">
            <CardContent className="min-w-0 p-4 space-y-3 sm:p-6">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información General</p>
              <div className="grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Número</p>
                   <Input value={localDoc?.number || ''} onChange={(e) => setLocalDoc({ ...localDoc, number: e.target.value })} className="h-8 text-xs font-black uppercase" disabled={isInvoiceLocked} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Cliente</p>
                  <Combobox
                    options={customers
                      .filter(c => (c.status || '').toUpperCase() === 'ACTIVE' || c.id === localDoc?.customerId)
                      .map(c => ({ label: c.name, value: c.id, description: (c.code ? `[${c.code}] ` : '') + (c.phone || 'Sin teléfono') }))}
                    value={localDoc?.customerId || ''}
                    onChange={(val) => {
                      const priceListId = getCustomerPriceListId(val);
                      const items = (localDoc.items || []).map((item: any) => item.productId
                        ? { ...item, priceListId, unitPrice: 0, total: 0, priceMissing: false }
                        : { ...item, priceListId });
                      setLocalDoc({ ...localDoc, customerId: val, priceListId, items });
                      if (!isCreating) handleUpdate(localDoc!.id, { customerId: val, priceListId, items });
                    }}
                    placeholder="Seleccionar Cliente"
                    disabled={isInvoiceLocked}
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha Emisión</p>
                  <Input type="date" value={localDoc?.date ? (typeof localDoc.date === 'string' && localDoc.date.includes('T') ? localDoc.date.split('T')[0] : localDoc.date) : ''}
                    onChange={(e) => setLocalDoc({ ...localDoc, date: e.target.value })} className="h-8 text-xs" disabled={isInvoiceLocked} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Vencimiento</p>
                  <Input type="date" value={localDoc?.dueDate ? (typeof localDoc.dueDate === 'string' && localDoc.dueDate.includes('T') ? localDoc.dueDate.split('T')[0] : localDoc.dueDate) : ''}
                    onChange={(e) => setLocalDoc({ ...localDoc, dueDate: e.target.value })} className="h-8 text-xs" disabled={isInvoiceLocked} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Vendedor (Opcional)</p>
                  <Combobox
                    options={(employees || []).map(e => ({ label: `${e.firstName} ${e.lastName}`, value: e.id, description: e.position?.title }))}
                    value={localDoc?.sellerEmployeeId || ''}
                    onChange={(val) => { setLocalDoc({ ...localDoc, sellerEmployeeId: val }); if (!isCreating) handleUpdate(localDoc!.id, { sellerEmployeeId: val }); }}
                    placeholder="Seleccionar Vendedor"
                    disabled={isInvoiceLocked}
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Tipo de comisión</p>
                  <Select
                    value={localDoc?.commissionType || 'PERCENTAGE'}
                     disabled={isInvoiceLocked || !localDoc?.sellerEmployeeId}
                    onValueChange={(commissionType) => {
                      const nextType = commissionType as 'PERCENTAGE' | 'FIXED';
                      const updates = nextType === 'FIXED'
                        ? { commissionType: nextType, commissionRate: 0 }
                        : { commissionType: nextType, commissionAmount: 0 };
                      setLocalDoc({ ...localDoc, ...updates } as any);
                      if (!isCreating) void handleUpdate(localDoc!.id, updates as any);
                    }}
                  >
                    <SelectTrigger className={cn("h-8 text-xs", !localDoc?.sellerEmployeeId && "opacity-50 cursor-not-allowed bg-muted/20")}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENTAGE">Porcentaje</SelectItem>
                      <SelectItem value="FIXED">Monto fijo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">{localDoc?.commissionType === 'FIXED' ? 'Monto de comisión' : '% Comisión'}</p>
                  <Input
                    type="number"
                    min="0"
                    max={localDoc?.commissionType === 'FIXED' ? undefined : 100}
                    value={localDoc?.commissionType === 'FIXED' ? (localDoc?.commissionAmount || '') : (localDoc?.commissionRate || '')}
                    placeholder="0"
                     disabled={isInvoiceLocked || !localDoc?.sellerEmployeeId}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setLocalDoc({ ...localDoc, ...(localDoc?.commissionType === 'FIXED' ? { commissionAmount: value } : { commissionRate: value }) } as any);
                    }}
                    onBlur={() => {
                      if (isCreating || !localDoc?.sellerEmployeeId) return;
                      const updates = localDoc.commissionType === 'FIXED'
                        ? { commissionAmount: Number(localDoc.commissionAmount || 0), commissionRate: 0 }
                        : { commissionRate: Number(localDoc.commissionRate || 0), commissionAmount: 0 };
                      void handleUpdate(localDoc.id, updates as any);
                    }}
                    className={cn("h-8 text-xs", !localDoc?.sellerEmployeeId && "opacity-50 cursor-not-allowed bg-muted/20")}
                  />
                  {!localDoc?.sellerEmployeeId && <p className="text-[9px] text-muted-foreground/60 mt-0.5 italic">Selecciona un empleado primero</p>}
                </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Moneda de la transacción</p>
                     <Select disabled={isInvoiceLocked} value={localDoc?.currency || 'NIO'} onValueChange={(currency) => {
                      const exchangeRate = currency === 'NIO' ? 1 : Number(globalRate || 1);
                      setLocalDoc({ ...localDoc, currency, exchangeRate } as any);
                      void handleUpdate(localDoc!.id, { currency, exchangeRate } as any);
                    }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar moneda" /></SelectTrigger>
                      <SelectContent><SelectItem value="NIO">Córdobas (C$)</SelectItem><SelectItem value="USD">Dólares (US$)</SelectItem></SelectContent>
                    </Select>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">Tasa configurada: <span className="font-bold">{localDoc?.currency === 'NIO' ? '1.00' : Number(localDoc?.exchangeRate || globalRate || 1).toFixed(2)}</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Forma sugerida para el cobro</p>
                     <select disabled={isInvoiceLocked} value={localDoc?.paymentMethod || 'CASH'} onChange={(event) => setLocalDoc({ ...localDoc, paymentMethod: event.target.value })} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase">
                      <option value="CASH">Efectivo</option>
                      <option value="CARD">Tarjeta</option>
                      <option value="TRANSFER">Transferencia</option>
                      <option value="CHECK">Cheque</option>
                    </select>
                  </div>
                  <AccountingAccountSelect
                    value={localDoc?.accountId || ''}
                    onChange={(accountId) => {
                      setLocalDoc({ ...localDoc, accountId });
                      if (!isCreating) void handleUpdate(localDoc!.id, { accountId });
                     }}
                     label={isCashRegisterInvoice ? 'Cuenta contable de la caja' : 'Cuenta contable de la venta'}
                     required
                     disabled={isInvoiceLocked || isCashRegisterInvoice}
                   />
                   {isCashRegisterInvoice && <p className="mt-1 text-[10px] italic text-muted-foreground">Cuenta definida por la caja de facturación; no se puede cambiar.</p>}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50">
            <CardContent className="min-w-0 p-4 space-y-3 sm:p-6">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resumen Financiero</p>
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-muted/10 p-2 text-[10px] font-black uppercase tracking-widest">
                <span className="text-muted-foreground">Aplicar impuestos/descuentos:</span>
                 <Button type="button" disabled={isInvoiceLocked} size="sm" variant={pricingMode === 'global' ? 'default' : 'outline'} className="h-7 rounded-lg px-2 text-[10px]" onClick={() => { setPricingMode('global'); setLocalRates({ dRate: 0, tRate: 15 }); }}>Global</Button>
                 <Button type="button" disabled={isInvoiceLocked} size="sm" variant={pricingMode === 'individual' ? 'default' : 'outline'} className="h-7 rounded-lg px-2 text-[10px]" onClick={() => { setPricingMode('individual'); setLocalRates({ dRate: 0, tRate: 0 }); }}>{'Por producto'}</Button>
              </div>
              <div className="space-y-3">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">Subtotal</span>
                  <div className="flex min-w-0 items-center gap-2">{localDoc?.currency === 'USD' ? '$' : 'C$'} <Input type="text" value={formatSalesAmount(localDoc?.subtotal)} readOnly className="h-8 w-24 max-w-full text-right font-bold bg-muted/20" /></div></div>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">Descuento</span>
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-rose-500">
                    <div className="flex items-center mr-2">{pricingMode === 'global' ? <Input type="number" min="0" max="100" value={localRates.dRate || ''} placeholder="0" onChange={(e) => {
                      const newRate = Number(e.target.value); setLocalRates(p => ({ ...p, dRate: newRate }));
                      const calc = recalcTotals(localDoc?.items || [], newRate, localRates.tRate);
                      setLocalDoc({ ...localDoc, ...calc });
                     }} className="w-16 h-8 text-right font-bold text-rose-500 bg-transparent" disabled={isInvoiceLocked} /> : null} {pricingMode === 'global' && <span className="ml-1 text-xs font-black">%</span>}</div>
                    -{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(localDoc?.discountAmount)}
                  </div></div>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-sm"><span className="text-muted-foreground">IVA</span>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    {pricingMode === 'global' && <label className="flex h-8 items-center gap-1.5 rounded-md bg-muted/30 px-2 text-xs font-black">
                      <input type="checkbox" checked={Number(localRates.tRate || 0) > 0} onChange={(e) => {
                        const newRate = e.target.checked ? 15 : 0;
                        const calc = recalcTotals(localDoc?.items || [], localRates.dRate, newRate);
                        setLocalRates(p => ({ ...p, tRate: newRate }));
                        setLocalDoc({ ...localDoc, ...calc });
                       }} disabled={isInvoiceLocked} /> Aplicar
                    </label>}
                    {localDoc?.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(localDoc?.taxAmount)}
                  </div></div>
                <div className="flex justify-between items-center text-base border-t pt-3 border-border/50">
                  <span className="font-black">Total</span>
                  <div className="flex flex-col items-end">
                    <span className="text-primary font-black text-lg">{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(localDoc?.total)}</span>
                    {localDoc?.currency === 'USD' && <p className="text-[10px] font-bold text-muted-foreground mt-1 italic">≈ C$ {formatSalesAmount(Number(localDoc?.total || 0) * (localDoc?.exchangeRate || globalRate))}</p>}
                    {localDoc?.currency === 'NIO' && <p className="text-[10px] font-bold text-muted-foreground mt-1 italic">≈ $ {formatSalesAmount(Number(localDoc?.total || 0) / (localDoc?.exchangeRate || globalRate))}</p>}
                  </div>
                </div>
                {!isCreating && String(localDoc?.status || '').toUpperCase() !== 'DRAFT' && (
                  <div className="flex justify-between items-center border-t border-border/40 pt-3">
                    <span className="text-sm font-black text-orange-500">Saldo deudor</span>
                    <span className="text-orange-500 font-black text-lg">{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(getInvoiceBalance(localDoc))}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Items */}
        <Card className="rounded-2xl border-border/50">
            <CardContent className="min-w-0 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Productos / Servicios</p>
              <div className="flex flex-wrap gap-2">
                {(['PRODUCT', 'SERVICE'] as const).map((itemType) => <Button key={itemType} type="button" variant="outline" size="sm" disabled={isInvoiceLocked} onClick={() => {
                  const newItems = [...(localDoc.items || []), { id: Date.now().toString(), itemType, description: '', quantity: 1, unitPrice: 0, total: 0, productId: null, warehouseId: '', serialNumbers: [] }];
                  setLocalDoc({ ...localDoc, items: newItems });
                }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl"><Plus className="size-3 mr-2" /> Agregar {itemType === 'PRODUCT' ? 'Producto' : 'Servicio'}</Button>)}
              </div>
            </div>
            <div className="space-y-2">
              <div className="hidden xl:grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                <div className={cn("xl:col-span-6", pricingMode === 'individual' && "xl:col-span-5")}>Descripción</div>
                {pricingMode === 'individual' && <div className="col-span-2" />}
                <div className={cn("col-span-2 text-right", pricingMode === 'individual' && "xl:col-span-1")}>Cant.</div>
                <div className="col-span-2 text-right">Precio U.</div>
                <div className="col-span-2 text-right">Total</div>
              </div>
              {(localDoc.items || []).map((item: any, idx: number) => (
                <div key={item.id || idx} data-item-layout="standard" className="sales-item-row grid min-w-0 grid-cols-1 gap-3 rounded-xl border border-border/50 bg-muted/5 p-3 items-start xl:grid-cols-12 xl:gap-2 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0">
                  <div className={cn("min-w-0 xl:col-span-6", pricingMode === 'individual' && "xl:col-span-5")}>
                    <div className="flex min-w-0 flex-wrap items-center gap-1">
                      <div className="min-w-0 flex-1">
                        <Combobox
                          options={getItemCatalog(item).map(p => ({ label: `${String(p.itemType || resolveItemType(item)).toUpperCase() === 'SERVICE' ? 'Servicio' : 'Producto'} · ${p.code || ''} - ${p.name}`, value: p.id }))}
                          value={item.productId || ''}
                          onChange={(val) => {
                        const newItems = [...(localDoc.items || [])];
                        const selectedProd = (resolveItemType(item) === 'SERVICE' ? serviceCatalog : productCatalog).find(p => p.id === val);
                        newItems[idx] = { ...newItems[idx], productId: val, warehouseId: '', serialNumbers: [] };
                        if (selectedProd) {
                          newItems[idx].description = selectedProd.name;
                          const baseSalePrice = Number(selectedProd.salePrice ?? selectedProd.price ?? 0);
                          newItems[idx].unitPrice = localDoc?.currency === 'USD' ? baseSalePrice / Number(localDoc?.exchangeRate || globalRate || 1) : baseSalePrice;
                          newItems[idx].total = Number(newItems[idx].quantity) * Number(newItems[idx].unitPrice);
                        }
                        const calc = recalcTotals(newItems, localRates.dRate, localRates.tRate);
                        setLocalDoc({ ...localDoc, items: newItems, ...calc });
                        if (!isCreating) {
                          handleUpdate(localDoc!.id, { items: newItems, ...calc });
                        }
                          }}
                          placeholder={resolveItemType(item) === 'SERVICE' ? 'Seleccionar servicio...' : 'Seleccionar producto...'}
                          disabled={isInvoiceLocked}
                        />
                      </div>
                      <SalesLinePriceListSelect
                        productId={item.productId}
                        productCode={products.find((product) => product.id === item.productId)?.code || (item as any).code}
                        productName={item.description}
                        itemType={item.itemType}
                        value={item.priceListId}
                        defaultPriceListId={localDoc?.priceListId || getCustomerPriceListId(localDoc?.customerId)}
                        currency={localDoc?.currency}
                        exchangeRate={Number(localDoc?.exchangeRate || globalRate || 1)}
                        disabled={isInvoiceLocked}
                        onChange={(priceListId, result, source) => {
                          const nextItems = [...(localDoc.items || [])] as any[];
                          nextItems[idx] = {
                            ...nextItems[idx],
                            priceListId,
                            unitPrice: result.unitPrice ?? 0,
                            total: Number(nextItems[idx].quantity || 1) * Number(result.unitPrice ?? 0),
                            priceMissing: result.priceMissing,
                          };
                          const calc = recalcTotals(nextItems, localRates.dRate, localRates.tRate);
                          setLocalDoc({ ...localDoc, ...calc, priceListId, items: calc.items } as any);
                          if (!isCreating && source !== 'initial') void handleUpdate(localDoc!.id, { ...calc, priceListId, items: calc.items } as any);
                        }}
                      />
                    </div>
                    {item.productId && (
                      <div className="mt-1 flex items-center gap-2 px-1">
                        {(() => {
                          const p = findProductForItem(item);
                          if (!p) return null;
                          const stock = Number(p.stock || 0);
                          return (
                            <>
                              <Badge variant="outline" className={cn(
                                "text-[9px] font-black border-none px-1.5 py-0 h-4 bg-muted/20",
                                stock <= 0 ? "text-rose-500 bg-rose-500/10" : "text-emerald-500 bg-emerald-500/10"
                              )}>
                                STOCK: {stock}
                              </Badge>
                              {item.priceMissing && <PriceMissingBadge />}
                            </>
                          );
                        })()}
                      </div>
                    )}
                    {item.productId && isSerialTracked(findProductForItem(item)) && (
                      <div className="mt-2 space-y-2 rounded-md border border-border/50 p-2 bg-muted/10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Almacén origen</p>
                            <Select disabled={isInvoiceLocked}
                              value={item.warehouseId || ''}
                              onValueChange={(val) => {
                                const newItems = [...(localDoc.items || [])];
                                newItems[idx] = { ...newItems[idx], warehouseId: val, serialNumbers: [] };
                                setLocalDoc({ ...localDoc, items: newItems });
                              }}
                            >
                              <SelectTrigger className="h-8 text-[10px]"><SelectValue placeholder="Seleccionar almacén" /></SelectTrigger>
                              <SelectContent>
                                {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">IMEI/Series (uno por línea)</p>
                            <textarea
                              value={(item.serialNumbers || []).join('\n')}
                              onChange={(e) => {
                                const serialNumbers = e.target.value
                                  .split('\n')
                                  .map((n) => n.trim())
                                  .filter(Boolean);
                                const newItems = [...(localDoc.items || [])];
                                newItems[idx] = {
                                  ...newItems[idx],
                                  serialNumbers,
                                  quantity: serialNumbers.length > 0 ? serialNumbers.length : Number(newItems[idx].quantity || 1),
                                  total: (serialNumbers.length > 0 ? serialNumbers.length : Number(newItems[idx].quantity || 1)) * Number(newItems[idx].unitPrice || 0),
                                };
                                const calc = recalcTotals(newItems, localRates.dRate, localRates.tRate);
                                setLocalDoc({ ...localDoc, items: newItems, ...calc });
                              }}
                              disabled={isInvoiceLocked}
                              className="w-full h-20 rounded-md border border-input bg-background px-2 py-1 text-[10px] font-mono"
                              placeholder="Pega o escanea IMEI..."
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Disponibles: {getAvailableSeriesForItem(item).length} · Seleccionados: {(item.serialNumbers || []).length}
                        </p>
                      </div>
                    )}
                  </div>
                  {pricingMode === 'individual' && (
                    <div className="col-span-2 mt-0 flex min-w-0 items-start gap-2 self-start text-[10px]">
                      <label className="flex min-w-0 flex-1 flex-col items-start gap-1 font-black uppercase tracking-wider">
                        <span className="flex h-8 w-full items-center gap-1.5 rounded-md bg-muted/30 px-2">
                          <input type="checkbox" checked={Number(item.taxRate || 0) > 0} onChange={(event) => {
                            const nextItems = [...(localDoc.items || [])];
                            nextItems[idx] = { ...nextItems[idx], taxRate: event.target.checked ? 15 : 0 };
                            const recalculated = recalcTotals(nextItems, 0, 0);
                            setLocalDoc({ ...localDoc, ...recalculated });
                            if (!isCreating) void handleUpdate(localDoc!.id, recalculated as any);
                       }} disabled={isInvoiceLocked} />
                          <span className="text-xs">Aplicar</span>
                        </span>
                      </label>
                      <label className="flex min-w-0 flex-1 flex-col items-start gap-1 font-black uppercase tracking-wider">
                        <Input type="number" min="0" max="100" value={item.discount || ''} onChange={(event) => {
                          const nextItems = [...(localDoc.items || [])];
                          nextItems[idx] = { ...nextItems[idx], discount: Number(event.target.value) || 0 };
                          const recalculated = recalcTotals(nextItems, 0, 0);
                          setLocalDoc({ ...localDoc, ...recalculated });
                          if (!isCreating) void handleUpdate(localDoc!.id, recalculated as any);
                         }} className="h-8 w-full rounded-md bg-muted/30 text-right text-xs" disabled={isInvoiceLocked} />
                      </label>
                    </div>
                  )}
                  <div className={cn("min-w-0 xl:col-span-2", pricingMode === 'individual' && "xl:col-span-1")}>
                    <Input type="number" min="0" max={Number(findProductForItem(item)?.stock || 1000000)} value={Number(item.quantity) || ''} placeholder="0"
                      onChange={(e) => {
                        let newQty = Number(e.target.value);
                        const p = findProductForItem(item);
                        if (p && newQty > Number(p.stock || 0)) {
                          toast.warning(`Stock insuficiente. Disponible: ${p.stock}`, { id: `stock-warn-${idx}` });
                          newQty = Number(p.stock || 0);
                        }
                        const newItems = [...(localDoc.items || [])];
                        newItems[idx] = { ...newItems[idx], quantity: newQty, total: newQty * Number(newItems[idx].unitPrice || 0) };
                        const calc = recalcTotals(newItems, localRates.dRate, localRates.tRate);
                        setLocalDoc({ ...localDoc, items: newItems, ...calc });
                      }} onBlur={() => {
                        if (!isCreating) {
                          const calc = recalcTotals(localDoc.items || [], localRates.dRate, localRates.tRate);
                          handleUpdate(localDoc!.id, { items: localDoc.items, ...calc });
                        }
                       }} className="h-8 w-full text-xs text-right" disabled={Boolean(item.productId && isSerialTracked(findProductForItem(item))) || isInvoiceLocked} />
                  </div>
                  <div className="col-span-2">
                    <Input type="text" inputMode="decimal" min="0" value={item.unitPrice === undefined || item.unitPrice === null ? '' : formatSalesAmount(item.unitPrice)} placeholder="0"
                      onChange={(e) => {
                        const newItems = [...(localDoc.items || [])];
                        const unitPrice = Number(String(e.target.value).replace(/,/g, '')) || 0;
                        newItems[idx] = { ...newItems[idx], unitPrice, total: Number(newItems[idx].quantity || 1) * unitPrice };
                        const calc = recalcTotals(newItems, localRates.dRate, localRates.tRate);
                        setLocalDoc({ ...localDoc, items: newItems, ...calc });
                      }} onBlur={() => {
                        if (!isCreating) {
                          const calc = recalcTotals(localDoc.items || [], localRates.dRate, localRates.tRate);
                          handleUpdate(localDoc!.id, { items: localDoc.items, ...calc });
                        }
                       }} className="h-8 w-full text-xs text-right" disabled={isInvoiceLocked} />
                  </div>
                  <div className="flex min-w-0 items-center justify-between gap-2 text-right xl:col-span-2">
                    <span className="text-xs font-black">{localDoc?.currency === 'USD' ? '$' : 'C$'} {formatSalesAmount(item.total)}</span>
                     <Button type="button" variant="ghost" size="icon" disabled={isInvoiceLocked} className="size-6 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 rounded-md" onClick={() => {
                      const newItems = [...(localDoc.items || [])]; newItems.splice(idx, 1);
                      const calc = recalcTotals(newItems, localRates.dRate, localRates.tRate);
                      setLocalDoc({ ...localDoc, items: newItems, ...calc });
                    }}><Trash2 className="size-3" /></Button>
                  </div>
                </div>
              ))}
              {(!localDoc.items || localDoc.items.length === 0) && (
                <div className="text-center py-6 text-xs text-muted-foreground/50 italic border border-dashed border-border/50 rounded-xl bg-muted/10">
                  No hay productos asignados. Haz clic en "Agregar Item".
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-6">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Notas</p>
            <textarea disabled={isInvoiceLocked} value={localDoc?.notes || ''} onChange={(e) => setLocalDoc({ ...localDoc, notes: e.target.value })}
              className="w-full h-20 rounded-md border border-input bg-background px-3 py-2 text-sm resize-none" placeholder="Agregar notas..." />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── TABLE VIEW ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SalesKpiCard title={`Facturado Total (${displayCurrency})`} value={formatConvertedAmount(totalBilledInDisplayCurrency, displayCurrency)} icon={FileText} color="text-primary" bg="bg-primary/10" />
        <SalesKpiCard title={`Por Cobrar (${displayCurrency})`} value={formatConvertedAmount(accountsReceivableInDisplayCurrency, displayCurrency)} icon={TrendingUp} color="text-orange-500" bg="bg-orange-500/10" active={statusFilter === 'RECEIVABLE'} onClick={() => setStatusFilter(statusFilter === 'RECEIVABLE' ? 'ALL' : 'RECEIVABLE')} />
        <SalesKpiCard title="Vencidas" value={data.filter(f => (f.status || '').toUpperCase() === 'OVERDUE').length} icon={AlertCircle} color="text-rose-500" bg="bg-rose-500/10" active={statusFilter === 'OVERDUE'} onClick={() => setStatusFilter(statusFilter === 'OVERDUE' ? 'ALL' : 'OVERDUE')} />
        <SalesKpiCard title={`Cobrado (${displayCurrency})`} value={formatConvertedAmount(paidInDisplayCurrency, displayCurrency)} icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-500/10" active={statusFilter === 'PAID'} onClick={() => setStatusFilter(statusFilter === 'PAID' ? 'ALL' : 'PAID')} />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-2">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground" data-tour="sales-list-title">Control de Facturación</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Gestión de recaudos masivos sin fricción.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3" data-tour="sales-list-actions">
            <SalesViewTutorial view="invoices" />
            <SalesDateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChange={onDateRangeChange || (() => undefined)} />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input
                placeholder="Buscar factura..."
                className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold tracking-widest"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }}
              />
            </div>
            {canPerform('SALES_INVOICES', 'create') && (
              <Button onClick={startNewInvoice} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20">
                <Plus className="size-4" /> Nueva Factura
              </Button>
            )}
          </div>
        </div>
        <EditableDataTable
          data={filtered}
          pagination={pagination}
        columns={columns}
        showHorizontalControls
        actionsWidth="w-52"
        fitContent
          onRowUpdate={async (id, updates) => { await handleUpdate(id, updates); }}
          onRowClick={(row) => setEditingId(row.id)}
        onBulkDelete={async (ids) => {
            await Promise.all(ids.map(id => invoicesService.cancel(id.toString(), 'Anulación masiva')));
            toast.success(`${ids.length} Facturas anuladas`);
            onRefresh();
          }}
          isLoading={loading}
          bulkActions={() => null}
          actions={(row) => (
              <div className="flex min-w-max items-center justify-end gap-2 pr-1">
                <Button type="button" title="Descargar PDF" aria-label="Descargar PDF" variant="ghost" size="icon" className="relative z-20 size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-muted-foreground transition-colors" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void (async () => {
                    try {
                      await generateEstimatePDF({ estimate: row, tenantName: user?.tenantName || 'Empresa', formatAmount: formatConvertedAmount as any, tenantLogo: themeConfig?.logo, documentType: 'invoice' as any });
                      toast.success('PDF descargado');
                    } catch (error: any) {
                      toast.error(error?.message || 'No se pudo descargar el PDF');
                    }
                  })();
                }}><FileDown className="size-4 text-muted-foreground" /></Button>
                <Button title="Ver Historial" variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-muted-foreground transition-colors" onClick={() => setAuditInvoiceId(row.id)}><History className="size-4 text-muted-foreground" /></Button>
                {canPerform('SALES_PAYMENTS', 'create') &&
                  !['PAID', 'CANCELLED'].includes(String(row.status).toUpperCase()) &&
                  Number(row.balance ?? row.total ?? 0) > 0 && (
                  <Button type="button" title="Pagar factura" variant="ghost" size="icon" disabled={payingInvoiceId === row.id} className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-muted-foreground transition-colors" onClick={() => void handlePayInvoice(row)}>
                    {payingInvoiceId === row.id ? <Loader2 className="size-4 text-muted-foreground animate-spin" /> : <CheckCircle2 className="size-4 text-muted-foreground" />}
                  </Button>
                )}
                <Button title="Ver detalle" variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-muted-foreground transition-colors" onClick={() => setEditingId(row.id)}><Eye className="size-4 text-muted-foreground" /></Button>
                {canPerform('SALES_INVOICES', 'delete') && row.status !== 'CANCELLED' && (
                  <Button title="Cancelar factura" aria-label="Cancelar factura" variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-muted/40 hover:text-muted-foreground transition-colors" onClick={() => { setPendingCancelId(row.id); setCancelReason(''); }}><Ban className="size-4 text-muted-foreground" /></Button>
                )}
              </div>
          )}
        />
      </div>

      <ConfirmDialog
        open={pendingCancelId !== null}
        onOpenChange={(open) => { if (!open) { setPendingCancelId(null); setCancelReason(''); } }}
        title={"¿Cancelar factura?"}
        description="La factura quedará cancelada y no afectará reportes financieros. Esta acción no se puede deshacer."
        confirmLabel="Cancelar factura"
        variant="destructive"
        loading={cancelLoading}
        disabled={!cancelReason.trim()}
        onConfirm={async () => {
          if (!pendingCancelId || !cancelReason.trim()) return;
          try {
            setCancelLoading(true);
            await invoicesService.cancel(pendingCancelId, cancelReason.trim());
            toast.success('Factura anulada');
            setEditingId(null);
            setIsCreating(false);
            onRefresh();
          } catch (error: any) {
            toast.error(error?.response?.data?.message || error?.message || 'Error al anular factura');
          } finally {
            setCancelLoading(false);
            setPendingCancelId(null);
            setCancelReason('');
          }
        }}
      >
        <div className="mt-4">
          <label className="text-sm font-medium text-foreground mb-1 block">Motivo de cancelación *</label>
          <textarea
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
            rows={3}
            placeholder="Ej: Cliente solicitó cancelación, error en datos fiscales..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </div>
      </ConfirmDialog>

      <AuditHistoryModal
        isOpen={!!auditInvoiceId}
        onClose={() => setAuditInvoiceId(null)}
        entity="INVOICE"
        entityId={auditInvoiceId || ''}
        title="Historial de la Factura"
      />
    </div>
  );
}


