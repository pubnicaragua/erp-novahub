import React, { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  Search,
  Bell,
  Menu,
  LogOut,
  User,
  Settings as SettingsIcon,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Globe,
  Wallet,
  Building2,
  Euro,
  CircleDollarSign
} from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { useAuth, type Module } from '../contexts/AuthContext';
import { useNotifications } from '../hooks/useNotifications';
import { useCurrency } from '../contexts/CurrencyContext';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { ScrollArea } from './ui/scroll-area';
import { cn } from './ui/utils';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { usersService } from '../services/users.service';
import { Lock } from 'lucide-react';
import { TrialCountdownBanner } from './auth/TrialCountdownBanner';

interface TopbarProps {
  onMenuClick: () => void;
  onNavigate: (module: Module) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'info' | 'warning' | 'success';
}

interface ThemeViewTransition {
  finished: Promise<void>;
  skipTransition?: () => void;
}

type ThemeTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => ThemeViewTransition;
};

let activeThemeTransition: ThemeViewTransition | null = null;
let requestedDarkMode: boolean | null = null;
let themeChangeVersion = 0;

function getSavedDarkMode() {
  return localStorage.getItem('erp-theme-mode') !== 'light';
}

export function Topbar({ onMenuClick, onNavigate, isCollapsed, onToggleCollapse }: TopbarProps) {
  const { user, logout } = useAuth();
  const { unreadCount, markAllAsRead, notifications } = useNotifications();
  const [searchQuery, setSearchQuery] = useState('');

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (!user?.id) return;

    try {
      setIsUpdatingPassword(true);
      await usersService.changePassword(user.id, newPassword);
      toast.success('Contraseña actualizada exitosamente');
      setShowPasswordModal(false);
      setNewPassword('');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al actualizar la contraseña');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleLogout = () => {
    logout();
    // En producción: redirect to login
  };

  const handleSettings = () => {
    onNavigate('configuracion');
  };

  const [isDark, setIsDark] = useState(getSavedDarkMode);

  useEffect(() => {
    const root = document.documentElement;
    const syncFromRoot = () => setIsDark(root.classList.contains('dark'));
    const observer = new MutationObserver(syncFromRoot);

    const syncFromStorage = (event: StorageEvent) => {
      if (event.key !== 'erp-theme-mode') return;
      const nextDark = event.newValue !== 'light';
      root.classList.toggle('dark', nextDark);
      setIsDark(nextDark);
    };

    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('storage', syncFromStorage);

    return () => {
      observer.disconnect();
      window.removeEventListener('storage', syncFromStorage);
    };
  }, []);

  const toggleTheme = (event: React.MouseEvent<HTMLButtonElement>) => {
    const root = document.documentElement;
    const transitionDocument = document as ThemeTransitionDocument;
    // La clase del DOM es la fuente de verdad; así cada clic funciona aunque
    // React tenga una actualización pendiente o el tema cambie desde otra pestaña.
    const nextDark = !(requestedDarkMode ?? root.classList.contains('dark'));
    const requestVersion = ++themeChangeVersion;
    requestedDarkMode = nextDark;

    const applyTheme = () => {
      // Un callback de View Transitions puede ejecutarse después de un segundo
      // clic. Si ya existe una intención más reciente, no debe sobrescribirla.
      if (requestVersion !== themeChangeVersion) return;
      root.classList.toggle('dark', nextDark);
      localStorage.setItem('erp-theme-mode', nextDark ? 'dark' : 'light');
      flushSync(() => setIsDark(nextDark));
      requestedDarkMode = null;
    };

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!transitionDocument.startViewTransition || reduceMotion) {
      applyTheme();
      return;
    }

    // Un segundo clic no espera a que termine la esfera: cancela solo el efecto
    // visual anterior y aplica la nueva intención inmediatamente.
    if (activeThemeTransition) {
      const previousTransition = activeThemeTransition;
      activeThemeTransition = null;
      delete root.dataset.themeTransition;
      previousTransition.skipTransition?.();
      applyTheme();
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2;
    const y = bounds.top + bounds.height / 2;
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    root.style.setProperty('--theme-transition-x', `${x}px`);
    root.style.setProperty('--theme-transition-y', `${y}px`);
    root.style.setProperty('--theme-transition-radius', `${Math.ceil(radius)}px`);
    root.dataset.themeTransition = 'active';

    try {
      const transition = transitionDocument.startViewTransition(applyTheme);
      activeThemeTransition = transition;
      void transition.finished
        .catch(() => undefined)
        .finally(() => {
          if (activeThemeTransition === transition) {
            activeThemeTransition = null;
            delete root.dataset.themeTransition;
          }
        });
    } catch {
      activeThemeTransition = null;
      delete root.dataset.themeTransition;
      applyTheme();
    }
  };

  const { currency, toggleCurrency, currencyInteractionEnabled } = useCurrency();

  const getRoleBadge = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'superadmin': return <Badge className="bg-primary/10 text-primary border-primary/20 px-1 py-0 text-[10px]">SuperAdmin</Badge>;
      case 'partner': return <Badge className="bg-primary/10 text-primary border-primary/20 px-1 py-0 text-[10px]">Partner</Badge>;
      case 'admin': return <Badge className="bg-primary/10 text-primary border-primary/20 px-1 py-0 text-[10px]">Administrador</Badge>;
      default: return <Badge variant="outline" className="px-1 py-0 text-[10px] capitalize">{role}</Badge>;
    }
  };

  return (
    <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <TrialCountdownBanner />
      <header className="flex h-16 items-center gap-4 border-b border-border bg-background/95 px-4 lg:px-6" >
      {/* Menu Toggle (Mobile) */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className="lg:hidden shrink-0"
        aria-label="Abrir menú"
      >
        <Menu className="size-5" />
      </Button>

      {/* Menu Toggle (Desktop) */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleCollapse}
        className="hidden lg:flex shrink-0 text-muted-foreground mr-2"
        aria-label="Contraer/Expandir menú"
      >
        {isCollapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
      </Button>

      {/* Search */}
      <div className="flex-1 flex items-center gap-4">
        {/* Tenancy Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/30 border border-border/50">
          <Building2 className="size-3.5 text-primary" />
          <span className="text-xs font-medium truncate max-w-[120px]">{user?.tenantName || 'Nova Hub'}</span>
          {getRoleBadge(user?.role || '')}
        </div>

        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 h-9 bg-muted/20 border-border/40 focus:bg-background"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-4 ml-auto shrink-0">
        {/* Currency Switcher */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={toggleCurrency} 
          className="h-9 gap-2 px-3 border-border bg-card hover:bg-muted disabled:opacity-60 disabled:cursor-not-allowed"
          title={currencyInteractionEnabled ? 'Cambiar Moneda' : 'Cambio de moneda bloqueado por configuración'}
          disabled={!currencyInteractionEnabled}
        >
          {currency === 'USD' ? <CircleDollarSign className="size-4 text-emerald-500" /> : <Wallet className="size-4 text-orange-500" />}
          <span className="text-xs font-bold">{currency}</span>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-9 w-9"
          aria-label={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          title={isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        >
          {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </Button>

        {/* Notifications */}
        <DropdownMenu onOpenChange={(open) => { if (!open && unreadCount > 0) markAllAsRead() }}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
              <Bell className="size-5" />
              {unreadCount > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 justify-center rounded-full p-0 text-[10px]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex justify-between items-center">
              <span>Notificaciones</span>
              <span className="text-xs text-muted-foreground font-normal cursor-pointer hover:underline" onClick={() => onNavigate('notificaciones')}>Ver todas</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="flex flex-col gap-1 p-2 max-h-[300px] overflow-y-auto">
              {unreadCount > 0 ? (
                notifications.filter(n => !n.read).slice(0, 5).map((n) => (
                  <DropdownMenuItem 
                    key={n.id} 
                    className="flex flex-col items-start gap-1 p-3 cursor-pointer border-b border-border/50 last:border-0" 
                    onClick={() => {
                      if (n.message?.startsWith('TAREA:')) {
                        onNavigate('actividades');
                        window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module: 'actividades', subModule: 'tareas' }}));
                      } else if (n.message?.startsWith('RECORDATORIO:')) {
                        onNavigate('actividades');
                        window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module: 'actividades', subModule: 'recordatorios' }}));
                      } else {
                        onNavigate('notificaciones');
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                       <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                       <span className="font-medium text-sm line-clamp-1">{n.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground ml-4 line-clamp-2">
                      {n.message?.startsWith('TAREA:') ? n.message.split(':').slice(2).join(':') : 
                       n.message?.startsWith('RECORDATORIO:') ? n.message.split(':').slice(2).join(':') : 
                       n.message}
                    </span>
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem className="py-2 justify-center text-sm text-muted-foreground" onClick={() => onNavigate('notificaciones')}>
                  Sin notificaciones nuevas.
                </DropdownMenuItem>
              )}
              {unreadCount > 5 && (
                 <DropdownMenuItem className="py-2 justify-center text-xs text-primary font-medium" onClick={() => onNavigate('notificaciones')}>
                    Ver {unreadCount - 5} más
                 </DropdownMenuItem>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-3 px-2 ml-2 hover:bg-transparent focus-visible:ring-0" aria-label="Menú de usuario">
              <Avatar className="size-9 rounded-full border-2 border-primary/30">
                <AvatarImage src={user?.avatar} alt={user?.name} className="object-cover" />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {user?.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden flex-col items-start text-left lg:flex leading-tight">
                <span className="font-semibold text-[14px] text-foreground">{user?.name}</span>
                <span className="text-[12px] text-primary/80 font-medium capitalize">
                  {user?.role}
                </span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onNavigate('configuracion')}>
              <User className="mr-2 size-4 text-primary" />
              <span>Mi Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSettings}>
              <SettingsIcon className="mr-2 size-4 text-primary" />
              <span>Configuración</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowPasswordModal(true)}>
              <Lock className="mr-2 size-4 text-primary" />
              <span>Cambiar Contraseña</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-500/10 transition-colors">
              <LogOut className="mr-2 size-4 text-rose-500" />
              <span>Cerrar Sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="size-5 text-primary" /> Cambiar Contraseña</DialogTitle>
            <DialogDescription>
              Ingresa la nueva contraseña para tu cuenta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nueva Contraseña</Label>
              <Input 
                type="password" 
                placeholder="Mínimo 6 caracteres" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordModal(false)} disabled={isUpdatingPassword}>Cancelar</Button>
            <Button onClick={handleChangePassword} disabled={isUpdatingPassword} className="bg-primary text-primary-foreground">
              {isUpdatingPassword ? 'Guardando...' : 'Guardar Contraseña'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
    </div>
  );
}
