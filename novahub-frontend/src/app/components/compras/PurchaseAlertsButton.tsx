import { BellRing } from 'lucide-react';
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
}

export function PurchaseAlertsButton({ alert, onItemSelect }: PurchaseAlertsButtonProps) {
  const message = alert.count > 0
    ? `Hay ${alert.count} ${alert.count === 1 ? alert.singularLabel : alert.label.toLowerCase()}`
    : `No hay ${alert.label.toLowerCase()}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative size-10 shrink-0 rounded-xl border-border/60 text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
          aria-label={alert.label}
          title={alert.label}
        >
          <BellRing className="size-4" />
          {alert.count > 0 && (
            <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
              {alert.count > 99 ? '99+' : alert.count}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-xl border-border/60 p-2">
        <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Novedades de compras
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
                  onSelect={() => onItemSelect?.(item.id)}
                >
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
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
