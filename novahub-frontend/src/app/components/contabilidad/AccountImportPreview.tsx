import { AlertTriangle, ArrowLeft, CheckCircle2, Upload } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { HorizontalTableScroller } from '../ui/HorizontalTableScroller';
import type { ChartAccountCsvRow } from '../../types/accounting';

interface AccountImportPreviewProps {
  rows: ChartAccountCsvRow[];
  errors: string[];
  fileName: string;
  isSidebarCollapsed: boolean;
  importing: boolean;
  progress: number;
  onRowUpdate: (index: number, field: keyof ChartAccountCsvRow, value: string) => void;
  onBack: () => void;
  onConfirm: () => void;
}

const fieldClass = 'h-9 w-full min-w-0 rounded-lg border-border/70 bg-background/70 text-xs';

export function AccountImportPreview({ rows, errors, fileName, isSidebarCollapsed, importing, progress, onRowUpdate, onBack, onConfirm }: AccountImportPreviewProps) {
  return (
    <div className={`accounting-module fixed inset-y-0 right-0 left-0 z-40 flex h-dvh min-h-0 min-w-0 flex-col overflow-hidden bg-background p-3 sm:p-6 ${isSidebarCollapsed ? 'lg:left-[72px]' : 'lg:left-[270px]'}`}>
      <div className="mx-auto flex min-h-0 w-full max-w-[1900px] flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Importación masiva</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Previsualizar cuentas</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Revisa y corrige las cuentas antes de cargarlas al plan de cuentas de esta empresa.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
            <Badge variant="outline">{rows.length} registros</Badge>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">{rows.length} válidos</Badge>
            <Badge variant="outline" className={errors.length ? 'border-rose-500/30 text-rose-600' : ''}>{errors.length} errores</Badge>
          </div>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Archivo Excel cargado</p><p className="truncate text-sm font-bold" title={fileName}>{fileName}</p></div>
          <div className="flex flex-wrap gap-2 text-xs"><Badge variant="secondary">Códigos únicos por empresa</Badge><Badge variant="secondary">Importación repetible</Badge><Badge variant="secondary">Jerarquía por código padre</Badge></div>
        </div>

        <HorizontalTableScroller className="hidden min-h-0 flex-1 sm:block" tableClassName="overflow-x-scroll overflow-y-auto scrollbar-overlay" label="Desplazamiento horizontal · columna por columna">
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
              {rows.map((row, index) => (
                <TableRow key={`${row.codigo}-${index}`}>
                  <TableCell className="text-center"><CheckCircle2 className="mx-auto size-4 text-emerald-500" /></TableCell>
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
              ))}
            </TableBody>
          </Table>
          {!rows.length && <div className="p-12 text-center text-sm text-muted-foreground">El archivo no contiene cuentas válidas.</div>}
        </HorizontalTableScroller>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto sm:hidden">
          {rows.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">El archivo no contiene cuentas válidas.</div>
          ) : rows.map((row, index) => (
            <div key={`${row.codigo}-${index}`} className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
              <div className="flex items-start gap-2">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                  <CheckCircle2 className="size-4 text-emerald-500" />
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
            </div>
          ))}
        </div>

        {errors.length > 0 && (
          <div className="max-h-28 overflow-auto rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-xs text-rose-600">
            <p className="mb-1 flex items-center gap-2 font-bold"><AlertTriangle className="size-4" /> Filas omitidas</p>
            {errors.slice(0, 12).map((error, index) => <p key={index}>• {error}</p>)}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <Button variant="outline" onClick={onBack} disabled={importing}><ArrowLeft className="mr-2 size-4" /> Volver a la carga</Button>
          <Button onClick={onConfirm} disabled={importing || rows.length === 0} className="font-bold"><Upload className="mr-2 size-4" /> {importing ? `Importando… ${progress}%` : `Importar ${rows.length} cuenta(s)`}</Button>
        </div>
      </div>

      <Dialog open={importing} onOpenChange={() => undefined}>
        <DialogContent className="max-w-md [&>button]:hidden" onInteractOutside={(event) => event.preventDefault()} onEscapeKeyDown={(event) => event.preventDefault()}>
          <div className="flex flex-col items-center gap-5 py-5 text-center">
            <div className="relative flex size-24 items-center justify-center rounded-full border-4 border-primary/20 bg-primary/5"><div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary" /><span className="text-xl font-black text-primary">{progress}%</span></div>
            <div><DialogTitle className="text-xl">Importando cuentas</DialogTitle><DialogDescription className="mt-2">Guardando las cuentas en la empresa actual. No cierres esta ventana.</DialogDescription></div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${Math.max(progress, 3)}%` }} /></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
