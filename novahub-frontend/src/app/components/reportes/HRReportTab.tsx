import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { employeesService, payrollService, timeOffService } from '../../services/rh.service';
import { hrService } from '../../services/hr.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Users, DollarSign, Clock, Activity, Plane, TrendingUp, Scale, GraduationCap, FileText, Gift, Star, ShieldCheck, UserPlus, UserMinus, RefreshCw, AlertTriangle, Filter, Lightbulb, BadgeCheck, Timer, CalendarX, Trophy, Gauge } from 'lucide-react';
import type { ReportExportRef, ReportProps } from './types';
import { useTenantQuery, asList } from '../../hooks/useTenantQuery';
import { downloadExcelWorkbook, getBase64Image, sanitizeHtml2CanvasOklch } from '../../utils/reportExportUtils';
import { getPdfDesignSettings, pdfDesignPaper } from '../../utils/pdfGenerator';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const PALETTE = {
  azul: '#3b82f6',
  verde: '#10b981',
  naranja: '#f59e0b',
  naranjaClaro: '#fbbf24',
  naranjaFuerte: '#f97316',
  rojo: '#ef4444',
  gris: '#9ca3af',
};

const ACCENTS = {
  azul: { border: 'border-l-blue-500', text: 'text-blue-500', icon: 'text-blue-500' },
  verde: { border: 'border-l-emerald-500', text: 'text-emerald-400', icon: 'text-emerald-400' },
  naranja: { border: 'border-l-amber-500', text: 'text-amber-400', icon: 'text-amber-400' },
  rojo: { border: 'border-l-red-500', text: 'text-red-400', icon: 'text-red-400' },
} as const;

const CONTRACT_LABELS: Record<string, string> = {
  FULL_TIME: 'Tiempo completo',
  PART_TIME: 'Tiempo parcial',
  CONTRACTOR: 'Contratista',
  INTERN: 'Pasante',
  TEMPORARY: 'Temporal',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  INACTIVE: 'Inactivo',
  ON_LEAVE: 'En licencia',
  TERMINATED: 'Baja',
};

const LEAVE_LABELS: Record<string, string> = {
  VACATION: 'Vacaciones',
  SICK: 'Incapacidad',
  PERSONAL: 'Permiso personal',
  MATERNITY: 'Maternidad',
  PATERNITY: 'Paternidad',
  UNPAID: 'No remunerado',
  BEREAVEMENT: 'Duelo',
  OTHER: 'Otro',
};

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function getRangeDates(range: string) {
  const now = new Date();
  const start = new Date(now);
  const prevStart = new Date(now);
  const prevEnd = new Date(now);

  switch (range) {
    case 'hoy':
      start.setHours(0, 0, 0, 0);
      prevStart.setDate(now.getDate() - 1); prevStart.setHours(0, 0, 0, 0);
      prevEnd.setDate(now.getDate() - 1); prevEnd.setHours(23, 59, 59, 999);
      break;
    case 'ultima-semana':
      start.setDate(now.getDate() - 7);
      prevStart.setDate(now.getDate() - 14);
      prevEnd.setDate(now.getDate() - 7);
      break;
    case 'ultimo-mes':
      start.setMonth(now.getMonth() - 1);
      prevStart.setMonth(now.getMonth() - 2);
      prevEnd.setMonth(now.getMonth() - 1);
      break;
    case 'ultimo-trimestre':
      start.setMonth(now.getMonth() - 3);
      prevStart.setMonth(now.getMonth() - 6);
      prevEnd.setMonth(now.getMonth() - 3);
      break;
    case 'ultimo-año':
      start.setFullYear(now.getFullYear() - 1);
      prevStart.setFullYear(now.getFullYear() - 2);
      prevEnd.setFullYear(now.getFullYear() - 1);
      break;
    default:
      return { start: new Date(0), prevStart: null, prevEnd: null };
  }
  start.setHours(0, 0, 0, 0);
  prevStart.setHours(0, 0, 0, 0);
  prevEnd.setHours(23, 59, 59, 999);
  return { start, prevStart, prevEnd };
}

function isDateInRange(value: unknown, range: string): boolean {
  const date = toDate(value);
  if (!date) return false;
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const start = new Date(now);
  switch (range) {
    case 'hoy': return date >= startToday;
    case 'ultima-semana': start.setDate(now.getDate() - 7); break;
    case 'ultimo-mes': start.setMonth(now.getMonth() - 1); break;
    case 'ultimo-trimestre': start.setMonth(now.getMonth() - 3); break;
    case 'ultimo-año': start.setFullYear(now.getFullYear() - 1); break;
    default: return true;
  }
  start.setHours(0, 0, 0, 0);
  return date >= start;
}

function isDateInWindow(value: unknown, startMs: number, endMs: number): boolean {
  const date = toDate(value);
  if (!date) return false;
  const t = date.getTime();
  return t >= startMs && t <= endMs;
}

function fmtTenure(months: number): string {
  if (!Number.isFinite(months) || months <= 0) return '—';
  if (months < 1) {
    const days = Math.max(1, Math.round(months * 30));
    return `${days} ${days === 1 ? 'día' : 'días'}`;
  }
  const m = Math.round(months);
  if (m < 12) return `${m} ${m === 1 ? 'mes' : 'meses'}`;
  const years = Math.floor(m / 12);
  const rem = m % 12;
  const yPart = `${years} ${years === 1 ? 'año' : 'años'}`;
  return rem > 0 ? `${yPart}, ${rem} ${rem === 1 ? 'mes' : 'meses'}` : yPart;
}

function nextAnniversary(hireDate: Date, now: Date): { label: string; days: number } {
  let next = new Date(hireDate);
  next.setFullYear(now.getFullYear());
  if (next.getTime() < now.getTime()) next.setFullYear(now.getFullYear() + 1);
  const days = Math.max(0, Math.round((next.getTime() - now.getTime()) / 86400000));
  if (days === 0) return { label: '¡Hoy!', days };
  const label = days <= 31 ? `en ${days} ${days === 1 ? 'día' : 'días'}` : `en ${Math.round(days / 30)} meses`;
  return { label, days };
}

type EvoBucket = { key: string; label: string; startMs: number; endMs: number };

