import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Loader2, Save, Trash2, Truck, TriangleAlert } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import {
  flotaService, type DriverType, type SavedTripCost, type TripCostInput, type TripCostResult, type TripSourceType,
} from '../../services/flota.service';
import { hrService } from '../../services/hr.service';
import { toast } from '../../services/toast';
import { Field, NativeSelect } from '../organizacion/OrgBits';
import { errorMessage } from '../organizacion/organizacion.utils';
import { formatNumber, useFleetRefresh } from './flota.helpers';

interface Props {
  sourceType: TripSourceType;
  /** Id del documento guardado. Sin id (documento nuevo) el bloque pide guardar primero. */
  sourceId: string | null | undefined;
  lineId?: string;
  /** Lo que se le factura al cliente por este viaje (total de la línea). Es el ingreso del viaje. */
  revenue?: number;
  quantity?: number;
  currency?: string;
  readOnly?: boolean;
}

const DRIVER_LABEL: Record<DriverType, string> = { PAYROLL: 'Empleado de nómina', SUBCONTRACTED: 'Subcontratado', PER_TRIP: 'Solo por viaje' };

interface Draft {
  vehicleId: string; origin: string; destination: string; km: string; quantity: string; kmPerGallon: string; commissionPercent: string;
  driverType: DriverType; driverEmployeeId: string; driverName: string;
  viatico: string; driverPay: string; depreciation: string; otherCosts: string; extraStop: string;
  custom: Record<string, string>;
}

const EMPTY: Draft = {
  vehicleId: '', origin: '', destination: '', km: '', quantity: '', kmPerGallon: '', commissionPercent: '', driverType: 'PER_TRIP',
  driverEmployeeId: '', driverName: '', viatico: '', driverPay: '', depreciation: '', otherCosts: '', extraStop: '', custom: {},
};

const str = (value: unknown) => (value === null || value === undefined ? '' : String(value));

function draftFromSaved(saved: SavedTripCost): Draft {
  const inputs = saved.inputs || {};
  const custom: Record<string, string> = {};
  for (const [code, value] of Object.entries((inputs.custom as Record<string, unknown>) || {})) custom[code] = str(value);
  return {
    vehicleId: str(saved.vehicleId), origin: str(saved.origin), destination: str(saved.destination), km: str(saved.distanceKm), quantity: str(saved.quantity),
    kmPerGallon: str(inputs.kmPerGallon), commissionPercent: str(inputs.commissionPercent), driverType: saved.driverType, driverEmployeeId: str(saved.driverEmployeeId),
    driverName: str(saved.driverName), viatico: str(inputs.viatico), driverPay: str(inputs.driverPay), depreciation: str(inputs.depreciation),
    otherCosts: str(inputs.otherCosts), extraStop: str(inputs.extraStop), custom,
  };
}

function toPayload(draft: Draft, props: Pick<Props, 'revenue' | 'currency' | 'lineId'>): TripCostInput {
  const clean = (value: string) => (value.trim() === '' ? undefined : value.trim());
  const custom: Record<string, string> = {};
  for (const [code, value] of Object.entries(draft.custom)) if (value.trim() !== '') custom[code] = value.trim();
  return {
    vehicleId: clean(draft.vehicleId), origin: clean(draft.origin), destination: clean(draft.destination), km: clean(draft.km), quantity: clean(draft.quantity),
    revenue: props.revenue !== undefined && props.revenue !== null ? props.revenue : undefined,
    kmPerGallon: clean(draft.kmPerGallon), commissionPercent: clean(draft.commissionPercent), driverType: draft.driverType,
    driverEmployeeId: draft.driverType === 'PAYROLL' ? clean(draft.driverEmployeeId) : undefined, driverName: clean(draft.driverName),
    viatico: clean(draft.viatico), driverPay: clean(draft.driverPay), depreciation: clean(draft.depreciation), otherCosts: clean(draft.otherCosts), extraStop: clean(draft.extraStop),
    custom, lineId: props.lineId || '', currency: props.currency,
  };
}

/**
 * «Costo interno del viaje»: bloque plegable que se muestra dentro de facturas, órdenes y cotizaciones solo a quien tiene
 * el permiso FLEET_COSTS (y solo a las empresas con el módulo Flota activo). El cliente y el PDF nunca lo ven: ahí solo va el precio.
 */
