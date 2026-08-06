import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  ArrowUpRight, ArrowDownRight, Scale, TrendingUp, TrendingDown,
  CalendarClock, Filter, BarChart3, Wallet, PieChart as PieChartIcon, Activity, X,
  Download, FileSpreadsheet, FileText
} from 'lucide-react';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { cn } from '../ui/utils';
import { toast } from 'sonner';
import { getPdfDesignSettings, pdfDesignPaper } from '../../utils/pdfGenerator';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from 'recharts';
import { FINANCE_AXIS_TICK, FINANCE_GRID, FINANCE_TOOLTIP_WRAPPER, FinanceTooltipCard } from './financeChartTheme';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';

interface FinanceBalanceViewProps {
  incomes: any[];
  expenses: any[];
  recurringIncomes: any[];
  recurringExpenses: any[];
}

type ViewType = 'general' | 'solo-ingresos' | 'solo-gastos' | 'recurrentes';

export function FinanceBalanceView({ incomes, expenses, recurringIncomes, recurringExpenses }: FinanceBalanceViewProps) {
  const { displayCurrency, valuationMode, valuationModeSuffix, formatCurrentAmount, convertAmount, convertCurrentAmount } = useCurrency();
  const { user } = useAuth();
  const { themeConfig } = useTheme();
  const sym = displayCurrency === 'USD' ? '$' : 'C$';

  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [viewType, setViewType] = useState<ViewType>('general');

  const filterByDate = (items: any[]) => {
    if (!dateRange.start && !dateRange.end) return items;
    return items.filter(item => {
      const d = new Date(item.date || item.startDate || item.createdAt).getTime();
      if (dateRange.start && d < new Date(dateRange.start).getTime()) return false;
      if (dateRange.end) { const e = new Date(dateRange.end); e.setHours(23,59,59,999); if (d > e.getTime()) return false; }
      return true;
    });
  };

  const fIncomes = useMemo(() => filterByDate(incomes), [incomes, dateRange]);
  const fExpenses = useMemo(() => filterByDate(expenses), [expenses, dateRange]);
  const fRecInc = useMemo(() => filterByDate(recurringIncomes), [recurringIncomes, dateRange]);
  const fRecExp = useMemo(() => filterByDate(recurringExpenses), [recurringExpenses, dateRange]);

  const cv = (item: any) => {
    const amount = Number(item.amount ?? item.baseAmount ?? 0);
    return valuationMode === 'CURRENT'
      ? convertCurrentAmount(amount, item.currency)
      : convertAmount(amount, item.currency, item.exchangeRate);
  };

  const totalIncome = fIncomes.reduce((a: number, i: any) => a + cv(i), 0);
  const totalExpense = fExpenses.reduce((a: number, e: any) => a + cv(e), 0);
  const balance = totalIncome - totalExpense;
  const margin = totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(1) : '0.0';

  const recIncActive = fRecInc.filter((r: any) => (r.status || '').toUpperCase() === 'ACTIVE');
  const recExpActive = fRecExp.filter((r: any) => (r.status || '').toUpperCase() === 'ACTIVE');
  const totalRecInc = recIncActive.reduce((a: number, r: any) => a + cv(r), 0);
  const totalRecExp = recExpActive.reduce((a: number, r: any) => a + cv(r), 0);

  // ─── Determine what to show based on viewType ──────
  const showIncomeKPIs = viewType === 'general' || viewType === 'solo-ingresos';
  const showExpenseKPIs = viewType === 'general' || viewType === 'solo-gastos';
  const showRecurring = viewType === 'general' || viewType === 'recurrentes';
  const showBalanceKPI = viewType === 'general';

  // ─── Monthly chart data ────────────────────────────
  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; ingresos: number; gastos: number }> = {};
    if (showIncomeKPIs) {
      fIncomes.forEach((i: any) => {
        const d = new Date(i.date || i.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const label = d.toLocaleDateString('es', { month: 'short', year: '2-digit' });
        if (!months[key]) months[key] = { month: label, ingresos: 0, gastos: 0 };
        months[key].ingresos += cv(i);
      });
    }
    if (showExpenseKPIs) {
      fExpenses.forEach((e: any) => {
        const d = new Date(e.date || e.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const label = d.toLocaleDateString('es', { month: 'short', year: '2-digit' });
        if (!months[key]) months[key] = { month: label, ingresos: 0, gastos: 0 };
        months[key].gastos += cv(e);
      });
    }
    if (viewType === 'recurrentes') {
      fRecInc.forEach((r: any) => {
        const d = new Date(r.startDate || r.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const label = d.toLocaleDateString('es', { month: 'short', year: '2-digit' });
        if (!months[key]) months[key] = { month: label, ingresos: 0, gastos: 0 };
        months[key].ingresos += cv(r);
      });
      fRecExp.forEach((r: any) => {
        const d = new Date(r.startDate || r.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        const label = d.toLocaleDateString('es', { month: 'short', year: '2-digit' });
        if (!months[key]) months[key] = { month: label, ingresos: 0, gastos: 0 };
        months[key].gastos += cv(r);
      });
    }
    return Object.entries(months).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v);
  }, [fIncomes, fExpenses, fRecInc, fRecExp, viewType]);

  // ─── Category chart ────────────────────────────────
  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    let source: any[] = [];
    if (viewType === 'solo-ingresos') source = fIncomes;
    else if (viewType === 'solo-gastos') source = fExpenses;
    else if (viewType === 'recurrentes') source = [...fRecInc, ...fRecExp];
    else source = [...fIncomes, ...fExpenses];
    source.forEach((item: any) => {
      const cat = item.category || 'Sin Categoría';
      cats[cat] = (cats[cat] || 0) + cv(item);
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [fIncomes, fExpenses, fRecInc, fRecExp, viewType]);

  const COLORS = ['#10b981','#f59e0b','#6366f1','#ec4899','#14b8a6','#8b5cf6','#ef4444','#3b82f6'];

  // ─── Last 5 items ──────────────────────────────────
  const lastIncomes = useMemo(() => [...fIncomes].sort((a,b) => new Date(b.date||b.createdAt).getTime() - new Date(a.date||a.createdAt).getTime()).slice(0,5), [fIncomes]);
  const lastExpenses = useMemo(() => [...fExpenses].sort((a,b) => new Date(b.date||b.createdAt).getTime() - new Date(a.date||a.createdAt).getTime()).slice(0,5), [fExpenses]);

  const viewButtons: { value: ViewType; label: string }[] = [
    { value: 'general', label: 'General' },
    { value: 'solo-ingresos', label: 'Solo Ingresos' },
    { value: 'solo-gastos', label: 'Solo Gastos' },
    { value: 'recurrentes', label: 'Recurrentes' },
  ];

  const getBase64Image = async (url: string) => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e: any) {
      return null;
    }
  };

  const sanitizeHtml2CanvasOklch = (_elementId: string, clonedDoc: Document, primaryHex: string) => {
    // 1) Inject a global style that overrides ALL CSS custom properties with safe hex values
    const styleTag = clonedDoc.createElement('style');
    styleTag.innerHTML = `
      :root, *, *::before, *::after {
        --background: #ffffff !important;
        --foreground: #333333 !important;
        --card: #ffffff !important;
        --card-foreground: #333333 !important;
        --popover: #ffffff !important;
        --popover-foreground: #333333 !important;
        --primary: ${primaryHex} !important;
        --primary-foreground: #ffffff !important;
        --secondary: #f3f4f6 !important;
        --secondary-foreground: #333333 !important;
        --muted: #f3f4f6 !important;
        --muted-foreground: #6b7280 !important;
        --accent: #f3f4f6 !important;
        --accent-foreground: #333333 !important;
        --destructive: #ef4444 !important;
        --destructive-foreground: #ffffff !important;
        --border: #e5e7eb !important;
        --input: #e5e7eb !important;
        --ring: ${primaryHex} !important;
        --chart-1: #10b981 !important;
        --chart-2: #ef4444 !important;
        --chart-3: #6366f1 !important;
        --chart-4: #f59e0b !important;
        --chart-5: #ec4899 !important;
        --sidebar-background: #ffffff !important;
        --sidebar-foreground: #333333 !important;
        --sidebar-primary: ${primaryHex} !important;
        --sidebar-primary-foreground: #ffffff !important;
        --sidebar-accent: #f3f4f6 !important;
        --sidebar-accent-foreground: #333333 !important;
        --sidebar-border: #e5e7eb !important;
        --sidebar-ring: ${primaryHex} !important;
      }
    `;
    clonedDoc.head.appendChild(styleTag);

    const hasUnsupported = (s: string | null | undefined) => s ? /oklch|oklab|color\(|lch\(|lab\(/i.test(s) : false;

    // 2) Walk each export container and fix all child elements
    const walkAndFix = (origRoot: Element | null, clonedRoot: Element | null) => {
      if (!origRoot || !clonedRoot) return;
      const origList = [origRoot, ...Array.from(origRoot.querySelectorAll('*'))];
      const clonedList = [clonedRoot, ...Array.from(clonedRoot.querySelectorAll('*'))];

      for (let i = 0; i < Math.min(origList.length, clonedList.length); i++) {
        const origEl = origList[i] as HTMLElement;
        const cloneEl = clonedList[i] as HTMLElement;
        if (!origEl || !cloneEl) continue;

        try {
          const comp = window.getComputedStyle(origEl);

          // Determine safe color based on classes
          let safeColor = '#333333';
          const cls = origEl.className?.toString?.() || '';
          if (cls.includes('text-primary')) safeColor = primaryHex;
          else if (cls.includes('text-emerald')) safeColor = '#10b981';
          else if (cls.includes('text-rose')) safeColor = '#f43f5e';
          else if (cls.includes('text-purple')) safeColor = '#a855f7';
          else if (cls.includes('text-green')) safeColor = '#22c55e';
          else if (cls.includes('text-red')) safeColor = '#ef4444';

          // Fix color
          if (hasUnsupported(comp.color)) {
            cloneEl.style.setProperty('color', safeColor, 'important');
          }
          // Fix background-color
          if (hasUnsupported(comp.backgroundColor)) {
            let bg = 'transparent';
            if (cls.includes('bg-primary')) bg = primaryHex;
            else if (cls.includes('bg-emerald')) bg = '#10b981';
            else if (cls.includes('bg-rose')) bg = '#f43f5e';
            else if (cls.includes('bg-muted')) bg = '#f3f4f6';
            else if (cls.includes('bg-card') || cls.includes('bg-background')) bg = '#ffffff';
            else if (cls.includes('bg-secondary') || cls.includes('bg-accent')) bg = '#f3f4f6';
            cloneEl.style.setProperty('background-color', bg, 'important');
          }
          // Fix border-color
          if (hasUnsupported(comp.borderColor)) {
            cloneEl.style.setProperty('border-color', '#e5e7eb', 'important');
          }
          // Fix outline-color
          if (hasUnsupported(comp.outlineColor)) {
            cloneEl.style.setProperty('outline-color', '#e5e7eb', 'important');
          }
          // Fix background-image (gradients can contain oklch)
          if (hasUnsupported(comp.backgroundImage)) {
            cloneEl.style.setProperty('background-image', 'none', 'important');
          }
          // Fix box-shadow / text-shadow
          if (hasUnsupported(comp.boxShadow)) {
            cloneEl.style.setProperty('box-shadow', 'none', 'important');
          }
          if (hasUnsupported((comp as any).textDecorationColor)) {
            cloneEl.style.setProperty('text-decoration-color', safeColor, 'important');
          }

          // Fix SVG attributes
          const tagName = cloneEl.tagName?.toLowerCase?.() || '';
          if (tagName === 'svg' || cloneEl.closest?.('svg') || ['path','rect','circle','line','polygon','polyline','g','text','tspan'].includes(tagName)) {
            const fill = cloneEl.getAttribute('fill');
            const stroke = cloneEl.getAttribute('stroke');
            const stopColor = cloneEl.getAttribute('stop-color');

            if (fill && (hasUnsupported(fill) || fill.includes('var('))) {
              // Try to determine a sensible fill
              if (cls.includes('recharts-bar-rectangle') || cls.includes('recharts-pie-sector')) {
                // Keep the explicit fill from <Cell> or <Bar> - it should already be a hex
              } else {
                cloneEl.setAttribute('fill', '#9ca3af');
              }
            }
            if (stroke && (hasUnsupported(stroke) || stroke.includes('var('))) {
              cloneEl.setAttribute('stroke', '#e5e7eb');
            }
            if (stopColor && (hasUnsupported(stopColor) || stopColor.includes('var('))) {
              cloneEl.setAttribute('stop-color', primaryHex);
            }
          }

          // Fix any inline style values that might contain oklch
          if (cloneEl.style) {
            for (let j = 0; j < cloneEl.style.length; j++) {
              const prop = cloneEl.style[j];
              const val = cloneEl.style.getPropertyValue(prop);
              if (hasUnsupported(val)) {
                if (prop.includes('color') || prop === 'fill' || prop === 'stroke') {
                  cloneEl.style.setProperty(prop, safeColor, 'important');
                } else if (prop.includes('background')) {
                  cloneEl.style.setProperty(prop, '#ffffff', 'important');
                } else if (prop.includes('border') || prop.includes('outline')) {
                  cloneEl.style.setProperty(prop, '#e5e7eb', 'important');
                } else if (prop.includes('shadow')) {
                  cloneEl.style.setProperty(prop, 'none', 'important');
                }
              }
            }
          }
        } catch (e: any) {
          // ignore errors on individual elements
        }
      }
    };

    // Fix all three export containers
    ['balance-kpis', 'balance-monthly-chart', 'balance-category-chart'].forEach(id => {
      walkAndFix(document.getElementById(id), clonedDoc.getElementById(id));
    });

    // Also do a broader pass on the entire body for any stray oklch in stylesheets
    try {
      const sheets = clonedDoc.styleSheets;
      for (let s = 0; s < sheets.length; s++) {
        try {
          const rules = sheets[s].cssRules;
          for (let r = 0; r < rules.length; r++) {
            const rule = rules[r] as CSSStyleRule;
            if (rule.cssText && hasUnsupported(rule.cssText)) {
              // Replace oklch values in the rule with fallback
              const newCss = rule.cssText.replace(/oklch\([^)]*\)/gi, '#9ca3af');
              try {
                sheets[s].deleteRule(r);
                sheets[s].insertRule(newCss, r);
              } catch (e2) {
                // Some rules can't be modified, skip
              }
            }
          }
        } catch (e: any) {
          // Cross-origin stylesheets will throw, skip them
        }
      }
    } catch (e: any) {
      // ignore stylesheet errors
    }
  };

  const fmtNum = (n: number) => formatCurrentAmount(n, displayCurrency);

  const exportPDF = async () => {
    try {
      toast.info("Generando PDF, por favor espere...");
      const pdfSettings = await getPdfDesignSettings('finanzas.balance');
      const doc = new jsPDF(pdfDesignPaper(pdfSettings));
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const companyName = (themeConfig.tenantName || user?.tenantName || 'Mi Empresa').toUpperCase();
      const logoUrl = themeConfig.logo || '';
      const primaryColor = themeConfig.colors.primary || '#10b981';
      const rgbPrimary = primaryColor.startsWith('#') 
        ? [parseInt(primaryColor.slice(1,3), 16), parseInt(primaryColor.slice(3,5), 16), parseInt(primaryColor.slice(5,7), 16)]
        : [16, 185, 129];
      const primaryHex = primaryColor.startsWith('#') ? primaryColor : '#10b981';
      const marginX = 14;
      const contentWidth = pageWidth - marginX * 2;

      const checkPage = (needed: number) => {
        if (currentY + needed > pageHeight - 15) { doc.addPage(); currentY = 20; }
      };
      
      let currentY = 15;
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
      doc.text(`Balance General - ${viewType.toUpperCase()}`, pageWidth / 2, currentY, { align: 'center' });
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

      // ── KPIs as native text boxes (ALWAYS show ALL metrics) ──
      const kpis: { label: string; value: string; detail: string; color: number[] }[] = [
        { label: 'Total Ingresos', value: fmtNum(totalIncome), detail: `${fIncomes.length} registros`, color: [16, 185, 129] },
        { label: 'Total Gastos', value: fmtNum(totalExpense), detail: `${fExpenses.length} registros`, color: [244, 63, 94] },
        { label: 'Balance Neto', value: fmtNum(balance), detail: `Margen: ${margin}%`, color: balance >= 0 ? [16, 185, 129] : [244, 63, 94] },
        { label: 'Recurrentes Activos', value: `+${fmtNum(totalRecInc)} / -${fmtNum(totalRecExp)}`, detail: `${recIncActive.length} ing. · ${recExpActive.length} gto.`, color: [168, 85, 247] },
      ];

      // First row of KPI boxes (4 boxes)
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
        doc.text(kpi.label.toUpperCase(), x + boxW / 2, currentY + 6, { align: 'center' });
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(kpi.value, x + boxW / 2, currentY + 13, { align: 'center' });
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(255, 255, 255);
        doc.text(kpi.detail, x + boxW / 2, currentY + 18.5, { align: 'center' });
      });
      currentY += boxH + 5;



      // ── Monthly Chart as image ──
      const chartEl1 = document.getElementById('balance-monthly-chart');
      if (chartEl1) {
        checkPage(95);
        try {
          const canvas = await html2canvas(chartEl1, { scale: 2, backgroundColor: '#ffffff', onclone: (clonedDoc) => sanitizeHtml2CanvasOklch('balance-monthly-chart', clonedDoc, primaryHex) });
          const imgData = canvas.toDataURL('image/png');
          doc.addImage(imgData, 'PNG', marginX, currentY, contentWidth, 80, undefined, 'FAST');
          currentY += 85;
        } catch(imgErr) {
          console.warn('Chart image failed, using table only', imgErr);
        }
      }

      // ── Category Chart as image ──
      const chartEl2 = document.getElementById('balance-category-chart');
      if (chartEl2) {
        checkPage(95);
        try {
          const canvas = await html2canvas(chartEl2, { scale: 2, backgroundColor: '#ffffff', onclone: (clonedDoc) => sanitizeHtml2CanvasOklch('balance-category-chart', clonedDoc, primaryHex) });
          const imgData = canvas.toDataURL('image/png');
          doc.addImage(imgData, 'PNG', marginX, currentY, contentWidth, 80, undefined, 'FAST');
          currentY += 85;
        } catch (imgErr) {
          console.warn('Chart image failed, using table only', imgErr);
        }
      }

      // ── Category data table ──
      if (categoryData.length > 0) {
        checkPage(30);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text('Distribución por Categoría', marginX, currentY);
        currentY += 6;

        const catTotal = categoryData.reduce((a, c) => a + c.value, 0);
        doc.setFillColor(rgbPrimary[0], rgbPrimary[1], rgbPrimary[2]);
        doc.roundedRect(marginX, currentY, contentWidth, 8, 1, 1, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('Categoría', marginX + 3, currentY + 5.5);
        doc.text('Monto', marginX + 90, currentY + 5.5);
        doc.text('% del Total', marginX + 140, currentY + 5.5);
        currentY += 10;

        categoryData.sort((a, b) => b.value - a.value).forEach((cat, i) => {
          checkPage(8);
          if (i % 2 === 0) {
            doc.setFillColor(248, 249, 250);
            doc.rect(marginX, currentY - 1, contentWidth, 7, 'F');
          }
          const dotColor = COLORS[i % COLORS.length];
          doc.setFillColor(parseInt(dotColor.slice(1,3),16), parseInt(dotColor.slice(3,5),16), parseInt(dotColor.slice(5,7),16));
          doc.circle(marginX + 5, currentY + 3, 2, 'F');
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(60, 60, 60);
          doc.text(cat.name, marginX + 10, currentY + 4.5);
          doc.setFont('helvetica', 'bold');
          doc.text(fmtNum(cat.value), marginX + 90, currentY + 4.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(120, 120, 120);
          doc.text(`${catTotal > 0 ? ((cat.value / catTotal) * 100).toFixed(1) : '0'}%`, marginX + 140, currentY + 4.5);
          currentY += 7;
        });
        currentY += 5;
      }

      // ── Salud Financiera ──
      checkPage(30);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text('Salud Financiera', marginX, currentY);
      currentY += 7;

      const totalFlow = totalIncome + totalExpense;
      const incPct = totalFlow > 0 ? ((totalIncome / totalFlow) * 100).toFixed(1) : '50.0';
      const expPct = totalFlow > 0 ? ((totalExpense / totalFlow) * 100).toFixed(1) : '50.0';
      const barWidth = contentWidth;
      const barHeight = 6;
      const incBarW = totalFlow > 0 ? (totalIncome / totalFlow) * barWidth : barWidth / 2;
      doc.setFillColor(16, 185, 129);
      doc.roundedRect(marginX, currentY, incBarW, barHeight, 2, 2, 'F');
      doc.setFillColor(239, 68, 68);
      doc.roundedRect(marginX + incBarW, currentY, barWidth - incBarW, barHeight, 2, 2, 'F');
      currentY += barHeight + 4;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129);
      doc.text(`Ingresos: ${incPct}%`, marginX, currentY + 3);
      doc.setTextColor(239, 68, 68);
      doc.text(`Gastos: ${expPct}%`, marginX + contentWidth - 30, currentY + 3);
      currentY += 10;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(`Ingresos Recurrentes: ${recIncActive.length} fuentes · ${fmtNum(totalRecInc)}/ciclo`, marginX, currentY + 3);
      currentY += 6;
      doc.text(`Gastos Recurrentes: ${recExpActive.length} compromisos · ${fmtNum(totalRecExp)}/ciclo`, marginX, currentY + 3);
      currentY += 12;

      // ── Monthly data table (AL FINAL) ──
      if (monthlyData.length > 0) {
        checkPage(30);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text('Detalle Mensual', marginX, currentY);
        currentY += 6;

        const colWidths = [50, 45, 45, 42];
        const tableX = marginX;
        doc.setFillColor(rgbPrimary[0], rgbPrimary[1], rgbPrimary[2]);
        doc.roundedRect(tableX, currentY, contentWidth, 8, 1, 1, 'F');
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        let cx = tableX + 3;
        doc.text('Mes', cx, currentY + 5.5); cx += colWidths[0];
        doc.text('Ingresos', cx, currentY + 5.5); cx += colWidths[1];
        doc.text('Gastos', cx, currentY + 5.5); cx += colWidths[2];
        doc.text('Balance', cx, currentY + 5.5);
        currentY += 10;

        monthlyData.forEach((row, i) => {
          checkPage(8);
          if (i % 2 === 0) {
            doc.setFillColor(248, 249, 250);
            doc.rect(tableX, currentY - 1, contentWidth, 7, 'F');
          }
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          let rx = tableX + 3;
          doc.setTextColor(60, 60, 60);
          doc.text(row.month, rx, currentY + 4); rx += colWidths[0];
          doc.setTextColor(16, 185, 129);
          doc.text(fmtNum(row.ingresos), rx, currentY + 4); rx += colWidths[1];
          doc.setTextColor(239, 68, 68);
          doc.text(fmtNum(row.gastos), rx, currentY + 4); rx += colWidths[2];
          const rowBal = row.ingresos - row.gastos;
          doc.setTextColor(rowBal >= 0 ? 16 : 239, rowBal >= 0 ? 185 : 68, rowBal >= 0 ? 129 : 68);
          doc.text(fmtNum(rowBal), rx, currentY + 4);
          currentY += 7;
        });

        // Totals row
        checkPage(10);
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.line(tableX, currentY, tableX + contentWidth, currentY);
        currentY += 2;
        const totInc = monthlyData.reduce((a, r) => a + r.ingresos, 0);
        const totExp = monthlyData.reduce((a, r) => a + r.gastos, 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        let tx = tableX + 3;
        doc.setTextColor(60, 60, 60);
        doc.text('TOTAL', tx, currentY + 4); tx += colWidths[0];
        doc.setTextColor(16, 185, 129); doc.text(fmtNum(totInc), tx, currentY + 4); tx += colWidths[1];
        doc.setTextColor(239, 68, 68); doc.text(fmtNum(totExp), tx, currentY + 4); tx += colWidths[2];
        const tb = totInc - totExp; doc.setTextColor(tb >= 0 ? 16 : 239, tb >= 0 ? 185 : 68, tb >= 0 ? 129 : 68); doc.text(fmtNum(tb), tx, currentY + 4);
        currentY += 12;
      }

      // ── Últimas Transacciones (PDF) ──
      if ((viewType === 'general' || viewType === 'solo-ingresos' || viewType === 'solo-gastos') && (lastIncomes.length > 0 || lastExpenses.length > 0)) {
        checkPage(40);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(60, 60, 60);
        doc.text('Últimas Transacciones', marginX, currentY);
        currentY += 6;

        if ((viewType === 'general' || viewType === 'solo-ingresos') && lastIncomes.length > 0) {
          doc.setFontSize(9);
          doc.setTextColor(16, 185, 129);
          doc.text('Últimos Ingresos', marginX, currentY);
          currentY += 4;
          lastIncomes.forEach((inc:any) => {
            checkPage(6);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);
            doc.text(`${new Date(inc.date || inc.createdAt).toLocaleDateString('es-NI')} - ${(inc.source || inc.notes || 'Ingreso').substring(0, 45)}`, marginX, currentY);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(16, 185, 129);
            doc.text(`+${fmtNum(cv(inc))}`, marginX + contentWidth - 5, currentY, { align: 'right' });
            currentY += 5;
          });
          currentY += 4;
        }

        if ((viewType === 'general' || viewType === 'solo-gastos') && lastExpenses.length > 0) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(244, 63, 94);
          doc.text('Últimos Gastos', marginX, currentY);
          currentY += 4;
          lastExpenses.forEach((exp:any) => {
            checkPage(6);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);
            doc.text(`${new Date(exp.date || exp.createdAt).toLocaleDateString('es-NI')} - ${(exp.description || 'Gasto').substring(0, 45)}`, marginX, currentY);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(244, 63, 94);
            doc.text(`-${fmtNum(cv(exp))}`, marginX + contentWidth - 5, currentY, { align: 'right' });
            currentY += 5;
          });
          currentY += 4;
        }
      }

      doc.save(`Balance_General_${now.toISOString().split('T')[0]}.pdf`);
      toast.success("PDF exportado exitosamente");
    } catch (e: any) {
       console.error(e);
       toast.error(e?.response?.data?.message || e?.message || "Error al exportar PDF");
    }
  };

  const exportExcel = async () => {
    try {
      toast.info("Generando Excel, por favor espere...");
      const wb = new ExcelJS.Workbook();
      const companyName = (themeConfig.tenantName || user?.tenantName || 'Mi Empresa').toUpperCase();
      const logoUrl = themeConfig.logo || '';
      const primaryColor = themeConfig.colors.primary || '#10b981';
      const hexColor = primaryColor.startsWith('#') ? primaryColor.replace('#', '') : '10b981';
      const primaryHex = primaryColor.startsWith('#') ? primaryColor : '#10b981';
      const currencyLabel = displayCurrency === 'USD' ? 'Dólares (USD)' : 'Córdobas (NIO)';

      const ws = wb.addWorksheet('Balance General');
      // Set column widths for a unified 4-column layout
      ws.getColumn(1).width = 25;
      ws.getColumn(2).width = 25;
      ws.getColumn(3).width = 25;
      ws.getColumn(4).width = 25;

      let currentRow = 1;

      // ── Logo ──
      if (logoUrl) {
         const base64Logo = await getBase64Image(logoUrl);
         if (base64Logo) {
            const logoId = wb.addImage({ base64: base64Logo, extension: 'png' });
            ws.addImage(logoId, { tl: { col: 1.5, row: 0 }, ext: { width: 80, height: 80 } });
            currentRow = 6;
         }
      }

      // ── Encabezado ──
      ws.mergeCells(`A${currentRow}:D${currentRow}`);
      const cellName = ws.getCell(`A${currentRow}`);
      cellName.value = companyName;
      cellName.font = { size: 16, bold: true, color: { argb: `FF${hexColor}` } };
      cellName.alignment = { horizontal: 'center' };
      currentRow++;

      ws.mergeCells(`A${currentRow}:D${currentRow}`);
      const cellTitle = ws.getCell(`A${currentRow}`);
      cellTitle.value = `Balance General - ${viewType.toUpperCase()}`;
      cellTitle.font = { size: 13, bold: true };
      cellTitle.alignment = { horizontal: 'center' };
      currentRow++;

      ws.mergeCells(`A${currentRow}:D${currentRow}`);
      const cellCurrency = ws.getCell(`A${currentRow}`);
      const now = new Date();
      cellCurrency.value = `Generado: ${now.toLocaleDateString('es-NI')} ${now.toLocaleTimeString('es-NI')}  |  Moneda: ${currencyLabel}`;
      cellCurrency.font = { size: 10, italic: true, color: { argb: 'FF888888' } };
      cellCurrency.alignment = { horizontal: 'center' };
      currentRow += 2;

      // ── KPIs ──
      const kpiBoxes: { label: string; value: string; detail: string; bgColor: string }[] = [
        { label: 'TOTAL INGRESOS', value: fmtNum(totalIncome), detail: `${fIncomes.length} registros`, bgColor: 'FF10B981' },
        { label: 'TOTAL GASTOS', value: fmtNum(totalExpense), detail: `${fExpenses.length} registros`, bgColor: 'FFF43F5E' },
        { label: 'BALANCE NETO', value: fmtNum(balance), detail: `Margen: ${margin}%`, bgColor: balance >= 0 ? 'FF10B981' : 'FFF43F5E' },
        { label: 'RECURRENTES ACTIVOS', value: `+${fmtNum(totalRecInc)} / -${fmtNum(totalRecExp)}`, detail: `${recIncActive.length} ing. · ${recExpActive.length} gto.`, bgColor: 'FFA855F7' },
      ];

      const renderKpiBoxRow = (boxes: typeof kpiBoxes) => {
        ws.getRow(currentRow).height = 18;
        boxes.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.label;
          cell.font = { size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { top: { style: 'thin', color: { argb: kpi.bgColor } }, left: { style: 'thin', color: { argb: 'FFFFFFFF' } }, right: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
        });
        currentRow++;
        ws.getRow(currentRow).height = 28;
        boxes.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.value;
          cell.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { left: { style: 'thin', color: { argb: 'FFFFFFFF' } }, right: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
        });
        currentRow++;
        ws.getRow(currentRow).height = 16;
        boxes.forEach((kpi, idx) => {
          const cell = ws.getCell(currentRow, idx + 1);
          cell.value = kpi.detail;
          cell.font = { size: 8, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.bgColor } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = { bottom: { style: 'thin', color: { argb: kpi.bgColor } }, left: { style: 'thin', color: { argb: 'FFFFFFFF' } }, right: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
        });
        currentRow++;
      };

      renderKpiBoxRow(kpiBoxes);
      currentRow += 2;

      // ── Gráfico Mensual ──
      const captureAndEmbed = async (elementId: string, imgWidthPx: number) => {
        const el = document.getElementById(elementId);
        if (!el) return;
        try {
          const canvas = await html2canvas(el, {
            scale: 2,
            backgroundColor: '#ffffff',
            onclone: (clonedDoc) => sanitizeHtml2CanvasOklch(elementId, clonedDoc, primaryHex),
          });
          const imgData = canvas.toDataURL('image/png');
          const imgId = wb.addImage({ base64: imgData, extension: 'png' });
          const imgHeight = (canvas.height * imgWidthPx) / canvas.width;
          ws.addImage(imgId, { tl: { col: 0, row: currentRow }, ext: { width: imgWidthPx, height: imgHeight } });
          currentRow += Math.ceil(imgHeight / 18) + 2;
        } catch (e: any) {
          console.warn(`Image capture failed for #${elementId}`, e);
        }
      };

      await captureAndEmbed('balance-monthly-chart', 700);
      await captureAndEmbed('balance-category-chart', 700);

      // ── Distribución por Categoría ──
      if (categoryData.length > 0) {
        ws.mergeCells(`A${currentRow}:D${currentRow}`);
        const cTitle = ws.getCell(`A${currentRow}`);
        cTitle.value = 'Distribución por Categoría';
        cTitle.font = { size: 12, bold: true, color: { argb: 'FF333333' } };
        currentRow++;

        const hRow = ws.addRow(['Categoría', '', 'Monto', '% del Total']);
        ws.mergeCells(`A${currentRow}:B${currentRow}`);
        hRow.eachCell((cell, i) => {
          if (i !== 2) {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hexColor}` } };
            cell.alignment = { horizontal: 'center' };
          }
        });
        hRow.getCell(3).alignment = { horizontal: 'right' };
        hRow.getCell(4).alignment = { horizontal: 'center' };
        currentRow++;

        const catTotal = categoryData.reduce((a, c) => a + c.value, 0);
        [...categoryData].sort((a,b) => b.value - a.value).forEach((cat) => {
          const r = ws.addRow([cat.name, '', Math.round(cat.value * 100) / 100, Math.round((catTotal>0?(cat.value/catTotal)*100:0) * 10) / 10]);
          ws.mergeCells(`A${currentRow}:B${currentRow}`);
          r.getCell(1).font = { size: 10 };
          r.getCell(3).font = { size: 10, bold: true };
          r.getCell(3).numFmt = '#,##0.00';
          r.getCell(3).alignment = { horizontal: 'right' };
          r.getCell(4).font = { size: 10, color: { argb: 'FF888888' } };
          r.getCell(4).numFmt = '0.0';
          r.getCell(4).alignment = { horizontal: 'center' };
          r.eachCell(cell => { cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } }; });
          currentRow++;
        });
        currentRow++;
      }

      // ── Salud Financiera ──
      ws.mergeCells(`A${currentRow}:D${currentRow}`);
      const hTitle = ws.getCell(`A${currentRow}`);
      hTitle.value = 'Salud Financiera';
      hTitle.font = { size: 12, bold: true, color: { argb: 'FF333333' } };
      currentRow++;

      const totalFlow = totalIncome + totalExpense;
      const incPct = totalFlow > 0 ? ((totalIncome / totalFlow) * 100).toFixed(1) : '50.0';
      const expPct = totalFlow > 0 ? ((totalExpense / totalFlow) * 100).toFixed(1) : '50.0';

      const healthRow1 = ws.addRow([`Ingresos: ${incPct}%`, '', `Gastos: ${expPct}%`, '']);
      ws.mergeCells(`A${currentRow}:B${currentRow}`);
      ws.mergeCells(`C${currentRow}:D${currentRow}`);
      healthRow1.getCell(1).font = { bold: true, color: { argb: 'FF10B981' } };
      healthRow1.getCell(3).font = { bold: true, color: { argb: 'FFF43F5E' } };
      healthRow1.getCell(3).alignment = { horizontal: 'right' };
      currentRow++;

      const healthRow2 = ws.addRow([`Ingresos Recurrentes: ${recIncActive.length} fuentes · ${fmtNum(totalRecInc)}/ciclo`]);
      ws.mergeCells(`A${currentRow}:D${currentRow}`);
      healthRow2.getCell(1).font = { size: 10, color: { argb: 'FF333333' } };
      currentRow++;

      const healthRow3 = ws.addRow([`Gastos Recurrentes: ${recExpActive.length} compromisos · ${fmtNum(totalRecExp)}/ciclo`]);
      ws.mergeCells(`A${currentRow}:D${currentRow}`);
      healthRow3.getCell(1).font = { size: 10, color: { argb: 'FF333333' } };
      currentRow += 2;

      // ── Detalle Mensual ──
      if (monthlyData.length > 0) {
        ws.mergeCells(`A${currentRow}:D${currentRow}`);
        const mTitle = ws.getCell(`A${currentRow}`);
        mTitle.value = 'Detalle Mensual';
        mTitle.font = { size: 12, bold: true, color: { argb: 'FF333333' } };
        currentRow++;

        const mHead = ws.addRow(['Mes', 'Ingresos', 'Gastos', 'Balance']);
        mHead.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hexColor}` } };
          cell.alignment = { horizontal: 'center' };
        });
        currentRow++;

        monthlyData.forEach(row => {
          const r = ws.addRow([row.month, Math.round(row.ingresos*100)/100, Math.round(row.gastos*100)/100, Math.round((row.ingresos-row.gastos)*100)/100]);
          r.getCell(1).font = { size: 10 };
          r.getCell(2).font = { size: 10, color: { argb: 'FF10B981' } }; r.getCell(2).numFmt = '#,##0.00'; r.getCell(2).alignment = { horizontal: 'right' };
          r.getCell(3).font = { size: 10, color: { argb: 'FFF43F5E' } }; r.getCell(3).numFmt = '#,##0.00'; r.getCell(3).alignment = { horizontal: 'right' };
          const bal = row.ingresos - row.gastos;
          r.getCell(4).font = { size: 10, color: { argb: bal >= 0 ? 'FF10B981' : 'FFF43F5E' } }; r.getCell(4).numFmt = '#,##0.00'; r.getCell(4).alignment = { horizontal: 'right' };
          r.eachCell(cell => { cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } }; });
          currentRow++;
        });

        const totInc = monthlyData.reduce((a, r) => a + r.ingresos, 0);
        const totExp = monthlyData.reduce((a, r) => a + r.gastos, 0);
        const balTot = totInc - totExp;
        const totR = ws.addRow(['TOTAL', Math.round(totInc*100)/100, Math.round(totExp*100)/100, Math.round(balTot*100)/100]);
        totR.getCell(1).font = { size: 10, bold: true };
        totR.getCell(2).font = { size: 10, bold: true, color: { argb: 'FF10B981' } }; totR.getCell(2).numFmt = '#,##0.00'; totR.getCell(2).alignment = { horizontal: 'right' };
        totR.getCell(3).font = { size: 10, bold: true, color: { argb: 'FFF43F5E' } }; totR.getCell(3).numFmt = '#,##0.00'; totR.getCell(3).alignment = { horizontal: 'right' };
        totR.getCell(4).font = { size: 10, bold: true, color: { argb: balTot >= 0 ? 'FF10B981' : 'FFF43F5E' } }; totR.getCell(4).numFmt = '#,##0.00'; totR.getCell(4).alignment = { horizontal: 'right' };
        totR.eachCell(cell => { cell.border = { top: { style: 'medium', color: { argb: `FF${hexColor}` } } }; });
      }

      // ── Últimas Transacciones (Excel) ──
      if ((viewType === 'general' || viewType === 'solo-ingresos') && lastIncomes.length > 0) {
        ws.mergeCells(`A${currentRow}:D${currentRow}`);
        const tTitle = ws.getCell(`A${currentRow}`);
        tTitle.value = 'Últimos Ingresos';
        tTitle.font = { size: 12, bold: true, color: { argb: 'FF10B981' } };
        currentRow++;

        const tHead = ws.addRow(['Fecha', 'Descripción', 'Categoría', 'Monto']);
        tHead.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
          cell.alignment = { horizontal: 'center' };
        });
        currentRow++;

        lastIncomes.forEach((inc:any) => {
          const r = ws.addRow([
            new Date(inc.date || inc.createdAt).toLocaleDateString('es-NI'),
            inc.source || inc.notes || 'Ingreso',
            inc.category || 'Sin categoría',
            Math.round(cv(inc) * 100) / 100
          ]);
          r.getCell(1).font = { size: 10 }; r.getCell(1).alignment = { horizontal: 'center' };
          r.getCell(2).font = { size: 10 };
          r.getCell(3).font = { size: 10, color: { argb: 'FF888888' } };
          r.getCell(4).font = { size: 10, bold: true, color: { argb: 'FF10B981' } };
          r.getCell(4).numFmt = '#,##0.00';
          r.getCell(4).alignment = { horizontal: 'right' };
          r.eachCell(cell => { cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } }; });
          currentRow++;
        });
        currentRow++;
      }

      if ((viewType === 'general' || viewType === 'solo-gastos') && lastExpenses.length > 0) {
        ws.mergeCells(`A${currentRow}:D${currentRow}`);
        const tTitle = ws.getCell(`A${currentRow}`);
        tTitle.value = 'Últimos Gastos';
        tTitle.font = { size: 12, bold: true, color: { argb: 'FFF43F5E' } };
        currentRow++;

        const tHead = ws.addRow(['Fecha', 'Descripción', 'Categoría', 'Monto']);
        tHead.eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF43F5E' } };
          cell.alignment = { horizontal: 'center' };
        });
        currentRow++;

        lastExpenses.forEach((exp:any) => {
          const r = ws.addRow([
            new Date(exp.date || exp.createdAt).toLocaleDateString('es-NI'),
            exp.description || 'Gasto',
            exp.category || 'Sin categoría',
            Math.round(cv(exp) * 100) / 100
          ]);
          r.getCell(1).font = { size: 10 }; r.getCell(1).alignment = { horizontal: 'center' };
          r.getCell(2).font = { size: 10 };
          r.getCell(3).font = { size: 10, color: { argb: 'FF888888' } };
          r.getCell(4).font = { size: 10, bold: true, color: { argb: 'FFF43F5E' } };
          r.getCell(4).numFmt = '#,##0.00';
          r.getCell(4).alignment = { horizontal: 'right' };
          r.eachCell(cell => { cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } }; });
          currentRow++;
        });
        currentRow++;
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Balance_General_${now.toISOString().split('T')[0]}.xlsx`;
      a.click();
      toast.success("Excel exportado exitosamente");
    } catch (e: any) {
       console.error(e);
       toast.error(e?.response?.data?.message || e?.message || "Error al exportar Excel");
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-5 bg-muted/30 rounded-2xl border border-border/50 shadow-sm relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -left-10 -top-10 size-32 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        
        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 flex-1">
          <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-[0.2em] bg-background/50 px-3 py-1.5 rounded-lg border border-border/30 shrink-0">
            <Filter className="size-3.5" /> Filtros
          </div>
          
          <div className="flex gap-4 w-full sm:w-auto justify-center">
            <div className="flex flex-col gap-1.5 flex-1 sm:flex-none">
              <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest text-center sm:text-left pl-1">Desde</label>
              <Input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({...p, start: e.target.value}))} className="h-9 w-full sm:w-[150px] bg-background/50 border-border/40 focus:border-primary/50 text-center" />
            </div>
            <div className="flex flex-col gap-1.5 flex-1 sm:flex-none">
              <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest text-center sm:text-left pl-1">Hasta</label>
              <Input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({...p, end: e.target.value}))} className="h-9 w-full sm:w-[150px] bg-background/50 border-border/40 focus:border-primary/50 text-center" />
            </div>
          </div>

          {(dateRange.start || dateRange.end) && (
            <button onClick={() => setDateRange({start:'',end:''})} className="h-9 px-4 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-rose-500 hover:bg-rose-500/5 rounded-xl border border-dashed border-border/60 transition-all">
              <X className="size-3" /> Limpiar
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto pt-4 lg:pt-0 border-t lg:border-t-0 border-border/20 lg:ml-auto">
          <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
            {viewButtons.map(btn => (
              <button 
                key={btn.value} 
                onClick={() => setViewType(btn.value)} 
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm",
                  viewType === btn.value 
                    ? "bg-primary text-primary-foreground shadow-primary/20 scale-[1.02]" 
                    : "bg-background/50 text-muted-foreground hover:bg-muted border border-border/30"
                )}
              >
                {btn.label}
              </button>
            ))}
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center justify-center gap-2 w-full sm:w-auto rounded-xl border border-border/60 bg-background px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-muted hover:shadow-md">
                <Download className="size-4" /> Exportar
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl border-border/50">
              <DropdownMenuItem onClick={exportExcel} className="rounded-lg cursor-pointer"><FileSpreadsheet className="size-4 mr-2 text-green-600" /> Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={exportPDF} className="rounded-lg cursor-pointer"><FileText className="size-4 mr-2 text-red-500" /> PDF (.pdf)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* KPIs */}
      <div id="balance-kpis" className={`grid gap-4 ${showBalanceKPI ? 'md:grid-cols-2 lg:grid-cols-4' : showRecurring && viewType === 'recurrentes' ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
        {showIncomeKPIs && (
          <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent relative overflow-hidden">
            <div className="absolute top-2 right-2 opacity-10"><TrendingUp className="size-12" /></div>
            <CardHeader className="pb-1"><CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><ArrowUpRight className="size-4 text-emerald-500" />Total Ingresos</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-black text-emerald-500">{sym}{totalIncome.toLocaleString(undefined,{maximumFractionDigits:2})}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{fIncomes.length} registros</p>
            </CardContent>
          </Card>
        )}
        {showExpenseKPIs && (
          <Card className="border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-transparent relative overflow-hidden">
            <div className="absolute top-2 right-2 opacity-10"><TrendingDown className="size-12" /></div>
            <CardHeader className="pb-1"><CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><ArrowDownRight className="size-4 text-rose-500" />Total Gastos</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-black text-rose-500">{sym}{totalExpense.toLocaleString(undefined,{maximumFractionDigits:2})}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{fExpenses.length} registros</p>
            </CardContent>
          </Card>
        )}
        {showBalanceKPI && (
          <Card className={cn(balance >= 0 ? 'border-emerald-500/20 bg-gradient-to-br from-emerald-500/5' : 'border-rose-500/20 bg-gradient-to-br from-rose-500/5', 'to-transparent relative overflow-hidden')}>
            <div className="absolute top-2 right-2 opacity-10"><Scale className="size-12" /></div>
            <CardHeader className="pb-1"><CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><Wallet className="size-4" />Balance Neto{valuationModeSuffix}</CardTitle></CardHeader>
            <CardContent>
              <p className={`text-2xl font-black ${balance>=0?'text-emerald-500':'text-rose-500'}`}>{sym}{balance.toLocaleString(undefined,{maximumFractionDigits:2})}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Margen: {margin}%</p>
            </CardContent>
          </Card>
        )}
        {showRecurring && (
          <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent relative overflow-hidden">
            <div className="absolute top-2 right-2 opacity-10"><CalendarClock className="size-12" /></div>
            <CardHeader className="pb-1"><CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2"><Activity className="size-4 text-purple-500" />Recurrentes Activos</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm font-bold text-emerald-500">+{sym}{totalRecInc.toLocaleString(undefined,{maximumFractionDigits:0})}/ciclo</p>
              <p className="text-sm font-bold text-rose-500">-{sym}{totalRecExp.toLocaleString(undefined,{maximumFractionDigits:0})}/ciclo</p>
              <p className="text-[10px] text-muted-foreground mt-1">{recIncActive.length} ing. · {recExpActive.length} gto.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <div id="balance-monthly-chart">
        <Card className="min-w-0 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              {viewType === 'solo-ingresos' ? 'Ingresos por Mes' : viewType === 'solo-gastos' ? 'Gastos por Mes' : viewType === 'recurrentes' ? 'Recurrentes por Mes' : 'Ingresos vs Gastos por Mes'}
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 overflow-visible">
            {monthlyData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Sin datos para el rango seleccionado</div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={monthlyData} barGap={4} margin={{ top: 12, right: 20, left: 8, bottom: 14 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke={FINANCE_GRID} opacity={0.45} vertical={false} />
                  <XAxis dataKey="month" tick={FINANCE_AXIS_TICK} tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tick={FINANCE_AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={(v: number) => sym + (Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'K' : v.toFixed(0))} width={64} />
                  <Tooltip content={({active, payload, label}: any) => {
                    if (!active || !payload?.length) return null
                    return <FinanceTooltipCard active={active} payload={payload} label={label} formatter={(value) => `${sym}${Number(value).toLocaleString(undefined,{minimumFractionDigits:2})}`} />
                  }} wrapperStyle={FINANCE_TOOLTIP_WRAPPER} cursor={{ fill: 'var(--muted)', fillOpacity: 0.35 }} />
                  <Legend verticalAlign="bottom" height={28} formatter={(value:string) => <span style={{color:'var(--foreground)', fontWeight:600, fontSize:11}}>{value}</span>} />
                  {(viewType !== 'solo-gastos') && <Bar dataKey="ingresos" fill="#10b981" radius={[5,5,0,0]} maxBarSize={32} name="Ingresos" />}
                  {(viewType !== 'solo-ingresos') && <Bar dataKey="gastos" fill="#ef4444" radius={[5,5,0,0]} maxBarSize={32} name="Gastos" />}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div id="balance-category-section" className="grid gap-6 lg:grid-cols-2">
        <div id="balance-category-chart">
          <Card className="min-w-0 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <PieChartIcon className="size-4 text-primary" /> Distribución por Categoría
                <Badge variant="outline" className="text-[9px] ml-auto">{viewType === 'solo-ingresos' ? 'Ingresos' : viewType === 'solo-gastos' ? 'Gastos' : viewType === 'recurrentes' ? 'Recurrentes' : 'Todo'}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 overflow-visible">
              {categoryData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">Sin datos</div>
              ) : (
              <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="44%" innerRadius="52%" outerRadius="76%" startAngle={90} endAngle={-270} paddingAngle={categoryData.length > 1 ? 2 : 0} dataKey="value">
                      {categoryData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<FinanceTooltipCard formatter={(value) => `${sym}${Number(value).toLocaleString(undefined,{minimumFractionDigits:2})}`} />} wrapperStyle={FINANCE_TOOLTIP_WRAPPER} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" formatter={(value: string) => <span style={{ color: 'var(--foreground)', fontSize: 11, fontWeight: 600 }}>{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Health */}
        <Card id="balance-health-section" className="border-border/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2"><Scale className="size-4 text-primary" /> Salud Financiera</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-bold mb-2">Composición del Flujo</p>
              <div className="w-full bg-muted h-4 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-500 transition-all" style={{width:`${totalIncome+totalExpense>0?(totalIncome/(totalIncome+totalExpense))*100:50}%`}} />
                <div className="h-full bg-rose-500 transition-all" style={{width:`${totalIncome+totalExpense>0?(totalExpense/(totalIncome+totalExpense))*100:50}%`}} />
              </div>
              <div className="flex justify-between mt-2 text-[10px] font-black uppercase">
                <span className="text-emerald-500">Ingresos: {totalIncome+totalExpense>0?((totalIncome/(totalIncome+totalExpense))*100).toFixed(0):50}%</span>
                <span className="text-rose-500">Gastos: {totalIncome+totalExpense>0?((totalExpense/(totalIncome+totalExpense))*100).toFixed(0):50}%</span>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground uppercase font-bold">Proyección Recurrente</p>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10"><TrendingUp className="size-4 text-emerald-500" /></div>
                <div><p className="text-sm font-bold">Ingresos Recurrentes</p><p className="text-xs text-muted-foreground">{recIncActive.length} fuentes · {sym}{totalRecInc.toLocaleString(undefined,{maximumFractionDigits:0})}/ciclo</p></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-rose-500/10"><TrendingDown className="size-4 text-rose-500" /></div>
                <div><p className="text-sm font-bold">Gastos Recurrentes</p><p className="text-xs text-muted-foreground">{recExpActive.length} compromisos · {sym}{totalRecExp.toLocaleString(undefined,{maximumFractionDigits:0})}/ciclo</p></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      {(viewType === 'general' || viewType === 'solo-ingresos' || viewType === 'solo-gastos') && (
        <div id="balance-transactions-section" className={`grid gap-6 ${viewType === 'general' ? 'lg:grid-cols-2' : ''}`}>
          {(viewType === 'general' || viewType === 'solo-ingresos') && (
            <Card className="border-emerald-500/20">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2"><ArrowUpRight className="size-4 text-emerald-500" /> Últimos Ingresos</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {lastIncomes.length === 0 ? <p className="text-sm text-muted-foreground italic py-4 text-center">Sin ingresos</p> : lastIncomes.map((inc:any) => (
                  <div key={inc.id} className="flex items-start justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 hover:bg-emerald-500/10 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold break-words">{inc.source || inc.notes || 'Ingreso'}</p>
                      <p className="text-[10px] text-muted-foreground break-words">{inc.category || 'Sin categoría'} · {new Date(inc.date || inc.createdAt).toLocaleDateString('es-NI')}</p>
                    </div>
                    <CurrencyValuationAmount amount={Number(inc.amount) || 0} sourceCurrency={inc.currency} sourceExchangeRate={inc.exchangeRate} className="text-sm font-black text-emerald-500 shrink-0 ml-3 mt-0.5" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {(viewType === 'general' || viewType === 'solo-gastos') && (
            <Card className="border-rose-500/20">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2"><ArrowDownRight className="size-4 text-rose-500" /> Últimos Gastos</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {lastExpenses.length === 0 ? <p className="text-sm text-muted-foreground italic py-4 text-center">Sin gastos</p> : lastExpenses.map((exp:any) => (
                  <div key={exp.id} className="flex items-start justify-between p-3 rounded-lg bg-rose-500/5 border border-rose-500/10 hover:bg-rose-500/10 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold break-words">{exp.description || 'Gasto'}</p>
                      <p className="text-[10px] text-muted-foreground break-words">{exp.source ? `${exp.source} · ` : ''}{exp.category || 'Sin categoría'} · {new Date(exp.date || exp.createdAt).toLocaleDateString('es-NI')}</p>
                    </div>
                    <CurrencyValuationAmount amount={Number(exp.amount) || 0} sourceCurrency={exp.currency} sourceExchangeRate={exp.exchangeRate} className="text-sm font-black text-rose-500 shrink-0 ml-3 mt-0.5" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
