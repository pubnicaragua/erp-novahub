import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const BRANCH_CACHE_TTL = 30_000;
let branchCache: { key: string; data: any[]; fetchedAt: number } | null = null;
let branchRequest: { key: string; promise: Promise<any[]> } | null = null;

export function useBranchScope() {
  const { user } = useAuth();
  const isAdmin = user?.isTenantAdmin || user?.isPlatformAdmin || false;
  const [allBranches, setAllBranches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBranches = useCallback(async (force = false) => {
    const cacheKey = String(user?.id || user?.tenantId || 'anonymous');
    if (!force && branchCache?.key === cacheKey && Date.now() - branchCache.fetchedAt < BRANCH_CACHE_TTL) {
      setAllBranches(branchCache.data);
      setIsLoading(false);
      return branchCache.data;
    }

    if (force && branchCache?.key === cacheKey) branchCache = null;
    setIsLoading(true);
    try {
      if (!branchRequest || branchRequest.key !== cacheKey) {
        branchRequest = {
          key: cacheKey,
          promise: api.get<any[]>('/sucursales').then((res) => {
            const list = Array.isArray(res) ? res : (res as any)?.data || [];
            const normalized = Array.isArray(list) ? list : [];
            branchCache = { key: cacheKey, data: normalized, fetchedAt: Date.now() };
            return normalized;
          }),
        };
      }
      const list = await branchRequest.promise;
      setAllBranches(list);
      return list;
    } catch {
      // Mantiene la última lista cargada si el refresco falla.
      return [];
    } finally {
      if (branchRequest?.key === cacheKey) branchRequest = null;
      setIsLoading(false);
    }
  }, [user?.id, user?.tenantId]);

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => void fetchBranches(), 0);
    const handleBranchesChanged = () => void fetchBranches(true);
    window.addEventListener('sucursales-changed', handleBranchesChanged);
    return () => {
      window.clearTimeout(initialLoadTimer);
      window.removeEventListener('sucursales-changed', handleBranchesChanged);
    };
  }, [fetchBranches]);

  // Un usuario con branchIds explícitos solo puede seleccionar esas sucursales.
  // La UI no sustituye la autorización del backend, pero tampoco debe mostrar
  // sucursales fuera de su alcance por una comparación contra clientTenantId.
  const isRestricted = !isAdmin && Boolean(user?.branchIds?.length);
  const accessibleBranches = useMemo(() => {
    if (!isRestricted) return allBranches;
    return allBranches.filter(b => user!.branchIds!.includes(b.id));
  }, [allBranches, isRestricted, user]);

  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  const [prevAccessibleBranches, setPrevAccessibleBranches] = useState(accessibleBranches);
  if (prevAccessibleBranches !== accessibleBranches) {
    setPrevAccessibleBranches(accessibleBranches);
    if (!selectedBranchId && accessibleBranches.length > 0 && isRestricted) {
      setSelectedBranchId(accessibleBranches[0].id);
    }
  }

  const selectedBranch = useMemo(() => {
    if (!selectedBranchId) return null;
    return allBranches.find(b => b.id === selectedBranchId) || null;
  }, [allBranches, selectedBranchId]);

  // Solo los almacenes ACTIVOS vinculados a la sucursal cuentan para el
  // alcance: si un almacén fue desactivado, sus existencias dejan de sumarse
  // y de aparecer en los filtros del módulo.
  const branchWarehouseIds = useMemo(() => {
    if (!selectedBranch) return [] as string[];
    const links = ((selectedBranch.warehouses || []) as any[])
      .filter((w: any) => w.isActive !== false)
      .map((w: any) => w.id);
    return [...new Set<string>([
      ...((selectedBranch.warehouses || []) as any[]).length === 0 && selectedBranch.warehouseId ? [selectedBranch.warehouseId] : [],
      ...links,
    ].filter(Boolean))];
  }, [selectedBranch]);

  const filterByBranch = useCallback(<T>(items: T[]): T[] => {
    if (!selectedBranchId) return items;
    return items.filter((item) => {
      const scoped = item as T & { branchId?: string | null; warehouseId?: string | null };
      if (!scoped.branchId && !scoped.warehouseId) return true;
      if (scoped.branchId) return scoped.branchId === selectedBranchId;
      return branchWarehouseIds.includes(scoped.warehouseId as string);
    });
  }, [selectedBranchId, branchWarehouseIds]);

  const hasBranchAccess = useCallback((branchId: string): boolean => {
    if (!isRestricted) return true;
    return user!.branchIds!.includes(branchId);
  }, [isRestricted, user]);

  return {
    allBranches,
    accessibleBranches,
    selectedBranch,
    selectedBranchId,
    setSelectedBranchId,
    filterByBranch,
    branchWarehouseIds,
    isLoading,
    refreshBranches: useCallback(() => fetchBranches(true), [fetchBranches]),
    hasBranchAccess,
    isRestricted,
  };
}
