import { useState, useMemo } from 'react';
import {
  Layers,
  Grid,
  Scissors,
  Maximize2,
  RefreshCw,
  FileSpreadsheet,
  Info,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Eraser,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { toast } from '@/app/services/toast';
import { cn } from '../ui/utils';
import { projectsService } from '@/app/services/projects.service';
import { useTenantQuery } from '@/app/hooks/useTenantQuery';
import { useAuth } from '@/app/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ProyectoMemoriasCalculoPanelProps {
  project: any;
  pricingEngine?: any;
  onSaveOrApply?: (
    type: 'glass' | 'acm' | 'profile' | 'panels' | 'sheets2d' | 'bars1d',
    data: any,
  ) => void;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// -------------------------------------------------------------
// MODELOS Y PLANTILLAS UNIVERSALES
// -------------------------------------------------------------

type MaterialTypePanel =
  | 'Vidrio Templado / Laminado'
  | 'Panel Acrílico / Policarbonato'
  | 'Tablero de Madera / MDF'
  | 'Plancha Metálica / Aluminio'
  | 'Otro';

const PANEL_MATERIAL_OPTIONS: MaterialTypePanel[] = [
  'Vidrio Templado / Laminado',
  'Panel Acrílico / Policarbonato',
  'Tablero de Madera / MDF',
  'Plancha Metálica / Aluminio',
  'Otro',
];

interface FlatPanelRow {
  id: string;
  tag: string;
  quantity: number;
  width: number; // metros
  height: number; // metros
  saques: number; // saques / cortes especiales
  barrenos: number; // perforaciones / barrenos
}

const DEFAULT_PANEL_TEMPLATE: FlatPanelRow[] = [
  { id: 'p-1', tag: 'P-01 Panel Frontal Superior', quantity: 8, width: 1.45, height: 1.05, saques: 2, barrenos: 4 },
  { id: 'p-2', tag: 'P-02 Panel Frontal Inferior', quantity: 6, width: 1.30, height: 1.05, saques: 2, barrenos: 4 },
  { id: 'p-3', tag: 'P-03 Panel Lateral Balcón', quantity: 4, width: 1.15, height: 1.05, saques: 2, barrenos: 4 },
  { id: 'p-4', tag: 'P-04 Remate Descanso', quantity: 2, width: 0.85, height: 0.95, saques: 1, barrenos: 2 },
];

interface SheetPieceRow {
  id: string;
  tag: string;
  quantity: number;
  width: number; // metros
  height: number; // metros
}

const SHEET_MATERIAL_PRESETS = [
  { name: 'ACM / Alucobond (1.50 × 4.98 m)', width: 1.50, height: 4.98, waste: 13.0 },
  { name: 'Triplay / MDF / Melamina (1.22 × 2.44 m)', width: 1.22, height: 2.44, waste: 10.0 },
  { name: 'Gypsum / Fibrocemento (1.22 × 2.44 m)', width: 1.22, height: 2.44, waste: 8.0 },
  { name: 'Plancha Metálica Comercial (1.00 × 2.00 m)', width: 1.00, height: 2.00, waste: 10.0 },
  { name: 'Plancha Metálica Gran Formato (1.20 × 3.00 m)', width: 1.20, height: 3.00, waste: 10.0 },
  { name: 'Acrílico / Policarbonato (1.22 × 2.44 m)', width: 1.22, height: 2.44, waste: 9.0 },
  { name: 'Personalizado / Otro', width: 1.22, height: 2.44, waste: 10.0 },
];

const DEFAULT_SHEET_PIECES: SheetPieceRow[] = [
  { id: 'sp-1', tag: 'MOD-01 Módulo Fachada Principal', quantity: 12, width: 1.45, height: 0.95 },
  { id: 'sp-2', tag: 'MOD-02 Módulo Fachada Lateral', quantity: 8, width: 1.20, height: 0.80 },
  { id: 'sp-3', tag: 'MOD-03 Tapajunta / Remate Frontal', quantity: 6, width: 1.45, height: 0.45 },
  { id: 'sp-4', tag: 'MOD-04 Remate Superior Pretil', quantity: 4, width: 0.95, height: 0.60 },
];

interface BarCutRow {
  id: string;
  element: string;
  length: number; // metros
  quantity: number;
}

const BAR_MATERIAL_PRESETS = [
  { name: 'Perfilería de Aluminio (6.40 m)', length: 6.40, kerf: 0.005 },
  { name: 'Tubo / Perfil Estándar Construcción (6.00 m)', length: 6.00, kerf: 0.003 },
  { name: 'Varilla de Acero Corrugado (12.00 m)', length: 12.00, kerf: 0.002 },
  { name: 'Tubería PVC / Conduit / Cobre (3.00 m)', length: 3.00, kerf: 0.003 },
  { name: 'Personalizado', length: 6.00, kerf: 0.003 },
];

const DEFAULT_BAR_CUTS: BarCutRow[] = [
  { id: 'bc-1', element: 'Parante Principal #1', length: 2.45, quantity: 14 },
  { id: 'bc-2', element: 'Travesaño Superior', length: 1.80, quantity: 10 },
  { id: 'bc-3', element: 'Junquillo de Sujeción', length: 1.15, quantity: 18 },
  { id: 'bc-4', element: 'Refuerzo de Esquina', length: 0.95, quantity: 6 },
];

const CUT_COLORS = [
  'bg-blue-500/20 text-blue-700 border-blue-400 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700',
  'bg-emerald-500/20 text-emerald-700 border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700',
  'bg-violet-500/20 text-violet-700 border-violet-400 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-700',
  'bg-amber-500/20 text-amber-700 border-amber-400 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700',
  'bg-cyan-500/20 text-cyan-700 border-cyan-400 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-700',
  'bg-rose-500/20 text-rose-700 border-rose-400 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700',
  'bg-indigo-500/20 text-indigo-700 border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-700',
];

interface SavedProjectCalculations {
  panels?: {
    materialType?: MaterialTypePanel;
    customMaterial?: string;
    panels?: FlatPanelRow[];
    provisionPct?: number;
    basePricePerM2?: number;
    notchCost?: number;
    holeCost?: number;
    edgePolishCost?: number;
  };
  glass?: {
    panels?: FlatPanelRow[];
    provisionPct?: number;
    unitPrice?: number;
  };
  sheets2d?: {
    materialPreset?: string;
    customMaterial?: string;
    sheetWidth?: number;
    sheetHeight?: number;
    theoreticalWastePct?: number;
    pieces?: SheetPieceRow[];
  };
  acm?: {
    panels?: SheetPieceRow[];
    sheetWidth?: number;
    sheetHeight?: number;
    theoreticalWastePct?: number;
  };
  bars1d?: {
    materialPreset?: string;
    customMaterial?: string;
    barLength?: number;
    kerfLoss?: number;
    cuts?: BarCutRow[];
  };
  profile?: {
    cuts?: BarCutRow[];
    barLength?: number;
    kerfLoss?: number;
  };
}

export function ProyectoMemoriasCalculoPanel(props: ProyectoMemoriasCalculoPanelProps) {
  const { user } = useAuth();
  const projectId = props.project?.id as string | undefined;
  const query = useTenantQuery(
    ['projects', projectId, 'calculation-memory'],
    (signal) => projectsService.getCalculationMemory<SavedProjectCalculations>(projectId!, signal),
    { enabled: Boolean(projectId), staleTime: 0 },
  );
  if (!projectId) return <p role="alert">Selecciona un proyecto para cargar sus memorias de cálculo.</p>;
  if (query.isPending || (query.isFetching && !query.isFetchedAfterMount)) return <p role="status" className="text-sm text-muted-foreground">Cargando memorias de cálculo…</p>;
  if (query.isError) return (
    <div role="alert" className="space-y-3">
      <p>No se pudieron cargar las memorias de cálculo.</p>
      <Button variant="outline" onClick={() => void query.refetch()}>Reintentar</Button>
    </div>
  );
  return <ProjectCalculationMemoryEditor key={`${user?.clientTenantId || user?.tenantId || 'current'}:${projectId}`} {...props} initialSaved={query.data?.data || null} />;
}

function ProjectCalculationMemoryEditor({
  project,
  pricingEngine,
  onSaveOrApply,
  initialSaved,
}: ProyectoMemoriasCalculoPanelProps & { initialSaved: SavedProjectCalculations | null }) {
  const projectId = project.id as string;
  const { canPerform, user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const [activeSubTab, setActiveSubTab] = useState<'panels' | 'sheets2d' | 'bars1d'>('panels');

  // -------------------------------------------------------------
  // ESTADO - SUB-PESTAÑA 1: PANELES PLANOS
  // -------------------------------------------------------------
  const [panelMaterialType, setPanelMaterialType] = useState<MaterialTypePanel>(
    () => initialSaved?.panels?.materialType || 'Vidrio Templado / Laminado',
  );
  const [customPanelMaterial, setCustomPanelMaterial] = useState<string>(
    () => initialSaved?.panels?.customMaterial || '',
  );
  const [flatPanels, setFlatPanels] = useState<FlatPanelRow[]>(() => {
    if (initialSaved?.panels?.panels) return initialSaved.panels.panels;
    if (initialSaved?.glass?.panels) return initialSaved.glass.panels;
    return DEFAULT_PANEL_TEMPLATE;
  });
  const [panelProvisionPct, setPanelProvisionPct] = useState<number>(() => {
    if (initialSaved?.panels?.provisionPct !== undefined) return initialSaved.panels.provisionPct;
    if (initialSaved?.glass?.provisionPct !== undefined) return initialSaved.glass.provisionPct;
    return 5;
  });
  const [panelBasePricePerM2, setPanelBasePricePerM2] = useState<number>(() => {
    if (initialSaved?.panels?.basePricePerM2 !== undefined) return initialSaved.panels.basePricePerM2;
    if (initialSaved?.glass?.unitPrice !== undefined) return initialSaved.glass.unitPrice;
    return Number(pricingEngine?.glassAppliedPrice ?? pricingEngine?.glassTierMediumPrice ?? 69.0);
  });
  const [panelNotchCost, setPanelNotchCost] = useState<number>(
    () => initialSaved?.panels?.notchCost ?? 5.0,
  );
  const [panelHoleCost, setPanelHoleCost] = useState<number>(
    () => initialSaved?.panels?.holeCost ?? 2.5,
  );
  const [panelEdgePolishCost, setPanelEdgePolishCost] = useState<number>(
    () => initialSaved?.panels?.edgePolishCost ?? 3.0,
  );

  // -------------------------------------------------------------
  // ESTADO - SUB-PESTAÑA 2: LÁMINAS Y TABLEROS (2D)
  // -------------------------------------------------------------
  const [sheetMaterialPreset, setSheetMaterialPreset] = useState<string>(
    () => initialSaved?.sheets2d?.materialPreset || SHEET_MATERIAL_PRESETS[0].name,
  );
  const [sheetMaterialName, setSheetMaterialName] = useState<string>(
    () => initialSaved?.sheets2d?.customMaterial || 'ACM / Panel Compuesto',
  );
  const [sheetWidth, setSheetWidth] = useState<number>(() => {
    if (initialSaved?.sheets2d?.sheetWidth !== undefined) return initialSaved.sheets2d.sheetWidth;
    if (initialSaved?.acm?.sheetWidth !== undefined) return initialSaved.acm.sheetWidth;
    return 1.50;
  });
  const [sheetHeight, setSheetHeight] = useState<number>(() => {
    if (initialSaved?.sheets2d?.sheetHeight !== undefined) return initialSaved.sheets2d.sheetHeight;
    if (initialSaved?.acm?.sheetHeight !== undefined) return initialSaved.acm.sheetHeight;
    return 4.98;
  });
  const [theoreticalWastePct, setTheoreticalWastePct] = useState<number>(() => {
    if (initialSaved?.sheets2d?.theoreticalWastePct !== undefined) return initialSaved.sheets2d.theoreticalWastePct;
    if (initialSaved?.acm?.theoreticalWastePct !== undefined) return initialSaved.acm.theoreticalWastePct;
    return 13.0;
  });
  const [sheetPieces, setSheetPieces] = useState<SheetPieceRow[]>(() => {
    if (initialSaved?.sheets2d?.pieces) return initialSaved.sheets2d.pieces;
    if (initialSaved?.acm?.panels) return initialSaved.acm.panels;
    return DEFAULT_SHEET_PIECES;
  });

  // -------------------------------------------------------------
  // ESTADO - SUB-PESTAÑA 3: PERFILES Y BARRAS (1D)
  // -------------------------------------------------------------
  const [barMaterialPreset, setBarMaterialPreset] = useState<string>(
    () => initialSaved?.bars1d?.materialPreset || BAR_MATERIAL_PRESETS[0].name,
  );
  const [barMaterialName, setBarMaterialName] = useState<string>(
    () => initialSaved?.bars1d?.customMaterial || 'Perfilería de Aluminio',
  );
  const [barLength, setBarLength] = useState<number>(() => {
    if (initialSaved?.bars1d?.barLength !== undefined) return initialSaved.bars1d.barLength;
    if (initialSaved?.profile?.barLength !== undefined) return initialSaved.profile.barLength;
    return 6.40;
  });
  const [kerfLoss, setKerfLoss] = useState<number>(() => {
    if (initialSaved?.bars1d?.kerfLoss !== undefined) return initialSaved.bars1d.kerfLoss;
    if (initialSaved?.profile?.kerfLoss !== undefined) return initialSaved.profile.kerfLoss;
    return 0.003;
  });
  const [barCuts, setBarCuts] = useState<BarCutRow[]>(() => {
    if (initialSaved?.bars1d?.cuts) return initialSaved.bars1d.cuts;
    if (initialSaved?.profile?.cuts) return initialSaved.profile.cuts;
    return DEFAULT_BAR_CUTS;
  });

  // -------------------------------------------------------------
  // CÁLCULOS: SUB-PESTAÑA 1 (PANELES PLANOS)
  // -------------------------------------------------------------
  const panelCalculations = useMemo(() => {
    const rowDetails = flatPanels.map((p) => {
      const areaUnit = Math.max(0, p.width * p.height);
      const areaTotal = areaUnit * p.quantity;
      const perimeterUnit = Math.max(0, 2 * (p.width + p.height));
      const perimeterTotal = perimeterUnit * p.quantity;
      const saquesTotal = Math.max(0, p.saques * p.quantity);
      const barrenosTotal = Math.max(0, p.barrenos * p.quantity);

      return {
        ...p,
        areaUnit,
        areaTotal,
        perimeterUnit,
        perimeterTotal,
        saquesTotal,
        barrenosTotal,
      };
    });

    const totalNetArea = rowDetails.reduce((sum, r) => sum + r.areaTotal, 0);
    const totalPolishedMl = rowDetails.reduce((sum, r) => sum + r.perimeterTotal, 0);
    const totalSaques = rowDetails.reduce((sum, r) => sum + r.saquesTotal, 0);
    const totalBarrenos = rowDetails.reduce((sum, r) => sum + r.barrenosTotal, 0);

    const totalToBuyArea = totalNetArea * (1 + panelProvisionPct / 100);
    const materialCost = totalToBuyArea * panelBasePricePerM2;
    const notchesCost = totalSaques * panelNotchCost;
    const holesCost = totalBarrenos * panelHoleCost;
    const edgePolishCostTotal = totalPolishedMl * panelEdgePolishCost;
    const totalEstimatedCost = materialCost + notchesCost + holesCost + edgePolishCostTotal;

    return {
      rows: rowDetails,
      totalNetArea,
      totalToBuyArea,
      totalPolishedMl,
      totalSaques,
      totalBarrenos,
      materialCost,
      notchesCost,
      holesCost,
      edgePolishCostTotal,
      totalEstimatedCost,
    };
  }, [
    flatPanels,
    panelProvisionPct,
    panelBasePricePerM2,
    panelNotchCost,
    panelHoleCost,
    panelEdgePolishCost,
  ]);

  // -------------------------------------------------------------
  // CÁLCULOS: SUB-PESTAÑA 2 (OPTIMIZADOR 2D LÁMINAS Y TABLEROS)
  // -------------------------------------------------------------
  const sheetCalculations = useMemo(() => {
    const singleSheetArea = Math.max(0, sheetWidth * sheetHeight);

    const rowsWithOrientations = sheetPieces.map((piece) => {
      const pieceArea = Math.max(0, piece.width * piece.height);
      const totalPieceArea = pieceArea * piece.quantity;

      // Normal (0°)
      const colsNormal = piece.width > 0 ? Math.floor(sheetWidth / piece.width) : 0;
      const rowsNormal = piece.height > 0 ? Math.floor(sheetHeight / piece.height) : 0;
      const piecesNormal = colsNormal * rowsNormal;

      // Rotada (90°)
      const colsRotated = piece.height > 0 ? Math.floor(sheetWidth / piece.height) : 0;
      const rowsRotated = piece.width > 0 ? Math.floor(sheetHeight / piece.width) : 0;
      const piecesRotated = colsRotated * rowsRotated;

      let bestOrientation: 'normal' | 'rotated' | 'equal' = 'equal';
      if (piecesNormal > piecesRotated) bestOrientation = 'normal';
      else if (piecesRotated > piecesNormal) bestOrientation = 'rotated';

      return {
        ...piece,
        pieceArea,
        totalPieceArea,
        colsNormal,
        rowsNormal,
        piecesNormal,
        colsRotated,
        rowsRotated,
        piecesRotated,
        bestOrientation,
      };
    });

    const totalNetArea = rowsWithOrientations.reduce((sum, r) => sum + r.totalPieceArea, 0);
    const totalPieces = rowsWithOrientations.reduce((sum, r) => sum + r.quantity, 0);

    // Algoritmo de empaquetado 2D por estantes (Shelf Best-Fit Decreasing)
    interface ExpandedPiece {
      tag: string;
      w: number;
      h: number;
    }
    const pieces: ExpandedPiece[] = [];
    for (const p of sheetPieces) {
      for (let i = 0; i < p.quantity; i++) {
        if (p.width > 0 && p.height > 0) {
          pieces.push({ tag: p.tag, w: p.width, h: p.height });
        }
      }
    }

    // Ordenar piezas por dimensión máxima descendente
    pieces.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));

    interface Shelf {
      y: number;
      height: number;
      widthUsed: number;
    }
    interface Sheet {
      shelves: Shelf[];
    }

    const sheets: Sheet[] = [];

    for (const piece of pieces) {
      let placed = false;

      // Evaluar ambas orientaciones: normal (w, h) y rotada 90° (h, w)
      const orientations: Array<{ pw: number; ph: number }> = [
        { pw: piece.w, ph: piece.h },
        { pw: piece.h, ph: piece.w },
      ];

      const validOrientations = orientations.filter(
        (o) => o.pw <= sheetWidth && o.ph <= sheetHeight,
      );

      if (validOrientations.length === 0) {
        continue;
      }

      // Intentar colocar en estantes existentes
      for (const sheet of sheets) {
        for (const shelf of sheet.shelves) {
          for (const opt of validOrientations) {
            if (shelf.widthUsed + opt.pw <= sheetWidth && opt.ph <= shelf.height) {
              shelf.widthUsed += opt.pw;
              placed = true;
              break;
            }
          }
          if (placed) break;
        }
        if (placed) break;

        // Intentar crear nuevo estante en la lámina actual
        const currentSheetHeightUsed = sheet.shelves.reduce((acc, s) => acc + s.height, 0);
        for (const opt of validOrientations) {
          if (currentSheetHeightUsed + opt.ph <= sheetHeight && opt.pw <= sheetWidth) {
            sheet.shelves.push({
              y: currentSheetHeightUsed,
              height: opt.ph,
              widthUsed: opt.pw,
            });
            placed = true;
            break;
          }
        }
        if (placed) break;
      }

      // Si no cupo en ninguna lámina abierta, abrir una nueva lámina
      if (!placed) {
        const bestOpt = validOrientations[0];
        sheets.push({
          shelves: [
            {
              y: 0,
              height: bestOpt.ph,
              widthUsed: bestOpt.pw,
            },
          ],
        });
      }
    }

    const theoreticalMinSheets =
      singleSheetArea > 0
        ? Math.ceil(totalNetArea / (singleSheetArea * Math.max(0.01, 1 - theoreticalWastePct / 100)))
        : 0;

    const totalSheetsRequired = Math.max(sheets.length, theoreticalMinSheets);
    const totalGrossArea = totalSheetsRequired * singleSheetArea;
    const realWastePct =
      totalGrossArea > 0 ? Math.max(0, ((totalGrossArea - totalNetArea) / totalGrossArea) * 100) : 0;
    const wasteDelta = realWastePct - theoreticalWastePct;

    return {
      rows: rowsWithOrientations,
      singleSheetArea,
      totalNetArea,
      totalGrossArea,
      totalPieces,
      totalSheetsRequired,
      realWastePct,
      wasteDelta,
    };
  }, [sheetPieces, sheetWidth, sheetHeight, theoreticalWastePct]);

  // -------------------------------------------------------------
  // CÁLCULOS: SUB-PESTAÑA 3 (OPTIMIZADOR 1D PERFILES Y BARRAS BFD)
  // -------------------------------------------------------------
  const barCalculations = useMemo(() => {
    interface PieceToCut {
      id: string;
      element: string;
      length: number;
      colorIndex: number;
    }

    const allPieces: PieceToCut[] = [];
    let invalidCutCount = 0;

    barCuts.forEach((cut, idx) => {
      for (let i = 0; i < cut.quantity; i++) {
        if (cut.length > barLength) {
          invalidCutCount++;
        } else if (cut.length > 0) {
          allPieces.push({
            id: `${cut.id}-${i}`,
            element: cut.element,
            length: cut.length,
            colorIndex: idx % CUT_COLORS.length,
          });
        }
      }
    });

    const netLinearMeters = allPieces.reduce((sum, p) => sum + p.length, 0);

    // Best Fit Decreasing (BFD):
    // 1. Ordenar cortes por longitud descendente
    allPieces.sort((a, b) => b.length - a.length);

    interface BarCut {
      id: string;
      element: string;
      length: number;
      colorIndex: number;
    }

    interface BarResult {
      barIndex: number;
      cuts: BarCut[];
      cutsLengthSum: number;
      kerfTotal: number;
      usedLength: number;
      wasteLength: number;
      efficiencyPct: number;
    }

    const bars: BarResult[] = [];

    allPieces.forEach((piece) => {
      let bestBarIndex = -1;
      let minLeftover = Infinity;

      // Buscar barra existente con mejor ajuste (menor sobrante tras corte + kerf)
      for (let b = 0; b < bars.length; b++) {
        const bar = bars[b];
        const addedKerf = bar.cuts.length > 0 ? kerfLoss : 0;
        const remaining = bar.wasteLength;
        const needed = piece.length + addedKerf;

        if (remaining >= needed) {
          const leftoverAfter = remaining - needed;
          if (leftoverAfter < minLeftover) {
            minLeftover = leftoverAfter;
            bestBarIndex = b;
          }
        }
      }

      if (bestBarIndex !== -1) {
        const targetBar = bars[bestBarIndex];
        const addedKerf = targetBar.cuts.length > 0 ? kerfLoss : 0;
        targetBar.cuts.push(piece);
        targetBar.cutsLengthSum += piece.length;
        targetBar.kerfTotal += addedKerf;
        targetBar.usedLength = targetBar.cutsLengthSum + targetBar.kerfTotal;
        targetBar.wasteLength = Math.max(0, barLength - targetBar.usedLength);
        targetBar.efficiencyPct = Math.min(100, (targetBar.cutsLengthSum / barLength) * 100);
      } else {
        const newBar: BarResult = {
          barIndex: bars.length + 1,
          cuts: [piece],
          cutsLengthSum: piece.length,
          kerfTotal: 0,
          usedLength: piece.length,
          wasteLength: Math.max(0, barLength - piece.length),
          efficiencyPct: Math.min(100, (piece.length / barLength) * 100),
        };
        bars.push(newBar);
      }
    });

    const totalBarsRequired = bars.length;
    const totalGrossLength = totalBarsRequired * barLength;
    const totalWasteMeters = Math.max(0, totalGrossLength - netLinearMeters);
    const globalEfficiencyPct =
      totalGrossLength > 0 ? (netLinearMeters / totalGrossLength) * 100 : 0;

    return {
      bars,
      totalBarsRequired,
      netLinearMeters,
      totalGrossLength,
      totalWasteMeters,
      globalEfficiencyPct,
      invalidCutCount,
    };
  }, [barCuts, barLength, kerfLoss]);

  // -------------------------------------------------------------
  // ACCIONES GLOBALES: GUARDAR EN PROYECTO
  // -------------------------------------------------------------
  const handleSaveToProject = async () => {
    if (saving || !canPerform('PROJECTS', 'edit')) return;
    setSaving(true);
    try {
      const payload = {
        updatedAt: new Date().toISOString(),
        panels: {
          materialType: panelMaterialType,
          customMaterial: customPanelMaterial,
          panels: flatPanels,
          provisionPct: panelProvisionPct,
          basePricePerM2: panelBasePricePerM2,
          notchCost: panelNotchCost,
          holeCost: panelHoleCost,
          edgePolishCost: panelEdgePolishCost,
          summary: {
            netArea: panelCalculations.totalNetArea,
            totalToBuyArea: panelCalculations.totalToBuyArea,
            polishedMl: panelCalculations.totalPolishedMl,
            saques: panelCalculations.totalSaques,
            barrenos: panelCalculations.totalBarrenos,
            estimatedCost: panelCalculations.totalEstimatedCost,
          },
        },
        sheets2d: {
          materialPreset: sheetMaterialPreset,
          customMaterial: sheetMaterialName,
          sheetWidth,
          sheetHeight,
          theoreticalWastePct,
          pieces: sheetPieces,
          summary: {
            netArea: sheetCalculations.totalNetArea,
            grossArea: sheetCalculations.totalGrossArea,
            sheetsRequired: sheetCalculations.totalSheetsRequired,
            realWastePct: sheetCalculations.realWastePct,
          },
        },
        bars1d: {
          materialPreset: barMaterialPreset,
          customMaterial: barMaterialName,
          barLength,
          kerfLoss,
          cuts: barCuts,
          summary: {
            totalBars: barCalculations.totalBarsRequired,
            netMeters: barCalculations.netLinearMeters,
            wasteMeters: barCalculations.totalWasteMeters,
            globalEfficiency: barCalculations.globalEfficiencyPct,
          },
        },
        // Compatibilidad hacia atrás
        glass: {
          panels: flatPanels,
          provisionPct: panelProvisionPct,
          unitPrice: panelBasePricePerM2,
          summary: {
            netArea: panelCalculations.totalNetArea,
            totalToBuyArea: panelCalculations.totalToBuyArea,
            polishedMl: panelCalculations.totalPolishedMl,
            saques: panelCalculations.totalSaques,
            barrenos: panelCalculations.totalBarrenos,
            estimatedCost: panelCalculations.totalEstimatedCost,
          },
        },
        acm: {
          panels: sheetPieces,
          sheetWidth,
          sheetHeight,
          theoreticalWastePct,
          summary: {
            netArea: sheetCalculations.totalNetArea,
            grossArea: sheetCalculations.totalGrossArea,
            sheetsRequired: sheetCalculations.totalSheetsRequired,
            realWastePct: sheetCalculations.realWastePct,
          },
        },
        profile: {
          cuts: barCuts,
          barLength,
          kerfLoss,
          summary: {
            totalBars: barCalculations.totalBarsRequired,
            netMeters: barCalculations.netLinearMeters,
            wasteMeters: barCalculations.totalWasteMeters,
            globalEfficiency: barCalculations.globalEfficiencyPct,
          },
        },
      };

      const saved = await projectsService.saveCalculationMemory(projectId, {
        panels: {
          materialType: panelMaterialType,
          customMaterial: customPanelMaterial,
          panels: flatPanels,
          provisionPct: panelProvisionPct,
          basePricePerM2: panelBasePricePerM2,
          notchCost: panelNotchCost,
          holeCost: panelHoleCost,
          edgePolishCost: panelEdgePolishCost,
        },
        sheets2d: {
          materialPreset: sheetMaterialPreset,
          customMaterial: sheetMaterialName,
          sheetWidth,
          sheetHeight,
          theoreticalWastePct,
          pieces: sheetPieces,
        },
        bars1d: {
          materialPreset: barMaterialPreset,
          customMaterial: barMaterialName,
          barLength,
          kerfLoss,
          cuts: barCuts,
        },
      });
      queryClient.setQueryData(
        ['tenant-module', user?.clientTenantId || user?.tenantId || 'current', 'projects', projectId, 'calculation-memory'],
        saved,
      );

      onSaveOrApply?.('panels', payload.panels);
      onSaveOrApply?.('glass', payload.panels);
      onSaveOrApply?.('sheets2d', payload.sheets2d);
      onSaveOrApply?.('acm', payload.sheets2d);
      onSaveOrApply?.('bars1d', payload.bars1d);
      onSaveOrApply?.('profile', payload.bars1d);

      toast.success('Memorias de cálculo guardadas exitosamente en el proyecto');
    } catch {
      toast.error('Ocurrió un error al persistir las memorias de cálculo');
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------
  // ACCIONES SUB-PESTAÑA 1: PANELES PLANOS
  // -------------------------------------------------------------
  const handleAddPanelRow = () => {
    const nextNumber = flatPanels.length + 1;
    setFlatPanels((prev) => [
      ...prev,
      {
        id: `panel-${Date.now()}`,
        tag: `P-${String(nextNumber).padStart(2, '0')} Panel Modular`,
        quantity: 1,
        width: 1.00,
        height: 1.00,
        saques: 0,
        barrenos: 0,
      },
    ]);
  };

  const handleUpdatePanelRow = (
    id: string,
    field: keyof FlatPanelRow,
    value: string | number,
  ) => {
    setFlatPanels((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const numVal = typeof value === 'number' ? value : parseFloat(value) || 0;
        return {
          ...row,
          [field]: field === 'tag' ? value : numVal,
        };
      }),
    );
  };

  const handleDeletePanelRow = (id: string) => {
    setFlatPanels((prev) => prev.filter((row) => row.id !== id));
  };

  const handleClearPanels = () => {
    setFlatPanels([]);
    toast.info('Lista de paneles planos despejada');
  };

  const handleLoadPanelsTemplate = () => {
    setFlatPanels(DEFAULT_PANEL_TEMPLATE);
    setPanelProvisionPct(5);
    toast.info('Plantilla de ejemplo cargada con éxito');
  };

  // -------------------------------------------------------------
  // ACCIONES SUB-PESTAÑA 2: LÁMINAS Y TABLEROS (2D)
  // -------------------------------------------------------------
  const handleSelectSheetPreset = (presetName: string) => {
    setSheetMaterialPreset(presetName);
    const found = SHEET_MATERIAL_PRESETS.find((p) => p.name === presetName);
    if (found) {
      setSheetWidth(found.width);
      setSheetHeight(found.height);
      setTheoreticalWastePct(found.waste);
      if (presetName !== 'Personalizado / Otro') {
        setSheetMaterialName(presetName.split('(')[0].trim());
      }
    }
  };

  const handleAddSheetPieceRow = () => {
    const nextNumber = sheetPieces.length + 1;
    setSheetPieces((prev) => [
      ...prev,
      {
        id: `sp-${Date.now()}`,
        tag: `MOD-${String(nextNumber).padStart(2, '0')} Pieza Estándar`,
        quantity: 1,
        width: 1.00,
        height: 1.00,
      },
    ]);
  };

  const handleUpdateSheetPieceRow = (
    id: string,
    field: keyof SheetPieceRow,
    value: string | number,
  ) => {
    setSheetPieces((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const numVal = typeof value === 'number' ? value : parseFloat(value) || 0;
        return {
          ...row,
          [field]: field === 'tag' ? value : numVal,
        };
      }),
    );
  };

  const handleDeleteSheetPieceRow = (id: string) => {
    setSheetPieces((prev) => prev.filter((row) => row.id !== id));
  };

  const handleClearSheetPieces = () => {
    setSheetPieces([]);
    toast.info('Lista de piezas de láminas despejada');
  };

  const handleLoadSheetTemplate = () => {
    setSheetPieces(DEFAULT_SHEET_PIECES);
    setSheetWidth(1.50);
    setSheetHeight(4.98);
    setTheoreticalWastePct(13.0);
    toast.info('Plantilla de láminas cargada con éxito');
  };

  // -------------------------------------------------------------
  // ACCIONES SUB-PESTAÑA 3: PERFILES Y BARRAS (1D)
  // -------------------------------------------------------------
  const handleSelectBarPreset = (presetName: string) => {
    setBarMaterialPreset(presetName);
    const found = BAR_MATERIAL_PRESETS.find((b) => b.name === presetName);
    if (found) {
      setBarLength(found.length);
      setKerfLoss(found.kerf);
      if (presetName !== 'Personalizado') {
        setBarMaterialName(presetName.split('(')[0].trim());
      }
    }
  };

  const handleAddBarCutRow = () => {
    const nextNumber = barCuts.length + 1;
    setBarCuts((prev) => [
      ...prev,
      {
        id: `bar-${Date.now()}`,
        element: `Elemento #${nextNumber} Corte de Obra`,
        length: 1.50,
        quantity: 1,
      },
    ]);
  };

  const handleUpdateBarCutRow = (
    id: string,
    field: keyof BarCutRow,
    value: string | number,
  ) => {
    setBarCuts((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const numVal = typeof value === 'number' ? value : parseFloat(value) || 0;
        return {
          ...row,
          [field]: field === 'element' ? value : numVal,
        };
      }),
    );
  };

  const handleDeleteBarCutRow = (id: string) => {
    setBarCuts((prev) => prev.filter((row) => row.id !== id));
  };

  const handleClearBarCuts = () => {
    setBarCuts([]);
    toast.info('Lista de cortes de barras despejada');
  };

  const handleLoadBarTemplate = () => {
    setBarCuts(DEFAULT_BAR_CUTS);
    setBarLength(6.40);
    setKerfLoss(0.003);
    toast.info('Plantilla de cortes de barra cargada con éxito');
  };

  const handleResetCurrentTab = () => {
    if (activeSubTab === 'panels') {
      handleLoadPanelsTemplate();
    } else if (activeSubTab === 'sheets2d') {
      handleLoadSheetTemplate();
    } else {
      handleLoadBarTemplate();
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER DEL PANEL */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">Memorias de Cálculo Técnicas</h2>
                <Badge variant="outline" className="border-primary/40 bg-primary/5 text-primary text-[10px] font-bold">
                  Ingeniería & Despiece Universal
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Cubicador universal de paneles planos, anidado 2D de láminas/tableros y optimizador 1D de perfiles/barras
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetCurrentTab}
            className="gap-1.5 rounded-xl border-border/60 text-xs font-semibold"
            title="Restablecer plantilla de ejemplo de la pestaña activa"
          >
            <RefreshCw className="size-3.5" />
            <span>Restablecer Ejemplo</span>
          </Button>

          <Button
            onClick={handleSaveToProject}
            disabled={saving || !canPerform('PROJECTS', 'edit')}
            className="gap-2 rounded-xl bg-primary font-bold shadow-md hover:bg-primary/90"
          >
            <Save className="size-4" />
            <span>{saving ? 'Guardando…' : 'Guardar en el Proyecto'}</span>
          </Button>
        </div>
      </div>

      {/* BANNER INFORMATIVO */}
      <div className="flex items-center gap-2.5 rounded-xl border border-blue-200/60 bg-blue-50/50 p-3 text-xs text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300">
        <Info className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <span>
          Cálculos geométricos universales y paramétricos independientes del rubro de obra (vidriería, carpintería, cerrajería, estructuras y fachadas). Conectados al control de costos y compras.
        </span>
      </div>

      {/* SUB-PESTAÑAS */}
      <Tabs
        value={activeSubTab}
        onValueChange={(val) => setActiveSubTab(val as 'panels' | 'sheets2d' | 'bars1d')}
        className="w-full"
      >
        <TabsList className="inline-flex h-auto w-full flex-wrap justify-start gap-1.5 rounded-2xl border border-border/40 bg-muted/40 p-1.5 backdrop-blur-xs">
          <TabsTrigger
            value="panels"
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Layers className="size-4 text-blue-500" />
            <span>Cubicador y Despiece de Paneles Planos</span>
            <Badge variant="outline" className="ml-1 px-1.5 py-0 text-[10px] font-semibold">
              {flatPanels.length}
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="sheets2d"
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Grid className="size-4 text-emerald-500" />
            <span>Optimizador 2D de Corte de Láminas y Tableros</span>
            <Badge variant="outline" className="ml-1 px-1.5 py-0 text-[10px] font-semibold">
              {sheetCalculations.totalSheetsRequired} lams
            </Badge>
          </TabsTrigger>

          <TabsTrigger
            value="bars1d"
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            <Scissors className="size-4 text-amber-500" />
            <span>Optimizador 1D de Perfiles y Barras</span>
            <Badge variant="outline" className="ml-1 px-1.5 py-0 text-[10px] font-semibold">
              {barCalculations.totalBarsRequired} barras
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------- */}
        {/* SUB-PESTAÑA 1: CUBICADOR Y DESPIECE DE PANELES PLANOS */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="panels" className="mt-4 space-y-4">
          {/* SELECTOR DE MATERIAL Y PARÁMETROS CONFIGURABLES */}
          <Card className="rounded-2xl border-border/60 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Layers className="size-4 text-blue-500" />
                    <span>Configuración de Material y Costos Unitarios</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Selecciona el material plano y define los costos de procesamiento y provisión de desperdicio
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {/* SELECTOR DE TIPO DE MATERIAL */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Tipo de Material:
                  </label>
                  <select
                    value={panelMaterialType}
                    onChange={(e) => setPanelMaterialType(e.target.value as MaterialTypePanel)}
                    className="h-8 w-full rounded-xl border border-border/60 bg-background px-2.5 text-xs font-bold shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  >
                    {PANEL_MATERIAL_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  {panelMaterialType === 'Otro' && (
                    <Input
                      placeholder="Especifica el material..."
                      value={customPanelMaterial}
                      onChange={(e) => setCustomPanelMaterial(e.target.value)}
                      className="mt-1.5 h-7 text-xs font-medium"
                    />
                  )}
                </div>

                {/* PRECIO BASE POR M2 */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Precio base m² (US$):
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={panelBasePricePerM2}
                    onChange={(e) => setPanelBasePricePerM2(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs font-bold"
                  />
                </div>

                {/* COSTO DE SAQUE */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Costo saque/corte (US$):
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={panelNotchCost}
                    onChange={(e) => setPanelNotchCost(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs font-bold"
                  />
                </div>

                {/* COSTO DE PERFORACIÓN */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Costo perforación (US$):
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={0.25}
                    value={panelHoleCost}
                    onChange={(e) => setPanelHoleCost(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs font-bold"
                  />
                </div>

                {/* COSTO CANTEADO / PULIDO POR ML */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Canteado/Pulido $/ml:
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={0.25}
                    value={panelEdgePolishCost}
                    onChange={(e) => setPanelEdgePolishCost(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Provisión rotura / desperdicio:
                  </span>
                  <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/20 px-2 py-0.5">
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      step={1}
                      value={panelProvisionPct}
                      onChange={(e) => setPanelProvisionPct(parseFloat(e.target.value) || 0)}
                      className="h-6 w-14 border-0 bg-transparent text-right text-xs font-bold focus-visible:ring-0"
                    />
                    <span className="text-xs font-bold">%</span>
                  </div>
                </div>

                <Badge variant="outline" className="border-border/60 bg-muted/20 text-xs">
                  Material activo: <strong className="ml-1 text-foreground">{panelMaterialType === 'Otro' && customPanelMaterial ? customPanelMaterial : panelMaterialType}</strong>
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* TARJETAS RESUMEN DE PANELES */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Card className="rounded-2xl border-border/60 shadow-xs">
              <CardContent className="p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Área Neta Total
                </p>
                <p className="mt-1 text-xl font-black tracking-tight text-blue-600 dark:text-blue-400">
                  {panelCalculations.totalNetArea.toFixed(2)} m²
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Suma exacta de paneles</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/60 shadow-xs">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    A Comprar (Provisión)
                  </p>
                  <span className="text-[10px] font-bold text-muted-foreground">+{panelProvisionPct}%</span>
                </div>
                <p className="mt-1 text-xl font-black tracking-tight text-foreground">
                  {panelCalculations.totalToBuyArea.toFixed(2)} m²
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Área con merma provista</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/60 shadow-xs">
              <CardContent className="p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Canteado / Pulido
                </p>
                <p className="mt-1 text-xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                  {panelCalculations.totalPolishedMl.toFixed(2)} ml
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Perímetro total acumulado</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/60 shadow-xs">
              <CardContent className="p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Saques / Cortes
                </p>
                <p className="mt-1 text-xl font-black tracking-tight text-amber-600 dark:text-amber-400">
                  {panelCalculations.totalSaques} uds
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Muescas / destajes</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/60 shadow-xs">
              <CardContent className="p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Perforaciones / Barrenos
                </p>
                <p className="mt-1 text-xl font-black tracking-tight text-violet-600 dark:text-violet-400">
                  {panelCalculations.totalBarrenos} uds
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Fijaciones y pasantes</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/60 shadow-xs bg-primary/5 dark:bg-primary/10">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                    Costo Total Estimado
                  </p>
                  <span className="text-[10px] font-mono text-muted-foreground">${panelBasePricePerM2}/m²</span>
                </div>
                <p className="mt-1 text-xl font-black tracking-tight text-primary">
                  ${panelCalculations.totalEstimatedCost.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Incluye material + procesos
                </p>
              </CardContent>
            </Card>
          </div>

          {/* TABLA EDITABLE Y CONTROLES */}
          <Card className="rounded-2xl border-border/60 shadow-xs">
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Maximize2 className="size-4 text-blue-500" />
                  <span>Listado de Paneles y Dimensiones de Despiece</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Especifica dimensiones de corte, saques especiales, perforaciones y perímetro de canteado o pulido
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearPanels}
                  className="gap-1.5 rounded-xl border-border/60 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
                  title="Limpiar toda la tabla de paneles"
                >
                  <Eraser className="size-3.5" />
                  <span>Limpiar</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadPanelsTemplate}
                  className="gap-1.5 rounded-xl border-dashed text-xs font-bold"
                >
                  <Sparkles className="size-3.5 text-amber-500" />
                  <span>Cargar Ejemplo</span>
                </Button>

                <Button
                  size="sm"
                  onClick={handleAddPanelRow}
                  className="gap-1.5 rounded-xl text-xs font-bold"
                >
                  <Plus className="size-3.5" />
                  <span>+ Añadir Panel</span>
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto rounded-xl border border-border/50">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="w-[200px] text-xs font-bold">Tag / Identificador</TableHead>
                      <TableHead className="w-[85px] text-center text-xs font-bold">Cant.</TableHead>
                      <TableHead className="w-[95px] text-center text-xs font-bold">Ancho (m)</TableHead>
                      <TableHead className="w-[95px] text-center text-xs font-bold">Alto (m)</TableHead>
                      <TableHead className="w-[90px] text-center text-xs font-bold">Saques / Cortes</TableHead>
                      <TableHead className="w-[90px] text-center text-xs font-bold">Perforaciones</TableHead>
                      <TableHead className="w-[120px] text-right text-xs font-bold">Canteado / Pulido (ml)</TableHead>
                      <TableHead className="w-[130px] text-right text-xs font-bold">Área (m²)</TableHead>
                      <TableHead className="w-[50px] text-center text-xs font-bold">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {panelCalculations.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-8 text-center text-xs text-muted-foreground">
                          No hay paneles registrados. Haz clic en &quot;+ Añadir Panel&quot; o carga el ejemplo.
                        </TableCell>
                      </TableRow>
                    ) : (
                      panelCalculations.rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="p-2">
                            <Input
                              value={row.tag}
                              onChange={(e) => handleUpdatePanelRow(row.id, 'tag', e.target.value)}
                              className="h-8 text-xs font-medium"
                              placeholder="Ej. P-01 Frontal"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              min={1}
                              value={row.quantity}
                              onChange={(e) => handleUpdatePanelRow(row.id, 'quantity', e.target.value)}
                              className="h-8 text-center text-xs font-bold"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              min={0.01}
                              step={0.01}
                              value={row.width}
                              onChange={(e) => handleUpdatePanelRow(row.id, 'width', e.target.value)}
                              className="h-8 text-center text-xs font-mono"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              min={0.01}
                              step={0.01}
                              value={row.height}
                              onChange={(e) => handleUpdatePanelRow(row.id, 'height', e.target.value)}
                              className="h-8 text-center text-xs font-mono"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              min={0}
                              value={row.saques}
                              onChange={(e) => handleUpdatePanelRow(row.id, 'saques', e.target.value)}
                              className="h-8 text-center text-xs font-mono"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              min={0}
                              value={row.barrenos}
                              onChange={(e) => handleUpdatePanelRow(row.id, 'barrenos', e.target.value)}
                              className="h-8 text-center text-xs font-mono"
                            />
                          </TableCell>
                          <TableCell className="p-2 text-right">
                            <span className="font-mono text-xs font-bold text-foreground">
                              {row.perimeterTotal.toFixed(2)} ml
                            </span>
                            <div className="text-[10px] text-muted-foreground">
                              ({row.perimeterUnit.toFixed(2)} ml c/u)
                            </div>
                          </TableCell>
                          <TableCell className="p-2 text-right">
                            <span className="font-mono text-xs font-bold text-foreground">
                              {row.areaTotal.toFixed(3)} m²
                            </span>
                            <div className="text-[10px] text-muted-foreground">
                              ({row.areaUnit.toFixed(2)} m² c/u)
                            </div>
                          </TableCell>
                          <TableCell className="p-2 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeletePanelRow(row.id)}
                              className="size-7 text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
                              title="Eliminar panel"
                              aria-label="Eliminar panel"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* SUB-PESTAÑA 2: OPTIMIZADOR 2D DE CORTE DE LÁMINAS Y TABLEROS */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="sheets2d" className="mt-4 space-y-4">
          {/* CONFIGURACIÓN Y COMPARATIVA VISUAL DE MERMA */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* CONFIGURACIÓN DE LÁMINA */}
            <Card className="rounded-2xl border-border/60 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Grid className="size-4 text-emerald-500" />
                  <span>Configuración de Lámina Estándar</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Ajusta dimensiones comerciales del material en planchas o tableros
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* SELECTOR DE PRESET / TIPO DE MATERIAL */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Preset / Tipo de Material:
                  </label>
                  <select
                    value={sheetMaterialPreset}
                    onChange={(e) => handleSelectSheetPreset(e.target.value)}
                    className="h-8 w-full rounded-xl border border-border/60 bg-background px-2.5 text-xs font-bold shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  >
                    {SHEET_MATERIAL_PRESETS.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Nombre del Material / Descripción:
                  </label>
                  <Input
                    value={sheetMaterialName}
                    onChange={(e) => setSheetMaterialName(e.target.value)}
                    placeholder="Ej. ACM, Triplay, MDF, Plancha..."
                    className="h-8 text-xs font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Ancho lámina (m)</span>
                    <Input
                      type="number"
                      step={0.01}
                      min={0.1}
                      value={sheetWidth}
                      onChange={(e) => setSheetWidth(parseFloat(e.target.value) || 0)}
                      className="mt-1 h-8 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Largo / Alto (m)</span>
                    <Input
                      type="number"
                      step={0.01}
                      min={0.1}
                      value={sheetHeight}
                      onChange={(e) => setSheetHeight(parseFloat(e.target.value) || 0)}
                      className="mt-1 h-8 text-xs font-bold"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-muted-foreground">Merma teórica estimada</span>
                    <span className="font-bold">{theoreticalWastePct}%</span>
                  </div>
                  <Input
                    type="number"
                    step={0.5}
                    min={0}
                    max={50}
                    value={theoreticalWastePct}
                    onChange={(e) => setTheoreticalWastePct(parseFloat(e.target.value) || 0)}
                    className="mt-1 h-8 text-xs font-bold"
                  />
                </div>

                <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Área Bruta por Lámina:</span>
                    <span className="font-mono font-bold text-foreground">
                      {sheetCalculations.singleSheetArea.toFixed(2)} m²
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* COMPARATIVA VISUAL: MERMA REAL VS TEÓRICA */}
            <Card className="rounded-2xl border-border/60 shadow-xs lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Sparkles className="size-4 text-primary" />
                      <span>Comparativa de Eficiencia: Merma Real vs Estimada</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Evaluación ortogonal 2D considerando orientación normal (0°) y rotada (90°)
                    </CardDescription>
                  </div>

                  <Badge
                    variant="outline"
                    className={cn(
                      'px-2.5 py-1 text-xs font-bold',
                      sheetCalculations.realWastePct <= theoreticalWastePct
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
                    )}
                  >
                    {sheetCalculations.realWastePct <= theoreticalWastePct ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" />
                        Óptimo (Dentro de lo estimado)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="size-3.5" />
                        Alerta de Desperdicio (+{sheetCalculations.wasteDelta.toFixed(1)}%)
                      </span>
                    )}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Láminas Necesarias
                    </p>
                    <p className="mt-1 text-xl font-black text-foreground">
                      {sheetCalculations.totalSheetsRequired} uds
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {sheetWidth.toFixed(2)}m × {sheetHeight.toFixed(2)}m
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Área Neta Requerida
                    </p>
                    <p className="mt-1 text-xl font-black text-blue-600 dark:text-blue-400">
                      {sheetCalculations.totalNetArea.toFixed(2)} m²
                    </p>
                    <p className="text-[10px] text-muted-foreground">Total piezas requeridas</p>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Área Bruta a Comprar
                    </p>
                    <p className="mt-1 text-xl font-black text-foreground">
                      {sheetCalculations.totalGrossArea.toFixed(2)} m²
                    </p>
                    <p className="text-[10px] text-muted-foreground">Láminas completas</p>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Merma Real Calculada
                    </p>
                    <p
                      className={cn(
                        'mt-1 text-xl font-black',
                        sheetCalculations.realWastePct <= theoreticalWastePct
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400',
                      )}
                    >
                      {sheetCalculations.realWastePct.toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Ref. estimada: {theoreticalWastePct}%
                    </p>
                  </div>
                </div>

                {/* BARRA VISUAL DE COMPARACIÓN */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-muted-foreground">
                      Aprovechamiento vs Merma de Lámina:
                    </span>
                    <span className="font-mono text-xs">
                      Útil: {(100 - sheetCalculations.realWastePct).toFixed(1)}% · Desperdicio: {sheetCalculations.realWastePct.toFixed(1)}%
                    </span>
                  </div>

                  <div className="relative h-4 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${Math.max(0, 100 - sheetCalculations.realWastePct)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Área útil neta: {sheetCalculations.totalNetArea.toFixed(2)} m²</span>
                    <span>
                      Merma total calculada: {(sheetCalculations.totalGrossArea - sheetCalculations.totalNetArea).toFixed(2)} m²
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* TABLA DE PIEZAS REQUERIDAS */}
          <Card className="rounded-2xl border-border/60 shadow-xs">
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-bold">Piezas Requeridas en Lámina</CardTitle>
                <CardDescription className="text-xs">
                  Dimensiones útiles y análisis de orientación óptima por pieza (0° vs 90°)
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearSheetPieces}
                  className="gap-1.5 rounded-xl border-border/60 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
                  title="Limpiar lista de piezas"
                >
                  <Eraser className="size-3.5" />
                  <span>Limpiar</span>
                </Button>

                <Button
                  size="sm"
                  onClick={handleAddSheetPieceRow}
                  className="gap-1.5 rounded-xl text-xs font-bold"
                >
                  <Plus className="size-3.5" />
                  <span>+ Añadir Pieza</span>
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto rounded-xl border border-border/50">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="w-[220px] text-xs font-bold">Tag / Pieza</TableHead>
                      <TableHead className="w-[90px] text-center text-xs font-bold">Cant.</TableHead>
                      <TableHead className="w-[100px] text-center text-xs font-bold">Ancho útil (m)</TableHead>
                      <TableHead className="w-[100px] text-center text-xs font-bold">Alto útil (m)</TableHead>
                      <TableHead className="w-[110px] text-right text-xs font-bold">Área Neta</TableHead>
                      <TableHead className="w-[130px] text-center text-xs font-bold">Pzas / Lám (0°)</TableHead>
                      <TableHead className="w-[130px] text-center text-xs font-bold">Pzas / Lám (90°)</TableHead>
                      <TableHead className="w-[140px] text-center text-xs font-bold">Orientación Óptima</TableHead>
                      <TableHead className="w-[60px] text-center text-xs font-bold">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sheetCalculations.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-8 text-center text-xs text-muted-foreground">
                          No hay piezas registradas. Haz clic en &quot;+ Añadir Pieza&quot; para comenzar.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sheetCalculations.rows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="p-2">
                            <Input
                              value={row.tag}
                              onChange={(e) => handleUpdateSheetPieceRow(row.id, 'tag', e.target.value)}
                              className="h-8 text-xs font-medium"
                              placeholder="Ej. MOD-01 Pieza"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              min={1}
                              value={row.quantity}
                              onChange={(e) => handleUpdateSheetPieceRow(row.id, 'quantity', e.target.value)}
                              className="h-8 text-center text-xs font-bold"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              min={0.01}
                              step={0.01}
                              value={row.width}
                              onChange={(e) => handleUpdateSheetPieceRow(row.id, 'width', e.target.value)}
                              className="h-8 text-center text-xs font-mono"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              min={0.01}
                              step={0.01}
                              value={row.height}
                              onChange={(e) => handleUpdateSheetPieceRow(row.id, 'height', e.target.value)}
                              className="h-8 text-center text-xs font-mono"
                            />
                          </TableCell>
                          <TableCell className="p-2 text-right font-mono text-xs font-bold">
                            {row.totalPieceArea.toFixed(3)} m²
                          </TableCell>
                          <TableCell className="p-2 text-center font-mono text-xs">
                            <span className="font-bold">{row.piecesNormal}</span> pzas ({row.colsNormal}×{row.rowsNormal})
                          </TableCell>
                          <TableCell className="p-2 text-center font-mono text-xs">
                            <span className="font-bold">{row.piecesRotated}</span> pzas ({row.colsRotated}×{row.rowsRotated})
                          </TableCell>
                          <TableCell className="p-2 text-center">
                            {row.bestOrientation === 'normal' ? (
                              <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700 text-[11px] dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
                                Normal (0°)
                              </Badge>
                            ) : row.bestOrientation === 'rotated' ? (
                              <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 text-[11px] dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                                Rotada (90°)
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[11px] text-muted-foreground">
                                Indiferente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="p-2 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteSheetPieceRow(row.id)}
                              className="size-7 text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
                              title="Eliminar pieza"
                              aria-label="Eliminar pieza"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* SUB-PESTAÑA 3: OPTIMIZADOR 1D DE PERFILES Y BARRAS */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="bars1d" className="mt-4 space-y-4">
          {/* MÉTRICAS GLOBALES DEL OPTIMIZADOR BFD */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="rounded-2xl border-border/60 shadow-xs">
              <CardContent className="p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Barras Estándar Requeridas
                </p>
                <div className="flex items-baseline gap-2">
                  <p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">
                    {barCalculations.totalBarsRequired}
                  </p>
                  <span className="text-xs text-muted-foreground">barras de {barLength.toFixed(2)} m</span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Total bruto: {barCalculations.totalGrossLength.toFixed(2)} ml
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/60 shadow-xs">
              <CardContent className="p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Metros Lineales Netos
                </p>
                <p className="mt-1 text-2xl font-black text-blue-600 dark:text-blue-400">
                  {barCalculations.netLinearMeters.toFixed(2)} ml
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Suma exacta de cortes requeridos</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/60 shadow-xs">
              <CardContent className="p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Desperdicio / Retazo Total
                </p>
                <p className="mt-1 text-2xl font-black text-rose-600 dark:text-rose-400">
                  {barCalculations.totalWasteMeters.toFixed(2)} ml
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Sobrante acumulado no utilizado
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/60 shadow-xs">
              <CardContent className="p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Eficiencia Global (BFD)
                </p>
                <p
                  className={cn(
                    'mt-1 text-2xl font-black',
                    barCalculations.globalEfficiencyPct >= 85
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : barCalculations.globalEfficiencyPct >= 70
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-rose-600 dark:text-rose-400',
                  )}
                >
                  {barCalculations.globalEfficiencyPct.toFixed(1)}%
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Aprovechamiento lineal de barras
                </p>
              </CardContent>
            </Card>
          </div>

          {/* CONFIGURACIÓN Y TABLA DE CORTES REQUERIDOS */}
          <Card className="rounded-2xl border-border/60 shadow-xs">
            <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-bold">Configuración de Barras y Lista de Cortes</CardTitle>
                <CardDescription className="text-xs">
                  Ajusta largo de barra estándar, espesor de disco (kerf) y lista de elementos a cortar
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* SELECTOR DE PRESET DE BARRA */}
                <div className="flex items-center gap-1.5">
                  <select
                    value={barMaterialPreset}
                    onChange={(e) => handleSelectBarPreset(e.target.value)}
                    className="h-7 rounded-xl border border-border/60 bg-background px-2 text-xs font-bold shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  >
                    {BAR_MATERIAL_PRESETS.map((b) => (
                      <option key={b.name} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/20 px-2.5 py-1">
                  <span className="text-xs text-muted-foreground font-medium">Largo barra:</span>
                  <Input
                    type="number"
                    min={0.5}
                    step={0.1}
                    value={barLength}
                    onChange={(e) => setBarLength(parseFloat(e.target.value) || 0)}
                    className="h-7 w-16 text-right text-xs font-bold"
                  />
                  <span className="text-xs font-bold">m</span>
                </div>

                <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/20 px-2.5 py-1">
                  <span className="text-xs text-muted-foreground font-medium">Disco (Kerf):</span>
                  <Input
                    type="number"
                    min={0}
                    step={0.001}
                    value={kerfLoss}
                    onChange={(e) => setKerfLoss(parseFloat(e.target.value) || 0)}
                    className="h-7 w-20 text-right text-xs font-bold"
                  />
                  <span className="text-xs font-bold">m</span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearBarCuts}
                  className="gap-1.5 rounded-xl border-border/60 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
                  title="Limpiar lista de cortes"
                >
                  <Eraser className="size-3.5" />
                  <span>Limpiar</span>
                </Button>

                <Button
                  size="sm"
                  onClick={handleAddBarCutRow}
                  className="gap-1.5 rounded-xl text-xs font-bold"
                >
                  <Plus className="size-3.5" />
                  <span>+ Añadir Corte</span>
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto rounded-xl border border-border/50">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="w-[300px] text-xs font-bold">Elemento / Pieza</TableHead>
                      <TableHead className="w-[120px] text-center text-xs font-bold">Largo (m)</TableHead>
                      <TableHead className="w-[100px] text-center text-xs font-bold">Cantidad</TableHead>
                      <TableHead className="w-[140px] text-right text-xs font-bold">Total ml</TableHead>
                      <TableHead className="w-[60px] text-center text-xs font-bold">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {barCuts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                          No hay cortes registrados. Haz clic en &quot;+ Añadir Corte&quot; para comenzar.
                        </TableCell>
                      </TableRow>
                    ) : (
                      barCuts.map((cut, index) => {
                        const isExceeding = cut.length > barLength;
                        return (
                          <TableRow key={cut.id} className={cn(isExceeding && 'bg-rose-50/50 dark:bg-rose-950/20')}>
                            <TableCell className="p-2">
                              <div className="flex items-center gap-2">
                                <span className={cn('size-3 rounded-full border', CUT_COLORS[index % CUT_COLORS.length])} />
                                <Input
                                  value={cut.element}
                                  onChange={(e) => handleUpdateBarCutRow(cut.id, 'element', e.target.value)}
                                  className="h-8 text-xs font-medium"
                                  placeholder="Ej. Parante Principal"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                type="number"
                                min={0.01}
                                step={0.01}
                                value={cut.length}
                                onChange={(e) => handleUpdateBarCutRow(cut.id, 'length', e.target.value)}
                                className={cn(
                                  'h-8 text-center text-xs font-mono font-bold',
                                  isExceeding && 'border-rose-500 text-rose-600',
                                )}
                              />
                              {isExceeding && (
                                <p className="mt-1 text-center text-[10px] font-bold text-rose-600">
                                  Excede barra ({barLength}m)
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="p-2">
                              <Input
                                type="number"
                                min={1}
                                value={cut.quantity}
                                onChange={(e) => handleUpdateBarCutRow(cut.id, 'quantity', e.target.value)}
                                className="h-8 text-center text-xs font-bold"
                              />
                            </TableCell>
                            <TableCell className="p-2 text-right font-mono text-xs font-bold">
                              {(cut.length * cut.quantity).toFixed(2)} ml
                            </TableCell>
                            <TableCell className="p-2 text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteBarCutRow(cut.id)}
                                className="size-7 text-rose-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
                                title="Eliminar corte"
                                aria-label="Eliminar corte"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* DESGLOSE VISUAL DE CADA BARRA CON SUS CORTES ASIGNADOS */}
          <Card className="rounded-2xl border-border/60 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Scissors className="size-4 text-amber-500" />
                    <span>Plano de Corte por Barra (Algoritmo BFD)</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Distribución óptima de cortes en cada barra comercial de {barLength.toFixed(2)} m (Kerf: {(kerfLoss * 1000).toFixed(1)} mm)
                  </CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-xs font-bold">
                  {barCalculations.bars.length} Barras Generadas
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {barCalculations.bars.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Ingresa cortes válidos para generar la optimización visual de barras.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                  {barCalculations.bars.map((bar) => (
                    <div
                      key={bar.barIndex}
                      className="rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-2.5 transition-all hover:border-border"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-foreground">Barra #{bar.barIndex}</span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {bar.usedLength.toFixed(2)}m / {barLength.toFixed(2)}m
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            Sobrante: <strong className="text-foreground">{bar.wasteLength.toFixed(2)}m</strong>
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              'px-2 py-0 text-[10px] font-bold',
                              bar.efficiencyPct >= 85
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : bar.efficiencyPct >= 70
                                ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                : 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
                            )}
                          >
                            {bar.efficiencyPct.toFixed(1)}% útil
                          </Badge>
                        </div>
                      </div>

                      {/* BARRA SEGMENTADA VISUAL */}
                      <div className="flex h-7 w-full overflow-hidden rounded-lg border border-border/60 bg-background/60 p-0.5 shadow-inner">
                        {bar.cuts.map((cut, cutIdx) => {
                          const widthPct = (cut.length / barLength) * 100;
                          return (
                            <div
                              key={`${cut.id}-${cutIdx}`}
                              style={{ width: `${widthPct}%` }}
                              title={`${cut.element}: ${cut.length.toFixed(2)}m`}
                              className={cn(
                                'flex items-center justify-center border-r border-background/40 px-1 text-[10px] font-bold truncate transition-all',
                                CUT_COLORS[cut.colorIndex],
                              )}
                            >
                              <span className="truncate">{cut.length.toFixed(2)}m</span>
                            </div>
                          );
                        })}

                        {/* MERMA / SOBRANTE DE BARRA */}
                        {bar.wasteLength > 0 && (
                          <div
                            style={{ width: `${(bar.wasteLength / barLength) * 100}%` }}
                            title={`Retazo / Merma: ${bar.wasteLength.toFixed(2)}m`}
                            className="flex items-center justify-center bg-muted/60 text-[9px] font-bold text-muted-foreground truncate"
                          >
                            <span className="truncate">Retazo {bar.wasteLength.toFixed(2)}m</span>
                          </div>
                        )}
                      </div>

                      {/* CHIPS DE ELEMENTOS ASIGNADOS */}
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {bar.cuts.map((cut, cutIdx) => (
                          <span
                            key={`chip-${cut.id}-${cutIdx}`}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold',
                              CUT_COLORS[cut.colorIndex],
                            )}
                          >
                            <span className="truncate max-w-[120px]">{cut.element}</span>
                            <span className="font-mono font-bold">({cut.length.toFixed(2)}m)</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
