import { useEffect, useMemo, useState } from 'react';
import { Activity, Award, Banknote, BriefcaseBusiness, Building2, CalendarDays, CheckCircle2, Clock3, CreditCard, FileText, History, Loader2, Mail, MapPin, Pencil, Phone, ShieldCheck, User } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '../ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { hrService } from '../../services/hr.service';
import { HRViewTutorial } from './HRViewTutorial';

type EmployeeDetailDrawerProps = {
  employeeId: string | null;
  employeeSnapshot?: any | null;
  onOpenChange: (open: boolean) => void;
  onEdit?: (employee: any) => void;
  onManageDepartments?: (employee: any) => void;
  canEdit?: boolean;
};

type DetailTab = 'general' | 'nominas' | 'historial';

const unwrapList = (response: any): any[] => {
  const value = response?.data?.data ?? response?.data ?? response;
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

const unwrapObject = (response: any): any => response?.data?.data ?? response?.data ?? response;

const formatDate = (value: any) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};

const formatAmount = (value: any, currency = 'NIO') => {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat('es-NI', { style: 'currency', currency: currency || 'NIO', maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency || 'NIO'} ${amount.toFixed(2)}`;
  }
};

const statusLabel = (status?: string) => ({
  ACTIVE: 'Activo', INACTIVE: 'Inactivo', ON_LEAVE: 'En ausencia', TERMINATED: 'Terminado',
} as Record<string, string>)[String(status || '').toUpperCase()] || 'No especificado';

const approvalLabel = (status?: string) => ({
  APPROVED: 'Aprobado', PENDING_APPROVAL: 'Pendiente', REJECTED: 'Rechazado', DRAFT: 'Borrador',
} as Record<string, string>)[String(status || '').toUpperCase()] || 'No especificado';

const payrollStatusLabel = (status?: string) => ({
  DRAFT: 'Borrador', PROCESSING: 'En proceso', APPROVED: 'Aprobada', PAID: 'Pagada',
} as Record<string, string>)[String(status || '').toUpperCase()] || 'No especificado';

const payFrequencyLabel = (frequency?: string) => ({
  WEEKLY: 'Semanal', BIWEEKLY: 'Quincenal', MONTHLY: 'Mensual', HOURLY: 'Por hora',
} as Record<string, string>)[String(frequency || '').toUpperCase()] || 'No especificada';

const contractLabel = (value?: string) => ({
  FULL_TIME: 'Tiempo completo', PART_TIME: 'Medio tiempo', CONTRACTOR: 'Contratista', INTERN: 'Pasante', TEMPORARY: 'Temporal',
} as Record<string, string>)[String(value || '').toUpperCase()] || value || '—';

const fieldLabel = (value?: string) => ({
  salary: 'Salario', positionId: 'Puesto', departmentId: 'Departamento', managerId: 'Responsable', contractType: 'Tipo de contrato', isSeller: 'Vendedor',
  employmentStatus: 'Estado laboral', nationalId: 'Cédula', email: 'Correo', phone: 'Teléfono', hireDate: 'Fecha de contratación',
} as Record<string, string>)[String(value || '')] || value || 'Cambio';

const changeValueLabel = (field?: string, value?: string) => {
  if (!value || value === 'null' || value === '') return 'Vacío';
  if (field === 'employmentStatus') return statusLabel(value);
  if (field === 'approvalStatus') return approvalLabel(value);
  if (field === 'payFrequency') return payFrequencyLabel(value);
  if (field === 'contractType') return contractLabel(value);
  if (field === 'salary') {
    const amount = Number(value);
    if (!Number.isNaN(amount)) return `C$ ${amount.toLocaleString('es-NI', { maximumFractionDigits: 2 })}`;
  }
  if (field === 'isSeller') return value === 'true' ? 'Sí' : value === 'false' ? 'No' : value;
  return value;
};

function InfoItem({ label, value, icon: Icon = FileText, mono = false }: { label: string; value?: any; icon?: any; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/40 bg-muted/[0.14] p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><Icon className="size-3.5 text-primary" /> {label}</p>
      <p className={`mt-1 truncate text-sm font-semibold text-foreground ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: any; title: string; description: string }) {
  return <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/[0.12] px-6 py-12 text-center"><Icon className="size-8 text-muted-foreground/50" /><p className="mt-3 text-sm font-bold">{title}</p><p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p></div>;
}

