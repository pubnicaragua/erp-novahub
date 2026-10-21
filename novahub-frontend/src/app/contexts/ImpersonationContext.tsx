import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import { toast } from '@/app/services/toast';

interface ImpersonationState {
  isImpersonating: boolean;
  branch: { id: string; name: string; slug?: string; logo?: string | null } | null;
  manager: { id: string; name: string; email: string } | null;
  groupId: string | null;
  originalToken: string | null;
}

interface ImpersonationContextValue extends ImpersonationState {
  enterBranch: (groupId: string, branchId: string) => Promise<void>;
  exitBranch: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextValue | null>(null);

const STORAGE_KEY_ORIGINAL = 'nh-manager-token';
const STORAGE_KEY_IMPERSONATION = 'nh-impersonation-state';
const STORAGE_KEY_SESSION_BRANDING = 'nh-session-branding';
const STORAGE_KEY_ORIGINAL_BRANDING = 'nh-manager-session-branding';

type SessionBrandingSnapshot = {
  tenantId?: string;
  name?: string;
  kind?: string;
  logo?: string | null;
};

function parseSessionBrandingSnapshot(raw: string | null): SessionBrandingSnapshot | null {
  if (!raw) return null;

  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return {
      tenantId: typeof value.tenantId === 'string' ? value.tenantId : undefined,
      name: typeof value.name === 'string' ? value.name : undefined,
      kind: typeof value.kind === 'string' ? value.kind : undefined,
      logo: typeof value.logo === 'string' ? value.logo : null,
    };
  } catch {
    return null;
  }
}

