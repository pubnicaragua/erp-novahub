import { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { customersService, invoicesService, paymentsService, salesOrdersService } from '../../services/ventas.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Users, Scale, TrendingUp, DollarSign, Package, ArrowUpRight, Activity, Wallet, CreditCard, ShoppingCart } from 'lucide-react';
import type { ReportExportRef, ReportProps } from './types';
import { useTenantQuery, asList } from '../../hooks/useTenantQuery';
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

export const CustomersReportTab = forwardRef<ReportExportRef, ReportProps>(({ dateRange }, ref) => {
  const { displayCurrency, baseCurrency, valuationMode, valuationModeLabel, valuationModeSuffix, formatConvertedAmount: formatAmountBySource, toBaseAmount, exchangeRate } = useCurrency();
  const { themeConfig } = useTheme();
  const { canPerform } = useAuth();
  const canViewSales = canPerform('SALES', 'view');
  const currencySymbol = displayCurrency === 'USD' ? '$' : 'C$';
  const formatConvertedAmount = (amount: number, sourceCurrency?: string, sourceExchangeRate?: number) =>
    formatAmountBySource(amount, sourceCurrency === 'NIO' ? baseCurrency : sourceCurrency, sourceExchangeRate);
  
  const { data: reportData, isLoading: loading } = useTenantQuery(['reports', 'customers'], async (signal) => {
    const filters = { page: 1, pageSize: 5000, report: true } as const;
    const [invRes, payRes, ordRes, cusRes] = await Promise.all([
      invoicesService.getAll(filters, signal), paymentsService.getAll(filters, signal),
      salesOrdersService.getAll(filters, signal), customersService.getAll(filters, signal),
    ]);
    return { invoices: asList(invRes), payments: asList(payRes), orders: asList(ordRes), customers: asList(cusRes) };
  }, { enabled: canViewSales, onError: (e) => toast.error(e.message || 'Error cargando clientes') });
  const invoices = reportData?.invoices || [];
  const payments = reportData?.payments || [];
  const orders = reportData?.orders || [];
  const customers = reportData?.customers || [];

  const fmtShort = (v: number) => {
    const num = Number(v);
    if (!Number.isFinite(num)) return 'C$0';
    const converted = toBaseAmount(v, baseCurrency);
    if (Math.abs(converted) >= 1000000) return `${currencySymbol}${(converted/1000000).toFixed(1)}M`;
    if (Math.abs(converted) >= 1000) return `${currencySymbol}${(converted/1000).toFixed(1)}k`;
    return `${currencySymbol}${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const { start: currentStart, prevStart, prevEnd } = useMemo(() => getRangeDates(dateRange), [dateRange]);

  const fInv = useMemo(() => invoices.filter(i => {
    const d = toDate(i.date || i.createdAt);
    return d && d >= currentStart;
  }), [invoices, currentStart]);

  const pInv = useMemo(() => invoices.filter(i => {
    const d = toDate(i.date || i.createdAt);
    return d && d >= prevStart && d <= prevEnd;
  }), [invoices, prevStart, prevEnd]);

  const fPay = useMemo(() => payments.filter(p => {
    const d = toDate(p.date || p.createdAt);
    return d && d >= currentStart;
  }), [payments, currentStart]);

  const fCus = useMemo(() => customers.filter(c => {
    const d = toDate(c.createdAt);
    return d && d >= currentStart;
  }), [customers, currentStart]);

  const sourceRate = (rate?: number) => valuationMode === 'CURRENT' ? exchangeRate : (rate || exchangeRate);
  const documentTotal = (i: any) => toBaseAmount(Number(i.total ?? i.baseTotal ?? 0), i.currency, sourceRate(i.exchangeRate));
  const paymentAmount = (p: any) => toBaseAmount(Number(p.amount ?? p.baseAmount ?? 0), p.currency, sourceRate(p.exchangeRate));
  const totalSold = useMemo(() => fInv.reduce((acc, i) => acc + documentTotal(i), 0), [fInv, exchangeRate, baseCurrency, valuationMode]);
  const prevTotalSold = useMemo(() => pInv.reduce((acc, i) => acc + documentTotal(i), 0), [pInv, exchangeRate, baseCurrency, valuationMode]);
  const totalPaid = useMemo(() => fPay.reduce((acc, p) => acc + paymentAmount(p), 0), [fPay, exchangeRate, baseCurrency, valuationMode]);
  
  const payRatio = totalSold > 0 ? (totalPaid / totalSold) * 100 : 0;
  
  // Average Customer Lifetime Value - Only summing non-cancelled/draft invoices
  const avgLTV = useMemo(() => {
    if (customers.length === 0) return 0;
    const validInvoices = invoices.filter(i => i.status !== 'CANCELLED' && i.status !== 'DRAFT');
    const totalValid = validInvoices.reduce((acc, i) => acc + documentTotal(i), 0);
    return totalValid / customers.length;
  }, [invoices, customers, exchangeRate]);

  const getTrendValue = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  // ── 2 Tops ──
  const topCustomers = useMemo(() => {
    const map: Record<string, number> = {};
    fInv.forEach(inv => {
      const name = inv.customer?.name || inv.customerName || 'Consumidor Final';
      const val = documentTotal(inv);
      map[name] = (map[name] || 0) + val;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);
  }, [fInv, exchangeRate]);

  const topProducts = useMemo(() => {
    const map: Record<string, { qty: number, total: number }> = {};
    fInv.forEach(inv => {
      if (Array.isArray(inv.items)) {
        inv.items.forEach((item: any) => {
          const name = item.product?.name || item.description || 'Producto';
          const val = toBaseAmount(Number(item.total || 0), inv.currency, sourceRate(inv.exchangeRate));
          if (!map[name]) map[name] = { qty: 0, total: 0 };
          map[name].qty += Number(item.quantity || 1);
          map[name].total += val;
        });
      }
    });
    return Object.entries(map).map(([name, v]) => ({ name, value: v.total, qty: v.qty })).sort((a,b) => b.value - a.value).slice(0, 5);
  }, [fInv, exchangeRate]);

  const topByBalance = useMemo(() => {
    return Object.entries(invoices.filter(i => i.status !== 'PAID' && i.status !== 'CANCELLED').reduce((acc: Record<string, number>, inv: any) => {
      const n = inv.customer?.name || inv.customerName || 'Cliente';
      const balance = inv.balance ?? inv.balanceDue ?? (Number(inv.total || 0) - Number(inv.amountPaid || 0));
      acc[n] = (acc[n] || 0) + toBaseAmount(Number(balance || 0), inv.currency, sourceRate(inv.exchangeRate));
      return acc;
    }, {})).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);
  }, [invoices, exchangeRate, baseCurrency]);

  // ── Charts ──
  const monthlyData = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const data = [];

    for (let i = 5; i >= 0; i--) {
      const monthIdx = (currentMonth - i + 12) % 12;
      const mSales = fInv.filter(inv => {
        const d = new Date(inv.date || inv.createdAt);
        return d.getMonth() === monthIdx;
      }).reduce((acc: number, i: any) => acc + documentTotal(i), 0);
      
      data.push({
        mes: MONTH_NAMES[monthIdx],
        ventas: Math.round(mSales),
      });
    }
    return data;
  }, [fInv, exchangeRate]);

  useImperativeHandle(ref, () => ({
    exportPDF: async () => {
      try {
        toast.info("Generando PDF (Clientes), por favor espere...");
        const pdfSettings = await getPdfDesignSettings('reportes.customers');
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
        doc.text(`Reporte de Clientes`, pageWidth / 2, currentY, { align: 'center' }); currentY += 6;
        
        const now = new Date();
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120);
        const currencyLabel = displayCurrency === 'USD' ? 'Dólares (USD)' : 'Córdobas (NIO)';
        doc.text(`Generado: ${now.toLocaleDateString('es-NI')} ${now.toLocaleTimeString('es-NI')}  |  Moneda: ${currencyLabel}`, pageWidth / 2, currentY, { align: 'center' });
        currentY += 5;

        doc.setDrawColor(rgbPrimary[0], rgbPrimary[1], rgbPrimary[2]); doc.setLineWidth(0.8);
        doc.line(marginX, currentY, pageWidth - marginX, currentY); currentY += 10;

        const kpis = [
          { label: 'CARTERA', value: formatConvertedAmount(totalSold, 'NIO'), detail: `${customers.length} clientes`, color: [59, 130, 246] },
          { label: 'ADQUISICIÓN', value: `${fCus.length}`, detail: 'Nuevos clientes', color: [16, 185, 129] },
          { label: 'RATIO PAGO', value: `${payRatio.toFixed(1)}%`, detail: 'Eficiencia', color: [168, 85, 247] },
          { label: 'LTV PROMEDIO', value: formatConvertedAmount(avgLTV, 'NIO'), detail: 'Retorno', color: [245, 158, 11] },
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

        const charts = ['customers-chart-trend', 'customers-health-card', 'customers-chart-pie', 'customers-products-card'];
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

        const renderTop = (title: string, data: any[], colorRGB: number[], isQty: boolean) => {
          checkPage(40);
          doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 60);
          doc.text(title, marginX, currentY); currentY += 7;
          doc.setFillColor(colorRGB[0], colorRGB[1], colorRGB[2]);
          doc.roundedRect(marginX, currentY, contentWidth, 8, 1, 1, 'F');
          doc.setFontSize(8); doc.setTextColor(255, 255, 255);
          doc.text('Concepto / Nombre', marginX + 3, currentY + 5.5);
          doc.text('Valor', marginX + 130, currentY + 5.5);
          if(isQty) doc.text('Cant', marginX + 175, currentY + 5.5);
          currentY += 10;
          data.forEach((item, i) => {
            checkPage(8);
            if (i % 2 === 0) { doc.setFillColor(248, 249, 250); doc.rect(marginX, currentY - 1, contentWidth, 7, 'F'); }
            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
            doc.text((item.name || 'Sin especificar').substring(0, 50), marginX + 3, currentY + 4);
            doc.setFont('helvetica', 'bold'); doc.setTextColor(colorRGB[0], colorRGB[1], colorRGB[2]);
            const valStr = formatConvertedAmount(Number(item.value || 0), 'NIO');
            doc.text(valStr, marginX + 130, currentY + 4);
            if(isQty) { doc.setTextColor(60,60,60); doc.text(String(item.qty || 0), marginX + 175, currentY + 4); }
            currentY += 7;
          });
          currentY += 10;
        };

        renderTop('Líderes de Facturación', topCustomers, [59, 130, 246], false);
        renderTop('Productos Estrella (Por valor vendido)', topProducts, [245, 158, 11], true);

        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i); doc.setFontSize(7); doc.setTextColor(150);
          doc.text(`${companyName} - Reporte de Clientes - Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
        }

        doc.save(`Reporte_Clientes_${now.toISOString().split('T')[0]}.pdf`);
        toast.success("PDF generado exitosamente");
      } catch (e: any) { console.error(e); toast.error(e?.response?.data?.message || e?.message || "Error al generar PDF"); }
    },
    exportExcel: async () => {
      try {
        toast.info("Generando Excel (Clientes)...");
        const wb = new ExcelJS.Workbook();
        const companyName = themeConfig.tenantName || 'Mi Empresa';
        const logoUrl = themeConfig.logo || '';
        const primaryHex = (themeConfig.colors.primary || '#10b981').replace('#', '');
        const currencyLabel = displayCurrency === 'USD' ? 'Dólares (USD)' : 'Córdobas (NIO)';
        const thinBorder = { style: 'thin' as const, color: { argb: 'FFE5E7EB' } };

        const ws = wb.addWorksheet('Reporte de Clientes');
        ws.getColumn(1).width = 8; ws.getColumn(2).width = 35; ws.getColumn(3).width = 25; ws.getColumn(4).width = 15;

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
        const cellTitle = ws.getCell(`A${currentRow}`); cellTitle.value = 'Reporte de Clientes';
        cellTitle.font = { size: 13, bold: true }; cellTitle.alignment = { horizontal: 'center' }; currentRow++;

        ws.mergeCells(`A${currentRow}:D${currentRow}`);
        const cellCurrency = ws.getCell(`A${currentRow}`);
        cellCurrency.value = `Moneda: ${currencyLabel} (${currencySymbol})  |  ${new Date().toLocaleDateString('es-NI')}`;
        cellCurrency.font = { size: 10, italic: true, color: { argb: 'FF888888' } }; cellCurrency.alignment = { horizontal: 'center' }; currentRow += 2;

        const kpis = [
          { label: 'CARTERA', value: formatConvertedAmount(totalSold, 'NIO'), detail: `${customers.length} clientes`, bgColor: 'FF3B82F6' },
          { label: 'ADQUISICIÓN', value: `${fCus.length}`, detail: 'Nuevos', bgColor: 'FF10B981' },
          { label: 'RATIO PAGO', value: `${payRatio.toFixed(1)}%`, detail: 'Eficiencia', bgColor: 'FFA855F7' },
          { label: 'LTV PROMEDIO', value: formatConvertedAmount(avgLTV, 'NIO'), detail: 'Retorno', bgColor: 'FFF59E0B' },
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

        if (document.getElementById('customers-chart-trend')) await captureAndEmbed('customers-chart-trend');
        if (document.getElementById('customers-health-card')) await captureAndEmbed('customers-health-card');
        if (document.getElementById('customers-chart-pie')) await captureAndEmbed('customers-chart-pie');
        if (document.getElementById('customers-products-card')) await captureAndEmbed('customers-products-card');

        while (ws.rowCount < currentRow) ws.addRow([]); ws.addRow([]);

        const renderTopTable = (title: string, data: any[], colorHex: string, includeQty: boolean) => {
          const titleRow = ws.addRow([title, '', '', '']); ws.mergeCells(`A${ws.rowCount}:D${ws.rowCount}`);
          titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: colorHex } }; titleRow.getCell(1).alignment = { horizontal: 'center' }; ws.addRow([]);
          const header = ws.addRow(['#', 'Nombre', 'Monto', includeQty ? 'Cantidad' : '']);
          header.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorHex } }; c.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder }; });
          data.forEach((item, idx) => {
            const r = ws.addRow([idx + 1, item.name || 'Sin nombre', Number(item.value || 0), includeQty ? Number(item.qty || 0) : '']);
            r.getCell(1).font = { bold: true }; r.getCell(1).alignment = { horizontal: 'center' };
            r.getCell(3).numFmt = `"${currencySymbol}" #,##0.00`; r.getCell(3).font = { bold: true }; r.getCell(3).alignment = { horizontal: 'right' };
            r.eachCell(c => { c.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder }; });
          });
          ws.addRow([]); ws.addRow([]);
        };

        renderTopTable('Líderes de Facturación', topCustomers, 'FF3B82F6', false);
        renderTopTable('Productos Estrella', topProducts, 'FFF59E0B', true);

        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `Clientes_${new Date().toISOString().split('T')[0]}.xlsx`; link.click();
        toast.success("Excel generado exitosamente");
      } catch (e: any) { console.error(e); toast.error(e?.response?.data?.message || e?.message || "Error al generar Excel"); }
    }
  }));

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Activity className="size-12 animate-pulse text-primary opacity-50" />
        <p className="font-black uppercase tracking-widest text-[10px]">Analizando Relaciones Comerciales...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* ═══ KPI Cards (Dashboard Style) ═══ */}
      <div id="customers-report-kpis" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Vendido */}
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><DollarSign className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Users className="size-3.5 text-blue-500" /> Cartera de Venta
              {getTrendValue(totalSold, prevTotalSold) !== 0 && (
                <span className={cn("ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold", getTrendValue(totalSold, prevTotalSold) > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")}>
                  {getTrendValue(totalSold, prevTotalSold) > 0 ? '+' : ''}{getTrendValue(totalSold, prevTotalSold).toFixed(1)}%
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-blue-500">{formatConvertedAmount(totalSold, 'NIO')}</p>{valuationModeSuffix && <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{valuationModeLabel}</span>}
            <p className="text-[10px] text-muted-foreground mt-0.5">{customers.length} clientes totales</p>
          </CardContent>
        </Card>

        {/* Nuevos Clientes */}
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><ArrowUpRight className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="size-3.5 text-emerald-500" /> Nuevos clientes del período
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-emerald-500">{fCus.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Nuevos prospectos convertidos</p>
          </CardContent>
        </Card>

        {/* Ratio de Cobro */}
        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Scale className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <CreditCard className="size-3.5 text-purple-500" /> Cobros recibidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-purple-500">{formatConvertedAmount(totalPaid, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Cobros del período</p>
          </CardContent>
        </Card>

        {/* LTV Promedio */}
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-amber-500" /> Valor de Vida (LTV)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-amber-500">{formatConvertedAmount(avgLTV, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Retorno promedio por cliente</p>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Charts Row ═══ */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card id="customers-chart-trend" className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" /> Dinámica de Crecimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="cusGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" opacity={0.3} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtShort(v)} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="ventas" name="Ventas" stroke="#3b82f6" strokeWidth={2.5} fill="url(#cusGrad)" dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card id="customers-health-card" className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <ShoppingCart className="size-4 text-primary" /> Salud de Operaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 text-center">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase">Órdenes Activas</p>
                   <p className="text-2xl font-black text-amber-500">{orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED').length}</p>
                </div>
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase">Facturas Pagadas</p>
                   <p className="text-2xl font-black text-emerald-500">{invoices.filter(i => i.status === 'PAID').length}</p>
                </div>
             </div>
             <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 flex items-center gap-4 transition-all hover:bg-orange-500/10">
                <div className="p-3 rounded-lg bg-orange-500/10">
                   <Wallet className="size-5 text-orange-500" />
                </div>
                <div>
                   <p className="text-xs font-bold text-orange-500 uppercase">Cartera en Mora</p>
                   <p className="text-[10px] text-muted-foreground">{invoices.filter(i => i.status === 'OVERDUE').length} facturas vencidas</p>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Distribution Charts ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="customers-chart-pie" className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Activity className="size-4 text-primary" /> Composición del Mercado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Activos', value: customers.length * 0.7 },
                      { name: 'Nuevos', value: fCus.length },
                      { name: 'Inactivos', value: customers.length * 0.1 }
                    ]}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <Cell fill="#3b82f6" />
                    <Cell fill="#10b981" />
                    <Cell fill="#94a3b8" />
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card id="customers-products-card" className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Package className="size-4 text-primary" /> Clientes con mayor saldo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topByBalance.map((p: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-orange-500/5 border border-orange-500/10 hover:bg-orange-500/10 transition-colors gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="size-7 rounded-lg bg-orange-500/20 flex items-center justify-center text-[10px] font-black text-orange-600 shrink-0">
                    #{idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">Saldo pendiente</p>
                  </div>
                </div>
                <span className="text-sm font-black text-orange-500 shrink-0">{formatConvertedAmount(Number(p.value), 'NIO')}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Top Customers ═══ */}
      <Card className="border-blue-500/20 min-w-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
            <Users className="size-4 text-blue-500" /> Líderes de Facturación
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {topCustomers.map((c: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 transition-colors group gap-4">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="size-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-xs font-black text-blue-600 shrink-0 transition-transform group-hover:scale-110">
                  #{idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black truncate">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight truncate">Cliente de Alto Valor</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black text-blue-500">{formatConvertedAmount(Number(c.value), 'NIO')}</p>
                <div className="h-1 w-20 bg-blue-500/10 rounded-full mt-1.5 overflow-hidden ml-auto">
                   <div 
                     className="h-full bg-blue-500/50 rounded-full" 
                     style={{ width: `${Math.min((c.value / Math.max(totalSold,1)) * 500, 100)}%` }} 
                   />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
});
CustomersReportTab.displayName = 'CustomersReportTab';

