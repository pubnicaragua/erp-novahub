import { useState } from 'react';
import { Loader2, MessageCircle, Smartphone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { whatsappService } from '../../services/whatsapp.service';
import { WhatsAppModule } from './whatsapp/WhatsAppModule';
import { WhatsAppPlatformPlans } from './whatsapp/WhatsAppPlatformPlans';
import { ChatwootTab } from './ChatwootTab';

/**
 * Nova Suite: WhatsApp multilínea (servicio propio de NovaHub) y, aparte, los canales conectados por Chatwoot.
 * NovaHub decide por empresa si se muestra la pestaña de Chatwoot.
 */
export function NovaSuiteHub() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'whatsapp' | 'channels'>('whatsapp');
  const isPlatform = Boolean(user?.isPlatformAdmin);
  const flags = useTenantQuery(['wa', 'suite-flags'], (signal) => whatsappService.suiteFlags(signal), { staleTime: 60_000, retry: false, enabled: !isPlatform });
  // El personal de NovaHub no pertenece a una empresa: solo administra los planes y la visibilidad de cada una.
  if (isPlatform) {
    return <div className="flex h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-2xl border border-border/50 bg-card"><WhatsAppPlatformPlans /></div>;
  }
  // Mientras no se sabe, se muestra solo WhatsApp para no enseñar (y luego quitar) una pestaña que NovaHub pudo ocultar.
  const showChatwoot = flags.data ? flags.data.chatwootVisible : false;
  const active = showChatwoot ? tab : 'whatsapp';
  const tabs: Array<{ id: 'whatsapp' | 'channels'; label: string; Icon: typeof Smartphone }> = [
    { id: 'whatsapp', label: 'WhatsApp multilínea', Icon: Smartphone },
    ...(showChatwoot ? [{ id: 'channels' as const, label: 'Canales (Chatwoot)', Icon: MessageCircle }] : []),
  ];
  return (
    <div className="flex flex-col gap-3">
      {(showChatwoot || flags.isLoading) && (
        <div className="flex gap-1.5">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-colors ${active === id ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border/60 text-muted-foreground hover:bg-muted/50'}`}
            >
              <Icon className="size-4" />{label}
            </button>
          ))}
          {flags.isLoading && <Loader2 className="my-auto size-4 animate-spin text-muted-foreground" />}
        </div>
      )}
      {active === 'whatsapp' ? <WhatsAppModule /> : <ChatwootTab />}
    </div>
  );
}