function loadImpersonationState(): ImpersonationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_IMPERSONATION);
    if (!raw) return { isImpersonating: false, branch: null, manager: null, groupId: null, originalToken: null };
    const parsed = JSON.parse(raw);
    const originalToken = localStorage.getItem(STORAGE_KEY_ORIGINAL);
    if (!parsed.branch || !originalToken) return { isImpersonating: false, branch: null, manager: null, groupId: null, originalToken: null };
    const sessionBranding = parseSessionBrandingSnapshot(localStorage.getItem(STORAGE_KEY_SESSION_BRANDING));
    return {
      isImpersonating: true,
      branch: { ...parsed.branch, logo: parsed.branch.logo ?? sessionBranding?.logo ?? null },
      manager: parsed.manager,
      groupId: parsed.groupId,
      originalToken,
    };
  } catch {
    return { isImpersonating: false, branch: null, manager: null, groupId: null, originalToken: null };
  }
}

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ImpersonationState>(loadImpersonationState);

  useEffect(() => {
    const clearImpersonation = () => {
      setState({ isImpersonating: false, branch: null, manager: null, groupId: null, originalToken: null });
    };
    window.addEventListener('auth-session-reset', clearImpersonation);
    return () => window.removeEventListener('auth-session-reset', clearImpersonation);
  }, []);

  const enterBranch = useCallback(async (groupId: string, branchId: string) => {
    const currentToken = localStorage.getItem('nh-auth-token');
    if (!currentToken) { toast.error('Sesión no encontrada'); return; }

    try {
      const result = await api.post<{ access_token: string; branch: { id: string; name: string; slug?: string; logo?: string | null }; manager: { id: string; name: string; email: string }; expiresIn: string }>(
        '/enterprise-groups/manager/enter-branch',
        { groupId, branchId },
      );

      const data = (result as any)?.data ?? result;
      const token = data?.access_token;
      const branch = data?.branch;
      const manager = data?.manager;

      if (!token || !branch) { toast.error('No se pudo generar la sesión de trabajo'); return; }

      localStorage.setItem(STORAGE_KEY_ORIGINAL, currentToken);
      const previousBranding = parseSessionBrandingSnapshot(localStorage.getItem(STORAGE_KEY_SESSION_BRANDING));
      if (previousBranding) {
        try {
          // Keep only the small identity fields. A logo may be a large data URL,
          // and duplicating it here can exhaust the browser's localStorage quota.
          localStorage.removeItem(STORAGE_KEY_ORIGINAL_BRANDING);
          localStorage.setItem(STORAGE_KEY_ORIGINAL_BRANDING, JSON.stringify({
            tenantId: previousBranding.tenantId,
            name: previousBranding.name,
            kind: previousBranding.kind,
          }));
        } catch {
          // The original branding can be rehydrated from /auth/profile on exit.
          localStorage.removeItem(STORAGE_KEY_ORIGINAL_BRANDING);
        }
      } else {
        localStorage.removeItem(STORAGE_KEY_ORIGINAL_BRANDING);
      }
      localStorage.setItem(STORAGE_KEY_SESSION_BRANDING, JSON.stringify({
        logo: branch.logo || null,
        name: branch.name,
        kind: 'branch',
      }));
      localStorage.setItem('nh-auth-token', token);
      const storedBranch = { id: branch.id, name: branch.name, slug: branch.slug };
      localStorage.setItem(STORAGE_KEY_IMPERSONATION, JSON.stringify({ branch: storedBranch, manager, groupId }));

      setState({ isImpersonating: true, branch, manager, groupId, originalToken: currentToken });
      toast.success(`Trabajando en ${branch.name}`);
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo acceder a la sucursal');
    }
  }, []);

  const exitBranch = useCallback(() => {
    const original = localStorage.getItem(STORAGE_KEY_ORIGINAL);
    if (original) {
      localStorage.setItem('nh-auth-token', original);
    }
    localStorage.removeItem(STORAGE_KEY_ORIGINAL);
    localStorage.removeItem(STORAGE_KEY_IMPERSONATION);
    const originalBranding = parseSessionBrandingSnapshot(localStorage.getItem(STORAGE_KEY_ORIGINAL_BRANDING));
    // Remove a legacy backup first; older versions stored the full logo here.
    localStorage.removeItem(STORAGE_KEY_ORIGINAL_BRANDING);
    try {
      if (originalBranding) {
        localStorage.setItem(STORAGE_KEY_SESSION_BRANDING, JSON.stringify(originalBranding));
      } else {
        localStorage.removeItem(STORAGE_KEY_SESSION_BRANDING);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY_SESSION_BRANDING);
    }

    const finishExit = async () => {
      // Older sessions may have lost the saved group branding when the cache
      // cleanup ran before branding preservation was added. Rehydrate it from
      // the restored Manager token so the return loader is never generic.
      if (original && !originalBranding?.logo) {
        try {
          const profile = await api.get<any>('/auth/profile');
          const apiUser = profile?.user || profile?.data || profile || {};
          const branding = apiUser.sessionBranding || (apiUser.clientTenant
            ? { kind: 'branch', name: apiUser.clientTenant.name, logo: apiUser.clientTenant.logo || null }
            : null);
          if (branding?.name || branding?.logo) {
            const restoredBranding = parseSessionBrandingSnapshot(localStorage.getItem(STORAGE_KEY_SESSION_BRANDING)) || originalBranding || {};
            localStorage.setItem(STORAGE_KEY_SESSION_BRANDING, JSON.stringify({
              tenantId: restoredBranding.tenantId || apiUser.clientTenantId || apiUser.tenantId || apiUser.enterpriseGroupId || undefined,
              logo: branding.logo || restoredBranding.logo || null,
              name: branding.name || restoredBranding.name || 'Grupo empresarial',
              kind: branding.kind || restoredBranding.kind || 'group',
            }));
          }
        } catch {
          // The restored token will be validated again by AuthProvider after reload.
        }
      }
      setState({ isImpersonating: false, branch: null, manager: null, groupId: null, originalToken: null });
      window.location.reload();
    };

    void finishExit();
  }, []);

  useEffect(() => {
    if (state.isImpersonating && state.originalToken) {
      const timeout = setTimeout(() => { exitBranch(); }, 8 * 60 * 60 * 1000);
      return () => clearTimeout(timeout);
    }
  }, [state.isImpersonating, state.originalToken, exitBranch]);

  return (
    <ImpersonationContext.Provider value={{ ...state, enterBranch, exitBranch }}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) return { isImpersonating: false, branch: null, manager: null, groupId: null, originalToken: null, enterBranch: async () => {}, exitBranch: () => {} };
  return ctx;
}
