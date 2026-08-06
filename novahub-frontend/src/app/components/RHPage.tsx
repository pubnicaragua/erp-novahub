import { useState, useEffect } from 'react';
import { Users, UserCircle, FileSpreadsheet, CalendarClock, Plus, Search, Edit, DollarSign, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { employeesService, payrollService, timeOffService } from '../services/rh.service';
import type { Employee, Payroll, TimeOff, PaginatedResponse } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface RHPageProps {
  activeSubModule?: string;
}

const statusColors: Record<string, string> = {
  'active': 'bg-green-500/10 text-green-400',
  'vacation': 'bg-blue-500/10 text-blue-400',
  'terminated': 'bg-gray-500/10 text-gray-400',
  'paid': 'bg-green-500/10 text-green-400',
  'pending': 'bg-yellow-500/10 text-yellow-400',
  'approved': 'bg-green-500/10 text-green-400',
  'rejected': 'bg-red-500/10 text-red-400',
};

export function RHPage({ activeSubModule }: RHPageProps) {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const tabMap: Record<string, string> = { 'empleados': 'empleados', 'planillas': 'planillas', 'vacaciones': 'vacaciones' };
  const [activeTab, setActiveTab] = useState(() => activeSubModule ? (tabMap[activeSubModule] || 'empleados') : 'empleados');

  const [empleadosData, setEmpleadosData] = useState<Employee[]>([]);
  const [planillasArr, setPlanillasArr] = useState<Payroll[]>([]);
  const [vacacionesArr, setVacacionesArr] = useState<TimeOff[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRHData = async () => {
    try {
      setLoading(true);
      const [emp, pay, vac] = await Promise.all([
        employeesService.getAll() as Promise<PaginatedResponse<Employee>>,
        payrollService.getAll() as Promise<PaginatedResponse<Payroll>>,
        timeOffService.getAll() as Promise<PaginatedResponse<TimeOff>>
      ]);
      setEmpleadosData(emp.data || []);
      setPlanillasArr(pay.data || []);
      setVacacionesArr(vac.data || []);
    } catch (error) {
      console.error('Error fetching RH data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(fetchRHData);
  }, []);

  const [prevSubModule, setPrevSubModule] = useState(activeSubModule);
  if (activeSubModule !== prevSubModule) {
    setPrevSubModule(activeSubModule);
    setActiveTab(tabMap[activeSubModule || 'empleados'] || 'empleados');
  }

  const [isEmpleadoDialogOpen, setIsEmpleadoDialogOpen] = useState(false);
  const [editingEmpleado, setEditingEmpleado] = useState<Employee | null>(null);
  const [empForm, setEmpForm] = useState<Partial<Employee>>({
    firstName: '',
    lastName: '',
    position: '',
    department: '',
    salary: 0,
    hireDate: new Date().toISOString().split('T')[0],
    status: 'active'
  });

  const [isPlanillaDialogOpen, setIsPlanillaDialogOpen] = useState(false);
  const [editingPlanilla, setEditingPlanilla] = useState<Payroll | null>(null);
  const [planillaForm, setPlanillaForm] = useState<Partial<Payroll>>({ 
    number: '', 
    periodStart: '', 
    periodEnd: '', 
    payDate: '', 
    totalGross: 0, 
    totalDeductions: 0, 
    totalNet: 0, 
    status: 'draft' 
  });

  const [isVacacionesDialogOpen, setIsVacacionesDialogOpen] = useState(false);
  const [editingVacaciones, setEditingVacaciones] = useState<TimeOff | null>(null);
  const [vacacionesForm, setVacacionesForm] = useState<Partial<TimeOff>>({ 
    employeeId: '', 
    type: 'vacation', 
    startDate: '', 
    endDate: '', 
    status: 'pending' 
  });

  const [pendingDeleteEmpId, setPendingDeleteEmpId] = useState<string | null>(null);
  const [pendingDeleteVacId, setPendingDeleteVacId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleOpenEmpleado = (emp?: Employee) => {
    if (emp) {
      setEditingEmpleado(emp);
      setEmpForm(emp);
    } else {
      setEditingEmpleado(null);
      setEmpForm({ 
        firstName: '', 
        lastName: '', 
        position: '', 
        department: '', 
        salary: 0, 
        hireDate: new Date().toISOString().split('T')[0], 
        status: 'active' 
      });
    }
    setIsEmpleadoDialogOpen(true);
  };

  const handleSaveEmpleado = async () => {
    try {
      if (editingEmpleado) {
        await employeesService.update(editingEmpleado.id, empForm);
      } else {
        await employeesService.create(empForm);
      }
      fetchRHData();
      setIsEmpleadoDialogOpen(false);
    } catch (error) {
      console.error('Error saving empleado:', error);
    }
  };

  const handleDeleteEmpleado = async (id: string) => {
    try {
      setDeleteLoading(true);
      await employeesService.terminate(id, new Date().toISOString());
      fetchRHData();
    } catch (error) {
      console.error('Error terminating employee:', error);
    } finally {
      setDeleteLoading(false);
      setPendingDeleteEmpId(null);
    }
  };

  const handleOpenPlanilla = (plan?: Payroll) => {
    if (plan) {
      setEditingPlanilla(plan);
      setPlanillaForm(plan);
    } else {
      setEditingPlanilla(null);
      setPlanillaForm({ 
        number: `PL-${new Date().getTime()}`, 
        periodStart: '', 
        periodEnd: '', 
        payDate: '', 
        totalGross: 0, 
        totalDeductions: 0, 
        totalNet: 0, 
        status: 'draft' 
      });
    }
    setIsPlanillaDialogOpen(true);
  };

  const handleSavePlanilla = async () => {
    try {
      if (!editingPlanilla) {
        await payrollService.create(planillaForm);
      }
      fetchRHData();
      setIsPlanillaDialogOpen(false);
    } catch (error) {
      console.error('Error saving planilla:', error);
    }
  };

  const handleOpenVacaciones = (vac?: TimeOff) => {
    if (vac) {
      setEditingVacaciones(vac);
      setVacacionesForm(vac);
    } else {
      setEditingVacaciones(null);
      setVacacionesForm({ 
        employeeId: '', 
        type: 'vacation', 
        startDate: '', 
        endDate: '', 
        status: 'pending' 
      });
    }
    setIsVacacionesDialogOpen(true);
  };

  const handleSaveVacaciones = async () => {
    try {
      if (!editingVacaciones) {
        await timeOffService.create(vacacionesForm);
      }
      fetchRHData();
      setIsVacacionesDialogOpen(false);
    } catch (error) {
      console.error('Error saving vacaciones:', error);
    }
  };

  const handleDeleteVacaciones = async (id: string) => {
    try {
      setDeleteLoading(true);
      // await timeOffService.delete(id);
      fetchRHData();
    } catch (error) {
      console.error('Error deleting vacation:', error);
    } finally {
      setDeleteLoading(false);
      setPendingDeleteVacId(null);
    }
  };

  const kpis = {
    totalEmpleados: empleadosData.length,
    enVacaciones: empleadosData.filter(e => e.status === 'on_leave').length,
    planillaMensual: planillasArr.reduce((acc, p) => acc + p.totalNet, 0),
    vacacionesPendientes: vacacionesArr.filter(v => v.status === 'pending').length
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Users className="size-6 text-primary" />
          Recursos Humanos
        </h1>
        <p className="text-sm text-muted-foreground">Gestion de empleados, planillas y vacaciones</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Users className="size-4" />Total Empleados</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-400">{kpis.totalEmpleados}</div><p className="text-xs text-muted-foreground mt-1">{kpis.enVacaciones} en vacaciones</p></CardContent>
        </Card>
        <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><DollarSign className="size-4" />Planilla Mensual</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-400">${kpis.planillaMensual.toLocaleString()}</div><p className="text-xs text-muted-foreground mt-1">Costo total nomina</p></CardContent>
        </Card>
        <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><CalendarClock className="size-4" />Vacaciones Pendientes</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-orange-400">{kpis.vacacionesPendientes}</div><p className="text-xs text-muted-foreground mt-1">Por aprobar</p></CardContent>
        </Card>
        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Nuevas Contrataciones</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-purple-400">3</div><p className="text-xs text-muted-foreground mt-1">Este trimestre</p></CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between bg-muted/30 p-1.5 pb-2 rounded-lg border border-border/50 overflow-x-auto">
          <TabsList className="bg-transparent border-none flex-nowrap shrink-0 justify-start w-full h-auto px-1 py-1 gap-1">
            {[
              { id: 'empleados', label: 'Empleados', icon: UserCircle, module: 'HR_EMPLOYEES' },
              { id: 'planillas', label: 'Planillas', icon: FileSpreadsheet, module: 'HR_PAYROLL' },
              { id: 'vacaciones', label: 'Vacaciones', icon: CalendarClock, module: 'HR_LEAVES' },
            ].map((tab) => {
              const hasAccess = !user?.enabledModules || user.enabledModules.includes(tab.module);
              if (!hasAccess) return null;
              return (
                <TabsTrigger key={tab.id} value={tab.id}><tab.icon className="mr-1.5 size-3.5" />{tab.label}</TabsTrigger>
              );
            })}
          </TabsList>
          <div className="flex gap-2">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Buscar..." className="pl-9 w-60 h-9" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={() => {
              if (activeTab === 'empleados') handleOpenEmpleado();
              else if (activeTab === 'planillas') handleOpenPlanilla();
              else if (activeTab === 'vacaciones') handleOpenVacaciones();
            }} className="h-9"><Plus className="mr-2 size-4" />Nuevo Registro</Button>
          </div>
        </div>

        <TabsContent value="empleados">
          <Card><CardHeader><CardTitle>Directorio de Empleados</CardTitle></CardHeader><CardContent>
            <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Nombre</TableHead><TableHead>Cargo</TableHead><TableHead>Departamento</TableHead><TableHead className="text-right">Salario</TableHead><TableHead>Ingreso</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
              <TableBody>{empleadosData.filter((e) => `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())).map((e) => (
                <TableRow key={e.id} className="hover:bg-muted/20">
                  <TableCell className="font-medium">{(e as any).code || e.id}</TableCell>
                  <TableCell className="font-medium">{e.firstName} {e.lastName}</TableCell>
                  <TableCell>{e.position}</TableCell>
                  <TableCell className="text-muted-foreground">{e.department}</TableCell>
                  <TableCell className="text-right font-semibold text-green-500">${e.salary.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(e.hireDate).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant="secondary" className={statusColors[e.status]}>{e.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button onClick={() => handleOpenEmpleado(e)} variant="ghost" size="icon" className="size-8"><Edit className="size-4" /></Button>
                      <Button onClick={() => setPendingDeleteEmpId(e.id)} variant="ghost" size="icon" className="size-8 text-red-500 hover:text-red-600"><Trash2 className="size-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}</TableBody></Table></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="planillas">
          <Card><CardHeader><CardTitle>Historial de Planillas</CardTitle><CardDescription>Registro de pagos de nomina</CardDescription></CardHeader><CardContent>
            <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Periodo</TableHead><TableHead className="text-center">Empleados</TableHead><TableHead className="text-right">Bruto</TableHead><TableHead className="text-right">Deducciones</TableHead><TableHead className="text-right">Neto</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
              <TableBody>{planillasArr.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/20">
                  <TableCell className="font-medium">{p.number}</TableCell>
                  <TableCell>{new Date(p.periodStart).toLocaleDateString()} - {new Date(p.periodEnd).toLocaleDateString()}</TableCell>
                  <TableCell className="text-center">{p.employeeCount}</TableCell>
                  <TableCell className="text-right">${p.totalGross.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-red-400">${p.totalDeductions.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold text-green-400">${p.totalNet.toLocaleString()}</TableCell>
                  <TableCell><Badge variant="secondary" className={statusColors[p.status]}>{p.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button onClick={() => handleOpenPlanilla(p)} variant="ghost" size="icon" className="size-8"><Edit className="size-4" /></Button>
                      <Button variant="ghost" size="icon" className="size-8 text-red-500 hover:text-red-600"><Trash2 className="size-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}</TableBody></Table></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="vacaciones">
          <Card><CardHeader><CardTitle>Solicitudes de Vacaciones</CardTitle></CardHeader><CardContent>
            <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Empleado</TableHead><TableHead>Tipo</TableHead><TableHead>Desde</TableHead><TableHead>Hasta</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
              <TableBody>{vacacionesArr.map((v) => (
                <TableRow key={v.id} className="hover:bg-muted/20">
                  <TableCell className="font-medium">{v.id}</TableCell>
                  <TableCell className="font-medium">{v.employee?.firstName} {v.employee?.lastName || v.employeeId}</TableCell>
                  <TableCell className="text-muted-foreground">{v.type}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(v.startDate).toLocaleDateString()}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(v.endDate).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant="secondary" className={statusColors[v.status]}>{v.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button onClick={() => handleOpenVacaciones(v)} variant="ghost" size="icon" className="size-8"><Edit className="size-4" /></Button>
                      <Button onClick={() => setPendingDeleteVacId(v.id)} variant="ghost" size="icon" className="size-8 text-red-500 hover:text-red-600"><Trash2 className="size-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}</TableBody></Table></div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para Empleados */}
      <Dialog open={isEmpleadoDialogOpen} onOpenChange={setIsEmpleadoDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingEmpleado ? 'Editar Empleado' : 'Nuevo Empleado'}</DialogTitle>
            <DialogDescription>Gestiona el registro en el directorio de la empresa.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Nombre</Label>
              <Input className="col-span-3" value={empForm.firstName || ''} onChange={e => setEmpForm({ ...empForm, firstName: e.target.value })} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Apellido</Label>
              <Input className="col-span-3" value={empForm.lastName || ''} onChange={e => setEmpForm({ ...empForm, lastName: e.target.value })} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Cargo</Label>
              <Input className="col-span-3" value={empForm.position || ''} onChange={e => setEmpForm({ ...empForm, position: e.target.value })} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Depto.</Label>
              <Input className="col-span-3" value={empForm.department || ''} onChange={e => setEmpForm({ ...empForm, department: e.target.value })} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Salario</Label>
              <Input className="col-span-3" type="number" value={empForm.salary || 0} onChange={e => setEmpForm({ ...empForm, salary: Number(e.target.value) })} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Estado</Label>
              <Select value={empForm.status} onValueChange={(val: any) => setEmpForm({ ...empForm, status: val })}>
                <SelectTrigger className="col-span-3"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="terminated">Inactivo</SelectItem>
                  <SelectItem value="on_leave">En Vacaciones</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmpleadoDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-[#05602b] text-white hover:bg-[#044c22]" onClick={handleSaveEmpleado}>Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isPlanillaDialogOpen} onOpenChange={setIsPlanillaDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingPlanilla ? 'Editar Registro de Planilla' : 'Nuevo Registro de Planilla'}</DialogTitle>
            <DialogDescription>Genera o ajusta registros históricos de nómina.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Número</Label>
              <Input className="col-span-3" value={planillaForm.number || ''} onChange={e => setPlanillaForm({ ...planillaForm, number: e.target.value })} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Inicio</Label>
              <Input className="col-span-3" type="date" value={planillaForm.periodStart || ''} onChange={e => setPlanillaForm({ ...planillaForm, periodStart: e.target.value })} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Fin</Label>
              <Input className="col-span-3" type="date" value={planillaForm.periodEnd || ''} onChange={e => setPlanillaForm({ ...planillaForm, periodEnd: e.target.value })} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Fecha Pago</Label>
              <Input className="col-span-3" type="date" value={planillaForm.payDate || ''} onChange={e => setPlanillaForm({ ...planillaForm, payDate: e.target.value })} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Monto Bruto</Label>
              <Input className="col-span-3" type="number" value={planillaForm.totalGross || 0} onChange={e => setPlanillaForm({ ...planillaForm, totalGross: Number(e.target.value) })} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Deducciones</Label>
              <Input className="col-span-3" type="number" value={planillaForm.totalDeductions || 0} onChange={e => setPlanillaForm({ ...planillaForm, totalDeductions: Number(e.target.value) })} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Estado</Label>
              <Select value={planillaForm.status} onValueChange={(val: any) => setPlanillaForm({ ...planillaForm, status: val })}>
                <SelectTrigger className="col-span-3"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="processing">Procesando</SelectItem>
                  <SelectItem value="approved">Aprobado</SelectItem>
                  <SelectItem value="paid">Pagado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPlanillaDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-[#05602b] text-white hover:bg-[#044c22]" onClick={handleSavePlanilla}>Guardar Registro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para Vacaciones */}
      <Dialog open={isVacacionesDialogOpen} onOpenChange={setIsVacacionesDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingVacaciones ? 'Editar Solicitud' : 'Nueva Solicitud de Vacaciones'}</DialogTitle>
            <DialogDescription>Tramita ausencias programadas y aprobaciones de vacaciones.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Empleado ID</Label>
              <Input className="col-span-3" value={vacacionesForm.employeeId || ''} onChange={e => setVacacionesForm({ ...vacacionesForm, employeeId: e.target.value })} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Tipo</Label>
              <Select value={vacacionesForm.type} onValueChange={(val: any) => setVacacionesForm({ ...vacacionesForm, type: val })}>
                <SelectTrigger className="col-span-3"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacation">Vacaciones</SelectItem>
                  <SelectItem value="sick_leave">Enfermedad</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Desde</Label>
              <Input className="col-span-3" type="date" value={vacacionesForm.startDate || ''} onChange={e => setVacacionesForm({ ...vacacionesForm, startDate: e.target.value })} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Hasta</Label>
              <Input className="col-span-3" type="date" value={vacacionesForm.endDate || ''} onChange={e => setVacacionesForm({ ...vacacionesForm, endDate: e.target.value })} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Estado</Label>
              <Select value={vacacionesForm.status} onValueChange={(val: any) => setVacacionesForm({ ...vacacionesForm, status: val })}>
                <SelectTrigger className="col-span-3"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Aprobada</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="rejected">Rechazada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVacacionesDialogOpen(false)}>Cancelar</Button>
            <Button className="bg-[#05602b] text-white hover:bg-[#044c22]" onClick={handleSaveVacaciones}>Guardar Solicitud</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación para eliminar empleado */}
      <ConfirmDialog
        open={pendingDeleteEmpId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteEmpId(null); }}
        title="¿Eliminar empleado?"
        description="¿Estás seguro de que deseas eliminar este empleado? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={() => pendingDeleteEmpId ? handleDeleteEmpleado(pendingDeleteEmpId) : Promise.resolve()}
      />

      {/* Confirmación para eliminar solicitud vacacional */}
      <ConfirmDialog
        open={pendingDeleteVacId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteVacId(null); }}
        title="¿Eliminar solicitud?"
        description="¿Estás seguro de que deseas eliminar esta solicitud de vacaciones? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteLoading}
        onConfirm={() => pendingDeleteVacId ? handleDeleteVacaciones(pendingDeleteVacId) : Promise.resolve()}
      />
    </div>
  );
}
