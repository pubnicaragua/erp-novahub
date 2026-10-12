import type { SupportScope } from '../../services/support-conversations.service';

export interface SupportScopeTreeBranch {
  id: string;
  name: string;
  businessUnitId?: string | null;
}

export interface SupportScopeTreeBusinessUnit {
  id: string;
  name: string;
}

export interface SupportScopeTreeGroup {
  id: string;
  name: string;
  businessUnits: SupportScopeTreeBusinessUnit[];
  branches: SupportScopeTreeBranch[];
}

interface ScopeTreeFilterOptions {
  scopes?: SupportScope[];
  onlySelected?: boolean;
}

const scopeKey = ({ type, id }: SupportScope) => `${type}:${id}`;
const hasScope = (scopes: SupportScope[], scope: SupportScope) => scopes.some((item) => scopeKey(item) === scopeKey(scope));
const normalize = (value: string) => value.trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function branchBelongsToUnit(branch: SupportScopeTreeBranch, unitId: string) {
  return branch.businessUnitId === unitId;
}

function branchBelongsDirectlyToGroup(branch: SupportScopeTreeBranch, group: SupportScopeTreeGroup) {
  return !branch.businessUnitId || !group.businessUnits.some((unit) => unit.id === branch.businessUnitId);
}

function getGroupForScope(groups: SupportScopeTreeGroup[], scope: SupportScope): SupportScopeTreeGroup | undefined {
  if (scope.type === 'GROUP') return groups.find((group) => group.id === scope.id);
  if (scope.type === 'BUSINESS_UNIT') return groups.find((group) => group.businessUnits.some((unit) => unit.id === scope.id));
  return groups.find((group) => group.branches.some((branch) => branch.id === scope.id));
}

function isScopeDescendantOf(candidate: SupportScope, ancestor: SupportScope, groups: SupportScopeTreeGroup[]) {
  if (ancestor.type === 'GROUP') {
    const group = getGroupForScope(groups, candidate);
    return group?.id === ancestor.id && scopeKey(candidate) !== scopeKey(ancestor);
  }
  if (ancestor.type === 'BUSINESS_UNIT' && candidate.type === 'BRANCH') {
    const group = getGroupForScope(groups, candidate);
    return group?.branches.some((branch) => branch.id === candidate.id && branch.businessUnitId === ancestor.id) ?? false;
  }
  return false;
}

function removeCoveredDescendants(scopes: SupportScope[], groups: SupportScopeTreeGroup[]) {
  return scopes.filter((scope) => !scopes.some((ancestor) => scopeKey(scope) !== scopeKey(ancestor) && isScopeDescendantOf(scope, ancestor, groups)));
}

/** Canonicalizes overlapping and complete child selections against the entire, unfiltered tree. */
export function normalizeSupportScopes(scopes: SupportScope[], groups: SupportScopeTreeGroup[]): SupportScope[] {
  let normalized = removeCoveredDescendants(
    scopes.filter((scope, index, all) => all.findIndex((item) => scopeKey(item) === scopeKey(scope)) === index),
    groups,
  );

  for (const group of groups) {
    if (hasScope(normalized, { type: 'GROUP', id: group.id })) continue;
    for (const unit of group.businessUnits) {
      const unitScope = { type: 'BUSINESS_UNIT', id: unit.id } as const;
      const unitBranches = group.branches.filter((branch) => branchBelongsToUnit(branch, unit.id));
      // Keep a single branch assignment exact; collapsing a one-branch unit would silently add future access.
      if (unitBranches.length > 1 && unitBranches.every((branch) => hasScope(normalized, { type: 'BRANCH', id: branch.id }))) {
        normalized = normalized.filter((scope) => !(scope.type === 'BRANCH' && unitBranches.some((branch) => branch.id === scope.id)));
        if (!hasScope(normalized, unitScope)) normalized.push(unitScope);
      }
    }

    const childScopes: SupportScope[] = [
      ...group.businessUnits.map((unit) => ({ type: 'BUSINESS_UNIT' as const, id: unit.id })),
      ...group.branches.filter((branch) => branchBelongsDirectlyToGroup(branch, group)).map((branch) => ({ type: 'BRANCH' as const, id: branch.id })),
    ];
    // Preserve exact scope when a group has only one selectable child.
    const groupChildrenCovered = childScopes.every((child) => {
      if (hasScope(normalized, child)) return true;
      if (child.type !== 'BUSINESS_UNIT') return false;
      const unitBranches = group.branches.filter((branch) => branchBelongsToUnit(branch, child.id));
      return unitBranches.length > 0 && unitBranches.every((branch) => hasScope(normalized, { type: 'BRANCH', id: branch.id }));
    });
    if (childScopes.length > 1 && groupChildrenCovered) {
      normalized = normalized.filter((scope) => !isScopeDescendantOf(scope, { type: 'GROUP', id: group.id }, groups));
      if (!hasScope(normalized, { type: 'GROUP', id: group.id })) normalized.push({ type: 'GROUP', id: group.id });
    }
  }

  return normalized;
}

