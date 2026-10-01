/**
 * Módulo de Gestión del Valor Ganado (EVM) y Curva S para Proyectos NovaHub.
 *
 * Implementa las métricas estándar del Project Management Institute (PMI)
 * adaptadas al costeo directo 6D (ACM, Vidrio, WPC, Rótulos y Retrabajos).
 */

export interface Cost6DLineItem {
  lineId?: string;
  lineName?: string;
  materiales?: number;
  consumibles?: number;
  manoObra?: number;
  manoDeObra?: number;
  andamiosEquipos?: number;
  equiposAndamios?: number;
  fletes?: number;
  fletesLogistica?: number;
  viaticos?: number;
}

export type EVMCostStatus = 'OPTIMO' | 'EN_RANGO' | 'SOBRECOSTO_CRITICO';
export type EVMMarginStatus = 'SOBRE_PISO' | 'BAJO_PISO';

export interface EVMStatusBadge {
  label: string;
  variant: 'success' | 'warning' | 'destructive' | 'neutral';
  colorClass: string;
  dotClass: string;
}

export interface SCurvePoint {
  periodLabel: string;
  weekIndex: number;
  plannedPV: number;
  earnedEV: number | null;
  actualAC: number | null;
  plannedPct: number;
  earnedPct: number | null;
  actualPct: number | null;
}

export interface EVMInput {
  /** Costo presupuestado total (BAC) calculado desde el Costeo 6D completo sumando TODAS las líneas ACM, Vidrio, WPC, Rótulos y Retrabajos */
  bac: number;
  /** Avance físico de obra en porcentaje (0 a 100) */
  physicalProgressPct: number;
  /** Costo ejecutado real (AC - Actual Cost) */
  actualCost: number;
  /** Costo comprometido (órdenes pendientes de pago/facturación) */
  committedCost: number;
  /** Valor planificado a la fecha (PV - Planned Value) */
  plannedValue: number;
  /** Venta contratada sin IVA */
  contractPriceWithoutIva: number;
  /** Días transcurridos de obra */
  elapsedDays: number;
  /** Plazo contractual total en días hábiles */
  totalDays: number;
  /** Array opcional de puntos porcentuales planeados acumulados por semana */
  weeklyPlannedCurve?: number[];
  /** Margen piso objetivo en porcentaje (por defecto 15%) */
  floorMarginPct?: number;
}

export interface EVMResult {
  // Valores base
  bac: number;
  pv: number;
  ac: number;
  ev: number;
  committedCost: number;
  totalIncurred: number;

  // Índices de desempeño
  cpi: number;
  spi: number;
  eac: number;
  vac: number;
  cv: number;
  sv: number;
  tcpi: number;

  // Porcentajes de avance y presupuesto
  physicalProgressPct: number;
  scheduleProgressPct: number;
  budgetConsumedPct: number;

  // Rentabilidad y utilidades
  contractPriceWithoutIva: number;
  budgetedProfit: number;
  budgetedMarginPct: number;
  projectedProfitAtClose: number;
  projectedMarginAtClosePct: number;

  // Semáforos y alertas
  costStatus: EVMCostStatus;
  marginStatus: EVMMarginStatus;
  speedAlert: boolean;
  costStatusBadge: EVMStatusBadge;
  marginStatusBadge: EVMStatusBadge;

  // Curva S generada
  sCurveSeries: SCurvePoint[];
}

