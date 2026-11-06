import { useMemo } from 'react';
import { contabilidadService } from '../services/contabilidad.service';
import { accountingList, useAccountingQuery } from './useAccountingQuery';

export type LineIncomeAccount = { id: string; code: string; name: string };

type RawAccount = { id: string; code: string; name: string; type?: string; subtype?: string; isActive?: boolean; acceptsPostings?: boolean; isLeaf?: boolean; children?: RawAccount[] };

export type LineIncomeConfig = { salesLineIncome?: boolean; salesLineIncomeAccounts?: string[] };
export type LineIncomeConfigResponse = LineIncomeConfig & { config?: LineIncomeConfig };

const GROUP_SUBTYPES = new Set(['MAIN_GROUP', 'GROUP']);

function flatten(nodes: RawAccount[]): RawAccount[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children || [])]);
}

/** Cuentas de ingreso en las que sí se puede registrar (activas, de detalle, sin hijas). */
export function selectableIncomeAccounts(tree: RawAccount[]): LineIncomeAccount[] {
  return flatten(tree)
    .filter((a) => String(a.type).toUpperCase() === 'INCOME'
      && a.isActive !== false
      && a.acceptsPostings !== false
      && a.isLeaf !== false
      && !(a.children && a.children.length)
      && !GROUP_SUBTYPES.has(String(a.subtype || '').toUpperCase()))
    .map(({ id, code, name }) => ({ id, code, name }));
}

/**
 * Ajuste por empresa: la factura deja elegir cuenta de ingreso y centro de costo por línea.
 * Apagado por defecto; si el usuario no puede leer contabilidad, queda apagado sin errores.
 */
export function useSalesLineIncome() {
  const config = useAccountingQuery<LineIncomeConfigResponse>(['config', 'sales-line-income'], (signal) => contabilidadService.getConfig(signal), { retry: false });
  const cfg = config.data?.config ?? config.data;
  const enabled = cfg?.salesLineIncome === true;
  const configuredCodes = cfg?.salesLineIncomeAccounts;
  const accounts = useAccountingQuery<RawAccount[]>(['accounts', 'income-leaf'], async (signal) => accountingList(await contabilidadService.getChartOfAccounts(false, signal)), { enabled, retry: false });
  const options = useMemo(() => {
    const all = selectableIncomeAccounts(accounts.data || []);
    const allowedCodes = configuredCodes ?? [];
    return allowedCodes.length ? all.filter((a) => allowedCodes.includes(a.code)) : all;
  }, [accounts.data, configuredCodes]);
  return { enabled, options };
}
