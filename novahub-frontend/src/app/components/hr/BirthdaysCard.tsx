import { Cake } from 'lucide-react';
import { Card } from '../ui/card';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../ui/utils';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { employeeProfileService, type Birthday } from '../../services/employee-profile.service';

const MONTH = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const when = (row: Birthday) => (row.isToday ? 'Hoy' : row.daysUntil === 1 ? 'Mañana' : row.daysUntil < 0 ? `El ${row.day}` : `El ${row.day} (en ${row.daysUntil} días)`);

/** Cumpleañeros del mes y próximos 30 días; lo ve todo el equipo (solo nombre, cargo y fecha). Sin cumpleaños, no ocupa lugar. */
export function BirthdaysCard({ className }: { className?: string }) {
  const month = useTenantQuery(['hr', 'birthdays-month'], (signal) => employeeProfileService.getBirthdays(undefined, signal), { staleTime: 5 * 60_000, retry: false });
  const upcoming = useTenantQuery(['hr', 'birthdays-upcoming'], (signal) => employeeProfileService.getUpcomingBirthdays(30, signal), { staleTime: 5 * 60_000, retry: false });
  if (month.isLoading) return <Skeleton className="h-24 w-full rounded-2xl" aria-busy="true" />;
  if (month.isError || !month.data) return null;
  const items = month.data.items;
  const next = (upcoming.data ?? []).filter((row) => !items.some((own) => own.employeeId === row.employeeId));
  if (!items.length && !next.length) return null;

  return (
    <Card className={cn('space-y-3 rounded-2xl border-border/60 bg-card/80 p-4 shadow-sm', className)} data-testid="birthdays-card">
      <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest"><Cake className="size-4 text-primary" aria-hidden /> Cumpleaños de {MONTH[month.data.month - 1]}</h3>
      {items.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((row) => (
            <li key={row.employeeId} className={cn('flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm', row.isToday ? 'border-primary/50 bg-primary/5' : 'border-border/60')}>
              <span className="min-w-0"><strong className="break-words">{row.name}</strong><span className="block text-[11px] text-muted-foreground">{row.position ?? row.department ?? ''}{row.turnsAge ? ` · cumple ${row.turnsAge}` : ''}</span></span>
              <span className={cn('shrink-0 text-xs font-semibold', row.isToday ? 'text-primary' : 'text-muted-foreground')}>{row.isToday ? 'Hoy' : `${row.day} de ${MONTH[row.month - 1]}`}</span>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted-foreground">Nadie cumple años este mes.</p>}
      {next.length > 0 && <p className="text-[12px] text-muted-foreground"><strong>Próximos:</strong> {next.slice(0, 4).map((row) => `${row.name} (${when(row)})`).join(' · ')}</p>}
    </Card>
  );
}
