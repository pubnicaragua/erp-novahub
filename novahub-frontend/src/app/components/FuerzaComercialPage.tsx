import { MapPinned, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import mapUrl from '../../../maps/diseñoui_mapas_freelancers.html?url';

export function FuerzaComercialPage() {
  const { user, hasAccess } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';
  const isAuthorizedCollaborator = user?.userType === 'collaborator' && hasAccess('fuerza-comercial');
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  const mapSrc = `${mapUrl}${mapUrl.includes('?') ? '&' : '?'}api=${encodeURIComponent(apiBase)}`;

  if (!isSuperAdmin && !isAuthorizedCollaborator) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-3xl border border-border/60 bg-card p-8 text-center shadow-xl">
          <ShieldAlert className="mx-auto mb-4 size-10 text-destructive" />
          <h1 className="text-2xl font-black tracking-tight">Acceso restringido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Fuerza Comercial está disponible únicamente para Super Admin y colaboradores autorizados.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="relative h-full min-h-[calc(100vh-4rem)] overflow-hidden bg-[#e8f0ed]">
      <div className="pointer-events-none absolute left-4 top-4 z-10 hidden items-center gap-2 rounded-2xl border border-white/70 bg-white/90 px-3 py-2 text-xs font-bold text-[#123f35] shadow-lg backdrop-blur md:flex">
        <MapPinned className="size-4 text-[#08785a]" />
        NovaHub Force · Google Maps
      </div>
      <iframe
        title="Fuerza Comercial NovaHub"
        src={mapSrc}
        allow="geolocation"
        referrerPolicy="strict-origin-when-cross-origin"
        className="block h-full min-h-[calc(100vh-4rem)] w-full border-0"
      />
    </section>
  );
}

export default FuerzaComercialPage;
