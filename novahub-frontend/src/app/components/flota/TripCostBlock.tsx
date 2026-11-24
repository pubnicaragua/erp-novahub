import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Loader2, Save, Trash2, Truck, TriangleAlert, Wand2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { Combobox } from '../ui/Combobox';
import { useAuth } from '../../contexts/AuthContext';
import { canAccessModuleView } from '../../utils/moduleViewAccess';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { useEnabledTenantFeatures } from '../../hooks/useEnabledTenantFeatures';
import {
  flotaService, type DriverType, type FleetRoute, type FleetVehicle, type PriceResult, type SavedTripCost, type TripCostInput, type TripCostResult, type TripMeta, type TripSourceType,
} from '../../services/flota.service';
import { hrService } from '../../services/hr.service';
import { suppliersService } from '../../services/compras.service';
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
  /**
   * REMISION (órdenes de venta): solo los datos de la remisión (origen, destino, camión, conductor, número de remisión y de pedido).
   * FULL (facturas y cotizaciones): además el costo interno, las fórmulas y el armado del precio.
   */
  mode?: 'FULL' | 'REMISION';
  /** Si se da, aparece «Aplicar como precio de la línea» en el armado del precio. */
  onApplyPrice?: (unitPrice: number) => void;
  /**
   * Orden nueva (todavía sin guardar): la remisión se captura en el mismo formulario y el padre la guarda junto con la orden.
   * Recibe los datos en cada cambio (o null cuando no aplica).
   */
  onDraftChange?: (payload: TripCostInput | null) => void;
}

const DRIVER_LABEL: Record<DriverType, string> = { PAYROLL: 'Empleado de nómina', SUBCONTRACTED: 'Subcontratado', PER_TRIP: 'Solo por viaje' };
/** Variables que se pueden usar en una fórmula del viaje (la lista completa de la empresa está en Flota › Parámetros). */
const FORMULA_VARIABLES = 'tarifa, cantidad, km, rendimiento, diesel, capacidad, factor_km, bruto, consumo, costo_diesel, comision_pct, comision, viatico, pago_conductor, depreciacion, otros, parada_extra';

interface Draft {
  vehicleId: string; origin: string; destination: string; km: string; quantity: string; kmPerGallon: string; commissionPercent: string;
  driverType: DriverType; driverEmployeeId: string; driverName: string;
  viatico: string; driverPay: string; depreciation: string; otherCosts: string; extraStop: string;
  custom: Record<string, string>;
  remisionNumber: string; supplierOrderNumber: string; supplierName: string; plate: string; departureAt: string; arrivalAt: string;
  rateFormula: string; formulas: Record<string, string>;
}

interface PriceDraft { pumpPrice: string; discountMode: 'AMOUNT' | 'PERCENT'; discount: string; freight: string; formula: string }

const EMPTY: Draft = {
  vehicleId: '', origin: '', destination: '', km: '', quantity: '', kmPerGallon: '', commissionPercent: '', driverType: 'PER_TRIP',
  driverEmployeeId: '', driverName: '', viatico: '', driverPay: '', depreciation: '', otherCosts: '', extraStop: '', custom: {},
  remisionNumber: '', supplierOrderNumber: '', supplierName: '', plate: '', departureAt: '', arrivalAt: '', rateFormula: '', formulas: {},
};
const EMPTY_PRICE: PriceDraft = { pumpPrice: '', discountMode: 'AMOUNT', discount: '', freight: '', formula: '' };

const str = (value: unknown) => (value === null || value === undefined ? '' : String(value));
const trim = (value: string) => value.trim();

function draftFromSaved(saved: SavedTripCost): Draft {
  const inputs = saved.inputs || {};
  const custom: Record<string, string> = {};
  for (const [code, value] of Object.entries((inputs.custom as Record<string, unknown>) || {})) custom[code] = str(value);
  const formulas: Record<string, string> = {};
  for (const [code, value] of Object.entries((inputs.formulas as Record<string, unknown>) || {})) formulas[code] = str(value);
  const trip = ((inputs.trip as TripMeta | undefined) || {}) as TripMeta;
  return {
    vehicleId: str(saved.vehicleId), origin: str(saved.origin), destination: str(saved.destination), km: str(saved.distanceKm), quantity: str(saved.quantity),
    kmPerGallon: str(inputs.kmPerGallon), commissionPercent: str(inputs.commissionPercent), driverType: saved.driverType, driverEmployeeId: str(saved.driverEmployeeId),
    driverName: str(saved.driverName), viatico: str(inputs.viatico), driverPay: str(inputs.driverPay), depreciation: str(inputs.depreciation),
    otherCosts: str(inputs.otherCosts), extraStop: str(inputs.extraStop), custom,
    remisionNumber: str(trip.remisionNumber), supplierOrderNumber: str(trip.supplierOrderNumber), supplierName: str(trip.supplierName), plate: str(trip.plate),
    departureAt: str(trip.departureAt), arrivalAt: str(trip.arrivalAt), rateFormula: str(inputs.rateFormula), formulas,
  };
}

