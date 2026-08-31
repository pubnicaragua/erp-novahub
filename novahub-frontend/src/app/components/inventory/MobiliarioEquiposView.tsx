import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Plus, Search, Pencil, Trash2, RefreshCw, Loader2, Building2, X, Upload, FileDown, Paperclip, ExternalLink, FileSpreadsheet, CalendarClock } from 'lucide-react';
import { cn } from '../ui/utils';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { mobiliarioService } from '../../services/mobiliario.service';
import { storageService } from '../../services/storage.service';
import { api } from '../../services/api';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { InventoryViewTutorial } from './InventoryViewTutorial';
import { ImportProgressOverlay } from '../ui/ImportProgressOverlay';
import { VirtualizedImportList } from '../ui/VirtualizedImportList';
import { parseSpreadsheetInWorker } from '../../utils/import-spreadsheet';

const CATEGORIES = [
  { value: 'BUILDING', label: 'Edificios' },
  { value: 'VEHICLE', label: 'Vehículos' },
  { value: 'OFFICE_FURNITURE', label: 'Mobiliario y equipo de oficina' },
  { value: 'COMPUTER_EQUIPMENT', label: 'Equipos de cómputo' },
  { value: 'MACHINERY', label: 'Maquinaria y equipo' },
  { value: 'OTHER', label: 'Otros / Misceláneos' },
];

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function lastDayOfMonth(ym: string): Date {
  const parts = String(ym || '').split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!year || !month) return new Date();
  return new Date(year, month, 0, 23, 59, 59, 999);
}

function currentMonthYM(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function buildMonthOptions(count = 24): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  return opts;
}

const STATUSES = [
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'ASSIGNED', label: 'Asignado' },
  { value: 'IN_REPAIR', label: 'En reparación' },
  { value: 'DAMAGED', label: 'Dañado' },
  { value: 'DISPOSED', label: 'Dado de baja' },
];

const CURRENCIES = [
  { value: 'USD', label: 'Dólares (USD)' },
  { value: 'NIO', label: 'Córdobas (NIO)' },
];

const CATEGORY_BADGES: Record<string, string> = {
  BUILDING: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  VEHICLE: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  OFFICE_FURNITURE: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  COMPUTER_EQUIPMENT: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  MACHINERY: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  OTHER: 'bg-muted text-muted-foreground border-border/30',
};

const STATUS_BADGES: Record<string, string> = {
  AVAILABLE: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  ASSIGNED: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  IN_REPAIR: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  DAMAGED: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
  DISPOSED: 'bg-muted text-muted-foreground border-border/30',
};

// Plantilla de importación: 50 filas de ejemplo en español, con fila TOTAL
// que calcula la suma del costo (SUMA) al abrirse en Excel.
const TEMPLATE_HEADERS = [
  'Código', 'Nombre', 'Categoría', 'Descripción', 'Marca', 'Modelo', 'Número de serie',
  'Sucursal', 'Ubicación', 'Responsable', 'Fecha de adquisición', 'Proveedor',
  'Número de factura', 'Costo', 'Moneda', 'Tasa de cambio', 'Estado', 'Observaciones',
];

const TEMPLATE_CATEGORIES = ['BUILDING', 'VEHICLE', 'OFFICE_FURNITURE', 'COMPUTER_EQUIPMENT', 'MACHINERY', 'OTHER'];
const TEMPLATE_STATUSES = ['AVAILABLE', 'ASSIGNED', 'IN_REPAIR', 'DAMAGED', 'DISPOSED'];
const TEMPLATE_NAMES = [
  'Edificio principal', 'Bodega de distribución', 'Camioneta de reparto', 'Vehículo de gerencia',
  'Escritorio ejecutivo', 'Silla ergonómica', 'Archivador metálico', 'Estantería de oficina',
  'Laptop Dell Latitude', 'Computadora de escritorio HP', 'Monitor Samsung 24"', 'Impresora multifuncional Epson',
  'Aire acondicionado LG', 'Torno industrial', 'Compresor de aire', 'Generador eléctrico',
  'Licuadora industrial', 'Caja registradora', 'Teléfono IP', 'Router empresarial',
];

function buildTemplateRows(): (string | number)[][] {
  return Array.from({ length: 50 }, (_, i) => [
    '',
    `${TEMPLATE_NAMES[i % TEMPLATE_NAMES.length]} ${i + 1}`,
    TEMPLATE_CATEGORIES[i % TEMPLATE_CATEGORIES.length],
    '',
    ['Dell', 'HP', 'Toyota', 'Samsung', 'LG', 'Bosch'][i % 6],
    `Modelo ${i + 1}`,
    i % 4 === 0 ? `SN-${100000 + i}` : '',
    '',
    '',
    '',
    '',
    '',
    '',
    (250 + i * 35),
    i % 2 === 0 ? 'USD' : 'NIO',
    i % 2 === 0 ? '' : '36.5',
    TEMPLATE_STATUSES[i % TEMPLATE_STATUSES.length],
    'Item de ejemplo de la plantilla',
  ]);
}

