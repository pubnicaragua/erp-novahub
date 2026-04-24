import React, { useState } from 'react';
import { HandHeart, Plus, Save, X, Edit2, Trash2, Users, DollarSign, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { hrService } from '../../services/hr.service';
import { motion, AnimatePresence } from 'motion/react';
import { useCurrency } from '../../contexts/CurrencyContext';
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

const EMPTY_FORM = { name: '', description: '', type: 'OTHER', cost: '', isActive: true, employeeIds: [] as string[] };

export function BeneficiosView({ benefits, employees, onRefresh }: any) {
  const { displayCurrency, convertAmount, formatConvertedAmount } = useCurrency();
  const [addingNew, setAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<any>({});

  const handleCreate = async () => {
    if (!form.name) { toast.error('El nombre es requerido'); return; }
    try {
      const currency = displayCurrency === 'USD' ? 'USD' : 'NIO';
      await hrService.createBenefit({ ...form, cost: form.cost ? Number(form.cost) : null, currency });
      toast.success('Beneficio creado');
      setAddingNew(false);
      setForm(EMPTY_FORM);
      onRefresh();
    } catch { toast.error('Error al crear beneficio'); }
  };

  const handleUpdate = async (id: string) => {
    try {
      await hrService.updateBenefit(id, { ...editForm, cost: editForm.cost ? Number(editForm.cost) : null });
      toast.success('Beneficio actualizado');
      setEditingId(null);
      onRefresh();
    } catch { toast.error('Error al actualizar beneficio'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este beneficio?')) return;
    try {
      await hrService.deleteBenefit(id);
      toast.success('Beneficio eliminado');
      onRefresh();
    } catch { toast.error('Error al eliminar beneficio'); }
  };

  const startEdit = (b: any) => {
    setEditingId(b.id);
    const existingEmployeeIds = b.employeeBenefits ? b.employeeBenefits.map((eb: any) => eb.employeeId) : (b.assignments ? b.assignments.map((eb: any) => eb.employeeId) : []);
    setEditForm({ name: b.name, description: b.description || '', type: b.type, cost: b.cost ?? '', currency: b.currency || 'USD', employeeIds: existingEmployeeIds });
  };

  const totalCost = benefits.reduce((sum: number, b: any) => {
    const count = b.employeeBenefits?.length || b.assignments?.length || 0;
    return sum + convertAmount((Number(b.cost) || 0) * count, b.currency || 'USD');
  }, 0);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden relative group">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl shadow-inner bg-rose-500/10 text-rose-500">
                <HandHeart className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Beneficios Activos</p>
                <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">{benefits.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden relative group">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl shadow-inner bg-emerald-500/10 text-emerald-500">
                <DollarSign className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Costo Estimado</p>
                <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">
                  {formatConvertedAmount(benefits.reduce((acc: number, b: any) => acc + (b.cost || 0), 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden relative group">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl shadow-inner bg-blue-500/10 text-blue-500">
                <Users className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Total Asignaciones</p>
                <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">
                  {benefits.reduce((acc: number, b: any) => acc + (b.assignments?.length || 0), 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black uppercase tracking-tight text-foreground">Catálogo de Beneficios</h3>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Planes de salud, compensaciones y bienestar corporativo.</p>
        </div>
        <Button 
          onClick={() => { setAddingNew(true); setForm(EMPTY_FORM); }} 
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20"
        >
          <Plus className="size-4" /> Nuevo Beneficio
        </Button>
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
                        {displayCurrency === 'USD' ? '$' : 'C$'}
                      </span>
                      <Input type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} placeholder="0.00" className="rounded-xl h-10 pl-7" />
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descripción</label>
                    <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Cobertura médica completa para empleado y familia" className="rounded-xl h-10" />
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
                    <Button onClick={handleCreate} className="flex-1 rounded-xl gap-2 font-bold"><Save className="size-4" /> Guardar</Button>
                    <Button variant="ghost" onClick={() => setAddingNew(false)} className="rounded-xl"><X className="size-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Benefits Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {benefits.map((benefit: any) => {
          const assignedCount = benefit.employeeBenefits?.length ?? benefit.assignments?.length ?? benefit._count?.benefitAssignments ?? 0;
          const typeColor = BENEFIT_TYPE_COLORS[benefit.type] || BENEFIT_TYPE_COLORS.OTHER;
          const typeLabel = BENEFIT_TYPE_LABELS[benefit.type] || benefit.type;
          const isEditing = editingId === benefit.id;

          return (
            <motion.div key={benefit.id} layout initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="bg-card border-border/50 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 overflow-hidden rounded-2xl group">
                {isEditing ? (
                  <CardContent className="p-5 space-y-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Nombre del Beneficio</label>
                      <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} placeholder="Nombre" className="rounded-xl h-10 text-sm font-bold bg-muted/20" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Descripción</label>
                      <Input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="Descripción" className="rounded-xl h-10 text-sm bg-muted/20" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Tipo</label>
                        <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })}
                          className="w-full h-10 px-3 rounded-xl border border-input bg-muted/20 text-xs font-bold uppercase">
                          {Object.entries(BENEFIT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Costo ({editForm.currency})</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-bold">
                            {editForm.currency === 'USD' ? '$' : 'C$'}
                          </span>
                          <Input type="number" value={editForm.cost} onChange={e => setEditForm({ ...editForm, cost: e.target.value })} placeholder="0.00" className="rounded-xl h-10 text-sm pl-7 bg-muted/20" />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button onClick={() => handleUpdate(benefit.id)} className="flex-1 rounded-xl gap-2 font-black uppercase text-[10px] tracking-widest h-10"><Save className="size-4" /> Guardar</Button>
                      <Button variant="outline" onClick={() => setEditingId(null)} className="rounded-xl h-10 border-border/50"><X className="size-4" /></Button>
                    </div>
                  </CardContent>
                ) : (
                  <>
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <Badge className={cn("px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm", typeColor)}>
                          {typeLabel}
                        </Badge>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEdit(benefit)} className="size-8 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white flex items-center justify-center transition-all">
                            <Edit2 className="size-3.5" />
                          </button>
                          <button onClick={() => handleDelete(benefit.id)} className="size-8 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-black text-lg leading-tight tracking-tight text-foreground group-hover:text-primary transition-colors">{benefit.name}</h4>
                        {benefit.description && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 italic">{benefit.description}</p>}
                      </div>
                    </div>
                    
                    <div className="px-5 py-4 bg-muted/20 border-t border-border/40 flex items-center justify-between">
                      <div className="flex flex-col">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mb-1">Costo Estimado</p>
                        <p className="font-black text-sm text-foreground">
                          {formatConvertedAmount(Number(benefit.cost), benefit.currency || 'USD')}
                          <span className="text-[10px] font-medium text-muted-foreground ml-1">/mes</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 bg-background/50 px-3 py-1.5 rounded-xl border border-border/40 shadow-sm">
                        <Users className="size-3 text-primary" />
                        <span className="text-xs font-black text-foreground">{assignedCount}</span>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            </motion.div>
          );
        })}

        {benefits.length === 0 && !addingNew && (
          <div className="md:col-span-2 xl:col-span-3">
            <Card className="border-dashed border-2 border-muted-foreground/20 bg-muted/5 rounded-3xl overflow-hidden py-6">
              <CardContent className="flex flex-col items-center justify-center text-center p-8">
                <div className="size-20 rounded-3xl bg-primary/5 flex items-center justify-center mb-6 relative">
                  <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full" />
                  <HandHeart className="size-10 text-primary relative z-10" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-foreground mb-2">No hay beneficios activos</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-8 font-medium">
                  Comienza configurando planes de salud, seguros o compensaciones adicionales para tus empleados.
                </p>
                <Button 
                  onClick={() => { setAddingNew(true); setForm(EMPTY_FORM); }}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-8 h-12 rounded-2xl gap-3 shadow-2xl shadow-primary/20"
                >
                  <Plus className="size-5" /> Crear Primer Beneficio
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

