import { useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, RefreshCw, Upload } from 'lucide-react';
import type { ForceSalesPortfolioImportResult } from '../../services/force-sales-portfolios.service';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { HorizontalTableScroller } from '../ui/HorizontalTableScroller';
import { ImportReviewSummary } from '../ui/ImportReviewSummary';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { VirtualizedImportList, useVirtualizedImportRows } from '../ui/VirtualizedImportList';
import { useImportPreviewLayout } from '../../hooks/useImportPreviewLayout';

export type ForceSalesImportManager = { id: string; name: string; activeRouteCount: number };
export type ForceSalesImportRow = Record<string, unknown> & {
  _rowNumber: number;
  _managerId: string;
  _name: string;
  _signedBalance: string;
};

type ForceSalesPortfolioImportPreviewProps = {
  rows: ForceSalesImportRow[];
  managers: ForceSalesImportManager[];
  fileName: string;
  portfolioName: string;
  isSidebarCollapsed?: boolean;
  importing: boolean;
  errors: string[];
  result: ForceSalesPortfolioImportResult | null;
  onRowManagerChange: (index: number, managerId: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  onDone: () => void;
};

const normalizeName = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
const gridTemplate = '72px 72px 300px 380px 136px 260px 230px';
const tableWidth = '1450px';

export function ForceSalesPortfolioImportPreview({
  rows,
  managers,
  fileName,
  portfolioName,
  isSidebarCollapsed = false,
  importing,
  errors,
  result,
  onRowManagerChange,
  onBack,
  onConfirm,
  onDone,
}: ForceSalesPortfolioImportPreviewProps) {
  useImportPreviewLayout();
  const desktopScrollRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizedImportRows(rows.length, desktopScrollRef, 64);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const key = normalizeName(row._name);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
  }, [rows]);

  const rowReview = (row: ForceSalesImportRow) => {
    if (!row._name.trim()) return { error: 'Falta el nombre del cliente.' };
    if (!row._managerId) return { error: 'Asigna un gestor activo.' };
    if (row._signedBalance && !Number.isFinite(Number(row._signedBalance))) return { error: 'El saldo no es un número válido.' };
    if (duplicateNames.has(normalizeName(row._name))) return { warning: 'Nombre repetido; revisa que no sea un homónimo.' };
    return {};
  };

  const errorCount = rows.filter((row) => rowReview(row).error).length;
  const warningCount = rows.filter((row) => rowReview(row).warning).length;
  const validCount = rows.length - errorCount;

  const renderManagerSelect = (row: ForceSalesImportRow, index: number) => (
    <select
      id={`portfolio-manager-${index}`}
      aria-label={`Gestor de la fila ${row._rowNumber}`}
      className="h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-xs font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      value={row._managerId}
      onChange={(event) => onRowManagerChange(index, event.target.value)}
      disabled={importing}
    >
      <option value="">Selecciona gestor</option>
      {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}
    </select>
  );

  const renderStatus = (row: ForceSalesImportRow) => {
    const review = rowReview(row);
    if (review.error) return <span className="flex min-w-0 items-start gap-1.5 break-words text-xs font-medium text-rose-600"><AlertCircle className="mt-0.5 size-3.5 shrink-0" />{review.error}</span>;
    if (review.warning) return <span className="flex min-w-0 items-start gap-1.5 break-words text-xs font-medium text-amber-700 dark:text-amber-300"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{review.warning}</span>;
    return <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600"><CheckCircle2 className="size-3.5 shrink-0" />Listo para importar</span>;
  };

  return (
    <>
      <div
        data-import-preview-shell="true"
        className={`fixed inset-y-0 right-0 left-0 z-40 flex h-dvh min-h-0 flex-col overflow-hidden bg-background p-3 sm:p-6 ${isSidebarCollapsed ? 'lg:left-[72px]' : 'lg:left-[270px]'}`}
      >
        <div className="mx-auto flex min-h-0 w-full max-w-[1900px] flex-1 flex-col gap-3 sm:gap-4">
          <header className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Importación de cartera</p>
              <h1 className="nh-module-title mt-1">Previsualizar clientes</h1>
              <p className="mt-1 max-w-3xl break-words text-xs leading-relaxed text-muted-foreground sm:text-sm">Revisa los datos y la asignación de cada gestor antes de crear los clientes y sus carteras.</p>
            </div>
          </header>

          <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 sm:p-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Archivo Excel · lote</p>
              <p className="truncate text-sm font-bold text-foreground" title={fileName}>{fileName}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground" title={portfolioName}>{portfolioName}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Gestor por cliente</Badge>
              <Badge variant="secondary">Cédula opcional</Badge>
              <Badge variant="secondary">Saldo vacío = 0</Badge>
            </div>
          </div>

          <ImportReviewSummary total={rows.length} valid={validCount} skipped={errorCount} warnings={warningCount} entityLabel="clientes" />

          {!!errors.length && <div role="alert" className="max-h-32 shrink-0 overflow-auto rounded-xl border border-destructive/35 bg-destructive/5 p-3 text-xs text-destructive">
            <p className="mb-1 font-bold">No se completó la carga</p>
            {errors.map((message, index) => <p key={`${index}-${message}`} className="break-words">{message}</p>)}
            <p className="mt-2 text-foreground">Puedes reintentar desde esta previsualización; se conserva el código del lote para detectar si el servidor ya alcanzó a guardarlo y evitar duplicados.</p>
          </div>}

          <div className="hidden min-h-0 min-w-0 max-w-full flex-1 sm:flex">
            <HorizontalTableScroller scrollRef={desktopScrollRef} scrollBehavior="auto" className="min-h-0 flex-1" tableClassName="scrollbar-overlay" label="Desplazamiento horizontal · tabla de clientes">
              <Table containerClassName="overflow-visible" containerStyle={{ width: tableWidth, minWidth: tableWidth, maxWidth: 'none' }} className="block w-[1450px] min-w-[1450px]">
                <TableHeader className="sticky top-0 z-10 block bg-muted/95 backdrop-blur">
                  <TableRow style={{ display: 'grid', gridTemplateColumns: gridTemplate }}>
                    <TableHead className="w-[72px] min-w-[72px] whitespace-nowrap">Estado</TableHead>
                    <TableHead className="w-[72px] min-w-[72px] whitespace-nowrap">Fila</TableHead>
                    <TableHead className="w-[300px] min-w-[300px]">Cliente</TableHead>
                    <TableHead className="w-[380px] min-w-[380px]">Dirección</TableHead>
                    <TableHead className="w-[136px] min-w-[136px] whitespace-nowrap text-right">Saldo</TableHead>
                    <TableHead className="w-[260px] min-w-[260px]">Gestor/Usuario *</TableHead>
                    <TableHead className="w-[230px] min-w-[230px]">Revisión</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody style={{ display: 'block', position: 'relative', height: virtualizer.getTotalSize() }}>
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const index = virtualRow.index;
                    const row = rows[index];
                    const review = rowReview(row);
                    return <TableRow
                      key={virtualRow.key}
                      ref={virtualizer.measureElement}
                      data-index={virtualRow.index}
                      style={{ display: 'grid', gridTemplateColumns: gridTemplate, position: 'absolute', left: 0, top: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
                      className={review.error ? 'bg-rose-500/5' : review.warning ? 'bg-amber-500/5' : ''}
                    >
                      <TableCell className="flex items-center justify-center">{review.error ? <AlertCircle className="size-4 text-rose-500" /> : review.warning ? <AlertTriangle className="size-4 text-amber-500" /> : <CheckCircle2 className="size-4 text-emerald-500" />}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row._rowNumber}</TableCell>
                      <TableCell className="min-w-0"><p className="line-clamp-2 break-words font-bold text-foreground">{row._name || 'Cliente sin nombre'}</p></TableCell>
                      <TableCell className="min-w-0"><p className="line-clamp-2 break-words text-xs text-muted-foreground">{String(row.address || 'Sin dirección')}</p></TableCell>
                      <TableCell className="text-right font-mono text-xs">{row._signedBalance || '—'}</TableCell>
                      <TableCell className="min-w-0">{renderManagerSelect(row, index)}</TableCell>
                      <TableCell className="min-w-0">{renderStatus(row)}</TableCell>
                    </TableRow>;
                  })}
                </TableBody>
              </Table>
              {!rows.length && <div className="p-12 text-center text-sm text-muted-foreground">El archivo Excel no contiene filas para importar.</div>}
            </HorizontalTableScroller>
          </div>

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card p-3 sm:hidden" aria-label="Clientes para revisar">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 pb-3">
              <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Revisión móvil</p><p className="mt-1 text-xs text-muted-foreground">Revisa un cliente por tarjeta</p></div>
              <Badge variant="secondary" className="shrink-0 text-[10px]">{rows.length} registros</Badge>
            </div>
            {rows.length ? <VirtualizedImportList
              count={rows.length}
              scrollRef={mobileScrollRef}
              estimateSize={230}
              overscan={2}
              className="pt-3 pr-1"
              renderItem={(index) => {
                const row = rows[index];
                const review = rowReview(row);
                return <article className={`mb-3 min-w-0 rounded-xl border p-3 ${review.error ? 'border-rose-500/35 bg-rose-500/[0.03]' : review.warning ? 'border-amber-500/35 bg-amber-500/[0.03]' : 'border-border/60'}`}>
                  <div className="flex min-w-0 items-start gap-2">
                    {review.error ? <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-500" /> : review.warning ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />}
                    <div className="min-w-0 flex-1"><p className="break-words text-sm font-bold text-foreground">{row._rowNumber}. {row._name || 'Cliente sin nombre'}</p><p className="mt-1 break-words text-xs text-muted-foreground">{String(row.address || 'Sin dirección')}</p><p className="mt-2 text-xs text-muted-foreground">Saldo: <span className="font-semibold text-foreground">{row._signedBalance || 'Sin saldo'}</span></p></div>
                  </div>
                  <div className="mt-3 space-y-1.5"><label htmlFor={`portfolio-manager-${index}`} className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Gestor/Usuario *</label>{renderManagerSelect(row, index)}</div>
                  <div className="mt-2">{renderStatus(row)}</div>
                </article>;
              }}
            /> : <div className="p-8 text-center text-sm text-muted-foreground">El archivo Excel no contiene filas para importar.</div>}
          </section>

          <footer className="flex shrink-0 flex-col items-stretch gap-2 border-t border-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pt-4">
            <Button variant="outline" onClick={onBack} disabled={importing} className="w-full sm:w-auto"><ArrowLeft className="mr-2 size-4" />Volver a la carga</Button>
            <Button onClick={() => { setConfirmText(''); setConfirmOpen(true); }} disabled={importing || errorCount > 0 || !rows.length} className="w-full font-bold sm:w-auto">
              {importing ? <><RefreshCw className="mr-2 size-4 animate-spin" />Importando clientes…</> : <><Upload className="mr-2 size-4" />Importar {validCount} clientes en {managers.length} carteras</>}
            </Button>
          </footer>
        </div>

        <Dialog open={confirmOpen && !importing} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle className="nh-section-title">Confirmar importación</DialogTitle><DialogDescription>Se crearán {validCount} clientes nuevos y se agruparán en carteras por gestor. Los nombres y direcciones existentes no se actualizarán. Escribe IMPORTAR para continuar.</DialogDescription></DialogHeader>
            <Input aria-label="Escribe IMPORTAR para confirmar" value={confirmText} onChange={(event) => setConfirmText(event.target.value.toUpperCase())} placeholder="IMPORTAR" autoFocus />
            <DialogFooter><Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button><Button onClick={() => { setConfirmOpen(false); onConfirm(); }} disabled={confirmText !== 'IMPORTAR'}>Confirmar importación</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={result !== null} onOpenChange={(open) => { if (!open) onDone(); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><div className="flex flex-col items-center gap-3 py-3 text-center"><div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"><CheckCircle2 className="size-10" /></div><DialogTitle className="nh-section-title">{result?.idempotentReplay ? 'Carga recuperada' : 'Importación completada'}</DialogTitle><DialogDescription>{result?.idempotentReplay ? 'El servidor confirmó que este lote ya se había guardado. No se duplicaron los clientes.' : `Se registraron ${result?.created || 0} clientes en ${result?.portfolios?.length || 0} carteras.`}</DialogDescription></div></DialogHeader>
            <div className="max-h-48 space-y-2 overflow-auto rounded-xl border border-border p-3 text-xs">
              {(result?.portfolios || []).map((portfolio) => <div key={portfolio.id} className="flex min-w-0 items-center justify-between gap-3"><span className="min-w-0 break-words font-semibold">{portfolio.assignedToName || portfolio.name}</span><Badge variant="secondary" className="shrink-0">{portfolio.memberCount} clientes</Badge></div>)}
              {(result?.warnings || []).slice(0, 8).map((warning, index) => <p key={`${index}-${warning}`} className="break-words text-amber-700 dark:text-amber-300">{warning}</p>)}
            </div>
            <DialogFooter><Button className="w-full" onClick={onDone}>Continuar a Carteras</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