function priceFromSaved(saved: SavedTripCost | null): PriceDraft {
  const pricing = (saved?.inputs?.pricing as Record<string, unknown> | undefined) || null;
  if (!pricing) return EMPTY_PRICE;
  const percent = Number(pricing.discountPercent) || 0;
  const amount = Number(pricing.discount) || 0;
  return {
    pumpPrice: str(pricing.pumpPrice), discountMode: !amount && percent ? 'PERCENT' : 'AMOUNT', discount: str(!amount && percent ? percent : amount || ''),
    freight: str(pricing.freight), formula: str(pricing.formula),
  };
}

function toPayload(draft: Draft, props: Pick<Props, 'revenue' | 'currency' | 'lineId'>, pricing?: PriceResult | null): TripCostInput {
  const clean = (value: string) => (trim(value) === '' ? undefined : trim(value));
  const custom: Record<string, string> = {};
  for (const [code, value] of Object.entries(draft.custom)) if (trim(value) !== '') custom[code] = trim(value);
  const formulas: Record<string, string> = {};
  for (const [code, value] of Object.entries(draft.formulas)) if (trim(value) !== '') formulas[code] = trim(value);
  const trip: TripMeta = {
    remisionNumber: clean(draft.remisionNumber) ?? null, supplierOrderNumber: clean(draft.supplierOrderNumber) ?? null, supplierName: clean(draft.supplierName) ?? null,
    plate: clean(draft.plate) ?? null, departureAt: clean(draft.departureAt) ?? null, arrivalAt: clean(draft.arrivalAt) ?? null,
  };
  return {
    vehicleId: clean(draft.vehicleId), origin: clean(draft.origin), destination: clean(draft.destination), km: clean(draft.km), quantity: clean(draft.quantity),
    revenue: props.revenue !== undefined && props.revenue !== null ? props.revenue : undefined,
    kmPerGallon: clean(draft.kmPerGallon), commissionPercent: clean(draft.commissionPercent), driverType: draft.driverType,
    driverEmployeeId: draft.driverType === 'PAYROLL' ? clean(draft.driverEmployeeId) : undefined, driverName: clean(draft.driverName),
    viatico: clean(draft.viatico), driverPay: clean(draft.driverPay), depreciation: clean(draft.depreciation), otherCosts: clean(draft.otherCosts), extraStop: clean(draft.extraStop),
    custom, lineId: props.lineId || '', currency: props.currency,
    rateFormula: clean(draft.rateFormula), formulas, trip,
    pricing: pricing ? { pumpPrice: pricing.pumpPrice, discount: pricing.discount, discountPercent: pricing.discountPercent, freight: pricing.freight, unitPrice: pricing.unitPrice, formula: pricing.formula } : undefined,
  };
}

/**
 * Datos del viaje dentro de órdenes, facturas y cotizaciones. Solo las empresas con Flota activo y la vista habilitada por el superadmin:
 *  - órdenes de venta (REMISION): vista FLEET_REMISSION; facturas y cotizaciones (FULL): vista FLEET_COSTS (costo interno).
 *  - En la orden de venta (mode REMISION) se capturan solo los datos de la remisión: origen, destino, camión, conductor, número de remisión y de pedido.
 *  - En la factura (mode FULL) esos datos ya vienen de la orden, el camión autocompleta el resto, y ahí está el costo interno, las fórmulas y el precio.
 * El cliente y el PDF nunca lo ven: ahí solo va el precio final.
 */
