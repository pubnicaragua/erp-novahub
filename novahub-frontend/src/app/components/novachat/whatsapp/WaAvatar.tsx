import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { whatsappService } from '../../../services/whatsapp.service';
import { FALLBACK_LINE_COLOR, initials } from './whatsappUi';

// WhatsApp limita las consultas de fotos de perfil: se piden pocas a la vez y solo las que se ven en pantalla.
let active = 0;
const waiting: Array<() => void> = [];
async function withSlot<T>(job: () => Promise<T>): Promise<T> {
  if (active >= 3) await new Promise<void>((resolve) => waiting.push(resolve));
  active += 1;
  try { return await job(); } finally { active -= 1; waiting.shift()?.(); }
}

interface Props { conversationId: string; name: string; isGroup?: boolean; color?: string | null; className?: string }

/** Foto de perfil del contacto o grupo; si no tiene (o no carga) muestra sus iniciales o el icono de grupo. */
export function WaAvatar({ conversationId, name, isGroup, color, className = 'size-10 text-sm' }: Props) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (!el || visible) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      const timer = window.setTimeout(() => setVisible(true), 0);
      return () => window.clearTimeout(timer);
    }
    const observer = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) setVisible(true); });
    observer.observe(el);
    return () => observer.disconnect();
  }, [el, visible]);

  const photo = useQuery({
    queryKey: ['wa-photo', conversationId],
    queryFn: ({ signal }) => withSlot(() => whatsappService.photo(conversationId, signal)),
    enabled: visible,
    staleTime: 6 * 60 * 60_000,
    gcTime: 12 * 60 * 60_000,
    retry: false,
  });
  const url = photo.data?.url && !broken ? photo.data.url : null;

  return (
    <div ref={setEl} className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-black text-white ${className}`} style={{ backgroundColor: color || FALLBACK_LINE_COLOR }}>
      {url
        ? <img src={url} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBroken(true)} className="size-full object-cover" />
        : isGroup ? <Users className="size-[45%]" /> : initials(name)}
    </div>
  );
}
