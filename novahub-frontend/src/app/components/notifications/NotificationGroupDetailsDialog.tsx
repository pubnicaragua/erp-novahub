import { useInfiniteQuery } from '@tanstack/react-query';
import { ArrowUpRight, CheckCheck, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import type { Notification } from '../../types';
import { notificationsService } from '../../services/notifications.service';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

type NotificationGroupDetailsDialogProps = {
  open: boolean;
  group: Notification | null;
  managerGroupId?: string;
  onOpenChange: (open: boolean) => void;
  onOpenNotification: (notification: Notification) => void;
  onMarkGroupRead: (group: Notification, throughNotificationId: string) => Promise<void>;
};

export function NotificationGroupDetailsDialog({
  open,
  group,
  managerGroupId,
  onOpenChange,
  onOpenNotification,
  onMarkGroupRead,
}: NotificationGroupDetailsDialogProps) {
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const groupId = group?.notificationGroupId || group?.id || '';
  const detailsQuery = useInfiniteQuery({
    queryKey: ['notification-group-items', managerGroupId || 'tenant', groupId],
    enabled: open && Boolean(groupId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => managerGroupId
      ? notificationsService.getManagerInboxGroupItems(managerGroupId, groupId, pageParam, signal)
      : notificationsService.getInboxGroupItems(groupId, pageParam, signal),
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    refetchOnMount: 'always',
  });
  const items = detailsQuery.data?.pages.flatMap((page) => page.items) || [];
  const latestNotificationId = detailsQuery.data?.pages[0]?.latestNotificationId
    || group?.latestNotificationId
    || group?.id
    || '';

  const handleMarkGroupRead = async () => {
    if (!group || !latestNotificationId || isMarkingRead) return;
    setIsMarkingRead(true);
    try {
      await onMarkGroupRead(group, latestNotificationId);
      onOpenChange(false);
    } finally {
      setIsMarkingRead(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(88dvh,48rem)] max-w-2xl gap-4">
        <DialogHeader className="pr-9 text-left">
          <DialogTitle className="break-words">{group?.title || 'Notificaciones'}</DialogTitle>
          <DialogDescription>
            {group?.groupCount || 1} avisos en este grupo · {group?.unreadCount || 0} sin leer
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain pr-1">
          {detailsQuery.isPending && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
              <LoaderCircle className="size-4 animate-spin" /> Cargando avisos…
            </div>
          )}
          {detailsQuery.isError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
              No se pudieron cargar los avisos de este grupo.
              <Button variant="outline" size="sm" className="ml-3" onClick={() => void detailsQuery.refetch()}>
                Reintentar
              </Button>
            </div>
          )}
          {items.map((item) => (
            <div key={item.id} className="flex min-w-0 items-start gap-3 rounded-xl border border-border/70 bg-card/60 p-3">
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${item.read ? 'bg-muted-foreground/40' : 'bg-primary'}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold leading-5 text-foreground">{item.title}</p>
                <p className="mt-1 whitespace-pre-line break-words text-xs leading-5 text-muted-foreground">{item.message}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <time dateTime={item.timestamp}>{new Date(item.timestamp).toLocaleString('es-NI', { dateStyle: 'medium', timeStyle: 'short' })}</time>
                  <span>{item.read ? 'Leída' : 'Pendiente'}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 px-2"
                aria-label={`Abrir: ${item.title}`}
                onClick={() => onOpenNotification(item)}
              >
                <span className="hidden sm:inline">Abrir</span>
                <ArrowUpRight aria-hidden="true" />
              </Button>
            </div>
          ))}
          {detailsQuery.hasNextPage && (
            <Button
              variant="outline"
              className="self-center"
              disabled={detailsQuery.isFetchingNextPage}
              onClick={() => void detailsQuery.fetchNextPage()}
            >
              {detailsQuery.isFetchingNextPage && <LoaderCircle className="animate-spin" />}
              Cargar más avisos
            </Button>
          )}
        </div>

        <DialogFooter className="border-t border-border/60 pt-3">
          <Button
            variant="secondary"
            disabled={!group || group.unreadCount === 0 || isMarkingRead || detailsQuery.isPending || detailsQuery.isError}
            onClick={() => void handleMarkGroupRead()}
          >
            {isMarkingRead ? <LoaderCircle className="animate-spin" /> : <CheckCheck />}
            Marcar grupo como leído
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
