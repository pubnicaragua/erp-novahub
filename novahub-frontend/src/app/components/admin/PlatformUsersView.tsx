import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, Mail, Plus, ShieldCheck, UserCheck, UserPlus, Users, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { authService } from '../../services/auth.service';
import { enterpriseGroupsService } from '../../services/enterprise-groups.service';

const PLATFORM_PERMISSION_OPTIONS = [{ value: 'PLATFORM_QUOTES', label: 'Cotizaciones' }];
const PASSWORD_MESSAGE = 'Mínimo 8 caracteres, una mayúscula, un número y un carácter especial.';

export function PlatformUsersView() {
  const usersQuery = useTenantQuery(['platform-users'], (signal) => enterpriseGroupsService.getPlatformUsers(signal));
  const [form, setForm] = useState({ name: '', email: '', password: '', platformPermissions: ['PLATFORM_QUOTES'] });
  const [saving, setSaving] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const validPassword = form.password.length >= 8 && /[A-Z]/.test(form.password) && /[0-9]/.test(form.password) && /[^a-zA-Z0-9\s]/.test(form.password);

  const validateEmail = async () => {
    const email = form.email.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setEmailError('Escribe un correo válido.');
      return false;
    }
    setCheckingEmail(true);
    try {
      const response: any = await authService.checkEmail(email);
      const exists = Boolean(response?.data?.exists ?? response?.exists);
      const message = exists ? 'Este correo ya está en uso en el sistema. Escribe otro.' : '';
      setEmailError(message);
      return !exists;
    } catch {
      setEmailError('No se pudo verificar el correo. Intenta nuevamente.');
      return false;
    } finally {
      setCheckingEmail(false);
    }
  };

  const createUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !validPassword) {
      toast.error(!validPassword ? PASSWORD_MESSAGE : 'Completa nombre y correo.');
      return;
    }
    if (!(await validateEmail())) return;
    setSaving(true);
    try {
      await enterpriseGroupsService.createPlatformUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        platformPermissions: form.platformPermissions,
      });
      toast.success('Usuario de plataforma creado.');
      setForm({ name: '', email: '', password: '', platformPermissions: ['PLATFORM_QUOTES'] });
      setShowPassword(false);
      await usersQuery.refetch();
    } catch (error: any) {
      if (error?.status === 409 || /correo/i.test(String(error?.message || ''))) setEmailError(error?.message || 'Este correo ya está en uso en el sistema. Escribe otro.');
      toast.error(error?.message || 'No se pudo crear el usuario.');
    } finally {
      setSaving(false);
    }
  };

  const toggleUser = async (platformUser: { id: string; name: string; isActive: boolean }) => {
    const nextIsActive = !platformUser.isActive;
    if (typeof window !== 'undefined' && !window.confirm(`${nextIsActive ? '¿Habilitar' : '¿Inhabilitar'} a ${platformUser.name}?`)) return;
    setTogglingUserId(platformUser.id);
    try {
      await enterpriseGroupsService.updatePlatformUserStatus(platformUser.id, nextIsActive);
      toast.success(nextIsActive ? 'Usuario habilitado.' : 'Usuario inhabilitado.');
      await usersQuery.refetch();
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo actualizar el estado del usuario.');
    } finally {
      setTogglingUserId(null);
    }
  };

  return (
    <div className="master-console-module min-w-0 max-w-full overflow-x-hidden bg-background">
      <div className="mx-auto min-h-[calc(100vh-5rem)] w-full max-w-[1700px] min-w-0 p-4 sm:p-6 md:px-10 md:pb-10 md:pt-4">
        <section className="space-y-6">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-primary"><ShieldCheck className="size-3.5" /> NovaHub Platform</p>
              <h1 className="mt-2 break-words text-2xl font-black uppercase italic tracking-tight sm:text-3xl">Usuarios de plataforma</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Crea accesos restringidos para colaboradores de Superadmin. El permiso se mantiene como selector para agregar más capacidades después.</p>
            </div>
            <Badge variant="outline" className="w-fit shrink-0 rounded-lg px-3 py-1.5"><Users className="mr-1.5 size-3.5 text-primary" /> {usersQuery.data?.length || 0} usuarios</Badge>
          </div>

          <Card className="rounded-3xl border-primary/20 bg-primary/[0.03] shadow-sm">
            <CardHeader className="p-5 pb-3 sm:p-6"><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><UserPlus className="size-5 text-primary" /> Agregar usuario</CardTitle></CardHeader>
            <CardContent className="p-5 pt-2 sm:p-6 sm:pt-2">
              <form className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_220px_auto] xl:items-end" onSubmit={createUser}>
                <label className="min-w-0 space-y-1 text-xs font-bold text-muted-foreground">Nombre<input value={form.name} onChange={(event) => update('name', event.target.value)} className="mt-1 h-11 w-full max-w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="Nombre completo" /></label>
                <label className="relative min-w-0 space-y-1 text-xs font-bold text-muted-foreground">Correo único<input type="email" value={form.email} onChange={(event) => { update('email', event.target.value); if (emailError) setEmailError(''); }} onBlur={() => void validateEmail()} aria-invalid={Boolean(emailError)} aria-describedby="platform-email-help" className={`mt-1 h-11 w-full max-w-full rounded-xl border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${emailError ? 'border-destructive' : 'border-border'}`} placeholder="usuario@empresa.com" />{emailError ? <span id="platform-email-help" className="text-xs font-semibold text-destructive xl:absolute xl:left-0 xl:top-full xl:mt-1">{emailError}</span> : <span id="platform-email-help" className="text-[11px] font-normal text-muted-foreground xl:absolute xl:left-0 xl:top-full xl:mt-1">Se valida contra todos los usuarios del sistema.</span>}</label>
                <label className="relative min-w-0 space-y-1 text-xs font-bold text-muted-foreground">Contraseña<div className="relative mt-1"><input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => update('password', event.target.value)} className="h-11 w-full max-w-full rounded-xl border border-border bg-background px-3 pr-10 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="••••••••" title={PASSWORD_MESSAGE} aria-describedby="platform-password-help" /><button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div><span id="platform-password-help" className="text-[11px] font-normal text-muted-foreground xl:absolute xl:left-0 xl:top-full xl:mt-1">{PASSWORD_MESSAGE}</span></label>
                <label className="min-w-0 space-y-1 text-xs font-bold text-muted-foreground">Permiso<select value={form.platformPermissions[0] || ''} onChange={(event) => setForm((current) => ({ ...current, platformPermissions: event.target.value ? [event.target.value] : [] }))} className="mt-1 h-11 w-full max-w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"><option value="">Selecciona un permiso</option>{PLATFORM_PERMISSION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <Button type="submit" disabled={saving || checkingEmail || !form.platformPermissions.length} className="h-11 rounded-xl px-5 md:col-span-2 xl:col-span-1"><Plus className="mr-2 size-4" /> {checkingEmail ? 'Validando correo…' : saving ? 'Creando…' : 'Crear usuario'}</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="min-w-0 gap-0 overflow-hidden rounded-3xl border-border/60 shadow-sm">
            <CardHeader className="p-5 pb-2 sm:p-6 sm:pb-3"><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><Users className="size-5 text-primary" /> Accesos creados</CardTitle></CardHeader>
            <CardContent className="p-0">
              {usersQuery.isLoading ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div> : usersQuery.isError ? <div className="p-8 text-center text-sm text-destructive">No se pudieron cargar los usuarios. {usersQuery.error?.message || ''}</div> : !usersQuery.data?.length ? <div className="p-10 text-center text-sm text-muted-foreground">Todavía no hay usuarios con acceso de plataforma.</div> : <div className="grid min-w-0 gap-3 p-4 pt-2 sm:p-6 sm:pt-2 lg:grid-cols-2">{usersQuery.data.map((platformUser) => <div key={platformUser.id} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border/60 bg-muted/[0.08] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="flex min-w-0 items-center gap-2 font-bold"><span className="truncate">{platformUser.name}</span><Badge variant={platformUser.isActive ? 'outline' : 'destructive'} className="shrink-0 text-[10px]">{platformUser.isActive ? 'Activo' : 'Inactivo'}</Badge></p><p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground"><Mail className="size-3.5 shrink-0" /> {platformUser.email}</p></div><div className="flex min-w-0 flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground"><Badge variant="outline" className="gap-1"><KeyRound className="size-3" /> {platformUser.platformPermissions.map((permission) => permission === 'PLATFORM_QUOTES' ? 'Cotizaciones' : permission).join(', ')}</Badge><Button type="button" variant="outline" size="sm" disabled={togglingUserId === platformUser.id} onClick={() => void toggleUser(platformUser)} title={platformUser.isActive ? 'Inhabilitar usuario' : 'Habilitar usuario'} aria-label={platformUser.isActive ? `Inhabilitar a ${platformUser.name}` : `Habilitar a ${platformUser.name}`} className="h-8 shrink-0 gap-1.5 rounded-lg px-2.5 text-xs">{platformUser.isActive ? <UserX className="size-3.5 text-destructive" /> : <UserCheck className="size-3.5 text-primary" />}<span className="hidden sm:inline">{platformUser.isActive ? 'Inhabilitar' : 'Habilitar'}</span></Button></div></div>)}</div>}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
