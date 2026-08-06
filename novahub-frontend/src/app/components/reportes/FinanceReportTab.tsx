import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart, BarChart, Line, Bar, Area, Cell, LabelList } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { invoicesService, paymentsService } from '../../services/ventas.service';
import { billsService, paymentsMadeService } from '../../services/compras.service';
import { incomeService, expensesService, recurringIncomesService, recurringExpensesService } from '../../services/finanzas.service';
import { contabilidadService } from '../../services/contabilidad.service';
import { cajaService } from '../../services/caja.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Percent, ArrowUpRight, ArrowDownRight, Activity, Scale, BarChart3, Wallet, TrendingUp, TrendingDown, Receipt, AlertTriangle, Target, CalendarDays, Info, CreditCard, PieChart as PieChartIcon, Layers, FileText, Banknote, ShieldCheck, RefreshCw } from 'lucide-react';
import type { ReportExportRef, ReportProps } from './types';
import { getBase64Image, sanitizeHtml2CanvasOklch, downloadExcelWorkbook } from '../../utils/reportExportUtils';
import { cn } from '../ui/utils';
import {
  DAY_MS, endOfDay, fmtRange, getRangeDates, shiftYearClamped, startOfDay, toDate,
  isValidSalesInvoice, isCreditRecord, isValidBill,
  toNioAmt, saldoOf, buildFinSerie, flowTotals, coberturaPagos, buildPosition, buildAging,
  buildIngresoComposition, buildPagoComposition, buildCashHistory, buildForecast,
  buildProfitability, buildLiquidez, cashFromBalanceSheet, buildBudget, buildRecurrentes,
  buildCajaInfo, isPeriodClosed, buildBreakEven, buildIndicadores,
} from './financialAnalytics';
import type { FinancialData, BreakEvenConfig, BreakEvenResult, CostBehavior } from './financialAnalytics';
import { getPdfDesignSettings, pdfDesignPaper } from '../../utils/pdfGenerator';

const STATUS_LABEL: Record<string, string> = {
  PAID: 'Pagado',
  PARTIAL: 'Parcial',
  PENDING: 'Pendiente',
  OVERDUE: 'Vencido',
  APPROVED: 'Aprobado',
  ACTIVE: 'Activo',
  COMPLETED: 'Completada',
  PENDIENTE: 'Pendiente',
  CONCILIADO: 'Conciliada',
  CERRADO: 'Cerrada',
};
const STATUS_COLOR: Record<string, string> = {
  PAID: 'bg-emerald-500/10 text-emerald-500',
  PARTIAL: 'bg-amber-500/10 text-amber-500',
  PENDING: 'bg-slate-400/10 text-slate-400',
  OVERDUE: 'bg-rose-500/10 text-rose-500',
  APPROVED: 'bg-emerald-500/10 text-emerald-500',
  ACTIVE: 'bg-emerald-500/10 text-emerald-500',
  COMPLETED: 'bg-emerald-500/10 text-emerald-500',
  PENDIENTE: 'bg-amber-500/10 text-amber-500',
  CONCILIADO: 'bg-emerald-500/10 text-emerald-500',
  CERRADO: 'bg-emerald-500/10 text-emerald-500',
};

type ModalState =
  | { type: 'ingresos' }
  | { type: 'pagos' }
  | { type: 'cxc' }
  | { type: 'cxp' }
  | { type: 'compromisos' }
  | { type: 'caja' }
  | { type: 'presupuesto' }
  | { type: 'recurrentes' }
  | { type: 'liquidez' }
  | null;

const DARK_TOOLTIP = {
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(12,14,20,0.97)',
  fontSize: 12,
  color: '#f4f4f5',
  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
  padding: '10px 12px',
} as const;

