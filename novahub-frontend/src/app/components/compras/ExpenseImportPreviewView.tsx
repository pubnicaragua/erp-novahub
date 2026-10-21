import { useState } from 'react';
import { ArrowLeft, CheckCircle2, RefreshCw, Upload, Wallet } from 'lucide-react';
import type { ExpenseImportPreviewResponse, ExpenseImportRow } from '../../services/compras.service';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ImportProgressOverlay } from '../ui/ImportProgressOverlay';
import { ImportReviewSummary } from '../ui/ImportReviewSummary';
import { BankAccountSelect } from '../ui/BankAccountSelect';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useImportPreviewLayout } from '../../hooks/useImportPreviewLayout';
import { cn } from '../ui/utils';

const paymentMethodOptions = [
  { label: 'Efectivo', value: 'CASH' },
  { label: 'Tarjeta', value: 'CARD' },
  { label: 'Transferencia', value: 'TRANSFER' },
  { label: 'Cheque', value: 'CHECK' },
] as const;

const expenseImportStatusOptions = [
  { label: 'Borrador', value: 'DRAFT' },
  { label: 'Pendiente', value: 'PENDING' },
  { label: 'Pagado', value: 'PAID' },
] as const;

const NO_EXPENSE_IMPORT_PAYMENT = '__SIN_METODO__';

type ExpenseImportResult = { total: number; created: number; skipped: number; errors: string[] } | null;
type EditableExpenseImportField = 'estado' | 'metododepago' | 'referencia' | 'numerodecuentabancaria';

interface Props {
  rows: ExpenseImportRow[];
  preview: ExpenseImportPreviewResponse;
  previewStale: boolean;
  fileName: string;
  isSidebarCollapsed: boolean;
  importing: boolean;
  validating: boolean;
  progress: number;
  result: ExpenseImportResult;
  onFieldUpdate: (sourceRowNumber: number, field: EditableExpenseImportField, value: string) => void;
  onBack: () => void;
  onRevalidate: () => void;
  onConfirm: () => void;
  onRetryFailed: () => void;
  onFinish: () => void;
}

const displayExpenseImportValue = (value: unknown) => {
  if (value === undefined || value === null || String(value).trim() === '') return '—';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? String(value) : value.toLocaleDateString('es-NI');
  if (typeof value === 'number') return Number.isFinite(value) ? new Intl.NumberFormat('es-NI', { maximumFractionDigits: 6 }).format(value) : String(value);
  return String(value);
};

const ExpenseImportPreviewField = ({ label, value }: { label: string; value: unknown }) => (
  <div className="min-w-0 rounded-lg border border-border/50 bg-background/70 px-3 py-2">
    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-1 break-words text-xs font-medium text-foreground">{displayExpenseImportValue(value)}</p>
  </div>
);

