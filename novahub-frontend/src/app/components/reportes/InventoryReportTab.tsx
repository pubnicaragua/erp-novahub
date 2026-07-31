import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { inventoryService } from '../../services/inventario.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Package, AlertTriangle, TrendingDown, DollarSign, Activity, ShoppingCart, ArrowUpRight, Scale, Warehouse, Tag } from 'lucide-react';
import type { ReportExportRef, ReportProps } from './types';
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

export const InventoryReportTab = forwardRef<ReportExportRef, ReportProps>(({ dateRange }, ref) => {
  const { displayCurrency, convertAmount, formatConvertedAmount, exchangeRate } = useCurrency();
  const { themeConfig } = useTheme();
  const currencySymbol = displayCurrency === 'USD' ? '$' : 'C$';

  const fmtShort = (v: number) => {
    const num = Number(v);
    if (!Number.isFinite(num)) return 'C$0';
    const converted = convertAmount(num, 'NIO');
    if (Math.abs(converted) >= 1000000) return `${currencySymbol}${(converted/1000000).toFixed(1)}M`;
    if (Math.abs(converted) >= 1000) return `${currencySymbol}${(converted/1000).toFixed(1)}k`;
    return `${currencySymbol}${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };
  
  const [products, setProducts] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [prodRes, movRes, lowRes] = await Promise.all([
          inventoryService.getProducts().catch(() => ({ data: [] })),
          inventoryService.getMovements().catch(() => ({ data: [] })),
          inventoryService.getLowStockProducts().catch(() => ({ data: [] }))
        ]);
        setProducts(Array.isArray(prodRes) ? prodRes : (prodRes as any)?.data || []);
        setMovements(Array.isArray(movRes) ? movRes : (movRes as any)?.data || []);
        setLowStock(Array.isArray(lowRes) ? lowRes : (lowRes as any)?.data || []);
      } catch (e: any) {
        toast.error(e?.response?.data?.message || e?.message || "Error cargando inventario");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const { start: currentStart } = useMemo(() => getRangeDates(dateRange), [dateRange]);

  const fMov = useMemo(() => movements.filter(i => {
    const d = toDate(i.createdAt);
    return d && d >= currentStart;
  }), [movements, currentStart]);

  const totalValue = useMemo(() => products.reduce((acc, p) => acc + (Number(p.costPrice || 0) * Number(p.stock || 0)), 0), [products, exchangeRate]);
  const totalSaleValue = useMemo(() => products.reduce((acc, p) => acc + (Number(p.salePrice || 0) * Number(p.stock || 0)), 0), [products, exchangeRate]);
  
  const rotationRate = 14.2; // Proxy value for demo

  // ── 2 Tops ──
  const topValued = useMemo(() => {
    return products.map(p => ({
      name: p.name,
      value: Number(p.costPrice || 0) * Number(p.stock || 0),
      stock: p.stock
    })).sort((a,b) => b.value - a.value).slice(0, 5);
  }, [products, exchangeRate]);

  const topRotated = useMemo(() => {
    const map: Record<string, number> = {};
    fMov.filter(m => m.type === 'OUT').forEach(m => {
       const name = m.product?.name || 'Item';
       map[name] = (map[name] || 0) + Math.abs(m.quantity || 0);
    });
    return Object.entries(map).map(([name, qty]) => ({ name, qty })).sort((a,b) => b.qty - a.qty).slice(0, 5);
  }, [fMov]);

  const categoryValueData = useMemo(() => {
    const map = products.reduce((acc: Record<string, number>, p: any) => {
      const c = p.category?.name || (typeof p.category === 'string' ? p.category : 'Sin categoría');
      acc[c] = (acc[c] || 0) + Number(p.costPrice || 0) * Number(p.stock || 0);
      return acc;
    }, {});
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [products]);

  // ── Charts ──
  const monthlyData = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const monthIdx = (currentMonth - i + 12) % 12;
      const year = (currentMonth - i < 0) ? currentYear - 1 : currentYear;

      const mIn = movements.filter(m => {
        const d = toDate(m.createdAt);
        return d && d.getMonth() === monthIdx && d.getFullYear() === year && m.type === 'IN';
      }).reduce((a, c) => a + (c.quantity || 0), 0);

      const mOut = movements.filter(m => {
        const d = toDate(m.createdAt);
        return d && d.getMonth() === monthIdx && d.getFullYear() === year && m.type === 'OUT';
      }).reduce((a, c) => a + Math.abs(c.quantity || 0), 0);

      data.push({
        mes: MONTH_NAMES[monthIdx],
        entradas: mIn,
        salidas: mOut
      });
    }
    return data;
  }, [movements]);

  useImperativeHandle(ref, () => ({
    exportPDF: async () => {
      toast.info("Generando PDF (Inventario)...");
      try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const companyName = themeConfig.tenantName || 'Mi Empresa';
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

        if (themeConfig.logo) {
          const logoBase64 = await getBase64Image(themeConfig.logo);
          if (logoBase64) {
            doc.addImage(logoBase64, 'PNG', (pageWidth - 30) / 2, currentY, 30, 30, undefined, 'FAST');
            currentY += 35;
          }
        }

        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(rgbPrimary[0] as any, rgbPrimary[1] as any, rgbPrimary[2] as any);
        doc.text(companyName, pageWidth / 2, currentY, { align: 'center' });
        currentY += 8;

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text('Reporte de Inventario', pageWidth / 2, currentY, { align: 'center' });
        currentY += 6;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text(`Generado: ${new Date().toLocaleDateString('es-NI')}  |  Moneda: ${displayCurrency}`, pageWidth / 2, currentY, { align: 'center' });
        currentY += 5;

        doc.setDrawColor(rgbPrimary[0] as any, rgbPrimary[1] as any, rgbPrimary[2] as any);
        doc.setLineWidth(0.8);
        doc.line(marginX, currentY, pageWidth - marginX, currentY);
        currentY += 10;

        const kpis = [
          { label: 'CAPITAL EN STOCK', value: formatConvertedAmount(totalValue, 'NIO'), detail: 'Valor total a precio de costo', color: [16, 185, 129] },
          { label: 'STOCK CRÍTICO', value: lowStock.length.toString(), detail: 'SKUs bajo mínimo', color: [244, 63, 94] },
          { label: 'INDICE DE ROTACIÓN', value: `${rotationRate}x`, detail: 'Velocidad media', color: [59, 130, 246] },
          { label: 'POTENCIAL DE VENTA', value: formatConvertedAmount(totalSaleValue, 'NIO'), detail: 'Retorno bruto estimado', color: [245, 158, 11] }
        ];

        const cols = 4;
        const boxW = (contentWidth - (cols - 1) * 4) / cols;
        const boxH = 22;
        checkPage(boxH + 5);
        kpis.forEach((kpi, idx) => {
          const x = marginX + idx * (boxW + 4);
          doc.setFillColor(kpi.color[0] as any, kpi.color[1] as any, kpi.color[2] as any);
          doc.roundedRect(x, currentY, boxW, boxH, 3, 3, 'F');
          doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
          doc.text(kpi.label, x + boxW / 2, currentY + 6, { align: 'center' });
          doc.setFontSize(12); doc.text(kpi.value, x + boxW / 2, currentY + 13, { align: 'center' });
          doc.setFontSize(7); doc.setFont('helvetica', 'normal');
          doc.text(kpi.detail, x + boxW / 2, currentY + 18.5, { align: 'center' });
        });
        currentY += boxH + 10;

        const capture = async (elementId: string, height: number) => {
          const el = document.getElementById(elementId);
          if (!el) return;
          checkPage(height + 15);
          try {
            const canvas = await html2canvas(el, {
              scale: 2,
              backgroundColor: '#ffffff',
              onclone: (clonedDoc) => sanitizeHtml2CanvasOklch([elementId], clonedDoc, primaryHex),
            });
            doc.addImage(canvas.toDataURL('image/png'), 'PNG', marginX, currentY, contentWidth, height, undefined, 'FAST');
            currentY += height + 5;
          } catch {}
        };

        await capture('inventory-dynamics-chart', 80);
        await capture('inventory-distribution-chart', 70);

        const renderTop = (title: string, data: any[], isValued: boolean) => {
          checkPage(40);
          doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 60);
          doc.text(title, marginX, currentY); currentY += 7;
          doc.setFillColor(isValued ? 16 : 59, isValued ? 185 : 130, isValued ? 129 : 246);
          doc.roundedRect(marginX, currentY, contentWidth, 8, 1, 1, 'F');
          doc.setFontSize(8); doc.setTextColor(255, 255, 255);
          doc.text('SKU', marginX + 3, currentY + 5.5);
          doc.text('Detalle', marginX + 80, currentY + 5.5);
          doc.text(isValued ? 'Valor Costo' : 'Rotación', marginX + 155, currentY + 5.5);
          currentY += 10;
          data.forEach((item, i) => {
            checkPage(12);
            if (i % 2 === 0) { doc.setFillColor(248, 249, 250); doc.rect(marginX, currentY - 1, contentWidth, 7, 'F'); }
            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
            doc.text(item.name.substring(0, 40), marginX + 3, currentY + 4);
            doc.text(isValued ? `${item.stock} unidades` : 'Despacho frecuente', marginX + 80, currentY + 4);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(isValued ? 16 : 59, isValued ? 185 : 130, isValued ? 129 : 246);
            doc.text(isValued ? formatConvertedAmount(Number(item.value), 'NIO') : `${item.qty} ud`, marginX + 155, currentY + 4);
            currentY += 7;
          });
          currentY += 10;
        };

        renderTop('Inversión por SKU (Mayor Valor)', topValued, true);
        renderTop('Artículos de Mayor Rotación', topRotated, false);

        doc.save(`Reporte_Inventario_${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success("PDF generado exitosamente");
      } catch (e: any) {
        toast.error(e?.response?.data?.message || e?.message || "Error exportando PDF");
      }
    },
    exportExcel: async () => {
      toast.info("Generando Excel (Inventario)...");
      try {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Inventario');
        const companyName = themeConfig.tenantName || 'Mi Empresa';
        const primaryColor = themeConfig.colors.primary || '#10b981';
        const hexColor = primaryColor.startsWith('#') ? primaryColor.replace('#', '') : '10b981';
        const primaryHex = primaryColor.startsWith('#') ? primaryColor : '#10b981';

        ws.getColumn(1).width = 30;
        ws.getColumn(2).width = 22;
        ws.getColumn(3).width = 22;
        ws.getColumn(4).width = 22;

        let currentRow = 1;

        if (themeConfig.logo) {
          const base64Logo = await getBase64Image(themeConfig.logo);
          if (base64Logo) {
            const logoId = wb.addImage({ base64: base64Logo, extension: 'png' });
            ws.addImage(logoId, { tl: { col: 1.5, row: 0 }, ext: { width: 100, height: 100 } });
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
        cTitle.value = 'Reporte de Inventario';
        cTitle.font = { size: 13, bold: true };
        cTitle.alignment = { horizontal: 'center' };
        currentRow++;

        ws.mergeCells(`A${currentRow}:D${currentRow}`);
        const cMeta = ws.getCell(`A${currentRow}`);
        cMeta.value = `Moneda: ${displayCurrency} (${currencySymbol})  |  ${new Date().toLocaleDateString('es-NI')}`;
        cMeta.font = { size: 10, italic: true, color: { argb: 'FF888888' } };
        cMeta.alignment = { horizontal: 'center' };
        currentRow += 2;

        const kpiBoxes = [
          { label: 'CAPITAL EN STOCK', value: formatConvertedAmount(totalValue, 'NIO'), detail: 'Valor total a precio de costo', bgColor: 'FF10B981' },
          { label: 'STOCK CRÍTICO', value: lowStock.length.toString(), detail: 'SKUs bajo mínimo', bgColor: 'FFF43F5E' },
          { label: 'INDICE DE ROTACIÓN', value: `${rotationRate}x`, detail: 'Velocidad media', bgColor: 'FF3B82F6' },
          { label: 'POTENCIAL DE VENTA', value: formatConvertedAmount(totalSaleValue, 'NIO'), detail: 'Retorno bruto estimado', bgColor: 'FFF59E0B' },
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

        const exportIds = ['inventory-dynamics-chart', 'inventory-distribution-chart'];
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
        imgRow = await captureForExcel('inventory-dynamics-chart', imgRow);
        imgRow = await captureForExcel('inventory-distribution-chart', imgRow);

        while (ws.rowCount < imgRow) ws.addRow([]);
        currentRow = ws.rowCount + 2;

        const thinBorder = { style: 'thin' as const, color: { argb: 'FFE5E7EB' } };

        // Top Valued
        const topValTitleRow = ws.addRow(['Inversión por SKU (Mayor Valor)', '', '', '']);
        ws.mergeCells(`A${ws.rowCount}:D${ws.rowCount}`);
        topValTitleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF10B981' } };
        topValTitleRow.getCell(1).alignment = { horizontal: 'center' };
        ws.addRow([]);

        const topValHeader = ws.addRow(['#', 'SKU', 'Detalle', 'Valor Costo']);
        topValHeader.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
        });

        topValued.forEach((item: any, idx) => {
          const r = ws.addRow([idx + 1, item.name, `${item.stock} unidades`, Number(item.value)]);
          r.getCell(1).alignment = { horizontal: 'center' };
          r.getCell(1).font = { bold: true, color: { argb: 'FF10B981' } };
          r.getCell(4).numFmt = `"${currencySymbol}" #,##0.00`;
          r.getCell(4).font = { bold: true, color: { argb: 'FF10B981' } };
          r.getCell(4).alignment = { horizontal: 'right' };
          r.eachCell((cell) => {
            cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
            if (idx % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
          });
        });

        ws.addRow([]); ws.addRow([]);

        // Top Rotated
        const topRotTitleRow = ws.addRow(['Artículos de Mayor Rotación', '', '', '']);
        ws.mergeCells(`A${ws.rowCount}:D${ws.rowCount}`);
        topRotTitleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF3B82F6' } };
        topRotTitleRow.getCell(1).alignment = { horizontal: 'center' };
        ws.addRow([]);

        const topRotHeader = ws.addRow(['#', 'SKU', 'Detalle', 'Rotación']);
        topRotHeader.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
        });

        topRotated.forEach((item: any, idx) => {
          const r = ws.addRow([idx + 1, item.name, 'Despacho frecuente', `${item.qty} ud`]);
          r.getCell(1).alignment = { horizontal: 'center' };
          r.getCell(1).font = { bold: true, color: { argb: 'FF3B82F6' } };
          r.getCell(4).font = { bold: true, color: { argb: 'FF3B82F6' } };
          r.getCell(4).alignment = { horizontal: 'right' };
          r.eachCell((cell) => {
            cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
            if (idx % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
          });
        });

        await downloadExcelWorkbook(wb, `Reporte_Inventario_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success("Excel exportado exitosamente");
      } catch (e: any) {
        toast.error(e?.response?.data?.message || e?.message || "Error exportando Excel");
      }
    }
  }));

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Activity className="size-12 animate-pulse text-primary opacity-50" />
        <p className="font-black uppercase tracking-widest text-[10px]">Valuando Existencias en Almacén...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* ═══ KPI Cards (Dashboard Style) ═══ */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Valor Total */}
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Warehouse className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <DollarSign className="size-3.5 text-emerald-500" /> Capital en Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-emerald-500">{formatConvertedAmount(totalValue, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Valor total a precio de costo</p>
          </CardContent>
        </Card>

        {/* Alertas de Stock */}
        <Card className="border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><AlertTriangle className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Package className="size-3.5 text-rose-500" /> Stock Crítico
              {lowStock.length > 0 && (
                <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-rose-500/10 text-rose-500 animate-pulse">
                  ALERTA
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-rose-500">{lowStock.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">SKUs bajo el mínimo establecido</p>
          </CardContent>
        </Card>

        {/* Rotación */}
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingDown className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="size-3.5 text-blue-500" /> Indice de Rotación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-blue-500">{rotationRate}x</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Velocidad media de desalojo</p>
          </CardContent>
        </Card>

        {/* Valor Proyectado */}
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Tag className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Scale className="size-3.5 text-amber-500" /> Potencial de Venta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-amber-500">{formatConvertedAmount(totalSaleValue, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Retorno bruto estimado</p>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Charts Row ═══ */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card id="inventory-dynamics-chart" className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <ArrowUpRight className="size-4 text-primary" /> Dinámica de Movimientos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} barGap={6}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtShort(v)} />
                  <Tooltip cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }} contentStyle={{ borderRadius: 10, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700, color: 'hsl(var(--foreground))' }} />
                  <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="salidas" name="Salidas" fill="#ef4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card id="inventory-distribution-chart" className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <ShoppingCart className="size-4 text-primary" /> Distribución de Valor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
             <div className="h-[200px] w-full">
                {categoryValueData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryValueData}
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryValueData.map((_, idx) => (
                        <Cell key={idx} fill={['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#94a3b8'][idx % 6]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} formatter={(v: number) => formatConvertedAmount(v, 'NIO')} />
                  </PieChart>
                </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-[10px] text-muted-foreground uppercase font-black tracking-widest">Sin información disponible</div>
                )}
             </div>
             <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-center gap-4">
                <div className="p-3 rounded-lg bg-indigo-500/10">
                   <Package className="size-5 text-indigo-500" />
                </div>
                <div>
                   <p className="text-xs font-bold text-indigo-500 uppercase">Resumen SKUs</p>
                   <p className="text-[10px] text-muted-foreground">{products.length} productos diferentes en catálogo</p>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Top Lists ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Valorados */}
        <Card className="border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="size-4 text-emerald-500" /> Inversión por SKU (Mayor Valor)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topValued.map((p: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 transition-colors gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="size-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-[10px] font-black text-emerald-600 shrink-0">
                    #{idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{p.stock} unidades en almacén</p>
                  </div>
                </div>
                <span className="text-sm font-black text-emerald-500 shrink-0">{formatConvertedAmount(p.value, 'NIO')}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top Rotación */}
        <Card className="border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <TrendingDown className="size-4 text-blue-500" /> Artículos de Mayor Rotación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topRotated.map((p: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-blue-500/5 border border-blue-500/10 hover:bg-blue-500/10 transition-colors gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="size-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-[10px] font-black text-blue-600 shrink-0">
                    #{idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">Despacho frecuente de inventario</p>
                  </div>
                </div>
                <span className="text-sm font-black text-blue-500 shrink-0">{p.qty} Unidades</span>
              </div>
            ))}
            {topRotated.length === 0 && <p className="text-xs text-muted-foreground text-center py-8 opacity-40 uppercase font-black tracking-widest leading-relaxed">Sin movimientos de salida<br/>detectados en el periodo</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
});
InventoryReportTab.displayName = 'InventoryReportTab';

