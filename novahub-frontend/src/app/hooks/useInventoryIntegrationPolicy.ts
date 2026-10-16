import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { inventoryService } from '../services/inventario.service';

export function useInventoryIntegrationPolicy() {
  const { user } = useAuth();
  const tenantKey = user?.clientTenantId || user?.tenantId;
  return useQuery({
    queryKey: ['inventory-integration-policy', tenantKey],
    queryFn: inventoryService.getIntegrationPolicy,
    enabled: Boolean(tenantKey),
    staleTime: 0,
    refetchOnMount: 'always',
  });
}
