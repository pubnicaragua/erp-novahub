import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { paymentsService } from '../services/ventas.service';

export function useSalesIntegrationPolicy() {
  const { user } = useAuth();
  const tenantKey = user?.clientTenantId || user?.tenantId;
  return useQuery({
    queryKey: ['sales-integration-policy', tenantKey],
    queryFn: paymentsService.getIntegrationPolicy,
    enabled: Boolean(tenantKey),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