export const COST_STATUS_BADGES: Record<EVMCostStatus, EVMStatusBadge> = {
  OPTIMO: {
    label: 'Óptimo',
    variant: 'success',
    colorClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  EN_RANGO: {
    label: 'En Rango',
    variant: 'warning',
    colorClass: 'bg-amber-500/10 text-amber-600 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  SOBRECOSTO_CRITICO: {
    label: 'Sobrecosto Crítico',
    variant: 'destructive',
    colorClass: 'bg-rose-500/10 text-rose-600 border-rose-200',
    dotClass: 'bg-rose-500',
  },
};

export const MARGIN_STATUS_BADGES: Record<EVMMarginStatus, EVMStatusBadge> = {
  SOBRE_PISO: {
    label: 'Sobre Piso',
    variant: 'success',
    colorClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  BAJO_PISO: {
    label: 'Bajo Piso',
    variant: 'destructive',
    colorClass: 'bg-rose-500/10 text-rose-600 border-rose-200',
    dotClass: 'bg-rose-500',
  },
};

/**
 * Calcula el BAC (Budget At Completion) consolidado sumando
 * las 6 dimensiones de costo directo para todas las líneas de la matriz.
 */
export function calculateBacFrom6DCostMatrix(lines: Cost6DLineItem[]): number {
  if (!Array.isArray(lines)) return 0;
  const total = lines.reduce((acc, row) => {
    const mat = Number(row.materiales || 0);
    const con = Number(row.consumibles || 0);
    const mo = Number(row.manoObra ?? row.manoDeObra ?? 0);
    const eq = Number(row.andamiosEquipos ?? row.equiposAndamios ?? 0);
    const fl = Number(row.fletes ?? row.fletesLogistica ?? 0);
    const vi = Number(row.viaticos || 0);
    return acc + mat + con + mo + eq + fl + vi;
  }, 0);
  return Math.round(total * 100) / 100;
}

/**
 * Normaliza un valor entre 0 y 1 usando una curva logística sigmoide simétrica.
 * f(x) = (S(x) - S(0)) / (S(1) - S(0)) donde S(x) = 1 / (1 + e^(-k*(x - 0.5)))
 * Asegura f(0) = 0, f(0.5) = 0.5 y f(1) = 1 con pendiente progresiva.
 */
function sigmoidNormalized(x: number, steepness = 6): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const s = (val: number) => 1 / (1 + Math.exp(-steepness * (val - 0.5)));
  const s0 = s(0);
  const s1 = s(1);
  return (s(x) - s0) / (s1 - s0);
}

/**
 * Genera la serie de puntos para la Curva S acumulada (PV, EV, AC).
 * Modela la curva logística sigmoide para el Planned Value (PV) y proyecta
 * EV y AC reales hasta la semana en curso.
 */
export function generateSCurveSeries(
  totalWeeks: number,
  currentWeek: number,
  bac: number,
  actualCostTotal: number,
  evTotal: number,
  weeklyPlannedCurve?: number[]
): SCurvePoint[] {
  const weeks = Math.max(1, Math.round(totalWeeks));
  const curWeek = Math.max(0, Math.min(weeks, Math.round(currentWeek)));
  const series: SCurvePoint[] = [];

  for (let w = 1; w <= weeks; w++) {
    const progressFraction = w / weeks;

    const plannedPct =
      Array.isArray(weeklyPlannedCurve) && weeklyPlannedCurve.length >= w
        ? Math.min(100, Math.max(0, weeklyPlannedCurve[w - 1]))
        : Math.round(sigmoidNormalized(progressFraction) * 10000) / 100;

    const plannedPV = Math.round(((plannedPct / 100) * bac) * 100) / 100;

    let earnedEV: number | null = null;
    let actualAC: number | null = null;

    if (w <= curWeek) {
      if (curWeek === 0) {
        earnedEV = 0;
        actualAC = 0;
      } else if (w === curWeek) {
        earnedEV = Math.round(evTotal * 100) / 100;
        actualAC = Math.round(actualCostTotal * 100) / 100;
      } else {
        const curSigmoid = sigmoidNormalized(curWeek / weeks);
        const thisSigmoid = sigmoidNormalized(progressFraction);
        const ratio = curSigmoid > 0 ? thisSigmoid / curSigmoid : w / curWeek;
        earnedEV = Math.round(evTotal * ratio * 100) / 100;
        actualAC = Math.round(actualCostTotal * ratio * 100) / 100;
      }
    }

    const earnedPct = earnedEV !== null && bac > 0 ? Math.round((earnedEV / bac) * 10000) / 100 : null;
    const actualPct = actualAC !== null && bac > 0 ? Math.round((actualAC / bac) * 10000) / 100 : null;

    series.push({
      periodLabel: `Semana ${w}`,
      weekIndex: w,
      plannedPV,
      earnedEV,
      actualAC,
      plannedPct,
      earnedPct,
      actualPct,
    });
  }

  return series;
}

/**
 * Función pura que ejecuta el cálculo completo de EVM (Earned Value Management)
 * e indicadores financieros/operativos para un proyecto de construcción/fachadas.
 */
export function calculateProjectEVM(params: EVMInput): EVMResult {
  const {
    bac,
    physicalProgressPct,
    actualCost,
    committedCost,
    plannedValue,
    contractPriceWithoutIva,
    elapsedDays,
    totalDays,
    weeklyPlannedCurve,
    floorMarginPct = 15,
  } = params;

  // 1. Earned Value (EV)
  const ev = Math.round(((physicalProgressPct / 100) * bac) * 100) / 100;

  // 2. Índices de rendimiento de costos y cronograma
  const cpi = actualCost > 0 ? Number((ev / actualCost).toFixed(4)) : 1;
  const spi = plannedValue > 0 ? Number((ev / plannedValue).toFixed(4)) : 1;

  // 3. Estimación al término (EAC) y Variación al término (VAC)
  const eac = cpi > 0 ? Math.round((bac / cpi) * 100) / 100 : bac;
  const vac = Math.round((bac - eac) * 100) / 100;

  // Variaciones absolutas estándar
  const cv = Math.round((ev - actualCost) * 100) / 100;
  const sv = Math.round((ev - plannedValue) * 100) / 100;

  // TCPI (To-Complete Performance Index)
  const remainingWork = bac - ev;
  const remainingFunds = bac - actualCost;
  const tcpi = remainingFunds > 0 ? Number((remainingWork / remainingFunds).toFixed(4)) : 1;

  // 4. Incurridos y consumo de presupuesto
  const totalIncurred = Math.round((actualCost + committedCost) * 100) / 100;
  const budgetConsumedPct = bac > 0 ? Math.round((totalIncurred / bac) * 10000) / 100 : 0;
  const scheduleProgressPct = totalDays > 0 ? Math.min(100, Math.round((elapsedDays / totalDays) * 10000) / 100) : 0;

  // 5. Utilidad y márgenes
  const budgetedProfit = Math.round((contractPriceWithoutIva - bac) * 100) / 100;
  const budgetedMarginPct =
    contractPriceWithoutIva > 0
      ? Math.round((budgetedProfit / contractPriceWithoutIva) * 10000) / 100
      : 0;

  const projectedProfitAtClose = Math.round((contractPriceWithoutIva - eac) * 100) / 100;
  const projectedMarginAtClosePct =
    contractPriceWithoutIva > 0
      ? Math.round((projectedProfitAtClose / contractPriceWithoutIva) * 10000) / 100
      : 0;

  // 6. Semáforos y alertas
  let costStatus: EVMCostStatus;
  if (cpi < 0.9) {
    costStatus = 'SOBRECOSTO_CRITICO';
  } else if (cpi < 1.0) {
    costStatus = 'EN_RANGO';
  } else {
    costStatus = 'OPTIMO';
  }

  const marginStatus: EVMMarginStatus =
    projectedMarginAtClosePct >= floorMarginPct ? 'SOBRE_PISO' : 'BAJO_PISO';

  const speedAlert = budgetConsumedPct > physicalProgressPct;

  // 7. Curva S
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 5));
  const currentWeek = Math.max(0, Math.min(totalWeeks, Math.ceil(elapsedDays / 5)));
  const sCurveSeries = generateSCurveSeries(
    totalWeeks,
    currentWeek,
    bac,
    actualCost,
    ev,
    weeklyPlannedCurve
  );

  return {
    bac,
    pv: plannedValue,
    ac: actualCost,
    ev,
    committedCost,
    totalIncurred,

    cpi,
    spi,
    eac,
    vac,
    cv,
    sv,
    tcpi,

    physicalProgressPct,
    scheduleProgressPct,
    budgetConsumedPct,

    contractPriceWithoutIva,
    budgetedProfit,
    budgetedMarginPct,
    projectedProfitAtClose,
    projectedMarginAtClosePct,

    costStatus,
    marginStatus,
    speedAlert,
    costStatusBadge: COST_STATUS_BADGES[costStatus],
    marginStatusBadge: MARGIN_STATUS_BADGES[marginStatus],

    sCurveSeries,
  };
}
