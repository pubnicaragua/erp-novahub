import { useState } from 'react';
import { MessageCircle, Smartphone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { WhatsAppModule } from './whatsapp/WhatsAppModule';
import { WhatsAppPlatformPlans } from './whatsapp/WhatsAppPlatformPlans';
import { NovaChatView } from './NovaChatView';

/**
 * Nova Suite: WhatsApp multilínea (servicio propio de NovaHub) y, aparte, los canales conectados por Chatwoot.
 * Chatwoot sigue funcionando igual; solo cambia que ya no es la única vía para manejar WhatsApp.
 */
export function NovaSuiteHub() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'whatsapp' | 'channels'>('whatsapp');
  // El personal de NovaHub no pertenece a una empresa: solo administra los planes de WhatsApp de cada una.
  if (user?.isPlatformAdmin) {
    return <div className="flex h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-2xl border border-border/50 bg-card"><WhatsAppPlatformPlans /></div>;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        {([['whatsapp', 'WhatsApp multilínea', Smartphone], ['channels', 'Canales (Chatwoot)', MessageCircle]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-colors ${tab === id ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border/60 text-muted-foreground hover:bg-muted/50'}`}
          >
            <Icon className="size-4" />{label}
          </button>
        ))}
      </div>
      {tab === 'whatsapp' ? <WhatsAppModule /> : <NovaChatView />}
    </div>
  );
}
