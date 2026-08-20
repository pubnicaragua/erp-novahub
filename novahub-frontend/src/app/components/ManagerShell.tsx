import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import {
  BarChart3,
  Boxes,
  Building2,
  LayoutDashboard,
  Menu,
  Moon,
  ShieldCheck,
  Settings2,
  Sun,
  Tags,
  Users,
  Warehouse,
  X,
  ArrowRightLeft,
  Landmark,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { type ManagerGroup } from '../services/enterprise-groups.service';
import { safeGetItem, safeSetItem } from '../services/safe-storage';
import { Button } from './ui/button';
import { cn } from './ui/utils';

export type ManagerSection =
  | 'overview'
  | 'inventory'
  | 'accounting'
  | 'users'
  | 'warehouses'
  | 'managers'
  | 'settings'
  | 'catalog'
  | 'consolidated'
  | 'transfers';

export const MANAGER_SECTIONS: Array<{ id: ManagerSection; label: string; icon: LucideIcon; group: string }> = [
  { id: 'overview', label: 'Resumen', icon: LayoutDashboard, group: 'General' },
  { id: 'inventory', label: 'Inventario consolidado', icon: Boxes, group: 'Consolidado' },
  { id: 'accounting', label: 'Contabilidad y finanzas', icon: Landmark, group: 'Consolidado' },
  { id: 'consolidated', label: 'Estados financieros', icon: BarChart3, group: 'Consolidado' },
  { id: 'transfers', label: 'Transferencias', icon: ArrowRightLeft, group: 'Operaciones' },
  { id: 'catalog', label: 'Catálogo compartido', icon: Tags, group: 'Operaciones' },
  { id: 'users', label: 'Usuarios', icon: Users, group: 'Administración' },
  { id: 'warehouses', label: 'Almacenes', icon: Warehouse, group: 'Administración' },
  { id: 'managers', label: 'Accesos Manager', icon: ShieldCheck, group: 'Administración' },
  { id: 'settings', label: 'Configuración', icon: Settings2, group: 'Sistema' },
];

type ManagerThemeState = {
  mode: 'light' | 'dark';
  preset: keyof typeof MANAGER_THEME_PRESETS;
};

const MANAGER_THEME_KEY = 'novahub:manager-theme';
const MANAGER_THEME_VARIABLES = ['--primary', '--accent', '--sidebar', '--sidebar-primary', '--sidebar-accent'];
const MANAGER_THEME_PRESETS = {
  emerald: { label: 'Esmeralda', primary: 'oklch(0.65 0.2 155)', sidebar: 'oklch(0.16 0.01 155)', accent: 'oklch(0.22 0.02 155)' },
  indigo: { label: 'Índigo', primary: 'oklch(0.62 0.2 270)', sidebar: 'oklch(0.15 0.02 270)', accent: 'oklch(0.23 0.04 270)' },
  amber: { label: 'Ámbar', primary: 'oklch(0.72 0.17 80)', sidebar: 'oklch(0.17 0.025 80)', accent: 'oklch(0.24 0.04 80)' },
  rose: { label: 'Rosa', primary: 'oklch(0.64 0.2 20)', sidebar: 'oklch(0.16 0.02 20)', accent: 'oklch(0.23 0.04 20)' },
} as const;

interface ThemeTransition {
  finished: Promise<void>;
  skipTransition?: () => void;
}

type ThemeTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ThemeTransition;
};

let activeManagerThemeTransition: ThemeTransition | null = null;
let managerThemeChangeVersion = 0;

function readManagerTheme(): ManagerThemeState {
  try {
    const saved = JSON.parse(safeGetItem(MANAGER_THEME_KEY) || 'null') as Partial<ManagerThemeState> | null;
    const preset = saved?.preset && saved.preset in MANAGER_THEME_PRESETS ? saved.preset : 'emerald';
    return { mode: saved?.mode === 'light' ? 'light' : 'dark', preset: preset as ManagerThemeState['preset'] };
  } catch {
    return { mode: 'dark', preset: 'emerald' };
  }
}

