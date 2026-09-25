import React, { useState, useEffect, useCallback } from 'react';
import {
  Scale,
  DollarSign,
  Plus,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { toast } from '@/app/services/toast';
import { getApiErrorMessage } from '@/app/services/api';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
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
} from '../../services/intl-imports.service';
import { AddExpenseModal } from './modals/AddExpenseModal';
import { CloseContainerModal } from './modals/CloseContainerModal';

interface CustomsProrationTabProps {
  canApprove?: boolean;
}

export function CustomsProrationTab({ canApprove = true }: CustomsProrationTabProps) {
  const [containers, setContainers] = useState<IntlImportContainer[]>([]);
  const [selectedContainerId, setSelectedContainerId] = useState<string>('');
  const [containerDetail, setContainerDetail] = useState<IntlImportContainer | null>(null);
  const [prorationPreview, setProrationPreview] = useState<ProrationPreviewResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Modals
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [closeContainerOpen, setCloseContainerOpen] = useState(false);

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
    ])
      .then(([detail, preview]) => {
        if (isMounted) {
          setContainerDetail(detail);
          setProrationPreview(preview);
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
        percentage: item.percentage ?? (item.volumeRatioPercentage ? parseFloat(item.volumeRatioPercentage) : 0),
        proratedCost: Number(item.proratedCost) || 0,
      }));
    }
    if (containerDetail?.packages && containerDetail.packages.length > 0 && totalExpenses > 0 && totalVolume > 0) {
      return containerDetail.packages.map((pkg) => {
        const vol = Number(pkg.volumeCbm) || 0;
        const pct = totalVolume > 0 ? (vol / totalVolume) * 100 : 0;
        const cost = totalVolume > 0 ? totalExpenses * (vol / totalVolume) : 0;
        return {
          packageId: pkg.id,
          trackingCode: pkg.trackingCode,
          volumeCbm: vol,
          percentage: Number(pct.toFixed(2)),
          proratedCost: Number(cost.toFixed(2)),
        };
      });
    }
    return [];
  }, [prorationPreview, containerDetail, totalExpenses, totalVolume]);

  return (
    <div className="space-y-6">
      {/* Selector de Contenedor */}
      <Card className="p-4 border-border/70 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Scale className="size-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="text-xs font-semibold text-muted-foreground shrink-0">Seleccionar Contenedor:</div>
          <select
            className="text-xs rounded-md border border-border bg-background p-2 font-mono font-bold flex-1 sm:w-64"
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
        <div className="space-y-6">
          {/* Header Resumen del Contenedor */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="p-4 border-border/70">
              <span className="text-[11px] font-medium text-muted-foreground block">Contenedor</span>
              <span className="text-lg font-bold font-mono text-foreground">{containerDetail.containerNumber}</span>
              <div className="mt-1">
                <Badge variant={containerDetail.isClosed ? 'default' : 'secondary'} className="text-[10px]">
                  {containerDetail.isClosed ? 'Cerrado y Prorrateado' : 'Abierto / En Proceso'}
                </Badge>
              </div>
            </Card>

            <Card className="p-4 border-border/70">
              <span className="text-[11px] font-medium text-muted-foreground block">Volumen Consolidado</span>
              <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {totalVolume.toFixed(3)} CBM
              </span>
              <span className="text-[10px] text-muted-foreground block mt-1">
                {containerDetail.packagesCount || containerDetail.packages?.length || 0} paquetes contenidos
              </span>
            </Card>

            <Card className="p-4 border-border/70">
              <span className="text-[11px] font-medium text-muted-foreground block">Total Gastos Nacionalización</span>
              <span className="text-lg font-bold font-mono text-foreground">${totalExpenses.toFixed(2)} USD</span>
              <span className="text-[10px] text-muted-foreground block mt-1">Fletes, DAI, Manejo, Almacenaje</span>
            </Card>

            <Card className="p-4 border-border/70 bg-emerald-500/10 border-emerald-500/30">
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 block">
                Costo Prorrateado Líquido
              </span>
              <span className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-300">
                ${(totalVolume > 0 ? totalExpenses / totalVolume : 0).toFixed(2)} USD / CBM
              </span>
              <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 block mt-1">
                Costo asignado por cada metro cúbico
              </span>
            </Card>
          </div>

          {/* Tabla de Gastos de Nacionalización */}
          <Card className="p-4 border-border/70 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <DollarSign className="size-4 text-emerald-600 dark:text-emerald-400" />
                Gastos de Nacionalización y Logística
              </div>
              {!containerDetail.isClosed && (
                <Button size="sm" onClick={() => setAddExpenseOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
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
          <Card className="p-4 border-border/70 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Scale className="size-4 text-emerald-600 dark:text-emerald-400" />
                  Prorrateo Proporcional por CBM (Vista Previa)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Cálculo: (Volumen CBM / Total CBM) × Total Gastos USD
                </p>
              </div>

              {!containerDetail.isClosed && canApprove && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setCloseContainerOpen(true)}
                  disabled={totalExpenses <= 0 || totalVolume <= 0}
                >
                  <CheckCircle2 className="size-4 mr-1.5" />
                  Cerrar Contenedor y Aplicar Prorrateo
                </Button>
              )}
            </div>

            <Table responsiveCards viewport>
              <TableHeader>
                <TableRow>
                  <TableHead>Código CC</TableHead>
                  <TableHead className="text-right">Volumen (CBM)</TableHead>
                  <TableHead className="text-right">Participación (%)</TableHead>
                  <TableHead className="text-right">Costo Prorrateado (USD)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prorationItems.length > 0 ? (
                  prorationItems.map((item) => {
                    const pct = typeof item.percentage === 'number' ? item.percentage : parseFloat(item.percentage) || 0;
                    const cost = typeof item.proratedCost === 'number' ? item.proratedCost : parseFloat(item.proratedCost) || 0;
                    const vol = typeof item.volumeCbm === 'number' ? item.volumeCbm : parseFloat(item.volumeCbm) || 0;
                    return (
                      <TableRow key={item.packageId}>
                        <TableCell className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {item.trackingCode}
                        </TableCell>
                        <TableCell className="text-right font-mono">{vol.toFixed(3)} CBM</TableCell>
                        <TableCell className="text-right font-mono">{pct.toFixed(2)}%</TableCell>
                        <TableCell className="text-right font-mono font-bold text-foreground">
                          ${cost.toFixed(2)} USD
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-xs">
                      Sin datos de prorrateo calculados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
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
