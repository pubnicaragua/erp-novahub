import React, { useState, useCallback, useRef } from 'react';
import {
  Upload, Download, FileSpreadsheet, X, CheckCircle2, AlertCircle,
  FileUp, Loader2, ArrowRight, Trash2, Eye, FileText, Calendar, Settings2, Users,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { ConfigNominaView } from './ConfigNominaView';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import * as pdfjsLib from 'pdfjs-dist';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { hrService } from '../../services/hr.service';

// PDF.js worker from CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// ============================================================
// Types
// ============================================================
type ImportType = 'employees' | 'payroll';

interface ImportColumn {
  key: string;
  label: string;
  example: string;
}

interface ImportDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: ImportType;
  departments: any[];
  positions: any[];
  employees: any[];
  onImport: (data: any[]) => Promise<any>;
  onRefresh: () => void;
  hasPayrollConfig?: boolean;
  onNavigateToConfig?: () => void;
  onBulkProcessPayroll?: (data: any) => Promise<any>;
}

// Month helpers
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// ============================================================
// Column definitions — exact fields from the ERP form
// ============================================================
const EMPLOYEE_COLUMNS: ImportColumn[] = [
  { key: 'firstName', label: 'Nombre', example: 'Juan' },
  { key: 'lastName', label: 'Apellido', example: 'Pérez' },
  { key: 'email', label: 'Correo Electrónico', example: 'juan@empresa.com' },
  { key: 'phone', label: 'Teléfono', example: '+505 8888-0000' },
  { key: 'departmentName', label: 'Departamento', example: 'Contabilidad' },
  { key: 'positionTitle', label: 'Puesto', example: 'Contador' },
  { key: 'salary', label: 'Salario', example: '15000' },
  { key: 'currency', label: 'Moneda', example: 'NIO / USD' },
];

const PAYROLL_COLUMNS: ImportColumn[] = [
  { key: 'employeeNumber', label: 'Número de Empleado', example: 'EMP0001' },
  { key: 'periodStart', label: 'Inicio del Período', example: '2024-01-01' },
  { key: 'periodEnd', label: 'Fin del Período', example: '2024-01-31' },
  { key: 'baseSalary', label: 'Salario Base', example: '15000' },
  { key: 'bonuses', label: 'Bonificaciones', example: '1000' },
  { key: 'deductions', label: 'Deducciones Extra', example: '500' },
  { key: 'overtime', label: 'Horas Extra', example: '2000' },
  { key: 'notes', label: 'Notas', example: 'Nómina regular enero' },
];

// ============================================================
// Helpers
// ============================================================
function generateEmployeeNumber(existingEmployees: any[], index: number): string {
  const nums = existingEmployees.map((e: any) => {
    const m = e.employeeNumber?.match(/\d+$/);
    return m ? parseInt(m[0], 10) : 0;
  });
  return `EMP${String(Math.max(0, ...nums) + 1 + index).padStart(4, '0')}`;
}

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

/** Extract tabular data from a PDF */
async function parsePdfToRows(arrayBuffer: ArrayBuffer): Promise<string[][]> {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allRows: string[][] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Group text items by their Y position (same row)
    const lineMap = new Map<number, { x: number; text: string }[]>();
    for (const item of textContent.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      // Round Y to group nearby items
      const y = Math.round((item as any).transform[5]);
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push({ x: (item as any).transform[4], text: item.str.trim() });
    }

    // Sort lines by Y (top to bottom = descending Y)
    const sortedLines = [...lineMap.entries()]
      .sort((a, b) => b[0] - a[0]);

    for (const [, items] of sortedLines) {
      // Sort items in each line by X position (left to right)
      items.sort((a, b) => a.x - b.x);
      const cells = items.map(i => i.text);
      if (cells.length > 0) allRows.push(cells);
    }
  }

  return allRows;
}

