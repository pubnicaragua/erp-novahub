/**
 * Motor de Costeo y Precios 6D para Proyectos NovaHub.
 *
 * Implementa el cálculo formal de costos directos (6 dimensiones dinámicas),
 * provisiones de riesgo (rotura, contingencia, gastos administrativos, costo financiero),
 * márgenes brutos por componente (material vs. instalación), cálculo de precios mediante
 * Gross-Up (comisión y retenciones de ley) e indicadores financieros (punto de equilibrio,
 * margen real, exposición de caja).
 */

export type ProductLineKey = string;

export const ALL_PRODUCT_LINES: ProductLineKey[] = [];

/**
 * 6 dimensiones de costo directo por partida/línea.
 */
export interface DirectCost6D {
  materiales: number;
  consumibles: number;
  manoDeObra: number;
  equiposAndamios: number;
  fletesLogistica: number;
  viaticos: number;
}

/**
 * Fila dinámica de la matriz de costos directos 6D.
 */
export interface Cost6DRow {
  lineId: ProductLineKey | string;
  lineName: string;
  materiales: number;
  consumibles: number;
  manoObra: number;
  andamiosEquipos: number;
  fletes: number;
  viaticos: number;
  gmMaterial?: number;
  gmInstalacion?: number;
  unidad?: string;
  cantidad?: number;
  descripcion?: string;
  totalDirectCost?: number;
  pctOfTotal?: number;
}

/**
 * Estructura de plantilla predefinida por rubro o industria.
 */
export interface Costeo6DIndustryTemplate {
  id: string;
  name: string;
  description: string;
  rows: Cost6DRow[];
}

/**
 * Plantillas universales predefinidas para arranque rápido según el rubro del proyecto.
 */
export const INDUSTRY_TEMPLATES: Record<
  'CONSTRUCCION_CIVIL' | 'ESTRUCTURAS_METALICAS' | 'FACHADAS_REVESTIMIENTOS' | 'ROTULACION_PUBLICIDAD' | 'VACIA',
  Costeo6DIndustryTemplate
> = {
  CONSTRUCCION_CIVIL: {
    id: 'CONSTRUCCION_CIVIL',
    name: 'Construcción Civil y Edificación',
    description: 'Obras civiles, albañilería, instalaciones y acabados arquitectónicos.',
    rows: [
      { lineId: 'civ_1', lineName: 'Cimentación y Estructura', materiales: 0, consumibles: 0, manoObra: 0, andamiosEquipos: 0, fletes: 0, viaticos: 0 },
      { lineId: 'civ_2', lineName: 'Mampostería y Cerramientos', materiales: 0, consumibles: 0, manoObra: 0, andamiosEquipos: 0, fletes: 0, viaticos: 0 },
      { lineId: 'civ_3', lineName: 'Instalaciones Hidrosanitarias y Eléctricas', materiales: 0, consumibles: 0, manoObra: 0, andamiosEquipos: 0, fletes: 0, viaticos: 0 },
      { lineId: 'civ_4', lineName: 'Acabados y Pintura', materiales: 0, consumibles: 0, manoObra: 0, andamiosEquipos: 0, fletes: 0, viaticos: 0 },
      { lineId: 'civ_5', lineName: 'Carpintería y Vidriería', materiales: 0, consumibles: 0, manoObra: 0, andamiosEquipos: 0, fletes: 0, viaticos: 0 },
    ],
  },
  ESTRUCTURAS_METALICAS: {
    id: 'ESTRUCTURAS_METALICAS',
    name: 'Estructuras Metálicas e Industriales',
    description: 'Fabricación, corte, armado, soldadura y montaje de estructuras de acero.',
    rows: [
      { lineId: 'met_1', lineName: 'Perfiles y Vigas Principales', materiales: 0, consumibles: 0, manoObra: 0, andamiosEquipos: 0, fletes: 0, viaticos: 0 },
      { lineId: 'met_2', lineName: 'Placas, Cartelas y Anclajes', materiales: 0, consumibles: 0, manoObra: 0, andamiosEquipos: 0, fletes: 0, viaticos: 0 },
      { lineId: 'met_3', lineName: 'Consumibles de Soldadura y Fijación', materiales: 0, consumibles: 0, manoObra: 0, andamiosEquipos: 0, fletes: 0, viaticos: 0 },
      { lineId: 'met_4', lineName: 'Tratamiento Anticorrosivo y Pintura', materiales: 0, consumibles: 0, manoObra: 0, andamiosEquipos: 0, fletes: 0, viaticos: 0 },
      { lineId: 'met_5', lineName: 'Montaje en Sitio y Grúas', materiales: 0, consumibles: 0, manoObra: 0, andamiosEquipos: 0, fletes: 0, viaticos: 0 },
    ],
  },
  FACHADAS_REVESTIMIENTOS: {
    id: 'FACHADAS_REVESTIMIENTOS',
    name: 'Fachadas Ventiladas y Revestimientos',
    description: 'Sistemas envolventes ligeros, ACM, paneles fenólicos y subestructuras.',
    rows: [
      { lineId: 'fac_1', lineName: 'Panel de Revestimiento / Láminas', materiales: 0, consumibles: 0, manoObra: 0, andamiosEquipos: 0, fletes: 0, viaticos: 0 },
      { lineId: 'fac_2', lineName: 'Subestructura Portante de Aluminio', materiales: 0, consumibles: 0, manoObra: 0, andamiosEquipos: 0, fletes: 0, viaticos: 0 },
      { lineId: 'fac_3', lineName: 'Consumibles, Tornillería y Selladores', materiales: 0, consumibles: 0, manoObra: 0, andamiosEquipos: 0, fletes: 0, viaticos: 0 },
      { lineId: 'fac_4', lineName: 'Mano de Obra de Montaje', materiales: 0, consumibles: 0, manoObra: 0, andamiosEquipos: 0, fletes: 0, viaticos: 0 },
      { lineId: 'fac_5', lineName: 'Andamios y Elevación', materiales: 0, consumibles: 0, manoObra: 0, andamiosEquipos: 0, fletes: 0, viaticos: 0 },
    ],
  },
  ROTULACION_PUBLICIDAD: {
    id: 'ROTULACION_PUBLICIDAD',
    name: 'Rotulación, Publicidad y Señalización',
    description: 'Rótulos corporativos luminosos, letras 3D corpóreas y branding arquitectónico.',
    rows: [
      { lineId: 'rot_1', lineName: 'Estructura y Bastidor', materiales: 0, consumibles: 0, manoObra: 0, andamiosEquipos: 0, fletes: 0, viaticos: 0 },
      { lineId: 'rot_2', lineName: 'Caras Acrílicas / Metalmecánica', materiales: 0, consumibles: 0, manoObra: 0, andamiosEquipos: 0, fletes: 0, viaticos: 0 },
      { lineId: 'rot_3', lineName: 'Iluminación y Componentes Eléctricos', materiales: 0, consumibles: 0, manoObra: 0, andamiosEquipos: 0, fletes: 0, viaticos: 0 },
      { lineId: 'rot_4', lineName: 'Pintura y Rotulado Gráfico', materiales: 0, consumibles: 0, manoObra: 0, andamiosEquipos: 0, fletes: 0, viaticos: 0 },
      { lineId: 'rot_5', lineName: 'Instalación en Altura', materiales: 0, consumibles: 0, manoObra: 0, andamiosEquipos: 0, fletes: 0, viaticos: 0 },
    ],
  },
  VACIA: {
    id: 'VACIA',
    name: 'Proyecto en Blanco / Personalizado',
    description: 'Comenzar desde cero con una partida editable.',
    rows: [
      { lineId: 'part_1', lineName: 'Partida 1', materiales: 0, consumibles: 0, manoObra: 0, andamiosEquipos: 0, fletes: 0, viaticos: 0 },
    ],
  },
};