function applyManagerTheme(theme: ManagerThemeState) {
  const root = document.documentElement;
  const preset = MANAGER_THEME_PRESETS[theme.preset];
  root.classList.toggle('dark', theme.mode === 'dark');
  root.style.setProperty('--primary', preset.primary);
  root.style.setProperty('--sidebar-primary', preset.primary);
  root.style.setProperty('--accent', preset.accent);
  root.style.setProperty('--sidebar', preset.sidebar);
  root.style.setProperty('--sidebar-accent', preset.accent);
}

function useManagerTheme() {
  const [theme, setTheme] = useState<ManagerThemeState>(readManagerTheme);

  useEffect(() => {
    const root = document.documentElement;
    const previousDark = root.classList.contains('dark');
    const previousVariables = Object.fromEntries(MANAGER_THEME_VARIABLES.map((name) => [name, root.style.getPropertyValue(name)]));
    applyManagerTheme(theme);
    return () => {
      root.classList.toggle('dark', previousDark);
      MANAGER_THEME_VARIABLES.forEach((name) => {
        const value = previousVariables[name];
        if (value) root.style.setProperty(name, value);
        else root.style.removeProperty(name);
      });
    };
  }, []);

  useEffect(() => {
    applyManagerTheme(theme);
    safeSetItem(MANAGER_THEME_KEY, JSON.stringify(theme));
  }, [theme]);

  return { theme, setTheme };
}

type ManagerShellProps = {
  children: ReactNode;
  section: ManagerSection;
  onSectionChange: (section: ManagerSection) => void;
  group?: ManagerGroup;
  branches: Array<{ id: string; name: string }>;
  selectedBranchId: string;
  onBranchChange: (branchId: string) => void;
  allowedSections?: ManagerSection[];
};

