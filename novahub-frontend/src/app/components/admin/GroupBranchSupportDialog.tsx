import { useEffect, useState, type ChangeEvent } from 'react';
import { Eye, KeyRound, Loader2, Pencil, Save, Users } from 'lucide-react';
import { toast } from 'sonner';
import { tenantsService } from '../../services/tenants.service';
import { storageService } from '../../services/storage.service';
import { getPasswordError, isValidEmail } from '../../utils/accountValidation';
import { BUSINESS_TYPE_OPTIONS, getBusinessTypeOption } from '../../constants/businessTypes';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { BrandLogo } from '../BrandLogo';
import { PasswordRequirements } from '../PasswordRequirements';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

const safeTrim = (value: unknown) => String(value ?? '').trim();

type BranchSupportDialogProps = {
  branch: any;
  onChanged?: () => void;
};

function getBranchUserIdentityLabel(user: any) {
  const role = String(user?.role || '').toUpperCase();
  const userType = String(user?.userType || '').toUpperCase();
  if (role === 'ADMIN' && userType === 'ADMIN') return 'ADMINISTRADOR DE SUCURSAL';
  if (role === 'SUPER_ADMIN') return 'SUPER ADMIN';
  if (role === 'EMPLOYEE' && userType === 'COLLABORATOR') return 'COLABORADOR';
  return `REVISAR IDENTIDAD · ${role || 'SIN ROL'}${userType ? ` / ${userType}` : ''}`;
}

export function GroupBranchSupportDialog({ branch, onChanged }: BranchSupportDialogProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'summary' | 'users'>('summary');
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsForm, setDetailsForm] = useState({ name: branch.name || '', slug: branch.slug || '', logo: branch.logo || '', industry: branch.industry || 'OTHER', subIndustry: branch.subIndustry || 'OTHER', businessType: getBusinessTypeOption(undefined, branch.industry, branch.subIndustry).key });
  const [passwordUser, setPasswordUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

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
    if (file.size > 2 * 1024 * 1024) {
      toast.error('El logo no debe superar 2 MB');
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

  const savePassword = async () => {
    const passwordError = getPasswordError(newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }
    try {
      setSavingPassword(true);
      await tenantsService.updateUser(branch.id, passwordUser.id, { password: newPassword });
      toast.success('Contraseña actualizada correctamente');
      setPasswordUser(null);
      setNewPassword('');
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo actualizar la contraseña');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="h-8 shrink-0 rounded-lg px-2.5" onClick={() => setOpen(true)}>
        <Eye className="size-3.5" />
        <span className="hidden lg:inline">Administrar</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="h-auto w-[calc(100vw-2rem)] !max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:w-[min(94vw,760px)] sm:!max-w-[760px] sm:p-7">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black uppercase italic tracking-tight">
              <Users className="size-5 text-primary" /> Soporte de {branch.name}
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
                <label className="space-y-2 text-xs font-bold text-muted-foreground">
                  Nombre de la sucursal
                  <input value={detailsForm.name} onChange={(event) => setDetailsForm((current) => ({ ...current, name: event.target.value }))} className="h-11 min-w-0 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" />
                </label>
                <label className="space-y-2 text-xs font-bold text-muted-foreground">
                  Slug de la sucursal
                  <input value={detailsForm.slug} onChange={(event) => setDetailsForm((current) => ({ ...current, slug: event.target.value }))} className="h-11 min-w-0 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary" />
                </label>
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
                  <div className="min-w-0">
                    <p className="truncate font-bold">{item.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.email}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-primary/70">{getBranchUserIdentityLabel(item)}</p>
                  </div>
                  <Button variant="outline" className="shrink-0 rounded-xl" onClick={() => setPasswordUser(item)}>
                    <KeyRound className="size-4" /> Cambiar contraseña
                  </Button>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2">
            {tab === 'summary' && <Button className="rounded-xl" disabled={savingDetails || !isValidEmail(details?.users?.[0]?.email || 'support@example.com')} onClick={saveDetails}><Save className="mr-2 size-4" /> {savingDetails ? 'Guardando…' : 'Guardar detalles'}</Button>}
            <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!passwordUser} onOpenChange={(nextOpen) => { if (!nextOpen) { setPasswordUser(null); setNewPassword(''); } }}>
        <DialogContent className="w-[min(92vw,32rem)] max-w-none">
          <DialogHeader>
            <DialogTitle className="font-black uppercase italic tracking-tight">Cambiar contraseña</DialogTitle>
            <DialogDescription>Actualiza la contraseña de {passwordUser?.name} desde el soporte de la sucursal.</DialogDescription>
          </DialogHeader>
          <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Nueva contraseña" className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
          <PasswordRequirements value={newPassword} />
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setPasswordUser(null)}>Cancelar</Button>
            <Button className="rounded-xl" disabled={savingPassword || !!getPasswordError(newPassword)} onClick={savePassword}>{savingPassword ? 'Guardando…' : 'Guardar contraseña'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
