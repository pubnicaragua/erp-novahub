import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import {
  Users,
  DollarSign,
  Calendar,
  Award,
  GraduationCap,
  UserCheck,
  Download,
  BarChart3,
  HandHeart,
  Building2,
  Settings2,
} from 'lucide-react';
import { hrService } from '../services/hr.service';
import { useAuth } from '../contexts/AuthContext';
import { DashboardHRView } from './hr/DashboardHRView';
import { EmpleadosView } from './hr/EmpleadosView';
import { NominasView } from './hr/NominasView';
import { AsistenciaView } from './hr/AsistenciaView';
import { AusenciasView } from './hr/AusenciasView';
import { EvaluacionesView } from './hr/EvaluacionesView';
import { CapacitacionesView } from './hr/CapacitacionesView';
import { BeneficiosView } from './hr/BeneficiosView';
import { ConfigNominaView } from './hr/ConfigNominaView';

interface RecursosHumanosPageProps {
  activeSubModule?: string;
  onSubModuleChange?: (subModule?: string) => void;
}

export function RecursosHumanosPage({ activeSubModule, onSubModuleChange }: RecursosHumanosPageProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Map sidebar submodule IDs to tab values
  const subModuleToTab: Record<string, string> = {
    'dashboard-hr': 'dashboard',
    'empleados': 'empleados',
    'nominas': 'nominas',
    'config-nomina': 'config-nomina',
    'asistencia': 'asistencia',
    'ausencias': 'ausencias',
    'evaluaciones': 'evaluaciones',
    'capacitaciones': 'capacitaciones',
    'beneficios': 'beneficios',
  };
  
  const [activeTab, setActiveTab] = useState(() => 
    activeSubModule ? (subModuleToTab[activeSubModule] || 'dashboard') : 'dashboard'
  );
  
  // Sync tab when activeSubModule changes from sidebar
  React.useEffect(() => {
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

  const [data, setData] = useState<any>({
    employees: [],
    departments: [],
    positions: [],
    payrolls: [],
    attendance: [],
    leaveRequests: [],
    reviews: [],
    trainings: [],
    benefits: [],
    stats: null,
  });

  const fetchData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const [
        employeesRes,
        departmentsRes,
        positionsRes,
        payrollsRes,
        attendanceRes,
        leaveRequestsRes,
        reviewsRes,
        trainingsRes,
        benefitsRes,
        statsRes,
      ] = await Promise.all([
        hrService.getEmployees(),
        hrService.getDepartments(),
        hrService.getPositions(),
        hrService.getPayrolls(),
        hrService.getAttendanceRecords(),
        hrService.getLeaveRequests(),
        hrService.getPerformanceReviews(),
        hrService.getTrainings(),
        hrService.getBenefits(),
        hrService.getDashboardStats(),
      ]) as any[];

      setData({
        employees: Array.isArray(employeesRes) ? employeesRes : (employeesRes?.data || []),
        departments: Array.isArray(departmentsRes) ? departmentsRes : (departmentsRes?.data || []),
        positions: Array.isArray(positionsRes) ? positionsRes : (positionsRes?.data || []),
        payrolls: Array.isArray(payrollsRes) ? payrollsRes : (payrollsRes?.data || []),
        attendance: Array.isArray(attendanceRes) ? attendanceRes : (attendanceRes?.data || []),
        leaveRequests: Array.isArray(leaveRequestsRes) ? leaveRequestsRes : (leaveRequestsRes?.data || []),
        reviews: Array.isArray(reviewsRes) ? reviewsRes : (reviewsRes?.data || []),
        trainings: Array.isArray(trainingsRes) ? trainingsRes : (trainingsRes?.data || []),
        benefits: Array.isArray(benefitsRes) ? benefitsRes : (benefitsRes?.data || []),
        stats: statsRes || null,
      });
    } catch (error) {
      console.error('Error fetching HR data:', error);
      toast.error('Error al cargar datos de Recursos Humanos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExportData = async () => {
    try {
      const response = await hrService.exportEmployees();
      const csvContent = [
        ['Número', 'Nombre', 'Email', 'Departamento', 'Puesto', 'Salario', 'Estado'].join(','),
        ...data.employees.map((e: any) => [
          e.employeeNumber,
          `"${e.firstName} ${e.lastName}"`,
          e.email,
          e.department?.name || '',
          e.position?.title || '',
          e.salary,
          e.employmentStatus,
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `empleados_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      toast.success('Archivo CSV descargado');
    } catch (error) {
      toast.error('Error al exportar datos');
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-8 pb-20 max-w-[1920px] mx-auto">
      {/* Header matching Suscripciones style */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-4xl font-black tracking-tighter flex items-center gap-3 uppercase italic">
            <Users className="size-9 text-primary" />
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

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleExportData}
            className="rounded-xl gap-2 font-bold hover:border-primary/50 hover:bg-primary/5 transition-all"
          >
            <Download className="size-4" />
            Exportar
          </Button>
        </div>
      </motion.div>

      {/* Main Navigation Tabs - Estilo Compras (Píldoras Flexibles y con Scroll) */}
      <Tabs value={activeTab} className="w-full" onValueChange={handleTabChange}>
        <TabsList className="w-full h-auto bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 flex overflow-x-auto justify-start pb-2 flex-nowrap gap-1.5 rounded-2xl border border-border/40 mb-6 custom-scrollbar">
          <TabsTrigger 
            value="dashboard" 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
          >
            <BarChart3 className="size-4" />
            <span>Dashboard</span>
          </TabsTrigger>
          {(!user?.enabledModules || user.enabledModules.includes('HR_EMPLOYEES')) && (
          <TabsTrigger 
            value="empleados" 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
          >
            <Users className="size-4" />
            <span>Empleados</span>
          </TabsTrigger>
          )}
          {(!user?.enabledModules || user.enabledModules.includes('HR_PAYROLL')) && (
          <TabsTrigger 
            value="nominas" 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
          >
            <DollarSign className="size-4" />
            <span>Nóminas</span>
          </TabsTrigger>
          )}
          {(!user?.enabledModules || user.enabledModules.includes('HR_ATTENDANCE')) && (
          <TabsTrigger 
            value="asistencia" 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
          >
            <UserCheck className="size-4" />
            <span>Asistencia</span>
          </TabsTrigger>
          )}
          {(!user?.enabledModules || user.enabledModules.includes('HR_LEAVES')) && (
          <TabsTrigger 
            value="ausencias" 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
          >
            <Calendar className="size-4" />
            <span>Vacaciones</span>
          </TabsTrigger>
          )}
          {(!user?.enabledModules || user.enabledModules.includes('HR_PERFORMANCE')) && (
          <TabsTrigger 
            value="evaluaciones" 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
          >
            <Award className="size-4" />
            <span>Desempeño</span>
          </TabsTrigger>
          )}
          {(!user?.enabledModules || user.enabledModules.includes('HR_TRAINING')) && (
          <TabsTrigger 
            value="capacitaciones" 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
          >
            <GraduationCap className="size-4" />
            <span>Formación</span>
          </TabsTrigger>
          )}
          {(!user?.enabledModules || user.enabledModules.includes('HR_BENEFITS')) && (
          <TabsTrigger 
            value="beneficios" 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
          >
            <HandHeart className="size-4" />
            <span>Beneficios</span>
          </TabsTrigger>
          )}
          <TabsTrigger 
            value="config-nomina" 
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
          >
            <Settings2 className="size-4" />
            <span>Config</span>
          </TabsTrigger>
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
                  onRefresh={() => fetchData(true)}
                />
              </TabsContent>

              <TabsContent value="nominas" className="m-0">
                <NominasView
                  payrolls={data.payrolls}
                  employees={data.employees}
                  onRefresh={() => fetchData(true)}
                />
              </TabsContent>

              <TabsContent value="asistencia" className="m-0">
                <AsistenciaView
                  attendance={data.attendance}
                  employees={data.employees}
                  onRefresh={() => fetchData(true)}
                />
              </TabsContent>

              <TabsContent value="ausencias" className="m-0">
                <AusenciasView
                  leaveRequests={data.leaveRequests}
                  employees={data.employees}
                  onRefresh={() => fetchData(true)}
                />
              </TabsContent>

              <TabsContent value="evaluaciones" className="m-0">
                <EvaluacionesView
                  reviews={data.reviews}
                  employees={data.employees}
                  onRefresh={() => fetchData(true)}
                />
              </TabsContent>

              <TabsContent value="capacitaciones" className="m-0">
                <CapacitacionesView
                  trainings={data.trainings}
                  employees={data.employees}
                  onRefresh={() => fetchData(true)}
                />
              </TabsContent>

              <TabsContent value="beneficios" className="m-0">
                <BeneficiosView benefits={data.benefits} employees={data.employees} onRefresh={() => fetchData(true)} />
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
