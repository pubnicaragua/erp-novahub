import React, { useState, useEffect } from 'react';
import { Play, Square, Plus, Clock, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { tasksService } from '../../services/actividades.service';
import type { ActivityTimeEntry } from '../../types';
import { toast } from '@/app/services/toast';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';
import { formatClock, formatDuration, isForgottenTimer, runningSeconds, splitTimeEntries, totalFinishedSeconds } from './taskTime';

interface TimeTrackerProps {
  taskId: string;
  timeEntries: ActivityTimeEntry[];
  onEntriesChange: () => void;
  canStart?: boolean;
  canStop?: boolean;
  canAddManual?: boolean;
  /** Nombres por id de usuario, para decir de quién es cada registro cuando el servidor no lo trae. */
  people?: Record<string, string>;
}

export const TimeTracker: React.FC<TimeTrackerProps> = ({
  taskId,
  timeEntries = [],
  onEntriesChange,
  canStart = false,
  canStop = false,
  canAddManual = false,
  people = {},
}) => {
  const { user } = useAuth();
  const myId = String(user?.id || '');
  const { others: otherRunning } = splitTimeEntries(timeEntries, myId);
  const nameOf = (entry: ActivityTimeEntry) => (String(entry.userId) === myId ? 'Tú' : entry.user?.name || people[String(entry.userId)] || 'Otra persona');
  const [runningEntry, setRunningEntry] = useState<ActivityTimeEntry | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerDescription, setTimerDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Manual entry modal/form
  const [showManual, setShowManual] = useState(false);
  const [manualMinutes, setManualMinutes] = useState('');
  const [manualDesc, setManualDesc] = useState('');

  // Find running entry on load
  useEffect(() => {
    const { mine: active } = splitTimeEntries(timeEntries, myId);
    if (active) {
      setRunningEntry(active);
      setElapsedSeconds(runningSeconds(active));
    } else {
      setRunningEntry(null);
      setElapsedSeconds(0);
    }
  }, [timeEntries, myId]);

  // Live timer tick
  useEffect(() => {
    if (!runningEntry) return;
    const interval = setInterval(() => {
      setElapsedSeconds(runningSeconds(runningEntry));
    }, 1000);
    return () => clearInterval(interval);
  }, [runningEntry]);

  const formatTime = (totalSec: number) => formatClock(totalSec);

  // Solo cuenta lo ya cerrado, en horas y minutos (nada de «0.3 horas»).
  const totalLoggedSeconds = totalFinishedSeconds(timeEntries);
  const finishedCount = timeEntries.filter((e) => Boolean(e.endedAt)).length;

  const handleStartTimer = async () => {
    if (!canStart) return;
    try {
      setLoading(true);
      await tasksService.startTimeEntry(taskId, timerDescription);
      setTimerDescription('');
      toast.success('Temporizador iniciado');
      onEntriesChange();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Error al iniciar temporizador');
    } finally {
      setLoading(false);
    }
  };

  const handleStopTimer = async () => {
    if (!runningEntry || !canStop) return;
    try {
      setLoading(true);
      await tasksService.stopTimeEntry(taskId, runningEntry.id);
      toast.success('Temporizador detenido');
      onEntriesChange();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Error al detener temporizador');
    } finally {
      setLoading(false);
    }
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseFloat(manualMinutes);
    if (!canAddManual) return;
    if (isNaN(mins) || mins <= 0) {
      toast.error('Ingresa una duración válida en minutos');
      return;
    }
    try {
      setLoading(true);
      await tasksService.addManualTimeEntry(taskId, {
        durationSeconds: Math.round(mins * 60),
        description: manualDesc.trim() || undefined,
      });
      toast.success('Tiempo registrado exitosamente');
      setShowManual(false);
      setManualMinutes('');
      setManualDesc('');
      onEntriesChange();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Error al registrar tiempo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/[0.08] p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="size-3.5 text-primary" /> Registro de Tiempo
          </h4>
          <p className="text-[11px] text-muted-foreground">
            Total acumulado: <strong className="text-foreground">{formatDuration(totalLoggedSeconds)}</strong> ({finishedCount} {finishedCount === 1 ? 'registro' : 'registros'})
          </p>
        </div>
        {canAddManual && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowManual(!showManual)}
            className="h-8 text-xs rounded-xl"
          >
            {showManual ? 'Cancelar' : '+ Manual'}
          </Button>
        )}
      </div>

      {/* Active Timer Bar */}
      {(runningEntry ? canStop : canStart) && (
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card p-2.5 shadow-sm">
          {runningEntry ? (
            <>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold uppercase text-emerald-500 flex items-center gap-1">
                  <span className="size-2 rounded-full bg-emerald-500 animate-ping" /> Grabando tiempo
                </span>
                <p className="text-xs font-semibold truncate text-muted-foreground">
                  {runningEntry.description || 'Sin notas'}
                </p>
              </div>
              <div className="font-mono text-base font-black tabular-nums text-foreground px-2">
                {formatTime(elapsedSeconds)}
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleStopTimer}
                disabled={loading}
                className="h-9 rounded-xl px-3 font-bold text-xs"
              >
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Square className="size-3.5 mr-1 fill-current" />}
                Detener
              </Button>
            </>
          ) : (
            <>
              <Input
                placeholder="¿En qué estás trabajando? (opcional)"
                value={timerDescription}
                onChange={(e) => setTimerDescription(e.target.value)}
                className="h-9 text-xs rounded-xl bg-background border-none shadow-none flex-1"
                disabled={loading}
              />
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleStartTimer}
                disabled={loading}
                className="h-9 rounded-xl px-3 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              >
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5 mr-1 fill-current" />}
                Iniciar
              </Button>
            </>
          )}
        </div>
      )}

      {runningEntry && isForgottenTimer(elapsedSeconds) && (
        <p className="flex items-start gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-700 dark:text-amber-300" data-testid="activities-timer-forgotten">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> Tu cronómetro lleva más de 12 horas corriendo. Si ya terminaste, detenlo para que no sume tiempo de más.
        </p>
      )}
      {otherRunning.map((entry) => {
        const seconds = runningSeconds(entry);
        return (
          <p key={entry.id} className="flex items-start gap-1.5 rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-[11px] font-medium text-muted-foreground" data-testid="activities-timer-other">
            <Clock className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span><strong className="text-foreground">{nameOf(entry)}</strong> está registrando tiempo en esta tarea desde hace {formatDuration(seconds)}{isForgottenTimer(seconds) ? '. Parece que olvidó detenerlo.' : '.'}</span>
          </p>
        );
      })}

      {/* Manual Entry Form */}
      {showManual && canAddManual && (
        <form onSubmit={handleAddManual} className="space-y-3 rounded-xl border border-border/60 bg-card p-3 animate-in fade-in">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] font-bold">Minutos dedicados</Label>
              <Input
                type="number"
                step="any"
                min="1"
                placeholder="Ej. 45"
                value={manualMinutes}
                onChange={(e) => setManualMinutes(e.target.value)}
                className="h-9 text-xs rounded-xl bg-background"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-bold">Descripción / Actividad</Label>
              <Input
                placeholder="Ej. Análisis de requerimientos"
                value={manualDesc}
                onChange={(e) => setManualDesc(e.target.value)}
                className="h-9 text-xs rounded-xl bg-background"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowManual(false)}
              className="h-8 text-xs rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="h-8 text-xs font-bold rounded-xl"
            >
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5 mr-1" />}
              Guardar tiempo
            </Button>
          </div>
        </form>
      )}

      {/* Time entries list */}
      <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
        {timeEntries.map((te) => {
          return (
            <div
              key={te.id}
              className="flex items-center justify-between text-xs rounded-lg px-2 py-1.5 bg-background/60 border border-border/30"
            >
              <div className="min-w-0">
                <span className="font-medium truncate block">{te.description || 'Sesión de trabajo'}</span>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(te.startedAt), 'dd/MM/yyyy HH:mm')} · {te.isManual ? 'Manual' : 'Timer'} · {nameOf(te)}
                </span>
              </div>
              <span className="font-mono font-bold text-[11px] shrink-0">
                {te.endedAt ? formatDuration(Number(te.durationSeconds) || 0) : 'En curso'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
