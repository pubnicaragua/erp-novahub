import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, LogOut, Soup, Undo2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useImpersonation } from '../../contexts/ImpersonationContext';
import { performanceService, type AttendanceMark, type MyAttendance } from '../../services/performance.service';
import { toast } from '../../services/toast';
import { Button } from '../ui/button';

const time = (value?: string | null) => (value ? new Date(value).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '—');

const ACTIONS: Record<AttendanceMark, { label: string; done: string; icon: typeof Soup }> = {
  LUNCH_START: { label: 'Salir a almorzar', done: 'Salida a almorzar marcada', icon: Soup },
  LUNCH_END: { label: 'Regresé del almuerzo', done: 'Regreso del almuerzo marcado', icon: Undo2 },
  CHECK_OUT: { label: 'Marcar salida', done: 'Salida marcada', icon: LogOut },
};

/**
 * Mi jornada: muestra la entrada (que se marca sola al abrir el sistema) y deja marcar la salida a almorzar,
 * el regreso y la salida del día. Las horas las pone el servidor; la persona solo pulsa el botón que toca.
 */
export function JornadaWidget() {
  const { user } = useAuth();
  const { isImpersonating } = useImpersonation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const eligible = Boolean(user && !isImpersonating && !user.isPlatformAdmin && !user.isPlatformSupportAgent && user.userType !== 'customer_portal' && user.userType !== 'manager' && user.role !== 'manager');
  const tenantId = user?.clientTenantId || user?.tenantId;
  const queryKey = ['performance', 'my-attendance', tenantId, user?.id];

  const attendance = useQuery<MyAttendance>({
    queryKey,
    queryFn: ({ signal }) => performanceService.getMyAttendance(signal),
    enabled: eligible,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  const mark = useMutation({
    mutationFn: (type: AttendanceMark) => performanceService.markAttendance(type),
    onSuccess: (data, type) => {
      queryClient.setQueryData(queryKey, data);
      toast.success(ACTIONS[type].done);
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : 'No se pudo marcar. Intenta de nuevo.'),
  });

  const data = attendance.data;
  // Sin empleado vinculado o sin entrada del día no hay jornada que mostrar.
  if (!eligible || !data || !data.registered || !data.checkIn) return null;

  const next = data.next ?? null;
  const NextIcon = next ? ACTIONS[next].icon : Clock;

  return (
    <div className="fixed bottom-4 left-4 z-40 max-w-[calc(100vw-2rem)]">
      {open && (
        <div className="mb-2 w-64 rounded-2xl border border-border bg-card p-3 text-[12px] shadow-lg" role="dialog" aria-label="Mi jornada">
          <p className="mb-2 text-[13px] font-semibold text-primary dark:text-foreground">Mi jornada de hoy</p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">Entrada</dt><dd className="text-right font-semibold tabular-nums">{time(data.checkIn)}</dd>
            <dt className="text-muted-foreground">Salí a almorzar</dt><dd className="text-right font-semibold tabular-nums">{time(data.breakStartAt)}</dd>
            <dt className="text-muted-foreground">Regresé</dt><dd className="text-right font-semibold tabular-nums">{time(data.breakEndAt)}</dd>
            <dt className="text-muted-foreground">Salida</dt><dd className="text-right font-semibold tabular-nums">{time(data.checkOut)}</dd>
          </dl>
          {next ? (
            <Button type="button" size="sm" className="mt-3 w-full" disabled={mark.isPending} onClick={() => mark.mutate(next)}>
              <NextIcon className="mr-1.5 size-4" aria-hidden="true" />{mark.isPending ? 'Marcando…' : ACTIONS[next].label}
            </Button>
          ) : (
            <p className="mt-3 text-muted-foreground">Jornada cerrada. ¡Hasta mañana!</p>
          )}
        </div>
      )}
      <Button type="button" size="sm" variant="outline" className="bg-card shadow-md" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Clock className="mr-1.5 size-4" aria-hidden="true" />
        {next ? `Jornada · ${ACTIONS[next].label}` : 'Jornada cerrada'}
      </Button>
    </div>
  );
}
