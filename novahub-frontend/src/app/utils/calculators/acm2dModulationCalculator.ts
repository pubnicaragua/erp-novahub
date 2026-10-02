export interface AcmPanelItem {
  id: string;
  tag: string;
  quantity: number;
  developedWidth: number;
  developedHeight: number;
}

export interface AcmPanelBreakdown {
  id: string;
  tag: string;
  piecesPerSheetNormal: number;
  piecesPerSheetRotated: number;
  bestPiecesPerSheet: number;
  isRotated: boolean;
  requiredSheets: number;
  netArea: number;
}

export interface AcmCalculationResult {
  panelsBreakdown: AcmPanelBreakdown[];
  totalSheets: number;
  totalNetArea: number;
  totalGrossArea: number;
  standardAreaWithWaste: number;
  realWastePct: number;
  standardWastePct: number;
  sheetUnitPrice: number;
  totalCost: number;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Realiza el cálculo técnico de modulación 2D para láminas de ACM,
 * evaluando orientación normal y rotada a 90° para seleccionar el empaquetado óptimo.
 */
export function calculateAcmModulation(
  panels: AcmPanelItem[],
  sheetWidth: number,
  sheetHeight: number,
  sheetCost: number,
  standardWasteRate: number
): AcmCalculationResult {
  const validSheetWidth = Math.max(0, sheetWidth);
  const validSheetHeight = Math.max(0, sheetHeight);
  const validSheetCost = Math.max(0, sheetCost);

  const panelsBreakdown: AcmPanelBreakdown[] = panels.map((panel) => {
    const qty = Math.max(0, panel.quantity);
    const w = Math.max(0, panel.developedWidth);
    const h = Math.max(0, panel.developedHeight);

    // Orientación normal: (sheetWidth / w) x (sheetHeight / h)
    const colsNormal = w > 0 ? Math.floor(validSheetWidth / w) : 0;
    const rowsNormal = h > 0 ? Math.floor(validSheetHeight / h) : 0;
    const piecesPerSheetNormal = colsNormal * rowsNormal;

    // Orientación rotada 90°: (sheetWidth / h) x (sheetHeight / w)
    const colsRotated = h > 0 ? Math.floor(validSheetWidth / h) : 0;
    const rowsRotated = w > 0 ? Math.floor(validSheetHeight / w) : 0;
    const piecesPerSheetRotated = colsRotated * rowsRotated;

    const isRotated = piecesPerSheetRotated > piecesPerSheetNormal;
    const bestPiecesPerSheet = isRotated ? piecesPerSheetRotated : piecesPerSheetNormal;

    const requiredSheets = bestPiecesPerSheet > 0 ? Math.ceil(qty / bestPiecesPerSheet) : 0;
    const netArea = roundTo(w * h * qty, 4);

    return {
      id: panel.id,
      tag: panel.tag,
      piecesPerSheetNormal,
      piecesPerSheetRotated,
      bestPiecesPerSheet,
      isRotated,
      requiredSheets,
      netArea,
    };
  });

  const totalSheets = panelsBreakdown.reduce((sum, p) => sum + p.requiredSheets, 0);
  const totalNetArea = roundTo(
    panelsBreakdown.reduce((sum, p) => sum + p.netArea, 0),
    4
  );

  const sheetArea = validSheetWidth * validSheetHeight;
  const totalGrossArea = roundTo(totalSheets * sheetArea, 4);

  const standardWasteFactor =
    standardWasteRate > 1 ? standardWasteRate / 100 : Math.max(0, standardWasteRate);
  const standardWastePct =
    standardWasteRate > 1 ? standardWasteRate : Math.max(0, standardWasteRate * 100);

  const standardAreaWithWaste = roundTo(totalNetArea * (1 + standardWasteFactor), 4);

  const realWastePct =
    totalGrossArea > 0
      ? roundTo(Math.max(0, ((totalGrossArea - totalNetArea) / totalGrossArea) * 100), 2)
      : 0;

  const totalCost = roundTo(totalSheets * validSheetCost, 2);

  return {
    panelsBreakdown,
    totalSheets,
    totalNetArea,
    totalGrossArea,
    standardAreaWithWaste,
    realWastePct,
    standardWastePct: roundTo(standardWastePct, 2),
    sheetUnitPrice: validSheetCost,
    totalCost,
  };
}
