import { useEffect, useState } from 'react';
import { Download, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { messagesService } from '../../services/notificaciones.service';
import { supportConversationsService } from '../../services/support-conversations.service';
import type { MessageAttachment } from '../../types';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

export function MessageAttachments({
  threadId,
  kind,
  attachments,
  mine,
}: {
  threadId: string;
  kind: 'SUPPORT' | 'DIRECT';
  attachments?: MessageAttachment[];
  mine: boolean;
}) {
  if (!attachments?.length) return null;
  return (
    <div className="mt-2 grid gap-2" aria-label="Archivos del mensaje">
      {attachments.map((attachment) => (
        <MessageAttachmentItem
          key={attachment.id}
          threadId={threadId}
          kind={kind}
          attachment={attachment}
          mine={mine}
        />
      ))}
    </div>
  );
}

function MessageAttachmentItem({
  threadId,
  kind,
  attachment,
  mine,
}: {
  threadId: string;
  kind: 'SUPPORT' | 'DIRECT';
  attachment: MessageAttachment;
  mine: boolean;
}) {
  const isImage = attachment.mimeType.startsWith('image/');
  const previewKey = `${kind}:${threadId}:${attachment.id}`;
  const [previewResult, setPreviewResult] = useState<{ key: string; url: string; error: string } | null>(null);
  const [downloadError, setDownloadError] = useState('');
  const previewUrl = previewResult?.key === previewKey ? previewResult.url : '';
  const previewError = previewResult?.key === previewKey ? previewResult.error : '';
  const loading = isImage && !previewUrl && !previewError;

  useEffect(() => {
    if (!isImage) return undefined;
    let active = true;
    const request = kind === 'DIRECT'
      ? messagesService.getAttachmentUrl(threadId, attachment.id)
      : supportConversationsService.getAttachmentUrl(threadId, attachment.id);
    void request
      .then((result) => { if (active) setPreviewResult({ key: previewKey, url: result.url, error: '' }); })
      .catch(() => { if (active) setPreviewResult({ key: previewKey, url: '', error: 'Vista previa no disponible' }); });
    return () => { active = false; };
  }, [attachment.id, kind, threadId, isImage, previewKey]);

  const download = async () => {
    setDownloadError('');
    const newTab = window.open('about:blank', '_blank');
    if (newTab) newTab.opener = null;
    try {
      const result = kind === 'DIRECT'
        ? await messagesService.getAttachmentUrl(threadId, attachment.id, true)
        : await supportConversationsService.getAttachmentUrl(threadId, attachment.id, true);
      if (newTab) newTab.location.href = result.url;
      else window.location.assign(result.url);
    } catch {
      newTab?.close();
      setDownloadError('No se pudo abrir el archivo. Vuelve a intentarlo.');
    }
  };

  if (isImage) {
    return (
      <div className={cn('max-w-full overflow-hidden rounded-xl border', mine ? 'border-primary-foreground/20 bg-primary-foreground/5' : 'border-border/70 bg-background/60')}>
        {previewUrl ? (
          <a href={previewUrl} target="_blank" rel="noreferrer" aria-label={`Abrir imagen ${attachment.fileName}`}>
            <img src={previewUrl} alt={attachment.fileName} loading="lazy" className="max-h-72 max-w-full object-contain" />
          </a>
        ) : (
          <div className="flex h-24 w-48 items-center justify-center gap-2 text-xs text-muted-foreground">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
            {previewError || 'Cargando imagen…'}
          </div>
        )}
        <div className="flex items-center justify-between gap-3 px-2.5 py-2 text-[11px]">
          <span className="min-w-0 truncate font-medium" title={attachment.fileName}>{attachment.fileName}</span>
          <span className="shrink-0 opacity-70">{formatBytes(attachment.byteSize)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2', mine ? 'border-primary-foreground/20 bg-primary-foreground/5' : 'border-border/70 bg-background/60')}>
      <FileText className="size-5 shrink-0 opacity-80" />
      <div className="min-w-0 flex-1">
        <p className="break-all text-xs font-semibold">{attachment.fileName}</p>
        <p className="text-[10px] opacity-70">{formatBytes(attachment.byteSize)}</p>
        {downloadError && <p className="mt-1 text-[10px] text-destructive" role="alert">{downloadError}</p>}
      </div>
      <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" onClick={() => void download()} aria-label={`Descargar ${attachment.fileName}`} title="Descargar archivo">
        <Download className="size-4" />
      </Button>
    </div>
  );
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
