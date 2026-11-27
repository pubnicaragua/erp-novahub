import { api } from './api';

export type UserViewPreferenceScope = 'company' | 'branch' | 'personal';
export type SavedLayoutMode = 'table' | 'cards' | 'kanban' | 'categories';

export interface UserViewPreferenceValues {
  layoutMode?: SavedLayoutMode;
  visibleColumnKeys?: string[];
  accountOrders?: Record<string, string[]>;
  itemPositions?: Record<string, string>;
}

export interface UserViewPreferenceResponse {
  preferences: UserViewPreferenceValues;
  hasSavedPreferences?: boolean;
  updatedAt?: string | null;
}

export async function getUserViewPreferences(viewKey: string, scope: UserViewPreferenceScope) {
  return api.get<UserViewPreferenceResponse>('/user-preferences/view', { params: { viewKey, scope } });
}

export async function saveUserViewPreferences(
  viewKey: string,
  scope: UserViewPreferenceScope,
  preferences: UserViewPreferenceValues,
) {
  return api.patch<UserViewPreferenceResponse>('/user-preferences/view', { viewKey, scope, preferences });
}

export async function importUserViewPreferences(
  viewKey: string,
  scope: UserViewPreferenceScope,
  preferences: UserViewPreferenceValues,
) {
  return api.post<{ imported: boolean; preferences: UserViewPreferenceValues }>(
    '/user-preferences/view/import',
    { viewKey, scope, preferences },
  );
}
