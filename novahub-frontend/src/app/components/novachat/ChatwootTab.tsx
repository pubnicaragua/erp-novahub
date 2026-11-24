import { useQuery } from '@tanstack/react-query';
import { Loader2, MessageCircle, Plug } from 'lucide-react';
import { Button } from '../ui/button';
import { novachatService, type ChatChannel } from '../../services/novachat.service';
import { useAuth } from '../../contexts/AuthContext';
import { asList } from '../../hooks/useTenantQuery';
import { NovaChatView } from './NovaChatView';

/**
 * Canales conectados por Chatwoot (Facebook, Instagram, web…). Si la empresa ya tiene canales, se muestra la bandeja;
 * si no, pide la configuración inicial. No se siembran datos de ejemplo: solo se leen los canales reales.
 */
export function ChatwootTab() {
  const { user } = useAuth();
  const tenantKey = (user as { clientTenantId?: string; tenantId?: string } | null)?.clientTenantId || user?.tenantId || 'current';
  const channels = useQuery({
    queryKey: ['tenant-module', tenantKey, 'chatwoot', 'channels'],
    queryFn: async ({ signal }) => asList(await novachatService.getChannels(signal)) as ChatChannel[],
    retry: false, staleTime: 60_000, refetchOnWindowFocus: false,
  });

  if (channels.isLoading) return <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border/50 bg-card"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  if (channels.isError) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border/50 bg-card p-6 text-center">
        <div className="max-w-md"><MessageCircle className="mx-auto size-10 text-muted-foreground/50" /><p className="mt-3 text-sm font-black">No se pudieron cargar los canales</p><p className="mt-1 text-xs text-muted-foreground">Intenta de nuevo en un momento. Si sigue pasando, avisa a soporte.</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void channels.refetch()}>Reintentar</Button></div>
      </div>
    );
  }

  if (!channels.data?.length) {
    return (
      <div className="flex min-h-[min(520px,calc(100dvh-10rem))] items-center justify-center rounded-2xl border border-border/50 bg-card p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"><Plug className="size-7" /></div>
          <p className="mt-4 text-lg font-black">Conecta tus otras redes</p>
          <p className="mt-2 text-sm text-muted-foreground">Aquí aparecerán los mensajes de Facebook, Instagram y el chat de tu página web, junto con tus conversaciones. Todavía no hay ningún canal configurado para tu empresa.</p>
          <p className="mt-2 text-xs text-muted-foreground">La configuración inicial la hace el equipo de NovaHub contigo; toma pocos minutos.</p>
          <Button type="button" className="mt-4 bg-sky-600 hover:bg-sky-700" onClick={() => window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module: 'soporte-tecnico' } }))}>Pedir la configuración</Button>
        </div>
      </div>
    );
  }

  return <NovaChatView forceEnabled />;
}
