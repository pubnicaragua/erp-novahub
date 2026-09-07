import React from 'react';
import { useState } from 'react';
import { EditableDataTable } from '../ui/EditableDataTable';
import { ActivityLog } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search, Activity, MousePointerClick, Database, Plus, Folder, FileText, Eye } from 'lucide-react';
import { activityLogsService, tasksService, eventsService } from '../../services/actividades.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { format } from 'date-fns';
import { InventoryViewTutorial } from '../inventory/InventoryViewTutorial';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useAuth } from '../../contexts/AuthContext';
import { storageService } from '../../services/storage.service';
import { asList, useTenantQuery } from '../../hooks/useTenantQuery';
import { ActivityDetailSheet } from './ActivityDetailSheet';

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
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { canPerform } = useAuth();
  const canViewTasks = canPerform('ACTIVITIES_TASKS', 'view');
  const canViewEvents = canPerform('ACTIVITIES_EVENTS', 'view');
  const tasksQuery = useTenantQuery<any[]>(['activities', 'tasks'], signal => tasksService.getAll(signal), {
    enabled: isAddOpen && canViewTasks,
  });
  const eventsQuery = useTenantQuery<any[]>(['activities', 'events'], signal => eventsService.getAll(signal), {
    enabled: isAddOpen && canViewEvents,
  });
  const linkedActivityIds = new Set(data.map(l => l.activityId).filter(Boolean));
  const availableTasks = asList(tasksQuery.data).filter((task: any) => !linkedActivityIds.has(task.id));
  const availableEvents = asList(eventsQuery.data).filter((event: any) => !linkedActivityIds.has(event.id));
  
  const [formData, setFormData] = useState<Omit<LogFormData, 'action' | 'entity'>>({
    details: '',
    activityType: 'NONE',
    file: null,
    activityId: undefined
  });

  const columns = [
    { 
      key: 'entity', header: 'Vínculo (Registro)', width: '25%', editable: false,
      render: (val: any) => <Badge variant="outline" className="text-xs">{val || 'Registro Libre'}</Badge> 
    },
    { key: 'details', header: 'Comentarios', width: '40%', editable: canPerform('ACTIVITIES_LOGS', 'edit') },
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
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar');
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

        toast.info('Subiendo archivo...');
        const uploaded = await storageService.uploadFile('activity-log', file, { folder: 'bitacora' });
        fileUrl = uploaded.uri;
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
    <div className="w-full min-w-0 max-w-full space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="min-w-0 rounded-2xl border-border/50 bg-card/80 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("p-3 rounded-2xl flex items-center justify-center", kpi.bg)}><kpi.icon className={cn("size-6", kpi.color)} /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.title}</p><p className="text-2xl font-black tracking-tight">{kpi.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="min-w-0 overflow-hidden rounded-3xl border-border/50 bg-card/80 shadow-sm">
        <div className="p-4 border-b border-border/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0"><h2 className="break-words text-xl font-black uppercase tracking-tight">Bitácora de Auditoría</h2></div>
          <div className="erp-list-toolbar flex min-w-0 flex-wrap items-center gap-3">
            <InventoryViewTutorial label="Qué es la Bitácora" targetPrefix="bitacora-tutorial" compact stepKeys={['title', 'data', 'actions']} copy={{ title: { title: 'Bitácora de Auditoría', description: 'La bitácora registra automáticamente todas las acciones del sistema: creaciones, ediciones, eliminaciones y subidas de archivos. Sirve para auditoría y seguimiento.' }, data: { title: 'Consulta', description: 'Usa la búsqueda y los filtros para encontrar acciones específicas por usuario, módulo o fecha.' }, actions: { title: 'Exportar', description: 'Puedes exportar el registro completo para auditorías externas o reportes.' } }} />
            <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar evento..." className="h-10 w-full rounded-xl border-border/50 bg-background/50 pl-9 text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            {canPerform('ACTIVITIES_LOGS', 'create') && (
              <Button
                data-toolbar-role="primary"
                onClick={() => setIsAddOpen(true)}
                variant="default"
                className="font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"
              >
                <Plus className="size-4" />
                Nuevo Registro
              </Button>
            )}
          </div>
        </div>
        <EditableDataTable
          data={filtered}
          columns={columns}
          onRowUpdate={canPerform('ACTIVITIES_LOGS', 'edit') ? handleUpdate : undefined}
          onRowClick={(row) => setSelectedLog(row)}
          isLoading={loading}
          onRowDelete={canPerform('ACTIVITIES_LOGS', 'delete') ? async (id) => {
            try {
              await activityLogsService.delete(String(id));
              toast.success('Registro eliminado');
              onRefresh();
            } catch (e: any) {
              toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar registro');
            }
          } : undefined}
          actions={(row: ActivityLog) => (
            <div className="flex min-w-max items-center justify-end gap-1" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
              <Button type="button" variant="ghost" size="icon" title="Ver detalle del registro" aria-label="Ver detalle del registro" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary" onClick={() => setSelectedLog(row)}><Eye className="size-4" /></Button>
            </div>
          )}
        />
      </Card>

      <ActivityDetailSheet kind="log" item={selectedLog} onOpenChange={(open) => { if (!open) setSelectedLog(null); }} />

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto rounded-3xl border-border/60 bg-background/95 p-0 shadow-2xl sm:max-w-xl">
          <DialogHeader className="border-b border-border/50 bg-gradient-to-br from-rose-500/10 via-background to-background px-6 py-5 sm:px-8">
            <div className="flex items-start gap-3 pr-6"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600"><Activity className="size-5" /></div><div><DialogTitle className="font-black tracking-tight sm:text-lg">Agregar a bitácora</DialogTitle><p className="mt-1 text-xs text-muted-foreground">Registra una acción y, si deseas, relaciónala con una actividad.</p></div></div>
          </DialogHeader>
          <div className="grid gap-5 px-6 py-6 sm:px-8">
            <div className="space-y-2">
              <Label className="text-xs font-bold">Tipo de vinculación</Label>
              <select className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={formData.activityType} onChange={e => setFormData({...formData, activityType: e.target.value as any, activityId: ''})}>
                <option value="NONE">Sin Vínculo (Registro Libre)</option>
                <option value="TASK">Tarea</option>
                <option value="EVENT">Evento</option>
              </select>
            </div>
            {formData.activityType === 'TASK' && (
              <div className="space-y-2">
                <Label className="text-xs font-bold">Seleccionar tarea</Label>
                <select className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={formData.activityId || ''} onChange={e => setFormData({...formData, activityId: e.target.value})}>
                  <option value="" disabled>Seleccione tarea...</option>
                  {availableTasks.map(t => <option key={t.id} value={t.id}>{t.title} ({format(new Date(t.createdAt), 'dd/MM/yyyy')})</option>)}
                </select>
                {availableTasks.length === 0 && <p className="text-xs text-amber-500">No hay tareas libres de bitácoras.</p>}
              </div>
            )}
            {formData.activityType === 'EVENT' && (
              <div className="space-y-2">
                <Label className="text-xs font-bold">Seleccionar evento</Label>
                <select className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={formData.activityId || ''} onChange={e => setFormData({...formData, activityId: e.target.value})}>
                  <option value="" disabled>Seleccione evento...</option>
                  {availableEvents.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                </select>
                {availableEvents.length === 0 && <p className="text-xs text-amber-500">No hay eventos libres de bitácoras.</p>}
              </div>
            )}
            <div className="space-y-2 border-t border-border/50 pt-4">
              <Label className="text-xs font-bold">Comentario o detalles</Label>
              <Input placeholder="Descripción breve..." value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} className="h-11 rounded-xl bg-background" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold">Adjuntar archivo <span className="font-normal text-muted-foreground">(opcional, máximo 1 GB)</span></Label>
              <Input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" onChange={e => setFormData({...formData, file: e.target.files?.[0] || null})} className="h-11 rounded-xl bg-background text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:font-bold file:text-primary" />
            </div>
          </div>
          <DialogFooter className="border-t border-border/50 bg-muted/[0.12] px-6 py-4 sm:px-8">
            <Button variant="outline" className="rounded-xl" onClick={() => setIsAddOpen(false)} disabled={isUploading}>Cancelar</Button>
            <Button variant="default" className="rounded-xl px-5" onClick={handleAdd} disabled={isUploading}>
              {isUploading ? 'Procesando...' : 'Guardar registro'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
