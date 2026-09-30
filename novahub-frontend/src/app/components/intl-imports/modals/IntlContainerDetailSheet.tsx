import { useState, useEffect, useCallback } from 'react';
import {
  Ship,
  Package,
  Trash2,
  RefreshCw,
  ChevronRight,
  Eye,
  Calendar,
  Scale,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from '@/app/services/toast';
import { getApiErrorMessage } from '@/app/services/api';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Card } from '../../ui/card';
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
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '../../ui/table';
import {
  intlImportsService,
  INTL_PACKAGE_STATUS_LABELS,
  INTL_CONTAINER_STATUS_LABELS,
  type IntlImportContainer,
  type IntlImportContainerStatus,
  type IntlImportPackage,
  type IntlImportPackageStatus,
} from '../../../services/intl-imports.service';
import { IntlPackageDetailSheet } from './IntlPackageDetailSheet';

interface IntlContainerDetailSheetProps {
  container: IntlImportContainer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
}

const containerStatusColors: Record<IntlImportContainerStatus, string> = {
  OPEN: 'bg-secondary text-secondary-foreground border-border/50',
  CONSOLIDATED: 'bg-secondary text-secondary-foreground border-border/50',
  IN_TRANSIT: 'bg-primary/10 text-primary border-primary/20',
  CUSTOMS_CLEARANCE: 'bg-secondary text-secondary-foreground border-border/50',
  COMPLETED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  CANCELLED: 'bg-destructive/10 text-destructive border-destructive/20',
};

const packageStatusColors: Record<IntlImportPackageStatus, string> = {
  RECEIVED_AT_WAREHOUSE: 'bg-secondary text-secondary-foreground border-border/50',
  CONSOLIDATED: 'bg-secondary text-secondary-foreground border-border/50',
  IN_TRANSIT: 'bg-primary/10 text-primary border-primary/20',
  CUSTOMS_CLEARANCE: 'bg-secondary text-secondary-foreground border-border/50',
  AVAILABLE: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  DELIVERED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  CANCELLED: 'bg-destructive/10 text-destructive border-destructive/20',
};

const getCustomerDisplayName = (pkg: IntlImportPackage) => {
  if (pkg.customer?.name) return pkg.customer.name;
  if (pkg.customerName) return pkg.customerName;
  const match = pkg.description?.match(/Cliente:\s*([^|)]+)/);
  if (match) return match[1].trim();
  if (pkg.customerId) return `Cliente ${pkg.customerId.slice(-6).toUpperCase()}`;
  return '—';
};

