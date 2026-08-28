import { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { FileText, Send, Ban, Search, RotateCcw, X, ArrowDownLeft, ArrowUpRight, Upload, Download, CalendarRange, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { contabilidadService } from '../../services/contabilidad.service';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Combobox } from '../ui/Combobox';
import { cn } from '../ui/utils';
import type { JournalEntry } from '../../types';
import type { ChartAccount } from '../../types/accounting';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';
import { REFERENCE_TYPES, referenceTypeLabel } from '../../utils/accountingLabels';
import { DateField } from '../ui/DateField';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { ImportReviewSummary } from '../ui/ImportReviewSummary';
import { ImportProgressOverlay } from '../ui/ImportProgressOverlay';
import { ImportPreviewField, ImportPreviewMobileCard } from '../ui/ImportPreviewMobile';
import { parseSpreadsheetInWorker } from '../../utils/import-spreadsheet';
import { VirtualizedImportList } from '../ui/VirtualizedImportList';

const STATUS_COLORS: Record<string, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  DRAFT: 'secondary',
  posted: 'default',
  POSTED: 'default',
  voided: 'destructive',
  VOIDED: 'destructive',
};

function formatAccountingDate(value?: string | Date | null): string {
  if (!value) return '—';
  const raw = String(value);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString('es-NI');
  }
  return new Date(raw).toLocaleDateString('es-NI');
}

