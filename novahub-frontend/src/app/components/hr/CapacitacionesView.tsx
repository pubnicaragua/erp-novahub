import { useRef, useState } from 'react';
import { GraduationCap, Plus, Calendar, CheckCircle2, PlayCircle, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { hrService } from '../../services/hr.service';
import { useCurrency } from '../../contexts/CurrencyContext';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../ui/utils';

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

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Efectivo / Caja' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'CHECK', label: 'Cheque' },
  { value: 'OTHER', label: 'Otro medio' },
];

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
    paymentSource: 'CASH',
    employeeIds: [] as string[],
  });

  const handleCreateTraining = async () => {
    if (!newTraining.title || !newTraining.startDate || !newTraining.endDate) {
      toast.error('Completa los campos requeridos');
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
         paymentSource: 'CASH',
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

  const scheduledTrainings = trainings.filter((t: any) => t.status === 'SCHEDULED').length;
  const inProgressTrainings = trainings.filter((t: any) => t.status === 'IN_PROGRESS').length;
  const completedTrainings = trainings.filter((t: any) => t.status === 'COMPLETED').length;

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [completingEnrollment, setCompletingEnrollment] = useState<string | null>(null);
  const [changingStatus, setChangingStatus] = useState<string | null>(null);

  const handleTrainingStatus = async (training: any, status: string) => {
    setChangingStatus(training.id);
    try {
      await hrService.updateTraining(training.id, { status });
      toast.success(status === 'IN_PROGRESS' ? 'Capacitación iniciada' : status === 'COMPLETED' ? 'Capacitación completada' : 'Estado actualizado');
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

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Programadas</p>
              <h3 className="text-3xl font-bold text-blue-700 dark:text-blue-400">{scheduledTrainings}</h3>
            </div>
            <Calendar className="size-8 text-blue-500" />
          </div>
        </div>
        <div className="border rounded-lg p-4 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">En Progreso</p>
              <h3 className="text-3xl font-bold text-orange-700 dark:text-orange-400">{inProgressTrainings}</h3>
            </div>
            <GraduationCap className="size-8 text-orange-500" />
          </div>
        </div>
        <div className="border rounded-lg p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Completadas</p>
              <h3 className="text-3xl font-bold text-green-700 dark:text-green-400">{completedTrainings}</h3>
            </div>
            <GraduationCap className="size-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* New Training Button */}
      <div className="flex justify-end">
        {canPerform('HR_TRAINING', 'create') && (
          <Button onClick={() => {
            if (!showNewForm) setNewTraining((current) => ({ ...current, currency: displayCurrency }));
            setShowNewForm(!showNewForm);
          }} className="bg-primary hover:bg-primary/90 !text-primary-foreground">
            <Plus className="size-4 mr-2" />
            Nueva Capacitación
          </Button>
        )}
      </div>

      {/* New Training Form */}
      {showNewForm && (
        <div className="border border-primary/40 rounded-lg p-6 bg-primary/5">
          <h3 className="text-lg font-semibold mb-4 text-primary">Nueva Capacitación</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-1 block">Título</label>
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
              <label className="text-sm font-medium mb-1 block">Fecha Inicio</label>
              <Input
                type="date"
                value={newTraining.startDate}
                onChange={(e) => setNewTraining({ ...newTraining, startDate: e.target.value })}
                className="bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Fecha Fin</label>
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
                onChange={(e) => setNewTraining({ ...newTraining, capacity: parseInt(e.target.value) })}
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
            <div>
              <label className="text-sm font-medium mb-1 block">Medio de pago</label>
              <select
                value={newTraining.paymentSource}
                onChange={(e) => setNewTraining({ ...newTraining, paymentSource: e.target.value })}
                disabled={isCreating}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm font-medium"
              >
                {PAYMENT_METHODS.map(method => <option key={method.value} value={method.value}>{method.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-1 block">Empleados Participantes</label>
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
          <div className="flex items-center gap-2 mt-4">
            <Button onClick={handleCreateTraining} disabled={isCreating} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {isCreating ? 'Guardando...' : 'Crear Capacitación'}
            </Button>
            <Button variant="outline" onClick={() => setShowNewForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Trainings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trainings.map((training: any) => {
          const enrolledCount = training.enrollments?.length || 0;
          const completedCount = training.enrollments?.filter((e: any) => e.status === 'COMPLETED').length || 0;
          const progress = training.capacity > 0 ? (enrolledCount / training.capacity) * 100 : 0;
          const isExpanded = expandedId === training.id;

          return (
            <div key={training.id} className="border rounded-lg p-6 hover:shadow-lg transition-shadow bg-card text-card-foreground">
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
                    {new Date(training.startDate).toLocaleDateString()} - {new Date(training.endDate).toLocaleDateString()}
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
              </div>

              {training.cost > 0 && (
                <div className="pt-3 border-t mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Costo</span>
                    <CurrencyValuationAmount amount={Number(training.cost ?? training.baseCost ?? 0)} sourceCurrency={training.currency || 'USD'} sourceExchangeRate={training.exchangeRate} className="font-bold text-primary" />
                  </div>
                </div>
              )}

              {canPerform('HR_TRAINING', 'edit') && training.status !== 'COMPLETED' && (
                <div className="flex items-center gap-2 pt-3 mt-3 border-t border-border/40">
                  {training.status === 'SCHEDULED' && (
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" disabled={changingStatus === training.id} onClick={() => handleTrainingStatus(training, 'IN_PROGRESS')}>
                      <PlayCircle className="size-3 mr-1" /> Iniciar
                    </Button>
                  )}
                  {(training.status === 'IN_PROGRESS' || training.status === 'SCHEDULED') && (
                    <Button size="sm" className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700 text-white" disabled={changingStatus === training.id} onClick={() => handleTrainingStatus(training, 'COMPLETED')}>
                      <CheckCircle2 className="size-3 mr-1" /> Completar
                    </Button>
                  )}
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
                                className="text-[10px] font-black uppercase text-green-600 hover:text-green-700 flex items-center gap-1 shrink-0"
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
            </div>
          );
        })}
      </div>

      {trainings.length === 0 && (
        <div className="text-center py-12">
          <GraduationCap className="size-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No hay capacitaciones programadas</p>
        </div>
      )}
    </div>
  );
}

