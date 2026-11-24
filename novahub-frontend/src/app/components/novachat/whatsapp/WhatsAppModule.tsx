import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BarChart3, FileBarChart, Inbox, Loader2, Smartphone, WifiOff } from 'lucide-react';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { subscribeToWhatsAppEvents, whatsappService, type WaRealtimeEvent } from '../../../services/whatsapp.service';
import { WhatsAppInbox } from './WhatsAppInbox';
import { WhatsAppLines } from './WhatsAppLines';
import { WhatsAppTeam } from './WhatsAppTeam';
import { WhatsAppReports } from './WhatsAppReports';
import { useWaTenantKey } from './WhatsAppChat';
import { WhatsAppEventsContext } from './whatsappUi';

type Tab = 'inbox' | 'lines' | 'team' | 'reports';

export function WhatsAppModule() {
  const qc = useQueryClient();
  const key = useWaTenantKey();
  const [tab, setTab] = useState<Tab>('inbox');
  const [online, setOnline] = useState(true);
  const listeners = useRef(new Set<(event: WaRealtimeEvent) => void>());

  const overview = useTenantQuery(['wa', 'overview'], (signal) => whatsappService.overview(signal), { staleTime: 20_000, retry: false });

  const subscribe = useCallback((listener: (event: WaRealtimeEvent) => void) => {
    listeners.current.add(listener);
    return () => { listeners.current.delete(listener); };
  }, []);

  const planInactive = overview.isError && Number((overview.error as any)?.status) === 403;
  const enabled = overview.isSuccess;

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeToWhatsAppEvents((event) => {
      if (event.type === 'resync') {
        // Tras reconectar se vuelve a leer todo lo que pudo perderse.
        void qc.invalidateQueries({ queryKey: key() });
      } else if (event.type === 'line') {
        void qc.invalidateQueries({ queryKey: key('overview') });
      }
      listeners.current.forEach((fn) => fn(event));
    }, setOnline);
  }, [enabled, qc, key]);

  const api = useMemo(() => ({ subscribe, online }), [subscribe, online]);
  const data = overview.data;
  const totalUnread = data?.lines.reduce((s, l) => s + l.unread, 0) || 0;

  if (overview.isLoading) return <div className="flex flex-1 items-center justify-center py-20"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  if (planInactive) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <div className="max-w-md">
          <Smartphone className="mx-auto size-12 text-emerald-500/60" />
          <p className="mt-3 text-lg font-black">WhatsApp multilínea</p>
          <p className="mt-2 text-sm text-muted-foreground">Conecta los números de WhatsApp de tu empresa, mira las conversaciones de tus vendedores y responde desde un solo lugar. Este servicio aún no está activo para tu empresa; solicita su activación a NovaHub.</p>
        </div>
      </div>
    );
  }
  if (overview.isError || !data) return <p className="p-8 text-center text-sm text-rose-600">No se pudo cargar WhatsApp. Intenta de nuevo en un momento.</p>;

  const tabs: Array<{ id: Tab; label: string; icon: typeof Inbox; badge?: number; admin?: boolean }> = [
    { id: 'inbox', label: 'Bandeja', icon: Inbox, badge: totalUnread },
    { id: 'lines', label: 'Mis números', icon: Smartphone },
    { id: 'team', label: 'Equipo', icon: BarChart3, admin: true },
    { id: 'reports', label: 'Reportes', icon: FileBarChart, admin: true },
  ];
  const down = data.lines.filter((l) => l.provider === 'QR' && (l.status === 'DISCONNECTED' || l.status === 'ERROR') && l.disconnectedAt);

  return (
    <WhatsAppEventsContext.Provider value={api}>
      <div className="flex min-h-[min(760px,calc(100dvh-8rem))] h-[calc(100dvh-8rem)] max-h-[calc(100dvh-5rem)] flex-1 flex-col overflow-hidden rounded-2xl border border-border/50 bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-3 py-2">
          <div className="flex gap-1">
            {tabs.filter((t) => !t.admin || data.isAdmin).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/60'}`}
              >
                <t.icon className="size-4" />{t.label}
                {t.badge ? <span className={`rounded-full px-1.5 text-[10px] font-black ${tab === t.id ? 'bg-primary-foreground/20' : 'bg-emerald-500 text-white'}`}>{t.badge > 99 ? '99+' : t.badge}</span> : null}
              </button>
            ))}
          </div>
          {!online && <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-900"><WifiOff className="size-3.5" />Reconectando…</span>}
        </div>
        {down.length > 0 && (
          <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-rose-300/50 bg-rose-50 px-4 py-2.5 text-xs text-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
            <AlertTriangle className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 font-bold">
              {down.length === 1 ? `El número «${down[0].name}» está desconectado.` : `${down.length} números están desconectados: ${down.map((l) => l.name).join(', ')}.`}{' '}
              <span className="font-normal">{data.isAdmin ? 'No se reciben ni se envían mensajes hasta que lo vuelvas a vincular.' : 'Avisa al administrador para que lo vuelva a vincular.'}</span>
            </span>
            {data.isAdmin && <button type="button" onClick={() => setTab('lines')} className="shrink-0 rounded-lg bg-rose-600 px-3 py-1.5 font-bold text-white hover:bg-rose-700">Volver a vincular</button>}
          </div>
        )}
        <div className="flex min-h-0 flex-1">
          {tab === 'inbox' && <WhatsAppInbox overview={data} />}
          {tab === 'lines' && <WhatsAppLines overview={data} />}
          {tab === 'team' && data.isAdmin && <WhatsAppTeam />}
          {tab === 'reports' && data.isAdmin && <WhatsAppReports overview={data} />}
        </div>
      </div>
    </WhatsAppEventsContext.Provider>
  );
}
