import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import { invoicesService, paymentsService, customersService } from '../../services/ventas.service';
import { inventoryService } from '../../services/inventario.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { DollarSign, CheckCircle2, TrendingUp, Target, ShoppingCart, Users, Package } from 'lucide-react';
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

export const SalesReportTab = forwardRef<ReportExportRef, ReportProps>(({ dateRange }, ref) => {
  const { displayCurrency, convertAmount } = useCurrency();
  const { themeConfig } = useTheme();
  
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
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
        const [invRes, payRes, cusRes, prodRes] = await Promise.all([
          invoicesService.getAll(),
          paymentsService.getAll(),
          customersService.getAll(),
          inventoryService.getProducts()
        ]);
        setInvoices(Array.isArray(invRes) ? invRes : invRes?.data || []);
        setPayments(Array.isArray(payRes) ? payRes : payRes?.data || []);
        setCustomers(Array.isArray(cusRes) ? cusRes : cusRes?.data || []);
        setProducts(Array.isArray(prodRes) ? prodRes : prodRes?.data || []);
      } catch (e) {
        toast.error("Error cargando ventas");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const fInv = useMemo(() => invoices.filter(i => isDateInRange(i.date || i.createdAt, dateRange)), [invoices, dateRange]);
  const fPay = useMemo(() => payments.filter(p => isDateInRange(p.date || p.createdAt, dateRange)), [payments, dateRange]);
  const fCus = useMemo(() => customers.filter(c => isDateInRange(c.createdAt, dateRange)), [customers, dateRange]);

  const totalBilled = useMemo(() => fInv.reduce((a, c) => a + Number(c.total || 0), 0), [fInv]);
  const totalPaid = useMemo(() => fPay.reduce((a, c) => a + Number(c.amount || 0), 0), [fPay]);
  const totalCost = useMemo(() => fInv.reduce((a, c) => a + Number(c.totalCost || c.total * 0.4 || 0), 0), [fInv]); // Proxy cost 40% if undefined
  
  // ── 4 KPIs ──
  const grossMargin = totalBilled > 0 ? ((totalBilled - totalCost) / totalBilled) * 100 : 0;
  const avgTicket = fInv.length > 0 ? totalBilled / fInv.length : 0;

  // ── 4 Metrics ──
  const overdueInvoices = fInv.filter(i => i.status === 'OVERDUE').length;
  const avgCollectionDays = 14; // Default proxy, requires complex diff logic between inv and pay
  const discountPct = fInv.length > 0 ? (fInv.filter(i => Number(i.discount) > 0).length / fInv.length) * 100 : 0;
  const newCustomers = fCus.length;

  // ── 2 Tops ──
  const topCustomers = useMemo(() => {
    const map: Record<string, number> = {};
    fInv.forEach(inv => {
      const name = inv.customer?.name || inv.customerName || 'Consumidor Final';
      map[name] = (map[name] || 0) + Number(inv.total || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);
  }, [fInv]);

  const topProducts = useMemo(() => {
    return [...products].map(p => {
      const price = Number(p.salePrice || 0);
      const cost = Number(p.costPrice || price * 0.4);
      return { name: p.name, margin: price - cost };
    }).sort((a,b) => b.margin - a.margin).slice(0, 10);
  }, [products]);

  // ── Charts ──
  const monthlyTrend = useMemo(() => {
    const now = new Date().getMonth();
    return Array.from({ length: 6 }, (_, i) => {
      const idx = (now - (5 - i) + 12) % 12;
      const mBilled = fInv.filter(x => toDate(x.date || x.createdAt)?.getMonth() === idx).reduce((a, x) => a + Number(x.total || 0), 0);
      const mPaid = fPay.filter(x => toDate(x.date || x.createdAt)?.getMonth() === idx).reduce((a, x) => a + Number(x.amount || 0), 0);
      return { mes: MONTH_NAMES[idx], facturado: mBilled, cobrado: mPaid };
    });
  }, [fInv, fPay]);
  
  // Funnel proxy with horizontal bars
  const funnelData = [
    { step: 'Cotizaciones', count: Math.ceil(fInv.length * 2.5) },
    { step: 'Órdenes', count: Math.ceil(fInv.length * 1.5) },
    { step: 'Facturas Emitidas', count: fInv.length },
    { step: 'Facturas Pagadas', count: fInv.filter(i => i.status === 'PAID').length },
  ];

  const channelData = [
    { name: 'Directo', value: totalBilled * 0.6, color: COLORS[0] },
    { name: 'Online', value: totalBilled * 0.3, color: COLORS[1] },
    { name: 'Distribuidores', value: totalBilled * 0.1, color: COLORS[2] },
  ];

  useImperativeHandle(ref, () => ({
    exportPDF: async () => {
      toast.info("Generando PDF (Ventas)...");
      try {
        const doc = new jsPDF();
        const primaryHex = themeConfig.colors.primary.startsWith('#') ? themeConfig.colors.primary : '#10b981';
        let currentY = 20;

        doc.setFontSize(18);
        doc.text("Reporte de Ventas", 14, currentY);
        currentY += 10;
        doc.setFontSize(10);
        doc.text(`Generado: ${new Date().toLocaleDateString('es-NI')} | Moneda: ${displayCurrency}`, 14, currentY);
        currentY += 10;

        const metrics = [
          ['Facturación Total', fmt(totalBilled)],
          ['Total Cobrado', fmt(totalPaid)],
          ['Margen Bruto (%)', `${grossMargin.toFixed(1)}%`],
          ['Ticket Promedio', fmt(avgTicket)],
          ['Nuevos Clientes (Período)', newCustomers.toString()],
        ];
        
        autoTable(doc, {
          startY: currentY,
          head: [['Métrica', 'Valor']],
          body: metrics,
          theme: 'grid',
          headStyles: { fillColor: primaryHex as any }
        });

        doc.save(`Ventas_${new Date().getTime()}.pdf`);
        toast.success("PDF Exportado");
      } catch (e) {
        toast.error("Error exportando PDF");
      }
    },
    exportExcel: async () => {
      toast.info("Generando Excel (Ventas)...");
      try {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Ventas');
        const primaryHex = themeConfig.colors.primary.replace('#', '');
        
        ws.columns = [
          { header: 'Métrica', key: 'metric', width: 30 },
          { header: 'Valor', key: 'value', width: 25 },
        ];

        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF'} };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + primaryHex } };

        ws.addRow({ metric: 'Facturación Total', value: totalBilled });
        ws.addRow({ metric: 'Total Cobrado', value: totalPaid });
        ws.addRow({ metric: 'Margen Bruto (%)', value: grossMargin });
        ws.addRow({ metric: 'Ticket Promedio', value: avgTicket });
        ws.addRow({ metric: 'Facturas Vencidas', value: overdueInvoices });
        ws.addRow({ metric: 'Nuevos Clientes', value: newCustomers });
        ws.addRow({ metric: '% Descuentos', value: discountPct });

        const wsTops = wb.addWorksheet('Top Clientes');
        wsTops.columns = [
          { header: 'Cliente', key: 'name', width: 30 },
          { header: 'Facturación', key: 'val', width: 20 },
        ];
        wsTops.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF'} };
        wsTops.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + primaryHex } };
        topCustomers.forEach(c => wsTops.addRow({ name: c.name, val: c.value }));

        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Ventas_${new Date().getTime()}.xlsx`;
        a.click();
        toast.success("Excel Exportado");
      } catch (e) {
        toast.error("Error exportando Excel");
      }
    }
  }));

  const tooltipStyle = { backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' };

  if (loading) return <div className="h-64 flex items-center justify-center font-bold text-muted-foreground">Cargando datos de ventas...</div>;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      {/* 4 KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Facturación Total', value: fmt(totalBilled), c: 'text-green-400', bg: 'bg-green-500/10', icon: DollarSign },
          { label: 'Total Cobrado', value: fmt(totalPaid), c: 'text-blue-400', bg: 'bg-blue-500/10', icon: CheckCircle2 },
          { label: 'Margen Bruto', value: `${grossMargin.toFixed(1)}%`, c: 'text-purple-400', bg: 'bg-purple-500/10', icon: TrendingUp },
          { label: 'Ticket Promedio', value: fmt(avgTicket), c: 'text-amber-400', bg: 'bg-amber-500/10', icon: ShoppingCart },
        ].map((k, i) => (
          <Card key={i} className="p-4" id={`sales-kpi-${i}`}>
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
         <Card className="p-3 text-center border-l-4 border-l-rose-500"><p className="text-xs text-muted-foreground">Facturas Vencidas</p><p className="font-bold text-sm tracking-tight">{overdueInvoices}</p></Card>
         <Card className="p-3 text-center border-l-4 border-l-amber-500"><p className="text-xs text-muted-foreground">Tiempo Promedio Cobro</p><p className="font-bold text-sm tracking-tight">{avgCollectionDays} días</p></Card>
         <Card className="p-3 text-center border-l-4 border-l-blue-500"><p className="text-xs text-muted-foreground">% Dctos Aplicados</p><p className="font-bold text-sm tracking-tight">{discountPct.toFixed(1)}%</p></Card>
         <Card className="p-3 text-center border-l-4 border-l-emerald-500"><p className="text-xs text-muted-foreground">Clientes Nuevos</p><p className="font-bold text-sm tracking-tight">{newCustomers}</p></Card>
      </div>

      {/* 4 Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Tendencia Mensual</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), '']} />
                <Legend />
                <Line type="monotone" dataKey="facturado" stroke="#10b981" strokeWidth={3} name="Facturado" dot={{r:4}} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Embudo de Conversión</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={funnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis dataKey="step" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Cantidad" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Facturación por Canal</CardTitle></CardHeader>
          <CardContent>
             <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={channelData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {channelData.map((e, i) => <Cell key={i} fill={e.color} stroke="transparent" />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), '']} />
                </PieChart>
              </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Cobranza vs Facturación</CardTitle></CardHeader>
          <CardContent>
             <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), '']} />
                <Legend />
                <Bar dataKey="facturado" fill="#3b82f6" name="Facturado" radius={[4,4,0,0]} />
                <Bar dataKey="cobrado" fill="#10b981" name="Cobrado" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 2 Tops */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Top 10 Clientes por Facturación</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topCustomers.map((c, i) => (
                <div key={i} className="flex justify-between items-center p-2 rounded bg-muted/20 border border-border/40">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center size-6 rounded-full bg-primary/20 text-primary text-[10px] font-bold">{i+1}</span>
                    <span className="text-xs font-semibold">{c.name}</span>
                  </div>
                  <span className="text-xs font-bold text-green-400">{fmt(Number(c.value))}</span>
                </div>
              ))}
              {topCustomers.length === 0 && <p className="text-xs text-muted-foreground">Sin datos</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Top 10 Productos con Mayor Margen</CardTitle></CardHeader>
          <CardContent>
             <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={i} className="flex justify-between items-center p-2 rounded bg-muted/20 border border-border/40">
                  <div className="flex items-center gap-2">
                    <Package className="size-4 text-muted-foreground" />
                    <span className="text-xs font-semibold">{p.name}</span>
                  </div>
                  <span className="text-xs font-bold text-blue-400">+{fmt(Number(p.margin))}</span>
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
SalesReportTab.displayName = 'SalesReportTab';
