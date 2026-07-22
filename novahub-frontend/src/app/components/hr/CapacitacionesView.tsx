import { useState } from 'react';
import { GraduationCap, Plus, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { hrService } from '../../services/hr.service';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';

export function CapacitacionesView({ trainings, employees, onRefresh }: any) {
  const { canPerform } = useAuth();
  const { displayCurrency, formatConvertedAmount } = useCurrency();
  const [showNewForm, setShowNewForm] = useState(false);
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

  const handleCreateTraining = async () => {
    if (!newTraining.title || !newTraining.startDate || !newTraining.endDate) {
      toast.error('Completa los campos requeridos');
      return;
    }

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
    } catch (error) {
      toast.error('Error al crear capacitación');
    }
  };

  const scheduledTrainings = trainings.filter((t: any) => t.status === 'SCHEDULED').length;
  const inProgressTrainings = trainings.filter((t: any) => t.status === 'IN_PROGRESS').length;
  const completedTrainings = trainings.filter((t: any) => t.status === 'COMPLETED').length;

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
            <Button onClick={handleCreateTraining} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              Crear Capacitación
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

          return (
            <div key={training.id} className="border rounded-lg p-6 hover:shadow-lg transition-shadow bg-card text-card-foreground">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{training.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{training.description}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ml-2 ${
                  training.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' :
                  training.status === 'IN_PROGRESS' ? 'bg-orange-100 text-orange-700' :
                  training.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {training.status}
                </span>
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

              {training.status === 'COMPLETED' && (
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Completaron</span>
                    <span className="font-medium text-green-600">{completedCount} empleados</span>
                  </div>
                </div>
              )}

              {training.cost > 0 && (
                <div className="pt-3 border-t mt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Costo</span>
                    <span className="font-bold text-primary">{formatConvertedAmount(training.cost, training.currency || 'USD')}</span>
                  </div>
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

