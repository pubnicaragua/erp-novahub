import { useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Star } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { organizacionService, type TeamMember, type TeamTask } from '../../services/organizacion.service';
import { EmptyState, ErrorState, NativeSelect } from './OrgBits';
import { PunctualityBadge, RatingStars, TaskRatingPanel } from './TaskRating';
import { RATING_LABEL, errorMessage, formatMinutes } from './organizacion.utils';

const PAGE_SIZE = 20;
const STATUS_LABEL: Record<string, string> = { PENDING: 'Pendiente', IN_PROGRESS: 'En progreso', WAITING_APPROVAL: 'En aprobación', COMPLETED: 'Completada', CANCELLED: 'Cancelada' };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const duration = (minutes: number) => (minutes <= 0 ? '—' : formatMinutes(minutes));

/** Historial filtrable de tareas de las personas supervisadas, con minutos registrados por tarea. */
export function EquipoHistorial({ members, initialUser }: { members: TeamMember[]; initialUser: string }) {
  const client = useQueryClient();
  const { canPerform, user } = useAuth();
  const canApprove = canPerform('ACTIVITIES_TASKS', 'approve');
  const [rating, setRating] = useState<TeamTask | null>(null);
  const [userId, setUserId] = useState(initialUser);
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const params = { userId: userId || undefined, status, from: from ? `${from}T00:00:00` : undefined, to: to ? `${to}T23:59:59` : undefined, q: q.trim() || undefined, page, pageSize: PAGE_SIZE };
  const query = useTenantQuery(['organizacion', 'team-tasks', JSON.stringify(params)], (signal) => organizacionService.getTeamTasks(params, signal), { staleTime: 20_000, placeholderData: (prev) => prev });
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };
  const total = query.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Quien hizo la tarea no puede calificarla: se oculta el botón (el servidor lo vuelve a comprobar).
  const canRateTask = (t: TeamTask) => canApprove && t.status === 'COMPLETED' && !t.assignees.some((a) => a.id === user?.id);
  const refreshAll = () => { void client.invalidateQueries({ queryKey: ['tenant-module'] }); };

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-end gap-2 text-[12px]">
        <NativeSelect aria-label="Persona" className="h-10 w-auto min-w-[180px]" value={userId} onChange={(e) => reset(setUserId)(e.target.value)}>
          <option value="">Todo el equipo</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Estado" className="h-10 w-auto min-w-[150px]" value={status} onChange={(e) => reset(setStatus)(e.target.value)}>
          <option value="all">Todas</option><option value="open">Pendientes</option><option value="overdue">Vencidas</option><option value="done">Completadas</option>
        </NativeSelect>
        <label className="font-semibold">Desde<input type="date" value={from} max={to || undefined} onChange={(e) => reset(setFrom)(e.target.value)} className="ml-2 h-10 rounded-lg border border-border bg-background px-2" /></label>
        <label className="font-semibold">Hasta<input type="date" value={to} min={from || undefined} onChange={(e) => reset(setTo)(e.target.value)} className="ml-2 h-10 rounded-lg border border-border bg-background px-2" /></label>
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={q} onChange={(e) => reset(setQ)(e.target.value)} placeholder="Buscar tarea…" aria-label="Buscar tarea" className="pl-9" />
        </div>
      </div>

      {query.isLoading ? <div className="space-y-2" aria-busy="true"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
        : query.isError ? <ErrorState message={errorMessage(query.error, 'No se pudo cargar el historial')} onRetry={() => void query.refetch()} />
        : (query.data?.data.length ?? 0) === 0 ? <EmptyState title="Sin tareas" description="No hay tareas con esos filtros." />
        : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[1080px] text-[13px]">
              <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr><th scope="col" className="px-3 py-2">Tarea</th><th scope="col" className="px-3 py-2">Responsable</th><th scope="col" className="px-3 py-2">Límite</th><th scope="col" className="px-3 py-2">Estado</th><th scope="col" className="px-3 py-2">Entrega</th><th scope="col" className="px-3 py-2">Calificación</th><th scope="col" className="px-3 py-2">Lista</th><th scope="col" className="px-3 py-2 text-right">Estimado / real</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {query.data!.data.map((t) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2.5">
                      <span className="font-semibold">{t.title}</span>
                      {t.rejectedAt && <span className="mt-0.5 block text-[11px] text-red-800" title={t.rejectedReason ?? undefined}>Rechazada el {fmt(t.rejectedAt)}{t.rejectedReason ? `: ${t.rejectedReason}` : ''}</span>}
                      {t.deliveryNote && <span className="mt-0.5 block text-[11px] text-muted-foreground">Nota de entrega: {t.deliveryNote}</span>}
                    </td>
                    <td className="px-3 py-2.5">{t.assignees.map((a) => a.name).join(', ') || '—'}</td>
                    <td className="px-3 py-2.5">{fmt(t.dueDate)}</td>
                    <td className="px-3 py-2.5">{STATUS_LABEL[t.status] ?? t.status}</td>
                    <td className="px-3 py-2.5">
                      {t.status === 'COMPLETED' ? (
                        <div className="space-y-1"><PunctualityBadge task={t} />{t.completedAt && <span className="block text-[11px] text-muted-foreground">{fmt(t.completedAt)}</span>}</div>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      {t.rating ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5"><RatingStars value={t.rating} /><span className="text-[11px] font-semibold">{RATING_LABEL[t.rating]}</span></div>
                          {t.ratingComment && <span className="block max-w-[220px] break-words text-[11px] text-muted-foreground" title={t.ratingComment}>{t.ratingComment}</span>}
                          {canRateTask(t) && <button type="button" className="text-[11px] font-semibold text-primary underline dark:text-accent" onClick={() => setRating(t)}>Cambiar</button>}
                        </div>
                      ) : canRateTask(t) ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => setRating(t)}><Star className="size-3.5" aria-hidden="true" />Calificar</Button>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5">{t.checklist ? `${t.checklist.done}/${t.checklist.total}` : '—'}</td>
                    <td className="px-3 py-2.5 text-right">
                      {t.estimatedMinutes ? duration(t.estimatedMinutes) : '—'} / {duration(t.trackedMinutes)}
                      {t.deviationPct !== null && <span className={t.deviationPct > 25 ? 'ml-1 font-semibold text-red-700' : 'ml-1 text-muted-foreground'}>({t.deviationPct > 0 ? '+' : ''}{t.deviationPct}%)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      <Dialog open={Boolean(rating)} onOpenChange={(open) => { if (!open) setRating(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Calificar tarea</DialogTitle>
            <DialogDescription className="break-words">{rating?.title}</DialogDescription>
          </DialogHeader>
          {rating && <TaskRatingPanel key={rating.id} task={rating} canRate onSaved={() => { setRating(null); refreshAll(); }} />}
        </DialogContent>
      </Dialog>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-[12px] text-muted-foreground">
          <span>Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}</span>
          <div className="flex items-center gap-1">
            <Button type="button" size="icon" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Página anterior"><ChevronLeft className="size-4" /></Button>
            <span className="px-2">{page} / {pages}</span>
            <Button type="button" size="icon" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Página siguiente"><ChevronRight className="size-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