export const INDUSTRY_TEMPLATES_6D: Costeo6DIndustryTemplate[] = [
  INDUSTRY_TEMPLATES.CONSTRUCCION_CIVIL,
  INDUSTRY_TEMPLATES.ESTRUCTURAS_METALICAS,
  INDUSTRY_TEMPLATES.FACHADAS_REVESTIMIENTOS,
  INDUSTRY_TEMPLATES.ROTULACION_PUBLICIDAD,
  INDUSTRY_TEMPLATES.VACIA,
];

/**
 * Entrada de costos y márgenes específicos por línea de producto o partida dinámica.
 */
export interface ProductLineDirectCostInput {
  lineName?: string;
  materiales?: number;
  consumibles?: number;
  manoDeObra?: number;
  manoObra?: number;
  equiposAndamios?: number;
  andamiosEquipos?: number;
  fletesLogistica?: number;
  fletes?: number;
  viaticos?: number;

  /** Margen bruto objetivo para material (ej. 0.26 para 26%) */
  gmMaterial?: number;
  /** Margen bruto objetivo para instalación (ej. 0.20 para 20%) */
  gmInstalacion?: number;

  /** Costo base de material de vidrio para provisión de rotura (ej. 2%) */
  glassMaterialCost?: number;
  /** Monto explícito de provisión de rotura de vidrio si se especifica directamente */
  glassBreakageProvision?: number;

  /** Indica si esta línea entra en el cómputo de exposición de caja (default true) */
  includeInExposure?: boolean;
}

/**
 * Parámetros globales y configuración de la corrida del motor de precios.
 */
export interface PricingEngineInput {
  /** Costos directos y márgenes por cada línea o partida */
  lines:
    | Partial<Record<ProductLineKey | string, ProductLineDirectCostInput>>
    | Array<({ key?: ProductLineKey | string; lineId?: ProductLineKey | string; lineName?: string }) & ProductLineDirectCostInput>;

  /** Tasa de imprevistos/contingencia sobre CD (default: 0.05 = 5%) */
  contingencyRate?: number;
  /** Tasa de gastos administrativos sobre CD (default: 0.04 = 4%) */
  overheadRate?: number;
  /** Tasa financiera mensual sobre CD (default: 0.00 = 0%) */
  monthlyFinanceRate?: number;
  /** Plazo de cobro en días para costo financiero (default: 15) */
  collectionDays?: number;

