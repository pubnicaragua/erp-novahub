import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api } from '../services/api';
import { toast } from 'sonner';

interface ImpersonationState {
  isImpersonating: boolean;
  branch: { id: string; name: string; slug?: string } | null;
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

function loadImpersonationState(): ImpersonationState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_IMPERSONATION);
    if (!raw) return { isImpersonating: false, branch: null, manager: null, groupId: null, originalToken: null };
    const parsed = JSON.parse(raw);
    const originalToken = localStorage.getItem(STORAGE_KEY_ORIGINAL);
    if (!parsed.branch || !originalToken) return { isImpersonating: false, branch: null, manager: null, groupId: null, originalToken: null };
    return { isImpersonating: true, branch: parsed.branch, manager: parsed.manager, groupId: parsed.groupId, originalToken };
  } catch {
    return { isImpersonating: false, branch: null, manager: null, groupId: null, originalToken: null };
  }
}

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ImpersonationState>(loadImpersonationState);

  const enterBranch = useCallback(async (groupId: string, branchId: string) => {
    const currentToken = localStorage.getItem('nh-auth-token');
    if (!currentToken) { toast.error('Sesión no encontrada'); return; }

    try {
      const result = await api.post<{ access_token: string; branch: { id: string; name: string; slug?: string }; manager: { id: string; name: string; email: string }; expiresIn: string }>(
        '/enterprise-groups/manager/enter-branch',
        { groupId, branchId },
      );

      const data = (result as any)?.data ?? result;
      const token = data?.access_token;
      const branch = data?.branch;
      const manager = data?.manager;

      if (!token || !branch) { toast.error('No se pudo generar la sesión de trabajo'); return; }

      localStorage.setItem(STORAGE_KEY_ORIGINAL, currentToken);
      localStorage.setItem('nh-auth-token', token);
      localStorage.setItem(STORAGE_KEY_IMPERSONATION, JSON.stringify({ branch, manager, groupId }));

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
    setState({ isImpersonating: false, branch: null, manager: null, groupId: null, originalToken: null });
    window.location.reload();
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
