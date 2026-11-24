/**
 * Reduce fotos y capturas pesadas antes de subirlas: WhatsApp de todos modos las recomprime al entregarlas, así que enviar
 * un PNG de varios megas solo gasta datos y tiempo. No toca GIF, stickers ni imágenes pequeñas.
 */
export async function optimizeImage(file: File, maxSide = 2000, quality = 0.85, minBytes = 700 * 1024): Promise<File> {
  if (!/^image\/(png|jpeg)$/.test(file.type) || file.size < minBytes || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close?.(); return file; }
    ctx.fillStyle = '#ffffff'; // el JPEG no tiene transparencia
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'imagen'}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
