import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LabelList, AreaChart, Area } from 'recharts';
import { billsService, paymentsMadeService, purchaseOrdersService } from '../../services/compras.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { ShoppingCart, Scale, TrendingUp, DollarSign, Package, ArrowUpRight, Activity, CreditCard, Luggage, ShoppingBag, Truck, Wallet, PieChart as PieChartIcon } from 'lucide-react';
import type { ReportExportRef, ReportProps } from './types';
import { cn } from '../ui/utils';
import { downloadExcelWorkbook, getBase64Image, sanitizeHtml2CanvasOklch } from '../../utils/reportExportUtils';

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

export const PurchasesReportTab = forwardRef<ReportExportRef, ReportProps>(({ dateRange }, ref) => {
  const { displayCurrency, formatConvertedAmount, convertAmount, exchangeRate } = useCurrency();
  const { themeConfig } = useTheme();
  const { user } = useAuth();
  const currencySymbol = displayCurrency === 'USD' ? '$' : 'C$';
  
  const [bills, setBills] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
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
        const [billRes, payRes, ordRes] = await Promise.all([
          billsService.getAll().catch(() => ({ data: [] })),
          paymentsMadeService.getAll().catch(() => ({ data: [] })),
          purchaseOrdersService.getAll().catch(() => ({ data: [] }))
        ]);
        setBills(Array.isArray(billRes) ? billRes : billRes?.data || []);
        setPayments(Array.isArray(payRes) ? payRes : payRes?.data || []);
        setOrders(Array.isArray(ordRes) ? ordRes : ordRes?.data || []);
      } catch (e: any) {
        toast.error(e?.response?.data?.message || e?.message || "Error cargando compras");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const { start: currentStart, prevStart, prevEnd } = useMemo(() => getRangeDates(dateRange), [dateRange]);

  const fBills = useMemo(() => bills.filter(i => {
    const d = toDate(i.date || i.createdAt);
    return d && d >= currentStart;
  }), [bills, currentStart]);

  const pBills = useMemo(() => bills.filter(i => {
    const d = toDate(i.date || i.createdAt);
    return d && d >= prevStart && d <= prevEnd;
  }), [bills, prevStart, prevEnd]);

  const fPay = useMemo(() => payments.filter(p => {
    const d = toDate(p.date || p.createdAt);
    return d && d >= currentStart;
  }), [payments, currentStart]);

  const totalPurchased = useMemo(() => fBills.reduce((acc, b) => acc + (b.currency === 'USD' ? Number(b.total || 0) * (b.exchangeRate || exchangeRate) : Number(b.total || 0)), 0), [fBills, exchangeRate]);
  const prevTotalPurchased = useMemo(() => pBills.reduce((acc, b) => acc + (b.currency === 'USD' ? Number(b.total || 0) * (b.exchangeRate || exchangeRate) : Number(b.total || 0)), 0), [pBills, exchangeRate]);
  
  const totalPaid = useMemo(() => fPay.reduce((acc, p) => acc + (p.currency === 'USD' ? Number(p.amount || 0) * (p.exchangeRate || exchangeRate) : Number(p.amount || 0)), 0), [fPay, exchangeRate]);
  
  // Sanity: payments should not exceed total purchased (prevents double-counting)
  const effectivePaid = Math.min(totalPaid, totalPurchased * 1.05);
  const payRatio = totalPurchased > 0 ? (effectivePaid / totalPurchased) * 100 : 0;
  const pendingCxp = Math.max(0, totalPurchased - effectivePaid);
  
  const getTrendValue = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  // ── 2 Tops ──
  const topSuppliers = useMemo(() => {
    const map: Record<string, number> = {};
    fBills.forEach(b => {
      const name = b.supplier?.name || b.vendorName || 'Proveedor Desconocido';
      const val = b.currency === 'USD' ? Number(b.total || 0) * (b.exchangeRate || exchangeRate) : Number(b.total || 0);
      map[name] = (map[name] || 0) + val;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);
  }, [fBills, exchangeRate]);

  const topProducts = useMemo(() => {
    const map: Record<string, { qty: number, total: number }> = {};
    fBills.forEach(b => {
      if (Array.isArray(b.items)) {
        b.items.forEach((item: any) => {
          const name = item.product?.name || item.description || 'Item';
          const val = b.currency === 'USD' ? Number(item.total || 0) * (b.exchangeRate || exchangeRate) : Number(item.total || 0);
          if (!map[name]) map[name] = { qty: 0, total: 0 };
          map[name].qty += Number(item.quantity || 1);
          map[name].total += val;
        });
      }
    });
    return Object.entries(map).map(([name, v]) => ({ name, value: v.total, qty: v.qty })).sort((a,b) => b.value - a.value).slice(0, 5);
  }, [fBills, exchangeRate]);

  // ── Charts ──
  const monthlyData = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const data = [];

    for (let i = 5; i >= 0; i--) {
      const monthIdx = (currentMonth - i + 12) % 12;
      const year = currentMonth - i < 0 ? currentYear - 1 : currentYear;
      
      const mPurch = fBills.filter(bill => {
        const d = new Date(bill.date || bill.createdAt);
        return d.getMonth() === monthIdx && d.getFullYear() === year;
      }).reduce((acc: number, b: any) => acc + (b.currency === 'USD' ? Number(b.total || 0) * (b.exchangeRate || exchangeRate) : Number(b.total || 0)), 0);
      
      const mPay = fPay.filter(pay => {
        const d = new Date(pay.date || pay.createdAt);
        return d.getMonth() === monthIdx && d.getFullYear() === year;
      }).reduce((acc: number, p: any) => acc + (p.currency === 'USD' ? Number(p.amount || 0) * (p.exchangeRate || exchangeRate) : Number(p.amount || 0)), 0);
      
      data.push({
        mes: MONTH_NAMES[monthIdx],
        compras: Math.round(mPurch),
        pagos: Math.round(mPay),
      });
    }
    return data;
  }, [fBills, fPay, exchangeRate]);

  useImperativeHandle(ref, () => ({
    exportPDF: async () => {
      try {
        toast.info('Generando PDF (Compras)...');
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const companyName = themeConfig.tenantName || user?.tenantName || 'Mi Empresa';
        const logoUrl = themeConfig.logo || '';
        const primaryColor = themeConfig.colors.primary || '#10b981';
        const primaryHex = primaryColor.startsWith('#') ? primaryColor : '#10b981';
        const rgbPrimary = primaryHex.startsWith('#')
          ? [parseInt(primaryHex.slice(1, 3), 16), parseInt(primaryHex.slice(3, 5), 16), parseInt(primaryHex.slice(5, 7), 16)]
          : [16, 185, 129];
        const marginX = 14;
        const contentWidth = pageWidth - marginX * 2;
        let currentY = 15;

        const checkPage = (needed: number) => {
          if (currentY + needed > pageHeight - 15) {
            doc.addPage();
            currentY = 20;
          }
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
        doc.text('Reporte de Compras', pageWidth / 2, currentY, { align: 'center' });
        currentY += 6;

        const now = new Date();
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        const currencyLabel = displayCurrency === 'USD' ? 'Dólares (USD)' : 'Córdobas (NIO)';
        doc.text(`Generado: ${now.toLocaleDateString('es-NI')} ${now.toLocaleTimeString('es-NI')}  |  Moneda: ${currencyLabel}`,
          pageWidth / 2,
          currentY,
          { align: 'center' },
        );
        currentY += 5;

        doc.setDrawColor(rgbPrimary[0], rgbPrimary[1], rgbPrimary[2]);
        doc.setLineWidth(0.8);
        doc.line(marginX, currentY, pageWidth - marginX, currentY);
        currentY += 10;

        const kpis = [
          { label: 'COMPRAS DEL PERÍODO', value: formatConvertedAmount(totalPurchased, 'NIO'), detail: `${fBills.length} facturas`, color: [245, 158, 11] },
          { label: 'PAGOS EFECTUADOS', value: formatConvertedAmount(effectivePaid, 'NIO'), detail: `${payRatio.toFixed(1)}% cumplimiento`, color: [16, 185, 129] },
          { label: 'SALDO PENDIENTE', value: formatConvertedAmount(pendingCxp, 'NIO'), detail: 'Cuentas por pagar', color: [244, 63, 94] },
          { label: 'TICKET DE COMPRA', value: formatConvertedAmount(avgCost, 'NIO'), detail: 'Valor medio por factura', color: [59, 130, 246] },
        ];

        const cols = 4;
        const boxW = (contentWidth - (cols - 1) * 4) / cols;
        const boxH = 22;
        checkPage(boxH + 5);
        kpis.forEach((kpi, idx) => {
          const x = marginX + idx * (boxW + 4);
          doc.setFillColor(kpi.color[0], kpi.color[1], kpi.color[2]);
          doc.roundedRect(x, currentY, boxW, boxH, 3, 3, 'F');
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(255, 255, 255);
          doc.text(kpi.label, x + boxW / 2, currentY + 6, { align: 'center' });
          doc.setFontSize(12);
          doc.text(kpi.value, x + boxW / 2, currentY + 13, { align: 'center' });
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.text(kpi.detail, x + boxW / 2, currentY + 18.5, { align: 'center' });
        });
        currentY += boxH + 10;

        const exportIds = ['purchases-monthly-chart', 'purchases-dynamics-chart', 'purchases-distribution-chart', 'purchases-pie-chart'];
        const capture = async (elementId: string, height: number) => {
          const el = document.getElementById(elementId);
          if (!el) return;
          checkPage(height + 15);
          try {
            const canvas = await html2canvas(el, {
              scale: 2,
              backgroundColor: '#ffffff',
              onclone: (clonedDoc) => sanitizeHtml2CanvasOklch(exportIds, clonedDoc, primaryHex),
            });
            doc.addImage(canvas.toDataURL('image/png'), 'PNG', marginX, currentY, contentWidth, height, undefined, 'FAST');
            currentY += height + 5;
          } catch {
          }
        };

        await capture('purchases-monthly-chart', 80);
        await capture('purchases-distribution-chart', 70);
        await capture('purchases-dynamics-chart', 70);
        await capture('purchases-pie-chart', 70);

        // ── Top Lists ──
        const renderTop = (title: string, data: any[], isSupplier: boolean) => {
          checkPage(40);
          doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 60);
          doc.text(title, marginX, currentY); currentY += 7;
          doc.setFillColor(isSupplier ? 245 : 59, isSupplier ? 158 : 130, isSupplier ? 11 : 246);
          doc.roundedRect(marginX, currentY, contentWidth, 8, 1, 1, 'F');
          doc.setFontSize(8); doc.setTextColor(255, 255, 255);
          doc.text(isSupplier ? 'Proveedor' : 'Producto', marginX + 3, currentY + 5.5);
          doc.text('Detalle', marginX + 80, currentY + 5.5);
          doc.text('Monto', marginX + 155, currentY + 5.5);
          currentY += 10;
          data.forEach((item, i) => {
            checkPage(12);
            if (i % 2 === 0) { doc.setFillColor(248, 249, 250); doc.rect(marginX, currentY - 1, contentWidth, 7, 'F'); }
            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
            doc.text(item.name.substring(0, 40), marginX + 3, currentY + 4);
            doc.text(isSupplier ? 'Suministro Estratégico' : `${item.qty} unidades adquiridas`, marginX + 80, currentY + 4);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(isSupplier ? 245 : 59, isSupplier ? 158 : 130, isSupplier ? 11 : 246);
            doc.text(formatConvertedAmount(Number(item.value), 'NIO'), marginX + 155, currentY + 4);
            currentY += 7;
          });
          currentY += 10;
        };

        renderTop('Top 5 Proveedores', topSuppliers, true);
        renderTop('Items Críticos (Inversión)', topProducts, false);

        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(7);
          doc.setTextColor(150);
          doc.text(`${companyName} - Reporte Compras - Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
        }

        doc.save(`Reporte_Compras_${now.toISOString().split('T')[0]}.pdf`);
        toast.success('PDF generado exitosamente');
      } catch (e: any) {
        console.error(e);
        toast.error(e?.response?.data?.message || e?.message || "Error exportando PDF");
      }
    },
    exportExcel: async () => {
      try {
        toast.info('Generando Excel (Compras)...');
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Compras');

        const companyName = themeConfig.tenantName || user?.tenantName || 'Mi Empresa';
        const logoUrl = themeConfig.logo || '';
        const primaryColor = themeConfig.colors.primary || '#10b981';
        const hexColor = primaryColor.startsWith('#') ? primaryColor.replace('#', '') : '10b981';
        const primaryHex = primaryColor.startsWith('#') ? primaryColor : '#10b981';
        const currencyLabel = displayCurrency === 'USD' ? 'Dólares (USD)' : 'Córdobas (NIO)';

        ws.getColumn(1).width = 30;
        ws.getColumn(2).width = 22;
        ws.getColumn(3).width = 22;
        ws.getColumn(4).width = 22;

        let currentRow = 1;

        if (logoUrl) {
          const base64Logo = await getBase64Image(logoUrl);
          if (base64Logo) {
            const logoId = wb.addImage({ base64: base64Logo, extension: 'png' });
            ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 100, height: 100 } });
            currentRow = 6;
          }
        }

        ws.mergeCells(`A${currentRow}:D${currentRow}`);
        const cName = ws.getCell(`A${currentRow}`);
        cName.value = companyName;
        cName.font = { size: 18, bold: true, color: { argb: `FF${hexColor}` } };
        cName.alignment = { horizontal: 'center' };
        currentRow++;

        ws.mergeCells(`A${currentRow}:D${currentRow}`);
        const cTitle = ws.getCell(`A${currentRow}`);
        cTitle.value = 'Reporte de Compras';
        cTitle.font = { size: 13, bold: true };
        cTitle.alignment = { horizontal: 'center' };
        currentRow++;

        ws.mergeCells(`A${currentRow}:D${currentRow}`);
        const cMeta = ws.getCell(`A${currentRow}`);
        cMeta.value = `Moneda: ${currencyLabel} (${currencySymbol})  |  ${new Date().toLocaleDateString('es-NI')}`;
        cMeta.font = { size: 10, italic: true, color: { argb: 'FF888888' } };
        cMeta.alignment = { horizontal: 'center' };
        currentRow += 2;

        // ── KPIs ──
        const kpiBoxes = [
          { label: 'COMPRAS PERIODO', value: formatConvertedAmount(totalPurchased, 'NIO'), detail: `${fBills.length} facturas`, bgColor: 'FFF59E0B' },
          { label: 'PAGOS EFECTUADOS', value: formatConvertedAmount(effectivePaid, 'NIO'), detail: `${payRatio.toFixed(1)}% cumplido`, bgColor: 'FF10B981' },
          { label: 'SALDO PENDIENTE', value: formatConvertedAmount(pendingCxp, 'NIO'), detail: 'CxP', bgColor: 'FFF43F5E' },
          { label: 'TICKET DE COMPRA', value: formatConvertedAmount(avgCost, 'NIO'), detail: 'Valor medio por factura', bgColor: 'FF3B82F6' },
        ];

        ws.getRow(currentRow).height = 18;
        kpiBoxes.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.label;
          cell.font = { size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        currentRow++;
        ws.getRow(currentRow).height = 28;
        kpiBoxes.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.value;
          cell.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        currentRow++;
        ws.getRow(currentRow).height = 16;
        kpiBoxes.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.detail;
          cell.font = { size: 8, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
        currentRow += 2;

        const exportIds = ['purchases-monthly-chart', 'purchases-dynamics-chart', 'purchases-distribution-chart', 'purchases-pie-chart'];
        const captureForExcel = async (elementId: string, targetRow: number) => {
          const el = document.getElementById(elementId);
          if (!el) return targetRow;
          try {
            const canvas = await html2canvas(el, {
              scale: 2,
              backgroundColor: '#ffffff',
              onclone: (clonedDoc) => sanitizeHtml2CanvasOklch(exportIds, clonedDoc, primaryHex),
            });
            const imgId = wb.addImage({ base64: canvas.toDataURL('image/png'), extension: 'png' });
            ws.addImage(imgId, { tl: { col: 0, row: targetRow }, ext: { width: 720, height: 260 } });
            return targetRow + 18;
          } catch {
            return targetRow;
          }
        };

        let imgRow = currentRow + 2;
        imgRow = await captureForExcel('purchases-monthly-chart', imgRow);
        imgRow = await captureForExcel('purchases-distribution-chart', imgRow);
        imgRow = await captureForExcel('purchases-dynamics-chart', imgRow);
        imgRow = await captureForExcel('purchases-pie-chart', imgRow);

        while (ws.rowCount < imgRow) ws.addRow([]);
        currentRow = ws.rowCount + 2;

        const thinBorder = { style: 'thin' as const, color: { argb: 'FFE5E7EB' } };

        // ── Top 5 Proveedores (native table) ──
        const topSupTitleRow = ws.addRow(['Top 5 Proveedores', '', '', '']);
        ws.mergeCells(`A${ws.rowCount}:D${ws.rowCount}`);
        topSupTitleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FFF59E0B' } };
        topSupTitleRow.getCell(1).alignment = { horizontal: 'center' };
        ws.addRow([]);

        const topSupHeader = ws.addRow(['#', 'Proveedor', 'Detalle', 'Monto']);
        topSupHeader.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
        });

        topSuppliers.forEach((item: any, idx) => {
          const r = ws.addRow([
            idx + 1,
            item.name,
            'Suministro Estratégico',
            Number(item.value),
          ]);
          r.getCell(1).alignment = { horizontal: 'center' };
          r.getCell(1).font = { bold: true, color: { argb: 'FFF59E0B' } };
          r.getCell(4).numFmt = `"${currencySymbol}" #,##0.00`;
          r.getCell(4).font = { bold: true, color: { argb: 'FFF59E0B' } };
          r.getCell(4).alignment = { horizontal: 'right' };
          r.eachCell((cell) => {
            cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
            if (idx % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
          });
        });

        ws.addRow([]); ws.addRow([]);

        // ── Items Críticos ──
        const topProdTitleRow = ws.addRow(['Items Críticos (Inversión)', '', '', '']);
        ws.mergeCells(`A${ws.rowCount}:D${ws.rowCount}`);
        topProdTitleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF3B82F6' } };
        topProdTitleRow.getCell(1).alignment = { horizontal: 'center' };
        ws.addRow([]);

        const topProdHeader = ws.addRow(['#', 'Producto', 'Detalle', 'Monto']);
        topProdHeader.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
        });

        topProducts.forEach((item: any, idx) => {
          const r = ws.addRow([
            idx + 1,
            item.name,
            `${item.qty} unidades adquiridas`,
            Number(item.value),
          ]);
          r.getCell(1).alignment = { horizontal: 'center' };
          r.getCell(1).font = { bold: true, color: { argb: 'FF3B82F6' } };
          r.getCell(4).numFmt = `"${currencySymbol}" #,##0.00`;
          r.getCell(4).font = { bold: true, color: { argb: 'FF3B82F6' } };
          r.getCell(4).alignment = { horizontal: 'right' };
          r.eachCell((cell) => {
            cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
            if (idx % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
          });
        });

        await downloadExcelWorkbook(wb, `Reporte_Compras_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('Excel exportado exitosamente');
      } catch (e: any) {
        console.error(e);
        toast.error(e?.response?.data?.message || e?.message || "Error exportando Excel");
      }
    }
  }));

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Activity className="size-12 animate-pulse text-primary opacity-50" />
        <p className="font-black uppercase tracking-widest text-[10px]">Consolidando Cadena de Suministro...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* ═══ KPI Cards (Dashboard Style) ═══ */}
      <div id="purchases-report-kpis" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Compras Totales */}
        <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><ShoppingBag className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Truck className="size-3.5 text-orange-500" /> Adquisiciones
              {getTrendValue(totalPurchased, prevTotalPurchased) !== 0 && (
                <span className={cn("ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold", getTrendValue(totalPurchased, prevTotalPurchased) > 0 ? "bg-rose-500/10 text-rose-500" : "bg-emerald-500/10 text-emerald-500")}>
                  {getTrendValue(totalPurchased, prevTotalPurchased) > 0 ? '+' : ''}{getTrendValue(totalPurchased, prevTotalPurchased).toFixed(1)}%
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-orange-500">{formatConvertedAmount(totalPurchased, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{fBills.length} facturas recibidas</p>
          </CardContent>
        </Card>

        {/* Pagos Realizados */}
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><CreditCard className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Scale className="size-3.5 text-emerald-500" /> Pagos Efectuados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-emerald-500">{formatConvertedAmount(effectivePaid, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{payRatio.toFixed(1)}% de cumplimiento</p>
          </CardContent>
        </Card>

        {/* Deuda Pendiente */}
        <Card className="border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Wallet className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-rose-500" /> Pasivos Netos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-rose-500">{formatConvertedAmount(pendingCxp, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Saldo pendiente por pagar</p>
          </CardContent>
        </Card>

        {/* Costo Promedio */}
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Package className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="size-3.5 text-blue-500" /> Ticket de Compra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-blue-500">{formatConvertedAmount(avgCost, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Valor medio por factura</p>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Charts Row ═══ */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card id="purchases-monthly-chart" className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" /> Histórico de Suministro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} barGap={6}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.3} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => fmtShort(v)} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                  <Bar dataKey="compras" name="Compras" fill="#f97316" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="compras" position="top" formatter={(v: number) => v > 0 ? fmtShort(v) : ''} style={{ fontSize: 9, fill: '#f97316', fontWeight: 700 }} />
                  </Bar>
                  <Bar dataKey="pagos" name="Pagado" fill="#10b981" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="pagos" position="top" formatter={(v: number) => v > 0 ? fmtShort(v) : ''} style={{ fontSize: 9, fill: '#10b981', fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card id="purchases-distribution-chart" className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Package className="size-4 text-primary" /> Eficiencia Logística
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 text-center">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase">OC Pendientes</p>
                   <p className="text-2xl font-black text-orange-500">{orders.filter(o => o.status === 'PENDING').length}</p>
                </div>
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-center">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase">Recibidas</p>
                   <p className="text-2xl font-black text-blue-500">{orders.filter(o => o.status === 'RECEIVED').length}</p>
                </div>
             </div>
             <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-4 transition-all hover:bg-emerald-500/10">
                <div className="p-3 rounded-lg bg-emerald-500/10">
                   <CreditCard className="size-5 text-emerald-500" />
                </div>
                <div>
                   <p className="text-xs font-bold text-emerald-500 uppercase">Salud Crediticia</p>
                   <p className="text-[10px] text-muted-foreground">Proporción de pago sobre adquisiciones: {payRatio.toFixed(1)}%</p>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Evolution & Distribution ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="purchases-dynamics-chart" className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Activity className="size-4 text-primary" /> Dinámica de Compras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full pt-2">
               <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="purchGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" opacity={0.3} />
                    <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={v => fmtShort(v)} />
                    <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="compras" stroke="#f97316" strokeWidth={2.5} fill="url(#purchGrad)" dot={{ r: 4, fill: '#f97316', strokeWidth: 2, stroke: '#fff' }} />
                  </AreaChart>
               </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card id="purchases-pie-chart" className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <PieChartIcon className="size-4 text-primary" /> Distribución de Gasto
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Facturas', value: bills.length },
                        { name: 'Órdenes', value: orders.length }
                      ]}
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      <Cell fill="#f59e0b" />
                      <Cell fill="#8b5cf6" />
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
             </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Top Items ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Proveedores */}
        <Card id="purchases-top-suppliers" className="border-orange-500/20 min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Truck className="size-4 text-orange-500" /> Top 5 Proveedores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topSuppliers.map((s: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-orange-500/5 border border-orange-500/10 hover:bg-orange-500/10 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="size-7 rounded-lg bg-orange-500/20 flex items-center justify-center text-[10px] font-black text-orange-600 shrink-0">
                    #{idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">Suministro Estratégico</p>
                  </div>
                </div>
                <span className="text-sm font-black text-orange-500 shrink-0 ml-3">{formatConvertedAmount(Number(s.value), 'NIO')}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Items Críticos */}
        <Card id="purchases-top-products" className="border-blue-500/20 min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Package className="size-4 text-blue-500" /> Items Críticos (Inversión)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topProducts.map((p: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="size-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-[10px] font-black text-blue-600 shrink-0">
                    #{idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{p.qty} unidades adquiridas</p>
                  </div>
                </div>
                <span className="text-sm font-black text-blue-500 shrink-0 ml-3">{formatConvertedAmount(Number(p.value), 'NIO')}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
});
PurchasesReportTab.displayName = 'PurchasesReportTab';

