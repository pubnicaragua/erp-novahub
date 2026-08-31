import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { brandingService, type Branding } from '../services/branding.service';
import { safeSetItem } from '../services/safe-storage';
import { useAuth } from './AuthContext';
import { ensureReadableForeground, validateThemeRoot } from '../utils/color-contrast';

export interface BrandColors {
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarAccent: string;
}

export interface ThemeConfig {
  /** Usuario propietario de la preferencia visual; nunca es un rol. */
  userId: string;
  tenantId: string;
  tenantName: string;
  logo?: string;
  colors: BrandColors;
}

interface ThemeContextType {
  themeConfig: ThemeConfig;
  /** El panel no debe montarse antes de resolver el branding del tenant activo. */
  isBrandingReady: boolean;
  updateTheme: (colors: Partial<BrandColors>) => void;
  updateConfig: (config: Partial<Omit<ThemeConfig, 'colors' | 'userId'>>) => void;
  resetTheme: () => void;
}

const defaultColors: BrandColors = {
  primary: 'oklch(0.65 0.2 155)',
  primaryForeground: 'oklch(0.145 0 0)',
  accent: 'oklch(0.22 0.02 155)',
  accentForeground: 'oklch(0.985 0 0)',
  sidebar: 'oklch(0.16 0.01 155)',
  sidebarForeground: 'oklch(0.985 0 0)',
  sidebarPrimary: 'oklch(0.65 0.2 155)',
  sidebarAccent: 'oklch(0.22 0.02 155)',
};

