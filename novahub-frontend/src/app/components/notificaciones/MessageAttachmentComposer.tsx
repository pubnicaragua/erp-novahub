import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import { FileText, Loader2, Paperclip, RotateCcw, Upload, X } from 'lucide-react';
import { messagesService } from '../../services/notificaciones.service';
import { supportConversationsService } from '../../services/support-conversations.service';
import type { MessageAttachment } from '../../types';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import { getMessageAttachmentFiles, hasMessageAttachmentFiles } from './message-attachment-input';

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_MESSAGE_BYTES = 25 * 1024 * 1024;
const ACCEPTED = '.jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,.csv';

export interface MessageAttachmentComposerHandle {
  addFiles: (selectedFiles: FileList | File[] | null) => void;
}

interface ComposerFile {
  key: string;
  file: File;
  progress: number;
  status: 'uploading' | 'ready' | 'error';
  attachment?: MessageAttachment;
  error?: string;
}

interface MessageAttachmentComposerProps {
  conversationId?: string;
  kind?: 'SUPPORT' | 'DIRECT';
  density?: 'default' | 'compact';
  children?: ReactNode;
  disabled?: boolean;
  onChange: (state: {
    attachments: MessageAttachment[];
    uploading: boolean;
    hasError: boolean;
  }) => void;
}

