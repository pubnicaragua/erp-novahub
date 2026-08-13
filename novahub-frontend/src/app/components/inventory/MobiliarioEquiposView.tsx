import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Plus, Search, Pencil, Trash2, RefreshCw, Loader2, Building2, X, Upload, FileDown, Paperclip, ExternalLink, FileSpreadsheet } from 'lucide-react';
import { cn } from '../ui/utils';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { mobiliarioService } from '../../services/mobiliario.service';
import { storageService } from '../../services/storage.service';
import { api } from '../../services/api';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';
import { useCurrency } from '../../contexts/CurrencyContext';

const CATEGORIES = [
  { value: 'BUILDING', label: 'Edificios' },
  { value: 'VEHICLE', label: 'Vehículos' },
  { value: 'OFFICE_FURNITURE', label: 'Mobiliario y equipo de oficina' },
  { value: 'COMPUTER_EQUIPMENT', label: 'Equipos de cómputo' },
  { value: 'MACHINERY', label: 'Maquinaria y equipo' },
  { value: 'OTHER', label: 'Otros / Misceláneos' },
];

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

function downloadTemplate() {
  const rows = buildTemplateRows();
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...rows]);
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: TEMPLATE_HEADERS.length - 1 } });
  const totalRow = rows.length + 1; // fila 1 = encabezado, filas 2..51 = datos
  const totalCell = XLSX.utils.encode_cell({ r: totalRow - 1, c: 13 }); // columna Costo (N)
  ws[totalCell] = { t: 'n', f: `SUMA(N2:N${rows.length + 1})` };
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
  const headers = sheet[0].map((h, i) => {
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

export function MobiliarioEquiposView() {
  const queryClient = useQueryClient();
  const { baseCurrency, formatConvertedAmount } = useCurrency();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);

  const listQuery = useAccountingQuery<any>(['company-assets', search, categoryFilter, statusFilter, branchFilter, page, pageSize], async (signal) =>
    mobiliarioService.getAssets({
      search: search.trim() || undefined,
      category: categoryFilter === 'all' ? undefined : categoryFilter,
      status: statusFilter === 'all' ? undefined : statusFilter,
      branchId: branchFilter === 'all' ? undefined : branchFilter,
      page, pageSize,
    }, signal),
  );
  const branchesQuery = useAccountingQuery<any[]>(['sucursales'], async (signal) => accountingList(await api.get('/sucursales', { signal })));
  const usersQuery = useAccountingQuery<any[]>(['users-list'], async (signal) => accountingList(await api.get('/users', { signal })));

  const response = listQuery.data as any;
  const assets: AssetRow[] = Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
  const summary = response?.summary ?? null;
  const meta = response?.meta ?? { total: assets.length, page, pageSize, totalPages: Math.max(1, Math.ceil(assets.length / pageSize)) };
  const loading = listQuery.isLoading || listQuery.isFetching;
  const branches = (branchesQuery.data || []).map(b => ({ id: String(b.id), name: `${b.code || ''} ${b.name || ''}`.trim() }));
  const users = (usersQuery.data || []).map(u => ({ id: String(u.id), name: String(u.name || u.email || '') }));

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
  const [importResult, setImportResult] = useState<any>(null);

  // Respaldo
  const [attachmentBusy, setAttachmentBusy] = useState(false);

  useEffect(() => {
    if (!formOpen || form.currency !== 'NIO' || form.exchangeRate) return;
    api.get<any>('/tools/exchange-rate').then((res: any) => {
      const rate = res?.rate ?? (res as any)?.data?.rate;
      if (rate) set('exchangeRate', String(rate));
    }).catch(() => { /* tasa manual si no se puede obtener */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen, form.currency]);

  const set = (field: keyof FormState, value: string) => setForm(prev => ({ ...prev, [field]: value }));

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
      let saved;
      if (editing) saved = await mobiliarioService.updateAsset(editing.id, payload);
      else saved = await mobiliarioService.createAsset(payload);
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
      const uploaded = await storageService.uploadFile('company-assets', file, { folder: `assets/${asset.code}` });
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
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const sheet = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
      const rows = parseSheetRows(sheet);
      if (rows.length === 0) {
        toast.error('El archivo no contiene filas de datos');
        return;
      }
      setImportRowsData(rows);
      setImportFileName(file.name);
      setImportResult(null);
      setImportOpen(true);
    } catch (e: any) {
      toast.error('No se pudo leer el archivo Excel');
    }
  };

  const confirmImport = async () => {
    setImporting(true);
    try {
      const res = await mobiliarioService.importAssets(importRowsData);
      setImportResult(res);
      toast.success(`Importación completada: ${res?.createdCount ?? 0} creados, ${res?.skippedCount ?? 0} omitidos`);
      queryClient.invalidateQueries({ queryKey: ['accounting'] });
      listQuery.refetch();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo importar');
    } finally {
      setImporting(false);
    }
  };

  const fmtCost = (n: number) => n.toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const categoryLabelOf = (v: string) => CATEGORIES.find(c => c.value === v)?.label || v;
  const statusLabelOf = (v: string) => STATUSES.find(s => s.value === v)?.label || v;
  const branchNameOf = (id?: string | null) => branches.find(b => b.id === id)?.name || '—';
  const userNameOf = (id?: string | null) => users.find(u => u.id === id)?.name || '—';
  const currencySymbol = (c: string) => c === 'NIO' ? 'C$' : '$';

  const renderCostCell = (asset: AssetRow) => {
    const original = `${currencySymbol(asset.currency || 'USD')} ${fmtCost(asset.cost)}`;
    let equivalent: string | null = null;
    if (asset.currency !== baseCurrency) {
      try {
        equivalent = formatConvertedAmount(asset.cost, asset.currency as any, asset.exchangeRate ?? undefined);
      } catch { equivalent = null; }
    }
    return (
      <div className="text-right">
        <p className="font-mono text-xs">{original}</p>
        {equivalent && <p className="font-mono text-[10px] text-muted-foreground">≈ {equivalent}</p>}
      </div>
    );
  };

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-5 bg-muted/30 rounded-2xl border border-border/50 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-[0.2em] bg-background/50 px-3 py-1.5 rounded-lg border border-border/30 shrink-0">
          <Building2 className="size-3.5" /> Activos de la empresa
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:gap-4">
          <div className="relative min-w-0 sm:col-span-2 lg:flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar por nombre, código, serie, marca..." className="h-9 pl-9" />
          </div>
          <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
            <option value="all">Todas las categorías</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
            <option value="all">Todos los estados</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <select value={branchFilter} onChange={e => { setBranchFilter(e.target.value); setPage(1); }} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
            <option value="all">Todas las sucursales</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="lg:ml-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-border/20 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => listQuery.refetch()} disabled={loading} className="h-9">
            <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="h-9 gap-1.5">
            <FileDown className="size-4" /> Plantilla
          </Button>
          <Button variant="outline" size="sm" onClick={() => document.getElementById('mobiliario-import-file')?.click()} className="h-9 gap-1.5">
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
          <Button size="sm" onClick={openCreate} className="h-9 gap-1.5">
            <Plus className="size-4" /> Nuevo activo
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Building2 className="size-5 text-primary" /> Mobiliario y Equipos
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Bienes propiedad de la empresa que no son mercancías para la venta. El costo puede registrarse en Córdobas o Dólares (con tasa de cambio) y puedes adjuntar la factura de compra como respaldo. La contabilización (costo, depreciación) la maneja Contabilidad → Activos Fijos.
          </p>
        </CardHeader>
        <CardContent className="p-4">
          {summary && (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total de activos</p>
                <p className="text-xl font-black tabular-nums">{summary.totalAssets ?? meta.total}</p>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Valor total ({summary.baseCurrency || 'USD'})</p>
                <p className="text-xl font-black tabular-nums">
                  {summary.baseCurrency === 'NIO' ? 'C$' : '$'} {fmtCost(Number(summary.totalCostBase || 0))}
                </p>
                <p className="text-[9px] text-muted-foreground">Convertido con la tasa de cada activo</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/10 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Desglose por moneda</p>
                <p className="text-sm font-black tabular-nums">
                  <span className="text-amber-600">C$ {fmtCost(Number(summary.perCurrency?.NIO || 0))}</span>
                  <span className="mx-1.5 text-muted-foreground">·</span>
                  <span className="text-emerald-600">$ {fmtCost(Number(summary.perCurrency?.USD || 0))}</span>
                </p>
                <p className="text-[9px] text-muted-foreground">Costo original de cada registro</p>
              </div>
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
                <Button variant="link" size="sm" onClick={downloadTemplate}>Descargar plantilla</Button>
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
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right w-[150px]">Costo</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estado</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center w-[60px]">Factura</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-right w-[110px]">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assets.map(asset => (
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
                        <TableCell className="py-2 px-2">{renderCostCell(asset)}</TableCell>
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
                <p className="text-[10px] text-muted-foreground">{meta.total} activo(s)</p>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                  <span className="px-2 text-[10px] text-muted-foreground">{page} / {Math.max(1, meta.totalPages)}</span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={page >= (meta.totalPages || 1) || loading} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar activo: ${editing.code}` : 'Registrar activo (Mobiliario y Equipos)'}</DialogTitle>
            <DialogDescription>Control operativo del bien. La contabilización (costo, depreciación) se hace desde Contabilidad → Activos Fijos.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
              <div className="space-y-2">
                <Label>Costo</Label>
                <Input type="number" step="0.01" min="0" value={form.cost} onChange={e => set('cost', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Moneda del costo</Label>
                <Select value={form.currency} onValueChange={v => set('currency', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.currency === 'NIO' && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Tasa de cambio (C$ por US$)</Label>
                  <Input type="number" step="0.01" min="0" value={form.exchangeRate} onChange={e => set('exchangeRate', e.target.value)} placeholder="Ej: 36.5 (se sugiere automáticamente)" />
                  <p className="text-[10px] text-muted-foreground">Se mostrará el costo también en dólares equivalentes.</p>
                </div>
              )}
              {form.currency === 'NIO' && form.cost && Number(form.cost) > 0 && form.exchangeRate && Number(form.exchangeRate) > 0 && (
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
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin mr-1" /> : null} {editing ? 'Guardar cambios' : 'Registrar activo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={(open) => { if (!open && !importing) { setImportOpen(false); setImportResult(null); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Mobiliario y Equipos</DialogTitle>
            <DialogDescription>
              {importFileName} · {importRowsData.length} filas detectadas. Los códigos vacíos se asignan automáticamente; las filas con errores se omiten sin afectar al resto.
            </DialogDescription>
          </DialogHeader>
          {importResult ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
                  <p className="text-2xl font-black text-emerald-600">{importResult.createdCount ?? 0}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Creados</p>
                </div>
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-center">
                  <p className="text-2xl font-black text-rose-600">{importResult.skippedCount ?? 0}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Omitidos</p>
                </div>
              </div>
              {(importResult.skipped || []).length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-border/50">
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
            <div className="max-h-72 overflow-y-auto rounded-xl border border-border/50">
              <div className="flex items-center gap-2 border-b border-border/40 bg-muted/30 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <FileSpreadsheet className="size-3.5" /> Vista previa (primeras filas)
              </div>
              {importRowsData.slice(0, 8).map((row, i) => (
                <div key={i} className="flex items-center justify-between gap-2 border-b border-border/30 px-3 py-1.5 text-[11px] last:border-0">
                  <span className="min-w-0 truncate font-medium">{row.name || '—'}</span>
                  <span className="shrink-0 text-muted-foreground">{row.category} · {row.currency || 'USD'} · {row.cost || '0'}</span>
                </div>
              ))}
              {importRowsData.length > 8 && <p className="px-3 py-1.5 text-[10px] text-muted-foreground">...y {importRowsData.length - 8} filas más</p>}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
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
