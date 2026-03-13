import React, { useState } from 'react';
import { DollarSign, Download, Calculator, Filter } from 'lucide-react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { hrService } from '../../services/hr.service';

export function NominasView({ payrolls, employees, onRefresh }: any) {
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

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

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 bg-gradient-to-br from-green-50 to-emerald-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Bruto</p>
              <h3 className="text-2xl font-bold text-green-700">${totalGross.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
            </div>
            <DollarSign className="size-8 text-green-500" />
          </div>
        </div>
        <div className="border rounded-lg p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Neto</p>
              <h3 className="text-2xl font-bold text-blue-700">${totalNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
            </div>
            <DollarSign className="size-8 text-blue-500" />
          </div>
        </div>
        <div className="border rounded-lg p-4 bg-gradient-to-br from-orange-50 to-red-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Impuestos</p>
              <h3 className="text-2xl font-bold text-orange-700">${totalTaxes.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
            </div>
            <DollarSign className="size-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="w-[200px]">
              <Filter className="size-4 mr-2" />
              <SelectValue placeholder="Empleado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los empleados</SelectItem>
              {employees.map((emp: any) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="PENDING">Pendiente</SelectItem>
              <SelectItem value="PAID">Pagado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-4 mr-2" />
            Exportar
          </Button>
          <Button size="sm" onClick={handleProcessPayroll} className="bg-green-600 hover:bg-green-700">
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
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredPayrolls.map((payroll: any) => (
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
                    ${Number(payroll.baseSalary).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-green-600">
                    +${Number(payroll.bonuses || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-blue-600">
                    +${Number(payroll.overtime || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-red-600">
                    -${Number(payroll.deductions || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-orange-600">
                    -${Number(payroll.taxes || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold">
                    ${Number(payroll.grossPay).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-green-700">
                    ${Number(payroll.netPay).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded ${
                      payroll.status === 'PAID' ? 'bg-green-100 text-green-700' :
                      payroll.status === 'PENDING' ? 'bg-orange-100 text-orange-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {payroll.status}
                    </span>
                  </td>
                </tr>
              ))}
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
