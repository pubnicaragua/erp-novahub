import React, { useState, useEffect } from 'react';
import { Play, Square, Plus, Clock, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { tasksService } from '../../services/actividades.service';
import type { ActivityTimeEntry } from '../../types';
import { toast } from '@/app/services/toast';
import { format } from 'date-fns';

interface TimeTrackerProps {
  taskId: string;
  timeEntries: ActivityTimeEntry[];
  onEntriesChange: () => void;
  canEdit?: boolean;
}

export const TimeTracker: React.FC<TimeTrackerProps> = ({
  taskId,
  timeEntries = [],
  onEntriesChange,
  canEdit = true,
}) => {
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
    const active = timeEntries.find((e) => !e.endedAt);
    if (active) {
      setRunningEntry(active);
      const startMs = new Date(active.startedAt).getTime();
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    } else {
      setRunningEntry(null);
      setElapsedSeconds(0);
    }
  }, [timeEntries]);

  // Live timer tick
  useEffect(() => {
    if (!runningEntry) return;
    const interval = setInterval(() => {
      const startMs = new Date(runningEntry.startedAt).getTime();
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [runningEntry]);

  const formatTime = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const totalLoggedSeconds = timeEntries.reduce((acc, e) => acc + (Number(e.durationSeconds) || 0), 0);
  const totalLoggedHours = (totalLoggedSeconds / 3600).toFixed(1);

  const handleStartTimer = async () => {
    if (!canEdit) return;
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
    if (!runningEntry || !canEdit) return;
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
            Total acumulado: <strong className="text-foreground">{totalLoggedHours} horas</strong> ({timeEntries.length} registros)
          </p>
        </div>
        {canEdit && (
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
      {canEdit && (
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

      {/* Manual Entry Form */}
      {showManual && (
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
          const mins = Math.round((Number(te.durationSeconds) || 0) / 60);
          return (
            <div
              key={te.id}
              className="flex items-center justify-between text-xs rounded-lg px-2 py-1.5 bg-background/60 border border-border/30"
            >
              <div className="min-w-0">
                <span className="font-medium truncate block">{te.description || 'Sesión de trabajo'}</span>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(te.startedAt), 'dd/MM/yyyy HH:mm')} · {te.isManual ? 'Manual' : 'Timer'}
                </span>
              </div>
              <span className="font-mono font-bold text-[11px] shrink-0">
                {mins >= 60 ? `${(mins / 60).toFixed(1)} h` : `${mins} min`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
