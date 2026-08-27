import JSZip from 'jszip';
import { createExtractorFromData } from 'node-unrar-js/esm/index.esm.js';
import rarWasmUrl from 'node-unrar-js/esm/js/unrar.wasm?url';

export const PRODUCT_IMAGE_EXTENSIONS = /\.(jpe?g|png)$/i;
export const PRODUCT_IMAGE_ARCHIVE_EXTENSIONS = /\.(zip|rar)$/i;

const productImageFileNameFromPath = (value: string) => value.split(/[\\/]/).pop() || '';

/** Normaliza el nombre de archivo y el SKU para que la asociación no dependa
 * de mayúsculas, acentos, espacios, guiones o carpetas del ZIP/RAR. */
export const productImageKey = (value: string) => productImageFileNameFromPath(value)
  .replace(PRODUCT_IMAGE_EXTENSIONS, '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLowerCase()
  .trim();

const productImageSkuFromPath = (path: string) => {
  const fileName = path.split(/[\\/]/).pop() || '';
  return productImageKey(fileName);
};

const productImageFileFromBytes = (path: string, bytes: BlobPart | Uint8Array) => {
  const fileName = path.split(/[\\/]/).pop() || 'imagen';
  return new File([bytes as BlobPart], fileName, {
    type: /\.png$/i.test(fileName) ? 'image/png' : 'image/jpeg',
  });
};

/** Extrae imágenes JPG/PNG de un ZIP o RAR y las indexa por nombre de SKU. */
export const extractProductImageArchive = async (
  file: File,
  onProgress?: (completed: number, total: number) => void,
): Promise<Map<string, File>> => {
  if (!PRODUCT_IMAGE_ARCHIVE_EXTENSIONS.test(file.name)) {
    throw new Error('Selecciona un archivo ZIP o RAR válido');
  }

  const entries = new Map<string, File>();
  if (/\.zip$/i.test(file.name)) {
    const zip = await JSZip.loadAsync(file);
    const files = Object.values(zip.files).filter((entry) => !entry.dir && PRODUCT_IMAGE_EXTENSIONS.test(entry.name));
    let completed = 0;
    onProgress?.(0, files.length);
    // JSZip descomprime de forma asíncrona. Procesar varias entradas en
    // paralelo reduce mucho el tiempo de espera del archivo de imágenes sin
    // montar todas las imágenes a la vez ni bloquear la interfaz con un loop
    // secuencial de cientos de archivos.
    const concurrency = Math.min(6, Math.max(1, files.length));
    let nextIndex = 0;
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (true) {
        const index = nextIndex++;
        const entry = files[index];
        if (!entry) return;
        const sku = productImageSkuFromPath(entry.name);
        if (sku) {
          const blob = await entry.async('blob');
          entries.set(sku, productImageFileFromBytes(entry.name, blob));
        }
        completed += 1;
        onProgress?.(completed, files.length);
      }
    }));
    return entries;
  }

  const [archiveData, wasmResponse] = await Promise.all([
    file.arrayBuffer(),
    fetch(rarWasmUrl),
  ]);
  if (!wasmResponse.ok) throw new Error('No se pudo cargar el extractor RAR');
  const wasmBinary = await wasmResponse.arrayBuffer();
  const extractor = await createExtractorFromData({ data: archiveData, wasmBinary });
  const fileHeaders = [...extractor.getFileList().fileHeaders]
    .filter((header) => !header.flags.directory && PRODUCT_IMAGE_EXTENSIONS.test(header.name));
  const extracted = [...extractor.extract({ files: fileHeaders.map((header) => header.name) }).files];
  onProgress?.(0, extracted.length);
  extracted.forEach((item, index) => {
    if (item.extraction) {
      const sku = productImageSkuFromPath(item.fileHeader.name);
      if (sku) entries.set(sku, productImageFileFromBytes(item.fileHeader.name, item.extraction));
    }
    onProgress?.(index + 1, extracted.length);
  });
  return entries;
};
