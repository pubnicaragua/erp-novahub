export type DashboardPeriod = 'today' | 'month' | 'quarter' | 'year' | 'custom';
export type DashboardBlock = 'trend' | 'products' | 'registers' | 'inventory';
export interface DashboardPreferences { indicators: string[]; blocks: DashboardBlock[] }
export interface DashboardPermissionRule {
  permission?: string;
  permissions?: string[];
  permissionGroups?: string[][];
  permissionMode?: 'all' | 'any';
  sensitivePermissions?: string[];
}
export interface IndicatorDefinition extends DashboardPermissionRule {
  id: string; label: string; description: string; decision: string; group: string;
  cost?: boolean; recommended?: boolean;
}
export const INDICATORS: IndicatorDefinition[] = [
  { id: 'totalRevenue', label: 'Ventas pagadas', description: 'Total de facturas con estado Pagada y fecha dentro del período, incluidos impuestos. No equivale al flujo de cobros.', decision: 'Conocer el volumen de venta pagada.', group: 'Desempeño', permissions: ['SALES_INVOICES', 'RETAIL_POS', 'RETAIL_CASH_CONTROL'], permissionMode: 'any', recommended: true },
  { id: 'totalExpenses', label: 'Gastos registrados', description: 'Suma de los gastos registrados en Compras durante el período. Solo los marcados como Pagado generan asiento en el Libro Diario y registro en Finanzas. No incluye el costo de la mercadería vendida.', decision: 'Revisar el nivel de gasto.', group: 'Desempeño', permission: 'PURCHASES_EXPENSES', recommended: true },
  { id: 'paidInvoicesCount', label: 'Facturas pagadas', description: 'Número total de facturas pagadas del período; incluye todas las facturas del alcance consultado.', decision: 'Medir el volumen de operaciones.', group: 'Desempeño', permissions: ['SALES_INVOICES', 'RETAIL_POS', 'RETAIL_CASH_CONTROL'], permissionMode: 'any', recommended: true },
  { id: 'averagePaidInvoice', label: 'Ticket de venta pagada', description: 'Ventas pagadas divididas entre el total de facturas pagadas. Incluye impuestos.', decision: 'Evaluar el valor medio de cada venta.', group: 'Desempeño', permissions: ['SALES_INVOICES', 'RETAIL_POS', 'RETAIL_CASH_CONTROL'], permissionMode: 'any', recommended: true },
  { id: 'operatingResult', label: 'Ventas menos gastos', description: 'Diferencia entre ventas pagadas y gastos registrados en Compras. No representa utilidad contable ni utilidad bruta.', decision: 'Comparar ambas magnitudes antes del costo de venta.', group: 'Desempeño', permissionGroups: [['SALES_INVOICES', 'RETAIL_POS', 'RETAIL_CASH_CONTROL'], ['PURCHASES_EXPENSES']] },
  { id: 'operatingMargin', label: 'Margen operativo', description: 'Porcentaje de ventas que queda después del costo de venta estimado y los gastos registrados en Compras. Requiere costos configurados para mostrar un resultado calculable.', decision: 'Medir cuánto queda de cada venta después de operar.', group: 'Desempeño', permissionGroups: [['SALES_INVOICES', 'RETAIL_POS', 'RETAIL_CASH_CONTROL'], ['INVENTORY_PRODUCTS'], ['PURCHASES_EXPENSES']], recommended: true },
  { id: 'grossMargin', label: 'Margen bruto', description: 'Utilidad bruta sobre ventas: ventas pagadas menos costo de venta estimado, dividido entre ventas. Requiere permiso para consultar costos.', decision: 'Evaluar la contribución de los productos antes de gastos operativos.', group: 'Desempeño', permissionGroups: [['SALES_INVOICES', 'RETAIL_POS', 'RETAIL_CASH_CONTROL'], ['INVENTORY_PRODUCTS']], sensitivePermissions: ['INVENTORY_PRODUCTS', 'INVENTORY'] },
  { id: 'commercialMargin', label: 'Margen comercial', description: 'Margen generado por la venta de productos con costo configurado, antes de gastos operativos. Requiere permiso para consultar costos.', decision: 'Revisar si el precio comercial protege la contribución del negocio.', group: 'Desempeño', permissionGroups: [['SALES_INVOICES', 'RETAIL_POS', 'RETAIL_CASH_CONTROL'], ['INVENTORY_PRODUCTS']], sensitivePermissions: ['INVENTORY_PRODUCTS', 'INVENTORY'] },
  { id: 'netMargin', label: 'Margen neto', description: 'Utilidad neta conocida sobre ventas, después del costo de venta estimado y los gastos registrados en Compras.', decision: 'Conocer qué porcentaje de la venta permanece como utilidad conocida.', group: 'Desempeño', permissionGroups: [['SALES_INVOICES', 'RETAIL_POS', 'RETAIL_CASH_CONTROL'], ['INVENTORY_PRODUCTS'], ['PURCHASES_EXPENSES']], sensitivePermissions: ['INVENTORY_PRODUCTS', 'INVENTORY'] },
  { id: 'profitability', label: 'Rentabilidad', description: 'Utilidad neta conocida comparada contra el costo de venta estimado. Requiere permiso para consultar costos.', decision: 'Medir el rendimiento obtenido por cada unidad monetaria invertida en inventario.', group: 'Desempeño', permissionGroups: [['SALES_INVOICES', 'RETAIL_POS', 'RETAIL_CASH_CONTROL'], ['INVENTORY_PRODUCTS'], ['PURCHASES_EXPENSES']], sensitivePermissions: ['INVENTORY_PRODUCTS', 'INVENTORY'] },
  { id: 'netProfit', label: 'Utilidad neta', description: 'Ventas pagadas menos costo de venta estimado y gastos registrados en Compras. Requiere permiso para consultar costos.', decision: 'Conocer la utilidad monetaria conocida del período.', group: 'Desempeño', permissionGroups: [['SALES_INVOICES', 'RETAIL_POS', 'RETAIL_CASH_CONTROL'], ['INVENTORY_PRODUCTS'], ['PURCHASES_EXPENSES']], sensitivePermissions: ['INVENTORY_PRODUCTS', 'INVENTORY'] },
  { id: 'ordersCount', label: 'Órdenes creadas', description: 'Órdenes de venta creadas dentro del período, independientemente de su estado actual.', decision: 'Observar la actividad comercial.', group: 'Desempeño', permission: 'SALES_ORDERS' },
  { id: 'pendingOrders', label: 'Órdenes abiertas', description: 'Órdenes en estados abiertos a la fecha de consulta, incluidos borradores. No se limita al período.', decision: 'Dar seguimiento al trabajo por completar.', group: 'Atención', permission: 'SALES_ORDERS' },
  { id: 'inventoryAlerts', label: 'Productos con alertas', description: 'Productos distintos con alguna ubicación agotada, bajo mínimo o con hasta 10 unidades. Existencias actuales.', decision: 'Priorizar la revisión de existencias.', group: 'Atención', permission: 'INVENTORY_PRODUCTS' },
  { id: 'outOfStock', label: 'Productos agotados', description: 'Productos con al menos una ubicación sin existencias; pueden tener stock en otra ubicación.', decision: 'Revisar traslados o reposición.', group: 'Atención', permission: 'INVENTORY_PRODUCTS' },
  { id: 'noSaleProducts', label: 'Productos sin ventas', description: 'Productos activos con stock actual y sin ventas pagadas durante el período.', decision: 'Identificar inventario que no está rotando.', group: 'Productos', permissionGroups: [['SALES_INVOICES', 'RETAIL_POS', 'RETAIL_CASH_CONTROL'], ['INVENTORY_PRODUCTS']] },
  { id: 'productsWithSales', label: 'Productos con ventas', description: 'Cantidad total de productos distintos en facturas pagadas del período.', decision: 'Medir la amplitud del catálogo vendido.', group: 'Productos', permissionGroups: [['SALES_INVOICES', 'RETAIL_POS', 'RETAIL_CASH_CONTROL'], ['INVENTORY_PRODUCTS']] },
  { id: 'topSellingProduct', label: 'Producto más vendido', description: 'Primer producto ordenado por unidades vendidas en facturas pagadas. Los empates se ordenan por nombre.', decision: 'Consultar el producto de mayor movimiento.', group: 'Productos', permissionGroups: [['SALES_INVOICES', 'RETAIL_POS', 'RETAIL_CASH_CONTROL'], ['INVENTORY_PRODUCTS']] },
  { id: 'leastSellingProduct', label: 'Producto menos vendido', description: 'Producto con menos unidades vendidas entre los que sí tuvieron ventas pagadas; no incluye productos sin ventas.', decision: 'Revisar el desempeño de productos de baja venta.', group: 'Productos', permissionGroups: [['SALES_INVOICES', 'RETAIL_POS', 'RETAIL_CASH_CONTROL'], ['INVENTORY_PRODUCTS']] },
  { id: 'topMarginProduct', label: 'Mayor utilidad de referencia', description: 'Líder por (precio de catálogo actual − costo actual) × unidades vendidas. Requiere permiso para consultar costos; es una referencia, no rentabilidad realizada.', decision: 'Investigar productos con mayor contribución estimada.', group: 'Productos', permissionGroups: [['SALES_INVOICES', 'RETAIL_POS', 'RETAIL_CASH_CONTROL'], ['INVENTORY_PRODUCTS']], sensitivePermissions: ['INVENTORY_PRODUCTS', 'INVENTORY'], cost: true },
  { id: 'registersWithSales', label: 'Cajas con ventas', description: 'Cajas distintas con facturas pagadas en el período completo.', decision: 'Revisar actividad por punto de venta.', group: 'Caja', permissions: ['RETAIL_POS', 'RETAIL_CASH_CONTROL'], permissionMode: 'any' },
  { id: 'topRegister', label: 'Caja con más ventas', description: 'Caja con mayor importe de facturas pagadas en el período completo.', decision: 'Comparar puntos de venta.', group: 'Caja', permissions: ['RETAIL_POS', 'RETAIL_CASH_CONTROL'], permissionMode: 'any' },
];
export const BLOCKS: ({ id: DashboardBlock; label: string; description: string } & DashboardPermissionRule)[] = [
  { id: 'trend', label: 'Ventas y gastos', description: 'Evolución de las ventas pagadas y gastos del período.', permissions: ['SALES_INVOICES', 'RETAIL_POS', 'RETAIL_CASH_CONTROL', 'PURCHASES_EXPENSES'], permissionMode: 'any' },
  { id: 'products', label: 'Productos', description: 'Ventas y utilidad por producto.', permissionGroups: [['SALES_INVOICES', 'RETAIL_POS', 'RETAIL_CASH_CONTROL'], ['INVENTORY_PRODUCTS']] },
  { id: 'registers', label: 'Ventas por caja', description: 'Ventas pagadas y operaciones por caja.', permissions: ['RETAIL_POS', 'RETAIL_CASH_CONTROL'], permissionMode: 'any' },
  { id: 'inventory', label: 'Estado del inventario', description: 'Distribución de existencias sin stock, bajo stock y por reordenar.', permission: 'INVENTORY_PRODUCTS' },
];
export const DEFAULT_PREFERENCES: DashboardPreferences = {
  indicators: ['totalRevenue', 'totalExpenses', 'paidInvoicesCount', 'averagePaidInvoice', 'operatingMargin'],
  blocks: ['trend', 'products', 'registers', 'inventory'],
};
export function isDashboardItemAllowed(
  item: DashboardPermissionRule | undefined,
  canPerform: (module: string, action?: 'view' | 'viewCost') => boolean,
): boolean {
  if (!item) return false;
  if (item.sensitivePermissions?.length && !item.sensitivePermissions.some((module) => canPerform(module, 'viewCost'))) return false;
  if (item.permissionGroups?.length) {
    return item.permissionGroups.every((group) => group.some((module) => canPerform(module)));
  }
  const required = item.permissions?.length ? item.permissions : item.permission ? [item.permission] : [];
  if (!required.length) return true;
  return item.permissionMode === 'any'
    ? required.some((module) => canPerform(module))
    : required.every((module) => canPerform(module));
}

