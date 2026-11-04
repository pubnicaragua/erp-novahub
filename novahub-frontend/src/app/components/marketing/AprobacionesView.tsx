import { useState } from 'react';
import { MARKETING_GUIDES } from './guides';
import { Check, Loader2, MessageSquareWarning, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { marketingApi, type MktApproval } from '../../services/marketing.service';
import { toast } from '../../services/toast';
import { EmptyState, ErrorState, PageTitle } from '../organizacion/OrgBits';
import { errorMessage } from '../organizacion/organizacion.utils';
import { APPROVAL_STATUS_LABEL, APPROVAL_SUBJECT_LABEL, fmtDate, money } from './marketing.constants';
import { StatusBadge } from './MktBits';
import { useMktConfig, useMktRefresh } from './mkt.helpers';

type Decision = 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';

export function AprobacionesView() {
  const { user, canPerform } = useAuth();
  const refresh = useMktRefresh();
  const config = useMktConfig();
  const [tab, setTab] = useState<'PENDING' | 'RESOLVED'>('PENDING');
  const [open, setOpen] = useState<{ id: string; decision: Decision } | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const canApprove = canPerform('MARKETING_APPROVALS', 'approve');
  const q = useTenantQuery(['marketing', 'approvals', tab], (s) => marketingApi.approvals({ status: tab, pageSize: 50 }, s), { staleTime: 10_000 });

  const decide = async (a: MktApproval, decision: Decision, text?: string) => {
    setBusy(true);
    try {
      await marketingApi.decide(a.id, decision, text);
      toast.success(decision === 'APPROVED' ? 'Aprobado' : decision === 'REJECTED' ? 'Rechazado' : 'Cambios solicitados');
      setOpen(null); setComment(''); refresh();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };

  const rows = q.data?.data ?? [];
  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <PageTitle guide={MARKETING_GUIDES.aprobaciones} eyebrow="Marketing" title="Aprobaciones" subtitle="Bandeja de solicitudes de piezas, presupuestos y estrategias, con el historial de decisiones." />
      <div role="tablist" aria-label="Estado de las solicitudes" className="flex gap-2">
        {([['PENDING', 'Pendientes'], ['RESOLVED', 'Historial de decisiones']] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={cn('rounded-lg border px-4 py-2 text-[13px] font-semibold', tab === id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted/50')}>{label}</button>
        ))}
      </div>

      {q.isLoading ? <div className="space-y-2" aria-busy="true"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
        : q.isError ? <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} />
          : rows.length === 0 ? <EmptyState title={tab === 'PENDING' ? 'Todo al día' : 'Sin decisiones registradas'} description={tab === 'PENDING' ? 'No hay solicitudes pendientes de revisión.' : 'Las decisiones aparecerán aquí.'} />
            : (
              <ul className="space-y-3">
                {rows.map((a) => {
                  const own = a.requestedBy?.id === user?.id && !config.data?.allowSelfApproval;
                  const active = open?.id === a.id;
                  return (
                    <li key={a.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold">{APPROVAL_SUBJECT_LABEL[a.subjectType]}{a.version ? ` · v${a.version}` : ''}</span><StatusBadge status={a.status} label={APPROVAL_STATUS_LABEL[a.status]} /></div>
                          <p className="mt-1 text-[14px] font-semibold">{a.title}</p>
                          <p className="text-[12px] text-muted-foreground">Solicitó {a.requestedBy?.name ?? '—'} · {fmtDate(a.createdAt, true)}{a.amount ? ` · ${money(a.amount, config.data?.currency)}` : ''}</p>
                          {a.decidedAt && <p className="text-[12px] text-muted-foreground">Decidió {a.decidedBy?.name ?? '—'} · {fmtDate(a.decidedAt, true)}{a.comment ? ` — “${a.comment}”` : ''}</p>}
                        </div>
                        {a.status === 'PENDING' && canApprove && (
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" size="sm" disabled={busy || own} title={own ? 'No puedes resolver tu propia solicitud' : undefined} onClick={() => void decide(a, 'APPROVED')}><Check className="size-4" aria-hidden="true" />Aprobar</Button>
                            <Button type="button" size="sm" variant="outline" disabled={busy || own} onClick={() => { setOpen({ id: a.id, decision: 'CHANGES_REQUESTED' }); setComment(''); }}><MessageSquareWarning className="size-4" aria-hidden="true" />Solicitar cambios</Button>
                            <Button type="button" size="sm" variant="outline" className="text-destructive" disabled={busy || own} onClick={() => { setOpen({ id: a.id, decision: 'REJECTED' }); setComment(''); }}><X className="size-4" aria-hidden="true" />Rechazar</Button>
                          </div>
                        )}
                      </div>
                      {active && open && (
                        <div className="mt-3 space-y-2 border-t border-border pt-3">
                          <label htmlFor={`cm-${a.id}`} className="text-[12px] font-semibold">Comentario {open.decision === 'REJECTED' ? 'del rechazo' : 'con los cambios requeridos'} *</label>
                          <Textarea id={`cm-${a.id}`} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
                          <div className="flex gap-2">
                            <Button type="button" size="sm" disabled={busy || !comment.trim()} onClick={() => void decide(a, open.decision, comment.trim())}>{busy && <Loader2 className="size-4 animate-spin" />}Confirmar</Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(null)}>Cancelar</Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
      {tab === 'PENDING' && !canApprove && <p className="text-[12px] text-muted-foreground">Tu rol puede consultar la bandeja, pero no resolver solicitudes.</p>}
    </div>
  );
}
