import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { getApiErrorMessage } from '../../services/api';
import { logisticsService, type ImportDefaults, type ImportRowInput, type ImportRowResult } from '../../services/logistics.service';

interface BulkImportProps {
  defaults: ImportDefaults;
  onImported: () => void;
}

const COLUMN_ALIASES: Record<string, string> = {
  SKU: 'sku',
  'PESO DEL PAQUETE': 'weight',
  'PESO PAQUETE': 'weight',
  PESO: 'weight',
  'PRECIO DE COMPRA': 'purchasePrice',
  'PRECIO COMPRA': 'purchasePrice',
  'PRECIO DE VENTA': 'salePrice',
  'PRECIO VENTA': 'salePrice',
  TRACKING: 'tracking',
  WAREHOUSE: 'warehouse',
  BODEGA: 'warehouse',
  COD_AGENCIA: 'agencyCode',
  'COD AGENCIA': 'agencyCode',
  AGENCIA: 'agencyCode',
  COD_SUB_AGENCIA: 'subagencyCode',
  'COD SUBAGENCIA': 'subagencyCode',
  SUBAGENCIA: 'subagencyCode',
};

function normalizeHeader(header: unknown): string {
  return String(header || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

export function BulkImport({ defaults, onImported }: BulkImportProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ImportRowInput[]>([]);
  const [preview, setPreview] = useState<ImportRowResult[] | null>(null);
  const [summary, setSummary] = useState<{ total: number; valid: number; warnings: number; errors: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setPreview(null);
    setSummary(null);
    setResult(null);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const mapped: ImportRowInput[] = raw.map((record) => {
        const out: any = {};
        for (const [header, field] of Object.entries(COLUMN_ALIASES)) {
          const value = record[header] ?? Object.keys(record).find((k) => normalizeHeader(k) === header);
          if (value !== undefined) out[field] = value;
        }
        return {
          sku: String(out.sku ?? '').trim() || undefined,
          weight: Number(out.weight),
          purchasePrice: out.purchasePrice !== undefined && out.purchasePrice !== '' ? Number(out.purchasePrice) : undefined,
          salePrice: out.salePrice !== undefined && out.salePrice !== '' ? Number(out.salePrice) : undefined,
          tracking: String(out.tracking ?? '').trim(),
          warehouse: String(out.warehouse ?? '').trim() || undefined,
          agencyCode: String(out.agencyCode ?? '').trim() || undefined,
          subagencyCode: String(out.subagencyCode ?? '').trim() || undefined,
        };
      }).filter((r) => r.tracking || r.sku || r.weight);
      if (mapped.length === 0) {
        toast.error('El archivo no contiene filas vÃ¡lidas. Verifica los encabezados (SKU, PESO DEL PAQUETE, TRACKING, â€¦)');
        return;
      }
      setRows(mapped);
      await validate();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo leer el archivo'));
    }
  };

  const validate = async () => {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const res = await logisticsService.previewImport({ rows, defaults });
      setPreview(res.rows);
      setSummary({ total: res.total, valid: res.valid, warnings: res.warnings, errors: res.errors });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo validar el archivo'));
    } finally { setBusy(false); }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await logisticsService.importPackages({ rows, defaults });
      setResult({ imported: res.imported, skipped: res.skippedDuplicates });
      toast.success(`${res.imported} paquete(s) importado(s)`);
      onImported();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo importar'));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" className="rounded-xl" onClick={() => fileRef.current?.click()}>
          <FileSpreadsheet className="size-4" /> Seleccionar archivo
        </Button>
        <Input ref={fileRef as any} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
        {rows.length > 0 && !result && (
          <Button variant="outline" className="rounded-xl" onClick={validate} disabled={busy}>
            <Upload className="size-4" /> Validar
          </Button>
        )}
        {summary && !result && (
          <Button className="rounded-xl" onClick={confirm} disabled={busy || summary.errors === summary.total}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Confirmar e importar
          </Button>
        )}
      </div>

      {summary && !result && (
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline" className="rounded-lg">{summary.total} analizadas</Badge>
          <Badge variant="outline" className="rounded-lg text-emerald-600">{summary.valid} vÃ¡lidas</Badge>
          <Badge variant="outline" className="rounded-lg text-amber-600">{summary.warnings} advertencias</Badge>
          <Badge variant="outline" className="rounded-lg text-destructive">{summary.errors} errores</Badge>
        </div>
      )}

      {result && (
        <Card className="rounded-2xl border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
          <p className="text-sm font-black text-emerald-600">ImportaciÃ³n completada</p>
          <p className="mt-1 text-xs text-muted-foreground">{result.imported} importados Â· {result.skipped} duplicados omitidos</p>
        </Card>
      )}

      {preview && preview.length > 0 && (
        <div className="max-h-80 overflow-auto rounded-xl border border-border/50">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/60">
              <tr>
                <th className="px-3 py-2 text-left font-black uppercase tracking-widest">Fila</th>
                <th className="px-3 py-2 text-left font-black uppercase tracking-widest">Tracking</th>
                <th className="px-3 py-2 text-left font-black uppercase tracking-widest">Resultado</th>
                <th className="px-3 py-2 text-left font-black uppercase tracking-widest">ObservaciÃ³n</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((r) => (
                <tr key={r.row} className="border-t border-border/40">
                  <td className="px-3 py-1.5">{r.row}</td>
                  <td className="px-3 py-1.5 font-mono">{r.tracking || 'â€”'}</td>
                  <td className="px-3 py-1.5">
                    <Badge variant="outline" className={`rounded-lg text-[10px] ${r.result === 'OK' ? 'text-emerald-600' : r.result === 'WARNING' ? 'text-amber-600' : 'text-destructive'}`}>{r.result}</Badge>
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">{r.observation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}