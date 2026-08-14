import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export function useBranchScope() {
  const { user } = useAuth();
  const isAdmin = user?.isTenantAdmin || user?.isPlatformAdmin || false;
  const [allBranches, setAllBranches] = useState<any[]>([]);

  const fetchBranches = useCallback(async () => {
    try {
      const res = await api.get<any[]>('/sucursales');
      const list = Array.isArray(res) ? res : (res as any)?.data || [];
      setAllBranches(list);
    } catch {
      // Mantiene la última lista cargada si el refresco falla.
    }
  }, []);

  useEffect(() => {
    void fetchBranches();
    const handleBranchesChanged = () => void fetchBranches();
    window.addEventListener('sucursales-changed', handleBranchesChanged);
    return () => window.removeEventListener('sucursales-changed', handleBranchesChanged);
  }, [fetchBranches]);

  const isRestricted = !isAdmin && !!user?.branchIds?.length;
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

  const filterByBranch = useCallback(<T extends { branchId?: string | null; warehouseId?: string | null }>(items: T[]): T[] => {
    if (!selectedBranchId) return items;
    return items.filter((item) => {
      if (!item.branchId && !item.warehouseId) return true;
      if (item.branchId) return item.branchId === selectedBranchId;
      return branchWarehouseIds.includes(item.warehouseId as string);
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
    refreshBranches: fetchBranches,
    hasBranchAccess,
    isRestricted,
  };
}
