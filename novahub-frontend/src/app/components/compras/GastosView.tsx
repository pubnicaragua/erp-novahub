import { useState, useEffect, useRef } from 'react';
import { 
  Wallet, Plus, Search, Eye, TrendingDown, Clock, Tag, ChevronLeft, CalendarRange, FileText, Upload, FileDown, Ban, Lock, CircleDollarSign, Send, Pencil, X
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { DateField } from '../ui/DateField';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Combobox } from '../ui/Combobox';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { expensesService } from '../../services/compras.service';
import type { Expense, Supplier } from '../../types';
import type { SalesPaginationControls } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { toast } from '@/app/services/toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePurchasesIntegrationPolicy } from '../../hooks/usePurchasesIntegrationPolicy';
import { storageService } from '../../services/storage.service';
import { PurchaseKpiCard } from './PurchaseKpiCard';
import { KpiSummaryNotice } from '../ui/KpiSummaryNotice';
import { getKpiSummaryRows } from '../../utils/kpiSummary';
import { PurchaseViewTutorial } from './PurchaseViewTutorial';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { formatDateEs } from '../../utils/dateFormat';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';
import { ImportProgressOverlay } from '../ui/ImportProgressOverlay';
import { PurchaseAlertsButton, type PurchaseAlertDetail } from './PurchaseAlertsButton';
import { hasPaymentReferenceField, requiresPaymentReference } from '../../utils/paymentMethods';
import { formatCurrencyAmount, summarizeAmountsByCurrency } from '../../utils/currency';
import { PdfDownloadButton } from '../ui/PdfDownloadButton';
import type { PdfDownloadFormat, PdfExportScope } from '../../utils/pdfDownloadFormats';
import { generatePurchaseListPDF, generatePurchaseRecordPDF } from '../../utils/purchaseExports';
import { SalesDocumentDetailSheet, type SalesDocumentPanelData } from '../ventas/SalesDocumentDetailSheet';
import { parseSpreadsheetInWorker } from '../../utils/import-spreadsheet';
import { downloadExpenseImportTemplate } from './expense-import-template';
import type { ExpenseImportBlockResponse, ExpenseImportPreviewResponse, ExpenseImportRow } from '../../services/compras.service';
import { ExpenseImportPreviewView } from './ExpenseImportPreviewView';
import { CurrencySelector } from '../ui/CurrencySelector';
import { BankAccountSelect } from '../ui/BankAccountSelect';
import { isBankPaymentMethod } from '../../utils/paymentMethods';
import { formatDecimalInput, normalizeDecimalInput } from '../../utils/decimalInput';
import { fetchAllPaginatedRows } from '../../utils/export-utils';
import { createReportWorkbook } from '../../utils/reportWorkbook';
import { VoiceExpenseComposer } from './VoiceExpenseComposer';
import type { VoiceExpenseDraft } from '../../utils/voice-expense-parser';

interface Props { data: Expense[]; summaryData?: Expense[]; summaryLoading?: boolean; summaryError?: boolean; loading: boolean; onRefresh: () => void; supplierCatalog?: Supplier[]; expenseCategoryCatalog?: any[]; pagination?: SalesPaginationControls; onSearchChange?: (value: string) => void; onDateChange?: (from?: string, to?: string) => void; purchaseAlert?: PurchaseAlertDetail; targetId?: string | null; onClearTargetId?: () => void; isSidebarCollapsed?: boolean; }
type KpiFilter = { type: 'none' } | { type: 'draft' } | { type: 'pending' } | { type: 'category'; category: string };
type DateFilterPreset = 'all' | 'month' | 'year' | 'range';
const PAYMENT_SOURCE_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  CHECK: 'Cheque',
  CARD: 'Tarjeta',
  MIXED: 'Pago mixto',
  BANK: 'Banco',
};
const paymentSourceLabel = (value?: string | null) => PAYMENT_SOURCE_LABELS[String(value || '').toUpperCase()] || value || '-';
const paymentMethodOptions = [
  { label: 'Efectivo', value: 'CASH' },
  { label: 'Tarjeta', value: 'CARD' },
  { label: 'Transferencia', value: 'TRANSFER' },
  { label: 'Cheque', value: 'CHECK' },
] as const;
const MAX_EVIDENCE_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_EVIDENCE_FILE_BYTES = 10 * 1024 * 1024;

const statusOpts = [
  { label: 'Borrador',  value: 'DRAFT',    color: 'bg-primary/10 text-primary' },
  { label: 'Pendiente', value: 'PENDING',  color: 'bg-primary/10 text-primary' },
  { label: 'Pagado',    value: 'PAID',     color: 'bg-primary/10 text-primary' },
];

