import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

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

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
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
