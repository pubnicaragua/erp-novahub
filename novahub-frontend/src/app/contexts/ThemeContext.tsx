import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { brandingService, type Branding, type ThemePaletteMode, type UserThemeSettings } from '../services/branding.service';
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
  paletteMode: ThemePaletteMode;
  colors: BrandColors;
}

interface ThemeContextType {
  themeConfig: ThemeConfig;
  /** El panel no debe montarse antes de resolver el branding del tenant activo. */
  isBrandingReady: boolean;
  updateTheme: (colors: Partial<BrandColors>, paletteMode?: ThemePaletteMode) => void;
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

const DEFAULT_PALETTE_MODE: ThemePaletteMode = 'details';

const SIDEBAR_CSS_VARIABLES = [
  '--sidebar',
  '--sidebar-foreground',
  '--sidebar-primary',
  '--sidebar-primary-foreground',
  '--sidebar-accent',
  '--sidebar-accent-foreground',
  '--sidebar-border',
  '--sidebar-ring',
] as const;

const defaultTheme: ThemeConfig = {
  userId: 'anonymous',
  tenantId: 'default',
  tenantName: 'Nova Hub ERP',
  paletteMode: DEFAULT_PALETTE_MODE,
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
  if (branding.primaryForeground) colors.primaryForeground = branding.primaryForeground;
  if (branding.sidebarColor) colors.sidebar = branding.sidebarColor;
  if (branding.sidebarForeground) colors.sidebarForeground = branding.sidebarForeground;
  if (branding.accentColor) {
    colors.accent = branding.accentColor;
    colors.sidebarAccent = branding.accentColor;
  }
  if (branding.accentForeground) colors.accentForeground = branding.accentForeground;
  return colors;
}

function normalizePaletteMode(value: unknown, fallback: ThemePaletteMode = DEFAULT_PALETTE_MODE): ThemePaletteMode {
  return value === 'complete' || value === 'details' ? value : fallback;
}

function normalizeUserTheme(value: unknown): UserThemeSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const candidate = value as UserThemeSettings;
  const paletteMode = candidate.paletteMode === 'complete' || candidate.paletteMode === 'details'
    ? candidate.paletteMode
    : undefined;
  return {
    ...(paletteMode ? { paletteMode } : {}),
    colors: candidate.colors && typeof candidate.colors === 'object' ? candidate.colors : {},
  };
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
      const hasStoredColors = Boolean(parsed.colors && typeof parsed.colors === 'object' && Object.keys(parsed.colors).length > 0);
      return {
        ...createDefaultTheme(userId, tenantId),
        userId,
        tenantId,
        // Before paletteMode existed, saved user themes always colored the
        // sidebar. Treat those records as complete to preserve their behavior.
        paletteMode: normalizePaletteMode((parsed as any).paletteMode, hasStoredColors ? 'complete' : DEFAULT_PALETTE_MODE),
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
  const { user, canPerform } = useAuth();
  const themeUserId = user?.id || 'anonymous';
  const isPlatformUser = Boolean(user?.isPlatformAdmin);
  // A stored user theme is still private data, but it must not affect the
  // workspace of a user who cannot even view Marca y tema. This also keeps a
  // revoked permission from leaving custom colors active in the current tab.
  const canViewBranding = Boolean(user && !isPlatformUser && canPerform('CONFIG_BRANDING', 'view'));
  // clientTenantId is the canonical active tenant after a group/branch
  // context switch. It remains context for the fallback corporate branding,
  // but the saved visual preference is always keyed by the user id.
  const activeTenantId = user?.clientTenantId || user?.tenantId || 'default';
  const brandingSessionKey = user ? `${user.id}:${activeTenantId}` : 'anonymous';
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => !canViewBranding
    ? createDefaultTheme(themeUserId, 'default')
    : readStoredTheme(themeUserId, activeTenantId));
  const [readyBrandingSessionKey, setReadyBrandingSessionKey] = useState<string | null>(
    () => user && activeTenantId !== 'default' ? null : 'anonymous',
  );
  const isBrandingReady = !user || isPlatformUser || activeTenantId === 'default' || readyBrandingSessionKey === brandingSessionKey;

