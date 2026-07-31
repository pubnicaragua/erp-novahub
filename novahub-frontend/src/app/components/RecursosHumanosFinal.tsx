import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { cn } from './ui/utils';
import {
  Users, DollarSign, Calendar, TrendingUp, UserCheck, Plus, Search, RefreshCw,
  Edit2, Trash2, Save, X, Building2, Briefcase, CheckCircle2, XCircle, Clock
} from 'lucide-react';
import { hrService } from '../services/hr.service';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { ConfirmDialog } from './ui/ConfirmDialog';

export function RecursosHumanosFinal() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({ employees: [], departments: [], positions: [], payrolls: [], leaveRequests: [] });
  const [searchTerm, setSearchTerm] = useState('');
  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
  const [isDepartmentDialogOpen, setIsDepartmentDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [employeeForm, setEmployeeForm] = useState<any>({
    firstName: '', lastName: '', email: '', phone: '', departmentId: '', positionId: '',
    salary: '', contractType: 'FULL_TIME', hireDate: new Date().toISOString().split('T')[0]
  });
  const [departmentForm, setDepartmentForm] = useState({ code: '', name: '', description: '', budget: '' });
  const [pendingDeleteEmployee, setPendingDeleteEmployee] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [employeesRes, departmentsRes, positionsRes, payrollsRes, leaveRequestsRes] = await Promise.all([
        hrService.getEmployees(),
        hrService.getDepartments(),
        hrService.getPositions(),
        hrService.getPayrolls(),
        hrService.getLeaveRequests(),
      ]);
      setData({
        employees: employeesRes.data || [],
        departments: departmentsRes.data || [],
        positions: positionsRes.data || [],
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

  const handleCreateEmployee = async () => {
    try {
      await hrService.createEmployee({
        ...employeeForm,
        employeeNumber: `EMP${Date.now().toString().slice(-6)}`,
        salary: Number(employeeForm.salary),
      });
      toast.success('Empleado creado exitosamente');
      setIsEmployeeDialogOpen(false);
      resetEmployeeForm();
      fetchData();
    } catch (error) {
      toast.error('Error al crear empleado');
    }
  };

  const handleUpdateEmployee = async () => {
    try {
      await hrService.updateEmployee(selectedEmployee.id, employeeForm);
      toast.success('Empleado actualizado exitosamente');
      setIsEmployeeDialogOpen(false);
      setSelectedEmployee(null);
      resetEmployeeForm();
      fetchData();
    } catch (error) {
      toast.error('Error al actualizar empleado');
    }
  };

  const handleDeleteEmployee = (id: string, name: string) => {
    setPendingDeleteEmployee({ id, name });
  };

  const confirmDeleteEmployee = async () => {
    if (!pendingDeleteEmployee) return;
    try {
      await hrService.deleteEmployee(pendingDeleteEmployee.id);
      toast.success('Empleado eliminado');
      setPendingDeleteEmployee(null);
      fetchData();
    } catch (error) {
      toast.error('Error al eliminar empleado');
    }
  };

  const handleCreateDepartment = async () => {
    try {
      await hrService.createDepartment({ ...departmentForm, budget: Number(departmentForm.budget) || undefined });
      toast.success('Departamento creado');
      setIsDepartmentDialogOpen(false);
      setDepartmentForm({ code: '', name: '', description: '', budget: '' });
      fetchData();
    } catch (error) {
      toast.error('Error al crear departamento');
    }
  };

  const openEditEmployee = (emp: any) => {
    setSelectedEmployee(emp);
    setEmployeeForm({
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      phone: emp.phone || '',
      departmentId: emp.departmentId,
      positionId: emp.positionId,
      salary: emp.salary,
      contractType: emp.contractType,
      hireDate: new Date(emp.hireDate).toISOString().split('T')[0]
    });
    setIsEmployeeDialogOpen(true);
  };

  const resetEmployeeForm = () => {
    setEmployeeForm({
      firstName: '', lastName: '', email: '', phone: '', departmentId: '', positionId: '',
      salary: '', contractType: 'FULL_TIME', hireDate: new Date().toISOString().split('T')[0]
    });
  };

  const filteredEmployees = data.employees.filter((e: any) =>
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeEmployees = data.employees.filter((e: any) => e.employmentStatus === 'ACTIVE').length;
  const totalPayroll = data.payrolls.reduce((sum: number, p: any) => sum + Number(p.netPay || 0), 0);
  const pendingLeaves = data.leaveRequests.filter((l: any) => l.status === 'PENDING').length;

  const stats = [
    { title: 'Total Empleados', value: data.employees.length, subtitle: `${activeEmployees} activos`, icon: Users, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30' },
    { title: 'Planilla Mensual', value: `$${(totalPayroll / 1000).toFixed(1)}k`, subtitle: 'Costo total nómina', icon: DollarSign, color: 'text-emerald-600', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30' },
    { title: 'Vacaciones Pendientes', value: pendingLeaves, subtitle: 'Por aprobar', icon: Calendar, color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-950/30' },
    { title: 'Departamentos', value: data.departments.length, subtitle: 'Áreas activas', icon: Building2, color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/30' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-12 border-4 border-muted border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
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
          <p className="text-muted-foreground mt-1">{data.employees.length} empleados · {data.departments.length} departamentos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="size-4 mr-2" />Actualizar</Button>
          <Button size="sm" onClick={() => { setSelectedEmployee(null); resetEmployeeForm(); setIsEmployeeDialogOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="size-4 mr-2" />Nuevo Empleado
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsDepartmentDialogOpen(true)}><Building2 className="size-4 mr-2" />Nuevo Depto</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card className="border-border/40 hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{stat.title}</p>
                    <h3 className="text-3xl font-bold tracking-tight">{stat.value}</h3>
                    <p className="text-sm text-muted-foreground">{stat.subtitle}</p>
                  </div>
                  <div className={cn("p-3 rounded-xl", stat.bgColor)}><stat.icon className={cn("size-6", stat.color)} /></div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Employees Table */}
      <Card className="border-border/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Directorio de Empleados</CardTitle>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input placeholder="Buscar empleados..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 w-64" />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredEmployees.map((emp: any, i: number) => (
              <motion.div key={emp.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                className="flex items-center justify-between p-4 rounded-lg border border-border/40 hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="size-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-semibold text-sm">
                    {emp.firstName?.[0]}{emp.lastName?.[0]}
                  </div>
                  <div>
                    <p className="font-medium">{emp.firstName} {emp.lastName}</p>
                    <p className="text-sm text-muted-foreground">{emp.position?.title || 'Sin puesto'} · {emp.department?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={emp.employmentStatus === 'ACTIVE' ? 'default' : 'secondary'} className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                    {emp.employmentStatus}
                  </Badge>
                  <span className="text-sm font-medium text-muted-foreground">${Number(emp.salary || 0).toLocaleString()}</span>
                  <Button variant="ghost" size="sm" onClick={() => openEditEmployee(emp)}><Edit2 className="size-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteEmployee(emp.id, `${emp.firstName} ${emp.lastName}`)}><Trash2 className="size-4 text-red-600" /></Button>
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Employee Dialog */}
      <Dialog open={isEmployeeDialogOpen} onOpenChange={setIsEmployeeDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{selectedEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={employeeForm.firstName} onChange={e => setEmployeeForm({...employeeForm, firstName: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Apellido</Label>
              <Input value={employeeForm.lastName} onChange={e => setEmployeeForm({...employeeForm, lastName: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={employeeForm.email} onChange={e => setEmployeeForm({...employeeForm, email: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={employeeForm.phone} onChange={e => setEmployeeForm({...employeeForm, phone: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={employeeForm.departmentId} onValueChange={v => setEmployeeForm({...employeeForm, departmentId: v})}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {data.departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Puesto</Label>
              <Select value={employeeForm.positionId} onValueChange={v => setEmployeeForm({...employeeForm, positionId: v})}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {data.positions.filter((p: any) => p.departmentId === employeeForm.departmentId).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Salario</Label>
              <Input type="number" value={employeeForm.salary} onChange={e => setEmployeeForm({...employeeForm, salary: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Tipo Contrato</Label>
              <Select value={employeeForm.contractType} onValueChange={v => setEmployeeForm({...employeeForm, contractType: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL_TIME">Tiempo Completo</SelectItem>
                  <SelectItem value="PART_TIME">Medio Tiempo</SelectItem>
                  <SelectItem value="CONTRACTOR">Contratista</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmployeeDialogOpen(false)}>Cancelar</Button>
            <Button onClick={selectedEmployee ? handleUpdateEmployee : handleCreateEmployee} className="bg-emerald-600 hover:bg-emerald-700">
              {selectedEmployee ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDeleteEmployee)}
        onOpenChange={open => { if (!open) setPendingDeleteEmployee(null); }}
        title="¿Eliminar empleado?"
        description={pendingDeleteEmployee ? `Se eliminará a ${pendingDeleteEmployee.name}. Esta acción no se puede deshacer.` : undefined}
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={confirmDeleteEmployee}
      />

      {/* Department Dialog */}
      <Dialog open={isDepartmentDialogOpen} onOpenChange={setIsDepartmentDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuevo Departamento</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Código</Label>
              <Input value={departmentForm.code} onChange={e => setDepartmentForm({...departmentForm, code: e.target.value})} placeholder="ENG, SALES..." />
            </div>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={departmentForm.name} onChange={e => setDepartmentForm({...departmentForm, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea value={departmentForm.description} onChange={e => setDepartmentForm({...departmentForm, description: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDepartmentDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateDepartment} className="bg-emerald-600 hover:bg-emerald-700">Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
