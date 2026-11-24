import { useMemo, useState, type ReactNode } from 'react';
import { Clock, Download, FileSpreadsheet, Loader2, MessageSquareReply, TrendingUp } from 'lucide-react';
import { toast } from '@/app/services/toast';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { downloadWhatsAppReport, whatsappService, type WaOverview, type WaReport, type WaReportQuery, type WaReportSection } from '../../../services/whatsapp.service';
import { LineMultiSelect } from './LineMultiSelect';
import { FALLBACK_LINE_COLOR, formatDuration } from './whatsappUi';

type Preset = 'today' | '7' | '30' | '90' | 'custom';
const PRESETS: Array<{ id: Preset; label: string }> = [{ id: 'today', label: 'Hoy' }, { id: '7', label: '7 días' }, { id: '30', label: '30 días' }, { id: '90', label: '90 días' }, { id: 'custom', label: 'Rango' }];
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const TYPE_LABEL: Record<string, string> = { text: 'Texto', image: 'Fotos', audio: 'Audios', video: 'Videos', document: 'Documentos', sticker: 'Stickers', location: 'Ubicaciones', contacts: 'Contactos', button: 'Respuestas rápidas', unknown: 'Otros' };
const EXPORTS: Array<{ id: WaReportSection; label: string; hint: string }> = [
  { id: 'daily', label: 'Mensajes por día', hint: 'Recibidos y enviados' },
  { id: 'lines', label: 'Por número', hint: 'Conversaciones y tiempos' },
  { id: 'agents', label: 'Por vendedor', hint: 'Mensajes, resueltas y tiempos' },
  { id: 'hourly', label: 'Horas pico', hint: 'Día y hora de más mensajes' },
  { id: 'conversations', label: 'Detalle de conversaciones', hint: 'Una fila por conversación' },
];

const dayInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const nf = (n: number) => n.toLocaleString('es-NI');

