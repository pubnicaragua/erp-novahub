import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { brandingService, type Branding } from '../services/branding.service';
import { safeSetItem } from '../services/safe-storage';
import { useAuth } from './AuthContext';
import { ensureReadableForeground, getReadableForeground } from '../utils/color-contrast';

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
  tenantId: string;
  tenantName: string;
  logo?: string;
  colors: BrandColors;
}

interface ThemeContextType {
  themeConfig: ThemeConfig;
  updateTheme: (colors: Partial<BrandColors>) => void;
  updateConfig: (config: Partial<Omit<ThemeConfig, 'colors'>>) => void;
  resetTheme: () => void;
}

const defaultColors: BrandColors = {
  primary: 'oklch(0.65 0.2 155)',
  primaryForeground: 'oklch(0.985 0 0)',
  accent: 'oklch(0.22 0.02 155)',
  accentForeground: 'oklch(0.985 0 0)',
  sidebar: 'oklch(0.16 0.01 155)',
  sidebarForeground: 'oklch(0.985 0 0)',
  sidebarPrimary: 'oklch(0.65 0.2 155)',
  sidebarAccent: 'oklch(0.22 0.02 155)',
};

const defaultTheme: ThemeConfig = {
  tenantId: 'default',
  tenantName: 'Nova Hub ERP',
  colors: defaultColors,
};

const roleThemeTokens: Record<string, { surface: string; accent: string; border: string }> = {
  superadmin: {
    surface: 'linear-gradient(135deg, rgba(14, 165, 233, 0.08), rgba(99, 102, 241, 0.06))',
    accent: 'oklch(0.64 0.19 250)',
    border: 'rgba(14, 165, 233, 0.22)',
  },
  partner: {
    surface: 'linear-gradient(135deg, rgba(20, 184, 166, 0.08), rgba(59, 130, 246, 0.05))',
    accent: 'oklch(0.67 0.15 185)',
    border: 'rgba(20, 184, 166, 0.22)',
  },
  admin: {
    surface: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(14, 165, 233, 0.05))',
    accent: 'oklch(0.65 0.16 155)',
    border: 'rgba(16, 185, 129, 0.2)',
  },
  manager: {
    surface: 'linear-gradient(135deg, rgba(245, 158, 11, 0.07), rgba(34, 197, 94, 0.05))',
    accent: 'oklch(0.72 0.16 80)',
    border: 'rgba(245, 158, 11, 0.2)',
  },
  employee: {
    surface: 'linear-gradient(135deg, rgba(148, 163, 184, 0.08), rgba(59, 130, 246, 0.04))',
    accent: 'oklch(0.62 0.08 230)',
    border: 'rgba(148, 163, 184, 0.2)',
  },
  viewer: {
    surface: 'linear-gradient(135deg, rgba(148, 163, 184, 0.07), rgba(226, 232, 240, 0.04))',
    accent: 'oklch(0.58 0.05 240)',
    border: 'rgba(148, 163, 184, 0.18)',
  },
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function createDefaultTheme(tenantId = 'default'): ThemeConfig {
  return {
    ...defaultTheme,
    tenantId,
    colors: { ...defaultColors },
  };
}

function themeStorageKey(tenantId: string) {
  return `erp-theme-config:${tenantId}`;
}

function brandingColors(branding: Branding): Partial<BrandColors> {
  const colors: Partial<BrandColors> = {};
  if (branding.primaryColor) colors.primary = branding.primaryColor;
  if (branding.sidebarColor) colors.sidebar = branding.sidebarColor;
  if (branding.accentColor) colors.accent = branding.accentColor;
  return colors;
}

