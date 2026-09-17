import React, { useState, useCallback, useRef } from 'react';
import {
  Upload, Download, FileSpreadsheet, X, CheckCircle2, AlertCircle,
  FileUp, Loader2, ArrowRight, Trash2, Eye, FileText
} from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import * as pdfjsLib from 'pdfjs-dist';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

type ImportType = 'incomes' | 'expenses';

interface ImportColumn {
  key: string;
  label: string;
  example: string;
}

interface FinanceImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: ImportType;
  onImport: (data: any[]) => Promise<any>;
  onRefresh: () => void;
}

const COMMON_COLUMNS: ImportColumn[] = [
  { key: 'date', label: 'Fecha', example: '2024-01-31' },
  { key: 'source', label: 'Origen', example: 'Cliente/Proveedor SA' },
  { key: 'description', label: 'Descripción', example: 'Venta de servicios' },
  { key: 'category', label: 'Categoría', example: 'SERVICIOS' },
  { key: 'amount', label: 'Monto', example: '15000' },
  { key: 'currency', label: 'Moneda', example: 'NIO / USD' },
  { key: 'notes', label: 'Notas', example: 'Transferencia bancaria' },
];

function parseExcelDate(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'number') {
    const d = new Date((value - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const d = new Date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

async function parsePdfToRows(arrayBuffer: ArrayBuffer): Promise<string[][]> {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allRows: string[][] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const lineMap = new Map<number, { x: number; text: string }[]>();
    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const y = Math.round((item as any).transform[5]);
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push({ x: (item as any).transform[4], text: item.str.trim() });
    }
    const sortedLines = [...lineMap.entries()].sort((a, b) => b[0] - a[0]);
    for (const [, items] of sortedLines) {
      items.sort((a, b) => a.x - b.x);
      const cells = items.map(i => i.text);
      if (cells.length > 0) allRows.push(cells);
    }
  }
  return allRows;
}

export function FinanceImportModal({
  open, onOpenChange, type, onImport, onRefresh
}: FinanceImportModalProps) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const columns = COMMON_COLUMNS;
  const title = type === 'incomes' ? 'Importar Ingresos' : 'Importar Gastos';
  const itemName = type === 'incomes' ? 'ingresos' : 'gastos';

  const resetState = () => {
    setStep(1);
    setFile(null);
    setParsedData([]);
    setLoading(false);
    setParsing(false);
    setIsDragging(false);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) {
      setFile(f);
      const buffer = await f.arrayBuffer();
      await processFileBuffer(buffer, f.name);
    }
  };

  const handleDownloadExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'NovaHub ERP';
    workbook.created = new Date();

    const ws = workbook.addWorksheet(title);

    // Header row
    const headerRow = ws.addRow(columns.map(c => c.label));
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { bottom: { style: 'medium', color: { argb: 'FF334155' } } };
    });
    ws.getRow(1).height = 28;

    // Example row (will be filtered out on import)
    const exampleRow = ws.addRow(columns.map(c => c.example));
    exampleRow.eachCell((cell) => {
      cell.font = { italic: true, color: { argb: 'FF9CA3AF' }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      cell.alignment = { vertical: 'middle' };
    });
    ws.getRow(2).height = 22;

    columns.forEach((c, i) => {
      const maxLen = Math.max(c.label.length, c.example.length);
      ws.getColumn(i + 1).width = Math.max(maxLen + 6, 16);
    });

    const buf = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla_${itemName}_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Plantilla Excel descargada');
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const sheetTitle = `Plantilla de Importación — ${title}`;
    const today = new Date().toLocaleDateString('es-NI');

    // Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(sheetTitle, 14, 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(`NovaHub ERP • ${today}`, 14, 24);
    doc.setTextColor(0);

    // Main table: first row is example (grayed out), rest empty
    const exampleRowData = columns.map(c => c.example);
    const emptyRows = Array.from({ length: 14 }, () => columns.map(() => ''));
    
    autoTable(doc, {
      startY: 30,
      head: [columns.map(c => c.label)],
      body: [exampleRowData, ...emptyRows],
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 8, minCellHeight: 10 },
      styles: { cellPadding: 3 },
      didParseCell: (data: any) => {
        // Style the example row differently
        if (data.section === 'body' && data.row.index === 0) {
          data.cell.styles.textColor = [156, 163, 175];
          data.cell.styles.fontStyle = 'italic';
          data.cell.styles.fillColor = [249, 250, 251];
        }
      },
    });

    doc.save(`plantilla_${itemName}_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('Plantilla PDF descargada');
  };

  const processFileBuffer = async (buffer: ArrayBuffer, fileName: string) => {
    setParsing(true);
    try {
      let rawData: any[] = [];
      if (fileName.endsWith('.pdf')) {
        const rows = await parsePdfToRows(buffer);
        if (rows.length < 2) throw new Error('El PDF no contiene suficientes filas de datos.');
        const rawHeaders = rows[0].map(h => h.toLowerCase().trim());
        rawData = rows.slice(1).map(rowStrArray => {
          const obj: any = {};
          columns.forEach((c, idx) => { obj[c.label] = rowStrArray[idx] || ''; });
          return obj;
        });
      } else {
        const wb = XLSX.read(buffer, { type: 'array' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        rawData = XLSX.utils.sheet_to_json(ws);
      }

      if (!rawData || rawData.length === 0) {
        throw new Error('El archivo está vacío o no se pudo leer.');
      }

      // Check if first row looks like the example row and filter it if so
      const isExampleRow = (row: any) => {
        return Object.keys(row).some(k => {
          const val = String(row[k] || '');
          return columns.some(c => val.includes(c.example));
        });
      };
      
      let startIdx = 0;
      if (isExampleRow(rawData[0])) startIdx = 1;
      
      const cleanData = rawData.slice(startIdx).map((row: any) => {
        // Map based on matching letters instead of exact key to be robust
        const findVal = (col: ImportColumn) => {
          const k = Object.keys(row).find(key => key.toLowerCase().includes(col.label.toLowerCase().split(' ')[0])); // naive matching
          return k ? row[k] : '';
        };

        const result: any = {};
        columns.forEach(c => {
           result[c.key] = findVal(c);
        });

        // Parse date and amount
        result.date = parseExcelDate(result.date) || new Date().toISOString().split('T')[0];
        try {
           result.amount = parseFloat(String(result.amount).replace(/,/g, '')) || 0;
        } catch {
           result.amount = 0;
        }

        result.currency = ['NIO', 'USD'].includes(String(result.currency).toUpperCase()) ? String(result.currency).toUpperCase() : 'NIO';

        return result;
      });

      setParsedData(cleanData.filter(d => d.amount > 0 || d.description.length > 0));
      setStep(2);
    } catch (e: any) {
      toast.error('Error al procesar el archivo: ' + e.message);
    } finally {
      setParsing(false);
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const buffer = await f.arrayBuffer();
    await processFileBuffer(buffer, f.name);
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    setLoading(true);
    try {
      const res = await onImport(parsedData);
      toast.success(`Se importaron ${res?.count || parsedData.length} registros exitosamente.`);
      onRefresh();
      handleClose();
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Error durante la importación';
      toast.error(typeof msg === 'string' ? msg : msg[0] || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden bg-background">
        <DialogHeader className="p-6 pb-2 border-b">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
              <FileUp className="size-6" />
            </div>
            <div>
              <span className="text-base">{title}</span>
              <p className="text-xs text-muted-foreground font-normal mt-0.5">
                {step === 1 ? 'Descarga la plantilla, llénala e impórtala' : 'Revisa los datos antes de importar'}
              </p>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">Modal para importar {itemName} desde Excel o PDF.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 max-h-[70vh]">
          {step === 1 && (
            <>
              {/* Template Download */}
              <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-5">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -translate-y-8 translate-x-8" />
                <div className="relative z-10 flex items-start gap-3">
                  <div className="size-10 rounded-xl bg-primary flex items-center justify-center shadow-md shrink-0">
                    <Download className="size-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm">Paso 1: Descargar Plantilla</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Descarga la plantilla, llénala con los datos y luego súbela para importar.
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        size="sm"
                        onClick={handleDownloadExcel}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 rounded-xl"
                      >
                        <FileSpreadsheet className="size-4 mr-2" />
                        Excel (.xlsx)
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDownloadPdf}
                        className="rounded-xl border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <FileText className="size-4 mr-2" />
                        PDF
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* File Upload */}
              <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-muted/30 to-muted/10 p-5">
                <div className="flex items-start gap-3 mb-4">
                  <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Upload className="size-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Paso 2: Subir Archivo</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Sube tu plantilla llena o un archivo PDF con datos</p>
                  </div>
                </div>

                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
                    isDragging
                      ? 'border-primary bg-primary/5 scale-[1.02]'
                      : 'border-border/40 hover:border-primary/50 hover:bg-primary/5'
                  }`}
                >
                  {parsing ? (
                    <Loader2 className="size-10 mx-auto mb-3 text-primary animate-spin" />
                  ) : (
                    <FileUp className={`size-10 mx-auto mb-3 transition-colors ${isDragging ? 'text-primary' : 'text-muted-foreground/40'}`} />
                  )}
                  <p className="text-sm font-semibold">
                    {parsing ? 'Procesando archivo...' : isDragging ? 'Suelta el archivo aquí' : 'Arrastra y suelta tu archivo aquí'}
                  </p>
                  <div className="flex items-center justify-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FileSpreadsheet className="size-3.5" /> .xlsx
                    </span>
                    <span className="text-border">|</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FileText className="size-3.5" /> .pdf
                    </span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.pdf"
                    onChange={onFileChange}
                    className="hidden"
                  />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-muted/20">
                {file?.name.endsWith('.pdf')
                  ? <FileText className="size-8 text-red-500" />
                  : <FileSpreadsheet className="size-8 text-primary" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{file?.name}</p>
                  <p className="text-xs text-muted-foreground">{parsedData.length} registro(s)</p>
                </div>
                <Button variant="ghost" size="sm" onClick={resetState} className="text-muted-foreground hover:text-red-500">
                  <Trash2 className="size-4" />
                </Button>
              </div>

              {parsedData.length > 0 && (
                <div className="rounded-xl border border-border/40 overflow-hidden">
                  <div className="px-3 py-2 bg-muted/30 border-b border-border/40 flex items-center gap-2">
                    <Eye className="size-4 text-primary" />
                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                      Vista Previa ({Math.min(parsedData.length, 5)} de {parsedData.length})
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/20">
                        <tr>
                          {columns.slice(0, 6).map(col => (
                            <th key={col.key} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{col.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {parsedData.slice(0, 5).map((row, i) => (
                          <tr key={i} className="hover:bg-muted/10">
                            {columns.slice(0, 6).map(c => (
                              <td key={c.key} className="px-3 py-2 max-w-[120px] truncate">
                                {c.key === 'amount' ? (
                                  <span className={row.amount < 0 ? 'text-rose-500' : 'text-emerald-500 font-medium'}>{row.currency || 'NIO'} {row[c.key]}</span>
                                ) : (
                                  String(row[c.key] || '-')
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedData.length > 5 && (
                    <div className="px-3 py-2 bg-muted/10 border-t border-border/20 text-center text-xs text-muted-foreground">
                      ... y {parsedData.length - 5} más
                    </div>
                  )}
                </div>
              )}
              <div className="flex bg-blue-500/10 text-blue-600 p-4 rounded-xl items-start gap-3 mt-4">
                <AlertCircle className="size-5 shrink-0" />
                <div className="text-sm flex flex-col gap-1">
                  <span className="font-bold">Nota de Importación: </span> 
                  <span>La primera fila de la plantilla será omitida automáticamente. Las categorías nuevas se crearán de la misma forma que en la aplicación.</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 bg-muted/20 border-t flex justify-between">
          <div>
            {step === 2 && (
              <Button variant="ghost" onClick={() => setStep(1)} className="gap-2 focus:ring-0" disabled={loading}>
                <ArrowRight className="size-4 rotate-180" /> Subir otro archivo
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={loading} className="rounded-xl">Cancelar</Button>
            {step === 2 && (
              <Button onClick={handleImport} disabled={loading} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} 
                Confirmar Importación
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
