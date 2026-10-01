import { useState, useMemo } from 'react';
import {
  Coins,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  RotateCcw,
  Info,
  CheckCircle2,
  DollarSign,
  Layers,
  Percent,
  HelpCircle,
  RefreshCw,
  Wallet,
  Trash2,
  Plus,
  ChevronDown,
  Building2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { toast } from '@/app/services/toast';
import { cn } from '../ui/utils';
import {
  compute6DCostingAndPricing,
  type Cost6DRow,
} from '@/app/utils/pricingEngine';
import { projectsService } from '../../services/projects.service';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateTenantQueries, useTenantQuery } from '../../hooks/useTenantQuery';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ProyectoCosteo6DPanelProps {
  project: any;
  pricingEngine: any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

type PersistedCostLine = Cost6DRow & { id: string; name: string };
type PersistedCostTemplate = { id: string; name: string; description?: string | null };

function formatMoney(amount: number, currency = 'USD'): string {
  const symbol = currency === 'NIO' ? 'C$' : '$';
  return `${symbol}${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ProyectoCosteo6DPanel({
  project,
  pricingEngine,
}: ProyectoCosteo6DPanelProps) {
  const queryClient = useQueryClient();
  const projectId = project?.id || 'default';
  const currency = project?.currency || 'USD';

  const costLinesQuery = useTenantQuery<PersistedCostLine[]>(
    ['projects', projectId, 'costing-lines'],
    (signal) => projectsService.getCostLines(projectId, signal),
    { enabled: Boolean(project?.id) },
  );
  const templatesQuery = useTenantQuery<PersistedCostTemplate[]>(
    ['projects', 'cost-templates'],
    (signal) => projectsService.getCostTemplates(signal),
    { enabled: Boolean(project?.id) },
  );
  const apiMatrix = useMemo<Cost6DRow[]>(() => {
    return (costLinesQuery.data || []).map((line) => ({
      ...line,
      lineId: line.id,
      lineName: line.name,
      materiales: Number(line.materiales || 0), consumibles: Number(line.consumibles || 0),
      manoObra: Number(line.manoObra || 0), andamiosEquipos: Number(line.andamiosEquipos || 0),
      fletes: Number(line.fletes || 0), viaticos: Number(line.viaticos || 0),
    }));
  }, [costLinesQuery.data]);
  const [draftLines, setDraftLines] = useState<Record<string, Cost6DRow>>({});
  const matrix = useMemo(
    () => apiMatrix.map((line) => draftLines[String(line.lineId)] || line),
    [apiMatrix, draftLines],
  );

  const [isSyncing, setIsSyncing] = useState(false);

  // Cálculo en tiempo real a través del motor unificado
  const costingResult = useMemo(() => {
    return compute6DCostingAndPricing(matrix, pricingEngine);
  }, [matrix, pricingEngine]);

  const { lines, totalsByNature, provisions, pricing, kpis } = costingResult;

  // Manejo de edición de celdas en la matriz
  const handleCellChange = (
    lineIndex: number,
    field: keyof Omit<Cost6DRow, 'lineId' | 'lineName'>,
    value: string,
  ) => {
    const num = parseFloat(value);
    const validNum = isNaN(num) || num < 0 ? 0 : num;

    const current = matrix[lineIndex];
    if (!current) return;
    setDraftLines((prev) => ({ ...prev, [String(current.lineId)]: { ...current, [field]: validNum } }));
  };

  // Manejo de edición del nombre de la partida
  const handleLineNameChange = (lineIndex: number, newName: string) => {
    const current = matrix[lineIndex];
    if (!current) return;
    setDraftLines((prev) => ({ ...prev, [String(current.lineId)]: { ...current, lineName: newName } }));
  };

  // Añadir nueva partida dinámica con costos en 0
  const handleAddRow = async () => {
    await projectsService.createCostLine(projectId, { name: `Partida ${matrix.length + 1}` });
    await costLinesQuery.refetch();
    toast.success('Nueva partida guardada en el proyecto.');
  };

  // Eliminar partida con confirmación / protección de mínimo 1
  const handleDeleteRow = async (lineIndex: number) => {
    const target = matrix[lineIndex];
    const name = target?.lineName || 'Partida';
    await projectsService.deleteCostLine(projectId, String(target.lineId));
    await costLinesQuery.refetch();
    toast.info(`Partida "${name}" eliminada.`);
  };

  // Cargar plantilla por rubro de industria
  const handleSelectTemplate = async (template: PersistedCostTemplate) => {
    const overwrite = matrix.length > 0;
    if (overwrite && !window.confirm('Esta acción reemplazará las partidas activas del proyecto. ¿Continuar?')) return;
    await projectsService.applyCostTemplate(projectId, template.id, overwrite);
    await costLinesQuery.refetch();
    toast.success(`Plantilla "${template.name}" aplicada al proyecto.`);
  };

  // Limpiar / reiniciar matriz a ceros
  const handleResetMatrix = async () => {
    const blank = matrix.map((row) => ({
      ...row,
      materiales: 0,
      consumibles: 0,
      manoObra: 0,
      andamiosEquipos: 0,
      fletes: 0,
      viaticos: 0,
    }));
    await Promise.all(blank.map((line) => projectsService.updateCostLine(projectId, String(line.lineId), { ...line, name: line.lineName })));
    setDraftLines(Object.fromEntries(blank.map((line) => [String(line.lineId), line])));
    toast.info('Matriz 6D reseteada a ceros.');
  };

  const saveLine = async (line: Cost6DRow) => {
    await projectsService.updateCostLine(projectId, String(line.lineId), { ...line, name: line.lineName });
    await costLinesQuery.refetch();
    setDraftLines({});
  };

  // Sincronizar presupuesto con Costeo 6D
  const handleSyncPresupuesto = async () => {
    setIsSyncing(true);
    try {
      if (project?.id) {
        await projectsService.approveCostBaseline(project.id, { pricingEngine, totals: totalsByNature, provisions, pricing });
      }

      toast.success(
        'Línea base aprobada y congelada para control EVM.',
      );
      invalidateTenantQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message;
      toast.error(msg || 'Error al sincronizar el presupuesto con el Costeo 6D.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* CABECERA Y ACCIONES PRINCIPALES */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Coins className="size-5" />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight text-foreground">
                Costeo 6D y Arquitectura de Precios
              </h3>
              <p className="text-xs text-muted-foreground">
                Desglose matricial por 6 naturalezas, provisiones técnicas y gross-up comercial en cascada.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetMatrix}
            className="rounded-xl border-border/60 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground gap-1.5"
            title="Limpiar todos los importes de la matriz"
          >
            <RotateCcw className="size-3.5" />
            <span>Limpiar</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl border-primary/30 bg-primary/5 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/10 gap-1.5"
                title="Cargar partidas predefinidas según el rubro o tipología del proyecto"
              >
                <Building2 className="size-3.5" />
                <span>Plantillas por Rubro</span>
                <ChevronDown className="size-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-1.5">
              <DropdownMenuLabel className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1.5">
                Plantillas por Industria
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(templatesQuery.data || []).map((tpl) => (
                <DropdownMenuItem
                  key={tpl.id}
                  onClick={() => handleSelectTemplate(tpl)}
                  className="flex flex-col items-start gap-0.5 p-2 rounded-lg cursor-pointer transition-colors"
                >
                  <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                    <Sparkles className="size-3 text-primary shrink-0" />
                    {tpl.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {tpl.description}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            size="sm"
            onClick={handleSyncPresupuesto}
            disabled={isSyncing}
            className="rounded-xl font-bold uppercase tracking-wider text-xs gap-2 shadow-sm"
          >
            <RefreshCw className={cn('size-3.5', isSyncing && 'animate-spin')} />
            <span>{isSyncing ? 'Sincronizando…' : 'Sincronizar Presupuesto con Costeo 6D'}</span>
          </Button>
        </div>
      </div>

      {/* SECCIÓN D: INDICADORES FINANCIEROS CLAVE (KPIS) */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Utilidad Bruta */}
        <Card className="relative overflow-hidden rounded-2xl border-border/60 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Utilidad Bruta ($ / %)
              </span>
              <DollarSign className="size-4 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black tracking-tight text-foreground">
                {formatMoney(kpis.grossProfitAmount, currency)}
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                ({kpis.grossProfitMarginPct.toFixed(1)}%)
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Sobre Precio Ofertado sin IVA tras absorber el Costo Cargado (CC).
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Margen Bruto Real vs Piso */}
        <Card
          className={cn(
            'relative overflow-hidden rounded-2xl border shadow-xs transition-colors',
            kpis.isAboveFloorMargin
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-rose-500/40 bg-rose-500/5',
          )}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Margen vs Piso (15%)
              </span>
              {kpis.isAboveFloorMargin ? (
                <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="size-4 text-rose-600 dark:text-rose-400" />
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className={cn(
                  'text-2xl font-black tracking-tight',
                  kpis.isAboveFloorMargin
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400',
                )}
              >
                {kpis.grossProfitMarginPct.toFixed(1)}%
              </span>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] font-bold',
                  kpis.isAboveFloorMargin
                    ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                    : 'border-rose-500/40 text-rose-700 dark:text-rose-300',
                )}
              >
                {kpis.isAboveFloorMargin
                  ? `+${kpis.marginDeltaFloor.toFixed(1)}% sobre piso`
                  : `${kpis.marginDeltaFloor.toFixed(1)}% bajo piso`}
              </Badge>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {kpis.isAboveFloorMargin
                ? 'Margen saludable, cumple política comercial NovaHub.'
                : 'ALERTA: Margen por debajo del piso corporativo mínimo.'}
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Punto de Equilibrio */}
        <Card className="relative overflow-hidden rounded-2xl border-border/60 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Punto de Equilibrio (CC)
              </span>
              <TrendingUp className="size-4 text-blue-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black tracking-tight text-foreground">
                {formatMoney(kpis.breakEvenPointUsd, currency)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Venta mínima sin IVA requerida para cubrir CD + todas las provisiones.
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Exposición Máxima y Cobertura 70% */}
        <Card className="relative overflow-hidden rounded-2xl border-border/60 shadow-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Exposición de Caja (Ant. 70%)
              </span>
              <Wallet className="size-4 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black tracking-tight text-foreground">
                {formatMoney(kpis.maxCashExposureUsd, currency)}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] font-bold',
                  kpis.maxCashExposureUsd === 0
                    ? 'border-emerald-500/40 text-emerald-600'
                    : 'border-amber-500/40 text-amber-600',
                )}
              >
                {kpis.advanceCoveragePct.toFixed(0)}% Cobertura CD
              </Badge>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Anticipo 70%: {formatMoney(kpis.advance70Usd, currency)}.
              {kpis.maxCashExposureUsd === 0
                ? ' Autofinanciado sin riesgo de caja.'
                : ' Exposición máxima requerida de fondos propios.'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* SECCIÓN A: MATRIZ 6D DE COSTOS */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base font-black tracking-tight flex items-center gap-2">
                <Layers className="size-4 text-primary" />
                <span>Matriz 6D de Costos Directos</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Edite los importes directos en cada celda para actualizar la cascada comercial de forma reactiva.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddRow}
                className="rounded-xl border-dashed border-primary/50 text-primary hover:bg-primary/10 text-xs font-bold gap-1.5"
                title="Añadir nueva partida personalizada a la matriz"
              >
                <Plus className="size-3.5" />
                <span>+ Añadir Partida</span>
              </Button>
              <Badge variant="outline" className="border-border/60 font-mono text-xs">
                Total CD: <span className="ml-1 font-bold text-primary">{formatMoney(totalsByNature.totalDirectCost, currency)}</span>
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-2">
          <div className="w-full overflow-x-auto custom-scrollbar">
            <Table className="w-full min-w-[850px] text-xs">
              <TableHeader>
                <TableRow className="border-border/50 bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[220px] font-black uppercase text-foreground">Partida / Rubro</TableHead>
                  <TableHead className="text-right font-black uppercase text-foreground">1. Materiales</TableHead>
                  <TableHead className="text-right font-black uppercase text-foreground">2. Consumibles</TableHead>
                  <TableHead className="text-right font-black uppercase text-foreground">3. Mano de Obra</TableHead>
                  <TableHead className="text-right font-black uppercase text-foreground">4. Andamios/Eq.</TableHead>
                  <TableHead className="text-right font-black uppercase text-foreground">5. Fletes</TableHead>
                  <TableHead className="text-right font-black uppercase text-foreground">6. Viáticos</TableHead>
                  <TableHead className="text-right font-black uppercase text-foreground bg-primary/5">Total CD</TableHead>
                  <TableHead className="w-[70px] text-right font-black uppercase text-foreground">% CD</TableHead>
                  <TableHead className="w-[60px] text-center font-black uppercase text-foreground">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, idx) => (
                  <TableRow key={line.lineId || idx} className="border-border/40 hover:bg-muted/20">
                    <TableCell className="p-1.5 font-bold text-foreground min-w-[200px]">
                      <div className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-primary/70 shrink-0" />
                        <Input
                          type="text"
                          value={line.lineName}
                          onChange={(e) => handleLineNameChange(idx, e.target.value)}
                          onBlur={() => void saveLine(matrix[idx])}
                          placeholder="Nombre de la partida..."
                          className="h-8 font-semibold text-xs rounded-lg bg-background/50 focus-visible:bg-background border-border/60"
                        />
                      </div>
                    </TableCell>

                    {/* 1. Materiales */}
                    <TableCell className="p-1.5 text-right">
                      <Input
                        type="number"
                        step="10"
                        min="0"
                        value={line.materiales || ''}
                        onChange={(e) => handleCellChange(idx, 'materiales', e.target.value)}
                        onBlur={() => void saveLine(matrix[idx])}
                        className="h-8 text-right font-mono text-xs rounded-lg"
                      />
                    </TableCell>

                    {/* 2. Consumibles */}
                    <TableCell className="p-1.5 text-right">
                      <Input
                        type="number"
                        step="5"
                        min="0"
                        value={line.consumibles || ''}
                        onChange={(e) => handleCellChange(idx, 'consumibles', e.target.value)}
                        onBlur={() => void saveLine(matrix[idx])}
                        className="h-8 text-right font-mono text-xs rounded-lg"
                      />
                    </TableCell>

                    {/* 3. Mano de Obra */}
                    <TableCell className="p-1.5 text-right">
                      <Input
                        type="number"
                        step="10"
                        min="0"
                        value={line.manoObra || ''}
                        onChange={(e) => handleCellChange(idx, 'manoObra', e.target.value)}
                        onBlur={() => void saveLine(matrix[idx])}
                        className="h-8 text-right font-mono text-xs rounded-lg"
                      />
                    </TableCell>

                    {/* 4. Andamios/Equipos */}
                    <TableCell className="p-1.5 text-right">
                      <Input
                        type="number"
                        step="5"
                        min="0"
                        value={line.andamiosEquipos || ''}
                        onChange={(e) => handleCellChange(idx, 'andamiosEquipos', e.target.value)}
                        onBlur={() => void saveLine(matrix[idx])}
                        className="h-8 text-right font-mono text-xs rounded-lg"
                      />
                    </TableCell>

                    {/* 5. Fletes */}
                    <TableCell className="p-1.5 text-right">
                      <Input
                        type="number"
                        step="5"
                        min="0"
                        value={line.fletes || ''}
                        onChange={(e) => handleCellChange(idx, 'fletes', e.target.value)}
                        onBlur={() => void saveLine(matrix[idx])}
                        className="h-8 text-right font-mono text-xs rounded-lg"
                      />
                    </TableCell>

                    {/* 6. Viáticos */}
                    <TableCell className="p-1.5 text-right">
                      <Input
                        type="number"
                        step="5"
                        min="0"
                        value={line.viaticos || ''}
                        onChange={(e) => handleCellChange(idx, 'viaticos', e.target.value)}
                        onBlur={() => void saveLine(matrix[idx])}
                        className="h-8 text-right font-mono text-xs rounded-lg"
                      />
                    </TableCell>

                    {/* Total Línea CD */}
                    <TableCell className="text-right font-mono font-bold text-foreground bg-primary/5">
                      {formatMoney(line.totalDirectCost, currency)}
                    </TableCell>

                    {/* % CD */}
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {line.pctOfTotal.toFixed(1)}%
                    </TableCell>

                    {/* Acción Eliminar */}
                    <TableCell className="p-1.5 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteRow(idx)}
                        title={`Eliminar "${line.lineName}"`}
                        className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {/* FILA DE TOTALES POR NATURALEZA */}
                <TableRow className="border-t-2 border-border/80 bg-muted/50 font-black">
                  <TableCell className="uppercase text-foreground">Totales 6D ({matrix.length} {matrix.length === 1 ? 'partida' : 'partidas'})</TableCell>
                  <TableCell className="text-right font-mono text-foreground">
                    {formatMoney(totalsByNature.materiales, currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-foreground">
                    {formatMoney(totalsByNature.consumibles, currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-foreground">
                    {formatMoney(totalsByNature.manoObra, currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-foreground">
                    {formatMoney(totalsByNature.andamiosEquipos, currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-foreground">
                    {formatMoney(totalsByNature.fletes, currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-foreground">
                    {formatMoney(totalsByNature.viaticos, currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-primary text-sm bg-primary/10">
                    {formatMoney(totalsByNature.totalDirectCost, currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-foreground">100%</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="p-2.5 border-t border-border/40 bg-muted/10 flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRow}
              className="rounded-xl border-dashed border-primary/50 text-primary hover:bg-primary/10 text-xs font-bold gap-1.5"
            >
              <Plus className="size-3.5" />
              <span>+ Añadir Partida</span>
            </Button>
            <span className="text-[11px] text-muted-foreground">
              {matrix.length} {matrix.length === 1 ? 'partida activa' : 'partidas activas'} en el desglose 6D
            </span>
          </div>
        </CardContent>
      </Card>

      {/* SECCIÓN B: ESTRUCTURA DE PROVISIONES Y COSTO CARGADO (CC) */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-black tracking-tight flex items-center gap-2">
                <Percent className="size-4 text-primary" />
                <span>Estructura de Provisiones y Costo Cargado (CC)</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Carga indirecta y técnica aplicada sobre el costo directo para asegurar solvencia operativa.
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary font-bold">
              Total CC: {formatMoney(provisions.totalLoadedCost, currency)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-1">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {/* Imprevistos */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Imprevistos ({provisions.contingenciesRatePct.toFixed(1)}%)</span>
                <TooltipProvider>
                  <Tooltip delayDuration={150}>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground hover:text-foreground cursor-pointer" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Contingencia técnica sobre costo directo para cubrir desvíos imprevistos de obra.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-lg font-black font-mono text-foreground">
                {formatMoney(provisions.contingenciesAmount, currency)}
              </p>
              <p className="text-[10px] text-muted-foreground">5.0% aplicado sobre Total CD.</p>
            </div>

            {/* Gastos Administrativos */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Gastos Admin ({provisions.overheadRatePct.toFixed(1)}%)</span>
                <TooltipProvider>
                  <Tooltip delayDuration={150}>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground hover:text-foreground cursor-pointer" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Overhead corporativo para soporte contable, supervisión y gestión central.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-lg font-black font-mono text-foreground">
                {formatMoney(provisions.overheadAmount, currency)}
              </p>
              <p className="text-[10px] text-muted-foreground">4.0% aplicado sobre Total CD.</p>
            </div>

            {/* Provisión Rotura Vidrio */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Rotura Vidrio ({provisions.glassBreakageRatePct.toFixed(1)}%)</span>
                <TooltipProvider>
                  <Tooltip delayDuration={150}>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground hover:text-foreground cursor-pointer" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Fondo de reserva para reposición de paneles templados quebrados durante izaje o montaje.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-lg font-black font-mono text-foreground">
                {formatMoney(provisions.glassBreakageAmount, currency)}
              </p>
              <p className="text-[10px] text-muted-foreground">2.0% sobre materiales vidriados.</p>
            </div>

            {/* Costo Financiero por Cobro */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Costo Financiero Cobro</span>
                <TooltipProvider>
                  <Tooltip delayDuration={150}>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground hover:text-foreground cursor-pointer" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Costo de financiamiento por plazo de crédito otorgado al cliente (plazo vs tasa bancaria).
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-lg font-black font-mono text-foreground">
                {formatMoney(provisions.financialCostAmount, currency)}
              </p>
              <p className="text-[10px] text-muted-foreground">Plazo estimado: 15 días.</p>
            </div>
          </div>

          {/* Resumen de Cierre de Costo Cargado */}
          <div className="mt-4 flex flex-wrap items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-primary" />
              <span className="text-xs font-bold text-foreground">
                Total Provisiones Acumuladas: {formatMoney(provisions.totalProvisions, currency)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Fórmula: CD ({formatMoney(totalsByNature.totalDirectCost, currency)}) + Provisiones</span>
              <span className="text-sm font-black font-mono text-primary">
                = {formatMoney(provisions.totalLoadedCost, currency)} (CC)
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECCIÓN C: MÁRGENES Y GROSS-UP COMERCIAL (CASCADA) */}
      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="text-base font-black tracking-tight flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            <span>Márgenes y Cascada de Gross-Up Comercial</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Desglose secuencial de la fijación de precio con protección de margen neto frente a comisiones y retenciones de ley.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-1 space-y-4">
          <div className="space-y-3">
            {/* Paso 1: Base y Márgenes aplicados */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-border/50 bg-muted/20 gap-2">
              <div className="flex items-center gap-3">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-black">
                  1
                </span>
                <div>
                  <h4 className="text-xs font-black text-foreground">
                    Base y Margen Meta Aplicado ({pricing.targetMarginPct.toFixed(1)}%)
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Precio antes de comisión = CC ({formatMoney(pricing.totalLoadedCost, currency)}) / (1 - {pricing.targetMarginPct / 100})
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm font-black text-foreground">
                  {formatMoney(pricing.basePriceBeforeCommission, currency)}
                </span>
                <p className="text-[10px] text-muted-foreground">Precio antes de comisión</p>
              </div>
            </div>

            {/* Paso 2: Gross-Up Comisión Ventas (2.5%) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-border/50 bg-muted/20 gap-2">
              <div className="flex items-center gap-3">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-black">
                  2
                </span>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-black text-foreground">
                      Gross-Up Comisión Ventas ({pricing.salesCommissionRatePct.toFixed(1)}%)
                    </h4>
                    <TooltipProvider>
                      <Tooltip delayDuration={150}>
                        <TooltipTrigger asChild>
                          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold cursor-pointer gap-1">
                            <Info className="size-3" />
                            <span>¿Por qué divide entre 0.975?</span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-xs">
                          Al dividir entre (1 - 0.025) = 0.975 en vez de multiplicar por 1.025, se garantiza que al descontar el 2.5% del valor total vendido, el ingreso neto recuperado sea exactamente la base requerida sin mermar el margen del proyecto.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Importe de comisión: {formatMoney(pricing.salesCommissionAmount, currency)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm font-black text-foreground">
                  {formatMoney(pricing.subtotalSale, currency)}
                </span>
                <p className="text-[10px] text-muted-foreground">Subtotal Venta</p>
              </div>
            </div>

            {/* Paso 3: Gross-Up Retenciones IR (2%) + IMI (1%) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-border/50 bg-muted/20 gap-2">
              <div className="flex items-center gap-3">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-black">
                  3
                </span>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-black text-foreground">
                      Gross-Up Retenciones Fiscales IR ({pricing.retentionIrRatePct.toFixed(0)}%) + IMI ({pricing.retentionImiRatePct.toFixed(0)}%) = {pricing.totalRetentionsRatePct.toFixed(0)}%
                    </h4>
                    <TooltipProvider>
                      <Tooltip delayDuration={150}>
                        <TooltipTrigger asChild>
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-bold cursor-pointer gap-1">
                            <ShieldCheck className="size-3" />
                            <span>División entre 0.97 (Ahorro ~${pricing.savingsVsNormalDeduction.toFixed(0)})</span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm text-xs">
                          La legislación tributaria nicaragüense aplica retención del 2% IR (DGI) y 1% IMI (Alcaldía). Dividir entre 0.97 traslada legalmente la absorción tributaria y evita que la empresa pierda {formatMoney(pricing.savingsVsNormalDeduction, currency)} de su margen de utilidad.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Monto ajustado de retenciones: {formatMoney(pricing.retentionsGrossUpAmount, currency)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono text-sm font-black text-primary">
                  {formatMoney(pricing.offeredPriceWithoutIva, currency)}
                </span>
                <p className="text-[10px] text-muted-foreground">Precio Ofertado sin IVA</p>
              </div>
            </div>

            {/* Paso 4: Cierre con IVA 15% Explícito */}
            <div className="mt-4 rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-center">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Precio Ofertado sin IVA
                  </span>
                  <p className="text-xl font-black font-mono text-foreground">
                    {formatMoney(pricing.offeredPriceWithoutIva, currency)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Base neta para facturación</p>
                </div>

                <div className="space-y-1 sm:border-x sm:border-border/60 sm:px-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      IVA {pricing.ivaRatePct.toFixed(0)}% Explícito
                    </span>
                    <Badge variant="outline" className="text-[10px] font-bold border-primary/30">
                      Ley 822
                    </Badge>
                  </div>
                  <p className="text-xl font-black font-mono text-foreground">
                    {formatMoney(pricing.ivaAmount, currency)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Impuesto al Valor Agregado</p>
                </div>

                <div className="space-y-1 sm:pl-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    Precio Total con IVA
                  </span>
                  <p className="text-2xl font-black font-mono text-primary">
                    {formatMoney(pricing.totalPriceWithIva, currency)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Total contrato para el cliente</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
