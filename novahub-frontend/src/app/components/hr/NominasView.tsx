import React from 'react';
import { useState } from 'react';
import { DollarSign, Download, Calculator, CheckCircle, Building2, ChevronDown, ChevronUp, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CircleHelp } from 'lucide-react';
import { Button } from '../ui/button';
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
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';
import { getPdfDesignSettings, pdfDesignPaper } from '../../utils/pdfGenerator';

export function NominasView({ payrolls, employees, onRefresh }: any) {
  const { displayCurrency, valuationMode, valuationModeLabel, valuationModeSuffix, formatCurrentAmount, convertAmount, convertCurrentAmount } = useCurrency();
  const { canPerform } = useAuth();
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [includeCommissions, setIncludeCommissions] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);

const NOMINAS_TOUR_STEPS: GuidedTourStep[] = [
  {
    target: '[data-tour="nominas-employee-filter"]',
    title: 'Filtrar por Empleado',
    description: 'Selecciona un empleado específico para ver solo sus nóminas, o mantén "Todos" para ver todas.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="nominas-process"]',
    title: 'Procesar Nómina',
    description: 'Calcula y genera las nóminas del período actual. Puedes incluir comisiones y procesar para un empleado específico o todos.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="nominas-table"]',
    title: 'Listado de Nóminas',
    description: 'Tabla con todas las nóminas generadas. Cada fila muestra el empleado, período, montos y estado. Expande una fila para ver el desglose detallado de deducciones, aportes y provisiones.',
    placement: 'top',
  },
];

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

  React.useEffect(() => {
    setCurrentPage(1);
  }, [filterEmployee, filterStatus, includeCommissions, pageSize]);

  const totalPages = Math.ceil(filteredPayrolls.length / pageSize);
  const paginatedPayrolls = filteredPayrolls.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const handleMarkAsPaid = async (id: string) => {
    try {
      await hrService.updatePayrollStatus(id, 'PAID');
      toast.success('Nómina marcada como pagada');
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

  const handleMarkAllAsPaid = async () => {
    const pendingPayrolls = filteredPayrolls.filter((p: any) => p.status === 'PENDING');
    if (pendingPayrolls.length === 0) {
      toast.info('No hay nóminas pendientes');
      return;
    }
    try {
      await Promise.all(
        pendingPayrolls.map((p: any) => hrService.updatePayrollStatus(p.id, 'PAID'))
      );
      toast.success(`${pendingPayrolls.length} nóminas marcadas como pagadas`);
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
    } catch (e: any) {
      toast.error('Error generando PDF');
    }
  };

  const totalGross = filteredPayrolls.reduce((sum: number, p: any) => sum + payrollBase(p, 'grossPay', 'grossPayBase'), 0);
  const totalNet = filteredPayrolls.reduce((sum: number, p: any) => sum + payrollBase(p, 'netPay', 'netPayBase'), 0);
  const totalCostoEmpresa = filteredPayrolls.reduce((sum: number, p: any) => sum + payrollBase(p, 'costoTotalEmpresa', 'costoTotalEmpresaBase'), 0);
  const pendingCount = filteredPayrolls.filter((p: any) => p.status === 'PENDING').length;
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border border-orange-500/20 rounded-xl p-4 bg-gradient-to-br from-orange-500/5 to-orange-500/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Bruto (Costo Empresa)</p>
              <h3 className="text-2xl font-black text-orange-600 dark:text-orange-400">{formatCurrentAmount(totalCostoEmpresa, displayCurrency)}</h3>{valuationModeSuffix && <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{valuationModeLabel}</span>}
            </div>
            <Building2 className="size-8 text-orange-500/40" />
          </div>
        </div>
        <div className="border border-blue-500/20 rounded-xl p-4 bg-gradient-to-br from-blue-500/5 to-blue-500/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Neto (Recibido)</p>
              <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400">{formatCurrentAmount(totalNet, displayCurrency)}</h3>
            </div>
            <DollarSign className="size-8 text-blue-500/40" />
          </div>
        </div>
        <div className="border border-primary/20 rounded-xl p-4 bg-gradient-to-br from-primary/5 to-primary/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Impuestos Empresa</p>
              <h3 className="text-2xl font-black text-primary">{formatCurrentAmount(totalCostoEmpresa - totalGross, displayCurrency)}</h3>
            </div>
            <DollarSign className="size-8 text-primary/40" />
          </div>
        </div>
        <div className={`border rounded-xl p-4 transition-colors ${overdueCount > 0 ? 'border-red-500/40 bg-gradient-to-br from-red-500/10 to-red-500/5' : 'border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-amber-500/10'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${overdueCount > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>Pendientes {overdueCount > 0 && '(Vencidas)'}</p>
              <h3 className={`text-3xl font-black ${overdueCount > 0 ? 'text-red-600' : 'text-amber-700 dark:text-amber-400'}`}>{pendingCount}</h3>
            </div>
            <CheckCircle className={`size-8 ${overdueCount > 0 ? 'text-red-500/40' : 'text-amber-500/40'}`} />
          </div>
        </div>
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
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="size-4 mr-2" />
            Descargar PDF
          </Button>
          {pendingCount > 0 && canPerform('HR_PAYROLLS', 'edit') && (
            <Button size="sm" onClick={handleMarkAllAsPaid} className="bg-primary hover:bg-primary/90 !text-primary-foreground">
              <CheckCircle className="size-4 mr-2" />
              Pagar Todas ({pendingCount})
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
          {canPerform('HR_PAYROLLS', 'create') && (
            <Button size="sm" onClick={handleProcessPayroll} className="bg-primary hover:bg-primary/90 !text-primary-foreground" data-tour="nominas-process">
              <Calculator className="size-4 mr-2" />
              Procesar Nómina
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => setShowTutorial(true)} aria-label="Tutorial">
            <CircleHelp className="size-3.5 mr-1" /> Tutorial
          </Button>
        </div>
      </div>

      {/* Payroll Table */}
      <div data-tour="nominas-table" className="border rounded-lg overflow-hidden flex flex-col">
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full min-w-[1100px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold">Empleado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Período</th>
                <th className="px-4 py-3 text-right text-xs font-semibold">Salario Bruto</th>
                <th className="px-4 py-3 text-right text-xs font-semibold">Neto a Pagar</th>
                <th className="px-4 py-3 text-right text-xs font-semibold">Costo Total Empresa</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Estado</th>
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
                      {new Date(payroll.periodStart).toLocaleDateString()} - {new Date(payroll.periodEnd).toLocaleDateString()}
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
                            {canPerform('HR_PAYROLLS', 'edit') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => { e.stopPropagation(); handleMarkAsPaid(payroll.id); }}
                                className="h-7 px-3 text-xs text-primary hover:text-primary hover:bg-primary/10 font-semibold"
                              >
                                <CheckCircle className="size-3.5 mr-1" />
                                Pagar
                              </Button>
                            )}
                            {canPerform('HR_PAYROLLS', 'delete') && (
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
                    <span className="font-semibold text-right">{new Date(payroll.periodStart).toLocaleDateString()} - {new Date(payroll.periodEnd).toLocaleDateString()}</span>
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
                      {canPerform('HR_PAYROLLS', 'edit') && (
                        <Button size="sm" onClick={() => handleMarkAsPaid(payroll.id)} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-[11px] h-8">
                          <CheckCircle className="size-3 mr-1" /> Pagar
                        </Button>
                      )}
                      {canPerform('HR_PAYROLLS', 'delete') && (
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
              Mostrando <span className="text-foreground font-black">{filteredPayrolls.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredPayrolls.length)}</span> de <span className="text-primary font-black">{filteredPayrolls.length}</span> registros totales
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
      {showTutorial && <GuidedTour steps={NOMINAS_TOUR_STEPS} onClose={() => setShowTutorial(false)} title="Nóminas" />}
    </div>
  );
}

