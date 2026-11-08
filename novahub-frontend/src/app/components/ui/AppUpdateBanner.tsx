import { useEffect, useState, useSyncExternalStore } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from './button';
import { clearClientCaches } from '../../utils/chunk-recovery';
import { getAvailableBuildId, startVersionWatcher, subscribeAvailableBuild } from '../../utils/app-version';

/**
 * Avisa cuando se publicó una versión nueva de NovaHub mientras esta pestaña seguía abierta.
 * Una pestaña con la versión anterior puede fallar al abrir pantallas que aún no había cargado (los módulos
 * viejos desaparecen con cada despliegue): actualizar a tiempo evita ese error.
 */
export function AppUpdateBanner() {
  const availableBuildId = useSyncExternalStore(subscribeAvailableBuild, getAvailableBuildId, () => null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => startVersionWatcher(), []);

  if (!availableBuildId) return null;

  const handleUpdate = async () => {
    setUpdating(true);
    // Se conserva el service worker (su suscripción push); solo se descarta lo que pudiera servir el documento viejo.
    await clearClientCaches({ unregisterWorkers: false });
    window.location.reload();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-20 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-primary/20 bg-background/95 p-3 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:bottom-3 sm:left-4 sm:mx-0"
    >
      <RefreshCw className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm">
        Hay una versión nueva de NovaHub. Actualiza para evitar errores al abrir pantallas.
      </p>
      <Button size="sm" onClick={() => void handleUpdate()} disabled={updating}>
        {updating ? 'Actualizando…' : 'Actualizar'}
      </Button>
    </div>
  );
}
