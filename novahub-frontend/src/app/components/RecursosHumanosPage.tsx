import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './ui/utils';
import {
  Users,
  DollarSign,
  Calendar,
  Award,
  GraduationCap,
  TrendingUp,
  UserCheck,
  Clock,
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  BarChart3,
  Activity,
  Sparkles,
  Gift,
  Building2,
  Briefcase
} from 'lucide-react';
import { hrService } from '../services/hr.service';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { DashboardHRView } from './hr/DashboardHRView';
import { EmpleadosView } from './hr/EmpleadosView';
import { NominasView } from './hr/NominasView';
import { AsistenciaView } from './hr/AsistenciaView';
import { AusenciasView } from './hr/AusenciasView';
import { EvaluacionesView } from './hr/EvaluacionesView';
import { CapacitacionesView } from './hr/CapacitacionesView';

export function RecursosHumanosPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
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
      ]);

      setData({
        employees: employeesRes.data || [],
        departments: departmentsRes.data || [],
        positions: positionsRes.data || [],
        payrolls: payrollsRes.data || [],
        attendance: attendanceRes.data || [],
        leaveRequests: leaveRequestsRes.data || [],
        reviews: reviewsRes.data || [],
        trainings: trainingsRes.data || [],
        benefits: benefitsRes.data || [],
        stats: statsRes.data || null,
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
      {/* Header con estilo Suscripciones */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 blur-xl rounded-full" />
            <div className="relative p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-2xl shadow-indigo-900/30">
              <Users className="size-7 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Recursos Humanos
            </h1>
            <p className="text-sm font-medium text-muted-foreground mt-1">
              <span className="font-bold text-indigo-600">{data.employees.length}</span> empleados activos · <span className="font-bold text-purple-600">{data.departments.length}</span> departamentos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="rounded-xl border-border/50 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all"
          >
            <RefreshCw className={`size-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="font-bold text-xs uppercase tracking-wider">Actualizar</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportData}
            className="rounded-xl border-border/50 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all"
          >
            <Download className="size-4 mr-2" />
            <span className="font-bold text-xs uppercase tracking-wider">Exportar</span>
          </Button>
        </div>
      </motion.div>

      {/* Main Navigation Tabs - Estilo Suscripciones */}
      <Tabs value={activeTab} className="w-full" onValueChange={setActiveTab}>
        <TabsList className="w-full h-auto bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 grid grid-cols-4 lg:grid-cols-8 gap-2 rounded-2xl border border-border/40">
          <TabsTrigger value="dashboard" className="flex-col gap-2 h-20 rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-900/30 transition-all">
            <BarChart3 className="size-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="empleados" className="flex-col gap-2 h-20 rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-900/30 transition-all">
            <Users className="size-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Empleados</span>
          </TabsTrigger>
          <TabsTrigger value="nominas" className="flex-col gap-2 h-20 rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-900/30 transition-all">
            <DollarSign className="size-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Nóminas</span>
          </TabsTrigger>
          <TabsTrigger value="asistencia" className="flex-col gap-2 h-20 rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-900/30 transition-all">
            <UserCheck className="size-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Asistencia</span>
          </TabsTrigger>
          <TabsTrigger value="ausencias" className="flex-col gap-2 h-20 rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-900/30 transition-all">
            <Calendar className="size-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Vacaciones</span>
          </TabsTrigger>
          <TabsTrigger value="evaluaciones" className="flex-col gap-2 h-20 rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-900/30 transition-all">
            <Award className="size-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Desempeño</span>
          </TabsTrigger>
          <TabsTrigger value="capacitaciones" className="flex-col gap-2 h-20 rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-900/30 transition-all">
            <GraduationCap className="size-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Formación</span>
          </TabsTrigger>
          <TabsTrigger value="beneficios" className="flex-col gap-2 h-20 rounded-xl data-[state=active]:bg-gradient-to-br data-[state=active]:from-indigo-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-900/30 transition-all">
            <Sparkles className="size-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Beneficios</span>
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
                <div className="rounded-lg border bg-card p-8 text-center">
                  <Gift className="size-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Gestión de Beneficios</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {data.benefits.length} beneficios disponibles
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                    {data.benefits.map((benefit: any) => (
                      <div key={benefit.id} className="border rounded-lg p-4 text-left">
                        <h4 className="font-semibold">{benefit.name}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{benefit.description}</p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">{benefit.type}</span>
                          {benefit.cost && <span className="text-sm font-medium">${benefit.cost}/mes</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </>
          )}
        </motion.div>
      </Tabs>
    </div>
  );
}
