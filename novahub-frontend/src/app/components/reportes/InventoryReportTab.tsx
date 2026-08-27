import { useState, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { inventoryService } from '../../services/inventario.service';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Package, TrendingDown, DollarSign, Activity, ArrowUpRight, Scale, Warehouse, Tag, ShieldAlert, Gauge, Layers, Upload, CalendarClock, Download, Loader2, CheckCircle2 } from 'lucide-react';
import type { ReportExportRef, ReportProps } from './types';
import { useTenantQuery, asList } from '../../hooks/useTenantQuery';
import { downloadExcelWorkbook, getBase64Image, sanitizeHtml2CanvasOklch } from '../../utils/reportExportUtils';
import { getPdfDesignSettings, pdfDesignPaper } from '../../utils/pdfGenerator';
import { ImportReviewSummary } from '../ui/ImportReviewSummary';
import { ImportProgressOverlay } from '../ui/ImportProgressOverlay';
import { ImportPreviewField, ImportPreviewMobileCard } from '../ui/ImportPreviewMobile';
import { VirtualizedImportList } from '../ui/VirtualizedImportList';
import { parseSpreadsheetInWorker } from '../../utils/import-spreadsheet';

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DAY_MS = 86_400_000;
const PIE_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#14b8a6', '#6366f1', '#94a3b8'];

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function lastDayOfMonth(ym: string): Date {
  const parts = String(ym || '').split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!year || !month) return new Date();
  return new Date(year, month, 0, 23, 59, 59, 999);
}

function monthLabelOf(ym: string): string {
  const parts = String(ym || '').split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  if (!year || !month) return ym;
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function currentMonthYM(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function buildMonthOptions(count = 24): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  return opts;
}

function signedMovementQty(m: any): number {
  const qty = Math.abs(Number(m.quantity || 0));
  if (m.type === 'OUT') return -qty;
  if (m.type === 'ADJUSTMENT' && Number(m.quantity) < 0) return -qty;
  return qty;
}

function stockOfProduct(product: any, warehouseId: string): number {
  const levels = product?.stockLevels || [];
  if (warehouseId && levels.length > 0) {
    const lvl = levels.find((l: any) => l && String(l.warehouseId) === String(warehouseId));
    if (lvl && lvl.quantity !== undefined) return Number(lvl.quantity || 0);
  }
  if (levels.length > 0) return levels.reduce((a: any, l: any) => a + Number(l?.quantity || 0), 0);
  return Number(product?.stock || 0);
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
    default:
      return { start: new Date(0), prevStart: new Date(0), prevEnd: new Date(0), durationDays: Number.MAX_SAFE_INTEGER };
  }
  start.setHours(0, 0, 0, 0);
  prevStart.setHours(0, 0, 0, 0);
  prevEnd.setHours(23, 59, 59, 999);
  const durationDays = Math.max(1, Math.round((now.getTime() - start.getTime()) / DAY_MS));
  return { start, prevStart, prevEnd, durationDays };
}

function rangeText(range: string) {
  switch (range) {
    case 'hoy': return 'Hoy';
    case 'ultima-semana': return 'últimos 7 días';
    case 'ultimo-mes': return 'últimos 30 días';
    case 'ultimo-trimestre': return 'últimos 3 meses';
    case 'ultimo-año': return 'últimos 12 meses';
    default: return 'histórico completo';
  }
}

function cutoffText(date: Date) {
  return `Existencias al ${date.toLocaleDateString('es-NI', { day: '2-digit', month: 'long', year: 'numeric' })}`;
}

function isTransferRef(m: any) {
  return m.type === 'TRANSFER' || (m.reference && String(m.reference).toLowerCase().startsWith('transferencia'));
}

function isAdjustRef(m: any) {
  return m.type === 'ADJUSTMENT' || (m.reference && String(m.reference).toLowerCase().startsWith('ajuste'));
}

function isOpMovement(m: any) {
  return (m.type === 'IN' || m.type === 'OUT') && !isTransferRef(m) && !isAdjustRef(m);
}

function fmtQty(v: number | null | undefined) {
  const num = Number(v ?? 0);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('es-NI', { maximumFractionDigits: 0 });
}

interface ProdRow {
  id: string;
  code: string;
  name: string;
  sku?: string;
  brand?: string;
  unit: string;
  categoryName: string;
  costPrice: number;
  salePrice: number;
  minStock: number;
  qty: number;
  reserved: number;
  overstock: boolean;
  levels: { warehouseId: string; warehouseName: string; quantity: number; minStock: number; maxStock: number | null }[];
  mainWarehouse: string;
}

interface RiskRow {
  product: string;
  code: string;
  warehouse: string;
  qty: number;
  minStock: number;
  maxStock: number | null;
  reason: string;
}

const TH = 'px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap';
const TD = 'px-3 py-2 text-xs whitespace-nowrap';

