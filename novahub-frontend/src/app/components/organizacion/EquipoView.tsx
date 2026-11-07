import { useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, ListTodo, Star, Timer } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { organizacionService, type TeamMember } from '../../services/organizacion.service';
import { ORGANIZACION_GUIDES } from './guides';
import { EmptyState, ErrorState, PageTitle } from './OrgBits';
import { SOURCE_LABEL, errorMessage } from './organizacion.utils';
import { EquipoCalendario } from './EquipoCalendario';
import { EquipoHistorial } from './EquipoHistorial';
import { EquipoReglas } from './EquipoReglas';
import type { OrgPreferences } from '../../services/organizacion.service';

type Tab = 'resumen' | 'calendario' | 'historial' | 'reglas';

/** Equipo: lo que hacen las personas que supervisas (solo lectura). Los administradores definen quién supervisa a quién. */
export function EquipoView({ preferences }: { preferences: OrgPreferences }) {
  const { canPerform } = useAuth();
  const canManage = canPerform('ORGANIZATION_TEAM', 'authorize');
  const [tab, setTab] = useState<Tab>('resumen');
  const [historyUser, setHistoryUser] = useState('');
  const team = useTenantQuery(['organizacion', 'team'], (signal) => organizacionService.getTeam(signal), { staleTime: 30_000 });

  const tabs: Array<[Tab, string]> = [['resumen', 'Resumen del equipo'], ['calendario', 'Calendario'], ['historial', 'Historial de tareas'], ...(canManage ? [['reglas', 'Supervisores y avisos'] as [Tab, string]] : [])];
  const openHistory = (userId: string) => { setHistoryUser(userId); setTab('historial'); };

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <PageTitle guide={ORGANIZACION_GUIDES.equipo} eyebrow="Organización personal" title="Equipo" subtitle="Calendarios, tareas pendientes e historial de las personas que supervisas. Solo lectura." />
      <div role="tablist" aria-label="Secciones de Equipo" className="flex flex-wrap gap-2" data-tour="team-tabs">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={cn('rounded-lg border px-4 py-2 text-[13px] font-semibold', tab === id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted/50')}>{label}</button>
        ))}
      </div>

      {tab === 'resumen' && <Resumen members={team.data} loading={team.isLoading} error={team.isError ? errorMessage(team.error, 'No se pudo cargar el equipo') : ''} onRetry={() => void team.refetch()} onOpen={openHistory} canManage={canManage} onManage={() => setTab('reglas')} />}
      {tab === 'calendario' && <EquipoCalendario members={team.data ?? []} preferences={preferences} />}
      {tab === 'historial' && <EquipoHistorial members={team.data ?? []} initialUser={historyUser} />}
      {tab === 'reglas' && canManage && <EquipoReglas />}
    </div>
  );
}

function Resumen({ members, loading, error, onRetry, onOpen, canManage, onManage }: {
  members?: TeamMember[]; loading: boolean; error: string; onRetry: () => void; onOpen: (userId: string) => void; canManage: boolean; onManage: () => void;
}) {
  if (loading) return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!members?.length) {
    return (
      <EmptyState title="Aún no supervisas a nadie"
        description={canManage ? 'Define quién supervisa a quién en la pestaña «Supervisores y avisos», o asigna jefes de departamento en el organigrama.' : 'Cuando la administración te asigne personas a supervisar, aparecerán aquí.'}
        action={canManage ? <button type="button" className="mt-2 text-[13px] font-semibold text-primary underline dark:text-accent" onClick={onManage}>Configurar supervisores</button> : undefined} />
    );
  }
  const totals = members.reduce((t, m) => ({
    pending: t.pending + m.pending, overdue: t.overdue + m.overdue, done: t.done + m.completedRecently,
    onTime: t.onTime + m.compliance.onTime, late: t.late + m.compliance.late,
    rated: t.rated + m.compliance.rated, ratingSum: t.ratingSum + (m.compliance.averageRating ?? 0) * m.compliance.rated,
  }), { pending: 0, overdue: 0, done: 0, onTime: 0, late: 0, rated: 0, ratingSum: 0 });
  const measured = totals.onTime + totals.late;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5" data-tour="team-kpis">
        <Stat icon={<ListTodo className="size-4" />} label="Tareas pendientes" value={totals.pending} />
        <Stat icon={<AlertTriangle className="size-4" />} label="Vencidas" value={totals.overdue} tone={totals.overdue ? 'danger' : undefined} />
        <Stat icon={<CheckCircle2 className="size-4" />} label="Completadas (30 días)" value={totals.done} />
        <Stat icon={<Timer className="size-4" />} label="Entregas a tiempo" value={measured ? `${Math.round((totals.onTime / measured) * 100)}%` : '—'} />
        <Stat icon={<Star className="size-4" />} label="Calificación promedio" value={totals.rated ? `${(Math.round((totals.ratingSum / totals.rated) * 10) / 10).toFixed(1)}/5` : '—'} />
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {members.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => onOpen(m.id)} className="flex h-full w-full min-w-0 flex-col gap-2 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label={`Ver historial de ${m.name}`}>
              <div className="min-w-0"><p className="break-words text-[14px] font-semibold">{m.name}</p><p className="break-words text-[11px] text-muted-foreground">{[m.role, m.department].filter(Boolean).join(' · ') || m.email}</p></div>
              <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-800">{m.pending} pendientes</span>
                <span className={cn('rounded-full px-2 py-0.5', m.overdue ? 'bg-red-100 text-red-900' : 'bg-slate-100 text-slate-800')}>{m.overdue} vencidas</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-900">{m.completedRecently} completadas</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Calidad: {m.quality.firstPassRate === null ? 'sin entregas evaluadas' : `${m.quality.firstPassRate}% aprobadas a la primera`}
                {m.quality.rejected > 0 && ` · ${m.quality.rejected} rechazada${m.quality.rejected === 1 ? '' : 's'}`}
                {m.quality.inReview > 0 && ` · ${m.quality.inReview} en revisión`}
                {m.quality.overEstimate > 0 && ` · ${m.quality.overEstimate} sobre lo estimado`}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Cumplimiento: {m.compliance.onTimeRate === null ? 'sin entregas medidas' : `${m.compliance.onTimeRate}% a tiempo (${m.compliance.onTime} de ${m.compliance.onTime + m.compliance.late})`}
                {m.compliance.noDeadline > 0 && ` · ${m.compliance.noDeadline} sin plazo`}
                {m.compliance.averageRating !== null && ` · Calificación ${m.compliance.averageRating.toFixed(1)}/5 (${m.compliance.rated})`}
              </p>
              <p className="mt-auto text-[10px] text-muted-foreground">Origen: {m.sources.map((s) => SOURCE_LABEL[s]).join(', ')}</p>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground">Cada consulta al historial de una persona queda registrada en la auditoría. «Completadas», «a tiempo» y la calificación cuentan los últimos 30 días por fecha de cierre; las tareas anteriores al control de cierre se cuentan por su fecha límite y no entran en «a tiempo». Tampoco entran las tareas sin plazo definido (cuando se deja el vencimiento vacío se guarda la hora de creación): se indican como «sin plazo».</p>
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number | string; tone?: 'danger' }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-primary dark:text-accent">{icon}</span>{label}</div>
      <p className={cn('mt-2 text-2xl font-bold', tone === 'danger' ? 'text-red-700' : 'text-primary dark:text-foreground')}>{value}</p>
    </div>
  );
}
