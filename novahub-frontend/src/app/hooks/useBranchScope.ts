import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export function useBranchScope() {
  const { user } = useAuth();
  const isAdmin = user?.isTenantAdmin || user?.isPlatformAdmin || false;
  const [allBranches, setAllBranches] = useState<any[]>([]);

  useEffect(() => {
    api.get<any[]>('/sucursales').then(res => {
      const list = Array.isArray(res) ? res : (res as any)?.data || [];
      setAllBranches(list);
    }).catch(() => {});
  }, []);

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

  const branchWarehouseIds = useMemo(() => {
    if (!selectedBranch) return [] as string[];
    return [...new Set<string>([
      selectedBranch.warehouseId,
      ...((selectedBranch.warehouses || []) as any[]).map((w: any) => w.id),
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
    hasBranchAccess,
    isRestricted,
  };
}
