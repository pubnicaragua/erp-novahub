import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileWarning,
  LayoutDashboard,
  PlayCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { cn } from './ui/utils';
import { GuidedTour, type GuidedTourStep } from './ui/GuidedTour';
import {
  type ImplementationSetupSummary,
  type ImplementationStatus,
  type ImplementationStep,
  rememberImplementationTourContext,
} from '../services/implementation-setup.service';

interface ImplementationSetupDashboardProps {
  summary: ImplementationSetupSummary;
  onRefresh: () => void;
  onNavigateToDashboard?: () => void;
}

const statusCopy: Record<ImplementationStatus, { label: string; className: string; icon: typeof Clock3 }> = {
  pending: {
    label: 'Pendiente',
    className: 'border-border bg-muted/30 text-muted-foreground',
    icon: Clock3,
  },
  in_progress: {
    label: 'En progreso',
    className: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-600',
    icon: PlayCircle,
  },
  completed: {
    label: 'Completado',
    className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600',
    icon: CheckCircle2,
  },
  error: {
    label: 'Con errores',
    className: 'border-rose-500/20 bg-rose-500/10 text-rose-600',
    icon: FileWarning,
  },
};

function formatLastLoaded(date?: string) {
  if (!date) return 'Sin carga registrada';
  return new Intl.DateTimeFormat('es-NI', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function navigateToStep(step: ImplementationStep, tourActive: boolean, onRefresh: () => void) {
  if (step.target.action === 'validate-setup') {
    onRefresh();
    return;
  }

  rememberImplementationTourContext({
    stepId: step.id,
    module: step.target.module,
    subModule: step.target.subModule,
    action: step.target.action,
    tourActive,
  });

  window.dispatchEvent(new CustomEvent('navigate-module', {
    detail: {
      module: step.target.module,
      subModule: step.target.subModule,
    },
  }));
}

export function ImplementationSetupDashboard({ summary, onRefresh, onNavigateToDashboard }: ImplementationSetupDashboardProps) {
  const [showTour, setShowTour] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const progress = Math.round((summary.completedRequiredSteps / Math.max(summary.requiredSteps, 1)) * 100);
  const pendingSteps = summary.steps.filter((step) => step.status !== 'completed').length;

  const filteredSteps = filter === 'all'
    ? summary.steps
    : summary.steps.filter((s) => s.status === filter);

  const filterCounts = {
    all: summary.steps.length,
    pending: summary.steps.filter((s) => s.status === 'pending' || s.status === 'in_progress').length,
    completed: summary.steps.filter((s) => s.status === 'completed').length,
    error: summary.steps.filter((s) => s.status === 'error').length,
  };

  const tourSteps = useMemo<GuidedTourStep[]>(() => [
    {
      target: '[data-tour="implementation-header"]',
      title: 'Puesta en marcha del ERP',
      description: 'Este panel reemplaza temporalmente el dashboard mientras faltan datos base para operar correctamente. La idea es cerrar el setup antes de medir operacion.',
      tip: 'Cada objetivo abre el modulo real. Si el paso necesita crear algo, NovaHub deja listo el formulario cuando entras.',
      placement: 'bottom',
    },
    {
      target: '[data-tour="implementation-progress"]',
      title: 'Progreso general',
      description: 'Aqui ves cuantos pasos ya estan listos y cuantos siguen pendientes, con errores o en progreso.',
      placement: 'bottom',
    },
    ...summary.steps.map((step) => ({
      target: `[data-tour="implementation-step-${step.order}"]`,
      title: `Paso ${step.order}/${summary.totalSteps}: ${step.title}`,
      description: step.description,
      tip: step.status === 'completed'
        ? 'Aunque ya este completo, el paso queda visible para revisar, editar o eliminar datos desde el modulo real.'
        : `Presiona "${step.actionLabel}" para ir al modulo correcto y completar este dato sin salir del flujo de implementacion.`,
      placement: 'left' as const,
    })),
  ], [summary.steps, summary.totalSteps]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background p-4 pb-16 md:p-6">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div
          data-tour="implementation-header"
          className="relative overflow-hidden rounded-3xl border border-border/50 bg-card/80 shadow-sm backdrop-blur-sm"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-300" />
          <div className="absolute right-0 top-0 h-40 w-72 bg-primary/10 blur-3xl" />
          <div className="relative z-10 flex flex-col gap-5 p-5 md:p-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Badge className="mb-3 border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                Configuración inicial
              </Badge>
              <h1 className="text-3xl font-black uppercase italic leading-none tracking-[-0.04em] md:text-5xl">
                Implementación <span className="text-primary">del ERP</span>
              </h1>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              {onNavigateToDashboard && (
                <Button
                  variant="outline"
                  onClick={onNavigateToDashboard}
                  className="gap-2 rounded-xl border-border/60 bg-background/50 font-black uppercase tracking-widest text-[10px]"
                >
                  <LayoutDashboard className="size-4" />
                  Ir al dashboard
                </Button>
              )}
              <Button
                onClick={() => setShowTour(true)}
                className="gap-2 rounded-xl bg-primary font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20"
              >
                <PlayCircle className="size-4" />
                Recorrido guiado
              </Button>
            </div>
          </div>
        </div>

        <Card data-tour="implementation-progress" className="overflow-hidden rounded-3xl border-border/50 bg-card/80 shadow-sm backdrop-blur-sm">
          <CardContent className="p-5">
            <div className="grid gap-5 lg:grid-cols-[1fr_320px] lg:items-center">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black uppercase italic tracking-widest">Puesta en marcha</p>
                    <p className="text-xs text-muted-foreground">
                      {summary.completedRequiredSteps}/{summary.requiredSteps} pasos requeridos completados
                    </p>
                  </div>
                  <Badge className={cn(
                    'border px-3 py-1 text-[10px] font-black uppercase tracking-widest',
                    summary.hasBlockingErrors
                      ? 'border-rose-500/20 bg-rose-500/10 text-rose-600'
                      : 'border-cyan-500/20 bg-cyan-500/10 text-cyan-600'
                  )}>
                    {summary.hasBlockingErrors ? 'Requiere revision' : `${progress}% completado`}
                  </Badge>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-xl border border-border/50 bg-muted/20 p-2">
                <button onClick={() => setFilter('all')} className={cn('rounded-lg p-3 text-center transition-colors', filter === 'all' ? 'bg-background/90 shadow-sm' : 'hover:bg-background/40')}>
                  <p className="text-xl font-black tabular-nums">{summary.steps.length}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total</p>
                </button>
                <button onClick={() => setFilter('pending')} className={cn('rounded-lg p-3 text-center transition-colors', filter === 'pending' ? 'bg-background/90 shadow-sm' : 'hover:bg-background/40')}>
                  <p className="text-xl font-black tabular-nums">{summary.steps.filter(s => s.status !== 'completed').length}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Pendientes</p>
                </button>
                <button onClick={() => setFilter('completed')} className={cn('rounded-lg p-3 text-center transition-colors', filter === 'completed' ? 'bg-background/90 shadow-sm' : 'hover:bg-background/40')}>
                  <p className="text-xl font-black tabular-nums">{summary.completedSteps}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Completados</p>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/50 bg-card/80 shadow-sm backdrop-blur-sm">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-black uppercase italic tracking-tight">
              <ClipboardCheck className="size-5 text-primary" />
              Objetivos iniciales de implementacion
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {filteredSteps.map((step, index) => {
                const status = statusCopy[step.status];
                const StatusIcon = status.icon;
                const completed = step.status === 'completed';

                return (
                  <motion.div
                    key={step.id}
                    data-tour={`implementation-step-${step.order}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, delay: Math.min(index * 0.025, 0.3) }}
                    className={cn(
                      'grid gap-4 p-4 transition-colors md:grid-cols-[88px_1fr_220px_170px]',
                      completed ? 'bg-emerald-500/[0.025]' : 'hover:bg-muted/25'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-xl border text-sm font-black',
                        completed ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600' : 'border-border bg-background'
                      )}>
                        {completed ? <CheckCircle2 className="size-5" /> : step.order}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <p className={cn(
                          'text-sm font-black tracking-tight',
                          completed && 'text-foreground'
                        )}>
                          Paso {step.order}/{summary.totalSteps} - {step.title}
                        </p>
                        <Badge className={cn('border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest', status.className)}>
                          <StatusIcon className="mr-1 size-3" />
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-xs leading-5 text-muted-foreground">{step.description}</p>
                      {step.error && (
                        <div className="mt-2 flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-xs text-rose-600">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                          <span>{step.error}</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-1">
                      <div>
                        <p className="font-black tabular-nums">{step.validCount}</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">registros</p>
                      </div>
                      {step.discardedCount > 0 && (
                        <div>
                          <p className={cn('font-black tabular-nums', step.discardedCount > 0 && 'text-rose-600')}>{step.discardedCount}</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">con errores</p>
                        </div>
                      )}
                      <div className="col-span-2 md:col-span-1">
                        <p className="truncate text-[11px] font-medium text-muted-foreground">{formatLastLoaded(step.lastLoadedAt)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-start md:justify-end">
                      <Button
                        variant={completed ? 'outline' : 'default'}
                        onClick={() => navigateToStep(step, showTour, onRefresh)}
                        className="w-full gap-2 rounded-xl font-black md:w-auto"
                      >
                        {completed ? 'Editar' : step.actionLabel}
                        <ArrowRight className="size-4" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {showTour && (
        <GuidedTour
          steps={tourSteps}
          onClose={() => setShowTour(false)}
          title="Setup Operativo del ERP"
          allowTargetInteraction
        />
      )}
    </div>
  );
}