function Kpi({ label, value, hint, tone = '' }: { label: string; value: string | number; hint?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4">
      <p className="text-[11px] font-bold text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Card({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border/50 bg-card p-4 ${className}`}>
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{title}</p>
      {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Bar({ label, value, max, suffix = '', color = 'bg-emerald-500' }: { label: string; value: number; max: number; suffix?: string; color?: string }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-36 shrink-0 truncate font-bold">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${color}`} style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} /></div>
      <span className="w-16 shrink-0 text-right font-black tabular-nums">{nf(value)}{suffix}</span>
    </div>
  );
}

function DailyChart({ data }: { data: WaReport['daily'] }) {
  const max = Math.max(1, ...data.map((d) => d.in + d.out));
  if (!data.length) return <p className="py-8 text-center text-xs text-muted-foreground">Sin mensajes en este período.</p>;
  return (
    <div>
      <div className="flex h-44 items-end gap-[3px]" role="img" aria-label="Mensajes por día">
        {data.map((d) => (
          <div key={d.day} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.day}: ${d.in} recibidos, ${d.out} enviados`}>
            <div className="w-full rounded-t-sm bg-sky-500/80 transition-opacity group-hover:opacity-80" style={{ height: `${(d.out / max) * 100}%` }} />
            <div className={`w-full bg-emerald-500 transition-opacity group-hover:opacity-80 ${d.out ? '' : 'rounded-t-sm'}`} style={{ height: `${(d.in / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground"><span>{data[0].day.slice(5)}</span><span>{data[data.length - 1].day.slice(5)}</span></div>
      <div className="mt-2 flex gap-4 text-[11px] font-bold"><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-500" />Recibidos</span><span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-sky-500/80" />Enviados</span></div>
    </div>
  );
}

function Heatmap({ data }: { data: WaReport['hourly'] }) {
  const grid = useMemo(() => {
    const m = new Map(data.map((h) => [`${h.dow}-${h.hour}`, h.count]));
    return { get: (d: number, h: number) => m.get(`${d}-${h}`) || 0, max: Math.max(1, ...data.map((h) => h.count)) };
  }, [data]);
  const order = [1, 2, 3, 4, 5, 6, 0];
  if (!data.length) return <p className="py-8 text-center text-xs text-muted-foreground">Sin mensajes recibidos en este período.</p>;
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="ml-10 grid grid-cols-24 gap-[2px] text-[9px] text-muted-foreground" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>{Array.from({ length: 24 }, (_, h) => <span key={h} className="text-center">{h % 3 === 0 ? h : ''}</span>)}</div>
        {order.map((d) => (
          <div key={d} className="mt-[2px] flex items-center gap-1">
            <span className="w-9 shrink-0 text-[10px] font-bold text-muted-foreground">{DAYS[d]}</span>
            <div className="grid flex-1 gap-[2px]" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
              {Array.from({ length: 24 }, (_, h) => {
                const n = grid.get(d, h);
                return <div key={h} className="aspect-square rounded-[3px] bg-emerald-500" style={{ opacity: n ? 0.12 + (n / grid.max) * 0.88 : 0.05 }} title={`${DAYS_LONG[d]} ${h}:00 · ${n} mensajes recibidos`} />;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Frases listas para un dueño de negocio, calculadas con los datos del período. */
function insights(r: WaReport): string[] {
  const out: string[] = [];
  const byHour = new Map<number, number>();
  const byDow = new Map<number, number>();
  r.hourly.forEach((h) => { byHour.set(h.hour, (byHour.get(h.hour) || 0) + h.count); byDow.set(h.dow, (byDow.get(h.dow) || 0) + h.count); });
  const peakHour = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0];
  const peakDow = [...byDow.entries()].sort((a, b) => b[1] - a[1])[0];
  if (peakHour && peakDow) out.push(`Tus clientes escriben más los ${DAYS_LONG[peakDow[0]]} y alrededor de las ${peakHour[0]}:00. Procura tener gente disponible a esa hora.`);
  const fr = r.kpis.firstResponse;
  if (fr.sample && fr.within5Pct != null) out.push(`${fr.within5Pct}% de las conversaciones nuevas recibió respuesta en menos de 5 minutos${fr.within60Pct != null ? ` y ${fr.within60Pct}% en menos de una hora` : ''}.`);
  if (fr.sample && fr.answeredPct != null && fr.answeredPct < 100) out.push(`${(100 - fr.answeredPct).toFixed(1)}% de las conversaciones nuevas todavía no tiene respuesta.`);
  if (r.kpis.unansweredNow > 0) out.push(`Hay ${r.kpis.unansweredNow} ${r.kpis.unansweredNow === 1 ? 'conversación esperando' : 'conversaciones esperando'} respuesta ahora mismo.`);
  const rated = r.agents.filter((a) => a.avgFirstResponseSec != null && a.conversations >= 3).sort((a, b) => (a.avgFirstResponseSec as number) - (b.avgFirstResponseSec as number));
  if (rated.length >= 2) out.push(`${rated[0].name} es quien responde más rápido (${formatDuration(rated[0].avgFirstResponseSec)}); ${rated[rated.length - 1].name} tarda más (${formatDuration(rated[rated.length - 1].avgFirstResponseSec)}).`);
  if (r.kpis.unassignedNow > 0) out.push(`${r.kpis.unassignedNow} ${r.kpis.unassignedNow === 1 ? 'conversación está' : 'conversaciones están'} sin responsable.`);
  return out;
}

export function WhatsAppReports({ overview }: { overview: WaOverview }) {
  const [preset, setPreset] = useState<Preset>('7');
  const [customFrom, setCustomFrom] = useState(() => dayInput(new Date(Date.now() - 7 * 86_400_000)));
  const [customTo, setCustomTo] = useState(() => dayInput(new Date()));
  const [lineIds, setLineIds] = useState<string[]>([]);
  const [agentId, setAgentId] = useState('');
  const [exporting, setExporting] = useState<WaReportSection | null>(null);

  const validLines = lineIds.filter((id) => overview.lines.some((l) => l.id === id));
  const agents = useMemo(() => {
    const seen = new Map<string, string>();
    overview.lines.forEach((l) => l.members.forEach((m) => seen.set(m.userId, m.name)));
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [overview.lines]);

  const query = useMemo<WaReportQuery>(() => {
    const now = new Date();
    let from: Date;
    let to = now;
    if (preset === 'custom') {
      from = new Date(`${customFrom}T00:00:00`);
      to = new Date(`${customTo}T23:59:59`);
    } else if (preset === 'today') from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else from = new Date(now.getTime() - Number(preset) * 86_400_000);
    return { from: from.toISOString(), to: to.toISOString(), lineIds: validLines, agentIds: agentId ? [agentId] : [] };
  }, [preset, customFrom, customTo, validLines, agentId]);
  const rangeKey = preset === 'custom' ? `${customFrom}_${customTo}` : preset;
  const invalidRange = preset === 'custom' && (!customFrom || !customTo || customFrom > customTo);

  const report = useTenantQuery<WaReport>(['wa', 'report', rangeKey, [...validLines].sort().join(','), agentId], (signal) => whatsappService.reportSummary(query, signal), { staleTime: 60_000, enabled: !invalidRange });
  const data = report.data;
  const tips = useMemo(() => (data ? insights(data) : []), [data]);

  const exportCsv = async (section: WaReportSection) => {
    setExporting(section);
    try { await downloadWhatsAppReport(section, query); } catch (error) { toast.error((error as Error)?.message || 'No se pudo descargar el reporte.'); } finally { setExporting(null); }
  };

  const typeMax = Math.max(1, ...(data?.types.map((t) => t.count) || [1]));
  const agingMax = Math.max(1, ...(data?.backlogAging.map((t) => t.count) || [1]));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-base font-black">Reportes de WhatsApp</p><p className="text-xs text-muted-foreground">Mide cómo atiende tu equipo y qué piden tus clientes. Todo sale de mensajes reales.</p></div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => <button key={p.id} type="button" onClick={() => setPreset(p.id)} className={`rounded-full border px-3.5 py-1.5 text-xs font-bold ${preset === p.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 text-muted-foreground hover:bg-muted/50'}`}>{p.label}</button>)}
          </div>
        </div>

        <div className="grid gap-2.5 rounded-2xl border border-border/50 bg-card p-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
          <LineMultiSelect lines={overview.lines.map((l) => ({ id: l.id, name: l.name, color: l.color }))} value={validLines} onChange={setLineIds} allLabel="Todos los números" />
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)} aria-label="Vendedor" className="h-10 rounded-xl border border-border/60 bg-background px-3 text-xs font-bold outline-none focus:border-primary">
            <option value="">Todos los vendedores</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          {preset === 'custom' ? (
            <div className="flex items-center gap-2 text-xs">
              <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} aria-label="Desde" className="h-10 w-full rounded-xl border border-border/60 bg-background px-2 outline-none focus:border-primary" />
              <span className="text-muted-foreground">a</span>
              <input type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} aria-label="Hasta" className="h-10 w-full rounded-xl border border-border/60 bg-background px-2 outline-none focus:border-primary" />
            </div>
          ) : <div className="hidden lg:block" />}
          <div className="group relative">
            <button type="button" className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700"><Download className="size-4" />Descargar</button>
            <div className="invisible absolute right-0 top-full z-30 w-64 pt-1 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <div className="rounded-xl border border-border/60 bg-popover p-1.5 shadow-lg">
                {EXPORTS.map((e) => (
                  <button key={e.id} type="button" onClick={() => void exportCsv(e.id)} disabled={exporting !== null || !data} className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-muted disabled:opacity-60">
                    {exporting === e.id ? <Loader2 className="mt-0.5 size-4 animate-spin" /> : <FileSpreadsheet className="mt-0.5 size-4 text-emerald-600" />}
                    <span><span className="block text-xs font-black">{e.label}</span><span className="block text-[10px] text-muted-foreground">{e.hint}</span></span>
                  </button>
                ))}
                <p className="px-2.5 pb-1 pt-1.5 text-[10px] text-muted-foreground">Se abren en Excel. Usan los filtros de arriba.</p>
              </div>
            </div>
          </div>
        </div>

        {invalidRange && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Revisa las fechas: «Desde» debe ser anterior o igual a «Hasta».</p>}
        {report.isLoading && <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-primary" /></div>}
        {report.isError && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">No se pudo cargar el reporte. Solo los administradores de la empresa pueden verlo.</p>}

        {data && (
          <>
            {tips.length > 0 && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-300"><TrendingUp className="size-4" />Lo que dicen tus datos</p>
                <ul className="mt-2 space-y-1.5 text-sm">{tips.map((t) => <li key={t} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-500" />{t}</li>)}</ul>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Mensajes recibidos" value={nf(data.kpis.messagesIn)} />
              <Kpi label="Mensajes enviados" value={nf(data.kpis.messagesOut)} />
              <Kpi label="Conversaciones con actividad" value={nf(data.kpis.conversationsActive)} hint={`${nf(data.kpis.conversationsNew)} nuevas · ${nf(data.kpis.groupConversations)} grupos`} />
              <Kpi label="Resueltas" value={nf(data.kpis.resolved)} />
              <Kpi label="Primera respuesta (promedio)" value={formatDuration(data.kpis.firstResponse.avgSec)} hint={data.kpis.firstResponse.sample ? `${nf(data.kpis.firstResponse.sample)} conversaciones nuevas` : 'Sin conversaciones nuevas'} />
              <Kpi label="Primera respuesta (mediana)" value={formatDuration(data.kpis.firstResponse.medianSec)} hint="La mitad respondió más rápido que esto" />
              <Kpi label="Sin responder ahora" value={nf(data.kpis.unansweredNow)} tone={data.kpis.unansweredNow ? 'text-rose-600' : ''} hint={`${nf(data.kpis.unassignedNow)} sin responsable · ${nf(data.kpis.openNow)} abiertas`} />
              <Kpi label="Mensajes por conversación" value={data.kpis.messagesPerConversation ?? '—'} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card title="Mensajes por día" className="lg:col-span-2"><DailyChart data={data.daily} /></Card>
              <Card title="Qué tan rápido responden" subtitle="Conversaciones nuevas con respuesta dentro de…">
                <div className="space-y-3">
                  <Bar label="5 minutos" value={data.kpis.firstResponse.within5Pct ?? 0} max={100} suffix="%" />
                  <Bar label="15 minutos" value={data.kpis.firstResponse.within15Pct ?? 0} max={100} suffix="%" color="bg-sky-500" />
                  <Bar label="1 hora" value={data.kpis.firstResponse.within60Pct ?? 0} max={100} suffix="%" color="bg-violet-500" />
                  <Bar label="Con alguna respuesta" value={data.kpis.firstResponse.answeredPct ?? 0} max={100} suffix="%" color="bg-amber-500" />
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Clock className="size-3.5" />El 90% respondió en {formatDuration(data.kpis.firstResponse.p90Sec)} o menos.</p>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card title="Horas en que más escriben" subtitle={`Mensajes recibidos por día y hora (${data.tz})`} className="lg:col-span-2"><Heatmap data={data.hourly} /></Card>
              <Card title="Esperando respuesta" subtitle="Cuánto llevan esperando las conversaciones abiertas">
                {data.backlogAging.length ? <div className="space-y-3">{data.backlogAging.map((b) => <Bar key={b.bucket} label={b.bucket} value={b.count} max={agingMax} color="bg-rose-500" />)}</div> : <p className="py-6 text-center text-xs text-muted-foreground">No hay nadie esperando. ¡Buen trabajo!</p>}
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Por número">
                <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-xs">
                  <thead><tr className="border-b border-border/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground"><th className="py-2 pr-3">Número</th><th className="px-2 text-right">Conv. nuevas</th><th className="px-2 text-right">Sin responder</th><th className="pl-2 text-right">1.ª respuesta</th></tr></thead>
                  <tbody>{data.lines.map((l) => (
                    <tr key={l.lineId} className="border-b border-border/20 last:border-0">
                      <td className="py-2.5 pr-3"><span className="inline-flex items-center gap-2 font-bold"><span className="size-2.5 rounded-full" style={{ backgroundColor: l.color || FALLBACK_LINE_COLOR }} />{l.name}</span></td>
                      <td className="px-2 text-right tabular-nums">{nf(l.conversations)}</td>
                      <td className={`px-2 text-right font-bold tabular-nums ${l.unanswered ? 'text-rose-600' : ''}`}>{nf(l.unanswered)}</td>
                      <td className="pl-2 text-right tabular-nums">{formatDuration(l.avgFirstResponseSec)}</td>
                    </tr>))}
                    {data.lines.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Sin números para este filtro.</td></tr>}
                  </tbody></table></div>
              </Card>
              <Card title="Por vendedor">
                <div className="overflow-x-auto"><table className="w-full min-w-[460px] text-xs">
                  <thead><tr className="border-b border-border/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground"><th className="py-2 pr-3">Vendedor</th><th className="px-2 text-right">Mensajes enviados</th><th className="px-2 text-right">Resueltas</th><th className="px-2 text-right">Sin responder</th><th className="pl-2 text-right">1.ª respuesta</th></tr></thead>
                  <tbody>{data.agents.map((a) => (
                    <tr key={a.userId} className="border-b border-border/20 last:border-0">
                      <td className="py-2.5 pr-3 font-bold">{a.name}</td>
                      <td className="px-2 text-right tabular-nums">{nf(a.messagesSent)}</td>
                      <td className="px-2 text-right tabular-nums">{nf(a.resolved)}</td>
                      <td className={`px-2 text-right font-bold tabular-nums ${a.unanswered ? 'text-rose-600' : ''}`}>{nf(a.unanswered)}</td>
                      <td className="pl-2 text-right tabular-nums">{formatDuration(a.avgFirstResponseSec)}</td>
                    </tr>))}
                    {data.agents.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Todavía no hay actividad de vendedores en este período.</td></tr>}
                  </tbody></table></div>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Clientes que más escriben" subtitle="Contactos y grupos con más mensajes en el período">
                <div className="space-y-2.5">{data.topContacts.map((c) => <Bar key={c.id} label={c.isGroup ? `👥 ${c.name}` : c.name} value={c.messages} max={data.topContacts[0]?.messages || 1} color="bg-emerald-500" />)}
                  {data.topContacts.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Sin mensajes en este período.</p>}</div>
              </Card>
              <Card title="Qué envían" subtitle="Tipos de mensaje del período">
                <div className="space-y-2.5">{data.types.map((t) => <Bar key={t.type} label={TYPE_LABEL[t.type] || t.type} value={t.count} max={typeMax} color="bg-violet-500" />)}
                  {data.types.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Sin mensajes en este período.</p>}</div>
              </Card>
            </div>

            <p className="flex items-start gap-2 text-[11px] text-muted-foreground"><MessageSquareReply className="mt-0.5 size-3.5 shrink-0" />Los tiempos de respuesta cuentan desde el primer mensaje del cliente hasta la primera respuesta, enviada desde NovaHub o desde el teléfono. Las conversaciones importadas del historial no entran en los tiempos.</p>
          </>
        )}
      </div>
    </div>
  );
}