export function ManagerShell({
  children,
  section,
  onSectionChange,
  group,
  branches,
  selectedBranchId,
  onBranchChange,
  allowedSections,
}: ManagerShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const { theme, setTheme } = useManagerTheme();
  const visibleSections = allowedSections ? MANAGER_SECTIONS.filter((item) => allowedSections.includes(item.id)) : MANAGER_SECTIONS;

  const toggleTheme = (event?: MouseEvent<HTMLElement>) => {
    const root = document.documentElement;
    const transitionDocument = document as ThemeTransitionDocument;
    const nextDark = !root.classList.contains('dark');
    const requestVersion = ++managerThemeChangeVersion;
    const applyTheme = () => {
      if (requestVersion !== managerThemeChangeVersion) return;
      root.classList.toggle('dark', nextDark);
      flushSync(() => setTheme((current) => ({ ...current, mode: nextDark ? 'dark' : 'light' })));
    };
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!transitionDocument.startViewTransition || reduceMotion) {
      applyTheme();
      return;
    }
    if (activeManagerThemeTransition) {
      const previousTransition = activeManagerThemeTransition;
      activeManagerThemeTransition = null;
      delete root.dataset.themeTransition;
      previousTransition.skipTransition?.();
      applyTheme();
      return;
    }
    const bounds = event?.currentTarget.getBoundingClientRect();
    const x = bounds ? bounds.left + bounds.width / 2 : window.innerWidth / 2;
    const y = bounds ? bounds.top + bounds.height / 2 : window.innerHeight / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    root.style.setProperty('--theme-transition-x', `${x}px`);
    root.style.setProperty('--theme-transition-y', `${y}px`);
    root.style.setProperty('--theme-transition-radius', `${Math.ceil(radius)}px`);
    root.dataset.themeTransition = 'active';
    try {
      const transition = transitionDocument.startViewTransition(applyTheme);
      activeManagerThemeTransition = transition;
      void transition.finished.catch(() => undefined).finally(() => {
        if (activeManagerThemeTransition === transition) {
          activeManagerThemeTransition = null;
          delete root.dataset.themeTransition;
        }
      });
    } catch {
      activeManagerThemeTransition = null;
      delete root.dataset.themeTransition;
      applyTheme();
    }
  };

  const updateSection = (next: ManagerSection) => {
    onSectionChange(next);
    setSidebarOpen(false);
  };

  return (
    <div className="manager-shell min-h-screen overflow-x-hidden bg-background text-foreground">
      <ManagerSidebar open={sidebarOpen} section={section} onSectionChange={updateSection} onClose={() => setSidebarOpen(false)} groupName={group?.name} sections={visibleSections} />
      <div className="min-h-screen min-w-0 lg:pl-[280px]">
        <header className="sticky top-0 z-30 border-b border-border/60 bg-card/90 backdrop-blur-xl">
          <div className="mx-auto flex min-h-16 w-full max-w-[1700px] min-w-0 flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-10">
            <Button variant="outline" size="icon" className="size-10 shrink-0 rounded-xl lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú Manager">
              <Menu className="size-5" />
            </Button>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex"><Building2 className="size-5" /></div>
              <div className="min-w-0">
                <p className="truncate text-base font-black uppercase tracking-tight">{group?.name || 'Grupo empresarial'}</p>
              </div>
            </div>
            <div className="order-3 flex w-full min-w-0 flex-col gap-2 sm:order-none sm:w-auto sm:flex-row sm:items-center">
              <select aria-label="Filtrar sucursal" value={selectedBranchId} onChange={(event) => onBranchChange(event.target.value)} className="h-10 min-w-0 max-w-full rounded-xl border border-border bg-background px-3 text-sm sm:w-52">
                <option value="">Todas las sucursales</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" className="size-10 rounded-xl" onClick={toggleTheme} aria-label={theme.mode === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'} title={theme.mode === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
                {theme.mode === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
              </Button>
              <div className="ml-1 hidden items-center gap-2 border-l border-border/60 pl-3 sm:flex">
                <div className="flex size-9 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground">{String(user?.name || 'M').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>
                <div className="hidden min-w-0 xl:block"><p className="max-w-32 truncate text-xs font-black">{user?.name || 'Manager'}</p><p className="text-[10px] uppercase tracking-widest text-primary">Manager global</p></div>
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1700px] min-w-0 p-4 sm:p-6 md:p-10">{section === 'settings' ? <ManagerThemeSettings theme={theme} onPresetChange={(preset) => setTheme((current) => ({ ...current, preset }))} onToggleTheme={toggleTheme} /> : children}</main>
      </div>
    </div>
  );
}

