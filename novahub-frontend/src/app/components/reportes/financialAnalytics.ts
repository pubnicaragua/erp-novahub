// ─── Capa analítica del Reporte Financiero ─────────────────────────────────────
// Centraliza los cálculos de KPI financieros. El componente solo presenta.
// Fuente de verdad de rentabilidad: Accounting (P&L). Flujo: cobros/pagos reales.

export const DAY_MS = 86400000;
export const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export type BucketMode = 'day' | 'week' | 'month';

export interface FinancialData {
  salesInvoices: any[];
  salesPayments: any[];
  salesReturns: any[];
  salesCreditNotes: any[];
  purchaseBills: any[];
  purchasePayments: any[];
  purchaseCredits: any[];
  incomes: any[];
  expenses: any[];
  recurringIncomes: any[];
  recurringExpenses: any[];
  orders: any[];
}

export function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function fmtRange(start: Date | null, end: Date | null): string {
  if (!start || !end) return 'período anterior';
  const s = `${start.getDate()} ${MONTH_NAMES[start.getMonth()].toLowerCase()} ${start.getFullYear()}`;
  const e = `${end.getDate()} ${MONTH_NAMES[end.getMonth()].toLowerCase()} ${end.getFullYear()}`;
  return `${s} – ${e}`;
}

export function getRangeDates(range: string): { start: Date; prevStart: Date | null; prevEnd: Date | null; durationDays: number | null } {
  const now = new Date();
  const end = endOfDay(now);
  let start: Date;
  switch (range) {
    case 'hoy': start = startOfDay(now); break;
    case 'ultima-semana': start = new Date(end.getTime() - 6 * DAY_MS); break;
    case 'ultimo-mes': start = new Date(end.getTime() - 29 * DAY_MS); break;
    case 'ultimo-trimestre': start = new Date(end.getTime() - 89 * DAY_MS); break;
    case 'ultimo-año': start = new Date(end.getTime() - 364 * DAY_MS); break;
    default: return { start: new Date(0), prevStart: null, prevEnd: null, durationDays: null };
  }
  start = startOfDay(start);
  const durationMs = end.getTime() - start.getTime() + 1;
  const prevEnd = new Date(start.getTime() - 1);
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = new Date(prevEnd.getTime() - durationMs + 1);
  prevStart.setHours(0, 0, 0, 0);
  return { start, prevStart, prevEnd, durationDays: Math.round(durationMs / DAY_MS) };
}

