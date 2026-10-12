import type { SupportScope, SupportScopeType } from '../../services/support-conversations.service';

export interface SupportTargetOptionBranch {
  id: string;
  name: string;
  selectable: boolean;
}

export interface SupportTargetOptionBusinessUnit {
  id: string;
  name: string;
  selectable: boolean;
  branches: SupportTargetOptionBranch[];
}

export interface SupportTargetOptionGroup {
  id: string;
  name: string;
  selectable: boolean;
  businessUnits: SupportTargetOptionBusinessUnit[];
  branches: SupportTargetOptionBranch[];
}

const scopeKey = ({ type, id }: SupportScope) => `${type}:${id}`;
const hasScope = (scopes: SupportScope[], scope: SupportScope) => scopes.some((item) => scopeKey(item) === scopeKey(scope));

function isDescendant(candidate: SupportScope, ancestor: SupportScope, groups: SupportTargetOptionGroup[]) {
  const group = groups.find((item) => item.id === (candidate.type === 'GROUP' ? candidate.id : undefined)
    || item.businessUnits.some((unit) => unit.id === candidate.id && candidate.type === 'BUSINESS_UNIT')
    || item.branches.some((branch) => branch.id === candidate.id && candidate.type === 'BRANCH')
    || item.businessUnits.some((unit) => unit.branches.some((branch) => branch.id === candidate.id && candidate.type === 'BRANCH')));

  if (ancestor.type === 'GROUP') {
    return group?.id === ancestor.id && scopeKey(candidate) !== scopeKey(ancestor);
  }
  if (ancestor.type === 'BUSINESS_UNIT' && candidate.type === 'BRANCH') {
    return group?.businessUnits.some((unit) => unit.id === ancestor.id && unit.branches.some((branch) => branch.id === candidate.id)) ?? false;
  }
  return false;
}

function isSelectable(scope: SupportScope, groups: SupportTargetOptionGroup[]) {
  if (scope.type === 'GROUP') return groups.find((group) => group.id === scope.id)?.selectable === true;
  if (scope.type === 'BUSINESS_UNIT') return groups.flatMap((group) => group.businessUnits).find((unit) => unit.id === scope.id)?.selectable === true;
  return groups.some((group) => group.branches.some((branch) => branch.id === scope.id && branch.selectable)
    || group.businessUnits.some((unit) => unit.branches.some((branch) => branch.id === scope.id && branch.selectable)));
}

export function isSupportTargetInherited(scopes: SupportScope[], scope: SupportScope, groups: SupportTargetOptionGroup[]) {
  if (hasScope(scopes, scope)) return false;
  return scopes.some((ancestor) => isDescendant(scope, ancestor, groups));
}

export function isSupportTargetChecked(scopes: SupportScope[], scope: SupportScope, groups: SupportTargetOptionGroup[]) {
  return hasScope(scopes, scope) || isSupportTargetInherited(scopes, scope, groups);
}

export function isSupportTargetPartiallySelected(scopes: SupportScope[], scope: SupportScope, groups: SupportTargetOptionGroup[]) {
  if (isSupportTargetChecked(scopes, scope, groups)) return false;
  return scopes.some((selected) => isDescendant(selected, scope, groups));
}

/**
 * Selecting a parent replaces explicit child selections. Selecting children
 * keeps them explicit so a one-time broadcast never expands to future branches.
 */
export function toggleSupportTargetSelection(scopes: SupportScope[], scope: SupportScope, groups: SupportTargetOptionGroup[]) {
  if (!isSelectable(scope, groups) || isSupportTargetInherited(scopes, scope, groups)) return scopes;
  if (hasScope(scopes, scope)) return scopes.filter((item) => scopeKey(item) !== scopeKey(scope));

  const next = scopes.filter((item) => !isDescendant(item, scope, groups));
  return [...next, scope];
}

export function supportTargetScopeLabel(type: SupportScopeType) {
  if (type === 'GROUP') return 'Grupo empresarial';
  if (type === 'BUSINESS_UNIT') return 'Rubro';
  return 'Sucursal';
}
