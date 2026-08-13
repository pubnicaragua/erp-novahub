import { AlertTriangle, ArrowLeft, CheckCircle2, Upload } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { HorizontalTableScroller } from '../ui/HorizontalTableScroller';
import { ImportReviewSummary } from '../ui/ImportReviewSummary';
import { ImportProgressOverlay } from '../ui/ImportProgressOverlay';
import type { ChartAccountCsvRow } from '../../types/accounting';
import { useImportPreviewLayout } from '../../hooks/useImportPreviewLayout';

interface AccountImportPreviewProps {
  rows: ChartAccountCsvRow[];
  errors: string[];
  existingAccountCodes: string[];
  fileName: string;
  isSidebarCollapsed: boolean;
  importing: boolean;
  progress: number;
  onRowUpdate: (index: number, field: keyof ChartAccountCsvRow, value: string) => void;
  onBack: () => void;
  onConfirm: () => void;
}

const fieldClass = 'h-9 w-full min-w-0 rounded-lg border-border/70 bg-background/70 text-xs';

const normalizeImportValue = (value: unknown) => String(value ?? '').trim().toUpperCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const ACCOUNT_TYPE_ALIASES = new Set(['ASSET', 'ACTIVO', 'ACTIVOS', 'LIABILITY', 'PASIVO', 'PASIVOS', 'EQUITY', 'PATRIMONIO', 'CAPITAL', 'INCOME', 'INGRESO', 'INGRESOS', 'EXPENSE', 'GASTO', 'GASTOS', 'COSTO', 'COSTOS']);
const SUBTYPE_ALIASES = new Set(['MAIN_GROUP', 'GRUPO PRINCIPAL', 'GROUP', 'GRUPO', 'DETAIL_ACCOUNT', 'CUENTA DE DETALLE', 'SUBACCOUNT', 'SUBCUENTA', 'CUENTA AUXILIAR', 'AUXILIAR']);
const DETAIL_TYPE_ALIASES = new Set(['BALANCE_SHEET', 'BALANCE GENERAL', 'INCOME_STATEMENT', 'ESTADO DE RESULTADOS']);

function validateImportRows(rows: ChartAccountCsvRow[], existingAccountCodes: string[]) {
  const messages = new Map<number, string[]>();
  const addMessage = (index: number, message: string) => {
    const current = messages.get(index) || [];
    if (!current.includes(message)) messages.set(index, [...current, message]);
  };
  const rowsByCode = new Map<string, number[]>();

  rows.forEach((row, index) => {
    const code = row.codigo.trim();
    if (code) rowsByCode.set(code, [...(rowsByCode.get(code) || []), index]);
  });
  rowsByCode.forEach((indexes, code) => {
    if (indexes.length > 1) indexes.forEach((index) => addMessage(index, `Código duplicado '${code}' en la plantilla`));
  });

  const availableCodes = new Set([...existingAccountCodes.map((code) => code.trim()), ...rowsByCode.keys()]);
  rows.forEach((row, index) => {
    const code = row.codigo.trim();
    const parentCode = row.codigo_padre.trim();
    const subtype = normalizeImportValue(row.subtipo);
    const detailType = normalizeImportValue(row.tipo_detalle);
    const manual = normalizeImportValue(row.permite_manual);
    const active = normalizeImportValue(row.activa);
    if (!code) addMessage(index, 'El código es obligatorio');
    if (!row.nombre.trim()) addMessage(index, 'El nombre es obligatorio');
    if (!ACCOUNT_TYPE_ALIASES.has(normalizeImportValue(row.tipo_cuenta))) addMessage(index, `Tipo de cuenta inválido '${row.tipo_cuenta}'`);
    if (!SUBTYPE_ALIASES.has(subtype) && !subtype.includes('GRUPO') && !subtype.includes('DETALLE') && !subtype.includes('SUB') && !subtype.includes('AUXILIAR')) addMessage(index, `Subtipo inválido '${row.subtipo}'`);
    if (detailType && !DETAIL_TYPE_ALIASES.has(detailType)) addMessage(index, `Tipo de detalle inválido '${row.tipo_detalle}'`);
    if (manual && !['1', '0', 'TRUE', 'FALSE'].includes(manual)) addMessage(index, 'permite_manual debe ser 1 o 0');
    if (active && !['1', '0', 'TRUE', 'FALSE'].includes(active)) addMessage(index, 'activa debe ser 1 o 0');
    if (parentCode && parentCode !== code && !availableCodes.has(parentCode)) {
      addMessage(index, `Código padre '${parentCode}' no existe en el plan ni en esta importación`);
    }
  });

  const state = new Map<string, 'visiting' | 'visited'>();
  const stack: string[] = [];
  const visit = (code: string) => {
    const currentState = state.get(code);
    if (currentState === 'visited') return;
    if (currentState === 'visiting') {
      const cycle = stack.slice(stack.indexOf(code));
      cycle.forEach((cycleCode) => (rowsByCode.get(cycleCode) || []).forEach((index) => addMessage(index, `La importación crea un ciclo de jerarquía con '${cycleCode}'`)));
      return;
    }
    state.set(code, 'visiting');
    stack.push(code);
    const rowIndex = rowsByCode.get(code)?.[0];
    const parentCode = rowIndex === undefined ? '' : rows[rowIndex].codigo_padre.trim();
    if (parentCode && parentCode !== code && rowsByCode.has(parentCode)) visit(parentCode);
    stack.pop();
    state.set(code, 'visited');
  };
  rowsByCode.forEach((_indexes, code) => visit(code));

  return new Map([...messages.entries()].map(([index, rowMessages]) => [index, rowMessages.join(' · ')]));
}

