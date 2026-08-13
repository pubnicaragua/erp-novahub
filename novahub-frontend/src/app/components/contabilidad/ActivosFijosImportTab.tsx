import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { DateField } from '../ui/DateField';
import { FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, Download } from 'lucide-react';
import { contabilidadService } from '../../services/contabilidad.service';
import { useCurrency } from '../../contexts/CurrencyContext';
import { toast } from 'sonner';
import { ImportProgressOverlay } from '../ui/ImportProgressOverlay';
import { ImportReviewSummary } from '../ui/ImportReviewSummary';

const TEMPLATE_HEADERS = [
  'Código', 'Nombre', 'Categoría', 'Marca', 'Modelo', 'No. serie', 'Sucursal', 'Centro de costo',
  'Ubicación', 'Responsable', 'Proveedor', 'No. factura', 'Fecha adquisición', 'Fecha puesta en uso',
  'Moneda', 'Tipo de cambio', 'Costo', 'Valor residual', 'Vida útil', 'Tasa anual',
  'Dep. acumulada inicial', 'Observaciones',
];

const HEADER_TO_KEY: Record<string, string> = {
  'Código': 'codigo',
  'Nombre': 'nombre',
  'Categoría': 'categoria',
  'Marca': 'marca',
  'Modelo': 'modelo',
  'No. serie': 'no_serie',
  'Sucursal': 'sucursal',
  'Centro de costo': 'centro_de_costo',
  'Ubicación': 'ubicacion',
  'Responsable': 'responsable',
  'Proveedor': 'proveedor',
  'No. factura': 'no_factura',
  'Fecha adquisición': 'fecha_adquisicion',
  'Fecha puesta en uso': 'fecha_puesta_en_uso',
  'Moneda': 'moneda',
  'Tipo de cambio': 'tipo_de_cambio',
  'Costo': 'costo',
  'Valor residual': 'valor_residual',
  'Vida útil': 'vida_util',
  'Tasa anual': 'tasa_anual',
  'Dep. acumulada inicial': 'dep_acumulada_inicial',
  'Observaciones': 'observaciones',
};

const EXAMPLE_ROW = [
  'ACT-001', 'Laptop HP ProBook', 'Equipo de Cómputo', 'HP', 'ProBook 450', 'SN-001',
  'Matriz', 'Administración', 'Oficina central', 'Juan Pérez', 'Proveedor A', 'FAC-1001',
  '2025-01-10', '2025-01-15', 'NIO', '1', '15000', '0', '24', '50%', '0', 'Laptop principal',
];

function normalizeDate(value: string): string {
  const v = String(value ?? '').trim();
  if (!v) return '';
  const m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  const m2 = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m2) {
    let year = m2[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
  }
  return v;
}

