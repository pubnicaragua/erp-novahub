import React from 'react';
import { useState } from 'react';
import { DollarSign, Calculator, CheckCircle, Building2, ChevronDown, ChevronUp, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Wallet, Receipt, Send, Pencil, CalendarDays } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from '@/app/services/toast';
import { hrService } from '../../services/hr.service';
import { Combobox } from '../ui/Combobox';
import { useCurrency } from '../../contexts/CurrencyContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertTriangle } from 'lucide-react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { generateConfiguredReportTemplate, getPdfDesignSettings, pdfDesignPaper } from '../../utils/pdfGenerator';
import { buildDatedDownloadFileName } from '../../utils/exportFileNames';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { StatCard } from './StatCard';
import { formatDateEs } from '../../utils/dateFormat';
import { HRViewTutorial } from './HRViewTutorial';
import { beginNotificationAction, completeNotificationAction, failNotificationAction } from '../../services/notification-action-coordinator';
import { normalizeCurrency, summarizeAmountsByCurrency, type SupportedCurrency } from '../../utils/currency';
import { pdfStatusLabel } from '../../utils/pdfStatus';
import { ExportMenu } from '../ui/ExportMenu';
import { createReportWorkbook } from '../../utils/reportWorkbook';

type PayrollFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'ALL';

const PAYROLL_FREQUENCY_OPTIONS: Array<{ value: PayrollFrequency; label: string }> = [
  { value: 'ALL', label: 'Todas las frecuencias' },
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'BIWEEKLY', label: 'Quincenal' },
  { value: 'MONTHLY', label: 'Mensual' },
];

const payrollFrequencyLabel = (frequency?: string) => ({
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quincenal',
  MONTHLY: 'Mensual',
} as Record<string, string>)[String(frequency || '').toUpperCase()] || 'No especificada';

const payrollEffectiveStatus = (payroll: any) => {
  const paymentStatus = String(payroll?.paymentStatus || 'PENDING').toUpperCase();
  if (paymentStatus === 'PARTIAL') return 'PARTIAL';
  if (payroll?.status === 'PAID' || paymentStatus === 'PAID') return 'PAID';
  if (paymentStatus === 'APPROVED') return 'APPROVED';
  if (paymentStatus === 'REQUESTED') return 'REQUESTED';
  return String(payroll?.status || 'PENDING').toUpperCase();
};

const startOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
const endOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const getCurrentPayrollPeriod = (frequency: PayrollFrequency, referenceDate = new Date()) => {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const day = referenceDate.getDate();

  if (frequency === 'WEEKLY') {
    const daysFromMonday = (referenceDate.getDay() + 6) % 7;
    const start = new Date(year, month, day - daysFromMonday);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return { start: startOfLocalDay(start), end: endOfLocalDay(end) };
  }

  if (frequency === 'BIWEEKLY') {
    const start = new Date(year, month, day <= 15 ? 1 : 16);
    const end = day <= 15
      ? new Date(year, month, 15)
      : new Date(year, month + 1, 0);
    return { start: startOfLocalDay(start), end: endOfLocalDay(end) };
  }

  return {
    start: new Date(year, month, 1, 0, 0, 0, 0),
    end: new Date(year, month + 1, 0, 23, 59, 59, 999),
  };
};

