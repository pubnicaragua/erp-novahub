import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Anchor,
  Boxes,
  CheckCircle2,
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
import { toast } from '@/app/services/toast';
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
import { useNotificationDomainRefresh } from '../hooks/useNotificationDomainRefresh';
import { getApiErrorMessage } from '../services/api';
import { beginNotificationAction, completeNotificationAction } from '../services/notification-action-coordinator';
import type { NotificationDomainRefreshDetail } from '../services/notification-domain-refresh';
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
import { Reception } from './tracking/Reception';
import { BatchReception } from './tracking/BatchReception';
import { ReceivedPackages } from './tracking/ReceivedPackages';
import { Reconciliation } from './tracking/Reconciliation';
import { Billing } from './tracking/Billing';
import { LogisticsConfig } from './tracking/LogisticsConfig';
import { TrackingViewTutorial } from './tracking/TrackingViewTutorial';
import { ExportMenu } from './ui/ExportMenu';
import { generateConfiguredReportSectionsPDF } from '../utils/pdfGenerator';
import { createReportWorkbook } from '../utils/reportWorkbook';
import { buildDatedDownloadFileName } from '../utils/exportFileNames';

type TrackingTab = 'transit' | 'reception' | 'batches' | 'packages' | 'reconciliation' | 'billing' | 'config';

const TRACKING_TABS: Array<{ id: TrackingTab; label: string }> = [
  { id: 'transit', label: 'En tránsito' },
  { id: 'reception', label: 'Recepción' },
  { id: 'batches', label: 'Recepción en lote' },
  { id: 'packages', label: 'Paquetes recibidos' },
  { id: 'reconciliation', label: 'Conciliación de compras' },
  { id: 'billing', label: 'Disponibles para facturar' },
  { id: 'config', label: 'Configuración' },
];

const TRACKING_TAB_PERMISSION: Record<TrackingTab, string> = {
  transit: 'TRACKING_TRANSIT',
  reception: 'TRACKING_RECEPTION',
  batches: 'TRACKING_BATCHES',
  packages: 'TRACKING_PACKAGES',
  reconciliation: 'TRACKING_RECONCILIATION',
  billing: 'TRACKING_BILLING',
  config: 'TRACKING_CONFIG',
};

const TRACKING_SIDEBAR_TAB: Record<TrackingTab, string> = {
  transit: 'tracking',
  reception: 'tracking-recepcion',
  batches: 'tracking-lotes',
  packages: 'tracking-paquetes',
  reconciliation: 'tracking-conciliacion',
  billing: 'tracking-facturacion',
  config: 'tracking-configuracion',
};

const TRACKING_NOTIFICATION_TAB: Record<string, TrackingTab> = {
  tracking: 'transit',
  transit: 'transit',
  reception: 'reception',
  'tracking-recepcion': 'reception',
  batches: 'batches',
  'tracking-lotes': 'batches',
  packages: 'packages',
  'tracking-paquetes': 'packages',
  reconciliation: 'reconciliation',
  'tracking-conciliacion': 'reconciliation',
  billing: 'billing',
  'tracking-facturacion': 'billing',
  config: 'config',
  'tracking-configuracion': 'config',
};

interface TrackingPageProps {
  activeSubModule?: string;
  onSubModuleChange?: (subModule?: string) => void;
}

const STATUS_OPTIONS = Object.keys(TRACKING_STATUS_LABELS) as TrackingStatus[];

const INITIAL_FORM = {
  trackingCode: '',
  clientName: '',
  carrier: '',
  origin: '',
  destination: '',
  description: '',
  estimatedAt: '',
};

