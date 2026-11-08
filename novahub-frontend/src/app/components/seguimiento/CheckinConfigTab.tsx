import { useState } from 'react';
import { Loader2, Settings2, UserCog } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Switch } from '../ui/switch';
import { cn } from '../ui/utils';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { performanceService, type CheckinConfig, type CheckinUserSetting } from '../../services/performance.service';
import { toast } from '../../services/toast';
import { ErrorState, Field, NativeSelect, Panel, controlClass } from '../organizacion/OrgBits';
import { DIGEST_WEEKDAYS, errorMessage } from '../organizacion/organizacion.utils';

const numberOrNull = (value: string) => (value.trim() === '' ? null : Number(value));

/** Administración: cuándo se pregunta, a quién y cuánto tiempo hay para responder. Todo lo define la empresa. */
export function CheckinConfigTab() {
  const query = useTenantQuery(['performance', 'checkin-config'], (signal) => performanceService.getCheckinConfig(signal), { staleTime: 10_000 });
  if (query.isLoading) return <Skeleton className="h-96 w-full" aria-busy="true" />;
  if (query.isError || !query.data) return <ErrorState message={errorMessage(query.error, 'No se pudo cargar la configuración')} onRetry={() => void query.refetch()} />;
  // La clave incluye lo guardado: al guardar o recargar, el borrador parte de lo que dice el servidor.
  const key = JSON.stringify(query.data.config);
  return (
    <div className="space-y-4">
      <ConfigForm key={key} config={query.data.config} />
      <UserSettings users={query.data.users} settings={query.data.userSettings} audience={query.data.config.audience} defaults={query.data.config} />
    </div>
  );
}