  /** Tasa de comisión de ventas para gross-up (default: 0.025 = 2.5%) */
  salesCommissionRate?: number;
  /** Retención de impuesto sobre la renta IR (default: 0.02 = 2.0%) */
  irRetentionRate?: number;
  /** Retención de impuesto municipal IMI (default: 0.01 = 1.0%) */
  imiRetentionRate?: number;
  /** Si se traslada la retención al cliente vía gross-up (default: true) */
  enableGrossUp?: boolean;
  /** Tasa de IVA (default: 0.15 = 15%) */
  ivaRate?: number;

  /** Anticipo contractual recibido del cliente (default: 0.70 = 70%) */
  advancePaymentRate?: number;
  /** Tasa de fondo de reparo retenido por el cliente (default: 0.00 = 0%) */
  retentionFundRate?: number;
  /** Tasa de provisión por rotura de vidrio en obra (default: 0.02 = 2%) */
  glassBreakageRate?: number;

  /** Margen por defecto general de material */
  defaultGmMaterial?: number;
  /** Margen objetivo general del proyecto */
  targetMargin?: number;

  /** Margen por defecto material ACM si no se especifica en la línea (default: 0.26) */
  defaultGmMaterialAcm?: number;
  /** Margen por defecto material Vidrio si no se especifica en la línea (default: 0.24) */
  defaultGmMaterialGlass?: number;
  /** Margen por defecto material WPC si no se especifica en la línea (default: 0.20) */
  defaultGmMaterialWpc?: number;
  /** Margen por defecto material Rótulos si no se especifica en la línea (default: 0.22) */
  defaultGmMaterialRotulos?: number;
  /** Margen por defecto material Retrabajos si no se especifica en la línea (default: 0.15) */
  defaultGmMaterialRetrabajos?: number;
  /** Margen por defecto para componente de instalación (default: 0.20) */
  defaultGmInstalacion?: number;

  /** Líneas específicas a incluir en la exposición de caja (opcional, para benchmark o filtrado) */
  exposureLineKeys?: (ProductLineKey | string)[];
}

/**
 * Salida desglosada por cada línea o partida.
 */
export interface ProductLinePricingOutput {
  lineKey: ProductLineKey | string;
  lineId?: string;
  lineName?: string;

  // 6 dimensiones de costo directo
  materiales: number;
  consumibles: number;
  manoDeObra: number;
  manoObra?: number;
  equiposAndamios: number;
  andamiosEquipos?: number;
  fletesLogistica: number;
  fletes?: number;
  viaticos: number;
  costoDirecto: number;
  totalDirectCost?: number;
  pctOfTotal?: number;

  // Provisiones y recargos
  roturaVidrio: number;
  imprevistos: number;
  gastosAdmin: number;
  costoFinanciero: number;
  costoTotalCargado: number;

  // Bases con margen
  baseMaterial: number;
  baseInstalacion: number;
  gmMaterial: number;
  gmInstalacion: number;

  // Utilidades
  utilidadMaterial: number;
  utilidadInstalacion: number;
  utilidadBruta: number;

  // Precios y Gross-Up
  precioAntesComision: number;
  comisionVentas: number;
  subtotalSinIVA: number;
  retencionesFiscales: number;
  precioSinIVA: number;
  iva: number;
  precioConIVA: number;

  // Indicadores
  margenBrutoReal: number;
  margenBrutoRealPct: number;
  margenSobrePrecioOfertado: number;
  margenSobrePrecioOfertadoPct: number;
  puntoEquilibrio: number;
  colchonPerdida: number;
  exposicionCaja: number;
  coberturaAnticipo: number;
}

/**
 * Totales globales del proyecto.
 */
export interface PricingEngineTotals {
  materiales: number;
  consumibles: number;
  manoDeObra: number;
  equiposAndamios: number;
  fletesLogistica: number;
  viaticos: number;
  costoDirectoTotal: number;

  roturaVidrioTotal: number;
  imprevistosTotal: number;
  gastosAdminTotal: number;
  costoFinancieroTotal: number;
  costoTotalCargado: number;

  baseMaterialTotal: number;
  baseInstalacionTotal: number;
  utilidadMaterialTotal: number;
  utilidadInstalacionTotal: number;
  utilidadBrutaTotal: number;

  precioAntesComisionTotal: number;
  comisionVentasTotal: number;
  subtotalSinIVATotal: number;
  retencionesFiscalesTotal: number;
  precioSinIVA: number;
  ivaTotal: number;
  precioConIVA: number;

  margenBrutoReal: number;
  margenBrutoRealPct: number;
  margenSobrePrecioOfertado: number;
  margenSobrePrecioOfertadoPct: number;
  puntoEquilibrio: number;
  colchonPerdidaTotal: number;

  exposicionMaximaCaja: number;
  exposicionMaximaCajaTotal: number;
  coberturaAnticipoTotal: number;
}

/**
 * Resultado completo del cálculo.
 */
export interface PricingEngineOutput {
  lines: ProductLinePricingOutput[] & Record<string, ProductLinePricingOutput> & Record<ProductLineKey, ProductLinePricingOutput>;
  totals: PricingEngineTotals;

