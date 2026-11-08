import { useState } from 'react';
import { Archive, Award, CheckCircle2, Loader2, Pencil, Plus, RotateCcw, Target, XCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Skeleton } from '../ui/skeleton';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { hrService } from '../../services/hr.service';
import { performanceService, type BonusAward, type BonusRule, type Goal, type GoalInput, type GoalLevel, type GoalMetric, type GoalPeriodType, type GoalScope } from '../../services/performance.service';
import { toast } from '../../services/toast';
import { EmptyState, ErrorState, Field, NativeSelect, Panel, controlClass } from '../organizacion/OrgBits';
import { errorMessage } from '../organizacion/organizacion.utils';
import { GoalSummary } from '../seguimiento/GoalProgress';
import { GoalTasksDialog } from './GoalTasksDialog';
import { BONUS_STATUS_LABEL, GOAL_LEVEL_LABEL, GOAL_METRIC_OPTIONS, civilToday } from '../seguimiento/seguimiento.utils';

type Tab = 'metas' | 'bonos';
const PERIODS: Array<[GoalPeriodType, string]> = [['DAY', 'Un día'], ['WEEK', 'Una semana'], ['MONTH', 'Un mes'], ['CUSTOM', 'Fechas a elegir']];
const SCOPES: Array<[GoalScope, string]> = [['USER', 'Una persona'], ['DEPARTMENT', 'Un departamento'], ['COMPANY', 'Toda la empresa']];
const LEVELS: GoalLevel[] = ['MIN', 'TARGET', 'STRETCH'];
const day = (iso: string) => new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium' }).format(new Date(iso));

