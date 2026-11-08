import { useMemo, useState } from 'react';
import { ORGANIZACION_GUIDES } from './guides';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Eye, Info, Loader2, ShieldCheck, Trash2, UserPlus, Users, CalendarDays } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Switch } from '../ui/switch';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import {
  organizacionService, type OrgAccessLevel, type OrgPreferences, type OrgUser, type OrgViewMode, type OrgVisibility, type WorkingHours,
} from '../../services/organizacion.service';
import { toast } from '../../services/toast';
import { AutorizarAccesoSheet } from './AutorizarAccesoSheet';
import { ErrorState, Field, NativeSelect, PageTitle, Panel, controlClass } from './OrgBits';
import { ACCESS_LEVELS, WEEK_DAY_KEYS, WEEK_DAY_LABELS, errorMessage, timeZoneLabel, timeZoneOptions } from './organizacion.utils';

interface Props {
  preferences: OrgPreferences;
  users: OrgUser[];
}

type Draft = Omit<OrgPreferences, 'persisted'>;
const toDraft = (p: OrgPreferences): Draft => ({
  timezone: p.timezone, defaultView: p.defaultView, weekStartsOn: p.weekStartsOn, showWeekends: p.showWeekends,
  workingHours: JSON.parse(JSON.stringify(p.workingHours)) as WorkingHours, visibility: p.visibility,
});

const VISIBILITY: Array<{ id: OrgVisibility; title: string; hint: string }> = [
  { id: 'PRIVATE', title: 'Privada', hint: 'Solo tú y los usuarios autorizados podrán ver los detalles.' },
  { id: 'AVAILABILITY', title: 'Compartir disponibilidad', hint: 'Las personas de tu empresa verán bloques ocupados sin ver descripciones.' },
  { id: 'TEAM', title: 'Equipo autorizado', hint: 'Las personas de tu empresa podrán ver tus eventos compartibles (con invitados).' },
];

