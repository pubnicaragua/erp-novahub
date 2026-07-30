import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Upload } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { HorizontalTableScroller } from '../ui/HorizontalTableScroller';

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

export function CustomerImportPreview({
  rows,
  fileName,
  priceLists,
  isSidebarCollapsed,
  importing,
  progress,
  result,
  onRowUpdate,
  onBack,
  onConfirm,
  onDone,
}: CustomerImportPreviewProps) {
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

  return (
    <div className={`fixed inset-y-0 right-0 left-0 z-40 flex h-dvh min-h-0 flex-col overflow-hidden bg-background p-4 sm:p-6 ${isSidebarCollapsed ? 'lg:left-[72px]' : 'lg:left-[270px]'}`}>
      <div className="mx-auto flex min-h-0 w-full max-w-[1900px] flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Importación masiva</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Previsualizar clientes</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Edita los datos antes de crear los clientes. El número de cliente se genera automáticamente y no se importa desde el archivo.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
            <Badge variant="outline">{rows.length} registros</Badge>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">{validRows} válidos</Badge>
            <Badge variant="outline" className={warningRows ? 'border-amber-500/30 text-amber-600' : ''}>{warningRows} avisos</Badge>
            <Badge variant="outline" className={errorRows ? 'border-rose-500/30 text-rose-600' : ''}>{errorRows} errores</Badge>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Archivo cargado</p><p className="truncate text-sm font-bold" title={fileName}>{fileName}</p></div>
          <div className="flex flex-wrap gap-2 text-xs"><Badge variant="secondary">Código automático</Badge><Badge variant="secondary">Importación repetible</Badge><Badge variant="secondary">Avisos no bloquean</Badge></div>
        </div>

        <HorizontalTableScroller className="min-h-0 flex-1" tableClassName="overflow-x-scroll overflow-y-auto scrollbar-overlay" label="Desplazamiento horizontal · columna por columna">
          <Table containerClassName="overflow-visible" containerStyle={{ width: '3100px', minWidth: '3100px', maxWidth: 'none' }} className="w-[3100px] min-w-[3100px]">
            <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
              <TableRow>
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
                <TableHead className="w-36 min-w-36 whitespace-nowrap">Estado</TableHead>
                <TableHead className="w-72 min-w-72 whitespace-nowrap">Validación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={`${row.name}-${index}`} className={row.error ? 'bg-rose-500/5' : row.warning ? 'bg-amber-500/5' : ''}>
                  <TableCell className="text-center">{row.error ? <AlertTriangle className="mx-auto size-4 text-rose-500" /> : row.warning ? <AlertTriangle className="mx-auto size-4 text-amber-500" /> : <CheckCircle2 className="mx-auto size-4 text-emerald-500" />}</TableCell>
                  <TableCell><Input className={fieldClass} value={row.name} onChange={(event) => onRowUpdate(index, 'name', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><select className={fieldClass} value={row.type} onChange={(event) => onRowUpdate(index, 'type', event.target.value)} disabled={importing}><option value="INDIVIDUAL">Particular</option><option value="COMPANY">Empresa</option></select></TableCell>
                  <TableCell><Input className={fieldClass} value={row.fiscalRegime} placeholder="General" onChange={(event) => onRowUpdate(index, 'fiscalRegime', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><select className={fieldClass} value={row.priceListCode} onChange={(event) => onRowUpdate(index, 'priceListCode', event.target.value)} disabled={importing}><option value="">Sin lista asignada</option>{priceLists.map((list) => <option key={list.id} value={list.code}>{list.name}</option>)}</select></TableCell>
                  <TableCell><Input className={fieldClass} value={row.taxId} onChange={(event) => onRowUpdate(index, 'taxId', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={fieldClass} value={row.ruc} onChange={(event) => onRowUpdate(index, 'ruc', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={fieldClass} type="email" value={row.email} onChange={(event) => onRowUpdate(index, 'email', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={fieldClass} value={row.phone} onChange={(event) => onRowUpdate(index, 'phone', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={fieldClass} value={row.address} onChange={(event) => onRowUpdate(index, 'address', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={fieldClass} value={row.city} onChange={(event) => onRowUpdate(index, 'city', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={fieldClass} value={row.department} onChange={(event) => onRowUpdate(index, 'department', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className={fieldClass} value={row.country} onChange={(event) => onRowUpdate(index, 'country', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><Input className="h-9 w-full min-w-0 rounded-lg border-border/70 bg-background/70 text-right text-xs" type="number" min="0" value={row.creditLimit} onChange={(event) => onRowUpdate(index, 'creditLimit', event.target.value)} disabled={importing} /></TableCell>
                  <TableCell><select className={fieldClass} value={row.status} onChange={(event) => onRowUpdate(index, 'status', event.target.value)} disabled={importing}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></TableCell>
                  <TableCell className={row.error ? 'text-xs font-medium text-rose-600' : row.warning ? 'text-xs font-medium text-amber-600' : 'text-xs text-emerald-600'}>{row.error || row.warning || 'Correcto'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!rows.length && <div className="p-12 text-center text-sm text-muted-foreground">El archivo no contiene filas para importar.</div>}
        </HorizontalTableScroller>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <Button variant="outline" onClick={onBack} disabled={importing}><ArrowLeft className="mr-2 size-4" /> Volver a la carga</Button>
          <Button onClick={() => { setConfirmText(''); setConfirmOpen(true); }} disabled={importing || validRows === 0} className="font-bold"><Upload className="mr-2 size-4" /> {importing ? `Importando… ${progress}%` : `Importar ${validRows} clientes`}</Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar importación</DialogTitle><DialogDescription>Se crearán {validRows} clientes. Las filas con errores se omitirán y los avisos se importarán conservando el dato válido. Escribe IMPORTAR para continuar.</DialogDescription></DialogHeader>
          <Input value={confirmText} onChange={(event) => setConfirmText(event.target.value.toUpperCase())} placeholder="IMPORTAR" autoFocus />
          <DialogFooter><Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button><Button onClick={() => { setConfirmOpen(false); onConfirm(); }} disabled={confirmText !== 'IMPORTAR'}>Confirmar importación</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importing} onOpenChange={() => undefined}>
        <DialogContent className="max-w-md [&>button]:hidden" onInteractOutside={(event) => event.preventDefault()} onEscapeKeyDown={(event) => event.preventDefault()}>
          <div className="flex flex-col items-center gap-5 py-5 text-center"><div className="relative flex size-24 items-center justify-center rounded-full border-4 border-primary/20 bg-primary/5"><div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary" /><span className="text-xl font-black text-primary">{progress}%</span></div><div><DialogTitle className="text-xl">Importando clientes</DialogTitle><DialogDescription className="mt-2">Generando números de cliente y guardando la información. No cierres esta ventana.</DialogDescription></div><div className="h-3 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${Math.max(progress, 3)}%` }} /></div></div>
        </DialogContent>
      </Dialog>

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
