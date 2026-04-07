import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import { employeesService, payrollService, timeOffService } from '../../services/rh.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Users, DollarSign, CalendarCheck, Clock } from 'lucide-react';
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

export const HRReportTab = forwardRef<ReportExportRef, ReportProps>(({ dateRange }, ref) => {
  const { displayCurrency, convertAmount } = useCurrency();
  const { themeConfig } = useTheme();
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [timeOffs, setTimeOffs] = useState<any[]>([]);
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
        const [empRes, payRes, toRes] = await Promise.all([
          employeesService.getAll().catch(() => []),
          payrollService.getAll().catch(() => []),
          timeOffService.getAll().catch(() => [])
        ]);
        setEmployees(Array.isArray(empRes) ? empRes : (empRes as any)?.data || []);
        setPayrolls(Array.isArray(payRes) ? payRes : (payRes as any)?.data || []);
        setTimeOffs(Array.isArray(toRes) ? toRes : (toRes as any)?.data || []);
      } catch (e) {
        toast.error("Error cargando RRHH");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const fEmp = useMemo(() => employees, [employees]); // Active workforce doesn't strictly filter by date normally for a point in time
  const fPay = useMemo(() => payrolls.filter(p => isDateInRange(p.issueDate || p.createdAt, dateRange)), [payrolls, dateRange]);
  const fTo = useMemo(() => timeOffs.filter(t => isDateInRange(t.startDate || t.createdAt, dateRange)), [timeOffs, dateRange]);

  // ── 4 KPIs ──
  const totalPayrollCost = useMemo(() => fPay.reduce((a, c) => a + Number(c.netPay || c.total || 0), 0), [fPay]);
  const activeEmployees = fEmp.filter(e => e.status === 'ACTIVE' || !e.status).length;
  const avgSalary = activeEmployees > 0 ? (fEmp.filter(e => e.status !== 'TERMINATED').reduce((a, c) => a + Number(c.baseSalary || 0), 0) / activeEmployees) : 0;
  
  const totalDays = activeEmployees * 30; // Approx month
  const missedDays = fTo.filter(t => t.status === 'APPROVED').reduce((a, c) => {
    const diff = new Date(c.endDate).getTime() - new Date(c.startDate).getTime();
    return a + (diff / (1000 * 3600 * 24));
  }, 0);
  const attendanceRate = totalDays > 0 ? Math.max(100 - ((missedDays / totalDays) * 100), 0) : 100;

  const avgAntiquity = activeEmployees > 0 ? fEmp.filter(e => e.status !== 'TERMINATED').reduce((a, e) => {
    const years = (new Date().getTime() - new Date(e.hireDate || e.createdAt).getTime()) / (1000 * 3600 * 24 * 365);
    return a + years;
  }, 0) / activeEmployees : 0;

  // ── 4 Metrics ──
  const newHires = fEmp.filter(e => isDateInRange(e.hireDate || e.createdAt, dateRange)).length;
  const terminations = fEmp.filter(e => e.status === 'TERMINATED' && isDateInRange(e.updatedAt, dateRange)).length;
  const timeOffRequested = fTo.length;

  // ── 2 Tops ──
  const topDepts = useMemo(() => {
    const map: Record<string, number> = {};
    fEmp.forEach(e => {
      const dept = e.department || 'Sin Departamento';
      map[dept] = (map[dept] || 0) + Number(e.baseSalary || 0);
    });
    return Object.entries(map).map(([name, val]) => ({ name, val })).sort((a,b) => b.val - a.val).slice(0, 5);
  }, [fEmp]);

  const topAntiquity = useMemo(() => {
    return fEmp.map(e => {
      const years = (new Date().getTime() - new Date(e.hireDate || e.createdAt).getTime()) / (1000 * 3600 * 24 * 365);
      return { name: `${e.firstName} ${e.lastName}`, years };
    }).sort((a,b) => b.years - a.years).slice(0, 5);
  }, [fEmp]);

  // ── Charts ──
  const deptDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    fEmp.filter(e => e.status !== 'TERMINATED').forEach(e => {
      const dept = e.department || 'Gral';
      map[dept] = (map[dept] || 0) + 1;
    });
    return Object.entries(map).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));
  }, [fEmp]);

  const monthlyHires = useMemo(() => {
    const now = new Date().getMonth();
    return Array.from({ length: 6 }, (_, i) => {
      const idx = (now - (5 - i) + 12) % 12;
      const mHires = fEmp.filter(x => toDate(x.hireDate || x.createdAt)?.getMonth() === idx).length;
      return { mes: MONTH_NAMES[idx], contrataciones: mHires };
    });
  }, [fEmp]);

  const absenceTrend = useMemo(() => {
    const now = new Date().getMonth();
    return Array.from({ length: 6 }, (_, i) => {
      const idx = (now - (5 - i) + 12) % 12;
      const mAbs = fTo.filter(x => toDate(x.startDate || x.createdAt)?.getMonth() === idx).length;
      return { mes: MONTH_NAMES[idx], ausencias: mAbs };
    });
  }, [fTo]);

  useImperativeHandle(ref, () => ({
    exportPDF: async () => {
      toast.info("Generando PDF (RRHH)...");
      try {
        const doc = new jsPDF();
        const primaryHex = themeConfig.colors.primary.startsWith('#') ? themeConfig.colors.primary : '#10b981';
        let currentY = 20;

        doc.setFontSize(18);
        doc.text("Reporte de Recursos Humanos", 14, currentY);
        currentY += 10;
        doc.setFontSize(10);
        doc.text(`Generado: ${new Date().toLocaleDateString('es-NI')} | Moneda: ${displayCurrency}`, 14, currentY);
        currentY += 10;

        const metrics = [
          ['Total Empleados Activos', activeEmployees.toString()],
          ['Costo Total Nómina', fmt(totalPayrollCost)],
          ['Salario Promedio', fmt(avgSalary)],
          ['Tasa de Asistencia (%)', `${attendanceRate.toFixed(1)}%`],
          ['Promedio Antigüedad (Años)', avgAntiquity.toFixed(1)],
        ];
        
        autoTable(doc, {
          startY: currentY,
          head: [['Métrica', 'Valor']],
          body: metrics,
          theme: 'grid',
          headStyles: { fillColor: primaryHex as any }
        });

        doc.save(`RRHH_${new Date().getTime()}.pdf`);
        toast.success("PDF Exportado");
      } catch (e) {
        toast.error("Error exportando PDF");
      }
    },
    exportExcel: async () => {
      toast.info("Generando Excel (RRHH)...");
      try {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Recursos Humanos');
        const primaryHex = themeConfig.colors.primary.replace('#', '');
        
        ws.columns = [
          { header: 'Métrica', key: 'metric', width: 30 },
          { header: 'Valor', key: 'value', width: 25 },
        ];

        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF'} };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + primaryHex } };

        ws.addRow({ metric: 'Total Empleados Activos', value: activeEmployees });
        ws.addRow({ metric: 'Costo Total Nómina', value: totalPayrollCost });
        ws.addRow({ metric: 'Salario Promedio', value: avgSalary });
        ws.addRow({ metric: 'Tasa de Asistencia (%)', value: attendanceRate });
        ws.addRow({ metric: 'Antigüedad Promedio (Años)', value: avgAntiquity });
        ws.addRow({ metric: 'Nuevas Contrataciones', value: newHires });
        ws.addRow({ metric: 'Bajas', value: terminations });

        const wsTops = wb.addWorksheet('Top Empleados');
        wsTops.columns = [
          { header: 'Empleado', key: 'name', width: 30 },
          { header: 'Años', key: 'val', width: 20 },
        ];
        wsTops.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF'} };
        wsTops.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + primaryHex } };
        topAntiquity.forEach(c => wsTops.addRow({ name: c.name, val: c.years }));

        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `RRHH_${new Date().getTime()}.xlsx`;
        a.click();
        toast.success("Excel Exportado");
      } catch (e) {
        toast.error("Error exportando Excel");
      }
    }
  }));

  const tooltipStyle = { backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' };

  if (loading) return <div className="h-64 flex items-center justify-center font-bold text-muted-foreground">Cargando datos de RRHH...</div>;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      {/* 4 KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Costo Nómina', value: fmt(totalPayrollCost), c: 'text-indigo-400', bg: 'bg-indigo-500/10', icon: DollarSign },
          { label: 'Salario Promedio', value: fmt(avgSalary), c: 'text-blue-400', bg: 'bg-blue-500/10', icon: DollarSign },
          { label: 'Tasa Asistencia', value: `${attendanceRate.toFixed(1)}%`, c: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CalendarCheck },
          { label: 'Promedio Antigüedad', value: `${avgAntiquity.toFixed(1)} Años`, c: 'text-amber-400', bg: 'bg-amber-500/10', icon: Clock },
        ].map((k, i) => (
          <Card key={i} className="p-4" id={`hr-kpi-${i}`}>
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
         <Card className="p-3 text-center border-l-4 border-l-blue-500"><p className="text-xs text-muted-foreground">Empleados Activos</p><p className="font-bold text-sm tracking-tight">{activeEmployees}</p></Card>
         <Card className="p-3 text-center border-l-4 border-l-emerald-500"><p className="text-xs text-muted-foreground">Nuevas Contrataciones</p><p className="font-bold text-sm tracking-tight">{newHires}</p></Card>
         <Card className="p-3 text-center border-l-4 border-l-rose-500"><p className="text-xs text-muted-foreground">Bajas</p><p className="font-bold text-sm tracking-tight">{terminations}</p></Card>
         <Card className="p-3 text-center border-l-4 border-l-amber-500"><p className="text-xs text-muted-foreground">Permisos Solicitados</p><p className="font-bold text-sm tracking-tight">{timeOffRequested}</p></Card>
      </div>

      {/* 4 Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Personal por Departamento</CardTitle></CardHeader>
          <CardContent>
            {deptDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={deptDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {deptDistribution.map((e, i) => <Cell key={i} fill={e.color} stroke="transparent" />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-center py-10 text-muted-foreground">Sin datos</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Carga Salarial por Depto (Barras)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topDepts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
                <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={10} width={100} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), '']} />
                <Bar dataKey="val" fill="#8b5cf6" name="Carga Mxn" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Evolución Contrataciones</CardTitle></CardHeader>
          <CardContent>
             <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyHires}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Line type="monotone" dataKey="contrataciones" stroke="#10b981" strokeWidth={3} name="Altas" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Ausentismo Mensual</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={absenceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <defs>
                  <linearGradient id="colorAbs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="ausencias" stroke="#ef4444" fillOpacity={1} fill="url(#colorAbs)" name="Días Izados" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 2 Tops */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Top 5 Departamentos Más Costosos</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topDepts.map((c, i) => (
                <div key={i} className="flex justify-between items-center p-2 rounded bg-muted/20 border border-border/40">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{c.name}</span>
                  </div>
                  <span className="text-xs font-bold text-indigo-400">{fmt(Number(c.val))}</span>
                </div>
              ))}
              {topDepts.length === 0 && <p className="text-xs text-muted-foreground">Sin datos</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Top 5 Empleados Mayor Antigüedad</CardTitle></CardHeader>
          <CardContent>
             <div className="space-y-3">
              {topAntiquity.map((p, i) => (
                <div key={i} className="flex justify-between items-center p-2 rounded bg-muted/20 border border-border/40">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-muted-foreground" />
                    <span className="text-xs font-semibold flex-1">{p.name}</span>
                  </div>
                  <span className="text-xs font-bold text-amber-400">{p.years.toFixed(1)} años</span>
                </div>
              ))}
              {topAntiquity.length === 0 && <p className="text-xs text-muted-foreground">Sin datos</p>}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
});
HRReportTab.displayName = 'HRReportTab';
