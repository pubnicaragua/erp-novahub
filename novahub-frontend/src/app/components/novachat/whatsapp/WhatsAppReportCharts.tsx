import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import type { WaReport } from '../../../services/whatsapp.service';
import { formatDuration, initials } from './whatsappUi';

const IN_COLOR = '#10b981';
const OUT_COLOR = '#0ea5e9';
const nf = (n: number) => n.toLocaleString('es-NI');
const DOW_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DOW_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function dayLabel(key: string, withDow = false) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${withDow ? `${DOW_SHORT[date.getDay()]} ` : ''}${d} ${MONTHS[m - 1]}`;
}

/** Completa con ceros los días sin mensajes para que la línea del tiempo sea continua. */
export function fillDays(daily: WaReport['daily'], fromIso: string, toIso: string) {
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const out: Array<{ day: string; in: number; out: number }> = [];
  const cursor = new Date(fromIso);
  cursor.setHours(12, 0, 0, 0);
  const end = new Date(toIso);
  end.setHours(12, 0, 0, 0);
  for (let i = 0; cursor <= end && i < 400; i += 1) {
    const key = dayKey(cursor);
    out.push(byDay.get(key) || { day: key, in: 0, out: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function niceMax(value: number) {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/** Curva suave que pasa por los puntos. */
function smoothPath(points: Array<[number, number]>) {
  if (points.length < 3) return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  return d;
}

/** Mensajes por día: dos curvas (recibidos y enviados) con cuadrícula, ejes y detalle al pasar el cursor. */
export function DailyChart({ data, from, to }: { data: WaReport['daily']; from: string; to: string }) {
  const days = useMemo(() => fillDays(data, from, to), [data, from, to]);
  const [hover, setHover] = useState<number | null>(null);
  const W = 760;
  const H = 240;
  const L = 40;
  const R = 12;
  const T = 12;
  const B = 28;
  const total = data.reduce((s, d) => s + d.in + d.out, 0);
  if (!total) return <p className="py-10 text-center text-xs text-muted-foreground">Sin mensajes en este período.</p>;
  const max = niceMax(Math.max(1, ...days.map((d) => Math.max(d.in, d.out))));
  const x = (i: number) => (days.length === 1 ? L + (W - L - R) / 2 : L + (i / (days.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const series = (key: 'in' | 'out'): Array<[number, number]> => days.map((d, i) => [x(i), y(d[key])]);
  const area = (key: 'in' | 'out') => {
    const pts = series(key);
    return `${smoothPath(pts)} L${pts[pts.length - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z`;
  };
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  const step = Math.max(1, Math.ceil(days.length / 8));
  const hovered = hover != null ? days[hover] : null;

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Mensajes por día: ${nf(data.reduce((s, d) => s + d.in, 0))} recibidos y ${nf(data.reduce((s, d) => s + d.out, 0))} enviados`}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - box.left) / box.width) * W;
            const idx = Math.round(((px - L) / (W - L - R)) * (days.length - 1));
            setHover(Math.max(0, Math.min(days.length - 1, idx)));
          }}>
          <defs>
            <linearGradient id="wa-in" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={IN_COLOR} stopOpacity="0.35" /><stop offset="100%" stopColor={IN_COLOR} stopOpacity="0.02" /></linearGradient>
            <linearGradient id="wa-out" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={OUT_COLOR} stopOpacity="0.3" /><stop offset="100%" stopColor={OUT_COLOR} stopOpacity="0.02" /></linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={t === 0 ? 0.25 : 0.1} strokeDasharray={t === 0 ? undefined : '3 4'} />
              <text x={L - 8} y={y(t) + 3} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.55">{nf(t)}</text>
            </g>
          ))}
          {days.map((d, i) => (i % step === 0 || i === days.length - 1) && (
            <text key={d.day} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'} fontSize="10" fill="currentColor" fillOpacity="0.55">{dayLabel(d.day)}</text>
          ))}
          <path d={area('in')} fill="url(#wa-in)" />
          <path d={area('out')} fill="url(#wa-out)" />
          <path d={smoothPath(series('in'))} fill="none" stroke={IN_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d={smoothPath(series('out'))} fill="none" stroke={OUT_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {days.length <= 31 && days.map((d, i) => (
            <g key={d.day}>
              {d.in > 0 && <circle cx={x(i)} cy={y(d.in)} r="3" fill="#fff" stroke={IN_COLOR} strokeWidth="2" />}
              {d.out > 0 && <circle cx={x(i)} cy={y(d.out)} r="3" fill="#fff" stroke={OUT_COLOR} strokeWidth="2" />}
            </g>
          ))}
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={y(0)} stroke="currentColor" strokeOpacity="0.35" />}
          {hovered && <><circle cx={x(hover as number)} cy={y(hovered.in)} r="5" fill={IN_COLOR} /><circle cx={x(hover as number)} cy={y(hovered.out)} r="5" fill={OUT_COLOR} /></>}
        </svg>
        {hovered && (
          <div className="pointer-events-none absolute top-1 z-10 rounded-xl border border-border/60 bg-popover px-3 py-2 text-xs shadow-lg" style={{ left: `${(x(hover as number) / W) * 100}%`, transform: `translateX(${(hover as number) > days.length / 2 ? '-105%' : '5%'})` }}>
            <p className="font-black">{dayLabel(hovered.day, true)}</p>
            <p className="mt-1 flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ backgroundColor: IN_COLOR }} />{nf(hovered.in)} recibidos</p>
            <p className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ backgroundColor: OUT_COLOR }} />{nf(hovered.out)} enviados</p>
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] font-bold">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ backgroundColor: IN_COLOR }} />Recibidos</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ backgroundColor: OUT_COLOR }} />Enviados</span>
        <span className="ml-auto font-normal text-muted-foreground">Día con más mensajes: {dayLabel([...days].sort((a, b) => b.in + b.out - (a.in + a.out))[0].day, true)}</span>
      </div>
    </div>
  );
}

