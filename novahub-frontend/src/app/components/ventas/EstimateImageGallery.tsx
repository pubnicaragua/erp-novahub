import React, { useRef } from 'react';
import {
  Image as ImageIcon,
  Upload,
  Loader2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Columns3,
  RectangleVertical,
  ExternalLink,
  FileText,
  AlignLeft,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Card, CardContent } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import { cn } from '../ui/utils';
import type {
  EstimateImage,
  ImageGalleryColumns,
  ImageGallerySize,
  EstimateImagesPayload,
} from '../../types';
import { normalizeEstimateImages, isEstimateImageExpired } from '../../types';

export interface EstimateImageGalleryProps {
  images: unknown;
  onChange?: (payload: EstimateImagesPayload) => void;
  onBlur?: () => void;
  onUpload?: (files: FileList | File[]) => Promise<void>;
  uploading?: boolean;
  readOnly?: boolean;
  className?: string;
}

export function EstimateImageGallery({
  images,
  onChange,
  onBlur,
  onUpload,
  uploading = false,
  readOnly = false,
  className,
}: EstimateImageGalleryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const normalized = normalizeEstimateImages(images);

  const emitChange = (nextPayload: EstimateImagesPayload) => {
    if (onChange) {
      onChange(nextPayload);
    }
  };

  // Limpieza inicial si se abren imágenes ya vencidas
  React.useEffect(() => {
    if (readOnly) return;
    const rawList = Array.isArray(images)
      ? images
      : typeof images === 'object' && images !== null && Array.isArray((images as any).items)
        ? (images as any).items
        : [];
    if (rawList.length > 0 && normalized.items.length !== rawList.length) {
      emitChange(normalized);
      if (onBlur) onBlur();
    }
  }, []);

  // Limpieza periódica automática de imágenes temporales (> 5 min)
  React.useEffect(() => {
    if (readOnly) return;
    const interval = setInterval(() => {
      const activeItems = normalized.items.filter((item) => !isEstimateImageExpired(item));
      if (activeItems.length !== normalized.items.length) {
        emitChange({ ...normalized, items: activeItems });
        if (onBlur) onBlur();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [normalized, readOnly]);

  const handleMove = (index: number, direction: 'prev' | 'next') => {
    const targetIndex = direction === 'prev' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= normalized.items.length) return;
    const newItems = [...normalized.items];
    const [moved] = newItems.splice(index, 1);
    newItems.splice(targetIndex, 0, moved);
    const nextPayload = { ...normalized, items: newItems };
    emitChange(nextPayload);
    if (onBlur) onBlur();
  };

  const handleRemove = (id: string) => {
    const newItems = normalized.items.filter((item) => item.id !== id);
    const nextPayload = { ...normalized, items: newItems };
    emitChange(nextPayload);
    if (onBlur) onBlur();
  };

  const handleUpdateItem = (id: string, updates: Partial<EstimateImage>) => {
    const newItems = normalized.items.map((item) => {
      if (item.id !== id) return item;
      const updated = { ...item, ...updates };
      // Preservar caption para retrocompatibilidad
      updated.caption = updated.title || updated.description || item.caption;
      return updated;
    });
    emitChange({ ...normalized, items: newItems });
  };

  const handleUpdateColumns = (cols: ImageGalleryColumns) => {
    emitChange({ ...normalized, columns: cols });
    if (onBlur) onBlur();
  };

  const handleUpdateSize = (size: ImageGallerySize) => {
    emitChange({ ...normalized, size });
    if (onBlur) onBlur();
  };

  const handleToggleFileName = (show: boolean) => {
    emitChange({ ...normalized, showFileName: show });
    if (onBlur) onBlur();
  };


  return (
    <Card className={cn('rounded-2xl border-border/50', className)}>
      <CardContent className="p-4 sm:p-6 space-y-5">
        {/* Barra superior / Cabecera de la galería */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ImageIcon className="size-4" />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-foreground">
                Galería de Imágenes y Renders
              </p>
              {normalized.items.length > 0 && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                  {normalized.items.length} {normalized.items.length === 1 ? 'imagen' : 'imágenes'}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {!readOnly
                ? 'Adjuntá bocetos, fotografías o renders 3D para ilustrar tu propuesta al cliente. Podés configurar el formato deseado para la exportación en PDF.'
                : 'Imágenes y bocetos adjuntos a la cotización.'}
            </p>
          </div>

          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2.5">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0 && onUpload) {
                    void onUpload(e.target.files);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="gap-2 rounded-xl border-dashed border-primary/40 font-bold text-xs text-primary hover:bg-primary/10"
              >
                {uploading ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="size-3.5" /> Adjuntar imágenes
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Toolbar de opciones de exportación PDF (solo en modo edición, no altera la vista web) */}
        {!readOnly && normalized.items.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 p-2.5">
            <div className="flex flex-wrap items-center gap-4">
              {/* Selector de columnas para el PDF */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground shrink-0">
                  Distribución en PDF:
                </span>
                <div className="flex items-center rounded-lg border border-border/60 bg-background/80 p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => handleUpdateColumns(1)}
                    className={cn(
                      'h-6.5 gap-1.5 px-2.5 text-[11px] font-bold rounded-md inline-flex items-center transition-all cursor-pointer',
                      normalized.columns === 1
                        ? 'bg-primary text-primary-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    title="Exportar en PDF a 1 imagen por fila"
                  >
                    <RectangleVertical className="size-3" />
                    <span>1 por fila</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateColumns(2)}
                    className={cn(
                      'h-6.5 gap-1.5 px-2.5 text-[11px] font-bold rounded-md inline-flex items-center transition-all cursor-pointer',
                      normalized.columns === 2
                        ? 'bg-primary text-primary-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    title="Exportar en PDF a 2 imágenes por fila"
                  >
                    <Columns2 className="size-3" />
                    <span>2 por fila</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateColumns(3)}
                    className={cn(
                      'h-6.5 gap-1.5 px-2.5 text-[11px] font-bold rounded-md inline-flex items-center transition-all cursor-pointer',
                      normalized.columns === 3
                        ? 'bg-primary text-primary-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    title="Exportar en PDF a 3 imágenes por fila"
                  >
                    <Columns3 className="size-3" />
                    <span>3 por fila</span>
                  </button>
                </div>
              </div>

              {/* Selector de tamaño para el PDF */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground shrink-0">
                  Tamaño en PDF:
                </span>
                <div className="flex items-center rounded-lg border border-border/60 bg-background/80 p-0.5 shadow-2xs">
                  {(['small', 'medium', 'large'] as ImageGallerySize[]).map((sz) => {
                    const label = sz === 'small' ? 'Pequeña' : sz === 'medium' ? 'Mediana' : 'Grande';
                    const active = normalized.size === sz;
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => handleUpdateSize(sz)}
                        className={cn(
                          'h-6.5 px-2.5 text-[11px] font-bold rounded-md inline-flex items-center transition-all cursor-pointer',
                          active
                            ? 'bg-primary text-primary-foreground shadow-2xs'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Opción para mostrar/ocultar nombre de archivo */}
              <label className="flex items-center gap-2 cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground select-none">
                <Checkbox
                  checked={normalized.showFileName}
                  onCheckedChange={(checked) => handleToggleFileName(Boolean(checked))}
                />
                <span>Mostrar nombre de archivo</span>
              </label>
            </div>
          </div>
        )}

        {/* Contenido de imágenes */}
        {normalized.items.length > 0 ? (
          readOnly ? (
            /* Modo Vista Lectura (Detalle / Side Sheet): Galería de miniaturas sin título ni descripción */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {normalized.items.map((img, idx) => (
                <a
                  key={img.id || idx}
                  href={img.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-background/80 p-1.5 shadow-2xs transition-all hover:border-primary/50 hover:shadow-md hover:scale-[1.02]"
                  title={img.title || img.name || `Imagen ${idx + 1}`}
                >
                  <img
                    src={img.url}
                    alt={img.title || img.name || `Imagen ${idx + 1}`}
                    className="size-full object-contain transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                    onError={() => handleRemove(img.id)}
                  />
                  <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="rounded-full bg-background/90 p-1.5 text-foreground shadow-md">
                      <ExternalLink className="size-3.5" />
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            /* Modo Edición: Tarjetas con alineación perfecta top-to-bottom y baseline idéntica */
            <div className="grid items-start grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {normalized.items.map((img, idx) => (
                <div
                  key={img.id || idx}
                  className="group relative flex flex-col justify-start rounded-2xl border border-border/60 bg-muted/15 p-3.5 sm:p-4 gap-3 transition-all hover:border-border/90 hover:shadow-sm"
                >
                  {/* Cabecera del contenedor: Título en badge dinámico + Reordenar + Eliminar */}
                  <div className="flex items-center justify-between gap-2 h-7 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="inline-block max-w-[180px] sm:max-w-[220px] truncate rounded-md bg-primary px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary-foreground shadow-xs"
                        title={img.title?.trim() || `Imagen ${idx + 1}`}
                      >
                        {img.title?.trim() || `Imagen ${idx + 1}`}
                      </span>
                      {normalized.showFileName && img.name && (
                        <span className="truncate max-w-[100px] sm:max-w-[140px] text-[10px] font-mono text-muted-foreground/80" title={img.name}>
                          {img.name}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Botón mover hacia atrás/arriba */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={idx === 0}
                        onClick={() => handleMove(idx, 'prev')}
                        className="size-6 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        title={normalized.columns === 1 ? 'Mover arriba' : 'Mover a la izquierda'}
                      >
                        <ChevronLeft className="size-3.5" />
                      </Button>
                      {/* Botón mover hacia adelante/abajo */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={idx === normalized.items.length - 1}
                        onClick={() => handleMove(idx, 'next')}
                        className="size-6 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        title={normalized.columns === 1 ? 'Mover abajo' : 'Mover a la derecha'}
                      >
                        <ChevronRight className="size-3.5" />
                      </Button>
                      {/* Botón eliminar */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(img.id)}
                        className="size-6 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600"
                        title="Eliminar imagen"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Marco de visualización de la imagen */}
                  <div className="relative w-full h-44 sm:h-48 rounded-xl border border-border/50 bg-background/90 flex items-center justify-center overflow-hidden p-2 shadow-inner shrink-0">
                    <img
                      src={img.url}
                      alt={img.title || img.name || `Imagen ${idx + 1}`}
                      className="size-full object-contain transition-transform duration-200 group-hover:scale-[1.01]"
                      loading="lazy"
                      onError={() => handleRemove(img.id)}
                    />
                  </div>

                  {/* Línea divisoria sutil */}
                  <div className="h-px w-full bg-border/40 shrink-0" />

                  {/* Información de la imagen: Título y Descripción */}
                  <div className="flex-1 flex flex-col gap-2.5 justify-start">
                    {/* Campo Título */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <FileText className="size-3 text-primary" />
                        <span>Título</span>
                      </label>
                      <Input
                        value={img.title || ''}
                        placeholder="Ej: Vista frontal, Render sala principal..."
                        onChange={(e) => handleUpdateItem(img.id, { title: e.target.value })}
                        onBlur={() => onBlur?.()}
                        className="h-8 text-xs font-semibold bg-background"
                      />
                    </div>

                    {/* Campo Descripción */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <AlignLeft className="size-3 text-primary" />
                        <span>Descripción</span>
                      </label>
                      <Textarea
                        value={img.description || ''}
                        placeholder="Ejemplo de descripción de la imagen..."
                        onChange={(e) => handleUpdateItem(img.id, { description: e.target.value })}
                        onBlur={() => onBlur?.()}
                        rows={2}
                        className="text-xs bg-background resize-none min-h-[52px]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Estado vacío */
          <div
            onClick={() => !readOnly && fileInputRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/10 p-8 text-center transition-colors',
              !readOnly ? 'cursor-pointer hover:bg-muted/20' : 'cursor-default'
            )}
          >
            <div className="rounded-full bg-primary/10 p-3.5 text-primary mb-2.5">
              <ImageIcon className="size-6" />
            </div>
            <p className="text-xs font-bold text-foreground">No hay imágenes adjuntas a esta cotización</p>
            <p className="mt-1 text-[11px] text-muted-foreground max-w-sm">
              {!readOnly
                ? 'Haz clic aquí o en "Adjuntar imágenes" para agregar fotografías, bocetos o renders 3D (PNG, JPG, WEBP).'
                : 'Esta cotización no incluye imágenes o renders anexos.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
