import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { cn } from './ui/utils';
import {
  Users,
  DollarSign,
  Calendar,
  Award,
  TrendingUp,
  UserCheck,
  Clock,
  FileText,
  Plus,
  Search,
  RefreshCw,
  BarChart3,
  UserX,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { hrService } from '../services/hr.service';
import { Input } from './ui/input';

export function RecursosHumanosPageNew() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({
    employees: [],
    departments: [],
    payrolls: [],
    leaveRequests: [],
    stats: null,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [employeesRes, departmentsRes, payrollsRes, leaveRequestsRes] = await Promise.all([
        hrService.getEmployees(),
        hrService.getDepartments(),
        hrService.getPayrolls(),
        hrService.getLeaveRequests(),
      ]);

      setData({
        employees: employeesRes.data || [],
        departments: departmentsRes.data || [],
        payrolls: payrollsRes.data || [],
        leaveRequests: leaveRequestsRes.data || [],
      });
    } catch (error) {
      console.error('Error fetching HR data:', error);
      toast.error('Error al cargar datos de Recursos Humanos');
    } finally {
      setLoading(false);
    }
  };

  const activeEmployees = data.employees.filter((e: any) => e.employmentStatus === 'ACTIVE').length;
  const onLeave = data.leaveRequests.filter((l: any) => l.status === 'APPROVED').length;
  const pendingLeaves = data.leaveRequests.filter((l: any) => l.status === 'PENDING').length;
  const totalPayroll = data.payrolls.reduce((sum: number, p: any) => sum + Number(p.netPay || 0), 0);

  const stats = [
    {
      title: 'Total Empleados',
      value: data.employees.length,
      subtitle: `${activeEmployees} activos`,
      icon: Users,
      trend: '+5%',
      trendUp: true,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30'
    },
    {
      title: 'Planilla Mensual',
      value: `$${(totalPayroll / 1000).toFixed(1)}k`,
      subtitle: 'Costo total nómina',
      icon: DollarSign,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/30'
    },
    {
      title: 'Vacaciones Pendientes',
      value: pendingLeaves,
      subtitle: 'Por aprobar',
      icon: Calendar,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-950/30'
    },
    {
      title: 'Nuevas Contrataciones',
      value: data.employees.filter((e: any) => {
        const hireDate = new Date(e.hireDate);
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        return hireDate >= threeMonthsAgo;
      }).length,
      subtitle: 'Este trimestre',
      icon: TrendingUp,
      trend: '+12%',
      trendUp: true,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-950/30'
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-12 border-4 border-muted border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recursos Humanos</h1>
          <p className="text-muted-foreground mt-1">
            {data.employees.length} empleados · {data.departments.length} departamentos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="size-4 mr-2" />
            Actualizar
          </Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="size-4 mr-2" />
            Nuevo Empleado
          </Button>
        </div>
      </div>

      {/* Stats Cards - Estilo Suscripciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="border-border/40 hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      {stat.title}
                    </p>
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-3xl font-bold tracking-tight">
                        {stat.value}
                      </h3>
                      {stat.trend && (
                        <span className={cn(
                          "text-sm font-medium flex items-center gap-1",
                          stat.trendUp ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                        )}>
                          <TrendingUp className="size-3" />
                          {stat.trend}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{stat.subtitle}</p>
                  </div>
                  <div className={cn("p-3 rounded-xl", stat.bgColor)}>
                    <stat.icon className={cn("size-6", stat.color)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Empleados Recientes */}
        <Card className="lg:col-span-2 border-border/40">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">Directorio de Empleados</CardTitle>
                <CardDescription>Gestión de personal activo</CardDescription>
              </div>
              <Button variant="ghost" size="sm">
                <Search className="size-4 mr-2" />
                Buscar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.employees.slice(0, 8).map((emp: any, i: number) => (
                <motion.div
                  key={emp.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-4 rounded-lg border border-border/40 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-semibold text-sm">
                      {emp.firstName?.[0]}{emp.lastName?.[0]}
                    </div>
                    <div>
                      <p className="font-medium">{emp.firstName} {emp.lastName}</p>
                      <p className="text-sm text-muted-foreground">{emp.position?.title || 'Sin puesto'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={emp.employmentStatus === 'ACTIVE' ? 'default' : 'secondary'} className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                      {emp.employmentStatus}
                    </Badge>
                    <span className="text-sm font-medium text-muted-foreground">
                      ${Number(emp.salary || 0).toLocaleString()}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Solicitudes Pendientes */}
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="text-xl">Solicitudes Pendientes</CardTitle>
            <CardDescription>Ausencias por aprobar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.leaveRequests.filter((l: any) => l.status === 'PENDING').slice(0, 5).map((leave: any, i: number) => (
                <motion.div
                  key={leave.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 rounded-lg border border-border/40 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {leave.employee?.firstName} {leave.employee?.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {leave.leaveType} · {leave.days} días
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800">
                      Pendiente
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30">
                      <CheckCircle2 className="size-3 mr-1" />
                      Aprobar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30">
                      <XCircle className="size-3 mr-1" />
                      Rechazar
                    </Button>
                  </div>
                </motion.div>
              ))}
              {data.leaveRequests.filter((l: any) => l.status === 'PENDING').length === 0 && (
                <div className="text-center py-8">
                  <CheckCircle2 className="size-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No hay solicitudes pendientes</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Departamentos */}
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-xl">Distribución por Departamento</CardTitle>
          <CardDescription>Personal por área organizacional</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {data.departments.map((dept: any, i: number) => {
              const deptEmployees = data.employees.filter((e: any) => e.departmentId === dept.id);
              return (
                <motion.div
                  key={dept.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 rounded-lg border border-border/40 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold">{dept.name}</h4>
                    <Badge variant="secondary" className="bg-muted">
                      {deptEmployees.length}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{dept.description}</p>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all"
                      style={{ width: `${(deptEmployees.length / data.employees.length) * 100}%` }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
