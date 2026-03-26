import React, { useState } from 'react';
import { Clock, LogIn, LogOut, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { hrService } from '../../services/hr.service';
import { Combobox } from '../ui/Combobox';

export function AsistenciaView({ attendance, employees, onRefresh }: any) {
  const [selectedEmployee, setSelectedEmployee] = useState('');

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

  const todayRecords = attendance.filter((a: any) => {
    const recordDate = new Date(a.date);
    const today = new Date();
    return recordDate.toDateString() === today.toDateString();
  });

  const totalHoursToday = todayRecords.reduce((sum: number, a: any) => sum + Number(a.hoursWorked || 0), 0);
  const presentToday = todayRecords.filter((a: any) => a.status === 'PRESENT').length;
  const absentToday = todayRecords.filter((a: any) => a.status === 'ABSENT').length;

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-muted-foreground">Presentes Hoy</p>
              <h3 className="text-3xl font-bold text-blue-700 dark:text-blue-400">{presentToday}</h3>
            </div>
            <Clock className="size-8 text-blue-500" />
          </div>
        </div>
        <div className="border rounded-lg p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-muted-foreground">Horas Totales Hoy</p>
              <h3 className="text-3xl font-bold text-green-700 dark:text-green-400">{totalHoursToday.toFixed(1)}</h3>
            </div>
            <Calendar className="size-8 text-green-500" />
          </div>
        </div>
        <div className="border rounded-lg p-4 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-muted-foreground">Ausentes Hoy</p>
              <h3 className="text-3xl font-bold text-red-700 dark:text-red-400">{absentToday}</h3>
            </div>
            <Clock className="size-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Clock In/Out Panel */}
      <div className="border rounded-lg p-6 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
        <h3 className="text-lg font-semibold mb-4">Registrar Asistencia</h3>
        <div className="flex items-center gap-3">
          <div className="flex-1">
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
            />
          </div>
          <Button onClick={handleClockIn} className="bg-green-600 hover:bg-green-700 text-white">
            <LogIn className="size-4 mr-2" />
            Entrada
          </Button>
          <Button onClick={handleClockOut} className="bg-red-600 hover:bg-red-700 text-white">
            <LogOut className="size-4 mr-2" />
            Salida
          </Button>
        </div>
      </div>

      {/* Attendance Records */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-muted/50 px-4 py-3 border-b">
          <h3 className="font-semibold">Registros de Asistencia</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold">Fecha</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Empleado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Entrada</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Salida</th>
                <th className="px-4 py-3 text-right text-xs font-semibold">Horas</th>
                <th className="px-4 py-3 text-right text-xs font-semibold">H. Extra</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Ubicación</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {attendance.slice(0, 50).map((record: any) => (
                <tr key={record.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm">
                    {new Date(record.date).toLocaleDateString()}
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
                    {record.checkIn ? new Date(record.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {record.checkOut ? new Date(record.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-'}
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
      </div>

      {attendance.length === 0 && (
        <div className="text-center py-12">
          <Clock className="size-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No hay registros de asistencia</p>
        </div>
      )}
    </div>
  );
}
