import { useState } from 'react';
import { Truck, Plus, Search, Eye, Trash2, TrendingDown, CheckCircle2, ArrowUpDown, RefreshCw, Upload, FileDown, Info, Ban, Pencil } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { suppliersService } from '../../services/compras.service';
import type { Supplier, EntityStatus } from '../../types';
import type { SalesPaginationControls } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { SupplierHistoryModal } from './SupplierHistoryModal';
import { useCurrency } from '../../contexts/CurrencyContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { PurchaseKpiCard } from './PurchaseKpiCard';
import { PurchaseViewTutorial } from './PurchaseViewTutorial';

interface ProveedoresViewProps { data: Supplier[]; loading: boolean; onRefresh: () => void; pagination?: SalesPaginationControls; onSearchChange?: (value: string) => void; }

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

export function ProveedoresView({ data, loading, onRefresh, pagination, onSearchChange }: ProveedoresViewProps) {
  const { canPerform } = useAuth();
  const { formatConvertedAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [balanceOrder, setBalanceOrder] = useState<'all' | 'highest' | 'lowest'>('all');
  const [pendingToggle, setPendingToggle] = useState<Supplier | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedSupplierForHistory, setSelectedSupplierForHistory] = useState<Supplier | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ total: number; created: number; skipped: number; errors: string[] } | null>(null);
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

  const downloadTemplate = () => {
    const rows = [
      ['code', 'name', 'contactName', 'email', 'phone', 'address', 'status'],
      ['PRV-000001', 'Proveedor Ejemplo', 'Maria Lopez', 'proveedor@correo.com', '8888-1111', 'Managua', 'ACTIVE'],
    ];
    const csv = [
      'sep=;',
      ...rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';')),
    ].join('\r\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'plantilla_proveedores.csv';
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

  const parseSuppliersCsv = async (file: File) => {
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

  const handleImportSuppliers = async () => {
    if (!importFile) {
      toast.error('Selecciona un archivo CSV');
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const rows = await parseSuppliersCsv(importFile);
      if (rows.length === 0) {
        toast.error('El archivo no contiene filas para importar');
        return;
      }

      const existingCodes = new Set(data.map((s) => String(s.code || '').toUpperCase()).filter(Boolean));
      const existingEmails = new Set(data.map((s) => String(s.email || '').toLowerCase()).filter(Boolean));
      let created = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        const rowNumber = idx + 2;
        const name = String(row.name || row.nombre || '').trim();
        const code = String(row.code || row.codigo || '').trim();
        const email = String(row.email || '').trim().toLowerCase();
        const statusRaw = String(row.status || row.estado || 'ACTIVE').trim().toUpperCase();
        const status = statusRaw === 'INACTIVE' || statusRaw === 'INACTIVO' ? 'INACTIVE' : 'ACTIVE';

        if (!name) {
          skipped++;
          errors.push(`Fila ${rowNumber}: nombre es obligatorio`);
          continue;
        }
        if (code && existingCodes.has(code.toUpperCase())) {
          skipped++;
          errors.push(`Fila ${rowNumber}: código duplicado (${code})`);
          continue;
        }
        if (email && existingEmails.has(email)) {
          skipped++;
          errors.push(`Fila ${rowNumber}: email duplicado (${email})`);
          continue;
        }

        try {
          await suppliersService.create({
            code: code || `PRV-${Date.now().toString().slice(-6)}-${idx}`,
            name,
            contactName: String(row.contactname || row.contacto || '').trim() || undefined,
            email: email || undefined,
            phone: String(row.phone || row.telefono || '').trim() || undefined,
            address: String(row.address || row.direccion || '').trim() || undefined,
            status: status as any,
          } as any);
          created++;
          if (code) existingCodes.add(code.toUpperCase());
          if (email) existingEmails.add(email);
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
      render: (val) => <span className="font-black text-rose-500 tabular-nums">{formatConvertedAmount(val || 0, 'NIO')}</span>
    },
    { key: 'status', header: 'Estado', width: '120px', editable: canPerform('proveedores', 'edit'), type: 'select', options: statusOptions,
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
    { title: 'Saldo Total', value: formatConvertedAmount(data.reduce((a, s) => a + Number(s.balance||0), 0), 'NIO'),       icon: TrendingDown,  color: 'text-rose-500',    bg: 'bg-rose-500/10', kind: 'indicator' as const },
  ];

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
                onClick={() => { setImportOpen(true); setImportResult(null); }}
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
        <EditableDataTable data={filteredAndSorted} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} pagination={pagination}
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

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Upload className="size-4" /> Importar proveedores</DialogTitle>
            <DialogDescription>
              Sube un CSV para cargar proveedores masivamente. Usa la plantilla para evitar errores de formato.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 p-4 bg-muted/20">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Formato esperado</p>
              <p className="text-xs text-muted-foreground">
                Columnas: <span className="font-mono">code,name,contactName,email,phone,address,status</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                status: <b>ACTIVE</b> o <b>INACTIVE</b>
              </p>
              <Button variant="ghost" size="sm" className="mt-3 gap-2 h-8" onClick={downloadTemplate}>
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
            <Button onClick={handleImportSuppliers} disabled={importing || !importFile} className="gap-2">
              <Upload className="size-4" /> {importing ? 'Importando...' : 'Importar proveedores'}
            </Button>
          </DialogFooter>
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
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</label><select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as EntityStatus })} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></div>
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
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</label><select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as EntityStatus })} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></div>
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

