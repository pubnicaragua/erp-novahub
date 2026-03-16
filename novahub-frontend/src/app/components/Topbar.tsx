import React, { useState } from 'react';
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
export function Topbar({ onMenuClick, onNavigate, isCollapsed, onToggleCollapse }: TopbarProps) {
  const { user, logout } = useAuth();
  const { unreadCount, markAllAsRead, notifications } = useNotifications();
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = () => {
    logout();
    // En producción: redirect to login
  };

  const handleSettings = () => {
    onNavigate('configuracion');
  };

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggleTheme = () => {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('erp-theme-mode', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('erp-theme-mode', 'light');
    }
  };

  const { currency, toggleCurrency } = useCurrency();

  const getRoleBadge = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'superadmin': return <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20 px-1 py-0 text-[10px]">SuperAdmin</Badge>;
      case 'partner': return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 px-1 py-0 text-[10px]">Partner</Badge>;
      case 'admin': return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-1 py-0 text-[10px]">Administrador</Badge>;
      default: return <Badge variant="outline" className="px-1 py-0 text-[10px] capitalize">{role}</Badge>;
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6" >
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
          className="h-9 gap-2 px-3 border-border/50 bg-muted/10 hover:bg-muted/20 hover:text-foreground"
          title="Cambiar Moneda"
        >
          {currency === 'USD' ? <CircleDollarSign className="size-4 text-emerald-500" /> : <Wallet className="size-4 text-orange-500" />}
          <span className="text-xs font-bold">{currency}</span>
        </Button>

        <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9" aria-label="Cambiar tema">
          {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </Button>

        {/* Notifications */}
        <DropdownMenu onOpenChange={(open) => { if (!open && unreadCount > 0) markAllAsRead() }}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:bg-primary/10 hover:text-primary">
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
              <DropdownMenuItem className="flex flex-col items-start gap-1 p-3 cursor-pointer" onClick={() => onNavigate('notificaciones')}>
                {unreadCount > 0 ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      <span className="font-medium text-sm">Tienes {unreadCount} {unreadCount === 1 ? 'notificación nueva' : 'notificaciones nuevas'}</span>
                    </div>
                    <span className="text-xs text-muted-foreground ml-4">Despliega el centro de notificaciones para revisar.</span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground py-2 text-center w-full">Sin notificaciones nuevas.</span>
                )}
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-3 px-2 ml-2 hover:bg-transparent focus-visible:ring-0" aria-label="Menú de usuario">
              <Avatar className="size-9 rounded-full border border-border">
                <AvatarImage src={user?.avatar} alt={user?.name} className="object-cover" />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {user?.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden flex-col items-start text-left lg:flex leading-tight">
                <span className="font-semibold text-[14px] text-foreground">{user?.name}</span>
                <span className="text-[12px] text-muted-foreground capitalize">
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
              <User className="mr-2 size-4" />
              <span>Mi Perfil</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSettings}>
              <SettingsIcon className="mr-2 size-4" />
              <span>Configuración</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 size-4" />
              <span>Cerrar Sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header >
  );
}
