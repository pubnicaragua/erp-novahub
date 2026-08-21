import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { cn } from '../ui/utils';
import {
  Settings2, Plus, Save, RefreshCw, Check, X, FileText, Percent, DollarSign, Shield, AlertTriangle, Search, Layers, ShieldCheck, ShieldOff
} from 'lucide-react';
import { hrService } from '../../services/hr.service';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AbsenceType } from '../../types';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { StatCard } from './StatCard';
import { HRViewTutorial } from './HRViewTutorial';
import { HRCreateViewShell } from './HRCreateViewShell';

const SALARY_BASE_LABELS: Record<string, string> = {
  MONTHLY: 'Mensual',
  DAILY: 'Diario',
  MINIMUM_WAGE: 'Salario Mínimo',
  CONTRACTUAL: 'Contractual',
};

interface AbsenceTypeForm {
  code: string;
  name: string;
  paidByCompanyPct: number;
  paidByThirdPartyPct: number;
  maxDays: number;
  cap: number;
  salaryBase: string;
  requiresDoc: boolean;
  isActive: boolean;
}

const DEFAULT_FORM: AbsenceTypeForm = {
  code: '',
  name: '',
  paidByCompanyPct: 100,
  paidByThirdPartyPct: 0,
  maxDays: 0,
  cap: 0,
  salaryBase: 'MONTHLY',
  requiresDoc: false,
  isActive: true,
};

type ConfigFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'DOC';

