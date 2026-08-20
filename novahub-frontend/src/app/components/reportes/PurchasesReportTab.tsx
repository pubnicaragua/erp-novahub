import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ComposedChart, BarChart, Line, Bar, LabelList } from 'recharts';
import { billsService, paymentsMadeService, supplierCreditsService, purchaseOrdersService, purchaseReceiptsService, purchaseRequestsService } from '../../services/compras.service';
import { contabilidadService } from '../../services/contabilidad.service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { ShoppingBag, CreditCard, Wallet, Activity, Truck, TrendingUp, Package, Scale, PieChart as PieChartIcon, AlertTriangle, Clock, Receipt, Info, Target, CalendarDays, ArrowUpRight, Percent, BarChart3, ClipboardList, FileWarning } from 'lucide-react';
import type { ReportExportRef, ReportProps } from './types';
import { useTenantQuery, asList } from '../../hooks/useTenantQuery';
import { cn } from '../ui/utils';
import { getPdfDesignSettings, pdfDesignPaper } from '../../utils/pdfGenerator';
import { downloadExcelWorkbook, getBase64Image, sanitizeHtml2CanvasOklch } from '../../utils/reportExportUtils';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DAY_MS = 86400000;

const STATUS_LABEL: Record<string, string> = {
  PAID: 'Pagada',
  PARTIAL: 'Parcial',
  PENDING: 'Pendiente',
  OVERDUE: 'Vencida',
  CANCELLED: 'Anulada',
  CANCELED: 'Anulada',
  ISSUED: 'Emitida',
  APPLIED: 'Aplicada',
  VOIDED: 'Anulada',
  REJECTED: 'Rechazada',
};
const STATUS_COLOR: Record<string, string> = {
  PAID: 'bg-emerald-500/10 text-emerald-500',
  PARTIAL: 'bg-amber-500/10 text-amber-500',
  PENDING: 'bg-slate-400/10 text-slate-400',
  OVERDUE: 'bg-rose-500/10 text-rose-500',
  CANCELLED: 'bg-rose-500/10 text-rose-500',
  CANCELED: 'bg-rose-500/10 text-rose-500',
  ISSUED: 'bg-blue-500/10 text-blue-500',
  APPLIED: 'bg-emerald-500/10 text-emerald-500',
  VOIDED: 'bg-rose-500/10 text-rose-500',
  REJECTED: 'bg-rose-500/10 text-rose-500',
};

type BucketMode = 'day' | 'week' | 'month';

interface SeriesPoint {
  key: string;
  label: string;
  facturado: number;
  nc: number;
  compras: number;
  pagos: number;
  pagosPeriodo: number;
  acumulado: number;
}

interface SupplierRow {
  name: string;
  compras: number;
  pct: number;
  facturas: number;
  saldo: number;
  trendPct: number | null;
  avgLead: number | null;
  completePct: number | null;
  incidencias: number;
  score: number | null;
}

interface ProductRow {
  name: string;
  monto: number;
  qty: number;
  priceAvg: number;
  prevPrice: number | null;
  priceTrend: number | null;
  proveedor: string;
  recepciones: number;
  pct: number;
}

type ModalState =
  | { type: 'facturas' }
  | { type: 'cxp' }
  | { type: 'retenciones' }
  | { type: 'compromisos' }
  | { type: 'suppliers' }
  | { type: 'products' }
  | { type: 'supplier'; data: SupplierRow }
  | { type: 'product'; data: ProductRow }
  | null;

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function fmtRange(start: Date | null, end: Date | null): string {
  if (!start || !end) return 'período anterior';
  const s = `${start.getDate()} ${MONTH_NAMES[start.getMonth()].toLowerCase()} ${start.getFullYear()}`;
  const e = `${end.getDate()} ${MONTH_NAMES[end.getMonth()].toLowerCase()} ${end.getFullYear()}`;
  return `${s} – ${e}`;
}

