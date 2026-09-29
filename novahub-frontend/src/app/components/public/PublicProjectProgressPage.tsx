import { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Clock, FolderKanban, Image as ImageIcon, Layers, AlertCircle, Building2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Skeleton } from '../ui/skeleton';
import { projectsService } from '../../services/projects.service';

interface PublicStage {
  id: string;
  order: number;
  name: string;
  description?: string;
  weight: number;
  progress: number;
  dueDate?: string;
  status: string;
}

interface PublicCapture {
  id: string;
  imageUrl: string;
  caption: string;
  stageName?: string;
  capturedAt: string;
}

interface PublicProjectData {
  company?: { name: string; logo?: string; primaryColor?: string; accentColor?: string };
  project: {
    code: string;
    name: string;
    description?: string;
    status: string;
    startDate?: string;
    endDate?: string;
    progress: number;
  };
  stages?: PublicStage[];
  captures?: PublicCapture[];
}

export function PublicProjectProgressPage() {
  // Extraer token de la URL: /public/project/:token
  const pathname = window.location.pathname;
  const token = pathname.replace(/^\/public\/project\/?/, '').split('/')[0] || '';

  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(token ? null : 'Enlace inválido o incompleto.');
  const [data, setData] = useState<PublicProjectData | null>(null);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    projectsService
      .getPublicProjectProgress(token)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || 'El enlace ha expirado o no es válido.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="w-full max-w-4xl space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="size-14 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          </div>
          <Skeleton className="h-36 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <Card className="w-full max-w-md border-destructive/30 text-center shadow-xl">
          <CardHeader className="space-y-3">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertCircle className="size-8" />
            </div>
            <CardTitle className="text-xl font-bold">Enlace no disponible</CardTitle>
            <CardDescription className="text-sm">
              {error || 'No fue posible acceder a la información de avance del proyecto.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { company, project, stages = [], captures = [] } = data;
  const primaryColor = company?.primaryColor || '#10b981';
  const customStyle = company?.primaryColor ? ({ '--primary': company.primaryColor, '--ring': company.primaryColor } as React.CSSProperties) : undefined;

  return (
    <div style={customStyle} className="min-h-screen bg-gradient-to-b from-background via-muted/10 to-background text-foreground selection:bg-primary/20">
      {/* Top Header / Branding */}
      <header className="border-b border-border/40 bg-card/60 backdrop-blur-md sticky top-0 z-20">
        <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {company?.logo ? (
              <img src={company.logo} alt={company.name} className="size-10 rounded-xl object-contain border border-border/50 bg-background p-1" />
            ) : (
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
                <Building2 className="size-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-bold truncate text-foreground/90">{company?.name || 'NovaHub ERP'}</h1>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                <Sparkles className="size-3 text-primary" /> Portal de Seguimiento de Proyecto
              </span>
            </div>
          </div>
          <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-xs font-semibold px-2.5 py-1">
            Vista del Cliente
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 space-y-8">
        {/* Project Hero Card */}
        <Card className="border-border/60 shadow-xl overflow-hidden bg-card/80 backdrop-blur-sm">
          <div className="h-2 w-full" style={{ backgroundColor: primaryColor }} />
          <CardHeader className="space-y-4 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                    {project.code}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {project.status === 'COMPLETED' ? 'Finalizado' : project.status === 'IN_PROGRESS' ? 'En Progreso' : 'Planificado'}
                  </Badge>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{project.name}</h2>
              </div>
            </div>

            {project.description ? (
              <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
                {project.description}
              </p>
            ) : null}

            {/* Dates row */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
              {project.startDate ? (
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-primary" /> Inicio: {new Date(project.startDate).toLocaleDateString('es-NI')}
                </span>
              ) : null}
              {project.endDate ? (
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5 text-muted-foreground" /> Estimado fin: {new Date(project.endDate).toLocaleDateString('es-NI')}
                </span>
              ) : null}
            </div>
          </CardHeader>

          {/* Progress Indicator */}
          <CardContent className="pt-2 pb-6">
            <div className="p-4 sm:p-5 rounded-2xl border border-border/40 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Avance Global del Proyecto
                </span>
                <span className="text-2xl font-black" style={{ color: primaryColor }}>
                  {project.progress.toFixed(1)}%
                </span>
              </div>
              <Progress value={project.progress} className="h-3 rounded-full" />
              <p className="text-[11px] text-muted-foreground text-right">
                Ponderado según las etapas clave del proyecto
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Stages Timeline / Breakdown */}
        {stages.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="size-5 text-primary" />
              <h3 className="text-lg font-bold">Etapas del Proyecto</h3>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {stages.map((st: PublicStage) => {
                const isComplete = st.status === 'COMPLETED' || st.progress >= 100;
                return (
                  <Card key={st.id} className="border-border/50 hover:border-border transition-all shadow-sm">
                    <CardHeader className="p-4 pb-2 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-muted-foreground">
                          Etapa {st.order + 1}
                        </span>
                        {isComplete ? (
                          <Badge variant="outline" className="border-emerald-500/30 text-emerald-500 bg-emerald-500/10 text-[10px] gap-1 py-0">
                            <CheckCircle2 className="size-3" /> Completada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] py-0">
                            En curso
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-bold text-base leading-snug">{st.name}</h4>
                      {st.description ? (
                        <p className="text-xs text-muted-foreground line-clamp-2">{st.description}</p>
                      ) : null}
                    </CardHeader>
                    <CardContent className="p-4 pt-2 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Peso: {Number(st.weight)}%</span>
                        <span className="font-bold">{Number(st.progress).toFixed(0)}%</span>
                      </div>
                      <Progress value={Number(st.progress)} className="h-2 rounded-full" />
                      {st.dueDate ? (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-1">
                          <Calendar className="size-3" /> Entrega: {new Date(st.dueDate).toLocaleDateString('es-NI')}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Capturas de Avance / Galería Visual */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="size-5 text-primary" />
            <h3 className="text-lg font-bold">Registro Fotográfico de Avance</h3>
          </div>

          {captures.length === 0 ? (
            <Card className="border-dashed border-border/60 text-center p-8 text-muted-foreground space-y-2">
              <FolderKanban className="size-8 mx-auto text-muted-foreground/40" />
              <p className="text-sm">Aún no se han publicado evidencias fotográficas en este proyecto.</p>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {captures.map((cap: PublicCapture) => (
                <Card key={cap.id} className="border-border/50 overflow-hidden shadow-md group hover:shadow-xl transition-all">
                  <div className="aspect-video w-full bg-muted overflow-hidden relative">
                    <img
                      src={cap.imageUrl}
                      alt={cap.caption}
                      className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    {cap.stageName ? (
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-[10px] font-semibold text-white">
                        {cap.stageName}
                      </span>
                    ) : null}
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <p className="text-sm text-foreground/90 font-medium leading-relaxed">
                      {cap.caption}
                    </p>
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="size-3" />
                      {new Date(cap.capturedAt).toLocaleDateString('es-NI', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} {company?.name || 'NovaHub ERP'}. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