function readStoredTheme(tenantId: string): ThemeConfig {
  try {
    const saved = localStorage.getItem(themeStorageKey(tenantId));
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<ThemeConfig>;
      const colors = { ...defaultColors, ...(parsed.colors || {}) };
      if (parsed.tenantName === 'Solcom ERP') return createDefaultTheme(tenantId);
      return {
        ...createDefaultTheme(tenantId),
        ...parsed,
        tenantId,
        colors: {
          ...colors,
          primaryForeground: defaultColors.primaryForeground,
          accentForeground: ensureReadableForeground(colors.accent, colors.accentForeground),
          sidebarForeground: ensureReadableForeground(colors.sidebar, colors.sidebarForeground),
        },
      };
    }
  } catch {
    return createDefaultTheme(tenantId);
  }

  return createDefaultTheme(tenantId);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // clientTenantId is the canonical active tenant after a group/branch
  // context switch. Using tenantId alone can read/write the wrong theme key.
  const activeTenantId = user?.clientTenantId || user?.tenantId || 'default';
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => readStoredTheme(activeTenantId));

  const updateTheme = useCallback((colors: Partial<BrandColors>) => {
    setThemeConfig(prev => ({
      ...prev,
      colors: (() => {
        const nextColors = { ...prev.colors, ...colors };
        return {
          ...nextColors,
          primaryForeground: defaultColors.primaryForeground,
          accentForeground: ensureReadableForeground(nextColors.accent, nextColors.accentForeground),
          sidebarForeground: ensureReadableForeground(nextColors.sidebar, nextColors.sidebarForeground),
        };
      })(),
    }));
  }, []);

  const updateConfig = useCallback((config: Partial<Omit<ThemeConfig, 'colors'>>) => {
    setThemeConfig(prev => ({
      ...prev,
      ...config,
    }));
  }, []);

  const applyServerBranding = useCallback((branding: Branding, tenantId: string) => {
    const colors = brandingColors(branding);
    setThemeConfig(previous => {
      const base = previous.tenantId === tenantId ? previous : readStoredTheme(tenantId);
      const nextColors = { ...base.colors, ...colors };
      return {
        ...base,
        tenantId,
        tenantName: branding.companyName || base.tenantName,
        logo: branding.logo || base.logo,
        colors: {
          ...nextColors,
          primaryForeground: defaultColors.primaryForeground,
          accentForeground: ensureReadableForeground(nextColors.accent, nextColors.accentForeground),
          sidebarForeground: ensureReadableForeground(nextColors.sidebar, nextColors.sidebarForeground),
        },
      };
    });
  }, []);

  useEffect(() => {
    // Cada empresa mantiene su propio tema. Esto evita reutilizar el color de la
    // empresa anterior mientras se cambia de usuario o contexto. El id del
    // usuario también forma parte de la dependencia para que dos sesiones
    // distintas en el mismo tenant no compartan estado visual en memoria.
    setThemeConfig(() => (!user ? createDefaultTheme('default') : readStoredTheme(activeTenantId)));
  }, [activeTenantId, user?.id, user?.userType]);

  useLayoutEffect(() => {
    // Apply brand colors while allowing the light/dark CSS variants to control
    // the sidebar surface. Previously an inline --sidebar value from branding
    // overrode .dark and left the sidebar white in dark mode.
    const root = document.documentElement;
    // During login, logout, or tenant switching, the previous tenant can remain
    // in state for one render. Never apply or persist that stale configuration.
    // Read the active tenant's persisted theme synchronously during the
    // transition. Applying the global default here caused a visible gray/
    // default-color flash until the synchronization effect finished.
    const activeTheme = themeConfig.tenantId === activeTenantId
      ? themeConfig
      : readStoredTheme(activeTenantId);
    const sidebarKeys = new Set(['sidebar', 'sidebarForeground', 'sidebarPrimary', 'sidebarAccent']);
    Object.entries(activeTheme.colors).forEach(([key, value]) => {
      if (sidebarKeys.has(key)) return;
      const cssVarName = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVarName, value);
    });

    const applySidebarVariant = () => {
      const isDark = root.classList.contains('dark');
      const sidebar = isDark ? 'oklch(0.16 0.01 155)' : activeTheme.colors.sidebar;
      const foreground = isDark ? 'oklch(0.985 0 0)' : ensureReadableForeground(activeTheme.colors.sidebar, activeTheme.colors.sidebarForeground);
      const primary = activeTheme.colors.sidebarPrimary;
      const accent = isDark ? 'oklch(0.22 0.02 155)' : activeTheme.colors.sidebarAccent;
      root.style.setProperty('--sidebar', sidebar);
      root.style.setProperty('--sidebar-foreground', foreground);
      root.style.setProperty('--sidebar-primary', primary);
      root.style.setProperty('--sidebar-accent', accent);
      root.style.setProperty('--sidebar-accent-foreground', getReadableForeground(accent));
    };

    applySidebarVariant();
    const observer = new MutationObserver(applySidebarVariant);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });

    // No persistir un tema antiguo dentro del tenant nuevo durante la transición.
    if (activeTheme.tenantId === activeTenantId && themeConfig.tenantId === activeTenantId) {
      safeSetItem(themeStorageKey(activeTenantId), JSON.stringify(themeConfig));
    }
    return () => observer.disconnect();
  }, [themeConfig, activeTenantId]);

  useEffect(() => {
    const root = document.documentElement;
    const role = user?.role || 'viewer';
    const tokens = roleThemeTokens[role] || roleThemeTokens.viewer;

    root.dataset.userRole = role;
    root.style.setProperty('--role-surface', tokens.surface);
    root.style.setProperty('--role-accent', tokens.accent);
    root.style.setProperty('--role-border', tokens.border);
  }, [user?.role]);

  // Handle branding from server — re-fetch when user/token changes (login/switch/logout).
  // No se usa polling: `user` de useAuth cambia en login, switch de empresa y logout,
  // y el evento `storage` cubre los cambios desde otras pestañas. El tema por usuario
  // (clave por tenant + tokens de rol) se conserva intacto.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'nh-auth-token') return;
      if (!e.newValue) {
        // Logged out — reset branding
        setThemeConfig(createDefaultTheme('default'));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!user || activeTenantId === 'default') return;
    let cancelled = false;

    brandingService.getCurrent()
      .then(branding => {
        // Never replace a valid persisted theme with a default palette just
        // because the endpoint returned a partial/empty branding object.
        if (cancelled || !branding) return;
        applyServerBranding(branding, activeTenantId);
      })
      .catch(err => {
        if (!cancelled) console.error('Failed to fetch branding:', err);
      });

    return () => { cancelled = true; };
  }, [user, activeTenantId, applyServerBranding]);

  const resetTheme = () => {
    setThemeConfig(createDefaultTheme(activeTenantId));
    localStorage.removeItem(themeStorageKey(activeTenantId));
  };

  return (
    <ThemeContext.Provider value={{ themeConfig, updateTheme, updateConfig, resetTheme }}>
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
