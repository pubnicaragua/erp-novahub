import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Download, FileUp, Loader2 } from 'lucide-react';
import { toast } from '@/app/services/toast';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { tenantQuotesService, type TenantQuotesImportResult } from '../../services/tenant-quotes.service';

const MAX_ROWS_PER_REQUEST = 300;

/** Una fila por concepto; las filas con el mismo Número (o misma empresa, contacto y fecha) forman una cotización. */
const TEMPLATE_HEADERS = [
  'Número', 'Fecha', 'Estado', 'Empresa prospecto', 'Contacto', 'Correo', 'Teléfono', 'País', 'Moneda', 'Impuesto %', 'Vigencia', 'Notas',
  'Sección', 'Concepto', 'Detalle', 'Periodicidad', 'Cantidad', 'Precio unitario', 'Descuento', 'Tipo de descuento', 'Opcional',
];
const TEMPLATE_EXAMPLE = [
  'COT-2025-001', '2025-03-10', 'Aceptada', 'Empresa Ejemplo, S.A.', 'María López', 'maria@ejemplo.com', '8888-8888', 'Nicaragua', 'USD', 0, '2025-03-25', 'Cotización de ejemplo: bórrala antes de importar',
  '1. CONTRATACIÓN INICIAL', 'Implementación y configuración inicial', 'Configuración inicial de la empresa', 'Pago único', 1, 250, 50, 'Monto', 'No',
];

const KEY_BY_HEADER: Record<string, string> = {
  numero: 'number', no: 'number', cotizacion: 'number',
  fecha: 'date', estado: 'status',
  'empresa prospecto': 'prospectCompany', empresa: 'prospectCompany', cliente: 'prospectCompany',
  contacto: 'prospectName', correo: 'prospectEmail', email: 'prospectEmail', telefono: 'prospectPhone', pais: 'country', moneda: 'currency',
  impuesto: 'taxRate', 'impuesto %': 'taxRate', vigencia: 'validUntil', 'valida hasta': 'validUntil', notas: 'notes', nota: 'notes',
  seccion: 'section', concepto: 'description', descripcion: 'description', detalle: 'detail', periodicidad: 'periodicity',
  cantidad: 'quantity', 'precio unitario': 'unitPrice', precio: 'unitPrice', descuento: 'discountValue',
  'tipo de descuento': 'discountType', opcional: 'isOptional',
};
const STATUS_BY_LABEL: Record<string, string> = {
  borrador: 'DRAFT', enviada: 'SENT', enviado: 'SENT', aceptada: 'ACCEPTED', aceptado: 'ACCEPTED', rechazada: 'REJECTED', rechazado: 'REJECTED', vencida: 'EXPIRED', vencido: 'EXPIRED',
  draft: 'DRAFT', sent: 'SENT', accepted: 'ACCEPTED', rejected: 'REJECTED', expired: 'EXPIRED',
};

const normalizeHeader = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9%]+/g, ' ').trim();
const text = (value: unknown) => String(value ?? '').trim();
const numeric = (value: unknown, fallback = 0) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  let raw = text(value).replace(/[^0-9.,-]/g, '');
  if (!raw) return fallback;
  if (raw.includes('.') && raw.includes(',')) raw = raw.replace(/,/g, '');
  else if (raw.includes(',')) raw = raw.replace(',', '.');
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const dateText = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return text(value);
};

/** Convierte las filas de la hoja (una por concepto) en cotizaciones con sus conceptos. */
export function groupQuoteRows(rows: Array<Record<string, unknown>>) {
  const quotes = new Map<string, any>();
  rows.forEach((raw, index) => {
    const row: Record<string, unknown> = {};
    Object.entries(raw).forEach(([header, value]) => { const key = KEY_BY_HEADER[normalizeHeader(header)]; if (key) row[key] = value; });
    if (!text(row.description) && !text(row.prospectCompany) && !text(row.number)) return; // fila vacía
    const date = dateText(row.date);
    const groupKey = text(row.number) || `${text(row.prospectCompany)}|${text(row.prospectName)}|${date}`;
    let quote = quotes.get(groupKey);
    if (!quote) {
      quote = {
        sourceRow: index + 2, number: text(row.number) || undefined, date: date || undefined,
        status: STATUS_BY_LABEL[normalizeHeader(row.status)] || undefined,
        prospectCompany: text(row.prospectCompany), prospectName: text(row.prospectName), prospectEmail: text(row.prospectEmail), prospectPhone: text(row.prospectPhone),
        country: text(row.country), currency: text(row.currency).toUpperCase() || 'USD', taxRate: numeric(row.taxRate), validUntil: dateText(row.validUntil) || undefined,
        notes: text(row.notes), items: [],
      };
      quotes.set(groupKey, quote);
    }
    if (text(row.description)) {
      quote.items.push({
        section: text(row.section) || 'SERVICIOS', description: text(row.description), detail: text(row.detail), periodicity: text(row.periodicity) || undefined,
        quantity: numeric(row.quantity, 1), unitPrice: numeric(row.unitPrice),
        discountValue: numeric(row.discountValue), discountType: /porc|%|percent/i.test(text(row.discountType)) ? 'PERCENT' : 'AMOUNT',
        isOptional: /^(si|sí|s|yes|true|1)$/i.test(text(row.isOptional)),
      });
    }
  });
  return [...quotes.values()];
}

