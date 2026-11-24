import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MessageSquare, Search } from 'lucide-react';
import { Button } from '../../ui/button';
import { whatsappService, type WaConversation, type WaOverview, type WaScope } from '../../../services/whatsapp.service';
import { WhatsAppChat, useWaTenantKey } from './WhatsAppChat';
import { LineChip, formatListTime, useWhatsAppEvents } from './whatsappUi';
import { WaAvatar } from './WaAvatar';
import { LineMultiSelect } from './LineMultiSelect';

const SCOPES: Array<{ id: WaScope; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'unread', label: 'No leídos' },
  { id: 'unassigned', label: 'Sin asignar' },
  { id: 'mine', label: 'Míos' },
  { id: 'resolved', label: 'Resueltos' },
];

function ConversationRow({ item, active, onSelect, showLine }: { item: WaConversation; active: boolean; onSelect: () => void; showLine: boolean }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-start gap-3 border-b border-border/20 px-3 py-3 text-left transition-colors hover:bg-muted/40 ${active ? 'bg-primary/[0.06] shadow-[inset_3px_0_0_hsl(var(--primary))]' : ''}`}
    >
      <WaAvatar conversationId={item.id} name={item.contact.name} isGroup={item.contact.isGroup} color={item.line.color} className="size-11 text-sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`truncate text-[13px] ${item.unreadCount ? 'font-black' : 'font-bold'}`}>{item.contact.name}</span>
          <span className={`shrink-0 text-[10px] ${item.unreadCount ? 'font-black text-emerald-600' : 'text-muted-foreground'}`}>{formatListTime(item.lastMessageAt)}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <p className={`flex-1 truncate text-xs ${item.unreadCount ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>{item.lastMessagePreview || 'Sin mensajes'}</p>
          {item.unreadCount > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-black text-white">{item.unreadCount > 99 ? '99+' : item.unreadCount}</span>}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {showLine && <LineChip name={item.line.name} color={item.line.color} />}
          {item.assigneeName
            ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{item.assigneeName}</span>
            : item.status !== 'RESOLVED' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">Sin asignar</span>}
          {item.needsReply && !item.unreadCount && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">Sin responder</span>}
        </div>
      </div>
    </button>
  );
}

export function WhatsAppInbox({ overview }: { overview: WaOverview }) {
  const qc = useQueryClient();
  const key = useWaTenantKey();
  const events = useWhatsAppEvents();
  const [lineIds, setLineIds] = useState<string[]>([]);
  const [scope, setScope] = useState<WaScope>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const q = useDeferredValue(search.trim());
  // Solo cuentan los números que siguen existiendo; vacío = todos.
  const validLineIds = lineIds.filter((id) => overview.lines.some((l) => l.id === id));
  const lineKey = [...validLineIds].sort().join(',');
  const refreshTimer = useRef<number | null>(null);
  const lastOverview = useRef(0);

  const list = useInfiniteQuery({
    queryKey: key('conversations', lineKey, scope, q),
    queryFn: ({ pageParam, signal }) => whatsappService.conversations({ lineIds: lineKey || undefined, scope, q: q || undefined, cursor: pageParam || undefined, limit: 30 }, signal),
    initialPageParam: '' as string,
    getNextPageParam: (last) => last.nextCursor || undefined,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    // Solo se mantienen las últimas páginas: cada recarga por mensaje nuevo pide pocas páginas, no todo lo que se ha desplazado.
    maxPages: 4,
  });
  const items = list.data?.pages.flatMap((p) => p.items) || [];

  // Un mensaje nuevo refresca la lista, agrupando ráfagas para no saturar al servidor.
  useEffect(() => events.subscribe((event) => {
    if (event.type === 'status') return;
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => {
      void qc.invalidateQueries({ queryKey: key('conversations') });
      // Los contadores por número no necesitan recalcularse con cada mensaje: como máximo cada 5 segundos.
      if (Date.now() - lastOverview.current > 5000) { lastOverview.current = Date.now(); void qc.invalidateQueries({ queryKey: key('overview') }); }
    }, 400);
  }), [events, qc, key]);
  useEffect(() => () => { if (refreshTimer.current) window.clearTimeout(refreshTimer.current); }, []);

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: key('conversations') });
    void qc.invalidateQueries({ queryKey: key('overview') });
  }, [qc, key]);

  const connected = overview.lines.filter((l) => l.status === 'CONNECTED').length;

  if (!overview.lines.length) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <div className="max-w-sm">
          <MessageSquare className="mx-auto size-12 text-emerald-500/50" />
          <p className="mt-3 text-base font-black">Aún no hay números conectados</p>
          <p className="mt-1 text-sm text-muted-foreground">{overview.isAdmin ? 'Ve a "Mis números" y conecta tu primer WhatsApp para empezar a recibir conversaciones aquí.' : 'Pide al administrador que te asigne un número de WhatsApp.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <div className={`flex w-full shrink-0 flex-col border-r border-border/40 bg-card md:w-[22rem] ${selectedId ? 'hidden md:flex' : 'flex'}`}>
        <div className="space-y-2.5 border-b border-border/40 p-3">
          <LineMultiSelect lines={overview.lines.map((l) => ({ id: l.id, name: l.name, color: l.color, unread: l.unread, disconnected: l.status !== 'CONNECTED' }))} value={validLineIds} onChange={setLineIds} allLabel={`Todos los números (${connected}/${overview.lines.length})`} />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nombre, número o mensaje"
              aria-label="Buscar conversaciones"
              className="h-9 w-full rounded-xl border border-border/60 bg-background pl-8 pr-3 text-xs outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SCOPES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setScope(s.id)}
                className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold transition-colors ${scope === s.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 text-muted-foreground hover:bg-muted/50'}`}
              >{s.label}</button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {list.isLoading && <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-primary" /></div>}
          {list.isError && <p className="p-6 text-center text-xs text-rose-600">No se pudieron cargar las conversaciones.</p>}
          {!list.isLoading && !list.isError && items.length === 0 && (
            <p className="p-8 text-center text-xs text-muted-foreground">{q ? 'Nada coincide con tu búsqueda.' : 'No hay conversaciones en esta vista.'}</p>
          )}
          {items.map((item) => (
            <ConversationRow key={item.id} item={item} active={item.id === selectedId} showLine={(validLineIds.length === 0 || validLineIds.length > 1) && overview.lines.length > 1} onSelect={() => setSelectedId(item.id)} />
          ))}
          {list.hasNextPage && (
            <div className="p-3 text-center">
              <Button type="button" variant="outline" size="sm" className="h-8 rounded-full text-xs" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
                {list.isFetchingNextPage ? <Loader2 className="size-3.5 animate-spin" /> : 'Cargar más'}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className={`min-w-0 flex-1 flex-col ${selectedId ? 'flex' : 'hidden md:flex'}`}>
        {selectedId ? (
          <WhatsAppChat key={selectedId} conversationId={selectedId} overview={overview} onBack={() => setSelectedId(null)} onChanged={refresh} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <div className="text-center"><MessageSquare className="mx-auto size-12 opacity-20" /><p className="mt-3 text-sm font-bold">Elige una conversación</p><p className="text-xs">para ver y responder los mensajes</p></div>
          </div>
        )}
      </div>
    </div>
  );
}
