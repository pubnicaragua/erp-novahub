import { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  Play, 
  Trash2, 
  Edit3, 
  Plus, 
  Search, 
  X,
  Upload,
  Video,
  ChevronRight,
  CheckCircle2,
  Save,
  Loader2,
  Sparkles,
  Bot,
  ExternalLink,
  FileText,
  DollarSign,
  ShoppingCart,
  Package,
  Wallet,
  Users,
  Activity,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { trainingService } from '../../services/training.service';
import { cn } from '../ui/utils';
import { asList, useTenantQuery } from '../../hooks/useTenantQuery';

const MODULE_CATEGORIES = [
  { id: 'ALL', label: 'Todos', color: 'bg-primary/10 text-primary border-primary/20', gradient: 'from-primary/20 to-primary/5', icon: GraduationCap },
  { id: 'SALES', label: 'Ventas', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', gradient: 'from-emerald-500 to-teal-600', icon: DollarSign },
  { id: 'PURCHASES', label: 'Compras', color: 'bg-blue-100 text-blue-700 border-blue-200', gradient: 'from-blue-500 to-indigo-600', icon: ShoppingCart },
  { id: 'INVENTORY', label: 'Inventario de Mercancías', color: 'bg-orange-100 text-orange-700 border-orange-200', gradient: 'from-orange-500 to-red-600', icon: Package },
  { id: 'FINANCIAL', label: 'Finanzas', color: 'bg-purple-100 text-purple-700 border-purple-200', gradient: 'from-purple-500 to-violet-600', icon: Wallet },
  { id: 'HR', label: 'Recursos Humanos', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', gradient: 'from-indigo-500 to-blue-700', icon: Users },
  { id: 'ACTIVITIES', label: 'Actividades', color: 'bg-amber-100 text-amber-700 border-amber-200', gradient: 'from-amber-400 to-orange-500', icon: Activity },
  { id: 'CONFIGURATION', label: 'Configuración', color: 'bg-gray-100 text-gray-700 border-gray-200', gradient: 'from-gray-500 to-slate-700', icon: Settings }
];

const PDF_GUIDES = [
  {
    title: 'Manual de Asientos Contables NovaERP',
    description: 'Guía de referencia para registrar, revisar y consultar asientos contables en el ERP.',
    module: 'FINANCIAL',
    fileUrl: new URL('../../../../documentos-novahub/Manual_Asientos_Contables_NovaERP.pdf', import.meta.url).href,
  },
  {
    title: 'Formato de Reportes',
    description: 'Modelo visual para reportes operativos y gerenciales de NovaHub, con la estructura y presentación de referencia para imprimir o compartir.',
    module: 'FINANCIAL',
    fileUrl: new URL('../../../../documentos-novahub/FORMATO DE REPORTES.pdf', import.meta.url).href,
  },
];

export function TrainingHubView() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';
  
  const videosQuery = useTenantQuery<any[]>(['training', 'videos'], async signal => asList(await trainingService.getVideos(undefined, signal)));
  const videos = asList(videosQuery.data);
  const loading = videosQuery.isLoading || videosQuery.isFetching;
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState<any | null>(null);
  const [showVideoInfo, setShowVideoInfo] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  
  const [uploadData, setUploadData] = useState({
    title: '',
    description: '',
    module: 'SALES',
    file: null as File | null
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedVideo) {
      setShowVideoInfo(true);
      const timer = setTimeout(() => {
        setShowVideoInfo(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [selectedVideo]);

  const fetchVideos = () => videosQuery.refetch();

  const handleUpload = async () => {
    if (!uploadData.title || !uploadData.file) {
      toast.error('Completa los campos obligatorios');
      return;
    }
    try {
      setSaving(true);
      toast.loading('Subiendo video...', { id: 'upload-video' });
      const uploadRes = await trainingService.uploadVideo(uploadData.file, uploadData.module.toLowerCase());
      await trainingService.createVideo({
        title: uploadData.title,
        description: uploadData.description,
        module: uploadData.module,
        videoUrl: uploadRes.data.url
      });
      toast.success('Video subido exitosamente', { id: 'upload-video' });
      setShowUploadModal(false);
      setUploadData({ title: '', description: '', module: 'SALES', file: null });
      fetchVideos();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al subir video', { id: 'upload-video' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingVideo) return;
    try {
      setSaving(true);
      await trainingService.updateVideo(editingVideo.id, {
        title: editingVideo.title,
        description: editingVideo.description,
        module: editingVideo.module
      });
      toast.success('Guía actualizada');
      setEditingVideo(null);
      fetchVideos();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setPendingDeleteId(id);
  };

  const generateSmartDescription = (title: string, module: string) => {
    if (!title) return '';
    const modName = MODULE_CATEGORIES.find(c => c.id === module)?.label || 'este módulo';
    return `Domina paso a paso el proceso de ${title} dentro del módulo de ${modName} para optimizar la gestión de tu empresa.`;
  };

  const handleAutoGenerate = () => {
    const isEditing = !!editingVideo;
    const title = isEditing ? editingVideo.title : uploadData.title;
    const mod = isEditing ? editingVideo.module : uploadData.module;
    const desc = generateSmartDescription(title, mod);
    if (desc) {
      if (isEditing) setEditingVideo({ ...editingVideo, description: desc });
      else setUploadData({ ...uploadData, description: desc });
      toast.success('Descripción generada');
    }
  };

  const filteredVideos = videos.filter(v => {
    const matchesSearch = v.title.toLowerCase().includes(search.toLowerCase()) ||
                          v.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === 'ALL' || v.module === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const openAiChat = () => {
    window.dispatchEvent(new CustomEvent('open-erp-chat', {
      detail: search.trim() ? { message: search.trim() } : {},
    }));
  };

  return (
    <div className="mx-auto w-full max-w-[1700px] space-y-6 p-4 animate-in fade-in duration-500 sm:p-6 md:p-10">
      {/* Header Original */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-[66px] shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <GraduationCap className="size-9 text-primary" />
          </div>
          <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter flex flex-wrap items-center gap-x-3 gap-y-1 uppercase italic leading-none">
            Centro de <span className="text-primary">Capacitación</span>
          </h1>
          </div>
        </div>

        {isSuperAdmin && (
          <Button 
            onClick={() => setShowUploadModal(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-xs px-6 py-6 rounded-2xl shadow-lg shadow-primary/20 border-b-4 border-primary/50 active:border-b-0 active:translate-y-1 transition-all"
          >
            <Plus className="size-5 mr-2" />
            Subir Video
          </Button>
        )}
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-gradient-to-br from-primary/10 to-transparent p-4 rounded-3xl border border-primary/20 backdrop-blur-sm shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-1">Total Guías</p>
          <p className="text-3xl font-black tracking-tighter italic">{videos.length} VIDEOS</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500/10 to-transparent p-4 rounded-3xl border border-emerald-500/20 backdrop-blur-sm shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/60 mb-1">Módulos Cubiertos</p>
          <p className="text-3xl font-black tracking-tighter italic">{new Set(videos.map(v => v.module)).size} ÁREAS</p>
        </div>
        <div className="bg-gradient-to-br from-violet-500/10 to-transparent p-4 rounded-3xl border border-violet-500/20 backdrop-blur-sm shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-violet-600/60 mb-1">Guías PDF</p>
          <p className="text-3xl font-black tracking-tighter italic">{PDF_GUIDES.length} DOCUMENTO{PDF_GUIDES.length === 1 ? '' : 'S'}</p>
        </div>
      </div>

      {/* Search & Filters Original */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-muted/30 p-2 rounded-3xl border border-border/40 backdrop-blur-md">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input 
            placeholder="¿Qué quieres aprender hoy?..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && search.trim()) {
                openAiChat();
              }
            }}
            className="pl-11 bg-background/50 border-transparent focus:bg-background rounded-2xl h-12 text-sm font-bold shadow-none"
          />
        </div>
        <Button
          onClick={openAiChat}
          className="bg-gradient-to-br from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90 text-primary-foreground font-black uppercase tracking-widest text-xs px-6 h-12 rounded-2xl shadow-lg shadow-primary/20 border-b-4 border-primary/50 active:border-b-0 active:translate-y-1 transition-all"
        >
          <Bot className="size-5 mr-2" />
          Pregúntale a la IA
        </Button>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 px-2 no-scrollbar">
          {MODULE_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border border-transparent",
                activeCategory === cat.id 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-105" 
                  : "bg-background/50 text-muted-foreground hover:bg-background hover:text-primary"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {PDF_GUIDES.length > 0 && (activeCategory === 'ALL' || PDF_GUIDES.some((guide) => guide.module === activeCategory)) && (
        <section className="space-y-3" aria-labelledby="pdf-guides-title">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary">Material de referencia</p>
              <h2 id="pdf-guides-title" className="text-2xl font-black uppercase italic tracking-tight">Guías en PDF</h2>
            </div>
            <p className="text-xs text-muted-foreground">Consulta cada documento en una pestaña nueva con el formato original.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {PDF_GUIDES.filter((guide) => activeCategory === 'ALL' || guide.module === activeCategory).map((guide) => (
              <Card key={guide.fileUrl} className="rounded-3xl border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-transparent shadow-sm">
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-600">
                      <FileText className="size-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-black uppercase italic tracking-tight">{guide.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{guide.description}</p>
                    </div>
                  </div>
                  <Button asChild variant="outline" className="shrink-0 rounded-xl font-black uppercase tracking-widest text-[10px]">
                    <a href={guide.fileUrl} target="_blank" rel="noopener noreferrer">
                      Leer PDF <ExternalLink className="ml-2 size-3.5" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Videos Grid con Gradientes */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-64 rounded-3xl bg-muted animate-pulse border border-border/40 shadow-sm" />
          ))}
        </div>
      ) : filteredVideos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredVideos.map((video, idx) => {
            const cat = MODULE_CATEGORIES.find(c => c.id === video.module) || MODULE_CATEGORIES[0];
            const Icon = cat.icon;
            
            return (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="group overflow-hidden rounded-3xl border-border/40 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 h-full flex flex-col shadow-sm">
                  <div className={cn("relative aspect-video overflow-hidden bg-gradient-to-br flex items-center justify-center", cat.gradient)}>
                    <div className="absolute inset-0 bg-black/5 mix-blend-overlay" />
                    
                    <Icon className="size-16 text-white/20 absolute -bottom-2 -right-2 rotate-12" />
                    <div className="size-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl">
                      <Icon className="size-8 text-white" />
                    </div>

                    <div className="absolute top-3 left-3 z-10">
                      <Badge className={cn("rounded-lg font-black text-[9px] uppercase tracking-tighter border-0 shadow-lg", cat.color)}>
                        {cat.label}
                      </Badge>
                    </div>

                    <button 
                      onClick={() => setSelectedVideo(video)}
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 bg-black/20"
                    >
                      <div className="size-16 rounded-full bg-white text-primary flex items-center justify-center shadow-2xl scale-75 group-hover:scale-100 transition-transform">
                        <Play className="size-8 fill-current ml-1" />
                      </div>
                    </button>
                  </div>

                  <CardContent className="p-5 flex-1 flex flex-col justify-between">
                    <div className="space-y-2">
                      <h3 className="font-black text-lg tracking-tight uppercase italic leading-tight group-hover:text-primary transition-colors">
                        {video.title}
                      </h3>
                      <p className="text-sm text-muted-foreground font-medium line-clamp-2 leading-relaxed">
                        {video.description || 'Aprende a dominar esta funcionalidad del ERP NovaHub con nuestra guía visual experta.'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/40">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setSelectedVideo(video)}
                        className="text-xs font-black uppercase tracking-widest text-primary hover:bg-primary/5 p-0 h-auto"
                      >
                        Ver Ahora
                        <ChevronRight className="size-4 ml-1" />
                      </Button>

                      {isSuperAdmin && (
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setEditingVideo({...video})}
                            className="size-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                          >
                            <Edit3 className="size-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDelete(video.id)}
                            className="size-8 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/10 rounded-[40px] border-2 border-dashed border-border/40">
          <div className="size-24 rounded-full bg-muted flex items-center justify-center mb-6 shadow-inner">
            <Video className="size-12 text-muted-foreground/30" />
          </div>
          <h2 className="text-2xl font-black tracking-tight uppercase italic">No se encontraron guías</h2>
          <Button 
            variant="outline" 
            onClick={() => { setSearch(''); setActiveCategory('ALL'); }}
            className="mt-6 rounded-2xl font-black uppercase tracking-widest text-[10px]"
          >
            Ver Todo
          </Button>
        </div>
      )}

      {/* Modales se mantienen igual */}
      <AnimatePresence>
        {selectedVideo && (
          <div className="nh-modal-root fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-4 md:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedVideo(null)}
              className="nh-modal-backdrop nh-modal-media-backdrop absolute inset-0 bg-black/95 backdrop-blur-xl"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`Video: ${selectedVideo.title}`}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="nh-modal-surface nh-modal-media-surface relative my-auto aspect-video w-full max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl"
            >
              <button 
                onClick={() => setSelectedVideo(null)}
                type="button"
                aria-label="Cerrar video"
                title="Cerrar"
                className="absolute right-3 top-3 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-all hover:scale-110 hover:bg-white/20 active:scale-95 sm:right-6 sm:top-6 sm:size-12"
              >
                <X className="size-6" />
              </button>
              <AnimatePresence>
                {showVideoInfo && (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="absolute top-6 left-6 z-10 pointer-events-none p-6 rounded-3xl bg-black/40 backdrop-blur-md border border-white/10"
                  >
                    <Badge className={cn("rounded-lg font-black text-[10px] uppercase tracking-widest border-0 shadow-lg px-3 py-1.5", 
                      MODULE_CATEGORIES.find(c => c.id === selectedVideo.module)?.color)}>
                      {MODULE_CATEGORIES.find(c => c.id === selectedVideo.module)?.label}
                    </Badge>
                    <h2 className="text-white text-3xl font-black tracking-tighter uppercase italic mt-2 drop-shadow-2xl">
                      {selectedVideo.title}
                    </h2>
                    {selectedVideo.description && (
                      <p className="text-white/70 text-sm max-w-xl mt-2 font-medium line-clamp-2">
                        {selectedVideo.description}
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              <video src={selectedVideo.videoUrl} controls autoPlay className="w-full h-full object-contain" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(showUploadModal || editingVideo) && (
          <div className="nh-modal-root fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowUploadModal(false); setEditingVideo(null); }}
              className="nh-modal-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="training-form-title"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="nh-modal-surface relative w-full max-w-lg bg-background rounded-[32px] overflow-hidden shadow-2xl border border-border/40 p-4 sm:p-8 my-8"
            >
              <div className="nh-modal-header flex items-center justify-between mb-8 border-b border-border/50 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-2xl">
                    {editingVideo ? <Edit3 className="size-6 text-primary" /> : <Upload className="size-6 text-primary" />}
                  </div>
                  <div>
                    <h2 id="training-form-title" className="text-2xl font-black tracking-tighter uppercase italic leading-none">
                      {editingVideo ? 'Editar Guía' : 'Nueva Guía'}
                    </h2>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">Sube contenido educativo</p>
                  </div>
                </div>
                <button type="button" onClick={() => { setShowUploadModal(false); setEditingVideo(null); }} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Cerrar formulario de guía" title="Cerrar">
                  <X className="size-6" />
                </button>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Título del Video</label>
                  <Input 
                    placeholder="Ej: Cómo configurar almacenes" 
                    value={editingVideo ? editingVideo.title : uploadData.title}
                    onChange={(e) => editingVideo 
                      ? setEditingVideo({ ...editingVideo, title: e.target.value })
                      : setUploadData({ ...uploadData, title: e.target.value })}
                    className="h-12 rounded-2xl font-bold bg-muted/30 border-transparent focus:bg-background transition-all shadow-none"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descripción</label>
                    <button 
                      type="button"
                      onClick={handleAutoGenerate}
                      className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center gap-1 hover:opacity-80 transition-opacity"
                    >
                      <Sparkles className="size-3" />
                      Generar con IA
                    </button>
                  </div>
                  <textarea 
                    placeholder="Describe lo que se aprenderá..." 
                    value={editingVideo ? editingVideo.description : uploadData.description}
                    onChange={(e) => editingVideo
                      ? setEditingVideo({ ...editingVideo, description: e.target.value })
                      : setUploadData({ ...uploadData, description: e.target.value })}
                    className="w-full min-h-[100px] p-4 rounded-2xl font-bold bg-muted/30 border-transparent focus:bg-background transition-all resize-none text-sm outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Módulo / Categoría</label>
                  <div className="grid grid-cols-2 gap-2">
                    {MODULE_CATEGORIES.slice(1).map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => editingVideo
                          ? setEditingVideo({ ...editingVideo, module: cat.id })
                          : setUploadData({ ...uploadData, module: cat.id })}
                        className={cn(
                          "px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border",
                          (editingVideo ? editingVideo.module : uploadData.module) === cat.id 
                            ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20" 
                            : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50"
                        )}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {!editingVideo && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Archivo de Video</label>
                    <div className="relative group">
                      <input 
                        type="file" 
                        accept="video/*"
                        onChange={(e) => setUploadData({ ...uploadData, file: e.target.files?.[0] || null })}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      />
                      <div className={cn(
                        "h-32 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all",
                        uploadData.file ? "border-emerald-500 bg-emerald-500/5" : "border-border/60 group-hover:border-primary/40 group-hover:bg-primary/5"
                      )}>
                        {uploadData.file ? (
                          <><CheckCircle2 className="size-8 text-emerald-500 mb-2" /><p className="text-xs font-black uppercase tracking-tighter text-emerald-600 line-clamp-1 px-4">{uploadData.file.name}</p></>
                        ) : (
                          <><Upload className="size-8 text-muted-foreground/40 mb-2 group-hover:text-primary/60" /><p className="text-xs font-black uppercase tracking-tighter text-muted-foreground">Click para seleccionar archivo</p></>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="nh-modal-footer mt-4 border-t border-border/50 pt-4">
                <Button 
                  onClick={editingVideo ? handleUpdate : handleUpload}
                  disabled={saving || (!editingVideo && (!uploadData.file || !uploadData.title))}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest h-14 rounded-2xl shadow-xl shadow-primary/20 mt-4 border-b-4 border-primary/50 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 className="size-5 animate-spin" /> : editingVideo ? <><Save className="size-5 mr-2" />Guardar</> : <><Plus className="size-5 mr-2" />Publicar</>}
                </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="¿Eliminar video?"
        description="¿Estás seguro de que deseas eliminar este video? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={async () => {
          const deleteId = pendingDeleteId;
          if (!deleteId) return;
          try {
            await trainingService.deleteVideo(deleteId);
            toast.success('Video eliminado');
            fetchVideos();
          } catch (e: any) {
            toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar video');
          }
          finally { setPendingDeleteId(null); }
        }}
      />
    </div>
  );
}
