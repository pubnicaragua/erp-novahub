import { useState, useEffect } from 'react';
import { 
  Wallet, Plus, Search, Eye, Trash2, TrendingDown, Clock, Tag, ChevronLeft, Calendar as CalendarIcon, FileText, Download, Upload, FileDown, Info
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { expensesService } from '../../services/compras.service';
import type { Expense, Supplier } from '../../types';
import type { SalesPaginationControls } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
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
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';

interface Props { data: Expense[]; loading: boolean; onRefresh: () => void; supplierCatalog?: Supplier[]; accountCatalog?: any[]; expenseCategoryCatalog?: any[]; pagination?: SalesPaginationControls; onSearchChange?: (value: string) => void; }
type KpiFilter = { type: 'none' } | { type: 'pending' } | { type: 'category'; category: string };
type DateFilterPreset = 'all' | 'last4' | 'last9' | 'month' | 'year' | 'specific';
const paymentSourceOptions = ['EFECTIVO', 'BAC', 'LAFISE', 'ATLANTIDA', 'FICOHSA', 'BANPRO', 'BDF', 'AVANZ'] as const;
const MAX_EVIDENCE_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_EVIDENCE_FILE_BYTES = 10 * 1024 * 1024;

const statusOpts = [
  { label: 'Pendiente', value: 'PENDING',  color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Aprobado',  value: 'APPROVED', color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Pagado',    value: 'PAID',     color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Rechazado', value: 'REJECTED', color: 'bg-rose-500/10 text-rose-500' },
];

export function GastosView({ data, loading, onRefresh, supplierCatalog = [], accountCatalog = [], expenseCategoryCatalog = [], pagination, onSearchChange }: Props) {
  const { canPerform } = useAuth();
  const { exchangeRate: globalRate, displayCurrency, valuationMode, valuationModeSuffix, formatConvertedAmount, formatCurrentAmount, convertAmount, convertCurrentAmount } = useCurrency();
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  useEffect(() => { setExpenseCategories(expenseCategoryCatalog); }, [expenseCategoryCatalog]);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [activeKpiFilter, setActiveKpiFilter] = useState<KpiFilter>({ type: 'none' });
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('all');
  const [specificDate, setSpecificDate] = useState<Date | undefined>(undefined);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ total: number; created: number; skipped: number; errors: string[] } | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<Expense> | null>(null);

  useEffect(() => {
    setSuppliers(supplierCatalog);
    const flatten = (items: any[]): any[] => {
      const result: any[] = [];
      for (const item of items) {
        const { children, ...rest } = item;
        result.push(rest);
        if (Array.isArray(children) && children.length > 0) result.push(...flatten(children));
      }
      return result;
    };
    setAccounts(flatten(accountCatalog));
  }, [supplierCatalog, accountCatalog]);

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
              paymentSource: 'EFECTIVO',
              status: 'PENDING',
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

  const toDayNumber = (value?: string | null): number | null => {
    if (!value) return null;
    const normalized = String(value).includes('T') ? String(value).split('T')[0] : String(value);
    const date = new Date(`${normalized}T00:00:00`);
    const time = date.getTime();
    return Number.isNaN(time) ? null : time;
  };

  const getPresetRange = (): { from: number | null; to: number | null } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = today.getTime();

    if (datePreset === 'all') return { from: null, to: null };
    if (datePreset === 'specific') {
      const selected = specificDate ? new Date(specificDate.getFullYear(), specificDate.getMonth(), specificDate.getDate()) : null;
      const value = selected ? selected.getTime() : null;
      return { from: value, to: value };
    }
    if (datePreset === 'month') {
      const from = new Date(today);
      from.setMonth(from.getMonth() - 1);
      return { from: from.getTime(), to: end };
    }
    const from = new Date(today);
    from.setFullYear(from.getFullYear() - 1);
    return { from: from.getTime(), to: end };
  };

  const filtered = data.filter(g => {
    const matchesSearch =
      (g.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (g.category || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    const expenseDate = toDayNumber(g.date);
    const { from: fromDate, to: toDate } = getPresetRange();
    if (fromDate !== null && (expenseDate === null || expenseDate < fromDate)) return false;
    if (toDate !== null && (expenseDate === null || expenseDate > toDate)) return false;

    if (activeKpiFilter.type === 'pending') return String(g.status || '').toUpperCase() === 'PENDING';
    if (activeKpiFilter.type === 'category') return String(g.category || '').toUpperCase() === activeKpiFilter.category;
    return true;
  });

  const downloadExpenseTemplate = () => {
    const rows = [
      ['date', 'description', 'category', 'amount', 'currency', 'paymentSource', 'paidTo', 'reference', 'status', 'notes'],
      ['2026-01-15', 'Pago servicio internet', 'OPERATIVO', '1500', 'NIO', 'BAC', 'Proveedor Internet', 'FAC-001', 'PAID', 'Importado desde plantilla'],
    ];
    const csv = [
      'sep=;',
      ...rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';')),
    ].join('\r\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'plantilla_gastos.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Plantilla descargada');
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

  const parseExpensesCsv = async (file: File) => {
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
    const headers = splitCsvLine(headerLine, delimiter).map((h) => h.toLowerCase());
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
    if (['APPROVED', 'PAID', 'REJECTED'].includes(status)) return status;
    return 'PENDING';
  };

  const handleImportExpenses = async () => {
    if (!importFile) {
      toast.error('Selecciona un archivo CSV');
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const rows = await parseExpensesCsv(importFile);
      if (rows.length === 0) {
        toast.error('El archivo no contiene filas para importar');
        return;
      }

      let created = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        const rowNumber = idx + 2;
        const description = String(row.description || row.descripcion || '').trim();
        const amount = Number(String(row.amount || row.monto || '0').replace(',', '.'));
        const category = normalizeExpenseCategory(String(row.category || row.categoria || ''));
        const categoryCustom = category === 'OTRO' ? String(row.categorycustom || row.categoriacustom || '').trim() : '';
        const status = normalizeExpenseStatus(String(row.status || row.estado || 'PENDING'));
        const currencyRaw = String(row.currency || row.moneda || displayCurrency || 'NIO').trim().toUpperCase();
        const currency = currencyRaw === 'USD' ? 'USD' : 'NIO';
        const paymentSourceRaw = String(row.paymentsource || row.cuentaorigen || 'EFECTIVO').trim().toUpperCase();
        const paymentSource = paymentSourceOptions.includes(paymentSourceRaw as any) ? paymentSourceRaw : 'EFECTIVO';
        const paidTo = String(row.paidto || row.pagadoa || '').trim();
        const reference = String(row.reference || row.referencia || '').trim();
        const notes = String(row.notes || row.notas || '').trim();
        const dateRaw = String(row.date || row.fecha || '').trim();
        const dateParsed = dateRaw ? new Date(dateRaw) : new Date();
        const date = Number.isNaN(dateParsed.getTime()) ? new Date().toISOString() : dateParsed.toISOString();

        if (!description) {
          skipped++;
          errors.push(`Fila ${rowNumber}: descripción es obligatoria`);
          continue;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
          skipped++;
          errors.push(`Fila ${rowNumber}: monto inválido`);
          continue;
        }
        if (category === 'OTRO' && !categoryCustom) {
          skipped++;
          errors.push(`Fila ${rowNumber}: categoría OTRO requiere categoryCustom`);
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
            notes: notes || undefined,
            status: status as any,
          } as any);
          created++;
        } catch (e: any) {
          skipped++;
          errors.push(`Fila ${rowNumber}: ${e?.response?.data?.message || e?.message || 'no se pudo crear'}`);
        }
      }

      setImportResult({ total: rows.length, created, skipped, errors: errors.slice(0, 12) });
      if (created > 0) onRefresh();
      toast.success(`Importación finalizada: ${created} creados, ${skipped} omitidos`);
    } catch (error: any) {
      toast.error(`No se pudo importar: ${error?.message || 'archivo inválido'}`);
    } finally {
      setImporting(false);
    }
  };

  const columns: ColumnDef<Expense>[] = [
    { key: 'date',        header: 'Fecha',     width: '110px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'category',    header: 'Categoría', width: '130px', editable: canPerform('PURCHASES_EXPENSES', 'edit'), type: 'select', options: [
        {label: 'Operacional', value: 'OPERATIVO'}, {label: 'Administrativo', value: 'ADMINISTRATIVO'}, {label: 'Ventas', value: 'VENTAS'}, {label: 'Financiero', value: 'FINANCIERO'}, {label: 'Otro', value: 'OTRO'}
      ],
      render: (val, row) => <Badge variant="outline" className="text-[9px] uppercase bg-primary/5 text-primary border-none">{String(val || '').toUpperCase() === 'OTRO' ? (row.categoryCustom || 'OTRO') : (val || '-')}</Badge> },
    { key: 'description', header: 'Descripción', editable: canPerform('PURCHASES_EXPENSES', 'edit') },
    { key: 'paidTo',      header: 'Pagado a', width: '170px',
      render: (val) => <span className="text-xs font-medium text-foreground">{val || '-'}</span> },
    { key: 'paymentSource', header: 'Cuenta Origen', width: '130px',
      render: (val) => <span className="text-xs font-black text-muted-foreground">{val || '-'}</span> },
    { key: 'amount',      header: 'Monto',     width: '130px',
      render: (val, row) => (
        <CurrencyValuationAmount amount={Number(val || 0)} sourceCurrency={row.currency} sourceExchangeRate={row.exchangeRate} className="font-black text-rose-500" />
      ) },
    { key: 'status',      header: 'Estado',    width: '120px', editable: canPerform('PURCHASES_EXPENSES', 'edit'), type: 'select', options: statusOpts,
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Expense>) => {
    try { await expensesService.update(id as string, updates); toast.success('Gasto actualizado'); onRefresh(); }
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar'); throw new Error('Update failed', { cause: e }); }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    setDeleteLoading(true);
    try {
      await expensesService.delete(pendingDeleteId);
      toast.success('Gasto eliminado correctamente');
      setPendingDeleteId(null);
      if (editingId === pendingDeleteId) setEditingId(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar');
    } finally {
      setDeleteLoading(false);
    }
  };
  const handleSaveDoc = async () => {
    if (!localDoc?.description) return toast.error('La descripción es obligatoria');
    if (!localDoc?.amount || localDoc.amount <= 0) return toast.error('El monto debe ser mayor a 0');
    // Clean data (ensure numbers and remove nested objects)
    const cleanedDoc = {
      ...localDoc,
      amount: Number(localDoc.amount),
      exchangeRate: Number(localDoc.exchangeRate),
      baseAmount: Number(localDoc.baseAmount),
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

    try {
      if (editingId === 'NEW') {
        await expensesService.create(cleanedDoc as any);
        toast.success('Gasto registrado');
      } else {
        await expensesService.update(editingId!, cleanedDoc as any);
        toast.success('Gasto guardado');
      }
      setEditingId(null);
      setEvidenceFile(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al guardar el gasto');
    }
  };

  if (editingId && localDoc) {
    const isNew = editingId === 'NEW';
    const currentStatus = statusOpts.find(s => s.value === (localDoc.status||'').toUpperCase());
    const canMutate = isNew ? canPerform('PURCHASES_EXPENSES', 'create') : canPerform('PURCHASES_EXPENSES', 'edit');
    const resolvedHour = localDoc.time || (localDoc.date ? new Date(localDoc.date).toTimeString().slice(0, 5) : '');

    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
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
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:gap-3">
             {!isNew && canPerform('PURCHASES_EXPENSES', 'delete') && (
                <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => setPendingDeleteId(editingId)}>
                  <Trash2 className="size-3 mr-2" /> Eliminar
                </Button>
             )}
            {((isNew && canPerform('PURCHASES_EXPENSES', 'create')) || (!isNew && canPerform('PURCHASES_EXPENSES', 'edit'))) && (
              <Button onClick={handleSaveDoc} className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6">
                Guardar Gasto
              </Button>
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

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50 col-span-2 md:col-span-1">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Información del Gasto</p>
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Descripción / Concepto</p>
                    <Input 
                      disabled={isNew ? !canPerform('PURCHASES_EXPENSES', 'create') : !canPerform('PURCHASES_EXPENSES', 'edit')}
                      value={localDoc.description || ''} 
                      onChange={(e) => setLocalDoc({ ...localDoc, description: e.target.value })} 
                      className="h-8 text-xs font-bold" 
                      placeholder="Ej. Pago de internet mensual" 
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Categoría</p>
                    <select
                      disabled={isNew ? !canPerform('PURCHASES_EXPENSES', 'create') : !canPerform('PURCHASES_EXPENSES', 'edit')}
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
                      disabled={isNew ? !canPerform('PURCHASES_EXPENSES', 'create') : !canPerform('PURCHASES_EXPENSES', 'edit')}
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
                      disabled={isNew ? !canPerform('PURCHASES_EXPENSES', 'create') : !canPerform('PURCHASES_EXPENSES', 'edit')}
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
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Cuenta de Origen</p>
                    <select
                      disabled={!canMutate}
                      value={(localDoc.paymentSource as string) || 'EFECTIVO'}
                      onChange={(e) => setLocalDoc({ ...localDoc, paymentSource: e.target.value as any })}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase"
                    >
                      {paymentSourceOptions.map(source => (
                        <option key={source} value={source}>{source}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Cuenta contable</p>
                    <div className="flex h-8 items-center rounded-md border border-primary/20 bg-primary/5 px-2 text-[10px] font-bold text-primary">
                      Se aplica la cuenta global de Gastos configurada en Contabilidad
                    </div>
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
                    <p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                    <select
                      disabled={isNew ? !canPerform('PURCHASES_EXPENSES', 'create') : !canPerform('PURCHASES_EXPENSES', 'edit')}
                      value={localDoc.status || 'PENDING'}
                      onChange={(e) => setLocalDoc({ ...localDoc, status: e.target.value as any })}
                      className={cn("h-8 w-full rounded-md border border-input px-2 text-xs font-bold uppercase", currentStatus?.color || 'bg-background')}
                    >
                      {statusOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Referencia (Factura/Recibo)</p>
                    <Input 
                      disabled={isNew ? !canPerform('PURCHASES_EXPENSES', 'create') : !canPerform('PURCHASES_EXPENSES', 'edit')}
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

          <Card className="w-full min-w-0 rounded-2xl border-border/50">
            <CardContent className="p-6 flex flex-col justify-center h-full space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Valor del Gasto</p>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm border-b border-border/50 pb-4">
                   <div className="w-1/2">
                      <p className="text-[10px] text-muted-foreground mb-1">Moneda</p>
                      <select
                        disabled={isNew ? !canPerform('PURCHASES_EXPENSES', 'create') : !canPerform('PURCHASES_EXPENSES', 'edit')}
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
                        disabled={isNew ? !canPerform('PURCHASES_EXPENSES', 'create') : !canPerform('PURCHASES_EXPENSES', 'edit')}
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
    { key: 'all', title: 'Gastos Operativos',  value: data.length,                                                                         icon: Wallet,       color: 'text-blue-500',   bg: 'bg-blue-500/10'    },
    {
      key: 'month',
      title: `Total del Mes (${displayCurrency}${valuationModeSuffix})`,
      value: formatCurrentAmount(monthlyTotalInDisplayCurrency, displayCurrency),
      icon: TrendingDown,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
    },
    { key: 'pending', title: 'Pendientes', value: data.filter(g => (g.status || '').toUpperCase() === 'PENDING').length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', interactive: true },
    { key: 'category', title: 'Por Categoría', value: uniqueCategories.length, icon: Tag, color: 'text-purple-500', bg: 'bg-purple-500/10', interactive: true },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="purchases-list-kpis">
        {kpis.map((k, i) => {
          const isActive =
            (k.key === 'pending' && activeKpiFilter.type === 'pending') ||
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
            <div className="flex min-w-0 w-full items-center gap-0 rounded-xl border border-border/50 bg-background/60 p-1">
              <Button variant={datePreset === 'month' ? 'default' : 'ghost'} size="sm" className="h-8 min-w-0 flex-1 rounded-lg px-2 text-[10px] font-black uppercase tracking-widest" onClick={() => setDatePreset('month')}>Último mes</Button>
              <Button variant={datePreset === 'year' ? 'default' : 'ghost'} size="sm" className="h-8 min-w-0 flex-1 rounded-lg px-2 text-[10px] font-black uppercase tracking-widest" onClick={() => setDatePreset('year')}>Último año</Button>
            </div>
            <div className="col-span-1 min-w-0 w-full justify-self-stretch sm:col-span-1 sm:w-auto sm:justify-self-end">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={datePreset === 'specific' ? 'default' : 'outline'} className="h-10 w-full min-w-0 rounded-xl text-[10px] font-black uppercase tracking-widest sm:w-auto">
                    <CalendarIcon className="size-4" />
                    {datePreset === 'specific' && specificDate ? specificDate.toLocaleDateString() : 'Fecha específica'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={specificDate}
                    onSelect={(date) => {
                      setSpecificDate(date);
                      if (date) setDatePreset('specific');
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            {canPerform('PURCHASES_EXPENSES', 'create') && (
              <Button
                variant="outline"
                onClick={() => { setImportOpen(true); setImportResult(null); }}
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
                  setSpecificDate(undefined);
                }}
              >
                Todo
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
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} pagination={pagination}
          onBulkDelete={canPerform('PURCHASES_EXPENSES', 'delete') ? async (ids) => {
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await expensesService.delete(id as string);
              }
              toast.success('Elementos eliminados');
              onRefresh();
            } catch (e: any) {
              toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar');
            }
          } : undefined}
          actions={(row) => (
            <div className="flex gap-1">
              <Button title={canPerform('PURCHASES_EXPENSES', 'edit') ? "Editar" : "Ver"} variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
              <PurchaseAuditButton entity="EXPENSE" entityId={row.id} title="Auditoria del Gasto" />
              {canPerform('PURCHASES_EXPENSES', 'delete') && (
                <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
              )}
            </div>
          )}
        />
        <ConfirmDialog
          open={!!pendingDeleteId}
          onOpenChange={(open) => !open && setPendingDeleteId(null)}
          title="Eliminar Gasto"
          description="¿Estás seguro de que deseas eliminar este gasto? Esta acción no se puede deshacer."
          confirmLabel="Eliminar Gasto"
          onConfirm={handleDeleteConfirm}
          loading={deleteLoading}
        />

        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Upload className="size-4" /> Importar gastos</DialogTitle>
              <DialogDescription>
                Sube un CSV para registrar gastos masivamente. Usa la plantilla para mantener el formato correcto.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 p-4 bg-muted/20">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Formato esperado</p>
                <p className="text-xs text-muted-foreground">
                  Columnas: <span className="font-mono">date,description,category,amount,currency,paymentSource,paidTo,reference,status,notes</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  category: OPERATIVO/ADMINISTRATIVO/VENTAS/FINANCIERO/OTRO · status: PENDING/APPROVED/PAID/REJECTED
                </p>
                <Button variant="ghost" size="sm" className="mt-3 gap-2 h-8" onClick={downloadExpenseTemplate}>
                  <FileDown className="size-4" /> Descargar plantilla CSV
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground">Archivo CSV</label>
                <Input type="file" accept=".csv,text/csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
                {importFile && <p className="text-xs text-muted-foreground">Archivo: <b>{importFile.name}</b> ({Math.round(importFile.size / 1024)} KB)</p>}
              </div>

              {importResult && (
                <div className="rounded-xl border border-border/60 p-4 bg-background">
                  <p className="text-xs font-black uppercase tracking-widest mb-2">Resultado</p>
                  <p className="text-sm">
                    Total: <b>{importResult.total}</b> · Creados: <b className="text-emerald-500">{importResult.created}</b> · Omitidos: <b className="text-amber-500">{importResult.skipped}</b>
                  </p>
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 space-y-1 text-xs text-amber-500">
                      <p className="font-semibold flex items-center gap-1"><Info className="size-3" /> Detalles:</p>
                      {importResult.errors.map((err, i) => <p key={i}>- {err}</p>)}
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setImportOpen(false)}>Cerrar</Button>
              <Button onClick={handleImportExpenses} disabled={importing || !importFile} className="gap-2">
                <Upload className="size-4" /> {importing ? 'Importando...' : 'Importar gastos'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