export function IntlContainerDetailSheet({
  container,
  open,
  onOpenChange,
  onRefresh,
}: IntlContainerDetailSheetProps) {
  const [packages, setPackages] = useState<IntlImportPackage[]>([]);
  const [loading, setLoading] = useState(false);

  // Package detail sub-sheet
  const [selectedPackage, setSelectedPackage] = useState<IntlImportPackage | null>(null);
  const [packageSheetOpen, setPackageSheetOpen] = useState(false);
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  // Delete state
  const [packageToDelete, setPackageToDelete] = useState<IntlImportPackage | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPackages = useCallback(async () => {
    if (!container) return;
    try {
      setLoading(true);
      const result = await intlImportsService.listPackages({ containerId: container.id, limit: 100 });
      setPackages(result.data || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al cargar los paquetes del contenedor'));
    } finally {
      setLoading(false);
    }
  }, [container]);

  useEffect(() => {
    if (open && container) {
      /* eslint-disable react-hooks/set-state-in-effect */
      // Use packages already embedded in the container if available, otherwise fetch
      if (container.packages && container.packages.length > 0) {
        setPackages(container.packages);
      } else {
        fetchPackages();
      }
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open, container, fetchPackages]);

  const handleDeletePackage = async () => {
    if (!packageToDelete) return;
    try {
      setDeleting(true);
      await intlImportsService.deletePackage(packageToDelete.id);
      toast.success(`Paquete ${packageToDelete.trackingCode} eliminado del contenedor`);
      setPackageToDelete(null);
      // Refresh local list
      await fetchPackages();
      // Propagate to parent (refresh container list)
      onRefresh?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al eliminar el paquete'));
    } finally {
      setDeleting(false);
    }
  };

  if (!container) return null;

  const usedCbm = container.totalVolumeCbm ?? packages.reduce((s, p) => s + (Number(p.volumeCbm) || 0), 0);
  const maxCbm = container.maxCapacityCbm || container.capacityCbm || 20;
  const cbmPercent = maxCbm > 0 ? Math.min(100, Math.round((usedCbm / maxCbm) * 100)) : 0;
  const usedWeight = container.totalActualWeightKg ?? packages.reduce((s, p) => s + (Number(p.actualWeightKg) || 0), 0);
  const totalExpenses = container.totalExpensesUsd ?? 0;
  const isFull = cbmPercent >= 85;

  const statusLabel = INTL_CONTAINER_STATUS_LABELS[container.status] || container.status;
  const statusColorClass = containerStatusColors[container.status] || 'bg-secondary text-secondary-foreground border-border/50';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="erp-detail-panel erp-detail-panel--compact flex w-full min-w-0 flex-col gap-0 overflow-hidden border-l border-border/50 bg-background p-0 sm:max-w-2xl"
        >
          {/* Header */}
          <SheetHeader className="sticky top-0 z-10 space-y-3 border-b border-border/50 bg-background/95 px-5 py-5 pr-12 backdrop-blur-md sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Ship className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="flex min-w-0 flex-wrap items-center gap-2 text-lg font-black uppercase tracking-tight">
                  <span className="break-words font-mono">{container.containerNumber}</span>
                  <Badge className={`border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${statusColorClass}`}>
                    {statusLabel}
                  </Badge>
                </SheetTitle>
                <SheetDescription className="mt-1 text-xs font-medium text-muted-foreground">
                  {container.sealNumber ? `Sello: ${container.sealNumber}` : 'Detalle de paquetes del contenedor'}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Body */}
          <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-5 sm:p-6 space-y-5">

            {/* Métricas del contenedor */}
            <section className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-4 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Capacidad Volumétrica
              </p>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-muted-foreground">Ocupación CBM:</span>
                <span className={`font-mono ${isFull ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-foreground'}`}>
                  {usedCbm.toFixed(2)} / {maxCbm} CBM ({cbmPercent}%)
                </span>
              </div>
              <div className="w-full bg-border/60 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${isFull ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${cbmPercent}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-primary/15">
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">Paquetes</p>
                  <p className="font-mono font-black text-sm text-foreground mt-0.5">{packages.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">Peso Real</p>
                  <p className="font-mono font-black text-sm text-foreground mt-0.5">{usedWeight.toFixed(1)} kg</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">Gastos</p>
                  <p className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400 mt-0.5">
                    ${totalExpenses.toFixed(2)}
                  </p>
                </div>
              </div>
            </section>

            {/* Fechas */}
            {(container.estimatedDeparture || container.estimatedArrival) && (
              <section className="rounded-2xl border border-border/50 p-4">
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Fechas Marítimas
                </p>
                <div className="flex flex-wrap gap-4 text-xs text-foreground">
                  {container.estimatedDeparture && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">ETD:</span>
                      <span className="font-mono font-semibold">
                        {format(new Date(container.estimatedDeparture), 'dd/MM/yyyy', { locale: es })}
                      </span>
                    </div>
                  )}
                  {container.estimatedArrival && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">ETA:</span>
                      <span className="font-mono font-semibold">
                        {format(new Date(container.estimatedArrival), 'dd/MM/yyyy', { locale: es })}
                      </span>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Tabla de paquetes */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Paquetes Asignados
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchPackages}
                  disabled={loading}
                  className="h-8 gap-1 text-xs"
                >
                  <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
              </div>

              {loading ? (
                <Card className="p-6 text-center text-xs text-muted-foreground border-dashed">
                  Cargando paquetes...
                </Card>
              ) : packages.length === 0 ? (
                <Card className="p-6 text-center text-xs text-muted-foreground border-dashed">
                  Este contenedor no tiene paquetes asignados.
                </Card>
              ) : (
                <div className="rounded-xl border border-border/50 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="text-[10px] font-black uppercase tracking-wider py-2">
                          <span className="flex items-center gap-1.5">
                            <Package className="size-3.5" />
                            Código
                          </span>
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider py-2">Cliente</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider py-2 text-right">
                          <span className="flex items-center gap-1.5 justify-end">
                            <Scale className="size-3.5" />
                            Peso / CBM
                          </span>
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider py-2 text-right">
                          Val. Declarado
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider py-2">Estado</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider py-2 text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {packages.map((pkg) => {
                        const customerName = getCustomerDisplayName(pkg);
                        const pkgStatusLabel = INTL_PACKAGE_STATUS_LABELS[pkg.status] || pkg.status;
                        const pkgStatusColor = packageStatusColors[pkg.status] || 'bg-muted/30 text-muted-foreground border-border/50';
                        const declaredValue = pkg.declaredValueUsd ? Number(pkg.declaredValueUsd) : 0;

                        return (
                          <TableRow key={pkg.id} className="hover:bg-muted/20 transition-colors">
                            <TableCell className="py-2.5">
                              <span className="font-mono font-bold text-xs text-foreground">{pkg.trackingCode}</span>
                            </TableCell>
                            <TableCell className="py-2.5 max-w-[140px]">
                              <span className="text-xs text-foreground truncate block">{customerName}</span>
                            </TableCell>
                            <TableCell className="py-2.5 text-right">
                              <span className="font-mono text-xs text-foreground">
                                {Number(pkg.actualWeightKg).toFixed(1)} kg
                              </span>
                              <span className="text-[10px] text-muted-foreground block">
                                {Number(pkg.volumeCbm).toFixed(4)} CBM
                              </span>
                            </TableCell>
                            <TableCell className="py-2.5 text-right font-mono text-xs font-semibold">
                              {declaredValue > 0 ? (
                                <span className="text-emerald-600 dark:text-emerald-400">${declaredValue.toFixed(2)}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="py-2.5">
                              <Badge
                                variant="outline"
                                className={`text-[9px] font-black uppercase tracking-wider border ${pkgStatusColor}`}
                              >
                                {pkgStatusLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5 text-right">
                              <div className="flex items-center gap-1 justify-end">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 rounded-lg"
                                  title="Ver detalle"
                                  disabled={loadingDetailId === pkg.id}
                                  onClick={async () => {
                                    try {
                                      setLoadingDetailId(pkg.id);
                                      const full = await intlImportsService.getPackage(pkg.id);
                                      setSelectedPackage(full);
                                    } catch {
                                      setSelectedPackage(pkg);
                                    } finally {
                                      setLoadingDetailId(null);
                                      setPackageSheetOpen(true);
                                    }
                                  }}
                                >
                                  {loadingDetailId === pkg.id
                                    ? <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                                    : <Eye className="size-3.5 text-muted-foreground" />
                                  }
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-0 disabled:pointer-events-none"
                                  title="Eliminar paquete"
                                  disabled={container.isClosed || container.status === 'COMPLETED'}
                                  onClick={() => setPackageToDelete(pkg)}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          </div>

          {/* Footer */}
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

      {/* Sub-sheet: detalle del paquete */}
      <IntlPackageDetailSheet
        packageData={selectedPackage}
        open={packageSheetOpen}
        onOpenChange={setPackageSheetOpen}
        onRefresh={() => {
          fetchPackages();
          onRefresh?.();
        }}
        onDeleteSuccess={() => {
          setPackageSheetOpen(false);
          fetchPackages();
          onRefresh?.();
        }}
      />

      {/* Confirmar eliminación */}
      <ConfirmDialog
        open={Boolean(packageToDelete)}
        onOpenChange={(open) => !open && setPackageToDelete(null)}
        title={`¿Eliminar paquete ${packageToDelete?.trackingCode}?`}
        description="Esta acción eliminará el paquete y todos sus registros de trazabilidad de forma permanente. El paquete también será removido de este contenedor."
        confirmLabel="Eliminar paquete"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDeletePackage}
      />
    </>
  );
}