export function TripCostBlock({ sourceType, sourceId, lineId = '', revenue, quantity, currency, readOnly }: Props) {
  const { canPerform } = useAuth();
  const canView = canPerform('FLEET_COSTS', 'view');
  const canEdit = canPerform('FLEET_COSTS', 'edit') && !readOnly;
  const refresh = useFleetRefresh();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({ ...EMPTY, quantity: quantity ? String(quantity) : '' });
  const [result, setResult] = useState<TripCostResult | null>(null);
  const [error, setError] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const enabled = canView && open;
  const vehicles = useTenantQuery(['fleet', 'vehicles', 'trip-block'], (signal) => flotaService.listVehicles({ status: 'ACTIVE' }, signal), { enabled });
  const routes = useTenantQuery(['fleet', 'routes', 'trip-block'], (signal) => flotaService.listRoutes(undefined, signal), { enabled });
  const fields = useTenantQuery(['fleet', 'cost-fields', 'trip-block'], (signal) => flotaService.listCostFields(signal), { enabled });
  const saved = useTenantQuery(['fleet', 'trips', sourceType, sourceId || 'new', lineId], (signal) => flotaService.listTrips(sourceType, String(sourceId), signal), { enabled: enabled && Boolean(sourceId) });
  const employees = useTenantQuery(['fleet', 'trip-employees'], (signal) => hrService.getEmployeeLookup(undefined, signal), { enabled: enabled && draft.driverType === 'PAYROLL', retry: false });

  const savedRow = useMemo(() => (saved.data || []).find((row) => row.lineId === lineId) || null, [saved.data, lineId]);
  useEffect(() => {
    if (!open || hydrated || saved.isLoading) return;
    if (savedRow) setDraft(draftFromSaved(savedRow));
    setHydrated(true);
  }, [open, hydrated, saved.isLoading, savedRow]);

  const activeFields = (fields.data || []).filter((field) => field.isActive && field.kind !== 'FORMULA');
  const payload = useMemo(() => toPayload(draft, { revenue, currency, lineId }), [draft, revenue, currency, lineId]);

  // Vista previa: el servidor calcula con los parámetros de la empresa (mismas reglas que al guardar).
  useEffect(() => {
    if (!enabled || !hydrated) return undefined;
    let cancelled = false;
    setCalculating(true);
    const timer = window.setTimeout(async () => {
      try {
        const next = await flotaService.previewTrip(payload);
        if (!cancelled) { setResult(next); setError(''); }
      } catch (e) { if (!cancelled) { setResult(null); setError(errorMessage(e)); } }
      finally { if (!cancelled) setCalculating(false); }
    }, 450);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [enabled, hydrated, payload]);

  if (!canView) return null;

  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const money = (value: number) => `${currency === 'USD' ? '$' : 'C$'} ${formatNumber(value, 2)}`;

  const save = async () => {
    if (!sourceId) return;
    setSaving(true);
    try {
      await flotaService.saveTrip(sourceType, sourceId, payload);
      toast.success('Costo del viaje guardado');
      await refresh();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };
  const remove = async () => {
    if (!sourceId) return;
    setSaving(true);
    try { await flotaService.removeTrip(sourceType, sourceId, lineId); setDraft({ ...EMPTY, quantity: quantity ? String(quantity) : '' }); setResult(null); toast.success('Costo del viaje eliminado'); await refresh(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  const summaryHint = savedRow ? `Guardado · ganancia ${money(Number(savedRow.profit))}` : sourceId ? 'Sin costo registrado' : 'Guarda el documento primero';

  return (
    <section className="rounded-2xl border border-border bg-card" aria-label="Costo interno del viaje" data-fleet-trip-block>
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" aria-expanded={open}>
        <span className="flex min-w-0 items-center gap-2">
          <Truck className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="nh-section-title">Costo interno del viaje</span>
          <span className="truncate text-[12px] text-muted-foreground">Solo interno · el cliente no lo ve · {summaryHint}</span>
        </span>
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-4">
          {!sourceId && <p className="rounded-lg border border-dashed p-3 text-[13px] text-muted-foreground">Guarda el documento y vuelve a abrir este bloque para registrar el costo del viaje.</p>}
          {sourceId && saved.isLoading && <Skeleton className="h-40 w-full" aria-busy="true" />}
          {sourceId && !saved.isLoading && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Vehículo" htmlFor={`tc-vehicle-${lineId}`}>
                  <NativeSelect id={`tc-vehicle-${lineId}`} disabled={!canEdit} value={draft.vehicleId} onChange={(event) => set({ vehicleId: event.target.value })}>
                    <option value="">Sin vehículo</option>
                    {(vehicles.data || []).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{[vehicle.code, vehicle.plate].filter(Boolean).join(' · ')}</option>)}
                  </NativeSelect>
                </Field>
                <Field label="Origen" htmlFor={`tc-origin-${lineId}`}>
                  <Input id={`tc-origin-${lineId}`} list={`tc-origins-${lineId}`} disabled={!canEdit} value={draft.origin} onChange={(event) => set({ origin: event.target.value })} />
                  <datalist id={`tc-origins-${lineId}`}>{[...new Set((routes.data || []).map((route) => route.origin))].map((origin) => <option key={origin} value={origin} />)}</datalist>
                </Field>
                <Field label="Destino" htmlFor={`tc-destination-${lineId}`}>
                  <Input id={`tc-destination-${lineId}`} list={`tc-destinations-${lineId}`} disabled={!canEdit} value={draft.destination} onChange={(event) => set({ destination: event.target.value })} />
                  <datalist id={`tc-destinations-${lineId}`}>{[...new Set((routes.data || []).filter((route) => !draft.origin || route.origin.toLowerCase() === draft.origin.toLowerCase()).map((route) => route.destination))].map((destination) => <option key={destination} value={destination} />)}</datalist>
                </Field>
                <Field label="Kilómetros" htmlFor={`tc-km-${lineId}`} hint="Si lo dejas vacío usa los km de la ruta."><Input id={`tc-km-${lineId}`} inputMode="decimal" disabled={!canEdit} value={draft.km} onChange={(event) => set({ km: event.target.value })} /></Field>
                <Field label="Cantidad (galones)" htmlFor={`tc-qty-${lineId}`}><Input id={`tc-qty-${lineId}`} inputMode="decimal" disabled={!canEdit} value={draft.quantity} onChange={(event) => set({ quantity: event.target.value })} /></Field>
                <Field label="Rendimiento (km por galón)" htmlFor={`tc-kmg-${lineId}`} hint="Vacío = el del vehículo. Cámbialo si este viaje rindió distinto."><Input id={`tc-kmg-${lineId}`} inputMode="decimal" disabled={!canEdit} value={draft.kmPerGallon} onChange={(event) => set({ kmPerGallon: event.target.value })} /></Field>
                <Field label="Comisión (%)" htmlFor={`tc-comm-${lineId}`} hint="Vacío = la del vehículo o la de su capacidad."><Input id={`tc-comm-${lineId}`} inputMode="decimal" disabled={!canEdit} value={draft.commissionPercent} onChange={(event) => set({ commissionPercent: event.target.value })} /></Field>
                <Field label="Conductor" htmlFor={`tc-driver-type-${lineId}`}>
                  <NativeSelect id={`tc-driver-type-${lineId}`} disabled={!canEdit} value={draft.driverType} onChange={(event) => set({ driverType: event.target.value as DriverType })}>
                    {Object.entries(DRIVER_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </NativeSelect>
                </Field>
                {draft.driverType === 'PAYROLL' && !employees.isError ? (
                  <Field label="Empleado" htmlFor={`tc-emp-${lineId}`}>
                    <NativeSelect id={`tc-emp-${lineId}`} disabled={!canEdit} value={draft.driverEmployeeId} onChange={(event) => set({ driverEmployeeId: event.target.value })}>
                      <option value="">Elegir empleado</option>
                      {(employees.data || []).map((employee: { id: string; name?: string; firstName?: string; lastName?: string }) => <option key={employee.id} value={employee.id}>{employee.name || `${employee.firstName || ''} ${employee.lastName || ''}`.trim()}</option>)}
                    </NativeSelect>
                  </Field>
                ) : (
                  <Field label={draft.driverType === 'SUBCONTRACTED' ? 'Transportista' : 'Nombre del conductor'} htmlFor={`tc-driver-${lineId}`}><Input id={`tc-driver-${lineId}`} disabled={!canEdit} value={draft.driverName} onChange={(event) => set({ driverName: event.target.value })} /></Field>
                )}
                <Field label="Pago al conductor" htmlFor={`tc-pay-${lineId}`} hint={draft.driverType === 'PAYROLL' ? 'Monto que se asigna a este viaje.' : 'Monto fijo o por viaje.'}><Input id={`tc-pay-${lineId}`} inputMode="decimal" disabled={!canEdit} value={draft.driverPay} onChange={(event) => set({ driverPay: event.target.value })} /></Field>
                <Field label="Viático" htmlFor={`tc-viatico-${lineId}`}><Input id={`tc-viatico-${lineId}`} inputMode="decimal" disabled={!canEdit} value={draft.viatico} onChange={(event) => set({ viatico: event.target.value })} /></Field>
                <Field label="Depreciación" htmlFor={`tc-dep-${lineId}`}><Input id={`tc-dep-${lineId}`} inputMode="decimal" disabled={!canEdit} value={draft.depreciation} onChange={(event) => set({ depreciation: event.target.value })} /></Field>
                <Field label="Otros costos" htmlFor={`tc-other-${lineId}`}><Input id={`tc-other-${lineId}`} inputMode="decimal" disabled={!canEdit} value={draft.otherCosts} onChange={(event) => set({ otherCosts: event.target.value })} /></Field>
                <Field label="Parada extra" htmlFor={`tc-stop-${lineId}`}><Input id={`tc-stop-${lineId}`} inputMode="decimal" disabled={!canEdit} value={draft.extraStop} onChange={(event) => set({ extraStop: event.target.value })} /></Field>
                {activeFields.map((field) => (
                  <Field key={field.code} label={field.kind === 'PERCENT' ? `${field.label} (%)` : field.label} htmlFor={`tc-cf-${field.code}-${lineId}`}>
                    <Input id={`tc-cf-${field.code}-${lineId}`} inputMode="decimal" disabled={!canEdit} value={draft.custom[field.code] ?? ''} placeholder={field.defaultValue !== null && field.defaultValue !== undefined ? String(field.defaultValue) : ''} onChange={(event) => set({ custom: { ...draft.custom, [field.code]: event.target.value } })} />
                  </Field>
                ))}
              </div>

              {error && <p className="flex items-center gap-1.5 text-[13px] text-destructive" role="alert"><TriangleAlert className="size-4" aria-hidden="true" />{error}</p>}
              {result && (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[420px] text-[13px]">
                    <caption className="sr-only">Desglose del costo del viaje</caption>
                    <thead className="bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-2">Concepto</th><th className="px-3 py-2 text-right">Monto</th></tr></thead>
                    <tbody>
                      <tr className="border-t"><td className="px-3 py-2 font-medium">Ingreso del viaje (lo que paga el cliente)</td><td className="px-3 py-2 text-right tabular-nums">{money(result.revenue)}</td></tr>
                      {result.lines.filter((line) => line.amount !== 0 || line.error).map((line) => (
                        <tr key={line.code} className="border-t"><td className="px-3 py-1.5 text-muted-foreground">{line.label}{line.error && <span className="ml-2 text-destructive">({line.error})</span>}</td><td className="px-3 py-1.5 text-right tabular-nums">− {money(line.amount)}</td></tr>
                      ))}
                      <tr className="border-t bg-muted/20 font-semibold"><td className="px-3 py-2">Costo total</td><td className="px-3 py-2 text-right tabular-nums">{money(result.totalCost)}</td></tr>
                      <tr className="border-t font-bold"><td className="px-3 py-2">Ganancia ({formatNumber(result.marginPercent, 1)} %)</td><td className={`px-3 py-2 text-right tabular-nums ${result.profit < 0 ? 'text-destructive' : ''}`}>{money(result.profit)}</td></tr>
                    </tbody>
                  </table>
                </div>
              )}
              {result && result.warnings.length > 0 && <ul className="space-y-1 text-[12px] text-muted-foreground">{result.warnings.map((warning) => <li key={warning} className="flex items-center gap-1.5"><TriangleAlert className="size-3.5 text-warning" aria-hidden="true" />{warning}</li>)}</ul>}
              {result && <p className="text-[12px] text-muted-foreground">Consumo {formatNumber(result.consumptionGallons, 3)} gal · rendimiento {formatNumber(result.kmPerGallon, 2)} km/gal · comisión {formatNumber(result.commissionPercent, 2)} %{result.rateSource !== 'NONE' ? ` · tarifa ${formatNumber(result.rate, 4)} (${result.rateSource === 'MANUAL' ? 'manual' : result.rateSource === 'ROUTE' ? 'de la ruta' : 'por fórmula'})` : ''}</p>}

              {canEdit && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {calculating && <span className="mr-auto flex items-center gap-1.5 text-[12px] text-muted-foreground"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />Calculando…</span>}
                  {savedRow && <Button type="button" variant="outline" size="sm" onClick={() => void remove()} disabled={saving}><Trash2 className="size-4" aria-hidden="true" />Quitar costo</Button>}
                  <Button type="button" size="sm" onClick={() => void save()} disabled={saving || !result}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" aria-hidden="true" />}Guardar costo del viaje</Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
