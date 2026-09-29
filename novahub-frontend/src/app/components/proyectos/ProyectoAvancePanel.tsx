import { useState } from 'react';
import {
  Calendar,
  Check,
  Copy,
  Eye,
  FolderKanban,
  Image as ImageIcon,
  Layers,
  Link as LinkIcon,
  Plus,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Skeleton } from '../ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { cn } from '../ui/utils';
import { invalidateTenantQueries, useTenantQuery } from '../../hooks/useTenantQuery';
import {
  projectsService,
  type ProjectDetail,
  type ProjectProgressCapture,
  type ProjectPublicLink,
} from '../../services/projects.service';
import { queryClient } from '../../services/query-client';
import { storageService } from '../../services/storage.service';

interface ProyectoAvancePanelProps {
  projectId: string;
  project: ProjectDetail;
}

export function ProyectoAvancePanel({ projectId, project }: ProyectoAvancePanelProps) {
  // Queries
  const capturesQuery = useTenantQuery<ProjectProgressCapture[]>(
    ['projects', projectId, 'captures'],
    (signal) => projectsService.captures(projectId, undefined, signal),
  );
  const linksQuery = useTenantQuery<ProjectPublicLink[]>(
    ['projects', projectId, 'publicLinks'],
    (signal) => projectsService.publicLinks(projectId, signal),
  );

  // States
  const [isEditingWeights, setIsEditingWeights] = useState(false);
  const [milestoneWeights, setMilestoneWeights] = useState<{ [id: string]: { weight: number; progress: number } }>({});
  const [isSavingWeights, setIsSavingWeights] = useState(false);

  // Capture modal state
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload');
  const [captureForm, setCaptureForm] = useState({
    imageUrl: '',
    caption: '',
    milestoneId: '',
    isPublic: true,
  });
  const [isSavingCapture, setIsSavingCapture] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const MAX_CAPTURE_BYTES = 10 * 1024 * 1024;

  // La vista previa usa una URL local del archivo; el valor que se guarda en la
  // captura es la referencia de Storage. Antes se guardaba el archivo como data
  // URL (base64) y una foto de 10 MB ocupaba ~13 MB de texto en la base.
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setCaptureError('El archivo debe ser una imagen.');
      return;
    }
    if (file.size > MAX_CAPTURE_BYTES) {
      setCaptureError('El archivo supera el tamaño máximo permitido de 10 MB.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setCaptureError(null);
  };

  const clearSelectedImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(null);
    setPreviewUrl(null);
    setCaptureForm((prev) => ({ ...prev, imageUrl: '' }));
  };

  const closeCaptureModal = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(null);
    setPreviewUrl(null);
    setCaptureError(null);
    setImageMode('upload');
    setShowCaptureModal(false);
  };

  // Public link state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkExpiresAt, setLinkExpiresAt] = useState('');
  const [revokeExisting, setRevokeExisting] = useState(true);
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const captures = capturesQuery.data || [];
  const publicLinks = linksQuery.data || [];
  const activeLink = publicLinks.find((l) => l.isActive);

  // Start editing weights
  const handleStartEditWeights = () => {
    const initial: { [id: string]: { weight: number; progress: number } } = {};
    (project.milestones || []).forEach((m) => {
      initial[m.id] = {
        weight: Number(m.weight ?? 1),
        progress: Number(m.progress ?? 0),
      };
    });
    setMilestoneWeights(initial);
    setIsEditingWeights(true);
  };

  // Save weights
  const handleSaveWeights = async () => {
    try {
      setIsSavingWeights(true);
      for (const m of project.milestones || []) {
        const current = milestoneWeights[m.id];
        if (current) {
          await projectsService.updateMilestoneWeight(projectId, m.id, {
            weight: current.weight,
            progress: current.progress,
          });
        }
      }
      await invalidateTenantQueries(queryClient);
      setIsEditingWeights(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Error al guardar ponderaciones.');
    } finally {
      setIsSavingWeights(false);
    }
  };

  // Create capture
  const handleCreateCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captureForm.caption) return;
    if (imageMode === 'url' && !captureForm.imageUrl) {
      setCaptureError('Ingresá el enlace de la imagen.');
      return;
    }
    if (imageMode === 'upload' && !pendingFile) {
      setCaptureError('Seleccioná una imagen.');
      return;
    }

    try {
      setIsSavingCapture(true);
      setCaptureError(null);

      // El archivo se sube recién al confirmar, no al seleccionarlo: así no
      // quedan objetos en Storage cuando el usuario cierra el diálogo.
      let imageReference = captureForm.imageUrl;
      if (pendingFile) {
        const uploaded = await storageService.uploadFile('project-evidence', pendingFile, {
          folder: `project-evidence/${projectId}`,
        });
        imageReference = uploaded.uri;
      }

      await projectsService.createCapture(projectId, {
        imageUrl: imageReference,
        caption: captureForm.caption,
        milestoneId: captureForm.milestoneId || undefined,
        isPublic: captureForm.isPublic,
      });
      await invalidateTenantQueries(queryClient);
      closeCaptureModal();
      setCaptureForm({ imageUrl: '', caption: '', milestoneId: '', isPublic: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCaptureError(msg || 'Error al guardar captura.');
    } finally {
      setIsSavingCapture(false);
    }
  };

  // Delete capture
  const handleDeleteCapture = async (captureId: string) => {
    if (!confirm('¿Desea eliminar esta evidencia visual?')) return;
    try {
      await projectsService.deleteCapture(projectId, captureId);
      await invalidateTenantQueries(queryClient);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Error al eliminar captura.');
    }
  };

  // Create public link
  const handleCreatePublicLink = async () => {
    try {
      setIsCreatingLink(true);
      await projectsService.createPublicLink(projectId, {
        expiresAt: linkExpiresAt ? new Date(linkExpiresAt) : undefined,
        revokeExisting,
      });
      await invalidateTenantQueries(queryClient);
      setShowLinkModal(false);
      setLinkExpiresAt('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Error al generar enlace público.');
    } finally {
      setIsCreatingLink(false);
    }
  };

  // Revoke public link
  const handleRevokePublicLink = async (linkId: string) => {
    if (!confirm('¿Está seguro de revocar este enlace? El cliente ya no podrá consultar el avance.')) return;
    try {
      await projectsService.revokePublicLink(projectId, linkId);
      await invalidateTenantQueries(queryClient);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'Error al revocar enlace.');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* 1. Global Progress and Client Public Link Card */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Progress Card */}
        <Card className="border-border/60 shadow-sm md:col-span-1">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <FolderKanban className="size-4 text-primary" /> Avance Ponderado Global
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-black text-primary">
                {Number(project.progress || 0).toFixed(1)}%
              </span>
              <span className="text-xs text-muted-foreground">
                {(project.milestones || []).length} etapas evaluadas
              </span>
            </div>
            <Progress value={Number(project.progress || 0)} className="h-2.5 rounded-full" />
            <p className="text-[11px] text-muted-foreground leading-tight">
              Calculado automáticamente como el promedio ponderado de los hitos según su peso relativo.
            </p>
          </CardContent>
        </Card>

        {/* Public Link Card */}
        <Card className="border-border/60 shadow-sm md:col-span-2">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <LinkIcon className="size-4 text-primary" /> Enlace Público para Cliente
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowLinkModal(true)} className="gap-1.5 text-xs h-7">
                <Plus className="size-3.5" /> Generar Enlace
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-3">
            {activeLink ? (
              <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 font-bold text-primary">
                    <Eye className="size-3.5" /> Enlace Activo
                  </span>
                  <div className="flex items-center gap-2">
                    {activeLink.expiresAt ? (
                      <span className="text-[11px] text-muted-foreground">
                        Expira: {new Date(activeLink.expiresAt).toLocaleDateString('es-NI')}
                      </span>
                    ) : (
                      <Badge variant="outline" className="text-[10px] py-0">Sin expiración</Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {activeLink._count?.accessLogs || 0} visitas
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/public/project/${activeLink.tokenHash}`}
                    className="h-8 text-xs font-mono bg-background"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 px-2.5 gap-1 text-xs shrink-0"
                    onClick={() => copyToClipboard(`${window.location.origin}/public/project/${activeLink.tokenHash}`, activeLink.id)}
                  >
                    {copiedToken === activeLink.id ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                    {copiedToken === activeLink.id ? 'Copiado' : 'Copiar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => handleRevokePublicLink(activeLink.id)}
                    title="Revocar enlace"
                  >
                    <XCircle className="size-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-3 text-xs text-muted-foreground">
                <p>No hay un enlace público activo para este proyecto.</p>
                <p className="text-[11px]">Genere un enlace para que el cliente pueda consultar fotos y avances sin iniciar sesión.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 2. Etapas Ponderadas */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Layers className="size-4 text-primary" /> Cronograma de Etapas y Ponderación
              </CardTitle>
              <CardDescription className="text-xs">
                Asigne peso a cada hito para que el avance general refleje la importancia real de cada fase.
              </CardDescription>
            </div>
            {!isEditingWeights ? (
              <Button size="sm" variant="outline" onClick={handleStartEditWeights} className="text-xs h-7">
                Modificar Ponderaciones
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setIsEditingWeights(false)} disabled={isSavingWeights} className="text-xs h-7">
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleSaveWeights} disabled={isSavingWeights} className="text-xs h-7">
                  {isSavingWeights ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/60 bg-muted/20 text-muted-foreground text-[11px] uppercase tracking-wider">
                  <th className="p-3 pl-4">#</th>
                  <th className="p-3">Hito / Etapa</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right w-28">Peso (%)</th>
                  <th className="p-3 text-right w-28">Avance (%)</th>
                  <th className="p-3 text-right pr-4">Fecha Estimada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {(project.milestones || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                      No hay hitos registrados en este proyecto.
                    </td>
                  </tr>
                ) : (
                  (project.milestones || []).map((m, idx) => {
                    const isEditing = isEditingWeights && milestoneWeights[m.id];
                    return (
                      <tr key={m.id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-3 pl-4 font-mono text-muted-foreground">{idx + 1}</td>
                        <td className="p-3">
                          <p className="font-bold text-foreground">{m.name}</p>
                          {m.description ? <p className="text-[11px] text-muted-foreground line-clamp-1">{m.description}</p> : null}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px] py-0">
                            {m.status === 'COMPLETED' ? 'Completado' : m.status === 'IN_PROGRESS' ? 'En Curso' : 'Pendiente'}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.5"
                              value={milestoneWeights[m.id].weight}
                              onChange={(e) =>
                                setMilestoneWeights((prev) => ({
                                  ...prev,
                                  [m.id]: { ...prev[m.id], weight: parseFloat(e.target.value) || 0 },
                                }))
                              }
                              className="h-7 text-right font-mono text-xs w-20 ml-auto"
                            />
                          ) : (
                            <span className="font-mono font-bold">{Number(m.weight || 0)}%</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={milestoneWeights[m.id].progress}
                              onChange={(e) =>
                                setMilestoneWeights((prev) => ({
                                  ...prev,
                                  [m.id]: { ...prev[m.id], progress: parseFloat(e.target.value) || 0 },
                                }))
                              }
                              className="h-7 text-right font-mono text-xs w-20 ml-auto"
                            />
                          ) : (
                            <span className="font-mono font-bold">{Number(m.progress || 0)}%</span>
                          )}
                        </td>
                        <td className="p-3 text-right pr-4 text-muted-foreground">
                          {m.dueDate ? new Date(m.dueDate).toLocaleDateString('es-NI') : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 3. Capturas de Avance Visual */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ImageIcon className="size-4 text-primary" /> Evidencias Fotográficas de Avance
              </CardTitle>
              <CardDescription className="text-xs">
                Capturas visibles en la vista pública compartida con el cliente.
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowCaptureModal(true)} className="gap-1.5 text-xs h-7">
              <Plus className="size-3.5" /> Agregar Captura
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {capturesQuery.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Skeleton className="h-44 rounded-xl" />
              <Skeleton className="h-44 rounded-xl" />
              <Skeleton className="h-44 rounded-xl" />
            </div>
          ) : captures.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border/50 rounded-xl space-y-2">
              <ImageIcon className="size-8 mx-auto text-muted-foreground/30" />
              <p>No se han registrado evidencias fotográficas de avance.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {captures.map((cap) => (
                <div key={cap.id} className="group relative rounded-xl border border-border/50 overflow-hidden bg-card shadow-sm hover:shadow-md transition-all">
                  <div className="aspect-video w-full bg-muted overflow-hidden relative">
                    <img src={cap.imageUrl} alt={cap.caption} className="size-full object-cover group-hover:scale-105 transition-transform" />
                    {cap.milestone?.name ? (
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-[10px] text-white font-medium">
                        {cap.milestone.name}
                      </span>
                    ) : null}
                  </div>
                  <div className="p-3 space-y-1.5">
                    <p className="text-xs font-medium line-clamp-2">{cap.caption}</p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" /> {new Date(cap.capturedAt).toLocaleDateString('es-NI')}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteCapture(cap.id)}
                        title="Eliminar captura"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Agregar Captura */}
      <Dialog open={showCaptureModal} onOpenChange={setShowCaptureModal}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateCapture} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Agregar Evidencia Fotográfica</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold">Imagen de Evidencia *</label>
                  <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
                    <button
                      type="button"
                      onClick={() => setImageMode('upload')}
                      className={cn(
                        'flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md transition-colors',
                        imageMode === 'upload' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Upload className="size-3" /> Adjuntar archivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageMode('url')}
                      className={cn(
                        'flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-md transition-colors',
                        imageMode === 'url' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <LinkIcon className="size-3" /> Enlace URL
                    </button>
                  </div>
                </div>

                {imageMode === 'upload' ? (
                  <div className="space-y-2">
                    <div className="relative border-2 border-dashed border-border/80 rounded-xl p-4 text-center hover:border-primary/50 transition-colors bg-muted/10">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="absolute inset-0 size-full opacity-0 cursor-pointer"
                      />
                      <div className="flex flex-col items-center justify-center gap-1">
                        <Upload className="size-6 text-muted-foreground/60" />
                        <p className="text-xs font-semibold">
                          {pendingFile ? pendingFile.name : 'Haz clic o arrastra un archivo de imagen'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">PNG, JPG, WEBP hasta 10 MB</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Input
                    required
                    placeholder="Ej. https://drive.google.com/uc?id=... o https://..."
                    value={captureForm.imageUrl}
                    onChange={(e) => setCaptureForm({ ...captureForm, imageUrl: e.target.value })}
                    className="h-8 text-xs"
                  />
                )}

                {(previewUrl || (imageMode === 'url' && captureForm.imageUrl)) ? (
                  <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-border/60 bg-black/5 mt-2">
                    <img src={previewUrl || captureForm.imageUrl} alt="Vista previa" className="size-full object-cover" />
                    <button
                      type="button"
                      onClick={clearSelectedImage}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-destructive transition-colors"
                      title="Quitar imagen"
                    >
                      <XCircle className="size-3.5" />
                    </button>
                  </div>
                ) : null}

                {captureError ? (
                  <p role="alert" className="text-[11px] font-semibold text-destructive">{captureError}</p>
                ) : null}
              </div>

              <div className="space-y-1">
                <label className="font-semibold">Descripción del Avance *</label>
                <Input
                  required
                  placeholder="Ej: Vaciado de losa completado según especificaciones"
                  value={captureForm.caption}
                  onChange={(e) => setCaptureForm({ ...captureForm, caption: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold">Hito / Etapa Asociada (Opcional)</label>
                <select
                  value={captureForm.milestoneId}
                  onChange={(e) => setCaptureForm({ ...captureForm, milestoneId: e.target.value })}
                  className="w-full h-8 px-2 rounded-md border border-border bg-background text-xs"
                >
                  <option value="">Ninguna / Avance general</option>
                  {(project.milestones || []).map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={closeCaptureModal} disabled={isSavingCapture} className="h-8 text-xs">
                Cancelar
              </Button>
              <Button type="submit" disabled={isSavingCapture} className="h-8 text-xs font-bold">
                {isSavingCapture ? 'Guardando...' : 'Publicar Captura'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Generar Enlace Público */}
      <Dialog open={showLinkModal} onOpenChange={setShowLinkModal}>
        <DialogContent className="sm:max-w-md">
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Generar Enlace Público para Cliente</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-xs">
              <p className="text-muted-foreground">
                Se creará un enlace seguro con token aleatorio que permite consultar avances y fotos del proyecto sin necesidad de registrarse.
              </p>

              <div className="space-y-1">
                <label className="font-semibold">Fecha de Expiración (Opcional)</label>
                <Input
                  type="date"
                  value={linkExpiresAt}
                  onChange={(e) => setLinkExpiresAt(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="revokePrev"
                  checked={revokeExisting}
                  onChange={(e) => setRevokeExisting(e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="revokePrev" className="text-xs cursor-pointer">
                  Revocar enlaces activos anteriores de este proyecto
                </label>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setShowLinkModal(false)} disabled={isCreatingLink} className="h-8 text-xs">
                Cancelar
              </Button>
              <Button onClick={handleCreatePublicLink} disabled={isCreatingLink} className="h-8 text-xs font-bold">
                {isCreatingLink ? 'Generando...' : 'Crear Enlace'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
