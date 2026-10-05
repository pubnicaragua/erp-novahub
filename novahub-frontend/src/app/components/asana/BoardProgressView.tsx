import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../services/api';
import { invalidateTenantQueries } from '../../hooks/useTenantQuery';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Loader2, CheckCircle2, Clock, AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';

type BoardProgressViewProps = {
  board: {
    id: string;
    statusColor: string;
    statusText: string | null;
    statusUpdatedAt: string | null;
  };
  allTasks: any[];
  canEdit: boolean;
};

export function BoardProgressView({ board, allTasks, canEdit }: BoardProgressViewProps) {
  const queryClient = useQueryClient();
  const [statusColor, setStatusColor] = useState(board.statusColor || 'green');
  const [statusText, setStatusText] = useState(board.statusText || '');

  const totalTasks = allTasks.filter(t => !t.parentTaskId).length;
  const completedTasks = allTasks.filter(t => !t.parentTaskId && t.status === 'COMPLETED').length;
  const inProgressTasks = allTasks.filter(t => !t.parentTaskId && t.status === 'IN_PROGRESS').length;
  const todoTasks = allTasks.filter(t => !t.parentTaskId && t.status === 'TODO').length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const updateStatus = useMutation({
    mutationFn: () =>
      api.patch(`/asana/boards/${board.id}`, { statusColor, statusText }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asana', 'board', board.id] });
      toast.success('Estado del proyecto actualizado');
    },
    onError: () => {
      toast.error('Error al actualizar el estado');
    }
  });

  return (
    <div className="max-w-4xl space-y-8 mt-6">
      {/* Sección Superior: Actualización de Estado */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">Estado del proyecto</h2>
            <div className="flex bg-muted p-1 rounded-lg">
              <button
                onClick={() => canEdit && setStatusColor('green')}
                className={`size-6 rounded-full border-2 transition ${
                  statusColor === 'green' ? 'border-foreground shadow-sm bg-emerald-500' : 'border-transparent bg-emerald-500/50 hover:bg-emerald-500'
                }`}
                disabled={!canEdit}
                title="En curso"
              />
              <button
                onClick={() => canEdit && setStatusColor('yellow')}
                className={`size-6 rounded-full border-2 transition ml-2 ${
                  statusColor === 'yellow' ? 'border-foreground shadow-sm bg-yellow-500' : 'border-transparent bg-yellow-500/50 hover:bg-yellow-500'
                }`}
                disabled={!canEdit}
                title="En riesgo"
              />
              <button
                onClick={() => canEdit && setStatusColor('red')}
                className={`size-6 rounded-full border-2 transition ml-2 ${
                  statusColor === 'red' ? 'border-foreground shadow-sm bg-red-500' : 'border-transparent bg-red-500/50 hover:bg-red-500'
                }`}
                disabled={!canEdit}
                title="Retrasado"
              />
            </div>
            {board.statusUpdatedAt && (
              <span className="text-xs text-muted-foreground ml-auto">
                Actualizado el {new Date(board.statusUpdatedAt).toLocaleDateString('es-NI')}
              </span>
            )}
          </div>
          
          <div className="space-y-3">
            <Textarea
              value={statusText}
              onChange={(e) => setStatusText(e.target.value)}
              placeholder="¿Cómo va el proyecto? Comparte una actualización con tu equipo..."
              className="min-h-[120px] bg-muted/30"
              disabled={!canEdit || updateStatus.isPending}
            />
            {canEdit && (
              <Button 
                onClick={() => updateStatus.mutate()} 
                disabled={updateStatus.isPending || (statusColor === board.statusColor && statusText === board.statusText)}
              >
                {updateStatus.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Publicar actualización
              </Button>
            )}
          </div>
        </div>

        {/* Panel de métricas rápidas */}
        <div className="space-y-4">
          <div className="bg-card border rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Info className="size-4 text-muted-foreground" /> Resumen de tareas
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Progreso general</span>
                  <span className="font-medium">{progressPercent}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                <div>
                  <p className="text-2xl font-bold text-emerald-500">{completedTasks}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> Completadas
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-500">{inProgressTasks}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" /> En curso
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{todoTasks}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="size-3 opacity-50" /> Por hacer
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalTasks}</p>
                  <p className="text-xs text-muted-foreground">Total (Principales)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
