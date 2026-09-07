import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Anchor,
  Boxes,
  CheckCircle2,
  ClipboardCopy,
  Clock3,
  FileText,
  MapPin,
  PackageCheck,
  PackageSearch,
  Plus,
  RefreshCw,
  Search,
  Ship,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Card } from './ui/card';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from './ui/sheet';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table';
import { useAuth } from '../contexts/AuthContext';
import { getApiErrorMessage } from '../services/api';
import {
  trackingService,
  trackingStatusTone,
  TRACKING_STATUS_LABELS,
  TRACK_LOOKUP_ERROR_LABELS,
  type TrackLookupErrorReason,
  type TrackingShipment,
  type TrackingStatus,
  type TrackingEvent,
} from '../services/tracking.service';
import { ReceptionWizard } from './tracking/ReceptionWizard';
import { ReceivedPackages } from './tracking/ReceivedPackages';
import { Reconciliation } from './tracking/Reconciliation';
import { Billing } from './tracking/Billing';

type TrackingTab = 'transit' | 'reception' | 'packages' | 'reconciliation' | 'billing';

const TRACKING_TABS: Array<{ id: TrackingTab; label: string }> = [
  { id: 'transit', label: 'En tránsito' },
  { id: 'reception', label: 'Recepción de paquetes' },
  { id: 'packages', label: 'Paquetes recibidos' },
  { id: 'reconciliation', label: 'Conciliación de compras' },
  { id: 'billing', label: 'Disponibles para facturar' },
];

const STATUS_OPTIONS = Object.keys(TRACKING_STATUS_LABELS) as TrackingStatus[];

const TRD_TEXT = `TRD - MODULO TRACKING DE IMPORTACIONES (NovaHub ERP)
====================================================

1. OBJETIVO
Gestionar envios de importacion de agencias logisticas: cada envio se
identifica por un CODIGO DE TRACKING (numero de ticket del transportista)
y muestra TODOS los estados posibles del envio en un historial cronologico.

2. ALCANCE
- Agencias de importacion/aduana que importan mercancia (p.ej. desde China
  o EE.UU. hacia LATAM).
- Usuarios: administrador de la empresa y personal asignado al modulo.

3. FLUJO PRINCIPAL
3.1 El agente crea un TICKET: ingresa codigo de tracking (obligatorio),
    transportista, cliente, origen, destino, descripcion y fecha estimada.
    El sistema genera un numero de ticket interno (TKT-XXXXXXXX).
3.2 El sistema registra el estado inicial: PENDIENTE DE RECEPCION.
3.3 El estado avanza por eventos: manuales (el agente registra) o
    AUTOMATICOS (sincronizados desde el API del transportista).
3.4 El cliente puede consultar su envio por el codigo de tracking y ver
    el historial completo de estados.

4. ESTADOS POSIBLES (catalogo)
1) PENDING          - Pendiente de recepcion
2) RECEIVED         - Recibido en agencia
3) IN_TRANSIT       - En transito
4) CUSTOMS          - En aduana
5) OUT_FOR_DELIVERY - En reparto
6) DELIVERED        - Entregado (estado final)
7) RETURNED         - Devuelto (estado final)
8) ON_HOLD          - En retencion
9) LOST             - Extraviado (estado final)
10) CANCELLED       - Cancelado (estado final)

5. INTEGRACION CON TRANSPORTISTA
- Proveedor oficial recomendado: AfterShip API (https://www.aftership.com)
  que agrega +1000 transportistas incluyendo CargoTrack y aduanales.
- Configuracion: variables de entorno del backend
  CARGO_TRACK_API_URL (o AFTERSHIP_API_URL) y CARGO_TRACK_API_KEY (o AFTERSHIP_API_KEY).
- La sincronizacion lee los checkpoints del transportista y crea eventos
  automaticos; el estado mas reciente actualiza el ticket.
- Si no hay credenciales, el modulo funciona en modo MANUAL (eventos
  registrados por el agente).

6. HABILITACION
- Super Admin activa el modulo TRACKING desde Suscripciones para la
  empresa (por empresa o grupo empresarial).

7. PERMISOS (Roles)
- view / create / edit / delete sobre el modulo TRACKING.

8. ENDPOINTS
- GET  /tracking/shipments            (lista + busqueda)
- GET  /tracking/shipments/code/:code (consulta por tracking)
- POST /tracking/shipments            (crear ticket)
- POST /tracking/shipments/:id/events (evento manual)
- POST /tracking/shipments/code/:code/sync (sync transportista)
- DELETE /tracking/shipments/:id      (eliminar)
- GET  /tracking/statuses             (catalogo de estados)

9. REGLAS DE NEGOCIO
- El codigo de tracking es unico por empresa.
- Estados finales: DELIVERED, RETURNED, LOST, CANCELLED.
- Cada evento guarda fecha, ubicacion, descripcion y origen (manual/API).
- La fecha de entrega se fija automaticamente al pasar a DELIVERED.

10. ENTREGABLES DEL PROFESIONAL
- CRUD de tickets con busqueda por codigo.
- Timeline de estados con colores por estado.
- Boton sincronizar por ticket.
- Catalogo de estados visible en la interfaz.
- Consulta publica por codigo (opcional fase 2).
`;

