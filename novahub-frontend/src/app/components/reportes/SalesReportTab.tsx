import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar, LabelList, LineChart, Line, ReferenceLine } from 'recharts';
import { invoicesService, paymentsService, customersService } from '../../services/ventas.service';
import { inventoryService } from '../../services/inventario.service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useTheme } from '../../contexts/ThemeContext';
import { TrendingUp, ShoppingCart, ArrowUpRight, Activity, Scale, BarChart3, PieChart as PieChartIcon, Users, Eye, Clock } from 'lucide-react';
import type { ReportExportRef, ReportProps } from './types';
import { getBase64Image, sanitizeHtml2CanvasOklch } from '../../utils/reportExportUtils';
import { cn } from '../ui/utils';

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
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailModal, setDetailModal] = useState<{ type: 'customer' | 'product'; data: any } | null>(null);

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
        const [invRes, payRes, cusRes, prodRes] = await Promise.all([
          invoicesService.getAll().catch(() => ({ data: [] })),
          paymentsService.getAll().catch(() => ({ data: [] })),
          customersService.getAll().catch(() => ({ data: [] })),
          inventoryService.getProducts().catch(() => ({ data: [] }))
        ]);
        setInvoices(Array.isArray(invRes) ? invRes : invRes?.data || []);
        setPayments(Array.isArray(payRes) ? payRes : payRes?.data || []);
        setCustomers(Array.isArray(cusRes) ? cusRes : cusRes?.data || []);
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
  
  const totalPaid = useMemo(() => fPay.reduce((acc, p) => acc + (p.currency === 'USD' ? Number(p.amount || 0) * (p.exchangeRate || exchangeRate) : Number(p.amount || 0)), 0), [fPay, exchangeRate]);
  const totalPending = useMemo(() => Math.max(0, totalBilled - totalPaid), [totalBilled, totalPaid]);

  const totalCost = useMemo(() => fInv.reduce((acc, i) => {
    const cost = Number(i.totalCost || Number(i.total || 0) * 0.4);
    return acc + (i.currency === 'USD' ? cost * (i.exchangeRate || exchangeRate) : cost);
  }, 0), [fInv, exchangeRate]); 
  
  const grossMargin = totalBilled > 0 ? ((totalBilled - totalCost) / totalBilled) * 100 : 0;
  const avgTicket = fInv.length > 0 ? totalBilled / fInv.length : 0;
  
  const getTrendValue = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  // ── 2 Tops ──
  const topCustomers = useMemo(() => {
    const map: Record<string, number> = {};
    fInv.forEach(inv => {
      const name = inv.customer?.name || inv.customerName || 'Consumidor Final';
      const val = inv.currency === 'USD' ? Number(inv.total || 0) * (inv.exchangeRate || exchangeRate) : Number(inv.total || 0);
      map[name] = (map[name] || 0) + val;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);
  }, [fInv, exchangeRate]);

  const topProductsByQty = useMemo(() => {
    const qtyMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    fInv.forEach(inv => {
      (inv.items || []).forEach((item: any) => {
        const name = item.product?.name || item.description || 'Producto';
        const q = Number(item.quantity || 0);
        const rev = (inv.currency === 'USD' ? Number(item.total || 0) * (inv.exchangeRate || exchangeRate) : Number(item.total || 0));
        if (!qtyMap[name]) qtyMap[name] = { name, qty: 0, revenue: 0 };
        qtyMap[name].qty += q;
        qtyMap[name].revenue += rev;
      });
    });
    if (Object.keys(qtyMap).length === 0) {
      return [...products].slice(0, 5).map(p => ({ name: p.name, qty: 0, revenue: 0 }));
    }
    return Object.values(qtyMap).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [fInv, products, exchangeRate]);

  const catComposition = useMemo(() => {
    const catMap: Record<string, number> = {};
    fInv.forEach(inv => {
      const cat = inv.category || inv.type || 'General';
      const val = inv.currency === 'USD' ? Number(inv.total || 0) * (inv.exchangeRate || exchangeRate) : Number(inv.total || 0);
      catMap[cat] = (catMap[cat] || 0) + val;
    });
    return Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [fInv, exchangeRate]);

  // ── Charts ──
  const monthlyData = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const data = [];

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
        mes: MONTH_NAMES[monthIdx],
        facturado: Math.round(mBilled),
        cobrado: Math.round(mPaid),
      });
    }
    return data;
  }, [fInv, fPay, exchangeRate]);

  const salesTrend = useMemo(() => {
    let cumulative = 0;
    return monthlyData.map(d => {
      cumulative += d.facturado;
      return { mes: d.mes, ventas: cumulative };
    });
  }, [monthlyData]);

  const projectionData = useMemo(() => {
    if (monthlyData.length < 3) return monthlyData.map(d => ({ ...d, projection: null }));
    const recent = monthlyData.slice(-3);
    const avgGrowth = recent.reduce((sum, d, i) => {
      if (i === 0) return sum;
      const prev = recent[i - 1].facturado || 1;
      return sum + ((d.facturado - prev) / prev);
    }, 0) / Math.max(recent.length - 1, 1);
    const lastVal = monthlyData[monthlyData.length - 1].facturado;
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const nextMonthIdx = (new Date().getMonth() + 1) % 12;
    const proj = [];
    for (let i = 1; i <= 3; i++) {
      const val = Math.round(lastVal * Math.pow(1 + avgGrowth, i));
      proj.push({ mes: `Est. ${monthNames[(nextMonthIdx + i - 1) % 12]}`, projection: val, facturado: null, cobrado: null });
    }
    return [...monthlyData.map(d => ({ ...d, projection: null })), ...proj];
  }, [monthlyData]);

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
          { label: 'COBRANZA', value: formatConvertedAmount(totalPaid, 'NIO'), detail: `${((totalPaid / Math.max(totalBilled, 1)) * 100).toFixed(1)}% del fact.`, color: [59, 130, 246] },
          { label: 'MARGEN BRUTO', value: `${grossMargin.toFixed(1)}%`, detail: 'Basado en costos', color: [168, 85, 247] },
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
          { label: 'COBRANZA', value: formatConvertedAmount(totalPaid, 'NIO'), detail: `${((totalPaid / Math.max(totalBilled, 1)) * 100).toFixed(1)}%`, bgColor: 'FF3B82F6' },
          { label: 'MARGEN BRUTO', value: `${grossMargin.toFixed(1)}%`, detail: 'Costos est.', bgColor: 'FFA855F7' },
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
            const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', onclone: (clonedDoc) => sanitizeHtml2CanvasOklch(elementId, clonedDoc, `#${primaryHex}`) });
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
        {/* Facturación */}
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><ShoppingCart className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <ArrowUpRight className="size-3.5 text-emerald-500" /> Ventas Totales
              {getTrendValue(totalBilled, prevTotalBilled) !== 0 && (
                <span className={cn("ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold", getTrendValue(totalBilled, prevTotalBilled) > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")}>
                  {getTrendValue(totalBilled, prevTotalBilled) > 0 ? '+' : ''}{getTrendValue(totalBilled, prevTotalBilled).toFixed(1)}%
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-emerald-500">{formatConvertedAmount(totalBilled, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{fInv.length} facturas emitidas</p>
          </CardContent>
        </Card>

        {/* Cobranza */}
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Scale className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Scale className="size-3.5 text-blue-500" /> Cobranza Efectiva
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-blue-500">{formatConvertedAmount(totalPaid, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{((totalPaid / Math.max(totalBilled, 1)) * 100).toFixed(1)}% del facturado</p>
          </CardContent>
        </Card>

        {/* Margen */}
        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-purple-500" /> Margen Bruto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-purple-500">{grossMargin.toFixed(1)}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Basado en costos estimados</p>
          </CardContent>
        </Card>

        {/* Ticket Promedio */}
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Activity className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <BarChart3 className="size-3.5 text-amber-500" /> Ticket Promedio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-amber-500">{formatConvertedAmount(avgTicket, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Valor medio por venta</p>
          </CardContent>
        </Card>

        {/* Saldo Pendiente */}
        <Card className="border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Clock className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Clock className="size-3.5 text-rose-500" /> Saldo Pendiente
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
              <TrendingUp className="size-4 text-primary" /> Proyección de Ventas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projectionData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.3} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => fmtShort(v)} />
                  <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                  <ReferenceLine x={projectionData.filter(d => d.projection === null).slice(-1)[0]?.mes} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: 'Proyección', position: 'top', style: { fontSize: '10px', fill: '#f59e0b', fontWeight: 700 } }} />
                  <Line type="monotone" dataKey="facturado" name="Facturado" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} connectNulls />
                  <Line type="monotone" dataKey="projection" name="Estimado" stroke="#f59e0b" strokeWidth={3} strokeDasharray="6 3" dot={{ r: 4, fill: '#f59e0b' }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card id="sales-chart-pie" className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <PieChartIcon className="size-4 text-primary" /> Composición de Ventas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={catComposition.length > 0 ? catComposition : [{ name: 'Sin datos', value: 1 }]}
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {(catComposition.length > 0 ? catComposition : [{ name: 'Sin datos', value: 1 }]).map((_, idx) => (
                      <Cell key={idx} fill={['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6b7280'][idx % 6]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} formatter={(v: number) => formatConvertedAmount(v, 'NIO')} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
              {catComposition.length === 0 && (
                <p className="text-center text-[10px] text-muted-foreground mt-2">Selecciona un período con facturas para ver la composición</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Evolution & Billing Comparison ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="sales-chart-trend" className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Activity className="size-4 text-primary" /> Evolución de Ventas Acumuladas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={salesTrend}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.3} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={v => fmtShort(v)} />
                  <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="ventas" stroke="#3b82f6" strokeWidth={2.5} fill="url(#salesGrad)" dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card id="sales-chart-bar" className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" /> Facturación vs Cobranza
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} barGap={6}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.3} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => fmtShort(v)} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                  <Bar dataKey="facturado" name="Facturado" fill="#3b82f6" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="facturado" position="top" formatter={(v: number) => v > 0 ? fmtShort(v) : ''} style={{ fontSize: 8, fill: '#3b82f6', fontWeight: 700 }} />
                  </Bar>
                  <Bar dataKey="cobrado" name="Cobrado" fill="#10b981" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="cobrado" position="top" formatter={(v: number) => v > 0 ? fmtShort(v) : ''} style={{ fontSize: 8, fill: '#10b981', fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Health Card ═══ */}
      <Card id="sales-health-card" className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
            <Users className="size-4 text-primary" /> Salud de Cartera
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Nuevos Clientes</p>
              <p className="text-2xl font-black text-emerald-500">{customers.length}</p>
            </div>
            <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Ventas/Cliente</p>
              <p className="text-2xl font-black text-orange-500">{(fInv.length / Math.max(customers.length, 1)).toFixed(1)}</p>
            </div>
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Ticket Promedio</p>
              <p className="text-2xl font-black text-blue-500">{formatConvertedAmount(fInv.length > 0 ? totalBilled / fInv.length : 0, 'NIO')}</p>
            </div>
            <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/10 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <ShoppingCart className="size-4 text-violet-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-violet-500 uppercase">Facturas</p>
                <p className="text-lg font-black text-violet-500">{fInv.length}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ Top Items ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Clientes */}
        <Card className="border-blue-500/20 min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Users className="size-4 text-blue-500" /> Top 5 Clientes
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
                      {formatConvertedAmount(Number(c.value), 'NIO')} · {(fInv.filter(i => i.customer === c.name || i.client === c.name).length)} facturas
                    </p>
                  </div>
                </div>
                <Eye className="size-4 text-blue-400 shrink-0 opacity-50" />
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Top Productos Más Vendidos */}
        <Card id="top-products-card" className="border-purple-500/20 min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <ShoppingCart className="size-4 text-purple-500" /> Top 5 Productos Más Vendidos
            </CardTitle>
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
                    <p className="text-[10px] text-muted-foreground truncate">{p.qty} unidades · {formatConvertedAmount(p.revenue, 'NIO')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-black text-purple-500">{p.qty} uds.</span>
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
                    {fInv.filter(i => i.customer === detailModal.data.name || i.client === detailModal.data.name).length}
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