export function TripCostBlock({ sourceType, sourceId, lineId = '', revenue, quantity, currency, readOnly, mode = 'FULL', onApplyPrice, onDraftChange }: Props) {
  const { canPerform, user } = useAuth();
  const full = mode === 'FULL';
  // Cada bloque depende de SU vista, que el superadmin habilita por empresa: la remisión (órdenes de venta) y el costo interno
  // (facturas y cotizaciones) no se dan por añadidura. La política de la empresa también aplica al administrador.
  const viewId = full ? 'FLEET_COSTS' : 'FLEET_REMISSION';
  // Primera capa: la función específica que el superadmin habilita para la empresa. Sin ella no se muestra, ni al administrador.
  const tenantFeatures = useEnabledTenantFeatures();
  const allowedByCompany = tenantFeatures.has(full ? 'FLEET_TRIP_COSTS' : 'FLEET_TRIP_REMISSION')
    && canAccessModuleView(user?.roleModuleAccessPolicies || user?.moduleAccessPolicies, viewId);
  const canView = allowedByCompany && canPerform(viewId, 'view');
  const canEdit = allowedByCompany && canPerform(viewId, 'edit') && !readOnly;
  const refresh = useFleetRefresh();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({ ...EMPTY, quantity: quantity ? String(quantity) : '' });
  const [price, setPrice] = useState<PriceDraft>(EMPTY_PRICE);
  const [priceResultRaw, setPriceResult] = useState<PriceResult | null>(null);
  const [priceError, setPriceError] = useState('');
  const [result, setResult] = useState<TripCostResult | null>(null);
  const [error, setError] = useState('');
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [note, setNote] = useState('');
  const [kmManual, setKmManual] = useState(false);
  // Sin precio bomba no hay precio que mostrar (se deriva, no se guarda).
  const priceResult = Number(price.pumpPrice) > 0 ? priceResultRaw : null;

  const enabled = canView && open;
  // Costo interno: camiones y rutas completos. Remisión: solo lo necesario, sin rendimiento, comisión ni tarifas.
  const fullVehicles = useTenantQuery(['fleet', 'vehicles', 'trip-block'], (signal) => flotaService.listVehicles({ status: 'ACTIVE' }, signal), { enabled: enabled && full });
  const fullRoutes = useTenantQuery(['fleet', 'routes', 'trip-block'], (signal) => flotaService.listRoutes(undefined, signal), { enabled: enabled && full });
  const remissionOptions = useTenantQuery(['fleet', 'remission-options'], (signal) => flotaService.remissionOptions(signal), { enabled: enabled && !full, retry: false });
  const vehicles = { data: full ? fullVehicles.data : remissionOptions.data?.vehicles as unknown as FleetVehicle[] | undefined };
  const routes = { data: full ? fullRoutes.data : remissionOptions.data?.routes.map((route) => ({ ...route, rate: 0, rateUnit: 'PER_TRIP' as const, distanceKm: null })) as unknown as FleetRoute[] | undefined };
  const fields = useTenantQuery(['fleet', 'cost-fields', 'trip-block'], (signal) => flotaService.listCostFields(signal), { enabled: enabled && full, retry: false });
  const saved = useTenantQuery(['fleet', 'trips', sourceType, sourceId || 'new', lineId], (signal) => flotaService.listTrips(sourceType, String(sourceId), signal), { enabled: enabled && Boolean(sourceId) });
  const inherited = useTenantQuery(['fleet', 'trips', 'inherited', sourceId || 'new'], (signal) => flotaService.inheritedTrip(String(sourceId), signal), { enabled: enabled && Boolean(sourceId) && sourceType === 'INVOICE', retry: false });
  const suppliers = useTenantQuery(['fleet', 'trip-suppliers'], (signal) => suppliersService.getAllLookup({ status: 'ACTIVE' }, signal), { enabled, retry: false });
  const employees = useTenantQuery(['fleet', 'trip-employees'], (signal) => hrService.getEmployeeLookup(undefined, signal), { enabled: enabled && full && draft.driverType === 'PAYROLL', retry: false });

  const savedRow = useMemo(() => (saved.data || []).find((row) => row.lineId === lineId) || null, [saved.data, lineId]);
  const inheritedRow = useMemo(() => (inherited.data?.rows || []).find((row) => row.lineId === lineId) || (inherited.data?.rows || [])[0] || null, [inherited.data, lineId]);

  // Al abrir el bloque se llena una sola vez: con lo guardado, o (en la factura) con lo capturado en la orden de venta.
  if (open && !hydrated && !saved.isLoading && !(sourceType === 'INVOICE' && inherited.isLoading)) {
    if (savedRow) {
      setDraft(draftFromSaved(savedRow));
      setPrice(priceFromSaved(savedRow));
      setKmManual(Boolean(savedRow.distanceKm && Number(savedRow.distanceKm) > 0));
    } else if (inheritedRow) {
      const fromOrder = draftFromSaved(inheritedRow);
      setDraft({ ...fromOrder, quantity: fromOrder.quantity && Number(fromOrder.quantity) > 0 ? fromOrder.quantity : (quantity ? String(quantity) : '') });
      setNote(`Datos tomados de la orden ${inherited.data?.source?.number || ''}. Puedes cambiarlos.`.replace('  ', ' '));
    }
    setHydrated(true);
  }

  const routeMatch = useMemo(() => (routes.data || []).find((route) => route.isActive
    && route.origin.trim().toLowerCase() === draft.origin.trim().toLowerCase() && route.destination.trim().toLowerCase() === draft.destination.trim().toLowerCase()) || null,
  [routes.data, draft.origin, draft.destination]);
  // Al elegir origen y destino, los kilómetros salen de la ruta (si el usuario no los escribió a mano).
  const shown = useMemo<Draft>(() => (!kmManual && routeMatch?.distanceKm ? { ...draft, km: String(routeMatch.distanceKm) } : draft), [draft, kmManual, routeMatch]);

  const activeFields = (fields.data || []).filter((field) => field.isActive && field.kind !== 'FORMULA');
  const formulaFields = (fields.data || []).filter((field) => field.isActive && field.kind === 'FORMULA');
  const payload = useMemo(() => {
    const next = toPayload(shown, { revenue, currency, lineId }, priceResult);
    if (!next.quantity && quantity) next.quantity = String(quantity);
    return next;
  }, [shown, revenue, currency, lineId, priceResult, quantity]);

  // Orden sin guardar: el padre recibe lo capturado y lo guarda junto con la orden (un solo paso).
  useEffect(() => {
    if (!onDraftChange) return;
    onDraftChange(!sourceId && hydrated ? payload : null);
  }, [onDraftChange, sourceId, hydrated, payload]);

  // Vista previa del costo: el servidor calcula con los parámetros de la empresa (mismas reglas que al guardar).
  useEffect(() => {
    if (!enabled || !hydrated || !full) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setCalculating(true);
      try {
        const next = await flotaService.previewTrip(payload);
        if (!cancelled) { setResult(next); setError(''); }
      } catch (e) { if (!cancelled) { setResult(null); setError(errorMessage(e)); } }
      finally { if (!cancelled) setCalculating(false); }
    }, 450);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [enabled, hydrated, payload, full]);

  // Precio final al cliente: precio bomba − descuento + flete (la ruta pone el flete si hay tarifa).
  useEffect(() => {
    if (!enabled || !hydrated || !full || Number(price.pumpPrice) <= 0) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const next = await flotaService.previewPrice({
          origin: trim(draft.origin) || undefined, destination: trim(draft.destination) || undefined, pumpPrice: price.pumpPrice,
          ...(price.discountMode === 'PERCENT' ? { discountPercent: price.discount || undefined } : { discountAmount: price.discount || undefined }),
          freight: price.freight || undefined, quantity: draft.quantity || undefined, km: shown.km || undefined, formula: trim(price.formula) || undefined,
        });
        if (!cancelled) { setPriceResult(next); setPriceError(''); }
      } catch (e) { if (!cancelled) { setPriceResult(null); setPriceError(errorMessage(e)); } }
    }, 450);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [enabled, hydrated, full, price, draft.origin, draft.destination, draft.quantity, shown.km]);

  if (!canView) return null;

  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const money = (value: number) => `${currency === 'USD' ? '$' : 'C$'} ${formatNumber(value, 2)}`;

  /** Al elegir el camión se completa todo lo que se pueda: placa y, con el último viaje de ese camión, conductor, rendimiento, viático, pago y depreciación. */
  const pickVehicle = async (vehicleId: string) => {
    const vehicle = (vehicles.data || []).find((item) => item.id === vehicleId);
    set({ vehicleId, ...(vehicle?.plate && !trim(draft.plate) ? { plate: vehicle.plate } : {}) });
    if (!vehicleId) return;
    if (!full) {
      // En la orden solo se sugiere el conductor habitual: el último viaje trae costos y no se consulta.
      if (vehicle?.defaultDriverName) setDraft((current) => (trim(current.driverName) === '' ? { ...current, driverName: vehicle.defaultDriverName || '' } : current));
      return;
    }
    try {
      const last = await flotaService.lastTripOfVehicle(vehicleId);
      if (!last.found) {
        if (last.defaultDriverName) setDraft((current) => (trim(current.driverName) === '' ? { ...current, driverName: last.defaultDriverName || '' } : current));
        setNote(last.defaultDriverName ? 'Se puso el conductor habitual del camión. Completa lo demás una vez y quedará guardado para los próximos viajes.' : 'Primer viaje de este camión: completa los datos una vez y quedarán guardados para los próximos.');
        return;
      }
      setDraft((current) => {
        const fill = (value: unknown, now: string) => (trim(now) === '' && value !== null && value !== undefined && String(value) !== '' ? String(value) : now);
        const custom = { ...current.custom };
        for (const [code, value] of Object.entries(last.custom || {})) if (!trim(custom[code] ?? '')) custom[code] = String(value);
        return {
          ...current,
          driverName: fill(last.driverName || last.defaultDriverName, current.driverName),
          driverType: trim(current.driverName) === '' && last.driverType ? last.driverType : current.driverType,
          driverEmployeeId: fill(last.driverEmployeeId, current.driverEmployeeId),
          kmPerGallon: fill(last.kmPerGallon, current.kmPerGallon), commissionPercent: fill(last.commissionPercent, current.commissionPercent),
          viatico: fill(last.viatico, current.viatico), driverPay: fill(last.driverPay, current.driverPay), depreciation: fill(last.depreciation, current.depreciation),
          otherCosts: fill(last.otherCosts, current.otherCosts), extraStop: fill(last.extraStop, current.extraStop), custom,
        };
      });
      setNote('Se completaron los datos con el último viaje de este camión. Revisa y cambia lo que haga falta.');
    } catch { /* si no hay permiso o falla, se llena a mano */ }
  };

  const save = async () => {
    if (!sourceId) return;
    setSaving(true);
    try {
      await flotaService.saveTrip(sourceType, sourceId, payload);
      toast.success(full ? 'Costo del viaje guardado' : 'Datos de la remisión guardados');
      await refresh();
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };
  const remove = async () => {
    if (!sourceId) return;
    setSaving(true);
    try { await flotaService.removeTrip(sourceType, sourceId, lineId); setDraft({ ...EMPTY, quantity: quantity ? String(quantity) : '' }); setPrice(EMPTY_PRICE); setResult(null); toast.success('Datos del viaje quitados'); await refresh(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  const title = full ? 'Costo interno del viaje' : 'Datos de la remisión';
  const summaryHint = savedRow
    ? (full ? `Guardado · ganancia ${money(Number(savedRow.profit))}` : `Guardado${draft.remisionNumber ? ` · remisión ${draft.remisionNumber}` : ''}`)
    : sourceId ? (full ? 'Sin costo registrado' : 'Sin remisión registrada') : (full ? 'Guarda el documento primero' : 'Se guarda junto con la orden');
  const id = (name: string) => `tc-${name}-${lineId}`;
  const disabled = !canEdit;

  return (
    <section className="rounded-2xl border border-border bg-card" aria-label={title} data-fleet-trip-block>
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" aria-expanded={open}>
        <span className="flex min-w-0 items-center gap-2">
          <Truck className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="nh-section-title">{title}</span>
          <span className="truncate text-[12px] text-muted-foreground">Solo interno · el cliente no lo ve · {summaryHint}</span>
        </span>
        <ChevronDown className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-4">
          {!sourceId && full && <p className="rounded-lg border border-dashed p-3 text-[13px] text-muted-foreground">Guarda el documento y vuelve a abrir este bloque para registrar el costo del viaje.</p>}
          {!sourceId && !full && <p className="rounded-lg bg-primary/5 px-3 py-2 text-[12px] text-foreground" role="status">Llena la remisión aquí mismo: se guarda automáticamente junto con la orden, sin pasos extra.</p>}
          {sourceId && (saved.isLoading || (sourceType === 'INVOICE' && inherited.isLoading)) && <Skeleton className="h-40 w-full" aria-busy="true" />}
          {(sourceId || !full) && !saved.isLoading && !(sourceType === 'INVOICE' && inherited.isLoading) && (
            <>
              {note && <p className="rounded-lg bg-primary/5 px-3 py-2 text-[12px] text-foreground" role="status">{note}</p>}

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Remisión y viaje</p>
                <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                  <Field label="Remisión Nº" htmlFor={id('remision')}><Input id={id('remision')} disabled={disabled} value={draft.remisionNumber} onChange={(event) => set({ remisionNumber: event.target.value })} placeholder="Ej.: 30718" /></Field>
                  <Field label="Pedido del proveedor Nº" htmlFor={id('pedido')} hint="El código del pedido en Puma u otro proveedor."><Input id={id('pedido')} disabled={disabled} value={draft.supplierOrderNumber} onChange={(event) => set({ supplierOrderNumber: event.target.value })} placeholder="Ej.: 5010" /></Field>
                  <Field label="Proveedor" htmlFor={id('proveedor')}>
                    {suppliers.data && suppliers.data.length > 0 ? (
                      <Combobox
                        id={id('proveedor')} disabled={disabled} className="h-9" value={draft.supplierName} onChange={(value) => set({ supplierName: value })}
                        options={[...(draft.supplierName && !suppliers.data.some((supplier) => supplier.name === draft.supplierName) ? [{ label: draft.supplierName, value: draft.supplierName }] : []),
                          ...suppliers.data.map((supplier) => ({ label: supplier.name, value: supplier.name }))]}
                        placeholder="Elige el proveedor" searchPlaceholder="Buscar proveedor..." emptyMessage="Sin proveedores coincidentes"
                      />
                    ) : (
                      <Input id={id('proveedor')} disabled={disabled} value={draft.supplierName} onChange={(event) => set({ supplierName: event.target.value })} placeholder="Puma, Uno…" />
                    )}
                  </Field>
                  <Field label="Cantidad (galones)" htmlFor={id('qty')}><Input id={id('qty')} inputMode="decimal" disabled={disabled} value={draft.quantity} onChange={(event) => set({ quantity: event.target.value })} /></Field>
                  <Field label="Camión" htmlFor={id('vehicle')}>
                    <NativeSelect id={id('vehicle')} disabled={disabled} value={draft.vehicleId} onChange={(event) => void pickVehicle(event.target.value)}>
                      <option value="">Sin vehículo</option>
                      {(vehicles.data || []).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{[vehicle.code, vehicle.plate].filter(Boolean).join(' · ')}</option>)}
                    </NativeSelect>
                  </Field>
                  <Field label="Placa" htmlFor={id('plate')}><Input id={id('plate')} disabled={disabled} value={draft.plate} onChange={(event) => set({ plate: event.target.value })} /></Field>
                  <Field label="Origen" htmlFor={id('origin')}>
                    <Input id={id('origin')} list={id('origins')} disabled={disabled} value={draft.origin} onChange={(event) => set({ origin: event.target.value })} />
                    <datalist id={id('origins')}>{[...new Set((routes.data || []).map((route) => route.origin))].map((origin) => <option key={origin} value={origin} />)}</datalist>
                  </Field>
                  <Field label="Destino" htmlFor={id('destination')}>
                    <Input id={id('destination')} list={id('destinations')} disabled={disabled} value={draft.destination} onChange={(event) => set({ destination: event.target.value })} />
                    <datalist id={id('destinations')}>{[...new Set((routes.data || []).filter((route) => !draft.origin || route.origin.toLowerCase() === draft.origin.toLowerCase()).map((route) => route.destination))].map((destination) => <option key={destination} value={destination} />)}</datalist>
                  </Field>
                  {!(full && draft.driverType === 'PAYROLL' && !employees.isError) && (
                    <Field label={draft.driverType === 'SUBCONTRACTED' ? 'Transportista' : 'Conductor'} htmlFor={id('driver')}><Input id={id('driver')} disabled={disabled} value={draft.driverName} onChange={(event) => set({ driverName: event.target.value })} /></Field>
                  )}
                  <Field label="Fecha y hora de salida" htmlFor={id('departure')}><Input id={id('departure')} type="datetime-local" disabled={disabled} value={draft.departureAt} onChange={(event) => set({ departureAt: event.target.value })} /></Field>
                  <Field label="Fecha y hora de llegada" htmlFor={id('arrival')}><Input id={id('arrival')} type="datetime-local" disabled={disabled} value={draft.arrivalAt} onChange={(event) => set({ arrivalAt: event.target.value })} /></Field>
                </div>
              </div>

              {full && (
                <>
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Costos del viaje</p>
                    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                      <Field label="Kilómetros" htmlFor={id('km')} hint={routeMatch?.distanceKm ? 'Salen de la ruta; cámbialos si hace falta.' : 'Si lo dejas vacío usa los km de la ruta.'}><Input id={id('km')} inputMode="decimal" disabled={disabled} value={shown.km} onChange={(event) => { setKmManual(true); set({ km: event.target.value }); }} /></Field>
                      <Field label="Rendimiento (km por galón)" htmlFor={id('kmg')} hint="Vacío = el del vehículo. Cámbialo si este viaje rindió distinto."><Input id={id('kmg')} inputMode="decimal" disabled={disabled} value={draft.kmPerGallon} onChange={(event) => set({ kmPerGallon: event.target.value })} /></Field>
                      <Field label="Comisión (%)" htmlFor={id('comm')} hint="Vacío = la del vehículo o la de su capacidad."><Input id={id('comm')} inputMode="decimal" disabled={disabled} value={draft.commissionPercent} onChange={(event) => set({ commissionPercent: event.target.value })} /></Field>
                      <Field label="Tipo de conductor" htmlFor={id('driver-type')}>
                        <NativeSelect id={id('driver-type')} disabled={disabled} value={draft.driverType} onChange={(event) => set({ driverType: event.target.value as DriverType })}>
                          {Object.entries(DRIVER_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </NativeSelect>
                      </Field>
                      {draft.driverType === 'PAYROLL' && !employees.isError && (
                        <Field label="Empleado" htmlFor={id('emp')}>
                          <NativeSelect id={id('emp')} disabled={disabled} value={draft.driverEmployeeId} onChange={(event) => set({ driverEmployeeId: event.target.value })}>
                            <option value="">Elegir empleado</option>
                            {(employees.data || []).map((employee: { id: string; name?: string; firstName?: string; lastName?: string }) => <option key={employee.id} value={employee.id}>{employee.name || `${employee.firstName || ''} ${employee.lastName || ''}`.trim()}</option>)}
                          </NativeSelect>
                        </Field>
                      )}
                      <Field label="Pago al conductor" htmlFor={id('pay')} hint={draft.driverType === 'PAYROLL' ? 'Monto que se asigna a este viaje.' : 'Monto fijo o por viaje.'}><Input id={id('pay')} inputMode="decimal" disabled={disabled} value={draft.driverPay} onChange={(event) => set({ driverPay: event.target.value })} /></Field>
                      <Field label="Viático" htmlFor={id('viatico')}><Input id={id('viatico')} inputMode="decimal" disabled={disabled} value={draft.viatico} onChange={(event) => set({ viatico: event.target.value })} /></Field>
                      <Field label="Depreciación" htmlFor={id('dep')}><Input id={id('dep')} inputMode="decimal" disabled={disabled} value={draft.depreciation} onChange={(event) => set({ depreciation: event.target.value })} /></Field>
                      <Field label="Otros costos" htmlFor={id('other')}><Input id={id('other')} inputMode="decimal" disabled={disabled} value={draft.otherCosts} onChange={(event) => set({ otherCosts: event.target.value })} /></Field>
                      <Field label="Parada extra" htmlFor={id('stop')}><Input id={id('stop')} inputMode="decimal" disabled={disabled} value={draft.extraStop} onChange={(event) => set({ extraStop: event.target.value })} /></Field>
                      {activeFields.map((field) => (
                        <Field key={field.code} label={field.kind === 'PERCENT' ? `${field.label} (%)` : field.label} htmlFor={id(`cf-${field.code}`)}>
                          <Input id={id(`cf-${field.code}`)} inputMode="decimal" disabled={disabled} value={draft.custom[field.code] ?? ''} placeholder={field.defaultValue !== null && field.defaultValue !== undefined ? String(field.defaultValue) : ''} onChange={(event) => set({ custom: { ...draft.custom, [field.code]: event.target.value } })} />
                        </Field>
                      ))}
                    </div>
                  </div>

                  <details className="rounded-xl border border-border p-3" open={Boolean(draft.rateFormula || Object.keys(draft.formulas).some((code) => trim(draft.formulas[code] || '')))}>
                    <summary className="cursor-pointer text-[13px] font-medium">Fórmulas de este viaje (avanzado)</summary>
                    <p className="mt-2 text-[12px] text-muted-foreground">Escribe una fórmula solo si en este viaje se calcula distinto. Vacío = se usa la de la empresa. Solo vale para esta factura.</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">Variables: {FORMULA_VARIABLES}.</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field label="Tarifa" htmlFor={id('f-rate')}><Input id={id('f-rate')} disabled={disabled} value={draft.rateFormula} onChange={(event) => set({ rateFormula: event.target.value })} placeholder="km * factor_km / capacidad" /></Field>
                      <Field label="Combustible (diésel)" htmlFor={id('f-diesel')}><Input id={id('f-diesel')} disabled={disabled} value={draft.formulas.DIESEL ?? ''} onChange={(event) => set({ formulas: { ...draft.formulas, DIESEL: event.target.value } })} placeholder="consumo * diesel" /></Field>
                      <Field label="Comisión" htmlFor={id('f-comm')}><Input id={id('f-comm')} disabled={disabled} value={draft.formulas.COMISION ?? ''} onChange={(event) => set({ formulas: { ...draft.formulas, COMISION: event.target.value } })} placeholder="bruto * comision_pct / 100" /></Field>
                      {formulaFields.map((field) => (
                        <Field key={field.code} label={field.label} htmlFor={id(`f-${field.code}`)}><Input id={id(`f-${field.code}`)} disabled={disabled} value={draft.formulas[field.code] ?? ''} onChange={(event) => set({ formulas: { ...draft.formulas, [field.code]: event.target.value } })} placeholder={field.formula || ''} /></Field>
                      ))}
                    </div>
                  </details>

                  <div className="rounded-xl border border-border p-3">
                    <p className="text-[13px] font-medium">Armado del precio al cliente (interno)</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">Precio bomba − descuento + flete. El cliente solo ve el precio final; el descuento y el flete nunca salen en la factura.</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field label="Precio bomba (por galón)" htmlFor={id('pump')}><Input id={id('pump')} inputMode="decimal" disabled={disabled} value={price.pumpPrice} onChange={(event) => setPrice({ ...price, pumpPrice: event.target.value })} placeholder="163.36" /></Field>
                      <Field label="Descuento" htmlFor={id('disc')} hint="Por cliente y destino.">
                        <div className="flex min-w-0 gap-2">
                          <Input id={id('disc')} className="min-w-0 flex-1" inputMode="decimal" disabled={disabled} value={price.discount} onChange={(event) => setPrice({ ...price, discount: event.target.value })} placeholder={price.discountMode === 'PERCENT' ? '6.3' : '10.36'} />
                          <NativeSelect aria-label="Tipo de descuento" disabled={disabled} value={price.discountMode} onChange={(event) => setPrice({ ...price, discountMode: event.target.value as PriceDraft['discountMode'] })}>
                            <option value="AMOUNT">C$ / galón</option><option value="PERCENT">% del bomba</option>
                          </NativeSelect>
                        </div>
                      </Field>
                      <Field label="Flete por galón" htmlFor={id('freight')} hint={routeMatch ? `Vacío = el de la ruta (${formatNumber(routeMatch.rate, 4)}).` : 'Vacío = el de la ruta si existe.'}><Input id={id('freight')} inputMode="decimal" disabled={disabled} value={price.freight} onChange={(event) => setPrice({ ...price, freight: event.target.value })} /></Field>
                      <Field label="Fórmula del precio" htmlFor={id('pformula')} hint="Vacío = la de la empresa." className="sm:col-span-2"><Input id={id('pformula')} disabled={disabled} value={price.formula} onChange={(event) => setPrice({ ...price, formula: event.target.value })} placeholder="precio_bomba - descuento + flete" /></Field>
                    </div>
                    {priceError && <p className="mt-2 flex items-center gap-1.5 text-[13px] text-destructive" role="alert"><TriangleAlert className="size-4" aria-hidden="true" />{priceError}</p>}
                    {priceResult && (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2">
                        <div>
                          <p className="text-[13px]">Precio final: <strong className="tabular-nums">{money(priceResult.unitPrice)}</strong> por galón</p>
                          <p className="text-[12px] text-muted-foreground">{priceResult.how}</p>
                          {priceResult.warnings.map((warning) => <p key={warning} className="text-[12px] text-muted-foreground">⚠ {warning}</p>)}
                        </div>
                        {canEdit && onApplyPrice && (
                          <Button type="button" size="sm" onClick={() => { onApplyPrice(priceResult.unitPrice); toast.success('Precio aplicado a la línea de la factura'); }}>
                            <Wand2 className="size-4" aria-hidden="true" />Aplicar como precio de la línea
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {error && <p className="flex items-center gap-1.5 text-[13px] text-destructive" role="alert"><TriangleAlert className="size-4" aria-hidden="true" />{error}</p>}
                  {result && (
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full min-w-[520px] text-[13px]">
                        <caption className="sr-only">Desglose del costo del viaje</caption>
                        <thead className="bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-3 py-2">Concepto</th><th className="px-3 py-2">Cómo se calculó</th><th className="px-3 py-2 text-right">Monto</th></tr></thead>
                        <tbody>
                          <tr className="border-t"><td className="px-3 py-2 font-medium">Ingreso del viaje (lo que paga el cliente)</td><td className="px-3 py-2 text-[12px] text-muted-foreground">Total de la línea de la factura</td><td className="px-3 py-2 text-right tabular-nums">{money(result.revenue)}</td></tr>
                          {result.lines.filter((line) => line.amount !== 0 || line.error).map((line) => (
                            <tr key={line.code} className="border-t"><td className="px-3 py-1.5 text-muted-foreground">{line.label}{line.error && <span className="ml-2 text-destructive">({line.error})</span>}</td><td className="px-3 py-1.5 text-[12px] text-muted-foreground">{line.formula ? <span className="font-medium text-foreground">Fórmula: </span> : null}{line.how || ''}</td><td className="px-3 py-1.5 text-right tabular-nums">− {money(line.amount)}</td></tr>
                          ))}
                          <tr className="border-t bg-muted/20 font-semibold"><td className="px-3 py-2">Costo total</td><td /><td className="px-3 py-2 text-right tabular-nums">{money(result.totalCost)}</td></tr>
                          <tr className="border-t font-bold"><td className="px-3 py-2">Ganancia ({formatNumber(result.marginPercent, 1)} %)</td><td /><td className={`px-3 py-2 text-right tabular-nums ${result.profit < 0 ? 'text-destructive' : ''}`}>{money(result.profit)}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                  {result && result.warnings.length > 0 && <ul className="space-y-1 text-[12px] text-muted-foreground">{result.warnings.map((warning) => <li key={warning} className="flex items-center gap-1.5"><TriangleAlert className="size-3.5 text-warning" aria-hidden="true" />{warning}</li>)}</ul>}
                  {result && <p className="text-[12px] text-muted-foreground">Consumo {formatNumber(result.consumptionGallons, 3)} gal · rendimiento {formatNumber(result.kmPerGallon, 2)} km/gal · comisión {formatNumber(result.commissionPercent, 2)} %{result.rateSource !== 'NONE' ? ` · tarifa ${formatNumber(result.rate, 4)} (${result.rateSource === 'MANUAL' ? 'manual' : result.rateSource === 'ROUTE' ? 'de la ruta' : 'por fórmula'})` : ''}</p>}
                </>
              )}

              {canEdit && sourceId && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {calculating && full && <span className="mr-auto flex items-center gap-1.5 text-[12px] text-muted-foreground"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />Calculando…</span>}
                  {savedRow && <Button type="button" variant="outline" size="sm" onClick={() => void remove()} disabled={saving}><Trash2 className="size-4" aria-hidden="true" />Quitar datos del viaje</Button>}
                  <Button type="button" size="sm" onClick={() => void save()} disabled={saving || (full && !result)}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" aria-hidden="true" />}{full ? 'Guardar costo del viaje' : 'Guardar remisión'}</Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