export function dashboardItemsForAccess<T extends DashboardPermissionRule & { id: string }>(
  items: T[],
  selectedIds: string[],
  canPerform: (module: string, action?: 'view' | 'viewCost') => boolean,
  fallbackLimit = 4,
): T[] {
  const available = items.filter((item) => isDashboardItemAllowed(item, canPerform));
  const selected = available.filter((item) => selectedIds.includes(item.id));
  return selected.length ? selected : available.slice(0, fallbackLimit);
}

export function normalizePreferences(value: unknown): DashboardPreferences {
  const candidate = value as Partial<DashboardPreferences> | null;
  return {
    indicators: Array.isArray(candidate?.indicators) ? [...new Set(candidate.indicators)].filter(id => INDICATORS.some(d => d.id === id)) : [...DEFAULT_PREFERENCES.indicators],
    blocks: Array.isArray(candidate?.blocks) ? [...new Set(candidate.blocks)].filter(id => BLOCKS.some(b => b.id === id)) : [...DEFAULT_PREFERENCES.blocks],
  };
}
const day = (date: Date) => date.toISOString().slice(0, 10);
const managuaDay = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Managua',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
export function dashboardRange(period: DashboardPeriod, from: string, to: string, now = new Date()) {
  const today = managuaDay(now);
  const [year, month] = today.split('-').map(Number);
  const start = period === 'custom' ? from : period === 'today' ? today : period === 'year' ? `${year}-01-01` : `${year}-${String(period === 'quarter' ? Math.floor((month - 1) / 3) * 3 + 1 : month).padStart(2, '0')}-01`;
  const end = period === 'custom' ? to : today;
  const a = new Date(`${start}T00:00:00Z`), b = new Date(`${end}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || !Number.isFinite(+a) || !Number.isFinite(+b) || day(a) !== start || day(b) !== end || a > b) return null;
  const days = Math.round((+b - +a) / 86400000) + 1;
  return { start, end, previousStart: day(new Date(+a - days * 86400000)), previousEnd: day(new Date(+a - 86400000)), days };
}
export function changeLabel(current: number, previous: number | undefined): string | null {
  if (previous === undefined || !Number.isFinite(previous) || !Number.isFinite(current)) return null;
  if (previous === 0) return current === 0 ? 'Sin variación' : 'Sin base comparable';
  const change = (current - previous) / Math.abs(previous) * 100;
  return `${change > 0 ? '+' : ''}${change.toLocaleString('es-NI', { maximumFractionDigits: 1 })}%`;
}
export function chartRows(rows: { date: string; revenue: number; expenses: number }[], range: NonNullable<ReturnType<typeof dashboardRange>>, granularity: 'auto' | 'day' | 'month' = 'auto') {
  const values = new Map(rows.map(r => [r.date, r]));
  const buckets = new Map<string, { date: string; revenue: number; expenses: number }>();
  for (let i = 0; i < range.days; i++) {
    const date = day(new Date(+new Date(`${range.start}T00:00:00Z`) + i * 86400000));
    const key = granularity === 'month' || (granularity === 'auto' && range.days > 62) ? date.slice(0, 7) : date;
    const row = buckets.get(key) || { date: key, revenue: 0, expenses: 0 };
    row.revenue += Number(values.get(date)?.revenue || 0);
    row.expenses += Number(values.get(date)?.expenses || 0);
    buckets.set(key, row);
  }
  return [...buckets.values()];
}
