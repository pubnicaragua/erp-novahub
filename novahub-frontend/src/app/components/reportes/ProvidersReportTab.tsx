import { useMemo, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { suppliersService, billsService, paymentsMadeService, purchaseOrdersService } from '../../services/compras.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Users, TrendingUp, Package, Activity, CreditCard, DollarSign } from 'lucide-react';
import type { ReportExportRef, ReportProps } from './types';
import { useTenantQuery, fetchAllReportPages } from '../../hooks/useTenantQuery';
import { downloadExcelWorkbook, getBase64Image, sanitizeHtml2CanvasOklch } from '../../utils/reportExportUtils';
import { drawReportBrandMeta, drawReportKpiCards, drawReportTable, generateConfiguredReportSectionsPDF, getPdfDesignSettings, pdfDesignPaper, type ConfiguredReportSectionInput } from '../../utils/pdfGenerator';
import { buildReportDownloadFileName } from '../../utils/exportFileNames';
import { normalizeCurrency, summarizeAmountsByCurrency, type SupportedCurrency } from '../../utils/currency';

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

export const ProvidersReportTab = forwardRef<ReportExportRef, ReportProps>(({ dateRange }, ref) => {
  const { displayCurrency, displayMode, baseCurrency, valuationMode, valuationModeLabel, formatConvertedAmount: formatAmountBySource, formatExplicitAmount, toBaseAmount, exchangeRate } = useCurrency();
  const { themeConfig } = useTheme();
  const { user, canPerform } = useAuth();
  const canViewPurchases = canPerform('PURCHASES', 'view');
  const currencySymbol = displayCurrency === 'USD' ? '$' : 'C$';
  const formatConvertedAmount = (amount: number, sourceCurrency?: string, sourceExchangeRate?: number) =>
    formatAmountBySource(amount, sourceCurrency === 'NIO' ? baseCurrency : sourceCurrency, sourceExchangeRate);
  
  const { data: reportData, isLoading: loading } = useTenantQuery(['reports', 'providers'], async (signal) => {
    const filters = { pageSize: 5000, report: true };
    const [billRes, payRes, ordRes, suppRes] = await Promise.all([
      fetchAllReportPages((pageFilters) => billsService.getAll(pageFilters, signal), filters),
      fetchAllReportPages((pageFilters) => paymentsMadeService.getAll(pageFilters, signal), filters),
      fetchAllReportPages((pageFilters) => purchaseOrdersService.getAll(pageFilters, signal), filters),
      fetchAllReportPages((pageFilters) => suppliersService.getAll(pageFilters, signal), filters),
    ]);
    return { bills: billRes, payments: payRes, orders: ordRes, suppliers: suppRes };
  }, { enabled: canViewPurchases, onError: (e) => toast.error(e.message || 'Error cargando proveedores') });
  const bills = reportData?.bills || [];
  const payments = reportData?.payments || [];
  const orders = reportData?.orders || [];
  const suppliers = reportData?.suppliers || [];

  const fmtShort = (v: number) => {
    const num = Number(v);
    if (!Number.isFinite(num)) return 'C$0';
    const converted = toBaseAmount(v, baseCurrency);
    if (Math.abs(converted) >= 1000000) return `${currencySymbol}${(converted/1000000).toFixed(1)}M`;
    if (Math.abs(converted) >= 1000) return `${currencySymbol}${(converted/1000).toFixed(1)}k`;
    return `${currencySymbol}${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const { start: currentStart } = useMemo(() => getRangeDates(dateRange), [dateRange]);

  const fBills = useMemo(() => bills.filter(i => {
    const d = toDate(i.date || i.createdAt);
    return d && d >= currentStart;
  }), [bills, currentStart]);

  const fPay = useMemo(() => payments.filter(p => {
    const d = toDate(p.date || p.createdAt);
    return d && d >= currentStart;
  }), [payments, currentStart]);

  const sourceRate = (rate?: number) => valuationMode === 'CURRENT' ? exchangeRate : (rate || exchangeRate);
  const documentTotal = (b: any) => toBaseAmount(Number(b.total ?? b.baseTotal ?? 0), b.currency, sourceRate(b.exchangeRate));
  const paymentAmount = (p: any) => toBaseAmount(Number(p.amount ?? p.baseAmount ?? 0), p.currency, sourceRate(p.exchangeRate));
  const totalPurchased = useMemo(() => fBills.reduce((acc, b) => acc + documentTotal(b), 0), [fBills, exchangeRate, baseCurrency, valuationMode]);
  const totalPaid = useMemo(() => fPay.reduce((acc, p) => acc + paymentAmount(p), 0), [fPay, exchangeRate, baseCurrency, valuationMode]);
  
  const payRatio = totalPurchased > 0 ? Math.min(100, (totalPaid / totalPurchased) * 100) : 0;
  const avgPurchasePerSupp = suppliers.length > 0 ? (totalPurchased / suppliers.length) : 0;
  const originalRows = [...fBills, ...fPay];
  const originalCurrencies = summarizeAmountsByCurrency(originalRows, () => 0, (row: any) => row.currency || baseCurrency).map((item) => item.currency);
  const originalSum = (rows: any[], amountOf: (row: any) => number, currency: SupportedCurrency) => rows.filter((row) => normalizeCurrency(row.currency || baseCurrency) === currency).reduce((sum, row) => sum + (Number.isFinite(amountOf(row)) ? amountOf(row) : 0), 0);
  const originalPurchased = (currency: SupportedCurrency) => originalSum(fBills, (row) => Number(row.total ?? row.baseTotal ?? 0), currency);
  const originalPaid = (currency: SupportedCurrency) => originalSum(fPay, (row) => Number(row.amount ?? row.baseAmount ?? 0), currency);
  const renderProviderMoneyKpi = (title: string, total: number, amountByCurrency: (currency: SupportedCurrency) => number, color: string, detail: (currency: SupportedCurrency) => string) => displayMode === 'ORIGINAL'
    ? originalCurrencies.map((currency) => <Card key={`${title}-${currency}`} className="relative overflow-hidden border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent transition-all hover:shadow-lg"><CardHeader className="pb-1"><CardTitle className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><DollarSign className="size-3.5 text-orange-500" /> {title} ({currency})</CardTitle></CardHeader><CardContent><p className={`text-xl font-black ${color}`}>{formatExplicitAmount(amountByCurrency(currency), currency)}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{detail(currency)}</p></CardContent></Card>)
    : <Card className="relative overflow-hidden border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent transition-all hover:shadow-lg"><CardHeader className="pb-1"><CardTitle className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><DollarSign className="size-3.5 text-orange-500" /> {title} ({displayCurrency})</CardTitle></CardHeader><CardContent><p className={`text-xl font-black ${color}`}>{formatConvertedAmount(total, 'NIO')}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{valuationModeLabel}</p></CardContent></Card>;

  // ── 2 Tops ──
  const topSuppliers = useMemo(() => {
    const map: Record<string, number> = {};
    fBills.forEach(b => {
      const name = b.supplier?.name || b.vendorName || 'Proveedor General';
      const val = documentTotal(b);
      map[name] = (map[name] || 0) + val;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 5);
  }, [fBills, exchangeRate]);

  const topProducts = useMemo(() => {
    const map: Record<string, { qty: number, total: number }> = {};
    fBills.forEach(b => {
      if (Array.isArray(b.items)) {
        b.items.forEach((item: any) => {
          const name = item.product?.name || item.description || 'Insumo';
          const val = toBaseAmount(Number(item.total || 0), b.currency, sourceRate(b.exchangeRate));
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
    const data = [];

    for (let i = 5; i >= 0; i--) {
      const monthIdx = (currentMonth - i + 12) % 12;
      const mPurch = fBills.filter(bill => {
        const d = new Date(bill.date || bill.createdAt);
        return d.getMonth() === monthIdx;
      }).reduce((acc: number, b: any) => acc + documentTotal(b), 0);
      
      data.push({
        mes: MONTH_NAMES[monthIdx],
        compras: Math.round(mPurch),
      });
    }
    return data;
  }, [fBills, exchangeRate]);

  useImperativeHandle(ref, () => ({
    exportPDF: async () => {
      try {
        toast.info('Generando PDF (Proveedores)...');
        const pdfSettings = await getPdfDesignSettings('reportes.providers');
        const doc = new jsPDF(pdfDesignPaper(pdfSettings));
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const companyName = pdfSettings.showCompanyName === false ? '' : String(pdfSettings.companyName || themeConfig.tenantName || user?.tenantName || 'Mi Empresa');
        const logoUrl = String(pdfSettings.logoUrl || themeConfig.logo || '');
        const primaryColor = pdfSettings.primaryColor || themeConfig.colors.primary || '#10b981';
        const primaryHex = primaryColor.startsWith('#') ? primaryColor : '#10b981';
        const rgbPrimary = primaryHex.startsWith('#')
          ? [parseInt(primaryHex.slice(1, 3), 16), parseInt(primaryHex.slice(3, 5), 16), parseInt(primaryHex.slice(5, 7), 16)]
          : [16, 185, 129];
        const marginX = 14;
        const contentWidth = pageWidth - marginX * 2;
        let currentY = 15;
        const reportSections: ConfiguredReportSectionInput[] = [];

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
        doc.text('Reporte de Proveedores', pageWidth / 2, currentY, { align: 'center' });
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
        currentY = drawReportBrandMeta({ doc, settings: pdfSettings, pageWidth, contentWidth, currentY });

        doc.setDrawColor(rgbPrimary[0], rgbPrimary[1], rgbPrimary[2]);
        doc.setLineWidth(0.8);
        doc.line(marginX, currentY, pageWidth - marginX, currentY);
        currentY += 10;

        const kpis = [
          { label: 'SUMINISTRO TOTAL', value: formatConvertedAmount(totalPurchased, 'NIO'), detail: `${suppliers.length} proveedores registrados`, color: [245, 158, 11] },
          { label: 'LOGÍSTICA ACTIVA', value: orders.filter(o => ['PENDING', 'APPROVED'].includes(String(o.status || '').toUpperCase())).length.toString(), detail: 'Órdenes pendientes de entrega', color: [59, 130, 246] },
          { label: 'CUENTAS POR PAGAR', value: formatConvertedAmount(totalPurchased - totalPaid, 'NIO'), detail: `${payRatio.toFixed(1)}% de deuda saldada`, color: [244, 63, 94] },
          { label: 'FLUJO DE PAGO', value: formatConvertedAmount(totalPaid, 'NIO'), detail: 'Total liquidado con terceros', color: [16, 185, 129] },
        ];

        const boxH = 22;
        checkPage(boxH + 5);
        currentY = drawReportKpiCards({ doc, kpis, marginX, contentWidth, currentY, columns: 4, boxHeight: boxH, labelFontSize: 7.5, valueFontSize: 11, detailFontSize: 6.5 });

        const renderSection = (title: string, headers: string[], rows: (string | number)[][], colorRGB: number[]) => {
          reportSections.push({ title, headers, rows });
          currentY = drawReportTable({ doc, title, headers, rows, color: colorRGB, marginX, contentWidth, currentY });
        };
        const money = (value: unknown) => formatConvertedAmount(Number(value || 0), 'NIO');
        const percent = (value: unknown) => `${Number(value || 0).toFixed(1)}%`;

        renderSection('Tendencia de Abastecimiento', ['Mes', 'Compras', 'Participación'], monthlyData.map(point => [point.mes, money(point.compras), percent(totalPurchased > 0 ? (point.compras / totalPurchased) * 100 : 0)]), [245, 158, 11]);
        renderSection('Eficiencia del Ciclo', ['Indicador', 'Valor', 'Detalle'], [
          ['Promedio por proveedor', money(avgPurchasePerSupp), `${suppliers.length} proveedores registrados`],
          ['Facturas en mora', bills.filter(b => b.status === 'OVERDUE').length, 'Facturas vencidas'],
          ['Cumplimiento de pago', percent(payRatio), 'Pagos realizados ÷ compras'],
          ['Órdenes pendientes de recepción', orders.filter(o => ['PENDING', 'APPROVED'].includes(String(o.status || '').toUpperCase())).length, 'Órdenes pendientes de entrega'],
        ], [59, 130, 246]);
        renderSection('Principales Proveedores', ['Proveedor', 'Compras', 'Participación'], topSuppliers.map(supplier => [supplier.name, money(supplier.value), percent(totalPurchased > 0 ? (supplier.value / totalPurchased) * 100 : 0)]), [245, 158, 11]);
        renderSection('Insumos con Mayor Gasto', ['Insumo', 'Monto', 'Unidades'], topProducts.map(product => [product.name, money(product.value), product.qty]), [59, 130, 246]);

        const configured = await generateConfiguredReportSectionsPDF({
          targetKey: 'reportes.providers', title: 'Reporte de Proveedores', tenantName: companyName, tenantLogo: logoUrl,
          sections: reportSections, kpis: kpis.map(({ label, value, detail }) => ({ label, value, detail })), fileName: buildReportDownloadFileName(['reporte_proveedores'], 'pdf', dateRange), periodLabel: dateRange,
        });
        if (configured) { toast.success('PDF generado exitosamente'); return; }

        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(7);
          doc.setTextColor(150);
          doc.text(`${companyName} - Reporte Proveedores - Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
        }

        doc.save(buildReportDownloadFileName(['reporte_proveedores'], 'pdf', dateRange));
        toast.success('PDF generado exitosamente');
      } catch (e: any) {
        console.error(e);
        toast.error(e?.response?.data?.message || e?.message || "Error exportando PDF");
      }
    },
    exportExcel: async () => {
      try {
        toast.info('Generando Excel (Proveedores)...');
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Proveedores');

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
        cTitle.value = 'Reporte de Proveedores';
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
          { label: 'SUMINISTRO TOTAL', value: formatConvertedAmount(totalPurchased, 'NIO'), detail: `${suppliers.length} proveedores registrados`, bgColor: 'FFF59E0B' },
          { label: 'LOGÍSTICA ACTIVA', value: orders.filter(o => ['PENDING', 'APPROVED'].includes(String(o.status || '').toUpperCase())).length.toString(), detail: 'Órdenes pendientes de entrega', bgColor: 'FF3B82F6' },
          { label: 'CUENTAS POR PAGAR', value: formatConvertedAmount(totalPurchased - totalPaid, 'NIO'), detail: `${payRatio.toFixed(1)}% de deuda saldada`, bgColor: 'FFF43F5E' },
          { label: 'FLUJO DE PAGO', value: formatConvertedAmount(totalPaid, 'NIO'), detail: 'Total liquidado con terceros', bgColor: 'FF10B981' },
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

        const exportIds = ['providers-monthly-chart', 'providers-efficiency-chart'];
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
        imgRow = await captureForExcel('providers-monthly-chart', imgRow);
        imgRow = await captureForExcel('providers-efficiency-chart', imgRow);

        while (ws.rowCount < imgRow) ws.addRow([]);
        currentRow = ws.rowCount + 2;

        const thinBorder = { style: 'thin' as const, color: { argb: 'FFE5E7EB' } };

        // ── Principales Proveedores (native table) ──
        const topSupTitleRow = ws.addRow(['Socios Estratégicos (Volumen)', '', '', '']);
        ws.mergeCells(`A${ws.rowCount}:D${ws.rowCount}`);
        topSupTitleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FFF59E0B' } };
        topSupTitleRow.getCell(1).alignment = { horizontal: 'center' };
        ws.addRow([]);

        const topSupHeader = ws.addRow(['#', 'Socio', 'Detalle', 'Suma Total']);
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
            'Clasificación Tier 1',
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
        const topProdTitleRow = ws.addRow(['Insumos con Mayor Gasto', '', '', '']);
        ws.mergeCells(`A${ws.rowCount}:D${ws.rowCount}`);
        topProdTitleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF3B82F6' } };
        topProdTitleRow.getCell(1).alignment = { horizontal: 'center' };
        ws.addRow([]);

        const topProdHeader = ws.addRow(['#', 'Insumo', 'Detalle', 'Suma Total']);
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
            `${item.qty} unidades recibidas`,
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

        await downloadExcelWorkbook(wb, buildReportDownloadFileName(['reporte_proveedores'], 'xlsx', dateRange));
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
        <p className="font-black uppercase tracking-widest text-[10px]">Auditando Cadena de Suministro...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* ═══ KPI Cards (Dashboard Style) ═══ */}
      <div id="providers-report-kpis" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {renderProviderMoneyKpi('Compras a proveedores', totalPurchased, originalPurchased, 'text-orange-500', () => `${suppliers.length} proveedores registrados`)}

        {/* Órdenes por Recibir */}
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Package className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="size-3.5 text-blue-500" /> Órdenes pendientes de recepción
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-blue-500">{orders.filter(o => ['PENDING', 'APPROVED'].includes(String(o.status || '').toUpperCase())).length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Órdenes pendientes de entrega</p>
          </CardContent>
        </Card>

        {renderProviderMoneyKpi('Cuentas por Pagar', Math.max(0, totalPurchased - totalPaid), (currency) => Math.max(0, originalPurchased(currency) - originalPaid(currency)), 'text-rose-500', () => `${payRatio.toFixed(1)}% de deuda saldada`)}

        {renderProviderMoneyKpi('Pagos realizados', totalPaid, originalPaid, 'text-emerald-500', () => 'Total liquidado con terceros')}
      </div>

      {/* ═══ Charts Row ═══ */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card id="providers-monthly-chart" className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" /> Tendencia de Abastecimiento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="suppGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" opacity={0.3} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtShort(v)} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="compras" name="Compras" stroke="#f59e0b" strokeWidth={2.5} fill="url(#suppGrad)" dot={{ r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card id="providers-efficiency-chart" className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Activity className="size-4 text-primary" /> Eficiencia del Ciclo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-center">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase">Promedio OC</p>
                   <p className="text-2xl font-black text-blue-500">{formatConvertedAmount(avgPurchasePerSupp, 'NIO')}</p>
                </div>
                <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 text-center">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase">Facturas Mora</p>
                   <p className="text-2xl font-black text-orange-500">{bills.filter(b => b.status === 'OVERDUE').length}</p>
                </div>
             </div>
             <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-4 transition-all hover:bg-emerald-500/10">
                <div className="p-3 rounded-lg bg-emerald-500/10">
                   <CreditCard className="size-5 text-emerald-500" />
                </div>
                <div>
                   <p className="text-xs font-bold text-emerald-500 uppercase">Cumplimiento de pago</p>
                   <p className="text-[10px] text-muted-foreground">Capacidad de amortización: {payRatio.toFixed(1)}%</p>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Top Providers & Items ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Proveedores */}
        <Card id="providers-top-suppliers" className="border-orange-500/20 min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Users className="size-4 text-orange-500" /> Principales proveedores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {topSuppliers.map((s: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 hover:bg-orange-500/10 transition-colors group">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="size-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-xs font-black text-orange-600 shrink-0 transition-transform group-hover:scale-110">
                    #{idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black truncate">{s.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight truncate">Clasificación Tier 1</p>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-black text-orange-500">{formatConvertedAmount(Number(s.value), 'NIO')}</p>
                  <div className="h-1 w-24 bg-orange-500/10 rounded-full mt-1.5 overflow-hidden">
                     <div 
                       className="h-full bg-orange-500/50 rounded-full" 
                       style={{ width: `${Math.min((s.value / Math.max(totalPurchased,1)) * 500, 100)}%` }} 
                     />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Items Críticos */}
        <Card id="providers-top-products" className="border-blue-500/20 min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Package className="size-4 text-blue-500" /> Insumos con Mayor Gasto
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
                    <p className="text-[10px] text-muted-foreground truncate">{p.qty} unidades recibidas</p>
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
ProvidersReportTab.displayName = 'ProvidersReportTab';
