import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList, AreaChart, Area } from 'recharts';
import { incomeService, expensesService } from '../../services/finanzas.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Percent, ArrowUpRight, ArrowDownRight, Activity, Scale, BarChart3, Wallet, CreditCard } from 'lucide-react';
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

export const FinanceReportTab = forwardRef<ReportExportRef, ReportProps>(({ dateRange }, ref) => {
  const { displayCurrency, formatConvertedAmount, convertAmount, exchangeRate } = useCurrency();
  const { themeConfig } = useTheme();
  const { user } = useAuth();
  const currencySymbol = displayCurrency === 'USD' ? '$' : 'C$';
  
  const [incomes, setIncomes] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
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
        const [incRes, expRes] = await Promise.all([incomeService.getAll(), expensesService.getAll()]);
        setIncomes(Array.isArray(incRes) ? incRes : (incRes as any)?.data || []);
        setExpenses(Array.isArray(expRes) ? expRes : (expRes as any)?.data || []);
      } catch (e: any) {
        toast.error(e?.response?.data?.message || e?.message || "Error cargando finanzas");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const { start: currentStart, prevStart, prevEnd } = useMemo(() => getRangeDates(dateRange), [dateRange]);

  const fInc = useMemo(() => incomes.filter(i => {
    const d = toDate(i.date || i.createdAt);
    return d && d >= currentStart;
  }), [incomes, currentStart]);

  const fExp = useMemo(() => expenses.filter(e => {
    const d = toDate(e.date || e.createdAt);
    return d && d >= currentStart;
  }), [expenses, currentStart]);

  const pInc = useMemo(() => incomes.filter(i => {
    const d = toDate(i.date || i.createdAt);
    return d && d >= prevStart && d <= prevEnd;
  }), [incomes, prevStart, prevEnd]);

  const pExp = useMemo(() => expenses.filter(e => {
    const d = toDate(e.date || e.createdAt);
    return d && d >= prevStart && d <= prevEnd;
  }), [expenses, prevStart, prevEnd]);

  const totalInc = useMemo(() => fInc.reduce((acc, i) => acc + (i.currency === 'USD' ? Number(i.amount || 0) * (i.exchangeRate || exchangeRate) : Number(i.amount || 0)), 0), [fInc, exchangeRate]);
  const totalExp = useMemo(() => fExp.reduce((acc, e) => acc + (e.currency === 'USD' ? Number(e.amount || 0) * (e.exchangeRate || exchangeRate) : Number(e.amount || 0)), 0), [fExp, exchangeRate]);
  
  const prevTotalInc = useMemo(() => pInc.reduce((acc, i) => acc + (i.currency === 'USD' ? Number(i.amount || 0) * (i.exchangeRate || exchangeRate) : Number(i.amount || 0)), 0), [pInc, exchangeRate]);
  const prevTotalExp = useMemo(() => pExp.reduce((acc, e) => acc + (e.currency === 'USD' ? Number(e.amount || 0) * (e.exchangeRate || exchangeRate) : Number(e.amount || 0)), 0), [pExp, exchangeRate]);

  const getTrendValue = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  const netUtility = totalInc - totalExp;
  const margin = totalInc > 0 ? ((netUtility / totalInc) * 100) : 0;

  // ── 2 Tops ──
  const topExpenses = useMemo(() => 
    [...fExp]
      .sort((a, b) => {
        const valA = a.currency === 'USD' ? Number(a.amount || 0) * (a.exchangeRate || exchangeRate) : Number(a.amount || 0);
        const valB = b.currency === 'USD' ? Number(b.amount || 0) * (b.exchangeRate || exchangeRate) : Number(b.amount || 0);
        return valB - valA;
      })
      .slice(0, 5),
    [fExp, exchangeRate]
  );
  const topIncomes = useMemo(() => 
    [...fInc]
      .sort((a, b) => {
        const valA = a.currency === 'USD' ? Number(a.amount || 0) * (a.exchangeRate || exchangeRate) : Number(a.amount || 0);
        const valB = b.currency === 'USD' ? Number(b.amount || 0) * (b.exchangeRate || exchangeRate) : Number(b.amount || 0);
        return valB - valA;
      })
      .slice(0, 5),
    [fInc, exchangeRate]
  );

  // ── Charts ──
  const monthlyData = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const data = [];

    for (let i = 5; i >= 0; i--) {
      const monthIdx = (currentMonth - i + 12) % 12;
      const year = currentMonth - i < 0 ? currentYear - 1 : currentYear;
      
      const mInc = fInc.filter(inc => {
        const d = new Date(inc.date || inc.createdAt);
        return d.getMonth() === monthIdx && d.getFullYear() === year;
      }).reduce((acc: number, i: any) => acc + (i.currency === 'USD' ? Number(i.amount || 0) * (i.exchangeRate || exchangeRate) : Number(i.amount || 0)), 0);
      
      const mExp = fExp.filter(exp => {
        const d = new Date(exp.date || exp.createdAt);
        return d.getMonth() === monthIdx && d.getFullYear() === year;
      }).reduce((acc: number, e: any) => acc + (e.currency === 'USD' ? Number(e.amount || 0) * (e.exchangeRate || exchangeRate) : Number(e.amount || 0)), 0);
      
      data.push({
        mes: MONTH_NAMES[monthIdx],
        ingresos: Math.round(mInc),
        gastos: Math.round(mExp),
        balance: Math.round(mInc - mExp),
      });
    }
    return data;
  }, [fInc, fExp, exchangeRate]);

  const balanceTrend = useMemo(() => {
    let cumulative = 0;
    return monthlyData.map(d => {
      cumulative += d.balance;
      return { mes: d.mes, balance: cumulative };
    });
  }, [monthlyData]);






  useImperativeHandle(ref, () => ({
    exportPDF: async () => {
      try {
        toast.info("Generando PDF financiero, por favor espere...");
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const companyName = themeConfig.tenantName || user?.tenantName || 'Mi Empresa';
        const logoUrl = themeConfig.logo || '';
        const primaryColor = themeConfig.colors.primary || '#10b981';
        const primaryHex = primaryColor.startsWith('#') ? primaryColor : '#10b981';
        const rgbPrimary = primaryHex.startsWith('#') 
          ? [parseInt(primaryHex.slice(1,3), 16), parseInt(primaryHex.slice(3,5), 16), parseInt(primaryHex.slice(5,7), 16)]
          : [16, 185, 129];
        const marginX = 14;
        const contentWidth = pageWidth - marginX * 2;
        let currentY = 15;

        const checkPage = (needed: number) => {
          if (currentY + needed > pageHeight - 15) { doc.addPage(); currentY = 20; }
        };

        if (logoUrl) {
          const logoBase64 = await getBase64Image(logoUrl);
          if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', (pageWidth - 30) / 2, currentY, 30, 30, undefined, 'FAST');
            currentY += 35;
          }
        }

        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(rgbPrimary[0], rgbPrimary[1], rgbPrimary[2]);
        doc.text(companyName, pageWidth / 2, currentY, { align: 'center' });
        currentY += 8;

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text(`Reporte Financiero de Negocio`, pageWidth / 2, currentY, { align: 'center' });
        currentY += 6;
        
        const now = new Date();
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        const currencyLabel = displayCurrency === 'USD' ? 'Dólares (USD)' : 'Córdobas (NIO)';
        doc.text(`Generado: ${now.toLocaleDateString('es-NI')} ${now.toLocaleTimeString('es-NI')}  |  Moneda: ${currencyLabel}`, pageWidth / 2, currentY, { align: 'center' });
        currentY += 5;

        doc.setDrawColor(rgbPrimary[0], rgbPrimary[1], rgbPrimary[2]);
        doc.setLineWidth(0.8);
        doc.line(marginX, currentY, pageWidth - marginX, currentY);
        currentY += 10;

        // ── KPIs as native text boxes (Row 1) ──
        const kpis = [
          { label: 'INGRESOS', value: formatConvertedAmount(totalInc, 'NIO'), detail: `${fInc.length} transacciones`, color: [16, 185, 129] },
          { label: 'GASTOS', value: formatConvertedAmount(totalExp, 'NIO'), detail: `${fExp.length} transacciones`, color: [244, 63, 94] },
          { label: 'UTILIDAD NETA', value: formatConvertedAmount(netUtility, 'NIO'), detail: 'Ingresos - Gastos', color: netUtility >= 0 ? [16, 185, 129] : [244, 63, 94] },
          { label: 'MARGEN', value: `${margin.toFixed(1)}%`, detail: margin >= 20 ? 'Saludable' : margin >= 0 ? 'Bajo' : 'Negativo', color: [99, 102, 241] },
        ];

        const cols = 4;
        const boxW = (contentWidth - (cols - 1) * 4) / cols;
        const boxH = 22;
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

        // ── Monthly Chart as image ──
        const chart1 = document.getElementById('finance-monthly-chart');
        if (chart1) {
          checkPage(95);
          try {
            const canvas = await html2canvas(chart1, { scale: 2, backgroundColor: '#ffffff', onclone: (clonedDoc) => sanitizeHtml2CanvasOklch(['finance-monthly-chart'], clonedDoc, primaryHex) });
            doc.addImage(canvas.toDataURL('image/png'), 'PNG', marginX, currentY, contentWidth, 80, undefined, 'FAST');
            currentY += 85;
          } catch (imgErr) {
            console.warn('Monthly chart image failed', imgErr);
          }
        }

        // ── Trend Chart as image ──
        const chart2 = document.getElementById('finance-trend-chart');
        if (chart2) {
          checkPage(95);
          try {
            const canvas = await html2canvas(chart2, { scale: 2, backgroundColor: '#ffffff', onclone: (clonedDoc) => sanitizeHtml2CanvasOklch(['finance-trend-chart'], clonedDoc, primaryHex) });
            doc.addImage(canvas.toDataURL('image/png'), 'PNG', marginX, currentY, contentWidth, 80, undefined, 'FAST');
            currentY += 85;
          } catch (imgErr) {
            console.warn('Trend chart image failed', imgErr);
          }
        }

        // ── Top Lists ──
        const renderTop = (title: string, data: any[], isIncome: boolean) => {
          checkPage(50);
          doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 60);
          doc.text(title, marginX, currentY); currentY += 7;
          doc.setFillColor(isIncome ? 16 : 244, isIncome ? 185 : 63, isIncome ? 129 : 94);
          doc.roundedRect(marginX, currentY, contentWidth, 8, 1, 1, 'F');
          doc.setFontSize(8); doc.setTextColor(255, 255, 255);
          doc.text('Concepto', marginX + 3, currentY + 5.5);
          doc.text('Categoría', marginX + 80, currentY + 5.5);
          doc.text('Fecha', marginX + 120, currentY + 5.5);
          doc.text('Monto', marginX + 155, currentY + 5.5);
          currentY += 10;
          data.forEach((item, i) => {
            checkPage(8);
            if (i % 2 === 0) { doc.setFillColor(248, 249, 250); doc.rect(marginX, currentY - 1, contentWidth, 7, 'F'); }
            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
            const amt = formatConvertedAmount(Number(item.amount), item.currency, item.exchangeRate);
            doc.text((item.source || item.description || (isIncome ? 'Ingreso' : 'Gasto')).substring(0, 40), marginX + 3, currentY + 4);
            doc.text((item.category || 'Sin cat.').substring(0, 20), marginX + 80, currentY + 4);
            doc.text(new Date(item.date || item.createdAt).toLocaleDateString('es-NI'), marginX + 120, currentY + 4);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(isIncome ? 16 : 244, isIncome ? 185 : 63, isIncome ? 129 : 94);
            doc.text(amt, marginX + 155, currentY + 4);
            currentY += 7;
          });
          currentY += 10;
        };

        renderTop('Top 5 Ingresos', topIncomes, true);
        renderTop('Top 5 Gastos', topExpenses, false);

        // ── Footer ──
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(7);
          doc.setTextColor(150);
          doc.text(`${companyName} - Reporte Financiero - Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
        }

        doc.save(`Reporte_Finanzas_${now.toISOString().split('T')[0]}.pdf`);
        toast.success("PDF generado exitosamente");
      } catch (e: any) {
        console.error(e);
        toast.error(e?.response?.data?.message || e?.message || "Error al generar PDF");
      }
    },
    exportExcel: async () => {
      try {
        toast.info("Generando Excel financiero...");
        const wb = new ExcelJS.Workbook();
        const companyName = themeConfig.tenantName || user?.tenantName || 'Mi Empresa';
        const logoUrl = themeConfig.logo || '';
        const primaryColor = themeConfig.colors.primary || '#10b981';
        const hexColor = primaryColor.startsWith('#') ? primaryColor.replace('#', '') : '10b981';
        const primaryHex = primaryColor.startsWith('#') ? primaryColor : '#10b981';
        const currencyLabel = displayCurrency === 'USD' ? 'Dólares (USD)' : 'Córdobas (NIO)';
        const thinBorder = { style: 'thin' as const, color: { argb: 'FFE5E7EB' } };

        // ═══ Sheet 1: Reporte Financiero ═══
        const ws = wb.addWorksheet('Reporte Financiero');
        ws.getColumn(1).width = 8;
        ws.getColumn(2).width = 35;
        ws.getColumn(3).width = 20;
        ws.getColumn(4).width = 20;
        ws.getColumn(5).width = 22;

        let currentRow = 1;

        // Logo
        if (logoUrl) {
          const base64Logo = await getBase64Image(logoUrl);
          if (base64Logo) {
            const logoId = wb.addImage({ base64: base64Logo, extension: 'png' });
            ws.addImage(logoId, { tl: { col: 1.5, row: 0 }, ext: { width: 100, height: 100 } });
            currentRow = 6;
          }
        }

        // Header text
        ws.mergeCells(`A${currentRow}:E${currentRow}`);
        const cellName = ws.getCell(`A${currentRow}`);
        cellName.value = companyName;
        cellName.font = { size: 18, bold: true, color: { argb: `FF${hexColor}` } };
        cellName.alignment = { horizontal: 'center' };
        currentRow++;

        ws.mergeCells(`A${currentRow}:E${currentRow}`);
        const cellTitle = ws.getCell(`A${currentRow}`);
        cellTitle.value = 'Reporte Financiero de Negocio';
        cellTitle.font = { size: 13, bold: true };
        cellTitle.alignment = { horizontal: 'center' };
        currentRow++;

        ws.mergeCells(`A${currentRow}:E${currentRow}`);
        const cellCurrency = ws.getCell(`A${currentRow}`);
        cellCurrency.value = `Moneda: ${currencyLabel} (${currencySymbol})  |  ${new Date().toLocaleDateString('es-NI')}`;
        cellCurrency.font = { size: 10, italic: true, color: { argb: 'FF888888' } };
        cellCurrency.alignment = { horizontal: 'center' };
        currentRow += 2;

        // ── KPI boxes (only the 4 that appear on screen) ──
        const kpiBoxes = [
          { label: 'INGRESOS', value: formatConvertedAmount(totalInc, 'NIO'), detail: `${fInc.length} transacciones`, bgColor: 'FF10B981' },
          { label: 'GASTOS', value: formatConvertedAmount(totalExp, 'NIO'), detail: `${fExp.length} transacciones`, bgColor: 'FFF43F5E' },
          { label: 'UTILIDAD NETA', value: formatConvertedAmount(netUtility, 'NIO'), detail: 'Ingresos - Gastos', bgColor: netUtility >= 0 ? 'FF10B981' : 'FFF43F5E' },
          { label: 'MARGEN', value: `${margin.toFixed(1)}%`, detail: margin >= 20 ? 'Saludable' : margin >= 0 ? 'Bajo' : 'Negativo', bgColor: 'FF6366F1' },
        ];

        // Label row
        ws.getRow(currentRow).height = 18;
        kpiBoxes.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.label;
          cell.font = { size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        currentRow++;
        // Value row
        ws.getRow(currentRow).height = 28;
        kpiBoxes.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.value;
          cell.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        currentRow++;
        // Detail row
        ws.getRow(currentRow).height = 16;
        kpiBoxes.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.detail;
          cell.font = { size: 8, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        currentRow += 2;

        // ── Capture charts as images (only charts, not tops) ──
        const captureAndEmbed = async (elementId: string, imgWidthPx: number = 700) => {
          const el = document.getElementById(elementId);
          if (!el) return;
          try {
            const canvas = await html2canvas(el, {
              scale: 2,
              backgroundColor: '#ffffff',
              onclone: (clonedDoc) => sanitizeHtml2CanvasOklch([elementId], clonedDoc, primaryHex),
            });
            const imgData = canvas.toDataURL('image/png');
            const imgId = wb.addImage({ base64: imgData, extension: 'png' });
            const imgHeight = (canvas.height * imgWidthPx) / canvas.width;
            ws.addImage(imgId, {
              tl: { col: 0, row: currentRow },
              ext: { width: imgWidthPx, height: imgHeight },
            });
            currentRow += Math.ceil(imgHeight / 18) + 2;
          } catch (e: any) {
            console.warn(`Image capture failed for #${elementId}`, e);
          }
        };


        await captureAndEmbed('finance-monthly-chart', 700);
        await captureAndEmbed('finance-trend-chart', 700);

        // ═══ Sheet 2: Métricas ═══
        const wsMetrics = wb.addWorksheet('Métricas');
        wsMetrics.getColumn(1).width = 35;
        wsMetrics.getColumn(2).width = 25;
        wsMetrics.getColumn(3).width = 25;

        const mHeader = wsMetrics.addRow(['Métrica', 'Valor', 'Detalle']);
        mHeader.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hexColor}` } };
          cell.alignment = { horizontal: 'center' };
          cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
        });

        const addMetricRow = (label: string, value: string, detail: string, colorArgb: string) => {
          const r = wsMetrics.addRow([label, value, detail]);
          r.getCell(1).font = { bold: true, size: 11 };
          r.getCell(2).font = { bold: true, size: 12, color: { argb: colorArgb } };
          r.getCell(2).alignment = { horizontal: 'right' };
          r.getCell(3).font = { size: 9, italic: true, color: { argb: 'FF888888' } };
          r.eachCell((cell) => { cell.border = { bottom: thinBorder }; });
        };

        addMetricRow('Total Ingresos', formatConvertedAmount(totalInc, 'NIO'), `${fInc.length} registros`, 'FF10B981');
        addMetricRow('Total Gastos', formatConvertedAmount(totalExp, 'NIO'), `${fExp.length} registros`, 'FFEF4444');
        addMetricRow('Utilidad Neta', formatConvertedAmount(netUtility, 'NIO'), `Margen: ${margin.toFixed(1)}%`, netUtility >= 0 ? 'FF10B981' : 'FFEF4444');

        // ═══ Tops (debajo de las gráficas en la misma hoja) ═══
        // Primero llenamos filas vacías para bajar hasta donde terminaron las imágenes
        while (ws.rowCount < currentRow) {
          ws.addRow([]);
        }
        ws.addRow([]); // Fila extra de espacio

        // ── Top 5 Ingresos (native table) ──
        const topIncTitleRow = ws.addRow(['Top 5 Ingresos', '', '', '', '']);
        ws.mergeCells(`A${ws.rowCount}:E${ws.rowCount}`);
        topIncTitleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF10B981' } };
        topIncTitleRow.getCell(1).alignment = { horizontal: 'center' };
        ws.addRow([]);

        const topIncHeader = ws.addRow(['#', 'Concepto', 'Categoría', 'Fecha', 'Monto']);
        topIncHeader.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
        });

        topIncomes.forEach((item, idx) => {
          const r = ws.addRow([
            idx + 1,
            item.source || item.description || 'Ingreso',
            item.category || 'Sin cat.',
            new Date(item.date || item.createdAt).toLocaleDateString('es-NI'),
            Number(item.amount),
          ]);
          r.getCell(1).alignment = { horizontal: 'center' };
          r.getCell(1).font = { bold: true, color: { argb: 'FF10B981' } };
          r.getCell(5).numFmt = `"${currencySymbol}" #,##0.00`;
          r.getCell(5).font = { bold: true, color: { argb: 'FF10B981' } };
          r.getCell(5).alignment = { horizontal: 'right' };
          r.eachCell((cell) => {
            cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
            if (idx % 2 === 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
            }
          });
        });

        ws.addRow([]);
        ws.addRow([]);

        // ── Top 5 Gastos (native table) ──
        const topExpTitleRow = ws.addRow(['Top 5 Gastos', '', '', '', '']);
        ws.mergeCells(`A${ws.rowCount}:E${ws.rowCount}`);
        topExpTitleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FFF43F5E' } };
        topExpTitleRow.getCell(1).alignment = { horizontal: 'center' };
        ws.addRow([]);

        const topExpHeader = ws.addRow(['#', 'Concepto', 'Categoría', 'Fecha', 'Monto']);
        topExpHeader.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF43F5E' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
        });

        topExpenses.forEach((item, idx) => {
          const r = ws.addRow([
            idx + 1,
            item.description || 'Gasto',
            item.category || 'Sin cat.',
            new Date(item.date || item.createdAt).toLocaleDateString('es-NI'),
            Number(item.amount),
          ]);
          r.getCell(1).alignment = { horizontal: 'center' };
          r.getCell(1).font = { bold: true, color: { argb: 'FFF43F5E' } };
          r.getCell(5).numFmt = `"${currencySymbol}" #,##0.00`;
          r.getCell(5).font = { bold: true, color: { argb: 'FFF43F5E' } };
          r.getCell(5).alignment = { horizontal: 'right' };
          r.eachCell((cell) => {
            cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
            if (idx % 2 === 0) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF1F2' } };
            }
          });
        });

        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Finanzas_${new Date().toISOString().split('T')[0]}.xlsx`;
        link.click();
        toast.success("Excel generado exitosamente");
      } catch (e: any) {
        console.error(e);
        toast.error(e?.response?.data?.message || e?.message || "Error al generar Excel");
      }
    }
  }));

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Activity className="size-12 animate-pulse text-primary opacity-50" />
        <p className="font-black uppercase tracking-widest text-[10px]">Analizando Inteligencia Financiera...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* ═══ KPI Cards ═══ */}
      <div id="finance-report-kpis" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Ingresos */}
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><ArrowUpRight className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <ArrowUpRight className="size-3.5 text-emerald-500" /> Ingresos
              {getTrendValue(totalInc, prevTotalInc) !== 0 && (
                <span className={cn("ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold", getTrendValue(totalInc, prevTotalInc) > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")}>
                  {getTrendValue(totalInc, prevTotalInc) > 0 ? '+' : ''}{getTrendValue(totalInc, prevTotalInc).toFixed(1)}%
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-emerald-500">{formatConvertedAmount(totalInc, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{fInc.length} transacciones</p>
          </CardContent>
        </Card>

        {/* Total Gastos */}
        <Card className="border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><ArrowDownRight className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <ArrowDownRight className="size-3.5 text-rose-500" /> Gastos
              {getTrendValue(totalExp, prevTotalExp) !== 0 && (
                <span className={cn("ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold", getTrendValue(totalExp, prevTotalExp) > 0 ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500")}>
                  {getTrendValue(totalExp, prevTotalExp) > 0 ? '+' : ''}{getTrendValue(totalExp, prevTotalExp).toFixed(1)}%
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-rose-500">{formatConvertedAmount(totalExp, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{fExp.length} transacciones</p>
          </CardContent>
        </Card>

        {/* Utilidad Neta */}
        <Card className={cn("relative overflow-hidden group hover:shadow-lg transition-all", netUtility >= 0 ? "border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent" : "border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-transparent")}>
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Scale className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Scale className="size-3.5" /> Utilidad Neta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-xl font-black", netUtility >= 0 ? "text-emerald-500" : "text-rose-500")}>
              {formatConvertedAmount(netUtility, 'NIO')}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Ingresos - Gastos</p>
          </CardContent>
        </Card>

        {/* Margen */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Percent className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Percent className="size-3.5 text-primary" /> Margen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-primary">{margin.toFixed(1)}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{margin >= 20 ? 'Saludable' : margin >= 0 ? 'Bajo' : 'Negativo'}</p>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Charts Row ═══ */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card id="finance-monthly-chart" className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" /> Ingresos vs Gastos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} barGap={6}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" opacity={0.3} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtShort(v)} />
                  <Tooltip 
                    cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                  <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="ingresos" position="top" formatter={(v: number) => v > 0 ? fmtShort(v) : ''} style={{ fontSize: 9, fill: '#10b981', fontWeight: 700 }} />
                  </Bar>
                  <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="gastos" position="top" formatter={(v: number) => v > 0 ? fmtShort(v) : ''} style={{ fontSize: 9, fill: '#ef4444', fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card id="finance-trend-chart" className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Activity className="size-4 text-primary" /> Balance Acumulado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={balanceTrend}>
                  <defs>
                    <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" opacity={0.3} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => fmtShort(v)} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="balance" stroke="#10b981" strokeWidth={2.5} fill="url(#balanceGrad)" dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Top Items ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Ingresos */}
        <Card id="finance-top-incomes" className="border-emerald-500/20 min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <ArrowUpRight className="size-4 text-emerald-500" /> Top 5 Ingresos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topIncomes.map((inc: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="size-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-[10px] font-black text-emerald-600 shrink-0">
                    #{idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{inc.source || inc.description || 'Ingreso'}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{inc.category || 'Sin cat.'} · {new Date(inc.date || inc.createdAt).toLocaleDateString('es-NI')}</p>
                  </div>
                </div>
                <span className="text-sm font-black text-emerald-500 shrink-0 ml-3">+{formatConvertedAmount(Number(inc.amount), inc.currency, inc.exchangeRate)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top Gastos */}
        <Card id="finance-top-expenses" className="border-rose-500/20 min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <ArrowDownRight className="size-4 text-rose-500" /> Top 5 Gastos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topExpenses.map((exp: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="size-7 rounded-lg bg-rose-500/20 flex items-center justify-center text-[10px] font-black text-rose-600 shrink-0">
                    #{idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{exp.description || 'Gasto'}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{exp.category || 'Sin cat.'} · {new Date(exp.date || exp.createdAt).toLocaleDateString('es-NI')}</p>
                  </div>
                </div>
                <span className="text-sm font-black text-rose-500 shrink-0 ml-3">-{formatConvertedAmount(Number(exp.amount), exp.currency, exp.exchangeRate)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
});
FinanceReportTab.displayName = 'FinanceReportTab';

