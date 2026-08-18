import { useState } from 'react';
import {
  BadgeDollarSign, Plus, Search, TrendingUp, Clock, CheckCircle2, CircleDollarSign,
  Eye, Trash2, ChevronLeft, Send, CreditCard, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { creditNotesService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import type { CreditNote, Customer, Product, SalesPaginationControls } from '../../types';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { AccountingAccountSelect } from '../ui/AccountingAccountSelect';
import { BankAccountSelect } from '../ui/BankAccountSelect';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { generateEstimatePDF } from '../../utils/pdfGenerator';
import { SalesAccountingLegend } from './SalesAccountingLegend';
import { SalesDateRangeFilter } from './SalesDateRangeFilter';
import { SalesViewTutorial } from './SalesViewTutorial';
import { SalesKpiCard } from './SalesKpiCard';
import { SalesLinePriceListSelect, PriceMissingBadge } from './SalesLinePriceListSelect';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { formatDateEs } from '../../utils/dateFormat';
import { isBankPaymentMethod, requiresManualPaymentAccount, requiresPaymentReference } from '../../utils/paymentMethods';
import { SalesDocumentDetailSheet, type SalesDocumentPanelData } from './SalesDocumentDetailSheet';
import { CurrencySelector } from '../ui/CurrencySelector';

interface NotasCreditoViewProps {
  data: CreditNote[];
  loading: boolean;
  onRefresh: () => void;
  customers?: Customer[];
  products?: Product[];
  salesAlert?: unknown;
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  dateFrom?: string;
  dateTo?: string;
  onDateRangeChange?: (dateFrom: string, dateTo: string) => void;
}

const statusOptions = [
  { label: 'Borrador', value: 'DRAFT', color: 'bg-muted/20 text-muted-foreground' },
  { label: 'Activo', value: 'ISSUED', color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Pago parcial', value: 'PARTIAL', color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Pagado', value: 'PAID', color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Anulado', value: 'VOIDED', color: 'bg-rose-500/10 text-rose-500' },
];

const methodOptions = [
  { label: 'Transferencia', value: 'TRANSFER' },
  { label: 'Efectivo', value: 'CASH' },
  { label: 'Tarjeta', value: 'CARD' },
  { label: 'Cheque', value: 'CHECK' },
];

const isoDate = (value: unknown) => {
  if (!value) return '';
  const text = String(value);
  return text.includes('T') ? text.split('T')[0] : text;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().split('T')[0];
};

const toWholeQuantity = (value: string | number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
};

export function NotasCreditoView({ data, loading, onRefresh, customers = [], products = [], pagination, onSearchChange, dateFrom = '', dateTo = '', onDateRangeChange }: NotasCreditoViewProps) {
  const { exchangeRate: globalRate, displayCurrency, baseCurrency, formatConvertedAmount, toBaseAmount, convertBetweenCurrencies } = useCurrency();
  const { user, canPerform } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('sales-credits-layout', 'table', 24 * 365);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'ISSUED' | 'PARTIAL' | 'PAID'>('ALL');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<any>(null);
  const [detailCredit, setDetailCredit] = useState<CreditNote | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [paymentCredit, setPaymentCredit] = useState<CreditNote | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentCurrency, setPaymentCurrency] = useState<'NIO' | 'USD'>('NIO');
  const [paymentMethod, setPaymentMethod] = useState('TRANSFER');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentBankAccountId, setPaymentBankAccountId] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [referenceNow] = useState(() => Date.now());

  const productCatalog = products.filter((product) => product.itemType !== 'SERVICE');
  const serviceCatalog = products.filter((product) => product.itemType === 'SERVICE');
  const customerFor = (id?: string | null) => customers.find((customer) => customer.id === id);
  const getCustomerPriceListId = (customerId?: string | null) => {
    const customer = customerFor(customerId);
    return customer?.priceListId || (customer as any)?.priceList?.id || null;
  };
  const findProductForItem = (item: any) => products.find((product) => product.id === item?.productId)
    || products.find((product) => product.code && (product.code === item?.code || product.code === item?.productCode))
    || products.find((product) => String(product.name || '').trim().toLowerCase() === String(item?.description || '').trim().toLowerCase());
  const resolveItemType = (item: any) => item.itemType || (findProductForItem(item)?.itemType === 'SERVICE' ? 'SERVICE' : 'PRODUCT');
  const getItemCatalog = (item: any) => {
    const catalog = resolveItemType(item) === 'SERVICE' ? serviceCatalog : productCatalog;
    if (!item?.productId || catalog.some((product) => product.id === item.productId)) return catalog;
    const linkedProduct = products.find((product) => product.id === item.productId);
    return [...catalog, linkedProduct || { id: item.productId, code: '', name: item.description || 'Artículo vinculado', itemType: item.itemType || 'PRODUCT' }];
  };
  const customerName = (row: CreditNote) => row.customer?.name || customerFor(row.customerId)?.name || 'Cliente';
  const normalizeStatus = (status?: string) => String(status || '').toUpperCase();
  const statusFor = (status?: string) => statusOptions.find((option) => option.value === normalizeStatus(status));
  const recalculateItems = (items: any[]) => {
    let subtotal = 0;
    let discountAmount = 0;
    let taxAmount = 0;
    const normalizedItems = items.map((item) => {
      const quantity = toWholeQuantity(item.quantity || 0);
      const unitPrice = Math.max(0, Number(item.unitPrice || 0));
      const discount = Math.min(100, Math.max(0, Number(item.discount || 0)));
      const taxRate = Math.max(0, Number(item.taxRate || 0));
      const gross = quantity * unitPrice;
      const lineDiscount = gross * (discount / 100);
      const taxable = Math.max(0, gross - lineDiscount);
      const lineTax = taxable * (taxRate / 100);
      subtotal += gross;
      discountAmount += lineDiscount;
      taxAmount += lineTax;
      return { ...item, quantity, unitPrice, discount, taxRate, total: taxable + lineTax };
    });
    return {
      items: normalizedItems,
      subtotal,
      discountAmount,
      taxAmount,
      total: subtotal - discountAmount + taxAmount,
    };
  };
  const formatDate = (value?: string | null) => value ? formatDateEs(value) : 'Sin fecha';
  const availableCreditFor = (customer?: Customer) => {
    if (!customer) return 0;
    // El saldo negativo representa deuda; un saldo positivo representa favor.
    return Math.max(0, Number(customer.creditLimit || 0) - Math.max(0, -Number(customer.balance || 0)));
  };

  const goToCustomers = () => {
    window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module: 'ventas', subModule: 'clientes' } }));
  };

  const showCreditLimitRequired = () => {
    toast.error('El cliente no tiene un límite de crédito configurado. Ve a Clientes para configurarlo.', {
      action: { label: 'Ir a Clientes', onClick: goToCustomers },
    });
  };

  const filtered = data.filter((credit) => {
    const search = searchTerm.toLowerCase();
    return (statusFilter === 'ALL' || normalizeStatus(credit.status) === statusFilter)
      && ([credit.number, customerName(credit), credit.reason].join(' ').toLowerCase().includes(search));
  });

  const colFilters = useColumnFilters();
  const filterGetters = {
    customerId: (row: CreditNote) => customerName(row),
    dueDate: (row: CreditNote) => (row.dueDate ? new Date(row.dueDate).getTime() : null),
    total: (row: CreditNote) => Number(row.total || 0),
    balance: (row: CreditNote) => Number(row.balance ?? row.total ?? 0),
  };
  const filteredData = colFilters.applyTo(filtered, filterGetters);
  const distinctCustomers = [...new Map(filtered.map((credit) => [customerName(credit), customerName(credit)])).entries()]
    .map(([, label]) => ({ value: label, label, count: filtered.filter((credit) => customerName(credit) === label).length }));

  const closeEditor = () => {
    setEditingId(null);
    setIsCreating(false);
    setLocalDoc(null);
  };

  const startEdit = (id: string) => {
    const record = data.find((credit) => credit.id === id);
    if (!record) return;
    setEditingId(id);
    setIsCreating(false);
    setLocalDoc(JSON.parse(JSON.stringify(record)));
  };

  const startNew = () => {
    setIsCreating(true);
    setEditingId(null);
    setLocalDoc({
      customerId: '',
      date: new Date().toISOString().split('T')[0],
      dueDate: addDays(new Date(), 30),
      reason: '',
      items: [],
      subtotal: 0,
      discountAmount: 0,
      taxAmount: 0,
      total: 0,
      priceListId: null,
      currency: displayCurrency,
      exchangeRate: globalRate,
    });
  };

  const handleSave = async () => {
    if (!localDoc) return;
    if (!localDoc.customerId) return void toast.error('Selecciona un cliente');
    if (!localDoc.dueDate) return void toast.error('Selecciona la fecha límite de pago');
    if (!String(localDoc.reason || '').trim()) return void toast.error('Describe el motivo del crédito');
    if (!localDoc.items?.length) return void toast.error('Agrega al menos un producto o servicio');
    if (localDoc.items.some((item: any) => !item.productId)) return void toast.error('Selecciona el producto o servicio de cada línea');
    if (localDoc.items.some((item: any) => item.priceMissing)) return void toast.error('Algunos productos no tienen precio en la lista seleccionada. Elige otra lista de precios.');
    if (localDoc.items.some((item: any) => !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1)) return void toast.error('Las cantidades deben ser enteros mayores que cero');
    const customer = customerFor(localDoc.customerId);
    if (Number(customer?.creditLimit || 0) <= 0) return void showCreditLimitRequired();
    const saveToastId = toast.loading(isCreating ? 'Creando crédito...' : 'Guardando crédito...');
    try {
      const payload: any = {
        customerId: localDoc.customerId,
        date: new Date(localDoc.date).toISOString(),
        dueDate: new Date(localDoc.dueDate).toISOString(),
        reason: String(localDoc.reason).trim(),
        priceListId: localDoc.priceListId || undefined,
        items: localDoc.items.map((item: any) => ({
          productId: item.productId || undefined,
          priceListId: item.priceListId || undefined,
          description: item.description || '',
          quantity: toWholeQuantity(item.quantity || 1),
          unitPrice: Number(item.unitPrice || 0),
          taxRate: Math.max(0, Number(item.taxRate || 0)),
          discount: Math.min(100, Math.max(0, Number(item.discount || 0))),
          total: Number(item.total || 0),
        })),
        total: Number(localDoc.total || 0),
        currency: localDoc.currency || displayCurrency,
        exchangeRate: Number(localDoc.exchangeRate || globalRate),
        status: 'DRAFT',
      };
      if (isCreating) {
        await creditNotesService.create(payload);
      } else {
        await creditNotesService.update(localDoc.id, payload);
      }
      toast.success(isCreating ? 'Crédito creado' : 'Crédito actualizado', { id: saveToastId });
      closeEditor();
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo guardar el crédito', { id: saveToastId });
    }
  };

  const handleIssue = async (id: string) => {
    if (!canPerform('SALES_CREDIT_NOTES', 'approve')) return;
    const issueToastId = toast.loading('Emitiendo crédito y validando el límite disponible...');
    try {
      await creditNotesService.issue(id);
      toast.success('Crédito emitido y agregado al saldo del cliente', { id: issueToastId });
      closeEditor();
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo emitir el crédito', { id: issueToastId });
    }
  };

  const openPayment = (credit: CreditNote) => {
    setPaymentCredit(credit);
    setPaymentCurrency(credit.currency === 'USD' ? 'USD' : 'NIO');
    setPaymentAmount(String(Number(credit.balance ?? Number(credit.total || 0) - Number(credit.amountPaid || 0))));
    setPaymentMethod('TRANSFER');
    setPaymentAccountId('');
    setPaymentBankAccountId('');
    setPaymentReference(credit.number);
  };

  const handlePayment = async () => {
    if (!canPerform('SALES_CREDIT_NOTES', 'approve')) return;
    if (!paymentCredit) return;
    const amount = Number(paymentAmount);
    if (requiresManualPaymentAccount(paymentMethod) && !paymentAccountId) return void toast.error('Selecciona la cuenta que recibió el pago');
    if (!Number.isFinite(amount) || amount <= 0) return void toast.error('El monto debe ser mayor que cero');
    if (isBankPaymentMethod(paymentMethod, true) && !paymentBankAccountId) return void toast.error('Selecciona el banco global donde se recibió el pago');
    if (requiresPaymentReference(paymentMethod) && !paymentReference.trim()) return void toast.error('La referencia es obligatoria para transferencia, tarjeta o cheque');
    const paymentToastId = toast.loading('Registrando pago del crédito...');
    try {
      setPaymentLoading(true);
      await creditNotesService.apply(paymentCredit.id, { amount, currency: paymentCurrency, paymentMethod, accountId: requiresManualPaymentAccount(paymentMethod) ? paymentAccountId : undefined, bankAccountId: isBankPaymentMethod(paymentMethod, true) ? paymentBankAccountId : undefined, reference: paymentReference || undefined });
      toast.success('Pago registrado y enviado a Pagos Recibidos', { id: paymentToastId });
      setPaymentCredit(null);
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo registrar el pago', { id: paymentToastId });
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleExportPDF = async (row: CreditNote) => {
    const pdfToastId = toast.loading('Generando PDF del crédito...');
    try {
      await generateEstimatePDF({ estimate: { ...row, customer: row.customer || customerFor(row.customerId) }, tenantName: user?.tenantName || 'Mi Empresa', formatAmount: formatConvertedAmount, documentType: 'credit-note' });
      toast.success('PDF generado exitosamente', { id: pdfToastId });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al generar PDF', { id: pdfToastId });
    }
  };

  const buildCreditPanel = (row: CreditNote): SalesDocumentPanelData => ({
    id: row.id,
    number: row.number,
    title: 'Crédito',
    customerName: customerName(row),
    status: String(row.status || ''),
    sourceLabel: row.invoice?.number ? `Factura origen: ${row.invoice.number}` : undefined,
    totalLabel: formatConvertedAmount(Number(row.total || 0), row.currency, row.exchangeRate),
    summaryDetails: [
      { label: 'Pagado', value: formatConvertedAmount(Number(row.amountPaid || 0), row.currency, row.exchangeRate) },
      { label: 'Saldo', value: formatConvertedAmount(Number(row.balance ?? row.total ?? 0), row.currency, row.exchangeRate) },
    ],
    metadata: [
      { label: 'Fecha', value: formatDate(row.date) },
      { label: 'Vencimiento', value: formatDate(row.dueDate) },
      ...(row.invoice?.number ? [{ label: 'Factura origen', value: row.invoice.number }] : []),
    ],
    lines: (row.items || []).map((item) => ({
      id: item.id,
      description: item.description,
      quantity: Number(item.quantity || 0),
      unitPriceLabel: formatConvertedAmount(Number(item.unitPrice || 0), row.currency, row.exchangeRate),
      totalLabel: formatConvertedAmount(Number(item.total || 0), row.currency, row.exchangeRate),
    })),
    reason: row.reason,
  });

  const addItem = (itemType: 'PRODUCT' | 'SERVICE') => {
    if (Number(customerFor(localDoc?.customerId)?.creditLimit || 0) <= 0) {
      showCreditLimitRequired();
      return;
    }
    const items = [...(localDoc.items || []), { id: `${Date.now()}-${itemType}`, itemType, productId: '', description: '', quantity: 1, unitPrice: 0, taxRate: 0, discount: 0, total: 0, priceListId: itemType === 'SERVICE' ? null : (localDoc?.priceListId || null), priceMissing: false }];
    setLocalDoc({ ...localDoc, ...recalculateItems(items) });
  };

  const updateItem = (index: number, patch: Record<string, unknown>) => {
    const items = [...(localDoc.items || [])];
    items[index] = { ...items[index], ...patch };
    setLocalDoc({ ...localDoc, ...recalculateItems(items) });
  };

  const handleCurrencyChange = (currency: 'NIO' | 'USD') => {
    if (!localDoc) return;
    const previousCurrency = localDoc.currency || 'NIO';
    const previousRate = previousCurrency === 'NIO' ? 1 : Number(localDoc.exchangeRate || globalRate || 1);
    const exchangeRate = currency === 'NIO' ? 1 : Number(globalRate || 1);
    const convertedItems = (localDoc.items || []).map((item: any) => {
      const basePrice = previousCurrency === 'USD' ? Number(item.unitPrice || 0) * previousRate : Number(item.unitPrice || 0);
      const unitPrice = currency === 'USD' ? basePrice / exchangeRate : basePrice;
      return { ...item, unitPrice };
    });
    setLocalDoc({ ...localDoc, currency, exchangeRate, ...recalculateItems(convertedItems) });
  };

  const columns: ColumnDef<CreditNote>[] = [
    { key: 'number', header: 'Nº Crédito', width: '140px', render: (value, row) => <span className={cn('text-xs font-black font-mono text-primary', 'cursor-pointer hover:underline')} onClick={() => setDetailCredit(row)}>{value}</span> },
    { key: 'customerId', header: 'Cliente', headerExtra: <ColumnFilterMenu label="Cliente" options={distinctCustomers} selected={colFilters.state.customerId?.values || []} onSelect={(values) => colFilters.setValues('customerId', values)} sort={colFilters.state.customerId?.sort || null} onSort={(sort) => colFilters.setSort('customerId', sort)} />, render: (_, row) => <span className="text-[13px] font-bold text-foreground">{customerName(row)}</span> },
    { key: 'invoiceId', header: 'Factura origen', width: '135px', render: (_, row) => row.invoice?.number ? <Badge className="border-none bg-violet-500/10 px-2 py-0.5 text-[9px] font-black text-violet-600 dark:text-violet-400">{row.invoice.number}</Badge> : <span className="text-xs text-muted-foreground">Crédito directo</span> },
    { key: 'dueDate', header: 'Vence', headerExtra: <ColumnFilterMenu label="Vence" sort={colFilters.state.dueDate?.sort || null} onSort={(sort) => colFilters.setSort('dueDate', sort)} sortOptions={[{ value: 'asc', label: 'Más antiguas' }, { value: 'desc', label: 'Más recientes' }]} />, render: (value) => <span className="text-xs font-medium text-muted-foreground">{formatDate(value as string)}</span> },
    { key: 'total', header: 'Total', width: '125px', headerExtra: <ColumnFilterMenu label="Total" sort={colFilters.state.total?.sort || null} onSort={(sort) => colFilters.setSort('total', sort)} />, render: (value, row) => <span className="text-[13px] font-black tabular-nums text-primary">{formatConvertedAmount(Number(value || 0), row.currency, row.exchangeRate)}</span> },
    { key: 'balance', header: 'Saldo', width: '125px', headerExtra: <ColumnFilterMenu label="Saldo" sort={colFilters.state.balance?.sort || null} onSort={(sort) => colFilters.setSort('balance', sort)} />, render: (_, row) => <span className={cn('text-[13px] font-black tabular-nums', Number(row.balance ?? row.total) > 0 ? 'text-amber-500' : 'text-emerald-500')}>{formatConvertedAmount(Number(row.balance ?? row.total), row.currency, row.exchangeRate)}</span> },
    { key: 'status', header: 'Estado', width: '115px', render: (value) => { const option = statusFor(value as string); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none', option?.color || 'bg-muted/20 text-muted-foreground')}>{option?.label || value}</Badge>; } },
  ];

  const totalIssued = data.filter((credit) => ['ISSUED', 'PARTIAL', 'PAID'].includes(normalizeStatus(credit.status))).reduce((sum, credit) => sum + toBaseAmount(Number(credit.total || 0), credit.currency, credit.exchangeRate), 0);
  const totalOpen = data.filter((credit) => ['ISSUED', 'PARTIAL', 'APPLIED'].includes(normalizeStatus(credit.status))).reduce((sum, credit) => sum + toBaseAmount(Number(credit.balance ?? credit.total ?? 0), credit.currency, credit.exchangeRate), 0);
  const overdueCount = data.filter((credit) => Number(credit.balance ?? 0) > 0 && credit.dueDate && new Date(credit.dueDate).getTime() < referenceNow).length;

  if ((editingId || isCreating) && localDoc) {
    const statusOption = statusFor(localDoc.status);
    const canIssue = !isCreating && normalizeStatus(localDoc.status) === 'DRAFT';
    const selectedCustomer = customerFor(localDoc.customerId);
    const availableCredit = availableCreditFor(selectedCustomer);
    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300" data-tour="sales-form-title">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4"><Button variant="ghost" size="icon" onClick={closeEditor} className="rounded-full"><ChevronLeft className="size-5" /></Button><div><h2 className="text-xl font-black uppercase tracking-tight">{isCreating ? 'Nuevo Crédito' : `Crédito ${localDoc.number}`}</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Productos y servicios entregados a crédito</p></div></div>
          <div className="flex flex-wrap items-center gap-3">{canPerform('SALES_CREDIT_NOTES', 'edit') && <><Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-300 font-black uppercase text-[10px] tracking-widest" onClick={async () => { const id = toast.loading('Eliminando crédito...'); try { await creditNotesService.delete(localDoc.id); toast.success('Crédito eliminado', { id }); closeEditor(); onRefresh(); } catch (error: any) { toast.error(error?.response?.data?.message || 'No se pudo eliminar', { id }); } }} disabled={isCreating}><Trash2 className="mr-2 size-3" /> Eliminar</Button>{canIssue && canPerform('SALES_CREDIT_NOTES', 'approve') && <Button variant="outline" className="rounded-xl border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300 font-black uppercase text-[10px] tracking-widest" onClick={() => handleIssue(localDoc.id)}><CheckCircle2 className="mr-2 size-3" /> Emitir Crédito</Button>}<Button className="rounded-xl bg-primary font-black uppercase text-[10px] tracking-widest" onClick={handleSave}>{isCreating ? 'Crear Crédito' : 'Guardar'}</Button></>}</div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]" data-tour="sales-form-data">
          <Card className="rounded-2xl border-border/50"><CardContent className="space-y-4 p-6"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Condiciones del crédito</p><SalesAccountingLegend flow="creditNote" /><div className="grid gap-3 sm:grid-cols-2"><div><p className="mb-1 text-[10px] text-muted-foreground">Cliente</p><Combobox options={customers.filter((customer) => String(customer.status || '').toUpperCase() === 'ACTIVE' || customer.id === localDoc.customerId).map((customer) => ({ label: customer.name, value: customer.id, description: `${customer.code ? `[${customer.code}] ` : ''}Límite: ${formatConvertedAmount(Number(customer.creditLimit || 0), baseCurrency)}` }))} value={localDoc.customerId || ''} onChange={(value) => { const priceListId = getCustomerPriceListId(value); const items = (localDoc.items || []).map((item: any) => resolveItemType(item) === 'SERVICE' ? { ...item, priceListId: null } : item.productId ? { ...item, priceListId, unitPrice: 0, total: 0, priceMissing: false } : { ...item, priceListId }); setLocalDoc({ ...localDoc, customerId: value, priceListId, ...recalculateItems(items) }); }} placeholder="Seleccionar cliente" /></div><div><p className="mb-1 text-[10px] text-muted-foreground">Fecha del crédito</p><Input type="date" value={isoDate(localDoc.date)} onChange={(event) => setLocalDoc({ ...localDoc, date: event.target.value })} className="h-8 text-xs" /></div><div><p className="mb-1 text-[10px] text-muted-foreground">Fecha límite de pago</p><Input type="date" value={isoDate(localDoc.dueDate)} onChange={(event) => setLocalDoc({ ...localDoc, dueDate: event.target.value })} className="h-8 text-xs" /></div><div><p className="mb-1 text-[10px] text-muted-foreground">Moneda de la transacción</p><Select value={localDoc.currency || 'NIO'} onValueChange={(value) => handleCurrencyChange(value as 'NIO' | 'USD')}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar moneda" /></SelectTrigger><SelectContent><SelectItem value="NIO">Córdobas (C$)</SelectItem><SelectItem value="USD">Dólares (US$)</SelectItem></SelectContent></Select><p className="mt-1 text-[10px] text-muted-foreground/70">Tasa configurada: <span className="font-bold">{localDoc.currency === 'NIO' ? '1.00' : Number(localDoc.exchangeRate || globalRate || 1).toFixed(2)}</span></p></div>{!isCreating && <div><p className="mb-1 text-[10px] text-muted-foreground">Estado</p><span className={cn('inline-flex rounded-lg px-2 py-1 text-xs font-black', statusOption?.color)}>{statusOption?.label || localDoc.status}</span></div>}</div><div><p className="mb-1 text-[10px] text-muted-foreground">Descripción / motivo</p><textarea value={localDoc.reason || ''} onChange={(event) => setLocalDoc({ ...localDoc, reason: event.target.value })} className="h-20 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Ej. Venta de productos con pago a 30 días..." /></div></CardContent></Card>
          <Card className="rounded-2xl border-border/50"><CardContent className="space-y-4 p-6"><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Capacidad de pago</p><div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-border/50 bg-muted/10 p-3"><p className="text-[9px] font-black uppercase text-muted-foreground">Límite</p><p className="mt-1 text-lg font-black">{formatConvertedAmount(Number(selectedCustomer?.creditLimit || 0), baseCurrency)}</p></div><div className="rounded-xl border border-border/50 bg-muted/10 p-3"><p className="text-[9px] font-black uppercase text-muted-foreground">Disponible</p><p className={cn('mt-1 text-lg font-black', availableCredit > 0 ? 'text-emerald-500' : 'text-rose-500')}>{formatConvertedAmount(availableCredit, baseCurrency)}</p></div></div><div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-primary">Saldo del cliente</p><p className="mt-1 text-2xl font-black">{formatConvertedAmount(Number(selectedCustomer?.balance || 0), baseCurrency)}</p><p className="mt-1 text-[10px] text-muted-foreground">Negativo: pendiente por cobrar · Positivo: saldo a favor</p></div>{selectedCustomer && Number(selectedCustomer.creditLimit || 0) <= 0 && <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[10px] text-amber-700 dark:text-amber-300"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /><span>Este cliente no tiene límite de crédito. Configúralo en <button type="button" className="font-black underline underline-offset-2" onClick={goToCustomers}>Clientes</button> para continuar.</span></div>}<div className="flex items-start gap-2 text-[10px] text-muted-foreground"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />La emisión valida que el total no supere el límite disponible.</div></CardContent></Card>
        </div>
        <div className="flex justify-end" data-tour="sales-form-actions"><SalesViewTutorial view="credit-notes" context="form" /></div>
        <Card className="rounded-2xl border-border/50" data-tour="sales-form-items">
          <CardContent className="p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Productos y servicios</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => addItem('PRODUCT')} disabled={!localDoc.customerId} className="h-8 rounded-xl text-[10px] font-black uppercase tracking-widest"><Plus className="mr-2 size-3" /> Producto</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => addItem('SERVICE')} disabled={!localDoc.customerId} className="h-8 rounded-xl text-[10px] font-black uppercase tracking-widest"><Plus className="mr-2 size-3" /> Servicio</Button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="hidden px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground xl:grid xl:grid-cols-12 xl:gap-2">
                <div className="col-span-5">Descripción</div>
                <div className="col-span-2 grid grid-cols-2 gap-1.5"><div>Aplicar</div><div className="text-right">Desc.</div></div>
                <div className="text-right">Cant.</div>
                <div className="text-right">Precio U.</div>
                <div className="text-right">IVA</div>
                <div className="col-span-2 text-right">Total</div>
              </div>
              {(localDoc.items || []).map((item: any, index: number) => {
                const itemType = resolveItemType(item);
                const catalog = getItemCatalog(item);
                const product = findProductForItem(item);
                return (
                  <div key={item.id || index} data-item-layout="standard" className="sales-item-row grid min-w-0 grid-cols-1 items-start gap-3 rounded-xl border border-border/50 bg-muted/5 p-3 xl:grid-cols-12 xl:gap-2 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0">
                    <div className="min-w-0 xl:col-span-5">
                      <div className="flex min-w-0 flex-wrap items-center gap-1">
                        <div className="min-w-0 flex-1">
                          <Combobox
                            options={catalog.map((entry) => ({ label: `${itemType === 'SERVICE' ? 'Servicio' : 'Producto'} · ${entry.code || ''} - ${entry.name}`, value: entry.id }))}
                            value={item.productId || ''}
                            onChange={(value) => {
                              const selectedProduct = catalog.find((entry) => entry.id === value);
                              const baseSalePrice = Number(selectedProduct?.salePrice ?? selectedProduct?.price ?? 0);
                              const unitPrice = localDoc?.currency === 'USD'
                                ? baseSalePrice / Number(localDoc?.exchangeRate || globalRate || 1)
                                : baseSalePrice;
                              updateItem(index, {
                                productId: value,
                                description: selectedProduct?.name || '',
                                priceListId: itemType === 'SERVICE' ? null : (localDoc?.priceListId || getCustomerPriceListId(localDoc?.customerId)),
                                unitPrice,
                                priceMissing: false,
                              });
                            }}
                            placeholder={itemType === 'SERVICE' ? 'Seleccionar servicio...' : 'Seleccionar producto...'}
                          />
                        </div>
                        <SalesLinePriceListSelect
                          productId={item.productId}
                          productCode={product?.code || item.code || item.productCode}
                          productName={item.description}
                          itemType={itemType}
                          value={item.priceListId}
                          defaultPriceListId={localDoc?.priceListId || getCustomerPriceListId(localDoc?.customerId)}
                          currency={localDoc?.currency}
                          exchangeRate={Number(localDoc?.exchangeRate || globalRate || 1)}
                          onChange={(priceListId, result) => {
                            const nextItems = [...(localDoc.items || [])];
                            nextItems[index] = {
                              ...nextItems[index],
                              priceListId,
                              unitPrice: result.unitPrice ?? 0,
                              priceMissing: result.priceMissing,
                            };
                            const calculated = recalculateItems(nextItems);
                            setLocalDoc({ ...localDoc, ...calculated, priceListId, items: calculated.items });
                          }}
                        />
                      </div>
                      {item.productId && product && (
                        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 px-1">
                          <Badge variant="outline" className={cn('border-none px-1.5 py-0 text-[9px] font-black', itemType === 'SERVICE' ? 'bg-emerald-500/10 text-emerald-500' : Number(product.stock || 0) <= 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500')}>
                            {itemType === 'SERVICE' ? 'DISPONIBLE' : `STOCK: ${Number(product.stock || 0)}`}
                          </Badge>
                          {item.priceMissing && <PriceMissingBadge />}
                        </div>
                      )}
                    </div>
                    <div className="col-span-2 mt-0 grid min-w-0 grid-cols-2 items-start gap-1.5 self-start text-[10px]">
                      <label className="relative flex min-w-0 flex-1 items-center font-black uppercase tracking-wider">
                        <span className="flex h-8 w-full items-center gap-1.5 rounded-md bg-muted/30 px-2">
                          <input type="checkbox" checked={Number(item.taxRate || 0) > 0} onChange={(event) => updateItem(index, { taxRate: event.target.checked ? 15 : 0 })} />
                          <span className="text-xs">IVA</span>
                        </span>
                      </label>
                      <label className="relative flex min-w-0 flex-1 items-center font-black uppercase tracking-wider">
                        <Input type="number" min="0" max="100" step="0.01" value={item.discount ?? ''} onChange={(event) => updateItem(index, { discount: Number(event.target.value) || 0 })} className="w-full pr-6 text-left text-xs" placeholder="0" />
                        <span className="pointer-events-none absolute right-2 text-[10px] text-muted-foreground">%</span>
                      </label>
                    </div>
                    <div className="min-w-0 xl:col-span-1">
                      <Input type="number" inputMode="numeric" min="1" step="1" value={Number(item.quantity) || ''} onChange={(event) => updateItem(index, { quantity: toWholeQuantity(event.target.value) })} placeholder="1" />
                    </div>
                    <div className="min-w-0 xl:col-span-1">
                      <Input type="text" inputMode="decimal" min="0" value={item.unitPrice === undefined || item.unitPrice === null ? '' : item.unitPrice} onChange={(event) => updateItem(index, { unitPrice: Number(String(event.target.value).replace(/,/g, '')) || 0 })} placeholder="0" />
                    </div>
                    <div className="col-span-2 flex items-center justify-end xl:col-span-1">
                      <Input type="text" readOnly value={formatConvertedAmount(((Number(item.quantity || 0) * Number(item.unitPrice || 0)) - (Number(item.quantity || 0) * Number(item.unitPrice || 0) * Number(item.discount || 0) / 100)) * Number(item.taxRate || 0) / 100, localDoc.currency, localDoc.exchangeRate)} className="h-8 w-16 border-none bg-transparent px-0 text-right text-xs font-black shadow-none focus-visible:border-transparent focus-visible:ring-0" />
                    </div>
                    <div className="flex min-w-0 items-center justify-end gap-2 text-right xl:col-span-2">
                      <span className="text-sm font-black text-primary">{formatConvertedAmount(Number(item.total || 0), localDoc.currency, localDoc.exchangeRate)}</span>
                      <Button type="button" variant="ghost" size="icon" title="Quitar línea" aria-label="Quitar línea" className="size-6 rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500" onClick={() => { const items = [...localDoc.items]; items.splice(index, 1); setLocalDoc({ ...localDoc, ...recalculateItems(items) }); }}><Trash2 className="size-3" /></Button>
                    </div>
                  </div>
                );
              })}
              {!localDoc.items?.length && <div className="rounded-xl border border-dashed border-border/50 py-8 text-center text-xs text-muted-foreground">Agrega los productos o servicios que se entregarán a crédito.</div>}
            </div>
            <div className="mt-5 rounded-xl border border-border/50 bg-muted/10 p-4 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">Resumen del crédito</p>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">Subtotal (suma de líneas)</span>
                <span className="font-bold tabular-nums">{formatConvertedAmount(Number(localDoc.subtotal || 0), localDoc.currency, localDoc.exchangeRate)}</span>
              </div>
              {Number(localDoc.discountAmount || 0) > 0 && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">Descuento</span>
                  <span className="font-bold text-rose-500 tabular-nums">− {formatConvertedAmount(Number(localDoc.discountAmount || 0), localDoc.currency, localDoc.exchangeRate)}</span>
                </div>
              )}
              {Number(localDoc.taxAmount || 0) > 0 && (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">IVA (15%)</span>
                  <span className="font-bold text-blue-500 tabular-nums">+ {formatConvertedAmount(Number(localDoc.taxAmount || 0), localDoc.currency, localDoc.exchangeRate)}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2 mt-2">
                <span className="text-sm font-black uppercase tracking-widest">Total del crédito</span>
                <span className="text-xl font-black text-primary tabular-nums">{formatConvertedAmount(Number(localDoc.total || 0), localDoc.currency, localDoc.exchangeRate)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-tour="sales-list-kpis"><SalesKpiCard title={`Crédito emitido (${baseCurrency})`} value={formatConvertedAmount(totalIssued, baseCurrency)} icon={BadgeDollarSign} color="text-primary" bg="bg-primary/10" /><SalesKpiCard title={`Saldo abierto (${baseCurrency})`} value={formatConvertedAmount(totalOpen, baseCurrency)} icon={TrendingUp} color="text-amber-500" bg="bg-amber-500/10" /><SalesKpiCard title="Activos" value={data.filter((credit) => ['ISSUED', 'PARTIAL'].includes(normalizeStatus(credit.status))).length} icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-500/10" /><SalesKpiCard title="Por vencer / vencidos" value={overdueCount} icon={Clock} color="text-rose-500" bg="bg-rose-500/10" /></div>
      <div className="flex flex-col gap-4"><div className="flex flex-col justify-between gap-4 py-2 lg:flex-row lg:items-center"><div><h2 className="text-xl font-black uppercase tracking-tight text-foreground" data-tour="sales-list-title">Créditos</h2><p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">Productos y servicios entregados con límite y fecha de pago.</p></div><div className="flex flex-wrap items-center justify-end gap-3" data-tour="sales-list-actions"><SalesViewTutorial view="credit-notes" /><ViewLayoutSelect value={layoutMode} onChange={setLayoutMode} ariaLabel="Elegir distribución de créditos" /><SalesDateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onChange={onDateRangeChange || (() => undefined)} /><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar crédito..." className="h-10 w-64 rounded-xl border-border/50 bg-background/50 pl-9 text-xs font-bold tracking-widest" value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); onSearchChange?.(event.target.value); }} /></div><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="h-10 rounded-xl border border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest"><option value="ALL">Todos los estados</option>{statusOptions.filter((option) => option.value !== 'VOIDED').map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{canPerform('SALES_CREDIT_NOTES', 'create') && <Button onClick={startNew} className="h-10 rounded-xl bg-primary px-4 text-[10px] font-black uppercase tracking-widest text-primary-foreground"><Plus className="mr-2 size-4" /> Nuevo Crédito</Button>}</div></div>
        <EditableDataTable data={filteredData} pagination={pagination} onBulkDelete={async (ids) => { const id = toast.loading(`Eliminando ${ids.length} crédito${ids.length === 1 ? '' : 's'}...`); try { for (const recordId of ids) await creditNotesService.delete(recordId as string); toast.success('Créditos eliminados', { id }); onRefresh(); } catch (error: any) { toast.error(error?.response?.data?.message || error?.message || 'No se pudieron eliminar', { id }); } }} columns={columns} onRowUpdate={async () => {}} onRowClick={(row) => setDetailCredit(row)} isLoading={loading} actionsWidth="w-28" fitContent showHorizontalControls layoutMode={layoutMode} actions={(row) => <div className="flex items-center gap-1" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>{canPerform('SALES_CREDIT_NOTES', 'approve') && normalizeStatus(row.status) === 'DRAFT' && <Button title="Emitir crédito" variant="ghost" size="icon" className="size-8 rounded-lg text-emerald-500" onClick={() => handleIssue(row.id)}><CheckCircle2 className="size-4" /></Button>}{canPerform('SALES_CREDIT_NOTES', 'approve') && ['ISSUED', 'PARTIAL', 'APPLIED'].includes(normalizeStatus(row.status)) && Number(row.balance ?? row.total) > 0.01 && <Button title="Registrar pago" variant="ghost" size="icon" className="size-8 rounded-lg text-primary" onClick={() => openPayment(row)}><CreditCard className="size-4" /></Button>}<Button title="Ver crédito completo" aria-label="Ver crédito completo" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:text-primary" onClick={() => { setDetailCredit(null); startEdit(row.id); }}><Eye className="size-4" /></Button>{canPerform('SALES_CREDIT_NOTES', 'delete') && <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:text-rose-500" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>}</div>} />
      </div>

      <SalesDocumentDetailSheet
        key={detailCredit?.id || 'credit-detail'}
        document={detailCredit ? buildCreditPanel(detailCredit) : null}
        entity="CREDIT_NOTE"
        open={Boolean(detailCredit)}
        onClose={() => setDetailCredit(null)}
        onOpenDocument={() => {
          if (!detailCredit) return;
          setDetailCredit(null);
          startEdit(detailCredit.id);
        }}
        onDownloadPdf={() => { if (detailCredit) void handleExportPDF(detailCredit); }}
      />

      <ConfirmDialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)} title="¿Eliminar crédito?" description="Solo deben eliminarse créditos que aún no hayan sido emitidos." confirmLabel="Eliminar" variant="destructive" loading={deleteLoading} onConfirm={async () => { if (!pendingDeleteId) return; const id = toast.loading('Eliminando crédito...'); try { setDeleteLoading(true); await creditNotesService.delete(pendingDeleteId); toast.success('Crédito eliminado', { id }); onRefresh(); } catch (error: any) { toast.error(error?.response?.data?.message || error?.message || 'No se pudo eliminar', { id }); } finally { setDeleteLoading(false); setPendingDeleteId(null); } }} />

      <Dialog open={Boolean(paymentCredit)} onOpenChange={(open) => !open && !paymentLoading && setPaymentCredit(null)}><DialogContent className="w-[calc(100%-2rem)] max-w-xl rounded-3xl"><DialogHeader><DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight"><CircleDollarSign className="size-5 text-primary" /> Registrar pago del crédito</DialogTitle><DialogDescription>El pago quedará guardado también en Pagos Recibidos y actualizará el saldo del crédito.</DialogDescription></DialogHeader>{paymentCredit && <div className="space-y-4"><div className="rounded-2xl border border-primary/20 bg-primary/5 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{paymentCredit.number} · {customerName(paymentCredit)}</p><p className="mt-1 text-2xl font-black text-primary">Saldo: {formatConvertedAmount(Number(paymentCredit.balance ?? paymentCredit.total ?? 0), paymentCredit.currency, paymentCredit.exchangeRate)}</p></div><Badge className="bg-primary/10 text-primary">{statusFor(paymentCredit.status)?.label}</Badge></div></div><div className="grid gap-3 sm:grid-cols-2"><div><p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monto ({paymentCurrency})</p><Input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} /></div><div><p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Método</p><select value={paymentMethod} onChange={(event) => { const nextMethod = event.target.value; setPaymentMethod(nextMethod); setPaymentAccountId(requiresManualPaymentAccount(nextMethod) ? paymentAccountId : ''); setPaymentBankAccountId(isBankPaymentMethod(nextMethod, true) ? paymentBankAccountId : ''); if (!requiresPaymentReference(nextMethod)) setPaymentReference(''); }} className="h-10 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase">{methodOptions.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></div></div><CurrencySelector value={paymentCurrency} baseCurrency={baseCurrency} exchangeRate={globalRate} label="Moneda recibida" onChange={(nextCurrency) => { const creditCurrency = paymentCredit.currency === 'USD' ? 'USD' : 'NIO'; const creditRate = creditCurrency === baseCurrency ? 1 : Number(paymentCredit.exchangeRate || globalRate); const currentRate = paymentCurrency === baseCurrency ? 1 : paymentCurrency === creditCurrency ? creditRate : globalRate; const nextRate = nextCurrency === baseCurrency ? 1 : nextCurrency === creditCurrency ? creditRate : globalRate; setPaymentAmount(convertBetweenCurrencies(Number(paymentAmount || 0), paymentCurrency, nextCurrency, currentRate, nextRate).toFixed(2)); setPaymentCurrency(nextCurrency); }} />{requiresManualPaymentAccount(paymentMethod) && <AccountingAccountSelect value={paymentAccountId} onChange={setPaymentAccountId} assetOnly label="Cuenta que recibió el pago" />}{isBankPaymentMethod(paymentMethod, true) && <BankAccountSelect value={paymentBankAccountId} onChange={setPaymentBankAccountId} label="Banco global de destino" />}{requiresPaymentReference(paymentMethod) && <div><p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Referencia *</p><Input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Número de recibo, transferencia..." /></div>}</div>}<DialogFooter><Button variant="outline" onClick={() => setPaymentCredit(null)} disabled={paymentLoading}>Cancelar</Button><Button onClick={handlePayment} disabled={paymentLoading || (requiresManualPaymentAccount(paymentMethod) && !paymentAccountId) || (isBankPaymentMethod(paymentMethod, true) && !paymentBankAccountId) || (requiresPaymentReference(paymentMethod) && !paymentReference.trim())} className="bg-primary font-black">{paymentLoading ? 'Registrando...' : 'Confirmar pago'}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
