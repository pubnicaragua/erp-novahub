import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, ImageDown, Moon, RefreshCw, Table2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { masterConsoleService, type MasterConsoleTenantStorage } from '../services/master-console.service';
import { useTenantQuery } from '../hooks/useTenantQuery';
import { getCurrencyDecimalPlaces } from '../utils/currency';

function formatBytes(bytes: number | undefined) {
  const value = Number(bytes || 0);
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / (1024 ** unitIndex);
  return `${amount >= 100 || unitIndex === 0 ? amount.toFixed(0) : amount.toFixed(getCurrencyDecimalPlaces())} ${units[unitIndex]}`;
}

const count = (value: number | undefined) => new Intl.NumberFormat('es-NI').format(Number(value || 0));
const INACTIVITY_OPTIONS = [30, 60, 90, 180, 365];

function Tile({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{icon}{label}</div>
      <p className="mt-2 text-2xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function TenantTable({ rows, caption }: { rows: MasterConsoleTenantStorage[]; caption: string }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">Sin empresas en esta lista.</p>;
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[640px]">
        <caption className="sr-only">{caption}</caption>
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <TableHead className="text-right">Archivos</TableHead>
            <TableHead className="text-right">Tamaño</TableHead>
            <TableHead className="text-right">Ahorro estimado</TableHead>
            <TableHead>Última actividad</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-semibold">
                {row.name}
                {row.suspended && <Badge variant="outline" className="ml-2 text-[10px]">Suspendida</Badge>}
                {!row.suspended && row.inactive && <Badge variant="outline" className="ml-2 text-[10px]">Inactiva</Badge>}
              </TableCell>
              <TableCell className="text-right">{count(row.objects)}</TableCell>
              <TableCell className="text-right">{formatBytes(row.bytes)}</TableCell>
              <TableCell className="text-right">{row.recoverableBytes > 0 ? formatBytes(row.recoverableBytes) : '—'}</TableCell>
              <TableCell>{row.idleDays === null ? '—' : row.idleDays === 0 ? 'Hoy' : `hace ${count(row.idleDays)} d`}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Detalle del consumo de almacenamiento para el super administrador: en qué se va el espacio, qué imágenes se pueden
 * volver a comprimir y qué empresas llevan meses sin actividad. Solo lee; carga cuando se abre.
 */
export function AdminStorageReport() {
  const [open, setOpen] = useState(false);
  const [inactiveDays, setInactiveDays] = useState(90);
  const query = useTenantQuery(
    ['master-console-storage-report', inactiveDays],
    (signal) => masterConsoleService.getStorageReport(inactiveDays, signal),
    { enabled: open, staleTime: 5 * 60_000 },
  );
  const report = query.data;

  return (
    <Card className="rounded-3xl border-border/50 bg-card/30 backdrop-blur-md">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg font-bold uppercase tracking-tight">
            <ImageDown className="size-5 text-primary" /> Dónde se va el espacio
          </CardTitle>
          <CardDescription>
            Imágenes pesadas, empresas sin actividad y tablas más grandes, para decidir dónde optimizar. Solo lectura: no borra nada.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" className="w-fit rounded-xl" aria-expanded={open} aria-controls="admin-storage-report" onClick={() => setOpen((current) => !current)}>
          {open ? <ChevronUp className="mr-2 size-4" aria-hidden="true" /> : <ChevronDown className="mr-2 size-4" aria-hidden="true" />}
          {open ? 'Ocultar detalle' : 'Ver detalle'}
        </Button>
      </CardHeader>
      {open && (
        <CardContent id="admin-storage-report" className="space-y-6">
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1.5 text-xs font-bold text-muted-foreground">
              <span>Empresa inactiva si nadie entra hace</span>
              <select
                value={inactiveDays}
                onChange={(event) => setInactiveDays(Number(event.target.value))}
                className="erp-filter-select block h-10 rounded-xl border border-border bg-background px-3 text-sm font-normal"
              >
                {INACTIVITY_OPTIONS.map((days) => <option key={days} value={days}>{days} días</option>)}
              </select>
            </label>
            <Button type="button" variant="ghost" className="rounded-xl" onClick={() => void query.refetch()} disabled={query.isFetching}>
              <RefreshCw className={`mr-2 size-4 ${query.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />Actualizar
            </Button>
          </div>

          {query.isLoading && <p className="text-sm text-muted-foreground" role="status">Calculando el detalle…</p>}
          {query.isError && <p className="text-sm font-semibold text-destructive" role="alert">No se pudo cargar el detalle. Vuelve a intentarlo.</p>}

          {report && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Tile
                  icon={<ImageDown className="size-4" aria-hidden="true" />}
                  label="Imágenes pesadas"
                  value={formatBytes(report.heavyImages.bytes)}
                  detail={`${count(report.heavyImages.objects)} de más de ${formatBytes(report.heavyImageThresholdBytes)}; se recuperarían unos ${formatBytes(report.heavyImages.estimatedRecoverableBytes)} (estimación)`}
                />
                <Tile
                  icon={<Moon className="size-4" aria-hidden="true" />}
                  label={`Empresas inactivas (${report.inactiveDays} d)`}
                  value={formatBytes(report.inactiveTenants.bytes)}
                  detail={`${count(report.inactiveTenants.count)} empresas · ${count(report.inactiveTenants.objects)} archivos`}
                />
                <Tile
                  icon={<Table2 className="size-4" aria-hidden="true" />}
                  label="Archivos sin empresa"
                  value={formatBytes(report.withoutOwner.bytes)}
                  detail={`${count(report.withoutOwner.objects)} archivos sin empresa ni grupo (posibles huérfanos)`}
                />
              </div>

              <section className="space-y-2">
                <h3 className="text-sm font-black uppercase tracking-wide">Por tipo de archivo</h3>
                <div className="overflow-x-auto">
                  <Table className="min-w-[420px]">
                    <caption className="sr-only">Almacenamiento por tipo de archivo</caption>
                    <TableHeader><TableRow><TableHead>Tipo</TableHead><TableHead className="text-right">Archivos</TableHead><TableHead className="text-right">Tamaño</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {report.byKind.map((row) => (
                        <TableRow key={row.kind}><TableCell className="font-semibold">{row.label}</TableCell><TableCell className="text-right">{count(row.objects)}</TableCell><TableCell className="text-right">{formatBytes(row.bytes)}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-black uppercase tracking-wide">Empresas inactivas con más archivos</h3>
                <TenantTable rows={report.inactiveTenants.top} caption="Empresas inactivas con más archivos" />
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-black uppercase tracking-wide">Empresas que más espacio usan</h3>
                <TenantTable rows={report.tenants} caption="Empresas que más espacio usan" />
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-black uppercase tracking-wide">Archivos más pesados</h3>
                <div className="overflow-x-auto">
                  <Table className="min-w-[640px]">
                    <caption className="sr-only">Archivos más pesados</caption>
                    <TableHeader><TableRow><TableHead>Archivo</TableHead><TableHead>Empresa</TableHead><TableHead>Módulo</TableHead><TableHead className="text-right">Tamaño</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {report.heaviestFiles.map((file) => (
                        <TableRow key={file.id}>
                          <TableCell className="max-w-64 truncate font-semibold" title={file.fileName}>{file.fileName}</TableCell>
                          <TableCell>{file.tenantName || '—'}</TableCell>
                          <TableCell>{file.module || file.bucket}</TableCell>
                          <TableCell className="text-right">{formatBytes(file.bytes)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-black uppercase tracking-wide">Tablas más grandes de la base de datos</h3>
                <div className="overflow-x-auto">
                  <Table className="min-w-[420px]">
                    <caption className="sr-only">Tablas más grandes de la base de datos</caption>
                    <TableHeader><TableRow><TableHead>Tabla</TableHead><TableHead className="text-right">Filas</TableHead><TableHead className="text-right">Tamaño</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {report.largestTables.map((table) => (
                        <TableRow key={table.name}><TableCell className="font-semibold">{table.name}</TableCell><TableCell className="text-right">{count(table.liveRows)}</TableCell><TableCell className="text-right">{formatBytes(table.bytes)}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </section>

              <p className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-xs leading-5 text-muted-foreground">
                Para recuperar espacio de las imágenes pesadas ya subidas se usa el script del backend <strong>scripts/optimize-storage-images.mjs</strong>:
                por omisión solo mide cuánto ahorraría (no cambia nada) y, con <strong>--apply</strong>, reemplaza cada imagen por una versión comprimida
                con el mismo nombre y formato. Nunca borra archivos. Las imágenes nuevas ya se comprimen desde el navegador a un máximo de 1 MB.
                Última medición: {new Date(report.measuredAt).toLocaleString('es-NI')}.
              </p>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
