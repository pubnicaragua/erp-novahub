import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  PackageCheck, Plus, Search, Eye, Trash2, CheckCircle2, ChevronLeft, Ban,
  AlertTriangle, XCircle, ArrowDown, FileText, Banknote, Calculator, ArrowRight, Paperclip, CircleDollarSign, RefreshCw, Send
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Combobox } from '../ui/Combobox';
import { paymentsService, purchaseOrdersService, purchaseReceiptsService, supplierInvoicesService } from '../../services/compras.service';
import { storageService } from '../../services/storage.service';
import { useCurrency } from '../../contexts/CurrencyContext';
import type { Currency, PaymentMethod, PurchaseReceipt, Supplier, PurchaseOrder, Warehouse } from '../../types';
import type { SalesPaginationControls, InventoryCostOperation } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { toast } from 'sonner';
import { TaxTypeSelect } from '../ui/TaxSelector';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { PurchaseKpiCard } from './PurchaseKpiCard';
import { PurchaseViewTutorial } from './PurchaseViewTutorial';
import { PurchaseAlertsButton, type PurchaseAlertDetail } from './PurchaseAlertsButton';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { formatDateEs } from '../../utils/dateFormat';
import { formatExchangeRate } from '../../utils/currency';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { BankAccountSelect } from '../ui/BankAccountSelect';
import { CurrencySelector } from '../ui/CurrencySelector';
import { Switch } from '../ui/switch';
import { hasPaymentReferenceField, isBankPaymentMethod, requiresPaymentReference } from '../../utils/paymentMethods';
import { SalesDocumentDetailSheet, type SalesDocumentPanelData } from '../ventas/SalesDocumentDetailSheet';
import { PdfDownloadButton } from '../ui/PdfDownloadButton';
import type { PdfDownloadFormat } from '../../utils/pdfDownloadFormats';
import { generatePurchaseListPDF, generatePurchaseRecordPDF } from '../../utils/purchaseExports';
import { formatDecimalInput, normalizeDecimalInput } from '../../utils/decimalInput';

interface Props { data: PurchaseReceipt[]; loading: boolean; onRefresh: () => void; supplierCatalog?: Supplier[]; accountCatalog?: any[]; warehouseCatalog?: Warehouse[]; orderCatalog?: PurchaseOrder[]; productCatalog?: any[]; productCategories?: any[]; pagination?: SalesPaginationControls; onSearchChange?: (value: string) => void; purchaseAlert?: PurchaseAlertDetail; targetId?: string | null; onClearTargetId?: () => void; onOpenCredits?: () => void; }

