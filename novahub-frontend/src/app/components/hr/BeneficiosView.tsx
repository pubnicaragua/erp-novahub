import { useRef, useState } from 'react';
import { HandHeart, Plus, Save, X, Edit2, Trash2, Users, DollarSign, CheckCircle, Building2 } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { hrService } from '../../services/hr.service';
import { motion, AnimatePresence } from 'motion/react';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';

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

export function BeneficiosView({ benefits, employees, onRefresh }: any) {
  const { canPerform } = useAuth();
  const { displayCurrency, valuationMode, valuationModeSuffix, formatCurrentAmount, convertAmount, convertCurrentAmount } = useCurrency();
  const [addingNew, setAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<any>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [savingUpdateId, setSavingUpdateId] = useState<string | null>(null);
  const createInFlightRef = useRef(false);
  const updateInFlightRef = useRef<string | null>(null);

  const handleCreate = async () => {
    if (!form.name) { toast.error('El nombre es requerido'); return; }
    if (createInFlightRef.current) return;
    createInFlightRef.current = true;
    setIsCreating(true);
    try {
      await hrService.createBenefit({ ...form, provider: form.provider?.trim() || null, cost: form.cost ? Number(form.cost) : null, currency: form.currency || 'USD', isActive: form.isActive !== false });
      toast.success('Beneficio creado');
      setAddingNew(false);
      setForm({ ...EMPTY_FORM, currency: displayCurrency });
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al crear beneficio');
    } finally {
      createInFlightRef.current = false;
      setIsCreating(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (updateInFlightRef.current === id) return;
    updateInFlightRef.current = id;
    setSavingUpdateId(id);
    try {
      await hrService.updateBenefit(id, { ...editForm, provider: editForm.provider?.trim() || null, cost: editForm.cost ? Number(editForm.cost) : null, isActive: editForm.isActive !== false });
      toast.success('Beneficio actualizado');
      setEditingId(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar beneficio');
    } finally {
      updateInFlightRef.current = null;
      setSavingUpdateId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setPendingDeleteId(id);
  };

  const startEdit = (b: any) => {
    setEditingId(b.id);
    const existingEmployeeIds = b.employeeBenefits ? b.employeeBenefits.map((eb: any) => eb.employeeId) : (b.assignments ? b.assignments.map((eb: any) => eb.employeeId) : []);
    setEditForm({ name: b.name, description: b.description || '', type: b.type, provider: b.provider || '', cost: b.cost ?? '', currency: b.currency || 'USD', isActive: b.isActive !== false, employeeIds: existingEmployeeIds });
  };

  const totalCost = benefits.reduce((sum: number, b: any) => {
    const count = b.employeeBenefits?.length || b.assignments?.length || 0;
    const cost = Number(b.cost ?? b.baseCost ?? 0);
    const displayed = valuationMode === 'CURRENT'
      ? convertCurrentAmount(cost, b.currency || 'USD')
      : convertAmount(cost, b.currency || 'USD', b.exchangeRate);
    return sum + displayed * count;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span><strong className="text-foreground">{benefits.length}</strong> beneficios</span>
            <span className="text-muted-foreground/40">·</span>
            <span>Costo total{valuationModeSuffix}: <strong className="text-foreground">{formatCurrentAmount(totalCost, displayCurrency)}/mes</strong></span>
          </div>
        </div>
        {!addingNew && canPerform('HR_BENEFITS', 'create') && (
          <Button onClick={() => { setAddingNew(true); setForm({ ...EMPTY_FORM, currency: displayCurrency }); }} className="rounded-xl gap-2 font-bold bg-primary hover:bg-primary/90 !text-primary-foreground">
            <Plus className="size-4" /> Nuevo Beneficio
          </Button>
        )}
      </div>

      {/* New benefit inline row */}
      <AnimatePresence>
        {addingNew && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <Card className="border-primary/40 bg-primary/5 shadow-lg">
              <CardContent className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre *</label>
                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Seguro Médico Premium" className="rounded-xl h-10" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo</label>
                    <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl border border-input bg-background text-sm font-medium">
                      {Object.entries(BENEFIT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Costo/mes</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2.5 text-xs text-muted-foreground font-medium">
                        {form.currency === 'USD' ? '$' : 'C$'}
                      </span>
                      <Input type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} placeholder="0.00" className="rounded-xl h-10 pl-7" />
                    </div>
                  </div>
                   <div className="space-y-1">
                     <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Moneda</label>
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
                     <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Medio de pago</label>
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
                     <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Proveedor</label>
                     <Input value={form.provider || ''} onChange={e => setForm({ ...form, provider: e.target.value })} placeholder="Ej: Seguros América" className="rounded-xl h-10" />
                   </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descripción</label>
                    <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Cobertura médica completa para empleado y familia" className="rounded-xl h-10" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Activo</label>
                    <div className="flex items-center h-10 gap-2 px-3 rounded-xl border border-border/50 bg-background">
                      <Switch checked={form.isActive !== false} onCheckedChange={v => setForm({ ...form, isActive: v })} />
                      <span className="text-xs text-muted-foreground">{form.isActive === false ? 'Inactivo' : 'Activo'}</span>
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Empleados Asignados</label>
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
                  <div className="flex items-end gap-2 md:col-span-2">
                    <Button onClick={handleCreate} disabled={isCreating} className="flex-1 rounded-xl gap-2 font-bold"><Save className="size-4" /> {isCreating ? 'Guardando...' : 'Guardar'}</Button>
                    <Button variant="ghost" onClick={() => setAddingNew(false)} disabled={isCreating} className="rounded-xl"><X className="size-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Benefits Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {benefits.map((benefit: any) => {
          const assignedCount = benefit.employeeBenefits?.length ?? benefit.assignments?.length ?? benefit._count?.benefitAssignments ?? 0;
          const typeColor = BENEFIT_TYPE_COLORS[benefit.type] || BENEFIT_TYPE_COLORS.OTHER;
          const typeLabel = BENEFIT_TYPE_LABELS[benefit.type] || benefit.type;
          const isEditing = editingId === benefit.id;

          return (
            <motion.div key={benefit.id} layout initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="border-border/50 hover:border-primary/30 hover:shadow-md transition-all overflow-hidden">
                {isEditing ? (
                  <CardContent className="p-4 space-y-3">
                    <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="Nombre" className="rounded-xl h-9 text-sm font-bold" />
                    <Input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="Descripción" className="rounded-xl h-9 text-sm" />
                    <div className="grid grid-cols-2 gap-2">
                      <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })}
                        className="h-9 px-2 rounded-xl border border-input bg-background text-sm font-medium">
                        {Object.entries(BENEFIT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <select value={editForm.currency || displayCurrency} onChange={e => setEditForm({ ...editForm, currency: e.target.value })}
                        disabled={savingUpdateId === benefit.id}
                        className="h-9 px-2 rounded-xl border border-input bg-background text-sm font-medium">
                        <option value="NIO">Córdobas (NIO)</option>
                        <option value="USD">Dólares (USD)</option>
                      </select>
                    </div>
                    <div className="relative">
                      <span className="absolute left-2 top-2.5 text-xs text-muted-foreground font-medium">
                        {editForm.currency === 'USD' ? '$' : 'C$'}
                      </span>
                      <Input type="number" value={editForm.cost} onChange={e => setEditForm({ ...editForm, cost: e.target.value })} placeholder="Costo" disabled={savingUpdateId === benefit.id} className="rounded-xl h-9 text-sm pl-6" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Proveedor</label>
                      <Input value={editForm.provider || ''} onChange={e => setEditForm({ ...editForm, provider: e.target.value })} placeholder="Ej: Seguros América" className="rounded-xl h-9 text-sm" />
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/30">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground cursor-pointer">Activo</label>
                      <Switch checked={editForm.isActive !== false} onCheckedChange={v => setEditForm({ ...editForm, isActive: v })} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Empleados Asignados</label>
                      <div className="border border-border/50 rounded-xl p-3 max-h-40 overflow-y-auto bg-background">
                        {employees?.map((emp: any) => (
                          <label key={emp.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted/30 px-2 rounded">
                            <input 
                              type="checkbox" 
                              className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                              checked={editForm.employeeIds?.includes(emp.id) || false}
                              onChange={(e) => {
                                const isChecked = e.target.checked;
                                setEditForm((prev: any) => ({
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
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" onClick={() => handleUpdate(benefit.id)} disabled={savingUpdateId === benefit.id} className="flex-1 rounded-xl gap-1 font-bold text-xs"><Save className="size-3" /> {savingUpdateId === benefit.id ? 'Guardando...' : 'Guardar'}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={savingUpdateId === benefit.id} className="rounded-xl"><X className="size-3" /></Button>
                    </div>
                  </CardContent>
                ) : (
                  <>
                    <div className="p-4 border-b border-border/30">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`text-[9px] font-black uppercase ${typeColor}`}>{typeLabel}</Badge>
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
                          <div className="flex items-center gap-1">
                            <Users className="size-3 text-indigo-500" />
                            <span>{assignedCount} asignados</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {canPerform('HR_BENEFITS', 'edit') && (
                            <button onClick={() => startEdit(benefit)} className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                              <Edit2 className="size-3.5" />
                            </button>
                          )}
                          {canPerform('HR_BENEFITS', 'delete') && (
                            <button onClick={() => handleDelete(benefit.id)} className="size-7 rounded-lg hover:bg-rose-500/10 flex items-center justify-center text-muted-foreground hover:text-rose-500 transition-colors">
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </>
                )}
              </Card>
            </motion.div>
          );
        })}

        {benefits.length === 0 && !addingNew && (
          <div className="md:col-span-2 xl:col-span-3 flex flex-col items-center justify-center py-16 text-muted-foreground">
            <HandHeart className="size-12 opacity-20 mb-3" />
            <p className="text-sm font-bold">Sin beneficios configurados</p>
            <p className="text-xs mt-1">Haz clic en "Nuevo Beneficio" para agregar el primero</p>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="¿Eliminar beneficio?"
        description="¿Estás seguro de que deseas eliminar este beneficio? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={async () => {
          try {
            if (pendingDeleteId) await hrService.deleteBenefit(pendingDeleteId);
            toast.success('Beneficio eliminado');
            onRefresh();
          } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar beneficio'); }
          finally { setPendingDeleteId(null); }
        }}
      />
    </div>
  );
}

