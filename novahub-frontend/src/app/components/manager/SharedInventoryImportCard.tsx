import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertTriangle, Boxes, CheckCircle2, Download, FileUp, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { VirtualizedImportList } from '../ui/VirtualizedImportList';
import { ImportProgressOverlay } from '../ui/ImportProgressOverlay';
import { parseSpreadsheetInWorker } from '../../utils/import-spreadsheet';

export type SharedInventoryImportRow = {
  code: string;
  stock: number | string;
  salePrice: number | string;
  costPrice: number | string;
};

type BranchOption = { id: string; name: string; businessUnitId?: string | null };
type PriceMode = 'SAME' | 'BY_BRANCH';

type SharedInventoryImportCardProps = {
  branches: BranchOption[];
  sourceBranchId: string;
  setSourceBranchId: (value: string) => void;
  branchIds: string[];
  setBranchIds: (value: string[]) => void;
  rows: SharedInventoryImportRow[];
  setRows: (value: SharedInventoryImportRow[]) => void;
  fileName: string;
  setFileName: (value: string) => void;
  priceMode: PriceMode;
  setPriceMode: (value: PriceMode) => void;
  pricesByBranch: Record<string, Record<string, string>>;
  setPricesByBranch: (value: Record<string, Record<string, string>>) => void;
  onImport: () => void;
  importing: boolean;
};

const TEMPLATE_HEADERS = ['Código', 'Stock', 'Precio de venta', 'Costo'];

const normalizeHeader = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const normalizeNumber = (value: unknown) => {
  const raw = String(value ?? '').trim().replace(/\s/g, '');
  if (!raw) return '';
  const normalized = raw.includes(',') && !raw.includes('.') ? raw.replace(',', '.') : raw.replace(/,/g, '');
  return Number(normalized);
};

function readCell(row: Record<string, unknown>, aliases: string[]) {
  const aliasSet = new Set(aliases.map(normalizeHeader));
  const entry = Object.entries(row).find(([key]) => aliasSet.has(normalizeHeader(key)));
  return entry?.[1] ?? '';
}

function parseRows(rawRows: Array<Record<string, unknown>>) {
  const errors: string[] = [];
  const parsed: SharedInventoryImportRow[] = [];
  rawRows.forEach((row, index) => {
    const code = String(readCell(row, ['Código', 'Codigo', 'code', 'SKU', 'sku'])).trim();
    const stockValue = normalizeNumber(readCell(row, ['Stock', 'Cantidad', 'quantity']));
    const salePriceValue = normalizeNumber(readCell(row, ['Precio de venta', 'Precio', 'salePrice', 'precio_venta']));
    const costPriceValue = normalizeNumber(readCell(row, ['Costo', 'Costo unitario', 'costPrice', 'costo']));
    const isBlank = !code && stockValue === '' && salePriceValue === '' && costPriceValue === '';
    if (isBlank) return;
    const rowLabel = `Fila ${index + 2}`;
    if (!code) errors.push(`${rowLabel}: falta el código del producto`);
    if (stockValue === '' || !Number.isFinite(Number(stockValue)) || Number(stockValue) < 0) errors.push(`${rowLabel}: el stock debe ser un número mayor o igual a cero`);
    if (salePriceValue !== '' && (!Number.isFinite(Number(salePriceValue)) || Number(salePriceValue) < 0)) errors.push(`${rowLabel}: el precio de venta no es válido`);
    if (costPriceValue !== '' && (!Number.isFinite(Number(costPriceValue)) || Number(costPriceValue) < 0)) errors.push(`${rowLabel}: el costo no es válido`);
    parsed.push({ code, stock: stockValue, salePrice: salePriceValue, costPrice: costPriceValue });
  });
  const seen = new Set<string>();
  parsed.forEach((row, index) => {
    const key = row.code.toLowerCase();
    if (key && seen.has(key)) errors.push(`Fila ${index + 2}: el código ${row.code} está repetido`);
    seen.add(key);
  });
  return { parsed, errors };
}

function matrixToObjects(raw: any[][]): Record<string, unknown>[] {
  const nonEmpty = raw.filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== ''));
  if (nonEmpty.length < 2) return [];
  const headers = nonEmpty[0].map((header) => String(header ?? '').trim());
  return nonEmpty.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

