import { useEffect, useState } from 'react';
import {
  Package,
  FileText,
  History,
  UserRound,
  CalendarDays,
  Calendar,
  Ship,
  Building2,
  MapPin,
  Plus,
  Trash2,
  ChevronRight,
  Pencil,
  ArrowRightLeft,
} from 'lucide-react';
import { EditIntlPackageModal } from './EditIntlPackageModal';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from '@/app/services/toast';
import { getApiErrorMessage } from '@/app/services/api';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '../../ui/sheet';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../../ui/tabs';
import {
  intlImportsService,
  canEditPackage,
  INTL_PACKAGE_STATUS_LABELS,
  type IntlImportPackage,
  type IntlImportPackageStatus,
  type PackageMovement,
} from '../../../services/intl-imports.service';

interface IntlPackageDetailSheetProps {
  packageData: IntlImportPackage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
  onDeleteSuccess?: () => void;
}

const statusBadgeColors: Record<IntlImportPackageStatus, string> = {
  RECEIVED_AT_WAREHOUSE: 'bg-secondary text-secondary-foreground border-border/50',
  CONSOLIDATED: 'bg-secondary text-secondary-foreground border-border/50',
  IN_TRANSIT: 'bg-primary/10 text-primary border-primary/20',
  CUSTOMS_CLEARANCE: 'bg-secondary text-secondary-foreground border-border/50',
  AVAILABLE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  DELIVERED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  CANCELLED: 'bg-destructive/10 text-destructive border-destructive/20',
};

const getEventBadgeColor = (status: IntlImportPackageStatus) => {
  return statusBadgeColors[status] || 'bg-secondary text-secondary-foreground border-border/50';
};

const getCustomerName = (pkg: IntlImportPackage) => {
  if (pkg.customer?.name) return pkg.customer.name;
  if (pkg.customerName) return pkg.customerName;
  const match = pkg.description?.match(/Cliente:\s*([^|)]+)/);
  if (match) return match[1].trim();
  return 'Cliente Genérico';
};

const getSupplierName = (pkg: IntlImportPackage) => {
  if (pkg.supplier?.name) return pkg.supplier.name;
  if (pkg.supplierName) return pkg.supplierName;
  const match = pkg.description?.match(/Proveedor:\s*([^|)]+)/);
  if (match) return match[1].trim();
  return pkg.senderName || 'No especificado';
};

function translateEventText(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/Customs Clearance & Proration Completed/gi, 'Desaduanaje y prorrateo completado')
    .replace(/Package received at origin warehouse/gi, 'Paquete recibido en bodega de origen')
    .replace(/Received in origin warehouse with weight ([\d.]+) ?kg and volume ([\d.]+) ?CBM/gi, 'Recibido en bodega de origen con peso $1 kg y volumen $2 CBM')
    .replace(/Assigned to container (.+)/gi, 'Asignado al contenedor $1')
    .replace(/Package consolidated into container (.+)/gi, 'Paquete consolidado en el contenedor $1')
    .replace(/Container (.+) closed\. Prorated cost: \$?([\d.]+)/gi, 'Contenedor $1 cerrado. Costo prorrateado: $$2')
    .replace(/Container status updated to (.+)/gi, 'Estado del contenedor actualizado a $1')
    .replace(/Container event triggered package status change to (.+)/gi, 'Evento de contenedor actualizó el estado a $1')
    .replace(/Status updated to (.+)/gi, 'Estado actualizado a $1')
    .replace(/Package status updated manually to (.+)/gi, 'Estado del paquete actualizado manualmente a $1');
}

