import React, { useState } from 'react';
import { Award, Plus, Star, Save, Calendar, Edit2, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { cn } from '../ui/utils';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { hrService } from '../../services/hr.service';
import { Combobox } from '../ui/Combobox';
import { motion } from 'motion/react';
import { Badge } from '../ui/badge';

export function EvaluacionesView({ reviews, employees, onRefresh }: any) {
  const [showNewForm, setShowNewForm] = useState(false);
  const [newReview, setNewReview] = useState({
    employeeId: '',
    reviewerId: '',
    reviewPeriodStart: '',
    reviewPeriodEnd: '',
    overallRating: 3,
    goals: '',
    achievements: '',
    areasOfImprovement: '',
    comments: '',
  });

  const handleCreateReview = async () => {
    if (!newReview.employeeId || !newReview.reviewerId) {
      toast.error('Completa los campos requeridos');
      return;
    }

    try {
      await hrService.createPerformanceReview(newReview);
      toast.success('Evaluación creada');
      setShowNewForm(false);
      setNewReview({
        employeeId: '',
        reviewerId: '',
        reviewPeriodStart: '',
        reviewPeriodEnd: '',
        overallRating: 3,
        goals: '',
        achievements: '',
        areasOfImprovement: '',
        comments: '',
      });
      onRefresh();
    } catch (error) {
      toast.error('Error al crear evaluación');
    }
  };

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum: number, r: any) => sum + (r.overallRating || 0), 0) / reviews.length
    : 0;

  const completedReviews = reviews.filter((r: any) => r.status === 'COMPLETED').length;
  const inProgressReviews = reviews.filter((r: any) => r.status === 'IN_PROGRESS').length;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden relative group">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl shadow-inner bg-amber-500/10 text-amber-500">
                <Award className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Calificación Promedio</p>
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">{avgRating.toFixed(1)}</p>
                  <div className="flex items-center gap-0.5 mb-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`size-2.5 ${star <= avgRating ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/20'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden relative group">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl shadow-inner bg-emerald-500/10 text-emerald-500">
                <Plus className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Completadas</p>
                <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">{completedReviews}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border/50 shadow-sm rounded-2xl overflow-hidden relative group">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl shadow-inner bg-blue-500/10 text-blue-500">
                <Plus className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">En Progreso</p>
                <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">{inProgressReviews}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black uppercase tracking-tight text-foreground">Evaluaciones de Desempeño</h3>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mt-1">Seguimiento de objetivos, logros y áreas de crecimiento.</p>
        </div>
        <Button 
          onClick={() => setShowNewForm(!showNewForm)} 
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-6 h-10 rounded-xl gap-2 shadow-xl shadow-primary/20 border border-primary/20"
        >
          <Plus className="size-4" /> Nueva Evaluación
        </Button>
      </div>

      {/* New Review Form */}
      {showNewForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/30 bg-primary/5 shadow-2xl rounded-3xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <Award className="size-5" />
                </div>
                <h3 className="text-xl font-black tracking-tight uppercase">Registrar Nueva Evaluación</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Empleado</label>
                  <Combobox
                    options={employees.map((emp: any) => ({
                      label: `${emp.firstName} ${emp.lastName}`,
                      value: emp.id,
                      description: emp.employeeNumber,
                    }))}
                    value={newReview.employeeId}
                    onChange={(v) => setNewReview({ ...newReview, employeeId: v })}
                    placeholder="Seleccionar empleado..."
                    emptyMessage="No se encontró el empleado"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Evaluador</label>
                  <Combobox
                    options={employees
                      .filter((emp: any) => emp.id !== newReview.employeeId)
                      .map((emp: any) => ({
                        label: `${emp.firstName} ${emp.lastName}`,
                        value: emp.id,
                        description: emp.employeeNumber,
                      }))}
                    value={newReview.reviewerId}
                    onChange={(v) => setNewReview({ ...newReview, reviewerId: v })}
                    placeholder="Seleccionar evaluador..."
                    emptyMessage="No se encontró el evaluador"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Período de Evaluación</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={newReview.reviewPeriodStart}
                      onChange={(e) => setNewReview({ ...newReview, reviewPeriodStart: e.target.value })}
                      className="bg-background rounded-xl h-11"
                    />
                    <Input
                      type="date"
                      value={newReview.reviewPeriodEnd}
                      onChange={(e) => setNewReview({ ...newReview, reviewPeriodEnd: e.target.value })}
                      className="bg-background rounded-xl h-11"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Calificación Global (1-5)</label>
                  <div className="flex items-center gap-3 bg-background rounded-xl border border-input p-1">
                    <Input
                      type="number"
                      min="1"
                      max="5"
                      step="0.1"
                      value={newReview.overallRating}
                      onChange={(e) => setNewReview({ ...newReview, overallRating: parseFloat(e.target.value) })}
                      className="border-none focus-visible:ring-0 h-9 font-black text-center text-lg"
                    />
                    <div className="flex items-center gap-1 pr-3 border-l border-border/50 pl-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={cn(
                            "size-4 transition-all cursor-pointer",
                            star <= newReview.overallRating ? "fill-amber-500 text-amber-500 scale-110" : "text-muted-foreground/20 hover:text-amber-200"
                          )}
                          onClick={() => setNewReview({ ...newReview, overallRating: star })}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Objetivos del Período</label>
                  <Textarea
                    value={newReview.goals}
                    onChange={(e) => setNewReview({ ...newReview, goals: e.target.value })}
                    placeholder="Describa los objetivos acordados..."
                    className="bg-background rounded-2xl min-h-[100px] resize-none"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Logros Alcanzados</label>
                  <Textarea
                    value={newReview.achievements}
                    onChange={(e) => setNewReview({ ...newReview, achievements: e.target.value })}
                    placeholder="Principales hitos y resultados..."
                    className="bg-background rounded-2xl min-h-[100px] resize-none"
                  />
                </div>
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Áreas de Mejora</label>
                    <Textarea
                      value={newReview.areasOfImprovement}
                      onChange={(e) => setNewReview({ ...newReview, areasOfImprovement: e.target.value })}
                      placeholder="Oportunidades de crecimiento..."
                      className="bg-background rounded-2xl min-h-[100px] resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Comentarios Adicionales</label>
                    <Textarea
                      value={newReview.comments}
                      onChange={(e) => setNewReview({ ...newReview, comments: e.target.value })}
                      placeholder="Notas del evaluador..."
                      className="bg-background rounded-2xl min-h-[100px] resize-none"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-8 pt-6 border-t border-border/40">
                <Button onClick={handleCreateReview} className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest rounded-2xl gap-2 shadow-xl shadow-primary/20">
                  <Save className="size-5" /> Guardar Evaluación
                </Button>
                <Button variant="outline" onClick={() => setShowNewForm(false)} className="h-12 px-8 rounded-2xl font-bold uppercase text-xs border-border/60">
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Reviews Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {reviews.map((review: any) => (
          <motion.div key={review.id} layout initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="bg-card border-border/50 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 overflow-hidden rounded-3xl group">
              <div className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="size-14 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-primary border border-primary/10 shadow-inner">
                      {review.employee?.firstName?.[0]}{review.employee?.lastName?.[0]}
                    </div>
                    <div>
                      <h4 className="font-black text-lg tracking-tight text-foreground group-hover:text-primary transition-colors">
                        {review.employee?.firstName} {review.employee?.lastName}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Evaluado por:</span>
                        <span className="text-xs font-bold text-muted-foreground">{review.reviewer?.firstName} {review.reviewer?.lastName}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right flex flex-col items-end">
                    <div className="flex items-center gap-1 mb-1 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20 shadow-sm">
                      <Star className="size-4 fill-amber-500 text-amber-500" />
                      <span className="font-black text-lg text-amber-600 tracking-tighter">{Number(review.overallRating || 0).toFixed(1)}</span>
                      <span className="text-[10px] font-black text-amber-600/40 ml-0.5">/ 5.0</span>
                    </div>
                    <Badge className={cn(
                      "text-[9px] font-black uppercase tracking-widest",
                      review.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                      review.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                      'bg-muted text-muted-foreground'
                    )}>
                      {review.status === 'COMPLETED' ? 'Completada' : review.status === 'IN_PROGRESS' ? 'En Progreso' : review.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-muted/30 p-3 rounded-2xl border border-border/20">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5">Período Fiscal</p>
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Calendar className="size-3 text-primary" />
                      <span>{new Date(review.reviewPeriodStart).toLocaleDateString()}</span>
                      <span className="text-muted-foreground/30">→</span>
                      <span>{new Date(review.reviewPeriodEnd).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="bg-muted/30 p-3 rounded-2xl border border-border/20">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1.5">Desempeño</p>
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`size-3 ${star <= (review.overallRating || 0) ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/20'}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {review.goals && (
                    <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/60">Objetivos Estratégicos</p>
                      <p className="text-xs text-muted-foreground leading-relaxed italic">{review.goals}</p>
                    </div>
                  )}
                  
                  {review.achievements && (
                    <div className="space-y-1">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600/60">Logros Destacados</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{review.achievements}</p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="px-6 py-4 bg-muted/20 border-t border-border/40 flex items-center justify-between">
                <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest gap-2 text-muted-foreground hover:text-primary">
                  <Edit2 className="size-3.5" /> Editar Informe
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-[10px] font-black uppercase tracking-widest gap-2 text-muted-foreground hover:text-primary">
                  <FileText className="size-3.5" /> Descargar PDF
                </Button>
              </div>
            </Card>
          </motion.div>
        ))}

        {reviews.length === 0 && !showNewForm && (
          <div className="lg:col-span-2">
            <Card className="border-dashed border-2 border-muted-foreground/20 bg-muted/5 rounded-3xl overflow-hidden">
              <CardContent className="flex flex-col items-center justify-center text-center p-12">
                <div className="size-20 rounded-3xl bg-amber-500/5 flex items-center justify-center mb-6 relative">
                  <div className="absolute inset-0 bg-amber-500/10 blur-2xl rounded-full" />
                  <Award className="size-10 text-amber-500 relative z-10" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-foreground mb-2">Sin evaluaciones registradas</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-8 font-medium">
                  Comienza a medir el rendimiento y crecimiento de tu equipo creando su primera evaluación de desempeño.
                </p>
                <Button 
                  onClick={() => setShowNewForm(true)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-8 h-12 rounded-2xl gap-3 shadow-2xl shadow-primary/20"
                >
                  <Plus className="size-5" /> Iniciar Evaluación
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
