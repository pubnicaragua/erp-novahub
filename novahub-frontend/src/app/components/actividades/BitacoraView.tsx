import React, { useMemo, useState } from 'react';
import { EditableDataTable } from '../ui/EditableDataTable';
import { ActivityLog } from '../../types';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Search, Activity, Database, Plus, Folder, FileText, Eye, Pencil, BookOpenText, Bot, PenLine } from 'lucide-react';
import { activityLogsService, tasksService, eventsService } from '../../services/actividades.service';
import { toast } from '@/app/services/toast';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '../../contexts/AuthContext';
import { storageService } from '../../services/storage.service';
import { asList, useTenantQuery } from '../../hooks/useTenantQuery';
import { ActivityDetailSheet } from './ActivityDetailSheet';
import { ActivityViewHeader } from './ActivityViewHeader';
import { KpiSummaryNotice } from '../ui/KpiSummaryNotice';
import { SalesKpiCard } from '../ventas/SalesKpiCard';
import { getCurrencyDecimalPlaces } from '../../utils/currency';
import { describeLogDetails, getLogActionLabel, getLogOrigin, matchesLogSearch, type LogOriginFilter } from './bitacora.helpers';
import { resolvePeriod, type PeriodPreset } from './reportPeriod';

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
  summaryError?: boolean;
  onRefresh: () => void;
}

const dayKey = (value: unknown) => {
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '' : format(date, 'yyyy-MM-dd');
};