/** Importa cotizaciones anteriores desde Excel: descarga la plantilla, llénala y súbela. */
export function ImportQuotesButton({ onImported }: { onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<TenantQuotesImportResult | null>(null);

  const downloadTemplate = () => {
    const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, TEMPLATE_EXAMPLE]);
    sheet['!cols'] = TEMPLATE_HEADERS.map((header) => ({ wch: Math.max(14, header.length + 2) }));
    const instructions = XLSX.utils.aoa_to_sheet([
      ['Cómo llenar la plantilla'],
      ['1. Cada fila es un concepto de una cotización. Las filas con el mismo Número forman una sola cotización (repite los datos de la cotización en cada fila).'],
      ['2. Estado: Borrador, Enviada, Aceptada, Rechazada o Vencida. Moneda: USD o NIO.'],
      ['3. Si dejas el Número vacío, el sistema le asigna el siguiente consecutivo. Si ya existe una cotización con ese Número, se omite.'],
      ['4. Descuento: el valor; Tipo de descuento: Monto o Porcentaje. Opcional: Sí o No.'],
      ['5. Borra la fila de ejemplo antes de importar.'],
    ]);
    instructions['!cols'] = [{ wch: 120 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Cotizaciones');
    XLSX.utils.book_append_sheet(workbook, instructions, 'Instrucciones');
    XLSX.writeFile(workbook, 'plantilla-cotizaciones.xlsx');
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) { toast.error('Selecciona un archivo Excel o CSV válido.'); return; }
    setBusy(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const quotes = groupQuoteRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' }));
      if (!quotes.length) { toast.error('El archivo no tiene cotizaciones para importar.'); return; }
      const merged: TenantQuotesImportResult = { total: 0, created: 0, skipped: 0, errors: 0, results: [] };
      for (let offset = 0; offset < quotes.length; offset += MAX_ROWS_PER_REQUEST) {
        const part = await tenantQuotesService.importQuotes(quotes.slice(offset, offset + MAX_ROWS_PER_REQUEST));
        merged.total += part.total; merged.created += part.created; merged.skipped += part.skipped; merged.errors += part.errors;
        merged.results.push(...part.results);
      }
      setReport(merged);
      if (merged.created) onImported();
      if (!merged.errors && !merged.skipped) toast.success(`${merged.created} cotización(es) importada(s).`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo importar el archivo.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <Button type="button" variant="outline" className="h-11 rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20" onClick={downloadTemplate}><Download className="mr-2 size-4" /> Plantilla Excel</Button>
      <Button type="button" variant="outline" className="h-11 rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileUp className="mr-2 size-4" />} Importar anteriores
      </Button>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" aria-label="Archivo de cotizaciones anteriores" onChange={(event) => void handleFile(event.target.files?.[0])} />
      <Dialog open={Boolean(report)} onOpenChange={(open) => { if (!open) setReport(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Resultado de la importación</DialogTitle>
            <DialogDescription>{report ? `${report.created} importada(s) · ${report.skipped} omitida(s) · ${report.errors} con error, de ${report.total}.` : ''}</DialogDescription>
          </DialogHeader>
          <ul className="max-h-72 space-y-1.5 overflow-auto text-sm">
            {report?.results.filter((item) => item.result !== 'CREATED').map((item) => (
              <li key={`${item.row}-${item.number}`} className="rounded-lg border border-border p-2">
                <span className="font-bold">Fila {item.row}{item.number ? ` · ${item.number}` : ''}</span>
                <span className={item.result === 'ERROR' ? 'ml-2 text-destructive' : 'ml-2 text-muted-foreground'}>{item.message}</span>
              </li>
            ))}
            {report && report.results.every((item) => item.result === 'CREATED') && <li className="text-muted-foreground">Todas las cotizaciones se importaron correctamente.</li>}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
