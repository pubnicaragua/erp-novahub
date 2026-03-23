import React, { useState } from 'react';
import { Award, Plus, Star } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { hrService } from '../../services/hr.service';
import { Combobox } from '../ui/Combobox';

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
        <div className="border rounded-lg p-4 bg-gradient-to-br from-yellow-50 to-amber-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Calificación Promedio</p>
              <h3 className="text-3xl font-bold text-yellow-700">{avgRating.toFixed(1)}</h3>
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`size-4 ${star <= avgRating ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`}
                  />
                ))}
              </div>
            </div>
            <Award className="size-8 text-yellow-500" />
          </div>
        </div>
        <div className="border rounded-lg p-4 bg-gradient-to-br from-green-50 to-emerald-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Completadas</p>
              <h3 className="text-3xl font-bold text-green-700">{completedReviews}</h3>
            </div>
            <Award className="size-8 text-green-500" />
          </div>
        </div>
        <div className="border rounded-lg p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">En Progreso</p>
              <h3 className="text-3xl font-bold text-blue-700">{inProgressReviews}</h3>
            </div>
            <Award className="size-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* New Review Button */}
      <div className="flex justify-end">
        <Button onClick={() => setShowNewForm(!showNewForm)} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="size-4 mr-2" />
          Nueva Evaluación
        </Button>
      </div>

      {/* New Review Form */}
      {showNewForm && (
        <div className="border rounded-lg p-6 bg-gradient-to-br from-indigo-50 to-purple-50">
          <h3 className="text-lg font-semibold mb-4">Nueva Evaluación de Desempeño</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Empleado</label>
              <Combobox
                options={employees.map((emp: any) => ({
                  label: `${emp.firstName} ${emp.lastName}`,
                  value: emp.id,
                  description: emp.employeeNumber,
                }))}
                value={newReview.employeeId}
                onChange={(v) => setNewReview({ ...newReview, employeeId: v })}
                placeholder="Buscar empleado..."
                emptyMessage="No se encontró el empleado"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Evaluador</label>
              <Combobox
                options={employees.map((emp: any) => ({
                  label: `${emp.firstName} ${emp.lastName}`,
                  value: emp.id,
                  description: emp.employeeNumber,
                }))}
                value={newReview.reviewerId}
                onChange={(v) => setNewReview({ ...newReview, reviewerId: v })}
                placeholder="Buscar evaluador..."
                emptyMessage="No se encontró el evaluador"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Período Inicio</label>
              <Input
                type="date"
                value={newReview.reviewPeriodStart}
                onChange={(e) => setNewReview({ ...newReview, reviewPeriodStart: e.target.value })}
                className="bg-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Período Fin</label>
              <Input
                type="date"
                value={newReview.reviewPeriodEnd}
                onChange={(e) => setNewReview({ ...newReview, reviewPeriodEnd: e.target.value })}
                className="bg-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Calificación (1-5)</label>
              <Input
                type="number"
                min="1"
                max="5"
                step="0.1"
                value={newReview.overallRating}
                onChange={(e) => setNewReview({ ...newReview, overallRating: parseFloat(e.target.value) })}
                className="bg-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-1 block">Objetivos</label>
              <Textarea
                value={newReview.goals}
                onChange={(e) => setNewReview({ ...newReview, goals: e.target.value })}
                placeholder="Objetivos del período"
                className="bg-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-1 block">Logros</label>
              <Textarea
                value={newReview.achievements}
                onChange={(e) => setNewReview({ ...newReview, achievements: e.target.value })}
                placeholder="Logros alcanzados"
                className="bg-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-1 block">Áreas de Mejora</label>
              <Textarea
                value={newReview.areasOfImprovement}
                onChange={(e) => setNewReview({ ...newReview, areasOfImprovement: e.target.value })}
                placeholder="Áreas a mejorar"
                className="bg-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-1 block">Comentarios</label>
              <Textarea
                value={newReview.comments}
                onChange={(e) => setNewReview({ ...newReview, comments: e.target.value })}
                placeholder="Comentarios adicionales"
                className="bg-white"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Button onClick={handleCreateReview} className="bg-green-600 hover:bg-green-700">
              Crear Evaluación
            </Button>
            <Button variant="outline" onClick={() => setShowNewForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Reviews List */}
      <div className="grid grid-cols-1 gap-4">
        {reviews.map((review: any) => (
          <div key={review.id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
                  {review.employee?.firstName?.[0]}{review.employee?.lastName?.[0]}
                </div>
                <div>
                  <h3 className="font-semibold">
                    {review.employee?.firstName} {review.employee?.lastName}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Evaluado por: {review.reviewer?.firstName} {review.reviewer?.lastName}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 mb-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`size-4 ${star <= (review.overallRating || 0) ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`}
                    />
                  ))}
                </div>
                <p className="text-sm font-bold text-yellow-600">{Number(review.overallRating || 0).toFixed(1)}/5.0</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Período</p>
                <p className="text-sm font-medium">
                  {new Date(review.reviewPeriodStart).toLocaleDateString()} - {new Date(review.reviewPeriodEnd).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Estado</p>
                <span className={`text-xs px-2 py-1 rounded ${
                  review.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                  review.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {review.status === 'COMPLETED' ? 'Completada' : review.status === 'IN_PROGRESS' ? 'En Progreso' : review.status === 'PENDING' ? 'Pendiente' : review.status}
                </span>
              </div>
            </div>

            {review.goals && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Objetivos</p>
                <p className="text-sm">{review.goals}</p>
              </div>
            )}

            {review.achievements && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Logros</p>
                <p className="text-sm">{review.achievements}</p>
              </div>
            )}

            {review.areasOfImprovement && (
              <div className="mb-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Áreas de Mejora</p>
                <p className="text-sm">{review.areasOfImprovement}</p>
              </div>
            )}

            {review.comments && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Comentarios</p>
                <p className="text-sm italic">{review.comments}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {reviews.length === 0 && (
        <div className="text-center py-12">
          <Award className="size-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No hay evaluaciones de desempeño</p>
        </div>
      )}
    </div>
  );
}
