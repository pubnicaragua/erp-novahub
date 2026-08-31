import { useState } from 'react';
import { Plus, Pencil, Trash2, Download, BookOpenCheck, Wallet, Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DateField } from '../ui/DateField';
import { useTenantQuery, asList } from '../../hooks/useTenantQuery';
import { suppliersService } from '../../services/compras.service';
import { projectsService, type ProjectBudgetLine, type ProjectCost, type ProjectCostSource, type ProjectReport } from '../../services/projects.service';
import { useAuth } from '../../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import {
  COST_SOURCE_LABEL, COST_SOURCE_OPTIONS, COST_STATUS_META, COST_STATUS_OPTIONS,
  money, formatDate, fromLocalDate, toLocalDate,
} from './shared';

interface PanelsProps { projectId: string; }

export function ProyectoPresupuestoPanel({ projectId }: PanelsProps) {
  const { canPerform } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; editing?: ProjectBudgetLine | null }>({ open: false, editing: null });
  const budgetQuery = useTenantQuery<any>(['projects', 'budget', projectId], (s) => projectsService.budget(projectId, s), { enabled: true });
  const data = budgetQuery.data;
  const lines = asList(data?.lines) as ProjectBudgetLine[];
  const totals = data?.totals || {};
  const summary = data?.summary || {};
  const baseCurrency = data?.baseCurrency || 'NIO';
  const canEdit = canPerform('PROJECTS', 'edit');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tenant-module', 'projects'] });
  const mutation = useMutation({
    mutationFn: (args: { type: 'create' | 'update' | 'delete'; id?: string; payload?: any }) => {
      if (args.type === 'create') return projectsService.createBudgetLine(projectId, args.payload);
      if (args.type === 'update') return projectsService.updateBudgetLine(projectId, args.id!, args.payload);
      return projectsService.deleteBudgetLine(projectId, args.id!);
    },
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.message || 'Error en el presupuesto'),
  });

  const kpis = [
    { label: 'Presupuesto (base)', value: money(summary.plannedBudget ?? totals.basePlannedBudget, baseCurrency), tone: '' },
    { label: 'Comprometido', value: money(summary.committedCost ?? totals.baseCommittedCost, baseCurrency), tone: '' },
    { label: 'Ejecutado', value: money(summary.executedCost ?? totals.baseExecutedCost, baseCurrency), tone: summary.overBudget ? 'text-rose-600' : '' },
    { label: 'Saldo disponible', value: money(summary.available ?? totals.available, baseCurrency), tone: (summary.available ?? totals.available) < 0 ? 'text-rose-600' : 'text-emerald-600' },
    { label: 'Variación', value: `${(summary.varianceAbs ?? totals.varianceAbs) >= 0 ? '+' : ''}${money(summary.varianceAbs ?? totals.varianceAbs, baseCurrency)}`, tone: summary.overBudget ? 'text-rose-600' : 'text-emerald-600' },
    { label: 'Margen real', value: money(summary.realMargin ?? totals.realMargin, baseCurrency), tone: (summary.realMargin ?? totals.realMargin) < 0 ? 'text-rose-600' : 'text-emerald-600' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label} className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{k.label}</p>
              <p className={cn('mt-1 text-lg font-black tracking-tight', k.tone)}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {(summary.overBudget || totals.overBudget) && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-sm font-bold text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-300">
          ⚠ Este proyecto está sobrepresupuestado: los costos ejecutados superan el presupuesto proyectado.
        </div>
      )}

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-sm"><Wallet className="size-4 text-primary" /> Líneas de presupuesto</CardTitle>
          {canEdit && <Button size="sm" onClick={() => setDialog({ open: true })} className="gap-1.5"><Plus className="size-4" /> Línea</Button>}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  {canEdit && <TableHead className="w-20" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No hay líneas de presupuesto. Agrega la primera.</TableCell></TableRow>
                ) : lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <Badge variant="outline" className={cn('border', line.type === 'INCOME' ? 'border-emerald-200 bg-emerald-500/10 text-emerald-700' : 'border-blue-200 bg-blue-500/10 text-blue-700')}>
                        {line.type === 'INCOME' ? 'Ingreso' : 'Costo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{line.category}</TableCell>
                    <TableCell className="font-bold">{line.concept}</TableCell>
                    <TableCell className="text-right">{money(line.amount, line.currency)}</TableCell>
                    <TableCell className="text-xs">{line.currency}</TableCell>
                    <TableCell className="text-right text-xs">{money(line.baseAmount, baseCurrency)}</TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="size-8" onClick={() => setDialog({ open: true, editing: line })}><Pencil className="size-4" /></Button>
                          <Button size="icon" variant="ghost" className="size-8 text-rose-500" onClick={() => { if (window.confirm(`¿Eliminar la línea ${line.concept}?`)) mutation.mutate({ type: 'delete', id: line.id }); }}><Trash2 className="size-4" /></Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {dialog.open && (
        <BudgetLineDialog editing={dialog.editing} baseCurrency={baseCurrency} onClose={() => setDialog({ open: false, editing: null })}
          onSubmit={(payload) => mutation.mutate(dialog.editing ? { type: 'update', id: dialog.editing.id, payload } : { type: 'create', payload })} />
      )}
    </div>
  );
}

