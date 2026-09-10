export interface ThemePreset {
  name: string;
  description: string;
  primary: string;
  sidebar: string;
  accent: string;
}

/** Paletas compartidas por la configuración de sucursal y la consola Manager. */
export const THEME_PRESETS: ThemePreset[] = [
  { name: 'Esmeralda', description: 'Tema predeterminado de NovaHub', primary: '#10b981', sidebar: '#0c1a12', accent: '#064e3b' },
  { name: 'Azul corporativo', description: 'Azul corporativo profesional', primary: '#2563eb', sidebar: '#0f172a', accent: '#1e3a5f' },
  { name: 'Índigo', description: 'Índigo clásico', primary: '#6366f1', sidebar: '#1a1a2e', accent: '#312e81' },
  { name: 'Rosa', description: 'Rosa premium', primary: '#f43f5e', sidebar: '#1a0a10', accent: '#4c0519' },
  { name: 'Ámbar', description: 'Dorado ejecutivo', primary: '#f59e0b', sidebar: '#1a1408', accent: '#451a03' },
  { name: 'Violeta', description: 'Violeta real', primary: '#8b5cf6', sidebar: '#150e24', accent: '#3b0764' },
  { name: 'Turquesa', description: 'Turquesa moderno', primary: '#14b8a6', sidebar: '#0a1a18', accent: '#042f2e' },
  { name: 'Naranja', description: 'Naranja enérgico', primary: '#f97316', sidebar: '#1a1008', accent: '#431407' },
];
