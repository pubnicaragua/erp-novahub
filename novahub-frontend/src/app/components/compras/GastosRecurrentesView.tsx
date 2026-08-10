import { useState, useEffect } from 'react';
import { CalendarClock, Plus, Search, Eye, RotateCcw, TrendingDown, Clock, Trash2, ChevronLeft, PlayCircle, PauseCircle } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { recurringExpensesService } from '../../services/compras.service';
import type { RecurringExpense, Supplier, Account } from '../../types';
import type { SalesPaginationControls } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { PurchaseAuditButton } from './PurchaseAuditButton';
import { PurchaseKpiCard } from './PurchaseKpiCard';
import { PurchaseViewTutorial } from './PurchaseViewTutorial';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';

interface Props { data: RecurringExpense[]; loading: boolean; onRefresh: () => void; supplierCatalog?: Supplier[]; pagination?: SalesPaginationControls; onSearchChange?: (value: string) => void; }

const freqOpts = [
  { label: 'Semanal',    value: 'weekly' },  
  { label: 'Mensual',    value: 'monthly' },
  { label: 'Trimestral', value: 'quarterly' }, 
  { label: 'Anual',      value: 'yearly' },
];
const freqMap: Record<string,string> = { weekly:'Semanal', monthly:'Mensual', quarterly:'Trimestral', yearly:'Anual' };
const statusOpts = [
  { label: 'Activo',     value: 'ACTIVE',    color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Pausado',    value: 'PAUSED',    color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Finalizado', value: 'CANCELLED', color: 'bg-rose-500/10 text-rose-500' },
];

interface PropsWithCatalog extends Props { accountCatalog?: Account[]; }