function downloadTemplate(includeCost = true) {
  const rows = buildTemplateRows();
  const costIndex = TEMPLATE_HEADERS.indexOf('Costo');
  const headers = includeCost ? TEMPLATE_HEADERS : TEMPLATE_HEADERS.filter((_, index) => index !== costIndex);
  const outputRows = includeCost ? rows : rows.map((row) => row.filter((_, index) => index !== costIndex));
  const ws = XLSX.utils.aoa_to_sheet([headers, ...outputRows]);
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: outputRows.length, c: headers.length - 1 } });
  const totalRow = outputRows.length + 1; // fila 1 = encabezado, filas 2..51 = datos
  if (includeCost) {
    const totalCell = XLSX.utils.encode_cell({ r: totalRow - 1, c: costIndex });
    ws[totalCell] = { t: 'n', f: `SUMA(N2:N${outputRows.length + 1})` };
  }
  const labelCell = XLSX.utils.encode_cell({ r: totalRow - 1, c: 1 });
  ws[labelCell] = { t: 's', v: 'TOTAL' };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mobiliario');
  XLSX.writeFile(wb, 'plantilla_mobiliario_equipos.xlsx');
}

const SHEET_ALIASES: Record<string, string> = {
  codigo: 'code', nombre: 'name', categoria: 'category', descripcion: 'description',
  marca: 'brand', modelo: 'model', serie: 'serialNumber', 'numero_de_serie': 'serialNumber',
  sucursal: 'branchCode', ubicacion: 'location', responsable: 'responsibleEmail',
  fecha_adquisicion: 'acquisitionDate', 'fecha_de_adquisicion': 'acquisitionDate',
  proveedor: 'supplier', numero_factura: 'documentNumber', 'numero_de_factura': 'documentNumber',
  costo: 'cost', moneda: 'currency', tasa_cambio: 'exchangeRate', 'tasa_de_cambio': 'exchangeRate',
  estado: 'status', observaciones: 'observations',
};

function parseSheetRows(sheet: any[][]): Record<string, any>[] {
  if (!sheet || sheet.length < 2) return [];
  const headers = sheet[0].map((h) => {
    const key = String(h ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
    return SHEET_ALIASES[key] || key;
  });
  return sheet.slice(1)
    .filter(row => row.some(c => String(c ?? '').trim() !== ''))
    .map(row => {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? String(row[i]).trim() : ''; });
      return obj;
    })
    .filter(row => String(row.name || '').trim().toUpperCase() !== 'TOTAL' && String(row.name || '').trim() !== '');
}

interface AssetRow {
  id: string;
  code: string;
  name: string;
  category: string;
  categoryLabel?: string;
  description?: string | null;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  branchId?: string | null;
  location?: string | null;
  responsibleUserId?: string | null;
  acquisitionDate?: string | null;
  supplier?: string | null;
  documentNumber?: string | null;
  cost: number;
  currency: string;
  exchangeRate?: number | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  status: string;
  statusLabel?: string;
  observations?: string | null;
  branch?: { id: string; code: string; name: string } | null;
  responsibleUser?: { id: string; name: string } | null;
}

interface FormState {
  code: string;
  name: string;
  category: string;
  description: string;
  brand: string;
  model: string;
  serialNumber: string;
  branchId: string;
  location: string;
  responsibleUserId: string;
  acquisitionDate: string;
  supplier: string;
  documentNumber: string;
  cost: string;
  currency: string;
  exchangeRate: string;
  status: string;
  observations: string;
}

const EMPTY_FORM: FormState = {
  code: '', name: '', category: 'OFFICE_FURNITURE', description: '', brand: '', model: '',
  serialNumber: '', branchId: '', location: '', responsibleUserId: '', acquisitionDate: '',
  supplier: '', documentNumber: '', cost: '0', currency: 'USD', exchangeRate: '',
  status: 'AVAILABLE', observations: '',
};