// ============================================================
// Component
// ============================================================
export function ImportDataModal({
  open, onOpenChange, type, departments, positions, employees, onImport, onRefresh,
  hasPayrollConfig, onNavigateToConfig, onBulkProcessPayroll
}: ImportDataModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'result' | 'payroll'>('upload');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Payroll generation state
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]); // Format: "YYYY-M"
  const [employeeMonthMap, setEmployeeMonthMap] = useState<Record<string, string[]>>({});
  const [processingPayroll, setProcessingPayroll] = useState(false);
  const [payrollResult, setPayrollResult] = useState<any>(null);
  const [showEmbeddedConfig, setShowEmbeddedConfig] = useState(false);

  const columns = type === 'employees' ? EMPLOYEE_COLUMNS : PAYROLL_COLUMNS;
  const title = type === 'employees' ? 'Importar Empleados' : 'Importar Nóminas';

  const resetState = () => {
    setStep('upload');
    setParsedData([]);
    setErrors([]);
    setWarnings([]);
    setImporting(false);
    setImportResult(null);
    setFileName('');
    setParsing(false);
    setSelectedMonths([]);
    setEmployeeMonthMap({});
    setCurrentYear(new Date().getFullYear());
    setProcessingPayroll(false);
    setPayrollResult(null);
    setShowEmbeddedConfig(false);
  };

  const handleClose = (v: boolean) => { if (!v) resetState(); onOpenChange(v); };

  // Initialize employee-month map when entering payroll step
  const initPayrollStep = () => {
    const data = importResult?.data || importResult;
    const importedList = data?.importedEmployees || (Array.isArray(data) ? data : []);
    
    // 1. Extraer los números de empleado devueltos tras la inserción exitosa
    const validEmployeeNumbers = importedList
      .map((e: any) => e.employeeNumber)
      .filter(Boolean);

    // 2. Localizar los IDs reales en la lista global basándose en esos números
    const importedIds = employees
      .filter(emp => validEmployeeNumbers.includes(emp.employeeNumber))
      .map(emp => emp.id);
    
    const defaultMap: Record<string, string[]> = {};
    importedIds.forEach((id: string) => { 
      defaultMap[id] = []; 
    });
    
    setEmployeeMonthMap(defaultMap);
    setSelectedMonths([]);
    setPayrollResult(null);
    setStep('payroll');
  };

  // Helper to parse key "YYYY-M" for sorting
  const sortMonthKeys = (a: string, b: string) => {
    const [yA, mA] = a.split('-').map(Number);
    const [yB, mB] = b.split('-').map(Number);
    if (yA !== yB) return yA - yB;
    return mA - mB;
  };

  // Toggle a month for all employees
  const toggleMonth = (month: number) => {
    const key = `${currentYear}-${month}`;
    const isSelected = selectedMonths.includes(key);
    const newMonths = isSelected ? selectedMonths.filter(m => m !== key) : [...selectedMonths, key];
    setSelectedMonths(newMonths);

    // Update all employees
    setEmployeeMonthMap(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(empId => {
        if (isSelected) {
          updated[empId] = updated[empId].filter(m => m !== key);
        } else if (!updated[empId].includes(key)) {
          updated[empId] = [...updated[empId], key].sort(sortMonthKeys);
        }
      });
      return updated;
    });
  };

  // Toggle a month for a specific employee
  const toggleEmployeeMonth = (empId: string, monthKey: string) => {
    setEmployeeMonthMap(prev => {
      const current = prev[empId] || [];
      const hasMonth = current.includes(monthKey);
      return {
        ...prev,
        [empId]: hasMonth ? current.filter(m => m !== monthKey) : [...current, monthKey].sort(sortMonthKeys)
      };
    });
  };

  // Process payroll for selected employees/months
  const handleProcessPayroll = async () => {
    if (!onBulkProcessPayroll) return;
    setProcessingPayroll(true);
    try {
      let totalSuccess = 0;
      let totalFailed = 0;

      // Group by month string ("YYYY-M") and process
      const monthEmployeeGroups: Record<string, string[]> = {};
      Object.entries(employeeMonthMap).forEach(([empId, months]) => {
        months.forEach(monthKey => {
          if (!monthEmployeeGroups[monthKey]) monthEmployeeGroups[monthKey] = [];
          monthEmployeeGroups[monthKey].push(empId);
        });
      });

      for (const [monthKey, empIds] of Object.entries(monthEmployeeGroups)) {
        const [year, month] = monthKey.split('-').map(Number);
        const periodStart = new Date(year, month, 1);
        const periodEnd = new Date(year, month + 1, 0);

        try {
          const result = await onBulkProcessPayroll({
            employeeIds: empIds,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
            includeCommissions: false,
          });
          totalSuccess += result?.count || empIds.length;
        } catch {
          totalFailed += empIds.length;
        }
      }

      setPayrollResult({ success: totalSuccess, failed: totalFailed });
      onRefresh();
      toast.success(`Nóminas generadas: ${totalSuccess} registros`);
    } catch (error: any) {
      toast.error('Error al procesar nóminas');
    } finally {
      setProcessingPayroll(false);
    }
  };

  const handleConfigSaved = async () => {
    // Config was saved inside the embedded view. Go back to payroll list and refresh parent to get true hasPayrollConfig.
    setShowEmbeddedConfig(false);
    onRefresh();
  };

  // ── DOWNLOAD EXCEL TEMPLATE ──
  const handleDownloadExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'NovaHub ERP';
    workbook.created = new Date();

    const ws = workbook.addWorksheet(type === 'employees' ? 'Empleados' : 'Nóminas');

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

    // Reference sheet
    if (type === 'employees') {
      const ref = workbook.addWorksheet('Referencia');
      const h = ref.addRow(['Departamentos Disponibles', '', 'Puestos Disponibles', '', 'Monedas']);
      h.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      const note = ref.addRow(['(Si escribes uno nuevo, se crea automáticamente)', '', '(Si escribes uno nuevo, se crea automáticamente)', '', '']);
      note.eachCell(cell => { cell.font = { italic: true, color: { argb: 'FF059669' }, size: 9 }; });

      const currencies = ['NIO', 'USD'];
      const maxR = Math.max(departments.length, positions.length, currencies.length);
      for (let i = 0; i < maxR; i++) {
        ref.addRow([departments[i]?.name || '', '', positions[i]?.title || '', '', currencies[i] || '']);
      }
      ref.getColumn(1).width = 30; ref.getColumn(3).width = 30; ref.getColumn(5).width = 12;
    }

    if (type === 'payroll' && employees.length > 0) {
      const ref = workbook.addWorksheet('Referencia Empleados');
      const h = ref.addRow(['Número de Empleado', 'Nombre', 'Apellido', 'Salario Actual', 'Moneda']);
      h.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      employees.forEach((emp: any) => {
        ref.addRow([emp.employeeNumber, emp.firstName, emp.lastName, emp.salary, emp.currency || 'NIO']);
      });
      ref.getColumn(1).width = 22; ref.getColumn(2).width = 18; ref.getColumn(3).width = 18; ref.getColumn(4).width = 15; ref.getColumn(5).width = 10;
    }

    const buf = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = type === 'employees'
      ? `plantilla_empleados_${new Date().toISOString().split('T')[0]}.xlsx`
      : `plantilla_nominas_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Plantilla Excel descargada');
  };

  // ── DOWNLOAD PDF TEMPLATE ──
  const handleDownloadPdf = () => {
    const doc = new jsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' });
    const sheetTitle = type === 'employees' ? 'Plantilla de Importación — Empleados' : 'Plantilla de Importación — Nóminas';
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

    // Reference section on a second page
    if (type === 'employees' && (departments.length > 0 || positions.length > 0)) {
      doc.addPage();
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Referencia — Departamentos, Puestos y Monedas', 14, 18);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(5, 150, 105);
      doc.text('Si escribes un departamento o puesto nuevo, se creará automáticamente al importar.', 14, 24);
      doc.setTextColor(0);

      const currencies = ['NIO', 'USD'];
      const maxR = Math.max(departments.length, positions.length, currencies.length);
      const refBody = [];
      for (let i = 0; i < maxR; i++) {
        refBody.push([departments[i]?.name || '', positions[i]?.title || '', currencies[i] || '']);
      }
      autoTable(doc, {
        startY: 28,
        head: [['Departamentos', 'Puestos', 'Monedas']],
        body: refBody,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 8 },
      });
    }

    if (type === 'payroll' && employees.length > 0) {
      doc.addPage();
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Referencia — Empleados Registrados', 14, 18);
      doc.setTextColor(0);

      autoTable(doc, {
        startY: 24,
        head: [['Nº Empleado', 'Nombre', 'Apellido', 'Salario', 'Moneda']],
        body: employees.map((e: any) => [e.employeeNumber, e.firstName, e.lastName, e.salary, e.currency || 'NIO']),
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 8 },
      });
    }

    doc.save(type === 'employees'
      ? `plantilla_empleados_${new Date().toISOString().split('T')[0]}.pdf`
      : `plantilla_nominas_${new Date().toISOString().split('T')[0]}.pdf`
    );
    toast.success('Plantilla PDF descargada');
  };

  // ── Map raw rows (array of objects or arrays) to structured data ──
  const mapAndValidate = useCallback(async (
    rawRows: any[],
    headerKeys: string[] | null, // null = objects with label keys, string[] = ordered column keys
  ) => {
    const headerMap: Record<string, string> = {};
    columns.forEach(c => { headerMap[c.label.toLowerCase().trim()] = c.key; });

    const parseErrors: string[] = [];
    const parseWarnings: string[] = [];
    const newDeptNames = new Set<string>();
    const newPosNames = new Set<string>();

    // Normalize rows to objects with internal keys
    const normalized: any[] = rawRows.map((row, idx) => {
      const mapped: any = {};
      if (headerKeys) {
        // PDF: ordered columns
        headerKeys.forEach((key, ci) => {
          if (key && row[ci] !== undefined) mapped[key] = row[ci];
        });
      } else {
        // Excel: label-keyed objects
        Object.keys(row).forEach(rawKey => {
          const k = headerMap[rawKey.toLowerCase().trim()];
          if (k) mapped[k] = row[rawKey];
        });
      }
      return mapped;
    });

    // First pass: find new departments/positions
    if (type === 'employees') {
      normalized.forEach(m => {
        if (m.departmentName) {
          const n = String(m.departmentName).trim();
          if (n && !departments.find((d: any) => d.name.toLowerCase() === n.toLowerCase())) newDeptNames.add(n);
        }
        if (m.positionTitle) {
          const t = String(m.positionTitle).trim();
          if (t && !positions.find((p: any) => p.title.toLowerCase() === t.toLowerCase())) newPosNames.add(t);
        }
      });
    }

    // Create missing departments/positions
    const createdDepts: Record<string, string> = {};
    const createdPos: Record<string, string> = {};

    for (const name of newDeptNames) {
      try {
        const code = name.replace(/\s+/g, '').substring(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 10000);
        const res = await hrService.createDepartment({ name, code });
        createdDepts[name.toLowerCase()] = res.data?.id || res.id;
        parseWarnings.push(`Departamento "${name}" creado automáticamente`);
      } catch { parseErrors.push(`No se pudo crear el departamento "${name}"`); }
    }

    for (const title of newPosNames) {
      try {
        const code = title.replace(/\s+/g, '').substring(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 10000);
        const deptId = departments[0]?.id || Object.values(createdDepts)[0] || '';
        if (!deptId) { parseErrors.push(`No se pudo crear el puesto "${title}": sin departamentos`); continue; }
        const res = await hrService.createPosition({ title, departmentId: deptId, code });
        createdPos[title.toLowerCase()] = res.data?.id || res.id;
        parseWarnings.push(`Puesto "${title}" creado automáticamente`);
      } catch { parseErrors.push(`No se pudo crear el puesto "${title}"`); }
    }

    const allDepts = [...departments, ...Object.entries(createdDepts).map(([n, id]) => ({ id, name: n }))];
    const allPos = [...positions, ...Object.entries(createdPos).map(([t, id]) => ({ id, title: t }))];

    // Second pass: validate and finalize
    const finalData: any[] = [];
    normalized.forEach((m, idx) => {
      const rowNum = idx + 2; // row 1 = header

      // All fields are required
      columns.forEach(col => {
        if (!m[col.key] || String(m[col.key]).trim() === '') {
          parseErrors.push(`Fila ${rowNum}: "${col.label}" vacío`);
        }
      });

      if (type === 'employees') {
        if (m.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(m.email).trim())) {
          parseErrors.push(`Fila ${rowNum}: Email "${m.email}" no es válido`);
        }

        m.employeeNumber = generateEmployeeNumber(employees, idx);
        m.hireDate = new Date().toISOString().split('T')[0];
        m.contractType = 'FULL_TIME';

        if (m.departmentName) {
          const d = allDepts.find((d: any) => d.name.toLowerCase() === String(m.departmentName).trim().toLowerCase());
          if (d) m.departmentId = d.id;
          else parseErrors.push(`Fila ${rowNum}: Departamento "${m.departmentName}" no encontrado`);
        }
        if (m.positionTitle) {
          const p = allPos.find((p: any) => (p.title || '').toLowerCase() === String(m.positionTitle).trim().toLowerCase());
          if (p) m.positionId = p.id;
          else parseErrors.push(`Fila ${rowNum}: Puesto "${m.positionTitle}" no encontrado`);
        }

        m.salary = Number(m.salary) || 0;
        if (m.salary <= 0) parseWarnings.push(`Fila ${rowNum}: Salario es 0`);
        if (!m.currency) m.currency = 'NIO';

        m.firstName = String(m.firstName || '').trim();
        m.lastName = String(m.lastName || '').trim();
        m.email = String(m.email || '').trim();
        m.phone = m.phone ? String(m.phone).trim() : null;
        delete m.departmentName;
        delete m.positionTitle;
      }

      if (type === 'payroll') {
        if (m.employeeNumber) {
          const emp = employees.find((e: any) =>
            e.employeeNumber?.toLowerCase().trim() === String(m.employeeNumber).toLowerCase().trim()
          );
          if (emp) {
            m.employeeId = emp.id;
            if (!m.baseSalary || Number(m.baseSalary) === 0) {
              m.baseSalary = emp.salary;
              parseWarnings.push(`Fila ${rowNum}: Se usará salario actual (${emp.salary})`);
            }
          } else {
            parseErrors.push(`Fila ${rowNum}: Empleado "${m.employeeNumber}" no encontrado`);
          }
        }

        m.baseSalary = Number(m.baseSalary) || 0;
        m.bonuses = Number(m.bonuses) || 0;
        m.deductions = Number(m.deductions) || 0;
        m.overtime = Number(m.overtime) || 0;

        if (m.periodStart) {
          const d = parseExcelDate(m.periodStart);
          if (d) m.periodStart = d; else parseErrors.push(`Fila ${rowNum}: Fecha inicio inválida`);
        }
        if (m.periodEnd) {
          const d = parseExcelDate(m.periodEnd);
          if (d) m.periodEnd = d; else parseErrors.push(`Fila ${rowNum}: Fecha fin inválida`);
        }

        delete m.employeeNumber;
      }

      finalData.push(m);
    });

    return { data: finalData, errors: parseErrors, warnings: parseWarnings, createdNew: newDeptNames.size > 0 || newPosNames.size > 0 };
  }, [type, columns, departments, positions, employees]);

  // ── PARSE EXCEL ──
  const parseExcel = useCallback(async (buffer: ArrayBuffer) => {
    const data = new Uint8Array(buffer);
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (rawData.length === 0) return { data: [], errors: ['El archivo no contiene datos.'], warnings: [], createdNew: false };

    // Always skip the first data row (example row from the template)
    // Then filter out empty rows
    const withoutExample = rawData.slice(1);

    const filtered = withoutExample.filter((row: any) => {
      const vals = Object.values(row);
      return !vals.every(v => !v || String(v).trim() === '');
    });

    if (filtered.length === 0) return { data: [], errors: ['No se encontraron registros. Agrega datos a partir de la fila 3 (debajo del ejemplo).'], warnings: [], createdNew: false };

    return mapAndValidate(filtered, null);
  }, [mapAndValidate]);

  // ── PARSE PDF ──
  const parsePdf = useCallback(async (buffer: ArrayBuffer) => {
    try {
      const rows = await parsePdfToRows(buffer);

      if (rows.length < 2) {
        return { data: [], errors: ['El PDF no contiene datos tabulares suficientes. Se recomienda usar la plantilla Excel.'], warnings: [], createdNew: false };
      }

      // Try to match first row as headers
      const headerLabels = columns.map(c => c.label.toLowerCase());
      const firstRow = rows[0].map(c => c.toLowerCase().trim());

      // Check if first row looks like our headers
      let headerKeys: string[] = [];
      let dataStartIdx = 0;

      const matchCount = firstRow.filter(cell => headerLabels.some(h => h.includes(cell) || cell.includes(h))).length;

      if (matchCount >= Math.ceil(columns.length / 2)) {
        // First row is headers — map them
        headerKeys = firstRow.map(cell => {
          const col = columns.find(c => c.label.toLowerCase().includes(cell) || cell.includes(c.label.toLowerCase()));
          return col?.key || '';
        });
        dataStartIdx = 1;
      } else {
        // No headers detected, assume columns are in order
        headerKeys = columns.map(c => c.key);
        dataStartIdx = 0;
      }

      const dataRows = rows.slice(dataStartIdx).filter(r => r.some(c => c.trim()));

      if (dataRows.length === 0) {
        return { data: [], errors: ['No se encontraron filas de datos en el PDF.'], warnings: ['Tip: Usa la plantilla Excel para mejores resultados.'], createdNew: false };
      }

      const result = await mapAndValidate(dataRows, headerKeys);
      if (result.warnings.length === 0) {
        result.warnings.push('Los datos fueron extraídos del PDF. Verifica la vista previa antes de importar.');
      }
      return result;
    } catch (err) {
      console.error('PDF parse error:', err);
      return { data: [], errors: ['Error al leer el PDF. Asegúrate de que contiene datos tabulares. Se recomienda usar la plantilla Excel.'], warnings: [], createdNew: false };
    }
  }, [columns, mapAndValidate]);

  // ── HANDLE FILE ──
  const parseFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setParsing(true);

    try {
      const buffer = await file.arrayBuffer();
      const isPdf = file.name.toLowerCase().endsWith('.pdf');

      const result = isPdf ? await parsePdf(buffer) : await parseExcel(buffer);

      setParsedData(result.data);
      setErrors(result.errors);
      setWarnings(result.warnings);
      setStep('preview');

      if (result.createdNew) onRefresh();
    } catch (err) {
      console.error('File parse error:', err);
      setErrors(['Error al procesar el archivo.']);
      setStep('preview');
    } finally {
      setParsing(false);
    }
  }, [parseExcel, parsePdf, onRefresh]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.name.match(/\.(xlsx|xls|pdf)$/i)) {
        toast.error('Solo se permiten archivos Excel (.xlsx) o PDF (.pdf)');
        return;
      }
      parseFile(file);
    }
  }, [parseFile]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  // ── IMPORT ──
  const handleImport = async () => {
    if (errors.length > 0) { toast.error('Corrige los errores antes de importar'); return; }
    setImporting(true);
    try {
      const result = await onImport(parsedData);
      setImportResult(result);
      setStep('result');
      toast.success(`Importación completada: ${result?.success || parsedData.length} registros`);
      onRefresh();
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Error durante la importación';
      toast.error(typeof msg === 'string' ? msg : msg[0] || 'Error');
    } finally {
      setImporting(false);
    }
  };

  // ── RENDER ──
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={cn("overflow-hidden flex flex-col", showEmbeddedConfig ? "sm:max-w-4xl max-h-[95vh]" : "sm:max-w-2xl max-h-[90vh]")}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <FileSpreadsheet className="size-5 text-primary-foreground" />
            </div>
            <div>
              <span className="text-base">{title}</span>
              <p className="text-xs text-muted-foreground font-normal mt-0.5">
                {step === 'upload' ? 'Descarga la plantilla, llénala e impórtala' :
                 step === 'preview' ? 'Revisa los datos antes de importar' :
                 'Resultado de la importación'}
              </p>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Modal para importar {type === 'employees' ? 'empleados' : 'nóminas'} desde Excel o PDF
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1 py-2 space-y-4">
          {/* ── STEP 1: UPLOAD ── */}
          {step === 'upload' && (
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
                      {type === 'employees' && ' Si escribes un departamento o puesto nuevo, se creará automáticamente.'}
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
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              </div>
            </>
          )}

          {/* ── STEP 2: PREVIEW ── */}
          {step === 'preview' && (
            <>
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-muted/20">
                {fileName.endsWith('.pdf')
                  ? <FileText className="size-8 text-red-500" />
                  : <FileSpreadsheet className="size-8 text-primary" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{fileName}</p>
                  <p className="text-xs text-muted-foreground">{parsedData.length} registro(s)</p>
                </div>
                <Button variant="ghost" size="sm" onClick={resetState} className="text-muted-foreground hover:text-red-500">
                  <Trash2 className="size-4" />
                </Button>
              </div>

              {errors.length > 0 && (
                <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="size-4" />
                    <span className="text-xs font-black uppercase tracking-widest">Errores ({errors.length})</span>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                        <span className="text-red-400 mt-0.5">•</span>{e}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {warnings.length > 0 && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertCircle className="size-4" />
                    <span className="text-xs font-black uppercase tracking-widest">Advertencias ({warnings.length})</span>
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-600 flex items-start gap-1.5">
                        <span className="text-amber-400 mt-0.5">•</span>{w}
                      </p>
                    ))}
                  </div>
                </div>
              )}

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
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
                          {columns.slice(0, 6).map(col => (
                            <th key={col.key} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{col.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {parsedData.slice(0, 5).map((row, i) => (
                          <tr key={i} className="hover:bg-muted/10">
                            <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                            {columns.slice(0, 6).map(col => {
                              let v = row[col.key] || '';
                              if (col.key === 'departmentName' && row.departmentId) {
                                v = departments.find((d: any) => d.id === row.departmentId)?.name || '✓ Nuevo';
                              }
                              if (col.key === 'positionTitle' && row.positionId) {
                                v = positions.find((p: any) => p.id === row.positionId)?.title || '✓ Nuevo';
                              }
                              if (col.key === 'employeeNumber' && row.employeeId) {
                                v = employees.find((e: any) => e.id === row.employeeId)?.employeeNumber || '';
                              }
                              return <td key={col.key} className="px-3 py-2 max-w-[120px] truncate">{String(v)}</td>;
                            })}
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
            </>
          )}

          {/* ── STEP 3: RESULT ── */}
          {step === 'result' && (
            <div className="text-center py-6 space-y-4">
              <div className="size-16 mx-auto rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30 animate-in zoom-in duration-300">
                <CheckCircle2 className="size-9 text-primary-foreground" />
              </div>
              <div>
                <h3 className="text-xl font-black">¡Importación Completada!</h3>
                <p className="text-sm text-muted-foreground mt-2">Datos procesados exitosamente</p>
              </div>
              <div className="flex items-center justify-center gap-6 pt-2">
                <div className="text-center">
                  <p className="text-3xl font-black text-primary">{importResult?.success || parsedData.length}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Exitosos</p>
                </div>
                {importResult?.failed > 0 && (
                  <div className="text-center">
                    <p className="text-3xl font-black text-red-600">{importResult.failed}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fallidos</p>
                  </div>
                )}
              </div>

              {/* Option to generate payroll */}
              {type === 'employees' && onBulkProcessPayroll && (importResult?.success > 0 || importResult?.importedEmployees?.length > 0) && (
                <div className="mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5">
                  <p className="text-sm font-bold">¿Deseas generar nóminas para estos empleados?</p>
                  <p className="text-xs text-muted-foreground mt-1">Puedes seleccionar los meses y empleados específicos</p>
                  <Button
                    size="sm"
                    onClick={initPayrollStep}
                    className="mt-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
                  >
                    <Calendar className="size-4 mr-2" />
                    Generar Nóminas
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 4: PAYROLL GENERATION ── */}
          {step === 'payroll' && (
            <div className="space-y-4">
              {showEmbeddedConfig ? (
                <div className="relative">
                  <div className="mb-4 flex items-center justify-between border-b pb-4">
                    <div>
                      <h3 className="text-lg font-bold">Configuración de Nómina</h3>
                      <p className="text-xs text-muted-foreground">Configura los porcentajes de ley y haz clic en Guardar para volver a la generación</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowEmbeddedConfig(false)}>
                      <ChevronLeft className="size-4 mr-2" />
                      Volver
                    </Button>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    <ConfigNominaView />
                  </div>
                  <Button className="w-full mt-4" onClick={handleConfigSaved}>
                    <CheckCircle2 className="size-4 mr-2" /> Ya guardé los cambios, volver a Generar Nóminas
                  </Button>
                </div>
              ) : (
                <>
                  {/* Config Warning */}
              {!hasPayrollConfig && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-4">
                  <div className="flex items-start gap-3">
                    <Settings2 className="size-5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Configuración de Nómina Requeria</p>
                      <p className="text-xs text-amber-600 mt-1">
                        No se ha detectado una configuración activa de nómina. Por favor configúrala ingresando aquí:
                      </p>
                      <Button
                        size="sm"
                        onClick={() => setShowEmbeddedConfig(true)}
                        className="mt-3 rounded-xl border-amber-300 text-amber-700 bg-amber-100 hover:bg-amber-200 dark:border-amber-800 dark:text-amber-400"
                      >
                        <Settings2 className="size-4 mr-2" />
                        Configurar Ahora
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {hasPayrollConfig && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-primary" />
                  <span className="text-xs font-bold text-primary">Configuración de nómina activa</span>
                  {onNavigateToConfig && (
                    <button onClick={onNavigateToConfig} className="ml-auto text-xs text-primary underline hover:text-primary/80">Revisar</button>
                  )}
                </div>
              )}

              {/* Month Selection */}
              <div className="rounded-xl border border-border/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Calendar className="size-4 text-primary" />
                    Seleccionar Meses
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentYear(y => y - 1)}>
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="text-sm font-black w-12 text-center">{currentYear}</span>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setCurrentYear(y => y + 1)}>
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {MONTHS.map((name, idx) => {
                    const key = `${currentYear}-${idx}`;
                    return (
                      <button
                        key={key}
                        onClick={() => toggleMonth(idx)}
                        className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                          selectedMonths.includes(key)
                            ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                            : 'bg-muted/20 border-border/40 hover:border-primary/40 hover:bg-primary/5'
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Per-Employee Month Assignment */}
              {selectedMonths.length > 0 && Object.keys(employeeMonthMap).length > 0 && (
                <div className="rounded-xl border border-border/40 overflow-hidden">
                  <div className="px-4 py-2.5 bg-muted/30 border-b border-border/40 flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Asignación por Empleado</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">Desmarca meses específicos por empleado si es necesario</span>
                  </div>
                  <div className="max-h-[250px] overflow-y-auto">
                    {Object.keys(employeeMonthMap).map(empId => {
                      // Find this employee in refreshed data OR from backend response directly
                      const emp = employees.find((e: any) => e.id === empId);
                      const importedEmp = importResult?.importedEmployees?.find((e: any) => e.id === empId);
                      const empName = emp ? `${emp.firstName} ${emp.lastName}` : (importedEmp ? `${importedEmp.firstName} ${importedEmp.lastName}` : empId);
                      const empNumber = emp?.employeeNumber || importedEmp?.employeeNumber || '';
                      
                      const empMonths = employeeMonthMap[empId] || [];

                      return (
                        <div key={empId} className="px-4 py-2.5 border-b border-border/10 last:border-0 hover:bg-muted/10 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{empName}</p>
                            <p className="text-[10px] text-muted-foreground">{empNumber}</p>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {empMonths.map(monthKey => {
                              const [year, month] = monthKey.split('-').map(Number);
                              const shortYear = String(year).slice(-2);
                              return (
                                <button
                                  key={monthKey}
                                  onClick={() => toggleEmployeeMonth(empId, monthKey)}
                                  className="bg-primary text-primary-foreground px-2 py-0.5 rounded text-[10px] font-bold transition-all hover:bg-red-500 hover:text-white"
                                  title="Quitar"
                                >
                                  {MONTHS[month].substring(0, 3)} {shortYear}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Payroll Result */}
              {payrollResult && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
                  <CheckCircle2 className="size-8 mx-auto text-primary mb-2" />
                  <p className="text-sm font-bold">Nóminas Generadas</p>
                  <div className="flex items-center justify-center gap-4 mt-2">
                    <span className="text-lg font-black text-primary">{payrollResult.success} exitosas</span>
                    {payrollResult.failed > 0 && <span className="text-lg font-black text-red-600">{payrollResult.failed} fallidas</span>}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>


        <DialogFooter className="border-t border-border/20 pt-4">
          {step === 'upload' && (
            <Button variant="outline" onClick={() => handleClose(false)} className="rounded-xl">Cancelar</Button>
          )}
          {step === 'preview' && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={resetState} className="rounded-xl flex-1 sm:flex-none">
                <X className="size-4 mr-2" />Volver
              </Button>
              <Button
                onClick={handleImport}
                disabled={errors.length > 0 || parsedData.length === 0 || importing}
                className="rounded-xl flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-primary-foreground shadow-md disabled:opacity-50"
              >
                {importing
                  ? <><Loader2 className="size-4 mr-2 animate-spin" />Importando...</>
                  : <><ArrowRight className="size-4 mr-2" />Importar {parsedData.length} registro(s)</>
                }
              </Button>
            </div>
          )}
          {step === 'result' && (
            <Button onClick={() => handleClose(false)} className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground">Cerrar</Button>
          )}
          {step === 'payroll' && !showEmbeddedConfig && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={() => handleClose(false)} className="rounded-xl flex-1 sm:flex-none">
                {payrollResult ? 'Cerrar' : 'Omitir'}
              </Button>
              {!payrollResult && (
                <Button
                  onClick={handleProcessPayroll}
                  disabled={Object.values(employeeMonthMap).every(m => m.length === 0) || processingPayroll}
                  className="rounded-xl flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-primary-foreground shadow-md disabled:opacity-50"
                >
                  {processingPayroll
                    ? <><Loader2 className="size-4 mr-2 animate-spin" />Procesando...</>
                    : <><Calendar className="size-4 mr-2" />Generar Nóminas</>
                  }
                </Button>
              )}
            </div>
          )}
          {step === 'payroll' && showEmbeddedConfig && (
             <div className="hidden"></div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
