import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { cn } from '../ui/utils';
import {
  Settings2, Plus, Save, RefreshCw, Check, X, FileText, Percent, DollarSign, Shield, AlertTriangle
} from 'lucide-react';
import { hrService } from '../../services/hr.service';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AbsenceType } from '../../types';

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

export function AusenciasConfigView({ onRefresh }: { onRefresh?: () => void }) {
  const { canPerform } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AbsenceTypeForm>(DEFAULT_FORM);

  const absenceQuery = useQuery({
    queryKey: ['hr', 'absence-types'],
    queryFn: ({ signal }) => hrService.getAbsenceTypes(signal) as any,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const loading = absenceQuery.isLoading;
  const absenceTypes = (Array.isArray(absenceQuery.data) ? absenceQuery.data : absenceQuery.data?.data || []) as AbsenceType[];
  const fetchAbsenceTypes = () => queryClient.invalidateQueries({ queryKey: ['hr', 'absence-types'] });

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
    } catch (error: any) {
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
      <div className="flex flex-col sm:flex-row sm:items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Settings2 className="size-6 text-primary" />
            Configuración de Tipos de Ausencia
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Define los tipos de ausencia, porcentajes de pago y reglas aplicables
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canPerform('HR_LEAVE', 'create') && (
            <Button onClick={() => { resetForm(); setShowForm(!showForm); }} className="gap-2 rounded-xl font-bold" variant={showForm ? 'outline' : 'default'}>
              {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
              {showForm ? 'Cancelar' : 'Nuevo Tipo'}
            </Button>
          )}
        </div>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/20 shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="border-b border-primary/10 bg-primary/5">
              <CardTitle className="flex items-center gap-2 text-lg font-black">
                {editingId ? <FileText className="size-5 text-primary" /> : <Plus className="size-5 text-primary" />}
                {editingId ? 'Editar Tipo de Ausencia' : 'Nuevo Tipo de Ausencia'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
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
              <div className="flex items-center gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving} className="gap-2 rounded-xl font-bold">
                  {saving ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
                <Button variant="outline" onClick={resetForm} className="rounded-xl">Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="space-y-3">
        {absenceTypes.length === 0 && (
          <div className="text-center py-12">
            <AlertTriangle className="size-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No hay tipos de ausencia configurados</p>
          </div>
        )}
        {absenceTypes.map((at, i) => (
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
                          <Shield className="size-3" /> Base: <strong className="text-foreground">{at.salaryBase}</strong>
                        </span>
                        {at.maxDays > 0 && <span>Máx: <strong className="text-foreground">{at.maxDays} días</strong></span>}
                        {at.cap > 0 && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="size-3" /> Tope: <strong className="text-foreground">C${at.cap.toLocaleString()}</strong>
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
                    {canPerform('HR_LEAVE', 'edit') && (
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
