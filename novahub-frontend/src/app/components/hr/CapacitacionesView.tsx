import { useState } from 'react';
import { GraduationCap, Plus, Calendar, Save, Activity, CheckCircle, Edit2, UserCheck, MapPin } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { cn } from '../ui/utils';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { hrService } from '../../services/hr.service';
import { useCurrency } from '../../contexts/CurrencyContext';
import { motion } from 'motion/react';
import { Badge } from '../ui/badge';

export function CapacitacionesView({ trainings, employees, onRefresh }: any) {
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
    employeeIds: [] as string[],
  });

  const handleCreateTraining = async () => {
    if (!newTraining.title || !newTraining.startDate || !newTraining.endDate) {
      toast.error('Completa los campos requeridos');
      return;
    }

    try {
      const currency = displayCurrency === 'USD' ? 'USD' : 'NIO';
      await hrService.createTraining({ ...newTraining, currency });
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
        <Card className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden relative group">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl shadow-inner bg-blue-500/10 text-blue-500">
                <Calendar className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Programadas</p>
                <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">{scheduledTrainings}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden relative group">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl shadow-inner bg-amber-500/10 text-amber-500">
                <Activity className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">En Curso</p>
                <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">{inProgressTrainings}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden relative group">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl shadow-inner bg-emerald-500/10 text-emerald-500">
                <CheckCircle className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Completadas</p>
                <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">{completedTrainings}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black uppercase tracking-tight text-foreground">Plan de Formación</h3>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Gestión de cursos, talleres y desarrollo de competencias.</p>
        </div>
        <Button 
          onClick={() => setShowNewForm(!showNewForm)} 
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20"
        >
          <Plus className="size-4" /> Nueva Capacitación
        </Button>
      </div>

      {/* New Training Form */}
      {showNewForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/30 bg-primary/5 shadow-2xl rounded-3xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <GraduationCap className="size-5" />
                </div>
                <h3 className="text-xl font-black tracking-tight uppercase">Nueva Acción Formativa</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Título de la Capacitación</label>
                  <Input
                    value={newTraining.title}
                    onChange={(e) => setNewTraining({ ...newTraining, title: e.target.value })}
                    placeholder="Ej: Liderazgo Disruptivo, Excel Avanzado..."
                    className="bg-background rounded-xl h-11 font-bold"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descripción y Objetivos</label>
                  <Textarea
                    value={newTraining.description}
                    onChange={(e) => setNewTraining({ ...newTraining, description: e.target.value })}
                    placeholder="Detalle el contenido y los objetivos del curso..."
                    className="bg-background rounded-2xl min-h-[100px] resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Instructor / Entidad</label>
                  <Input
                    value={newTraining.instructor}
                    onChange={(e) => setNewTraining({ ...newTraining, instructor: e.target.value })}
                    placeholder="Nombre del facilitador"
                    className="bg-background rounded-xl h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ubicación / Plataforma</label>
                  <Input
                    value={newTraining.location}
                    onChange={(e) => setNewTraining({ ...newTraining, location: e.target.value })}
                    placeholder="Sala de juntas, Zoom, etc."
                    className="bg-background rounded-xl h-11"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fechas del Evento</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={newTraining.startDate}
                      onChange={(e) => setNewTraining({ ...newTraining, startDate: e.target.value })}
                      className="bg-background rounded-xl h-11"
                    />
                    <Input
                      type="date"
                      value={newTraining.endDate}
                      onChange={(e) => setNewTraining({ ...newTraining, endDate: e.target.value })}
                      className="bg-background rounded-xl h-11"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cupos</label>
                    <Input
                      type="number"
                      value={newTraining.capacity}
                      onChange={(e) => setNewTraining({ ...newTraining, capacity: parseInt(e.target.value) })}
                      className="bg-background rounded-xl h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Presupuesto</label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-xs text-muted-foreground font-bold">
                        {displayCurrency === 'USD' ? '$' : 'C$'}
                      </span>
                      <Input
                        type="number"
                        value={newTraining.cost}
                        onChange={(e) => setNewTraining({ ...newTraining, cost: parseFloat(e.target.value) })}
                        className="bg-background pl-8 rounded-xl h-11"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3 block">Participantes Seleccionados</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                  {employees?.map((emp: any) => (
                    <label key={emp.id} className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                      newTraining.employeeIds.includes(emp.id) 
                        ? "bg-primary/10 border-primary/30 shadow-inner" 
                        : "bg-background border-border/40 hover:border-primary/20"
                    )}>
                      <input 
                        type="checkbox" 
                        className="rounded-full border-input text-primary focus:ring-primary h-4 w-4"
                        checked={newTraining.employeeIds.includes(emp.id)}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setNewTraining(prev => {
                            if (isChecked && prev.employeeIds.length >= prev.capacity) {
                              toast.error(`Capacidad máxima alcanzada (${prev.capacity})`);
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
                      <div className="flex flex-col">
                        <span className="text-xs font-bold">{emp.firstName} {emp.lastName}</span>
                        <span className="text-[9px] text-muted-foreground uppercase">{emp.position?.title}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 mt-8 pt-6 border-t border-border/40">
                <Button onClick={handleCreateTraining} className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest rounded-2xl gap-2 shadow-xl shadow-primary/20">
                  <Save className="size-5" /> Programar Curso
                </Button>
                <Button variant="outline" onClick={() => setShowNewForm(false)} className="h-12 px-8 rounded-2xl font-bold uppercase text-xs border-border/60">
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Trainings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {trainings.map((training: any) => {
          const enrolledCount = training.enrollments?.length || 0;
          const progress = training.capacity > 0 ? (enrolledCount / training.capacity) * 100 : 0;

          return (
            <motion.div key={training.id} layout initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="bg-card border-border/50 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 overflow-hidden rounded-3xl group h-full flex flex-col">
                <div className="p-6 flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <Badge className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2 py-1",
                      training.status === 'SCHEDULED' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                      training.status === 'IN_PROGRESS' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                      training.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                      'bg-muted text-muted-foreground'
                    )}>
                      {training.status === 'SCHEDULED' ? 'Programado' : 
                       training.status === 'IN_PROGRESS' ? 'En Curso' : 
                       training.status === 'COMPLETED' ? 'Completado' : training.status}
                    </Badge>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="size-8 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white flex items-center justify-center transition-all">
                        <Edit2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  <h4 className="font-black text-lg leading-tight tracking-tight text-foreground group-hover:text-primary transition-colors mb-2">
                    {training.title}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 italic mb-6">
                    {training.description}
                  </p>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3 text-xs font-bold text-foreground/80">
                      <div className="size-8 rounded-xl bg-muted/50 flex items-center justify-center text-primary">
                        <UserCheck className="size-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-widest">Instructor</span>
                        <span>{training.instructor || 'Por asignar'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-bold text-foreground/80">
                      <div className="size-8 rounded-xl bg-muted/50 flex items-center justify-center text-primary">
                        <MapPin className="size-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase text-muted-foreground/40 tracking-widest">Lugar</span>
                        <span>{training.location || 'Virtual'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">Ocupación</span>
                      <span className="text-[10px] font-black text-foreground">{enrolledCount} / {training.capacity}</span>
                    </div>
                    <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden border border-border/10">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(progress, 100)}%` }}
                        className={cn(
                          "h-full transition-all",
                          progress >= 100 ? "bg-emerald-500" : "bg-primary"
                        )}
                      />
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 bg-muted/20 border-t border-border/40 flex items-center justify-between mt-auto">
                  <div className="flex flex-col">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mb-0.5">Inversión</p>
                    <p className="font-black text-sm text-foreground">
                      {formatConvertedAmount(training.cost, training.currency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase">
                    <Calendar className="size-3.5 text-primary" />
                    <span>{new Date(training.startDate).toLocaleDateString('es', { day: '2-digit', month: 'short' })}</span>
                  </div>
                </div>
              </Card>
            </motion.div>
          );
        })}

        {trainings.length === 0 && !showNewForm && (
          <div className="md:col-span-2 xl:col-span-3">
            <Card className="border-dashed border-2 border-muted-foreground/20 bg-muted/5 rounded-3xl overflow-hidden py-16">
              <CardContent className="flex flex-col items-center justify-center text-center">
                <div className="size-20 rounded-3xl bg-indigo-500/5 flex items-center justify-center mb-6 relative">
                  <div className="absolute inset-0 bg-indigo-500/10 blur-2xl rounded-full" />
                  <GraduationCap className="size-10 text-indigo-500 relative z-10" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-foreground mb-2">Sin plan de formación</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-8 font-medium">
                  Impulsa el talento de tu equipo creando cursos de capacitación y seguimiento de habilidades.
                </p>
                <Button 
                  onClick={() => setShowNewForm(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-8 h-12 rounded-2xl gap-3 shadow-2xl shadow-primary/20"
                >
                  <Plus className="size-5" /> Crear Primera Capacitación
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
