const MB = 1024 * 1024;

/** Maximum original image accepted before client-side processing. */
export const MAX_SOURCE_IMAGE_BYTES = 10 * MB;

/** Target size for images stored in Supabase Storage. */
export const MAX_OPTIMIZED_IMAGE_BYTES = Math.round(1.5 * MB);

const DEFAULT_MAX_DIMENSION = 2048;
const QUALITY_STEPS = [0.84, 0.72, 0.6, 0.5, 0.4];

type ImageOptimizationOptions = {
  maxInputBytes?: number;
  maxOutputBytes?: number;
  maxDimension?: number;
};

function replaceExtension(fileName: string, extension: string) {
  const baseName = fileName.replace(/\.[^/.]+$/, '') || 'imagen';
  return `${baseName}.${extension}`;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`No se pudo leer la imagen “${file.name}”.`));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

async function encode(canvas: HTMLCanvasElement, quality: number) {
  const webp = await canvasToBlob(canvas, 'image/webp', quality);
  if (webp) return { blob: webp, mimeType: 'image/webp' };

  const jpeg = await canvasToBlob(canvas, 'image/jpeg', quality);
  return jpeg ? { blob: jpeg, mimeType: 'image/jpeg' } : null;
}

/**
 * Compresses only when needed. Small images keep their original format and
 * quality; larger images are resized and encoded as WebP (JPEG fallback).
 * This is intentionally client-side to avoid sending the original payload
 * through the API and to reduce Supabase egress/storage consumption.
 */
export async function optimizeImageFile(
  file: File,
  options: ImageOptimizationOptions = {},
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  const maxInputBytes = options.maxInputBytes ?? MAX_SOURCE_IMAGE_BYTES;
  const maxOutputBytes = options.maxOutputBytes ?? MAX_OPTIMIZED_IMAGE_BYTES;
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;

  if (file.size === 0) throw new Error(`La imagen “${file.name}” está vacía.`);
  if (file.size > maxInputBytes) {
    throw new Error(`La imagen original no puede superar ${Math.round(maxInputBytes / MB)} MB.`);
  }
  if (file.size <= maxOutputBytes) return file;

  const image = await loadImage(file);
  const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (!largestSide) throw new Error(`La imagen “${file.name}” no tiene dimensiones válidas.`);

  let scale = Math.min(1, maxDimension / largestSide);
  let width = Math.max(1, Math.round(image.naturalWidth * scale));
  let height = Math.max(1, Math.round(image.naturalHeight * scale));
  let best: { blob: Blob; mimeType: string } | null = null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('El navegador no pudo preparar la imagen.');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, width, height);

    for (const quality of QUALITY_STEPS) {
      const encoded = await encode(canvas, quality);
      if (!encoded) continue;
      best = encoded;
      if (encoded.blob.size <= maxOutputBytes) {
        const extension = encoded.mimeType === 'image/webp' ? 'webp' : 'jpg';
        return new File([encoded.blob], replaceExtension(file.name, extension), {
          type: encoded.mimeType,
          lastModified: Date.now(),
        });
      }
    }

    scale *= 0.8;
    width = Math.max(320, Math.round(image.naturalWidth * scale));
    height = Math.max(320, Math.round(image.naturalHeight * scale));
  }

  if (!best || best.blob.size > maxOutputBytes) {
    throw new Error(`No se pudo optimizar “${file.name}” por debajo de ${Math.round(maxOutputBytes / 1024)} KB.`);
  }

  const extension = best.mimeType === 'image/webp' ? 'webp' : 'jpg';
  return new File([best.blob], replaceExtension(file.name, extension), {
    type: best.mimeType,
    lastModified: Date.now(),
  });
}