function makeBuckets(start: Date, end: Date): EvoBucket[] {
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return [];
  const spanDays = (endMs - startMs) / 86400000;
  const buckets: EvoBucket[] = [];
  if (spanDays <= 31) {
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    while (cursor.getTime() <= endMs) {
      const bStart = cursor.getTime();
      const next = new Date(cursor);
      next.setDate(cursor.getDate() + 1);
      buckets.push({ key: `d${bStart}`, label: `${cursor.getDate()} ${MONTH_NAMES[cursor.getMonth()]}`, startMs: bStart, endMs: next.getTime() - 1 });
      cursor.setDate(cursor.getDate() + 1);
    }
  } else if (spanDays <= 120) {
    const cursor = new Date(start);
    const dow = (cursor.getDay() + 6) % 7;
    cursor.setDate(cursor.getDate() - dow);
    cursor.setHours(0, 0, 0, 0);
    while (cursor.getTime() <= endMs) {
      const bStart = cursor.getTime();
      const next = new Date(cursor);
      next.setDate(cursor.getDate() + 7);
      buckets.push({ key: `w${bStart}`, label: `Sem ${cursor.getDate()} ${MONTH_NAMES[cursor.getMonth()]}`, startMs: bStart, endMs: next.getTime() - 1 });
      cursor.setDate(cursor.getDate() + 7);
    }
  } else {
    const cursor = new Date(start);
    cursor.setDate(1);
    cursor.setHours(0, 0, 0, 0);
    while (cursor.getTime() <= endMs) {
      const bStart = cursor.getTime();
      const next = new Date(cursor);
      next.setMonth(cursor.getMonth() + 1);
      buckets.push({ key: `m${bStart}`, label: `${MONTH_NAMES[cursor.getMonth()]} ${String(cursor.getFullYear()).slice(2)}`, startMs: bStart, endMs: next.getTime() - 1 });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  return buckets;
}

type ListRow = { label: string; sub?: string; right?: string; rightClass?: string; tag?: string };

export const HRReportTab = forwardRef<ReportExportRef, ReportProps>(({ dateRange }, ref) => {
  const { displayCurrency, baseCurrency, valuationMode, valuationModeLabel, formatConvertedAmount: formatAmountBySource, toBaseAmount, exchangeRate } = useCurrency();
  const { themeConfig } = useTheme();
  const { canPerform } = useAuth();
  const canViewHr = canPerform('HR', 'view');
  const currencySymbol = displayCurrency === 'USD' ? '$' : 'C$';
  const formatConvertedAmount = (amount: number, sourceCurrency?: string, sourceExchangeRate?: number) =>
    formatAmountBySource(amount, sourceCurrency === 'NIO' ? baseCurrency : sourceCurrency, sourceExchangeRate);

  const { data: reportData, isLoading: loading } = useTenantQuery(['reports', 'hr'], async (signal) => {
    const filters = { page: 1, pageSize: 5000, report: true } as const;
    const [empRes, payRes, toRes, attRes, vacRes, revRes, traRes, benRes, docRes, kpiRes] = await Promise.all([
      employeesService.getAll(filters, signal), payrollService.getAll(filters, signal), timeOffService.getAll(filters, signal),
      hrService.getAttendanceRecords(filters, signal), hrService.getVacationBalances(undefined, signal),
      hrService.getPerformanceReviews(undefined, signal, filters), hrService.getTrainings(filters, signal),
      hrService.getBenefits(filters, signal), hrService.getDocuments(undefined, signal, filters), hrService.getKpiResults(undefined, undefined, signal),
    ]);
    return {
      employees: asList(empRes), payrolls: asList(payRes), leaves: asList(toRes), attendances: asList(attRes),
      vacations: asList(vacRes), reviews: asList(revRes), trainings: asList(traRes), benefits: asList(benRes),
      documents: asList(docRes), kpiResults: asList(kpiRes),
    };
  }, { enabled: canViewHr, onError: (e) => toast.error(e.message || 'Error cargando RRHH') });
  const employees = reportData?.employees || [];
  const payrolls = reportData?.payrolls || [];
  const leaves = reportData?.leaves || [];
  const attendances = reportData?.attendances || [];
  const vacations = reportData?.vacations || [];
  const reviews = reportData?.reviews || [];
  const trainings = reportData?.trainings || [];
  const benefits = reportData?.benefits || [];
  const documents = reportData?.documents || [];
  const kpiResults = reportData?.kpiResults || [];

  const [movTab, setMovTab] = useState('altas-bajas');
  const [evoTab, setEvoTab] = useState('costo');
  const [distKey, setDistKey] = useState('departamento');
  const [rankTab, setRankTab] = useState('antiguedad');
  const [extraTab, setExtraTab] = useState('vacaciones');

  const [fDept, setFDept] = useState('all');
  const [fPos, setFPos] = useState('all');
  const [fContract, setFContract] = useState('all');
  const [fStatus, setFStatus] = useState('all');

  const [modal, setModal] = useState<{ title: string; desc: string; rows: ListRow[] } | null>(null);

  const fmtShort = (v: number) => {
    const num = Number(v);
    if (!Number.isFinite(num)) return 'C$0';
    const converted = toBaseAmount(num, baseCurrency, 1);
    if (Math.abs(converted) >= 1000000) return `${currencySymbol}${(converted / 1000000).toFixed(1)}M`;
    if (Math.abs(converted) >= 1000) return `${currencySymbol}${(converted / 1000).toFixed(1)}k`;
    return `${currencySymbol}${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const fmtMoney = (v: number) => {
    const num = Number(v);
    if (!Number.isFinite(num)) return `${currencySymbol}0.00`;
    const converted = toBaseAmount(num, baseCurrency, 1);
    const sign = converted < 0 ? '-' : '';
    return `${sign}${currencySymbol}${Math.abs(converted).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const pctVar = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0);
  const ppVar = (cur: number, prev: number) => cur - prev;

  const varBadge = (cur: number, prev: number, goodWhenUp: boolean, pct = true, suffix = '%') => {
    if (pct ? !(prev > 0) : prev < 0) return null;
    const d = cur - prev;
    const delta = pct ? pctVar(cur, prev) : ppVar(cur, prev);
    const up = d >= 0;
    const good = up === goodWhenUp;
    return (
      <span
        className={`text-xs font-black ${good ? 'text-emerald-400' : 'text-red-400'}`}
        title={pct ? `Período anterior: ${fmtMoney(prev)}` : `Período anterior: ${prev.toFixed(1)}${suffix}`}
      >
        {up ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}{suffix}
      </span>
    );
  };

  const now = useMemo(() => new Date(), []);
  const { start: currentStart, prevStart, prevEnd } = useMemo(() => getRangeDates(dateRange), [dateRange]);
  const prevWin = useMemo(() => prevStart && prevEnd ? { startMs: prevStart.getTime(), endMs: prevEnd.getTime() } : null, [prevStart, prevEnd]);

  const empName = (e: any) => `${e?.firstName || ''} ${e?.lastName || ''}`.trim() || 'Sin nombre';
  const empDept = (e: any) => (typeof e?.department === 'object' && e?.department?.name) || 'Gral';
  const empPos = (e: any) => (typeof e?.position === 'object' && e?.position?.title) || '—';
  const empSuc = (e: any) => e?.sucursal || e?.branchName || e?.branch?.name || '';

  // ── Filtros ──
  const filterOptions = useMemo(() => {
    const depts = Array.from(new Set(employees.map(empDept))).sort();
    const positions = Array.from(new Set(employees.map(empPos).filter(p => p !== '—'))).sort();
    const contracts = Array.from(new Set(employees.map(e => CONTRACT_LABELS[e.contractType] || e.contractType).filter(Boolean))).sort();
    return { depts, positions, contracts };
  }, [employees]);

  const fEmployees = useMemo(() => employees.filter(e =>
    (fDept === 'all' || empDept(e) === fDept) &&
    (fPos === 'all' || empPos(e) === fPos) &&
    (fContract === 'all' || (CONTRACT_LABELS[e.contractType] || e.contractType) === fContract) &&
    (fStatus === 'all' || e.employmentStatus === fStatus)
  ), [employees, fDept, fPos, fContract, fStatus]);

  const fEmpIds = useMemo(() => new Set(fEmployees.map(e => e.id).filter(Boolean)), [fEmployees]);

  const fPayrolls = useMemo(() => payrolls.filter(p => fEmpIds.has(p.employeeId || p.employee?.id)), [payrolls, fEmpIds]);
  const fLeaves = useMemo(() => leaves.filter(l => fEmpIds.has(l.employeeId || l.employee?.id)), [leaves, fEmpIds]);
  const fAttendance = useMemo(() => attendances.filter(a => fEmpIds.has(a.employeeId || a.employee?.id)), [attendances, fEmpIds]);
  const fVacations = useMemo(() => vacations.filter(v => fEmpIds.has(v.employeeId || v.employee?.id)), [vacations, fEmpIds]);
  const fReviews = useMemo(() => reviews.filter(r => fEmpIds.has(r.employeeId || r.employee?.id)), [reviews, fEmpIds]);
  const fDocuments = useMemo(() => documents.filter(d => fEmpIds.has(d.employeeId || d.employee?.id)), [documents, fEmpIds]);
  const fBenefits = useMemo(() => benefits.map(b => ({
    ...b,
    employeeBenefits: (b.employeeBenefits || []).filter((eb: any) => fEmpIds.has(eb.employeeId || eb.employee?.id)),
  })), [benefits, fEmpIds]);
  const fTrainings = useMemo(() => trainings.map(t => ({
    ...t,
    enrollments: (t.enrollments || []).filter((en: any) => fEmpIds.has(en.employeeId || en.employee?.id)),
  })), [trainings, fEmpIds]);

  const employeesById = useMemo(() => {
    const m = new Map<string, any>();
    fEmployees.forEach(e => m.set(e.id, e));
    return m;
  }, [fEmployees]);

  // ── Fuerza laboral ──
  const activeEmployees = useMemo(() => fEmployees.filter(e => e.employmentStatus === 'ACTIVE' || !e.employmentStatus), [fEmployees]);
  const altasPeriodo = useMemo(() => fEmployees.filter(e => isDateInRange(e.hireDate, dateRange)), [fEmployees, dateRange]);
  const bajasPeriodo = useMemo(() => fEmployees.filter(e => isDateInRange(e.terminationDate, dateRange)), [fEmployees, dateRange]);
  const variacion = altasPeriodo.length - bajasPeriodo.length;

  const plantillaInicio = useMemo(() => {
    const s = currentStart.getTime();
    return fEmployees.filter(e => {
      const hire = toDate(e.hireDate);
      if (!hire || hire.getTime() > s) return false;
      const term = toDate(e.terminationDate);
      return !term || term.getTime() >= s;
    });
  }, [fEmployees, currentStart]);

  const plantillaPromedio = (plantillaInicio.length + activeEmployees.length) / 2;
  const tasaRotacion = plantillaPromedio > 0 ? (bajasPeriodo.length / plantillaPromedio) * 100 : 0;
  const muestraInsuficiente = plantillaPromedio < 3;

  const prevAltas = prevWin ? fEmployees.filter(e => isDateInWindow(e.hireDate, prevWin.startMs, prevWin.endMs)).length : 0;
  const prevBajas = prevWin ? fEmployees.filter(e => isDateInWindow(e.terminationDate, prevWin.startMs, prevWin.endMs)).length : 0;
  const prevTasaRotacion = prevWin ? (() => {
    const ini = fEmployees.filter(e => {
      const hire = toDate(e.hireDate);
      if (!hire || hire.getTime() > prevWin.startMs) return false;
      const term = toDate(e.terminationDate);
      return !term || term.getTime() >= prevWin.startMs;
    }).length;
    const promedio = (ini + activeEmployees.length) / 2;
    return promedio > 0 ? (prevBajas / promedio) * 100 : 0;
  })() : 0;

  const rotacionPorDept = useMemo(() => {
    const map = new Map<string, { bajas: number; ini: number; fin: number }>();
    for (const e of fEmployees) {
      const dept = empDept(e);
      const cur = map.get(dept) || { bajas: 0, ini: 0, fin: 0 };
      if ((e.employmentStatus === 'ACTIVE' || !e.employmentStatus)) cur.fin++;
      if (isDateInRange(e.terminationDate, dateRange)) cur.bajas++;
      const hire = toDate(e.hireDate);
      if (hire && hire.getTime() <= currentStart.getTime()) {
        const term = toDate(e.terminationDate);
        if (!term || term.getTime() >= currentStart.getTime()) cur.ini++;
      }
      map.set(dept, cur);
    }
    return Array.from(map.entries()).map(([name, v]) => {
      const promedio = (v.ini + v.fin) / 2;
      return { name, bajas: v.bajas, promedio, tasa: promedio > 0 ? (v.bajas / promedio) * 100 : 0 };
    }).filter(d => d.bajas > 0).sort((a, b) => b.tasa - a.tasa).slice(0, 5);
  }, [fEmployees, dateRange, currentStart]);

  // ── Costo de nómina ──
  const sourceRate = (rate?: number) => valuationMode === 'CURRENT' ? exchangeRate : (rate || exchangeRate);
  const payrollBase = (p: any, field: string, baseField: string) =>
    toBaseAmount(Number(p[field] ?? p[baseField] ?? 0), p.currency, sourceRate(p.exchangeRate));

  const employerCost = (p: any) => {
    if (p.costoTotalEmpresa !== null && p.costoTotalEmpresa !== undefined) return payrollBase(p, 'costoTotalEmpresa', 'costoTotalEmpresaBase');
    return payrollBase(p, 'grossPay', 'grossPayBase')
      + payrollBase(p, 'inssPatronal', 'inssPatronalBase')
      + payrollBase(p, 'inatec', 'inatecBase')
      + payrollBase(p, 'trecenoMes', 'trecenoMesBase')
      + payrollBase(p, 'vacacionesProv', 'vacacionesProvBase')
      + payrollBase(p, 'indemnizacion', 'indemnizacionBase');
  };

  const sumTotals = (list: any[]) => {
    let salario = 0, horasExtra = 0, comisiones = 0, cargas = 0, prestaciones = 0, deducciones = 0, neto = 0, total = 0;
    const emps = new Set<string>();
    for (const p of list) {
      salario += payrollBase(p, 'baseSalary', 'baseSalaryBase');
      horasExtra += payrollBase(p, 'overtime', 'overtimeBase');
      comisiones += payrollBase(p, 'commissionsSales', 'commissionsSalesBase') + payrollBase(p, 'bonuses', 'bonusesBase');
      cargas += payrollBase(p, 'inssPatronal', 'inssPatronalBase') + payrollBase(p, 'inatec', 'inatecBase');
      prestaciones += payrollBase(p, 'trecenoMes', 'trecenoMesBase') + payrollBase(p, 'vacacionesProv', 'vacacionesProvBase') + payrollBase(p, 'indemnizacion', 'indemnizacionBase');
      deducciones += payrollBase(p, 'deductions', 'deductionsBase') + payrollBase(p, 'ir', 'irBase') + payrollBase(p, 'inssLaboral', 'inssLaboralBase');
      neto += payrollBase(p, 'netPay', 'netPayBase');
      total += employerCost(p);
      if (p.employeeId || p.employee?.id) emps.add(p.employeeId || p.employee.id);
    }
    return { salario, horasExtra, comisiones, cargas, prestaciones, deducciones, neto, total, empleados: emps.size };
  };

  const fPay = useMemo(() => fPayrolls.filter(p => {
    const d = toDate(p.periodEnd || p.paymentDate || p.createdAt);
    return d && d >= currentStart;
  }), [fPayrolls, currentStart]);

  const payrollTotals = useMemo(() => sumTotals(fPay), [fPay]);
  const costoPorColaborador = payrollTotals.empleados > 0 ? payrollTotals.total / payrollTotals.empleados : 0;

  const prevPayrollTotals = useMemo(() => prevWin ? sumTotals(fPayrolls.filter(p => isDateInWindow(p.periodEnd || p.paymentDate || p.createdAt, prevWin.startMs, prevWin.endMs))) : sumTotals([]), [fPayrolls, prevWin]);
  const prevCostoPorColaborador = prevPayrollTotals.empleados > 0 ? prevPayrollTotals.total / prevPayrollTotals.empleados : 0;

  const costoPorEmp = useMemo(() => {
    const fallback = new Map<string, string>();
    for (const p of payrolls) {
      const id = p.employeeId || p.employee?.id;
      if (id && p.employee) fallback.set(id, `${p.employee.firstName || ''} ${p.employee.lastName || ''}`.trim() || 'Sin nombre');
    }
    const map = new Map<string, number>();
    for (const p of fPay) {
      const id = p.employeeId || p.employee?.id;
      if (id) map.set(id, (map.get(id) || 0) + employerCost(p));
    }
    return Array.from(map.entries()).map(([id, total]) => {
      const emp = employeesById.get(id);
      return { id, name: emp ? empName(emp) : (fallback.get(id) || 'Sin nombre'), dept: emp ? empDept(emp) : '—', total };
    }).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [fPay, employeesById, payrolls]);

  const prevCostByDept = useMemo(() => {
    const map = new Map<string, number>();
    if (prevWin) {
      for (const p of fPayrolls) {
        const t = toDate(p.periodEnd || p.paymentDate || p.createdAt)?.getTime() || 0;
        if (t < prevWin.startMs || t > prevWin.endMs) continue;
        const emp = p.employeeId ? employeesById.get(p.employeeId) : null;
        const dept = emp ? empDept(emp) : 'Sin departamento';
        map.set(dept, (map.get(dept) || 0) + employerCost(p));
      }
    }
    return map;
  }, [fPayrolls, prevWin, employeesById]);

  const costByDept = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of fPay) {
      const emp = p.employeeId ? employeesById.get(p.employeeId) : null;
      const dept = emp ? empDept(emp) : 'Sin departamento';
      map.set(dept, (map.get(dept) || 0) + employerCost(p));
    }
    const total = payrollTotals.total || 1;
    return Array.from(map.entries()).map(([name, totalC]) => ({
      name,
      total: totalC,
      pct: (totalC / total) * 100,
      prev: prevCostByDept.get(name) || 0,
    })).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [fPay, employeesById, payrollTotals.total, prevCostByDept]);

  // ── Asistencia y ausentismo ──
  const attendancePeriod = useMemo(() => fAttendance.filter(a => isDateInRange(a.date, dateRange)), [fAttendance, dateRange]);
  const approvedLeaves = useMemo(() => fLeaves.filter(l => l.status === 'APPROVED' && isDateInRange(l.startDate, dateRange)), [fLeaves, dateRange]);

  const attStatsOf = (list: any[]) => {
    let present = 0, absent = 0, late = 0, remote = 0, half = 0;
    for (const a of list) {
      if (a.status === 'PRESENT') present++;
      else if (a.status === 'ABSENT') absent++;
      else if (a.status === 'LATE') late++;
      else if (a.status === 'REMOTE') remote++;
      else if (a.status === 'HALF_DAY') half++;
    }
    const total = list.length;
    const rate = total > 0 ? ((present + remote + half * 0.5) / total) * 100 : null;
    return { present, absent, late, remote, half, total, rate };
  };

  const attStats = useMemo(() => attStatsOf(attendancePeriod), [attendancePeriod]);
  const prevAttStats = useMemo(() => prevWin ? attStatsOf(fAttendance.filter(a => isDateInWindow(a.date, prevWin.startMs, prevWin.endMs))) : attStatsOf([]), [fAttendance, prevWin]);

  const estimated = attStats.total === 0;
  const attendanceRate = attStats.rate ?? (() => {
    const missed = approvedLeaves.filter(l => l.leaveType !== 'VACATION').reduce((a, l) => a + Number(l.days || 0), 0);
    const spanDays = Math.max(1, Math.round((now.getTime() - currentStart.getTime()) / 86400000));
    const potential = activeEmployees.length * spanDays;
    return potential > 0 ? Math.max(0, (1 - missed / potential) * 100) : 100;
  })();

  const ausentismoPorTipo = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of approvedLeaves) {
      const key = LEAVE_LABELS[l.leaveType] || l.leaveType || 'Otro';
      map[key] = (map[key] || 0) + Number(l.days || 0);
    }
    return map;
  }, [approvedLeaves]);

  const ausentismoDias = approvedLeaves.reduce((a, l) => a + Number(l.days || 0), 0) + attStats.absent;
  const spanDias = Math.max(1, Math.round((now.getTime() - currentStart.getTime()) / 86400000));
  const ausentismoRate = activeEmployees.length > 0 ? (ausentismoDias / (activeEmployees.length * spanDias)) * 100 : 0;
  const prevAusentismoDias = useMemo(() => prevWin ? (fLeaves.filter(l => l.status === 'APPROVED' && isDateInWindow(l.startDate, prevWin.startMs, prevWin.endMs)).reduce((a, l) => a + Number(l.days || 0), 0) + prevAttStats.absent) : 0, [fLeaves, prevWin, prevAttStats]);

  const topIncidencia = useMemo(() => {
    const map = new Map<string, { name: string; days: number }>();
    for (const l of approvedLeaves) {
      const id = l.employeeId || l.employee?.id;
      if (!id) continue;
      const cur = map.get(id) || { name: empName(l.employee), days: 0 };
      cur.days += Number(l.days || 0);
      map.set(id, cur);
    }
    for (const a of attendancePeriod) {
      if (a.status !== 'ABSENT') continue;
      const id = a.employeeId || a.employee?.id;
      if (!id) continue;
      const cur = map.get(id) || { name: empName(a.employee), days: 0 };
      cur.days += 1;
      map.set(id, cur);
    }
    return Array.from(map.values()).sort((x, y) => y.days - x.days).slice(0, 5);
  }, [approvedLeaves, attendancePeriod]);

  // ── Antigüedad ──
  const antiquity = useMemo(() => {
    const list = activeEmployees.map(e => {
      const d = toDate(e.hireDate);
      const months = d ? (now.getTime() - d.getTime()) / 2629746000 : 0;
      const anni = d ? nextAnniversary(d, now) : null;
      return { id: e.id, name: empName(e), hireDate: d, months, dept: empDept(e), pos: empPos(e), contract: CONTRACT_LABELS[e.contractType] || e.contractType || '—', anni };
    }).sort((a, b) => b.months - a.months);
    const avgMonths = list.length > 0 ? list.reduce((a, r) => a + r.months, 0) / list.length : 0;
    return { list, avgMonths };
  }, [activeEmployees, now]);

  // ── Evolución del costo de nómina ──
  const evoBuckets = useMemo(() => {
    const pays = fPay.slice().sort((a, b) => (toDate(a.periodEnd)?.getTime() || 0) - (toDate(b.periodEnd)?.getTime() || 0));
    if (pays.length === 0) return [];
    const first = toDate(pays[0].periodEnd)?.getTime() || currentStart.getTime();
    const last = toDate(pays[pays.length - 1].periodEnd)?.getTime() || now.getTime();
    if (last < first) return [];
    const buckets = makeBuckets(new Date(first), new Date(last));
    const prevByKey = new Map<string, number>();
    if (prevWin) {
      for (const p of fPayrolls) {
        const t = toDate(p.periodEnd || p.paymentDate || p.createdAt)?.getTime() || 0;
        if (t < prevWin.startMs || t > prevWin.endMs) continue;
        for (const b of buckets) {
          if (t >= b.startMs && t <= b.endMs) {
            prevByKey.set(b.key, (prevByKey.get(b.key) || 0) + employerCost(p));
            break;
          }
        }
      }
    }
    return buckets.map(b => {
      const rows = pays.filter(p => {
        const t = toDate(p.periodEnd)?.getTime() || 0;
        return t >= b.startMs && t <= b.endMs;
      });
      let salario = 0, horasExtra = 0, comisiones = 0, cargas = 0, prestaciones = 0, total = 0;
      for (const p of rows) {
        salario += payrollBase(p, 'baseSalary', 'baseSalaryBase');
        horasExtra += payrollBase(p, 'overtime', 'overtimeBase');
        comisiones += payrollBase(p, 'commissionsSales', 'commissionsSalesBase') + payrollBase(p, 'bonuses', 'bonusesBase');
        cargas += payrollBase(p, 'inssPatronal', 'inssPatronalBase') + payrollBase(p, 'inatec', 'inatecBase');
        prestaciones += payrollBase(p, 'trecenoMes', 'trecenoMesBase') + payrollBase(p, 'vacacionesProv', 'vacacionesProvBase') + payrollBase(p, 'indemnizacion', 'indemnizacionBase');
        total += employerCost(p);
      }
      return { key: b.key, label: b.label, salario, variables: horasExtra + comisiones + prestaciones, cargas, total, prev: prevByKey.get(b.key) ?? null };
    });
  }, [fPay, fPayrolls, currentStart, now, prevWin]);

  // ── Movimientos ──
  const movBuckets = useMemo(() => {
    const dates: number[] = [];
    for (const e of fEmployees) {
      const h = toDate(e.hireDate)?.getTime();
      const t = toDate(e.terminationDate)?.getTime();
      if (h && h >= currentStart.getTime()) dates.push(h);
      if (t && t >= currentStart.getTime() && t <= now.getTime()) dates.push(t);
    }
    if (dates.length === 0) return [];
    const first = Math.min(...dates, currentStart.getTime());
    const last = Math.max(...dates, now.getTime());
    const buckets = makeBuckets(new Date(first), new Date(last));
    let running = plantillaInicio.length;
    return buckets.map(b => {
      let altas = 0, bajas = 0;
      for (const e of fEmployees) {
        const h = toDate(e.hireDate)?.getTime() || 0;
        const t = toDate(e.terminationDate)?.getTime() || 0;
        if (h >= b.startMs && h <= b.endMs) altas++;
        if (t >= b.startMs && t <= b.endMs) bajas++;
      }
      running += altas - bajas;
      return { key: b.key, label: b.label, altas, bajas, plantilla: running };
    });
  }, [fEmployees, currentStart, now, plantillaInicio]);

  const movEvents = useMemo(() => {
    const events: { date: Date; name: string; dept: string; type: 'Alta' | 'Baja'; motivo: string; trabajado: string; plantilla: number }[] = [];
    for (const e of fEmployees) {
      const h = toDate(e.hireDate);
      if (h && h.getTime() >= currentStart.getTime()) {
        events.push({ date: h, name: empName(e), dept: empDept(e), type: 'Alta', motivo: e.notes || 'Ingreso', trabajado: '', plantilla: 0 });
      }
      const t = toDate(e.terminationDate);
      if (t && t.getTime() >= currentStart.getTime() && t.getTime() <= now.getTime()) {
        const worked = h ? (t.getTime() - h.getTime()) / 2629746000 : 0;
        events.push({ date: t, name: empName(e), dept: empDept(e), type: 'Baja', motivo: e.notes || 'Baja registrada', trabajado: `Trabajó ${fmtTenure(worked)}`, plantilla: 0 });
      }
    }
    events.sort((a, b) => a.date.getTime() - b.date.getTime());
    let running = plantillaInicio.length;
    return events.map(ev => {
      running += ev.type === 'Alta' ? 1 : -1;
      return { ...ev, plantilla: running };
    });
  }, [fEmployees, currentStart, now, plantillaInicio]);

  const attBuckets = useMemo(() => {
    if (attendancePeriod.length === 0) return [];
    const times = attendancePeriod.map(a => toDate(a.date)?.getTime() || 0).filter(Boolean);
    const first = Math.min(...times, currentStart.getTime());
    const last = Math.max(...times, now.getTime());
    const buckets = makeBuckets(new Date(first), new Date(last));
    return buckets.map(b => {
      let present = 0, absent = 0, late = 0;
      for (const a of attendancePeriod) {
        const t = toDate(a.date)?.getTime() || 0;
        if (t < b.startMs || t > b.endMs) continue;
        if (a.status === 'PRESENT') present++;
        else if (a.status === 'ABSENT') absent++;
        else if (a.status === 'LATE') late++;
      }
      return { key: b.key, label: b.label, present, absent, late };
    });
  }, [attendancePeriod, currentStart, now]);

  // ── Distribución de la plantilla ──
  const distribution = useMemo(() => {
    const keyOf = (e: any): string => {
      if (distKey === 'cargo') return empPos(e);
      if (distKey === 'contrato') return CONTRACT_LABELS[e.contractType] || e.contractType || '—';
      if (distKey === 'sucursal') return empSuc(e) || 'Sin sucursal';
      return empDept(e);
    };
    const costByEmp = new Map<string, number>();
    for (const p of fPay) {
      const id = p.employeeId || p.employee?.id;
      if (id) costByEmp.set(id, (costByEmp.get(id) || 0) + employerCost(p));
    }
    const map = new Map<string, { count: number; salary: number; cost: number; emps: any[] }>();
    for (const e of activeEmployees) {
      const k = keyOf(e);
      const cur = map.get(k) || { count: 0, salary: 0, cost: 0, emps: [] };
      cur.count += 1;
      cur.salary += Number(e.salary || 0);
      cur.cost += costByEmp.get(e.id) || 0;
      cur.emps.push(e);
      map.set(k, cur);
    }
    const items = Array.from(map.entries()).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.count - a.count);
    const total = activeEmployees.length || 1;
    return {
      items: items.map(i => ({
        ...i,
        pctPlantilla: (i.count / total) * 100,
        pctCosto: payrollTotals.total > 0 ? (i.cost / payrollTotals.total) * 100 : 0,
      })),
      total: activeEmployees.length,
      sinSucursal: distKey === 'sucursal' && items.length === 1 && items[0]?.name === 'Sin sucursal',
    };
  }, [activeEmployees, distKey, fPay, payrollTotals.total]);

  // ── Vacaciones ──
  const vacStats = useMemo(() => {
    const totals = { acumulado: 0, usado: 0, pendiente: 0 };
    const rows: { name: string; remaining: number; total: number; empId: string }[] = [];
    let inconsistentes = 0;
    let disponibles = 0;
    for (const v of fVacations) {
      totals.acumulado += Number(v.totalDays || 0);
      totals.usado += Number(v.usedDays || 0);
      const rem = Number(v.remainingDays ?? v.pendingDays ?? 0);
      totals.pendiente += rem;
      if (rem < 0) inconsistentes++;
      if (rem > 0) disponibles++;
      rows.push({ name: empName(v.employee), remaining: rem, total: Number(v.totalDays || 0), empId: v.employeeId || v.employee?.id || '' });
    }
    return {
      ...totals,
      inconsistentes,
      disponibles,
      topSaldo: rows.slice().sort((a, b) => b.remaining - a.remaining).slice(0, 5),
      todos: rows.slice().sort((a, b) => b.remaining - a.remaining),
    };
  }, [fVacations]);

  const vacProximas = useMemo(() => fLeaves.filter(l => l.leaveType === 'VACATION' && l.status === 'APPROVED' && isDateInRange(l.startDate, 'hoy'))
    .sort((a, b) => (toDate(a.startDate)?.getTime() || 0) - (toDate(b.startDate)?.getTime() || 0)), [fLeaves]);
  const vacProximas30 = useMemo(() => vacProximas.filter(v => {
    const t = toDate(v.startDate)?.getTime() || 0;
    return t <= now.getTime() + 30 * 86400000;
  }), [vacProximas, now]);
  const fueraAhora = useMemo(() => vacProximas.filter(v => {
    const s = toDate(v.startDate)?.getTime() || 0;
    const e = toDate(v.endDate)?.getTime() || 0;
    return s <= now.getTime() && e >= now.getTime();
  }), [vacProximas, now]);

  // ── Desempeño ──
  const perfStats = useMemo(() => {
    const completed = fReviews.filter(r => r.status === 'COMPLETED');
    const pending = fReviews.filter(r => r.status === 'DRAFT' || r.status === 'IN_PROGRESS');
    const avg = completed.length > 0 ? completed.reduce((a, r) => a + Number(r.overallRating || 0), 0) / completed.length : 0;
    const destacados = completed.slice().sort((a, b) => (Number(b.overallRating || 0)) - (Number(a.overallRating || 0))).slice(0, 5);
    const withTarget = kpiResults.filter(r => r.target != null);
    const met = withTarget.filter(r => Number(r.actual || 0) >= Number(r.target)).length;
    const cumplimiento = withTarget.length > 0 ? (met / withTarget.length) * 100 : null;
    return { total: fReviews.length, completed: completed.length, pending: pending.length, avg, destacados, cumplimiento, seguimiento: pending.slice(0, 5), todosPendientes: pending };
  }, [fReviews, kpiResults]);

  // ── Capacitación ──
  const trainStats = useMemo(() => {
    const activas = fTrainings.filter(t => t.status === 'SCHEDULED' || t.status === 'IN_PROGRESS');
    const allEnroll = fTrainings.flatMap(t => (t.enrollments || []));
    const completed = allEnroll.filter((en: any) => en.status === 'COMPLETED').length;
    const rate = allEnroll.length > 0 ? (completed / allEnroll.length) * 100 : 0;
    const participantes = new Set(allEnroll.map((en: any) => en.employeeId || en.employee?.id).filter(Boolean)).size;
    const costo = activas.reduce((a, t) => a + toBaseAmount(Number(t.cost ?? t.baseCost ?? 0), t.currency, sourceRate(t.exchangeRate)), 0);
    const pendientesEnroll = allEnroll.filter((en: any) => en.status === 'SCHEDULED');
    const horas = activas.reduce((a, t) => {
      const s = toDate(t.startDate)?.getTime() || 0;
      const e = toDate(t.endDate)?.getTime() || 0;
      if (!s || !e) return a;
      const days = Math.max(1, Math.round((e - s) / 86400000) + 1);
      const laborDays = Math.round(days * 5 / 7);
      return a + laborDays * 8;
    }, 0);
    const vencidas = fTrainings.filter(t => { const e = toDate(t.endDate); return !!e && e.getTime() < now.getTime() && (t.status === 'SCHEDULED' || t.status === 'IN_PROGRESS'); }).length;
    return { activas: activas.length, participantes, rate, costo, pendientes: pendientesEnroll.length, horas, vencidas, pendientesEnroll };
  }, [fTrainings, now]);

  // ── Documentación ──
  const docStats = useMemo(() => {
    const hoy = now.getTime();
    const vencidos = fDocuments.filter(d => { const t = toDate(d.expiryDate)?.getTime(); return t !== undefined && t !== null && t < hoy; });
    const proximos = fDocuments.filter(d => {
      const t = toDate(d.expiryDate)?.getTime() || 0;
      return t >= hoy && t - hoy <= 60 * 86400000;
    });
    const conDoc = new Set(fDocuments.map(d => d.employeeId || d.employee?.id).filter(Boolean));
    const sinExpediente = activeEmployees.filter(e => !conDoc.has(e.id));
    return { total: fDocuments.length, vencidos: vencidos.length, proximos: proximos.length, completa: activeEmployees.length - sinExpediente.length, pendiente: sinExpediente.length, vencidosList: vencidos.slice(0, 6), todos: [...vencidos, ...proximos] };
  }, [fDocuments, activeEmployees, now]);

  // ── Beneficios ──
  const benStats = useMemo(() => {
    const beneficiados = new Set(fBenefits.flatMap(b => (b.employeeBenefits || []).map((eb: any) => eb.employeeId || eb.employee?.id)).filter(Boolean)).size;
    const costo = fBenefits.reduce((a, b) => a + toBaseAmount(Number(b.cost ?? b.baseCost ?? 0), b.currency, sourceRate(b.exchangeRate)), 0);
    const sinAsignacion = fBenefits.filter(b => !b.employeeBenefits || b.employeeBenefits.length === 0);
    const byType = new Map<string, number>();
    for (const b of fBenefits) byType.set(b.type || 'Otro', (byType.get(b.type || 'Otro') || 0) + (b.employeeBenefits?.length || 0));
    return { activos: fBenefits.length, beneficiados, costo, sinAsignacion: sinAsignacion.length, byType: Array.from(byType.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5) };
  }, [fBenefits]);

  // ── Insights ──
  const insights = useMemo(() => {
    const list: { text: string; tone: 'rojo' | 'naranja' | 'azul' | 'verde' }[] = [];
    if (prevPayrollTotals.total > 0) {
      const v = pctVar(payrollTotals.total, prevPayrollTotals.total);
      list.push({
        text: `La nómina ${v >= 0 ? 'aumentó' : 'disminuyó'} ${Math.abs(v).toFixed(1)}% respecto al período anterior (${fmtMoney(prevPayrollTotals.total)} → ${fmtMoney(payrollTotals.total)}).`,
        tone: v >= 0 ? 'rojo' : 'verde',
      });
    }
    if (costByDept.length > 0 && payrollTotals.total > 0) {
      const top = costByDept[0];
      list.push({ text: `${top.name} concentra el ${top.pct.toFixed(1)}% del costo laboral del período.`, tone: 'azul' });
    }
    if (perfStats.pending > 0) {
      list.push({ text: `Hay ${perfStats.pending} evaluación(es) de desempeño sin completar.`, tone: 'naranja' });
    } else if (perfStats.total > 0) {
      list.push({ text: 'No hay evaluaciones de desempeño pendientes.', tone: 'verde' });
    }
    if (vacProximas30.length > 0) {
      list.push({ text: `${vacProximas30.length} colaborador(es) con vacaciones aprobadas en los próximos 30 días.`, tone: 'naranja' });
    }
    if (vacStats.inconsistentes > 0) {
      list.push({ text: `${vacStats.inconsistentes} saldo(s) de vacaciones inconsistentes (negativos).`, tone: 'rojo' });
    }
    if (docStats.pendiente > 0) {
      list.push({ text: `${docStats.pendiente} colaborador(es) sin expediente documental completo.`, tone: 'rojo' });
    } else if (docStats.vencidos > 0) {
      list.push({ text: `${docStats.vencidos} documento(s) vencido(s).`, tone: 'rojo' });
    }
    if (tasaRotacion > 0) {
      list.push({
        text: `La rotación (${tasaRotacion.toFixed(1)}%) ${tasaRotacion > 10 ? 'supera el objetivo (10%)' : 'se mantiene dentro del objetivo (10%)'}.`,
        tone: tasaRotacion > 10 ? 'rojo' : 'verde',
      });
    }
    if (ausentismoRate > 0) {
      list.push({
        text: `Ausentismo ${ausentismoRate > 5 ? 'elevado' : 'bajo'}: ${ausentismoDias} día(s) en el período (${ausentismoRate.toFixed(1)}%).`,
        tone: ausentismoRate > 5 ? 'rojo' : 'verde',
      });
    }
    if (trainStats.vencidas > 0) {
      list.push({ text: `${trainStats.vencidas} capacitación(es) vencida(s) sin completar.`, tone: 'naranja' });
    }
    const order = { rojo: 0, naranja: 1, azul: 2, verde: 3 };
    return list.slice().sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 6);
  }, [prevPayrollTotals.total, payrollTotals.total, costByDept, perfStats, vacProximas30, vacStats.inconsistentes, docStats, tasaRotacion, ausentismoRate, ausentismoDias, trainStats.vencidas]);

  // ── Modals ──
  const openAltasModal = () => {
    setModal({
      title: 'Altas del período',
      desc: `Incorporaciones del período (${dateRange}). Total: ${altasPeriodo.length}${prevAltas > 0 ? ` · Período anterior: ${prevAltas}` : ''}`,
      rows: altasPeriodo.slice().sort((a, b) => (toDate(b.hireDate)?.getTime() || 0) - (toDate(a.hireDate)?.getTime() || 0)).slice(0, 20).map(e => ({
        label: empName(e), sub: empDept(e) + ' · ' + empPos(e), right: toDate(e.hireDate)?.toLocaleDateString('es-NI') || '—',
      })),
    });
  };
  const openBajasModal = () => {
    setModal({
      title: 'Bajas del período',
      desc: `Colaboradores con fecha de baja en el período. Total: ${bajasPeriodo.length}${prevBajas > 0 ? ` · Período anterior: ${prevBajas}` : ''}`,
      rows: bajasPeriodo.slice().sort((a, b) => (toDate(b.terminationDate)?.getTime() || 0) - (toDate(a.terminationDate)?.getTime() || 0)).slice(0, 20).map(e => {
        const h = toDate(e.hireDate);
        const t = toDate(e.terminationDate);
        const worked = h && t ? (t.getTime() - h.getTime()) / 2629746000 : 0;
        return { label: empName(e), sub: `${empDept(e)} · Trabajó ${fmtTenure(worked)}`, right: toDate(e.terminationDate)?.toLocaleDateString('es-NI') || '—' };
      }),
    });
  };
  const openRotacionModal = () => {
    setModal({
      title: 'Rotación de personal',
      desc: `Tasa: ${tasaRotacion.toFixed(1)}% · Fórmula: bajas del período (${bajasPeriodo.length}) ÷ plantilla promedio (${plantillaPromedio.toFixed(0)}) × 100${muestraInsuficiente ? ' · Muestra insuficiente para concluir (plantilla promedio < 3)' : ''}${prevTasaRotacion > 0 ? ` · Período anterior: ${prevTasaRotacion.toFixed(1)}%` : ''}`,
      rows: rotacionPorDept.map(d => ({ label: d.name, sub: `${d.bajas} bajas · plantilla promedio ${d.promedio.toFixed(0)}`, right: `${d.tasa.toFixed(1)}%`, rightClass: 'text-amber-400' })),
    });
  };
  const openAusentismoModal = () => {
    setModal({
      title: 'Ausentismo del período',
      desc: `Días perdidos: ${ausentismoDias} (justificados ${approvedLeaves.reduce((a, l) => a + Number(l.days || 0), 0)} · ausencias ${attStats.absent} · tardanzas ${attStats.late})${prevAusentismoDias > 0 ? ` · Período anterior: ${prevAusentismoDias}` : ''}`,
      rows: [
        ...Object.entries(ausentismoPorTipo).map(([k, v]) => ({ label: k, right: `${v} ${v === 1 ? 'día' : 'días'}` })),
        ...topIncidencia.map(t => ({ label: t.name, sub: 'Mayor incidencia', right: `${t.days} ${t.days === 1 ? 'día' : 'días'}` })),
      ],
    });
  };
  const openVacacionesModal = () => {
    setModal({
      title: 'Vacaciones',
      desc: `Acumuladas: ${vacStats.acumulado} · Usadas: ${vacStats.usado} · Pendientes: ${vacStats.pendiente} ${vacStats.inconsistentes > 0 ? `· Inconsistencias: ${vacStats.inconsistentes}` : ''}`,
      rows: vacStats.topSaldo.map(v => ({ label: v.name, right: `${v.remaining} días`, rightClass: v.remaining >= 0 ? 'text-emerald-400' : 'text-red-400' })),
    });
  };
  const openVacacionesAllModal = () => {
    setModal({
      title: 'Saldo de vacaciones',
      desc: `Todos los saldos del año vigente · Pendientes totales: ${vacStats.pendiente} días`,
      rows: vacStats.todos.slice(0, 30).map(v => ({ label: v.name, sub: `Acumulado anual: ${v.total} días`, right: `${v.remaining} días`, rightClass: v.remaining >= 0 ? 'text-emerald-400' : 'text-red-400' })),
    });
  };
  const openSeguimientoModal = () => {
    setModal({
      title: 'Evaluaciones pendientes',
      desc: `Requieren seguimiento: ${perfStats.pending}`,
      rows: perfStats.todosPendientes.slice(0, 30).map(r => ({ label: empName(r.employee), sub: r.status === 'DRAFT' ? 'Borrador' : 'En progreso', right: 'Pendiente', rightClass: 'text-amber-400' })),
    });
  };
  const openTrainPendientesModal = () => {
    setModal({
      title: 'Capacitaciones pendientes de cursar',
      desc: `Inscripciones sin completar: ${trainStats.pendientes}`,
      rows: trainStats.pendientesEnroll.slice(0, 30).map((en: any) => ({ label: empName(en.employee), sub: `Capacitación: ${en.training?.title || '—'}`, right: 'Pendiente', rightClass: 'text-amber-400' })),
    });
  };
  const openDocsModal = () => {
    const hoy = now.getTime();
    setModal({
      title: 'Documentación por vencer o vencida',
      desc: `Vencidos: ${docStats.vencidos} · Próximos a vencer (60 días): ${docStats.proximos}`,
      rows: docStats.todos.slice(0, 30).map(d => {
        const t = toDate(d.expiryDate)?.getTime() || 0;
        const expired = t < hoy;
        return { label: d.title, sub: `${empName(d.employee)} · ${d.type || 'Documento'}`, right: toDate(d.expiryDate)?.toLocaleDateString('es-NI') || '—', rightClass: expired ? 'text-red-400' : 'text-amber-400', tag: expired ? 'VENCIDO' : 'POR VENCER' };
      }),
    });
  };
  const openActivosModal = () => {
    setModal({
      title: 'Colaboradores activos',
      desc: `Total: ${activeEmployees.length} · Plantilla total: ${fEmployees.length}`,
      rows: activeEmployees.slice(0, 25).map(e => ({
        label: empName(e), sub: empDept(e) + ' · ' + empPos(e), right: toDate(e.hireDate)?.toLocaleDateString('es-NI') || '—',
      })),
    });
  };
  const openSegmentModal = (name: string) => {
    const seg = distribution.items.find(i => i.name === name);
    setModal({
      title: `Colaboradores · ${name}`,
      desc: `${seg?.count || 0} colaboradores · ${seg?.pctPlantilla?.toFixed(1) || '0'}% de la plantilla · ${seg?.pctCosto ? `${seg.pctCosto.toFixed(1)}% del costo de nómina` : ''}`,
      rows: (seg?.emps || []).slice(0, 25).map(e => ({
        label: empName(e), sub: empPos(e) + ' · ' + (CONTRACT_LABELS[e.contractType] || e.contractType || '—'), right: toDate(e.hireDate)?.toLocaleDateString('es-NI') || '—',
      })),
    });
  };
  // ── Export PDF ──
  useImperativeHandle(ref, () => ({
    exportPDF: async () => {
      toast.info("Generando PDF (RRHH)...");
      try {
        const pdfSettings = await getPdfDesignSettings('reportes.hr');
        const doc = new jsPDF(pdfDesignPaper(pdfSettings));
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const companyName = themeConfig.tenantName || 'Mi Empresa';
        const primaryColor = pdfSettings.primaryColor || themeConfig.colors.primary || '#10b981';
        const primaryHex = primaryColor.startsWith('#') ? primaryColor : '#10b981';
        const rgbPrimary = primaryHex.startsWith('#')
          ? [parseInt(primaryHex.slice(1, 3), 16), parseInt(primaryHex.slice(3, 5), 16), parseInt(primaryHex.slice(5, 7), 16)]
          : [16, 185, 129];
        const marginX = 14;
        const contentWidth = pageWidth - marginX * 2;
        let currentY = 15;

        const checkPage = (needed: number) => {
          if (currentY + needed > pageHeight - 15) {
            doc.addPage();
            currentY = 20;
          }
        };

        if (themeConfig.logo) {
          const logoBase64 = await getBase64Image(themeConfig.logo);
          if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', (pageWidth - 30) / 2, currentY, 30, 30, undefined, 'FAST');
            currentY += 35;
          }
        }

        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(rgbPrimary[0] as any, rgbPrimary[1] as any, rgbPrimary[2] as any);
        doc.text(companyName, pageWidth / 2, currentY, { align: 'center' });
        currentY += 8;

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text('Reporte de Recursos Humanos', pageWidth / 2, currentY, { align: 'center' });
        currentY += 6;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text(`Generado: ${new Date().toLocaleDateString('es-NI')}  |  Moneda: ${displayCurrency}  |  Período: ${dateRange}`, pageWidth / 2, currentY, { align: 'center' });
        currentY += 5;

        doc.setDrawColor(rgbPrimary[0] as any, rgbPrimary[1] as any, rgbPrimary[2] as any);
        doc.setLineWidth(0.8);
        doc.line(marginX, currentY, pageWidth - marginX, currentY);
        currentY += 10;

        const kpis = [
          { label: 'ACTIVOS', value: activeEmployees.length.toString(), detail: `Plantilla: ${fEmployees.length}`, color: [59, 130, 246] },
          { label: `COSTO NÓMINA · ${valuationModeLabel}`, value: formatConvertedAmount(payrollTotals.total, 'NIO'), detail: `Período anterior: ${formatConvertedAmount(prevPayrollTotals.total, 'NIO')}`, color: [16, 185, 129] },
          { label: 'COSTO / COLAB.', value: formatConvertedAmount(costoPorColaborador, 'NIO'), detail: 'Promedio del período', color: [59, 130, 246] },
          { label: 'ASISTENCIA', value: `${attendanceRate.toFixed(1)}%`, detail: estimated ? 'Estimada por permisos' : `${attStats.present} presentes`, color: [16, 185, 129] },
          { label: 'ROTACIÓN', value: `${tasaRotacion.toFixed(1)}%`, detail: `${bajasPeriodo.length} bajas · ${plantillaPromedio.toFixed(0)} prom.`, color: [245, 158, 11] },
          { label: 'ANTIGÜEDAD', value: fmtTenure(antiquity.avgMonths), detail: 'Desde fecha de ingreso', color: [59, 130, 246] },
        ];

        const cols = 6;
        const boxW = (contentWidth - (cols - 1) * 3) / cols;
        const boxH = 22;
        checkPage(boxH + 5);
        kpis.forEach((kpi, idx) => {
          const x = marginX + idx * (boxW + 3);
          doc.setFillColor(kpi.color[0] as any, kpi.color[1] as any, kpi.color[2] as any);
          doc.roundedRect(x, currentY, boxW, boxH, 3, 3, 'F');
          doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
          doc.text(kpi.label, x + boxW / 2, currentY + 6, { align: 'center' });
          doc.setFontSize(9); doc.text(kpi.value, x + boxW / 2, currentY + 13, { align: 'center' });
          doc.setFontSize(6); doc.setFont('helvetica', 'normal');
          doc.text(kpi.detail, x + boxW / 2, currentY + 18.5, { align: 'center' });
        });
        currentY += boxH + 10;

        const exportIds = ['hr-evolution-chart', 'hr-movements-chart', 'hr-distribution-chart'];
        const capture = async (elementId: string, height: number) => {
          const el = document.getElementById(elementId);
          if (!el) return;
          checkPage(height + 15);
          try {
            const canvas = await html2canvas(el, {
              scale: 2,
              backgroundColor: '#09090b',
              onclone: (clonedDoc) => sanitizeHtml2CanvasOklch(exportIds, clonedDoc, primaryHex),
            });
            doc.addImage(canvas.toDataURL('image/png'), 'PNG', marginX, currentY, contentWidth, height, undefined, 'FAST');
            currentY += height + 5;
          } catch {}
        };

        await capture('hr-evolution-chart', 80);
        await capture('hr-movements-chart', 70);
        await capture('hr-distribution-chart', 75);

        const renderTable = (title: string, headers: string[], rows: (string | number)[][], widths: number[]) => {
          checkPage(40);
          doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 60);
          doc.text(title, marginX, currentY); currentY += 7;
          doc.setFillColor(245, 158, 11);
          doc.roundedRect(marginX, currentY, contentWidth, 8, 1, 1, 'F');
          doc.setFontSize(8); doc.setTextColor(255, 255, 255);
          let accX = marginX;
          headers.forEach((h, i) => {
            doc.text(h, accX + 3, currentY + 5.5);
            accX += widths[i];
          });
          currentY += 10;
          rows.forEach((row, i) => {
            checkPage(12);
            if (i % 2 === 0) { doc.setFillColor(248, 249, 250); doc.rect(marginX, currentY - 1, contentWidth, 7, 'F'); }
            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
            accX = marginX;
            row.forEach((cell, ci) => {
              doc.text(String(cell).substring(0, 28), accX + 3, currentY + 4);
              accX += widths[ci];
            });
            currentY += 7;
          });
          currentY += 10;
        };

        renderTable('Mayor Antigüedad',
          ['Colaborador', 'Ingreso', 'Antigüedad', 'Departamento', 'Cargo'],
          antiquity.list.slice(0, 8).map(r => [r.name, r.hireDate ? r.hireDate.toLocaleDateString('es-NI') : '—', fmtTenure(r.months), r.dept, r.pos]),
          [55, 35, 35, 40, 45]);

        renderTable('Vacaciones Pendientes',
          ['Colaborador', 'Días pendientes', '', ''],
          vacStats.topSaldo.map(v => [v.name, `${v.remaining}`, '', '']),
          [80, 40, 20, 20]);

        doc.save(`Reporte_RRHH_${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success("PDF generado exitosamente");
      } catch (e: any) {
        toast.error(e?.response?.data?.message || e?.message || "Error exportando PDF");
      }
    },
    exportExcel: async () => {
      toast.info("Generando Excel (RRHH)...");
      try {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('RRHH');
        const companyName = themeConfig.tenantName || 'Mi Empresa';
        const primaryColor = themeConfig.colors.primary || '#10b981';
        const hexColor = primaryColor.startsWith('#') ? primaryColor.replace('#', '') : '10b981';
        const primaryHex = primaryColor.startsWith('#') ? primaryColor : '#10b981';

        ws.getColumn(1).width = 30;
        ws.getColumn(2).width = 22;
        ws.getColumn(3).width = 22;
        ws.getColumn(4).width = 22;

        let currentRow = 1;

        if (themeConfig.logo) {
          const base64Logo = await getBase64Image(themeConfig.logo);
          if (base64Logo) {
            const logoId = wb.addImage({ base64: base64Logo, extension: 'png' });
            ws.addImage(logoId, { tl: { col: 1.5, row: 0 }, ext: { width: 100, height: 100 } });
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
        cTitle.value = 'Reporte de Recursos Humanos';
        cTitle.font = { size: 13, bold: true };
        cTitle.alignment = { horizontal: 'center' };
        currentRow++;

        ws.mergeCells(`A${currentRow}:D${currentRow}`);
        const cMeta = ws.getCell(`A${currentRow}`);
        cMeta.value = `Moneda: ${displayCurrency} (${currencySymbol})  |  Período: ${dateRange}  |  ${new Date().toLocaleDateString('es-NI')}`;
        cMeta.font = { size: 10, italic: true, color: { argb: 'FF888888' } };
        cMeta.alignment = { horizontal: 'center' };
        currentRow += 2;

        const kpiBoxes = [
          { label: 'ACTIVOS', value: activeEmployees.length.toString(), detail: `Plantilla: ${fEmployees.length}`, bgColor: 'FF3B82F6' },
          { label: 'COSTO NÓMINA', value: formatConvertedAmount(payrollTotals.total, 'NIO'), detail: `Anterior: ${formatConvertedAmount(prevPayrollTotals.total, 'NIO')}`, bgColor: 'FF10B981' },
          { label: 'COSTO/COLAB.', value: formatConvertedAmount(costoPorColaborador, 'NIO'), detail: 'Promedio del período', bgColor: 'FF3B82F6' },
          { label: 'ASISTENCIA', value: `${attendanceRate.toFixed(1)}%`, detail: estimated ? 'Estimada por permisos' : `${attStats.present} presentes`, bgColor: 'FF10B981' },
          { label: 'ROTACIÓN', value: `${tasaRotacion.toFixed(1)}%`, detail: `${bajasPeriodo.length} bajas · ${plantillaPromedio.toFixed(0)} prom.`, bgColor: 'FFF59E0B' },
          { label: 'ANTIGÜEDAD', value: fmtTenure(antiquity.avgMonths), detail: 'Desde fecha de ingreso', bgColor: 'FF3B82F6' },
        ];

        ws.getRow(currentRow).height = 16;
        kpiBoxes.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.label;
          cell.font = { size: 7, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        currentRow++;
        ws.getRow(currentRow).height = 22;
        kpiBoxes.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.value;
          cell.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        currentRow++;
        ws.getRow(currentRow).height = 14;
        kpiBoxes.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.detail;
          cell.font = { size: 7, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        currentRow += 2;

        const exportIds = ['hr-evolution-chart', 'hr-movements-chart', 'hr-distribution-chart'];
        const captureForExcel = async (elementId: string, targetRow: number) => {
          const el = document.getElementById(elementId);
          if (!el) return targetRow;
          try {
            const canvas = await html2canvas(el, {
              scale: 2,
              backgroundColor: '#09090b',
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
        imgRow = await captureForExcel('hr-evolution-chart', imgRow);
        imgRow = await captureForExcel('hr-movements-chart', imgRow);
        imgRow = await captureForExcel('hr-distribution-chart', imgRow);

        while (ws.rowCount < imgRow) ws.addRow([]);
        currentRow = ws.rowCount + 2;

        const thinBorder = { style: 'thin' as const, color: { argb: 'FFE5E7EB' } };

        const addTable = (title: string, headers: string[], rows: (string | number)[][]) => {
          const tRow = ws.addRow([title, '', '', '']);
          ws.mergeCells(`A${ws.rowCount}:D${ws.rowCount}`);
          tRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FFF59E0B' } };
          tRow.getCell(1).alignment = { horizontal: 'center' };
          ws.addRow([]);
          const hRow = ws.addRow(headers);
          hRow.eachCell((cell) => {
            if (!cell.value) return;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
          });
          rows.forEach((row, idx) => {
            const r = ws.addRow(row);
            [1, 2, 3, 4].forEach((cIdx) => {
              const cell = r.getCell(cIdx);
              if (!cell.value) return;
              cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
              if (idx % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
            });
          });
          ws.addRow([]);
        };

        addTable('Mayor Antigüedad', ['Colaborador', 'Ingreso', 'Antigüedad', 'Departamento'],
          antiquity.list.slice(0, 10).map(r => [r.name, r.hireDate ? r.hireDate.toLocaleDateString('es-NI') : '—', fmtTenure(r.months), r.dept]));

        addTable('Vacaciones Pendientes', ['Colaborador', 'Días pendientes', '', ''],
          vacStats.topSaldo.map(v => [v.name, `${v.remaining}`, '', '']));

        addTable('Ausentismo por tipo', ['Tipo', 'Días', '', ''],
          Object.entries(ausentismoPorTipo).map(([k, v]) => [k, `${v}`, '', '']));

        await downloadExcelWorkbook(wb, `Reporte_RRHH_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success("Excel exportado exitosamente");
      } catch (e: any) {
        toast.error(e?.response?.data?.message || e?.message || "Error exportando Excel");
      }
    }
  }));

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Activity className="size-12 animate-pulse text-primary opacity-50" />
        <p className="font-black uppercase tracking-widest text-xs">Consolidando Recursos Humanos...</p>
      </div>
    );
  }

  const selectCls = "bg-transparent border border-border/60 rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground focus:outline-none focus:border-primary";

  const chip = (key: string, icon: React.ReactNode, iconColor: string, label: string, value: string, valueColor: string, sub: React.ReactNode, onClick: () => void) => (
    <button key={key} onClick={onClick} className="px-3.5 py-2.5 rounded-xl border border-border/60 bg-transparent text-left transition-colors">
      <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-muted-foreground">
        <span className={iconColor}>{icon}</span> {label}
      </p>
      <p className={`text-lg font-black leading-tight ${valueColor}`}>{value}</p>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">{sub}</p>
    </button>
  );

  const sectionRow = (row: ListRow, idx: number) => (
    <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-border/50 gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-black truncate">{row.label}</p>
          {row.tag && <Badge className="text-[11px] px-1.5 py-0 h-4">{row.tag}</Badge>}
        </div>
        {row.sub && <p className="text-xs text-muted-foreground font-bold tracking-tight truncate">{row.sub}</p>}
      </div>
      {row.right && <p className={`text-sm font-black whitespace-nowrap ${row.rightClass || 'text-primary'}`}>{row.right}</p>}
    </div>
  );

  const statTile = (icon: React.ReactNode, accent: 'azul' | 'verde' | 'naranja' | 'rojo', value: string, label: string, sub?: string, onClick?: () => void) => (
    <button key={label} onClick={onClick} className={`p-4 rounded-xl border border-border/50 border-l-[3px] text-left transition-colors hover:bg-muted/5 ${ACCENTS[accent].border} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}>
      <p className={`text-xs font-black uppercase tracking-wide flex items-center gap-1.5 ${ACCENTS[accent].icon}`}>
        {icon} {label}
      </p>
      <p className={`text-xl font-black mt-1 ${ACCENTS[accent].text}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground font-bold mt-0.5 truncate">{sub}</p>}
    </button>
  );

  const ChartTip = ({ active, payload, label, money }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-white/10 bg-[#18181b] px-3.5 py-2.5 shadow-2xl">
        <p className="mb-1.5 text-xs font-black uppercase tracking-wider text-white">{label}</p>
        <div className="space-y-1">
          {payload.map((p: any, i: number) => (
            <p key={i} className="text-xs font-bold" style={{ color: p.color || p.stroke || '#fff' }}>
              {p.name}: {money ? fmtMoney(Number(p.value)) : Number(p.value).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </p>
          ))}
        </div>
      </div>
    );
  };

  const axisTick = { fill: '#9ca3af', fontSize: 12, fontWeight: 600 };
  const legendStyle = { fontSize: 12 };
  const noCursor = { fill: 'transparent' } as any;
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* ═══ Filtros ═══ */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="size-4 text-muted-foreground" />
        <select className={selectCls} value={fDept} onChange={(e) => setFDept(e.target.value)}>
          <option value="all">Todos los departamentos</option>
          {filterOptions.depts.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className={selectCls} value={fPos} onChange={(e) => setFPos(e.target.value)}>
          <option value="all">Todos los cargos</option>
          {filterOptions.positions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className={selectCls} value={fContract} onChange={(e) => setFContract(e.target.value)}>
          <option value="all">Todos los contratos</option>
          {filterOptions.contracts.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={selectCls} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="all">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(fDept !== 'all' || fPos !== 'all' || fContract !== 'all' || fStatus !== 'all') && (
          <button onClick={() => { setFDept('all'); setFPos('all'); setFContract('all'); setFStatus('all'); }} className="text-xs font-black uppercase tracking-wide text-primary hover:underline">
            Limpiar filtros
          </button>
        )}
        <span className="text-xs text-muted-foreground font-bold ml-auto">Período: {dateRange}</span>
      </div>

      {/* ═══ KPIs Ejecutivos (6) ═══ */}
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <button onClick={openActivosModal} className="text-left cursor-pointer">
          <Card className="border-blue-500/20 relative overflow-hidden transition-all hover:shadow-lg">
            <CardHeader className="pb-1">
              <CardTitle className="text-[13px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Users className="size-4 text-blue-500" /> Colaboradores activos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-black text-blue-500">{activeEmployees.length}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Plantilla {fEmployees.length} · <span className={`font-black ${variacion >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{variacion >= 0 ? '+' : ''}{variacion}</span>
              </p>
            </CardContent>
          </Card>
        </button>

        <Card className="border-blue-500/20 relative overflow-hidden transition-all hover:shadow-lg">
          <CardHeader className="pb-1">
            <CardTitle className="text-[13px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <DollarSign className="size-4 text-blue-500" /> Costo total de nómina
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-blue-500">{formatConvertedAmount(payrollTotals.total, 'NIO')}</p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              Cargas patronales: {formatConvertedAmount(payrollTotals.cargas + payrollTotals.prestaciones, 'NIO')} {varBadge(payrollTotals.total, prevPayrollTotals.total, false)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 relative overflow-hidden transition-all hover:shadow-lg">
          <CardHeader className="pb-1">
            <CardTitle className="text-[13px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Scale className="size-4 text-blue-500" /> Costo por colaborador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-blue-500">{formatConvertedAmount(costoPorColaborador, 'NIO')}</p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              Promedio del período {varBadge(costoPorColaborador, prevCostoPorColaborador, false)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 relative overflow-hidden transition-all hover:shadow-lg">
          <CardHeader className="pb-1">
            <CardTitle className="text-[13px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-emerald-500" /> Tasa de asistencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-emerald-500">{attendanceRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              {estimated ? 'Estimada por permisos' : `${attStats.present} presentes · ${attStats.absent} ausentes`} {varBadge(attendanceRate, prevAttStats.rate ?? 0, true, false, ' pp')}
            </p>
          </CardContent>
        </Card>

        <button onClick={openRotacionModal} className="text-left cursor-pointer">
          <Card className="border-amber-500/20 relative overflow-hidden transition-all hover:shadow-lg">
            <CardHeader className="pb-1">
              <CardTitle className="text-[13px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <RefreshCw className="size-4 text-amber-500" /> Rotación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-black text-amber-500">{tasaRotacion.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                {bajasPeriodo.length} bajas · plantilla {plantillaPromedio.toFixed(0)} {varBadge(tasaRotacion, prevTasaRotacion, false)}
              </p>
            </CardContent>
          </Card>
        </button>

        <Card className="border-blue-500/20 relative overflow-hidden transition-all hover:shadow-lg">
          <CardHeader className="pb-1">
            <CardTitle className="text-[13px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Clock className="size-4 text-blue-500" /> Antigüedad promedio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-blue-500">{fmtTenure(antiquity.avgMonths)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Desde fecha de ingreso</p>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Franja ═══ */}
      <div className="flex flex-wrap gap-3">
        {chip('altas', <UserPlus className="size-4" />, 'text-emerald-400', 'Altas del período', `+${altasPeriodo.length}`, 'text-emerald-400',
          varBadge(altasPeriodo.length, prevAltas, true), openAltasModal)}
        {chip('bajas', <UserMinus className="size-4" />, 'text-red-400', 'Bajas del período', `−${bajasPeriodo.length}`, 'text-red-400',
          varBadge(bajasPeriodo.length, prevBajas, false), openBajasModal)}
        {chip('ausentismo', <AlertTriangle className="size-4" />, 'text-red-400', 'Ausentismo', `${ausentismoDias} días`, 'text-red-400',
          varBadge(ausentismoDias, prevAusentismoDias, false), openAusentismoModal)}
        {chip('vacaciones', <Plane className="size-4" />, 'text-amber-400', 'Vacaciones pendientes', `${vacStats.pendiente} días`, 'text-amber-400',
          vacProximas30.length > 0 ? <span>{vacProximas30.length} próximas (30 días)</span> : <span>Saldos al corte</span>, openVacacionesModal)}
      </div>

      {/* ═══ Insights del período ═══ */}
      {insights.length > 0 && (
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-4">
            <p className="text-[13px] font-black uppercase tracking-wider flex items-center gap-2 mb-3">
              <Lightbulb className="size-4 text-amber-400" /> Insights del período
            </p>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {insights.map((ins, i) => (
                <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl border border-border/50">
                  <BadgeCheck className={`size-4 shrink-0 mt-0.5 ${ACCENTS[ins.tone].icon}`} />
                  <p className="text-xs font-bold leading-snug">{ins.text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ Evolución del costo de nómina + Movimientos ═══ */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card id="hr-evolution-chart" className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" /> Evolución del costo de nómina
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={evoTab} onValueChange={setEvoTab}>
              <TabsList className="mb-3">
                <TabsTrigger value="costo">Costo total</TabsTrigger>
                <TabsTrigger value="composicion">Composición</TabsTrigger>
                <TabsTrigger value="departamento">Por departamento</TabsTrigger>
              </TabsList>

              <TabsContent value="costo">
                {evoBuckets.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-12 opacity-40 uppercase font-black tracking-widest">Sin nóminas en el período</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-bold">
                      <span>Costo total: <span className="font-black text-blue-500 text-sm">{fmtMoney(payrollTotals.total)}</span></span>
                      <span className="flex items-center gap-2">{varBadge(payrollTotals.total, prevPayrollTotals.total, false)} vs período anterior</span>
                    </div>
                    <div className="h-[240px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={evoBuckets}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} />
                          <YAxis axisLine={false} tickLine={false} tick={axisTick} tickFormatter={(v) => fmtShort(Number(v))} />
                          <Tooltip content={<ChartTip money />} cursor={noCursor} />
                          <Legend wrapperStyle={legendStyle} />
                          <Bar dataKey="total" name="Costo del período" fill={PALETTE.azul} radius={[4, 4, 0, 0]} />
                          <Line type="monotone" dataKey="prev" name="Período anterior" stroke={PALETTE.gris} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Departamentos que impulsan el costo</p>
                        {costByDept.slice(0, 4).map((d, i) => (
                          <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50">
                            <span className="text-xs font-bold truncate">{d.name}</span>
                            <span className="text-xs font-black whitespace-nowrap flex items-center gap-2">
                              {fmtMoney(d.total)} ({d.pct.toFixed(1)}%) {varBadge(d.total, d.prev, false)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Colaboradores de mayor costo</p>
                        {costoPorEmp.map((c, i) => (
                          <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50">
                            <span className="text-xs font-bold truncate">{c.name} <span className="text-muted-foreground font-normal">· {c.dept}</span></span>
                            <span className="text-xs font-black whitespace-nowrap">{fmtMoney(c.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="composicion">
                <div className="grid md:grid-cols-2 gap-4 items-center">
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={[
                          { name: 'Salario base', value: payrollTotals.salario, color: PALETTE.azul },
                          { name: 'Variables (extra, comisiones, prestaciones)', value: payrollTotals.horasExtra + payrollTotals.comisiones + payrollTotals.prestaciones, color: PALETTE.naranja },
                          { name: 'Cargas patronales', value: payrollTotals.cargas, color: PALETTE.verde },
                          { name: 'Deducciones del trabajador', value: payrollTotals.deducciones, color: PALETTE.rojo },
                        ].filter(d => d.value > 0)} innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" nameKey="name">
                          {payrollTotals.total > 0 && [0, 1, 2, 3].map(i => <Cell key={i} fill={[PALETTE.azul, PALETTE.naranja, PALETTE.verde, PALETTE.rojo][i]} />)}
                        </Pie>
                        <Tooltip content={({ active, payload }: any) => {
                          if (!active || !payload?.length) return null;
                          const item = payload[0];
                          const pct = payrollTotals.total > 0 ? (Number(item.value) / payrollTotals.total) * 100 : 0;
                          return (
                            <div className="rounded-xl border border-white/10 bg-[#18181b] px-3.5 py-2.5 shadow-2xl">
                              <p className="text-xs font-black uppercase tracking-wider text-white mb-1">{item.name}</p>
                              <p className="text-xs font-bold text-white">{fmtMoney(Number(item.value))} · {pct.toFixed(1)}%</p>
                            </div>
                          );
                        }} />
                        <Legend wrapperStyle={legendStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {[
                      { name: 'Salario base', value: payrollTotals.salario, prev: prevPayrollTotals.salario, color: PALETTE.azul },
                      { name: 'Horas extra', value: payrollTotals.horasExtra, prev: prevPayrollTotals.horasExtra, color: PALETTE.naranjaFuerte },
                      { name: 'Comisiones y bonos', value: payrollTotals.comisiones, prev: prevPayrollTotals.comisiones, color: PALETTE.naranjaClaro },
                      { name: 'Cargas patronales', value: payrollTotals.cargas, prev: prevPayrollTotals.cargas, color: PALETTE.verde },
                      { name: 'Prestaciones (13° + vacaciones)', value: payrollTotals.prestaciones, prev: prevPayrollTotals.prestaciones, color: PALETTE.naranja },
                      { name: 'Deducciones del trabajador', value: payrollTotals.deducciones, prev: prevPayrollTotals.deducciones, color: PALETTE.rojo },
                    ].map(c => {
                      const pct = payrollTotals.total > 0 ? (c.value / payrollTotals.total) * 100 : 0;
                      return (
                        <div key={c.name} className="flex items-center justify-between text-xs gap-2 p-2 rounded-lg border border-border/50">
                          <span className="font-bold flex items-center gap-2 min-w-0">
                            <span className="size-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                            <span className="truncate">{c.name}</span>
                          </span>
                          <span className="font-black whitespace-nowrap">
                            {fmtMoney(c.value)} <span className="text-muted-foreground font-normal">({pct.toFixed(1)}%)</span> {varBadge(c.value, c.prev, false)}
                          </span>
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between pt-2 text-sm border-t border-border/50">
                      <span className="font-black uppercase tracking-wider">Costo total empresa</span>
                      <span className="font-black text-blue-500">{fmtMoney(payrollTotals.total)} {varBadge(payrollTotals.total, prevPayrollTotals.total, false)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-black uppercase tracking-wider">Neto pagado a colaboradores</span>
                      <span className="font-black">{fmtMoney(payrollTotals.neto)} {varBadge(payrollTotals.neto, prevPayrollTotals.neto, false)}</span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="departamento">
                {costByDept.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-12 opacity-40 uppercase font-black tracking-widest">Sin datos de nómina</p>
                ) : (
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={costByDept} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.08)" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={axisTick} tickFormatter={(v) => fmtShort(Number(v))} />
                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={110} tick={axisTick} />
                        <Tooltip content={<ChartTip money />} cursor={noCursor} />
                        <Bar dataKey="total" name="Costo de nómina" fill={PALETTE.verde} radius={[0, 6, 6, 0]} barSize={16} onClick={(d: any) => openSegmentModal(d?.name)} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">Clic en una barra para ver los colaboradores del área.</p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card id="hr-movements-chart" className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Activity className="size-4 text-primary" /> Movimientos y estabilidad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={movTab} onValueChange={setMovTab}>
              <TabsList className="mb-3 flex-wrap">
                <TabsTrigger value="altas-bajas">Altas y bajas</TabsTrigger>
                <TabsTrigger value="rotacion">Rotación</TabsTrigger>
                <TabsTrigger value="asistencia">Asistencia</TabsTrigger>
              </TabsList>

              <TabsContent value="altas-bajas">
                {movEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-12 opacity-40 uppercase font-black tracking-widest">Sin movimientos en el período</p>
                ) : movEvents.length <= 10 ? (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {movEvents.map((ev, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-border/50 gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-black truncate">
                            <span className={ev.type === 'Alta' ? 'text-emerald-400' : 'text-red-400'}>{ev.type}</span> · {ev.name}
                          </p>
                          <p className="text-xs text-muted-foreground font-bold truncate">
                            {ev.dept} · {ev.motivo} {ev.trabajado && `· ${ev.trabajado}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-black text-foreground">{ev.date.toLocaleDateString('es-NI')}</p>
                          <p className="text-xs text-muted-foreground font-bold">Plantilla: {ev.plantilla}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={movBuckets}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} />
                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={axisTick} />
                        <Tooltip content={<ChartTip />} cursor={false} />
                        <Legend wrapperStyle={legendStyle} />
                        <Line type="monotone" dataKey="plantilla" name="Plantilla acumulada" stroke={PALETTE.azul} strokeWidth={2.5} dot={false} />
                        <Line type="monotone" dataKey="altas" name="Altas" stroke={PALETTE.verde} strokeWidth={2} dot={{ r: 3, fill: PALETTE.verde, strokeWidth: 0 }} />
                        <Line type="monotone" dataKey="bajas" name="Bajas" stroke={PALETTE.rojo} strokeWidth={2} dot={{ r: 3, fill: PALETTE.rojo, strokeWidth: 0 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="rotacion">
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl border border-border/50 text-center">
                      <p className="text-xs font-bold text-muted-foreground uppercase">Bajas</p>
                      <p className="text-xl font-black text-red-400">{bajasPeriodo.length}</p>
                    </div>
                    <div className="p-3 rounded-xl border border-border/50 text-center">
                      <p className="text-xs font-bold text-muted-foreground uppercase">Plantilla promedio</p>
                      <p className="text-xl font-black text-blue-500">{plantillaPromedio.toFixed(0)}</p>
                      {muestraInsuficiente && <p className="text-[11px] font-black text-amber-400 mt-0.5">Muestra insuficiente</p>}
                    </div>
                    <div className="p-3 rounded-xl border border-border/50 text-center">
                      <p className="text-xs font-bold text-muted-foreground uppercase">Tasa rotación</p>
                      <p className="text-xl font-black text-amber-400">{tasaRotacion.toFixed(1)}%</p>
                      {varBadge(tasaRotacion, prevTasaRotacion, false)}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Fórmula: bajas del período ({bajasPeriodo.length}) ÷ plantilla promedio ({plantillaPromedio.toFixed(0)}) × 100 · Inicial: {plantillaInicio.length} · Final: {activeEmployees.length}
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Rotación por departamento</p>
                    {rotacionPorDept.length === 0 && <p className="text-xs text-muted-foreground">Sin bajas registradas en el período</p>}
                    {rotacionPorDept.map((d, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50">
                        <span className="text-xs font-bold truncate">{d.name}</span>
                        <span className="text-xs font-black whitespace-nowrap text-amber-400">{d.tasa.toFixed(1)}% <span className="text-muted-foreground font-normal">({d.bajas} bajas · {d.promedio.toFixed(0)} prom.)</span></span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground italic">
                    Rotación voluntaria/involuntaria: el sistema no registra causa de baja. Se contará cuando exista el campo.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="asistencia">
                {attBuckets.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-12 opacity-40 uppercase font-black tracking-widest">Sin registros de asistencia en el período</p>
                ) : (
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={attBuckets}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} />
                        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={axisTick} />
                        <Tooltip content={<ChartTip />} cursor={noCursor} />
                        <Legend wrapperStyle={legendStyle} />
                        <Bar dataKey="present" name="Presentes" stackId="a" fill={PALETTE.verde} />
                        <Bar dataKey="late" name="Tardanzas" stackId="a" fill={PALETTE.naranja} />
                        <Bar dataKey="absent" name="Ausentes" stackId="a" fill={PALETTE.rojo} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="space-y-2 pt-3">
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Días justificados aprobados</p>
                  {Object.entries(ausentismoPorTipo).length === 0 && <p className="text-xs text-muted-foreground">Sin permisos aprobados en el período</p>}
                  {Object.entries(ausentismoPorTipo).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50">
                      <span className="text-xs font-bold">{k}</span>
                      <span className="text-xs font-black text-muted-foreground">{v} días</span>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Distribución de la plantilla + Ranking ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="hr-distribution-chart" className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Users className="size-4 text-primary" /> Distribución de la plantilla
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={distKey} onValueChange={setDistKey} className="mb-4">
              <TabsList className="flex-wrap">
                <TabsTrigger value="departamento">Departamento</TabsTrigger>
                <TabsTrigger value="cargo">Cargo</TabsTrigger>
                <TabsTrigger value="contrato">Tipo de contrato</TabsTrigger>
                <TabsTrigger value="sucursal">Sucursal</TabsTrigger>
              </TabsList>
            </Tabs>
            {distribution.sinSucursal ? (
              <div className="p-6 rounded-xl border border-border/50 text-center">
                <p className="text-sm font-black text-primary">El sistema no registra sucursales para colaboradores</p>
                <p className="text-xs text-muted-foreground mt-1">Todos los registros quedan sin sucursal asignada.</p>
              </div>
            ) : distribution.items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-12 opacity-40 uppercase font-black tracking-widest">Sin colaboradores activos</p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="h-[230px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={distribution.items} innerRadius={55} outerRadius={80} paddingAngle={distribution.items.length > 1 ? 3 : 0} dataKey="count" nameKey="name" isAnimationActive>
                        {distribution.items.map((_, i) => <Cell key={i} fill={[PALETTE.azul, PALETTE.verde, PALETTE.naranja, PALETTE.rojo][i % 4]} />)}
                      </Pie>
                      <Tooltip content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        const item = payload[0]?.payload;
                        return (
                          <div className="rounded-xl border border-white/10 bg-[#18181b] px-3.5 py-2.5 shadow-2xl">
                            <p className="text-xs font-black uppercase tracking-wider text-white mb-1">{item?.name}</p>
                            <p className="text-xs font-bold text-white">{item?.count} colaboradores · {item?.pctPlantilla?.toFixed(1)}% de plantilla · {item?.pctCosto?.toFixed(1)}% del costo</p>
                          </div>
                        );
                      }} />
                      <Legend wrapperStyle={legendStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2">
                  {distribution.items.slice(0, 6).map((d, i) => (
                    <div key={i} className="p-2.5 rounded-lg border border-border/50">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black truncate">{d.name}</p>
                        <button onClick={() => openSegmentModal(d.name)} className="text-[11px] font-black uppercase text-primary hover:underline shrink-0">
                          Ver colaboradores
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground font-bold">
                        {d.count} · {d.pctPlantilla.toFixed(1)}% plantilla · {d.pctCosto.toFixed(1)}% costo
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Trophy className="size-4 text-amber-500" /> Ranking del personal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={rankTab} onValueChange={setRankTab}>
              <TabsList className="mb-3 flex-wrap">
                <TabsTrigger value="antiguedad">Mayor antigüedad</TabsTrigger>
                <TabsTrigger value="costo">Mayor costo</TabsTrigger>
                <TabsTrigger value="desempeno">Mayor desempeño</TabsTrigger>
                <TabsTrigger value="aniversarios">Próximos aniversarios</TabsTrigger>
              </TabsList>
              <div className="space-y-2">
                {rankTab === 'antiguedad' && antiquity.list.slice(0, 6).map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-amber-500/10 gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="size-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-xs font-black text-amber-500 shrink-0">
                        {r.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground font-bold tracking-tight truncate">
                          {r.dept} · {r.pos} · {r.contract}
                        </p>
                      </div>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <p className="text-sm font-black text-amber-500">{fmtTenure(r.months)}</p>
                      <p className="text-xs text-muted-foreground font-bold">{r.hireDate ? `Ingreso: ${r.hireDate.toLocaleDateString('es-NI')}` : '—'}</p>
                    </div>
                  </div>
                ))}
                {rankTab === 'costo' && costoPorEmp.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-blue-500/10 gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="size-10 rounded-xl bg-blue-500/15 flex items-center justify-center text-xs font-black text-blue-500 shrink-0">
                        {c.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground font-bold tracking-tight truncate">{c.dept}</p>
                      </div>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <p className="text-sm font-black text-blue-500">{fmtMoney(c.total)}</p>
                      <p className="text-xs text-muted-foreground font-bold">Período completo</p>
                    </div>
                  </div>
                ))}
                {rankTab === 'costo' && costoPorEmp.length === 0 && <p className="text-xs text-muted-foreground text-center py-8 opacity-40 uppercase font-black tracking-widest">Sin nóminas en el período</p>}
                {rankTab === 'desempeno' && perfStats.destacados.map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/10 gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="size-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-xs font-black text-emerald-500 shrink-0">
                        {empName(r.employee).charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black truncate">{empName(r.employee)}</p>
                        <p className="text-xs text-muted-foreground font-bold tracking-tight truncate">
                          {toDate(r.reviewPeriodEnd)?.toLocaleDateString('es-NI') || 'Período sin fecha'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <p className="text-sm font-black text-emerald-400">{Number(r.overallRating || 0) > 0 ? `${Number(r.overallRating).toFixed(1)} pts` : '—'}</p>
                    </div>
                  </div>
                ))}
                {rankTab === 'desempeno' && perfStats.destacados.length === 0 && <p className="text-xs text-muted-foreground text-center py-8 opacity-40 uppercase font-black tracking-widest">Sin evaluaciones completadas</p>}
                {rankTab === 'aniversarios' && antiquity.list.filter(r => r.anni).slice().sort((a, b) => (a.anni?.days || 0) - (b.anni?.days || 0)).slice(0, 6).map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-amber-500/10 gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="size-10 rounded-xl bg-amber-500/15 flex items-center justify-center text-xs font-black text-amber-500 shrink-0">
                        {r.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground font-bold tracking-tight truncate">{r.dept} · {r.pos}</p>
                      </div>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <p className="text-sm font-black text-amber-500">{r.anni?.label}</p>
                      <p className="text-xs text-muted-foreground font-bold">Antigüedad: {fmtTenure(r.months)}</p>
                    </div>
                  </div>
                ))}
                {antiquity.list.length === 0 && <p className="text-xs text-muted-foreground text-center py-8 opacity-40 uppercase font-black tracking-widest">Sin datos de personal</p>}
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Gestión humana detallada ═══ */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
            <Star className="size-4 text-primary" /> Gestión humana detallada
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={extraTab} onValueChange={setExtraTab}>
            <TabsList className="mb-4 flex-wrap">
              <TabsTrigger value="vacaciones"><Plane className="size-3.5 mr-1.5" /> Vacaciones</TabsTrigger>
              <TabsTrigger value="desempeno"><Star className="size-3.5 mr-1.5" /> Desempeño</TabsTrigger>
              <TabsTrigger value="capacitacion"><GraduationCap className="size-3.5 mr-1.5" /> Capacitación</TabsTrigger>
              <TabsTrigger value="documentacion"><FileText className="size-3.5 mr-1.5" /> Documentación</TabsTrigger>
              <TabsTrigger value="beneficios"><Gift className="size-3.5 mr-1.5" /> Beneficios</TabsTrigger>
            </TabsList>

            <TabsContent value="vacaciones">
              <div className="grid md:grid-cols-4 gap-3 mb-4">
                {statTile(<Plane className="size-4" />, 'azul', `${vacStats.pendiente} días`, 'Saldo acumulado pendiente', `${vacStats.acumulado} acumulados · ${vacStats.usado} usados`, openVacacionesAllModal)}
                {statTile(<Users className="size-4" />, 'verde', `${vacStats.disponibles}`, 'Personas disponibles', 'Con saldo pendiente positivo')}
                {statTile(<CalendarX className="size-4" />, 'naranja', `${fueraAhora.length}`, 'Personas fuera ahora', 'Vacaciones en curso', openVacacionesModal)}
                {statTile(<AlertTriangle className="size-4" />, vacStats.inconsistentes > 0 ? 'rojo' : 'azul', `${vacStats.inconsistentes}`, 'Riesgo de vencimiento', vacStats.inconsistentes > 0 ? 'Saldos negativos o inconsistentes' : 'Sin inconsistencias')}
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Próximas vacaciones aprobadas</p>
                    {vacProximas.length > 0 && <button onClick={openVacacionesModal} className="text-[11px] font-black uppercase text-primary hover:underline">Ver todas</button>}
                  </div>
                  {vacProximas.length === 0 && <p className="text-xs text-muted-foreground">Sin vacaciones aprobadas próximas</p>}
                  {vacProximas.slice(0, 5).map((v, i) => sectionRow({
                    label: empName(v.employee),
                    sub: `${v.days} días · ${toDate(v.startDate)?.toLocaleDateString('es-NI')} → ${toDate(v.endDate)?.toLocaleDateString('es-NI')}`,
                    right: toDate(v.startDate)?.toLocaleDateString('es-NI') || '—',
                  }, i))}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Mayor saldo pendiente</p>
                    <button onClick={openVacacionesAllModal} className="text-[11px] font-black uppercase text-primary hover:underline">Ver todos</button>
                  </div>
                  {vacStats.topSaldo.length === 0 && <p className="text-xs text-muted-foreground">Sin balances registrados</p>}
                  {vacStats.topSaldo.map((v, i) => sectionRow({ label: v.name, sub: `Saldo anual: ${v.total} días`, right: `${v.remaining} días`, rightClass: v.remaining >= 0 ? 'text-emerald-400' : 'text-red-400' }, i))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="desempeno">
              <div className="grid md:grid-cols-4 gap-3 mb-4">
                {statTile(<BadgeCheck className="size-4" />, 'verde', `${perfStats.completed}`, 'Evaluaciones completadas', `De ${perfStats.total} en total`)}
                {statTile(<Star className="size-4" />, 'naranja', `${perfStats.pending}`, 'Pendientes', 'Requieren seguimiento', openSeguimientoModal)}
                {statTile(<Activity className="size-4" />, 'azul', perfStats.avg > 0 ? perfStats.avg.toFixed(1) : '—', 'Puntaje promedio', 'Sobre evaluaciones completadas')}
                {statTile(<Gauge className="size-4" />, 'azul', perfStats.cumplimiento !== null ? `${perfStats.cumplimiento.toFixed(0)}%` : '—', 'Cumplimiento de KPI', 'Resultados vs objetivo')}
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Colaboradores destacados</p>
                  {perfStats.destacados.length === 0 && <p className="text-xs text-muted-foreground">Sin evaluaciones completadas</p>}
                  {perfStats.destacados.map((r, i) => sectionRow({
                    label: empName(r.employee),
                    sub: `Período: ${toDate(r.reviewPeriodStart)?.toLocaleDateString('es-NI') || '—'} → ${toDate(r.reviewPeriodEnd)?.toLocaleDateString('es-NI') || '—'}`,
                    right: Number(r.overallRating || 0) > 0 ? `${Number(r.overallRating).toFixed(1)} pts` : 'Sin calificación',
                    rightClass: 'text-amber-400',
                  }, i))}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Seguimiento requerido</p>
                    {perfStats.seguimiento.length > 0 && <button onClick={openSeguimientoModal} className="text-[11px] font-black uppercase text-primary hover:underline">Ver todos</button>}
                  </div>
                  {perfStats.seguimiento.length === 0 && <p className="text-xs text-muted-foreground">Sin evaluaciones pendientes de completar</p>}
                  {perfStats.seguimiento.map((r, i) => sectionRow({
                    label: empName(r.employee),
                    sub: r.status === 'DRAFT' ? 'Borrador' : 'En progreso',
                    right: 'Pendiente',
                    rightClass: 'text-amber-400',
                  }, i))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="capacitacion">
              <div className="grid md:grid-cols-5 gap-3 mb-4">
                {statTile(<GraduationCap className="size-4" />, 'azul', `${trainStats.activas}`, 'Capacitaciones activas', `Costo: ${fmtMoney(trainStats.costo)}`)}
                {statTile(<Users className="size-4" />, 'verde', `${trainStats.participantes}`, 'Participantes', 'Únicos inscritos')}
                {statTile(<TrendingUp className="size-4" />, 'azul', `${trainStats.rate.toFixed(0)}%`, 'Tasa de finalización', 'Inscripciones completadas')}
                {statTile(<Timer className="size-4" />, 'azul', `${trainStats.horas}`, 'Horas estimadas', '8 h × días laborales')}
                {statTile(<AlertTriangle className="size-4" />, trainStats.vencidas > 0 ? 'rojo' : 'azul', `${trainStats.vencidas}`, 'Vencidas', trainStats.vencidas > 0 ? 'Sin completar a tiempo' : 'Ninguna vencida')}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Capacitaciones activas</p>
                  {trainStats.pendientes > 0 && <button onClick={openTrainPendientesModal} className="text-[11px] font-black uppercase text-primary hover:underline">Ver pendientes ({trainStats.pendientes})</button>}
                </div>
                {trainings.filter(t => t.status === 'SCHEDULED' || t.status === 'IN_PROGRESS').slice(0, 6).map((t, i) => {
                  const total = t.enrollments?.length || 0;
                  const done = t.enrollments?.filter((en: any) => en.status === 'COMPLETED').length || 0;
                  return sectionRow({
                    label: t.title,
                    sub: `${toDate(t.startDate)?.toLocaleDateString('es-NI') || '—'} → ${toDate(t.endDate)?.toLocaleDateString('es-NI') || '—'} · ${total} inscritos · ${done} completados`,
                    right: t.status === 'IN_PROGRESS' ? 'En curso' : 'Programada',
                    rightClass: t.status === 'IN_PROGRESS' ? 'text-blue-400' : 'text-muted-foreground',
                  }, i);
                })}
                {trainings.filter(t => t.status === 'SCHEDULED' || t.status === 'IN_PROGRESS').length === 0 && <p className="text-xs text-muted-foreground">Sin capacitaciones activas</p>}
              </div>
            </TabsContent>

            <TabsContent value="documentacion">
              <div className="grid md:grid-cols-4 gap-3 mb-4">
                {statTile(<BadgeCheck className="size-4" />, 'verde', `${docStats.completa}`, 'Expedientes completos', `${activeEmployees.length} colaboradores`)}
                {statTile(<FileText className="size-4" />, 'naranja', `${docStats.pendiente}`, 'Sin expediente', 'Colaboradores sin documentos')}
                {statTile(<Clock className="size-4" />, 'naranja', `${docStats.proximos}`, 'Próximos a vencer', 'En los próximos 60 días', openDocsModal)}
                {statTile(<AlertTriangle className="size-4" />, docStats.vencidos > 0 ? 'rojo' : 'azul', `${docStats.vencidos}`, 'Vencidos', docStats.vencidos > 0 ? 'Requieren renovación' : 'Ninguno vencido', openDocsModal)}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Documentos vencidos o próximos a vencer</p>
                  {docStats.todos.length > 0 && <button onClick={openDocsModal} className="text-[11px] font-black uppercase text-primary hover:underline">Ver todos</button>}
                </div>
                {docStats.vencidosList.length === 0 && <p className="text-xs text-muted-foreground">Sin documentos vencidos o por vencer</p>}
                {docStats.vencidosList.map((d, i) => {
                  const t = toDate(d.expiryDate)?.getTime() || 0;
                  const expired = t < now.getTime();
                  return sectionRow({
                    label: d.title,
                    sub: `${empName(d.employee)} · ${d.type || 'Documento'}`,
                    right: toDate(d.expiryDate)?.toLocaleDateString('es-NI') || '—',
                    rightClass: expired ? 'text-red-400' : 'text-amber-400',
                    tag: expired ? 'VENCIDO' : 'POR VENCER',
                  }, i);
                })}
              </div>
            </TabsContent>

            <TabsContent value="beneficios">
              <div className="grid md:grid-cols-4 gap-3 mb-4">
                {statTile(<Gift className="size-4" />, 'azul', `${benStats.activos}`, 'Beneficios activos', 'Registrados en el sistema')}
                {statTile(<Users className="size-4" />, 'verde', `${benStats.beneficiados}`, 'Colaboradores cubiertos', 'Al menos un beneficio')}
                {statTile(<DollarSign className="size-4" />, 'azul', fmtMoney(benStats.costo), 'Costo mensual', 'Suma de costos por beneficio')}
                {statTile(<Gift className="size-4" />, benStats.sinAsignacion > 0 ? 'naranja' : 'azul', `${benStats.sinAsignacion}`, 'Sin asignación', benStats.sinAsignacion > 0 ? 'Beneficios sin colaboradores' : 'Todos asignados')}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Participación por tipo</p>
                {benStats.byType.map(([k, v], i) => sectionRow({ label: k, right: `${v} asignaciones` }, i))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ═══ Modal genérico ═══ */}
      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-2xl max-h-[75vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modal?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">{modal?.desc}</p>
          <div className="space-y-2">
            {modal?.rows.length === 0 && <p className="text-xs text-muted-foreground text-center py-8 opacity-40 uppercase font-black tracking-widest">Sin registros</p>}
            {modal?.rows.map((row, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-border/50 gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black truncate">{row.label}</p>
                  {row.sub && <p className="text-xs text-muted-foreground font-bold tracking-tight truncate">{row.sub}</p>}
                </div>
                {row.right && <p className={`text-sm font-black whitespace-nowrap ${row.rightClass || 'text-primary'}`}>{row.right}</p>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});
HRReportTab.displayName = 'HRReportTab';


