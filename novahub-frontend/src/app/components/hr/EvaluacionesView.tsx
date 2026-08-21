import { useState, useEffect } from 'react';
import { Award, Plus, Star, AlertTriangle, MessageSquarePlus, CheckCircle2, RotateCcw, Search, ClipboardCheck } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { hrService } from '../../services/hr.service';
import { Combobox } from '../ui/Combobox';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../ui/utils';
import { ColumnFilterMenu, useColumnFilters } from '../ui/ColumnFilterMenu';
import { StatCard } from './StatCard';
import { HRViewTutorial } from './HRViewTutorial';
import { HRCreateViewShell } from './HRCreateViewShell';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  IN_PROGRESS: 'En Progreso',
  COMPLETED: 'Completada',
  ARCHIVED: 'Archivada',
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-gray-200 text-gray-600',
};

const formatDate = (value: any) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-NI', { day: '2-digit', month: 'short', year: 'numeric' });
};

export function EvaluacionesView({ reviews, employees, onRefresh }: any) {
  const { canPerform } = useAuth();
  const [showNewForm, setShowNewForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [absenceCheck, setAbsenceCheck] = useState<{ hasAbsence: boolean; items: any[]; loading: boolean }>({ hasAbsence: false, items: [], loading: false });
  const [editingPostComments, setEditingPostComments] = useState<Record<string, string>>({});
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

  const hasPeriod = newReview.employeeId && newReview.reviewPeriodStart && newReview.reviewPeriodEnd;

  useEffect(() => {
    let cancelled = false;
    if (!hasPeriod) {
      const timer = setTimeout(() => {
        if (!cancelled) setAbsenceCheck({ hasAbsence: false, items: [], loading: false });
      }, 0);
      return () => { cancelled = true; clearTimeout(timer); };
    }
    const timer = setTimeout(async () => {
      setAbsenceCheck(prev => ({ ...prev, loading: true }));
      try {
        const res: any = await hrService.checkPerformanceAbsence(
          newReview.employeeId,
          newReview.reviewPeriodStart,
          newReview.reviewPeriodEnd,
        );
        const data = res?.data?.data ?? res?.data ?? res;
        if (!cancelled) setAbsenceCheck({ hasAbsence: Boolean(data?.hasAbsence), items: data?.items || [], loading: false });
      } catch {
        if (!cancelled) setAbsenceCheck({ hasAbsence: false, items: [], loading: false });
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [newReview.employeeId, newReview.reviewPeriodStart, newReview.reviewPeriodEnd]);

  const handleCreateReview = async () => {
    if (!newReview.employeeId || !newReview.reviewerId) {
      toast.error('Empleado y evaluador son obligatorios');
      return;
    }
    if (!newReview.reviewPeriodStart || !newReview.reviewPeriodEnd) {
      toast.error('El período de evaluación es obligatorio');
      return;
    }
    if (absenceCheck.loading) {
      toast.error('Espera a que termine la verificación de ausencias');
      return;
    }
    if (absenceCheck.hasAbsence) {
      toast.error('No se puede evaluar: el empleado registra ausencias en el período seleccionado');
      return;
    }
    if (!newReview.comments.trim()) {
      toast.error('Los comentarios de la evaluación son obligatorios');
      return;
    }
    try {
      setSaving(true);
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
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error al crear evaluación');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (review: any, status: string) => {
    try {
      await hrService.updatePerformanceReview(review.id, { status });
      toast.success(status === 'COMPLETED' ? 'Evaluación completada' : status === 'IN_PROGRESS' ? 'Evaluación en progreso' : 'Estado actualizado');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error al actualizar estado');
    }
  };

  const handleComplete = (review: any) => {
    if (!(review.comments || '').trim()) {
      toast.error('La evaluación requiere comentarios antes de completarse');
      return;
    }
    if (!(review.postEvaluationComments || '').trim()) {
      setEditingPostComments(prev => ({ ...prev, [review.id]: review.postEvaluationComments || '' }));
      toast.warning('Agrega los comentarios post-evaluación para poder completar la evaluación');
      return;
    }
    handleStatusChange(review, 'COMPLETED');
  };

  const savePostComments = async (reviewId: string) => {
    const text = (editingPostComments[reviewId] || '').trim();
    try {
      await hrService.updatePerformanceReview(reviewId, { postEvaluationComments: text || null });
      toast.success('Comentarios post-evaluación guardados');
      setEditingPostComments(prev => ({ ...prev, [reviewId]: '' }));
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Error al guardar comentarios');
    }
  };

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum: number, r: any) => sum + (Number(r.overallRating) || 0), 0) / reviews.length
    : 0;

  const completedReviews = reviews.filter((r: any) => r.status === 'COMPLETED').length;
  const inProgressReviews = reviews.filter((r: any) => r.status === 'IN_PROGRESS').length;
  const pendingReviews = reviews.filter((r: any) => r.status === 'DRAFT').length;

  const colFilters = useColumnFilters();
  const employeeName = (r: any) => `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`.trim() || 'Sin empleado';
  const reviewerName = (r: any) => `${r.reviewer?.firstName || ''} ${r.reviewer?.lastName || ''}`.trim() || 'Sin evaluador';

  const searchFiltered = reviews.filter((r: any) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return employeeName(r).toLowerCase().includes(q) || reviewerName(r).toLowerCase().includes(q)
      || (r.goals || '').toLowerCase().includes(q) || (r.comments || '').toLowerCase().includes(q);
  });
  const statusFiltered = statusFilter === 'ALL' ? searchFiltered : searchFiltered.filter((r: any) => r.status === statusFilter);
  const filteredReviews = colFilters.applyTo(statusFiltered, {
    employee: (r: any) => employeeName(r),
    reviewer: (r: any) => reviewerName(r),
    status: (r: any) => String(r.status || ''),
    periodStart: (r: any) => (r.reviewPeriodStart ? new Date(r.reviewPeriodStart).getTime() : null),
  });

  const employeeOptions = [...new Map(reviews.map((r: any) => [employeeName(r), employeeName(r)])).entries()]
    .map(([, label]) => ({ value: label as string, label: label as string, count: reviews.filter((r: any) => employeeName(r) === label).length }));
  const reviewerOptions = [...new Map(reviews.map((r: any) => [reviewerName(r), reviewerName(r)])).entries()]
    .map(([, label]) => ({ value: label as string, label: label as string, count: reviews.filter((r: any) => reviewerName(r) === label).length }));
  const statusOptionsForFilter = [
    { value: 'DRAFT', label: 'Borrador', count: reviews.filter((r: any) => r.status === 'DRAFT').length },
    { value: 'IN_PROGRESS', label: 'En Progreso', count: reviews.filter((r: any) => r.status === 'IN_PROGRESS').length },
    { value: 'COMPLETED', label: 'Completada', count: reviews.filter((r: any) => r.status === 'COMPLETED').length },
  ];

  const toggleStatus = (s: string) => setStatusFilter(prev => (prev === s ? 'ALL' : s));

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4', showNewForm && 'hidden')} data-tour="hr-reviews-title">
        <StatCard
          label="Calificación Promedio"
          value={avgRating.toFixed(1)}
          icon={Award}
          tone="amber"
          sub="Promedio de todas las evaluaciones"
          active={statusFilter === 'ALL'}
          onClick={() => setStatusFilter('ALL')}
          valueClassName="flex items-center gap-1.5"
        />
        <StatCard
          label="Completadas"
          value={completedReviews}
          icon={CheckCircle2}
          tone="green"
          sub="Evaluaciones finalizadas"
          active={statusFilter === 'COMPLETED'}
          onClick={() => toggleStatus('COMPLETED')}
        />
        <StatCard
          label="En Progreso"
          value={inProgressReviews}
          icon={ClipboardCheck}
          tone="blue"
          sub="Evaluaciones en curso"
          active={statusFilter === 'IN_PROGRESS'}
          onClick={() => toggleStatus('IN_PROGRESS')}
        />
        <StatCard
          label="Borradores"
          value={pendingReviews}
          icon={RotateCcw}
          tone="gray"
          sub="Evaluaciones sin iniciar"
          active={statusFilter === 'DRAFT'}
          onClick={() => toggleStatus('DRAFT')}
        />
      </div>

      {/* Actions */}
      <div className={cn('erp-composite-toolbar flex flex-wrap items-center justify-between gap-3', showNewForm && 'hidden')} data-tour="hr-reviews-actions">
        <div className="erp-toolbar-filter-group flex min-w-0 flex-1 items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empleado, evaluador, comentarios..."
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
            label="Empleado"
            options={employeeOptions}
            selected={colFilters.state.employee?.values || []}
            onSelect={(values) => colFilters.setValues('employee', values)}
            sort={colFilters.state.employee?.sort || null}
            onSort={(sort) => colFilters.setSort('employee', sort)}
          />
          <ColumnFilterMenu
            label="Evaluador"
            options={reviewerOptions}
            selected={colFilters.state.reviewer?.values || []}
            onSelect={(values) => colFilters.setValues('reviewer', values)}
            sort={colFilters.state.reviewer?.sort || null}
            onSort={(sort) => colFilters.setSort('reviewer', sort)}
          />
          <ColumnFilterMenu
            label="Período"
            sort={colFilters.state.periodStart?.sort || null}
            onSort={(sort) => colFilters.setSort('periodStart', sort)}
            sortOptions={[{ value: 'desc', label: 'Más recientes' }, { value: 'asc', label: 'Más antiguas' }]}
          />
        </div>
        <div className="erp-toolbar-primary-group flex w-full shrink-0 items-center justify-end gap-2 md:w-auto">
          {canPerform('HR_PERFORMANCE', 'create') && (
            <Button onClick={() => setShowNewForm(!showNewForm)} data-toolbar-role="primary" className="h-10 shrink-0 gap-2 rounded-xl border border-primary/20 bg-primary px-4 text-[10px] font-black uppercase tracking-widest !text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90">
              {showNewForm ? <RotateCcw className="size-4" /> : <Plus className="size-4" />}
              {showNewForm ? 'Cancelar' : 'Nueva Evaluación'}
            </Button>
          )}
          <HRViewTutorial label="Cómo gestionar evaluaciones" targetPrefix="hr-reviews" copy={{ data: { title: 'Evaluaciones de desempeño', description: 'Filtra por estado, empleado, evaluador y período para encontrar evaluaciones.' }, actions: { description: 'Crea una evaluación y administra su avance, comentarios y resultado.' } }} />
        </div>
      </div>

      {/* New Review Form */}
      {showNewForm && (
        <HRCreateViewShell
          title="Nueva evaluación de desempeño"
          description="Registra el período, las personas involucradas y los comentarios que documentan el desempeño del empleado."
          onBack={() => setShowNewForm(false)}
        >
        <div className="space-y-1" data-tour="hr-review-form-shell">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2" data-tour="hr-review-form-title">
            <h3 className="text-lg font-semibold text-primary">Nueva Evaluación de Desempeño</h3>
            <HRViewTutorial label="Cómo crear evaluación de desempeño" targetPrefix="hr-review-form" stepKeys={['title', 'data', 'summary', 'actions']} copy={{ data: { description: 'Selecciona empleado, evaluador, período y calificación inicial.' }, summary: { title: 'Objetivos y comentarios', description: 'Documenta objetivos, logros, áreas de mejora y comentarios de la evaluación.' }, actions: { description: 'Guarda la evaluación cuando el período y los comentarios estén completos.' } }} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-tour="hr-review-form-data">
            <div>
              <label className="text-sm font-medium mb-1 block">Empleado *</label>
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
              <label className="text-sm font-medium mb-1 block">Evaluador *</label>
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
                placeholder="Buscar evaluador..."
                emptyMessage="No se encontró el evaluador"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Período Inicio *</label>
              <Input
                type="date"
                value={newReview.reviewPeriodStart}
                onChange={(e) => setNewReview({ ...newReview, reviewPeriodStart: e.target.value })}
                className="bg-background"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Período Fin *</label>
              <Input
                type="date"
                value={newReview.reviewPeriodEnd}
                onChange={(e) => setNewReview({ ...newReview, reviewPeriodEnd: e.target.value })}
                className="bg-background"
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
                onChange={(e) => setNewReview({ ...newReview, overallRating: parseFloat(e.target.value) || 0 })}
                className="bg-background"
              />
            </div>
          </div>

          {hasPeriod && (
            <div className={cn(
              'mt-4 rounded-xl border p-4 text-sm',
              absenceCheck.loading
                ? 'border-border/50 bg-muted/20 text-muted-foreground'
                : absenceCheck.hasAbsence
                  ? 'border-red-300 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300'
                  : 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300',
            )}>
              {absenceCheck.loading ? (
                <p className="flex items-center gap-2"><RotateCcw className="size-4 animate-spin" /> Verificando ausencias en el período...</p>
              ) : absenceCheck.hasAbsence ? (
                <div>
                  <p className="flex items-center gap-2 font-bold"><AlertTriangle className="size-4" /> No se puede evaluar: el empleado registra ausencias en el período</p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {absenceCheck.items.map((item: any, i: number) => (
                      <li key={i} className="flex items-center gap-2">
                        <AlertTriangle className="size-3 shrink-0" />
                        {item.type === 'LEAVE' ? 'Ausencia aprobada' : 'Inasistencia'}: {formatDate(item.startDate)}{item.endDate && formatDate(item.endDate) !== formatDate(item.startDate) ? ` al ${formatDate(item.endDate)}` : ''}
                        {item.reason ? ` — ${item.reason}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="flex items-center gap-2"><CheckCircle2 className="size-4" /> Sin ausencias en el período. El empleado puede ser evaluado.</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4" data-tour="hr-review-form-summary">
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-1 block">Objetivos</label>
              <Textarea
                value={newReview.goals}
                onChange={(e) => setNewReview({ ...newReview, goals: e.target.value })}
                placeholder="Objetivos del período"
                className="bg-background"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-1 block">Logros</label>
              <Textarea
                value={newReview.achievements}
                onChange={(e) => setNewReview({ ...newReview, achievements: e.target.value })}
                placeholder="Logros alcanzados"
                className="bg-background"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-1 block">Áreas de Mejora</label>
              <Textarea
                value={newReview.areasOfImprovement}
                onChange={(e) => setNewReview({ ...newReview, areasOfImprovement: e.target.value })}
                placeholder="Áreas a mejorar"
                className="bg-background"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-1 block">Comentarios *</label>
              <Textarea
                value={newReview.comments}
                onChange={(e) => setNewReview({ ...newReview, comments: e.target.value })}
                placeholder="Comentarios de la evaluación (obligatorios)"
                className="bg-background"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4" data-tour="hr-review-form-actions">
            <Button
              onClick={handleCreateReview}
              disabled={saving || absenceCheck.hasAbsence || absenceCheck.loading}
              className={cn('bg-primary hover:bg-primary/90 text-primary-foreground', absenceCheck.hasAbsence && 'opacity-50 cursor-not-allowed')}
            >
              {saving ? 'Creando...' : absenceCheck.hasAbsence ? 'Bloqueado por ausencias' : 'Crear Evaluación'}
            </Button>
            <Button variant="outline" onClick={() => setShowNewForm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
        </HRCreateViewShell>
      )}

      {/* Reviews List */}
      <div className={cn('grid grid-cols-1 gap-4', showNewForm && 'hidden')} data-tour="hr-reviews-data">
        {filteredReviews.map((review: any) => {
          const draftText = editingPostComments[review.id];
          const isEditingPost = draftText !== undefined;
          const isCompleteBlocked = !(review.comments || '').trim() || !(review.postEvaluationComments || '').trim();
          return (
            <div key={review.id} className="border rounded-lg p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
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
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge className={cn('text-[10px] font-black uppercase tracking-wider', STATUS_STYLES[review.status] || STATUS_STYLES.DRAFT)}>
                    {STATUS_LABELS[review.status] || review.status}
                  </Badge>
                  {review.status !== 'COMPLETED' && canPerform('HR_PERFORMANCE', 'edit') && (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleStatusChange(review, 'IN_PROGRESS')}>
                        Iniciar
                      </Button>
                      <Button
                        size="sm"
                        className={cn('h-7 px-2 text-xs text-white', isCompleteBlocked ? 'bg-green-700/60 hover:bg-green-700/60' : 'bg-green-600 hover:bg-green-700')}
                        title={isCompleteBlocked ? 'Completa comentarios y comentarios post-evaluación para habilitar' : 'Completar evaluación'}
                        onClick={() => handleComplete(review)}
                      >
                        <CheckCircle2 className="size-3 mr-1" /> Completar
                      </Button>
                    </div>
                  )}
                  {review.status === 'COMPLETED' && canPerform('HR_PERFORMANCE', 'edit') && (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => handleStatusChange(review, 'IN_PROGRESS')}>
                      Reabrir
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Período</p>
                  <p className="text-sm font-medium">
                    {formatDate(review.reviewPeriodStart)} - {formatDate(review.reviewPeriodEnd)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 mb-1 justify-end">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className={cn('size-4', star <= Math.round(Number(review.overallRating) || 0) ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300')} />
                    ))}
                  </div>
                  <p className="text-sm font-bold text-yellow-600">{Number(review.overallRating || 0).toFixed(1)}/5.0</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {review.goals && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Objetivos</p>
                    <p className="text-sm">{review.goals}</p>
                  </div>
                )}
                {review.achievements && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Logros</p>
                    <p className="text-sm">{review.achievements}</p>
                  </div>
                )}
                {review.areasOfImprovement && (
                  <div>
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

              {/* Post-evaluation comments */}
              <div className="border-t border-border/40 pt-4 mt-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <MessageSquarePlus className="size-3.5" /> Comentarios post-evaluación
                    {review.status !== 'COMPLETED' && !(review.postEvaluationComments || '').trim() && (
                      <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 px-1.5 py-0.5 rounded">
                        Obligatorio para completar
                      </span>
                    )}
                  </p>
                  {review.status === 'COMPLETED' && canPerform('HR_PERFORMANCE', 'edit') && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingPostComments(prev => ({
                      ...prev,
                      [review.id]: isEditingPost ? prev[review.id] : (review.postEvaluationComments || ''),
                    }))}>
                      {isEditingPost ? 'Cancelar' : 'Editar'}
                    </Button>
                  )}
                  {review.status !== 'COMPLETED' && canPerform('HR_PERFORMANCE', 'edit') && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingPostComments(prev => ({
                      ...prev,
                      [review.id]: isEditingPost ? prev[review.id] : (review.postEvaluationComments || ''),
                    }))}>
                      {isEditingPost ? 'Cancelar' : 'Agregar'}
                    </Button>
                  )}
                </div>
                {isEditingPost ? (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      value={draftText}
                      onChange={(e) => setEditingPostComments(prev => ({ ...prev, [review.id]: e.target.value }))}
                      placeholder="Comentarios del evaluador después de la evaluación..."
                      className="bg-background text-sm"
                      rows={2}
                    />
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="h-8 text-xs bg-primary text-primary-foreground" onClick={() => savePostComments(review.id)}>
                        Guardar comentarios
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingPostComments(prev => ({ ...prev, [review.id]: '' }))}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-sm italic text-muted-foreground">
                    {review.postEvaluationComments || 'Sin comentarios post-evaluación.'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredReviews.length === 0 && (
        <div className="text-center py-12">
          <Award className="size-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {reviews.length === 0 ? 'No hay evaluaciones de desempeño' : 'No hay evaluaciones con los filtros seleccionados'}
          </p>
        </div>
      )}
    </div>
  );
}
