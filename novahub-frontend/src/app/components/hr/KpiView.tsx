import { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../ui/dialog';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { cn } from '../ui/utils';
import {
  BarChart3, Plus, Save, RefreshCw, Check, Target, Weight, Calendar, Users, User, MessageSquare, Edit3, Search, AlertTriangle, TrendingUp
} from 'lucide-react';
import { hrService } from '../../services/hr.service';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type { KpiDefinition, KpiResult } from '../../types';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { StatCard } from './StatCard';
import { HRViewTutorial } from './HRViewTutorial';
import { formatDateEs } from '../../utils/dateFormat';

interface KpiViewProps {
  employees?: any[];
  departments?: any[];
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

const COMPLIANCE_LABELS: Record<string, { label: string; badge: string; bar: string }> = {
  OVER: { label: 'Sobre meta', badge: 'bg-green-100 text-green-700', bar: 'bg-emerald-500' },
  RISK: { label: 'En riesgo', badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500' },
  UNDER: { label: 'Bajo meta', badge: 'bg-red-100 text-red-700', bar: 'bg-red-500' },
  NO_TARGET: { label: 'Sin meta', badge: 'bg-gray-100 text-gray-600', bar: 'bg-gray-300' },
};

const resultPct = (r: KpiResult) => {
  const target = Number(r.target ?? r.kpiDefinition?.target ?? 0);
  if (!target) return null;
  return Math.round((Number(r.actual ?? 0) / target) * 100);
};

const resultCompliance = (r: KpiResult): string => {
  const pct = resultPct(r);
  if (pct === null) return 'NO_TARGET';
  if (pct >= 100) return 'OVER';
  if (pct >= 70) return 'RISK';
  return 'UNDER';
};

export function KpiView({ employees = [], departments = [], onRefresh }: KpiViewProps) {
  const { canPerform } = useAuth();
  const canViewHr = canPerform('HR', 'view');
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('definitions');

  const [showDefForm, setShowDefForm] = useState(false);
  const [editingDefId, setEditingDefId] = useState<string | null>(null);
  const [savingDef, setSavingDef] = useState(false);
  const [defForm, setDefForm] = useState(defaultKpiDef());

  const [showResultForm, setShowResultForm] = useState(false);
  const [savingResult, setSavingResult] = useState(false);
  const [resultForm, setResultForm] = useState(defaultKpiResult());

  const [defSearch, setDefSearch] = useState('');
  const [resultSearch, setResultSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE_OPTIONS = [10, 15, 25, 30, 35, 40, 45, 50];

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
    enabled: canViewHr,
    placeholderData: keepPreviousData,
  });
  const loading = kpiQuery.isLoading;
  const definitions = (kpiQuery.data?.definitions || []) as KpiDefinition[];
  const results = (kpiQuery.data?.results || []) as KpiResult[];
  const fetchAll = () => queryClient.invalidateQueries({ queryKey: ['hr', 'kpi-data'] });

  const defColFilters = useColumnFilters();
  const resultColFilters = useColumnFilters();

  const resetDefForm = () => { setDefForm(defaultKpiDef()); setEditingDefId(null); setShowDefForm(false); };
  const openEditDef = (d: KpiDefinition) => {
    setDefForm({ name: d.name, description: d.description || '', target: d.target ?? 0, weight: d.weight, periodType: d.periodType, assignToType: d.assignToType, assignToId: d.assignToId || '', isActive: d.isActive });
    setEditingDefId(d.id);
    setShowDefForm(true);
  };

  const handleSaveDef = async () => {
    if (!defForm.name) { toast.error('Nombre es requerido'); return; }
    if (defForm.weight <= 0 || defForm.weight > 100) { toast.error('El peso debe estar entre 1 y 100'); return; }
    const otherWeight = definitions
      .filter(d => d.isActive && d.id !== editingDefId)
      .reduce((sum, d) => sum + (Number(d.weight) || 0), 0);
    if (otherWeight + defForm.weight > 100) {
      toast.error(`La suma de pesos de KPI activos supera 100% (ya hay ${otherWeight}% asignados)`);
      return;
    }
    try {
      setSavingDef(true);
      const data: any = {
        ...defForm,
        target: defForm.target || undefined,
        assignToId: defForm.assignToType === 'INDIVIDUAL' ? defForm.assignToId : (defForm.assignToType === 'DEPARTMENT' ? defForm.assignToId : undefined),
      };
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

  const defName = (d: any) => d?.name || '';
  const empName = (e: any) => (e ? `${e.firstName || ''} ${e.lastName || ''}`.trim() : '');

  const filteredDefinitions = (() => {
    const q = defSearch.trim().toLowerCase();
    const searched = !q ? definitions : definitions.filter(d =>
      d.name.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q)
    );
    return defColFilters.applyTo(searched, {
      name: (d: KpiDefinition) => d.name,
      state: (d: KpiDefinition) => (d.isActive ? 'ACTIVE' : 'INACTIVE'),
      period: (d: KpiDefinition) => d.periodType,
      assign: (d: KpiDefinition) => d.assignToType,
    });
  })();

  const activeDefs = definitions.filter(d => d.isActive).length;

  const filteredResults = (() => {
    const q = resultSearch.trim().toLowerCase();
    const searched = !q ? results : results.filter(r => {
      const emp = r.employee || employees.find((e: any) => e.id === r.employeeId);
      const def = r.kpiDefinition || definitions.find(d => d.id === r.kpiDefinitionId);
      return empName(emp).toLowerCase().includes(q)
        || (defName(def) || '').toLowerCase().includes(q)
        || (r.comment || '').toLowerCase().includes(q);
    });
    return resultColFilters.applyTo(searched, {
      employee: (r: KpiResult) => empName(r.employee || employees.find((e: any) => e.id === r.employeeId)) || 'Sin empleado',
      definition: (r: KpiResult) => defName(r.kpiDefinition || definitions.find(d => d.id === r.kpiDefinitionId)) || 'Sin definir',
      compliance: (r: KpiResult) => resultCompliance(r),
      periodStart: (r: KpiResult) => (r.periodStart ? new Date(r.periodStart).getTime() : null),
    });
  })();

  const resultEmployeeOptions = [...new Map(results.map((r: KpiResult) => {
    const name = empName(r.employee || employees.find((e: any) => e.id === r.employeeId)) || 'Sin empleado';
    return [name, name] as const;
  })).entries()].map(([, label]) => ({ value: label, label, count: results.filter(r => (empName(r.employee || employees.find((e: any) => e.id === r.employeeId)) || 'Sin empleado') === label).length }));
  const resultDefinitionOptions = [...new Map(results.map((r: KpiResult) => {
    const name = defName(r.kpiDefinition || definitions.find(d => d.id === r.kpiDefinitionId)) || 'Sin definir';
    return [name, name] as const;
  })).entries()].map(([, label]) => ({ value: label, label, count: results.filter(r => (defName(r.kpiDefinition || definitions.find(d => d.id === r.kpiDefinitionId)) || 'Sin definir') === label).length }));
  const complianceOptions = Object.entries(COMPLIANCE_LABELS).map(([value, c]) => ({
    value,
    label: c.label,
    count: results.filter(r => resultCompliance(r) === value).length,
  }));

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / pageSize));
  const paginatedResults = filteredResults.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const pctValues = results.map(resultPct).filter((p): p is number => p !== null);
  const avgCompliance = pctValues.length > 0 ? Math.round(pctValues.reduce((a, b) => a + b, 0) / pctValues.length) : 0;
  const atRisk = results.filter(r => ['RISK', 'UNDER'].includes(resultCompliance(r))).length;

  const goToResults = (compliance?: string[]) => {
    setActiveTab('results');
    if (compliance && compliance.length > 0) {
      resultColFilters.setValues('compliance', compliance);
      setCurrentPage(1);
    }
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
      <div className="flex flex-col sm:flex-row sm:items-start md:items-center justify-between gap-4" data-tour="hr-kpi-title">
        <div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <BarChart3 className="size-6 text-primary" />
            Gestión de KPI
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Define indicadores y registra resultados de evaluación</p>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-tour="hr-kpi-actions">
          <HRViewTutorial label="Cómo gestionar KPI" targetPrefix="hr-kpi" stepKeys={['title', 'data', 'actions']} copy={{ data: { description: 'Consulta definiciones activas, resultados, cumplimiento promedio e indicadores en riesgo.' }, actions: { description: 'Crea definiciones, registra resultados y navega entre ambos procesos.' } }} />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="hr-kpi-data">
        <StatCard
          label="Definiciones activas"
          value={activeDefs}
          icon={Target}
          tone="primary"
          sub={`${definitions.length} definiciones en total`}
          active={activeTab === 'definitions'}
          onClick={() => setActiveTab('definitions')}
        />
        <StatCard
          label="Resultados registrados"
          value={results.length}
          icon={BarChart3}
          tone="blue"
          sub="Mediciones de desempeño"
          active={activeTab === 'results'}
          onClick={() => goToResults()}
        />
        <StatCard
          label="Cumplimiento promedio"
          value={pctValues.length > 0 ? `${avgCompliance}%` : '—'}
          icon={TrendingUp}
          tone="green"
          sub="Promedio de metas alcanzadas"
          active={false}
          onClick={() => goToResults()}
        />
        <StatCard
          label="En riesgo"
          value={atRisk}
          icon={AlertTriangle}
          tone="red"
          sub="Resultados por debajo de la meta"
          active={resultColFilters.state.compliance?.values?.includes('RISK') || resultColFilters.state.compliance?.values?.includes('UNDER')}
          onClick={() => goToResults(atRisk > 0 ? ['RISK', 'UNDER'] : undefined)}
        />
      </div>

      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setCurrentPage(1); }} className="space-y-4">
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={defSearch}
                  onChange={(e) => setDefSearch(e.target.value)}
                  placeholder="Buscar definición..."
                  className="pl-8 h-9 w-56 bg-background"
                />
              </div>
              <ColumnFilterMenu
                label="Estado"
                options={[
                  { value: 'ACTIVE', label: 'Activa', count: definitions.filter(d => d.isActive).length },
                  { value: 'INACTIVE', label: 'Inactiva', count: definitions.filter(d => !d.isActive).length },
                ]}
                selected={defColFilters.state.state?.values || []}
                onSelect={(values) => defColFilters.setValues('state', values)}
                sort={defColFilters.state.state?.sort || null}
                onSort={(sort) => defColFilters.setSort('state', sort)}
              />
              <ColumnFilterMenu
                label="Asignación"
                options={ASSIGN_TYPES.map(a => ({ value: a.value, label: a.label, count: definitions.filter(d => d.assignToType === a.value).length }))}
                selected={defColFilters.state.assign?.values || []}
                onSelect={(values) => defColFilters.setValues('assign', values)}
                sort={defColFilters.state.assign?.sort || null}
                onSort={(sort) => defColFilters.setSort('assign', sort)}
              />
            </div>
            {canPerform('HR_PERFORMANCE', 'create') && (
              <Button onClick={() => { resetDefForm(); setShowDefForm(true); }} className="h-10 gap-2 rounded-xl border border-primary/20 bg-primary px-4 text-[10px] font-black uppercase tracking-widest !text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90">
                <Plus className="size-4" /> Nueva Definición
              </Button>
            )}
          </div>

          <div className="space-y-3" data-tour="hr-kpi-definitions-items">
            {filteredDefinitions.length === 0 && (
              <div className="text-center py-12">
                <Target className="size-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay definiciones de KPI que coincidan con los filtros</p>
              </div>
            )}
            {filteredDefinitions.map((d, i) => (
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
                            {d.assignToType === 'INDIVIDUAL' && d.assignToId && (() => {
                              const emp = employees.find((e: any) => e.id === d.assignToId);
                              return emp ? (
                                <span className="flex items-center gap-1">
                                  <User className="size-3" /> <strong className="text-foreground">{empName(emp)}</strong>
                                </span>
                              ) : null;
                            })()}
                            {d.assignToType === 'DEPARTMENT' && d.assignToId && (() => {
                              const dept = departments.find((dp: any) => dp.id === d.assignToId);
                              return dept ? (
                                <span className="flex items-center gap-1">
                                  <Users className="size-3" /> <strong className="text-foreground">{dept.name}</strong>
                                </span>
                              ) : null;
                            })()}
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={resultSearch}
                  onChange={(e) => { setResultSearch(e.target.value); setCurrentPage(1); }}
                  placeholder="Buscar empleado, indicador, comentario..."
                  className="pl-8 h-9 w-64 bg-background"
                />
              </div>
              <ColumnFilterMenu
                label="Empleado"
                options={resultEmployeeOptions}
                selected={resultColFilters.state.employee?.values || []}
                onSelect={(values) => resultColFilters.setValues('employee', values)}
                sort={resultColFilters.state.employee?.sort || null}
                onSort={(sort) => resultColFilters.setSort('employee', sort)}
              />
              <ColumnFilterMenu
                label="Definición"
                options={resultDefinitionOptions}
                selected={resultColFilters.state.definition?.values || []}
                onSelect={(values) => resultColFilters.setValues('definition', values)}
                sort={resultColFilters.state.definition?.sort || null}
                onSort={(sort) => resultColFilters.setSort('definition', sort)}
              />
              <ColumnFilterMenu
                label="Cumplimiento"
                options={complianceOptions}
                selected={resultColFilters.state.compliance?.values || []}
                onSelect={(values) => resultColFilters.setValues('compliance', values)}
                sort={resultColFilters.state.compliance?.sort || null}
                onSort={(sort) => resultColFilters.setSort('compliance', sort)}
              />
              <ColumnFilterMenu
                label="Período"
                sort={resultColFilters.state.periodStart?.sort || null}
                onSort={(sort) => resultColFilters.setSort('periodStart', sort)}
                sortOptions={[{ value: 'desc', label: 'Más recientes' }, { value: 'asc', label: 'Más antiguos' }]}
              />
            </div>
            {canPerform('HR_PERFORMANCE', 'create') && (
              <Button onClick={() => { resetResultForm(); setShowResultForm(true); }} className="h-10 gap-2 rounded-xl border border-primary/20 bg-primary px-4 text-[10px] font-black uppercase tracking-widest !text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90">
                <Plus className="size-4" /> Nuevo Resultado
              </Button>
            )}
          </div>

          <div className="border rounded-lg overflow-hidden" data-tour="hr-kpi-results-items">
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
                  {paginatedResults.map((r) => {
                    const emp = r.employee || employees.find((e: any) => e.id === r.employeeId);
                    const def = r.kpiDefinition || definitions.find(d => d.id === r.kpiDefinitionId);
                    const evalEmp = employees.find((e: any) => e.id === r.evaluatorId);
                    const pct = resultPct(r);
                    const compliance = COMPLIANCE_LABELS[resultCompliance(r)];
                    return (
                      <tr key={r.id} className="hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium">{empName(emp) || '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">{defName(def) || '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {r.periodStart ? formatDateEs(r.periodStart) : ''} - {r.periodEnd ? formatDateEs(r.periodEnd) : ''}
                        </td>
                        <td className="px-4 py-3">
                          {pct === null ? (
                            <span className={cn('text-[10px] font-black px-2 py-1 rounded', compliance.badge)}>Sin meta</span>
                          ) : (
                            <div className="flex items-center gap-2 min-w-[130px]">
                              <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={cn('h-full rounded-full transition-all', compliance.bar)}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                              <span className={cn('text-[10px] font-black', pct >= 100 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-600' : 'text-red-600')}>
                                {pct}%
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-medium">{r.target ?? def?.target ?? '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn(
                            "text-sm font-bold",
                            pct === null ? 'text-muted-foreground' : pct >= 100 ? "text-green-600" : pct >= 70 ? "text-amber-600" : "text-red-600"
                          )}>
                            {r.actual}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{evalEmp ? empName(evalEmp) : r.evaluatorId || '—'}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{r.comment || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredResults.length === 0 && (
              <div className="text-center py-12">
                <BarChart3 className="size-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No hay resultados KPI registrados</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {filteredResults.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-border/20">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="h-8 rounded-lg border bg-background px-2 font-bold text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer">
                  {PAGE_SIZE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <p className="bg-primary/5 px-3 py-1 rounded-full border border-primary/10">
                  Mostrando <span className="text-foreground font-black">{(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredResults.length)}</span> de <span className="text-primary font-black">{filteredResults.length}</span> resultados
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border hover:bg-muted disabled:opacity-30 transition-all"
                >
                  Anterior
                </button>
                <div className="flex items-center px-4 h-9 rounded-lg border bg-muted/30 font-black text-xs">
                  Pág. {currentPage} / {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border hover:bg-muted disabled:opacity-30 transition-all"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ==================== DEFINITION DIALOG ==================== */}
      <Dialog open={showDefForm} onOpenChange={(open) => { if (!open) resetDefForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader data-tour="hr-kpi-definition-form-title">
            <DialogTitle className="flex items-center gap-2 text-lg font-black">
              <Target className="size-5 text-primary" />
              {editingDefId ? 'Editar Definición' : 'Nueva Definición de KPI'}
            </DialogTitle>
            <HRViewTutorial label={editingDefId ? 'Cómo editar definición KPI' : 'Cómo crear definición KPI'} targetPrefix="hr-kpi-definition-form" copy={{ data: { description: 'Define nombre, período, asignación, meta, peso y estado del indicador.' }, actions: { description: 'Guarda la definición para comenzar a medir el desempeño.' } }} />
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2" data-tour="hr-kpi-definition-form-data">
            <div className="space-y-2 md:col-span-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nombre *</Label>
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
            {defForm.assignToType === 'INDIVIDUAL' && (
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  <User className="size-3" /> Empleado
                </Label>
                <Select value={defForm.assignToId} onValueChange={v => setDefForm({ ...defForm, assignToId: v })}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Seleccionar empleado..." /></SelectTrigger>
                  <SelectContent>
                    {employees.map((emp: any) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {defForm.assignToType === 'DEPARTMENT' && (
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  <Users className="size-3" /> Departamento
                </Label>
                <Select value={defForm.assignToId} onValueChange={v => setDefForm({ ...defForm, assignToId: v })}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Seleccionar departamento..." /></SelectTrigger>
                  <SelectContent>
                    {departments.map((dp: any) => (
                      <SelectItem key={dp.id} value={dp.id}>{dp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
              <p className="text-[10px] text-muted-foreground">
                Pesos ya asignados a KPI activos: <strong className="text-foreground">{definitions.filter(d => d.isActive && d.id !== editingDefId).reduce((s, d) => s + (Number(d.weight) || 0), 0)}%</strong>
              </p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Descripción</Label>
              <Textarea value={defForm.description} onChange={e => setDefForm({ ...defForm, description: e.target.value })} placeholder="Descripción del indicador..." className="rounded-xl" rows={2} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/30 md:col-span-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground cursor-pointer">Definición activa</Label>
              <Switch checked={defForm.isActive} onCheckedChange={v => setDefForm({ ...defForm, isActive: v })} />
            </div>
          </div>
          <DialogFooter className="gap-2" data-tour="hr-kpi-definition-form-actions">
            <DialogClose asChild>
              <Button variant="outline" className="rounded-xl">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveDef} disabled={savingDef} className="gap-2 rounded-xl font-bold">
              {savingDef ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
              {savingDef ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==================== RESULT DIALOG ==================== */}
      <Dialog open={showResultForm} onOpenChange={(open) => { if (!open) resetResultForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader data-tour="hr-kpi-result-form-title">
            <DialogTitle className="flex items-center gap-2 text-lg font-black">
              <BarChart3 className="size-5 text-primary" />
              Nuevo Resultado KPI
            </DialogTitle>
            <HRViewTutorial label="Cómo registrar resultado KPI" targetPrefix="hr-kpi-result-form" copy={{ data: { description: 'Selecciona empleado, definición, evaluador, período, meta y resultado real.' }, actions: { description: 'Guarda la medición para actualizar los indicadores de cumplimiento.' } }} />
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2" data-tour="hr-kpi-result-form-data">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <User className="size-3" /> Empleado *
              </Label>
              <Select value={resultForm.employeeId} onValueChange={v => setResultForm({ ...resultForm, employeeId: v })}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {employees.map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <Target className="size-3" /> Definición KPI *
              </Label>
              <Select
                value={resultForm.kpiDefinitionId}
                onValueChange={v => {
                  const def = definitions.find(d => d.id === v);
                  setResultForm({
                    ...resultForm,
                    kpiDefinitionId: v,
                    target: def && def.target ? Number(def.target) : resultForm.target,
                  });
                }}
              >
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {definitions.filter(d => d.isActive).map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name} ({PERIOD_LABELS[d.periodType] || d.periodType})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <Users className="size-3" /> Evaluador
              </Label>
              <Select value={resultForm.evaluatorId} onValueChange={v => setResultForm({ ...resultForm, evaluatorId: v })}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {employees.map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Inicio Período *</Label>
              <Input type="date" value={resultForm.periodStart} onChange={e => setResultForm({ ...resultForm, periodStart: e.target.value })} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Fin Período *</Label>
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
                <BarChart3 className="size-3" /> Resultado Real *
              </Label>
              <Input type="number" step="0.01" value={resultForm.actual} onChange={e => setResultForm({ ...resultForm, actual: Number(e.target.value) })} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <MessageSquare className="size-3" /> Comentario
              </Label>
              <Textarea value={resultForm.comment} onChange={e => setResultForm({ ...resultForm, comment: e.target.value })} placeholder="Comentario opcional sobre el resultado" className="rounded-xl" rows={2} />
            </div>
          </div>
          <DialogFooter className="gap-2" data-tour="hr-kpi-result-form-actions">
            <DialogClose asChild>
              <Button variant="outline" className="rounded-xl">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveResult} disabled={savingResult} className="gap-2 rounded-xl font-bold">
              {savingResult ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
              {savingResult ? 'Guardando...' : 'Crear Resultado'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
