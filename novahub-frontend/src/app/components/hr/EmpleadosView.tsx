import React, { useState } from 'react';
import { Plus, Search, Filter, Grid, List, Edit2, Trash2, Save, X, Upload, Building2, Briefcase, Phone, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, FileSpreadsheet } from 'lucide-react';
import { ImportDataModal } from './ImportDataModal';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { hrService } from '../../services/hr.service';
import { useCurrency } from '../../contexts/CurrencyContext';

export function EmpleadosView({ employees, departments, positions, onRefresh, hasPayrollConfig, onNavigateToConfig }: any) {
  const { displayCurrency, formatConvertedAmount } = useCurrency();
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [filterStatus, setFilterStatus] = useState('ACTIVE');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [newRows, setNewRows] = useState<any[]>([]);

  const [showNewDeptModal, setShowNewDeptModal] = useState(false);
  const [showNewPosModal, setShowNewPosModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newPosTitle, setNewPosTitle] = useState('');
  const [newPosDeptId, setNewPosDeptId] = useState('');

  const filteredEmployees = employees.filter((emp: any) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = !term ||
      emp.firstName?.toLowerCase().includes(term) ||
      emp.lastName?.toLowerCase().includes(term) ||
      emp.email?.toLowerCase().includes(term) ||
      emp.employeeNumber?.toLowerCase().includes(term) ||
      emp.phone?.toLowerCase().includes(term) ||
      emp.department?.name?.toLowerCase().includes(term) ||
      emp.position?.title?.toLowerCase().includes(term);
    const matchesDept = filterDept === 'all' || emp.departmentId === filterDept;
    const matchesStatus = filterStatus === 'all' || emp.employmentStatus === filterStatus;
    return matchesSearch && matchesDept && matchesStatus;
  });

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE_OPTIONS = [10, 15, 25, 30, 35, 40, 45, 50];

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterDept, filterStatus, pageSize]);

  const totalPages = Math.ceil(filteredEmployees.length / pageSize);
  const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleCreateDepartment = async () => {
    if (!newDeptName.trim()) { toast.error('Ingresa un nombre'); return; }
    try {
      const code = newDeptName.trim().replace(/\s+/g, '').substring(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 10000);
      await hrService.createDepartment({ name: newDeptName.trim(), code });
      toast.success('Departamento creado');
      setNewDeptName('');
      setShowNewDeptModal(false);
      onRefresh();
    } catch { toast.error('Error al crear departamento'); }
  };

  const handleCreatePosition = async () => {
    if (!newPosTitle.trim()) { toast.error('Ingresa un título'); return; }
    if (!newPosDeptId) { toast.error('Selecciona un departamento'); return; }
    try {
      const code = newPosTitle.trim().replace(/\s+/g, '').substring(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 10000);
      await hrService.createPosition({ title: newPosTitle.trim(), departmentId: newPosDeptId, code });
      toast.success('Puesto creado');
      setNewPosTitle('');
      setNewPosDeptId('');
      setShowNewPosModal(false);
      onRefresh();
    } catch { toast.error('Error al crear puesto'); }
  };

  const handleEdit = (emp: any) => {
    setEditingId(emp.id);
    setEditData({ ...emp });
    if (viewMode === 'cards') {
      setIsEditModalOpen(true);
    }
  };

  const handleCardEdit = (emp: any) => {
    setEditingId(emp.id);
    setEditData({ ...emp });
    setIsEditModalOpen(true);
  };

  const handleSave = async (id: string) => {
    // Validación básica de campos
    if (!editData.employeeNumber?.trim()) {
      toast.error('El número de empleado es obligatorio');
      return;
    }

    if (!editData.firstName?.trim() || !editData.lastName?.trim()) {
      toast.error('El nombre y apellido son obligatorios');
      return;
    }

    if (!editData.email?.trim()) {
      toast.error('El correo electrónico es obligatorio');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editData.email)) {
      toast.error('El formato del correo electrónico no es válido');
      return;
    }

    try {
      // Sanitizar datos antes de enviar
      const sanitizedData = {
        ...editData,
        employeeNumber: editData.employeeNumber.trim(),
        firstName: editData.firstName.trim(),
        lastName: editData.lastName.trim(),
        email: editData.email.trim(),
        phone: editData.phone?.trim() || null,
        salary: isNaN(editData.salary) ? 0 : Number(editData.salary),
        currency: editData.currency || 'NIO',
        payFrequency: editData.payFrequency || 'MONTHLY',
        departmentId: editData.departmentId,
        positionId: editData.positionId,
      };

      await hrService.updateEmployee(id, sanitizedData);
      toast.success('Empleado actualizado correctamente');
      setEditingId(null);
      onRefresh();
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Error al actualizar empleado';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleteLoading(true);
      await hrService.deleteEmployee(id);
      toast.success('Empleado eliminado');
      onRefresh();
    } catch (error) {
      toast.error('Error al eliminar empleado');
    } finally {
      setDeleteLoading(false);
      setPendingDeleteId(null);
    }
  };

  const handleAddRow = () => {
    const newRow = {
      tempId: `new-${Date.now()}`,
      employeeNumber: (() => {
        const existing = employees.map((e: any) => {
          const match = e.employeeNumber?.match(/\d+$/);
          return match ? parseInt(match[0], 10) : 0;
        });
        const pending = newRows.map((r: any) => {
          const match = r.employeeNumber?.match(/\d+$/);
          return match ? parseInt(match[0], 10) : 0;
        });
        const maxNum = Math.max(0, ...existing, ...pending);
        return `EMP${String(maxNum + 1).padStart(4, '0')}`;
      })(),
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      hireDate: new Date().toISOString().split('T')[0],
      departmentId: departments[0]?.id || '',
      positionId: positions[0]?.id || '',
      contractType: 'FULL_TIME',
      salary: 0,
      currency: 'NIO',
      payFrequency: 'MONTHLY',
      employmentStatus: 'ACTIVE',
    };
    setNewRows([...newRows, newRow]);
  };

  const handleSaveNewRow = async (tempId: string) => {
    const row = newRows.find(r => r.tempId === tempId);
    if (!row) return;

    // Validación básica de campos
    if (!row.employeeNumber?.trim()) {
      toast.error('El número de empleado es obligatorio');
      return;
    }

    if (!row.firstName?.trim() || !row.lastName?.trim()) {
      toast.error('El nombre y apellido son obligatorios');
      return;
    }

    if (!row.email?.trim()) {
      toast.error('El correo electrónico es obligatorio');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(row.email)) {
      toast.error('El formato del correo electrónico no es válido');
      return;
    }

    if (!row.departmentId || !row.positionId) {
      toast.error('Selecciona departamento y puesto');
      return;
    }

    try {
      // Limpiar datos y asegurar tipos correctos
      const employeeData = {
        employeeNumber: row.employeeNumber.trim(),
        firstName: row.firstName.trim(),
        lastName: row.lastName.trim(),
        email: row.email.trim(),
        phone: row.phone?.trim() || null,
        departmentId: row.departmentId,
        positionId: row.positionId,
        salary: isNaN(row.salary) ? 0 : Number(row.salary),
        currency: row.currency || 'NIO',
        payFrequency: row.payFrequency || 'MONTHLY',
        hireDate: row.hireDate || new Date().toISOString().split('T')[0],
        contractType: row.contractType || 'FULL_TIME',
      };

      await hrService.createEmployee(employeeData);
      toast.success('Empleado creado correctamente');
      setNewRows(newRows.filter(r => r.tempId !== tempId));
      onRefresh();
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Error al crear empleado';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
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
          <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)} className="border-primary/30 text-primary hover:bg-primary/10">
            <FileSpreadsheet className="size-4 mr-2" />
            Importar
          </Button>
          <Button size="sm" onClick={handleAddRow} className="bg-primary hover:bg-primary/90 !text-primary-foreground">
            <Plus className="size-4 mr-2" />
            Agregar Empleado
          </Button>
        </div>
      </div>

      {/* Table View - Desktop Only */}
      <div className={`border rounded-lg overflow-hidden ${viewMode === 'table' ? 'hidden md:block' : 'hidden'}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Número</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Teléfono</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Departamento</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Puesto</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Salario</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Frecuencia</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {/* New Rows */}
                {newRows.map((row) => (
                  <tr key={row.tempId} className="bg-blue-50/50 hover:bg-blue-50 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 transition-colors">
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
                      <Input
                        placeholder="Teléfono"
                        value={row.phone}
                        onChange={(e) => updateNewRow(row.tempId, 'phone', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <Select value={row.departmentId} onValueChange={(v) => {
                          const firstPos = positions.find((p: any) => p.departmentId === v);
                          updateNewRow(row.tempId, 'departmentId', v);
                          if (firstPos) updateNewRow(row.tempId, 'positionId', firstPos.id);
                        }}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((dept: any) => (
                              <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => setShowNewDeptModal(true)} title="Crear departamento">
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <Select value={row.positionId} onValueChange={(v) => updateNewRow(row.tempId, 'positionId', v)}>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {positions.filter((p: any) => p.departmentId === row.departmentId).map((pos: any) => (
                              <SelectItem key={pos.id} value={pos.id}>{pos.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => setShowNewPosModal(true)} title="Crear puesto">
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1 items-center">
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-1.5 text-xs text-muted-foreground font-medium">
                            {row.currency === 'USD' ? '$' : 'C$'}
                          </span>
                          <Input
                            type="number"
                            value={row.salary}
                            onChange={(e) => updateNewRow(row.tempId, 'salary', parseFloat(e.target.value))}
                            className="h-8 text-sm pl-7 min-w-[100px]"
                          />
                        </div>
                        <Select value={row.currency} onValueChange={(v) => updateNewRow(row.tempId, 'currency', v)}>
                          <SelectTrigger className="h-8 w-16 text-[10px] font-bold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="NIO">NIO</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <Select value={row.payFrequency} onValueChange={(v) => updateNewRow(row.tempId, 'payFrequency', v)}>
                        <SelectTrigger className="h-8 text-xs font-bold w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="WEEKLY">Semanal</SelectItem>
                          <SelectItem value="BIWEEKLY">Quincenal</SelectItem>
                          <SelectItem value="MONTHLY">Mensual</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-bold">Nuevo</span>
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
                {paginatedEmployees.map((emp: any) => (
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
                    <td className="px-4 py-2">
                      <span className="text-sm text-muted-foreground">{emp.phone || '—'}</span>
                    </td>
                    <td className="px-4 py-2 text-sm">{emp.department?.name}</td>
                    <td className="px-4 py-2 text-sm">{emp.position?.title}</td>
                    <td className="px-4 py-2">
                      {editingId === emp.id ? (
                        <div className="flex gap-1 items-center">
                          <div className="relative flex-1">
                            <span className="absolute left-2 top-1.5 text-[10px] text-muted-foreground font-bold">
                              {editData.currency === 'USD' ? '$' : 'C$'}
                            </span>
                            <Input
                              type="number"
                              value={editData.salary}
                              onChange={(e) => setEditData({ ...editData, salary: parseFloat(e.target.value) })}
                              className="h-8 text-sm pl-6 w-24"
                            />
                          </div>
                          <Select value={editData.currency} onValueChange={(v) => setEditData({ ...editData, currency: v })}>
                            <SelectTrigger className="h-8 w-16 text-[10px] font-bold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="NIO">NIO</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-primary">{formatConvertedAmount(emp.salary, emp.currency)}</span>
                          <span className="text-[9px] text-muted-foreground uppercase font-black">Original: {emp.currency}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {editingId === emp.id ? (
                        <Select value={editData.payFrequency} onValueChange={(v) => setEditData({ ...editData, payFrequency: v })}>
                          <SelectTrigger className="h-8 text-xs font-bold w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="WEEKLY">Semanal</SelectItem>
                            <SelectItem value="BIWEEKLY">Quincenal</SelectItem>
                            <SelectItem value="MONTHLY">Mensual</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs font-bold uppercase text-muted-foreground bg-muted px-2 py-1 rounded">
                          {emp.payFrequency === 'WEEKLY' ? 'Semanal' : emp.payFrequency === 'BIWEEKLY' ? 'Quincenal' : 'Mensual'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-[10px] px-2 py-1 rounded-lg font-black uppercase tracking-tighter ${
                        emp.employmentStatus === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        emp.employmentStatus === 'INACTIVE' ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' :
                        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      }`}>
                        {emp.employmentStatus === 'ACTIVE' ? 'Activo' : emp.employmentStatus === 'INACTIVE' ? 'Inactivo' : emp.employmentStatus === 'ON_LEAVE' ? 'Licencia' : emp.employmentStatus === 'TERMINATED' ? 'Terminado' : emp.employmentStatus}
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
                            <Button size="sm" variant="ghost" onClick={() => setPendingDeleteId(emp.id)} className="h-7 px-2 text-red-600">
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
      

      {/* Cards View - Always shown on mobile, conditional on desktop */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 ${viewMode === 'cards' ? 'block' : 'block md:hidden'}`}>
          {paginatedEmployees.map((emp: any) => (
            <div key={emp.id} className="border border-border/40 rounded-2xl p-5 bg-gradient-to-br from-card to-muted/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 relative overflow-hidden group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-lg">
                    {emp.firstName[0]}{emp.lastName[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{emp.firstName} {emp.lastName}</h3>
                    <p className="text-xs text-muted-foreground">{emp.employeeNumber}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  emp.employmentStatus === 'ACTIVE' 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                }`}>
                  {emp.employmentStatus === 'ACTIVE' ? 'Activo' : emp.employmentStatus === 'INACTIVE' ? 'Inactivo' : emp.employmentStatus}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium truncate ml-2">{emp.email}</span>
                </div>
                {emp.phone && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Teléfono:</span>
                  <span className="font-medium">{emp.phone}</span>
                </div>
                )}
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
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-primary">{formatConvertedAmount(emp.salary, emp.currency)}</span>
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">Contrato: {emp.currency}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/40 relative z-10">
                <Button size="sm" variant="outline" onClick={() => handleCardEdit(emp)} className="flex-1 rounded-xl transition-all hover:bg-primary/10 hover:text-primary hover:border-primary/30">
                  <Edit2 className="size-3 mr-1" />
                  Editar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPendingDeleteId(emp.id)} className="text-red-600 rounded-xl hover:bg-red-500/10 hover:border-red-500/30 transition-all">
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

      {/* Pagination Controls */}
      {filteredEmployees.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border/20">
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-medium">
            <div className="flex items-center gap-2">
              <span>Mostrar</span>
              <Select value={String(pageSize)} onValueChange={(val) => setPageSize(Number(val))}>
                <SelectTrigger className="h-8 w-[70px] rounded-lg border bg-background font-bold text-foreground focus:ring-2 focus:ring-primary/20 outline-none shadow-sm">
                  <SelectValue placeholder={String(pageSize)} />
                </SelectTrigger>
                <SelectContent className="rounded-lg border-border/50 shadow-xl min-w-[70px]">
                  {PAGE_SIZE_OPTIONS.map(opt => (
                    <SelectItem key={opt} value={String(opt)} className="font-bold">{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>por página</span>
            </div>
            <div className="h-4 w-px bg-border/40 hidden sm:block" />
            <p className="bg-primary/5 px-3 py-1 rounded-full border border-primary/10">
              Mostrando <span className="text-foreground font-black">{filteredEmployees.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredEmployees.length)}</span> de <span className="text-primary font-black">{filteredEmployees.length}</span> registros
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

      {filteredEmployees.length === 0 && newRows.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No se encontraron empleados</p>
        </div>
      )}

      {/* Modal: Crear Departamento */}
      <Dialog open={showNewDeptModal} onOpenChange={setShowNewDeptModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Building2 className="size-5 text-primary" /> Nuevo Departamento</DialogTitle>
            <DialogDescription>Crea un nuevo departamento para asignar empleados</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nombre del Departamento</Label>
              <Input value={newDeptName} onChange={e => setNewDeptName(e.target.value)} placeholder="Ej: Marketing, Contabilidad..." className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDeptModal(false)}>Cancelar</Button>
            <Button onClick={handleCreateDepartment} className="bg-primary text-primary-foreground">Crear Departamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Crear Puesto */}
      <Dialog open={showNewPosModal} onOpenChange={setShowNewPosModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Briefcase className="size-5 text-primary" /> Nuevo Puesto</DialogTitle>
            <DialogDescription>Crea un nuevo puesto de trabajo</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Título del Puesto</Label>
              <Input value={newPosTitle} onChange={e => setNewPosTitle(e.target.value)} placeholder="Ej: Gerente, Analista..." className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Departamento</Label>
              <Select value={newPosDeptId} onValueChange={setNewPosDeptId}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Seleccionar departamento" /></SelectTrigger>
                <SelectContent>
                  {departments.map((dept: any) => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPosModal(false)}>Cancelar</Button>
            <Button onClick={handleCreatePosition} className="bg-primary text-primary-foreground">Crear Puesto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Modal: Editar Empleado (Cards View) */}
      <Dialog open={isEditModalOpen} onOpenChange={(open) => {
        setIsEditModalOpen(open);
        if (!open) setEditingId(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit2 className="size-5 text-primary" /> Editar Empleado</DialogTitle>
            <DialogDescription>Modifica los datos del empleado. Los cambios se guardarán de inmediato.</DialogDescription>
          </DialogHeader>
          {editingId && (
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto px-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nombre</Label>
                  <Input value={editData.firstName} onChange={e => setEditData({ ...editData, firstName: e.target.value })} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Apellido</Label>
                  <Input value={editData.lastName} onChange={e => setEditData({ ...editData, lastName: e.target.value })} className="rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Email</Label>
                <Input value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} className="rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Teléfono</Label>
                <Input value={editData.phone || ''} onChange={e => setEditData({ ...editData, phone: e.target.value })} className="rounded-xl" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Salario</Label>
                  <Input type="number" value={editData.salary} onChange={e => setEditData({ ...editData, salary: parseFloat(e.target.value) })} className="rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Moneda</Label>
                  <Select value={editData.currency} onValueChange={(v) => setEditData({ ...editData, currency: v })}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Moneda" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="NIO">NIO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Departamento</Label>
                  <Select value={editData.departmentId} onValueChange={(v) => {
                    const firstPos = positions.find((p: any) => p.departmentId === v);
                    setEditData({ 
                      ...editData, 
                      departmentId: v,
                      positionId: firstPos ? firstPos.id : editData.positionId
                    });
                  }}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Departamento" /></SelectTrigger>
                    <SelectContent>
                      {departments.map((dept: any) => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Puesto</Label>
                  <Select value={editData.positionId} onValueChange={(v) => setEditData({ ...editData, positionId: v })}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Puesto" /></SelectTrigger>
                    <SelectContent>
                      {positions.filter((p: any) => p.departmentId === editData.departmentId).map((pos: any) => (
                        <SelectItem key={pos.id} value={pos.id}>{pos.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Frecuencia de Pago</Label>
                <Select value={editData.payFrequency} onValueChange={(v) => setEditData({ ...editData, payFrequency: v })}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WEEKLY">Semanal</SelectItem>
                    <SelectItem value="BIWEEKLY">Quincenal</SelectItem>
                    <SelectItem value="MONTHLY">Mensual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              if (editingId) {
                handleSave(editingId);
                setIsEditModalOpen(false);
              }
            }} className="bg-primary text-primary-foreground">Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog 
        open={pendingDeleteId !== null} 
        onOpenChange={open => { if (!open) setPendingDeleteId(null); }} 
        title="¿Eliminar Empleado?" 
        description="¿Estás seguro de que deseas eliminar este empleado? Esta acción no se puede deshacer." 
        confirmLabel="Eliminar" 
        variant="destructive" 
        loading={deleteLoading} 
        onConfirm={() => pendingDeleteId ? handleDelete(pendingDeleteId) : Promise.resolve()} 
      />

      {/* Import Modal */}
      <ImportDataModal
        open={showImportModal}
        onOpenChange={setShowImportModal}
        type="employees"
        departments={departments}
        positions={positions}
        employees={employees}
        onImport={async (data) => {
          const result = await hrService.bulkImportEmployees(data);
          return result.data || result;
        }}
        onRefresh={onRefresh}
        hasPayrollConfig={hasPayrollConfig}
        onNavigateToConfig={onNavigateToConfig}
        onBulkProcessPayroll={async (data) => {
          const result: any = await hrService.bulkProcessPayroll(data);
          return result;
        }}
      />
    </div>
  );
}