export function GastosRecurrentesView({ data, loading, onRefresh, supplierCatalog = [], accountCatalog = [], pagination, onSearchChange }: PropsWithCatalog) {
  const { canPerform } = useAuth();
  const { exchangeRate: globalRate, displayCurrency, valuationMode, valuationModeSuffix, formatCurrentAmount, convertAmount, convertCurrentAmount } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('purchases-recurring-expenses-layout', 'table', 24 * 365);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<RecurringExpense> | null>(null);

  useEffect(() => {
    setSuppliers(supplierCatalog);
    setAccounts(accountCatalog);
  }, [supplierCatalog, accountCatalog]);

  const openEditor = (id: string | null) => {
    setEditingId(id);
    if (id === 'NEW') {
      setLocalDoc({
        accountId: '',
        description: '',
        frequency: 'monthly',
        startDate: new Date().toISOString(),
        amount: 0,
        currency: displayCurrency,
        exchangeRate: globalRate,
        status: 'active',
        category: 'OPERACIONAL',
      });
    } else if (id) {
      const found = data.find(x => x.id === id);
      setLocalDoc(found ? JSON.parse(JSON.stringify(found)) : null);
    } else {
      setLocalDoc(null);
    }
  };

  const filtered = data.filter(e => {
    const status = String(e.status || '').toUpperCase();
    if (statusFilter !== 'ALL' && status !== statusFilter) return false;
    return (e.description||'').toLowerCase().includes(searchTerm.toLowerCase());
  });

  const columns: ColumnDef<RecurringExpense>[] = [
    { key: 'description', header: 'Descripción', editable: canPerform('PURCHASES_EXPENSES_REC', 'edit') },

    { key: 'amount',      header: 'Monto',       width: '130px',
      render: (val, row) => (
        <CurrencyValuationAmount amount={Number(val || 0)} sourceCurrency={row.currency} sourceExchangeRate={row.exchangeRate} className="font-black text-rose-500" />
      ) },
    { key: 'frequency',   header: 'Frecuencia',  width: '120px', editable: canPerform('PURCHASES_EXPENSES_REC', 'edit'), type: 'select', options: freqOpts,
      render: (val) => <Badge variant="outline" className="text-[9px] uppercase bg-blue-500/10 text-blue-500 border-none">{freqMap[(val||'').toLowerCase()]||val}</Badge> },

    { key: 'startDate',   header: 'Inicio',      width: '110px',
      render: (val) => <span className="text-xs text-muted-foreground">{val ? new Date(val).toLocaleDateString() : '-'}</span> },
    { key: 'status',      header: 'Estado',      width: '110px',
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toUpperCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<RecurringExpense>) => {
    try { await recurringExpensesService.update(id as string, updates); toast.success('Actualizado'); onRefresh(); } 
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar'); throw new Error('Update failed', { cause: e }); }
  };

  const handleStatusAction = async (row: RecurringExpense) => {
    const current = String(row.status || '').toUpperCase();
    const status = current === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await recurringExpensesService.update(row.id, { status } as any);
      toast.success(status === 'ACTIVE' ? 'Gasto recurrente activado' : 'Gasto recurrente pausado');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo cambiar el estado');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDeleteId) return;
    setDeleteLoading(true);
    try {
      await recurringExpensesService.delete(pendingDeleteId);
      toast.success('Gasto recurrente eliminado correctamente');
      setPendingDeleteId(null);
      if (editingId === pendingDeleteId) openEditor(null);
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
    
    // Clean data
    const cleanedDoc = {
      ...localDoc,
      amount: Number(localDoc.amount),
      exchangeRate: Number(localDoc.exchangeRate),
      baseAmount: Number(localDoc.baseAmount),
    };
    delete (cleanedDoc as any).account;
    delete (cleanedDoc as any).supplier;

    try {
      if (editingId === 'NEW') {
        await recurringExpensesService.create(cleanedDoc as any);
        toast.success('Gasto recurrente configurado');
      } else {
        await recurringExpensesService.update(editingId!, cleanedDoc as any);
        toast.success('Gasto recurrente actualizado');
      }
      openEditor(null);
      onRefresh();
    } catch (e: any) { 
        toast.error(e?.response?.data?.message || e?.message || 'Error al guardar el gasto recurrente'); 
    }
  };

  if (editingId && localDoc) {
    const isNew = editingId === 'NEW';
    const currentStatus = statusOpts.find(s => s.value === (localDoc.status||'').toUpperCase());

    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => openEditor(null)} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isNew ? 'Nuevo Gasto Recurrente' : 'Editar Recurrencia'}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Suscripciones y automatizaciones</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             {!isNew && canPerform('PURCHASES_EXPENSES_REC', 'delete') && (
                <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => setPendingDeleteId(editingId)}>
                  <Trash2 className="size-3 mr-2" /> Eliminar
                </Button>
             )}
            {((isNew && canPerform('PURCHASES_EXPENSES_REC', 'create')) || (!isNew && canPerform('PURCHASES_EXPENSES_REC', 'edit'))) && (
              <Button onClick={handleSaveDoc} className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6">
                Guardar Configuración
              </Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50 col-span-2">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Detalles del Servicio/Concepto</p>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div className="md:col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Descripción / Nombre</p>
                  <Input 
                    disabled={isNew ? !canPerform('PURCHASES_EXPENSES_REC', 'create') : !canPerform('PURCHASES_EXPENSES_REC', 'edit')}
                    value={localDoc.description || ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, description: e.target.value })} 
                    className="h-8 text-xs font-bold" 
                    placeholder="Ej. Suscripción a Software, AWS, etc" 
                  />
                </div>
                <div className="md:col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Proveedor (Opcional)</p>
                  <Combobox
                    disabled={isNew ? !canPerform('PURCHASES_EXPENSES_REC', 'create') : !canPerform('PURCHASES_EXPENSES_REC', 'edit')}
                    options={suppliers
                      .filter(s => (s.status || '').toUpperCase() === 'ACTIVE' || s.id === localDoc.supplierId)
                      .map(s => ({ label: s.name, value: s.id, description: (s.code ? `[${s.code}] ` : '') + (s.phone || 'Sin teléfono') }))}
                    value={localDoc.supplierId || ''}
                    onChange={(val) => setLocalDoc({ ...localDoc, supplierId: val })}
                    placeholder="Asociar a un proveedor..."
                  />
                </div>
                <div className="md:col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1 font-black uppercase text-primary">Cuenta contable</p>
                  <div className="flex h-8 items-center rounded-md border border-primary/20 bg-primary/5 px-2 text-[10px] font-bold text-primary">
                    Se aplica la cuenta global de Gastos configurada en Contabilidad
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha de Inicio</p>
                  <Input 
                    disabled={isNew ? !canPerform('PURCHASES_EXPENSES_REC', 'create') : !canPerform('PURCHASES_EXPENSES_REC', 'edit')}
                    type="date" 
                    value={localDoc.startDate ? new Date(localDoc.startDate).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, startDate: new Date(e.target.value).toISOString() })} 
                    className="h-8 text-xs" 
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha de Fin (Opcional)</p>
                  <Input 
                    disabled={isNew ? !canPerform('PURCHASES_EXPENSES_REC', 'create') : !canPerform('PURCHASES_EXPENSES_REC', 'edit')}
                    type="date" 
                    value={localDoc.endDate ? new Date(localDoc.endDate).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, endDate: new Date(e.target.value).toISOString() })} 
                    className="h-8 text-xs" 
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Categoría</p>
                  <Input 
                    disabled={isNew ? !canPerform('PURCHASES_EXPENSES_REC', 'create') : !canPerform('PURCHASES_EXPENSES_REC', 'edit')}
                    value={localDoc.category || ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, category: e.target.value })} 
                    className="h-8 text-xs uppercase" 
                    placeholder="OPERACIONAL" 
                  />
                </div>

                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Frecuencia</p>
                  <select 
                    disabled={isNew ? !canPerform('PURCHASES_EXPENSES_REC', 'create') : !canPerform('PURCHASES_EXPENSES_REC', 'edit')}
                    value={localDoc.frequency || 'monthly'} 
                    onChange={(e) => setLocalDoc({ ...localDoc, frequency: e.target.value as RecurringExpense['frequency'] })}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase text-primary"
                  >
                    {freqOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                  <div className="flex h-8 items-center"><Badge variant="outline" className={cn('text-[9px] font-black uppercase border-none', currentStatus?.color || 'bg-muted/20 text-muted-foreground')}>{currentStatus?.label || localDoc.status || 'Activa'}</Badge></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 col-span-2 md:col-span-1">
             <CardContent className="p-6">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Monto Automático Promedio</p>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm border-b border-border/50 pb-4">
                     <div className="w-1/2">
                        <p className="text-[10px] text-muted-foreground mb-1">Moneda</p>
                        <select 
                          disabled={isNew ? !canPerform('PURCHASES_EXPENSES_REC', 'create') : !canPerform('PURCHASES_EXPENSES_REC', 'edit')}
                          value={localDoc.currency || 'NIO'} 
                          onChange={(e) => setLocalDoc({ ...localDoc, currency: e.target.value as any, exchangeRate: globalRate })}
                          className="h-8 w-full max-w-[120px] rounded-md border border-input bg-background px-2 text-xs font-bold uppercase"
                        >
                          <option value="NIO">NIO</option>
                          <option value="USD">USD</option>
                        </select>
                     </div>
                     <div className="w-1/2 flex flex-col items-end">
                        <p className="text-[10px] text-muted-foreground mb-1">Monto Fijo Estimado</p>
                        <Input 
                          disabled={isNew ? !canPerform('PURCHASES_EXPENSES_REC', 'create') : !canPerform('PURCHASES_EXPENSES_REC', 'edit')}
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
                    <span className="font-black uppercase text-[10px] tracking-widest">Base Estimada</span>
                    <span className="font-black text-muted-foreground tabular-nums text-xs text-right">
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
  const monthly = data
    .filter(e => (e.frequency || '').toUpperCase() === 'MONTHLY')
    .reduce((acc, e) => acc + toDisplayAmount(Number(e.amount ?? e.baseAmount ?? 0), e.currency, e.exchangeRate), 0);
  const kpis = [
    { title: 'Total Recurrentes', value: data.length,                                                            icon: CalendarClock, color: 'text-blue-500',    bg: 'bg-blue-500/10', kind: 'indicator' as const },
    { title: 'Activos',           value: data.filter(e => (e.status||'').toUpperCase() === 'ACTIVE').length,     icon: RotateCcw,     color: 'text-emerald-500', bg: 'bg-emerald-500/10', kind: 'filter' as const, filter: 'ACTIVE' as const },
    {
      title: `Est. Mensual (${displayCurrency}${valuationModeSuffix})`,
      value: formatCurrentAmount(monthly, displayCurrency),
      icon: TrendingDown,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10', kind: 'indicator' as const,
    },
    { title: 'Pausados',        value: data.filter(e => (e.status||'').toUpperCase() === 'PAUSED').length,     icon: Clock,         color: 'text-amber-500',  bg: 'bg-amber-500/10', kind: 'filter' as const, filter: 'PAUSED' as const },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="purchases-list-kpis">
        {kpis.map((k, i) => (
          <PurchaseKpiCard key={i} title={k.title} value={k.value} icon={k.icon} color={k.color} bg={k.bg} kind={k.kind} active={k.filter === statusFilter} onClick={k.filter ? () => setStatusFilter(statusFilter === k.filter ? 'ALL' : k.filter) : undefined} />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight" data-tour="purchases-list-title">Gastos Recurrentes</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Compromisos fijos periódicos</p></div>
          <div className="flex flex-wrap items-center justify-end gap-3" data-tour="purchases-list-actions">
            <PurchaseViewTutorial view="recurring-expenses" />
            <ViewLayoutSelect value={layoutMode} onChange={setLayoutMode} ariaLabel="Elegir distribución de gastos recurrentes" />
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }} /></div>
            {canPerform('PURCHASES_EXPENSES_REC', 'create') && (
              <Button onClick={() => openEditor('NEW')} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nuevo Recurrente</Button>
            )}
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} pagination={pagination} layoutMode={layoutMode}
          onBulkDelete={canPerform('PURCHASES_EXPENSES_REC', 'delete') ? async (ids) => {
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await recurringExpensesService.delete(id as string);
              }
              toast.success('Elementos eliminados');
              onRefresh();
            } catch (e: any) {
              toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar');
            }
          } : undefined}
          actions={(row) => (
            <div className="flex gap-1">
              {canPerform('PURCHASES_EXPENSES_REC', 'edit') && ['ACTIVE', 'PAUSED'].includes(String(row.status || '').toUpperCase()) && (
                <Button title={String(row.status || '').toUpperCase() === 'ACTIVE' ? 'Pausar gasto recurrente' : 'Activar gasto recurrente'} aria-label={String(row.status || '').toUpperCase() === 'ACTIVE' ? 'Pausar gasto recurrente' : 'Activar gasto recurrente'} variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-amber-500/10 hover:text-amber-500" onClick={() => void handleStatusAction(row)}>
                  {String(row.status || '').toUpperCase() === 'ACTIVE' ? <PauseCircle className="size-4" /> : <PlayCircle className="size-4" />}
                </Button>
              )}
              <Button title={canPerform('PURCHASES_EXPENSES_REC', 'edit') ? "Editar" : "Ver"} variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => openEditor(row.id)}><Eye className="size-4" /></Button>
              <PurchaseAuditButton entity="RECURRING_EXPENSE" entityId={row.id} title="Auditoria del Gasto Recurrente" />
              {canPerform('PURCHASES_EXPENSES_REC', 'delete') && (
                <Button title="Eliminar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={() => setPendingDeleteId(row.id)}><Trash2 className="size-4" /></Button>
              )}
            </div>
          )}
        />
        <ConfirmDialog
          open={!!pendingDeleteId}
          onOpenChange={(open) => !open && setPendingDeleteId(null)}
          title="Eliminar Gasto Recurrente"
          description="¿Estás seguro de que deseas eliminar este gasto recurrente? Esta acción no se puede deshacer."
          confirmLabel="Eliminar Gasto"
          onConfirm={handleDeleteConfirm}
          loading={deleteLoading}
        />
      </div>
    </div>
  );
}