/** Mapa de calor día × hora, con totales por día y por franja del día. */
export function PeakHeatmap({ data, tz }: { data: WaReport['hourly']; tz: string }) {
  const info = useMemo(() => {
    const grid = new Map(data.map((h) => [`${h.dow}-${h.hour}`, h.count]));
    const dayTotals = new Array(7).fill(0) as number[];
    const hourTotals = new Array(24).fill(0) as number[];
    data.forEach((h) => { dayTotals[h.dow] += h.count; hourTotals[h.hour] += h.count; });
    const max = Math.max(1, ...data.map((h) => h.count));
    const peak = data.reduce((b, h) => (h.count > b.count ? h : b), { dow: 0, hour: 0, count: 0 });
    const band = (from: number, to: number) => hourTotals.slice(from, to).reduce((s, n) => s + n, 0);
    return { grid, dayTotals, hourTotals, max, peak, bands: [{ label: 'Madrugada', range: '0–6 h', n: band(0, 6) }, { label: 'Mañana', range: '6–12 h', n: band(6, 12) }, { label: 'Tarde', range: '12–18 h', n: band(12, 18) }, { label: 'Noche', range: '18–24 h', n: band(18, 24) }], dayMax: Math.max(1, ...dayTotals) };
  }, [data]);
  const [hover, setHover] = useState<{ dow: number; hour: number } | null>(null);
  if (!data.length) return <p className="py-10 text-center text-xs text-muted-foreground">Sin mensajes recibidos en este período.</p>;
  const order = [1, 2, 3, 4, 5, 6, 0];
  const bandTotal = Math.max(1, info.bands.reduce((s, b) => s + b.n, 0));
  const shade = (n: number) => (n === 0 ? 'rgba(16,185,129,0.06)' : `rgba(16,185,129,${0.16 + (n / info.max) * 0.84})`);
  const hoverCount = hover ? info.grid.get(`${hover.dow}-${hover.hour}`) || 0 : null;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="flex items-end gap-1.5 pl-10">
            <div className="grid flex-1 gap-[3px] text-[9px] text-muted-foreground" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
              {Array.from({ length: 24 }, (_, h) => <span key={h} className="text-center">{h % 2 === 0 ? h : ''}</span>)}
            </div>
            <span className="w-16 shrink-0 text-right text-[9px] text-muted-foreground">Total</span>
          </div>
          {order.map((d) => (
            <div key={d} className="mt-[3px] flex items-center gap-1.5">
              <span className="w-9 shrink-0 text-[11px] font-bold text-muted-foreground">{DOW_SHORT[d]}</span>
              <div className="grid flex-1 gap-[3px]" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                {Array.from({ length: 24 }, (_, h) => {
                  const n = info.grid.get(`${d}-${h}`) || 0;
                  const isPeak = n > 0 && info.peak.dow === d && info.peak.hour === h;
                  return (
                    <div
                      key={h}
                      className={`h-7 rounded-[5px] transition-transform hover:scale-110 ${isPeak ? 'ring-2 ring-emerald-700 ring-offset-1 ring-offset-card' : ''}`}
                      style={{ backgroundColor: shade(n) }}
                      onMouseEnter={() => setHover({ dow: d, hour: h })}
                      onMouseLeave={() => setHover(null)}
                      title={`${DOW_LONG[d]} ${h}:00 a ${h}:59 · ${n} ${n === 1 ? 'mensaje recibido' : 'mensajes recibidos'}`}
                    />
                  );
                })}
              </div>
              <div className="flex w-16 shrink-0 items-center gap-1.5">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${(info.dayTotals[d] / info.dayMax) * 100}%` }} /></div>
                <span className="w-6 text-right text-[10px] font-bold tabular-nums">{nf(info.dayTotals[d])}</span>
              </div>
            </div>
          ))}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pl-10 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">Menos<span className="flex gap-[2px]">{[0.06, 0.25, 0.5, 0.75, 1].map((o) => <span key={o} className="size-3 rounded-[3px]" style={{ backgroundColor: `rgba(16,185,129,${o})` }} />)}</span>Más</span>
            <span aria-live="polite">{hover ? `${DOW_LONG[hover.dow]} ${hover.hour}:00 · ${hoverCount} ${hoverCount === 1 ? 'mensaje' : 'mensajes'}` : `Zona horaria: ${tz}`}</span>
          </div>
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-[11px] font-black text-muted-foreground">Cuándo escriben más, por franja del día</p>
        <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label="Reparto de mensajes por franja del día">
          {info.bands.map((b, i) => <div key={b.label} style={{ width: `${(b.n / bandTotal) * 100}%`, backgroundColor: ['#94a3b8', '#fbbf24', '#10b981', '#6366f1'][i] }} title={`${b.label}: ${nf(b.n)}`} />)}
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-4">
          {info.bands.map((b, i) => <span key={b.label} className="flex items-center gap-1.5"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: ['#94a3b8', '#fbbf24', '#10b981', '#6366f1'][i] }} /><span className="truncate"><b>{b.label}</b> <span className="text-muted-foreground">{Math.round((b.n / bandTotal) * 100)}%</span></span></span>)}
        </div>
      </div>
    </div>
  );
}

/** Cuánto tarda la primera respuesta según la hora en que escribió el cliente. */
export function ResponseByHour({ data }: { data: WaReport['responseByHour'] }) {
  const rows = data.filter((h) => h.conversations > 0);
  if (!rows.length) return <p className="py-8 text-center text-xs text-muted-foreground">Sin conversaciones nuevas en este período.</p>;
  const max = Math.max(1, ...rows.map((h) => h.avgSec ?? 0));
  const color = (sec: number | null) => (sec == null ? '#cbd5e1' : sec <= 300 ? '#10b981' : sec <= 1800 ? '#f59e0b' : '#f43f5e');
  const worst = rows.filter((h) => h.avgSec != null).sort((a, b) => (b.avgSec as number) - (a.avgSec as number))[0];
  return (
    <div>
      <div className="flex h-36 items-end gap-[3px]" role="img" aria-label="Tiempo promedio de primera respuesta por hora">
        {Array.from({ length: 24 }, (_, h) => {
          const row = rows.find((r) => r.hour === h);
          return (
            <div key={h} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={row ? `${h}:00 · ${row.conversations} conversaciones nuevas · respuesta ${formatDuration(row.avgSec)}${row.unanswered ? ` · ${row.unanswered} sin responder` : ''}` : `${h}:00 · sin conversaciones nuevas`}>
              <div className="w-full rounded-t-[4px] transition-opacity group-hover:opacity-75" style={{ height: row && row.avgSec != null ? `${Math.max(4, (row.avgSec / max) * 100)}%` : row ? '4%' : '0%', backgroundColor: color(row?.avgSec ?? null) }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 grid text-center text-[9px] text-muted-foreground" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>{Array.from({ length: 24 }, (_, h) => <span key={h}>{h % 3 === 0 ? h : ''}</span>)}</div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-500" />Hasta 5 min</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-amber-500" />Hasta 30 min</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-rose-500" />Más de 30 min</span>
        {worst && <span className="ml-auto text-muted-foreground">Más lentos a las {worst.hour}:00 ({formatDuration(worst.avgSec)})</span>}
      </div>
    </div>
  );
}

function ago(iso: string | null) {
  if (!iso) return '';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `hace ${Math.max(1, minutes)} min`;
  if (minutes < 1440) return `hace ${Math.round(minutes / 60)} h`;
  return `hace ${Math.round(minutes / 1440)} d`;
}

/** Quién escribe más: contactos y grupos con su reparto de recibidos y enviados. */
export function TopContacts({ data }: { data: WaReport['topContacts'] }) {
  if (!data.length) return <p className="py-6 text-center text-xs text-muted-foreground">Sin mensajes en este período.</p>;
  const max = Math.max(1, data[0].messages);
  const total = data.reduce((s, c) => s + c.messages, 0);
  return (
    <ol className="space-y-1">
      {data.slice(0, 10).map((c, i) => (
        <li key={c.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted/40">
          <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${i < 3 ? 'bg-amber-100 text-amber-800' : 'text-muted-foreground'}`}>{i + 1}</span>
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-white ${c.isGroup ? 'bg-violet-500' : 'bg-emerald-600'}`}>{c.isGroup ? <Users className="size-4" /> : initials(c.name)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-xs font-black">{c.name}{c.isGroup && <span className="ml-1.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">Grupo</span>}</p>
              <p className="shrink-0 text-xs font-black tabular-nums">{nf(c.messages)} <span className="text-[10px] font-normal text-muted-foreground">({Math.round((c.messages / total) * 100)}%)</span></p>
            </div>
            <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-muted" style={{ width: `${(c.messages / max) * 100}%`, minWidth: '8%' }}>
              <div style={{ width: `${(c.inbound / c.messages) * 100}%`, backgroundColor: IN_COLOR }} />
              <div style={{ width: `${(c.outbound / c.messages) * 100}%`, backgroundColor: OUT_COLOR }} />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">{nf(c.inbound)} recibidos · {nf(c.outbound)} enviados{c.lastAt ? ` · último ${ago(c.lastAt)}` : ''}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Barra partida de dos partes (por ejemplo nuevos y recurrentes). */
export function SplitBar({ a, b, aLabel, bLabel, aColor = IN_COLOR, bColor = '#6366f1' }: { a: number; b: number; aLabel: string; bLabel: string; aColor?: string; bColor?: string }) {
  const total = a + b;
  if (!total) return <p className="py-4 text-center text-xs text-muted-foreground">Sin datos en este período.</p>;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-muted"><div style={{ width: `${(a / total) * 100}%`, backgroundColor: aColor }} /><div style={{ width: `${(b / total) * 100}%`, backgroundColor: bColor }} /></div>
      <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
        <div><p className="flex items-center gap-1.5 font-bold"><span className="size-2.5 rounded-full" style={{ backgroundColor: aColor }} />{aLabel}</p><p className="mt-0.5 text-lg font-black tabular-nums">{nf(a)} <span className="text-xs font-normal text-muted-foreground">{Math.round((a / total) * 100)}%</span></p></div>
        <div><p className="flex items-center gap-1.5 font-bold"><span className="size-2.5 rounded-full" style={{ backgroundColor: bColor }} />{bLabel}</p><p className="mt-0.5 text-lg font-black tabular-nums">{nf(b)} <span className="text-xs font-normal text-muted-foreground">{Math.round((b / total) * 100)}%</span></p></div>
      </div>
    </div>
  );
}
