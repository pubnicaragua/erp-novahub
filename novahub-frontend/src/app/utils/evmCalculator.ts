/**
 * Tipos compartidos para el estado financiero de líneas del Costeo 6D.
 * Los cálculos de valor ganado y de curvas planificadas se sirven desde el backend.
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
 * Calcula el BAC consolidado sumando las seis dimensiones de costo directo.
 * Se conserva como utilidad de apoyo fuera del flujo del panel EVM.
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
