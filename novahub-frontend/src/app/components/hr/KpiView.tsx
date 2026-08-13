import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { cn } from '../ui/utils';
import {
  BarChart3, Plus, Save, RefreshCw, Check, X, Target, Weight, Calendar, Users, User, MessageSquare, Edit3
} from 'lucide-react';
import { hrService } from '../../services/hr.service';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type { KpiDefinition, KpiResult } from '../../types';

interface KpiViewProps {
  employees?: any[];
  onRefresh?: () => void;
}

const PERIOD_TYPES = [
  { value: 'MONTHLY', label: 'Mensual' },
  { value: 'QUARTERLY', label: 'Trimestral' },
  { value: 'SEMESTRAL', label: 'Semestral' },
  { value: 'YEARLY', label: 'Anual' },
];
const PERIOD_LABELS: Record<string, string> = { MONTHLY: 'Mensual', QUARTERLY: 'Trimestral', SEMESTRAL: 'Semestral', YEARLY: 'Anual' };
const ASSIGN_TYPES = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'DEPARTMENT', label: 'Departamento' },
  { value: 'ALL', label: 'Toda la empresa' },
];
const ASSIGN_LABELS: Record<string, string> = { INDIVIDUAL: 'Individual', DEPARTMENT: 'Departamento', ALL: 'Toda la empresa' };

const defaultKpiDef = () => ({
  name: '',
  description: '',
  target: 0,
  weight: 100,
  periodType: 'MONTHLY',
  assignToType: 'INDIVIDUAL',
  assignToId: '',
  isActive: true,
});

const defaultKpiResult = () => ({
  employeeId: '',
  kpiDefinitionId: '',
  periodStart: '',
  periodEnd: '',
  target: 0,
  actual: 0,
  evaluatorId: '',
  comment: '',
});

