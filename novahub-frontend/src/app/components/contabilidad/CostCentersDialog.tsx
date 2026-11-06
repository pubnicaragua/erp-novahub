import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from '@/app/services/toast';
import { contabilidadService, type CostCenter, type CostCenterReport } from '../../services/contabilidad.service';

const COST_CENTER_TYPES: Record<string, string> = {
  DEPARTMENT: 'Área / departamento',
  PROJECT: 'Proyecto',
  REGION: 'Región',
  BRANCH: 'Sucursal',
  OTHER: 'Otro',
};

const money = (value: number) => Number(value || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const errorMessage = (error: unknown, fallback: string) => {
  const e = error as { response?: { data?: { message?: string } }; message?: string } | undefined;
  return e?.response?.data?.message || e?.message || fallback;
};

/** Crear o editar un centro de costo. El código no se puede cambiar después porque ya viaja en los asientos. */
export function CostCenterFormDialog({
  open, onOpenChange, center, onSaved,
}: { open: boolean; onOpenChange: (open: boolean) => void; center?: CostCenter | null; onSaved: (center: CostCenter) => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('DEPARTMENT');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCode(center?.code ?? '');
    setName(center?.name ?? '');
    setType(center?.type ?? 'DEPARTMENT');
  }, [open, center]);

  const save = async () => {
    if (!name.trim() || (!center && !code.trim())) { toast.error('Código y nombre son obligatorios'); return; }
    setSaving(true);
    try {
      const saved = center
        ? await contabilidadService.updateCostCenter(center.id, { name: name.trim(), type })
        : await contabilidadService.createCostCenter({ code: code.trim(), name: name.trim(), type });
      toast.success(center ? 'Centro de costo actualizado' : 'Centro de costo creado');
      onSaved(saved);
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo guardar el centro de costo'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{center ? 'Editar centro de costo' : 'Nuevo centro de costo'}</DialogTitle>
          <DialogDescription>El centro indica de qué área viene cada movimiento. No es una cuenta contable.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold">Código *</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} disabled={!!center} placeholder="Ej: 09-26-00" className="rounded-xl font-mono text-sm" />
            {center && <p className="text-xs text-muted-foreground">El código no se cambia porque ya está en asientos y reportes.</p>}
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold">Nombre del área *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Empaque" className="rounded-xl text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold">Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="rounded-xl text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(COST_CENTER_TYPES).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={() => void save()} disabled={saving}>{saving && <Loader2 className="mr-1 size-4 animate-spin" />}Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);

/** Modal para ver, crear, editar y activar/desactivar centros de costo, y ver ingresos por área. */
export function CostCentersDialog({ open, onOpenChange, canEdit }: { open: boolean; onOpenChange: (open: boolean) => void; canEdit: boolean }) {
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [dateFrom, setDateFrom] = useState(monthStart());
  const [dateTo, setDateTo] = useState(today());
  const [report, setReport] = useState<CostCenterReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setCenters(await contabilidadService.getCostCenters()); }
    catch (error) { toast.error(errorMessage(error, 'No se pudieron cargar los centros de costo')); }
    finally { setLoading(false); }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (open) void load(); }, [open, load]);

  const toggle = async (center: CostCenter) => {
    try {
      await contabilidadService.updateCostCenter(center.id, { isActive: !center.isActive });
      setCenters((list) => list.map((item) => item.id === center.id ? { ...item, isActive: !center.isActive } : item));
    } catch (error) { toast.error(errorMessage(error, 'No se pudo cambiar el estado')); }
  };

  const loadReport = async () => {
    setReportLoading(true);
    try { setReport(await contabilidadService.getCostCenterReport(dateFrom, dateTo)); }
    catch (error) { toast.error(errorMessage(error, 'No se pudo generar el reporte')); }
    finally { setReportLoading(false); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Centros de costo</DialogTitle>
            <DialogDescription>Áreas o departamentos que acompañan a las cuentas en cada movimiento. Son aparte del catálogo de cuentas.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="centros">
            <TabsList>
              <TabsTrigger value="centros">Centros</TabsTrigger>
              <TabsTrigger value="reporte">Ingresos y gastos por área</TabsTrigger>
            </TabsList>
            <TabsContent value="centros" className="space-y-3 pt-3">
              {canEdit && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="mr-1 size-4" /> Nuevo centro</Button>
                </div>
              )}
              {loading ? <div className="flex justify-center p-6"><Loader2 className="size-5 animate-spin" /></div> : centers.length === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Aún no hay centros de costo. Crea el primero con "Nuevo centro".</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs"><tr><th className="p-2">Código</th><th className="p-2">Nombre</th><th className="p-2">Tipo</th><th className="p-2">Activo</th><th className="p-2" /></tr></thead>
                    <tbody>
                      {centers.map((center) => (
                        <tr key={center.id} className="border-t">
                          <td className="p-2 font-mono text-xs">{center.code}</td>
                          <td className="p-2">{center.name}</td>
                          <td className="p-2"><Badge variant="outline">{COST_CENTER_TYPES[center.type ?? 'OTHER'] ?? center.type}</Badge></td>
                          <td className="p-2"><Switch checked={center.isActive} disabled={!canEdit} onCheckedChange={() => void toggle(center)} aria-label={`Activar ${center.name}`} /></td>
                          <td className="p-2 text-right">{canEdit && <Button variant="ghost" size="icon" className="size-7" title="Editar" onClick={() => { setEditing(center); setFormOpen(true); }}><Pencil className="size-3.5" /></Button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Un centro inactivo ya no se puede elegir en movimientos nuevos; los anteriores se conservan.</p>
            </TabsContent>
            <TabsContent value="reporte" className="space-y-3 pt-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1"><Label className="text-xs">Desde</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-40" /></div>
                <div className="space-y-1"><Label className="text-xs">Hasta</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-40" /></div>
                <Button size="sm" onClick={() => void loadReport()} disabled={reportLoading || !dateFrom || !dateTo}>{reportLoading && <Loader2 className="mr-1 size-4 animate-spin" />}Ver reporte</Button>
              </div>
              {report && (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs"><tr><th className="p-2">Área</th><th className="p-2 text-right">Ingresos</th><th className="p-2 text-right">Gastos</th><th className="p-2 text-right">Resultado</th></tr></thead>
                    <tbody>
                      {report.centros.map((c) => <tr key={c.centroId} className="border-t"><td className="p-2">{c.codigo} · {c.nombre}</td><td className="p-2 text-right tabular-nums">{money(c.ingresos)}</td><td className="p-2 text-right tabular-nums">{money(c.gastos)}</td><td className="p-2 text-right tabular-nums">{money(c.resultado)}</td></tr>)}
                      <tr className="border-t text-muted-foreground"><td className="p-2">Sin centro de costo</td><td className="p-2 text-right tabular-nums">{money(report.sinCentro.ingresos)}</td><td className="p-2 text-right tabular-nums">{money(report.sinCentro.gastos)}</td><td className="p-2 text-right tabular-nums">{money(report.sinCentro.resultado)}</td></tr>
                      <tr className="border-t font-semibold"><td className="p-2">Total (igual al Estado de Resultados)</td><td className="p-2 text-right tabular-nums">{money(report.totalIngresos)}</td><td className="p-2 text-right tabular-nums">{money(report.totalGastos)}</td><td className="p-2 text-right tabular-nums">{money(report.resultado)}</td></tr>
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      <CostCenterFormDialog open={formOpen} onOpenChange={setFormOpen} center={editing} onSaved={() => void load()} />
    </>
  );
}
