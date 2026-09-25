import { useState, useEffect, useCallback } from 'react';
import {
  Ship,
  PackageCheck,
  Plus,
  RefreshCw,
  Calendar,
  Trash2,
} from 'lucide-react';
import { toast } from '@/app/services/toast';
import { getApiErrorMessage } from '@/app/services/api';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  intlImportsService,
  INTL_CONTAINER_STATUS_LABELS,
  type IntlImportContainer,
  type IntlImportContainerStatus,
  type IntlImportConfig,
} from '../../services/intl-imports.service';
import { NewContainerModal } from './modals/NewContainerModal';
import { AssignPackagesModal } from './modals/AssignPackagesModal';
import { IntlContainerDetailSheet } from './modals/IntlContainerDetailSheet';

interface ContainersTabProps {
  canCreate?: boolean;
}

const containerBadgeVariant = (status: IntlImportContainerStatus) => {
  switch (status) {
    case 'OPEN':
      return 'secondary';
    case 'CONSOLIDATED':
      return 'outline';
    case 'IN_TRANSIT':
      return 'default';
    case 'CUSTOMS_CLEARANCE':
      return 'secondary';
    case 'COMPLETED':
      return 'default';
    case 'CANCELLED':
      return 'destructive';
    default:
      return 'secondary';
  }
};