export const FinanceReportTab = forwardRef<ReportExportRef, ReportProps>(({ dateRange }, ref) => {
  const { displayCurrency, formatConvertedAmount, convertAmount, exchangeRate } = useCurrency();
  const { themeConfig } = useTheme();
  const { user } = useAuth();
  const currencySymbol = displayCurrency === 'USD' ? '$' : 'C$';

  const [raw, setRaw] = useState<FinancialData | null>(null);
  const [profitLoss, setProfitLoss] = useState<any>(null);
  const [profitLossPrev, setProfitLossPrev] = useState<any>(null);
  const [balanceSheet, setBalanceSheet] = useState<any>(null);
  const [balanceSheetStart, setBalanceSheetStart] = useState<any>(null);
  const [trialRows, setTrialRows] = useState<any[]>([]);
  const [budgetItems, setBudgetItems] = useState<any[]>([]);
  const [budgetAccounts, setBudgetAccounts] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [reconciliations, setReconciliations] = useState<any[]>([]);
  const [registers, setRegisters] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [journalsPending, setJournalsPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const [comparison, setComparison] = useState<'anterior' | 'anio-anterior'>('anterior');
  const [serieMode, setSerieMode] = useState<'intervalo' | 'acumulado'>('intervalo');
  const [flujoMode, setFlujoMode] = useState<'cobros' | 'flujo'>('cobros');
  const [cashTab, setCashTab] = useState<'historico' | 'proyeccion'>('historico');
  const [ingTab, setIngTab] = useState<'origen' | 'aging' | 'movimientos'>('origen');
  const [pagTab, setPagTab] = useState<'categoria' | 'aging' | 'movimientos'>('categoria');
  const [pnlTab, setPnlTab] = useState<'rentabilidad' | 'equilibrio' | 'liquidez' | 'indicadores'>('rentabilidad');
  const [breakEvenConfig, setBreakEvenConfig] = useState<BreakEvenConfig>(() => {
    try { return JSON.parse(localStorage.getItem('erp-breakeven-config') || '{}'); } catch { return {}; }
  });

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

  const arr = (res: any) => Array.isArray(res) ? res : (res?.data || []);
  const arr2 = (res: any) => Array.isArray(res) ? res : (res?.items || res?.rows || []);
  const toIso = (d: Date) => d.toISOString();

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const { start, prevStart, prevEnd } = getRangeDates(dateRange);
        const now = new Date();
        const [
          invR, payR, bilR, ppayR, incR, expR, rincR, rexpR,
          plR, plPrevR, bsR, bsStartR, tbR, bdR, accR, perR, recR, jR, regR, sesR
        ] = await Promise.all([
          invoicesService.getAll().catch(() => ({ data: [] })),
          paymentsService.getAll().catch(() => ({ data: [] })),
          billsService.getAll().catch(() => ({ data: [] })),
          paymentsMadeService.getAll().catch(() => ({ data: [] })),
          incomeService.getAll().catch(() => []),
          expensesService.getAll().catch(() => []),
          recurringIncomesService.getAll().catch(() => []),
          recurringExpensesService.getAll().catch(() => []),
          contabilidadService.getProfitLoss({ dateFrom: toIso(start), dateTo: toIso(now) }).catch(() => null),
          (prevStart && prevEnd) ? contabilidadService.getProfitLoss({ dateFrom: toIso(prevStart), dateTo: toIso(prevEnd) }).catch(() => null) : Promise.resolve(null),
          contabilidadService.getBalanceSheet({ date: toIso(now) }).catch(() => null),
          contabilidadService.getBalanceSheet({ date: toIso(new Date(start.getTime() - DAY_MS)) }).catch(() => null),
          contabilidadService.getTrialBalance({ dateFrom: toIso(start), dateTo: toIso(now) }).catch(() => null) as Promise<any>,          contabilidadService.getBudgetItems().catch(() => []),
          contabilidadService.getChartOfAccounts().catch(() => []),
          contabilidadService.getPeriods().catch(() => []),
          contabilidadService.getReconciliations().catch(() => []),
          contabilidadService.getJournals().catch(() => []),
          cajaService.getRegisters(true).catch(() => []),
          cajaService.getSessionHistory().catch(() => ({ items: [] })),
        ]);
        const flatAccounts: any[] = [];
        const flatten = (nodes: any[]) => { for (const n of nodes) { flatAccounts.push(n); if (n.children) flatten(n.children); } };
        flatten(arr(accR));
        setRaw({
          salesInvoices: arr(invR),
          salesPayments: arr(payR),
          salesReturns: [],
          salesCreditNotes: [],
          purchaseBills: arr(bilR),
          purchasePayments: arr(ppayR),
          purchaseCredits: [],
          incomes: arr(incR),
          expenses: arr(expR),
          recurringIncomes: arr(rincR),
          recurringExpenses: arr(rexpR),
          orders: [],
        });
        setProfitLoss(plR);
        setProfitLossPrev(plPrevR);
        setBalanceSheet(bsR);
        setBalanceSheetStart(bsStartR);
        setTrialRows(Array.isArray(tbR) ? tbR : (tbR?.rows || []));
        setBudgetItems(arr(bdR));
        setBudgetAccounts(flatAccounts);
        setPeriods(arr(perR));
        setReconciliations(arr(recR));
        setRegisters(arr(regR));
        setSessions(arr2(sesR));
        const jList = arr(jR);
        setJournalsPending(jList.filter((j: any) => {
          const s = String(j.status || '').toUpperCase();
          return s !== 'POSTED' && s !== 'APPROVED' && s !== 'VOIDED' && s !== 'CANCELLED' && s !== 'CANCELED';
        }).length);
      } catch (e: any) {
        toast.error(e?.response?.data?.message || e?.message || "Error cargando finanzas");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [dateRange]);

  const { start: currentStart, prevStart, prevEnd, durationDays } = useMemo(() => getRangeDates(dateRange), [dateRange]);

  const { prevStart: cPrevStart, prevEnd: cPrevEnd } = useMemo(() => {
    if (!prevStart || !prevEnd || comparison === 'anterior') return { prevStart, prevEnd };
    return { prevStart: startOfDay(shiftYearClamped(prevStart, 1)), prevEnd: endOfDay(shiftYearClamped(prevEnd, 1)) };
  }, [prevStart, prevEnd, comparison]);

  const rangeLabel = useMemo(() => currentStart.getTime() > 0 ? fmtRange(currentStart, endOfDay(new Date())) : 'Todo el historial', [currentStart]);
  const prevLabel = useMemo(() => fmtRange(cPrevStart, cPrevEnd), [cPrevStart, cPrevEnd]);
  const periodoCerrado = useMemo(() => isPeriodClosed(periods, new Date()), [periods]);

  const navigateContabilidad = (section: string) => {
    window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module: 'contabilidad', subModule: section } }));
  };

  const endNow = useMemo(() => endOfDay(new Date()), []);

  const serie = useMemo(() => {
    if (!raw) return { mode: 'month' as const, points: [] as ReturnType<typeof buildFinSerie>['points'] };
    return buildFinSerie(raw, currentStart, endNow, durationDays, exchangeRate);
  }, [raw, currentStart, endNow, durationDays, exchangeRate]);

  const flow = useMemo(() => {
    if (!raw) return { ingresos: 0, pagos: 0, ingresosMov: 0, pagosMov: 0, flujoNeto: 0 };
    return flowTotals(raw, currentStart, endNow, exchangeRate);
  }, [raw, currentStart, endNow, exchangeRate]);

  const prevFlow = useMemo(() => {
    if (!raw || !cPrevStart || !cPrevEnd) return { ingresos: 0, pagos: 0, ingresosMov: 0, pagosMov: 0, flujoNeto: 0 };
    return flowTotals(raw, cPrevStart, cPrevEnd, exchangeRate);
  }, [raw, cPrevStart, cPrevEnd, exchangeRate]);

  const cobertura = useMemo(() => coberturaPagos(flow.ingresos, flow.pagos), [flow]);

  const position = useMemo(() => {
    if (!raw) return { cxc: { total: 0, vencido: 0, facturas: 0 }, cxp: { total: 0, vencido: 0, facturas: 0 }, compromisos: { d7: { monto: 0, count: 0 }, d15: { monto: 0, count: 0 }, d30: { monto: 0, count: 0 } } };
    return buildPosition(raw, exchangeRate);
  }, [raw, exchangeRate]);

  const cashInfo = useMemo(() => cashFromBalanceSheet(balanceSheet), [balanceSheet]);

  const saldoInicial = useMemo(() => {
    const totalFlujo = serie.points.reduce((a, p) => a + p.flujo, 0);
    return cashInfo.total - totalFlujo;
  }, [cashInfo, serie]);

  const history = useMemo(() => buildCashHistory(serie.points, saldoInicial), [serie, saldoInicial]);

  const forecast = useMemo(() => {
    if (!raw) return null;
    return buildForecast(raw, cashInfo.total, exchangeRate, 90);
  }, [raw, cashInfo, exchangeRate]);

  const ingComposition = useMemo(() => {
    if (!raw) return { rows: [], movimientos: [] as any[] };
    return buildIngresoComposition(raw, currentStart, endNow, cPrevStart, cPrevEnd, exchangeRate);
  }, [raw, currentStart, endNow, cPrevStart, cPrevEnd, exchangeRate]);

  const pagComposition = useMemo(() => {
    if (!raw) return { rows: [], movimientos: [] as any[] };
    return buildPagoComposition(raw, currentStart, endNow, cPrevStart, cPrevEnd, exchangeRate);
  }, [raw, currentStart, endNow, cPrevStart, cPrevEnd, exchangeRate]);

  const cxcAging = useMemo(() => {
    if (!raw) return { buckets: [], total: 0 };
    const inv = raw.salesInvoices.filter(i => isValidSalesInvoice(i.status) && !isCreditRecord(i));
    return buildAging(inv, exchangeRate);
  }, [raw, exchangeRate]);

  const cxpAging = useMemo(() => {
    if (!raw) return { buckets: [], total: 0 };
    return buildAging(raw.purchaseBills.filter(b => isValidBill(b.status)), exchangeRate);
  }, [raw, exchangeRate]);

  const profitability = useMemo(() => buildProfitability(profitLoss, profitLossPrev), [profitLoss, profitLossPrev]);

  const liquidez = useMemo(() => buildLiquidez(cashInfo.total, position.cxc.total, position.cxp.total, position.compromisos.d30.monto), [cashInfo, position]);

  const indicadores = useMemo(() => buildIndicadores(balanceSheet, balanceSheetStart, profitability, position, cashInfo.total), [balanceSheet, balanceSheetStart, profitability, position, cashInfo]);

  const breakEven = useMemo(() => buildBreakEven(profitLoss, breakEvenConfig, flow.ingresos), [profitLoss, breakEvenConfig, flow.ingresos]);

  const setBehavior = (code: string, behavior: CostBehavior, fixedPercentage?: number) => {
    const next: BreakEvenConfig = { ...breakEvenConfig, [code]: { behavior, ...(behavior === 'MIXED' ? { fixedPercentage: fixedPercentage ?? 50, variablePercentage: 100 - (fixedPercentage ?? 50) } : {}) } };
    setBreakEvenConfig(next);
    try { localStorage.setItem('erp-breakeven-config', JSON.stringify(next)); } catch { /* intentionally empty */ }
  };

  const extraordinario = useMemo(() => {
    if (serieMode !== 'intervalo' || serie.points.length < 3) return null;
    const flujos = serie.points.map(p => Math.abs(p.flujo));
    const sorted = [...flujos].sort((a, b) => b - a);
    const segundoMayor = sorted[1] || 0;
    const mayor = sorted[0];
    if (mayor <= 0 || mayor <= segundoMayor * 2.5) return null;
    const pt = serie.points[flujos.indexOf(mayor)];
    return { label: pt.label, flujo: pt.flujo, categorias: pt.categorias };
  }, [serie, serieMode]);

  const cxcVencidoPct = useMemo(() => {
    if (position.cxc.total <= 0) return null;
    return (position.cxc.vencido / position.cxc.total) * 100;
  }, [position.cxc]);

  const liquidezAlta = liquidez.razonCorriente !== null && liquidez.razonCorriente > 10;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const budget = useMemo(() => buildBudget(budgetItems, budgetAccounts, trialRows, String(currentYear), currentMonth), [budgetItems, budgetAccounts, trialRows, currentYear, currentMonth]);

  const recurrentes = useMemo(() => {
    if (!raw) return { ingresos: 0, gastos: 0, ingMensual: 0, expMensual: 0, impactoNeto: 0, nextIng: null as any, nextExp: null as any };
    return buildRecurrentes(raw.recurringIncomes, raw.recurringExpenses, exchangeRate);
  }, [raw, exchangeRate]);

  const cajaInfo = useMemo(() => buildCajaInfo(registers, sessions, reconciliations), [registers, sessions, reconciliations]);

  const getTrendInfo = (curr: number, prev: number) => {
    if (!Number.isFinite(curr)) return { pct: null, diff: null, text: 'Sin base comparable' };
    if (!(prev > 0) && curr === 0) return { pct: null, diff: null, text: 'Sin base comparable' };
    if (!(prev > 0)) return { pct: null, diff: null, text: 'Sin base comparable' };
    const pct = ((curr - prev) / prev) * 100;
    return { pct, diff: curr - prev, text: `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct).toFixed(1)}% · ${pct >= 0 ? '+' : '-'}${formatConvertedAmount(Math.abs(curr - prev), 'NIO')} vs. ${prevLabel}` };
  };

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
    const label = STATUS_LABEL[s] || 'Registrado';
    const color = STATUS_COLOR[s] || 'bg-slate-400/10 text-slate-400';
    return <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap", color)}>{label}</span>;
  };

  const ingTrend = getTrendInfo(flow.ingresos, prevFlow.ingresos);
  const pagTrend = getTrendInfo(flow.pagos, prevFlow.pagos);
  const flujoTrend = getTrendInfo(flow.flujoNeto, prevFlow.flujoNeto);

  const chartData = useMemo(() => {
    if (serieMode === 'acumulado') {
      return serie.points.map(p => ({ label: p.label, ingresos: p.acumIngresos, pagos: p.acumPagos, flujo: p.acumFlujo, categorias: p.categorias, fecha: p.label }));
    }
    return serie.points.map(p => ({ label: p.label, ingresos: p.ingresos, pagos: p.pagos, flujo: p.flujo, categorias: p.categorias, fecha: p.label }));
  }, [serie, serieMode]);

  const forecastChart = useMemo(() => {
    const hist = history.map(h => ({ label: h.label, saldo: h.saldo, saldoProy: null, proyectado: false }));
    const proy = (forecast?.puntos || []).map(p => ({ label: p.label, saldo: null, saldoProy: p.saldo, proyectado: true }));
    return { data: [...hist, ...proy], confianza: forecast?.confianza || null, scheduled: forecast?.scheduled || 0 };
  }, [history, forecast]);

  const saldoFinalPeriodo = history.length > 0 ? history[history.length - 1].saldo : cashInfo.total;

  const orderedCxc = useMemo(() => {
    if (!raw) return [];
    return raw.salesInvoices.filter(i => isValidSalesInvoice(i.status) && !isCreditRecord(i) && saldoOf(i, exchangeRate) > 0)
      .sort((a, b) => (toDate(a.dueDate) || new Date(0)).getTime() - (toDate(b.dueDate) || new Date(0)).getTime());
  }, [raw, exchangeRate]);

  const orderedCxp = useMemo(() => {
    if (!raw) return [];
    return raw.purchaseBills.filter(b => isValidBill(b.status) && saldoOf(b, exchangeRate) > 0)
      .sort((a, b) => (toDate(a.dueDate) || new Date(0)).getTime() - (toDate(b.dueDate) || new Date(0)).getTime());
  }, [raw, exchangeRate]);

  const orderedCompromisos = useMemo(() => {
    if (!raw) return [];
    const nowMs = startOfDay(new Date()).getTime();
    const limit = nowMs + 30 * DAY_MS;
    const bills = raw.purchaseBills.filter(b => isValidBill(b.status) && saldoOf(b, exchangeRate) > 0).filter(b => {
      const due = toDate(b.dueDate);
      return !!due && due.getTime() >= nowMs && due.getTime() <= limit;
    }).map(b => ({ fecha: toDate(b.dueDate), monto: saldoOf(b, exchangeRate), detalle: `${b.number || ''} · ${b.supplier?.name || b.vendorName || 'Proveedor'}` }));
    const rec = raw.recurringExpenses.filter(r => {
      const s = String(r.status || '').toUpperCase();
      const nd = toDate(r.nextDate || r.nextExpenseDate);
      return (s === 'ACTIVE' || s === '') && !!nd && nd.getTime() >= nowMs && nd.getTime() <= limit;
    }).map(r => ({ fecha: toDate(r.nextDate || r.nextExpenseDate), monto: toNioAmt(r.amount, r.currency, r.exchangeRate, exchangeRate), detalle: `${r.description || 'Gasto recurrente'} (recurrente)` }));
    return [...bills, ...rec].sort((a, b) => ((a.fecha || new Date(0)) as Date).getTime() - ((b.fecha || new Date(0)) as Date).getTime());
  }, [raw, exchangeRate]);

  useImperativeHandle(ref, () => ({
    exportPDF: async () => {
      try {
        toast.info("Generando PDF financiero, por favor espere...");
        const pdfSettings = await getPdfDesignSettings('reportes.finance');
        const doc = new jsPDF(pdfDesignPaper(pdfSettings));
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const companyName = themeConfig.tenantName || user?.tenantName || 'Mi Empresa';
        const logoUrl = themeConfig.logo || '';
        const primaryColor = pdfSettings.primaryColor || themeConfig.colors.primary || '#10b981';
        const primaryHex = primaryColor.startsWith('#') ? primaryColor : '#10b981';
        const rgbPrimary = primaryHex.startsWith('#') 
          ? [parseInt(primaryHex.slice(1,3), 16), parseInt(primaryHex.slice(3,5), 16), parseInt(primaryHex.slice(5,7), 16)]
          : [16, 185, 129];
        const marginX = 14;
        const contentWidth = pageWidth - marginX * 2;
        let currentY = 15;

        const checkPage = (needed: number) => {
          if (currentY + needed > pageHeight - 15) { doc.addPage(); currentY = 20; }
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
        doc.text('Reporte Financiero de Negocio', pageWidth / 2, currentY, { align: 'center' });
        currentY += 6;

        const now = new Date();
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        const currencyLabel = displayCurrency === 'USD' ? 'Dólares (USD)' : 'Córdobas (NIO)';
        doc.text(`Generado: ${now.toLocaleDateString('es-NI')} ${now.toLocaleTimeString('es-NI')}  |  Moneda: ${currencyLabel}  |  Período: ${rangeLabel}`, pageWidth / 2, currentY, { align: 'center' });
        currentY += 5;

        doc.setDrawColor(rgbPrimary[0], rgbPrimary[1], rgbPrimary[2]);
        doc.setLineWidth(0.8);
        doc.line(marginX, currentY, pageWidth - marginX, currentY);
        currentY += 10;

        const kpis = [
          { label: 'INGRESOS COBRADOS', value: formatConvertedAmount(flow.ingresos, 'NIO'), detail: `${flow.ingresosMov} movimientos`, color: [16, 185, 129] },
          { label: 'PAGOS REALIZADOS', value: formatConvertedAmount(flow.pagos, 'NIO'), detail: `${flow.pagosMov} movimientos`, color: [244, 63, 94] },
          { label: 'FLUJO NETO DEL PERÍODO', value: formatConvertedAmount(flow.flujoNeto, 'NIO'), detail: flow.flujoNeto >= 0 ? 'Excedente' : 'Déficit', color: flow.flujoNeto >= 0 ? [16, 185, 129] : [244, 63, 94] },
          { label: 'SALDO DISPONIBLE', value: formatConvertedAmount(cashInfo.total, 'NIO'), detail: `${cajaInfo.bancosConciliados} bancos conciliados`, color: [59, 130, 246] },
          { label: 'COBERTURA DE PAGOS', value: cobertura === null ? 'N/D' : `${cobertura.toFixed(1)}%`, detail: cobertura === null ? 'Sin pagos en el período' : cobertura >= 100 ? 'Excedente' : 'Déficit', color: cobertura === null ? [148, 163, 184] : cobertura >= 100 ? [16, 185, 129] : [244, 63, 94] },
        ];

        const cols = 5;
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
          doc.setFontSize(10);
          doc.text(kpi.value, x + boxW / 2, currentY + 13, { align: 'center' });
          doc.setFontSize(6);
          doc.setFont('helvetica', 'normal');
          doc.text(kpi.detail, x + boxW / 2, currentY + 20, { align: 'center' });
        });
        currentY += boxH + 10;

        const exportIds = ['finance-monthly-chart', 'finance-trend-chart', 'finance-income-composition', 'finance-payment-composition', 'finance-position'];
        const capture = async (elementId: string, height: number) => {
          const el = document.getElementById(elementId);
          if (!el) return;
          checkPage(height + 15);
          try {
            const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', onclone: (clonedDoc) => sanitizeHtml2CanvasOklch(exportIds, clonedDoc, primaryHex) });
            doc.addImage(canvas.toDataURL('image/png'), 'PNG', marginX, currentY, contentWidth, height, undefined, 'FAST');
            currentY += height + 5;
          } catch { /* intentionally empty */ }
        };

        await capture('finance-monthly-chart', 80);
        await capture('finance-trend-chart', 75);
        await capture('finance-income-composition', 70);
        await capture('finance-payment-composition', 70);
        await capture('finance-position', 70);

        const renderTable = (title: string, header: string[], rows: (string | number)[][], color: number[]) => {
          checkPage(rows.length * 6 + 30);
          doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 60);
          doc.text(title, marginX, currentY); currentY += 7;
          doc.setFillColor(color[0], color[1], color[2]);
          doc.roundedRect(marginX, currentY, contentWidth, 8, 1, 1, 'F');
          doc.setFontSize(8); doc.setTextColor(255, 255, 255);
          header.forEach((h, i) => doc.text(h, marginX + 3 + i * (contentWidth / header.length), currentY + 5.5));
          currentY += 10;
          rows.forEach((r, i) => {
            checkPage(8);
            if (i % 2 === 0) { doc.setFillColor(248, 249, 250); doc.rect(marginX, currentY - 1, contentWidth, 7, 'F'); }
            doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
            r.forEach((cell, ci) => doc.text(String(cell).substring(0, 28), marginX + 3 + ci * (contentWidth / header.length), currentY + 4));
            currentY += 7;
          });
          currentY += 8;
        };

        const fmt = (v: number) => formatConvertedAmount(Number(v || 0), 'NIO');
        renderTable('Rentabilidad (Estado de Resultados)', ['Concepto', 'Período actual', 'Período anterior'], profitability.rows.map(r => [r.label, fmt(r.monto ?? 0), r.prev === null ? 'N/D' : fmt(r.prev)]), [59, 130, 246]);
        renderTable('Ingresos por Origen', ['Origen', 'Monto', 'Participación'], ingComposition.rows.slice(0, 8).map(r => [r.nombre, fmt(r.monto), `${r.pct.toFixed(1)}%`]), [16, 185, 129]);
        renderTable('Pagos por Categoría', ['Categoría', 'Monto', 'Participación'], pagComposition.rows.slice(0, 8).map(r => [r.nombre, fmt(r.monto), `${r.pct.toFixed(1)}%`]), [244, 63, 94]);
        renderTable('Antigüedad de Cuentas por Pagar', ['Rango', 'Monto', 'Facturas'], cxpAging.buckets.map(b => [b.label, fmt(b.monto), String(b.facturas)]), [249, 115, 22]);

        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(7);
          doc.setTextColor(150);
          doc.text(`${companyName} - Reporte Financiero - Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
        }

        doc.save(`Reporte_Finanzas_${now.toISOString().split('T')[0]}.pdf`);
        toast.success("PDF generado exitosamente");
      } catch (e: any) {
        console.error(e);
        toast.error(e?.response?.data?.message || e?.message || "Error al generar PDF");
      }
    },
    exportExcel: async () => {
      try {
        toast.info("Generando Excel financiero...");
        const wb = new ExcelJS.Workbook();
        const companyName = themeConfig.tenantName || user?.tenantName || 'Mi Empresa';
        const logoUrl = themeConfig.logo || '';
        const primaryColor = themeConfig.colors.primary || '#3b82f6';
        const hexColor = primaryColor.startsWith('#') ? primaryColor.replace('#', '') : '3b82f6';
        const primaryHex = primaryColor.startsWith('#') ? primaryColor : '#3b82f6';
        const currencyLabel = displayCurrency === 'USD' ? 'Dólares (USD)' : 'Córdobas (NIO)';
        const thinBorder = { style: 'thin' as const, color: { argb: 'FFE5E7EB' } };
        const fmt = (v: number) => formatConvertedAmount(Number(v || 0), 'NIO');

        const ws = wb.addWorksheet('Reporte Financiero');
        ws.getColumn(1).width = 30;
        ws.getColumn(2).width = 22;
        ws.getColumn(3).width = 22;
        ws.getColumn(4).width = 22;
        ws.getColumn(5).width = 22;

        let currentRow = 1;
        if (logoUrl) {
          const base64Logo = await getBase64Image(logoUrl);
          if (base64Logo) {
            const logoId = wb.addImage({ base64: base64Logo, extension: 'png' });
            ws.addImage(logoId, { tl: { col: 1.5, row: 0 }, ext: { width: 100, height: 100 } });
            currentRow = 6;
          }
        }

        ws.mergeCells(`A${currentRow}:E${currentRow}`);
        const cellName = ws.getCell(`A${currentRow}`);
        cellName.value = companyName;
        cellName.font = { size: 18, bold: true, color: { argb: `FF${hexColor}` } };
        cellName.alignment = { horizontal: 'center' };
        currentRow++;

        ws.mergeCells(`A${currentRow}:E${currentRow}`);
        const cellTitle = ws.getCell(`A${currentRow}`);
        cellTitle.value = 'Reporte Financiero de Negocio';
        cellTitle.font = { size: 13, bold: true };
        cellTitle.alignment = { horizontal: 'center' };
        currentRow++;

        ws.mergeCells(`A${currentRow}:E${currentRow}`);
        const cellMeta = ws.getCell(`A${currentRow}`);
        cellMeta.value = `Moneda: ${currencyLabel} (${currencySymbol})  |  Período: ${rangeLabel}  |  ${new Date().toLocaleDateString('es-NI')}`;
        cellMeta.font = { size: 10, italic: true, color: { argb: 'FF888888' } };
        cellMeta.alignment = { horizontal: 'center' };
        currentRow += 2;

        const kpiBoxes = [
          { label: 'INGRESOS COBRADOS', value: fmt(flow.ingresos), detail: `${flow.ingresosMov} movimientos`, bgColor: 'FF10B981' },
          { label: 'PAGOS REALIZADOS', value: fmt(flow.pagos), detail: `${flow.pagosMov} movimientos`, bgColor: 'FFF43F5E' },
          { label: 'FLUJO NETO', value: fmt(flow.flujoNeto), detail: flow.flujoNeto >= 0 ? 'Excedente' : 'Déficit', bgColor: flow.flujoNeto >= 0 ? 'FF10B981' : 'FFF43F5E' },
          { label: 'SALDO DISPONIBLE', value: fmt(cashInfo.total), detail: `${cajaInfo.bancosConciliados} bancos conciliados`, bgColor: 'FF3B82F6' },
          { label: 'COBERTURA DE PAGOS', value: cobertura === null ? 'N/D' : `${cobertura.toFixed(1)}%`, detail: cobertura === null ? 'Sin pagos' : cobertura >= 100 ? 'Excedente' : 'Déficit', bgColor: cobertura === null ? 'FF94A3B8' : cobertura >= 100 ? 'FF10B981' : 'FFF43F5E' },
        ];

        ws.getRow(currentRow).height = 18;
        kpiBoxes.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.label;
          cell.font = { size: 7, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        currentRow++;
        ws.getRow(currentRow).height = 28;
        kpiBoxes.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.value;
          cell.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        currentRow++;
        ws.getRow(currentRow).height = 16;
        kpiBoxes.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.detail;
          cell.font = { size: 7, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        currentRow += 2;

        const exportIds = ['finance-monthly-chart', 'finance-trend-chart', 'finance-income-composition', 'finance-payment-composition', 'finance-position'];
        const captureForExcel = async (elementId: string, targetRow: number) => {
          const el = document.getElementById(elementId);
          if (!el) return targetRow;
          try {
            const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', onclone: (clonedDoc) => sanitizeHtml2CanvasOklch(exportIds, clonedDoc, primaryHex) });
            const imgId = wb.addImage({ base64: canvas.toDataURL('image/png'), extension: 'png' });
            ws.addImage(imgId, { tl: { col: 0, row: targetRow }, ext: { width: 720, height: 260 } });
            return targetRow + 18;
          } catch { return targetRow; }
        };

        let imgRow = currentRow + 2;
        imgRow = await captureForExcel('finance-monthly-chart', imgRow);
        imgRow = await captureForExcel('finance-trend-chart', imgRow);
        imgRow = await captureForExcel('finance-income-composition', imgRow);
        imgRow = await captureForExcel('finance-payment-composition', imgRow);
        imgRow = await captureForExcel('finance-position', imgRow);

        while (ws.rowCount < imgRow) ws.addRow([]);
        currentRow = ws.rowCount + 2;

        const renderTable = (title: string, header: string[], rows: (string | number)[][], color: string) => {
          const titleRow = ws.addRow([title, '', '', '', '']);
          ws.mergeCells(`A${ws.rowCount}:E${ws.rowCount}`);
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
              if (idx % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            });
          });
          ws.addRow([]);
        };

        renderTable('Rentabilidad (Estado de Resultados)', ['Concepto', 'Período actual', 'Período anterior', '', ''], profitability.rows.map(r => [r.label, fmt(r.monto ?? 0), r.prev === null ? 'N/D' : fmt(r.prev), '', '']), 'FF3B82F6');
        renderTable('Ingresos por Origen', ['Origen', 'Monto', 'Participación', '', ''], ingComposition.rows.slice(0, 8).map(r => [r.nombre, fmt(r.monto), `${r.pct.toFixed(1)}%`, '', '']), 'FF10B981');
        renderTable('Pagos por Categoría', ['Categoría', 'Monto', 'Participación', '', ''], pagComposition.rows.slice(0, 8).map(r => [r.nombre, fmt(r.monto), `${r.pct.toFixed(1)}%`, '', '']), 'FFF43F5E');
        renderTable('Antigüedad de Cuentas por Pagar', ['Rango', 'Monto', 'Facturas', '', ''], cxpAging.buckets.map(b => [b.label, fmt(b.monto), String(b.facturas), '', '']), 'FFF59E0B');

        await downloadExcelWorkbook(wb, `Reporte_Finanzas_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success("Excel generado exitosamente");
      } catch (e: any) {
        console.error(e);
        toast.error(e?.response?.data?.message || e?.message || "Error al generar Excel");
      }
    }
  }));

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Activity className="size-12 animate-pulse text-primary opacity-50" />
        <p className="font-black uppercase tracking-widest text-[10px]">Analizando Inteligencia Financiera...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <p className="text-[10px] text-muted-foreground font-semibold">
          Período analizado: <span className="text-foreground font-black uppercase">{rangeLabel}</span>
          {periodoCerrado && (
            <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-500">Período contable cerrado</span>
          )}
        </p>
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

      {/* ═══ KPI Cards (5) ═══ */}
      <div id="finance-report-kpis" className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Ingresos Cobrados */}
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all cursor-pointer" onClick={() => setModal({ type: 'ingresos' })}>
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <ArrowUpRight className="size-3.5 text-emerald-500" /> Ingresos Cobrados
              <span className="ml-auto">{trendBadge(ingTrend)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-emerald-500">{formatConvertedAmount(flow.ingresos, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{flow.ingresosMov} movimientos · {ingTrend.text}</p>
            <p className="text-[9px] text-muted-foreground/60 mt-1 flex items-center gap-1" title="Cobros de clientes, otros ingresos cobrados e ingresos recurrentes ejecutados. Excluye facturas pendientes, transferencias internas y anulados.">
              <Info className="size-3 shrink-0" /> Dinero realmente cobrado
            </p>
          </CardContent>
        </Card>

        {/* Pagos Realizados */}
        <Card className="border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all cursor-pointer" onClick={() => setModal({ type: 'pagos' })}>
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingDown className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <ArrowDownRight className="size-3.5 text-rose-500" /> Pagos Realizados
              <span className="ml-auto">{trendBadge(pagTrend)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-rose-500">{formatConvertedAmount(flow.pagos, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{flow.pagosMov} movimientos · {pagTrend.text}</p>
            <p className="text-[9px] text-muted-foreground/60 mt-1 flex items-center gap-1" title="Proveedores, nómina pagada, gastos pagados, impuestos y otros egresos. El gasto contabilizado no se reconoce dos veces; solo sale dinero de caja.">
              <Info className="size-3 shrink-0" /> Dinero realmente pagado
            </p>
          </CardContent>
        </Card>

        {/* Flujo Neto */}
        <Card className={cn("bg-gradient-to-br to-transparent relative overflow-hidden group hover:shadow-lg transition-all", flow.flujoNeto >= 0 ? "border-emerald-500/20 from-emerald-500/5" : "border-rose-500/20 from-rose-500/5")}>
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Scale className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Scale className={cn("size-3.5", flow.flujoNeto >= 0 ? "text-emerald-500" : "text-rose-500")} /> Flujo Neto del Período
              <span className="ml-auto">{trendBadge(flujoTrend)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-xl font-black", flow.flujoNeto >= 0 ? "text-emerald-500" : "text-rose-500")}>{formatConvertedAmount(flow.flujoNeto, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{flow.flujoNeto >= 0 ? 'Excedente del período' : 'Déficit del período'} · {flujoTrend.text}</p>
            <p className="text-[9px] text-muted-foreground/60 mt-1 flex items-center gap-1" title="Ingresos cobrados − pagos realizados. No es utilidad neta: la utilidad proviene del Estado de Resultados contable.">
              <Info className="size-3 shrink-0" /> Cobrado − Pagado
            </p>
          </CardContent>
        </Card>

        {/* Saldo Disponible */}
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all cursor-pointer" onClick={() => setModal({ type: 'caja' })}>
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Wallet className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Wallet className="size-3.5 text-blue-500" /> Saldo Disponible
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-blue-500">{formatConvertedAmount(cashInfo.total, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Caja: <span className="font-black text-blue-500">{formatConvertedAmount(cashInfo.caja, 'NIO')}</span> · Bancos: <span className="font-black text-blue-500">{formatConvertedAmount(cashInfo.bancos, 'NIO')}</span>
              {cajaInfo.cajasAbiertas.length > 0 && <span className="text-amber-500 font-bold"> · {cajaInfo.cajasAbiertas.length} caja(s) abierta(s)</span>}
            </p>
            <p className="text-[9px] text-muted-foreground/60 mt-1 flex items-center gap-1" title={`Conciliado: ${formatConvertedAmount(cajaInfo.montoConciliado, 'NIO')} · Conciliaciones pendientes: ${cajaInfo.pendientesConciliacion} · Efectivo contado C$0 significa que no hay arqueos registrados, no que la caja esté vacía.`}>
              <Info className="size-3 shrink-0" /> Saldos contables de caja y bancos
            </p>
          </CardContent>
        </Card>

        {/* Cobertura de Pagos */}
        <Card className={cn("bg-gradient-to-br to-transparent relative overflow-hidden group hover:shadow-lg transition-all", cobertura === null ? "border-slate-500/20 from-slate-500/5" : cobertura >= 100 ? "border-emerald-500/20 from-emerald-500/5" : "border-rose-500/20 from-rose-500/5")}>
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Percent className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Percent className={cn("size-3.5", cobertura === null ? "text-slate-400" : cobertura >= 100 ? "text-emerald-500" : "text-rose-500")} /> Cobertura de Pagos del Período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-xl font-black", cobertura === null ? "text-slate-400" : cobertura >= 100 ? "text-emerald-500" : "text-rose-500")}>
              {cobertura === null ? 'N/D' : `${cobertura.toFixed(1)}%`}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {cobertura === null ? 'Sin pagos en el período' : cobertura > 100 ? 'Excedente' : cobertura === 100 ? 'Cobertura total' : 'Déficit: los pagos superan los cobros'}
            </p>
            <p className="text-[9px] text-muted-foreground/60 mt-1 flex items-center gap-1" title="Ingresos cobrados ÷ pagos realizados × 100. Puede superar el 100%; no se limita.">
              <Info className="size-3 shrink-0" /> Cobrado ÷ Pagado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Posición Financiera ═══ */}
      <div id="finance-position" className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <button onClick={() => setModal({ type: 'cxc' })} className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 transition-all text-left">
          <p className="text-[9px] font-bold text-muted-foreground uppercase">Cuentas por Cobrar</p>
          <p className="text-base font-black text-blue-500">{formatConvertedAmount(position.cxc.total, 'NIO')}</p>
          <p className="text-[9px] text-muted-foreground">{position.cxc.facturas} facturas{position.cxc.vencido > 0 && <span className="text-rose-500 font-bold"> · {formatConvertedAmount(position.cxc.vencido, 'NIO')} vencido</span>}</p>
        </button>
        <button onClick={() => setModal({ type: 'cxp' })} className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/10 hover:bg-orange-500/10 transition-all text-left">
          <p className="text-[9px] font-bold text-muted-foreground uppercase">Cuentas por Pagar</p>
          <p className="text-base font-black text-orange-500">{formatConvertedAmount(position.cxp.total, 'NIO')}</p>
          <p className="text-[9px] text-muted-foreground">{position.cxp.facturas} facturas{position.cxp.vencido > 0 && <span className="text-rose-500 font-bold"> · {formatConvertedAmount(position.cxp.vencido, 'NIO')} vencido</span>}</p>
        </button>
        <button onClick={() => setModal({ type: 'liquidez' })} className={cn("p-3 rounded-xl hover:bg-blue-500/10 transition-all text-left border", liquidez.capitalTrabajo >= 0 ? "bg-blue-500/5 border-blue-500/10" : "bg-rose-500/5 border-rose-500/10")} title="Efectivo + CxC − CxP (versión operativa, sin clasificación corriente completa en el plan de cuentas).">
          <p className="text-[9px] font-bold text-muted-foreground uppercase">Capital de Trabajo</p>
          <p className={cn("text-base font-black", liquidez.capitalTrabajo >= 0 ? "text-blue-500" : "text-rose-500")}>{formatConvertedAmount(liquidez.capitalTrabajo, 'NIO')}</p>
          <p className="text-[9px] text-muted-foreground">Versión operativa</p>
        </button>
        <button onClick={() => setModal({ type: 'liquidez' })} className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 transition-all text-left" title={liquidez.razonCorriente === null ? 'N/D: no existen pasivos corrientes' : 'Activo corriente ÷ pasivo corriente (versión operativa).'}>
          <p className="text-[9px] font-bold text-muted-foreground uppercase">Liquidez Corriente</p>
          <p className="text-base font-black text-blue-500">{liquidez.razonCorriente === null ? 'N/D' : `${liquidez.razonCorriente.toFixed(2)}x`}</p>
          <p className="text-[9px] text-muted-foreground">{liquidez.razonCorriente === null ? 'No existen pasivos corrientes' : 'Activo corriente ÷ pasivo corriente'}</p>
        </button>
        <button onClick={() => setModal({ type: 'compromisos' })} className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/10 hover:bg-orange-500/10 transition-all text-left">
          <p className="text-[9px] font-bold text-muted-foreground uppercase">Compromisos Próximos</p>
          <p className="text-base font-black text-orange-500">{formatConvertedAmount(position.compromisos.d30.monto, 'NIO')}</p>
          <p className="text-[9px] text-muted-foreground">7d: {formatConvertedAmount(position.compromisos.d7.monto, 'NIO')} · 15d: {formatConvertedAmount(position.compromisos.d15.monto, 'NIO')} · 30d: {position.compromisos.d30.count} documento(s)</p>
        </button>
      </div>

      {cxcVencidoPct !== null && cxcVencidoPct > 50 && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-rose-500/5 border border-rose-500/10">
          <p className="text-[11px] text-rose-500 font-black flex items-center gap-1.5">
            <AlertTriangle className="size-4 shrink-0" />
            {cxcVencidoPct.toFixed(1)}% de la cartera por cobrar está vencida ({formatConvertedAmount(position.cxc.vencido, 'NIO')} de {formatConvertedAmount(position.cxc.total, 'NIO')})
          </p>
          <button onClick={() => setModal({ type: 'cxc' })} className="text-[10px] font-black uppercase tracking-wider text-rose-500 hover:text-rose-400 flex items-center gap-1 shrink-0">
            Ver antigüedad de CxC <ArrowUpRight className="size-3" />
          </button>
        </div>
      )}

      {/* ═══ Cobros, Pagos y Flujo Neto + Acumulado/Proyección ═══ */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card id="finance-monthly-chart" className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2">
              <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <BarChart3 className="size-4 text-primary" /> Cobros, Pagos y Flujo Neto
              </CardTitle>
              <div className="flex flex-wrap items-center gap-1 bg-muted/30 p-0.5 rounded-lg w-fit">
                <button onClick={() => setSerieMode('intervalo')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${serieMode === 'intervalo' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Movimiento del intervalo</button>
                <button onClick={() => setSerieMode('acumulado')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${serieMode === 'acumulado' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Acumulado</button>
                <button onClick={() => setFlujoMode(flujoMode === 'cobros' ? 'flujo' : 'cobros')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${flujoMode === 'flujo' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Solo flujo neto</button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="h-[230px] w-full flex flex-col items-center justify-center gap-2 text-center">
                <BarChart3 className="size-8 text-muted-foreground/30" />
                <p className="text-sm font-bold text-muted-foreground">Sin cobros ni pagos registrados en el período</p>
              </div>
            ) : (
              <div className="h-[230px] w-full pt-3">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 16, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtShort(v)} domain={[0, 'auto']} />
                    <Tooltip
                      contentStyle={DARK_TOOLTIP}
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      formatter={(v: any, name: string, item: any) => {
                        if (v === null || v === undefined) return ['—', name];
                        if (name === 'Flujo neto') return [formatConvertedAmount(Number(v), 'NIO'), name];
                        const cats = (item?.payload?.categorias || []).slice(0, 3);
                        const detalle = cats.length > 0 ? ` · ${cats.map((c: any) => `${c.nombre} (${formatConvertedAmount(c.monto, 'NIO')})`).join(', ')}` : '';
                        return [`${formatConvertedAmount(Number(v), 'NIO')}${detalle}`, name];
                      }}
                      labelFormatter={() => `Período: ${rangeLabel}`}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700, color: 'hsl(var(--foreground))' }} />
                    {flujoMode === 'cobros' && <Bar dataKey="ingresos" name="Ingresos cobrados" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} />}
                    {flujoMode === 'cobros' && <Bar dataKey="pagos" name="Pagos realizados" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={24} />}
                    <Line type="monotone" dataKey="flujo" name="Flujo neto" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
            {extraordinario && (
              <p className="mt-1 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-500 font-bold flex items-center gap-1.5" title={extraordinario.categorias.map(c => `${c.nombre}: ${formatConvertedAmount(c.monto, 'NIO')}`).join('\n')}>
                <AlertTriangle className="size-3.5 shrink-0" />
                Movimiento extraordinario {extraordinario.label}: {extraordinario.flujo >= 0 ? '+' : '-'}{formatConvertedAmount(Math.abs(extraordinario.flujo), 'NIO')}
                {extraordinario.categorias.length > 0 && ` · causas principales: ${extraordinario.categorias.slice(0, 2).map(c => c.nombre).join(', ')} (detalle en tooltip)`}
              </p>
            )}
            <p className="text-[9px] text-muted-foreground/60 mt-1">El flujo neto es la diferencia entre dinero realmente cobrado y pagado; no equivale a la utilidad contable.</p>
          </CardContent>
        </Card>

        <Card id="finance-trend-chart" className="border-border/50">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2">
              <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <Activity className="size-4 text-primary" /> Flujo de Caja Acumulado y Proyectado
              </CardTitle>
              <div className="flex items-center gap-1 bg-muted/30 p-0.5 rounded-lg w-fit">
                <button onClick={() => setCashTab('historico')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${cashTab === 'historico' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Histórico</button>
                <button onClick={() => setCashTab('proyeccion')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${cashTab === 'proyeccion' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Proyección 30/60/90</button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {cashTab === 'historico' && (
              <>
                <div className="h-[160px] w-full pt-2">
                  {history.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
                      <Activity className="size-8 text-muted-foreground/30" />
                      <p className="text-sm font-bold text-muted-foreground">Sin movimientos en el período</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={history.map(h => ({ ...h, saldo: Math.round(h.saldo * 100) / 100 }))} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => fmtShort(v)} domain={['auto', 'auto']} />
                        <Tooltip contentStyle={DARK_TOOLTIP} formatter={(v: any) => [formatConvertedAmount(Number(v), 'NIO'), 'Saldo de caja']} labelFormatter={() => `Período: ${rangeLabel}`} />
                        <Area type="monotone" dataKey="saldo" stroke="#3b82f6" strokeWidth={2.5} fill="url(#cashGrad)" dot={{ r: 3, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  <div className="p-2 rounded-lg bg-muted/30 text-center">
                    <p className="text-[8px] font-bold text-muted-foreground uppercase">Saldo inicial</p>
                    <p className="text-xs font-black text-blue-500">{formatConvertedAmount(saldoInicial, 'NIO')}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30 text-center">
                    <p className="text-[8px] font-bold text-muted-foreground uppercase">Entradas</p>
                    <p className="text-xs font-black text-emerald-500">{formatConvertedAmount(flow.ingresos, 'NIO')}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30 text-center">
                    <p className="text-[8px] font-bold text-muted-foreground uppercase">Salidas</p>
                    <p className="text-xs font-black text-rose-500">{formatConvertedAmount(flow.pagos, 'NIO')}</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30 text-center">
                    <p className="text-[8px] font-bold text-muted-foreground uppercase">Saldo final</p>
                    <p className="text-xs font-black text-blue-500">{formatConvertedAmount(saldoFinalPeriodo, 'NIO')}</p>
                  </div>
                </div>
                <p className="text-[9px] text-muted-foreground/60 mt-1">Saldo inicial real de caja y bancos (contabilidad) + cobros − pagos del período.</p>
              </>
            )}
            {cashTab === 'proyeccion' && (
              <>
                {!forecast || forecast.scheduled === 0 ? (
                  <div className="h-[220px] w-full flex flex-col items-center justify-center gap-2 text-center">
                    <CalendarDays className="size-8 text-muted-foreground/30" />
                    <p className="text-sm font-bold text-muted-foreground">No existen vencimientos suficientes para proyectar</p>
                    <p className="text-[10px] text-muted-foreground">Registre fechas de vencimiento en facturas y recurrentes para proyectar el flujo.</p>
                  </div>
                ) : (
                  <>
                    <div className="h-[150px] w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={forecastChart.data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 9 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => fmtShort(v)} domain={['auto', 'auto']} />
                          <Tooltip contentStyle={DARK_TOOLTIP} formatter={(v: any, name: string) => [formatConvertedAmount(Number(v), 'NIO'), name === 'Saldo proyectado' ? 'Saldo proyectado' : 'Saldo de caja']} labelFormatter={(l: any) => `${l} · proyección 30/60/90`} />
                          <Line type="monotone" dataKey="saldo" name="Saldo histórico" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} connectNulls={false} />
                          <Line type="monotone" dataKey="saldoProy" name="Saldo proyectado" stroke="#f97316" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3, fill: '#f97316' }} connectNulls={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div className="p-2 rounded-lg bg-muted/30 text-center">
                        <p className="text-[8px] font-bold text-muted-foreground uppercase">Entradas esperadas 90d</p>
                        <p className="text-xs font-black text-emerald-500">{formatConvertedAmount(forecast.totalEntradas, 'NIO')}</p>
                        <p className="text-[8px] text-muted-foreground">{forecast.entradas.length} vencimientos</p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/30 text-center">
                        <p className="text-[8px] font-bold text-muted-foreground uppercase">Salidas esperadas 90d</p>
                        <p className="text-xs font-black text-rose-500">{formatConvertedAmount(forecast.totalSalidas, 'NIO')}</p>
                        <p className="text-[8px] text-muted-foreground">{forecast.salidas.length} vencimientos</p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/30 text-center">
                        <p className="text-[8px] font-bold text-muted-foreground uppercase">Saldo final proyectado</p>
                        <p className={cn("text-xs font-black", forecast.saldoFinal >= 0 ? "text-blue-500" : "text-rose-500")}>{formatConvertedAmount(forecast.saldoFinal, 'NIO')}</p>
                        <p className="text-[8px] text-muted-foreground">Confiabilidad: {forecast.confianza}</p>
                      </div>
                    </div>
                    {forecast.primerDeficit && (
                      <p className="mt-2 p-2 rounded-lg bg-rose-500/5 border border-rose-500/10 text-[10px] text-rose-500 font-bold flex items-center gap-1.5">
                        <AlertTriangle className="size-3.5 shrink-0" /> Primer día de déficit: {forecast.primerDeficit.toLocaleDateString('es-NI')} · Déficit máximo: {formatConvertedAmount(forecast.deficitMaximo ?? 0, 'NIO')} · Saldo mínimo: {formatConvertedAmount(forecast.saldoMinimo, 'NIO')}
                      </p>
                    )}
                    <p className="text-[9px] text-muted-foreground/60 mt-1">Proyección basada en vencimientos de CxC, CxP y recurrentes activos. La línea punteada es estimada.</p>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Composición de Ingresos + Composición de Pagos ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="finance-income-composition" className="border-emerald-500/20 min-w-0">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2">
              <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <PieChartIcon className="size-4 text-emerald-500" /> Composición de Ingresos
              </CardTitle>
              <div className="flex items-center gap-1 bg-muted/30 p-0.5 rounded-lg w-fit">
                <button onClick={() => setIngTab('origen')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${ingTab === 'origen' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Por origen</button>
                <button onClick={() => setIngTab('aging')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${ingTab === 'aging' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Antigüedad de CxC</button>
                <button onClick={() => setIngTab('movimientos')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${ingTab === 'movimientos' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Movimientos</button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {ingTab === 'origen' && (
              ingComposition.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin ingresos cobrados en el período</p>
              ) : (
                <div className="space-y-1.5">
                  {ingComposition.rows.slice(0, 7).map(r => (
                    <div key={r.nombre} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate">{r.nombre}</p>
                        <p className="text-[9px] text-muted-foreground">{r.movimientos} movimiento(s) · {r.variacion === null ? 'sin base previa' : `variación ${r.variacion >= 0 ? '+' : ''}${r.variacion.toFixed(1)}%`}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-emerald-500">{formatConvertedAmount(r.monto, 'NIO')}</p>
                        <p className="text-[9px] text-muted-foreground">{r.pct.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setModal({ type: 'ingresos' })} className="w-full text-center py-2 text-[10px] font-black uppercase tracking-wider text-emerald-400 hover:text-emerald-300 flex items-center justify-center gap-1">
                    Ver movimientos completos <ArrowUpRight className="size-3" />
                  </button>
                </div>
              )
            )}
            {ingTab === 'aging' && (
              <>
                <div className="h-[180px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cxcAging.buckets} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.06)" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => fmtShort(v)} />
                      <YAxis type="category" dataKey="label" width={88} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 9, fontWeight: 600 }} />
                      <Tooltip contentStyle={DARK_TOOLTIP} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v: any) => [formatConvertedAmount(Number(v), 'NIO'), 'Saldo pendiente']} />
                      <Bar dataKey="monto" name="Saldo pendiente" radius={[0, 4, 4, 0]} maxBarSize={16}>
                        {cxcAging.buckets.map((_, i) => <Cell key={i} fill={i === 0 ? '#3b82f6' : '#f43f5e'} />)}
                        <LabelList dataKey="pct" position="right" formatter={(v: any) => Number(v) > 0 ? `${Number(v).toFixed(0)}%` : ''} style={{ fontSize: 9, fill: '#f43f5e', fontWeight: 700 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-0.5">
                  {cxcAging.buckets.map(b => (
                    <div key={b.label} className="flex items-center justify-between gap-2 text-[9px]">
                      <span className="font-bold text-muted-foreground uppercase">{b.label}</span>
                      <span className="text-muted-foreground">{b.facturas} factura(s)</span>
                      <span className="font-black text-blue-500">{formatConvertedAmount(b.monto, 'NIO')}</span>
                    </div>
                  ))}
                  <button onClick={() => setModal({ type: 'cxc' })} className="w-full text-center py-1.5 text-[9px] font-black uppercase tracking-wider text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1">
                    Abrir facturas por cobrar <ArrowUpRight className="size-3" />
                  </button>
                </div>
              </>
            )}
            {ingTab === 'movimientos' && (
              ingComposition.movimientos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin movimientos de ingreso en el período</p>
              ) : (
                <div className="space-y-1.5">
                  {ingComposition.movimientos.slice(0, 6).map((m, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30">
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{m.concepto}</p>
                        <p className="text-[9px] text-muted-foreground truncate">{(m.fecha || new Date()).toLocaleDateString('es-NI')} · {m.origen} · {m.documento}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {statusBadge(m.estado)}
                        <p className="text-xs font-black text-emerald-500">+{formatConvertedAmount(m.monto, 'NIO')}</p>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setModal({ type: 'ingresos' })} className="w-full text-center py-2 text-[10px] font-black uppercase tracking-wider text-emerald-400 hover:text-emerald-300 flex items-center justify-center gap-1">
                    Ver todos los movimientos <ArrowUpRight className="size-3" />
                  </button>
                </div>
              )
            )}
          </CardContent>
        </Card>

        <Card id="finance-payment-composition" className="border-rose-500/20 min-w-0">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-2">
              <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <Layers className="size-4 text-rose-500" /> Composición de Pagos
              </CardTitle>
              <div className="flex items-center gap-1 bg-muted/30 p-0.5 rounded-lg w-fit">
                <button onClick={() => setPagTab('categoria')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${pagTab === 'categoria' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Por categoría</button>
                <button onClick={() => setPagTab('aging')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${pagTab === 'aging' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Antigüedad de CxP</button>
                <button onClick={() => setPagTab('movimientos')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${pagTab === 'movimientos' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Movimientos</button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {pagTab === 'categoria' && (
              pagComposition.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin pagos realizados en el período</p>
              ) : (
                <div className="space-y-1.5">
                  {pagComposition.rows.slice(0, 7).map(r => (
                    <div key={r.nombre} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate">{r.nombre}</p>
                        <p className="text-[9px] text-muted-foreground">{r.movimientos} movimiento(s) · {r.variacion === null ? 'sin base previa' : `variación ${r.variacion >= 0 ? '+' : ''}${r.variacion.toFixed(1)}%`}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-rose-500">{formatConvertedAmount(r.monto, 'NIO')}</p>
                        <p className="text-[9px] text-muted-foreground">{r.pct.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setModal({ type: 'pagos' })} className="w-full text-center py-2 text-[10px] font-black uppercase tracking-wider text-rose-400 hover:text-rose-300 flex items-center justify-center gap-1">
                    Ver movimientos completos <ArrowUpRight className="size-3" />
                  </button>
                </div>
              )
            )}
            {pagTab === 'aging' && (
              <>
                <div className="h-[180px] w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cxpAging.buckets} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.06)" />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10 }} tickFormatter={(v) => fmtShort(v)} />
                      <YAxis type="category" dataKey="label" width={88} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 9, fontWeight: 600 }} />
                      <Tooltip contentStyle={DARK_TOOLTIP} cursor={{ fill: 'rgba(255,255,255,0.04)' }} formatter={(v: any) => [formatConvertedAmount(Number(v), 'NIO'), 'Saldo pendiente']} />
                      <Bar dataKey="monto" name="Saldo pendiente" radius={[0, 4, 4, 0]} maxBarSize={16}>
                        {cxpAging.buckets.map((_, i) => <Cell key={i} fill={i === 0 ? '#f97316' : '#f43f5e'} />)}
                        <LabelList dataKey="pct" position="right" formatter={(v: any) => Number(v) > 0 ? `${Number(v).toFixed(0)}%` : ''} style={{ fontSize: 9, fill: '#f43f5e', fontWeight: 700 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-0.5">
                  {cxpAging.buckets.map(b => (
                    <div key={b.label} className="flex items-center justify-between gap-2 text-[9px]">
                      <span className="font-bold text-muted-foreground uppercase">{b.label}</span>
                      <span className="text-muted-foreground">{b.facturas} factura(s)</span>
                      <span className="font-black text-orange-500">{formatConvertedAmount(b.monto, 'NIO')}</span>
                    </div>
                  ))}
                  <button onClick={() => setModal({ type: 'cxp' })} className="w-full text-center py-1.5 text-[9px] font-black uppercase tracking-wider text-orange-400 hover:text-orange-300 flex items-center justify-center gap-1">
                    Abrir facturas por pagar <ArrowUpRight className="size-3" />
                  </button>
                </div>
              </>
            )}
            {pagTab === 'movimientos' && (
              pagComposition.movimientos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin movimientos de pago en el período</p>
              ) : (
                <div className="space-y-1.5">
                  {pagComposition.movimientos.slice(0, 6).map((m, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30">
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{m.concepto}</p>
                        <p className="text-[9px] text-muted-foreground truncate">{(m.fecha || new Date()).toLocaleDateString('es-NI')} · {m.origen} · {m.documento}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {statusBadge(m.estado)}
                        <p className="text-xs font-black text-rose-500">-{formatConvertedAmount(m.monto, 'NIO')}</p>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setModal({ type: 'pagos' })} className="w-full text-center py-2 text-[10px] font-black uppercase tracking-wider text-rose-400 hover:text-rose-300 flex items-center justify-center gap-1">
                    Ver todos los movimientos <ArrowUpRight className="size-3" />
                  </button>
                </div>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Rentabilidad + Liquidez ═══ */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <FileText className="size-4 text-primary" /> Rentabilidad, Equilibrio e Indicadores
            </CardTitle>
            <div className="flex flex-wrap items-center gap-1 bg-muted/30 p-0.5 rounded-lg w-fit">
              <button onClick={() => setPnlTab('rentabilidad')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${pnlTab === 'rentabilidad' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Rentabilidad</button>
              <button onClick={() => setPnlTab('equilibrio')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${pnlTab === 'equilibrio' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Punto de equilibrio</button>
              <button onClick={() => setPnlTab('liquidez')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${pnlTab === 'liquidez' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Liquidez</button>
              <button onClick={() => setPnlTab('indicadores')} className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${pnlTab === 'indicadores' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>Indicadores</button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {pnlTab === 'rentabilidad' && (
            <>
              {profitability.advertencia || journalsPending > 0 ? (
                <p className="mb-3 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-500 font-bold flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 shrink-0" /> Existen {journalsPending} asiento(s) pendientes de contabilizar; las cifras contables no son definitivas.
                </p>
              ) : null}
              {profitability.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin información contable para el período (Accounting no registra movimientos).</p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                  {profitability.rows.map(r => (
                    <div key={r.label} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                      <p className="text-[9px] font-bold text-muted-foreground uppercase">{r.label}</p>
                      <p className={cn("text-lg font-black", r.monto !== null && r.monto < 0 ? "text-rose-500" : "text-blue-500")}>{r.monto === null ? 'N/D' : formatConvertedAmount(r.monto, 'NIO')}</p>
                      <p className="text-[9px] text-muted-foreground">
                        {r.prev === null ? 'Sin base comparable' : `Previo: ${formatConvertedAmount(r.prev, 'NIO')}${r.variacion !== null ? ` · ${r.variacion >= 0 ? '↑' : '↓'} ${Math.abs(r.variacion).toFixed(1)}%` : ''}`}
                      </p>
                    </div>
                  ))}
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Margen Bruto</p>
                    <p className="text-lg font-black text-primary">{profitability.margenBruto === null ? 'N/D' : `${profitability.margenBruto.toFixed(1)}%`}</p>
                    <p className="text-[9px] text-muted-foreground">
                      {profitability.margenBrutoPrev === null ? 'Sin base comparable' : `vs. ${profitability.margenBrutoPrev.toFixed(1)}% · ${((profitability.margenBruto ?? 0) - profitability.margenBrutoPrev) >= 0 ? '+' : ''}${((profitability.margenBruto ?? 0) - profitability.margenBrutoPrev).toFixed(1)} puntos porcentuales`}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Margen Operativo</p>
                    <p className="text-lg font-black text-primary">{profitability.margenOperativo === null ? 'N/D' : `${profitability.margenOperativo.toFixed(1)}%`}</p>
                    <p className="text-[9px] text-muted-foreground">
                      {profitability.margenOperativoPrev === null ? 'Sin base comparable' : `vs. ${profitability.margenOperativoPrev.toFixed(1)}% · ${((profitability.margenOperativo ?? 0) - profitability.margenOperativoPrev) >= 0 ? '+' : ''}${((profitability.margenOperativo ?? 0) - profitability.margenOperativoPrev).toFixed(1)} puntos porcentuales`}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Margen Neto</p>
                    <p className="text-lg font-black text-primary">{profitability.margenNeto === null ? 'N/D' : `${profitability.margenNeto.toFixed(1)}%`}</p>
                    <p className="text-[9px] text-muted-foreground">Utilidad neta / Ingresos totales (contable)</p>
                  </div>
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button onClick={() => navigateContabilidad('estado-resultados')} className="text-[10px] font-black uppercase tracking-wider text-primary hover:text-primary/80 flex items-center gap-1">
                  Ver Estado de Resultados completo <ArrowUpRight className="size-3" />
                </button>
                <p className="text-[9px] text-muted-foreground/60">Fuente: Accounting (Estado de Resultados devengado). La utilidad no se calcula desde cobros y pagos.</p>
              </div>
            </>
          )}
          {pnlTab === 'liquidez' && (
            <>
              {liquidezAlta && (
                <p className="mb-3 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-500 font-bold flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 shrink-0" /> Liquidez elevada por baja carga de pasivos registrados. Verifique que todas las obligaciones estén clasificadas (nómina, impuestos, recurrentes y cuentas por pagar).
                </p>
              )}
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10" title="Efectivo en cajas y bancos según el Balance General contable.">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Efectivo y equivalentes</p>
                  <p className="text-lg font-black text-blue-500">{formatConvertedAmount(liquidez.efectivo, 'NIO')}</p>
                  <p className="text-[9px] text-muted-foreground">Caja: {formatConvertedAmount(cashInfo.caja, 'NIO')} · Bancos: {formatConvertedAmount(cashInfo.bancos, 'NIO')}</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10" title="Efectivo + cuentas por cobrar (versión operativa).">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Activo corriente (operativo)</p>
                  <p className="text-lg font-black text-blue-500">{formatConvertedAmount(liquidez.activoCorriente, 'NIO')}</p>
                  <p className="text-[9px] text-muted-foreground">Efectivo + cuentas por cobrar</p>
                </div>
                <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/10" title="Cuentas por pagar abiertas (versión operativa).">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Pasivo corriente (operativo)</p>
                  <p className="text-lg font-black text-orange-500">{formatConvertedAmount(liquidez.pasivoCorriente, 'NIO')}</p>
                  <p className="text-[9px] text-muted-foreground">Cuentas por pagar abiertas</p>
                </div>
                <div className={cn("p-3 rounded-xl border", liquidez.capitalTrabajo >= 0 ? "bg-emerald-500/5 border-emerald-500/10" : "bg-rose-500/5 border-rose-500/10")} title="Activo corriente − pasivo corriente (versión operativa).">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Capital de trabajo</p>
                  <p className={cn("text-lg font-black", liquidez.capitalTrabajo >= 0 ? "text-emerald-500" : "text-rose-500")}>{formatConvertedAmount(liquidez.capitalTrabajo, 'NIO')}</p>
                  <p className="text-[9px] text-muted-foreground">Activo corriente − pasivo corriente</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10" title={liquidez.razonCorriente === null ? 'N/D: no existen pasivos corrientes' : `Fórmula: Razón corriente = Activo corriente / Pasivo corriente (división, no suma).`}>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Razón corriente</p>
                  <p className="text-lg font-black text-blue-500">{liquidez.razonCorriente === null ? 'N/D' : `${liquidez.razonCorriente.toFixed(2)}x`}</p>
                  <p className="text-[9px] text-muted-foreground">Activo corriente / Pasivo corriente</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10" title={liquidez.pruebaAcida === null ? 'N/D: no existen pasivos corrientes' : 'Fórmula: Prueba ácida = (Efectivo + equivalentes + CxC) / Pasivo corriente (división, no suma).'}>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Prueba ácida</p>
                  <p className="text-lg font-black text-blue-500">{liquidez.pruebaAcida === null ? 'N/D' : `${liquidez.pruebaAcida.toFixed(2)}x`}</p>
                  <p className="text-[9px] text-muted-foreground">(Efectivo + equivalentes + CxC) / Pasivo corriente</p>
                </div>
                <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/10" title={liquidez.cobertura30 === null ? 'N/D: no hay pagos previstos a 30 días' : 'Fórmula: Cobertura futura = Efectivo disponible / Pagos previstos a 30 días.'}>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Cobertura futura a 30 días</p>
                  <p className="text-lg font-black text-orange-500">{liquidez.cobertura30 === null ? 'N/D' : `${liquidez.cobertura30.toFixed(2)}x`}</p>
                  <p className="text-[9px] text-muted-foreground">Efectivo / pagos previstos 30 días</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border/50" title="El plan de cuentas no expone clasificación corriente completa; se usa la versión operativa (efectivo, CxC y CxP).">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Clasificación</p>
                  <p className="text-lg font-black text-slate-400">Operativa</p>
                  <p className="text-[9px] text-muted-foreground">Sin clasificación corriente completa en el plan de cuentas</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button onClick={() => setModal({ type: 'liquidez' })} className="text-[10px] font-black uppercase tracking-wider text-primary hover:text-primary/80 flex items-center gap-1">
                  Ver detalle de liquidez <ArrowUpRight className="size-3" />
                </button>
                <p className="text-[9px] text-muted-foreground/60">La cobertura del período (KPI superior) mide cobros frente a pagos ya realizados; la cobertura futura mide el efectivo actual frente a pagos previstos.</p>
              </div>
            </>
          )}
          {pnlTab === 'equilibrio' && (
            <>
              {breakEven.estado === 'MISSING_COST_CLASSIFICATION' && (
                <p className="mb-3 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-500 font-bold flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5 shrink-0" /> Clasifique el comportamiento de los costos (Fijo, Variable, Mixto) para calcular el punto de equilibrio. La configuración se guarda en este navegador; el endpoint del backend está pendiente.
                </p>
              )}
              <div className="grid gap-2 md:grid-cols-3">
                <div className="md:col-span-2 space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                  <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Comportamiento de costos por cuenta de gasto</p>
                  {(profitLoss?.current?.gastos || []).map((g: any) => {
                    const cfg = breakEvenConfig[g.code];
                    return (
                      <div key={g.code} className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-muted/30">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate">{g.code} · {g.name}</p>
                          <p className="text-[9px] text-muted-foreground">{formatConvertedAmount(Number(g.balance || 0), 'NIO')} del período</p>
                        </div>
                        <Select value={cfg?.behavior || 'UNCLASSIFIED'} onValueChange={(v) => setBehavior(g.code, v as CostBehavior, cfg?.fixedPercentage)}>
                          <SelectTrigger className="h-7 w-[160px] text-[10px] bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FIXED">Fijo</SelectItem>
                            <SelectItem value="VARIABLE">Variable</SelectItem>
                            <SelectItem value="MIXED">Mixto</SelectItem>
                            <SelectItem value="NON_OPERATING">No operativo</SelectItem>
                            <SelectItem value="UNCLASSIFIED">Sin clasificar</SelectItem>
                          </SelectContent>
                        </Select>
                        {cfg?.behavior === 'MIXED' && (
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={cfg.fixedPercentage ?? 50}
                            onChange={(e) => setBehavior(g.code, 'MIXED', Math.max(0, Math.min(100, Number(e.target.value))))}
                            className="h-7 w-16 rounded-md border border-border/50 bg-background px-2 text-[10px]"
                            title="% fijo del monto mixto"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Resultado del cálculo</p>
                  {breakEven.estado === 'MISSING_COST_CLASSIFICATION' && <p className="text-xs text-muted-foreground">Sin clasificación de costos: estado <span className="font-black">MISSING_COST_CLASSIFICATION</span>. Clasifique las cuentas a la izquierda.</p>}
                  {breakEven.estado === 'NO_SALES' && <p className="text-xs text-muted-foreground">No existen ventas en el período para calcular el punto de equilibrio.</p>}
                  {breakEven.estado === 'NON_POSITIVE_CONTRIBUTION_MARGIN' && <p className="text-xs text-rose-500 font-bold">No calculable: el margen de contribución no es positivo.</p>}
                  {breakEven.estado === 'AVAILABLE' && (() => {
                    const b = breakEven as Required<BreakEvenResult>;
                    return (
                      <>
                        {[
                          { label: 'Ventas netas (cobradas)', value: formatConvertedAmount(b.ventasNetas, 'NIO') },
                          { label: 'Costos fijos', value: formatConvertedAmount(b.costosFijos, 'NIO') },
                          { label: 'Costos variables', value: formatConvertedAmount(b.costosVariables, 'NIO') },
                          { label: 'Margen de contribución', value: formatConvertedAmount(b.margenContribucion, 'NIO') },
                          { label: 'Margen de contribución %', value: `${b.margenContribucionPct.toFixed(1)}%` },
                          { label: 'Punto de equilibrio (ventas)', value: formatConvertedAmount(b.puntoEquilibrio, 'NIO') },
                          { label: 'Ventas faltantes', value: formatConvertedAmount(b.ventasFaltantes, 'NIO') },
                          { label: 'Margen de seguridad', value: formatConvertedAmount(b.margenSeguridad, 'NIO') },
                          { label: 'Margen de seguridad %', value: b.margenSeguridadPct === null ? 'N/D' : `${b.margenSeguridadPct.toFixed(1)}%` },
                        ].map(m => (
                          <div key={m.label} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">{m.label}</p>
                            <p className={cn("text-xs font-black", m.label.includes('Punto') || m.label.includes('faltantes') ? "text-rose-500" : m.label.includes('seguridad') ? "text-emerald-500" : "text-blue-500")}>{m.value}</p>
                          </div>
                        ))}
                        <p className="text-[9px] text-muted-foreground pt-1">
                          Ventas actuales {formatConvertedAmount(b.ventasNetas, 'NIO')} vs. equilibrio {formatConvertedAmount(b.puntoEquilibrio, 'NIO')} · {b.margenSeguridad >= 0 ? 'por encima del equilibrio' : 'por debajo del equilibrio'} · Estado: <span className="font-black">AVAILABLE</span>
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>
            </>
          )}
          {pnlTab === 'indicadores' && (
            <>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {indicadores.indicadores.map(m => (
                  <div key={m.label} className="p-3 rounded-xl bg-muted/30 border border-border/50" title={`Fórmula: ${m.formula}`}>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">{m.label}</p>
                    <p className="text-lg font-black text-blue-500">{m.value === null ? 'N/D' : (/Razón|Prueba|Rotación|Cobertura/.test(m.label) ? `${m.value.toFixed(2)}x` : `${m.value.toFixed(1)}%`)}</p>
                    <p className="text-[9px] text-muted-foreground">{m.formula}</p>
                    <p className="text-[9px] text-muted-foreground/70">{m.interpretacion}</p>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground/60 mt-2">Saldos promedio: (saldo inicial del período + saldo final) / 2, según Balance General contable. Fórmulas y comparación disponibles en tooltip.</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* ═══ Caja y Conciliación + Presupuesto y Recurrentes ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-blue-500/20 min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Banknote className="size-4 text-blue-500" /> Caja y Conciliación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 text-center">
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Cajas abiertas</p>
                <p className="text-lg font-black text-blue-500">{cajaInfo.cajasAbiertas.length}</p>
                <p className="text-[9px] text-muted-foreground truncate">{cajaInfo.cajasAbiertas.map((c: any) => c.name || 'Caja').join(', ') || 'Sin cajas abiertas'}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 text-center">
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Efectivo teórico</p>
                <p className="text-lg font-black text-blue-500">{formatConvertedAmount(cajaInfo.efectivoTeorico, 'NIO')}</p>
                <p className="text-[9px] text-muted-foreground">sesiones de caja abiertas</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 text-center">
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Efectivo contado</p>
                <p className="text-lg font-black text-blue-500">{formatConvertedAmount(cajaInfo.efectivoContado, 'NIO')}</p>
                <p className="text-[9px] text-muted-foreground">último arqueo registrado</p>
              </div>
              <div className={cn("p-3 rounded-xl text-center border", Math.abs(cajaInfo.diferenciaArqueo) > 0.001 ? "bg-rose-500/5 border-rose-500/10" : "bg-emerald-500/5 border-emerald-500/10")}>
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Diferencia de arqueo</p>
                <p className={cn("text-lg font-black", Math.abs(cajaInfo.diferenciaArqueo) > 0.001 ? "text-rose-500" : "text-emerald-500")}>{formatConvertedAmount(cajaInfo.diferenciaArqueo, 'NIO')}</p>
                <p className="text-[9px] text-muted-foreground">{Math.abs(cajaInfo.diferenciaArqueo) > 0.001 ? 'requiere aprobación' : 'sin diferencias'}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Bancos conciliados</p>
                <p className="text-lg font-black text-emerald-500">{cajaInfo.bancosConciliados}</p>
                <p className="text-[9px] text-muted-foreground">conciliaciones completadas · {formatConvertedAmount(cajaInfo.montoConciliado, 'NIO')}</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-center">
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Pendientes de conciliación</p>
                <p className="text-lg font-black text-amber-500">{cajaInfo.pendientesConciliacion}</p>
                <p className="text-[9px] text-muted-foreground">{cajaInfo.ultimaConciliacion ? `última: ${cajaInfo.ultimaConciliacion.toLocaleDateString('es-NI')}` : 'sin conciliaciones'}</p>
              </div>
            </div>
            {(cajaInfo.cajasAbiertas.length > 0 || Math.abs(cajaInfo.diferenciaArqueo) > 0.001 || cajaInfo.pendientesConciliacion > 0) && (
              <p className="mt-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-500 font-bold flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 shrink-0" />
                {cajaInfo.cajasAbiertas.length > 0 && `Caja(s) sin cerrar. `}
                {Math.abs(cajaInfo.diferenciaArqueo) > 0.001 && `Diferencia de arqueo sin aprobar. `}
                {cajaInfo.pendientesConciliacion > 0 && `Conciliación(es) bancaria(s) pendiente(s).`}
              </p>
            )}
            <button onClick={() => setModal({ type: 'caja' })} className="mt-2 text-[10px] font-black uppercase tracking-wider text-blue-400 hover:text-blue-300 flex items-center gap-1">
              Ver detalle de caja y conciliaciones <ArrowUpRight className="size-3" />
            </button>
          </CardContent>
        </Card>

        <Card className="border-orange-500/20 min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Target className="size-4 text-orange-500" /> Presupuesto y Recurrentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/10">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Presupuesto del período</p>
                <button onClick={() => navigateContabilidad('presupuestos')} className="text-[9px] font-black uppercase tracking-wider text-orange-500 hover:text-orange-400">
                  {budget ? 'Ver en Contabilidad' : 'Configurar presupuesto'}
                </button>
              </div>
              {budget ? (
                <>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                    <p className="text-base font-black text-orange-500">{formatConvertedAmount(budget.presupuesto, 'NIO')}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Ejecutado <span className="font-black text-orange-500">{formatConvertedAmount(budget.ejecutado, 'NIO')}</span> ({budget.pct.toFixed(1)}%) · Disponible <span className="font-black">{formatConvertedAmount(budget.disponible, 'NIO')}</span>
                      {budget.desviacion > 0 && <span className="text-rose-500 font-bold"> · Sobre ejecutado {formatConvertedAmount(budget.desviacion, 'NIO')}</span>}
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-orange-500/10 overflow-hidden">
                    <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${Math.max(2, budget.pct)}%` }} />
                  </div>
                  <button onClick={() => setModal({ type: 'presupuesto' })} className="mt-1 text-[9px] font-black uppercase tracking-wider text-orange-400 hover:text-orange-300 flex items-center gap-1">
                    Ver partidas ({budget.count}) <ArrowUpRight className="size-3" />
                  </button>
                </>
              ) : (
                <p className="text-[10px] text-muted-foreground mt-1">Presupuesto financiero sin configurar. Configure partidas presupuestarias en Contabilidad para comparar ejecución.</p>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Ingresos recurrentes</p>
                <p className="text-base font-black text-emerald-500">{recurrentes.ingresos} activos</p>
                <p className="text-[9px] text-muted-foreground">{formatConvertedAmount(recurrentes.ingMensual, 'NIO')}/mes</p>
              </div>
              <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/10 text-center">
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Gastos recurrentes</p>
                <p className="text-base font-black text-rose-500">{recurrentes.gastos} activos</p>
                <p className="text-[9px] text-muted-foreground">{formatConvertedAmount(recurrentes.expMensual, 'NIO')}/mes</p>
              </div>
            </div>
            <div className="mt-2 p-3 rounded-xl bg-muted/30 border border-border/50">
              <p className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                <CalendarDays className="size-3.5 text-primary" /> Impacto neto mensual y próximos vencimientos
              </p>
              <p className="text-base font-black">{formatConvertedAmount(recurrentes.impactoNeto, 'NIO')}/mes</p>
              <p className="text-[9px] text-muted-foreground">
                {recurrentes.nextIng?.fecha ? `Próxima entrada: ${recurrentes.nextIng.fecha.toLocaleDateString('es-NI')} · ${formatConvertedAmount(recurrentes.nextIng.monto, 'NIO')}` : 'Sin próximas entradas'}
                {recurrentes.nextExp?.fecha ? ` · Próximo pago: ${recurrentes.nextExp.fecha.toLocaleDateString('es-NI')} · ${formatConvertedAmount(recurrentes.nextExp.monto, 'NIO')}` : ''}
              </p>
              <button onClick={() => setModal({ type: 'recurrentes' })} className="mt-1 text-[9px] font-black uppercase tracking-wider text-primary hover:text-primary/80 flex items-center gap-1">
                Ver recurrentes <ArrowUpRight className="size-3" />
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Detail Modals ═══ */}
      <Dialog open={!!modal} onOpenChange={(open) => { if (!open) setModal(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {modal?.type === 'ingresos' && <><TrendingUp className="size-4" /> Movimientos de Ingresos Cobrados</>}
              {modal?.type === 'pagos' && <><TrendingDown className="size-4" /> Movimientos de Pagos Realizados</>}
              {modal?.type === 'cxc' && <><CreditCard className="size-4" /> Cuentas por Cobrar</>}
              {modal?.type === 'cxp' && <><Receipt className="size-4" /> Cuentas por Pagar</>}
              {modal?.type === 'compromisos' && <><CalendarDays className="size-4" /> Compromisos Próximos (30 días)</>}
              {modal?.type === 'caja' && <><Banknote className="size-4" /> Caja, Arqueo y Conciliación</>}
              {modal?.type === 'presupuesto' && <><Target className="size-4" /> Partidas Presupuestarias</>}
              {modal?.type === 'recurrentes' && <><RefreshCw className="size-4" /> Ingresos y Gastos Recurrentes</>}
              {modal?.type === 'liquidez' && <><ShieldCheck className="size-4" /> Detalle de Liquidez</>}
            </DialogTitle>
            <DialogDescription>
              {modal?.type === 'ingresos' && `Dinero realmente cobrado en el período (${rangeLabel}): ${flow.ingresosMov} movimientos.`}
              {modal?.type === 'pagos' && `Dinero realmente pagado en el período (${rangeLabel}): ${flow.pagosMov} movimientos.`}
              {modal?.type === 'cxc' && `Facturas de venta pendientes (${orderedCxc.length}).`}
              {modal?.type === 'cxp' && `Facturas de proveedor pendientes (${orderedCxp.length}).`}
              {modal?.type === 'compromisos' && `Pagos previstos en los próximos 30 días (${orderedCompromisos.length}).`}
              {modal?.type === 'caja' && 'Cajas abiertas, arqueos y conciliaciones bancarias.'}
              {modal?.type === 'presupuesto' && (budget ? `${budget.count} partidas activas del período.` : 'No existen partidas presupuestarias activas.')}
              {modal?.type === 'recurrentes' && 'Documentos recurrentes activos; no se consideran cobrados/pagados hasta ejecutarse.'}
              {modal?.type === 'liquidez' && 'Métricas de liquidez en versión operativa (clasificación contable disponible).'}
            </DialogDescription>
          </DialogHeader>

          {modal?.type === 'ingresos' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 pb-1">
                <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-center flex-1 min-w-[130px]">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Total cobrado</p>
                  <p className="text-sm font-black text-emerald-500">{formatConvertedAmount(flow.ingresos, 'NIO')}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/30 border border-border/50 text-center flex-1 min-w-[130px]">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Movimientos</p>
                  <p className="text-sm font-black">{flow.ingresosMov}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/30 border border-border/50 text-center flex-1 min-w-[130px]">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Período anterior</p>
                  <p className="text-sm font-black text-slate-400">{formatConvertedAmount(prevFlow.ingresos, 'NIO')}</p>
                </div>
              </div>
              {ingComposition.movimientos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin movimientos de ingreso en el período.</p>
              ) : (
                ingComposition.movimientos.slice(0, 120).map((m, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30">
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{m.concepto}</p>
                      <p className="text-[10px] text-muted-foreground">{(m.fecha || new Date()).toLocaleDateString('es-NI')} · {m.cuenta} · {m.origen} · {m.documento}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {statusBadge(m.estado)}
                      <p className="text-xs font-black text-emerald-500">+{formatConvertedAmount(m.monto, 'NIO')}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {modal?.type === 'pagos' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 pb-1">
                <div className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/10 text-center flex-1 min-w-[130px]">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Total pagado</p>
                  <p className="text-sm font-black text-rose-500">{formatConvertedAmount(flow.pagos, 'NIO')}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/30 border border-border/50 text-center flex-1 min-w-[130px]">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Movimientos</p>
                  <p className="text-sm font-black">{flow.pagosMov}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/30 border border-border/50 text-center flex-1 min-w-[130px]">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Período anterior</p>
                  <p className="text-sm font-black text-slate-400">{formatConvertedAmount(prevFlow.pagos, 'NIO')}</p>
                </div>
              </div>
              {pagComposition.movimientos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin movimientos de pago en el período.</p>
              ) : (
                pagComposition.movimientos.slice(0, 120).map((m, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30">
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{m.concepto}</p>
                      <p className="text-[10px] text-muted-foreground">{(m.fecha || new Date()).toLocaleDateString('es-NI')} · {m.cuenta} · {m.origen} · {m.documento}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {statusBadge(m.estado)}
                      <p className="text-xs font-black text-rose-500">-{formatConvertedAmount(m.monto, 'NIO')}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {modal?.type === 'cxc' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 pb-1">
                <div className="p-2 rounded-lg bg-blue-500/5 border border-blue-500/10 text-center flex-1 min-w-[120px]">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Saldo por cobrar</p>
                  <p className="text-sm font-black text-blue-500">{formatConvertedAmount(position.cxc.total, 'NIO')}</p>
                </div>
                <div className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/10 text-center flex-1 min-w-[120px]">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Vencido</p>
                  <p className="text-sm font-black text-rose-500">{formatConvertedAmount(position.cxc.vencido, 'NIO')}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/30 border border-border/50 text-center flex-1 min-w-[120px]">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Facturas</p>
                  <p className="text-sm font-black">{position.cxc.facturas}</p>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1 pb-1">
                {cxcAging.buckets.map(b => (
                  <div key={b.label} className="p-1.5 rounded-lg bg-muted/30 text-center" title={`${b.label}: ${b.facturas} factura(s)`}>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase leading-tight">{b.label}</p>
                    <p className="text-[10px] font-black text-rose-500">{b.pct > 0 ? `${b.pct.toFixed(0)}%` : '—'}</p>
                  </div>
                ))}
              </div>
              {orderedCxc.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No existen cuentas por cobrar pendientes.</p>
              ) : (
                orderedCxc.slice(0, 100).map(inv => {
                  const due = toDate(inv.dueDate);
                  const days = due ? Math.floor((Date.now() - due.getTime()) / DAY_MS) : -1;
                  return (
                    <div key={inv.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30">
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{inv.number} · {inv.customer?.name || inv.customerName || 'Cliente'}</p>
                        <p className="text-[10px] text-muted-foreground">Vence: {(due || new Date()).toLocaleDateString('es-NI')}{days > 0 ? ` · ${days} días vencido` : ''}</p>
                      </div>
                      <p className="text-xs font-black text-blue-500 shrink-0">{formatConvertedAmount(saldoOf(inv, exchangeRate), 'NIO')}</p>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {modal?.type === 'cxp' && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 pb-1">
                <div className="p-2 rounded-lg bg-orange-500/5 border border-orange-500/10 text-center flex-1 min-w-[120px]">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Saldo por pagar</p>
                  <p className="text-sm font-black text-orange-500">{formatConvertedAmount(position.cxp.total, 'NIO')}</p>
                </div>
                <div className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/10 text-center flex-1 min-w-[120px]">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Vencido</p>
                  <p className="text-sm font-black text-rose-500">{formatConvertedAmount(position.cxp.vencido, 'NIO')}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/30 border border-border/50 text-center flex-1 min-w-[120px]">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Facturas</p>
                  <p className="text-sm font-black">{position.cxp.facturas}</p>
                </div>
              </div>
              {orderedCxp.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No existen cuentas por pagar pendientes.</p>
              ) : (
                orderedCxp.slice(0, 100).map(bill => {
                  const due = toDate(bill.dueDate);
                  const days = due ? Math.floor((Date.now() - due.getTime()) / DAY_MS) : -1;
                  return (
                    <div key={bill.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30">
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{bill.number} · {bill.supplier?.name || bill.vendorName || 'Proveedor'}</p>
                        <p className="text-[10px] text-muted-foreground">Vence: {(due || new Date()).toLocaleDateString('es-NI')}{days > 0 ? ` · ${days} días vencido` : ''}</p>
                      </div>
                      <p className="text-xs font-black text-orange-500 shrink-0">{formatConvertedAmount(saldoOf(bill, exchangeRate), 'NIO')}</p>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {modal?.type === 'compromisos' && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 pb-1">
                <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-center">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">7 días</p>
                  <p className="text-sm font-black text-amber-500">{formatConvertedAmount(position.compromisos.d7.monto, 'NIO')}</p>
                </div>
                <div className="p-2 rounded-lg bg-orange-500/5 border border-orange-500/10 text-center">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">15 días</p>
                  <p className="text-sm font-black text-orange-500">{formatConvertedAmount(position.compromisos.d15.monto, 'NIO')}</p>
                </div>
                <div className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/10 text-center">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">30 días</p>
                  <p className="text-sm font-black text-rose-500">{formatConvertedAmount(position.compromisos.d30.monto, 'NIO')}</p>
                </div>
              </div>
              {orderedCompromisos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Sin compromisos de pago en los próximos 30 días.</p>
              ) : (
                orderedCompromisos.slice(0, 100).map((c, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30">
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{c.detalle}</p>
                      <p className="text-[10px] text-muted-foreground">Vence: {(c.fecha || new Date()).toLocaleDateString('es-NI')}</p>
                    </div>
                    <p className="text-xs font-black text-orange-500 shrink-0">{formatConvertedAmount(c.monto, 'NIO')}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {modal?.type === 'caja' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 pb-1">
                <div className="p-2 rounded-lg bg-blue-500/5 border border-blue-500/10 text-center">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Caja (contable)</p>
                  <p className="text-sm font-black text-blue-500">{formatConvertedAmount(cashInfo.caja, 'NIO')}</p>
                </div>
                <div className="p-2 rounded-lg bg-blue-500/5 border border-blue-500/10 text-center">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Bancos (contable)</p>
                  <p className="text-sm font-black text-blue-500">{formatConvertedAmount(cashInfo.bancos, 'NIO')}</p>
                </div>
                <div className="p-2 rounded-lg bg-blue-500/5 border border-blue-500/10 text-center">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Efectivo teórico en cajas</p>
                  <p className="text-sm font-black text-blue-500">{formatConvertedAmount(cajaInfo.efectivoTeorico, 'NIO')}</p>
                </div>
                <div className={cn("p-2 rounded-lg text-center", Math.abs(cajaInfo.diferenciaArqueo) > 0.001 ? "bg-rose-500/5 border border-rose-500/10" : "bg-emerald-500/5 border border-emerald-500/10")}>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Diferencia de arqueo</p>
                  <p className={cn("text-sm font-black", Math.abs(cajaInfo.diferenciaArqueo) > 0.001 ? "text-rose-500" : "text-emerald-500")}>{formatConvertedAmount(cajaInfo.diferenciaArqueo, 'NIO')}</p>
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground">Efectivo contado C$0.00 significa que no existen arqueos registrados para las sesiones abiertas, no que la caja esté vacía.</p>
              <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-center">
                <p className="text-[9px] font-bold text-muted-foreground uppercase">Bancos conciliados</p>
                <p className="text-sm font-black text-emerald-500">{cajaInfo.bancosConciliados} · {formatConvertedAmount(cajaInfo.montoConciliado, 'NIO')}</p>
              </div>
              {reconciliations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No existen conciliaciones bancarias para el período.</p>
              ) : (
                <div className="space-y-1">
                  {reconciliations.slice(0, 20).map(r => (
                    <div key={r.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30">
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{r.account?.name || 'Cuenta bancaria'} · {r.period || ''}</p>
                        <p className="text-[10px] text-muted-foreground">{(toDate(r.endDate || r.createdAt) || new Date()).toLocaleDateString('es-NI')}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {statusBadge(r.status)}
                        <p className="text-xs font-black text-blue-500">{formatConvertedAmount(Number(r.endBalance || r.statementBalance || 0), 'NIO')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {modal?.type === 'presupuesto' && (
            <div className="space-y-2">
              {!budget ? (
                <p className="text-sm text-muted-foreground text-center py-6">Presupuesto financiero sin configurar. Use el botón Configurar presupuesto para crear partidas en Contabilidad.</p>
              ) : (
                <div className="space-y-1">
                  {budget.items.map((it: any) => (
                    <div key={it.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30">
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{it.code} · {it.name}</p>
                        <p className="text-[10px] text-muted-foreground">Período: {it.period} · {it.status}</p>
                      </div>
                      <p className="text-xs font-black text-orange-500 shrink-0">{formatConvertedAmount(Number(it.assignedAmount || 0), 'NIO')}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {modal?.type === 'recurrentes' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 pb-1">
                <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-center">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Impacto neto mensual</p>
                  <p className="text-sm font-black text-emerald-500">{formatConvertedAmount(recurrentes.impactoNeto, 'NIO')}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted/30 border border-border/50 text-center">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Ingresos / Gastos activos</p>
                  <p className="text-sm font-black">{recurrentes.ingresos} / {recurrentes.gastos}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black text-emerald-500 uppercase mb-1">Ingresos recurrentes</p>
                {raw?.recurringIncomes.filter(r => { const s = String(r.status || '').toUpperCase(); return s === 'ACTIVE' || s === ''; }).slice(0, 20).map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30 mb-1">
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{r.description || 'Ingreso recurrente'}</p>
                      <p className="text-[10px] text-muted-foreground">Próxima: {(toDate(r.nextDate || r.nextIncomeDate) || new Date()).toLocaleDateString('es-NI')}</p>
                    </div>
                    <p className="text-xs font-black text-emerald-500 shrink-0">+{formatConvertedAmount(toNioAmt(r.amount, r.currency, r.exchangeRate, exchangeRate), 'NIO')}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[10px] font-black text-rose-500 uppercase mb-1">Gastos recurrentes</p>
                {raw?.recurringExpenses.filter(r => { const s = String(r.status || '').toUpperCase(); return s === 'ACTIVE' || s === ''; }).slice(0, 20).map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30 mb-1">
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{r.description || 'Gasto recurrente'}</p>
                      <p className="text-[10px] text-muted-foreground">Próximo: {(toDate(r.nextDate || r.nextExpenseDate) || new Date()).toLocaleDateString('es-NI')}</p>
                    </div>
                    <p className="text-xs font-black text-rose-500 shrink-0">-{formatConvertedAmount(toNioAmt(r.amount, r.currency, r.exchangeRate, exchangeRate), 'NIO')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {modal?.type === 'liquidez' && (
            <div className="space-y-2">
              {[
                { label: 'Efectivo y equivalentes', value: formatConvertedAmount(liquidez.efectivo, 'NIO'), detalle: 'Cajas y bancos (contabilidad)' },
                { label: 'Activo corriente (operativo)', value: formatConvertedAmount(liquidez.activoCorriente, 'NIO'), detalle: 'Efectivo + cuentas por cobrar' },
                { label: 'Pasivo corriente (operativo)', value: formatConvertedAmount(liquidez.pasivoCorriente, 'NIO'), detalle: 'Cuentas por pagar abiertas' },
                { label: 'Capital de trabajo', value: formatConvertedAmount(liquidez.capitalTrabajo, 'NIO'), detalle: 'Activo corriente − pasivo corriente' },
                { label: 'Razón corriente', value: liquidez.razonCorriente === null ? 'N/D' : `${liquidez.razonCorriente.toFixed(2)}x`, detalle: liquidez.razonCorriente === null ? 'No existen pasivos corrientes' : 'Activo corriente ÷ pasivo corriente' },
                { label: 'Prueba ácida', value: liquidez.pruebaAcida === null ? 'N/D' : `${liquidez.pruebaAcida.toFixed(2)}x`, detalle: liquidez.pruebaAcida === null ? 'No existen pasivos corrientes' : '(Efectivo + CxC) ÷ pasivo corriente' },
                { label: 'Cobertura de compromisos 30 días', value: liquidez.cobertura30 === null ? 'N/D' : `${liquidez.cobertura30.toFixed(2)}x`, detalle: liquidez.cobertura30 === null ? 'No hay pagos previstos a 30 días' : 'Efectivo ÷ pagos previstos 30 días' },
              ].map(m => (
                <div key={m.label} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{m.label}</p>
                    <p className="text-[10px] text-muted-foreground">{m.detalle}</p>
                  </div>
                  <p className="text-xs font-black text-blue-500 shrink-0">{m.value}</p>
                </div>
              ))}
              <p className="text-[9px] text-muted-foreground/60 pt-1">Las cuentas se identifican por clasificación contable (activo/pasivo) y saldos de caja, CxC y CxP; el plan de cuentas actual no expone una clasificación corriente completa, por lo que se utiliza la versión operativa.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
});
FinanceReportTab.displayName = 'FinanceReportTab';
