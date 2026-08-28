import { BellRing, Check, Clock3, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import { formatDateEs } from '../../utils/dateFormat';

export interface NotificationTableRow {
  id: string;
  title?: string | null;
  content?: string | null;
  message?: string | null;
  type?: string | null;
  severity?: string | null;
  isRead?: boolean;
  createdAt?: string | null;
  sent?: boolean;
}

interface NotificationTableProps<T extends NotificationTableRow> {
  data: T[];
  loading: boolean;
  mode: 'alert' | 'push';
  onRowClick: (row: T) => void;
  onMarkRead?: (row: T) => void;
}

const severityLabel: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

const severityClass: Record<string, string> = {
  LOW: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
  MEDIUM: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  HIGH: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
  CRITICAL: 'bg-red-600/15 text-red-700 dark:text-red-300',
};

function dateLabel(value?: string | null) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : formatDateEs(value, true);
}

function rowContent(row: NotificationTableRow) {
  return String(row.content || row.message || '').trim() || 'Abre el aviso para consultar el detalle relacionado.';
}

function RowActions<T extends NotificationTableRow>({ row, onMarkRead }: Pick<NotificationTableProps<T>, 'onMarkRead'> & { row: T }) {
  return (
    <div className="flex items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
      {!row.isRead && onMarkRead && (
        <Button type="button" variant="ghost" size="icon" className="size-8 rounded-lg text-muted-foreground hover:text-primary" title="Marcar como leída" aria-label="Marcar como leída" onClick={() => onMarkRead(row)}>
          <Check className="size-4" />
        </Button>
      )}
      <ExternalLink className="ml-1 size-4 text-muted-foreground/40" aria-hidden="true" />
    </div>
  );
}

export function NotificationTable<T extends NotificationTableRow>({ data, loading, mode, onRowClick, onMarkRead }: NotificationTableProps<T>) {
  if (loading && data.length === 0) {
    return (
      <div className="space-y-3 p-4 sm:p-6" aria-label="Cargando notificaciones">
        {[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-2xl bg-muted/50" />)}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BellRing className="size-6" /></div>
        <div><p className="font-semibold text-foreground">No hay avisos para mostrar</p><p className="mt-1 text-sm text-muted-foreground">Los nuevos eventos aparecerán aquí automáticamente.</p></div>
      </div>
    );
  }

  return (
    <>
      <div className="notifications-table hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-border/60 bg-muted/20 text-left text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
            <tr>
              <th className="w-[38%] px-5 py-3">Aviso</th>
              <th className="w-[34%] px-5 py-3">Detalle</th>
              <th className="px-5 py-3">{mode === 'alert' ? 'Severidad' : 'Estado'}</th>
              <th className="px-5 py-3">Fecha</th>
              <th className="px-5 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {data.map((row) => {
              const severity = String(row.severity || '').toUpperCase();
              return (
                <tr key={row.id} tabIndex={0} className={cn('group cursor-pointer align-top transition-colors hover:bg-primary/[0.035] focus-visible:bg-primary/[0.06] focus-visible:outline-none', !row.isRead && 'bg-primary/[0.025]')} onClick={() => onRowClick(row)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onRowClick(row); } }}>
                  <td className="px-5 py-4"><div className="flex gap-3"><span className={cn('mt-1.5 size-2 shrink-0 rounded-full', row.isRead ? 'bg-muted-foreground/30' : 'bg-primary shadow-[0_0_0_4px] shadow-primary/10')} /><div className="min-w-0"><p className="truncate font-semibold text-foreground">{row.title || 'Sin título'}</p><p className="notification-table-meta mt-1 text-xs">{row.isRead ? 'Leída' : 'Pendiente de revisar'}</p></div></div></td>
                  <td className="max-w-0 px-5 py-4"><p className="notification-table-detail line-clamp-2 text-sm leading-5">{rowContent(row)}</p></td>
                  <td className="px-5 py-4">{mode === 'alert' ? <Badge className={cn('border-0 text-[10px] font-bold', severityClass[severity] || 'bg-muted text-muted-foreground')}>{severityLabel[severity] || 'Informativa'}</Badge> : <Badge className={cn('border-0 text-[10px] font-bold', row.sent ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-600 dark:text-amber-300')}>{row.sent ? 'Registrada' : 'Pendiente'}</Badge>}</td>
                  <td className="notification-table-meta whitespace-nowrap px-5 py-4 text-xs"><span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" />{dateLabel(row.createdAt)}</span></td>
                  <td className="px-5 py-3"><RowActions row={row} onMarkRead={onMarkRead} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="notifications-table space-y-3 p-3 md:hidden">
        {data.map((row) => {
          const severity = String(row.severity || '').toUpperCase();
          return (
            <div key={row.id} role="button" tabIndex={0} className={cn('rounded-2xl border border-border/60 bg-background p-4 text-left shadow-sm transition-all hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', !row.isRead && 'border-primary/25 bg-primary/[0.02]')} onClick={() => onRowClick(row)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onRowClick(row); } }}>
              <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><span className={cn('mt-1.5 size-2 shrink-0 rounded-full', row.isRead ? 'bg-muted-foreground/30' : 'bg-primary')} /><div className="min-w-0"><p className="font-semibold text-foreground">{row.title || 'Sin título'}</p><p className="notification-table-meta mt-1 text-xs">{dateLabel(row.createdAt)}</p></div></div><RowActions row={row} onMarkRead={onMarkRead} /></div>
              <p className="notification-table-detail mt-3 line-clamp-3 text-sm leading-5">{rowContent(row)}</p>
              <div className="mt-3">{mode === 'alert' ? <Badge className={cn('border-0 text-[10px] font-bold', severityClass[severity] || 'bg-muted text-muted-foreground')}>{severityLabel[severity] || 'Informativa'}</Badge> : <Badge className={cn('border-0 text-[10px] font-bold', row.sent ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-600')}>{row.sent ? 'Registrada' : 'Pendiente'}</Badge>}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