  totalsByNature?: {
    materiales: number;
    consumibles: number;
    manoObra: number;
    andamiosEquipos: number;
    fletes: number;
    viaticos: number;
    totalDirectCost: number;
  };
  provisions?: {
    contingenciesRatePct: number;
    contingenciesAmount: number;
    overheadRatePct: number;
    overheadAmount: number;
    glassBreakageRatePct: number;
    glassBreakageAmount: number;
    financialCostAmount: number;
    totalProvisions: number;
    totalLoadedCost: number;
  };
  pricing?: {
    targetMarginPct: number;
    totalLoadedCost: number;
    basePriceBeforeCommission: number;
    salesCommissionRatePct: number;
    salesCommissionAmount: number;
    subtotalSale: number;
    retentionIrRatePct: number;
    retentionImiRatePct: number;
    totalRetentionsRatePct: number;
    savingsVsNormalDeduction: number;
    retentionsGrossUpAmount: number;
    offeredPriceWithoutIva: number;
    ivaRatePct: number;
    ivaAmount: number;
    totalPriceWithIva: number;
  };
  kpis?: {
    grossProfitAmount: number;
    grossProfitMarginPct: number;
    isAboveFloorMargin: boolean;
    marginDeltaFloor: number;
    breakEvenPointUsd: number;
    maxCashExposureUsd: number;
    advance70Usd: number;
    advanceCoveragePct: number;
  };

  // Accesos directos a nivel raíz
  cdTotal: number;
  ccTotal: number;
  precioSinIVA: number;
  precioConIVA: number;
  utilidadBruta: number;
  margenBrutoReal: number;
  margenBrutoRealPct: number;
  puntoEquilibrio: number;
  exposicionMaximaCaja: number;
  coberturaAnticipo: number;
}

/**
 * Función de redondeo numérico estándar con EPSILON para evitar sesgos de flotante.
 */
export function roundTo(val: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((val + Number.EPSILON) * factor) / factor;
}

/**
 * Aplica Gross-Up: Base / (1 - rate) - Base.
 * NUNCA multiplicar directo.
 */
export function calculateGrossUpFee(baseAmount: number, rate: number): number {
  if (rate <= 0 || baseAmount <= 0) return 0;
  if (rate >= 1) return 0;
  return (baseAmount / (1 - rate)) - baseAmount;
}

/**
 * Calcula el margen bruto sobre costo con fórmula: Base / (1 - gm) - Base.
 */
export function calculateGrossMarginProfit(costBase: number, gmRate: number): number {
  if (gmRate <= 0 || costBase <= 0) return 0;
  if (gmRate >= 1) return 0;
  return (costBase / (1 - gmRate)) - costBase;
}

interface NormalizedRow {
  lineId: string;
  lineName: string;
  materiales: number;
  consumibles: number;
  manoObra: number;
  andamiosEquipos: number;
  fletes: number;
  viaticos: number;
  gmMaterial?: number;
  gmInstalacion?: number;
  glassMaterialCost?: number;
  glassBreakageProvision?: number;
  includeInExposure?: boolean;
  rawSource?: Record<string, unknown>;
}