export function ContainersTab({ canCreate = true }: ContainersTabProps) {
  const [containers, setContainers] = useState<IntlImportContainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [config, setConfig] = useState<IntlImportConfig | null>(null);

  // Modals & Actions
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [assignContainer, setAssignContainer] = useState<IntlImportContainer | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [containerToDelete, setContainerToDelete] = useState<IntlImportContainer | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Detail sheet
  const [detailContainer, setDetailContainer] = useState<IntlImportContainer | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  useEffect(() => {
    intlImportsService.getConfig().then(setConfig).catch(() => undefined);
  }, []);

  const fetchContainers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await intlImportsService.listContainers({
        status: (statusFilter as IntlImportContainerStatus) || undefined,
      });
      setContainers(data || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al cargar contenedores'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    let isMounted = true;
    intlImportsService
      .listContainers({
        status: (statusFilter as IntlImportContainerStatus) || undefined,
      })
      .then((data) => {
        if (isMounted) {
          setContainers(data || []);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (isMounted) {
          toast.error(getApiErrorMessage(error, 'Error al cargar contenedores'));
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [statusFilter]);

  const handleDeleteContainer = async () => {
    if (!containerToDelete) return;
    try {
      setDeleting(true);
      await intlImportsService.deleteContainer(containerToDelete.id);
      toast.success(`Contenedor ${containerToDelete.containerNumber} eliminado exitosamente`);
      setContainerToDelete(null);
      await fetchContainers();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al eliminar el contenedor'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra de Acciones y Filtros */}
      <Card className="p-4 border-border/70 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <Ship className="size-5 text-sky-600 dark:text-sky-400" />
            Contenedores Marítimos
          </div>

          <select
            className="text-xs rounded-md border border-border bg-background p-2"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos los Estados</option>
            {Object.entries(INTL_CONTAINER_STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button variant="outline" size="sm" onClick={fetchContainers} disabled={loading}>
            <RefreshCw className={`size-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>

          {canCreate && (
            <Button size="sm" onClick={() => setNewModalOpen(true)} className="bg-sky-600 hover:bg-sky-700 text-white">
              <Plus className="size-4 mr-1.5" />
              Nuevo Contenedor
            </Button>
          )}
        </div>
      </Card>

      {/* Grid de Contenedores */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-xs">Cargando lotes de contenedores...</div>
      ) : containers.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-xs border-dashed">
          No hay contenedores registrados. Haz clic en "Nuevo Contenedor" para iniciar la consolidación.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {containers.map((c) => {
            const usedCbm = c.totalVolumeCbm ?? (c.packages || []).reduce((sum, p) => sum + (Number(p.volumeCbm) || 0), 0);
            const maxCbm = c.capacityCbm || c.maxCapacityCbm || 20;
            const cbmPercent = maxCbm > 0 ? Math.min(100, Math.round((usedCbm / maxCbm) * 100)) : 0;

            const usedWeight = c.totalActualWeightKg ?? (c.packages || []).reduce((sum, p) => sum + (Number(p.actualWeightKg) || 0), 0);
            const maxWeight = c.maxWeightKg || 5000;
            const totalExpenses = c.totalExpensesUsd ?? (c.expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

            const isFull = cbmPercent >= 85;

            return (
              <Card key={c.id} className="p-5 border-border/80 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow">
                <div>
                  {/* Card Header */}
                  <div
                    className="flex items-start justify-between gap-2 mb-2 cursor-pointer group/header"
                    onClick={() => {
                      setDetailContainer(c);
                      setDetailSheetOpen(true);
                    }}
                    title="Ver detalle del contenedor"
                  >
                    <div>
                      <h3 className="font-mono font-bold text-base text-foreground flex items-center gap-2 group-hover/header:text-primary transition-colors">
                        {c.containerNumber}
                      </h3>
                      {c.sealNumber && (
                        <span className="text-[11px] text-muted-foreground block font-mono">Sello: {c.sealNumber}</span>
                      )}
                    </div>
                    <Badge variant={containerBadgeVariant(c.status)}>
                      {INTL_CONTAINER_STATUS_LABELS[c.status] || c.status}
                    </Badge>
                  </div>

                  {/* Capacidad CBM Progress Bar */}
                  <div className="space-y-1 my-3 bg-muted/30 p-2.5 rounded-lg border border-border/40">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-muted-foreground">Ocupación Volumétrica:</span>
                      <span className={`font-mono ${isFull ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-foreground'}`}>
                        {usedCbm.toFixed(2)} / {maxCbm} CBM ({cbmPercent}%)
                      </span>
                    </div>
                    <div className="w-full bg-border/60 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isFull ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${cbmPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Detalles y Métricas */}
                  <div className="grid grid-cols-2 gap-2 text-xs py-1">
                    <div className="bg-background p-2 rounded border border-border/50">
                      <span className="text-muted-foreground text-[11px] block">Paquetes:</span>
                      <span className="font-bold text-foreground font-mono">{c.packagesCount || c.packages?.length || 0} unid.</span>
                    </div>

                    <div className="bg-background p-2 rounded border border-border/50">
                      <span className="text-muted-foreground text-[11px] block">Peso Real:</span>
                      <span className="font-bold text-foreground font-mono">{usedWeight} / {maxWeight} kg</span>
                    </div>

                    <div className="bg-background p-2 rounded border border-border/50 col-span-2 flex justify-between items-center">
                      <span className="text-muted-foreground text-[11px]">Gastos Acumulados:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        ${totalExpenses.toFixed(2)} USD
                      </span>
                    </div>
                  </div>

                  {/* Fechas Marítimas */}
                  {(c.estimatedDeparture || c.estimatedArrival) && (
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                      <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                      <div>
                        {c.estimatedDeparture && <span>ETD: {new Date(c.estimatedDeparture).toLocaleDateString('es-NI')}</span>}
                        {c.estimatedDeparture && c.estimatedArrival && <span className="mx-1.5">•</span>}
                        {c.estimatedArrival && <span>ETA: {new Date(c.estimatedArrival).toLocaleDateString('es-NI')}</span>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                  {!c.isClosed ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive px-2"
                      title="Eliminar contenedor"
                      onClick={() => setContainerToDelete(c)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : <div />}

                  <div className="flex items-center gap-1.5 flex-1 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDetailContainer(c);
                        setDetailSheetOpen(true);
                      }}
                    >
                      Ver Detalle
                    </Button>

                    {c.status === 'OPEN' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAssignContainer(c);
                          setAssignModalOpen(true);
                        }}
                      >
                        <PackageCheck className="size-4 mr-1.5 text-emerald-600 dark:text-emerald-400" />
                        Asignar Paquetes
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modales */}
      <NewContainerModal
        open={newModalOpen}
        onOpenChange={setNewModalOpen}
        onSuccess={() => fetchContainers()}
        defaultCbm={config?.defaultContainerCbm}
        defaultMaxKg={config?.defaultContainerMaxKg}
      />

      <AssignPackagesModal
        container={assignContainer}
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        onSuccess={() => fetchContainers()}
      />

      <ConfirmDialog
        open={Boolean(containerToDelete)}
        onOpenChange={(open) => !open && setContainerToDelete(null)}
        title={`¿Eliminar contenedor ${containerToDelete?.containerNumber}?`}
        description="Esta acción eliminará el contenedor y desasignará sus paquetes, devolviéndolos al estado en Bodega Origen. Los gastos asociados también serán removidos."
        confirmLabel="Eliminar contenedor"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDeleteContainer}
      />

      <IntlContainerDetailSheet
        container={detailContainer}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onRefresh={fetchContainers}
      />
    </div>
  );
}
