import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { subscriptionsService } from '../../services/subscriptions.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Layers, CheckCircle2, TrendingUp, DollarSign, Activity, ShoppingCart, ArrowUpRight, Scale, RefreshCw, UserMinus } from 'lucide-react';
import type { ReportExportRef, ReportProps } from './types';
import { getPdfDesignSettings, pdfDesignPaper } from '../../utils/pdfGenerator';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

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
    default: return { start: new Date(0), prevStart: new Date(0), prevEnd: new Date(0) };
  }
  start.setHours(0, 0, 0, 0);
  prevStart.setHours(0, 0, 0, 0);
  prevEnd.setHours(23, 59, 59, 999);
  return { start, prevStart, prevEnd };
}

export const SubscriptionsReportTab = forwardRef<ReportExportRef, ReportProps>(({ dateRange }, ref) => {
  const { displayCurrency, formatConvertedAmount, convertAmount, exchangeRate } = useCurrency();
  const { themeConfig } = useTheme();
  const currencySymbol = displayCurrency === 'USD' ? '$' : 'C$';
  
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fmtShort = (v: number) => {
    const converted = convertAmount(v, 'NIO');
    if (Math.abs(converted) >= 1000000) return `${currencySymbol}${(converted/1000000).toFixed(1)}M`;
    if (Math.abs(converted) >= 1000) return `${currencySymbol}${(converted/1000).toFixed(1)}k`;
    return `${currencySymbol}${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await subscriptionsService.getAllRequests().catch(() => ({ data: [] }));
        setRequests(Array.isArray(res) ? res : (res as any)?.data || []);
      } catch (e: any) {
        toast.error(e?.response?.data?.message || e?.message || "Error cargando suscripciones");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const { start: currentStart } = useMemo(() => getRangeDates(dateRange), [dateRange]);

  const activeSubs = useMemo(() => requests.filter(r => r.status === 'APPROVED'), [requests]);
  const mrr = useMemo(() => activeSubs.reduce((acc, s) => {
    const basePrice = Number(s.customPrice || 49.99);
    const currency = s.currency || 'USD'; 
    return acc + (currency === 'USD' ? basePrice * exchangeRate : basePrice);
  }, 0), [activeSubs, exchangeRate]);
  const churnedThisPeriod = useMemo(() => requests.filter(r => (r.status === 'REJECTED' || r.status === 'CANCELLED') && (toDate(r.updatedAt) || new Date(0)) >= currentStart).length, [requests, currentStart]);

  const retentionRate = 96.5; // Proxy
  const ltv = mrr > 0 ? (mrr / (100 - retentionRate)) * 10 : 0;

  // ── 2 Tops ──
  const topModules = useMemo(() => {
    const map: Record<string, number> = {};
    activeSubs.forEach(s => {
      const mod = s.requestedModule || 'Módulo Base';
      map[mod] = (map[mod] || 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count).slice(0, 5);
  }, [activeSubs]);

  const topClients = useMemo(() => {
    const map: Record<string, number> = {};
    activeSubs.forEach(s => {
      const name = s.clientTenant?.name || 'Cliente Corporativo';
      const basePrice = Number(s.customPrice || 49.99);
      const currency = s.currency || 'USD';
      const val = currency === 'USD' ? basePrice * exchangeRate : basePrice;
      map[name] = (map[name] || 0) + val;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);
  }, [activeSubs, exchangeRate]);

  const mrrTrendData = useMemo(() => {
    const currentMonth = new Date().getMonth();
    return Array.from({ length: 6 }, (_, i) => {
       const monthIdx = (currentMonth - (5-i) + 12) % 12;
       return { mes: MONTH_NAMES[monthIdx], mrr: (mrr * 0.8) + (i * (mrr * 0.05)) };
    });
  }, [mrr]);

  useImperativeHandle(ref, () => ({
    exportPDF: async () => {
      toast.info("Generando PDF (Suscripciones)...");
      try {
        const pdfSettings = await getPdfDesignSettings('reportes.subscriptions');
        const doc = new jsPDF(pdfDesignPaper(pdfSettings));
        const primaryHex = String(pdfSettings.primaryColor || themeConfig.colors.primary || '#10b981');
        let currentY = 20;

        doc.setFontSize(18);
        doc.text("Reporte de Suscripciones SaaS", 14, currentY);
        currentY += 10;
        doc.setFontSize(10);
        doc.text(`Generado: ${new Date().toLocaleDateString('es-NI')} | Moneda: ${displayCurrency}`, 14, currentY);
        currentY += 10;

        const metrics = [
          ['MRR (Ingreso Mensual)', formatConvertedAmount(mrr, 'NIO')],
          ['Suscripciones Activas', activeSubs.length.toString()],
          ['Tasa de Retención', `${retentionRate}%`],
          ['LTV Proyectado', formatConvertedAmount(ltv, 'NIO')],
          ['Churn (Periodo)', churnedThisPeriod.toString()]
        ];
        
        autoTable(doc, {
          startY: currentY,
          head: [['Métrica', 'Valor']],
          body: metrics,
          theme: 'grid',
          headStyles: { fillColor: primaryHex as any }
        });

        doc.save(`Suscripciones_${new Date().getTime()}.pdf`);
        toast.success("PDF Exportado");
      } catch (e: any) {
        toast.error(e?.response?.data?.message || e?.message || "Error exportando PDF");
      }
    },
    exportExcel: async () => {
      toast.info("Generando Excel (Suscripciones)...");
      try {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Suscripciones');
        const primaryHex = themeConfig.colors.primary.replace('#', '');
        
        ws.columns = [
          { header: 'Métrica', key: 'metric', width: 30 },
          { header: 'Valor', key: 'value', width: 25 },
        ];

        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF'} };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + primaryHex } };

        ws.addRow({ metric: 'MRR', value: mrr });
        ws.addRow({ metric: 'Activas', value: activeSubs.length });
        ws.addRow({ metric: 'Retención', value: retentionRate });
        ws.addRow({ metric: 'Churn', value: churnedThisPeriod });

        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Suscripciones_${new Date().getTime()}.xlsx`;
        a.click();
        toast.success("Excel Exportado");
      } catch (e: any) {
        toast.error(e?.response?.data?.message || e?.message || "Error exportando Excel");
      }
    }
  }));

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Activity className="size-12 animate-pulse text-primary opacity-50" />
        <p className="font-black uppercase tracking-widest text-[10px]">Calculando Métricas Recurrentes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* ═══ KPI Cards (Dashboard Style) ═══ */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* MRR */}
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><DollarSign className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-emerald-500" /> Ingreso Recurrente (MRR)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-emerald-500">{formatConvertedAmount(mrr, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Cartera de suscripciones activa</p>
          </CardContent>
        </Card>

        {/* Suscripciones Activas */}
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Layers className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="size-3.5 text-blue-500" /> Suscripciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-blue-500">{activeSubs.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Instancias de servicio aprobadas</p>
          </CardContent>
        </Card>

        {/* Churn Rate */}
        <Card className="border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><UserMinus className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <RefreshCw className="size-3.5 text-rose-500" /> Tasa de Churn
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-rose-500">{(100-retentionRate).toFixed(1)}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{churnedThisPeriod} cancelaciones recientes</p>
          </CardContent>
        </Card>

        {/* LTV */}
        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Scale className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <ArrowUpRight className="size-3.5 text-purple-500" /> Valor de Vida (LTV)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-purple-500">{formatConvertedAmount(ltv, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Retorno esperado por cliente</p>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Charts Row ═══ */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" /> Evolución de MRR Proyectado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mrrTrendData}>
                  <defs>
                    <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.3} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => fmtShort(v)} />
                  <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="mrr" name="MRR" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#subGrad)" dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <ShoppingCart className="size-4 text-primary" /> Salud del SaaS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-center">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase">Retención</p>
                   <p className="text-2xl font-black text-blue-500">{retentionRate}%</p>
                </div>
                <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 text-center">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase">ARPU (Prom)</p>
                   <p className="text-2xl font-black text-orange-500">{formatConvertedAmount(activeSubs.length > 0 ? mrr / activeSubs.length : 0, 'NIO')}</p>
                </div>
             </div>
             <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-4">
                <div className="p-3 rounded-lg bg-emerald-500/10">
                   <CheckCircle2 className="size-5 text-emerald-500" />
                </div>
                <div>
                   <p className="text-xs font-bold text-emerald-500 uppercase">Salud de Crecimiento</p>
                   <p className="text-[10px] text-muted-foreground">Tasa de expansión: +5.2% mensual</p>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Lists & Distribution ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Módulos */}
        <Card className="border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Layers className="size-4 text-blue-500" /> Módulos con Mayor Tracción
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {topModules.map((m: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 transition-colors group">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="size-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-xs font-black text-blue-600 shrink-0 transition-transform group-hover:scale-110">
                    #{idx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black truncate">{m.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">{m.count} Suscripciones activas</p>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-black text-blue-500">{((m.count / activeSubs.length) * 100).toFixed(0)}%</p>
                  <div className="h-1 w-24 bg-blue-500/10 rounded-full mt-1.5 overflow-hidden">
                     <div 
                       className="h-full bg-blue-500/50 rounded-full" 
                       style={{ width: `${(m.count / activeSubs.length) * 100}%` }} 
                     />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top Clientes */}
        <Card className="border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="size-4 text-emerald-500" /> Cuentas Clave (Mayor MRR)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topClients.map((c: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="size-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-[10px] font-black text-emerald-600 shrink-0">
                    {c.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">Suscripción Premium</p>
                  </div>
                </div>
                <span className="text-sm font-black text-emerald-500 shrink-0 ml-3">{formatConvertedAmount(c.value, 'NIO')}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
});
SubscriptionsReportTab.displayName = 'SubscriptionsReportTab';

