import { useEffect, useState, type ChangeEvent } from 'react';
import { Eye, Loader2, Pencil, Save, Users } from 'lucide-react';
import { toast } from '@/app/services/toast';
import { tenantsService } from '../../services/tenants.service';
import { storageService } from '../../services/storage.service';
import { getPasswordError, isValidEmail } from '../../utils/accountValidation';
import { BUSINESS_TYPE_OPTIONS, getBusinessTypeOption } from '../../constants/businessTypes';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { BrandLogo } from '../BrandLogo';
import { PasswordRequirements } from '../PasswordRequirements';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

const safeTrim = (value: unknown) => String(value ?? '').trim();

type BranchSupportDialogProps = {
  branch: any;
  onChanged?: () => void;
  initialTab?: 'summary' | 'users';
  triggerLabel?: string;
};

function getBranchUserIdentityLabel(user: any) {
  const role = String(user?.role || '').toUpperCase();
  const userType = String(user?.userType || '').toUpperCase();
  if (role === 'ADMIN' && userType === 'ADMIN') return 'ADMINISTRADOR DE SUCURSAL';
  if (role === 'SUPER_ADMIN') return 'SUPER ADMIN';
  if (role === 'EMPLOYEE' && userType === 'COLLABORATOR') return 'COLABORADOR';
  return `REVISAR IDENTIDAD · ${role || 'SIN ROL'}${userType ? ` / ${userType}` : ''}`;
}

