import * as XLSX from 'xlsx';
import { contabilidadService } from '../../services/contabilidad.service';
import { buildDatedDownloadFileName } from '../../utils/exportFileNames';

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  DEPRECIATED: 'Depreciado',
  INACTIVE: 'Inactivo',
  RETIRED: 'Retirado',
  DISPOSED: 'Baja',
};

export interface FixedAssetExportOptions {
  toBase?: (amount: number, sourceCurrency?: string, sourceRate?: number) => number;
  baseCurrency?: string;
}

function formatExportDate(value: any): string {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d.getTime()) ? String(value) : d.toISOString().slice(0, 10);
}

function responsibleOf(d: any): string {
  if (typeof d?.responsible === 'string') return d.responsible;
  return d?.responsible?.name || d?.responsibleText || '';
}

function round2(value: number): number {
  return Math.round(Number(value) * 100) / 100;
}

export async function fetchFixedAssetDetails(ids: string[]): Promise<any[]> {
  const details: any[] = [];
  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    const results = await Promise.all(chunk.map(id => contabilidadService.getFixedAssetDetail(id)));
    details.push(...results);
  }
  return details;
}

export function exportFixedAssetsExcel(details: any[], options: FixedAssetExportOptions = {}): void {
  const { toBase, baseCurrency } = options;
  const suffix = baseCurrency ? ` (${baseCurrency})` : '';
  const converted = (value: any, currency: string | undefined, rate: number | undefined): number | undefined => {
    if (!toBase) return undefined;
    return round2(toBase(Number(value ?? 0), currency, rate));
  };

  const assetRows = details.map((d) => {
    const row: Record<string, any> = {
      'Código': d.code ?? '',
      'Nombre': d.name ?? '',
      'Categoría': d.category?.name ?? '',
      'Marca': d.brand ?? '',
      'Modelo': d.model ?? '',
      'No. serie': d.serialNumber ?? '',
      'Sucursal': d.branch?.name ?? '',
      'Centro de costo': d.costCenter?.name ?? '',
      'Ubicación': d.location ?? '',
      'Responsable': responsibleOf(d),
      'No. factura': d.invoiceNumber ?? '',
      'Fecha adquisición': formatExportDate(d.acquisitionDate),
      'Fecha puesta en uso': formatExportDate(d.inUseDate),
      'Moneda': d.currency ?? '',
      'Tipo de cambio': d.exchangeRate ?? '',
      'Costo': d.cost ?? 0,
      'Valor residual': d.residualValue ?? 0,
      'Dep. acumulada inicial': d.initialAccumDepreciation ?? 0,
      'Inicio depreciación': d.cutoffDate ? formatExportDate(d.cutoffDate) : '',
      'Observaciones': d.notes ?? '',
      'Estado': STATUS_LABELS[d.status] || d.status || '',
      'Valor en libros': d.derived?.bookValue ?? 0,
      'Dep. mensual': d.derived?.monthly ?? 0,
    };
    if (toBase) {
      row[`Costo${suffix}`] = converted(d.cost, d.currency, d.exchangeRate);
      row[`Valor residual${suffix}`] = converted(d.residualValue, d.currency, d.exchangeRate);
      row[`Dep. acumulada inicial${suffix}`] = converted(d.initialAccumDepreciation, d.currency, d.exchangeRate);
      row[`Valor en libros${suffix}`] = converted(d.derived?.bookValue, d.currency, d.exchangeRate);
      row[`Dep. mensual${suffix}`] = converted(d.derived?.monthly, d.currency, d.exchangeRate);
    }
    return row;
  });

  const projectionRows: any[] = [];
  details.forEach((d) => {
    const proj = d.projection || [];
    if (proj.length === 0) {
      projectionRows.push({ 'Código': d.code ?? '', 'Activo': d.name ?? '', 'Período': '', 'Depreciación': '', 'Acumulada': '', 'Valor en libros': '', 'Estado': 'Sin proyección' });
    } else {
      proj.forEach((p: any) => {
        const row: Record<string, any> = {
          'Código': d.code ?? '',
          'Activo': d.name ?? '',
          'Período': p.period,
          'Depreciación': p.depreciationAmount,
          'Acumulada': p.accumulatedDepreciation,
          'Valor en libros': p.bookValue,
          'Estado': p.status === 'PROCESSED' ? 'Procesado' : 'Pendiente',
        };
        if (toBase) {
          row[`Depreciación${suffix}`] = converted(p.depreciationAmount, d.currency, d.exchangeRate);
          row[`Acumulada${suffix}`] = converted(p.accumulatedDepreciation, d.currency, d.exchangeRate);
          row[`Valor en libros${suffix}`] = converted(p.bookValue, d.currency, d.exchangeRate);
        }
        projectionRows.push(row);
      });
    }
  });

  const workbook = XLSX.utils.book_new();
  const wsAssets = XLSX.utils.json_to_sheet(assetRows);
  wsAssets['!cols'] = [{ wch: 12 }, { wch: 32 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 26 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, ...(toBase ? [{ wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 16 }] : [])];
  XLSX.utils.book_append_sheet(workbook, wsAssets, 'Activos');
  const wsProjection = XLSX.utils.json_to_sheet(projectionRows);
  wsProjection['!cols'] = [{ wch: 12 }, { wch: 32 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, ...(toBase ? [{ wch: 14 }, { wch: 14 }, { wch: 14 }] : [])];
  XLSX.utils.book_append_sheet(workbook, wsProjection, 'Proyección de Depreciación');
  XLSX.writeFile(workbook, buildDatedDownloadFileName(['reporte_activos_fijos'], 'xlsx'));
}