function formatReferenceId(value?: string | null): string {
  if (!value) return '—';
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function referenceDisplay(journal: JournalEntry): string {
  return journal.referenceNumber || formatReferenceId(journal.referenceId);
}

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const ASIENTOS_TEMPLATE_HEADERS = ['Código de cuenta', 'Descripción', 'Débito', 'Crédito', 'Referencia', 'Mes'];

const HEADER_TO_KEY: Record<string, string> = {
  'codigo de cuenta': 'codigo',
  'descripcion': 'descripcion',
  'debito': 'debito',
  'credito': 'credito',
  'referencia': 'referencia',
  'mes': 'mes',
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function parseAmount(value: any): number | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  const normalized = s.includes(',') && s.includes('.') ? s.replace(/,/g, '') : s.replace(/,/g, '.');
  const n = Number(normalized);
  return isFinite(n) ? n : null;
}

function monthCutoff(year: number, month: number) {
  const d = new Date(year, month, 0);
  return {
    iso: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    label: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`,
  };
}

interface PreviewRow {
  rowIndex: number;
  codigo: string;
  descripcion: string;
  debito: number | null;
  credito: number | null;
  referencia: string;
  mes: string;
  cutoffISO: string;
  cutoffLabel: string;
  errors: string[];
  valid: boolean;
}

export function DiarioView() {
  const { canPerform } = useAuth();
  const { baseCurrency, formatAmount } = useCurrency();
  const [filterStatus, setFilterStatus] = useState('POSTED');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterAccountId, setFilterAccountId] = useState('');
  const [filterRefType, setFilterRefType] = useState('');
  const [filterRefId, setFilterRefId] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [journalPage, setJournalPage] = useState(1);
  const journalPageSize = 10000;

  const [viewJournalId, setViewJournalId] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [importOpen, setImportOpen] = useState(false);
  const [scopeMode, setScopeMode] = useState<'full' | 'elapsed' | 'custom'>('full');
  const [elapsedMonths, setElapsedMonths] = useState(String(currentMonth));
  const [customFromMonth, setCustomFromMonth] = useState('1');
  const [customFromYear, setCustomFromYear] = useState(String(currentYear));
  const [customToMonth, setCustomToMonth] = useState(String(currentMonth));
  const [customToYear, setCustomToYear] = useState(String(currentYear));
  const [importFileName, setImportFileName] = useState('');
  const [rawImportRows, setRawImportRows] = useState<Record<string, string>[]>([]);
  const [importing, setImporting] = useState(false);
  const [operationProgress, setOperationProgress] = useState(0);
  const [readingFile, setReadingFile] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filterSearch.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [filterSearch]);

  const journalParams = useMemo(() => ({
    ...(filterStatus ? { status: filterStatus } : {}),
    ...(filterDateFrom ? { dateFrom: filterDateFrom } : {}),
    ...(filterDateTo ? { dateTo: filterDateTo } : {}),
    ...(filterAccountId ? { accountId: filterAccountId } : {}),
    ...(filterRefType ? { referenceType: filterRefType } : {}),
    ...(filterRefId ? { referenceId: filterRefId } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    page: journalPage,
    pageSize: journalPageSize,
  }), [filterStatus, filterDateFrom, filterDateTo, filterAccountId, filterRefType, filterRefId, debouncedSearch, journalPage]);
  const journalsQuery = useAccountingQuery<any>(['journals', journalParams], async (signal) => await contabilidadService.getJournals(journalParams, signal));
  const accountsQuery = useAccountingQuery<ChartAccount[]>(['accounts'], async (signal) => accountingList(await contabilidadService.getChartOfAccounts(false, signal)) as ChartAccount[]);
  const journalDetailQuery = useAccountingQuery<JournalEntry | null>(
    ['journal-detail', viewJournalId],
    async (signal) => viewJournalId ? await contabilidadService.getJournal(viewJournalId, signal) as JournalEntry : null,
    { enabled: Boolean(viewJournalId), staleTime: 5 * 60_000 },
  );
  const journals = accountingList(journalsQuery.data) as JournalEntry[];
  const viewJournal = journalDetailQuery.data || null;
  const formatCurrency = (value: number) => formatAmount(Number(value || 0), baseCurrency);
  const journalGridCols = viewJournal
    ? '48px 1fr 1.15fr 0.85fr 1.35fr 1.35fr 1fr 1.35fr 84px'
    : '48px 1fr 2.2fr 0.85fr 1fr 1fr 1fr 1.35fr 84px';
  const loading = journalsQuery.isLoading || journalsQuery.isFetching;
  const accounts = useMemo(() => {
    const flatten = (items: ChartAccount[]): ChartAccount[] => items.flatMap(account => [account, ...flatten(account.children ?? [])]);
    return flatten(accountsQuery.data || []);
  }, [accountsQuery.data]);
  const loadJournals = () => journalsQuery.refetch();

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear - 5; y <= currentYear + 1; y += 1) years.push(y);
    return years;
  }, [currentYear]);

  const scopeMonths = useMemo(() => {
    if (scopeMode === 'full') {
      return Array.from({ length: 12 }, (_, i) => ({ year: currentYear, month: i + 1 }));
    }
    if (scopeMode === 'elapsed') {
      const count = Math.min(12, Math.max(1, Number(elapsedMonths) || 1));
      return Array.from({ length: count }, (_, i) => ({ year: currentYear, month: i + 1 }));
    }
    const from = { year: Number(customFromYear) || currentYear, month: Math.min(12, Math.max(1, Number(customFromMonth) || 1)) };
    const to = { year: Number(customToYear) || currentYear, month: Math.min(12, Math.max(1, Number(customToMonth) || 1)) };
    const result: { year: number; month: number }[] = [];
    const cursor = { ...from };
    let guard = 0;
    while ((cursor.year < to.year || (cursor.year === to.year && cursor.month <= to.month)) && guard < 120) {
      result.push({ ...cursor });
      if (cursor.month === 12) { cursor.month = 1; cursor.year += 1; } else { cursor.month += 1; }
      guard += 1;
    }
    return result;
  }, [scopeMode, elapsedMonths, customFromMonth, customFromYear, customToMonth, customToYear]);

  const scopeMonthKeys = useMemo(() => new Set(scopeMonths.map((m) => `${m.year}-${pad2(m.month)}`)), [scopeMonths]);

  const accountCodes = useMemo(() => new Set(accounts.map((a) => a.code)), [accounts]);

  const importRows = useMemo<PreviewRow[]>(
    () => rawImportRows.map((row, idx) => validateAsientoRow(row, idx, accountCodes, scopeMonthKeys)),
    [rawImportRows, accountCodes, scopeMonthKeys],
  );
  const validImportCount = importRows.filter((r) => r.valid).length;
  const invalidImportCount = importRows.length - validImportCount;

  function validateAsientoRow(row: Record<string, string>, rowIndex: number, codes: Set<string>, months: Set<string>): PreviewRow {
    const errors: string[] = [];
    const codigo = (row.codigo || '').trim();
    const descripcion = (row.descripcion || '').trim();
    const referencia = (row.referencia || '').trim();
    const mes = (row.mes || '').trim();
    const debito = parseAmount(row.debito);
    const credito = parseAmount(row.credito);

    if (!codigo) errors.push('Falta el código de cuenta');
    else if (!codes.has(codigo)) errors.push(`Cuenta no existe: ${codigo}`);

    let cutoffISO = '';
    let cutoffLabel = '';
    const mesMatch = mes.match(/^(\d{4})-(\d{1,2})$/);
    if (!mesMatch) {
      errors.push(`Mes inválido (formato AAAA-MM): ${mes || '(vacío)'}`);
    } else {
      const monthKey = `${mesMatch[1]}-${pad2(Number(mesMatch[2]))}`;
      if (!months.has(monthKey)) {
        errors.push(`Mes fuera del alcance: ${mes}`);
      } else {
        const cutoff = monthCutoff(Number(mesMatch[1]), Number(mesMatch[2]));
        cutoffISO = cutoff.iso;
        cutoffLabel = cutoff.label;
      }
    }

    if (debito === null && credito === null) {
      errors.push('Indica Débito o Crédito');
    } else {
      if (debito !== null && debito <= 0) errors.push('El Débito debe ser mayor a 0');
      if (credito !== null && credito <= 0) errors.push('El Crédito debe ser mayor a 0');
      if (debito !== null && debito > 0 && credito !== null && credito > 0) errors.push('Indica solo una columna: Débito o Crédito');
    }

    return {
      rowIndex,
      codigo,
      descripcion,
      debito,
      credito,
      referencia,
      mes,
      cutoffISO,
      cutoffLabel,
      errors,
      valid: errors.length === 0,
    };
  }

  function downloadAsientosTemplate() {
    const firstMonth = scopeMonths[0];
    if (!firstMonth) { toast.error('Define un alcance válido antes de descargar la plantilla'); return; }
    const mes = `${firstMonth.year}-${pad2(firstMonth.month)}`;
    const worksheet = XLSX.utils.aoa_to_sheet([
      ASIENTOS_TEMPLATE_HEADERS,
      ['1101-001', 'Aporte inicial de capital', '100000.00', '', '', mes],
      ['2103-005', 'Compra de mercadería a crédito', '', '25000.00', 'FAC-0001', mes],
      ['4101-001', 'Venta de servicios de contado', '', '12500.00', 'FAC-0002', mes],
    ]);
    worksheet['!cols'] = [{ wch: 18 }, { wch: 42 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 10 }];
    const guide = XLSX.utils.aoa_to_sheet([
      ['GUÍA DE LLENADO · IMPORTAR ASIENTOS CONTABLES'],
      ['1. No modifiques la fila de encabezados.'],
      ['2. Código de cuenta: debe existir en el plan de cuentas (ej. 1101-001).'],
      ['3. Mes: formato AAAA-MM del corte contable (ej. 2026-01). La fecha del asiento será el último día de ese mes.'],
      ['4. Débito o Crédito: número con puntos para decimales (ej. 1250.75), una sola columna por fila.'],
      ['5. Referencia: opcional, documento o comprobante asociado al movimiento.'],
      ['6. Las fechas de corte son mensuales: el último día de cada mes dentro del alcance.'],
    ]);
    guide['!cols'] = [{ wch: 100 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Asientos');
    XLSX.utils.book_append_sheet(workbook, guide, 'Guía');
    XLSX.writeFile(workbook, 'plantilla_asientos_contables.xlsx');
  }

  async function handleAsientosFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      toast.error('El archivo debe ser Excel (.xlsx o .xls)');
      return;
    }
    setReadingFile(true);
    setReadingProgress(3);
    try {
      const { rows: raw } = await parseSpreadsheetInWorker(file, undefined, false, (progress) => {
        setReadingProgress(Math.min(84, Math.max(3, progress)));
      });
      setReadingProgress(88);
      const nonEmpty = raw.filter((row: any) => Array.isArray(row) && row.some((cell: any) => String(cell ?? '').trim().length > 0));
      if (nonEmpty.length < 2) { toast.error('El archivo no contiene datos'); return; }
      const headerRow = (nonEmpty[0] as any[]).map((h) => String(h ?? '').trim());
      const dataRows = nonEmpty.slice(1);
      const mapped = dataRows.map((cols: any[]) => {
        const row: Record<string, string> = {};
        headerRow.forEach((header, index) => {
          const key = HEADER_TO_KEY[normalizeHeader(header)];
          if (key) row[key] = String(cols[index] ?? '').trim();
        });
        return row;
      });
      setImportFileName(file.name);
      setRawImportRows(mapped);
      setReadingProgress(100);
      toast.success(`${mapped.length} filas leídas del archivo`);
    } catch (err) {
      toast.error('Error al leer el archivo Excel');
    } finally {
      setReadingFile(false);
      setReadingProgress(0);
    }
  }

  async function handleImportAsientos() {
    if (validImportCount === 0) { toast.error('No hay filas válidas para importar'); return; }
    setImporting(true);
    setOperationProgress(10);
    try {
      const rows = importRows.filter((r) => r.valid).map((r) => [
        r.codigo,
        r.cutoffISO,
        r.descripcion,
        r.debito ?? 0,
        r.credito ?? 0,
        r.referencia || 'IMPORT-XLSX',
      ]);
      setOperationProgress(35);
      const res = await contabilidadService.importCsv({ type: 'transactions', rows });
      setOperationProgress(90);
      toast.success(`Importación completada: ${res?.imported ?? validImportCount} asientos`);
      loadJournals();
      setImportOpen(false);
      setRawImportRows([]);
      setImportFileName('');
      setOperationProgress(100);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Error al importar asientos');
    } finally {
      setImporting(false);
      setOperationProgress(0);
    }
  }

  function handleImportOpenChange(open: boolean) {
    setImportOpen(open);
    if (!open) {
      setRawImportRows([]);
      setImportFileName('');
    }
  }

  const accountOptions = accounts
    .filter((account) => account.isActive && account.allowManualEntry !== false && account.acceptsPostings !== false)
    .map((a) => ({
    label: `${a.code} - ${a.name}`,
    value: a.id,
    description: a.type,
    }));

  const refTypeOptions = REFERENCE_TYPES.map((r) => ({ label: r.label, value: r.value }));

  async function handlePost(journal: JournalEntry) {
    try {
      await contabilidadService.postJournal(journal.id);
      toast.success(`Asiento #${journal.number} contabilizado`);
      loadJournals();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al contabilizar');
    }
  }

  async function handleVoid(journal: JournalEntry) {
    try {
      await contabilidadService.voidJournal(journal.id);
      toast.success(`Asiento #${journal.number} anulado`);
      loadJournals();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al anular');
    }
  }

  function handleView(journal: JournalEntry) {
    setViewJournalId(journal.id);
  }

  function journalStatusLabel(status?: string) {
    const statusKey = status?.toLowerCase();
    return statusKey === 'draft' ? 'Borrador'
      : statusKey === 'posted' ? 'Contabilizado'
        : statusKey === 'voided' ? 'Anulado'
          : status || 'Sin estado';
  }

  function renderJournalActions(journal: JournalEntry) {
    const statusKey = journal.status?.toLowerCase();
    return (
      <div className="flex items-center justify-end gap-1">
        {statusKey === 'draft' && canPerform('ACCOUNTING_JOURNAL', 'approve') && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600"
            onClick={(e) => { e.stopPropagation(); handlePost(journal); }}
            title="Contabilizar"
          >
            <Send className="size-3.5" />
          </Button>
        )}
        {statusKey === 'posted' && canPerform('ACCOUNTING_JOURNAL', 'delete') && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
            onClick={(e) => { e.stopPropagation(); handleVoid(journal); }}
            title="Anular"
          >
            <Ban className="size-3.5" />
          </Button>
        )}
      </div>
    );
  }

  useEffect(() => {
    if (journalDetailQuery.error) toast.error(journalDetailQuery.error.message || 'Error al cargar detalle');
  }, [journalDetailQuery.error]);

  useEffect(() => {
    setJournalPage(1);
  }, [filterStatus, filterDateFrom, filterDateTo, filterAccountId, filterRefType, filterRefId, debouncedSearch]);

  return (
    <div className="min-w-0 space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase italic">
            Libro <span className="text-primary">Diario</span>
          </h2>
        </div>
        <Button
          onClick={() => setImportOpen(true)}
          className="gap-1.5 self-start lg:self-auto"
        >
          <Upload className="size-4" />
          Importar asientos
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Search className="size-4 text-muted-foreground" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="min-w-0 space-y-1 sm:min-w-[240px]">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Buscar
              </Label>
              <Input
                placeholder="Descripción, # asiento, referencia..."
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="min-w-0 space-y-1 sm:min-w-[160px]">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Estado
              </Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="DRAFT">Borrador</SelectItem>
                  <SelectItem value="POSTED">Contabilizado</SelectItem>
                  <SelectItem value="VOIDED">Anulado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-0 space-y-1 sm:min-w-[160px]">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Desde
              </Label>
              <DateField value={filterDateFrom} onChange={setFilterDateFrom} placeholder="Desde" />
            </div>
            <div className="min-w-0 space-y-1 sm:min-w-[160px]">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Hasta
              </Label>
              <DateField value={filterDateTo} onChange={setFilterDateTo} placeholder="Hasta" />
            </div>
            <div className="min-w-0 space-y-1 sm:min-w-[220px]">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Cuenta Contable
              </Label>
              <Combobox
                options={accountOptions}
                value={filterAccountId}
                onChange={setFilterAccountId}
                placeholder="Todas las cuentas"
                emptyMessage="Sin resultados"
              />
            </div>
            <div className="min-w-0 space-y-1 sm:min-w-[200px]">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                Tipo Referencia
              </Label>
              <Combobox
                options={refTypeOptions}
                value={filterRefType}
                onChange={setFilterRefType}
                placeholder="Todos"
                emptyMessage="Sin resultados"
              />
            </div>
            <div className="min-w-0 space-y-1 sm:min-w-[180px]">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                ID Referencia
              </Label>
              <Input
                placeholder="ID del documento..."
                value={filterRefId}
                onChange={(e) => setFilterRefId(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1"
              onClick={() => {
                setFilterStatus('');
                setFilterDateFrom('');
                setFilterDateTo('');
                setFilterAccountId('');
                setFilterRefType('');
                setFilterRefId('');
                setFilterSearch('');
              }}
            >
              <RotateCcw className="size-3.5" />
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className={cn('grid min-w-0 grid-cols-1 gap-6', viewJournal ? 'lg:grid-cols-[13fr_7fr]' : 'lg:grid-cols-1')}>
      <div className="min-w-0">

      {/* Journal List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : journals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <FileText className="size-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">No hay asientos contables</p>
              <p className="text-xs mt-1">Los asientos se generan automáticamente desde los módulos operativos</p>
            </div>
          ) : (
            <>
              <div className="hidden max-h-[600px] overflow-y-auto sm:block">
                <div className="min-w-0 divide-y divide-border/60">
                <div className="hidden min-w-0 items-center gap-0 bg-muted/30 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 sm:grid" style={{ gridTemplateColumns: journalGridCols }}>
                  <span className="px-1">#</span>
                  <span className="px-1">Fecha</span>
                  <span className="min-w-0 truncate px-1">Descripción</span>
                  <span className="px-1">Estado</span>
                  <span className="px-1 text-center">Debe</span>
                  <span className="px-1 text-center">Haber</span>
                  <span className="min-w-0 truncate px-1">Ref. Tipo</span>
                  <span className="min-w-0 truncate px-1">Referencia</span>
                  <span className="px-1 text-right">Acciones</span>
                </div>
                {journals.map((j) => {
                  const totalDeb = j.lines?.reduce((s, l) => s + Number(l.debit), 0) || 0;
                  const totalCred = j.lines?.reduce((s, l) => s + Number(l.credit), 0) || 0;
                  const statusKey = j.status?.toLowerCase();
                  return (
                    <div key={j.id} className="grid min-w-0 cursor-pointer items-center gap-0 px-3 py-2 transition-colors hover:bg-muted/40" style={{ gridTemplateColumns: journalGridCols }} onClick={() => handleView(j)}>
                      <span className="truncate px-1 font-mono text-xs font-bold">{j.number}</span>
                      <span className="truncate px-1 text-xs">{formatAccountingDate(j.date)}</span>
                      <span className="min-w-0 truncate px-1 text-xs" title={j.description}>{j.description}</span>
                      <span className="px-1">
                        <Badge variant={STATUS_COLORS[statusKey] || 'outline'} className="text-[10px] font-black uppercase tracking-wider">
                          {journalStatusLabel(j.status)}
                        </Badge>
                      </span>
                      <span className="truncate px-1 text-right text-xs tabular-nums">{formatCurrency(totalDeb)}</span>
                      <span className="truncate px-1 text-right text-xs tabular-nums">{formatCurrency(totalCred)}</span>
                      <span className="min-w-0 truncate px-1 text-xs text-muted-foreground" title={referenceTypeLabel((j as any).referenceType)}>{referenceTypeLabel((j as any).referenceType) || '-'}</span>
                      <span className="min-w-0 truncate px-1 font-mono text-xs" title={j.referenceNumber || j.referenceId || ''}>{referenceDisplay(j)}</span>
                      <span className="flex justify-end px-1">{renderJournalActions(j)}</span>
                    </div>
                  );
                })}
                </div>
              </div>
              <div className="max-h-[600px] space-y-3 overflow-y-auto p-3 sm:hidden">
                {journals.map((j) => {
                  const totalDeb = j.lines?.reduce((s, l) => s + Number(l.debit), 0) || 0;
                  const totalCred = j.lines?.reduce((s, l) => s + Number(l.credit), 0) || 0;
                  const statusKey = j.status?.toLowerCase();
                  const referenceType = (j as any).referenceType;
                  return (
                    <div key={j.id} className="cursor-pointer rounded-xl border border-border/70 bg-card/60 p-3 shadow-sm transition-colors hover:border-primary/40" onClick={() => handleView(j)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="shrink-0 font-mono text-xs font-black text-primary">#{j.number}</span>
                            <Badge
                              variant={STATUS_COLORS[statusKey] || 'outline'}
                              className="shrink-0 px-1.5 py-0 text-[9px] font-black uppercase tracking-wider"
                            >
                              {journalStatusLabel(j.status)}
                            </Badge>
                          </div>
                          <p className="mt-1.5 truncate text-sm font-bold" title={j.description}>{j.description}</p>
                          <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                            {formatAccountingDate(j.date)}
                          </p>
                        </div>
                        {renderJournalActions(j)}
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/50 pt-3">
                        <div className="min-w-0 rounded-lg bg-muted/30 px-2.5 py-2">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Débitos</p>
                          <p className="mt-0.5 truncate text-sm font-black tabular-nums">{formatCurrency(totalDeb)}</p>
                        </div>
                        <div className="min-w-0 rounded-lg bg-muted/30 px-2.5 py-2">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Créditos</p>
                          <p className="mt-0.5 truncate text-sm font-black tabular-nums">{formatCurrency(totalCred)}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex min-w-0 flex-wrap gap-x-3 gap-y-1 border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
                        {referenceType && <span className="truncate"><strong className="text-foreground/80">Ref.:</strong> {referenceTypeLabel(referenceType)}</span>}
                        {j.referenceId && <span className="truncate font-mono"><strong className="font-sans text-foreground/80">Referencia:</strong> {referenceDisplay(j)}</span>}
                        {!referenceType && !j.referenceId && <span>Sin referencia asociada</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      </div>

      {/* Detail Panel */}
      {viewJournal && (
        <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <Card className="overflow-hidden">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">Detalle del Asiento</CardTitle>
                </div>
                {viewJournal && (
                  <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => setViewJournalId(null)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="space-y-5 p-4 sm:p-5">
              {journalDetailQuery.isLoading ? (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-border/60 py-16">
                  <div className="size-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Asiento contable · #{viewJournal.number}</p>
                        <h3 className="mt-1 truncate text-lg font-black tracking-tight" title={viewJournal.description}>{viewJournal.description}</h3>
                      </div>
                      <Badge variant={STATUS_COLORS[viewJournal.status?.toLowerCase()] || 'outline'} className="shrink-0">
                        {journalStatusLabel(viewJournal.status)}
                      </Badge>
                    </div>
                    <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Importe total</p>
                        <p className="mt-1 text-2xl font-black tabular-nums tracking-tight">
                          {formatCurrency(viewJournal.lines?.reduce((s, l) => s + Number(l.debit), 0) || 0)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4 2xl:grid-cols-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fecha</p>
                      <p className="text-sm font-semibold">{formatAccountingDate(viewJournal.date)}</p>
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estado</p>
                      <Badge variant={STATUS_COLORS[viewJournal.status?.toLowerCase()] || 'outline'} className="shrink-0">
                        {journalStatusLabel(viewJournal.status)}
                      </Badge>
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ref. Tipo</p>
                      <p className="truncate text-sm font-semibold">{referenceTypeLabel((viewJournal as any).referenceType)}</p>
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Referencia</p>
                      <p className="truncate font-mono text-xs font-bold" title={viewJournal.referenceNumber || viewJournal.referenceId || ''}>{referenceDisplay(viewJournal)}</p>
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Asientos</p>
                      <p className="text-sm font-semibold tabular-nums">{viewJournal.lines?.length ?? 0}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Descripción</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{viewJournal.description}</p>
                  </div>

                  <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Origen por sucursal</p>
                    <p className="mt-1 text-sm font-semibold">
                      {(viewJournal as any).branchLinks?.length
                        ? (viewJournal as any).branchLinks.map((link: any) => link.branch?.name).filter(Boolean).join(' · ')
                        : 'General / sin sucursal vinculada'}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">Es el mismo asiento contable; esta vinculación solo permite consultar y filtrar su origen.</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {viewJournal.status?.toLowerCase() === 'draft' && canPerform('ACCOUNTING_JOURNAL', 'approve') && (
                      <Button className="flex-1" size="sm" onClick={() => { void handlePost(viewJournal); }}>
                        <Send className="mr-1 size-3.5" /> Contabilizar
                      </Button>
                    )}
                    {viewJournal.status?.toLowerCase() === 'posted' && canPerform('ACCOUNTING_JOURNAL', 'delete') && (
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => { void handleVoid(viewJournal); }}>
                        <Ban className="mr-1 size-3.5" /> Anular
                      </Button>
                    )}
                  </div>

                  <Separator />

                  <section className="min-w-0">
                    <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <ArrowDownLeft className="size-4 text-primary" />
                          <h3 className="truncate text-sm font-black uppercase tracking-tight">Asientos del Diario</h3>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">Movimientos de débito y crédito del asiento.</p>
                      </div>
                    </div>

                    {!viewJournal.lines || viewJournal.lines.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/60 px-4 py-8 text-center">
                        <p className="text-sm font-semibold">Sin asientos</p>
                        <p className="mt-1 text-xs text-muted-foreground">Este asiento no tiene movimientos.</p>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-border/60">
                        <div className="grid grid-cols-[minmax(0,1fr)_minmax(92px,auto)_minmax(92px,auto)] items-center gap-3 border-b border-border/60 bg-muted/30 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                          <span>Cuenta / concepto</span>
                          <span className="text-right text-emerald-600">Debe</span>
                          <span className="text-right text-rose-500">Haber</span>
                        </div>
                        <div className="divide-y divide-border/60">
                          {viewJournal.lines.map((line) => (
                            <div key={line.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(92px,auto)_minmax(92px,auto)] items-center gap-3 px-3 py-3">
                              <div className="min-w-0">
                                <div className="flex min-w-0 items-start gap-2">
                                  <div className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg', line.debit > 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10')}>
                                    {line.debit > 0 ? <ArrowDownLeft className="size-3.5 text-emerald-600" /> : <ArrowUpRight className="size-3.5 text-rose-500" />}
                                  </div>
                                  <p className="min-w-0 truncate text-xs font-semibold" title={line.account ? `${line.account.code} - ${line.account.name}` : line.accountId}>
                                    {line.account ? `${line.account.code} - ${line.account.name}` : line.accountId}
                                  </p>
                                </div>
                                {line.description && <p className="ml-8 mt-1 truncate text-[10px] text-muted-foreground" title={line.description}>{line.description}</p>}
                              </div>
                              <p className="text-right font-mono text-[11px] font-bold tabular-nums text-emerald-600">{line.debit > 0 ? formatCurrency(line.debit) : '—'}</p>
                              <p className="text-right font-mono text-[11px] font-bold tabular-nums text-rose-500">{line.credit > 0 ? formatCurrency(line.credit) : '—'}</p>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-muted/30 px-3 py-2.5 font-mono text-[11px] font-black tabular-nums">
                          <span className="uppercase tracking-wider text-muted-foreground">Totales</span>
                          <span className="text-right"><span className="text-emerald-600">Debe {formatCurrency(viewJournal.lines?.reduce((s, l) => s + Number(l.debit), 0) || 0)}</span> · <span className="text-rose-500">Haber {formatCurrency(viewJournal.lines?.reduce((s, l) => s + Number(l.credit), 0) || 0)}</span></span>
                        </div>
                      </div>
                    )}
                  </section>

                  <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-3 text-[10px] text-muted-foreground">
                    <span>Creado: {new Date(viewJournal.createdAt).toLocaleString('es-NI')}</span>
                    <span>| Creado por: {viewJournal.createdBy?.name || 'Sistema'}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={importOpen} onOpenChange={handleImportOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black uppercase tracking-tight italic">
              <Upload className="size-4 text-primary" />
              Importar asientos contables
            </DialogTitle>
            <DialogDescription>
              Carga el libro diario del año contable o de los meses transcurridos a la fecha desde una plantilla Excel.
            </DialogDescription>
          </DialogHeader>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <CalendarRange className="size-4 text-muted-foreground" />
                Alcance de carga
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={scopeMode} onValueChange={(value) => setScopeMode(value as 'full' | 'elapsed' | 'custom')} className="gap-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 p-3 transition-colors hover:border-primary/40 has-[[data-state=checked]]:border-primary/60 has-[[data-state=checked]]:bg-primary/5">
                  <RadioGroupItem value="full" className="mt-0.5" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">Año contable completo (Enero - Diciembre)</span>
                    <span className="block text-xs text-muted-foreground">Todos los meses del año {currentYear}</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 p-3 transition-colors hover:border-primary/40 has-[[data-state=checked]]:border-primary/60 has-[[data-state=checked]]:bg-primary/5">
                  <RadioGroupItem value="elapsed" className="mt-0.5" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">Meses transcurridos a la fecha</span>
                    <span className="block text-xs text-muted-foreground">Primeros N meses del año {currentYear} hasta el mes actual</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 p-3 transition-colors hover:border-primary/40 has-[[data-state=checked]]:border-primary/60 has-[[data-state=checked]]:bg-primary/5">
                  <RadioGroupItem value="custom" className="mt-0.5" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">Personalizado</span>
                    <span className="block text-xs text-muted-foreground">Elige el rango de meses (desde / hasta)</span>
                  </span>
                </label>
              </RadioGroup>

              {scopeMode === 'elapsed' && (
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                    Cantidad de meses
                  </Label>
                  <Select value={elapsedMonths} onValueChange={setElapsedMonths}>
                    <SelectTrigger className="h-8 w-56 text-xs">
                      <SelectValue placeholder="Meses" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {m} {m === 1 ? 'mes' : 'meses'} · {MONTH_NAMES[m - 1]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {scopeMode === 'custom' && (
                <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Desde · Mes</Label>
                    <Select value={customFromMonth} onValueChange={setCustomFromMonth}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTH_NAMES.map((name, i) => (
                          <SelectItem key={name} value={String(i + 1)}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Desde · Año</Label>
                    <Select value={customFromYear} onValueChange={setCustomFromYear}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Hasta · Mes</Label>
                    <Select value={customToMonth} onValueChange={setCustomToMonth}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTH_NAMES.map((name, i) => (
                          <SelectItem key={name} value={String(i + 1)}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Hasta · Año</Label>
                    <Select value={customToYear} onValueChange={setCustomToYear}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Fechas de corte generadas ({scopeMonths.length})
                </p>
                {scopeMonths.length === 0 ? (
                  <p className="text-xs font-semibold text-rose-600">
                    El rango seleccionado es inválido (el inicio es posterior al fin).
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {scopeMonths.map((m) => (
                      <Badge key={`${m.year}-${m.month}`} variant="outline" className="font-mono text-[10px]">
                        {monthCutoff(m.year, m.month).label}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-bold">
                <Download className="size-3.5 text-muted-foreground" />
                Plantilla de importación (.xlsx)
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Columnas en español: Código de cuenta, Descripción, Débito, Crédito, Referencia y Mes.
              </p>
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={downloadAsientosTemplate} disabled={scopeMonths.length === 0}>
              <Download className="size-3.5" />
              Descargar plantilla (.xlsx)
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <FileSpreadsheet className="size-4 text-muted-foreground" />
                Subir archivo y revisar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-dashed border-border/40 p-6 text-center">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  id="asientos-import-file"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAsientosFile(f); e.target.value = ''; }}
                />
                <label htmlFor="asientos-import-file" className="flex cursor-pointer flex-col items-center gap-2 text-muted-foreground">
                  <FileSpreadsheet className="size-10 opacity-40" />
                  <span className="text-sm font-medium">{importFileName ? importFileName : 'Haz clic para seleccionar un archivo Excel'}</span>
                  <span className="text-xs">{rawImportRows.length > 0 ? `${importRows.length} filas leídas` : 'Se cargarán los asientos del archivo'}</span>
                </label>
              </div>

              {importRows.length > 0 && (
                <>
                  <ImportReviewSummary total={importRows.length} valid={validImportCount} skipped={invalidImportCount} entityLabel="asientos" />

                  <div className="hidden min-w-0 max-w-full overflow-x-auto overflow-y-hidden rounded-xl border border-border/60 scrollbar-overlay sm:block">
                    <div className="min-w-[820px]">
                      <div className="grid grid-cols-[4rem_7rem_minmax(14rem,1fr)_7rem_7rem_8rem_8rem_7rem] bg-muted/50 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                        {['Fila', 'Código', 'Descripción', 'Débito', 'Crédito', 'Fecha de corte', 'Referencia', 'Estado'].map((label) => <div key={label} className="px-3 py-2">{label}</div>)}
                      </div>
                      <VirtualizedImportList count={importRows.length} estimateSize={38} className="h-[min(48vh,28rem)] min-w-[820px]" renderItem={(index) => {
                        const row = importRows[index];
                        return <div className="grid min-w-[820px] grid-cols-[4rem_7rem_minmax(14rem,1fr)_7rem_7rem_8rem_8rem_7rem] items-center border-t border-border/30 text-xs">
                          <div className="px-3 py-1.5 font-mono">{row.rowIndex + 2}</div>
                          <div className="px-3 py-1.5 font-mono">{row.codigo || '—'}</div>
                          <div className="truncate px-3 py-1.5" title={row.descripcion}>{row.descripcion || '—'}</div>
                          <div className="px-3 py-1.5 text-right tabular-nums text-emerald-600">{row.debito !== null && row.debito > 0 ? formatCurrency(row.debito) : '—'}</div>
                          <div className="px-3 py-1.5 text-right tabular-nums text-rose-500">{row.credito !== null && row.credito > 0 ? formatCurrency(row.credito) : '—'}</div>
                          <div className="px-3 py-1.5 font-mono">{row.cutoffLabel || '—'}</div>
                          <div className="truncate px-3 py-1.5 font-mono" title={row.referencia}>{row.referencia || '—'}</div>
                          <div className="px-3 py-1.5 text-center">{row.valid ? <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600"><CheckCircle2 className="size-3" /> Válida</span> : <Tooltip><TooltipTrigger asChild><span className="inline-flex cursor-help items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600"><AlertTriangle className="size-3" /> Error</span></TooltipTrigger><TooltipContent className="max-w-xs"><div className="space-y-1">{row.errors.map((error) => <p key={error}>{error}</p>)}</div></TooltipContent></Tooltip>}</div>
                        </div>;
                      }} />
                    </div>
                  </div>

                  <section className="space-y-3 sm:hidden" aria-label="Asientos importados para revisar">
                    <div className="flex items-center justify-between gap-2 rounded-xl border bg-muted/20 px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Revisión móvil</p>
                      <Badge variant="secondary" className="text-[10px]">{importRows.length} filas</Badge>
                    </div>
                    <VirtualizedImportList count={importRows.length} estimateSize={210} className="h-[min(58vh,38rem)] space-y-3" renderItem={(index) => {
                      const row = importRows[index];
                      return <ImportPreviewMobileCard key={row.rowIndex} index={row.rowIndex} title={row.descripcion || row.codigo} error={row.valid ? undefined : row.errors.join(' · ')}>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <ImportPreviewField label="Código"><p className="break-words font-mono text-xs">{row.codigo || '—'}</p></ImportPreviewField>
                          <ImportPreviewField label="Fila"><p className="font-mono text-xs">{row.rowIndex + 2}</p></ImportPreviewField>
                          <ImportPreviewField label="Descripción" className="col-span-2"><p className="break-words text-xs">{row.descripcion || '—'}</p></ImportPreviewField>
                          <ImportPreviewField label="Débito"><p className="text-right text-xs tabular-nums text-emerald-600">{row.debito !== null && row.debito > 0 ? formatCurrency(row.debito) : '—'}</p></ImportPreviewField>
                          <ImportPreviewField label="Crédito"><p className="text-right text-xs tabular-nums text-rose-500">{row.credito !== null && row.credito > 0 ? formatCurrency(row.credito) : '—'}</p></ImportPreviewField>
                          <ImportPreviewField label="Fecha de corte"><p className="break-words font-mono text-xs">{row.cutoffLabel || '—'}</p></ImportPreviewField>
                          <ImportPreviewField label="Referencia"><p className="break-words font-mono text-xs">{row.referencia || '—'}</p></ImportPreviewField>
                        </div>
                      </ImportPreviewMobileCard>;
                    }} />
                  </section>

                  <div className="flex justify-end">
                    <Button onClick={handleImportAsientos} disabled={importing || validImportCount === 0} className="gap-1.5">
                      <Upload className="size-4" />
                      {importing ? 'Importando...' : `Importar ${validImportCount} válidas`}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
      <ImportProgressOverlay
        open={readingFile || importing}
        progress={readingFile ? readingProgress : operationProgress}
        title={readingFile ? 'Preparando asientos contables' : 'Importando asientos contables'}
        description={readingFile ? 'Leyendo el archivo y preparando todas las filas para su revisión.' : 'Creando las transacciones del libro diario desde las filas válidas...'}
      />
      </div>
    </div>
  );
}
