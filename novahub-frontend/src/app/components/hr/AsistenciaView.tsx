import { useState } from 'react';
import { Clock, LogIn, LogOut, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Upload, FileDown, Info, UserCheck, UserX, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { hrService } from '../../services/hr.service';
import { Combobox } from '../ui/Combobox';
import { useAuth } from '../../contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Input } from '../ui/input';
import { ImportProgressOverlay } from '../ui/ImportProgressOverlay';
import { ImportReviewSummary } from '../ui/ImportReviewSummary';
import * as XLSX from 'xlsx';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { formatDateEs } from '../../utils/dateFormat';
import { cn } from '../ui/utils';
import { HRViewTutorial } from './HRViewTutorial';
import { parseSpreadsheetInWorker } from '../../utils/import-spreadsheet';

const TEMPLATE_COLUMNS = [
  { key: 'codigo_empleado', label: 'CÓDIGO EMPLEADO', example: 'EMP-001', rule: 'Obligatorio. Código o nombre completo del empleado tal como aparece en el módulo Empleados.' },
  { key: 'fecha', label: 'FECHA', example: '2026-08-12', rule: 'Obligatorio. Formato AAAA-MM-DD (año-mes-día).' },
  { key: 'entrada', label: 'ENTRADA', example: '08:00', rule: 'Opcional. Hora de entrada en formato HH:MM (24 h).' },
  { key: 'salida', label: 'SALIDA', example: '17:00', rule: 'Opcional. Hora de salida en formato HH:MM (24 h).' },
  { key: 'estado', label: 'ESTADO', example: 'PRESENTE', rule: 'Obligatorio. PRESENTE, AUSENTE, TARDANZA, REMOTO o MEDIO_DIA.' },
  { key: 'horas_trabajadas', label: 'HORAS TRABAJADAS', example: '9.0', rule: 'Opcional. Horas trabajadas en el día (decimales con punto).' },
  { key: 'horas_extra', label: 'HORAS EXTRA', example: '1.5', rule: 'Opcional. Horas extra (decimales con punto).' },
  { key: 'ubicacion', label: 'UBICACIÓN', example: 'Oficina Central', rule: 'Opcional. Lugar o sede del registro.' },
];

const normalizeHeader = (value: any): string => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[\s-]+/g, '_').trim();

const pickRowValue = (row: any, ...keys: string[]): string => {
  for (const key of keys) {
    const normalized = normalizeHeader(key);
    for (const [rowKey, value] of Object.entries(row)) {
      if (normalizeHeader(rowKey) === normalized && value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value).trim();
      }
    }
  }
  return '';
};

function matrixToObjects(raw: any[][]): Record<string, unknown>[] {
  const nonEmpty = raw.filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== ''));
  if (nonEmpty.length < 2) return [];
  const headers = nonEmpty[0].map((header) => String(header ?? '').trim());
  return nonEmpty.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENTE: 'PRESENT', PRESENT: 'PRESENT',
  AUSENTE: 'ABSENT', ABSENT: 'ABSENT',
  TARDANZA: 'LATE', TARDIO: 'LATE', LATE: 'LATE',
  REMOTO: 'REMOTE', REMOTE: 'REMOTE',
  MEDIO_DIA: 'HALF_DAY', HALF_DAY: 'HALF_DAY',
};

