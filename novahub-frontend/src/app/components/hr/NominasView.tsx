import { useState } from 'react';
import { DollarSign, Download, Calculator, CheckCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { hrService } from '../../services/hr.service';
import { Combobox } from '../ui/Combobox';
import { useCurrency } from '../../contexts/CurrencyContext';

export function NominasView({ payrolls, employees, onRefresh }: any) {
  const { formatConvertedAmount } = useCurrency();
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

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

      await hrService.bulkProcessPayroll({
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      });
      toast.success('Nómina procesada exitosamente');
      onRefresh();
    } catch (error) {
      toast.error('Error al procesar nómina');
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

  const handleExport = () => {
    const csvContent = [
      ['Empleado', 'Período Inicio', 'Período Fin', 'Salario Base', 'Bonos', 'Deducciones', 'Pago Bruto', 'Pago Neto', 'Estado'].join(','),
      ...filteredPayrolls.map((p: any) => [
        `"${p.employee?.firstName} ${p.employee?.lastName}"`,
        new Date(p.periodStart).toLocaleDateString(),
        new Date(p.periodEnd).toLocaleDateString(),
        p.baseSalary,
        p.bonuses || 0,
        p.deductions || 0,
        p.grossPay,
        p.netPay,
        p.status,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `nominas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success('Archivo CSV descargado');
  };

  const totalGross = filteredPayrolls.reduce((sum: number, p: any) => sum + Number(p.grossPay || 0), 0);
  const totalNet = filteredPayrolls.reduce((sum: number, p: any) => sum + Number(p.netPay || 0), 0);
  const totalTaxes = filteredPayrolls.reduce((sum: number, p: any) => sum + Number(p.taxes || 0), 0);
  const pendingCount = filteredPayrolls.filter((p: any) => p.status === 'PENDING').length;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Bruto</p>
              <h3 className="text-2xl font-bold text-green-700 dark:text-green-400">{formatConvertedAmount(totalGross, 'USD')}</h3>
            </div>
            <DollarSign className="size-8 text-green-500" />
          </div>
        </div>
        <div className="border rounded-lg p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Neto</p>
              <h3 className="text-2xl font-bold text-blue-700 dark:text-blue-400">{formatConvertedAmount(totalNet, 'USD')}</h3>
            </div>
            <DollarSign className="size-8 text-blue-500" />
          </div>
        </div>
        <div className="border rounded-lg p-4 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Impuestos</p>
              <h3 className="text-2xl font-bold text-orange-700 dark:text-orange-400">{formatConvertedAmount(totalTaxes, 'USD')}</h3>
            </div>
            <DollarSign className="size-8 text-orange-500" />
          </div>
        </div>
        <div className="border rounded-lg p-4 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pendientes</p>
              <h3 className="text-3xl font-bold text-amber-700 dark:text-amber-400">{pendingCount}</h3>
            </div>
            <CheckCircle className="size-8 text-amber-500" />
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
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-4 mr-2" />
            Exportar
          </Button>
          {pendingCount > 0 && (
            <Button size="sm" onClick={handleMarkAllAsPaid} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle className="size-4 mr-2" />
              Pagar Todas ({pendingCount})
            </Button>
          )}
          <Button size="sm" onClick={handleProcessPayroll} className="bg-green-600 hover:bg-green-700 text-white">
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
                <th className="px-4 py-3 text-right text-xs font-semibold">Salario Base</th>
                <th className="px-4 py-3 text-right text-xs font-semibold">Bonos</th>
                <th className="px-4 py-3 text-right text-xs font-semibold">H. Extra</th>
                <th className="px-4 py-3 text-right text-xs font-semibold">Deducciones</th>
                <th className="px-4 py-3 text-right text-xs font-semibold">Impuestos</th>
                <th className="px-4 py-3 text-right text-xs font-semibold">Pago Bruto</th>
                <th className="px-4 py-3 text-right text-xs font-semibold">Pago Neto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredPayrolls.map((payroll: any) => {
                const currency = payroll.employee?.currency || 'USD';
                return (
                  <tr key={payroll.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">
                          {payroll.employee?.firstName} {payroll.employee?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {payroll.employee?.employeeNumber}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(payroll.periodStart).toLocaleDateString()} - {new Date(payroll.periodEnd).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium">
                      {formatConvertedAmount(payroll.baseSalary, currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-green-600">
                      +{formatConvertedAmount(payroll.bonuses || 0, currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-blue-600">
                      +{formatConvertedAmount(payroll.overtime || 0, currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-red-600">
                      -{formatConvertedAmount(payroll.deductions || 0, currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-orange-600">
                      -{formatConvertedAmount(payroll.taxes || 0, currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold">
                      {formatConvertedAmount(payroll.grossPay, currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-green-700">
                      {formatConvertedAmount(payroll.netPay, currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded ${
                        payroll.status === 'PAID' ? 'bg-green-100 text-green-700' :
                        payroll.status === 'PENDING' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {payroll.status === 'PAID' ? 'Pagado' : payroll.status === 'PENDING' ? 'Pendiente' : payroll.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {payroll.status === 'PENDING' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMarkAsPaid(payroll.id)}
                          className="h-7 px-3 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 font-semibold"
                        >
                          <CheckCircle className="size-3.5 mr-1" />
                          Pagar
                        </Button>
                      )}
                      {payroll.status === 'PAID' && payroll.paymentDate && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(payroll.paymentDate).toLocaleDateString()}
                        </span>
                      )}
                    </td>
                  </tr>
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
