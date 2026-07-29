import { useState } from 'react';
import { 
  Users, UserPlus, Search, CreditCard, CheckCircle2, Eye, Upload, FileDown, Info, CircleX
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { customersService } from '../../services/ventas.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import type { Customer, SalesPaginationControls } from '../../types';
import { Badge } from '../ui/badge';
import { useCurrency } from '../../contexts/CurrencyContext';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { CustomerDetailDrawer } from './CustomerDetailDrawer';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface ClientesViewProps {
  data: Customer[];
  loading: boolean;
  onRefresh: () => void;
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
}

export function ClientesView({ data, loading, onRefresh, pagination, onSearchChange }: ClientesViewProps) {
  const { formatConvertedAmount } = useCurrency();
  const { canPerform } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<Customer | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [pendingStatusChange, setPendingStatusChange] = useState<Customer | null>(null);
  const [statusChanging, setStatusChanging] = useState(false);
  const [pendingBulkDeactivateIds, setPendingBulkDeactivateIds] = useState<(string | number)[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ total: number; created: number; skipped: number; errors: string[] } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', type: 'individual', contactName: '', email: '', phone: '' });

  const downloadTemplate = () => {
    const rows = [
      ['code', 'name', 'type', 'contactName', 'email', 'phone', 'address', 'status'],
      ['CLI-000001', 'Cliente Ejemplo', 'INDIVIDUAL', 'Juan Perez', 'cliente@correo.com', '8888-8888', 'Managua', 'ACTIVE'],
    ];
    const csv = [
      'sep=;',
      ...rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(';')),
    ].join('\r\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'plantilla_clientes.csv';
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

  const parseCustomersCsv = async (file: File) => {
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

    const rows = lines.slice(1).map((line) => {
      const cols = splitCsvLine(line, delimiter);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = cols[idx] ?? '';
      });
      return row;
    });
    return rows;
  };

  const handleImportCustomers = async () => {
    if (!importFile) {
      toast.error('Selecciona un archivo CSV');
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const rows = await parseCustomersCsv(importFile);
      if (rows.length === 0) {
        toast.error('El archivo no contiene filas para importar');
        return;
      }

      const existingByCode = new Set(data.map((c) => String(c.code || '').toUpperCase()).filter(Boolean));
      const existingByEmail = new Set(data.map((c) => String(c.email || '').toLowerCase()).filter(Boolean));

      let created = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (let idx = 0; idx < rows.length; idx++) {
        const row = rows[idx];
        const rowNumber = idx + 2;
        const name = String(row.name || row.nombre || '').trim();
        const code = String(row.code || row.codigo || '').trim();
        const email = String(row.email || '').trim().toLowerCase();
        const typeRaw = String(row.type || row.tipo || 'INDIVIDUAL').trim().toUpperCase();
        const type = typeRaw === 'COMPANY' || typeRaw === 'EMPRESA' ? 'company' : 'individual';
        const statusRaw = String(row.status || row.estado || 'ACTIVE').trim().toUpperCase();
        const status = statusRaw === 'INACTIVE' || statusRaw === 'INACTIVO' ? 'INACTIVE' : 'ACTIVE';

        if (!name) {
          skipped++;
          errors.push(`Fila ${rowNumber}: nombre es obligatorio`);
          continue;
        }
        if (code && existingByCode.has(code.toUpperCase())) {
          skipped++;
          errors.push(`Fila ${rowNumber}: código duplicado (${code})`);
          continue;
        }
        if (email && existingByEmail.has(email)) {
          skipped++;
          errors.push(`Fila ${rowNumber}: email duplicado (${email})`);
          continue;
        }

        try {
          await customersService.create({
            code: code || `CLI-${Date.now().toString().slice(-6)}-${idx}`,
            name,
            type: type as any,
            contactName: String(row.contactname || row.contacto || '').trim() || undefined,
            email: email || undefined,
            phone: String(row.phone || row.telefono || '').trim() || undefined,
            address: String(row.address || row.direccion || '').trim() || undefined,
            status: status as any,
          });
          created++;
          if (code) existingByCode.add(code.toUpperCase());
          if (email) existingByEmail.add(email);
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

  const filtered = data.filter(c => {
    const search = searchTerm.toLowerCase();
    const customerStatus = String(c.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (statusFilter !== 'ALL' && customerStatus !== statusFilter) return false;
    return (
      String(c.name || '').toLowerCase().includes(search) || 
      (c.email || '').toLowerCase().includes(search) ||
      (c.code || '').toLowerCase().includes(search) ||
      (c.phone || '').toLowerCase().includes(search)
    );
  });

  const handleUpdate = async (id: string | number, updates: Partial<Customer>) => {
    try {
      await customersService.update(id.toString(), updates);
      toast.success('Cliente actualizado correctamente');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar cliente');
      throw e;
    }
  };

  const handleCreateClient = async () => {
    if (!newCustomer.name.trim()) {
      toast.error('El nombre del cliente es obligatorio');
      return;
    }
    setCreating(true);
    try {
      const code = `CLI-${Date.now().toString().slice(-6)}`;
      await customersService.create({
        code,
        name: newCustomer.name.trim(),
        type: newCustomer.type as any,
        contactName: newCustomer.contactName.trim() || undefined,
        email: newCustomer.email.trim() || undefined,
        phone: newCustomer.phone.trim() || undefined,
      });
      toast.success('Nuevo cliente creado');
      setCreateOpen(false);
      setNewCustomer({ name: '', type: 'individual', contactName: '', email: '', phone: '' });
      onRefresh();
    } catch (e: any) {
      console.error('Error creating customer:', e);
      toast.error(e?.response?.data?.message || e?.message || 'Error al crear cliente');
    } finally {
      setCreating(false);
    }
  };

  const columns: ColumnDef<Customer>[] = [
    { 
      key: 'code', 
      header: 'ID / Código', 
      width: '120px',
      render: (val, row) => <span className="text-[11px] font-black font-mono text-muted-foreground/60">{val || row.id.slice(0, 8)}</span>
    },
    { 
      key: 'name', 
      header: 'Nombre del Cliente', 
      editable: canPerform('SALES_CLIENTS', 'edit'),
      render: (val) => <span className="text-[13px] font-bold text-foreground">{val || 'Sin nombre'}</span>
    },
    { key: 'contactName', header: 'Contacto', editable: canPerform('SALES_CLIENTS', 'edit') },
    { 
      key: 'type', 
      header: 'Tipo', 
      width: '120px',
      editable: canPerform('SALES_CLIENTS', 'edit'),
      type: 'select',
      options: [
        { label: 'Particular', value: 'INDIVIDUAL', color: 'bg-blue-500/10 text-blue-500' },
        { label: 'Empresa', value: 'COMPANY', color: 'bg-purple-500/10 text-purple-500' }
      ],
      render: (val) => (
        <Badge variant="outline" className={cn(
          "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none",
          (val || '').toUpperCase() === 'COMPANY' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'
        )}>
          {(val || '').toUpperCase() === 'COMPANY' ? 'Empresa' : 'Particular'}
        </Badge>
      )
    },
    { key: 'email', header: 'Email / Envío', editable: canPerform('SALES_CLIENTS', 'edit') },
    { key: 'phone', header: 'Teléfono', width: '130px', editable: canPerform('SALES_CLIENTS', 'edit') },
    { 
      key: 'balance', 
      header: 'Saldo Deudor', 
      width: '150px',
      render: (val) => (
        <span className={cn(
          "text-[13px] font-black tabular-nums",
          (val || 0) > 0 ? "text-rose-500" : "text-emerald-500"
        )}>
          {formatConvertedAmount(val || 0, 'NIO')}
        </span>
      )
    },
    { 
      key: 'status', 
      header: 'Estado', 
      width: '120px',
      editable: canPerform('SALES_CLIENTS', 'edit'),
      type: 'select',
      options: [
        { label: 'Activo', value: 'ACTIVE', color: 'bg-emerald-500/10 text-emerald-500' },
        { label: 'Inactivo', value: 'INACTIVE', color: 'bg-muted/20 text-muted-foreground' }
      ],
      render: (val) => (
        <Badge variant="outline" className={cn(
          "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-none shadow-none",
          (val || '').toUpperCase() === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted/20 text-muted-foreground'
        )}>
          {(val || '').toUpperCase() === 'ACTIVE' ? 'Activo' : 'Inactivo'}
        </Badge>
      )
    }
  ];

  const kpis = [
    { title: 'Total Clientes', value: data.length, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    { title: 'Particulares', value: data.filter(c => (c.type || '').toUpperCase() === 'INDIVIDUAL').length, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Empresas', value: data.filter(c => (c.type || '').toUpperCase() === 'COMPANY').length, icon: CheckCircle2, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { title: 'Saldo Pendiente', value: formatConvertedAmount(data.reduce((acc, c) => acc + Number(c.balance || 0), 0), 'NIO'), icon: CreditCard, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* KPIs Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden relative group">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className={cn("p-3 rounded-xl shadow-inner", kpi.bg, kpi.color)}>
                  <kpi.icon className="size-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.title}</p>
                  <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">{kpi.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-2">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-foreground">Directorio de Clientes</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Gestión integral Excel-like sin interrupciones.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input 
                placeholder="Buscar cliente..." 
                className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs font-bold tracking-widest"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }}
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')} aria-label="Filtrar clientes por estado" className="h-10 min-w-0 max-w-full rounded-xl border border-border/50 bg-background/50 px-3 text-xs font-bold uppercase tracking-widest outline-none focus:border-primary">
              <option value="ACTIVE">Activos</option>
              <option value="INACTIVE">Inactivos</option>
              <option value="ALL">Todos</option>
            </select>
            {canPerform('SALES_CLIENTS', 'create') && (
              <Button
                variant="outline"
                onClick={() => { setImportOpen(true); setImportResult(null); }}
                className="font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"
              >
                <Upload className="size-4" /> Importar
              </Button>
            )}
            {canPerform('SALES_CLIENTS', 'create') && (
              <Button 
                onClick={() => setCreateOpen(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20"
              >
                <UserPlus className="size-4" /> Nuevo Cliente
              </Button>
            )}
          </div>
        </div>

        <EditableDataTable 
          data={filtered}
          columns={columns}
          onRowUpdate={handleUpdate}
          isLoading={loading}
          pagination={pagination}
          showClearSelection={false}
          actions={(row) => (
            <div className="flex items-center gap-1">
               <Button variant="ghost" size="icon" title="Ver detalle" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setSelectedCustomerDetail(row)}><Eye className="size-4" /></Button>
               {canPerform('SALES_CLIENTS', 'edit') && (
                 <Button variant="ghost" size="icon" title={String(row.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'Activar cliente' : 'Anular cliente'} className={cn('size-8 rounded-lg transition-colors', String(row.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'hover:bg-emerald-500/10 hover:text-emerald-500' : 'hover:bg-amber-500/10 hover:text-amber-500')} onClick={() => setPendingStatusChange(row)}><CircleX className="size-4" /></Button>
               )}
            </div>
          )}
          bulkActions={(selectedIds) => (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[10px] font-black uppercase tracking-wider text-amber-600 hover:bg-amber-500/10"
              onClick={() => setPendingBulkDeactivateIds(selectedIds)}
            >
              <CircleX className="mr-2 size-3" /> Desactivar clientes
            </Button>
          )}
        />
      </div>

      <ConfirmDialog
        open={pendingStatusChange !== null}
        onOpenChange={(open) => { if (!open && !statusChanging) setPendingStatusChange(null); }}
        title={pendingStatusChange && String(pendingStatusChange.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? '¿Activar cliente?' : '¿Inactivar cliente?'}
        description={pendingStatusChange && String(pendingStatusChange.status || 'ACTIVE').toUpperCase() === 'INACTIVE'
          ? `El cliente ${pendingStatusChange.name || ''} volverá a estar disponible en las operaciones.`
          : `El cliente ${pendingStatusChange?.name || ''} quedará inactivo y no estará disponible para nuevas operaciones.`}
        confirmLabel={pendingStatusChange && String(pendingStatusChange.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'Activar cliente' : 'Inactivar cliente'}
        variant={pendingStatusChange && String(pendingStatusChange.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'default' : 'destructive'}
        loading={statusChanging}
        onConfirm={async () => {
          if (!pendingStatusChange) return;
          const nextStatus = String(pendingStatusChange.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
          try {
            setStatusChanging(true);
            await handleUpdate(pendingStatusChange.id, { status: nextStatus } as Partial<Customer>);
            setPendingStatusChange(null);
          } finally {
            setStatusChanging(false);
          }
        }}
      />

      <ConfirmDialog
        open={pendingBulkDeactivateIds.length > 0}
        onOpenChange={(open) => { if (!open && !statusChanging) setPendingBulkDeactivateIds([]); }}
        title="¿Desactivar clientes seleccionados?"
        description={`Se desactivarán ${pendingBulkDeactivateIds.length} clientes y no estarán disponibles para nuevas operaciones.`}
        confirmLabel="Desactivar clientes"
        variant="destructive"
        loading={statusChanging}
        onConfirm={async () => {
          if (pendingBulkDeactivateIds.length === 0) return;
          try {
            setStatusChanging(true);
            await Promise.all(pendingBulkDeactivateIds.map((id) => handleUpdate(id, { status: 'INACTIVE' } as Partial<Customer>)));
            setPendingBulkDeactivateIds([]);
          } finally {
            setStatusChanging(false);
          }
        }}
      />

      <CustomerDetailDrawer
        customerId={selectedCustomerDetail?.id ?? null}
        onOpenChange={(open) => !open && setSelectedCustomerDetail(null)}
        customerSnapshot={selectedCustomerDetail}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg rounded-3xl p-0">
          <DialogHeader className="border-b border-border/40 px-5 py-4 sm:px-6">
            <DialogTitle className="text-lg font-black uppercase tracking-tight">Nuevo Cliente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre</label>
              <Input value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} placeholder="Nombre del cliente" className="h-11 rounded-xl" autoFocus />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo</label>
              <select value={newCustomer.type} onChange={(e) => setNewCustomer({ ...newCustomer, type: e.target.value })} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                <option value="individual">Particular</option>
                <option value="company">Empresa</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contacto</label>
              <Input value={newCustomer.contactName} onChange={(e) => setNewCustomer({ ...newCustomer, contactName: e.target.value })} placeholder="Persona de contacto" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Email</label>
              <Input type="email" value={newCustomer.email} onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })} placeholder="cliente@correo.com" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Teléfono</label>
              <Input value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder="8888-8888" className="h-11 rounded-xl" />
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-border/40 px-5 py-4 sm:px-6">
            <Button variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleCreateClient} disabled={creating || !newCustomer.name.trim()} className="rounded-xl font-bold">
              {creating ? 'Guardando...' : 'Crear Cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="size-4" /> Importar clientes
            </DialogTitle>
            <DialogDescription>
              Sube un CSV para cargar clientes masivamente. Usa la plantilla para evitar errores de formato.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 p-4 bg-muted/20">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Formato esperado</p>
              <p className="text-xs text-muted-foreground">
                Columnas: <span className="font-mono">code,name,type,contactName,email,phone,address,status</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                type: <b>INDIVIDUAL</b> o <b>COMPANY</b> · status: <b>ACTIVE</b> o <b>INACTIVE</b>
              </p>
              <Button variant="ghost" size="sm" className="mt-3 gap-2 h-8" onClick={downloadTemplate}>
                <FileDown className="size-4" /> Descargar plantilla CSV
              </Button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Archivo CSV</label>
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              />
              {importFile && (
                <p className="text-xs text-muted-foreground">
                  Archivo: <b>{importFile.name}</b> ({Math.round(importFile.size / 1024)} KB)
                </p>
              )}
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
            <Button onClick={handleImportCustomers} disabled={importing || !importFile} className="gap-2">
              <Upload className="size-4" /> {importing ? 'Importando...' : 'Importar clientes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