function ManagerSidebar({ open, section, onSectionChange, onClose, groupName, sections = MANAGER_SECTIONS }: { open: boolean; section: ManagerSection; onSectionChange: (section: ManagerSection) => void; onClose: () => void; groupName?: string; sections?: typeof MANAGER_SECTIONS }) {
  const { user } = useAuth();
  const groups = [...new Set(sections.map((item) => item.group))];
  return (
    <>
      <div className={cn('fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden', open ? 'block' : 'hidden')} onClick={onClose} aria-hidden="true" />
      <aside className={cn('fixed inset-y-0 left-0 z-50 flex w-[280px] -translate-x-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl transition-transform duration-300 lg:translate-x-0', open && 'translate-x-0')}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border px-5">
          <div className="min-w-0"><p className="truncate text-sm font-black uppercase tracking-tight text-sidebar-foreground">{groupName || 'Grupo empresarial'}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-[0.24em] text-sidebar-foreground/55">Panel de Control</p></div>
          <Button variant="ghost" size="icon" className="size-9 text-sidebar-foreground hover:bg-sidebar-accent lg:hidden" onClick={onClose} aria-label="Cerrar menú Manager"><X className="size-5" /></Button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group} className="mb-5">
              <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-sidebar-foreground/50">{group}</p>
              <div className="space-y-1">
                {sections.filter((item) => item.group === group).map((item) => {
                  const Icon = item.icon;
                  const active = section === item.id;
                  return <button key={item.id} type="button" onClick={() => onSectionChange(item.id)} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition-colors', active ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-sidebar-primary/20' : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground')} aria-current={active ? 'page' : undefined}><Icon className="size-4 shrink-0" /><span className="min-w-0 truncate">{item.label}</span></button>;
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="shrink-0 border-t border-sidebar-border p-4"><div className="flex items-center gap-3 rounded-2xl bg-sidebar-accent/60 p-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-black text-sidebar-primary-foreground">{String(user?.name || 'M').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div><div className="min-w-0"><p className="truncate text-xs font-bold text-sidebar-foreground">{user?.name || 'Manager'}</p><p className="text-[10px] uppercase tracking-widest text-sidebar-foreground/55">Acceso Manager</p></div></div></div>
      </aside>
    </>
  );
}

function ManagerThemeSettings({ theme, onPresetChange, onToggleTheme }: { theme: ManagerThemeState; onPresetChange: (preset: ManagerThemeState['preset']) => void; onToggleTheme: (event?: MouseEvent<HTMLElement>) => void }) {
  return <div className="min-w-0 space-y-6">
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Panel de Control</p>
      <h2 className="truncate text-3xl font-black uppercase italic leading-none tracking-tighter sm:text-4xl">Configuración</h2>
      <p className="text-sm text-muted-foreground">Personaliza únicamente la experiencia de la vista Manager.</p>
    </div>
    <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
      <div className="space-y-6">
        <section className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h3 className="text-lg font-black uppercase italic tracking-tight">Modo de color</h3><p className="mt-1 text-sm text-muted-foreground">Cambia entre claro y oscuro con la misma transición de las sucursales.</p></div>
            <Button type="button" variant="outline" className="w-full shrink-0 rounded-xl sm:w-auto" onClick={onToggleTheme}>{theme.mode === 'dark' ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}{theme.mode === 'dark' ? 'Usar modo claro' : 'Usar modo oscuro'}</Button>
          </div>
        </section>
        <section className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm sm:p-6">
          <div><h3 className="text-lg font-black uppercase italic tracking-tight">Tema de la vista Manager</h3><p className="mt-1 text-sm text-muted-foreground">Selecciona el acento visual del panel y su sidebar.</p></div>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Object.entries(MANAGER_THEME_PRESETS).map(([id, preset]) => <button key={id} type="button" onClick={() => onPresetChange(id as ManagerThemeState['preset'])} className={cn('flex min-w-0 items-center gap-3 rounded-2xl border p-4 text-left transition-colors', theme.preset === id ? 'border-primary bg-primary/10' : 'border-border/60 hover:border-primary/50')}>
              <span className="size-10 shrink-0 rounded-xl shadow-inner" style={{ background: preset.primary }} />
              <span className="min-w-0 flex-1"><span className="block text-sm font-black">{preset.label}</span><span className="mt-1 block text-xs text-muted-foreground">Acento y navegación Manager</span></span>
              {theme.preset === id && <span className="shrink-0 text-sm font-black text-primary">✓</span>}
            </button>)}
          </div>
        </section>
      </div>
      <aside className="h-fit rounded-3xl border border-primary/20 bg-primary/5 p-5 sm:p-6"><div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Settings2 className="size-5" /></div><h3 className="mt-4 text-lg font-black uppercase italic tracking-tight">Alcance de esta configuración</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Estos ajustes se guardan para la consola Manager y no modifican la apariencia de las sucursales ni la personalización del portal de clientes.</p><div className="mt-5 rounded-2xl border border-border/60 bg-background/70 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado actual</p><p className="mt-2 text-sm font-bold">{theme.mode === 'dark' ? 'Modo oscuro' : 'Modo claro'} · {MANAGER_THEME_PRESETS[theme.preset].label}</p></div></aside>
    </div>
  </div>;
}
