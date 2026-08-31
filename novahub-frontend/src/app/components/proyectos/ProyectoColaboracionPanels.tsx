import { useRef, useState } from 'react';
import { Plus, Trash2, Paperclip, FileText, Users, MessageSquare, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useTenantQuery, asList } from '../../hooks/useTenantQuery';
import { usersService } from '../../services/users.service';
import { storageService } from '../../services/storage.service';
import { projectsService, type ProjectActivity, type ProjectDocument, type ProjectMember } from '../../services/projects.service';
import { useAuth } from '../../contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ACTIVITY_TYPE_LABEL, formatDate } from './shared';

interface PanelsProps { projectId: string; }

export function ProyectoRecursosPanel({ projectId }: PanelsProps) {
  const { canPerform } = useAuth();
  const queryClient = useQueryClient();
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState('MEMBER');
  const membersQuery = useTenantQuery<ProjectMember[]>(['projects', 'members', projectId], (s) => projectsService.members(projectId, s), { enabled: true });
  const usersQuery = useTenantQuery<any[]>(['projects', 'users'], (s) => usersService.getAll({ signal: s } as any), { enabled: true });
  const members = asList(membersQuery.data) as ProjectMember[];
  const users = asList(usersQuery.data);
  const canEdit = canPerform('PROJECTS', 'edit');
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tenant-module', 'projects'] });

  const mutation = useMutation({
    mutationFn: (args: { type: 'add' | 'remove'; memberId?: string; payload?: any }) => {
      if (args.type === 'add') return projectsService.addMember(projectId, args.payload);
      return projectsService.removeMember(projectId, args.memberId!);
    },
    onSuccess: () => { invalidate(); toast.success('Miembros actualizados'); },
    onError: (e: any) => toast.error(e?.message || 'Error al actualizar miembros'),
  });

  const add = () => {
    if (!addUserId) return;
    mutation.mutate({ type: 'add', payload: { userId: addUserId, role: addRole } });
    setAddUserId('');
    setAddRole('MEMBER');
  };

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><Users className="size-4 text-primary" /> Equipo del proyecto</CardTitle>
        {canEdit && <span className="text-xs text-muted-foreground">{members.length} miembro(s)</span>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <Label>Agregar miembro</Label>
            <Select value={addUserId} onValueChange={setAddUserId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar usuario" /></SelectTrigger>
              <SelectContent>
                {users.filter((u: any) => !members.some((m) => m.user.id === u.id)).map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Rol</Label>
            <Select value={addRole} onValueChange={setAddRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MEMBER">Miembro</SelectItem>
                <SelectItem value="MANAGER">Gestor</SelectItem>
                <SelectItem value="CONSULTANT">Consultor</SelectItem>
                <SelectItem value="OBSERVER">Observador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={add} disabled={!addUserId} className="gap-1.5"><Plus className="size-4" /> Agregar</Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <th className="py-2">Miembro</th>
                <th className="py-2">Rol</th>
                <th className="py-2 text-right">{canEdit ? '' : ''}</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr><td colSpan={3} className="py-8 text-center text-muted-foreground">No hay miembros asignados.</td></tr>
              ) : members.map((m) => (
                <tr key={m.id} className="border-b border-border/40">
                  <td className="py-2.5">
                    <p className="font-bold">{m.user.name}</p>
                    <p className="text-xs text-muted-foreground">{m.user.email}</p>
                  </td>
                  <td><Badge variant="outline" className="border-border/60">{m.role}</Badge>{m.isPrimary && <span className="ml-1 text-[10px] font-black text-primary">PRINCIPAL</span>}</td>
                  <td className="text-right">
                    {canEdit && <Button size="icon" variant="ghost" className="size-8 text-rose-500" onClick={() => { if (window.confirm(`¿Quitar a ${m.user.name} del proyecto?`)) mutation.mutate({ type: 'remove', memberId: m.id }); }}><Trash2 className="size-4" /></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProyectoDocumentosPanel({ projectId }: PanelsProps) {
  const { canPerform } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const docsQuery = useTenantQuery<ProjectDocument[]>(['projects', 'documents', projectId], (s) => projectsService.documents(projectId, s), { enabled: true });
  const docs = asList(docsQuery.data) as ProjectDocument[];
  const canCreate = canPerform('PROJECTS_DOCUMENTS', 'create');
  const canDelete = canPerform('PROJECTS_DOCUMENTS', 'delete');
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tenant-module', 'projects'] });

  const removeMutation = useMutation({
    mutationFn: (id: string) => projectsService.removeDocument(projectId, id),
    onSuccess: () => invalidate(),
    onError: (e: any) => toast.error(e?.message || 'No se pudo eliminar el documento'),
  });

  const onFile = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await storageService.uploadFile('documents', file, { folder: 'proyectos' });
      await projectsService.registerDocument(projectId, {
        name: file.name,
        url: uploaded?.url || uploaded?.path || '',
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
      });
      toast.success('Documento adjuntado al proyecto');
      invalidate();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo subir el documento');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm"><FileText className="size-4 text-primary" /> Documentos y evidencias</CardTitle>
        {canCreate && (
          <>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1.5">
              <Paperclip className="size-4" /> {uploading ? 'Subiendo...' : 'Adjuntar archivo'}
            </Button>
          </>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/40">
          {docs.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No hay documentos adjuntos.</p>
          ) : docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10"><FileText className="size-4 text-primary" /></div>
                <div className="min-w-0">
                  <a href={d.url} target="_blank" rel="noreferrer" className="block truncate text-sm font-bold hover:underline">{d.name}</a>
                  <p className="text-xs text-muted-foreground">{d.mimeType} · {(d.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              {canDelete && <Button size="icon" variant="ghost" className="size-8 shrink-0 text-rose-500" onClick={() => { if (window.confirm(`¿Eliminar ${d.name}?`)) removeMutation.mutate(d.id); }}><Trash2 className="size-4" /></Button>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ProyectoActividadesPanel({ projectId }: PanelsProps) {
  const { canPerform } = useAuth();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const activitiesQuery = useTenantQuery<ProjectActivity[]>(['projects', 'activities', projectId], (s) => projectsService.activities(projectId, s), { enabled: true });
  const activities = asList(activitiesQuery.data) as ProjectActivity[];
  const canComment = canPerform('PROJECTS', 'create');
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tenant-module', 'projects'] });

  const commentMutation = useMutation({
    mutationFn: (text: string) => projectsService.addActivity(projectId, { type: 'COMMENT', description: text }),
    onSuccess: () => { invalidate(); setComment(''); },
    onError: (e: any) => toast.error(e?.message || 'No se pudo enviar el comentario'),
  });

  return (
    <div className="space-y-4">
      {canComment && (
        <Card className="rounded-2xl border-border/60 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Escribe un comentario o actualización del proyecto..." />
            </div>
            <div className="mt-2 flex justify-end">
              <Button size="sm" onClick={() => comment && commentMutation.mutate(comment)} disabled={!comment.trim() || commentMutation.isPending} className="gap-1.5">
                <Send className="size-4" /> Publicar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border-border/60 shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><MessageSquare className="size-4 text-primary" /> Actividad reciente</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {activities.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin actividad registrada todavía.</p>
          ) : (
            <ol className="relative space-y-4 border-l border-border/60 pl-5">
              {activities.slice(0, 50).map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[26px] top-1 flex size-3 items-center justify-center rounded-full bg-primary/20">
                    <span className="size-1.5 rounded-full bg-primary" />
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-border/60">{ACTIVITY_TYPE_LABEL[a.type] || a.type}</Badge>
                    <span className="text-xs text-muted-foreground">{a.recordedBy?.name || 'Sistema'} · {formatDate(a.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm leading-6">{a.description}</p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}