export function GastosView({ data, summaryData, summaryLoading, summaryError, loading, onRefresh, supplierCatalog = [], expenseCategoryCatalog = [], pagination, onSearchChange, onDateChange, purchaseAlert, targetId, onClearTargetId, isSidebarCollapsed = true }: Props) {
  const { canPerform, user } = useAuth();
  const integrationPolicyQuery = usePurchasesIntegrationPolicy();
  const integrationPolicyReady = !integrationPolicyQuery.isFetching && !integrationPolicyQuery.isError && Boolean(integrationPolicyQuery.data);
  const accountingConnectionEnabled = integrationPolicyReady && integrationPolicyQuery.data?.accountingRequired === true;
  const financeConnectionEnabled = integrationPolicyReady && integrationPolicyQuery.data?.financeEnabled === true;
  const { exchangeRate: globalRate, displayCurrency, baseCurrency, displayMode, valuationMode, valuationModeSuffix, formatConvertedAmount, formatCurrentAmount, convertAmount, convertCurrentAmount, formatExplicitAmount } = useCurrency();
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  useEffect(() => { setExpenseCategories(expenseCategoryCatalog); }, [expenseCategoryCatalog]);
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('purchases-expenses-layout', 'table', 24 * 365);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [activeKpiFilter, setActiveKpiFilter] = useState<KpiFilter>({ type: 'none' });
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('all');
  const [rangeFrom, setRangeFrom] = useState<string>('');
  const [rangeTo, setRangeTo] = useState<string>('');
  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string } | null>(null);

  useEffect(() => {
    if (datePreset === 'range') {
      onDateChange?.(appliedRange?.from, appliedRange?.to);
    } else {
      onDateChange?.(undefined, undefined);
    }
  }, [datePreset, appliedRange, onDateChange]);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [readingFile, setReadingFile] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [parsedImportRows, setParsedImportRows] = useState<Record<string, any>[]>([]);
  const [importResult, setImportResult] = useState<{ total: number; created: number; skipped: number; errors: string[] } | null>(null);
  const [expenseImportPreview, setExpenseImportPreview] = useState<ExpenseImportPreviewResponse | null>(null);
  const [expenseImportPreviewOpen, setExpenseImportPreviewOpen] = useState(false);
  const [expenseImportPreviewStale, setExpenseImportPreviewStale] = useState(false);
  const [validatingExpenseImport, setValidatingExpenseImport] = useState(false);
  const [expenseImportAttemptId, setExpenseImportAttemptId] = useState<string | null>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const expenseImportValidationTimerRef = useRef<number | null>(null);
  const expenseImportValidationRunningRef = useRef(false);
  const expenseImportValidationRevisionRef = useRef(0);
  const expenseImportValidationQueuedRef = useRef(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<Expense> | null>(null);
  const [highlightedAlertId, setHighlightedAlertId] = useState<string | null>(null);
  const [paymentExpense, setPaymentExpense] = useState<Expense | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethodOptions)[number]['value']>('CASH');
  const [paymentBankAccountId, setPaymentBankAccountId] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [selectedExpenseDetail, setSelectedExpenseDetail] = useState<Expense | null>(null);

  useEffect(() => {
    if (!highlightedAlertId) return;
    const timeout = window.setTimeout(() => setHighlightedAlertId(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [highlightedAlertId]);

  useEffect(() => () => {
    if (expenseImportValidationTimerRef.current !== null) {
      window.clearTimeout(expenseImportValidationTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!targetId || !data.some((expense) => expense.id === targetId)) return;
    setHighlightedAlertId(targetId);
    setEditingId(targetId);
    onClearTargetId?.();
  }, [targetId, data, onClearTargetId]);

  useEffect(() => {
    setSuppliers(supplierCatalog);
  }, [supplierCatalog]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (editingId) {
        if (editingId === 'NEW') {
           setLocalDoc({
             date: new Date().toISOString(),
             time: new Date().toTimeString().slice(0, 5),
              amount: 0,
               currency: displayCurrency,
              exchangeRate: globalRate,
              category: 'OPERACIONAL',
              categoryCustom: '',
              expenseCategoryId: '',
              description: '',
              paidTo: '',
              status: 'DRAFT',
              evidenceFileName: '',
              evidenceFileType: '',
              evidenceFileSize: 0,
              evidenceFileUrl: '',
            });
        } else {
           const found = data.find(x => x.id === editingId);
           setLocalDoc(found ? JSON.parse(JSON.stringify(found)) : null);
        }
      } else {
        setLocalDoc(null);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [editingId, data, globalRate, displayCurrency]);

  const uniqueCategories = Array.from(new Set((summaryData ?? data).map(g => String(g.category || '').toUpperCase()).filter(Boolean)));

  const filtered = data.filter(g => {
    const matchesSearch =
      (g.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (g.category || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (activeKpiFilter.type === 'draft') return String(g.status || '').toUpperCase() === 'DRAFT';
    if (activeKpiFilter.type === 'pending') return String(g.status || '').toUpperCase() === 'PENDING';
    if (activeKpiFilter.type === 'category') return String(g.category || '').toUpperCase() === activeKpiFilter.category;
    return true;
  });

  const colFilters = useColumnFilters();
  const filterGetters = {
    date: (row: Expense) => (row.date ? new Date(row.date).getTime() : null),
    category: (row: Expense) => String(row.category || '').toUpperCase(),
    amount: (row: Expense) => Number(row.amount || 0),
  };
  const filteredData = colFilters.applyTo(filtered, filterGetters);
  const resolvedSummaryRows = summaryData === undefined && !summaryLoading && !summaryError ? data : getKpiSummaryRows({ data: summaryData, isLoading: summaryLoading, isError: summaryError });
  const summarySearchRows = (resolvedSummaryRows || []).filter((expense) =>
    (expense.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    || (expense.category || '').toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const summaryRowsWithoutQuickFilter = colFilters.applyTo(summarySearchRows, filterGetters);
  const summaryFilteredData = colFilters.applyTo(summarySearchRows.filter((expense) => {
    if (activeKpiFilter.type === 'draft') return String(expense.status || '').toUpperCase() === 'DRAFT';
    if (activeKpiFilter.type === 'pending') return String(expense.status || '').toUpperCase() === 'PENDING';
    if (activeKpiFilter.type === 'category') return String(expense.category || '').toUpperCase() === activeKpiFilter.category;
    return true;
  }), filterGetters);

  const handleExportListPdf = async (format: PdfDownloadFormat, scope: PdfExportScope = 'page') => {
    const exportToastId = toast.loading('Generando reporte de gastos...');
    try {
      const allRows = scope === 'all'
        ? await fetchAllPaginatedRows<Expense>((page, pageSize) => expensesService.getAll({
          page,
          pageSize,
          report: true,
          export: true,
          light: true,
          search: searchTerm.trim() || undefined,
          dateFrom: appliedRange?.from,
          dateTo: appliedRange?.to,
        }))
        : data;
      const exportFiltered = allRows.filter((expense) => {
        const search = searchTerm.toLowerCase();
        const matchesSearch = (expense.description || '').toLowerCase().includes(search)
          || (expense.category || '').toLowerCase().includes(search);
        if (!matchesSearch) return false;
        if (activeKpiFilter.type === 'draft') return String(expense.status || '').toUpperCase() === 'DRAFT';
        if (activeKpiFilter.type === 'pending') return String(expense.status || '').toUpperCase() === 'PENDING';
        if (activeKpiFilter.type === 'category') return String(expense.category || '').toUpperCase() === activeKpiFilter.category;
        return true;
      });
      const exportRows = colFilters.applyTo(exportFiltered, filterGetters);
      const totalExpenses = exportRows.reduce((sum, expense) => sum + convertAmount(
        Number(expense.amount || 0),
        expense.currency,
        expense.exchangeRate,
      ), 0);
      await generatePurchaseListPDF({
        title: 'Gastos',
        rows: exportRows,
        subtitle: [`Período: ${appliedRange?.from || 'Inicio abierto'} – ${appliedRange?.to || 'hoy'}`, `Búsqueda: ${searchTerm || 'Todas'}`, `Filtro: ${activeKpiFilter.type === 'none' ? 'Todos' : activeKpiFilter.type}`].join(' · '),
        tenantName: user?.tenantName || '',
        tenantLogo: user?.sessionBranding?.logo || null,
        format,
        targetKey: 'compras.expense',
        summary: { label: 'Total general', value: formatConvertedAmount(totalExpenses, displayCurrency, globalRate), columnIndex: 3 },
        summaryPlacement: 'footer',
        columns: [
          { label: 'Fecha', value: (row) => row.date ? formatDateEs(row.date) : '—' },
          { label: 'Categoría', value: (row) => row.category || '—' },
          { label: 'Descripción', value: (row) => row.description || '—' },
          { label: 'Monto', align: 'right', value: (row) => formatConvertedAmount(Number(row.amount || 0), row.currency, row.exchangeRate) },
          { label: 'Estado', align: 'center', value: (row) => statusOpts.find((option) => option.value === String(row.status || '').toUpperCase())?.label || row.status || '—' },
        ],
      });
      toast.success('Reporte PDF descargado', { id: exportToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo generar el reporte', { id: exportToastId });
    }
  };

  const handleExportExcel = async () => {
    try {
      const allRows = await fetchAllPaginatedRows<Expense>((page, pageSize) => expensesService.getAll({
        page, pageSize, report: true, export: true, light: true,
        search: searchTerm.trim() || undefined,
        dateFrom: appliedRange?.from,
        dateTo: appliedRange?.to,
      }));
      const search = searchTerm.toLowerCase();
      const exportFiltered = allRows.filter((expense) => {
        const matchesSearch = (expense.description || '').toLowerCase().includes(search)
          || (expense.category || '').toLowerCase().includes(search);
        if (!matchesSearch) return false;
        if (activeKpiFilter.type === 'draft') return String(expense.status || '').toUpperCase() === 'DRAFT';
        if (activeKpiFilter.type === 'pending') return String(expense.status || '').toUpperCase() === 'PENDING';
        if (activeKpiFilter.type === 'category') return String(expense.category || '').toUpperCase() === activeKpiFilter.category;
        return true;
      });
      const exportRows = colFilters.applyTo(exportFiltered, filterGetters);
      createReportWorkbook({
        fileName: 'gastos.xlsx',
        sheets: [{ name: 'Gastos', rows: exportRows.map(row => ({ Fecha: row.date || '—', Categoria: row.category || '—', Descripcion: row.description || '—', Monto: Number(row.amount || 0), Moneda: row.currency || '—', Estado: row.status || '—' })) }],
        filters: { Búsqueda: searchTerm || 'Todas', Desde: appliedRange?.from || '—', Hasta: appliedRange?.to || '—', Filtro: activeKpiFilter.type === 'none' ? 'Todos' : activeKpiFilter.type === 'category' ? activeKpiFilter.category : activeKpiFilter.type },
      });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo generar el Excel de gastos');
    }
  };

  const categoryOptions = Array.from(new Set(filtered.map((g) => String(g.category || '').toUpperCase()).filter(Boolean)))
    .map((value) => ({ value, label: value === 'OTRO' ? 'Otro' : value, count: filtered.filter((g) => String(g.category || '').toUpperCase() === value).length }));

  const normalizeImportHeader = (value: unknown) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_/-]+/g, '');
  const getImportCell = (row: Record<string, any>, aliases: string[]) => {
    const match = aliases.map(normalizeImportHeader).find((alias) => Object.prototype.hasOwnProperty.call(row, alias));
    return match ? row[match] : '';
  };

  const parseExpensesFile = async (file: File, onProgress?: (progress: number) => void) => {
    if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error('Selecciona un archivo Excel válido (.xlsx o .xls)');
    const { rows: rawSheet } = await parseSpreadsheetInWorker(file, 'gastos', false, onProgress);
    if (rawSheet.length < 2) return [];
    const headers = (rawSheet[0] || []).map(normalizeImportHeader);
    return rawSheet.slice(1).map((values: any[], index: number) => {
      const row: Record<string, any> = { sourceRowNumber: index + 2 };
      headers.forEach((header: string, columnIndex: number) => {
        const value = values[columnIndex];
        if (header) row[header] = value instanceof Date || typeof value === 'number' ? value : String(value ?? '').trim();
      });
      return row;
    }).filter((row) => Object.entries(row).some(([key, value]) => key !== 'sourceRowNumber' && String(value ?? '').trim()));
  };

  const normalizeExpenseCategory = (raw: string) => {
    const category = String(raw || '').trim().toUpperCase();
    if (['OPERACIONAL', 'OPERATIVO'].includes(category)) return 'OPERATIVO';
    return category;
  };

  const normalizeExpenseStatus = (raw: string) => {
    const status = String(raw || '').trim().toUpperCase();
    if (['DRAFT', 'PENDING', 'PAID'].includes(status)) return status;
    return status || 'PENDING';
  };

  const normalizeExpensePaymentSource = (raw: string) => {
    const method = String(raw || '').trim().toUpperCase();
    const aliases: Record<string, string> = {
      EFECTIVO: 'CASH', CASH: 'CASH', TARJETA: 'CARD', CARD: 'CARD',
      TRANSFERENCIA: 'TRANSFER', TRANSFER: 'TRANSFER', CHEQUE: 'CHECK', CHECK: 'CHECK',
    };
    return aliases[method] || method;
  };

  const parseImportNumber = (raw: unknown) => {
    if (typeof raw === 'number') return raw;
    const value = String(raw ?? '').trim().replace(/\s/g, '');
    if (!value) return undefined;
    const comma = value.lastIndexOf(',');
    const dot = value.lastIndexOf('.');
    const normalized = comma >= 0 && dot >= 0
      ? (comma > dot ? value.replace(/\./g, '').replace(',', '.') : value.replace(/,/g, ''))
      : comma >= 0 ? value.replace(',', '.') : value;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : raw;
  };

  const normalizeImportDate = (raw: unknown) => {
    const asIsoDate = (year: number, month: number, day: number) => {
      const candidate = new Date(year, month - 1, day);
      if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return null;
      return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    };
    if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? raw : asIsoDate(raw.getFullYear(), raw.getMonth() + 1, raw.getDate()) || raw;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      const date = new Date(Date.UTC(1899, 11, 30) + raw * 86400000);
      return asIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()) || raw;
    }
    const value = String(raw ?? '').trim();
    if (!value) return value;
    const iso = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (iso) return asIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3])) || value;
    const local = value.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
    if (local) return asIsoDate(Number(local[3]), Number(local[2]), Number(local[1])) || value;
    const serial = Number(value);
    if (Number.isFinite(serial) && serial > 0) {
      const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return asIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()) || value;
    }
    return value;
  };

  const handleExpenseFileChange = async (file: File | undefined) => {
    setImportFile(file || null);
    setParsedImportRows([]);
    setExpenseImportPreview(null);
    setExpenseImportPreviewOpen(false);
    setExpenseImportPreviewStale(false);
    setExpenseImportAttemptId(file ? crypto.randomUUID() : null);
    setImportResult(null);
    if (!file) return;
    setReadingFile(true);
    setReadingProgress(3);
    try {
      const rows = await parseExpensesFile(file, (progress) => {
        setReadingProgress(Math.min(84, Math.max(3, progress)));
      });
      setReadingProgress(90);
      setParsedImportRows(rows);
      setReadingProgress(100);
    } catch {
      setImportFile(null);
      setParsedImportRows([]);
      setExpenseImportPreviewStale(false);
      setExpenseImportAttemptId(null);
      toast.error('No se pudo leer el archivo. Verifica que sea un Excel válido.');
    } finally {
      setReadingFile(false);
      setReadingProgress(0);
    }
  };

  const buildExpenseImportRows = (rows: Record<string, any>[]): ExpenseImportRow[] => rows.map((row, index) => {
    const currency = String(getImportCell(row, ['moneda', 'currency']) || '').trim().toUpperCase();
    const paymentSource = normalizeExpensePaymentSource(String(getImportCell(row, ['metododepago', 'paymentsource', 'fuentedepago', 'cuentaorigen', 'paymentmethod'])));
    const bankAccountNumber = getImportCell(row, ['numerodecuentabancaria', 'cuentabancaria', 'bankaccountnumber', 'accountnumber']);
    return {
      sourceRowNumber: Number(row.sourceRowNumber) || index + 2,
      date: normalizeImportDate(getImportCell(row, ['fecha', 'date'])),
      description: String(getImportCell(row, ['descripcion', 'description', 'concepto']) ?? '').trim(),
      category: normalizeExpenseCategory(String(getImportCell(row, ['categoria', 'category']))),
      categoryCustom: String(getImportCell(row, ['categoriacustom', 'categorycustom', 'categoriapersonalizada']) ?? '').trim(),
      amount: parseImportNumber(getImportCell(row, ['monto', 'amount', 'importe', 'valor'])),
      currency: currency || undefined,
      exchangeRate: parseImportNumber(getImportCell(row, ['tasadecambio', 'exchangerate', 'tasa'])),
      status: normalizeExpenseStatus(String(getImportCell(row, ['estado', 'status']))),
      paymentSource: paymentSource || undefined,
      paidTo: String(getImportCell(row, ['pagadoa', 'paidto']) ?? '').trim(),
      reference: String(getImportCell(row, ['referencia', 'reference']) ?? '').trim(),
      bankAccountNumber: typeof bankAccountNumber === 'number' ? bankAccountNumber : String(bankAccountNumber ?? '').trim(),
    };
  });

  const updateExpenseImportField = (
    sourceRowNumber: number,
    field: 'estado' | 'metododepago' | 'referencia' | 'numerodecuentabancaria',
    value: string,
  ) => {
    expenseImportValidationRevisionRef.current += 1;
    setImportResult(null);
    setParsedImportRows((current) => current.map((row) => (
      Number(row.sourceRowNumber) === sourceRowNumber ? { ...row, [field]: value } : row
    )));
    setExpenseImportPreviewStale(true);
    if (expenseImportValidationTimerRef.current !== null) {
      window.clearTimeout(expenseImportValidationTimerRef.current);
    }
    expenseImportValidationTimerRef.current = window.setTimeout(() => {
      expenseImportValidationTimerRef.current = null;
      if (expenseImportPreviewOpen) void handlePreviewExpenses(true);
    }, 450);
  };

  const handlePreviewExpenses = async (automaticRefresh = false) => {
    if (!importFile) {
      if (!automaticRefresh) toast.error('Selecciona un archivo Excel.');
      return;
    }
    if (expenseImportValidationRunningRef.current) {
      expenseImportValidationQueuedRef.current = true;
      return;
    }
    expenseImportValidationRunningRef.current = true;
    const validationRevision = expenseImportValidationRevisionRef.current;
    const showBlockingProgress = !automaticRefresh || !expenseImportPreviewOpen;
    if (showBlockingProgress) setImporting(true);
    setValidatingExpenseImport(true);
    setImportProgress(8);
    setImportResult(null);
    setExpenseImportPreviewStale(true);
    try {
      const rows = parsedImportRows.length > 0
        ? parsedImportRows
        : await parseExpensesFile(importFile, (progress) => {
          setImportProgress(Math.min(28, Math.max(8, Math.round(progress * 0.29))));
        });
      setImportProgress(28);
      if (rows.length === 0) {
        toast.error('El archivo no contiene filas para importar');
        return;
      }
      const payload = buildExpenseImportRows(rows);
      const previewRows: ExpenseImportPreviewResponse['rows'] = [];
      let integrations: ExpenseImportPreviewResponse['integrations'] | undefined;
      for (let offset = 0; offset < payload.length; offset += 50) {
        const end = Math.min(payload.length, offset + 50);
        setImportProgress(30 + Math.round((end / payload.length) * 65));
        try {
          const preview = await expensesService.previewImport(payload.slice(offset, end));
          previewRows.push(...preview.rows);
          integrations = preview.integrations;
        } catch (error: any) {
          const firstRow = payload[offset].sourceRowNumber;
          const lastRow = payload[end - 1].sourceRowNumber;
          const blockMessage = `No se pudo validar el bloque ${Math.floor(offset / 50) + 1} (filas ${firstRow}-${lastRow}): ${error?.message || 'error del servidor'}`;
          previewRows.push(...payload.slice(offset, end).map((row) => ({
            sourceRowNumber: row.sourceRowNumber,
            status: 'BLOCKED' as const,
            errors: [blockMessage],
            effects: { expense: false, financeMirror: false, accountingJournal: false },
          })));
        }
      }
      if (validationRevision !== expenseImportValidationRevisionRef.current) {
        expenseImportValidationQueuedRef.current = true;
        return;
      }
      const ready = previewRows.filter((row) => row.status === 'READY').length;
      setExpenseImportPreview({
        summary: { total: previewRows.length, ready, blocked: previewRows.length - ready },
        integrations: integrations || { financeEnabled: false, accountingEnabled: false, accountingConnectionEnabled: false, autoGenerationEnabled: false },
        rows: previewRows,
      });
      if (!expenseImportAttemptId) setExpenseImportAttemptId(crypto.randomUUID());
      setExpenseImportPreviewStale(false);
      setExpenseImportPreviewOpen(true);
      setImportOpen(false);
      setImportProgress(100);
      if (!automaticRefresh) {
        toast.success(`Vista previa lista: ${ready} listos y ${previewRows.length - ready} con errores.`);
      }
    } catch (error: any) {
      if (validationRevision === expenseImportValidationRevisionRef.current) {
        toast.error(`No se pudo validar el archivo: ${error?.message || 'revisa el formato y vuelve a intentar'}`);
      } else {
        expenseImportValidationQueuedRef.current = true;
      }
    } finally {
      expenseImportValidationRunningRef.current = false;
      setValidatingExpenseImport(false);
      setImportProgress(0);
      if (showBlockingProgress) setImporting(false);
      if (expenseImportValidationQueuedRef.current || validationRevision !== expenseImportValidationRevisionRef.current) {
        expenseImportValidationQueuedRef.current = false;
        if (expenseImportValidationTimerRef.current !== null) {
          window.clearTimeout(expenseImportValidationTimerRef.current);
        }
        expenseImportValidationTimerRef.current = window.setTimeout(() => {
          expenseImportValidationTimerRef.current = null;
          if (expenseImportPreviewOpen) void handlePreviewExpenses(true);
        }, 250);
      }
    }
  };

  const handleConfirmExpenseImport = async (retryOnly = false) => {
    if (!expenseImportPreview || !expenseImportAttemptId || importing || validatingExpenseImport) return;
    if (expenseImportPreviewStale) {
      toast.error('Espera a que la vista previa se actualice automáticamente antes de confirmar.');
      return;
    }
    const eligible = expenseImportPreview.rows
      .filter((row) => retryOnly ? row.status === 'FAILED' : row.status === 'READY')
      .map((previewRow) => previewRow.sourceRowNumber);
    if (!eligible.length) {
      toast.error(retryOnly ? 'No hay filas fallidas para reintentar.' : 'No hay gastos listos para confirmar.');
      return;
    }
    const payload = buildExpenseImportRows(parsedImportRows).filter((row) => eligible.includes(row.sourceRowNumber));
    setImporting(true);
    setImportProgress(5);
    setImportResult(null);
    const outcomes: ExpenseImportBlockResponse['rows'] = [];
    const blockErrors: string[] = [];
    let importCompleted = false;
    try {
      for (let offset = 0; offset < payload.length; offset += 50) {
        const block = payload.slice(offset, offset + 50);
        setImportProgress(5 + Math.round(((offset + block.length) / payload.length) * 90));
        try {
          const result = await expensesService.confirmImportBlock({ attemptId: expenseImportAttemptId, rows: block });
          outcomes.push(...result.rows);
          setExpenseImportPreview((current) => current ? {
            ...current,
            rows: current.rows.map((row) => {
              const outcome = result.rows.find((item) => item.sourceRowNumber === row.sourceRowNumber);
              return outcome ? { ...row, ...outcome } : row;
            }),
          } : current);
        } catch (error: any) {
          const message = error?.message || 'no se pudo confirmar el bloque';
          blockErrors.push(`Bloque ${Math.floor(offset / 50) + 1}: ${message}`);
          outcomes.push(...block.map((row) => ({
            sourceRowNumber: row.sourceRowNumber,
            status: 'FAILED',
            errors: [`No se pudo confirmar este bloque: ${message}`],
          })));
        }
      }
      const allRows = expenseImportPreview.rows.map((row) => {
        const outcome = outcomes.find((item) => item.sourceRowNumber === row.sourceRowNumber);
        return outcome ? { ...row, ...outcome } : row;
      });
      const created = allRows.filter((row) => row.status === 'CONFIRMED').length;
      const errors = allRows.flatMap((row) => (row.errors || []).map((error) => `Fila ${row.sourceRowNumber}: ${error}`));
      setExpenseImportPreview((current) => current ? { ...current, rows: allRows } : current);
      setImportResult({ total: allRows.length, created, skipped: allRows.length - created, errors: errors.slice(0, 100) });
      if (created > 0) onRefresh();
      const skipped = allRows.length - created;
      if (skipped > 0) {
        const firstError = errors[0] ? ` ${errors[0].slice(0, 150)}` : '';
        toast.error(`Importación terminada: ${created} confirmados; ${skipped} no confirmados.${firstError}`);
      } else {
        toast.success(`Importación terminada: ${created} gastos confirmados. Volviendo a la tabla.`);
      }
      importCompleted = true;
    } catch (error: any) {
      toast.error(`No se pudo confirmar el bloque: ${error?.message || 'revisa la conexión e inténtalo de nuevo'}`);
    } finally {
      setImporting(false);
      setImportProgress(0);
      if (importCompleted) finishImport();
    }
  };

  const finishImport = () => {
    if (expenseImportValidationTimerRef.current !== null) {
      window.clearTimeout(expenseImportValidationTimerRef.current);
      expenseImportValidationTimerRef.current = null;
    }
    expenseImportValidationRevisionRef.current += 1;
    setImportOpen(false);
    setExpenseImportPreviewOpen(false);
    setImportResult(null);
    setImportFile(null);
    setParsedImportRows([]);
    setExpenseImportPreview(null);
    setExpenseImportPreviewStale(false);
    setExpenseImportAttemptId(null);
  };

  const clearExpenseImportFile = () => {
    if (readingFile || importing) return;
    if (expenseImportValidationTimerRef.current !== null) {
      window.clearTimeout(expenseImportValidationTimerRef.current);
      expenseImportValidationTimerRef.current = null;
    }
    expenseImportValidationRevisionRef.current += 1;
    setExpenseImportPreviewOpen(false);
    setImportFile(null);
    setParsedImportRows([]);
    setImportResult(null);
    setExpenseImportPreview(null);
    setExpenseImportPreviewStale(false);
    setExpenseImportAttemptId(null);
    if (importFileInputRef.current) importFileInputRef.current.value = '';
  };

  if (expenseImportPreviewOpen && expenseImportPreview) {
    return (
      <ExpenseImportPreviewView
        rows={buildExpenseImportRows(parsedImportRows)}
        preview={expenseImportPreview}
        previewStale={expenseImportPreviewStale}
        fileName={importFile?.name || ''}
        isSidebarCollapsed={isSidebarCollapsed}
        importing={importing}
        validating={validatingExpenseImport}
        progress={importProgress}
        result={importResult}
        onFieldUpdate={updateExpenseImportField}
        onBack={() => { setExpenseImportPreviewOpen(false); setImportOpen(true); }}
        onRevalidate={() => { void handlePreviewExpenses(); }}
        onConfirm={() => { void handleConfirmExpenseImport(); }}
        onRetryFailed={() => { void handleConfirmExpenseImport(true); }}
        onFinish={finishImport}
      />
    );
  }

  const columns: ColumnDef<Expense>[] = [
    { key: 'date',        header: 'Fecha',     width: '110px',
      headerExtra: <ColumnFilterMenu label="Fecha" sort={colFilters.state.date?.sort || null} onSort={(sort) => colFilters.setSort('date', sort)} sortOptions={[{ value: 'desc', label: 'Más recientes' }, { value: 'asc', label: 'Más antiguas' }]} />,
      render: (val) => <span className="text-xs text-muted-foreground">{val ? formatDateEs(val) : '-'}</span> },
    { key: 'category',    header: 'Categoría', width: '130px', editable: canPerform('PURCHASES_EXPENSES', 'edit'), type: 'select', options: [
        {label: 'Operacional', value: 'OPERATIVO'}, {label: 'Administrativo', value: 'ADMINISTRATIVO'}, {label: 'Ventas', value: 'VENTAS'}, {label: 'Financiero', value: 'FINANCIERO'}, {label: 'Otro', value: 'OTRO'}
      ],
      headerExtra: <ColumnFilterMenu label="Categoría" options={categoryOptions} selected={colFilters.state.category?.values || []} onSelect={(values) => colFilters.setValues('category', values)} sort={colFilters.state.category?.sort || null} onSort={(sort) => colFilters.setSort('category', sort)} />,
      render: (val, row) => <Badge variant="outline" className="text-[9px] uppercase bg-primary/5 text-primary border-none">{String(val || '').toUpperCase() === 'OTRO' ? (row.categoryCustom || 'OTRO') : (val || '-')}</Badge> },
    { key: 'description', header: 'Descripción', editable: canPerform('PURCHASES_EXPENSES', 'edit') },
    { key: 'paidTo',      header: 'Pagado a', width: '170px',
      render: (val) => <span className="text-xs font-medium text-foreground">{val || '-'}</span> },
    { key: 'paymentSource', header: 'Método de pago', width: '145px',
      render: (val) => <span className="text-xs font-black text-muted-foreground">{paymentSourceLabel(val)}</span> },
    { key: 'amount',      header: 'Monto',     width: '130px',
      headerExtra: <ColumnFilterMenu label="Monto" sort={colFilters.state.amount?.sort || null} onSort={(sort) => colFilters.setSort('amount', sort)} />,
      render: (val, row) => (
        <CurrencyValuationAmount amount={Number(val || 0)} sourceCurrency={row.currency} sourceExchangeRate={row.exchangeRate} className="font-black text-rose-500" />
      ) },
    { key: 'status',      header: 'Estado',    width: '120px',
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label || (String(val || '').toUpperCase() === 'APPROVED' ? 'Pendiente' : val) || 'Borrador'}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Expense>) => {
    const row = data.find(x => x.id === id);
    if (row && String(row.status || '').toUpperCase() === 'PAID') {
      toast.error('El gasto ya está PAGADO y contabilizado; no puede editarse en línea. Ábrelo en modo Ver.');
      throw new Error('PAID_LOCKED');
    }
    const updateToastId = toast.loading('Guardando cambios en el gasto...');
    try { await expensesService.update(id as string, updates); toast.success('Gasto actualizado', { id: updateToastId }); onRefresh(); }
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar', { id: updateToastId }); throw new Error('Update failed', { cause: e }); }
  };

  const handleStatusAction = async (row: Expense, status: 'DRAFT' | 'PENDING') => {
    if (status === 'PENDING' && !canPerform('PURCHASES_EXPENSES', 'approve')) return;
    const statusToastId = toast.loading(status === 'DRAFT' ? 'Guardando gasto como borrador...' : 'Enviando gasto a pendientes...');
    try {
      const update = status === 'PENDING' ? expensesService.updateStatus : expensesService.update;
      await update(row.id, { status } as any);
      toast.success(status === 'DRAFT' ? 'Gasto guardado como borrador' : 'Gasto guardado como pendiente', { id: statusToastId });
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo cambiar el estado del gasto', { id: statusToastId });
    }
  };

  const openPaymentDialog = (row: Expense) => {
    setPaymentExpense(row);
    setPaymentMethod('CASH');
    setPaymentBankAccountId('');
    setPaymentReference('');
  };

  const handlePayment = async () => {
    if (!paymentExpense) return;
    if (!canPerform('PURCHASES_EXPENSES', 'approve')) return;
    if (requiresPaymentReference(paymentMethod) && !paymentReference.trim()) {
      toast.error('La referencia es obligatoria para tarjeta, transferencia o cheque');
      return;
    }
    if (accountingConnectionEnabled && isBankPaymentMethod(paymentMethod) && !paymentBankAccountId) {
      toast.error('Selecciona la cuenta bancaria global que realizará el pago');
      return;
    }
    const paymentToastId = toast.loading(`Marcando ${paymentExpense.number} como pagado...`);
    try {
      setPaymentLoading(true);
      await expensesService.updateStatus(paymentExpense.id, {
        status: 'PAID',
        paymentSource: paymentMethod,
        bankAccountId: isBankPaymentMethod(paymentMethod) ? paymentBankAccountId : undefined,
        reference: paymentReference.trim() || undefined,
      } as any);
      toast.success(`Gasto pagado${financeConnectionEnabled ? ' y enviado a Finanzas' : ''}${accountingConnectionEnabled ? ' y contabilizado' : ''}.`, { id: paymentToastId });
      setPaymentExpense(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo registrar el pago del gasto', { id: paymentToastId });
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    setDeleteLoading(true);
    const deleteToastId = toast.loading('Eliminando gasto...');
    try {
      await expensesService.delete(pendingDeleteId);
      toast.success('Gasto eliminado correctamente', { id: deleteToastId });
      setPendingDeleteId(null);
      if (editingId === pendingDeleteId) setEditingId(null);
      if (selectedExpenseDetail?.id === pendingDeleteId) setSelectedExpenseDetail(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar', { id: deleteToastId });
    } finally {
      setDeleteLoading(false);
    }
  };
  const handleSaveDoc = async (statusToSave: 'DRAFT' | 'PENDING' = 'PENDING') => {
    if (!localDoc?.description) return toast.error('La descripción es obligatoria');
    if (!localDoc?.amount || localDoc.amount <= 0) return toast.error('El monto debe ser mayor a 0');
    // Clean data (ensure numbers and remove nested objects)
    const cleanedDoc = {
      ...localDoc,
      amount: Number(localDoc.amount),
      exchangeRate: Number(localDoc.exchangeRate),
      baseAmount: Number(localDoc.baseAmount),
      status: statusToSave,
    };
    delete (cleanedDoc as any).account;
    delete (cleanedDoc as any).supplier;

    if (localDoc.category === 'OTRO' && !String(localDoc.categoryCustom || '').trim()) {
      return toast.error('Debes especificar la categoría cuando eliges OTRO');
    }

    if (evidenceFile) {
      const isImage = evidenceFile.type.startsWith('image/');
      if (isImage && evidenceFile.size > MAX_EVIDENCE_IMAGE_BYTES) {
        return toast.error('La imagen original es muy pesada. Máximo 10 MB');
      }
      if (!isImage && evidenceFile.size > MAX_EVIDENCE_FILE_BYTES) {
        return toast.error('El archivo es muy pesado. Máximo 10MB');
      }
      try {
        const evidence = await storageService.uploadFile('purchase-evidence', evidenceFile, { folder: 'gastos' });
        (cleanedDoc as any).evidenceFileUrl = evidence.uri;
        (cleanedDoc as any).evidenceFileName = evidenceFile.name;
        (cleanedDoc as any).evidenceFileType = evidenceFile.type;
        (cleanedDoc as any).evidenceFileSize = evidenceFile.size;
      } catch {
        return toast.error('No se pudo procesar el archivo adjunto');
      }
    }

    const saveToastId = toast.loading(statusToSave === 'DRAFT' ? 'Guardando gasto como borrador...' : 'Guardando gasto como pendiente...');
    try {
      if (editingId === 'NEW') {
        await expensesService.create(cleanedDoc as any);
        toast.success(statusToSave === 'DRAFT' ? 'Gasto guardado como borrador' : 'Gasto registrado como pendiente', { id: saveToastId });
      } else {
        await expensesService.update(editingId!, cleanedDoc as any);
        toast.success(statusToSave === 'DRAFT' ? 'Gasto guardado como borrador' : 'Gasto guardado como pendiente', { id: saveToastId });
      }
      setEditingId(null);
      setEvidenceFile(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al guardar el gasto', { id: saveToastId });
    }
  };

  const applyVoiceExpense = (draft: VoiceExpenseDraft) => {
    setLocalDoc((current) => current ? {
      ...current,
      description: draft.description,
      amount: draft.amount || 0,
      paymentSource: draft.paymentSource || current.paymentSource || 'CASH',
      paidTo: draft.paidTo || current.paidTo || '',
      category: draft.category,
      categoryCustom: draft.categoryCustom || current.categoryCustom || '',
    } : current);
  };

  const handleDownloadExpensePdf = async (expense: Expense, format: PdfDownloadFormat = 'configured') => {
    const exportToastId = toast.loading('Generando PDF del gasto...');
    try {
      await generatePurchaseRecordPDF({
        tenantName: user?.tenantName || '',
        tenantLogo: user?.sessionBranding?.logo || null,
        format,
        targetKey: 'compras.expense',
        document: {
          title: 'Gasto',
          number: String(expense.number || expense.id),
          date: expense.date ? formatDateEs(expense.date) : undefined,
          status: statusOpts.find((option) => option.value === String(expense.status || '').toUpperCase())?.label || expense.status,
          supplier: expense.supplier?.name || expense.paidTo || 'Sin proveedor',
          fields: [
            { label: 'Categoría', value: String(expense.category || '').toUpperCase() === 'OTRO' ? expense.categoryCustom || 'Otro' : expense.category || '—' },
            { label: 'Fuente de pago', value: paymentSourceLabel(expense.paymentSource) },
            { label: 'Referencia', value: expense.reference || '—' },
          ],
          totals: [
            { label: 'Subtotal', value: formatConvertedAmount(Number(expense.amount || 0), expense.currency, expense.exchangeRate) },
            { label: 'Impuestos', value: formatConvertedAmount(0, expense.currency, expense.exchangeRate) },
            { label: 'Descuento', value: formatConvertedAmount(0, expense.currency, expense.exchangeRate) },
          ],
          total: formatConvertedAmount(Number(expense.amount || 0), expense.currency, expense.exchangeRate),
          totalLabel: 'Monto',
          lines: [{
            description: expense.description || 'Gasto',
            quantity: 1,
            unitPrice: String(String(expense.category || '').toUpperCase() === 'OTRO' ? expense.categoryCustom || 'OTRO' : expense.category || '—'),
            total: formatConvertedAmount(Number(expense.amount || 0), expense.currency, expense.exchangeRate),
          }],
          notes: expense.notes,
        },
      });
      toast.success('PDF descargado', { id: exportToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo generar el PDF', { id: exportToastId });
    }
  };

  if (editingId && localDoc) {
    const isNew = editingId === 'NEW';
    const isPaidLocked = !isNew && String(localDoc.status || '').toUpperCase() === 'PAID';
    const canMutate = isNew ? canPerform('PURCHASES_EXPENSES', 'create') : (canPerform('PURCHASES_EXPENSES', 'edit') && !isPaidLocked);
    const resolvedHour = localDoc.time || (localDoc.date ? new Date(localDoc.date).toTimeString().slice(0, 5) : '');

    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300" data-tour="purchases-form-title">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setEditingId(null)} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isNew ? 'Registrar Gasto' : 'Editar Gasto'}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Detalle de transacción</p>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:gap-3" data-tour="purchases-form-actions">
            <PurchaseViewTutorial view="expenses" context="form" />
             {!isNew && canPerform('PURCHASES_EXPENSES', 'delete') && (
                <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-700 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => setPendingDeleteId(editingId)}>
                  <Ban className="size-3 mr-2" /> Anular
                </Button>
             )}
            {isPaidLocked && (
              <div className="flex w-full items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-600 sm:w-auto">
                <Lock className="size-3.5" /> Gasto pagado y contabilizado · Solo lectura
              </div>
            )}
            {((isNew && canPerform('PURCHASES_EXPENSES', 'create')) || (!isNew && canPerform('PURCHASES_EXPENSES', 'edit'))) && !isPaidLocked && (
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <Button variant="outline" onClick={() => handleSaveDoc('DRAFT')} className="flex-1 rounded-xl px-4 font-black uppercase text-[10px] tracking-widest sm:flex-none">
                  Guardar borrador
                </Button>
                <Button onClick={() => handleSaveDoc('PENDING')} className="flex-1 rounded-xl bg-primary px-5 font-black uppercase text-[10px] tracking-widest text-primary-foreground shadow-xl shadow-primary/20 sm:flex-none">
                  Guardar pendiente
                </Button>
              </div>
            )}
            {canPerform('PURCHASES_EXPENSES', 'export') && <PdfDownloadButton label="Exportar" includePageSizes includeRoll onDownload={(format) => void handleDownloadExpensePdf(localDoc as Expense, format)} />}
          </div>
        </div>

        {canMutate && <div className="mb-4"><VoiceExpenseComposer disabled={isPaidLocked} onApply={applyVoiceExpense} /></div>}

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50 col-span-2 md:col-span-1" data-tour="purchases-form-data">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información del Gasto</p>
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Descripción / Concepto</p>
                    <Input 
                      disabled={!canMutate}
                      value={localDoc.description || ''} 
                      onChange={(e) => setLocalDoc({ ...localDoc, description: e.target.value })} 
                      className="h-8 text-xs font-bold" 
                      placeholder="Ej. Pago de internet mensual" 
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Categoría</p>
                    <Select
                      disabled={!canMutate}
                      value={localDoc.category || 'OPERATIVO'}
                      onValueChange={(cat) => {
                        const matched = expenseCategories.find(c => c.name.toUpperCase() === cat);
                        setLocalDoc({ ...localDoc, category: cat, expenseCategoryId: matched ? matched.id : '' });
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs uppercase"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OPERATIVO">Operativo</SelectItem>
                        <SelectItem value="ADMINISTRATIVO">Administrativo</SelectItem>
                        <SelectItem value="VENTAS">Ventas / Marketing</SelectItem>
                        <SelectItem value="FINANCIERO">Financiero</SelectItem>
                        <SelectItem value="OTRO">Otro</SelectItem>
                        {expenseCategories
                          .filter((category) => !['OPERATIVO', 'ADMINISTRATIVO', 'VENTAS', 'FINANCIERO', 'OTRO'].includes(String(category.name || '').toUpperCase()))
                          .map((category) => <SelectItem key={category.id} value={String(category.name).toUpperCase()}>{category.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Fecha del Gasto</p>
                    <Input 
                      disabled={!canMutate}
                      type="date" 
                      value={localDoc.date ? new Date(localDoc.date).toISOString().split('T')[0] : ''} 
                      onChange={(e) => setLocalDoc({ ...localDoc, date: new Date(e.target.value).toISOString() })} 
                      className="h-8 text-xs" 
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Hora</p>
                    <Input
                      disabled
                      value={resolvedHour}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Proveedor (Opcional)</p>
                    <Combobox
                      disabled={!canMutate}
                      options={suppliers
                        .filter(s => (s.status || '').toUpperCase() === 'ACTIVE' || s.id === localDoc.supplierId)
                        .map(s => ({ label: s.name, value: s.id, description: (s.code ? `[${s.code}] ` : '') + (s.phone || 'Sin teléfono') }))}
                      value={localDoc.supplierId || ''}
                      onChange={(val) => setLocalDoc({ ...localDoc, supplierId: val })}
                      placeholder="Asignar a un proveedor (opcional)"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Pagado a</p>
                    <Input
                      disabled={!canMutate}
                      value={localDoc.paidTo || ''}
                      onChange={(e) => setLocalDoc({ ...localDoc, paidTo: e.target.value })}
                      className="h-8 text-xs"
                      placeholder="Nombre de persona o proveedor"
                    />
                  </div>
                  {String(localDoc.category || '').toUpperCase() === 'OTRO' && (
                    <div className="col-span-2">
                      <p className="text-[10px] text-muted-foreground mb-1">Categoría personalizada</p>
                      <Input
                        disabled={!canMutate}
                        value={localDoc.categoryCustom || ''}
                        onChange={(e) => setLocalDoc({ ...localDoc, categoryCustom: e.target.value })}
                        className="h-8 text-xs"
                        placeholder="Ej. Mantenimiento externo"
                      />
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Referencia (Factura/Recibo)</p>
                    <Input 
                      disabled={!canMutate}
                      value={localDoc.reference || ''} 
                      onChange={(e) => setLocalDoc({ ...localDoc, reference: e.target.value })} 
                      className="h-8 text-xs" 
                      placeholder="N° Comprobante" 
                    />
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Adjuntar evidencia (PDF, imagen, XLSX)</p>
                    <Input
                      disabled={!canMutate}
                      type="file"
                      accept=".pdf,.xlsx,.xls,image/*"
                      onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)}
                      className="h-8 text-xs"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">Imágenes originales max 10 MB; se optimizan. Otros archivos max 10 MB.</p>
                    {(evidenceFile || localDoc.evidenceFileName) && (
                      <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-primary">
                        <FileText className="size-3" />
                        {evidenceFile?.name || localDoc.evidenceFileName}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="w-full min-w-0 rounded-2xl border-border/50" data-tour="purchases-form-summary">
            <CardContent className="p-6 flex flex-col justify-center h-full space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Valor del Gasto</p>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm border-b border-border/50 pb-4">
                   <div className="w-1/2 min-w-0">
                      <CurrencySelector
                        value={localDoc.currency || baseCurrency}
                        baseCurrency={baseCurrency}
                        exchangeRate={globalRate}
                        label="Moneda"
                        rateDecimals={2}
                        disabled={!canMutate}
                        onChange={(nextCurrency) => setLocalDoc({ ...localDoc, currency: nextCurrency, exchangeRate: nextCurrency === baseCurrency ? 1 : globalRate } as any)}
                      />
                   </div>
                   <div className="w-1/2 flex flex-col items-end">
                      <p className="text-[10px] text-muted-foreground mb-1">Monto Total</p>
                      <Input 
                        disabled={!canMutate}
                        type="text"
                        inputMode="decimal"
                        min="0" 
                        value={Number(localDoc.amount || 0) === 0 ? '' : formatDecimalInput(localDoc.amount)}
                        onChange={(e) => setLocalDoc({ ...localDoc, amount: normalizeDecimalInput(e.target.value) as any })}
                        className="h-10 text-xl font-black text-rose-500 text-right w-full max-w-[150px]" 
                        placeholder="0.00" 
                      />
                   </div>
                </div>

                {displayMode !== 'ORIGINAL' && <div className="flex justify-between items-center text-base pt-2">
                  <span className="font-black uppercase text-xs tracking-widest">Equivalente Estimado</span>
                  <span className="font-black text-muted-foreground tabular-nums text-right">
                      {localDoc.currency === 'USD'
                        ? formatCurrencyAmount(Number(localDoc.amount || 0) * (localDoc.exchangeRate || globalRate), 'NIO')
                        : formatCurrencyAmount(Number(localDoc.amount || 0) / (localDoc.exchangeRate || globalRate), 'USD')}
                  </span>
                </div>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const toDisplayAmount = (amount: number, currency?: string, rate?: number) => valuationMode === 'CURRENT'
    ? convertCurrentAmount(amount, currency)
    : convertAmount(amount, currency, rate || globalRate);
  const monthlyTotalInDisplayCurrency = summaryFilteredData
    .filter(g => new Date(g.date).getMonth() === new Date().getMonth())
    .reduce((acc, g) => acc + toDisplayAmount(Number(g.amount ?? g.baseAmount ?? 0), g.currency, g.exchangeRate), 0);
  const originalMonthlyAmounts = summarizeAmountsByCurrency(
    summaryFilteredData.filter(g => new Date(g.date).getMonth() === new Date().getMonth()),
    (expense) => Number(expense.amount ?? expense.baseAmount ?? 0),
    (expense) => expense.currency,
    baseCurrency,
  );

  const kpis = [
    { key: 'all', title: 'Gastos Operativos', value: resolvedSummaryRows ? summaryRowsWithoutQuickFilter.length : '—', icon: Wallet, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { key: 'draft', title: 'Borradores', value: resolvedSummaryRows ? summaryRowsWithoutQuickFilter.filter(g => (g.status || '').toUpperCase() === 'DRAFT').length : '—', icon: FileText, color: 'text-primary', bg: 'bg-primary/10', interactive: true },
    { key: 'pending', title: 'Pendientes', value: resolvedSummaryRows ? summaryRowsWithoutQuickFilter.filter(g => (g.status || '').toUpperCase() === 'PENDING').length : '—', icon: Clock, color: 'text-primary', bg: 'bg-primary/10', interactive: true },
    { key: 'category', title: 'Por Categoría', value: resolvedSummaryRows ? Array.from(new Set(summaryRowsWithoutQuickFilter.map(g => String(g.category || '').toUpperCase()).filter(Boolean))).length : '—', icon: Tag, color: 'text-purple-500', bg: 'bg-purple-500/10', interactive: true },
  ];

  const detailExpense = selectedExpenseDetail ? data.find((x) => x.id === selectedExpenseDetail.id) || selectedExpenseDetail : null;
  const buildExpensePanel = (expense: Expense): SalesDocumentPanelData => ({
    id: expense.id,
    number: String(expense.number || expense.id),
    title: 'Gasto',
    customerName: expense.supplier?.name || expense.paidTo || 'Sin proveedor',
    hideCustomer: true,
    status: String(expense.status || 'DRAFT').toUpperCase(),
    totalLabel: formatConvertedAmount(Number(expense.amount || 0), expense.currency, expense.exchangeRate),
    sourceCurrency: expense.currency,
    sourceExchangeRate: expense.exchangeRate,
    summaryDetails: [
      { label: 'Categoría', value: String(expense.category || '').toUpperCase() === 'OTRO' ? expense.categoryCustom || 'Otro' : expense.category || '—' },
      { label: 'Método', value: paymentSourceLabel(expense.paymentSource) },
    ],
    metadata: [
      { label: 'Fecha', value: expense.date ? `${formatDateEs(expense.date)}${expense.time ? ` · ${expense.time}` : ''}` : 'No disponible' },
      { label: 'Proveedor', value: expense.supplier?.name || expense.paidTo || 'No disponible' },
      { label: 'Referencia', value: expense.reference || 'No disponible' },
      { label: 'Moneda', value: String(expense.currency || baseCurrency).toUpperCase() },
    ],
    lines: [{ id: expense.id, description: expense.description || 'Gasto sin descripción', quantity: 1, totalLabel: formatConvertedAmount(Number(expense.amount || 0), expense.currency, expense.exchangeRate) }],
    notes: expense.notes,
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="space-y-2" data-tour="purchases-list-kpis" aria-busy={Boolean(summaryLoading)}>
        <KpiSummaryNotice loading={summaryLoading} error={summaryError} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {!resolvedSummaryRows ? <PurchaseKpiCard title="Total del Mes" value="—" icon={TrendingDown} color="text-rose-500" bg="bg-rose-500/10" /> : displayMode === 'ORIGINAL'
          ? originalMonthlyAmounts.map((summary) => <PurchaseKpiCard key={`month-${summary.currency}`} title={`Total del Mes (${summary.currency})`} value={formatExplicitAmount(summary.amount, summary.currency)} icon={TrendingDown} color="text-rose-500" bg="bg-rose-500/10" />)
          : <PurchaseKpiCard title={`Total del Mes (${displayCurrency}${valuationModeSuffix})`} value={formatCurrentAmount(monthlyTotalInDisplayCurrency, displayCurrency)} icon={TrendingDown} color="text-rose-500" bg="bg-rose-500/10" />}
        {kpis.map((k, i) => {
          const isActive =
            (k.key === 'pending' && activeKpiFilter.type === 'pending') ||
            (k.key === 'draft' && activeKpiFilter.type === 'draft') ||
            (k.key === 'category' && activeKpiFilter.type === 'category');
          return (
          <PurchaseKpiCard
            key={i}
            title={k.title}
            value={k.value}
            icon={k.icon}
            color={k.color}
            bg={k.bg}
            kind={k.interactive ? 'filter' : 'indicator'}
            active={isActive}
            onClick={k.interactive ? () => {
              if (!k.interactive) return;
              if (k.key === 'pending') {
                setActiveKpiFilter(prev => prev.type === 'pending' ? { type: 'none' } : { type: 'pending' });
                return;
              }
              if (k.key === 'draft') {
                setActiveKpiFilter(prev => prev.type === 'draft' ? { type: 'none' } : { type: 'draft' });
                return;
              }
              if (k.key === 'category') {
                const fallbackCategory = selectedCategory || uniqueCategories[0] || '';
                if (!fallbackCategory) return;
                setSelectedCategory(fallbackCategory);
                setActiveKpiFilter(prev =>
                  prev.type === 'category' ? { type: 'none' } : { type: 'category', category: fallbackCategory },
                );
              }
            } : undefined}
          />
        )})}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight" data-tour="purchases-list-title">Gastos</h2></div>
          <div className="erp-list-toolbar grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end sm:gap-3" data-tour="purchases-list-actions">
            <PurchaseViewTutorial view="expenses" />
            {canPerform('PURCHASES_EXPENSES', 'export') && <PdfDownloadButton label="Exportar" includePageSizes includeRoll={false} scopeSelector={{ pageCount: filteredData.length, totalCount: pagination?.total || filteredData.length }} onDownload={(format, scope) => void handleExportListPdf(format, scope)} onExcel={() => void handleExportExcel()} />}
            <ViewLayoutSelect value={layoutMode} onChange={(value) => setLayoutMode(value === 'kanban' ? 'table' : value)} ariaLabel="Elegir distribución de gastos" className="w-full sm:w-32" />
            {purchaseAlert && <PurchaseAlertsButton alert={purchaseAlert} onItemSelect={setHighlightedAlertId} />}
            <div className="col-span-1 min-w-0 w-full justify-self-stretch sm:col-span-1 sm:w-auto sm:justify-self-end">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={datePreset === 'range' ? 'default' : 'outline'} className="h-10 w-full min-w-0 rounded-xl text-[10px] font-black uppercase tracking-widest sm:w-auto">
                    <CalendarRange className="size-4" />
                    {datePreset === 'range' && appliedRange ? `${appliedRange.from} → ${appliedRange.to}` : 'Rango de fechas'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="end">
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Desde</p>
                        <DateField
                          value={rangeFrom}
                          onChange={setRangeFrom}
                          maxDate={rangeTo || undefined}
                          className="h-9 w-full text-xs sm:w-40"
                          placeholder="Fecha desde"
                          title="Fecha desde"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Hasta</p>
                        <DateField
                          value={rangeTo}
                          onChange={setRangeTo}
                          minDate={rangeFrom || undefined}
                          className="h-9 w-full text-xs sm:w-40"
                          placeholder="Fecha hasta"
                          title="Fecha hasta"
                        />
                      </div>
                    </div>
                    <Button
                      className="h-9 w-full rounded-xl text-[10px] font-black uppercase tracking-widest"
                      disabled={!rangeFrom || !rangeTo || rangeFrom > rangeTo}
                      onClick={() => {
                        setAppliedRange({ from: rangeFrom, to: rangeTo });
                        setDatePreset('range');
                      }}
                    >
                      Aplicar rango
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {canPerform('PURCHASES_EXPENSES', 'import') && (
              <Button
                variant="outline"
                onClick={() => { setExpenseImportPreviewOpen(false); setImportOpen(true); setImportResult(null); setImportFile(null); setParsedImportRows([]); setExpenseImportPreview(null); setExpenseImportPreviewStale(false); setExpenseImportAttemptId(null); }}
                className="h-10 min-w-0 w-full gap-2 rounded-xl px-3 text-[10px] font-black uppercase tracking-widest sm:w-auto"
              >
                <Upload className="size-4" /> Importar
              </Button>
            )}
            {datePreset !== 'all' && (
              <Button
                variant="outline"
                className="col-span-2 h-10 min-w-0 w-full rounded-xl text-[10px] font-black uppercase tracking-widest sm:col-span-1 sm:w-auto"
                onClick={() => {
                  setDatePreset('all');
                  setAppliedRange(null);
                  setRangeFrom('');
                  setRangeTo('');
                }}
              >
                Limpiar fechas
              </Button>
            )}
            {activeKpiFilter.type === 'category' && (
              <Select
                value={selectedCategory}
                onValueChange={(category) => {
                  setSelectedCategory(category);
                  setActiveKpiFilter({ type: 'category', category });
                }}
              >
                <SelectTrigger className="col-span-2 h-10 min-w-0 w-full rounded-xl text-xs font-bold uppercase sm:col-span-1 sm:w-auto"><SelectValue /></SelectTrigger>
                <SelectContent>{uniqueCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
              </Select>
            )}
            {activeKpiFilter.type !== 'none' && (
              <Button
                variant="outline"
                className="col-span-2 h-10 min-w-0 w-full rounded-xl text-[10px] font-black uppercase tracking-widest sm:col-span-1 sm:w-auto"
                onClick={() => setActiveKpiFilter({ type: 'none' })}
              >
                Limpiar filtro
              </Button>
            )}
            <div className="relative min-w-0"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="h-10 w-full min-w-0 rounded-xl border-border/50 bg-background/50 pl-9 text-xs sm:w-56" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }} /></div>
            {canPerform('PURCHASES_EXPENSES', 'create') && (
              <Button onClick={() => setEditingId('NEW')} className="col-span-1 h-10 min-w-0 w-full gap-2 rounded-xl bg-primary px-3 text-[10px] font-black uppercase tracking-widest text-primary-foreground hover:bg-primary/90 sm:col-span-1 sm:w-auto"><Plus className="size-4" /> Registrar Gasto</Button>
            )}
          </div>
        </div>
        <div className="min-w-0">
          <div className="min-w-0">
        <EditableDataTable data={filteredData} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} pagination={pagination} layoutMode={layoutMode === 'cards' ? 'cards' : 'responsive'} actionsWidth="w-48" highlightedRowId={highlightedAlertId} showSelection={canPerform('PURCHASES_EXPENSES', 'delete')} onRowClick={(row) => setSelectedExpenseDetail(row)}
          onBulkDelete={canPerform('PURCHASES_EXPENSES', 'delete') ? async (ids) => {
            const deleteToastId = toast.loading(`Eliminando ${ids.length} gasto${ids.length === 1 ? '' : 's'}...`);
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await expensesService.delete(id as string);
              }
              toast.success('Elementos eliminados', { id: deleteToastId });
              onRefresh();
            } catch (e: any) {
              toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar', { id: deleteToastId });
            }
          } : undefined}
          actions={(row) => (
            <div className="flex items-center gap-1">
              <Button title="Ver detalle completo" aria-label="Ver detalle completo del gasto" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={(event) => { event.stopPropagation(); setSelectedExpenseDetail(null); setEditingId(row.id); }}><Eye className="size-4" /></Button>
              {canPerform('PURCHASES_EXPENSES', 'edit') && ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED'].includes(String(row.status || '').toUpperCase()) && (
                <Button title="Editar gasto" aria-label="Editar gasto" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={(event) => { event.stopPropagation(); setEditingId(row.id); }}><Pencil className="size-4" /></Button>
              )}
              {canPerform('PURCHASES_EXPENSES', 'approve') && String(row.status || '').toUpperCase() === 'DRAFT' && (
                <Button type="button" title="Cambiar a pendiente" aria-label="Cambiar gasto a pendiente" variant="outline" size="sm" className="h-8 shrink-0 gap-1 rounded-lg px-2 text-[10px] text-amber-700" onClick={() => { void handleStatusAction(row, 'PENDING'); }}><Send className="size-3.5" /> Cambiar a pendiente</Button>
              )}
              {canPerform('PURCHASES_EXPENSES', 'approve') && String(row.status || '').toUpperCase() === 'PENDING' && (
                <Button type="button" title="Registrar pago" aria-label="Registrar pago del gasto" variant="outline" size="sm" className="h-8 shrink-0 gap-1 rounded-lg px-2 text-[10px] text-emerald-700" onClick={() => openPaymentDialog(row)}><CircleDollarSign className="size-3.5" /> Registrar pago</Button>
              )}
            </div>
          )}
        />
        </div>
        <SalesDocumentDetailSheet
          document={detailExpense ? buildExpensePanel(detailExpense) : null}
          entity="EXPENSE"
          open={Boolean(detailExpense)}
          onClose={() => setSelectedExpenseDetail(null)}
          extraActions={detailExpense && (() => {
            const status = String(detailExpense.status || '').toUpperCase();
            return <>
              {canPerform('PURCHASES_EXPENSES', 'edit') && ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED'].includes(status) && <Button type="button" variant="outline" className="gap-2 rounded-xl text-xs" onClick={() => { setSelectedExpenseDetail(null); setEditingId(detailExpense.id); }}><Pencil className="size-4" /> Editar</Button>}
              {canPerform('PURCHASES_EXPENSES', 'approve') && status === 'DRAFT' && <Button type="button" variant="outline" className="gap-2 rounded-xl text-xs text-amber-600" onClick={() => void handleStatusAction(detailExpense, 'PENDING')}><Send className="size-4" /> Enviar a pendientes</Button>}
              {canPerform('PURCHASES_EXPENSES', 'approve') && status === 'PENDING' && <Button type="button" variant="outline" className="gap-2 rounded-xl text-xs text-emerald-600" onClick={() => { setSelectedExpenseDetail(null); openPaymentDialog(detailExpense); }}><CircleDollarSign className="size-4" /> Registrar pago</Button>}
              {canPerform('PURCHASES_EXPENSES', 'delete') && status !== 'PAID' && <Button type="button" variant="outline" className="gap-2 rounded-xl text-xs text-rose-500" onClick={() => setPendingDeleteId(detailExpense.id)}><Ban className="size-4" /> Anular</Button>}
            </>;
          })()}
          onDownloadPdf={canPerform('PURCHASES_EXPENSES', 'export') ? (format) => detailExpense ? void handleDownloadExpensePdf(detailExpense, format) : undefined : undefined}
        />
        </div>
        <ConfirmDialog
          open={!!pendingDeleteId}
          onOpenChange={(open) => !open && setPendingDeleteId(null)}
          title="Anular Gasto"
          description="¿Estás seguro de que deseas anular este gasto? Esta acción no se puede deshacer y revierte su efecto contable."
          confirmLabel="Anular Gasto"
          onConfirm={handleDeleteConfirm}
          loading={deleteLoading}
        />

        <Dialog open={Boolean(paymentExpense)} onOpenChange={(open) => !open && !paymentLoading && setPaymentExpense(null)}>
          <DialogContent className="w-[calc(100%-2rem)] !max-w-xl rounded-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
                <CircleDollarSign className="size-5 text-primary" /> Registrar pago del gasto
              </DialogTitle>
              <DialogDescription>
                El gasto quedará pagado, contabilizado con las cuentas configuradas y visible en Finanzas con su detalle.
              </DialogDescription>
            </DialogHeader>
            {paymentExpense && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{paymentExpense.number}</p>
                  <p className="mt-1 text-sm font-bold text-foreground">{paymentExpense.description}</p>
                  <p className="mt-2 text-2xl font-black text-primary">{formatConvertedAmount(Number(paymentExpense.amount || 0), paymentExpense.currency, paymentExpense.exchangeRate)}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Método de pago</p>
                    <Select value={paymentMethod} onValueChange={(nextMethod) => { const method = nextMethod as typeof paymentMethod; setPaymentMethod(method); if (!requiresPaymentReference(method)) setPaymentReference(''); if (!isBankPaymentMethod(method)) setPaymentBankAccountId(''); }}>
                      <SelectTrigger className="h-10 text-xs font-bold uppercase"><SelectValue /></SelectTrigger>
                      <SelectContent>{paymentMethodOptions.map((method) => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {isBankPaymentMethod(paymentMethod) && (accountingConnectionEnabled || financeConnectionEnabled) && <BankAccountSelect currency={paymentExpense.currency} value={paymentBankAccountId} onChange={setPaymentBankAccountId} label={accountingConnectionEnabled ? "Cuenta bancaria que realiza el pago" : "Banco opcional para el movimiento financiero"} className="sm:col-span-2" />}
                  {hasPaymentReferenceField(paymentMethod) && <div>
                    <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Referencia *</p>
                    <Input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Recibo, transferencia..." required={requiresPaymentReference(paymentMethod)} className="h-10 text-xs" />
                  </div>}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentExpense(null)} disabled={paymentLoading}>Cancelar</Button>
              <Button onClick={() => void handlePayment()} disabled={paymentLoading || (requiresPaymentReference(paymentMethod) && !paymentReference.trim()) || (accountingConnectionEnabled && isBankPaymentMethod(paymentMethod) && !paymentBankAccountId)} className="bg-primary font-black uppercase tracking-widest">
                {paymentLoading ? 'Registrando...' : 'Confirmar pago'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={importOpen && !importing} onOpenChange={(open) => { if (!open) clearExpenseImportFile(); setImportOpen(open); }}>
          <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] !max-w-[min(92vw,680px)] overflow-y-auto rounded-3xl">
            <DialogHeader data-tour="purchases-expense-modal-title">
              <DialogTitle className="flex items-center gap-2"><Upload className="size-4" /> Importar gastos</DialogTitle>
              <DialogDescription>
                Sube un archivo Excel para registrar gastos masivamente. Usa la plantilla para mantener el formato correcto.
              </DialogDescription>
              <PurchaseViewTutorial view="expenses" context="form" labelOverride="Cómo importar gastos" stepKeys={['title', 'data', 'actions']} targetPrefix="purchases-expense-modal" />
            </DialogHeader>

            <div className="space-y-4" data-tour="purchases-expense-modal-data">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">Formato esperado</p>
                <p className="text-xs text-muted-foreground">
                  Una fila por gasto: <span className="font-mono">Fecha, Descripción, Categoría, Categoría personalizada, Monto, Moneda, Tasa de cambio, Estado, Método de pago, Pagado a, Referencia, Número de cuenta bancaria</span>.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  La fecha y el monto son obligatorios. OTRO requiere categoría personalizada; TARJETA, TRANSFERENCIA y CHEQUE requieren referencia cuando el estado es PAID.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  El servidor muestra los efectos de Finanzas y Contabilidad según la configuración actual de esta sucursal. Se confirma en bloques de hasta 50 gastos.
                </p>
                <Button variant="ghost" size="sm" className="mt-3 h-8 gap-2" onClick={() => { void downloadExpenseImportTemplate().then(() => toast.success('Plantilla descargada')).catch(() => toast.error('No se pudo generar la plantilla')); }}>
                  <FileDown className="size-4" /> Descargar plantilla Excel
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Archivo Excel</label>
                <Input ref={importFileInputRef} type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={(event) => { void handleExpenseFileChange(event.target.files?.[0]); event.target.value = ''; }} />
                {importFile && <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Archivo: <b>{importFile.name}</b> ({Math.round(importFile.size / 1024)} KB)</p><Button type="button" variant="ghost" size="sm" className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={clearExpenseImportFile} disabled={readingFile || importing}><X className="mr-1.5 size-3.5" />Quitar archivo</Button></div>}
                {parsedImportRows.length > 0 && <p className="text-xs font-semibold text-muted-foreground">{parsedImportRows.length} fila(s) detectadas. La revisión detallada se abrirá en una vista completa antes de confirmar.</p>}
              </div>
            </div>

            <DialogFooter data-tour="purchases-expense-modal-actions">
              <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>Cerrar</Button>
              {expenseImportPreview ? (
                <Button onClick={() => { setImportOpen(false); setExpenseImportPreviewOpen(true); }} disabled={importing || !importFile} className="gap-2">
                  <Eye className="size-4" /> Volver a revisar gastos
                </Button>
              ) : (
                <Button onClick={() => void handlePreviewExpenses()} disabled={importing || !importFile || parsedImportRows.length === 0} className="gap-2">
                  <Eye className="size-4" /> Previsualizar {parsedImportRows.length ? `${parsedImportRows.length} gastos` : 'gastos'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <ImportProgressOverlay
          open={importing && (!validatingExpenseImport || !expenseImportPreviewOpen)}
          progress={importProgress}
          title={validatingExpenseImport ? 'Validando gastos' : 'Importando gastos'}
          description={validatingExpenseImport ? 'Leyendo el archivo y calculando errores y efectos de cada fila en el servidor.' : 'Registrando los gastos listos en bloques de hasta 50.'}
        />
        <ImportProgressOverlay
          open={readingFile}
          progress={readingProgress}
          title="Preparando gastos"
          description="Leyendo el archivo y calculando la prevalidación antes de registrarlo."
        />
      </div>
    </div>
  );
}
