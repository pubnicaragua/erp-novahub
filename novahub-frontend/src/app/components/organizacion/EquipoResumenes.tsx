import { useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Switch } from '../ui/switch';
import { cn } from '../ui/utils';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { organizacionService, type DigestSetting } from '../../services/organizacion.service';
import { toast } from '../../services/toast';
import { ErrorState, Panel, controlClass } from './OrgBits';
import { DIGEST_LABEL, DIGEST_WEEKDAYS, errorMessage } from './organizacion.utils';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const sameDays = (a: number[], b: number[]) => a.length === b.length && a.every((day, index) => day === b[index]);

/**
 * Administración: cuándo recibe cada persona sus resúmenes del día. La hora es la local de cada persona (la zona
 * horaria de su propia configuración), así que quien trabaja en otra zona recibe el aviso a su hora.
 */
export function EquipoResumenes() {
  const settings = useTenantQuery(['organizacion', 'team-digests'], (signal) => organizacionService.getDigestSettings(signal), { staleTime: 15_000 });
  return (
    <Panel title="Resúmenes programados" icon={<BellRing className="size-4" />}>
      <p className="mb-3 text-[12px] text-muted-foreground">
        Cada persona recibe estos avisos a la hora indicada en su propia zona horaria, en su bandeja de notificaciones y, si activó las notificaciones en su dispositivo, también en el celular o la computadora.
        El aviso solo llega si hay algo que revisar: nadie recibe resúmenes vacíos. No incluye montos ni datos de clientes, solo conteos y el próximo evento.
      </p>
      {settings.isLoading ? <Skeleton className="h-40 w-full" aria-busy="true" />
        : settings.isError ? <ErrorState message={errorMessage(settings.error, 'No se pudieron cargar los resúmenes')} onRetry={() => void settings.refetch()} />
        : (
          <ul className="space-y-3">
            {(settings.data ?? []).map((setting) => (
              // La clave incluye el valor guardado: al guardar o recargar, el borrador parte de lo que dice el servidor.
              <DigestRow key={`${setting.slot}:${setting.enabled}:${setting.localTime}:${setting.weekdays.join('')}`} setting={setting} />
            ))}
          </ul>
        )}
    </Panel>
  );
}

function DigestRow({ setting }: { setting: DigestSetting }) {
  const client = useQueryClient();
  const [enabled, setEnabled] = useState(setting.enabled);
  const [localTime, setLocalTime] = useState(setting.localTime);
  const [weekdays, setWeekdays] = useState<number[]>(setting.weekdays);
  const [busy, setBusy] = useState(false);
  const label = DIGEST_LABEL[setting.slot];
  const changed = enabled !== setting.enabled || localTime !== setting.localTime || !sameDays(weekdays, setting.weekdays);
  const invalid = !TIME.test(localTime) || weekdays.length === 0;

  const toggleDay = (day: number) => setWeekdays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort((a, b) => a - b)));

  const save = async () => {
    if (invalid) return toast.error(weekdays.length === 0 ? 'Elige al menos un día de la semana' : 'Indica la hora en formato HH:mm');
    setBusy(true);
    try {
      await organizacionService.saveDigestSetting(setting.slot, { enabled, localTime, weekdays });
      toast.success(enabled ? `${label.title}: se enviará a las ${localTime}` : `${label.title}: apagado`);
      void client.invalidateQueries({ queryKey: ['tenant-module'] });
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const timeId = `digest-time-${setting.slot}`;
  return (
    <li className="min-w-0 rounded-xl border border-border p-3" data-testid={`digest-${setting.slot}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold">{label.title}</p>
          <p className="text-[11px] text-muted-foreground">{label.hint}</p>
        </div>
        <label className="flex items-center gap-2 text-[12px] font-semibold">
          <Switch checked={enabled} onCheckedChange={setEnabled} aria-label={`Enviar el resumen «${label.title}»`} disabled={busy} />
          {enabled ? 'Activo' : 'Apagado'}
        </label>
      </div>
      <div className={cn('mt-3 flex flex-wrap items-end gap-x-4 gap-y-3', !enabled && 'opacity-60')}>
        <div className="space-y-1.5">
          <label htmlFor={timeId} className="block text-[12px] font-semibold">Hora local</label>
          <input id={timeId} type="time" value={localTime} onChange={(e) => setLocalTime(e.target.value)} disabled={busy} className={cn(controlClass, 'w-32')} />
        </div>
        <div className="space-y-1.5">
          <span id={`${timeId}-days`} className="block text-[12px] font-semibold">Días</span>
          <div role="group" aria-labelledby={`${timeId}-days`} className="flex flex-wrap gap-1">
            {DIGEST_WEEKDAYS.map((day) => (
              <button
                key={day.id}
                type="button"
                aria-pressed={weekdays.includes(day.id)}
                aria-label={day.label}
                title={day.label}
                disabled={busy}
                onClick={() => toggleDay(day.id)}
                className={cn(
                  'size-9 rounded-lg border text-[12px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60',
                  weekdays.includes(day.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted/50',
                )}
              >{day.short}</button>
            ))}
          </div>
        </div>
        <Button type="button" size="sm" disabled={!changed || busy || invalid} onClick={() => void save()}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}Guardar
        </Button>
      </div>
      {weekdays.length === 0 && <p role="alert" className="mt-2 text-[12px] font-semibold text-destructive">Elige al menos un día de la semana.</p>}
    </li>
  );
}