/** Recursos Humanos > Metas y bonos: metas de cualquier tipo con tres niveles y los bonos que se ganan al alcanzarlas. */
export function MetasBonosView() {
  const { canPerform } = useAuth();
  const canCreate = canPerform('HR_PERFORMANCE', 'create');
  const canEdit = canPerform('HR_PERFORMANCE', 'edit');
  const canDecide = canPerform('HR_PAYROLL', 'process');
  const client = useQueryClient();
  const [tab, setTab] = useState<Tab>('metas');
  const [status, setStatus] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [metric, setMetric] = useState('');
  const [userId, setUserId] = useState('');
  const [editing, setEditing] = useState<Goal | 'new' | null>(null);
  const [entriesFor, setEntriesFor] = useState<Goal | null>(null);
  const [tasksFor, setTasksFor] = useState<Goal | null>(null);

  const people = useTenantQuery(['performance', 'people-hr'], async (signal) => (await performanceService.getCheckinConfig(signal)).users, { staleTime: 60_000 });
  const departments = useTenantQuery(['performance', 'departments'], async (signal) => {
    const response = (await hrService.getDepartments(signal)) as unknown;
    const payload = (response as { data?: unknown } | null)?.data;
    const rows = (Array.isArray(response) ? response : Array.isArray(payload) ? payload : []) as Array<{ id: string; name: string }>;
    return rows.map((row) => ({ id: row.id, name: row.name }));
  }, { staleTime: 5 * 60_000 });
  const goals = useTenantQuery(['performance', 'goals', status, metric, userId], (signal) => performanceService.getGoals({ status, metric: metric || undefined, userId: userId || undefined }, signal), { staleTime: 30_000 });
  const awards = useTenantQuery(['performance', 'bonuses'], (signal) => performanceService.getBonuses({}, signal), { staleTime: 30_000 });
  const refresh = () => void client.invalidateQueries({ queryKey: ['tenant-module'] });
  const nameOf = (id: string | null) => people.data?.find((p) => p.id === id)?.name ?? 'Usuario';
  const pendingAwards = (awards.data ?? []).filter((award) => award.status === 'PENDING_APPROVAL').length;

  const archive = async (goal: Goal) => {
    try {
      if (goal.status === 'ACTIVE') await performanceService.archiveGoal(goal.id); else await performanceService.restoreGoal(goal.id);
      toast.success(goal.status === 'ACTIVE' ? 'Meta archivada' : 'Meta restaurada');
      refresh();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const tabs: Array<[Tab, string]> = [['metas', 'Metas'], ['bonos', pendingAwards ? `Bonos (${pendingAwards} por aprobar)` : 'Bonos']];
  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div role="tablist" aria-label="Secciones de Metas y bonos" className="flex flex-wrap gap-2">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={cn('rounded-lg border px-4 py-2 text-[13px] font-semibold', tab === id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted/50')}>{label}</button>
          ))}
        </div>
        {tab === 'metas' && canCreate && <Button type="button" onClick={() => setEditing('new')}><Plus className="size-4" />Nueva meta</Button>}
      </div>

      {tab === 'metas' && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Estado" className="w-40"><NativeSelect value={status} onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'ARCHIVED')}><option value="ACTIVE">Activas</option><option value="ARCHIVED">Archivadas</option></NativeSelect></Field>
            <Field label="Tipo" className="min-w-52"><NativeSelect value={metric} onChange={(e) => setMetric(e.target.value)}><option value="">Todos</option>{GOAL_METRIC_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</NativeSelect></Field>
            <Field label="Persona" className="min-w-48"><NativeSelect value={userId} onChange={(e) => setUserId(e.target.value)}><option value="">Todas</option>{(people.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect></Field>
          </div>
          {goals.isLoading ? <div className="grid gap-4 lg:grid-cols-2" aria-busy="true">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-44" />)}</div>
            : goals.isError ? <ErrorState message={errorMessage(goals.error, 'No se pudieron cargar las metas')} onRetry={() => void goals.refetch()} />
            : !goals.data?.length ? <EmptyState title={status === 'ACTIVE' ? 'Aún no hay metas activas' : 'No hay metas archivadas'} description="Crea una meta para una persona, un departamento o toda la empresa, con una mínima, la meta y una ambiciosa, y los bonos que gana quien las alcance."
              action={canCreate && status === 'ACTIVE' ? <Button type="button" className="mt-2" onClick={() => setEditing('new')}><Plus className="size-4" />Crear la primera meta</Button> : undefined} />
            : (
              <ul className="grid gap-4 lg:grid-cols-2">
                {goals.data.map((goal) => (
                  <li key={goal.id} className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-words text-[14px] font-semibold">{goal.title}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {goal.scopeType === 'USER' ? nameOf(goal.userId) : goal.scopeType === 'DEPARTMENT' ? `Departamento: ${departments.data?.find((d) => d.id === goal.departmentId)?.name ?? '—'}` : 'Toda la empresa'} · {day(goal.periodStart)} a {day(new Date(new Date(goal.periodEnd).getTime() - 1).toISOString())}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Button type="button" size="sm" variant="outline" onClick={() => setTasksFor(goal)}>Tareas</Button>
                        {goal.metric === 'MANUAL' && canEdit && goal.status === 'ACTIVE' && <Button type="button" size="sm" variant="outline" onClick={() => setEntriesFor(goal)}>Registrar avance</Button>}
                        {canEdit && <Button type="button" size="icon" variant="ghost" aria-label={`Editar ${goal.title}`} onClick={() => setEditing(goal)}><Pencil className="size-4" /></Button>}
                        {canEdit && <Button type="button" size="icon" variant="ghost" aria-label={goal.status === 'ACTIVE' ? `Archivar ${goal.title}` : `Restaurar ${goal.title}`} onClick={() => void archive(goal)}>{goal.status === 'ACTIVE' ? <Archive className="size-4" /> : <RotateCcw className="size-4" />}</Button>}
                      </div>
                    </div>
                    <GoalSummary goal={goal} />
                  </li>
                ))}
              </ul>
            )}
        </>
      )}

      {tab === 'bonos' && <BonusesPanel awards={awards.data} loading={awards.isLoading} error={awards.isError ? errorMessage(awards.error, 'No se pudieron cargar los bonos') : ''} onRetry={() => void awards.refetch()} canDecide={canDecide} onChanged={refresh} />}

      {editing && <GoalDialog goal={editing === 'new' ? null : editing} people={people.data ?? []} departments={departments.data ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
      {tasksFor && <GoalTasksDialog goal={tasksFor} people={people.data ?? []} canEdit={canEdit} onClose={() => setTasksFor(null)} onChanged={refresh} />}
      {entriesFor && <EntriesDialog goal={entriesFor} onClose={() => setEntriesFor(null)} onSaved={refresh} />}
    </div>
  );
}

function BonusesPanel({ awards, loading, error, onRetry, canDecide, onChanged }: { awards?: BonusAward[]; loading: boolean; error: string; onRetry: () => void; canDecide: boolean; onChanged: () => void }) {
  const [deciding, setDeciding] = useState<{ award: BonusAward; decision: 'APPROVE' | 'REJECT' } | null>(null);
  if (loading) return <Skeleton className="h-48 w-full" aria-busy="true" />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!awards?.length) return <EmptyState title="Aún no hay bonos ganados" description="Cuando alguien alcance un nivel de una meta con bono, aparecerá aquí para aprobarlo y pasarlo a la nómina." />;
  return (
    <Panel title="Bonos ganados" icon={<Award className="size-4" />}>
      <p className="mb-3 text-[12px] text-muted-foreground">Los bonos aprobados se suman a la nómina cuando la generas con la opción «incluir bonos de desempeño». Quien procesa la nómina decide; nadie aprueba su propio bono.</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[12px]">
          <thead className="border-b border-border text-muted-foreground"><tr>{['Persona', 'Meta', 'Nivel', 'Bono', 'Estado', ''].map((h, i) => <th key={i} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody>
            {awards.map((award) => (
              <tr key={award.id} className="border-t border-border align-top">
                <th scope="row" className="px-3 py-2 font-semibold">{award.userName}</th>
                <td className="px-3 py-2">{award.goalTitle}<span className="block text-[11px] text-muted-foreground">{day(award.periodStart)}</span></td>
                <td className="px-3 py-2">{GOAL_LEVEL_LABEL[award.level]}</td>
                <td className="px-3 py-2 font-semibold">{award.amount} {award.currency}</td>
                <td className="px-3 py-2">{BONUS_STATUS_LABEL[award.status]}{award.decisionNote && <span className="block text-[11px] text-muted-foreground">«{award.decisionNote}»</span>}</td>
                <td className="px-3 py-2">
                  {canDecide && award.status === 'PENDING_APPROVAL' && (
                    <div className="flex gap-1">
                      <Button type="button" size="sm" onClick={() => setDeciding({ award, decision: 'APPROVE' })}><CheckCircle2 className="size-3.5" />Aprobar</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setDeciding({ award, decision: 'REJECT' })}><XCircle className="size-3.5" />Rechazar</Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {deciding && <DecisionDialog {...deciding} onClose={() => setDeciding(null)} onDone={() => { setDeciding(null); onChanged(); }} />}
    </Panel>
  );
}

function DecisionDialog({ award, decision, onClose, onDone }: { award: BonusAward; decision: 'APPROVE' | 'REJECT'; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      await performanceService.decideBonus(award.id, decision, note.trim() || undefined);
      toast.success(decision === 'APPROVE' ? 'Bono aprobado' : 'Bono rechazado');
      onDone();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{decision === 'APPROVE' ? 'Aprobar bono' : 'Rechazar bono'}</DialogTitle>
          <DialogDescription>{award.userName} · {award.goalTitle} · nivel {GOAL_LEVEL_LABEL[award.level]} · {award.amount} {award.currency}</DialogDescription>
        </DialogHeader>
        <Field label={decision === 'REJECT' ? 'Motivo (obligatorio)' : 'Nota (opcional)'} htmlFor="decision-note"><Textarea id="decision-note" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="button" onClick={() => void send()} disabled={busy || (decision === 'REJECT' && !note.trim())}>{busy && <Loader2 className="size-4 animate-spin" />}{decision === 'APPROVE' ? 'Aprobar' : 'Rechazar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EntriesDialog({ goal, onClose, onSaved }: { goal: Goal; onClose: () => void; onSaved: () => void }) {
  const entries = useTenantQuery(['performance', 'goal-entries', goal.id], (signal) => performanceService.getGoalEntries(goal.id, signal), { staleTime: 5_000 });
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await performanceService.addGoalEntry(goal.id, { value: Number(value), note: note.trim() || undefined });
      toast.success('Avance registrado');
      setValue(''); setNote('');
      void entries.refetch();
      onSaved();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader><DialogTitle>Registrar avance</DialogTitle><DialogDescription>{goal.title}: el avance se suma al de los registros anteriores.</DialogDescription></DialogHeader>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Cantidad" htmlFor="entry-value"><input id="entry-value" type="number" value={value} onChange={(e) => setValue(e.target.value)} className={cn(controlClass, 'w-32')} /></Field>
          <Field label="Nota (opcional)" htmlFor="entry-note" className="min-w-40 flex-1"><input id="entry-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} className={controlClass} /></Field>
          <Button type="button" onClick={() => void save()} disabled={busy || !value || Number(value) === 0}>{busy && <Loader2 className="size-4 animate-spin" />}Agregar</Button>
        </div>
        <ul className="space-y-1">
          {(entries.data ?? []).map((entry) => <li key={entry.id} className="flex justify-between gap-3 rounded-lg border border-border px-3 py-1.5 text-[12px]"><span className="min-w-0 break-words">{entry.note || 'Sin nota'}<span className="block text-[10px] text-muted-foreground">{day(entry.createdAt)}</span></span><strong>{entry.value > 0 ? '+' : ''}{entry.value}</strong></li>)}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function GoalDialog({ goal, people, departments, onClose, onSaved }: { goal: Goal | null; people: Array<{ id: string; name: string }>; departments: Array<{ id: string; name: string }>; onClose: () => void; onSaved: () => void }) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = civilToday(zone);
  const civilOf = (iso: string) => civilToday(zone, new Date(iso));
  const [title, setTitle] = useState(goal?.title ?? '');
  const [description, setDescription] = useState(goal?.description ?? '');
  const [metric, setMetric] = useState<GoalMetric>(goal?.metric ?? 'OPPORTUNITIES');
  const [scopeType, setScopeType] = useState<GoalScope>(goal?.scopeType ?? 'USER');
  const [userId, setUserId] = useState(goal?.userId ?? '');
  const [departmentId, setDepartmentId] = useState(goal?.departmentId ?? '');
  const [periodType, setPeriodType] = useState<GoalPeriodType>(goal ? 'CUSTOM' : 'MONTH');
  const [startDate, setStartDate] = useState(goal ? civilOf(goal.periodStart) : today);
  const [endDate, setEndDate] = useState(goal ? civilOf(new Date(new Date(goal.periodEnd).getTime() - 1).toISOString()) : today);
  const [minValue, setMinValue] = useState(goal?.minValue?.toString() ?? '');
  const [targetValue, setTargetValue] = useState(goal?.targetValue?.toString() ?? '');
  const [stretchValue, setStretchValue] = useState(goal?.stretchValue?.toString() ?? '');
  const [currency, setCurrency] = useState(goal?.currency ?? 'NIO');
  const [rules, setRules] = useState<Record<GoalLevel, { amount: string; requiresApproval: boolean }>>(() => {
    const base = { MIN: { amount: '', requiresApproval: true }, TARGET: { amount: '', requiresApproval: true }, STRETCH: { amount: '', requiresApproval: true } };
    for (const rule of goal?.bonusRules ?? []) base[rule.level] = { amount: String(rule.amount), requiresApproval: rule.requiresApproval };
    return base;
  });
  const [busy, setBusy] = useState(false);

  const info = GOAL_METRIC_OPTIONS.find((option) => option.key === metric);
  const isAmount = info?.unit === 'AMOUNT';
  const num = (value: string) => (value.trim() === '' ? null : Number(value));
  const valid = title.trim() && Number(targetValue) > 0 && (scopeType !== 'USER' || userId) && (scopeType !== 'DEPARTMENT' || departmentId) && startDate && (periodType !== 'CUSTOM' || endDate >= startDate);

  const save = async () => {
    setBusy(true);
    try {
      const bonusRules: BonusRule[] = scopeType === 'USER'
        ? LEVELS.filter((level) => Number(rules[level].amount) > 0).map((level) => ({ level, amount: Number(rules[level].amount), currency: isAmount ? currency : 'NIO', requiresApproval: rules[level].requiresApproval }))
        : [];
      const payload: GoalInput = {
        title: title.trim(), description: description.trim() || null, metric, scopeType, userId: scopeType === 'USER' ? userId : null, departmentId: scopeType === 'DEPARTMENT' ? departmentId : null,
        periodType, startDate, ...(periodType === 'CUSTOM' ? { endDate } : {}), minValue: num(minValue), targetValue: Number(targetValue), stretchValue: num(stretchValue), currency: isAmount ? currency : null,
      };
      const saved = goal ? await performanceService.updateGoal(goal.id, payload) : await performanceService.createGoal(payload);
      if (scopeType === 'USER' && (goal || bonusRules.length)) await performanceService.setBonusRules(saved.id, bonusRules);
      toast.success(goal ? 'Meta actualizada' : 'Meta creada');
      onSaved();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{goal ? 'Editar meta' : 'Nueva meta'}</DialogTitle>
          <DialogDescription>Define qué se mide, a quién, en qué período y tres niveles: la mínima, la meta y la ambiciosa. El avance se calcula solo con los datos del ERP.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre de la meta" htmlFor="goal-title" required className="sm:col-span-2"><input id="goal-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className={controlClass} placeholder="Ventas de noviembre" /></Field>
          <Field label="Qué se mide" htmlFor="goal-metric" hint={info?.hint} className="sm:col-span-2"><NativeSelect id="goal-metric" value={metric} onChange={(e) => setMetric(e.target.value as GoalMetric)} disabled={Boolean(goal)}>{GOAL_METRIC_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</NativeSelect></Field>
          <Field label="Para" htmlFor="goal-scope"><NativeSelect id="goal-scope" value={scopeType} onChange={(e) => setScopeType(e.target.value as GoalScope)}>{SCOPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect></Field>
          {scopeType === 'USER' && <Field label="Persona" htmlFor="goal-user" required><NativeSelect id="goal-user" value={userId} onChange={(e) => setUserId(e.target.value)}><option value="">Elige una persona</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect></Field>}
          {scopeType === 'DEPARTMENT' && <Field label="Departamento" htmlFor="goal-dept" required><NativeSelect id="goal-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}><option value="">Elige un departamento</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</NativeSelect></Field>}
          <Field label="Período" htmlFor="goal-period"><NativeSelect id="goal-period" value={periodType} onChange={(e) => setPeriodType(e.target.value as GoalPeriodType)}>{PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect></Field>
          <Field label={periodType === 'CUSTOM' ? 'Desde' : 'Fecha dentro del período'} htmlFor="goal-start"><input id="goal-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={controlClass} /></Field>
          {periodType === 'CUSTOM' && <Field label="Hasta" htmlFor="goal-end"><input id="goal-end" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={controlClass} /></Field>}
        </div>

        <fieldset className="rounded-xl border border-border p-3">
          <legend className="px-1 text-[12px] font-semibold">Niveles{isAmount ? ` (en ${currency})` : ''}</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Mínima (opcional)" htmlFor="goal-min" hint="Lo mínimo aceptable."><input id="goal-min" type="number" min={0} value={minValue} onChange={(e) => setMinValue(e.target.value)} className={controlClass} /></Field>
            <Field label="Meta" htmlFor="goal-target" required hint="Lo que se espera."><input id="goal-target" type="number" min={0} value={targetValue} onChange={(e) => setTargetValue(e.target.value)} className={controlClass} /></Field>
            <Field label="Ambiciosa (opcional)" htmlFor="goal-stretch" hint="El mejor escenario."><input id="goal-stretch" type="number" min={0} value={stretchValue} onChange={(e) => setStretchValue(e.target.value)} className={controlClass} /></Field>
          </div>
          {isAmount && <Field label="Moneda" htmlFor="goal-currency" className="mt-3 w-28"><input id="goal-currency" value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className={controlClass} /></Field>}
        </fieldset>

        {scopeType === 'USER' ? (
          <fieldset className="rounded-xl border border-border p-3">
            <legend className="px-1 text-[12px] font-semibold">Bono por nivel alcanzado (opcional)</legend>
            <p className="mb-2 text-[11px] text-muted-foreground">Quien alcance un nivel gana el bono de ese nivel (el de la meta más alta que logre). Por omisión necesita tu aprobación antes de pasar a la nómina.</p>
            <ul className="space-y-2">
              {LEVELS.map((level) => {
                const unavailable = (level === 'MIN' && !minValue.trim()) || (level === 'STRETCH' && !stretchValue.trim());
                return (
                  <li key={level} className="flex flex-wrap items-center gap-3">
                    <span className="w-24 text-[12px] font-semibold">{GOAL_LEVEL_LABEL[level]}</span>
                    <input type="number" min={0} aria-label={`Bono del nivel ${GOAL_LEVEL_LABEL[level]}`} placeholder="Sin bono" disabled={unavailable} value={unavailable ? '' : rules[level].amount} onChange={(e) => setRules((current) => ({ ...current, [level]: { ...current[level], amount: e.target.value } }))} className={cn(controlClass, 'w-32')} />
                    <label className="flex items-center gap-2 text-[12px]"><Switch checked={rules[level].requiresApproval} onCheckedChange={(value) => setRules((current) => ({ ...current, [level]: { ...current[level], requiresApproval: value } }))} disabled={unavailable} />Pide aprobación</label>
                    {unavailable && <span className="text-[11px] text-muted-foreground">Define primero ese nivel.</span>}
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ) : <p className="text-[11px] text-muted-foreground">Las metas de un departamento o de toda la empresa miden el avance en conjunto; los bonos se definen en metas de una persona.</p>}

        <Field label="Descripción (opcional)" htmlFor="goal-desc"><Textarea id="goal-desc" rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button type="button" onClick={() => void save()} disabled={busy || !valid}>{busy && <Loader2 className="size-4 animate-spin" />}<Target className="size-4" />{goal ? 'Guardar cambios' : 'Crear meta'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