export function GroupBranchSupportDialog({ branch, onChanged, initialTab = 'summary', triggerLabel = 'Administrar' }: BranchSupportDialogProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'summary' | 'users'>(initialTab);
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsForm, setDetailsForm] = useState({ name: branch.name || '', slug: branch.slug || '', logo: branch.logo || '', industry: branch.industry || 'OTHER', subIndustry: branch.subIndustry || 'OTHER', businessType: getBusinessTypeOption(undefined, branch.industry, branch.subIndustry).key });
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '' });
  const [userFormError, setUserFormError] = useState('');
  const [savingUser, setSavingUser] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([tenantsService.getOne(branch.id), tenantsService.getUsers(branch.id)])
      .then(([tenant, tenantUsers]) => {
        if (cancelled) return;
        setDetails(tenant);
        setUsers(Array.isArray(tenantUsers) ? tenantUsers : []);
        setDetailsForm({
          name: tenant?.name || branch.name || '',
          slug: tenant?.slug || branch.slug || '',
          logo: tenant?.logo || branch.logo || '',
          industry: tenant?.industry || branch.industry || 'OTHER',
          subIndustry: tenant?.subIndustry || branch.subIndustry || 'OTHER',
          businessType: getBusinessTypeOption(undefined, tenant?.industry || branch.industry, tenant?.subIndustry || branch.subIndustry).key,
        });
      })
      .catch((error: any) => toast.error(error?.message || 'No se pudo cargar el detalle de la sucursal'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, branch.id, branch.industry, branch.logo, branch.name, branch.slug]);

  const handleLogoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const inferredMime = extension === 'jpg' || extension === 'jpeg'
      ? 'image/jpeg'
      : extension === 'png'
        ? 'image/png'
        : extension === 'webp'
          ? 'image/webp'
          : extension === 'gif'
            ? 'image/gif'
            : extension === 'avif'
              ? 'image/avif'
              : file.type;
    const allowedMimeTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);
    if (!allowedMimeTypes.has(inferredMime)) {
      toast.error('Usa un logo PNG, JPG, WEBP, GIF o AVIF');
      return;
    }
    try {
      const normalizedFile = file.type === inferredMime
        ? file
        : new File([file], file.name, { type: inferredMime });
      const uploaded = await storageService.uploadFile('tenant-branding', normalizedFile, {
        folder: 'branches',
        scopeId: branch.id,
      });
      setDetailsForm((current) => ({ ...current, logo: uploaded.url }));
      toast.success('Logo cargado en el almacenamiento');
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo cargar el logo');
    } finally {
      event.currentTarget.value = '';
    }
  };

  const saveDetails = async () => {
    if (!safeTrim(detailsForm.name) || !safeTrim(detailsForm.slug)) {
      toast.error('El nombre y el slug son obligatorios');
      return;
    }
    try {
      setSavingDetails(true);
      const updated = await tenantsService.update(branch.id, {
        name: detailsForm.name.trim(),
        slug: detailsForm.slug.trim(),
        logo: detailsForm.logo || null,
        industry: detailsForm.industry,
        subIndustry: detailsForm.subIndustry,
      });
      setDetails((current: any) => ({ ...current, ...updated, ...detailsForm }));
      toast.success('Sucursal actualizada correctamente');
      onChanged?.();
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo actualizar la sucursal');
    } finally {
      setSavingDetails(false);
    }
  };

  const openUserEditor = (user: any) => {
    setEditingUser(user);
    setUserForm({ name: user?.name || '', email: user?.email || '', password: '' });
    setUserFormError('');
  };

  const closeUserEditor = () => {
    if (savingUser) return;
    setEditingUser(null);
    setUserForm({ name: '', email: '', password: '' });
    setUserFormError('');
  };

  const saveUser = async () => {
    const name = safeTrim(userForm.name);
    const email = safeTrim(userForm.email).toLowerCase();
    const password = userForm.password;
    const passwordError = getPasswordError(password, false);
    if (!editingUser?.id || !name || !isValidEmail(email) || passwordError) {
      setUserFormError(passwordError || (!name ? 'Escribe el nombre completo.' : 'Escribe un correo válido.'));
      return;
    }
    try {
      setSavingUser(true);
      setUserFormError('');
      const updated = await tenantsService.updateUser(branch.id, editingUser.id, {
        name,
        email,
        ...(password ? { password } : {}),
      });
      setUsers((current) => current.map((user) => user.id === editingUser.id
        ? { ...user, ...updated, name: updated?.name || name, email: updated?.email || email }
        : user));
      toast.success('Usuario actualizado correctamente');
      setEditingUser(null);
      setUserForm({ name: '', email: '', password: '' });
      await onChanged?.();
    } catch (error: any) {
      const message = error?.message || 'No se pudo actualizar el usuario';
      setUserFormError(message);
      toast.error(message);
    } finally {
      setSavingUser(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="h-9 shrink-0 rounded-lg px-2.5" onClick={() => { setTab(initialTab); setOpen(true); }} aria-label={`${triggerLabel} de ${branch.name}`}>
        <Eye className="size-3.5" />
        <span>{triggerLabel}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="h-auto w-[calc(100vw-2rem)] !max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:w-[min(94vw,760px)] sm:!max-w-[760px] sm:p-7">
          <DialogHeader>
            <DialogTitle className="flex min-w-0 items-start gap-2 break-words font-black uppercase italic tracking-tight">
              <Users className="mt-0.5 size-5 shrink-0 text-primary" /> <span className="min-w-0 break-words">Soporte de {branch.name}</span>
            </DialogTitle>
            <DialogDescription>
              Consulta y administra la sucursal sin salir del grupo empresarial.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2 border-b border-border/60 pb-3">
            <Button variant={tab === 'summary' ? 'default' : 'outline'} className="rounded-xl" onClick={() => setTab('summary')}>
              <Pencil className="size-4" /> Detalles
            </Button>
            <Button variant={tab === 'users' ? 'default' : 'outline'} className="rounded-xl" onClick={() => setTab('users')}>
              <Users className="size-4" /> Usuarios ({users.length})
            </Button>
          </div>

          {loading ? (
            <div className="flex min-h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 size-5 animate-spin" /> Cargando información…
            </div>
          ) : tab === 'summary' ? (
            <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
              <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="branch-support-name" required className="text-xs font-bold text-muted-foreground">Nombre de la sucursal</Label>
                  <input id="branch-support-name" required value={detailsForm.name} onChange={(event) => setDetailsForm((current) => ({ ...current, name: event.target.value }))} className="h-11 min-w-0 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" />
                </div>
                <div className="space-y-2"><Label htmlFor="branch-support-slug" required className="text-xs font-bold text-muted-foreground">Slug de la sucursal</Label>
                  <input id="branch-support-slug" required value={detailsForm.slug} onChange={(event) => setDetailsForm((current) => ({ ...current, slug: event.target.value }))} className="h-11 min-w-0 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" />
                </div>
                <label className="space-y-2 text-xs font-bold text-muted-foreground sm:col-span-2">
                  Tipo de negocio
                  <select value={detailsForm.businessType} onChange={(event) => { const selected = BUSINESS_TYPE_OPTIONS.find((option) => option.key === event.target.value) || BUSINESS_TYPE_OPTIONS[BUSINESS_TYPE_OPTIONS.length - 1]; setDetailsForm((current) => ({ ...current, businessType: selected.key, industry: selected.industry, subIndustry: selected.subIndustry })); }} className="h-11 min-w-0 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground">
                    {BUSINESS_TYPE_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                  </select>
                </label>
                <div className="space-y-2 sm:col-span-2">
                  <p className="text-xs font-bold text-muted-foreground">Logo de la sucursal</p>
                  <label className="flex min-h-28 cursor-pointer items-center gap-4 rounded-2xl border border-dashed border-primary/35 bg-primary/[0.03] p-3 transition hover:border-primary hover:bg-primary/[0.07]">
                    <BrandLogo src={detailsForm.logo} alt={`Logo de ${detailsForm.name || 'la sucursal'}`} kind="branch" className="size-20 rounded-xl border border-border/60 bg-background ring-0" imageClassName="rounded-xl p-2" />
                    <span className="text-xs font-semibold text-muted-foreground">Cargar o reemplazar logo propio de esta sucursal</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" className="hidden" onChange={handleLogoChange} />
                  </label>
                  <p className="text-[11px] text-muted-foreground">No hereda automáticamente el logo del grupo empresarial.</p>
                </div>
              </div>
              <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado operativo</p>
                <div className="flex items-center justify-between gap-3 text-sm"><span>Estado</span><Badge variant={details?.isActive ? 'default' : 'secondary'}>{details?.isActive ? 'Activa' : 'Inactiva'}</Badge></div>
                <div className="flex items-center justify-between gap-3 text-sm"><span>Plan</span><span className="font-bold">{details?.plan || '—'}</span></div>
                <div className="flex items-center justify-between gap-3 text-sm"><span>Usuarios</span><span className="font-bold">{details?._count?.users ?? users.length}</span></div>
                <div className="flex items-center justify-between gap-3 text-sm"><span>Módulos activos</span><span className="font-bold">{details?.subscriptions?.filter((item: any) => item.isActive).length ?? 0}</span></div>
              </div>
            </div>
          ) : (
            <div className="max-h-[min(60vh,38rem)] space-y-2 overflow-y-auto pr-1">
              {!users.length && <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No hay usuarios registrados en esta sucursal.</p>}
              {users.map((item: any) => (
                <div key={item.id} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border/60 bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-bold">{item.name}</p>
                    <p className="break-all text-xs text-muted-foreground">{item.email}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-primary">{getBranchUserIdentityLabel(item)}</p>
                  </div>
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0">
                    <Button variant="outline" className="w-full rounded-xl sm:w-auto" onClick={() => openUserEditor(item)}>
                      <Pencil className="size-4" /> Editar usuario
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2">
            {tab === 'summary' && <Button className="rounded-xl" disabled={savingDetails || !isValidEmail(details?.users?.[0]?.email || 'support@example.com')} onClick={saveDetails}><Save className="mr-2 size-4" /> {savingDetails ? 'Guardando…' : 'Guardar detalles'}</Button>}
            <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)} disabled={savingDetails}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={(nextOpen) => { if (!nextOpen) closeUserEditor(); }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] w-[min(92vw,36rem)] max-w-none overflow-y-auto rounded-3xl p-5 sm:p-7">
          <DialogHeader>
            <DialogTitle className="break-words font-black uppercase italic tracking-tight">Editar usuario de sucursal</DialogTitle>
            <DialogDescription className="break-all">Actualiza nombre y correo. Deja la contraseña en blanco para conservar la actual. Se mantienen las reglas de acceso de la cuenta.</DialogDescription>
          </DialogHeader>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <label className="min-w-0 space-y-1 text-xs font-bold text-muted-foreground">Nombre completo
              <input autoFocus value={userForm.name} onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))} placeholder="Nombre y apellido" className="mt-2 h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" />
            </label>
            <label className="min-w-0 space-y-1 text-xs font-bold text-muted-foreground">Correo de acceso
              <input type="email" value={userForm.email} onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))} placeholder="usuario@empresa.com" className="mt-2 h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" />
            </label>
            <label className="min-w-0 space-y-1 text-xs font-bold text-muted-foreground sm:col-span-2">Nueva contraseña <span className="font-normal">(opcional)</span>
              <input type="password" autoComplete="new-password" value={userForm.password} onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))} placeholder="Deja en blanco para conservarla" className="mt-2 h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" />
            </label>
            <PasswordRequirements value={userForm.password} className="sm:col-span-2" />
          </div>
          {userFormError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{userFormError}</p>}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="w-full rounded-xl sm:w-auto" onClick={closeUserEditor} disabled={savingUser}>Cancelar</Button>
            <Button className="w-full rounded-xl sm:w-auto" disabled={savingUser} onClick={saveUser}>{savingUser ? <><Loader2 className="mr-2 size-4 animate-spin" />Guardando…</> : <><Save className="mr-2 size-4" />Guardar cambios</>}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