export function AusenciasConfigView({ onRefresh }: { onRefresh?: () => void }) {
  const { canPerform } = useAuth();
  const canViewHr = canPerform('HR', 'view');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AbsenceTypeForm>(DEFAULT_FORM);
  const [filter, setFilter] = useState<ConfigFilter>('ALL');
  const [search, setSearch] = useState('');

  const absenceQuery = useQuery({
    queryKey: ['hr', 'absence-types'],
    queryFn: ({ signal }) => hrService.getAbsenceTypes(signal) as any,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: canViewHr,
  });
  const loading = absenceQuery.isLoading;
  const absenceTypes = (Array.isArray(absenceQuery.data) ? absenceQuery.data : absenceQuery.data?.data || []) as AbsenceType[];
  const fetchAbsenceTypes = () => queryClient.invalidateQueries({ queryKey: ['hr', 'absence-types'] });

  const colFilters = useColumnFilters();

  const totalTypes = absenceTypes.length;
  const activeTypes = absenceTypes.filter(at => at.isActive).length;
  const inactiveTypes = totalTypes - activeTypes;
  const docRequired = absenceTypes.filter(at => at.requiresDoc).length;

  const searchFiltered = absenceTypes.filter(at => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return at.name.toLowerCase().includes(q) || at.code.toLowerCase().includes(q);
  });
  const stateFiltered = searchFiltered.filter(at => {
    if (filter === 'ACTIVE') return at.isActive;
    if (filter === 'INACTIVE') return !at.isActive;
    if (filter === 'DOC') return at.requiresDoc;
    return true;
  });
  const filteredTypes = colFilters.applyTo(stateFiltered, {
    state: (at) => (at.isActive ? 'ACTIVE' : 'INACTIVE'),
    name: (at) => at.name,
    salaryBase: (at) => String(at.salaryBase || ''),
  });

  const stateOptionsForFilter = [
    { value: 'ACTIVE', label: 'Activo', count: stateFiltered.filter(at => at.isActive).length },
    { value: 'INACTIVE', label: 'Inactivo', count: stateFiltered.filter(at => !at.isActive).length },
  ];
  const nameOptionsForFilter = [...new Map(searchFiltered.map((at) => [at.name, at.name])).entries()]
    .map(([, label]) => ({ value: label, label, count: searchFiltered.filter(at => at.name === label).length }));

  const resetForm = () => {
    setForm(DEFAULT_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  const openEdit = (at: AbsenceType) => {
    setForm({
      code: at.code,
      name: at.name,
      paidByCompanyPct: at.paidByCompanyPct,
      paidByThirdPartyPct: at.paidByThirdPartyPct,
      maxDays: at.maxDays ?? 0,
      cap: at.cap ?? 0,
      salaryBase: at.salaryBase,
      requiresDoc: at.requiresDoc,
      isActive: at.isActive,
    });
    setEditingId(at.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name) {
      toast.error('Código y nombre son requeridos');
      return;
    }
    if (form.paidByCompanyPct < 0 || form.paidByThirdPartyPct < 0) {
      toast.error('Los porcentajes no pueden ser negativos');
      return;
    }
    if (form.paidByCompanyPct + form.paidByThirdPartyPct > 100) {
      toast.error('La suma de pagos (empresa + tercero) no puede superar el 100%');
      return;
    }
    if (form.maxDays < 0 || form.cap < 0) {
      toast.error('Días máximos y tope no pueden ser negativos');
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        await hrService.updateAbsenceType(editingId, form);
        toast.success('Tipo de ausencia actualizado');
      } else {
        await hrService.createAbsenceType(form);
        toast.success('Tipo de ausencia creado');
      }
      resetForm();
      fetchAbsenceTypes();
      onRefresh?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (at: AbsenceType) => {
    try {
      await hrService.updateAbsenceType(at.id, { isActive: !at.isActive });
      toast.success(at.isActive ? 'Desactivado' : 'Activado');
      fetchAbsenceTypes();
    } catch {
      toast.error('Error al cambiar estado');
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
          <p className="text-sm font-bold text-muted-foreground tracking-wide">Cargando tipos de ausencia...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={cn('flex flex-col sm:flex-row sm:items-start md:items-center justify-between gap-4', showForm && 'hidden')} data-tour="hr-absence-types-title">
        <div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Settings2 className="size-6 text-primary" />
            Configuración de Tipos de Ausencia
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {canPerform('HR_LEAVES', 'create') && (
            <Button onClick={() => { resetForm(); setShowForm(!showForm); }} className={showForm ? 'h-10 gap-2 rounded-xl' : 'h-10 gap-2 rounded-xl border border-primary/20 bg-primary px-4 text-[10px] font-black uppercase tracking-widest !text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90'} variant={showForm ? 'outline' : 'default'}>
              {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
              {showForm ? 'Cancelar' : 'Nuevo Tipo'}
            </Button>
          )}
          <HRViewTutorial label="Cómo configurar tipos de ausencia" targetPrefix="hr-absence-types" copy={{ data: { description: 'Filtra y consulta las reglas de ausencia activas e inactivas.' }, actions: { description: 'Crea un tipo nuevo o edita sus porcentajes, topes y requisitos.' } }} />
        </div>
      </div>

      {/* Summary Cards */}
      <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4', showForm && 'hidden')} data-tour="hr-absence-types-data">
        <StatCard label="Tipos configurados" value={totalTypes} icon={Layers} tone="primary" sub="Reglas de ausencia activas e inactivas" active={filter === 'ALL'} onClick={() => setFilter('ALL')} />
        <StatCard label="Activos" value={activeTypes} icon={ShieldCheck} tone="green" sub="Disponibles en nuevas solicitudes" active={filter === 'ACTIVE'} onClick={() => setFilter('ACTIVE')} />
        <StatCard label="Inactivos" value={inactiveTypes} icon={ShieldOff} tone="red" sub="Deshabilitados de la selección" active={filter === 'INACTIVE'} onClick={() => setFilter('INACTIVE')} />
        <StatCard label="Requieren documento" value={docRequired} icon={AlertTriangle} tone="amber" sub="Justificación obligatoria" active={filter === 'DOC'} onClick={() => setFilter('DOC')} />
      </div>

      {/* Toolbar */}
      <div className={cn('flex flex-wrap items-center gap-2', showForm && 'hidden')}>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o código..."
            className="pl-8 h-9 bg-background"
          />
        </div>
        <ColumnFilterMenu
          label="Estado"
          options={stateOptionsForFilter}
          selected={colFilters.state.state?.values || []}
          onSelect={(values) => colFilters.setValues('state', values)}
          sort={colFilters.state.state?.sort || null}
          onSort={(sort) => colFilters.setSort('state', sort)}
        />
        <ColumnFilterMenu
          label="Nombre"
          options={nameOptionsForFilter}
          selected={colFilters.state.name?.values || []}
          onSelect={(values) => colFilters.setValues('name', values)}
          sort={colFilters.state.name?.sort || null}
          onSort={(sort) => colFilters.setSort('name', sort)}
        />
      </div>

      {showForm && (
        <HRCreateViewShell
          title={editingId ? 'Editar tipo de ausencia' : 'Nuevo tipo de ausencia'}
          description="Define las reglas que se aplicarán cuando el equipo registre una solicitud de ausencia."
          onBack={resetForm}
        >
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/20 shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="border-b border-primary/10 bg-primary/5" data-tour="hr-absence-type-form-title">
              <CardTitle className="flex items-center gap-2 text-lg font-black">
                {editingId ? <FileText className="size-5 text-primary" /> : <Plus className="size-5 text-primary" />}
                {editingId ? 'Editar Tipo de Ausencia' : 'Nuevo Tipo de Ausencia'}
              </CardTitle>
              <HRViewTutorial label={editingId ? 'Cómo editar tipo de ausencia' : 'Cómo crear tipo de ausencia'} targetPrefix="hr-absence-type-form" copy={{ data: { description: 'Define código, nombre, base salarial, porcentajes, tope, días máximos y requisitos.' }, actions: { description: 'Guarda la regla para que pueda utilizarse en las solicitudes.' } }} />
            </CardHeader>
            <CardContent className="pt-6 space-y-5" data-tour="hr-absence-type-form-data">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Código</Label>
                  <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="EJ: VAC" className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nombre</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Vacaciones" className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Base Salarial</Label>
                  <select value={form.salaryBase} onChange={e => setForm({ ...form, salaryBase: e.target.value })}
                    className="flex h-11 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                    <option value="MONTHLY">Mensual</option>
                    <option value="DAILY">Diario</option>
                    <option value="MINIMUM_WAGE">Salario Mínimo</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <Percent className="size-3" /> Pagado por Empresa (%)
                  </Label>
                  <Input type="number" step="0.01" value={form.paidByCompanyPct} onChange={e => setForm({ ...form, paidByCompanyPct: Number(e.target.value) })} className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <Percent className="size-3" /> Pagado por Tercero (%)
                  </Label>
                  <Input type="number" step="0.01" value={form.paidByThirdPartyPct} onChange={e => setForm({ ...form, paidByThirdPartyPct: Number(e.target.value) })} className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                    <DollarSign className="size-3" /> Tope (C$)
                  </Label>
                  <Input type="number" value={form.cap} onChange={e => setForm({ ...form, cap: Number(e.target.value) })} className="rounded-xl h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Días Máximos</Label>
                  <Input type="number" value={form.maxDays} onChange={e => setForm({ ...form, maxDays: Number(e.target.value) })} className="rounded-xl h-11" />
                </div>
                <div className="space-y-2 flex flex-col justify-end">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/30">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground cursor-pointer">Requiere Documento</Label>
                    <Switch checked={form.requiresDoc} onCheckedChange={v => setForm({ ...form, requiresDoc: v })} />
                  </div>
                </div>
                <div className="space-y-2 flex flex-col justify-end">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/30">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground cursor-pointer">Activo</Label>
                    <Switch checked={form.isActive} onCheckedChange={v => setForm({ ...form, isActive: v })} />
                  </div>
                </div>
              </div>

              {/* Coverage progress */}
              <div className="rounded-xl border border-border/40 bg-background p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cobertura de pago</p>
                  <p className={cn('text-xs font-black', form.paidByCompanyPct + form.paidByThirdPartyPct > 100 ? 'text-rose-600' : 'text-foreground')}>
                    {form.paidByCompanyPct}% + {form.paidByThirdPartyPct}% = {form.paidByCompanyPct + form.paidByThirdPartyPct}%
                  </p>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                  <div className="h-full bg-primary transition-all" style={{ width: `${Math.min(form.paidByCompanyPct, 100)}%` }} />
                  <div className="h-full bg-blue-500/60 transition-all" style={{ width: `${Math.min(form.paidByThirdPartyPct, Math.max(0, 100 - form.paidByCompanyPct))}%` }} />
                </div>
                {form.paidByCompanyPct + form.paidByThirdPartyPct > 100 && (
                  <p className="mt-2 text-[11px] font-bold text-rose-600">La suma supera el 100%. Ajusta los porcentajes.</p>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2" data-tour="hr-absence-type-form-actions">
                <Button onClick={handleSave} disabled={saving} className="gap-2 rounded-xl font-bold">
                  {saving ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
                <Button variant="outline" onClick={resetForm} className="rounded-xl">Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        </HRCreateViewShell>
      )}

      <div className={cn('space-y-3', showForm && 'hidden')} data-tour="hr-absence-types-actions">
        {filteredTypes.length === 0 && totalTypes === 0 && (
          <div className="text-center py-12">
            <AlertTriangle className="size-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No hay tipos de ausencia configurados aún</p>
            <Button onClick={() => setShowForm(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="size-4 mr-2" /> Crear primer tipo de ausencia
            </Button>
          </div>
        )}
        {filteredTypes.length === 0 && totalTypes > 0 && (
          <div className="text-center py-12">
            <AlertTriangle className="size-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay tipos de ausencia que coincidan con los filtros</p>
          </div>
        )}
        {filteredTypes.map((at, i) => (
          <motion.div key={at.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <Card className={cn("border-border/40 shadow-sm transition-all", !at.isActive && "opacity-60")}>
              <CardContent className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className={cn(
                      "size-10 rounded-xl flex items-center justify-center shrink-0",
                      at.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      <FileText className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-base">{at.name}</p>
                        <Badge className="text-[10px] font-black uppercase tracking-wider bg-muted/50">{at.code}</Badge>
                        {!at.isActive && <Badge variant="secondary" className="text-[10px]">Inactivo</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Percent className="size-3" /> Empresa: <strong className="text-foreground">{at.paidByCompanyPct}%</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <Percent className="size-3" /> Tercero: <strong className="text-foreground">{at.paidByThirdPartyPct}%</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <Shield className="size-3" /> Base: <strong className="text-foreground">{SALARY_BASE_LABELS[at.salaryBase] || at.salaryBase}</strong>
                        </span>
                        {Number(at.maxDays ?? 0) > 0 && <span>Máx: <strong className="text-foreground">{at.maxDays} días</strong></span>}
                        {Number(at.cap ?? 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="size-3" /> Tope: <strong className="text-foreground">C${Number(at.cap).toLocaleString()}</strong>
                          </span>
                        )}
                        <span className={cn("flex items-center gap-1", at.requiresDoc ? "text-amber-600" : "")}>
                          {at.requiresDoc ? <AlertTriangle className="size-3" /> : <Check className="size-3 text-green-500" />}
                          {at.requiresDoc ? 'Requiere doc' : 'Sin documento'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canPerform('HR_LEAVES', 'edit') && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => openEdit(at)} className="rounded-xl h-9 text-xs font-bold">
                          Editar
                        </Button>
                        <Switch checked={at.isActive} onCheckedChange={() => toggleActive(at)} />
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