export function AsistenciaView({ attendance, employees, onRefresh }: any) {
  const { canPerform } = useAuth();
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [readingFile, setReadingFile] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [parsedImportRows, setParsedImportRows] = useState<Record<string, any>[]>([]);
  const [importFileStats, setImportFileStats] = useState<{ total: number; valid: number; skipped: number } | null>(null);
  const [importResult, setImportResult] = useState<{ total: number; created: number; skipped: number; errors: string[] } | null>(null);
  const [quickFilter, setQuickFilter] = useState<{ status?: string; today?: boolean } | null>(null);

  const handleAttendanceFileChange = async (file: File | undefined) => {
    setImportFile(file || null);
    setImportFileStats(null);
    setParsedImportRows([]);
    if (!file) return;
    setReadingFile(true);
    setReadingProgress(3);
    try {
      const parsed = await parseSpreadsheetInWorker(file, undefined, false, (progress) => {
        setReadingProgress(Math.min(84, Math.max(3, progress)));
      });
      setReadingProgress(88);
      const rows = matrixToObjects(parsed.rows);
      const employeeReferences = new Set<string>();
      employees.forEach((employee: any) => {
        if (employee.employeeNumber) employeeReferences.add(String(employee.employeeNumber).trim().toLowerCase());
        employeeReferences.add(`${employee.firstName} ${employee.lastName}`.trim().toLowerCase());
      });
      const valid = rows.filter((row: any) => {
        const employeeNumber = pickRowValue(row, 'codigo_empleado', 'employeeNumber', 'empleado', 'codigo').toLowerCase();
        return employeeReferences.has(employeeNumber);
      }).length;
      setParsedImportRows(rows);
      setImportFileStats({ total: rows.length, valid, skipped: rows.length - valid });
      setReadingProgress(100);
    } catch {
      setImportFile(null);
      setImportFileStats(null);
      setParsedImportRows([]);
    } finally {
      setReadingFile(false);
      setReadingProgress(0);
    }
  };

  const handleClockIn = async () => {
    if (!selectedEmployee) {
      toast.error('Selecciona un empleado');
      return;
    }
    try {
      await hrService.clockIn({ employeeId: selectedEmployee });
      toast.success('Entrada registrada');
      onRefresh();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al registrar entrada');
    }
  };

  const handleClockOut = async () => {
    if (!selectedEmployee) {
      toast.error('Selecciona un empleado');
      return;
    }
    try {
      await hrService.clockOut({ employeeId: selectedEmployee });
      toast.success('Salida registrada');
      onRefresh();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al registrar salida');
    }
  };

  const downloadAttendanceTemplate = () => {
    const rows = [{
      codigo_empleado: 'EMP-001', fecha: '2026-08-12', entrada: '08:00', salida: '17:00',
      estado: 'PRESENTE', horas_trabajadas: '9.0', horas_extra: '1.5', ubicacion: 'Oficina Central',
    }];
    const ws = XLSX.utils.json_to_sheet(rows, { header: TEMPLATE_COLUMNS.map(c => c.key) });
    ws['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 20 }];
    const rulesWs = XLSX.utils.aoa_to_sheet([
      ['REGLAS DE LLENADO — ASISTENCIA'],
      [],
      ...TEMPLATE_COLUMNS.map(c => ['Columna: ' + c.label, c.example, c.rule]),
      [],
      ['EJEMPLO DE FILA'],
      ['codigo_empleado', 'fecha', 'entrada', 'salida', 'estado', 'horas_trabajadas', 'horas_extra', 'ubicacion'],
      ['EMP-001', '2026-08-12', '08:00', '17:00', 'PRESENTE', '9.0', '1.5', 'Oficina Central'],
      [],
      ['Valores válidos de ESTADO: PRESENTE, AUSENTE, TARDANZA, REMOTO, MEDIO_DIA'],
      ['La fecha usa formato AAAA-MM-DD. Las horas usan formato HH:MM (24 horas).'],
      ['Se aceptan también encabezados en inglés (employeeNumber, date, checkIn, checkOut, status, hoursWorked, overtimeHours, location).'],
    ]);
    rulesWs['!cols'] = [{ wch: 28 }, { wch: 24 }, { wch: 60 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');
    XLSX.utils.book_append_sheet(wb, rulesWs, 'Reglas de llenado');
    XLSX.writeFile(wb, 'plantilla_asistencia_es.xlsx');
    toast.success('Plantilla descargada');
  };

  const handleImportAttendance = async () => {
    if (!importFile) return toast.error('Selecciona un archivo');
    setImporting(true);
    setImportProgress(8);
    setImportResult(null);
    try {
      const rows = parsedImportRows.length > 0
        ? parsedImportRows
        : matrixToObjects((await parseSpreadsheetInWorker(importFile, undefined, false, (progress) => {
          setImportProgress(Math.min(22, Math.max(8, Math.round(progress * 0.23))));
        })).rows);
      setImportProgress(22);
      setImportProgress(36);
      if (rows.length === 0) { toast.error('El archivo no contiene filas'); return; }
      const errors: string[] = [];
      const employeeByReference = new Map<string, any>();
      employees.forEach((employee: any) => {
        if (employee.employeeNumber) employeeByReference.set(String(employee.employeeNumber).trim().toLowerCase(), employee);
        employeeByReference.set(`${employee.firstName} ${employee.lastName}`.trim().toLowerCase(), employee);
      });
      const payload: any[] = [];
      rows.forEach((row, idx) => {
        const rowNum = idx + 2;
        const empNum = pickRowValue(row, 'codigo_empleado', 'employeeNumber', 'empleado', 'codigo');
        const employee = employeeByReference.get(empNum.toLowerCase());
        if (!employee) { errors.push(`Fila ${rowNum}: empleado "${empNum}" no encontrado`); return; }
        const dateRaw = pickRowValue(row, 'fecha', 'date');
        const dateParsed = dateRaw ? new Date(dateRaw) : new Date();
        const date = Number.isNaN(dateParsed.getTime()) ? new Date().toISOString() : dateParsed.toISOString();
        const checkInRaw = pickRowValue(row, 'entrada', 'checkIn', 'checkin', 'hora_entrada');
        const checkOutRaw = pickRowValue(row, 'salida', 'checkOut', 'checkout', 'hora_salida');
        const checkIn = checkInRaw ? new Date(`${dateRaw || date.split('T')[0]}T${checkInRaw}`).toISOString() : undefined;
        const checkOut = checkOutRaw ? new Date(`${dateRaw || date.split('T')[0]}T${checkOutRaw}`).toISOString() : undefined;
        const statusRaw = pickRowValue(row, 'estado', 'status') || 'PRESENT';
        const status = ATTENDANCE_STATUS_LABELS[statusRaw.toUpperCase()] || 'PRESENT';
        const hoursWorked = Number(pickRowValue(row, 'horas_trabajadas', 'horas', 'hoursWorked').replace(',', '.') || '0');
        const overtimeHours = Number(pickRowValue(row, 'horas_extra', 'overtimeHours', 'extra').replace(',', '.') || '0');
        const location = pickRowValue(row, 'ubicacion', 'location');
        payload.push({ sourceRow: rowNum, employeeId: employee.id, date, checkIn, checkOut, status, hoursWorked, overtimeHours: overtimeHours || 0, location: location || undefined });
      });
      setImportProgress(55);
      const response: any = await hrService.bulkCreateAttendance(payload);
      const serverResult = response?.data || response;
      const serverErrors = Array.isArray(serverResult?.errors) ? serverResult.errors : [];
      const created = Number(serverResult?.created ?? payload.length - serverErrors.length);
      const skipped = Number(serverResult?.skipped ?? errors.length + serverErrors.length);
      setImportProgress(90);
      const allErrors = [...errors, ...serverErrors];
      setImportProgress(100);
      setImportResult({ total: rows.length, created, skipped, errors: allErrors.slice(0, 12) });
      if (created > 0) onRefresh();
      toast.success(`Importación finalizada: ${created} registros, ${skipped} omitidos`);
    } catch (error: any) {
      toast.error(`No se pudo importar: ${error?.message || 'archivo inválido'}`);
    } finally {
      setImporting(false);
      setImportProgress(0);
    }
  };

  const isSameDay = (dateStr: string, ref = new Date()) => {
    const d = new Date(dateStr);
    return !Number.isNaN(d.getTime()) && d.toDateString() === ref.toDateString();
  };
  const todayRecords = attendance.filter((a: any) => isSameDay(a.date));

  const totalHoursToday = todayRecords.reduce((sum: number, a: any) => sum + Number(a.hoursWorked || 0), 0);
  const presentToday = todayRecords.filter((a: any) => a.status === 'PRESENT').length;
  const absentToday = todayRecords.filter((a: any) => a.status === 'ABSENT').length;

  const quickFilteredAttendance = attendance.filter((a: any) => {
    if (!quickFilter) return true;
    if (quickFilter.today && !isSameDay(a.date)) return false;
    if (quickFilter.status && String(a.status || '').toUpperCase() !== quickFilter.status) return false;
    return true;
  });

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE_OPTIONS = [10, 15, 25, 30, 35, 40, 45, 50];

  const colFilters = useColumnFilters();
  const employeeName = (r: any) => `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`.trim() || 'Sin empleado';
  const filterGetters = {
    date: (r: any) => (r.date ? new Date(r.date).getTime() : null),
    employee: (r: any) => employeeName(r),
    status: (r: any) => String(r.status || ''),
    location: (r: any) => r.location || '—',
  };
  const colFilteredAttendance = colFilters.applyTo(quickFilteredAttendance, filterGetters);
  const employeeOptions = [...new Map(quickFilteredAttendance.map((r: any) => [employeeName(r), employeeName(r)])).entries()]
    .map(([, label]) => ({ value: label as string, label: label as string, count: quickFilteredAttendance.filter((r: any) => employeeName(r) === label).length }));
  const statusOptionsForFilter = Object.entries(ATTENDANCE_STATUS_LABELS)
    .map(([value, label]) => ({ value, label, count: quickFilteredAttendance.filter((r: any) => String(r.status || '').toUpperCase() === value).length }));
  const locationOptions = [...new Map(quickFilteredAttendance.map((r: any) => [r.location || '—', r.location || '—'])).entries()]
    .map(([, label]) => ({ value: label as string, label: label as string, count: quickFilteredAttendance.filter((r: any) => (r.location || '—') === label).length }));

  const toggleQuickFilter = (status?: string) => {
    setQuickFilter(prev => {
      const next = { today: true, status };
      if (prev && prev.today === true && prev.status === (status || undefined)) return null;
      return next;
    });
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(colFilteredAttendance.length / pageSize);
  const paginatedAttendance = colFilteredAttendance.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-tour="hr-attendance-title">
        <button
          onClick={() => toggleQuickFilter('PRESENT')}
          className={cn(
            'rounded-2xl border bg-card p-5 shadow-sm text-left transition-all hover:-translate-y-0.5 hover:shadow-md',
            quickFilter?.status === 'PRESENT' && quickFilter?.today ? 'border-blue-500/50 ring-1 ring-blue-500/20 bg-blue-500/[0.03]' : 'border-border/50',
          )}
        >
          <div className="flex items-center gap-4">
            <div className={cn('p-3 rounded-xl', quickFilter?.status === 'PRESENT' && quickFilter?.today ? 'bg-blue-500/20' : 'bg-blue-500/10')}><UserCheck className={cn('size-5', quickFilter?.status === 'PRESENT' && quickFilter?.today ? 'text-blue-600' : 'text-blue-500')} /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Presentes Hoy</p>
              <p className="text-2xl font-black tabular-nums">{presentToday}</p>
              <p className="text-[11px] text-muted-foreground">Clic para ver solo hoy · presentes</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => toggleQuickFilter()}
          className={cn(
            'rounded-2xl border bg-card p-5 shadow-sm text-left transition-all hover:-translate-y-0.5 hover:shadow-md',
            quickFilter?.today && !quickFilter?.status ? 'border-emerald-500/50 ring-1 ring-emerald-500/20 bg-emerald-500/[0.03]' : 'border-border/50',
          )}
        >
          <div className="flex items-center gap-4">
            <div className={cn('p-3 rounded-xl', quickFilter?.today && !quickFilter?.status ? 'bg-emerald-500/20' : 'bg-emerald-500/10')}><Calendar className={cn('size-5', quickFilter?.today && !quickFilter?.status ? 'text-emerald-600' : 'text-emerald-500')} /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Horas Totales Hoy</p>
              <p className="text-2xl font-black tabular-nums">{totalHoursToday.toFixed(1)}</p>
              <p className="text-[11px] text-muted-foreground">Clic para ver solo los registros de hoy</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => toggleQuickFilter('ABSENT')}
          className={cn(
            'rounded-2xl border bg-card p-5 shadow-sm text-left transition-all hover:-translate-y-0.5 hover:shadow-md',
            quickFilter?.status === 'ABSENT' && quickFilter?.today ? 'border-rose-500/50 ring-1 ring-rose-500/20 bg-rose-500/[0.03]' : 'border-border/50',
          )}
        >
          <div className="flex items-center gap-4">
            <div className={cn('p-3 rounded-xl', quickFilter?.status === 'ABSENT' && quickFilter?.today ? 'bg-rose-500/20' : 'bg-rose-500/10')}><UserX className={cn('size-5', quickFilter?.status === 'ABSENT' && quickFilter?.today ? 'text-rose-600' : 'text-rose-500')} /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Ausentes Hoy</p>
              <p className="text-2xl font-black tabular-nums">{absentToday}</p>
              <p className="text-[11px] text-muted-foreground">Clic para ver solo hoy · ausentes</p>
            </div>
          </div>
        </button>
      </div>

      {/* Clock In/Out Panel */}
      <div className="border border-primary/40 rounded-lg p-6 bg-primary/5" data-tour="hr-attendance-data">
        <h3 className="text-lg font-semibold mb-4 text-primary">Registrar Asistencia</h3>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 w-full">
            <Combobox
              options={employees.map((emp: any) => ({
                label: `${emp.firstName} ${emp.lastName}`,
                value: emp.id,
                description: emp.employeeNumber,
              }))}
              value={selectedEmployee}
              onChange={setSelectedEmployee}
              placeholder="Buscar empleado..."
              emptyMessage="No se encontró el empleado"
              data-tour="asistencia-employee-selector"
            />
          </div>
          <div className="erp-list-toolbar flex flex-wrap gap-2 w-full sm:w-auto" data-tour="hr-attendance-actions">
            {canPerform('HR_ATTENDANCE', 'create') && (
              <>
                <Button onClick={handleClockIn} data-toolbar-role="primary" className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-primary-foreground">
                  <LogIn className="size-4 mr-2" />
                  Entrada
                </Button>
                <Button onClick={handleClockOut} variant="outline" className="flex-1 sm:flex-none border-primary/50 text-foreground hover:bg-primary/10 hover:text-primary">
                  <LogOut className="size-4 mr-2 text-red-500" />
                  Salida
                </Button>
              </>
            )}
            {canPerform('HR_ATTENDANCE', 'create') && (
              <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)} aria-label="Importar" className="w-full sm:w-auto">
                <Upload className="size-3.5 mr-1" /> Importar
              </Button>
            )}
            <HRViewTutorial
              label="Cómo registrar asistencia"
              targetPrefix="hr-attendance"
              stepKeys={['title', 'data', 'items', 'actions']}
              copy={{
                data: { description: 'Selecciona al empleado y registra su entrada o salida desde este panel.' },
                items: { title: 'Registros de asistencia', description: 'Consulta fechas, horas, estado, ubicación y filtros de los registros existentes.' },
                actions: { description: 'Importa una plantilla o registra la entrada y salida cuando tengas el empleado seleccionado.' },
              }}
              className="w-full sm:w-auto"
            />
          </div>
        </div>
      </div>

      {/* Attendance Records */}
      <div data-tour="hr-attendance-items" className="border rounded-lg overflow-hidden flex flex-col">
        <div className="bg-muted/50 px-4 py-3 border-b">
          <h3 className="font-semibold">Registros de Asistencia</h3>
        </div>
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full min-w-[900px]">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold"><span className="inline-flex items-center gap-1">Fecha<ColumnFilterMenu label="Fecha" sort={colFilters.state.date?.sort || null} onSort={(sort) => colFilters.setSort('date', sort)} sortOptions={[{ value: 'desc', label: 'Más recientes' }, { value: 'asc', label: 'Más antiguas' }]} /></span></th>
                <th className="px-4 py-3 text-left text-xs font-semibold"><span className="inline-flex items-center gap-1">Empleado<ColumnFilterMenu label="Empleado" options={employeeOptions} selected={colFilters.state.employee?.values || []} onSelect={(values) => colFilters.setValues('employee', values)} sort={colFilters.state.employee?.sort || null} onSort={(sort) => colFilters.setSort('employee', sort)} /></span></th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Entrada</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Salida</th>
                <th className="px-4 py-3 text-right text-xs font-semibold">Horas</th>
                <th className="px-4 py-3 text-right text-xs font-semibold">H. Extra</th>
                <th className="px-4 py-3 text-left text-xs font-semibold"><span className="inline-flex items-center gap-1">Estado<ColumnFilterMenu label="Estado" options={statusOptionsForFilter} selected={colFilters.state.status?.values || []} onSelect={(values) => colFilters.setValues('status', values)} sort={colFilters.state.status?.sort || null} onSort={(sort) => colFilters.setSort('status', sort)} /></span></th>
                <th className="px-4 py-3 text-left text-xs font-semibold"><span className="inline-flex items-center gap-1">Ubicación<ColumnFilterMenu label="Ubicación" options={locationOptions} selected={colFilters.state.location?.values || []} onSelect={(values) => colFilters.setValues('location', values)} sort={colFilters.state.location?.sort || null} onSort={(sort) => colFilters.setSort('location', sort)} /></span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginatedAttendance.map((record: any) => (
                <tr key={record.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm">
                    {formatDateEs(record.date)}
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">
                        {record.employee?.firstName} {record.employee?.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {record.employee?.employeeNumber}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {record.checkIn ? new Date(record.checkIn).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {record.checkOut ? new Date(record.checkOut).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    {record.hoursWorked ? Number(record.hoursWorked).toFixed(2) : '0.00'}h
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-orange-600 font-medium">
                    {record.overtimeHours ? Number(record.overtimeHours).toFixed(2) : '0.00'}h
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded ${
                      record.status === 'PRESENT' ? 'bg-green-100 text-green-700' :
                      record.status === 'ABSENT' ? 'bg-red-100 text-red-700' :
                      record.status === 'LATE' ? 'bg-orange-100 text-orange-700' :
                      record.status === 'REMOTE' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {record.status === 'PRESENT' ? 'Presente' : record.status === 'ABSENT' ? 'Ausente' : record.status === 'LATE' ? 'Tardanza' : record.status === 'REMOTE' ? 'Remoto' : record.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {record.location || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="block md:hidden space-y-4 p-4 bg-muted/10">
          {paginatedAttendance.map((record: any) => (
            <div key={record.id} className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card to-background p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4 border-b border-primary/10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                    {record.employee?.firstName?.[0]}{record.employee?.lastName?.[0]}
                  </div>
                  <div>
                    <p className="font-bold text-sm tracking-tight">{record.employee?.firstName} {record.employee?.lastName}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{record.employee?.employeeNumber}</p>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-lg font-bold shadow-sm ${
                  record.status === 'PRESENT' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' :
                  record.status === 'ABSENT' ? 'bg-red-100 text-red-700 dark:bg-red-900/30' :
                  record.status === 'LATE' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30' :
                  record.status === 'REMOTE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' :
                  'bg-gray-100 text-gray-700 dark:bg-gray-800'
                }`}>
                  {record.status === 'PRESENT' ? 'PRESENTE' : record.status === 'ABSENT' ? 'AUSENTE' : record.status === 'LATE' ? 'TARDANZA' : record.status === 'REMOTE' ? 'REMOTO' : record.status}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Fecha</span>
                  <span className="font-semibold">{formatDateEs(record.date)}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="bg-primary/5 p-2 rounded-lg border border-primary/10">
                    <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">Entrada</p>
                    <p className="font-bold text-sm">{record.checkIn ? new Date(record.checkIn).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
                  </div>
                  <div className="bg-primary/5 p-2 rounded-lg border border-primary/10">
                    <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">Salida</p>
                    <p className="font-bold text-sm">{record.checkOut ? new Date(record.checkOut).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-border/50 pt-2">
                  <span className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Horas Trabajadas</span>
                  <div className="flex gap-2">
                    <span className="font-bold">{record.hoursWorked ? Number(record.hoursWorked).toFixed(2) : '0.00'}h</span>
                    {Number(record.overtimeHours) > 0 && (
                      <span className="font-bold text-orange-600">+{Number(record.overtimeHours).toFixed(2)}h Extra</span>
                    )}
                  </div>
                </div>
                {record.location && (
                  <div className="flex justify-between items-center text-xs border-t border-border/50 pt-2">
                    <span className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Ubicación</span>
                    <span className="font-medium">{record.location}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pagination Controls */}
      {attendance.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border/20">
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-medium">
            <div className="flex items-center gap-2">
              <span>Mostrar</span>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="h-8 rounded-lg border bg-background px-2 font-bold text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer">
                {PAGE_SIZE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <span>por página</span>
            </div>
            <div className="h-4 w-px bg-border/40 hidden sm:block" />
            <p className="bg-primary/5 px-3 py-1 rounded-full border border-primary/10">
              Mostrando <span className="text-foreground font-black">{attendance.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, attendance.length)}</span> de <span className="text-primary font-black">{attendance.length}</span> registros totales
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-2 rounded-lg border hover:bg-muted disabled:opacity-30 transition-all"><ChevronsLeft className="size-4" /></button>
            <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border hover:bg-muted disabled:opacity-30 transition-all"><ChevronLeft className="size-4" /></button>
            <div className="flex items-center px-4 h-9 rounded-lg border bg-muted/30 font-black text-xs">
              Pág. {currentPage} / {Math.max(1, totalPages)}
            </div>
            <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages || totalPages === 0} className="p-2 rounded-lg border hover:bg-muted disabled:opacity-30 transition-all"><ChevronRight className="size-4" /></button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages || totalPages === 0} className="p-2 rounded-lg border hover:bg-muted disabled:opacity-30 transition-all"><ChevronsRight className="size-4" /></button>
          </div>
        </div>
      )}

      {attendance.length === 0 && (
        <div className="text-center py-12">
          <Clock className="size-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No hay registros de asistencia</p>
        </div>
      )}
      <Dialog open={importOpen && !importing} onOpenChange={setImportOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] !max-w-[min(92vw,680px)] overflow-y-auto rounded-3xl">
          <DialogHeader data-tour="hr-attendance-import-title">
            <DialogTitle className="flex items-center gap-2"><Upload className="size-4" /> Importar asistencia</DialogTitle>
            <DialogDescription>
              Sube un archivo Excel (.xlsx) para registrar asistencia masivamente.
            </DialogDescription>
            <HRViewTutorial label="Cómo importar asistencia" targetPrefix="hr-attendance-import" copy={{ data: { description: 'Descarga la plantilla, carga el archivo y revisa la prevalidación de filas.' }, actions: { description: 'Confirma la importación para registrar los movimientos válidos.' } }} />
          </DialogHeader>
          <div className="space-y-4" data-tour="hr-attendance-import-data">
            <div className="rounded-xl border border-border/60 bg-muted/20">
              <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><Info className="size-3.5" /> Formato esperado del archivo</p>
                <Button variant="ghost" size="sm" className="gap-2 h-8 text-primary" onClick={downloadAttendanceTemplate}>
                  <FileDown className="size-4" /> Descargar plantilla Excel
                </Button>
              </div>
              <div className="overflow-x-auto scrollbar-overlay" data-import-preview-horizontal-scroller="true">
                <table className="w-full min-w-[560px] text-left">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/40">
                      <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Columna</th>
                      <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ejemplo</th>
                      <th className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Regla</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {TEMPLATE_COLUMNS.map(col => (
                      <tr key={col.key}>
                        <td className="px-4 py-2"><span className="font-mono text-xs font-bold text-primary">{col.label}</span></td>
                        <td className="px-4 py-2"><span className="font-mono text-xs text-muted-foreground">{col.example}</span></td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{col.rule}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 border-t border-border/40 text-[11px] text-muted-foreground">
                Valores de <span className="font-mono font-bold text-foreground">ESTADO</span>: PRESENTE · AUSENTE · TARDANZA · REMOTO · MEDIO_DIA. Se aceptan también encabezados en inglés (employeeNumber, date, checkIn, checkOut, status, hoursWorked, overtimeHours, location).
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Archivo Excel</label>
              <Input type="file" accept=".xlsx,.xls" onChange={(e) => { void handleAttendanceFileChange(e.target.files?.[0]); e.target.value = ''; }} />
              {importFile && <p className="text-xs text-muted-foreground">Archivo: <b>{importFile.name}</b> ({Math.round(importFile.size / 1024)} KB)</p>}
              {importFileStats && <p className="text-xs font-semibold text-muted-foreground">Prevalidación: <span className="text-emerald-600">{importFileStats.valid} válidos</span> · <span className={importFileStats.skipped ? 'text-rose-600' : 'text-muted-foreground'}>{importFileStats.skipped} se omitirán</span></p>}
              {importFileStats && <ImportReviewSummary total={importFileStats.total} valid={importFileStats.valid} skipped={importFileStats.skipped} entityLabel="registros de asistencia" />}
            </div>
            {importResult && (
              <div className="rounded-xl border border-border/60 p-4 bg-background">
                <p className="text-xs font-black uppercase tracking-widest mb-2">Resultado</p>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4 text-emerald-500" /> Creados: <b className="text-emerald-500">{importResult.created}</b></span>
                  <span className="inline-flex items-center gap-1.5"><XCircle className="size-4 text-amber-500" /> Omitidos: <b className="text-amber-500">{importResult.skipped}</b></span>
                  <span>Total: <b>{importResult.total}</b></span>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="mt-2 text-xs text-amber-600 space-y-1">
                    <p className="font-semibold flex items-center gap-1"><Info className="size-3" /> Detalles:</p>
                    {importResult.errors.map((err, i) => <p key={i}>- {err}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter data-tour="hr-attendance-import-actions">
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>Cerrar</Button>
            <Button onClick={handleImportAttendance} disabled={importing || !importFile} className="gap-2">
              <Upload className="size-4" /> {importing ? 'Importando...' : importFileStats ? `Importar ${importFileStats.valid} válidos · omitir ${importFileStats.skipped}` : 'Importar asistencia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ImportProgressOverlay
        open={importing}
        progress={importProgress}
        title="Importando asistencia"
        description="Procesando cada fila, validando el empleado y registrando la asistencia en la base de datos."
      />
      <ImportProgressOverlay
        open={readingFile}
        progress={readingProgress}
        title="Preparando asistencia"
        description="Leyendo el archivo y validando las referencias de empleados para la previsualización."
      />
    </div>
  );
}

