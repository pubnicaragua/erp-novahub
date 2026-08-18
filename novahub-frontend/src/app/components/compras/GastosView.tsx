import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  Wallet, Plus, Search, Eye, TrendingDown, Clock, Tag, ChevronLeft, CalendarRange, FileText, Download, Upload, FileDown, CheckCircle2, Ban, Lock, CircleDollarSign, Send, X, Pencil
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { expensesService } from '../../services/compras.service';
import type { Expense, Supplier } from '../../types';
import type { SalesPaginationControls } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { storageService } from '../../services/storage.service';
import { generateExpensePDF } from '../../utils/pdfGenerator';
import { PurchaseAuditButton } from './PurchaseAuditButton';
import { PurchaseKpiCard } from './PurchaseKpiCard';
import { PurchaseViewTutorial } from './PurchaseViewTutorial';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { formatDateEs } from '../../utils/dateFormat';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';
import { ImportProgressOverlay } from '../ui/ImportProgressOverlay';
import { ImportReviewSummary } from '../ui/ImportReviewSummary';
import { PurchaseAlertsButton, type PurchaseAlertDetail } from './PurchaseAlertsButton';
import { ExpenseAccountingNotice } from './ExpenseAccountingNotice';
import { requiresPaymentReference } from '../../utils/paymentMethods';

interface Props { data: Expense[]; loading: boolean; onRefresh: () => void; supplierCatalog?: Supplier[]; expenseCategoryCatalog?: any[]; pagination?: SalesPaginationControls; onSearchChange?: (value: string) => void; onDateChange?: (from?: string, to?: string) => void; purchaseAlert?: PurchaseAlertDetail; targetId?: string | null; onClearTargetId?: () => void; }
type KpiFilter = { type: 'none' } | { type: 'draft' } | { type: 'pending' } | { type: 'category'; category: string };
type DateFilterPreset = 'all' | 'month' | 'year' | 'range';
const paymentSourceOptions = ['EFECTIVO', 'BAC', 'LAFISE', 'ATLANTIDA', 'FICOHSA', 'BANPRO', 'BDF', 'AVANZ'] as const;
const PAYMENT_SOURCE_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  CASH: 'Efectivo',
  BAC: 'BAC',
  LAFISE: 'LaFise',
  ATLANTIDA: 'Atlántida',
  FICOHSA: 'Ficohsa',
  BANPRO: 'Banpro',
  BDF: 'BDF',
  AVANZ: 'Avanz',
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
const MAX_EVIDENCE_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_EVIDENCE_FILE_BYTES = 10 * 1024 * 1024;