function BudgetLineDialog({ editing, baseCurrency, onClose, onSubmit }: { editing?: ProjectBudgetLine | null; baseCurrency: string; onClose: () => void; onSubmit: (payload: any) => void }) {
  const [form, setForm] = useState<any>({
    type: editing?.type || 'COST',
    category: editing?.category || 'OPERATIVO',
    concept: editing?.concept || '',
    amount: editing?.amount != null ? String(editing.amount) : '',
    currency: editing?.currency || baseCurrency,
    exchangeRate: editing?.exchangeRate && editing.exchangeRate !== 1 ? String(editing.exchangeRate) : '',
    notes: editing?.notes || '',
  });
  const submit = () => {
    if (!form.concept?.trim()) return;
    onSubmit({
      type: form.type,
      category: form.category?.trim() || 'OPERATIVO',
      concept: form.concept.trim(),
      amount: Number(form.amount || 0),
      currency: form.currency,
      exchangeRate: form.exchangeRate === '' ? undefined : Number(form.exchangeRate),
      notes: form.notes?.trim() || undefined,
    });
    onClose();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{editing ? 'Editar línea' : 'Nueva línea de presupuesto'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div><Label>Tipo</Label><Select value={form.type} onValueChange={(v) => setForm((f: any) => ({ ...f, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="COST">Costo</SelectItem><SelectItem value="INCOME">Ingreso</SelectItem></SelectContent></Select></div>
          <div><Label>Categoría</Label><Input value={form.category} onChange={(e) => setForm((f: any) => ({ ...f, category: e.target.value }))} placeholder="OPERATIVO" /></div>
          <div className="sm:col-span-2"><Label>Concepto *</Label><Input value={form.concept} onChange={(e) => setForm((f: any) => ({ ...f, concept: e.target.value }))} placeholder="Ej. Mano de obra directa" /></div>
          <div><Label>Monto</Label><Input type="number" min={0} value={form.amount} onChange={(e) => setForm((f: any) => ({ ...f, amount: e.target.value }))} placeholder="0.00" /></div>
          <div><Label>Moneda</Label><Select value={form.currency} onValueChange={(v) => setForm((f: any) => ({ ...f, currency: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NIO">NIO</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
          <div className="sm:col-span-2"><Label>Tasa de cambio (si no es NIO)</Label><Input type="number" min={0} step="0.01" value={form.exchangeRate} onChange={(e) => setForm((f: any) => ({ ...f, exchangeRate: e.target.value }))} placeholder="36.50" /></div>
          <div className="sm:col-span-2"><Label>Notas</Label><Input value={form.notes} onChange={(e) => setForm((f: any) => ({ ...f, notes: e.target.value }))} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={submit} disabled={!form.concept?.trim()}>{editing ? 'Guardar' : 'Agregar'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProyectoCostosPanel({ projectId }: PanelsProps) {
  const { canPerform } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('ALL');
  const [source, setSource] = useState('ALL');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ open: boolean; editing?: ProjectCost | null }>({ open: false, editing: null });

  const costsQuery = useTenantQuery<any>(['projects', 'costs', projectId, status, source, page], (s) => projectsService.costs(projectId, { status: status === 'ALL' ? undefined : status, source: source === 'ALL' ? undefined : source, page, pageSize: 20 }, s), { enabled: true });
  const suppliersQuery = useTenantQuery<any[]>(['projects', 'suppliers'], (s) => suppliersService.getAll({ page: 1, pageSize: 200 }, s).then((res: any) => asList(res)), { enabled: dialog.open });

  const rows = asList(costsQuery.data) as ProjectCost[];
  const total = Number(costsQuery.data?.total ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const suppliers = asList(suppliersQuery.data);

  const canCreate = canPerform('PROJECTS_EXPENSES', 'create');
  const canEdit = canPerform('PROJECTS_EXPENSES', 'edit');
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tenant-module', 'projects'] });

  const mutation = useMutation({
    mutationFn: (args: { type: 'create' | 'update' | 'delete' | 'journal'; id?: string; payload?: any }) => {
      if (args.type === 'create') return projectsService.createCost(projectId, args.payload);
      if (args.type === 'update') return projectsService.updateCost(projectId, args.id!, args.payload);
      if (args.type === 'journal') return projectsService.generateJournal(projectId, args.id!);
      return projectsService.deleteCost(projectId, args.id!);
    },
    onSuccess: (res: any, args) => {
      if (args.type === 'journal') toast.success(res?.number ? `Asiento ${res.number} generado` : 'Costo contabilizado');
      else toast.success('Costo procesado');
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || 'Error al procesar el costo'),
  });

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent><SelectItem value="ALL">Todos los estados</SelectItem>{COST_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Select value={source} onValueChange={(v) => { setSource(v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Fuente" /></SelectTrigger>
                <SelectContent><SelectItem value="ALL">Todas las fuentes</SelectItem>{COST_SOURCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {canCreate && <Button onClick={() => setDialog({ open: true })} className="gap-1.5"><Plus className="size-4" /> Registrar costo</Button>}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Registrado por</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="py-10 text-center text-muted-foreground">No hay costos registrados.</TableCell></TableRow>
                ) : rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell><p className="font-bold">{c.concept}</p>{c.documentReference && <p className="text-xs text-muted-foreground">Ref: {c.documentReference}</p>}</TableCell>
                    <TableCell className="text-xs">{c.category}</TableCell>
                    <TableCell className="text-right font-bold">{money(c.amount, c.currency)}</TableCell>
                    <TableCell className="text-xs">{c.currency}</TableCell>
                    <TableCell className="text-xs">{formatDate(c.costDate)}</TableCell>
                    <TableCell><Badge variant="outline" className="border-border/60">{COST_SOURCE_LABEL[c.source]}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={cn('border', COST_STATUS_META[c.status].badge)}>{COST_STATUS_META[c.status].label}</Badge></TableCell>
                    <TableCell className="text-xs">{c.supplier?.name || '—'}</TableCell>
                    <TableCell className="text-xs">{c.recordedBy?.name || '—'}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {c.status === 'EXECUTED' && canEdit && <Button size="icon" variant="ghost" className="size-8 text-emerald-600" title="Generar asiento contable" onClick={() => mutation.mutate({ type: 'journal', id: c.id })}><BookOpenCheck className="size-4" /></Button>}
                        {canEdit && <Button size="icon" variant="ghost" className="size-8" onClick={() => setDialog({ open: true, editing: c })}><Pencil className="size-4" /></Button>}
                        {canEdit && <Button size="icon" variant="ghost" className="size-8 text-rose-500" onClick={() => { if (window.confirm(`¿Eliminar el costo ${c.concept}?`)) mutation.mutate({ type: 'delete', id: c.id }); }}><Trash2 className="size-4" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{total} costos</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <span className="text-xs text-muted-foreground">Página {page} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
          </div>
        </div>
      )}

      {dialog.open && (
        <CostDialog editing={dialog.editing} suppliers={suppliers} onClose={() => setDialog({ open: false, editing: null })}
          onSubmit={(payload) => mutation.mutate(dialog.editing ? { type: 'update', id: dialog.editing.id, payload } : { type: 'create', payload })} />
      )}
    </div>
  );
}

function CostDialog({ editing, suppliers, onClose, onSubmit }: { editing?: ProjectCost | null; suppliers: any[]; onClose: () => void; onSubmit: (payload: any) => void }) {
  const [form, setForm] = useState<any>({
    concept: editing?.concept || '',
    category: editing?.category || 'OPERATIVO',
    amount: editing?.amount != null ? String(editing.amount) : '',
    currency: editing?.currency || 'NIO',
    exchangeRate: editing?.exchangeRate && editing.exchangeRate !== 1 ? String(editing.exchangeRate) : '',
    costDate: toLocalDate(editing?.costDate) || '',
    supplierId: editing?.supplierId || '',
    documentReference: editing?.documentReference || '',
    source: editing?.source || 'MANUAL',
    sourceId: editing?.sourceId || '',
    status: editing?.status || 'EXECUTED',
    observation: editing?.observation || '',
  });
  const submit = () => {
    if (!form.concept?.trim()) return;
    onSubmit({
      concept: form.concept.trim(),
      category: form.category?.trim() || 'OPERATIVO',
      amount: Number(form.amount || 0),
      currency: form.currency,
      exchangeRate: form.exchangeRate === '' ? undefined : Number(form.exchangeRate),
      costDate: fromLocalDate(form.costDate),
      supplierId: form.supplierId || undefined,
      documentReference: form.documentReference?.trim() || undefined,
      source: form.source,
      sourceId: form.sourceId?.trim() || undefined,
      status: form.status,
      observation: form.observation?.trim() || undefined,
    });
    onClose();
  };
  const showSourceId = form.source !== 'MANUAL';
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader><DialogTitle>{editing ? 'Editar costo' : 'Registrar costo'}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Concepto *</Label><Input value={form.concept} onChange={(e) => setForm((f: any) => ({ ...f, concept: e.target.value }))} placeholder="Ej. Materiales de construcción" /></div>
          <div><Label>Categoría</Label><Input value={form.category} onChange={(e) => setForm((f: any) => ({ ...f, category: e.target.value }))} placeholder="OPERATIVO" /></div>
          <div><Label>Monto</Label><Input type="number" min={0} value={form.amount} onChange={(e) => setForm((f: any) => ({ ...f, amount: e.target.value }))} placeholder="0.00" /></div>
          <div><Label>Moneda</Label><Select value={form.currency} onValueChange={(v) => setForm((f: any) => ({ ...f, currency: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NIO">NIO</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
          <div><Label>Fecha</Label><DateField value={form.costDate || ''} onChange={(v) => setForm((f: any) => ({ ...f, costDate: v }))} /></div>
          <div><Label>Proveedor</Label><Select value={form.supplierId || ''} onValueChange={(v) => setForm((f: any) => ({ ...f, supplierId: v }))}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent><SelectItem value="">Sin proveedor</SelectItem>{suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Referencia de documento</Label><Input value={form.documentReference} onChange={(e) => setForm((f: any) => ({ ...f, documentReference: e.target.value }))} placeholder="OC-0001 / factura..." /></div>
          <div><Label>Fuente</Label><Select value={form.source} onValueChange={(v) => setForm((f: any) => ({ ...f, source: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COST_SOURCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Estado</Label><Select value={form.status} onValueChange={(v) => setForm((f: any) => ({ ...f, status: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COST_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select></div>
          {showSourceId && (
            <div className="sm:col-span-2">
              <Label>Documento origen (idempotencia)</Label>
              <Input value={form.sourceId} onChange={(e) => setForm((f: any) => ({ ...f, sourceId: e.target.value }))} placeholder={`ID del documento de ${COST_SOURCE_LABEL[form.source as ProjectCostSource].toLowerCase()}`} />
              <p className="mt-1 text-[11px] text-muted-foreground">Si ya existe un costo con la misma fuente y documento, no se duplicará.</p>
            </div>
          )}
          <div className="sm:col-span-2"><Label>Observación</Label><Input value={form.observation} onChange={(e) => setForm((f: any) => ({ ...f, observation: e.target.value }))} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancelar</Button><Button onClick={submit} disabled={!form.concept?.trim()}>{editing ? 'Guardar' : 'Registrar'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProyectoReportePanel({ projectId }: PanelsProps) {
  const reportQuery = useTenantQuery<ProjectReport>(['projects', 'report', projectId], (s) => projectsService.report(projectId, s), { enabled: true });
  const report = reportQuery.data;

  const exportCsv = () => {
    if (!report) return;
    const { project, tasks, milestones, costsByCategory, summary, members } = report;
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines: string[] = [];
    lines.push(`Reporte del proyecto,${esc(project.name)}`);
    lines.push(`Código,${esc(project.code)}`);
    lines.push(`Estado,${esc(project.status)}`);
    lines.push(`Avance,${project.progress}%`);
    lines.push(`Presupuesto proyectado,${money(summary.plannedBudget, project.currency)}`);
    lines.push(`Costos ejecutados,${money(summary.executedCost, project.currency)}`);
    lines.push(`Saldo disponible,${money(summary.available, project.currency)}`);
    lines.push(`Margen real,${money(summary.realMargin, project.currency)}`);
    lines.push('');
    lines.push('Categoría,Costos ejecutados (base)');
    Object.entries(costsByCategory || {}).forEach(([cat, amount]) => lines.push(`${esc(cat)},${amount}`));
    lines.push('');
    lines.push('Tareas totales,' + tasks.total);
    lines.push('Tareas vencidas,' + tasks.overdue);
    lines.push('Tareas próximas,' + tasks.upcoming);
    lines.push('Hitos completados,' + `${milestones.completed}/${milestones.total}`);
    lines.push('Miembros,' + members);
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-${project.code}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!report) return <Card className="rounded-2xl border-border/60 shadow-sm"><CardContent className="py-10 text-center text-muted-foreground">Generando reporte...</CardContent></Card>;

  const { project, summary, tasks, costsByCategory, members, alerts } = report;
  const maxCat = Math.max(1, ...Object.values(costsByCategory || {}).map((v) => Number(v) || 0));
  const kpis = [
    { label: 'Presupuesto', value: money(summary.plannedBudget, project.currency) },
    { label: 'Ejecutado', value: money(summary.executedCost, project.currency), tone: summary.overBudget ? 'text-rose-600' : '' },
    { label: 'Saldo', value: money(summary.available, project.currency), tone: summary.available < 0 ? 'text-rose-600' : 'text-emerald-600' },
    { label: 'Margen real', value: money(summary.realMargin, project.currency), tone: summary.realMargin < 0 ? 'text-rose-600' : 'text-emerald-600' },
    { label: 'Avance', value: `${project.progress}%` },
    { label: 'Miembros', value: String(members) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-black"><Receipt className="size-5 text-primary" /> Reporte ejecutivo — {project.name}</h3>
          <p className="text-xs text-muted-foreground">{project.code} · {project.status}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv}><Download className="size-4" /> Exportar CSV</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.label} className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{k.label}</p>
              <p className={cn('mt-1 text-lg font-black', (k as any).tone)}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Tareas por estado</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(tasks.byStatus || {}).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-sm">
                  <span className="font-bold">{status}</span>
                  <span className="font-black">{count}</span>
                </div>
              ))}
              {Object.keys(tasks.byStatus || {}).length === 0 && <p className="text-sm text-muted-foreground">Sin tareas registradas.</p>}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 dark:border-rose-800/40 dark:bg-rose-950/20"><p className="text-[10px] font-black uppercase text-muted-foreground">Vencidas</p><p className="text-lg font-black text-rose-600">{tasks.overdue}</p></div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-800/40 dark:bg-amber-950/20"><p className="text-[10px] font-black uppercase text-muted-foreground">Próximas (7d)</p><p className="text-lg font-black text-amber-600">{tasks.upcoming}</p></div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Costos ejecutados por categoría</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(costsByCategory || {}).length === 0 && <p className="text-sm text-muted-foreground">Sin costos ejecutados.</p>}
            {Object.entries(costsByCategory || {}).map(([cat, amount]) => (
              <div key={cat}>
                <div className="flex items-center justify-between text-sm"><span className="font-bold">{cat}</span><span className="font-black">{money(Number(amount), project.currency)}</span></div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(Number(amount) / maxCat) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Alertas del proyecto</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {alerts.overBudget && <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm font-bold text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-300">⚠ Sobrepresupuesto: los costos ejecutados superan el presupuesto.</div>}
          {alerts.delayed && <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-sm font-bold text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-300">⚠ El proyecto tiene {alerts.overdueTasks} tarea(s) vencida(s) — posible retraso.</div>}
          {alerts.upcomingDeadlines > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm font-bold text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">◐ {alerts.upcomingDeadlines} tarea(s) vencen en los próximos 7 días.</div>}
          {!alerts.overBudget && !alerts.delayed && alerts.upcomingDeadlines === 0 && <p className="text-sm text-muted-foreground">Sin alertas pendientes.</p>}
        </CardContent>
      </Card>
    </div>
  );
}