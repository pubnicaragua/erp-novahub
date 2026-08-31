import React from 'react';
import { useRef, useState } from 'react';
import { Plus, Search, Filter, Edit2, Save, X, Building2, Briefcase, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Send, CheckCircle2, XCircle, History, Ban, Download, Upload, Settings2, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { hrService } from '../../services/hr.service';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import { Textarea } from '../ui/textarea';
import { EmployeeImportPreview, type EmployeeImportResult, type EmployeeImportRow } from './EmployeeImportPreview';
import {
  employeeContractTypeImportValues,
  employeeContractTypeValues,
  employeePayFrequencyImportValues,
  employeePayFrequencyValues,
  employeeStatusImportValues,
  employeeStatusValues,
  normalizeEmployeeImportValue,
} from './employeeImportValues';
import { EmployeeDetailDrawer } from './EmployeeDetailDrawer';
import { ImportProgressOverlay } from '../ui/ImportProgressOverlay';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { HRViewTutorial } from './HRViewTutorial';
import { parseSpreadsheetInWorker } from '../../utils/import-spreadsheet';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';

export function EmpleadosView({ employees, departments, positions, onRefresh, isSidebarCollapsed = false }: any) {
  const { canPerform, user } = useAuth();
  const tenantKey = user?.tenantId || user?.clientTenantId || 'anonymous';
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [columnConfigOpen, setColumnConfigOpen] = useState(false);
  const [visibleColumnKeys, setVisibleColumnKeys] = useLocalStorageState<string[]>(`hr-employees-columns-${tenantKey}`, ['number', 'name', 'email', 'phone', 'nationalId', 'department', 'position', 'salary', 'status', 'auth'], 24 * 365);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRows, setNewRows] = useState<any[]>([]);
  const [isCreateEmployeeModalOpen, setIsCreateEmployeeModalOpen] = useState(false);
  const [newEmployeeForm, setNewEmployeeForm] = useState<any>({});
  const [editingPendingId, setEditingPendingId] = useState<string | null>(null);
  const [savingPendingEmployees, setSavingPendingEmployees] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);

  const [showNewDeptModal, setShowNewDeptModal] = useState(false);
  const [showNewPosModal, setShowNewPosModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newPosTitle, setNewPosTitle] = useState('');
  const [newPosDeptId, setNewPosDeptId] = useState('');
  const [rejectEmpId, setRejectEmpId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [changeLog, setChangeLog] = useState<any[]>([]);
  const [showChangeLog, setShowChangeLog] = useState(false);
  const [loadingChangeLog, setLoadingChangeLog] = useState(false);
  const [departmentEditorEmployee, setDepartmentEditorEmployee] = useState<any | null>(null);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [primaryDepartmentId, setPrimaryDepartmentId] = useState<string>('');
  const [savingDepartments, setSavingDepartments] = useState(false);
  const [detailEmployeeId, setDetailEmployeeId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importRows, setImportRows] = useState<EmployeeImportRow[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [importResult, setImportResult] = useState<EmployeeImportResult | null>(null);
  const importValidationTimerRef = useRef<number | null>(null);
  const [pendingImportDepartmentRow, setPendingImportDepartmentRow] = useState<number | null>(null);
  const [pendingImportPositionRow, setPendingImportPositionRow] = useState<number | null>(null);

  React.useEffect(() => () => {
    if (importValidationTimerRef.current !== null) window.clearTimeout(importValidationTimerRef.current);
  }, []);

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

  const colFilters = useColumnFilters();
  const filterGetters = {
    name: (emp: any) => {
      const sort = colFilters.state.name?.sort;
      return sort === 'desc' ? (emp.createdAt ? new Date(emp.createdAt).getTime() : 0) : `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
    },
    department: (emp: any) => emp.department?.name || '—',
    position: (emp: any) => emp.position?.title || '—',
    salary: (emp: any) => Number(emp.salary || 0),
    status: (emp: any) => String(emp.employmentStatus || ''),
  };
  const colFilteredEmployees = colFilters.applyTo(filteredEmployees, filterGetters);
  const departmentOptions = [...new Map(filteredEmployees.map((e: any) => [e.department?.name || '—', e.department?.name || '—'])).entries()]
    .map(([, label]) => ({ value: label, label, count: filteredEmployees.filter((e: any) => (e.department?.name || '—') === label).length }));
  const positionOptions = [...new Map(filteredEmployees.map((e: any) => [e.position?.title || '—', e.position?.title || '—'])).entries()]
    .map(([, label]) => ({ value: label, label, count: filteredEmployees.filter((e: any) => (e.position?.title || '—') === label).length }));
  const statusOptionsForFilter = [
    { value: 'ACTIVE', label: 'Activo', count: filteredEmployees.filter((e: any) => String(e.employmentStatus || '') === 'ACTIVE').length },
    { value: 'INACTIVE', label: 'Inactivo', count: filteredEmployees.filter((e: any) => String(e.employmentStatus || '') === 'INACTIVE').length },
    { value: 'ON_LEAVE', label: 'En ausencia', count: filteredEmployees.filter((e: any) => String(e.employmentStatus || '') === 'ON_LEAVE').length },
    { value: 'TERMINATED', label: 'Terminado', count: filteredEmployees.filter((e: any) => String(e.employmentStatus || '') === 'TERMINATED').length },
  ];

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE_OPTIONS = [10, 15, 25, 30, 35, 40, 45, 50];

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterDept, filterStatus, pageSize]);

  const totalPages = Math.ceil(colFilteredEmployees.length / pageSize);
  const paginatedEmployees = colFilteredEmployees.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const columnOptions = [
    { key: 'number', label: 'Número' },
    { key: 'name', label: 'Nombre' },
    { key: 'email', label: 'Correo' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'nationalId', label: 'Cédula' },
    { key: 'department', label: 'Departamento' },
    { key: 'position', label: 'Puesto' },
    { key: 'salary', label: 'Salario' },
    { key: 'status', label: 'Estado' },
    { key: 'auth', label: 'Autorización' },
  ];
  const isColumnVisible = (key: string) => visibleColumnKeys.includes(key);
  const getEmploymentStatusLabel = (status?: string) => ({
    ACTIVE: 'Activo',
    INACTIVE: 'Inactivo',
    ON_LEAVE: 'En ausencia',
    TERMINATED: 'Terminado',
  } as Record<string, string>)[String(status || '').toUpperCase()] || 'No especificado';
  const getApprovalStatusLabel = (status?: string) => ({
    APPROVED: 'Aprobado',
    PENDING_APPROVAL: 'Pendiente',
    REJECTED: 'Rechazado',
    DRAFT: 'Borrador',
  } as Record<string, string>)[String(status || '').toUpperCase()] || 'No especificado';

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleCreateDepartment = async () => {
    if (!newDeptName.trim()) { toast.error('Ingresa un nombre'); return; }
    try {
      const createdDepartment: any = await hrService.createDepartment({ name: newDeptName.trim() });
      const importRowIndex = pendingImportDepartmentRow;
      if (importRowIndex !== null && createdDepartment?.id) {
        setImportRows((current) => validateEmployeeImportRows(current.map((row, index) => index === importRowIndex ? { ...row, department: createdDepartment.name, departmentId: createdDepartment.id, positionId: '' } : row)));
      } else if (createdDepartment?.id) {
        setNewEmployeeForm((current: any) => ({ ...current, departmentId: createdDepartment.id, positionId: '' }));
      }
      toast.success('Departamento creado');
      setNewDeptName('');
      setShowNewDeptModal(false);
      setPendingImportDepartmentRow(null);
      onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al crear departamento'); }
  };

  const handleCreatePosition = async () => {
    if (!newPosTitle.trim()) { toast.error('Ingresa un título'); return; }
    if (!newPosDeptId) { toast.error('Selecciona un departamento'); return; }
    try {
      const code = newPosTitle.trim().replace(/\s+/g, '').substring(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 10000);
      const createdPosition: any = await hrService.createPosition({ title: newPosTitle.trim(), departmentId: newPosDeptId, code });
      const importRowIndex = pendingImportPositionRow;
      if (importRowIndex !== null && createdPosition?.id) {
        setImportRows((current) => validateEmployeeImportRows(current.map((row, index) => index === importRowIndex ? { ...row, position: createdPosition.title, positionId: createdPosition.id } : row)));
      } else if (createdPosition?.id) {
        setNewEmployeeForm((current: any) => ({ ...current, positionId: createdPosition.id }));
      }
      toast.success('Puesto creado');
      setNewPosTitle('');
      setNewPosDeptId('');
      setShowNewPosModal(false);
      setPendingImportPositionRow(null);
      onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al crear puesto'); }
  };

  const toDateInputValue = (value: any) => value ? String(value).slice(0, 10) : '';

  const handleEdit = (emp: any) => {
    setEditingId(emp.id);
    setEditingPendingId(null);
    setNewEmployeeForm({
      employeeNumber: emp.employeeNumber || '',
      firstName: emp.firstName || '',
      lastName: emp.lastName || '',
      email: emp.email || '',
      phone: emp.phone || '',
      nationalId: emp.nationalId || '',
      dateOfBirth: toDateInputValue(emp.dateOfBirth),
      hireDate: toDateInputValue(emp.hireDate),
      departmentId: emp.departmentId || emp.department?.id || '',
      positionId: emp.positionId || emp.position?.id || '',
      contractType: emp.contractType || 'FULL_TIME',
      salary: emp.salary ?? '',
      currency: emp.currency || 'NIO',
      employmentStatus: emp.employmentStatus || 'ACTIVE',
      address: emp.address || '',
      city: emp.city || '',
      state: emp.state || '',
      postalCode: emp.postalCode || '',
      country: emp.country ?? '',
      emergencyContact: emp.emergencyContact || '',
      emergencyPhone: emp.emergencyPhone || '',
      socialSecurityNumber: emp.socialSecurityNumber || '',
      probationEndDate: toDateInputValue(emp.probationEndDate),
      notes: emp.notes || '',
      payFrequency: emp.payFrequency || 'MONTHLY',
    });
    setIsCreateEmployeeModalOpen(true);
  };

  const handleCardEdit = (emp: any) => handleEdit(emp);

  const openEmployeeDetails = (emp: any) => {
    if (emp?.id) setDetailEmployeeId(emp.id);
  };

  const openDepartmentEditor = (emp: any) => {
    const ids = emp.departmentMemberships?.map((membership: any) => membership.department?.id).filter(Boolean)
      || (emp.departmentId ? [emp.departmentId] : []);
    setDepartmentEditorEmployee(emp);
    setSelectedDepartmentIds(ids);
    setPrimaryDepartmentId(emp.departmentId || ids[0] || '');
  };

  const toggleEmployeeDepartment = (departmentId: string) => {
    setSelectedDepartmentIds((current) => {
      if (current.includes(departmentId)) {
        if (current.length === 1) {
          toast.error('El empleado debe conservar al menos un departamento');
          return current;
        }
        const next = current.filter((id) => id !== departmentId);
        if (primaryDepartmentId === departmentId) setPrimaryDepartmentId(next[0]);
        return next;
      }
      return [...current, departmentId];
    });
  };

  const saveEmployeeDepartments = async () => {
    if (!departmentEditorEmployee || !selectedDepartmentIds.length) return;
    try {
      setSavingDepartments(true);
      await hrService.updateEmployeeDepartments(departmentEditorEmployee.id, selectedDepartmentIds, primaryDepartmentId || selectedDepartmentIds[0]);
      toast.success('Departamentos del empleado actualizados');
      setDepartmentEditorEmployee(null);
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al actualizar departamentos');
    } finally {
      setSavingDepartments(false);
    }
  };

  const handleSave = async (id: string) => {
    // Validación básica de campos
    if (!newEmployeeForm.employeeNumber?.trim()) {
      toast.error('El número de empleado es obligatorio');
      return false;
    }

    if (!newEmployeeForm.firstName?.trim() || !newEmployeeForm.lastName?.trim()) {
      toast.error('El nombre y apellido son obligatorios');
      return false;
    }

    if (!newEmployeeForm.email?.trim()) {
      toast.error('El correo electrónico es obligatorio');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmployeeForm.email.trim())) {
      toast.error('El formato del correo electrónico no es válido');
      return false;
    }

    if (!newEmployeeForm.hireDate) {
      toast.error('La fecha de contratación es obligatoria');
      return false;
    }

    if (!newEmployeeForm.departmentId || !newEmployeeForm.positionId) {
      toast.error('El departamento y el puesto son obligatorios');
      return false;
    }

    if (newEmployeeForm.salary === '' || newEmployeeForm.salary === null || !Number.isFinite(Number(newEmployeeForm.salary)) || Number(newEmployeeForm.salary) < 0) {
      toast.error('Ingresa un salario válido');
      return false;
    }

    try {
      // Sanitizar datos antes de enviar
      const sanitizedData = {
        employeeNumber: newEmployeeForm.employeeNumber.trim(),
        firstName: newEmployeeForm.firstName.trim(),
        lastName: newEmployeeForm.lastName.trim(),
        email: newEmployeeForm.email.trim(),
        phone: newEmployeeForm.phone?.trim() || null,
        dateOfBirth: newEmployeeForm.dateOfBirth || null,
        hireDate: newEmployeeForm.hireDate || null,
        departmentId: newEmployeeForm.departmentId,
        positionId: newEmployeeForm.positionId,
        contractType: newEmployeeForm.contractType || 'FULL_TIME',
        salary: isNaN(newEmployeeForm.salary) ? 0 : Number(newEmployeeForm.salary),
        currency: newEmployeeForm.currency || 'NIO',
        employmentStatus: newEmployeeForm.employmentStatus || 'ACTIVE',
        address: newEmployeeForm.address?.trim() || null,
        city: newEmployeeForm.city?.trim() || null,
        state: newEmployeeForm.state?.trim() || null,
        postalCode: newEmployeeForm.postalCode?.trim() || null,
        country: newEmployeeForm.country?.trim() || null,
        emergencyContact: newEmployeeForm.emergencyContact?.trim() || null,
        emergencyPhone: newEmployeeForm.emergencyPhone?.trim() || null,
        nationalId: newEmployeeForm.nationalId?.trim() || null,
        socialSecurityNumber: newEmployeeForm.socialSecurityNumber?.trim() || null,
        probationEndDate: newEmployeeForm.probationEndDate || null,
        notes: newEmployeeForm.notes?.trim() || null,
        payFrequency: newEmployeeForm.payFrequency || 'MONTHLY',
      };

      await hrService.updateEmployee(id, sanitizedData);
      toast.success('Empleado actualizado correctamente');
      setEditingId(null);
      onRefresh();
      return true;
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Error al actualizar empleado';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
      return false;
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setDeleteLoading(true);
      await hrService.updateEmployee(id, { employmentStatus: 'INACTIVE' });
      toast.success('Empleado desactivado');
      onRefresh();
    } catch (error) {
      toast.error('Error al desactivar empleado');
    } finally {
      setDeleteLoading(false);
      setPendingDeleteId(null);
    }
  };

  const handleSubmitApproval = async (id: string) => {
    try {
      await hrService.submitEmployee(id);
      toast.success('Empleado enviado a aprobación');
      onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Error'); }
  };

  const handleApprove = async (id: string) => {
    try {
      await hrService.approveEmployee(id);
      toast.success('Empleado aprobado');
      onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Error'); }
  };

  const handleReject = async () => {
    if (!rejectEmpId || !rejectReason.trim()) return toast.error('Debe indicar el motivo del rechazo');
    try {
      await hrService.rejectEmployee(rejectEmpId, rejectReason);
      toast.success('Empleado rechazado');
      setRejectEmpId(null);
      setRejectReason('');
      onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Error'); }
  };

  const loadChangeLog = async (id: string) => {
    try {
      setLoadingChangeLog(true);
      const res = await hrService.getEmployeeChangeLog(id);
      setChangeLog(Array.isArray(res) ? res : (res as any)?.data || []);
      setShowChangeLog(true);
    } catch (e: any) { toast.error('Error al cargar historial'); }
    finally { setLoadingChangeLog(false); }
  };

  const normalizeImportHeader = (value: unknown) => String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\/_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const normalizeImportText = (value: unknown) => normalizeImportHeader(value).replace(/\s/g, '');
  const normalizeImportNationalId = (value: unknown) => String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '');

  const emptyEmployeeImportRow = (sourceRow: number): EmployeeImportRow => ({
    sourceRow,
    employeeNumber: '', firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '', hireDate: '',
    department: '', position: '', contractType: 'FULL_TIME', salary: '', currency: 'NIO', address: '', city: '',
    state: '', country: 'Nicaragua', postalCode: '', emergencyContact: '', emergencyPhone: '', nationalId: '',
    socialSecurityNumber: '', probationEndDate: '', payFrequency: 'MONTHLY', employmentStatus: 'ACTIVE', notes: '',
  });

  const normalizeImportDate = (value: unknown) => {
    if (value === '' || value === null || value === undefined) return '';
    if (typeof value === 'number') {
      const parsed = (XLSX as any).SSF?.parse_date_code?.(value);
      if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
    const text = String(value).trim();
    const dayMonthYear = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (dayMonthYear) return `${dayMonthYear[3]}-${dayMonthYear[2].padStart(2, '0')}-${dayMonthYear[1].padStart(2, '0')}`;
    const iso = text.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
    return text;
  };

  const validateEmployeeImportRows = (rows: EmployeeImportRow[]) => {
    const existingNumbers = new Set(employees.map((employee: any) => String(employee.employeeNumber || '').trim().toLowerCase()).filter(Boolean));
    const existingEmails = new Set(employees.map((employee: any) => String(employee.email || '').trim().toLowerCase()).filter(Boolean));
    const existingNationalIds = new Set(employees.map((employee: any) => normalizeImportNationalId(employee.nationalId)).filter(Boolean));
    const seenNumbers = new Set<string>();
    const seenEmails = new Set<string>();
    const seenNationalIds = new Set<string>();
    const contractValues: readonly string[] = employeeContractTypeValues;
    const payFrequencyValues: readonly string[] = employeePayFrequencyValues;
    const statusValues: readonly string[] = employeeStatusValues;

    return rows.map((row) => {
      const next: EmployeeImportRow = { ...row, _hasError: false, _errorMessage: undefined, _hasWarning: false, _warningMessage: undefined };
      const departmentValue = String(row.department || '').trim();
      const departmentById = row.departmentId ? departments.find((department: any) => String(department.id) === String(row.departmentId)) : undefined;
      const departmentMatch = departmentById || departments.find((department: any) => [department.name, department.code].some((value) => normalizeImportText(value) === normalizeImportText(departmentValue)));
      const departmentId = departmentMatch?.id || row.departmentId;
      const departmentExists = Boolean(departmentMatch || row.departmentId);
      const positionValue = String(row.position || '').trim();
      const positionById = row.positionId ? positions.find((position: any) => String(position.id) === String(row.positionId)) : undefined;
      const positionMatch = positionById && (!departmentId || String(positionById.departmentId) === String(departmentId))
        ? positionById
        : positions.find((position: any) => String(position.departmentId) === String(departmentId) && [position.title, position.code].some((value) => normalizeImportText(value) === normalizeImportText(positionValue)));
      const positionId = positionMatch?.id || (!positions.some((position: any) => String(position.id) === String(row.positionId)) ? row.positionId : '');
      const positionExists = Boolean(positionMatch || positionId);
      const number = String(row.employeeNumber || '').trim();
      const email = String(row.email || '').trim().toLowerCase();
      const nationalId = normalizeImportNationalId(row.nationalId);
      const salary = row.salary === '' || row.salary === null || row.salary === undefined ? NaN : Number(row.salary);
      const contractType = normalizeEmployeeImportValue('contractType', row.contractType) || 'FULL_TIME';
      const payFrequency = normalizeEmployeeImportValue('payFrequency', row.payFrequency) || 'MONTHLY';
      const employmentStatus = normalizeEmployeeImportValue('employmentStatus', row.employmentStatus) || 'ACTIVE';
      next.contractType = contractType;
      next.payFrequency = payFrequency;
      next.employmentStatus = employmentStatus;
      const errors = [
        !number ? 'Número de empleado obligatorio' : existingNumbers.has(number.toLowerCase()) || seenNumbers.has(number.toLowerCase()) ? 'Número de empleado duplicado' : '',
        !String(row.firstName || '').trim() ? 'Nombres obligatorios' : '',
        !String(row.lastName || '').trim() ? 'Apellidos obligatorios' : '',
        !email || !/^\S+@\S+\.\S+$/.test(email) ? 'Correo inválido' : existingEmails.has(email) || seenEmails.has(email) ? 'Correo duplicado' : '',
        nationalId && (existingNationalIds.has(nationalId) || seenNationalIds.has(nationalId)) ? 'Cédula duplicada en esta empresa' : '',
        !row.hireDate || Number.isNaN(new Date(row.hireDate).getTime()) ? 'Fecha de contratación inválida' : '',
        !departmentExists ? 'Departamento no encontrado' : '',
        !positionExists ? 'Puesto no encontrado' : '',
        positionMatch && departmentId && String(positionMatch.departmentId) !== String(departmentId) ? 'El puesto no pertenece al departamento' : '',
        !contractValues.includes(contractType) ? 'Tipo de contrato inválido: usa Tiempo completo, Medio tiempo, Contratista, Pasante o Temporal' : '',
        !Number.isFinite(salary) || salary < 0 ? 'Salario inválido' : '',
        !['NIO', 'USD'].includes(String(row.currency || '').toUpperCase()) ? 'Moneda inválida' : '',
        !payFrequencyValues.includes(payFrequency) ? 'Frecuencia de pago inválida: usa Semanal, Quincenal, Mensual o Por hora' : '',
        !statusValues.includes(employmentStatus) ? 'Estado laboral inválido: usa Activo, Inactivo, En ausencia o Terminado' : '',
      ].filter(Boolean);
      next.departmentId = departmentId;
      next.positionId = positionId;
      next.salary = Number.isFinite(salary) ? salary : row.salary;
      next._hasError = errors.length > 0;
      next._errorMessage = errors.join(' · ') || undefined;
      if (!next._hasError && (!row.phone || !row.nationalId)) {
        next._hasWarning = true;
        next._warningMessage = !row.phone && !row.nationalId ? 'Sin teléfono ni identificación' : !row.phone ? 'Sin teléfono' : 'Sin identificación';
      }
      if (number) { seenNumbers.add(number.toLowerCase()); existingNumbers.add(number.toLowerCase()); }
      if (email) { seenEmails.add(email); existingEmails.add(email); }
      if (nationalId) { seenNationalIds.add(nationalId); existingNationalIds.add(nationalId); }
      return next;
    });
  };

  const downloadEmployeeTemplate = () => {
    const headers = ['Número de empleado', 'Nombres', 'Apellidos', 'Correo', 'Teléfono', 'Fecha de nacimiento', 'Fecha de contratación', 'Departamento', 'Puesto', 'Tipo de contrato', 'Salario', 'Moneda', 'Dirección', 'Ciudad', 'Estado/Provincia', 'País', 'Código postal', 'Contacto de emergencia', 'Teléfono de emergencia', 'Cédula', 'Número de seguro social', 'Fin de prueba', 'Frecuencia de pago', 'Estado laboral', 'Notas'];
    const sampleDepartment = departments[0]?.name || 'Ventas';
    const samplePosition = positions.find((position: any) => position.departmentId === departments[0]?.id)?.title || 'Ejecutivo de ventas';
    const example = ['EMP0001', 'Ana', 'Gómez', 'ana.gomez@empresa.com', '8888-8888', '1990-05-12', new Date().toISOString().slice(0, 10), sampleDepartment, samplePosition, employeeContractTypeImportValues[0], 15000, 'NIO', 'Dirección del empleado', 'Managua', 'Managua', 'Nicaragua', '', 'Persona de contacto', '8888-0000', '', '', '', employeePayFrequencyImportValues[2], employeeStatusImportValues[0], ''];
    const sheet = XLSX.utils.aoa_to_sheet([headers, example]);
    sheet['!cols'] = headers.map((header) => ({ wch: Math.max(16, Math.min(30, header.length + 4)) }));
    const guide = XLSX.utils.aoa_to_sheet([
      ['GUÍA DE LLENADO · IMPORTACIÓN DE EMPLEADOS'],
      ['La importación puede ejecutarse varias veces. Las filas válidas se crean y las duplicadas o incompletas se reportan como incidencias; una fila con error no cancela las demás.'],
      ['Campo', 'Regla'],
      ['Número de empleado', 'Obligatorio y único dentro de la empresa. Si vuelves a importar el mismo número, se marcará como duplicado.'],
      ['Nombres, Apellidos, Correo', 'Obligatorios. El correo debe tener un formato válido y no estar registrado en otro empleado.'],
      ['Fecha de contratación', 'Obligatoria. Usa AAAA-MM-DD o una fecha reconocible por Excel.'],
      ['Departamento', 'Debe coincidir por nombre o código con un departamento existente. Si no existe, puedes crearlo desde la previsualización.'],
      ['Puesto', 'Debe coincidir por título o código y pertenecer al departamento de la misma fila. También puedes crearlo desde la previsualización.'],
      ['Tipo de contrato', 'Ingresa el valor en español: Tiempo completo, Medio tiempo, Contratista, Pasante o Temporal.'],
      ['Salario y moneda', 'El salario debe ser numérico y mayor o igual a cero. Monedas soportadas en esta vista: NIO y USD.'],
      ['Cédula', 'Es opcional, pero si se informa no puede repetirse en otro empleado de la misma empresa. La comparación ignora mayúsculas, espacios y guiones.'],
      ['Frecuencia de pago', 'Ingresa el valor en español: Semanal, Quincenal, Mensual o Por hora.'],
      ['Estado laboral', 'Ingresa el valor en español: Activo, Inactivo, En ausencia o Terminado.'],
      ['Vendedores', 'No se importa un vendedor por empleado. La elegibilidad para comisiones la determina el departamento marcado como vendedor.'],
    ]);
    guide['!cols'] = [{ wch: 32 }, { wch: 115 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Empleados');
    XLSX.utils.book_append_sheet(workbook, guide, 'Guía de llenado');
    XLSX.writeFile(workbook, 'plantilla_importacion_empleados.xlsx');
    toast.success('Plantilla de empleados descargada');
  };

  const readEmployeeImportFile = async (file: File) => {
    setPreviewLoading(true);
    setPreviewProgress(3);
    try {
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('Selecciona un archivo Excel o CSV válido');
      const { rows: raw } = await parseSpreadsheetInWorker(file, 'empleados', false, (progress) => {
        setPreviewProgress(Math.min(84, Math.max(3, progress)));
      });
      setPreviewProgress(88);
      if (raw.length < 2) throw new Error('El archivo no contiene filas para importar');
      const headers = (raw[0] || []).map(normalizeImportHeader);
      const aliases: Record<string, string[]> = {
        employeeNumber: ['numero de empleado', 'numero empleado', 'codigo empleado', 'employee number', 'employee code', 'codigo'],
        firstName: ['nombres', 'nombre', 'first name', 'firstname'], lastName: ['apellidos', 'apellido', 'last name', 'lastname'],
        email: ['correo', 'correo electronico', 'email'], phone: ['telefono', 'phone'], dateOfBirth: ['fecha de nacimiento', 'nacimiento', 'date of birth'],
        hireDate: ['fecha de contratacion', 'fecha ingreso', 'fecha de ingreso', 'hire date'], department: ['departamento', 'department'], position: ['puesto', 'cargo', 'posicion', 'position'],
      contractType: ['tipo de contrato', 'contrato', 'contract type'], salary: ['salario', 'sueldo', 'salary'], currency: ['moneda', 'currency'], address: ['direccion', 'address'], city: ['ciudad', 'city'], state: ['estado provincia', 'provincia', 'state'], country: ['pais', 'country'], postalCode: ['codigo postal', 'postal code', 'zip code'], emergencyContact: ['contacto de emergencia', 'emergency contact'], emergencyPhone: ['telefono de emergencia', 'emergency phone'], nationalId: ['cedula', 'identificacion', 'national id'], socialSecurityNumber: ['numero de seguro social', 'seguro social', 'inss', 'social security number'], probationEndDate: ['fin de prueba', 'fecha fin prueba', 'probation end date'], payFrequency: ['frecuencia de pago', 'frecuencia pago', 'pay frequency'], employmentStatus: ['estado laboral', 'estado', 'status'], notes: ['notas', 'observaciones', 'notes'],
      };
      const colMap: Record<string, number> = {};
      Object.entries(aliases).forEach(([key, options]) => { const index = headers.findIndex((header: string) => options.includes(header)); if (index >= 0) colMap[key] = index; });
      const getValue = (values: any[], key: string) => colMap[key] === undefined ? '' : values[colMap[key]] ?? '';
      const parsed = raw.slice(1).filter((row: any[]) => row.some((cell) => String(cell ?? '').trim())).map((values: any[], index) => {
        const row = emptyEmployeeImportRow(index + 2);
        row.employeeNumber = String(getValue(values, 'employeeNumber')).trim(); row.firstName = String(getValue(values, 'firstName')).trim(); row.lastName = String(getValue(values, 'lastName')).trim(); row.email = String(getValue(values, 'email')).trim(); row.phone = String(getValue(values, 'phone')).trim();
        row.dateOfBirth = normalizeImportDate(getValue(values, 'dateOfBirth')); row.hireDate = normalizeImportDate(getValue(values, 'hireDate')); row.department = String(getValue(values, 'department')).trim(); row.position = String(getValue(values, 'position')).trim(); row.contractType = normalizeEmployeeImportValue('contractType', getValue(values, 'contractType')) || 'FULL_TIME'; row.salary = getValue(values, 'salary') === '' ? '' : Number(getValue(values, 'salary')); row.currency = String(getValue(values, 'currency') || 'NIO').trim().toUpperCase(); row.address = String(getValue(values, 'address')).trim(); row.city = String(getValue(values, 'city')).trim(); row.state = String(getValue(values, 'state')).trim(); row.country = String(getValue(values, 'country') || 'Nicaragua').trim(); row.postalCode = String(getValue(values, 'postalCode')).trim(); row.emergencyContact = String(getValue(values, 'emergencyContact')).trim(); row.emergencyPhone = String(getValue(values, 'emergencyPhone')).trim(); row.nationalId = String(getValue(values, 'nationalId')).trim(); row.socialSecurityNumber = String(getValue(values, 'socialSecurityNumber')).trim(); row.probationEndDate = normalizeImportDate(getValue(values, 'probationEndDate')); row.payFrequency = normalizeEmployeeImportValue('payFrequency', getValue(values, 'payFrequency')) || 'MONTHLY'; row.employmentStatus = normalizeEmployeeImportValue('employmentStatus', getValue(values, 'employmentStatus')) || 'ACTIVE'; row.notes = String(getValue(values, 'notes')).trim();
        return row;
      });
      setPreviewProgress(94);
      setImportFileName(file.name);
      setImportRows(validateEmployeeImportRows(parsed));
      setPreviewProgress(100);
      setImportResult(null);
      toast.success(`${parsed.length} empleados listos para previsualizar`);
    } catch (error: any) {
      setImportFileName(''); setImportRows([]); toast.error(error?.message || 'No se pudo leer el archivo');
    } finally {
      setPreviewLoading(false);
      setPreviewProgress(0);
    }
  };

  const handleOpenImportPreview = () => {
    if (!importRows.length || previewLoading) return;
    setImportOpen(false);
    setImportPreviewOpen(true);
  };

  const updateEmployeeImportRow = (index: number, field: string, value: string | number) => {
    setImportRows((current) => current.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const next = { ...row, [field]: value } as EmployeeImportRow;
      if (field === 'departmentId') {
        const department = departments.find((item: any) => String(item.id) === String(value));
        next.department = department?.name || next.department;
        next.positionId = '';
      }
      if (field === 'positionId') {
        const position = positions.find((item: any) => String(item.id) === String(value));
        next.position = position?.title || next.position;
      }
      return next;
    }));
    if (importValidationTimerRef.current !== null) window.clearTimeout(importValidationTimerRef.current);
    importValidationTimerRef.current = window.setTimeout(() => {
      setImportRows((current) => validateEmployeeImportRows(current));
      importValidationTimerRef.current = null;
    }, 260);
  };

  const downloadEmployeeImportErrors = () => {
    const previewIncidents = importRows.filter((row) => row._hasError || row._hasWarning).map((row) => ({
      'Fila Excel': row.sourceRow, 'Número de empleado': row.employeeNumber, Nombres: row.firstName, Apellidos: row.lastName,
      Correo: row.email, Departamento: row.department, Puesto: row.position, Clasificación: row._hasError ? 'Error' : 'Advertencia',
      Detalle: row._errorMessage || row._warningMessage || 'Revisar fila',
    }));
    const serverIncidents = (importResult?.errors || []).map((item: any) => ({
      'Fila Excel': typeof item === 'string' ? '' : item.row || '',
      'Número de empleado': typeof item === 'string' ? '' : item.employeeNumber || '',
      Nombres: '', Apellidos: '', Correo: '', Departamento: '', Puesto: '',
      Clasificación: 'Error',
      Detalle: typeof item === 'string' ? item : item.message || 'Error al guardar la fila',
    }));
    const incidents = [...previewIncidents, ...serverIncidents];
    if (!incidents.length) return;
    const sheet = XLSX.utils.json_to_sheet(incidents);
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Incidencias'); XLSX.writeFile(workbook, 'incidencias_importacion_empleados.xlsx');
    toast.success('Reporte de incidencias descargado');
  };

  const executeEmployeeImport = async () => {
    const validRows = importRows.filter((row) => !row._hasError);
    if (!validRows.length) return;
    setImporting(true); setImportProgress(10); setImportResult(null);
    try {
      const response: any = await hrService.bulkImportEmployees(validRows.map((row) => ({
        sourceRow: row.sourceRow, employeeNumber: row.employeeNumber.trim(), firstName: row.firstName.trim(), lastName: row.lastName.trim(), email: row.email.trim(), phone: row.phone.trim() || undefined, dateOfBirth: row.dateOfBirth || undefined, hireDate: row.hireDate, departmentId: row.departmentId, department: row.department, positionId: row.positionId, position: row.position, contractType: row.contractType, salary: Number(row.salary), currency: row.currency, address: row.address || undefined, city: row.city || undefined, state: row.state || undefined, country: row.country || undefined, postalCode: row.postalCode || undefined, emergencyContact: row.emergencyContact || undefined, emergencyPhone: row.emergencyPhone || undefined, nationalId: row.nationalId || undefined, socialSecurityNumber: row.socialSecurityNumber || undefined, probationEndDate: row.probationEndDate || undefined, payFrequency: row.payFrequency || 'MONTHLY', employmentStatus: row.employmentStatus || 'ACTIVE', notes: row.notes || undefined,
      })));
      const result = response?.data || response;
      setImportProgress(90);
      setImportResult({ total: result?.total ?? validRows.length, created: result?.created ?? result?.success ?? 0, skipped: (importRows.length - validRows.length) + (result?.skipped ?? result?.failed ?? 0), errors: result?.errors || [], warnings: result?.warnings || [] });
      // El resultado de la carga debe quedar disponible sin esperar a que se
      // repinten todas las vistas de RR. HH. La actualización continúa aparte.
      void onRefresh();
      setImportProgress(100);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo importar empleados');
    } finally {
      setImporting(false); setImportProgress(0);
    }
  };

  const finishEmployeeImport = () => { setImportResult(null); setImportPreviewOpen(false); setImportRows([]); setImportFileName(''); };
  const createDepartmentFromImport = async (index: number, name: string) => {
    try {
      const createdDepartment: any = await hrService.createDepartment({ name: name.trim() });
      setImportRows((current) => validateEmployeeImportRows(current.map((row, rowIndex) => rowIndex === index ? { ...row, department: createdDepartment.name, departmentId: createdDepartment.id, positionId: '' } : row)));
      toast.success('Departamento creado y asignado a la fila');
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al crear departamento');
      throw error;
    }
  };

  const createPositionFromImport = async (index: number, title: string, departmentId: string) => {
    try {
      const normalizedTitle = normalizeImportText(title);
      const existingPosition = positions.find((position: any) =>
        String(position.departmentId) === String(departmentId)
        && normalizeImportText(position.title) === normalizedTitle,
      );
      const pendingPosition = importRows.find((row, rowIndex) =>
        rowIndex !== index
        && String(row.departmentId) === String(departmentId)
        && row.positionId
        && normalizeImportText(row.position) === normalizedTitle,
      );
      const matchedPosition = existingPosition || (pendingPosition ? { id: pendingPosition.positionId, title: pendingPosition.position } : null);
      if (matchedPosition?.id) {
        setImportRows((current) => validateEmployeeImportRows(current.map((row, rowIndex) => rowIndex === index ? { ...row, position: matchedPosition.title || title.trim(), positionId: matchedPosition.id } : row)));
        toast.info('El puesto ya existía y fue asignado a la fila');
        return;
      }

      const code = title.trim().replace(/\s+/g, '').substring(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 10000);
      const createdPosition: any = await hrService.createPosition({ title: title.trim(), departmentId, code });
      setImportRows((current) => validateEmployeeImportRows(current.map((row, rowIndex) => rowIndex === index ? { ...row, position: createdPosition.title, positionId: createdPosition.id } : row)));
      toast.success('Puesto creado y asignado a la fila');
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al crear puesto');
      throw error;
    }
  };

  const getNextEmployeeNumber = () => {
    const numbers = [...employees, ...newRows].map((employee: any) => {
      const match = String(employee.employeeNumber || '').match(/\d+$/);
      return match ? parseInt(match[0], 10) : 0;
    });
    return `EMP${String(Math.max(0, ...numbers) + 1).padStart(4, '0')}`;
  };

  const createEmptyEmployeeDraft = () => {
    const departmentId = departments[0]?.id || '';
    return {
      employeeNumber: getNextEmployeeNumber(), firstName: '', lastName: '', email: '', phone: '', nationalId: '',
      dateOfBirth: '', hireDate: new Date().toISOString().split('T')[0], departmentId,
      positionId: positions.find((position: any) => position.departmentId === departmentId)?.id || '',
      contractType: 'FULL_TIME', salary: '', currency: 'NIO', employmentStatus: 'ACTIVE',
      address: '', city: '', state: '', postalCode: '', country: 'Nicaragua',
      emergencyContact: '', emergencyPhone: '', socialSecurityNumber: '',
      probationEndDate: '', notes: '', payFrequency: 'MONTHLY',
    };
  };

  const openCreateEmployeeModal = () => {
    setEditingId(null);
    setEditingPendingId(null);
    setNewEmployeeForm(createEmptyEmployeeDraft());
    setIsCreateEmployeeModalOpen(true);
  };

  const validateEmployeeDraft = (row: any, ignorePendingId?: string | null) => {
    if (!row.employeeNumber?.trim()) return 'El número de empleado es obligatorio';
    if (!row.firstName?.trim() || !row.lastName?.trim()) return 'El nombre y apellido son obligatorios';
    if (!row.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())) return 'El formato del correo electrónico no es válido';
    if (!row.hireDate) return 'La fecha de contratación es obligatoria';
    if (!row.departmentId || !row.positionId) return 'Selecciona departamento y puesto';
    const position = positions.find((item: any) => String(item.id) === String(row.positionId));
    if (!position || String(position.departmentId) !== String(row.departmentId)) return 'El puesto no pertenece al departamento seleccionado';
    if (row.salary === '' || row.salary === null || !Number.isFinite(Number(row.salary)) || Number(row.salary) < 0) return 'Ingresa un salario válido';
    const employeeNumber = row.employeeNumber.trim().toLowerCase();
    const email = row.email.trim().toLowerCase();
    const nationalId = normalizeImportNationalId(row.nationalId);
    if (employees.some((employee: any) => String(employee.employeeNumber || '').trim().toLowerCase() === employeeNumber)) return 'El número de empleado ya existe';
    if (employees.some((employee: any) => String(employee.email || '').trim().toLowerCase() === email)) return 'El correo ya está registrado';
    if (nationalId && employees.some((employee: any) => normalizeImportNationalId(employee.nationalId) === nationalId)) return 'La cédula ya está registrada en esta empresa';
    if (newRows.some((pending: any) => pending.tempId !== ignorePendingId && String(pending.employeeNumber || '').trim().toLowerCase() === employeeNumber)) return 'El número de empleado ya está en la lista';
    if (newRows.some((pending: any) => pending.tempId !== ignorePendingId && String(pending.email || '').trim().toLowerCase() === email)) return 'El correo ya está en la lista';
    if (nationalId && newRows.some((pending: any) => pending.tempId !== ignorePendingId && normalizeImportNationalId(pending.nationalId) === nationalId)) return 'La cédula ya está en la lista';
    return null;
  };

  const handleAddEmployeeToList = async () => {
    // Los empleados nuevos se guardan inmediatamente, como en Clientes.
    // Solo los borradores pendientes de una operación anterior permanecen en la lista temporal.
    if (!editingPendingId) {
      await handleInsertEmployeeDirectly();
      return;
    }
    const error = validateEmployeeDraft(newEmployeeForm, editingPendingId);
    if (error) { toast.error(error); return; }
    const draft = {
      ...newEmployeeForm,
      employeeNumber: newEmployeeForm.employeeNumber.trim(), firstName: newEmployeeForm.firstName.trim(), lastName: newEmployeeForm.lastName.trim(), email: newEmployeeForm.email.trim(),
      phone: newEmployeeForm.phone?.trim() || '', nationalId: newEmployeeForm.nationalId?.trim() || '', salary: Number(newEmployeeForm.salary),
      tempId: editingPendingId || `new-${Date.now()}`,
    };
    setNewRows((current) => editingPendingId ? current.map((row) => row.tempId === editingPendingId ? draft : row) : [...current, draft]);
    toast.success(editingPendingId ? 'Borrador actualizado' : 'Empleado agregado a la lista');
    setEditingPendingId(null);
    setNewEmployeeForm(createEmptyEmployeeDraft());
    setIsCreateEmployeeModalOpen(false);
  };

  const handleEditPendingEmployee = (row: any) => {
    setEditingId(null);
    setEditingPendingId(row.tempId);
    setNewEmployeeForm({ ...row });
    setIsCreateEmployeeModalOpen(true);
  };

  const handleDeleteNewRow = (tempId: string) => {
    setNewRows((current) => current.filter((row) => row.tempId !== tempId));
  };

  const updateNewEmployeeForm = (field: string, value: any) => {
    setNewEmployeeForm((current: any) => {
      const next = { ...current, [field]: value };
      if (field === 'departmentId') next.positionId = positions.find((position: any) => position.departmentId === value)?.id || '';
      return next;
    });
  };

  const buildEmployeePayload = (row: any) => ({
    employeeNumber: row.employeeNumber.trim(), firstName: row.firstName.trim(), lastName: row.lastName.trim(), email: row.email.trim(),
    phone: row.phone?.trim() || undefined, dateOfBirth: row.dateOfBirth || undefined, hireDate: row.hireDate, departmentId: row.departmentId, positionId: row.positionId,
    contractType: row.contractType || 'FULL_TIME', salary: Number(row.salary), currency: row.currency || 'NIO', employmentStatus: row.employmentStatus || 'ACTIVE',
    address: row.address?.trim() || undefined, city: row.city?.trim() || undefined, state: row.state?.trim() || undefined, country: row.country?.trim() || undefined, postalCode: row.postalCode?.trim() || undefined,
    nationalId: row.nationalId?.trim() || undefined, socialSecurityNumber: row.socialSecurityNumber?.trim() || undefined, emergencyContact: row.emergencyContact?.trim() || undefined, emergencyPhone: row.emergencyPhone?.trim() || undefined,
    probationEndDate: row.probationEndDate || undefined, payFrequency: row.payFrequency || 'MONTHLY', notes: row.notes?.trim() || undefined,
  });

  const handleSaveExistingEmployee = async () => {
    if (!editingId) return;
    const saved = await handleSave(editingId);
    if (saved) {
      setIsCreateEmployeeModalOpen(false);
      setNewEmployeeForm(createEmptyEmployeeDraft());
    }
  };

  const handleInsertEmployeeDirectly = async () => {
    const error = validateEmployeeDraft(newEmployeeForm, null);
    if (error) { toast.error(error); return; }

    setSavingEmployee(true);
    try {
      await hrService.createEmployee(buildEmployeePayload({
        ...newEmployeeForm,
        employeeNumber: newEmployeeForm.employeeNumber.trim(),
        firstName: newEmployeeForm.firstName.trim(),
        lastName: newEmployeeForm.lastName.trim(),
        email: newEmployeeForm.email.trim(),
        phone: newEmployeeForm.phone?.trim() || '',
        nationalId: newEmployeeForm.nationalId?.trim() || '',
        salary: Number(newEmployeeForm.salary),
      }));
      toast.success('Empleado guardado correctamente');
      setIsCreateEmployeeModalOpen(false);
      setEditingId(null);
      setEditingPendingId(null);
      setNewEmployeeForm(createEmptyEmployeeDraft());
      await onRefresh();
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || 'Error al crear empleado';
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSavingEmployee(false);
    }
  };

  const savePendingEmployees = async () => {
    if (!newRows.length) return;
    setSavingPendingEmployees(true);
    const pendingAtSave = [...newRows];
    try {
      const results = await Promise.allSettled(pendingAtSave.map((row) => hrService.createEmployee(buildEmployeePayload(row))));
      const failedRows = pendingAtSave.filter((_, index) => results[index].status === 'rejected');
      const createdCount = pendingAtSave.length - failedRows.length;
      setNewRows(failedRows);
      if (createdCount) await onRefresh();
      if (failedRows.length) toast.warning(`${createdCount} empleado(s) guardado(s) y ${failedRows.length} quedaron pendientes por revisar`);
      else toast.success(`${createdCount} empleado(s) creado(s) correctamente`);
    } finally {
      setSavingPendingEmployees(false);
    }
  };

  if (importPreviewOpen) {
    return <EmployeeImportPreview
      rows={importRows}
      fileName={importFileName}
      departments={departments}
      positions={positions}
      isSidebarCollapsed={isSidebarCollapsed}
      canCreateCatalogs={canPerform('HR_EMPLOYEES', 'create')}
      importing={importing}
      progress={importProgress}
      result={importResult}
      onRowUpdate={updateEmployeeImportRow}
      onCreateDepartment={createDepartmentFromImport}
      onCreatePosition={createPositionFromImport}
      onDownloadErrors={downloadEmployeeImportErrors}
      onBack={() => { setImportPreviewOpen(false); setImportOpen(true); }}
      onConfirm={() => void executeEmployeeImport()}
      onDone={finishEmployeeImport}
    />;
  }

  return (
    <div className="space-y-4 overflow-x-auto min-w-0">
      <ImportProgressOverlay open={previewLoading} progress={previewProgress} title="Preparando previsualización" description="Leyendo el archivo, validando los datos y preparando los empleados para revisión." />
      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between" data-tour="hr-employees-title">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar empleados..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-tour="empleados-search"
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
        <div className="erp-list-toolbar flex flex-wrap items-center gap-2" data-tour="hr-employees-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setColumnConfigOpen(true)}
            data-tour="empleados-columns"
            className="h-10 rounded-xl border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest"
          >
            <Settings2 className="mr-2 size-4" /> Columnas <span className="ml-1 text-muted-foreground">{visibleColumnKeys.length}</span>
          </Button>
          <select
            value={viewMode}
            onChange={(event) => setViewMode(event.target.value as 'table' | 'cards')}
            aria-label="Elegir distribución"
            data-tour="empleados-layout"
            data-toolbar-role="layout"
            className="h-10 w-32 rounded-xl border border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest outline-none focus:border-primary"
          >
            <option value="table">Lista</option>
            <option value="cards">Tarjetas</option>
          </select>
          {canPerform('HR_EMPLOYEES', 'create') && (
            <Button size="sm" onClick={openCreateEmployeeModal} data-toolbar-role="primary" className="h-10 shrink-0 gap-2 rounded-xl border border-primary/20 bg-primary px-4 text-[10px] font-black uppercase tracking-widest !text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90" data-tour="empleados-add">
              <Plus className="size-4" />
              Agregar Empleado
            </Button>
          )}
          {canPerform('HR_EMPLOYEES', 'create') && (
            <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="size-4 mr-2" />
              Importar Excel
            </Button>
          )}
          <HRViewTutorial label="Cómo gestionar empleados" targetPrefix="hr-employees" stepKeys={['title', 'data', 'actions']} copy={{ data: { description: 'Busca, filtra y cambia entre lista y tarjetas para revisar el expediente laboral.' }, actions: { description: 'Configura columnas, agrega empleados, importa Excel o abre las acciones de cada registro.' } }} />
        </div>
      </div>

      {newRows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-primary/20 bg-primary/[0.03] shadow-sm">
          <div className="flex flex-col gap-3 border-b border-primary/10 bg-primary/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Lista de empleados</p>
              <p className="mt-1 text-sm text-muted-foreground">Estos empleados todavía no se han guardado. Puedes revisar la lista y agregar más desde el modal.</p>
            </div>
            <Button type="button" onClick={() => void savePendingEmployees()} disabled={savingPendingEmployees} className="shrink-0">
              <Save className="size-4" /> {savingPendingEmployees ? 'Guardando...' : `Guardar lista (${newRows.length})`}
            </Button>
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {newRows.map((row: any) => {
              const department = departments.find((item: any) => String(item.id) === String(row.departmentId));
              const position = positions.find((item: any) => String(item.id) === String(row.positionId));
              return (
                <div key={row.tempId} className="flex min-w-0 items-start justify-between gap-3 rounded-xl border bg-background/80 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{row.firstName} {row.lastName}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.employeeNumber} · {row.email}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{department?.name || 'Sin departamento'} · {position?.title || 'Sin puesto'}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Cédula: <span className="font-semibold text-foreground">{row.nationalId || 'No indicada'}</span></p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => handleEditPendingEmployee(row)} title="Editar empleado pendiente" aria-label="Editar empleado pendiente"><Edit2 className="size-3.5" /></Button>
                    <Button type="button" size="icon" variant="ghost" className="size-8 text-destructive" onClick={() => handleDeleteNewRow(row.tempId)} title="Quitar de la lista" aria-label="Quitar de la lista"><X className="size-3.5" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div data-tour="hr-employees-data" className="space-y-4">
      {/* Table View - Desktop Only */}
      <div data-tour="empleados-table" className={`border rounded-lg overflow-hidden ${viewMode === 'table' ? 'hidden md:block' : 'hidden'}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-muted/50">
                <tr>
                  {isColumnVisible('number') && <th className="px-4 py-3 text-left text-xs font-semibold">Número</th>}
                  {isColumnVisible('name') && <th className="px-4 py-3 text-left text-xs font-semibold"><span className="inline-flex items-center gap-1">Nombre<ColumnFilterMenu label="Nombre" sort={colFilters.state.name?.sort || null} onSort={(sort) => colFilters.setSort('name', sort)} sortOptions={[{ value: 'asc', label: 'A → Z (alfabético)' }, { value: 'desc', label: 'Más recientes' }]} /></span></th>}
                  {isColumnVisible('email') && <th className="px-4 py-3 text-left text-xs font-semibold">Correo</th>}
                  {isColumnVisible('phone') && <th className="px-4 py-3 text-left text-xs font-semibold">Teléfono</th>}
                  {isColumnVisible('nationalId') && <th className="px-4 py-3 text-left text-xs font-semibold">Cédula</th>}
                  {isColumnVisible('department') && <th className="px-4 py-3 text-left text-xs font-semibold"><span className="inline-flex items-center gap-1">Departamento<ColumnFilterMenu label="Departamento" options={departmentOptions} selected={colFilters.state.department?.values || []} onSelect={(values) => colFilters.setValues('department', values)} sort={colFilters.state.department?.sort || null} onSort={(sort) => colFilters.setSort('department', sort)} /></span></th>}
                  {isColumnVisible('position') && <th className="px-4 py-3 text-left text-xs font-semibold"><span className="inline-flex items-center gap-1">Puesto<ColumnFilterMenu label="Puesto" options={positionOptions} selected={colFilters.state.position?.values || []} onSelect={(values) => colFilters.setValues('position', values)} sort={colFilters.state.position?.sort || null} onSort={(sort) => colFilters.setSort('position', sort)} /></span></th>}
                  {isColumnVisible('salary') && <th className="px-4 py-3 text-left text-xs font-semibold"><span className="inline-flex items-center gap-1">Salario<ColumnFilterMenu label="Salario" sort={colFilters.state.salary?.sort || null} onSort={(sort) => colFilters.setSort('salary', sort)} /></span></th>}
                  {isColumnVisible('status') && <th className="px-4 py-3 text-left text-xs font-semibold"><span className="inline-flex items-center gap-1">Estado<ColumnFilterMenu label="Estado" options={statusOptionsForFilter} selected={colFilters.state.status?.values || []} onSelect={(values) => colFilters.setValues('status', values)} sort={colFilters.state.status?.sort || null} onSort={(sort) => colFilters.setSort('status', sort)} /></span></th>}
                  {isColumnVisible('auth') && <th className="px-4 py-3 text-left text-xs font-semibold">Autorización</th>}
                  <th className="px-4 py-3 text-right text-xs font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {/* Existing Employees */}
                {paginatedEmployees.map((emp: any) => (
                  <tr
                    key={emp.id}
                    className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                    onClick={() => openEmployeeDetails(emp)}
                    onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openEmployeeDetails(emp); } }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Ver detalles de ${emp.firstName} ${emp.lastName}`}
                  >
                    {isColumnVisible('number') && <td className="px-4 py-2 text-sm font-mono text-muted-foreground">{emp.employeeNumber}</td>}
                    {isColumnVisible('name') && <td className="px-4 py-2 text-sm font-semibold">{emp.firstName} {emp.lastName}</td>}
                    {isColumnVisible('email') && <td className="px-4 py-2 text-sm text-muted-foreground">{emp.email}</td>}
                    {isColumnVisible('phone') && <td className="px-4 py-2 text-sm text-muted-foreground">{emp.phone || '—'}</td>}
                    {isColumnVisible('nationalId') && <td className="px-4 py-2 text-sm text-muted-foreground">{emp.nationalId || '—'}</td>}
                    {isColumnVisible('department') && <td className="px-4 py-2 text-sm"><div className="flex items-center gap-1.5"><span className="truncate">{emp.department?.name || '—'}</span>{canPerform('HR_EMPLOYEES', 'edit') && <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={(event) => { event.stopPropagation(); openDepartmentEditor(emp); }} title="Gestionar departamentos"><Building2 className="size-3.5 text-primary" /></Button>}</div></td>}
                    {isColumnVisible('position') && <td className="px-4 py-2 text-sm">{emp.position?.title || '—'}</td>}
                    {isColumnVisible('salary') && <td className="px-4 py-2"><div className="flex flex-col"><CurrencyValuationAmount amount={Number(emp.salary || 0)} sourceCurrency={emp.currency || 'USD'} sourceExchangeRate={emp.exchangeRate} className="text-sm font-bold text-primary" /><span className="text-[9px] text-muted-foreground uppercase font-black">Original: {emp.currency}</span></div></td>}
                    {isColumnVisible('status') && <td className="px-4 py-2"><span className={`text-[10px] px-2 py-1 rounded-lg font-black uppercase tracking-tighter ${emp.employmentStatus === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : emp.employmentStatus === 'INACTIVE' ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'}`}>{emp.employmentStatus === 'ACTIVE' ? 'Activo' : emp.employmentStatus === 'INACTIVE' ? 'Inactivo' : emp.employmentStatus === 'ON_LEAVE' ? 'Licencia' : emp.employmentStatus === 'TERMINATED' ? 'Terminado' : emp.employmentStatus}</span></td>}
                    {isColumnVisible('auth') && <td className="px-4 py-2">{(() => { const opts: Record<string, { label: string; color: string }> = { APPROVED: { label: 'Aprobado', color: 'bg-emerald-500/10 text-emerald-500' }, PENDING_APPROVAL: { label: 'Pendiente', color: 'bg-amber-500/10 text-amber-500' }, REJECTED: { label: 'Rechazado', color: 'bg-rose-500/10 text-rose-500' }, DRAFT: { label: 'Borrador', color: 'bg-muted/20 text-muted-foreground' } }; const status = opts[String(emp.approvalStatus || 'APPROVED').toUpperCase()] || opts.APPROVED; return <Badge variant="outline" className={cn('text-[8px] font-black uppercase px-1.5 py-0 border-none', status.color)}>{status.label}</Badge>; })()}</td>}
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {canPerform('HR_EMPLOYEES', 'edit') && <Button variant="ghost" size="icon" title="Editar empleado" aria-label="Editar empleado" onClick={(event) => { event.stopPropagation(); handleEdit(emp); }} className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"><Edit2 className="size-4" /></Button>}
                            {emp.approvalStatus === 'DRAFT' && canPerform('HR_EMPLOYEES', 'approve') && (
                              <Button title="Enviar a aprobación" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-amber-500/10 hover:text-amber-500" onClick={(e) => { e.stopPropagation(); handleSubmitApproval(emp.id); }}>
                                <Send className="size-4" />
                              </Button>
                            )}
                            {emp.approvalStatus === 'PENDING_APPROVAL' && (canPerform('HR_EMPLOYEES', 'approve') || canPerform('HR_EMPLOYEES', 'delete')) && (
                              <>
                                {canPerform('HR_EMPLOYEES', 'approve') && <Button title="Aprobar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500" onClick={(e) => { e.stopPropagation(); handleApprove(emp.id); }}>
                                  <CheckCircle2 className="size-4" />
                                </Button>}
                                {canPerform('HR_EMPLOYEES', 'delete') && <Button title="Rechazar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={(e) => { e.stopPropagation(); setRejectEmpId(emp.id); }}>
                                  <XCircle className="size-4" />
                                </Button>}
                              </>
                            )}
                            <Button title="Historial de cambios" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-blue-500/10 hover:text-blue-500" onClick={(e) => { e.stopPropagation(); loadChangeLog(emp.id); }}>
                              <History className="size-4" />
                            </Button>
                            {canPerform('HR_EMPLOYEES', 'delete') && <Button variant="ghost" size="icon" title="Anular empleado" aria-label="Anular empleado" onClick={(event) => { event.stopPropagation(); setPendingDeleteId(emp.id); }} className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"><Ban className="size-4" /></Button>}
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
            <div
              key={emp.id}
              className="cursor-pointer border border-border/40 rounded-2xl p-5 bg-gradient-to-br from-card to-muted/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 relative overflow-hidden group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => openEmployeeDetails(emp)}
              onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openEmployeeDetails(emp); } }}
              tabIndex={0}
              role="button"
              aria-label={`Ver detalles de ${emp.firstName} ${emp.lastName}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                    {emp.firstName?.[0]}{emp.lastName?.[0]}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm">{emp.firstName} {emp.lastName}</h3>
                    {isColumnVisible('number') && <p className="text-xs text-muted-foreground">{emp.employeeNumber}</p>}
                  </div>
                </div>
                {isColumnVisible('status') && <span className={`text-xs px-2 py-1 rounded ${
                  emp.employmentStatus === 'ACTIVE' 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                }`}>
                  {getEmploymentStatusLabel(emp.employmentStatus)}
                </span>}
              </div>
              <div className="space-y-2 text-sm">
                {isColumnVisible('email') && <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium truncate">{emp.email}</span>
                </div>}
                {isColumnVisible('phone') && emp.phone && <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Teléfono:</span>
                  <span className="font-medium">{emp.phone}</span>
                </div>}
                {isColumnVisible('department') && <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Departamento:</span>
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="truncate font-medium">{emp.department?.name}</span>
                    {canPerform('HR_EMPLOYEES', 'edit') && <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={(event) => { event.stopPropagation(); openDepartmentEditor(emp); }} title="Gestionar departamentos"><Building2 className="size-3.5 text-primary" /></Button>}
                  </div>
                </div>}
                {isColumnVisible('position') && <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Puesto:</span>
                  <span className="font-medium">{emp.position?.title}</span>
                </div>}
                {isColumnVisible('salary') && <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Salario:</span>
                  <div className="flex flex-col items-end">
                    <CurrencyValuationAmount amount={Number(emp.salary || 0)} sourceCurrency={emp.currency || 'USD'} sourceExchangeRate={emp.exchangeRate} className="font-bold text-primary" />
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">Contrato: {emp.currency}</span>
                  </div>
                </div>}
                {isColumnVisible('nationalId') && <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Cédula:</span><span className="font-medium">{emp.nationalId || '—'}</span></div>}
                {isColumnVisible('auth') && <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Autorización:</span><Badge variant="outline" className="border-none bg-muted/20 text-[9px] font-black uppercase">{getApprovalStatusLabel(emp.approvalStatus)}</Badge></div>}
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/40 relative z-10">
                {canPerform('HR_EMPLOYEES', 'edit') && (
                  <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); handleCardEdit(emp); }} className="flex-1 rounded-xl transition-all hover:bg-primary/10 hover:text-primary hover:border-primary/30">
                    <Edit2 className="size-3 mr-1" />
                    Editar
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  title="Historial de cambios"
                  aria-label="Historial de cambios"
                  onClick={(event) => { event.stopPropagation(); loadChangeLog(emp.id); }}
                  className="size-8 rounded-lg hover:bg-blue-500/10 hover:text-blue-500 transition-colors"
                >
                  <History className="size-4" />
                </Button>
                {canPerform('HR_EMPLOYEES', 'delete') && (
                  <Button variant="ghost" size="icon" title="Anular empleado" aria-label="Anular empleado" onClick={(event) => { event.stopPropagation(); setPendingDeleteId(emp.id); }} className="size-8 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors">
                    <Ban className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Pagination Controls */}
      {filteredEmployees.length > 0 && (
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

      <Dialog open={columnConfigOpen} onOpenChange={setColumnConfigOpen}>
        <DialogContent className="w-[calc(100%-2rem)] !max-w-2xl rounded-3xl">
          <DialogHeader data-tour="hr-columns-title">
            <DialogTitle className="flex items-center gap-2"><Settings2 className="size-5 text-primary" /> Configurar columnas</DialogTitle>
            <DialogDescription>Elige qué información quieres ver en la lista y en las tarjetas de empleados. Los cambios se reflejan inmediatamente.</DialogDescription>
            <HRViewTutorial label="Cómo configurar columnas" targetPrefix="hr-columns" copy={{ data: { description: 'Activa o desactiva los campos que aparecerán en la lista y las tarjetas.' }, actions: { description: 'Cierra el modal; los cambios se aplican inmediatamente.' } }} />
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" data-tour="hr-columns-data">
            {columnOptions.map((option) => {
              const active = isColumnVisible(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setVisibleColumnKeys((current) => active ? (current.length > 1 ? current.filter((key) => key !== option.key) : current) : [...current, option.key])}
                  className={cn('flex min-h-11 items-center justify-between rounded-xl border px-3 text-left text-xs font-bold transition-colors', active ? 'border-primary bg-primary/10 text-foreground' : 'border-border/60 bg-muted/10 text-muted-foreground hover:border-primary/50')}
                >
                  <span>{option.label}</span>
                  {active && <Check className="size-4 text-primary" />}
                </button>
              );
            })}
          </div>
          <DialogFooter className="flex-wrap gap-2" data-tour="hr-columns-actions">
            <Button variant="outline" onClick={() => setVisibleColumnKeys(columnOptions.map((option) => option.key))}>Mostrar todas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateEmployeeModalOpen} onOpenChange={(open) => {
        setIsCreateEmployeeModalOpen(open);
        if (!open) {
          setEditingId(null);
          setEditingPendingId(null);
        }
      }}>
        <DialogContent className="!flex !max-h-[92vh] w-[calc(100vw-1rem)] !max-w-[min(94vw,1400px)] !flex-col overflow-hidden rounded-3xl p-0">
          <DialogHeader className="border-b border-border/40 px-5 py-5 sm:px-7" data-tour="hr-employee-form-title">
            <DialogTitle className="flex items-center gap-2">{editingId ? <Edit2 className="size-5 text-primary" /> : <Plus className="size-5 text-primary" />} {editingId ? 'Editar empleado' : editingPendingId ? 'Editar empleado pendiente' : 'Agregar empleado'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Actualiza la información del empleado desde el mismo formulario utilizado para crearlo.'
                : editingPendingId
                  ? 'Modifica este empleado pendiente antes de insertarlo junto con los demás registros.'
                  : 'Completa la información del empleado. Al guardarlo quedará registrado en la lista de empleados.'}
            </DialogDescription>
            <HRViewTutorial label={editingId ? 'Cómo editar empleado' : 'Cómo agregar empleado'} targetPrefix="hr-employee-form" stepKeys={['title', 'data', 'items', 'actions']} copy={{ data: { description: 'Completa la información personal, laboral, salarial, de ubicación y contacto.' }, items: { title: 'Catálogos relacionados', description: 'Selecciona departamento, puesto, contrato, moneda, frecuencia de pago y estado.' }, actions: { description: 'Guarda el empleado o actualiza el registro pendiente.' } }} />
          </DialogHeader>
          <div className="min-h-0 min-w-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5 sm:p-7" data-tour="hr-employee-form-data">
            <section className="space-y-3">
              <div><p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Información personal</p><p className="mt-1 text-xs text-muted-foreground">La cédula se almacena en el expediente del empleado y también se puede importar desde Excel.</p></div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2"><Label>Número de empleado *</Label><Input value={newEmployeeForm.employeeNumber || ''} onChange={(event) => updateNewEmployeeForm('employeeNumber', event.target.value)} placeholder="EMP0001" /></div>
                <div className="space-y-2"><Label>Nombres *</Label><Input value={newEmployeeForm.firstName || ''} onChange={(event) => updateNewEmployeeForm('firstName', event.target.value)} placeholder="Nombres" /></div>
                <div className="space-y-2"><Label>Apellidos *</Label><Input value={newEmployeeForm.lastName || ''} onChange={(event) => updateNewEmployeeForm('lastName', event.target.value)} placeholder="Apellidos" /></div>
                <div className="space-y-2"><Label>Cédula</Label><Input value={newEmployeeForm.nationalId || ''} onChange={(event) => updateNewEmployeeForm('nationalId', event.target.value)} placeholder="001-010190-1000A" /></div>
                <div className="space-y-2 sm:col-span-2"><Label>Correo electrónico *</Label><Input type="email" value={newEmployeeForm.email || ''} onChange={(event) => updateNewEmployeeForm('email', event.target.value)} placeholder="empleado@empresa.com" /></div>
                <div className="space-y-2"><Label>Teléfono</Label><Input value={newEmployeeForm.phone || ''} onChange={(event) => updateNewEmployeeForm('phone', event.target.value)} placeholder="8888-8888" /></div>
                <div className="space-y-2"><Label>Fecha de nacimiento</Label><Input type="date" value={newEmployeeForm.dateOfBirth || ''} onChange={(event) => updateNewEmployeeForm('dateOfBirth', event.target.value)} /></div>
              </div>
            </section>

            <section className="space-y-3 border-t pt-5" data-tour="hr-employee-form-items">
              <div><p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Información laboral</p><p className="mt-1 text-xs text-muted-foreground">El departamento y el puesto deben pertenecer a los catálogos de Recursos Humanos.</p></div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2"><Label>Fecha de contratación *</Label><Input type="date" value={newEmployeeForm.hireDate || ''} onChange={(event) => updateNewEmployeeForm('hireDate', event.target.value)} /></div>
                <div className="space-y-2"><Label>Departamento *</Label><div className="flex items-center gap-2"><Select value={newEmployeeForm.departmentId || ''} onValueChange={(value) => updateNewEmployeeForm('departmentId', value)}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{departments.map((department: any) => <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>)}</SelectContent></Select><Button type="button" size="icon" variant="outline" className="size-9 shrink-0" onClick={() => { setNewDeptName(''); setPendingImportDepartmentRow(null); setShowNewDeptModal(true); }} title="Crear departamento" aria-label="Crear departamento"><Plus className="size-3.5" /></Button></div></div>
                <div className="space-y-2"><Label>Puesto *</Label><div className="flex items-center gap-2"><Select value={newEmployeeForm.positionId || ''} onValueChange={(value) => updateNewEmployeeForm('positionId', value)}><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{positions.filter((position: any) => !newEmployeeForm.departmentId || position.departmentId === newEmployeeForm.departmentId).map((position: any) => <SelectItem key={position.id} value={position.id}>{position.title}</SelectItem>)}</SelectContent></Select><Button type="button" size="icon" variant="outline" className="size-9 shrink-0" onClick={() => { setNewPosTitle(''); setNewPosDeptId(newEmployeeForm.departmentId || ''); setPendingImportPositionRow(null); setShowNewPosModal(true); }} title="Crear puesto" aria-label="Crear puesto" disabled={!newEmployeeForm.departmentId}><Plus className="size-3.5" /></Button></div></div>
                <div className="space-y-2"><Label>Tipo de contrato *</Label><Select value={newEmployeeForm.contractType || 'FULL_TIME'} onValueChange={(value) => updateNewEmployeeForm('contractType', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="FULL_TIME">Tiempo completo</SelectItem><SelectItem value="PART_TIME">Medio tiempo</SelectItem><SelectItem value="CONTRACTOR">Contratista</SelectItem><SelectItem value="INTERN">Pasante</SelectItem><SelectItem value="TEMPORARY">Temporal</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Salario *</Label><Input type="number" min="0" value={newEmployeeForm.salary ?? ''} onChange={(event) => updateNewEmployeeForm('salary', event.target.value === '' ? '' : Number(event.target.value))} placeholder="0.00" /></div>
                <div className="space-y-2"><Label>Moneda</Label><Select value={newEmployeeForm.currency || 'NIO'} onValueChange={(value) => updateNewEmployeeForm('currency', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="NIO">NIO - Córdoba</SelectItem><SelectItem value="USD">USD - Dólar</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Frecuencia de pago</Label><Select value={newEmployeeForm.payFrequency || 'MONTHLY'} onValueChange={(value) => updateNewEmployeeForm('payFrequency', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="WEEKLY">Semanal</SelectItem><SelectItem value="BIWEEKLY">Quincenal</SelectItem><SelectItem value="MONTHLY">Mensual</SelectItem><SelectItem value="HOURLY">Por hora</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Estado</Label><Select value={newEmployeeForm.employmentStatus || 'ACTIVE'} onValueChange={(value) => updateNewEmployeeForm('employmentStatus', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ACTIVE">Activo</SelectItem><SelectItem value="INACTIVE">Inactivo</SelectItem><SelectItem value="ON_LEAVE">En ausencia</SelectItem><SelectItem value="TERMINATED">Terminado</SelectItem></SelectContent></Select></div>
              </div>
            </section>

            <section className="space-y-3 border-t pt-5">
              <div><p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Ubicación y datos laborales adicionales</p><p className="mt-1 text-xs text-muted-foreground">Estos datos son opcionales y pueden completarse posteriormente.</p></div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2 sm:col-span-2 lg:col-span-2"><Label>Dirección</Label><Input value={newEmployeeForm.address || ''} onChange={(event) => updateNewEmployeeForm('address', event.target.value)} placeholder="Dirección del empleado" /></div>
                <div className="space-y-2"><Label>Ciudad</Label><Input value={newEmployeeForm.city || ''} onChange={(event) => updateNewEmployeeForm('city', event.target.value)} /></div>
                <div className="space-y-2"><Label>Estado / Provincia</Label><Input value={newEmployeeForm.state || ''} onChange={(event) => updateNewEmployeeForm('state', event.target.value)} /></div>
                <div className="space-y-2"><Label>País</Label><Input value={newEmployeeForm.country || ''} onChange={(event) => updateNewEmployeeForm('country', event.target.value)} /></div>
                <div className="space-y-2"><Label>Código postal</Label><Input value={newEmployeeForm.postalCode || ''} onChange={(event) => updateNewEmployeeForm('postalCode', event.target.value)} /></div>
                <div className="space-y-2"><Label>Número de seguro social</Label><Input value={newEmployeeForm.socialSecurityNumber || ''} onChange={(event) => updateNewEmployeeForm('socialSecurityNumber', event.target.value)} /></div>
                <div className="space-y-2"><Label>Contacto de emergencia</Label><Input value={newEmployeeForm.emergencyContact || ''} onChange={(event) => updateNewEmployeeForm('emergencyContact', event.target.value)} /></div>
                <div className="space-y-2"><Label>Teléfono de emergencia</Label><Input value={newEmployeeForm.emergencyPhone || ''} onChange={(event) => updateNewEmployeeForm('emergencyPhone', event.target.value)} /></div>
                <div className="space-y-2"><Label>Fin del período de prueba</Label><Input type="date" value={newEmployeeForm.probationEndDate || ''} onChange={(event) => updateNewEmployeeForm('probationEndDate', event.target.value)} /></div>
                <div className="space-y-2 sm:col-span-2 lg:col-span-4"><Label>Notas</Label><Textarea value={newEmployeeForm.notes || ''} onChange={(event) => updateNewEmployeeForm('notes', event.target.value)} placeholder="Observaciones del expediente" rows={3} /></div>
              </div>
            </section>
          </div>
          <DialogFooter className="flex-wrap gap-2 border-t border-border/40 px-5 py-4 sm:px-7" data-tour="hr-employee-form-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCreateEmployeeModalOpen(false);
                setEditingId(null);
                setEditingPendingId(null);
              }}
              className="w-full rounded-xl sm:w-auto"
            >
              Cancelar
            </Button>
              {editingId ? (
                <Button type="button" onClick={() => void handleSaveExistingEmployee()} className="w-full rounded-xl sm:w-auto">
                  <Save className="size-4" /> Guardar cambios
                </Button>
              ) : (
                <Button type="button" onClick={() => void handleAddEmployeeToList()} disabled={savingEmployee} className="w-full rounded-xl sm:w-auto">
                  <Save className="size-4" /> {savingEmployee ? 'Guardando...' : editingPendingId ? 'Actualizar en la lista' : 'Guardar empleado'}
                </Button>
              )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={(open) => { if (!open && !importing) setImportOpen(false); }}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] !max-w-3xl overflow-y-auto">
          <DialogHeader data-tour="hr-employee-import-title"><DialogTitle className="flex items-center gap-2"><Upload className="size-4" /> Importar empleados</DialogTitle><DialogDescription>Carga una plantilla Excel, revisa la previsualización y confirma solo las filas válidas. Este proceso puede repetirse cuantas veces sea necesario.</DialogDescription><HRViewTutorial label="Cómo importar empleados" targetPrefix="hr-employee-import" stepKeys={['title', 'data', 'actions']} copy={{ data: { description: 'Descarga la plantilla, carga el archivo y revisa las filas detectadas.' }, actions: { description: 'Abre la previsualización para corregir incidencias y confirmar las filas válidas.' } }} /></DialogHeader>
          <div className="space-y-4" data-tour="hr-employee-import-data">
            <div className="rounded-xl border bg-muted/20 p-4 text-xs text-muted-foreground"><p className="font-black uppercase tracking-widest text-foreground">Antes de cargar</p><p className="mt-2">Usa nombres o códigos existentes para departamentos y puestos. Los campos Tipo de contrato, Frecuencia de pago y Estado laboral deben escribirse en español como se indica en la guía. Si falta algún catálogo, podrás crearlo desde la previsualización. No se importa un vendedor individual: la condición de vendedor proviene del departamento.</p><Button variant="outline" size="sm" className="mt-3 gap-2" onClick={downloadEmployeeTemplate}><Download className="size-4" /> Descargar plantilla Excel</Button></div>
            <div className="space-y-2"><label className="text-xs font-bold text-muted-foreground">Archivo Excel de empleados</label><Input type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readEmployeeImportFile(file); }} />{importFileName && <p className="break-words text-xs text-muted-foreground">Archivo cargado: <b>{importFileName}</b> · {importRows.length} filas detectadas</p>}</div>
            <div className="rounded-xl border p-4 text-xs text-muted-foreground"><p className="font-bold text-foreground">Flujo de trabajo</p><ol className="mt-2 list-decimal space-y-1 pl-5"><li>Descarga la plantilla y completa los datos laborales.</li><li>Carga el archivo y abre la previsualización.</li><li>Corrige los errores; crea departamentos o puestos faltantes desde la misma fila.</li><li>Confirma escribiendo IMPORTAR. Las filas válidas se guardan aunque otras tengan incidencias.</li></ol></div>
          </div>
          <DialogFooter className="flex-wrap" data-tour="hr-employee-import-actions"><Button variant="outline" onClick={() => setImportOpen(false)}>Cerrar</Button>{importRows.length > 0 && <Button onClick={handleOpenImportPreview} disabled={previewLoading}>Previsualizar empleados</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Crear Departamento */}
      <Dialog open={showNewDeptModal} onOpenChange={setShowNewDeptModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader data-tour="hr-employee-department-title">
            <DialogTitle className="flex items-center gap-2"><Building2 className="size-5 text-primary" /> Nuevo Departamento</DialogTitle>
            <DialogDescription>Crea un nuevo departamento para asignar empleados</DialogDescription>
            <HRViewTutorial label="Cómo crear departamento" targetPrefix="hr-employee-department" copy={{ data: { description: 'Escribe el nombre del departamento que agregarás al catálogo.' }, actions: { description: 'Guarda el departamento para asignarlo al empleado.' } }} />
          </DialogHeader>
          <div className="space-y-4 py-4" data-tour="hr-employee-department-data">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nombre del Departamento</Label>
              <Input value={newDeptName} onChange={e => setNewDeptName(e.target.value)} placeholder="Ej: Marketing, Contabilidad..." className="rounded-xl" />
            </div>
          </div>
          <DialogFooter data-tour="hr-employee-department-actions">
            <Button variant="outline" onClick={() => setShowNewDeptModal(false)}>Cancelar</Button>
            <Button onClick={handleCreateDepartment} className="bg-primary text-primary-foreground">Crear Departamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Crear Puesto */}
      <Dialog open={showNewPosModal} onOpenChange={setShowNewPosModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader data-tour="hr-employee-position-title">
            <DialogTitle className="flex items-center gap-2"><Briefcase className="size-5 text-primary" /> Nuevo Puesto</DialogTitle>
            <DialogDescription>Crea un nuevo puesto de trabajo</DialogDescription>
            <HRViewTutorial label="Cómo crear puesto" targetPrefix="hr-employee-position" copy={{ data: { description: 'Define el título del puesto y el departamento al que pertenece.' }, actions: { description: 'Guarda el puesto para asignarlo al empleado.' } }} />
          </DialogHeader>
          <div className="space-y-4 py-4" data-tour="hr-employee-position-data">
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
          <DialogFooter data-tour="hr-employee-position-actions">
            <Button variant="outline" onClick={() => setShowNewPosModal(false)}>Cancelar</Button>
            <Button onClick={handleCreatePosition} className="bg-primary text-primary-foreground">Crear Puesto</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!departmentEditorEmployee} onOpenChange={(open) => { if (!open) setDepartmentEditorEmployee(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader data-tour="hr-employee-departments-title">
            <DialogTitle className="flex items-center gap-2"><Building2 className="size-5 text-primary" /> Departamentos del empleado</DialogTitle>
            <DialogDescription>
              {departmentEditorEmployee ? `${departmentEditorEmployee.firstName} ${departmentEditorEmployee.lastName} puede pertenecer a uno o varios departamentos. El principal se conserva para RR. HH.` : ''}
            </DialogDescription>
            <HRViewTutorial label="Cómo asignar departamentos" targetPrefix="hr-employee-departments" copy={{ data: { description: 'Selecciona uno o varios departamentos y define cuál será el principal.' }, actions: { description: 'Guarda los departamentos para actualizar el expediente y sus accesos.' } }} />
          </DialogHeader>
          <div className="space-y-4 py-4" data-tour="hr-employee-departments-data">
            <div className="flex flex-wrap gap-2">
              {departments.map((department: any) => {
                const selected = selectedDepartmentIds.includes(department.id);
                return <Button key={department.id} type="button" size="sm" variant={selected ? 'default' : 'outline'} className="h-9" onClick={() => toggleEmployeeDepartment(department.id)} aria-pressed={selected}>
                  {selected && <span className="mr-1">✓</span>}{department.name}
                </Button>;
              })}
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Departamento principal</Label>
              <Select value={primaryDepartmentId} onValueChange={setPrimaryDepartmentId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar principal" /></SelectTrigger>
                <SelectContent>
                  {departments.filter((department: any) => selectedDepartmentIds.includes(department.id)).map((department: any) => <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Si el empleado está vinculado a un usuario, los roles configurados para todos sus departamentos se sumarán a sus accesos.</p>
          </div>
          <DialogFooter data-tour="hr-employee-departments-actions">
            <Button variant="outline" onClick={() => setDepartmentEditorEmployee(null)}>Cancelar</Button>
            <Button onClick={() => void saveEmployeeDepartments()} disabled={savingDepartments || !selectedDepartmentIds.length}>{savingDepartments ? 'Guardando...' : 'Guardar departamentos'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog 
        open={pendingDeleteId !== null} 
        onOpenChange={open => { if (!open) setPendingDeleteId(null); }} 
        title="¿Anular empleado?"
        description="El empleado quedará inactivo y no aparecerá en selecciones futuras." 
        confirmLabel="Anular empleado"
        variant="destructive" 
        loading={deleteLoading} 
        onConfirm={() => pendingDeleteId ? handleDelete(pendingDeleteId) : Promise.resolve()} 
      />
      <Dialog open={rejectEmpId !== null} onOpenChange={(o) => { if (!o) { setRejectEmpId(null); setRejectReason(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader data-tour="hr-employee-reject-title"><DialogTitle>Rechazar Empleado</DialogTitle><DialogDescription>Indique el motivo del rechazo</DialogDescription><HRViewTutorial label="Cómo rechazar empleado" targetPrefix="hr-employee-reject" copy={{ data: { description: 'Registra el motivo que quedará asociado a la decisión.' }, actions: { description: 'Confirma el rechazo cuando la razón esté completa.' } }} /></DialogHeader>
          <div data-tour="hr-employee-reject-data"><Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Motivo del rechazo..." className="min-h-[100px]" /></div>
          <DialogFooter data-tour="hr-employee-reject-actions">
            <Button variant="outline" onClick={() => { setRejectEmpId(null); setRejectReason(''); }}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject}>Rechazar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showChangeLog} onOpenChange={setShowChangeLog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader data-tour="hr-employee-log-title"><DialogTitle className="flex items-center gap-2"><History className="size-5 text-primary" /> Historial de Cambios</DialogTitle><HRViewTutorial label="Cómo consultar historial" targetPrefix="hr-employee-log" stepKeys={['title', 'data']} copy={{ data: { description: 'Revisa los valores anteriores y nuevos de cada campo modificado.' } }} /></DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto" data-tour="hr-employee-log-data">
            {loadingChangeLog ? <p className="text-xs text-muted-foreground">Cargando...</p> : changeLog.length === 0 ? <p className="text-xs text-muted-foreground">Sin cambios registrados</p> : changeLog.map((log: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 text-xs">
                <History className="size-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-bold capitalize">{log.field}: <span className="text-muted-foreground font-normal">{log.oldValue || '(vacío)'}</span> → <span className="text-primary">{log.newValue || '(vacío)'}</span></p>
                  <p className="text-[10px] text-muted-foreground/60">{new Date(log.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <EmployeeDetailDrawer
        employeeId={detailEmployeeId}
        employeeSnapshot={employees.find((employee: any) => employee.id === detailEmployeeId) || null}
        onOpenChange={(open) => { if (!open) setDetailEmployeeId(null); }}
        onEdit={handleEdit}
        onManageDepartments={openDepartmentEditor}
        canEdit={canPerform('HR_EMPLOYEES', 'edit')}
      />
    </div>
  );
}

