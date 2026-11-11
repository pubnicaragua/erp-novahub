import { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useImpersonation } from '../../contexts/ImpersonationContext';
import { performanceService } from '../../services/performance.service';
import { toast } from '../../services/toast';
import { safeGetItem, safeSetItem } from '../../services/safe-storage';

/**
 * Marca la hora de entrada de cada persona apenas abre el sistema en el día. No se elige: la fija el servidor con la hora real.
 * Se intenta una vez por día y sesión; si ya había entrada registrada, el servidor no la cambia.
 */
export function AutoAttendanceEntry() {
  const { user } = useAuth();
  const { isImpersonating } = useImpersonation();
  const eligible = Boolean(user && !isImpersonating && !user.isPlatformAdmin && !user.isPlatformSupportAgent && user.userType !== 'customer_portal' && user.userType !== 'manager' && user.role !== 'manager');
  const userId = user?.id;
  const tenantId = user?.clientTenantId || user?.tenantId;

  useEffect(() => {
    if (!eligible || !userId) return;
    const key = `nh-auto-entry:${tenantId}:${userId}:${new Date().toDateString()}`;
    if (safeGetItem(key)) return;
    safeSetItem(key, '1');
    void performanceService.registerAutoEntry().then((result) => {
      if (result?.registered && result.checkIn) {
        toast.success(`Entrada registrada a las ${new Date(result.checkIn).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`);
      }
    }).catch(() => { /* Si falla, se reintenta en la próxima sesión del día. */ });
  }, [eligible, userId, tenantId]);

  return null;
}
