import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { asList, invalidateTenantQueries, useTenantQuery } from '../../hooks/useTenantQuery';
import { tasksService } from '../../services/actividades.service';
import { useAuth } from '../../contexts/AuthContext';
import { formatReportDate } from './ReportEntry';
import type { ActivityComment } from '../../types';

interface TaskCommentsPanelProps {
  taskId: string;
  onChanged?: () => void;
}

/** Conversación del equipo sobre una tarea. No cambia su estado; avisa a quienes la comparten. */
export function TaskCommentsPanel({ taskId, onChanged }: TaskCommentsPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const commentsQuery = useTenantQuery<ActivityComment[]>(['activities', 'task-comments', taskId], () => tasksService.getComments(taskId));
  const comments = asList(commentsQuery.data) as ActivityComment[];
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const refresh = () => {
    void invalidateTenantQueries(queryClient);
    onChanged?.();
  };

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    try {
      setSending(true);
      await tasksService.addComment(taskId, body);
      setText('');
      refresh();
    } catch (e: unknown) {
      const failure = e as { response?: { data?: { message?: string } }; message?: string } | null;
      toast.error(failure?.response?.data?.message || failure?.message || 'No se pudo enviar el comentario');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      {commentsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground" role="status">Cargando comentarios…</p>
      ) : commentsQuery.isError ? (
        <p className="text-sm text-destructive" role="alert">No se pudieron cargar los comentarios.</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay comentarios. Usa este espacio para preguntar, aclarar o avisar al equipo.</p>
      ) : (
        <ol className="space-y-2.5">
          {comments.map((comment) => {
            const mine = String(comment.authorId) === String(user?.id || '');
            return (
              <li key={comment.id} className="min-w-0 rounded-xl border border-border/40 bg-muted/[0.14] p-3">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-xs font-bold text-foreground">
                    {comment.author?.name || 'Compañero'}{mine ? ' (tú)' : ''}
                    <span className="ml-2 font-medium text-muted-foreground">{formatReportDate(comment.createdAt)}</span>
                  </p>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{comment.body}</p>
              </li>
            );
          })}
        </ol>
      )}
      <div className="space-y-2">
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={2000}
          aria-label="Escribe un comentario"
          placeholder="Escribe un comentario para el equipo…"
          className="min-h-16 rounded-xl bg-background text-sm"
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') void send();
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">Ctrl + Enter para enviar. Se avisa a quienes comparten la tarea.</p>
          <Button type="button" size="sm" className="h-9 rounded-xl px-4 text-xs font-black uppercase tracking-widest" disabled={!text.trim() || sending} onClick={() => void send()} data-testid="activities-task-comment-send">
            {sending ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Send className="mr-1.5 size-4" />} Comentar
          </Button>
        </div>
      </div>
    </div>
  );
}
