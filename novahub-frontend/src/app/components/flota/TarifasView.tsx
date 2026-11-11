import { useRef, useState } from 'react';
import { Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { parseSpreadsheetInWorker } from '../../utils/import-spreadsheet';
import { flotaService, parseRateSheet, type FleetRoute, type RateImportResult, type RateImportRow } from '../../services/flota.service';
import { toast } from '../../services/toast';
import { ErrorState, Field, PageTitle } from '../organizacion/OrgBits';
import { errorMessage } from '../organizacion/organizacion.utils';
import { useFleetRefresh } from './flota.helpers';

const EMPTY = { origin: '', destination: '', zone: '', distanceKm: '', rate: '' };

/** Celda editable: guarda al salir del campo o con Enter, solo si el valor cambió. */
function EditableCell({ value, disabled, onSave, align = 'left', inputMode }: { value: string; disabled: boolean; onSave: (next: string) => Promise<void>; align?: 'left' | 'right'; inputMode?: 'decimal' }) {
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);
  const commit = async () => {
    if (text === value) return;
    setSaving(true);
    try { await onSave(text); } catch (e) { setText(value); toast.error(errorMessage(e)); } finally { setSaving(false); }
  };
  return (
    <Input
      value={text} disabled={disabled || saving} inputMode={inputMode}
      onChange={(event) => setText(event.target.value)} onBlur={() => void commit()}
      onKeyDown={(event) => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur(); }}
      className={`h-8 min-w-[90px] ${align === 'right' ? 'text-right tabular-nums' : ''}`}
    />
  );
}