export const MessageAttachmentComposer = forwardRef<MessageAttachmentComposerHandle, MessageAttachmentComposerProps>(function MessageAttachmentComposer({
  conversationId,
  kind = 'SUPPORT',
  density = 'default',
  children,
  disabled = false,
  onChange,
}, ref) {
  const [files, setFiles] = useState<ComposerFile[]>([]);
  const [selectionError, setSelectionError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const attachmentHelpId = useId();
  const compact = density === 'compact';
  const dragDepthRef = useRef(0);
  const filesRef = useRef<ComposerFile[]>([]);

  useEffect(() => {
    onChange({
      attachments: files.flatMap((item) => item.attachment ? [item.attachment] : []),
      uploading: files.some((item) => item.status === 'uploading'),
      hasError: files.some((item) => item.status === 'error'),
    });
  }, [files, onChange]);

  const setFile = useCallback((key: string, update: (current: ComposerFile) => ComposerFile) => {
    filesRef.current = filesRef.current.map((item) => item.key === key ? update(item) : item);
    setFiles(filesRef.current);
  }, []);

  const upload = useCallback(async (item: ComposerFile) => {
    setFile(item.key, (current) => ({ ...current, status: 'uploading', progress: 0, error: undefined }));
    try {
      const onProgress = (progress: number) => setFile(item.key, (current) => ({ ...current, progress }));
      const attachment = kind === 'DIRECT'
        ? await messagesService.uploadAttachment(item.file, { onProgress })
        : await supportConversationsService.uploadAttachment(item.file, { conversationId, onProgress });
      setFile(item.key, (current) => ({ ...current, attachment, status: 'ready', progress: 100 }));
    } catch (error: unknown) {
      const failure = error as { response?: { data?: { message?: string } }; message?: string };
      setFile(item.key, (current) => ({
        ...current,
        status: 'error',
        error: failure?.response?.data?.message || failure?.message || 'No se pudo cargar el archivo.',
      }));
    }
  }, [conversationId, kind, setFile]);

  const addFiles = useCallback((selectedFiles: FileList | File[] | null) => {
    if (disabled) return;
    const newFiles = Array.from(selectedFiles || []);
    if (!newFiles.length) return;
    setSelectionError('');
    const currentFiles = filesRef.current;
    const alreadySelectedBytes = currentFiles.reduce((total, item) => total + item.file.size, 0);
    if (currentFiles.length + newFiles.length > MAX_FILES) {
      setSelectionError('Puedes adjuntar hasta 5 archivos por mensaje.');
      return;
    }
    if (newFiles.some((file) => file.size < 1 || file.size > MAX_FILE_BYTES)) {
      setSelectionError('Cada archivo debe pesar como máximo 10 MB.');
      return;
    }
    if (alreadySelectedBytes + newFiles.reduce((total, file) => total + file.size, 0) > MAX_MESSAGE_BYTES) {
      setSelectionError('Los adjuntos de un mensaje no pueden superar 25 MB.');
      return;
    }

    const added = newFiles.map((file) => ({
      key: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      file,
      progress: 0,
      status: 'uploading' as const,
    }));
    filesRef.current = [...currentFiles, ...added];
    setFiles(filesRef.current);
    for (const item of added) void upload(item);
  }, [disabled, upload]);

  useImperativeHandle(ref, () => ({ addFiles }), [addFiles]);

  const handleDragEnter = (event: ReactDragEvent<HTMLDivElement>) => {
    if (disabled || !hasMessageAttachmentFiles(event.dataTransfer)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!hasMessageAttachmentFiles(event.dataTransfer)) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  };

  const handleDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (disabled || !hasMessageAttachmentFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    if (disabled || !hasMessageAttachmentFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);
    addFiles(getMessageAttachmentFiles(event.dataTransfer));
  };

  const removeFile = (key: string) => {
    filesRef.current = filesRef.current.filter((item) => item.key !== key);
    setFiles(filesRef.current);
  };

  return (
    <div
      data-message-attachment-composer="true"
      className={cn(
        compact
          ? 'relative min-w-0 rounded-2xl border border-border bg-muted/20 p-1.5 transition-colors focus-within:ring-2 focus-within:ring-ring/40'
          : 'relative space-y-2 rounded-xl transition-colors',
        isDragging && (compact ? 'border-dashed border-primary bg-primary/5' : 'border border-dashed border-primary bg-primary/5 p-2'),
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className={cn(
          'flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary',
          compact && 'absolute bottom-full left-0 right-0 z-20 mb-1 shadow-md',
        )} role="status" aria-live="polite">
          <Upload className="size-4 shrink-0" /> Suelta los archivos para adjuntarlos
        </div>
      )}
      <div className={cn('flex min-w-0 items-center gap-2', compact && 'gap-1')}>
        <label className={cn(
          compact
            ? 'inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted focus-within:ring-2 focus-within:ring-ring/50'
            : 'inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-semibold transition hover:bg-muted/60 focus-within:ring-2 focus-within:ring-ring/50',
          (disabled || files.length >= MAX_FILES) && 'pointer-events-none opacity-50',
        )} title="Adjuntar archivos">
          <Paperclip className="size-4" />
          <span className={compact ? 'sr-only' : undefined}>Adjuntar archivo</span>
          <input
            type="file"
            accept={ACCEPTED}
            multiple
            disabled={disabled || files.length >= MAX_FILES}
            className="sr-only"
            aria-label="Adjuntar archivos a la conversación"
            aria-describedby={attachmentHelpId}
            onChange={(event) => {
              addFiles(event.currentTarget.files);
              event.currentTarget.value = '';
            }}
          />
        </label>
        {compact ? children : <span className="text-[11px] text-muted-foreground">Hasta 5 archivos · 10 MB cada uno · 25 MB por mensaje</span>}
      </div>
      <p id={attachmentHelpId} className={cn('text-[11px] text-muted-foreground', compact && 'sr-only')}>Hasta 5 archivos · 10 MB cada uno · 25 MB por mensaje. También puedes arrastrar archivos al formulario o pegarlos desde el portapapeles.</p>

      {selectionError && <p className={cn('text-xs text-destructive', compact && 'mt-1 px-2')} role="alert">{selectionError}</p>}

      {files.length > 0 && (
        <ul className={cn('grid gap-2 sm:grid-cols-2', compact && 'mt-1 gap-1.5')} aria-label="Archivos adjuntos">
          {files.map((item) => (
            <li key={item.key} className={cn('min-w-0 rounded-xl border border-border/70 bg-background/70 p-2.5', compact && 'rounded-lg p-1.5')}>
              <div className="flex min-w-0 items-start gap-2">
                <FileText className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="break-all text-xs font-semibold" title={item.file.name}>{item.file.name}</p>
                  <p className="text-[10px] text-muted-foreground">{(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                  {item.status === 'uploading' && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`Carga de ${item.file.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.progress}>
                        <div className="h-full rounded-full bg-primary transition-[width] duration-150" style={{ width: `${item.progress}%` }} />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground">{item.progress}%</span>
                    </div>
                  )}
                  {item.status === 'ready' && <p className="mt-1 text-[10px] font-medium text-emerald-600">Listo para enviar</p>}
                  {item.status === 'error' && <p className="mt-1 text-[10px] text-destructive" role="alert">{item.error}</p>}
                </div>
                {item.status === 'error' && (
                  <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => void upload(item)} disabled={disabled} aria-label={`Reintentar carga de ${item.file.name}`}>
                    <RotateCcw className="size-3.5" />
                  </Button>
                )}
                {item.status === 'uploading' && <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" aria-label="Cargando archivo" />}
                <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => removeFile(item.key)} disabled={disabled} aria-label={`Quitar ${item.file.name} antes de enviar`}>
                  <X className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
