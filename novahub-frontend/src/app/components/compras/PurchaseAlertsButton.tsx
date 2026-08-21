import { useCallback, useEffect, useState } from 'react';
import { BellRing, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { notificationsService } from '../../services/notifications.service';
import { safeSetItem } from '../../services/safe-storage';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

export interface PurchaseAlertDetail {
  label: string;
  singularLabel: string;
  count: number;
  items: PurchaseAlertItem[];
}

export interface PurchaseAlertItem {
  id: string;
  label: string;
  detail?: string;
}

interface PurchaseAlertsButtonProps {
  alert: PurchaseAlertDetail;
  onItemSelect?: (id: string) => void;
  sectionLabel?: string;
  storageNamespace?: string;
}

const readStoredAlertIds = (storageKey: string) => {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return new Set<string>(Array.isArray(stored) ? stored.map(String) : []);
  } catch {
    return new Set<string>();
  }
};

export function PurchaseAlertsButton({
  alert,
  onItemSelect,
  sectionLabel = 'compras',
  storageNamespace = 'erp-purchase-alerts',
}: PurchaseAlertsButtonProps) {
  const { user } = useAuth();
  const storageKey = `${storageNamespace}:${user?.tenantId || 'current'}:${user?.id || 'current'}:${encodeURIComponent(alert.label)}`;
  const viewNamespace = `${storageNamespace}:${alert.label}`;
  const [readAlertIds, setReadAlertIds] = useState<Set<string>>(() => readStoredAlertIds(storageKey));
  const unreadItems = alert.items.filter((item) => !readAlertIds.has(item.id));
  const unreadCount = unreadItems.length;

  const markItemsAsRead = useCallback((ids: string[]) => {
    const normalizedIds = [...new Set(ids.map(String).map((id) => id.trim()).filter(Boolean))];
    if (normalizedIds.length === 0) return;

    setReadAlertIds((previous) => new Set([...previous, ...normalizedIds]));
    if (user?.id) {
      void notificationsService.markViewAlertsRead(viewNamespace, normalizedIds).catch(() => {
        // localStorage mantiene la experiencia si el servidor está temporalmente fuera de línea.
      });
    }
  }, [user?.id, viewNamespace]);

  // La lectura se conserva aunque el registro deje de estar pendiente y luego
  // vuelva a aparecer en la consulta. Así no se presenta otra vez como nuevo.
  useEffect(() => {
    let cancelled = false;
    const storedIds = readStoredAlertIds(storageKey);
    setReadAlertIds(storedIds);

    if (!user?.id) return () => { cancelled = true; };

    void notificationsService.getViewAlertReadIds(viewNamespace)
      .then((serverIds) => {
        if (cancelled) return;
        const serverSet = new Set(serverIds);
        const localOnlyIds = [...storedIds].filter((id) => !serverSet.has(id));
        // Une el resultado del servidor con el estado actual para no revertir
        // una lectura que el usuario haya hecho mientras esta consulta cargaba.
        setReadAlertIds((previous) => new Set([...previous, ...serverIds]));
        if (localOnlyIds.length > 0) {
          void notificationsService.markViewAlertsRead(viewNamespace, localOnlyIds).catch(() => undefined);
        }
      })
      .catch(() => undefined);

    return () => { cancelled = true; };
  }, [storageKey, user?.id, viewNamespace]);

  useEffect(() => {
    try {
      safeSetItem(storageKey, JSON.stringify(Array.from(readAlertIds)));
    } catch {
      // La lectura local es opcional; el contador sigue funcionando en memoria.
    }
  }, [readAlertIds, storageKey]);

  const markCurrentAlertsAsRead = () => {
    markItemsAsRead(alert.items.map((item) => item.id));
  };

  const handleItemSelect = (id: string) => {
    markItemsAsRead([id]);
    onItemSelect?.(id);
  };

  const message = alert.items.length > 0
    ? unreadCount > 0
      ? `Hay ${unreadCount} ${unreadCount === 1 ? alert.singularLabel : alert.label.toLowerCase()} sin leer`
      : 'Todas las novedades fueron revisadas'
    : `No hay ${alert.label.toLowerCase()}`;

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) markCurrentAlertsAsRead(); }}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          data-toolbar-role="alerts"
          className="relative size-10 shrink-0 rounded-xl border-border/60 text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
          aria-label={unreadCount > 0 ? `${alert.label}, ${unreadCount} sin leer` : alert.label}
          title={alert.label}
        >
          <BellRing className="size-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-xl border-border/60 p-2">
        <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Novedades de {sectionLabel}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="space-y-1">
          <div className="flex items-start gap-3 rounded-lg p-3">
            <BellRing className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-wide">{message}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Selecciona un registro para resaltarlo en la tabla o tarjeta.
              </p>
            </div>
          </div>
          {alert.items.length > 0 && (
            <div className="max-h-64 space-y-1 overflow-y-auto px-1 pb-1">
              {alert.items.map((item) => (
                  <DropdownMenuItem
                    key={item.id}
                    className="items-start gap-2 rounded-lg px-3 py-2"
                    onSelect={() => handleItemSelect(item.id)}
                  >
                  {readAlertIds.has(item.id) ? (
                    <Check className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold text-foreground">{item.label}</span>
                    {item.detail && <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{item.detail}</span>}
                  </span>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
