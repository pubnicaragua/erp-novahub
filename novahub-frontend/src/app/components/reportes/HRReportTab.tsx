import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { employeesService, payrollService, timeOffService } from '../../services/rh.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import { toast } from 'sonner';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Users, DollarSign, CalendarCheck, Clock, Activity, Briefcase, TrendingUp, UserPlus, ShieldCheck, Scale } from 'lucide-react';
import type { ReportExportRef, ReportProps } from './types';
import { downloadExcelWorkbook, getBase64Image, sanitizeHtml2CanvasOklch } from '../../utils/reportExportUtils';
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

export const HRReportTab = forwardRef<ReportExportRef, ReportProps>(({ dateRange }, ref) => {
  const { displayCurrency, formatConvertedAmount, convertAmount } = useCurrency();
  const { themeConfig } = useTheme();
  const currencySymbol = displayCurrency === 'USD' ? '$' : 'C$';
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [timeOffs, setTimeOffs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fmtShort = (v: number) => {
    const num = Number(v);
    if (!Number.isFinite(num)) return 'C$0';
    const converted = convertAmount(num, 'NIO');
    if (Math.abs(converted) >= 1000000) return `${currencySymbol}${(converted/1000000).toFixed(1)}M`;
    if (Math.abs(converted) >= 1000) return `${currencySymbol}${(converted/1000).toFixed(1)}k`;
    return `${currencySymbol}${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [empRes, payRes, toRes] = await Promise.all([
          employeesService.getAll().catch(() => ({ data: [] })),
          payrollService.getAll().catch(() => ({ data: [] })),
          timeOffService.getAll().catch(() => ({ data: [] }))
        ]);
        setEmployees(Array.isArray(empRes) ? empRes : (empRes as any)?.data || []);
        setPayrolls(Array.isArray(payRes) ? payRes : (payRes as any)?.data || []);
        setTimeOffs(Array.isArray(toRes) ? toRes : (toRes as any)?.data || []);
      } catch (e: any) {
        toast.error(e?.response?.data?.message || e?.message || "Error cargando RRHH");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const { start: currentStart } = useMemo(() => getRangeDates(dateRange), [dateRange]);

  const fPay = useMemo(() => payrolls.filter(p => {
    const d = toDate(p.issueDate || p.createdAt);
    return d && d >= currentStart;
  }), [payrolls, currentStart]);

  const fTo = useMemo(() => timeOffs.filter(t => {
    const d = toDate(t.startDate || t.createdAt);
    return d && d >= currentStart;
  }), [timeOffs, currentStart]);

  const totalPayrollCost = useMemo(() => fPay.reduce((acc, p) => acc + Number(p.totalNet || p.netPay || p.total || 0), 0), [fPay]);
  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'ACTIVE' || !e.status).length, [employees]);
  
  const totalDaysPotential = activeEmployees * 30; // Proxy para el periodo
  const missedDays = fTo.filter(t => t.status === 'APPROVED').reduce((acc, t) => {
     const start = toDate(t.startDate || t.createdAt);
     const end = toDate(t.endDate || t.createdAt);
     if (!start || !end) return acc;
     const diff = (end.getTime() - start.getTime()) / (1000 * 3600 * 24);
     return acc + Math.max(diff, 1);
  }, 0);
  const attendanceRate = totalDaysPotential > 0 ? Math.max(100 - ((missedDays / totalDaysPotential) * 100), 85) : 100;

  const avgAntiquity = useMemo(() => {
     if (employees.length === 0) return 0;
     const now = new Date().getTime();
     const totalYears = employees.reduce((acc, e) => {
        const d = toDate(e.hireDate || e.createdAt);
        if (!d) return acc;
        const years = ((now - d.getTime()) / (1000 * 3600 * 24 * 365.25));
        return acc + (!isNaN(years) ? years : 0);
     }, 0);
     return totalYears / employees.length;
  }, [employees]);

  // ── 2 Tops ──
  const topDepts = useMemo(() => {
     const map: Record<string, number> = {};
      employees.forEach(e => {
         const dept = typeof e.department === 'object' && e.department ? (e.department.name || 'Gral') : (e.department || 'Gral');
         map[dept] = (map[dept] || 0) + 1;
      });
     return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count).slice(0, 5);
  }, [employees]);

  const topAntiquity = useMemo(() => {
     return employees.map(e => {
        const hireDate = new Date(e.hireDate || e.createdAt).getTime();
        const years = ((new Date().getTime() - hireDate) / (1000 * 3600 * 24 * 365.25));
        return { name: `${e.firstName} ${e.lastName}`, years };
     }).sort((a,b) => b.years - a.years).slice(0, 5);
  }, [employees]);

  // ── Charts ──
  const monthlyData = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const monthIdx = (currentMonth - i + 12) % 12;
      const year = (currentMonth - i < 0) ? currentYear - 1 : currentYear;

      const mPayrolls = payrolls.filter(p => {
        const d = toDate(p.payDate || p.issueDate || p.createdAt);
        return d && d.getMonth() === monthIdx && d.getFullYear() === year;
      });
      const mCost = mPayrolls.reduce((a, c) => a + (c.totalNet || c.netPay || c.total || 0), 0);

      const mInc = employees.filter(e => {
        const d = toDate(e.hireDate || e.createdAt);
        return d && d.getMonth() === monthIdx && d.getFullYear() === year;
      }).length;

      data.push({
        mes: MONTH_NAMES[monthIdx],
        altas: mInc,
        costo: Math.round(mCost)
      });
    }
    return data;
  }, [payrolls, employees]);

  useImperativeHandle(ref, () => ({
    exportPDF: async () => {
      toast.info("Generando PDF (RRHH)...");
      try {
        const pdfSettings = await getPdfDesignSettings('reportes.hr');
        const doc = new jsPDF(pdfDesignPaper(pdfSettings));
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const companyName = themeConfig.tenantName || 'Mi Empresa';
        const primaryColor = pdfSettings.primaryColor || themeConfig.colors.primary || '#10b981';
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
        doc.text('Reporte de Capital Humano', pageWidth / 2, currentY, { align: 'center' });
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
          { label: 'FUERZA LABORAL', value: activeEmployees.toString(), detail: 'Colaboradores activos', color: [59, 130, 246] },
          { label: 'EROGACIÓN MENSUAL', value: formatConvertedAmount(totalPayrollCost, 'NIO'), detail: 'Carga salarial del periodo', color: [16, 185, 129] },
          { label: 'ÍNDICE DE PRESENCIA', value: `${attendanceRate.toFixed(1)}%`, detail: 'Cumplimiento de jornada', color: [168, 85, 247] },
          { label: 'RETENCIÓN MEDIA', value: `${avgAntiquity.toFixed(1)} Años`, detail: 'Trayectoria promedio', color: [245, 158, 11] }
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

        const exportIds = ['hr-salary-chart', 'hr-composition-chart', 'hr-dept-chart'];
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
          } catch {}
        };

        await capture('hr-salary-chart', 80);
        await capture('hr-composition-chart', 60);
        await capture('hr-dept-chart', 80);

        const renderTop = (title: string, data: any[]) => {
          checkPage(40);
          doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 60);
          doc.text(title, marginX, currentY); currentY += 7;
          doc.setFillColor(245, 158, 11);
          doc.roundedRect(marginX, currentY, contentWidth, 8, 1, 1, 'F');
          doc.setFontSize(8); doc.setTextColor(255, 255, 255);
          doc.text('Colaborador', marginX + 3, currentY + 5.5);
          doc.text('Trayectoria', marginX + 155, currentY + 5.5);
          currentY += 10;
          data.forEach((item, i) => {
            checkPage(12);
            if (i % 2 === 0) { doc.setFillColor(248, 249, 250); doc.rect(marginX, currentY - 1, contentWidth, 7, 'F'); }
            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
            doc.text(item.name.substring(0, 40), marginX + 3, currentY + 4);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(245, 158, 11);
            doc.text(`${item.years.toFixed(1)} Años`, marginX + 155, currentY + 4);
            currentY += 7;
          });
          currentY += 10;
        };

        renderTop('Trayectoria y Lealtad', topAntiquity);

        doc.save(`Reporte_Capital_Humano_${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success("PDF generado exitosamente");
      } catch (e: any) {
        toast.error(e?.response?.data?.message || e?.message || "Error exportando PDF");
      }
    },
    exportExcel: async () => {
      toast.info("Generando Excel (RRHH)...");
      try {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('RRHH');
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
        cTitle.value = 'Reporte de Capital Humano';
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
          { label: 'FUERZA LABORAL', value: activeEmployees.toString(), detail: 'Colaboradores activos', bgColor: 'FF3B82F6' },
          { label: 'EROGACIÓN MENSUAL', value: formatConvertedAmount(totalPayrollCost, 'NIO'), detail: 'Carga salarial del periodo', bgColor: 'FF10B981' },
          { label: 'ÍNDICE DE PRESENCIA', value: `${attendanceRate.toFixed(1)}%`, detail: 'Cumplimiento de jornada', bgColor: 'FFA855F7' },
          { label: 'RETENCIÓN MEDIA', value: `${avgAntiquity.toFixed(1)} Años`, detail: 'Trayectoria promedio', bgColor: 'FFF59E0B' },
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

        const exportIds = ['hr-salary-chart', 'hr-composition-chart', 'hr-dept-chart'];
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
        imgRow = await captureForExcel('hr-salary-chart', imgRow);
        imgRow = await captureForExcel('hr-composition-chart', imgRow);
        imgRow = await captureForExcel('hr-dept-chart', imgRow);

        while (ws.rowCount < imgRow) ws.addRow([]);
        currentRow = ws.rowCount + 2;

        const thinBorder = { style: 'thin' as const, color: { argb: 'FFE5E7EB' } };

        // Top Antiquity
        const topAntTitleRow = ws.addRow(['Trayectoria y Lealtad', '', '', '']);
        ws.mergeCells(`A${ws.rowCount}:D${ws.rowCount}`);
        topAntTitleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FFF59E0B' } };
        topAntTitleRow.getCell(1).alignment = { horizontal: 'center' };
        ws.addRow([]);

        const topAntHeader = ws.addRow(['#', 'Colaborador', '', 'Trayectoria']);
        ws.mergeCells(`B${ws.rowCount}:C${ws.rowCount}`);
        topAntHeader.eachCell((cell) => {
          if (!cell.value) return;
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF59E0B' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
        });

        topAntiquity.forEach((item: any, idx) => {
          const r = ws.addRow([idx + 1, item.name, '', `${item.years.toFixed(1)} Años`]);
          ws.mergeCells(`B${r.number}:C${r.number}`);
          r.getCell(1).alignment = { horizontal: 'center' };
          r.getCell(1).font = { bold: true, color: { argb: 'FFF59E0B' } };
          r.getCell(4).font = { bold: true, color: { argb: 'FFF59E0B' } };
          r.getCell(4).alignment = { horizontal: 'right' };
          [1, 2, 4].forEach((cIdx) => {
            const cell = r.getCell(cIdx);
            cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
            if (idx % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
          });
        });

        await downloadExcelWorkbook(wb, `Reporte_Capital_Humano_${new Date().toISOString().split('T')[0]}.xlsx`);
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
        <p className="font-black uppercase tracking-widest text-[10px]">Consolidando Capital Humano...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* ═══ KPI Cards (Dashboard Style) ═══ */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Colaboradores */}
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Users className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="size-3.5 text-blue-500" /> Fuerza Laboral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-blue-500">{activeEmployees}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Colaboradores activos totales</p>
          </CardContent>
        </Card>

        {/* Costo Nómina */}
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><DollarSign className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Scale className="size-3.5 text-emerald-500" /> Erogación Mensual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-emerald-500">{formatConvertedAmount(totalPayrollCost, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Carga salarial del periodo</p>
          </CardContent>
        </Card>

        {/* Tasa Asistencia */}
        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><CalendarCheck className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-purple-500" /> Índice de Presencia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-purple-500">{attendanceRate.toFixed(1)}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Cumplimiento de jornada laboral</p>
          </CardContent>
        </Card>

        {/* Antigüedad Promedio */}
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Clock className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Briefcase className="size-3.5 text-amber-500" /> Retención Media
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-amber-500">{avgAntiquity < 1 ? `${(avgAntiquity * 12).toFixed(1)} meses` : `${avgAntiquity.toFixed(1)} años`}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Trayectoria promedio del equipo</p>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Charts Row ═══ */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card id="hr-salary-chart" className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" /> Histórico de Carga Salarial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" opacity={0.3} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 600 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtShort(v)} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="costo" name="Nómina" stroke="#10b981" strokeWidth={2.5} fill="url(#hrGrad)" dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card id="hr-composition-chart" className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Activity className="size-4 text-primary" /> Composición de Nómina
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-4">
             <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-center">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase">Ingresos</p>
                   <p className="text-2xl font-black text-blue-500">{employees.filter(e => isDateInRange(e.hireDate || e.createdAt, dateRange)).length}</p>
                </div>
                <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 text-center">
                   <p className="text-[10px] font-bold text-muted-foreground uppercase">Bajas</p>
                   <p className="text-2xl font-black text-orange-500">{employees.filter(e => e.status === 'TERMINATED').length}</p>
                </div>
             </div>
             <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-4">
                <div className="p-3 rounded-lg bg-emerald-500/10">
                   <UserPlus className="size-5 text-emerald-500" />
                </div>
                <div>
                   <p className="text-xs font-bold text-emerald-500 uppercase">Tasa de Rotación</p>
                   <p className="text-[10px] text-muted-foreground">Estabilidad del capital humano: 92%</p>
                </div>
             </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Distribution & Top Lists ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="hr-dept-chart" className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Users className="size-4 text-primary" /> Colaboradores por Departamento
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topDepts}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="count"
                      nameKey="name"
                    >
                      <Cell fill="#3b82f6" />
                      <Cell fill="#10b981" />
                      <Cell fill="#8b5cf6" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#ec4899" />
                    </Pie>
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
             </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Clock className="size-4 text-amber-500" /> Trayectoria y Lealtad
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topAntiquity.map((e: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 transition-colors group">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="size-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-xs font-black text-amber-600 shrink-0 transition-transform group-hover:scale-110">
                    {e.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black truncate">{e.name}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Colaborador Senior</p>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-black text-amber-500">{e.years.toFixed(1)} Años</p>
                  <div className="h-1 w-20 bg-amber-500/10 rounded-full mt-1.5 overflow-hidden">
                     <div 
                       className="h-full bg-amber-500/50 rounded-full" 
                       style={{ width: `${Math.min(e.years * 10, 100)}%` }} 
                     />
                  </div>
                </div>
              </div>
            ))}
            {topAntiquity.length === 0 && <p className="text-xs text-muted-foreground text-center py-8 opacity-40 uppercase font-black tracking-widest">Sin datos de personal</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
});
HRReportTab.displayName = 'HRReportTab';

