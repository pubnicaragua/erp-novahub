import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import { incomeService, expensesService } from '../../services/finanzas.service';
import { getBase64Image, sanitizeHtml2CanvasOklch } from '../../utils/export-utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { DollarSign, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Activity, Wallet, Percent } from 'lucide-react';
import type { ReportExportRef, ReportProps } from './types';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#84cc16', '#f97316'];
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
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

export const FinanceReportTab = forwardRef<ReportExportRef, ReportProps>(({ dateRange }, ref) => {
  const { displayCurrency, convertAmount } = useCurrency();
  const { themeConfig } = useTheme();
  const { user } = useAuth();
  
  const [incomes, setIncomes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const sym = displayCurrency === 'USD' ? '$' : 'C$ ';
  const fmt = (n: number) => {
    const converted = typeof convertAmount === 'function' ? convertAmount(n, 'NIO') : n;
    return `${sym} ${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const fmtCompact = (n: number) => {
    const converted = typeof convertAmount === 'function' ? convertAmount(n, 'NIO') : n;
    return `${sym}${(converted / 1000).toFixed(1)}k`;
  };

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [incRes, expRes] = await Promise.all([incomeService.getAll(), expensesService.getAll()]);
        setIncomes(Array.isArray(incRes) ? incRes : (incRes as any)?.data || []);
        setExpenses(Array.isArray(expRes) ? expRes : (expRes as any)?.data || []);
      } catch (e) {
        toast.error("Error cargando finanzas");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const fInc = useMemo(() => incomes.filter(i => isDateInRange(i.date || i.createdAt, dateRange)), [incomes, dateRange]);
  const fExp = useMemo(() => expenses.filter(e => isDateInRange(e.date || e.createdAt, dateRange)), [expenses, dateRange]);

  const totalInc = useMemo(() => fInc.reduce((a, c) => a + Number(c.amount || 0), 0), [fInc]);
  const totalExp = useMemo(() => fExp.reduce((a, c) => a + Number(c.amount || 0), 0), [fExp]);
  
  // ── 4 KPIs ──
  const cashFlow = totalInc - totalExp;
  const ebitda = cashFlow + (totalExp * 0.05); // Proxy: add 5% "depreciation" 
  const breakEven = totalExp > 0 ? totalExp : 0; 
  const roi = totalExp > 0 ? ((cashFlow / totalExp) * 100) : 0;

  // ── 4 Metrics ──
  // Proxy metrics for demonstration
  const pendingTaxes = totalInc * 0.15; // 15% provision
  const adminExp = fExp.filter(e => String(e.category || '').toLowerCase().includes('admin')).reduce((a, c) => a + Number(c.amount || 0), 0);
  const operExp = totalExp - adminExp;
  const debtIndex = totalInc > 0 ? (totalExp / totalInc) * 100 : 0;
  const liquidityRatio = totalExp > 0 ? (totalInc / totalExp).toFixed(2) : '0.00';

  // ── 2 Tops ──
  const topExpenses = [...fExp].sort((a,b) => Number(b.amount || 0) - Number(a.amount || 0)).slice(0, 5);
  const topIncomes = [...fInc].sort((a,b) => Number(b.amount || 0) - Number(a.amount || 0)).slice(0, 5);

  // ── Charts ──
  const monthlyTrend = useMemo(() => {
    const now = new Date().getMonth();
    return Array.from({ length: 6 }, (_, i) => {
      const idx = (now - (5 - i) + 12) % 12;
      const mInc = fInc.filter(x => toDate(x.date || x.createdAt)?.getMonth() === idx).reduce((a, x) => a + Number(x.amount || 0), 0);
      const mExp = fExp.filter(x => toDate(x.date || x.createdAt)?.getMonth() === idx).reduce((a, x) => a + Number(x.amount || 0), 0);
      return { mes: MONTH_NAMES[idx], ingresos: mInc, gastos: mExp, utilidad: mInc - mExp };
    });
  }, [fInc, fExp]);

  const expByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    fExp.forEach(e => { const k = e.category || 'Otros'; map[k] = (map[k] || 0) + Number(e.amount || 0); });
    return Object.entries(map).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));
  }, [fExp]);

  const radarData = [
    { subject: 'Liquidez', A: Math.min(Number(liquidityRatio)*50, 100), fullMark: 100 },
    { subject: 'Rentabilidad', A: Math.min(Math.max(roi,0), 100), fullMark: 100 },
    { subject: 'Eficiencia', A: 100 - Math.min(debtIndex, 100), fullMark: 100 },
    { subject: 'EBITDA', A: Math.min((ebitda/Math.max(totalInc,1))*100, 100), fullMark: 100 },
    { subject: 'Margen', A: Math.min((cashFlow/Math.max(totalInc,1))*100, 100), fullMark: 100 },
  ];

  useImperativeHandle(ref, () => ({
    exportPDF: async () => {
      // Basic PDF Export strategy
      toast.info("Generando PDF (Finanzas)...");
      try {
        const doc = new jsPDF();
        const primaryHex = themeConfig.colors.primary.startsWith('#') ? themeConfig.colors.primary : '#10b981';
        let currentY = 20;

        doc.setFontSize(18);
        doc.text("Reporte Financiero", 14, currentY);
        currentY += 10;
        doc.setFontSize(10);
        doc.text(`Generado: ${new Date().toLocaleDateString('es-NI')} | Moneda: ${displayCurrency}`, 14, currentY);
        currentY += 10;

        // Metrics Table
        const metrics = [
          ['Total Ingresos', fmt(totalInc)],
          ['Total Gastos', fmt(totalExp)],
          ['Flujo de Caja Neto', fmt(cashFlow)],
          ['EBITDA', fmt(ebitda)],
          ['Punto de Equilibrio', fmt(breakEven)],
          ['ROI', `${roi.toFixed(1)}%`]
        ];
        
        autoTable(doc, {
          startY: currentY,
          head: [['Métrica', 'Valor']],
          body: metrics,
          theme: 'grid',
          headStyles: { fillColor: primaryHex as any }
        });

        doc.save(`Finanzas_${new Date().getTime()}.pdf`);
        toast.success("PDF Exportado");
      } catch (e) {
        toast.error("Error exportando PDF");
      }
    },
    exportExcel: async () => {
      toast.info("Generando Excel (Finanzas)...");
      try {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Finanzas');
        const primaryHex = themeConfig.colors.primary.replace('#', '');
        
        ws.columns = [
          { header: 'Métrica', key: 'metric', width: 30 },
          { header: 'Valor', key: 'value', width: 25 },
        ];

        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF'} };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + primaryHex } };

        ws.addRow({ metric: 'Total Ingresos', value: totalInc });
        ws.addRow({ metric: 'Total Gastos', value: totalExp });
        ws.addRow({ metric: 'Flujo de Caja Neto', value: cashFlow });
        ws.addRow({ metric: 'EBITDA Proyectado', value: ebitda });
        ws.addRow({ metric: 'Punto de Equilibrio', value: breakEven });
        ws.addRow({ metric: 'ROI (%)', value: roi });
        ws.addRow({ metric: 'Ratio de Liquidez', value: liquidityRatio });
        ws.addRow({ metric: 'Impuestos Provisionados', value: pendingTaxes });

        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Finanzas_${new Date().getTime()}.xlsx`;
        a.click();
        toast.success("Excel Exportado");
      } catch (e) {
        toast.error("Error exportando Excel");
      }
    }
  }));

  const tooltipStyle = { backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' };

  if (loading) {
    return <div className="h-64 flex items-center justify-center font-bold text-muted-foreground">Cargando datos financieros...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      {/* 4 KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Flujo de Caja Neto', value: fmt(cashFlow), c: cashFlow >= 0 ? 'text-green-400' : 'text-red-400', bg: cashFlow >= 0 ? 'bg-green-500/10' : 'bg-red-500/10', icon: DollarSign },
          { label: 'EBITDA Proyectado', value: fmt(ebitda), c: 'text-blue-400', bg: 'bg-blue-500/10', icon: Activity },
          { label: 'Punto de Equilibrio', value: fmt(breakEven), c: 'text-purple-400', bg: 'bg-purple-500/10', icon: Wallet },
          { label: 'ROI del periodo', value: `${roi.toFixed(1)}%`, c: 'text-amber-400', bg: 'bg-amber-500/10', icon: Percent },
        ].map((k, i) => (
          <Card key={i} className="p-4" id={`fin-kpi-${i}`}>
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-2.5 ${k.bg}`}><k.icon className={`size-4 ${k.c}`} /></div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{k.label}</p>
                <p className={`text-lg font-black ${k.c}`}>{k.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 4 Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <Card className="p-3 text-center border-l-4 border-l-emerald-500"><p className="text-xs text-muted-foreground">Ratio Liquidez</p><p className="font-bold text-sm tracking-tight">{liquidityRatio}x</p></Card>
         <Card className="p-3 text-center border-l-4 border-l-rose-500"><p className="text-xs text-muted-foreground">Índice Endeud.</p><p className="font-bold text-sm tracking-tight">{debtIndex.toFixed(1)}%</p></Card>
         <Card className="p-3 text-center border-l-4 border-l-blue-500"><p className="text-xs text-muted-foreground">Gto Admin vs Oper</p><p className="font-bold text-sm tracking-tight">{fmt(adminExp)} / {fmt(operExp)}</p></Card>
         <Card className="p-3 text-center border-l-4 border-l-orange-500"><p className="text-xs text-muted-foreground">Imp. Provisionados</p><p className="font-bold text-sm tracking-tight">{fmt(pendingTaxes)}</p></Card>
      </div>

      {/* 4 Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card id="fin-chart-1">
          <CardHeader><CardTitle className="text-sm">Ingreso vs Gasto (Mensual)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), '']} />
                <Legend />
                <Bar dataKey="ingresos" stackId="a" fill="#10b981" name="Ingresos" />
                <Bar dataKey="gastos" stackId="a" fill="#ef4444" name="Gastos" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card id="fin-chart-2">
          <CardHeader><CardTitle className="text-sm">Utilidad Mensual (Trend)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), '']} />
                <defs>
                  <linearGradient id="colorUtil" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="utilidad" stroke="#3b82f6" fillOpacity={1} fill="url(#colorUtil)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card id="fin-chart-3">
          <CardHeader><CardTitle className="text-sm">Gastos por Categoría</CardTitle></CardHeader>
          <CardContent>
            {expByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={expByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {expByCategory.map((e, i) => <Cell key={i} fill={e.color} stroke="transparent" />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), '']} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-center py-10 text-muted-foreground">Sin gastos para mostrar</p>}
          </CardContent>
        </Card>

        <Card id="fin-chart-4">
          <CardHeader><CardTitle className="text-sm">Balance de Cuentas (Radar)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart cx="50%" cy="50%" outerRadius={80} data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <Radar name="Scoring" dataKey="A" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.4} />
                <Tooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 2 Tops */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Top 5 Gastos Más Caros</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topExpenses.map((e, i) => (
                <div key={e.id || i} className="flex justify-between items-center p-2 rounded bg-muted/20 border border-border/40">
                  <span className="text-xs font-semibold">{e.description || e.category}</span>
                  <span className="text-xs font-bold text-red-400">{fmt(Number(e.amount))}</span>
                </div>
              ))}
              {topExpenses.length === 0 && <p className="text-xs text-muted-foreground">Sin datos</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Top 5 Ingresos Más Altos</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topIncomes.map((inc, i) => (
                <div key={inc.id || i} className="flex justify-between items-center p-2 rounded bg-muted/20 border border-border/40">
                  <span className="text-xs font-semibold">{inc.description || inc.category}</span>
                  <span className="text-xs font-bold text-emerald-400">{fmt(Number(inc.amount))}</span>
                </div>
              ))}
              {topIncomes.length === 0 && <p className="text-xs text-muted-foreground">Sin datos</p>}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
});
FinanceReportTab.displayName = 'FinanceReportTab';
