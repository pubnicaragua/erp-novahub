import { Users, Briefcase, UserCheck, Clock, Award, DollarSign, Activity, Gift } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { motion } from 'motion/react';
import { useCurrency } from '../../contexts/CurrencyContext';
import { HRViewTutorial } from './HRViewTutorial';
import { normalizeCurrency, summarizeAmountsByCurrency, type SupportedCurrency } from '../../utils/currency';

const DEPT_COLORS = [
  'from-indigo-500 to-purple-600',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-orange-500 to-amber-500',
  'from-rose-500 to-pink-500',
  'from-violet-500 to-fuchsia-500',
  'from-teal-500 to-green-500',
  'from-sky-500 to-blue-600',
];

export function DashboardHRView({ employees, departments, leaveRequests, reviews }: any) {
  const { displayCurrency, displayMode, valuationMode, valuationModeSuffix, convertAmount, convertCurrentAmount, formatCurrentAmount, formatExplicitAmount } = useCurrency();
  const activeEmployees = employees.filter((e: any) => e.employmentStatus === 'ACTIVE').length;
  const inactiveEmployees = employees.filter((e: any) => e.employmentStatus !== 'ACTIVE').length;
  const pendingLeaves = leaveRequests.filter((l: any) => l.status === 'PENDING').length;
  
  const totalPayroll = employees.reduce((sum: number, e: any) => {
    const salary = Number(e.salary ?? e.salaryBase ?? 0) || 0;
    return sum + (valuationMode === 'CURRENT'
      ? convertCurrentAmount(salary, e.currency || 'USD')
      : convertAmount(salary, e.currency || 'USD', e.exchangeRate));
  }, 0);

  const formattedPayroll = formatCurrentAmount(totalPayroll, displayCurrency);
  const payrollCurrencies = summarizeAmountsByCurrency(employees, () => 0, (employee: any) => employee.currency || 'USD').map((item) => item.currency);
  const originalPayroll = (currency: SupportedCurrency) => employees
    .filter((employee: any) => normalizeCurrency(employee.currency || 'USD') === currency)
    .reduce((sum: number, employee: any) => sum + (Number(employee.salary ?? employee.salaryBase ?? 0) || 0), 0);
  const payrollCards = displayMode === 'ORIGINAL'
    ? payrollCurrencies.map((currency) => ({ label: `Planilla Mensual (${currency})`, value: formatExplicitAmount(originalPayroll(currency), currency), sub: 'Costo total nómina', icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' }))
    : [{ label: `Planilla Mensual${valuationModeSuffix}`, value: formattedPayroll, sub: 'Costo total nómina', icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' }];

  const statCards = [
    { label: 'Total Empleados', value: employees.length, sub: `${activeEmployees} activos · ${inactiveEmployees} inactivos`, icon: Users, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
    ...payrollCards,
    { label: 'Ausencias Pendientes', value: pendingLeaves, sub: 'Por aprobar', icon: Clock, color: pendingLeaves > 0 ? 'text-orange-500' : 'text-emerald-500', bg: pendingLeaves > 0 ? 'bg-orange-500/10' : 'bg-emerald-500/10', border: pendingLeaves > 0 ? 'border-orange-500/20' : 'border-emerald-500/20' },
    { label: 'Departamentos', value: departments.length, sub: 'Áreas activas', icon: Briefcase, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
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
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" data-tour="hr-dashboard-title">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Resumen de talento</p>
          <p className="mt-1 text-sm text-muted-foreground">Indicadores generales de la operación de Recursos Humanos.</p>
        </div>
        <HRViewTutorial label="Cómo consultar el resumen de RR. HH." targetPrefix="hr-dashboard" stepKeys={['title', 'data', 'items']} copy={{ data: { title: 'Indicadores principales', description: 'Consulta empleados activos, costo de nómina, ausencias pendientes y departamentos.' }, items: { title: 'Paneles de gestión', description: 'Revisa distribución por departamento, contrataciones recientes y desempeño.' } }} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-tour="hr-dashboard-data">
        {statCards.map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className={`border ${stat.border} hover:shadow-lg transition-all`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-black mt-1">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                  </div>
                  <div className={`size-10 rounded-2xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                    <stat.icon className={`size-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-tour="hr-dashboard-items">
        {/* Department Distribution - spans 2 cols */}
        <Card className="border-border/50 lg:col-span-2">
          <CardHeader className="border-b border-border/30 bg-muted/10 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
              <Briefcase className="size-4 text-purple-500" />
              Distribución por Departamento
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            {deptDistribution.slice(0, 8).map((dept: any, i: number) => {
              const pct = employees.length > 0 ? (dept.count / employees.length) * 100 : 0;
              return (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`size-2.5 rounded-full bg-gradient-to-r ${DEPT_COLORS[i % DEPT_COLORS.length]}`} />
                      <span className="text-sm font-bold">{dept.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{dept.count} empleados</span>
                      <span className="text-[10px] font-black text-muted-foreground/60 w-8 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.2 + i * 0.05, duration: 0.6, ease: 'easeOut' }}
                      className={`h-full rounded-full bg-gradient-to-r ${DEPT_COLORS[i % DEPT_COLORS.length]}`}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Pending Leaves */}
        <Card className="border-border/50">
          <CardHeader className="border-b border-border/30 bg-muted/10 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
              <Clock className="size-4 text-orange-500" />
              Ausencias Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {pendingLeaves > 0 ? (
              <div className="space-y-2">
                {leaveRequests.filter((l: any) => l.status === 'PENDING').slice(0, 6).map((leave: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-full bg-orange-500/10 flex items-center justify-center text-[10px] font-black text-orange-500">
                        {leave.employee?.firstName?.[0]}{leave.employee?.lastName?.[0]}
                      </div>
                      <div>
                        <p className="text-xs font-bold">{leave.employee?.firstName} {leave.employee?.lastName}</p>
                        <p className="text-[10px] text-muted-foreground">{leave.leaveType} · {leave.totalDays ?? leave.days ?? '?'} días</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-black bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full uppercase">Pendiente</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <UserCheck className="size-10 opacity-20 mb-2" />
                <p className="text-xs font-bold">Sin ausencias pendientes</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Hires */}
        <Card className="border-border/50">
          <CardHeader className="border-b border-border/30 bg-muted/10 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
              <UserCheck className="size-4 text-emerald-500" />
              Contrataciones Recientes
              <Badge className="ml-auto bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] font-black">Últimos 30 días</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {recentHires.length > 0 ? (
              <div className="space-y-2">
                {recentHires.slice(0, 5).map((emp: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/20 transition-colors">
                    <div className="size-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-black flex-shrink-0">
                      {emp.firstName?.[0]}{emp.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{emp.firstName} {emp.lastName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{emp.department?.name} · {emp.position?.title}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{new Date(emp.hireDate).toLocaleDateString('es', { day: '2-digit', month: 'short' })}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Activity className="size-10 opacity-20 mb-2" />
                <p className="text-xs font-bold">No hay contrataciones recientes</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Performers */}
        <Card className="border-border/50">
          <CardHeader className="border-b border-border/30 bg-muted/10 pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
              <Gift className="size-4 text-primary" />
              Últimos Beneficios
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {topPerformers.length > 0 ? (
              <div className="space-y-2">
                {topPerformers.map((emp: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/20 transition-colors">
                    <div className={`size-6 rounded-full flex items-center justify-center text-white text-[10px] font-black flex-shrink-0 ${i === 0 ? 'bg-yellow-700' : i === 1 ? 'bg-slate-500' : i === 2 ? 'bg-orange-700' : 'bg-muted-foreground/30'}`}>
                      {i + 1}
                    </div>
                    <div className="size-9 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                      {emp.firstName?.[0]}{emp.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{emp.firstName} {emp.lastName}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{emp.department?.name}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Award className="size-3 text-yellow-500" />
                      <span className="text-sm font-black text-yellow-500">{emp.avgRating.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Award className="size-10 opacity-20 mb-2" />
                <p className="text-xs font-bold">Sin evaluaciones aún</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

