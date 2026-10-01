import { useState, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  PieChart,
  ShieldAlert,
  ShieldCheck,
  Save,
  CheckCircle2,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Percent,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Slider } from '../ui/slider';
import { Progress } from '../ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import { toast } from '@/app/services/toast';
import { cn } from '../ui/utils';
import { money } from './shared';
import { projectsService } from '../../services/projects.service';
import { useQueryClient } from '@tanstack/react-query';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import {
  compute6DCostingAndPricing,
  type Cost6DRow,
} from '@/app/utils/pricingEngine';
import {
  calculateProjectEVM,
  generateSCurveSeries,
  calculateBacFrom6DCostMatrix,
  type EVMInput,
  type Cost6DLineItem,
} from '@/app/utils/evmCalculator';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ProyectoEVMControlPanelProps {
  project: any;
  pricingEngine: any;
  costsSummary?: any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

interface PartidaControl {
  id: string;
  nombre: string;
  categoria: string;
  presupuesto: number;
  comprometido: number;
  ejecutado: number;
  disponible: number;
  desviacion: number;
  consumoPct: number;
}

type BaselineLine = Cost6DRow & { id: string; name: string };
type CostBaseline = { id: string; version: number; lines: BaselineLine[] };

export function ProyectoEVMControlPanel({
  project,
  pricingEngine,
  costsSummary,
}: ProyectoEVMControlPanelProps) {
  const queryClient = useQueryClient();
  const projectId = project?.id || 'default';
  const currency = project?.currency || 'USD';
  const baselinesQuery = useTenantQuery<CostBaseline[]>(
    ['projects', projectId, 'costing-baselines'],
    (signal) => projectsService.getCostBaselines(projectId, signal),
    { enabled: Boolean(project?.id) },
  );
  const activeBaseline = baselinesQuery.data?.[0];

  // EVM utiliza únicamente la última línea base aprobada.
  const matrix: Cost6DRow[] = useMemo(() => {
    return (activeBaseline?.lines || []).map((line) => ({
      ...line, lineId: line.id, lineName: line.name,
      materiales: Number(line.materiales || 0), consumibles: Number(line.consumibles || 0),
      manoObra: Number(line.manoObra || 0), andamiosEquipos: Number(line.andamiosEquipos || 0),
      fletes: Number(line.fletes || 0), viaticos: Number(line.viaticos || 0),
    }));
  }, [activeBaseline]);

  // 2. Calcular costeo y precio 6D consolidado
  const costingResult = useMemo(() => {
    return compute6DCostingAndPricing(matrix, pricingEngine);
  }, [matrix, pricingEngine]);

  // 3. Determinar el BAC completo sumando todas las líneas de producto 6D (ACM, Vidrio, WPC, Rótulos, Retrabajos)
  const bacCalculado6D = useMemo(() => {
    const fromFn = calculateBacFrom6DCostMatrix(matrix as unknown as Cost6DLineItem[]);
    if (fromFn > 0) return fromFn;
    return costingResult?.pricing?.costoTotalCargado || costingResult?.totalsByNature?.totalCargado || 0;
  }, [matrix, costingResult]);

  const projectBac = Number(project?.summary?.plannedBudget ?? project?.plannedBudget ?? 0);
  const bac = bacCalculado6D > 0 ? bacCalculado6D : projectBac;

  // 4. Avance Físico interactivo con edición y guardado rápido
  const [lastPropProgress, setLastPropProgress] = useState(project?.progress);
  const [physicalProgress, setPhysicalProgress] = useState<number>(() => {
    return Math.min(100, Math.max(0, Number(project?.progress ?? 0)));
  });
  const [isSavingProgress, setIsSavingProgress] = useState<boolean>(false);
  const [reportingDate] = useState(() => Date.now());

  if (project?.progress !== lastPropProgress) {
    setLastPropProgress(project?.progress);
    setPhysicalProgress(Math.min(100, Math.max(0, Number(project?.progress ?? 0))));
  }

  const handleSaveProgress = async () => {
    if (!project?.id) return;
    setIsSavingProgress(true);
    try {
      await projectsService.update(project.id, { progress: physicalProgress });
      await queryClient.invalidateQueries({ queryKey: ['projects', 'detail', project.id] });
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success(`Avance físico actualizado al ${physicalProgress}% exitosamente.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el avance físico';
      toast.error(msg);
    } finally {
      setIsSavingProgress(false);
    }
  };

  // 5. Costos reales ejecutados y comprometidos
  const actualCost = Number(
    project?.summary?.executedCost ?? project?.executedCost ?? costsSummary?.totalCosts ?? 0
  );
  const committedCost = Number(
    project?.summary?.committedCost ?? project?.committedCost ?? costsSummary?.committed ?? 0
  );

  // Venta contractual sin IVA
  const contractRevenue = Number(
    costingResult?.pricing?.offeredPriceWithoutIva ?? project?.summary?.plannedIncome ?? project?.plannedIncome ?? 0
  );

  // Días y cronograma para PV
  const startDateStr = project?.startDate;
  const endDateStr = project?.endDate;

  const totalDays = useMemo(() => {
    if (!startDateStr || !endDateStr) return 60;
    const start = new Date(startDateStr).getTime();
    const end = new Date(endDateStr).getTime();
    if (isNaN(start) || isNaN(end) || end <= start) return 60;
    return Math.max(1, Math.round((end - start) / 86400000));
  }, [startDateStr, endDateStr]);

  const elapsedDays = startDateStr
    ? Math.min(totalDays, Math.max(0, Math.floor((reportingDate - new Date(startDateStr).getTime()) / 86400000)))
    : 0;
  const plannedValue = (Math.min(totalDays, Math.max(0, elapsedDays)) / totalDays) * bac;

  // 6. Cómputo EVM usando el calculador central
  const evm = useMemo(() => {
    const input: EVMInput = {
      bac,
      physicalProgressPct: physicalProgress,
      actualCost,
      committedCost,
      plannedValue,
      contractPriceWithoutIva: contractRevenue,
      elapsedDays,
      totalDays,
      floorMarginPct: 15,
    };
    return calculateProjectEVM(input);
  }, [bac, physicalProgress, actualCost, committedCost, plannedValue, contractRevenue, elapsedDays, totalDays]);

  // Serie de la curva S
  const sCurveSeries = useMemo(() => {
    if (evm.sCurveSeries && evm.sCurveSeries.length > 0) {
      return evm.sCurveSeries;
    }
    const totalWeeks = Math.max(1, Math.ceil(totalDays / 5));
    const currentWeek = Math.max(0, Math.min(totalWeeks, Math.ceil(elapsedDays / 5)));
    return generateSCurveSeries(totalWeeks, currentWeek, bac, actualCost, evm.ev);
  }, [evm.sCurveSeries, totalDays, elapsedDays, bac, actualCost, evm.ev]);

  // 7. Desglose y Control Presupuestal por Partida (Líneas 6D del proyecto)
  const partidasControl: PartidaControl[] = useMemo(() => {
    const rawLines = Array.isArray(costingResult.lines)
      ? costingResult.lines as Array<{ lineId: string; lineName?: string; costoTotalCargado?: number }>
      : [];
    if (rawLines.length === 0) {
      return [];
    }

    const totalLinesBudget = rawLines.reduce((acc, line) => acc + (line.costoTotalCargado || 0), 0) || 1;

    return rawLines.map((line) => {
      const key = String(line.lineId);
      const pPresupuesto = line?.costoTotalCargado || 0;
      const weight = pPresupuesto / totalLinesBudget;

      const pEjecutado = actualCost > 0 ? actualCost * weight : 0;
      const pComprometido = committedCost > 0 ? committedCost * weight : 0;
      const pDisponible = pPresupuesto - (pEjecutado + pComprometido);
      const pDesviacion = pPresupuesto - pEjecutado;
      const pConsumoPct = pPresupuesto > 0 ? ((pEjecutado + pComprometido) / pPresupuesto) * 100 : 0;

      const label = line.lineName || key;

      return {
        id: key,
        nombre: label,
        categoria: 'Línea de Producción 6D',
        presupuesto: pPresupuesto,
        comprometido: pComprometido,
        ejecutado: pEjecutado,
        disponible: pDisponible,
        desviacion: pDesviacion,
        consumoPct: Number(pConsumoPct.toFixed(1)),
      };
    });
  }, [costingResult, actualCost, committedCost]);

  // Contadores de alertas y partidas críticas
  const partidasSobregiradas = useMemo(() => {
    return partidasControl.filter((p) => p.consumoPct >= 100).length;
  }, [partidasControl]);

  const partidasRiesgo = useMemo(() => {
    return partidasControl.filter((p) => p.consumoPct >= 90 && p.consumoPct < 100).length;
  }, [partidasControl]);

  // 8. Flujo de Cobro y Exposición de Cartera
  const advanceRate = pricingEngine?.advancePaymentRate ?? 0.70;
  const contractualAdvanceAmount = contractRevenue * advanceRate;
  const estimatedInvoiced = contractRevenue * (physicalProgress / 100);
  const estimatedCollected = Math.max(contractualAdvanceAmount, contractRevenue * (physicalProgress / 100) * 0.9);
  const cashExposure = costingResult?.kpis?.exposicionCajaTotal || Math.max(0, actualCost - estimatedCollected);

  // Badge dinámico para CPI
  const renderCpiBadge = () => {
    if (evm.cpi >= 1.0) {
      return (
        <Badge variant="outline" className="border-emerald-300 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold px-2.5 py-0.5">
          <ArrowUpRight className="mr-1 size-3.5" />
          {evm.cpi.toFixed(2)} ({evm.costStatusBadge.label})
        </Badge>
      );
    }
    if (evm.cpi >= 0.9) {
      return (
        <Badge variant="outline" className="border-amber-300 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold px-2.5 py-0.5">
          <Clock className="mr-1 size-3.5" />
          {evm.cpi.toFixed(2)} ({evm.costStatusBadge.label})
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="border-rose-300 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-bold px-2.5 py-0.5">
        <ArrowDownRight className="mr-1 size-3.5" />
        {evm.cpi.toFixed(2)} ({evm.costStatusBadge.label})
      </Badge>
    );
  };

  const vacPct = evm.bac > 0 ? Number(((evm.vac / evm.bac) * 100).toFixed(1)) : 0;

  if (!activeBaseline) {
    return (
      <Card className="rounded-2xl border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-black"><Activity className="size-5 text-primary" />Control EVM pendiente</CardTitle>
          <CardDescription>Apruebe una línea base desde Costeo 6D antes de consultar indicadores EVM.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        {/* Cabecera / Slider de Avance Físico con guardado rápido */}
        <Card className="rounded-2xl border-border/60 bg-gradient-to-r from-card to-muted/20 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-black">
                  <Activity className="size-5 text-primary" />
                  Control de Valor Ganado (EVM) y Curva S
                </CardTitle>
                <CardDescription className="text-xs">
                  Seguimiento ejecutivo de costos, avance físico y proyecciones al cierre integrado al Costeo 6D
                </CardDescription>
              </div>

              {/* Slider interactivo y guardado */}
              <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/80 p-2 shadow-xs backdrop-blur-xs">
                <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                  Avance Físico:
                </span>
                <div className="w-32">
                  <Slider
                    value={[physicalProgress]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(vals) => setPhysicalProgress(vals[0] ?? 0)}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={physicalProgress}
                    onChange={(e) => setPhysicalProgress(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                    className="h-8 w-16 text-center font-mono text-xs font-bold"
                  />
                  <span className="text-xs font-bold text-muted-foreground">%</span>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleSaveProgress}
                  disabled={isSavingProgress}
                  className="h-8 gap-1.5 px-3 text-xs font-bold"
                >
                  <Save className="size-3.5" />
                  {isSavingProgress ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* ======================================================== */}
        {/* a) TABLERO EJECUTIVO (KPIs EVM)                          */}
        {/* ======================================================== */}
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {/* BAC (Budget at Completion) */}
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  BAC (Presupuesto)
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 text-muted-foreground/70 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Budget at Completion: Presupuesto total consolidado sumando las líneas ACM, Vidrio, WPC, Rótulos y Retrabajos del Costeo 6D.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="mt-1.5 text-xl font-black tracking-tight">{money(evm.bac, currency)}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Sumatoria 6D completa</p>
            </CardContent>
          </Card>

          {/* EV (Earned Value) */}
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  EV (Valor Ganado)
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 text-muted-foreground/70 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Earned Value: Valor físico ganado (EV = Avance Físico % × BAC).
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="mt-1.5 text-xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                {money(evm.ev, currency)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{physicalProgress}% del presupuesto base</p>
            </CardContent>
          </Card>

          {/* AC (Actual Cost) */}
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  AC (Costo Real)
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 text-muted-foreground/70 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Actual Cost: Costos reales devengados y ejecutados a la fecha en obra.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className={cn(
                'mt-1.5 text-xl font-black tracking-tight',
                evm.speedAlert ? 'text-rose-600 dark:text-rose-400' : 'text-foreground'
              )}>
                {money(evm.ac, currency)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Consumo: {evm.budgetConsumedPct}% (Comp: {money(evm.committedCost, currency)})
              </p>
            </CardContent>
          </Card>

          {/* CPI (Cost Performance Index) */}
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  CPI (Eficiencia Costo)
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 text-muted-foreground/70 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Cost Performance Index (EV / AC): Rendimiento del gasto.
                    ≥ 1.0 (Verde): Se genera igual o más valor de lo gastado.
                    0.9 - 1.0 (Amarillo): Desviación moderada.
                    &lt; 0.9 (Rojo): Sobrecosto severo.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="mt-2">{renderCpiBadge()}</div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                CV: {evm.cv >= 0 ? '+' : ''}{money(evm.cv, currency)}
              </p>
            </CardContent>
          </Card>

          {/* EAC & VAC */}
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  EAC (Cierre Proyectado)
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 text-muted-foreground/70 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Estimate at Completion: Costo total final proyectado al cierre de la obra.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="mt-1.5 text-xl font-black tracking-tight">{money(evm.eac, currency)}</p>
              <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold">
                <span className="text-muted-foreground">VAC:</span>
                <span className={cn(
                  evm.vac >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                )}>
                  {evm.vac >= 0 ? '+' : ''}{money(evm.vac, currency)} ({vacPct}%)
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Utilidad Presupuestada vs Proyectada */}
          <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Utilidad Proyectada
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="size-3.5 text-muted-foreground/70 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Utilidad estimada al cierre = Venta Contratada − EAC.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className={cn(
                'mt-1.5 text-xl font-black tracking-tight',
                evm.projectedProfitAtClose >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              )}>
                {money(evm.projectedProfitAtClose, currency)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Margen {evm.projectedMarginAtClosePct}% (Base {evm.budgetedMarginPct}%)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ======================================================== */}
        {/* c) SEMÁFOROS Y ALERTAS ACTIVAS                            */}
        {/* ======================================================== */}
        <div className="grid gap-3 sm:grid-cols-3">
          {/* Alerta: Ritmo de Gasto vs Avance */}
          <div className={cn(
            'flex items-start gap-3 rounded-2xl border p-4 transition-all shadow-xs',
            evm.speedAlert
              ? 'border-rose-300/80 bg-rose-50/70 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200'
              : 'border-emerald-300/80 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200'
          )}>
            {evm.speedAlert ? (
              <ShieldAlert className="size-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            ) : (
              <ShieldCheck className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wider">Ritmo de Desembolso</p>
              <p className="mt-1 text-xs leading-relaxed">
                {evm.speedAlert ? (
                  <>
                    <strong className="font-bold">Alerta:</strong> Se gasta más rápido de lo que se avanza ({evm.budgetConsumedPct}% de costo incurrido vs {evm.physicalProgressPct}% de avance físico).
                  </>
                ) : (
                  <>
                    Ritmo de ejecución saludable: El avance físico ({evm.physicalProgressPct}%) cubre el costo ejecutado ({evm.budgetConsumedPct}%).
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Alerta: Margen Corporativo */}
          <div className={cn(
            'flex items-start gap-3 rounded-2xl border p-4 transition-all shadow-xs',
            evm.marginStatus === 'BAJO_PISO'
              ? 'border-amber-300/80 bg-amber-50/70 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200'
              : 'border-border/60 bg-muted/20 text-foreground'
          )}>
            {evm.marginStatus === 'BAJO_PISO' ? (
              <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            ) : (
              <CheckCircle2 className="size-5 shrink-0 text-primary mt-0.5" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wider">Margen Corporativo</p>
              <p className="mt-1 text-xs leading-relaxed">
                {evm.marginStatus === 'BAJO_PISO' ? (
                  <>
                    <strong className="font-bold">Atención:</strong> Margen proyectado ({evm.projectedMarginAtClosePct}%) bajo el piso corporativo de 15.0%.
                  </>
                ) : (
                  <>
                    Margen proyectado al cierre de {evm.projectedMarginAtClosePct}%, dentro del umbral corporativo requerido.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Alerta: Partidas en Riesgo o Sobregiradas */}
          <div className={cn(
            'flex items-start gap-3 rounded-2xl border p-4 transition-all shadow-xs',
            partidasSobregiradas > 0
              ? 'border-rose-300/80 bg-rose-50/70 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-200'
              : partidasRiesgo > 0
                ? 'border-amber-300/80 bg-amber-50/70 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200'
                : 'border-border/60 bg-muted/20 text-foreground'
          )}>
            <PieChart className="size-5 shrink-0 text-muted-foreground mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wider">Control de Partidas 6D</p>
              <p className="mt-1 text-xs leading-relaxed">
                {partidasSobregiradas > 0 ? (
                  <>
                    <strong className="font-bold">{partidasSobregiradas} partida(s) sobregirada(s) (&gt;100%)</strong> y {partidasRiesgo} cerca del límite (&gt;90%).
                  </>
                ) : partidasRiesgo > 0 ? (
                  <>
                    {partidasRiesgo} partida(s) en zona de riesgo (&gt;90% del presupuesto consumido).
                  </>
                ) : (
                  'Todas las líneas de producto 6D se encuentran dentro de sus límites presupuestarios.'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* b) GRÁFICO DE CURVA S (PV vs EV vs AC)                   */}
        {/* ======================================================== */}
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" />
                  Curva S de Desempeño (PV vs EV vs AC)
                </CardTitle>
                <CardDescription className="text-xs">
                  Proyección acumulativa del Valor Planificado (PV), Valor Ganado (EV) y Costo Real (AC)
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-bold">
                  <span className="size-2.5 rounded-full bg-blue-500" /> Planificado (PV)
                </span>
                <span className="flex items-center gap-1.5 font-bold">
                  <span className="size-2.5 rounded-full bg-emerald-500" /> Valor Ganado (EV)
                </span>
                <span className="flex items-center gap-1.5 font-bold">
                  <span className="size-2.5 rounded-full bg-rose-500" /> Costo Real (AC)
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sCurveSeries} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                  <XAxis
                    dataKey="periodLabel"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ opacity: 0.3 }}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(val) => money(val, currency)}
                    tickLine={false}
                    axisLine={{ opacity: 0.3 }}
                    width={80}
                  />
                  <RechartsTooltip
                    formatter={(val: unknown, name: unknown) => {
                      if (val === null || val === undefined) return ['—', String(name)];
                      let label = String(name);
                      if (name === 'plannedPV') label = 'Planificado (PV)';
                      if (name === 'earnedEV') label = 'Ganado Real (EV)';
                      if (name === 'actualAC') label = 'Costo Real (AC)';
                      return [money(Number(val), currency), label];
                    }}
                    labelFormatter={(label) => `Período: ${label}`}
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
                    formatter={(value) => {
                      if (value === 'plannedPV') return 'Curva Planificada (PV)';
                      if (value === 'earnedEV') return 'Valor Ganado (EV)';
                      if (value === 'actualAC') return 'Costo Real Incurrido (AC)';
                      return value;
                    }}
                  />
                  {/* Línea Planificada (PV) */}
                  <Line
                    type="monotone"
                    dataKey="plannedPV"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    name="plannedPV"
                  />
                  {/* Línea Valor Ganado (EV) */}
                  <Line
                    type="monotone"
                    dataKey="earnedEV"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    connectNulls={false}
                    name="earnedEV"
                  />
                  {/* Línea Costo Real (AC) */}
                  <Line
                    type="monotone"
                    dataKey="actualAC"
                    stroke="#ef4444"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    connectNulls={false}
                    name="actualAC"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* ======================================================== */}
        {/* d) CONTROL PRESUPUESTAL POR PARTIDA                      */}
        {/* ======================================================== */}
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-black flex items-center gap-2">
                  <DollarSign className="size-4 text-primary" />
                  Control Presupuestal por Partida 6D
                </CardTitle>
                <CardDescription className="text-xs">
                  Seguimiento de presupuesto cargado vs comprometido vs ejecutado por línea de producto
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-bold">
                {partidasControl.length} Líneas Evaluadas
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 bg-muted/30">
                    <TableHead className="font-bold text-xs">Partida / Línea</TableHead>
                    <TableHead className="text-right font-bold text-xs">Presupuesto (BAC)</TableHead>
                    <TableHead className="text-right font-bold text-xs">Comprometido</TableHead>
                    <TableHead className="text-right font-bold text-xs">Ejecutado (AC)</TableHead>
                    <TableHead className="text-right font-bold text-xs">Disponible</TableHead>
                    <TableHead className="w-48 font-bold text-xs">% Consumo</TableHead>
                    <TableHead className="text-right font-bold text-xs">Desviación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partidasControl.map((p) => {
                    const isOver = p.consumoPct >= 100;
                    const isWarn = p.consumoPct >= 90 && p.consumoPct < 100;

                    return (
                      <TableRow key={p.id} className="border-border/40 hover:bg-muted/30">
                        <TableCell className="font-bold text-xs">
                          <div className="flex items-center gap-2">
                            <span>{p.nombre}</span>
                            {isOver && (
                              <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-700 text-[10px] py-0 px-1.5 dark:bg-rose-950/30">
                                Sobregiro
                              </Badge>
                            )}
                            {isWarn && (
                              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-[10px] py-0 px-1.5 dark:bg-amber-950/30">
                                Alerta 90%
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground">{p.categoria}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">
                          {money(p.presupuesto, currency)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {money(p.comprometido, currency)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">
                          {money(p.ejecutado, currency)}
                        </TableCell>
                        <TableCell className={cn(
                          'text-right font-mono text-xs font-bold',
                          p.disponible < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                        )}>
                          {money(p.disponible, currency)}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-bold">
                              <span>{p.consumoPct}%</span>
                              <span className="text-muted-foreground">
                                {money(p.ejecutado + p.comprometido, currency)}
                              </span>
                            </div>
                            <Progress
                              value={Math.min(100, p.consumoPct)}
                              className={cn(
                                'h-1.5',
                                isOver && '[&>div]:bg-rose-600',
                                isWarn && '[&>div]:bg-amber-500',
                                !isOver && !isWarn && '[&>div]:bg-emerald-500'
                              )}
                            />
                          </div>
                        </TableCell>
                        <TableCell className={cn(
                          'text-right font-mono text-xs font-bold',
                          p.desviacion < 0 ? 'text-rose-600' : 'text-emerald-600'
                        )}>
                          {p.desviacion >= 0 ? '+' : ''}{money(p.desviacion, currency)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* ======================================================== */}
        {/* e) FLUJO DE COBRO Y EXPOSICIÓN DE CARTERA                */}
        {/* ======================================================== */}
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <Percent className="size-4 text-primary" />
              Flujo de Cobro y Exposición de Cartera
            </CardTitle>
            <CardDescription className="text-xs">
              Esquema financiero de anticipo contractual, facturación y requerimiento de capital de trabajo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {/* Venta Contratada */}
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Venta Contratada
                </p>
                <p className="text-lg font-black tracking-tight">{money(contractRevenue, currency)}</p>
                <p className="text-[11px] text-muted-foreground">Precio sin IVA acordado</p>
              </div>

              {/* Anticipo 70% */}
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Anticipo ({Math.round(advanceRate * 100)}%)
                </p>
                <p className="text-lg font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                  {money(contractualAdvanceAmount, currency)}
                </p>
                <p className="text-[11px] text-muted-foreground">Requisito inicio de obra</p>
              </div>

              {/* Facturado a la fecha */}
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Facturado (Avance)
                </p>
                <p className="text-lg font-black tracking-tight">{money(estimatedInvoiced, currency)}</p>
                <p className="text-[11px] text-muted-foreground">Certificación proporcional</p>
              </div>

              {/* Cobrado a la fecha */}
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Cobrado a la Fecha
                </p>
                <p className="text-lg font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                  {money(estimatedCollected, currency)}
                </p>
                <p className="text-[11px] text-muted-foreground">Fondos liquidados en banco</p>
              </div>

              {/* Exposición de Caja */}
              <div className={cn(
                'rounded-xl border p-3.5 space-y-1',
                cashExposure > 0
                  ? 'border-amber-300 bg-amber-50/50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200'
                  : 'border-border/60 bg-muted/20'
              )}>
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  Exposición de Caja
                </p>
                <p className={cn(
                  'text-lg font-black tracking-tight',
                  cashExposure > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'
                )}>
                  {money(cashExposure, currency)}
                </p>
                <p className="text-[11px] text-muted-foreground">Riesgo de cartera activo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
