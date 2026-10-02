import { useMemo, useState } from 'react';
import {
  Activity,
  CalendarRange,
  Coins,
  Gauge,
  Info,
  Save,
  TrendingUp,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { toast } from '@/app/services/toast';
import { money } from './shared';
import { projectsService, type BudgetByLine, type EvmResponse, type PlannedCurvePoint, type SeriesPoint } from '../../services/projects.service';
import { invalidateTenantQueries, useTenantQuery } from '../../hooks/useTenantQuery';
import { compute6DCostingAndPricing, type Cost6DRow } from '@/app/utils/pricingEngine';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ProyectoEVMControlPanelProps {
  project: any;
  pricingEngine: any;
  costsSummary?: any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

type BaselineLine = Cost6DRow & { id: string; name: string };
type CostBaseline = { id: string; version: number; lines: BaselineLine[] };
type EvmTab = 'curva' | 'indicadores' | 'plan' | 'partidas';

function formatPct(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '—' : value.toFixed(2) + '%';
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardContent className="p-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1.5 text-xl font-black tracking-tight">{value}</p>
        {detail && <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}

function CurveChart({ rows, currency, plannedOnly = false }: { rows: SeriesPoint[]; currency: string; plannedOnly?: boolean }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
          <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ opacity: 0.3 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => money(Number(value), currency)} tickLine={false} axisLine={{ opacity: 0.3 }} width={80} />
          <RechartsTooltip
            formatter={(value: unknown, name: unknown) => {
              if (value == null) return ['—', String(name)];
              const labels: Record<string, string> = {
                plannedValue: 'Planificado (PV)',
                earnedValue: 'Ganado (EV)',
                actualValue: 'Costo real (AC)',
              };
              return [money(Number(value), currency), labels[String(name)] || String(name)];
            }}
            labelFormatter={(label) => 'Período: ' + String(label)}
            contentStyle={{
              backgroundColor: 'var(--popover)',
              color: 'var(--popover-foreground)',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              fontSize: '12px',
            }}
          />
          <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
          <Line type="monotone" dataKey="plannedValue" name="Planificado (PV)" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3 }} />
          {!plannedOnly && (
            <>
              <Line type="monotone" dataKey="earnedValue" name="Valor Ganado (EV)" stroke="var(--chart-2)" strokeWidth={3} dot={{ r: 4 }} connectNulls={false} />
              <Line type="monotone" dataKey="actualValue" name="Costo Real (AC)" stroke="var(--chart-3)" strokeWidth={3} dot={{ r: 4 }} connectNulls={false} />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProyectoEVMControlPanel({ project, pricingEngine }: ProyectoEVMControlPanelProps) {
  const queryClient = useQueryClient();
  const projectId = String(project?.id || '');
  const currency = project?.currency || 'USD';
  const [activeSubTab, setActiveSubTab] = useState<EvmTab>('curva');
  const [progressState, setProgressState] = useState<{ projectId: string; value: number } | null>(null);
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [isSavingCurve, setIsSavingCurve] = useState(false);

  const evmQuery = useTenantQuery<EvmResponse>(
    ['projects', projectId, 'evm', granularity],
    (signal) => projectsService.getEvm(projectId, granularity, signal),
    { enabled: Boolean(projectId) },
  );
  const evmData = evmQuery.data;
  const curveQuery = useTenantQuery<{ baselineVersion: number; points: PlannedCurvePoint[] }>(
    ['projects', projectId, 'evm', 'curve'],
    (signal) => projectsService.getEvmCurve(projectId, signal),
    { enabled: Boolean(projectId) },
  );
  const baselinesQuery = useTenantQuery<CostBaseline[]>(
    ['projects', projectId, 'costing-baselines'],
    (signal) => projectsService.getCostBaselines(projectId, signal),
    { enabled: Boolean(projectId) },
  );

  const [curveDraftState, setCurveDraftState] = useState<{ updatedAt: number; points: PlannedCurvePoint[] } | null>(null);
  const curveDraft = curveDraftState?.updatedAt === curveQuery.dataUpdatedAt
    ? curveDraftState.points
    : curveQuery.data?.points ?? [];
  const replaceCurveDraft = (points: PlannedCurvePoint[]) => setCurveDraftState({ updatedAt: curveQuery.dataUpdatedAt, points });
  const latestEarnedPct = evmData && evmData.status === 'OK'
    ? (evmData.curve.find((row) => row.earnedPct !== null)?.earnedPct ?? Number(project?.progress ?? 0))
    : Number(project?.progress ?? 0);
  const physicalProgress = progressState?.projectId === projectId
    ? progressState.value
    : Math.min(100, Math.max(0, latestEarnedPct));

  const activeBaseline = baselinesQuery.data?.[0];
  const costingResult = useMemo(() => {
    const matrix: Cost6DRow[] = (activeBaseline?.lines ?? []).map((line) => ({
      ...line,
      lineId: line.id,
      lineName: line.name,
      materiales: Number(line.materiales || 0),
      consumibles: Number(line.consumibles || 0),
      manoObra: Number(line.manoObra || 0),
      andamiosEquipos: Number(line.andamiosEquipos || 0),
      fletes: Number(line.fletes || 0),
      viaticos: Number(line.viaticos || 0),
    }));
    return compute6DCostingAndPricing(matrix, pricingEngine);
  }, [activeBaseline, pricingEngine]);

  const isBaselineApproved = Boolean(evmData && evmData.status !== 'NO_BASELINE');
  const canEditCurve = evmData?.status === 'NO_BASELINE';
  const curveRows = evmData && evmData.status !== 'NO_BASELINE' ? evmData.curve : [];
  const evidenceCount = curveRows.filter((row) => row.earnedValue !== null || row.actualValue !== null).length;
  const plannedCurveIsValid = curveDraft.length > 0
    && curveDraft[curveDraft.length - 1]?.plannedPct === 100
    && new Set(curveDraft.map((point) => point.weekIndex)).size === curveDraft.length
    && curveDraft.every((point, index) => Number.isInteger(point.weekIndex)
      && Number.isFinite(point.plannedPct)
      && point.plannedPct >= 0
      && point.plannedPct <= 100
      && Number.isFinite(new Date(point.periodStart).getTime())
      && (index === 0 || point.plannedPct >= curveDraft[index - 1].plannedPct));

  const invalidateEvm = async () => {
    await invalidateTenantQueries(queryClient);
    await evmQuery.refetch();
    await curveQuery.refetch();
  };

  const handleSaveProgress = async () => {
    if (!projectId) return;
    setIsSavingProgress(true);
    try {
      await projectsService.recordProgress(projectId, { physicalProgressPct: physicalProgress });
      await invalidateEvm();
      toast.success('Avance físico guardado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible guardar el avance físico.');
    } finally {
      setIsSavingProgress(false);
    }
  };

  const handleSaveCurve = async () => {
    if (!projectId || !canEditCurve || !plannedCurveIsValid) return;
    setIsSavingCurve(true);
    try {
      await projectsService.updateEvmCurve(projectId, curveDraft);
      await invalidateEvm();
      toast.success('Curva planificada guardada como borrador.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible guardar la curva planificada.');
    } finally {
      setIsSavingCurve(false);
    }
  };

  const addCurveWeek = () => {
    const lastPoint = curveDraft[curveDraft.length - 1];
    const start = lastPoint
      ? new Date(lastPoint.periodStart)
      : new Date(project?.startDate || Date.now());
    if (lastPoint) start.setDate(start.getDate() + 7);
    replaceCurveDraft([
      ...curveDraft,
      {
        weekIndex: (lastPoint?.weekIndex ?? 0) + 1,
        periodStart: start.toISOString().slice(0, 10),
        plannedPct: 100,
      },
    ]);
  };

  const updateCurvePoint = (index: number, patch: Partial<PlannedCurvePoint>) => {
    replaceCurveDraft(curveDraft.map((point, rowIndex) => rowIndex === index ? { ...point, ...patch } : point));
  };

  const formatCurveDate = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
  };

  const cashExposure = Number(
    costingResult?.kpis?.maxCashExposureUsd
      ?? Math.max(0, Number(project?.summary?.executedCost ?? project?.executedCost ?? 0)
        - Number(project?.summary?.collectedIncome ?? 0)),
  );
  return (
    <div className="space-y-5">
      <Card className="rounded-2xl border-border/60 bg-gradient-to-r from-card to-muted/20 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-black">
                <Activity className="size-5 text-primary" />
                Control EVM
              </CardTitle>
              <CardDescription className="text-xs">
                Curva planificada, avance físico, costos reales e indicadores provenientes del servidor.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-background/80 p-2">
              <label htmlFor="evm-physical-progress" className="text-xs font-bold text-muted-foreground">Avance físico:</label>
              <Input
                id="evm-physical-progress"
                type="number"
                min={0}
                max={100}
                value={physicalProgress}
                onChange={(event) => setProgressState({ projectId, value: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })}
                className="h-8 w-20 text-center font-mono text-xs font-bold"
              />
              <span className="text-xs font-bold text-muted-foreground">%</span>
              <Button size="sm" onClick={handleSaveProgress} disabled={isSavingProgress || !projectId} className="h-8 gap-1.5 text-xs">
                <Save className="size-3.5" />
                {isSavingProgress ? 'Guardando…' : 'Guardar avance'}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {evmQuery.isLoading && <Card><CardContent className="p-6 text-sm text-muted-foreground">Cargando datos EVM…</CardContent></Card>}
      {evmQuery.isError && <Card className="border-destructive/40"><CardContent className="p-6 text-sm text-destructive">{evmQuery.error.message}</CardContent></Card>}
      {evmData?.status === 'NO_BASELINE' && (
        <Card className="rounded-2xl border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-black"><Info className="size-5 text-amber-500" />Control EVM pendiente</CardTitle>
            <CardDescription>
              Aprueba una línea base con curva planificada desde Costeo 6D para habilitar el Valor Planificado (PV) y los indicadores EVM.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Tabs value={activeSubTab} onValueChange={(value) => setActiveSubTab(value as EvmTab)} className="w-full">
        <TabsList className="inline-flex h-auto w-full flex-wrap justify-start gap-1.5 rounded-2xl border border-border/40 bg-muted/40 p-1.5 backdrop-blur-xs">
          <TabsTrigger value="curva" className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Activity className="size-4 text-blue-500" /><span>Curva S</span>
            <Badge variant="outline" className="ml-1 px-1.5 py-0 text-[10px]">{evidenceCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="indicadores" className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Gauge className="size-4 text-emerald-500" /><span>Indicadores</span>
          </TabsTrigger>
          <TabsTrigger value="plan" className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <CalendarRange className="size-4 text-amber-500" /><span>Plan semanal</span>
          </TabsTrigger>
          <TabsTrigger value="partidas" className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Coins className="size-4 text-rose-500" /><span>Partidas 6D</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="curva" className="mt-4 space-y-4">
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base font-black"><TrendingUp className="size-4 text-primary" />Curva S de desempeño</CardTitle>
                  <CardDescription>PV planificado frente al EV físico y el costo real registrados en el servidor.</CardDescription>
                </div>
                <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/30 p-1">
                  <Button
                    variant={granularity === 'daily' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setGranularity('daily')}
                    className="h-7 px-2.5 text-xs font-bold"
                  >
                    Días
                  </Button>
                  <Button
                    variant={granularity === 'weekly' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setGranularity('weekly')}
                    className="h-7 px-2.5 text-xs font-bold"
                  >
                    Semanas
                  </Button>
                  <Button
                    variant={granularity === 'monthly' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setGranularity('monthly')}
                    className="h-7 px-2.5 text-xs font-bold"
                  >
                    Meses
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {evmData?.status === 'NO_EVIDENCE' && (
                <p className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50/50 p-3 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                  Aún no hay registros de avance ni costos en este periodo. Registra el avance físico para ver el Valor Ganado y el Costo Real.
                </p>
              )}
              {curveRows.length > 0
                ? <CurveChart rows={curveRows} currency={currency} plannedOnly={evmData?.status === 'NO_EVIDENCE'} />
                : <p className="p-6 text-sm text-muted-foreground">La línea base aprobada no contiene puntos de curva para mostrar.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="indicadores" className="mt-4 space-y-4">
          {evmData?.status === 'OK' ? (
            <>
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <MetricCard label="BAC · Presupuesto a término" value={money(evmData.indicators.bac, currency)} />
                <MetricCard label="PV · Valor planificado" value={money(evmData.indicators.pv, currency)} />
                <MetricCard label="EV · Valor ganado" value={money(evmData.indicators.ev, currency)} />
                <MetricCard label="AC · Costo real" value={money(evmData.indicators.ac, currency)} />
                <MetricCard label="CPI · Eficiencia de costo" value={evmData.indicators.cpi == null ? '—' : evmData.indicators.cpi.toFixed(2)} detail="EV / AC" />
                <MetricCard label="SPI · Eficiencia de cronograma" value={evmData.indicators.spi == null ? '—' : evmData.indicators.spi.toFixed(2)} detail="EV / PV" />
                <MetricCard label="EAC · Costo estimado al cierre" value={evmData.indicators.eac == null ? '—' : money(evmData.indicators.eac, currency)} />
                <MetricCard label="VAC · Variación al cierre" value={evmData.indicators.vac == null ? '—' : money(evmData.indicators.vac, currency)} />
                <MetricCard label="TCPI" value={evmData.indicators.tcpi == null ? '—' : evmData.indicators.tcpi.toFixed(2)} />
                <MetricCard label="Costo consumido" value={formatPct(evmData.indicators.consumedPct)} />
                <MetricCard label="Margen proyectado" value={formatPct(evmData.indicators.projectedMarginPct)} />
              </div>
              <Card className="rounded-2xl border-border/60">
                <CardHeader><CardTitle className="text-base font-black">Exposición de caja</CardTitle><CardDescription>Estimación del motor de precios y costos de la línea base del proyecto.</CardDescription></CardHeader>
                <CardContent><p className="text-2xl font-black">{money(cashExposure, currency)}</p></CardContent>
              </Card>
            </>
          ) : evmData?.status === 'NO_EVIDENCE' ? (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">La línea base está aprobada. Registra avance físico o costos ejecutados para habilitar los indicadores.</CardContent></Card>
          ) : (
            <Card><CardContent className="p-6 text-sm text-muted-foreground">Los indicadores estarán disponibles después de aprobar la línea base desde Costeo 6D.</CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="plan" className="mt-4">
          <Card className="rounded-2xl border-border/60">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-black">Plan semanal de avance</CardTitle>
                  <CardDescription>
                    {isBaselineApproved ? 'La curva pertenece a la línea base aprobada y es de solo lectura.' : canEditCurve ? 'Guarda un borrador de curva antes de aprobar la línea base.' : 'Consultando el estado de la línea base…'}
                  </CardDescription>
                </div>
                {canEditCurve && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={addCurveWeek} disabled={curveQuery.isLoading}>Agregar semana</Button>
                    <Button size="sm" onClick={handleSaveCurve} disabled={isSavingCurve || !plannedCurveIsValid}>
                      <Save className="mr-2 size-4" />{isSavingCurve ? 'Guardando…' : 'Guardar plan'}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {curveQuery.isError ? (
                <p className="text-sm text-destructive">{curveQuery.error.message}</p>
              ) : curveDraft.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  Aún no hay semanas configuradas. Agrega una semana y define el porcentaje planificado acumulado hasta cerrar en 100%.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Semana</TableHead><TableHead>Inicio del periodo</TableHead><TableHead className="w-48">Avance planificado acumulado</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {curveDraft.map((point, index) => (
                        <TableRow key={point.weekIndex}>
                          <TableCell className="font-semibold">Semana {point.weekIndex}</TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={formatCurveDate(point.periodStart)}
                              disabled={!canEditCurve}
                              onChange={(event) => updateCurvePoint(index, { periodStart: event.target.value })}
                              className="max-w-52"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={point.plannedPct}
                                disabled={!canEditCurve}
                                onChange={(event) => updateCurvePoint(index, { plannedPct: Number(event.target.value) })}
                                className="w-24"
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                              <Progress value={point.plannedPct} className="h-1.5 flex-1" />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {canEditCurve && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      El último punto debe ser 100% y los porcentajes acumulados no pueden disminuir.
                    </p>
                  )}
                  {isBaselineApproved && evmData && evmData.status !== 'NO_BASELINE' && (
                    <Badge variant="outline" className="mt-3">Línea base aprobada · versión {evmData.baselineVersion}</Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="partidas" className="mt-4">
          <Card className="rounded-2xl border-border/60">
            <CardHeader>
              <CardTitle className="text-base font-black">Presupuesto por partida 6D</CardTitle>
              <CardDescription>Importes reportados por el servidor para la línea base, costos comprometidos y ejecutados.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {evmData?.status === 'OK' && evmData.budgetByLine.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>Partida</TableHead><TableHead className="text-right">Presupuesto (BAC)</TableHead><TableHead className="text-right">Comprometido</TableHead><TableHead className="text-right">Ejecutado</TableHead><TableHead className="w-48">% consumido</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {evmData.budgetByLine.map((line: BudgetByLine, index) => (
                        <TableRow key={line.costLineId ?? 'unassigned-' + index}>
                          <TableCell className="font-semibold">{line.label}</TableCell>
                          <TableCell className="text-right font-mono">{money(line.budget, currency)}</TableCell>
                          <TableCell className="text-right font-mono">{money(line.committed, currency)}</TableCell>
                          <TableCell className="text-right font-mono">{money(line.executed, currency)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="w-12 text-right text-xs">{formatPct(line.consumedPct)}</span>
                              <Progress value={Math.min(100, Math.max(0, line.consumedPct ?? 0))} className="h-1.5 flex-1" />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="p-6 text-sm text-muted-foreground">
                  {evmData?.status === 'NO_EVIDENCE' ? 'El servidor todavía no reporta partidas con presupuesto o costos.' : 'Las partidas estarán disponibles en la respuesta EVM al registrar evidencia.'}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
