import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Upload } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { HorizontalTableScroller } from '../ui/HorizontalTableScroller';
import { ImportReviewSummary } from '../ui/ImportReviewSummary';
import { ImportProgressOverlay } from '../ui/ImportProgressOverlay';
import { ImportPreviewField, ImportPreviewMobileCard, importPreviewFieldClass } from '../ui/ImportPreviewMobile';
import { useImportPreviewLayout } from '../../hooks/useImportPreviewLayout';
import { PurchaseViewTutorial } from './PurchaseViewTutorial';

export type SupplierImportRow = {
  code: string;
  name: string;
  taxId: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  paymentTerms: string;
  status: 'ACTIVE' | 'INACTIVE';
  error?: string;
  warning?: string;
};

export type SupplierImportResult = {
  total: number;
  created: number;
  skipped: number;
  errors: string[];
  warnings: string[];
};

interface SupplierImportPreviewProps {
  rows: SupplierImportRow[];
  fileName: string;
  isSidebarCollapsed: boolean;
  importing: boolean;
  progress: number;
  result: SupplierImportResult | null;
  onRowUpdate: (index: number, field: keyof SupplierImportRow, value: string) => void;
  onBack: () => void;
  onConfirm: () => void;
  onDone: () => void;
}

export function SupplierImportPreview({
  rows,
  fileName,
  isSidebarCollapsed,
  importing,
  progress,
  result,
  onRowUpdate,
  onBack,
  onConfirm,
  onDone,
}: SupplierImportPreviewProps) {
  useImportPreviewLayout();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const validRows = rows.filter((row) => !row.error).length;
  const errorRows = rows.filter((row) => row.error).length;
  const warningRows = rows.filter((row) => !row.error && row.warning).length;

  useEffect(() => {
    if (!result) return;
    const timer = window.setTimeout(onDone, 2800);
    return () => window.clearTimeout(timer);
  }, [result, onDone]);

  const renderMobileCard = (row: SupplierImportRow, index: number) => (
    <ImportPreviewMobileCard index={index} title={row.name || row.code} error={row.error} warning={row.warning}>
      <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <ImportPreviewField label="Código" className="sm:col-span-2">
          <Input className={importPreviewFieldClass} value={row.code} placeholder="Automático" onChange={(event) => onRowUpdate(index, 'code', event.target.value)} disabled={importing} />
        </ImportPreviewField>
        <ImportPreviewField label="Nombre *" className="sm:col-span-2">
          <Input className={importPreviewFieldClass} value={row.name} onChange={(event) => onRowUpdate(index, 'name', event.target.value)} disabled={importing} />
        </ImportPreviewField>
        <ImportPreviewField label="RUC / identificación"><Input className={importPreviewFieldClass} value={row.taxId} onChange={(event) => onRowUpdate(index, 'taxId', event.target.value)} disabled={importing} /></ImportPreviewField>
        <ImportPreviewField label="Contacto"><Input className={importPreviewFieldClass} value={row.contactName} onChange={(event) => onRowUpdate(index, 'contactName', event.target.value)} disabled={importing} /></ImportPreviewField>
        <ImportPreviewField label="Correo"><Input className={importPreviewFieldClass} type="email" value={row.email} onChange={(event) => onRowUpdate(index, 'email', event.target.value)} disabled={importing} /></ImportPreviewField>
        <ImportPreviewField label="Teléfono"><Input className={importPreviewFieldClass} value={row.phone} onChange={(event) => onRowUpdate(index, 'phone', event.target.value)} disabled={importing} /></ImportPreviewField>
        <ImportPreviewField label="Dirección" className="sm:col-span-2"><Input className={importPreviewFieldClass} value={row.address} onChange={(event) => onRowUpdate(index, 'address', event.target.value)} disabled={importing} /></ImportPreviewField>
        <ImportPreviewField label="Ciudad"><Input className={importPreviewFieldClass} value={row.city} onChange={(event) => onRowUpdate(index, 'city', event.target.value)} disabled={importing} /></ImportPreviewField>
        <ImportPreviewField label="País"><Input className={importPreviewFieldClass} value={row.country} onChange={(event) => onRowUpdate(index, 'country', event.target.value)} disabled={importing} /></ImportPreviewField>
        <ImportPreviewField label="Condiciones de pago" className="sm:col-span-2"><Input className={importPreviewFieldClass} value={row.paymentTerms} placeholder="Contado / 30 días" onChange={(event) => onRowUpdate(index, 'paymentTerms', event.target.value)} disabled={importing} /></ImportPreviewField>
        <ImportPreviewField label="Estado" className="sm:col-span-2"><select className={importPreviewFieldClass} value={row.status} onChange={(event) => onRowUpdate(index, 'status', event.target.value)} disabled={importing}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></ImportPreviewField>
      </div>
    </ImportPreviewMobileCard>
  );

  return (
    <div className={`fixed inset-y-0 right-0 left-0 z-40 flex h-dvh min-h-0 flex-col overflow-hidden bg-background p-3 sm:p-6 ${isSidebarCollapsed ? 'lg:left-[72px]' : 'lg:left-[270px]'}`}>
      <div className="mx-auto flex min-h-0 w-full max-w-[1900px] flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4" data-tour="supplier-import-title">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Importación masiva</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Previsualizar proveedores</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Edita los datos antes de crear proveedores. El sistema asignará un código consecutivo por sucursal e ignorará cualquier código incluido en el archivo.</p>
            <div className="mt-3"><PurchaseViewTutorial view="suppliers" context="form" labelOverride="Cómo importar proveedores" stepKeys={['title', 'data', 'actions']} targetPrefix="supplier-import" /></div>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Archivo cargado</p><p className="truncate text-sm font-bold" title={fileName}>{fileName}</p></div>
          <div className="flex flex-wrap gap-2 text-xs"><Badge variant="secondary">Código automático</Badge><Badge variant="secondary">Importación repetible</Badge><Badge variant="secondary">Avisos no bloquean</Badge></div>
        </div>

        <ImportReviewSummary total={rows.length} valid={validRows} skipped={errorRows} warnings={warningRows} entityLabel="proveedores" />

        <div className="hidden min-h-0 flex-1 sm:flex" data-tour="supplier-import-data">
        <HorizontalTableScroller className="h-full" tableClassName="overflow-x-scroll overflow-y-auto scrollbar-overlay" label="Desplazamiento horizontal · columna por columna">
          <Table containerClassName="overflow-visible" containerStyle={{ width: '2500px', minWidth: '2500px', maxWidth: 'none' }} className="w-[2500px] min-w-[2500px]">
            <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
              <TableRow>
                <TableHead className="w-20 min-w-20 whitespace-nowrap text-center">Estado</TableHead>
                <TableHead className="w-40 min-w-40 whitespace-nowrap">Código</TableHead>
                <TableHead className="w-72 min-w-72 whitespace-nowrap">Nombre *</TableHead>
                <TableHead className="w-48 min-w-48 whitespace-nowrap">RUC / identificación</TableHead>
                <TableHead className="w-56 min-w-56 whitespace-nowrap">Contacto</TableHead>
                <TableHead className="w-64 min-w-64 whitespace-nowrap">Correo</TableHead>
                <TableHead className="w-44 min-w-44 whitespace-nowrap">Teléfono</TableHead>
                <TableHead className="w-72 min-w-72 whitespace-nowrap">Dirección</TableHead>
                <TableHead className="w-40 min-w-40 whitespace-nowrap">Ciudad</TableHead>
                <TableHead className="w-40 min-w-40 whitespace-nowrap">País</TableHead>
                <TableHead className="w-52 min-w-52 whitespace-nowrap">Condiciones de pago</TableHead>
                <TableHead className="w-36 min-w-36 whitespace-nowrap">Estado</TableHead>
                <TableHead className="w-72 min-w-72 whitespace-nowrap">Validación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index} className={row.error ? 'bg-rose-500/5' : row.warning ? 'bg-amber-500/5' : ''}>
                  <TableCell className="text-center">{row.error ? <AlertTriangle className="mx-auto size-4 text-rose-500" /> : row.warning ? <AlertTriangle className="mx-auto size-4 text-amber-500" /> : <CheckCircle2 className="mx-auto size-4 text-emerald-500" />}</TableCell>
                  <TableCell><Input className={importPreviewFieldClass} value={row.code} placeholder="Automático" onChange={(event) => onRowUpdate(index, 'code', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={importPreviewFieldClass} value={row.name} onChange={(event) => onRowUpdate(index, 'name', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={importPreviewFieldClass} value={row.taxId} onChange={(event) => onRowUpdate(index, 'taxId', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={importPreviewFieldClass} value={row.contactName} onChange={(event) => onRowUpdate(index, 'contactName', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={importPreviewFieldClass} type="email" value={row.email} onChange={(event) => onRowUpdate(index, 'email', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={importPreviewFieldClass} value={row.phone} onChange={(event) => onRowUpdate(index, 'phone', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={importPreviewFieldClass} value={row.address} onChange={(event) => onRowUpdate(index, 'address', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={importPreviewFieldClass} value={row.city} onChange={(event) => onRowUpdate(index, 'city', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={importPreviewFieldClass} value={row.country} onChange={(event) => onRowUpdate(index, 'country', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={importPreviewFieldClass} value={row.paymentTerms} placeholder="Contado / 30 días" onChange={(event) => onRowUpdate(index, 'paymentTerms', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><select className={importPreviewFieldClass} value={row.status} onChange={(event) => onRowUpdate(index, 'status', event.target.value)} disabled={importing}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></TableCell>
                  <TableCell className={row.error ? 'text-xs font-medium text-rose-600' : row.warning ? 'text-xs font-medium text-amber-600' : 'text-xs text-emerald-600'}>{row.error || row.warning || 'Correcto'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!rows.length && <div className="p-12 text-center text-sm text-muted-foreground">El archivo no contiene filas para importar.</div>}
        </HorizontalTableScroller>
        </div>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border bg-card p-3 sm:hidden" aria-label="Registros de proveedores para revisar">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/40 pb-3">
            <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Revisión móvil</p><p className="mt-1 text-xs text-muted-foreground">Edita un proveedor por tarjeta</p></div>
            <Badge variant="secondary" className="shrink-0 text-[10px]">{rows.length} registros</Badge>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pt-3 pr-1">
            {rows.length ? <div className="space-y-3">{rows.map(renderMobileCard)}</div> : <div className="p-8 text-center text-sm text-muted-foreground">El archivo no contiene filas para importar.</div>}
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4" data-tour="supplier-import-actions">
          <Button variant="outline" onClick={onBack} disabled={importing}><ArrowLeft className="mr-2 size-4" /> Volver a la carga</Button>
          <Button onClick={() => { setConfirmText(''); setConfirmOpen(true); }} disabled={importing || validRows === 0} className="font-bold"><Upload className="mr-2 size-4" /> {importing ? `Importando… ${progress}%` : `Importar ${validRows} válidos · omitir ${errorRows}`}</Button>
        </div>
      </div>

      <Dialog open={confirmOpen && !importing} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader data-tour="supplier-import-confirm-title"><DialogTitle>Confirmar importación</DialogTitle><DialogDescription>Se importarán {validRows} proveedores válidos y se omitirán {errorRows} con errores. Los {warningRows} avisos no bloquean la importación. Escribe IMPORTAR para continuar.</DialogDescription><PurchaseViewTutorial view="suppliers" context="form" labelOverride="Cómo confirmar importación" stepKeys={['title', 'data', 'actions']} targetPrefix="supplier-import-confirm" /></DialogHeader>
          <div data-tour="supplier-import-confirm-data">
          <Input value={confirmText} onChange={(event) => setConfirmText(event.target.value.toUpperCase())} placeholder="IMPORTAR" autoFocus />
          </div>
          <DialogFooter data-tour="supplier-import-confirm-actions"><Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button><Button onClick={() => { setConfirmOpen(false); onConfirm(); }} disabled={confirmText !== 'IMPORTAR'}>Confirmar importación</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportProgressOverlay open={importing} progress={progress} title="Importando proveedores" description="Validando y guardando los registros. No cierres esta ventana." />

      <Dialog open={result !== null} onOpenChange={(open) => { if (!open) onDone(); }}>
        <DialogContent className="!max-w-[min(92vw,520px)]">
          <DialogHeader><div className="flex flex-col items-center gap-3 py-3 text-center"><div className="flex size-20 animate-in zoom-in items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 duration-500"><CheckCircle2 className="size-12 animate-pulse" /></div><DialogTitle className="text-xl">Importación completada</DialogTitle><DialogDescription>Los proveedores válidos ya fueron registrados.</DialogDescription></div></DialogHeader>
          <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-emerald-500">{result?.created || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Creados</p></div><div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-amber-500">{result?.warnings.length || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Avisos</p></div><div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-rose-500">{result?.skipped || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Omitidos</p></div></div>
          {(result?.errors.length || result?.warnings.length) ? <div className="max-h-32 overflow-auto rounded-xl border p-3 text-xs text-muted-foreground"><p className="font-bold text-foreground">Detalles</p>{[...(result?.errors || []), ...(result?.warnings || [])].slice(0, 8).map((item, index) => <p key={index} className="mt-1">• {item}</p>)}</div> : null}
          <DialogFooter><Button className="w-full" onClick={onDone}>Continuar a proveedores</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