export function ExpenseImportPreviewView({
  rows,
  preview,
  previewStale,
  fileName,
  isSidebarCollapsed,
  importing,
  validating,
  progress,
  result,
  onFieldUpdate,
  onBack,
  onRevalidate,
  onConfirm,
  onRetryFailed,
  onFinish,
}: Props) {
  useImportPreviewLayout();
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [confirmationWord, setConfirmationWord] = useState('');
  const sourceRows = new Map(rows.map((row) => [row.sourceRowNumber, row]));
  const readyCount = preview.rows.filter((row) => row.status === 'READY').length;
  const skippedCount = preview.rows.filter((row) => row.status === 'BLOCKED' || row.status === 'FAILED').length;
  const canConfirmImport = confirmationWord.trim().toLocaleUpperCase() === 'IMPORTAR';

  return (
    <div data-import-preview-shell="true" className={`fixed inset-y-0 right-0 left-0 z-40 flex h-dvh min-h-0 flex-col overflow-hidden bg-background p-3 sm:p-6 ${isSidebarCollapsed ? 'lg:left-[72px]' : 'lg:left-[270px]'}`}>
      <div className="mx-auto flex min-h-0 w-full max-w-[1700px] flex-1 flex-col gap-3 sm:gap-4">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3 sm:pb-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary sm:text-xs">Importación masiva</p>
            <h1 className="mt-1 flex items-center gap-2 text-xl font-black tracking-tight sm:text-3xl"><Wallet className="size-5 shrink-0 text-primary sm:size-7" /> Revisar gastos</h1>
            <p className="mt-1 max-w-4xl text-xs leading-relaxed text-muted-foreground sm:text-sm">Revisa cada fila y corrige sus datos; la vista se actualiza automáticamente antes de confirmar.</p>
          </div>
        </header>

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-3 sm:p-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Archivo cargado</p>
            <p className="truncate text-sm font-bold text-foreground" title={fileName}>{fileName}</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] font-bold">
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-700">Compras activa</Badge>
            <Badge variant="outline" className={preview.integrations.financeEnabled ? 'border-blue-500/30 text-blue-700' : 'text-muted-foreground'}>Finanzas {preview.integrations.financeEnabled ? 'conectada' : 'desconectada'}</Badge>
            <Badge variant="outline" className={preview.integrations.accountingEnabled ? 'border-violet-500/30 text-violet-700' : 'text-muted-foreground'}>Asiento automático {preview.integrations.accountingEnabled ? 'activo' : 'inactivo'}</Badge>
          </div>
        </div>

        <ImportReviewSummary total={result?.total ?? preview.summary.total} valid={result?.created ?? readyCount} skipped={result?.skipped ?? skippedCount} entityLabel={result ? 'gastos importados' : 'gastos listos'} />

        {previewStale && (
          <div role={validating ? 'status' : 'alert'} aria-live="polite" className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
            {validating && <RefreshCw className="size-4 shrink-0 animate-spin" />}
            {validating
              ? 'Actualizando automáticamente errores y efectos de las filas modificadas…'
              : 'Cambios detectados. La vista previa se actualizará automáticamente.'}
          </div>
        )}

        <section aria-label="Gastos para revisar" className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl border border-border/60 bg-card p-3 scrollbar-overlay sm:p-4">
          <div className="space-y-3">
            {preview.rows.map((row) => {
              const source = sourceRows.get(row.sourceRowNumber);
              const statusValue = String(source?.status || 'PENDING').trim().toUpperCase() || 'PENDING';
              const paymentValue = String(source?.paymentSource || '').trim().toUpperCase();
              const paymentSelectValue = paymentValue || NO_EXPENSE_IMPORT_PAYMENT;
              const rowCanEdit = row.status !== 'CONFIRMED';

              return (
                <article key={row.sourceRowNumber} className={cn('min-w-0 rounded-xl border bg-muted/20 p-3 sm:p-4', row.status === 'BLOCKED' || row.status === 'FAILED' ? 'border-rose-500/30' : row.status === 'CONFIRMED' ? 'border-blue-500/30' : 'border-border/60')}>
                  <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-black">Fila {row.sourceRowNumber}</span>
                        <Badge variant="outline" className={row.status === 'READY' ? 'border-emerald-500/30 text-emerald-700' : row.status === 'CONFIRMED' ? 'border-blue-500/30 text-blue-700' : row.status === 'FAILED' || row.status === 'BLOCKED' ? 'border-rose-500/30 text-rose-700' : ''}>
                          {row.status === 'READY' ? 'Lista' : row.status === 'BLOCKED' ? 'Corregir' : row.status === 'CONFIRMED' ? 'Confirmada' : row.status === 'FAILED' ? 'Falló' : row.status}
                        </Badge>
                        {previewStale && <Badge variant="outline" className="border-amber-500/30 text-amber-700">Pendiente de validar</Badge>}
                      </div>
                      {row.number && <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{row.number}</p>}
                    </div>
                    {row.status === 'CONFIRMED' && <Badge variant="outline" className="border-blue-500/30 text-blue-700">Registro confirmado</Badge>}
                  </div>

                  <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <ExpenseImportPreviewField label="Fecha" value={source?.date} />
                    <ExpenseImportPreviewField label="Descripción" value={source?.description} />
                    <ExpenseImportPreviewField label="Categoría" value={source?.category} />
                    <ExpenseImportPreviewField label="Categoría personalizada" value={source?.categoryCustom} />
                    <ExpenseImportPreviewField label="Monto" value={source?.amount} />
                    <ExpenseImportPreviewField label="Moneda" value={source?.currency} />
                    <ExpenseImportPreviewField label="Tasa aplicada por el sistema" value={row.resolvedExchangeRate} />
                    <ExpenseImportPreviewField label="Pagado a" value={source?.paidTo} />
                    <ExpenseImportPreviewField
                      label="Proveedor vinculado"
                      value={row.supplier
                        ? `${row.supplier.name}${row.supplier.code ? ` · ${row.supplier.code}` : ''}${row.supplier.willCreate ? ' · se creará al confirmar' : ''}`
                        : 'No resuelto'}
                    />

                    <div className="min-w-0 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Estado</span>
                      <Select value={statusValue} onValueChange={(value) => onFieldUpdate(row.sourceRowNumber, 'estado', value)} disabled={!rowCanEdit || importing}>
                        <SelectTrigger aria-label={`Estado del gasto de la fila ${row.sourceRowNumber}`} className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {!expenseImportStatusOptions.some((option) => option.value === statusValue) && <SelectItem value={statusValue}>Valor actual: {statusValue}</SelectItem>}
                          {expenseImportStatusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="min-w-0 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Método de pago</span>
                      <Select value={paymentSelectValue} onValueChange={(value) => onFieldUpdate(row.sourceRowNumber, 'metododepago', value === NO_EXPENSE_IMPORT_PAYMENT ? '' : value)} disabled={!rowCanEdit || importing}>
                        <SelectTrigger aria-label={`Método de pago de la fila ${row.sourceRowNumber}`} className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {paymentValue && !paymentMethodOptions.some((option) => option.value === paymentValue) && <SelectItem value={paymentValue}>Valor actual: {paymentValue}</SelectItem>}
                          <SelectItem value={NO_EXPENSE_IMPORT_PAYMENT}>Sin método</SelectItem>
                          {paymentMethodOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <label className="min-w-0 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Referencia</span>
                      <Input aria-label={`Referencia de la fila ${row.sourceRowNumber}`} value={String(source?.reference ?? '')} onChange={(event) => onFieldUpdate(row.sourceRowNumber, 'referencia', event.target.value)} disabled={!rowCanEdit || importing} className="h-9 text-xs" />
                    </label>

                    {preview.integrations.accountingConnectionEnabled && <BankAccountSelect
                      label="Número de cuenta bancaria"
                      placeholder="Seleccionar cuenta existente"
                      required={preview.integrations.accountingEnabled}
                      valueMode="accountNumber"
                      allowUnlinked={!preview.integrations.accountingEnabled}
                      showUnavailableOptions
                      currency={String(source?.currency || '')}
                      value={String(source?.bankAccountNumber ?? '')}
                      onChange={(value) => onFieldUpdate(row.sourceRowNumber, 'numerodecuentabancaria', value)}
                      disabled={!rowCanEdit || importing}
                      className="min-w-0"
                    />}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                    {row.status === 'READY' && <>
                      {row.effects?.expense && <Badge variant="outline" className="border-emerald-500/30 text-emerald-700">Se creará en Compras</Badge>}
                      {row.effects?.financeMirror ? <Badge variant="outline" className="border-blue-500/30 text-blue-700">Generará espejo en Finanzas</Badge> : <Badge variant="outline" className="text-muted-foreground">Sin espejo en Finanzas</Badge>}
                      {row.effects?.accountingJournal ? <Badge variant="outline" className="border-violet-500/30 text-violet-700">Generará asiento contable</Badge> : <Badge variant="outline" className="text-muted-foreground">Sin asiento contable</Badge>}
                    </>}
                  </div>

                  {(row.errors || []).length > 0 && (
                    <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-rose-700">{previewStale ? 'Errores de la validación anterior' : 'Errores que debes corregir'}</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-rose-700 dark:text-rose-300">
                        {row.errors.map((error, index) => <li key={`${row.sourceRowNumber}-${index}`} className="break-words">{error}</li>)}
                      </ul>
                    </div>
                  )}
                  {row.status === 'BLOCKED' && <p className="mt-2 text-[10px] text-muted-foreground">No se aplicará ningún efecto hasta que corrijas la fila y la vuelvas a validar.</p>}
                  {row.status === 'CONFIRMED' && <p className="mt-2 text-[10px] font-semibold text-emerald-700">Gasto confirmado en Compras · {row.financeMirrorCreated ? 'espejo creado en Finanzas' : 'sin espejo financiero'} · {row.accountingJournalGenerated ? 'asiento generado' : 'sin asiento contable'}</p>}
                </article>
              );
            })}
          </div>
        </section>

        {result && (
          <section className="shrink-0 space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 sm:p-4" aria-live="polite">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"><CheckCircle2 className="size-5" /></div>
              <div><p className="text-sm font-black uppercase tracking-tight text-emerald-700">Importación finalizada</p><p className="text-xs text-muted-foreground">Los gastos creados ya aparecen en la tabla de Gastos.</p></div>
            </div>
            {result.errors.length > 0 && <div className="max-h-24 overflow-y-auto rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700 scrollbar-overlay">{result.errors.map((error, index) => <p key={index}>{error}</p>)}</div>}
          </section>
        )}

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between sm:pt-4">
          {result ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
              <Button variant="outline" onClick={onFinish} className="gap-2"><CheckCircle2 className="size-4" /> Terminar</Button>
              {preview.rows.some((row) => row.status === 'FAILED') && <Button variant="outline" onClick={onRetryFailed} disabled={importing} className="gap-2"><Upload className="size-4" /> Reintentar fallidas</Button>}
            </div>
          ) : (
            <Button variant="outline" onClick={onBack} disabled={importing || validating} className="gap-2"><ArrowLeft className="size-4" /> Volver a la carga</Button>
          )}
          {!result && (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={onRevalidate} disabled={importing || validating} className="gap-2"><RefreshCw className="size-4" /> Revalidar ahora</Button>
              <Button onClick={() => setConfirmImportOpen(true)} disabled={importing || validating || previewStale || readyCount === 0} className="gap-2"><Upload className="size-4" /> Confirmar {readyCount} gastos listos</Button>
            </div>
          )}
        </footer>
      </div>
      <Dialog open={confirmImportOpen} onOpenChange={(open) => { setConfirmImportOpen(open); if (!open) setConfirmationWord(''); }}>
        <DialogContent className="w-[calc(100%-2rem)] !max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Confirmar importación de gastos</DialogTitle>
            <DialogDescription>
              Se importarán {readyCount} gastos listos. Los que estén pagados pueden generar movimientos en Finanzas y asientos contables según la configuración de esta sucursal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="confirm-expense-import-word" className="text-xs font-bold text-foreground">Escribe <span className="font-black">IMPORTAR</span> para continuar</label>
            <Input
              id="confirm-expense-import-word"
              autoComplete="off"
              value={confirmationWord}
              onChange={(event) => setConfirmationWord(event.target.value)}
              placeholder="IMPORTAR"
              disabled={importing}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setConfirmImportOpen(false); setConfirmationWord(''); }} disabled={importing}>Cancelar</Button>
            <Button
              type="button"
              onClick={() => {
                if (!canConfirmImport) return;
                setConfirmImportOpen(false);
                setConfirmationWord('');
                onConfirm();
              }}
              disabled={!canConfirmImport || importing || validating || previewStale}
            >
              <Upload className="mr-2 size-4" /> Importar gastos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ImportProgressOverlay open={importing} progress={progress} title={validating ? 'Validando gastos' : 'Importando gastos'} description={validating ? 'Recalculando errores y efectos de cada fila en el servidor.' : 'Registrando los gastos listos en bloques de hasta 50.'} />
    </div>
  );
}
