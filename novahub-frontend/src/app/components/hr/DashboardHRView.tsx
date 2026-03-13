import React from 'react';
import { Users, Briefcase, UserCheck, UserX, TrendingUp, TrendingDown, Clock, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export function DashboardHRView({ stats, employees, departments, leaveRequests, reviews }: any) {
  const activeEmployees = employees.filter((e: any) => e.employmentStatus === 'ACTIVE').length;
  const inactiveEmployees = employees.filter((e: any) => e.employmentStatus !== 'ACTIVE').length;
  const pendingLeaves = leaveRequests.filter((l: any) => l.status === 'PENDING').length;
  const avgRating = reviews.length > 0 
    ? reviews.reduce((sum: number, r: any) => sum + (r.overallRating || 0), 0) / reviews.length 
    : 0;

  const statCards = [
    {
      label: 'Total Empleados',
      value: employees.length,
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      trend: '+5%',
      trendUp: true,
    },
    {
      label: 'Empleados Activos',
      value: activeEmployees,
      icon: UserCheck,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
      subtitle: `${inactiveEmployees} inactivos`,
    },
    {
      label: 'Departamentos',
      value: departments.length,
      icon: Briefcase,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      label: 'Ausencias Pendientes',
      value: pendingLeaves,
      icon: Clock,
      color: pendingLeaves > 0 ? 'text-orange-500' : 'text-green-500',
      bg: pendingLeaves > 0 ? 'bg-orange-500/10' : 'bg-green-500/10',
    },
  ];

  // Department distribution
  const deptDistribution = departments.map((dept: any) => ({
    name: dept.name,
    count: employees.filter((e: any) => e.departmentId === dept.id).length,
    budget: dept.budget || 0,
  })).sort((a: any, b: any) => b.count - a.count);

  // Recent hires (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentHires = employees.filter((e: any) => new Date(e.hireDate) >= thirtyDaysAgo);

  // Top performers
  const topPerformers = employees
    .map((e: any) => {
      const empReviews = reviews.filter((r: any) => r.employeeId === e.id);
      const avgRating = empReviews.length > 0
        ? empReviews.reduce((sum: number, r: any) => sum + (r.overallRating || 0), 0) / empReviews.length
        : 0;
      return { ...e, avgRating };
    })
    .filter((e: any) => e.avgRating > 0)
    .sort((a: any, b: any) => b.avgRating - a.avgRating)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <Card key={i} className="border hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                  <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
                  {stat.subtitle && (
                    <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
                  )}
                  {stat.trend && (
                    <div className={`flex items-center gap-1 mt-1 text-xs ${stat.trendUp ? 'text-green-600' : 'text-red-600'}`}>
                      {stat.trendUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                      <span>{stat.trend}</span>
                    </div>
                  )}
                </div>
                <div className={`p-3 rounded-xl ${stat.bg}`}>
                  <stat.icon className={`size-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts and Lists */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Department Distribution */}
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Distribución por Departamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deptDistribution.slice(0, 6).map((dept: any, i: number) => {
                const percentage = employees.length > 0 ? (dept.count / employees.length) * 100 : 0;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate">{dept.name}</span>
                      <span className="text-muted-foreground">{dept.count} empleados</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Hires */}
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <UserCheck className="size-4 text-green-500" />
              Contrataciones Recientes (30 días)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentHires.length > 0 ? (
              <div className="space-y-2">
                {recentHires.slice(0, 5).map((emp: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                        {emp.firstName[0]}{emp.lastName[0]}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{emp.firstName} {emp.lastName}</p>
                        <p className="text-xs text-muted-foreground">{emp.position?.title}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(emp.hireDate).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay contrataciones recientes
              </p>
            )}
          </CardContent>
        </Card>

        {/* Top Performers */}
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Award className="size-4 text-yellow-500" />
              Mejores Evaluados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPerformers.length > 0 ? (
              <div className="space-y-2">
                {topPerformers.map((emp: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center size-6 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 text-white text-xs font-bold">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{emp.firstName} {emp.lastName}</p>
                        <p className="text-xs text-muted-foreground">{emp.department?.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Award className="size-3 text-yellow-500" />
                      <span className="text-sm font-bold text-yellow-600">
                        {emp.avgRating.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay evaluaciones disponibles
              </p>
            )}
          </CardContent>
        </Card>

        {/* Pending Leave Requests */}
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="size-4 text-orange-500" />
              Solicitudes de Ausencia Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingLeaves > 0 ? (
              <div className="space-y-2">
                {leaveRequests
                  .filter((l: any) => l.status === 'PENDING')
                  .slice(0, 5)
                  .map((leave: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">
                          {leave.employee?.firstName} {leave.employee?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {leave.leaveType} · {leave.days} días
                        </p>
                      </div>
                      <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                        Pendiente
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay solicitudes pendientes
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
