import React from 'react';
import { useState } from 'react';
import { DollarSign, Download, Calculator, CheckCircle, Building2, ChevronDown, ChevronUp, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Wallet, Receipt, Send, Pencil } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { hrService } from '../../services/hr.service';
import { Combobox } from '../ui/Combobox';
import { useCurrency } from '../../contexts/CurrencyContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertTriangle } from 'lucide-react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { getPdfDesignSettings, pdfDesignPaper } from '../../utils/pdfGenerator';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { StatCard } from './StatCard';
import { formatDateEs } from '../../utils/dateFormat';
import { HRViewTutorial } from './HRViewTutorial';

export function NominasView({ payrolls, employees, onRefresh }: any) {
  const { displayCurrency, valuationMode, valuationModeLabel, valuationModeSuffix, formatCurrentAmount, convertAmount, convertCurrentAmount } = useCurrency();
  const { canPerform } = useAuth();
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [includeCommissions, setIncludeCommissions] = useState(true);
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
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
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
    { value: 'PENDING', label: 'Pendiente', count: filteredPayrolls.filter((p: any) => p.status === 'PENDING').length },
    { value: 'PAID', label: 'Pagado', count: filteredPayrolls.filter((p: any) => p.status === 'PAID').length },
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
    try {
      setPayrollSaveLoading(true);
      await hrService.updatePayroll(editingPayroll.id, {
        periodStart: new Date(`${payrollForm.periodStart}T00:00:00`).toISOString(),
        periodEnd: new Date(`${payrollForm.periodEnd}T23:59:59.999`).toISOString(),
        notes: payrollForm.notes || null,
      });
      toast.success('Nómina actualizada');
      setEditingPayroll(null);
      onRefresh();
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Error al actualizar la nómina';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setPayrollSaveLoading(false);
    }
  };

  const handleProcessPayroll = async () => {
    try {
      const today = new Date();
      const periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const payload: any = {
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        includeCommissions,
      };
      if (filterEmployee !== 'all') {
        payload.employeeIds = [filterEmployee];
      }

      const result: any = await hrService.bulkProcessPayroll(payload);
      toast.success(`Nómina procesada: ${result.count} registros creados`);
      onRefresh();
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Error al procesar nómina';
      toast.error(typeof msg === 'string' ? msg : msg[0] || 'Error al procesar nómina');
    }
  };

  const handleRequestPayment = async (id: string) => {
    try {
      await hrService.createPaymentRequest({ requestType: 'PAYROLL', sourceId: id });
      toast.success('Solicitud de pago enviada a Contabilidad');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar estado');
    }
  };

  const handleDeletePayroll = async (id: string) => {
    try {
      setDeleteLoading(true);
      await hrService.deletePayroll(id);
      toast.success('Nómina eliminada exitosamente');
      onRefresh();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al eliminar nómina');
    } finally {
      setDeleteLoading(false);
      setPendingDeleteId(null);
    }
  };

  const handleRequestAllPayments = async () => {
    const pendingPayrolls = filteredPayrolls.filter((p: any) => p.status === 'PENDING' && String(p.paymentStatus || 'PENDING') === 'PENDING');
    if (pendingPayrolls.length === 0) {
      toast.info('No hay nóminas pendientes');
      return;
    }
    try {
      await Promise.all(
        pendingPayrolls.map((p: any) => hrService.createPaymentRequest({ requestType: 'PAYROLL', sourceId: p.id }))
      );
      toast.success(`${pendingPayrolls.length} solicitudes enviadas a Contabilidad`);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar estados');
    }
  };

  const handleExportPDF = async () => {
    try {
      const pdfSettings = await getPdfDesignSettings('recursos-humanos.payrolls');
      const doc = new jsPDF(pdfDesignPaper(pdfSettings)) as any;
      doc.text("Reporte de Nominas", 14, 15);
      doc.setFontSize(10);
      doc.text(`Generado: ${new Date().toLocaleDateString()}`, 14, 22);

      const tableData = filteredPayrolls.map((p: any) => {
        return [
          `${p.employee?.firstName} ${p.employee?.lastName}`,
          `${new Date(p.periodStart).toLocaleDateString()} - ${new Date(p.periodEnd).toLocaleDateString()}`,
          payrollDisplay(p, 'grossPay', 'grossPayBase'),
          payrollDisplay(p, 'netPay', 'netPayBase'),
          payrollDisplay(p, 'costoTotalEmpresa', 'costoTotalEmpresaBase'),
          p.status === 'PAID' ? 'Pagado' : p.status === 'PENDING' ? 'Pendiente' : p.status
        ];
      });

      doc.autoTable({
        startY: 28,
        head: [['Empleado', 'Periodo', 'Bruto', 'Neto a Pagar', 'Costo Empresa', 'Estado']],
        body: tableData,
      });

      doc.save(`nominas_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Reporte PDF descargado');
    } catch {
      toast.error('Error generando PDF');
    }
  };

  const totalGross = filteredPayrolls.reduce((sum: number, p: any) => sum + payrollBase(p, 'grossPay', 'grossPayBase'), 0);
  const totalNet = filteredPayrolls.reduce((sum: number, p: any) => sum + payrollBase(p, 'netPay', 'netPayBase'), 0);
  const totalCostoEmpresa = filteredPayrolls.reduce((sum: number, p: any) => sum + payrollBase(p, 'costoTotalEmpresa', 'costoTotalEmpresaBase'), 0);
  const pendingCount = filteredPayrolls.filter((p: any) => p.status === 'PENDING' && String(p.paymentStatus || 'PENDING') === 'PENDING').length;
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const isOverdue = (p: any) => p.status === 'PENDING' && new Date(p.periodEnd) < new Date();
  const overduePayrolls = filteredPayrolls.filter(isOverdue);
  const overdueCount = overduePayrolls.length;

  return (
    <div className="space-y-4">
      {/* Vencidas Alert */}
      {overdueCount > 0 && (
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-600">
          <AlertTriangle className="size-4" />
          <AlertTitle className="font-black tracking-widest uppercase text-xs">Atención Requerida</AlertTitle>
          <AlertDescription>
            Existen {overdueCount} nóminas(s) con fechas de pago o periodos calculados vencidos. Puedes visualizarlas filtrando por "Pendiente".
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-tour="hr-payroll-title">
        <StatCard
          label="Total Bruto (Costo Empresa)"
          value={formatCurrentAmount(totalCostoEmpresa, displayCurrency)}
          icon={Building2}
          tone="orange"
          sub={valuationModeSuffix ? valuationModeLabel : undefined}
          valueClassName="text-xl"
          onClick={() => { setFilterStatus('all'); setCurrentPage(1); }}
        />
        <StatCard
          label="Total Neto (Recibido)"
          value={formatCurrentAmount(totalNet, displayCurrency)}
          icon={Wallet}
          tone="blue"
          valueClassName="text-xl"
          onClick={() => { setFilterStatus('all'); setCurrentPage(1); }}
        />
        <StatCard
          label="Total Impuestos Empresa"
          value={formatCurrentAmount(totalCostoEmpresa - totalGross, displayCurrency)}
          icon={Receipt}
          tone="primary"
          valueClassName="text-xl"
          onClick={() => { setFilterStatus('all'); setCurrentPage(1); }}
        />
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
            <option value="PAID">Pagado</option>
          </select>
        </div>
        <div className="erp-list-toolbar flex flex-wrap items-center gap-2" data-tour="hr-payroll-actions">
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="size-4 mr-2" />
            Descargar PDF
          </Button>
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
          {canPerform('HR_PAYROLL', 'create') && (
            <Button size="sm" onClick={handleProcessPayroll} data-toolbar-role="primary" className="bg-primary hover:bg-primary/90 !text-primary-foreground" data-tour="nominas-process">
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
                <th className="px-4 py-3 text-right text-xs font-semibold"><span className="inline-flex items-center gap-1 justify-end">Salario Bruto<ColumnFilterMenu label="Salario Bruto" sort={colFilters.state.gross?.sort || null} onSort={(sort) => colFilters.setSort('gross', sort)} /></span></th>
                <th className="px-4 py-3 text-right text-xs font-semibold"><span className="inline-flex items-center gap-1 justify-end">Neto a Pagar<ColumnFilterMenu label="Neto a Pagar" sort={colFilters.state.net?.sort || null} onSort={(sort) => colFilters.setSort('net', sort)} /></span></th>
                <th className="px-4 py-3 text-right text-xs font-semibold"><span className="inline-flex items-center gap-1 justify-end">Costo Total Empresa<ColumnFilterMenu label="Costo Total Empresa" sort={colFilters.state.cost?.sort || null} onSort={(sort) => colFilters.setSort('cost', sort)} /></span></th>
                <th className="px-4 py-3 text-left text-xs font-semibold"><span className="inline-flex items-center gap-1">Estado<ColumnFilterMenu label="Estado" options={statusOptionsForFilter} selected={colFilters.state.status?.values || []} onSelect={(values) => colFilters.setValues('status', values)} sort={colFilters.state.status?.sort || null} onSort={(sort) => colFilters.setSort('status', sort)} /></span></th>
                <th className="px-4 py-3 text-right text-xs font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginatedPayrolls.map((payroll: any) => {
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
                    <td className="px-4 py-3 text-right text-sm font-semibold">
                      {payrollDisplay(payroll, 'grossPay', 'grossPayBase')}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-primary">
                      {payrollDisplay(payroll, 'netPay', 'netPayBase')}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-orange-600 dark:text-orange-400">
                      {payrollDisplay(payroll, 'costoTotalEmpresa', 'costoTotalEmpresaBase')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-lg font-bold ${
                        payroll.status === 'PAID' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        isOverdue(payroll) ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-500/20 shadow-sm shadow-red-500/20' :
                        payroll.status === 'PENDING' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                        'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        {payroll.status === 'PAID' ? 'Pagado' : isOverdue(payroll) ? 'Vencida' : payroll.status === 'PENDING' ? 'Pendiente' : payroll.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {payroll.status === 'PENDING' && (
                          <>
                            {String(payroll.paymentStatus || 'PENDING') === 'PENDING' && canPerform('HR_PAYROLL', 'approve') && (
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
                            {String(payroll.paymentStatus || 'PENDING') === 'REQUESTED' && <span className="px-2 text-[10px] font-black uppercase text-amber-600">Solicitud enviada</span>}
                            {String(payroll.paymentStatus || 'PENDING') === 'APPROVED' && <span className="px-2 text-[10px] font-black uppercase text-sky-600">Aprobada en Contabilidad</span>}
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
                            {canPerform('HR_PAYROLL', 'delete') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => { e.stopPropagation(); setPendingDeleteId(payroll.id); }}
                                className="h-7 px-3 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 font-semibold"
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
                      <td colSpan={7} className="px-4 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          <div className="space-y-2">
                            <p className="font-black uppercase tracking-widest text-red-500 text-[10px]">Deducciones Empleado</p>
                            <div className="space-y-1">
                              <div className="flex justify-between"><span className="text-muted-foreground">INSS Laboral ({payroll.snapshotInssLaboralPct || '—'}%)</span><span className="font-bold">-{payrollDisplay(payroll, 'inssLaboral', 'inssLaboralBase')}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">IR ({payroll.snapshotIrPct || '—'}%)</span><span className="font-bold">-{payrollDisplay(payroll, 'ir', 'irBase')}</span></div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="font-black uppercase tracking-widest text-orange-500 text-[10px]">Aportes Patronales</p>
                            <div className="space-y-1">
                              <div className="flex justify-between"><span className="text-muted-foreground">INSS Patronal ({payroll.snapshotInssPatronalPct || '—'}%)</span><span className="font-bold">+{payrollDisplay(payroll, 'inssPatronal', 'inssPatronalBase')}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">INATEC ({payroll.snapshotInatecPct || '—'}%)</span><span className="font-bold">+{payrollDisplay(payroll, 'inatec', 'inatecBase')}</span></div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="font-black uppercase tracking-widest text-blue-500 text-[10px]">Provisiones</p>
                            <div className="space-y-1">
                              <div className="flex justify-between"><span className="text-muted-foreground">Treceavo Mes ({payroll.snapshotTrecenoMesPct || '—'}%)</span><span className="font-bold">+{payrollDisplay(payroll, 'trecenoMes', 'trecenoMesBase')}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Vacaciones ({payroll.snapshotVacacionesPct || '—'}%)</span><span className="font-bold">+{payrollDisplay(payroll, 'vacacionesProv', 'vacacionesProvBase')}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Indemnización ({payroll.snapshotIndemnizacionPct || '—'}%)</span><span className="font-bold">+{payrollDisplay(payroll, 'indemnizacion', 'indemnizacionBase')}</span></div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="font-black uppercase tracking-widest text-muted-foreground text-[10px]">Desglose</p>
                            <div className="space-y-1">
                              <div className="flex justify-between"><span className="text-muted-foreground">Bonos</span><span className="font-bold text-green-600">+{payrollDisplay(payroll, 'bonuses', 'bonusesBase')}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">H. Extra</span><span className="font-bold text-blue-600">+{payrollDisplay(payroll, 'overtime', 'overtimeBase')}</span></div>
                              {Number(payroll.commissionsSales || 0) > 0 && (
                                <div className="flex justify-between"><span className="text-muted-foreground">Comisiones por Ventas</span><span className="font-bold text-emerald-600">+{payrollDisplay(payroll, 'commissionsSales', 'commissionsSalesBase')}</span></div>
                              )}
                              <div className="flex justify-between"><span className="text-muted-foreground">Otras Deducc.</span><span className="font-bold text-red-600">-{payrollDisplay(payroll, 'deductions', 'deductionsBase')}</span></div>
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
                    payroll.status === 'PAID' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    isOverdue(payroll) ? 'bg-red-100 text-red-700 dark:bg-red-900/30 border border-red-500/20 shadow-red-500/20' :
                    payroll.status === 'PENDING' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-800'
                  }`}>
                    {payroll.status === 'PAID' ? 'PAGADO' : isOverdue(payroll) ? 'VENCIDA' : payroll.status === 'PENDING' ? 'PENDIENTE' : payroll.status}
                  </span>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Período</span>
                    <span className="font-semibold text-right">{formatDateEs(payroll.periodStart)} - {formatDateEs(payroll.periodEnd)}</span>
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
                    <span className="font-bold text-orange-600 dark:text-orange-400 text-right">{payrollDisplay(payroll, 'costoTotalEmpresa', 'costoTotalEmpresaBase')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                  <Button size="sm" variant="outline" className="flex-1 rounded-xl text-[11px] h-8" onClick={() => setExpandedRow(expandedRow === payroll.id ? null : payroll.id)}>
                    {expandedRow === payroll.id ? <><ChevronUp className="size-3 mr-1"/>Desglose</> : <><ChevronDown className="size-3 mr-1"/>Desglose</>}
                  </Button>
                  {payroll.status === 'PENDING' && (
                    <>
                      {String(payroll.paymentStatus || 'PENDING') === 'PENDING' && canPerform('HR_PAYROLL', 'approve') && (
                        <Button size="sm" onClick={() => handleRequestPayment(payroll.id)} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-[11px] h-8">
                          <Send className="size-3 mr-1" /> Solicitar pago
                        </Button>
                      )}
                      {String(payroll.paymentStatus || 'PENDING') !== 'PENDING' && <span className="flex flex-1 items-center justify-center text-[10px] font-black uppercase text-amber-600">Solicitud {String(payroll.paymentStatus).toLowerCase()}</span>}
                      {canPerform('HR_PAYROLL', 'edit') && (
                        <Button size="sm" variant="outline" onClick={() => handleOpenEditPayroll(payroll)} className="px-3 text-primary border-primary/30 hover:bg-primary/10 rounded-xl h-8" title="Editar nómina">
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                      {canPerform('HR_PAYROLL', 'delete') && (
                        <Button size="sm" variant="outline" onClick={() => setPendingDeleteId(payroll.id)} className="px-3 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 rounded-xl h-8">
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
                
                {expandedRow === payroll.id && (
                  <div className="mt-4 pt-4 border-t border-border/50 grid gap-x-4 gap-y-3 grid-cols-2 text-[10px]">
                    <div className="space-y-1.5">
                      <p className="font-black uppercase tracking-widest text-red-500 text-[9px]">Deducciones</p>
                      <div className="flex justify-between"><span className="text-muted-foreground mr-1">INSS L.</span><span className="font-bold text-red-600 text-right">-{payrollDisplay(payroll, 'inssLaboral', 'inssLaboralBase')}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground mr-1">IR</span><span className="font-bold text-red-600 text-right">-{payrollDisplay(payroll, 'ir', 'irBase')}</span></div>
                      {Number(payroll.deductions || 0) > 0 && <div className="flex justify-between"><span className="text-muted-foreground mr-1">Otras</span><span className="font-bold text-red-600 text-right">-{payrollDisplay(payroll, 'deductions', 'deductionsBase')}</span></div>}
                    </div>
                    <div className="space-y-1.5">
                      <p className="font-black uppercase tracking-widest text-green-600 text-[9px]">Ingresos</p>
                      <div className="flex justify-between"><span className="text-muted-foreground mr-1">Bonos</span><span className="font-bold text-green-600 text-right">+{payrollDisplay(payroll, 'bonuses', 'bonusesBase')}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground mr-1">H. Extra</span><span className="font-bold text-green-600 text-right">+{payrollDisplay(payroll, 'overtime', 'overtimeBase')}</span></div>
                      {Number(payroll.commissionsSales || 0) > 0 && (
                        <div className="flex justify-between"><span className="text-muted-foreground mr-1">Cmsns.</span><span className="font-bold text-emerald-600 text-right">+{payrollDisplay(payroll, 'commissionsSales', 'commissionsSalesBase')}</span></div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <p className="font-black uppercase tracking-widest text-orange-500 text-[9px]">Aportes</p>
                      <div className="flex justify-between"><span className="text-muted-foreground mr-1">INSS P.</span><span className="font-bold text-right">+{payrollDisplay(payroll, 'inssPatronal', 'inssPatronalBase')}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground mr-1">INATEC</span><span className="font-bold text-right">+{payrollDisplay(payroll, 'inatec', 'inatecBase')}</span></div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="font-black uppercase tracking-widest text-blue-500 text-[9px]">Provisiones</p>
                      <div className="flex justify-between"><span className="text-muted-foreground mr-1">Vacac.</span><span className="font-bold text-blue-600 text-right">+{payrollDisplay(payroll, 'vacacionesProv', 'vacacionesProvBase')}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground mr-1">Treaceavo</span><span className="font-bold text-blue-600 text-right">+{payrollDisplay(payroll, 'trecenoMes', 'trecenoMesBase')}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground mr-1">Indem.</span><span className="font-bold text-blue-600 text-right">+{payrollDisplay(payroll, 'indemnizacion', 'indemnizacionBase')}</span></div>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPayroll(null)} disabled={payrollSaveLoading}>Cancelar</Button>
            <Button onClick={handleSavePayroll} disabled={payrollSaveLoading}>{payrollSaveLoading ? 'Guardando…' : 'Guardar cambios'}</Button>
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
