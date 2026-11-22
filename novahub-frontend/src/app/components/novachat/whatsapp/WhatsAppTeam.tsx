import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { whatsappService } from '../../../services/whatsapp.service';
import { FALLBACK_LINE_COLOR, formatDuration } from './whatsappUi';

const RANGES = [{ id: 1, label: 'Hoy' }, { id: 7, label: '7 días' }, { id: 30, label: '30 días' }] as const;

function Kpi({ label, value, tone = '' }: { label: string; value: string | number; tone?: string }) {
  return <div className="rounded-2xl border border-border/50 bg-card p-4"><p className="text-[11px] font-bold text-muted-foreground">{label}</p><p className={`mt-1 text-2xl font-black ${tone}`}>{value}</p></div>;
}

/** Supervisión comercial: todo sale de mensajes y estados reales guardados, no de valores de ejemplo. */
export function WhatsAppTeam() {
  const [days, setDays] = useState<number>(7);
  const range = useMemo(() => {
    const to = new Date();
    const from = days === 1 ? new Date(to.getFullYear(), to.getMonth(), to.getDate()) : new Date(to.getTime() - days * 86_400_000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [days]);
  const stats = useTenantQuery(['wa', 'stats', days], (signal) => whatsappService.stats(range, signal), { staleTime: 30_000 });
  const data = stats.data;
  const totals = useMemo(() => {
    if (!data) return null;
    const answered = data.lines.filter((l) => l.avgFirstResponseSec != null);
    const avg = answered.length ? answered.reduce((s, l) => s + (l.avgFirstResponseSec as number), 0) / answered.length : null;
    return {
      unanswered: data.lines.reduce((s, l) => s + l.unanswered, 0),
      unassigned: data.lines.reduce((s, l) => s + l.unassigned, 0),
      conversations: data.lines.reduce((s, l) => s + l.newConversations, 0),
      messages: data.lines.reduce((s, l) => s + l.messagesIn + l.messagesOut, 0),
      avg,
    };
  }, [data]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-base font-black">Supervisión comercial</p><p className="text-xs text-muted-foreground">Cómo está atendiendo tu equipo por WhatsApp.</p></div>
          <div className="flex gap-1.5">
            {RANGES.map((r) => (
              <button key={r.id} type="button" onClick={() => setDays(r.id)} className={`rounded-full border px-3.5 py-1.5 text-xs font-bold ${days === r.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 text-muted-foreground hover:bg-muted/50'}`}>{r.label}</button>
            ))}
          </div>
        </div>
        {stats.isLoading && <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-primary" /></div>}
        {stats.isError && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">No se pudo cargar la supervisión. Solo los administradores de la empresa pueden verla.</p>}
        {data && totals && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi label="Sin responder ahora" value={totals.unanswered} tone={totals.unanswered ? 'text-rose-600' : ''} />
              <Kpi label="Sin asignar" value={totals.unassigned} tone={totals.unassigned ? 'text-amber-600' : ''} />
              <Kpi label="Conversaciones nuevas" value={totals.conversations} />
              <Kpi label="Primera respuesta (promedio)" value={formatDuration(totals.avg)} />
            </div>

            <section>
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">Por número</p>
              <div className="overflow-x-auto rounded-2xl border border-border/50 bg-card">
                <table className="w-full min-w-[640px] text-xs">
                  <thead><tr className="border-b border-border/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground"><th className="px-4 py-3">Número</th><th className="px-3 py-3 text-right">Nuevas</th><th className="px-3 py-3 text-right">Mensajes recibidos</th><th className="px-3 py-3 text-right">Mensajes enviados</th><th className="px-3 py-3 text-right">Sin responder</th><th className="px-3 py-3 text-right">Sin asignar</th><th className="px-4 py-3 text-right">1.ª respuesta</th></tr></thead>
                  <tbody>
                    {data.lines.map((l) => (
                      <tr key={l.lineId} className="border-b border-border/20 last:border-0">
                        <td className="px-4 py-3"><span className="inline-flex items-center gap-2 font-bold"><span className="size-2.5 rounded-full" style={{ backgroundColor: l.color || FALLBACK_LINE_COLOR }} />{l.name}</span></td>
                        <td className="px-3 py-3 text-right tabular-nums">{l.newConversations}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{l.messagesIn}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{l.messagesOut}</td>
                        <td className={`px-3 py-3 text-right font-bold tabular-nums ${l.unanswered ? 'text-rose-600' : ''}`}>{l.unanswered}</td>
                        <td className={`px-3 py-3 text-right font-bold tabular-nums ${l.unassigned ? 'text-amber-600' : ''}`}>{l.unassigned}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatDuration(l.avgFirstResponseSec)}</td>
                      </tr>
                    ))}
                    {data.lines.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Aún no hay números conectados.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">Por vendedor</p>
              <div className="overflow-x-auto rounded-2xl border border-border/50 bg-card">
                <table className="w-full min-w-[480px] text-xs">
                  <thead><tr className="border-b border-border/40 text-left text-[10px] uppercase tracking-wider text-muted-foreground"><th className="px-4 py-3">Vendedor</th><th className="px-3 py-3 text-right">Conversaciones</th><th className="px-3 py-3 text-right">Sin responder</th><th className="px-4 py-3 text-right">1.ª respuesta</th></tr></thead>
                  <tbody>
                    {data.agents.map((a) => (
                      <tr key={a.userId} className="border-b border-border/20 last:border-0">
                        <td className="px-4 py-3 font-bold">{a.name}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{a.conversations}</td>
                        <td className={`px-3 py-3 text-right font-bold tabular-nums ${a.unanswered ? 'text-rose-600' : ''}`}>{a.unanswered}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatDuration(a.avgFirstResponseSec)}</td>
                      </tr>
                    ))}
                    {data.agents.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Todavía no hay conversaciones asignadas en este período.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
            <p className="text-[11px] text-muted-foreground">Los tiempos de respuesta cuentan desde el primer mensaje del cliente hasta la primera respuesta, ya sea enviada desde NovaHub o desde el teléfono del vendedor.</p>
          </>
        )}
      </div>
    </div>
  );
}
