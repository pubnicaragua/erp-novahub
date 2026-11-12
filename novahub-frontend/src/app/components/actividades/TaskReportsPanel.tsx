import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Paperclip, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { asList, invalidateTenantQueries, useTenantQuery } from '../../hooks/useTenantQuery';
import { tasksService } from '../../services/actividades.service';
import { storageService } from '../../services/storage.service';
import { ReportEntry, formatFileSize } from './ReportEntry';
import type { ActivityReport } from '../../types';

interface TaskReportsPanelProps {
  taskId: string;
  /** Quien puede enviar entregables puede reportar avance. */
  canReport: boolean;
  /** Quien puede aprobar tareas puede marcar reportes como incompletos. */
  canReview: boolean;
  onChanged?: () => void;
}

/** Reportes de avance de una tarea: lo que cada persona fue haciendo, con porcentaje y archivos, en orden. */
export function TaskReportsPanel({ taskId, canReport, canReview, onChanged }: TaskReportsPanelProps) {
  const queryClient = useQueryClient();
  const reportsQuery = useTenantQuery<ActivityReport[]>(['activities', 'task-reports', taskId], () => tasksService.getReports(taskId));
  const reports = asList(reportsQuery.data) as ActivityReport[];
  const [body, setBody] = useState('');
  const [percent, setPercent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  const refresh = () => {
    void invalidateTenantQueries(queryClient);
    onChanged?.();
  };

  const canSend = (body.trim() || files.length > 0 || percent.trim() !== '') && !sending;

  const send = async () => {
    const trimmedPercent = percent.trim();
    if (trimmedPercent !== '') {
      const value = Number(trimmedPercent);
      if (!Number.isInteger(value) || value < 0 || value > 100) {
        toast.error('El avance debe ser un número entero de 0 a 100.');
        return;
      }
    }
    try {
      setSending(true);
      const uploaded = [];
      for (const file of files) {
        const result = await storageService.uploadFile('task-evidence', file, { folder: taskId });
        uploaded.push({ url: result.uri, name: file.name, size: file.size, type: file.type });
      }
      await tasksService.addReport(taskId, {
        body: body.trim() || undefined,
        progressPercent: trimmedPercent === '' ? null : Number(trimmedPercent),
        files: uploaded,
      });
      toast.success('Reporte de avance guardado');
      setBody('');
      setPercent('');
      setFiles([]);
      refresh();
    } catch (e: unknown) {
      const failure = e as { response?: { data?: { message?: string } }; message?: string } | null;
      toast.error(failure?.response?.data?.message || failure?.message || 'No se pudo guardar el reporte');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {canReport && (
        <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/[0.12] p-3.5" data-testid="activities-task-report-form">
          <div className="space-y-1.5">
            <Label htmlFor={`report-body-${taskId}`} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">¿Qué hiciste?</Label>
            <Textarea
              id={`report-body-${taskId}`}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={4000}
              placeholder="Cuenta qué avanzaste, qué falta y si algo te bloquea."
              className="min-h-20 rounded-xl bg-background text-sm"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <Label htmlFor={`report-percent-${taskId}`} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Avance (%)</Label>
              <Input
                id={`report-percent-${taskId}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={5}
                value={percent}
                onChange={(event) => setPercent(event.target.value)}
                placeholder="0 – 100"
                className="h-10 rounded-xl bg-background"
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label htmlFor={`report-files-${taskId}`} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Documentos o evidencias</Label>
              <Input
                id={`report-files-${taskId}`}
                type="file"
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 10))}
                className="h-10 rounded-xl bg-background text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:font-bold file:text-primary"
              />
            </div>
          </div>
          {files.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Archivos por enviar">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border/50 bg-background px-2 py-1 text-xs">
                  <Paperclip className="size-3 shrink-0 text-primary" />
                  <span className="min-w-0 truncate">{file.name}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{formatFileSize(file.size)}</span>
                  <button type="button" aria-label={`Quitar ${file.name}`} className="shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}>
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">Queda guardado con tu nombre y fecha; el equipo y quien revisa lo ven en Reportes.</p>
            <Button type="button" className="h-9 rounded-xl px-4 text-xs font-black uppercase tracking-widest" disabled={!canSend} onClick={() => void send()} data-testid="activities-task-report-send">
              {sending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Send className="mr-1.5 size-4" />} Guardar reporte
            </Button>
          </div>
        </div>
      )}

      {reportsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground" role="status">Cargando reportes…</p>
      ) : reportsQuery.isError ? (
        <p className="text-sm text-destructive" role="alert">No se pudieron cargar los reportes.</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía nadie ha reportado avance en esta tarea.</p>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <ReportEntry
              key={report.id}
              canReview={canReview}
              onReviewed={refresh}
              report={{
                id: report.id,
                kind: report.kind,
                body: report.body,
                progressPercent: report.progressPercent,
                isIncomplete: report.isIncomplete,
                incompleteNote: report.incompleteNote,
                flaggedBy: report.flaggedBy,
                flaggedAt: report.flaggedAt,
                createdAt: report.createdAt,
                author: report.author ? { id: report.author.id, name: report.author.name } : null,
                files: report.evidences || [],
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
