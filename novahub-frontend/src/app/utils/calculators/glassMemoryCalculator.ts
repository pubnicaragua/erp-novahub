export interface GlassPanelItem {
  id: string;
  tag: string;
  quantity: number;
  width: number;
  height: number;
  saques: number;
  barrenos: number;
}

export interface GlassCalculationConfig {
  glassUnitPrice: number;
  glassSaqueCost: number;
  glassBarrenoCost: number;
  glassPulidoCost: number;
  glassPriceIncludesProcesses: boolean;
  glassBreakageProvision: number;
  spareParts: number;
}

export interface GlassCalculationResult {
  netArea: number;
  totalPerimeter: number;
  totalSaques: number;
  totalBarrenos: number;
  avgPanelArea: number;
  spareArea: number;
  totalAreaToBuy: number;
  totalGlassCost: number;
  processCost: number;
  breakageCost: number;
  grandTotalCost: number;
}

export const BONANZA_GLASS_TEMPLATE: GlassPanelItem[] = [
  {
    id: 'VF-01',
    tag: 'VF-01',
    quantity: 1,
    width: 1.103,
    height: 0.773,
    saques: 4,
    barrenos: 2,
  },
  {
    id: 'VF-02',
    tag: 'VF-02',
    quantity: 15,
    width: 1.044,
    height: 0.773,
    saques: 4,
    barrenos: 2,
  },
  {
    id: 'VF-03',
    tag: 'VF-03',
    quantity: 1,
    width: 0.900,
    height: 0.773,
    saques: 4,
    barrenos: 2,
  },
];

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Realiza el cálculo técnico de la memoria de despiece de vidrio.
 */
export function calculateGlassMemory(
  panels: GlassPanelItem[],
  config: {
    glassUnitPrice: number;
    glassSaqueCost: number;
    glassBarrenoCost: number;
    glassPulidoCost: number;
    glassPriceIncludesProcesses: boolean;
    glassBreakageProvision: number;
    spareParts: number;
  }
): GlassCalculationResult {
  let netArea = 0;
  let totalPerimeter = 0;
  let totalSaques = 0;
  let totalBarrenos = 0;
  let totalQuantity = 0;

  for (const panel of panels) {
    const qty = Math.max(0, panel.quantity);
    const w = Math.max(0, panel.width);
    const h = Math.max(0, panel.height);
    const saques = Math.max(0, panel.saques);
    const barrenos = Math.max(0, panel.barrenos);

    netArea += w * h * qty;
    totalPerimeter += 2 * (w + h) * qty;
    totalSaques += saques * qty;
    totalBarrenos += barrenos * qty;
    totalQuantity += qty;
  }

  const avgPanelArea = totalQuantity > 0 ? netArea / totalQuantity : 0;
  const spareArea = Math.max(0, config.spareParts) * avgPanelArea;
  const totalAreaToBuy = netArea + spareArea;
  const totalGlassCost = totalAreaToBuy * Math.max(0, config.glassUnitPrice);

  const processCost = config.glassPriceIncludesProcesses
    ? 0
    : totalSaques * Math.max(0, config.glassSaqueCost) +
      totalBarrenos * Math.max(0, config.glassBarrenoCost) +
      totalPerimeter * Math.max(0, config.glassPulidoCost);

  const breakageRate =
    config.glassBreakageProvision > 1
      ? config.glassBreakageProvision / 100
      : Math.max(0, config.glassBreakageProvision);
  const breakageCost = totalGlassCost * breakageRate;

  const grandTotalCost = totalGlassCost + processCost + breakageCost;

  return {
    netArea: roundTo(netArea, 4),
    totalPerimeter: roundTo(totalPerimeter, 3),
    totalSaques,
    totalBarrenos,
    avgPanelArea: roundTo(avgPanelArea, 4),
    spareArea: roundTo(spareArea, 4),
    totalAreaToBuy: roundTo(totalAreaToBuy, 4),
    totalGlassCost: roundTo(totalGlassCost, 2),
    processCost: roundTo(processCost, 2),
    breakageCost: roundTo(breakageCost, 2),
    grandTotalCost: roundTo(grandTotalCost, 2),
  };
}
