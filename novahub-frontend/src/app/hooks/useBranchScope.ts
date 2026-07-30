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
  }, [allBranches, isRestricted, user?.branchIds]);

  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  useEffect(() => {
    if (!selectedBranchId && accessibleBranches.length > 0 && isRestricted) {
      setSelectedBranchId(accessibleBranches[0].id);
    }
  }, [accessibleBranches, selectedBranchId, isRestricted]);

  const selectedBranch = useMemo(() => {
    if (!selectedBranchId) return null;
    return allBranches.find(b => b.id === selectedBranchId) || null;
  }, [allBranches, selectedBranchId]);

  const filterByBranch = useCallback(<T extends { branchId?: string | null }>(items: T[]): T[] => {
    if (!selectedBranchId) return items;
    return items.filter(item => item.branchId === selectedBranchId);
  }, [selectedBranchId]);

  const hasBranchAccess = useCallback((branchId: string): boolean => {
    if (!isRestricted) return true;
    return user!.branchIds!.includes(branchId);
  }, [isRestricted, user?.branchIds]);

  return {
    allBranches,
    accessibleBranches,
    selectedBranch,
    selectedBranchId,
    setSelectedBranchId,
    filterByBranch,
    hasBranchAccess,
    isRestricted,
  };
}
