import { useState } from 'react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../ui/utils';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { performanceService } from '../../services/performance.service';
import { EmptyState, ErrorState, Panel, controlClass } from '../organizacion/OrgBits';
import { errorMessage, formatMinutes } from '../organizacion/organizacion.utils';
import { longCivilDate, shiftCivilDate } from './seguimiento.utils';
import { getCurrencyDecimalPlaces } from '../../utils/currency';

const money = (value: number) => new Intl.NumberFormat('es-NI', { maximumFractionDigits: getCurrencyDecimalPlaces() }).format(value);

/** Cuánto genera el equipo en cada hora del día: oportunidades, visitas, mensajes, facturas y respuestas. */
export function TeamHourlyTab() {
  const [date, setDate] = useState<string | null>(null);
  const team = useTenantQuery(['performance', 'team-hourly', date ?? 'today'], (signal) => performanceService.getTeamHourly({ date: date ?? undefined }, signal), { staleTime: 30_000 });
  const current = team.data?.date;
  const attendance = useTenantQuery(['performance', 'team-attendance', current ?? 'today'], (signal) => performanceService.getTeamAttendance({ date: current ?? undefined }, signal), { staleTime: 30_000 });
  const clock = (value?: string | null) => (value ? new Date(value).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '—');

  const maxOpportunities = Math.max(1, ...(team.data?.hours.map((hour) => hour.opportunities) ?? [1]));
  const activeHours = team.data?.hours.filter((hour) => hour.opportunities || hour.visits || hour.messages || hour.invoices || hour.checkinsAnswered || hour.checkinsMissed || hour.workedMinutes) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <span className="block text-[12px] font-semibold">Día</span>
          <div className="flex items-center gap-1">
            <Button type="button" size="icon" variant="outline" aria-label="Día anterior" disabled={!current} onClick={() => setDate(shiftCivilDate(current as string, -1))}><ChevronLeft className="size-4" /></Button>
            <input type="date" aria-label="Elegir un día" value={current ?? ''} onChange={(e) => e.target.value && setDate(e.target.value)} className={cn(controlClass, 'w-40')} />
            <Button type="button" size="icon" variant="outline" aria-label="Día siguiente" disabled={!current} onClick={() => setDate(shiftCivilDate(current as string, 1))}><ChevronRight className="size-4" /></Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setDate(null)}>Hoy</Button>
          </div>
        </div>
        {current && <p className="pb-2 text-[13px] font-semibold capitalize text-primary dark:text-foreground">{longCivilDate(current)}</p>}
      </div>

      {team.isLoading ? <Skeleton className="h-64 w-full" aria-busy="true" />
        : team.isError ? <ErrorState message={errorMessage(team.error, 'No se pudo cargar el resumen por hora')} onRetry={() => void team.refetch()} />
        : team.data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {[
                ['Oportunidades', team.data.totals.opportunities], ['Visitas', team.data.totals.visits], ['Mensajes', team.data.totals.messages],
                ['Facturas', team.data.totals.invoices], ['Facturado', money(team.data.totals.invoiceAmount)], ['En tareas', formatMinutes(team.data.totals.workedMinutes)],
              ].map(([label, value]) => (
                <div key={String(label)} className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <p className="text-[12px] text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-bold text-primary dark:text-foreground">{value}</p>
                </div>
              ))}
            </div>

            <Panel title="Oportunidades de venta por hora" icon={<Sparkles className="size-4" />}>
              <div className="flex h-40 items-end gap-1" role="img" aria-label="Oportunidades generadas en cada hora del día">
                {team.data.hours.map((hour) => (
                  <div key={hour.hour} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${hour.label}: ${hour.opportunities} oportunidades`}>
                    <span className="text-[10px] font-semibold text-muted-foreground">{hour.opportunities || ''}</span>
                    <div className={cn('w-full rounded-t', hour.opportunities ? 'bg-violet-500' : 'bg-muted')} style={{ height: `${hour.opportunities ? Math.max(8, (hour.opportunities / maxOpportunities) * 100) : 2}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex gap-1 text-[10px] text-muted-foreground" aria-hidden="true">
                {team.data.hours.map((hour) => <span key={hour.hour} className="min-w-0 flex-1 text-center">{hour.hour % 3 === 0 ? hour.hour : ''}</span>)}
              </div>
            </Panel>

            <Panel title="Asistencia del día">
              {attendance.isLoading ? <Skeleton className="h-24 w-full" aria-busy="true" />
                : attendance.isError ? <ErrorState message={errorMessage(attendance.error, 'No se pudo cargar la asistencia')} onRetry={() => void attendance.refetch()} />
                : !attendance.data || attendance.data.members.length === 0 ? <EmptyState title="Sin marcas" description="Nadie ha marcado entrada en este día." /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-[12px]">
                      <thead className="text-muted-foreground"><tr>{['Persona', 'Entrada', 'Salió a almorzar', 'Regresó', 'Salida', 'Horas'].map((h) => <th key={h} scope="col" className="px-2 py-1.5 font-semibold">{h}</th>)}</tr></thead>
                      <tbody>
                        {attendance.data.members.map((m) => (
                          <tr key={`${m.userId}-${m.name}`} className="border-t border-border">
                            <th scope="row" className="px-2 py-1.5 font-semibold">{m.name}</th>
                            <td className="px-2 py-1.5 tabular-nums">{clock(m.checkIn)}</td><td className="px-2 py-1.5 tabular-nums">{clock(m.breakStartAt)}</td>
                            <td className="px-2 py-1.5 tabular-nums">{clock(m.breakEndAt)}</td><td className="px-2 py-1.5 tabular-nums">{clock(m.checkOut)}</td>
                            <td className="px-2 py-1.5 tabular-nums">{m.hoursWorked ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </Panel>

            <div className="grid gap-4 xl:grid-cols-2">
              <Panel title="Por hora">
                {activeHours.length === 0 ? <EmptyState title="Sin actividad" description="Aún no hay actividad registrada en este día." /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-[12px]">
                      <thead className="text-muted-foreground"><tr>{['Hora', 'Oportunidades', 'Visitas', 'Mensajes', 'Facturas', 'Respuestas'].map((h) => <th key={h} scope="col" className="px-2 py-1.5 font-semibold">{h}</th>)}</tr></thead>
                      <tbody>
                        {activeHours.map((hour) => (
                          <tr key={hour.hour} className="border-t border-border">
                            <th scope="row" className="px-2 py-1.5 font-semibold tabular-nums">{hour.label}</th>
                            <td className="px-2 py-1.5">{hour.opportunities}</td><td className="px-2 py-1.5">{hour.visits}</td><td className="px-2 py-1.5">{hour.messages}</td>
                            <td className="px-2 py-1.5">{hour.invoices ? `${hour.invoices} · ${money(hour.invoiceAmount)}` : 0}</td>
                            <td className="px-2 py-1.5">{hour.checkinsAnswered}{hour.checkinsMissed ? <span className="text-red-700"> (+{hour.checkinsMissed} sin respuesta)</span> : null}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
              <Panel title="Por persona">
                {team.data.members.length === 0 ? <EmptyState title="Sin personas con actividad" description="Cuando alguien registre actividad en este día aparecerá aquí." /> : (
                  <ul className="space-y-2">
                    {team.data.members.map((member) => (
                      <li key={member.userId} className="min-w-0 rounded-xl border border-border p-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="break-words text-[13px] font-semibold">{member.name}</p>
                          <p className="text-[11px] text-muted-foreground">{member.opportunities} oportunidades · {member.visits} visitas · {member.messages} mensajes · {formatMinutes(member.workedMinutes)}</p>
                        </div>
                        <div className="mt-2 flex gap-0.5" role="img" aria-label={`Oportunidades por hora de ${member.name}`}>
                          {member.opportunitiesByHour.map((count, hour) => (
                            <span key={hour} title={`${String(hour).padStart(2, '0')}:00 · ${count}`} className={cn('h-4 min-w-0 flex-1 rounded-sm', count === 0 ? 'bg-muted' : count === 1 ? 'bg-violet-300' : count === 2 ? 'bg-violet-500' : 'bg-violet-700')} />
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          </>
        ) : null}
    </div>
  );
}
