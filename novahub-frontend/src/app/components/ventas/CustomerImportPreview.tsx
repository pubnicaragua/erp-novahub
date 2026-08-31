import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Upload } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { HorizontalTableScroller } from '../ui/HorizontalTableScroller';
import { ImportReviewSummary } from '../ui/ImportReviewSummary';
import { ImportProgressOverlay } from '../ui/ImportProgressOverlay';
import { useImportPreviewLayout } from '../../hooks/useImportPreviewLayout';
import { VirtualizedImportList, useVirtualizedImportRows } from '../ui/VirtualizedImportList';

export type CustomerImportRow = {
  name: string;
  type: 'INDIVIDUAL' | 'COMPANY';
  fiscalRegime: string;
  priceListCode: string;
  taxId: string;
  ruc: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  department: string;
  country: string;
  creditLimit: number | '';
  creditLimitCurrency: 'NIO' | 'USD';
  creditLimitCurrencyError?: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  notes: string;
  error?: string;
  warning?: string;
};

export type CustomerImportResult = { total: number; created: number; skipped: number; errors: string[]; warnings: string[] };

interface CustomerImportPreviewProps {
  rows: CustomerImportRow[];
  fileName: string;
  priceLists: Array<{ id: string; code: string; name: string }>;
  defaultCreditLimitCurrency: 'NIO' | 'USD';
  isSidebarCollapsed: boolean;
  importing: boolean;
  progress: number;
  result: CustomerImportResult | null;
  onRowUpdate: (index: number, field: keyof CustomerImportRow, value: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  onDone: () => void;
}

const fieldClass = 'h-9 w-full min-w-0 rounded-lg border-border/70 bg-background/70 text-xs';

function ImportField({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`min-w-0 space-y-1 ${className}`}>
      <span className="block truncate text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function CustomerImportMobileCard({
  row,
  index,
  priceLists,
  importing,
  onRowUpdate,
}: {
  row: CustomerImportRow;
  index: number;
  priceLists: Array<{ id: string; code: string; name: string }>;
  importing: boolean;
  onRowUpdate: (index: number, field: keyof CustomerImportRow, value: string) => void;
}) {
  const update = (field: keyof CustomerImportRow, value: string) => onRowUpdate(index, field, value);
  const validationClass = row.error
    ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
    : row.warning
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
      : 'border-emerald-500/25 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300';

  return (
    <article className={`min-w-0 rounded-2xl border p-3 shadow-sm ${row.error ? 'border-rose-500/35 bg-rose-500/[0.03]' : row.warning ? 'border-amber-500/35 bg-amber-500/[0.03]' : 'border-border/60 bg-card'}`}>
      <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border/40 pb-3">
        <div className="flex min-w-0 items-start gap-2">
          {row.error ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-500" /> : row.warning ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />}
          <div className="min-w-0">
            <p className="truncate text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">Registro {index + 1}</p>
            <p className="mt-0.5 break-words text-sm font-black text-foreground">{row.name || 'Cliente sin nombre'}</p>
          </div>
        </div>
        <Badge variant="outline" className={`shrink-0 border-none text-[9px] font-black uppercase ${row.error ? 'text-rose-600' : row.warning ? 'text-amber-600' : 'text-emerald-600'}`}>
          {row.error ? 'Error' : row.warning ? 'Aviso' : 'Correcto'}
        </Badge>
      </div>

      <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <ImportField label="Nombre *" className="sm:col-span-2">
          <Input className={fieldClass} value={row.name} onChange={(event) => update('name', event.target.value)} disabled={importing} />
        </ImportField>
        <ImportField label="Tipo *">
          <Select value={row.type} onValueChange={(value) => update('type', value)} disabled={importing}>
            <SelectTrigger size="sm" className={fieldClass}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="INDIVIDUAL">Particular</SelectItem><SelectItem value="COMPANY">Empresa</SelectItem></SelectContent>
          </Select>
        </ImportField>
        <ImportField label="Régimen fiscal">
          <Input className={fieldClass} value={row.fiscalRegime} placeholder="General" onChange={(event) => update('fiscalRegime', event.target.value)} disabled={importing} />
        </ImportField>
        <ImportField label="Lista de precios" className="sm:col-span-2">
          <Select value={row.priceListCode || '__no_price_list__'} onValueChange={(value) => update('priceListCode', value === '__no_price_list__' ? '' : value)} disabled={importing}>
            <SelectTrigger size="sm" className={fieldClass}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="__no_price_list__">Sin lista asignada</SelectItem>{priceLists.map((list) => <SelectItem key={list.id} value={list.code}>{list.name}</SelectItem>)}</SelectContent>
          </Select>
        </ImportField>
        <ImportField label="Cédula"><Input className={fieldClass} value={row.taxId} onChange={(event) => update('taxId', event.target.value)} disabled={importing} /></ImportField>
        <ImportField label="RUC"><Input className={fieldClass} value={row.ruc} onChange={(event) => update('ruc', event.target.value)} disabled={importing} /></ImportField>
        <ImportField label="Correo"><Input className={fieldClass} type="email" value={row.email} onChange={(event) => update('email', event.target.value)} disabled={importing} /></ImportField>
        <ImportField label="Teléfono"><Input className={fieldClass} value={row.phone} onChange={(event) => update('phone', event.target.value)} disabled={importing} /></ImportField>
        <ImportField label="Dirección" className="sm:col-span-2"><Input className={fieldClass} value={row.address} onChange={(event) => update('address', event.target.value)} disabled={importing} /></ImportField>
        <ImportField label="Ciudad"><Input className={fieldClass} value={row.city} onChange={(event) => update('city', event.target.value)} disabled={importing} /></ImportField>
        <ImportField label="Departamento"><Input className={fieldClass} value={row.department} onChange={(event) => update('department', event.target.value)} disabled={importing} /></ImportField>
        <ImportField label="País"><Input className={fieldClass} value={row.country} onChange={(event) => update('country', event.target.value)} disabled={importing} /></ImportField>
        <ImportField label="Límite de crédito"><Input className={`${fieldClass} text-right`} type="number" min="0" value={row.creditLimit} onChange={(event) => update('creditLimit', event.target.value)} disabled={importing} /></ImportField>
        <ImportField label="Moneda del límite">
          <Select value={row.creditLimitCurrency} onValueChange={(value) => update('creditLimitCurrency', value)} disabled={importing}>
            <SelectTrigger size="sm" className={fieldClass}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="NIO">Córdobas (NIO)</SelectItem><SelectItem value="USD">Dólares (USD)</SelectItem></SelectContent>
          </Select>
        </ImportField>
        <ImportField label="Estado">
          <Select value={row.status} onValueChange={(value) => update('status', value)} disabled={importing}>
            <SelectTrigger size="sm" className={fieldClass}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="ACTIVE">Activo</SelectItem><SelectItem value="INACTIVE">Inactivo</SelectItem></SelectContent>
          </Select>
        </ImportField>
      </div>

      <div className={`mt-3 rounded-xl border px-3 py-2 text-xs font-medium ${validationClass}`}>
        <span className="mr-1 text-[9px] font-black uppercase tracking-[0.14em]">Validación:</span>{row.error || row.warning || 'Correcto'}
      </div>
    </article>
  );
}

export function CustomerImportPreview({
  rows,
  fileName,
  priceLists,
  defaultCreditLimitCurrency,
  isSidebarCollapsed,
  importing,
  progress,
  result,
  onRowUpdate,
  onBack,
  onConfirm,
  onDone,
}: CustomerImportPreviewProps) {
  useImportPreviewLayout();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const gridTemplate = '80px 288px 160px 192px 224px 192px 176px 256px 176px 288px 160px 192px 160px 176px 144px 144px 288px';
  const tableVirtualizer = useVirtualizedImportRows(rows.length, tableScrollRef, 58);
  const validRows = rows.filter((row) => !row.error).length;
  const errorRows = rows.filter((row) => row.error).length;
  const warningRows = rows.filter((row) => !row.error && row.warning).length;

  useEffect(() => {
    if (!result) return;
    const timer = window.setTimeout(onDone, 2800);
    return () => window.clearTimeout(timer);
  }, [result, onDone]);

  return (
    <div className={`fixed inset-y-0 right-0 left-0 z-40 flex h-dvh min-h-0 flex-col overflow-hidden bg-background p-3 sm:p-6 ${isSidebarCollapsed ? 'lg:left-[72px]' : 'lg:left-[270px]'}`}>
      <div className="mx-auto flex min-h-0 w-full max-w-[1900px] flex-1 flex-col gap-3 sm:gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Importación masiva</p>
            <h1 className="mt-1 text-xl font-black tracking-tight sm:text-3xl">Previsualizar clientes</h1>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground sm:text-sm">Edita los datos antes de crear los clientes. El número de cliente se genera automáticamente. La moneda del límite queda visible por fila; si el archivo no la indica, se usa {defaultCreditLimitCurrency}.</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Archivo cargado</p><p className="truncate text-sm font-bold" title={fileName}>{fileName}</p></div>
          <div className="flex flex-wrap gap-2 text-xs"><Badge variant="secondary">Código automático</Badge><Badge variant="secondary">Importación repetible</Badge><Badge variant="secondary">Límite por moneda</Badge><Badge variant="secondary">Avisos no bloquean</Badge></div>
        </div>

        <ImportReviewSummary total={rows.length} valid={validRows} skipped={errorRows} warnings={warningRows} entityLabel="clientes" />

        <div className="hidden min-h-0 min-w-0 max-w-full flex-1 sm:flex">
          <HorizontalTableScroller scrollRef={tableScrollRef} scrollBehavior="auto" className="min-h-0 flex-1" tableClassName="scrollbar-overlay" label="Desplazamiento horizontal · columna por columna">
          <Table containerClassName="overflow-visible" containerStyle={{ width: '3100px', minWidth: '3100px', maxWidth: 'none' }} className="block w-[3100px] min-w-[3100px]">
            <TableHeader className="sticky top-0 z-10 block bg-muted/95 backdrop-blur">
              <TableRow style={{ display: 'grid', gridTemplateColumns: gridTemplate }}>
                <TableHead className="w-20 min-w-20 whitespace-nowrap text-center">Estado</TableHead>
                <TableHead className="w-72 min-w-72 whitespace-nowrap">Nombre *</TableHead>
                <TableHead className="w-40 min-w-40 whitespace-nowrap">Tipo *</TableHead>
                <TableHead className="w-48 min-w-48 whitespace-nowrap">Régimen fiscal</TableHead>
                <TableHead className="w-56 min-w-56 whitespace-nowrap">Lista de precios</TableHead>
                <TableHead className="w-48 min-w-48 whitespace-nowrap">Cédula</TableHead>
                <TableHead className="w-44 min-w-44 whitespace-nowrap">RUC</TableHead>
                <TableHead className="w-64 min-w-64 whitespace-nowrap">Correo</TableHead>
                <TableHead className="w-44 min-w-44 whitespace-nowrap">Teléfono</TableHead>
                <TableHead className="w-72 min-w-72 whitespace-nowrap">Dirección</TableHead>
                <TableHead className="w-40 min-w-40 whitespace-nowrap">Ciudad</TableHead>
                <TableHead className="w-48 min-w-48 whitespace-nowrap">Departamento</TableHead>
                <TableHead className="w-40 min-w-40 whitespace-nowrap">País</TableHead>
                <TableHead className="w-44 min-w-44 whitespace-nowrap text-right">Límite crédito</TableHead>
                <TableHead className="w-36 min-w-36 whitespace-nowrap">Moneda límite</TableHead>
                <TableHead className="w-36 min-w-36 whitespace-nowrap">Estado</TableHead>
                <TableHead className="w-72 min-w-72 whitespace-nowrap">Validación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody style={{ display: 'block', position: 'relative', height: tableVirtualizer.getTotalSize() }}>
              {tableVirtualizer.getVirtualItems().map((virtualRow) => {
                const index = virtualRow.index;
                const row = rows[index];
                return (
                <TableRow key={virtualRow.key} ref={tableVirtualizer.measureElement} data-index={virtualRow.index} style={{ display: 'grid', gridTemplateColumns: gridTemplate, position: 'absolute', left: 0, top: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }} className={row.error ? 'bg-rose-500/5' : row.warning ? 'bg-amber-500/5' : ''}>
                  <TableCell className="text-center">{row.error ? <AlertTriangle className="mx-auto size-4 text-rose-500" /> : row.warning ? <AlertTriangle className="mx-auto size-4 text-amber-500" /> : <CheckCircle2 className="mx-auto size-4 text-emerald-500" />}</TableCell>
                  <TableCell><Input className={fieldClass} value={row.name} onChange={(event) => onRowUpdate(index, 'name', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Select value={row.type} onValueChange={(value) => onRowUpdate(index, 'type', value)} disabled={importing}><SelectTrigger size="sm" className={fieldClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INDIVIDUAL">Particular</SelectItem><SelectItem value="COMPANY">Empresa</SelectItem></SelectContent></Select></TableCell>
                  <TableCell><Input className={fieldClass} value={row.fiscalRegime} placeholder="General" onChange={(event) => onRowUpdate(index, 'fiscalRegime', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Select value={row.priceListCode || '__no_price_list__'} onValueChange={(value) => onRowUpdate(index, 'priceListCode', value === '__no_price_list__' ? '' : value)} disabled={importing}><SelectTrigger size="sm" className={fieldClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__no_price_list__">Sin lista asignada</SelectItem>{priceLists.map((list) => <SelectItem key={list.id} value={list.code}>{list.name}</SelectItem>)}</SelectContent></Select></TableCell>
                  <TableCell><Input className={fieldClass} value={row.taxId} onChange={(event) => onRowUpdate(index, 'taxId', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={fieldClass} value={row.ruc} onChange={(event) => onRowUpdate(index, 'ruc', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={fieldClass} type="email" value={row.email} onChange={(event) => onRowUpdate(index, 'email', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={fieldClass} value={row.phone} onChange={(event) => onRowUpdate(index, 'phone', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={fieldClass} value={row.address} onChange={(event) => onRowUpdate(index, 'address', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={fieldClass} value={row.city} onChange={(event) => onRowUpdate(index, 'city', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={fieldClass} value={row.department} onChange={(event) => onRowUpdate(index, 'department', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={fieldClass} value={row.country} onChange={(event) => onRowUpdate(index, 'country', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className="h-9 w-full min-w-0 rounded-lg border-border/70 bg-background/70 text-right text-xs" type="number" min="0" value={row.creditLimit} onChange={(event) => onRowUpdate(index, 'creditLimit', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Select value={row.creditLimitCurrency} onValueChange={(value) => onRowUpdate(index, 'creditLimitCurrency', value)} disabled={importing}><SelectTrigger size="sm" className={fieldClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NIO">NIO</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></TableCell>
                  <TableCell><Select value={row.status} onValueChange={(value) => onRowUpdate(index, 'status', value)} disabled={importing}><SelectTrigger size="sm" className={fieldClass}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Activo</SelectItem><SelectItem value="INACTIVE">Inactivo</SelectItem></SelectContent></Select></TableCell>
                  <TableCell className={row.error ? 'text-xs font-medium text-rose-600' : row.warning ? 'text-xs font-medium text-amber-600' : 'text-xs text-emerald-600'}>{row.error || row.warning || 'Correcto'}</TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!rows.length && <div className="p-12 text-center text-sm text-muted-foreground">El archivo no contiene filas para importar.</div>}
          </HorizontalTableScroller>
        </div>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-card p-3 sm:hidden" aria-label="Registros de clientes para revisar">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 pb-3">
            <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Revisión móvil</p><p className="mt-1 text-xs text-muted-foreground">Edita un cliente por tarjeta</p></div>
            <Badge variant="secondary" className="shrink-0 text-[10px]">{rows.length} registros</Badge>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            {rows.length ? <VirtualizedImportList count={rows.length} scrollRef={mobileScrollRef} estimateSize={390} overscan={2} className="pt-3 pr-1" renderItem={(index) => <div className="pb-3"><CustomerImportMobileCard row={rows[index]} index={index} priceLists={priceLists} importing={importing} onRowUpdate={onRowUpdate} /></div>} /> : <div className="p-8 text-center text-sm text-muted-foreground">El archivo no contiene filas para importar.</div>}
          </div>
        </section>

        <div className="flex shrink-0 flex-col items-stretch gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pt-4">
          <Button variant="outline" onClick={onBack} disabled={importing} className="w-full sm:w-auto"><ArrowLeft className="mr-2 size-4" /> Volver a la carga</Button>
          <Button onClick={() => { setConfirmText(''); setConfirmOpen(true); }} disabled={importing || validRows === 0} className="w-full font-bold sm:w-auto"><Upload className="mr-2 size-4" /> {importing ? `Importando… ${progress}%` : `Importar ${validRows} válidos · omitir ${errorRows}`}</Button>
        </div>
      </div>

      <Dialog open={confirmOpen && !importing} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar importación</DialogTitle><DialogDescription>Se importarán {validRows} clientes válidos y se omitirán {errorRows} con errores. Los {warningRows} avisos no bloquean la carga. Escribe IMPORTAR para continuar.</DialogDescription></DialogHeader>
          <Input value={confirmText} onChange={(event) => setConfirmText(event.target.value.toUpperCase())} placeholder="IMPORTAR" autoFocus />
          <DialogFooter><Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button><Button onClick={() => { setConfirmOpen(false); onConfirm(); }} disabled={confirmText !== 'IMPORTAR'}>Confirmar importación</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportProgressOverlay open={importing} progress={progress} title="Importando clientes" description="Generando números de cliente y guardando la información. No cierres esta ventana." />

      <Dialog open={result !== null} onOpenChange={(open) => { if (!open) onDone(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><div className="flex flex-col items-center gap-3 py-3 text-center"><div className="flex size-20 animate-in zoom-in items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 duration-500"><CheckCircle2 className="size-12 animate-pulse" /></div><DialogTitle className="text-xl">Importación completada</DialogTitle><DialogDescription>Los clientes válidos ya fueron registrados.</DialogDescription></div></DialogHeader>
          <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-emerald-500">{result?.created || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Creados</p></div><div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-amber-500">{result?.warnings.length || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Avisos</p></div><div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-rose-500">{result?.skipped || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Omitidos</p></div></div>
          {(result?.errors.length || result?.warnings.length) ? <div className="max-h-32 overflow-auto rounded-xl border p-3 text-xs text-muted-foreground"><p className="font-bold text-foreground">Detalles</p>{[...(result?.errors || []), ...(result?.warnings || [])].slice(0, 8).map((item, index) => <p key={index} className="mt-1">• {item}</p>)}</div> : null}
          <DialogFooter><Button className="w-full" onClick={onDone}>Continuar a clientes</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