const statusOpts = [
  { label: 'Borrador',  value: 'DRAFT',    color: 'bg-slate-500/10 text-slate-500' },
  { label: 'Pendiente', value: 'PENDING',  color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Pagado',    value: 'PAID',     color: 'bg-emerald-500/10 text-emerald-500' },
];

export function GastosView({ data, loading, onRefresh, supplierCatalog = [], expenseCategoryCatalog = [], pagination, onSearchChange, onDateChange, purchaseAlert, targetId, onClearTargetId }: Props) {
  const { canPerform } = useAuth();
  const { exchangeRate: globalRate, displayCurrency, valuationMode, valuationModeSuffix, formatConvertedAmount, formatCurrentAmount, convertAmount, convertCurrentAmount } = useCurrency();
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
  const [importFileStats, setImportFileStats] = useState<{ total: number; valid: number; skipped: number } | null>(null);
  const [importResult, setImportResult] = useState<{ total: number; created: number; skipped: number; errors: string[] } | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<Expense> | null>(null);
  const [highlightedAlertId, setHighlightedAlertId] = useState<string | null>(null);
  const [paymentExpense, setPaymentExpense] = useState<Expense | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethodOptions)[number]['value']>('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [selectedExpenseDetail, setSelectedExpenseDetail] = useState<Expense | null>(null);

  useEffect(() => {
    if (!highlightedAlertId) return;
    const timeout = window.setTimeout(() => setHighlightedAlertId(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [highlightedAlertId]);

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

  const uniqueCategories = Array.from(new Set(data.map(g => String(g.category || '').toUpperCase()).filter(Boolean)));

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
  const categoryOptions = Array.from(new Set(filtered.map((g) => String(g.category || '').toUpperCase()).filter(Boolean)))
    .map((value) => ({ value, label: value === 'OTRO' ? 'Otro' : value, count: filtered.filter((g) => String(g.category || '').toUpperCase() === value).length }));

  const downloadExpenseTemplate = () => {
    const headers = ['Fecha', 'Descripción', 'Categoría', 'Categoría personalizada', 'Monto', 'Moneda', 'Fuente de pago', 'Pagado a', 'Referencia', 'Estado'];
    const rows = [
      ['2026-01-15', 'Pago servicio internet', 'OPERATIVO', '', '1500', 'NIO', 'BAC', 'Proveedor Internet', 'FAC-001', 'PENDING'],
      ['2026-01-16', 'Mantenimiento de aires acondicionados', 'OTRO', 'Mantenimiento', '250', 'USD', 'EFECTIVO', 'Técnico XYZ', '', 'DRAFT'],
      ['2026-01-17', 'Publicidad en redes sociales', 'VENTAS', '', '800', 'NIO', 'LAFISE', 'Agencia ABC', 'TRANSF-088', 'PENDING'],
    ];
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    sheet['!cols'] = headers.map((header) => ({ wch: Math.max(14, Math.min(28, header.length + 4)) }));
    const guide = XLSX.utils.aoa_to_sheet([
      ['GUÍA DE LLENADO · IMPORTACIÓN DE GASTOS'],
      ['Descripción y monto son obligatorios; las demás columnas son opcionales. Puedes repetir la importación cuando quieras.'],
      ['Campo', 'Regla'],
      ['Fecha', 'Formato YYYY-MM-DD (ej. 2026-01-15). Si está vacía se usará la fecha de hoy.'],
      ['Descripción', 'Obligatoria. Concepto del gasto, ej. "Pago de internet".'],
      ['Categoría', 'Obligatoria. Valores: OPERATIVO, ADMINISTRATIVO, VENTAS, FINANCIERO, OTRO.'],
      ['Categoría personalizada', 'Obligatoria cuando Categoría = OTRO. Escribe un nombre libre, ej. "Mantenimiento".'],
      ['Monto', 'Obligatorio. Mayor que 0. Acepta punto o coma decimal (ej. 1500.50).'],
      ['Moneda', 'NIO o USD. Si está vacía se usa la moneda configurada en la empresa.'],
      ['Fuente de pago', 'EFECTIVO, BAC, LAFISE, ATLANTIDA, FICOHSA, BANPRO, BDF o AVANZ. Si está vacía se usa EFECTIVO.'],
      ['Pagado a', 'Opcional. Nombre de la persona o proveedor que recibe el pago.'],
      ['Referencia', 'Opcional. Nº de factura, recibo, transferencia o comprobante.'],
      ['Estado', 'DRAFT (borrador), PENDING (pendiente) o PAID (pagado). Si está vacío se crea como PENDING.'],
      ['Previsualización', 'Después de cargar el archivo verás cuántos gastos se importarán y cuáles se omitirán antes de confirmar.'],
    ]);
    guide['!cols'] = [{ wch: 32 }, { wch: 100 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Gastos');
    XLSX.utils.book_append_sheet(workbook, guide, 'Guía de llenado');
    XLSX.writeFile(workbook, 'plantilla_gastos.xlsx');
    toast.success('Plantilla descargada');
  };

  const normalizeImportHeader = (value: unknown) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_/-]+/g, '');
  const getImportCell = (row: Record<string, any>, aliases: string[]) => {
    const match = aliases.map(normalizeImportHeader).find((alias) => Object.prototype.hasOwnProperty.call(row, alias));
    return match ? row[match] : '';
  };

  const splitCsvLine = (line: string, delimiter: string) => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];
      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    values.push(current.trim());
    return values.map((v) => v.replace(/^"(.*)"$/, '$1').trim());
  };

  const parseExpensesFile = async (file: File) => {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('Solo se permiten archivos Excel (.xlsx, .xls) o CSV');

    if (/\.(xlsx|xls)$/i.test(file.name)) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
      const sheetName = workbook.SheetNames.find((name) => normalizeImportHeader(name) === 'gastos') || workbook.SheetNames[0];
      const rawSheet = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], { header: 1, defval: '' });
      const raw = rawSheet.filter((row) => row.some((cell) => String(cell ?? '').trim()));
      if (raw.length < 2) return [];
      const headers = (raw[0] || []).map(normalizeImportHeader);
      return raw.slice(1).map((values: any[]) => {
        const row: Record<string, string> = {};
        headers.forEach((header: string, index: number) => { if (header) row[header] = String(values[index] ?? '').trim(); });
        return row;
      });
    }

    const text = await file.text();
    const rawLines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const lines = rawLines[0]?.toLowerCase().startsWith('sep=') ? rawLines.slice(1) : rawLines;
    if (lines.length < 2) return [];
    const headerLine = lines[0];
    const delimiter = (
      (headerLine.match(/,/g)?.length || 0) >= (headerLine.match(/;/g)?.length || 0)
        ? ((headerLine.match(/,/g)?.length || 0) >= (headerLine.match(/\t/g)?.length || 0) ? ',' : '\t')
        : ((headerLine.match(/;/g)?.length || 0) >= (headerLine.match(/\t/g)?.length || 0) ? ';' : '\t')
    );
    const headers = splitCsvLine(headerLine, delimiter).map(normalizeImportHeader);
    return lines.slice(1).map((line) => {
      const cols = splitCsvLine(line, delimiter);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = cols[idx] ?? '';
      });
      return row;
    });
  };

  const normalizeExpenseCategory = (raw: string) => {
    const category = String(raw || '').trim().toUpperCase();
    if (!category) return 'OPERATIVO';
    if (['OPERACIONAL', 'OPERATIVO'].includes(category)) return 'OPERATIVO';
    if (['ADMINISTRATIVO', 'VENTAS', 'FINANCIERO', 'OTRO'].includes(category)) return category;
    return 'OTRO';
  };

  const normalizeExpenseStatus = (raw: string) => {
    const status = String(raw || '').trim().toUpperCase();
    if (['DRAFT', 'PENDING', 'PAID'].includes(status)) return status;
    return 'DRAFT';
  };

  const isValidExpenseImportRow = (row: Record<string, string>) => {
    const description = String(getImportCell(row, ['descripcion', 'description', 'concepto'])).trim();
    const amount = Number(String(getImportCell(row, ['monto', 'amount', 'importe', 'valor'])).replace(',', '.'));
    const category = normalizeExpenseCategory(String(getImportCell(row, ['categoria', 'category'])));
    const categoryCustom = category === 'OTRO' ? String(getImportCell(row, ['categoriacustom', 'categorycustom', 'categoriapersonalizada'])).trim() : '';
    return Boolean(description) && Number.isFinite(amount) && amount > 0 && (category !== 'OTRO' || Boolean(categoryCustom));
  };

  const handleExpenseFileChange = async (file: File | undefined) => {
    setImportFile(file || null);
    setImportFileStats(null);
    if (!file) return;
    try {
      const rows = await parseExpensesFile(file);
      const valid = rows.filter(isValidExpenseImportRow).length;
      setImportFileStats({ total: rows.length, valid, skipped: rows.length - valid });
    } catch {
      setImportFileStats(null);
    }
  };

  const handleImportExpenses = async () => {
    if (!importFile) {
      toast.error('Selecciona un archivo CSV');
      return;
    }
    setImporting(true);
    setImportProgress(8);
    setImportResult(null);
    try {
      const rows = await parseExpensesFile(importFile);
      setImportProgress(28);
      if (rows.length === 0) {
        toast.error('El archivo no contiene filas para importar');
        return;
      }
      setImportProgress(35);

      let created = 0;
      let skipped = 0;
      const errors: string[] = [];
      const updateRowProgress = (index: number) => setImportProgress(35 + Math.round(((index + 1) / rows.length) * 60));

      for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        const rowNumber = idx + 2;
        const description = String(getImportCell(row, ['descripcion', 'description', 'concepto'])).trim();
        const amount = Number(String(getImportCell(row, ['monto', 'amount', 'importe', 'valor'])).replace(',', '.'));
        const category = normalizeExpenseCategory(String(getImportCell(row, ['categoria', 'category'])));
        const categoryCustom = category === 'OTRO' ? String(getImportCell(row, ['categoriacustom', 'categorycustom', 'categoriapersonalizada'])).trim() : '';
        const status = normalizeExpenseStatus(String(getImportCell(row, ['estado', 'status']) || 'PENDING'));
        const currencyRaw = String(getImportCell(row, ['moneda', 'currency']) || displayCurrency || 'NIO').trim().toUpperCase();
        const currency = currencyRaw === 'USD' ? 'USD' : 'NIO';
        const paymentSourceRaw = String(getImportCell(row, ['cuentaorigen', 'paymentsource', 'fuentedepago', 'metododepago', 'paymentmethod']) || 'EFECTIVO').trim().toUpperCase();
        const paymentSource = paymentSourceOptions.includes(paymentSourceRaw as any) ? paymentSourceRaw : (paymentSourceRaw === 'CASH' ? 'EFECTIVO' : 'EFECTIVO');
        const paidTo = String(getImportCell(row, ['pagadoa', 'paidto'])).trim();
        const reference = String(getImportCell(row, ['referencia', 'reference'])).trim();
        const dateRaw = String(getImportCell(row, ['fecha', 'date'])).trim();
        const dateParsed = dateRaw ? new Date(dateRaw) : new Date();
        const date = Number.isNaN(dateParsed.getTime()) ? new Date().toISOString() : dateParsed.toISOString();

        if (!description) {
          skipped++;
          errors.push(`Fila ${rowNumber}: descripción es obligatoria`);
          updateRowProgress(idx);
          continue;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
          skipped++;
          errors.push(`Fila ${rowNumber}: monto inválido`);
          updateRowProgress(idx);
          continue;
        }
        if (category === 'OTRO' && !categoryCustom) {
          skipped++;
          errors.push(`Fila ${rowNumber}: categoría OTRO requiere categoryCustom`);
          updateRowProgress(idx);
          continue;
        }

        try {
          await expensesService.create({
            date,
            amount,
            currency: currency as any,
            exchangeRate: globalRate,
            category,
            categoryCustom: categoryCustom || undefined,
            description,
            paidTo: paidTo || undefined,
            paymentSource: paymentSource as any,
            reference: reference || undefined,
            status: status as any,
          } as any);
          created++;
        } catch (e: any) {
          skipped++;
          errors.push(`Fila ${rowNumber}: ${e?.response?.data?.message || e?.message || 'no se pudo crear'}`);
        }
        updateRowProgress(idx);
      }

      setImportProgress(100);
      setImportResult({ total: rows.length, created, skipped, errors: errors.slice(0, 12) });
      if (created > 0) onRefresh();
      toast.success(`Importación finalizada: ${created} creados, ${skipped} omitidos`);
    } catch (error: any) {
      toast.error(`No se pudo importar: ${error?.message || 'archivo inválido'}`);
    } finally {
      setImporting(false);
      window.setTimeout(() => setImportProgress(0), 180);
    }
  };

  const finishImport = () => {
    setImportOpen(false);
    setImportResult(null);
    setImportFile(null);
    setImportFileStats(null);
  };

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
    const statusToastId = toast.loading(status === 'DRAFT' ? 'Guardando gasto como borrador...' : 'Enviando gasto a pendientes...');
    try {
      await expensesService.update(row.id, { status } as any);
      toast.success(status === 'DRAFT' ? 'Gasto guardado como borrador' : 'Gasto guardado como pendiente', { id: statusToastId });
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo cambiar el estado del gasto', { id: statusToastId });
    }
  };

  const openPaymentDialog = (row: Expense) => {
    setPaymentExpense(row);
    setPaymentMethod('CASH');
    setPaymentReference('');
  };

  const handlePayment = async () => {
    if (!paymentExpense) return;
    if (requiresPaymentReference(paymentMethod) && !paymentReference.trim()) {
      toast.error('La referencia es obligatoria para transferencia, tarjeta o cheque');
      return;
    }
    const paymentToastId = toast.loading(`Marcando ${paymentExpense.number} como pagado...`);
    try {
      setPaymentLoading(true);
      await expensesService.update(paymentExpense.id, {
        status: 'PAID',
        paymentSource: paymentMethod,
        reference: paymentReference.trim() || undefined,
      } as any);
      toast.success('Gasto pagado y enviado a Finanzas', { id: paymentToastId });
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
        return toast.error('La imagen es muy pesada. Máximo 2MB');
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
            <Button
              variant="outline"
              className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4"
              onClick={() => generateExpensePDF({
                expense: localDoc,
                tenantName: 'Nova Hub',
                targetKey: 'compras.expense',
                formatAmount: (amount: number, currency?: string, rate?: number) =>
                  formatConvertedAmount(Number(amount || 0), currency || (localDoc.currency as any), rate || localDoc.exchangeRate),
              })}
            >
              <Download className="size-3 mr-2" /> Exportar PDF
            </Button>
          </div>
        </div>

        <ExpenseAccountingNotice />

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
                    <select
                      disabled={!canMutate}
                      value={localDoc.category || 'OPERATIVO'}
                      onChange={(e) => {
                        const cat = e.target.value;
                        const matched = expenseCategories.find(c => c.name.toUpperCase() === cat);
                        setLocalDoc({ ...localDoc, category: cat, expenseCategoryId: matched ? matched.id : '' });
                      }}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs uppercase"
                    >
                      <option value="OPERATIVO">Operativo</option>
                      <option value="ADMINISTRATIVO">Administrativo</option>
                      <option value="VENTAS">Ventas / Marketing</option>
                      <option value="FINANCIERO">Financiero</option>
                      <option value="OTRO">Otro</option>
                      {expenseCategories.length > 0 && <option disabled>── Catálogo ──</option>}
                      {expenseCategories.map(c => (
                        <option key={c.id} value={c.name.toUpperCase()}>{c.name}</option>
                      ))}
                    </select>
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
                    <p className="mt-1 text-[10px] text-muted-foreground">Imágenes max 2MB. Otros archivos max 10MB.</p>
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
                   <div className="w-1/2">
                      <p className="text-[10px] text-muted-foreground mb-1">Moneda</p>
                      <select
                        disabled={!canMutate}
                        value={localDoc.currency || 'NIO'}
                        onChange={(e) => setLocalDoc({ ...localDoc, currency: e.target.value as any, exchangeRate: globalRate })}
                        className="h-8 w-full max-w-[120px] rounded-md border border-input bg-background px-2 text-xs font-bold uppercase"
                      >
                        <option value="NIO">NIO</option>
                        <option value="USD">USD</option>
                      </select>
                   </div>
                   <div className="w-1/2 flex flex-col items-end">
                      <p className="text-[10px] text-muted-foreground mb-1">Monto Total</p>
                      <Input 
                        disabled={!canMutate}
                        type="number" 
                        min="0" 
                        value={localDoc.amount || ''} 
                        onChange={(e) => setLocalDoc({ ...localDoc, amount: Number(e.target.value) })} 
                        className="h-10 text-xl font-black text-rose-500 text-right w-full max-w-[150px]" 
                        placeholder="0.00" 
                      />
                   </div>
                </div>

                <div className="flex justify-between items-center text-base pt-2">
                  <span className="font-black uppercase text-xs tracking-widest">Equivalente Estimado</span>
                  <span className="font-black text-muted-foreground tabular-nums text-right">
                     {localDoc.currency === 'USD' ? `C$ ${(Number(localDoc.amount||0) * (localDoc.exchangeRate || globalRate)).toLocaleString()}` : `$ ${(Number(localDoc.amount||0) / (localDoc.exchangeRate || globalRate)).toLocaleString(undefined, {maximumFractionDigits:2})}`}
                  </span>
                </div>
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
  const monthlyTotalInDisplayCurrency = data
    .filter(g => new Date(g.date).getMonth() === new Date().getMonth())
    .reduce((acc, g) => acc + toDisplayAmount(Number(g.amount ?? g.baseAmount ?? 0), g.currency, g.exchangeRate), 0);

  const kpis = [
    { key: 'all', title: 'Gastos Operativos',  value: data.length,                                                                         icon: Wallet,       color: 'text-blue-500',   bg: 'bg-blue-500/10'    },    {
      key: 'month',
      title: `Total del Mes (${displayCurrency}${valuationModeSuffix})`,
      value: formatCurrentAmount(monthlyTotalInDisplayCurrency, displayCurrency),
      icon: TrendingDown,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
    },
    { key: 'draft', title: 'Borradores', value: data.filter(g => (g.status || '').toUpperCase() === 'DRAFT').length, icon: FileText, color: 'text-slate-500', bg: 'bg-slate-500/10', interactive: true },
    { key: 'pending', title: 'Pendientes', value: data.filter(g => (g.status || '').toUpperCase() === 'PENDING').length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', interactive: true },
    { key: 'category', title: 'Por Categoría', value: uniqueCategories.length, icon: Tag, color: 'text-purple-500', bg: 'bg-purple-500/10', interactive: true },
  ];

  const detailExpense = selectedExpenseDetail ? data.find((x) => x.id === selectedExpenseDetail.id) || selectedExpenseDetail : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5" data-tour="purchases-list-kpis">
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
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight" data-tour="purchases-list-title">Gastos</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Egresos operativos y administrativos</p></div>
          <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end sm:gap-3" data-tour="purchases-list-actions">
            <PurchaseViewTutorial view="expenses" className="w-full justify-center sm:w-auto" />
            <ViewLayoutSelect value={layoutMode} onChange={setLayoutMode} ariaLabel="Elegir distribución de gastos" className="w-full sm:w-32" />
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
                        <Input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="h-9 w-full text-xs sm:w-40" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Hasta</p>
                        <Input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="h-9 w-full text-xs sm:w-40" />
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
            {canPerform('PURCHASES_EXPENSES', 'create') && (
              <Button
                variant="outline"
                onClick={() => { setImportOpen(true); setImportResult(null); setImportFile(null); setImportFileStats(null); }}
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
              <select
                value={selectedCategory}
                onChange={(e) => {
                  const category = e.target.value;
                  setSelectedCategory(category);
                  setActiveKpiFilter({ type: 'category', category });
                }}
                className="col-span-2 h-10 min-w-0 w-full rounded-xl border border-input bg-background px-3 text-xs font-bold uppercase sm:col-span-1 sm:w-auto"
              >
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
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
        <div className={`grid min-w-0 grid-cols-1 gap-6 ${detailExpense ? 'lg:grid-cols-[13fr_7fr]' : 'lg:grid-cols-1'}`}>
          <div className="min-w-0">
        <EditableDataTable data={filteredData} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} pagination={pagination} layoutMode={layoutMode} highlightedRowId={highlightedAlertId} onRowClick={(row) => setSelectedExpenseDetail(row)}
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
            <div className="flex gap-1">
              {canPerform('PURCHASES_EXPENSES', 'edit') && String(row.status || '').toUpperCase() === 'DRAFT' && (
                <Button title="Enviar gasto a pendientes" aria-label="Enviar gasto a pendientes" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-amber-500/10 hover:text-amber-500" onClick={() => void handleStatusAction(row, 'PENDING')}><Send className="size-4" /></Button>
              )}
              {canPerform('PURCHASES_EXPENSES', 'approve') && String(row.status || '').toUpperCase() === 'PENDING' && (
                <Button title="Registrar pago del gasto" aria-label="Registrar pago del gasto" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500" onClick={() => openPaymentDialog(row)}><CircleDollarSign className="size-4" /></Button>
              )}
              {(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED'].includes(String(row.status || '').toUpperCase())) && (
                <Button title={canPerform('PURCHASES_EXPENSES', 'edit') ? "Editar" : "Ver"} variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
              )}
              {String(row.status || '').toUpperCase() === 'PAID' && (
                <Button title="Ver (gasto pagado y contabilizado, solo lectura)" aria-label="Ver gasto" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:bg-muted/40" onClick={() => setEditingId(row.id)}><Lock className="size-4" /></Button>
              )}
              <PurchaseAuditButton entity="EXPENSE" entityId={row.id} title="Auditoria del Gasto" />
              {canPerform('PURCHASES_EXPENSES', 'delete') && String(row.status || '').toUpperCase() !== 'PAID' && (
                <Button title="Anular gasto" aria-label="Anular gasto" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={() => setPendingDeleteId(row.id)}><Ban className="size-4" /></Button>
              )}
            </div>
          )}
        />
        </div>
        {detailExpense && (
          <ExpenseDetailPanel
            expense={detailExpense}
            supplierName={suppliers.find((s) => s.id === detailExpense.supplierId)?.name || detailExpense.supplier?.name}
            canEdit={canPerform('PURCHASES_EXPENSES', 'edit')}
            canApprove={canPerform('PURCHASES_EXPENSES', 'approve')}
            canDelete={canPerform('PURCHASES_EXPENSES', 'delete')}
            onClose={() => setSelectedExpenseDetail(null)}
            onEdit={() => setEditingId(detailExpense.id)}
            onMarkPending={() => void handleStatusAction(detailExpense, 'PENDING')}
            onPay={() => openPaymentDialog(detailExpense)}
            onDelete={() => setPendingDeleteId(detailExpense.id)}
          />
        )}
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
          <DialogContent className="w-[calc(100%-2rem)] max-w-xl rounded-3xl">
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
                    <select value={paymentMethod} onChange={(event) => { const nextMethod = event.target.value as typeof paymentMethod; setPaymentMethod(nextMethod); if (!requiresPaymentReference(nextMethod)) setPaymentReference(''); }} className="h-10 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase">
                      {paymentMethodOptions.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                    </select>
                  </div>
                  {requiresPaymentReference(paymentMethod) && <div>
                    <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Referencia *</p>
                    <Input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Recibo, transferencia..." className="h-10 text-xs" />
                  </div>}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentExpense(null)} disabled={paymentLoading}>Cancelar</Button>
              <Button onClick={() => void handlePayment()} disabled={paymentLoading || (requiresPaymentReference(paymentMethod) && !paymentReference.trim())} className="bg-primary font-black uppercase tracking-widest">
                {paymentLoading ? 'Registrando...' : 'Confirmar pago'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={importOpen && !importing} onOpenChange={setImportOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader data-tour="purchases-expense-modal-title">
              <DialogTitle className="flex items-center gap-2"><Upload className="size-4" /> Importar gastos</DialogTitle>
              <DialogDescription>
                Sube un archivo Excel o CSV para registrar gastos masivamente. Usa la plantilla para mantener el formato correcto.
              </DialogDescription>
              <PurchaseViewTutorial view="expenses" context="form" labelOverride="Cómo importar gastos" stepKeys={['title', 'data', 'actions']} targetPrefix="purchases-expense-modal" />
            </DialogHeader>

            <div className="space-y-4" data-tour="purchases-expense-modal-data">
              {!importResult && (
                <>
                  <div className="rounded-xl border border-border/60 p-4 bg-muted/20">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Formato esperado</p>
                    <p className="text-xs text-muted-foreground">
                      Columnas (Excel o CSV): <span className="font-mono">Fecha, Descripción, Categoría, Categoría personalizada, Monto, Moneda, Fuente de pago, Pagado a, Referencia, Estado</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Categoría: OPERATIVO/ADMINISTRATIVO/VENTAS/FINANCIERO/OTRO · Estado: DRAFT/PENDING/PAID · Moneda: NIO/USD · Fuente: EFECTIVO/BAC/LAFISE/ATLANTIDA/FICOHSA/BANPRO/BDF/AVANZ
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Si la categoría es OTRO, la columna "Categoría personalizada" es obligatoria. Acepta encabezados en español o inglés.
                    </p>
                    <Button variant="ghost" size="sm" className="mt-3 gap-2 h-8" onClick={downloadExpenseTemplate}>
                      <FileDown className="size-4" /> Descargar plantilla Excel
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground">Archivo Excel o CSV</label>
                    <Input type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={(e) => { void handleExpenseFileChange(e.target.files?.[0]); e.target.value = ''; }} />
                    {importFile && <p className="text-xs text-muted-foreground">Archivo: <b>{importFile.name}</b> ({Math.round(importFile.size / 1024)} KB)</p>}
                    {importFileStats && <p className="text-xs font-semibold text-muted-foreground">Prevalidación: <span className="text-emerald-600">{importFileStats.valid} válidos</span> · <span className={importFileStats.skipped ? 'text-rose-600' : 'text-muted-foreground'}>{importFileStats.skipped} se omitirán</span></p>}
                    {importFileStats && <ImportReviewSummary total={importFileStats.total} valid={importFileStats.valid} skipped={importFileStats.skipped} entityLabel="gastos" />}
                  </div>
                </>
              )}

              {importResult && (
                <div className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"><CheckCircle2 className="size-5" /></div>
                    <div>
                      <p className="text-sm font-black uppercase tracking-tight text-emerald-700">Importación finalizada</p>
                      <p className="text-xs text-muted-foreground">Los gastos creados ya aparecen en la tabla de Gastos.</p>
                    </div>
                  </div>
                  <ImportReviewSummary total={importResult.total} valid={importResult.created} skipped={importResult.skipped} entityLabel="gastos" />
                  {importResult.errors.length > 0 && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                      <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-amber-600">Se omitieron {importResult.errors.length} fila(s) con error</p>
                      <div className="max-h-32 space-y-1 overflow-y-auto text-xs text-amber-600">
                        {importResult.errors.map((err, i) => <p key={i}>- {err}</p>)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter data-tour="purchases-expense-modal-actions">
              {importResult ? (
                <Button onClick={finishImport} className="gap-2">
                  <CheckCircle2 className="size-4" /> Terminar
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setImportOpen(false)}>Cerrar</Button>
                  <Button onClick={handleImportExpenses} disabled={importing || !importFile} className="gap-2">
                    <Upload className="size-4" /> {importFileStats ? `Importar ${importFileStats.valid} válidos · omitir ${importFileStats.skipped}` : 'Importar gastos'}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <ImportProgressOverlay
          open={importing}
          progress={importProgress}
          title="Importando gastos"
          description="Leyendo el archivo, validando cada fila y registrando los gastos en la base de datos."
        />
      </div>
    </div>
  );
}

function DetailField({ label, value, mono = false, full = false }: { label: string; value?: React.ReactNode; mono?: boolean; full?: boolean }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">{label}</p>
      <p className={`mt-0.5 break-words text-xs font-semibold ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function ExpenseDetailPanel({
  expense,
  supplierName,
  canEdit,
  canApprove,
  canDelete,
  onClose,
  onEdit,
  onMarkPending,
  onPay,
  onDelete,
}: {
  expense: Expense;
  supplierName?: string;
  canEdit: boolean;
  canApprove: boolean;
  canDelete: boolean;
  onClose: () => void;
  onEdit: () => void;
  onMarkPending: () => void;
  onPay: () => void;
  onDelete: () => void;
}) {
  const { formatConvertedAmount } = useCurrency();
  const statusKey = String(expense.status || '').toUpperCase();
  const statusLabel = statusKey === 'PAID' ? 'Pagado' : statusKey === 'PENDING' || statusKey === 'APPROVED' ? 'Pendiente' : statusKey === 'REJECTED' ? 'Rechazado' : 'Borrador';
  const statusColor = statusKey === 'PAID' ? 'bg-emerald-500/10 text-emerald-600' : statusKey === 'PENDING' || statusKey === 'APPROVED' ? 'bg-amber-500/10 text-amber-600' : 'bg-slate-500/10 text-slate-500';

  return (
    <Card className="min-w-0 self-start rounded-2xl border-border/50 bg-card/70 p-5 shadow-sm animate-in slide-in-from-right duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{expense.number}</p>
          <h3 className="mt-1 text-lg font-black leading-tight">{expense.description}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Badge variant="outline" className={cn('border-none px-2 py-0.5 text-[9px] font-black uppercase tracking-widest', statusColor)}>{statusLabel}</Badge>
          <Button variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground" onClick={onClose} aria-label="Cerrar detalle"><X className="size-4" /></Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border/40 pt-4">
        <DetailField label="Fecha" value={`${formatDateEs(expense.date)}${expense.time ? ` · ${expense.time}` : ''}`} />
        <DetailField
          label="Categoría"
          value={String(expense.category || '').toUpperCase() === 'OTRO' ? (expense.categoryCustom || 'OTRO') : expense.category || '—'}
        />
        <DetailField label="Pagado a" value={expense.paidTo} />
        <DetailField label="Proveedor" value={supplierName} />
        <DetailField label="Fuente de pago" value={paymentSourceLabel(expense.paymentSource)} />
        <DetailField label="Referencia" value={expense.reference} mono />
        {expense.notes && <DetailField label="Notas" value={expense.notes} full />}
        {expense.evidenceFileName && (
          <div className="col-span-2 flex items-center gap-2 rounded-lg border border-border/40 bg-muted/10 px-3 py-2">
            <FileText className="size-3.5 shrink-0 text-primary" />
            {expense.evidenceFileUrl ? (
              <a href={expense.evidenceFileUrl} target="_blank" rel="noreferrer" className="min-w-0 truncate text-[11px] font-bold text-primary hover:underline">{expense.evidenceFileName}</a>
            ) : (
              <span className="min-w-0 truncate text-[11px] font-semibold">{expense.evidenceFileName}</span>
            )}
            {expense.evidenceFileSize ? <span className="shrink-0 text-[10px] text-muted-foreground/60">{Math.round(expense.evidenceFileSize / 1024)} KB</span> : null}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 p-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Monto</p>
          <p className="text-2xl font-black text-rose-500">{formatConvertedAmount(Number(expense.amount || 0), expense.currency, expense.exchangeRate)}</p>
          <p className="text-[10px] text-muted-foreground/70">
            {Number(expense.amount || 0).toLocaleString()} {expense.currency}
            {expense.exchangeRate ? ` · TC ${Number(expense.exchangeRate).toLocaleString()}` : ''}
          </p>
        </div>
        {statusKey === 'PAID' && (
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-600">
            <Lock className="size-3" /> Contabilizado
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border/40 pt-4">
        {canEdit && statusKey === 'DRAFT' && (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-amber-600" onClick={onMarkPending}>
            <Send className="size-3.5" /> Enviar a pendientes
          </Button>
        )}
        {canApprove && statusKey === 'PENDING' && (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-600" onClick={onPay}>
            <CircleDollarSign className="size-3.5" /> Registrar pago
          </Button>
        )}
        {canEdit && ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED'].includes(statusKey) && (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest" onClick={onEdit}>
            <Pencil className="size-3.5" /> Editar
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest"
          onClick={() => generateExpensePDF({
            expense,
            tenantName: 'Nova Hub',
            targetKey: 'compras.expense',
            formatAmount: (amount: number, currency?: string, rate?: number) => formatConvertedAmount(Number(amount || 0), currency || (expense.currency as any), rate || expense.exchangeRate),
          })}
        >
          <Download className="size-3.5" /> PDF
        </Button>
        <PurchaseAuditButton entity="EXPENSE" entityId={expense.id} title="Auditoría del Gasto" />
        {canDelete && statusKey !== 'PAID' && (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-500" onClick={onDelete}>
            <Ban className="size-3.5" /> Anular
          </Button>
        )}
      </div>
    </Card>
  );
}
