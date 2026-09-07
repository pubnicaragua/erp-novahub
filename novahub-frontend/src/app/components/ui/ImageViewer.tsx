import { useState } from 'react';
import { Download, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './button';
import { Dialog, DialogContent, DialogTitle } from './dialog';

interface ImageViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src?: string | null;
  alt: string;
  title?: string;
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function createDownloadName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'imagen';
}

export function ImageViewer({ open, onOpenChange, src, alt, title }: ImageViewerProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!src || downloading) return;

    setDownloading(true);
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error('No se pudo obtener la imagen');

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const extension = IMAGE_EXTENSIONS[blob.type] || 'jpg';

      anchor.href = objectUrl;
      anchor.download = `${createDownloadName(title || alt)}.${extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      toast.success('Imagen descargada');
    } catch {
      toast.error('No se pudo descargar la imagen. Inténtalo nuevamente.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!flex !w-fit !max-w-[calc(100vw-1rem)] !max-h-[calc(100dvh-1rem)] gap-0 overflow-y-auto rounded-3xl border-border/60 bg-background/95 p-0 text-foreground shadow-2xl backdrop-blur-xl [&>button:last-child]:hidden"
      >
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border/60 bg-card/95 px-4 py-3 sm:px-5">
          <DialogTitle className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm font-bold text-foreground sm:text-base">
            <ImageIcon className="size-4 shrink-0 text-primary" />
            <span className="truncate">{title || alt}</span>
          </DialogTitle>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={handleDownload}
              disabled={!src || downloading}
              aria-label="Descargar imagen"
              title="Descargar imagen"
            >
              {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => onOpenChange(false)}
              aria-label="Cerrar visor de imagen"
              title="Cerrar"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-center bg-muted/30 p-3 sm:p-4">
          {src ? (
            <div className="flex min-w-0 max-w-full items-center justify-center rounded-[1.5rem] border border-border/70 bg-card p-2 shadow-2xl sm:p-3">
              <img
                src={src}
                alt={alt}
                draggable={false}
                className="block h-auto max-h-[min(68dvh,680px)] max-w-[calc(100vw-2rem)] rounded-xl object-contain"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-12 py-16 text-center text-muted-foreground">
              <ImageIcon className="size-10" />
              <p className="text-sm font-semibold">No hay una imagen disponible.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
