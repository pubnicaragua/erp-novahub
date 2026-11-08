import { AlertTriangle, CalendarCheck, Gauge, Hourglass, Scale } from 'lucide-react';
import { Card } from '../../ui/card';
import { Skeleton } from '../../ui/skeleton';
import { cn } from '../../ui/utils';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { employeeProfileService, LEAVE_TYPE_LABEL } from '../../../services/employee-profile.service';

const money = (value: number, currency: string) => `${currency} ${new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
const days = (value: number) => new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 }).format(value);

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'warn' | 'ok' }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/50 bg-muted/[0.12] p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn('mt-1 break-words text-lg font-black tabular-nums', tone === 'warn' && 'text-red-700', tone === 'ok' && 'text-emerald-700')}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-4 rounded-2xl border-border/60 bg-card p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">{icon}{title}</h3>
      {children}
    </Card>
  );
}

/** Resumen laboral de la ficha: antigüedad e indemnización, vacaciones acumuladas día a día, permisos y desempeño. */
export function EmployeeSummaryPanel({ employeeId }: { employeeId: string }) {
  const query = useTenantQuery(['hr', 'employee-summary', employeeId], (signal) => employeeProfileService.getSummary(employeeId, signal), { staleTime: 30_000 });
  if (query.isLoading) return <div className="space-y-4" aria-busy="true"><Skeleton className="h-32 w-full rounded-2xl" /><Skeleton className="h-40 w-full rounded-2xl" /></div>;
  if (query.isError || !query.data) return <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">No se pudo cargar el resumen laboral. Intenta de nuevo.</p>;
  const { tenure, vacations, leaves, performance, policy, currency } = query.data;

  return (
    <div className="space-y-5">
      <Section icon={<Hourglass className="size-4 text-primary" />} title="Antigüedad">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Tiempo en la empresa" value={`${tenure.years} a, ${tenure.months} m, ${tenure.days} d`} hint={`Desde el ${new Date(query.data.hireDate).toLocaleDateString('es-NI', { dateStyle: 'long', timeZone: 'UTC' })}`} />
          <Stat label="Indemnización a hoy" value={money(tenure.severanceAmount, currency)} hint={`${tenure.severanceMonths} mes(es) de salario`} />
          <Stat label="Valor de un día" value={money(tenure.dayValue, currency)} hint="Salario mensual ÷ 30" />
        </div>
        <p className="text-[11px] text-muted-foreground">{tenure.detail} Es un cálculo de referencia (despido sin causa); la liquidación final se arma en Nóminas con el motivo de salida.</p>
      </Section>

      <Section icon={<CalendarCheck className="size-4 text-primary" />} title="Vacaciones">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Acumuladas" value={`${days(vacations.accruedDays)} días`} hint={`${days(vacations.perMonth)} por mes · ${vacations.perDay.toFixed(4)} por día`} />
          <Stat label="Tomadas" value={`${days(vacations.takenDays)} días`} hint={vacations.pendingDays ? `${days(vacations.pendingDays)} por aprobar o por tomar` : undefined} />
          <Stat label="Saldo" value={`${days(vacations.balanceDays)} días`} tone={vacations.tookMoreThanOwed ? 'warn' : 'ok'} hint={vacations.tookMoreThanOwed ? 'Tomó más de lo que había acumulado' : undefined} />
          <Stat label="Si se pagan en dinero" value={money(vacations.balanceAmount, currency)} hint={`${days(Math.max(0, vacations.balanceDays))} día(s) × ${money(vacations.dayValue, currency)}`} />
        </div>
        {vacations.tookMoreThanOwed && <p className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-800"><AlertTriangle className="size-4 shrink-0" aria-hidden /> Este empleado tomó {days(Math.abs(vacations.balanceDays))} día(s) más de los que ha acumulado.</p>}
        <p className="text-[11px] text-muted-foreground">Se acumulan día a día desde la fecha de ingreso ({vacations.daysPerYear} días por año). Cada vacación aprobada se descuenta del saldo.</p>
      </Section>

      <Section icon={<Scale className="size-4 text-primary" />} title={`Permisos y ausencias de ${leaves.year}`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Este año" value={`${leaves.totalYear}`} hint={`${leaves.daysYear} día(s)`} />
          <Stat label="Este mes" value={`${leaves.totalMonth}`} hint={`${leaves.daysMonth} día(s)`} />
          <Stat label="Extraordinarias" value={`${leaves.extraordinaryYear}`} hint="Con menos aviso del mínimo" tone={leaves.extraordinaryYear > 2 ? 'warn' : undefined} />
          <Stat label="Aviso mínimo" value={`${policy.minNoticeHours} h`} hint={`El reglamento fija ${policy.policyNoticeHours} h`} />
        </div>
        {leaves.byType.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {leaves.byType.map((row) => (
              <li key={row.type} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2 text-sm"><span className="font-semibold">{LEAVE_TYPE_LABEL[row.type] ?? row.type}</span><span className="text-muted-foreground">{row.year} este año · {row.month} este mes</span></li>
            ))}
          </ul>
        )}
      </Section>

      <Section icon={<Gauge className="size-4 text-primary" />} title="Desempeño">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Promedio de evaluaciones" value={performance.averageRating === null ? '—' : `${performance.averageRating} / 5`} hint={performance.reviewCount ? `${performance.reviewCount} evaluación(es)` : 'Sin evaluaciones'} />
          <Stat label="Última evaluación" value={performance.lastRating === null ? '—' : `${performance.lastRating} / 5`} />
          <Stat label="Cumplimiento por hora (90 días)" value={performance.checkinCompliance === null ? '—' : `${performance.checkinCompliance} %`} hint="Preguntas «¿En qué estás trabajando?»" tone={performance.checkinCompliance !== null && performance.checkinCompliance < 50 ? 'warn' : undefined} />
          <Stat label="Respuestas a tiempo" value={performance.checkinResponseRate === null ? '—' : `${performance.checkinResponseRate} %`} />
        </div>
      </Section>
    </div>
  );
}
