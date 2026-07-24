import { useState } from 'react';
import { Truck, Plus, Search, Eye, Trash2, TrendingDown, CheckCircle2, ArrowUpDown, RefreshCw, Upload, FileDown, Info } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { suppliersService } from '../../services/compras.service';
import type { Supplier } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { SupplierHistoryModal } from './SupplierHistoryModal';
import { useCurrency } from '../../contexts/CurrencyContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

interface ProveedoresViewProps { data: Supplier[]; loading: boolean; onRefresh: () => void; }

export function ProveedoresView({ data, loading, onRefresh }: ProveedoresViewProps) {
  const { canPerform } = useAuth();
  const { formatConvertedAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [balanceOrder, setBalanceOrder] = useState<'all' | 'highest' | 'lowest'>('all');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedSupplierForHistory, setSelectedSupplierForHistory] = useState<Supplier | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ total: number; created: number; skipped: number; errors: string[] } | null>(null);

  const filtered = data.filter(s => {
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
    { key: 'contactName', header: 'direccion',  editable: canPerform('proveedores', 'edit') },
    { key: 'email',       header: 'Email',     editable: canPerform('proveedores', 'edit') },
    { key: 'phone',       header: 'Teléfono',  width: '130px', editable: canPerform('proveedores', 'edit') },
    { key: 'balance', header: 'Saldo', width: '130px',
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
      
      await suppliersService.update(id as string, sanitized); 
      toast.success('Proveedor actualizado'); 
      onRefresh(); 
    }
    catch (e: any) { 
      toast.error('Error al actualizar: ' + (e.response?.data?.message || e.message)); 
      throw e; // To trigger rollback in EditableDataTable
    }
  };

  const handleAdd = async () => {
    try {
      await suppliersService.create({ name: 'Nuevo Proveedor' });
      toast.success('Proveedor creado'); onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al crear proveedor'); }
  };

  const kpis = [
    { title: 'Total',     value: data.length,                                                                              icon: Truck,         color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Activos',   value: data.filter(s => (s.status||'').toUpperCase() === 'ACTIVE').length,                       icon: CheckCircle2,  color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Saldo Total', value: formatConvertedAmount(data.reduce((a, s) => a + Number(s.balance||0), 0), 'NIO'),       icon: TrendingDown,  color: 'text-rose-500',    bg: 'bg-rose-500/10'    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <Card key={i} className="bg-card border-border/50 rounded-2xl shadow-sm">
            <CardContent className="p-5"><div className="flex items-center gap-4">
              <div className={cn('p-3 rounded-xl', k.bg, k.color)}><k.icon className="size-5" /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{k.title}</p>
                <p className="text-2xl font-black tabular-nums">{k.value}</p>
              </div>
            </div></CardContent>
          </Card>
        ))}
        <Card className="bg-card border-border/50 rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
                <ArrowUpDown className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Filtro Saldo</p>
                <Select value={balanceOrder} onValueChange={(value: 'all' | 'highest' | 'lowest') => setBalanceOrder(value)}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue placeholder="Ordenar por saldo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Sin ordenar</SelectItem>
                    <SelectItem value="highest">Mayor compra</SelectItem>
                    <SelectItem value="lowest">Menor compra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight">Proveedores</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Directorio de proveedores y aliados</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input placeholder="Buscar proveedor..." className="pl-9 h-10 w-60 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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
              <Button onClick={handleAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2">
                <Plus className="size-4" /> Nuevo Proveedor
              </Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filteredAndSorted} columns={columns} onRowUpdate={handleUpdate} isLoading={loading}
          onAddRow={canPerform('proveedores', 'create') ? handleAdd : undefined}
          actions={(row) => (
            <div className="flex gap-1">
              <Button title="Ver Historial" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setSelectedSupplierForHistory(row)}><Eye className="size-4" /></Button>
              <Button title="Recalcular Saldo" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-amber-500/10 hover:text-amber-500" onClick={async () => {
                try {
                  const result = await suppliersService.recalculateBalance(row.id);
                  toast.success(`Saldo recalculado: ${formatConvertedAmount(result.newBalance, 'NIO')}`);
                  onRefresh();
                } catch (e: any) {
                  toast.error('Error al recalcular: ' + (e.response?.data?.message || e.message));
                }
              }}><RefreshCw className="size-4" /></Button>
              {canPerform('proveedores', 'delete') && (
                <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
              )}
            </div>
          )}
        />
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
        title="¿Eliminar proveedor?"
        description="Si el proveedor tiene transacciones activas (facturas, órdenes de compra, pagos), no se podrá eliminar."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={async () => {
          if (!pendingDeleteId) return;
          try {
            setDeleteLoading(true);
            await suppliersService.delete(pendingDeleteId);
            toast.success('Proveedor eliminado correctamente');
            onRefresh();
          } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || '';
            if (msg.includes('foreign') || msg.includes('constraint') || msg.includes('reference') || error?.status === 409) {
              toast.error('No se puede eliminar: este proveedor tiene transacciones activas (órdenes, facturas, pagos, etc.)');
            } else {
              toast.error(`Error al eliminar proveedor: ${msg}`);
            }
          } finally {
            setDeleteLoading(false);
            setPendingDeleteId(null);
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
                  <div className="mt-2 text-xs text-amber-600 space-y-1">
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

      <SupplierHistoryModal
        supplier={selectedSupplierForHistory}
        open={!!selectedSupplierForHistory}
        onOpenChange={(open) => !open && setSelectedSupplierForHistory(null)}
      />
    </div>
  );
}

