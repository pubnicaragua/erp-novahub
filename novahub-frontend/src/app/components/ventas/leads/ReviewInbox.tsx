import { useState } from 'react';
import { Check, ExternalLink, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Skeleton } from '../../ui/skeleton';
import { cn } from '../../ui/utils';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { toast } from '../../../services/toast';
import { SIGNAL_LABEL, SOURCE_LABEL, businessLeadsService, type LeadRow } from '../../../services/business-leads.service';
import { failure } from './leadUtils';

const scoreTone = (score: number | null) => (score === null ? 'bg-muted text-muted-foreground' : score >= 60 ? 'bg-emerald-100 text-emerald-900' : score >= 30 ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-700');

/** Lo que entró de forma automática (extensión, webhook, búsquedas): se revisa con su puntuación y su motivo, y solo lo aprobado pasa al embudo. */
export function ReviewInbox({ canEdit, onOpen }: { canEdit: boolean; onOpen: (id: string) => void }) {
  const client = useQueryClient();
  const inbox = useTenantQuery(['sales', 'business-leads-review'], (signal) => businessLeadsService.listReview(signal), { staleTime: 10_000 });
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const decide = async (lead: LeadRow, decision: 'approve' | 'reject') => {
    setBusy(lead.id);
    try {
      await businessLeadsService.review(lead.id, { decision, reason: decision === 'reject' ? reason.trim() || undefined : undefined });
      toast.success(decision === 'approve' ? 'Lead aprobado: ya está en tu embudo' : 'Lead descartado');
      setRejecting(null); setReason('');
      void client.invalidateQueries({ queryKey: ['tenant-module'] });
    } catch (error) { toast.error(failure(error)); } finally { setBusy(null); }
  };

  if (inbox.isLoading) return <Skeleton className="h-40 w-full rounded-2xl" aria-busy="true" />;
  if (inbox.isError) return <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">No se pudo cargar la bandeja.</p>;
  const items = inbox.data?.items ?? [];
  if (items.length === 0) return <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No hay nada por revisar. Lo que llegue de la extensión de Chrome, un webhook o una búsqueda automática aparecerá aquí antes de entrar a tu embudo.</p>;

  return (
    <div className="space-y-3" aria-label="Leads por revisar">
      <p className="text-xs text-muted-foreground">Revisa cada uno: aprueba lo que sí vale la pena y descarta el resto (el descartado no vuelve a entrar). Los mejor puntuados salen primero.</p>
      <ul className="grid gap-3 lg:grid-cols-2">
        {items.map((lead) => (
          <li key={lead.id} className="min-w-0 space-y-2 rounded-xl border border-border/60 bg-card p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <button type="button" onClick={() => onOpen(lead.id)} className="min-w-0 text-left"><p className="break-words text-sm font-bold">{lead.company}</p><p className="truncate text-[11px] text-muted-foreground">{[lead.industry, lead.country, lead.phone, SOURCE_LABEL[lead.source]].filter(Boolean).join(' · ')}</p></button>
              <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black', scoreTone(lead.fitScore))} title="Qué tan bien encaja con tu cliente ideal">{lead.fitScore ?? '—'}/100</span>
            </div>
            {lead.fitReason && <p className="text-xs text-muted-foreground">{lead.fitReason}</p>}
            {lead.signals.length > 0 && <div className="flex flex-wrap gap-1">{lead.signals.map((signal) => <span key={signal} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">{SIGNAL_LABEL[signal] ?? signal}</span>)}</div>}
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              {lead.sourceUrl && <a className="inline-flex items-center gap-1 font-semibold text-primary underline" href={lead.sourceUrl} target="_blank" rel="noreferrer">Ver de dónde salió <ExternalLink className="size-3" aria-hidden /></a>}
              {lead.website && <span className="truncate text-muted-foreground">{lead.website}</span>}
              {lead.budgetEstimate !== null && <span className="text-muted-foreground">Presupuesto estimado: USD {lead.budgetEstimate}</span>}
            </div>
            {canEdit && (rejecting === lead.id ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input aria-label="Motivo del descarte" className="h-9 min-w-[160px] flex-1" value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (ya es cliente, no aplica…)" />
                <Button type="button" size="sm" variant="outline" onClick={() => { setRejecting(null); setReason(''); }} disabled={busy === lead.id}>Cancelar</Button>
                <Button type="button" size="sm" onClick={() => void decide(lead, 'reject')} disabled={busy === lead.id}>Descartar</Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={() => void decide(lead, 'approve')} disabled={busy === lead.id}><Check className="mr-1 size-4" />Aprobar</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setRejecting(lead.id)} disabled={busy === lead.id}><X className="mr-1 size-4" />Descartar</Button>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
