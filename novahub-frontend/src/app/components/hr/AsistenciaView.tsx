import React, { useState } from 'react';
import { Clock, LogIn, LogOut, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { cn } from '../ui/utils';
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

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE_OPTIONS = [10, 15, 25, 30, 35, 40, 45, 50];

  React.useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  const totalPages = Math.ceil(attendance.length / pageSize);
  const paginatedAttendance = attendance.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden relative group">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl shadow-inner bg-blue-500/10 text-blue-500">
                <Clock className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Presentes Hoy</p>
                <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">{presentToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden relative group">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl shadow-inner bg-emerald-500/10 text-emerald-500">
                <Calendar className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Horas Totales Hoy</p>
                <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">{totalHoursToday.toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden relative group">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl shadow-inner bg-rose-500/10 text-rose-500">
                <Clock className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Ausentes Hoy</p>
                <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">{absentToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clock In/Out Panel */}
      <div className="border border-primary/40 rounded-lg p-6 bg-primary/5">
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
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={handleClockIn} className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-primary-foreground">
              <LogIn className="size-4 mr-2" />
              Entrada
            </Button>
            <Button onClick={handleClockOut} variant="outline" className="flex-1 sm:flex-none border-primary/50 text-foreground hover:bg-primary/10 hover:text-primary">
              <LogOut className="size-4 mr-2 text-red-500" />
              Salida
            </Button>
          </div>
        </div>
      </div>

      {/* Attendance Records */}
      <div className="border rounded-lg overflow-hidden flex flex-col">
        <div className="bg-muted/50 px-4 py-3 border-b">
          <h3 className="font-semibold">Registros de Asistencia</h3>
        </div>
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full min-w-[900px]">
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
              {paginatedAttendance.map((record: any) => (
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
                  <span className="font-semibold">{new Date(record.date).toLocaleDateString()}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="bg-primary/5 p-2 rounded-lg border border-primary/10">
                    <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">Entrada</p>
                    <p className="font-bold text-sm">{record.checkIn ? new Date(record.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
                  </div>
                  <div className="bg-primary/5 p-2 rounded-lg border border-primary/10">
                    <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">Salida</p>
                    <p className="font-bold text-sm">{record.checkOut ? new Date(record.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</p>
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
              <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="h-8 rounded-lg border bg-background px-2 font-bold text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer">
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
    </div>
  );
}

