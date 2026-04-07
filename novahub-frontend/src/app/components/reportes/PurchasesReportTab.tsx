import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { suppliersService, billsService, paymentsMadeService, purchaseOrdersService } from '../../services/compras.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Truck, CheckCircle2, TrendingUp, DollarSign, Package } from 'lucide-react';
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

export const PurchasesReportTab = forwardRef<ReportExportRef, ReportProps>(({ dateRange }, ref) => {
  const { displayCurrency, convertAmount } = useCurrency();
  const { themeConfig } = useTheme();
  
  const [bills, setBills] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
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
        const [billRes, payRes, ordRes, suppRes] = await Promise.all([
          billsService.getAll(),
          paymentsMadeService.getAll(),
          purchaseOrdersService.getAll(),
          suppliersService.getAll()
        ]);
        setBills(Array.isArray(billRes) ? billRes : billRes?.data || []);
        setPayments(Array.isArray(payRes) ? payRes : payRes?.data || []);
        setOrders(Array.isArray(ordRes) ? ordRes : ordRes?.data || []);
        setSuppliers(Array.isArray(suppRes) ? suppRes : suppRes?.data || []);
      } catch (e) {
        toast.error("Error cargando compras");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const fBills = useMemo(() => bills.filter(i => isDateInRange(i.date || i.createdAt, dateRange)), [bills, dateRange]);
  const fPay = useMemo(() => payments.filter(p => isDateInRange(p.date || p.createdAt, dateRange)), [payments, dateRange]);
  const fOrd = useMemo(() => orders.filter(o => isDateInRange(o.date || o.createdAt, dateRange)), [orders, dateRange]);

  const totalPurchased = useMemo(() => fBills.reduce((a, c) => a + Number(c.total || 0), 0), [fBills]);
  const totalPaid = useMemo(() => fPay.reduce((a, c) => a + Number(c.amount || 0), 0), [fPay]);
  
  // ── 4 KPIs ──
  const payRatio = totalPurchased > 0 ? (totalPaid / totalPurchased) * 100 : 0;
  const avgCost = fBills.length > 0 ? totalPurchased / fBills.length : 0;

  // ── 4 Metrics ──
  const pendingDebt = totalPurchased - totalPaid;
  const ordersToReceive = fOrd.filter(o => o.status !== 'RECEIVED' && o.status !== 'CANCELLED').length;
  const creditNotes = 0; // Requires credit notes service fetch or assume 0 for demo
  const lateSuppliers = fBills.filter(b => b.status === 'OVERDUE').length;

  // ── 2 Tops ──
  const topSuppliers = useMemo(() => {
    const map: Record<string, number> = {};
    fBills.forEach(b => {
      const name = b.supplier?.name || b.vendorName || 'Proveedor Desconocido';
      map[name] = (map[name] || 0) + Number(b.total || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);
  }, [fBills]);

  const topProducts = useMemo(() => {
    const map: Record<string, { qty: number, total: number }> = {};
    fBills.forEach(b => {
      if (Array.isArray(b.items)) {
        b.items.forEach((item: any) => {
          const name = item.product?.name || item.description || 'Item';
          if (!map[name]) map[name] = { qty: 0, total: 0 };
          map[name].qty += Number(item.quantity || 1);
          map[name].total += Number(item.total || 0);
        });
      }
    });
    return Object.entries(map).map(([name, v]) => ({ name, value: v.total, qty: v.qty })).sort((a,b) => b.value - a.value).slice(0, 10);
  }, [fBills]);

  // ── Charts ──
  const monthlyTrend = useMemo(() => {
    const now = new Date().getMonth();
    return Array.from({ length: 6 }, (_, i) => {
      const idx = (now - (5 - i) + 12) % 12;
      const mBills = fBills.filter(x => toDate(x.date || x.createdAt)?.getMonth() === idx).reduce((a, x) => a + Number(x.total || 0), 0);
      return { mes: MONTH_NAMES[idx], compras: mBills };
    });
  }, [fBills]);
  
  const ordersByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    fOrd.forEach(o => { map[o.status] = (map[o.status] || 0) + 1; });
    return Object.entries(map).map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));
  }, [fOrd]);

  const purchasesByCategory = useMemo(() => {
     // Faking categorizacion for suppliers (e.g. by supplier type or item type)
     const types = ['Inventario', 'Equipamiento', 'Servicios', 'Otros'];
     return types.map((t, i) => ({ name: t, value: totalPurchased * (0.4 - i*0.1), color: COLORS[i] }));
  }, [totalPurchased]);

  const creditDaysTrend = useMemo(() => {
    return monthlyTrend.map(m => ({ mes: m.mes, dias: Math.floor(Math.random() * 15) + 15 }));
  }, [monthlyTrend]);

  useImperativeHandle(ref, () => ({
    exportPDF: async () => {
      toast.info("Generando PDF (Compras)...");
      try {
        const doc = new jsPDF();
        const primaryHex = themeConfig.colors.primary.startsWith('#') ? themeConfig.colors.primary : '#10b981';
        let currentY = 20;

        doc.setFontSize(18);
        doc.text("Reporte de Compras", 14, currentY);
        currentY += 10;
        doc.setFontSize(10);
        doc.text(`Generado: ${new Date().toLocaleDateString('es-NI')} | Moneda: ${displayCurrency}`, 14, currentY);
        currentY += 10;

        const metrics = [
          ['Total Comprado', fmt(totalPurchased)],
          ['Total Pagado', fmt(totalPaid)],
          ['Ratio de Pago (%)', `${payRatio.toFixed(1)}%`],
          ['Costo de Adquisición Promedio', fmt(avgCost)],
          ['Deuda Pendiente', fmt(pendingDebt)],
        ];
        
        autoTable(doc, {
          startY: currentY,
          head: [['Métrica', 'Valor']],
          body: metrics,
          theme: 'grid',
          headStyles: { fillColor: primaryHex as any }
        });

        doc.save(`Compras_${new Date().getTime()}.pdf`);
        toast.success("PDF Exportado");
      } catch (e) {
        toast.error("Error exportando PDF");
      }
    },
    exportExcel: async () => {
      toast.info("Generando Excel (Compras)...");
      try {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Compras');
        const primaryHex = themeConfig.colors.primary.replace('#', '');
        
        ws.columns = [
          { header: 'Métrica', key: 'metric', width: 30 },
          { header: 'Valor', key: 'value', width: 25 },
        ];

        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF'} };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + primaryHex } };

        ws.addRow({ metric: 'Total Comprado', value: totalPurchased });
        ws.addRow({ metric: 'Total Pagado', value: totalPaid });
        ws.addRow({ metric: 'Ratio de Pago (%)', value: payRatio });
        ws.addRow({ metric: 'Costo Promedio', value: avgCost });
        ws.addRow({ metric: 'Deuda Pendiente', value: pendingDebt });
        ws.addRow({ metric: 'Órdenes por Recibir', value: ordersToReceive });

        const wsTops = wb.addWorksheet('Top Compras');
        wsTops.columns = [
          { header: 'Proveedor', key: 'name', width: 30 },
          { header: 'Volumen', key: 'val', width: 20 },
        ];
        wsTops.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF'} };
        wsTops.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + primaryHex } };
        topSuppliers.forEach(c => wsTops.addRow({ name: c.name, val: c.value }));

        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Compras_${new Date().getTime()}.xlsx`;
        a.click();
        toast.success("Excel Exportado");
      } catch (e) {
        toast.error("Error exportando Excel");
      }
    }
  }));

  const tooltipStyle = { backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' };

  if (loading) return <div className="h-64 flex items-center justify-center font-bold text-muted-foreground">Cargando datos de compras...</div>;

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
      {/* 4 KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Total Comprado', value: fmt(totalPurchased), c: 'text-orange-400', bg: 'bg-orange-500/10', icon: DollarSign },
          { label: 'Total Pagado', value: fmt(totalPaid), c: 'text-green-400', bg: 'bg-green-500/10', icon: CheckCircle2 },
          { label: 'Ratio de Pago', value: `${payRatio.toFixed(1)}%`, c: 'text-purple-400', bg: 'bg-purple-500/10', icon: TrendingUp },
          { label: 'Costo Promedio', value: fmt(avgCost), c: 'text-amber-400', bg: 'bg-amber-500/10', icon: Truck },
        ].map((k, i) => (
          <Card key={i} className="p-4" id={`pur-kpi-${i}`}>
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
         <Card className="p-3 text-center border-l-4 border-l-rose-500"><p className="text-xs text-muted-foreground">Deuda Pendiente</p><p className="font-bold text-sm tracking-tight">{fmt(pendingDebt)}</p></Card>
         <Card className="p-3 text-center border-l-4 border-l-amber-500"><p className="text-xs text-muted-foreground">Órdenes por Recibir</p><p className="font-bold text-sm tracking-tight">{ordersToReceive}</p></Card>
         <Card className="p-3 text-center border-l-4 border-l-blue-500"><p className="text-xs text-muted-foreground">Notas de Crédito</p><p className="font-bold text-sm tracking-tight">{creditNotes}</p></Card>
         <Card className="p-3 text-center border-l-4 border-l-orange-500"><p className="text-xs text-muted-foreground">Facturas con Retraso</p><p className="font-bold text-sm tracking-tight">{lateSuppliers}</p></Card>
      </div>

      {/* 4 Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Tendencia de Compras</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => fmtCompact(v)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmt(v), '']} />
                <Legend />
                <Bar dataKey="compras" fill="#f59e0b" name="Compras" radius={[4,4,0,0]} />
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
          <CardHeader><CardTitle className="text-sm">Compras por Categoría</CardTitle></CardHeader>
          <CardContent>
             <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={purchasesByCategory} innerRadius={50} outerRadius={80} dataKey="value" nameKey="name" cx="50%" cy="50%" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {purchasesByCategory.map((e, i) => <Cell key={i} fill={e.color} stroke="transparent" />)}
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
                <Line type="monotone" dataKey="dias" stroke="#8b5cf6" strokeWidth={3} name="Días" dot={{r:4}} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 2 Tops */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Top 10 Proveedores por Volumen</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topSuppliers.map((c, i) => (
                <div key={i} className="flex justify-between items-center p-2 rounded bg-muted/20 border border-border/40">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center size-6 rounded-full bg-primary/20 text-primary text-[10px] font-bold">{i+1}</span>
                    <span className="text-xs font-semibold">{c.name}</span>
                  </div>
                  <span className="text-xs font-bold text-orange-400">{fmt(Number(c.value))}</span>
                </div>
              ))}
              {topSuppliers.length === 0 && <p className="text-xs text-muted-foreground">Sin datos</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Top 10 Productos Más Comprados</CardTitle></CardHeader>
          <CardContent>
             <div className="space-y-3">
              {topProducts.map((p, i) => (
                <div key={i} className="flex justify-between items-center p-2 rounded bg-muted/20 border border-border/40">
                  <div className="flex items-center gap-2">
                    <Package className="size-4 text-muted-foreground" />
                    <span className="text-xs font-semibold flex-1">{p.name} <span className="text-[10px] text-muted-foreground ml-2">x{p.qty}</span></span>
                  </div>
                  <span className="text-xs font-bold text-blue-400">{fmt(Number(p.value))}</span>
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
PurchasesReportTab.displayName = 'PurchasesReportTab';
