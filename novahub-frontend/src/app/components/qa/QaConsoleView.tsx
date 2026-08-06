import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock,
  Search, Play, Bug, ChevronRight, Zap, CircleDot, Trash2, Pencil,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import { Checkbox } from '../ui/checkbox';
import { qaService, QaCheck, QaFinding, QaModuleSummary, QaStepResult, QaSummary } from '../../services/qa.service';

const STATUS_META: Record<string, { label: string; className: string; icon: any }> = {
  FUNCIONAL: { label: 'Funcional', className: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30', icon: CheckCircle2 },
  PARCIAL: { label: 'Parcial', className: 'bg-amber-500/15 text-amber-500 border-amber-500/30', icon: AlertTriangle },
  FALLIDO: { label: 'Fallido', className: 'bg-red-500/15 text-red-500 border-red-500/30', icon: XCircle },
  PENDIENTE: { label: 'No validado', className: 'bg-muted text-muted-foreground border-border', icon: Clock },
};

const PRIORITY_META: Record<string, { label: string; className: string }> = {
  alta: { label: 'Alta', className: 'bg-red-500/10 text-red-500 border-red-500/25' },
  media: { label: 'Media', className: 'bg-amber-500/10 text-amber-500 border-amber-500/25' },
  baja: { label: 'Baja', className: 'bg-sky-500/10 text-sky-500 border-sky-500/25' },
};

const FINDING_STATUS_META: Record<string, string> = {
  ABIERTO: 'text-red-500',
  EN_PROGRESO: 'text-amber-500',
  RESUELTO: 'text-emerald-500',
  CERRADO: 'text-muted-foreground',
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || STATUS_META.PENDIENTE;
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={`gap-1 whitespace-nowrap ${meta.className}`}>
      <Icon className="size-3" /> {meta.label}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const meta = PRIORITY_META[priority] || PRIORITY_META.media;
  return <Badge variant="outline" className={`whitespace-nowrap ${meta.className}`}>{meta.label}</Badge>;
}

interface RunDialogProps {
  check: QaCheck;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}

function RunDialog({ check, open, onOpenChange, onSaved }: RunDialogProps) {
  const [stepOk, setStepOk] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    check.scenarioSteps.forEach((_, i) => {
      const prev = check.stepResults?.[i];
      if (prev && prev.ok !== null) init[i] = prev.ok;
    });
    return init;
  });
  const [notes, setNotes] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const total = check.scenarioSteps.length || 1;
  const okCount = Object.values(stepOk).filter(Boolean).length;
  const pct = Math.round((okCount / total) * 100);

  const save = async () => {
    setSaving(true);
    try {
      const stepResults: QaStepResult[] = check.scenarioSteps.map((_, i) => ({
        index: i,
        ok: stepOk[i] ?? false,
        message: stepOk[i] ? 'OK manual' : 'No verificado',
        checkedAt: new Date().toISOString(),
      }));
      const result = pct >= 100 ? 'PASS' : pct >= 50 ? 'PARTIAL' : 'FAIL';
      await qaService.runCheck(check.id, {
        source: 'MANUAL',
        stepsOk: okCount,
        stepsTotal: total,
        result,
        notes: notes || undefined,
        evidenceUrl: evidenceUrl || undefined,
        stepResults,
      });
      toast.success(`Check guardado: ${pct}% (${okCount}/${total} pasos)`);
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Play className="size-4 text-primary" /> Validar: {check.title}</DialogTitle>
          <DialogDescription>
            Marca cada paso según el resultado real. El % del ítem se calcula como pasos OK / total.
          </DialogDescription>
        </DialogHeader>

        {check.expectedResult && (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
            <span className="font-semibold">Resultado esperado:</span> {check.expectedResult}
          </div>
        )}

        <div className="space-y-2">
          {check.scenarioSteps.map((step, i) => {
            const prev = check.stepResults?.[i];
            const autoOk = prev && prev.ok !== null ? prev.ok : null;
            return (
              <div key={i} className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  checked={stepOk[i] ?? false}
                  onCheckedChange={(v) => setStepOk((s) => ({ ...s, [i]: !!v }))}
                  disabled={autoOk === true}
                />
                <div className="flex-1 space-y-1">
                  <Label className="font-medium">{i + 1}. {step.label}</Label>
                  {step.auto && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Zap className="size-3" /> Auto-check {step.auto.type === 'endpoint' ? `${step.auto.method} ${step.auto.path}` : `count ${step.auto.model}`}
                      {autoOk !== null && (
                        <Badge variant="outline" className={autoOk ? 'border-emerald-500/30 text-emerald-500' : 'border-red-500/30 text-red-500'}>
                          {autoOk ? 'Automático OK' : prev?.message || 'Automático falló'}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                {stepOk[i] ? <CheckCircle2 className="size-4 text-emerald-500" /> : <CircleDot className="size-4 text-muted-foreground" />}
              </div>
            );
          })}
        </div>

        <div className="space-y-2">
          <Label>Notas</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones del validador..." rows={2} />
          <Label>Evidencia (URL screenshot)</Label>
          <Input value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://..." />
        </div>

        <DialogFooter className="items-center gap-4">
          <div className="flex items-center gap-2">
            <Progress value={pct} className="h-2 w-32" />
            <span className="text-sm font-semibold">{pct}%</span>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Guardando...' : `Guardar resultado (${okCount}/${total})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface FindingDialogProps {
  check: QaCheck | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}

function FindingDialog({ check, open, onOpenChange, onSaved }: FindingDialogProps) {
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('media');
  const [assignee, setAssignee] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!check || !description.trim()) {
      toast.error('La descripción es obligatoria');
      return;
    }
    setSaving(true);
    try {
      await qaService.createFinding(check.id, { severity, description: description.trim(), assignee: assignee.trim() || undefined });
      toast.success('Hallazgo registrado');
      setDescription('');
      setAssignee('');
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Error al registrar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bug className="size-4 text-red-500" /> Reportar hallazgo</DialogTitle>
          <DialogDescription>
            {check ? `Ligado a: ${check.title}` : 'Selecciona un check primero'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Severidad</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="critica">Crítica</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Media</SelectItem>
                <SelectItem value="baja">Baja</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Descripción del problema</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Qué falló, pasos para reproducir..." />
          </div>
          <div className="space-y-1.5">
            <Label>Asignado a</Label>
            <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="email del responsable" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Registrar hallazgo'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModuleCard({ mod }: { mod: QaModuleSummary }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold leading-tight">{mod.moduleLabel}</p>
            <p className="text-xs text-muted-foreground">{mod.total} checks · {mod.openFindings > 0 ? `${mod.openFindings} hallazgos abiertos` : 'sin hallazgos'}</p>
          </div>
          <span className="text-2xl font-bold tabular-nums">{mod.progressPct}%</span>
        </div>
        <Progress value={mod.progressPct} className="mb-3 h-2" />
        <div className="flex flex-wrap gap-1.5 text-xs">
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-500">{mod.funcional} ✓</Badge>
          <Badge variant="outline" className="border-amber-500/30 text-amber-500">{mod.parcial} parcial</Badge>
          <Badge variant="outline" className="border-red-500/30 text-red-500">{mod.fallido} ✗</Badge>
          <Badge variant="outline" className="text-muted-foreground">{mod.pendiente} pendientes</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export function QaConsoleView() {
  const [activeTab, setActiveTab] = useState('resumen');
  const [summary, setSummary] = useState<QaSummary | null>(null);
  const [checks, setChecks] = useState<QaCheck[]>([]);
  const [findings, setFindings] = useState<QaFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [filters, setFilters] = useState<{ module?: string; status?: string; priority?: string; search?: string }>({});
  const [runCheck, setRunCheck] = useState<QaCheck | null>(null);
  const [findingFor, setFindingFor] = useState<QaCheck | null>(null);
  const [findingOpen, setFindingOpen] = useState(false);

  const refreshAll = async () => {
    try {
      const [sum, chk, fnd] = await Promise.all([qaService.getSummary(), qaService.getChecks(filters), qaService.getFindings()]);
      setSummary(sum);
      setChecks(chk);
      setFindings(fnd);
    } catch (e: any) {
      toast.error(e?.message || 'Error cargando panel QA');
    } finally {
      setLoading(false);
    }
  };

  const loadChecks = async () => {
    try {
      const chk = await qaService.getChecks(filters);
      setChecks(chk);
    } catch (e: any) {
      toast.error(e?.message || 'Error cargando checks');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await qaService.sync();
      toast.success(`Manifest sincronizado: ${res.upserted} checks nuevos de ${res.total}`);
      await refreshAll();
    } catch (e: any) {
      toast.error(e?.message || 'Error al sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  const handleAutoVerify = async () => {
    setVerifying(true);
    try {
      const res = await qaService.autoVerify();
      toast.success(`Auto-verify: ${res.ran} checks evaluados`);
      await refreshAll();
    } catch (e: any) {
      toast.error(e?.message || 'Error en auto-verify');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const modules = summary?.modules || [];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ShieldCheck className="size-6 text-primary" /> Validador ERP (Super Admin)
          </h1>
          <p className="text-sm text-muted-foreground">
            Estado real de vistas, botones y flujos CRUD. % = pasos OK / total por check.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} /> {syncing ? 'Sincronizando...' : 'Sync manifest'}
          </Button>
          <Button onClick={handleAutoVerify} disabled={verifying}>
            <Zap className="size-4" /> {verifying ? 'Verificando API...' : 'Auto-verify API'}
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total checks</p><p className="text-2xl font-bold">{summary.global.total}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-emerald-500">Funcionales</p><p className="text-2xl font-bold text-emerald-500">{summary.global.funcional}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-amber-500">Parciales</p><p className="text-2xl font-bold text-amber-500">{summary.global.parcial}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-red-500">Fallidos</p><p className="text-2xl font-bold text-red-500">{summary.global.fallido}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">% avance global</p><p className="text-2xl font-bold">{summary.global.progressPct}%</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-red-500">Hallazgos abiertos</p><p className="text-2xl font-bold text-red-500">{summary.global.openFindings}</p></CardContent></Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="resumen">Resumen por módulo</TabsTrigger>
          <TabsTrigger value="checks">Checks ({checks.length})</TabsTrigger>
          <TabsTrigger value="hallazgos">Hallazgos ({findings.filter((f) => f.status === 'ABIERTO' || f.status === 'EN_PROGRESO').length})</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="space-y-4">
          {loading ? (
            <p className="text-muted-foreground">Cargando...</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {modules.map((m) => <ModuleCard key={m.moduleKey} mod={m} />)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="checks" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Buscar por título, vista o acción..."
              value={filters.search || ''}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && loadChecks()}
              className="max-w-xs"
            />
            <Select value={filters.module || 'all'} onValueChange={(v) => { setFilters((f) => ({ ...f, module: v === 'all' ? undefined : v })); }}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Módulo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los módulos</SelectItem>
                {modules.map((m) => <SelectItem key={m.moduleKey} value={m.moduleKey}>{m.moduleKey}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.status || 'all'} onValueChange={(v) => setFilters((f) => ({ ...f, status: v === 'all' ? undefined : v }))}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="FUNCIONAL">Funcional</SelectItem>
                <SelectItem value="PARCIAL">Parcial</SelectItem>
                <SelectItem value="FALLIDO">Fallido</SelectItem>
                <SelectItem value="PENDIENTE">No validado</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={loadChecks}><Search className="size-4" /></Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Check / Acción</TableHead>
                  <TableHead className="hidden lg:table-cell">Vista</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-36">% avance</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checks.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <p className="font-medium leading-snug">{c.title}</p>
                      <p className="text-xs text-muted-foreground">{c.moduleLabel} · {c.viewKey}/{c.actionKey}</p>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">{c.viewKey}</TableCell>
                    <TableCell><PriorityBadge priority={c.priority} /></TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={c.progressPct} className="h-2 w-16" />
                        <span className="text-xs tabular-nums">{c.progressPct}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => setRunCheck(c)}>
                          <Play className="size-3.5" /> Validar
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-500 hover:text-red-500" onClick={() => { setFindingFor(c); setFindingOpen(true); }}>
                          <Bug className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {checks.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Sin checks. Click "Sync manifest" para cargar los checks base.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="hallazgos" className="space-y-4">
          {findings.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">Sin hallazgos registrados. Usa el botón 🐞 en un check para reportar uno.</CardContent></Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Check</TableHead>
                    <TableHead>Severidad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Asignado</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {findings.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="max-w-md"><p className="line-clamp-2">{f.description}</p></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{f.check?.title || f.checkId}</TableCell>
                      <TableCell><PriorityBadge priority={f.severity} /></TableCell>
                      <TableCell>
                        <Select
                          value={f.status}
                          onValueChange={async (v) => { try { await qaService.updateFinding(f.id, { status: v }); await refreshAll(); } catch (e: any) { toast.error(e?.message); } }}
                        >
                          <SelectTrigger className={`h-7 w-32 text-xs ${FINDING_STATUS_META[f.status] || ''}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ABIERTO">Abierto</SelectItem>
                            <SelectItem value="EN_PROGRESO">En progreso</SelectItem>
                            <SelectItem value="RESUELTO">Resuelto</SelectItem>
                            <SelectItem value="CERRADO">Cerrado</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm">{f.assignee || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(f.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {runCheck && (
        <RunDialog
          check={runCheck}
          open={!!runCheck}
          onOpenChange={(v) => !v && setRunCheck(null)}
          onSaved={() => { setRunCheck(null); refreshAll(); }}
        />
      )}
      <FindingDialog
        check={findingFor}
        open={findingOpen}
        onOpenChange={setFindingOpen}
        onSaved={() => { setFindingFor(null); refreshAll(); }}
      />
    </div>
  );
}
