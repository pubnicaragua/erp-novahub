import { useState, useEffect } from 'react';
import { BadgeDollarSign, Plus, Search, Eye, Pencil, TrendingUp, Hash, Ban, ChevronLeft, Send, CheckCircle2, Lock, FileText, Trash2, Boxes, Wrench, FileSpreadsheet, Upload, Download, Percent } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Combobox } from '../ui/Combobox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { vendorCreditsService } from '../../services/compras.service';
import type { SupplierCredit, Supplier, SupplierInvoice } from '../../types';
import type { SalesPaginationControls } from '../../types';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { ViewLayoutSelect } from '../ui/ViewLayoutSelect';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { PurchaseKpiCard } from './PurchaseKpiCard';
import { PurchaseViewTutorial } from './PurchaseViewTutorial';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { formatDateEs } from '../../utils/dateFormat';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';
import { ImportProgressOverlay } from '../ui/ImportProgressOverlay';
import * as XLSX from 'xlsx';
import { PdfDownloadButton } from '../ui/PdfDownloadButton';
import type { PdfDownloadFormat } from '../../utils/pdfDownloadFormats';
import { generatePurchaseListPDF, generatePurchaseRecordPDF } from '../../utils/purchaseExports';
import { SalesDocumentDetailSheet } from '../ventas/SalesDocumentDetailSheet';
import { parseSpreadsheetInWorker } from '../../utils/import-spreadsheet';
import { CurrencySelector } from '../ui/CurrencySelector';

interface Props { data: SupplierCredit[]; loading: boolean; onRefresh: () => void; supplierCatalog?: Supplier[]; supplierInvoices?: SupplierInvoice[]; productCatalog?: any[]; pagination?: SalesPaginationControls; onSearchChange?: (value: string) => void; }

const INVOICE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  PARTIAL: 'Parcial',
  PAID: 'Pagada',
  OVERDUE: 'Vencida',
  REFUNDED: 'Reembolsada',
  CANCELLED: 'Anulada',
  ISSUED: 'Emitida',
  OPEN: 'Abierta',
  RECEIVED: 'Recibida',
  APPROVED: 'Aprobada',
};
const invoiceStatusLabel = (value?: string) => INVOICE_STATUS_LABELS[String(value || '').toUpperCase()] || String(value || '') || '';

const statusOpts = [
  { label: 'Borrador',  value: 'draft',   color: 'bg-muted/20 text-muted-foreground' },
  { label: 'Emitido',   value: 'issued',  color: 'bg-blue-500/10 text-blue-500' },
  { label: 'Aplicado',  value: 'applied', color: 'bg-emerald-500/10 text-emerald-500' },
  { label: 'Parcial',   value: 'partial', color: 'bg-amber-500/10 text-amber-500' },
  { label: 'Pagado',    value: 'paid',    color: 'bg-emerald-600/10 text-emerald-600' },
  { label: 'Anulado',   value: 'voided',  color: 'bg-rose-500/10 text-rose-500' },
];