export function SharedInventoryImportCard({
  branches,
  sourceBranchId,
  setSourceBranchId,
  branchIds,
  setBranchIds,
  rows,
  setRows,
  fileName,
  setFileName,
  priceMode,
  setPriceMode,
  pricesByBranch,
  setPricesByBranch,
  onImport,
  importing,
}: SharedInventoryImportCardProps) {
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [readingFile, setReadingFile] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const source = branches.find((branch) => branch.id === sourceBranchId);
  const targetBranches = useMemo(
    () => branches.filter((branch) => Boolean(source?.businessUnitId) && branch.businessUnitId === source?.businessUnitId),
    [branches, source?.businessUnitId],
  );
  const selectedBranches = targetBranches.filter((branch) => branchIds.includes(branch.id));

  const downloadTemplate = () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Inventario');
    const instructions = XLSX.utils.aoa_to_sheet([
      ['INSTRUCCIONES - INVENTARIO COMPARTIDO'],
      ['Código', 'Debe coincidir con el código del producto en la sucursal de origen.'],
      ['Stock', 'Cantidad final que quedará en cada sucursal seleccionada. Use cero para dejarlo en cero.'],
      ['Precio de venta', 'Opcional. Si queda vacío, se conserva el precio del catálogo maestro.'],
      ['Costo', 'Opcional. Actualiza el costo unitario del producto.'],
      ['Nota', 'No cambie los nombres de las columnas de la hoja Inventario.'],
    ]);
    XLSX.utils.book_append_sheet(workbook, instructions, 'Instrucciones');
    XLSX.writeFile(workbook, 'plantilla-inventario-compartido.xlsx');
    toast.success('Plantilla Excel descargada');
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setReadingFile(true);
    setReadingProgress(3);
    try {
      const { rows: raw } = await parseSpreadsheetInWorker(file, undefined, false, (progress) => {
        setReadingProgress(Math.min(84, Math.max(3, progress)));
      });
      setReadingProgress(88);
      const rawRows = matrixToObjects(raw);
      const result = parseRows(rawRows);
      setRows(result.parsed);
      setFileName(file.name);
      setValidationErrors(result.errors);
      setReadingProgress(100);
      if (!result.parsed.length) toast.error('La plantilla no contiene filas para importar');
      else if (result.errors.length) toast.error(`Revisa ${result.errors.length} observación(es) antes de importar`);
      else toast.success(`${result.parsed.length} producto(s) listos para importar`);
    } catch (error) {
      setRows([]);
      setFileName('');
      setValidationErrors([]);
      toast.error(error instanceof Error ? error.message : 'No se pudo leer la plantilla');
    } finally {
      setReadingFile(false);
      setReadingProgress(0);
    }
  };

  const toggleBranch = (id: string) => setBranchIds(branchIds.includes(id) ? branchIds.filter((value) => value !== id) : [...branchIds, id]);
  const updateBranchPrice = (branchId: string, code: string, value: string) => setPricesByBranch({ ...pricesByBranch, [branchId]: { ...(pricesByBranch[branchId] || {}), [code]: value } });

  return (
    <Card className="overflow-hidden rounded-3xl border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-card shadow-sm">
      <CardHeader className="border-b border-primary/10 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic tracking-tight"><UploadCloud className="size-5 text-primary" /> Cargar inventario por Excel</CardTitle>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Usa la plantilla oficial para replicar productos y stock desde una sucursal hacia una o varias sucursales del mismo rubro.</p>
          </div>
          <Button type="button" variant="outline" className="shrink-0 rounded-xl border-primary/30 font-bold" onClick={downloadTemplate}><Download className="mr-2 size-4 text-primary" /> Descargar plantilla</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-4 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1.2fr]">
          <label className="space-y-1.5 text-xs font-black uppercase tracking-widest text-muted-foreground">
            <span>Sucursal de origen</span>
            <select value={sourceBranchId} onChange={(event) => { setSourceBranchId(event.target.value); setBranchIds([]); setValidationErrors([]); }} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal normal-case tracking-normal outline-none focus:border-primary">
              <option value="">Seleccionar sucursal</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-black uppercase tracking-widest text-muted-foreground">
            <span>Tratamiento del precio</span>
            <select value={priceMode} onChange={(event) => setPriceMode(event.target.value as PriceMode)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal normal-case tracking-normal outline-none focus:border-primary">
              <option value="SAME">Usar precio de la plantilla</option>
              <option value="BY_BRANCH">Definir precio por sucursal</option>
            </select>
          </label>
          <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/[0.04] px-3 text-center text-sm font-bold transition-colors hover:bg-primary/[0.09]">
            <FileUp className="size-4 text-primary" />
            <span className="min-w-0 truncate">{fileName || 'Seleccionar plantilla Excel'}</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="sr-only" />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sucursales destino</p>
              <Badge variant="outline" className="text-[10px]">{selectedBranches.length} seleccionada(s)</Badge>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {targetBranches.map((branch) => {
                const checked = branchIds.includes(branch.id);
                const isSource = branch.id === sourceBranchId;
                return <label key={branch.id} className={`flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border p-2.5 text-sm transition-colors ${checked ? 'border-primary/40 bg-primary/[0.07]' : 'border-border/50 hover:bg-muted/50'}`}><input type="checkbox" checked={checked} onChange={() => toggleBranch(branch.id)} className="size-4 shrink-0 accent-primary" /><span className="min-w-0 truncate font-semibold">{branch.name}</span>{isSource && <span className="ml-auto shrink-0 text-[9px] font-black uppercase text-primary">Origen</span>}</label>;
              })}
              {!source && <p className="text-xs text-muted-foreground">Selecciona primero la sucursal de origen.</p>}
              {source && !targetBranches.length && <p className="text-xs text-amber-600">La sucursal de origen no tiene rubro configurado.</p>}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">Solo aparecen sucursales del mismo rubro. La bodega propia se resuelve automáticamente en cada sucursal.</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado de la plantilla</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
              <div className="rounded-xl bg-muted/40 p-3"><p className="text-[10px] text-muted-foreground">Filas válidas</p><p className="mt-1 text-xl font-black">{validationErrors.length ? Math.max(0, rows.length - validationErrors.length) : rows.length}</p></div>
              <div className={`rounded-xl p-3 ${validationErrors.length ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}><p className="text-[10px] text-muted-foreground">Observaciones</p><p className={`mt-1 text-xl font-black ${validationErrors.length ? 'text-amber-600' : 'text-emerald-600'}`}>{validationErrors.length}</p></div>
              <div className="rounded-xl bg-primary/10 p-3"><p className="text-[10px] text-muted-foreground">Destinos</p><p className="mt-1 text-xl font-black text-primary">{selectedBranches.length}</p></div>
            </div>
          </div>
        </div>

        {validationErrors.length > 0 && <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-3 text-xs text-amber-700 dark:text-amber-300"><p className="flex items-center gap-2 font-black uppercase tracking-widest"><AlertTriangle className="size-4" /> Corrige la plantilla antes de importar</p><ul className="mt-2 grid gap-1 sm:grid-cols-2">{validationErrors.slice(0, 8).map((error) => <li key={error}>• {error}</li>)}</ul>{validationErrors.length > 8 && <p className="mt-1">Y {validationErrors.length - 8} observación(es) más.</p>}</div>}

        {priceMode === 'BY_BRANCH' && rows.length > 0 && selectedBranches.length > 0 && <div className="min-w-0 max-w-full overflow-x-auto rounded-2xl border border-border/60 p-4 scrollbar-overlay"><div className="flex items-center gap-2"><Boxes className="size-4 text-primary" /><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Precios por sucursal · {rows.length} filas</p></div><VirtualizedImportList count={rows.length} estimateSize={46} className="mt-3 h-64 min-w-[620px]" renderItem={(index) => { const row = rows[index]; return <div className="grid grid-cols-[minmax(150px,1fr)_repeat(auto-fit,minmax(150px,1fr))] items-center gap-2 border-b border-border/30 py-1 text-xs"><span className="truncate font-mono">{row.code}</span>{selectedBranches.map((branch) => <Input key={branch.id} type="number" min="0" step="0.01" value={pricesByBranch[branch.id]?.[row.code] || ''} onChange={(event) => updateBranchPrice(branch.id, row.code, event.target.value)} placeholder={branch.name} className="h-9 min-w-0" />)}</div>; }} /></div>}

        {rows.length > 0 && <div data-import-preview-horizontal-scroller="true" className="min-w-0 max-w-full overflow-x-auto rounded-2xl border border-border/60 scrollbar-overlay"><div className="grid min-w-[620px] grid-cols-[minmax(180px,1fr)_repeat(3,minmax(120px,1fr))] gap-3 border-b border-border/50 bg-muted/30 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><span>Código</span><span>Stock final</span><span>Precio venta</span><span>Costo</span></div><VirtualizedImportList count={rows.length} estimateSize={38} className="h-64 min-w-[620px]" renderItem={(index) => { const row = rows[index]; return <div className="grid grid-cols-[minmax(180px,1fr)_repeat(3,minmax(120px,1fr))] gap-3 border-b border-border/30 px-3 py-2 text-xs"><span className="truncate font-mono font-semibold">{row.code || '—'}</span><span>{String(row.stock || 0)}</span><span>{row.salePrice === '' ? 'Catálogo' : String(row.salePrice)}</span><span>{row.costPrice === '' ? 'Conservar' : String(row.costPrice)}</span></div>; }} /><div className="flex items-center gap-2 border-t border-border/50 px-3 py-2 text-xs text-muted-foreground"><CheckCircle2 className="size-3.5 text-emerald-600" /> Vista previa completa de {rows.length} fila(s). La operación se ejecuta de forma atómica.</div></div>}

      <Button type="button" className="w-full rounded-xl font-black" disabled={!sourceBranchId || !branchIds.length || !rows.length || validationErrors.length > 0 || importing || readingFile} onClick={onImport}><UploadCloud className="mr-2 size-4" />{importing ? 'Aplicando inventario…' : 'Aplicar a sucursales seleccionadas'}</Button>
      </CardContent>
      <ImportProgressOverlay open={readingFile} progress={readingProgress} title="Preparando inventario compartido" description="Leyendo la plantilla y preparando todas las filas para revisión." />
    </Card>
  );
}
