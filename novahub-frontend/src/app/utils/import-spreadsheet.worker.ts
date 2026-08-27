import * as XLSX from 'xlsx';

const normalizeSheetName = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '')
  .trim();

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<{ buffer: ArrayBuffer; preferredSheet?: string; allSheets?: boolean }>) => void) | null;
  postMessage: (message: unknown) => void;
};

const reportProgress = (progress: number) => workerScope.postMessage({ type: 'progress', progress });

const ROW_CHUNK_SIZE = 1000;

/**
 * Converts a worksheet in small ranges so the worker can report real progress
 * while large files are being normalized. The UI remains responsive because
 * parsing is already off the main thread, and the chunks avoid one opaque
 * sheet_to_json call for tens of thousands of rows.
 */
const sheetToRows = (worksheet: XLSX.WorkSheet, onProgress: (fraction: number) => void) => {
  const reference = worksheet['!ref'];
  if (!reference) return [] as any[][];

  const range = XLSX.utils.decode_range(reference);
  const totalRows = Math.max(1, range.e.r - range.s.r + 1);
  const rows: any[][] = [];

  for (let startRow = range.s.r; startRow <= range.e.r; startRow += ROW_CHUNK_SIZE) {
    const endRow = Math.min(range.e.r, startRow + ROW_CHUNK_SIZE - 1);
    const chunk = XLSX.utils.sheet_to_json<any[]>(worksheet, {
      header: 1,
      defval: '',
      range: {
        s: { r: startRow, c: range.s.c },
        e: { r: endRow, c: range.e.c },
      },
    });
    rows.push(...chunk);
    onProgress(Math.min(1, (endRow - range.s.r + 1) / totalRows));
  }

  return rows;
};

workerScope.onmessage = (event) => {
  try {
    reportProgress(25);
    const workbook = XLSX.read(new Uint8Array(event.data.buffer), { type: 'array', cellDates: true });
    const preferred = normalizeSheetName(event.data.preferredSheet);
    const sheetName = preferred
      ? workbook.SheetNames.find((name) => normalizeSheetName(name) === preferred) || workbook.SheetNames[0]
      : workbook.SheetNames[0];
    const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
    const sheetNames = event.data.allSheets ? workbook.SheetNames : (sheetName ? [sheetName] : []);
    const totalSheets = Math.max(1, sheetNames.length);
    const parsedSheets: Record<string, any[][]> = {};
    sheetNames.forEach((name, index) => {
      const worksheet = workbook.Sheets[name];
      parsedSheets[name] = sheetToRows(worksheet, (fraction) => {
        const completedSheets = index + fraction;
        reportProgress(42 + Math.round((completedSheets / totalSheets) * 48));
      });
    });
    const rows = sheetName ? parsedSheets[sheetName] || [] : [];
    const sheets = event.data.allSheets ? parsedSheets : undefined;
    reportProgress(96);
    workerScope.postMessage({ ok: true, sheetName, rows, sheets });
  } catch (error: any) {
    workerScope.postMessage({ ok: false, message: error?.message || 'No se pudo leer el archivo' });
  }
};
