import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { HotelReservation } from '../../services/hotel.service';

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const statusTone: Record<string, string> = {
  CONFIRMED: 'border-sky-300 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200',
  CHECKED_IN: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
  CHECKED_OUT: 'border-border bg-muted text-muted-foreground',
  CANCELLED: 'border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200',
  NO_SHOW: 'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
};

export function HotelCalendarView({ reservations, month, onMonthChange, onSelect }: {
  reservations: HotelReservation[];
  month: Date;
  onMonthChange: (month: Date) => void;
  onSelect: (reservation: HotelReservation) => void;
}) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - offset + 1));
  const visible = reservations.filter((reservation) => reservation.status !== 'CANCELLED' && reservation.status !== 'NO_SHOW');
  const monthName = month.toLocaleDateString('es-NI', { month: 'long', year: 'numeric' });

  return <section className="min-w-0 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Ocupación</p><h2 className="mt-1 text-xl font-black capitalize">{monthName}</h2></div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Mes anterior" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="size-4" /></Button>
        <Button variant="outline" size="sm" onClick={() => onMonthChange(new Date())}>Hoy</Button>
        <Button variant="outline" size="icon" aria-label="Mes siguiente" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="size-4" /></Button>
      </div>
    </div>
    <div className="grid grid-cols-7 border-l border-t border-border/60">
      {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => <div key={day} className="border-b border-r border-border/60 bg-muted/40 px-1 py-2 text-center text-[10px] font-black uppercase tracking-wider text-muted-foreground sm:text-xs">{day}</div>)}
      {days.map((day) => {
        const key = dateKey(day);
        const inMonth = day.getMonth() === month.getMonth();
        const staying = visible.filter((reservation) => reservation.checkIn.slice(0, 10) <= key && reservation.checkOut.slice(0, 10) > key);
        const arrivals = visible.filter((reservation) => reservation.checkIn.slice(0, 10) === key);
        const departures = visible.filter((reservation) => reservation.checkOut.slice(0, 10) === key);
        return <div key={key} className={`min-h-24 min-w-0 border-b border-r border-border/60 p-1.5 sm:min-h-32 sm:p-2 ${inMonth ? 'bg-card' : 'bg-muted/15 text-muted-foreground/60'}`}>
          <div className="flex items-center justify-between"><span className={`text-xs font-bold ${dateKey(new Date()) === key ? 'flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground' : ''}`}>{day.getDate()}</span><div className="hidden gap-1 sm:flex">{arrivals.length > 0 && <Badge variant="outline" className="px-1 py-0 text-[9px]">{arrivals.length} ent.</Badge>}{departures.length > 0 && <Badge variant="outline" className="px-1 py-0 text-[9px]">{departures.length} sal.</Badge>}</div></div>
          <div className="mt-1.5 space-y-1">
            {staying.slice(0, 3).map((reservation) => <button key={reservation.id} type="button" onClick={() => onSelect(reservation)} title={`${reservation.reservationNumber} · ${reservation.guestName}`} className={`block w-full truncate rounded-md border px-1.5 py-1 text-left text-[9px] font-bold leading-tight sm:text-[10px] ${statusTone[reservation.status] || statusTone.CONFIRMED}`}>
              <span className="hidden sm:inline">{reservation.room?.code || 'Hab.'} · </span>{reservation.guestName}
            </button>)}
            {staying.length > 3 && <p className="px-1 text-[9px] font-semibold text-muted-foreground">+{staying.length - 3} estadías</p>}
          </div>
        </div>;
      })}
    </div>
    <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-semibold text-muted-foreground sm:text-xs"><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-sky-500" />Confirmada</span><span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-emerald-500" />En curso</span><span className="flex items-center gap-1.5">Entrada/salida: el último día no ocupa habitación</span></div>
  </section>;
}
