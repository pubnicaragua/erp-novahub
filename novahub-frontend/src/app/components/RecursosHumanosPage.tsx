import React from 'react';
import { cn } from './ui/utils';
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Badge } from './ui/badge';
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
} from 'lucide-react';
import { hrService } from '../services/hr.service';
import { useAuth } from '../contexts/AuthContext';
import { DashboardHRView } from './hr/DashboardHRView';
import { EmpleadosView } from './hr/EmpleadosView';
import { NominasView } from './hr/NominasView';
import { AsistenciaView } from './hr/AsistenciaView';
import { AusenciasView } from './hr/AusenciasView';
import { AusenciasConfigView } from './hr/AusenciasConfigView';
import { KpiView } from './hr/KpiView';
import { EvaluacionesView } from './hr/EvaluacionesView';
import { CapacitacionesView } from './hr/CapacitacionesView';
import { BeneficiosView } from './hr/BeneficiosView';
import { ConfigNominaView } from './hr/ConfigNominaView';
import { CurrencyValuationBanner } from './ui/CurrencyValuation';

interface RecursosHumanosPageProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
  onSubModuleChange?: (subModule?: string) => void;
}

export function RecursosHumanosPage({ activeSubModule, onSubModuleChange, isSidebarCollapsed}: RecursosHumanosPageProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Map sidebar submodule IDs to tab values
  const subModuleToTab: Record<string, string> = {
    'dashboard-hr': 'dashboard',
    'empleados': 'empleados',
    'nominas': 'nominas',
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
          const [stats, employees, departments, leaveRequests, reviews] = await Promise.all([
            hrService.getDashboardStats(signal),
            hrService.getEmployees(page, signal),
            hrService.getDepartments(signal),
            hrService.getLeaveRequests({ ...page, status: 'PENDING' }, signal),
            hrService.getPerformanceReviews(undefined, signal, page),
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
        case 'nominas': {
          const [payrolls, employees] = await Promise.all([
            hrService.getPayrolls(page, signal),
            hrService.getEmployees(page, signal),
          ]);
          return { payrolls, employees };
        }
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
          return { employees: await hrService.getEmployees(page, signal) };
        default:
          return {};
      }
    },
    enabled: activeTab !== 'config-nomina' && activeTab !== 'ausencias-config',
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
    stats: hrQuery.data?.stats || null,
  }), [hrQuery.data]);
  const loading = hrQuery.isLoading;
  const refreshData = () => queryClient.invalidateQueries({ queryKey: ['hr'] });


  return (
    <div className="mx-auto w-full max-w-[1700px] min-w-0 space-y-6 p-4 pb-20 sm:p-6 md:p-10">
      {/* Header matching Suscripciones style */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-[66px] shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Users className="size-9 text-primary" />
          </div>
          <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter flex flex-wrap items-center gap-x-3 gap-y-1 uppercase italic leading-none">
            Recursos <span className="text-primary">Humanos</span>
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
              Gestión de Talento
            </Badge>
            <span className="text-muted-foreground/40 text-xs font-medium">
              {data.employees.length} empleados · {data.departments.length} departamentos
            </span>
          </div>
          </div>
        </div>
      </motion.div>

      <CurrencyValuationBanner />

      {/* Main Navigation Tabs - Estilo Compras (Píldoras Flexibles y con Scroll) */}
      <Tabs value={activeTab} className="w-full" onValueChange={handleTabChange}>
        <TabsList className={cn(!isSidebarCollapsed && "hidden lg:hidden", "w-full min-w-0 h-auto bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 flex overflow-x-auto flex-nowrap gap-1.5 rounded-2xl border border-border/40 mb-6 [&>button]:flex-none [&>button]:shrink-0 [&>button]:text-muted-foreground [&>button]:hover:bg-muted/50 [&>button]:hover:text-foreground")}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3, module: 'HR_DASHBOARD' },
            { id: 'empleados', label: 'Empleados', icon: Users, module: 'HR_EMPLOYEES' },
            { id: 'nominas', label: 'Nóminas', icon: DollarSign, module: 'HR_PAYROLL' },
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
            const hasSpecificSubmodules = user?.enabledModules?.some(m => m.startsWith('HR_'));
            const hasFallback = user?.enabledModules?.includes('HR') && !hasSpecificSubmodules;
            const hasAccess = !user?.enabledModules || hasRequired || hasFallback;
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

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-6 min-h-[600px]"
        >
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 blur-xl opacity-50 rounded-full" />
                  <div className="relative size-16 border-4 border-muted border-t-indigo-500 border-r-purple-600 rounded-full animate-spin" />
                </div>
                <p className="text-sm font-bold text-muted-foreground tracking-wide">Cargando datos de RH...</p>
              </div>
            </div>
          ) : (
            <>
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
