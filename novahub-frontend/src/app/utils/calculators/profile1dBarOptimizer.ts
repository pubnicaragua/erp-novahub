export interface ProfileCutItem {
  id: string;
  tag: string;
  lengthMeters: number;
  quantity: number;
}

export interface BarCut {
  tag: string;
  length: number;
}

export interface BarCutAllocation {
  barIndex: number;
  cuts: BarCut[];
  usedLength: number;
  scrapLength: number;
  efficiencyPct: number;
}

export interface ProfileOptimizationResult {
  bars: BarCutAllocation[];
  totalBars: number;
  totalNetMeters: number;
  totalPurchasedMeters: number;
  totalScrapMeters: number;
  overallEfficiencyPct: number;
  overallScrapPct: number;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

interface InternalPiece {
  tag: string;
  length: number;
}

interface InternalBar {
  cuts: BarCut[];
  cutsLengthSum: number;
  kerfTotal: number;
  consumedLength: number;
}

/**
 * Optimiza el corte de perfiles en barras estándar usando el algoritmo
 * Best Fit Decreasing (BFD), considerando opcionalmente la pérdida por corte de disco (kerf).
 */
export function optimizeProfileBars(
  cuts: ProfileCutItem[],
  standardBarLength: number,
  bladeKerfMeters: number = 0
): ProfileOptimizationResult {
  const barLen = Math.max(0, standardBarLength);
  const kerf = Math.max(0, bladeKerfMeters);

  if (barLen <= 0) {
    return {
      bars: [],
      totalBars: 0,
      totalNetMeters: 0,
      totalPurchasedMeters: 0,
      totalScrapMeters: 0,
      overallEfficiencyPct: 0,
      overallScrapPct: 0,
    };
  }

  // 1. Expandir cortes
  const pieces: InternalPiece[] = [];
  for (const cut of cuts) {
    const qty = Math.max(0, cut.quantity);
    const len = Math.max(0, cut.lengthMeters);
    if (len > 0) {
      for (let i = 0; i < qty; i++) {
        pieces.push({ tag: cut.tag, length: len });
      }
    }
  }

  // 2. Decreasing: Ordenar cortes por longitud descendente
  pieces.sort((a, b) => b.length - a.length);

  // 3. Best Fit Decreasing (BFD)
  const internalBars: InternalBar[] = [];

  for (const piece of pieces) {
    let bestBarIndex = -1;
    let minLeftover = Infinity;

    // Buscar en barras existentes la que deje el menor remanente
    for (let i = 0; i < internalBars.length; i++) {
      const b = internalBars[i];
      const additionalKerf = b.cuts.length > 0 ? kerf : 0;
      const additionalSpaceNeeded = piece.length + additionalKerf;
      const spaceRemaining = barLen - b.consumedLength;

      if (spaceRemaining >= additionalSpaceNeeded - 1e-9) {
        const leftover = spaceRemaining - additionalSpaceNeeded;
        if (leftover < minLeftover) {
          minLeftover = leftover;
          bestBarIndex = i;
        }
      }
    }

    if (bestBarIndex !== -1) {
      const targetBar = internalBars[bestBarIndex];
      const additionalKerf = targetBar.cuts.length > 0 ? kerf : 0;
      targetBar.cuts.push({ tag: piece.tag, length: piece.length });
      targetBar.cutsLengthSum += piece.length;
      targetBar.kerfTotal += additionalKerf;
      targetBar.consumedLength = targetBar.cutsLengthSum + targetBar.kerfTotal;
    } else {
      // Nueva barra
      internalBars.push({
        cuts: [{ tag: piece.tag, length: piece.length }],
        cutsLengthSum: piece.length,
        kerfTotal: 0,
        consumedLength: piece.length,
      });
    }
  }

  // 4. Mapear resultados finales
  const bars: BarCutAllocation[] = internalBars.map((bar, index) => {
    const usedLength = roundTo(bar.cutsLengthSum, 4);
    const scrapLength = roundTo(Math.max(0, barLen - usedLength), 4);
    const efficiencyPct = barLen > 0 ? roundTo(Math.min(100, (usedLength / barLen) * 100), 2) : 0;

    return {
      barIndex: index + 1,
      cuts: bar.cuts.map((c) => ({
        tag: c.tag,
        length: roundTo(c.length, 4),
      })),
      usedLength,
      scrapLength,
      efficiencyPct,
    };
  });

  const totalBars = bars.length;
  const totalNetMeters = roundTo(
    bars.reduce((sum, b) => sum + b.usedLength, 0),
    4
  );
  const totalPurchasedMeters = roundTo(totalBars * barLen, 4);
  const totalScrapMeters = roundTo(Math.max(0, totalPurchasedMeters - totalNetMeters), 4);
  const overallEfficiencyPct =
    totalPurchasedMeters > 0
      ? roundTo(Math.min(100, (totalNetMeters / totalPurchasedMeters) * 100), 2)
      : 0;
  const overallScrapPct =
    totalPurchasedMeters > 0
      ? roundTo(Math.max(0, (totalScrapMeters / totalPurchasedMeters) * 100), 2)
      : 0;

  return {
    bars,
    totalBars,
    totalNetMeters,
    totalPurchasedMeters,
    totalScrapMeters,
    overallEfficiencyPct,
    overallScrapPct,
  };
}