export function AccountImportPreview({ rows, errors, existingAccountCodes, fileName, isSidebarCollapsed, importing, progress, onRowUpdate, onBack, onConfirm }: AccountImportPreviewProps) {
  useImportPreviewLayout();
  const rowValidationErrors = validateImportRows(rows, existingAccountCodes);
  const invalidRowCount = rowValidationErrors.size;
  const validRowCount = Math.max(0, rows.length - invalidRowCount);
  const skippedRowCount = invalidRowCount + errors.length;
  const totalRowCount = rows.length + errors.length;
  const validationMessages = [
    ...errors,
    ...Array.from(rowValidationErrors.entries()).map(([index, message]) => `Fila ${index + 2}: ${message}`),
  ];
  return (
    <div className={`accounting-module fixed inset-y-0 right-0 left-0 z-40 flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden bg-background p-3 sm:p-6 ${isSidebarCollapsed ? 'lg:left-[72px]' : 'lg:left-[270px]'}`}>
      <div className="mx-auto flex min-h-0 w-full max-w-[1900px] flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Importación masiva</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Previsualizar cuentas</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Revisa y corrige las cuentas antes de cargarlas al plan de cuentas de esta empresa.</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Archivo Excel cargado</p><p className="truncate text-sm font-bold" title={fileName}>{fileName}</p></div>
          <div className="flex flex-wrap gap-2 text-xs"><Badge variant="secondary">Códigos únicos por empresa</Badge><Badge variant="secondary">Importación repetible</Badge><Badge variant="secondary">Jerarquía por código padre</Badge></div>
        </div>

        <ImportReviewSummary total={totalRowCount} valid={validRowCount} skipped={skippedRowCount} entityLabel="cuentas" />

        <HorizontalTableScroller className="hidden min-h-0 flex-1 sm:flex" tableClassName="overflow-x-scroll overflow-y-auto scrollbar-overlay" label="Desplazamiento horizontal · columna por columna">
          <Table containerClassName="overflow-visible" containerStyle={{ width: '2200px', minWidth: '2200px', maxWidth: 'none' }} className="w-[2200px] min-w-[2200px]">
            <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
              <TableRow>
                <TableHead className="w-20 min-w-20 whitespace-nowrap text-center">Estado</TableHead>
                <TableHead className="w-40 min-w-40 whitespace-nowrap">Código *</TableHead>
                <TableHead className="w-72 min-w-72 whitespace-nowrap">Nombre *</TableHead>
                <TableHead className="w-40 min-w-40 whitespace-nowrap">Tipo</TableHead>
                <TableHead className="w-48 min-w-48 whitespace-nowrap">Subtipo</TableHead>
                <TableHead className="w-52 min-w-52 whitespace-nowrap">Tipo de detalle</TableHead>
                <TableHead className="w-32 min-w-32 whitespace-nowrap">Moneda</TableHead>
                <TableHead className="w-40 min-w-40 whitespace-nowrap">Código padre</TableHead>
                <TableHead className="w-32 min-w-32 whitespace-nowrap text-center">Manual</TableHead>
                <TableHead className="w-32 min-w-32 whitespace-nowrap text-center">Activa</TableHead>
                <TableHead className="w-72 min-w-72 whitespace-nowrap">Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => {
                const rowError = rowValidationErrors.get(index);
                return (
                <TableRow key={`${row.codigo}-${index}`} className={rowError ? 'bg-rose-500/5' : undefined}>
                  <TableCell className="text-center" title={rowError || 'Fila válida'}>{rowError ? <AlertTriangle className="mx-auto size-4 text-rose-500" aria-label="Fila con errores" /> : <CheckCircle2 className="mx-auto size-4 text-emerald-500" aria-label="Fila válida" />}</TableCell>
                  <TableCell><Input className={`${fieldClass} font-mono`} value={row.codigo} onChange={(event) => onRowUpdate(index, 'codigo', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={fieldClass} value={row.nombre} onChange={(event) => onRowUpdate(index, 'nombre', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={fieldClass} value={row.tipo_cuenta} onChange={(event) => onRowUpdate(index, 'tipo_cuenta', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={fieldClass} value={row.subtipo} onChange={(event) => onRowUpdate(index, 'subtipo', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={fieldClass} value={row.tipo_detalle} onChange={(event) => onRowUpdate(index, 'tipo_detalle', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={fieldClass} value={row.moneda} onChange={(event) => onRowUpdate(index, 'moneda', event.target.value.toUpperCase())} disabled={importing} /></TableCell>
                  <TableCell><Input className={`${fieldClass} font-mono`} value={row.codigo_padre} onChange={(event) => onRowUpdate(index, 'codigo_padre', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={`${fieldClass} text-center`} value={row.permite_manual} onChange={(event) => onRowUpdate(index, 'permite_manual', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={`${fieldClass} text-center`} value={row.activa} onChange={(event) => onRowUpdate(index, 'activa', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={fieldClass} value={row.notas} onChange={(event) => onRowUpdate(index, 'notas', event.target.value)} disabled={importing} /></TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!rows.length && <div className="p-12 text-center text-sm text-muted-foreground">El archivo no contiene cuentas válidas.</div>}
        </HorizontalTableScroller>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto sm:hidden">
          {rows.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">El archivo no contiene cuentas válidas.</div>
          ) : rows.map((row, index) => {
            const rowError = rowValidationErrors.get(index);
            return (
            <div key={`${row.codigo}-${index}`} className={`rounded-2xl border border-border/70 bg-card p-3 shadow-sm ${rowError ? 'border-rose-500/50 bg-rose-500/5' : ''}`}>
              <div className="flex items-start gap-2">
                <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${rowError ? 'bg-rose-500/10' : 'bg-emerald-500/10'}`} title={rowError || 'Fila válida'}>
                  {rowError ? <AlertTriangle className="size-4 text-rose-500" aria-label="Fila con errores" /> : <CheckCircle2 className="size-4 text-emerald-500" aria-label="Fila válida" />}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Código</p>
                  <Input className={`${fieldClass} font-mono`} value={row.codigo} onChange={(event) => onRowUpdate(index, 'codigo', event.target.value)} disabled={importing} />
                </div>
                <div className="min-w-0 flex-[1.6] space-y-1">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Nombre</p>
                  <Input className={fieldClass} value={row.nombre} onChange={(event) => onRowUpdate(index, 'nombre', event.target.value)} disabled={importing} />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="space-y-1"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Tipo</span><Input className={fieldClass} value={row.tipo_cuenta} onChange={(event) => onRowUpdate(index, 'tipo_cuenta', event.target.value)} disabled={importing} /></label>
                <label className="space-y-1"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Moneda</span><Input className={fieldClass} value={row.moneda} onChange={(event) => onRowUpdate(index, 'moneda', event.target.value.toUpperCase())} disabled={importing} /></label>
                <label className="space-y-1"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Subtipo</span><Input className={fieldClass} value={row.subtipo} onChange={(event) => onRowUpdate(index, 'subtipo', event.target.value)} disabled={importing} /></label>
                <label className="space-y-1"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Tipo detalle</span><Input className={fieldClass} value={row.tipo_detalle} onChange={(event) => onRowUpdate(index, 'tipo_detalle', event.target.value)} disabled={importing} /></label>
                <label className="space-y-1"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Código padre</span><Input className={`${fieldClass} font-mono`} value={row.codigo_padre} onChange={(event) => onRowUpdate(index, 'codigo_padre', event.target.value)} disabled={importing} /></label>
                <label className="space-y-1"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Permite manual</span><Input className={`${fieldClass} text-center`} value={row.permite_manual} onChange={(event) => onRowUpdate(index, 'permite_manual', event.target.value)} disabled={importing} /></label>
                <label className="space-y-1"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Activa</span><Input className={`${fieldClass} text-center`} value={row.activa} onChange={(event) => onRowUpdate(index, 'activa', event.target.value)} disabled={importing} /></label>
              </div>
              <label className="mt-2 block space-y-1"><span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Notas</span><Input className={fieldClass} value={row.notas} onChange={(event) => onRowUpdate(index, 'notas', event.target.value)} disabled={importing} /></label>
              {rowError && <p className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-2 text-xs font-medium text-rose-600">{rowError}</p>}
            </div>
            );
          })}
        </div>

        {validationMessages.length > 0 && (
          <div className="max-h-28 overflow-auto rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-600">
            <p className="mb-1 flex items-center gap-2 font-bold"><AlertTriangle className="size-4" /> Corrige estos errores antes de importar</p>
            {validationMessages.slice(0, 20).map((error, index) => <p key={index}>• {error}</p>)}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <Button variant="outline" onClick={onBack} disabled={importing}><ArrowLeft className="mr-2 size-4" /> Volver a la carga</Button>
          <Button onClick={onConfirm} disabled={importing || rows.length === 0 || invalidRowCount > 0 || errors.length > 0} className="font-bold"><Upload className="mr-2 size-4" /> {importing ? `Importando… ${progress}%` : `Importar ${validRowCount} válidas · omitir ${skippedRowCount}`}</Button>
        </div>
      </div>

      <ImportProgressOverlay open={importing} progress={progress} title="Importando cuentas" description="Guardando las cuentas en la empresa actual. No cierres esta ventana." />
    </div>
  );
}
