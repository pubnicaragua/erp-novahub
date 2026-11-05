import { useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { organizacionService, type TeamMember } from '../../services/organizacion.service';
import { EmptyState, ErrorState, NativeSelect } from './OrgBits';
import { errorMessage } from './organizacion.utils';

const PAGE_SIZE = 20;
const STATUS_LABEL: Record<string, string> = { PENDING: 'Pendiente', IN_PROGRESS: 'En progreso', WAITING_APPROVAL: 'En aprobación', COMPLETED: 'Completada', CANCELLED: 'Cancelada' };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const duration = (minutes: number) => (minutes <= 0 ? '—' : minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`);

/** Historial filtrable de tareas de las personas supervisadas, con minutos registrados por tarea. */
export function EquipoHistorial({ members, initialUser }: { members: TeamMember[]; initialUser: string }) {
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
            <table className="w-full min-w-[680px] text-[13px]">
              <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr><th scope="col" className="px-3 py-2">Tarea</th><th scope="col" className="px-3 py-2">Responsable</th><th scope="col" className="px-3 py-2">Límite</th><th scope="col" className="px-3 py-2">Estado</th><th scope="col" className="px-3 py-2 text-right">Tiempo registrado</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {query.data!.data.map((t) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2.5 font-semibold">{t.title}</td>
                    <td className="px-3 py-2.5">{t.assignees.map((a) => a.name).join(', ') || '—'}</td>
                    <td className="px-3 py-2.5">{fmt(t.dueDate)}</td>
                    <td className="px-3 py-2.5">{STATUS_LABEL[t.status] ?? t.status}</td>
                    <td className="px-3 py-2.5 text-right">{duration(t.trackedMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