export function NominasView({ payrolls, employees, onRefresh }: any) {
  const { displayCurrency, displayMode, valuationMode, valuationModeLabel, valuationModeSuffix, formatCurrentAmount, formatExplicitAmount, convertAmount, convertCurrentAmount } = useCurrency();
  const { user, canPerform } = useAuth();
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [includeCommissions, setIncludeCommissions] = useState(true);
  const [processFrequency, setProcessFrequency] = useState<PayrollFrequency>('ALL');
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [processLoading, setProcessLoading] = useState(false);
  const employeeOptions = [
    { label: 'Todos los empleados', value: 'all' },
    ...employees.map((emp: any) => ({
      label: `${emp.firstName} ${emp.lastName}`,
      value: emp.id,
      description: emp.employeeNumber,
    })),
  ];

  const filteredPayrolls = payrolls.filter((p: any) => {
    const matchesEmployee = filterEmployee === 'all' || p.employeeId === filterEmployee;
    const matchesStatus = filterStatus === 'all' || payrollEffectiveStatus(p) === filterStatus;
    return matchesEmployee && matchesStatus;
  });

  const colFilters = useColumnFilters();
  const payrollEmployeeName = (p: any) => `${p.employee?.firstName || ''} ${p.employee?.lastName || ''}`.trim() || 'Sin empleado';
  const colFilterGetters = {
    employee: (p: any) => payrollEmployeeName(p),
    periodStart: (p: any) => (p.periodStart ? new Date(p.periodStart).getTime() : null),
    gross: (p: any) => Number(p.grossPay ?? p.grossPayBase ?? 0),
    net: (p: any) => Number(p.netPay ?? p.netPayBase ?? 0),
    cost: (p: any) => Number(p.costoTotalEmpresa ?? p.costoTotalEmpresaBase ?? 0),
    status: (p: any) => String(p.status || ''),
  };
  const colFilteredPayrolls = colFilters.applyTo(filteredPayrolls, colFilterGetters);
  const employeeNameOptions = [...new Map(filteredPayrolls.map((p: any) => [payrollEmployeeName(p), payrollEmployeeName(p)])).entries()]
    .map(([, label]) => ({ value: label as string, label: label as string, count: filteredPayrolls.filter((p: any) => payrollEmployeeName(p) === label).length }));
  const statusOptionsForFilter = [
    { value: 'PENDING', label: 'Pendiente', count: filteredPayrolls.filter((p: any) => payrollEffectiveStatus(p) === 'PENDING').length },
    { value: 'PARTIAL', label: 'Pago parcial', count: filteredPayrolls.filter((p: any) => payrollEffectiveStatus(p) === 'PARTIAL').length },
    { value: 'APPROVED', label: 'Aprobada', count: filteredPayrolls.filter((p: any) => payrollEffectiveStatus(p) === 'APPROVED').length },
    { value: 'PAID', label: 'Pagado', count: filteredPayrolls.filter((p: any) => payrollEffectiveStatus(p) === 'PAID').length },
  ];

  const payrollBase = (p: any, field: string, baseField: string) => {
    const amount = Number(p[field] ?? p[baseField] ?? 0);
    return valuationMode === 'CURRENT'
      ? convertCurrentAmount(amount, p.currency || p.employee?.currency || 'USD')
      : convertAmount(amount, p.currency || p.employee?.currency || 'USD', p.exchangeRate);
  };
  const payrollDisplay = (p: any, field: string, baseField: string) => formatCurrentAmount(payrollBase(p, field, baseField), displayCurrency);

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE_OPTIONS = [10, 15, 25, 30, 35, 40, 45, 50];

  const [prevFilters, setPrevFilters] = useState({ filterEmployee, filterStatus, includeCommissions, pageSize });
  const [prevFilteredCount, setPrevFilteredCount] = useState(0);
  if (filterEmployee !== prevFilters.filterEmployee || filterStatus !== prevFilters.filterStatus || includeCommissions !== prevFilters.includeCommissions || pageSize !== prevFilters.pageSize) {
    setPrevFilters({ filterEmployee, filterStatus, includeCommissions, pageSize });
    setCurrentPage(1);
  }
  if (colFilteredPayrolls.length !== prevFilteredCount) {
    setPrevFilteredCount(colFilteredPayrolls.length);
    setCurrentPage(1);
  }

  const totalPages = Math.ceil(colFilteredPayrolls.length / pageSize);
  const paginatedPayrolls = colFilteredPayrolls.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<any | null>(null);
  const [payrollForm, setPayrollForm] = useState({ periodStart: '', periodEnd: '', notes: '' });
  const [payrollSaveLoading, setPayrollSaveLoading] = useState(false);
  const [payrollRecalculateLoading, setPayrollRecalculateLoading] = useState(false);

  const toDateInputValue = (value: unknown) => {
    if (!value) return '';
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  };

  const handleOpenEditPayroll = (payroll: any) => {
    setEditingPayroll(payroll);
    setPayrollForm({
      periodStart: toDateInputValue(payroll.periodStart),
      periodEnd: toDateInputValue(payroll.periodEnd),
      notes: payroll.notes || '',
    });
  };

  const handleSavePayroll = async () => {
    if (!editingPayroll || !payrollForm.periodStart || !payrollForm.periodEnd) {
      toast.error('Completa las fechas del período');
      return;
    }
    if (payrollForm.periodEnd < payrollForm.periodStart) {
      toast.error('La fecha final debe ser posterior o igual a la inicial');
      return;
    }
    const actionToken = beginNotificationAction();
    try {
      setPayrollSaveLoading(true);
      await hrService.updatePayroll(editingPayroll.id, {
        periodStart: new Date(`${payrollForm.periodStart}T00:00:00`).toISOString(),
        periodEnd: new Date(`${payrollForm.periodEnd}T23:59:59.999`).toISOString(),
        notes: payrollForm.notes || null,
      });
      toast.success('Nómina actualizada');
      completeNotificationAction(actionToken);
      setEditingPayroll(null);
      onRefresh();
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Error al actualizar la nómina';
      toast.error(Array.isArray(message) ? message[0] : message);
      failNotificationAction(actionToken);
    } finally {
      setPayrollSaveLoading(false);
    }
  };

  const handleRecalculatePayroll = async () => {
    if (!editingPayroll) return;
    const actionToken = beginNotificationAction();
    try {
      setPayrollRecalculateLoading(true);
      await hrService.recalculatePayroll(editingPayroll.id);
      toast.success('Nómina recalculada con el salario fijo y las comisiones del período');
      completeNotificationAction(actionToken);
      setEditingPayroll(null);
      onRefresh();
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'No se pudo recalcular la nómina';
      toast.error(Array.isArray(message) ? message[0] : message);
      failNotificationAction(actionToken);
    } finally {
      setPayrollRecalculateLoading(false);
    }
  };

  const handleOpenProcessPayroll = () => {
    if (!canPerform('HR_PAYROLL', 'approve')) return;
    if (filterEmployee !== 'all') {
      const selectedEmployee = employees.find((employee: any) => employee.id === filterEmployee);
      const selectedFrequency = String(selectedEmployee?.payFrequency || '').toUpperCase();
      if (PAYROLL_FREQUENCY_OPTIONS.some(option => option.value === selectedFrequency)) {
        setProcessFrequency(selectedFrequency as PayrollFrequency);
      }
    } else {
      setProcessFrequency('ALL');
    }
    setProcessDialogOpen(true);
  };

  const selectedProcessEmployee = filterEmployee !== 'all'
    ? employees.find((employee: any) => employee.id === filterEmployee)
    : null;
  const selectedEmployeeFrequency = String(selectedProcessEmployee?.payFrequency || '').toUpperCase();
  const selectedEmployeeUnsupported = Boolean(selectedProcessEmployee && !['WEEKLY', 'BIWEEKLY', 'MONTHLY'].includes(selectedEmployeeFrequency));
  const hasProcessFrequencyMismatch = Boolean(
    selectedProcessEmployee
      && processFrequency !== 'ALL'
      && selectedEmployeeFrequency !== processFrequency
  );
  const processPeriod = getCurrentPayrollPeriod(processFrequency === 'ALL' ? 'MONTHLY' : processFrequency);

  const handleProcessPayroll = async () => {
    if (!canPerform('HR_PAYROLL', 'approve') || hasProcessFrequencyMismatch || selectedEmployeeUnsupported) return;
    setProcessLoading(true);
    const actionToken = beginNotificationAction();
    try {
      const payload: any = {
        periodStart: processPeriod.start.toISOString(),
        periodEnd: processPeriod.end.toISOString(),
        payFrequency: processFrequency,
        includeCommissions,
      };
      if (filterEmployee !== 'all') {
        payload.employeeIds = [filterEmployee];
      }

      const result: any = await hrService.bulkProcessPayroll(payload);
      const alreadyProcessed = Number(result?.alreadyProcessed || 0);
      const createdCount = Number(result?.count || 0);
      if (createdCount === 0 && alreadyProcessed > 0) {
        toast.info('La nómina ya fue procesada para el período seleccionado.');
      } else if (alreadyProcessed > 0) {
        toast.success(`Nómina procesada: ${createdCount} registros creados. ${alreadyProcessed} ya habían sido procesados.`);
      } else {
        toast.success(`Nómina procesada: ${createdCount} registros creados`);
      }
      completeNotificationAction(actionToken);
      setProcessDialogOpen(false);
      onRefresh();
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Error al procesar nómina';
      const message = Array.isArray(msg) ? msg[0] || 'Error al procesar nómina' : msg;
      if (/ya (fue procesada|existe una nómina)/i.test(message)) {
        toast.info('La nómina ya fue procesada para el período seleccionado.');
      } else {
        toast.error(message);
      }
      failNotificationAction(actionToken);
    } finally {
      setProcessLoading(false);
    }
  };

  const handleRequestPayment = async (id: string) => {
    const actionToken = beginNotificationAction();
    try {
      await hrService.createPaymentRequest({ requestType: 'PAYROLL', sourceId: id });
      toast.success('Solicitud de pago enviada a Contabilidad');
      completeNotificationAction(actionToken);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar estado');
      failNotificationAction(actionToken);
    }
  };

  const handleDeletePayroll = async (id: string) => {
    const actionToken = beginNotificationAction();
    try {
      setDeleteLoading(true);
      await hrService.deletePayroll(id);
      toast.success('Nómina eliminada exitosamente');
      completeNotificationAction(actionToken);
      onRefresh();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al eliminar nómina');
      failNotificationAction(actionToken);
    } finally {
      setDeleteLoading(false);
      setPendingDeleteId(null);
    }
  };

  const handleRequestAllPayments = async () => {
    const pendingPayrolls = filteredPayrolls.filter((p: any) => payrollEffectiveStatus(p) === 'PENDING');
    if (pendingPayrolls.length === 0) {
      toast.info('No hay nóminas pendientes');
      return;
    }
    const actionToken = beginNotificationAction();
    try {
      await Promise.all(
        pendingPayrolls.map((p: any) => hrService.createPaymentRequest({ requestType: 'PAYROLL', sourceId: p.id }))
      );
      toast.success(`${pendingPayrolls.length} solicitudes enviadas a Contabilidad`);
      completeNotificationAction(actionToken);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar estados');
      failNotificationAction(actionToken);
    }
  };

  const loadPayrollExportRows = async () => {
    const response = await hrService.getPayrolls({ page: 1, pageSize: 5000, report: true, export: true });
    const payload: any = (response as any)?.data ?? response;
    const rows: any[] = Array.isArray(payload) ? payload : payload?.items || payload?.rows || payload?.data || [];
    return rows.filter((payroll) => {
      const employeeMatch = filterEmployee === 'all' || payroll.employeeId === filterEmployee;
      const statusMatch = filterStatus === 'all' || payrollEffectiveStatus(payroll) === filterStatus;
      return employeeMatch && statusMatch;
    });
  };

  const payrollExportRows = (rows: any[]) => rows.map((payroll: any) => ({
    Empleado: payrollEmployeeName(payroll),
    Periodo: `${new Date(payroll.periodStart).toLocaleDateString()} - ${new Date(payroll.periodEnd).toLocaleDateString()}`,
    Periodicidad: payrollFrequencyLabel(payroll.frequency || payroll.employee?.payFrequency),
    'Salario bruto': payrollDisplay(payroll, 'grossPay', 'grossPayBase'),
    'Neto a pagar': payrollDisplay(payroll, 'netPay', 'netPayBase'),
    'Costo empresa': payrollDisplay(payroll, 'costoTotalEmpresa', 'costoTotalEmpresaBase'),
    Estado: pdfStatusLabel(payroll.status),
  }));

  const handleExportPDF = async () => {
    if (!canPerform('HR_PAYROLL', 'export')) return;
    try {
      const exportRows = await loadPayrollExportRows();
      const configured = await generateConfiguredReportTemplate({ targetKey: 'recursos-humanos.payrolls', title: 'Reporte de nóminas', tenantName: user?.tenantName || 'Mi Empresa', tenantLogo: user?.sessionBranding?.logo || null, rows: exportRows, columns: [{ header: 'Empleado', value: row => payrollEmployeeName(row) }, { header: 'Periodo', value: row => `${new Date(row.periodStart).toLocaleDateString()} - ${new Date(row.periodEnd).toLocaleDateString()}` }, { header: 'Periodicidad', value: row => payrollFrequencyLabel(row.frequency || row.employee?.payFrequency) }, { header: 'Salario bruto', value: row => payrollDisplay(row, 'grossPay', 'grossPayBase'), align: 'right' }, { header: 'Neto a pagar', value: row => payrollDisplay(row, 'netPay', 'netPayBase'), align: 'right' }, { header: 'Costo empresa', value: row => payrollDisplay(row, 'costoTotalEmpresa', 'costoTotalEmpresaBase'), align: 'right' }, { header: 'Estado', value: row => pdfStatusLabel(row.status) }], fileName: buildDatedDownloadFileName(['reporte_nominas'], 'pdf') });
      if (configured) { toast.success('Reporte PDF descargado'); return; }
      const pdfSettings = await getPdfDesignSettings('recursos-humanos.payrolls');
      const doc = new jsPDF(pdfDesignPaper(pdfSettings)) as any;
      doc.text("Reporte de Nominas", 14, 15);
      doc.setFontSize(10);
      doc.text(`Generado: ${new Date().toLocaleDateString()}`, 14, 22);

      const tableData = exportRows.map((p: any) => {
        return [
          `${p.employee?.firstName} ${p.employee?.lastName}`,
          `${new Date(p.periodStart).toLocaleDateString()} - ${new Date(p.periodEnd).toLocaleDateString()}`,
          payrollFrequencyLabel(p.frequency || p.employee?.payFrequency),
          payrollDisplay(p, 'grossPay', 'grossPayBase'),
          payrollDisplay(p, 'netPay', 'netPayBase'),
          payrollDisplay(p, 'costoTotalEmpresa', 'costoTotalEmpresaBase'),
          pdfStatusLabel(p.status)
        ];
      });

      doc.autoTable({
        startY: 28,
        head: [['Empleado', 'Periodo', 'Periodicidad', 'Bruto', 'Neto a Pagar', 'Costo Empresa', 'Estado']],
        body: tableData,
      });

      doc.save(buildDatedDownloadFileName(['reporte_nominas'], 'pdf'));
      toast.success('Reporte PDF descargado');
    } catch {
      toast.error('Error generando PDF');
    }
  };

  const handleExportExcel = async () => {
    if (!canPerform('HR_PAYROLL', 'export')) return;
    try {
      const rows = await loadPayrollExportRows();
      createReportWorkbook({
        fileName: buildDatedDownloadFileName(['reporte_nominas'], 'xlsx'),
        sheets: [{ name: 'Nóminas', rows: payrollExportRows(rows) }],
        filters: {
          Empleado: filterEmployee === 'all' ? 'Todos' : employeeOptions.find((option) => option.value === filterEmployee)?.label || filterEmployee,
          Estado: filterStatus === 'all' ? 'Todos' : filterStatus,
        },
      });
      toast.success('Reporte Excel descargado');
    } catch {
      toast.error('Error generando Excel');
    }
  };

  const totalGross = filteredPayrolls.reduce((sum: number, p: any) => sum + payrollBase(p, 'grossPay', 'grossPayBase'), 0);
  const totalNet = filteredPayrolls.reduce((sum: number, p: any) => sum + payrollBase(p, 'netPay', 'netPayBase'), 0);
  const totalCostoEmpresa = filteredPayrolls.reduce((sum: number, p: any) => sum + payrollBase(p, 'costoTotalEmpresa', 'costoTotalEmpresaBase'), 0);
  const payrollCurrencies = summarizeAmountsByCurrency(filteredPayrolls, () => 0, (payroll: any) => payroll.currency || payroll.employee?.currency || 'USD').map((item) => item.currency);
  const originalPayrollSum = (field: string, baseField: string, currency: SupportedCurrency) => filteredPayrolls
    .filter((payroll: any) => normalizeCurrency(payroll.currency || payroll.employee?.currency || 'USD') === currency)
    .reduce((sum: number, payroll: any) => sum + (Number(payroll[field] ?? payroll[baseField] ?? 0) || 0), 0);
  const originalCompanyTax = (currency: SupportedCurrency) => filteredPayrolls
    .filter((payroll: any) => normalizeCurrency(payroll.currency || payroll.employee?.currency || 'USD') === currency)
    .reduce((sum: number, payroll: any) => sum + ((Number(payroll.costoTotalEmpresa ?? payroll.costoTotalEmpresaBase ?? 0) || 0) - (Number(payroll.grossPay ?? payroll.grossPayBase ?? 0) || 0)), 0);
  const renderPayrollMoneyCard = (key: string, label: string, icon: any, tone: 'orange' | 'blue' | 'primary', total: number, amountByCurrency: (currency: SupportedCurrency) => number, onClick: () => void) => displayMode === 'ORIGINAL'
    ? payrollCurrencies.map((currency) => (
      <StatCard key={`${key}-${currency}`} label={`${label} (${currency})`} value={formatExplicitAmount(amountByCurrency(currency), currency)} icon={icon} tone={tone} valueClassName="text-xl" onClick={onClick} />
    ))
    : <StatCard label={`${label}${valuationModeSuffix}`} value={formatCurrentAmount(total, displayCurrency)} icon={icon} tone={tone} sub={key === 'company-cost' ? (valuationModeSuffix ? valuationModeLabel : undefined) : undefined} valueClassName="text-xl" onClick={onClick} />;
  const pendingCount = filteredPayrolls.filter((p: any) => payrollEffectiveStatus(p) === 'PENDING').length;
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const isOverdue = (p: any) => p.status === 'PENDING' && new Date(p.periodEnd) < new Date();
  const overduePayrolls = filteredPayrolls.filter(isOverdue);
  const overdueCount = overduePayrolls.length;

  return (
    <div className="space-y-4">
      {/* Vencidas Alert */}
      {overdueCount > 0 && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle className="font-black tracking-widest uppercase text-xs">Atención Requerida</AlertTitle>
          <AlertDescription>
            Existen {overdueCount} nóminas(s) con fechas de pago o periodos calculados vencidos. Puedes visualizarlas filtrando por "Pendiente".
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="hr-payroll-title">
        {renderPayrollMoneyCard('company-cost', 'Total Bruto (Costo Empresa)', Building2, 'orange', totalCostoEmpresa, (currency) => originalPayrollSum('costoTotalEmpresa', 'costoTotalEmpresaBase', currency), () => { setFilterStatus('all'); setCurrentPage(1); })}
        {renderPayrollMoneyCard('net', 'Total Neto (Recibido)', Wallet, 'blue', totalNet, (currency) => originalPayrollSum('netPay', 'netPayBase', currency), () => { setFilterStatus('all'); setCurrentPage(1); })}
        {renderPayrollMoneyCard('tax', 'Total Impuestos Empresa', Receipt, 'primary', totalCostoEmpresa - totalGross, originalCompanyTax, () => { setFilterStatus('all'); setCurrentPage(1); })}
        <StatCard
          label={overdueCount > 0 ? 'Pendientes (Vencidas)' : 'Pendientes'}
          value={pendingCount}
          icon={CheckCircle}
          tone={overdueCount > 0 ? 'red' : 'amber'}
          sub={overdueCount > 0 ? `${overdueCount} vencida(s) requieren atención` : 'Por pagar'}
          active={filterStatus === 'PENDING'}
          onClick={() => {
            setFilterStatus(prev => (prev === 'PENDING' ? 'all' : 'PENDING'));
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <div className="w-[250px]">
            <Combobox
              options={employeeOptions}
              value={filterEmployee}
              onChange={setFilterEmployee}
              placeholder="Buscar empleado..."
              emptyMessage="No se encontró el empleado"
              data-tour="nominas-employee-filter"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-8 px-3 rounded-md border border-input bg-background text-xs font-medium w-[130px]"
          >
            <option value="all">Todos</option>
            <option value="PENDING">Pendiente</option>
            <option value="PARTIAL">Pago parcial</option>
            <option value="APPROVED">Aprobada</option>
            <option value="PAID">Pagado</option>
          </select>
        </div>
        <div className="erp-list-toolbar flex flex-wrap items-center gap-2" data-tour="hr-payroll-actions">
          {canPerform('HR_PAYROLL', 'export') && (
            <ExportMenu onPdf={() => void handleExportPDF()} onExcel={() => void handleExportExcel()} pdfDescription="Nóminas con la estructura configurada" excelDescription="Todas las nóminas filtradas" />
          )}
          {pendingCount > 0 && canPerform('HR_PAYROLL', 'approve') && (
            <Button size="sm" onClick={handleRequestAllPayments} className="bg-primary hover:bg-primary/90 !text-primary-foreground">
              <Send className="size-4 mr-2" />
              Solicitar pagos ({pendingCount})
            </Button>
          )}
          <div className="flex items-center gap-2 mx-2">
            <input 
              type="checkbox" 
              id="includeComm" 
              checked={includeCommissions} 
              onChange={(e) => setIncludeCommissions(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary h-4 w-4 accent-primary"
            />
            <label htmlFor="includeComm" className="text-xs font-bold text-muted-foreground uppercase tracking-widest cursor-pointer select-none">
              Incluir Comisiones
            </label>
          </div>
          {canPerform('HR_PAYROLL', 'approve') && (
            <Button size="sm" onClick={handleOpenProcessPayroll} data-toolbar-role="primary" className="bg-primary hover:bg-primary/90 !text-primary-foreground" data-tour="nominas-process">
              <Calculator className="size-4 mr-2" />
              Procesar Nómina
            </Button>
          )}
          <HRViewTutorial label="Cómo procesar nómina" targetPrefix="hr-payroll" stepKeys={['title', 'data', 'actions']} copy={{ data: { title: 'Listado de nóminas', description: 'Consulta empleados, períodos, montos, estados y el desglose de cada nómina.' }, actions: { description: 'Filtra, descarga el reporte, paga pendientes o procesa el período actual incluyendo comisiones.' } }} />
        </div>
      </div>

      {/* Payroll Table */}
      <div data-tour="hr-payroll-data" className="border rounded-lg overflow-hidden flex flex-col">
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full min-w-[1100px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold"><span className="inline-flex items-center gap-1">Empleado<ColumnFilterMenu label="Empleado" options={employeeNameOptions} selected={colFilters.state.employee?.values || []} onSelect={(values) => colFilters.setValues('employee', values)} sort={colFilters.state.employee?.sort || null} onSort={(sort) => colFilters.setSort('employee', sort)} /></span></th>
                <th className="px-4 py-3 text-left text-xs font-semibold"><span className="inline-flex items-center gap-1">Período<ColumnFilterMenu label="Período" sort={colFilters.state.periodStart?.sort || null} onSort={(sort) => colFilters.setSort('periodStart', sort)} sortOptions={[{ value: 'desc', label: 'Más recientes' }, { value: 'asc', label: 'Más antiguos' }]} /></span></th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Periodicidad</th>
                <th className="px-4 py-3 text-right text-xs font-semibold"><span className="inline-flex items-center gap-1 justify-end">Salario Bruto<ColumnFilterMenu label="Salario Bruto" sort={colFilters.state.gross?.sort || null} onSort={(sort) => colFilters.setSort('gross', sort)} /></span></th>
                <th className="px-4 py-3 text-right text-xs font-semibold"><span className="inline-flex items-center gap-1 justify-end">Neto a Pagar<ColumnFilterMenu label="Neto a Pagar" sort={colFilters.state.net?.sort || null} onSort={(sort) => colFilters.setSort('net', sort)} /></span></th>
                <th className="px-4 py-3 text-right text-xs font-semibold"><span className="inline-flex items-center gap-1 justify-end">Costo Total Empresa<ColumnFilterMenu label="Costo Total Empresa" sort={colFilters.state.cost?.sort || null} onSort={(sort) => colFilters.setSort('cost', sort)} /></span></th>
                <th className="px-4 py-3 text-left text-xs font-semibold"><span className="inline-flex items-center gap-1">Estado<ColumnFilterMenu label="Estado" options={statusOptionsForFilter} selected={colFilters.state.status?.values || []} onSelect={(values) => colFilters.setValues('status', values)} sort={colFilters.state.status?.sort || null} onSort={(sort) => colFilters.setSort('status', sort)} /></span></th>
                <th className="px-4 py-3 text-right text-xs font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginatedPayrolls.map((payroll: any) => {
                const effectiveStatus = payrollEffectiveStatus(payroll);
                return (
                  <React.Fragment key={payroll.id}>
                  <tr className="hover:bg-muted/50 cursor-pointer" onClick={() => setExpandedRow(expandedRow === payroll.id ? null : payroll.id)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                          {payroll.employee?.firstName?.[0]}{payroll.employee?.lastName?.[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {payroll.employee?.firstName} {payroll.employee?.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {payroll.employee?.employeeNumber}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {formatDateEs(payroll.periodStart)} - {formatDateEs(payroll.periodEnd)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-primary">
                        {payrollFrequencyLabel(payroll.frequency || payroll.employee?.payFrequency)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold">
                      {payrollDisplay(payroll, 'grossPay', 'grossPayBase')}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-primary">
                      {payrollDisplay(payroll, 'netPay', 'netPayBase')}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-warning dark:text-warning">
                      {payrollDisplay(payroll, 'costoTotalEmpresa', 'costoTotalEmpresaBase')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-lg font-bold ${
                        effectiveStatus === 'PAID' ? 'bg-success/10 text-success dark:bg-success/30 dark:text-success' :
                        effectiveStatus === 'PARTIAL' ? 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-500' :
                        effectiveStatus === 'APPROVED' ? 'bg-info/10 text-info dark:bg-info/30 dark:text-info' :
                        isOverdue(payroll) ? 'bg-destructive/10 text-destructive dark:bg-destructive/30 dark:text-destructive border border-destructive/20 shadow-sm shadow-destructive/20' :
                        effectiveStatus === 'PENDING' ? 'bg-warning/10 text-warning dark:bg-warning/30 dark:text-warning' :
                        'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground'
                      }`}>
                        {effectiveStatus === 'PAID' ? 'Pagado' : effectiveStatus === 'PARTIAL' ? 'Pago parcial' : effectiveStatus === 'APPROVED' ? 'Aprobada' : isOverdue(payroll) ? 'Vencida' : effectiveStatus === 'PENDING' ? 'Pendiente' : effectiveStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {effectiveStatus !== 'PAID' && (
                          <>
                            {effectiveStatus === 'PENDING' && canPerform('HR_PAYROLL', 'approve') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => { e.stopPropagation(); handleRequestPayment(payroll.id); }}
                                className="h-7 px-3 text-xs text-primary hover:text-primary hover:bg-primary/10 font-semibold"
                              >
                                <Send className="size-3.5 mr-1" />
                                Solicitar pago
                              </Button>
                            )}
                            {effectiveStatus === 'REQUESTED' && <span className="px-2 text-[10px] font-black uppercase text-warning">Solicitud enviada</span>}
                            {effectiveStatus === 'APPROVED' && <span className="px-2 text-[10px] font-black uppercase text-info">Aprobada en Contabilidad</span>}
                            {effectiveStatus === 'PARTIAL' && <span className="px-2 text-[10px] font-black uppercase text-orange-600">Pago parcial · saldo en Contabilidad</span>}
                            {canPerform('HR_PAYROLL', 'edit') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => { e.stopPropagation(); handleOpenEditPayroll(payroll); }}
                                className="h-7 px-3 text-xs text-primary hover:text-primary hover:bg-primary/10 font-semibold"
                                title="Editar nómina"
                              >
                                <Pencil className="size-3.5 mr-1" />
                                Editar
                              </Button>
                            )}
                            {effectiveStatus !== 'PARTIAL' && canPerform('HR_PAYROLL', 'delete') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => { e.stopPropagation(); setPendingDeleteId(payroll.id); }}
                                className="h-7 px-3 text-xs text-destructive hover:text-destructive-foreground hover:bg-destructive/10 font-semibold"
                              >
                                <Trash2 className="size-3.5 mr-1" />
                                Eliminar
                              </Button>
                            )}
                          </>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); setExpandedRow(expandedRow === payroll.id ? null : payroll.id); }}>
                          {expandedRow === payroll.id ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {/* Expanded row with desglose */}
                  {expandedRow === payroll.id && (
                    <tr className="bg-muted/30">
                      <td colSpan={8} className="px-4 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          <div className="space-y-2">
                            <p className="font-black uppercase tracking-widest text-destructive text-[10px]">Deducciones Empleado</p>
                            <div className="space-y-1">
                              <div className="flex justify-between"><span className="text-muted-foreground">INSS Laboral ({payroll.snapshotInssLaboralPct || '—'}%)</span><span className="font-bold">-{payrollDisplay(payroll, 'inssLaboral', 'inssLaboralBase')}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">IR ({payroll.snapshotIrPct || '—'}%)</span><span className="font-bold">-{payrollDisplay(payroll, 'ir', 'irBase')}</span></div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="font-black uppercase tracking-widest text-warning text-[10px]">Aportes Patronales</p>
                            <div className="space-y-1">
                              <div className="flex justify-between"><span className="text-muted-foreground">INSS Patronal ({payroll.snapshotInssPatronalPct || '—'}%)</span><span className="font-bold">+{payrollDisplay(payroll, 'inssPatronal', 'inssPatronalBase')}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">INATEC ({payroll.snapshotInatecPct || '—'}%)</span><span className="font-bold">+{payrollDisplay(payroll, 'inatec', 'inatecBase')}</span></div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="font-black uppercase tracking-widest text-info text-[10px]">Provisiones</p>
                            <div className="space-y-1">
                              <div className="flex justify-between"><span className="text-muted-foreground">Treceavo Mes ({payroll.snapshotTrecenoMesPct || '—'}%)</span><span className="font-bold">+{payrollDisplay(payroll, 'trecenoMes', 'trecenoMesBase')}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Vacaciones ({payroll.snapshotVacacionesPct || '—'}%)</span><span className="font-bold">+{payrollDisplay(payroll, 'vacacionesProv', 'vacacionesProvBase')}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Indemnización ({payroll.snapshotIndemnizacionPct || '—'}%)</span><span className="font-bold">+{payrollDisplay(payroll, 'indemnizacion', 'indemnizacionBase')}</span></div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="font-black uppercase tracking-widest text-muted-foreground text-[10px]">Desglose</p>
                            <div className="space-y-1">
                              <div className="flex justify-between"><span className="text-muted-foreground">Bonos</span><span className="font-bold text-success">+{payrollDisplay(payroll, 'bonuses', 'bonusesBase')}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">H. Extra</span><span className="font-bold text-info">+{payrollDisplay(payroll, 'overtime', 'overtimeBase')}</span></div>
                              {Number(payroll.commissionsSales || 0) > 0 && (
                                <div className="flex justify-between"><span className="text-muted-foreground">Comisiones por Ventas</span><span className="font-bold text-success">+{payrollDisplay(payroll, 'commissionsSales', 'commissionsSalesBase')}</span></div>
                              )}
                              <div className="flex justify-between"><span className="text-muted-foreground">Otras Deducc.</span><span className="font-bold text-destructive">-{payrollDisplay(payroll, 'deductions', 'deductionsBase')}</span></div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="block md:hidden space-y-4 p-4 bg-muted/10">
          {paginatedPayrolls.map((payroll: any) => {
            const effectiveStatus = payrollEffectiveStatus(payroll);
            return (
              <div key={payroll.id} className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card to-background p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4 border-b border-primary/10 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                      {payroll.employee?.firstName?.[0]}{payroll.employee?.lastName?.[0]}
                    </div>
                    <div>
                      <p className="font-bold text-sm tracking-tight">{payroll.employee?.firstName} {payroll.employee?.lastName}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">{payroll.employee?.employeeNumber}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-lg font-bold shadow-sm ${
                    effectiveStatus === 'PAID' ? 'bg-success/10 text-success dark:bg-success/30 dark:text-success' :
                    effectiveStatus === 'PARTIAL' ? 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/20' :
                    effectiveStatus === 'APPROVED' ? 'bg-info/10 text-info dark:bg-info/30' :
                    isOverdue(payroll) ? 'bg-destructive/10 text-destructive dark:bg-destructive/30 border border-destructive/20 shadow-destructive/20' :
                    effectiveStatus === 'PENDING' ? 'bg-warning/10 text-warning dark:bg-warning/30 dark:text-warning' :
                    'bg-muted text-muted-foreground dark:bg-muted'
                  }`}>
                    {effectiveStatus === 'PAID' ? 'PAGADO' : effectiveStatus === 'PARTIAL' ? 'PAGO PARCIAL' : effectiveStatus === 'APPROVED' ? 'APROBADA' : isOverdue(payroll) ? 'VENCIDA' : effectiveStatus === 'PENDING' ? 'PENDIENTE' : effectiveStatus}
                  </span>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Período</span>
                    <span className="font-semibold text-right">{formatDateEs(payroll.periodStart)} - {formatDateEs(payroll.periodEnd)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Periodicidad</span>
                    <span className="font-semibold text-right text-primary">{payrollFrequencyLabel(payroll.frequency || payroll.employee?.payFrequency)}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Salario Bruto</span>
                    <span className="font-semibold text-right">{payrollDisplay(payroll, 'grossPay', 'grossPayBase')}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs bg-primary/5 p-2 rounded-lg border border-primary/10">
                    <span className="text-primary font-black uppercase text-[10px] tracking-widest">Neto a Pagar</span>
                    <span className="font-black text-primary text-sm text-right">{payrollDisplay(payroll, 'netPay', 'netPayBase')}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Costo Total</span>
                    <span className="font-bold text-warning dark:text-warning text-right">{payrollDisplay(payroll, 'costoTotalEmpresa', 'costoTotalEmpresaBase')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                  <Button size="sm" variant="outline" className="flex-1 rounded-xl text-[11px] h-8" onClick={() => setExpandedRow(expandedRow === payroll.id ? null : payroll.id)}>
                    {expandedRow === payroll.id ? <><ChevronUp className="size-3 mr-1"/>Desglose</> : <><ChevronDown className="size-3 mr-1"/>Desglose</>}
                  </Button>
                  {effectiveStatus !== 'PAID' && (
                    <>
                      {effectiveStatus === 'PENDING' && canPerform('HR_PAYROLL', 'approve') && (
                        <Button size="sm" onClick={() => handleRequestPayment(payroll.id)} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-[11px] h-8">
                          <Send className="size-3 mr-1" /> Solicitar pago
                        </Button>
                      )}
                      {effectiveStatus === 'REQUESTED' && <span className="flex flex-1 items-center justify-center text-[10px] font-black uppercase text-warning">Solicitud enviada</span>}
                      {effectiveStatus === 'APPROVED' && <span className="flex flex-1 items-center justify-center text-[10px] font-black uppercase text-info">Aprobada en Contabilidad</span>}
                      {effectiveStatus === 'PARTIAL' && <span className="flex flex-1 items-center justify-center text-[10px] font-black uppercase text-orange-600">Pago parcial</span>}
                      {canPerform('HR_PAYROLL', 'edit') && (
                        <Button size="sm" variant="outline" onClick={() => handleOpenEditPayroll(payroll)} className="px-3 text-primary border-primary/30 hover:bg-primary/10 rounded-xl h-8" title="Editar nómina">
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                      {effectiveStatus !== 'PARTIAL' && canPerform('HR_PAYROLL', 'delete') && (
                        <Button size="sm" variant="outline" onClick={() => setPendingDeleteId(payroll.id)} className="px-3 text-destructive border-destructive hover:bg-destructive hover:border-destructive rounded-xl h-8">
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
                
                {expandedRow === payroll.id && (
                  <div className="mt-4 pt-4 border-t border-border/50 grid gap-x-4 gap-y-3 grid-cols-2 text-[10px]">
                    <div className="space-y-1.5">
                      <p className="font-black uppercase tracking-widest text-destructive text-[9px]">Deducciones</p>
                      <div className="flex justify-between"><span className="text-muted-foreground mr-1">INSS L.</span><span className="font-bold text-destructive text-right">-{payrollDisplay(payroll, 'inssLaboral', 'inssLaboralBase')}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground mr-1">IR</span><span className="font-bold text-destructive text-right">-{payrollDisplay(payroll, 'ir', 'irBase')}</span></div>
                      {Number(payroll.deductions || 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground mr-1">Otras</span><span className="font-bold text-destructive text-right">-{payrollDisplay(payroll, 'deductions', 'deductionsBase')}</span></div>}
                    </div>
                    <div className="space-y-1.5">
                      <p className="font-black uppercase tracking-widest text-success text-[9px]">Ingresos</p>
                      <div className="flex justify-between"><span className="text-muted-foreground mr-1">Bonos</span><span className="font-bold text-success text-right">+{payrollDisplay(payroll, 'bonuses', 'bonusesBase')}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground mr-1">H. Extra</span><span className="font-bold text-success text-right">+{payrollDisplay(payroll, 'overtime', 'overtimeBase')}</span></div>
                      {Number(payroll.commissionsSales || 0) > 0 && (
                        <div className="flex justify-between"><span className="text-muted-foreground mr-1">Cmsns.</span><span className="font-bold text-success text-right">+{payrollDisplay(payroll, 'commissionsSales', 'commissionsSalesBase')}</span></div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <p className="font-black uppercase tracking-widest text-warning text-[9px]">Aportes</p>
                      <div className="flex justify-between"><span className="text-muted-foreground mr-1">INSS P.</span><span className="font-bold text-right">+{payrollDisplay(payroll, 'inssPatronal', 'inssPatronalBase')}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground mr-1">INATEC</span><span className="font-bold text-right">+{payrollDisplay(payroll, 'inatec', 'inatecBase')}</span></div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="font-black uppercase tracking-widest text-info text-[9px]">Provisiones</p>
                      <div className="flex justify-between"><span className="text-muted-foreground mr-1">Vacac.</span><span className="font-bold text-info text-right">+{payrollDisplay(payroll, 'vacacionesProv', 'vacacionesProvBase')}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground mr-1">Treaceavo</span><span className="font-bold text-info text-right">+{payrollDisplay(payroll, 'trecenoMes', 'trecenoMesBase')}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground mr-1">Indem.</span><span className="font-bold text-info text-right">+{payrollDisplay(payroll, 'indemnizacion', 'indemnizacionBase')}</span></div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination Controls */}
      {filteredPayrolls.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border/20">
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-medium">
            <div className="flex items-center gap-2">
              <span>Mostrar</span>
              <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="h-8 rounded-lg border bg-background px-2 font-bold text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer">
                {PAGE_SIZE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <span>por página</span>
            </div>
            <div className="h-4 w-px bg-border/40 hidden sm:block" />
            <p className="bg-primary/5 px-3 py-1 rounded-full border border-primary/10">
              Mostrando <span className="text-foreground font-black">{colFilteredPayrolls.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, colFilteredPayrolls.length)}</span> de <span className="text-primary font-black">{colFilteredPayrolls.length}</span> registros totales
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

      {filteredPayrolls.length === 0 && (
        <div className="text-center py-12">
          <DollarSign className="size-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No se encontraron registros de nómina</p>
        </div>
      )}

      <Dialog open={processDialogOpen} onOpenChange={(open) => { if (!open && !processLoading) setProcessDialogOpen(false); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarDays className="size-5 text-primary" /> Procesar nómina</DialogTitle>
            <DialogDescription>
              Selecciona una frecuencia o procesa todas. Para “Todas las frecuencias” se agrupan los empleados según su configuración y cada grupo recibe su período correspondiente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="payroll-process-frequency" className="text-sm font-medium">Periodicidad de pago</label>
              <select
                id="payroll-process-frequency"
                value={processFrequency}
                onChange={(event) => setProcessFrequency(event.target.value as PayrollFrequency)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-medium"
                disabled={processLoading || Boolean(selectedProcessEmployee)}
              >
                {PAYROLL_FREQUENCY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Período sugerido</p>
              <p className="mt-1 text-sm font-bold text-foreground">{formatDateEs(processPeriod.start)} – {formatDateEs(processPeriod.end)}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {processFrequency === 'ALL'
                  ? 'Se procesarán por separado los grupos semanal, quincenal y mensual. El salario mensual fijo se prorratea dentro de cada grupo.'
                  : `El salario mensual fijo se prorratea automáticamente a ${payrollFrequencyLabel(processFrequency).toLowerCase()} y la periodicidad queda guardada en el registro.`}
              </p>
            </div>
            {hasProcessFrequencyMismatch && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertTitle>Frecuencia incompatible</AlertTitle>
                <AlertDescription>
                  El empleado seleccionado tiene periodicidad {payrollFrequencyLabel(selectedEmployeeFrequency).toLowerCase()}. Cambia la opción o selecciona “Todos los empleados”.
                </AlertDescription>
              </Alert>
            )}
            {selectedEmployeeUnsupported && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertTitle>Frecuencia pendiente de corrección</AlertTitle>
                <AlertDescription>
                  El empleado seleccionado tiene una frecuencia por hora no compatible. Corrige su expediente a semanal, quincenal o mensual antes de procesarlo.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessDialogOpen(false)} disabled={processLoading}>Cancelar</Button>
            <Button onClick={handleProcessPayroll} disabled={processLoading || hasProcessFrequencyMismatch || selectedEmployeeUnsupported}>
              {processLoading ? 'Procesando…' : 'Confirmar y procesar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editingPayroll !== null} onOpenChange={(open) => { if (!open && !payrollSaveLoading) setEditingPayroll(null); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Editar nómina</DialogTitle>
            <DialogDescription>
              Actualiza el período y las notas de una nómina pendiente. Los montos calculados se conservan.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="payroll-period-start" className="text-sm font-medium">Inicio del período</label>
              <Input id="payroll-period-start" type="date" value={payrollForm.periodStart} onChange={(e) => setPayrollForm((current) => ({ ...current, periodStart: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label htmlFor="payroll-period-end" className="text-sm font-medium">Fin del período</label>
              <Input id="payroll-period-end" type="date" value={payrollForm.periodEnd} onChange={(e) => setPayrollForm((current) => ({ ...current, periodEnd: e.target.value }))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="payroll-notes" className="text-sm font-medium">Notas</label>
              <Input id="payroll-notes" value={payrollForm.notes} onChange={(e) => setPayrollForm((current) => ({ ...current, notes: e.target.value }))} placeholder="Observaciones opcionales" />
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={handleRecalculatePayroll} disabled={payrollSaveLoading || payrollRecalculateLoading || !canPerform('HR_PAYROLL', 'edit')}>
              {payrollRecalculateLoading ? 'Recalculando…' : 'Recalcular montos'}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingPayroll(null)} disabled={payrollSaveLoading || payrollRecalculateLoading}>Cancelar</Button>
              <Button onClick={handleSavePayroll} disabled={payrollSaveLoading || payrollRecalculateLoading}>{payrollSaveLoading ? 'Guardando…' : 'Guardar cambios'}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog 
        open={pendingDeleteId !== null} 
        onOpenChange={open => { if (!open) setPendingDeleteId(null); }} 
        title="¿Eliminar Nómina?" 
        description="¿Estás seguro de eliminar esta nómina? Los datos no se podrán recuperar y las comisiones volverán a estado pendiente." 
        confirmLabel="Eliminar" 
        variant="destructive" 
        loading={deleteLoading} 
        onConfirm={() => pendingDeleteId ? handleDeletePayroll(pendingDeleteId) : Promise.resolve()} 
      />
    </div>
  );
}
