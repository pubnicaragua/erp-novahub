import React, { useState } from 'react';
import { Plus, Search, Filter, Grid, List, Edit2, Trash2, Save, X, Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { hrService } from '../../services/hr.service';

export function EmpleadosView({ employees, departments, positions, onRefresh }: any) {
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [newRows, setNewRows] = useState<any[]>([]);

  const filteredEmployees = employees.filter((emp: any) => {
    const matchesSearch = emp.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = filterDept === 'all' || emp.departmentId === filterDept;
    const matchesStatus = filterStatus === 'all' || emp.employmentStatus === filterStatus;
    return matchesSearch && matchesDept && matchesStatus;
  });

  const handleEdit = (emp: any) => {
    setEditingId(emp.id);
    setEditData({ ...emp });
  };

  const handleSave = async (id: string) => {
    try {
      await hrService.updateEmployee(id, editData);
      toast.success('Empleado actualizado');
      setEditingId(null);
      onRefresh();
    } catch (error) {
      toast.error('Error al actualizar empleado');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este empleado?')) return;
    try {
      await hrService.deleteEmployee(id);
      toast.success('Empleado eliminado');
      onRefresh();
    } catch (error) {
      toast.error('Error al eliminar empleado');
    }
  };

  const handleAddRow = () => {
    const newRow = {
      tempId: `new-${Date.now()}`,
      employeeNumber: `EMP${String(employees.length + newRows.length + 1).padStart(4, '0')}`,
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      hireDate: new Date().toISOString().split('T')[0],
      departmentId: departments[0]?.id || '',
      positionId: positions[0]?.id || '',
      contractType: 'FULL_TIME',
      salary: 0,
      employmentStatus: 'ACTIVE',
    };
    setNewRows([...newRows, newRow]);
  };

  const handleSaveNewRow = async (tempId: string) => {
    const row = newRows.find(r => r.tempId === tempId);
    if (!row) return;

    if (!row.firstName || !row.lastName || !row.email) {
      toast.error('Completa los campos requeridos');
      return;
    }

    try {
      await hrService.createEmployee(row);
      toast.success('Empleado creado');
      setNewRows(newRows.filter(r => r.tempId !== tempId));
      onRefresh();
    } catch (error) {
      toast.error('Error al crear empleado');
    }
  };

  const handleDeleteNewRow = (tempId: string) => {
    setNewRows(newRows.filter(r => r.tempId !== tempId));
  };

  const updateNewRow = (tempId: string, field: string, value: any) => {
    setNewRows(newRows.map(r => r.tempId === tempId ? { ...r, [field]: value } : r));
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar empleados..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="w-[180px]">
              <Filter className="size-4 mr-2" />
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {departments.map((dept: any) => (
                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ACTIVE">Activos</SelectItem>
              <SelectItem value="INACTIVE">Inactivos</SelectItem>
              <SelectItem value="ON_LEAVE">En ausencia</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}>
            {viewMode === 'table' ? <Grid className="size-4" /> : <List className="size-4" />}
          </Button>
          <Button size="sm" onClick={handleAddRow} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="size-4 mr-2" />
            Agregar Empleado
          </Button>
        </div>
      </div>

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Número</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Departamento</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Puesto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Salario</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {/* New Rows */}
                {newRows.map((row) => (
                  <tr key={row.tempId} className="bg-blue-50/50 hover:bg-blue-50">
                    <td className="px-4 py-2">
                      <Input
                        value={row.employeeNumber}
                        onChange={(e) => updateNewRow(row.tempId, 'employeeNumber', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        <Input
                          placeholder="Nombre"
                          value={row.firstName}
                          onChange={(e) => updateNewRow(row.tempId, 'firstName', e.target.value)}
                          className="h-8 text-sm"
                        />
                        <Input
                          placeholder="Apellido"
                          value={row.lastName}
                          onChange={(e) => updateNewRow(row.tempId, 'lastName', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        value={row.email}
                        onChange={(e) => updateNewRow(row.tempId, 'email', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Select value={row.departmentId} onValueChange={(v) => updateNewRow(row.tempId, 'departmentId', v)}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((dept: any) => (
                            <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2">
                      <Select value={row.positionId} onValueChange={(v) => updateNewRow(row.tempId, 'positionId', v)}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {positions.map((pos: any) => (
                            <SelectItem key={pos.id} value={pos.id}>{pos.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        value={row.salary}
                        onChange={(e) => updateNewRow(row.tempId, 'salary', parseFloat(e.target.value))}
                        className="h-8 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Nuevo</span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleSaveNewRow(row.tempId)} className="h-7 px-2">
                          <Save className="size-3" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteNewRow(row.tempId)} className="h-7 px-2">
                          <X className="size-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Existing Employees */}
                {filteredEmployees.map((emp: any) => (
                  <tr key={emp.id} className="hover:bg-muted/50">
                    <td className="px-4 py-2 text-sm">{emp.employeeNumber}</td>
                    <td className="px-4 py-2">
                      {editingId === emp.id ? (
                        <div className="flex gap-1">
                          <Input
                            value={editData.firstName}
                            onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                            className="h-8 text-sm"
                          />
                          <Input
                            value={editData.lastName}
                            onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                            className="h-8 text-sm"
                          />
                        </div>
                      ) : (
                        <span className="text-sm font-medium">{emp.firstName} {emp.lastName}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {editingId === emp.id ? (
                        <Input
                          value={editData.email}
                          onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                          className="h-8 text-sm"
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">{emp.email}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm">{emp.department?.name}</td>
                    <td className="px-4 py-2 text-sm">{emp.position?.title}</td>
                    <td className="px-4 py-2">
                      {editingId === emp.id ? (
                        <Input
                          type="number"
                          value={editData.salary}
                          onChange={(e) => setEditData({ ...editData, salary: parseFloat(e.target.value) })}
                          className="h-8 text-sm w-24"
                        />
                      ) : (
                        <span className="text-sm font-medium">${emp.salary?.toLocaleString()}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        emp.employmentStatus === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                        emp.employmentStatus === 'INACTIVE' ? 'bg-gray-100 text-gray-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {emp.employmentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {editingId === emp.id ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleSave(emp.id)} className="h-7 px-2">
                              <Save className="size-3" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-7 px-2">
                              <X className="size-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleEdit(emp)} className="h-7 px-2">
                              <Edit2 className="size-3" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(emp.id)} className="h-7 px-2 text-red-600">
                              <Trash2 className="size-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cards View */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredEmployees.map((emp: any) => (
            <div key={emp.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                    {emp.firstName[0]}{emp.lastName[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{emp.firstName} {emp.lastName}</h3>
                    <p className="text-xs text-muted-foreground">{emp.employeeNumber}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  emp.employmentStatus === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {emp.employmentStatus}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium truncate ml-2">{emp.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Departamento:</span>
                  <span className="font-medium">{emp.department?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Puesto:</span>
                  <span className="font-medium">{emp.position?.title}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Salario:</span>
                  <span className="font-bold text-indigo-600">${emp.salary?.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                <Button size="sm" variant="outline" onClick={() => handleEdit(emp)} className="flex-1">
                  <Edit2 className="size-3 mr-1" />
                  Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDelete(emp.id)} className="text-red-600">
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredEmployees.length === 0 && newRows.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No se encontraron empleados</p>
        </div>
      )}
    </div>
  );
}