export function IntlPackageDetailSheet({
  packageData,
  open,
  onOpenChange,
  onRefresh,
  onDeleteSuccess,
}: IntlPackageDetailSheetProps) {
  const [activeTab, setActiveTab] = useState('general');
  const [addingEvent, setAddingEvent] = useState(false);
  const [newEventStatus, setNewEventStatus] = useState<IntlImportPackageStatus>('IN_TRANSIT');
  const [newEventLabel, setNewEventLabel] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [loadingEvent, setLoadingEvent] = useState(false);

  // Deletion & Edit state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Historial de movimientos entre contenedores
  const [movements, setMovements] = useState<PackageMovement[]>([]);

  useEffect(() => {
    if (!open || !packageData?.id) return;
    let active = true;
    intlImportsService
      .getPackageMovements(packageData.id)
      .then((list) => {
        if (active) setMovements(list || []);
      })
      .catch(() => {
        // El historial de movimientos es informativo: no debe bloquear el detalle.
        if (active) setMovements([]);
      });
    return () => {
      active = false;
    };
  }, [open, packageData?.id]);

  if (!packageData) return null;

  const customerDisplayName = getCustomerName(packageData);
  const supplierDisplayName = getSupplierName(packageData);
  const statusLabel = INTL_PACKAGE_STATUS_LABELS[packageData.status] || packageData.status;
  const statusColorClass = statusBadgeColors[packageData.status] || 'bg-primary/10 text-primary border-primary/20';

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoadingEvent(true);
      await intlImportsService.addPackageEvent(packageData.id, {
        status: newEventStatus,
        label: newEventLabel.trim() || INTL_PACKAGE_STATUS_LABELS[newEventStatus],
        location: newEventLocation.trim() || undefined,
        description: newEventDescription.trim() || undefined,
      });
      toast.success('Evento de trazabilidad registrado exitosamente');
      setAddingEvent(false);
      setNewEventLabel('');
      setNewEventLocation('');
      setNewEventDescription('');
      onRefresh?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al agregar evento'));
    } finally {
      setLoadingEvent(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await intlImportsService.deletePackage(packageData.id);
      toast.success(`Paquete ${packageData.trackingCode} eliminado exitosamente`);
      setConfirmDeleteOpen(false);
      onOpenChange(false);
      onDeleteSuccess?.();
      onRefresh?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al eliminar el paquete'));
    } finally {
      setDeleting(false);
    }
  };

  const canDelete =
    packageData.status !== 'DELIVERED' &&
    !packageData.container?.containerNumber &&
    !packageData.container?.isClosed &&
    packageData.container?.status !== 'COMPLETED';

  const sortedEvents = [...(packageData.events || [])].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  const sortedMovements = [...movements].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          data-intl-sheet="true"
          className="erp-detail-panel erp-detail-panel--compact flex w-full min-w-0 flex-col gap-0 overflow-hidden border-l border-border/50 bg-background p-0 sm:max-w-xl"
        >
          {/* Header Standard NovaHub */}
          <SheetHeader className="sticky top-0 z-10 space-y-3 border-b border-border/50 bg-background/95 px-4 py-4 pr-12 backdrop-blur-md sm:px-6 sm:py-5">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-10 sm:size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Package className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="flex min-w-0 flex-wrap items-center gap-2 text-base sm:text-lg font-black uppercase tracking-tight">
                  <span className="break-words font-mono">PAQUETE {packageData.trackingCode}</span>
                  <Badge className={`border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusColorClass}`}>
                    {statusLabel}
                  </Badge>
                </SheetTitle>
                <SheetDescription className="mt-1 truncate text-xs font-medium text-muted-foreground">
                  {customerDisplayName}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Body with Sub-Tabs */}
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="h-10 w-full justify-start overflow-x-auto rounded-xl border border-border/40 bg-muted/40 p-1 font-bold text-xs">
                <TabsTrigger value="general" className="flex-1 sm:flex-initial shrink-0 gap-1.5 rounded-lg px-3 py-1 text-xs font-bold">
                  <FileText className="size-3.5" /> General
                </TabsTrigger>
                <TabsTrigger value="historial" className="flex-1 sm:flex-initial shrink-0 gap-1.5 rounded-lg px-3 py-1 text-xs font-bold">
                  <History className="size-3.5" /> Historial
                </TabsTrigger>
              </TabsList>

              {/* TAB GENERAL */}
              <TabsContent value="general" className="mt-0 space-y-4 outline-none">
                {/* Hero Summary Card */}
                <section className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-3.5 sm:p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {packageData.proratedCost && packageData.proratedCost > 0
                      ? 'Costo Aduanal Prorrateado'
                      : 'Peso Cobrable Total'}
                  </p>
                  <p className="mt-1 text-2xl sm:text-3xl font-black tabular-nums text-primary font-mono">
                    {packageData.proratedCost && packageData.proratedCost > 0
                      ? `$${packageData.proratedCost.toFixed(2)} USD`
                      : `${packageData.chargeableWeightKg || packageData.chargeableWeight || packageData.actualWeightKg} kg`}
                  </p>

                  <div className="mt-3 border-t border-primary/15 pt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Peso Real: <strong className="text-foreground font-mono">{packageData.actualWeightKg} kg</strong>
                    </span>
                    <span>
                      Volumen: <strong className="text-foreground font-mono">{packageData.volumeCbm} CBM</strong>
                    </span>
                    {packageData.declaredValueUsd && Number(packageData.declaredValueUsd) > 0 ? (
                      <span>
                        Val. Declarado: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">${Number(packageData.declaredValueUsd).toFixed(2)} USD</strong>
                      </span>
                    ) : null}
                    {packageData.originalTrackingNumber && (
                      <span>
                        Tracking Courier:{' '}
                        <strong className="text-foreground font-mono break-all">{packageData.originalTrackingNumber}</strong>
                      </span>
                    )}
                  </div>
                </section>

                {/* Acciones directas */}
                <section className="flex flex-wrap gap-2">
                  {canEditPackage(packageData) && (
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 sm:flex-initial gap-2 rounded-xl text-xs"
                      onClick={() => setEditModalOpen(true)}
                    >
                      <Pencil className="size-4 shrink-0 text-primary" /> Editar paquete
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 sm:flex-initial gap-2 rounded-xl text-xs"
                    onClick={() => {
                      setActiveTab('historial');
                      setAddingEvent(true);
                    }}
                  >
                    <Plus className="size-4 shrink-0 text-primary" /> Registrar evento
                  </Button>

                  {canDelete && (
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 sm:flex-initial gap-2 rounded-xl text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setConfirmDeleteOpen(true)}
                    >
                      <Trash2 className="size-4 shrink-0" /> Eliminar paquete
                    </Button>
                  )}
                </section>

                {/* Card Información General */}
                <section className="rounded-2xl border border-border/50 p-3.5 sm:p-4">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Información general
                  </p>
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div className="flex min-w-0 gap-2">
                      <UserRound className="mt-0.5 size-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground">Cliente / Destinatario</p>
                        <p className="mt-0.5 break-words font-semibold">{customerDisplayName}</p>
                      </div>
                    </div>

                    <div className="flex min-w-0 gap-2">
                      <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground">Fecha de Recepción</p>
                        <p className="mt-0.5 break-words font-semibold">
                          {packageData.createdAt
                            ? format(new Date(packageData.createdAt), 'dd/MM/yyyy', { locale: es })
                            : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="flex min-w-0 gap-2">
                      <Package className="mt-0.5 size-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground">N.° Factura / Referencia</p>
                        <p className="mt-0.5 break-words font-mono font-semibold">
                          {packageData.originalTrackingNumber || '—'}
                        </p>
                      </div>
                    </div>

                    <div className="flex min-w-0 gap-2">
                      <Ship className="mt-0.5 size-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground">Contenedor Asignado</p>
                        <p className="mt-0.5 break-words font-mono font-semibold text-primary">
                          {packageData.containerNumber || packageData.container?.containerNumber || 'Sin consolidar'}
                        </p>
                      </div>
                    </div>

                    <div className="flex min-w-0 gap-2 sm:col-span-2">
                      <Building2 className="mt-0.5 size-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground">Proveedor / Remitente</p>
                        <p className="mt-0.5 break-words font-semibold">{supplierDisplayName}</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Card Especificaciones Físicas */}
                <section className="rounded-2xl border border-border/50 p-3.5 sm:p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Especificaciones físicas
                    </p>
                    <span className="text-xs font-bold text-muted-foreground">Cálculo IATA</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
                      <span className="text-[10px] text-muted-foreground block font-bold uppercase">Peso Real</span>
                      <span className="mt-1 font-mono font-black text-sm text-foreground">
                        {packageData.actualWeightKg} kg
                      </span>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
                      <span className="text-[10px] text-muted-foreground block font-bold uppercase">Volumen</span>
                      <span className="mt-1 font-mono font-black text-sm text-foreground">
                        {packageData.volumeCbm} CBM
                      </span>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
                      <span className="text-[10px] text-muted-foreground block font-bold uppercase">CBM Facturable</span>
                      <span className="mt-1 font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                        {packageData.billableCbm != null ? `${Number(packageData.billableCbm).toFixed(4)} CBM` : '—'}
                      </span>
                      {packageData.volumetricFactorKgPerCbm != null && (
                        <span className="text-[10px] text-muted-foreground block font-mono">
                          factor {packageData.volumetricFactorKgPerCbm} kg/CBM
                        </span>
                      )}
                    </div>

                    <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
                      <span className="text-[10px] text-muted-foreground block font-bold uppercase">Peso Cobrable</span>
                      <span className="mt-1 font-mono font-black text-sm text-primary">
                        {packageData.chargeableWeightKg || packageData.chargeableWeight || packageData.actualWeightKg} kg
                      </span>
                    </div>

                    <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5 col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-muted-foreground block font-bold uppercase">Val. Declarado</span>
                      <span className="mt-1 font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                        {packageData.declaredValueUsd && Number(packageData.declaredValueUsd) > 0
                          ? `$${Number(packageData.declaredValueUsd).toFixed(2)}`
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {packageData.description && (
                    <div className="mt-3 rounded-xl border border-border/40 bg-muted/10 p-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Descripción de mercadería
                      </p>
                      <p className="mt-1 text-xs text-foreground whitespace-pre-wrap">{packageData.description}</p>
                    </div>
                  )}
                </section>

                {/* Contenedor Asignado */}
                {(packageData.containerNumber || packageData.container?.containerNumber) && (
                  <section className="rounded-2xl border border-border/50 bg-muted/10 p-4">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Lote de Contenedor
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Ship className="size-4 text-primary" />
                        <span className="font-mono font-bold text-sm">
                          {packageData.containerNumber || packageData.container?.containerNumber}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        CONSOLIDADO
                      </Badge>
                    </div>
                  </section>
                )}
              </TabsContent>

              {/* TAB HISTORIAL */}
              <TabsContent value="historial" className="mt-0 space-y-4 outline-none">
                {/* Botón / Formulario para agregar evento */}
                <div className="flex items-center justify-between pb-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Línea de tiempo de eventos
                  </p>
                  {!addingEvent && (
                    <Button size="sm" variant="outline" onClick={() => setAddingEvent(true)} className="rounded-lg text-xs gap-1 h-8">
                      <Plus className="size-3.5" /> Nuevo Evento
                    </Button>
                  )}
                </div>

                {addingEvent && (
                  <form onSubmit={handleAddEvent} className="rounded-2xl border border-primary/20 bg-muted/30 p-4 space-y-3">
                    <p className="text-xs font-bold text-foreground">Registrar Nuevo Estado / Hito</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Estado</label>
                        <select
                          className="w-full text-xs rounded-lg border border-border bg-background p-2"
                          value={newEventStatus}
                          onChange={(e) => setNewEventStatus(e.target.value as IntlImportPackageStatus)}
                        >
                          {Object.entries(INTL_PACKAGE_STATUS_LABELS).map(([k, label]) => (
                            <option key={k} value={k}>{label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Ubicación (Opcional)</label>
                        <Input
                          placeholder="Ej. Aduana Managua / Puerto"
                          className="h-9 text-xs rounded-lg"
                          value={newEventLocation}
                          onChange={(e) => setNewEventLocation(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Título del Evento *</label>
                      <Input
                        required
                        placeholder="Ej. Paquete liberado de aforo aduanal"
                        className="h-9 text-xs rounded-lg"
                        value={newEventLabel}
                        onChange={(e) => setNewEventLabel(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">Notas / Detalle (Opcional)</label>
                      <Input
                        placeholder="Detalles adicionales del movimiento"
                        className="h-9 text-xs rounded-lg"
                        value={newEventDescription}
                        onChange={(e) => setNewEventDescription(e.target.value)}
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                      <Button type="button" size="sm" variant="ghost" onClick={() => setAddingEvent(false)} className="h-8">
                        Cancelar
                      </Button>
                      <Button type="submit" size="sm" disabled={loadingEvent} className="h-8">
                        {loadingEvent ? 'Guardando...' : 'Guardar Evento'}
                      </Button>
                    </div>
                  </form>
                )}

                {/* Timeline Standard Cards (matching Image 3) */}
                <div className="relative pl-6 pb-2 border-l-2 border-primary/20 space-y-4">
                  {sortedEvents.length > 0 ? (
                    sortedEvents.map((evt) => (
                      <div key={evt.id} className="relative group">
                        {/* Circular timeline indicator dot */}
                        <div className="absolute left-[-29px] top-1 size-2.5 rounded-full bg-primary ring-4 ring-background" />

                        {/* Event Card */}
                        <div className="-mt-1.5 p-4 rounded-2xl bg-card border border-border/40 shadow-sm relative overflow-hidden group">
                          <div className="relative z-10 flex flex-col gap-2">
                            {/* Card Top Row: Badge + Date */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Badge
                                variant="outline"
                                className={`text-[9px] font-black uppercase tracking-widest border ${getEventBadgeColor(evt.status)}`}
                              >
                                {INTL_PACKAGE_STATUS_LABELS[evt.status] || evt.status}
                              </Badge>

                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground font-mono">
                                <Calendar className="size-3 text-muted-foreground" />
                                {format(new Date(evt.occurredAt), "dd MMM yyyy, HH:mm", { locale: es })}
                              </div>
                            </div>

                            {/* Author / Source */}
                            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                              <UserRound className="size-3.5 text-primary shrink-0" />
                              <span>Operaciones de Importación</span>
                              {evt.location && (
                                <span className="flex items-center gap-1 text-[11px] font-normal text-muted-foreground ml-auto">
                                  <MapPin className="size-3 text-muted-foreground" /> {evt.location}
                                </span>
                              )}
                            </div>

                            {/* Label & Description */}
                            <div className="text-xs text-foreground mt-1">
                              <p className="font-semibold text-foreground">{translateEventText(evt.label)}</p>
                              {evt.description && (
                                <p className="text-[11px] text-muted-foreground mt-1 whitespace-pre-wrap">
                                  {translateEventText(evt.description)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-muted-foreground italic py-4">
                      No hay eventos registrados para este paquete.
                    </div>
                  )}
                </div>

                {/* Movimientos entre contenedores (append-only en el backend) */}
                {sortedMovements.length > 0 && (
                  <div className="space-y-2 border-t border-border/50 pt-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Movimientos de Contenedor
                    </p>
                    {sortedMovements.map((m) => (
                      <div key={m.id} className="rounded-xl border border-border/50 bg-muted/20 p-3 text-xs space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-muted-foreground">
                            {m.fromContainerNumber || 'Bodega'}
                          </span>
                          <ArrowRightLeft className="size-3 text-muted-foreground" />
                          <span className="font-mono font-bold text-foreground">
                            {m.toContainerNumber || 'Sin contenedor'}
                          </span>
                          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                            {format(new Date(m.occurredAt), 'dd MMM yyyy, HH:mm', { locale: es })}
                          </span>
                        </div>
                        {(m.billableCbmBefore != null || m.billableCbmAfter != null) && (
                          <div className="font-mono text-[11px] text-muted-foreground">
                            CBM facturable {Number(m.billableCbmBefore ?? 0).toFixed(4)} →{' '}
                            {Number(m.billableCbmAfter ?? 0).toFixed(4)}
                          </div>
                        )}
                        {m.reason && <p className="text-[11px] text-muted-foreground">{m.reason}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Footer Standard NovaHub */}
          <SheetFooter className="border-t border-border/50 bg-background/95 px-5 py-3 backdrop-blur-md sm:px-6">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="ml-auto gap-1.5 rounded-xl font-bold text-xs"
            >
              Cerrar <ChevronRight className="size-3" />
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={`¿Eliminar paquete ${packageData.trackingCode}?`}
        description="Esta acción eliminará el paquete y todos sus registros de trazabilidad de forma permanente."
        confirmLabel="Eliminar paquete"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />

      <EditIntlPackageModal
        packageData={packageData}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSuccess={() => onRefresh?.()}
      />
    </>
  );
}
