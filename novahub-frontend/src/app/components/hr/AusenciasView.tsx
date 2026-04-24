import React, { useState, useEffect } from 'react';
import { FileText, Plus, Check, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { cn } from '../ui/utils';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { hrService } from '../../services/hr.service';
import { Combobox } from '../ui/Combobox';

export function AusenciasView({ leaveRequests, employees, onRefresh }: any) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [newRequest, setNewRequest] = useState({
    employeeId: '',
    leaveType: 'VACATION',
    leaveTypeCustom: '',
    startDate: '',
    endDate: '',
    days: 1,
    reason: '',
  });

  useEffect(() => {
    if (newRequest.startDate && newRequest.endDate) {
      const start = new Date(newRequest.startDate);
      const end = new Date(newRequest.endDate);
      if (start <= end) {
        let count = 0;
        let cur = new Date(start);
        while (cur <= end) {
          if (cur.getDay() !== 0) count++; // 0 is Sunday
          cur.setDate(cur.getDate() + 1);
        }
        setNewRequest(prev => ({ ...prev, days: count }));
      }
    }
  }, [newRequest.startDate, newRequest.endDate]);

  const handleCreateRequest = async () => {
    if (!newRequest.employeeId || !newRequest.startDate || !newRequest.endDate) {
      toast.error('Completa todos los campos requeridos');
      return;
    }

    try {
      await hrService.createLeaveRequest(newRequest);
      toast.success('Solicitud creada');
      setShowNewForm(false);
      setNewRequest({
        employeeId: '',
        leaveType: 'VACATION',
        leaveTypeCustom: '',
        startDate: '',
        endDate: '',
        days: 1,
        reason: '',
      });
      onRefresh();
    } catch (error) {
      toast.error('Error al crear solicitud');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await hrService.approveLeaveRequest(id, 'current-user-id');
      toast.success('Solicitud aprobada');
      onRefresh();
    } catch (error) {
      toast.error('Error al aprobar solicitud');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Razón del rechazo:');
    if (!reason) return;

    try {
      await hrService.rejectLeaveRequest(id, reason);
      toast.success('Solicitud rechazada');
      onRefresh();
    } catch (error) {
      toast.error('Error al rechazar solicitud');
    }
  };

  const pendingRequests = leaveRequests.filter((r: any) => r.status === 'PENDING');
  const approvedRequests = leaveRequests.filter((r: any) => r.status === 'APPROVED');
  const rejectedRequests = leaveRequests.filter((r: any) => r.status === 'REJECTED');

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE_OPTIONS = [10, 15, 25, 30, 35, 40, 45, 50];

  React.useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  const totalPages = Math.ceil(leaveRequests.length / pageSize);
  const paginatedRequests = leaveRequests.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden relative group">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl shadow-inner bg-amber-500/10 text-amber-500">
                <FileText className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Pendientes</p>
                <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">{pendingRequests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden relative group">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl shadow-inner bg-emerald-500/10 text-emerald-500">
                <Check className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Aprobadas</p>
                <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">{approvedRequests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden relative group">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl shadow-inner bg-rose-500/10 text-rose-500">
                <X className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Rechazadas</p>
                <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">{rejectedRequests.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Request Button */}
      <div className="flex justify-end">
        <Button onClick={() => setShowNewForm(!showNewForm)} className="bg-primary hover:bg-primary/90 !text-primary-foreground">
          <Plus className="size-4 mr-2" />
          Nueva Solicitud
        </Button>
      </div>

      {/* New Request Form */}
      {showNewForm && (
        <div className="border border-primary/40 rounded-lg p-6 bg-primary/5">
          <h3 className="text-lg font-semibold mb-4 text-primary">Nueva Solicitud de Ausencia</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Empleado</label>
              <Combobox
                options={employees.map((emp: any) => ({
                  label: `${emp.firstName} ${emp.lastName}`,
                  value: emp.id,
                  description: emp.employeeNumber,
                }))}
                value={newRequest.employeeId}
                onChange={(v) => setNewRequest({ ...newRequest, employeeId: v })}
                placeholder="Buscar empleado..."
                emptyMessage="No se encontró el empleado"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Tipo de Ausencia</label>
              <Select value={newRequest.leaveType} onValueChange={(v) => setNewRequest({ ...newRequest, leaveType: v })}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VACATION">Vacaciones</SelectItem>
                  <SelectItem value="SICK">Enfermedad</SelectItem>
                  <SelectItem value="PERSONAL">Personal</SelectItem>
                  <SelectItem value="MATERNITY">Maternidad</SelectItem>
                  <SelectItem value="PATERNITY">Paternidad</SelectItem>
                  <SelectItem value="UNPAID">Sin goce de sueldo</SelectItem>
                  <SelectItem value="BEREAVEMENT">Duelo</SelectItem>
                  <SelectItem value="OTHER">Otro</SelectItem>
                </SelectContent>
              </Select>
              {newRequest.leaveType === 'OTHER' && (
                <Input 
                  placeholder="Especifica el tipo de ausencia..."
                  value={newRequest.leaveTypeCustom}
                  onChange={e => setNewRequest({...newRequest, leaveTypeCustom: e.target.value})}
                  className="mt-2 bg-background"
                />
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Fecha Inicio</label>
              <Input
                type="date"
                value={newRequest.startDate}
                onChange={(e) => setNewRequest({ ...newRequest, startDate: e.target.value })}
                className="bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Fecha Fin</label>
              <Input
                type="date"
                value={newRequest.endDate}
                onChange={(e) => setNewRequest({ ...newRequest, endDate: e.target.value })}
                className="bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Días</label>
              <Input
                type="number"
                disabled
                value={newRequest.days}
                onChange={(e) => setNewRequest({ ...newRequest, days: parseInt(e.target.value) })}
                className="bg-background opacity-70"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Razón</label>
              <Input
                value={newRequest.reason}
                onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
                placeholder="Motivo de la ausencia"
                className="bg-background"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Button onClick={handleCreateRequest} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Crear Solicitud
            </Button>
            <Button variant="outline" onClick={() => setShowNewForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Leave Requests Table */}
      <div className="border rounded-lg overflow-hidden flex flex-col">
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full min-w-[900px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold">Empleado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Fecha Inicio</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Fecha Fin</th>
                <th className="px-4 py-3 text-center text-xs font-semibold">Días</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Razón</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginatedRequests.map((request: any) => (
                <tr key={request.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">
                        {request.employee?.firstName} {request.employee?.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {request.employee?.employeeNumber}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                      {request.leaveType === 'VACATION' ? 'Vacaciones' : request.leaveType === 'SICK' ? 'Enfermedad' : request.leaveType === 'PERSONAL' ? 'Personal' : request.leaveType === 'MATERNITY' ? 'Maternidad' : request.leaveType === 'PATERNITY' ? 'Paternidad' : request.leaveType === 'UNPAID' ? 'Sin Goce' : request.leaveType === 'BEREAVEMENT' ? 'Duelo' : request.leaveTypeCustom || 'Otro'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(request.startDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(request.endDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-medium">
                    {request.days}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {request.reason || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded ${
                      request.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                      request.status === 'PENDING' ? 'bg-orange-100 text-orange-700' :
                      request.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {request.status === 'APPROVED' ? 'Aprobada' : request.status === 'PENDING' ? 'Pendiente' : request.status === 'REJECTED' ? 'Rechazada' : request.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {request.status === 'PENDING' && (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleApprove(request.id)}
                          className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReject(request.id)}
                          className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="block md:hidden space-y-4 p-4 bg-muted/10">
          {paginatedRequests.map((request: any) => (
            <div key={request.id} className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-card to-background p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4 border-b border-primary/10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                    {request.employee?.firstName?.[0]}{request.employee?.lastName?.[0]}
                  </div>
                  <div>
                    <p className="font-bold text-sm tracking-tight">{request.employee?.firstName} {request.employee?.lastName}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{request.employee?.employeeNumber}</p>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded-lg font-bold shadow-sm ${
                  request.status === 'APPROVED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' :
                  request.status === 'REJECTED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30' :
                  'bg-orange-100 text-orange-700 dark:bg-orange-900/30'
                }`}>
                  {request.status === 'APPROVED' ? 'APROBADO' : request.status === 'REJECTED' ? 'RECHAZADO' : 'PENDIENTE'}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Tipo</span>
                  <span className="font-semibold">{request.type === 'VACATION' ? 'Vacaciones' : request.type === 'SICK' ? 'Enfermedad' : request.type === 'UNPAID' ? 'Sin Goce' : request.type}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="bg-primary/5 p-2 rounded-lg border border-primary/10">
                    <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">Inicio</p>
                    <p className="font-bold text-sm">{new Date(request.startDate).toLocaleDateString()}</p>
                  </div>
                  <div className="bg-primary/5 p-2 rounded-lg border border-primary/10">
                    <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">Fin</p>
                    <p className="font-bold text-sm">{new Date(request.endDate).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-border/50 pt-2">
                  <span className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Duración</span>
                  <span className="font-bold bg-muted/50 px-2 py-1 rounded-md">{request.daysCount} días</span>
                </div>
                {request.reason && (
                  <div className="text-xs border-t border-border/50 pt-2">
                    <span className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest block mb-1">Motivo</span>
                    <span className="font-medium text-muted-foreground bg-muted/30 p-2 rounded-lg block">{request.reason}</span>
                  </div>
                )}
              </div>

              {request.status === 'PENDING' && (
                <div className="flex items-center gap-2 pt-4 mt-2 border-t border-border/50">
                  <Button size="sm" onClick={() => handleApproveRequest(request.id)} className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl text-[11px] h-8">
                    <Check className="size-3 mr-1" /> Aprobar
                  </Button>
                  <Button size="sm" onClick={() => handleRejectRequest(request.id)} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[11px] h-8">
                    <X className="size-3 mr-1" /> Rechazar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pagination Controls */}
      {leaveRequests.length > 0 && (
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
              Mostrando <span className="text-foreground font-black">{leaveRequests.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, leaveRequests.length)}</span> de <span className="text-primary font-black">{leaveRequests.length}</span> registros totales
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

      {leaveRequests.length === 0 && (
        <div className="text-center py-12">
          <FileText className="size-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No hay solicitudes de ausencia</p>
        </div>
      )}
    </div>
  );
}

