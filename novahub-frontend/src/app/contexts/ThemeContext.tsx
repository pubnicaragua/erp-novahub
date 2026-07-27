import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => {
    try {
      const saved = localStorage.getItem('erp-theme-config');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Force update if old theme
        if (parsed.tenantName === 'Solcom ERP') return defaultTheme;
        return parsed;
      }
    } catch { }
    return defaultTheme;
  });

  useEffect(() => {
    // Apply theme colors to CSS variables
    const root = document.documentElement;
    Object.entries(themeConfig.colors).forEach(([key, value]) => {
      const cssVarName = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVarName, value);
    });

    // Save to localStorage
    localStorage.setItem('erp-theme-config', JSON.stringify(themeConfig));
  }, [themeConfig]);

  useEffect(() => {
    const root = document.documentElement;
    const role = user?.role || 'viewer';
    const tokens = roleThemeTokens[role] || roleThemeTokens.viewer;

    root.dataset.userRole = role;
    root.style.setProperty('--role-surface', tokens.surface);
    root.style.setProperty('--role-accent', tokens.accent);
    root.style.setProperty('--role-border', tokens.border);
  }, [user?.role]);

  // Handle branding from server — re-fetch when token changes (login/switch)
  const [tokenTrigger, setTokenTrigger] = useState(() => localStorage.getItem('nh-auth-token'));

  useEffect(() => {
    // Listen for token changes (login, switch company, logout)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'nh-auth-token') {
        setTokenTrigger(e.newValue);
        if (!e.newValue) {
          // Logged out — reset branding
          setThemeConfig(defaultTheme);
          localStorage.removeItem('erp-theme-config');
        }
      }
    };
    window.addEventListener('storage', onStorage);

    // Also poll for same-window changes (storage event only fires cross-tab)
    const interval = setInterval(() => {
      const current = localStorage.getItem('nh-auth-token');
      setTokenTrigger(prev => prev !== current ? current : prev);
    }, 1000);

    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!tokenTrigger) return;
    api.get<any>('/branding/current')
      .then(b => {
        if (b && b.primaryColor) {
          updateTheme({
            primary: b.primaryColor,
            sidebar: b.sidebarColor,
            accent: b.accentColor,
          });
          updateConfig({ tenantName: b.companyName, logo: b.logo || undefined });
        }
      })
      .catch(err => console.error('Failed to fetch branding:', err));
  }, [tokenTrigger]);

  const updateTheme = (colors: Partial<BrandColors>) => {
    setThemeConfig(prev => ({
      ...prev,
      colors: { ...prev.colors, ...colors },
    }));
  };

  const updateConfig = (config: Partial<Omit<ThemeConfig, 'colors'>>) => {
    setThemeConfig(prev => ({
      ...prev,
      ...config,
    }));
  };

  const resetTheme = () => {
    setThemeConfig(defaultTheme);
    localStorage.removeItem('erp-theme-config');
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
