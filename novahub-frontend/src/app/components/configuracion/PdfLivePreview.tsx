import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Maximize2, Minimize2, Save, WandSparkles, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type PdfLivePreviewProps = {
  sourceUrl: string;
  title: string;
  isGenerating?: boolean;
  error?: string;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  onHelp?: () => void;
  onSave?: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
  isSaving?: boolean;
};

export function PdfLivePreview({ sourceUrl, title, isGenerating = false, error = '', isExpanded = false, onToggleExpanded, onHelp, onSave, saveLabel = 'Guardar', saveDisabled = false, isSaving = false }: PdfLivePreviewProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [viewerError, setViewerError] = useState('');

  useEffect(() => {
    if (!viewportRef.current) return;
    const observer = new ResizeObserver(entries => {
      const width = Math.floor(entries[0]?.contentRect.width || 0);
      setViewportWidth(width);
    });
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: ReturnType<typeof pdfjsLib.getDocument> | undefined;
    setPdf(null);
    setPageNumber(1);
    setViewerError('');
    if (!sourceUrl) return;

    setIsLoading(true);
    loadingTask = pdfjsLib.getDocument({ url: sourceUrl });
    void loadingTask.promise.then(document => {
      if (cancelled) {
        void document.destroy();
        return;
      }
      setPdf(document);
      setIsLoading(false);
    }).catch((reason: unknown) => {
      if (cancelled) return;
      setViewerError(reason instanceof Error ? reason.message : 'No se pudo abrir el PDF de vista previa.');
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
      if (loadingTask) void loadingTask.destroy().catch(() => undefined);
    };
  }, [sourceUrl]);

  useEffect(() => {
    if (!pdf || !canvasRef.current || viewportWidth < 32) return;
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    const canvas = canvasRef.current;

    const drawPage = async () => {
      setIsDrawing(true);
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        if (viewportRef.current) {
          viewportRef.current.scrollTop = 0;
          viewportRef.current.scrollLeft = 0;
        }
        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(1, viewportWidth - 8);
        const fitScale = availableWidth / baseViewport.width;
        const viewport = page.getViewport({ scale: fitScale * zoomPercent / 100 });
        const outputScale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('El navegador no pudo preparar el lienzo del PDF.');

        canvas.width = Math.ceil(viewport.width * outputScale);
        canvas.height = Math.ceil(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        renderTask = page.render({
          canvasContext: context,
          viewport,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
        });
        await renderTask.promise;
      } catch (reason) {
        if (!cancelled && !(reason instanceof Error && reason.name === 'RenderingCancelledException')) {
          setViewerError(reason instanceof Error ? reason.message : 'No se pudo dibujar la página del PDF.');
        }
      } finally {
        if (!cancelled) setIsDrawing(false);
      }
    };

    void drawPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNumber, zoomPercent, viewportWidth]);

  useEffect(() => () => {
    if (pdf) void pdf.destroy();
  }, [pdf]);

  const pageCount = pdf?.numPages || 0;
  const busy = isGenerating || isLoading || isDrawing;

  return <div className="flex min-h-0 flex-1 flex-col gap-2">
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-card px-2 py-1.5">
      <div className="flex items-center gap-1" aria-label="Navegación de páginas">
        <Button type="button" variant="ghost" size="icon" className="size-8 cursor-pointer" title="Página anterior" aria-label="Página anterior" onClick={() => setPageNumber(value => Math.max(1, value - 1))} disabled={pageNumber <= 1 || !pageCount}><ChevronLeft className="size-4" /></Button>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="sr-only">Página actual</span><input type="number" min={1} max={pageCount || 1} value={pageNumber} onChange={event => setPageNumber(Math.min(pageCount || 1, Math.max(1, Number(event.target.value) || 1)))} className="h-7 w-12 rounded-md border border-input bg-background px-1 text-center text-xs text-foreground" aria-label="Número de página" disabled={!pageCount} /><span>de {pageCount || '—'}</span></label>
        <Button type="button" variant="ghost" size="icon" className="size-8 cursor-pointer" title="Página siguiente" aria-label="Página siguiente" onClick={() => setPageNumber(value => Math.min(pageCount, value + 1))} disabled={pageNumber >= pageCount || !pageCount}><ChevronRight className="size-4" /></Button>
      </div>
      <div className="flex max-w-full flex-wrap items-center justify-end gap-1">
        <Button type="button" variant="ghost" size="icon" className="size-8 cursor-pointer" title="Alejar" aria-label="Alejar" onClick={() => setZoomPercent(value => Math.max(60, value - 10))} disabled={zoomPercent <= 60}><ZoomOut className="size-4" /></Button>
        <span className="min-w-12 text-center text-xs tabular-nums text-muted-foreground">{zoomPercent}%</span>
        <Button type="button" variant="ghost" size="icon" className="size-8 cursor-pointer" title="Acercar" aria-label="Acercar" onClick={() => setZoomPercent(value => Math.min(180, value + 10))} disabled={zoomPercent >= 180}><ZoomIn className="size-4" /></Button>
        <Button type="button" variant="outline" size="sm" className="ml-1 h-8 cursor-pointer px-2" title="Ajustar al ancho" onClick={() => setZoomPercent(100)}>Ajustar</Button>
        {onHelp && <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5 px-2" onClick={onHelp} aria-label="Cómo configurar documentos PDF"><WandSparkles className="size-3.5" /><span>Ayuda</span></Button>}
        {onSave && <Button type="button" size="sm" className="h-8 cursor-pointer gap-1.5 px-2" data-tour="pdf-save" onClick={onSave} disabled={saveDisabled || isSaving}>{isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}<span>{saveLabel}</span></Button>}
        {onToggleExpanded && <Button type="button" variant="outline" size="sm" className="h-8 cursor-pointer gap-1.5 px-2" title={isExpanded ? 'Volver a mostrar configuraciones' : 'Ampliar documento'} onClick={onToggleExpanded}>{isExpanded ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}<span>{isExpanded ? 'Volver' : 'Ampliar'}</span></Button>}
      </div>
    </div>

    <div ref={viewportRef} className="relative min-h-[480px] min-w-0 flex-1 overflow-auto rounded-xl border border-border/50 bg-muted/50 p-3 sm:p-5 xl:min-h-0" aria-label={`Documento PDF: ${title}`}>
      <div className="mx-auto w-fit max-w-none overflow-hidden bg-white shadow-lg ring-1 ring-black/10">
        <canvas ref={canvasRef} className={cn('block', !pdf && 'hidden')} aria-label={`Página ${pageNumber} de ${title}`} />
      </div>
      {!pdf && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">{busy ? <span className="flex items-center gap-2"><Loader2 className="size-5 animate-spin text-primary" />Preparando página del PDF…</span> : 'La vista previa aparecerá aquí.'}</div>}
      {busy && pdf && <div className="absolute right-3 top-3 rounded-full border border-border/60 bg-card/95 px-3 py-1 text-[11px] text-muted-foreground shadow-sm" role="status"><Loader2 className="mr-1 inline size-3 animate-spin" />Actualizando…</div>}
      {(error || viewerError) && <div className="absolute inset-x-3 bottom-3 rounded-lg border border-destructive/30 bg-card/95 p-3 text-xs text-destructive shadow-sm" role="alert">{error || viewerError}</div>}
    </div>

    <div className="flex shrink-0 items-center justify-between gap-2 px-1 text-[10px] text-muted-foreground"><span>PDF de muestra · página {pageNumber} de {pageCount || '—'}</span>{sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary underline-offset-2 hover:underline"><ExternalLink className="size-3" />Abrir PDF</a>}</div>
  </div>;
}
