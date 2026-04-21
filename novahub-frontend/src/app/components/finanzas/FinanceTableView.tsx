import { useState, useEffect } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '../ui/table';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import {
  Plus, Trash2, Search, Filter, Download,
  CheckCircle2, Edit3, FileSpreadsheet, FileText, X, FileUp,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '../ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../ui/utils';
import { toast } from 'sonner';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Column {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'datetime' | 'select' | 'currency';
  options?: { value: string; label: string }[];
  editable?: boolean;
  render?: (value: any, item: any) => React.ReactNode;
}

interface FinanceTableViewProps {
  data: any[];
  columns: Column[];
  onUpdate: (id: string, updates: any) => Promise<void>;
  onAdd: () => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  title: string;
  loading?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  onImportClick?: () => void;
}

export function FinanceTableView({
  data,
  columns,
  onUpdate,
  onAdd,
  onDelete,
  title,
  loading,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  onImportClick
}: FinanceTableViewProps) {
  const { displayCurrency, formatConvertedAmount } = useCurrency();
  const sym = displayCurrency === 'USD' ? '$' : 'C$';
  const { user } = useAuth();
  const { themeConfig } = useTheme();
  const [localData, setLocalData] = useState<any[]>(data);
  const [editingCell, setEditingCell] = useState<{ id: string; key: string } | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryTargetItem, setCategoryTargetItem] = useState<{ id: string; key: string } | null>(null);

  // Edit Modal State (Mobile/Alternative Desktop)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [itemBeingEdited, setItemBeingEdited] = useState<any | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // Pagination State
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE_OPTIONS = [10, 15, 25, 30, 35, 40, 45, 50];

  useEffect(() => { setLocalData(data); }, [data]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, dateRange, pageSize]);

  const handleCellEdit = (id: string, key: string, value: any) => {
    setLocalData(prev => prev.map(item => {
      if (item.id === id) {
        if (item.isPayment) { toast.error('No se puede editar un pago de factura desde este módulo'); return item; }
        return { ...item, [key]: value, isDraft: true };
      }
      return item;
    }));
  };

  const handleBlur = async (id: string, key: string, originalValue: any, newValue: any) => {
    setEditingCell(null);
    if (originalValue === newValue) return;
    try {
      setSavingIds(prev => new Set(prev).add(id));
      await onUpdate(id, { [key]: newValue });
      toast.success('Cambio guardado automáticamente');
      setLocalData(prev => prev.map(item => item.id === id ? { ...item, isDraft: false } : item));
    } catch { toast.error('Error al guardar cambio'); }
    finally { setSavingIds(prev => { const n = new Set(prev); n.delete(id); return n; }); }
  };

  const handleDelete = async (id: string) => {
    try { setDeleteLoading(true); await onDelete(id); }
    catch { toast.error('Error al eliminar registro'); }
    finally { setDeleteLoading(false); setPendingDeleteId(null); }
  };

  const handleSaveNewCategory = async () => {
    if (!newCategoryName.trim() || !categoryTargetItem) return;
    const upperCat = newCategoryName.trim().toUpperCase();
    handleCellEdit(categoryTargetItem.id, categoryTargetItem.key, upperCat);
    await handleBlur(categoryTargetItem.id, categoryTargetItem.key, data.find(d => d.id === categoryTargetItem.id)?.[categoryTargetItem.key], upperCat);
    setIsCategoryDialogOpen(false); setNewCategoryName(''); setCategoryTargetItem(null);
    toast.success(`Categoría "${upperCat}" creada y asignada`);
  };

  const handleModalSave = async () => {
    if (!itemBeingEdited) return;
    try {
      setEditLoading(true);
      const original = data.find(d => d.id === itemBeingEdited.id);
      if (!original) return;

      const updates: any = {};
      columns.forEach(col => {
        if (col.editable && itemBeingEdited[col.key] !== original[col.key]) {
          updates[col.key] = itemBeingEdited[col.key];
        }
      });

      if (Object.keys(updates).length > 0) {
        await onUpdate(itemBeingEdited.id, updates);
        toast.success('Registro actualizado exitosamente');
      }
      setIsEditModalOpen(false);
      setItemBeingEdited(null);
    } catch {
      toast.error('Error al actualizar registro');
    } finally {
      setEditLoading(false);
    }
  };

  const filteredData = (localData || []).filter(item => {
    if (!item) return false;
    const matchesSearch = Object.values(item).some(val => String(val).toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter ? (item.category || '').toLowerCase().includes(categoryFilter.toLowerCase()) : true;
    let matchesDate = true;
    if (dateRange.start || dateRange.end) {
      const itemDateMs = new Date(item.date || item.createdAt).getTime();
      if (dateRange.start) matchesDate = matchesDate && itemDateMs >= new Date(dateRange.start).getTime();
      if (dateRange.end) { const e = new Date(dateRange.end); e.setHours(23,59,59,999); matchesDate = matchesDate && itemDateMs <= e.getTime(); }
    }
    return matchesSearch && matchesCategory && matchesDate;
  });

  const companyName = (themeConfig.tenantName || user?.tenantName || 'Mi Empresa').toUpperCase();
  const logoUrl = themeConfig.logo || '';
  const now = new Date();
  const reportTimestamp = `${now.toLocaleDateString('es-NI')} ${now.toLocaleTimeString('es-NI')}`;

  // Pagination Logic
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getLabelForValue = (col: Column, value: any) => {
    if (value && col.options) {
      const opt = col.options.find(o => o.value === value);
      if (opt) return opt.label;
    }
    return value || '-';
  };

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
    } catch (e) {
      return null;
    }
  };

  const exportExcel = async () => {
    try {
      toast.info("Generando Excel, por favor espere...");
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Reporte');
      const primaryColor = themeConfig.colors.primary || '#10b981';
      // Simple check to extract hex if it's there, else fallback
      const hexColor = primaryColor.startsWith('#') ? primaryColor.replace('#', '') : '10b981';

      // Set base column widths (no headers here to avoid repeating on row 1)
      ws.columns = columns.map(c => ({
        header: '',
        key: c.key,
        width: Math.max(15, c.label.length + 5)
      }));

      let currentRow = 1;
      const totalcols = columns.length;
      const lastColChar = String.fromCharCode(64 + totalcols);

      // Logo - Centered at top
      if (logoUrl) {
         const base64Logo = await getBase64Image(logoUrl);
         if (base64Logo) {
            const logoId = wb.addImage({ base64: base64Logo, extension: 'png' });
            ws.addImage(logoId, {
              tl: { col: Math.floor(totalcols / 2) - 1, row: 0 },
              ext: { width: 100, height: 100 }
            });
            currentRow = 6; // Leave space for logo
         }
      }

      // Branding - Centered below logo
      ws.mergeCells(`A${currentRow}:${lastColChar}${currentRow}`);
      const cellName = ws.getCell(`A${currentRow}`);
      cellName.value = companyName;
      cellName.font = { size: 16, bold: true, color: { argb: `FF${hexColor}` } };
      cellName.alignment = { horizontal: 'center' };
      currentRow++;

      ws.mergeCells(`A${currentRow}:${lastColChar}${currentRow}`);
      const cellTitle = ws.getCell(`A${currentRow}`);
      cellTitle.value = title;
      cellTitle.font = { size: 12, bold: true };
      cellTitle.alignment = { horizontal: 'center' };
      currentRow++;

      ws.mergeCells(`A${currentRow}:${lastColChar}${currentRow}`);
      const cellDate = ws.getCell(`A${currentRow}`);
      cellDate.value = `Generado: ${reportTimestamp}`;
      cellDate.font = { size: 10, italic: true, color: { argb: 'FF666666' } };
      cellDate.alignment = { horizontal: 'center' };
      currentRow++;

      ws.mergeCells(`A${currentRow}:${lastColChar}${currentRow}`);
      const cellCurrency = ws.getCell(`A${currentRow}`);
      const currencyLabel = displayCurrency === 'USD' ? 'Dólares (USD)' : 'Córdobas (NIO)';
      cellCurrency.value = `Moneda del Reporte: ${currencyLabel} (${sym})`;
      cellCurrency.font = { size: 10, bold: true, color: { argb: 'FF333333' } };
      cellCurrency.alignment = { horizontal: 'center' };
      currentRow += 2;

      // Table Header
      const headerRow = ws.getRow(currentRow);
      headerRow.values = columns.map(c => c.label);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.alignment = { horizontal: 'center' };
      headerRow.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hexColor}` } };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
      currentRow++;

      // Data Rows
      filteredData.forEach(item => {
        const rowData = columns.map(col => {
          if (col.type === 'currency') return Number(item[col.key] || 0);
          if (col.type === 'date' || col.type === 'datetime') return item[col.key] ? new Date(item[col.key]) : null;
          if (col.type === 'select') return getLabelForValue(col, item[col.key]);
          return item[col.key] || '';
        });
        const r = ws.getRow(currentRow);
        r.values = rowData;
        
        columns.forEach((col, idx) => {
          const cell = r.getCell(idx + 1);
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          if (col.type === 'currency') {
            cell.numFmt = '"' + sym + '" #,##0.00';
            cell.alignment = { horizontal: 'right' };
          }
          if (col.type === 'date' || col.type === 'datetime') {
             cell.numFmt = col.type === 'datetime' ? 'dd/mm/yyyy hh:mm' : 'dd/mm/yyyy';
          }
        });
        currentRow++;
      });

      // Autofit col widths (simplified)
      ws.columns.forEach(column => {
        let maxLen = 0;
        column.eachCell!({ includeEmpty: true }, (cell) => {
          const len = cell.value ? String(cell.value).length : 0;
          if (len > maxLen) maxLen = len;
        });
        column.width = Math.min(50, Math.max(column.width || 10, maxLen + 2));
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}_${now.toISOString().split('T')[0]}.xlsx`;
      a.click();
      toast.success("Excel exportado exitosamente");
    } catch (e) { 
      console.error(e);
      toast.error("Error al exportar Excel"); 
    }
  };

  const exportPDF = async () => {
    try {
      toast.info("Generando PDF, por favor espere...");
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const primaryColor = themeConfig.colors.primary || '#10b981';
      const rgbPrimary = primaryColor.startsWith('#') 
        ? [parseInt(primaryColor.slice(1,3), 16), parseInt(primaryColor.slice(3,5), 16), parseInt(primaryColor.slice(5,7), 16)]
        : [16, 185, 129];

      let currentY = 15;
      if (logoUrl) {
        const logoBase64 = await getBase64Image(logoUrl);
        if (logoBase64) {
          doc.addImage(logoBase64, 'PNG', (pageWidth - 30) / 2, currentY, 30, 30, undefined, 'FAST');
          currentY += 35;
        }
      }

      // Header with company name
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(rgbPrimary[0], rgbPrimary[1], rgbPrimary[2]);
      doc.text(companyName, pageWidth / 2, currentY, { align: 'center' });
      currentY += 8;

      // Report title
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 60, 60);
      doc.text(title, pageWidth / 2, currentY, { align: 'center' });
      currentY += 6;

      // Timestamp
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(`Generado: ${reportTimestamp}`, pageWidth / 2, currentY, { align: 'center' });
      currentY += 4;

      // Separator line
      doc.setDrawColor(rgbPrimary[0], rgbPrimary[1], rgbPrimary[2]);
      doc.setLineWidth(0.8);
      doc.line(14, currentY, pageWidth - 14, currentY);
      currentY += 8;

      doc.setTextColor(0, 0, 0);

      const head = [columns.map(c => c.label)];
      const body = filteredData.map(item => columns.map(col => {
        if (col.type === 'currency') return formatConvertedAmount(Number(item[col.key] || 0), item.currency, item.exchangeRate);
        if (col.type === 'date' || col.type === 'datetime') return item[col.key] ? new Date(item[col.key]).toLocaleString('es-NI') : '-';
        if (col.type === 'select') return getLabelForValue(col, item[col.key]);
        return String(item[col.key] || '-');
      }));

      autoTable(doc, {
        head,
        body,
        startY: currentY,
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: {
          fillColor: rgbPrimary as [number, number, number],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
        },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 14, right: 14 },
      });

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`${companyName} - Página ${i} de ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
      }

      doc.save(`${title.replace(/\s+/g, '_')}_${now.toISOString().split('T')[0]}.pdf`);
      toast.success("PDF exportado exitosamente");
    } catch (e) { toast.error("Error al exportar PDF"); }
  };

  const renderCellContent = (item: any, col: Column) => {
    if (col.render) return col.render(item[col.key], item);
    const value = item[col.key];
    if (col.type === 'currency') {
      const n = Number(value || 0);
      return <span className={n >= 0 ? "text-emerald-500" : "text-rose-500"}>{formatConvertedAmount(n, item.currency, item.exchangeRate)}</span>;
    }
    if (col.type === 'date' || col.type === 'datetime') {
      if (!value) return '-';
      const d = new Date(value);
      if (isNaN(d.getTime())) return String(value);
      return col.type === 'datetime' ? d.toLocaleString('es-NI') : d.toLocaleDateString('es-NI');
    }
    if (col.type === 'select') {
      const label = getLabelForValue(col, value);
      if (col.key === 'status') {
        const isActive = value === 'ACTIVE';
        return (
          <Badge className={cn("font-bold uppercase text-[10px] text-white", isActive ? "bg-primary hover:bg-primary/90" : "bg-muted-foreground hover:bg-muted-foreground/90")}>
            {label}
          </Badge>
        );
      }
      return <Badge variant="secondary" className="font-semibold uppercase text-[10px]">{label}</Badge>;
    }
    return value || '-';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold">{title}</h3>
          <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest border-primary/30 text-primary">LIVE SYNC</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9 w-[200px] lg:w-[300px]" />
          </div>
          <button onClick={() => setShowFilters(!showFilters)} className={cn("flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors", showFilters ? "bg-primary/10 border-primary/30 text-primary" : "border-border bg-background hover:bg-muted")}>
            <Filter className="size-4" /> Filtros
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"><Download className="size-4" /> Exportar</button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportExcel}><FileSpreadsheet className="size-4 mr-2 text-green-600" /> Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={exportPDF}><FileText className="size-4 mr-2 text-red-500" /> PDF (.pdf)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {onImportClick && (
            <button onClick={onImportClick} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted"><FileUp className="size-4" /> Importar</button>
          )}
          {canCreate && (
            <button onClick={onAdd} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"><Plus className="size-4" /> Nuevo Registro</button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-4 p-4 bg-muted/30 rounded-xl border border-border/50 animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categoría</label>
            <Input placeholder="Filtrar..." value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="h-8 max-w-[200px]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fecha Inicio</label>
            <Input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} className="h-8 max-w-[150px]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Fecha Fin</label>
            <Input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} className="h-8 max-w-[150px]" />
          </div>
          {(categoryFilter || dateRange.start || dateRange.end) && (
            <div className="flex items-end">
              <button onClick={() => { setCategoryFilter(''); setDateRange({ start: '', end: '' }); }} className="h-8 px-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"><X className="size-3" /> Limpiar</button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog open={pendingDeleteId !== null} onOpenChange={o => { if (!o) setPendingDeleteId(null); }} title="¿Eliminar registro?" description="¿Estás seguro de que deseas eliminar este registro financiero? Esta acción no se puede deshacer." confirmLabel="Eliminar" variant="destructive" loading={deleteLoading} onConfirm={() => pendingDeleteId ? handleDelete(pendingDeleteId) : Promise.resolve()} />

      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>Nueva Categoría</DialogTitle><DialogDescription>Crea una nueva categoría para clasificar tus registros financieros.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Nombre</Label>
              <Input className="col-span-3" placeholder="Ej: SERVICIOS, NÓMINA..." value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSaveNewCategory(); }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCategoryDialogOpen(false); setNewCategoryName(''); }}>Cancelar</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSaveNewCategory} disabled={!newCategoryName.trim()}>Crear Categoría</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Edit Modal (Mainly for Mobile) */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="size-5 text-primary" /> Editar Registro
            </DialogTitle>
            <DialogDescription>
              Realiza los cambios necesarios en este registro financiero.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-5 py-4 max-h-[60vh] overflow-y-auto px-1">
            {itemBeingEdited && columns.filter(c => c.editable).map(col => (
              <div key={col.key} className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{col.label}</Label>
                {col.type === 'select' ? (
                  <Select 
                    value={itemBeingEdited[col.key] || ''}
                    onValueChange={val => setItemBeingEdited({...itemBeingEdited, [col.key]: val})}
                  >
                    <SelectTrigger className="h-10 w-full rounded-xl border border-input bg-background/50 px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 shadow-sm">
                      <SelectValue placeholder="Seleccione..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/50 shadow-2xl">
                      {(col.options || []).map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="font-bold text-xs">{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input 
                    type={col.type === 'number' ? 'number' : col.type.includes('date') ? 'date' : 'text'}
                    value={itemBeingEdited[col.key] || ''}
                    onChange={e => setItemBeingEdited({...itemBeingEdited, [col.key]: col.type === 'number' ? Number(e.target.value) : e.target.value})}
                    className="h-10 rounded-xl bg-background/50"
                  />
                )}
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="rounded-xl grow sm:grow-0">Cancelar</Button>
            <Button 
              onClick={handleModalSave} 
              disabled={editLoading}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl grow sm:grow-0"
            >
              {editLoading ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="w-[40px]"></TableHead>
                {columns.map(col => <TableHead key={col.key} className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{col.label}</TableHead>)}
                <TableHead className="w-[80px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={columns.length + 2} className="h-24 text-center">Cargando datos...</TableCell></TableRow>
              ) : paginatedData.length === 0 ? (
                <TableRow><TableCell colSpan={columns.length + 2} className="h-24 text-center">No hay registros</TableCell></TableRow>
              ) : paginatedData.map(item => (
                <TableRow key={item.id} className="group hover:bg-muted/30 border-border/30 transition-colors">
                  <TableCell>
                    {savingIds.has(item.id) ? <div className="size-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    : item.isPayment ? <div className="size-4 rounded-full bg-emerald-500/20 flex items-center justify-center" title="Pago de Compras (Solo lectura)"><CheckCircle2 className="size-3 text-emerald-600" /></div>
                    : item.isDraft ? <Edit3 className="size-4 text-orange-400" />
                    : <CheckCircle2 className="size-4 text-green-500/50" />}
                  </TableCell>
                  {columns.map(col => (
                    <TableCell key={col.key} className={cn("p-1.5 transition-all", editingCell?.id === item.id && editingCell?.key === col.key ? "bg-primary/5 ring-1 ring-inset ring-primary" : "")} onDoubleClick={() => canEdit && col.editable && setEditingCell({ id: item.id, key: col.key })}>
                      {editingCell?.id === item.id && editingCell?.key === col.key ? (
                        col.type === 'select' ? (
                          <Select 
                            value={item[col.key] || ''}
                            onValueChange={val => { 
                              if (val === '___NEW___') { 
                                setCategoryTargetItem({ id: item.id, key: col.key }); 
                                setIsCategoryDialogOpen(true); 
                                setEditingCell(null); 
                              } else {
                                handleCellEdit(item.id, col.key, val);
                                handleBlur(item.id, col.key, data.find(d => d.id === item.id)?.[col.key], val);
                              }
                            }}
                          >
                            <SelectTrigger className="w-full bg-transparent border-none h-auto p-0 focus:ring-0 shadow-none font-medium">
                              <SelectValue placeholder="Seleccione..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/50 shadow-2xl">
                              {item[col.key] && !(col.options || []).find(o => o.value === item[col.key]) && (
                                <SelectItem value={item[col.key]} className="font-bold text-xs">{item[col.key]}</SelectItem>
                              )}
                              {(col.options || []).map(opt => (
                                <SelectItem key={opt.value} value={opt.value} className="font-bold text-xs">{opt.label}</SelectItem>
                              ))}
                              {col.key === 'category' && (
                                <SelectItem value="___NEW___" className="font-bold text-xs text-primary">+ Nueva Categoría...</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        ) : (
                          <input autoFocus type={col.type === 'number' ? 'number' : col.type.includes('date') ? 'date' : 'text'} className="w-full bg-transparent border-none outline-none text-sm px-1 font-medium" value={item[col.key] || ''}
                            onChange={e => handleCellEdit(item.id, col.key, col.type === 'number' ? Number(e.target.value) : e.target.value)}
                            onBlur={e => handleBlur(item.id, col.key, data.find(d => d.id === item.id)?.[col.key], e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingCell(null); }} />
                        )
                      ) : (
                        <div className={cn("px-1 py-1 text-sm cursor-pointer hover:bg-muted/50 rounded transition-colors", col.type === 'currency' ? "font-bold" : "font-medium")} onClick={() => canEdit && col.editable && setEditingCell({ id: item.id, key: col.key })}>
                          {renderCellContent(item, col)}
                        </div>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canEdit && (
                        <button onClick={() => { if (item.isPayment) toast.error('No se puede editar un pago de factura'); else setEditingCell({ id: item.id, key: columns.find(c => c.editable)?.key || columns[0].key }); }} disabled={item.isPayment} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-50" title="Editar"><Edit3 className="size-3.5" /></button>
                      )}
                      {canDelete && (
                        <button onClick={() => !item.isPayment && setPendingDeleteId(item.id)} disabled={item.isPayment} className="p-1.5 text-destructive/80 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors disabled:opacity-50" title="Eliminar"><Trash2 className="size-3.5" /></button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="block md:hidden space-y-4 p-4 bg-muted/20">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground bg-card rounded-2xl border border-border/40">Cargando datos...</div>
          ) : paginatedData.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground bg-card rounded-2xl border border-border/40">No hay registros</div>
          ) : paginatedData.map(item => (
            <div key={item.id} className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-5 shadow-sm transition-all hover:shadow-lg active:scale-[0.98]">
              {/* Decorative accent */}
              <div className="absolute -right-4 -top-4 size-16 rounded-full bg-primary/5 blur-2xl" />
              
              <div className="relative flex items-center justify-between mb-4 border-b border-primary/10 pb-3 gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={cn(
                    "size-9 rounded-xl flex items-center justify-center shadow-sm shrink-0",
                    item.isPayment ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary"
                  )}>
                    {savingIds.has(item.id) ? (
                      <div className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    ) : item.isPayment ? (
                      <CheckCircle2 className="size-5" />
                    ) : (
                      <div className="text-[10px] font-black">{item.number?.slice(-3) || '??'}</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 leading-none mb-1">
                      {item.number || 'Registro'}
                    </p>
                    <p className="text-sm font-bold truncate max-w-[140px] xs:max-w-none">
                      {item.source || item.description || 'Sin título'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 bg-background/50 backdrop-blur-sm p-1 rounded-xl border border-border/40 shadow-inner shrink-0 relative z-20">
                  {canEdit && (
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation();
                        if (item.isPayment) toast.error('No se puede editar un pago de factura'); 
                        else { setItemBeingEdited({...item}); setIsEditModalOpen(true); }
                      }} 
                      disabled={item.isPayment} 
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-colors disabled:opacity-30" 
                      title="Editar"
                    >
                      <Edit3 className="size-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!item.isPayment) setPendingDeleteId(item.id);
                      }} 
                      disabled={item.isPayment} 
                      className="p-2 text-rose-500/70 hover:text-rose-600 hover:bg-rose-500/5 rounded-lg transition-colors disabled:opacity-30" 
                      title="Eliminar"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-4 relative">
                {columns.map(col => (
                  <div key={col.key} className={cn("space-y-1 min-w-0 break-words", col.type === 'currency' ? "col-span-1 sm:col-span-2 bg-primary/5 -mx-5 px-5 py-3 border-y border-primary/10 mt-1" : "")}>
                    <p className="text-[9px] font-black uppercase text-muted-foreground/50 tracking-[0.15em] truncate">{col.label}</p>
                    <div className={cn(
                      "transition-all break-words whitespace-normal",
                      col.type === 'currency' ? "text-lg font-black" : "text-sm font-semibold text-foreground/90"
                    )} onDoubleClick={() => canEdit && col.editable && setEditingCell({ id: item.id, key: col.key })}>
                      {renderCellContent(item, col)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Status or meta info */}
              {item.isDraft && (
                <div className="mt-4 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-orange-500 bg-orange-500/5 py-1 px-3 rounded-full w-fit">
                  <span className="size-1.5 rounded-full bg-orange-500 animate-pulse" />
                  Cambios pendientes
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-6 border-t border-border/20 pb-8 px-2">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-xs text-muted-foreground font-medium w-full md:w-auto">
            <div className="flex items-center gap-2">
              <span>Mostrar</span>
              <Select value={String(pageSize)} onValueChange={(val) => setPageSize(Number(val))}>
                <SelectTrigger className="h-8 w-[70px] rounded-lg border bg-background font-bold text-foreground focus:ring-2 focus:ring-primary/20 outline-none shadow-sm">
                  <SelectValue placeholder={String(pageSize)} />
                </SelectTrigger>
                <SelectContent className="rounded-lg border-border/50 shadow-xl min-w-[70px]">
                  {PAGE_SIZE_OPTIONS.map(opt => (
                    <SelectItem key={opt} value={String(opt)} className="font-bold">{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>por página</span>
            </div>
          <div className="h-4 w-px bg-border/40 hidden sm:block" />
          <p className="bg-primary/5 px-4 py-1.5 rounded-full border border-primary/10 text-center sm:text-left">
            Mostrando <span className="text-foreground font-black">{paginatedData.length === 0 ? 0 : (currentPage-1)*pageSize + 1} - {Math.min(currentPage*pageSize, filteredData.length)}</span> de <span className="text-primary font-black">{filteredData.length}</span> registros totales
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-2 rounded-lg border hover:bg-muted disabled:opacity-30 transition-all"><ChevronsLeft className="size-4" /></button>
          <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border hover:bg-muted disabled:opacity-30 transition-all"><ChevronLeft className="size-4" /></button>
          <div className="flex items-center px-4 h-9 rounded-lg border bg-muted/30 font-black text-xs min-w-[100px] justify-center shadow-inner">
            Pág. {currentPage} / {Math.max(1, totalPages)}
          </div>
          <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-2 rounded-lg border hover:bg-muted disabled:opacity-30 transition-all"><ChevronRight className="size-4" /></button>
          <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages || totalPages === 0} className="p-2 rounded-lg border hover:bg-muted disabled:opacity-30 transition-all"><ChevronsRight className="size-4" /></button>
        </div>
      </div>
    </div>
  );
}
