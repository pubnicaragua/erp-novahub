import { cn } from './ui/utils';
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { motion } from 'motion/react';
import {
  Users,
  DollarSign,
  Calendar,
  Award,
  GraduationCap,
  UserCheck,
  BarChart3,
  HandHeart,
  Settings2,
  Building2,
  BadgePercent,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { hrService } from '../services/hr.service';
import { useAuth } from '../contexts/AuthContext';
import { DashboardHRView } from './hr/DashboardHRView';
import { EmpleadosView } from './hr/EmpleadosView';
import { DepartamentosView } from './hr/DepartamentosView';
import { NominasView } from './hr/NominasView';
import { AsistenciaView } from './hr/AsistenciaView';
import { AusenciasView } from './hr/AusenciasView';
import { AusenciasConfigView } from './hr/AusenciasConfigView';
import { KpiView } from './hr/KpiView';
import { EvaluacionesView } from './hr/EvaluacionesView';
import { CapacitacionesView } from './hr/CapacitacionesView';
import { BeneficiosView } from './hr/BeneficiosView';
import { ConfigNominaView } from './hr/ConfigNominaView';
import { ComisionesView } from './hr/ComisionesView';
import { CurrencyValuationBanner } from './ui/CurrencyValuation';
import { ExportMenu } from './ui/ExportMenu';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { fetchAllReportPages } from '../hooks/useTenantQuery';
import { getNotificationDomainQueryKeys, type NotificationDomainRefreshDetail } from '../services/notification-domain-refresh';
import { generateConfiguredReportSectionsPDF } from '../utils/pdfGenerator';
import { createReportWorkbook } from '../utils/reportWorkbook';
import { buildDatedDownloadFileName } from '../utils/exportFileNames';
import { toast } from '../services/toast';

interface RecursosHumanosPageProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
  onSubModuleChange?: (subModule?: string) => void;
}

const HR_EXPORT_TARGETS: Record<string, { targetKey: string; label: string; permission: string }> = {
  dashboard: { targetKey: 'recursos-humanos.dashboard', label: 'Dashboard de RR. HH.', permission: 'HR_DASHBOARD' },
  empleados: { targetKey: 'recursos-humanos.employees', label: 'Directorio de empleados', permission: 'HR_EMPLOYEES' },
  departamentos: { targetKey: 'recursos-humanos.departments', label: 'Departamentos y cargos', permission: 'HR_EMPLOYEES' },
  asistencia: { targetKey: 'recursos-humanos.attendance', label: 'Asistencia', permission: 'HR_ATTENDANCE' },
  ausencias: { targetKey: 'recursos-humanos.leave', label: 'Vacaciones y ausencias', permission: 'HR_LEAVES' },
  evaluaciones: { targetKey: 'recursos-humanos.performance', label: 'Evaluaciones de desempeño', permission: 'HR_PERFORMANCE' },
  kpi: { targetKey: 'recursos-humanos.kpi', label: 'Indicadores de RR. HH.', permission: 'HR_PERFORMANCE' },
  capacitaciones: { targetKey: 'recursos-humanos.training', label: 'Capacitaciones', permission: 'HR_TRAINING' },
  beneficios: { targetKey: 'recursos-humanos.benefits', label: 'Beneficios', permission: 'HR_BENEFITS' },
};

const exportDate = (value: unknown) => {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('es-NI');
};

const responseRows = (value: any): any[] => Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : [];

