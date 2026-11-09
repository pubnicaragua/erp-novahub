import { useState } from 'react';
import { ExternalLink, Lightbulb } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { cn } from '../../ui/utils';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { toast } from '../../../services/toast';
import { OUTCOME_LABEL, businessLeadsService, formatMoney, type OfferSuggestion } from '../../../services/business-leads.service';
import { failure } from './leadUtils';

const field = 'h-9 w-full rounded-lg border border-border/60 bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary';
const OUTCOME_TONE = { PROPOSED: 'bg-sky-100 text-sky-900', ACCEPTED: 'bg-emerald-100 text-emerald-900', DECLINED: 'bg-slate-200 text-slate-700' } as const;

/**
 * «Qué ofrecerle»: según el presupuesto del lead, lo que ya rechazó y su perfil, sugiere qué proponer y a qué precio.
 * Bajar del mínimo de una oferta pide aprobación a un administrador.
 */
export function OfferAdvisor({ leadId, canEdit }: { leadId: string; canEdit: boolean }) {
  const client = useQueryClient();
  const advice = useTenantQuery(['sales', 'business-lead-advice', leadId], (signal) => businessLeadsService.advice(leadId, signal), { staleTime: 0 });
  const [picked, setPicked] = useState<string>('');
  const [price, setPrice] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const data = advice.data;

  const options: OfferSuggestion[] = data ? [...(data.primary ? [data.primary] : []), ...data.alternatives, ...data.expansions.filter((item) => !data.alternatives.some((alt) => alt.offerId === item.offerId))] : [];
  const current = options.find((item) => item.offerId === picked) ?? data?.primary ?? null;
  const amount = price === '' ? current?.suggestedPrice ?? 0 : Number(price);
  const belowMinimum = Boolean(current && Number.isFinite(amount) && amount < current.approvalBelow);

  const refresh = () => { void client.invalidateQueries({ queryKey: ['tenant-module'] }); };
  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try { await action(); toast.success(success); setPrice(''); setReason(''); refresh(); } catch (error) { toast.error(failure(error)); } finally { setBusy(false); }
  };
  const record = (outcome: 'PROPOSED' | 'ACCEPTED' | 'DECLINED') => current && run(() => businessLeadsService.recordOffer(leadId, { offerId: current.offerId, price: amount, outcome, reason: reason.trim() || undefined }), outcome === 'DECLINED' ? 'Anotado: dijo que no' : 'Registrado');
  const askApproval = () => current && run(() => businessLeadsService.requestDiscount(leadId, { offerId: current.offerId, price: amount, reason: reason.trim() }), 'Solicitud enviada a un administrador');

  return (
    <section className="space-y-3 border-t border-border pt-4" aria-label="Qué ofrecerle">
      <h3 className="flex items-center gap-1.5 nh-section-title"><Lightbulb className="size-4 text-primary" aria-hidden /> Qué ofrecerle</h3>
      {advice.isLoading ? <p className="text-xs text-muted-foreground" aria-busy="true">Calculando sugerencias…</p>
        : !data ? <p className="text-xs text-destructive" role="alert">No se pudieron calcular las sugerencias.</p>
        : (
          <>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <span className="rounded-full bg-muted px-2.5 py-1 font-semibold">Presupuesto: {formatMoney(data.budget.amount, 'USD')} · {data.budget.source === 'MANUAL' ? 'puesto por una persona' : 'estimado por señales'}</span>
              {data.fit.score !== null && <span className="rounded-full bg-muted px-2.5 py-1 font-semibold">Encaje: {data.fit.score}/100</span>}
            </div>
            {data.fit.reason && <p className="text-[11px] text-muted-foreground">{data.fit.reason}</p>}
            <p className={cn('rounded-xl border p-3 text-sm', data.downshift ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-border/60 bg-muted/20')}>{data.message}</p>

            {options.length > 0 && (
              <div className="grid gap-2 rounded-xl border border-border/60 p-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-semibold sm:col-span-2">Oferta
                  <select className={field} value={current?.offerId ?? ''} onChange={(e) => { setPicked(e.target.value); setPrice(''); }}>
                    {options.map((item) => <option key={item.offerId} value={item.offerId}>{item.name} · {formatMoney(item.suggestedPrice, item.currency)}</option>)}
                  </select>
                </label>
                {current && (
                  <p className="text-[11px] text-muted-foreground sm:col-span-2">
                    Se puede negociar hasta {formatMoney(current.approvalBelow, current.currency)} sin pedir permiso{current.negotiationRoom > 0 ? ` (hay ${formatMoney(current.negotiationRoom, current.currency)} de margen)` : ''}.
                    {current.reasons.length > 0 && ` Encaja porque: ${current.reasons.join(', ')}.`}
                    {current.materialUrl && <> <a className="inline-flex items-center gap-0.5 font-semibold text-primary underline" href={current.materialUrl} target="_blank" rel="noreferrer">Material para enviar <ExternalLink className="size-3" aria-hidden /></a></>}
                  </p>
                )}
                {canEdit && current && (
                  <>
                    <label className="space-y-1 text-xs font-semibold">Precio
                      <Input type="number" min="0" step="0.01" value={price} placeholder={String(current.suggestedPrice)} onChange={(e) => setPrice(e.target.value)} />
                    </label>
                    <label className="space-y-1 text-xs font-semibold">Nota {belowMinimum ? '(obligatoria para pedir permiso)' : '(opcional)'}
                      <Input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder={belowMinimum ? 'Por qué hace falta bajar el precio' : 'Ej.: lo quiere para el mes que viene'} />
                    </label>
                    {belowMinimum && <p className="text-[11px] font-semibold text-amber-800 sm:col-span-2">Ese precio está por debajo del mínimo. Hace falta que un administrador lo apruebe antes de proponerlo.</p>}
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      {belowMinimum
                        ? <Button type="button" size="sm" onClick={() => void askApproval()} disabled={busy || !reason.trim()}>Pedir aprobación</Button>
                        : <Button type="button" size="sm" onClick={() => void record('PROPOSED')} disabled={busy}>Se lo propuse</Button>}
                      {!belowMinimum && <Button type="button" size="sm" variant="outline" onClick={() => void record('ACCEPTED')} disabled={busy}>Aceptó</Button>}
                      <Button type="button" size="sm" variant="outline" onClick={() => void record('DECLINED')} disabled={busy}>Dijo que no</Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {data.expansions.length > 0 && <p className="text-[11px] text-muted-foreground"><b>También le podría servir:</b> {data.expansions.map((item) => `${item.name} (desde ${formatMoney(item.approvalBelow, item.currency)})`).join(' · ')}</p>}
            {data.excludedByBudget.length > 0 && <p className="text-[11px] text-muted-foreground">Por ahora no se sugiere, porque pasa de su presupuesto: {data.excludedByBudget.join(', ')}.</p>}
            {data.history.length > 0 && (
              <ol className="space-y-1.5" aria-label="Historial de ofertas">
                {data.history.map((item) => <li key={item.id} className="flex flex-wrap items-center gap-2 text-xs"><span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black uppercase', OUTCOME_TONE[item.outcome])}>{OUTCOME_LABEL[item.outcome]}</span><b>{item.offerName}</b> · {formatMoney(item.price, item.currency)}{item.reason ? ` · ${item.reason}` : ''}</li>)}
              </ol>
            )}
          </>
        )}
    </section>
  );
}
