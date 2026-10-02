/**
 * Suite de validación y pruebas unitarias del Motor de Costeo y Precios 6D.
 *
 * Contrasta el resultado del motor puro con los datos modelo del proyecto BONANZA.
 * Criterio de aceptación: tolerancia máxima de ±$0.02 en todos los indicadores clave.
 */

import {
  compute6DCostingAndPricing,
  type PricingEngineInput,
  type PricingEngineOutput,
} from './pricingEngine.ts';

/**
 * Datos oficiales de costeo directo del Proyecto BONANZA.
 */
export const BONANZA_PROJECT_INPUT: PricingEngineInput = {
  lines: {
    ACM: {
      materiales: 4752.1013780468165,
      consumibles: 1390.5533716685372,
      manoDeObra: 1616.58,
      equiposAndamios: 0,
      fletesLogistica: 0,
      viaticos: 0,
      gmMaterial: 0.21,
      gmInstalacion: 0.20,
    },
    WPC: {
      materiales: 700.56,
      consumibles: 181,
      manoDeObra: 252.84,
      equiposAndamios: 0,
      fletesLogistica: 100,
      viaticos: 0,
      gmMaterial: 0.22616,
      gmInstalacion: 0.20,
    },
    GLASS_CLIP: {
      materiales: 2518.652288325,
      glassMaterialCost: 1012.748288325,
      consumibles: 233.39,
      manoDeObra: 390.80,
      equiposAndamios: 0,
      fletesLogistica: 100,
      viaticos: 0,
      gmMaterial: 0.23,
      gmInstalacion: 0.20,
    },
    ROTULOS: {
      materiales: 2746.5060083059607,
      consumibles: 0,
      manoDeObra: 522.8752494928231,
      equiposAndamios: 0,
      fletesLogistica: 0,
      viaticos: 0,
      gmMaterial: 0.22,
      gmInstalacion: 0.20,
    },
  },
  contingencyRate: 0.05,
  overheadRate: 0.04,
  monthlyFinanceRate: 0.00,
  collectionDays: 15,
  salesCommissionRate: 0.025,
  irRetentionRate: 0.02,
  imiRetentionRate: 0.01,
  enableGrossUp: true,
  ivaRate: 0.15,
  advancePaymentRate: 0.70,
  retentionFundRate: 0.00,
  glassBreakageRate: 0.02,
  exposureLineKeys: ['ACM', 'GLASS_CLIP'],
};

export interface MetricComparison {
  expected: number;
  actual: number;
  diff: number;
  tolerance: number;
  passed: boolean;
}

export interface ValidationResult {
  success: boolean;
  differences: Record<string, MetricComparison>;
  output: PricingEngineOutput;
}

/**
 * Ejecuta la verificación estricta contra las cifras de referencia del proyecto BONANZA.
 */
export function runPricingEngineValidation(): ValidationResult {
  const output = compute6DCostingAndPricing(BONANZA_PROJECT_INPUT);
  const tolerance = 0.02;

  const checks: Record<string, { expected: number; actual: number }> = {
    cdTotal: {
      expected: 15505.86,
      actual: output.cdTotal,
    },
    ccTotal: {
      expected: 16921.64,
      actual: output.ccTotal,
    },
    precioSinIVA: {
      expected: 22699.998,
      actual: output.precioSinIVA,
    },
    utilidadBruta: {
      expected: 4546.88,
      actual: output.utilidadBruta,
    },
    margenBrutoRealPct: {
      expected: 20.65,
      actual: output.margenBrutoRealPct,
    },
    exposicionMaximaCaja: {
      expected: 4826.17,
      actual: output.exposicionMaximaCaja,
    },
  };

  const differences: Record<string, MetricComparison> = {};
  let success = true;

  for (const [key, { expected, actual }] of Object.entries(checks)) {
    const diff = Math.abs(actual - expected);
    const passed = diff <= tolerance;
    if (!passed) {
      success = false;
    }
    differences[key] = {
      expected,
      actual,
      diff,
      tolerance,
      passed,
    };
  }

  return {
    success,
    differences,
    output,
  };
}

// Ejecución directa si se invoca en entornos Node o scripts de validación
if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production' && typeof window === 'undefined') {
  const result = runPricingEngineValidation();
  if (!result.success) {
    console.error('Validation failed for BONANZA pricing engine:', result.differences);
  }
}
