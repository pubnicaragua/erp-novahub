import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar, LabelList, LineChart, Line, ReferenceLine } from 'recharts';
import { invoicesService, paymentsService } from '../../services/ventas.service';
import { inventoryService } from '../../services/inventario.service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useTheme } from '../../contexts/ThemeContext';
import { TrendingUp, ShoppingCart, ArrowUpRight, Activity, Scale, BarChart3, PieChart as PieChartIcon, Users, Eye, Clock, DollarSign } from 'lucide-react';
import type { ReportExportRef, ReportProps } from './types';
import { getBase64Image, sanitizeHtml2CanvasOklch } from '../../utils/reportExportUtils';
import { cn } from '../ui/utils';
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

export const SalesReportTab = forwardRef<ReportExportRef, ReportProps>(({ dateRange }, ref) => {
  const { displayCurrency, formatConvertedAmount, convertAmount, exchangeRate } = useCurrency();
  const { themeConfig } = useTheme();
  const currencySymbol = displayCurrency === 'USD' ? '$' : 'C$';
  
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailModal, setDetailModal] = useState<{ type: 'customer' | 'product'; data: any } | null>(null);

  const fmtShort = (v: number) => {
    const num = Number(v);
    if (!Number.isFinite(num)) return `${currencySymbol}0`;
    const converted = convertAmount(num, 'NIO');
    if (!Number.isFinite(converted)) return `${currencySymbol}0`;
    const abs = Math.abs(converted);
    if (abs >= 1_000_000) return `${currencySymbol}${(converted / 1_000_000).toLocaleString('es-NI', { maximumFractionDigits: 1 })} millones`;
    if (abs >= 1_000) return `${currencySymbol}${(converted / 1_000).toLocaleString('es-NI', { maximumFractionDigits: 0 })} mil`;
    return `${currencySymbol}${converted.toLocaleString('es-NI', { maximumFractionDigits: 0 })}`;
  };

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [invRes, payRes, prodRes] = await Promise.all([
          invoicesService.getAll().catch(() => ({ data: [] })),
          paymentsService.getAll().catch(() => ({ data: [] })),
          inventoryService.getProducts().catch(() => ({ data: [] }))
        ]);
        setInvoices(Array.isArray(invRes) ? invRes : invRes?.data || []);
        setPayments(Array.isArray(payRes) ? payRes : payRes?.data || []);
        setProducts(Array.isArray(prodRes) ? prodRes : prodRes?.data || []);
      } catch (e: any) {
        toast.error(e?.response?.data?.message || e?.message || "Error cargando ventas");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const { start: currentStart, prevStart, prevEnd } = useMemo(() => getRangeDates(dateRange), [dateRange]);

  const fInv = useMemo(() => invoices.filter(i => {
    const d = toDate(i.date || i.createdAt);
    return d && d >= currentStart;
  }), [invoices, currentStart]);

  const pInv = useMemo(() => invoices.filter(i => {
    const d = toDate(i.date || i.createdAt);
    return d && d >= prevStart && d <= prevEnd;
  }), [invoices, prevStart, prevEnd]);

  const fPay = useMemo(() => payments.filter(i => {
    const d = toDate(i.date || i.createdAt);
    return d && d >= currentStart;
  }), [payments, currentStart]);

  const totalBilled = useMemo(() => fInv.reduce((acc, i) => acc + (i.currency === 'USD' ? Number(i.total || 0) * (i.exchangeRate || exchangeRate) : Number(i.total || 0)), 0), [fInv, exchangeRate]);
  const prevTotalBilled = useMemo(() => pInv.reduce((acc, i) => acc + (i.currency === 'USD' ? Number(i.total || 0) * (i.exchangeRate || exchangeRate) : Number(i.total || 0)), 0), [pInv, exchangeRate]);

  // Ventas netas: facturado − descuentos − devoluciones/notas de crédito
  const { totalDiscounts, netSales } = useMemo(() => {
    let gross = 0;
    let discounts = 0;
    fInv.forEach(i => {
      const mult = i.currency === 'USD' ? (i.exchangeRate || exchangeRate) : 1;
      gross += Number(i.total || 0) * mult;
      discounts += Number(i.discountAmount ?? i.discount ?? 0) * mult;
    });
    const creditNotes = fInv
      .filter(i => String(i.type || '').toUpperCase() === 'CREDIT_NOTE' || i.isCreditNote === true || i.isReturn === true)
      .reduce((a, i) => a + (i.currency === 'USD' ? Number(i.total || 0) * (i.exchangeRate || exchangeRate) : Number(i.total || 0)), 0);
    return { totalDiscounts: discounts + creditNotes, netSales: Math.max(0, gross - discounts - creditNotes) };
  }, [fInv, exchangeRate]);

  const totalPaid = useMemo(() => fPay.reduce((acc, p) => acc + (p.currency === 'USD' ? Number(p.amount || 0) * (p.exchangeRate || exchangeRate) : Number(p.amount || 0)), 0), [fPay, exchangeRate]);
  const totalPending = useMemo(() => {
    const pend = fInv.filter(i => { const s = String(i.status || '').toUpperCase(); return s !== 'PAID' && s !== 'CANCELLED' && s !== 'CANCELED'; });
    return pend.reduce((acc, i) => acc + (i.currency === 'USD' ? Number(i.balanceDue ?? (i.total || 0)) * (i.exchangeRate || exchangeRate) : Number(i.balanceDue ?? (i.total || 0))), 0);
  }, [fInv, exchangeRate]);

  const { totalCost, costMissing } = useMemo(() => {
    let cost = 0;
    let missing = 0;
    fInv.forEach((i) => {
      if (String(i.type || '').toUpperCase() === 'CREDIT_NOTE') return;
      let invCost = Number(i.totalCost || 0);
      if (!invCost && i.items) {
        invCost = i.items.reduce((sum: number, item: any) => {
          const itemCost = Number(item.costPrice || item.product?.costPrice || 0);
          if (!itemCost) missing++;
          return sum + itemCost * Number(item.quantity || 1);
        }, 0);
      }
      if (!invCost && !i.items) missing++;
      cost += (i.currency === 'USD' ? invCost * (i.exchangeRate || exchangeRate) : invCost);
    });
    return { totalCost: cost, costMissing: missing };
  }, [fInv, exchangeRate]);

  const grossProfit = netSales > 0 && !costMissing ? netSales - totalCost : null;
  const grossMargin = grossProfit !== null && netSales > 0 ? (grossProfit / netSales) * 100 : null;
  const avgTicket = fInv.length > 0 ? netSales / fInv.length : 0;

  const prevLabel = prevEnd.toLocaleDateString('es-NI', { month: 'long', year: 'numeric' });

  const getTrendInfo = (curr: number, prev: number) => {
    if (prev === 0) return { pct: null, text: 'Sin base comparable' };
    const pct = ((curr - prev) / prev) * 100;
    const diff = curr - prev;
    const diffFmt = `${diff >= 0 ? '+' : ''}${currencySymbol}${diff.toLocaleString('es-NI', { maximumFractionDigits: 2 })}`;
    return { pct, text: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs. ${prevLabel} · Diferencia: ${diffFmt}` };
  };

  const netTrend = getTrendInfo(netSales, prevTotalBilled > 0 ? prevTotalBilled : 0);

  // ── 2 Tops ──
  const topCustomers = useMemo(() => {
    const map: Record<string, number> = {};
    fInv.forEach(inv => {
      const name = inv.customer?.name || inv.customerName || 'Consumidor Final';
      const val = inv.currency === 'USD' ? Number(inv.total || 0) * (inv.exchangeRate || exchangeRate) : Number(inv.total || 0);
      map[name] = (map[name] || 0) + val;
    });
    const prevMap: Record<string, number> = {};
    pInv.forEach(inv => {
      const name = inv.customer?.name || inv.customerName || 'Consumidor Final';
      const val = inv.currency === 'USD' ? Number(inv.total || 0) * (inv.exchangeRate || exchangeRate) : Number(inv.total || 0);
      prevMap[name] = (prevMap[name] || 0) + val;
    });
    return Object.entries(map)
      .map(([name, value]) => ({
        name,
        value,
        pct: totalBilled > 0 ? (value / totalBilled) * 100 : 0,
        facturas: fInv.filter(i => (i.customer?.name || i.customerName || 'Consumidor Final') === name).length,
        prevValue: prevMap[name] || 0,
        trendPct: prevMap[name] > 0 ? ((value - prevMap[name]) / prevMap[name]) * 100 : null,
      }))
      .sort((a, b) => b.value - a.value).slice(0, 5);
  }, [fInv, pInv, totalBilled, exchangeRate]);

  const [productMetric, setProductMetric] = useState<'revenue' | 'qty' | 'profit'>('revenue');

  const topProductsByQty = useMemo(() => {
    const qtyMap: Record<string, { name: string; qty: number; revenue: number; profit: number }> = {};
    fInv.forEach(inv => {
      if (String(inv.type || '').toUpperCase() === 'CREDIT_NOTE') return;
      (inv.items || []).forEach((item: any) => {
        const name = item.product?.name || item.description || 'Producto';
        const q = Number(item.quantity || 0);
        const unitPrice = Number(item.unitPrice || 0);
        const unitCost = Number(item.costPrice || item.product?.costPrice || 0);
        const rev = (inv.currency === 'USD' ? unitPrice * q * (inv.exchangeRate || exchangeRate) : unitPrice * q);
        const cost = (inv.currency === 'USD' ? unitCost * q * (inv.exchangeRate || exchangeRate) : unitCost * q);
        if (!qtyMap[name]) qtyMap[name] = { name, qty: 0, revenue: 0, profit: 0 };
        qtyMap[name].qty += q;
        qtyMap[name].revenue += rev;
        qtyMap[name].profit += rev - cost;
      });
    });
    if (Object.keys(qtyMap).length === 0) {
      return [...products].slice(0, 5).map(p => ({ name: p.name, qty: 0, revenue: 0, profit: 0 }));
    }
    const list = Object.values(qtyMap);
    const sortKey = productMetric === 'qty' ? 'qty' : productMetric === 'profit' ? 'profit' : 'revenue';
    return list.sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number)).slice(0, 5);
  }, [fInv, products, productMetric, exchangeRate]);

  const catComposition = useMemo(() => {
    const catMap: Record<string, number> = {};
    let itemsWithCat = 0;
    fInv.forEach(inv => {
      (inv.items || []).forEach((item: any) => {
        const cat = item.product?.category?.name || item.category || 'Sin categoría';
        const val = inv.currency === 'USD' ? Number(item.total || item.unitPrice * (item.quantity || 1) || 0) * (inv.exchangeRate || exchangeRate) : Number(item.total || item.unitPrice * (item.quantity || 1) || 0);
        catMap[cat] = (catMap[cat] || 0) + val;
        if (cat !== 'Sin categoría') itemsWithCat++;
      });
    });
    const entries = Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    const top = entries.slice(0, 6);
    const rest = entries.slice(6);
    if (rest.length > 0) top.push({ name: 'Otras categorías', value: rest.reduce((a, r) => a + r.value, 0) });
    return { data: top, onlyUncategorized: entries.length > 0 && top.every(e => e.name === 'Sin categoría'), hasData: entries.length > 0 };
  }, [fInv, exchangeRate]);

  // ── Charts ──
  const monthlyData = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const data: any[] = [];

    for (let i = 5; i >= 0; i--) {
      const monthIdx = (currentMonth - i + 12) % 12;
      const year = currentMonth - i < 0 ? currentYear - 1 : currentYear;
      
      const mBilled = fInv.filter(inv => {
        const d = new Date(inv.date || inv.createdAt);
        return d.getMonth() === monthIdx && d.getFullYear() === year;
      }).reduce((acc: number, i: any) => acc + (i.currency === 'USD' ? Number(i.total || 0) * (i.exchangeRate || exchangeRate) : Number(i.total || 0)), 0);
      
      const mPaid = fPay.filter(pay => {
        const d = new Date(pay.date || pay.createdAt);
        return d.getMonth() === monthIdx && d.getFullYear() === year;
      }).reduce((acc: number, p: any) => acc + (p.currency === 'USD' ? Number(p.amount || 0) * (p.exchangeRate || exchangeRate) : Number(p.amount || 0)), 0);
      
      data.push({
        key: `${year}-${monthIdx}`,
        mes: MONTH_NAMES[monthIdx],
        facturado: Number.isFinite(mBilled) ? Math.round(mBilled) : 0,
        cobrado: Number.isFinite(mPaid) ? Math.round(mPaid) : 0,
      });
    }
    return data;
  }, [fInv, fPay, exchangeRate]);

  // Historial válido: meses cerrados (excluye mes actual incompleto) desde el primer mes con actividad
  const validHistory = useMemo(() => {
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${now.getMonth()}`;
    const closed = monthlyData.filter(d => d.key !== currentKey);
    const firstIdx = closed.findIndex(d => d.facturado > 0);
    return firstIdx === -1 ? [] : closed.slice(firstIdx);
  }, [monthlyData]);

  const canProject = validHistory.length >= 6 && validHistory.filter(d => d.facturado > 0).length >= 4;

  const salesTrend = useMemo(() => {
    let cumulative = 0;
    const firstIdx = monthlyData.findIndex(d => d.facturado > 0);
    const start = firstIdx === -1 ? monthlyData : monthlyData.slice(firstIdx);
    return start.map(d => {
      cumulative += d.facturado;
      return { mes: d.mes, ventas: cumulative };
    });
  }, [monthlyData]);

  const projectionData = useMemo(() => {
    if (!canProject) return monthlyData.map(d => ({ ...d, projection: null }));
    const active = validHistory.filter(d => d.facturado > 0).slice(-4);
    let totalGrowth = 0;
    for (let i = 1; i < active.length; i++) {
      const prev = active[i - 1].facturado || 1;
      totalGrowth += (active[i].facturado - prev) / prev;
    }
    const avgGrowth = totalGrowth / Math.max(active.length - 1, 1);
    const lastVal = active[active.length - 1].facturado;
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const nextMonthIdx = (new Date().getMonth() + 1) % 12;
    const proj = [];
    for (let i = 1; i <= 3; i++) {
      const val = Math.round(lastVal * Math.pow(1 + avgGrowth, i));
      proj.push({ mes: `Est. ${monthNames[(nextMonthIdx + i - 1) % 12]}`, projection: Number.isFinite(val) ? val : 0, facturado: null, cobrado: null });
    }
    return [...monthlyData.map(d => ({ ...d, projection: null })), ...proj];
  }, [canProject, validHistory, monthlyData]);

  // Antigüedad de CxC
  const cxcAging = useMemo(() => {
    const pend = fInv.filter(i => { const s = String(i.status || '').toUpperCase(); return s !== 'PAID' && s !== 'CANCELLED' && s !== 'CANCELED'; });
    const ranges = [
      { label: 'Corriente', min: -Infinity, max: 0 },
      { label: '1–30 días', min: 1, max: 30 },
      { label: '31–60 días', min: 31, max: 60 },
      { label: '61–90 días', min: 61, max: 90 },
      { label: 'Más de 90 días', min: 91, max: Infinity },
    ];
    return ranges.map(r => {
      const items = pend.filter(inv => {
        const due = inv.dueDate ? new Date(inv.dueDate) : null;
        const days = due ? Math.floor((Date.now() - due.getTime()) / 86400000) : -Infinity;
        return days >= r.min && days <= r.max;
      });
      const monto = items.reduce((a, inv) => a + (inv.currency === 'USD' ? Number(inv.balanceDue ?? (inv.total || 0)) * (inv.exchangeRate || exchangeRate) : Number(inv.balanceDue ?? (inv.total || 0))), 0);
      return { label: r.label, monto, facturas: items.length };
    });
  }, [fInv, exchangeRate]);

  const [evolutionTab, setEvolutionTab] = useState<'acumulada' | 'aging'>('acumulada');

  useImperativeHandle(ref, () => ({
    exportPDF: async () => {
      try {
        toast.info("Generando PDF (Ventas), por favor espere...");
        const pdfSettings = await getPdfDesignSettings('reportes.sales');
        const doc = new jsPDF(pdfDesignPaper(pdfSettings));
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const companyName = themeConfig.tenantName || 'Mi Empresa';
        const logoUrl = themeConfig.logo || '';
        const primaryColor = pdfSettings.primaryColor || themeConfig.colors.primary || '#10b981';
        const primaryHex = primaryColor.startsWith('#') ? primaryColor : '#10b981';
        const rgbPrimary = primaryHex.startsWith('#') ? [parseInt(primaryHex.slice(1,3), 16), parseInt(primaryHex.slice(3,5), 16), parseInt(primaryHex.slice(5,7), 16)] : [16, 185, 129];
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
        doc.text(`Reporte de Ventas`, pageWidth / 2, currentY, { align: 'center' }); currentY += 6;
        
        const now = new Date();
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120);
        const currencyLabel = displayCurrency === 'USD' ? 'Dólares (USD)' : 'Córdobas (NIO)';
        doc.text(`Generado: ${now.toLocaleDateString('es-NI')} ${now.toLocaleTimeString('es-NI')}  |  Moneda: ${currencyLabel}`, pageWidth / 2, currentY, { align: 'center' });
        currentY += 5;

        doc.setDrawColor(rgbPrimary[0], rgbPrimary[1], rgbPrimary[2]); doc.setLineWidth(0.8);
        doc.line(marginX, currentY, pageWidth - marginX, currentY); currentY += 10;

        const kpis = [
          { label: 'FACTURACIÓN', value: formatConvertedAmount(totalBilled, 'NIO'), detail: `${fInv.length} facturas`, color: [16, 185, 129] },
          { label: 'COBRANZA', value: formatConvertedAmount(totalPaid, 'NIO'), detail: 'Cobros recibidos en el período', color: [59, 130, 246] },
          { label: 'MARGEN BRUTO', value: grossMargin === null ? 'N/D' : `${grossMargin.toFixed(1)}%`, detail: costMissing ? 'No calculable: productos sin costo' : 'Ventas netas − costo de venta', color: [168, 85, 247] },
          { label: 'TICKET PROM.', value: formatConvertedAmount(avgTicket, 'NIO'), detail: 'Valor medio', color: [245, 158, 11] },
        ];

        const cols = 4; const boxW = (contentWidth - (cols - 1) * 4) / cols; const boxH = 22;
        checkPage(boxH + 5);
        kpis.forEach((kpi, idx) => {
          const x = marginX + idx * (boxW + 4);
          doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
          doc.roundedRect(x, currentY, boxW, boxH, 3, 3, 'F');
          doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
          doc.text(kpi.label, x + boxW / 2, currentY + 6, { align: 'center' });
          doc.setFontSize(12); doc.text(kpi.value, x + boxW / 2, currentY + 13, { align: 'center' });
          doc.setFontSize(7); doc.setFont('helvetica', 'normal');
          doc.text(kpi.detail, x + boxW / 2, currentY + 18.5, { align: 'center' });
        });
        currentY += boxH + 10;

        const charts = ['sales-chart-bar', 'sales-chart-pie', 'sales-chart-trend', 'sales-health-card'];
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
            const valStr = isMargin ? formatConvertedAmount(Number(item.margin || 0), 'NIO') : formatConvertedAmount(Number(item.value || 0), 'NIO');
            doc.text(valStr, marginX + 130, currentY + 4);
            currentY += 7;
          });
          currentY += 10;
        };

        renderTop('Top 5 Clientes', topCustomers, [59, 130, 246], false);
        renderTop('Top 5 Productos Más Vendidos', topProductsByQty, [168, 85, 247], true);

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
        cellCurrency.value = `Moneda: ${currencyLabel} (${currencySymbol})  |  ${new Date().toLocaleDateString('es-NI')}`;
        cellCurrency.font = { size: 10, italic: true, color: { argb: 'FF888888' } }; cellCurrency.alignment = { horizontal: 'center' }; currentRow += 2;

        const kpis = [
          { label: 'FACTURACIÓN', value: formatConvertedAmount(totalBilled, 'NIO'), detail: `${fInv.length} fact.`, bgColor: 'FF10B981' },
          { label: 'COBRANZA', value: formatConvertedAmount(totalPaid, 'NIO'), detail: 'Cobros del período', bgColor: 'FF3B82F6' },
          { label: 'MARGEN BRUTO', value: grossMargin === null ? 'N/D' : `${grossMargin.toFixed(1)}%`, detail: costMissing ? 'Sin costos' : 'Margen real', bgColor: 'FFA855F7' },
          { label: 'TICKET PROM.', value: formatConvertedAmount(avgTicket, 'NIO'), detail: 'Medio', bgColor: 'FFF59E0B' },
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
            const r = ws.addRow([idx + 1, item.name || 'Sin nombre', isMargin ? Number(item.margin || 0) : Number(item.value || 0), '']);
            r.getCell(1).font = { bold: true }; r.getCell(1).alignment = { horizontal: 'center' };
            r.getCell(3).numFmt = `"${currencySymbol}" #,##0.00`; r.getCell(3).font = { bold: true }; r.getCell(3).alignment = { horizontal: 'right' };
            r.eachCell(c => { c.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder }; });
          });
          ws.addRow([]); ws.addRow([]);
        };

        renderTopTable('Top 5 Clientes', topCustomers, 'FF3B82F6', false);
        renderTopTable('Top 5 Productos Más Vendidos', topProductsByQty, 'FFA855F7', true);

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

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* ═══ KPI Cards (Dashboard Style) ═══ */}
      <div id="sales-report-kpis" className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Ventas Netas */}
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><ShoppingCart className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <ArrowUpRight className="size-3.5 text-emerald-500" /> Ventas Netas
              {netTrend.pct !== null && (
                <span className={cn("ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold", netTrend.pct > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")} title={netTrend.text}>
                  {netTrend.pct > 0 ? '+' : ''}{netTrend.pct.toFixed(1)}%
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-emerald-500">{formatConvertedAmount(netSales, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{fInv.length} facturas emitidas · {netTrend.text}</p>
          </CardContent>
        </Card>

        {/* Cobranza del Período */}
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Scale className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Scale className="size-3.5 text-blue-500" /> Cobranza del Período
              <span className="ml-auto cursor-help text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500" title="Incluye cobros recibidos durante el período seleccionado, independientemente de la fecha de emisión de la factura. Puede incluir recuperación de cartera anterior.">i</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-blue-500">{formatConvertedAmount(totalPaid, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{fPay.length} cobros recibidos</p>
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
            <p className="text-[10px] text-muted-foreground mt-0.5">{costMissing ? `No calculable: ${costMissing} producto(s) vendidos sin costo registrado` : 'Ventas netas − costo de venta'}</p>
          </CardContent>
        </Card>

        {/* Margen Bruto */}
        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-purple-500" /> Margen Bruto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-purple-500">{grossMargin === null ? 'N/D' : `${grossMargin.toFixed(1)}%`}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{costMissing ? `No calculable: ${costMissing} producto(s) sin costo registrado` : 'Utilidad bruta ÷ ventas netas'}</p>
          </CardContent>
        </Card>

        {/* Saldo Pendiente por Cobrar */}
        <Card className="border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Clock className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Clock className="size-3.5 text-rose-500" /> Saldo Pendiente por Cobrar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-rose-500">{formatConvertedAmount(totalPending, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Por cobrar de clientes</p>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Charts Row: Proyección + Composición ═══ */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card id="sales-chart-projection" className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" /> Proyección de Ventas Netas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!canProject ? (
              <div className="h-[320px] w-full flex flex-col items-center justify-center gap-3 text-center">
                <TrendingUp className="size-10 text-muted-foreground/30" />
                <p className="text-sm font-bold text-muted-foreground">Datos históricos insuficientes</p>
                <p className="text-xs text-muted-foreground/70 max-w-md">
                  Se requieren al menos seis meses cerrados con actividad real para calcular una proyección confiable.
                  {validHistory.filter(d => d.facturado > 0).length > 0 && ` Actualmente hay ${validHistory.filter(d => d.facturado > 0).length} mes(es) con ventas y ${validHistory.length} mes(es) cerrados.`}
                </p>
              </div>
            ) : (
            <div className="h-[320px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projectionData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtShort(v)} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700, color: 'hsl(var(--foreground))' }} />
                  <ReferenceLine x={projectionData.filter(d => d.projection === null).slice(-1)[0]?.mes} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: 'Proyección', position: 'top', style: { fontSize: '10px', fill: '#f59e0b', fontWeight: 700 } }} />
                  <Line type="monotone" dataKey="facturado" name="Ventas netas" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} connectNulls />
                  <Line type="monotone" dataKey="projection" name="Estimado" stroke="#f59e0b" strokeWidth={3} strokeDasharray="6 3" dot={{ r: 4, fill: '#f59e0b' }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
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
                <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
                  <PieChartIcon className="size-10 text-muted-foreground/30" />
                  <p className="text-sm font-bold text-muted-foreground">Productos sin categorizar</p>
                  <p className="text-xs text-muted-foreground/70 max-w-xs">Todos los productos vendidos en este período están pendientes de categorización.</p>
                </div>
              ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={catComposition.data}
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    nameKey="name"
                  >
                    {catComposition.data.map((_, idx) => (
                      <Cell key={idx} fill={['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'][idx % 6]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }} formatter={(v: number, name: string) => [formatConvertedAmount(v, 'NIO'), name]} />
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
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrend}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.05}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => fmtShort(v)} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }} formatter={(v: number) => [formatConvertedAmount(v, 'NIO'), 'Venta acumulada']} />
                  <Area type="monotone" dataKey="ventas" stroke="#3b82f6" strokeWidth={2.5} fill="url(#salesGrad)" dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
              {salesTrend.length === 0 && <p className="text-center text-[10px] text-muted-foreground mt-2">Sin movimientos registrados en este período.</p>}
            </div>
            ) : (
            <div className="h-[200px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cxcAging} layout="vertical" margin={{ left: 10, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => fmtShort(v)} />
                  <YAxis dataKey="label" type="category" tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }} width={110} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }} formatter={(v: number) => [formatConvertedAmount(v, 'NIO'), 'Monto']} />
                  <Bar dataKey="monto" name="Monto" radius={[0, 5, 5, 0]} maxBarSize={18}>
                    {cxcAging.map((_, i) => <Cell key={i} fill={['#10b981', '#f59e0b', '#f97316', '#ef4444', '#b91c1c'][i % 5]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            )}
          </CardContent>
        </Card>

        <Card id="sales-chart-bar" className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" /> Ventas Facturadas y Cobros Recibidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} barGap={6}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtShort(v)} />
                  <Tooltip cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }} contentStyle={{ borderRadius: 10, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700, color: 'hsl(var(--foreground))' }} />
                  <Bar dataKey="facturado" name="Ventas netas facturadas" fill="#3b82f6" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="facturado" position="top" formatter={(v: number) => v > 0 ? fmtShort(v) : ''} style={{ fontSize: 8, fill: '#3b82f6', fontWeight: 700 }} />
                  </Bar>
                  <Bar dataKey="cobrado" name="Cobros recibidos" fill="#10b981" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="cobrado" position="top" formatter={(v: number) => v > 0 ? fmtShort(v) : ''} style={{ fontSize: 8, fill: '#10b981', fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
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
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Ventas Brutas</p>
              <p className="text-xl font-black text-emerald-500">{formatConvertedAmount(totalBilled, 'NIO')}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Antes de descuentos y devoluciones</p>
            </div>
            <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Descuentos y Devoluciones</p>
              <p className="text-xl font-black text-rose-500">{formatConvertedAmount(totalDiscounts, 'NIO')}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Descuentos + notas de crédito</p>
            </div>
            <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Costo de Venta</p>
              <p className="text-xl font-black text-orange-500">{costMissing > 0 ? 'N/D' : formatConvertedAmount(totalCost, 'NIO')}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{costMissing > 0 ? `${costMissing} producto(s) sin costo` : 'Costo real de lo vendido'}</p>
            </div>
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Ticket Promedio</p>
              <p className="text-xl font-black text-blue-500">{formatConvertedAmount(avgTicket, 'NIO')}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Ventas netas ÷ facturas</p>
            </div>
            <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/10">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Plazo Promedio de Cobro</p>
              <p className="text-xl font-black text-violet-500">
                {fInv.length > 0 && totalPaid > 0
                  ? (fInv.reduce((acc: number, i: any) => {
                      const d = i.dueDate || i.date ? new Date(i.dueDate || i.date) : null;
                      const pd = i.paidDate || i.paymentDate ? new Date(i.paidDate || i.paymentDate) : null;
                      if (!d || !pd) return acc;
                      return acc + Math.abs(Math.floor((pd.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
                    }, 0) / Math.max(fInv.filter((i: any) => i.paidDate || i.paymentDate).length, 1)).toFixed(1)
                  : 'N/A'}
              </p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Días entre factura y cobro</p>
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
            {topCustomers.map((c: any, idx: number) => (
              <button
                key={idx}
                onClick={() => setDetailModal({ type: 'customer', data: c })}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all cursor-pointer gap-4 text-left"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="size-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-[10px] font-black text-blue-600 shrink-0">
                    #{idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                      {formatConvertedAmount(Number(c.value), 'NIO')} · {c.pct.toFixed(1)}% de las ventas · {c.facturas} facturas
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
            {topProductsByQty.map((p: any, idx: number) => (
              <button
                key={idx}
                onClick={() => setDetailModal({ type: 'product', data: p })}
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
                        ? `${p.qty} unidades`
                        : productMetric === 'profit'
                        ? `Utilidad bruta: ${formatConvertedAmount(p.profit, 'NIO')}`
                        : `Ventas netas: ${formatConvertedAmount(p.revenue, 'NIO')}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-black text-purple-500">
                    {productMetric === 'qty' ? `${p.qty} uds.` : productMetric === 'profit' ? formatConvertedAmount(p.profit, 'NIO') : formatConvertedAmount(p.revenue, 'NIO')}
                  </span>
                  <Eye className="size-4 text-purple-400 shrink-0 opacity-50" />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Detail Modal ═══ */}
      <Dialog open={!!detailModal} onOpenChange={(open) => { if (!open) setDetailModal(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailModal?.type === 'customer' ? <Users className="size-4" /> : <ShoppingCart className="size-4" />}
              {detailModal?.type === 'customer' ? 'Detalle del Cliente' : 'Detalle del Producto'}
            </DialogTitle>
            <DialogDescription>
              {detailModal?.type === 'customer' ? 'Información del cliente y su historial de compras.' : 'Rendimiento del producto en el período seleccionado.'}
            </DialogDescription>
          </DialogHeader>
          {detailModal?.type === 'customer' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                <p className="text-sm font-black">{detailModal.data.name}</p>
                <p className="text-xs text-muted-foreground">Total facturado: {formatConvertedAmount(Number(detailModal.data.value), 'NIO')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Facturas</p>
                  <p className="text-xl font-black text-emerald-500">
                    {fInv.filter(i => (i.customer?.name || i.customerName || 'Consumidor Final') === detailModal.data.name).length}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/10 text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Ranking</p>
                  <p className="text-xl font-black text-orange-500">#{topCustomers.findIndex(c => c.name === detailModal.data.name) + 1}</p>
                </div>
              </div>
            </div>
          )}
          {detailModal?.type === 'product' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
                <p className="text-sm font-black">{detailModal.data.name}</p>
                <p className="text-xs text-muted-foreground">Producto más vendido del período</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Unidades</p>
                  <p className="text-xl font-black text-emerald-500">{detailModal.data.qty}</p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Ingresos</p>
                  <p className="text-xl font-black text-blue-500">{formatConvertedAmount(detailModal.data.revenue, 'NIO')}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
});
SalesReportTab.displayName = 'SalesReportTab';

