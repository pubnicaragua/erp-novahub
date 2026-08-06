import React from 'react';
import { useState } from 'react';
import { Plus, Search, Filter, Grid, List, Edit2, Trash2, Save, X, Building2, Briefcase, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CircleHelp, Send, CheckCircle2, XCircle, History, Ban, Download, Upload } from 'lucide-react';
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
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import { Textarea } from '../ui/textarea';
import { EmployeeImportPreview, type EmployeeImportResult, type EmployeeImportRow } from './EmployeeImportPreview';

export function EmpleadosView({ employees, departments, positions, onRefresh, isSidebarCollapsed = false }: any) {
  const { canPerform } = useAuth();
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [newRows, setNewRows] = useState<any[]>([]);

  const [showNewDeptModal, setShowNewDeptModal] = useState(false);
  const [showNewPosModal, setShowNewPosModal] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newPosTitle, setNewPosTitle] = useState('');
  const [newPosDeptId, setNewPosDeptId] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [rejectEmpId, setRejectEmpId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [changeLog, setChangeLog] = useState<any[]>([]);
  const [showChangeLog, setShowChangeLog] = useState(false);
  const [loadingChangeLog, setLoadingChangeLog] = useState(false);
  const [departmentEditorEmployee, setDepartmentEditorEmployee] = useState<any | null>(null);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);
  const [primaryDepartmentId, setPrimaryDepartmentId] = useState<string>('');
  const [savingDepartments, setSavingDepartments] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importRows, setImportRows] = useState<EmployeeImportRow[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<EmployeeImportResult | null>(null);
  const [pendingImportDepartmentRow, setPendingImportDepartmentRow] = useState<number | null>(null);
  const [pendingImportPositionRow, setPendingImportPositionRow] = useState<number | null>(null);

const EMPLEADOS_TOUR_STEPS: GuidedTourStep[] = [
  {
    target: '[data-tour="empleados-search"]',
    title: 'Buscar y Filtrar',
    description: 'Usa la barra de búsqueda para encontrar empleados por nombre o apellido. Puedes filtrar por departamento y estado (activo/inactivo).',
    tip: 'La búsqueda es en tiempo real, no necesitas presionar Enter.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="empleados-add"]',
    title: 'Agregar Empleado',
    description: 'Registra un nuevo empleado con todos sus datos personales, información laboral y documentos asociados.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="empleados-table"]',
    title: 'Listado de Empleados',
    description: 'Tabla completa con todos los empleados registrados. Puedes editar, ver detalles o eliminar usando los botones de acción en cada fila.',
    placement: 'top',
  },
];

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
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleCreateDepartment = async () => {
    if (!newDeptName.trim()) { toast.error('Ingresa un nombre'); return; }
    try {
      const code = newDeptName.trim().replace(/\s+/g, '').substring(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 10000);
      const createdDepartment: any = await hrService.createDepartment({ name: newDeptName.trim(), code });
      const importRowIndex = pendingImportDepartmentRow;
      if (importRowIndex !== null && createdDepartment?.id) {
        setImportRows((current) => validateEmployeeImportRows(current.map((row, index) => index === importRowIndex ? { ...row, department: createdDepartment.name, departmentId: createdDepartment.id, positionId: '' } : row)));
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
      }
      toast.success('Puesto creado');
      setNewPosTitle('');
      setNewPosDeptId('');
      setShowNewPosModal(false);
      setPendingImportPositionRow(null);
      onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al crear puesto'); }
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
        nationalId: editData.nationalId?.trim() || null,
        socialSecurityNumber: editData.socialSecurityNumber?.trim() || null,
        probationEndDate: editData.probationEndDate || null,
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

  const normalizeContractType = (value: unknown) => {
    const normalized = normalizeImportText(value);
    if (!normalized) return 'FULL_TIME';
    if (normalized.includes('medio') || normalized.includes('part')) return 'PART_TIME';
    if (normalized.includes('contrat') || normalized.includes('contract')) return 'CONTRACTOR';
    if (normalized.includes('pas') || normalized.includes('intern')) return 'INTERN';
    if (normalized.includes('temp')) return 'TEMPORARY';
    if (normalized.includes('completo') || normalized.includes('full')) return 'FULL_TIME';
    return String(value).trim().toUpperCase();
  };

  const normalizeImportStatus = (value: unknown) => {
    const normalized = normalizeImportText(value);
    if (!normalized || normalized.includes('activ')) return 'ACTIVE';
    if (normalized.includes('inactiv')) return 'INACTIVE';
    if (normalized.includes('ausenc') || normalized.includes('leave')) return 'ON_LEAVE';
    if (normalized.includes('termin')) return 'TERMINATED';
    return String(value).trim().toUpperCase();
  };

  const validateEmployeeImportRows = (rows: EmployeeImportRow[]) => {
    const existingNumbers = new Set(employees.map((employee: any) => String(employee.employeeNumber || '').trim().toLowerCase()).filter(Boolean));
    const existingEmails = new Set(employees.map((employee: any) => String(employee.email || '').trim().toLowerCase()).filter(Boolean));
    const seenNumbers = new Set<string>();
    const seenEmails = new Set<string>();
    const contractValues = ['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'INTERN', 'TEMPORARY'];
    const statusValues = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED'];

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
      const salary = row.salary === '' || row.salary === null || row.salary === undefined ? NaN : Number(row.salary);
      const errors = [
        !number ? 'Número de empleado obligatorio' : existingNumbers.has(number.toLowerCase()) || seenNumbers.has(number.toLowerCase()) ? 'Número de empleado duplicado' : '',
        !String(row.firstName || '').trim() ? 'Nombres obligatorios' : '',
        !String(row.lastName || '').trim() ? 'Apellidos obligatorios' : '',
        !email || !/^\S+@\S+\.\S+$/.test(email) ? 'Correo inválido' : existingEmails.has(email) || seenEmails.has(email) ? 'Correo duplicado' : '',
        !row.hireDate || Number.isNaN(new Date(row.hireDate).getTime()) ? 'Fecha de contratación inválida' : '',
        !departmentExists ? 'Departamento no encontrado' : '',
        !positionExists ? 'Puesto no encontrado' : '',
        positionMatch && departmentId && String(positionMatch.departmentId) !== String(departmentId) ? 'El puesto no pertenece al departamento' : '',
        !contractValues.includes(String(row.contractType || '').toUpperCase()) ? 'Tipo de contrato inválido' : '',
        !Number.isFinite(salary) || salary < 0 ? 'Salario inválido' : '',
        !['NIO', 'USD'].includes(String(row.currency || '').toUpperCase()) ? 'Moneda inválida' : '',
        !statusValues.includes(String(row.employmentStatus || '').toUpperCase()) ? 'Estado inválido' : '',
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
      return next;
    });
  };

  const downloadEmployeeTemplate = () => {
    const headers = ['Número de empleado', 'Nombres', 'Apellidos', 'Correo', 'Teléfono', 'Fecha de nacimiento', 'Fecha de contratación', 'Departamento', 'Puesto', 'Tipo de contrato', 'Salario', 'Moneda', 'Dirección', 'Ciudad', 'Estado/Provincia', 'País', 'Código postal', 'Contacto de emergencia', 'Teléfono de emergencia', 'Cédula', 'Número de seguro social', 'Fin de prueba', 'Frecuencia de pago', 'Estado', 'Notas'];
    const sampleDepartment = departments[0]?.name || 'Ventas';
    const samplePosition = positions.find((position: any) => position.departmentId === departments[0]?.id)?.title || 'Ejecutivo de ventas';
    const example = ['EMP0001', 'Ana', 'Gómez', 'ana.gomez@empresa.com', '8888-8888', '1990-05-12', new Date().toISOString().slice(0, 10), sampleDepartment, samplePosition, 'FULL_TIME', 15000, 'NIO', 'Dirección del empleado', 'Managua', 'Managua', 'Nicaragua', '', 'Persona de contacto', '8888-0000', '', '', '', 'MONTHLY', 'ACTIVE', ''];
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
      ['Tipo de contrato', 'Usa FULL_TIME, PART_TIME, CONTRACTOR, INTERN o TEMPORARY.'],
      ['Salario y moneda', 'El salario debe ser numérico y mayor o igual a cero. Monedas soportadas en esta vista: NIO y USD.'],
      ['Estado', 'Usa ACTIVE, INACTIVE, ON_LEAVE o TERMINATED.'],
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
    try {
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('Selecciona un archivo Excel o CSV válido');
      const workbook = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
      const sheetName = workbook.SheetNames.find((name) => normalizeImportHeader(name) === 'empleados') || workbook.SheetNames[0];
      const raw = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[sheetName], { header: 1, defval: '' });
      if (raw.length < 2) throw new Error('El archivo no contiene filas para importar');
      const headers = (raw[0] || []).map(normalizeImportHeader);
      const aliases: Record<string, string[]> = {
        employeeNumber: ['numero de empleado', 'numero empleado', 'codigo empleado', 'employee number', 'employee code', 'codigo'],
        firstName: ['nombres', 'nombre', 'first name', 'firstname'], lastName: ['apellidos', 'apellido', 'last name', 'lastname'],
        email: ['correo', 'correo electronico', 'email'], phone: ['telefono', 'phone'], dateOfBirth: ['fecha de nacimiento', 'nacimiento', 'date of birth'],
        hireDate: ['fecha de contratacion', 'fecha ingreso', 'fecha de ingreso', 'hire date'], department: ['departamento', 'department'], position: ['puesto', 'cargo', 'posicion', 'position'],
        contractType: ['tipo de contrato', 'contrato', 'contract type'], salary: ['salario', 'sueldo', 'salary'], currency: ['moneda', 'currency'], address: ['direccion', 'address'], city: ['ciudad', 'city'], state: ['estado provincia', 'estado', 'provincia', 'state'], country: ['pais', 'country'], postalCode: ['codigo postal', 'postal code', 'zip code'], emergencyContact: ['contacto de emergencia', 'emergency contact'], emergencyPhone: ['telefono de emergencia', 'emergency phone'], nationalId: ['cedula', 'identificacion', 'national id'], socialSecurityNumber: ['numero de seguro social', 'seguro social', 'inss', 'social security number'], probationEndDate: ['fin de prueba', 'fecha fin prueba', 'probation end date'], payFrequency: ['frecuencia de pago', 'frecuencia pago', 'pay frequency'], employmentStatus: ['estado laboral', 'estado', 'status'], notes: ['notas', 'observaciones', 'notes'],
      };
      const colMap: Record<string, number> = {};
      Object.entries(aliases).forEach(([key, options]) => { const index = headers.findIndex((header: string) => options.includes(header)); if (index >= 0) colMap[key] = index; });
      const getValue = (values: any[], key: string) => colMap[key] === undefined ? '' : values[colMap[key]] ?? '';
      const parsed = raw.slice(1).filter((row: any[]) => row.some((cell) => String(cell ?? '').trim())).map((values: any[], index) => {
        const row = emptyEmployeeImportRow(index + 2);
        row.employeeNumber = String(getValue(values, 'employeeNumber')).trim(); row.firstName = String(getValue(values, 'firstName')).trim(); row.lastName = String(getValue(values, 'lastName')).trim(); row.email = String(getValue(values, 'email')).trim(); row.phone = String(getValue(values, 'phone')).trim();
        row.dateOfBirth = normalizeImportDate(getValue(values, 'dateOfBirth')); row.hireDate = normalizeImportDate(getValue(values, 'hireDate')); row.department = String(getValue(values, 'department')).trim(); row.position = String(getValue(values, 'position')).trim(); row.contractType = normalizeContractType(getValue(values, 'contractType')); row.salary = getValue(values, 'salary') === '' ? '' : Number(getValue(values, 'salary')); row.currency = String(getValue(values, 'currency') || 'NIO').trim().toUpperCase(); row.address = String(getValue(values, 'address')).trim(); row.city = String(getValue(values, 'city')).trim(); row.state = String(getValue(values, 'state')).trim(); row.country = String(getValue(values, 'country') || 'Nicaragua').trim(); row.postalCode = String(getValue(values, 'postalCode')).trim(); row.emergencyContact = String(getValue(values, 'emergencyContact')).trim(); row.emergencyPhone = String(getValue(values, 'emergencyPhone')).trim(); row.nationalId = String(getValue(values, 'nationalId')).trim(); row.socialSecurityNumber = String(getValue(values, 'socialSecurityNumber')).trim(); row.probationEndDate = normalizeImportDate(getValue(values, 'probationEndDate')); row.payFrequency = String(getValue(values, 'payFrequency') || 'MONTHLY').trim().toUpperCase(); row.employmentStatus = normalizeImportStatus(getValue(values, 'employmentStatus')); row.notes = String(getValue(values, 'notes')).trim();
        return row;
      });
      setImportFileName(file.name);
      setImportRows(validateEmployeeImportRows(parsed));
      setImportResult(null);
      toast.success(`${parsed.length} empleados listos para previsualizar`);
    } catch (error: any) {
      setImportFileName(''); setImportRows([]); toast.error(error?.message || 'No se pudo leer el archivo');
    }
  };

  const updateEmployeeImportRow = (index: number, field: string, value: string | number) => {
    setImportRows((current) => validateEmployeeImportRows(current.map((row, rowIndex) => {
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
    })));
  };

  const downloadEmployeeImportErrors = () => {
    const incidents = importRows.filter((row) => row._hasError || row._hasWarning).map((row) => ({
      'Fila Excel': row.sourceRow, 'Número de empleado': row.employeeNumber, Nombres: row.firstName, Apellidos: row.lastName,
      Correo: row.email, Departamento: row.department, Puesto: row.position, Clasificación: row._hasError ? 'Error' : 'Advertencia',
      Detalle: row._errorMessage || row._warningMessage || 'Revisar fila',
    }));
    if (!incidents.length) return;
    const sheet = XLSX.utils.json_to_sheet(incidents);
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, 'Incidencias'); XLSX.writeFile(workbook, 'incidencias_importacion_empleados.xlsx');
    toast.success('Reporte de incidencias descargado');
  };

  const executeEmployeeImport = async () => {
    const validRows = importRows.filter((row) => !row._hasError);
    if (!validRows.length) return;
    setImporting(true); setImportProgress(8); setImportResult(null);
    const timer = window.setInterval(() => setImportProgress((current) => Math.min(92, current + 3)), 180);
    try {
      const response: any = await hrService.bulkImportEmployees(validRows.map((row) => ({
        sourceRow: row.sourceRow, employeeNumber: row.employeeNumber.trim(), firstName: row.firstName.trim(), lastName: row.lastName.trim(), email: row.email.trim(), phone: row.phone.trim() || undefined, dateOfBirth: row.dateOfBirth || undefined, hireDate: row.hireDate, departmentId: row.departmentId, positionId: row.positionId, contractType: row.contractType, salary: Number(row.salary), currency: row.currency, address: row.address || undefined, city: row.city || undefined, state: row.state || undefined, country: row.country || undefined, postalCode: row.postalCode || undefined, emergencyContact: row.emergencyContact || undefined, emergencyPhone: row.emergencyPhone || undefined, nationalId: row.nationalId || undefined, socialSecurityNumber: row.socialSecurityNumber || undefined, probationEndDate: row.probationEndDate || undefined, payFrequency: row.payFrequency || 'MONTHLY', employmentStatus: row.employmentStatus || 'ACTIVE', notes: row.notes || undefined,
      })));
      const result = response?.data || response;
      setImportProgress(100);
      setImportResult({ total: result?.total ?? validRows.length, created: result?.created ?? result?.success ?? 0, skipped: (importRows.length - validRows.length) + (result?.skipped ?? result?.failed ?? 0), errors: result?.errors || [], warnings: result?.warnings || [] });
      await onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo importar empleados');
    } finally {
      window.clearInterval(timer); setImporting(false); setImportProgress(0);
    }
  };

  const finishEmployeeImport = () => { setImportResult(null); setImportPreviewOpen(false); setImportRows([]); setImportFileName(''); };
  const createDepartmentFromImport = async (index: number, name: string) => {
    try {
      const code = name.trim().replace(/\s+/g, '').substring(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 10000);
      const createdDepartment: any = await hrService.createDepartment({ name: name.trim(), code });
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
      nationalId: '',
      socialSecurityNumber: '',
      probationEndDate: '',
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
        nationalId: row.nationalId?.trim() || null,
        socialSecurityNumber: row.socialSecurityNumber?.trim() || null,
        probationEndDate: row.probationEndDate || null,
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}>
            {viewMode === 'table' ? <Grid className="size-4" /> : <List className="size-4" />}
          </Button>
          {canPerform('HR_EMPLOYEES', 'create') && (
            <Button size="sm" onClick={handleAddRow} className="bg-primary hover:bg-primary/90 !text-primary-foreground" data-tour="empleados-add">
              <Plus className="size-4 mr-2" />
              Agregar Empleado
            </Button>
          )}
          {canPerform('HR_EMPLOYEES', 'create') && (
            <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="size-4 mr-2" />
              Importar Excel
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => setShowTutorial(true)} aria-label="Tutorial">
            <CircleHelp className="size-3.5 mr-1" /> Tutorial
          </Button>
        </div>
      </div>

      {/* Table View - Desktop Only */}
      <div data-tour="empleados-table" className={`border rounded-lg overflow-hidden ${viewMode === 'table' ? 'hidden md:block' : 'hidden'}`}>
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
                  <th className="px-4 py-3 text-left text-xs font-semibold">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold">Auth</th>
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
                            {positions.map((pos: any) => (
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
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-bold">Nuevo</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="text-xs text-muted-foreground">—</span>
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
                    <td className="px-4 py-2 text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{emp.department?.name}</span>
                        {canPerform('HR_EMPLOYEES', 'edit') && (
                          <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={() => openDepartmentEditor(emp)} title="Gestionar departamentos">
                            <Building2 className="size-3.5 text-primary" />
                          </Button>
                        )}
                      </div>
                    </td>
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
                          <CurrencyValuationAmount amount={Number(emp.salary || 0)} sourceCurrency={emp.currency || 'USD'} sourceExchangeRate={emp.exchangeRate} className="text-sm font-bold text-primary" />
                          <span className="text-[9px] text-muted-foreground uppercase font-black">Original: {emp.currency}</span>
                        </div>
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
                      {(() => {
                        const opts: Record<string, {label:string,color:string}> = {APPROVED:{label:'Aprobado',color:'bg-emerald-500/10 text-emerald-500'},PENDING_APPROVAL:{label:'Pendiente',color:'bg-amber-500/10 text-amber-500'},REJECTED:{label:'Rechazado',color:'bg-rose-500/10 text-rose-500'},DRAFT:{label:'Borrador',color:'bg-muted/20 text-muted-foreground'}};
                        const s = opts[String(emp.approvalStatus||'APPROVED').toUpperCase()] || opts.APPROVED;
                        return <Badge variant="outline" className={cn('text-[8px] font-black uppercase px-1.5 py-0 border-none', s.color)}>{s.label}</Badge>;
                      })()}
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
                            {canPerform('HR_EMPLOYEES', 'edit') && (
                              <Button size="sm" variant="ghost" onClick={() => handleEdit(emp)} className="h-7 px-2">
                                <Edit2 className="size-3" />
                              </Button>
                            )}
                            {emp.approvalStatus === 'DRAFT' && (
                              <Button title="Enviar a aprobación" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-amber-500/10 hover:text-amber-500" onClick={(e) => { e.stopPropagation(); handleSubmitApproval(emp.id); }}>
                                <Send className="size-4" />
                              </Button>
                            )}
                            {emp.approvalStatus === 'PENDING_APPROVAL' && canPerform('HR_EMPLOYEES', 'edit') && (
                              <>
                                <Button title="Aprobar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-emerald-500/10 hover:text-emerald-500" onClick={(e) => { e.stopPropagation(); handleApprove(emp.id); }}>
                                  <CheckCircle2 className="size-4" />
                                </Button>
                                <Button title="Rechazar" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-rose-500/10 hover:text-rose-500" onClick={(e) => { e.stopPropagation(); setRejectEmpId(emp.id); }}>
                                  <XCircle className="size-4" />
                                </Button>
                              </>
                            )}
                            <Button title="Historial de cambios" variant="ghost" size="icon" className="size-8 rounded-lg hover:bg-blue-500/10 hover:text-blue-500" onClick={(e) => { e.stopPropagation(); loadChangeLog(emp.id); }}>
                              <History className="size-4" />
                            </Button>
                            {canPerform('HR_EMPLOYEES', 'delete') && (
                              <Button size="sm" variant="ghost" title="Desactivar" onClick={() => setPendingDeleteId(emp.id)} className="h-7 px-2 text-red-600">
                                <Ban className="size-3" />
                              </Button>
                            )}
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
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Departamento:</span>
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="truncate font-medium">{emp.department?.name}</span>
                    {canPerform('HR_EMPLOYEES', 'edit') && <Button size="icon" variant="ghost" className="size-7 shrink-0" onClick={() => openDepartmentEditor(emp)} title="Gestionar departamentos"><Building2 className="size-3.5 text-primary" /></Button>}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Puesto:</span>
                  <span className="font-medium">{emp.position?.title}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Salario:</span>
                  <div className="flex flex-col items-end">
                    <CurrencyValuationAmount amount={Number(emp.salary || 0)} sourceCurrency={emp.currency || 'USD'} sourceExchangeRate={emp.exchangeRate} className="font-bold text-primary" />
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">Contrato: {emp.currency}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/40 relative z-10">
                {canPerform('HR_EMPLOYEES', 'edit') && (
                  <Button size="sm" variant="outline" onClick={() => handleCardEdit(emp)} className="flex-1 rounded-xl transition-all hover:bg-primary/10 hover:text-primary hover:border-primary/30">
                    <Edit2 className="size-3 mr-1" />
                    Editar
                  </Button>
                )}
                {canPerform('HR_EMPLOYEES', 'delete') && (
                  <Button size="sm" variant="outline" title="Desactivar" onClick={() => setPendingDeleteId(emp.id)} className="text-red-600 rounded-xl hover:bg-red-500/10 hover:border-red-500/30 transition-all">
                    <Ban className="size-3" />
                  </Button>
                )}
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

      <Dialog open={importOpen} onOpenChange={(open) => { if (!open && !importing) setImportOpen(false); }}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Upload className="size-4" /> Importar empleados</DialogTitle><DialogDescription>Carga una plantilla Excel, revisa la previsualización y confirma solo las filas válidas. Este proceso puede repetirse cuantas veces sea necesario.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-4 text-xs text-muted-foreground"><p className="font-black uppercase tracking-widest text-foreground">Antes de cargar</p><p className="mt-2">Usa nombres o códigos existentes para departamentos y puestos. Si falta alguno, podrás crearlo desde la previsualización. No se importa un vendedor individual: la condición de vendedor proviene del departamento.</p><Button variant="outline" size="sm" className="mt-3 gap-2" onClick={downloadEmployeeTemplate}><Download className="size-4" /> Descargar plantilla Excel</Button></div>
            <div className="space-y-2"><label className="text-xs font-bold text-muted-foreground">Archivo Excel de empleados</label><Input type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readEmployeeImportFile(file); }} />{importFileName && <p className="break-words text-xs text-muted-foreground">Archivo cargado: <b>{importFileName}</b> · {importRows.length} filas detectadas</p>}</div>
            <div className="rounded-xl border p-4 text-xs text-muted-foreground"><p className="font-bold text-foreground">Flujo de trabajo</p><ol className="mt-2 list-decimal space-y-1 pl-5"><li>Descarga la plantilla y completa los datos laborales.</li><li>Carga el archivo y abre la previsualización.</li><li>Corrige los errores; crea departamentos o puestos faltantes desde la misma fila.</li><li>Confirma escribiendo IMPORTAR. Las filas válidas se guardan aunque otras tengan incidencias.</li></ol></div>
          </div>
          <DialogFooter className="flex-wrap"><Button variant="outline" onClick={() => setImportOpen(false)}>Cerrar</Button>{importRows.length > 0 && <Button onClick={() => { setImportOpen(false); setImportPreviewOpen(true); }}>Previsualizar empleados</Button>}</DialogFooter>
        </DialogContent>
      </Dialog>

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

      <Dialog open={!!departmentEditorEmployee} onOpenChange={(open) => { if (!open) setDepartmentEditorEmployee(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Building2 className="size-5 text-primary" /> Departamentos del empleado</DialogTitle>
            <DialogDescription>
              {departmentEditorEmployee ? `${departmentEditorEmployee.firstName} ${departmentEditorEmployee.lastName} puede pertenecer a uno o varios departamentos. El principal se conserva para RR. HH.` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepartmentEditorEmployee(null)}>Cancelar</Button>
            <Button onClick={() => void saveEmployeeDepartments()} disabled={savingDepartments || !selectedDepartmentIds.length}>{savingDepartments ? 'Guardando...' : 'Guardar departamentos'}</Button>
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
              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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
        title="¿Desactivar Empleado?" 
        description="El empleado quedará inactivo y no aparecerá en selecciones futuras." 
        confirmLabel="Desactivar" 
        variant="destructive" 
        loading={deleteLoading} 
        onConfirm={() => pendingDeleteId ? handleDelete(pendingDeleteId) : Promise.resolve()} 
      />
      <Dialog open={rejectEmpId !== null} onOpenChange={(o) => { if (!o) { setRejectEmpId(null); setRejectReason(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Rechazar Empleado</DialogTitle><DialogDescription>Indique el motivo del rechazo</DialogDescription></DialogHeader>
          <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Motivo del rechazo..." className="min-h-[100px]" />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectEmpId(null); setRejectReason(''); }}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject}>Rechazar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={showChangeLog} onOpenChange={setShowChangeLog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="size-5 text-primary" /> Historial de Cambios</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
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
      {showTutorial && <GuidedTour steps={EMPLEADOS_TOUR_STEPS} onClose={() => setShowTutorial(false)} title="Empleados" />}
    </div>
  );
}