const statusOpts = [
  { label: 'Pendiente', value: 'PENDING', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  { label: 'Recibido', value: 'RECEIVED', color: 'bg-primary/10 text-primary' },
  { label: 'Recibido con incidencias', value: 'WITH_INCIDENTS', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  { label: 'Pagada',        value: 'PAID',           color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  { label: 'Cancelada',     value: 'CANCELLED',       color: 'bg-destructive/10 text-destructive' },
];

function getActiveReceiptInvoices(receipt: Pick<PurchaseReceipt, 'supplierInvoices'>) {
  return (receipt.supplierInvoices || []).filter((invoice: any) => String(invoice.status || '').toUpperCase() !== 'CANCELLED');
}

function isReceiptPaid(receipt: Pick<PurchaseReceipt, 'supplierInvoices'>) {
  const invoices = getActiveReceiptInvoices(receipt);
  return invoices.length > 0 && invoices.every((invoice: any) => {
    const status = String(invoice.status || '').toUpperCase();
    const total = Number(invoice.total || 0);
    const balance = Number(invoice.balance);
    return status === 'PAID' || (total > 0 && Number.isFinite(balance) && balance <= 0.01);
  });
}

function getReceiptDisplayStatus(receipt: Pick<PurchaseReceipt, 'status' | 'supplierInvoices'>) {
  const operationalStatus = String(receipt.status || 'PENDING').toUpperCase();
  if (operationalStatus === 'CANCELLED' || operationalStatus === 'REJECTED') return 'CANCELLED';
  if (operationalStatus === 'PAID') return 'PAID';
  if (operationalStatus === 'PARTIAL') return isReceiptPaid(receipt) ? 'PAID' : 'WITH_INCIDENTS';
  return isReceiptPaid(receipt) ? 'PAID' : operationalStatus;
}

const STATUS_OPTIONS_RECEIVING = ['RECEIVED', 'WITH_INCIDENTS'];
// Una recepción ya marcada como recibida sigue siendo editable mientras no
// tenga una factura registrada. Esto permite trasladar unidades entre
// recibidas y rechazadas cuando se corrige la revisión física.
const RECEIPT_EDITABLE_STATUSES = ['PENDING', 'WITH_INCIDENTS', 'RECEIVED'];
const RECEIPT_NON_TAXABLE_TYPES = new Set(['EXENTO', 'EXONERADO', 'NO_GRAVADO', 'NO_SUJETO']);
const RECEIPT_WITHHOLDING_RATES: Record<string, number> = {
  IR_1: 1, IR_2: 2, IR_5: 5, IR_10: 10, IR_15: 15, IR_20: 20, IR_25: 25,
  IVA_1: 1, IVA_2: 2, IVA_3: 3, IVA_4: 4, IVA_5: 5,
  IR_BIENES_1: 1, IR_BIENES_2: 2, IR_SERVICIOS_2: 2,
  IR_HONORARIOS_10: 10, IR_ALQUILERES_15: 15, IR_OTROS_20: 20,
};

function calculateReceiptLineAmounts(item: any) {
  const quantity = Math.max(0, Number(item.quantityReceived || 0));
  const unitPrice = Math.max(0, Number(item.unitPrice || 0));
  const lineTotal = roundReceiptMoney(quantity * unitPrice);
  const taxType = String(item.taxType || 'GRAVADO').toUpperCase();
  const taxable = !RECEIPT_NON_TAXABLE_TYPES.has(taxType);
  const taxRate = taxable
    ? (Number(item.taxRate) > 0 ? Number(item.taxRate) : (['GRAVADO', 'GRAVADO_15'].includes(taxType) ? 15 : 0))
    : 0;
  const taxBase = taxable ? lineTotal : 0;
  const taxAmount = roundReceiptMoney(taxBase * taxRate / 100);
  const withholdingType = String(item.withholdingType || 'NONE').toUpperCase();
  const withholdingRate = withholdingType === 'NONE'
    ? 0
    : (Number(item.withholdingRate) > 0 ? Number(item.withholdingRate) : (RECEIPT_WITHHOLDING_RATES[withholdingType] || 0));
  const withholdingBase = withholdingType === 'NONE' ? 0 : lineTotal;
  const withholdingAmount = roundReceiptMoney(withholdingBase * withholdingRate / 100);
  return { lineTotal, taxRate, taxBase, taxAmount, withholdingRate, withholdingBase, withholdingAmount };
}

function roundReceiptMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeReceiptItemsForForm(items: any[]) {
  return (items || []).map((item) => {
    const ordered = Number(item.quantityOrdered || 0);
    const received = Math.max(0, Number(item.quantityReceived || 0));
    const rejected = Math.max(0, Number(item.quantityRejected || 0));
    if (ordered <= 0) return { ...item, quantityReceived: received, quantityRejected: rejected };
    // La cantidad procesada en inventario no bloquea la corrección de la
    // recepción: el backend revierte la diferencia con un movimiento de
    // salida antes de guardar. Así una unidad puede pasar de recibida a
    // rechazada y volver a recibida sin que el formulario la reestablezca.
    const normalizedRejected = Math.min(rejected, ordered);
    const maxReceived = Math.max(0, ordered - normalizedRejected);
    return {
      ...item,
      quantityReceived: Math.min(received, maxReceived),
      quantityRejected: normalizedRejected,
    };
  });
}

function calculateReceiptTotalsForForm(items: any[]) {
  const totals = (items || []).reduce((result, item) => {
    const amounts = calculateReceiptLineAmounts(item);
    result.subtotal += amounts.lineTotal;
    result.taxAmount += amounts.taxAmount;
    result.withholdingTotal += amounts.withholdingAmount;
    result.withholdingBase += amounts.withholdingBase;
    return result;
  }, { subtotal: 0, taxAmount: 0, withholdingTotal: 0, withholdingBase: 0 });
  return {
    subtotal: roundReceiptMoney(totals.subtotal),
    taxAmount: roundReceiptMoney(totals.taxAmount),
    withholdingTotal: roundReceiptMoney(totals.withholdingTotal),
    withholdingBase: roundReceiptMoney(totals.withholdingBase),
  };
}

const RECEIPT_CURRENCY_META: Record<string, { code: string; label: string; symbol: string }> = {
  USD: { code: 'USD', label: 'Dólares', symbol: '$' },
  NIO: { code: 'NIO', label: 'Córdobas', symbol: 'C$' },
};

function normalizeReceiptCurrency(value?: unknown) {
  return String(value || '').toUpperCase() === 'USD' ? 'USD' : 'NIO';
}

function getReceiptCurrencyMeta(value?: unknown) {
  return RECEIPT_CURRENCY_META[normalizeReceiptCurrency(value)];
}

function formatReceiptAmount(value: number, currency?: unknown) {
  const meta = getReceiptCurrencyMeta(currency);
  return `${meta.symbol} ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatInventoryOperationAmount(value: number, currency: string) {
  return formatReceiptAmount(value, currency);
}

function formatInventoryOperationQuantity(value: number) {
  return Number(value || 0).toLocaleString('es-NI', { maximumFractionDigits: 4 });
}

function getReceiptProductStock(product: any, variantId?: string | null, warehouseId?: string | null) {
  if (!product) return undefined;
  const levels = Array.isArray(product.inventoryLevels)
    ? product.inventoryLevels
    : (Array.isArray(product.stockLevels) ? product.stockLevels : []);
  const normalizedWarehouseId = String(warehouseId || '').trim();
  const scopedLevels = normalizedWarehouseId
    ? levels.filter((level: any) => String(level?.warehouseId || '') === normalizedWarehouseId)
    : levels;
  const matchingLevels = variantId
    ? scopedLevels.filter((level: any) => String(level?.variantId || '') === String(variantId))
    : scopedLevels;
  if (variantId || normalizedWarehouseId || matchingLevels.length > 0) {
    return matchingLevels.reduce((sum: number, level: any) => sum + Number(level?.quantity || 0), 0);
  }
  if (product.stock !== undefined && product.stock !== null) return Number(product.stock);
  return levels.reduce((sum: number, level: any) => sum + Number(level?.quantity || 0), 0);
}

function getReceiptCommercialNote(item: any, products: any[] = []) {
  const currentNote = String(item?.commercialNoteSnapshot ?? item?.commercialNote ?? '').trim();
  if (currentNote) return currentNote;
  const parentProduct = item?.product || products.find((product: any) => String(product?.id) === String(item?.productId));
  return String(parentProduct?.commercialNote || '').trim();
}

function getReceiptCurrentStock(item: any, products: any[] = [], fallbackWarehouseId?: string | null) {
  if (item?.stockApplies === false) return undefined;
  // La relación `item.product` que devuelve recepción es parcial (id y nota
  // comercial), no incluye los niveles de inventario. Para mostrar la
  // existencia real debemos tomar primero el producto completo del catálogo;
  // la relación embebida queda como respaldo para respuestas históricas.
  const catalogProduct = products.find((candidate: any) => String(candidate?.id) === String(item?.productId));
  const product = catalogProduct || item?.product;
  const warehouseId = item?.warehouseId || fallbackWarehouseId || null;
  const catalogStock = product ? getReceiptProductStock(product, item?.variantId, warehouseId) : undefined;
  if (catalogStock !== undefined) return catalogStock;
  if (item?.currentStock !== null && item?.currentStock !== undefined) return Number(item.currentStock);
  if (item?.stock !== null && item?.stock !== undefined) return Number(item.stock);
  return undefined;
}

function getInventoryCostOperations(response: any): InventoryCostOperation[] {
  const payload = response?.data ?? response;
  return Array.isArray(payload?.inventoryCostOperations) ? payload.inventoryCostOperations : [];
}

function getItemsMissingWarehouse(items: any[], onlyReceived = false) {
  return (items || []).filter((item: any) =>
    item?.stockApplies !== false
    && !String(item?.warehouseId || '').trim()
    && (!onlyReceived || Number(item?.quantityReceived || 0) > 0),
  );
}

function getWarehouseWarningLabels(items: any[]) {
  return getItemsMissingWarehouse(items, true)
    .map((item: any, index: number) => String(item?.description || item?.name || item?.code || `Producto ${index + 1}`).trim())
    .filter(Boolean);
}

interface ReceiptPaymentDraft {
  receiptId: string;
  receiptNumber: string;
  supplierName: string;
  supplierId: string;
  supplierInvoiceId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceDueDate: string;
  amount: number;
  currency: Currency;
  exchangeRate?: number;
  reference: string;
  notes: string;
}

const RECEIPT_PAYMENT_METHODS = [
  { label: 'Efectivo', value: 'CASH' },
  { label: 'Tarjeta', value: 'CARD' },
  { label: 'Transferencia bancaria', value: 'TRANSFER' },
  { label: 'Cheque', value: 'CHECK' },
];

type ReceiptPaymentLine = {
  method: PaymentMethod;
  amount: number | string;
  currency: 'NIO' | 'USD';
  exchangeRate: number;
  bankAccountId?: string;
  reference?: string;
};

async function uploadReceiptPaymentEvidence(files: File[], invoiceId: string, paymentId: string, reference: string) {
  for (const file of files) {
    const extension = file.name.toLowerCase().split('.').pop() || '';
    const isImage = file.type.startsWith('image/');
    const isDocument = ['pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(extension) || file.type === 'application/pdf';
    const maxSize = 10 * 1024 * 1024;
    if (!isImage && !isDocument) throw new Error(`El archivo ${file.name} debe ser una imagen o un documento compatible.`);
    if (file.size > maxSize) throw new Error(`El archivo ${file.name} supera el límite permitido.`);
    const uploaded = await storageService.uploadFile('purchase-evidence', file, { folder: `pagos/${paymentId}` });
    await supplierInvoicesService.addAttachment(invoiceId, {
      fileName: `Pago-${reference}-${file.name}`,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
      fileUrl: uploaded.uri,
    });
  }
}

function ReceiptPaymentDialog({ draft, onClose, onSaved, onRegisterInvoice }: { draft: ReceiptPaymentDraft | null; onClose: () => void; onSaved: () => void; onRegisterInvoice: (payload: { draft: ReceiptPaymentDraft; number: string; date: string; dueDate: string; files: File[] }) => Promise<any> }) {
  const { displayCurrency, baseCurrency, exchangeRate: globalRate, convertBetweenCurrencies, toBaseAmount, formatConvertedAmount } = useCurrency();
  const [paymentLines, setPaymentLines] = useState<ReceiptPaymentLine[]>([]);
  const [partialPaymentEnabled, setPartialPaymentEnabled] = useState(false);
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [invoiceId, setInvoiceId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [invoiceSaving, setInvoiceSaving] = useState(false);
  const [saving, setSaving] = useState(false);

  const paymentLineRate = (currency: 'NIO' | 'USD') => currency === baseCurrency ? 1 : Number(globalRate || 1);

  useEffect(() => {
    if (!draft) return;
    const draftMethod = (draft.reference ? 'TRANSFER' : 'CASH') as PaymentMethod;
    const initialCurrency = displayCurrency === 'USD' ? 'USD' : 'NIO';
    const initialRate = paymentLineRate(initialCurrency);
    const initialAmount = Number(convertBetweenCurrencies(
      Number(draft.amount || 0),
      draft.currency,
      initialCurrency,
      Number(draft.exchangeRate || globalRate || 1),
      initialRate,
    ).toFixed(2));
    setPaymentLines([{ method: draftMethod, amount: initialAmount, currency: initialCurrency, exchangeRate: initialRate, reference: draft.reference || '' }]);
    setPartialPaymentEnabled(false);
    setNotes(draft.notes || '');
    setFiles([]);
    setInvoiceId(draft.supplierInvoiceId || '');
    setInvoiceNumber(draft.invoiceNumber || '');
    setInvoiceDate(draft.invoiceDate || new Date().toISOString().slice(0, 10));
    setInvoiceDueDate(draft.invoiceDueDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
    setInvoiceFiles([]);
  }, [draft, displayCurrency, globalRate]);

  const handleRegisterInvoice = async () => {
    if (!draft) return;
    if (!invoiceNumber.trim()) return toast.error('Ingresa el número de factura del proveedor.');
    if (invoiceFiles.length === 0) return toast.error('Selecciona al menos una imagen o PDF de la factura.');
    setInvoiceSaving(true);
    const invoiceToastId = toast.loading('Registrando factura y evidencia...');
    try {
      const invoice = await onRegisterInvoice({ draft, number: invoiceNumber.trim(), date: invoiceDate, dueDate: invoiceDueDate, files: invoiceFiles });
      const savedInvoice = invoice?.data ?? invoice;
      setInvoiceId(String(savedInvoice?.id || ''));
      setInvoiceNumber(String(savedInvoice?.number || invoiceNumber.trim()));
      setPaymentLines((current) => current.map((line, index) => index === 0 ? { ...line, amount: Number(savedInvoice?.balance ?? savedInvoice?.total ?? draft.amount) } : line));
      setInvoiceFiles([]);
      toast.success('Factura y evidencia registradas. Ya puedes confirmar el pago.', { id: invoiceToastId });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo registrar la factura.', { id: invoiceToastId });
    } finally {
      setInvoiceSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!draft) return;
    const resolvedInvoiceId = invoiceId || draft.supplierInvoiceId;
    if (!resolvedInvoiceId) return toast.error('Registra primero la factura y su evidencia.');
    const effectiveLines = paymentLines
      .map((line) => ({ ...line, amount: Number(line.amount || 0), reference: String(line.reference || '').trim() }))
      .filter((line) => line.amount > 0);
    if (!effectiveLines.length) return toast.error('El monto debe ser mayor que cero.');
    if (effectiveLines.some((line) => requiresPaymentReference(line.method) && !line.reference)) {
      return toast.error('Ingresa la referencia para cada pago con tarjeta, transferencia o cheque.');
    }
    if (effectiveLines.some((line) => isBankPaymentMethod(line.method, true) && !line.bankAccountId)) {
      return toast.error('Selecciona el banco de cada pago con tarjeta, transferencia o cheque.');
    }
    if (files.length === 0) return toast.error('Adjunte al menos una evidencia del pago.');
    const paymentBaseAmount = Number(effectiveLines.reduce((sum, line) => sum + toBaseAmount(
      line.amount,
      line.currency,
      line.currency === baseCurrency ? 1 : line.exchangeRate,
    ), 0).toFixed(2));
    const draftBaseAmount = Number(toBaseAmount(Number(draft.amount || 0), draft.currency, Number(draft.exchangeRate || globalRate || 1)).toFixed(2));
    if (paymentBaseAmount > draftBaseAmount + 0.01) return toast.error('El monto convertido no puede superar el saldo pendiente.');
    if (paymentBaseAmount < draftBaseAmount - 0.01 && !partialPaymentEnabled) return toast.error('Activa "Pago parcial" para registrar solo una parte de la factura.');
    setSaving(true);
    const saveToastId = toast.loading('Registrando pago y generando la integración contable...');
    try {
      const payload = {
        supplierId: draft.supplierId,
        supplierInvoiceId: resolvedInvoiceId,
        date: new Date().toISOString(),
        amount: effectiveLines[0].amount,
        currency: effectiveLines[0].currency,
        exchangeRate: effectiveLines[0].exchangeRate,
        method: effectiveLines[0].method,
        bankAccountId: effectiveLines.length === 1 && isBankPaymentMethod(effectiveLines[0].method, true) ? effectiveLines[0].bankAccountId : undefined,
        reference: effectiveLines.length === 1 && requiresPaymentReference(effectiveLines[0].method) ? effectiveLines[0].reference : undefined,
        notes: notes.trim() || `Pago de la recepción ${draft.receiptNumber}`,
      };
      const payment = effectiveLines.length > 1
        ? await paymentsService.createMixed({
          ...payload,
          payments: effectiveLines.map((line) => ({
            method: line.method,
            amount: line.amount,
            currency: line.currency,
            exchangeRate: line.exchangeRate,
            bankAccountId: line.bankAccountId,
            reference: hasPaymentReferenceField(line.method) ? line.reference : undefined,
            notes: payload.notes,
          })),
        })
        : await paymentsService.create(payload);

      let evidenceError = '';
      try {
        const paymentId = String(payment.id || (payment as any)?.payments?.[0]?.id || '');
        await uploadReceiptPaymentEvidence(files, resolvedInvoiceId, paymentId, effectiveLines[0].reference || 'EFECTIVO');
      } catch (error: any) {
        evidenceError = error?.response?.data?.message || error?.message || 'no se pudieron adjuntar todas las evidencias';
      }

      toast.success('Pago registrado en Pagos realizados, Finanzas y Contabilidad.', { id: saveToastId });
      if (evidenceError) toast.error(`El pago quedó registrado, pero ${evidenceError.toLowerCase()}`);
      onSaved();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo registrar el pago.', { id: saveToastId });
    } finally {
      setSaving(false);
    }
  };

  const paymentBaseAmount = draft
    ? Number(paymentLines.reduce((sum, line) => sum + toBaseAmount(
      Number(line.amount || 0),
      line.currency,
      line.currency === baseCurrency ? 1 : line.exchangeRate,
    ), 0).toFixed(2))
    : 0;
  const draftBaseAmount = draft
    ? Number(toBaseAmount(Number(draft.amount || 0), draft.currency, Number(draft.exchangeRate || globalRate || 1)).toFixed(2))
    : 0;
  const paymentExceedsDraftBalance = paymentBaseAmount > draftBaseAmount + 0.01;

  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => { if (!open && !saving && !invoiceSaving) onClose(); }}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] !max-w-3xl flex-col overflow-hidden rounded-3xl border-primary/20 bg-background p-0 shadow-2xl">
        <DialogHeader className="border-b border-border/60 bg-gradient-to-br from-primary/[0.12] via-background to-primary/[0.05] px-6 py-6 pr-12" data-tour="purchases-payment-title">
          <DialogTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><CircleDollarSign className="size-5" /></span>
            Registrar pago de la recepción
          </DialogTitle>
          <DialogDescription>El pago quedará guardado también en Pagos realizados y actualizará el saldo de la cuenta por pagar.</DialogDescription>
          <PurchaseViewTutorial view="payments" context="form" labelOverride="Cómo registrar pago" targetPrefix="purchases-payment" />
        </DialogHeader>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
          {draft && (
            <div className="space-y-5 px-6 py-5" data-tour="purchases-payment-data">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4" data-tour="purchases-payment-summary">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{draft.receiptNumber} · {draft.supplierName || 'Proveedor'}</p>
                  <p className="mt-1 text-2xl font-black text-primary">Total a pagar: {formatReceiptAmount(draft.amount, draft.currency)}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Factura: {draft.invoiceNumber || 'Pendiente de registrar'}</p>
                </div>
                <Badge className="bg-primary/10 text-primary">Pendiente</Badge>
              </div>
            </div>
            {!invoiceId ? (
              <div className="space-y-4 rounded-2xl border border-primary/25 bg-primary/[0.03] p-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-foreground">Evidencia de factura y cuenta por pagar</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Registra la factura del proveedor y su evidencia aquí. No volverás al detalle de la recepción.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><p className="mb-1 text-[10px] font-black uppercase tracking-widest">Número de factura *</p><Input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} disabled={invoiceSaving} placeholder="Ej. A-001-000123" className="h-10 font-mono" /></div>
                  <div><p className="mb-1 text-[10px] font-black uppercase tracking-widest">Fecha factura</p><Input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} disabled={invoiceSaving} className="h-10" /></div>
                  <div><p className="mb-1 text-[10px] font-black uppercase tracking-widest">Vencimiento</p><Input type="date" value={invoiceDueDate} onChange={(event) => setInvoiceDueDate(event.target.value)} disabled={invoiceSaving} className="h-10" /></div>
                  <div><p className="mb-1 text-[10px] font-black uppercase tracking-widest">Total factura · calculado ({getReceiptCurrencyMeta(draft.currency).code})</p><Input value={formatReceiptAmount(draft.amount, draft.currency)} readOnly aria-readonly="true" disabled={invoiceSaving} className="h-10 border-primary/30 bg-primary/5 font-black text-primary" /></div>
                </div>
                <div><p className="mb-1 text-[10px] font-black uppercase tracking-widest">Evidencia de factura *</p><Input type="file" multiple accept="application/pdf,image/*,.pdf" onChange={(event) => setInvoiceFiles(Array.from(event.target.files || []))} disabled={invoiceSaving} className="h-10 bg-background text-xs" /><p className="mt-1 text-[10px] text-muted-foreground">Imagen original hasta 10 MB; se optimiza. PDF hasta 10 MB.</p>{invoiceFiles.length > 0 && <p className="mt-1 flex items-center gap-1 truncate text-[10px] font-bold text-primary"><Paperclip className="size-3 shrink-0" />{invoiceFiles.map((file) => file.name).join(', ')}</p>}</div>
                <Button onClick={handleRegisterInvoice} disabled={invoiceSaving || invoiceFiles.length === 0} className="h-10 w-full rounded-xl font-black uppercase tracking-widest">{invoiceSaving ? 'Registrando evidencia...' : 'Registrar evidencia y continuar'}</Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 rounded-2xl border border-border/60 bg-muted/10 p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Formas de pago</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">Activa Pago parcial para conservar saldo; el pago mixto queda agrupado en un mismo registro.</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
                      <label className={cn('flex items-center gap-2 text-[10px] font-black uppercase tracking-widest', paymentExceedsDraftBalance ? 'cursor-not-allowed text-muted-foreground/50' : 'cursor-pointer text-muted-foreground')} title={paymentExceedsDraftBalance ? 'El monto no puede superar el saldo pendiente' : undefined}>
                        <Switch checked={partialPaymentEnabled} onCheckedChange={setPartialPaymentEnabled} disabled={saving || paymentExceedsDraftBalance} aria-label="Activar pago parcial" />
                        Pago parcial
                      </label>
                      <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">Mixto permitido</Badge>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {paymentLines.map((line, index) => (
                      <div key={`${index}-${line.method}`} className="rounded-xl border border-border/60 bg-background/70 p-3">
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,11rem)_minmax(9rem,11rem)_auto] sm:items-start">
                          <div>
                            <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Método</p>
                            <Select value={line.method} onValueChange={(method) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, method: method as PaymentMethod, bankAccountId: undefined, reference: '' } : item))} disabled={saving}>
                              <SelectTrigger className="h-10 w-full text-xs font-bold uppercase"><SelectValue /></SelectTrigger>
                              <SelectContent>{RECEIPT_PAYMENT_METHODS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <CurrencySelector className="[&_button]:h-10" value={line.currency} baseCurrency={baseCurrency} exchangeRate={globalRate} label="Moneda" rateDecimals={2} disabled={saving} onChange={(nextCurrency) => setPaymentLines((current) => current.map((item, itemIndex) => {
                            if (itemIndex !== index) return item;
                            const previousRate = item.currency === baseCurrency ? 1 : Number(item.exchangeRate || globalRate);
                            const nextRate = paymentLineRate(nextCurrency);
                            return { ...item, amount: Number(convertBetweenCurrencies(Number(item.amount || 0), item.currency, nextCurrency, previousRate, nextRate).toFixed(2)), currency: nextCurrency, exchangeRate: nextRate };
                          }))} />
                          <div><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Monto ({line.currency})</p><Input type="text" inputMode="decimal" min="0" value={formatDecimalInput(line.amount) || ''} onChange={(event) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: normalizeDecimalInput(event.target.value) } : item))} disabled={saving} className="h-10 font-black tabular-nums" /></div>
                          <Button type="button" variant="ghost" size="icon" disabled={paymentLines.length === 1 || saving} onClick={() => setPaymentLines((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Eliminar forma de pago" className="size-10 shrink-0 text-muted-foreground hover:text-rose-500"><Trash2 className="size-4" /></Button>
                        </div>
                        {isBankPaymentMethod(line.method, true) && <BankAccountSelect className="mt-2" value={line.bankAccountId} onChange={(bankAccountId) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, bankAccountId } : item))} label="Banco del pago" />}
                        {hasPaymentReferenceField(line.method) && <div className="mt-2"><p className="mb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Referencia *</p><Input value={line.reference || ''} onChange={(event) => setPaymentLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, reference: event.target.value } : item))} disabled={saving} placeholder="Transferencia, voucher, cheque..." required={requiresPaymentReference(line.method)} className="h-10 font-mono" /></div>}
                      </div>
                    ))}
                    <Button type="button" variant="outline" className="w-full border-dashed text-[10px] font-black uppercase tracking-widest" onClick={() => setPaymentLines((current) => [...current, { method: 'CARD', amount: 0, currency: displayCurrency === 'USD' ? 'USD' : 'NIO', exchangeRate: paymentLineRate(displayCurrency === 'USD' ? 'USD' : 'NIO') }])} disabled={saving}><Plus className="mr-2 size-4" /> Agregar pago mixto</Button>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3"><span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total aplicado (base)</span><span className="font-black text-primary">{formatConvertedAmount(paymentLines.reduce((sum, line) => sum + toBaseAmount(Number(line.amount || 0), line.currency, line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate)), 0), baseCurrency)}</span></div>
                  <p className="mt-1 text-[10px] text-muted-foreground">Máximo: {formatReceiptAmount(Number(draft.amount), draft.currency)} · Efectivo no requiere referencia.</p>
                </div>
                <div className="sm:col-span-2"><p className="mb-1 text-[10px] font-black uppercase tracking-widest">Evidencias del pago *</p><Input type="file" multiple accept="application/pdf,image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(event) => setFiles(Array.from(event.target.files || []))} disabled={saving} className="h-10 bg-background text-xs" /><p className="mt-1 text-[10px] text-muted-foreground">Imágenes originales hasta 10 MB; se optimizan. Documentos hasta 10 MB.</p>{files.length > 0 && <p className="mt-1 flex items-center gap-1 truncate text-[10px] font-bold text-primary"><Paperclip className="size-3 shrink-0" />{files.map((file) => file.name).join(', ')}</p>}</div>
                <div className="sm:col-span-2"><p className="mb-1 text-[10px] font-black uppercase tracking-widest">Notas</p><Input value={notes} onChange={(event) => setNotes(event.target.value)} disabled={saving} placeholder="Observación del pago (opcional)" className="h-10" /></div>
              </div>
            )}
            </div>
          )}
        </div>
        <DialogFooter className="border-t border-border/60 bg-muted/[0.12] px-6 py-4" data-tour="purchases-payment-actions">
          <Button variant="outline" onClick={onClose} disabled={saving || invoiceSaving} className="rounded-xl font-black uppercase tracking-widest">Cancelar</Button>
          {invoiceId && <Button onClick={handleSubmit} disabled={saving || !draft || !paymentLines.some((line) => Number(line.amount || 0) > 0) || paymentLines.some((line) => requiresPaymentReference(line.method) && !line.reference?.trim()) || paymentLines.some((line) => isBankPaymentMethod(line.method, true) && !line.bankAccountId) || paymentLines.reduce((sum, line) => sum + toBaseAmount(Number(line.amount || 0), line.currency, line.currency === baseCurrency ? 1 : Number(line.exchangeRate || globalRate)), 0) > toBaseAmount(Number(draft?.amount || 0), draft?.currency, Number(draft?.exchangeRate || globalRate || 1)) + 0.01} className="rounded-xl bg-primary font-black uppercase tracking-widest text-primary-foreground">{saving ? 'Registrando...' : 'Confirmar pago'}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RecepcionesCompraView({ data, loading, onRefresh, supplierCatalog = [], warehouseCatalog = [], orderCatalog = [], productCatalog = [], productCategories = [], pagination, onSearchChange, purchaseAlert, targetId, onClearTargetId, onOpenCredits }: Props) {
  const { canPerform, user } = useAuth();
  const { formatConvertedAmount } = useCurrency();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('purchases-receipts-layout', 'table', 24 * 365);
  const [highlightedAlertId, setHighlightedAlertId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightedAlertId) return;
    const timeout = window.setTimeout(() => setHighlightedAlertId(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [highlightedAlertId]);

  useEffect(() => {
    if (!targetId || !data.some((receipt) => receipt.id === targetId)) return;
    setHighlightedAlertId(targetId);
    setEditingId(targetId);
    onClearTargetId?.();
  }, [targetId, data, onClearTargetId]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'RECEIVED' | 'WITH_INCIDENTS' | 'PAID' | 'CANCELLED'>('ALL');
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailReceipt, setDetailReceipt] = useState<PurchaseReceipt | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<PurchaseReceipt> | null>(null);
  const [inventoryCostOperations, setInventoryCostOperations] = useState<InventoryCostOperation[] | null>(null);
  const [paymentDraft, setPaymentDraft] = useState<ReceiptPaymentDraft | null>(null);
  const [creditDraft, setCreditDraft] = useState<{ receipt: PurchaseReceipt; invoice: any } | null>(null);
  const [creditReason, setCreditReason] = useState('');
  const [creditQuantities, setCreditQuantities] = useState<Record<string, number>>({});
  const [creditLoading, setCreditLoading] = useState(false);

  useEffect(() => {
    setSuppliers(supplierCatalog);
    setOrders(orderCatalog);
    setWarehouses(warehouseCatalog);
    setProducts(productCatalog);
    setCategories(productCategories);
  }, [supplierCatalog, orderCatalog, warehouseCatalog, productCatalog, productCategories]);

  const availableProducts = products.length > 0 ? products : productCatalog;

  const [prevEdit, setPrevEdit] = useState({ editingId, data });
  if (editingId !== prevEdit.editingId || data !== prevEdit.data) {
    setPrevEdit({ editingId, data });
    if (editingId) {
      if (editingId === 'NEW') {
         setLocalDoc({
           supplierId: '',
           purchaseOrderId: '',
           date: new Date().toISOString(),
          status: 'PENDING' as any,
           items: [],
         });
       } else {
        const found = data.find(x => x.id === editingId);
        const cloned = found ? JSON.parse(JSON.stringify(found)) : null;
        setLocalDoc(cloned ? {
          ...cloned,
             items: (cloned.items || []).map((item: any) => ({
               ...item,
               currentStock: getReceiptCurrentStock(item, availableProducts, cloned.purchaseOrder?.warehouseId),
               commercialNoteSnapshot: getReceiptCommercialNote(item, availableProducts) || null,
             })),
        } : null);
       }
     } else {
       setLocalDoc(null);
      }
  }

  const filtered = data.filter(r => {
    if (statusFilter !== 'ALL' && getReceiptDisplayStatus(r) !== statusFilter) return false;
    return (r.number||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.supplier?.name||'').toLowerCase().includes(searchTerm.toLowerCase());
  });

  const colFilters = useColumnFilters();
  const activeReceiptInvoices = getActiveReceiptInvoices;
  const expectedReceiptPayment = (receipt: PurchaseReceipt) => {
    const orderTotal = Number(receipt.purchaseOrder?.total || 0);
    const invoiceTotal = activeReceiptInvoices(receipt).reduce((sum, invoice: any) => sum + Number(invoice.total || 0), 0);
    return orderTotal > 0 ? orderTotal : invoiceTotal || Number(receipt.total || 0);
  };
  const paidReceiptAmount = (receipt: PurchaseReceipt) =>
    activeReceiptInvoices(receipt).reduce((sum, invoice: any) => sum + Number(invoice.amountPaid || 0), 0);
  const receiptExpectedCurrency = (receipt: PurchaseReceipt) => receipt.purchaseOrder?.currency || receipt.currency;
  const receiptPaidCurrency = (receipt: PurchaseReceipt) => activeReceiptInvoices(receipt)[0]?.currency || receipt.currency;
  const buildReceiptPanel = (receipt: PurchaseReceipt): SalesDocumentPanelData => ({
    id: receipt.id,
    number: receipt.number,
    title: 'Recepción de compra',
    customerName: receipt.supplier?.name || 'Proveedor sin nombre',
    hideCustomer: true,
    status: getReceiptDisplayStatus(receipt),
    sourceLabel: receipt.purchaseOrder?.number ? `Orden de compra ${receipt.purchaseOrder.number}` : undefined,
    totalLabel: formatConvertedAmount(
      Number(receipt.total || 0),
      receipt.currency,
      receipt.exchangeRate,
    ),
    sourceCurrency: receipt.currency,
    sourceExchangeRate: receipt.exchangeRate,
    summaryDetails: [
      { label: 'Moneda', value: String(receipt.currency || 'NIO').toUpperCase() },
      { label: 'Líneas', value: String(receipt.items?.length || 0) },
      { label: 'Importe comprometido', value: formatConvertedAmount(expectedReceiptPayment(receipt), receiptExpectedCurrency(receipt), receipt.purchaseOrder?.exchangeRate || receipt.exchangeRate) },
      { label: 'Pagado', value: formatConvertedAmount(paidReceiptAmount(receipt), receiptPaidCurrency(receipt), activeReceiptInvoices(receipt)[0]?.exchangeRate || receipt.exchangeRate) },
    ],
    metadata: [
      { label: 'Proveedor', value: receipt.supplier?.name || 'No disponible' },
      { label: 'Fecha de recepción', value: receipt.date ? formatDateEs(receipt.date) : 'No disponible' },
      { label: 'Orden de compra', value: receipt.purchaseOrder?.number || 'No vinculada' },
    ],
    lines: (receipt.items || []).map((item) => {
      const ordered = Number(item.quantityOrdered || 0);
      const received = Number(item.quantityReceived || 0);
      const rejected = Number(item.quantityRejected || 0);
      const lineTotal = received * Number(item.unitPrice || 0);
      return {
        id: item.id,
        description: item.description || item.name || item.code || 'Artículo sin descripción',
        quantity: received,
        unitPriceLabel: formatReceiptAmount(Number(item.unitPrice || 0), receipt.currency),
        totalLabel: formatReceiptAmount(lineTotal, receipt.currency),
        secondaryLabel: `Ordenada: ${ordered} · Recibida: ${received} · Rechazada: ${rejected}${item.commercialNoteSnapshot ? ` · Nota: ${item.commercialNoteSnapshot}` : ''}`,
      };
    }),
    notes: receipt.notes,
  });
  const filterGetters = {
    supplier: (row: PurchaseReceipt) => row.supplier?.name || '-',
    date: (row: PurchaseReceipt) => (row.date ? new Date(row.date).getTime() : null),
    total: (row: PurchaseReceipt) => Number(row.total || row.purchaseOrder?.total || 0),
    status: (row: PurchaseReceipt) => getReceiptDisplayStatus(row),
  };
  const filteredData = colFilters.applyTo(filtered, filterGetters);

  const handleExportListPdf = async (format: PdfDownloadFormat) => {
    const exportToastId = toast.loading('Generando reporte de recepciones...');
    try {
      await generatePurchaseListPDF({
        title: 'Recepciones de compra',
        rows: filteredData,
        tenantName: user?.tenantName || 'Empresa',
        tenantLogo: user?.sessionBranding?.logo || null,
        format,
        targetKey: 'compras.purchase-receipt',
        columns: [
          { label: 'N° Recepción', value: (row) => row.number },
          { label: 'Proveedor', value: (row) => row.supplier?.name || 'Sin proveedor' },
          { label: 'Fecha', value: (row) => row.date ? formatDateEs(row.date) : '—' },
          { label: 'Comprometido', align: 'right', value: (row) => formatConvertedAmount(expectedReceiptPayment(row), receiptExpectedCurrency(row), row.purchaseOrder?.exchangeRate || row.exchangeRate) },
          { label: 'Pagado', align: 'right', value: (row) => formatConvertedAmount(paidReceiptAmount(row), receiptPaidCurrency(row), activeReceiptInvoices(row)[0]?.exchangeRate || row.exchangeRate) },
          { label: 'Estado', align: 'center', value: (row) => statusOpts.find((option) => option.value === getReceiptDisplayStatus(row))?.label || row.status || '—' },
        ],
      });
      toast.success('Reporte PDF descargado', { id: exportToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo generar el reporte', { id: exportToastId });
    }
  };

  const handleDownloadReceiptPdf = async (receipt: PurchaseReceipt, format: PdfDownloadFormat) => {
    const exportToastId = toast.loading('Generando PDF de la recepción...');
    try {
      await generatePurchaseRecordPDF({
        tenantName: user?.tenantName || 'Empresa',
        tenantLogo: user?.sessionBranding?.logo || null,
        format,
        targetKey: 'compras.purchase-receipt',
        document: {
          title: 'Recepción de compra',
          number: receipt.number,
          date: receipt.date ? formatDateEs(receipt.date) : undefined,
           status: statusOpts.find((option) => option.value === getReceiptDisplayStatus(receipt))?.label || receipt.status,
          supplier: receipt.supplier?.name || 'Sin proveedor',
          fields: [
            { label: 'Orden de compra', value: receipt.purchaseOrder?.number || 'No vinculada' },
            { label: 'Moneda', value: String(receipt.currency || 'NIO').toUpperCase() },
            { label: 'Importe comprometido', value: formatConvertedAmount(expectedReceiptPayment(receipt), receiptExpectedCurrency(receipt), receipt.purchaseOrder?.exchangeRate || receipt.exchangeRate) },
            { label: 'Pagado', value: formatConvertedAmount(paidReceiptAmount(receipt), receiptPaidCurrency(receipt), activeReceiptInvoices(receipt)[0]?.exchangeRate || receipt.exchangeRate) },
          ],
          lines: (receipt.items || []).map((item) => ({
            description: item.description || item.name || item.code || 'Artículo sin descripción',
            code: item.code,
            productCode: (item as any).productCode,
            variantId: (item as any).variantId,
            variantSku: (item as any).variantSku,
            variantName: (item as any).variantName,
            variantAttributes: (item as any).variantAttributes,
            variant: (item as any).variant,
            quantity: Number(item.quantityReceived || 0),
            unitPrice: formatReceiptAmount(Number(item.unitPrice || 0), receipt.currency),
            total: formatReceiptAmount(Number(item.quantityReceived || 0) * Number(item.unitPrice || 0), receipt.currency),
            secondary: `Ordenada: ${Number(item.quantityOrdered || 0)} · Rechazada: ${Number(item.quantityRejected || 0)}${item.commercialNoteSnapshot ? ` · Nota: ${item.commercialNoteSnapshot}` : ''}`,
          })),
          total: formatReceiptAmount(Number(receipt.total || 0), receipt.currency),
          totalLabel: 'Total recibido',
          notes: receipt.notes,
        },
      });
      toast.success('PDF descargado', { id: exportToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo generar el PDF', { id: exportToastId });
    }
  };

  const distinctSuppliers = [...new Map(filtered.map((r) => [r.supplier?.name || '-', r.supplier?.name || '-'])).entries()]
    .map(([, label]) => ({ value: label, label, count: filtered.filter((r) => (r.supplier?.name || '-') === label).length }));
  const statusOptionsForFilter = statusOpts.map((o) => ({ value: o.value, label: o.label, count: filtered.filter((r) => getReceiptDisplayStatus(r) === o.value).length }));

  const columns: ColumnDef<PurchaseReceipt>[] = [
    { key: 'number',    header: 'N° Recepción',    width: '120px',
      render: (val) => <span className="font-black font-mono text-primary text-xs">{val}</span> },
    { key: 'supplier',  header: 'Proveedor',   width: '200px',
      headerExtra: <ColumnFilterMenu label="Proveedor" options={distinctSuppliers} selected={colFilters.state.supplier?.values || []} onSelect={(values) => colFilters.setValues('supplier', values)} sort={colFilters.state.supplier?.sort || null} onSort={(sort) => colFilters.setSort('supplier', sort)} />,
      render: (_v, row) => <span className="font-bold text-sm">{row.supplier?.name||'-'}</span> },
    { key: 'date',      header: 'Fecha',       width: '110px',
      headerExtra: <ColumnFilterMenu label="Fecha" sort={colFilters.state.date?.sort || null} onSort={(sort) => colFilters.setSort('date', sort)} sortOptions={[{ value: 'desc', label: 'M�s recientes' }, { value: 'asc', label: 'M�s antiguas' }]} />,
      render: (val) => <span className="text-xs text-muted-foreground">{val ? formatDateEs(val) : '-'}</span> },
    { key: 'total',     header: 'Total recepción', width: '145px',
      headerExtra: <ColumnFilterMenu label="Total" sort={colFilters.state.total?.sort || null} onSort={(sort) => colFilters.setSort('total', sort)} />,
      render: (_value, row) => {
        const receiptStatus = getReceiptDisplayStatus(row);
        const hasReceivedQuantity = (row.items || []).some((item) => Number(item.quantityReceived || 0) > 0);
        const hasFinalAmount = ['RECEIVED', 'WITH_INCIDENTS', 'PAID'].includes(receiptStatus) || hasReceivedQuantity;
        const linkedOrder = row.purchaseOrder;
        const expectedTotal = Number(linkedOrder?.total || 0);
        const finalTotal = Number(row.total || 0);
        const amount = hasFinalAmount
          ? (finalTotal > 0 ? finalTotal : expectedTotal)
          : (expectedTotal > 0 ? expectedTotal : finalTotal);
        const sourceCurrency = hasFinalAmount
          ? (row.currency || linkedOrder?.currency)
          : (linkedOrder?.currency || row.currency);
        const sourceExchangeRate = hasFinalAmount
          ? (row.exchangeRate || linkedOrder?.exchangeRate)
          : (linkedOrder?.exchangeRate || row.exchangeRate);

        return (
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-sm font-black tabular-nums text-foreground">
              {formatConvertedAmount(amount, sourceCurrency, sourceExchangeRate)}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground">
              {hasFinalAmount ? 'Total final' : 'Total esperado'}
            </span>
          </div>
        );
      } },
    { key: 'expectedPayment', header: 'Importe comprometido', width: '155px',
      render: (_value, row) => (
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-sm font-black tabular-nums text-amber-600 dark:text-amber-400">
            {formatConvertedAmount(expectedReceiptPayment(row), receiptExpectedCurrency(row), row.purchaseOrder?.exchangeRate || row.exchangeRate)}
          </span>
          <span className="text-[10px] font-bold text-muted-foreground">Orden original</span>
        </div>
      ) },
    { key: 'paidAmount', header: 'Pagado', width: '135px',
      render: (_value, row) => (
        <div className="flex flex-col items-start gap-0.5">
          <span className="text-sm font-black tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatConvertedAmount(paidReceiptAmount(row), receiptPaidCurrency(row), activeReceiptInvoices(row)[0]?.exchangeRate || row.exchangeRate)}
          </span>
          <span className="text-[10px] font-bold text-muted-foreground">Pagos registrados</span>
        </div>
      ) },
    { key: 'items',     header: 'Ítems',       width: '140px',
      render: (_v, row) => {
        const items = row.items || [];
        const total = items.length;
        const rechazados = items.filter(i => Number(i.quantityRejected||0) > 0);
        const faltantes = items.filter(i => Number(i.quantityRejected || 0) <= 0 && Number(i.quantityReceived) < Number(i.quantityOrdered));
        return <div className="flex items-center gap-2">
          <span className="text-xs font-black tabular-nums">{total} art.</span>
          {faltantes.length > 0 && <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">{faltantes.length} falt.</span>}
          {rechazados.length > 0 && <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">{rechazados.length} no acept.</span>}
        </div>;
      } },
    { key: 'status',    header: 'Estado',      width: '130px',
      headerExtra: <ColumnFilterMenu label="Estado" options={statusOptionsForFilter} selected={colFilters.state.status?.values || []} onSelect={(values) => colFilters.setValues('status', values)} sort={colFilters.state.status?.sort || null} onSort={(sort) => colFilters.setSort('status', sort)} />,
      render: (_val, row) => { const displayStatus = getReceiptDisplayStatus(row); const o = statusOpts.find(x => x.value === displayStatus); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label || displayStatus}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<PurchaseReceipt>) => {
    let updateToastId: string | number | undefined;
    try {
      const currentReceipt = data.find((x) => x.id === id);
      const previousStatus = String(currentReceipt?.status || '').toUpperCase();
      const requestedStatus = String(updates.status || currentReceipt?.status || '').toUpperCase();
      const requiresApproval = !STATUS_OPTIONS_RECEIVING.includes(previousStatus) && STATUS_OPTIONS_RECEIVING.includes(requestedStatus);
      if (requiresApproval && !canPerform('PURCHASES_RECEIPTS', 'approve')) {
        toast.error('Necesitas el permiso Aprobar para marcar esta recepción como recibida.');
        return;
      }
      if (requiresApproval) {
        const missingWarehouseItems = getItemsMissingWarehouse(currentReceipt?.items || [], true);
        if (missingWarehouseItems.length > 0) {
          const labels = getWarehouseWarningLabels(currentReceipt?.items || []);
          toast.error(`Selecciona una bodega para cada producto recibido: ${labels.join(', ')}`);
          return;
        }
      }
      updateToastId = toast.loading('Actualizando recepción y sincronizando inventario...');
      const updateResponse = await purchaseReceiptsService.update(id as string, requiresApproval ? { ...updates, deferApproval: true } as any : updates);
      const inventoryResponse = requiresApproval ? await purchaseReceiptsService.approve(id as string) : updateResponse;
      const operations = getInventoryCostOperations(inventoryResponse);
      if (operations.length > 0) setInventoryCostOperations(operations);
      toast.success('Recepción actualizada', updateToastId ? { id: updateToastId } : undefined);
      onRefresh();
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    }
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar', updateToastId ? { id: updateToastId } : undefined); throw new Error('Update failed'); }
  };

  const handleCancelConfirm = async () => {
    if (!pendingCancelId || !cancelReason.trim()) return;
    setCancelLoading(true);
    const cancelToastId = toast.loading('Cancelando recepción...');
    try {
      await purchaseReceiptsService.cancel(pendingCancelId, cancelReason.trim());
      toast.success('Recepción cancelada', { id: cancelToastId });
      if (editingId === pendingCancelId) setEditingId(null);
      setPendingCancelId(null);
      setCancelReason('');
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al cancelar la recepción', { id: cancelToastId });
    } finally {
      setCancelLoading(false);
    }
  };

  const openPaymentModal = (receipt: any, invoice?: any) => {
    const receiptStatus = getReceiptDisplayStatus(receipt);
    if (!['RECEIVED', 'WITH_INCIDENTS'].includes(receiptStatus)) {
      toast.error('El pago solo se puede registrar cuando la recepción está recibida o recibida con incidencias.');
      return;
    }
    const receiptTotals = calculateReceiptTotalsForForm(receipt.items || []);
    const calculatedTotal = Math.max(0, Number((receiptTotals.subtotal + receiptTotals.taxAmount - receiptTotals.withholdingTotal).toFixed(2)));
    const balance = invoice?.id ? Number(invoice.balance || 0) : calculatedTotal;
    if (invoice?.id && balance <= 0) {
      toast.error('Esta recepción no tiene una cuenta por pagar con saldo pendiente.');
      return;
    }
    if (!invoice?.id && balance <= 0) {
      toast.error('Esta recepción no tiene un total recibido válido para registrar la factura.');
      return;
    }
    setPaymentDraft({
      receiptId: String(receipt.id),
      receiptNumber: String(receipt.number || ''),
      supplierName: String(receipt.supplier?.name || ''),
      supplierId: String(receipt.supplierId || ''),
      supplierInvoiceId: invoice?.id ? String(invoice.id) : '',
      invoiceNumber: String(invoice?.number || ''),
      invoiceDate: invoice?.date ? new Date(invoice.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      invoiceDueDate: invoice?.dueDate ? new Date(invoice.dueDate).toISOString().slice(0, 10) : new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      amount: balance,
      currency: normalizeReceiptCurrency(invoice?.currency || receipt.currency),
      exchangeRate: Number(invoice?.exchangeRate || receipt.exchangeRate || 1),
      reference: invoice?.id ? `PAG-${Date.now().toString().slice(-8)}` : '',
      notes: `Pago de la recepción ${receipt.number || ''}`,
    });
  };

  const openReceiptCredit = (receipt: PurchaseReceipt, invoice: any) => {
    const receiptStatus = getReceiptDisplayStatus(receipt);
    if (!['RECEIVED', 'WITH_INCIDENTS'].includes(receiptStatus)) {
      toast.error('La recepción debe estar recibida antes de crear un crédito.');
      return;
    }
    if (!invoice?.id || String(invoice.status || '').toUpperCase() === 'CANCELLED') {
      toast.error('La recepción no tiene una factura de proveedor válida para crear el crédito.');
      return;
    }
    setCreditDraft({ receipt, invoice });
    setCreditReason('');
    setCreditQuantities(Object.fromEntries((receipt.items || []).map((item: any) => [item.id, 0])));
  };

  const handleCreateCreditFromReceipt = async () => {
    if (!creditDraft) return;
    const items = Object.entries(creditQuantities)
      .map(([receiptItemId, quantity]) => ({ receiptItemId, quantity: Number(quantity || 0) }))
      .filter((item) => item.quantity > 0);
    if (!creditReason.trim()) {
      toast.error('Indica el motivo del crédito.');
      return;
    }
    if (items.length === 0) {
      toast.error('Selecciona al menos un artículo y una cantidad para acreditar.');
      return;
    }
    setCreditLoading(true);
    const createToastId = toast.loading('Creando crédito del proveedor...');
    try {
      await purchaseReceiptsService.createCredit(creditDraft.receipt.id, {
        date: new Date().toISOString(),
        reason: creditReason.trim(),
        items,
      });
      toast.success('Crédito creado como borrador', { id: createToastId });
      setCreditDraft(null);
      setCreditReason('');
      setCreditQuantities({});
      onRefresh();
      void queryClient.invalidateQueries({ queryKey: ['purchases'] });
      onOpenCredits?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo crear el crédito', { id: createToastId });
    } finally {
      setCreditLoading(false);
    }
  };

  const handleSaveDoc = async () => {
    if (!localDoc?.supplierId) return toast.error('Debe seleccionar un proveedor');
    if (!localDoc?.purchaseOrderId) return toast.error('Debe seleccionar una orden de compra');
    const linkedOrderForSave = orders.find((order) => String(order.id) === String(localDoc.purchaseOrderId));
    const receiptCurrency = normalizeReceiptCurrency(localDoc.currency || linkedOrderForSave?.currency);
    const receiptExchangeRate = Number(localDoc.exchangeRate || linkedOrderForSave?.exchangeRate || 1);
    const itemsToSave = normalizeReceiptItemsForForm((localDoc.items || []).map((item: any) => ({
      ...item,
      commercialNoteSnapshot: getReceiptCommercialNote(item, availableProducts) || null,
    })));
    const autoComputedStatus = calcStatus(itemsToSave);
    const financialTotals = calculateReceiptTotalsForForm(itemsToSave);
    const documentToSave = {
      ...localDoc,
      currency: receiptCurrency as any,
      exchangeRate: receiptExchangeRate,
      items: itemsToSave,
      status: autoComputedStatus as any,
      ...financialTotals,
      total: roundReceiptMoney(financialTotals.subtotal + financialTotals.taxAmount - financialTotals.withholdingTotal),
    };
    const isReceiving = STATUS_OPTIONS_RECEIVING.includes(autoComputedStatus);
    const previousStatus = editingId !== 'NEW'
      ? String(data.find((receipt) => receipt.id === editingId)?.status || '').toUpperCase()
      : '';
    const requiresApproval = isReceiving && (editingId === 'NEW' || !STATUS_OPTIONS_RECEIVING.includes(previousStatus));
    if (requiresApproval && !canPerform('PURCHASES_RECEIPTS', 'approve')) {
      return toast.error('Necesitas el permiso Aprobar para marcar esta recepción como recibida.');
    }
    if (isReceiving) {
      const missingWarehouseItems = getItemsMissingWarehouse(itemsToSave, true);
      if (missingWarehouseItems.length > 0) {
        const labels = getWarehouseWarningLabels(itemsToSave);
        return toast.error(`Selecciona una bodega para cada producto recibido: ${labels.join(', ')}`);
      }
    }
    const saveToastId = toast.loading(editingId === 'NEW' ? 'Registrando recepción de compra...' : 'Guardando recepción de compra...');
    try {
      let inventoryResponse: any;
      let initialOperations: InventoryCostOperation[] = [];
      if (editingId === 'NEW') {
        const createdResponse = await purchaseReceiptsService.create(requiresApproval ? { ...documentToSave, deferApproval: true } as any : documentToSave as any);
        const createdReceipt = (createdResponse as any)?.data || createdResponse;
        initialOperations = getInventoryCostOperations(createdResponse);
        inventoryResponse = requiresApproval && createdReceipt?.id
          ? await purchaseReceiptsService.approve(createdReceipt.id)
          : createdResponse;
        toast.success('Recepción creada', { id: saveToastId });
      } else {
        const updateResponse = await purchaseReceiptsService.update(editingId!, requiresApproval ? { ...documentToSave, deferApproval: true } as any : documentToSave as any);
        inventoryResponse = requiresApproval ? await purchaseReceiptsService.approve(editingId!) : updateResponse;
        toast.success('Recepción guardada', { id: saveToastId });
      }
      const operations = getInventoryCostOperations(inventoryResponse);
      if (operations.length > 0) setInventoryCostOperations(operations);
      else if (initialOperations.length > 0) setInventoryCostOperations(initialOperations);
      setEditingId(null);
      onRefresh();
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al guardar la recepción', { id: saveToastId });
    }
  };

  const registerInvoiceFromPaymentModal = async ({ draft, number, date, dueDate, files }: { draft: ReceiptPaymentDraft; number: string; date: string; dueDate: string; files: File[] }) => {
    const receipt = data.find((item) => String(item.id) === String(draft.receiptId));
    if (!receipt) throw new Error('No se encontró la recepción seleccionada. Actualiza la lista e inténtalo nuevamente.');
    if (!['RECEIVED', 'WITH_INCIDENTS'].includes(getReceiptDisplayStatus(receipt))) {
      throw new Error('La recepción debe estar recibida antes de registrar la factura.');
    }

    const uploaded: Array<{ fileName: string; fileType: string; fileSize: number; fileUrl: string }> = [];
    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (!isImage && !isPdf) throw new Error(`"${file.name}" no es una imagen ni un PDF.`);
      if (isImage && file.size > 10 * 1024 * 1024) throw new Error(`La imagen original "${file.name}" supera el límite de 10 MB.`);
      if (isPdf && file.size > 10 * 1024 * 1024) throw new Error(`El PDF "${file.name}" supera el límite de 10 MB.`);
      const evidence = await storageService.uploadFile('purchase-evidence', file, { folder: `recepciones/${draft.receiptId}` });
      uploaded.push({
        fileName: file.name,
        fileType: file.type || (isPdf ? 'application/pdf' : 'application/octet-stream'),
        fileSize: file.size,
        fileUrl: evidence.uri,
      });
    }

    const receiptTotals = calculateReceiptTotalsForForm(receipt.items || []);
    const calculatedInvoiceTotal = Math.max(0, Number((receiptTotals.subtotal + receiptTotals.taxAmount - receiptTotals.withholdingTotal).toFixed(2)));
    const receiptCurrency = normalizeReceiptCurrency(receipt.currency || receipt.purchaseOrder?.currency || draft.currency);
    const receiptExchangeRate = Number(receipt.exchangeRate || receipt.purchaseOrder?.exchangeRate || draft.exchangeRate || 1);
    const response = await purchaseReceiptsService.registerInvoice(draft.receiptId, {
      number,
      date: date || undefined,
      dueDate: dueDate || undefined,
      total: calculatedInvoiceTotal,
      currency: receiptCurrency,
      exchangeRate: receiptExchangeRate,
      attachments: uploaded,
    });
    onRefresh();
    void queryClient.invalidateQueries({ queryKey: ['purchases'] });
    return response;
  };

  const handleDeleteItem = (idx: number) => {
    setLocalDoc((current) => {
      if (!current) return current;
      const newItems = [...(current.items || [])];
      newItems.splice(idx, 1);
      const autoStatus = calcStatus(newItems);
      const financialTotals = calculateReceiptTotalsForForm(newItems);
      return {
        ...current,
        items: newItems as any,
        status: autoStatus as any,
        ...financialTotals,
        total: roundReceiptMoney(financialTotals.subtotal + financialTotals.taxAmount - financialTotals.withholdingTotal),
      };
    });
  };

  const calcStatus = (items: any[]) => {
    if (!items || items.length === 0) return 'PENDING';
    const hasRejected = items.some(it => Number(it.quantityRejected||0) > 0);
    const allReceived = items.every(it => Number(it.quantityReceived||0) >= Number(it.quantityOrdered||0));
    const anyReceived = items.some(it => Number(it.quantityReceived||0) > 0);
    const hasMissing = items.some(it => Number(it.quantityReceived || 0) + Number(it.quantityRejected || 0) < Number(it.quantityOrdered || 0));
    if (!anyReceived && !hasRejected) return 'PENDING';
    if (hasRejected || hasMissing) return 'WITH_INCIDENTS';
    if (allReceived) return 'RECEIVED';
    return 'PENDING';
  };

  const handleRepairInventory = async (receipt: PurchaseReceipt) => {
    const repairToastId = toast.loading('Sincronizando recepción con inventario...');
    try {
      const response = await purchaseReceiptsService.approve(String(receipt.id));
      const operations = getInventoryCostOperations(response);
      if (operations.length > 0) setInventoryCostOperations(operations);
      toast.success('Inventario sincronizado correctamente', { id: repairToastId });
      onRefresh();
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo sincronizar el inventario', { id: repairToastId });
    }
  };

  const handleItemChange = (idx: number, field: string, value: any) => {
    setLocalDoc((current) => {
      if (!current) return current;
      const newItems = [...(current.items || [])];
      const numericField = ['quantityOrdered', 'quantityReceived', 'quantityRejected', 'unitPrice', 'taxRate', 'withholdingRate'].includes(field);
      const decimalField = ['unitPrice', 'taxRate', 'withholdingRate'].includes(field);
      const nextValue = numericField
        ? decimalField ? normalizeDecimalInput(value) : (Number(value) || 0)
        : value;
      const currentItem = newItems[idx] || {};
      const ordered = Math.max(0, Number(currentItem.quantityOrdered || 0));
      const currentReceived = Math.max(0, Number(currentItem.quantityReceived || 0));
      const currentRejected = Math.max(0, Number(currentItem.quantityRejected || 0));

      if (field === 'quantityReceived' && ordered > 0) {
        const nextReceived = Math.min(ordered, nextValue);
        // Si se reduce lo recibido, la unidad liberada pasa a rechazadas solo
        // cuando el usuario ya está corrigiendo una recepción completa. En
        // cualquier otro caso se conserva la cantidad rechazada existente.
        const nextRejected = Math.min(currentRejected, Math.max(0, ordered - nextReceived));
        newItems[idx] = { ...currentItem, quantityReceived: nextReceived, quantityRejected: nextRejected };
      } else if (field === 'quantityRejected' && ordered > 0) {
        const nextRejected = Math.min(ordered, nextValue);
        const previousAllocated = currentReceived + currentRejected;
        const availableReceived = Math.max(0, ordered - nextRejected);
        let nextReceived = Math.min(currentReceived, availableReceived);
        // Al quitar un rechazo de una línea ya completa, la unidad vuelve a
        // recibidas automáticamente. Si la línea aún estaba incompleta, no
        // inventamos una recepción nueva.
        if (nextRejected < currentRejected && previousAllocated >= ordered) {
          nextReceived = Math.min(availableReceived, currentReceived + (currentRejected - nextRejected));
        }
        newItems[idx] = { ...currentItem, quantityReceived: nextReceived, quantityRejected: nextRejected };
      } else {
        newItems[idx] = { ...currentItem, [field]: nextValue };
      }
      const normalizedItems = normalizeReceiptItemsForForm(newItems);
      const autoStatus = calcStatus(normalizedItems);
      const financialTotals = calculateReceiptTotalsForForm(normalizedItems);
      return {
        ...current,
        items: normalizedItems as any,
        status: autoStatus as any,
        ...financialTotals,
        total: roundReceiptMoney(financialTotals.subtotal + financialTotals.taxAmount - financialTotals.withholdingTotal),
      };
    });
  };

  const currentAvailableOrders = orders.filter(o => o.supplierId === localDoc?.supplierId && ['APPROVED'].includes((o.status||'').toUpperCase()) && !(o.receipts || []).some((receipt: any) => String(receipt.status || '').toUpperCase() === 'PENDING'));

  const paymentDialog = <ReceiptPaymentDialog draft={paymentDraft} onClose={() => setPaymentDraft(null)} onSaved={() => { onRefresh(); void queryClient.invalidateQueries({ queryKey: ['purchases'] }); }} onRegisterInvoice={registerInvoiceFromPaymentModal} />;
  const creditDialog = (
    <Dialog open={Boolean(creditDraft)} onOpenChange={(open) => { if (!open && !creditLoading) { setCreditDraft(null); setCreditReason(''); setCreditQuantities({}); } }}>
      <DialogContent className="w-[calc(100%-2rem)] !max-w-2xl rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
            <Send className="size-5 text-primary" /> Crear crédito del proveedor
          </DialogTitle>
          <DialogDescription>
            Selecciona únicamente los artículos recibidos que serán devueltos o acreditados. El documento se guardará como borrador para revisarlo antes de emitirlo.
          </DialogDescription>
        </DialogHeader>
        {creditDraft && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {creditDraft.receipt.number || 'Recepción'} · {creditDraft.invoice.number || 'Factura de proveedor'}
              </p>
              <p className="mt-1 text-sm font-black text-primary">{creditDraft.receipt.supplier?.name || 'Sin proveedor'}</p>
              <p className="mt-2 text-[10px] font-bold text-muted-foreground">
                Factura origen: {creditDraft.invoice.number || 'Sin número'} · Las existencias ya recibidas no se modificarán al crear el borrador.
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/10 p-3">
              <div className="mb-2 grid grid-cols-[minmax(0,1fr)_7rem_7rem] gap-3 px-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                <span>Artículo recibido</span><span className="text-right">Recibido</span><span className="text-right">Acreditar</span>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {(creditDraft.receipt.items || []).filter((item: any) => Number(item.quantityReceived || 0) > 0).map((item: any) => {
                  const received = Number(item.quantityReceived || 0);
                  const quantity = Number(creditQuantities[item.id] || 0);
                  return (
                    <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_7rem_7rem] items-center gap-3 rounded-xl border border-border/50 bg-background/80 px-2 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold">{item.description || item.name || item.code || 'Artículo sin descripción'}</p>
                        <p className="truncate text-[10px] text-muted-foreground">{item.productId ? 'Producto de inventario' : 'Servicio'} · {formatReceiptAmount(Number(item.unitPrice || 0), creditDraft.receipt.currency)}</p>
                      </div>
                      <span className="text-right text-xs font-black tabular-nums">{received}</span>
                      <Input
                        type="number"
                        min="0"
                        max={received}
                        step="0.01"
                        value={quantity || ''}
                        aria-label={`Cantidad a acreditar de ${item.description || item.name || 'artículo'}`}
                        onChange={(event) => {
                          const next = Math.min(received, Math.max(0, Number(event.target.value) || 0));
                          setCreditQuantities((current) => ({ ...current, [item.id]: next }));
                        }}
                        className="h-9 text-right text-xs font-black tabular-nums"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Motivo del crédito *</p>
              <Input value={creditReason} onChange={(event) => setCreditReason(event.target.value)} maxLength={500} placeholder="Ej. Devolución por producto dañado o faltante" disabled={creditLoading} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => { setCreditDraft(null); setCreditReason(''); setCreditQuantities({}); }} disabled={creditLoading}>Cancelar</Button>
          <Button type="button" onClick={() => void handleCreateCreditFromReceipt()} disabled={creditLoading} className="bg-primary font-black text-primary-foreground hover:bg-primary/90">
            {creditLoading ? 'Creando...' : 'Crear borrador'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (editingId && localDoc) {
    const isNew = editingId === 'NEW';
    const receiptStatus = String(localDoc.status || 'PENDING').toUpperCase();
    const persistedStatus = isNew
      ? receiptStatus
      : String(data.find((receipt) => receipt.id === editingId)?.status || receiptStatus).toUpperCase();
    const linkedInvoice = (localDoc as any)?.supplierInvoices?.find((item: any) => String(item.status || '').toUpperCase() !== 'CANCELLED');
    const canEditCurrent = isNew
      ? canPerform('PURCHASES_RECEIPTS', 'create')
      : RECEIPT_EDITABLE_STATUSES.includes(persistedStatus) && canPerform('PURCHASES_RECEIPTS', 'edit') && !linkedInvoice;
    const canReceiveCurrent = !isNew
      && persistedStatus === 'PENDING'
      && canEditCurrent
      && canPerform('PURCHASES_RECEIPTS', 'approve');
    const displayStatus = getReceiptDisplayStatus(localDoc as PurchaseReceipt);
    const currentStatus = statusOpts.find(s => s.value === displayStatus);
    const linkedOrder = (localDoc as any)?.purchaseOrder
      || orders.find((order) => String(order.id) === String(localDoc.purchaseOrderId));
    const receiptCurrency = normalizeReceiptCurrency(localDoc.currency || linkedOrder?.currency);
    const receiptCurrencyMeta = getReceiptCurrencyMeta(receiptCurrency);
    const receiptExchangeRate = Number(localDoc.exchangeRate || linkedOrder?.exchangeRate || 1);
    const linkedRequest = linkedOrder?.purchaseRequestNumber || linkedOrder?.purchaseRequestId;
    const orderOptions = [...currentAvailableOrders, ...(linkedOrder ? [linkedOrder] : [])]
      .filter((order, index, list) => list.findIndex((candidate) => String(candidate.id) === String(order.id)) === index);
    const financialTotals = calculateReceiptTotalsForForm(localDoc.items || []);
    const itemsMissingWarehouse = getItemsMissingWarehouse(localDoc.items || []);
    
    return (
      <div className="min-w-0 max-w-full space-y-6 animate-in slide-in-from-right duration-300" data-tour="purchases-form-title">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setEditingId(null)} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black uppercase tracking-tight">{isNew ? 'Nueva Recepción' : `Recepción ${localDoc.number||''}`}</h2>
                <Badge variant="outline" className={cn('border-none px-2 py-0.5 text-[9px] font-black uppercase tracking-widest', currentStatus?.color||'bg-muted/20 text-muted-foreground')}>{currentStatus?.label||'Pendiente'}</Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
                <span>Inventario ingresado</span>
                <Badge variant="outline" className="border-primary/25 bg-primary/5 px-2 py-0.5 text-[9px] font-black tracking-wide text-primary">
                  {receiptCurrencyMeta.symbol} · {receiptCurrencyMeta.code} · {receiptCurrencyMeta.label}
                </Badge>
                {receiptCurrency === 'USD' && <span className="font-bold normal-case tracking-normal text-muted-foreground">Tasa: {formatExchangeRate(receiptExchangeRate)} NIO/USD</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3" data-tour="purchases-form-actions">
            <PurchaseViewTutorial view="receipts" context="form" />
            {canReceiveCurrent && (
              <Button onClick={handleSaveDoc} className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6">
                <PackageCheck className="mr-2 size-3.5" /> {persistedStatus === 'PENDING' ? 'Recepcionar' : 'Guardar recepción'}
              </Button>
            )}
            {isNew && canPerform('PURCHASES_RECEIPTS', 'create') && (
              <Button onClick={handleSaveDoc} className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6">
                Guardar
              </Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50 col-span-2" data-tour="purchases-form-data">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-foreground">Información General</p>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="text-[10px] text-foreground mb-1">Proveedor</p>
                  <Combobox 
                    disabled={!canEditCurrent}
                    options={suppliers
                      .filter(s => (s.status || '').toUpperCase() === 'ACTIVE' || s.id === localDoc.supplierId)
                      .map(s => ({ label: s.name, value: s.id, description: (s.code ? `[${s.code}] ` : '') + (s.phone || 'Sin teléfono') }))}
                    value={localDoc.supplierId || ''}
                    onChange={(val) => setLocalDoc({ ...localDoc, supplierId: val, purchaseOrderId: '' })}
                    placeholder="Seleccionar Proveedor"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-foreground mb-1">Orden de Compra</p>
                  <Combobox 
                    disabled={!canEditCurrent}
                    options={orderOptions.map(c => {
                      const orderCurrencyMeta = getReceiptCurrencyMeta(c.currency);
                      return {
                        label: `${c.number} · ${orderCurrencyMeta.symbol} ${orderCurrencyMeta.code} (Total: ${formatReceiptAmount(Number(c.total || 0), c.currency)})`,
                        value: c.id,
                      };
                    })}
                    value={localDoc.purchaseOrderId || ''}
                    onChange={async (val) => {
                       const listOrd = orderOptions.find(x => x.id === val);
                       let ord = listOrd;
                       if (val) {
                         const detail = await purchaseOrdersService.getById(val).catch(() => null);
                         const detailOrder = (detail as any)?.data ?? detail;
                         const detailItems = detailOrder?.items;
                         if (Array.isArray(detailItems) && detailItems.length) {
                           ord = { ...(listOrd || {}), ...detailOrder, items: detailItems } as any;
                         }
                       }
                        const orderWarehouseId = (ord as any)?.warehouseId || '';
                        const newItems = ord?.items?.map((it: any) => ({
                           ...it,
                           description: (it as any).description,
                          code: (it as any).code || (it as any).sku || '',
                          name: (it as any).name || '',
                          variantId: (it as any).variantId || null,
                          category: (it as any).category || '',
                          categoryId: (it as any).categoryId
                            || categories.find((c: any) => String(c.name || '').trim().toLowerCase() === String((it as any).category || '').trim().toLowerCase())?.id
                            || '',
                          stockApplies: (it as any).stockApplies !== false,
                           stock: getReceiptCurrentStock(it, availableProducts, orderWarehouseId) ?? null,
                           currentStock: getReceiptCurrentStock(it, availableProducts, orderWarehouseId) ?? null,
                          quantityOrdered: (it as any).quantity,
                          quantityReceived: (it as any).quantity,
                          productId: (it as any).productId,
                          unitPrice: (it as any).unitPrice || 0,
                          taxType: (it as any).taxType || 'GRAVADO',
                          taxRate: (it as any).taxRate || 15,
                          withholdingType: (it as any).withholdingType || 'NONE',
                          withholdingRate: (it as any).withholdingRate || 0,
                          accountId: (it as any).accountId || '',
                          costCenterId: (it as any).costCenterId || null,
                          // La recepción hereda la bodega destino de la orden.
                          // Si la orden histórica no la tiene, la selección debe
                          // quedar vacía para forzar una elección válida.
                           warehouseId: orderWarehouseId,
                          commercialNoteSnapshot: getReceiptCommercialNote(it, availableProducts) || null,
                        })) || [];
                        const autoStatus = calcStatus(newItems);
                        setLocalDoc({
                          ...localDoc,
                          purchaseOrderId: val,
                          currency: normalizeReceiptCurrency(ord?.currency || listOrd?.currency || 'NIO') as any,
                          exchangeRate: Number(ord?.exchangeRate || listOrd?.exchangeRate || 1),
                          items: newItems as any,
                          status: autoStatus as any,
                        });
                     }}
                    placeholder={localDoc.supplierId ? "Seleccionar Orden" : "Seleccione un proveedor primero"}
                  />
                  {!isNew && (
                    <div className="mt-2 flex min-w-0 items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-[10px] text-muted-foreground">
                      <FileText className="size-3.5 shrink-0 text-primary" />
                      <span className="shrink-0 font-black uppercase tracking-wide text-primary">Ruta:</span>
                      <span className="truncate font-bold text-foreground">
                        {linkedRequest ? `Solicitud ${linkedRequest} → ` : ''}
                        Orden ${linkedOrder?.number || (localDoc as any).purchaseOrderNumber || 'no disponible'} → Recepción {localDoc.number || 'actual'}
                      </span>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-foreground mb-1">Fecha Recepción</p>
                  <Input 
                    disabled={!canEditCurrent}
                    type="date" 
                    value={localDoc.date ? new Date(localDoc.date).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, date: new Date(e.target.value).toISOString() })} 
                    className="h-8 text-xs" 
                  />
                </div>
                <div>
                  <p className="text-[10px] text-foreground mb-1">Moneda de la orden</p>
                  <div className="flex min-h-8 flex-wrap items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-2 py-1">
                    <span className="text-xs font-black text-primary">{receiptCurrencyMeta.symbol} · {receiptCurrencyMeta.code}</span>
                    <span className="text-[10px] font-bold text-muted-foreground">{receiptCurrencyMeta.label}</span>
                  </div>
                  {receiptCurrency === 'USD' && <p className="mt-1 text-[10px] text-muted-foreground">Tasa: {formatExchangeRate(receiptExchangeRate)} NIO/USD</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {(localDoc.items || []).some((it: any) => {
          const qOrd = Number(it.quantityOrdered||0);
          const qRec = Number(it.quantityReceived||0);
          const qRej = Number(it.quantityRejected||0);
          return qRec < qOrd || qRej > 0;
        }) && (
          <Card className="rounded-2xl border-border/60 bg-muted/10">
            <CardContent className="p-4 flex items-center gap-4 flex-wrap">
              <AlertTriangle className="size-5 shrink-0 text-muted-foreground" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resumen de cantidades</p>
              {(localDoc.items || []).map((it: any, i: number) => {
                const qOrd = Number(it.quantityOrdered||0);
                const qRec = Number(it.quantityReceived||0);
                const qRej = Number(it.quantityRejected||0);
                const falt = qRej > 0 ? 0 : Math.max(0, qOrd - qRec);
                return <div key={i} className="text-[9px] font-bold text-muted-foreground">
                  {it.description || `Ítem ${i+1}`}: {falt > 0 && <span className="text-amber-500">{falt} faltante(s) </span>}
                  {qRej > 0 && <span className="text-amber-600 dark:text-amber-400">{qRej} no aceptado(s)</span>}
                  {(falt <= 0 && qRej <= 0) && <span className="text-emerald-500">Completo</span>}
                  {i < (localDoc.items||[]).length - 1 && <span className="mx-1.5 text-muted-foreground/30">|</span>}
                </div>;
              })}
            </CardContent>
          </Card>
        )}

        <Card className="rounded-2xl border-border/50" data-tour="purchases-form-items">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-foreground">Productos Recibidos</p>
            </div>

            {itemsMissingWarehouse.length > 0 && (
              <div role="alert" aria-live="polite" className="mb-4 flex flex-col gap-3 rounded-2xl border-2 border-rose-500/55 bg-rose-500/[0.07] p-4 shadow-sm shadow-rose-500/10 sm:flex-row sm:items-start">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-700 text-white shadow-sm shadow-rose-700/30">
                  <AlertTriangle className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-rose-600 dark:text-rose-400">Bodega obligatoria por producto</p>
                  <p className="mt-1 text-xs font-semibold text-foreground">Selecciona una bodega para cada producto antes de registrar cantidades recibidas.</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">El sistema necesita saber en qué bodega ingresará la existencia y actualizará el costo promedio.</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {itemsMissingWarehouse.map((item: any, index: number) => <Badge key={`${item.id || index}-warehouse-warning`} variant="outline" className="border-rose-500/30 bg-background/70 text-[9px] font-bold text-rose-600 dark:text-rose-400">{item.description || item.name || item.code || `Producto ${index + 1}`}</Badge>)}
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              {(localDoc.items || []).map((item: any, idx: number) => {
                const qOrdered = Number(item.quantityOrdered || 0);
                const qReceived = Number(item.quantityReceived || 0);
                const qRejected = Number(item.quantityRejected || 0);
                const rechazado = qRejected > 0;
                const faltante = !rechazado && qReceived < qOrdered && qReceived >= 0;
                const missingWarehouse = item.stockApplies !== false && !String(item.warehouseId || '').trim();
                const lineAmounts = calculateReceiptLineAmounts(item);
                return (
                <div key={item.id || idx} className={cn('group relative min-w-0 rounded-2xl border-2 border-border/80 bg-card p-4 shadow-sm ring-1 ring-border/20 backdrop-blur-sm transition-all duration-200', missingWarehouse ? 'border-rose-500/70 bg-rose-500/[0.045] hover:border-rose-500' : rechazado ? 'border-amber-500/25 bg-amber-500/[0.03] hover:border-amber-500/45' : faltante ? 'border-orange-500/30 bg-orange-500/5 hover:border-orange-500/50' : 'hover:border-primary/50 hover:shadow-md')}>
                  {((faltante || rechazado) && !isNew) && (
                    <div className="flex items-center gap-1.5 mb-2">
                      {faltante && <Badge variant="outline" className="text-[8px] font-black uppercase px-1.5 py-0 border-none bg-amber-500/10 text-amber-500"><ArrowDown className="size-2.5 mr-1" /> Faltante: {qOrdered - qReceived} uds.</Badge>}
                      {rechazado && <Badge variant="outline" className="text-[8px] font-black uppercase px-1.5 py-0 border-none bg-amber-500/10 text-amber-700 dark:text-amber-300"><XCircle className="size-2.5 mr-1" /> No aceptado: {qRejected} uds.</Badge>}
                    </div>
                  )}
                  <div className="flex min-w-0 flex-col gap-3 border-b border-border/30 pb-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-foreground">
                        Producto de inventario
                        {item.productId && (
                          <span className="ml-2 inline-flex items-center gap-1 text-primary font-black">
                            <span className="size-1.5 rounded-full bg-primary inline-block" />
                            Vinculado · campos bloqueados
                          </span>
                        )}
                        {!item.productId && item.stockApplies !== false && (
                          <Badge variant="outline" className="ml-2 border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[8px] font-black uppercase tracking-wider text-amber-600">
                            Nuevo al recepcionar
                          </Badge>
                        )}
                      </p>
                      <p className="mt-1 text-[10px] font-medium text-foreground/70">
                        {item.productId ? 'Desvincula el producto para editar este ítem manualmente.' : 'Sin vincular · se creará como producto nuevo al recepcionar.'}
                      </p>
                    </div>
                    <div className="flex min-w-0 w-full items-end gap-2 sm:w-auto sm:max-w-[34rem] sm:flex-1">
                      <div className="min-w-0 flex-1 sm:w-[28rem] sm:flex-none">
                        <Combobox
                          disabled={!canEditCurrent}
                          options={[
                            { label: 'Producto nuevo al recepcionar', value: '__none__', description: 'Se creará desde los datos de esta línea' },
                            ...products.filter(Boolean).map((p: any) => ({
                              label: p.name || 'Producto',
                              value: String(p.id),
                              description: [
                                `${p.code || p.sku || 'SIN-COD'} · ${p.category?.name || p.category || 'Sin categoría'}`,
                                p.commercialNote ? `Nota: ${p.commercialNote}` : null,
                              ].filter(Boolean).join(' · '),
                            })),
                          ]}
                          value={item.productId ? String(item.productId) : '__none__'}
                          onChange={(val) => {
                            if (val === '__none__' || !val) {
                              handleItemChange(idx, 'productId', '');
                              handleItemChange(idx, 'variantId', null);
                              return;
                            }
                            const prod = products.find((p) => String(p.id) === String(val));
                            handleItemChange(idx, 'productId', val);
                            if (prod) {
                              const productStock = getReceiptProductStock(prod, item.variantId, item.warehouseId);
                              handleItemChange(idx, 'description', prod.name);
                              handleItemChange(idx, 'name', prod.name);
                              handleItemChange(idx, 'code', prod.code || prod.sku || '');
                              handleItemChange(idx, 'category', prod.category?.name || prod.category || '');
                              handleItemChange(idx, 'categoryId', prod.categoryId || prod.category?.id || '');
                              handleItemChange(idx, 'commercialNoteSnapshot', prod.commercialNote || null);
                              handleItemChange(idx, 'stock', productStock ?? null);
                              handleItemChange(idx, 'currentStock', productStock ?? null);
                              handleItemChange(idx, 'unitPrice', Number(prod.costPrice || prod.cost || prod.price || 0));
                            }
                          }}
                          placeholder="Buscar producto..."
                          searchPlaceholder="Buscar por nombre, código o SKU..."
                          className="h-9 text-xs"
                        />
                        {item.variantId && (
                          <Badge variant="secondary" className="mt-1 max-w-full truncate font-mono text-[9px]">
                            Variante · {item.code || item.variantId}
                          </Badge>
                        )}
                      </div>
                      {canEditCurrent && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Eliminar ítem"
                          className="size-9 shrink-0 rounded-xl text-muted-foreground/60 transition-colors hover:bg-rose-500/10 hover:text-rose-500 sm:opacity-0 sm:group-hover:opacity-100"
                          onClick={() => handleDeleteItem(idx)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="purchase-item-fields grid min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-12">
                    <div className="col-span-1 min-w-0 xl:col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-foreground mb-1">Código</p>
                      <Input
                        disabled={!canEditCurrent}
                        value={item.code || ''}
                        onChange={(e) => handleItemChange(idx, 'code', e.target.value)}
                        className="h-8 text-xs font-mono"
                        placeholder="Código"
                      />
                    </div>
                    <div className="col-span-1 min-w-0 xl:col-span-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-foreground mb-1">Nombre</p>
                      <Input
                        disabled={!canEditCurrent}
                        value={item.description || item.name || ''}
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        className="h-8 text-xs"
                        placeholder="Producto"
                      />
                    </div>
                    <div className="col-span-1 min-w-0 xl:col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-foreground mb-1">Categoría</p>
                      <Select
                        disabled={Boolean(item.productId) || !canEditCurrent}
                        value={item.categoryId || '__none__'}
                        onValueChange={(categoryId) => {
                          const normalizedCategoryId = categoryId === '__none__' ? '' : categoryId;
                          const category = categories.find((candidate: any) => String(candidate.id) === String(normalizedCategoryId));
                          handleItemChange(idx, 'categoryId', normalizedCategoryId);
                          handleItemChange(idx, 'category', category?.name || '');
                        }}
                      >
                        <SelectTrigger className={cn('h-8 w-full text-xs', item.categoryId ? '' : 'text-muted-foreground/50')}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sin categoría</SelectItem>
                          {categories.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1 min-w-0 xl:col-span-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-foreground mb-1">Stock actual</p>
                      <div className="flex h-8 items-center">
                         {getReceiptCurrentStock(item, availableProducts, localDoc?.warehouseId) !== null && getReceiptCurrentStock(item, availableProducts, localDoc?.warehouseId) !== undefined
                           ? <span className="text-xs font-black text-primary tabular-nums">{Number(getReceiptCurrentStock(item, availableProducts, localDoc?.warehouseId)).toLocaleString()}</span>
                          : <span className="text-xs text-muted-foreground/40">—</span>}
                      </div>
                    </div>
                    <div className="col-span-1 min-w-0 xl:col-span-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-foreground mb-1">Cant. ordenada</p>
                      <Input
                        disabled={!canEditCurrent}
                        type="number"
                        min="0"
                        value={item.quantityOrdered === 0 ? '' : item.quantityOrdered}
                        onChange={(e) => handleItemChange(idx, 'quantityOrdered', e.target.value)}
                        className="h-8 bg-muted/20 text-right text-xs"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-1 min-w-0 xl:col-span-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-foreground mb-1">Cant. recibida</p>
                      <Input
                        disabled={!canEditCurrent}
                        type="number"
                        min="0"
                        value={item.quantityReceived === 0 ? '' : item.quantityReceived}
                        onChange={(e) => handleItemChange(idx, 'quantityReceived', e.target.value)}
                        className={cn('h-8 text-right text-xs font-bold', faltante ? 'border-amber-500/50 text-amber-500' : 'border-emerald-500/50 text-emerald-500')}
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-1 min-w-0 xl:col-span-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-foreground mb-1">Cant. rechazada</p>
                      <Input
                        disabled={!canEditCurrent}
                        type="number"
                        min="0"
                        value={item.quantityRejected === 0 ? '' : item.quantityRejected}
                        onChange={(e) => handleItemChange(idx, 'quantityRejected', e.target.value)}
                        className={cn('h-8 text-right text-xs font-bold', rechazado ? 'border-amber-500/50 text-amber-700 dark:text-amber-300' : '')}
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-1 min-w-0 xl:col-span-1">
                      <p className="text-[9px] font-black uppercase tracking-widest text-foreground mb-1">Precio U. ({receiptCurrencyMeta.symbol})</p>
                      <Input
                        disabled={!canEditCurrent}
                        type="text"
                        inputMode="decimal"
                        min="0"
                        value={item.unitPrice === 0 ? '' : formatDecimalInput(item.unitPrice)}
                        onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)}
                        className="h-8 text-right text-xs"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="purchase-item-fields mt-3 grid min-w-0 grid-cols-1 items-end gap-2 border-t border-border/30 pt-3 sm:grid-cols-2 xl:grid-cols-12">
                    <div className="col-span-1 min-w-0 sm:col-span-2 xl:col-span-5">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-foreground">Nota comercial</p>
                        <span className="text-[9px] text-muted-foreground">{Array.from(getReceiptCommercialNote(item, availableProducts)).length}/100</span>
                      </div>
                      <Input
                        disabled={!canEditCurrent}
                         value={getReceiptCommercialNote(item, availableProducts)}
                        maxLength={100}
                        onChange={(e) => handleItemChange(idx, 'commercialNoteSnapshot', e.target.value.slice(0, 100))}
                        className="h-8 text-xs"
                        placeholder="Nota visible en documentos"
                      />
                    </div>

                    <div className="col-span-1 min-w-0 xl:col-span-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-foreground mb-1">Tipo IVA</p>
                      <TaxTypeSelect
                        type="TAX"
                        value={item.taxType || ''}
                        disabled={!canEditCurrent}
                        onChange={(v) => {
                          handleItemChange(idx, 'taxType', v);
                          handleItemChange(idx, 'taxRate', v === 'GRAVADO_15' || v === 'GRAVADO' ? 15 : 0);
                        }}
                      />
                    </div>
                    <div className="col-span-1 min-w-0 sm:col-span-2 xl:col-span-5">
                      <div className="mb-1 flex items-center gap-2">
                        <p className={cn('text-[9px] font-black uppercase tracking-widest', missingWarehouse ? 'text-rose-600 dark:text-rose-400' : 'text-foreground')}>Bodega destino *</p>
                        {missingWarehouse && <span className="rounded-full bg-rose-700 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white">Requerido</span>}
                      </div>
                      <Combobox
                        disabled={!canEditCurrent}
                        options={warehouses
                          .filter((w) => (w as any)?.isActive !== false)
                          .map((w) => ({
                            label: w.name,
                            value: w.id,
                            description: w.code ? `[${w.code}] ${w.location || ''}` : (w.location || ''),
                          }))}
                        value={item.warehouseId || ''}
                        onChange={(val) => handleItemChange(idx, 'warehouseId', val)}
                        className={missingWarehouse ? 'border-2 border-rose-500 bg-rose-500/5 text-rose-700 shadow-sm dark:text-rose-300' : ''}
                        placeholder="Seleccionar bodega destino"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <div className="flex min-w-0 items-center gap-2 sm:ml-2">
                      <TaxTypeSelect
                        type="WITHHOLDING"
                        value={item.withholdingType || 'NONE'}
                        disabled={!canEditCurrent}
                        onChange={(v) => {
                          handleItemChange(idx, 'withholdingType', v)
                          if (v !== 'NONE') {
                            const rates: Record<string, number> = { IR_1:1, IR_2:2, IR_5:5, IR_10:10, IR_15:15, IR_20:20, IR_25:25, IVA_1:1, IVA_2:2, IVA_3:3, IR_BIENES_2:2, IR_SERVICIOS_2:2, IR_BIENES_1:1, IR_HONORARIOS_10:10, IR_ALQUILERES_15:15, IR_OTROS_20:20 }
                            handleItemChange(idx, 'withholdingRate', rates[v] || 0)
                          } else {
                            handleItemChange(idx, 'withholdingRate', 0)
                          }
                        }}
                      />
                      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[10px] tabular-nums">
                        <span className="text-muted-foreground">Subtotal <b className="text-foreground">{formatReceiptAmount(lineAmounts.lineTotal, receiptCurrency)}</b></span>
                        <span className="text-rose-500">IVA +{formatReceiptAmount(lineAmounts.taxAmount, receiptCurrency)}</span>
                        {lineAmounts.withholdingAmount > 0 && <span className="text-amber-600">Retención -{formatReceiptAmount(lineAmounts.withholdingAmount, receiptCurrency)}</span>}
                        <span className="text-xs font-black">{formatReceiptAmount(Number((lineAmounts.lineTotal + lineAmounts.taxAmount - lineAmounts.withholdingAmount).toFixed(2)), receiptCurrency)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
              {(!localDoc.items || localDoc.items.length === 0) && (
                <div className="text-center py-6 text-xs text-muted-foreground/50 italic border border-dashed border-border/50 rounded-xl bg-muted/10">
                  No hay ítems registrados.
                </div>
              )}
              <div data-tour="purchases-form-summary">
              {(localDoc.items || []).length > 0 && (
                <div className="grid grid-cols-2 gap-3 border-t border-border/50 pt-4 text-xs sm:grid-cols-5">
                  <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Subtotal recibido</p><p className="font-black tabular-nums">{formatReceiptAmount(financialTotals.subtotal, receiptCurrency)}</p></div>
                  <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">IVA</p><p className="font-black tabular-nums text-rose-500">+{formatReceiptAmount(financialTotals.taxAmount, receiptCurrency)}</p></div>
                  <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Total bruto</p><p className="font-black tabular-nums">{formatReceiptAmount(financialTotals.subtotal + financialTotals.taxAmount, receiptCurrency)}</p></div>
                  <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">IR retenido</p><p className="font-black tabular-nums text-amber-600">-{formatReceiptAmount(financialTotals.withholdingTotal, receiptCurrency)}</p></div>
                  <div><p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Neto a pagar</p><p className="font-black tabular-nums text-primary">{formatReceiptAmount(financialTotals.subtotal + financialTotals.taxAmount - financialTotals.withholdingTotal, receiptCurrency)}</p></div>
                </div>
              )}
              </div>
            </div>
          </CardContent>
        </Card>
        {paymentDialog}
      </div>
    );
  }

  const totalItemsReceived = data.reduce((acc, r) => acc + (r.items?.reduce((a,i:any) => a + Number(i.quantityReceived||0),0)||0), 0);
  const totalRechazados = data.reduce((acc, r) => acc + (r.items?.reduce((a,i:any) => a + Number(i.quantityRejected||0),0)||0), 0);
  const withIncidencias = data.filter(r => String(r.status||'').toUpperCase() === 'WITH_INCIDENTS').length;

  const kpis = [
    { title: 'Recepciones',   value: data.length, icon: PackageCheck, color: 'text-blue-500', bg: 'bg-blue-500/10', kind: 'indicator' as const },
    { title: 'Ítems Recibidos', value: totalItemsReceived, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', kind: 'filter' as const, filter: 'RECEIVED' as const },
    { title: 'Incidencias', value: `${withIncidencias} rec. / ${totalRechazados} rech.`, icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10', kind: 'filter' as const, filter: 'WITH_INCIDENTS' as const },
  ];

  return (
    <div className="min-w-0 max-w-full space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-tour="purchases-list-kpis">
        {kpis.map((k, i) => (
          <PurchaseKpiCard key={i} title={k.title} value={k.value} icon={k.icon} color={k.color} bg={k.bg} kind={k.kind} active={k.filter === statusFilter} onClick={k.filter ? () => setStatusFilter(statusFilter === k.filter ? 'ALL' : k.filter) : undefined} />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight" data-tour="purchases-list-title">Recepciones</h2></div>
          <div className="erp-list-toolbar flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto" data-tour="purchases-list-actions">
            <PurchaseViewTutorial view="receipts" />
            <PdfDownloadButton label="Exportar" includeRoll={false} onDownload={(format) => void handleExportListPdf(format)} />
            <ViewLayoutSelect value={layoutMode} onChange={(value) => setLayoutMode(value === 'kanban' ? 'table' : value)} ariaLabel="Elegir distribución de recepciones" />
            <div className="relative flex-1 min-w-0"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-full sm:w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }} /></div>
            {purchaseAlert && <PurchaseAlertsButton alert={purchaseAlert} onItemSelect={setHighlightedAlertId} />}
            {canPerform('PURCHASES_RECEIPTS', 'create') && (
              <Button onClick={() => setEditingId('NEW')} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nueva Recepción</Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filteredData} columns={columns} onRowUpdate={handleUpdate} onRowClick={(row) => setDetailReceipt(row)} isLoading={loading} pagination={pagination} layoutMode={layoutMode === 'cards' ? 'cards' : 'responsive'} highlightedRowId={highlightedAlertId} bulkAction="cancel"
          onBulkDelete={canPerform('PURCHASES_RECEIPTS', 'delete') ? async (ids) => {
            const validIds = ids.map(String).filter((id) => {
              const receipt = data.find((candidate) => candidate.id === id);
              return !id.startsWith('new-') && Boolean(receipt) && getReceiptDisplayStatus(receipt as PurchaseReceipt) === 'PENDING';
            });
            if (validIds.length === 0) return;
            const cancelToastId = toast.loading(`Cancelando ${validIds.length} recepción${validIds.length === 1 ? '' : 'es'}...`);
            let cancelled = 0;
            let failed = 0;
            for (const id of validIds) {
              try {
                await purchaseReceiptsService.cancel(id, 'Cancelación masiva');
                cancelled += 1;
              } catch {
                failed += 1;
              }
            }
            if (failed > 0) {
              toast.error(`${cancelled} recepción${cancelled === 1 ? '' : 'es'} cancelada${cancelled === 1 ? '' : 's'}; ${failed} no se pudieron cancelar.`, { id: cancelToastId });
            } else {
              toast.success(`${cancelled} recepción${cancelled === 1 ? '' : 'es'} cancelada${cancelled === 1 ? '' : 's'}.`, { id: cancelToastId });
            }
            if (cancelled > 0) onRefresh();
          } : undefined}
          actions={(row) => {
            const receiptStatus = getReceiptDisplayStatus(row);
            const canReceiveRow = receiptStatus === 'PENDING'
              && canPerform('PURCHASES_RECEIPTS', 'approve')
              && canPerform('PURCHASES_RECEIPTS', 'edit');
            const isPayableReceipt = ['RECEIVED', 'WITH_INCIDENTS'].includes(receiptStatus);
            const needsInventorySync = ['RECEIVED', 'WITH_INCIDENTS'].includes(receiptStatus)
              && (!row.inventoryProcessedAt || (row.items || []).some((item: any) =>
                item.stockApplies !== false
                && Number(item.quantityReceived || 0) > Number(item.inventoryProcessedQuantity || 0),
              ));
            const activeInvoice = isPayableReceipt
              ? (row.supplierInvoices || []).find((invoice: any) => String(invoice.status || '').toUpperCase() !== 'CANCELLED')
              : undefined;
            const payableInvoice = activeInvoice && Number(activeInvoice.balance || 0) > 0 ? activeInvoice : undefined;
            const canCreateCredit = Boolean(activeInvoice)
              && !needsInventorySync
              && canPerform('PURCHASES_RECEIPTS', 'approve')
              && canPerform('PURCHASES_RETURNS', 'create');
            const canRegisterPayment = Boolean(payableInvoice)
              && canPerform('PURCHASES_PAYMENTS', 'create')
              && canPerform('PURCHASES_PAYMENTS', 'approve');
            const canRegisterInvoice = isPayableReceipt && !activeInvoice
              && canPerform('PURCHASES_RECEIPTS', 'edit')
              && canPerform('PURCHASES_PAYMENTS', 'create')
              && canPerform('PURCHASES_PAYMENTS', 'approve');
            return (
              <div className="flex min-w-max items-center justify-end gap-1" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
                <Button title="Ver detalle completo" aria-label={`Ver detalle completo de ${row.number || 'recepción'}`} variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => { setDetailReceipt(null); setEditingId(String(row.id)); }}>
                  <Eye className="size-4" />
                </Button>
                {canReceiveRow && (
                  <Button
                    title="Recepcionar"
                    aria-label={`Recepcionar ${row.number || 'recepción'}`}
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 rounded-lg hover:bg-primary/10 hover:text-primary"
                    onClick={() => setEditingId(row.id)}
                  >
                    <PackageCheck className="size-4" />
                  </Button>
                )}
                {isPayableReceipt && (canRegisterPayment || canRegisterInvoice) && (
                  <Button
                    title={canRegisterPayment ? 'Registrar pago' : 'Registrar factura y pago'}
                    aria-label={`${canRegisterPayment ? 'Registrar pago' : 'Registrar factura y pago'} de ${row.number || 'recepción'}`}
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 rounded-lg text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                    onClick={() => openPaymentModal(row, payableInvoice)}
                  >
                    <Banknote className="size-4" />
                  </Button>
                )}
                {canCreateCredit && (
                  <Button
                    title="Crear crédito del proveedor"
                    aria-label={`Crear crédito del proveedor desde ${row.number || 'recepción'}`}
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 rounded-lg text-primary hover:bg-primary/10 hover:text-primary"
                    onClick={() => openReceiptCredit(row, activeInvoice)}
                  >
                    <Send className="size-4" />
                  </Button>
                )}
                {needsInventorySync && canPerform('PURCHASES_RECEIPTS', 'approve') && (
                  <Button
                    title="Reintentar sincronización con inventario"
                    aria-label={`Reintentar inventario de ${row.number || 'recepción'}`}
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 rounded-lg text-amber-600 hover:bg-amber-500/10 hover:text-amber-700"
                    onClick={() => void handleRepairInventory(row)}
                  >
                    <RefreshCw className="size-4" />
                  </Button>
                )}
                {canPerform('PURCHASES_RECEIPTS', 'delete') && receiptStatus === 'PENDING' && (
                  <Button
                    title="Cancelar recepción"
                    aria-label={`Cancelar ${row.number || 'recepción'}`}
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 rounded-lg text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                    onClick={() => { setPendingCancelId(row.id); setCancelReason(''); }}
                  >
                    <Ban className="size-4" />
                  </Button>
                )}
              </div>
            );
          }}
        />
      </div>
      {paymentDialog}
      {creditDialog}

      <SalesDocumentDetailSheet
        key={detailReceipt?.id || 'receipt-detail'}
        document={detailReceipt ? buildReceiptPanel(detailReceipt) : null}
        entity="PURCHASE_RECEIPT"
        open={Boolean(detailReceipt)}
        onClose={() => setDetailReceipt(null)}
        onDownloadPdf={(format) => detailReceipt ? void handleDownloadReceiptPdf(detailReceipt, format) : undefined}
      />

      <Dialog open={inventoryCostOperations !== null} onOpenChange={(open) => { if (!open) setInventoryCostOperations(null); }}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] !max-w-[min(96vw,1400px)] overflow-hidden rounded-3xl border-primary/20 bg-background/95 p-0 shadow-2xl backdrop-blur-xl">
          <DialogHeader className="border-b border-border/60 bg-gradient-to-br from-primary/[0.10] via-background to-emerald-500/[0.06] px-6 py-6 pr-12">
            <DialogTitle className="flex items-center gap-3 text-xl font-black uppercase tracking-tight">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <Calculator className="size-5" />
              </span>
              Costo promedio actualizado
            </DialogTitle>
            <DialogDescription className="max-w-3xl text-sm leading-relaxed">
              El inventario se actualizó por producto usando el promedio ponderado de la existencia anterior y las unidades recién recibidas. Esta es la operación aplicada en moneda base.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[62vh] space-y-4 overflow-y-auto px-6 py-5">
            {(inventoryCostOperations || []).map((operation, index) => {
              const previousQuantity = Number(operation.previousQuantity || 0);
              const previousUnitCost = Number(operation.previousUnitCost || 0);
              const previousTotalCost = Number(operation.previousTotalCost ?? previousQuantity * previousUnitCost);
              const receivedQuantity = Number(operation.receivedQuantity || 0);
              const receivedUnitCost = Number(operation.receivedUnitCost || 0);
              const receivedSubtotal = Number(operation.receivedSubtotal || 0);
              const receivedTaxAmount = Number(operation.receivedTaxAmount || 0);
              const receivedWithholdingTotal = Number(operation.receivedWithholdingTotal || 0);
              const receivedTotalCost = Number(operation.receivedTotalCost ?? receivedQuantity * receivedUnitCost);
              const finalQuantity = Number(operation.finalQuantity || 0);
              const newAverageCost = Number(operation.newAverageCost || 0);

              return (
                <section key={`${operation.productId}-${index}`} className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm">
                  <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/[0.18] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-foreground">{operation.productName}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                        {operation.productCode && <span className="font-mono text-primary">{operation.productCode}</span>}
                        <span>Producto {index + 1} de {inventoryCostOperations?.length || 0}</span>
                      </p>
                    </div>
                    <Badge variant="outline" className="w-fit border-emerald-500/30 bg-emerald-500/10 text-[10px] font-black uppercase tracking-wider text-emerald-600">
                      <CheckCircle2 className="mr-1.5 size-3.5" /> Costo actualizado
                    </Badge>
                  </div>

                  <div className="grid gap-3 p-5 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
                    <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Existencia anterior</p>
                      <p className="mt-3 text-xl font-black tabular-nums">{formatInventoryOperationQuantity(previousQuantity)} uds.</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatInventoryOperationAmount(previousUnitCost, operation.baseCurrency)} por unidad</p>
                      <p className="mt-2 border-t border-border/50 pt-2 text-xs font-black tabular-nums text-foreground">Valor: {formatInventoryOperationAmount(previousTotalCost, operation.baseCurrency)}</p>
                    </div>

                    <div className="hidden items-center justify-center text-primary md:flex"><ArrowRight className="size-5" /></div>

                    <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">Entrada recibida</p>
                      <p className="mt-3 text-xl font-black tabular-nums text-primary">+{formatInventoryOperationQuantity(receivedQuantity)} uds.</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatInventoryOperationAmount(receivedUnitCost, operation.baseCurrency)} por unidad efectivo</p>
                      <p className="mt-2 border-t border-primary/15 pt-2 text-xs font-black tabular-nums text-primary">Valor: {formatInventoryOperationAmount(receivedTotalCost, operation.baseCurrency)}</p>
                    </div>

                    <div className="hidden items-center justify-center text-primary md:flex"><ArrowRight className="size-5" /></div>

                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.08] p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Nuevo resultado</p>
                      <p className="mt-3 text-xl font-black tabular-nums text-emerald-700 dark:text-emerald-400">{formatInventoryOperationQuantity(finalQuantity)} uds.</p>
                      <p className="mt-1 text-xs text-muted-foreground">Nuevo costo promedio por unidad</p>
                      <p className="mt-2 border-t border-emerald-500/20 pt-2 text-sm font-black tabular-nums text-emerald-700 dark:text-emerald-400">{formatInventoryOperationAmount(newAverageCost, operation.baseCurrency)}</p>
                    </div>
                  </div>

                  <div className="mx-5 mb-5 grid gap-2 rounded-2xl border border-primary/20 bg-primary/[0.035] p-4 text-xs sm:grid-cols-4">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Subtotal entrada</p>
                      <p className="mt-1 font-black tabular-nums">{formatInventoryOperationAmount(receivedSubtotal, operation.baseCurrency)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">IVA incluido</p>
                      <p className="mt-1 font-black tabular-nums text-rose-500">+{formatInventoryOperationAmount(receivedTaxAmount, operation.baseCurrency)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Retención aplicada</p>
                      <p className="mt-1 font-black tabular-nums text-amber-600">-{formatInventoryOperationAmount(receivedWithholdingTotal, operation.baseCurrency)}</p>
                    </div>
                    <div className="border-t border-primary/15 pt-2 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                      <p className="text-[9px] font-black uppercase tracking-widest text-primary/70">Costo efectivo entrada</p>
                      <p className="mt-1 font-black tabular-nums text-primary">{formatInventoryOperationAmount(receivedTotalCost, operation.baseCurrency)}</p>
                    </div>
                  </div>

                  <div className="mx-5 mb-5 rounded-2xl border border-dashed border-primary/30 bg-primary/[0.035] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary">Operación ponderada</p>
                      <p className="text-[10px] font-bold text-muted-foreground">Moneda base: {operation.baseCurrency}{operation.sourceCurrency !== operation.baseCurrency ? ` · entrada ${operation.sourceCurrency} · tasa ${formatExchangeRate(operation.exchangeRate)}` : ''}</p>
                    </div>
                    <p className="mt-3 overflow-x-auto whitespace-nowrap font-mono text-xs font-bold text-foreground">
                      ({formatInventoryOperationQuantity(previousQuantity)} × {formatInventoryOperationAmount(previousUnitCost, operation.baseCurrency)}) + ({formatInventoryOperationQuantity(receivedQuantity)} × {formatInventoryOperationAmount(receivedUnitCost, operation.baseCurrency)})
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      ({formatInventoryOperationAmount(previousTotalCost, operation.baseCurrency)} + {formatInventoryOperationAmount(receivedTotalCost, operation.baseCurrency)}) ÷ {formatInventoryOperationQuantity(finalQuantity)} uds. = <strong className="text-base text-primary">{formatInventoryOperationAmount(newAverageCost, operation.baseCurrency)}</strong>
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Entrada: {formatInventoryOperationAmount(receivedSubtotal, operation.baseCurrency)} + IVA {formatInventoryOperationAmount(receivedTaxAmount, operation.baseCurrency)} − retención {formatInventoryOperationAmount(receivedWithholdingTotal, operation.baseCurrency)} = <strong className="text-primary">{formatInventoryOperationAmount(receivedTotalCost, operation.baseCurrency)}</strong>
                    </p>
                  </div>

                  {(operation.lines || []).length > 0 && (
                    <div className="border-t border-border/60 px-5 py-4">
                      <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Detalle de entradas consideradas</p>
                      <div className="space-y-2">
                        {operation.lines.map((line, lineIndex) => (
                          <div key={`${operation.productId}-line-${lineIndex}`} className="grid gap-2 rounded-xl border border-border/60 bg-background/50 px-3 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center">
                            <span className="min-w-0 truncate font-bold">{line.description}</span>
                            <span className="tabular-nums text-muted-foreground">{formatInventoryOperationQuantity(line.quantity)} uds.</span>
                            <span className="tabular-nums text-muted-foreground">{formatInventoryOperationAmount(line.baseUnitCost, operation.baseCurrency)}/ud. efectivo</span>
                            <span className="text-right font-black tabular-nums text-foreground">
                              {formatInventoryOperationAmount(line.totalCost, operation.baseCurrency)}
                              <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">IVA +{formatInventoryOperationAmount(line.sourceTaxAmount, operation.sourceCurrency)} · Ret. -{formatInventoryOperationAmount(line.sourceWithholdingAmount, operation.sourceCurrency)}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <DialogFooter className="border-t border-border/60 bg-muted/[0.12] px-6 py-4">
            <Button className="w-full rounded-xl font-black uppercase tracking-widest sm:w-auto" onClick={() => setInventoryCostOperations(null)}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingCancelId !== null}
        onOpenChange={(open) => { if (!open) { setPendingCancelId(null); setCancelReason(''); } }}
        title="¿Cancelar recepción?"
        description="La recepción se conservará para auditoría, pero quedará cancelada y ya no podrá continuar al inventario. Esta acción no se puede deshacer."
        confirmLabel="Cancelar recepción"
        variant="destructive"
        loading={cancelLoading}
        disabled={!cancelReason.trim()}
        onConfirm={handleCancelConfirm}
      >
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium text-foreground">Motivo de cancelación *</label>
          <textarea
            className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            rows={3}
            placeholder="Ej.: recepción duplicada, orden cancelada, error del proveedor..."
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