export function RecursosHumanosPage({ activeSubModule, onSubModuleChange, isSidebarCollapsed}: RecursosHumanosPageProps) {
  const { user, canPerform } = useAuth();
  const canReadHr = canPerform('HR', 'view');
  const queryClient = useQueryClient();
  
  // Map sidebar submodule IDs to tab values
  const subModuleToTab: Record<string, string> = {
    'dashboard-hr': 'dashboard',
    'empleados': 'empleados',
    'departamentos': 'departamentos',
    'nominas': 'nominas',
    'comisiones': 'comisiones',
    'config-nomina': 'config-nomina',
    'asistencia': 'asistencia',
    'ausencias': 'ausencias',
    'ausencias-config': 'ausencias-config',
    'evaluaciones': 'evaluaciones',
    'kpi': 'kpi',
    'capacitaciones': 'capacitaciones',
    'beneficios': 'beneficios',
  };
  
  const [activeTab, setActiveTab] = useState(() => 
    activeSubModule ? (subModuleToTab[activeSubModule] || 'dashboard') : 'dashboard'
  );
  
  // Sync tab when activeSubModule changes from sidebar
  useEffect(() => {
    if (activeSubModule && subModuleToTab[activeSubModule]) {
      if (activeTab !== subModuleToTab[activeSubModule]) {
        setActiveTab(subModuleToTab[activeSubModule]);
      }
    }
  }, [activeSubModule, activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    
    // Find the reverse mapping to update sidebar
    const subModule = Object.keys(subModuleToTab).find(key => subModuleToTab[key] === value) || value;
    if (onSubModuleChange) {
      onSubModuleChange(subModule);
    }
  };

  const hrQuery = useQuery({
    queryKey: ['hr', activeTab],
    queryFn: async ({ signal }) => {
      const page = { page: 1, pageSize: 200 };
      switch (activeTab) {
        case 'dashboard': {
          const reportFilters = { pageSize: 5000, report: true };
          const [stats, employees, departments, leaveRequests, reviews] = await Promise.all([
            hrService.getDashboardStats(signal),
            fetchAllReportPages((filters) => hrService.getEmployees(filters, signal), reportFilters, signal),
            hrService.getDepartments(signal),
            fetchAllReportPages((filters) => hrService.getLeaveRequests({ ...filters, status: 'PENDING' }, signal), reportFilters, signal),
            fetchAllReportPages((filters) => hrService.getPerformanceReviews(undefined, signal, filters), reportFilters, signal),
          ]);
          return { stats, employees, departments, leaveRequests, reviews };
        }
        case 'empleados': {
          const [employees, departments, positions] = await Promise.all([
            hrService.getEmployees(page, signal),
            hrService.getDepartments(signal),
            hrService.getPositions(undefined, signal),
          ]);
          return { employees, departments, positions };
        }
        case 'departamentos': {
          const [departments, employees, positions] = await Promise.all([
            hrService.getDepartments(signal),
            hrService.getEmployees(page, signal),
            hrService.getPositions(undefined, signal),
          ]);
          return { departments, employees, positions };
        }
        case 'nominas': {
          const [payrolls, employees] = await Promise.all([
            hrService.getPayrolls(page, signal),
            hrService.getEmployees(page, signal),
          ]);
          return { payrolls, employees };
        }
        case 'comisiones':
          return {};
        case 'asistencia': {
          const [attendance, employees] = await Promise.all([
            hrService.getAttendanceRecords(page, signal),
            hrService.getEmployees(page, signal),
          ]);
          return { attendance, employees };
        }
        case 'ausencias': {
          const [leaveRequests, employees] = await Promise.all([
            hrService.getLeaveRequests(page, signal),
            hrService.getEmployees(page, signal),
          ]);
          return { leaveRequests, employees };
        }
        case 'evaluaciones': {
          const [reviews, employees] = await Promise.all([
            hrService.getPerformanceReviews(undefined, signal, page),
            hrService.getEmployees(page, signal),
          ]);
          return { reviews, employees };
        }
        case 'capacitaciones': {
          const [trainings, employees] = await Promise.all([
            hrService.getTrainings(page, signal),
            hrService.getEmployees(page, signal),
          ]);
          return { trainings, employees };
        }
        case 'beneficios': {
          const [benefits, employees] = await Promise.all([
            hrService.getBenefits(page, signal),
            hrService.getEmployees(page, signal),
          ]);
          return { benefits, employees };
        }
        case 'kpi':
          {
            const [employees, departments] = await Promise.all([
              hrService.getEmployees(page, signal),
              hrService.getDepartments(signal),
            ]);
            return { employees, departments };
          }
        default:
          return {};
      }
    },
    enabled: canReadHr && activeTab !== 'config-nomina' && activeTab !== 'ausencias-config',
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });

  const list = (value: any) => Array.isArray(value) ? value : (value?.data || []);
  const data = useMemo(() => ({
    employees: list(hrQuery.data?.employees),
    departments: list(hrQuery.data?.departments),
    positions: list(hrQuery.data?.positions),
    payrolls: list(hrQuery.data?.payrolls),
    attendance: list(hrQuery.data?.attendance),
    leaveRequests: list(hrQuery.data?.leaveRequests),
    reviews: list(hrQuery.data?.reviews),
    trainings: list(hrQuery.data?.trainings),
    benefits: list(hrQuery.data?.benefits),
    users: list(hrQuery.data?.users),
    stats: hrQuery.data?.stats || null,
  }), [hrQuery.data]);
  const loading = activeTab !== 'comisiones' && hrQuery.isLoading;
  const queryError = hrQuery.error as any;
  const errorMessage = queryError?.response?.data?.message || queryError?.message || 'No se pudieron cargar los datos de Recursos Humanos.';
  const activeExportTarget = HR_EXPORT_TARGETS[activeTab];
  const canExportActiveHr = Boolean(activeExportTarget && canPerform(activeExportTarget.permission, 'export'));

  const loadHrExportData = async (tab: string) => {
    const reportFilters = { pageSize: 5000, report: true, export: true };
    switch (tab) {
      case 'dashboard': {
        const [stats, employees, departments, leaveRequests, reviews] = await Promise.all([
          hrService.getDashboardStats(),
          fetchAllReportPages((filters) => hrService.getEmployees(filters), reportFilters),
          hrService.getDepartments(),
          fetchAllReportPages((filters) => hrService.getLeaveRequests({ ...filters, status: 'PENDING' }), reportFilters),
          fetchAllReportPages((filters) => hrService.getPerformanceReviews(undefined, undefined, filters), reportFilters),
        ]);
        return { stats, employees, departments, leaveRequests, reviews };
      }
      case 'empleados':
        return { employees: await fetchAllReportPages((filters) => hrService.getEmployees(filters), reportFilters) };
      case 'departamentos': {
        const [departments, employees, positions] = await Promise.all([
          hrService.getDepartments(),
          fetchAllReportPages((filters) => hrService.getEmployees(filters), reportFilters),
          hrService.getPositions(),
        ]);
        return { departments, employees, positions };
      }
      case 'asistencia': {
        const [attendance, employees] = await Promise.all([
          fetchAllReportPages((filters) => hrService.getAttendanceRecords(filters), reportFilters),
          fetchAllReportPages((filters) => hrService.getEmployees(filters), reportFilters),
        ]);
        return { attendance, employees };
      }
      case 'ausencias': {
        const [leaveRequests, employees] = await Promise.all([
          fetchAllReportPages((filters) => hrService.getLeaveRequests(filters), reportFilters),
          fetchAllReportPages((filters) => hrService.getEmployees(filters), reportFilters),
        ]);
        return { leaveRequests, employees };
      }
      case 'evaluaciones': {
        const [reviews, employees] = await Promise.all([
          fetchAllReportPages((filters) => hrService.getPerformanceReviews(undefined, undefined, filters), reportFilters),
          fetchAllReportPages((filters) => hrService.getEmployees(filters), reportFilters),
        ]);
        return { reviews, employees };
      }
      case 'kpi':
        return {
          employees: await fetchAllReportPages((filters) => hrService.getEmployees(filters), reportFilters),
          departments: await hrService.getDepartments(),
        };
      case 'capacitaciones': {
        const [trainings, employees] = await Promise.all([
          fetchAllReportPages((filters) => hrService.getTrainings(filters), reportFilters),
          fetchAllReportPages((filters) => hrService.getEmployees(filters), reportFilters),
        ]);
        return { trainings, employees };
      }
      case 'beneficios': {
        const [benefits, employees] = await Promise.all([
          fetchAllReportPages((filters) => hrService.getBenefits(filters), reportFilters),
          fetchAllReportPages((filters) => hrService.getEmployees(filters), reportFilters),
        ]);
        return { benefits, employees };
      }
      default:
        return {};
    }
  };

  const buildHrExport = (tab: string, payload: any) => {
    const employees = responseRows(payload.employees);
    const departments = responseRows(payload.departments);
    const positions = responseRows(payload.positions);
    const rowsByTab: Record<string, Array<Record<string, unknown>>> = {
      empleados: employees.map((employee) => ({
        Colaborador: [employee.firstName, employee.lastName].filter(Boolean).join(' ') || employee.name || '—',
        Identificación: employee.identification || employee.taxId || employee.documentNumber || '—',
        Cargo: employee.position?.name || employee.position || '—',
        Departamento: employee.department?.name || employee.department || '—',
        Estado: employee.status || '—',
        Ingreso: exportDate(employee.hireDate),
      })),
      departamentos: departments.map((department) => ({
        Departamento: department.name || department.label || '—',
        Responsable: department.manager?.name || department.managerName || '—',
        Colaboradores: Number((department.employeeCount ?? department._count?.employees ?? employees.filter((employee) => employee.departmentId === department.id).length) || 0),
        Cargos: positions.filter((position) => position.departmentId === department.id).length || '—',
        Estado: department.status || 'Activo',
      })),
      asistencia: responseRows(payload.attendance).map((record) => ({
        Fecha: exportDate(record.date || record.attendanceDate || record.createdAt),
        Colaborador: record.employee?.name || record.employeeName || '—',
        Entrada: record.checkIn || record.clockIn || '—',
        Salida: record.checkOut || record.clockOut || '—',
        Horas: record.hoursWorked ?? record.totalHours ?? '—',
        Estado: record.status || '—',
      })),
      ausencias: responseRows(payload.leaveRequests).map((request) => ({
        Colaborador: request.employee?.name || request.employeeName || '—',
        Tipo: request.leaveType || request.type || '—',
        Inicio: exportDate(request.startDate),
        Fin: exportDate(request.endDate),
        Días: request.days ?? request.totalDays ?? '—',
        Estado: request.status || '—',
      })),
      evaluaciones: responseRows(payload.reviews).map((review) => ({
        Colaborador: review.employee?.name || review.employeeName || '—',
        Período: review.period || exportDate(review.reviewDate || review.createdAt),
        Evaluador: review.reviewer?.name || review.reviewerName || '—',
        Puntuación: review.score ?? review.rating ?? '—',
        Estado: review.status || '—',
      })),
      kpi: employees.map((employee) => ({
        Indicador: 'Colaborador activo',
        Colaborador: [employee.firstName, employee.lastName].filter(Boolean).join(' ') || employee.name || '—',
        Meta: '—',
        Resultado: employee.status || 'Activo',
        Estado: employee.status || '—',
      })),
      capacitaciones: responseRows(payload.trainings).map((training) => ({
        Capacitación: training.name || training.title || '—',
        Colaborador: training.employee?.name || training.employeeName || '—',
        Inicio: exportDate(training.startDate),
        Fin: exportDate(training.endDate),
        Estado: training.status || '—',
        Resultado: training.result || training.score || '—',
      })),
      beneficios: responseRows(payload.benefits).map((benefit) => ({
        Beneficio: benefit.name || benefit.title || '—',
        Colaborador: benefit.employee?.name || benefit.employeeName || '—',
        Valor: benefit.amount ?? benefit.value ?? '—',
        Inicio: exportDate(benefit.startDate),
        Fin: exportDate(benefit.endDate),
        Estado: benefit.status || '—',
      })),
    };
    if (tab === 'dashboard') {
      const stats = payload.stats && typeof payload.stats === 'object' ? payload.stats : {};
      const dashboardRows = Object.entries(stats).map(([key, value]) => ({ Indicador: key, Valor: value as unknown, Detalle: 'Resumen del período' }));
      const employeeRows = rowsByTab.empleados || [];
      return {
        rows: dashboardRows,
        sections: [
          { id: 'hr-dashboard-kpis', title: 'Indicadores', headers: ['Indicador', 'Valor', 'Detalle'], rows: dashboardRows.map((row) => [row.Indicador, row.Valor as any, row.Detalle]) },
          { id: 'hr-dashboard-employees', title: 'Plantilla', headers: ['Colaborador', 'Cargo', 'Departamento', 'Estado'], rows: employeeRows.slice(0, 5000).map((row) => [row.Colaborador, row.Cargo, row.Departamento, row.Estado]) },
        ],
      };
    }
    const rows = rowsByTab[tab] || [];
    const headers = rows.length ? Object.keys(rows[0]) : ['Mensaje'];
    return { rows, sections: [{ id: `hr-${tab}`, title: HR_EXPORT_TARGETS[tab]?.label || 'Reporte de RR. HH.', headers, rows: rows.length ? rows.map((row) => headers.map((header) => row[header] as string | number)) : [['Sin registros para el alcance seleccionado']] }] };
  };

  const exportHr = async (format: 'pdf' | 'xlsx') => {
    if (!activeExportTarget || !canExportActiveHr) return;
    const toastId = toast.loading(`Preparando ${format === 'pdf' ? 'PDF' : 'Excel'} de ${activeExportTarget.label}…`);
    try {
      const payload = await loadHrExportData(activeTab);
      const exportData = buildHrExport(activeTab, payload);
      const fileStem = `reporte_rrhh_${activeTab}`;
      if (format === 'xlsx') {
        createReportWorkbook({ fileName: buildDatedDownloadFileName([fileStem], 'xlsx'), sheets: [{ name: activeExportTarget.label, rows: exportData.rows }], filters: { Vista: activeExportTarget.label, Alcance: 'Todos los registros autorizados' } });
      } else {
        const stats = payload.stats && typeof payload.stats === 'object' ? payload.stats : {};
        await generateConfiguredReportSectionsPDF({
          targetKey: activeExportTarget.targetKey,
          title: activeExportTarget.label,
          tenantName: user?.tenantName || 'Mi Empresa',
          tenantLogo: user?.sessionBranding?.logo || null,
          sections: exportData.sections,
          kpis: activeTab === 'dashboard' ? Object.entries(stats).slice(0, 6).map(([label, value]) => ({ label, value: String(value ?? '—'), detail: 'Resumen del período' })) : undefined,
          fileName: buildDatedDownloadFileName([fileStem], 'pdf'),
        });
      }
      toast.success(`${format === 'pdf' ? 'PDF' : 'Excel'} exportado correctamente`, { id: toastId });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo generar la exportación', { id: toastId });
    }
  };
  const refreshData = (detail?: NotificationDomainRefreshDetail) => {
    const navigation = detail?.navigation || { module: 'rh', subModule: activeTab };
    const tenantKey = String(user?.clientTenantId || '');
    const queryKeys = getNotificationDomainQueryKeys(navigation, tenantKey);
    queryKeys.forEach((queryKey) => {
      void queryClient.invalidateQueries({ queryKey, refetchType: 'active' });
    });
  };


  return (
    <div className="hr-module mx-auto w-full max-w-[1700px] min-w-0 space-y-6 overflow-x-hidden p-4 pb-20 sm:p-6 md:px-10 md:pb-20 md:pt-4">

      <CurrencyValuationBanner />

      {/* Main Navigation Tabs - Estilo Compras (Píldoras Flexibles y con Scroll) */}
      <Tabs value={activeTab} className="w-full" onValueChange={handleTabChange}>
        <div className="mb-4 flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1 overflow-x-auto">
            <TabsList className={cn(!isSidebarCollapsed && "hidden lg:hidden", "w-full min-w-0 h-auto bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 flex overflow-x-auto flex-nowrap gap-1.5 rounded-2xl border border-border/40 [&>button]:flex-none [&>button]:shrink-0 [&>button]:text-muted-foreground [&>button]:hover:bg-muted/50 [&>button]:hover:text-foreground")}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3, module: 'HR_DASHBOARD' },
            { id: 'empleados', label: 'Empleados', icon: Users, module: 'HR_EMPLOYEES' },
            { id: 'departamentos', label: 'Departamentos', icon: Building2, module: 'HR_EMPLOYEES' },
            { id: 'nominas', label: 'Nóminas', icon: DollarSign, module: 'HR_PAYROLL' },
            { id: 'comisiones', label: 'Comisiones', icon: BadgePercent, module: 'HR_PAYROLL' },
            { id: 'asistencia', label: 'Asistencia', icon: UserCheck, module: 'HR_ATTENDANCE' },
            { id: 'ausencias', label: 'Vacaciones', icon: Calendar, module: 'HR_LEAVES' },
            { id: 'ausencias-config', label: 'Tipos Ausencia', icon: Calendar, module: 'HR_LEAVES' },
            { id: 'evaluaciones', label: 'Desempeño', icon: Award, module: 'HR_PERFORMANCE' },
            { id: 'kpi', label: 'KPI', icon: BarChart3, module: 'HR_PERFORMANCE' },
            { id: 'capacitaciones', label: 'Formación', icon: GraduationCap, module: 'HR_TRAINING' },
            { id: 'beneficios', label: 'Beneficios', icon: HandHeart, module: 'HR_BENEFITS' },
            { id: 'config-nomina', label: 'Config', icon: Settings2, module: 'HR_PAYROLL_CONFIG' }
          ].map((tab) => {
            const hasRequired = user?.enabledModules?.includes(tab.module);
            // La suscripción al módulo padre (HR) habilita todas sus vistas,
            // incluso con submódulos granulares contratados.
            const hasFallback = user?.enabledModules?.includes('HR');
            const isCommissionsTab = tab.id === 'comisiones';
            const hasCommissionSubscription = !user?.enabledModules || user.enabledModules.some((module) => ['HR', 'HR_PAYROLL', 'HR_COMMISSIONS'].includes(module));
            const hasSubscriptionAccess = isCommissionsTab ? hasCommissionSubscription : (!user?.enabledModules || hasRequired || hasFallback);
            const hasPermission = isCommissionsTab
              ? canPerform('HR_COMMISSIONS', 'view') || canPerform('HR_COMMISSIONS_CONFIG', 'view')
              : canPerform(tab.module, 'view');
            const hasAccess = hasSubscriptionAccess && hasPermission;
            if (!hasAccess) return null;
            return (
              <TabsTrigger 
                key={tab.id}
                value={tab.id} 
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
              >
                <tab.icon className="size-4" />
                <span>{tab.label}</span>
              </TabsTrigger>
            );
          })}
            </TabsList>
          </div>
          {canExportActiveHr && (
            <ExportMenu
              onPdf={() => void exportHr('pdf')}
              onExcel={() => void exportHr('xlsx')}
              className="shrink-0"
              pdfDescription="Plantilla configurada para esta vista"
              excelDescription="Todos los registros autorizados"
            />
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-0 min-h-[600px]"
        >
          {loading && !hrQuery.data ? (
            <div className="flex items-center justify-center h-96">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent blur-xl opacity-50 rounded-full" />
                  <div className="relative size-16 border-4 border-muted border-t-indigo-500 border-r-purple-600 rounded-full animate-spin" />
                </div>
                <p className="text-sm font-bold text-muted-foreground tracking-wide">Cargando datos de RH...</p>
              </div>
            </div>
          ) : hrQuery.isError && !hrQuery.data ? (
            <div className="mx-auto flex min-h-[380px] max-w-2xl items-center justify-center px-4">
              <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
                <AlertTriangle className="size-4" />
                <AlertTitle>No se pudo cargar Recursos Humanos</AlertTitle>
                <AlertDescription className="mt-2 flex flex-wrap items-center justify-between gap-3">
                  <span>{Array.isArray(errorMessage) ? errorMessage[0] : errorMessage}</span>
                  <Button variant="outline" size="sm" onClick={() => hrQuery.refetch()} className="gap-2">
                    <RefreshCw className="size-3.5" /> Reintentar
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <>
              {hrQuery.isError && (
                <Alert variant="destructive" className="mb-4 border-destructive/30 bg-destructive/5">
                  <AlertTriangle className="size-4" />
                  <AlertTitle>Los datos podrían estar desactualizados</AlertTitle>
                  <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                    <span>{Array.isArray(errorMessage) ? errorMessage[0] : errorMessage}</span>
                    <Button variant="outline" size="sm" onClick={() => hrQuery.refetch()} className="gap-2">
                      <RefreshCw className="size-3.5" /> Reintentar
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              <TabsContent value="dashboard" className="m-0">
                <DashboardHRView
                  stats={data.stats}
                  employees={data.employees}
                  departments={data.departments}
                  leaveRequests={data.leaveRequests}
                  reviews={data.reviews}
                />
              </TabsContent>

              <TabsContent value="empleados" className="m-0">
                <EmpleadosView
                  employees={data.employees}
                  departments={data.departments}
                  positions={data.positions}
                  onRefresh={refreshData}
                  isSidebarCollapsed={isSidebarCollapsed}
                />
              </TabsContent>

              <TabsContent value="departamentos" className="m-0">
                <DepartamentosView
                  departments={data.departments}
                  employees={data.employees}
                  positions={data.positions}
                  onRefresh={refreshData}
                />
              </TabsContent>

              <TabsContent value="nominas" className="m-0">
                <NominasView
                  payrolls={data.payrolls}
                  employees={data.employees}
                  onRefresh={refreshData}
                />
              </TabsContent>

              <TabsContent value="asistencia" className="m-0">
                <AsistenciaView
                  attendance={data.attendance}
                  employees={data.employees}
                  onRefresh={refreshData}
                />
              </TabsContent>

              <TabsContent value="ausencias" className="m-0">
                <AusenciasView
                  leaveRequests={data.leaveRequests}
                  employees={data.employees}
                  onRefresh={refreshData}
                />
              </TabsContent>

              <TabsContent value="ausencias-config" className="m-0">
                <AusenciasConfigView onRefresh={refreshData} />
              </TabsContent>

              <TabsContent value="evaluaciones" className="m-0">
                <EvaluacionesView
                  reviews={data.reviews}
                  employees={data.employees}
                  onRefresh={refreshData}
                />
              </TabsContent>

              <TabsContent value="kpi" className="m-0">
                <KpiView
                  employees={data.employees}
                  departments={data.departments}
                  onRefresh={refreshData}
                />
              </TabsContent>

              <TabsContent value="capacitaciones" className="m-0">
                <CapacitacionesView
                  trainings={data.trainings}
                  employees={data.employees}
                  onRefresh={refreshData}
                />
              </TabsContent>

              <TabsContent value="beneficios" className="m-0">
                <BeneficiosView benefits={data.benefits} employees={data.employees} onRefresh={refreshData} />
              </TabsContent>

              <TabsContent value="comisiones" className="m-0">
                <ComisionesView />
              </TabsContent>

              <TabsContent value="config-nomina" className="m-0">
                <ConfigNominaView />
              </TabsContent>
            </>
          )}
        </motion.div>
      </Tabs>
    </div>
  );
}
