import { useState } from 'react';
import { FileText, Plus, Check, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw, Umbrella, Search, CalendarRange } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent } from '../ui/card';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { cn } from '../ui/utils';
import { hrService } from '../../services/hr.service';
import { Combobox } from '../ui/Combobox';
import { useAuth } from '../../contexts/AuthContext';
import type { AbsenceType, VacationBalance } from '../../types';
import { PromptDialog } from '../ui/PromptDialog';
import { useQuery } from '@tanstack/react-query';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { formatDateEs } from '../../utils/dateFormat';
import { StatCard } from './StatCard';
import { HRViewTutorial } from './HRViewTutorial';
import { HRCreateViewShell } from './HRCreateViewShell';

const LEAVE_TYPE_LABELS: Record<string, string> = {
  VACATION: 'Vacaciones',
  SICK: 'Enfermedad',
  PERSONAL: 'Personal',
  MATERNITY: 'Maternidad',
  PATERNITY: 'Paternidad',
  UNPAID: 'Sin goce de sueldo',
  BEREAVEMENT: 'Duelo',
  OTHER: 'Otro',
};

const countWorkDays = (start: Date, end: Date) => {
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (cur.getDay() !== 0) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

export function AusenciasView({ leaveRequests, employees, onRefresh }: any) {
  const { canPerform, user } = useAuth();
  const canViewHr = canPerform('HR', 'view');
  const [showNewForm, setShowNewForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [newRequest, setNewRequest] = useState({
    employeeId: '',
    leaveType: 'VACATION',
    leaveTypeCustom: '',
    absenceTypeId: '',
    startDate: '',
    endDate: '',
    days: 1,
    reason: '',
  });

  const [pendingRejectId, setPendingRejectId] = useState<string | null>(null);

  const computedDays = newRequest.startDate && newRequest.endDate
    ? countWorkDays(new Date(newRequest.startDate), new Date(newRequest.endDate))
    : 1;

  const currentYear = new Date().getFullYear();
  const balanceQuery = useQuery({
    queryKey: ['hr', 'vacation-balance', newRequest.employeeId, currentYear],
    queryFn: ({ signal }) => hrService.getVacationBalance(newRequest.employeeId, currentYear, signal) as any,
    enabled: canViewHr && Boolean(newRequest.employeeId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const absenceTypesQuery = useQuery({
    queryKey: ['hr', 'absence-types'],
    queryFn: ({ signal }) => hrService.getAbsenceTypes(signal) as any,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: canViewHr,
  });
  const vacationBalance = (balanceQuery.data || null) as VacationBalance | null;
  const balanceLoading = balanceQuery.isFetching;
  const absenceTypes = (Array.isArray(absenceTypesQuery.data) ? absenceTypesQuery.data : absenceTypesQuery.data?.data || []) as AbsenceType[];
  const selectedAbsenceType = absenceTypes.find(at => at.id === newRequest.absenceTypeId) || null;

  const handleRecalcVacation = async () => {
    if (!newRequest.employeeId) return;
    try {
      await hrService.recalcVacationBalance(newRequest.employeeId, currentYear);
      await balanceQuery.refetch();
      toast.success('Saldo de vacaciones recalculado');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al recalcular');
    }
  };

  const handleCreateRequest = async () => {
    if (!newRequest.employeeId || !newRequest.startDate || !newRequest.endDate) {
      toast.error('Completa todos los campos requeridos');
      return;
    }
    if (computedDays < 1) {
      toast.error('El período seleccionado no tiene días hábiles');
      return;
    }

    const isVacation = newRequest.leaveType === 'VACATION';
    if (isVacation && vacationBalance) {
      const available = Number(vacationBalance.remainingDays) || 0;
      if (computedDays > available) {
        toast.error(`El empleado solo tiene ${available} días de vacaciones disponibles para ${currentYear}`);
        return;
      }
    }
    if (selectedAbsenceType && Number(selectedAbsenceType.maxDays ?? 0) > 0 && computedDays > Number(selectedAbsenceType.maxDays)) {
      toast.error(`El tipo "${selectedAbsenceType.name}" permite máximo ${selectedAbsenceType.maxDays} días`);
      return;
    }

    try {
      await hrService.createLeaveRequest({ ...newRequest, days: computedDays });
      toast.success('Solicitud creada');
      setShowNewForm(false);
      setNewRequest({
        employeeId: '',
        leaveType: 'VACATION',
        leaveTypeCustom: '',
        absenceTypeId: '',
        startDate: '',
        endDate: '',
        days: 1,
        reason: '',
      });
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al crear solicitud');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await hrService.approveLeaveRequest(id, user?.id || 'system');
      toast.success('Solicitud aprobada');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al aprobar solicitud');
    }
  };

  const handleReject = async (id: string) => {
    setPendingRejectId(id);
  };

  const confirmReject = async (rejectReason: string) => {
    if (!pendingRejectId) return;

    try {
      await hrService.rejectLeaveRequest(pendingRejectId, rejectReason);
      toast.success('Solicitud rechazada');
      setPendingRejectId(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al rechazar solicitud');
    }
  };

  const pendingRequests = leaveRequests.filter((r: any) => r.status === 'PENDING');
  const approvedRequests = leaveRequests.filter((r: any) => r.status === 'APPROVED');
  const rejectedRequests = leaveRequests.filter((r: any) => r.status === 'REJECTED');

  const colFilters = useColumnFilters();
  const employeeName = (r: any) => `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`.trim() || 'Sin empleado';
  const filterGetters = {
    employee: (r: any) => employeeName(r),
    leaveType: (r: any) => String(r.leaveType || ''),
    startDate: (r: any) => (r.startDate ? new Date(r.startDate).getTime() : null),
    status: (r: any) => String(r.status || ''),
  };

  const searchFiltered = leaveRequests.filter((r: any) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return employeeName(r).toLowerCase().includes(q)
      || (r.reason || '').toLowerCase().includes(q)
      || (LEAVE_TYPE_LABELS[r.leaveType] || r.leaveType || '').toLowerCase().includes(q);
  });
  const statusFiltered = statusFilter === 'ALL' ? searchFiltered : searchFiltered.filter((r: any) => r.status === statusFilter);
  const colFilteredRequests = colFilters.applyTo(statusFiltered, filterGetters);

  const employeeOptions = [...new Map(searchFiltered.map((r: any) => [employeeName(r), employeeName(r)])).entries()]
    .map(([, label]) => ({ value: label as string, label: label as string, count: searchFiltered.filter((r: any) => employeeName(r) === label).length }));
  const leaveTypeOptions = [...new Map(searchFiltered.map((r: any) => [String(r.leaveType || ''), LEAVE_TYPE_LABELS[r.leaveType] || r.leaveType])).entries()]
    .map(([value, label]) => ({ value: value as string, label: label as string, count: searchFiltered.filter((r: any) => String(r.leaveType || '') === value).length }));
  const statusOptionsForFilter = [
    { value: 'PENDING', label: 'Pendiente', count: searchFiltered.filter((r: any) => r.status === 'PENDING').length },
    { value: 'APPROVED', label: 'Aprobada', count: searchFiltered.filter((r: any) => r.status === 'APPROVED').length },
    { value: 'REJECTED', label: 'Rechazada', count: searchFiltered.filter((r: any) => r.status === 'REJECTED').length },
  ];

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE_OPTIONS = [10, 15, 25, 30, 35, 40, 45, 50];

  const totalPages = Math.max(1, Math.ceil(colFilteredRequests.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRequests = colFilteredRequests.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  const toggleStatus = (s: string) => {
    setStatusFilter(prev => (prev === s ? 'ALL' : s));
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className={cn('grid grid-cols-1 md:grid-cols-3 gap-4', showNewForm && 'hidden')} data-tour="hr-leaves-title">
        <StatCard
          label="Pendientes"
          value={pendingRequests.length}
          icon={FileText}
          tone="orange"
          sub="Por aprobar o rechazar"
          active={statusFilter === 'PENDING'}
          onClick={() => toggleStatus('PENDING')}
        />
        <StatCard
          label="Aprobadas"
          value={approvedRequests.length}
          icon={Check}
          tone="green"
          sub="Ausencias validadas"
          active={statusFilter === 'APPROVED'}
          onClick={() => toggleStatus('APPROVED')}
        />
        <StatCard
          label="Rechazadas"
          value={rejectedRequests.length}
          icon={X}
          tone="red"
          sub="Solicitudes denegadas"
          active={statusFilter === 'REJECTED'}
          onClick={() => toggleStatus('REJECTED')}
        />
      </div>

      {/* Vacation Balance */}
      {newRequest.employeeId && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/20 shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <Umbrella className="size-4" /> Vacaciones {currentYear}
                </h3>
                <Button size="sm" variant="outline" onClick={handleRecalcVacation} disabled={balanceLoading} className="h-8 text-xs rounded-xl gap-1">
                  <RefreshCw className={cn("size-3", balanceLoading && "animate-spin")} />
                  Recalcular
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Totales</p>
                  <p className="text-xl font-black text-primary">{vacationBalance?.totalDays ?? '—'}</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl border border-orange-200 dark:border-orange-800/30 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Usados</p>
                  <p className="text-xl font-black text-orange-600">{vacationBalance?.usedDays ?? '—'}</p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-200 dark:border-amber-800/30 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pendientes</p>
                  <p className="text-xl font-black text-amber-600">{vacationBalance?.pendingDays ?? '—'}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-xl border border-green-200 dark:border-green-800/30 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Disponibles</p>
                  <p className="text-xl font-black text-green-600">{vacationBalance?.remainingDays ?? '—'}</p>
                </div>
              </div>
              {newRequest.leaveType === 'VACATION' && computedDays > (vacationBalance?.remainingDays ?? Infinity) && (
                <p className="mt-3 text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 rounded-lg px-3 py-2">
                  Los días solicitados ({computedDays}) superan el saldo disponible ({vacationBalance?.remainingDays ?? 0}).
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Toolbar */}
      <div className={cn('flex flex-wrap items-center justify-between gap-3', showNewForm && 'hidden')} data-tour="hr-leaves-actions">
        <div className="flex min-w-0 flex-1 items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Buscar empleado, razón o tipo..."
              className="pl-8 h-9 w-56 bg-background"
            />
          </div>
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border transition-all',
                statusFilter === s ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              {s === 'ALL' ? 'Todas' : s === 'PENDING' ? 'Pendientes' : s === 'APPROVED' ? 'Aprobadas' : 'Rechazadas'}
            </button>
          ))}
        </div>
        <div className="flex w-full shrink-0 items-center justify-end gap-2 md:w-auto">
          {canPerform('HR_LEAVES', 'create') && (
            <Button onClick={() => setShowNewForm(!showNewForm)} className="h-10 shrink-0 gap-2 rounded-xl border border-primary/20 bg-primary px-4 text-[10px] font-black uppercase tracking-widest !text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90">
              <Plus className="size-4" />
              {showNewForm ? 'Cancelar' : 'Nueva Solicitud'}
            </Button>
          )}
          <HRViewTutorial label="Cómo gestionar ausencias" targetPrefix="hr-leaves" copy={{ data: { title: 'Solicitudes de ausencia', description: 'Consulta empleados, tipos, fechas, días, razones y estados de cada solicitud.' }, actions: { description: 'Crea una solicitud nueva o aprueba y rechaza las solicitudes según tus permisos.' } }} />
        </div>
      </div>

      {/* New Request Form */}
      {showNewForm && (
        <HRCreateViewShell
          title="Nueva solicitud de ausencia"
          description="Selecciona el empleado, el tipo de ausencia y el período para enviar la solicitud a revisión."
          onBack={() => setShowNewForm(false)}
        >
        <div className="space-y-1" data-tour="hr-leave-form-shell">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2" data-tour="hr-leave-form-title">
            <h3 className="text-lg font-semibold text-primary">Nueva Solicitud de Ausencia</h3>
            <HRViewTutorial label="Cómo crear solicitud de ausencia" targetPrefix="hr-leave-form" copy={{ data: { description: 'Selecciona empleado, tipo de ausencia, fechas, días y razón.' }, actions: { description: 'Guarda la solicitud para que pueda ser revisada y aprobada.' } }} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-tour="hr-leave-form-data">
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
              {absenceTypes.length > 0 ? (
                <Select value={newRequest.absenceTypeId} onValueChange={(v) => {
                  const selected = absenceTypes.find(at => at.id === v);
                  setNewRequest({ ...newRequest, absenceTypeId: v, leaveType: selected?.code === 'VAC' ? 'VACATION' : (selected ? 'OTHER' : newRequest.leaveType), leaveTypeCustom: selected ? selected.name : '' });
                }}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Seleccionar tipo de ausencia..." />
                  </SelectTrigger>
                  <SelectContent>
                    {absenceTypes.filter(at => at.isActive).map(at => (
                      <SelectItem key={at.id} value={at.id}>{at.code} - {at.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={newRequest.leaveType} onValueChange={(v) => setNewRequest({ ...newRequest, leaveType: v })}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {newRequest.leaveType === 'OTHER' && !newRequest.absenceTypeId && (
                <Input
                  placeholder="Especifica el tipo de ausencia..."
                  value={newRequest.leaveTypeCustom}
                  onChange={e => setNewRequest({...newRequest, leaveTypeCustom: e.target.value})}
                  className="mt-2 bg-background"
                />
              )}
              {selectedAbsenceType && Number(selectedAbsenceType.maxDays ?? 0) > 0 && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Máximo permitido: <strong>{selectedAbsenceType.maxDays} días</strong>
                  {selectedAbsenceType.requiresDoc && ' · Requiere documento'}
                </p>
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
              <label className="text-sm font-medium mb-1 block">Días hábiles (sin domingos)</label>
              <Input
                type="number"
                disabled
                value={computedDays}
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
          <div className="flex items-center gap-2 mt-4" data-tour="hr-leave-form-actions">
            <Button onClick={handleCreateRequest} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Crear Solicitud
            </Button>
            <Button variant="outline" onClick={() => setShowNewForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
        </HRCreateViewShell>
      )}

      {/* Leave Requests Table */}
      <div className={cn('border rounded-lg overflow-hidden flex flex-col', showNewForm && 'hidden')} data-tour="hr-leaves-data">
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full min-w-[900px]">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold"><span className="inline-flex items-center gap-1">Empleado<ColumnFilterMenu label="Empleado" options={employeeOptions} selected={colFilters.state.employee?.values || []} onSelect={(values) => colFilters.setValues('employee', values)} sort={colFilters.state.employee?.sort || null} onSort={(sort) => colFilters.setSort('employee', sort)} /></span></th>
                <th className="px-4 py-3 text-left text-xs font-semibold"><span className="inline-flex items-center gap-1">Tipo<ColumnFilterMenu label="Tipo" options={leaveTypeOptions} selected={colFilters.state.leaveType?.values || []} onSelect={(values) => colFilters.setValues('leaveType', values)} sort={colFilters.state.leaveType?.sort || null} onSort={(sort) => colFilters.setSort('leaveType', sort)} /></span></th>
                <th className="px-4 py-3 text-left text-xs font-semibold"><span className="inline-flex items-center gap-1">Fecha Inicio<ColumnFilterMenu label="Fecha Inicio" sort={colFilters.state.startDate?.sort || null} onSort={(sort) => colFilters.setSort('startDate', sort)} sortOptions={[{ value: 'desc', label: 'Más recientes' }, { value: 'asc', label: 'Más antiguas' }]} /></span></th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Fecha Fin</th>
                <th className="px-4 py-3 text-center text-xs font-semibold">Días</th>
                <th className="px-4 py-3 text-left text-xs font-semibold">Razón</th>
                <th className="px-4 py-3 text-left text-xs font-semibold"><span className="inline-flex items-center gap-1">Estado<ColumnFilterMenu label="Estado" options={statusOptionsForFilter} selected={colFilters.state.status?.values || []} onSelect={(values) => colFilters.setValues('status', values)} sort={colFilters.state.status?.sort || null} onSort={(sort) => colFilters.setSort('status', sort)} /></span></th>
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
                      {LEAVE_TYPE_LABELS[request.leaveType] || (request.leaveType === 'OTHER' ? request.leaveTypeCustom : 'Otro')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {formatDateEs(request.startDate)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {formatDateEs(request.endDate)}
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
                    {request.status === 'PENDING' && (canPerform('HR_LEAVES', 'approve') || canPerform('HR_LEAVES', 'delete')) && (
                      <div className="flex items-center justify-end gap-1">
                        {canPerform('HR_LEAVES', 'approve') && <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleApprove(request.id)}
                          className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <Check className="size-4" />
                        </Button>}
                        {canPerform('HR_LEAVES', 'delete') && <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReject(request.id)}
                          className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="size-4" />
                        </Button>}
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
                  <span className="font-semibold">{LEAVE_TYPE_LABELS[request.leaveType] || request.leaveTypeCustom || 'Otro'}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="bg-primary/5 p-2 rounded-lg border border-primary/10">
                    <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">Inicio</p>
                    <p className="font-bold text-sm">{formatDateEs(request.startDate)}</p>
                  </div>
                  <div className="bg-primary/5 p-2 rounded-lg border border-primary/10">
                    <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1">Fin</p>
                    <p className="font-bold text-sm">{formatDateEs(request.endDate)}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-border/50 pt-2">
                  <span className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">Duración</span>
                  <span className="font-bold bg-muted/50 px-2 py-1 rounded-md">{request.days ?? request.daysCount ?? 0} días</span>
                </div>
                {request.reason && (
                  <div className="text-xs border-t border-border/50 pt-2">
                    <span className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest block mb-1">Motivo</span>
                    <span className="font-medium text-muted-foreground bg-muted/30 p-2 rounded-lg block">{request.reason}</span>
                  </div>
                )}
              </div>

              {request.status === 'PENDING' && (canPerform('HR_LEAVES', 'approve') || canPerform('HR_LEAVES', 'delete')) && (
                <div className="flex items-center gap-2 pt-4 mt-2 border-t border-border/50">
                  {canPerform('HR_LEAVES', 'approve') && <Button size="sm" onClick={() => handleApprove(request.id)} className="flex-1 bg-green-700 hover:bg-green-800 text-white rounded-xl text-[11px] h-8">
                    <Check className="size-3 mr-1" /> Aprobar
                  </Button>}
                  {canPerform('HR_LEAVES', 'delete') && <Button size="sm" onClick={() => handleReject(request.id)} className="flex-1 bg-red-700 hover:bg-red-800 text-white rounded-xl text-[11px] h-8">
                    <X className="size-3 mr-1" /> Rechazar
                  </Button>}
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
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="h-8 rounded-lg border bg-background px-2 font-bold text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer">
                {PAGE_SIZE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <span>por página</span>
            </div>
            <div className="h-4 w-px bg-border/40 hidden sm:block" />
            <p className="bg-primary/5 px-3 py-1 rounded-full border border-primary/10">
              Mostrando <span className="text-foreground font-black">{colFilteredRequests.length === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1} - {Math.min(safeCurrentPage * pageSize, colFilteredRequests.length)}</span> de <span className="text-primary font-black">{colFilteredRequests.length}</span> registros totales
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(1)} disabled={safeCurrentPage === 1} className="p-2 rounded-lg border hover:bg-muted disabled:opacity-30 transition-all"><ChevronsLeft className="size-4" /></button>
            <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={safeCurrentPage === 1} className="p-2 rounded-lg border hover:bg-muted disabled:opacity-30 transition-all"><ChevronLeft className="size-4" /></button>
            <div className="flex items-center px-4 h-9 rounded-lg border bg-muted/30 font-black text-xs">
              Pág. {safeCurrentPage} / {totalPages}
            </div>
            <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={safeCurrentPage === totalPages} className="p-2 rounded-lg border hover:bg-muted disabled:opacity-30 transition-all"><ChevronRight className="size-4" /></button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={safeCurrentPage === totalPages} className="p-2 rounded-lg border hover:bg-muted disabled:opacity-30 transition-all"><ChevronsRight className="size-4" /></button>
          </div>
        </div>
      )}

      {leaveRequests.length === 0 && (
        <div className="text-center py-12">
          <CalendarRange className="size-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No hay solicitudes de ausencia</p>
        </div>
      )}
      <PromptDialog
        open={Boolean(pendingRejectId)}
        onOpenChange={open => { if (!open) setPendingRejectId(null); }}
        title="Rechazar solicitud"
        description="Indica la razón que se mostrará en el historial de la solicitud."
        label="Razón del rechazo"
        placeholder="Escribe la razón…"
        confirmLabel="Rechazar"
        onConfirm={confirmReject}
      />
    </div>
  );
}