export function isSupportScopeInherited(scopes: SupportScope[], scope: SupportScope, groups: SupportScopeTreeGroup[]) {
  if (hasScope(scopes, scope)) return false;
  return scopes.some((ancestor) => isScopeDescendantOf(scope, ancestor, groups));
}

export function isSupportScopeChecked(scopes: SupportScope[], scope: SupportScope, groups: SupportScopeTreeGroup[]) {
  return hasScope(scopes, scope) || isSupportScopeInherited(scopes, scope, groups);
}

/** A parent covers its descendants; inherited descendants cannot become exceptions. */
export function toggleSupportScope(scopes: SupportScope[], scope: SupportScope, groups: SupportScopeTreeGroup[]) {
  const canonical = normalizeSupportScopes(scopes, groups);
  if (isSupportScopeInherited(canonical, scope, groups)) return canonical;
  if (hasScope(canonical, scope)) return canonical.filter((item) => scopeKey(item) !== scopeKey(scope));

  const next = canonical.filter((item) => !isScopeDescendantOf(item, scope, groups));
  next.push(scope);
  return normalizeSupportScopes(next, groups);
}

function matches(value: string, query: string) {
  return normalize(value).includes(query);
}

/** Filters by name while preserving the hierarchy context of each match. */
export function filterSupportScopeTree(
  groups: SupportScopeTreeGroup[],
  searchText = '',
  options: ScopeTreeFilterOptions = {},
): SupportScopeTreeGroup[] {
  const query = normalize(searchText);
  const { scopes = [], onlySelected = false } = options;

  if (onlySelected) {
    return groups.flatMap((group) => {
      const groupScope = { type: 'GROUP', id: group.id } as const;
      const groupSelected = hasScope(scopes, groupScope);
      if (groupSelected) return !query || matches(group.name, query) ? [{ ...group, businessUnits: [], branches: [] }] : [];

      const groupMatches = !!query && matches(group.name, query);
      const businessUnits = group.businessUnits.flatMap((unit) => {
        const unitScope = { type: 'BUSINESS_UNIT', id: unit.id } as const;
        const unitSelected = hasScope(scopes, unitScope);
        if (unitSelected) return !query || groupMatches || matches(unit.name, query) ? [{ ...unit }] : [];
        const branches = group.branches.filter((branch) => hasScope(scopes, { type: 'BRANCH', id: branch.id })
          && (!query || groupMatches || matches(unit.name, query) || matches(branch.name, query)));
        return branches.length ? [{ ...unit }] : [];
      });
      const branches = group.branches.filter((branch) => branchBelongsDirectlyToGroup(branch, group)
        && hasScope(scopes, { type: 'BRANCH', id: branch.id })
        && (!query || groupMatches || matches(branch.name, query)));
      const selectedBranchIds = new Set(branches.map(({ id }) => id));
      for (const unit of businessUnits) {
        const selectedBranches = group.branches.filter((branch) => branch.businessUnitId === unit.id
          && hasScope(scopes, { type: 'BRANCH', id: branch.id })
          && (!query || groupMatches || matches(unit.name, query) || matches(branch.name, query)));
        for (const branch of selectedBranches) selectedBranchIds.add(branch.id);
      }
      const hasSelectedUnit = businessUnits.some((unit) => hasScope(scopes, { type: 'BUSINESS_UNIT', id: unit.id }));
      const filteredUnits = businessUnits.filter((unit) => hasScope(scopes, { type: 'BUSINESS_UNIT', id: unit.id }) || group.branches.some((branch) => selectedBranchIds.has(branch.id) && branch.businessUnitId === unit.id));
      return hasSelectedUnit || filteredUnits.length || branches.length
        ? [{ ...group, businessUnits: filteredUnits, branches: [...branches, ...group.branches.filter((branch) => selectedBranchIds.has(branch.id) && !branches.some((direct) => direct.id === branch.id))] }]
        : [];
    });
  }

  if (!query) return groups;
  return groups.flatMap((group) => {
    if (matches(group.name, query)) return [{ ...group }];
    const businessUnits = group.businessUnits.flatMap((unit) => {
      if (matches(unit.name, query)) return [{ ...unit }];
      const branches = group.branches.filter((branch) => branchBelongsToUnit(branch, unit.id) && matches(branch.name, query));
      return branches.length ? [{ ...unit }] : [];
    });
    const matchingBranches = group.branches.filter((branch) => matches(branch.name, query));
    return businessUnits.length || matchingBranches.length
      ? [{ ...group, businessUnits, branches: matchingBranches }]
      : [];
  }).map((group) => {
    // When a unit itself matches, show its branches as context; branch-only matches stay narrowed.
    const original = groups.find((candidate) => candidate.id === group.id)!;
    const branchIds = new Set(group.branches.map(({ id }) => id));
    for (const unit of group.businessUnits) {
      if (matches(unit.name, query)) {
        for (const branch of original.branches.filter((item) => item.businessUnitId === unit.id)) branchIds.add(branch.id);
      }
    }
    return { ...group, branches: original.branches.filter((branch) => branchIds.has(branch.id)) };
  });
}
