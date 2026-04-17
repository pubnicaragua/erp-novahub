import { useState, useEffect } from 'react';
import { 
  Wallet, Plus, Search, Eye, Trash2, TrendingDown, Clock, Tag, ChevronLeft, Calendar as CalendarIcon, FileText, Download, PlusCircle
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { expensesService, suppliersService } from '../../services/compras.service';
import type { Expense, Supplier } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { storageService } from '../../services/storage.service';
import { generateExpensePDF } from '../../utils/pdfGenerator';

interface Props { data: Expense[]; loading: boolean; onRefresh: () => void; }
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

export function GastosView({ data, loading, onRefresh }: Props) {
  const { canPerform } = useAuth();
  const { exchangeRate: globalRate, displayCurrency, formatConvertedAmount, convertAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [activeKpiFilter, setActiveKpiFilter] = useState<KpiFilter>({ type: 'none' });
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [datePreset, setDatePreset] = useState<DateFilterPreset>('all');
  const [specificDate, setSpecificDate] = useState<Date | undefined>(undefined);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<Expense> | null>(null);

  useEffect(() => {
    suppliersService.getAll().then(res => {
      const list = Array.isArray(res) ? res : (res as any).data || [];
      setSuppliers(list);
    }).catch();

  }, []);

  useEffect(() => {
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
  }, [editingId, data, globalRate]);

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
    if (datePreset === 'last4') {
      const from = new Date(today);
      from.setDate(from.getDate() - 3);
      return { from: from.getTime(), to: end };
    }
    if (datePreset === 'last9') {
      const from = new Date(today);
      from.setDate(from.getDate() - 8);
      return { from: from.getTime(), to: end };
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

  const columns: ColumnDef<Expense>[] = [
    { key: 'date',        header: 'Fecha',     width: '110px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'category',    header: 'Categoría', width: '130px', editable: canPerform('compras', 'edit'), type: 'select', options: [
        {label: 'Operacional', value: 'OPERATIVO'}, {label: 'Administrativo', value: 'ADMINISTRATIVO'}, {label: 'Ventas', value: 'VENTAS'}, {label: 'Financiero', value: 'FINANCIERO'}, {label: 'Otro', value: 'OTRO'}
      ],
      render: (val, row) => <Badge variant="outline" className="text-[9px] uppercase bg-primary/5 text-primary border-none">{String(val || '').toUpperCase() === 'OTRO' ? (row.categoryCustom || 'OTRO') : (val || '-')}</Badge> },
    { key: 'description', header: 'Descripción', editable: canPerform('compras', 'edit') },
    { key: 'paidTo',      header: 'Pagado a', width: '170px',
      render: (val) => <span className="text-xs font-medium text-foreground">{val || '-'}</span> },
    { key: 'paymentSource', header: 'Cuenta Origen', width: '130px',
      render: (val) => <span className="text-xs font-black text-muted-foreground">{val || '-'}</span> },
    { key: 'amount',      header: 'Monto',     width: '130px',
      render: (val, row) => (
        <span className="font-black tabular-nums text-rose-500">
          {formatConvertedAmount(Number(val || 0), row.currency, row.exchangeRate)}

        </span>
      ) },
    { key: 'status',      header: 'Estado',    width: '120px', editable: canPerform('compras', 'edit'), type: 'select', options: statusOpts,
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<Expense>) => {
    try { await expensesService.update(id as string, updates); toast.success('Gasto actualizado'); onRefresh(); }
    catch { toast.error('Error al actualizar'); throw new Error('Update failed'); }
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
    } catch {
      toast.error('Error al eliminar');
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
    delete (cleanedDoc as any).accountId;

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
        const evidenceFileUrl = await storageService.fileToBase64(evidenceFile);
        (cleanedDoc as any).evidenceFileUrl = evidenceFileUrl;
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
      toast.error('Error al guardar: ' + (e.response?.data?.message || 'Error'));
    }
  };

  if (editingId && localDoc) {
    const isNew = editingId === 'NEW';
    const currentStatus = statusOpts.find(s => s.value === (localDoc.status||'').toUpperCase());
    const canMutate = isNew ? canPerform('compras', 'create') : canPerform('compras', 'edit');
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
          <div className="flex items-center gap-3">
             {!isNew && canPerform('compras', 'delete') && (
                <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => setPendingDeleteId(editingId)}>
                  <Trash2 className="size-3 mr-2" /> Eliminar
                </Button>
             )}
            {((isNew && canPerform('compras', 'create')) || (!isNew && canPerform('compras', 'edit'))) && (
              <Button onClick={handleSaveDoc} className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6">
                Guardar Gasto
              </Button>
            )}
            <Button
              variant="outline"
              className="rounded-xl font-black uppercase text-[10px] tracking-widest px-4"
              onClick={() => generateExpensePDF({
                expense: localDoc,
                tenantName: user?.tenantName || 'Empresa',
                tenantLogo: themeConfig?.logo,
                formatAmount: (amount: number, currency?: string, rate?: number) =>
                  formatConvertedAmount(Number(amount || 0), currency || (localDoc.currency as any), rate || localDoc.exchangeRate),
                primaryColor: themeConfig?.colors.primary
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Descripción / Concepto</p>
                    <Input 
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                      value={localDoc.description || ''} 
                      onChange={(e) => setLocalDoc({ ...localDoc, description: e.target.value })} 
                      className="h-8 text-xs font-bold" 
                      placeholder="Ej. Pago de internet mensual" 
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Categoría</p>
                    <select
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
                      value={localDoc.category || 'OPERATIVO'}
                      onChange={(e) => setLocalDoc({ ...localDoc, category: e.target.value })}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs uppercase"
                    >
                      <option value="OPERATIVO">Operativo</option>
                      <option value="ADMINISTRATIVO">Administrativo</option>
                      <option value="VENTAS">Ventas / Marketing</option>
                      <option value="FINANCIERO">Financiero</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Fecha del Gasto</p>
                    <Input 
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
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
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
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
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
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
                      disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
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

          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-6 flex flex-col justify-center h-full space-y-4">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Valor del Gasto</p>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm border-b border-border/50 pb-4">
                   <div className="w-1/2">
                      <p className="text-[10px] text-muted-foreground mb-1">Moneda</p>
                      <select
                        disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
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
                        disabled={isNew ? !canPerform('compras', 'create') : !canPerform('compras', 'edit')}
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

  const monthlyTotalInDisplayCurrency = data
    .filter(g => new Date(g.date).getMonth() === new Date().getMonth())
    .reduce((acc, g) => acc + convertAmount(g.amount || 0, g.currency, g.exchangeRate), 0);

  const kpis = [
    { key: 'all', title: 'Gastos Operativos',  value: data.length,                                                                         icon: Wallet,       color: 'text-blue-500',   bg: 'bg-blue-500/10'    },
    {
      key: 'month',
      title: `Total del Mes (${displayCurrency})`,
      value: `${displayCurrency === 'USD' ? '$' : 'C$'} ${monthlyTotalInDisplayCurrency.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      icon: TrendingDown,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
    },
    { key: 'pending', title: 'Pendientes', value: data.filter(g => (g.status || '').toUpperCase() === 'PENDING').length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', interactive: true },
    { key: 'category', title: 'Por Categoría', value: uniqueCategories.length, icon: Tag, color: 'text-purple-500', bg: 'bg-purple-500/10', interactive: true },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => {
          const isActive =
            (k.key === 'pending' && activeKpiFilter.type === 'pending') ||
            (k.key === 'category' && activeKpiFilter.type === 'category');
          return (
          <Card
            key={i}
            className={cn(
              "bg-card border-border/50 rounded-2xl shadow-sm",
              k.interactive ? "cursor-pointer hover:border-primary/50 transition-colors" : "",
              isActive ? "ring-1 ring-primary border-primary/50" : "",
            )}
            onClick={() => {
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
            }}
          >
            <CardContent className="p-5"><div className="flex items-center gap-4">
              <div className={cn('p-3 rounded-xl', k.bg, k.color)}><k.icon className="size-5" /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{k.title}</p><p className="text-2xl font-black tabular-nums">{k.value}</p></div>
            </div></CardContent>
          </Card>
        )})}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight">Gastos</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 text-left">Egresos operativos y administrativos</p>
          </div>
          {canPerform('compras', 'create') && (
            <Button onClick={() => setEditingId('NEW')} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6 h-10 rounded-xl gap-2 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
              <PlusCircle className="size-4" /> Registrar Gasto
            </Button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-muted/5 p-2 rounded-2xl border border-border/40">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-background/60 p-1 overflow-x-auto hide-scrollbar max-w-full sm:max-w-none">
              <Button variant={datePreset === 'last4' ? 'default' : 'ghost'} size="sm" className="h-7 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest flex-shrink-0" onClick={() => setDatePreset('last4')}>4 días</Button>
              <Button variant={datePreset === 'last9' ? 'default' : 'ghost'} size="sm" className="h-7 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest flex-shrink-0" onClick={() => setDatePreset('last9')}>9 días</Button>
              <Button variant={datePreset === 'month' ? 'default' : 'ghost'} size="sm" className="h-7 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest flex-shrink-0" onClick={() => setDatePreset('month')}>Mes</Button>
              <Button variant={datePreset === 'year' ? 'default' : 'ghost'} size="sm" className="h-7 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest flex-shrink-0" onClick={() => setDatePreset('year')}>Año</Button>
            </div>
            
            <div className="flex items-center gap-2 w-full xs:w-auto">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={datePreset === 'specific' ? 'default' : 'outline'} className="h-9 rounded-xl text-[9px] font-black uppercase tracking-widest gap-2 flex-1 sm:flex-none px-3">
                    <CalendarIcon className="size-3" />
                    {datePreset === 'specific' && specificDate ? specificDate.toLocaleDateString() : 'Específica'}
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

              {datePreset !== 'all' && (
                <Button
                  variant="outline"
                  className="h-9 rounded-xl text-[9px] font-black uppercase tracking-widest px-3"
                  onClick={() => {
                    setDatePreset('all');
                    setSpecificDate(undefined);
                  }}
                >
                  Todo
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full xs:w-auto">
              {activeKpiFilter.type === 'category' && (
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    const category = e.target.value;
                    setSelectedCategory(category);
                    setActiveKpiFilter({ type: 'category', category });
                  }}
                  className="h-9 rounded-xl border border-input bg-background px-3 text-[10px] font-black uppercase flex-1 sm:flex-none"
                >
                  {uniqueCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              )}
              {activeKpiFilter.type !== 'none' && (
                <Button
                  variant="outline"
                  className="h-9 rounded-xl text-[9px] font-black uppercase tracking-widest px-3 flex-1 sm:flex-none"
                  onClick={() => setActiveKpiFilter({ type: 'none' })}
                >
                  Filtros <RotateCcw className="size-3 ml-1" />
                </Button>
              )}
            </div>
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
            <Input 
              placeholder="Buscar..." 
              className="pl-9 h-10 w-full bg-background/50 border-border/50 rounded-xl text-xs" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card/50 overflow-hidden">
          <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} allowAddRow={false}
            onBulkDelete={canPerform('compras', 'delete') ? async (ids) => {
              try {
                for (const id of ids) {
                  if (String(id).startsWith('new-')) continue;
                  await expensesService.delete(id as string);
                }
                toast.success('Elementos eliminados');
                onRefresh();
              } catch (e) {
                toast.error('Error al eliminar');
              }
            } : undefined}
            actions={(row) => (
              <div className="flex gap-1">
                <Button title={canPerform('compras', 'edit') ? "Editar" : "Ver"} variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setEditingId(row.id)}><Eye className="size-4" /></Button>
                <Button title="Descargar PDF" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-slate-500/10 hover:text-slate-500 transition-colors" onClick={async () => {
                  try {
                    await toast.promise(generateExpensePDF({
                      expense: row,
                      tenantName: user?.tenantName || 'Empresa',
                      tenantLogo: themeConfig?.logo,
                      formatAmount: formatConvertedAmount,
                      primaryColor: themeConfig?.colors.primary
                    }), {
                      loading: 'Generando PDF...',
                      success: 'PDF generado exitosamente',
                      error: 'Error al generar PDF'
                    });
                  } catch(e) { console.error(e) }
                }}><Download className="size-4" /></Button>
                {canPerform('compras', 'delete') && (
                  <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
                )}
              </div>
            )}
          />
        </div>
        <ConfirmDialog
          open={!!pendingDeleteId}
          onOpenChange={(open) => !open && setPendingDeleteId(null)}
          title="Eliminar Gasto"
          description="¿Estás seguro de que deseas eliminar este gasto? Esta acción no se puede deshacer."
          confirmLabel="Eliminar Gasto"
          onConfirm={handleDeleteConfirm}
          loading={deleteLoading}
        />
      </div>
    </div>
  );
}