const defaultTheme: ThemeConfig = {
  userId: 'anonymous',
  tenantId: 'default',
  tenantName: 'Nova Hub ERP',
  colors: defaultColors,
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function createDefaultTheme(userId = 'anonymous', tenantId = 'default'): ThemeConfig {
  return {
    ...defaultTheme,
    userId,
    tenantId,
    colors: { ...defaultColors },
  };
}

function themeStorageKey(userId: string) {
  return `erp-theme-config:user:${userId}`;
}

function brandingColors(branding: Branding): Partial<BrandColors> {
  const colors: Partial<BrandColors> = {};
  if (branding.primaryColor) {
    colors.primary = branding.primaryColor;
    colors.sidebarPrimary = branding.primaryColor;
  }
  if (branding.sidebarColor) colors.sidebar = branding.sidebarColor;
  if (branding.accentColor) {
    colors.accent = branding.accentColor;
    colors.sidebarAccent = branding.accentColor;
  }
  return colors;
}

function userThemeColors(branding: Branding): Partial<BrandColors> {
  const colors = branding.userTheme?.colors;
  return colors && typeof colors === 'object' ? colors : {};
}

function resolveThemeForeground(background: string, foreground?: string): string {
  // A manually selected foreground is part of the user's branding choice.
  // Keep it when present; use the contrast helper only when no value exists.
  return typeof foreground === 'string' && foreground.trim()
    ? foreground.trim()
    : ensureReadableForeground(background);
}

function readStoredTheme(userId: string, tenantId: string): ThemeConfig {
  try {
    const saved = localStorage.getItem(themeStorageKey(userId));
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<ThemeConfig>;
      const colors = { ...defaultColors, ...(parsed.colors || {}) };
      if (parsed.tenantName === 'Solcom ERP') return createDefaultTheme(userId, tenantId);
      return {
        ...createDefaultTheme(userId, tenantId),
        userId,
        tenantId,
        colors: {
          ...colors,
          primaryForeground: resolveThemeForeground(colors.primary, colors.primaryForeground),
          accentForeground: resolveThemeForeground(colors.accent, colors.accentForeground),
          sidebarForeground: resolveThemeForeground(colors.sidebar, colors.sidebarForeground),
        },
      };
    }
  } catch {
    return createDefaultTheme(userId, tenantId);
  }

  return createDefaultTheme(userId, tenantId);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const themeUserId = user?.id || 'anonymous';
  // clientTenantId is the canonical active tenant after a group/branch
  // context switch. It remains context for the fallback corporate branding,
  // but the saved visual preference is always keyed by the user id.
  const activeTenantId = user?.clientTenantId || user?.tenantId || 'default';
  const brandingSessionKey = user ? `${user.id}:${activeTenantId}` : 'anonymous';
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => readStoredTheme(themeUserId, activeTenantId));
  const [readyBrandingSessionKey, setReadyBrandingSessionKey] = useState<string | null>(
    () => user && activeTenantId !== 'default' ? null : 'anonymous',
  );
  const isBrandingReady = !user || activeTenantId === 'default' || readyBrandingSessionKey === brandingSessionKey;

  const updateTheme = useCallback((colors: Partial<BrandColors>) => {
    setThemeConfig(prev => ({
      ...prev,
      colors: (() => {
        const nextColors = { ...prev.colors, ...colors };
        return {
          ...nextColors,
          primaryForeground: resolveThemeForeground(nextColors.primary, nextColors.primaryForeground),
          accentForeground: resolveThemeForeground(nextColors.accent, nextColors.accentForeground),
          sidebarForeground: resolveThemeForeground(nextColors.sidebar, nextColors.sidebarForeground),
        };
      })(),
    }));
  }, []);

  const updateConfig = useCallback((config: Partial<Omit<ThemeConfig, 'colors' | 'userId'>>) => {
    setThemeConfig(prev => ({
      ...prev,
      ...config,
    }));
  }, []);

  const applyServerBranding = useCallback((branding: Branding, tenantId: string, userId: string) => {
    const colors = { ...brandingColors(branding), ...userThemeColors(branding) };
    setThemeConfig(previous => {
      const base = previous.userId === userId && previous.tenantId === tenantId
        ? previous
        : readStoredTheme(userId, tenantId);
      const nextColors = { ...defaultColors, ...colors };
      return {
        ...base,
        userId,
        tenantId,
        tenantName: branding.companyName || base.tenantName,
        // Logo y nombre pertenecen a la identidad corporativa del contexto
        // actual; no se recuperan del almacenamiento privado del usuario.
        logo: branding.logo || undefined,
        colors: {
          ...nextColors,
          primaryForeground: resolveThemeForeground(nextColors.primary, nextColors.primaryForeground),
          accentForeground: resolveThemeForeground(nextColors.accent, nextColors.accentForeground),
          sidebarForeground: resolveThemeForeground(nextColors.sidebar, nextColors.sidebarForeground),
        },
      };
    });
  }, []);

  useEffect(() => {
    // Cada usuario mantiene su propia preferencia visual. El tenant solo aporta
    // el fallback corporativo cuando ese usuario aún no ha personalizado el tema.
    setThemeConfig(() => (!user ? createDefaultTheme() : readStoredTheme(themeUserId, activeTenantId)));
  }, [activeTenantId, themeUserId]);

  useLayoutEffect(() => {
    // Apply brand colors while keeping the sidebar preference consistent in
    // light and dark mode. The sidebar is a branded surface, so the selected
    // color must not be replaced by the static dark-mode token.
    const root = document.documentElement;
    // During login, logout, or tenant switching, the previous tenant can remain
    // in state for one render. Never apply or persist that stale configuration.
    // Read the active tenant's persisted theme synchronously during the
    // transition. Applying the global default here caused a visible gray/
    // default-color flash until the synchronization effect finished.
    const activeTheme = themeConfig.userId === themeUserId && themeConfig.tenantId === activeTenantId
      ? themeConfig
      : readStoredTheme(themeUserId, activeTenantId);
    const sidebarKeys = new Set(['sidebar', 'sidebarForeground', 'sidebarPrimary', 'sidebarAccent']);
    Object.entries(activeTheme.colors).forEach(([key, value]) => {
      if (sidebarKeys.has(key)) return;
      const cssVarName = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      const safeValue = key === 'primaryForeground'
        ? resolveThemeForeground(activeTheme.colors.primary, value)
        : key === 'accentForeground'
          ? resolveThemeForeground(activeTheme.colors.accent, value)
          : value;
      root.style.setProperty(cssVarName, safeValue);
    });

    const validateAppliedTheme = () => {
      const issues = validateThemeRoot(root);
      root.dataset.themeContrast = issues.length === 0 ? 'pass' : 'issues';
      if (import.meta.env.DEV && issues.length > 0) {
        console.warn('[NovaHub theme] Combinaciones con contraste insuficiente:', issues);
      }
    };

    const applySidebarVariant = () => {
      const sidebar = activeTheme.colors.sidebar;
      const foreground = resolveThemeForeground(sidebar, activeTheme.colors.sidebarForeground);
      const primary = activeTheme.colors.sidebarPrimary;
      const accent = activeTheme.colors.sidebarAccent;
      const primaryForeground = resolveThemeForeground(primary, activeTheme.colors.primaryForeground);
      const accentForeground = resolveThemeForeground(accent, activeTheme.colors.accentForeground);
      root.style.setProperty('--sidebar', sidebar);
      root.style.setProperty('--sidebar-foreground', foreground);
      root.style.setProperty('--sidebar-primary', primary);
      root.style.setProperty('--sidebar-primary-foreground', primaryForeground);
      root.style.setProperty('--sidebar-accent', accent);
      root.style.setProperty('--sidebar-accent-foreground', accentForeground);
      validateAppliedTheme();
    };

    applySidebarVariant();
    const observer = new MutationObserver(applySidebarVariant);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    // No persistir un tema de otra sesión durante una transición de usuario.
    if (activeTheme.userId === themeUserId && activeTheme.tenantId === activeTenantId && themeConfig.userId === themeUserId) {
      safeSetItem(themeStorageKey(themeUserId), JSON.stringify(themeConfig));
    }
    return () => observer.disconnect();
  }, [themeConfig, activeTenantId, themeUserId]);

  // Handle branding from server — re-fetch when user/token changes (login/switch/logout).
  // No se usa polling: `user` de useAuth cambia en login, switch de empresa y logout,
  // y el evento `storage` cubre los cambios desde otras pestañas. La identidad
  // corporativa puede ser compartida, pero el tema visual se conserva por usuario.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'nh-auth-token') return;
      if (!e.newValue) {
        // Logged out — reset branding
        setThemeConfig(createDefaultTheme());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!user || activeTenantId === 'default') {
      setReadyBrandingSessionKey('anonymous');
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const sessionKey = brandingSessionKey;

    // Invalidate the previous session immediately. AppContent uses this flag
    // to keep the workspace behind the loader until the server branding has
    // been applied to the active tenant.
    setReadyBrandingSessionKey(null);

    brandingService.getCurrent(controller.signal)
      .then(branding => {
        // Never replace a valid persisted theme with a default palette just
        // because the endpoint returned a partial/empty branding object.
        if (cancelled || !branding) return;
        applyServerBranding(branding, activeTenantId, themeUserId);
      })
      .catch(err => {
        if (!cancelled && err?.name !== 'AbortError') {
          console.error('Failed to fetch branding:', err);
        }
      })
      .finally(() => {
        // A failed branding request must not leave the application blocked
        // forever: the persisted tenant theme remains the safe fallback.
        if (!cancelled) setReadyBrandingSessionKey(sessionKey);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [user?.id, activeTenantId, brandingSessionKey, themeUserId, applyServerBranding]);

  const resetTheme = () => {
    setThemeConfig(createDefaultTheme(themeUserId, activeTenantId));
    localStorage.removeItem(themeStorageKey(themeUserId));
  };

  return (
    <ThemeContext.Provider value={{ themeConfig, isBrandingReady, updateTheme, updateConfig, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
