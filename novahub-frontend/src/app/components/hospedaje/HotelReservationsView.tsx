import { ArrowUpRight, CalendarCheck, CircleUserRound } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { HotelReservation } from '../../services/hotel.service';

const labels: Record<string, string> = { CONFIRMED: 'Confirmada', CHECKED_IN: 'En curso', CHECKED_OUT: 'Finalizada', CANCELLED: 'Cancelada', NO_SHOW: 'No llegó' };
const tones: Record<string, string> = { CONFIRMED: 'bg-sky-500/10 text-sky-700 dark:text-sky-300', CHECKED_IN: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', CHECKED_OUT: 'bg-muted text-muted-foreground', CANCELLED: 'bg-rose-500/10 text-rose-700 dark:text-rose-300', NO_SHOW: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' };
const date = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' });

export function HotelReservationsView({ reservations, onSelect, onCreate }: {
  reservations: HotelReservation[];
  onSelect: (reservation: HotelReservation) => void;
  onCreate: () => void;
}) {
  return <section className="min-w-0 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Recepción</p><h2 className="mt-1 text-xl font-black">Reservas y estadías</h2><p className="mt-1 text-sm text-muted-foreground">Consulta los huéspedes y administra el ciclo de cada reserva.</p></div><Button onClick={onCreate}><CalendarCheck className="size-4" />Nueva reserva</Button></div>
    {!reservations.length ? <div className="rounded-xl border border-dashed border-border p-8 text-center"><CircleUserRound className="mx-auto size-8 text-muted-foreground/50" /><p className="mt-3 font-bold">Aún no hay reservas</p><p className="mt-1 text-sm text-muted-foreground">Crea una reserva para comenzar a organizar la ocupación.</p><Button variant="outline" className="mt-4" onClick={onCreate}>Crear reserva</Button></div> : <div className="space-y-2">
      {reservations.map((reservation) => <article key={reservation.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-border/60 bg-background/60 p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="flex min-w-0 flex-1 items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CircleUserRound className="size-5" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-bold">{reservation.guestName}</h3><Badge className={tones[reservation.status] || ''}>{labels[reservation.status] || reservation.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{reservation.reservationNumber} · {reservation.room?.code || 'Habitación'} · {reservation.room?.roomType?.name || 'Tipo sin nombre'}</p><p className="mt-1 text-sm font-semibold">{date(reservation.checkIn)} <span className="text-muted-foreground">→</span> {date(reservation.checkOut)}</p></div></div>
        <div className="flex items-center justify-between gap-3 sm:justify-end"><span className="text-sm font-black text-primary">{reservation.currency === 'USD' ? '$' : 'C$'}{Number(reservation.nightlyRate).toLocaleString('es-NI', { minimumFractionDigits: 2 })}<span className="ml-1 text-[10px] font-semibold text-muted-foreground">/ noche</span></span><Button variant="outline" size="sm" onClick={() => onSelect(reservation)}><span className="hidden sm:inline">Ver estadía</span><ArrowUpRight className="size-4 sm:ml-1" /></Button></div>
      </article>)}
    </div>}
  </section>;
}