  const updateTheme = useCallback((colors: Partial<BrandColors>, paletteMode?: ThemePaletteMode) => {
    if (!canViewBranding) return;
    setThemeConfig(prev => ({
      ...prev,
      paletteMode: paletteMode || prev.paletteMode,
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
  }, [canViewBranding]);

  const updateConfig = useCallback((config: Partial<Omit<ThemeConfig, 'colors' | 'userId'>>) => {
    setThemeConfig(prev => ({
      ...prev,
      ...config,
    }));
  }, []);

  const applyServerBranding = useCallback((branding: Branding, tenantId: string, userId: string) => {
    const userTheme = canViewBranding ? normalizeUserTheme(branding.userTheme) : {};
    const colors = canViewBranding ? { ...brandingColors(branding), ...userTheme.colors } : {};
    setThemeConfig(previous => {
      const base = canViewBranding && previous.userId === userId && previous.tenantId === tenantId
        ? previous
        : canViewBranding
          ? readStoredTheme(userId, tenantId)
          : createDefaultTheme(userId, tenantId);
      // The explicit user preference wins. If an older record has colors but
      // no mode, keep the mode already resolved for this user instead of
      // silently converting a details theme into a complete theme.
      const paletteMode = canViewBranding
        ? userTheme.paletteMode || base.paletteMode || DEFAULT_PALETTE_MODE
        : DEFAULT_PALETTE_MODE;
      const nextColors = { ...defaultColors, ...colors };
      return {
        ...base,
        userId,
        tenantId,
        paletteMode,
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
  }, [canViewBranding]);

  useEffect(() => {
    // Cada usuario mantiene su propia preferencia visual. El tenant solo aporta
    // el fallback corporativo cuando ese usuario aún no ha personalizado el tema.
    setThemeConfig(() => {
      if (!user) return createDefaultTheme();
      return canViewBranding
        ? readStoredTheme(themeUserId, activeTenantId)
        : createDefaultTheme(themeUserId, activeTenantId);
    });
  }, [activeTenantId, canViewBranding, themeUserId, user]);

  useEffect(() => {
    // Login/profile ya transporta la preferencia privada. Aplicarla aquí evita
    // que una sesión nueva dependa de visitar Configuración para descubrirla.
    if (!user || isPlatformUser) return;
    if (!canViewBranding) return;
    const userTheme = normalizeUserTheme(user.themeSettings);
    if (!userTheme.paletteMode && Object.keys(userTheme.colors || {}).length === 0) return;
    setThemeConfig(previous => {
      const nextColors = { ...previous.colors, ...(userTheme.colors || {}) };
      const paletteMode = userTheme.paletteMode || previous.paletteMode;
      return {
        ...previous,
        userId: themeUserId,
        tenantId: activeTenantId,
        paletteMode,
        colors: {
          ...nextColors,
          primaryForeground: resolveThemeForeground(nextColors.primary, nextColors.primaryForeground),
          accentForeground: resolveThemeForeground(nextColors.accent, nextColors.accentForeground),
          sidebarForeground: resolveThemeForeground(nextColors.sidebar, nextColors.sidebarForeground),
        },
      };
    });
  }, [activeTenantId, canViewBranding, isPlatformUser, themeUserId, user?.themeSettings]);

  useLayoutEffect(() => {
    // Apply brand colors and choose whether the sidebar is neutral or branded.
    const root = document.documentElement;
    // During login, logout, or tenant switching, the previous tenant can remain
    // in state for one render. Never apply or persist that stale configuration.
    // Read the active tenant's persisted theme synchronously during the
    // transition. Applying the global default here caused a visible gray/
    // default-color flash until the synchronization effect finished.
    const activeTheme = !canViewBranding || isPlatformUser
      ? createDefaultTheme(themeUserId, 'default')
      : themeConfig.userId === themeUserId && themeConfig.tenantId === activeTenantId
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
      root.dataset.novahubPaletteMode = activeTheme.paletteMode;
      if (activeTheme.paletteMode === 'details') {
        // Let theme.css provide white in light mode and the matching dark
        // surface in dark mode. Removing inline values also handles a live
        // switch from complete to details without a reload.
        SIDEBAR_CSS_VARIABLES.forEach(key => root.style.removeProperty(key));
        validateAppliedTheme();
        return;
      }
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
    if (canViewBranding && !isPlatformUser && activeTheme.userId === themeUserId && activeTheme.tenantId === activeTenantId && themeConfig.userId === themeUserId) {
      safeSetItem(themeStorageKey(themeUserId), JSON.stringify(themeConfig));
    }
    return () => observer.disconnect();
  }, [canViewBranding, isPlatformUser, themeConfig, activeTenantId, themeUserId]);

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
    if (!user || isPlatformUser || activeTenantId === 'default') {
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
  }, [user?.id, activeTenantId, brandingSessionKey, themeUserId, isPlatformUser, applyServerBranding]);

  const resetTheme = () => {
    setThemeConfig(createDefaultTheme(themeUserId, activeTenantId));
    localStorage.removeItem(themeStorageKey(themeUserId));
  };

  // Keep the private state intact so a later permission grant can restore the
  // user's preference, but never expose that state to modules without access.
  const effectiveThemeConfig = canViewBranding
    ? themeConfig
    : {
      ...createDefaultTheme(themeUserId, activeTenantId),
      tenantName: themeConfig.tenantName,
      logo: themeConfig.logo,
    };

  return (
    <ThemeContext.Provider value={{ themeConfig: effectiveThemeConfig, isBrandingReady, updateTheme, updateConfig, resetTheme }}>
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