export function ActivosFijosImportTab() {
  const queryClient = useQueryClient();
  const { baseCurrency, formatConvertedAmount } = useCurrency();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [cutoffDate, setCutoffDate] = useState('');
  const [defaultAccum, setDefaultAccum] = useState('');
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [operationProgress, setOperationProgress] = useState(0);
  const [result, setResult] = useState<any>(null);

  const fmt = (value: number) => formatConvertedAmount(value, baseCurrency);

  function downloadTemplate() {
    const worksheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, EXAMPLE_ROW]);
    worksheet['!cols'] = TEMPLATE_HEADERS.map((_, i) => ({ wch: i <= 12 ? 18 : 14 }));
    const guide = XLSX.utils.aoa_to_sheet([
      ['GUÍA DE LLENADO · IMPORTAR ACTIVOS FIJOS'],
      ['1. No modifiques la fila de encabezados.'],
      ['2. Obligatorios: Nombre, Categoría, Fecha adquisición, Fecha puesta en uso, Costo.'],
      ['3. Categoría y Sucursal se reconocen por nombre (deben existir en el sistema).'],
      ['4. Si Vida útil o Tasa anual van vacíos, se toman de la categoría.'],
      ['5. Moneda: NIO, USD u otra. Si no es NIO, el Tipo de cambio es obligatorio.'],
      ['6. Dep. acumulada inicial es para activos ya depreciados antes de migrar.'],
    ]);
    guide['!cols'] = [{ wch: 90 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Activos');
    XLSX.utils.book_append_sheet(workbook, guide, 'Guía de llenado');
    XLSX.writeFile(workbook, 'plantilla_activos_fijos.xlsx');
  }

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      toast.error('El archivo debe ser Excel (.xlsx o .xls)');
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: '', raw: false });
      const nonEmpty = raw.filter((row: any) => Array.isArray(row) && row.some((cell: any) => String(cell ?? '').trim().length > 0));
      if (nonEmpty.length < 2) { toast.error('El archivo no contiene datos'); return; }
      const headerRow = (nonEmpty[0] as any[]).map((h) => String(h ?? '').trim());
      const dataRows = nonEmpty.slice(1);
      const mapped: Record<string, string>[] = dataRows.map((cols: any[]) => {
        const row: Record<string, string> = {};
        headerRow.forEach((header, index) => {
          const key = HEADER_TO_KEY[header];
          if (key) row[key] = String(cols[index] ?? '').trim();
        });
        return row;
      });
      setFileName(file.name);
      setRows(mapped);
      setResult(null);
      toast.success(`${mapped.length} filas leídas del archivo`);
    } catch (err) {
      toast.error('Error al leer el archivo Excel');
    }
  }

  function effectiveRows() {
    return rows.map((row) => {
      const next = { ...row };
      if (cutoffDate && !next.fecha_corte) next.fecha_corte = cutoffDate;
      if (defaultAccum && !next.dep_acumulada_inicial) next.dep_acumulada_inicial = defaultAccum;
      for (const key of ['fecha_adquisicion', 'fecha_puesta_en_uso', 'fecha_corte']) {
        if (next[key]) next[key] = normalizeDate(next[key]);
      }
      return next;
    });
  }

  async function handleValidate() {
    if (rows.length === 0) { toast.error('Primero carga un archivo'); return; }
    setValidating(true);
    setOperationProgress(12);
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    try {
      progressTimer = setInterval(() => setOperationProgress((current) => Math.min(90, current + 4)), 180);
      const res = await contabilidadService.validateFixedAssetImport(effectiveRows());
      if (progressTimer) clearInterval(progressTimer);
      setOperationProgress(100);
      setResult(res);
    } catch (err: any) {
      toast.error(err.message || 'Error al validar');
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      setValidating(false);
      window.setTimeout(() => setOperationProgress(0), 180);
    }
  }

  async function handleImport() {
    if (!result || result.valid === 0) { toast.error('Valida primero y asegúrate de que haya filas válidas'); return; }
    setImporting(true);
    setOperationProgress(12);
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    try {
      progressTimer = setInterval(() => setOperationProgress((current) => Math.min(90, current + 3)), 180);
      const res = await contabilidadService.importFixedAssets(effectiveRows());
      if (progressTimer) clearInterval(progressTimer);
      setOperationProgress(100);
      toast.success(`Importación completada: ${res?.imported ?? 0} activos`);
      queryClient.invalidateQueries({ queryKey: ['accounting'] });
      queryClient.invalidateQueries({ queryKey: ['fixed-assets'] });
      setResult(null);
      setRows([]);
      setFileName('');
    } catch (err: any) {
      toast.error(err.message || 'Error al importar');
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      setImporting(false);
      window.setTimeout(() => setOperationProgress(0), 180);
    }
  }

  const summaryCards = useMemo(() => {
    if (!result) return [];
    return [
      { label: 'Total de filas', value: `${result.total ?? 0}` },
      { label: 'Válidas', value: `${result.valid ?? 0}`, tone: 'text-emerald-600' },
      { label: 'Con errores', value: `${result.invalid ?? 0}`, tone: result.invalid > 0 ? 'text-red-600' : '' },
      { label: 'Valor total', value: fmt(result.totalValue ?? 0) },
      { label: 'Dep. acumulada', value: fmt(result.totalAccum ?? 0) },
      { label: 'Valor neto en libros', value: fmt(result.netValue ?? 0) },
    ];
  }, [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-lg font-bold">
            <span className="font-black tracking-tight uppercase italic">Importar Activos Fijos desde Excel</span>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="h-8 gap-1.5">
              <Download className="size-3.5" /> Descargar plantilla
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cutoff-date">Fecha de corte contable (opcional)</Label>
              <DateField id="cutoff-date" value={cutoffDate} onChange={setCutoffDate} />
              <p className="text-[11px] text-muted-foreground">La depreciación se proyecta a partir del mes siguiente a esta fecha para activos ya depreciados.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="default-accum">Depreciación acumulada inicial (opcional)</Label>
              <Input id="default-accum" type="number" step="0.01" min="0" value={defaultAccum} onChange={(e) => setDefaultAccum(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">Se aplica a las filas que no especifiquen su propia depreciación acumulada inicial.</p>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-border/40 p-6 text-center">
            <input
              type="file"
              accept=".xlsx,.xls"
              id="fixed-asset-import-file"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
            />
            <label htmlFor="fixed-asset-import-file" className="flex cursor-pointer flex-col items-center gap-2 text-muted-foreground">
              <FileSpreadsheet className="size-10 opacity-40" />
              <span className="text-sm font-medium">{fileName ? fileName : 'Haz clic para seleccionar un archivo Excel'}</span>
              <span className="text-xs">{rows.length > 0 ? `${rows.length} filas listas para validar` : 'Se cargarán los activos del archivo'}</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleValidate} disabled={validating || rows.length === 0} className="gap-1.5">
              <CheckCircle2 className="size-4" /> {validating ? 'Validando...' : 'Validar archivo'}
            </Button>
            {result && result.valid > 0 && (
              <Button onClick={handleImport} disabled={importing} className="gap-1.5">
                <Upload className="size-4" /> {importing ? 'Importando...' : `Importar ${result.valid} válidos · omitir ${result.invalid ?? 0}`}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">
              <span className="font-black tracking-tight uppercase italic">Resultado de validación</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ImportReviewSummary total={result.total ?? rows.length} valid={result.valid ?? 0} skipped={result.invalid ?? 0} entityLabel="activos fijos" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {summaryCards.map((card) => (
                <div key={card.label} className="rounded-xl border border-border/40 bg-muted/20 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{card.label}</p>
                  <p className={`mt-1 text-base font-black ${card.tone || ''}`}>{card.value}</p>
                </div>
              ))}
            </div>
            {result.invalid > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-red-600">
                  <AlertTriangle className="size-3.5" /> Errores por fila
                </p>
                <div className="max-h-56 overflow-y-auto rounded-xl border border-border/40">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/50 text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Fila</th>
                        <th className="px-3 py-2">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(result.invalidRows || []).slice(0, 50).map((item: any, idx: number) => (
                        <tr key={idx} className="border-t border-border/30">
                          <td className="px-3 py-1.5 font-mono">{item.rowIndex + 2}</td>
                          <td className="px-3 py-1.5">{item.errors.join(' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <ImportProgressOverlay
        open={validating || importing}
        progress={operationProgress}
        title={validating ? 'Validando activos fijos' : 'Importando activos fijos'}
        description={validating ? 'Comprobando categorías, fechas, valores y referencias antes de importar.' : 'Guardando los activos válidos y actualizando la información contable.'}
      />
    </div>
  );
}
