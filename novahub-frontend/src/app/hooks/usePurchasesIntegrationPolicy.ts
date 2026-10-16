import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { paymentsMadeService } from '../services/compras.service';

export function usePurchasesIntegrationPolicy() {
  const { user } = useAuth();
  const tenantKey = user?.clientTenantId || user?.tenantId;
  return useQuery({
    queryKey: ['purchases-integration-policy', tenantKey],
    queryFn: paymentsMadeService.getIntegrationPolicy,
    enabled: Boolean(tenantKey),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