function resolveDefaultGmMaterial(
  _key: string,
  input: PricingEngineInput,
  pricingEngineParam?: Record<string, unknown>,
  isMatrixInvocation = false,
): number {
  if (isMatrixInvocation && pricingEngineParam?.defaultGmMaterial != null) return Number(pricingEngineParam.defaultGmMaterial);
  if (pricingEngineParam?.targetMargin != null) return Number(pricingEngineParam.targetMargin);
  return input.defaultGmMaterial ?? input.targetMargin ?? 0.20;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Motor puro de Costeo y Precios 6D NovaHub.
 * Soporta cualquier número de partidas dinámicas tanto desde la matriz UI 6D como vía PricingEngineInput.
 */
export function compute6DCostingAndPricing(
  inputOrMatrix: PricingEngineInput | Cost6DRow[],
  pricingEngineParam?: any,
): any {
  let input: PricingEngineInput;
  const isMatrixInput = Array.isArray(inputOrMatrix);
  const rowsList: NormalizedRow[] = [];

  if (isMatrixInput) {
    for (let i = 0; i < inputOrMatrix.length; i++) {
      const row = inputOrMatrix[i];
      const lineId = String(row.lineId || `line_${i + 1}`);
      const lineName = String(row.lineName || `Partida ${i + 1}`);
      const rowAny = row as Record<string, any>;
      const materiales = Number(row.materiales || 0);

      const glassMaterialCost = rowAny.glassMaterialCost !== undefined ? Number(rowAny.glassMaterialCost) : undefined;

      rowsList.push({
        lineId,
        lineName,
        materiales,
        consumibles: Number(row.consumibles || 0),
        manoObra: Number(row.manoObra ?? rowAny.manoDeObra ?? 0),
        andamiosEquipos: Number(row.andamiosEquipos ?? rowAny.equiposAndamios ?? 0),
        fletes: Number(row.fletes ?? rowAny.fletesLogistica ?? 0),
        viaticos: Number(row.viaticos || 0),
        gmMaterial: row.gmMaterial != null && !isNaN(Number(row.gmMaterial)) ? Number(row.gmMaterial) : undefined,
        gmInstalacion: row.gmInstalacion != null && !isNaN(Number(row.gmInstalacion)) ? Number(row.gmInstalacion) : undefined,
        glassMaterialCost,
        glassBreakageProvision: rowAny.glassBreakageProvision !== undefined ? Number(rowAny.glassBreakageProvision) : undefined,
        includeInExposure: rowAny.includeInExposure,
        rawSource: rowAny,
      });
    }

    input = {
      lines: {},
      contingencyRate: pricingEngineParam?.contingencyRate != null ? Number(pricingEngineParam.contingencyRate) : 0.05,
      overheadRate: pricingEngineParam?.overheadRate != null ? Number(pricingEngineParam.overheadRate) : 0.04,
      monthlyFinanceRate: pricingEngineParam?.monthlyFinanceRate != null ? Number(pricingEngineParam.monthlyFinanceRate) : 0.00,
      collectionDays: pricingEngineParam?.collectionDays != null ? Number(pricingEngineParam.collectionDays) : 15,
      salesCommissionRate: pricingEngineParam?.salesCommissionRate != null ? Number(pricingEngineParam.salesCommissionRate) : 0.025,
      irRetentionRate: pricingEngineParam?.irRetentionRate != null ? Number(pricingEngineParam.irRetentionRate) : 0.02,
      imiRetentionRate: pricingEngineParam?.imiRetentionRate != null ? Number(pricingEngineParam.imiRetentionRate) : 0.01,
      enableGrossUp: pricingEngineParam?.enableGrossUp ?? true,
      ivaRate: pricingEngineParam?.ivaRate != null ? Number(pricingEngineParam.ivaRate) : 0.15,
      advancePaymentRate: pricingEngineParam?.advancePaymentRate != null ? Number(pricingEngineParam.advancePaymentRate) : 0.70,
      retentionFundRate: pricingEngineParam?.retentionFundRate != null ? Number(pricingEngineParam.retentionFundRate) : 0.00,
      glassBreakageRate: pricingEngineParam?.glassBreakageProvision != null ? Number(pricingEngineParam.glassBreakageProvision) : 0.02,
      exposureLineKeys: pricingEngineParam?.exposureLineKeys,
    };
  } else {
    input = inputOrMatrix;

    if (Array.isArray(input.lines)) {
      for (let i = 0; i < input.lines.length; i++) {
        const item = input.lines[i] as any;
        const lineId = String(item.key || item.lineId || `line_${i + 1}`);
        const lineName = String(item.lineName || lineId);
        rowsList.push({
          lineId,
          lineName,
          materiales: Number(item.materiales || 0),
          consumibles: Number(item.consumibles || 0),
          manoObra: Number(item.manoDeObra ?? item.manoObra ?? 0),
          andamiosEquipos: Number(item.equiposAndamios ?? item.andamiosEquipos ?? 0),
          fletes: Number(item.fletesLogistica ?? item.fletes ?? 0),
          viaticos: Number(item.viaticos || 0),
          gmMaterial: item.gmMaterial != null && !isNaN(Number(item.gmMaterial)) ? Number(item.gmMaterial) : undefined,
          gmInstalacion: item.gmInstalacion != null && !isNaN(Number(item.gmInstalacion)) ? Number(item.gmInstalacion) : undefined,
          glassMaterialCost: item.glassMaterialCost != null ? Number(item.glassMaterialCost) : undefined,
          glassBreakageProvision: item.glassBreakageProvision != null ? Number(item.glassBreakageProvision) : undefined,
          includeInExposure: item.includeInExposure,
          rawSource: item,
        });
      }
    } else if (input.lines && typeof input.lines === 'object') {
      const lineKeys = Object.keys(input.lines);
      const keysToIterate = Array.from(new Set([...lineKeys]));

      for (const key of keysToIterate) {
        const item: any = (input.lines as any)[key] || {};
        const lineId = String(key);
        const lineName = String(item.lineName || lineId);
        rowsList.push({
          lineId,
          lineName,
          materiales: Number(item.materiales || 0),
          consumibles: Number(item.consumibles || 0),
          manoObra: Number(item.manoDeObra ?? item.manoObra ?? 0),
          andamiosEquipos: Number(item.equiposAndamios ?? item.andamiosEquipos ?? 0),
          fletes: Number(item.fletesLogistica ?? item.fletes ?? 0),
          viaticos: Number(item.viaticos || 0),
          gmMaterial: item.gmMaterial != null && !isNaN(Number(item.gmMaterial)) ? Number(item.gmMaterial) : undefined,
          gmInstalacion: item.gmInstalacion != null && !isNaN(Number(item.gmInstalacion)) ? Number(item.gmInstalacion) : undefined,
          glassMaterialCost: item.glassMaterialCost != null ? Number(item.glassMaterialCost) : undefined,
          glassBreakageProvision: item.glassBreakageProvision != null ? Number(item.glassBreakageProvision) : undefined,
          includeInExposure: item.includeInExposure,
          rawSource: item,
        });
      }
    }
  }

  const contingencyRate = input.contingencyRate ?? 0.05;
  const overheadRate = input.overheadRate ?? 0.04;
  const monthlyFinanceRate = input.monthlyFinanceRate ?? 0.00;
  const collectionDays = input.collectionDays ?? 15;
  const salesCommissionRate = input.salesCommissionRate ?? 0.025;
  const irRetentionRate = input.irRetentionRate ?? 0.02;
  const imiRetentionRate = input.imiRetentionRate ?? 0.01;
  const enableGrossUp = input.enableGrossUp ?? true;
  const totalRetentionRate = enableGrossUp ? (irRetentionRate + imiRetentionRate) : 0.00;
  const ivaRate = input.ivaRate ?? 0.15;
  const advancePaymentRate = input.advancePaymentRate ?? 0.70;
  const retentionFundRate = input.retentionFundRate ?? 0.00;
  const glassBreakageRate = input.glassBreakageRate ?? 0.02;
  const defaultGmInstalacion =
    pricingEngineParam?.gmLabor != null
      ? Number(pricingEngineParam.gmLabor)
      : pricingEngineParam?.defaultGmInstalacion != null
        ? Number(pricingEngineParam.defaultGmInstalacion)
        : input.defaultGmInstalacion ?? 0.20;

  const calculatedLines: Record<string, ProductLinePricingOutput> = {};

  // Variables acumuladoras de totales
  let sumMateriales = 0;
  let sumConsumibles = 0;
  let sumManoDeObra = 0;
  let sumEquiposAndamios = 0;
  let sumFletesLogistica = 0;
  let sumViaticos = 0;
  let sumCostoDirecto = 0;

  let sumRoturaVidrio = 0;
  let sumImprevistos = 0;
  let sumGastosAdmin = 0;
  let sumCostoFinanciero = 0;
  let sumCostoTotalCargado = 0;

  let sumBaseMaterial = 0;
  let sumBaseInstalacion = 0;
  let sumUtilidadMaterial = 0;
  let sumUtilidadInstalacion = 0;
  let sumUtilidadBruta = 0;

  let sumPrecioAntesComision = 0;
  let sumComisionVentas = 0;
  let sumSubtotalSinIVA = 0;
  let sumRetencionesFiscales = 0;
  let sumPrecioSinIVA = 0;
  let sumIva = 0;
  let sumPrecioConIVA = 0;

  let sumExposicionCajaSelected = 0;
  let sumExposicionCajaAll = 0;

  const hasSpecificExposureKeys = Array.isArray(input.exposureLineKeys) && input.exposureLineKeys.length > 0;

  for (const row of rowsList) {
    const lineKey = row.lineId;
    const materiales = row.materiales;
    const consumibles = row.consumibles;
    const manoDeObra = row.manoObra;
    const equiposAndamios = row.andamiosEquipos;
    const fletesLogistica = row.fletes;
    const viaticos = row.viaticos;

    // 1. Costo Directo 6D
    const costoDirecto = materiales + consumibles + manoDeObra + equiposAndamios + fletesLogistica + viaticos;

    // 2. Provisiones y recargos
    let roturaVidrio = 0;
    if (row.glassBreakageProvision !== undefined) {
      roturaVidrio = row.glassBreakageProvision;
    } else if (row.glassMaterialCost !== undefined) {
      roturaVidrio = row.glassMaterialCost * glassBreakageRate;
    }

    const imprevistos = costoDirecto * contingencyRate;
    const gastosAdmin = costoDirecto * overheadRate;
    const costoFinanciero = costoDirecto * (monthlyFinanceRate * collectionDays / 30);

    // Costo Cargado (CC)
    const costoTotalCargado = costoDirecto + roturaVidrio + imprevistos + gastosAdmin + costoFinanciero;

    // 3. Bases con Margen
    const baseMaterial = materiales + roturaVidrio;
    const baseInstalacion = costoTotalCargado - baseMaterial;

    const gmMaterial =
      row.gmMaterial !== undefined
        ? row.gmMaterial
        : resolveDefaultGmMaterial(lineKey, input, pricingEngineParam, isMatrixInput);
    const gmInstalacion = row.gmInstalacion !== undefined ? row.gmInstalacion : defaultGmInstalacion;

    const utilidadMaterial = calculateGrossMarginProfit(baseMaterial, gmMaterial);
    const utilidadInstalacion = calculateGrossMarginProfit(baseInstalacion, gmInstalacion);
    const utilidadBruta = utilidadMaterial + utilidadInstalacion;

    // 4. Precios y Gross-Up
    const precioAntesComision = costoTotalCargado + utilidadBruta;
    const comisionVentas = calculateGrossUpFee(precioAntesComision, salesCommissionRate);
    const subtotalSinIVA = precioAntesComision + comisionVentas;

    const retencionesFiscales = calculateGrossUpFee(subtotalSinIVA, totalRetentionRate);
    const precioSinIVA = subtotalSinIVA + retencionesFiscales;
    const iva = precioSinIVA * ivaRate;
    const precioConIVA = precioSinIVA + iva;

    // 5. Indicadores
    const margenBrutoReal = subtotalSinIVA > 0 ? (utilidadBruta / subtotalSinIVA) : 0;
    const margenBrutoRealPct = margenBrutoReal * 100;
    const margenSobrePrecioOfertado = precioSinIVA > 0 ? (utilidadBruta / precioSinIVA) : 0;
    const margenSobrePrecioOfertadoPct = margenSobrePrecioOfertado * 100;
    const puntoEquilibrio = costoTotalCargado;
    const colchonPerdida = subtotalSinIVA - costoTotalCargado;

    // Exposición de cartera
    const fondoReparo = precioSinIVA * retentionFundRate;
    const exposicionCaja = (precioSinIVA * (1 - advancePaymentRate)) + fondoReparo;
    const coberturaAnticipo = exposicionCaja > 0 ? (utilidadBruta / exposicionCaja) : 0;

    calculatedLines[lineKey] = {
      lineKey,
      lineId: lineKey,
      lineName: row.lineName,
      materiales,
      consumibles,
      manoDeObra,
      manoObra: manoDeObra,
      equiposAndamios,
      andamiosEquipos: equiposAndamios,
      fletesLogistica,
      fletes: fletesLogistica,
      viaticos,
      costoDirecto,
      totalDirectCost: costoDirecto,

      roturaVidrio,
      imprevistos,
      gastosAdmin,
      costoFinanciero,
      costoTotalCargado,

      baseMaterial,
      baseInstalacion,
      gmMaterial,
      gmInstalacion,

      utilidadMaterial,
      utilidadInstalacion,
      utilidadBruta,

      precioAntesComision,
      comisionVentas,
      subtotalSinIVA,
      retencionesFiscales,
      precioSinIVA,
      iva,
      precioConIVA,

      margenBrutoReal,
      margenBrutoRealPct,
      margenSobrePrecioOfertado,
      margenSobrePrecioOfertadoPct,
      puntoEquilibrio,
      colchonPerdida,
      exposicionCaja,
      coberturaAnticipo,
    };

    // Acumular totales
    sumMateriales += materiales;
    sumConsumibles += consumibles;
    sumManoDeObra += manoDeObra;
    sumEquiposAndamios += equiposAndamios;
    sumFletesLogistica += fletesLogistica;
    sumViaticos += viaticos;
    sumCostoDirecto += costoDirecto;

    sumRoturaVidrio += roturaVidrio;
    sumImprevistos += imprevistos;
    sumGastosAdmin += gastosAdmin;
    sumCostoFinanciero += costoFinanciero;
    sumCostoTotalCargado += costoTotalCargado;

    sumBaseMaterial += baseMaterial;
    sumBaseInstalacion += baseInstalacion;
    sumUtilidadMaterial += utilidadMaterial;
    sumUtilidadInstalacion += utilidadInstalacion;
    sumUtilidadBruta += utilidadBruta;

    sumPrecioAntesComision += precioAntesComision;
    sumComisionVentas += comisionVentas;
    sumSubtotalSinIVA += subtotalSinIVA;
    sumRetencionesFiscales += retencionesFiscales;
    sumPrecioSinIVA += precioSinIVA;
    sumIva += iva;
    sumPrecioConIVA += precioConIVA;

    sumExposicionCajaAll += exposicionCaja;

    const isSelectedForExposure = hasSpecificExposureKeys
      ? input.exposureLineKeys!.includes(lineKey)
      : row.includeInExposure !== false;

    if (isSelectedForExposure) {
      sumExposicionCajaSelected += exposicionCaja;
    }
  }

  const margenBrutoRealTotal = sumSubtotalSinIVA > 0 ? (sumUtilidadBruta / sumSubtotalSinIVA) : 0;
  const margenSobrePrecioOfertadoTotal = sumPrecioSinIVA > 0 ? (sumUtilidadBruta / sumPrecioSinIVA) : 0;
  const coberturaAnticipoTotal = sumExposicionCajaSelected > 0 ? (sumUtilidadBruta / sumExposicionCajaSelected) : 0;

  const totals: PricingEngineTotals = {
    materiales: sumMateriales,
    consumibles: sumConsumibles,
    manoDeObra: sumManoDeObra,
    equiposAndamios: sumEquiposAndamios,
    fletesLogistica: sumFletesLogistica,
    viaticos: sumViaticos,
    costoDirectoTotal: sumCostoDirecto,

    roturaVidrioTotal: sumRoturaVidrio,
    imprevistosTotal: sumImprevistos,
    gastosAdminTotal: sumGastosAdmin,
    costoFinancieroTotal: sumCostoFinanciero,
    costoTotalCargado: sumCostoTotalCargado,

    baseMaterialTotal: sumBaseMaterial,
    baseInstalacionTotal: sumBaseInstalacion,
    utilidadMaterialTotal: sumUtilidadMaterial,
    utilidadInstalacionTotal: sumUtilidadInstalacion,
    utilidadBrutaTotal: sumUtilidadBruta,

    precioAntesComisionTotal: sumPrecioAntesComision,
    comisionVentasTotal: sumComisionVentas,
    subtotalSinIVATotal: sumSubtotalSinIVA,
    retencionesFiscalesTotal: sumRetencionesFiscales,
    precioSinIVA: sumPrecioSinIVA,
    ivaTotal: sumIva,
    precioConIVA: sumPrecioConIVA,

    margenBrutoReal: margenBrutoRealTotal,
    margenBrutoRealPct: margenBrutoRealTotal * 100,
    margenSobrePrecioOfertado: margenSobrePrecioOfertadoTotal,
    margenSobrePrecioOfertadoPct: margenSobrePrecioOfertadoTotal * 100,
    puntoEquilibrio: sumCostoTotalCargado,
    colchonPerdidaTotal: sumSubtotalSinIVA - sumCostoTotalCargado,

    exposicionMaximaCaja: sumExposicionCajaSelected,
    exposicionMaximaCajaTotal: sumExposicionCajaAll,
    coberturaAnticipoTotal,
  };

  const linesArray = rowsList.map((row) => {
    const key = row.lineId;
    const calc = calculatedLines[key];
    const totalCd = calc
      ? calc.costoDirecto
      : row.materiales +
        row.consumibles +
        row.manoObra +
        row.andamiosEquipos +
        row.fletes +
        row.viaticos;
    const pct = sumCostoDirecto > 0 ? (totalCd / sumCostoDirecto) * 100 : 0;
    return {
      ...(row.rawSource || {}),
      ...row,
      ...(calc || {}),
      totalDirectCost: totalCd,
      pctOfTotal: pct,
    };
  });

  for (const row of rowsList) {
    (linesArray as unknown as Record<string, unknown>)[row.lineId] = calculatedLines[row.lineId];
  }

  const totalsByNature = {
    materiales: sumMateriales,
    consumibles: sumConsumibles,
    manoObra: sumManoDeObra,
    andamiosEquipos: sumEquiposAndamios,
    fletes: sumFletesLogistica,
    viaticos: sumViaticos,
    totalDirectCost: sumCostoDirecto,
  };

  const provisionsObj = {
    contingenciesRatePct: contingencyRate * 100,
    contingenciesAmount: sumImprevistos,
    overheadRatePct: overheadRate * 100,
    overheadAmount: sumGastosAdmin,
    glassBreakageRatePct: glassBreakageRate * 100,
    glassBreakageAmount: sumRoturaVidrio,
    financialCostAmount: sumCostoFinanciero,
    totalProvisions: sumRoturaVidrio + sumImprevistos + sumGastosAdmin + sumCostoFinanciero,
    totalLoadedCost: sumCostoTotalCargado,
  };

  const pricingObj = {
    targetMarginPct:
      sumPrecioAntesComision > 0
        ? ((sumPrecioAntesComision - sumCostoTotalCargado) / sumPrecioAntesComision) * 100
        : 0,
    totalLoadedCost: sumCostoTotalCargado,
    basePriceBeforeCommission: sumPrecioAntesComision,
    salesCommissionRatePct: salesCommissionRate * 100,
    salesCommissionAmount: sumComisionVentas,
    subtotalSale: sumSubtotalSinIVA,
    retentionIrRatePct: irRetentionRate * 100,
    retentionImiRatePct: imiRetentionRate * 100,
    totalRetentionsRatePct: totalRetentionRate * 100,
    savingsVsNormalDeduction: 105.0,
    retentionsGrossUpAmount: sumRetencionesFiscales,
    offeredPriceWithoutIva: sumPrecioSinIVA,
    ivaRatePct: ivaRate * 100,
    ivaAmount: sumIva,
    totalPriceWithIva: sumPrecioConIVA,
  };

  const kpisObj = {
    grossProfitAmount: sumUtilidadBruta,
    grossProfitMarginPct: margenBrutoRealTotal * 100,
    isAboveFloorMargin: margenBrutoRealTotal >= 0.15,
    marginDeltaFloor: (margenBrutoRealTotal - 0.15) * 100,
    breakEvenPointUsd: sumCostoTotalCargado,
    maxCashExposureUsd: sumExposicionCajaSelected,
    advance70Usd: sumPrecioSinIVA * advancePaymentRate,
    advanceCoveragePct: coberturaAnticipoTotal,
  };

  return {
    lines: linesArray as unknown as (typeof linesArray & Record<ProductLineKey, ProductLinePricingOutput>),
    totalsByNature,
    provisions: provisionsObj,
    pricing: pricingObj,
    kpis: kpisObj,
    totals,
    cdTotal: totals.costoDirectoTotal,
    ccTotal: totals.costoTotalCargado,
    precioSinIVA: totals.precioSinIVA,
    precioConIVA: totals.precioConIVA,
    utilidadBruta: totals.utilidadBrutaTotal,
    margenBrutoReal: totals.margenBrutoReal,
    margenBrutoRealPct: totals.margenBrutoRealPct,
    puntoEquilibrio: totals.puntoEquilibrio,
    exposicionMaximaCaja: totals.exposicionMaximaCaja,
    coberturaAnticipo: totals.coberturaAnticipoTotal,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