export function TarifasView() {
  const { canPerform } = useAuth();
  const refresh = useFleetRefresh();
  const canCreate = canPerform('FLEET_RATES', 'create');
  const canEdit = canPerform('FLEET_RATES', 'edit');
  const canDelete = canPerform('FLEET_RATES', 'delete');
  const [search, setSearch] = useState('');
  const query = useTenantQuery(['fleet', 'routes', search], (signal) => flotaService.listRoutes({ search: search || undefined }, signal));
  const [draft, setDraft] = useState(EMPTY);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [importRows, setImportRows] = useState<RateImportRow[] | null>(null);
  const [importPreview, setImportPreview] = useState<RateImportResult | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);

  const add = async () => {
    setAdding(true); setError('');
    try {
      await flotaService.createRoute({ origin: draft.origin, destination: draft.destination, zone: draft.zone, distanceKm: draft.distanceKm, rate: draft.rate });
      setDraft(EMPTY);
      toast.success('Tarifa agregada');
      await refresh();
    } catch (e) { setError(errorMessage(e)); } finally { setAdding(false); }
  };
  const patch = (route: FleetRoute, data: Record<string, unknown>) => flotaService.updateRoute(route.id, data).then(() => { void refresh(); });
  const remove = async (route: FleetRoute) => {
    try { await flotaService.removeRoute(route.id); toast.success('Tarifa eliminada'); await refresh(); } catch (e) { toast.error(errorMessage(e)); }
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setImportError(''); setImportPreview(null); setImportWarnings([]);
    try {
      const sheet = await parseSpreadsheetInWorker(file);
      const parsed = parseRateSheet(sheet.rows as unknown[][]);
      setImportWarnings(parsed.warnings);
      if (!parsed.rows.length) { setImportRows([]); setImportError(parsed.warnings[0] || 'No encontré tarifas en el archivo.'); return; }
      setImportRows(parsed.rows);
      setImportPreview(await flotaService.importRoutes(parsed.rows, true));
    } catch (e) { setImportRows([]); setImportError(errorMessage(e, 'No se pudo leer el archivo.')); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  };
  const confirmImport = async () => {
    if (!importRows?.length) return;
    setImporting(true);
    try {
      const result = await flotaService.importRoutes(importRows, false);
      toast.success(`Tarifas cargadas: ${result.created ?? 0} nuevas y ${result.updated ?? 0} actualizadas`);
      setImportRows(null); setImportPreview(null);
      await refresh();
    } catch (e) { setImportError(errorMessage(e)); } finally { setImporting(false); }
  };

  const routes = query.data ?? [];
  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <PageTitle
        eyebrow="Flota y fletes" title="Tarifas y rutas" subtitle="Tarifa de flete por origen y destino. La tabla siempre se puede editar: cambia una celda y se guarda al salir de ella."
        actions={canCreate ? (
          <>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only" aria-label="Archivo de tarifas" onChange={(event) => void pickFile(event.target.files?.[0])} />
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="size-4" aria-hidden="true" />Importar Excel</Button>
          </>
        ) : undefined}
      />
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por origen, destino o zona" aria-label="Buscar tarifas" className="max-w-sm" />

      {canCreate && (
        <div className="grid min-w-0 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Origen" htmlFor="rt-origin" required><Input id="rt-origin" value={draft.origin} onChange={(event) => setDraft({ ...draft, origin: event.target.value })} placeholder="Corinto" /></Field>
          <Field label="Destino" htmlFor="rt-dest" required><Input id="rt-dest" value={draft.destination} onChange={(event) => setDraft({ ...draft, destination: event.target.value })} placeholder="Estelí" /></Field>
          <Field label="Zona" htmlFor="rt-zone"><Input id="rt-zone" value={draft.zone} onChange={(event) => setDraft({ ...draft, zone: event.target.value })} placeholder="CA" /></Field>
          <Field label="Kilómetros" htmlFor="rt-km"><Input id="rt-km" inputMode="decimal" value={draft.distanceKm} onChange={(event) => setDraft({ ...draft, distanceKm: event.target.value })} /></Field>
          <Field label="Tarifa" htmlFor="rt-rate" required><Input id="rt-rate" inputMode="decimal" value={draft.rate} onChange={(event) => setDraft({ ...draft, rate: event.target.value })} /></Field>
          <div className="flex items-end"><Button type="button" className="w-full" onClick={() => void add()} disabled={adding || !draft.origin || !draft.destination || !draft.rate}>{adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" aria-hidden="true" />}Agregar</Button></div>
          {error && <div className="sm:col-span-2 lg:col-span-6"><ErrorState message={error} /></div>}
        </div>
      )}

      {query.isLoading && <Skeleton className="h-64 w-full" aria-busy="true" />}
      {query.isError && <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />}
      {!query.isLoading && !query.isError && (
        <div className="min-w-0 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-3 py-2">Origen</th><th className="px-3 py-2">Destino</th><th className="px-3 py-2">Zona</th><th className="px-3 py-2 text-right">Km</th><th className="px-3 py-2 text-right">Tarifa</th><th className="px-3 py-2 text-right">Acciones</th></tr>
            </thead>
            <tbody>
              {routes.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">Todavía no hay tarifas. Agrega una arriba o importa tu tabla de Excel.</td></tr>}
              {routes.map((route) => (
                <tr key={`${route.id}:${route.origin}:${route.destination}:${route.zone}:${route.distanceKm}:${route.rate}`} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-1.5"><EditableCell value={route.origin} disabled={!canEdit} onSave={(next) => patch(route, { origin: next })} /></td>
                  <td className="px-3 py-1.5"><EditableCell value={route.destination} disabled={!canEdit} onSave={(next) => patch(route, { destination: next })} /></td>
                  <td className="px-3 py-1.5"><EditableCell value={route.zone ?? ''} disabled={!canEdit} onSave={(next) => patch(route, { zone: next })} /></td>
                  <td className="px-3 py-1.5"><EditableCell value={route.distanceKm != null ? String(route.distanceKm) : ''} disabled={!canEdit} align="right" inputMode="decimal" onSave={(next) => patch(route, { distanceKm: next })} /></td>
                  <td className="px-3 py-1.5"><EditableCell value={String(route.rate)} disabled={!canEdit} align="right" inputMode="decimal" onSave={(next) => patch(route, { rate: next })} /></td>
                  <td className="px-3 py-1.5"><div className="flex justify-end">{canDelete && <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => void remove(route)} aria-label={`Eliminar ${route.origin} a ${route.destination}`}><Trash2 className="size-4" /></Button>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={importRows !== null} onOpenChange={(value) => { if (!value) { setImportRows(null); setImportPreview(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar tarifas</DialogTitle>
            <DialogDescription>Revisa el resumen antes de guardar. Las tarifas que ya existen se actualizan; no se borra nada.</DialogDescription>
          </DialogHeader>
          {importError && <ErrorState message={importError} />}
          {importPreview && (
            <ul className="space-y-1 text-[13px]">
              <li>Tarifas leídas: <strong>{importPreview.total}</strong></li>
              <li>Nuevas: <strong>{importPreview.toCreate ?? 0}</strong> · Se actualizan: <strong>{importPreview.toUpdate ?? 0}</strong></li>
            </ul>
          )}
          {importWarnings.length > 0 && <p className="max-h-24 overflow-y-auto rounded-lg bg-muted/50 p-2 text-[12px] text-muted-foreground">{importWarnings.slice(0, 8).join(' · ')}{importWarnings.length > 8 ? ` y ${importWarnings.length - 8} más` : ''}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setImportRows(null); setImportPreview(null); }}>Cancelar</Button>
            <Button type="button" onClick={() => void confirmImport()} disabled={importing || !importPreview}>{importing && <Loader2 className="size-4 animate-spin" />}Cargar tarifas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