export function EmployeeDetailDrawer({ employeeId, employeeSnapshot, onOpenChange, onEdit, onManageDepartments, canEdit = false }: EmployeeDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('general');
  const [detail, setDetail] = useState<any | null>(employeeSnapshot || null);
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [changeLog, setChangeLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId) {
      setDetail(null);
      setPayrolls([]);
      setChangeLog([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setDetail(employeeSnapshot || null);
    setPayrolls([]);
    setChangeLog([]);
    setError(null);
    setActiveTab('general');
    setLoading(true);

    Promise.allSettled([
      hrService.getEmployee(employeeId),
      hrService.getPayrolls({ employeeId, page: 1, pageSize: 100 }),
      hrService.getEmployeeChangeLog(employeeId),
    ]).then(([employeeResult, payrollResult, historyResult]) => {
      if (cancelled) return;
      if (employeeResult.status === 'fulfilled') setDetail(unwrapObject(employeeResult.value) || employeeSnapshot || null);
      else setError('No se pudo cargar el expediente completo del empleado.');
      if (payrollResult.status === 'fulfilled') setPayrolls(unwrapList(payrollResult.value));
      else if (employeeResult.status === 'fulfilled') setPayrolls(unwrapObject(employeeResult.value)?.payrolls || []);
      if (historyResult.status === 'fulfilled') setChangeLog(unwrapList(historyResult.value));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [employeeId, employeeSnapshot]);

  const employee = detail || employeeSnapshot || null;
  const isOpen = Boolean(employeeId);
  const initials = `${employee?.firstName?.[0] || ''}${employee?.lastName?.[0] || ''}` || '?';
  const totalNet = useMemo(() => payrolls.reduce((sum, payroll) => sum + Number(payroll.netPay || 0), 0), [payrolls]);
  const status = String(employee?.employmentStatus || '').toUpperCase();
  const statusClass = status === 'ACTIVE' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600' : status === 'INACTIVE' ? 'border-muted bg-muted text-muted-foreground' : 'border-amber-500/20 bg-amber-500/10 text-amber-600';

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="erp-detail-panel w-full gap-0 overflow-hidden border-l border-border/50 bg-background p-0">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DetailTab)} className="flex min-h-0 flex-1 flex-col gap-0">
          <SheetHeader className="sticky top-0 z-10 space-y-3 border-b border-border/50 bg-background/95 px-5 py-4 backdrop-blur-md sm:px-6" data-tour="hr-employee-detail-title">
            <div className="flex items-start gap-3 pr-8">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-lg font-black text-primary shadow-inner">{initials.toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="truncate text-lg font-black tracking-tight">{employee ? `${employee.firstName} ${employee.lastName}` : 'Cargando empleado…'}</SheetTitle>
                  {employee && <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-wider ${statusClass}`}>{statusLabel(employee.employmentStatus)}</Badge>}
                </div>
                <SheetDescription className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs"><span className="font-mono font-bold">{employee?.employeeNumber || '—'}</span><span>•</span><span>{employee?.email || 'Sin correo'}</span>{employee?.nationalId && <><span>•</span><span>Cédula {employee.nationalId}</span></>}{loading && <span role="status" className="inline-flex items-center gap-1 font-bold text-primary"><Loader2 className="size-3 animate-spin" /> Cargando detalle…</span>}</SheetDescription>
              </div>
            </div>
            <div className="flex flex-wrap gap-2" data-tour="hr-employee-detail-actions">
              {canEdit && employee && <Button type="button" size="sm" variant="outline" className="h-8 rounded-xl text-xs" onClick={() => { onOpenChange(false); onEdit?.(employee); }}><Pencil className="size-3.5" /> Editar</Button>}
              {canEdit && employee && <Button type="button" size="sm" variant="outline" className="h-8 rounded-xl text-xs" onClick={() => { onOpenChange(false); onManageDepartments?.(employee); }}><Building2 className="size-3.5" /> Departamentos</Button>}
              <HRViewTutorial label="Cómo consultar empleado" targetPrefix="hr-employee-detail" copy={{ data: { description: 'Revisa datos personales, laborales, actividad, nóminas y cambios del expediente.' }, actions: { description: 'Edita el empleado o administra sus departamentos si tienes permisos.' } }} />
            </div>
            <TabsList className="h-9 w-full justify-start gap-1 overflow-x-auto rounded-xl border border-border/40 bg-muted/40 p-1">
              <TabsTrigger value="general" className="shrink-0 rounded-lg px-3 text-xs font-bold"><User className="mr-1.5 size-3.5" /> General</TabsTrigger>
              <TabsTrigger value="nominas" className="shrink-0 rounded-lg px-3 text-xs font-bold"><Banknote className="mr-1.5 size-3.5" /> Nóminas ({payrolls.length})</TabsTrigger>
              <TabsTrigger value="historial" className="shrink-0 rounded-lg px-3 text-xs font-bold"><History className="mr-1.5 size-3.5" /> Cambios ({changeLog.length})</TabsTrigger>
            </TabsList>
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1 overflow-hidden" data-tour="hr-employee-detail-data">
            <div className="space-y-5 p-5 sm:p-6">
              {error && <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs font-bold text-destructive">{error}</div>}
              {loading && !employee ? <div className="space-y-4"><Skeleton className="h-24 w-full rounded-2xl" /><Skeleton className="h-40 w-full rounded-2xl" /><Skeleton className="h-40 w-full rounded-2xl" /></div> : (
                <>
                  <TabsContent value="general" className="mt-0 space-y-5 outline-none">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <InfoItem label="Puesto" value={employee?.position?.title} icon={BriefcaseBusiness} />
                      <InfoItem label="Departamento" value={employee?.department?.name} icon={Building2} />
                      <InfoItem label="Salario" value={formatAmount(employee?.salary, employee?.currency)} icon={Banknote} />
                      <InfoItem label="Autorización" value={approvalLabel(employee?.approvalStatus)} icon={ShieldCheck} />
                    </div>

                    <Card className="space-y-4 rounded-2xl border-border/60 bg-card p-5 shadow-sm">
                      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground"><User className="size-4 text-primary" /> Datos personales y contacto</h3>
                      <div className="grid gap-3 sm:grid-cols-2"><InfoItem label="Correo electrónico" value={employee?.email} icon={Mail} /><InfoItem label="Teléfono" value={employee?.phone} icon={Phone} /><InfoItem label="Cédula" value={employee?.nationalId} icon={CreditCard} mono /><InfoItem label="Seguro social" value={employee?.socialSecurityNumber} icon={CreditCard} mono /><InfoItem label="Fecha de nacimiento" value={formatDate(employee?.dateOfBirth)} icon={CalendarDays} /><InfoItem label="Dirección" value={employee?.address} icon={MapPin} /><InfoItem label="Ciudad / Estado" value={[employee?.city, employee?.state].filter(Boolean).join(' · ')} icon={MapPin} /><InfoItem label="País / Código postal" value={[employee?.country, employee?.postalCode].filter(Boolean).join(' · ')} icon={MapPin} /></div>
                    </Card>

                    <Card className="space-y-4 rounded-2xl border-border/60 bg-card p-5 shadow-sm">
                      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground"><BriefcaseBusiness className="size-4 text-primary" /> Información laboral</h3>
                      <div className="grid gap-3 sm:grid-cols-2"><InfoItem label="Número de empleado" value={employee?.employeeNumber} icon={FileText} mono /><InfoItem label="Fecha de contratación" value={formatDate(employee?.hireDate)} icon={CalendarDays} /><InfoItem label="Tipo de contrato" value={contractLabel(employee?.contractType)} icon={BriefcaseBusiness} /><InfoItem label="Frecuencia de pago" value={payFrequencyLabel(employee?.payFrequency)} icon={Clock3} /><InfoItem label="Fin de prueba" value={formatDate(employee?.probationEndDate)} icon={CalendarDays} /><InfoItem label="Responsable" value={employee?.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : 'Sin responsable'} icon={User} /><InfoItem label="Estado laboral" value={statusLabel(employee?.employmentStatus)} icon={CheckCircle2} /><InfoItem label="Elegibilidad de vendedor" value={employee?.department?.isSellerDepartment ? 'Por departamento vendedor' : 'No determinada por este departamento'} icon={Award} /></div>
                      {employee?.departmentMemberships?.length > 0 && <div className="border-t border-border/40 pt-4"><p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Departamentos vinculados</p><div className="flex flex-wrap gap-2">{employee.departmentMemberships.map((membership: any) => <Badge key={membership.id || membership.department?.id} variant="outline" className="gap-1.5 rounded-lg text-xs"><Building2 className="size-3" /> {membership.department?.name || 'Departamento'}{membership.isPrimary && <span className="text-primary">· Principal</span>}</Badge>)}</div></div>}
                    </Card>

                    <Card className="space-y-4 rounded-2xl border-border/60 bg-card p-5 shadow-sm">
                      <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground"><Activity className="size-4 text-primary" /> Actividad de Recursos Humanos</h3>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><InfoItem label="Asistencias" value={employee?.attendances?.length || 0} icon={Clock3} /><InfoItem label="Ausencias" value={employee?.leaveRequests?.length || 0} icon={CalendarDays} /><InfoItem label="Evaluaciones" value={employee?.reviews?.length || 0} icon={Award} /><InfoItem label="Capacitaciones" value={employee?.trainings?.length || 0} icon={FileText} /></div>
                    </Card>
                    {employee?.notes && <Card className="rounded-2xl border-border/60 bg-card p-5 shadow-sm"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notas del expediente</p><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{employee.notes}</p></Card>}
                  </TabsContent>

                  <TabsContent value="nominas" className="mt-0 space-y-4 outline-none">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><InfoItem label="Registros" value={payrolls.length} icon={FileText} /><InfoItem label="Neto acumulado visible" value={formatAmount(totalNet, employee?.currency)} icon={Banknote} /><InfoItem label="Moneda habitual" value={employee?.currency || 'NIO'} icon={CreditCard} /></div>
                    {payrolls.length === 0 ? <EmptyState icon={Banknote} title="Sin nóminas registradas" description="Este empleado todavía no tiene pagos de nómina registrados en el sistema." /> : <>
                      <Card className="hidden overflow-hidden rounded-2xl border-border/60 shadow-sm lg:block"><Table><TableHeader className="bg-muted/40"><TableRow><TableHead className="text-[10px] font-black uppercase tracking-widest">Período</TableHead><TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead><TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Base</TableHead><TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Bruto</TableHead><TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Neto</TableHead></TableRow></TableHeader><TableBody>{payrolls.map((payroll: any) => <TableRow key={payroll.id}><TableCell className="text-xs font-semibold">{formatDate(payroll.periodStart)} – {formatDate(payroll.periodEnd)}</TableCell><TableCell><Badge variant="outline" className="text-[9px] font-black uppercase">{payrollStatusLabel(payroll.status)}</Badge></TableCell><TableCell className="text-right text-xs">{formatAmount(payroll.baseSalary, payroll.currency || employee?.currency)}</TableCell><TableCell className="text-right text-xs">{formatAmount(payroll.grossPay, payroll.currency || employee?.currency)}</TableCell><TableCell className="text-right text-xs font-black text-primary">{formatAmount(payroll.netPay, payroll.currency || employee?.currency)}</TableCell></TableRow>)}</TableBody></Table></Card>
                      <div className="space-y-3 lg:hidden">{payrolls.map((payroll: any) => <div key={payroll.id} className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold">{formatDate(payroll.periodStart)} – {formatDate(payroll.periodEnd)}</p><p className="mt-1 text-[11px] text-muted-foreground">Pago: {formatDate(payroll.paymentDate)}</p></div><Badge variant="outline" className="text-[9px] font-black uppercase">{payrollStatusLabel(payroll.status)}</Badge></div><div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/40 pt-3"><div><p className="text-[10px] text-muted-foreground">Base</p><p className="text-xs font-semibold">{formatAmount(payroll.baseSalary, payroll.currency || employee?.currency)}</p></div><div><p className="text-[10px] text-muted-foreground">Bruto</p><p className="text-xs font-semibold">{formatAmount(payroll.grossPay, payroll.currency || employee?.currency)}</p></div><div><p className="text-[10px] text-muted-foreground">Neto</p><p className="text-xs font-black text-primary">{formatAmount(payroll.netPay, payroll.currency || employee?.currency)}</p></div></div></div>)}</div>
                    </>}
                  </TabsContent>

                  <TabsContent value="historial" className="mt-0 space-y-4 outline-none">
                    {changeLog.length === 0 ? <EmptyState icon={History} title="Sin cambios registrados" description="Todavía no hay modificaciones auditadas para este empleado." /> : <Card className="rounded-2xl border-border/60 bg-card p-5 shadow-sm"><div className="space-y-0 divide-y divide-border/40">{changeLog.map((change: any, index: number) => <div key={change.id || index} className="flex gap-3 py-4 first:pt-0 last:pb-0"><div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><History className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold">{fieldLabel(change.field)}</p><p className="text-[10px] text-muted-foreground">{formatDate(change.createdAt || change.effectiveDate)}</p></div><p className="mt-1 text-xs text-muted-foreground"><span className="rounded bg-muted px-1.5 py-0.5">{changeValueLabel(change.field, change.oldValue)}</span><span className="mx-2">→</span><span className="font-semibold text-foreground">{changeValueLabel(change.field, change.newValue)}</span></p></div></div>)}</div></Card>}
                  </TabsContent>
                </>
              )}
            </div>
          </ScrollArea>
        </Tabs>
        <SheetFooter className="flex-row flex-wrap justify-end border-t border-border/50 px-5 py-3 sm:px-6">
          <Button type="button" variant="outline" className="min-w-24 rounded-xl" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
