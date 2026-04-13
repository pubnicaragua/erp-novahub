import React, { useState } from 'react';
import { EditableDataTable } from '../ui/EditableDataTable';
import { ActivityLog } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, Activity, MousePointerClick, RefreshCcw, Database, Plus, Folder, FileText } from 'lucide-react';
import { activityLogsService, tasksService, eventsService } from '../../services/actividades.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

// Tipos para el nuevo log
type LogFormData = {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'UPLOAD';
  entity: string;
  details: string;
  activityType?: 'NONE' | 'TASK' | 'EVENT';
  activityId?: string;
  file?: File | null;
};

interface BitacoraViewProps {
  data: ActivityLog[];
  loading: boolean;
  onRefresh: () => void;
}

export const BitacoraView: React.FC<BitacoraViewProps> = ({ data, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [availableTasks, setAvailableTasks] = useState<any[]>([]);
  const [availableEvents, setAvailableEvents] = useState<any[]>([]);
  
  const [formData, setFormData] = useState<Omit<LogFormData, 'action' | 'entity'>>({
    details: '',
    activityType: 'NONE',
    file: null,
    activityId: undefined
  });

  // Mocking the supabase URL & Key from env
  const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

  // Fetch Tasks and Events
  React.useEffect(() => {
    if (isAddOpen) {
      Promise.all([tasksService.getAll(), eventsService.getAll()]).then(([ts, evs]) => {
        // Find which activities already have logs
        const linkedActivityIds = new Set(data.map(l => l.activityId).filter(Boolean));
        
        // Ensure ts and evs are arrays (extract data if nested)
        const taskArray = Array.isArray(ts) ? ts : ((ts as any).data || []);
        const eventArray = Array.isArray(evs) ? evs : ((evs as any).data || []);

        setAvailableTasks(taskArray.filter((t: any) => !linkedActivityIds.has(t.id)));
        setAvailableEvents(eventArray.filter((e: any) => !linkedActivityIds.has(e.id)));
      }).catch(() => toast.error('Error al cargar Tareas/Eventos vinculables'));
    }
  }, [isAddOpen, data]);

  const columns = [
    { 
      key: 'entity', header: 'Vínculo (Registro)', width: '25%', editable: false,
      render: (val: any) => <Badge variant="outline" className="text-xs">{val || 'Registro Libre'}</Badge> 
    },
    { key: 'details', header: 'Comentarios', width: '40%', editable: true },
    { key: 'createdAt', header: 'Fecha', width: '150px', render: (val: any) => val ? format(new Date(val), 'dd/MM/yyyy HH:mm') : '-' },
    { 
      key: 'fileUrl', header: 'Adjuntos', width: '10%', editable: false,
      render: (val: any, row: any) => val ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-2 bg-muted/50 border-dashed hover:border-primary">
              <Folder className="size-4 text-primary" />
              <Badge variant="secondary" className="px-1 py-0 h-4 text-[9px]">1</Badge>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2 rounded-xl shadow-xl">
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-2">Archivos Adjuntos</p>
              <a href={val} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/80 transition-colors group">
                <div className="p-2 bg-primary/10 rounded-md group-hover:bg-primary/20"><FileText className="size-4 text-primary" /></div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-semibold truncate" title={row.fileName || 'Archivo adjunto'}>{row.fileName || 'Archivo adjunto'}</p>
                  <p className="text-[10px] text-muted-foreground">{val.startsWith('http') ? 'Abrir enlace' : 'Descargar'}</p>
                </div>
              </a>
            </div>
          </PopoverContent>
        </Popover>
      ) : <span className="text-muted-foreground text-[10px]">Sin adjuntos</span>
    }
  ];

  const handleUpdate = async (id: string | number, updates: Partial<ActivityLog>) => {
    try {
      await activityLogsService.update(String(id), updates);
      toast.success('Registro actualizado');
      onRefresh();
    } catch {
      toast.error('Error al actualizar');
    }
  };

  const handleAdd = async () => {
    try {
      if (!formData.details) {
        toast.error('Garantiza agregar detalles a la bitácora');
        return;
      }

      setIsUploading(true);
      let fileUrl = '';
      
      // Manejo del archivo local y subida a supabase si hay credenciales
      if (formData.file) {
        const file = formData.file;
        const totalSizeBytes = data.reduce((acc, log) => acc + (Number(log.fileSize) || 0), 0);
        const newTotalSize = totalSizeBytes + file.size;
        
        if (newTotalSize > 1024 * 1024 * 1024) { // 1GB
          toast.error('El archivo excede el límite de almacenamiento total de la empresa (1GB).');
          setIsUploading(false);
          return;
        }

        // Simulación o Subida Real si existen las variables
        if (SUPABASE_URL && SUPABASE_ANON_KEY) {
          toast.info('Optimizando y subiendo archivo...');
          
          try {
            // Se asume la existencia de compresión local si fuese implementada
            // const imageCompression = (await import('browser-image-compression')).default;
            // let fileToUpload = file;
            // if (file.type.startsWith('image/')) {
            //    fileToUpload = await imageCompression(file, { maxSizeMB: 2, maxWidthOrHeight: 1920 });
            // }
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Petición REST directa a Supabase Storage sin necesidad de librería
            const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/bitacora_actividades/${filePath}`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': file.type || 'application/octet-stream'
              },
              body: file
            });
            
            if (!uploadRes.ok) {
               const errData = await uploadRes.json().catch(() => ({}));
               console.error('Supabase raw error:', errData);
               throw new Error(errData?.message || errData?.error || 'HTTP ' + uploadRes.status);
            }
            
            fileUrl = `${SUPABASE_URL}/storage/v1/object/public/bitacora_actividades/${filePath}`;
          } catch (e: any) {
            toast.error('Error de subida a Supabase: ' + e.message);
            setIsUploading(false);
            return;
          }
        } else {
          // Fallback visual si el enviroment no esta listo
          toast.warning('Credenciales de Supabase ausentes. Link simulado.', { duration: 4000 });
          fileUrl = `https://mock-supabase.com/bitacora_actividades/${file.name}`;
        }
      }

      await activityLogsService.create({
        action: 'UPDATE',
        entity: formData.activityType === 'TASK' ? 'Tarea' : formData.activityType === 'EVENT' ? 'Evento' : 'Registro Libre',
        details: formData.details,
        fileUrl: fileUrl || undefined,
        fileName: formData.file?.name,
        fileSize: formData.file?.size,
        fileType: formData.file?.type,
        activityId: formData.activityType !== 'NONE' && formData.activityId ? formData.activityId : undefined
      } as any);

      toast.success('Registro de bitácora creado extosamente.');
      setIsAddOpen(false);
      setFormData({ details: '', activityType: 'NONE', file: null, activityId: undefined });
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al crear registro en la bitácora');
    } finally {
      setIsUploading(false);
    }
  };

  const totalSizeBytes = data.reduce((acc, log) => acc + (Number(log.fileSize) || 0), 0);
  const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(2);

  const kpis = [
    { title: 'Almacenamiento (1GB)', value: `${totalSizeMB} MB`, icon: Database, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { title: 'Total Registros', value: data.length, icon: Activity, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Agregados', value: data.filter(l => ['CREATE','UPLOAD'].includes((l.action || '').toUpperCase())).length, icon: Plus, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Eliminados', value: data.filter(l => (l.action || '').toUpperCase() === 'DELETE').length, icon: MousePointerClick, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  ];

  const filtered = data.filter(l => l.entity?.toLowerCase().includes(searchTerm.toLowerCase()) || l.details?.toLowerCase().includes(searchTerm.toLowerCase()) || l.action?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="border-none bg-background/50 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("p-3 rounded-2xl flex items-center justify-center", kpi.bg)}><kpi.icon className={cn("size-6", kpi.color)} /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.title}</p><p className="text-2xl font-black tracking-tight">{kpi.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none bg-background/50 backdrop-blur-xl shadow-sm">
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight">Bitácora de Auditoría</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Registro de actividades del sistema</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar evento..." className="pl-9 h-10 w-64 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button
              onClick={() => setIsAddOpen(true)}
              variant="default"
              className="font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"
            >
              <Plus className="size-4" />
              Nuevo Registro
            </Button>
          </div>
        </div>
        <EditableDataTable
          data={filtered}
          columns={columns}
          onRowUpdate={handleUpdate}
          isLoading={loading}
          onRowDelete={async (id) => {
            try {
              await activityLogsService.delete(String(id));
              toast.success('Registro eliminado');
              onRefresh();
            } catch {
              toast.error('Error al eliminar registro');
            }
          }}
        />
      </Card>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-tight">Agregar a Bitácora</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Vinculación</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formData.activityType} onChange={e => setFormData({...formData, activityType: e.target.value as any, activityId: ''})}>
                <option value="NONE">Sin Vínculo (Registro Libre)</option>
                <option value="TASK">Tarea</option>
                <option value="EVENT">Evento</option>
              </select>
            </div>
            {formData.activityType === 'TASK' && (
              <div className="space-y-2">
                <Label>Seleccionar Tarea</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formData.activityId || ''} onChange={e => setFormData({...formData, activityId: e.target.value})}>
                  <option value="" disabled>Seleccione tarea...</option>
                  {availableTasks.map(t => <option key={t.id} value={t.id}>{t.title} ({format(new Date(t.createdAt), 'dd/MM/yyyy')})</option>)}
                </select>
                {availableTasks.length === 0 && <p className="text-xs text-amber-500">No hay tareas libres de bitácoras.</p>}
              </div>
            )}
            {formData.activityType === 'EVENT' && (
              <div className="space-y-2">
                <Label>Seleccionar Evento</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formData.activityId || ''} onChange={e => setFormData({...formData, activityId: e.target.value})}>
                  <option value="" disabled>Seleccione evento...</option>
                  {availableEvents.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                </select>
                {availableEvents.length === 0 && <p className="text-xs text-amber-500">No hay eventos libres de bitácoras.</p>}
              </div>
            )}
            <div className="space-y-2 border-t pt-2">
              <Label>Comentario / Detalles</Label>
              <Input placeholder="Descripción breve..." value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Adjuntar Archivo (Opcional, Máx 1GB)</Label>
              <Input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" onChange={e => setFormData({...formData, file: e.target.files?.[0] || null})} className="text-muted-foreground file:text-primary file:font-bold" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={isUploading}>Cancelar</Button>
            <Button variant="default" onClick={handleAdd} disabled={isUploading}>
              {isUploading ? 'Procesando...' : 'Guardar Registro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