const INITIAL_FORM = {
  trackingCode: '',
  clientName: '',
  carrier: '',
  origin: '',
  destination: '',
  description: '',
  estimatedAt: '',
};

export function TrackingPage() {
  const { user } = useAuth();
  const [shipments, setShipments] = useState<TrackingShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TrackingStatus | ''>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<TrackingShipment | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [eventForm, setEventForm] = useState({ status: 'IN_TRANSIT' as TrackingStatus, label: '', location: '' });
  const [lookupCode, setLookupCode] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState<{ reason: TrackLookupErrorReason; message: string } | null>(null);
  const [tab, setTab] = useState<TrackingTab>('transit');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await trackingService.list({ search: search || undefined, status: statusFilter || undefined });
      setShipments(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron cargar los tickets'));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const openDetail = useCallback(async (code: string) => {
    try {
      const shipment = await trackingService.findByCode(code);
      setSelected(shipment);
      setDetailOpen(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se encontró el ticket'));
    }
  }, []);

  /** Consulta el código de tracking en los providers y muestra el resultado. */
  const handleLookup = useCallback(async (rawCode?: string) => {
    const code = (rawCode ?? lookupCode).trim();
    if (!code) {
      setLookupError({ reason: 'EMPTY', message: TRACK_LOOKUP_ERROR_LABELS.EMPTY });
      return;
    }
    setLookupBusy(true);
    setLookupError(null);
    try {
      const result = await trackingService.lookup(code);
      if (result.tracked) {
        setSelected(result.shipment);
        setDetailOpen(true);
        setLookupCode('');
        await load();
        toast.success(
          result.addedEvents
            ? `Envío actualizado: ${result.addedEvents} evento(s) nuevo(s)`
            : 'Envío actualizado (sin eventos nuevos)',
        );
      } else {
        setLookupError({ reason: result.reason, message: result.message });
        toast.error(result.message || TRACK_LOOKUP_ERROR_LABELS[result.reason]);
      }
    } catch (error) {
      const message = getApiErrorMessage(error, 'No se pudo consultar el código de tracking');
      setLookupError({ reason: 'HTTP_ERROR', message });
      toast.error(message);
    } finally {
      setLookupBusy(false);
    }
  }, [lookupCode, load]);

  const counts = useMemo(() => ({
    total: shipments.length,
    inTransit: shipments.filter((s) => ['IN_TRANSIT', 'CUSTOMS', 'OUT_FOR_DELIVERY', 'RECEIVED'].includes(s.status)).length,
    delivered: shipments.filter((s) => s.status === 'DELIVERED').length,
    alerts: shipments.filter((s) => ['ON_HOLD', 'LOST', 'RETURNED'].includes(s.status)).length,
  }), [shipments]);

  const handleCreate = async () => {
    if (!form.trackingCode.trim()) {
      toast.error('El código de tracking es obligatorio');
      return;
    }
    try {
      setSaving(true);
      const shipment = await trackingService.create({
        ...form,
        carrier: form.carrier || 'No especificado',
      });
      toast.success(`Ticket ${shipment.ticketNumber} creado`);
      setCreateOpen(false);
      setForm(INITIAL_FORM);
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear el ticket'));
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    if (!selected) return;
    try {
      setSyncing(true);
      const result = await trackingService.sync(selected.trackingCode);
      if (result.synced) {
        toast.success(result.addedEvents ? `Sincronizado: ${result.addedEvents} evento(s) nuevo(s)` : 'Sincronizado, sin eventos nuevos');
        setSelected(result.shipment);
        await load();
      } else {
        toast.info(result.message || 'El transportista no reportó datos; puedes registrar eventos manualmente.');
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al sincronizar'));
    } finally {
      setSyncing(false);
    }
  };

  const handleAddEvent = async () => {
    if (!selected) return;
    try {
      const event = await trackingService.addEvent(selected.id, {
        status: eventForm.status,
        label: eventForm.label || TRACKING_STATUS_LABELS[eventForm.status],
        location: eventForm.location || undefined,
      });
      toast.success('Evento registrado');
      setEventForm({ status: 'IN_TRANSIT', label: '', location: '' });
      const refreshed = await trackingService.findByCode(selected.trackingCode);
      setSelected(refreshed);
      void event;
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo registrar el evento'));
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      await trackingService.remove(selected.id);
      toast.success('Ticket eliminado');
      setDetailOpen(false);
      setSelected(null);
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo eliminar el ticket'));
    }
  };

  const copyTrd = () => {
    navigator.clipboard.writeText(TRD_TEXT);
    toast.success('TRD copiado al portapapeles');
  };

  const formatDate = (value?: string) => value ? format(new Date(value), "d MMM yyyy, HH:mm 'h'", { locale: es }) : '—';

  // Especificación: nunca mostrar "null"; mostrar "No disponible" u ocultar el dato.
  const na = (value?: string | null) => (value && value.trim() ? value : 'No disponible');
  const weightLabel = (s: TrackingShipment) =>
    s.providerWeight != null ? `${s.providerWeight} ${(s.weightUnit || '').trim()}`.trim() : undefined;

  return (
    <>
      <div className="flex items-center gap-1 border-b border-border/60 px-4 pt-3 sm:px-6">
        {TRACKING_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-t-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${tab === t.id ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'transit' ? (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Ship className="size-5" /></div>
          <div>
            <h1 className="text-lg font-black tracking-tight">Tracking de Importaciones</h1>
            <p className="text-xs text-muted-foreground">Envíos de agencia por código de tracking · {user?.clientTenant?.name || ''}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="rounded-xl text-xs" onClick={copyTrd}><ClipboardCopy className="size-4" /> Copiar TRD</Button>
          <Button className="rounded-xl text-xs" onClick={() => setCreateOpen(true)}><Plus className="size-4" /> Nuevo ticket</Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <label htmlFor="lookup-tracking" className="mb-1.5 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <Truck className="size-3.5 text-primary" /> Tracking en tránsito
              </label>
              <Input
                id="lookup-tracking"
                value={lookupCode}
                onChange={(e) => { setLookupCode(e.target.value); setLookupError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleLookup(); }}
                placeholder="Ingrese código de tracking, ej. GFUS01065222301697"
                className="h-11 rounded-xl bg-background"
                autoComplete="off"
              />
            </div>
            <Button className="h-11 rounded-xl px-6" onClick={() => handleLookup()} disabled={lookupBusy}>
              <Search className="size-4" /> {lookupBusy ? 'Consultando…' : 'Buscar'}
            </Button>
          </div>
          {lookupError && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-destructive">
              <X className="size-3.5 shrink-0" />
              {lookupError.message || TRACK_LOOKUP_ERROR_LABELS[lookupError.reason]}
            </p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Consulta automática a AWBOX y CargoTrack. El resultado se guarda en el historial; la recepción física se confirma más adelante.
          </p>
        </Card>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground"><PackageSearch className="size-4 text-primary" /> Tickets totales</div>
            <p className="mt-2 text-2xl font-black">{counts.total}</p>
          </Card>
          <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground"><Ship className="size-4 text-sky-500" /> En tránsito / aduana</div>
            <p className="mt-2 text-2xl font-black text-sky-500">{counts.inTransit}</p>
          </Card>
          <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground"><CheckCircle2 className="size-4 text-emerald-500" /> Entregados</div>
            <p className="mt-2 text-2xl font-black text-emerald-500">{counts.delivered}</p>
          </Card>
          <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground"><Anchor className="size-4 text-rose-500" /> En alerta</div>
            <p className="mt-2 text-2xl font-black text-rose-500">{counts.alerts}</p>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por código de tracking, ticket o cliente…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-xl pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TrackingStatus | '')}
            className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold"
          >
            <option value="">Todos los estados</option>
            {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{TRACKING_STATUS_LABELS[status]}</option>)}
          </select>
        </div>

        <Card className="hidden overflow-hidden rounded-2xl border-border/60 shadow-sm lg:block">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Ticket</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Código tracking</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Cliente</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Ruta</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Última actualización</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-xs text-muted-foreground">Cargando tickets…</TableCell></TableRow>
              ) : shipments.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                    <Ship className="size-8 text-muted-foreground/40" />
                    <p className="text-sm font-bold">Sin tickets registrados</p>
                    <p className="text-xs text-muted-foreground">Crea tu primer ticket de importación para empezar a dar seguimiento.</p>
                  </div>
                </TableCell></TableRow>
              ) : shipments.map((shipment) => (
                <TableRow key={shipment.id} className="cursor-pointer" onClick={() => openDetail(shipment.trackingCode)}>
                  <TableCell className="text-xs font-black">{shipment.ticketNumber}</TableCell>
                  <TableCell className="font-mono text-xs font-bold text-primary">{shipment.trackingCode}</TableCell>
                  <TableCell className="text-xs font-semibold">{shipment.clientName || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{[shipment.origin, shipment.destination].filter(Boolean).join(' → ') || '—'}</TableCell>
                  <TableCell><Badge variant="outline" className={`gap-1.5 rounded-lg text-[10px] ring-1 ${trackingStatusTone(shipment.status)}`}><Boxes className="size-3" />{TRACKING_STATUS_LABELS[shipment.status]}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(shipment.updatedAt)}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={(e) => { e.stopPropagation(); openDetail(shipment.trackingCode); }}>Ver detalle</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <div className="space-y-3 lg:hidden">
          {loading ? (
            <p className="py-8 text-center text-xs text-muted-foreground">Cargando tickets…</p>
          ) : shipments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
              <Ship className="mx-auto size-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm font-bold">Sin tickets registrados</p>
            </div>
          ) : shipments.map((shipment) => (
            <div key={shipment.id} className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm" onClick={() => openDetail(shipment.trackingCode)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black">{shipment.ticketNumber}</p>
                  <p className="font-mono text-xs font-bold text-primary">{shipment.trackingCode}</p>
                </div>
                <Badge variant="outline" className={`rounded-lg text-[10px] ring-1 ${trackingStatusTone(shipment.status)}`}>{TRACKING_STATUS_LABELS[shipment.status]}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{shipment.clientName || 'Sin cliente'} · {[shipment.origin, shipment.destination].filter(Boolean).join(' → ') || 'Sin ruta'}</p>
            </div>
          ))}
        </div>
      </div>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><Ship className="size-5 text-primary" /> Nuevo ticket de importación</SheetTitle>
            <SheetDescription>Registra un envío con su código de tracking para darle seguimiento.</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4 py-4">
            {(['trackingCode', 'clientName', 'carrier', 'origin', 'destination', 'estimatedAt'] as const).map((field) => (
              <div key={field}>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {field === 'trackingCode' ? 'Código de tracking *' : field === 'estimatedAt' ? 'Fecha estimada de entrega' : field === 'clientName' ? 'Cliente' : field === 'carrier' ? 'Transportista / agencia' : field === 'origin' ? 'Origen' : 'Destino'}
                </label>
                <Input
                  type={field === 'estimatedAt' ? 'datetime-local' : 'text'}
                  value={form[field]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            ))}
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descripción de la mercancía</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t border-border/50 px-5 py-3">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button type="button" className="rounded-xl" onClick={handleCreate} disabled={saving}>{saving ? 'Creando…' : 'Crear ticket'}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <FileText className="size-5 text-primary" />
                  {selected.ticketNumber}
                  <span className="font-mono text-sm text-primary">{selected.trackingCode}</span>
                </SheetTitle>
                <SheetDescription>{selected.clientName || 'Sin cliente'} · {selected.carrier}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`rounded-lg text-[11px] ring-1 ${trackingStatusTone(selected.status)}`}>{TRACKING_STATUS_LABELS[selected.status]}</Badge>
                  <Badge variant="outline" className="rounded-lg text-[10px]">{na(selected.provider || selected.syncSource) || 'manual'}</Badge>
                  {selected.lastSyncAt && <span className="text-[10px] text-muted-foreground">Sync: {formatDate(selected.lastSyncAt)}</span>}
                </div>

                <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><p className="text-[10px] font-black uppercase text-muted-foreground">Proveedor</p><p className="font-semibold">{na(selected.provider || selected.syncSource)}</p></div>
                    <div><p className="text-[10px] font-black uppercase text-muted-foreground">Tipo de envío</p><p className="font-semibold">{na(selected.shipmentType)}</p></div>
                    <div><p className="text-[10px] font-black uppercase text-muted-foreground">Peso</p><p className="font-semibold">{weightLabel(selected) || 'No disponible'}</p></div>
                    <div><p className="text-[10px] font-black uppercase text-muted-foreground">Fecha estimada</p><p className="font-semibold">{formatDate(selected.estimatedAt) === '—' ? 'No disponible' : formatDate(selected.estimatedAt)}</p></div>
                    <div><p className="text-[10px] font-black uppercase text-muted-foreground">Origen</p><p className="font-semibold">{na(selected.origin)}</p></div>
                    <div><p className="text-[10px] font-black uppercase text-muted-foreground">Destino</p><p className="font-semibold">{na(selected.destination)}</p></div>
                    <div><p className="text-[10px] font-black uppercase text-muted-foreground">Cliente</p><p className="font-semibold">{na(selected.clientName)}</p></div>
                    <div><p className="text-[10px] font-black uppercase text-muted-foreground">Última consulta</p><p className="font-semibold">{formatDate(selected.lastSyncAt)}</p></div>
                  </div>
                  {selected.description && <p className="mt-3 border-t border-border/40 pt-3 text-xs text-muted-foreground">{selected.description}</p>}
                </div>

                <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
                  <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground"><Clock3 className="size-4 text-primary" /> Historial de estados</h3>
                  <div className="mt-4 space-y-0">
                    {selected.events.length === 0 && <p className="text-xs text-muted-foreground">Sin eventos registrados todavía.</p>}
                    {selected.events.map((event: TrackingEvent, index: number) => (
                      <div key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
                        {index < selected.events.length - 1 && <span className="absolute left-[11px] top-6 h-full w-px bg-border" />}
                        <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ring-2 ${trackingStatusTone(event.status)}`}>
                          {event.status === 'DELIVERED' ? <CheckCircle2 className="size-3.5" /> : <Boxes className="size-3.5" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-black">{event.label || TRACKING_STATUS_LABELS[event.status]}</p>
                            <p className="text-[10px] text-muted-foreground">{formatDate(event.occurredAt)}</p>
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{TRACKING_STATUS_LABELS[event.status]}{event.location ? ` · ${event.location}` : ''}</p>
                          {event.description && event.description !== event.label && <p className="mt-0.5 text-[11px] text-muted-foreground">{event.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
                  <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground"><MapPin className="size-4 text-primary" /> Registrar estado manualmente</h3>
                  <div className="mt-3 space-y-2">
                    <select
                      value={eventForm.status}
                      onChange={(e) => setEventForm((prev) => ({ ...prev, status: e.target.value as TrackingStatus }))}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold"
                    >
                      {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{TRACKING_STATUS_LABELS[status]}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <Input placeholder="Ubicación (opcional)" value={eventForm.location} onChange={(e) => setEventForm((prev) => ({ ...prev, location: e.target.value }))} className="rounded-xl text-xs" />
                      <Button className="rounded-xl text-xs" onClick={handleAddEvent}>Registrar</Button>
                    </div>
                  </div>
                </Card>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-xl text-xs" onClick={handleSync} disabled={syncing}>
                    <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} /> Sincronizar con transportista
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl text-xs"
                    title="Disponible en la siguiente etapa del módulo"
                    disabled
                  >
                    <PackageCheck className="size-4" /> Recibir paquete
                  </Button>
                  <Button variant="destructive" className="rounded-xl text-xs" onClick={handleDelete}><Trash2 className="size-4" /></Button>
                </div>
                <p className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-center text-[11px] text-muted-foreground">
                  Consultar tracking no representa una recepción física. La acción <b>Recibir paquete</b> se habilitará en la siguiente etapa.
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
      ) : tab === 'reception' ? (
        <ReceptionWizard onDone={() => setTab('packages')} />
      ) : tab === 'packages' ? (
        <ReceivedPackages />
      ) : tab === 'reconciliation' ? (
        <Reconciliation />
      ) : (
        <Billing />
      )}
    </>
  );
}