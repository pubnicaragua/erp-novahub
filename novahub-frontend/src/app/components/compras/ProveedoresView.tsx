import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Truck, Plus, Search, Eye, Trash2, TrendingDown, CheckCircle2, ArrowUpDown, RefreshCw, Upload, Download, Ban, Pencil } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { suppliersService } from '../../services/compras.service';
import type { Supplier, EntityStatus } from '../../types';
import type { SalesPaginationControls } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { SupplierHistoryModal } from './SupplierHistoryModal';
import { useCurrency } from '../../contexts/CurrencyContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { PurchaseKpiCard } from './PurchaseKpiCard';
import { PurchaseViewTutorial } from './PurchaseViewTutorial';
import { SupplierImportPreview, type SupplierImportResult, type SupplierImportRow } from './SupplierImportPreview';

interface ProveedoresViewProps { data: Supplier[]; loading: boolean; onRefresh: () => void; pagination?: SalesPaginationControls; onSearchChange?: (value: string) => void; isSidebarCollapsed?: boolean; }

const emptyDraft = () => ({
  code: '',
  name: '',
  contactName: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  country: '',
  status: 'ACTIVE' as EntityStatus,
});

const isSupplierInactive = (s: Supplier) => s.isActive === false || String((s as any).status || '').toUpperCase() === 'INACTIVE';

