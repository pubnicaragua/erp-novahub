import React, { useState } from 'react';
import { DollarSign, Download, Calculator, CheckCircle, Building2, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { hrService } from '../../services/hr.service';
import { Combobox } from '../ui/Combobox';
import { useCurrency } from '../../contexts/CurrencyContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertTriangle } from 'lucide-react';

export function NominasView({ payrolls, employees, onRefresh }: any) {
  const { convertAmount, formatConvertedAmount, displayCurrency } = useCurrency();
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
    } catch (error) {
      toast.error('Error al actualizar estado');
    }
  };

  const handleDeletePayroll = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta nómina? Los datos no se podrán recuperar y las comisiones volverán a estado pendiente.')) return;
    try {
      await hrService.deletePayroll(id);
      toast.success('Nómina eliminada exitosamente');
      onRefresh();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al eliminar nómina');
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
    } catch (error) {
      toast.error('Error al actualizar estados');
    }
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF() as any;
      doc.text("Reporte de Nominas", 14, 15);
      doc.setFontSize(10);
      doc.text(`Generado: ${new Date().toLocaleDateString()}`, 14, 22);

      const tableData = filteredPayrolls.map((p: any) => {
        const currency = p.employee?.currency || p.currency || 'USD';
        return [
          `${p.employee?.firstName} ${p.employee?.lastName}`,
          `${new Date(p.periodStart).toLocaleDateString()} - ${new Date(p.periodEnd).toLocaleDateString()}`,
          formatConvertedAmount(p.grossPay, currency),
          formatConvertedAmount(p.netPay, currency),
          formatConvertedAmount(p.costoTotalEmpresa || p.grossPay, currency),
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
    } catch (e) {
      toast.error('Error generando PDF');
    }
  };

  const totalGross = filteredPayrolls.reduce((sum: number, p: any) => sum + convertAmount(Number(p.grossPay || 0), p.employee?.currency || p.currency), 0);
  const totalNet = filteredPayrolls.reduce((sum: number, p: any) => sum + convertAmount(Number(p.netPay || 0), p.employee?.currency || p.currency), 0);
  const totalTaxes = filteredPayrolls.reduce((sum: number, p: any) => sum + convertAmount(Number(p.taxes || 0), p.employee?.currency || p.currency), 0);
  const totalCostoEmpresa = filteredPayrolls.reduce((sum: number, p: any) => sum + convertAmount(Number(p.costoTotalEmpresa || 0), p.employee?.currency || p.currency), 0);
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
              <h3 className="text-2xl font-black text-orange-600 dark:text-orange-400">{formatConvertedAmount(totalCostoEmpresa, displayCurrency)}</h3>
            </div>
            <Building2 className="size-8 text-orange-500/40" />
          </div>
        </div>
        <div className="border border-blue-500/20 rounded-xl p-4 bg-gradient-to-br from-blue-500/5 to-blue-500/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Neto (Recibido)</p>
              <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400">{formatConvertedAmount(totalNet, displayCurrency)}</h3>
            </div>
            <DollarSign className="size-8 text-blue-500/40" />
          </div>
        </div>
        <div className="border border-primary/20 rounded-xl p-4 bg-gradient-to-br from-primary/5 to-primary/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Impuestos Empresa</p>
              <h3 className="text-2xl font-black text-primary">{formatConvertedAmount(totalCostoEmpresa - totalGross, displayCurrency)}</h3>
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="size-4 mr-2" />
            Descargar PDF
          </Button>
          {pendingCount > 0 && (
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
          <Button size="sm" onClick={handleProcessPayroll} className="bg-primary hover:bg-primary/90 !text-primary-foreground">
            <Calculator className="size-4 mr-2" />
            Procesar Nómina
          </Button>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
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
              {filteredPayrolls.map((payroll: any) => {
                const currency = payroll.employee?.currency || 'USD';
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
                      {formatConvertedAmount(payroll.grossPay, currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-primary">
                      {formatConvertedAmount(payroll.netPay, currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-orange-600 dark:text-orange-400">
                      {formatConvertedAmount(payroll.costoTotalEmpresa || payroll.grossPay, currency)}
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
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); handleMarkAsPaid(payroll.id); }}
                              className="h-7 px-3 text-xs text-primary hover:text-primary hover:bg-primary/10 font-semibold"
                            >
                              <CheckCircle className="size-3.5 mr-1" />
                              Pagar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => { e.stopPropagation(); handleDeletePayroll(payroll.id); }}
                              className="h-7 px-3 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 font-semibold"
                            >
                              <Trash2 className="size-3.5 mr-1" />
                              Eliminar
                            </Button>
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
                              <div className="flex justify-between"><span className="text-muted-foreground">INSS Laboral ({payroll.snapshotInssLaboralPct || '—'}%)</span><span className="font-bold">-{formatConvertedAmount(payroll.inssLaboral || 0, currency)}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">IR ({payroll.snapshotIrPct || '—'}%)</span><span className="font-bold">-{formatConvertedAmount(payroll.ir || 0, currency)}</span></div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="font-black uppercase tracking-widest text-orange-500 text-[10px]">Aportes Patronales</p>
                            <div className="space-y-1">
                              <div className="flex justify-between"><span className="text-muted-foreground">INSS Patronal ({payroll.snapshotInssPatronalPct || '—'}%)</span><span className="font-bold">+{formatConvertedAmount(payroll.inssPatronal || 0, currency)}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">INATEC ({payroll.snapshotInatecPct || '—'}%)</span><span className="font-bold">+{formatConvertedAmount(payroll.inatec || 0, currency)}</span></div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="font-black uppercase tracking-widest text-blue-500 text-[10px]">Provisiones</p>
                            <div className="space-y-1">
                              <div className="flex justify-between"><span className="text-muted-foreground">Treceavo Mes ({payroll.snapshotTrecenoMesPct || '—'}%)</span><span className="font-bold">+{formatConvertedAmount(payroll.trecenoMes || 0, currency)}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Vacaciones ({payroll.snapshotVacacionesPct || '—'}%)</span><span className="font-bold">+{formatConvertedAmount(payroll.vacacionesProv || 0, currency)}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">Indemnización ({payroll.snapshotIndemnizacionPct || '—'}%)</span><span className="font-bold">+{formatConvertedAmount(payroll.indemnizacion || 0, currency)}</span></div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="font-black uppercase tracking-widest text-muted-foreground text-[10px]">Desglose</p>
                            <div className="space-y-1">
                              <div className="flex justify-between"><span className="text-muted-foreground">Bonos</span><span className="font-bold text-green-600">+{formatConvertedAmount(payroll.bonuses || 0, currency)}</span></div>
                              <div className="flex justify-between"><span className="text-muted-foreground">H. Extra</span><span className="font-bold text-blue-600">+{formatConvertedAmount(payroll.overtime || 0, currency)}</span></div>
                              {Number(payroll.commissionsSales || 0) > 0 && (
                                <div className="flex justify-between"><span className="text-muted-foreground">Comisiones por Ventas</span><span className="font-bold text-emerald-600">+{formatConvertedAmount(payroll.commissionsSales, currency)}</span></div>
                              )}
                              <div className="flex justify-between"><span className="text-muted-foreground">Otras Deducc.</span><span className="font-bold text-red-600">-{formatConvertedAmount(payroll.deductions || 0, currency)}</span></div>
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
      </div>

      {filteredPayrolls.length === 0 && (
        <div className="text-center py-12">
          <DollarSign className="size-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No se encontraron registros de nómina</p>
        </div>
      )}
    </div>
  );
}