export const InventoryReportTab = forwardRef<ReportExportRef, ReportProps>(({ dateRange }, ref) => {
  const { displayCurrency, baseCurrency, valuationModeLabel, valuationModeSuffix, formatConvertedAmount: formatAmountBySource } = useCurrency();
  const { themeConfig } = useTheme();
  const { canPerform } = useAuth();
  const canViewInventory = canPerform('INVENTORY', 'view');
  const currencySymbol = displayCurrency === 'USD' ? '$' : 'C$';
  const formatConvertedAmount = (amount: number, sourceCurrency?: string, sourceExchangeRate?: number) =>
    formatAmountBySource(amount, sourceCurrency === 'NIO' ? baseCurrency : sourceCurrency, sourceExchangeRate);

  const { data: reportData, isLoading: loading } = useTenantQuery(['reports', 'inventory'], async (signal) => {
    const filters = { page: 1, pageSize: 5000, report: true } as const;
    const [prodRes, movRes, adjRes, trfRes, replRes] = await Promise.all([
      inventoryService.getProducts(filters, signal),
      inventoryService.getMovements(filters, signal),
      inventoryService.getAdjustments(filters, signal),
      inventoryService.getTransfers(filters, signal),
      inventoryService.getReplenishmentReport('monthly', signal),
    ]);
    return { products: asList(prodRes), movements: asList(movRes), adjustments: asList(adjRes), transfers: asList(trfRes), replenishment: replRes };
  }, { enabled: canViewInventory, onError: (e) => toast.error(e.message || 'Error cargando inventario') });
  const products = reportData?.products || [];
  const movements = reportData?.movements || [];
  const adjustments = reportData?.adjustments || [];
  const transfers = reportData?.transfers || [];
  const replenishment = reportData?.replenishment || null;

  const [riskGroup, setRiskGroup] = useState<string | null>(null);
  const [distMode, setDistMode] = useState<'categoria' | 'bodega' | 'marca' | 'rotacion'>('categoria');
  const [movTab, setMovTab] = useState('movimientos');
  const [valTab, setValTab] = useState('mayor-valor');
  const [rotTab, setRotTab] = useState('mayor-rotacion');

  const { start: currentStart, durationDays } = useMemo(() => getRangeDates(dateRange), [dateRange]);
  const rangeLabel = rangeText(dateRange);

  // ── Product rows (non-service, with per-warehouse levels) ──
  const prodRows = useMemo<ProdRow[]>(() => {
    return products
      .filter((p) => (p.type ?? p.itemType) !== 'SERVICE')
      .map((p) => {
        const levels = (p.stockLevels || [])
          .filter((l: any) => l && l.quantity !== undefined)
          .map((l: any) => ({
            warehouseId: l.warehouseId,
            warehouseName: l.warehouse?.name || 'Sin bodega',
            quantity: Number(l.quantity || 0),
            minStock: Number(l.minStock ?? p.minStock ?? 0),
            maxStock: l.maxStock != null ? Number(l.maxStock) : null,
          }));
        const qty = levels.length > 0 ? levels.reduce((a: any, l: any) => a + l.quantity, 0) : Number(p.stock || 0);
        const mainLevel = levels.length > 0 ? levels.reduce((a: any, b: any) => (b.quantity > a.quantity ? b : a)) : null;
        const overstock = levels.some((l: any) => l.maxStock != null && l.quantity > l.maxStock);
        return {
          id: p.id,
          code: p.code || p.sku || '',
          name: p.name || 'Producto',
          sku: p.sku,
          brand: p.brand,
          unit: p.unit || 'unidad',
          categoryName: p.category?.name || (typeof p.category === 'string' ? p.category : 'Sin categoría'),
          costPrice: Number(p.costPrice || 0),
          salePrice: Number(p.salePrice || 0),
          minStock: Number(p.minStock ?? 0),
          qty,
          reserved: levels.reduce((a: any, l: any) => a + Number(l.quantity > 0 ? (p.reserved || 0) : 0), 0),
          overstock,
          levels,
          mainWarehouse: mainLevel?.warehouseName || 'Sin bodega',
        };
      });
  }, [products]);

  // ── Movements analysis ──
  const opMov = useMemo(() => movements.filter(isOpMovement), [movements]);

  const periodOpMov = useMemo(() => opMov.filter((m) => {
    const d = toDate(m.date || m.createdAt);
    return !!d && d.getTime() >= currentStart.getTime();
  }), [opMov, currentStart]);

  const periodAgg = useMemo(() => {
    const outs = new Map<string, number>();
    const ins = new Map<string, number>();
    let cogs = 0;
    for (const m of periodOpMov) {
      const pid = m.productId;
      const qty = Math.abs(Number(m.quantity || 0));
      if (m.type === 'OUT') {
        outs.set(pid, (outs.get(pid) || 0) + qty);
        cogs += qty * Number(m.baseCost ?? m.unitCost ?? 0);
      } else {
        ins.set(pid, (ins.get(pid) || 0) + qty);
      }
    }
    return { outs, ins, cogs };
  }, [periodOpMov]);

  const lastOutByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of opMov) {
      if (m.type !== 'OUT') continue;
      const d = toDate(m.date || m.createdAt);
      if (!d) continue;
      const t = d.getTime();
      if (!map.has(m.productId) || t > map.get(m.productId)!) map.set(m.productId, t);
    }
    return map;
  }, [opMov]);

  const [nowMs] = useState(() => Date.now());

  // ── Corte mensual de existencias ──
  const queryClient = useQueryClient();
  const [monthCutoff, setMonthCutoff] = useState('');
  const cutoffDate = useMemo(() => (monthCutoff ? lastDayOfMonth(monthCutoff) : null), [monthCutoff]);
  const monthOptions = useMemo(() => buildMonthOptions(24), []);

  const warehouses = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      for (const l of p.stockLevels || []) {
        if (!l || !l.warehouseId) continue;
        map.set(String(l.warehouseId), l.warehouse?.name || 'Sin bodega');
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [products]);

  const qtyAtCutoff = useMemo(() => {
    const map = new Map<string, number>();
    if (!cutoffDate) return map;
    for (const m of movements) {
      if (m.type === 'TRANSFER' || isTransferRef(m)) continue;
      const d = toDate(m.date || m.createdAt);
      if (!d) continue;
      const t = d.getTime();
      if (t <= cutoffDate.getTime() || t > nowMs) continue;
      const pid = m.productId;
      if (!pid) continue;
      map.set(pid, (map.get(pid) || 0) + signedMovementQty(m));
    }
    return map;
  }, [movements, cutoffDate, nowMs]);

  const effectiveRows = useMemo(() => {
    if (qtyAtCutoff.size === 0) return prodRows;
    return prodRows.map((r) => {
      const delta = qtyAtCutoff.get(r.id);
      if (delta === undefined) return r;
      return { ...r, qty: Math.max(0, r.qty - delta) };
    });
  }, [prodRows, qtyAtCutoff]);

  // ── Importación de inventario por mes ──
  const [importOpen, setImportOpen] = useState(false);
  const [importMonth, setImportMonth] = useState(currentMonthYM());
  const [importWarehouse, setImportWarehouse] = useState('');
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [readingFile, setReadingFile] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const importFileRef = useRef<HTMLInputElement>(null);
  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const importPreview = useMemo(() => {
    return importRows.map((r) => {
      const product = r.productId ? productsById.get(r.productId) : null;
      const currentStock = product ? stockOfProduct(product, importWarehouse) : 0;
      const difference = r.error ? 0 : r.qty - currentStock;
      return { ...r, currentStock, difference };
    });
  }, [importRows, importWarehouse, productsById]);
  const importValidCount = importPreview.filter((r) => !r.error).length;

  function downloadImportTemplate() {
    const sample = products.filter((p) => (p.type ?? p.itemType) !== 'SERVICE').slice(0, 3);
    const sampleRows: (string | number)[][] = sample.map((p) => [p.code || p.sku || '', 0]);
    while (sampleRows.length < 3) sampleRows.push([`PRODUCTO-${sampleRows.length + 1}`, 0]);
    const ws = XLSX.utils.aoa_to_sheet([['Código de producto', 'Cantidad'], ...sampleRows]);
    ws['!cols'] = [{ wch: 28 }, { wch: 12 }];
    const guide = XLSX.utils.aoa_to_sheet([
      ['GUÍA DE LLENADO · IMPORTAR INVENTARIO POR MES'],
      ['1. Código de producto = código o SKU del producto en el sistema (no distingue mayúsculas ni espacios).'],
      ['2. Cantidad = existencias físicas del producto en el almacén al corte del mes seleccionado.'],
      ['3. El importador crea un ajuste de inventario que deja el stock exacto en esa cantidad.'],
      ['4. Las filas con códigos inexistentes o cantidades inválidas se omiten.'],
    ]);
    guide['!cols'] = [{ wch: 110 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
    XLSX.utils.book_append_sheet(wb, guide, 'Guía');
    XLSX.writeFile(wb, `plantilla_inventario_${importMonth}.xlsx`);
  }

  async function handleImportFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      toast.error('El archivo debe ser Excel (.xlsx o .xls)');
      return;
    }
    setReadingFile(true);
    setReadingProgress(3);
    try {
      const parsed = await parseSpreadsheetInWorker(file, 'Inventario', false, (progress) => {
        setReadingProgress(Math.min(84, Math.max(3, progress)));
      });
      setReadingProgress(88);
      const raw = parsed.rows;
      const nonEmpty = raw.filter((row: any[]) => Array.isArray(row) && row.some((cell: any) => String(cell ?? '').trim() !== ''));
      if (nonEmpty.length < 2) {
        toast.error('El archivo no contiene filas de datos');
        return;
      }
      const headerRow = (nonEmpty[0] || []).map((h: any) =>
        String(h ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
      const codeIdx = headerRow.findIndex((h: string) => h.includes('codigo') || h.includes('sku') || h.includes('producto'));
      const qtyIdx = headerRow.findIndex((h: string) => h.includes('cantidad'));
      if (codeIdx < 0 || qtyIdx < 0) {
        toast.error('La plantilla debe contener las columnas "Código de producto" y "Cantidad"');
        return;
      }
      const productByImportCode = new Map<string, any>();
      products.forEach((product) => {
        [product.code, product.sku].forEach((value) => {
          const normalized = String(value || '').toUpperCase().replace(/\s+/g, '');
          if (normalized) productByImportCode.set(normalized, product);
        });
      });
      const rows = nonEmpty.slice(1).map((cols: any[], i) => {
        const rowNum = i + 2;
        const rawCode = String(cols[codeIdx] ?? '').trim();
        const qtyText = String(cols[qtyIdx] ?? '').trim();
        if (!rawCode && !qtyText) return null;
        const code = rawCode.toUpperCase().replace(/\s+/g, '');
        const product = code ? productByImportCode.get(code) : null;
        let error = '';
        if (!rawCode) error = 'Código vacío';
        else if (!product) error = 'Código no encontrado en el catálogo';
        else if (qtyText === '' || !Number.isFinite(Number(qtyText))) error = 'Cantidad no numérica';
        else if (Number(qtyText) < 0) error = 'Cantidad negativa';
        const qty = Number.isFinite(Number(qtyText)) ? Number(qtyText) : 0;
        return { row: rowNum, rawCode, code, productId: product?.id || '', productName: product?.name || '', qty, error };
      }).filter((r: any) => r !== null);
      if (rows.length === 0) {
        toast.error('El archivo no contiene filas de datos');
        return;
      }
      setImportRows(rows);
      setImportFileName(file.name);
      setReadingProgress(100);
      toast.success(`${rows.length} filas leídas`);
    } catch (e: any) {
      toast.error('No se pudo leer el archivo Excel');
    } finally {
      setReadingFile(false);
      setReadingProgress(0);
    }
  }

  async function confirmImport() {
    const valid = importPreview.filter((r) => !r.error);
    if (valid.length === 0) {
      toast.error('No hay filas válidas para importar');
      return;
    }
    if (!importWarehouse) {
      toast.error('Selecciona el almacén del ajuste');
      return;
    }
    const changes = valid.filter((r) => Math.abs(r.difference) > 0.0001);
    setImporting(true);
    setImportProgress(5);
    try {
      setImportProgress(25);
      await inventoryService.createAdjustment({
        warehouseId: importWarehouse,
        reason: `Importación mensual ${importMonth}`,
        notes: 'Carga masiva desde plantilla',
        items: changes.map((row) => ({ productId: row.productId, actualStock: row.qty })),
      });
      setImportProgress(90);
      setImportProgress(100);
      toast.success(`Ajuste creado: ${changes.length} productos`);
      if (changes.length === 0) toast.info('Las cantidades coinciden con el stock actual: no se requieren ajustes');
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey.includes('reports') && q.queryKey.includes('inventory') });
      setImportOpen(false);
      setImportRows([]);
      setImportFileName('');
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo importar el inventario');
    } finally {
      setImporting(false);
    }
  }

  // ── KPI: Valor del inventario a costo ──
  const valuation = useMemo(() => {
    const withStock = effectiveRows.filter((r) => r.qty > 0);
    const totalUnits = withStock.reduce((a, r) => a + r.qty, 0);
    const totalValue = withStock.reduce((a, r) => a + r.qty * r.costPrice, 0);
    const withoutCost = withStock.filter((r) => r.costPrice <= 0);
    const status = withStock.length === 0
      ? 'UNAVAILABLE'
      : withoutCost.length > 0
        ? 'PARTIAL'
        : 'COMPLETE';
    return { withStock, totalUnits, totalValue, withoutCost, status, productsWithStock: withStock.length };
  }, [effectiveRows]);

  // ── KPI: Valor potencial a precio de venta ──
  const potential = useMemo(() => {
    const { withStock } = valuation;
    const totalSaleValue = withStock.reduce((a, r) => a + r.qty * r.salePrice, 0);
    const withoutPrice = withStock.filter((r) => r.salePrice <= 0);
    const complete = valuation.status === 'COMPLETE' && withoutPrice.length === 0;
    const margin = complete ? totalSaleValue - valuation.totalValue : null;
    return { totalSaleValue, withoutPrice, margin };
  }, [valuation]);

  // ── KPI: Rotación de inventario ──
  const rotation = useMemo(() => {
    const { outs, ins, cogs } = periodAgg;
    let avgInvValue = 0;
    let avgQtySum = 0;
    for (const r of effectiveRows) {
      const o = outs.get(r.id) || 0;
      const i = ins.get(r.id) || 0;
      const initial = Math.max(0, r.qty + o - i);
      const avgQty = (initial + r.qty) / 2;
      avgQtySum += avgQty;
      avgInvValue += avgQty * r.costPrice;
    }
    const turnover = avgInvValue > 0 && cogs > 0 ? cogs / avgInvValue : null;
    let totalOutUnits = 0;
    for (const m of periodOpMov) {
      if (m.type === 'OUT') totalOutUnits += Math.abs(Number(m.quantity || 0));
    }
    const avgCoverage = totalOutUnits > 0 && valuation.totalUnits > 0 ? valuation.totalUnits / (totalOutUnits / durationDays) : null;
    return { turnover, avgInvValue, avgQtySum, cogs, avgCoverage };
  }, [periodAgg, periodOpMov, effectiveRows, valuation.totalUnits, durationDays]);

  // ── Riesgos ──
  const risk = useMemo(() => {
    const bajoMinimo: RiskRow[] = [];
    const sinExistencia: RiskRow[] = [];
    const negativo: RiskRow[] = [];
    const sobrestock: RiskRow[] = [];
    const sinMinimo: RiskRow[] = [];
    const sinCosto: RiskRow[] = [];
    const sinPrecio: RiskRow[] = [];
    const sinBodega: RiskRow[] = [];
    const lento: RiskRow[] = [];
    const conExistencia: RiskRow[] = [];

    for (const r of effectiveRows) {
      if (r.qty > 0) {
        conExistencia.push({ product: r.name, code: r.code, warehouse: r.mainWarehouse, qty: r.qty, minStock: r.minStock, maxStock: null, reason: 'Con existencia disponible' });
      }
      if (r.qty === 0) {
        sinExistencia.push({ product: r.name, code: r.code, warehouse: r.mainWarehouse, qty: 0, minStock: r.minStock, maxStock: null, reason: 'Existencia igual a cero' });
      }
      if (r.qty < 0) {
        negativo.push({ product: r.name, code: r.code, warehouse: r.mainWarehouse, qty: r.qty, minStock: r.minStock, maxStock: null, reason: 'Inventario negativo' });
      }
      if (r.minStock > 0 && r.qty > 0 && r.qty <= r.minStock) {
        bajoMinimo.push({ product: r.name, code: r.code, warehouse: r.mainWarehouse, qty: r.qty, minStock: r.minStock, maxStock: null, reason: 'Bajo el mínimo configurado' });
      }
      if (r.overstock) {
        const lvl = r.levels.find((l) => l.maxStock != null && l.quantity > l.maxStock);
        sobrestock.push({ product: r.name, code: r.code, warehouse: lvl?.warehouseName || r.mainWarehouse, qty: r.qty, minStock: r.minStock, maxStock: lvl?.maxStock ?? null, reason: 'Excede el máximo configurado' });
      }
      if (r.qty > 0 && r.minStock <= 0) {
        sinMinimo.push({ product: r.name, code: r.code, warehouse: r.mainWarehouse, qty: r.qty, minStock: 0, maxStock: null, reason: 'Sin mínimo configurado' });
      }
      if (r.qty > 0 && r.costPrice <= 0) {
        sinCosto.push({ product: r.name, code: r.code, warehouse: r.mainWarehouse, qty: r.qty, minStock: r.minStock, maxStock: null, reason: 'Sin costo registrado' });
      }
      if (r.qty > 0 && r.salePrice <= 0) {
        sinPrecio.push({ product: r.name, code: r.code, warehouse: r.mainWarehouse, qty: r.qty, minStock: r.minStock, maxStock: null, reason: 'Sin precio de venta' });
      }
      if (r.levels.length === 0) {
        sinBodega.push({ product: r.name, code: r.code, warehouse: 'Sin bodega asignada', qty: r.qty, minStock: r.minStock, maxStock: null, reason: 'Producto sin bodega' });
      }
      if (r.qty > 0) {
        const last = lastOutByProduct.get(r.id);
        const days = last ? (nowMs - last) / DAY_MS : null;
        if (days === null || days > 90) {
          lento.push({ product: r.name, code: r.code, warehouse: r.mainWarehouse, qty: r.qty, minStock: r.minStock, maxStock: null, reason: days === null ? 'Sin salidas registradas' : `Sin movimiento en ${Math.floor(days)} días` });
        }
      }
    }

    const uniqueRiskIds = new Set([
      ...bajoMinimo.map((x) => x.code),
      ...sinExistencia.map((x) => x.code),
      ...negativo.map((x) => x.code),
    ]);
    const riesgo = [...bajoMinimo, ...sinExistencia, ...negativo];

    const lento90 = lento.length;
    const sinMovimiento30 = effectiveRows.filter((r) => {
      if (r.qty <= 0) return false;
      const last = lastOutByProduct.get(r.id);
      return last === undefined || (nowMs - last) / DAY_MS > 30;
    }).length;

    return {
      bajoMinimo, sinExistencia, negativo, sobrestock, sinMinimo, sinCosto, sinPrecio, sinBodega, lento, conExistencia,
      riesgo,
      riesgoCount: uniqueRiskIds.size,
      lento90,
      sinMovimiento30,
    };
  }, [effectiveRows, lastOutByProduct, nowMs]);

  const riskGroups: Record<string, { title: string; desc: string; rows: RiskRow[] }> = {
    'existencia': { title: 'Productos con existencia', desc: 'Productos con unidades disponibles al corte.', rows: risk.conExistencia },
    'riesgo': { title: 'Productos en riesgo de abastecimiento', desc: 'Bajo mínimo, sin existencia o con inventario negativo.', rows: risk.riesgo },
    'bajo-minimo': { title: 'Bajo el mínimo configurado', desc: 'Todavía tienen unidades, pero están por debajo del mínimo.', rows: risk.bajoMinimo },
    'sin-existencia': { title: 'Sin existencia', desc: 'Productos con cantidad igual a cero.', rows: risk.sinExistencia },
    'negativo': { title: 'Inventario negativo', desc: 'Indica salidas sin stock, movimientos mal fechados o errores de integración.', rows: risk.negativo },
    'sobrestock': { title: 'Sobrestock', desc: 'Existencias que exceden el máximo configurado.', rows: risk.sobrestock },
    'sin-minimo': { title: 'Sin mínimo configurado', desc: 'No se puede evaluar su reposición.', rows: risk.sinMinimo },
    'sin-costo': { title: 'Productos sin costo', desc: 'Afecta directamente la valorización del inventario.', rows: risk.sinCosto },
    'sin-precio': { title: 'Productos sin precio de venta', desc: 'No se puede calcular el valor potencial de venta.', rows: risk.sinPrecio },
    'lento': { title: 'Lento movimiento (90 días)', desc: 'Sin salidas en los últimos 90 días.', rows: risk.lento },
  };

  // ── Lento movimiento buckets ──
  const slowBuckets = useMemo(() => {
    const buckets = [
      { label: 'Sin movimiento en 30 días', days: 30, count: 0, value: 0 },
      { label: 'Sin movimiento en 60 días', days: 60, count: 0, value: 0 },
      { label: 'Sin movimiento en 90 días', days: 90, count: 0, value: 0 },
      { label: 'Más de 180 días', days: 180, count: 0, value: 0 },
    ];
    for (const r of effectiveRows) {
      if (r.qty <= 0) continue;
      const last = lastOutByProduct.get(r.id);
      const days = last === undefined ? Number.POSITIVE_INFINITY : (nowMs - last) / DAY_MS;
      for (const b of buckets) {
        if (days > b.days) {
          b.count += 1;
          b.value += r.qty * r.costPrice;
        }
      }
    }
    return buckets;
  }, [effectiveRows, lastOutByProduct, nowMs]);

  // ── Per-product metrics (rotation / coverage) ──
  const productMetrics = useMemo(() => {
    const { outs, ins } = periodAgg;
    const map = new Map<string, { outs: number; ins: number; initialQty: number; avgQty: number }>();
    for (const r of effectiveRows) {
      const o = outs.get(r.id) || 0;
      const i = ins.get(r.id) || 0;
      const initialQty = Math.max(0, r.qty + o - i);
      const avgQty = (initialQty + r.qty) / 2;
      map.set(r.id, { outs: o, ins: i, initialQty, avgQty });
    }
    return map;
  }, [effectiveRows, periodAgg]);

  const rotationList = useMemo(() => {
    return effectiveRows.map((r) => {
      const m = productMetrics.get(r.id)!;
      const dailyOut = m.outs / durationDays;
      return {
        ...r,
        outs: m.outs,
        avgQty: m.avgQty,
        rotation: m.outs > 0 && m.avgQty > 0 ? m.outs / m.avgQty : null,
        coverage: r.qty > 0 && dailyOut > 0 ? r.qty / dailyOut : null,
        daysSince: lastOutByProduct.has(r.id) ? (nowMs - lastOutByProduct.get(r.id)!) / DAY_MS : null,
        value: r.qty * r.costPrice,
      };
    });
  }, [effectiveRows, productMetrics, lastOutByProduct, nowMs, durationDays]);

  // ── Mayor valor inmovilizado ──
  const topValued = useMemo(() => rotationList.filter((r) => r.qty > 0).sort((a, b) => b.value - a.value).slice(0, 8), [rotationList]);
  const topAging = useMemo(() => rotationList.filter((r) => r.qty > 0 && r.daysSince !== null).sort((a, b) => (b.daysSince! - a.daysSince!)).slice(0, 8), [rotationList]);
  const topNeverMoved = useMemo(() => rotationList.filter((r) => r.qty > 0 && r.daysSince === null).sort((a, b) => b.value - a.value).slice(0, 8), [rotationList]);
  const topOverstock = useMemo(() => rotationList.filter((r) => r.overstock).sort((a, b) => b.value - a.value).slice(0, 8), [rotationList]);

  // ── Rotación y cobertura lists ──
  const topRotated = useMemo(() => rotationList.filter((r) => r.rotation !== null).sort((a, b) => (b.rotation! - a.rotation!)).slice(0, 8), [rotationList]);
  const leastRotated = useMemo(() => rotationList.filter((r) => r.rotation !== null).sort((a, b) => (a.rotation! - b.rotation!)).slice(0, 8), [rotationList]);
  const leastCoverage = useMemo(() => rotationList.filter((r) => r.coverage !== null).sort((a, b) => (a.coverage! - b.coverage!)).slice(0, 8), [rotationList]);
  const replenishItems = useMemo(() => {
    const items = replenishment?.items || [];
    return items.filter((i: any) => Number(i.suggestedQuantity) > 0 || (i.status && i.status !== 'OK')).sort((a: any, b: any) => Number(b.suggestedQuantity) - Number(a.suggestedQuantity)).slice(0, 8);
  }, [replenishment]);

  // ── Distribución del valor del inventario ──
  const distribution = useMemo(() => {
    const { withStock, totalValue } = valuation;
    if (withStock.length === 0 || totalValue <= 0) return [];

    const segMap = new Map<string, { value: number; units: number; products: Set<string> }>();
    const add = (key: string, value: number, units: number, pid: string) => {
      const seg = segMap.get(key) || { value: 0, units: 0, products: new Set<string>() };
      seg.value += value;
      seg.units += units;
      seg.products.add(pid);
      segMap.set(key, seg);
    };

    if (distMode === 'bodega') {
      for (const r of withStock) {
        const originalTotal = r.levels.reduce((a, l) => a + l.quantity, 0);
        const factor = originalTotal > 0 ? r.qty / originalTotal : 0;
        for (const l of r.levels) {
          if (l.quantity <= 0) continue;
          const q = l.quantity * factor;
          if (q <= 0) continue;
          add(l.warehouseName, q * r.costPrice, q, r.id);
        }
      }
    } else if (distMode === 'marca') {
      for (const r of withStock) add(r.brand || 'Sin marca', r.qty * r.costPrice, r.qty, r.id);
    } else if (distMode === 'rotacion') {
      for (const r of withStock) {
        const m = productMetrics.get(r.id)!;
        const rot = m.outs > 0 && m.avgQty > 0 ? m.outs / m.avgQty : 0;
        const key = rot === 0 ? 'Sin movimiento' : rot >= 6 ? 'Alta rotación' : rot >= 2 ? 'Rotación media' : 'Baja rotación';
        add(key, r.qty * r.costPrice, r.qty, r.id);
      }
    } else {
      for (const r of withStock) add(r.categoryName, r.qty * r.costPrice, r.qty, r.id);
    }

    return [...segMap.entries()]
      .map(([name, seg]) => ({ name, value: seg.value, units: seg.units, products: seg.products.size, pct: totalValue > 0 ? (seg.value / totalValue) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [valuation, distMode, productMetrics]);

  // ── Dinámica de movimientos (agrupación dinámica) ──
  const chartData = useMemo(() => {
    const mode = durationDays >= 120 ? 'month' : durationDays > 31 ? 'week' : 'day';
    const end = new Date();
    let anchor = currentStart.getTime() > 0 ? new Date(currentStart) : new Date(end.getTime() - 730 * DAY_MS);
    const minAnchor = end.getTime() - 730 * DAY_MS;
    if (anchor.getTime() < minAnchor) anchor = new Date(minAnchor);
    if (anchor.getTime() > end.getTime()) anchor = end;

    const buckets: { label: string; start: number; end: number; entradas: number; salidas: number; ajustesPos: number; ajustesNeg: number }[] = [];
    if (mode === 'day') {
      for (let t = anchor.getTime(); t <= end.getTime(); t += DAY_MS) {
        const d = new Date(t);
        buckets.push({ label: `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`, start: t, end: t + DAY_MS, entradas: 0, salidas: 0, ajustesPos: 0, ajustesNeg: 0 });
      }
    } else if (mode === 'week') {
      for (let t = anchor.getTime(); t <= end.getTime(); t += 7 * DAY_MS) {
        const d = new Date(t);
        buckets.push({ label: `Sem. ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`, start: t, end: t + 7 * DAY_MS, entradas: 0, salidas: 0, ajustesPos: 0, ajustesNeg: 0 });
      }
    } else {
      let cursor = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      while (cursor.getTime() <= end.getTime()) {
        const year = cursor.getFullYear();
        const month = cursor.getMonth();
        const label = month === 0 ? `${MONTH_NAMES[month]} ${String(year).slice(2)}` : MONTH_NAMES[month];
        buckets.push({ label, start: new Date(year, month, 1).getTime(), end: new Date(year, month + 1, 1).getTime(), entradas: 0, salidas: 0, ajustesPos: 0, ajustesNeg: 0 });
        cursor = new Date(year, month + 1, 1);
      }
    }

    for (const m of movements) {
      const d = toDate(m.date || m.createdAt);
      if (!d) continue;
      if (d.getTime() < anchor.getTime() || d.getTime() > end.getTime()) continue;
      const idx = buckets.findIndex((b) => d.getTime() >= b.start && d.getTime() < b.end);
      if (idx < 0) continue;
      const qty = Math.abs(Number(m.quantity || 0));
      const isAdj = isAdjustRef(m);
      const isTrf = isTransferRef(m);
      if (isAdj) {
        if (m.type === 'IN') buckets[idx].ajustesPos += qty;
        else buckets[idx].ajustesNeg += qty;
      } else if (!isTrf) {
        if (m.type === 'IN') buckets[idx].entradas += qty;
        else buckets[idx].salidas += qty;
      }
    }
    return buckets;
  }, [movements, currentStart, durationDays]);

  const periodAdjustments = useMemo(() => adjustments.filter((a) => {
    const d = toDate(a.date || a.createdAt);
    return !!d && d.getTime() >= currentStart.getTime();
  }), [adjustments, currentStart]);

  const periodTransfers = useMemo(() => transfers.filter((t) => {
    const d = toDate(t.date || t.createdAt);
    return !!d && d.getTime() >= currentStart.getTime();
  }), [transfers, currentStart]);

  // ── Exports ──
  useImperativeHandle(ref, () => ({
    exportPDF: async () => {
      toast.info("Generando PDF (Inventario)...");
      try {
        const pdfSettings = await getPdfDesignSettings('reportes.inventory');
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
        doc.text('Reporte de Inventario', pageWidth / 2, currentY, { align: 'center' });
        currentY += 6;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text(`${cutoffText(cutoffDate ?? new Date())}  |  Período: ${rangeLabel}  |  Moneda: ${displayCurrency}`, pageWidth / 2, currentY, { align: 'center' });
        currentY += 5;

        doc.setDrawColor(rgbPrimary[0] as any, rgbPrimary[1] as any, rgbPrimary[2] as any);
        doc.setLineWidth(0.8);
        doc.line(marginX, currentY, pageWidth - marginX, currentY);
        currentY += 10;

        const riskStr = `${risk.bajoMinimo.length} bajo mínimo · ${risk.sinExistencia.length} sin existencia · ${risk.negativo.length} negativos`;
        const kpis = [
          { label: 'VALOR DEL INVENTARIO A COSTO', value: formatConvertedAmount(valuation.totalValue, 'NIO'), detail: `${fmtQty(valuation.totalUnits)} unidades · ${valuation.productsWithStock} productos${valuation.withoutCost.length > 0 ? ` · ${valuation.withoutCost.length} sin costo` : ''}`, color: [16, 185, 129] },
          { label: 'PRODUCTOS EN RIESGO', value: risk.riesgoCount.toString(), detail: riskStr, color: [244, 63, 94] },
          { label: 'ROTACIÓN DE INVENTARIO', value: rotation.turnover !== null ? `${rotation.turnover.toFixed(1)}x` : 'N/D', detail: rotation.turnover !== null ? `veces · ${rangeLabel}` : 'datos insuficientes', color: [59, 130, 246] },
          { label: 'VALOR POTENCIAL A PRECIO DE VENTA', value: formatConvertedAmount(potential.totalSaleValue, 'NIO'), detail: 'No representa ingreso ni utilidad', color: [245, 158, 11] }
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
          } catch { /* intentionally empty */ }
        };

        await capture('inventory-dynamics-chart', 80);
        await capture('inventory-distribution-chart', 70);

        const renderTable = (title: string, headers: string[], rows: any[][], accent: [number, number, number]) => {
          checkPage(rows.length * 7 + 30);
          doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 60, 60);
          doc.text(title, marginX, currentY); currentY += 7;
          doc.setFillColor(accent[0], accent[1], accent[2]);
          doc.roundedRect(marginX, currentY, contentWidth, 8, 1, 1, 'F');
          doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
          const colW = contentWidth / headers.length;
          headers.forEach((h, i) => doc.text(h, marginX + i * colW + 2, currentY + 5.5));
          currentY += 10;
          rows.forEach((row, ri) => {
            checkPage(8);
            if (ri % 2 === 0) { doc.setFillColor(248, 249, 250); doc.rect(marginX, currentY - 1, contentWidth, 7, 'F'); }
            doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
            row.forEach((cell, ci) => doc.text(String(cell), marginX + ci * colW + 2, currentY + 4));
            currentY += 7;
          });
          currentY += 10;
        };

        renderTable('Productos con mayor valor inmovilizado', ['Producto', 'Unidades', 'Costo prom.', 'Valor total', 'Participación', 'Días sin mov.', 'Bodega'], topValued.map((p) => [p.name.substring(0, 32), fmtQty(p.qty), formatConvertedAmount(p.costPrice, 'NIO'), formatConvertedAmount(p.value, 'NIO'), `${valuation.totalValue > 0 ? ((p.value / valuation.totalValue) * 100).toFixed(1) : '0'}%`, p.daysSince === null ? 'N/D' : fmtQty(p.daysSince), p.mainWarehouse]), [16, 185, 129]);

        renderTable('Productos con mayor rotación', ['Producto', 'Salidas', 'Stock prom.', 'Rotación', 'Stock actual', 'Cobertura'], topRotated.map((p) => [p.name.substring(0, 32), fmtQty(p.outs), fmtQty(p.avgQty), p.rotation !== null ? `${p.rotation.toFixed(1)}x` : 'N/D', fmtQty(p.qty), p.coverage !== null ? `${Math.round(p.coverage)} días` : 'N/D']), [59, 130, 246]);

        renderTable('Reposición sugerida', ['Producto', 'Bodega', 'Actual', 'Mínimo', 'Sugerido', 'Estado'], replenishItems.map((i: any) => [String(i.productName || '').substring(0, 32), i.warehouseName, fmtQty(i.currentStock), fmtQty(i.minStock), fmtQty(i.suggestedQuantity), i.status || '']), [245, 158, 11]);

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

        ws.columns = [
          { width: 32 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 22 },
        ];

        let currentRow = 1;

        if (themeConfig.logo) {
          const base64Logo = await getBase64Image(themeConfig.logo);
          if (base64Logo) {
            const logoId = wb.addImage({ base64: base64Logo, extension: 'png' });
            ws.addImage(logoId, { tl: { col: 1.5, row: 0 }, ext: { width: 100, height: 100 } });
            currentRow = 6;
          }
        }

        ws.mergeCells(`A${currentRow}:G${currentRow}`);
        const cName = ws.getCell(`A${currentRow}`);
        cName.value = companyName;
        cName.font = { size: 18, bold: true, color: { argb: `FF${hexColor}` } };
        cName.alignment = { horizontal: 'center' };
        currentRow++;

        ws.mergeCells(`A${currentRow}:G${currentRow}`);
        const cTitle = ws.getCell(`A${currentRow}`);
        cTitle.value = 'Reporte de Inventario';
        cTitle.font = { size: 13, bold: true };
        cTitle.alignment = { horizontal: 'center' };
        currentRow++;

        ws.mergeCells(`A${currentRow}:G${currentRow}`);
        const cMeta = ws.getCell(`A${currentRow}`);
        cMeta.value = `${cutoffText(cutoffDate ?? new Date())}  |  Período: ${rangeLabel}  |  Moneda: ${displayCurrency} (${currencySymbol})`;
        cMeta.font = { size: 10, italic: true, color: { argb: 'FF888888' } };
        cMeta.alignment = { horizontal: 'center' };
        currentRow += 2;

        const riskStr = `${risk.bajoMinimo.length} bajo mínimo · ${risk.sinExistencia.length} sin existencia · ${risk.negativo.length} negativos`;
        const kpiBoxes = [
          { label: 'VALOR DEL INVENTARIO A COSTO', value: formatConvertedAmount(valuation.totalValue, 'NIO'), detail: `${fmtQty(valuation.totalUnits)} unidades · ${valuation.productsWithStock} productos`, bgColor: 'FF10B981' },
          { label: 'PRODUCTOS EN RIESGO', value: risk.riesgoCount.toString(), detail: riskStr, bgColor: 'FFF43F5E' },
          { label: 'ROTACIÓN DE INVENTARIO', value: rotation.turnover !== null ? `${rotation.turnover.toFixed(1)}x` : 'N/D', detail: rotation.turnover !== null ? `veces · ${rangeLabel}` : 'datos insuficientes', bgColor: 'FF3B82F6' },
          { label: 'VALOR POTENCIAL A PRECIO DE VENTA', value: formatConvertedAmount(potential.totalSaleValue, 'NIO'), detail: 'No representa ingreso ni utilidad', bgColor: 'FFF59E0B' },
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
        const writeTable = (title: string, headers: string[], rows: any[][], accent: string) => {
          ws.addRow([title, '', '', '', '', '', '']);
          ws.mergeCells(`A${ws.rowCount}:G${ws.rowCount}`);
          ws.getCell(`A${ws.rowCount}`).font = { bold: true, size: 14, color: { argb: accent } };
          ws.getCell(`A${ws.rowCount}`).alignment = { horizontal: 'center' };
          ws.addRow([]);
          const headerRow = ws.addRow(headers);
          headerRow.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accent } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
          });
          rows.forEach((row, idx) => {
            const r = ws.addRow(row);
            r.eachCell((cell) => {
              cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
              if (idx % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            });
          });
          ws.addRow([]); ws.addRow([]);
        };

        writeTable('Productos con mayor valor inmovilizado', ['Producto', 'Unidades', 'Costo prom.', 'Valor total', 'Participación', 'Días sin mov.', 'Bodega'], topValued.map((p) => [p.name, fmtQty(p.qty), p.costPrice, p.value, `${valuation.totalValue > 0 ? ((p.value / valuation.totalValue) * 100).toFixed(1) : '0'}%`, p.daysSince === null ? 'N/D' : fmtQty(p.daysSince), p.mainWarehouse]), 'FF10B981');
        writeTable('Productos con mayor rotación', ['Producto', 'Salidas', 'Stock prom.', 'Rotación', 'Stock actual', 'Cobertura'], topRotated.map((p) => [p.name, fmtQty(p.outs), fmtQty(p.avgQty), p.rotation !== null ? `${p.rotation.toFixed(1)}x` : 'N/D', fmtQty(p.qty), p.coverage !== null ? `${Math.round(p.coverage)} días` : 'N/D']), 'FF3B82F6');
        writeTable('Reposición sugerida', ['Producto', 'Bodega', 'Actual', 'Mínimo', 'Sugerido', 'Estado'], replenishItems.map((i: any) => [i.productName, i.warehouseName, fmtQty(i.currentStock), fmtQty(i.minStock), fmtQty(i.suggestedQuantity), i.status || '']), 'FFF59E0B');

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

  const activeRisk = riskGroup ? riskGroups[riskGroup] : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* ═══ Cabecera de corte ═══ */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
          {cutoffText(cutoffDate ?? new Date())} · Período de análisis: <span className="text-primary">{rangeLabel}</span>
        </p>
        <p className="text-[10px] text-muted-foreground">Valores expresados en {displayCurrency} ({currencySymbol})</p>
      </div>

      {/* ═══ Corte mensual e importación ═══ */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <div className="flex items-center gap-1.5">
          <CalendarClock className="size-3.5 text-muted-foreground" />
          <Select value={monthCutoff || '__none'} onValueChange={(v) => setMonthCutoff(v === '__none' ? '' : v)}>
            <SelectTrigger size="sm" className="h-8 w-[190px] text-[11px]">
              <SelectValue placeholder="Sin corte (actual)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Sin corte (actual)</SelectItem>
              {monthOptions.map((mo) => <SelectItem key={mo.value} value={mo.value}>{mo.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => { setImportMonth(monthCutoff || currentMonthYM()); setImportOpen(true); }}>
          <Upload className="size-4" /> Importar inventario
        </Button>
        {cutoffDate && (
          <Badge variant="secondary" className="h-6 gap-1 text-[10px] font-bold">
            <CalendarClock className="size-3" /> {cutoffText(cutoffDate)}
          </Badge>
        )}
      </div>

      {/* ═══ KPI Cards ═══ */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Valor del inventario a costo */}
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Warehouse className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <DollarSign className="size-3.5 text-emerald-500" /> Valor del inventario a costo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-emerald-500">{formatConvertedAmount(valuation.totalValue, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {fmtQty(valuation.totalUnits)} unidades · {valuation.productsWithStock} productos con existencia{valuationModeSuffix ? ` · Vista ${valuationModeLabel.toLowerCase()}` : ''}
            </p>
            {valuation.status === 'PARTIAL' && (
              <p className="text-[10px] font-bold text-amber-500 mt-1">
                Calculado parcialmente · {valuation.withoutCost.length} productos sin costo registrado
              </p>
            )}
            {valuation.status === 'UNAVAILABLE' && (
              <p className="text-[10px] font-bold text-amber-500 mt-1">Sin existencias valorizadas</p>
            )}
          </CardContent>
        </Card>

        {/* Productos en riesgo de abastecimiento */}
        <button type="button" onClick={() => setRiskGroup('riesgo')} className="text-left">
          <Card className="border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all cursor-pointer h-full">
            <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><ShieldAlert className="size-10" /></div>
            <CardHeader className="pb-1">
              <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Package className="size-3.5 text-rose-500" /> Productos en riesgo de abastecimiento
                {risk.riesgoCount > 0 && (
                  <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-rose-500/10 text-rose-500 animate-pulse">
                    ALERTA
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-black text-rose-500">{risk.riesgoCount}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {risk.bajoMinimo.length} bajo mínimo · {risk.sinExistencia.length} sin existencia
                {risk.negativo.length > 0 && ` · ${risk.negativo.length} negativos`}
              </p>
              <p className="text-[9px] text-muted-foreground/70 mt-1">Clic para ver el listado detallado</p>
            </CardContent>
          </Card>
        </button>

        {/* Rotación de inventario */}
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingDown className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="size-3.5 text-blue-500" /> Rotación de inventario
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rotation.turnover !== null ? (
              <>
                <p className="text-xl font-black text-blue-500">{rotation.turnover.toFixed(1)} veces</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Costo de ventas ÷ inventario promedio · {rangeLabel}</p>
              </>
            ) : (
              <>
                <p className="text-xl font-black text-blue-500">N/D</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Datos insuficientes — sin consumo o inventario promedio válido en el período</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Valor potencial a precio de venta */}
        <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent relative overflow-hidden group hover:shadow-lg transition-all">
          <div className="absolute top-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity"><Tag className="size-10" /></div>
          <CardHeader className="pb-1">
            <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
              <Scale className="size-3.5 text-amber-500" /> Valor potencial a precio de venta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-black text-amber-500">{formatConvertedAmount(potential.totalSaleValue, 'NIO')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Existencia × precio vigente — no representa ingreso ni utilidad hasta vender</p>
            {potential.margin !== null ? (
              <p className="text-[10px] font-bold text-emerald-500 mt-1">Margen bruto potencial: {formatConvertedAmount(potential.margin, 'NIO')}</p>
            ) : (
              <p className="text-[10px] text-muted-foreground/70 mt-1">Margen no calculable: hay productos sin costo o sin precio</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Franja operativa ═══ */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {[
          { key: 'existencia', label: 'Con existencia', value: valuation.productsWithStock, color: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' },
          { key: 'sin-existencia', label: 'Sin existencia', value: risk.sinExistencia.length, color: 'text-slate-400 border-slate-400/20 bg-slate-400/5' },
          { key: 'lento', label: 'Lento movimiento (90d)', value: risk.lento90, color: 'text-orange-500 border-orange-500/20 bg-orange-500/5' },
          { key: 'sobrestock', label: 'Sobrestock', value: risk.sobrestock.length, color: 'text-purple-500 border-purple-500/20 bg-purple-500/5' },
          { key: 'sin-costo', label: 'Sin costo', value: risk.sinCosto.length, color: 'text-amber-500 border-amber-500/20 bg-amber-500/5' },
          { key: 'sin-precio', label: 'Sin precio', value: risk.sinPrecio.length, color: 'text-blue-500 border-blue-500/20 bg-blue-500/5' },
          { key: 'negativo', label: 'Inventario negativo', value: risk.negativo.length, color: risk.negativo.length > 0 ? 'text-rose-500 border-rose-500/40 bg-rose-500/10' : 'text-slate-500 border-slate-500/20 bg-slate-500/5' },
        ].map((chip) => (
          <button key={chip.key} type="button" onClick={() => setRiskGroup(chip.key)}
            className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition-colors hover:opacity-80 ${chip.color}`}>
            <span className="text-[10px] font-black uppercase tracking-wider">{chip.label}</span>
            <span className="text-sm font-black">{chip.value}</span>
          </button>
        ))}
      </div>

      {/* ═══ Charts Row ═══ */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Dinámica de movimientos + Ajustes + Transferencias */}
        <Card id="inventory-dynamics-chart" className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <ArrowUpRight className="size-4 text-primary" /> Entradas, salidas y ajustes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={movTab} onValueChange={setMovTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
                <TabsTrigger value="ajustes">Ajustes y mermas</TabsTrigger>
                <TabsTrigger value="transferencias">Transferencias</TabsTrigger>
              </TabsList>

              <TabsContent value="movimientos" className="mt-0">
                <div className="h-[300px] w-full">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 600 }} interval={chartData.length > 14 ? Math.floor(chartData.length / 14) : 0} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => fmtQty(v)} />
                        <Tooltip cursor={{ stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4' }} contentStyle={{ borderRadius: 10, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} formatter={(v: any) => `${fmtQty(v)} ud`} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700, color: 'hsl(var(--foreground))' }} />
                        <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="salidas" name="Salidas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="ajustesPos" name="Ajustes +" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="ajustesNeg" name="Ajustes −" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-[10px] text-muted-foreground uppercase font-black tracking-widest">Sin movimientos en el período</div>
                  )}
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Agrupación {durationDays <= 31 ? 'diaria' : durationDays <= 120 ? 'semanal' : 'mensual'} según el rango seleccionado. Las transferencias internas entre bodegas no afectan el consolidado y no se mezclan con entradas/salidas.
                </p>
              </TabsContent>

              <TabsContent value="ajustes" className="mt-0">
                {periodAdjustments.length === 0 ? (
                  <div className="h-[200px] flex items-center justify-center text-[10px] text-muted-foreground uppercase font-black tracking-widest">Sin ajustes registrados en el período</div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border/40">
                    <table className="w-full min-w-[640px]">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className={TH}>Número</th>
                          <th className={TH}>Fecha</th>
                          <th className={TH}>Motivo</th>
                          <th className={TH}>Bodega</th>
                          <th className={TH}>Unidades afectadas</th>
                          <th className={TH}>Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {periodAdjustments.slice(0, 12).map((a: any) => {
                          const units = (a.items || []).reduce((acc: number, it: any) => acc + Math.abs(Number(it.actualStock || 0) - Number(it.currentStock || 0)), 0);
                          return (
                            <tr key={a.id} className="hover:bg-muted/30">
                              <td className={`${TD} font-bold`}>{a.number}</td>
                              <td className={TD}>{toDate(a.date || a.createdAt)?.toLocaleDateString('es-NI')}</td>
                              <td className={`${TD} max-w-[220px] truncate`}>{a.reason || '—'}</td>
                              <td className={TD}>{a.warehouse?.name || '—'}</td>
                              <td className={`${TD} font-bold`}>{fmtQty(units)}</td>
                              <td className={TD}>
                                <Badge variant={a.status === 'APPROVED' ? 'default' : a.status === 'REJECTED' ? 'destructive' : 'outline'} className="text-[9px]">
                                  {a.status || 'PENDIENTE'}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="transferencias" className="mt-0">
                {periodTransfers.length === 0 ? (
                  <div className="h-[200px] flex items-center justify-center text-[10px] text-muted-foreground uppercase font-black tracking-widest">Sin transferencias en el período</div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border/40">
                    <table className="w-full min-w-[640px]">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className={TH}>Número</th>
                          <th className={TH}>Fecha</th>
                          <th className={TH}>Origen</th>
                          <th className={TH}>Destino</th>
                          <th className={TH}>Líneas</th>
                          <th className={TH}>Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {periodTransfers.slice(0, 12).map((t: any) => (
                          <tr key={t.id} className="hover:bg-muted/30">
                            <td className={`${TD} font-bold`}>{t.number}</td>
                            <td className={TD}>{toDate(t.date || t.createdAt)?.toLocaleDateString('es-NI')}</td>
                            <td className={TD}>{t.from?.name || '—'}</td>
                            <td className={TD}>{t.to?.name || '—'}</td>
                            <td className={`${TD} font-bold`}>{(t.items || []).length}</td>
                            <td className={TD}>
                              <Badge variant={t.status === 'COMPLETED' ? 'default' : t.status === 'CANCELLED' ? 'destructive' : t.status === 'IN_TRANSIT' ? 'secondary' : 'outline'} className="text-[9px]">
                                {t.status || 'PENDING'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Distribución del valor del inventario */}
        <Card id="inventory-distribution-chart" className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Layers className="size-4 text-primary" /> Distribución del valor del inventario
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="flex flex-wrap gap-1.5">
              {(['categoria', 'bodega', 'marca', 'rotacion'] as const).map((mode) => (
                <button key={mode} type="button" onClick={() => setDistMode(mode)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${distMode === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground bg-muted/40'}`}>
                  {mode === 'categoria' ? 'Categoría' : mode === 'bodega' ? 'Bodega' : mode === 'marca' ? 'Marca' : 'Rotación'}
                </button>
              ))}
            </div>

            {distribution.length > 0 ? (
              <>
                <div className="h-[190px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={distribution} innerRadius={48} outerRadius={70} paddingAngle={4} dataKey="value" nameKey="name">
                        {distribution.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} formatter={(v: any, name: any) => [formatConvertedAmount(v, 'NIO'), name]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {distribution.slice(0, 8).map((seg, idx) => (
                    <div key={seg.name} className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-1.5">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="size-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold truncate">{seg.name}</p>
                          <p className="text-[9px] text-muted-foreground">{fmtQty(seg.units)} ud · {seg.products} productos</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] font-black">{formatConvertedAmount(seg.value, 'NIO')}</p>
                        <p className="text-[9px] text-muted-foreground">{seg.pct.toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-center text-[10px] text-muted-foreground uppercase font-black tracking-widest leading-relaxed">
                No es posible distribuir el valor<br />porque no existen existencias valorizadas
              </div>
            )}

            <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-500/10">
                <Package className="size-4 text-indigo-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-indigo-500 uppercase">Resumen de existencias</p>
                <p className="text-[10px] text-muted-foreground">
                  {valuation.productsWithStock} productos con existencia · {risk.sinExistencia.length} sin existencia · {risk.bajoMinimo.length} bajo mínimo
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Top Lists ═══ */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Productos con mayor valor inmovilizado */}
        <Card className="border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <DollarSign className="size-4 text-emerald-500" /> Productos con mayor valor inmovilizado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={valTab} onValueChange={setValTab}>
              <TabsList className="mb-3">
                <TabsTrigger value="mayor-valor">Mayor valor</TabsTrigger>
                <TabsTrigger value="antiguedad">Mayor antigüedad</TabsTrigger>
                <TabsTrigger value="sin-movimiento">Sin movimiento</TabsTrigger>
                <TabsTrigger value="sobrestock">Sobrestock</TabsTrigger>
              </TabsList>
              <TabsContent value="mayor-valor" className="mt-0">
                {topValued.length === 0 ? <EmptyTable /> : (
                  <div className="overflow-x-auto rounded-xl border border-border/40">
                    <table className="w-full min-w-[680px]">
                      <thead className="bg-emerald-500/5">
                        <tr>
                          <th className={TH}>Producto</th>
                          <th className={TH}>Unid.</th>
                          <th className={TH}>Costo prom.</th>
                          <th className={TH}>Valor total</th>
                          <th className={TH}>Part.</th>
                          <th className={TH}>Días s/mov</th>
                          <th className={TH}>Bodega</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {topValued.map((p) => (
                          <tr key={p.id} className="hover:bg-emerald-500/5">
                            <td className={`${TD} font-bold max-w-[180px]`}>
                              <span className="block truncate">{p.name}</span>
                              <span className="block text-[9px] text-muted-foreground font-normal">{p.code}</span>
                            </td>
                            <td className={`${TD} font-bold`}>{fmtQty(p.qty)}</td>
                            <td className={TD}>{formatConvertedAmount(p.costPrice, 'NIO')}</td>
                            <td className={`${TD} font-black text-emerald-500`}>{formatConvertedAmount(p.value, 'NIO')}</td>
                            <td className={TD}>{valuation.totalValue > 0 ? ((p.value / valuation.totalValue) * 100).toFixed(1) : '0'}%</td>
                            <td className={TD}>{p.daysSince === null ? <Badge variant="outline" className="text-[9px] text-orange-500">N/D</Badge> : fmtQty(p.daysSince)}</td>
                            <td className={`${TD} text-muted-foreground`}>{p.mainWarehouse}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="antiguedad" className="mt-0">
                {topAging.length === 0 ? <EmptyTable /> : (
                  <div className="overflow-x-auto rounded-xl border border-border/40">
                    <table className="w-full min-w-[680px]">
                      <thead className="bg-orange-500/5">
                        <tr>
                          <th className={TH}>Producto</th>
                          <th className={TH}>Unid.</th>
                          <th className={TH}>Valor total</th>
                          <th className={TH}>Días sin movimiento</th>
                          <th className={TH}>Bodega</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {topAging.map((p) => (
                          <tr key={p.id} className="hover:bg-orange-500/5">
                            <td className={`${TD} font-bold max-w-[220px]`}>
                              <span className="block truncate">{p.name}</span>
                              <span className="block text-[9px] text-muted-foreground font-normal">{p.code}</span>
                            </td>
                            <td className={`${TD} font-bold`}>{fmtQty(p.qty)}</td>
                            <td className={`${TD} font-black text-orange-500`}>{formatConvertedAmount(p.value, 'NIO')}</td>
                            <td className={TD}>
                              <Badge variant={p.daysSince !== null && p.daysSince > 180 ? 'destructive' : 'outline'} className="text-[9px]">
                                {fmtQty(p.daysSince)} días
                              </Badge>
                            </td>
                            <td className={`${TD} text-muted-foreground`}>{p.mainWarehouse}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="sin-movimiento" className="mt-0">
                {topNeverMoved.length === 0 ? <EmptyTable /> : (
                  <div className="overflow-x-auto rounded-xl border border-border/40">
                    <table className="w-full min-w-[680px]">
                      <thead className="bg-slate-500/5">
                        <tr>
                          <th className={TH}>Producto</th>
                          <th className={TH}>Unid.</th>
                          <th className={TH}>Valor total</th>
                          <th className={TH}>Última salida</th>
                          <th className={TH}>Bodega</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {topNeverMoved.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-500/5">
                            <td className={`${TD} font-bold max-w-[220px]`}>
                              <span className="block truncate">{p.name}</span>
                              <span className="block text-[9px] text-muted-foreground font-normal">{p.code}</span>
                            </td>
                            <td className={`${TD} font-bold`}>{fmtQty(p.qty)}</td>
                            <td className={`${TD} font-black`}>{formatConvertedAmount(p.value, 'NIO')}</td>
                            <td className={TD}><Badge variant="destructive" className="text-[9px]">Sin salidas registradas</Badge></td>
                            <td className={`${TD} text-muted-foreground`}>{p.mainWarehouse}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="sobrestock" className="mt-0">
                {topOverstock.length === 0 ? <EmptyTable /> : (
                  <div className="overflow-x-auto rounded-xl border border-border/40">
                    <table className="w-full min-w-[680px]">
                      <thead className="bg-purple-500/5">
                        <tr>
                          <th className={TH}>Producto</th>
                          <th className={TH}>Actual</th>
                          <th className={TH}>Máximo</th>
                          <th className={TH}>Valor total</th>
                          <th className={TH}>Bodega</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {topOverstock.map((p) => {
                          const lvl = p.levels.find((l: any) => l.maxStock != null && l.quantity > l.maxStock);
                          return (
                            <tr key={p.id} className="hover:bg-purple-500/5">
                              <td className={`${TD} font-bold max-w-[220px]`}>
                                <span className="block truncate">{p.name}</span>
                                <span className="block text-[9px] text-muted-foreground font-normal">{p.code}</span>
                              </td>
                              <td className={`${TD} font-bold text-purple-500`}>{fmtQty(p.qty)}</td>
                              <td className={TD}>{lvl ? fmtQty(lvl.maxStock) : '—'}</td>
                              <td className={`${TD} font-black`}>{formatConvertedAmount(p.value, 'NIO')}</td>
                              <td className={`${TD} text-muted-foreground`}>{lvl?.warehouseName || p.mainWarehouse}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Rotación y cobertura */}
        <Card className="border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
              <Gauge className="size-4 text-blue-500" /> Rotación y cobertura de productos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={rotTab} onValueChange={setRotTab}>
              <TabsList className="mb-3">
                <TabsTrigger value="mayor-rotacion">Mayor rotación</TabsTrigger>
                <TabsTrigger value="menor-rotacion">Menor rotación</TabsTrigger>
                <TabsTrigger value="menor-cobertura">Menor cobertura</TabsTrigger>
                <TabsTrigger value="reposicion">Reposición sugerida</TabsTrigger>
              </TabsList>

              <TabsContent value="mayor-rotacion" className="mt-0">
                {topRotated.length === 0 ? <EmptyTable /> : (
                  <div className="overflow-x-auto rounded-xl border border-border/40">
                    <table className="w-full min-w-[680px]">
                      <thead className="bg-blue-500/5">
                        <tr>
                          <th className={TH}>Producto</th>
                          <th className={TH}>Salidas</th>
                          <th className={TH}>Stock prom.</th>
                          <th className={TH}>Rotación</th>
                          <th className={TH}>Stock actual</th>
                          <th className={TH}>Cobertura</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {topRotated.map((p) => (
                          <tr key={p.id} className="hover:bg-blue-500/5">
                            <td className={`${TD} font-bold max-w-[200px]`}>
                              <span className="block truncate">{p.name}</span>
                              <span className="block text-[9px] text-muted-foreground font-normal">{p.code}</span>
                            </td>
                            <td className={`${TD} font-bold`}>{fmtQty(p.outs)} ud</td>
                            <td className={TD}>{fmtQty(p.avgQty)} ud</td>
                            <td className={`${TD} font-black text-blue-500`}>{p.rotation!.toFixed(1)}x</td>
                            <td className={TD}>{fmtQty(p.qty)} ud</td>
                            <td className={TD}>{p.coverage !== null ? `${Math.round(p.coverage)} días` : 'N/D'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="menor-rotacion" className="mt-0">
                {leastRotated.length === 0 ? <EmptyTable /> : (
                  <div className="overflow-x-auto rounded-xl border border-border/40">
                    <table className="w-full min-w-[680px]">
                      <thead className="bg-orange-500/5">
                        <tr>
                          <th className={TH}>Producto</th>
                          <th className={TH}>Salidas</th>
                          <th className={TH}>Stock prom.</th>
                          <th className={TH}>Rotación</th>
                          <th className={TH}>Stock actual</th>
                          <th className={TH}>Cobertura</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {leastRotated.map((p) => (
                          <tr key={p.id} className="hover:bg-orange-500/5">
                            <td className={`${TD} font-bold max-w-[200px]`}>
                              <span className="block truncate">{p.name}</span>
                              <span className="block text-[9px] text-muted-foreground font-normal">{p.code}</span>
                            </td>
                            <td className={`${TD} font-bold`}>{fmtQty(p.outs)} ud</td>
                            <td className={TD}>{fmtQty(p.avgQty)} ud</td>
                            <td className={`${TD} font-black text-orange-500`}>{p.rotation!.toFixed(1)}x</td>
                            <td className={TD}>{fmtQty(p.qty)} ud</td>
                            <td className={TD}>{p.coverage !== null ? `${Math.round(p.coverage)} días` : 'N/D'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="menor-cobertura" className="mt-0">
                {leastCoverage.length === 0 ? <EmptyTable /> : (
                  <div className="overflow-x-auto rounded-xl border border-border/40">
                    <table className="w-full min-w-[680px]">
                      <thead className="bg-rose-500/5">
                        <tr>
                          <th className={TH}>Producto</th>
                          <th className={TH}>Stock actual</th>
                          <th className={TH}>Cobertura</th>
                          <th className={TH}>Consumo diario</th>
                          <th className={TH}>Rotación</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {leastCoverage.map((p) => {
                          const m = productMetrics.get(p.id)!;
                          return (
                            <tr key={p.id} className="hover:bg-rose-500/5">
                              <td className={`${TD} font-bold max-w-[220px]`}>
                                <span className="block truncate">{p.name}</span>
                                <span className="block text-[9px] text-muted-foreground font-normal">{p.code}</span>
                              </td>
                              <td className={`${TD} font-bold`}>{fmtQty(p.qty)} ud</td>
                              <td className={`${TD} font-black text-rose-500`}>{Math.round(p.coverage!)} días</td>
                              <td className={TD}>{fmtQty(m.outs / durationDays)} ud/día</td>
                              <td className={TD}>{p.rotation !== null ? `${p.rotation.toFixed(1)}x` : 'N/D'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="reposicion" className="mt-0">
                {replenishItems.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-[10px] text-muted-foreground uppercase font-black tracking-widest leading-relaxed text-center">
                    Sin productos a reponer<br />en el período de reposición
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border/40">
                    <table className="w-full min-w-[680px]">
                      <thead className="bg-amber-500/5">
                        <tr>
                          <th className={TH}>Producto</th>
                          <th className={TH}>Bodega</th>
                          <th className={TH}>Actual</th>
                          <th className={TH}>Mínimo</th>
                          <th className={TH}>Sugerido</th>
                          <th className={TH}>Demanda/día</th>
                          <th className={TH}>Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {replenishItems.map((i: any, idx: number) => (
                          <tr key={`${i.productId}-${i.warehouseId}-${idx}`} className="hover:bg-amber-500/5">
                            <td className={`${TD} font-bold max-w-[200px]`}>
                              <span className="block truncate">{i.productName}</span>
                              <span className="block text-[9px] text-muted-foreground font-normal">{i.productCode}</span>
                            </td>
                            <td className={`${TD} text-muted-foreground`}>{i.warehouseName}</td>
                            <td className={`${TD} font-bold`}>{fmtQty(i.currentStock)}</td>
                            <td className={TD}>{fmtQty(i.minStock)}</td>
                            <td className={`${TD} font-black text-amber-500`}>{fmtQty(i.suggestedQuantity)}</td>
                            <td className={TD}>{fmtQty(i.averageDailyDemand)}</td>
                            <td className={TD}>
                              <Badge variant={i.status === 'OUT_OF_STOCK' ? 'destructive' : i.status === 'LOW_STOCK' ? 'default' : 'outline'} className="text-[9px]">
                                {i.status || '—'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-blue-500/5 border border-blue-500/10 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Lento movimiento (90 días)</p>
                <p className="text-lg font-black text-blue-500">{risk.lento90} productos</p>
                <p className="text-[9px] text-muted-foreground">{formatConvertedAmount(slowBuckets[2]?.value || 0, 'NIO')} inmovilizado</p>
              </div>
              <div className="rounded-xl bg-indigo-500/5 border border-indigo-500/10 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cobertura promedio</p>
                <p className="text-lg font-black text-indigo-500">{rotation.avgCoverage !== null ? `${Math.round(rotation.avgCoverage)} días` : 'N/D'}</p>
                <p className="text-[9px] text-muted-foreground">Stock actual ÷ consumo diario del período</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══ Modal de riesgo ═══ */}
      <Dialog open={!!activeRisk} onOpenChange={(open) => { if (!open) setRiskGroup(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-rose-500" /> {activeRisk?.title}
            </DialogTitle>
            <p className="text-[11px] text-muted-foreground">{activeRisk?.desc}</p>
          </DialogHeader>
          {activeRisk && activeRisk.rows.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-[10px] text-muted-foreground uppercase font-black tracking-widest">Nada que reportar aquí</div>
          ) : activeRisk ? (
            <div className="overflow-y-auto overflow-x-auto rounded-xl border border-border/40">
              <table className="w-full min-w-[640px]">
                <thead className="bg-rose-500/5 sticky top-0">
                  <tr>
                    <th className={TH}>Producto</th>
                    <th className={TH}>Código</th>
                    <th className={TH}>Bodega</th>
                    <th className={TH}>Actual</th>
                    <th className={TH}>Mínimo</th>
                    <th className={TH}>Máximo</th>
                    <th className={TH}>Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {activeRisk.rows.slice(0, 80).map((r, idx) => (
                    <tr key={`${r.code}-${idx}`} className="hover:bg-muted/30">
                      <td className={`${TD} font-bold max-w-[200px]`}>
                        <span className="block truncate">{r.product}</span>
                      </td>
                      <td className={`${TD} font-mono text-[10px]`}>{r.code}</td>
                      <td className={`${TD} text-muted-foreground`}>{r.warehouse}</td>
                      <td className={`${TD} font-black ${r.qty < 0 ? 'text-rose-500' : ''}`}>{fmtQty(r.qty)}</td>
                      <td className={TD}>{fmtQty(r.minStock)}</td>
                      <td className={TD}>{r.maxStock != null ? fmtQty(r.maxStock) : '—'}</td>
                      <td className={`${TD} text-muted-foreground max-w-[220px] truncate`}>{r.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ═══ Modal de importación de inventario por mes ═══ */}
      <Dialog open={importOpen} onOpenChange={(open) => { if (!open && !importing) { setImportOpen(false); setImportRows([]); setImportFileName(''); } }}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] !max-w-[min(92vw,760px)] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="size-4 text-primary" /> Importar inventario por mes
            </DialogTitle>
            <DialogDescription>
              Carga las existencias físicas de un almacén al corte del mes: por cada diferencia se crea un ajuste de inventario que deja el stock exacto en la cantidad reportada.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mes del corte</Label>
              <Select value={importMonth} onValueChange={setImportMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthOptions.map((mo) => <SelectItem key={mo.value} value={mo.value}>{mo.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Almacén</Label>
              <Select value={importWarehouse} onValueChange={setImportWarehouse}>
                <SelectTrigger><SelectValue placeholder="Selecciona un almacén" /></SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {warehouses.length === 0 && (
                <p className="text-[10px] text-amber-600">No se encontraron almacenes con existencias en el catálogo.</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={downloadImportTemplate}>
              <Download className="size-4" /> Descargar plantilla (.xlsx)
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => importFileRef.current?.click()}>
              <Upload className="size-4" /> Subir archivo
            </Button>
            <input ref={importFileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportFile(f);
                e.target.value = '';
              }} />
            {importFileName && <p className="text-[10px] text-muted-foreground">{importFileName}</p>}
          </div>

          {importRows.length > 0 && (
            <div className="space-y-3">
              <ImportReviewSummary total={importPreview.length} valid={importValidCount} skipped={importPreview.length - importValidCount} entityLabel="productos" />
              <div className="hidden max-h-60 overflow-y-auto overflow-x-auto rounded-xl border border-border/40 sm:block">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr>
                      <th className={TH}>Código</th>
                      <th className={TH}>Producto</th>
                      <th className={TH}>Cantidad</th>
                      <th className={TH}>Stock actual</th>
                      <th className={TH}>Diferencia</th>
                      <th className={TH}>Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {importPreview.slice(0, 0).map((r) => (
                      <tr key={r.row} className={r.error ? 'bg-rose-500/5' : 'hover:bg-muted/30'}>
                        <td className={`${TD} font-mono text-[10px]`}>{r.rawCode || '—'}</td>
                        <td className={`${TD} font-bold max-w-[200px]`}>
                          <span className="block truncate">{r.productName || '—'}</span>
                        </td>
                        <td className={`${TD} font-bold`}>{fmtQty(r.qty)}</td>
                        <td className={TD}>{r.error ? '—' : fmtQty(r.currentStock)}</td>
                        <td className={`${TD} font-black ${r.error ? 'text-muted-foreground' : r.difference > 0 ? 'text-emerald-500' : r.difference < 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>
                          {r.error ? '—' : fmtQty(r.difference)}
                        </td>
                        <td className={TD}>
                          {r.error ? (
                            <Badge variant="destructive" className="text-[9px]">{r.error}</Badge>
                          ) : (
                            <Badge className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Válida</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <VirtualizedImportList count={importPreview.length} estimateSize={38} className="h-60 min-w-[640px]" renderItem={(index) => {
                  const r = importPreview[index];
                  return <div className={`grid min-w-[640px] grid-cols-[1.1fr_2fr_0.8fr_1fr_1fr_1.4fr] items-center border-t border-border/40 text-xs ${r.error ? 'bg-rose-500/5' : 'hover:bg-muted/30'}`}>
                    <div className={`${TD} font-mono text-[10px]`}>{r.rawCode || '—'}</div>
                    <div className={`${TD} truncate font-bold`} title={r.productName}>{r.productName || '—'}</div>
                    <div className={`${TD} font-bold`}>{fmtQty(r.qty)}</div>
                    <div className={TD}>{r.error ? '—' : fmtQty(r.currentStock)}</div>
                    <div className={`${TD} font-black ${r.error ? 'text-muted-foreground' : r.difference > 0 ? 'text-emerald-500' : r.difference < 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>{r.error ? '—' : fmtQty(r.difference)}</div>
                    <div className={TD}>{r.error ? <Badge variant="destructive" className="text-[9px]">{r.error}</Badge> : <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[9px] text-emerald-600">Válida</Badge>}</div>
                  </div>;
                }} />
              </div>
              <section className="space-y-3 sm:hidden" aria-label="Ajustes de inventario para revisar">
                <div className="flex items-center justify-between gap-2 rounded-xl border bg-muted/20 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Revisión móvil</p>
                  <Badge variant="secondary" className="text-[10px]">{importPreview.length} filas</Badge>
                </div>
                {importPreview.slice(0, 0).map((r) => (
                  <ImportPreviewMobileCard key={r.row} index={r.row} title={r.productName || r.rawCode} error={r.error}>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <ImportPreviewField label="Código"><p className="break-words font-mono text-xs">{r.rawCode || '—'}</p></ImportPreviewField>
                      <ImportPreviewField label="Fila"><p className="font-mono text-xs">{r.row + 2}</p></ImportPreviewField>
                      <ImportPreviewField label="Producto" className="col-span-2"><p className="break-words text-xs font-bold">{r.productName || '—'}</p></ImportPreviewField>
                      <ImportPreviewField label="Cantidad"><p className="text-right text-xs font-bold">{fmtQty(r.qty)}</p></ImportPreviewField>
                      <ImportPreviewField label="Stock actual"><p className="text-right text-xs">{r.error ? '—' : fmtQty(r.currentStock)}</p></ImportPreviewField>
                      <ImportPreviewField label="Diferencia" className="col-span-2"><p className={`text-right text-xs font-black ${r.error ? 'text-muted-foreground' : r.difference > 0 ? 'text-emerald-500' : r.difference < 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>{r.error ? '—' : fmtQty(r.difference)}</p></ImportPreviewField>
                    </div>
                  </ImportPreviewMobileCard>
                ))}
                <VirtualizedImportList count={importPreview.length} estimateSize={220} className="h-[min(62vh,40rem)] space-y-3" renderItem={(index) => {
                  const r = importPreview[index];
                  return <ImportPreviewMobileCard key={r.row} index={r.row} title={r.productName || r.rawCode} error={r.error}>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <ImportPreviewField label="Código"><p className="break-words font-mono text-xs">{r.rawCode || '—'}</p></ImportPreviewField>
                      <ImportPreviewField label="Fila"><p className="font-mono text-xs">{r.row + 2}</p></ImportPreviewField>
                      <ImportPreviewField label="Producto" className="col-span-2"><p className="break-words text-xs font-bold">{r.productName || '—'}</p></ImportPreviewField>
                      <ImportPreviewField label="Cantidad"><p className="text-right text-xs font-bold">{fmtQty(r.qty)}</p></ImportPreviewField>
                      <ImportPreviewField label="Stock actual"><p className="text-right text-xs">{r.error ? '—' : fmtQty(r.currentStock)}</p></ImportPreviewField>
                      <ImportPreviewField label="Diferencia" className="col-span-2"><p className={`text-right text-xs font-black ${r.error ? 'text-muted-foreground' : r.difference > 0 ? 'text-emerald-500' : r.difference < 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>{r.error ? '—' : fmtQty(r.difference)}</p></ImportPreviewField>
                    </div>
                  </ImportPreviewMobileCard>;
                }} />
              </section>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>Cancelar</Button>
            <Button onClick={confirmImport} disabled={importing || importValidCount === 0 || !importWarehouse} className="gap-1.5">
              {importing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Importar {importValidCount} válidas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportProgressOverlay
        open={readingFile || importing}
        progress={readingFile ? readingProgress : importProgress}
        title={readingFile ? 'Preparando inventario' : 'Importando inventario'}
        description={readingFile ? 'Leyendo el archivo y preparando todas las filas para revisión.' : `Creando ajustes del mes ${monthLabelOf(importMonth)} en el almacén seleccionado...`}
      />
    </div>
  );
});

function EmptyTable() {
  return (
    <div className="h-40 flex items-center justify-center text-[10px] text-muted-foreground uppercase font-black tracking-widest">
      Sin datos para este criterio
    </div>
  );
}

InventoryReportTab.displayName = 'InventoryReportTab';