export function TrackingPage({ activeSubModule, onSubModuleChange }: TrackingPageProps) {
  const { canPerform, user } = useAuth();
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
  const visibleTabs = useMemo(
    () => TRACKING_TABS.filter(({ id }) => canPerform(TRACKING_TAB_PERMISSION[id], 'view')),
    [canPerform],
  );
  const [tab, setTab] = useState<TrackingTab>('transit');
  const canReadTransit = canPerform('TRACKING_TRANSIT', 'view');
  const canCreateTransit = canPerform('TRACKING_TRANSIT', 'create');
  const canEditTransit = canPerform('TRACKING_TRANSIT', 'edit');
  const canDeleteTransit = canPerform('TRACKING_TRANSIT', 'delete');
  const canExportTransit = tab === 'transit' && canPerform('TRACKING_TRANSIT', 'export');

  const exportTransit = async (outputFormat: 'pdf' | 'xlsx') => {
    if (!canExportTransit) return;
    const toastId = toast.loading(`Preparando ${outputFormat === 'pdf' ? 'PDF' : 'Excel'} de envíos…`);
    try {
      const exportRows = await trackingService.list({ search: search || undefined, status: statusFilter || undefined, report: true, export: true, page: 1, pageSize: 5000 });
      const rows = exportRows.map((shipment) => ({
        Ticket: shipment.ticketNumber || '—',
        'Código tracking': shipment.trackingCode || '—',
        Cliente: shipment.clientName || '—',
        Ruta: [shipment.origin, shipment.destination].filter(Boolean).join(' → ') || '—',
        Estado: TRACKING_STATUS_LABELS[shipment.status] || shipment.status,
        'Última actualización': shipment.updatedAt ? format(new Date(shipment.updatedAt), "d MMM yyyy, HH:mm 'h'", { locale: es }) : '—',
      }));
      const headers = Object.keys(rows[0] || { Mensaje: 'Sin registros para el alcance seleccionado' });
      const sections = [{ id: 'tracking-transit', title: 'Envíos en tránsito', headers, rows: rows.length ? rows.map((row) => headers.map((header) => row[header] as string | number)) : [['Sin registros para el alcance seleccionado']] }];
      if (outputFormat === 'xlsx') createReportWorkbook({ fileName: buildDatedDownloadFileName(['reporte_tracking'], 'xlsx'), sheets: [{ name: 'Envíos', rows }], filters: { Búsqueda: search || '—', Estado: statusFilter ? TRACKING_STATUS_LABELS[statusFilter] : 'Todos' } });
      else await generateConfiguredReportSectionsPDF({ targetKey: 'tracking.transit', title: 'Envíos en tránsito', tenantName: user?.tenantName || 'Mi Empresa', tenantLogo: user?.sessionBranding?.logo || null, sections, fileName: buildDatedDownloadFileName(['reporte_tracking'], 'pdf') });
      toast.success(`${outputFormat === 'pdf' ? 'PDF' : 'Excel'} exportado correctamente`, { id: toastId });
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo exportar tracking'), { id: toastId });
    }
  };

  useEffect(() => {
    const requested = TRACKING_NOTIFICATION_TAB[String(activeSubModule || '').trim().toLowerCase()];
    if (requested && visibleTabs.some(({ id }) => id === requested)) setTab(requested);
  }, [activeSubModule, visibleTabs]);

  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some(({ id }) => id === tab)) {
      const fallback = visibleTabs[0].id;
      setTab(fallback);
      onSubModuleChange?.(TRACKING_SIDEBAR_TAB[fallback]);
    }
  }, [onSubModuleChange, tab, visibleTabs]);

  const changeTab = (next: TrackingTab) => {
    if (!visibleTabs.some(({ id }) => id === next)) return;
    setTab(next);
    onSubModuleChange?.(TRACKING_SIDEBAR_TAB[next]);
  };

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!canReadTransit) {
      setShipments([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await trackingService.list({ search: search || undefined, status: statusFilter || undefined });
      setShipments(data);
    } catch (error) {
      if (!options?.silent) toast.error(getApiErrorMessage(error, 'No se pudieron cargar los tickets'));
    } finally {
      setLoading(false);
    }
  }, [canReadTransit, search, statusFilter]);

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

  const refreshTransitFromNotification = useCallback(async (detail: NotificationDomainRefreshDetail) => {
    try {
      await load({ silent: true });
      if (selected && (detail.targetId === selected.id || detail.sourceId === selected.id)) {
        const refreshed = await trackingService.findByCode(selected.trackingCode);
        setSelected(refreshed);
      }
    } catch {
      // La vista conserva su estado y el siguiente ciclo de recuperación podrá reintentar.
    }
  }, [load, selected]);

  useNotificationDomainRefresh({
    module: 'tracking',
    subModules: ['transit'],
    onRefresh: refreshTransitFromNotification,
    enabled: canReadTransit,
  });

  /** Consulta el código de tracking en los providers y muestra el resultado. */
  const handleLookup = useCallback(async (rawCode?: string) => {
    if (!canReadTransit) return;
    const code = (rawCode ?? lookupCode).trim();
    if (!code) {
      setLookupError({ reason: 'EMPTY', message: TRACK_LOOKUP_ERROR_LABELS.EMPTY });
      return;
    }
    const actionToken = beginNotificationAction();
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
      completeNotificationAction(actionToken);
      setLookupBusy(false);
    }
  }, [canReadTransit, lookupCode, load]);

  const counts = useMemo(() => ({
    total: shipments.length,
    inTransit: shipments.filter((s) => ['IN_TRANSIT', 'CUSTOMS', 'OUT_FOR_DELIVERY', 'RECEIVED'].includes(s.status)).length,
    delivered: shipments.filter((s) => s.status === 'DELIVERED').length,
    alerts: shipments.filter((s) => ['ON_HOLD', 'LOST', 'RETURNED'].includes(s.status)).length,
  }), [shipments]);

  const handleCreate = async () => {
    if (!canCreateTransit) return;
    if (!form.trackingCode.trim()) {
      toast.error('El código de tracking es obligatorio');
      return;
    }
    const actionToken = beginNotificationAction();
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
      completeNotificationAction(actionToken);
      setSaving(false);
    }
  };

  const handleSync = async () => {
    if (!canEditTransit) return;
    if (!selected) return;
    const actionToken = beginNotificationAction();
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
      completeNotificationAction(actionToken);
      setSyncing(false);
    }
  };

  const handleAddEvent = async () => {
    if (!canEditTransit) return;
    if (!selected) return;
    const actionToken = beginNotificationAction();
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
    } finally {
      completeNotificationAction(actionToken);
    }
  };

  const handleDelete = async () => {
    if (!canDeleteTransit) return;
    if (!selected) return;
    const actionToken = beginNotificationAction();
    try {
      await trackingService.remove(selected.id);
      toast.success('Ticket eliminado');
      setDetailOpen(false);
      setSelected(null);
      await load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo eliminar el ticket'));
    } finally {
      completeNotificationAction(actionToken);
    }
  };

  

  const formatDate = (value?: string) => value ? format(new Date(value), "d MMM yyyy, HH:mm 'h'", { locale: es }) : '—';

  // Especificación: nunca mostrar "null"; mostrar "No disponible" u ocultar el dato.
  const na = (value?: string | null) => (value && value.trim() ? value : 'No disponible');
  const weightLabel = (s: TrackingShipment) =>
    s.providerWeight != null ? `${s.providerWeight} ${(s.weightUnit || '').trim()}`.trim() : undefined;

  return (
    <div className="tracking-module flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-border/60 px-4 pt-3 sm:px-6">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => changeTab(t.id)}
            className={`rounded-t-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${tab === t.id ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto pb-1">
          <div className="flex items-center gap-2">
            {canExportTransit && <ExportMenu onPdf={() => void exportTransit('pdf')} onExcel={() => void exportTransit('xlsx')} pdfDescription="Reporte configurado de tracking" excelDescription="Todos los envíos filtrados" />}
            <TrackingViewTutorial view={tab} />
          </div>
        </div>
      </div>
      {tab === 'transit' ? (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-end gap-3 border-b border-border/60 px-4 py-3 sm:px-6" data-tour="log-transit-title">
        <div className="flex flex-wrap items-center gap-2">
          {canCreateTransit && <Button className="rounded-xl text-xs" onClick={() => setCreateOpen(true)} data-tour="log-transit-create" data-testid="tracking-new-ticket"><Plus className="size-4" /> Nuevo ticket</Button>}
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
            Consulta automática a API. El resultado se guarda en el historial; la recepción física se confirma más adelante.
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
          <div className="relative min-w-56 flex-1" data-tour="log-transit-search">
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

        <Card className="hidden overflow-hidden rounded-2xl border-border/60 shadow-sm lg:block" data-tour="log-transit-table">
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
                  data-testid={`tracking-create-${field}`}
                  value={form[field]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            ))}
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descripción de la mercancía</label>
              <textarea
                data-testid="tracking-create-description"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t border-border/50 px-5 py-3">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button type="button" className="rounded-xl" data-testid="tracking-create-submit" onClick={handleCreate} disabled={saving}>{saving ? 'Creando…' : 'Crear ticket'}</Button>
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
                      data-testid="tracking-event-status"
                      value={eventForm.status}
                      onChange={(e) => setEventForm((prev) => ({ ...prev, status: e.target.value as TrackingStatus }))}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold"
                    >
                      {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{TRACKING_STATUS_LABELS[status]}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <Input data-testid="tracking-event-location" placeholder="Ubicación (opcional)" value={eventForm.location} onChange={(e) => setEventForm((prev) => ({ ...prev, location: e.target.value }))} className="rounded-xl text-xs" />
                  {canEditTransit && <Button data-testid="tracking-event-submit" className="rounded-xl text-xs" onClick={handleAddEvent}>Registrar</Button>}
                    </div>
                  </div>
                </Card>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-xl text-xs" onClick={() => { const url = `${window.location.origin}/public/tracking/${encodeURIComponent(selected.trackingCode)}`; navigator.clipboard.writeText(url); toast.success('Enlace público copiado: ' + url); }}>
                    <Truck className="size-4" /> Copiar enlace público
                  </Button>
                  {canEditTransit && <Button variant="outline" className="flex-1 rounded-xl text-xs" onClick={handleSync} disabled={syncing}>
                    <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} /> Sincronizar con transportista
                  </Button>}
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl text-xs"
                    title="Disponible en la siguiente etapa del módulo"
                    disabled
                  >
                    <PackageCheck className="size-4" /> Recibir paquete
                  </Button>
                  {canDeleteTransit && <Button variant="destructive" className="rounded-xl text-xs" onClick={handleDelete}><Trash2 className="size-4" /></Button>}
                </div>
                <p className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-center text-[11px] text-muted-foreground">
                  Consultar tracking no representa una recepción física. Para registrar la llegada usa la pestaña <b>Recepción de paquetes</b>.
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
      ) : tab === 'reception' ? (
        <Reception />
      ) : tab === 'batches' ? (
        <BatchReception />
      ) : tab === 'packages' ? (
        <ReceivedPackages />
      ) : tab === 'reconciliation' ? (
        <Reconciliation />
      ) : tab === 'billing' ? (
        <Billing />
      ) : (
        <LogisticsConfig />
      )}
    </div>
  );
}