export function ProveedoresView({ data, loading, onRefresh, pagination, onSearchChange, isSidebarCollapsed = true }: ProveedoresViewProps) {
  const { canPerform } = useAuth();
  const { baseCurrency, valuationModeSuffix, formatConvertedAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('purchases-suppliers-layout', 'table', 24 * 365);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [balanceOrder, setBalanceOrder] = useState<'all' | 'highest' | 'lowest'>('all');
  const [pendingToggle, setPendingToggle] = useState<Supplier | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedSupplierForHistory, setSelectedSupplierForHistory] = useState<Supplier | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<SupplierImportRow[]>([]);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<SupplierImportResult | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [saving, setSaving] = useState(false);

  const filtered = data.filter(s => {
    const isActive = s.isActive !== false && String((s as any).status || '').toUpperCase() !== 'INACTIVE';
    if (statusFilter === 'ACTIVE' && !isActive) return false;
    if (statusFilter === 'INACTIVE' && isActive) return false;
    const search = searchTerm.toLowerCase();
    return (
      String(s.name || '').toLowerCase().includes(search) ||
      (s.email || '').toLowerCase().includes(search) ||
      (s.code || '').toLowerCase().includes(search) ||
      (s.phone || '').toLowerCase().includes(search)
    );
  });

  const normalizeHeader = (value: unknown) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_/-]+/g, '');
  const getCell = (row: Record<string, any>, aliases: string[]) => {
    const match = aliases.map(normalizeHeader).find((alias) => Object.prototype.hasOwnProperty.call(row, alias));
    return match ? row[match] : '';
  };

  const emptyImportRow = (): SupplierImportRow => ({
    code: '', name: '', taxId: '', contactName: '', email: '', phone: '', address: '', city: '', country: 'Nicaragua', paymentTerms: '', status: 'ACTIVE',
  });

  const validateImportRows = (rows: SupplierImportRow[]) => {
    const existingCodes = new Set(data.map((supplier) => String(supplier.code || '').trim().toLowerCase()).filter(Boolean));
    const existingEmails = new Set(data.map((supplier) => String(supplier.email || '').trim().toLowerCase()).filter(Boolean));
    const existingTaxIds = new Set(data.map((supplier) => String(supplier.taxId || '').trim().toLowerCase()).filter(Boolean));
    const seenCodes = new Set<string>();
    const seenEmails = new Set<string>();
    const seenTaxIds = new Set<string>();
    return rows.map((row) => {
      const next: SupplierImportRow = { ...row, error: undefined, warning: undefined };
      const code = row.code.trim().toLowerCase();
      const email = row.email.trim().toLowerCase();
      const taxId = row.taxId.trim().toLowerCase();
      if (!row.name.trim()) next.error = 'Nombre obligatorio';
      else if (code && (existingCodes.has(code) || seenCodes.has(code))) next.error = 'Código duplicado';
      else if (email && !/^\S+@\S+\.\S+$/.test(email)) next.error = 'Correo inválido';
      else if (email && (existingEmails.has(email) || seenEmails.has(email))) next.error = 'Correo duplicado';
      else if (taxId && (existingTaxIds.has(taxId) || seenTaxIds.has(taxId))) next.error = 'Identificación fiscal duplicada';
      if (!next.error && !code) next.warning = 'Se generará el código automáticamente';
      if (code) { existingCodes.add(code); seenCodes.add(code); }
      if (email) { existingEmails.add(email); seenEmails.add(email); }
      if (taxId) { existingTaxIds.add(taxId); seenTaxIds.add(taxId); }
      return next;
    });
  };

  const downloadTemplate = () => {
    const headers = ['Código', 'Nombre', 'RUC / identificación', 'Persona de contacto', 'Correo', 'Teléfono', 'Dirección', 'Ciudad', 'País', 'Condiciones de pago', 'Estado'];
    const example = ['PRV-000001', 'Proveedor Ejemplo', 'J0310000000000', 'María López', 'proveedor@correo.com', '8888-1111', 'Managua', 'Managua', 'Nicaragua', 'Contado', 'ACTIVO'];
    const sheet = XLSX.utils.aoa_to_sheet([headers, example]);
    sheet['!cols'] = headers.map((header) => ({ wch: Math.max(16, Math.min(30, header.length + 4)) }));
    const guide = XLSX.utils.aoa_to_sheet([
      ['GUÍA DE LLENADO · IMPORTACIÓN DE PROVEEDORES'],
      ['Puedes repetir la importación. El código es opcional; si lo omites, el sistema lo genera automáticamente.'],
      ['Campo', 'Regla'],
      ['Código', 'Opcional. No se puede repetir dentro de la empresa.'],
      ['Nombre', 'Obligatorio. Es el nombre comercial o razón social del proveedor.'],
      ['RUC / identificación', 'Opcional. No se puede repetir dentro de la empresa.'],
      ['Correo', 'Opcional, pero debe tener formato válido y no estar registrado.'],
      ['Contacto y ubicación', 'Completa persona de contacto, teléfono, dirección, ciudad y país cuando aplique.'],
      ['Condiciones de pago', 'Opcional. Ejemplos: Contado, 30 días, crédito.'],
      ['Estado', 'Usa ACTIVO o INACTIVO.'],
      ['Previsualización', 'Después de cargar el archivo podrás corregir los datos y revisar los errores antes de guardar.'],
    ]);
    guide['!cols'] = [{ wch: 30 }, { wch: 110 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Proveedores');
    XLSX.utils.book_append_sheet(workbook, guide, 'Guía de llenado');
    XLSX.writeFile(workbook, 'plantilla_proveedores.xlsx');
    toast.success('Plantilla descargada');
  };

  const readImportFile = async (file: File) => {
    try {
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('Solo se permiten archivos Excel (.xlsx, .xls) o CSV');
      const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
      const sheetName = workbook.SheetNames.find((name) => normalizeHeader(name) === 'proveedores') || workbook.SheetNames[0];
      const rawSheet = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], { header: 1, defval: '' });
      const raw = rawSheet[0]?.length === 1 && String(rawSheet[0][0] || '').toLowerCase().startsWith('sep=') ? rawSheet.slice(1) : rawSheet;
      if (raw.length < 2) throw new Error('El archivo no contiene filas para importar');
      const headers = (raw[0] || []).map(normalizeHeader);
      const parsed = raw.slice(1).filter((row: any[]) => row.some((cell) => String(cell ?? '').trim())).map((values: any[]) => {
        const source: Record<string, any> = {};
        headers.forEach((header: string, index: number) => { source[header] = values[index] ?? ''; });
        const row = emptyImportRow();
        row.code = String(getCell(source, ['codigo', 'code', 'codigoproveedor']) || '').trim();
        row.name = String(getCell(source, ['nombre', 'name', 'proveedor', 'razonsocial']) || '').trim();
        row.taxId = String(getCell(source, ['ruc', 'identificacion', 'identificacionfiscal', 'taxid']) || '').trim();
        row.contactName = String(getCell(source, ['personadecontacto', 'contacto', 'contactname']) || '').trim();
        row.email = String(getCell(source, ['correo', 'email']) || '').trim();
        row.phone = String(getCell(source, ['telefono', 'phone']) || '').trim();
        row.address = String(getCell(source, ['direccion', 'address']) || '').trim();
        row.city = String(getCell(source, ['ciudad', 'city']) || '').trim();
        row.country = String(getCell(source, ['pais', 'country']) || 'Nicaragua').trim();
        row.paymentTerms = String(getCell(source, ['condicionesdepago', 'condiciones', 'paymentterms']) || '').trim();
        const status = normalizeHeader(getCell(source, ['estado', 'status']) || 'activo');
        row.status = status.includes('inactiv') ? 'INACTIVE' : 'ACTIVE';
        return row;
      });
      setImportFile(file);
      setImportRows(validateImportRows(parsed));
      setImportResult(null);
      toast.success(`${parsed.length} proveedores listos para previsualizar`);
    } catch (error: any) {
      setImportFile(null);
      setImportRows([]);
      toast.error(error?.message || 'No se pudo leer el archivo');
    }
  };

  const updateImportRow = (index: number, field: keyof SupplierImportRow, value: string) => {
    setImportRows((current) => validateImportRows(current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row)));
  };

  const executeImport = async () => {
    const validRows = importRows.filter((row) => !row.error);
    if (!validRows.length) return;
    setImporting(true);
    setImportProgress(8);
    setImportResult(null);
    let timer: ReturnType<typeof setInterval> | null = null;
    try {
      timer = setInterval(() => setImportProgress((current) => Math.min(92, current + 3)), 180);
      const result = await suppliersService.importMassive({
        rows: validRows.map(({ error: _error, warning: _warning, ...row }) => ({ ...row, code: row.code || undefined })),
      });
      if (timer) clearInterval(timer);
      setImportProgress(100);
      setImportResult(result);
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo importar proveedores');
    } finally {
      if (timer) clearInterval(timer);
      setImporting(false);
      setImportProgress(0);
    }
  };

  const finishImport = () => {
    setImportResult(null);
    setImportPreviewOpen(false);
    setImportRows([]);
    setImportFile(null);
    setImportOpen(false);
  };

  const filteredAndSorted = [...filtered].sort((a, b) => {
    if (balanceOrder === 'highest') return Number(b.balance || 0) - Number(a.balance || 0);
    if (balanceOrder === 'lowest') return Number(a.balance || 0) - Number(b.balance || 0);
    return 0;
  });

  const statusOptions = [
    { label: 'Activo',   value: 'ACTIVE',   color: 'bg-emerald-500/10 text-emerald-500' },
    { label: 'Inactivo', value: 'INACTIVE', color: 'bg-muted/20 text-muted-foreground' },
  ];

  const columns: ColumnDef<Supplier>[] = [
    { key: 'code',        header: 'Código',    width: '110px', editable: canPerform('proveedores', 'edit') },
    { key: 'name',        header: 'Nombre',    editable: canPerform('proveedores', 'edit') },
    { key: 'contactName', header: 'Contacto',  editable: canPerform('proveedores', 'edit') },
    { key: 'email',       header: 'Email',     editable: canPerform('proveedores', 'edit') },
    { key: 'phone',       header: 'Teléfono',  width: '130px', editable: canPerform('proveedores', 'edit') },
    { key: 'balance', header: 'Saldo', width: '170px',
      render: (val) => <span className="font-black text-rose-500 tabular-nums">{formatConvertedAmount(val || 0, baseCurrency)}</span>
    },
    { key: 'status', header: 'Estado', width: '120px',
      render: (val) => {
        const opt = statusOptions.find(o => o.value === (val||'').toUpperCase());
        return <Badge variant="outline" className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none', opt?.color || 'bg-muted/20 text-muted-foreground')}>{opt?.label || val}</Badge>;
      }
    },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Supplier>) => {
    try { 
      const sanitized: any = { ...updates };
      if (sanitized.email === '') sanitized.email = undefined;
      if (sanitized.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized.email)) {
        toast.error('Correo electrónico inválido. Ingresa un email con formato válido (ej: proveedor@correo.com)');
        throw new Error('Email inválido');
      }
      await suppliersService.update(id as string, sanitized); 
      toast.success('Proveedor actualizado'); 
      onRefresh(); 
    }
    catch (e: any) { 
      if (e.message === 'Email inválido') throw e;
      const msg = e?.response?.data?.message || e?.message || '';
      if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('correo')) {
        toast.error('Correo electrónico inválido. Verifica el formato del email ingresado.');
      } else {
        toast.error('Error al actualizar: ' + msg);
      }
      throw e;
    }
  };

  const handleAdd = () => {
    setDraft(emptyDraft());
    setEditingSupplier(null);
    setCreateOpen(true);
  };

  const handleOpenEdit = (row: Supplier) => {
    setEditingSupplier(row);
    setDraft({
      code: row.code || '',
      name: row.name || '',
      contactName: row.contactName || '',
      email: row.email || '',
      phone: row.phone || '',
      address: row.address || '',
      city: row.city || '',
      country: row.country || '',
      status: String(row.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    });
    setEditOpen(true);
  };

  const buildPayload = () => {
    const payload: any = {
      name: draft.name,
      contactName: draft.contactName || undefined,
      email: draft.email || undefined,
      phone: draft.phone || undefined,
      address: draft.address || undefined,
      city: draft.city || undefined,
      country: draft.country || undefined,
      status: draft.status,
    };
    if (!editingSupplier) payload.code = draft.code || undefined;
    return payload;
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      toast.error('El nombre del proveedor es obligatorio');
      return;
    }
    if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
      toast.error('Correo electrónico inválido. Ingresa un email con formato válido (ej: proveedor@correo.com)');
      return;
    }
    setSaving(true);
    try {
      if (editingSupplier) {
        await suppliersService.update(editingSupplier.id, buildPayload());
      } else {
        await suppliersService.create(buildPayload());
      }
      toast.success(editingSupplier ? 'Proveedor actualizado' : 'Proveedor creado');
      setCreateOpen(false);
      setEditOpen(false);
      setEditingSupplier(null);
      onRefresh();
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Error al guardar proveedor';
      toast.error(msg.toLowerCase().includes('email') || msg.toLowerCase().includes('correo') ? 'Correo electrónico inválido. Verifica el formato del email ingresado.' : msg);
    } finally {
      setSaving(false);
    }
  };

  const kpis = [
    { title: 'Total',     value: data.length,                                                                              icon: Truck,         color: 'text-blue-500',    bg: 'bg-blue-500/10', kind: 'indicator' as const },
    { title: 'Activos',   value: data.filter(s => s.isActive !== false && String((s as any).status || '').toUpperCase() !== 'INACTIVE').length, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', kind: 'filter' as const, filter: 'ACTIVE' as const },
    { title: `Saldo Total${valuationModeSuffix}`, value: formatConvertedAmount(data.reduce((a, s) => a + Number(s.balance||0), 0), baseCurrency),       icon: TrendingDown,  color: 'text-rose-500',    bg: 'bg-rose-500/10', kind: 'indicator' as const },
  ];

  if (importPreviewOpen) {
    return <SupplierImportPreview rows={importRows} fileName={importFile?.name || ''} isSidebarCollapsed={isSidebarCollapsed} importing={importing} progress={importProgress} result={importResult} onRowUpdate={updateImportRow} onBack={() => { setImportPreviewOpen(false); setImportOpen(true); }} onConfirm={executeImport} onDone={finishImport} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-tour="purchases-list-kpis">
        {kpis.map((k, i) => (
          <PurchaseKpiCard key={i} title={k.title} value={k.value} icon={k.icon} color={k.color} bg={k.bg} kind={k.kind} active={k.filter === statusFilter} onClick={k.filter ? () => setStatusFilter(statusFilter === k.filter ? 'ALL' : k.filter) : undefined} />
        ))}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight" data-tour="purchases-list-title">Proveedores</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Directorio de proveedores y aliados</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3" data-tour="purchases-list-actions">
            <PurchaseViewTutorial view="suppliers" />
            <ViewLayoutSelect value={layoutMode} onChange={setLayoutMode} ariaLabel="Elegir distribución de proveedores" />
            <Select value={balanceOrder} onValueChange={(value: 'all' | 'highest' | 'lowest') => setBalanceOrder(value)}>
              <SelectTrigger className="h-10 w-full sm:w-44 rounded-xl text-[10px] font-black uppercase tracking-widest">
                <ArrowUpDown className="mr-2 size-4 shrink-0" />
                <SelectValue placeholder="Ordenar saldo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Sin ordenar</SelectItem>
                <SelectItem value="highest">Mayor saldo</SelectItem>
                <SelectItem value="lowest">Menor saldo</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input placeholder="Buscar proveedor..." className="pl-9 h-10 w-60 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }} />
            </div>
            {canPerform('proveedores', 'create') && (
              <Button
                variant="outline"
                onClick={() => { setImportOpen(true); setImportPreviewOpen(false); setImportRows([]); setImportFile(null); setImportResult(null); }}
                className="font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"
              >
                <Upload className="size-4" /> Importar
              </Button>
            )}
            {canPerform('proveedores', 'create') && (
              <Button onClick={handleAdd} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-sm hover:shadow-md transition-all">
                <Plus className="size-4" /> Nuevo Proveedor
              </Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filteredAndSorted} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} pagination={pagination} layoutMode={layoutMode}
          onAddRow={canPerform('proveedores', 'create') ? handleAdd : undefined}
          bulkActions={(ids) => (
            <Button variant="destructive" size="sm" className="h-8 text-[10px] font-black uppercase tracking-wider"
              onClick={async () => {
                await Promise.all(ids.map(id => handleUpdate(id, { isActive: false, status: 'INACTIVE' } as any)));
                toast.success(`${ids.length} proveedor(es) desactivado(s)`);
                onRefresh();
              }}
            >
              <Ban className="size-3 mr-2" /> Desactivar {ids.length}
            </Button>
          )}
          actions={(row) => (
            <div className="flex gap-1">
              <Button title="Ver Historial" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setSelectedSupplierForHistory(row)}><Eye className="size-4" /></Button>
              {canPerform('proveedores', 'edit') && (
                <Button title="Editar proveedor" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => handleOpenEdit(row)}><Pencil className="size-4" /></Button>
              )}
              {canPerform('proveedores', 'delete') && (
                <Button title={isSupplierInactive(row) ? 'Activar proveedor' : 'Desactivar proveedor'} variant="ghost" size="icon" className={`size-8 rounded-lg ${isSupplierInactive(row) ? 'hover:bg-emerald-500/10 hover:text-emerald-500' : 'hover:bg-rose-500/10 hover:text-rose-500'}`} onClick={() => setPendingToggle(row)}>{isSupplierInactive(row) ? <CheckCircle2 className="size-4" /> : <Ban className="size-4" />}</Button>
              )}
            </div>
          )}
        />
      </div>

      <ConfirmDialog
        open={pendingToggle !== null}
        onOpenChange={(open) => { if (!open) setPendingToggle(null); }}
        title={pendingToggle && isSupplierInactive(pendingToggle) ? '¿Activar proveedor?' : '¿Desactivar proveedor?'}
        description={pendingToggle && isSupplierInactive(pendingToggle)
          ? 'El proveedor volverá a estar disponible en las operaciones.'
          : 'El proveedor quedará inactivo y no aparecerá en selecciones futuras.'}
        confirmLabel={pendingToggle && isSupplierInactive(pendingToggle) ? 'Activar' : 'Desactivar'}
        variant={pendingToggle && isSupplierInactive(pendingToggle) ? 'default' : 'destructive'}
        loading={deleteLoading}
        onConfirm={async () => {
          if (!pendingToggle) return;
          const activating = isSupplierInactive(pendingToggle);
          try {
            setDeleteLoading(true);
            await suppliersService.update(pendingToggle.id, { isActive: !activating, status: activating ? 'ACTIVE' : 'INACTIVE' } as any);
            toast.success(activating ? 'Proveedor activado correctamente' : 'Proveedor desactivado correctamente');
            onRefresh();
          } catch (error: any) {
            toast.error(`Error al ${activating ? 'activar' : 'desactivar'} proveedor: ${error?.response?.data?.message || error?.message || ''}`);
          } finally {
            setDeleteLoading(false);
            setPendingToggle(null);
          }
        }}
      />

      <Dialog open={importOpen} onOpenChange={(open) => { if (!open && !importing) { setImportRows([]); setImportFile(null); } setImportOpen(open); }}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Upload className="size-4" /> Importar proveedores</DialogTitle><DialogDescription>Carga una plantilla Excel o CSV. Luego abre la previsualización completa para corregir los datos antes de crear los proveedores.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-4 text-xs text-muted-foreground"><p className="font-black uppercase tracking-widest text-foreground">Antes de cargar</p><p className="mt-2">El código es opcional y se genera automáticamente si lo dejas vacío. Los códigos, correos e identificaciones repetidas se marcarán como errores. Podrás editar cada fila antes de confirmar.</p><Button variant="outline" size="sm" className="mt-3 gap-2" onClick={downloadTemplate}><Download className="size-4" /> Descargar plantilla Excel</Button></div>
            <div className="space-y-2"><label className="text-xs font-bold text-muted-foreground">Archivo Excel o CSV de proveedores</label><Input type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) readImportFile(file); }} />{importFile && <p className="break-words text-xs text-muted-foreground">Archivo cargado: <b>{importFile.name}</b> · {importRows.length} filas detectadas</p>}</div>
            <div className="rounded-xl border p-4 text-xs text-muted-foreground"><p className="font-bold text-foreground">Flujo de trabajo</p><ol className="mt-2 list-decimal space-y-1 pl-5"><li>Descarga la plantilla y completa los datos del proveedor.</li><li>Carga el archivo; el sistema lo valida sin guardar todavía.</li><li>Presiona “Previsualizar proveedores” para editar y revisar errores.</li><li>Confirma escribiendo IMPORTAR; solo se guardarán las filas válidas.</li></ol></div>
          </div>
          <DialogFooter className="flex-wrap"><Button variant="outline" onClick={() => setImportOpen(false)}>Cerrar</Button>{importFile && <Button onClick={() => { setImportOpen(false); setImportPreviewOpen(true); }}>Previsualizar proveedores</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={(open) => { if (!open && !saving) setCreateOpen(false); }}>
        <DialogContent className="!flex !max-h-[92vh] w-[calc(100vw-1rem)] !max-w-[min(94vw,720px)] !flex-col overflow-hidden rounded-3xl p-0">
          <DialogHeader className="border-b border-border/40 px-5 py-5 sm:px-7">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Nuevo proveedor</DialogTitle>
            <DialogDescription>Completa los datos del proveedor y sus condiciones de contacto. El código es opcional.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5 sm:p-7">
            <section className="space-y-3">
              <div><h3 className="text-sm font-black uppercase tracking-widest">Identificación</h3><p className="text-xs text-muted-foreground">Si no ingresas un código, el sistema lo asignará automáticamente.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Código</label><Input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="PRV-000001" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre *</label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nombre del proveedor" className="h-11 rounded-xl" autoFocus /></div>
              </div>
            </section>
            <section className="space-y-3 border-t border-border/40 pt-5">
              <div><h3 className="text-sm font-black uppercase tracking-widest">Contacto</h3><p className="text-xs text-muted-foreground">Mantén actualizados los datos de contacto del proveedor.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Persona de contacto</label><Input value={draft.contactName} onChange={(e) => setDraft({ ...draft, contactName: e.target.value })} placeholder="Maria Lopez" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email</label><Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="proveedor@correo.com" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Teléfono</label><Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="8888-1111" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ciudad</label><Input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} placeholder="Managua" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">País</label><Input value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} placeholder="Nicaragua" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5 sm:col-span-2"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Dirección</label><Input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} placeholder="Calle, número y referencias" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</label><div className="flex h-11 items-center rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 text-sm font-bold text-emerald-500">{editingSupplier ? 'Usa el botón Activar / Desactivar' : 'Activo al crear'}</div></div>
              </div>
            </section>
          </div>
          <DialogFooter className="flex-wrap gap-2 border-t border-border/40 px-5 py-4 sm:px-7">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving} className="w-full rounded-xl sm:w-auto">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl font-bold sm:w-auto">{saving ? 'Guardando...' : 'Guardar proveedor'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(open) => { if (!open && !saving) { setEditOpen(false); setEditingSupplier(null); } }}>
        <DialogContent className="!flex !max-h-[92vh] w-[calc(100vw-1rem)] !max-w-[min(94vw,720px)] !flex-col overflow-hidden rounded-3xl p-0">
          <DialogHeader className="border-b border-border/40 px-5 py-5 sm:px-7">
            <DialogTitle className="text-xl font-black uppercase tracking-tight">Editar proveedor</DialogTitle>
            <DialogDescription>Actualiza la información del proveedor.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5 sm:p-7">
            <section className="space-y-3">
              <div><h3 className="text-sm font-black uppercase tracking-widest">Identificación</h3><p className="text-xs text-muted-foreground">El código del proveedor no se puede modificar.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Código</label><div className="flex h-11 items-center rounded-xl border border-input bg-muted/30 px-3 text-sm text-muted-foreground">{draft.code || '—'}</div></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre *</label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nombre del proveedor" className="h-11 rounded-xl" autoFocus /></div>
              </div>
            </section>
            <section className="space-y-3 border-t border-border/40 pt-5">
              <div><h3 className="text-sm font-black uppercase tracking-widest">Contacto</h3><p className="text-xs text-muted-foreground">Mantén actualizados los datos de contacto del proveedor.</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Persona de contacto</label><Input value={draft.contactName} onChange={(e) => setDraft({ ...draft, contactName: e.target.value })} placeholder="Maria Lopez" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email</label><Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} placeholder="proveedor@correo.com" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Teléfono</label><Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="8888-1111" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ciudad</label><Input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} placeholder="Managua" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">País</label><Input value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} placeholder="Nicaragua" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5 sm:col-span-2"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Dirección</label><Input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} placeholder="Calle, número y referencias" className="h-11 rounded-xl" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</label><div className="flex h-11 items-center rounded-xl border border-border bg-muted/20 px-3 text-sm font-bold text-muted-foreground">Usa el botón Activar / Desactivar</div></div>
              </div>
            </section>
          </div>
          <DialogFooter className="flex-wrap gap-2 border-t border-border/40 px-5 py-4 sm:px-7">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving} className="w-full rounded-xl sm:w-auto">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="w-full rounded-xl font-bold sm:w-auto">{saving ? 'Guardando...' : 'Guardar cambios'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SupplierHistoryModal
        supplier={selectedSupplierForHistory}
        open={!!selectedSupplierForHistory}
        onOpenChange={(open) => !open && setSelectedSupplierForHistory(null)}
      />
    </div>
  );
}