export function shiftYearClamped(d: Date, years: number): Date {
  const day = Math.min(d.getDate(), new Date(d.getFullYear() - years, d.getMonth() + 1, 0).getDate());
  return new Date(d.getFullYear() - years, d.getMonth(), day, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
}

export function bucketKey(d: Date, mode: BucketMode): string {
  if (mode === 'day') return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  if (mode === 'month') return `${d.getFullYear()}-${d.getMonth()}`;
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${monday.getFullYear()}-W${String(Math.ceil((monday.getDate() + (new Date(monday.getFullYear(), monday.getMonth(), 1).getDay() + 6) % 7 - 1) / 7)).padStart(2, '0')}`;
}

export function bucketLabel(d: Date, mode: BucketMode): string {
  if (mode === 'day') return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
  if (mode === 'month') return MONTH_NAMES[d.getMonth()];
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  if (monday.getMonth() === sunday.getMonth()) return `${monday.getDate()}–${sunday.getDate()} ${MONTH_NAMES[monday.getMonth()]}`;
  return `${monday.getDate()} ${MONTH_NAMES[monday.getMonth()]} – ${sunday.getDate()} ${MONTH_NAMES[sunday.getMonth()]}`;
}

export function getBucketMode(days: number): BucketMode {
  if (days <= 31) return 'day';
  if (days <= 120) return 'week';
  return 'month';
}

// ─── Filtros de validez (excluyen anulados, borradores, notas de crédito) ─────

export function isValidSalesInvoice(status: unknown): boolean {
  const s = String(status || '').toUpperCase();
  return s !== 'CANCELLED' && s !== 'CANCELED' && s !== 'REJECTED' && s !== 'REFUNDED' && s !== 'VOIDED';
}

export function isCreditRecord(inv: any): boolean {
  return String(inv?.type || '').toUpperCase() === 'CREDIT_NOTE' || inv?.isCreditNote === true || inv?.isReturn === true;
}

export function isValidBill(status: unknown): boolean {
  const s = String(status || '').toUpperCase();
  return s !== 'CANCELLED' && s !== 'CANCELED' && s !== 'REJECTED' && s !== 'REFUNDED' && s !== 'VOIDED';
}

export function isActivePayment(p: any): boolean {
  return p.isActive !== false;
}

export function isValidSupplierCredit(status: unknown): boolean {
  const s = String(status || '').toUpperCase();
  return s === 'ISSUED' || s === 'APPLIED';
}

export function isValidExpense(status: unknown): boolean {
  const s = String(status || '').toUpperCase();
  return s === 'APPROVED' || s === 'PAID' || s === '' || s === 'ACTIVE';
}

const TRANSFER_HINTS = ['TRANSFER', 'TRANSFERENCIA', 'ENTRE CUENTAS', 'TRASPASO', 'INTERNO'];

export function isTransfer(r: any): boolean {
  const haystack = `${r?.source || ''} ${r?.category || ''} ${r?.description || ''} ${r?.type || ''} ${r?.reference || ''}`.toUpperCase();
  return TRANSFER_HINTS.some(h => haystack.includes(h));
}

const PURCHASE_DERIVED_HINTS = ['FACTURA_PROVEEDOR', 'SUPPLIER_INVOICE', 'PURCHASE_INVOICE', 'BILL_PROVEEDOR', 'RECIBO_PROVEEDOR'];

// Gastos generados automáticamente desde facturas de proveedor: no sumar como
// pago adicional (el pago a proveedor ya mueve la caja).
export function isPurchaseDerived(r: any): boolean {
  const haystack = `${r?.source || ''} ${r?.referenceType || ''} ${r?.type || ''} ${r?.reference || ''} ${r?.number || ''}`.toUpperCase();
  return PURCHASE_DERIVED_HINTS.some(h => haystack.includes(h));
}

// ─── Conversión monetaria ─────────────────────────────────────────────────────

export function toNioAmt(amount: number | null | undefined, currency: string | undefined, rate: number | undefined, exchangeRate: number): number {
  return currency === 'USD' ? Number(amount || 0) * (rate || exchangeRate) : Number(amount || 0);
}

export function toNio(doc: any, exchangeRate: number): number {
  return doc?.currency === 'USD' ? Number(doc.total || 0) * (doc.exchangeRate || exchangeRate) : Number(doc.total || 0);
}

export function saldoOf(doc: any, exchangeRate: number): number {
  return toNioAmt(doc?.balance ?? doc?.balanceDue ?? (Number(doc?.total || 0) - Number(doc?.amountPaid || 0)), doc?.currency, doc?.exchangeRate, exchangeRate);
}

export function isPendingDoc(doc: any): boolean {
  if (String(doc?.status || '').toUpperCase() === 'PAID') return false;
  const rawBalance = Number(doc?.balance ?? doc?.balanceDue ?? (Number(doc?.total || 0) - Number(doc?.amountPaid || 0)));
  return rawBalance > 0;
}

export function daysUntil(date: Date | null): number | null {
  if (!date) return null;
  return Math.ceil((startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / DAY_MS);
}

// ─── Serie de cobros, pagos y flujo neto ──────────────────────────────────────

export interface FinSeriePoint {
  key: string;
  label: string;
  ingresos: number;
  pagos: number;
  flujo: number;
  acumIngresos: number;
  acumPagos: number;
  acumFlujo: number;
  categorias: { nombre: string; monto: number; tipo: 'ingreso' | 'pago' }[];
}

export function buildFinSerie(
  d: FinancialData,
  start: Date,
  end: Date,
  durationDays: number | null,
  exchangeRate: number
): { mode: BucketMode; points: FinSeriePoint[] } {
  const mode = durationDays ? getBucketMode(durationDays) : 'month' as BucketMode;
  const firstDate = [...d.salesPayments, ...d.purchasePayments, ...d.incomes, ...d.expenses].reduce<Date | null>((acc, item) => {
    const dt = toDate(item.date || item.createdAt);
    if (!dt) return acc;
    return !acc || dt.getTime() < acc.getTime() ? dt : acc;
  }, null);
  const cursor = new Date(durationDays ? start : (firstDate ? startOfDay(firstDate) : new Date(0)));
  const byKey = new Map<string, FinSeriePoint>();
  let guard = 0;
  while (cursor.getTime() <= end.getTime() && guard < 500) {
    const key = bucketKey(cursor, mode);
    if (!byKey.has(key)) byKey.set(key, { key, label: bucketLabel(cursor, mode), ingresos: 0, pagos: 0, flujo: 0, acumIngresos: 0, acumPagos: 0, acumFlujo: 0, categorias: [] });
    cursor.setDate(cursor.getDate() + 1);
    guard++;
  }
  const catIng = new Map<string, number>();
  const catPag = new Map<string, number>();
  d.salesPayments.forEach(p => {
    if (!isActivePayment(p)) return;
    const dt = toDate(p.date || p.createdAt);
    if (!dt) return;
    const pt = byKey.get(bucketKey(dt, mode));
    if (!pt) return;
    const monto = toNioAmt(p.amount, p.currency, p.exchangeRate, exchangeRate);
    pt.ingresos += monto;
    const name = p.customer?.name || p.customerName || 'Cobros de ventas';
    catIng.set(name, (catIng.get(name) || 0) + monto);
  });
  d.incomes.forEach(i => {
    if (isTransfer(i)) return;
    const dt = toDate(i.date || i.createdAt);
    if (!dt) return;
    const pt = byKey.get(bucketKey(dt, mode));
    if (!pt) return;
    const monto = toNioAmt(i.amount, i.currency, i.exchangeRate, exchangeRate);
    pt.ingresos += monto;
    catIng.set(i.category || 'Otros ingresos', (catIng.get(i.category || 'Otros ingresos') || 0) + monto);
  });
  d.purchasePayments.forEach(p => {
    if (!isActivePayment(p)) return;
    const dt = toDate(p.date || p.createdAt);
    if (!dt) return;
    const pt = byKey.get(bucketKey(dt, mode));
    if (!pt) return;
    const monto = toNioAmt(p.amount, p.currency, p.exchangeRate, exchangeRate);
    pt.pagos += monto;
    const name = p.supplier?.name || p.vendorName || 'Pagos a proveedores';
    catPag.set(name, (catPag.get(name) || 0) + monto);
  });
  d.expenses.forEach(e => {
    if (isTransfer(e) || isPurchaseDerived(e) || !isValidExpense(e.status)) return;
    const dt = toDate(e.date || e.createdAt);
    if (!dt) return;
    const pt = byKey.get(bucketKey(dt, mode));
    if (!pt) return;
    const monto = toNioAmt(e.amount, e.currency, e.exchangeRate, exchangeRate);
    pt.pagos += monto;
    catPag.set(e.category || 'Gastos operativos', (catPag.get(e.category || 'Gastos operativos') || 0) + monto);
  });
  const allPoints = Array.from(byKey.values());
  allPoints.forEach(pt => {
    pt.flujo = pt.ingresos - pt.pagos;
    pt.categorias = [
      ...Array.from(catIng.entries()).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([nombre, monto]) => ({ nombre, monto, tipo: 'ingreso' as const })),
      ...Array.from(catPag.entries()).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([nombre, monto]) => ({ nombre, monto, tipo: 'pago' as const })),
    ].sort((a, b) => b.monto - a.monto).slice(0, 3);
  });
  const slice = [...allPoints];
  if (!durationDays) {
    let firstIdx = -1;
    let lastIdx = -1;
    slice.forEach((pt, idx) => {
      if (pt.ingresos > 0 || pt.pagos > 0) {
        if (firstIdx === -1) firstIdx = idx;
        lastIdx = idx;
      }
    });
    if (firstIdx === -1) return { mode, points: [] };
    slice.splice(0, firstIdx);
    slice.length = lastIdx - firstIdx + 1;
  }
  let ai = 0;
  let ap = 0;
  slice.forEach(pt => {
    ai += pt.ingresos;
    ap += pt.pagos;
    pt.acumIngresos = ai;
    pt.acumPagos = ap;
    pt.acumFlujo = ai - ap;
  });
  return { mode, points: slice };
}

// ─── KPIs de flujo del período ────────────────────────────────────────────────

export function flowTotals(d: FinancialData, from: Date, to: Date, exchangeRate: number) {
  const inRange = (item: any) => {
    const dt = toDate(item.date || item.createdAt);
    return !!dt && dt.getTime() >= from.getTime() && dt.getTime() <= to.getTime();
  };
  let ingresos = 0;
  let ingresosMov = 0;
  d.salesPayments.forEach(p => {
    if (isActivePayment(p) && inRange(p)) { ingresos += toNioAmt(p.amount, p.currency, p.exchangeRate, exchangeRate); ingresosMov++; }
  });
  d.incomes.forEach(i => {
    if (!isTransfer(i) && inRange(i)) { ingresos += toNioAmt(i.amount, i.currency, i.exchangeRate, exchangeRate); ingresosMov++; }
  });
  let pagos = 0;
  let pagosMov = 0;
  d.purchasePayments.forEach(p => {
    if (isActivePayment(p) && inRange(p)) { pagos += toNioAmt(p.amount, p.currency, p.exchangeRate, exchangeRate); pagosMov++; }
  });
  d.expenses.forEach(e => {
    if (!isTransfer(e) && !isPurchaseDerived(e) && isValidExpense(e.status) && inRange(e)) { pagos += toNioAmt(e.amount, e.currency, e.exchangeRate, exchangeRate); pagosMov++; }
  });
  return { ingresos, pagos, ingresosMov, pagosMov, flujoNeto: ingresos - pagos };
}

export function coberturaPagos(ingresos: number, pagos: number): number | null {
  if (pagos <= 0) return null;
  return (ingresos / pagos) * 100;
}

// ─── Posición financiera (CxC, CxP, compromisos) ─────────────────────────────

export function buildPosition(d: FinancialData, exchangeRate: number) {
  const cxcInvoices = d.salesInvoices.filter(i => isValidSalesInvoice(i.status) && !isCreditRecord(i) && isPendingDoc(i));
  const cxcTotal = cxcInvoices.reduce((a, i) => a + saldoOf(i, exchangeRate), 0);
  const cxcVencido = cxcInvoices.reduce((a, i) => {
    const due = toDate(i.dueDate);
    return a + (due && due.getTime() < Date.now() ? saldoOf(i, exchangeRate) : 0);
  }, 0);
  const cxpBills = d.purchaseBills.filter(b => isValidBill(b.status) && isPendingDoc(b));
  const cxpTotal = cxpBills.reduce((a, b) => a + saldoOf(b, exchangeRate), 0);
  const cxpVencido = cxpBills.reduce((a, b) => {
    const due = toDate(b.dueDate);
    return a + (due && due.getTime() < Date.now() ? saldoOf(b, exchangeRate) : 0);
  }, 0);
  const nowMs = startOfDay(new Date()).getTime();
  const bucket = (days: number) => {
    const limit = nowMs + days * DAY_MS;
    const items = cxpBills.filter(b => {
      const due = toDate(b.dueDate);
      return !!due && due.getTime() >= nowMs && due.getTime() <= limit;
    });
    const recurrentes = d.recurringExpenses.filter(r => {
      const s = String(r.status || '').toUpperCase();
      const nd = toDate(r.nextDate || r.nextExpenseDate);
      return (s === 'ACTIVE' || s === '') && !!nd && nd.getTime() >= nowMs && nd.getTime() <= limit;
    });
    const monto = items.reduce((a, b) => a + saldoOf(b, exchangeRate), 0)
      + recurrentes.reduce((a, r) => a + toNioAmt(r.amount, r.currency, r.exchangeRate, exchangeRate), 0);
    return { monto, count: items.length + recurrentes.length };
  };
  return {
    cxc: { total: cxcTotal, vencido: cxcVencido, facturas: cxcInvoices.length },
    cxp: { total: cxpTotal, vencido: cxpVencido, facturas: cxpBills.length },
    compromisos: { d7: bucket(7), d15: bucket(15), d30: bucket(30) },
  };
}

// ─── Antigüedad ───────────────────────────────────────────────────────────────

export function buildAging(invoices: any[], exchangeRate: number) {
  const ranges = [
    { label: 'No vencido', min: -Infinity, max: 0 },
    { label: '1–30 días', min: 1, max: 30 },
    { label: '31–60 días', min: 31, max: 60 },
    { label: '61–90 días', min: 61, max: 90 },
    { label: 'Más de 90 días', min: 91, max: Infinity },
  ];
  const pend = invoices.filter(i => isPendingDoc(i));
  const buckets = ranges.map(r => {
    const items = pend.filter(inv => {
      const due = toDate(inv.dueDate);
      const days = due ? Math.floor((Date.now() - due.getTime()) / DAY_MS) : -Infinity;
      return days >= r.min && days <= r.max;
    });
    const monto = items.reduce((a, inv) => a + saldoOf(inv, exchangeRate), 0);
    return { label: r.label, monto, facturas: items.length };
  });
  const total = buckets.reduce((a, b) => a + b.monto, 0);
  return { buckets: buckets.map(b => ({ ...b, pct: total > 0 ? (b.monto / total) * 100 : 0 })), total };
}

// ─── Composición de ingresos / pagos ──────────────────────────────────────────

export interface CompositionRow {
  nombre: string;
  monto: number;
  movimientos: number;
  pct: number;
  variacion: number | null;
}

export function buildIngresoComposition(d: FinancialData, from: Date, to: Date, prevFrom: Date | null, prevTo: Date | null, exchangeRate: number): { rows: CompositionRow[]; movimientos: any[] } {
  const inRange = (item: any) => {
    const dt = toDate(item.date || item.createdAt);
    return !!dt && dt.getTime() >= from.getTime() && dt.getTime() <= to.getTime();
  };
  const inPrev = (item: any) => {
    if (!prevFrom || !prevTo) return false;
    const dt = toDate(item.date || item.createdAt);
    return !!dt && dt.getTime() >= prevFrom.getTime() && dt.getTime() <= prevTo.getTime();
  };
  const rows: CompositionRow[] = [];
  const addRow = (nombre: string, monto: number, mov: number, prev: number) => {
    rows.push({ nombre, monto, movimientos: mov, pct: 0, variacion: prev > 0 ? ((monto - prev) / prev) * 100 : null });
  };
  const cobros = d.salesPayments.filter(p => isActivePayment(p));
  addRow('Cobros de clientes', cobros.filter(inRange).reduce((a, p) => a + toNioAmt(p.amount, p.currency, p.exchangeRate, exchangeRate), 0), cobros.filter(inRange).length, cobros.filter(inPrev).reduce((a, p) => a + toNioAmt(p.amount, p.currency, p.exchangeRate, exchangeRate), 0));
  const bucketIngresos = (matcher: (i: any) => boolean) => {
    const cur = d.incomes.filter(i => !isTransfer(i) && matcher(i) && inRange(i)).reduce((a, i) => a + toNioAmt(i.amount, i.currency, i.exchangeRate, exchangeRate), 0);
    const curMov = d.incomes.filter(i => !isTransfer(i) && matcher(i) && inRange(i)).length;
    const prev = d.incomes.filter(i => !isTransfer(i) && matcher(i) && inPrev(i)).reduce((a, i) => a + toNioAmt(i.amount, i.currency, i.exchangeRate, exchangeRate), 0);
    return { cur, curMov, prev };
  };
  const esRecurrente = (i: any) => /RECURRENTE|RECURRING/i.test(`${i.description || ''} ${i.source || ''}`);
  const esFinanciero = (i: any) => /FINANCIERO|INTERES|BANCARIO|COMISION|RENDIMIENTO|DIVIDENDO/i.test(`${i.category || ''} ${i.description || ''} ${i.source || ''}`);
  const rec = bucketIngresos(esRecurrente);
  addRow('Ingresos recurrentes', rec.cur, rec.curMov, rec.prev);
  const fin = bucketIngresos(esFinanciero);
  addRow('Ingresos financieros', fin.cur, fin.curMov, fin.prev);
  const resto = bucketIngresos(i => !esRecurrente(i) && !esFinanciero(i));
  addRow('Otros ingresos operativos', resto.cur, resto.curMov, resto.prev);
  const total = rows.reduce((a, r) => a + r.monto, 0);
  rows.forEach(r => { r.pct = total > 0 ? (r.monto / total) * 100 : 0; });
  const movimientos = [
    ...cobros.filter(inRange).map(p => ({
      fecha: toDate(p.date || p.createdAt),
      concepto: p.reference || p.notes || 'Cobro de cliente',
      cuenta: 'Cobranza',
      origen: 'Ventas',
      documento: p.number || p.id,
      monto: toNioAmt(p.amount, p.currency, p.exchangeRate, exchangeRate),
      estado: 'Aplicado',
      tipo: 'ingreso' as const,
    })),
    ...d.incomes.filter(i => !isTransfer(i) && inRange(i)).map(i => ({
      fecha: toDate(i.date || i.createdAt),
      concepto: i.description || 'Otro ingreso',
      cuenta: esFinanciero(i) ? 'Ingresos financieros' : esRecurrente(i) ? 'Ingresos recurrentes' : 'Otros ingresos operativos',
      origen: 'Finanzas',
      documento: i.number || i.id,
      monto: toNioAmt(i.amount, i.currency, i.exchangeRate, exchangeRate),
      estado: 'Registrado',
      tipo: 'ingreso' as const,
    })),
  ].sort((a, b) => ((b.fecha || new Date(0)) as Date).getTime() - ((a.fecha || new Date(0)) as Date).getTime());
  return { rows, movimientos };
}

export function buildPagoComposition(d: FinancialData, from: Date, to: Date, prevFrom: Date | null, prevTo: Date | null, exchangeRate: number): { rows: CompositionRow[]; movimientos: any[] } {
  const inRange = (item: any) => {
    const dt = toDate(item.date || item.createdAt);
    return !!dt && dt.getTime() >= from.getTime() && dt.getTime() <= to.getTime();
  };
  const inPrev = (item: any) => {
    if (!prevFrom || !prevTo) return false;
    const dt = toDate(item.date || item.createdAt);
    return !!dt && dt.getTime() >= prevFrom.getTime() && dt.getTime() <= prevTo.getTime();
  };
  const rows: CompositionRow[] = [];
  const addRow = (nombre: string, monto: number, mov: number, prev: number) => {
    rows.push({ nombre, monto, movimientos: mov, pct: 0, variacion: prev > 0 ? ((monto - prev) / prev) * 100 : null });
  };
  const pagosProv = d.purchasePayments.filter(p => isActivePayment(p));
  addRow('Proveedores', pagosProv.filter(inRange).reduce((a, p) => a + toNioAmt(p.amount, p.currency, p.exchangeRate, exchangeRate), 0), pagosProv.filter(inRange).length, pagosProv.filter(inPrev).reduce((a, p) => a + toNioAmt(p.amount, p.currency, p.exchangeRate, exchangeRate), 0));
  const expenses = d.expenses.filter(e => !isTransfer(e) && !isPurchaseDerived(e) && isValidExpense(e.status));
  const bucketGastos = (matcher: (e: any) => boolean, nombre: string) => {
    const cur = expenses.filter(e => matcher(e) && inRange(e)).reduce((a, e) => a + toNioAmt(e.amount, e.currency, e.exchangeRate, exchangeRate), 0);
    const curMov = expenses.filter(e => matcher(e) && inRange(e)).length;
    const prev = expenses.filter(e => matcher(e) && inPrev(e)).reduce((a, e) => a + toNioAmt(e.amount, e.currency, e.exchangeRate, exchangeRate), 0);
    addRow(nombre, cur, curMov, prev);
  };
  const esNomina = (e: any) => /NOMINA|PAYROLL|SUELDO|SALARIO|INSS|INATEC|PLANILLA/i.test(`${e.category || ''} ${e.description || ''} ${e.source || ''}`);
  const esImpuesto = (e: any) => /IMPUESTO|IVA|RETENCION|TAX|INSS|INATEC|ALCALDIA/i.test(`${e.category || ''} ${e.description || ''} ${e.source || ''}`);
  const esFinanciero = (e: any) => /FINANCIERO|INTERES|BANCARIO|COMISION|SOBREGIRO/i.test(`${e.category || ''} ${e.description || ''} ${e.source || ''}`);
  const esInversion = (e: any) => /INVERSION|ACTIVO|ACTIVOS|EQUIPO|MAQUINARIA|VEHICULO|MUEBLE/i.test(`${e.category || ''} ${e.description || ''} ${e.source || ''}`);
  bucketGastos(esNomina, 'Nómina');
  bucketGastos(esImpuesto, 'Impuestos');
  bucketGastos(esFinanciero, 'Gastos financieros');
  bucketGastos(esInversion, 'Inversión');
  bucketGastos(e => !esNomina(e) && !esImpuesto(e) && !esFinanciero(e) && !esInversion(e), 'Gastos operativos');
  const total = rows.reduce((a, r) => a + r.monto, 0);
  rows.forEach(r => { r.pct = total > 0 ? (r.monto / total) * 100 : 0; });
  const movimientos = [
    ...pagosProv.filter(inRange).map(p => ({
      fecha: toDate(p.date || p.createdAt),
      concepto: p.reference || p.notes || 'Pago a proveedor',
      cuenta: 'Proveedores',
      origen: 'Compras',
      documento: p.number || p.id,
      monto: toNioAmt(p.amount, p.currency, p.exchangeRate, exchangeRate),
      estado: 'Aplicado',
      tipo: 'pago' as const,
    })),
    ...expenses.filter(inRange).map(e => ({
      fecha: toDate(e.date || e.createdAt),
      concepto: e.description || 'Gasto',
      cuenta: esNomina(e) ? 'Nómina' : esImpuesto(e) ? 'Impuestos' : esFinanciero(e) ? 'Gastos financieros' : esInversion(e) ? 'Inversión' : 'Gastos operativos',
      origen: 'Finanzas',
      documento: e.number || e.id,
      monto: toNioAmt(e.amount, e.currency, e.exchangeRate, exchangeRate),
      estado: String(e.status || 'registrado'),
      tipo: 'pago' as const,
    })),
  ].sort((a, b) => ((b.fecha || new Date(0)) as Date).getTime() - ((a.fecha || new Date(0)) as Date).getTime());
  return { rows, movimientos };
}

// ─── Histórico de saldo (saldo inicial real + flujo) ─────────────────────────

export function buildCashHistory(serie: FinSeriePoint[], saldoInicial: number): { label: string; saldo: number }[] {
  let saldo = saldoInicial;
  return serie.map(pt => {
    saldo += pt.flujo;
    return { label: pt.label, saldo };
  });
}

// ─── Proyección 30/60/90 días ─────────────────────────────────────────────────

export interface ForecastPoint {
  label: string;
  fecha: Date;
  saldo: number;
  proyectado: boolean;
  entradas: number;
  salidas: number;
}

export function buildForecast(d: FinancialData, saldoInicial: number, exchangeRate: number, horizonDays = 90) {
  const nowMs = startOfDay(new Date()).getTime();
  const endMs = nowMs + horizonDays * DAY_MS;
  const entradas: { fecha: Date; monto: number; detalle: string }[] = [];
  const salidas: { fecha: Date; monto: number; detalle: string }[] = [];
  d.salesInvoices.forEach(i => {
    if (!isValidSalesInvoice(i.status) || isCreditRecord(i)) return;
    const saldo = saldoOf(i, exchangeRate);
    if (saldo <= 0) return;
    const due = toDate(i.dueDate);
    if (due && due.getTime() >= nowMs && due.getTime() <= endMs) entradas.push({ fecha: due, monto: saldo, detalle: `${i.number || ''} · ${i.customer?.name || i.customerName || 'Cliente'}` });
  });
  d.recurringIncomes.forEach(r => {
    const s = String(r.status || '').toUpperCase();
    const nd = toDate(r.nextDate || r.nextIncomeDate);
    if ((s === 'ACTIVE' || s === '') && nd && nd.getTime() >= nowMs && nd.getTime() <= endMs) entradas.push({ fecha: nd, monto: toNioAmt(r.amount, r.currency, r.exchangeRate, exchangeRate), detalle: `${r.description || 'Ingreso recurrente'} (recurrente)` });
  });
  d.purchaseBills.forEach(b => {
    if (!isValidBill(b.status)) return;
    const saldo = saldoOf(b, exchangeRate);
    if (saldo <= 0) return;
    const due = toDate(b.dueDate);
    if (due && due.getTime() >= nowMs && due.getTime() <= endMs) salidas.push({ fecha: due, monto: saldo, detalle: `${b.number || ''} · ${b.supplier?.name || b.vendorName || 'Proveedor'}` });
  });
  d.recurringExpenses.forEach(r => {
    const s = String(r.status || '').toUpperCase();
    const nd = toDate(r.nextDate || r.nextExpenseDate);
    if ((s === 'ACTIVE' || s === '') && nd && nd.getTime() >= nowMs && nd.getTime() <= endMs) salidas.push({ fecha: nd, monto: toNioAmt(r.amount, r.currency, r.exchangeRate, exchangeRate), detalle: `${r.description || 'Gasto recurrente'} (recurrente)` });
  });
  const points: ForecastPoint[] = [];
  const cursor = new Date(nowMs);
  let saldo = saldoInicial;
  let primerDeficit: Date | null = null;
  let deficitMaximo = 0;
  let saldoMinimo = saldoInicial;
  const buckets = horizonDays === 90 ? [30, 60, 90] : [horizonDays];
  let cursorIndex = 0;
  while (cursor.getTime() <= endMs) {
    const dayMs = cursor.getTime();
    let entradasDia = 0;
    let salidasDia = 0;
    entradas.forEach(e => { if (e.fecha.getTime() === dayMs) entradasDia += e.monto; });
    salidas.forEach(s => { if (s.fecha.getTime() === dayMs) salidasDia += s.monto; });
    saldo += entradasDia - salidasDia;
    if (saldo < saldoMinimo) saldoMinimo = saldo;
    if (saldo < 0) {
      deficitMaximo = Math.min(deficitMaximo, saldo);
      if (!primerDeficit) primerDeficit = new Date(cursor);
    }
    cursorIndex++;
    if (cursorIndex === buckets[0]) points.push({ label: `${cursor.getDate()} ${MONTH_NAMES[cursor.getMonth()].toLowerCase()}`, fecha: new Date(cursor), saldo, proyectado: true, entradas: entradasDia, salidas: salidasDia });
    else if (buckets.length > 1 && cursorIndex === buckets[1]) points.push({ label: `${cursor.getDate()} ${MONTH_NAMES[cursor.getMonth()].toLowerCase()}`, fecha: new Date(cursor), saldo, proyectado: true, entradas: entradasDia, salidas: salidasDia });
    else if (buckets.length > 1 && cursorIndex === buckets[2]) points.push({ label: `${cursor.getDate()} ${MONTH_NAMES[cursor.getMonth()].toLowerCase()}`, fecha: new Date(cursor), saldo, proyectado: true, entradas: entradasDia, salidas: salidasDia });
    cursor.setDate(cursor.getDate() + 1);
  }
  const totalEntradas = entradas.reduce((a, e) => a + e.monto, 0);
  const totalSalidas = salidas.reduce((a, s) => a + s.monto, 0);
  const scheduled = entradas.length + salidas.length;
  const confianza = scheduled >= 15 ? 'Representativa' : scheduled >= 6 ? 'Media' : 'Baja';
  return {
    entradas, salidas,
    puntos: points,
    totalEntradas, totalSalidas,
    saldoFinal: saldoInicial + totalEntradas - totalSalidas,
    primerDeficit, deficitMaximo: deficitMaximo < 0 ? deficitMaximo : null,
    saldoMinimo, confianza, scheduled,
  };
}

// ─── Rentabilidad desde P&L (Accounting) ──────────────────────────────────────

export interface PnLRow { label: string; monto: number | null; prev: number | null; variacion: number | null; }

export function buildProfitability(pl: any, plPrev: any | null): { rows: PnLRow[]; totalIngresos: number; utilidadNeta: number; margenNeto: number | null; margenBruto: number | null; margenOperativo: number | null; margenBrutoPrev: number | null; margenOperativoPrev: number | null; gastosFinancieros: number; resultadoOperativo: number; advertencia: boolean } {
  const cur = pl?.current || {};
  const ingresos: any[] = cur.ingresos || [];
  const gastos: any[] = cur.gastos || [];
  const prev = plPrev?.current || null;
  const pIngresos: any[] = prev?.ingresos || [];
  const pGastos: any[] = prev?.gastos || [];
  const sum = (arr: any[], filter?: (a: any) => boolean) => arr.filter(a => !filter || filter(a)).reduce((acc, a) => acc + Number(a.balance || 0), 0);
  const costo = (arr: any[]) => sum(arr, a => /COSTO|COSTO DE VENTA|COSTO DE VENTAS|costo de venta/i.test(`${a.code} ${a.name}`));
  const operativos = (arr: any[]) => sum(arr, a => !/COSTO|COSTO DE VENTA|costo de venta/i.test(`${a.code} ${a.name}`) && !/IMPUESTO|RETENCION|FINANCIERO|INTERES|BANCARIO/i.test(`${a.code} ${a.name}`));
  const otrosGastos = (arr: any[]) => sum(arr, a => /IMPUESTO|RETENCION|FINANCIERO|INTERES|BANCARIO/i.test(`${a.code} ${a.name}`));
  const otrosIngresos = () => sum(ingresos, a => /OTROS|EXTRAORDINARIO|FINANCIERO/i.test(`${a.code} ${a.name}`));
  const rows: PnLRow[] = [];
  const addRow = (label: string, monto: number, prevMonto: number) => {
    rows.push({ label, monto, prev: prevMonto, variacion: prevMonto > 0 ? ((monto - prevMonto) / prevMonto) * 100 : null });
  };
  const tIng = sum(ingresos);
  const pTIng = sum(pIngresos);
  const tGastos = sum(gastos);
  const pTGastos = sum(pGastos);
  const costos = costo(gastos);
  const pCostos = costo(pGastos);
  const ops = operativos(gastos);
  const pOps = operativos(pGastos);
  const otros = otrosGastos(gastos) - otrosIngresos();
  const pOtros = otrosGastos(pGastos);
  const utilidadBruta = tIng - costos;
  const pUtilidadBruta = pTIng - pCostos;
  const resultadoOperativo = tIng - costos - ops;
  const pResultadoOperativo = pTIng - pCostos - pOps;
  addRow('Ingresos operativos', tIng, pTIng);
  addRow('Costo de ventas', costos, pCostos);
  addRow('Utilidad bruta', utilidadBruta, Math.max(0, pUtilidadBruta));
  addRow('Gastos operativos', ops, pOps);
  addRow('Resultado operativo', resultadoOperativo, Math.max(0, pResultadoOperativo));
  addRow('Otros ingresos y gastos', otros, pOtros);
  addRow('Utilidad antes de impuestos', tIng - tGastos, Math.max(0, pTIng - pTGastos));
  addRow('Utilidad neta', cur.utilidadNeta ?? (tIng - tGastos), prev?.utilidadNeta ?? (pTIng - pTGastos));
  const utilidadNeta = cur.utilidadNeta ?? (tIng - tGastos);
  const margenNeto = tIng > 0 ? (utilidadNeta / tIng) * 100 : null;
  const margenBruto = tIng > 0 ? (utilidadBruta / tIng) * 100 : null;
  const margenBrutoPrev = pTIng > 0 ? (pUtilidadBruta / pTIng) * 100 : null;
  const margenOperativo = tIng > 0 ? (resultadoOperativo / tIng) * 100 : null;
  const margenOperativoPrev = pTIng > 0 ? (pResultadoOperativo / pTIng) * 100 : null;
  const gastosFinancieros = sum(gastos, a => /FINANCIERO|INTERES|BANCARIO/i.test(`${a.code} ${a.name}`));
  return { rows, totalIngresos: tIng, utilidadNeta, margenNeto, margenBruto, margenOperativo, margenBrutoPrev, margenOperativoPrev, gastosFinancieros, resultadoOperativo, advertencia: false };
}

// ─── Liquidez (versión operativa con clasificación contable) ─────────────────

export function buildLiquidez(efectivo: number, cxc: number, cxp: number, pagos30d: number) {
  const activoCorriente = efectivo + cxc;
  const pasivoCorriente = cxp;
  const capitalTrabajo = activoCorriente - pasivoCorriente;
  const razonCorriente = pasivoCorriente > 0 ? activoCorriente / pasivoCorriente : null;
  const pruebaAcida = pasivoCorriente > 0 ? (efectivo + cxc) / pasivoCorriente : null;
  const cobertura30 = pagos30d > 0 ? efectivo / pagos30d : null;
  return { efectivo, activoCorriente, pasivoCorriente, capitalTrabajo, razonCorriente, pruebaAcida, cobertura30 };
}

// ─── Efectivo y equivalentes desde el Balance General (Accounting) ────────────

export function cashFromBalanceSheet(balanceSheet: any): { total: number; caja: number; bancos: number; cuentas: { code: string; name: string; balance: number; tipo: 'caja' | 'banco' }[] } {
  const activos = balanceSheet?.current?.activos?.accounts || [];
  const cuentas = activos.filter((a: any) => String(a.code || '').startsWith('1000') || /caja|banco|efectivo/i.test(String(a.name || '')))
    .map((a: any) => {
      const balance = Number(a.balance || 0) + Number(a.calculatedBalance || 0);
      const tipo: 'caja' | 'banco' = /caja/i.test(String(a.name || '')) && !/banco/i.test(String(a.name || '')) ? 'caja' : 'banco';
      return { code: a.code, name: a.name, balance, tipo };
    });
  const total = cuentas.reduce((acc: number, c: any) => acc + c.balance, 0);
  const caja = cuentas.filter((c: any) => c.tipo === 'caja').reduce((acc: number, c: any) => acc + c.balance, 0);
  const bancos = cuentas.filter((c: any) => c.tipo === 'banco').reduce((acc: number, c: any) => acc + c.balance, 0);
  return { total, caja, bancos, cuentas };
}

// ─── Presupuesto desde Accounting ─────────────────────────────────────────────

export function buildBudget(items: any[], accounts: any[], trialRows: any[], year: string, month: string) {
  const accountCodeById = new Map(accounts.map(a => [a.id, a.code]));
  const active = items.filter(i => String(i.status || '').toUpperCase() === 'ACTIVE' && (i.period === year || i.period === month));
  if (active.length === 0) return null;
  const codes = new Set(active.map(i => accountCodeById.get(i.accountId)).filter(Boolean));
  const presupuesto = active.reduce((a, i) => a + Number(i.assignedAmount || 0), 0);
  const ejecutado = trialRows.filter(r => codes.has(r.accountCode)).reduce((a, r) => a + Number(r.balance || 0), 0);
  const pct = presupuesto > 0 ? (ejecutado / presupuesto) * 100 : 0;
  return { presupuesto, ejecutado, pct, disponible: Math.max(0, presupuesto - ejecutado), desviacion: ejecutado - presupuesto, count: active.length, items: active };
}

// ─── Recurrentes ──────────────────────────────────────────────────────────────

export function buildRecurrentes(recurringIncomes: any[], recurringExpenses: any[], exchangeRate: number) {
  const actIng = recurringIncomes.filter(r => { const s = String(r.status || '').toUpperCase(); return s === 'ACTIVE' || s === ''; });
  const actExp = recurringExpenses.filter(r => { const s = String(r.status || '').toUpperCase(); return s === 'ACTIVE' || s === ''; });
  const ingMensual = actIng.reduce((a, r) => a + toNioAmt(r.amount, r.currency, r.exchangeRate, exchangeRate), 0);
  const expMensual = actExp.reduce((a, r) => a + toNioAmt(r.amount, r.currency, r.exchangeRate, exchangeRate), 0);
  const nextIng = actIng.map(r => ({ fecha: toDate(r.nextDate || r.nextIncomeDate), monto: toNioAmt(r.amount, r.currency, r.exchangeRate, exchangeRate), desc: r.description || 'Ingreso recurrente' })).filter(x => x.fecha).sort((a, b) => (a.fecha as Date).getTime() - (b.fecha as Date).getTime())[0];
  const nextExp = actExp.map(r => ({ fecha: toDate(r.nextDate || r.nextExpenseDate), monto: toNioAmt(r.amount, r.currency, r.exchangeRate, exchangeRate), desc: r.description || 'Gasto recurrente' })).filter(x => x.fecha).sort((a, b) => (a.fecha as Date).getTime() - (b.fecha as Date).getTime())[0];
  return { ingresos: actIng.length, gastos: actExp.length, ingMensual, expMensual, impactoNeto: ingMensual - expMensual, nextIng, nextExp };
}

// ─── Caja y conciliación ──────────────────────────────────────────────────────

export function buildCajaInfo(registers: any[], sessions: any[], reconciliations: any[]) {
  const cajasAbiertas = registers.filter(r => r.hasActiveSession === true);
  const sesionesAbiertas = sessions.filter(s => String(s.status || '').toUpperCase() === 'OPEN' || String(s.status || '').toUpperCase() === 'COUNTING');
  const teo = sesionesAbiertas.reduce((a, s) => a + Number(s.expectedAmountNIO || s.initialAmountNIO || 0), 0) + sessions.filter(s => String(s.status || '').toUpperCase() === 'CLOSED').reduce((a, s) => a + Number(s.finalAmountNIO || s.expectedAmountNIO || 0), 0);
  const contado = sesionesAbiertas.reduce((a, s) => {
    const last = (s.countAttempts || []).slice(-1)[0];
    return a + (last ? Number(last.countedAmountNIO || 0) : 0);
  }, 0);
  const difArqueo = sesionesAbiertas.reduce((a, s) => {
    const last = (s.countAttempts || []).slice(-1)[0];
    if (!last) return a;
    return a + (Number(last.countedAmountNIO || 0) - Number(s.expectedAmountNIO || s.initialAmountNIO || 0));
  }, 0);
  const conciliadas = reconciliations.filter(r => /COMPLETED|CONCILIADO|CERRADO/i.test(String(r.status || '')));
  const pendientes = reconciliations.filter(r => !/COMPLETED|CONCILIADO|CERRADO/i.test(String(r.status || '')));
  const ultima = conciliadas.sort((a, b) => new Date(b.completedAt || b.createdAt || 0).getTime() - new Date(a.completedAt || a.createdAt || 0).getTime())[0];
  return {
    cajasAbiertas: cajasAbiertas.length > 0 ? cajasAbiertas : sesionesAbiertas.map(s => ({ name: s.cashRegister?.name || 'Caja' })),
    efectivoTeorico: teo,
    efectivoContado: contado,
    diferenciaArqueo: difArqueo,
    bancosConciliados: conciliadas.length,
    montoConciliado: conciliadas.reduce((a, r) => a + Number(r.endBalance || r.statementBalance || 0), 0),
    pendientesConciliacion: pendientes.length,
    ultimaConciliacion: ultima ? toDate(ultima.completedAt || ultima.createdAt) : null,
  };
}

// ─── Período contable cerrado ─────────────────────────────────────────────────

export function isPeriodClosed(periods: any[], ref: Date): boolean {
  const key = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
  return periods.some(p => {
    const s = String(p.status || '').toUpperCase();
    const pKey = String(p.period || p.name || '');
    return (s === 'CLOSED' || s === 'LOCKED' || s === 'CERRADO') && (pKey === key || pKey.startsWith(key));
  });
}

// ─── Punto de equilibrio ──────────────────────────────────────────────────────

export type CostBehavior = 'FIXED' | 'VARIABLE' | 'MIXED' | 'NON_OPERATING' | 'UNCLASSIFIED';

export interface BreakEvenConfig {
  [accountCode: string]: { behavior: CostBehavior; fixedPercentage?: number; variablePercentage?: number };
}

export interface BreakEvenResult {
  estado: string;
  configurados: number;
  totalCuentas: number;
  ventasNetas: number;
  totalIngresos?: number;
  costosFijos?: number;
  costosVariables?: number;
  nonOperating?: number;
  margenContribucion?: number;
  margenContribucionPct?: number;
  puntoEquilibrio?: number;
  margenSeguridad?: number;
  margenSeguridadPct?: number | null;
  ventasFaltantes?: number;
}

export function buildBreakEven(pl: any, config: BreakEvenConfig, ventasActuales: number): BreakEvenResult {
  const cur = pl?.current || {};
  const gastos: any[] = cur.gastos || [];
  const ingresos: any[] = cur.ingresos || [];
  const ventasNetas = ventasActuales;
  const totalIngresos = ingresos.reduce((a: number, g: any) => a + Number(g.balance || 0), 0);
  const clasificados = gastos.filter(g => config[g.code] && config[g.code].behavior !== 'UNCLASSIFIED');
  if (clasificados.length === 0) return { estado: 'MISSING_COST_CLASSIFICATION', configurados: 0, totalCuentas: gastos.length, ventasNetas };
  let costosFijos = 0;
  let costosVariables = 0;
  let nonOperating = 0;
  gastos.forEach(g => {
    const c = config[g.code];
    const monto = Number(g.balance || 0);
    if (!c || c.behavior === 'UNCLASSIFIED') return;
    if (c.behavior === 'FIXED') costosFijos += monto;
    else if (c.behavior === 'VARIABLE') costosVariables += monto;
    else if (c.behavior === 'MIXED') {
      const fp = Number(c.fixedPercentage ?? 50) / 100;
      costosFijos += monto * fp;
      costosVariables += monto * (1 - fp);
    } else if (c.behavior === 'NON_OPERATING') nonOperating += monto;
  });
  if (ventasNetas <= 0) return { estado: 'NO_SALES', configurados: clasificados.length, totalCuentas: gastos.length, ventasNetas, costosFijos, costosVariables, nonOperating };
  const margenContribucion = ventasNetas - costosVariables;
  const margenContribucionPct = ventasNetas > 0 ? (margenContribucion / ventasNetas) * 100 : 0;
  if (margenContribucionPct <= 0) return { estado: 'NON_POSITIVE_CONTRIBUTION_MARGIN', configurados: clasificados.length, totalCuentas: gastos.length, ventasNetas, costosFijos, costosVariables, nonOperating, margenContribucion, margenContribucionPct };
  const puntoEquilibrio = costosFijos / (margenContribucionPct / 100);
  const margenSeguridad = ventasNetas - puntoEquilibrio;
  const margenSeguridadPct = ventasNetas > 0 ? (margenSeguridad / ventasNetas) * 100 : null;
  const ventasFaltantes = Math.max(0, puntoEquilibrio - ventasNetas);
  return { estado: 'AVAILABLE', configurados: clasificados.length, totalCuentas: gastos.length, ventasNetas, totalIngresos, costosFijos, costosVariables, nonOperating, margenContribucion, margenContribucionPct, puntoEquilibrio, margenSeguridad, margenSeguridadPct, ventasFaltantes };
}

// ─── Indicadores financieros ──────────────────────────────────────────────────

export interface FinancialIndicator {
  label: string;
  value: number | null;
  formula: string;
  interpretacion: string;
}

export function buildIndicadores(bsToday: any, bsStart: any, profitability: { utilidadNeta: number; totalIngresos: number; resultadoOperativo: number; gastosFinancieros: number }, position: { cxc: { total: number }; cxp: { total: number } }, cash: number) {
  const totalOf = (bs: any, key: 'activos' | 'pasivos' | 'patrimonio') => Number(bs?.current?.[key]?.total || 0);
  const activoHoy = totalOf(bsToday, 'activos');
  const pasivoHoy = totalOf(bsToday, 'pasivos');
  const patrimonioHoy = totalOf(bsToday, 'patrimonio');
  const activoInicio = totalOf(bsStart, 'activos');
  const patrimonioInicio = totalOf(bsStart, 'patrimonio');
  const activoPromedio = (activoHoy + activoInicio) / 2;
  const patrimonioPromedio = (patrimonioHoy + patrimonioInicio) / 2;
  const pasivoCorriente = position.cxp.total;
  const indicadores: FinancialIndicator[] = [];
  const add = (label: string, value: number | null, formula: string, interpretacion: string) => {
    if (value !== null && !Number.isFinite(value)) value = null;
    indicadores.push({ label, value, formula, interpretacion });
  };
  add('Razón corriente', pasivoCorriente > 0 ? (cash + position.cxc.total) / pasivoCorriente : null, 'Activo corriente / Pasivo corriente', pasivoCorriente > 0 ? 'Mide la capacidad de cubrir obligaciones de corto plazo con activos corrientes.' : 'No existen pasivos corrientes registrados.');
  add('Prueba ácida', pasivoCorriente > 0 ? (cash + position.cxc.total) / pasivoCorriente : null, '(Efectivo + CxC) / Pasivo corriente', 'Excluye inventarios; mide liquidez inmediata sobre obligaciones de corto plazo.');
  add('Endeudamiento', activoHoy > 0 ? (pasivoHoy / activoHoy) * 100 : null, 'Pasivo total / Activo total × 100', 'Porcentaje del activo financiado con deuda.');
  add('ROA', activoPromedio > 0 ? (profitability.utilidadNeta / activoPromedio) * 100 : null, 'Utilidad neta / Activo promedio × 100', 'Rendimiento generado por cada unidad de activo.');
  add('ROE', patrimonioPromedio > 0 ? (profitability.utilidadNeta / patrimonioPromedio) * 100 : null, 'Utilidad neta / Patrimonio promedio × 100', 'Rendimiento sobre el capital de los dueños.');
  add('Rotación de activos', activoPromedio > 0 ? profitability.totalIngresos / activoPromedio : null, 'Ingresos operativos / Activo promedio', 'Eficiencia en el uso del activo para generar ingresos.');
  add('Cobertura de intereses', profitability.gastosFinancieros > 0 ? profitability.resultadoOperativo / profitability.gastosFinancieros : null, 'Resultado operativo / Gastos por intereses', profitability.gastosFinancieros > 0 ? 'Veces que el resultado operativo cubre los intereses.' : 'No existen gastos por intereses registrados.');
  return { indicadores, activoPromedio, patrimonioPromedio };
}
