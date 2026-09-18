import { useState, type FormEvent } from 'react';
import { KeyRound, Loader2, Mail, Plus, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { enterpriseGroupsService } from '../../services/enterprise-groups.service';

const PLATFORM_PERMISSION_OPTIONS = [{ value: 'PLATFORM_QUOTES', label: 'Cotizaciones' }];
const PASSWORD_MESSAGE = 'Mínimo 8 caracteres, una mayúscula, un número y un carácter especial.';

export function PlatformUsersView() {
  const usersQuery = useTenantQuery(['platform-users'], (signal) => enterpriseGroupsService.getPlatformUsers(signal));
  const [form, setForm] = useState({ name: '', email: '', password: '', platformPermissions: ['PLATFORM_QUOTES'] });
  const [saving, setSaving] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const validPassword = form.password.length >= 8 && /[A-Z]/.test(form.password) && /[0-9]/.test(form.password) && /[^a-zA-Z0-9\s]/.test(form.password);

  const createUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !validPassword) {
      toast.error(!validPassword ? PASSWORD_MESSAGE : 'Completa nombre y correo.');
      return;
    }
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
      await usersQuery.refetch();
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo crear el usuario.');
    } finally {
      setSaving(false);
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
                <label className="min-w-0 space-y-1 text-xs font-bold text-muted-foreground">Correo único<input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} className="mt-1 h-11 w-full max-w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="usuario@empresa.com" /></label>
                <label className="min-w-0 space-y-1 text-xs font-bold text-muted-foreground">Contraseña<input type="password" value={form.password} onChange={(event) => update('password', event.target.value)} className="mt-1 h-11 w-full max-w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" placeholder="••••••••" aria-describedby="platform-password-help" /></label>
                <label className="min-w-0 space-y-1 text-xs font-bold text-muted-foreground">Permiso<select value={form.platformPermissions[0] || ''} onChange={(event) => setForm((current) => ({ ...current, platformPermissions: event.target.value ? [event.target.value] : [] }))} className="mt-1 h-11 w-full max-w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"><option value="">Selecciona un permiso</option>{PLATFORM_PERMISSION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                <Button type="submit" disabled={saving || !form.platformPermissions.length} className="h-11 rounded-xl px-5 md:col-span-2 xl:col-span-1"><Plus className="mr-2 size-4" /> {saving ? 'Creando…' : 'Crear usuario'}</Button>
              </form>
              <p id="platform-password-help" className="mt-3 text-xs text-muted-foreground">{PASSWORD_MESSAGE}</p>
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden rounded-3xl border-border/60 shadow-sm">
            <CardHeader className="p-5 pb-3 sm:p-6"><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><Users className="size-5 text-primary" /> Accesos creados</CardTitle></CardHeader>
            <CardContent className="p-0">
              {usersQuery.isLoading ? <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div> : usersQuery.isError ? <div className="p-8 text-center text-sm text-destructive">No se pudieron cargar los usuarios. {usersQuery.error?.message || ''}</div> : !usersQuery.data?.length ? <div className="p-10 text-center text-sm text-muted-foreground">Todavía no hay usuarios con acceso de plataforma.</div> : <div className="grid min-w-0 gap-3 p-4 sm:p-6 lg:grid-cols-2">{usersQuery.data.map((platformUser) => <div key={platformUser.id} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border/60 bg-muted/[0.08] p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="flex min-w-0 items-center gap-2 font-bold"><span className="truncate">{platformUser.name}</span><Badge variant={platformUser.isActive ? 'outline' : 'destructive'} className="shrink-0 text-[10px]">{platformUser.isActive ? 'Activo' : 'Inactivo'}</Badge></p><p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground"><Mail className="size-3.5 shrink-0" /> {platformUser.email}</p></div><div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline" className="gap-1"><KeyRound className="size-3" /> {platformUser.platformPermissions.map((permission) => permission === 'PLATFORM_QUOTES' ? 'Cotizaciones' : permission).join(', ')}</Badge></div></div>)}</div>}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
