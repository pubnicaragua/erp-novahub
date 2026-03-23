import React, { useState } from 'react';
import { FileText, Plus, Check, X } from 'lucide-react';
import { Button } from '../ui/button';
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
    startDate: '',
    endDate: '',
    days: 1,
    reason: '',
  });

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

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 bg-gradient-to-br from-orange-50 to-amber-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pendientes</p>
              <h3 className="text-3xl font-bold text-orange-700">{pendingRequests.length}</h3>
            </div>
            <FileText className="size-8 text-orange-500" />
          </div>
        </div>
        <div className="border rounded-lg p-4 bg-gradient-to-br from-green-50 to-emerald-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Aprobadas</p>
              <h3 className="text-3xl font-bold text-green-700">{approvedRequests.length}</h3>
            </div>
            <Check className="size-8 text-green-500" />
          </div>
        </div>
        <div className="border rounded-lg p-4 bg-gradient-to-br from-red-50 to-pink-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Rechazadas</p>
              <h3 className="text-3xl font-bold text-red-700">{rejectedRequests.length}</h3>
            </div>
            <X className="size-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* New Request Button */}
      <div className="flex justify-end">
        <Button onClick={() => setShowNewForm(!showNewForm)} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="size-4 mr-2" />
          Nueva Solicitud
        </Button>
      </div>

      {/* New Request Form */}
      {showNewForm && (
        <div className="border rounded-lg p-6 bg-gradient-to-br from-indigo-50 to-purple-50">
          <h3 className="text-lg font-semibold mb-4">Nueva Solicitud de Ausencia</h3>
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
                <SelectTrigger className="bg-white">
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
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Fecha Inicio</label>
              <Input
                type="date"
                value={newRequest.startDate}
                onChange={(e) => setNewRequest({ ...newRequest, startDate: e.target.value })}
                className="bg-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Fecha Fin</label>
              <Input
                type="date"
                value={newRequest.endDate}
                onChange={(e) => setNewRequest({ ...newRequest, endDate: e.target.value })}
                className="bg-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Días</label>
              <Input
                type="number"
                value={newRequest.days}
                onChange={(e) => setNewRequest({ ...newRequest, days: parseInt(e.target.value) })}
                className="bg-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Razón</label>
              <Input
                value={newRequest.reason}
                onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
                placeholder="Motivo de la ausencia"
                className="bg-white"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Button onClick={handleCreateRequest} className="bg-green-600 hover:bg-green-700">
              Crear Solicitud
            </Button>
            <Button variant="outline" onClick={() => setShowNewForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Leave Requests Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
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
              {leaveRequests.map((request: any) => (
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
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                      {request.leaveType === 'VACATION' ? 'Vacaciones' : request.leaveType === 'SICK' ? 'Enfermedad' : request.leaveType === 'PERSONAL' ? 'Personal' : request.leaveType === 'MATERNITY' ? 'Maternidad' : request.leaveType === 'PATERNITY' ? 'Paternidad' : request.leaveType === 'UNPAID' ? 'Sin Goce' : request.leaveType === 'BEREAVEMENT' ? 'Duelo' : request.leaveType}
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
      </div>

      {leaveRequests.length === 0 && (
        <div className="text-center py-12">
          <FileText className="size-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No hay solicitudes de ausencia</p>
        </div>
      )}
    </div>
  );
}