export function KpiView({ employees = [], onRefresh }: KpiViewProps) {
  const { canPerform } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('definitions');

  const [showDefForm, setShowDefForm] = useState(false);
  const [editingDefId, setEditingDefId] = useState<string | null>(null);
  const [savingDef, setSavingDef] = useState(false);
  const [defForm, setDefForm] = useState(defaultKpiDef());

  const [showResultForm, setShowResultForm] = useState(false);
  const [savingResult, setSavingResult] = useState(false);
  const [resultForm, setResultForm] = useState(defaultKpiResult());

  const kpiQuery = useQuery({
    queryKey: ['hr', 'kpi-data'],
    queryFn: async ({ signal }) => {
      const [defRes, resRes] = await Promise.all([
        hrService.getKpiDefinitions(undefined, signal) as any,
        hrService.getKpiResults(undefined, undefined, signal) as any,
      ]);
      return { definitions: Array.isArray(defRes) ? defRes : defRes?.data || [], results: Array.isArray(resRes) ? resRes : resRes?.data || [] };
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });
  const loading = kpiQuery.isLoading;
  const definitions = (kpiQuery.data?.definitions || []) as KpiDefinition[];
  const results = (kpiQuery.data?.results || []) as KpiResult[];
  const fetchAll = () => queryClient.invalidateQueries({ queryKey: ['hr', 'kpi-data'] });

  const resetDefForm = () => { setDefForm(defaultKpiDef()); setEditingDefId(null); setShowDefForm(false); };
  const openEditDef = (d: KpiDefinition) => {
    setDefForm({ name: d.name, description: d.description || '', target: d.target ?? 0, weight: d.weight, periodType: d.periodType, assignToType: d.assignToType, assignToId: d.assignToId || '', isActive: d.isActive });
    setEditingDefId(d.id);
    setShowDefForm(true);
  };

  const handleSaveDef = async () => {
    if (!defForm.name) { toast.error('Nombre es requerido'); return; }
    try {
      setSavingDef(true);
      const data = { ...defForm, target: defForm.target || undefined };
      if (editingDefId) {
        await hrService.updateKpiDefinition(editingDefId, data);
        toast.success('Definición actualizada');
      } else {
        await hrService.createKpiDefinition(data);
        toast.success('Definición creada');
      }
      resetDefForm();
      fetchAll();
      onRefresh?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al guardar');
    } finally { setSavingDef(false); }
  };

  const resetResultForm = () => { setResultForm(defaultKpiResult()); setShowResultForm(false); };

  const handleSaveResult = async () => {
    if (!resultForm.employeeId || !resultForm.kpiDefinitionId || !resultForm.periodStart || !resultForm.periodEnd) {
      toast.error('Completa todos los campos requeridos');
      return;
    }
    try {
      setSavingResult(true);
      await hrService.createKpiResult(resultForm);
      toast.success('Resultado KPI creado');
      resetResultForm();
      fetchAll();
      onRefresh?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al guardar');
    } finally { setSavingResult(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/50 to-primary/30 blur-xl rounded-full" />
            <div className="relative size-16 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
          <p className="text-sm font-bold text-muted-foreground tracking-wide">Cargando KPI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <BarChart3 className="size-6 text-primary" />
            Gestión de KPI
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Define indicadores y registra resultados de evaluación</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="definitions" className="rounded-lg gap-2">
            <Target className="size-4" /> Definiciones
          </TabsTrigger>
          <TabsTrigger value="results" className="rounded-lg gap-2">
            <BarChart3 className="size-4" /> Resultados
          </TabsTrigger>
        </TabsList>

        {/* ==================== DEFINITIONS TAB ==================== */}
        <TabsContent value="definitions" className="space-y-4">
          <div className="flex justify-end">
            {canPerform('HR_PERFORMANCE', 'create') && (
              <Button onClick={() => { resetDefForm(); setShowDefForm(!showDefForm); }} className="gap-2 rounded-xl font-bold" variant={showDefForm ? 'outline' : 'default'}>
                {showDefForm ? <X className="size-4" /> : <Plus className="size-4" />}
                {showDefForm ? 'Cancelar' : 'Nueva Definición'}
              </Button>
            )}
          </div>

          {showDefForm && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-primary/20 shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader className="border-b border-primary/10 bg-primary/5">
                  <CardTitle className="flex items-center gap-2 text-lg font-black">
                    <Target className="size-5 text-primary" />
                    {editingDefId ? 'Editar Definición' : 'Nueva Definición de KPI'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nombre</Label>
                      <Input value={defForm.name} onChange={e => setDefForm({ ...defForm, name: e.target.value })} placeholder="Ej: Ventas mensuales" className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Período</Label>
                      <Select value={defForm.periodType} onValueChange={v => setDefForm({ ...defForm, periodType: v })}>
                        <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PERIOD_TYPES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Asignar a</Label>
                      <Select value={defForm.assignToType} onValueChange={v => setDefForm({ ...defForm, assignToType: v })}>
                        <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ASSIGN_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                        <Target className="size-3" /> Meta
                      </Label>
                      <Input type="number" step="0.01" value={defForm.target} onChange={e => setDefForm({ ...defForm, target: Number(e.target.value) })} className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                        <Weight className="size-3" /> Peso (%)
                      </Label>
                      <Input type="number" step="0.01" value={defForm.weight} onChange={e => setDefForm({ ...defForm, weight: Number(e.target.value) })} className="rounded-xl h-11" />
                    </div>
                    {defForm.assignToType === 'INDIVIDUAL' && (
                      <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                          <User className="size-3" /> Empleado
                        </Label>
                        <select value={defForm.assignToId} onChange={e => setDefForm({ ...defForm, assignToId: e.target.value })}
                          className="flex h-11 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                          <option value="">Seleccionar...</option>
                          {employees.map((emp: any) => (
                            <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="space-y-2 md:col-span-2 lg:col-span-3">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Descripción</Label>
                      <Textarea value={defForm.description} onChange={e => setDefForm({ ...defForm, description: e.target.value })} placeholder="Descripción del indicador..." className="rounded-xl" rows={2} />
                    </div>
                  </div>
                  <Button onClick={handleSaveDef} disabled={savingDef} className="gap-2 rounded-xl font-bold">
                    {savingDef ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
                    {savingDef ? 'Guardando...' : 'Guardar'}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <div className="space-y-3">
            {definitions.length === 0 && (
              <div className="text-center py-12">
                <Target className="size-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay definiciones de KPI</p>
              </div>
            )}
            {definitions.map((d, i) => (
              <motion.div key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <Card className={cn("border-border/40 shadow-sm", !d.isActive && "opacity-60")}>
                  <CardContent className="p-5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Target className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black text-base">{d.name}</p>
                            {!d.isActive && <Badge variant="secondary" className="text-[10px]">Inactivo</Badge>}
                          </div>
                          {d.description && <p className="text-xs text-muted-foreground mt-1">{d.description}</p>}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="size-3" /> {PERIOD_LABELS[d.periodType] || d.periodType}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="size-3" /> {ASSIGN_LABELS[d.assignToType] || d.assignToType}
                            </span>
                            <span className="flex items-center gap-1">
                              <Target className="size-3" /> Meta: <strong className="text-foreground">{d.target ?? '—'}</strong>
                            </span>
                            <span className="flex items-center gap-1">
                              <Weight className="size-3" /> Peso: <strong className="text-foreground">{d.weight}%</strong>
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {canPerform('HR_PERFORMANCE', 'edit') && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => openEditDef(d)} className="rounded-xl h-9 text-xs font-bold">
                              <Edit3 className="size-3 mr-1" /> Editar
                            </Button>
                            <button
                              title={d.isActive ? 'Desactivar' : 'Activar'}
                              onClick={async () => {
                                try {
                                  await hrService.updateKpiDefinition(d.id, { isActive: !d.isActive });
                                  toast.success(d.isActive ? 'KPI desactivado' : 'KPI activado');
                                  fetchAll();
                                } catch (e: any) {
                                  toast.error(e?.response?.data?.message || 'Error al cambiar estado');
                                }
                              }}
                              className={cn(
                                "size-9 rounded-xl border flex items-center justify-center transition-all",
                                d.isActive ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/20" : "bg-muted border-border text-muted-foreground hover:bg-muted/60",
                              )}
                            >
                              <Check className="size-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* ==================== RESULTS TAB ==================== */}
        <TabsContent value="results" className="space-y-4">
          <div className="flex justify-end">
            {canPerform('HR_PERFORMANCE', 'create') && (
              <Button onClick={() => { resetResultForm(); setShowResultForm(!showResultForm); }} className="gap-2 rounded-xl font-bold" variant={showResultForm ? 'outline' : 'default'}>
                {showResultForm ? <X className="size-4" /> : <Plus className="size-4" />}
                {showResultForm ? 'Cancelar' : 'Nuevo Resultado'}
              </Button>
            )}
          </div>

          {showResultForm && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-primary/20 shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader className="border-b border-primary/10 bg-primary/5">
                  <CardTitle className="flex items-center gap-2 text-lg font-black">
                    <BarChart3 className="size-5 text-primary" />
                    Nuevo Resultado KPI
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                        <User className="size-3" /> Empleado
                      </Label>
                      <select value={resultForm.employeeId} onChange={e => setResultForm({ ...resultForm, employeeId: e.target.value })}
                        className="flex h-11 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                        <option value="">Seleccionar...</option>
                        {employees.map((emp: any) => (
                          <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                        <Target className="size-3" /> Definición KPI
                      </Label>
                      <select value={resultForm.kpiDefinitionId} onChange={e => setResultForm({ ...resultForm, kpiDefinitionId: e.target.value })}
                        className="flex h-11 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                        <option value="">Seleccionar...</option>
                        {definitions.filter(d => d.isActive).map(d => (
                          <option key={d.id} value={d.id}>{d.name} ({d.periodType})</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                        <Users className="size-3" /> Evaluador
                      </Label>
                      <select value={resultForm.evaluatorId} onChange={e => setResultForm({ ...resultForm, evaluatorId: e.target.value })}
                        className="flex h-11 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                        <option value="">Seleccionar...</option>
                        {employees.map((emp: any) => (
                          <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Inicio Período</Label>
                      <Input type="date" value={resultForm.periodStart} onChange={e => setResultForm({ ...resultForm, periodStart: e.target.value })} className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Fin Período</Label>
                      <Input type="date" value={resultForm.periodEnd} onChange={e => setResultForm({ ...resultForm, periodEnd: e.target.value })} className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                        <Target className="size-3" /> Meta
                      </Label>
                      <Input type="number" step="0.01" value={resultForm.target} onChange={e => setResultForm({ ...resultForm, target: Number(e.target.value) })} className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                        <BarChart3 className="size-3" /> Resultado Real
                      </Label>
                      <Input type="number" step="0.01" value={resultForm.actual} onChange={e => setResultForm({ ...resultForm, actual: Number(e.target.value) })} className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                        <MessageSquare className="size-3" /> Comentario
                      </Label>
                      <Input value={resultForm.comment} onChange={e => setResultForm({ ...resultForm, comment: e.target.value })} placeholder="Comentario opcional" className="rounded-xl h-11" />
                    </div>
                  </div>
                  <Button onClick={handleSaveResult} disabled={savingResult} className="gap-2 rounded-xl font-bold">
                    {savingResult ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
                    {savingResult ? 'Guardando...' : 'Crear Resultado'}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Empleado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Definición</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Período</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Cumplimiento</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold">Meta</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold">Real</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Evaluador</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Comentario</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {results.map((r) => {
                    const emp = employees.find((e: any) => e.id === r.employeeId);
                    const def = definitions.find(d => d.id === r.kpiDefinitionId);
                    const evalEmp = employees.find((e: any) => e.id === r.evaluatorId);
                    const pct = r.target ? Math.round((r.actual / r.target) * 100) : 0;
                    return (
                      <tr key={r.id} className="hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium">{emp ? `${emp.firstName} ${emp.lastName}` : r.employee?.firstName ? `${r.employee.firstName} ${r.employee.lastName}` : '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">{def?.name || r.kpiDefinition?.name || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {r.periodStart ? new Date(r.periodStart).toLocaleDateString() : ''} - {r.periodEnd ? new Date(r.periodEnd).toLocaleDateString() : ''}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 min-w-[110px]">
                            <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500')}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className={cn('text-[10px] font-black', pct >= 100 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-600' : 'text-red-600')}>
                              {pct}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-medium">{r.target ?? r.kpiDefinition?.target ?? '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            "text-sm font-bold",
                            pct >= 100 ? "text-green-600" : pct >= 70 ? "text-amber-600" : "text-red-600"
                          )}>
                            {r.actual}
                          </span>
                          {Number(r.target ?? 0) > 0 && (
                            <span className={cn(
                              "ml-1 text-[10px] font-black",
                              pct >= 100 ? "text-green-600" : pct >= 70 ? "text-amber-600" : "text-red-600"
                            )}>
                              ({pct}%)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">{evalEmp ? `${evalEmp.firstName} ${evalEmp.lastName}` : r.evaluatorId || '—'}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{r.comment || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {results.length === 0 && (
              <div className="text-center py-12">
                <BarChart3 className="size-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay resultados KPI registrados</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