export function CreditosProveedorView({ data, loading, onRefresh, supplierCatalog = [], supplierInvoices = [], productCatalog = [], pagination, onSearchChange }: Props) {
  const { canPerform, user } = useAuth();
  const { displayCurrency, baseCurrency, valuationMode, valuationModeSuffix, toBaseAmount, formatConvertedAmount, formatCurrentAmount, convertAmount, convertCurrentAmount, exchangeRate } = useCurrency();
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutMode, setLayoutMode] = useLocalStorageState<'table' | 'cards'>('purchases-credits-layout', 'table', 24 * 365);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ISSUED' | 'APPLIED'>('ALL');
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [localDoc, setLocalDoc] = useState<Partial<SupplierCredit> | null>(null);
  const [pendingVoidId, setPendingVoidId] = useState<string | null>(null);
  const [voidLoading, setVoidLoading] = useState(false);
  const [pendingIssueId, setPendingIssueId] = useState<string | null>(null);
  const [issueLoading, setIssueLoading] = useState(false);
  const [applyTarget, setApplyTarget] = useState<SupplierCredit | null>(null);
  const [detailCredit, setDetailCredit] = useState<SupplierCredit | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [itemTypeFilter, setItemTypeFilter] = useState<'PRODUCT' | 'SERVICE'>('PRODUCT');
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  useEffect(() => { setSuppliers(supplierCatalog); }, [supplierCatalog]);

  const downloadCreditTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['TIPO', 'PRODUCTO', 'DESCRIPCION', 'CANTIDAD', 'PRECIO', 'IVA', 'TASA_IR', 'DESCUENTO'],
      ['PRODUCTO', 'Código o nombre exacto', 'Cemento Holcim 50kg', '25', '210', 'GRAVADO', 'NONE', '0'],
      ['SERVICIO', '', 'Flete de entrega', '1', '1500', 'EXENTO', 'IR_1', '2'],
    ]);
    const guide = XLSX.utils.aoa_to_sheet([
      ['PLANTILLA DE CRÉDITO DE PROVEEDOR - REGLAS POR COLUMNA'],
      [''],
      ['TIPO (obligatorio)'],
      ['  PRODUCTO  -> Se vincula al inventario. En la columna PRODUCTO escriba el código o nombre exacto.'],
      ['  SERVICIO  -> No usa inventario. Deje PRODUCTO vacío y escriba la descripción.'],
      [''],
      ['PRODUCTO (obligatorio solo si TIPO = PRODUCTO)'],
      ['  Código o nombre exacto del artículo en el inventario. Si no coincide, la línea se marca con error.'],
      [''],
      ['DESCRIPCION (obligatorio)'],
      ['  Detalle de la línea. Para PRODUCTO se puede dejar vacío: se toma el nombre del inventario.'],
      ['  Para SERVICIO es obligatorio escribir la descripción del servicio.'],
      [''],
      ['CANTIDAD (obligatorio, mayor a 0)'],
      ['  Número de unidades. Ejemplo: 25'],
      [''],
      ['PRECIO (obligatorio, mayor o igual a 0)'],
      ['  Precio unitario en la moneda del crédito (C$ o USD). Ejemplo: 210'],
      [''],
      ['IVA (opcional, por línea)'],
      ['  GRAVADO  -> Aplica IVA a esta línea (usa la tasa global del formulario).'],
      ['  EXENTO   -> No aplica IVA.'],
      ['  Si se deja vacío, se usa la configuración global del formulario.'],
      [''],
      ['TASA_IR (opcional, por línea)'],
      ['  NONE    -> Sin retención IR.'],
      ['  IR_1    -> Retención IR 1%.'],
      ['  IR_2    -> Retención IR 2%.'],
      ['  IR_5    -> Retención IR 5%.'],
      ['  IR_10   -> Retención IR 10%.'],
      ['  IR_15   -> Retención IR 15%.'],
      ['  IR_20   -> Retención IR 20%.'],
      ['  IR_25   -> Retención IR 25%.'],
      ['  Si se deja vacío, se usa la configuración global del formulario.'],
      [''],
      ['DESCUENTO (opcional, por línea)'],
      ['  Porcentaje de descuento para esta línea (0-100). Ejemplo: 2'],
      ['  Si se deja vacío, se usa el descuento global del formulario.'],
      [''],
      ['EJEMPLOS'],
      ['TIPO=PRODUCTO | PRODUCTO=HOLCIM | DESCRIPCION= | CANTIDAD=25 | PRECIO=210 | IVA=GRAVADO | TASA_IR=NONE | DESCUENTO=0'],
      ['TIPO=SERVICIO | PRODUCTO= | DESCRIPCION=Flete de entrega | CANTIDAD=1 | PRECIO=1500 | IVA=EXENTO | TASA_IR=IR_1 | DESCUENTO=2'],
      [''],
      ['NOTA: IVA, retención IR y descuento pueden configurarse globalmente en el formulario o por línea en este archivo.'],
      ['Los valores por línea tienen prioridad sobre la configuración global.'],
      ['El archivo puede ser .xlsx, .xls, .csv o .pdf con estas mismas columnas.'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Crédito');
    XLSX.utils.book_append_sheet(wb, guide, 'Reglas de llenado');
    XLSX.writeFile(wb, 'plantilla_creditos_proveedor.xlsx');
    toast.success('Plantilla descargada');
  };

  const importCreditItems = async (file: File) => {
    setImporting(true);
    setImportProgress(5);
    setImportErrors([]);
    try {
      const isPdf = /\.pdf$/i.test(file.name);
      const isXls = /\.(xlsx|xls|csv)$/i.test(file.name);
      if (!isPdf && !isXls) {
        setImportErrors(['Formato no soportado. Use un archivo Excel (.xlsx, .xls, .csv) o PDF.']);
        return;
      }

      let raw: any[][] = [];
      if (isPdf) {
        const buffer = await file.arrayBuffer();
        setImportProgress(18);
        const text = new TextDecoder('latin1').decode(buffer);
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        raw = lines.map(line => line.split(/[\t;|]+/).map(c => c.trim()));
      } else {
        const parsed = await parseSpreadsheetInWorker(file, undefined, false, (progress) => {
          setImportProgress(Math.min(70, Math.max(5, Math.round(progress * 0.72))));
        });
        raw = parsed.rows;
      }
      setImportProgress(74);

      const normalizeHeader = (h: any) => String(h || '').trim().toLowerCase().replace(/[\s_\-]+/g, '');
      const header = raw[0]?.map(normalizeHeader) || [];
      const findCol = (...names: string[]) => {
        for (const n of names) {
          const idx = header.indexOf(n);
          if (idx >= 0) return idx;
        }
        return -1;
      };
      const iTipo = findCol('tipo');
      const iProd = findCol('producto', 'productoid');
      const iDesc = findCol('descripcion', 'descripción');
      const iCant = findCol('cantidad', 'cant');
      const iPrecio = findCol('precio', 'preciounitario', 'preciou');
      const iIva = findCol('iva', 'tratamientoiva', 'taxtype');
      const iIr = findCol('tasa_ir', 'tasaIr', 'retencion', 'retencionir', 'withholding');
      const iDescuento = findCol('descuento', 'discount', 'desc');

      if (iDesc < 0 || iCant < 0 || iPrecio < 0) {
        setImportErrors(['El archivo debe tener las columnas: TIPO, PRODUCTO, DESCRIPCION, CANTIDAD, PRECIO. Descargue la plantilla para ver el formato.']);
        return;
      }

      const errors: string[] = [];
      const items: any[] = [];
      raw.slice(1).forEach((row, r) => {
        const line = r + 2;
        const tipo = String(row[iTipo >= 0 ? iTipo : 0] || 'PRODUCTO').trim().toUpperCase();
        const rawProd = iProd >= 0 ? String(row[iProd] || '').trim() : '';
        const desc = String(row[iDesc] || '').trim();
        const cant = Number(row[iCant]);
        const precio = Number(row[iPrecio]);
        const ivaLine = iIva >= 0 ? String(row[iIva] || '').trim().toUpperCase() : '';
        const irLine = iIr >= 0 ? String(row[iIr] || '').trim().toUpperCase() : '';
        const descLine = iDescuento >= 0 ? Number(row[iDescuento]) : 0;

        const tipoNorm = tipo.startsWith('PROD') ? 'PRODUCT' : tipo.startsWith('SERV') ? 'SERVICE' : '';
        if (!tipoNorm) { errors.push(`Fila ${line}: TIPO inválido ("${tipo}"). Use PRODUCTO o SERVICIO.`); return; }
        if (tipoNorm === 'PRODUCT' && !rawProd) { errors.push(`Fila ${line}: TIPO=PRODUCTO requiere la columna PRODUCTO (código o nombre).`); return; }
        if (tipoNorm === 'SERVICE' && !desc) { errors.push(`Fila ${line}: TIPO=SERVICIO requiere la descripción.`); return; }
        if (!(cant > 0)) { errors.push(`Fila ${line}: CANTIDAD inválida ("${row[iCant]}"). Debe ser mayor a 0.`); return; }
        if (!(precio >= 0)) { errors.push(`Fila ${line}: PRECIO inválido ("${row[iPrecio]}"). Debe ser mayor o igual a 0.`); return; }

        const matched = tipoNorm === 'PRODUCT' ? productCatalog.find((p: any) =>
          String(p.code || '').toLowerCase() === rawProd.toLowerCase() ||
          String(p.name || '').toLowerCase() === rawProd.toLowerCase()) : undefined;
        if (tipoNorm === 'PRODUCT' && !matched) {
          errors.push(`Fila ${line}: el producto "${rawProd}" no existe en el inventario.`);
          return;
        }

        const lineTotal = cant * precio;
        const lineDiscount = descLine > 0 ? lineTotal * (descLine / 100) : 0;

        items.push({
          itemType: tipoNorm,
          productId: matched?.id || null,
          description: matched ? matched.name : desc,
          quantity: cant,
          unitPrice: precio,
          total: lineTotal - lineDiscount,
          _lineIva: ivaLine || undefined,
          _lineIr: irLine || undefined,
          _lineDiscount: descLine || undefined,
        });
      });
      setImportProgress(92);

      if (errors.length > 0) {
        setImportErrors(errors.slice(0, 10));
        if (items.length === 0) return;
      }
      if (items.length === 0) {
        setImportErrors(['No se encontraron líneas válidas en el archivo.']);
        return;
      }
      const existing = localDoc?.items || [];
      setLocalDoc({ ...(localDoc as any), items: [...existing, ...items] });
      setImportProgress(100);
      toast.success(`${items.length} línea(s) importada(s)` + (errors.length ? `, ${errors.length} con error` : ''));
      setImportOpen(false);
    } catch (e: any) {
      setImportErrors([e?.message || 'No se pudo leer el archivo. Verifique que sea un Excel o PDF válido.']);
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  const openEditor = (id: string | null) => {
    setEditingId(id);
    if (id === 'NEW') {
      setLocalDoc({
        supplierId: '',
        date: new Date().toISOString(),
        dueDate: null,
        interestRate: 0,
        hasInterest: false,
        reason: '',
        status: 'draft',
        items: [],
        total: 0,
      });
    } else if (id) {
      const found = data.find(x => x.id === id);
      setLocalDoc(found ? JSON.parse(JSON.stringify(found)) : null);
    } else {
      setLocalDoc(null);
    }
  };

  const filtered = data.filter(c => {
    const status = String(c.status || '').toLowerCase();
    if (statusFilter === 'ISSUED' && status !== 'issued') return false;
    if (statusFilter === 'APPLIED' && !['applied', 'partial', 'paid'].includes(status)) return false;
    if (!searchTerm) return true;
    return (c.number||'').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.supplier?.name||'').toLowerCase().includes(searchTerm.toLowerCase());
  });

  const colFilters = useColumnFilters();
  const filterGetters = {
    supplier: (row: SupplierCredit) => row.supplier?.name || '-',
    date: (row: SupplierCredit) => (row.date ? new Date(row.date).getTime() : null),
    total: (row: SupplierCredit) => Number(row.total || 0),
    status: (row: SupplierCredit) => String(row.status || '').toLowerCase(),
  };
  const filteredData = colFilters.applyTo(filtered, filterGetters);

  const handleExportListPdf = async (format: PdfDownloadFormat) => {
    const exportToastId = toast.loading('Generando reporte de créditos...');
    try {
      await generatePurchaseListPDF({
        title: 'Créditos de proveedor',
        rows: filteredData,
        tenantName: user?.tenantName || 'Empresa',
        format,
        targetKey: 'compras.supplier-credit',
        columns: [
          { label: 'N° Crédito', value: (row) => row.number || row.id?.slice(0, 8) || '—' },
          { label: 'Proveedor', value: (row) => row.supplier?.name || 'Sin proveedor' },
          { label: 'Fecha', value: (row) => row.date ? formatDateEs(row.date) : '—' },
          { label: 'Total', align: 'right', value: (row) => formatConvertedAmount(Number(row.total || 0), resolveSourceCurrency(row.currency), row.exchangeRate) },
          { label: 'Estado', align: 'center', value: (row) => statusOpts.find((option) => option.value === String(row.status || '').toLowerCase())?.label || row.status || '—' },
        ],
      });
      toast.success('Reporte PDF descargado', { id: exportToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo generar el reporte', { id: exportToastId });
    }
  };

  const distinctSuppliers = [...new Map(filtered.map((c) => [c.supplier?.name || '-', c.supplier?.name || '-'])).entries()]
    .map(([, label]) => ({ value: label, label, count: filtered.filter((c) => (c.supplier?.name || '-') === label).length }));

  const resolveSourceCurrency = (value?: string) => ((value || '').toUpperCase() === 'USD' ? 'USD' : 'NIO');

  const columns: ColumnDef<SupplierCredit>[] = [
    { key: 'number',   header: 'N° Crédito',  width: '110px',
      render: (_v, row) => <span className="font-black font-mono text-primary text-xs">{row.number||row.id?.slice(0,8)}</span> },
    { key: 'supplier', header: 'Proveedor',  width: '160px',
      headerExtra: <ColumnFilterMenu label="Proveedor" options={distinctSuppliers} selected={colFilters.state.supplier?.values || []} onSelect={(values) => colFilters.setValues('supplier', values)} sort={colFilters.state.supplier?.sort || null} onSort={(sort) => colFilters.setSort('supplier', sort)} />,
      render: (_v, row) => <span className="font-bold text-sm">{row.supplier?.name||'-'}</span> },
    { key: 'supplierInvoice', header: 'Doc. Origen', width: '110px',
      render: (_v, row) => row.supplierInvoice ? <span className="flex items-center gap-1 text-xs font-mono font-bold text-muted-foreground"><FileText className="size-3 text-primary/60" />{row.supplierInvoice.number}</span> : <span className="text-xs text-muted-foreground/40">—</span> },
    { key: 'date',     header: 'Fecha',      width: '100px',
      headerExtra: <ColumnFilterMenu label="Fecha" sort={colFilters.state.date?.sort || null} onSort={(sort) => colFilters.setSort('date', sort)} sortOptions={[{ value: 'desc', label: 'Más recientes' }, { value: 'asc', label: 'Más antiguas' }]} />,
      render: (val) => <span className="text-xs text-muted-foreground">{val ? formatDateEs(val) : '-'}</span> },
    { key: 'total',    header: 'Total',      width: '110px',
      headerExtra: <ColumnFilterMenu label="Total" sort={colFilters.state.total?.sort || null} onSort={(sort) => colFilters.setSort('total', sort)} />,
      render: (val, row) => <CurrencyValuationAmount amount={Number(val || 0)} sourceCurrency={resolveSourceCurrency((row as any)?.currency)} sourceExchangeRate={(row as any)?.exchangeRate} className="font-black" /> },
    { key: 'status',   header: 'Estado',     width: '100px',
      headerExtra: <ColumnFilterMenu label="Estado" options={statusOpts.map((o) => ({ value: o.value, label: o.label, count: filtered.filter((c) => String(c.status || '').toLowerCase() === o.value).length }))} selected={colFilters.state.status?.values || []} onSelect={(values) => colFilters.setValues('status', values)} sort={colFilters.state.status?.sort || null} onSort={(sort) => colFilters.setSort('status', sort)} />,
      render: (val) => { const o = statusOpts.find(x => x.value === (val||'').toLowerCase()); return <Badge variant="outline" className={cn('text-[9px] font-black uppercase px-2 py-0.5 border-none', o?.color||'bg-muted/20 text-muted-foreground')}>{o?.label||val}</Badge>; } },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<SupplierCredit>) => {
    try { await vendorCreditsService.update(id as string, updates); toast.success('Crédito actualizado'); onRefresh(); }
    catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar'); throw new Error('Update failed', { cause: e }); }
  };

  const handleIssueConfirm = async () => {
    if (!pendingIssueId) return;
    setIssueLoading(true);
    const toastId = toast.loading('Emitiendo crédito de proveedor...');
    try {
      await vendorCreditsService.issue(pendingIssueId);
      toast.success('Crédito emitido correctamente', { id: toastId });
      setPendingIssueId(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo emitir el crédito', { id: toastId });
    } finally {
      setIssueLoading(false);
    }
  };

  const handleApplyConfirm = async () => {
    if (!applyTarget) return;
    setApplyLoading(true);
    const toastId = toast.loading('Aplicando crédito de proveedor...');
    try {
      await vendorCreditsService.apply(applyTarget.id, {});
      toast.success('Crédito aplicado correctamente', { id: toastId });
      setApplyTarget(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo aplicar el crédito', { id: toastId });
    } finally {
      setApplyLoading(false);
    }
  };

  const recalculatedTotal = (localDoc?.items || []).reduce((acc, it) => acc + (Number(it.quantity || 0) * Number(it.unitPrice || 0)), 0);
  const creditSubtotal = recalculatedTotal;
  const creditDiscountRate = Number(localDoc?.discountRate || 0);
  const creditDiscountAmount = creditSubtotal * creditDiscountRate / 100;
  const creditTaxBase = Math.max(0, creditSubtotal - creditDiscountAmount);
  const isGravado = String(localDoc?.taxType || 'EXENTO').toUpperCase() === 'GRAVADO';
  const creditTaxRate = isGravado ? Number(localDoc?.taxRate || 15) : 0;
  const creditTaxAmount = creditTaxBase * creditTaxRate / 100;
  const hasWithholding = String(localDoc?.withholdingType || 'NONE').toUpperCase() !== 'NONE';
  const creditWithholdingRate = hasWithholding ? Number(localDoc?.withholdingRate || 0) : 0;
  const creditWithholdingTotal = creditTaxBase * creditWithholdingRate / 100;
  const creditGrandTotal = Math.max(0, creditTaxBase + creditTaxAmount - creditWithholdingTotal);
  
  const handleSaveDoc = async () => {
    if (!localDoc?.supplierId) return toast.error('Seleccione un proveedor');
    
    const saveToastId = toast.loading(editingId === 'NEW' ? 'Registrando crédito de proveedor...' : 'Guardando crédito de proveedor...');
    try {
      const creditCurrency = localDoc.currency || displayCurrency;
      const creditRate = creditCurrency === baseCurrency ? 1 : (Number(exchangeRate) > 0 ? Number(exchangeRate) : 1);
      const finalDoc = {
          ...localDoc,
          total: creditGrandTotal,
          subtotal: creditSubtotal,
          discountRate: creditDiscountRate,
          discountAmount: creditDiscountAmount,
          taxType: isGravado ? 'GRAVADO' : 'EXENTO',
          taxRate: isGravado ? creditTaxRate : 0,
          taxAmount: creditTaxAmount,
          withholdingType: hasWithholding ? (localDoc.withholdingType || 'IR_2') : 'NONE',
          withholdingRate: hasWithholding ? creditWithholdingRate : 0,
          withholdingTotal: creditWithholdingTotal,
          currency: creditCurrency,
          exchangeRate: creditRate,
          baseTotal: toBaseAmount(creditGrandTotal, creditCurrency, creditRate),
          dueDate: localDoc.dueDate ? new Date(localDoc.dueDate).toISOString() : null,
          interestRate: Number(localDoc.interestRate ?? 0),
          hasInterest: Boolean(localDoc.hasInterest) || Number(localDoc.interestRate ?? 0) > 0,
          status: editingId === 'NEW' ? 'draft' : (localDoc.status || 'draft'),
      };
      if (editingId === 'NEW') {
        await vendorCreditsService.create(finalDoc as any);
        toast.success('Crédito registrado exitosamente', { id: saveToastId });
      } else {
        await vendorCreditsService.update(editingId!, finalDoc as any);
        toast.success('Crédito guardado', { id: saveToastId });
      }
      openEditor(null);
      onRefresh();
    } catch (e: any) { 
        toast.error(e?.response?.data?.message || e?.message || 'Error al registrar', { id: saveToastId });
    }
  };

  const handleVoidConfirm = async () => {
    if (!pendingVoidId) return;
    setVoidLoading(true);
    const voidToastId = toast.loading('Anulando crédito de proveedor...');
    try {
      await vendorCreditsService.void(pendingVoidId);
      toast.success('Crédito anulado correctamente', { id: voidToastId });
      setPendingVoidId(null);
      openEditor(null);
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error al anular el crédito', { id: voidToastId });
    } finally {
      setVoidLoading(false);
    }
  };

  const handleDeleteItem = (idx: number) => {
    if (!localDoc) return;
    const newItems = [...(localDoc.items || [])];
    newItems.splice(idx, 1);
    setLocalDoc({ ...localDoc, items: newItems as any });
  };

  const handleItemChange = (idx: number, field: string, value: any) => {
    if (!localDoc) return;
    const newItems = [...(localDoc.items || [])];
    newItems[idx] = { ...newItems[idx], [field]: value };
    
    if (['quantity', 'unitPrice'].includes(field)) {
       const q = Number(newItems[idx].quantity || 0);
       const p = Number(newItems[idx].unitPrice || 0);
       newItems[idx].total = q * p;
    }
    setLocalDoc({ ...localDoc, items: newItems as any });
  };

  const handleItemProductPick = (idx: number, productId: string) => {
    if (!localDoc) return;
    const p = productCatalog.find((x: any) => x.id === productId);
    const price = [p?.lastPurchasePrice, p?.costPrice, p?.cost, p?.price, p?.salePrice]
      .map((v) => Number(v))
      .find((v) => Number.isFinite(v) && v > 0) ?? 0;
    const newItems = [...(localDoc.items || [])];
    newItems[idx] = {
      ...newItems[idx],
      productId: productId || null,
      description: p?.name || newItems[idx].description || '',
      unitPrice: price,
      total: Number(newItems[idx].quantity || 0) * price,
    };
    setLocalDoc({ ...localDoc, items: newItems as any });
  };

  const handleDownloadCreditPdf = async (credit: SupplierCredit, format: PdfDownloadFormat = 'configured') => {
    const exportToastId = toast.loading('Generando PDF del crédito...');
    try {
      await generatePurchaseRecordPDF({
        tenantName: user?.tenantName || 'Empresa',
        format,
        targetKey: 'compras.supplier-credit',
        document: {
          title: 'Crédito de proveedor',
          number: String(credit.number || credit.id),
          date: credit.date ? formatDateEs(credit.date) : undefined,
          status: statusOpts.find((option) => option.value === String(credit.status || '').toLowerCase())?.label || credit.status,
          supplier: credit.supplier?.name || 'Sin proveedor',
          fields: [{ label: 'Documento de origen', value: credit.supplierInvoice?.number || 'Sin factura asociada' }, { label: 'Moneda', value: resolveSourceCurrency((credit as any).currency) }],
          lines: ((credit as any).items || []).map((item: any) => ({ description: item.description || item.name || 'Artículo sin descripción', quantity: item.quantity || 0, unitPrice: formatConvertedAmount(Number(item.unitPrice || 0), resolveSourceCurrency((credit as any).currency), (credit as any).exchangeRate), total: formatConvertedAmount(Number(item.total || 0), resolveSourceCurrency((credit as any).currency), (credit as any).exchangeRate), secondary: item.commercialNoteSnapshot ? `Nota: ${item.commercialNoteSnapshot}` : undefined })),
          total: formatConvertedAmount(Number(credit.total || 0), resolveSourceCurrency((credit as any).currency), (credit as any).exchangeRate),
          totalLabel: 'Total del crédito',
        },
      });
      toast.success('PDF descargado', { id: exportToastId });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo generar el PDF', { id: exportToastId });
    }
  };

  if (editingId && localDoc) {
    const isNew = editingId === 'NEW';
    const currentStatus = statusOpts.find(s => s.value === (localDoc.status||'').toLowerCase());
    const isLocked = !isNew && ['applied', 'partial', 'paid', 'voided'].includes(String(localDoc.status || '').toLowerCase());
    const canMutate = isNew ? canPerform('PURCHASES_RETURNS', 'create') : (canPerform('PURCHASES_RETURNS', 'edit') && !isLocked);
    const invoiceOptions = supplierInvoices
      .filter(inv => !localDoc.supplierId || inv.supplierId === localDoc.supplierId)
      .filter(inv => String(inv.status || '').toUpperCase() !== 'CANCELLED')
      .map(inv => ({ label: `${inv.number} · ${invoiceStatusLabel(inv.status)}`, value: inv.id, description: `${formatDateEs(inv.date || Date.now())} · ${formatConvertedAmount(Number(inv.total || 0), resolveSourceCurrency((inv as any)?.currency), (inv as any)?.exchangeRate)}` }));

    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-300" data-tour="purchases-form-title">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => openEditor(null)} className="rounded-full">
              <ChevronLeft className="size-5" />
            </Button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">{isNew ? 'Nuevo Crédito de Proveedor' : `Crédito ${localDoc.number || ''}`}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Crédito otorgado por el proveedor a favor de la empresa</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap" data-tour="purchases-form-actions">
            <PurchaseViewTutorial view="credits" context="form" />
             {!isNew && canPerform('PURCHASES_RETURNS', 'delete') && !isLocked && (
                <Button variant="outline" className="rounded-xl border-rose-500/50 text-rose-500 hover:bg-rose-700 hover:text-white font-black uppercase text-[10px] tracking-widest px-4"
                  onClick={() => setPendingVoidId(editingId)}>
                  <Ban className="size-3 mr-2" /> Anular
                </Button>
             )}
            {isLocked && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                <Lock className="size-3.5" /> Crédito {currentStatus?.label?.toLowerCase()} · Solo lectura
              </div>
            )}
            {((isNew && canPerform('PURCHASES_RETURNS', 'create')) || (!isNew && canPerform('PURCHASES_RETURNS', 'edit'))) && !isLocked && (
              <Button onClick={handleSaveDoc} className="rounded-xl bg-primary shadow-xl shadow-primary/20 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6">
                Guardar Crédito
              </Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="rounded-2xl border-border/50 col-span-2" data-tour="purchases-form-data">
            <CardContent className="p-6 space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Datos del Crédito</p>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div className="md:col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Proveedor</p>
                  <Combobox
                    disabled={!canMutate}
                    options={suppliers
                      .filter(s => (s.status || '').toUpperCase() === 'ACTIVE' || s.id === localDoc.supplierId)
                      .map(s => ({ label: s.name, value: s.id, description: (s.code ? `[${s.code}] ` : '') + (s.phone || 'Sin teléfono') }))}
                    value={localDoc.supplierId || ''}
                    onChange={(val) => setLocalDoc({ ...localDoc, supplierId: val, supplierInvoiceId: undefined })}
                    placeholder="Seleccionar proveedor..."
                  />
                </div>
                <div className="md:col-span-2">
                  <p className="text-[10px] text-muted-foreground mb-1">Documento de origen (factura a la que aplica)</p>
                  <Combobox
                    disabled={!canMutate}
                    options={invoiceOptions}
                    value={localDoc.supplierInvoiceId || ''}
                    onChange={(val) => {
                      if (!val) {
                        setLocalDoc({ ...localDoc, supplierInvoiceId: undefined });
                        return;
                      }
                      const inv = supplierInvoices.find((i: any) => i.id === val);
                      if (inv) {
                        const invItems = (inv.items || []).map((it: any) => ({
                          id: `inv-${it.id || Date.now()}-${Math.random()}`,
                          itemType: it.itemType || (it.productId ? 'PRODUCT' : 'SERVICE'),
                          productId: it.productId || null,
                          description: it.description || '',
                          quantity: Number(it.quantity || 1),
                          unitPrice: Number(it.unitPrice || 0),
                          total: Number(it.quantity || 1) * Number(it.unitPrice || 0),
                        }));
                        const invTaxType = (inv as any).taxType || (inv.taxAmount > 0 ? 'GRAVADO' : 'EXENTO');
                        const invTaxRate = Number((inv as any).taxRate || 15);
                        const invWithholdingType = (inv as any).withholdingType || 'NONE';
                        const invWithholdingRate = Number((inv as any).withholdingRate || 0);
                        setLocalDoc({
                          ...localDoc,
                          supplierInvoiceId: val,
                          supplierId: inv.supplierId,
                          currency: inv.currency || 'NIO',
                          exchangeRate: inv.exchangeRate || 1,
                          date: inv.date || localDoc.date,
                          dueDate: inv.dueDate || localDoc.dueDate,
                          taxType: invTaxType as any,
                          taxRate: invTaxRate,
                          withholdingType: invWithholdingType as any,
                          withholdingRate: invWithholdingRate,
                          items: invItems as any,
                          reason: `Crédito por factura ${inv.number || ''}`,
                        });
                      } else {
                        setLocalDoc({ ...localDoc, supplierInvoiceId: val || undefined });
                      }
                    }}
                    placeholder="Sin factura vinculada (crédito general)"
                  />
                  {isNew && localDoc.supplierId && (
                    <p className="mt-1 text-[10px] text-muted-foreground">Al vincular una factura, se importan automáticamente los datos: proveedor, moneda, items, impuestos y descuentos.</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha Emisión</p>
                  <Input 
                    disabled={!canMutate}
                    type="date" 
                    value={localDoc.date ? new Date(localDoc.date).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, date: new Date(e.target.value).toISOString() })} 
                    className="h-8 text-xs" 
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Fecha Límite</p>
                  <Input 
                    disabled={!canMutate}
                    type="date" 
                    value={localDoc.dueDate ? new Date(localDoc.dueDate).toISOString().split('T')[0] : ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })} 
                    className="h-8 text-xs" 
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">¿Genera intereses?</p>
                  <div className="flex h-8 items-center gap-2">
                    <button
                      type="button"
                      disabled={!canMutate}
                      onClick={() => setLocalDoc({ ...localDoc, hasInterest: !localDoc.hasInterest, interestRate: !localDoc.hasInterest ? (localDoc.interestRate || 0) : 0 })}
                      className={cn('flex h-8 items-center gap-2 rounded-lg border px-3 text-[10px] font-black uppercase tracking-widest transition-colors',
                        localDoc.hasInterest ? 'border-amber-500/50 bg-amber-500/10 text-amber-600' : 'border-border/50 bg-background text-muted-foreground')}
                    >
                      <Percent className="size-3" /> {localDoc.hasInterest ? 'Sí' : 'No'}
                    </button>
                    {localDoc.hasInterest && (
                      <Input
                        disabled={!canMutate}
                        type="number" min="0" step="0.01"
                        value={localDoc.interestRate || 0}
                        onChange={(e) => setLocalDoc({ ...localDoc, interestRate: Number(e.target.value) })}
                        className="h-8 w-24 text-xs font-bold tabular-nums"
                        placeholder="% mensual"
                      />
                    )}
                  </div>
                  {localDoc.hasInterest && (
                    <p className="mt-1 text-[10px] text-muted-foreground/70">Interés {localDoc.interestRate || 0}% por período vencido</p>
                  )}
                </div>
                <div>
                  <CurrencySelector
                    value={localDoc.currency || displayCurrency}
                    baseCurrency={baseCurrency}
                    exchangeRate={exchangeRate}
                    label="Moneda"
                    rateDecimals={2}
                    disabled={!canMutate}
                    onChange={(newCurrency) => {
                      setLocalDoc({
                        ...localDoc,
                        currency: newCurrency,
                        exchangeRate: newCurrency === baseCurrency ? 1 : (Number(exchangeRate) > 0 ? Number(exchangeRate) : 1),
                      });
                    }}
                  />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Estado</p>
                  <div className="flex h-8 items-center"><Badge variant="outline" className={cn('text-[9px] font-black uppercase border-none', currentStatus?.color || 'bg-muted/20 text-muted-foreground')}>{currentStatus?.label || localDoc.status || 'Borrador'}</Badge></div>
                </div>
                <div className="md:col-span-4">
                  {localDoc.date && localDoc.dueDate && (
                    <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Condiciones del crédito</p>
                        <p className="mt-1 text-sm font-bold">
                          {formatConvertedAmount(creditGrandTotal, resolveSourceCurrency((localDoc as any)?.currency), (localDoc as any)?.exchangeRate)}
                          {' · '}
                          vence el {formatDateEs(localDoc.dueDate)}
                          {' · '}
                          {(() => {
                            const start = new Date(localDoc.date);
                            const end = new Date(localDoc.dueDate);
                            const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                            return diffDays > 0 ? `${diffDays} días` : 'Vence hoy';
                          })()}
                        </p>
                      </div>
                      {localDoc.hasInterest && (
                        <Badge variant="outline" className="text-[9px] border-amber-500/30 bg-amber-500/10 text-amber-600">
                          <Percent className="size-2.5 mr-1" /> {localDoc.interestRate || 0}% interés
                        </Badge>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground mb-1">Razón / Concepto</p>
                  <Input 
                    disabled={!canMutate}
                    value={localDoc.reason || ''} 
                    onChange={(e) => setLocalDoc({ ...localDoc, reason: e.target.value })} 
                    className="h-8 text-xs" 
                    placeholder="Ej. Devolución de mercadería, descuento comercial, bonificación" 
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 col-span-2" data-tour="purchases-form-summary">
            <CardContent className="p-6">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Impuestos y descuentos</p>
              {localDoc.supplierInvoiceId && (
                <p className="mb-3 text-[10px] text-muted-foreground/70 bg-muted/30 rounded-lg px-3 py-1.5">Los campos de impuestos y descuentos están bloqueados porque este crédito está vinculado a una factura. Los valores se heredaron automáticamente.</p>
              )}
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">IVA</p>
                  <Select
                    disabled={!canMutate || !!localDoc.supplierInvoiceId}
                    value={String(localDoc.taxType || 'EXENTO').toUpperCase()}
                    onValueChange={(taxType) => {
                      const gravado = taxType === 'GRAVADO';
                      setLocalDoc({ ...localDoc, taxType: gravado ? 'GRAVADO' : 'EXENTO', taxRate: gravado ? (Number(localDoc.taxRate) || 15) : 0 });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs font-bold uppercase"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXENTO">Exento</SelectItem>
                      <SelectItem value="GRAVADO">Gravado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Tasa IVA (%)</p>
                  <Input
                    disabled={!canMutate || !!localDoc.supplierInvoiceId || String(localDoc.taxType || 'EXENTO').toUpperCase() !== 'GRAVADO'}
                    type="number" min="0" step="0.01"
                    value={String(localDoc.taxType || 'EXENTO').toUpperCase() === 'GRAVADO' ? (localDoc.taxRate || 15) : 0}
                    onChange={(e) => setLocalDoc({ ...localDoc, taxRate: Number(e.target.value) })}
                    className="h-8 text-xs font-bold tabular-nums" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Retención IR</p>
                  <div className="flex h-8 items-center gap-2">
                    <Select
                      disabled={!canMutate || !!localDoc.supplierInvoiceId}
                      value={String(localDoc.withholdingType || 'NONE').toUpperCase()}
                      onValueChange={(withholdingType) => {
                        const withRetention = withholdingType !== 'NONE';
                        setLocalDoc({
                          ...localDoc,
                          withholdingType: withRetention ? withholdingType : 'NONE',
                          withholdingRate: withRetention ? (Number(localDoc.withholdingRate) || Number(withholdingType.split('_')[1] || 2)) : 0,
                        });
                      }}
                    >
                      <SelectTrigger className="h-8 w-full text-xs font-bold uppercase"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">Sin retención</SelectItem>
                        <SelectItem value="IR_1">IR 1%</SelectItem>
                        <SelectItem value="IR_2">IR 2%</SelectItem>
                        <SelectItem value="IR_5">IR 5%</SelectItem>
                        <SelectItem value="IR_10">IR 10%</SelectItem>
                        <SelectItem value="IR_15">IR 15%</SelectItem>
                        <SelectItem value="IR_20">IR 20%</SelectItem>
                        <SelectItem value="IR_25">IR 25%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Tasa IR (%)</p>
                  <Input
                    disabled={!canMutate || !!localDoc.supplierInvoiceId || String(localDoc.withholdingType || 'NONE').toUpperCase() === 'NONE'}
                    type="number" min="0" step="0.01"
                    value={String(localDoc.withholdingType || 'NONE').toUpperCase() !== 'NONE' ? (localDoc.withholdingRate || 0) : 0}
                    onChange={(e) => setLocalDoc({ ...localDoc, withholdingRate: Number(e.target.value) })}
                    className="h-8 text-xs font-bold tabular-nums" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Descuento (%)</p>
                  <Input
                    disabled={!canMutate || !!localDoc.supplierInvoiceId}
                    type="number" min="0" step="0.01"
                    value={localDoc.discountRate || 0}
                    onChange={(e) => setLocalDoc({ ...localDoc, discountRate: Number(e.target.value) })}
                    className="h-8 text-xs font-bold tabular-nums" />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl border border-border/50 bg-muted/10 p-3 text-xs">
                    <span className="text-muted-foreground">Subtotal</span><b className="text-right tabular-nums">{formatConvertedAmount(creditSubtotal, resolveSourceCurrency((localDoc as any)?.currency), (localDoc as any)?.exchangeRate)}</b>
                    <span className="text-muted-foreground">Descuento ({creditDiscountRate}%)</span><b className="text-right tabular-nums text-rose-500">− {formatConvertedAmount(creditDiscountAmount, resolveSourceCurrency((localDoc as any)?.currency), (localDoc as any)?.exchangeRate)}</b>
                    <span className="text-muted-foreground">IVA ({isGravado ? creditTaxRate + '%' : 'Exento'})</span><b className="text-right tabular-nums text-blue-500">+ {formatConvertedAmount(creditTaxAmount, resolveSourceCurrency((localDoc as any)?.currency), (localDoc as any)?.exchangeRate)}</b>
                    <span className="text-muted-foreground">Retención IR ({hasWithholding ? creditWithholdingRate + '%' : '—'})</span><b className="text-right tabular-nums text-amber-500">− {formatConvertedAmount(creditWithholdingTotal, resolveSourceCurrency((localDoc as any)?.currency), (localDoc as any)?.exchangeRate)}</b>
                    <span className="pt-1 font-black uppercase text-[10px] tracking-widest">Total</span><b className="pt-1 text-right text-sm text-primary tabular-nums">{formatConvertedAmount(creditGrandTotal, resolveSourceCurrency((localDoc as any)?.currency), (localDoc as any)?.exchangeRate)}</b>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 col-span-2" data-tour="purchases-form-items">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Detalles</p>
                <div className="flex items-center gap-2">
                  {canMutate && (
                    <>
                      <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-background/60 p-1">
                        <button type="button" onClick={() => setItemTypeFilter('PRODUCT')} className={cn('flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-black uppercase tracking-widest transition-colors', itemTypeFilter === 'PRODUCT' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}><Boxes className="size-3" /> Producto</button>
                        <button type="button" onClick={() => setItemTypeFilter('SERVICE')} className={cn('flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-black uppercase tracking-widest transition-colors', itemTypeFilter === 'SERVICE' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}><Wrench className="size-3" /> Servicio</button>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl">
                        <Upload className="size-3 mr-1.5" /> Importar
                      </Button>
                      <Button variant="outline" size="sm" onClick={downloadCreditTemplate} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl">
                        <FileSpreadsheet className="size-3 mr-1.5" /> Plantilla
                      </Button>
                    </>
                  )}
                  {canMutate && (
                    <Button variant="outline" size="sm" onClick={() => {
                      const newItems = [...(localDoc.items || []), { id: `new-${Date.now()}`, itemType: itemTypeFilter, productId: null, description: '', quantity: 1, unitPrice: 0, total: 0 }];
                      setLocalDoc({ ...localDoc, items: newItems as any });
                    }} className="h-8 text-[10px] font-black uppercase tracking-widest rounded-xl">
                      <Plus className="size-3 mr-2" /> Agregar {itemTypeFilter === 'PRODUCT' ? 'Producto' : 'Servicio'}
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
                  <div className="col-span-1">Tipo</div>
                  <div className="col-span-4">Descripción / Item</div>
                  <div className="col-span-2 text-right">Cant.</div>
                  <div className="col-span-2 text-right">Precio Unitario</div>
                  <div className="col-span-2 text-right">Total</div>
                  <div className="col-span-1" />
                </div>
                {(localDoc.items || []).map((item: any, idx: number) => (
                  <div key={item.id || idx} data-item-layout="credit" className="purchase-item-row grid min-w-0 grid-cols-12 gap-2 items-center">
                    <div className="col-span-1">
                      <Select
                        disabled={!canMutate}
                        value={item.itemType || 'PRODUCT'}
                        onValueChange={(itemType) => handleItemChange(idx, 'itemType', itemType)}
                      >
                        <SelectTrigger className="h-8 w-full px-1 text-[9px] font-black uppercase"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PRODUCT">Prod.</SelectItem>
                          <SelectItem value="SERVICE">Serv.</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-4">
                      {canMutate && String(item.itemType || 'PRODUCT') === 'PRODUCT' ? (
                        <Combobox
                          options={productCatalog.map((p: any) => ({ label: `${p.code || ''} - ${p.name || ''}`.trim(), value: p.id, description: p.category?.name || p.productType || '' }))}
                          value={item.productId || ''}
                          onChange={(val) => handleItemProductPick(idx, val)}
                          placeholder="Buscar en inventario..."
                        />
                      ) : (
                        <Input 
                          disabled={!canMutate}
                          value={item.description || ''} 
                          onChange={(e) => handleItemChange(idx, 'description', e.target.value)} 
                          className="h-8 text-xs" 
                          placeholder={String(item.itemType || '') === 'SERVICE' ? 'Descripción del servicio' : 'Descripción del producto'}
                        />
                      )}
                    </div>
                    <div className="col-span-2">
                      <Input 
                        disabled={!canMutate}
                        type="number" 
                        min="0" 
                        value={item.quantity === 0 ? '' : item.quantity} 
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)} 
                        className="h-8 text-xs text-right" 
                        placeholder="0" 
                      />
                    </div>
                    <div className="col-span-2">
                      <Input 
                        disabled={!canMutate}
                        type="number" 
                        min="0" 
                        value={item.unitPrice === 0 ? '' : item.unitPrice} 
                        onChange={(e) => handleItemChange(idx, 'unitPrice', e.target.value)} 
                        className="h-8 text-xs text-right" 
                        placeholder="0" 
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <span className="text-xs font-black w-20 text-right tabular-nums">{formatConvertedAmount(Number(item.total || 0), resolveSourceCurrency((localDoc as any)?.currency), (localDoc as any)?.exchangeRate)}</span>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {canMutate && (
                        <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 rounded-md" onClick={() => handleDeleteItem(idx)}>
                          <Trash2 className="size-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {(localDoc.items || []).length === 0 && (
                  <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                    Sin líneas. Use <b>Agregar</b> para registrar un producto o servicio, o <b>Importar</b> un Excel/PDF con las columnas esperadas.
                  </div>
                )}
              </div>
              
               <div className="flex justify-end mt-4">
                  <div className="w-72 space-y-2 text-sm bg-muted/10 p-4 rounded-xl border border-border/50">
                     {creditDiscountAmount > 0 && (
                       <div className="flex justify-between text-xs text-muted-foreground"><span className="uppercase text-[10px] tracking-widest">Descuento</span><span className="text-rose-500">− {formatConvertedAmount(creditDiscountAmount, resolveSourceCurrency((localDoc as any)?.currency), (localDoc as any)?.exchangeRate)}</span></div>
                     )}
                     {creditTaxAmount > 0 && (
                       <div className="flex justify-between text-xs text-muted-foreground"><span className="uppercase text-[10px] tracking-widest">IVA ({creditTaxRate}%)</span><span className="text-blue-500">+ {formatConvertedAmount(creditTaxAmount, resolveSourceCurrency((localDoc as any)?.currency), (localDoc as any)?.exchangeRate)}</span></div>
                     )}
                     {creditWithholdingTotal > 0 && (
                       <div className="flex justify-between text-xs text-muted-foreground"><span className="uppercase text-[10px] tracking-widest">Retención IR</span><span className="text-amber-500">− {formatConvertedAmount(creditWithholdingTotal, resolveSourceCurrency((localDoc as any)?.currency), (localDoc as any)?.exchangeRate)}</span></div>
                     )}
                     {localDoc.hasInterest && Number(localDoc.interestRate) > 0 && (
                       <div className="flex justify-between text-xs text-muted-foreground"><span className="uppercase text-[10px] tracking-widest">Interés ({localDoc.interestRate}%)</span><span>{formatConvertedAmount(creditGrandTotal * Number(localDoc.interestRate) / 100, resolveSourceCurrency((localDoc as any)?.currency), (localDoc as any)?.exchangeRate)}</span></div>
                     )}
                     <div className="flex justify-between pt-2 border-t font-black"><span className="uppercase text-[10px] tracking-widest">Total</span><span className="text-lg text-primary">{formatConvertedAmount(creditGrandTotal, resolveSourceCurrency((localDoc as any)?.currency), (localDoc as any)?.exchangeRate)}</span></div>
                  </div>
               </div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader data-tour="purchases-credit-modal-title">
              <DialogTitle className="flex items-center gap-2"><Upload className="size-4" /> Importar líneas del crédito</DialogTitle>
              <DialogDescription>
                Sube un Excel (.xlsx, .xls, .csv) o PDF con las columnas: <b>TIPO, PRODUCTO, DESCRIPCION, CANTIDAD, PRECIO</b>. Descarga la plantilla para ver las reglas por columna.
              </DialogDescription>
              <PurchaseViewTutorial view="credits" context="form" labelOverride="Cómo importar líneas de crédito" stepKeys={['title', 'data', 'actions']} targetPrefix="purchases-credit-modal" />
            </DialogHeader>
            <div className="space-y-4" data-tour="purchases-credit-modal-data">
              <Button variant="outline" className="w-full rounded-xl text-[10px] font-black uppercase tracking-widest gap-2" onClick={downloadCreditTemplate}>
                <Download className="size-4" /> Descargar plantilla Excel
              </Button>
              <label className="flex h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 text-xs text-muted-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <FileSpreadsheet className="size-8 text-muted-foreground/40" />
                <span className="font-bold">Seleccionar archivo</span>
                <span className="text-[10px]">.xlsx · .xls · .csv · .pdf</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    await importCreditItems(file);
                    e.target.value = '';
                  }}
                />
              </label>
              {importErrors.length > 0 && (
                <div className="max-h-40 overflow-auto rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-[11px] text-rose-600 space-y-1">
                  {importErrors.map((err, i) => <p key={i}>{err}</p>)}
                </div>
              )}
            </div>
            <DialogFooter data-tour="purchases-credit-modal-actions">
              <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <ImportProgressOverlay
          open={importing}
          progress={importProgress}
          title="Preparando líneas del crédito"
          description="Leyendo el archivo y agregando las líneas válidas al crédito actual."
        />

      </div>
    );
  }

  const toDisplayAmount = (amount: number, currency?: string, rate?: number) => valuationMode === 'CURRENT'
    ? convertCurrentAmount(amount, currency)
    : convertAmount(amount, currency, rate || exchangeRate);
  const disponible = data
    .filter(c => (c.status || '').toLowerCase() === 'issued')
    .reduce((a, c) => a + toDisplayAmount(Number((c as any).total ?? (c as any).baseTotal ?? 0), resolveSourceCurrency((c as any)?.currency), (c as any)?.exchangeRate), 0);
  const aplicados = data
    .filter(c => ['applied', 'partial', 'paid'].includes((c.status || '').toLowerCase()))
    .reduce((a, c) => a + toDisplayAmount(Number((c as any).total ?? (c as any).baseTotal ?? 0), resolveSourceCurrency((c as any)?.currency), (c as any)?.exchangeRate), 0);
  const kpis = [
    { title: `Crédito Disponible (${displayCurrency}${valuationModeSuffix})`, value: formatCurrentAmount(disponible, displayCurrency), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', kind: 'indicator' as const },
    { title: 'Total Créditos', value: data.length, icon: Hash, color: 'text-blue-500', bg: 'bg-blue-500/10', kind: 'indicator' as const },
    { title: 'Emitidos', value: data.filter(c => (c.status||'').toLowerCase() === 'issued').length, icon: BadgeDollarSign, color: 'text-purple-500', bg: 'bg-purple-500/10', kind: 'filter' as const, filter: 'ISSUED' as const },
    { title: `Pagados (${displayCurrency}${valuationModeSuffix})`, value: formatCurrentAmount(aplicados, displayCurrency), icon: CheckCircle2, color: 'text-teal-500', bg: 'bg-teal-500/10', kind: 'filter' as const, filter: 'APPLIED' as const },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="purchases-list-kpis">
        {kpis.map((k, i) => (
          <PurchaseKpiCard key={i} title={k.title} value={k.value} icon={k.icon} color={k.color} bg={k.bg} kind={k.kind} active={k.filter === statusFilter} onClick={k.filter ? () => setStatusFilter(statusFilter === k.filter ? 'ALL' : k.filter) : undefined} />
        ))}
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight" data-tour="purchases-list-title">Créditos de Proveedor</h2></div>
          <div className="erp-list-toolbar flex flex-wrap items-center justify-end gap-3" data-tour="purchases-list-actions">
            <PurchaseViewTutorial view="credits" />
            <PdfDownloadButton label="Exportar" includeRoll={false} onDownload={(format) => void handleExportListPdf(format)} />
            <ViewLayoutSelect value={layoutMode} onChange={(value) => setLayoutMode(value === 'kanban' ? 'table' : value)} ariaLabel="Elegir distribución de créditos de proveedor" />
            {canPerform('PURCHASES_RETURNS', 'create') && (
              <Button onClick={() => openEditor('NEW')} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Nuevo Crédito</Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar por número, proveedor o factura..." className="pl-9 h-10 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); onSearchChange?.(e.target.value); }} /></div>
        </div>
        <EditableDataTable data={filteredData} columns={columns} onRowUpdate={handleUpdate} onRowClick={(row) => setDetailCredit(row)} isLoading={loading} pagination={pagination} layoutMode={layoutMode === 'cards' ? 'cards' : 'responsive'}
          actions={(row) => {
            return (
             <div className="flex items-center gap-1">
              <Button title="Ver detalle" aria-label="Ver detalle del crédito" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setDetailCredit(row)}><Eye className="size-4" /></Button>
              {canPerform('PURCHASES_RETURNS', 'edit') && <Button title="Editar crédito" aria-label="Editar crédito" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={(event) => { event.stopPropagation(); setDetailCredit(null); openEditor(row.id); }}><Pencil className="size-4" /></Button>}
            </div>
          );
          }}
        />
      </div>

      <SalesDocumentDetailSheet
        document={detailCredit ? {
          id: detailCredit.id,
          number: String(detailCredit.number || detailCredit.id),
          title: 'Crédito de proveedor',
          customerName: detailCredit.supplier?.name || 'Sin proveedor',
          hideCustomer: true,
          status: String(detailCredit.status || '').toUpperCase(),
          totalLabel: formatConvertedAmount(Number(detailCredit.total || 0), resolveSourceCurrency((detailCredit as any).currency), (detailCredit as any).exchangeRate),
          summaryDetails: [{ label: 'Documento origen', value: detailCredit.supplierInvoice?.number || 'Sin factura' }, { label: 'Moneda', value: resolveSourceCurrency((detailCredit as any).currency) }],
          metadata: [{ label: 'Proveedor', value: detailCredit.supplier?.name || 'No disponible' }, { label: 'Fecha', value: detailCredit.date ? formatDateEs(detailCredit.date) : 'No disponible' }, { label: 'Estado', value: statusOpts.find((option) => option.value === String(detailCredit.status || '').toLowerCase())?.label || detailCredit.status || '—' }],
          lines: ((detailCredit as any).items || []).map((item: any, index: number) => ({ id: String(item.id || index), description: item.description || item.name || 'Artículo sin descripción', quantity: Number(item.quantity || 0), unitPriceLabel: formatConvertedAmount(Number(item.unitPrice || 0), resolveSourceCurrency((detailCredit as any).currency), (detailCredit as any).exchangeRate), totalLabel: formatConvertedAmount(Number(item.total || 0), resolveSourceCurrency((detailCredit as any).currency), (detailCredit as any).exchangeRate), secondaryLabel: item.commercialNoteSnapshot ? `Nota: ${item.commercialNoteSnapshot}` : undefined })),
        } : null}
        entity="SUPPLIER_CREDIT"
        open={Boolean(detailCredit)}
        onClose={() => setDetailCredit(null)}
        extraActions={detailCredit && (() => {
          const status = String(detailCredit.status || '').toUpperCase();
          return <>
            {canPerform('PURCHASES_RETURNS', 'approve') && status === 'DRAFT' && <Button type="button" variant="outline" className="gap-2 rounded-xl text-xs text-blue-600" onClick={() => setPendingIssueId(detailCredit.id)}><Send className="size-4" /> Emitir</Button>}
            {canPerform('PURCHASES_RETURNS', 'approve') && status === 'ISSUED' && <Button type="button" variant="outline" className="gap-2 rounded-xl text-xs text-emerald-600" onClick={() => setApplyTarget(detailCredit)}><CheckCircle2 className="size-4" /> Aplicar</Button>}
            {canPerform('PURCHASES_RETURNS', 'delete') && ['DRAFT', 'ISSUED'].includes(status) && <Button type="button" variant="outline" className="gap-2 rounded-xl text-xs text-rose-500" onClick={() => setPendingVoidId(detailCredit.id)}><Ban className="size-4" /> Anular</Button>}
          </>;
        })()}
        onDownloadPdf={(format) => detailCredit ? void handleDownloadCreditPdf(detailCredit, format) : undefined}
      />

      <ConfirmDialog
        open={pendingIssueId !== null}
        onOpenChange={(open) => !open && setPendingIssueId(null)}
        loading={issueLoading}
        title="Emitir crédito de proveedor"
        description="Al emitir el crédito se reconocerá la cuenta por pagar y, si está vinculado a una factura, se descontará su saldo pendiente. ¿Deseas continuar?"
        confirmLabel="Confirmar crédito"
        onConfirm={handleIssueConfirm}
      />

      <Dialog open={applyTarget !== null} onOpenChange={(open) => !open && setApplyTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader data-tour="purchases-credit-modal-title">
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="size-5 text-emerald-500" /> Aplicar crédito {applyTarget?.number}</DialogTitle>
            <DialogDescription>
              Al aplicar el crédito se cancelará la cuenta por pagar asociada y se generará el asiento contable de pago. Esta acción no se puede deshacer.
            </DialogDescription>
            <PurchaseViewTutorial view="credits" context="form" labelOverride="Cómo aplicar crédito" stepKeys={['title', 'data', 'summary', 'actions']} targetPrefix="purchases-credit-modal" />
          </DialogHeader>
          {applyTarget && (
            <div className="space-y-4" data-tour="purchases-credit-modal-data">
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2 text-sm" data-tour="purchases-credit-modal-summary">
                <div className="flex justify-between"><span className="text-muted-foreground">Proveedor</span><b>{applyTarget.supplier?.name || '-'}</b></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Monto</span><b className="text-emerald-600"><CurrencyValuationAmount amount={Number(applyTarget.total || 0)} sourceCurrency={resolveSourceCurrency((applyTarget as any)?.currency)} sourceExchangeRate={(applyTarget as any)?.exchangeRate} /></b></div>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs leading-relaxed text-muted-foreground">
                El pago cancelará la cuenta por pagar del proveedor. Se registrará el movimiento bancario y el asiento contable correspondiente.
              </div>
            </div>
          )}
          <DialogFooter data-tour="purchases-credit-modal-actions">
            <Button variant="outline" onClick={() => setApplyTarget(null)}>Cancelar</Button>
            <Button onClick={handleApplyConfirm} disabled={applyLoading} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 className="size-4" /> {applyLoading ? 'Aplicando...' : 'Aplicar crédito'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingVoidId !== null}
        onOpenChange={(open) => !open && setPendingVoidId(null)}
        loading={voidLoading}
        title="Anular Crédito de Proveedor"
        description="El crédito quedará marcado como ANULADO y se devolverá el saldo a la factura vinculada (si la tiene). Esta acción no se puede deshacer."
        confirmLabel="Anular crédito"
        onConfirm={handleVoidConfirm}
      />
    </div>
  );
}
