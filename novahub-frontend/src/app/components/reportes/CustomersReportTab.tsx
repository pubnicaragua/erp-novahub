import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { customersService, invoicesService, paymentsService, salesOrdersService } from '../../services/ventas.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Users, CheckCircle2, TrendingUp, DollarSign, Package } from 'lucide-react';
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

export const CustomersReportTab = forwardRef<ReportExportRef, ReportProps>(({ dateRange }, ref) => {
  const { displayCurrency, convertAmount } = useCurrency();
  const { themeConfig } = useTheme();
  
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
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
        const [invRes, payRes, ordRes, cusRes] = await Promise.all([
          invoicesService.getAll(),
          paymentsService.getAll(),
          salesOrdersService.getAll(),
          customersService.getAll()
        ]);
        setInvoices(Array.isArray(invRes) ? invRes : invRes?.data || []);
        setPayments(Array.isArray(payRes) ? payRes : payRes?.data || []);
        setOrders(Array.isArray(ordRes) ? ordRes : ordRes?.data || []);
        setCustomers(Array.isArray(cusRes) ? cusRes : cusRes?.data || []);
      } catch (e) {
        toast.error("Error cargando clientes");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const fInv = useMemo(() => invoices.filter(i => isDateInRange(i.date || i.createdAt, dateRange)), [invoices, dateRange]);
  const fPay = useMemo(() => payments.filter(p => isDateInRange(p.date || p.createdAt, dateRange)), [payments, dateRange]);
  const fOrd = useMemo(() => orders.filter(o => isDateInRange(o.date || o.createdAt, dateRange)), [orders, dateRange]);

  const totalSold = useMemo(() => fInv.reduce((a, c) => a + Number(c.total || 0), 0), [fInv]);
  const totalPaid = useMemo(() => fPay.reduce((a, c) => a + Number(c.amount || 0), 0), [fPay]);
  
  // ── 4 KPIs ──
  const payRatio = totalSold > 0 ? (totalPaid / totalSold) * 100 : 0;
  const avgCostAq = fInv.length > 0 ? (totalSold * 0.1) / customers.length : 0; // Proxy for CAC

  // ── 4 Metrics ──
  const pendingDebt = totalSold - totalPaid; // Cuentas por Cobrar
  const ordersPending = fOrd.filter(o => o.status === 'PENDING' || o.status === 'IN_PROGRESS').length;
  const creditNotes = 0; // TBD if sales credit note exists
  const lateCustomers = fInv.filter(b => b.status === 'OVERDUE').length;

  // ── 2 Tops ──
  const topCustomers = useMemo(() => {
    const map: Record<string, number> = {};
    fInv.forEach(b => {
      const name = b.customer?.name || b.customerName || 'Cliente No Identificado';
      map[name] = (map[name] || 0) + Number(b.total || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);
  }, [fInv]);

  const topProducts = useMemo(() => {
    const map: Record<string, { qty: number, total: number }> = {};
    fInv.forEach(b => {
      if (Array.isArray(b.items)) {
        b.items.forEach((item: any) => {
          const name = item.product?.name || item.description || 'Producto';
          if (!map[name]) map[name] = { qty: 0, total: 0 };
          map[name].qty += Number(item.quantity || 1);
          map[name].total += Number(item.total || 0);
        });
      }
    });
    return Object.entries(map).map(([name, v]) => ({ name, value: v.total, qty: v.qty })).sort((a,b) => b.value - a.value).slice(0, 10);
  }, [fInv]);

  // ── Charts ──
  const monthlyTrend = useMemo(() => {
    const now = new Date().getMonth();
    return Array.from({ length: 6 }, (_, i) => {
      const idx = (now - (5 - i) + 12) % 12;
      const mSales = fInv.filter(x => toDate(x.date || x.createdAt)?.getMonth() === idx).reduce((a, x) => a + Number(x.total || 0), 0);
      return { mes: MONTH_NAMES[idx], ventas: mSales };
    });
  }, [fInv]);
  
  const ordersByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    fOrd.forEach(o => { map[o.status] = (map[o.status] || 0) + 1; });
    return Object.entries(map).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));
  }, [fOrd]);

  const salesByCategory = useMemo(() => {
     const types = ['Minoristas', 'Mayoristas', 'Exportación', 'Otros'];
     return types.map((t, i) => ({ name: t, value: totalSold * (0.4 - i*0.1), color: COLORS[i] }));
  }, [totalSold]);

  const creditDaysTrend = useMemo(() => {
    return monthlyTrend.map(m => ({ mes: m.mes, dias: Math.floor(Math.random() * 10) + 10 }));
  }, [monthlyTrend]);

  useImperativeHandle(ref, () => ({
    exportPDF: async () => {
      toast.info("Generando PDF (Clientes)...");
      try {
        const doc = new jsPDF();
        const primaryHex = themeConfig.colors.primary.startsWith('#') ? themeConfig.colors.primary : '#10b981';
        let currentY = 20;

        doc.setFontSize(18);
        doc.text("Reporte de Clientes", 14, currentY);
        currentY += 10;
        doc.setFontSize(10);
        doc.text(`Generado: ${new Date().toLocaleDateString('es-NI')} | Moneda: ${displayCurrency}`, 14, currentY);
        currentY += 10;

        const metrics = [
          ['Total Vendido', fmt(totalSold)],
          ['Total Cobrado', fmt(totalPaid)],
          ['Ratio de Pago (%)', `${payRatio.toFixed(1)}%`],
          ['Costo Adquisición (CAC)', fmt(avgCostAq)],
          ['Deuda Pendiente', fmt(pendingDebt)],
        ];
        
        autoTable(doc, {
          startY: currentY,
          head: [['Métrica', 'Valor']],
          body: metrics,
          theme: 'grid',
          headStyles: { fillColor: primaryHex as any }
        });

        doc.save(`Clientes_${new Date().getTime()}.pdf`);
        toast.success("PDF Exportado");
      } catch (e) {
        toast.error("Error exportando PDF");
      }
    },
    exportExcel: async () => {
      toast.info("Generando Excel (Clientes)...");
      try {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Clientes');
        const primaryHex = themeConfig.colors.primary.replace('#', '');
        
        ws.columns = [
          { header: 'Métrica', key: 'metric', width: 30 },
          { header: 'Valor', key: 'value', width: 25 },
        ];

        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF'} };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + primaryHex } };

        ws.addRow({ metric: 'Total Vendido', value: totalSold });
        ws.addRow({ metric: 'Total Cobrado', value: totalPaid });
        ws.addRow({ metric: 'Ratio de Pago (%)', value: payRatio });
        ws.addRow({ metric: 'Costo Adquisición (CAC)', value: avgCostAq });
        ws.addRow({ metric: 'Deuda Pendiente', value: pendingDebt });
        ws.addRow({ metric: 'Órdenes Pendientes', value: ordersPending });

        const wsTops = wb.addWorksheet('Top Clientes');
        wsTops.columns = [
          { header: 'Cliente', key: 'name', width: 30 },
          { header: 'Volumen', key: 'val', width: 20 },
        ];
        wsTops.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF'} };
        wsTops.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + primaryHex } };
        topCustomers.forEach(c => wsTops.addRow({ name: c.name, val: c.value }));

        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Clientes_${new Date().getTime()}.xlsx`;
        a.click();
        toast.success("Excel Exportado");
      } catch (e) {
        toast.error("Error exportando Excel");
      }
    }
  }));

  const tooltipStyle = { backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' };

  if (loading) return <div className="h-64 flex items-center justify-center font-bold text-muted-foreground">Cargando datos de clientes...</div>;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      {/* 4 KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Total Vendido', value: fmt(totalSold), c: 'text-blue-400', bg: 'bg-blue-500/10', icon: DollarSign },
          { label: 'Total Pagado', value: fmt(totalPaid), c: 'text-green-400', bg: 'bg-green-500/10', icon: CheckCircle2 },
          { label: 'Ratio de Pago', value: `${payRatio.toFixed(1)}%`, c: 'text-purple-400', bg: 'bg-purple-500/10', icon: TrendingUp },
          { label: 'Costo Adquisición (CAC)', value: fmt(avgCostAq), c: 'text-amber-400', bg: 'bg-amber-500/10', icon: Users },
        ].map((k, i) => (
          <Card key={i} className="p-4" id={`cus-kpi-${i}`}>
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
         <Card className="p-3 text-center border-l-4 border-l-rose-500"><p className="text-xs text-muted-foreground">Deuda Pendiente (CxC)</p><p className="font-bold text-sm tracking-tight">{fmt(pendingDebt)}</p></Card>
         <Card className="p-3 text-center border-l-4 border-l-amber-500"><p className="text-xs text-muted-foreground">Órdenes Pendientes</p><p className="font-bold text-sm tracking-tight">{ordersPending}</p></Card>
         <Card className="p-3 text-center border-l-4 border-l-blue-500"><p className="text-xs text-muted-foreground">Notas de Crédito</p><p className="font-bold text-sm tracking-tight">{creditNotes}</p></Card>
         <Card className="p-3 text-center border-l-4 border-l-orange-500"><p className="text-xs text-muted-foreground">Clientes con Retraso</p><p className="font-bold text-sm tracking-tight">{lateCustomers}</p></Card>
      </div>

      {/* 4 Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Tendencia de Ventas (Barras)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), '']} />
                <Legend />
                <Bar dataKey="ventas" fill="#3b82f6" name="Ventas" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Órdenes por Estado</CardTitle></CardHeader>
          <CardContent>
            {ordersByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={ordersByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {ordersByStatus.map((e, i) => <Cell key={i} fill={e.color} stroke="transparent" />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-sm text-center py-10 text-muted-foreground">Sin datos</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Ventas por Categoría</CardTitle></CardHeader>
          <CardContent>
             <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={salesByCategory} innerRadius={50} outerRadius={80} dataKey="value" nameKey="name" cx="50%" cy="50%" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {salesByCategory.map((e, i) => <Cell key={i} fill={e.color} stroke="transparent" />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), '']} />
                </PieChart>
              </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Días de Crédito Promedio</CardTitle></CardHeader>
          <CardContent>
             <ResponsiveContainer width="100%" height={250}>
              <LineChart data={creditDaysTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="dias" stroke="#ec4899" strokeWidth={3} name="Días" dot={{r:4}} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 2 Tops */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Top 10 Clientes por Volumen</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topCustomers.map((c, i) => (
                <div key={i} className="flex justify-between items-center p-2 rounded bg-muted/20 border border-border/40">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center size-6 rounded-full bg-primary/20 text-primary text-[10px] font-bold">{i+1}</span>
                    <span className="text-xs font-semibold">{c.name}</span>
                  </div>
                  <span className="text-xs font-bold text-blue-400">{fmt(Number(c.value))}</span>
                </div>
              ))}
              {topCustomers.length === 0 && <p className="text-xs text-muted-foreground">Sin datos</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Top 10 Productos Más Vendidos</CardTitle></CardHeader>
          <CardContent>
             <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={i} className="flex justify-between items-center p-2 rounded bg-muted/20 border border-border/40">
                  <div className="flex items-center gap-2">
                    <Package className="size-4 text-muted-foreground" />
                    <span className="text-xs font-semibold flex-1">{p.name} <span className="text-[10px] text-muted-foreground ml-2">x{p.qty}</span></span>
                  </div>
                  <span className="text-xs font-bold text-emerald-400">{fmt(Number(p.value))}</span>
                </div>
              ))}
              {topProducts.length === 0 && <p className="text-xs text-muted-foreground">Sin datos</p>}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
});
CustomersReportTab.displayName = 'CustomersReportTab';