function ConfigForm({ config }: { config: CheckinConfig }) {
  const client = useQueryClient();
  const [draft, setDraft] = useState<CheckinConfig>(config);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof CheckinConfig>(field: K, value: CheckinConfig[K]) => setDraft((current) => ({ ...current, [field]: value }));
  const changed = JSON.stringify(draft) !== JSON.stringify(config);
  const hasBreak = Boolean(draft.breakStart || draft.breakEnd);
  const invalid = draft.weekdays.length === 0 || draft.startTime >= draft.endTime || (hasBreak && (!draft.breakStart || !draft.breakEnd || draft.breakEnd <= draft.breakStart))
    || !(draft.intervalMinutes >= 5 && draft.intervalMinutes <= 480) || !(draft.responseMinutes >= 0 && draft.responseMinutes <= 240);

  const save = async () => {
    setBusy(true);
    try {
      await performanceService.saveCheckinConfig(draft);
      toast.success(draft.enabled ? 'Preguntas por hora activas' : 'Configuración guardada');
      void client.invalidateQueries({ queryKey: ['tenant-module'] });
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  const toggleDay = (day: number) => set('weekdays', draft.weekdays.includes(day) ? draft.weekdays.filter((d) => d !== day) : [...draft.weekdays, day].sort((a, b) => a - b));

  return (
    <Panel title="Preguntas por hora" icon={<Settings2 className="size-4" />}
      action={<label className="flex items-center gap-2 text-[12px] font-semibold"><Switch checked={draft.enabled} onCheckedChange={(value) => set('enabled', value)} disabled={busy} aria-label="Activar las preguntas por hora" />{draft.enabled ? 'Activas' : 'Apagadas'}</label>}>
      <p className="mb-4 text-[12px] text-muted-foreground">
        Cada persona recibe «¿En qué estás trabajando?» a la hora indicada, en su propia zona horaria, por notificación y dentro del ERP. Debe responder dentro del tiempo que fijes; si no lo hace se
        avisa a su supervisor y queda registrado. El supervisor califica la calidad de cada respuesta y de ahí sale el cumplimiento.
      </p>
      <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', !draft.enabled && 'opacity-70')}>
        <Field label="Primera pregunta" htmlFor="cfg-start"><input id="cfg-start" type="time" value={draft.startTime} onChange={(e) => set('startTime', e.target.value)} disabled={busy} className={controlClass} /></Field>
        <Field label="Última pregunta" htmlFor="cfg-end"><input id="cfg-end" type="time" value={draft.endTime} onChange={(e) => set('endTime', e.target.value)} disabled={busy} className={controlClass} /></Field>
        <Field label="Cada cuántos minutos" htmlFor="cfg-interval" hint="De 5 a 480. Cada hora = 60."><input id="cfg-interval" type="number" min={5} max={480} value={draft.intervalMinutes} onChange={(e) => set('intervalMinutes', Number(e.target.value))} disabled={busy} className={controlClass} /></Field>
        <Field label="Tiempo para responder (minutos)" htmlFor="cfg-response" hint="De 1 a 240. Escribe 0 para que no tengan límite de tiempo. Puedes cambiarlo por persona o al preguntar."><input id="cfg-response" type="number" min={0} max={240} value={draft.responseMinutes} onChange={(e) => set('responseMinutes', Number(e.target.value))} disabled={busy} className={controlClass} /></Field>
        <Field label="Pausa: desde (opcional)" htmlFor="cfg-break-start" hint="Sin preguntas durante la pausa."><input id="cfg-break-start" type="time" value={draft.breakStart ?? ''} onChange={(e) => set('breakStart', e.target.value || null)} disabled={busy} className={controlClass} /></Field>
        <Field label="Pausa: hasta" htmlFor="cfg-break-end"><input id="cfg-break-end" type="time" value={draft.breakEnd ?? ''} onChange={(e) => set('breakEnd', e.target.value || null)} disabled={busy} className={controlClass} /></Field>
        <Field label="A quién se pregunta" htmlFor="cfg-audience" className="sm:col-span-2">
          <NativeSelect id="cfg-audience" value={draft.audience} onChange={(e) => set('audience', e.target.value as CheckinConfig['audience'])} disabled={busy}>
            <option value="ALL">A todas las personas (puedes excluir a algunas abajo)</option>
            <option value="SELECTED">Solo a las personas que incluya abajo</option>
          </NativeSelect>
        </Field>
        <div className="space-y-1.5 sm:col-span-2 xl:col-span-4">
          <span id="cfg-days" className="block text-[12px] font-semibold">Días</span>
          <div role="group" aria-labelledby="cfg-days" className="flex flex-wrap gap-1">
            {DIGEST_WEEKDAYS.map((day) => (
              <button key={day.id} type="button" aria-pressed={draft.weekdays.includes(day.id)} aria-label={day.label} title={day.label} disabled={busy} onClick={() => toggleDay(day.id)}
                className={cn('size-9 rounded-lg border text-[12px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60', draft.weekdays.includes(day.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted/50')}>{day.short}</button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-[13px] sm:col-span-2"><Switch checked={draft.notifySupervisor} onCheckedChange={(value) => set('notifySupervisor', value)} disabled={busy} />Avisar al supervisor cuando alguien no responde a tiempo</label>
        <label className="flex items-center gap-2 text-[13px] sm:col-span-2"><Switch checked={draft.skipOnLeave} onCheckedChange={(value) => set('skipOnLeave', value)} disabled={busy} />No preguntar a quien tiene una ausencia o vacación aprobada</label>
      </div>
      {draft.weekdays.length === 0 && <p role="alert" className="mt-3 text-[12px] font-semibold text-destructive">Elige al menos un día.</p>}
      {draft.startTime >= draft.endTime && <p role="alert" className="mt-3 text-[12px] font-semibold text-destructive">La última pregunta debe ser posterior a la primera.</p>}
      <div className="mt-4 flex justify-end">
        <Button type="button" disabled={!changed || busy || invalid} onClick={() => void save()}>{busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Guardar</Button>
      </div>
    </Panel>
  );
}

function UserSettings({ users, settings, audience, defaults }: { users: Array<{ id: string; name: string; email: string }>; settings: CheckinUserSetting[]; audience: CheckinConfig['audience']; defaults: CheckinConfig }) {
  const byUser = new Map(settings.map((item) => [item.userId, item]));
  return (
    <Panel title="Ajustes por persona" icon={<UserCog className="size-4" />}>
      <p className="mb-3 text-[12px] text-muted-foreground">
        {audience === 'SELECTED' ? 'Solo se pregunta a quien esté incluido.' : 'Se pregunta a todas las personas; apaga a quien no deba responder.'} Deja en blanco lo que quieras que siga igual que la empresa
        (cada {defaults.intervalMinutes} min, {defaults.responseMinutes > 0 ? `${defaults.responseMinutes} min para responder` : 'sin límite para responder'}).
      </p>
      <ul className="space-y-2">
        {users.map((user) => {
          const setting = byUser.get(user.id);
          return <UserSettingRow key={`${user.id}:${JSON.stringify(setting ?? null)}`} user={user} setting={setting} audience={audience} />;
        })}
      </ul>
    </Panel>
  );
}

function UserSettingRow({ user, setting, audience }: { user: { id: string; name: string; email: string }; setting?: CheckinUserSetting; audience: CheckinConfig['audience'] }) {
  const client = useQueryClient();
  const included = setting ? setting.enabled : audience === 'ALL';
  const [enabled, setEnabled] = useState(included);
  const [interval, setIntervalValue] = useState(setting?.intervalMinutes?.toString() ?? '');
  const [response, setResponse] = useState(setting?.responseMinutes?.toString() ?? '');
  const [busy, setBusy] = useState(false);
  const changed = enabled !== included || interval !== (setting?.intervalMinutes?.toString() ?? '') || response !== (setting?.responseMinutes?.toString() ?? '');

  const save = async () => {
    setBusy(true);
    try {
      await performanceService.saveCheckinUserSetting(user.id, { enabled, intervalMinutes: numberOrNull(interval), responseMinutes: numberOrNull(response) });
      toast.success(`Ajuste de ${user.name} guardado`);
      void client.invalidateQueries({ queryKey: ['tenant-module'] });
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  const reset = async () => {
    setBusy(true);
    try {
      await performanceService.deleteCheckinUserSetting(user.id);
      void client.invalidateQueries({ queryKey: ['tenant-module'] });
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <li className="flex min-w-0 flex-wrap items-end gap-x-4 gap-y-2 rounded-xl border border-border p-3">
      <label className="flex min-w-44 flex-1 items-center gap-2 text-[13px] font-semibold">
        <Switch checked={enabled} onCheckedChange={setEnabled} disabled={busy} aria-label={`Preguntar a ${user.name}`} />
        <span className="min-w-0 break-words">{user.name}<span className="block text-[11px] font-normal text-muted-foreground">{user.email}</span></span>
      </label>
      <Field label="Cada (min)" className="w-24"><input type="number" min={5} max={480} placeholder="Igual" value={interval} onChange={(e) => setIntervalValue(e.target.value)} disabled={busy || !enabled} className={controlClass} aria-label={`Intervalo de ${user.name} en minutos`} /></Field>
      <Field label="Responder en (min, 0 = sin límite)" className="w-40"><input type="number" min={0} max={240} placeholder="Igual" value={response} onChange={(e) => setResponse(e.target.value)} disabled={busy || !enabled} className={controlClass} aria-label={`Minutos para responder de ${user.name}`} /></Field>
      <Button type="button" size="sm" disabled={!changed || busy} onClick={() => void save()}>{busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Guardar</Button>
      {setting && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void reset()}>Quitar ajuste</Button>}
    </li>
  );
}
