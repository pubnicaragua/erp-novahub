export type SpreadsheetRows = { sheetName?: string; rows: any[][]; sheets?: Record<string, any[][]> };
export type SpreadsheetProgress = (progress: number) => void;

/** Parses Excel/CSV off the UI thread so large imports keep the page responsive. */
export function parseSpreadsheetInWorker(file: File, preferredSheet?: string, allSheets = false, onProgress?: SpreadsheetProgress): Promise<SpreadsheetRows> {
  return new Promise((resolve, reject) => {
    onProgress?.(3);
    const worker = new Worker(new URL('./import-spreadsheet.worker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => worker.terminate();
    worker.onmessage = (event: MessageEvent<{ ok: boolean; type?: 'progress'; progress?: number; message?: string; sheetName?: string; rows?: any[][]; sheets?: Record<string, any[][]> }>) => {
      if (event.data.type === 'progress') {
        onProgress?.(Math.max(0, Math.min(100, Number(event.data.progress) || 0)));
        return;
      }
      cleanup();
      if (!event.data.ok) {
        reject(new Error(event.data.message || 'No se pudo leer el archivo'));
        return;
      }
      resolve({ sheetName: event.data.sheetName, rows: event.data.rows || [], sheets: event.data.sheets });
    };
    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || 'No se pudo procesar el archivo en segundo plano'));
    };
    file.arrayBuffer()
      .then((buffer) => {
        onProgress?.(12);
        worker.postMessage({ buffer, preferredSheet, allSheets }, [buffer]);
      })
      .catch((error) => {
        cleanup();
        reject(error);
      });
  });
}