function getRangeDates(range: string): { start: Date; prevStart: Date | null; prevEnd: Date | null; durationDays: number | null } {
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

function shiftYearClamped(d: Date, years: number): Date {
  const day = Math.min(d.getDate(), new Date(d.getFullYear() - years, d.getMonth() + 1, 0).getDate());
  return new Date(d.getFullYear() - years, d.getMonth(), day, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
}

function isValidInvoiceStatus(status: unknown): boolean {
  const s = String(status || '').toUpperCase();
  return s !== 'CANCELLED' && s !== 'CANCELED' && s !== 'REJECTED' && s !== 'REFUNDED';
}

function isValidCredit(status: unknown): boolean {
  const s = String(status || '').toUpperCase();
  return s === 'ISSUED' || s === 'APPLIED';
}

function isPendingApprovalStatus(status: string): boolean {
  const s = String(status || '').toUpperCase();
  return s === 'SUBMITTED' || s === 'IN_REVIEW' || s === 'IN_QUOTATION' || s === 'PENDING_APPROVAL';
}

function bucketKey(d: Date, mode: BucketMode): string {
  if (mode === 'day') return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  if (mode === 'month') return `${d.getFullYear()}-${d.getMonth()}`;
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${monday.getFullYear()}-W${String(Math.ceil((monday.getDate() + (new Date(monday.getFullYear(), monday.getMonth(), 1).getDay() + 6) % 7 - 1) / 7)).padStart(2, '0')}`;
}

function bucketLabel(d: Date, mode: BucketMode): string {
  if (mode === 'day') return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
  if (mode === 'month') return MONTH_NAMES[d.getMonth()];
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  if (monday.getMonth() === sunday.getMonth()) return `${monday.getDate()}–${sunday.getDate()} ${MONTH_NAMES[monday.getMonth()]}`;
  return `${monday.getDate()} ${MONTH_NAMES[monday.getMonth()]} – ${sunday.getDate()} ${MONTH_NAMES[sunday.getMonth()]}`;
}

function getBucketMode(days: number): BucketMode {
  if (days <= 31) return 'day';
  if (days <= 120) return 'week';
  return 'month';
}

const DARK_TOOLTIP = {
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(12,14,20,0.97)',
  fontSize: 12,
  color: '#f4f4f5',
  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
  padding: '10px 12px',
} as const;

export const PurchasesReportTab = forwardRef<ReportExportRef, ReportProps>(({ dateRange }, ref) => {
  const { displayCurrency, baseCurrency, valuationMode, valuationModeLabel, valuationModeSuffix, formatConvertedAmount: formatAmountBySource, toBaseAmount, exchangeRate } = useCurrency();
  const { themeConfig } = useTheme();
  const { user, canPerform } = useAuth();
  const canViewPurchases = canPerform('PURCHASES', 'view');
  const canViewAccounting = canPerform('ACCOUNTING', 'view');
  const currencySymbol = displayCurrency === 'USD' ? '$' : 'C$';
  const formatConvertedAmount = (amount: number, sourceCurrency?: string, sourceExchangeRate?: number) =>
    formatAmountBySource(amount, sourceCurrency === 'NIO' ? baseCurrency : sourceCurrency, sourceExchangeRate);

  const { data: reportData, isLoading: loading } = useTenantQuery(['reports', 'purchases'], async (signal) => {
    const filters = { page: 1, pageSize: 5000, report: true } as const;
    const [billRes, payRes, credRes, ordRes, recRes, reqRes] = await Promise.all([
      billsService.getAll(filters, signal), paymentsMadeService.getAll(filters, signal),
      supplierCreditsService.getAll(filters, signal), purchaseOrdersService.getAll(filters, signal),
      purchaseReceiptsService.getAll(filters, signal), purchaseRequestsService.getAll(filters, signal),
    ]);
    return { bills: asList(billRes), payments: asList(payRes), credits: asList(credRes), orders: asList(ordRes), receipts: asList(recRes), requests: asList(reqRes) };
  }, { enabled: canViewPurchases, onError: (e) => toast.error(e.message || 'Error cargando compras') });
  const bills = reportData?.bills || [];
  const payments = reportData?.payments || [];
  const credits = reportData?.credits || [];
  const orders = reportData?.orders || [];
  const receipts = reportData?.receipts || [];
  const requests = reportData?.requests || [];
  const [budgetItems, setBudgetItems] = useState<any[]>([]);
  const [budgetAccounts, setBudgetAccounts] = useState<any[]>([]);
  const [budgetTrial, setBudgetTrial] = useState<any[]>([]);
  const [modal, setModal] = useState<ModalState>(null);
  const [evolutionTab, setEvolutionTab] = useState<'evolucion' | 'aging'>('evolucion');
  const [productMetric, setProductMetric] = useState<'monto' | 'unidades' | 'variacion'>('monto');
  const [payMode, setPayMode] = useState<'todos' | 'periodo'>('todos');
  const [comparison, setComparison] = useState<'anterior' | 'anio-anterior'>('anterior');
  const [cicloTab, setCicloTab] = useState<'operativo' | 'incidencias' | 'retenciones'>('operativo');
  const [cicloCompleto, setCicloCompleto] = useState(false);

  const fmtShort = (v: number) => {
    const num = Number(v);
    if (!Number.isFinite(num)) return `${currencySymbol}0`;
    const converted = toBaseAmount(num, baseCurrency, 1);
    if (!Number.isFinite(converted)) return `${currencySymbol}0`;
    const abs = Math.abs(converted);
    if (abs >= 1_000_000) return `${currencySymbol}${(converted / 1_000_000).toLocaleString('es-NI', { maximumFractionDigits: 1 })} millones`;
    if (abs >= 1_000) return `${currencySymbol}${(converted / 1_000).toLocaleString('es-NI', { maximumFractionDigits: 1 })} mil`;
    return `${currencySymbol}${converted.toLocaleString('es-NI', { maximumFractionDigits: 0 })}`;
  };

  useEffect(() => {
    if (!canViewAccounting) {
      setBudgetItems([]);
      setBudgetAccounts([]);
      return;
    }
    let active = true;
    Promise.all([contabilidadService.getBudgetItems(), contabilidadService.getChartOfAccounts()]).then(([bgtRes, accRes]) => {
      if (!active) return;
      const flatAccounts: any[] = [];
      const flatten = (nodes: any[]) => { for (const n of nodes) { flatAccounts.push(n); if (n.children) flatten(n.children); } };
      flatten(asList(accRes));
      setBudgetItems(asList(bgtRes));
      setBudgetAccounts(flatAccounts);
    }).catch(() => null);
    return () => { active = false; };
  }, [canViewAccounting]);

  const { start: currentStart, prevStart, prevEnd, durationDays } = useMemo(() => getRangeDates(dateRange), [dateRange]);

  useEffect(() => {
    if (currentStart.getTime() === 0 || !canViewAccounting) return;
    contabilidadService.getTrialBalance({
      dateFrom: currentStart.toISOString(),
      dateTo: new Date().toISOString()
    }).catch(() => null).then((res: any) => {
      setBudgetTrial(res?.rows || []);
    });
  }, [currentStart, canViewAccounting]);

  const navigateToBudget = () => {
    window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module: 'contabilidad', subModule: 'presupuestos' } }));
  };

  const budgetSummary = useMemo(() => {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const active = budgetItems.filter(i => String(i.status || '').toUpperCase() === 'ACTIVE' && (i.period === year || i.period === month));
    if (active.length === 0) return null;
    const accountCodeById = new Map(budgetAccounts.map(a => [a.id, a.code]));
    const codes = new Set(active.map(i => accountCodeById.get(i.accountId)).filter(Boolean));
    const presupuesto = active.reduce((a, i) => a + Number(i.assignedAmount || 0), 0);
    const ejecutado = budgetTrial.filter(r => codes.has(r.accountCode)).reduce((a, r) => a + Number(r.balance || 0), 0);
    const pct = presupuesto > 0 ? Math.min(100, (ejecutado / presupuesto) * 100) : 0;
    return { presupuesto, ejecutado, pct, disponible: Math.max(0, presupuesto - ejecutado), desviacion: ejecutado - presupuesto, count: active.length };
  }, [budgetItems, budgetAccounts, budgetTrial]);

  const { prevStart: cPrevStart, prevEnd: cPrevEnd } = useMemo(() => {
    if (!prevStart || !prevEnd || comparison === 'anterior') return { prevStart, prevEnd };
    return { prevStart: startOfDay(shiftYearClamped(prevStart, 1)), prevEnd: endOfDay(shiftYearClamped(prevEnd, 1)) };
  }, [prevStart, prevEnd, comparison]);

  const rangeLabel = useMemo(() => currentStart.getTime() > 0 ? fmtRange(currentStart, endOfDay(new Date())) : 'Todo el historial', [currentStart]);
  const prevLabel = useMemo(() => fmtRange(cPrevStart, cPrevEnd), [cPrevStart, cPrevEnd]);
  const comparativoLabel = comparison === 'anterior' ? 'período anterior' : 'mismo período del año anterior';

  const sourceRate = (rate?: number) => valuationMode === 'CURRENT' ? exchangeRate : (rate || exchangeRate);
  const toNio = (inv: any) => toNioAmt(Number(inv.total ?? inv.baseTotal ?? 0), inv.currency, inv.exchangeRate);
  const toNioAmt = (amt: number | null | undefined, currency: string | undefined, rate: number | undefined) =>
    toBaseAmount(Number(amt || 0), currency, sourceRate(rate));

  const fBillsAll = useMemo(() => bills.filter(b => isValidInvoiceStatus(b.status)), [bills]);

  const fBills = useMemo(() => fBillsAll.filter(i => {
    const d = toDate(i.date || i.createdAt);
    return !!d && d.getTime() >= currentStart.getTime();
  }), [fBillsAll, currentStart]);

  const pBills = useMemo(() => (cPrevStart && cPrevEnd) ? fBillsAll.filter(i => {
    const d = toDate(i.date || i.createdAt);
    return !!d && d.getTime() >= cPrevStart.getTime() && d.getTime() <= cPrevEnd.getTime();
  }) : [], [fBillsAll, cPrevStart, cPrevEnd]);

  const fCredits = useMemo(() => credits.filter(c => {
    const d = toDate(c.date || c.createdAt);
    return isValidCredit(c.status) && !!d && d.getTime() >= currentStart.getTime();
  }), [credits, currentStart]);

  const pCredits = useMemo(() => (cPrevStart && cPrevEnd) ? credits.filter(c => {
    const d = toDate(c.date || c.createdAt);
    return isValidCredit(c.status) && !!d && d.getTime() >= cPrevStart.getTime() && d.getTime() <= cPrevEnd.getTime();
  }) : [], [credits, cPrevStart, cPrevEnd]);

  const fPay = useMemo(() => payments.filter(p => p.isActive !== false && !!toDate(p.date || p.createdAt) && toDate(p.date || p.createdAt)!.getTime() >= currentStart.getTime()), [payments, currentStart]);

  const pPay = useMemo(() => (cPrevStart && cPrevEnd) ? payments.filter(p => {
    const d = toDate(p.date || p.createdAt);
    return p.isActive !== false && !!d && d.getTime() >= cPrevStart.getTime() && d.getTime() <= cPrevEnd.getTime();
  }) : [], [payments, cPrevStart, cPrevEnd]);

  const { comprasNetas, facturadoBruto, notasCredito, facturasValidas } = useMemo(() => {
    const bruto = fBills.reduce((acc, i) => acc + toNio(i), 0);
    const nc = fCredits.reduce((a, c) => a + toNioAmt(c.total, c.currency, c.exchangeRate), 0);
    return { comprasNetas: Math.max(0, bruto - nc), facturadoBruto: bruto, notasCredito: nc, facturasValidas: fBills.length };
  }, [fBills, fCredits, exchangeRate]);

  const { pComprasNetas, pFacturas } = useMemo(() => {
    const pNC = pCredits.reduce((a, c) => a + toNioAmt(c.total, c.currency, c.exchangeRate), 0);
    return { pComprasNetas: Math.max(0, pBills.reduce((a, i) => a + toNio(i), 0) - pNC), pFacturas: pBills.length };
  }, [pBills, pCredits, exchangeRate]);

  const totalPaid = useMemo(() => fPay.reduce((acc, p) => acc + toNioAmt(p.amount, p.currency, p.exchangeRate), 0), [fPay, exchangeRate]);
  const prevTotalPaid = useMemo(() => pPay.reduce((acc, p) => acc + toNioAmt(p.amount, p.currency, p.exchangeRate), 0), [pPay, exchangeRate]);
  const pagosCount = fPay.length;

  const invoiceDateById = useMemo(() => {
    const map = new Map<string, Date>();
    bills.forEach(i => {
      const d = toDate(i.date || i.createdAt);
      if (d) map.set(i.id, d);
    });
    return map;
  }, [bills]);

  const pagosAplicadosPeriodo = useMemo(() => payments.filter(p => p.isActive !== false).reduce((acc, p) => {
    const invDate = p.supplierInvoiceId ? invoiceDateById.get(p.supplierInvoiceId) : null;
    if (invDate && invDate.getTime() >= currentStart.getTime()) return acc + toNioAmt(p.amount, p.currency, p.exchangeRate);
    return acc;
  }, 0), [payments, invoiceDateById, currentStart, exchangeRate]);

  const cumplimientoPeriodo = useMemo(() => {
    if (comprasNetas <= 0) return null;
    return Math.min(100, (pagosAplicadosPeriodo / comprasNetas) * 100);
  }, [pagosAplicadosPeriodo, comprasNetas]);

  const { totalPending, pendingCount, vencido, vencidoCount } = useMemo(() => {
    const pend = fBillsAll.filter(i => String(i.status || '').toUpperCase() !== 'PAID' && Number(i.balance ?? i.balanceDue ?? 0) > 0);
    const monto = pend.reduce((acc, i) => acc + toNioAmt(i.balance ?? i.balanceDue ?? (Number(i.total || 0) - Number(i.amountPaid || 0)), i.currency, i.exchangeRate), 0);
    let venc = 0;
    let vencCnt = 0;
    pend.forEach(i => {
      const due = toDate(i.dueDate);
      if (due && due.getTime() < Date.now()) {
        venc += toNioAmt(i.balance ?? i.balanceDue ?? (Number(i.total || 0) - Number(i.amountPaid || 0)), i.currency, i.exchangeRate);
        vencCnt += 1;
      }
    });
    return { totalPending: monto, pendingCount: pend.length, vencido: venc, vencidoCount: vencCnt };
  }, [fBillsAll, exchangeRate]);

  const avgTicket = facturasValidas > 0 ? comprasNetas / facturasValidas : 0;
  const prevAvgTicket = pFacturas > 0 ? pComprasNetas / pFacturas : 0;

  const getTrendInfo = (curr: number, prev: number) => {
    if (!Number.isFinite(curr)) return { pct: null, text: 'Sin base comparable' };
    if (!(prev > 0)) return { pct: null, text: 'Sin base comparable' };
    const pct = ((curr - prev) / prev) * 100;
    return { pct, text: `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct).toFixed(1)}% vs. ${comparativoLabel}` };
  };

  const netTrend = getTrendInfo(comprasNetas, pComprasNetas);
  const payTrend = getTrendInfo(totalPaid, prevTotalPaid);
  const ticketTrend = getTrendInfo(avgTicket, prevAvgTicket);

  const compromisos = useMemo(() => {
    const pend = fBillsAll.filter(i => Number(i.balance ?? i.balanceDue ?? 0) > 0);
    const now = startOfDay(new Date()).getTime();
    const bucket = (days: number) => {
      const limit = now + days * DAY_MS;
      const items = pend.filter(i => {
        const due = toDate(i.dueDate);
        return !!due && due.getTime() >= now && due.getTime() <= limit;
      });
      const monto = items.reduce((a, i) => a + toNioAmt(i.balance ?? i.balanceDue ?? (Number(i.total || 0) - Number(i.amountPaid || 0)), i.currency, i.exchangeRate), 0);
      return { monto, count: items.length, items };
    };
    return { d7: bucket(7), d15: bucket(15), d30: bucket(30) };
  }, [fBillsAll, exchangeRate]);

  const pagadasEnPlazo = useMemo(() => {
    const paid = fBillsAll.filter(i => String(i.status || '').toUpperCase() === 'PAID');
    let onTime = 0;
    let countable = 0;
    paid.forEach(inv => {
      const due = toDate(inv.dueDate);
      const linked = payments.filter(p => p.isActive !== false && p.supplierInvoiceId === inv.id);
      if (linked.length === 0) return;
      countable += 1;
      const ok = due ? linked.every(p => {
        const pd = toDate(p.date || p.createdAt);
        return !!pd && pd.getTime() <= due.getTime();
      }) : false;
      if (ok) onTime += 1;
    });
    return { pct: countable > 0 ? (onTime / countable) * 100 : null, count: countable };
  }, [fBillsAll, payments]);

  const diasPromedioPago = useMemo(() => {
    const days: number[] = [];
    fBillsAll.forEach(inv => {
      const iDate = toDate(inv.date || inv.createdAt);
      if (!iDate) return;
      const linked = payments.filter(p => p.isActive !== false && p.supplierInvoiceId === inv.id);
      linked.forEach(p => {
        const pd = toDate(p.date || p.createdAt);
        if (pd) days.push(Math.max(0, Math.floor((pd.getTime() - iDate.getTime()) / DAY_MS)));
      });
    });
    if (days.length === 0) return null;
    return days.reduce((a, b) => a + b, 0) / days.length;
  }, [fBillsAll, payments]);

  const cicloPromedio = useMemo(() => {
    const stageDays: { label: string; days: number | null }[] = [];
    const reqDates: number[] = [];
    requests.forEach(r => {
      const m = (r.management || []).find((x: any) => String(x.status || '').toUpperCase() === 'APPROVED');
      const a = m ? toDate(m.approvedAt || m.approvedDate) : null;
      const d = toDate(r.date || r.createdAt);
      if (a && d) reqDates.push(Math.max(0, Math.floor((a.getTime() - d.getTime()) / DAY_MS)));
    });
    if (reqDates.length > 0) stageDays.push({ label: 'Solicitud → aprobación', days: reqDates.reduce((a, b) => a + b, 0) / reqDates.length });
    const ordRec: number[] = [];
    receipts.forEach(r => {
      const ord = orders.find(o => o.id === r.purchaseOrderId);
      const oD = ord ? toDate(ord.date || ord.createdAt) : null;
      const rD = toDate(r.date || r.createdAt);
      if (oD && rD) ordRec.push(Math.max(0, Math.floor((rD.getTime() - oD.getTime()) / DAY_MS)));
    });
    if (ordRec.length > 0) stageDays.push({ label: 'Orden → recepción', days: ordRec.reduce((a, b) => a + b, 0) / ordRec.length });
    const recInv: number[] = [];
    fBillsAll.forEach(inv => {
      const rec = inv.purchaseReceiptId ? receipts.find(r => r.id === inv.purchaseReceiptId) : null;
      const rD = rec ? toDate(rec.date || rec.createdAt) : null;
      const iD = toDate(inv.date || inv.createdAt);
      if (rD && iD) recInv.push(Math.max(0, Math.floor((iD.getTime() - rD.getTime()) / DAY_MS)));
    });
    if (recInv.length > 0) stageDays.push({ label: 'Recepción → factura', days: recInv.reduce((a, b) => a + b, 0) / recInv.length });
    const invPay: number[] = [];
    fBillsAll.forEach(inv => {
      const iD = toDate(inv.date || inv.createdAt);
      if (!iD) return;
      const linked = payments.filter(p => p.isActive !== false && p.supplierInvoiceId === inv.id);
      linked.forEach(p => {
        const pd = toDate(p.date || p.createdAt);
        if (pd) invPay.push(Math.max(0, Math.floor((pd.getTime() - iD.getTime()) / DAY_MS)));
      });
    });
    if (invPay.length > 0) stageDays.push({ label: 'Factura → pago', days: invPay.reduce((a, b) => a + b, 0) / invPay.length });
    return { stages: stageDays, total: stageDays.length > 0 ? stageDays.reduce((a, s) => a + (s.days ?? 0), 0) : null };
  }, [requests, receipts, orders, fBillsAll, payments]);

  const proximoVencimiento = useMemo(() => {
    const now = startOfDay(new Date());
    const pend = fBillsAll.filter(i => {
      const due = toDate(i.dueDate);
      return Number(i.balance ?? i.balanceDue ?? 0) > 0 && !!due && due.getTime() >= now.getTime();
    });
    const sorted = [...pend].sort((a, b) => (toDate(a.dueDate) || new Date(0)).getTime() - (toDate(b.dueDate) || new Date(0)).getTime());
    const first = sorted[0];
    if (!first) return null;
    const monto = toNioAmt(first.balance ?? first.balanceDue ?? (Number(first.total || 0) - Number(first.amountPaid || 0)), first.currency, first.exchangeRate);
    return { due: toDate(first.dueDate), monto, number: first.number };
  }, [fBillsAll, exchangeRate]);

  const stages = useMemo(() => {
    const activeOrders = orders.filter(o => String(o.status || '').toUpperCase() !== 'CANCELLED' && String(o.status || '').toUpperCase() !== 'DRAFT');
    const approved = activeOrders.filter(o => String(o.status || '').toUpperCase() === 'APPROVED').length;
    const ordersWithReceipt = new Set(receipts.map(r => r.purchaseOrderId).filter(Boolean));
    const pendingReceiptOrders = activeOrders.filter(o => !ordersWithReceipt.has(o.id));
    const partial = receipts.filter(r => String(r.status || '').toUpperCase() === 'PARTIAL').length;
    const complete = receipts.filter(r => String(r.status || '').toUpperCase() === 'RECEIVED').length;
    const receiptsWithInvoice = new Set(receipts.filter(r => Array.isArray(r.supplierInvoices) && r.supplierInvoices.length > 0).map(r => r.id));
    const invoiceReceiptIds = new Set(fBillsAll.map(b => b.purchaseReceiptId).filter(Boolean));
    const recibidoNoFacturado = receipts.filter(r => !receiptsWithInvoice.has(r.id) && !invoiceReceiptIds.has(r.id));
    const pendingPay = fBillsAll.filter(i => Number(i.balance ?? i.balanceDue ?? 0) > 0);
    const overdue = pendingPay.filter(i => {
      const due = toDate(i.dueDate);
      return !!due && due.getTime() < Date.now();
    });
    const requestsInReview = requests.filter(r => isPendingApprovalStatus(r.status)).length;
    const totalOrdered = activeOrders.reduce((a, o) => a + toNio(o), 0);
    const totalPendingReceipt = pendingReceiptOrders.reduce((a, o) => a + toNio(o), 0);
    const totalRecibidoNoFacturado = recibidoNoFacturado.reduce((acc, r) => {
      const ord = r.purchaseOrderId ? orders.find(o => o.id === r.purchaseOrderId) : null;
      const cur = ord?.currency || 'NIO';
      const rate = sourceRate(ord?.exchangeRate);
      const sum = (r.items || []).reduce((a: number, it: any) => a + Number(it.quantityReceived || 0) * Number(it.unitPrice || 0), 0);
      return acc + toNioAmt(sum, cur, rate);
    }, 0);
    const pendingPayMonto = pendingPay.reduce((a, i) => a + toNioAmt(i.balance ?? i.balanceDue ?? (Number(i.total || 0) - Number(i.amountPaid || 0)), i.currency, i.exchangeRate), 0);
    const overdueMonto = overdue.reduce((a, i) => a + toNioAmt(i.balance ?? i.balanceDue ?? (Number(i.total || 0) - Number(i.amountPaid || 0)), i.currency, i.exchangeRate), 0);
    return { approved, pendingReceipt: pendingReceiptOrders.length, partial, complete, pendingInvoicing: recibidoNoFacturado.length, pendingPay: pendingPay.length, overdue: overdue.length, requestsInReview, ordenadoCount: activeOrders.length, totalOrdered, totalPendingReceipt, totalRecibidoNoFacturado, recibidoNoFacturadoCount: recibidoNoFacturado.length, pendingPayMonto, overdueMonto };
  }, [orders, receipts, fBillsAll, requests, exchangeRate]);

  const incidentSummary = useMemo(() => {
    let faltantesItems = 0;
    let faltantesQty = 0;
    let rechazadosQty = 0;
    let montoComprometido = 0;
    const bySupplier = new Map<string, { name: string; receipts: number; partial: number; incidents: number }>();
    receipts.forEach(r => {
      const supplierName = r.supplier?.name || 'Proveedor';
      const row = bySupplier.get(r.supplierId) || { name: supplierName, receipts: 0, partial: 0, incidents: 0 };
      row.receipts += 1;
      const isPartial = String(r.status || '').toUpperCase() === 'PARTIAL';
      const hasIncident = String(r.status || '').toUpperCase() === 'WITH_INCIDENTS' || String(r.status || '').toUpperCase() === 'REJECTED' || isPartial;
      if (isPartial) row.partial += 1;
      (r.items || []).forEach((it: any) => {
        const ordered = Number(it.quantityOrdered || 0);
        const received = Number(it.quantityReceived || 0);
        const rejected = Number(it.quantityRejected || 0);
        if (rejected > 0) rechazadosQty += rejected;
        if (received < ordered) {
          faltantesItems += 1;
          faltantesQty += Math.max(0, ordered - received);
        }
      });
      if (hasIncident) {
        row.incidents += 1;
        const ord = r.purchaseOrderId ? orders.find(o => o.id === r.purchaseOrderId) : null;
        const cur = ord?.currency || 'NIO';
        const rate = sourceRate(ord?.exchangeRate);
        const sum = (r.items || []).reduce((a: number, it: any) => a + Number(it.quantityOrdered || 0) * Number(it.unitPrice || 0), 0);
        montoComprometido += toNioAmt(sum, cur, rate);
      }
      bySupplier.set(r.supplierId, row);
    });
    const suppliers = Array.from(bySupplier.values()).filter(s => s.incidents > 0 || s.partial > 0).sort((a, b) => (b.incidents + b.partial) - (a.incidents + a.partial)).slice(0, 6);
    return { faltantesItems, faltantesQty, rechazadosQty, suppliers, montoComprometido, hasReceipts: receipts.length > 0 };
  }, [receipts, orders, exchangeRate]);

  const retenciones = useMemo(() => {
    const rows = bills.filter(b => Number(b.withholdingTotal || 0) > 0);
    const retTotal = rows.reduce((a, r) => a + toNioAmt(r.withholdingTotal, r.currency, r.exchangeRate), 0);
    const retBase = rows.reduce((a, r) => a + toNioAmt(r.withholdingBase, r.currency, r.exchangeRate), 0);
    const pend = rows.filter(r => Number(r.balance ?? r.balanceDue ?? 0) > 0).reduce((a, r) => a + toNioAmt(r.withholdingTotal, r.currency, r.exchangeRate), 0);
    const anuladas = rows.filter(r => {
      const s = String(r.status || '').toUpperCase();
      return s === 'CANCELLED' || s === 'CANCELED' || s === 'REJECTED' || s === 'VOIDED';
    }).reduce((a, r) => a + toNioAmt(r.withholdingTotal, r.currency, r.exchangeRate), 0);
    const list = rows.map(r => {
      const types = new Map<string, number>();
      (r.items || []).forEach((it: any) => {
        const t = String(it.withholdingType || 'NONE').toUpperCase();
        const rate = Number(it.withholdingRate || 0);
        if (t !== 'NONE') types.set(t, rate);
      });
      const tipo = Array.from(types.entries()).map(([t, rate]) => `${t}${rate > 0 ? ` (${rate}%)` : ''}`).join(' + ') || 'Retención';
      const pct = r.withholdingBase > 0 ? (Number(r.withholdingTotal || 0) / Number(r.withholdingBase || 0)) * 100 : 0;
      return {
        id: r.id,
        fecha: toDate(r.date || r.createdAt),
        proveedor: r.supplier?.name || r.vendorName || 'Proveedor',
        factura: r.number,
        tipo,
        base: toNioAmt(r.withholdingBase, r.currency, r.exchangeRate),
        pct,
        monto: toNioAmt(r.withholdingTotal, r.currency, r.exchangeRate),
        netoPagado: toNioAmt(r.amountPaid, r.currency, r.exchangeRate),
        estado: String(r.status || '').toUpperCase(),
        comprobante: r.number,
      };
    }).sort((a, b) => ((b.fecha || new Date(0)) as Date).getTime() - ((a.fecha || new Date(0)) as Date).getTime());
    return { retTotal, retBase, retCount: rows.length, pend, anuladas, list };
  }, [bills, exchangeRate]);

  const serie = useMemo(() => {
    const mode = durationDays ? getBucketMode(durationDays) : 'month' as BucketMode;
    const firstDate = [...fBills, ...fCredits, ...fPay].reduce<Date | null>((acc, item) => {
      const d = toDate(item.date || item.createdAt);
      if (!d) return acc;
      return !acc || d.getTime() < acc.getTime() ? d : acc;
    }, null);
    const byKey = new Map<string, SeriesPoint>();
    const cursor = new Date(durationDays ? currentStart : (firstDate ? startOfDay(firstDate) : new Date(0)));
    const end = endOfDay(new Date());
    let guard = 0;
    while (cursor.getTime() <= end.getTime() && guard < 500) {
      const key = bucketKey(cursor, mode);
      if (!byKey.has(key)) byKey.set(key, { key, label: bucketLabel(cursor, mode), facturado: 0, nc: 0, compras: 0, pagos: 0, pagosPeriodo: 0, acumulado: 0 });
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }
    fBills.forEach(i => {
      const d = toDate(i.date || i.createdAt);
      if (!d) return;
      const pt = byKey.get(bucketKey(d, mode));
      if (pt) pt.facturado += toNio(i);
    });
    fCredits.forEach(c => {
      const d = toDate(c.date || c.createdAt);
      if (!d) return;
      const pt = byKey.get(bucketKey(d, mode));
      if (pt) pt.nc += toNioAmt(c.total, c.currency, c.exchangeRate);
    });
    fPay.forEach(p => {
      const d = toDate(p.date || p.createdAt);
      if (!d) return;
      const pt = byKey.get(bucketKey(d, mode));
      if (pt) {
        pt.pagos += toNioAmt(p.amount, p.currency, p.exchangeRate);
        const invDate = p.supplierInvoiceId ? invoiceDateById.get(p.supplierInvoiceId) : null;
        if (invDate && invDate.getTime() >= currentStart.getTime()) pt.pagosPeriodo += toNioAmt(p.amount, p.currency, p.exchangeRate);
      }
    });
    let firstIdx = -1;
    let lastIdx = -1;
    const points = Array.from(byKey.values());
    points.forEach((pt, idx) => {
      pt.compras = Math.max(0, pt.facturado - pt.nc);
      if (pt.compras > 0 || pt.pagos > 0) {
        if (firstIdx === -1) firstIdx = idx;
        lastIdx = idx;
      }
    });
    const slice = firstIdx === -1 ? [] : points.slice(firstIdx, lastIdx + 1);
    let cum = 0;
    slice.forEach(pt => { cum += pt.compras; pt.acumulado = cum; });
    return { mode, points: slice };
  }, [fBills, fCredits, fPay, invoiceDateById, currentStart, durationDays, exchangeRate]);

  const prevSerie = useMemo(() => {
    if (!cPrevStart || !cPrevEnd) return [];
    const mode = durationDays ? getBucketMode(durationDays) : 'month' as BucketMode;
    const byKey = new Map<string, number>();
    const cursor = new Date(cPrevStart);
    let guard = 0;
    while (cursor.getTime() <= cPrevEnd.getTime() && guard < 500) {
      const key = bucketKey(cursor, mode);
      if (!byKey.has(key)) byKey.set(key, 0);
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }
    pBills.forEach(i => {
      const d = toDate(i.date || i.createdAt);
      if (!d) return;
      const k = bucketKey(d, mode);
      if (byKey.has(k)) byKey.set(k, (byKey.get(k) || 0) + toNio(i));
    });
    pCredits.forEach(c => {
      const d = toDate(c.date || c.createdAt);
      if (!d) return;
      const k = bucketKey(d, mode);
      if (byKey.has(k)) byKey.set(k, Math.max(0, (byKey.get(k) || 0) - toNioAmt(c.total, c.currency, c.exchangeRate)));
    });
    return Array.from(byKey.values()).map((v, i) => ({ key: Array.from(byKey.keys())[i], label: bucketLabel(new Date(cPrevStart.getTime() + i * DAY_MS), mode), compras: v }));
  }, [pBills, pCredits, cPrevStart, cPrevEnd, durationDays, exchangeRate]);

  const evolucionData = useMemo(() => {
    const offset = serie.points.length - prevSerie.length;
    return serie.points.map((pt, idx) => {
      const prevIdx = idx - offset;
      return { ...pt, prev: (prevIdx >= 0 && prevIdx < prevSerie.length) ? prevSerie[prevIdx].compras : null };
    });
  }, [serie, prevSerie]);

  const cxpAging = useMemo(() => {
    const pend = fBillsAll.filter(i => Number(i.balance ?? i.balanceDue ?? 0) > 0);
    const ranges = [
      { label: 'No vencido', min: -Infinity, max: 0 },
      { label: '1–30 días', min: 1, max: 30 },
      { label: '31–60 días', min: 31, max: 60 },
      { label: '61–90 días', min: 61, max: 90 },
      { label: 'Más de 90 días', min: 91, max: Infinity },
    ];
    const buckets = ranges.map(r => {
      const items = pend.filter(inv => {
        const due = toDate(inv.dueDate);
        const days = due ? Math.floor((Date.now() - due.getTime()) / DAY_MS) : -Infinity;
        return days >= r.min && days <= r.max;
      });
      const monto = items.reduce((a, inv) => a + toNioAmt(inv.balance ?? inv.balanceDue ?? (Number(inv.total || 0) - Number(inv.amountPaid || 0)), inv.currency, inv.exchangeRate), 0);
      const proveedores = new Set(items.map(i => i.supplier?.name || i.vendorName || 'Proveedor')).size;
      return { label: r.label, monto, facturas: items.length, proveedores };
    });
    const total = buckets.reduce((a, b) => a + b.monto, 0);
    return { buckets: buckets.map(b => ({ ...b, pct: total > 0 ? (b.monto / total) * 100 : 0 })), total };
  }, [fBillsAll, exchangeRate]);

  const agingBuckets = cxpAging.buckets;
  const agingTotal = cxpAging.total;

  const suppliersPerf = useMemo(() => {
    const map = new Map<string, SupplierRow>();
    fBills.forEach(inv => {
      const name = inv.supplier?.name || inv.vendorName || 'Proveedor Desconocido';
      const saldo = toNioAmt(inv.balance ?? inv.balanceDue ?? (Number(inv.total || 0) - Number(inv.amountPaid || 0)), inv.currency, inv.exchangeRate);
      const row = map.get(name) || { name, compras: 0, pct: 0, facturas: 0, saldo: 0, trendPct: null, avgLead: null, completePct: null, incidencias: 0, score: null };
      row.compras += toNio(inv);
      row.facturas += 1;
      row.saldo += saldo;
      map.set(name, row);
    });
    const prevMap = new Map<string, number>();
    pBills.forEach(inv => {
      const name = inv.supplier?.name || inv.vendorName || 'Proveedor Desconocido';
      prevMap.set(name, (prevMap.get(name) || 0) + toNio(inv));
    });
    const list = Array.from(map.values());
    const total = list.reduce((a, s) => a + s.compras, 0);
    list.forEach(s => {
      s.pct = total > 0 ? (s.compras / total) * 100 : 0;
      const prev = prevMap.get(s.name) || 0;
      s.trendPct = prev > 0 ? ((s.compras - prev) / prev) * 100 : null;
    });
    list.sort((a, b) => b.compras - a.compras);
    const leadMap = new Map<string, { days: number; count: number }>();
    receipts.forEach(r => {
      if (String(r.status || '').toUpperCase() === 'PENDING') return;
      const ord = orders.find(o => o.id === r.purchaseOrderId);
      const oDate = ord ? toDate(ord.date || ord.createdAt) : null;
      const rDate = toDate(r.date || r.createdAt);
      if (!oDate || !rDate) return;
      const days = Math.max(0, Math.floor((rDate.getTime() - oDate.getTime()) / DAY_MS));
      const name = r.supplier?.name || 'Proveedor';
      const row = leadMap.get(name) || { days: 0, count: 0 };
      row.days += days;
      row.count += 1;
      leadMap.set(name, row);
    });
    const receiptStats = new Map<string, { total: number; complete: number; incidents: number }>();
    const onTimeMap = new Map<string, { on: number; total: number }>();
    receipts.forEach(r => {
      const name = r.supplier?.name || 'Proveedor';
      const row = receiptStats.get(name) || { total: 0, complete: 0, incidents: 0 };
      row.total += 1;
      if (String(r.status || '').toUpperCase() === 'RECEIVED') row.complete += 1;
      if (String(r.status || '').toUpperCase() === 'PARTIAL' || String(r.status || '').toUpperCase() === 'WITH_INCIDENTS' || String(r.status || '').toUpperCase() === 'REJECTED') row.incidents += 1;
      receiptStats.set(name, row);
      const ord = orders.find(o => o.id === r.purchaseOrderId);
      const exp = ord ? toDate(ord.expectedDelivery) : null;
      const rDate = toDate(r.date || r.createdAt);
      if (exp && rDate) {
        const ot = onTimeMap.get(name) || { on: 0, total: 0 };
        ot.total += 1;
        if (rDate.getTime() <= exp.getTime()) ot.on += 1;
        onTimeMap.set(name, ot);
      }
    });
    const supProdPrice = new Map<string, Map<string, { cur: number; qty: number; prev: number; prevQty: number }>>();
    fBills.forEach(inv => {
      const name = inv.supplier?.name || inv.vendorName || 'Proveedor Desconocido';
      if (!supProdPrice.has(name)) supProdPrice.set(name, new Map());
      (inv.items || []).forEach((item: any) => {
        const p = item.product?.name || item.description || 'Producto';
        const row = supProdPrice.get(name)!.get(p) || { cur: 0, qty: 0, prev: 0, prevQty: 0 };
        row.cur += Number(item.unitPrice || 0) * Number(item.quantity || 1);
        row.qty += Number(item.quantity || 1);
        supProdPrice.get(name)!.set(p, row);
      });
    });
    pBills.forEach(inv => {
      const name = inv.supplier?.name || inv.vendorName || 'Proveedor Desconocido';
      if (!supProdPrice.has(name)) return;
      (inv.items || []).forEach((item: any) => {
        const p = item.product?.name || item.description || 'Producto';
        const row = supProdPrice.get(name)!.get(p);
        if (row) {
          row.prev += Number(item.unitPrice || 0) * Number(item.quantity || 1);
          row.prevQty += Number(item.quantity || 1);
        }
      });
    });
    list.forEach(s => {
      const lead = leadMap.get(s.name);
      s.avgLead = lead && lead.count > 0 ? lead.days / lead.count : null;
      const rs = receiptStats.get(s.name);
      s.completePct = rs && rs.total > 0 ? (rs.complete / rs.total) * 100 : null;
      s.incidencias = rs?.incidents || 0;
      let absTrend = 0;
      let comparable = 0;
      const pp = supProdPrice.get(s.name);
      if (pp) pp.forEach(row => {
        if (row.qty > 0 && row.prevQty > 0) {
          const curAvg = row.cur / row.qty;
          const prevAvg = row.prev / row.prevQty;
          if (prevAvg > 0) {
            absTrend += Math.abs((curAvg - prevAvg) / prevAvg) * 100;
            comparable += 1;
          }
        }
      });
      const stabPct = comparable > 0 ? Math.max(0, 100 - (absTrend / comparable) * 4) : null;
      const creditDays: number[] = [];
      fBillsAll.filter(b => (b.supplier?.name || b.vendorName || 'Proveedor Desconocido') === s.name).forEach(b => {
        const d = toDate(b.date || b.createdAt);
        const due = toDate(b.dueDate);
        if (d && due) creditDays.push(Math.max(0, Math.floor((due.getTime() - d.getTime()) / DAY_MS)));
      });
      const creditScore = creditDays.length > 0 ? Math.min(100, (creditDays.reduce((a, b) => a + b, 0) / creditDays.length) * 5) : null;
      const ot = onTimeMap.get(s.name);
      const comps: { w: number; v: number | null }[] = [
        { w: 30, v: ot && ot.total > 0 ? (ot.on / ot.total) * 100 : null },
        { w: 25, v: s.completePct },
        { w: 20, v: rs && rs.total > 0 ? Math.max(0, 100 - (rs.incidents / rs.total) * 100) : null },
        { w: 15, v: stabPct },
        { w: 10, v: creditScore },
      ];
      const available = comps.filter(c => c.v !== null);
      const wSum = available.reduce((a, c) => a + c.w, 0);
      s.score = available.length > 0 ? available.reduce((a, c) => a + c.w * (c.v as number), 0) / wSum : null;
    });
    return { list, total, hasReceipts: receipts.length > 0 };
  }, [fBills, pBills, receipts, orders, fBillsAll, exchangeRate]);

  const products = useMemo(() => {
    const map = new Map<string, ProductRow>();
    fBills.forEach(inv => {
      (inv.items || []).forEach((item: any) => {
        const name = item.product?.name || item.description || 'Producto';
        const q = Number(item.quantity || 0);
        const unit = Number(item.unitPrice || 0);
        const row = map.get(name) || { name, monto: 0, qty: 0, priceAvg: 0, prevPrice: null, priceTrend: null, proveedor: '', recepciones: 0, pct: 0 };
        row.monto += inv.currency === 'USD' ? unit * q * sourceRate(inv.exchangeRate) : unit * q;
        row.qty += q;
        if (inv.supplier?.name && !row.proveedor) row.proveedor = inv.supplier.name;
        map.set(name, row);
      });
    });
    const prevMap = new Map<string, { monto: number; qty: number }>();
    pBills.forEach(inv => {
      (inv.items || []).forEach((item: any) => {
        const name = item.product?.name || item.description || 'Producto';
        const q = Number(item.quantity || 0);
        const unit = Number(item.unitPrice || 0);
        const row = prevMap.get(name) || { monto: 0, qty: 0 };
        row.monto += inv.currency === 'USD' ? unit * q * sourceRate(inv.exchangeRate) : unit * q;
        row.qty += q;
        prevMap.set(name, row);
      });
    });
    const receiptProductCount = new Map<string, Set<string>>();
    receipts.forEach(r => {
      (r.items || []).forEach((it: any) => {
        const name = it.product?.name || it.description || 'Producto';
        if (!receiptProductCount.has(name)) receiptProductCount.set(name, new Set());
        receiptProductCount.get(name)!.add(r.id);
      });
    });
    const list = Array.from(map.values());
    const prodTotal = list.reduce((a, p) => a + p.monto, 0);
    list.forEach(p => {
      p.pct = prodTotal > 0 ? (p.monto / prodTotal) * 100 : 0;
      p.priceAvg = p.qty > 0 ? p.monto / p.qty : 0;
      p.recepciones = receiptProductCount.get(p.name)?.size || 0;
      const prev = prevMap.get(p.name);
      if (prev && prev.qty > 0) {
        p.prevPrice = prev.monto / prev.qty;
        p.priceTrend = p.priceAvg > 0 ? ((p.priceAvg - p.prevPrice) / p.prevPrice) * 100 : null;
      }
    });
    const withTrend = list.filter(p => p.priceTrend !== null);
    const costTrend = withTrend.length > 0
      ? withTrend.reduce((a, p) => a + p.monto * (p.priceTrend as number), 0) / withTrend.reduce((a, p) => a + p.monto, 0)
      : null;
    return { list, prodTotal, costTrend };
  }, [fBills, pBills, receipts, exchangeRate]);

  const sortKey = productMetric === 'unidades' ? 'qty' : productMetric === 'variacion' ? 'priceTrend' : 'monto';
  const visibleProducts = useMemo(() => {
    if (productMetric === 'variacion') return [...products.list].filter(p => p.priceTrend !== null).sort((a, b) => ((b.priceTrend ?? 0) as number) - ((a.priceTrend ?? 0) as number));
    return [...products.list].sort((a, b) => ((b[sortKey] as number) || 0) - ((a[sortKey] as number) || 0));
  }, [products.list, productMetric, sortKey]);

  const supplierComposition = useMemo(() => {
    const list = suppliersPerf.list;
    const valid = list.filter(s => s.compras > 0);
    const top = valid.slice(0, 6);
    const rest = valid.slice(6);
    if (rest.length > 0) top.push({ name: 'Otros proveedores', compras: rest.reduce((a, r) => a + r.compras, 0), pct: 0, facturas: rest.reduce((a, r) => a + r.facturas, 0), saldo: rest.reduce((a, r) => a + r.saldo, 0), trendPct: null, avgLead: null, completePct: null, incidencias: 0, score: null });
    return { data: top, validCount: valid.length, hasData: valid.length > 0 };
  }, [suppliersPerf]);

  const orderedInvoices = useMemo(() => [...fBills].sort((a, b) => ((toDate(b.date || b.createdAt) || new Date(0)).getTime() - (toDate(a.date || a.createdAt) || new Date(0)).getTime())), [fBills]);

  const orderedPending = useMemo(() => [...fBillsAll.filter(i => Number(i.balance ?? i.balanceDue ?? 0) > 0)].sort((a, b) => (toDate(a.dueDate) || new Date(0)).getTime() - (toDate(b.dueDate) || new Date(0)).getTime()), [fBillsAll]);

  const orderedCompromisos = useMemo(() => {
    const now = startOfDay(new Date()).getTime();
    return [...fBillsAll.filter(i => {
      const due = toDate(i.dueDate);
      return Number(i.balance ?? i.balanceDue ?? 0) > 0 && !!due && due.getTime() >= now && due.getTime() <= now + 30 * DAY_MS;
    })].sort((a, b) => (toDate(a.dueDate) || new Date(0)).getTime() - (toDate(b.dueDate) || new Date(0)).getTime());
  }, [fBillsAll]);

  const sortedRetenciones = useMemo(() => retenciones.list.slice(0, 150), [retenciones]);

  const pendingOrdersTotal = useMemo(() => orders.filter(o => {
    const s = String(o.status || '').toUpperCase();
    return s === 'APPROVED' || s === 'SENT' || s === 'PENDING';
  }).reduce((acc, o) => acc + toNio(o), 0), [orders, exchangeRate]);

  const supplierRowModal = (name: string) => {
    const row = suppliersPerf.list.find(s => s.name === name);
    if (row) setModal({ type: 'supplier', data: row });
  };

  useImperativeHandle(ref, () => ({
    exportPDF: async () => {
      try {
        toast.info('Generando PDF (Compras)...');
        const pdfSettings = await getPdfDesignSettings('reportes.purchases');
        const doc = new jsPDF(pdfDesignPaper(pdfSettings));
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const companyName = themeConfig.tenantName || user?.tenantName || 'Mi Empresa';
        const logoUrl = themeConfig.logo || '';
        const primaryColor = pdfSettings.primaryColor || themeConfig.colors.primary || '#10b981';
        const primaryHex = primaryColor.startsWith('#') ? primaryColor : '#10b981';
        const rgbPrimary = primaryHex.startsWith('#')
          ? [parseInt(primaryHex.slice(1, 3), 16), parseInt(primaryHex.slice(3, 5), 16), parseInt(primaryHex.slice(5, 7), 16)]
          : [249, 115, 22];
        const marginX = 14;
        const contentWidth = pageWidth - marginX * 2;
        let currentY = 15;

        const checkPage = (needed: number) => {
          if (currentY + needed > pageHeight - 15) {
            doc.addPage();
            currentY = 20;
          }
        };

        if (logoUrl) {
          const logoBase64 = await getBase64Image(logoUrl);
          if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', (pageWidth - 30) / 2, currentY, 30, 30, undefined, 'FAST');
            currentY += 35;
          }
        }

        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(rgbPrimary[0], rgbPrimary[1], rgbPrimary[2]);
        doc.text(companyName, pageWidth / 2, currentY, { align: 'center' });
        currentY += 8;

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text('Reporte de Compras', pageWidth / 2, currentY, { align: 'center' });
        currentY += 6;

        const now = new Date();
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        const currencyLabel = displayCurrency === 'USD' ? 'Dólares (USD)' : 'Córdobas (NIO)';
        doc.text(`Generado: ${now.toLocaleDateString('es-NI')} ${now.toLocaleTimeString('es-NI')}  |  Moneda: ${currencyLabel}  |  Período: ${rangeLabel}`,
          pageWidth / 2,
          currentY,
          { align: 'center' },
        );
        currentY += 5;

        doc.setDrawColor(rgbPrimary[0], rgbPrimary[1], rgbPrimary[2]);
        doc.setLineWidth(0.8);
        doc.line(marginX, currentY, pageWidth - marginX, currentY);
        currentY += 10;

        const kpis = [
          { label: 'COMPRAS NETAS DEL PERÍODO', value: formatConvertedAmount(comprasNetas, 'NIO'), detail: `${facturasValidas} facturas · vs. ${comparativoLabel}`, color: [249, 115, 22] },
          { label: 'PAGOS EFECTUADOS', value: formatConvertedAmount(totalPaid, 'NIO'), detail: `${pagosCount} pagos realizados`, color: [16, 185, 129] },
          { label: 'SALDO PENDIENTE POR PAGAR', value: formatConvertedAmount(totalPending, 'NIO'), detail: `${pendingCount} facturas pendientes · ${formatConvertedAmount(vencido, 'NIO')} vencidos`, color: [244, 63, 94] },
          { label: 'TICKET PROMEDIO DE COMPRA', value: formatConvertedAmount(avgTicket, 'NIO'), detail: `Basado en ${facturasValidas} factura(s)`, color: [59, 130, 246] },
        ];

        const cols = 4;
        const boxW = (contentWidth - (cols - 1) * 4) / cols;
        const boxH = 24;
        checkPage(boxH + 5);
        kpis.forEach((kpi, idx) => {
          const x = marginX + idx * (boxW + 4);
          doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
          doc.roundedRect(x, currentY, boxW, boxH, 3, 3, 'F');
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(255, 255, 255);
          doc.text(kpi.label, x + boxW / 2, currentY + 6, { align: 'center' });
          doc.setFontSize(11);
          doc.text(kpi.value, x + boxW / 2, currentY + 13, { align: 'center' });
          doc.setFontSize(6.5);
          doc.setFont('helvetica', 'normal');
          doc.text(kpi.detail, x + boxW / 2, currentY + 20, { align: 'center' });
        });
        currentY += boxH + 10;

        const exportIds = ['purchases-monthly-chart', 'purchases-dynamics-chart', 'purchases-distribution-chart', 'purchases-pie-chart'];
        const capture = async (elementId: string, height: number) => {
          const el = document.getElementById(elementId);
          if (!el) return;
          checkPage(height + 15);
          try {
            const canvas = await html2canvas(el, {
              scale: 2,
              backgroundColor: '#ffffff',
              onclone: (clonedDoc) => sanitizeHtml2CanvasOklch(exportIds, clonedDoc, primaryHex),
            });
            doc.addImage(canvas.toDataURL('image/png'), 'PNG', marginX, currentY, contentWidth, height, undefined, 'FAST');
            currentY += height + 5;
          } catch { /* ignore */ }
        };

        await capture('purchases-monthly-chart', 85);
        await capture('purchases-distribution-chart', 75);
        await capture('purchases-dynamics-chart', 75);
        await capture('purchases-pie-chart', 75);

        const renderTop = (title: string, rows: { name: string; value: number; detail: string }[], color: number[]) => {
          checkPage(40);
          doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 60);
          doc.text(title, marginX, currentY); currentY += 7;
          doc.setFillColor(color[0], color[1], color[2]);
          doc.roundedRect(marginX, currentY, contentWidth, 8, 1, 1, 'F');
          doc.setFontSize(8); doc.setTextColor(255, 255, 255);
          doc.text('Nombre', marginX + 3, currentY + 5.5);
          doc.text('Detalle', marginX + 80, currentY + 5.5);
          doc.text('Monto', marginX + 155, currentY + 5.5);
          currentY += 10;
          rows.forEach((item, i) => {
            checkPage(12);
            if (i % 2 === 0) { doc.setFillColor(248, 249, 250); doc.rect(marginX, currentY - 1, contentWidth, 7, 'F'); }
            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
            doc.text(item.name.substring(0, 40), marginX + 3, currentY + 4);
            doc.text(item.detail.substring(0, 55), marginX + 80, currentY + 4);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(color[0], color[1], color[2]);
            doc.text(formatConvertedAmount(Number(item.value), 'NIO'), marginX + 155, currentY + 4);
            currentY += 7;
          });
          currentY += 10;
        };

        renderTop('Top Proveedores (Compras netas)', suppliersPerf.list.slice(0, 5).map(s => ({ name: s.name, value: s.compras, detail: `${s.facturas} facturas · ${s.pct.toFixed(1)}% participación` })), [249, 115, 22]);
        renderTop('Productos con Mayor Inversión', visibleProducts.filter(p => p.monto > 0).slice(0, 5).map(p => ({ name: p.name, value: p.monto, detail: `${p.qty} unidades · precio prom. ${fmtShort(p.priceAvg)}` })), [59, 130, 246]);
        renderTop('Retenciones Registradas', retenciones.list.slice(0, 5).map(r => ({ name: r.proveedor, value: r.monto, detail: `${r.factura} · ${r.tipo} · ${r.estado}` })), [245, 158, 11]);

        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(7);
          doc.setTextColor(150);
          doc.text(`${companyName} - Reporte Compras - Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
        }

        doc.save(`Reporte_Compras_${now.toISOString().split('T')[0]}.pdf`);
        toast.success('PDF generado exitosamente');
      } catch (e: any) {
        console.error(e);
        toast.error(e?.response?.data?.message || e?.message || "Error exportando PDF");
      }
    },
    exportExcel: async () => {
      try {
        toast.info('Generando Excel (Compras)...');
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Compras');

        const companyName = themeConfig.tenantName || user?.tenantName || 'Mi Empresa';
        const logoUrl = themeConfig.logo || '';
        const primaryColor = themeConfig.colors.primary || '#f97316';
        const hexColor = primaryColor.startsWith('#') ? primaryColor.replace('#', '') : 'f97316';
        const primaryHex = primaryColor.startsWith('#') ? primaryColor : '#f97316';
        const currencyLabel = displayCurrency === 'USD' ? 'Dólares (USD)' : 'Córdobas (NIO)';

        ws.getColumn(1).width = 30;
        ws.getColumn(2).width = 22;
        ws.getColumn(3).width = 22;
        ws.getColumn(4).width = 22;

        let currentRow = 1;

        if (logoUrl) {
          const base64Logo = await getBase64Image(logoUrl);
          if (base64Logo) {
            const logoId = wb.addImage({ base64: base64Logo, extension: 'png' });
            ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 100, height: 100 } });
            currentRow = 6;
          }
        }

        ws.mergeCells(`A${currentRow}:D${currentRow}`);
        const cName = ws.getCell(`A${currentRow}`);
        cName.value = companyName;
        cName.font = { size: 18, bold: true, color: { argb: `FF${hexColor}` } };
        cName.alignment = { horizontal: 'center' };
        currentRow++;

        ws.mergeCells(`A${currentRow}:D${currentRow}`);
        const cTitle = ws.getCell(`A${currentRow}`);
        cTitle.value = 'Reporte de Compras';
        cTitle.font = { size: 13, bold: true };
        cTitle.alignment = { horizontal: 'center' };
        currentRow++;

        ws.mergeCells(`A${currentRow}:D${currentRow}`);
        const cMeta = ws.getCell(`A${currentRow}`);
        cMeta.value = `Moneda: ${currencyLabel} (${currencySymbol})  |  Período: ${rangeLabel}  |  ${new Date().toLocaleDateString('es-NI')}`;
        cMeta.font = { size: 10, italic: true, color: { argb: 'FF888888' } };
        cMeta.alignment = { horizontal: 'center' };
        currentRow += 2;

        const kpiBoxes = [
          { label: 'COMPRAS NETAS DEL PERÍODO', value: formatConvertedAmount(comprasNetas, 'NIO'), detail: `${facturasValidas} facturas`, bgColor: 'FFF59E0B' },
          { label: 'PAGOS EFECTUADOS', value: formatConvertedAmount(totalPaid, 'NIO'), detail: `${pagosCount} pagos realizados`, bgColor: 'FF10B981' },
          { label: 'SALDO PENDIENTE POR PAGAR', value: formatConvertedAmount(totalPending, 'NIO'), detail: `${pendingCount} facturas · ${formatConvertedAmount(vencido, 'NIO')} vencidos`, bgColor: 'FFF43F5E' },
          { label: 'TICKET PROMEDIO DE COMPRA', value: formatConvertedAmount(avgTicket, 'NIO'), detail: `Basado en ${facturasValidas} factura(s)`, bgColor: 'FF3B82F6' },
        ];

        ws.getRow(currentRow).height = 18;
        kpiBoxes.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.label;
          cell.font = { size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        currentRow++;
        ws.getRow(currentRow).height = 28;
        kpiBoxes.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.value;
          cell.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        currentRow++;
        ws.getRow(currentRow).height = 16;
        kpiBoxes.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.detail;
          cell.font = { size: 8, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        currentRow += 2;

        const exportIds = ['purchases-monthly-chart', 'purchases-dynamics-chart', 'purchases-distribution-chart', 'purchases-pie-chart'];
        const captureForExcel = async (elementId: string, targetRow: number) => {
          const el = document.getElementById(elementId);
          if (!el) return targetRow;
          try {
            const canvas = await html2canvas(el, {
              scale: 2,
              backgroundColor: '#ffffff',
              onclone: (clonedDoc) => sanitizeHtml2CanvasOklch(exportIds, clonedDoc, primaryHex),
            });
            const imgId = wb.addImage({ base64: canvas.toDataURL('image/png'), extension: 'png' });
            ws.addImage(imgId, { tl: { col: 0, row: targetRow }, ext: { width: 720, height: 260 } });
            return targetRow + 18;
          } catch {
            return targetRow;
          }
        };

        let imgRow = currentRow + 2;
        imgRow = await captureForExcel('purchases-monthly-chart', imgRow);
        imgRow = await captureForExcel('purchases-distribution-chart', imgRow);
        imgRow = await captureForExcel('purchases-dynamics-chart', imgRow);
        imgRow = await captureForExcel('purchases-pie-chart', imgRow);

        while (ws.rowCount < imgRow) ws.addRow([]);
        currentRow = ws.rowCount + 2;

        const thinBorder = { style: 'thin' as const, color: { argb: 'FFE5E7EB' } };
        const renderTable = (title: string, header: string[], rows: (string | number)[][], color: string) => {
          const titleRow = ws.addRow([title, '', '', '']);
          ws.mergeCells(`A${ws.rowCount}:D${ws.rowCount}`);
          titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: color } };
          titleRow.getCell(1).alignment = { horizontal: 'center' };
          ws.addRow([]);
          const head = ws.addRow(header);
          head.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
          });
          rows.forEach((r, idx) => {
            const row = ws.addRow(r);
            row.eachCell((cell) => {
              cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
              if (idx % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF7ED' } };
            });
          });
          ws.addRow([]);
        };

        renderTable('Top Proveedores', ['#', 'Proveedor', 'Detalle', 'Monto'], suppliersPerf.list.slice(0, 5).map((s, i) => [i + 1, s.name, `${s.facturas} facturas · ${s.pct.toFixed(1)}% participación`, Number(s.compras)]), 'FFF59E0B');
        renderTable('Productos con Mayor Inversión', ['#', 'Producto', 'Detalle', 'Monto'], visibleProducts.filter(p => p.monto > 0).slice(0, 5).map((p, i) => [i + 1, p.name, `${p.qty} unidades · precio prom. ${fmtShort(p.priceAvg)}`, Number(p.monto)]), 'FF3B82F6');
        renderTable('Retenciones Registradas', ['#', 'Proveedor', 'Detalle', 'Monto'], retenciones.list.slice(0, 5).map((r, i) => [i + 1, r.proveedor, `${r.factura} · ${r.tipo} · ${r.estado}`, Number(r.monto)]), 'FFF59E0B');

        await downloadExcelWorkbook(wb, `Reporte_Compras_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('Excel exportado exitosamente');
      } catch (e: any) {
        console.error(e);
        toast.error(e?.response?.data?.message || e?.message || "Error exportando Excel");
      }
    }
  }));

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Activity className="size-12 animate-pulse text-primary opacity-50" />
        <p className="font-black uppercase tracking-widest text-[10px]">Consolidando Cadena de Suministro...</p>
      </div>
    );
  }

  const trendBadge = (t: { pct: number | null; text: string }) => {
    if (t.pct === null) return <span className="text-[9px] text-muted-foreground">Sin base comparable</span>;
    return (
      <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold", t.pct >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")}>
        {t.pct >= 0 ? '↑' : '↓'} {Math.abs(t.pct).toFixed(1)}%
      </span>
    );
  };

  const statusBadge = (status: string) => {
    const s = String(status || '').toUpperCase();
    const label = STATUS_LABEL[s] || 'Pendiente';
    const color = STATUS_COLOR[s] || 'bg-slate-400/10 text-slate-400';
    return <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap", color)}>{label}</span>;
  };

  const stageItem = (icon: React.ReactNode, label: string, value: number, color: string, tooltip?: string) => (
    <div className="p-3 rounded-xl bg-muted/30 border border-border/50 text-center" title={tooltip}>
      <div className="flex items-center justify-center gap-1.5">
        {icon}
        <p className="text-[9px] font-bold text-muted-foreground uppercase leading-tight">{label}</p>
      </div>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <p className="text-[10px] text-muted-foreground font-semibold">Período analizado: <span className="text-foreground font-black uppercase">{rangeLabel}</span></p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Comparación</span>
          <Select value={comparison} onValueChange={(v) => setComparison(v as 'anterior' | 'anio-anterior')}>
            <SelectTrigger className="h-8 w-[240px] text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="anterior">Período anterior</SelectItem>
              <SelectItem value="anio-anterior">Mismo período del año anterior</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ═══ KPI Cards ═══ */}
      <div id="purchases-report-kpis" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Compras Netas del Período */}
        <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all cursor-pointer" onClick={() => setModal({ type: 'facturas' })}>
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><ShoppingBag className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Truck className="size-3.5 text-orange-500" /> Compras Netas del Período
              <span className="ml-auto">{trendBadge(netTrend)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-orange-500">{formatConvertedAmount(comprasNetas, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{facturasValidas} facturas de proveedores · {netTrend.text}{valuationModeSuffix ? ` · Vista ${valuationModeLabel.toLowerCase()}` : ''}</p>
            <p className="text-[9px] text-muted-foreground/60 mt-1 flex items-center gap-1" title={`Comparado: ${prevLabel} · Descuentos no registrados a nivel de factura en este sistema.`}>
              <Info className="size-3 shrink-0" />
              {facturadoBruto > 0
                ? `Facturado ${formatConvertedAmount(facturadoBruto, 'NIO')} − NC ${formatConvertedAmount(notasCredito, 'NIO')} = Netas ${formatConvertedAmount(comprasNetas, 'NIO')}`
                : 'Conciliación: facturado − notas de crédito'}
            </p>
          </CardContent>
        </Card>

        {/* Pagos Efectuados */}
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><CreditCard className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Scale className="size-3.5 text-emerald-500" /> Pagos Efectuados
              <span className="ml-auto">{trendBadge(payTrend)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-emerald-500">{formatConvertedAmount(totalPaid, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{pagosCount} pagos realizados</p>
            <p className="text-[9px] text-muted-foreground/60 mt-1 flex items-center gap-1" title="Los pagos pueden superar las compras del período porque pueden cancelar obligaciones de períodos anteriores.">
              <Info className="size-3 shrink-0" /> Puede incluir deudas anteriores
            </p>
          </CardContent>
        </Card>

        {/* Saldo Pendiente por Pagar */}
        <Card className={cn("bg-gradient-to-br to-transparent relative overflow-hidden group hover:shadow-lg transition-all cursor-pointer", vencido > 0 ? "border-rose-500/20 from-rose-500/5" : "border-orange-500/20 from-orange-500/5")} onClick={() => setModal({ type: 'cxp' })}>
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Wallet className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Clock className={cn("size-3.5", vencido > 0 ? "text-rose-500" : "text-orange-500")} /> Saldo Pendiente por Pagar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-xl font-black", vencido > 0 ? "text-rose-500" : "text-orange-500")}>{formatConvertedAmount(totalPending, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {pendingCount === 0 ? 'Sin facturas pendientes' : `${pendingCount} facturas pendientes`}
              {vencido > 0 && <span className="text-rose-400 font-bold"> · {formatConvertedAmount(vencido, 'NIO')} vencidos ({vencidoCount})</span>}
            </p>
          </CardContent>
        </Card>

        {/* Ticket Promedio de Compra */}
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Package className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="size-3.5 text-blue-500" /> Ticket Promedio de Compra
              <span className="ml-auto">{trendBadge(ticketTrend)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-blue-500">{formatConvertedAmount(avgTicket, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{facturasValidas === 0 ? 'Sin facturas válidas' : `Basado en ${facturasValidas} factura${facturasValidas === 1 ? '' : 's'} válida${facturasValidas === 1 ? '' : 's'}`} · Compras netas ÷ facturas</p>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Compras Facturadas y Pagos + Estado del Ciclo ═══ */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card id="purchases-monthly-chart" className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2">
              <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="size-4 text-primary" /> Compras Facturadas y Pagos Realizados
              </CardTitle>
              <div className="flex items-center gap-1 bg-muted/30 p-0.5 rounded-lg w-fit">
                <button onClick={() => setPayMode('todos')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${payMode === 'todos' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Pagos totales</button>
                <button onClick={() => setPayMode('periodo')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${payMode === 'periodo' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Solo del período</button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {serie.points.length === 0 ? (
              <div className="h-[230px] w-full pt-3 flex flex-col items-center justify-center gap-2 text-center">
                <BarChart3 className="size-8 text-muted-foreground/30" />
                <p className="text-sm font-bold text-muted-foreground">Sin compras ni pagos registrados en el período</p>
              </div>
            ) : (
            <div className="h-[230px] w-full pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie.points} barGap={6} margin={{ top: 16, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtShort(v)} domain={[0, 'auto']} />
                  <Tooltip
                    contentStyle={DARK_TOOLTIP}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    formatter={(v: any, name: string, item: any) => {
                      const raw = item?.payload as any;
                      if (name === 'Compras netas facturadas') {
                        return [`${formatConvertedAmount(Number(v), 'NIO')} · facturado bruto: ${formatConvertedAmount(raw?.facturado ?? 0, 'NIO')} · notas de crédito: -${formatConvertedAmount(raw?.nc ?? 0, 'NIO')}`, name];
                      }
                      if (name === 'Pagos totales realizados') {
                        const delPeriodo = raw?.pagosPeriodo ?? 0;
                        return [`${formatConvertedAmount(Number(v), 'NIO')} · de facturas del período: ${formatConvertedAmount(delPeriodo, 'NIO')} · deudas anteriores: ${formatConvertedAmount(Math.max(0, Number(v) - delPeriodo), 'NIO')}`, name];
                      }
                      return [formatConvertedAmount(Number(v), 'NIO'), name];
                    }}
                    labelFormatter={() => `Período: ${rangeLabel}`}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700, color: 'hsl(var(--foreground))' }} />
                  <Bar dataKey="compras" name="Compras netas facturadas" fill="#f97316" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="compras" position="top" formatter={(v: any) => Number(v) > 0 ? fmtShort(Number(v)) : ''} style={{ fontSize: 8, fill: '#f97316', fontWeight: 700 }} />
                  </Bar>
                  <Bar dataKey={payMode === 'todos' ? 'pagos' : 'pagosPeriodo'} name={payMode === 'todos' ? 'Pagos totales realizados' : 'Pagos de facturas del período'} fill={payMode === 'todos' ? '#10b981' : '#059669'} radius={[6, 6, 0, 0]}>
                    <LabelList dataKey={payMode === 'todos' ? 'pagos' : 'pagosPeriodo'} position="top" formatter={(v: any) => Number(v) > 0 ? fmtShort(Number(v)) : ''} style={{ fontSize: 8, fill: payMode === 'todos' ? '#10b981' : '#059669', fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            )}
            <p className="text-[9px] text-muted-foreground/60 mt-1">Los pagos realizados pueden corresponder a compras registradas en períodos anteriores.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 cursor-pointer hover:bg-amber-500/10 transition-all" onClick={() => setModal({ type: 'compromisos' })}>
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 text-amber-500" />
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Próximos 7 días</p>
                </div>
                <p className="text-base font-black text-amber-500">{formatConvertedAmount(compromisos.d7.monto, 'NIO')}</p>
                <p className="text-[9px] text-muted-foreground">{compromisos.d7.count} factura(s) por vencer</p>
              </div>
              <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/10 cursor-pointer hover:bg-orange-500/10 transition-all" onClick={() => setModal({ type: 'compromisos' })}>
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 text-orange-500" />
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Próximos 15 días</p>
                </div>
                <p className="text-base font-black text-orange-500">{formatConvertedAmount(compromisos.d15.monto, 'NIO')}</p>
                <p className="text-[9px] text-muted-foreground">{compromisos.d15.count} factura(s) por vencer</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 cursor-pointer hover:bg-blue-500/10 transition-all" onClick={() => setModal({ type: 'compromisos' })}>
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 text-blue-500" />
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Próximos 30 días</p>
                </div>
                <p className="text-base font-black text-blue-500">{formatConvertedAmount(compromisos.d30.monto, 'NIO')}</p>
                <p className="text-[9px] text-muted-foreground">{compromisos.d30.count} factura(s) por vencer</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card id="purchases-distribution-chart" className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2">
              <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <ClipboardList className="size-4 text-primary" /> Estado del Ciclo de Compra
              </CardTitle>
              <div className="flex items-center gap-1 bg-muted/30 p-0.5 rounded-lg w-fit">
                <button onClick={() => setCicloTab('operativo')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${cicloTab === 'operativo' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Operativo</button>
                <button onClick={() => setCicloTab('incidencias')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${cicloTab === 'incidencias' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Incidencias</button>
                <button onClick={() => setCicloTab('retenciones')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${cicloTab === 'retenciones' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Retenciones</button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {cicloTab === 'operativo' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {stageItem(<Truck className="size-3.5 text-orange-500" />, 'Órdenes pend. de recepción', stages.pendingReceipt, 'text-orange-500')}
                  {stageItem(<Package className="size-3.5 text-amber-500" />, 'Recepciones parciales', stages.partial, 'text-amber-500')}
                  {stageItem(<CreditCard className="size-3.5 text-orange-500" />, 'Facturas pendientes de pago', stages.pendingPay, 'text-orange-500')}
                  {stageItem(<Clock className="size-3.5 text-rose-500" />, 'Facturas vencidas', stages.overdue, 'text-rose-500')}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-center" title={pagadasEnPlazo.count === 0 ? 'Sin facturas pagadas con pagos vinculados registrados.' : `Facturas pagadas con pagos antes o en la fecha de vencimiento (${pagadasEnPlazo.count} evaluadas).`}>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Puntual</p>
                    <p className="text-sm font-black text-emerald-500">{pagadasEnPlazo.pct === null ? 'N/D' : `${pagadasEnPlazo.pct.toFixed(0)}%`}</p>
                    <p className="text-[8px] text-muted-foreground">pagadas antes del venc.</p>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-center" title="Pagos aplicados a facturas emitidas en el período ÷ monto neto de esas facturas (máx. 100%).">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Cumplimiento del período</p>
                    <p className="text-sm font-black text-emerald-500">{cumplimientoPeriodo === null ? 'N/D' : `${cumplimientoPeriodo.toFixed(1)}%`}</p>
                    <p className="text-[8px] text-muted-foreground">pagos ÷ compras netas</p>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-center">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Días prom. de pago</p>
                    <p className="text-sm font-black text-emerald-500">{diasPromedioPago === null ? 'N/D' : `${diasPromedioPago.toFixed(0)} días`}</p>
                    <p className="text-[8px] text-muted-foreground">factura → pago</p>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border/50" title={cicloPromedio.stages.map(s => `${s.label}: ${s.days === null ? 'N/D' : s.days.toFixed(1)} días`).join('\n')}>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                    <Clock className="size-3.5 text-slate-400" /> Tiempo promedio del ciclo
                  </p>
                  <p className="text-lg font-black">{cicloPromedio.total === null ? 'N/D' : `${cicloPromedio.total.toFixed(1)} días`}</p>
                  <p className="text-[9px] text-muted-foreground">Solicitud → aprobación → recepción → factura → pago (desglose en tooltip)</p>
                </div>
                <button onClick={() => setCicloCompleto(!cicloCompleto)} className="w-full text-center py-2 text-[10px] font-black uppercase tracking-wider text-primary hover:text-primary/80 flex items-center justify-center gap-1">
                  {cicloCompleto ? 'Ocultar ciclo completo' : 'Ver ciclo completo'} <ArrowUpRight className="size-3" />
                </button>
                {cicloCompleto && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {stageItem(<ClipboardList className="size-3 text-orange-500" />, 'Solicitudes en revisión', stages.requestsInReview, 'text-orange-500')}
                      {stageItem(<Receipt className="size-3 text-orange-500" />, 'Órdenes aprobadas', stages.approved, 'text-orange-500')}
                      {stageItem(<Package className="size-3 text-emerald-500" />, 'Recepciones completas', stages.complete, 'text-emerald-500')}
                      {stageItem(<FileWarning className="size-3 text-amber-500" />, 'Compras pend. de facturación', stages.pendingInvoicing, 'text-amber-500')}
                    </div>
                    <div className="rounded-xl bg-muted/30 border border-border/50 overflow-hidden">
                      <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-muted/50 text-[9px] font-black text-muted-foreground uppercase">
                        <span>Etapa</span>
                        <span className="text-center">Cant.</span>
                        <span className="text-right">Monto</span>
                      </div>
                      {[
                        { label: 'Ordenado (aprobado/enviado)', count: stages.ordenadoCount, monto: stages.totalOrdered, color: 'text-orange-500' },
                        { label: 'Pendiente de recepción', count: stages.pendingReceipt, monto: stages.totalPendingReceipt, color: 'text-orange-500' },
                        { label: 'Recibido no facturado', count: stages.recibidoNoFacturadoCount, monto: stages.totalRecibidoNoFacturado, color: 'text-amber-500' },
                        { label: 'Facturado pendiente de pago', count: stages.pendingPay, monto: stages.pendingPayMonto, color: 'text-orange-500' },
                        { label: 'Vencido', count: stages.overdue, monto: stages.overdueMonto, color: 'text-rose-500' },
                      ].map(r => (
                        <div key={r.label} className="grid grid-cols-3 gap-2 px-3 py-1.5 border-t border-border/40 text-[10px]">
                          <span className="font-bold">{r.label}</span>
                          <span className="text-center">{r.count}</span>
                          <span className={`text-right font-black ${r.color}`}>{formatConvertedAmount(r.monto, 'NIO')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {cicloTab === 'incidencias' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-center" title="Ítems con cantidad recibida menor a la ordenada">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Productos faltantes</p>
                    <p className="text-2xl font-black text-amber-500">{incidentSummary.faltantesItems}</p>
                    <p className="text-[9px] text-muted-foreground">{incidentSummary.faltantesQty} unidades no recibidas</p>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/10 text-center">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Productos rechazados</p>
                    <p className="text-2xl font-black text-rose-500">{incidentSummary.rechazadosQty}</p>
                    <p className="text-[9px] text-muted-foreground">unidades rechazadas</p>
                  </div>
                  <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/10 text-center">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Recepciones parciales</p>
                    <p className="text-2xl font-black text-orange-500">{stages.partial}</p>
                    <p className="text-[9px] text-muted-foreground">con diferencia de cantidades</p>
                  </div>
                  <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/10 text-center">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Proveedores con incidencias</p>
                    <p className="text-2xl font-black text-orange-500">{incidentSummary.suppliers.length}</p>
                    <p className="text-[9px] text-muted-foreground">parciales o rechazos</p>
                  </div>
                </div>
                {incidentSummary.suppliers.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center py-3">
                    {incidentSummary.hasReceipts ? 'Sin incidencias registradas en recepciones.' : 'Sin recepciones registradas para evaluar incidencias.'}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {incidentSummary.suppliers.map(s => (
                      <div key={s.name} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30">
                        <p className="text-xs font-bold truncate">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground shrink-0">{s.partial} parciales · {s.incidents} con incidencias · {s.receipts} recepciones</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {cicloTab === 'retenciones' && (
              <div className="space-y-3">
                {retenciones.retCount === 0 && (
                  <p className="text-[10px] text-muted-foreground text-center py-2">Sin retenciones registradas.</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-center">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Total retenido</p>
                    <p className="text-base font-black text-amber-500">{formatConvertedAmount(retenciones.retTotal, 'NIO')}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-center">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Base sujeta a retención</p>
                    <p className="text-base font-black text-amber-500">{formatConvertedAmount(retenciones.retBase, 'NIO')}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 text-center">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Comprobantes</p>
                    <p className="text-base font-black text-blue-500">{retenciones.retCount}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/10 text-center">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Retenciones pendientes</p>
                    <p className="text-base font-black text-orange-500">{formatConvertedAmount(retenciones.pend, 'NIO')}</p>
                    <p className="text-[9px] text-muted-foreground">sobre facturas no pagadas</p>
                  </div>
                </div>
                <p className="text-[10px] text-rose-500">Retenciones anuladas: {formatConvertedAmount(retenciones.anuladas, 'NIO')}</p>
                <button onClick={() => setModal({ type: 'retenciones' })} className="w-full text-center py-2 text-[10px] font-black uppercase tracking-wider text-amber-500 hover:text-amber-400 flex items-center justify-center gap-1">
                  Ver detalle de retenciones <ArrowUpRight className="size-3" />
                </button>
              </div>
            )}
            {(incidentSummary.suppliers.length > 0 || retenciones.retCount > 0) && (
              <div className="mt-3 space-y-1.5">
                {incidentSummary.suppliers.length > 0 && (
                  <button onClick={() => setCicloTab('incidencias')} className="w-full flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 transition-all text-left">
                    <p className="text-[10px] font-bold text-amber-500 flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5 shrink-0" /> {incidentSummary.suppliers.length} proveedor(es) con diferencias en recepción · {formatConvertedAmount(incidentSummary.montoComprometido, 'NIO')} comprometidos
                    </p>
                    <p className="text-[10px] font-black text-amber-500 shrink-0">Ver incidencias</p>
                  </button>
                )}
                {retenciones.retCount > 0 && (
                  <button onClick={() => setCicloTab('retenciones')} className="w-full flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 transition-all text-left">
                    <p className="text-[10px] font-bold text-amber-500 flex items-center gap-1.5">
                      <Percent className="size-3.5 shrink-0" /> Retenciones: {formatConvertedAmount(retenciones.retTotal, 'NIO')} · {retenciones.retCount} comprobantes · {formatConvertedAmount(retenciones.pend, 'NIO')} pendientes · {formatConvertedAmount(retenciones.anuladas, 'NIO')} anuladas
                    </p>
                    <p className="text-[10px] font-black text-amber-500 shrink-0">Ver detalle</p>
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Evolución de Compras Netas + Concentración por Proveedor ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="purchases-dynamics-chart" className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2">
              <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" /> Evolución de Compras Netas
              </CardTitle>
              <div className="flex items-center gap-1 bg-muted/30 p-0.5 rounded-lg w-fit">
                <button onClick={() => setEvolutionTab('evolucion')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${evolutionTab === 'evolucion' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Evolución</button>
                <button onClick={() => setEvolutionTab('aging')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${evolutionTab === 'aging' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Antigüedad de CxP</button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {evolutionTab === 'evolucion' && (
              <>
                <div className="h-[220px] w-full pt-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={evolucionData} margin={{ top: 16, right: 8, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtShort(v)} domain={[0, 'auto']} />
                      <Tooltip
                        contentStyle={DARK_TOOLTIP}
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        formatter={(v: any, name: string) => {
                          if (v === null || v === undefined) return ['—', name];
                          return [formatConvertedAmount(Number(v), 'NIO'), name];
                        }}
                        labelFormatter={() => `Período: ${rangeLabel}`}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700, color: 'hsl(var(--foreground))' }} />
                      <Bar dataKey="compras" name="Compra neta" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={26} />
                      <Line type="monotone" dataKey="acumulado" name="Acumulado" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }} />
                      {evolucionData.some(d => d.prev !== null) && (
                        <Line type="monotone" dataKey="prev" name={`Período anterior (${comparativoLabel})`} stroke="#64748b" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 p-3 rounded-xl bg-orange-500/5 border border-orange-500/10">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Target className="size-3.5 text-orange-500" />
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Presupuesto de Compras</p>
                    </div>
                    {budgetSummary ? (
                      <button onClick={navigateToBudget} className="text-[9px] font-black uppercase tracking-wider text-orange-500 hover:text-orange-400">
                        Ver en Contabilidad
                      </button>
                    ) : (
                      <button onClick={navigateToBudget} className="text-[9px] font-black uppercase tracking-wider text-orange-500 hover:text-orange-400">
                        Configurar presupuesto
                      </button>
                    )}
                  </div>
                  {budgetSummary ? (
                    <>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                        <p className="text-sm font-black text-orange-500">{formatConvertedAmount(budgetSummary.presupuesto, 'NIO')}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Ejecutado <span className="font-black text-orange-500">{formatConvertedAmount(budgetSummary.ejecutado, 'NIO')}</span> ({budgetSummary.pct.toFixed(1)}%) · Disponible <span className="font-black">{formatConvertedAmount(budgetSummary.disponible, 'NIO')}</span>
                          {budgetSummary.desviacion > 0 && <span className="text-rose-500 font-bold"> · Sobre ejecutado {formatConvertedAmount(budgetSummary.desviacion, 'NIO')}</span>}
                        </p>
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-orange-500/10 overflow-hidden">
                        <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${Math.max(2, budgetSummary.pct)}%` }} />
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-black text-orange-500">Sin configurar</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">No existen partidas presupuestarias activas para el período. Configure el presupuesto en Contabilidad para proyectar el cierre de compras.</p>
                    </>
                  )}
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">Compras comprometidas</p>
                      <p className="text-xs font-black">{formatConvertedAmount(pendingOrdersTotal, 'NIO')}</p>
                      <p className="text-[9px] text-muted-foreground">{stages.approved} órdenes aprobadas</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">Compras facturadas</p>
                      <p className="text-xs font-black">{formatConvertedAmount(facturadoBruto, 'NIO')}</p>
                      <p className="text-[9px] text-muted-foreground">{facturasValidas} facturas del período</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">Recibido no facturado</p>
                      <p className="text-xs font-black text-amber-500">{formatConvertedAmount(stages.totalRecibidoNoFacturado, 'NIO')}</p>
                      <p className="text-[9px] text-muted-foreground">{stages.recibidoNoFacturadoCount} recepciones sin factura</p>
                    </div>
                  </div>
                </div>
              </>
            )}
            {evolutionTab === 'aging' && (
              <>
                <div className="h-[220px] w-full pt-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agingBuckets} layout="vertical" margin={{ top: 0, right: 34, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.06)" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtShort(v)} />
                      <YAxis type="category" dataKey="label" width={92} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 600 }} />
                      <Tooltip
                        contentStyle={DARK_TOOLTIP}
                        cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                        formatter={(v: any) => [formatConvertedAmount(Number(v), 'NIO'), 'Saldo pendiente']}
                        labelFormatter={(l: any) => `${l} · ${agingTotal > 0 ? 'del saldo total' : 'sin saldo pendiente'}`}
                      />
                      <Bar dataKey="monto" name="Saldo pendiente" radius={[0, 4, 4, 0]} maxBarSize={18}>
                        {agingBuckets.map((_, i) => <Cell key={i} fill={i === 0 ? '#f97316' : '#f43f5e'} />)}
                        <LabelList dataKey="pct" position="right" formatter={(v: any) => Number(v) > 0 ? `${Number(v).toFixed(0)}%` : ''} style={{ fontSize: 9, fill: '#f43f5e', fontWeight: 700 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 p-2.5 rounded-lg bg-orange-500/5 border border-orange-500/10">
                  <p className="text-[10px] text-muted-foreground">
                    Próximo vencimiento: {proximoVencimiento
                      ? <span className="font-black text-orange-500">{(proximoVencimiento.due || new Date()).toLocaleDateString('es-NI')} · {proximoVencimiento.number} · {formatConvertedAmount(proximoVencimiento.monto, 'NIO')}</span>
                      : 'sin facturas por vencer'}
                  </p>
                  <button onClick={() => setModal({ type: 'cxp' })} className="text-[9px] font-black uppercase tracking-wider text-primary hover:text-primary/80 shrink-0">Abrir facturas</button>
                </div>
                <div className="mt-2 space-y-1">
                  {agingBuckets.map(b => (
                    <div key={b.label} className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="font-bold text-muted-foreground uppercase">{b.label}</span>
                      <span className="text-muted-foreground">{b.facturas} factura(s) · {b.proveedores} proveedor(es)</span>
                      <span className="font-black text-rose-500">{formatConvertedAmount(b.monto, 'NIO')}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-2 text-[10px] pt-1 border-t border-border/50">
                    <span className="font-black text-muted-foreground uppercase">Saldo total por pagar</span>
                    <span className="font-black text-rose-500">{formatConvertedAmount(agingTotal, 'NIO')}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card id="purchases-pie-chart" className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <PieChartIcon className="size-4 text-primary" /> Concentración de Compras por Proveedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {supplierComposition.validCount === 1 ? (
              <div className="h-[200px] flex flex-col items-center justify-center gap-3 text-center p-4">
                <div className="p-3 rounded-full bg-amber-500/10">
                  <AlertTriangle className="size-8 text-amber-500" />
                </div>
                <p className="text-sm font-black text-amber-500">Concentración total en un proveedor</p>
                <p className="text-xs text-muted-foreground">
                  El 100% de las compras del período corresponde a <span className="font-black text-foreground">{suppliersPerf.list[0]?.name}</span>. Dependencia de un único proveedor representa un riesgo gerencial.
                </p>
                <button onClick={() => supplierRowModal(suppliersPerf.list[0]?.name)} className="text-[10px] font-black uppercase tracking-wider text-primary hover:text-primary/80 flex items-center gap-1">
                  Ver detalle del proveedor <ArrowUpRight className="size-3" />
                </button>
              </div>
            ) : supplierComposition.validCount === 0 ? (
              <div className="h-[200px] flex flex-col items-center justify-center gap-3 text-center">
                <PieChartIcon className="size-10 text-muted-foreground/30" />
                <p className="text-sm font-bold text-muted-foreground">Sin compras registradas en el período</p>
              </div>
            ) : (
              <>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={supplierComposition.data}
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="compras"
                        nameKey="name"
                      >
                        {supplierComposition.data.map((_, i) => <Cell key={i} fill={['#f97316', '#fb923c', '#f59e0b', '#fdba74', '#fbbf24', '#fcd34d', '#94a3b8'][i % 7]} />)}
                      </Pie>
                      <Tooltip contentStyle={DARK_TOOLTIP} formatter={(value: number, name: string) => [formatConvertedAmount(Number(value), 'NIO'), name]} />
                      <Legend formatter={(value: string) => <span style={{ color: 'hsl(var(--foreground))', fontSize: 11 }}>{value.length > 18 ? value.substring(0, 17) + '…' : value}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1">
                  {suppliersPerf.list.slice(0, 5).map(s => (
                    <button key={s.name} onClick={() => supplierRowModal(s.name)} className="w-full flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all text-left">
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{s.name}</p>
                        <p className="text-[9px] text-muted-foreground">{s.facturas} facturas · {s.trendPct === null ? 'sin base previa' : `variación ${s.trendPct >= 0 ? '+' : ''}${s.trendPct.toFixed(1)}%`}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-orange-500">{s.pct.toFixed(1)}%</p>
                        <p className="text-[9px] text-muted-foreground">{formatConvertedAmount(s.compras, 'NIO')} · saldo {formatConvertedAmount(s.saldo, 'NIO')}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Desempeño de Proveedores + Productos ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="purchases-top-suppliers" className="border-orange-500/20 min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Truck className="size-4 text-orange-500" /> {suppliersPerf.hasReceipts ? 'Desempeño de Proveedores' : 'Principales Proveedores por Compras'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!suppliersPerf.hasReceipts && suppliersPerf.list.length > 0 && (
              <p className="text-[9px] text-amber-500 font-bold flex items-center gap-1">
                <AlertTriangle className="size-3 shrink-0" /> Evaluación de desempeño disponible al registrar recepciones e incidencias (entrega, calidad y puntualidad).
              </p>
            )}
            {suppliersPerf.list.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin proveedores con compras en el período.</p>
            ) : (
              suppliersPerf.list.slice(0, 5).map((s, idx) => (
                <button key={s.name} onClick={() => supplierRowModal(s.name)} className="w-full flex items-center justify-between p-3 rounded-xl bg-orange-500/5 border border-orange-500/10 hover:bg-orange-500/10 transition-colors text-left">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="size-7 rounded-lg bg-orange-500/20 flex items-center justify-center text-[10px] font-black text-orange-600 shrink-0">
                      #{idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{s.name}</p>
                      {s.score !== null && (
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-black", s.score >= 80 ? "bg-emerald-500/10 text-emerald-500" : s.score >= 60 ? "bg-amber-500/10 text-amber-500" : "bg-rose-500/10 text-rose-500")}>
                          Desempeño {Math.round(s.score)}/100
                        </span>
                      )}
                      <p className="text-[10px] text-muted-foreground truncate">
                        {s.avgLead === null ? 'Entrega promedio: N/D' : `Entrega promedio: ${s.avgLead < 1 ? 'menos de 1' : Math.round(s.avgLead)} día(s)`}
                        {s.completePct !== null && ` · ${s.completePct.toFixed(0)}% entregas completas`}
                        {s.incidencias > 0 && <span className="text-rose-500 font-bold"> · {s.incidencias} incidencia(s)</span>}
                      </p>
                      <p className="text-[9px] text-muted-foreground/70 truncate">{s.facturas} facturas · {s.trendPct === null ? 'sin base previa' : `variación ${s.trendPct >= 0 ? '+' : ''}${s.trendPct.toFixed(1)}%`} · saldo {formatConvertedAmount(s.saldo, 'NIO')}</p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-orange-500 shrink-0 ml-3">{s.pct.toFixed(1)}% · {formatConvertedAmount(s.compras, 'NIO')}</span>
                </button>
              ))
            )}
            {suppliersPerf.list.length > 0 && (
              <button onClick={() => setModal({ type: 'suppliers' })} className="w-full text-center py-2 text-[10px] font-black uppercase tracking-wider text-orange-400 hover:text-orange-300 flex items-center justify-center gap-1">
                Ver todos los proveedores <ArrowUpRight className="size-3" />
              </button>
            )}
          </CardContent>
        </Card>

        <Card id="purchases-top-products" className="border-orange-500/20 min-w-0">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2">
              <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <Package className="size-4 text-orange-500" /> Productos con Mayor Inversión de Compra
                {products.costTrend !== null && (
                  <span className={cn("ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-black", products.costTrend >= 0 ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500")}>
                    {products.costTrend >= 0 ? '▲' : '▼'} {Math.abs(products.costTrend).toFixed(1)}% costos comparables
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-1 bg-muted/30 p-0.5 rounded-lg w-fit">
                <button onClick={() => setProductMetric('monto')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${productMetric === 'monto' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Monto</button>
                <button onClick={() => setProductMetric('unidades')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${productMetric === 'unidades' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Unidades</button>
                <button onClick={() => setProductMetric('variacion')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${productMetric === 'variacion' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Variación de precio</button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {productMetric === 'variacion' && visibleProducts.length === 0 && (
              <p className="text-[9px] text-amber-500 font-bold flex items-center gap-1">
                <AlertTriangle className="size-3 shrink-0" /> Evaluación pendiente: se requieren compras en el período actual y el anterior para comparar precios.
              </p>
            )}
            {visibleProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sin productos comprados en el período.</p>
            ) : (
              (productMetric === 'variacion' ? visibleProducts.slice(0, 5) : visibleProducts.slice(0, 5)).map((p, idx) => (
                <button key={p.name} onClick={() => setModal({ type: 'product', data: p })} className="w-full flex items-center justify-between p-3 rounded-xl bg-orange-500/5 border border-orange-500/10 hover:bg-orange-500/10 transition-colors text-left">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="size-7 rounded-lg bg-orange-500/20 flex items-center justify-center text-[10px] font-black text-orange-600 shrink-0">
                      #{idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {productMetric === 'monto' && `${p.qty} unidades · precio promedio ${fmtShort(p.priceAvg)} · ${p.pct.toFixed(1)}% participación`}
                        {productMetric === 'unidades' && `${p.qty} unidades adquiridas · ${formatConvertedAmount(p.monto, 'NIO')} · ${p.recepciones} recepción(es)`}
                        {productMetric === 'variacion' && (
                          p.priceTrend === null ? 'Sin base previa para comparar' : (
                            <span className={p.priceTrend >= 0 ? 'text-rose-500 font-bold' : 'text-emerald-500 font-bold'}>
                              {p.priceTrend >= 0 ? '▲' : '▼'} {Math.abs(p.priceTrend).toFixed(1)}% ({fmtShort(p.prevPrice || 0)} → {fmtShort(p.priceAvg)})
                            </span>
                          )
                        )}
                      </p>
                      {productMetric === 'variacion' && <p className="text-[9px] text-muted-foreground/70 truncate">Proveedor relacionado: {p.proveedor || 'N/D'}</p>}
                    </div>
                  </div>
                  <span className="text-sm font-black text-orange-500 shrink-0 ml-3">
                    {productMetric === 'variacion' && p.priceTrend !== null ? `${p.priceTrend >= 0 ? '+' : ''}${p.priceTrend.toFixed(1)}%` : formatConvertedAmount(p.monto, 'NIO')}
                  </span>
                </button>
              ))
            )}
            {visibleProducts.length > 0 && (
              <button onClick={() => setModal({ type: 'products' })} className="w-full text-center py-2 text-[10px] font-black uppercase tracking-wider text-orange-400 hover:text-orange-300 flex items-center justify-center gap-1">
                Ver todos los productos <ArrowUpRight className="size-3" />
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Detail Modals ═══ */}
      <Dialog open={!!modal} onOpenChange={(open) => { if (!open) setModal(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modal?.type === 'facturas' && <><Receipt className="size-4" /> Compras del Período</>}
              {modal?.type === 'cxp' && <><Clock className="size-4" /> Cuentas por Pagar</>}
              {modal?.type === 'retenciones' && <><Percent className="size-4" /> Detalle de Retenciones</>}
              {modal?.type === 'compromisos' && <><CalendarDays className="size-4" /> Compromisos Próximos (30 días)</>}
              {modal?.type === 'suppliers' && <><Truck className="size-4" /> Todos los Proveedores</>}
              {modal?.type === 'products' && <><Package className="size-4" /> Todos los Productos</>}
              {modal?.type === 'supplier' && <><Truck className="size-4" /> Detalle del Proveedor</>}
              {modal?.type === 'product' && <><Package className="size-4" /> Detalle del Producto</>}
            </DialogTitle>
            <DialogDescription>
              {modal?.type === 'facturas' && `Facturas válidas del período (${orderedInvoices.length}) · Período: ${rangeLabel}.`}
              {modal?.type === 'cxp' && `Facturas pendientes de pago en total (${orderedPending.length}).`}
              {modal?.type === 'retenciones' && `Retenciones registradas en facturas de proveedor (${retenciones.list.length}).`}
              {modal?.type === 'compromisos' && `Facturas con saldo pendiente que vencen en los próximos 30 días (${orderedCompromisos.length}).`}
              {modal?.type === 'suppliers' && `${suppliersPerf.list.length} proveedores con compras en el período.`}
              {modal?.type === 'products' && `${visibleProducts.length} productos comprados en el período.`}
              {modal?.type === 'supplier' && 'Compras, pagos, saldo y desempeño de entrega del proveedor.'}
              {modal?.type === 'product' && 'Inversión, unidades y variación de precio del producto.'}
            </DialogDescription>
          </DialogHeader>

          {modal?.type === 'facturas' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 pb-1">
                <div className="p-2 rounded-lg bg-orange-500/5 border border-orange-500/10 text-center flex-1 min-w-[120px]">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Facturado</p>
                  <p className="text-sm font-black text-orange-500">{formatConvertedAmount(facturadoBruto, 'NIO')}</p>
                </div>
                <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-center flex-1 min-w-[120px]">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Notas de crédito recibidas</p>
                  <p className="text-sm font-black text-amber-500">-{formatConvertedAmount(notasCredito, 'NIO')}</p>
                </div>
                <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-center flex-1 min-w-[120px]">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Compras netas</p>
                  <p className="text-sm font-black text-emerald-500">{formatConvertedAmount(comprasNetas, 'NIO')}</p>
                </div>
              </div>
              {orderedInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin facturas válidas en el período.</p>
              ) : (
                orderedInvoices.slice(0, 150).map(inv => (
                  <div key={inv.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/30">
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{inv.number} · {inv.supplier?.name || inv.vendorName || 'Proveedor'}</p>
                      <p className="text-[10px] text-muted-foreground">{(toDate(inv.date || inv.createdAt) || new Date()).toLocaleDateString('es-NI')}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {inv.withholdingTotal > 0 && <span className="text-[9px] text-amber-500 font-bold" title="Incluye retención">Retención</span>}
                      {statusBadge(inv.status)}
                      <p className="text-xs font-black">{formatConvertedAmount(toNio(inv), 'NIO')}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {modal?.type === 'cxp' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 pb-1">
                <div className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/10 text-center flex-1 min-w-[120px]">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Saldo total por pagar</p>
                  <p className="text-sm font-black text-rose-500">{formatConvertedAmount(totalPending, 'NIO')}</p>
                </div>
                <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-center flex-1 min-w-[120px]">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Vencido</p>
                  <p className="text-sm font-black text-amber-500">{formatConvertedAmount(vencido, 'NIO')} ({vencidoCount})</p>
                </div>
              </div>
              {orderedPending.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin facturas pendientes de pago.</p>
              ) : (
                orderedPending.slice(0, 100).map(inv => {
                  const due = toDate(inv.dueDate);
                  const days = due ? Math.floor((Date.now() - due.getTime()) / DAY_MS) : -1;
                  const saldo = toNioAmt(inv.balance ?? inv.balanceDue ?? (Number(inv.total || 0) - Number(inv.amountPaid || 0)), inv.currency, inv.exchangeRate);
                  return (
                    <div key={inv.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/30">
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{inv.number} · {inv.supplier?.name || inv.vendorName || 'Proveedor'}</p>
                        <p className="text-[10px] text-muted-foreground">Vence: {(due || new Date()).toLocaleDateString('es-NI')}{days > 0 ? ` · ${days} días vencido` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {statusBadge(inv.status)}
                        <p className="text-xs font-black text-rose-500">{formatConvertedAmount(saldo, 'NIO')}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {modal?.type === 'retenciones' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 pb-1">
                <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-center flex-1 min-w-[100px]">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Total retenido</p>
                  <p className="text-sm font-black text-amber-500">{formatConvertedAmount(retenciones.retTotal, 'NIO')}</p>
                </div>
                <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-center flex-1 min-w-[100px]">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Base sujeta</p>
                  <p className="text-sm font-black text-amber-500">{formatConvertedAmount(retenciones.retBase, 'NIO')}</p>
                </div>
                <div className="p-2 rounded-lg bg-orange-500/5 border border-orange-500/10 text-center flex-1 min-w-[100px]">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Pendientes</p>
                  <p className="text-sm font-black text-orange-500">{formatConvertedAmount(retenciones.pend, 'NIO')}</p>
                </div>
              </div>
              {sortedRetenciones.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin retenciones registradas.</p>
              ) : (
                <div className="space-y-1">
                  {sortedRetenciones.map(r => (
                    <div key={r.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30 text-[10px]">
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{r.proveedor} · <span className="text-amber-500">{r.factura}</span></p>
                        <p className="text-[9px] text-muted-foreground truncate">
                          {(r.fecha || new Date()).toLocaleDateString('es-NI')} · {r.tipo} · Base {fmtShort(r.base)} · {r.pct > 0 ? `${r.pct.toFixed(1)}%` : '—'} · Comprobante: {r.comprobante}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[9px] text-muted-foreground">Neto pagado: {fmtShort(r.netoPagado)}</span>
                        {statusBadge(r.estado)}
                        <p className="text-xs font-black text-amber-500">{formatConvertedAmount(r.monto, 'NIO')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {modal?.type === 'compromisos' && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 pb-1">
                <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-center">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">7 días</p>
                  <p className="text-sm font-black text-amber-500">{formatConvertedAmount(compromisos.d7.monto, 'NIO')}</p>
                </div>
                <div className="p-2 rounded-lg bg-orange-500/5 border border-orange-500/10 text-center">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">15 días</p>
                  <p className="text-sm font-black text-orange-500">{formatConvertedAmount(compromisos.d15.monto, 'NIO')}</p>
                </div>
                <div className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/10 text-center">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">30 días</p>
                  <p className="text-sm font-black text-rose-500">{formatConvertedAmount(compromisos.d30.monto, 'NIO')}</p>
                </div>
              </div>
              {orderedCompromisos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin compromisos de pago en los próximos 30 días.</p>
              ) : (
                orderedCompromisos.slice(0, 100).map(inv => {
                  const due = toDate(inv.dueDate);
                  const days = due ? Math.ceil((due.getTime() - Date.now()) / DAY_MS) : 0;
                  const saldo = toNioAmt(inv.balance ?? inv.balanceDue ?? (Number(inv.total || 0) - Number(inv.amountPaid || 0)), inv.currency, inv.exchangeRate);
                  return (
                    <div key={inv.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/30">
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{inv.number} · {inv.supplier?.name || inv.vendorName || 'Proveedor'}</p>
                        <p className="text-[10px] text-muted-foreground">Vence: {(due || new Date()).toLocaleDateString('es-NI')} · en {Math.max(0, days)} día(s)</p>
                      </div>
                      <p className="text-xs font-black text-amber-500 shrink-0">{formatConvertedAmount(saldo, 'NIO')}</p>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {modal?.type === 'suppliers' && (
            <div className="space-y-2">
              {suppliersPerf.list.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin proveedores con compras en el período.</p>
              ) : (
                suppliersPerf.list.map(s => (
                  <button key={s.name} onClick={() => setModal({ type: 'supplier', data: s })} className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all text-left">
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{s.name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.facturas} facturas · saldo {formatConvertedAmount(s.saldo, 'NIO')}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-orange-500">{s.pct.toFixed(1)}%</p>
                      <p className="text-[10px] text-muted-foreground">{formatConvertedAmount(s.compras, 'NIO')}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {modal?.type === 'products' && (
            <div className="space-y-2">
              {visibleProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin productos comprados en el período.</p>
              ) : (
                visibleProducts.slice(0, 100).map(p => (
                  <button key={p.name} onClick={() => setModal({ type: 'product', data: p })} className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all text-left">
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {productMetric === 'variacion' && p.priceTrend !== null ? `Precio ${fmtShort(p.prevPrice || 0)} → ${fmtShort(p.priceAvg)} (${p.priceTrend >= 0 ? '+' : ''}${p.priceTrend.toFixed(1)}%)` : `${p.qty} unidades · precio prom. ${fmtShort(p.priceAvg)} · ${p.recepciones} recepción(es)`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black text-orange-500">{productMetric === 'variacion' && p.priceTrend !== null ? `${p.priceTrend >= 0 ? '+' : ''}${p.priceTrend.toFixed(1)}%` : formatConvertedAmount(p.monto, 'NIO')}</p>
                      <p className="text-[10px] text-muted-foreground">{p.pct.toFixed(1)}% participación</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {modal?.type === 'supplier' && modal.data && (
            <div className="space-y-3">
              {modal.data.score !== null && (
                <p className={cn("text-[10px] font-black uppercase tracking-wider", modal.data.score >= 80 ? "text-emerald-500" : modal.data.score >= 60 ? "text-amber-500" : "text-rose-500")}>
                  Desempeño del proveedor: {Math.round(modal.data.score)}/100
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/10 text-center">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Compras netas del período</p>
                  <p className="text-sm font-black text-orange-500">{formatConvertedAmount(modal.data.compras, 'NIO')}</p>
                  <p className="text-[9px] text-muted-foreground">{modal.data.facturas} facturas · {modal.data.pct.toFixed(1)}% participación</p>
                </div>
                <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/10 text-center">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Saldo pendiente</p>
                  <p className="text-sm font-black text-rose-500">{formatConvertedAmount(modal.data.saldo, 'NIO')}</p>
                  <p className="text-[9px] text-muted-foreground">saldo actual de facturas</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 text-center">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Entrega promedio</p>
                  <p className="text-sm font-black text-blue-500">{modal.data.avgLead === null ? 'N/D' : `${modal.data.avgLead < 1 ? 'menos de 1' : Math.round(modal.data.avgLead)} día(s)`}</p>
                  <p className="text-[9px] text-muted-foreground">orden → recepción</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-center">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Entregas completas</p>
                  <p className="text-sm font-black text-emerald-500">{modal.data.completePct === null ? 'N/D' : `${modal.data.completePct.toFixed(0)}%`}</p>
                  <p className="text-[9px] text-muted-foreground">{modal.data.incidencias} incidencia(s)</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {orderedInvoices.filter(inv => (inv.supplier?.name || inv.vendorName || 'Proveedor Desconocido') === modal.data.name).slice(0, 30).map(inv => (
                  <div key={inv.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30 text-[10px]">
                    <p className="text-xs font-bold truncate">{inv.number} · {(toDate(inv.date || inv.createdAt) || new Date()).toLocaleDateString('es-NI')}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {statusBadge(inv.status)}
                      <p className="text-xs font-black text-orange-500">{formatConvertedAmount(toNio(inv), 'NIO')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {modal?.type === 'product' && modal.data && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/10 text-center">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Total invertido</p>
                  <p className="text-sm font-black text-orange-500">{formatConvertedAmount(modal.data.monto, 'NIO')}</p>
                  <p className="text-[9px] text-muted-foreground">{modal.data.pct.toFixed(1)}% del gasto del período</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 text-center">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Unidades adquiridas</p>
                  <p className="text-sm font-black text-blue-500">{modal.data.qty}</p>
                  <p className="text-[9px] text-muted-foreground">precio promedio {fmtShort(modal.data.priceAvg)}</p>
                </div>
                <div className={cn("p-3 rounded-lg text-center", modal.data.priceTrend === null ? "bg-muted/30 border border-border/50" : modal.data.priceTrend >= 0 ? "bg-rose-500/5 border border-rose-500/10" : "bg-emerald-500/5 border border-emerald-500/10")}>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Variación de precio</p>
                  <p className={cn("text-sm font-black", modal.data.priceTrend === null ? "text-muted-foreground" : modal.data.priceTrend >= 0 ? "text-rose-500" : "text-emerald-500")}>{modal.data.priceTrend === null ? 'N/D' : `${modal.data.priceTrend >= 0 ? '+' : ''}${modal.data.priceTrend.toFixed(1)}%`}</p>
                  <p className="text-[9px] text-muted-foreground">{modal.data.prevPrice === null ? 'sin base previa' : `${fmtShort(modal.data.prevPrice)} → ${fmtShort(modal.data.priceAvg)}`}</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 text-center">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Recepciones</p>
                  <p className="text-sm font-black text-blue-500">{modal.data.recepciones}</p>
                  <p className="text-[9px] text-muted-foreground">proveedor: {modal.data.proveedor || 'N/D'}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
});
PurchasesReportTab.displayName = 'PurchasesReportTab';