export const BitacoraView: React.FC<BitacoraViewProps> = ({ data, loading, summaryError = false, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [originFilter, setOriginFilter] = useState<LogOriginFilter>('ALL');
  const [period, setPeriod] = useState<PeriodPreset>('ALL');
  const [onlyWithFiles, setOnlyWithFiles] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<any | null>(null);
  const [editText, setEditText] = useState('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
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

  /** Cada registro con su origen (nota del equipo o hito del sistema), una frase legible y el vínculo en palabras. */
  const rows = useMemo(() => (data as any[]).map((log) => {
    const origin = getLogOrigin(log);
    const actionLabel = getLogActionLabel(log.action, origin);
    return {
      ...log,
      origin,
      // Título de la tarjeta en pantallas angostas.
      title: log.activity?.title ? `${actionLabel}: ${log.activity.title}` : actionLabel,
      actionLabel,
      detailText: describeLogDetails(log),
      linkTitle: log.activity?.title || (origin === 'MANUAL' ? (String(log.entity || '').toUpperCase() === 'REGISTRO LIBRE' ? 'Registro libre' : log.entity) : 'Actividad'),
    };
  }), [data]);

  const range = resolvePeriod(period, { from: '', to: '' });
  const filtered = rows.filter((log) => {
    if (originFilter !== 'ALL' && log.origin !== originFilter) return false;
    if (onlyWithFiles && !log.fileUrl) return false;
    const key = dayKey(log.createdAt);
    if (range.from && (!key || key < range.from)) return false;
    if (range.to && (!key || key > range.to)) return false;
    return matchesLogSearch(log, searchTerm);
  });

  const kpiRows = loading || summaryError ? [] : filtered;
  const totalSizeBytes = kpiRows.reduce((acc, log) => acc + (Number(log.fileSize) || 0), 0);
  const totalSizeMB = (totalSizeBytes / (1024 * 1024)).toFixed(getCurrencyDecimalPlaces());

  const columns = [
    { key: 'createdAt', header: 'Fecha', width: '150px', render: (val: any) => val ? format(new Date(val), 'dd/MM/yyyy HH:mm') : '-' },
    {
      key: 'origin', header: 'Origen', width: '120px', editable: false,
      render: (val: any) => val === 'MANUAL'
        ? <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/5 text-[9px] font-black uppercase tracking-widest text-primary"><PenLine className="size-3" /> Nota</Badge>
        : <Badge variant="outline" className="gap-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground"><Bot className="size-3" /> Sistema</Badge>,
    },
    { key: 'actionLabel', header: 'Qué pasó', width: '160px', editable: false, render: (val: any) => <span className="text-xs font-semibold">{val}</span> },
    {
      key: 'linkTitle', header: 'Vínculo', width: '20%', editable: false,
      render: (val: any) => <Badge variant="outline" className="max-w-full truncate text-xs" title={String(val || '')}>{val || 'Registro libre'}</Badge>,
    },
    { key: 'detailText', header: 'Detalle', width: '35%', editable: (row: any) => canPerform('ACTIVITIES_LOGS', 'edit') && row.origin === 'MANUAL' },
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

  const handleUpdate = async (id: string | number, updates: Record<string, unknown>) => {
    try {
      // La columna muestra la frase legible; lo que se guarda es el texto de la nota.
      const payload = 'detailText' in updates ? { details: String(updates.detailText ?? '') } : updates;
      await activityLogsService.update(String(id), payload as Partial<ActivityLog>);
      toast.success('Registro actualizado');
      onRefresh();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'Error al actualizar');
    }
  };

  const saveEdit = async () => {
    if (!editingLog) return;
    const details = editText.trim();
    if (!details) { toast.error('La nota no puede quedar vacía'); return; }
    await handleUpdate(editingLog.id, { detailText: details });
    setEditingLog(null);
  };

  const handleAdd = async () => {
    try {
      if (!formData.details) {
        toast.error('Escribe qué quieres dejar registrado');
        return;
      }

      setIsUploading(true);
      let fileUrl = '';

      // Manejo del archivo local y subida a supabase si hay credenciales
      if (formData.file) {
        const file = formData.file;
        const totalBytes = data.reduce((acc, log) => acc + (Number((log as any).fileSize) || 0), 0);
        const newTotalSize = totalBytes + file.size;

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

      toast.success('Registro de bitácora creado.');
      setIsAddOpen(false);
      setFormData({ details: '', activityType: 'NONE', file: null, activityId: undefined });
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al crear registro en la bitácora');
    } finally {
      setIsUploading(false);
    }
  };

  const manualCount = kpiRows.filter((log) => log.origin === 'MANUAL').length;
  const systemCount = kpiRows.filter((log) => log.origin === 'SYSTEM').length;
  const activeFilters = (originFilter !== 'ALL' ? 1 : 0) + (period !== 'ALL' ? 1 : 0) + (onlyWithFiles ? 1 : 0);

  return (
    <div className="w-full min-w-0 max-w-full space-y-6 animate-in fade-in duration-500">
      <ActivityViewHeader
        title="Bitácora"
        tourPrefix="bitacora-tutorial"
        helpLabel="Qué es la Bitácora"
        helpTitle="Bitácora"
        helpDescription="Es el libro de hechos de las actividades. Tú dejas notas, acuerdos y archivos (por ejemplo, lo que se decidió en una reunión). El sistema anota solo lo importante: tareas reasignadas o tomadas y plazos (SLA) vencidos."
        dataTitle="Notas y hitos"
        dataDescription="Cada línea dice qué pasó, cuándo, a qué tarea o evento se refiere y qué detalle tiene. «Nota» la escribió una persona; «Sistema» se registró automáticamente y no se edita."
        actionsTitle="Para qué sirve"
        actionsDescription="Para tener constancia y poder reconstruir qué se acordó y quién tenía cada tarea. Para ver todos los cambios técnicos de datos (quién editó qué campo) usa Auditoría."
        purpose="Constancia de lo que pasó: notas que dejas tú e hitos que el sistema anota solo."
      />

      <div className="space-y-2" data-tour="bitacora-tutorial-data" aria-busy={loading}>
        <KpiSummaryNotice loading={loading} error={summaryError} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SalesKpiCard title="Registros" value={loading || summaryError ? '—' : kpiRows.length} icon={Activity} kind="filter" active={originFilter === 'ALL'} onClick={() => setOriginFilter('ALL')} sub="Según los filtros" />
          <SalesKpiCard title="Notas del equipo" value={loading || summaryError ? '—' : manualCount} icon={BookOpenText} kind="filter" active={originFilter === 'MANUAL'} onClick={() => setOriginFilter((current) => (current === 'MANUAL' ? 'ALL' : 'MANUAL'))} sub="Escritas por personas" />
          <SalesKpiCard title="Hitos del sistema" value={loading || summaryError ? '—' : systemCount} icon={Bot} kind="filter" active={originFilter === 'SYSTEM'} onClick={() => setOriginFilter((current) => (current === 'SYSTEM' ? 'ALL' : 'SYSTEM'))} sub="Reasignaciones y plazos" />
          <SalesKpiCard title="Almacenamiento" value={loading || summaryError ? '—' : `${totalSizeMB} MB`} icon={Database} kind="indicator" sub="De 1 GB por empresa" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="erp-list-toolbar flex min-w-0 flex-wrap items-center gap-3" data-tour="bitacora-tutorial-actions">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
            <Input placeholder="Buscar en la bitácora..." className="h-10 w-full rounded-xl border-border/50 bg-background/50 pl-9 text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <Select value={originFilter} onValueChange={(value) => setOriginFilter(value as LogOriginFilter)}>
            <SelectTrigger className="h-10 rounded-xl text-xs" aria-label="Origen del registro"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los orígenes</SelectItem>
              <SelectItem value="MANUAL">Notas del equipo</SelectItem>
              <SelectItem value="SYSTEM">Hitos del sistema</SelectItem>
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(value) => setPeriod(value as PeriodPreset)}>
            <SelectTrigger className="h-10 rounded-xl text-xs" aria-label="Periodo"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Cualquier fecha</SelectItem>
              <SelectItem value="TODAY">Hoy</SelectItem>
              <SelectItem value="7D">Últimos 7 días</SelectItem>
              <SelectItem value="30D">Últimos 30 días</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" variant={onlyWithFiles ? 'default' : 'outline'} data-toolbar-role="filters" aria-pressed={onlyWithFiles} onClick={() => setOnlyWithFiles((value) => !value)} className="h-10 gap-2 rounded-xl px-3 text-xs font-bold">
            <Folder className="size-3.5" /> Con archivos
          </Button>
          {activeFilters > 0 && (
            <Button type="button" variant="ghost" size="sm" data-toolbar-role="alerts" onClick={() => { setOriginFilter('ALL'); setPeriod('ALL'); setOnlyWithFiles(false); }} className="h-9 text-xs font-bold text-muted-foreground hover:text-destructive">Limpiar filtros</Button>
          )}
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

      <Card className="min-w-0 overflow-hidden rounded-3xl border-border/50 bg-card/80 shadow-sm">
        <EditableDataTable layoutMode="table"
          data={filtered}
          columns={columns}
          onRowUpdate={canPerform('ACTIVITIES_LOGS', 'edit') ? handleUpdate : undefined}
          onRowClick={(row) => setSelectedLog(row)}
          isLoading={loading}
          canDeleteRow={(row: any) => row.origin === 'MANUAL'}
          onRowDelete={canPerform('ACTIVITIES_LOGS', 'delete') ? async (id) => {
            try {
              await activityLogsService.delete(String(id));
              toast.success('Registro eliminado');
              onRefresh();
            } catch (e: any) {
              toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar registro');
            }
          } : undefined}
          actions={(row: any) => (
            <div className="flex min-w-max items-center justify-end gap-1" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
              <Button type="button" variant="ghost" size="icon" title="Ver detalle del registro" aria-label="Ver detalle del registro" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary" onClick={() => setSelectedLog(row)}><Eye className="size-4" /></Button>
              {row.origin === 'MANUAL' && canPerform('ACTIVITIES_LOGS', 'edit') && (
                <Button type="button" variant="ghost" size="icon" title="Editar la nota" aria-label="Editar la nota" className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary" onClick={() => { setEditingLog(row); setEditText(row.detailText === 'Sin comentarios.' ? '' : row.detailText); }}><Pencil className="size-4" /></Button>
              )}
            </div>
          )}
        />
      </Card>

      <ActivityDetailSheet
        kind="log"
        item={selectedLog ? { ...selectedLog, details: selectedLog.detailText } : null}
        onDelete={canPerform('ACTIVITIES_LOGS', 'delete') && selectedLog?.origin === 'MANUAL' ? async () => {
          try {
            await activityLogsService.delete(String(selectedLog.id));
            toast.success('Registro eliminado');
            onRefresh();
            setSelectedLog(null);
          } catch (e: any) {
            toast.error(e?.response?.data?.message || e?.message || 'Error al eliminar registro');
          }
        } : undefined}
        onOpenChange={(open) => { if (!open) setSelectedLog(null); }}
      />

      <Dialog open={Boolean(editingLog)} onOpenChange={(open) => { if (!open) setEditingLog(null); }}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-3xl border-border/60 bg-background/95 p-0 shadow-2xl sm:max-w-lg">
          <DialogHeader className="border-b border-border/50 px-6 py-5 sm:px-8">
            <DialogTitle className="nh-module-title">Editar nota</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 px-6 py-5 sm:px-8">
            <Label htmlFor="bitacora-edit-note" className="text-xs font-bold">Nota</Label>
            <Textarea id="bitacora-edit-note" value={editText} onChange={(event) => setEditText(event.target.value)} className="min-h-28 rounded-xl bg-background" autoFocus />
          </div>
          <DialogFooter className="border-t border-border/50 bg-muted/[0.12] px-6 py-4 sm:px-8">
            <Button variant="outline" className="rounded-xl" onClick={() => setEditingLog(null)}>Cancelar</Button>
            <Button className="rounded-xl px-5" onClick={() => void saveEdit()} disabled={!editText.trim()}>Guardar nota</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto rounded-3xl border-border/60 bg-background/95 p-0 shadow-2xl sm:max-w-xl">
          <DialogHeader className="border-b border-border/50 bg-gradient-to-br from-primary/10 via-background to-background px-6 py-5 sm:px-8">
            <div className="flex items-start gap-3 pr-6"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Activity className="size-5" /></div><div><DialogTitle className="font-black tracking-tight sm:text-lg">Nuevo registro en la bitácora</DialogTitle><p className="mt-1 text-xs text-muted-foreground">Deja constancia de un acuerdo, una decisión o un hecho y, si quieres, vincúlalo a una tarea o evento y adjunta el documento.</p></div></div>
          </DialogHeader>
          <div className="grid gap-5 px-6 py-6 sm:px-8">
            <div className="space-y-2">
              <Label className="text-xs font-bold">¿A qué se refiere?</Label>
              <select className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={formData.activityType} onChange={e => setFormData({...formData, activityType: e.target.value as any, activityId: ''})}>
                <option value="NONE">A nada en particular (registro libre)</option>
                <option value="TASK">Una tarea</option>
                <option value="EVENT">Un evento</option>
              </select>
            </div>
            {formData.activityType === 'TASK' && (
              <div className="space-y-2">
                <Label className="text-xs font-bold">Seleccionar tarea</Label>
                <select className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={formData.activityId || ''} onChange={e => setFormData({...formData, activityId: e.target.value})}>
                  <option value="" disabled>Seleccione tarea...</option>
                  {availableTasks.map(t => <option key={t.id} value={t.id}>{t.title} ({format(new Date(t.createdAt), 'dd/MM/yyyy')})</option>)}
                </select>
                {availableTasks.length === 0 && <p className="text-xs text-amber-500">Todas las tareas ya tienen un registro en la bitácora.</p>}
              </div>
            )}
            {formData.activityType === 'EVENT' && (
              <div className="space-y-2">
                <Label className="text-xs font-bold">Seleccionar evento</Label>
                <select className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={formData.activityId || ''} onChange={e => setFormData({...formData, activityId: e.target.value})}>
                  <option value="" disabled>Seleccione evento...</option>
                  {availableEvents.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                </select>
                {availableEvents.length === 0 && <p className="text-xs text-amber-500">Todos los eventos ya tienen un registro en la bitácora.</p>}
              </div>
            )}
            <div className="space-y-2 border-t border-border/50 pt-4">
              <Label className="text-xs font-bold">¿Qué quieres dejar registrado?</Label>
              <Textarea placeholder="Ej. Se acordó entregar el inventario el viernes; responsable: Ana." value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} className="min-h-24 rounded-xl bg-background" />
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