export function MobiliarioEquiposView({ externalBranchId }: { externalBranchId?: string }) {
  const queryClient = useQueryClient();
  const { displayMode, formatConvertedAmount } = useCurrency();
  const { canPerform } = useAuth();
  const canViewInventoryCost = canPerform('INVENTORY', 'viewCost');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [monthCutoff, setMonthCutoff] = useState('');
  const monthOptions = useMemo(() => buildMonthOptions(24), []);
  const cutoffDate = useMemo(() => (monthCutoff ? lastDayOfMonth(monthCutoff) : null), [monthCutoff]);

  const effectiveBranchId = externalBranchId ?? (branchFilter === 'all' ? undefined : branchFilter);

  const listQuery = useAccountingQuery<any>(['company-assets', search, categoryFilter, statusFilter, effectiveBranchId, monthCutoff, page, pageSize], async (signal) =>
    mobiliarioService.getAssets({
      search: search.trim() || undefined,
      category: categoryFilter === 'all' ? undefined : categoryFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
      branchId: effectiveBranchId,
      page: cutoffDate ? 1 : page,
      pageSize: cutoffDate ? 5000 : pageSize,
    }, signal),
  );
  const branchesQuery = useAccountingQuery<any[]>(['sucursales'], async (signal) => accountingList(await api.get('/sucursales', { signal })));
  const usersQuery = useAccountingQuery<any[]>(['users-list'], async (signal) => accountingList(await api.get('/users', { signal })));

  const response = listQuery.data as any;
  const allAssets: AssetRow[] = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
  const summary = response?.summary ?? null;
  const meta = response?.meta ?? { total: allAssets.length, page, pageSize, totalPages: Math.max(1, Math.ceil(allAssets.length / pageSize)) };
  const loading = listQuery.isLoading || listQuery.isFetching;
  const branches = (branchesQuery.data || []).map(b => ({ id: String(b.id), name: `${b.code || ''} ${b.name || ''}`.trim() }));
  const users = (usersQuery.data || []).map(u => ({ id: String(u.id), name: String(u.name || u.email || '') }));

  const assets = useMemo(() => {
    if (!cutoffDate) return allAssets;
    return allAssets.filter((a) => {
      if (!a.acquisitionDate) return true;
      const d = new Date(String(a.acquisitionDate).slice(0, 10));
      return !Number.isNaN(d.getTime()) && d.getTime() <= cutoffDate.getTime();
    });
  }, [allAssets, cutoffDate]);

  const displayedAssets = useMemo(() => {
    if (!cutoffDate) return assets;
    const start = (page - 1) * pageSize;
    return assets.slice(start, start + pageSize);
  }, [assets, cutoffDate, page, pageSize]);

  const displayTotal = cutoffDate ? assets.length : meta.total;
  const displayTotalPages = cutoffDate ? Math.max(1, Math.ceil(assets.length / pageSize)) : meta.totalPages;
  const hasActiveFilters = Boolean(
    search.trim()
    || categoryFilter !== 'all'
    || statusFilter !== 'all'
    || (!externalBranchId && branchFilter !== 'all')
    || monthCutoff,
  );

  const cutoffSummary = useMemo(() => {
    if (!cutoffDate) return null;
    const base = String(summary?.baseCurrency || 'USD');
    let totalCostBase = 0;
    const perCurrency: Record<string, number> = { NIO: 0, USD: 0 };
    for (const a of assets) {
      const cur = String(a.currency || 'USD');
      const cost = Number(a.cost || 0);
      perCurrency[cur] = (perCurrency[cur] || 0) + cost;
      const rate = Number(a.exchangeRate || 0);
      if (cur === base) totalCostBase += cost;
      else if (base === 'NIO') totalCostBase += rate > 0 ? cost * rate : cost;
      else totalCostBase += rate > 0 ? cost / rate : cost;
    }
    return { totalAssets: assets.length, baseCurrency: base, totalCostBase, perCurrency };
  }, [assets, cutoffDate, summary]);
  const effectiveSummary = cutoffDate ? cutoffSummary : summary;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AssetRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AssetRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Importación
  const [importOpen, setImportOpen] = useState(false);
  const [importRowsData, setImportRowsData] = useState<Record<string, any>[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [readingFile, setReadingFile] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [importResult, setImportResult] = useState<any>(null);
  const [importMonth, setImportMonth] = useState(currentMonthYM());

  // Respaldo
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const set = (field: keyof FormState, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  useEffect(() => {
    if (!formOpen || form.currency !== 'NIO' || form.exchangeRate) return;
    api.get<any>('/tools/exchange-rate').then((res: any) => {
      const rate = res?.rate ?? (res as any)?.data?.rate;
      if (rate) set('exchangeRate', String(rate));
    }).catch(() => { /* tasa manual si no se puede obtener */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen, form.currency]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setFormOpen(true); };
  const openEdit = (asset: AssetRow) => {
    setEditing(asset);
    setForm({
      code: asset.code, name: asset.name, category: asset.category,
      description: asset.description ?? '', brand: asset.brand ?? '', model: asset.model ?? '',
      serialNumber: asset.serialNumber ?? '', branchId: asset.branchId ?? '', location: asset.location ?? '',
      responsibleUserId: asset.responsibleUserId ?? '',
      acquisitionDate: asset.acquisitionDate ? String(asset.acquisitionDate).slice(0, 10) : '',
      supplier: asset.supplier ?? '', documentNumber: asset.documentNumber ?? '',
      cost: String(asset.cost ?? 0), currency: asset.currency || 'USD',
      exchangeRate: asset.exchangeRate ? String(asset.exchangeRate) : '',
      status: asset.status, observations: asset.observations ?? '',
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        code: form.code.trim() || undefined,
        name: form.name.trim(), category: form.category,
        description: form.description.trim() || null, brand: form.brand.trim() || null,
        model: form.model.trim() || null, serialNumber: form.serialNumber.trim() || null,
        branchId: form.branchId || null, location: form.location.trim() || null,
        responsibleUserId: form.responsibleUserId || null,
        acquisitionDate: form.acquisitionDate || null,
        supplier: form.supplier.trim() || null, documentNumber: form.documentNumber.trim() || null,
        cost: Number(form.cost || 0), currency: form.currency,
        exchangeRate: form.exchangeRate ? Number(form.exchangeRate) : null,
        status: form.status, observations: form.observations.trim() || null,
      };
      if (editing) await mobiliarioService.updateAsset(editing.id, payload);
      else await mobiliarioService.createAsset(payload);
      toast.success(editing ? 'Activo actualizado' : 'Activo registrado');
      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ['accounting'] });
      listQuery.refetch();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar el activo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await mobiliarioService.deleteAsset(deleteTarget.id);
      toast.success('Activo eliminado');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['accounting'] });
      listQuery.refetch();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo eliminar el activo');
    } finally {
      setDeleting(false);
    }
  };

  const handleAttachFile = async (asset: AssetRow, file: File) => {
    setAttachmentBusy(true);
    try {
      const uploaded = await storageService.uploadFile('purchase-evidence', file, { folder: `assets/${asset.code}` });
      await mobiliarioService.addAttachment(asset.id, {
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        fileUrl: uploaded.url || uploaded.uri,
      });
      toast.success('Respaldo adjuntado');
      queryClient.invalidateQueries({ queryKey: ['accounting'] });
      listQuery.refetch();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo subir el respaldo');
    } finally {
      setAttachmentBusy(false);
    }
  };

  const handleRemoveAttachment = async (asset: AssetRow) => {
    if (!window.confirm('¿Eliminar el respaldo adjunto?')) return;
    setAttachmentBusy(true);
    try {
      await mobiliarioService.removeAttachment(asset.id);
      toast.success('Respaldo eliminado');
      queryClient.invalidateQueries({ queryKey: ['accounting'] });
      listQuery.refetch();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo eliminar el respaldo');
    } finally {
      setAttachmentBusy(false);
    }
  };

  const handleImportFile = async (file: File) => {
    setReadingFile(true);
    setReadingProgress(3);
    try {
      const { rows: sheet } = await parseSpreadsheetInWorker(file, undefined, false, (progress) => {
        setReadingProgress(Math.min(84, Math.max(3, progress)));
      });
      setReadingProgress(90);
      const rows = parseSheetRows(sheet);
      if (rows.length === 0) {
        toast.error('El archivo no contiene filas de datos');
        return;
      }
      setImportRowsData(rows);
      setImportFileName(file.name);
      setImportResult(null);
      setImportOpen(true);
      setReadingProgress(100);
    } catch {
      toast.error('No se pudo leer el archivo Excel');
    } finally {
      setReadingFile(false);
      setReadingProgress(0);
    }
  };

  const confirmImport = async () => {
    if (!canViewInventoryCost) {
      toast.error('Para importar activos y sincronizarlos con Activos Fijos se requiere el permiso Ver costo en Inventario.');
      return;
    }
    setImporting(true);
    setImportProgress(10);
    try {
      const cutoff = lastDayOfMonth(importMonth);
      const y = cutoff.getFullYear();
      const m = String(cutoff.getMonth() + 1).padStart(2, '0');
      const d = String(cutoff.getDate()).padStart(2, '0');
      const defaultDate = `${y}-${m}-${d}`;
      const items = importRowsData.map((row) => row.acquisitionDate ? row : { ...row, acquisitionDate: defaultDate });
      setImportProgress(35);
      const res = await mobiliarioService.importAssets(items);
      setImportProgress(90);
      setImportResult(res);
      toast.success(`Importación completada: ${res?.createdCount ?? 0} activos y ${res?.fixedAssetCount ?? 0} registros en Activos Fijos`);
      queryClient.invalidateQueries({ queryKey: ['accounting'] });
      listQuery.refetch();
      setImportProgress(100);
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo importar');
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  const handleSyncFixedAssets = async () => {
    if (!canViewInventoryCost) {
      toast.error('Para sincronizar Activos Fijos se requiere el permiso Ver costo en Inventario.');
      return;
    }
    try {
      const result = await mobiliarioService.syncFixedAssets();
      setImportResult((previous: any) => ({
        ...(previous || {}),
        repairedFixedAssetCount: result?.createdCount ?? 0,
        fixedAssetSkippedCount: result?.skippedCount ?? 0,
        fixedAssetSkipped: (result?.skipped || []).map((item: any) => ({ row: item.code, error: item.error })),
      }));
      toast.success(`${result?.createdCount ?? 0} activo(s) sincronizado(s) con Activos Fijos`);
      queryClient.invalidateQueries({ queryKey: ['accounting'] });
      listQuery.refetch();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudieron sincronizar los Activos Fijos');
    }
  };

  const fmtCost = (n: number) => n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const categoryLabelOf = (v: string) => CATEGORIES.find(c => c.value === v)?.label || v;
  const statusLabelOf = (v: string) => STATUSES.find(s => s.value === v)?.label || v;
  const branchNameOf = (id?: string | null) => branches.find(b => b.id === id)?.name || '—';
  const userNameOf = (id?: string | null) => users.find(u => u.id === id)?.name || '—';
  const currencySymbol = (c: string) => c === 'NIO' ? 'C$' : '$';
  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setStatusFilter('all');
    if (!externalBranchId) setBranchFilter('all');
    setMonthCutoff('');
    setPage(1);
  };

  const renderCostCell = (asset: AssetRow) => {
    const original = `${currencySymbol(asset.currency || 'USD')} ${fmtCost(asset.cost)}`;
    const amount = displayMode === 'ORIGINAL'
      ? original
      : formatConvertedAmount(asset.cost, asset.currency as any, asset.exchangeRate ?? undefined);
    return (
      <div className="text-right">
        <p className="font-mono text-xs">{amount}</p>
      </div>
    );
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center sm:justify-between" data-tour="mobiliario-list-title">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="size-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-black uppercase tracking-widest">Mobiliario y Equipos</h2>
            <p className="mt-1 max-w-3xl text-[10px] leading-relaxed text-muted-foreground">
              Controla los bienes de la empresa, su ubicación, responsable, respaldo y estado operativo.
            </p>
          </div>
        </div>
        <div className="erp-list-toolbar flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center" data-tour="mobiliario-list-actions">
          <InventoryViewTutorial label="Cómo gestionar mobiliario" targetPrefix="mobiliario-list" copy={{ data: { description: 'Busca y filtra los activos por nombre, código, categoría, estado o sucursal.' }, actions: { description: 'Registra, importa, descarga la plantilla o actualiza los activos existentes.' } }} />
          <Button variant="outline" size="sm" onClick={() => listQuery.refetch()} disabled={loading} className="h-10 w-full gap-2 rounded-xl text-[10px] font-black uppercase tracking-widest sm:w-auto">
            <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadTemplate(canViewInventoryCost)} className="h-10 w-full gap-2 rounded-xl text-[10px] font-black uppercase tracking-widest sm:w-auto">
            <FileDown className="size-4" /> Plantilla
          </Button>
          {canViewInventoryCost && <Button variant="outline" size="sm" onClick={handleSyncFixedAssets} className="h-10 w-full gap-2 rounded-xl text-[10px] font-black uppercase tracking-widest sm:w-auto">
            <RefreshCw className="size-4" /> Sincronizar Activos Fijos
          </Button>}
          <Button variant="outline" size="sm" onClick={() => document.getElementById('mobiliario-import-file')?.click()} className="h-10 w-full gap-2 rounded-xl text-[10px] font-black uppercase tracking-widest sm:w-auto">
            <Upload className="size-4" /> Importar Excel
          </Button>
          <input
            id="mobiliario-import-file"
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleImportFile(f);
              e.target.value = '';
            }}
          />
          <Button size="sm" data-toolbar-role="primary" onClick={openCreate} className="h-10 w-full gap-2 rounded-xl border border-primary/20 bg-primary px-4 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 sm:w-auto">
            <Plus className="size-4" /> Nuevo activo
          </Button>
        </div>
      </div>

      <div className="erp-composite-toolbar flex min-w-0 flex-col gap-3 rounded-2xl border border-border/50 bg-card p-3 shadow-sm sm:p-4" data-tour="mobiliario-list-filters">
        <div className="order-1 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
              <Search className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground">Filtrar activos</p>
              <p className="truncate text-[10px] text-muted-foreground">Busca y combina los filtros para encontrar un bien rápidamente.</p>
            </div>
          </div>
          <p className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{displayTotal} activo{displayTotal === 1 ? '' : 's'}</p>
        </div>

        <div className="erp-toolbar-filter-group grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1.55fr)_repeat(4,minmax(140px,1fr))]" data-toolbar-role="filters" data-tour="mobiliario-list-data">
          <div className="min-w-0 space-y-1.5 sm:col-span-2 xl:col-span-1">
            <label htmlFor="mobiliario-search" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Buscar</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
              <Input id="mobiliario-search" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Nombre, código, serie o marca" className="h-10 w-full rounded-xl border-border/50 bg-background/50 pl-9 text-xs" />
            </div>
          </div>

          <div className="min-w-0 space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Categoría</span>
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
              <SelectTrigger aria-label="Filtrar por categoría" className="h-10 w-full rounded-xl border-border/50 bg-background/50 px-3 text-xs"><SelectValue placeholder="Categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</span>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger aria-label="Filtrar por estado" className="h-10 w-full rounded-xl border-border/50 bg-background/50 px-3 text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {!externalBranchId && (
            <div className="min-w-0 space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sucursal</span>
              <Select value={branchFilter} onValueChange={(v) => { setBranchFilter(v); setPage(1); }}>
                <SelectTrigger aria-label="Filtrar por sucursal" className="h-10 w-full rounded-xl border-border/50 bg-background/50 px-3 text-xs"><SelectValue placeholder="Sucursal" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las sucursales</SelectItem>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="min-w-0 space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Corte temporal</span>
            <Select value={monthCutoff || '__none'} onValueChange={(v) => { setMonthCutoff(v === '__none' ? '' : v); setPage(1); }}>
              <SelectTrigger aria-label="Filtrar por corte mensual" className="h-10 w-full rounded-xl border-border/50 bg-background/50 px-3 text-xs"><SelectValue placeholder="Corte por mes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Sin corte (actual)</SelectItem>
                {monthOptions.map((mo) => <SelectItem key={mo.value} value={mo.value}>{mo.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="order-3 flex flex-col gap-2 border-t border-border/40 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] text-muted-foreground">Los resultados se actualizan al cambiar la búsqueda o cualquier filtro.</p>
          {hasActiveFilters && <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-8 w-fit gap-1.5 rounded-lg px-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground"><X className="size-3.5" /> Limpiar filtros</Button>}
        </div>
      </div>

      <Card className="overflow-hidden rounded-2xl border-border/50 shadow-sm">
        <CardContent className="p-4">
          {cutoffDate && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge className="gap-1 text-[10px]">
                <CalendarClock className="size-3" /> Activos al corte {cutoffDate.toLocaleDateString('es-NI', { day: '2-digit', month: 'long', year: 'numeric' })}
              </Badge>
              <p className="text-[10px] text-muted-foreground">Se listan los bienes adquiridos hasta esa fecha; los activos sin fecha se incluyen como existentes.</p>
            </div>
          )}
          {effectiveSummary && (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total de activos</p>
                <p className="text-xl font-black tabular-nums">{effectiveSummary.totalAssets ?? displayTotal}</p>
              </div>
              {canViewInventoryCost && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Valor total ({effectiveSummary.baseCurrency || 'USD'})</p>
                <p className="text-xl font-black tabular-nums">
                  {effectiveSummary.baseCurrency === 'NIO' ? 'C$' : '$'} {fmtCost(Number(effectiveSummary.totalCostBase || 0))}
                </p>
                <p className="text-[9px] text-muted-foreground">Convertido con la tasa de cada activo</p>
              </div>}
              {canViewInventoryCost && <div className="rounded-xl border border-border/40 bg-muted/10 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Desglose por moneda</p>
                <p className="text-sm font-black tabular-nums">
                  <span className="text-amber-600">C$ {fmtCost(Number(effectiveSummary.perCurrency?.NIO || 0))}</span>
                  <span className="mx-1.5 text-muted-foreground">·</span>
                  <span className="text-emerald-600">$ {fmtCost(Number(effectiveSummary.perCurrency?.USD || 0))}</span>
                </p>
                <p className="text-[9px] text-muted-foreground">Costo original de cada registro</p>
              </div>}
            </div>
          )}
          {loading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground"><Loader2 className="size-5 animate-spin mr-2" /> Cargando...</div>
          ) : assets.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-muted-foreground">
              <Building2 className="size-9 mb-2 opacity-40" />
              <p className="text-sm">Sin activos registrados</p>
              <div className="flex items-center gap-2">
                <Button variant="link" size="sm" onClick={openCreate}>Registrar el primer activo</Button>
                <Button variant="link" size="sm" onClick={() => downloadTemplate(canViewInventoryCost)}>Descargar plantilla</Button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent border-border/50">
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-[100px]">Código</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nombre</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Categoría</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Sucursal</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">Responsable</TableHead>
                      {canViewInventoryCost && <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right w-[150px]">Costo</TableHead>}
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estado</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center w-[60px]">Factura</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right w-[110px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedAssets.map(asset => (
                      <TableRow key={asset.id} className="border-b border-muted/30 hover:bg-muted/10">
                        <TableCell className="py-2 px-2 font-mono text-xs">{asset.code}</TableCell>
                        <TableCell className="py-2 px-2">
                          <p className="text-sm font-semibold leading-tight">{asset.name}</p>
                          {asset.model ? <p className="text-[10px] text-muted-foreground">{asset.brand ? `${asset.brand} · ` : ''}{asset.model}{asset.serialNumber ? ` · ${asset.serialNumber}` : ''}</p> : null}
                        </TableCell>
                        <TableCell className="py-2 px-2 hidden lg:table-cell">
                          <Badge className={cn("text-[10px] border", CATEGORY_BADGES[asset.category] || CATEGORY_BADGES.OTHER)}>{asset.categoryLabel || categoryLabelOf(asset.category)}</Badge>
                        </TableCell>
                        <TableCell className="py-2 px-2 hidden md:table-cell text-xs text-muted-foreground">{branchNameOf(asset.branchId)}</TableCell>
                        <TableCell className="py-2 px-2 hidden xl:table-cell text-xs">{userNameOf(asset.responsibleUserId)}</TableCell>
                         {canViewInventoryCost && <TableCell className="py-2 px-2">{renderCostCell(asset)}</TableCell>}
                        <TableCell className="py-2 px-2">
                          <Badge className={cn("text-[10px] border", STATUS_BADGES[asset.status] || STATUS_BADGES.AVAILABLE)}>{asset.statusLabel || statusLabelOf(asset.status)}</Badge>
                        </TableCell>
                        <TableCell className="py-2 px-2 text-center">
                          {asset.attachmentUrl ? (
                            <div className="flex items-center justify-center gap-1">
                              <a href={asset.attachmentUrl} target="_blank" rel="noreferrer" title={asset.attachmentName || 'Ver respaldo'} className="text-primary hover:underline inline-flex items-center gap-0.5">
                                <Paperclip className="size-3.5" />
                              </a>
                              <button onClick={() => handleRemoveAttachment(asset)} title="Quitar respaldo" className="text-muted-foreground hover:text-red-500">
                                <X className="size-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => document.getElementById(`asset-file-${asset.id}`)?.click()}
                              disabled={attachmentBusy}
                              title="Adjuntar factura de compra"
                              className="text-muted-foreground hover:text-primary disabled:opacity-40"
                            >
                              <Paperclip className="size-3.5" />
                            </button>
                          )}
                          <input
                            id={`asset-file-${asset.id}`}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            className="hidden"
                            onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) handleAttachFile(asset, f);
                              e.target.value = '';
                            }}
                          />
                        </TableCell>
                        <TableCell className="py-2 px-2">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(asset)}><Pencil className="size-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="size-7 text-red-500" onClick={() => setDeleteTarget(asset)}><Trash2 className="size-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-4 py-2">
                <p className="text-[10px] text-muted-foreground">{displayTotal} activo(s)</p>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                  <span className="px-2 text-[10px] text-muted-foreground">{page} / {displayTotalPages}</span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={page >= displayTotalPages || loading} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] !max-w-[min(92vw,760px)] max-h-[min(88vh,calc(100dvh-3rem))] overflow-y-auto">
          <DialogHeader data-tour="mobiliario-form-title">
            <DialogTitle>{editing ? `Editar activo: ${editing.code}` : 'Registrar activo (Mobiliario y Equipos)'}</DialogTitle>
            <DialogDescription>Control operativo del bien. La contabilización (costo, depreciación) se hace desde Contabilidad → Activos Fijos.</DialogDescription>
            <InventoryViewTutorial label={editing ? 'Cómo editar activo' : 'Cómo registrar activo'} targetPrefix="mobiliario-form" copy={{ data: { description: 'Completa identificación, categoría, estado, ubicación, responsable, proveedor, costo y respaldo.' }, actions: { description: 'Guarda los cambios o registra el nuevo activo en el control de mobiliario.' } }} />
          </DialogHeader>
          <div className="space-y-4 py-2" data-tour="mobiliario-form-data">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="asset-code">Código interno</Label>
                <Input id="asset-code" value={form.code} onChange={e => set('code', e.target.value)} placeholder="ME-0001 (vacío = auto)" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="asset-name">Nombre *</Label>
                <Input id="asset-name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Computadora Dell XPS" />
              </div>
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select value={form.category} onValueChange={v => set('category', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={form.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Marca</Label>
                <Input value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="Dell, Toyota, LG..." />
              </div>
              <div className="space-y-2">
                <Label>Modelo</Label>
                <Input value={form.model} onChange={e => set('model', e.target.value)} placeholder="XPS 15" />
              </div>
              <div className="space-y-2">
                <Label>Número de serie</Label>
                <Input value={form.serialNumber} onChange={e => set('serialNumber', e.target.value)} placeholder="SN-123456" />
              </div>
              <div className="space-y-2">
                <Label>Fecha de adquisición</Label>
                <Input type="date" value={form.acquisitionDate} onChange={e => set('acquisitionDate', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Sucursal</Label>
                <Select value={form.branchId} onValueChange={v => set('branchId', v === '__none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Sin sucursal" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sin sucursal</SelectItem>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Responsable</Label>
                <Select value={form.responsibleUserId} onValueChange={v => set('responsibleUserId', v === '__none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Sin responsable" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Sin responsable</SelectItem>
                    {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ubicación</Label>
                <Input value={form.location} onChange={e => set('location', e.target.value)} placeholder="Oficina central, bodega 2..." />
              </div>
              <div className="space-y-2">
                <Label>Proveedor</Label>
                <Input value={form.supplier} onChange={e => set('supplier', e.target.value)} placeholder="Proveedor de compra" />
              </div>
              <div className="space-y-2">
                <Label>Número de factura / documento</Label>
                <Input value={form.documentNumber} onChange={e => set('documentNumber', e.target.value)} placeholder="FAC-2026-0001" />
              </div>
              {canViewInventoryCost && <div className="space-y-2">
                <Label>Costo</Label>
                <Input type="number" step="0.01" min="0" value={form.cost} onChange={e => set('cost', e.target.value)} />
              </div>}
              {canViewInventoryCost && <div className="space-y-2">
                <Label>Moneda del costo</Label>
                <Select value={form.currency} onValueChange={v => set('currency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>}
              {canViewInventoryCost && form.currency === 'NIO' && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Tasa de cambio (C$ por US$)</Label>
                  <Input type="number" step="0.01" min="0" value={form.exchangeRate} onChange={e => set('exchangeRate', e.target.value)} placeholder="Ej: 36.5 (se sugiere automáticamente)" />
                  {displayMode !== 'ORIGINAL' && <p className="text-[10px] text-muted-foreground">Se mostrará el costo también en dólares equivalentes.</p>}
                </div>
              )}
              {canViewInventoryCost && displayMode !== 'ORIGINAL' && form.currency === 'NIO' && form.cost && Number(form.cost) > 0 && form.exchangeRate && Number(form.exchangeRate) > 0 && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-700 sm:col-span-2">
                  Equivalente: <strong>$ {fmtCost(Number(form.cost) / Number(form.exchangeRate))} USD</strong>
                  <span className="text-muted-foreground"> · Costo: C$ {fmtCost(Number(form.cost))}</span>
                </div>
              )}
              {editing && editing.attachmentUrl && (
                <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2 sm:col-span-2">
                  <span className="flex min-w-0 items-center gap-2 text-[11px]">
                    <Paperclip className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate">{editing.attachmentName || 'Respaldo adjunto'}</span>
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <a href={editing.attachmentUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-primary hover:underline inline-flex items-center gap-1"><ExternalLink className="size-3" /> Ver</a>
                    <button onClick={() => handleRemoveAttachment(editing)} className="text-[10px] font-bold text-red-500 hover:underline">Quitar</button>
                  </div>
                </div>
              )}
              <div className="space-y-2 sm:col-span-2">
                <Label>Descripción</Label>
                <Input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Descripción del bien" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Observaciones</Label>
                <Input value={form.observations} onChange={e => set('observations', e.target.value)} placeholder="Notas adicionales" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0" data-tour="mobiliario-form-actions">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin mr-1" /> : null} {editing ? 'Guardar cambios' : 'Registrar activo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={(open) => { if (!open && !importing) { setImportOpen(false); setImportResult(null); } }}>
        <DialogContent className="w-[calc(100vw-2rem)] !max-w-[min(92vw,760px)] max-h-[min(88vh,calc(100dvh-3rem))] overflow-y-auto">
          <DialogHeader data-tour="mobiliario-import-title">
            <DialogTitle>Importar Mobiliario y Equipos</DialogTitle>
            <DialogDescription>
              {importFileName} · {importRowsData.length} filas detectadas. Los códigos vacíos se asignan automáticamente; cada activo con costo mayor que 0 también se registra en Activos Fijos.
            </DialogDescription>
            <InventoryViewTutorial label="Cómo importar mobiliario" targetPrefix="mobiliario-import" copy={{ data: { description: 'Revisa el archivo, las filas detectadas y los errores antes de registrar los activos.' }, actions: { description: 'Confirma la importación para crear los activos válidos.' } }} />
          </DialogHeader>
          <div className="space-y-2">
            <Label>Mes del corte (fecha de adquisición)</Label>
            <Select value={importMonth} onValueChange={setImportMonth}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthOptions.map((mo) => <SelectItem key={mo.value} value={mo.value}>{mo.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">Los activos importados sin fecha de adquisición se registrarán el último día de este mes ({lastDayOfMonth(importMonth).toLocaleDateString('es-NI', { day: '2-digit', month: 'long', year: 'numeric' })}).</p>
          </div>
          {importResult ? (
            <div className="space-y-3" data-tour="mobiliario-import-data">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                  <p className="text-2xl font-black text-emerald-600">{importResult.createdCount ?? 0}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Activos creados</p>
                </div>
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-center">
                  <p className="text-2xl font-black text-blue-600">{importResult.fixedAssetCount ?? 0}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">En Activos Fijos</p>
                </div>
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-center">
                  <p className="text-2xl font-black text-rose-600">{importResult.skippedCount ?? 0}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Omitidos</p>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
                  <p className="text-2xl font-black text-amber-600">{importResult.fixedAssetSkippedCount ?? 0}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Sin Activo Fijo</p>
                </div>
              </div>
              {(importResult.fixedAssetSkipped || []).length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 scrollbar-overlay">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-amber-700">Revisión contable</p>
                  {(importResult.fixedAssetSkipped as any[]).map((item, i) => (
                    <div key={i} className="border-b border-amber-500/20 py-1.5 text-[11px] last:border-0">
                      <span className="mr-2 font-mono text-muted-foreground">Fila {item.row}</span>
                      <span className="text-amber-700">{item.error}</span>
                    </div>
                  ))}
                </div>
              )}
              {(importResult.skipped || []).length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-border/50 scrollbar-overlay">
                  {(importResult.skipped as any[]).map((s, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 border-b border-border/30 px-3 py-1.5 text-[11px] last:border-0">
                      <span className="shrink-0 font-mono text-muted-foreground">Fila {s.row}</span>
                      <span className="text-rose-600">{s.error}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="min-w-0 max-w-full rounded-xl border border-border/50" data-tour="mobiliario-import-data">
              <div className="flex items-center gap-2 border-b border-border/40 bg-muted/30 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <FileSpreadsheet className="size-3.5" /> Vista previa completa · {importRowsData.length} filas
              </div>
              <VirtualizedImportList count={importRowsData.length} estimateSize={34} className="h-64" renderItem={(i) => {
                const row = importRowsData[i];
                return <div className="flex items-center justify-between gap-2 border-b border-border/30 px-3 py-1.5 text-[11px] last:border-0">
                  <span className="min-w-0 truncate font-medium">{row.name || '—'}</span>
                  <span className="shrink-0 text-muted-foreground">{row.category}{canViewInventoryCost ? ` · ${row.currency || 'USD'} · ${row.cost || '0'}` : ''}</span>
                </div>;
              }} />
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0" data-tour="mobiliario-import-actions">
            {!importResult ? (
              <>
                <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>Cancelar</Button>
                <Button onClick={confirmImport} disabled={importing || importRowsData.length === 0}>
                  {importing ? <Loader2 className="size-4 animate-spin mr-1" /> : null} Importar {importRowsData.length} filas
                </Button>
              </>
            ) : (
              <Button onClick={() => { setImportOpen(false); setImportResult(null); }}>Cerrar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportProgressOverlay open={readingFile || importing} progress={readingFile ? readingProgress : importProgress} title={readingFile ? 'Preparando mobiliario y equipos' : 'Importando mobiliario y equipos'} description={readingFile ? 'Leyendo el archivo y preparando todas las filas para revisión.' : 'Validando y registrando los activos en una operación masiva.'} />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}
        title="¿Eliminar activo?"
        description={deleteTarget ? `${deleteTarget.code} · ${deleteTarget.name}. Este registro se eliminará permanentemente del control de Mobiliario y Equipos.` : ''}
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
