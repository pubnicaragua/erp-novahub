import React, { useState } from 'react';
import { BellRing, Check, CheckCheck, Trash2, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from './ui/utils';

import { useNotifications } from '../hooks/useNotifications';
import type { Notification } from '../types';

const tipoConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  'warning': { icon: <AlertTriangle className="size-5" />, color: 'text-yellow-400 bg-yellow-500/10' },
  'info': { icon: <Info className="size-5" />, color: 'text-blue-400 bg-blue-500/10' },
  'success': { icon: <CheckCircle className="size-5" />, color: 'text-green-400 bg-green-500/10' },
  'error': { icon: <AlertTriangle className="size-5" />, color: 'text-red-400 bg-red-500/10' },
};

export function NotificacionesPage() {
  const { notifications, unreadCount, markAllAsRead, markAsRead, clearAll } = useNotifications();
  const [filtro, setFiltro] = useState<string>('todas');

  const filtered: Notification[] = filtro === 'todas'
    ? notifications
    : filtro === 'no-leidas'
      ? notifications.filter((n: Notification) => !n.read)
      : notifications.filter((n: Notification) => n.type.toLowerCase() === filtro.toLowerCase());

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BellRing className="size-6 text-primary" />
            Notificaciones
            {unreadCount > 0 && <Badge variant="destructive" className="ml-2">{unreadCount} nuevas</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground">Centro de notificaciones del sistema</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAllAsRead}><CheckCheck className="mr-2 size-4" />Marcar todas como leídas</Button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {['todas', 'no-leidas', 'info', 'success', 'warning', 'error'].map(f => (
          <Button key={f} variant={filtro === f ? 'default' : 'outline'} size="sm" onClick={() => setFiltro(f)} className="capitalize">
            {f === 'no-leidas' ? 'No leídas' : f}
          </Button>
        ))}
        {notifications.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="ml-auto text-red-500 hover:text-red-600 hover:bg-red-500/10">
            <Trash2 className="size-4 mr-1" /> Limpiar Todo
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground"><BellRing className="mx-auto size-12 opacity-30 mb-3" /><p>No hay notificaciones</p></CardContent></Card>
        ) : (
          filtered.map((n: Notification) => {
            const config = tipoConfig[n.type] || tipoConfig['info'];
            const dateObj = new Date(n.timestamp);
            return (
              <Card key={n.id} className={cn('transition-all hover:shadow-md cursor-pointer', !n.read && 'border-primary/30 bg-primary/5')} onClick={() => markAsRead(n.id)}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={cn('flex size-10 items-center justify-center rounded-lg shrink-0', config.color)}>{config.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className={cn('text-sm', !n.read ? 'font-semibold' : 'font-medium')}>{n.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                        </div>
                        {!n.read && <div className="size-2.5 rounded-full bg-primary shrink-0 mt-1.5" />}
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <Badge variant="secondary" className="text-[10px] capitalize">{n.type}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {dateObj.toLocaleDateString()} - {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
