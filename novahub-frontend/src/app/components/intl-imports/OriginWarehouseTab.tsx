import React, { useState, useEffect, useCallback } from 'react';
import {
  Boxes,
  Search,
  PackagePlus,
  PackageCheck,
  Scale,
  RefreshCw,
  Eye,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Pencil,
} from 'lucide-react';
import { toast } from '@/app/services/toast';
import { getApiErrorMessage } from '@/app/services/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '../ui/table';
import {
  intlImportsService,
  INTL_PACKAGE_STATUS_LABELS,
  canEditPackage,
  type IntlImportPackage,
  type IntlImportPackageStatus,
  type IntlImportConfig,
} from '../../services/intl-imports.service';
import { NewIntlPackageModal } from './modals/NewIntlPackageModal';
import { IntlPackageDetailSheet } from './modals/IntlPackageDetailSheet';

interface OriginWarehouseTabProps {
  canCreate?: boolean;
}

const statusBadgeVariant = (status: IntlImportPackageStatus) => {
  switch (status) {
    case 'RECEIVED_AT_WAREHOUSE':
      return 'secondary';
    case 'CONSOLIDATED':
      return 'outline';
    case 'IN_TRANSIT':
      return 'default';
    case 'CUSTOMS_CLEARANCE':
      return 'secondary';
    case 'AVAILABLE':
      return 'default';
    case 'DELIVERED':
      return 'default';
    case 'CANCELLED':
      return 'destructive';
    default:
      return 'secondary';
  }
};

const getCustomerDisplayName = (pkg: IntlImportPackage) => {
  if (pkg.customer?.name) return pkg.customer.name;
  if (pkg.customerName) return pkg.customerName;
  const match = pkg.description?.match(/Cliente:\s*([^|)]+)/);
  if (match) return match[1].trim();
  return 'Cliente Genérico';
};

const getSupplierDisplayName = (pkg: IntlImportPackage) => {
  if (pkg.supplier?.name) return pkg.supplier.name;
  if (pkg.supplierName) return pkg.supplierName;
  const match = pkg.description?.match(/Proveedor:\s*([^|)]+)/);
  if (match) return match[1].trim();
  return pkg.senderName || 'No especificado';
};

