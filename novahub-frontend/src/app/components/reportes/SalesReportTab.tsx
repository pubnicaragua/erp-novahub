import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ComposedChart, BarChart, LineChart, Line, Bar, ReferenceLine, LabelList } from 'recharts';
import { invoicesService, paymentsService, salesReturnsService, creditNotesService } from '../../services/ventas.service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useTheme } from '../../contexts/ThemeContext';
import { TrendingUp, ShoppingCart, ArrowUpRight, Activity, Scale, BarChart3, PieChart as PieChartIcon, Users, Eye, Clock, DollarSign, Percent, Target, CalendarDays, AlertTriangle, Package, CreditCard, Receipt, Info } from 'lucide-react';
import type { ReportExportRef, ReportProps } from './types';
import { getBase64Image, sanitizeHtml2CanvasOklch } from '../../utils/reportExportUtils';
import { cn } from '../ui/utils';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DAY_MS = 86400000;

const STATUS_LABEL: Record<string, string> = {
  PAID: 'Pagada',
  PARTIAL: 'Parcial',
  PENDING: 'Pendiente',
  OVERDUE: 'Vencida',
  REFUNDED: 'Reembolsada',
  CANCELLED: 'Anulada',
  CANCELED: 'Anulada',
};
const STATUS_COLOR: Record<string, string> = {
  PAID: 'bg-emerald-500/10 text-emerald-500',
  PARTIAL: 'bg-amber-500/10 text-amber-500',
  PENDING: 'bg-slate-400/10 text-slate-400',
  OVERDUE: 'bg-rose-500/10 text-rose-500',
  REFUNDED: 'bg-purple-500/10 text-purple-500',
  CANCELLED: 'bg-rose-500/10 text-rose-500',
  CANCELED: 'bg-rose-500/10 text-rose-500',
};

type BucketMode = 'day' | 'week' | 'month';

interface SeriesPoint {
  key: string;
  label: string;
  ventas: number;
  cobrado: number;
  cobradoPeriodo: number;
  acumulado: number;
}

interface CustomerRow {
  name: string;
  ventas: number;
  pct: number;
  facturas: number;
  saldo: number;
  trendPct: number | null;
  lastDate: string | null;
}

interface ProductRow {
  name: string;
  qty: number;
  revenue: number;
  profit: number;
  margin: number | null;
  priceAvg: number;
  trendPct: number | null;
}

type ModalState =
  | { type: 'invoices' }
  | { type: 'cxc' }
  | { type: 'costs' }
  | { type: 'ajustes' }
  | { type: 'customers' }
  | { type: 'products' }
  | { type: 'uncategorized' }
  | { type: 'customer'; data: CustomerRow }
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
  return s !== 'CANCELLED' && s !== 'CANCELED' && s !== 'REFUNDED' && s !== 'REJECTED';
}

function isCreditRecord(inv: any): boolean {
  return String(inv?.type || '').toUpperCase() === 'CREDIT_NOTE' || inv?.isCreditNote === true || inv?.isReturn === true;
}

function isValidReturn(status: unknown): boolean {
  const s = String(status || '').toUpperCase();
  return s === 'APPROVED' || s === 'PROCESSED';
}