export function ConfiguracionView({ preferences, users }: Props) {
  const { canPerform } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = canPerform('ORGANIZATION_SETTINGS', 'edit');
  const [draft, setDraft] = useState<Draft>(() => toDraft(preferences));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [grantOpen, setGrantOpen] = useState(false);
  const [busyUser, setBusyUser] = useState<string | null>(null);

  // Cuando llegan preferencias nuevas del servidor se reinicia el borrador (sin efectos).
  const [seen, setSeen] = useState(preferences);
  if (seen !== preferences) {
    setSeen(preferences);
    setDraft(toDraft(preferences));
  }

  const access = useTenantQuery(['organizacion', 'access'], (signal) => organizacionService.getAccess(signal), { staleTime: 15_000 });
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(toDraft(preferences)), [draft, preferences]);
  const zones = useMemo(() => timeZoneOptions(draft.timezone), [draft.timezone]);

  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['tenant-module'] }); };

  const save = async () => {
    setSaving(true); setError('');
    try {
      await organizacionService.updatePreferences(draft);
      toast.success('Preferencias guardadas');
      refresh();
    } catch (e) {
      setError(errorMessage(e, 'No se pudieron guardar los cambios. Tus cambios siguen en pantalla.'));
    } finally {
      setSaving(false);
    }
  };

  const setDay = (key: keyof WorkingHours, patch: Partial<WorkingHours[keyof WorkingHours]>) =>
    setDraft((d) => ({ ...d, workingHours: { ...d.workingHours, [key]: { ...d.workingHours[key], ...patch } } }));

  const changeLevel = async (userId: string, level: OrgAccessLevel) => {
    setBusyUser(userId);
    try { await organizacionService.updateAccess(userId, { level }); toast.success('Acceso actualizado'); refresh(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusyUser(null); }
  };
  const revoke = async (userId: string) => {
    setBusyUser(userId);
    try { await organizacionService.revokeAccess(userId); toast.success('Acceso revocado'); refresh(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusyUser(null); }
  };

  const saveButton = (
    <Button type="button" onClick={save} disabled={!canEdit || !dirty || saving}>
      {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}Guardar cambios
    </Button>
  );

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <PageTitle guide={ORGANIZACION_GUIDES.configuracion} eyebrow="Organización" title="Configuración" subtitle="Ajusta tu calendario, horario laboral y privacidad con los permisos de NovaHub." actions={saveButton} />
      {!canEdit && <p role="status" className="rounded-xl border border-border bg-muted/40 p-3 text-[12px] text-muted-foreground">Tu rol solo puede consultar estas preferencias.</p>}
      {error && <ErrorState message={error} />}

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <Panel title="Preferencias del calendario" icon={<CalendarDays className="size-4" />}>
            <p className="mb-3 text-[12px] text-muted-foreground">Personaliza cómo se muestra tu agenda personal.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Zona horaria" htmlFor="cfg-tz">
                <NativeSelect id="cfg-tz" disabled={!canEdit} value={draft.timezone} onChange={(e) => setDraft((d) => ({ ...d, timezone: e.target.value }))}>
                  {zones.map((z) => <option key={z} value={z}>{z === draft.timezone ? timeZoneLabel(z) : z}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Vista predeterminada" htmlFor="cfg-view">
                <NativeSelect id="cfg-view" disabled={!canEdit} value={draft.defaultView} onChange={(e) => setDraft((d) => ({ ...d, defaultView: e.target.value as OrgViewMode }))}>
                  <option value="WEEK">Semana</option><option value="DAY">Día</option><option value="MONTH">Mes</option><option value="AGENDA">Agenda</option>
                </NativeSelect>
              </Field>
              <Field label="Primer día de la semana" htmlFor="cfg-week">
                <NativeSelect id="cfg-week" disabled={!canEdit} value={String(draft.weekStartsOn)} onChange={(e) => setDraft((d) => ({ ...d, weekStartsOn: Number(e.target.value) as 0 | 1 | 6 }))}>
                  <option value="1">Lunes</option><option value="0">Domingo</option><option value="6">Sábado</option>
                </NativeSelect>
              </Field>
              <Field label="Mostrar fines de semana" htmlFor="cfg-weekend">
                <NativeSelect id="cfg-weekend" disabled={!canEdit} value={draft.showWeekends ? 'yes' : 'no'} onChange={(e) => setDraft((d) => ({ ...d, showWeekends: e.target.value === 'yes' }))}>
                  <option value="yes">Sí</option><option value="no">No</option>
                </NativeSelect>
              </Field>
            </div>
            <p className="mt-3 flex gap-2 rounded-xl bg-accent/10 p-3 text-[12px]"><Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Estas preferencias no cambian la configuración global de la empresa ni las fechas originales de las actividades.</p>
          </Panel>

          <Panel title="Visibilidad de mi agenda" icon={<Eye className="size-4" />}>
            <p className="mb-2 text-[12px] text-muted-foreground">Define qué pueden consultar otras personas, respetando los permisos existentes.</p>
            <div role="radiogroup" aria-label="Visibilidad de mi agenda" className="divide-y divide-border">
              {VISIBILITY.map((v) => (
                <button key={v.id} type="button" role="radio" aria-checked={draft.visibility === v.id} disabled={!canEdit}
                  onClick={() => setDraft((d) => ({ ...d, visibility: v.id }))}
                  className="flex w-full items-start gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed">
                  <span className={cn('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border', draft.visibility === v.id ? 'border-primary' : 'border-border')} aria-hidden="true">
                    {draft.visibility === v.id && <span className="size-2 rounded-full bg-primary" />}
                  </span>
                  <span><span className="block text-[13px] font-semibold">{v.title}</span><span className="block text-[12px] text-muted-foreground">{v.hint}</span></span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">No se amplían los permisos de otros módulos ni los eventos privados de terceros.</p>
          </Panel>
        </div>

        <div className="min-w-0 space-y-4">
          <Panel title="Horario laboral" icon={<Clock className="size-4" />}>
            <p className="mb-2 text-[12px] text-muted-foreground">Define las horas que se muestran como disponibles en tu calendario de trabajo.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-[13px]">
                <thead><tr className="text-left text-[11px] text-muted-foreground"><th className="py-1 font-semibold">Día</th><th className="py-1 font-semibold">Inicio</th><th className="py-1 font-semibold">Fin</th><th className="py-1 text-right font-semibold">Laboral</th></tr></thead>
                <tbody>
                  {WEEK_DAY_KEYS.map((key) => {
                    const day = draft.workingHours[key];
                    return (
                      <tr key={key} className="border-t border-border">
                        <th scope="row" className="py-2 pr-2 text-left font-semibold">{WEEK_DAY_LABELS[key]}</th>
                        <td className="py-1.5 pr-2"><input type="time" className={controlClass} disabled={!canEdit || !day.enabled} value={day.start ?? ''} onChange={(e) => setDay(key, { start: e.target.value })} aria-label={`Inicio ${WEEK_DAY_LABELS[key]}`} /></td>
                        <td className="py-1.5 pr-2"><input type="time" className={controlClass} disabled={!canEdit || !day.enabled} value={day.end ?? ''} onChange={(e) => setDay(key, { end: e.target.value })} aria-label={`Fin ${WEEK_DAY_LABELS[key]}`} /></td>
                        <td className="py-1.5 text-right">
                          <Switch checked={day.enabled} disabled={!canEdit} aria-label={`${WEEK_DAY_LABELS[key]} laboral`}
                            onCheckedChange={(on) => setDay(key, on ? { enabled: true, start: day.start ?? '08:00', end: day.end ?? '17:00' } : { enabled: false })} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">El horario laboral sirve de referencia visual: no activa un sistema de reservas ni impide crear eventos fuera de jornada.</p>
          </Panel>

          <Panel title="Usuarios autorizados" icon={<Users className="size-4" />}
            action={canEdit ? <Button type="button" size="sm" variant="outline" onClick={() => setGrantOpen(true)}><UserPlus className="size-3.5" aria-hidden="true" />Agregar</Button> : undefined}>
            <p className="mb-2 text-[12px] text-muted-foreground">Personas con acceso a tu agenda.</p>
            {access.isLoading ? <Skeleton className="h-20 w-full" /> : access.isError ? <ErrorState message={errorMessage(access.error)} onRetry={() => void access.refetch()} /> : (
              <ul className="divide-y divide-border">
                {(access.data?.granted ?? []).length === 0 && <li className="py-3 text-[12px] text-muted-foreground">Nadie más tiene acceso a tu agenda.</li>}
                {(access.data?.granted ?? []).map((g) => (
                  <li key={g.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11px] font-bold text-primary dark:text-accent" aria-hidden="true">
                      {g.user.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')}
                    </span>
                    <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold">{g.user.name}</p><p className="truncate text-[11px] text-muted-foreground">{g.user.email}</p></div>
                    <NativeSelect className="h-9 w-auto max-w-[210px]" disabled={!canEdit || busyUser === g.user.id} value={g.level} aria-label={`Nivel de acceso de ${g.user.name}`}
                      onChange={(e) => void changeLevel(g.user.id, e.target.value as OrgAccessLevel)}>
                      {ACCESS_LEVELS.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                    </NativeSelect>
                    {canEdit && (
                      <Button type="button" size="icon" variant="ghost" className="size-8 text-destructive" disabled={busyUser === g.user.id} onClick={() => void revoke(g.user.id)} aria-label={`Revocar acceso de ${g.user.name}`}>
                        {busyUser === g.user.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground">El acceso requiere autorización del tenant y del usuario. Las tareas privadas mantienen su propia visibilidad.</p>
          </Panel>
        </div>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-primary dark:text-accent"><ShieldCheck className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0"><p className="text-[14px] font-semibold">Preferencias de Organización</p><p className="text-[12px] text-muted-foreground">No incluye booking público. Las invitaciones RSVP siguen vinculadas a eventos existentes.</p></div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={!dirty || saving} onClick={() => setDraft(toDraft(preferences))}>Descartar cambios</Button>
          {saveButton}
        </div>
      </section>

      <AutorizarAccesoSheet open={grantOpen} onOpenChange={setGrantOpen} users={users} excludeIds={(access.data?.granted ?? []).map((g) => g.user.id)} onSaved={refresh} />
    </div>
  );
}
