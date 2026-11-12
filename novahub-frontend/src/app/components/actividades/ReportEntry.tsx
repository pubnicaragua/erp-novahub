import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Flag, Loader2, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';
import { activityReportsService } from '../../services/actividades.service';
import { storageService } from '../../services/storage.service';
import type { ActivityReportFile } from '../../types';

export const REPORT_KIND_LABEL: Record<string, string> = {
  PROGRESS: 'Avance',
  DELIVERY: 'Entrega',
  NOTE: 'Nota',
  EVIDENCE: 'Archivo',
};

export function formatReportDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function formatFileSize(bytes?: number | null) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Abre un archivo guardado: las referencias privadas (storage://) se resuelven solo al abrirlas, no al listar. */
export async function openStoredFile(uri: string) {
  const url = await storageService.resolveUrl(uri);
  if (!url) throw new Error('No se pudo obtener el archivo.');
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function ReportFileChip({ file }: { file: ActivityReportFile }) {
  const [opening, setOpening] = useState(false);
  const open = async () => {
    try {
      setOpening(true);
      await openStoredFile(file.fileUrl);
    } catch (e: unknown) {
      const failure = e as { response?: { data?: { message?: string } }; message?: string } | null;
      toast.error(failure?.response?.data?.message || failure?.message || 'No se pudo abrir el archivo');
    } finally {
      setOpening(false);
    }
  };
  const meta = [formatFileSize(file.fileSize)].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={opening}
      title={`Abrir ${file.fileName}`}
      className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-left text-xs font-semibold transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60"
    >
      {opening ? <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" /> : <FileText className="size-3.5 shrink-0 text-primary" />}
      <span className="min-w-0 truncate">{file.fileName}</span>
      {meta && <span className="shrink-0 text-[10px] font-medium text-muted-foreground">{meta}</span>}
      <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
    </button>
  );
}

export interface ReportEntryData {
  id: string;
  source?: 'REPORT' | 'LEGACY_EVIDENCE';
  kind: string;
  body: string | null;
  progressPercent: number | null;
  isIncomplete: boolean;
  incompleteNote: string | null;
  flaggedBy?: { id: string; name: string | null } | null;
  flaggedAt?: string | null;
  createdAt: string;
  author?: { id: string; name: string | null } | null;
  files: ActivityReportFile[];
}

interface ReportEntryProps {
  report: ReportEntryData;
  /** Quien puede aprobar tareas puede marcar o quitar la marca de incompleto. */
  canReview: boolean;
  onReviewed?: () => void;
  /** Muestra el título de la tarea sobre el reporte (vista cronológica). */
  taskTitle?: string;
  className?: string;
}

/** Un reporte de avance o de entrega: quién, cuándo, qué dijo, cuánto avanzó, sus archivos y su estado de revisión. */
export function ReportEntry({ report, canReview, onReviewed, taskTitle, className }: ReportEntryProps) {
  const [flagging, setFlagging] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const reviewable = report.source !== 'LEGACY_EVIDENCE' && canReview;
  const authorName = report.author?.name || 'Persona no identificada';

  const submitFlag = async (incomplete: boolean) => {
    try {
      setSaving(true);
      await activityReportsService.review(report.id, { incomplete, note: incomplete ? note.trim() : undefined });
      toast.success(incomplete ? 'Reporte marcado como incompleto. Se avisó a quien lo hizo.' : 'Se quitó la marca de incompleto');
      setFlagging(false);
      setNote('');
      onReviewed?.();
    } catch (e: unknown) {
      const failure = e as { response?: { data?: { message?: string } }; message?: string } | null;
      toast.error(failure?.response?.data?.message || failure?.message || 'No se pudo actualizar la revisión');
    } finally {
      setSaving(false);
    }
  };

  return (
    <article
      className={cn(
        'min-w-0 space-y-3 rounded-2xl border bg-card p-4',
        report.isIncomplete ? 'border-amber-500/50 bg-amber-500/5' : 'border-border/50',
        className,
      )}
    >
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary" aria-hidden="true">
            {authorName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{authorName}</p>
            <p className="text-[11px] text-muted-foreground">{formatReportDate(report.createdAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest">{REPORT_KIND_LABEL[report.kind] || report.kind}</Badge>
          {typeof report.progressPercent === 'number' && (
            <Badge variant="secondary" className="px-2 py-0.5 text-[9px] font-black tabular-nums">{report.progressPercent}%</Badge>
          )}
          {report.isIncomplete && (
            <Badge variant="outline" className="gap-1 border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
              <AlertTriangle className="size-3" /> Incompleto
            </Badge>
          )}
        </div>
      </header>

      {taskTitle && <p className="min-w-0 break-words text-xs font-bold text-primary">{taskTitle}</p>}

      {report.body ? (
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{report.body}</p>
      ) : report.files.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin texto ni archivos.</p>
      ) : null}

      {report.files.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Archivos del reporte">
          {report.files.map((file) => <ReportFileChip key={file.id} file={file} />)}
        </div>
      )}

      {report.isIncomplete && (
        <p className="rounded-xl border border-amber-500/30 bg-background/70 p-2.5 text-xs leading-5 text-muted-foreground">
          <strong className="text-foreground">Pendiente de complementar</strong>
          {report.flaggedBy?.name ? ` · marcado por ${report.flaggedBy.name}` : ''}
          {report.flaggedAt ? ` el ${formatReportDate(report.flaggedAt)}` : ''}
          {report.incompleteNote ? `: ${report.incompleteNote}` : '.'}
        </p>
      )}

      {report.source === 'LEGACY_EVIDENCE' && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Paperclip className="size-3" /> Archivo adjuntado antes de que existieran los reportes.</p>
      )}

      {reviewable && !flagging && (
        <div className="flex flex-wrap gap-2">
          {report.isIncomplete ? (
            <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg text-xs" disabled={saving} onClick={() => void submitFlag(false)}>
              {saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 size-3.5" />} Quitar marca
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg border-amber-500/40 text-xs text-amber-700 hover:bg-amber-500/10 dark:text-amber-300" onClick={() => setFlagging(true)}>
              <Flag className="mr-1.5 size-3.5" /> Marcar incompleto
            </Button>
          )}
        </div>
      )}

      {reviewable && flagging && (
        <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 p-3">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground" htmlFor={`flag-note-${report.id}`}>¿Qué falta? (opcional)</label>
          <Textarea id={`flag-note-${report.id}`} value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="Ej. Falta el anexo firmado o el detalle de las facturas." className="min-h-16 rounded-xl bg-background text-xs" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" className="h-8 rounded-lg text-xs" disabled={saving} onClick={() => void submitFlag(true)}>
              {saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Flag className="mr-1.5 size-3.5" />} Marcar y avisar
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 rounded-lg text-xs" disabled={saving} onClick={() => { setFlagging(false); setNote(''); }}>
              <X className="mr-1 size-3.5" /> Cancelar
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
