import { useEffect, useState } from 'react';
import { Building2, FileText, Loader2, MessageCircle, Users } from 'lucide-react';
import { supportConversationsService, subscribeToSupportAdminQueue, type SupportConversation, type UnassignedSupportConversation } from '../../services/support-conversations.service';
import { asList, useTenantQuery } from '../../hooks/useTenantQuery';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { MessageAttachments } from '../notificaciones/MessageAttachments';

export function UnassignedSupportQueue() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queueQuery = useTenantQuery<UnassignedSupportConversation[]>(
    ['platform-support-unassigned-conversations'],
    (signal) => supportConversationsService.getUnassignedConversations(signal),
  );
  const detailQuery = useTenantQuery<SupportConversation>(
    ['platform-support-unassigned-conversation', selectedId || 'none'],
    (signal) => supportConversationsService.getUnassignedConversation(selectedId || '', signal),
    { enabled: Boolean(selectedId) },
  );
  const conversations = asList(queueQuery.data) as UnassignedSupportConversation[];
  const selectedSummary = conversations.find((conversation) => conversation.id === selectedId);

  useEffect(() => subscribeToSupportAdminQueue(() => { void queueQuery.refetch(); }), [queueQuery.refetch]);

  return <>
    <Card className="rounded-2xl border-amber-500/25 bg-amber-500/[0.035] shadow-sm">
      <CardHeader className="flex flex-col gap-3 space-y-0 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300"><MessageCircle className="size-5" /></span>
          <div className="min-w-0">
            <CardTitle className="text-base font-black">Solicitudes sin usuario de soporte vinculado</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Las solicitudes están guardadas y esperan a que una cuenta de soporte tenga alcance sobre su sucursal.</p>
          </div>
        </div>
        <Badge variant="outline" className="w-fit shrink-0 border-amber-500/30 text-amber-700 dark:text-amber-300" aria-live="polite">{conversations.length} {conversations.length === 1 ? 'pendiente' : 'pendientes'}</Badge>
      </CardHeader>
      <CardContent className="pt-2">
        {queueQuery.isLoading ? <div className="flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/50 p-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Cargando solicitudes…</div>
          : queueQuery.isError ? <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive" role="alert">{getErrorMessage(queueQuery.error, 'No pudimos cargar las solicitudes sin usuario vinculado.')} <Button type="button" variant="link" className="h-auto p-0 pl-1 text-destructive" onClick={() => void queueQuery.refetch()}>Reintentar</Button></div>
            : conversations.length === 0 ? <div className="rounded-xl border border-dashed border-border/70 bg-background/40 p-7 text-center"><Users className="mx-auto size-7 text-muted-foreground/60" /><p className="mt-2 text-sm font-semibold">No hay solicitudes pendientes de vinculación</p><p className="mt-1 text-xs text-muted-foreground">Las nuevas solicitudes de sucursales sin cobertura aparecerán aquí.</p></div>
              : <div className="grid min-w-0 gap-3 xl:grid-cols-2">{conversations.map((conversation) => <button key={conversation.supportConversationId} type="button" aria-label={`Ver solicitud ${conversation.title} de ${conversation.branchName}`} onClick={() => setSelectedId(conversation.id)} className="min-w-0 rounded-xl border border-border/70 bg-background/60 p-4 text-left transition hover:border-primary/30 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex min-w-0 items-start justify-between gap-3"><span className="min-w-0"><span className="block break-words font-bold">{conversation.title}</span><span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Building2 className="size-3.5 shrink-0" /><span className="truncate">{conversation.branchName}</span></span></span><Badge variant="outline" className="shrink-0 border-amber-500/30 text-amber-700 dark:text-amber-300">Sin vincular</Badge></span>
                <span className="mt-2 block break-words text-sm text-muted-foreground">{conversation.preview || 'La solicitud no contiene texto.'}</span>
                <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground"><span>{conversation.enterpriseGroupName} · {conversation.businessUnitName}</span><span>{formatDate(conversation.lastMessageAt)}</span>{conversation.latestMessage?.attachments.length ? <span className="inline-flex items-center gap-1"><FileText className="size-3.5" />{conversation.latestMessage.attachments.length} adjunto(s)</span> : null}</span>
              </button>)}</div>}
      </CardContent>
    </Card>

    <Dialog open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
      <DialogContent className="flex max-h-[min(90vh,calc(100dvh-1rem))] w-[calc(100vw-1rem)] max-w-3xl flex-col overflow-hidden rounded-2xl p-4 sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle className="break-words">{detailQuery.data?.title || 'Solicitud pendiente'}</DialogTitle>
          <DialogDescription>{selectedSummary?.branchName ? `Sucursal: ${selectedSummary.branchName}.` : 'Detalle de la solicitud pendiente de cobertura.'} Esta conversación todavía no tiene usuarios de soporte vinculados.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-border/60 bg-muted/20 p-3 sm:p-4">
          {detailQuery.isLoading ? <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Cargando mensajes y adjuntos…</div>
            : detailQuery.isError ? <div className="p-8 text-center text-sm text-destructive" role="alert">{getErrorMessage(detailQuery.error, 'No pudimos abrir esta solicitud.')}</div>
              : detailQuery.data?.messages.map((message) => <article key={message.id} className="min-w-0 rounded-xl border border-border/70 bg-card p-3 shadow-sm">
                <header className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-bold">{message.sender?.name || 'Usuario de sucursal'}</span><time className="text-[11px] text-muted-foreground">{formatDate(message.createdAt)}</time></header>
                {message.content && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.content}</p>}
                <MessageAttachments threadId={detailQuery.data.id} kind="SUPPORT" attachments={message.attachments} mine={false} attachmentAccess="superadmin-unassigned" />
              </article>)}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 pt-3"><p className="text-xs text-muted-foreground">Solo lectura · no se asigna a una persona en particular.</p><Button type="button" variant="outline" onClick={() => setSelectedId(null)}>Cerrar</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function getErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: unknown } } } | null)?.response?.data?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}
