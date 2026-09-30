import React, { useState, useEffect, useCallback } from 'react';
import {
  Scale,
  DollarSign,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { toast } from '@/app/services/toast';
import { getApiErrorMessage } from '@/app/services/api';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
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
  INTL_CONTAINER_STATUS_LABELS,
  type IntlImportContainer,
  type ProrationPreviewResult,
  type ContainerBalance,
  type ContainerClosure,
} from '../../services/intl-imports.service';
import { AddExpenseModal } from './modals/AddExpenseModal';
import { CloseContainerModal } from './modals/CloseContainerModal';

interface CustomsProrationTabProps {
  canApprove?: boolean;
  /** Permiso dedicado: no se hereda de `approve` ni de `edit`. */
  canCloseByException?: boolean;
  canReopen?: boolean;
}

export function CustomsProrationTab({
  canApprove = true,
  canCloseByException = false,
  canReopen = false,
}: CustomsProrationTabProps) {
  const [containers, setContainers] = useState<IntlImportContainer[]>([]);
  const [selectedContainerId, setSelectedContainerId] = useState<string>('');
  const [containerDetail, setContainerDetail] = useState<IntlImportContainer | null>(null);
  const [prorationPreview, setProrationPreview] = useState<ProrationPreviewResult | null>(null);
  // El balance lo calcula el backend con la regla de cierre vigente; la UI no
  // decide si el contenedor puede cerrarse.
  const [balance, setBalance] = useState<ContainerBalance | null>(null);
  const [closures, setClosures] = useState<ContainerClosure[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [closeContainerOpen, setCloseContainerOpen] = useState(false);
  const [exceptionReason, setExceptionReason] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  // Cargar lista de contenedores para seleccionar
  const loadContainers = useCallback(async () => {
    try {
      const data = await intlImportsService.listContainers();
      setContainers(data || []);
      if (data && data.length > 0) {
        setSelectedContainerId((prev) => prev || data[0].id);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al cargar lista de contenedores'));
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    intlImportsService
      .listContainers()
      .then((data) => {
        if (isMounted) {
          setContainers(data || []);
          if (data && data.length > 0) {
            setSelectedContainerId((prev) => prev || data[0].id);
          }
        }
      })
      .catch((error) => {
        if (isMounted) {
          toast.error(getApiErrorMessage(error, 'Error al cargar lista de contenedores'));
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Cargar detalle del contenedor seleccionado
  const loadContainerDetail = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const [detail, preview] = await Promise.all([
        intlImportsService.getContainer(id),
        intlImportsService.getProrationPreview(id).catch(() => null),
      ]);
      setContainerDetail(detail);
      setProrationPreview(preview);
      const [bal, hist] = await Promise.all([
        intlImportsService.getContainerBalance(id).catch(() => null),
        intlImportsService.getContainerClosures(id).catch(() => []),
      ]);
      setBalance(bal);
      setClosures(hist);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Error al cargar detalle del contenedor'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedContainerId) return;
    let isMounted = true;
    Promise.all([
      intlImportsService.getContainer(selectedContainerId),
      intlImportsService.getProrationPreview(selectedContainerId).catch(() => null),
      intlImportsService.getContainerBalance(selectedContainerId).catch(() => null),
      intlImportsService.getContainerClosures(selectedContainerId).catch(() => []),
    ])
      .then(([detail, preview, bal, hist]) => {
        if (isMounted) {
          setContainerDetail(detail);
          setProrationPreview(preview);
          setBalance(bal);
          setClosures(hist);
          setActionError('');
          setLoading(false);
        }
      })
      .catch((error) => {
        if (isMounted) {
          toast.error(getApiErrorMessage(error, 'Error al cargar detalle del contenedor'));
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [selectedContainerId]);

  const handleCloseByException = useCallback(async () => {
    if (!selectedContainerId) return;
    if (exceptionReason.trim().length < 10) {
      setActionError('El motivo debe tener al menos 10 caracteres: queda registrado en la auditoría.');
      return;
    }
    setBusy(true);
    try {
      await intlImportsService.closeContainerByException(selectedContainerId, exceptionReason.trim());
      toast.success('Contenedor cerrado por excepción');
      setExceptionReason('');
      await loadContainerDetail(selectedContainerId);
      await loadContainers();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cerrar por excepción'));
    } finally {
      setBusy(false);
    }
  }, [selectedContainerId, exceptionReason, loadContainerDetail, loadContainers]);

  const handleReopen = useCallback(async () => {
    if (!selectedContainerId) return;
    if (reopenReason.trim().length < 10) {
      setActionError('El motivo debe tener al menos 10 caracteres: queda registrado en la auditoría.');
      return;
    }
    setBusy(true);
    try {
      await intlImportsService.reopenContainer(selectedContainerId, reopenReason.trim());
      toast.success('Contenedor reabierto');
      setReopenReason('');
      await loadContainerDetail(selectedContainerId);
      await loadContainers();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo reabrir el contenedor'));
    } finally {
      setBusy(false);
    }
  }, [selectedContainerId, reopenReason, loadContainerDetail, loadContainers]);

  const totalExpenses = React.useMemo(() => {
    if (prorationPreview?.totalExpensesUsd !== undefined && prorationPreview.totalExpensesUsd > 0) {
      return prorationPreview.totalExpensesUsd;
    }
    if (prorationPreview?.totalExpenses !== undefined && prorationPreview.totalExpenses > 0) {
      return prorationPreview.totalExpenses;
    }
    if (containerDetail?.totalExpensesUsd !== undefined && containerDetail.totalExpensesUsd > 0) {
      return containerDetail.totalExpensesUsd;
    }
    return (containerDetail?.expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [prorationPreview, containerDetail]);

  const totalVolume = React.useMemo(() => {
    if (prorationPreview?.totalVolumeCbm !== undefined && prorationPreview.totalVolumeCbm > 0) {
      return prorationPreview.totalVolumeCbm;
    }
    if (containerDetail?.totalVolumeCbm !== undefined && containerDetail.totalVolumeCbm > 0) {
      return containerDetail.totalVolumeCbm;
    }
    return (containerDetail?.packages || []).reduce((sum, p) => sum + (Number(p.volumeCbm) || 0), 0);
  }, [prorationPreview, containerDetail]);

  /** CBM facturable del contenedor: la base real del prorrateo. */
  const totalBillable = React.useMemo(() => {
    if (prorationPreview?.totalBillableCbm !== undefined && prorationPreview.totalBillableCbm > 0) {
      return prorationPreview.totalBillableCbm;
    }
    if (containerDetail?.totalBillableCbm !== undefined && containerDetail.totalBillableCbm > 0) {
      return containerDetail.totalBillableCbm;
    }
    // Fallback: billableCbm lo publico el backend por paquete; no se recalcula
    // la formula aqui, solo se suman los valores de servidor.
    return (containerDetail?.packages || []).reduce(
      (sum, p) => sum + (Number(p.billableCbm ?? p.volumeCbm) || 0),
      0,
    );
  }, [prorationPreview, containerDetail]);

  const prorationItems = React.useMemo(() => {
    if (prorationPreview?.packages && prorationPreview.packages.length > 0) {
      return prorationPreview.packages;
    }
    const rawPackages = prorationPreview?.proratedPackages;
    if (Array.isArray(rawPackages) && rawPackages.length > 0) {
      return rawPackages.map((item) => ({
        packageId: item.packageId,
        trackingCode: item.trackingCode || '',
        volumeCbm: Number(item.volumeCbm) || 0,
        billableCbm: Number(item.billableCbm) || Number(item.volumeCbm) || 0,
        percentage: item.percentage ?? (item.volumeRatioPercentage ? parseFloat(item.volumeRatioPercentage) : 0),
        proratedCost: Number(item.proratedCost) || 0,
      }));
    }
    // Ruta degradada: si el preview no llego, se reparte por CBM FACTURABLE para
    // no contradecir al backend. El monto sigue siendo estimacion hasta que el
    // servidor responda el preview.
    if (containerDetail?.packages && containerDetail.packages.length > 0 && totalExpenses > 0 && totalBillable > 0) {
      return containerDetail.packages.map((pkg) => {
        const vol = Number(pkg.volumeCbm) || 0;
        const billable = Number(pkg.billableCbm ?? pkg.volumeCbm) || 0;
        const pct = (billable / totalBillable) * 100;
        const cost = totalExpenses * (billable / totalBillable);
        return {
          packageId: pkg.id,
          trackingCode: pkg.trackingCode,
          volumeCbm: vol,
          billableCbm: billable,
          percentage: Number(pct.toFixed(2)),
          proratedCost: Number(cost.toFixed(2)),
        };
      });
    }
    return [];
  }, [prorationPreview, containerDetail, totalExpenses, totalBillable]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Selector de Contenedor */}
      <Card className="p-3.5 sm:p-4 border-border/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <Scale className="size-5 text-primary shrink-0" />
            <div className="text-xs font-semibold text-muted-foreground shrink-0">Seleccionar Contenedor:</div>
          </div>
          <select
            className="text-xs rounded-md border border-border bg-background px-2.5 py-2 h-9 font-mono font-bold w-full sm:w-64"
            value={selectedContainerId}
            onChange={(e) => setSelectedContainerId(e.target.value)}
          >
            {containers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.containerNumber} ({INTL_CONTAINER_STATUS_LABELS[c.status] || c.status})
              </option>
            ))}
          </select>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => loadContainerDetail(selectedContainerId)}
          disabled={loading || !selectedContainerId}
          className="w-full sm:w-auto"
        >
          <RefreshCw className={`size-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Recargar Datos
        </Button>
      </Card>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-xs">Cargando desglose de prorrateo...</div>
      ) : !containerDetail ? (
        <Card className="p-8 text-center text-muted-foreground text-xs">
          Selecciona un contenedor para gestionar sus gastos de nacionalización y prorrateo.
        </Card>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {/* Header Resumen del Contenedor */}
          <div className="intl-imports-kpis grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
            <Card className="p-3 sm:p-3.5 border-border/70 min-w-0">
              <span className="text-[11px] sm:text-xs font-medium text-muted-foreground block truncate">Contenedor</span>
              <span className="text-base sm:text-lg font-bold font-mono text-foreground truncate block">{containerDetail.containerNumber}</span>
              <div className="mt-0.5">
                <Badge variant={containerDetail.isClosed ? 'default' : 'secondary'} className="text-[10px]">
                  {containerDetail.isClosed ? 'Cerrado y Prorrateado' : 'Abierto / En Proceso'}
                </Badge>
              </div>
            </Card>

            <Card className="p-3 sm:p-3.5 border-border/70 min-w-0">
              <span className="text-[11px] sm:text-xs font-medium text-muted-foreground block truncate">CBM Facturable</span>
              <span className="text-base sm:text-lg font-bold font-mono text-primary truncate block">
                {totalBillable.toFixed(3)} CBM
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
                Físico: {totalVolume.toFixed(3)} · {containerDetail.packagesCount || containerDetail.packages?.length || 0}{' '}
                paquetes
              </span>
            </Card>

            <Card className="p-3 sm:p-3.5 border-border/70 min-w-0">
              <span className="text-[11px] sm:text-xs font-medium text-muted-foreground block truncate">Total Gastos Nacionalización</span>
              <span className="text-base sm:text-lg font-bold font-mono text-foreground truncate block">${totalExpenses.toFixed(2)} USD</span>
              <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">Fletes, DAI, Manejo, Almacenaje</span>
            </Card>

            <Card className="p-3 sm:p-3.5 border-border/70 bg-primary/5 border-primary/20 min-w-0">
              <span className="text-[11px] sm:text-xs font-semibold text-primary block truncate">
                Costo Prorrateado Líquido
              </span>
              <span className="text-base sm:text-lg font-bold font-mono text-primary truncate block">
                ${(totalBillable > 0 ? totalExpenses / totalBillable : 0).toFixed(2)} / CBM
              </span>
              <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
                USD por cada CBM facturable
              </span>
            </Card>
          </div>

          {/* Tabla de Gastos de Nacionalización */}
          <Card className="p-3.5 sm:p-4 border-border/70 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <DollarSign className="size-4 text-primary shrink-0" />
                <span>Gastos de Nacionalización y Logística</span>
              </div>
              {!containerDetail.isClosed && (
                <Button size="sm" onClick={() => setAddExpenseOpen(true)} className="w-full sm:w-auto">
                  <Plus className="size-4 mr-1.5" />
                  Registrar Gasto
                </Button>
              )}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rubro / Tipo de Gasto</TableHead>
                  <TableHead>Descripción / Referencia</TableHead>
                  <TableHead className="text-right">Monto USD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!containerDetail.expenses || containerDetail.expenses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-muted-foreground text-xs">
                      No se han registrado gastos de nacionalización para este contenedor.
                    </TableCell>
                  </TableRow>
                ) : (
                  containerDetail.expenses.map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell className="font-semibold text-foreground">{exp.expenseType}</TableCell>
                      <TableCell className="text-muted-foreground">{exp.description || 'Sin observaciones'}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-foreground">
                        ${(exp.amount || 0).toFixed(2)} USD
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Vista Previa del Prorrateo por Paquete */}
          <Card className="p-3.5 sm:p-4 border-border/70 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Scale className="size-4 text-primary shrink-0" />
                  <span>Prorrateo Proporcional por CBM (Vista Previa)</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Cálculo: (CBM facturable / Total CBM facturable) × Total Gastos USD
                </p>
              </div>

              {!containerDetail.isClosed && canApprove && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setCloseContainerOpen(true)}
                  className="w-full sm:w-auto"
                  // El bloqueo de minimos lo decide el backend: `canClose` y
                  // las violaciones llegan ya resueltas desde el servidor.
                  disabled={busy || totalExpenses <= 0 || (balance ? !balance.canClose : totalVolume <= 0)}
                  title={balance && !balance.canClose ? 'No cumple las condiciones de cierre' : undefined}
                >
                  <CheckCircle2 className="size-4 mr-1.5 shrink-0" />
                  Cerrar Contenedor y Aplicar Prorrateo
                </Button>
              )}
            </div>

            <Table responsiveCards viewport>
              <TableHeader>
                <TableRow>
                  <TableHead>Código CC</TableHead>
                  <TableHead className="text-right">CBM facturable</TableHead>
                  <TableHead className="text-right">Físico</TableHead>
                  <TableHead className="text-right">Participación (%)</TableHead>
                  <TableHead className="text-right">Costo Prorrateado (USD)</TableHead>
                </TableRow>
              </TableHeader>              <TableBody>
                {prorationItems.length > 0 ? (
                  prorationItems.map((item) => {
                    const pct = typeof item.percentage === 'number' ? item.percentage : parseFloat(item.percentage) || 0;
                    const cost = typeof item.proratedCost === 'number' ? item.proratedCost : parseFloat(item.proratedCost) || 0;
                    const vol = typeof item.volumeCbm === 'number' ? item.volumeCbm : parseFloat(item.volumeCbm) || 0;
                    // La participacion se reparte por CBM FACTURABLE. Mostrar solo el
                    // volumen fisico desorientaba: un paquete denso con 0.004 CBM
                    // fisicos igual se lleva el 0.41% porque su facturable es 0.08.
                    const billable =
                      typeof item.billableCbm === 'number' ? item.billableCbm : parseFloat(item.billableCbm) || vol;
                    return (
                      <TableRow key={item.packageId}>
                        <TableCell className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {item.trackingCode}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-foreground">
                          {billable.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{vol.toFixed(3)}</TableCell>
                        <TableCell className="text-right font-mono">{pct.toFixed(2)}%</TableCell>
                        <TableCell className="text-right font-mono font-bold text-foreground">
                          ${cost.toFixed(2)} USD
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-xs">
                      Sin datos de prorrateo calculados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      {/* Balance de cierre calculado por el backend */}
      {balance && (
        <Card className="p-4 border-border/70 space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="text-sm font-bold text-foreground">Balance de Cierre</h3>
              <p className="text-xs text-muted-foreground">
                Valores calculados por el servidor con la regla de cierre vigente
                {balance.limits.closureRule ? ` (${balance.limits.closureRule})` : ''}.
              </p>
            </div>
            <Badge variant={balance.canClose ? 'default' : 'destructive'}>
              {balance.canClose ? 'Cumple condiciones' : 'No cumple condiciones'}
            </Badge>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="rounded-lg border border-border/60 bg-background px-3 py-2">
              <div className="text-muted-foreground">CBM facturable</div>
              <div className="font-mono font-bold text-foreground">{balance.totals.billableCbm}</div>
              <div className="text-muted-foreground">Físico: {balance.totals.physicalCbm}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background px-3 py-2">
              <div className="text-muted-foreground">Capacidad</div>
              <div className="font-mono font-bold text-foreground">
                {balance.limits.capacityCbm != null
                  ? `${balance.totals.billableCbm} / ${balance.limits.capacityCbm}`
                  : '—'}
              </div>
              <div className="text-muted-foreground">
                {balance.usage.capacityPct != null ? `${balance.usage.capacityPct}% usado` : 'Sin límite'}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background px-3 py-2">
              <div className="text-muted-foreground">Peso real</div>
              <div className="font-mono font-bold text-foreground">
                {balance.totals.actualWeightKg}
                {balance.limits.maxWeightKg != null ? ` / ${balance.limits.maxWeightKg}` : ''} kg
              </div>
              <div className="text-muted-foreground">
                {balance.limits.minCloseWeightKg != null
                  ? `Mínimo ${balance.limits.minCloseWeightKg} kg`
                  : 'Sin mínimo'}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background px-3 py-2">
              <div className="text-muted-foreground">Mínimo de cierre</div>
              <div className="font-mono font-bold text-foreground">
                {balance.limits.minCloseCbm != null ? `${balance.limits.minCloseCbm} CBM` : 'No definido'}
              </div>
              <div className="text-muted-foreground">{balance.packagesCount} paquetes</div>
            </div>
          </div>

          {balance.violations.length > 0 && (
            <ul className="space-y-1 text-xs text-destructive">
              {balance.violations.map((v) => (
                <li key={v} className="flex items-start gap-1.5">
                  <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          )}
          {balance.warnings.length > 0 && (
            <ul className="space-y-1 text-xs text-amber-600 dark:text-amber-400">
              {balance.warnings.map((v) => (
                <li key={v} className="flex items-start gap-1.5">
                  <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Cierre por excepción: permiso dedicado, no heredado de Aprobar */}
          {!containerDetail?.isClosed && !balance.canClose && canCloseByException && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-2">
              <div className="text-xs font-semibold text-foreground">Cerrar por excepción</div>
              <p className="text-[11px] text-muted-foreground">
                Cierra el contenedor aunque no cumpla los mínimos. El motivo queda en el
                historial de cierres y en la auditoría.
              </p>
              <Input
                value={exceptionReason}
                onChange={(e) => setExceptionReason(e.target.value)}
                placeholder="Motivo de la excepción (mínimo 10 caracteres)"
              />
              {actionError && <div className="text-[11px] text-destructive">{actionError}</div>}
              <Button size="sm" variant="outline" onClick={handleCloseByException} disabled={busy}>
                Cerrar por excepción
              </Button>
            </div>
          )}

          {/* Reapertura: conserva el prorrateo histórico y queda auditada */}
          {containerDetail?.isClosed && canReopen && (
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <RotateCcw className="size-3.5" />
                Reabrir contenedor
              </div>
              <p className="text-[11px] text-muted-foreground">
                Permite corregir la consolidación. La reapertura queda registrada y el
                prorrateo aplicado no se descarta.
              </p>
              <Input
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="Motivo de la reapertura (mínimo 10 caracteres)"
              />
              {actionError && <div className="text-[11px] text-destructive">{actionError}</div>}
              <Button size="sm" variant="outline" onClick={handleReopen} disabled={busy}>
                Reabrir
              </Button>
            </div>
          )}

          {closures.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-border/50">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Historial de cierres
              </div>
              {closures.map((c) => (
                <div key={c.id} className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-2">
                  <Badge variant={c.type === 'REOPEN' ? 'secondary' : c.type === 'EXCEPTION' ? 'destructive' : 'outline'}>
                    {c.type === 'REOPEN' ? 'Reapertura' : c.type === 'EXCEPTION' ? 'Excepción' : 'Estándar'}
                  </Badge>
                  <span className="font-mono">{c.snapshotCbm} CBM / {c.snapshotWeightKg} kg</span>
                  <span>{c.reason}</span>
                  <span className="opacity-70">{new Date(c.occurredAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Modales */}
      <AddExpenseModal
        containerId={selectedContainerId}
        containerNumber={containerDetail?.containerNumber}
        open={addExpenseOpen}
        onOpenChange={setAddExpenseOpen}
        onSuccess={() => {
          loadContainers();
          loadContainerDetail(selectedContainerId);
        }}
      />

      <CloseContainerModal
        container={containerDetail}
        totalExpenses={totalExpenses}
        totalVolume={totalVolume}
        open={closeContainerOpen}
        onOpenChange={setCloseContainerOpen}
        onSuccess={() => {
          loadContainers();
          loadContainerDetail(selectedContainerId);
        }}
      />
    </div>
  );
}
