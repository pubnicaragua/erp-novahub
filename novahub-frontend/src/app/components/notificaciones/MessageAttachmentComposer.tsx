import { useEffect, useState } from 'react';
import { FileText, Loader2, Paperclip, RotateCcw, X } from 'lucide-react';
import { messagesService } from '../../services/notificaciones.service';
import { supportConversationsService } from '../../services/support-conversations.service';
import type { MessageAttachment } from '../../types';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_MESSAGE_BYTES = 25 * 1024 * 1024;
const ACCEPTED = '.jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,.csv';

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
  disabled?: boolean;
  onChange: (state: {
    attachments: MessageAttachment[];
    uploading: boolean;
    hasError: boolean;
  }) => void;
}

export function MessageAttachmentComposer({
  conversationId,
  kind = 'SUPPORT',
  disabled = false,
  onChange,
}: MessageAttachmentComposerProps) {
  const [files, setFiles] = useState<ComposerFile[]>([]);
  const [selectionError, setSelectionError] = useState('');

  useEffect(() => {
    onChange({
      attachments: files.flatMap((item) => item.attachment ? [item.attachment] : []),
      uploading: files.some((item) => item.status === 'uploading'),
      hasError: files.some((item) => item.status === 'error'),
    });
  }, [files, onChange]);

  const setFile = (key: string, update: (current: ComposerFile) => ComposerFile) => {
    setFiles((current) => current.map((item) => item.key === key ? update(item) : item));
  };

  const upload = async (item: ComposerFile) => {
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
  };

  const addFiles = (selectedFiles: FileList | null) => {
    const newFiles = Array.from(selectedFiles || []);
    if (!newFiles.length) return;
    setSelectionError('');
    const alreadySelectedBytes = files.reduce((total, item) => total + item.file.size, 0);
    if (files.length + newFiles.length > MAX_FILES) {
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
    setFiles((current) => [...current, ...added]);
    for (const item of added) void upload(item);
  };

  const removeFile = (key: string) => setFiles((current) => current.filter((item) => item.key !== key));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className={cn(
          'inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-semibold transition hover:bg-muted/60 focus-within:ring-2 focus-within:ring-ring/50',
          (disabled || files.length >= MAX_FILES) && 'pointer-events-none opacity-50',
        )}>
          <Paperclip className="size-4" /> Adjuntar archivo
          <input
            type="file"
            accept={ACCEPTED}
            multiple
            disabled={disabled || files.length >= MAX_FILES}
            className="sr-only"
            aria-label="Adjuntar archivos a la conversación"
            onChange={(event) => {
              addFiles(event.currentTarget.files);
              event.currentTarget.value = '';
            }}
          />
        </label>
        <span className="text-[11px] text-muted-foreground">Hasta 5 archivos · 10 MB cada uno · 25 MB por mensaje</span>
      </div>

      {selectionError && <p className="text-xs text-destructive" role="alert">{selectionError}</p>}

      {files.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Archivos adjuntos">
          {files.map((item) => (
            <li key={item.key} className="min-w-0 rounded-xl border border-border/70 bg-background/70 p-2.5">
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
}