export function OriginWarehouseTab({ canCreate = true }: OriginWarehouseTabProps) {
  const [packages, setPackages] = useState<IntlImportPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [newModalOpen, setNewModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<IntlImportPackage | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<IntlImportPackage | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [packageToEdit, setPackageToEdit] = useState<IntlImportPackage | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const [config, setConfig] = useState<IntlImportConfig | null>(null);

  // Quick lookup tracking input
  const [quickLookupCode, setQuickLookupCode] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);

  useEffect(() => {
    intlImportsService.getConfig().then(setConfig).catch(() => undefined);
  }, []);

  const handleDeletePackage = async () => {
    if (!packageToDelete) return;
    try {
      setDeleting(true);
      await intlImportsService.deletePackage(packageToDelete.id);
      toast.success(`Paquete ${packageToDelete.trackingCode} eliminado exitosamente`);
      setPackageToDelete(null);
      await fetchPackages();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al eliminar el paquete'));
    } finally {
      setDeleting(false);
    }
  };

  const fetchPackages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await intlImportsService.listPackages({
        page,
        limit: 15,
        search: search.trim() || undefined,
        status: (statusFilter as IntlImportPackageStatus) || undefined,
      });
      setPackages(res.data || []);
      setTotalPages(res.totalPages || 1);
      setTotalItems(res.total || 0);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al cargar paquetes de bodega origen'));
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchPackages, 250);
    return () => clearTimeout(timer);
  }, [fetchPackages]);

  const handleQuickLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickLookupCode.trim()) return;
    try {
      setLookupBusy(true);
      const pkg = await intlImportsService.getPackageByTracking(quickLookupCode.trim());
      setSelectedPackage(pkg);
      setDetailSheetOpen(true);
      setQuickLookupCode('');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se encontró el paquete con ese código CC o tracking'));
    } finally {
      setLookupBusy(false);
    }
  };

  // KPIs
  const kpis = React.useMemo(() => {
    const inWarehouse = packages.filter((p) => p.status === 'RECEIVED_AT_WAREHOUSE').length;
    const unassigned = packages.filter((p) => !p.containerId).length;
    const totalCbm = packages.reduce((sum, p) => sum + (p.volumeCbm || 0), 0);
    const available = packages.filter((p) => p.status === 'AVAILABLE').length;
    return { inWarehouse, unassigned, totalCbm: totalCbm.toFixed(3), available };
  }, [packages]);

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0 max-w-full">
      {/* Consultar / Buscador Rápido de Tracking */}
      <Card className="p-3.5 sm:p-4 border-border/70 bg-card">
        <form onSubmit={handleQuickLookup} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              placeholder="Ingresa código CC o tracking original (ej. CC-2026-0001)..."
              className="pl-9 text-xs font-mono"
              value={quickLookupCode}
              onChange={(e) => setQuickLookupCode(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:flex items-stretch sm:items-center gap-2 shrink-0">
            <Button type="submit" disabled={lookupBusy || !quickLookupCode.trim()} className="w-full sm:w-auto shrink-0">
              {lookupBusy ? <RefreshCw className="size-4 animate-spin mr-1.5" /> : <Search className="size-4 mr-1.5" />}
              Consultar Paquete
            </Button>
            {canCreate && (
              <Button
                type="button"
                variant="default"
                onClick={() => setNewModalOpen(true)}
                className="w-full sm:w-auto shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <PackagePlus className="size-4 mr-1.5" />
                Nuevo Paquete
              </Button>
            )}
          </div>
        </form>
      </Card>

      <div className="intl-imports-kpis grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
        <Card className="p-3 sm:p-3.5 border-border/70 flex flex-row items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
            <Boxes className="size-4" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <span className="text-[11px] sm:text-xs font-medium text-muted-foreground block truncate">En Bodega Origen</span>
            <span className="text-base sm:text-lg font-bold font-mono text-foreground tabular-nums block truncate">
              {kpis.inWarehouse}
            </span>
          </div>
        </Card>

        <Card className="p-3 sm:p-3.5 border-border/70 flex flex-row items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
            <Scale className="size-4" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <span className="text-[11px] sm:text-xs font-medium text-muted-foreground block truncate">Sin Contenedor</span>
            <span className="text-base sm:text-lg font-bold font-mono text-foreground tabular-nums block truncate">
              {kpis.unassigned}
            </span>
          </div>
        </Card>

        <Card className="p-3 sm:p-3.5 border-border/70 flex flex-row items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
            <FileSpreadsheet className="size-4" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <span className="text-[11px] sm:text-xs font-medium text-muted-foreground block truncate">Volumen Acumulado</span>
            <span className="text-base sm:text-lg font-bold font-mono text-foreground tabular-nums block truncate">
              {kpis.totalCbm} CBM
            </span>
          </div>
        </Card>

        <Card className="p-3 sm:p-3.5 border-border/70 flex flex-row items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
            <PackageCheck className="size-4" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <span className="text-[11px] sm:text-xs font-medium text-muted-foreground block truncate">Disponibles Retiro</span>
            <span className="text-base sm:text-lg font-bold font-mono text-foreground tabular-nums block truncate">
              {kpis.available}
            </span>
          </div>
        </Card>
      </div>

      {/* Controles de Filtrado de la Tabla */}
      <Card className="p-3.5 sm:p-4 border-border/70 space-y-4 min-w-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-2.5 w-full min-w-0">
            <div className="relative flex-1 sm:max-w-sm min-w-0">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar por código CC, cliente o remitente..."
                className="pl-8 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
              <select
                className="flex-1 sm:flex-initial text-xs rounded-md border border-border bg-background p-2 min-w-0"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Todos los Estados</option>
                {Object.entries(INTL_PACKAGE_STATUS_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={fetchPackages}
                disabled={loading}
                className="shrink-0 sm:hidden"
              >
                <RefreshCw className={`size-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchPackages}
            disabled={loading}
            className="hidden sm:inline-flex shrink-0"
          >
            <RefreshCw className={`size-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        {/* Tabla Oficial de Paquetes */}
        <Table responsiveCards viewport>
          <TableHeader>
            <TableRow>
              <TableHead>Código CC</TableHead>
              <TableHead>Cliente / Destinatario</TableHead>
              <TableHead>Remitente / Proveedor</TableHead>
              <TableHead className="text-right">Peso Real</TableHead>
              <TableHead className="text-right">Volumen / CBM fact.</TableHead>
              <TableHead className="text-right">Peso Cobrable</TableHead>
              <TableHead className="text-right">Val. Declarado</TableHead>
              <TableHead>Contenedor</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-xs">
                  Cargando paquetes de importación...
                </TableCell>
              </TableRow>
            ) : packages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-xs">
                  No se encontraron paquetes registrados en Bodega Origen.
                </TableCell>
              </TableRow>
            ) : (
              packages.map((pkg) => (
                <TableRow key={pkg.id} className="hover:bg-muted/50 transition-colors">
                  <TableCell className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPackage(pkg);
                        setDetailSheetOpen(true);
                      }}
                      className="hover:underline text-left"
                    >
                      {pkg.trackingCode}
                    </button>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {getCustomerDisplayName(pkg)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {getSupplierDisplayName(pkg)}
                  </TableCell>
                  <TableCell className="text-right font-mono">{pkg.actualWeightKg} kg</TableCell>
                  <TableCell className="text-right font-mono font-semibold text-foreground">
                    <div>
                      <div>{pkg.volumeCbm} CBM</div>
                      <div className="text-[10px] text-muted-foreground">
                        {pkg.billableCbm != null ? `${Number(pkg.billableCbm).toFixed(4)} fact.` : '— fact.'}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">{pkg.chargeableWeight || pkg.chargeableWeightKg} kg</TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold">
                    {pkg.declaredValueUsd && Number(pkg.declaredValueUsd) > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400">${Number(pkg.declaredValueUsd).toFixed(2)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono">
                    {pkg.containerNumber || pkg.container?.containerNumber ? (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {pkg.containerNumber || pkg.container?.containerNumber}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-[11px] italic">Sin asignar</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(pkg.status)}>
                      {INTL_PACKAGE_STATUS_LABELS[pkg.status] || pkg.status}
                    </Badge>
                  </TableCell>
                  <TableCell data-actions-column="true" className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        title="Ver detalle"
                        aria-label={`Ver detalle de ${pkg.trackingCode}`}
                        onClick={() => {
                          setSelectedPackage(pkg);
                          setDetailSheetOpen(true);
                        }}
                      >
                        <Eye className="size-3.5" />
                      </Button>

                      {canEditPackage(pkg) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          title="Editar paquete"
                          aria-label={`Editar ${pkg.trackingCode}`}
                          onClick={() => {
                            setPackageToEdit(pkg);
                            setEditModalOpen(true);
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                      {pkg.status !== 'DELIVERED' && pkg.container?.status !== 'COMPLETED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive px-2"
                          title="Eliminar paquete"
                          aria-label={`Eliminar ${pkg.trackingCode}`}
                          onClick={() => setPackageToDelete(pkg)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-3 text-xs border-t border-border">
            <span className="text-muted-foreground text-center sm:text-left">
              Mostrando página {page} de {totalPages} ({totalItems} paquetes en total)
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                <ChevronLeft className="size-3.5" /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Siguiente <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modales */}
      <NewIntlPackageModal
        open={newModalOpen}
        onOpenChange={setNewModalOpen}
        onSuccess={() => fetchPackages()}
        volumetricFactor={config?.volumetricFactorKgPerCbm || 167}
      />

      <IntlPackageDetailSheet
        packageData={selectedPackage}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onRefresh={() => fetchPackages()}
      />

      <ConfirmDialog
        open={Boolean(packageToDelete)}
        onOpenChange={(open) => !open && setPackageToDelete(null)}
        title={`¿Eliminar paquete ${packageToDelete?.trackingCode}?`}
        description="Esta acción eliminará el paquete y todo su historial de eventos de forma permanente."
        confirmLabel="Eliminar paquete"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDeletePackage}
      />

      <NewIntlPackageModal
        packageToEdit={packageToEdit}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSuccess={() => fetchPackages()}
        volumetricFactor={config?.volumetricFactorKgPerCbm || 167}
      />
    </div>
  );
}
