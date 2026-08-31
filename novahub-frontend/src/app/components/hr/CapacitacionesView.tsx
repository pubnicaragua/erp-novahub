import { useRef, useState } from 'react';
import { GraduationCap, Plus, Calendar, CheckCircle2, PlayCircle, Users, ChevronDown, ChevronUp, Search, XCircle, UserPlus, Send } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../ui/dialog';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { hrService } from '../../services/hr.service';
import { useCurrency } from '../../contexts/CurrencyContext';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../ui/utils';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { StatCard } from './StatCard';
import { HRViewTutorial } from './HRViewTutorial';
import { HRCreateViewShell } from './HRCreateViewShell';
import { formatDateEs } from '../../utils/dateFormat';

const TRAINING_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Programada',
  IN_PROGRESS: 'En Progreso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
};

const TRAINING_STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-700',
};

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Inscrito',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completado',
};

const PAGE_SIZE_OPTIONS = [6, 9, 12, 18, 24];

export function CapacitacionesView({ trainings, employees, onRefresh }: any) {
  const { canPerform } = useAuth();
  const { displayCurrency } = useCurrency();
  const [showNewForm, setShowNewForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const createInFlightRef = useRef(false);
  const [newTraining, setNewTraining] = useState({
    title: '',
    description: '',
    instructor: '',
    location: '',
    startDate: '',
    endDate: '',
    capacity: 20,
    cost: 0,
    currency: displayCurrency,
    employeeIds: [] as string[],
  });

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(6);
  const [currentPage, setCurrentPage] = useState(1);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completingEnrollment, setCompletingEnrollment] = useState<string | null>(null);
  const [changingStatus, setChangingStatus] = useState<string | null>(null);
  const [enrollingTraining, setEnrollingTraining] = useState<string | null>(null);
  const [enrollSelection, setEnrollSelection] = useState<string[]>([]);
  const [enrolling, setEnrolling] = useState(false);

  const colFilters = useColumnFilters();

  const handleCreateTraining = async () => {
    if (!newTraining.title || !newTraining.startDate || !newTraining.endDate) {
      toast.error('Completa los campos requeridos');
      return;
    }
    if (newTraining.capacity < 1) {
      toast.error('La capacidad debe ser al menos 1');
      return;
    }
    if (createInFlightRef.current) return;

    createInFlightRef.current = true;
    setIsCreating(true);
    try {
      await hrService.createTraining(newTraining);
      toast.success('Capacitación creada');
      setShowNewForm(false);
      setNewTraining({
        title: '',
        description: '',
        instructor: '',
        location: '',
        startDate: '',
        endDate: '',
        capacity: 20,
        cost: 0,
        currency: displayCurrency,
        employeeIds: [],
      });
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al crear capacitación');
    } finally {
      createInFlightRef.current = false;
      setIsCreating(false);
    }
  };

  const handleRequestPayment = async (training: any) => {
    if (!canPerform('HR_TRAINING', 'approve')) return;
    try {
      await hrService.createPaymentRequest({ requestType: 'TRAINING', sourceId: training.id });
      toast.success('Solicitud de pago enviada a Contabilidad');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo solicitar el pago');
    }
  };

  const scheduledTrainings = trainings.filter((t: any) => t.status === 'SCHEDULED').length;
  const inProgressTrainings = trainings.filter((t: any) => t.status === 'IN_PROGRESS').length;
  const completedTrainings = trainings.filter((t: any) => t.status === 'COMPLETED').length;
  const cancelledTrainings = trainings.filter((t: any) => t.status === 'CANCELLED').length;

  const handleTrainingStatus = async (training: any, status: string) => {
    setChangingStatus(training.id);
    try {
      await hrService.updateTraining(training.id, { status });
      toast.success(
        status === 'IN_PROGRESS' ? 'Capacitación iniciada'
          : status === 'COMPLETED' ? 'Capacitación completada'
            : status === 'CANCELLED' ? 'Capacitación cancelada'
              : 'Estado actualizado',
      );
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar estado');
    } finally {
      setChangingStatus(null);
    }
  };

  const handleCompleteEnrollment = async (trainingId: string, employeeId: string) => {
    setCompletingEnrollment(`${trainingId}:${employeeId}`);
    try {
      await hrService.completeTraining(trainingId, employeeId, { status: 'COMPLETED' });
      toast.success('Empleado marcado como completado');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al marcar completado');
    } finally {
      setCompletingEnrollment(null);
    }
  };

  const openEnrollDialog = (training: any) => {
    setEnrollingTraining(training.id);
    const enrolledIds = new Set<string>((training.enrollments || []).map((e: any) => e.employeeId));
    setEnrollSelection(Array.from(enrolledIds));
  };

  const handleEnroll = async (trainingId: string) => {
    const training = trainings.find((t: any) => t.id === trainingId);
    if (!training) return;
    const enrolledIds = new Set<string>((training.enrollments || []).map((e: any) => e.employeeId));
    const toAdd = enrollSelection.filter(id => !enrolledIds.has(id));
    const toRemove = [...enrolledIds].filter(id => !enrollSelection.includes(id));
    const newCount = training.enrollments?.length + toAdd.length - toRemove.length;

    if (newCount > Number(training.capacity || 20)) {
      toast.error(`La capacidad máxima es de ${training.capacity} empleados`);
      return;
    }
    setEnrolling(true);
    try {
      if (toAdd.length > 0) {
        await Promise.all(toAdd.map((employeeId) => hrService.enrollEmployee({ employeeId, trainingId })));
      }
      if (toRemove.length > 0) {
        toast.info('La desinscripción no está disponible en el sistema; los inscritos solo se marcan como completados.');
      }
      toast.success(`${toAdd.length} empleado(s) inscrito(s)`);
      setEnrollingTraining(null);
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al inscribir empleados');
    } finally {
      setEnrolling(false);
    }
  };

  const trainerName = (t: any) => t.instructor || 'Sin instructor';
  const searchFiltered = trainings.filter((t: any) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return t.title.toLowerCase().includes(q)
      || (t.description || '').toLowerCase().includes(q)
      || trainerName(t).toLowerCase().includes(q)
      || (t.location || '').toLowerCase().includes(q);
  });
  const statusFiltered = statusFilter === 'ALL' ? searchFiltered : searchFiltered.filter((t: any) => t.status === statusFilter);
  const filteredTrainings = colFilters.applyTo(statusFiltered, {
    title: (t: any) => t.title,
    instructor: (t: any) => trainerName(t),
    status: (t: any) => String(t.status || ''),
    startDate: (t: any) => (t.startDate ? new Date(t.startDate).getTime() : null),
  });

  const trainerOptions = [...new Map(trainings.map((t: any) => [trainerName(t), trainerName(t)])).entries()]
    .map(([, label]) => ({ value: label as string, label: label as string, count: trainings.filter((t: any) => trainerName(t) === label).length }));
  const statusOptionsForFilter = Object.entries(TRAINING_STATUS_LABELS)
    .map(([value, label]) => ({ value, label, count: trainings.filter((t: any) => t.status === value).length }));

  const totalPages = Math.max(1, Math.ceil(filteredTrainings.length / pageSize));
  const paginatedTrainings = filteredTrainings.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleStatus = (s: string) => {
    setStatusFilter(prev => (prev === s ? 'ALL' : s));
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4', showNewForm && 'hidden')} data-tour="hr-training-title">
        <StatCard
          label="Programadas"
          value={scheduledTrainings}
          icon={Calendar}
          tone="blue"
          sub="Capacitaciones por iniciar"
          active={statusFilter === 'SCHEDULED'}
          onClick={() => toggleStatus('SCHEDULED')}
        />
        <StatCard
          label="En Progreso"
          value={inProgressTrainings}
          icon={GraduationCap}
          tone="orange"
          sub="Capacitaciones en curso"
          active={statusFilter === 'IN_PROGRESS'}
          onClick={() => toggleStatus('IN_PROGRESS')}
        />
        <StatCard
          label="Completadas"
          value={completedTrainings}
          icon={CheckCircle2}
          tone="green"
          sub="Capacitaciones finalizadas"
          active={statusFilter === 'COMPLETED'}
          onClick={() => toggleStatus('COMPLETED')}
        />
        <StatCard
          label="Canceladas"
          value={cancelledTrainings}
          icon={XCircle}
          tone="gray"
          sub="No se llevaron a cabo"
          active={statusFilter === 'CANCELLED'}
          onClick={() => toggleStatus('CANCELLED')}
        />
      </div>

      {/* Toolbar */}
      <div className={cn('erp-composite-toolbar flex flex-wrap items-center justify-between gap-3', showNewForm && 'hidden')} data-tour="hr-training-actions">
        <div className="erp-toolbar-filter-group flex min-w-0 flex-1 items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Buscar título, instructor, ubicación..."
              className="pl-8 h-9 w-64 bg-background"
            />
          </div>
          <ColumnFilterMenu
            label="Estado"
            options={statusOptionsForFilter}
            selected={colFilters.state.status?.values || []}
            onSelect={(values) => colFilters.setValues('status', values)}
            sort={colFilters.state.status?.sort || null}
            onSort={(sort) => colFilters.setSort('status', sort)}
          />
          <ColumnFilterMenu
            label="Instructor"
            options={trainerOptions}
            selected={colFilters.state.instructor?.values || []}
            onSelect={(values) => colFilters.setValues('instructor', values)}
            sort={colFilters.state.instructor?.sort || null}
            onSort={(sort) => colFilters.setSort('instructor', sort)}
          />
          <ColumnFilterMenu
            label="Inicio"
            sort={colFilters.state.startDate?.sort || null}
            onSort={(sort) => colFilters.setSort('startDate', sort)}
            sortOptions={[{ value: 'desc', label: 'Más próximas' }, { value: 'asc', label: 'Más lejanas' }]}
          />
        </div>
        <div className="erp-toolbar-primary-group flex w-full shrink-0 items-center justify-end gap-2 md:w-auto">
          {canPerform('HR_TRAINING', 'create') && (
            <Button onClick={() => {
              if (!showNewForm) setNewTraining((current) => ({ ...current, currency: displayCurrency }));
              setShowNewForm(!showNewForm);
            }} data-toolbar-role="primary" className="h-10 shrink-0 gap-2 rounded-xl border border-primary/20 bg-primary px-4 text-[10px] font-black uppercase tracking-widest !text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90">
              <Plus className="size-4" />
              Nueva Capacitación
            </Button>
          )}
          <HRViewTutorial label="Cómo gestionar capacitaciones" targetPrefix="hr-training" copy={{ data: { description: 'Filtra las capacitaciones por estado, instructor y fecha.' }, actions: { description: 'Crea una capacitación o administra sus inscripciones y estados.' } }} />
        </div>
      </div>

      {/* New Training Form */}
      {showNewForm && (
        <HRCreateViewShell
          title="Nueva capacitación"
          description="Programa la capacitación, define su costo y selecciona las personas que participarán."
          onBack={() => setShowNewForm(false)}
        >
        <div className="space-y-1" data-tour="hr-training-form-shell">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2" data-tour="hr-training-form-title">
            <h3 className="text-lg font-semibold text-primary">Nueva Capacitación</h3>
            <HRViewTutorial label="Cómo crear capacitación" targetPrefix="hr-training-form" stepKeys={['title', 'data', 'items', 'actions']} copy={{ data: { description: 'Completa título, descripción, instructor, fechas, capacidad, costo y modalidad.' }, items: { title: 'Empleados participantes', description: 'Selecciona los empleados que participarán sin superar la capacidad definida.' }, actions: { description: 'Guarda la capacitación para comenzar a gestionar sus participantes.' } }} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-tour="hr-training-form-data">
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-1 block">Título *</label>
              <Input
                value={newTraining.title}
                onChange={(e) => setNewTraining({ ...newTraining, title: e.target.value })}
                placeholder="Nombre de la capacitación"
                className="bg-background"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-1 block">Descripción</label>
              <Textarea
                value={newTraining.description}
                onChange={(e) => setNewTraining({ ...newTraining, description: e.target.value })}
                placeholder="Descripción del curso"
                className="bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Instructor</label>
              <Input
                value={newTraining.instructor}
                onChange={(e) => setNewTraining({ ...newTraining, instructor: e.target.value })}
                placeholder="Nombre del instructor"
                className="bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Ubicación</label>
              <Input
                value={newTraining.location}
                onChange={(e) => setNewTraining({ ...newTraining, location: e.target.value })}
                placeholder="Lugar o modalidad"
                className="bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Fecha Inicio *</label>
              <Input
                type="date"
                value={newTraining.startDate}
                onChange={(e) => setNewTraining({ ...newTraining, startDate: e.target.value })}
                className="bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Fecha Fin *</label>
              <Input
                type="date"
                value={newTraining.endDate}
                onChange={(e) => setNewTraining({ ...newTraining, endDate: e.target.value })}
                className="bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Capacidad</label>
              <Input
                type="number"
                value={newTraining.capacity}
                onChange={(e) => setNewTraining({ ...newTraining, capacity: parseInt(e.target.value) || 0 })}
                className="bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Costo</label>
              <div className="relative">
                <span className="absolute left-2.5 top-2 text-xs text-muted-foreground font-medium">
                  {newTraining.currency === 'USD' ? '$' : 'C$'}
                </span>
                <Input
                  type="number"
                  value={newTraining.cost}
                  onChange={(e) => setNewTraining({ ...newTraining, cost: parseFloat(e.target.value) })}
                  className="bg-background pl-7"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Moneda</label>
              <select
                value={newTraining.currency}
                onChange={(e) => setNewTraining({ ...newTraining, currency: e.target.value as 'NIO' | 'USD' })}
                disabled={isCreating}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm font-medium"
              >
                <option value="NIO">Córdobas (NIO)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </div>
            <div className="md:col-span-2" data-tour="hr-training-form-items">
              <label className="text-sm font-medium mb-1 block">Empleados Participantes ({newTraining.employeeIds.length}/{newTraining.capacity})</label>
              <div className="border border-border/50 rounded-xl p-3 max-h-40 overflow-y-auto bg-background">
                {employees?.map((emp: any) => (
                  <label key={emp.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted/30 px-2 rounded">
                    <input
                      type="checkbox"
                      className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                      checked={newTraining.employeeIds.includes(emp.id)}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setNewTraining(prev => {
                          if (isChecked && prev.employeeIds.length >= prev.capacity) {
                            toast.error(`La capacidad máxima de la capacitación es de ${prev.capacity} empleados.`);
                            return prev;
                          }
                          return {
                            ...prev,
                            employeeIds: isChecked
                              ? [...prev.employeeIds, emp.id]
                              : prev.employeeIds.filter(id => id !== emp.id)
                          };
                        });
                      }}
                    />
                    <span className="text-sm">{emp.firstName} {emp.lastName}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4" data-tour="hr-training-form-actions">
            <Button onClick={handleCreateTraining} disabled={isCreating} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {isCreating ? 'Guardando...' : 'Crear Capacitación'}
            </Button>
            <Button variant="outline" onClick={() => setShowNewForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
        </HRCreateViewShell>
      )}

      {/* Trainings Grid */}
      <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4', showNewForm && 'hidden')} data-tour="hr-training-data">
        {paginatedTrainings.map((training: any) => {
          const enrolledCount = training.enrollments?.length || 0;
          const completedCount = training.enrollments?.filter((e: any) => e.status === 'COMPLETED').length || 0;
          const progress = training.capacity > 0 ? (enrolledCount / training.capacity) * 100 : 0;
          const completionRate = enrolledCount > 0 ? Math.round((completedCount / enrolledCount) * 100) : 0;
          const isExpanded = expandedId === training.id;

          return (
            <div key={training.id} className={cn("border rounded-lg p-6 hover:shadow-lg transition-shadow bg-card text-card-foreground", training.status === 'CANCELLED' && 'opacity-70')}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{training.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{training.description}</p>
                </div>
                <Badge className={cn('ml-2 text-[10px] font-black uppercase tracking-wider', TRAINING_STATUS_STYLES[training.status] || 'bg-gray-100 text-gray-700')}>
                  {TRAINING_STATUS_LABELS[training.status] || training.status}
                </Badge>
              </div>

              <div className="space-y-3 mb-4">
                {training.instructor && (
                  <div className="flex items-center gap-2 text-sm">
                    <GraduationCap className="size-4 text-muted-foreground" />
                    <span>{training.instructor}</span>
                  </div>
                )}
                {training.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="size-4 text-muted-foreground" />
                    <span>{training.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="size-4 text-muted-foreground" />
                  <span>
                    {formatDateEs(training.startDate)} - {formatDateEs(training.endDate)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Inscritos</span>
                  <span className="font-medium">{enrolledCount} / {training.capacity}</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                {completedCount > 0 && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Completados</span>
                    <span className="font-bold text-green-600">{completedCount} · {completionRate}%</span>
                  </div>
                )}
              </div>

              {training.cost > 0 && (
                <div className="pt-3 border-t mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Costo</span>
                    <CurrencyValuationAmount amount={Number(training.cost ?? training.baseCost ?? 0)} sourceCurrency={training.currency || 'USD'} sourceExchangeRate={training.exchangeRate} className="font-bold text-primary" />
                  </div>
                </div>
              )}

              {Number(training.cost || 0) > 0 && training.paymentStatus !== 'PAID' && canPerform('HR_TRAINING', 'approve') && (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Pago: {training.paymentStatus === 'REQUESTED' ? 'Solicitud enviada' : training.paymentStatus === 'APPROVED' ? 'Aprobada' : 'Pendiente'}</span>
                  {(!training.paymentStatus || training.paymentStatus === 'PENDING') && <Button size="sm" variant="outline" className="h-7 rounded-lg text-[10px] font-bold" onClick={() => handleRequestPayment(training)}><Send className="mr-1.5 size-3" /> Solicitar pago</Button>}
                </div>
              )}
              {Number(training.cost || 0) > 0 && training.paymentStatus === 'PAID' && <div className="mt-3 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-600"><CheckCircle2 className="size-3.5" /> Pago contabilizado</div>}

              {canPerform('HR_TRAINING', 'edit') && training.status !== 'COMPLETED' && training.status !== 'CANCELLED' && (
                <div className="flex items-center gap-2 pt-3 mt-3 border-t border-border/40">
                  {training.status === 'SCHEDULED' && (
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" disabled={changingStatus === training.id} onClick={() => handleTrainingStatus(training, 'IN_PROGRESS')}>
                      <PlayCircle className="size-3 mr-1" /> Iniciar
                    </Button>
                  )}
                  {(training.status === 'IN_PROGRESS' || training.status === 'SCHEDULED') && (
                    <Button size="sm" className="flex-1 h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground" disabled={changingStatus === training.id} onClick={() => handleTrainingStatus(training, 'COMPLETED')}>
                      <CheckCircle2 className="size-3 mr-1" /> Completar
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-8 px-2 text-xs text-red-600 hover:bg-red-50 border-red-200" disabled={changingStatus === training.id} onClick={() => handleTrainingStatus(training, 'CANCELLED')}>
                    <XCircle className="size-3" />
                  </Button>
                </div>
              )}

              {training.enrollments && training.enrollments.length > 0 && (
                <div className="pt-3 mt-3 border-t border-border/40">
                  <button
                    className="flex w-full items-center justify-between text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : training.id)}
                  >
                    <span className="flex items-center gap-1.5"><Users className="size-3.5" /> Empleados inscritos ({enrolledCount}{completedCount > 0 ? ` · ${completedCount} completados` : ''})</span>
                    {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </button>
                  {isExpanded && (
                    <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                      {training.enrollments.map((enrollment: any) => {
                        const emp = employees.find((e: any) => e.id === enrollment.employeeId) || enrollment.employee;
                        const name = emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : 'Empleado';
                        return (
                          <div key={enrollment.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-1.5">
                            <span className="text-xs font-medium truncate">{name}</span>
                            {training.status !== 'COMPLETED' && enrollment.status !== 'COMPLETED' && canPerform('HR_TRAINING', 'edit') ? (
                              <button
                                className="text-[10px] font-black uppercase text-primary hover:text-primary/80 flex items-center gap-1 shrink-0"
                                disabled={completingEnrollment === `${training.id}:${enrollment.employeeId}`}
                                onClick={() => handleCompleteEnrollment(training.id, enrollment.employeeId)}
                              >
                                <CheckCircle2 className="size-3" /> Completar
                              </button>
                            ) : (
                              <span className="text-[10px] font-black uppercase text-muted-foreground shrink-0">
                                {ENROLLMENT_STATUS_LABELS[enrollment.status] || enrollment.status}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {canPerform('HR_TRAINING', 'edit') && training.status === 'SCHEDULED' && (
                <Button size="sm" variant="outline" className="w-full mt-3 h-8 text-xs gap-1.5" onClick={() => openEnrollDialog(training)}>
                  <UserPlus className="size-3.5" /> Inscribir empleados
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {filteredTrainings.length === 0 && (
        <div className="text-center py-12">
          <GraduationCap className="size-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {trainings.length === 0 ? 'No hay capacitaciones programadas' : 'No hay capacitaciones con los filtros seleccionados'}
          </p>
        </div>
      )}

      {/* Pagination */}
      {filteredTrainings.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-border/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="h-8 rounded-lg border bg-background px-2 font-bold text-foreground focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer">
              {PAGE_SIZE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <p className="bg-primary/5 px-3 py-1 rounded-full border border-primary/10">
              Mostrando <span className="text-foreground font-black">{(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredTrainings.length)}</span> de <span className="text-primary font-black">{filteredTrainings.length}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border hover:bg-muted disabled:opacity-30 transition-all">Anterior</button>
            <div className="flex items-center px-4 h-9 rounded-lg border bg-muted/30 font-black text-xs">Pág. {currentPage} / {totalPages}</div>
            <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg border hover:bg-muted disabled:opacity-30 transition-all">Siguiente</button>
          </div>
        </div>
      )}

      {/* Enroll Dialog */}
      <Dialog open={enrollingTraining !== null} onOpenChange={(open) => { if (!open) setEnrollingTraining(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader data-tour="hr-training-enroll-title">
            <DialogTitle className="flex items-center gap-2 text-lg font-black">
              <UserPlus className="size-5 text-primary" />
              Inscribir empleados
            </DialogTitle>
            <HRViewTutorial label="Cómo inscribir empleados" targetPrefix="hr-training-enroll" stepKeys={['title', 'data', 'actions']} copy={{ data: { description: 'Revisa la capacitación y marca los empleados participantes.' }, actions: { description: 'Guarda las inscripciones para actualizar la lista de participantes.' } }} />
          </DialogHeader>
          {(() => {
            const training = trainings.find((t: any) => t.id === enrollingTraining);
            if (!training) return null;
            const enrolledCount = training.enrollments?.length || 0;
            return (
              <>
                <div className="rounded-xl bg-muted/30 border border-border/40 p-3 text-xs">
                  <p className="font-bold">{training.title}</p>
                  <p className="text-muted-foreground mt-1">
                    Inscritos: <strong className="text-foreground">{enrolledCount} / {training.capacity}</strong>
                    {training.instructor && <> · Instructor: {training.instructor}</>}
                  </p>
                </div>
                <div className="border border-border/50 rounded-xl p-3 max-h-64 overflow-y-auto mt-2" data-tour="hr-training-enroll-data">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 block">Selecciona los participantes</Label>
                  {employees.map((emp: any) => {
                    const alreadyEnrolled = (training.enrollments || []).some((e: any) => e.employeeId === emp.id);
                    return (
                      <label key={emp.id} className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-muted/30 px-2 rounded">
                        <input
                          type="checkbox"
                          className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                          checked={enrollSelection.includes(emp.id)}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            setEnrollSelection(prev => {
                              const next = isChecked ? [...prev, emp.id] : prev.filter(id => id !== emp.id);
                              const currentEnrolled = new Set((training.enrollments || []).map((x: any) => x.employeeId));
                              const adds = next.filter(id => !currentEnrolled.has(id));
                              const removes = [...currentEnrolled].filter(id => !next.includes(id));
                              const finalCount = training.enrollments.length + adds.length - removes.length;
                              if (isChecked && finalCount > Number(training.capacity || 20)) {
                                toast.error(`La capacidad máxima es de ${training.capacity} empleados`);
                                return prev;
                              }
                              return next;
                            });
                          }}
                        />
                        <span className="text-sm">{emp.firstName} {emp.lastName}</span>
                        {alreadyEnrolled && <Badge className="text-[9px] uppercase bg-primary/10 text-primary">Inscrito</Badge>}
                      </label>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Los empleados ya inscritos se conservan. La desinscripción no está soportada: marca como completado al finalizar.
                </p>
                <DialogFooter className="gap-2 mt-2" data-tour="hr-training-enroll-actions">
                  <DialogClose asChild>
                    <Button variant="outline" className="rounded-xl">Cerrar</Button>
                  </DialogClose>
                  <Button onClick={() => handleEnroll(training.id)} disabled={enrolling} className="gap-2 rounded-xl font-bold">
                    {enrolling ? 'Inscribiendo...' : 'Guardar inscripciones'}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
