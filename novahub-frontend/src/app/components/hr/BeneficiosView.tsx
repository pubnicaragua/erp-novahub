import { useRef, useState } from 'react';
import { HandHeart, Plus, Save, X, Trash2, Users, DollarSign, CheckCircle, Building2, Search, ChevronDown, ChevronUp, Edit2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../ui/dialog';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { hrService } from '../../services/hr.service';
import { motion } from 'motion/react';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { StatCard } from './StatCard';
import { HRViewTutorial } from './HRViewTutorial';
import { cn } from '../ui/utils';

const BENEFIT_TYPE_COLORS: Record<string, string> = {
  HEALTH: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  DENTAL: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  VISION: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  LIFE_INSURANCE: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  RETIREMENT: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  EDUCATION: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  TRANSPORTATION: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
  FOOD: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  GYM: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  OTHER: 'bg-muted text-muted-foreground border-border',
};

const BENEFIT_TYPE_LABELS: Record<string, string> = {
  HEALTH: 'Salud', DENTAL: 'Dental', VISION: 'Visión',
  LIFE_INSURANCE: 'Vida', RETIREMENT: 'Retiro', EDUCATION: 'Educación',
  TRANSPORTATION: 'Transporte', FOOD: 'Alimentación', GYM: 'Gimnasio', OTHER: 'Otro',
};

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Efectivo / Caja' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'CHECK', label: 'Cheque' },
  { value: 'OTHER', label: 'Otro medio' },
];

const EMPTY_FORM = { name: '', description: '', type: 'OTHER', provider: '', cost: '', currency: 'NIO', paymentSource: 'CASH', isActive: true, employeeIds: [] as string[] };

type BenefitFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export function BeneficiosView({ benefits, employees, onRefresh }: any) {
  const { canPerform } = useAuth();
  const { displayCurrency, valuationMode, valuationModeSuffix, formatCurrentAmount, convertAmount, convertCurrentAmount } = useCurrency();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [filter, setFilter] = useState<BenefitFilter>('ALL');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const createInFlightRef = useRef(false);

  const colFilters = useColumnFilters();

  const handleCreate = async () => {
    if (!form.name) { toast.error('El nombre es requerido'); return; }
    if (createInFlightRef.current) return;
    createInFlightRef.current = true;
    setIsCreating(true);
    try {
      const payload = {
        ...form,
        provider: form.provider?.trim() || null,
        cost: form.cost ? Number(form.cost) : null,
        currency: form.currency || 'USD',
        isActive: form.isActive !== false,
      };
      if (editingId) {
        await hrService.updateBenefit(editingId, payload);
        toast.success('Beneficio actualizado');
      } else {
        await hrService.createBenefit(payload);
        toast.success('Beneficio creado');
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM, currency: displayCurrency });
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al guardar beneficio');
    } finally {
      createInFlightRef.current = false;
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (id) await hrService.deleteBenefit(id);
      toast.success('Beneficio eliminado');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar beneficio');
    } finally {
      setPendingDeleteId(null);
    }
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, currency: displayCurrency });
    setShowForm(true);
  };

  const openEdit = (b: any) => {
    setEditingId(b.id);
    const existingEmployeeIds = b.employeeBenefits ? b.employeeBenefits.map((eb: any) => eb.employeeId) : (b.assignments ? b.assignments.map((eb: any) => eb.employeeId) : []);
    setForm({ name: b.name, description: b.description || '', type: b.type, provider: b.provider || '', cost: b.cost ?? '', currency: b.currency || 'USD', isActive: b.isActive !== false, employeeIds: existingEmployeeIds });
    setShowForm(true);
  };

  const totalCost = benefits.reduce((sum: number, b: any) => {
    const count = b.employeeBenefits?.length || b.assignments?.length || 0;
    const cost = Number(b.cost ?? b.baseCost ?? 0);
    const displayed = valuationMode === 'CURRENT'
      ? convertCurrentAmount(cost, b.currency || 'USD')
      : convertAmount(cost, b.currency || 'USD', b.exchangeRate);
    return sum + displayed * count;
  }, 0);

  const totalBenefits = benefits.length;
  const activeBenefits = benefits.filter((b: any) => b.isActive !== false).length;
  const inactiveBenefits = totalBenefits - activeBenefits;

  const searchFiltered = benefits.filter((b: any) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return b.name.toLowerCase().includes(q)
      || (b.description || '').toLowerCase().includes(q)
      || (b.provider || '').toLowerCase().includes(q)
      || (BENEFIT_TYPE_LABELS[b.type] || b.type || '').toLowerCase().includes(q);
  });
  const stateFiltered = searchFiltered.filter((b: any) => {
    if (filter === 'ACTIVE') return b.isActive !== false;
    if (filter === 'INACTIVE') return b.isActive === false;
    return true;
  });
  const filteredBenefits = colFilters.applyTo(stateFiltered, {
    name: (b: any) => b.name,
    type: (b: any) => String(b.type || 'OTHER'),
    state: (b: any) => (b.isActive === false ? 'INACTIVE' : 'ACTIVE'),
  });

  const typeOptionsForFilter = Object.entries(BENEFIT_TYPE_LABELS)
    .map(([value, label]) => ({ value, label, count: benefits.filter((b: any) => (b.type || 'OTHER') === value).length }))
    .filter(o => o.count > 0);
  const stateOptionsForFilter = [
    { value: 'ACTIVE', label: 'Activo', count: activeBenefits },
    { value: 'INACTIVE', label: 'Inactivo', count: inactiveBenefits },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="hr-benefits-title">
        <StatCard
          label="Beneficios"
          value={totalBenefits}
          icon={HandHeart}
          tone="primary"
          sub="Ofertas de compensación"
          active={filter === 'ALL'}
          onClick={() => setFilter('ALL')}
        />
        <StatCard
          label="Activos"
          value={activeBenefits}
          icon={CheckCircle}
          tone="green"
          sub="Disponibles para empleados"
          active={filter === 'ACTIVE'}
          onClick={() => setFilter('ACTIVE')}
        />
        <StatCard
          label="Inactivos"
          value={inactiveBenefits}
          icon={X}
          tone="gray"
          sub="Deshabilitados"
          active={filter === 'INACTIVE'}
          onClick={() => setFilter('INACTIVE')}
        />
        <StatCard
          label={`Costo total${valuationModeSuffix}`}
          value={formatCurrentAmount(totalCost, displayCurrency)}
          icon={DollarSign}
          tone="amber"
          sub="Por mes, según asignaciones"
          valueClassName="text-xl"
          onClick={() => setFilter('ALL')}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3" data-tour="hr-benefits-actions">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nombre, proveedor, tipo..."
              className="pl-8 h-9 w-64 bg-background"
            />
          </div>
          <ColumnFilterMenu
            label="Tipo"
            options={typeOptionsForFilter}
            selected={colFilters.state.type?.values || []}
            onSelect={(values) => colFilters.setValues('type', values)}
            sort={colFilters.state.type?.sort || null}
            onSort={(sort) => colFilters.setSort('type', sort)}
          />
          <ColumnFilterMenu
            label="Estado"
            options={stateOptionsForFilter}
            selected={colFilters.state.state?.values || []}
            onSelect={(values) => colFilters.setValues('state', values)}
            sort={colFilters.state.state?.sort || null}
            onSort={(sort) => colFilters.setSort('state', sort)}
          />
        </div>
        {canPerform('HR_BENEFITS', 'create') && (
          <Button onClick={openNew} className="rounded-xl gap-2 font-bold bg-primary hover:bg-primary/90 !text-primary-foreground">
            <Plus className="size-4" /> Nuevo Beneficio
          </Button>
        )}
        <HRViewTutorial label="Cómo gestionar beneficios" targetPrefix="hr-benefits" copy={{ data: { title: 'Beneficios y asignaciones', description: 'Filtra beneficios por tipo y estado, revisa costos mensuales y consulta los empleados asignados.' }, actions: { description: 'Crea, edita o elimina beneficios según tus permisos.' } }} />
      </div>

      {/* Benefits Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-tour="hr-benefits-data">
        {filteredBenefits.map((benefit: any) => {
          const assignedCount = benefit.employeeBenefits?.length ?? benefit.assignments?.length ?? benefit._count?.benefitAssignments ?? 0;
          const typeColor = BENEFIT_TYPE_COLORS[benefit.type] || BENEFIT_TYPE_COLORS.OTHER;
          const typeLabel = BENEFIT_TYPE_LABELS[benefit.type] || benefit.type;
          const assignedEmployees = benefit.employeeBenefits?.map((eb: any) => eb.employee) || benefit.assignments?.map((eb: any) => eb.employee) || [];
          const isExpanded = expandedId === benefit.id;

          return (
            <motion.div key={benefit.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className={cn("border-border/50 hover:border-primary/30 hover:shadow-md transition-all overflow-hidden", benefit.isActive === false && 'opacity-70')}>
                <div className="p-4 border-b border-border/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={cn('text-[9px] font-black uppercase', typeColor)}>{typeLabel}</Badge>
                        {benefit.isActive === false ? <Badge className="text-[9px] font-black uppercase bg-muted text-muted-foreground">Inactivo</Badge> : <CheckCircle className="size-3 text-emerald-500 flex-shrink-0" />}
                      </div>
                      <h4 className="font-black text-sm leading-tight">{benefit.name}</h4>
                      {benefit.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{benefit.description}</p>}
                      {benefit.provider && <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Building2 className="size-3" /> {benefit.provider}</p>}
                    </div>
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {benefit.cost && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="size-3 text-emerald-500" />
                          <CurrencyValuationAmount amount={Number(benefit.cost ?? benefit.baseCost ?? 0)} sourceCurrency={benefit.currency || 'USD'} sourceExchangeRate={benefit.exchangeRate} className="font-bold text-foreground" /><span className="font-normal text-muted-foreground">/mes</span>
                        </div>
                      )}
                      <button
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : benefit.id)}
                        title="Ver empleados asignados"
                      >
                        <Users className="size-3 text-indigo-500" />
                        <span className="font-bold">{assignedCount} asignados</span>
                        {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      {canPerform('HR_BENEFITS', 'edit') && (
                        <button onClick={() => openEdit(benefit)} className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" title="Editar">
                          <Edit2 className="size-3.5" />
                        </button>
                      )}
                      {canPerform('HR_BENEFITS', 'delete') && (
                        <button onClick={() => setPendingDeleteId(benefit.id)} className="size-7 rounded-lg hover:bg-rose-500/10 flex items-center justify-center text-muted-foreground hover:text-rose-500 transition-colors" title="Eliminar">
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && assignedCount > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Empleados asignados</p>
                      <div className="flex flex-wrap gap-1.5">
                        {assignedEmployees.filter(Boolean).map((emp: any, idx: number) => (
                          <span key={emp.id || idx} className="text-[11px] font-medium bg-muted/50 border border-border/40 px-2 py-1 rounded-lg">
                            {emp.firstName} {emp.lastName}
                          </span>
                        ))}
                        {assignedCount > assignedEmployees.length && (
                          <span className="text-[11px] font-bold text-muted-foreground px-1 py-1">+{assignedCount - assignedEmployees.length} más</span>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}

        {filteredBenefits.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3 flex flex-col items-center justify-center py-16 text-muted-foreground">
            <HandHeart className="size-12 opacity-20 mb-3" />
            <p className="text-sm font-bold">Sin beneficios que coincidan</p>
            <p className="text-xs mt-1">{benefits.length === 0 ? 'Haz clic en "Nuevo Beneficio" para agregar el primero' : 'Ajusta los filtros o la búsqueda'}</p>
          </div>
        )}
      </div>

      {/* New / Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingId(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader data-tour="hr-benefit-form-title">
            <DialogTitle className="flex items-center gap-2 text-lg font-black">
              <HandHeart className="size-5 text-primary" />
              {editingId ? 'Editar Beneficio' : 'Nuevo Beneficio'}
            </DialogTitle>
            <HRViewTutorial label={editingId ? 'Cómo editar beneficio' : 'Cómo crear beneficio'} targetPrefix="hr-benefit-form" stepKeys={['title', 'data', 'items', 'actions']} copy={{ data: { description: 'Completa nombre, tipo, costo, moneda, proveedor, descripción y estado.' }, items: { title: 'Empleados asignados', description: 'Marca los empleados que recibirán este beneficio.' }, actions: { description: 'Guarda el beneficio y sus asignaciones.' } }} />
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2" data-tour="hr-benefit-form-data">
            <div className="space-y-1 md:col-span-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Seguro Médico Premium" className="rounded-xl h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo</Label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm font-medium">
                {Object.entries(BENEFIT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Costo/mes</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-2.5 text-xs text-muted-foreground font-medium">
                  {form.currency === 'USD' ? '$' : 'C$'}
                </span>
                <Input type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} placeholder="0.00" className="rounded-xl h-10 pl-7" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Moneda</Label>
              <select
                value={form.currency || displayCurrency}
                onChange={e => setForm({ ...form, currency: e.target.value })}
                disabled={isCreating}
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm font-medium"
              >
                <option value="NIO">Córdobas (NIO)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Medio de pago</Label>
              <select
                value={form.paymentSource || 'CASH'}
                onChange={e => setForm({ ...form, paymentSource: e.target.value })}
                disabled={isCreating}
                className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm font-medium"
              >
                {PAYMENT_METHODS.map(method => <option key={method.value} value={method.value}>{method.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Proveedor</Label>
              <Input value={form.provider || ''} onChange={e => setForm({ ...form, provider: e.target.value })} placeholder="Ej: Seguros América" className="rounded-xl h-10" />
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descripción</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Cobertura médica completa para empleado y familia" className="rounded-xl h-10" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Activo</Label>
              <div className="flex items-center h-10 gap-2 px-3 rounded-xl border border-border/50 bg-background">
                <Switch checked={form.isActive !== false} onCheckedChange={v => setForm({ ...form, isActive: v })} />
                <span className="text-xs text-muted-foreground">{form.isActive === false ? 'Inactivo' : 'Activo'}</span>
              </div>
            </div>
            <div className="md:col-span-3 space-y-1" data-tour="hr-benefit-form-items">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Empleados Asignados ({form.employeeIds?.length || 0})
              </Label>
              <div className="border border-border/50 rounded-xl p-3 max-h-40 overflow-y-auto bg-background">
                {employees?.map((emp: any) => (
                  <label key={emp.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted/30 px-2 rounded">
                    <input
                      type="checkbox"
                      className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                      checked={form.employeeIds?.includes(emp.id) || false}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setForm((prev: any) => ({
                          ...prev,
                          employeeIds: isChecked
                            ? [...(prev.employeeIds || []), emp.id]
                            : (prev.employeeIds || []).filter((id: string) => id !== emp.id)
                        }));
                      }}
                    />
                    <span className="text-sm">{emp.firstName} {emp.lastName}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2" data-tour="hr-benefit-form-actions">
            <DialogClose asChild>
              <Button variant="outline" className="rounded-xl">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleCreate} disabled={isCreating} className="rounded-xl gap-2 font-bold">
              <Save className="size-4" /> {isCreating ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="¿Eliminar beneficio?"
        description="¿Estás seguro de que deseas eliminar este beneficio? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={() => pendingDeleteId ? handleDelete(pendingDeleteId) : Promise.resolve()}
      />
    </div>
  );
}