function isValidCreditNote(status: unknown): boolean {
  const s = String(status || '').toUpperCase();
  return s === 'ISSUED' || s === 'APPLIED' || s === 'PAID';
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

export const SalesReportTab = forwardRef<ReportExportRef, ReportProps>(({ dateRange }, ref) => {
  const { displayCurrency, formatConvertedAmount, convertAmount, exchangeRate } = useCurrency();
  const { themeConfig } = useTheme();
  const currencySymbol = displayCurrency === 'USD' ? '$' : 'C$';

  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const [evolutionTab, setEvolutionTab] = useState<'acumulada' | 'aging'>('acumulada');
  const [productMetric, setProductMetric] = useState<'revenue' | 'qty' | 'profit'>('revenue');
  const [cobroMode, setCobroMode] = useState<'todos' | 'periodo'>('todos');
  const [comparison, setComparison] = useState<'anterior' | 'anio-anterior'>('anterior');

  const fmtShort = (v: number) => {
    const num = Number(v);
    if (!Number.isFinite(num)) return `${currencySymbol}0`;
    const converted = convertAmount(num, 'NIO');
    if (!Number.isFinite(converted)) return `${currencySymbol}0`;
    const abs = Math.abs(converted);
    if (abs >= 1_000_000) return `${currencySymbol}${(converted / 1_000_000).toLocaleString('es-NI', { maximumFractionDigits: 1 })} millones`;
    if (abs >= 1_000) return `${currencySymbol}${(converted / 1_000).toLocaleString('es-NI', { maximumFractionDigits: 1 })} mil`;
    return `${currencySymbol}${converted.toLocaleString('es-NI', { maximumFractionDigits: 0 })}`;
  };

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [invRes, payRes, retRes, cnRes] = await Promise.all([
          invoicesService.getAll().catch(() => ({ data: [] })),
          paymentsService.getAll().catch(() => ({ data: [] })),
          salesReturnsService.getAll().catch(() => ({ data: [] })),
          creditNotesService.getAll().catch(() => ({ data: [] }))
        ]);
        setInvoices(Array.isArray(invRes) ? invRes : (invRes as any)?.data || []);
        setPayments(Array.isArray(payRes) ? payRes : (payRes as any)?.data || []);
        setReturns(Array.isArray(retRes) ? retRes : (retRes as any)?.data || []);
        setCreditNotes(Array.isArray(cnRes) ? cnRes : (cnRes as any)?.data || []);
      } catch (e: any) {
        toast.error(e?.response?.data?.message || e?.message || "Error cargando ventas");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const { start: currentStart, prevStart, prevEnd, durationDays } = useMemo(() => getRangeDates(dateRange), [dateRange]);

  const { prevStart: cPrevStart, prevEnd: cPrevEnd } = useMemo(() => {
    if (!prevStart || !prevEnd || comparison === 'anterior') return { prevStart, prevEnd };
    return { prevStart: startOfDay(shiftYearClamped(prevStart, 1)), prevEnd: endOfDay(shiftYearClamped(prevEnd, 1)) };
  }, [prevStart, prevEnd, comparison]);

  const rangeLabel = useMemo(() => fmtRange(currentStart.getTime() > 0 ? currentStart : null, endOfDay(new Date())), [currentStart]);
  const prevLabel = useMemo(() => fmtRange(cPrevStart, cPrevEnd), [cPrevStart, cPrevEnd]);
  const comparativoLabel = comparison === 'anterior' ? 'período anterior' : 'mismo período del año anterior';

  const fInvAll = useMemo(() => invoices.filter(i => {
    const s = String(i.status || '').toUpperCase();
    return isValidInvoiceStatus(s) && !isCreditRecord(i);
  }), [invoices]);

  const fInv = useMemo(() => fInvAll.filter(i => {
    const d = toDate(i.date || i.createdAt);
    return !!d && d.getTime() >= currentStart.getTime();
  }), [fInvAll, currentStart]);

  const pInv = useMemo(() => (cPrevStart && cPrevEnd) ? fInvAll.filter(i => {
    const d = toDate(i.date || i.createdAt);
    return !!d && d.getTime() >= cPrevStart.getTime() && d.getTime() <= cPrevEnd.getTime();
  }) : [], [fInvAll, cPrevStart, cPrevEnd]);

  const fRet = useMemo(() => returns.filter(r => {
    const d = toDate(r.date || r.createdAt);
    return isValidReturn(r.status) && !!d && d.getTime() >= currentStart.getTime();
  }), [returns, currentStart]);

  const pRet = useMemo(() => (cPrevStart && cPrevEnd) ? returns.filter(r => {
    const d = toDate(r.date || r.createdAt);
    return isValidReturn(r.status) && !!d && d.getTime() >= cPrevStart.getTime() && d.getTime() <= cPrevEnd.getTime();
  }) : [], [returns, cPrevStart, cPrevEnd]);

  const fCN = useMemo(() => creditNotes.filter(c => {
    const d = toDate(c.date || c.createdAt);
    return isValidCreditNote(c.status) && !!d && d.getTime() >= currentStart.getTime();
  }), [creditNotes, currentStart]);

  const pCN = useMemo(() => (cPrevStart && cPrevEnd) ? creditNotes.filter(c => {
    const d = toDate(c.date || c.createdAt);
    return isValidCreditNote(c.status) && !!d && d.getTime() >= cPrevStart.getTime() && d.getTime() <= cPrevEnd.getTime();
  }) : [], [creditNotes, cPrevStart, cPrevEnd]);

  const fPay = useMemo(() => payments.filter(p => {
    const d = toDate(p.date || p.createdAt);
    return !!d && d.getTime() >= currentStart.getTime();
  }), [payments, currentStart]);

  const pPay = useMemo(() => (cPrevStart && cPrevEnd) ? payments.filter(p => {
    const d = toDate(p.date || p.createdAt);
    return !!d && d.getTime() >= cPrevStart.getTime() && d.getTime() <= cPrevEnd.getTime();
  }) : [], [payments, cPrevStart, cPrevEnd]);

  const toNio = (inv: any) => inv.currency === 'USD' ? Number(inv.total || 0) * (inv.exchangeRate || exchangeRate) : Number(inv.total || 0);
  const toNioAmt = (amt: number | null | undefined, currency: string | undefined, rate: number | undefined) =>
    currency === 'USD' ? Number(amt || 0) * (rate || exchangeRate) : Number(amt || 0);

  const { ventasBrutas, descuentos, devoluciones, notasCredito, ajustes, ventasNetas, facturasValidas } = useMemo(() => {
    let brutas = 0;
    let desc = 0;
    fInv.forEach(i => {
      brutas += toNio(i) + toNioAmt(i.discountAmount ?? i.discount, i.currency, i.exchangeRate);
      desc += toNioAmt(i.discountAmount ?? i.discount, i.currency, i.exchangeRate);
    });
    const dev = fRet.reduce((a, r) => a + toNioAmt(r.total, r.currency, r.exchangeRate), 0);
    const nc = fCN.reduce((a, c) => a + toNioAmt(c.total, c.currency, c.exchangeRate), 0);
    const totalFacturado = fInv.reduce((a, i) => a + toNio(i), 0);
    const netas = Math.max(0, totalFacturado - dev - nc);
    return { ventasBrutas: brutas, descuentos: desc, devoluciones: dev, notasCredito: nc, ajustes: desc + dev + nc, ventasNetas: netas, facturasValidas: fInv.length };
  }, [fInv, fRet, fCN, exchangeRate]);

  const { pVentasNetas } = useMemo(() => {
    const pDev = pRet.reduce((a, r) => a + toNioAmt(r.total, r.currency, r.exchangeRate), 0);
    const pNC = pCN.reduce((a, c) => a + toNioAmt(c.total, c.currency, c.exchangeRate), 0);
    const pNetas = Math.max(0, pInv.reduce((a, i) => a + toNio(i), 0) - pDev - pNC);
    return { pVentasNetas: pNetas };
  }, [pInv, pRet, pCN, exchangeRate]);

  const totalPaid = useMemo(() => fPay.reduce((acc, p) => acc + toNioAmt(p.amount, p.currency, p.exchangeRate), 0), [fPay, exchangeRate]);
  const prevTotalPaid = useMemo(() => pPay.reduce((acc, p) => acc + toNioAmt(p.amount, p.currency, p.exchangeRate), 0), [pPay, exchangeRate]);

  const invoiceDateById = useMemo(() => {
    const map = new Map<string, Date>();
    invoices.forEach(i => {
      const d = toDate(i.date || i.createdAt);
      if (d) map.set(i.id, d);
    });
    return map;
  }, [invoices]);

  const cobrosDeFacturasDelPeriodo = useMemo(() => fPay.reduce((acc, p) => {
    const invDate = p.invoiceId ? invoiceDateById.get(p.invoiceId) : null;
    if (invDate && invDate.getTime() >= currentStart.getTime()) return acc + toNioAmt(p.amount, p.currency, p.exchangeRate);
    return acc;
  }, 0), [fPay, invoiceDateById, currentStart, exchangeRate]);

  const conversionPct = useMemo(() => {
    if (ventasNetas <= 0) return null;
    return (cobrosDeFacturasDelPeriodo / ventasNetas) * 100;
  }, [cobrosDeFacturasDelPeriodo, ventasNetas]);

  const { totalCost, costMissing } = useMemo(() => {
    let cost = 0;
    let missing = 0;
    fInv.forEach((i) => {
      let invCost = Number(i.totalCost || 0);
      if (!invCost && i.items) {
        invCost = i.items.reduce((sum: number, item: any) => {
          const itemCost = Number(item.costPrice || item.product?.costPrice || 0);
          if (!itemCost) missing++;
          return sum + itemCost * Number(item.quantity || 1);
        }, 0);
      }
      if (!invCost && !i.items) missing++;
      cost += toNioAmt(invCost, i.currency, i.exchangeRate);
    });
    return { totalCost: cost, costMissing: missing };
  }, [fInv, exchangeRate]);

  const grossProfit = ventasNetas > 0 && !costMissing ? ventasNetas - totalCost : null;
  const grossMargin = grossProfit !== null && ventasNetas > 0 ? (grossProfit / ventasNetas) * 100 : null;
  const avgTicket = facturasValidas > 0 ? ventasNetas / facturasValidas : 0;

  const { totalPending, pendingCount, vencido } = useMemo(() => {
    const pend = fInv.filter(i => String(i.status || '').toUpperCase() !== 'PAID');
    const monto = pend.reduce((acc, i) => acc + toNioAmt(i.balanceDue ?? i.balance ?? (Number(i.total || 0) - Number(i.amountPaid || 0)), i.currency, i.exchangeRate), 0);
    const venc = pend.reduce((acc, i) => {
      const due = toDate(i.dueDate);
      if (due && due.getTime() < Date.now()) return acc + toNioAmt(i.balanceDue ?? i.balance ?? (Number(i.total || 0) - Number(i.amountPaid || 0)), i.currency, i.exchangeRate);
      return acc;
    }, 0);
    return { totalPending: monto, pendingCount: pend.length, vencido: venc };
  }, [fInv, exchangeRate]);

  const plazoPromedioCobro = useMemo(() => {
    const paid = fInv.filter(i => String(i.status || '').toUpperCase() === 'PAID' && (i.paidDate || i.paymentDate));
    if (paid.length === 0) return { value: null, count: 0 };
    const total = paid.reduce((acc: number, i: any) => {
      const d = toDate(i.date || i.createdAt);
      const pd = toDate(i.paidDate || i.paymentDate);
      if (!d || !pd) return acc;
      return acc + Math.abs(Math.floor((pd.getTime() - d.getTime()) / DAY_MS));
    }, 0);
    return { value: total / paid.length, count: paid.length };
  }, [fInv]);

  const getTrendInfo = (curr: number, prev: number) => {
    if (!Number.isFinite(curr)) return { pct: null, diff: null, text: 'Sin base comparable' };
    if (!(prev > 0)) return { pct: null, diff: null, text: 'Sin base comparable' };
    const pct = ((curr - prev) / prev) * 100;
    const diff = curr - prev;
    return { pct, diff, text: `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct).toFixed(1)}% vs. ${comparativoLabel}` };
  };

  const netTrend = getTrendInfo(ventasNetas, pVentasNetas);
  const payTrend = getTrendInfo(totalPaid, prevTotalPaid);
  const ticketTrend = getTrendInfo(avgTicket, facturasValidas > 0 && pInv.length > 0 ? pVentasNetas / pInv.length : 0);

  const pagosDelPeriodo = fPay.length;

  const serie = useMemo(() => {
    const mode = durationDays ? getBucketMode(durationDays) : 'month' as BucketMode;
    const firstDate = fInv.reduce<Date | null>((acc, i) => {
      const d = toDate(i.date || i.createdAt);
      if (!d) return acc;
      return !acc || d.getTime() < acc.getTime() ? d : acc;
    }, null);
    const start = durationDays ? currentStart : (firstDate ? startOfDay(firstDate) : new Date(0));
    const end = endOfDay(new Date());
    const byKey = new Map<string, SeriesPoint>();
    const cursor = new Date(start);
    let guard = 0;
    while (cursor.getTime() <= end.getTime() && guard < 500) {
      const key = bucketKey(cursor, mode);
      if (!byKey.has(key)) byKey.set(key, { key, label: bucketLabel(cursor, mode), ventas: 0, cobrado: 0, cobradoPeriodo: 0, acumulado: 0 });
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }
    fInv.forEach(i => {
      const d = toDate(i.date || i.createdAt);
      if (!d) return;
      const pt = byKey.get(bucketKey(d, mode));
      if (pt) pt.ventas += toNio(i);
    });
    fRet.forEach(r => {
      const d = toDate(r.date || r.createdAt);
      if (!d) return;
      const pt = byKey.get(bucketKey(d, mode));
      if (pt) pt.ventas -= toNioAmt(r.total, r.currency, r.exchangeRate);
    });
    fCN.forEach(c => {
      const d = toDate(c.date || c.createdAt);
      if (!d) return;
      const pt = byKey.get(bucketKey(d, mode));
      if (pt) pt.ventas -= toNioAmt(c.total, c.currency, c.exchangeRate);
    });
    fPay.forEach(p => {
      const d = toDate(p.date || p.createdAt);
      if (!d) return;
      const pt = byKey.get(bucketKey(d, mode));
      if (pt) {
        pt.cobrado += toNioAmt(p.amount, p.currency, p.exchangeRate);
        const invDate = p.invoiceId ? invoiceDateById.get(p.invoiceId) : null;
        if (invDate && invDate.getTime() >= currentStart.getTime()) pt.cobradoPeriodo += toNioAmt(p.amount, p.currency, p.exchangeRate);
      }
    });
    let firstIdx = -1;
    let lastIdx = -1;
    const points = Array.from(byKey.values());
    points.forEach((pt, idx) => {
      if (pt.ventas > 0 || pt.cobrado > 0) {
        if (firstIdx === -1) firstIdx = idx;
        lastIdx = idx;
      }
    });
    const slice = firstIdx === -1 ? [] : points.slice(firstIdx, lastIdx + 1);
    let cum = 0;
    slice.forEach(pt => { cum += pt.ventas; pt.acumulado = cum; });
    return { mode, points: slice };
  }, [fInv, fRet, fCN, fPay, invoiceDateById, currentStart, durationDays, exchangeRate]);

  const projection = useMemo(() => {
    if (!durationDays || durationDays <= 0) return null;
    const now = new Date();
    const elapsedDays = Math.max(1, Math.floor((startOfDay(now).getTime() - startOfDay(currentStart).getTime()) / DAY_MS) + 1);
    const rate = ventasNetas / elapsedDays;
    const projectedClose = rate * durationDays;
    const confidence = elapsedDays <= 5 ? 'baja' : elapsedDays <= 15 ? 'media' : 'representativa';
    const mode = getBucketMode(durationDays);
    const bucketLen = mode === 'day' ? 1 : mode === 'week' ? 7 : durationDays;
    const totalBuckets = Math.ceil(durationDays / bucketLen);
    const elapsedBuckets = Math.min(totalBuckets, Math.ceil(elapsedDays / bucketLen));
    const remainingBuckets = Math.max(0, totalBuckets - elapsedBuckets);
    const points = serie.points.map(pt => ({ ...pt, cierre: null }));
    const last = serie.points[serie.points.length - 1];
    const base = last ? last.acumulado : 0;
    const cursor = new Date();
    const est: any[] = [];
    for (let k = 1; k <= remainingBuckets; k++) {
      const d = new Date(cursor.getTime() + k * bucketLen * DAY_MS);
      est.push({ key: `est-${k}`, label: `Est. ${bucketLabel(d, mode)}`, cierre: base + rate * bucketLen * k, ventas: null, cobrado: null, cobradoPeriodo: null, acumulado: null });
    }
    return { rate, projectedClose, confidence, elapsedDays, remainingDays: Math.max(0, durationDays - elapsedDays), totalDays: durationDays, data: [...points, ...est], estCount: est.length };
  }, [durationDays, ventasNetas, currentStart, serie]);

  const forecast = useMemo(() => {
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${now.getMonth()}`;
    const byMonth = new Map<string, number>();
    fInvAll.forEach(i => {
      const d = toDate(i.date || i.createdAt);
      if (!d) return;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key === currentKey) return;
      byMonth.set(key, (byMonth.get(key) || 0) + toNio(i));
    });
    const closed = Array.from(byMonth.values()).sort((a, b) => b - a);
    if (closed.length < 6) return null;
    const active = closed.filter(v => v > 0);
    if (active.length < 4) return null;
    const recent = active.slice(0, 3);
    const base = recent.reduce((a, v) => a + v, 0) / recent.length;
    const growths: number[] = [];
    for (let i = 1; i < active.length; i++) {
      const g = (active[i - 1] - active[i]) / Math.max(active[i], 1);
      growths.push(g);
    }
    growths.sort((a, b) => a - b);
    const medianGrowth = growths.length ? growths[Math.floor(growths.length / 2)] : 0;
    const grow = Math.max(-0.25, Math.min(0.25, medianGrowth));
    const out: { label: string; value: number }[] = [];
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    for (let k = 1; k <= 3; k++) {
      const val = Math.max(0, Math.round(base * Math.pow(1 + grow, k)));
      out.push({ label: `Est. ${MONTH_NAMES[(next.getMonth() + k - 1) % 12]}`, value: val });
      if (k === 3 && grow <= 0) { out[k - 1].value = Math.max(0, Math.round(base)); }
    }
    return { base, grow, months: out };
  }, [fInvAll, exchangeRate]);

  const catComposition = useMemo(() => {
    const catMap: Record<string, { value: number; unidades: number; productos: Set<string> }> = {};
    let allUncategorized = true;
    fInv.forEach(inv => {
      (inv.items || []).forEach((item: any) => {
        const cat = item.product?.category?.name || item.category || 'Sin categoría';
        const val = inv.currency === 'USD'
          ? Number((item.total ?? item.unitPrice * (item.quantity || 1)) || 0) * (inv.exchangeRate || exchangeRate)
          : Number((item.total ?? item.unitPrice * (item.quantity || 1)) || 0);
        if (!catMap[cat]) catMap[cat] = { value: 0, unidades: 0, productos: new Set() };
        catMap[cat].value += val;
        catMap[cat].unidades += Number(item.quantity || 0);
        catMap[cat].productos.add(item.product?.name || item.description || 'Producto');
        if (cat !== 'Sin categoría') allUncategorized = false;
      });
    });
    const entries = Object.entries(catMap)
      .map(([name, v]) => ({ name, value: v.value, unidades: v.unidades, productos: v.productos.size }))
      .sort((a, b) => b.value - a.value);
    const valid = entries.filter(e => e.name !== 'Sin categoría');
    const top = entries.slice(0, 6);
    const rest = entries.slice(6);
    if (rest.length > 0) top.push({ name: 'Otras categorías', value: rest.reduce((a, r) => a + r.value, 0), unidades: rest.reduce((a, r) => a + r.unidades, 0), productos: rest.reduce((a, r) => a + r.productos, 0) });
    const catTotal = entries.reduce((a, e) => a + e.value, 0);
    return { data: top, validCount: valid.length, onlyUncategorized: entries.length > 0 && allUncategorized, hasData: entries.length > 0, total: catTotal };
  }, [fInv, exchangeRate]);

  const cxcAging = useMemo(() => {
    const pend = fInv.filter(i => String(i.status || '').toUpperCase() !== 'PAID');
    const ranges = [
      { label: 'Corriente', min: -Infinity, max: 0 },
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
      const monto = items.reduce((a, inv) => a + toNioAmt(inv.balanceDue ?? inv.balance ?? (Number(inv.total || 0) - Number(inv.amountPaid || 0)), inv.currency, inv.exchangeRate), 0);
      return { label: r.label, monto, facturas: items.length };
    });
    const total = buckets.reduce((a, b) => a + b.monto, 0);
    return buckets.map(b => ({ ...b, pct: total > 0 ? (b.monto / total) * 100 : 0 }));
  }, [fInv, exchangeRate]);

  const topCustomers = useMemo(() => {
    const map = new Map<string, CustomerRow>();
    fInv.forEach(inv => {
      const name = inv.customer?.name || inv.customerName || 'Consumidor Final';
      const saldo = toNioAmt(inv.balanceDue ?? inv.balance ?? (Number(inv.total || 0) - Number(inv.amountPaid || 0)), inv.currency, inv.exchangeRate);
      const d = toDate(inv.date || inv.createdAt);
      const row = map.get(name) || { name, ventas: 0, pct: 0, facturas: 0, saldo: 0, trendPct: null, lastDate: null };
      row.ventas += toNio(inv);
      row.facturas += 1;
      row.saldo += saldo;
      if (d && (!row.lastDate || d.getTime() > new Date(row.lastDate).getTime())) row.lastDate = d.toISOString();
      map.set(name, row);
    });
    const prevMap = new Map<string, number>();
    pInv.forEach(inv => {
      const name = inv.customer?.name || inv.customerName || 'Consumidor Final';
      prevMap.set(name, (prevMap.get(name) || 0) + toNio(inv));
    });
    const list = Array.from(map.values());
    const customerTotal = list.reduce((a, c) => a + c.ventas, 0);
    list.forEach(c => {
      c.pct = customerTotal > 0 ? (c.ventas / customerTotal) * 100 : 0;
      const prev = prevMap.get(c.name) || 0;
      c.trendPct = prev > 0 ? ((c.ventas - prev) / prev) * 100 : null;
    });
    list.sort((a, b) => b.ventas - a.ventas);
    const top5Share = list.slice(0, 5).reduce((a, c) => a + c.ventas, 0);
    return { list, top5Share: customerTotal > 0 ? (top5Share / customerTotal) * 100 : 0 };
  }, [fInv, pInv, exchangeRate]);

  const topProducts = useMemo(() => {
    const map = new Map<string, ProductRow>();
    fInv.forEach(inv => {
      (inv.items || []).forEach((item: any) => {
        const name = item.product?.name || item.description || 'Producto';
        const q = Number(item.quantity || 0);
        const unitPrice = Number(item.unitPrice || 0);
        const unitCost = Number(item.costPrice || item.product?.costPrice || 0);
        const rev = inv.currency === 'USD' ? unitPrice * q * (inv.exchangeRate || exchangeRate) : unitPrice * q;
        const cost = inv.currency === 'USD' ? unitCost * q * (inv.exchangeRate || exchangeRate) : unitCost * q;
        const row = map.get(name) || { name, qty: 0, revenue: 0, profit: 0, margin: null, priceAvg: 0, trendPct: null };
        row.qty += q;
        row.revenue += rev;
        row.profit += rev - cost;
        map.set(name, row);
      });
    });
    const prevMap = new Map<string, number>();
    pInv.forEach(inv => {
      (inv.items || []).forEach((item: any) => {
        const name = item.product?.name || item.description || 'Producto';
        const q = Number(item.quantity || 0);
        const rev = inv.currency === 'USD' ? Number(item.unitPrice || 0) * q * (inv.exchangeRate || exchangeRate) : Number(item.unitPrice || 0) * q;
        prevMap.set(name, (prevMap.get(name) || 0) + rev);
      });
    });
    const list = Array.from(map.values());
    const prodTotal = list.reduce((a, p) => a + p.revenue, 0);
    list.forEach(p => {
      p.priceAvg = p.qty > 0 ? p.revenue / p.qty : 0;
      p.margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : null;
      const prev = prevMap.get(p.name) || 0;
      p.trendPct = prev > 0 ? ((p.revenue - prev) / prev) * 100 : null;
    });
    return { list, prodTotal };
  }, [fInv, pInv, exchangeRate]);

  const sortKey = productMetric === 'qty' ? 'qty' : productMetric === 'profit' ? 'profit' : 'revenue';
  const visibleProducts = useMemo(() => [...topProducts.list].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number)), [topProducts.list, sortKey]);

  const missingCostProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    fInv.forEach(inv => {
      (inv.items || []).forEach((item: any) => {
        const cost = Number(item.costPrice || item.product?.costPrice || 0);
        if (cost > 0) return;
        const name = item.product?.name || item.description || 'Producto';
        const row = map.get(name) || { name, qty: 0, revenue: 0 };
        row.qty += Number(item.quantity || 0);
        row.revenue += inv.currency === 'USD'
          ? Number((item.total ?? item.unitPrice * (item.quantity || 1)) || 0) * (inv.exchangeRate || exchangeRate)
          : Number((item.total ?? item.unitPrice * (item.quantity || 1)) || 0);
        map.set(name, row);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
  }, [fInv, exchangeRate]);

  const uncategorizedProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    fInv.forEach(inv => {
      (inv.items || []).forEach((item: any) => {
        const cat = item.product?.category?.name || item.category || 'Sin categoría';
        if (cat !== 'Sin categoría') return;
        const name = item.product?.name || item.description || 'Producto';
        const row = map.get(name) || { name, qty: 0, revenue: 0 };
        row.qty += Number(item.quantity || 0);
        row.revenue += inv.currency === 'USD'
          ? Number((item.total ?? item.unitPrice * (item.quantity || 1)) || 0) * (inv.exchangeRate || exchangeRate)
          : Number((item.total ?? item.unitPrice * (item.quantity || 1)) || 0);
        map.set(name, row);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [fInv, exchangeRate]);

  const sortedInvoices = useMemo(() => [...fInv].sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()), [fInv]);
  const sortedPending = useMemo(() => fInv.filter(i => String(i.status || '').toUpperCase() !== 'PAID').sort((a, b) => new Date(a.dueDate || a.date).getTime() - new Date(b.dueDate || b.date).getTime()), [fInv]);

  useImperativeHandle(ref, () => ({
    exportPDF: async () => {
      try {
        toast.info("Generando PDF (Ventas), por favor espere...");
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const companyName = themeConfig.tenantName || 'Mi Empresa';
        const logoUrl = themeConfig.logo || '';
        const primaryColor = themeConfig.colors.primary || '#10b981';
        const primaryHex = primaryColor.startsWith('#') ? primaryColor : '#10b981';
        const rgbPrimary = primaryHex.startsWith('#') ? [parseInt(primaryHex.slice(1, 3), 16), parseInt(primaryHex.slice(3, 5), 16), parseInt(primaryHex.slice(5, 7), 16)] : [16, 185, 129];
        const marginX = 14;
        const contentWidth = pageWidth - marginX * 2;
        let currentY = 15;

        const checkPage = (needed: number) => { if (currentY + needed > pageHeight - 15) { doc.addPage(); currentY = 20; } };

        if (logoUrl) {
          const logoBase64 = await getBase64Image(logoUrl);
          if (logoBase64) { doc.addImage(logoBase64, 'PNG', (pageWidth - 30) / 2, currentY, 30, 30, undefined, 'FAST'); currentY += 35; }
        }

        doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.setTextColor(rgbPrimary[0], rgbPrimary[1], rgbPrimary[2]);
        doc.text(companyName, pageWidth / 2, currentY, { align: 'center' }); currentY += 8;
        doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 60);
        doc.text('Reporte de Ventas', pageWidth / 2, currentY, { align: 'center' }); currentY += 6;

        const now = new Date();
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120);
        const currencyLabel = displayCurrency === 'USD' ? 'Dólares (USD)' : 'Córdobas (NIO)';
        doc.text(`Generado: ${now.toLocaleDateString('es-NI')} ${now.toLocaleTimeString('es-NI')}  |  Período: ${rangeLabel}  |  Moneda: ${currencyLabel}`, pageWidth / 2, currentY, { align: 'center' });
        currentY += 5;

        doc.setDrawColor(rgbPrimary[0], rgbPrimary[1], rgbPrimary[2]); doc.setLineWidth(0.8);
        doc.line(marginX, currentY, pageWidth - marginX, currentY); currentY += 10;

        const kpis = [
          { label: 'VENTAS NETAS', value: formatConvertedAmount(ventasNetas, 'NIO'), detail: `${facturasValidas} facturas`, color: [16, 185, 129] },
          { label: 'COBRANZA', value: formatConvertedAmount(totalPaid, 'NIO'), detail: `${pagosDelPeriodo} cobros recibidos`, color: [59, 130, 246] },
          { label: 'UTILIDAD BRUTA', value: grossProfit === null ? 'N/D' : formatConvertedAmount(grossProfit, 'NIO'), detail: costMissing ? `${costMissing} producto(s) sin costo` : 'Ventas netas − costo de venta', color: [6, 182, 212] },
          { label: 'MARGEN BRUTO', value: grossMargin === null ? 'N/D' : `${grossMargin.toFixed(1)}%`, detail: costMissing ? 'No calculable por costos faltantes' : 'Utilidad ÷ ventas netas', color: [168, 85, 247] },
          { label: 'SALDO PENDIENTE', value: formatConvertedAmount(totalPending, 'NIO'), detail: `${pendingCount} facturas pendientes`, color: [244, 63, 94] },
        ];

        const cols = 5; const boxW = (contentWidth - (cols - 1) * 4) / cols; const boxH = 22;
        checkPage(boxH + 5);
        kpis.forEach((kpi, idx) => {
          const x = marginX + idx * (boxW + 4);
          doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
          doc.roundedRect(x, currentY, boxW, boxH, 3, 3, 'F');
          doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
          doc.text(kpi.label, x + boxW / 2, currentY + 6, { align: 'center' });
          doc.setFontSize(11); doc.text(kpi.value, x + boxW / 2, currentY + 13, { align: 'center' });
          doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
          doc.text(kpi.detail, x + boxW / 2, currentY + 18.5, { align: 'center' });
        });
        currentY += boxH + 10;

        const charts = ['sales-chart-projection', 'sales-chart-pie', 'sales-chart-trend', 'sales-chart-bar', 'sales-health-card'];
        for (const chartId of charts) {
          const el = document.getElementById(chartId);
          if (el) {
            checkPage(95);
            try {
              const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', onclone: (clonedDoc) => sanitizeHtml2CanvasOklch([chartId], clonedDoc, primaryHex) });
              doc.addImage(canvas.toDataURL('image/png'), 'PNG', marginX, currentY, contentWidth, 80, undefined, 'FAST');
              currentY += 85;
            } catch (imgErr) { console.warn(`${chartId} failed`, imgErr); }
          }
        }

        const renderTop = (title: string, data: any[], colorRGB: number[], isMargin: boolean) => {
          checkPage(40);
          doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 60);
          doc.text(title, marginX, currentY); currentY += 7;
          doc.setFillColor(colorRGB[0], colorRGB[1], colorRGB[2]);
          doc.roundedRect(marginX, currentY, contentWidth, 8, 1, 1, 'F');
          doc.setFontSize(8); doc.setTextColor(255, 255, 255);
          doc.text('Concepto / Nombre', marginX + 3, currentY + 5.5);
          doc.text('Valor', marginX + 130, currentY + 5.5);
          currentY += 10;
          data.forEach((item, i) => {
            checkPage(8);
            if (i % 2 === 0) { doc.setFillColor(248, 249, 250); doc.rect(marginX, currentY - 1, contentWidth, 7, 'F'); }
            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
            doc.text((item.name || 'Sin especificar').substring(0, 50), marginX + 3, currentY + 4);
            doc.setFont('helvetica', 'bold'); doc.setTextColor(colorRGB[0], colorRGB[1], colorRGB[2]);
            const valStr = isMargin ? formatConvertedAmount(Number(item.profit ?? item.margin ?? 0), 'NIO') : formatConvertedAmount(Number(item.ventas ?? item.value ?? 0), 'NIO');
            doc.text(valStr, marginX + 130, currentY + 4);
            currentY += 7;
          });
          currentY += 10;
        };

        renderTop('Principales Clientes por Ventas Netas', topCustomers.list.slice(0, 5), [59, 130, 246], false);
        renderTop('Productos con Mayor Contribución', visibleProducts.slice(0, 5), [168, 85, 247], true);

        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150);
          doc.text(`${companyName} - Reporte de Ventas - Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
        }

        doc.save(`Reporte_Ventas_${now.toISOString().split('T')[0]}.pdf`);
        toast.success("PDF generado exitosamente");
      } catch (e: any) { console.error(e); toast.error(e?.response?.data?.message || e?.message || "Error al generar PDF"); }
    },
    exportExcel: async () => {
      try {
        toast.info("Generando Excel (Ventas)...");
        const wb = new ExcelJS.Workbook();
        const companyName = themeConfig.tenantName || 'Mi Empresa';
        const logoUrl = themeConfig.logo || '';
        const primaryHex = (themeConfig.colors.primary || '#10b981').replace('#', '');
        const currencyLabel = displayCurrency === 'USD' ? 'Dólares (USD)' : 'Córdobas (NIO)';
        const thinBorder = { style: 'thin' as const, color: { argb: 'FFE5E7EB' } };

        const ws = wb.addWorksheet('Reporte de Ventas');
        ws.getColumn(1).width = 8; ws.getColumn(2).width = 35; ws.getColumn(3).width = 25; ws.getColumn(4).width = 25;

        let currentRow = 1;

        if (logoUrl) {
          const base64Logo = await getBase64Image(logoUrl);
          if (base64Logo) {
            const logoId = wb.addImage({ base64: base64Logo, extension: 'png' });
            ws.addImage(logoId, { tl: { col: 1.5, row: 0 }, ext: { width: 100, height: 100 } });
            currentRow = 6;
          }
        }

        ws.mergeCells(`A${currentRow}:D${currentRow}`);
        const cellName = ws.getCell(`A${currentRow}`); cellName.value = companyName;
        cellName.font = { size: 18, bold: true, color: { argb: `FF${primaryHex}` } }; cellName.alignment = { horizontal: 'center' }; currentRow++;

        ws.mergeCells(`A${currentRow}:D${currentRow}`);
        const cellTitle = ws.getCell(`A${currentRow}`); cellTitle.value = 'Reporte de Ventas';
        cellTitle.font = { size: 13, bold: true }; cellTitle.alignment = { horizontal: 'center' }; currentRow++;

        ws.mergeCells(`A${currentRow}:D${currentRow}`);
        const cellCurrency = ws.getCell(`A${currentRow}`);
        cellCurrency.value = `Moneda: ${currencyLabel} (${currencySymbol})  |  Período: ${rangeLabel}  |  ${new Date().toLocaleDateString('es-NI')}`;
        cellCurrency.font = { size: 10, italic: true, color: { argb: 'FF888888' } }; cellCurrency.alignment = { horizontal: 'center' }; currentRow += 2;

        const kpis = [
          { label: 'VENTAS NETAS', value: formatConvertedAmount(ventasNetas, 'NIO'), detail: `${facturasValidas} fact.`, bgColor: 'FF10B981' },
          { label: 'COBRANZA', value: formatConvertedAmount(totalPaid, 'NIO'), detail: `${pagosDelPeriodo} cobros`, bgColor: 'FF3B82F6' },
          { label: 'UTILIDAD BRUTA', value: grossProfit === null ? 'N/D' : formatConvertedAmount(grossProfit, 'NIO'), detail: costMissing ? 'Sin costos' : 'Real', bgColor: 'FF06B6D4' },
          { label: 'MARGEN BRUTO', value: grossMargin === null ? 'N/D' : `${grossMargin.toFixed(1)}%`, detail: costMissing ? 'Sin costos' : 'Real', bgColor: 'FFA855F7' },
          { label: 'SALDO PENDIENTE', value: formatConvertedAmount(totalPending, 'NIO'), detail: `${pendingCount} fact. pend.`, bgColor: 'FFF43F5E' },
        ];

        ws.getRow(currentRow).height = 18;
        kpis.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.label; cell.font = { size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } }; cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }); currentRow++;
        ws.getRow(currentRow).height = 28;
        kpis.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.value; cell.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } }; cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }); currentRow++;
        ws.getRow(currentRow).height = 16;
        kpis.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.detail; cell.font = { size: 8, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } }; cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }); currentRow += 2;

        const captureAndEmbed = async (elementId: string) => {
          const el = document.getElementById(elementId); if (!el) return;
          try {
            const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', onclone: (clonedDoc) => sanitizeHtml2CanvasOklch([elementId], clonedDoc, `#${primaryHex}`) });
            const imgId = wb.addImage({ base64: canvas.toDataURL('image/png'), extension: 'png' });
            const width = 600; const height = (canvas.height * width) / canvas.width;
            ws.addImage(imgId, { tl: { col: 0, row: currentRow }, ext: { width, height } });
            currentRow += Math.ceil(height / 18) + 2;
          } catch (e: any) { console.warn(e); }
        };

        await captureAndEmbed('sales-chart-projection');
        await captureAndEmbed('sales-chart-bar');
        await captureAndEmbed('sales-chart-pie');
        await captureAndEmbed('sales-chart-trend');
        await captureAndEmbed('sales-health-card');

        while (ws.rowCount < currentRow) ws.addRow([]); ws.addRow([]);

        const renderTopTable = (title: string, data: any[], colorHex: string, isMargin: boolean) => {
          const titleRow = ws.addRow([title, '', '', '']); ws.mergeCells(`A${ws.rowCount}:D${ws.rowCount}`);
          titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: colorHex } }; titleRow.getCell(1).alignment = { horizontal: 'center' }; ws.addRow([]);
          const header = ws.addRow(['#', 'Nombre', 'Monto', '']);
          header.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorHex } }; c.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder }; });
          data.forEach((item, idx) => {
            const val = isMargin ? Number(item.profit ?? item.margin ?? 0) : Number(item.ventas ?? item.value ?? 0);
            const r = ws.addRow([idx + 1, item.name || 'Sin nombre', val, '']);
            r.getCell(1).font = { bold: true }; r.getCell(1).alignment = { horizontal: 'center' };
            r.getCell(3).numFmt = `"${currencySymbol}" #,##0.00`; r.getCell(3).font = { bold: true }; r.getCell(3).alignment = { horizontal: 'right' };
            r.eachCell(c => { c.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder }; });
          });
          ws.addRow([]); ws.addRow([]);
        };

        renderTopTable('Principales Clientes por Ventas Netas', topCustomers.list.slice(0, 5), 'FF3B82F6', false);
        renderTopTable('Productos con Mayor Contribución', visibleProducts.slice(0, 5), 'FFA855F7', true);

        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `Ventas_${new Date().toISOString().split('T')[0]}.xlsx`; link.click();
        toast.success("Excel generado exitosamente");
      } catch (e: any) { console.error(e); toast.error(e?.response?.data?.message || e?.message || "Error al generar Excel"); }
    }
  }));

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Activity className="size-12 animate-pulse text-primary opacity-50" />
        <p className="font-black uppercase tracking-widest text-[10px]">Cuantificando Crecimiento Comercial...</p>
      </div>
    );
  }

  const trendBadge = (t: { pct: number | null; diff: number | null; text: string }) => {
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

  const canShowDona = catComposition.validCount >= 2 || (catComposition.data.length >= 2 && !catComposition.onlyUncategorized);

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

      {/* ═══ KPI Cards (Dashboard Style) ═══ */}
      <div id="sales-report-kpis" className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Ventas Netas */}
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all cursor-pointer" onClick={() => setModal({ type: 'invoices' })}>
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><ShoppingCart className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <ArrowUpRight className="size-3.5 text-emerald-500" /> Ventas Netas
              <span className="ml-auto">{trendBadge(netTrend)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-emerald-500">{formatConvertedAmount(ventasNetas, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{facturasValidas} facturas válidas · {netTrend.text}</p>
            <p className="text-[9px] text-muted-foreground/60 mt-1 flex items-center gap-1" title={`Ventas brutas: ${formatConvertedAmount(ventasBrutas, 'NIO')} · Descuentos: -${formatConvertedAmount(descuentos, 'NIO')} · Devoluciones: -${formatConvertedAmount(devoluciones, 'NIO')} · Notas de crédito: -${formatConvertedAmount(notasCredito, 'NIO')} · Ventas netas: ${formatConvertedAmount(ventasNetas, 'NIO')} · Comparado: ${prevLabel}`}>
              <Info className="size-3 shrink-0" /> Conciliación: brutas − ajustes
            </p>
          </CardContent>
        </Card>

        {/* Cobranza del Período */}
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Scale className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Scale className="size-3.5 text-blue-500" /> Cobranza del Período
              <span className="ml-auto">{trendBadge(payTrend)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-blue-500">{formatConvertedAmount(totalPaid, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{pagosDelPeriodo} cobros recibidos</p>
            <p className="text-[9px] text-muted-foreground/60 mt-1 flex items-center gap-1" title="Incluye todos los cobros recibidos durante el período seleccionado, aunque correspondan a facturas emitidas anteriormente.">
              <Info className="size-3 shrink-0" /> Puede incluir cartera anterior
            </p>
          </CardContent>
        </Card>

        {/* Utilidad Bruta */}
        <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><DollarSign className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <DollarSign className="size-3.5 text-cyan-500" /> Utilidad Bruta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-cyan-500">{grossProfit === null ? 'N/D' : formatConvertedAmount(grossProfit, 'NIO')}</p>
            {costMissing > 0 ? (
              <div className="mt-1.5">
                <p className="text-[10px] text-amber-500">{costMissing} producto(s) vendidos sin costo registrado</p>
                <button onClick={() => setModal({ type: 'costs' })} className="mt-1 text-[10px] font-black uppercase tracking-wider text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                  Completar costos <ArrowUpRight className="size-3" />
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground mt-0.5">Ventas netas − costo de venta</p>
            )}
          </CardContent>
        </Card>

        {/* Margen Bruto */}
        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Percent className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Percent className="size-3.5 text-purple-500" /> Margen Bruto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-purple-500">{grossMargin === null ? 'N/D' : `${grossMargin.toFixed(1)}%`}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {costMissing > 0 ? 'No calculable por costos faltantes' : 'Utilidad bruta ÷ ventas netas'}
            </p>
          </CardContent>
        </Card>

        {/* Saldo Pendiente por Cobrar */}
        <Card className="border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all cursor-pointer" onClick={() => setModal({ type: 'cxc' })}>
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Clock className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Clock className="size-3.5 text-rose-500" /> Saldo Pendiente por Cobrar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-rose-500">{formatConvertedAmount(totalPending, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {pendingCount === 0 ? 'Sin facturas pendientes' : `${pendingCount} facturas pendientes`}
              {vencido > 0 && <span className="text-rose-400 font-bold"> · {formatConvertedAmount(vencido, 'NIO')} vencidos</span>}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Charts Row: Proyección + Composición ═══ */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card id="sales-chart-projection" className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" /> Proyección de Cierre de Ventas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!projection ? (
              <div className="h-[320px] w-full flex flex-col items-center justify-center gap-3 text-center">
                <TrendingUp className="size-10 text-muted-foreground/30" />
                <p className="text-sm font-bold text-muted-foreground">Seleccione un período acotado</p>
                <p className="text-xs text-muted-foreground/70 max-w-md">La proyección de cierre está disponible para períodos con fecha de fin definida (hoy, semana, mes, trimestre o año).</p>
              </div>
            ) : (
              <div className="h-[320px] w-full pt-2 flex flex-col">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1 pb-3">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="size-3.5 text-primary" />
                    <p className="text-xs font-black">
                      Cierre estimado: <span className="text-primary">{formatConvertedAmount(projection.projectedClose, 'NIO')}</span>
                    </p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Basado en {projection.elapsedDays} de {projection.totalDays} días transcurridos</p>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-500 uppercase" title="La estimación se basa en el ritmo promedio diario del período actual. Puede variar por estacionalidad, días no laborables, ventas extraordinarias o cambios en la demanda.">
                    Confiabilidad {projection.confidence}
                  </span>
                </div>
                <div className="min-h-0 flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={projection.data} margin={{ top: 14, right: 8, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtShort(v)} />
                      <Tooltip contentStyle={DARK_TOOLTIP} formatter={(v: any) => [v === null || v === undefined ? '—' : formatConvertedAmount(Number(v), 'NIO'), 'Acumulado']} labelFormatter={() => `Período: ${rangeLabel}`} cursor={{ stroke: 'rgba(148,163,184,0.4)', strokeDasharray: '4 4' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700, color: 'hsl(var(--foreground))' }} />
                      {projection.estCount > 0 && <ReferenceLine x={projection.data[Math.max(0, projection.data.length - projection.estCount - 1)]?.label} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: 'Proyección', position: 'top', style: { fontSize: '10px', fill: '#f59e0b', fontWeight: 700 } }} />}
                      <Line type="monotone" dataKey="acumulado" name="Venta acumulada real" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3.5, fill: '#3b82f6' }} connectNulls />
                      <Line type="monotone" dataKey="cierre" name="Proyección de cierre" stroke="#f59e0b" strokeWidth={3} strokeDasharray="6 3" dot={{ r: 3.5, fill: '#f59e0b' }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="pt-2">
                  {forecast ? (
                    <p className="text-[10px] text-muted-foreground">
                      Pronóstico de próximos períodos (base: media móvil de meses con actividad):
                      {forecast.months.map((m) => (
                        <span key={m.label} className="ml-2 font-bold text-purple-400">{m.label}: {formatConvertedAmount(m.value, 'NIO')}</span>
                      ))}
                    </p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground">El pronóstico de próximos períodos estará disponible al acumular suficiente historial (mínimo seis meses cerrados con al menos cuatro con actividad real).</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card id="sales-chart-pie" className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <PieChartIcon className="size-4 text-primary" /> Distribución de Ventas por Categoría
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              {!catComposition.hasData ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
                  <PieChartIcon className="size-10 text-muted-foreground/30" />
                  <p className="text-sm font-bold text-muted-foreground">Sin información disponible</p>
                  <p className="text-xs text-muted-foreground/70">Selecciona un período con facturas para ver la distribución.</p>
                </div>
              ) : catComposition.onlyUncategorized ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                  <PieChartIcon className="size-10 text-muted-foreground/30" />
                  <p className="text-sm font-bold text-muted-foreground">Productos sin categorizar</p>
                  <p className="text-xs text-muted-foreground/70 max-w-xs">Todos los productos vendidos en este período están pendientes de categorización.</p>
                  <button onClick={() => setModal({ type: 'uncategorized' })} className="text-[10px] font-black uppercase tracking-wider text-primary hover:text-primary/80 flex items-center gap-1">
                    Ver productos sin categoría <ArrowUpRight className="size-3" />
                  </button>
                </div>
              ) : !canShowDona ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                  <Package className="size-10 text-muted-foreground/30" />
                  <p className="text-sm font-bold text-muted-foreground">Categoría única en el período</p>
                  <p className="text-xs text-muted-foreground/70 max-w-xs">
                    {catComposition.data.map((c: any) => `${c.name}: ${formatConvertedAmount(c.value, 'NIO')}`).join(' · ')}
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={catComposition.data}
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="name"
                    >
                      {catComposition.data.map((_, idx) => (
                        <Cell key={idx} fill={['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'][idx % 6]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={DARK_TOOLTIP}
                      formatter={(v: number, name: string, item: any) => {
                        const raw = item?.payload as any;
                        const pct = catComposition.total > 0 ? ((Number(v) / catComposition.total) * 100).toFixed(1) : '0.0';
                        return [
                          <span key="v">{formatConvertedAmount(Number(v), 'NIO')} · Participación: {pct}%<br />Unidades: {raw?.unidades ?? 0} · Productos: {raw?.productos ?? 0}</span>,
                          String(name)
                        ];
                      }}
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    />
                    <Legend verticalAlign="bottom" height={36} formatter={(value: string) => <span style={{ color: 'hsl(var(--foreground))', fontSize: 11 }}>{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Evolution & Billing Comparison ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="sales-chart-trend" className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2">
              <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <Activity className="size-4 text-primary" /> Evolución de Ventas
              </CardTitle>
              <div className="flex items-center gap-1 bg-muted/30 p-0.5 rounded-lg w-fit">
                <button onClick={() => setEvolutionTab('acumulada')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${evolutionTab === 'acumulada' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Evolución acumulada</button>
                <button onClick={() => setEvolutionTab('aging')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${evolutionTab === 'aging' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Antigüedad de CxC</button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {evolutionTab === 'acumulada' ? (
              <div className="h-[200px] w-full pt-3">
                {serie.points.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
                    <Activity className="size-8 text-muted-foreground/30" />
                    <p className="text-xs font-bold text-muted-foreground">Sin movimientos registrados en este período</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={serie.points} margin={{ top: 14, right: 8, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtShort(v)} />
                      <Tooltip
                        contentStyle={DARK_TOOLTIP}
                        cursor={{ stroke: 'rgba(148,163,184,0.4)', strokeDasharray: '4 4' }}
                        formatter={(v: any, name: string) => {
                          if (v === null || v === undefined) return ['—', name];
                          return [formatConvertedAmount(Number(v), 'NIO'), name === 'ventas' ? 'Venta del intervalo' : 'Acumulado'];
                        }}
                        labelFormatter={(l: any) => `${l} · ${rangeLabel}`}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700, color: 'hsl(var(--foreground))' }} />
                      <Bar dataKey="ventas" name="Ventas netas" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={26} />
                      <Line type="monotone" dataKey="acumulado" name="Acumulado" stroke="#10b981" strokeWidth={2.5} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            ) : (
              <div className="h-[200px] w-full pt-3">
                {cxcAging.every(b => b.monto === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
                    <Clock className="size-8 text-muted-foreground/30" />
                    <p className="text-xs font-bold text-muted-foreground">Sin cuentas por cobrar</p>
                    <p className="text-[10px] text-muted-foreground/70">No existen facturas pendientes para el período y filtros seleccionados.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cxcAging} layout="vertical" margin={{ left: 10, right: 24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtShort(v)} />
                      <YAxis dataKey="label" type="category" tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }} width={110} />
                      <Tooltip contentStyle={DARK_TOOLTIP} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v: number, _name: string, item: any) => {
                        const raw = item?.payload as any;
                        return [`${formatConvertedAmount(Number(v), 'NIO')} · ${raw?.facturas ?? 0} facturas · ${(raw?.pct ?? 0).toFixed(1)}% de la cartera`, 'Monto'];
                      }} />
                      <Bar dataKey="monto" name="Monto" radius={[0, 5, 5, 0]} maxBarSize={18}>
                        {cxcAging.map((_, i) => <Cell key={i} fill={['#10b981', '#f59e0b', '#f97316', '#ef4444', '#b91c1c'][i % 5]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card id="sales-chart-bar" className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2">
              <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="size-4 text-primary" /> Ventas Facturadas y Cobros Recibidos
              </CardTitle>
              <div className="flex items-center gap-1 bg-muted/30 p-0.5 rounded-lg w-fit">
                <button onClick={() => setCobroMode('todos')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${cobroMode === 'todos' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Cobros totales</button>
                <button onClick={() => setCobroMode('periodo')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${cobroMode === 'periodo' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Solo del período</button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serie.points} barGap={6} margin={{ top: 16, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtShort(v)} />
                  <Tooltip
                    contentStyle={DARK_TOOLTIP}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    formatter={(v: any, name: string, item: any) => {
                      const raw = item?.payload as any;
                      if (name === 'Ventas netas facturadas') return [formatConvertedAmount(Number(v), 'NIO'), name];
                      if (name === 'Cobros totales recibidos') {
                        const delPeriodo = raw?.cobradoPeriodo ?? 0;
                        return [`${formatConvertedAmount(Number(v), 'NIO')} · de facturas del período: ${formatConvertedAmount(delPeriodo, 'NIO')} · cartera anterior: ${formatConvertedAmount(Math.max(0, Number(v) - delPeriodo), 'NIO')}`, name];
                      }
                      return [formatConvertedAmount(Number(v), 'NIO'), name];
                    }}
                    labelFormatter={(l: any) => `${l} · ${rangeLabel}`}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700, color: 'hsl(var(--foreground))' }} />
                  <Bar dataKey="ventas" name="Ventas netas facturadas" fill="#3b82f6" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="ventas" position="top" formatter={(v: any) => Number(v) > 0 ? fmtShort(Number(v)) : ''} style={{ fontSize: 8, fill: '#3b82f6', fontWeight: 700 }} />
                  </Bar>
                  <Bar dataKey={cobroMode === 'todos' ? 'cobrado' : 'cobradoPeriodo'} name={cobroMode === 'todos' ? 'Cobros totales recibidos' : 'Cobros de facturas del período'} fill={cobroMode === 'todos' ? '#10b981' : '#06b6d4'} radius={[6, 6, 0, 0]}>
                    <LabelList dataKey={cobroMode === 'todos' ? 'cobrado' : 'cobradoPeriodo'} position="top" formatter={(v: any) => Number(v) > 0 ? fmtShort(Number(v)) : ''} style={{ fontSize: 8, fill: cobroMode === 'todos' ? '#10b981' : '#06b6d4', fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2">
              <div className="flex items-center gap-1.5">
                <CreditCard className="size-3.5 text-teal-400" />
                <p className="text-[10px] font-black uppercase tracking-wider">Conversión de facturación en efectivo del período</p>
              </div>
              {conversionPct === null ? (
                <p className="text-[10px] text-muted-foreground">0% convertido · Las facturas del período todavía no registran cobros aplicados</p>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  <span className="font-black text-teal-400">{conversionPct.toFixed(1)}%</span> · {formatConvertedAmount(cobrosDeFacturasDelPeriodo, 'NIO')} cobrados de {formatConvertedAmount(ventasNetas, 'NIO')} facturados
                </p>
              )}
            </div>
            <p className="text-[9px] text-muted-foreground/60 mt-1">Los cobros recibidos pueden incluir pagos de facturas emitidas en períodos anteriores.</p>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Resumen Operativo de Ventas ═══ */}
      <Card id="sales-health-card" className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
            <Users className="size-4 text-primary" /> Resumen Operativo de Ventas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-1.5">
                <Target className="size-3.5 text-primary" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Cumplimiento de Meta</p>
              </div>
              <p className="text-xl font-black text-primary">Sin configurar</p>
              <button onClick={() => toast.info('La configuración de metas de ventas estará disponible próximamente.')} className="mt-1 text-[9px] font-black uppercase tracking-wider text-primary hover:text-primary/80">
                Configurar meta
              </button>
            </div>
            <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10 cursor-pointer hover:bg-rose-500/10 transition-all" onClick={() => setModal({ type: 'ajustes' })}>
              <div className="flex items-center gap-1.5">
                <Receipt className="size-3.5 text-rose-500" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Descuentos y Devoluciones</p>
              </div>
              <p className="text-xl font-black text-rose-500">{formatConvertedAmount(ajustes, 'NIO')}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">
                {ventasBrutas > 0 ? `${((ajustes / ventasBrutas) * 100).toFixed(1)}% de las ventas brutas` : '0.0% de las ventas brutas'}
              </p>
              <p className="text-[9px] text-muted-foreground/60 mt-0.5 flex items-center gap-1">
                <span className="cursor-help flex items-center gap-1" title={`Descuentos: ${formatConvertedAmount(descuentos, 'NIO')} · Devoluciones: ${formatConvertedAmount(devoluciones, 'NIO')} · Notas de crédito: ${formatConvertedAmount(notasCredito, 'NIO')}`}>
                  <Info className="size-3 shrink-0" /> Ver detalle
                </span>
              </p>
            </div>
            <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10">
              <div className="flex items-center gap-1.5">
                <Package className="size-3.5 text-orange-500" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Costo de Venta</p>
              </div>
              <p className="text-xl font-black text-orange-500">{costMissing > 0 ? 'N/D' : formatConvertedAmount(totalCost, 'NIO')}</p>
              {costMissing > 0 ? (
                <button onClick={() => setModal({ type: 'costs' })} className="mt-1 text-[9px] font-black uppercase tracking-wider text-orange-400 hover:text-orange-300">
                  {costMissing} producto(s) sin costo · Completar costos
                </button>
              ) : (
                <p className="text-[9px] text-muted-foreground mt-0.5">{ventasNetas > 0 ? `${((totalCost / ventasNetas) * 100).toFixed(1)}% de las ventas netas` : 'Costo real de lo vendido'}</p>
              )}
            </div>
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
              <div className="flex items-center gap-1.5">
                <ShoppingCart className="size-3.5 text-blue-500" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Ticket Promedio</p>
              </div>
              <p className="text-xl font-black text-blue-500">{formatConvertedAmount(avgTicket, 'NIO')}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{facturasValidas} facturas · {ticketTrend.text}</p>
            </div>
            <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/10">
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-violet-500" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Plazo Promedio de Cobro</p>
              </div>
              <p className="text-xl font-black text-violet-500">
                {plazoPromedioCobro.value === null ? 'N/D' : plazoPromedioCobro.value === 0 ? 'Mismo día' : `${plazoPromedioCobro.value.toFixed(1)} días`}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">
                {plazoPromedioCobro.count === 0 ? 'Sin facturas pagadas para calcular el plazo' : `Basado en ${plazoPromedioCobro.count} factura(s) pagada(s)`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ Top Items ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Principales Clientes */}
        <Card className="border-blue-500/20 min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Users className="size-4 text-blue-500" /> Principales Clientes por Ventas Netas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topCustomers.list.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center gap-2 text-center">
                <Users className="size-8 text-muted-foreground/30" />
                <p className="text-xs font-bold text-muted-foreground">Sin clientes con ventas en el período</p>
              </div>
            ) : (
              <>
                <div className={cn("flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold", topCustomers.top5Share > 60 ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-muted/30 text-muted-foreground")}>
                  <AlertTriangle className={cn("size-3.5", topCustomers.top5Share > 60 ? "text-amber-500" : "text-muted-foreground/50")} />
                  {topCustomers.top5Share > 60
                    ? `Los cinco principales clientes representan el ${topCustomers.top5Share.toFixed(1)}% de las ventas. Alta concentración de ventas en pocos clientes: riesgo de dependencia comercial.`
                    : `Los cinco principales clientes representan el ${topCustomers.top5Share.toFixed(1)}% de las ventas.`}
                </div>
                {topCustomers.list.slice(0, 5).map((c, idx) => (
                  <button
                    key={c.name}
                    onClick={() => setModal({ type: 'customer', data: c })}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all cursor-pointer gap-4 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="size-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-[10px] font-black text-blue-600 shrink-0">
                        #{idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                          {formatConvertedAmount(c.ventas, 'NIO')} · {c.pct.toFixed(1)}% de las ventas · {c.facturas} facturas
                          {c.saldo > 0 && <span className="text-rose-400 font-bold"> · saldo {formatConvertedAmount(c.saldo, 'NIO')}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.trendPct !== null && (
                        <span className={`text-[9px] font-bold ${c.trendPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} title={`vs. ${prevLabel}`}>
                          {c.trendPct >= 0 ? '↑' : '↓'} {Math.abs(c.trendPct).toFixed(1)}%
                        </span>
                      )}
                      <Eye className="size-4 text-blue-400 shrink-0 opacity-50" />
                    </div>
                  </button>
                ))}
                {topCustomers.list.length > 5 && (
                  <button onClick={() => setModal({ type: 'customers' })} className="w-full text-center py-2 text-[10px] font-black uppercase tracking-wider text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1">
                    Ver todos ({topCustomers.list.length}) <ArrowUpRight className="size-3" />
                  </button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Productos con Mayor Contribución */}
        <Card id="top-products-card" className="border-purple-500/20 min-w-0">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2">
              <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <ShoppingCart className="size-4 text-purple-500" /> Productos con Mayor Contribución a Ventas
              </CardTitle>
              <div className="flex items-center gap-1 bg-muted/30 p-0.5 rounded-lg w-fit">
                <button onClick={() => setProductMetric('revenue')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${productMetric === 'revenue' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Facturación</button>
                <button onClick={() => setProductMetric('qty')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${productMetric === 'qty' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Unidades</button>
                <button onClick={() => setProductMetric('profit')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${productMetric === 'profit' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Utilidad bruta</button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {productMetric === 'profit' && costMissing > 0 ? (
              <div className="h-40 flex flex-col items-center justify-center gap-3 text-center">
                <AlertTriangle className="size-8 text-amber-500/60" />
                <p className="text-xs font-bold text-muted-foreground max-w-xs">No disponible: existen productos vendidos sin costo registrado.</p>
                <button onClick={() => setModal({ type: 'costs' })} className="text-[10px] font-black uppercase tracking-wider text-purple-400 hover:text-purple-300 flex items-center gap-1">
                  Revisar productos sin costo <ArrowUpRight className="size-3" />
                </button>
              </div>
            ) : visibleProducts.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center gap-2 text-center">
                <ShoppingCart className="size-8 text-muted-foreground/30" />
                <p className="text-xs font-bold text-muted-foreground">Sin productos vendidos en el período</p>
              </div>
            ) : (
              <>
                {visibleProducts.slice(0, 5).map((p, idx) => (
                  <button
                    key={p.name}
                    onClick={() => setModal({ type: 'product', data: p })}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-purple-500/5 border border-purple-500/10 hover:bg-purple-500/10 hover:border-purple-500/30 transition-all cursor-pointer gap-4 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="size-7 rounded-lg bg-purple-500/20 flex items-center justify-center text-[10px] font-black text-purple-600 shrink-0">
                        #{idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {productMetric === 'qty'
                            ? `${p.qty} unidades · ${formatConvertedAmount(p.revenue, 'NIO')} · precio promedio ${formatConvertedAmount(p.priceAvg, 'NIO')}`
                            : productMetric === 'profit'
                            ? `Utilidad bruta: ${formatConvertedAmount(p.profit, 'NIO')} · margen ${p.margin === null ? 'N/D' : `${p.margin.toFixed(1)}%`}`
                            : `${formatConvertedAmount(p.revenue, 'NIO')} · ${p.qty} unidades · participación ${topProducts.prodTotal > 0 ? ((p.revenue / topProducts.prodTotal) * 100).toFixed(1) : '0.0'}%`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {p.trendPct !== null && (
                        <span className={`text-[9px] font-bold ${p.trendPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`} title={`vs. ${prevLabel}`}>
                          {p.trendPct >= 0 ? '↑' : '↓'} {Math.abs(p.trendPct).toFixed(1)}%
                        </span>
                      )}
                      <span className="text-xs font-black text-purple-500">
                        {productMetric === 'qty' ? `${p.qty} uds.` : productMetric === 'profit' ? formatConvertedAmount(p.profit, 'NIO') : formatConvertedAmount(p.revenue, 'NIO')}
                      </span>
                      <Eye className="size-4 text-purple-400 shrink-0 opacity-50" />
                    </div>
                  </button>
                ))}
                {visibleProducts.length > 5 && (
                  <button onClick={() => setModal({ type: 'products' })} className="w-full text-center py-2 text-[10px] font-black uppercase tracking-wider text-purple-400 hover:text-purple-300 flex items-center justify-center gap-1">
                    Ver todos ({visibleProducts.length}) <ArrowUpRight className="size-3" />
                  </button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Detail Modals ═══ */}
      <Dialog open={!!modal} onOpenChange={(open) => { if (!open) setModal(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modal?.type === 'invoices' && <><Receipt className="size-4" /> Detalle de Facturas del Período</>}
              {modal?.type === 'cxc' && <><Clock className="size-4" /> Cuentas por Cobrar</>}
              {modal?.type === 'costs' && <><AlertTriangle className="size-4" /> Completar Costos</>}
              {modal?.type === 'ajustes' && <><Receipt className="size-4" /> Descuentos, Devoluciones y Notas de Crédito</>}
              {modal?.type === 'customers' && <><Users className="size-4" /> Todos los Clientes</>}
              {modal?.type === 'products' && <><ShoppingCart className="size-4" /> Todos los Productos</>}
              {modal?.type === 'uncategorized' && <><PieChartIcon className="size-4" /> Productos sin Categorizar</>}
              {modal?.type === 'customer' && <><Users className="size-4" /> Detalle del Cliente</>}
              {modal?.type === 'product' && <><ShoppingCart className="size-4" /> Detalle del Producto</>}
            </DialogTitle>
            <DialogDescription>
              {modal?.type === 'invoices' && `Facturas válidas del período (${sortedInvoices.length}).`}
              {modal?.type === 'cxc' && `Facturas pendientes de cobro (${sortedPending.length}).`}
              {modal?.type === 'costs' && (missingCostProducts.length > 0 ? `${missingCostProducts.length} producto(s) vendidos sin costo registrado.` : 'No hay productos pendientes de costo.')}
              {modal?.type === 'ajustes' && 'Conciliación de ajustes sobre las ventas del período.'}
              {modal?.type === 'customers' && `${topCustomers.list.length} clientes con ventas en el período.`}
              {modal?.type === 'products' && `${visibleProducts.length} productos vendidos en el período.`}
              {modal?.type === 'uncategorized' && `${uncategorizedProducts.length} producto(s) pendientes de categorización.`}
              {modal?.type === 'customer' && 'Información del cliente y su historial de compras.'}
              {modal?.type === 'product' && 'Rendimiento del producto en el período seleccionado.'}
            </DialogDescription>
          </DialogHeader>

          {modal?.type === 'invoices' && (
            <div className="space-y-2">
              {sortedInvoices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin facturas válidas en el período.</p>
              ) : (
                sortedInvoices.slice(0, 150).map(inv => (
                  <div key={inv.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/30">
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{inv.number} · {inv.customer?.name || inv.customerName || 'Consumidor Final'}</p>
                      <p className="text-[10px] text-muted-foreground">{(toDate(inv.date || inv.createdAt) || new Date()).toLocaleDateString('es-NI')}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {statusBadge(inv.status)}
                      <p className="text-xs font-black">{formatConvertedAmount(toNio(inv), 'NIO')}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {modal?.type === 'cxc' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 pb-1">
                <div className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/10 text-center flex-1 min-w-[120px]">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Saldo total</p>
                  <p className="text-sm font-black text-rose-500">{formatConvertedAmount(totalPending, 'NIO')}</p>
                </div>
                <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-center flex-1 min-w-[120px]">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Vencido</p>
                  <p className="text-sm font-black text-amber-500">{formatConvertedAmount(vencido, 'NIO')}</p>
                </div>
              </div>
              {sortedPending.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No existen facturas pendientes para el período y filtros seleccionados.</p>
              ) : (
                sortedPending.slice(0, 100).map(inv => {
                  const due = toDate(inv.dueDate);
                  const days = due ? Math.floor((Date.now() - due.getTime()) / DAY_MS) : -1;
                  return (
                    <div key={inv.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/30">
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{inv.number} · {inv.customer?.name || inv.customerName || 'Consumidor Final'}</p>
                        <p className="text-[10px] text-muted-foreground">Vence: {(due || new Date()).toLocaleDateString('es-NI')}{days > 0 ? ` · ${days} días vencido` : ''}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {statusBadge(inv.status)}
                        <p className="text-xs font-black text-rose-500">{formatConvertedAmount(toNioAmt(inv.balanceDue ?? inv.balance ?? (Number(inv.total || 0) - Number(inv.amountPaid || 0)), inv.currency, inv.exchangeRate), 'NIO')}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {modal?.type === 'costs' && (
            <div className="space-y-2">
              {missingCostProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Todos los productos vendidos en el período tienen costo registrado.</p>
              ) : (
                <>
                  <p className="text-[10px] text-amber-500 font-bold">Estos productos impiden el cálculo de utilidad bruta y margen:</p>
                  {missingCostProducts.slice(0, 100).map(p => (
                    <div key={p.name} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/30">
                      <p className="text-xs font-bold truncate">{p.name}</p>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black">{p.qty} unidades</p>
                        <p className="text-[10px] text-muted-foreground">{formatConvertedAmount(p.revenue, 'NIO')}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {modal?.type === 'ajustes' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/10 text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Descuentos</p>
                  <p className="text-lg font-black text-rose-500">{formatConvertedAmount(descuentos, 'NIO')}</p>
                </div>
                <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/10 text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Devoluciones</p>
                  <p className="text-lg font-black text-orange-500">{formatConvertedAmount(devoluciones, 'NIO')}</p>
                </div>
                <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/10 text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Notas de crédito</p>
                  <p className="text-lg font-black text-purple-500">{formatConvertedAmount(notasCredito, 'NIO')}</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-muted/30">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Conciliación</p>
                <p className="text-xs mt-1">
                  Ventas brutas: <span className="font-bold">{formatConvertedAmount(ventasBrutas, 'NIO')}</span> · Ajustes: <span className="font-bold text-rose-500">-{formatConvertedAmount(ajustes, 'NIO')}</span> · Ventas netas: <span className="font-black text-emerald-500">{formatConvertedAmount(ventasNetas, 'NIO')}</span>
                </p>
              </div>
            </div>
          )}

          {modal?.type === 'customers' && (
            <div className="space-y-2">
              {topCustomers.list.map((c, idx) => (
                <button key={c.name} onClick={() => setModal({ type: 'customer', data: c })} className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all text-left">
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">#{idx + 1} {c.name}</p>
                    <p className="text-[10px] text-muted-foreground">{c.facturas} facturas{c.saldo > 0 ? ` · saldo ${formatConvertedAmount(c.saldo, 'NIO')}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-xs font-black">{c.pct.toFixed(1)}% · {formatConvertedAmount(c.ventas, 'NIO')}</p>
                    <Eye className="size-3.5 text-blue-400 opacity-50" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {modal?.type === 'products' && (
            <div className="space-y-2">
              {visibleProducts.map((p, idx) => (
                <button key={p.name} onClick={() => setModal({ type: 'product', data: p })} className="w-full flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all text-left">
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">#{idx + 1} {p.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {productMetric === 'qty' ? `${p.qty} unidades` : productMetric === 'profit' ? `Utilidad: ${formatConvertedAmount(p.profit, 'NIO')} · margen ${p.margin === null ? 'N/D' : `${p.margin.toFixed(1)}%`}` : `${p.qty} unidades · participación ${topProducts.prodTotal > 0 ? ((p.revenue / topProducts.prodTotal) * 100).toFixed(1) : '0.0'}%`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-xs font-black">{formatConvertedAmount(p.revenue, 'NIO')}</p>
                    <Eye className="size-3.5 text-purple-400 opacity-50" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {modal?.type === 'uncategorized' && (
            <div className="space-y-2">
              {uncategorizedProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No hay productos sin categoría en el período.</p>
              ) : (
                uncategorizedProducts.slice(0, 100).map(p => (
                  <div key={p.name} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/30">
                    <p className="text-xs font-bold truncate">{p.name}</p>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black">{p.qty} unidades</p>
                      <p className="text-[10px] text-muted-foreground">{formatConvertedAmount(p.revenue, 'NIO')}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {modal?.type === 'customer' && (() => {
            const c = modal.data;
            const invs = fInv.filter(i => (i.customer?.name || i.customerName || 'Consumidor Final') === c.name);
            const cobros = fPay.filter(p => (p.customer?.name || p.customerName || 'Consumidor Final') === c.name);
            const prodMap = new Map<string, { name: string; qty: number; revenue: number }>();
            invs.forEach(inv => {
              (inv.items || []).forEach((item: any) => {
                const name = item.product?.name || item.description || 'Producto';
                const row = prodMap.get(name) || { name, qty: 0, revenue: 0 };
                row.qty += Number(item.quantity || 0);
                row.revenue += inv.currency === 'USD' ? Number((item.total ?? item.unitPrice * (item.quantity || 1)) || 0) * (inv.exchangeRate || exchangeRate) : Number((item.total ?? item.unitPrice * (item.quantity || 1)) || 0);
                prodMap.set(name, row);
              });
            });
            const cobrosTotal = cobros.reduce((a, p) => a + toNioAmt(p.amount, p.currency, p.exchangeRate), 0);
            const ticket = invs.length > 0 ? c.ventas / invs.length : 0;
            return (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                  <p className="text-sm font-black">{c.name}</p>
                  <p className="text-xs text-muted-foreground">Total facturado: {formatConvertedAmount(c.ventas, 'NIO')} · Saldo pendiente: {formatConvertedAmount(c.saldo, 'NIO')}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Facturas</p>
                    <p className="text-xl font-black text-emerald-500">{invs.length}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Cobros</p>
                    <p className="text-xl font-black text-blue-500">{formatConvertedAmount(cobrosTotal, 'NIO')}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-violet-500/5 border border-violet-500/10 text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Ticket promedio</p>
                    <p className="text-xl font-black text-violet-500">{formatConvertedAmount(ticket, 'NIO')}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Última compra</p>
                    <p className="text-xl font-black text-amber-500">{c.lastDate ? new Date(c.lastDate).toLocaleDateString('es-NI') : '—'}</p>
                  </div>
                </div>
                {prodMap.size > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Productos comprados</p>
                    <div className="space-y-1.5">
                      {Array.from(prodMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10).map(p => (
                        <div key={p.name} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30">
                          <p className="text-xs font-bold truncate">{p.name}</p>
                          <p className="text-xs font-black shrink-0">{p.qty} uds · {formatConvertedAmount(p.revenue, 'NIO')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {modal?.type === 'product' && (() => {
            const p = modal.data;
            const qty = Number(p.qty || 0);
            return (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
                  <p className="text-sm font-black">{p.name}</p>
                  <p className="text-xs text-muted-foreground">Rendimiento en el período seleccionado</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Unidades</p>
                    <p className="text-xl font-black text-emerald-500">{qty}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Ingresos</p>
                    <p className="text-xl font-black text-blue-500">{formatConvertedAmount(p.revenue, 'NIO')}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10 text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Utilidad bruta</p>
                    <p className="text-xl font-black text-cyan-500">{costMissing > 0 ? 'N/D' : formatConvertedAmount(p.profit, 'NIO')}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-violet-500/5 border border-violet-500/10 text-center">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Precio promedio</p>
                    <p className="text-xl font-black text-violet-500">{formatConvertedAmount(p.priceAvg, 'NIO')}</p>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
});
SalesReportTab.displayName = 'SalesReportTab';
