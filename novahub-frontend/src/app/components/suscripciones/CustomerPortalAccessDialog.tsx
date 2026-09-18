import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Ban, Check, KeyRound, Loader2, Mail, Pencil, Search, ShieldCheck, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { customersService, type CustomerPortalAdminAccess, type CustomerPortalAdminAccessResponse } from '../../services/ventas.service';
import { getPasswordError, isValidEmail, normalizeEmail } from '../../utils/accountValidation';

type PortalAccessStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

interface CustomerPortalAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
}

const accessStatusLabel = (isActive: boolean) => isActive ? 'Acceso activo' : 'Acceso inactivo';
const customerStatusLabel = (status: string) => String(status || '').toUpperCase() === 'ACTIVE' ? 'Cliente activo' : 'Cliente inactivo';

export function CustomerPortalAccessDialog({ open, onOpenChange, canEdit }: CustomerPortalAccessDialogProps) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PortalAccessStatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const [editingAccess, setEditingAccess] = useState<CustomerPortalAdminAccess | null>(null);
  const [editingEmail, setEditingEmail] = useState('');
  const [passwordAccess, setPasswordAccess] = useState<CustomerPortalAdminAccess | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [statusTarget, setStatusTarget] = useState<CustomerPortalAdminAccess | null>(null);
  const [savingKey, setSavingKey] = useState('');

  useEffect(() => {
    if (!open) return;
    setSearchInput('');
    setSearch('');
    setStatusFilter('ALL');
    setPage(1);
    setEditingAccess(null);
    setPasswordAccess(null);
    setStatusTarget(null);
  }, [open]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const accessQuery = useTenantQuery<CustomerPortalAdminAccessResponse>(
    ['customer-portal-admin-accesses', search, statusFilter, page],
    (signal) => customersService.getPortalAccesses({
      search: search || undefined,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      page,
      pageSize: 50,
    }, signal),
    {
      enabled: open,
      staleTime: 0,
      onError: (error) => toast.error(error.message || 'No se pudieron cargar los accesos del portal'),
    },
  );

  const rows = accessQuery.data?.data || [];
  const totalPages = Math.max(1, Number(accessQuery.data?.meta?.totalPages || 1));
  const pageSummary = useMemo(() => {
    const total = Number(accessQuery.data?.meta?.total || 0);
    if (!total) return 'Sin accesos para este filtro';
    return `${total} ${total === 1 ? 'acceso encontrado' : 'accesos encontrados'}`;
  }, [accessQuery.data?.meta?.total]);

  const handleSaveEmail = async () => {
    if (!editingAccess || !canEdit) return;
    const email = normalizeEmail(editingEmail);
    if (!isValidEmail(email)) {
      toast.error('Escribe un correo válido para el acceso del portal.');
      return;
    }
    const key = `email:${editingAccess.customerId}`;
    setSavingKey(key);
    try {
      await customersService.savePortalAccess(editingAccess.customerId, { email, isActive: editingAccess.accessIsActive });
      toast.success('Correo del acceso actualizado.');
      setEditingAccess(null);
      await accessQuery.refetch();
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo actualizar el correo del portal.');
    } finally {
      setSavingKey('');
    }
  };

  const handleResetPassword = async () => {
    if (!passwordAccess || !canEdit) return;
    const passwordError = getPasswordError(newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }
    const key = `password:${passwordAccess.customerId}`;
    setSavingKey(key);
    try {
      await customersService.resetPortalPassword(passwordAccess.customerId, newPassword);
      toast.success('Contraseña del portal restablecida.');
      setNewPassword('');
      setPasswordAccess(null);
      await accessQuery.refetch();
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo restablecer la contraseña.');
    } finally {
      setSavingKey('');
    }
  };

  const handleToggleStatus = async () => {
    if (!statusTarget || !canEdit) return;
    const nextStatus = !statusTarget.accessIsActive;
    const key = `status:${statusTarget.customerId}`;
    setSavingKey(key);
    try {
      await customersService.setPortalAccessStatus(statusTarget.customerId, nextStatus);
      toast.success(nextStatus ? 'Acceso del portal activado.' : 'Acceso del portal inhabilitado.');
      await accessQuery.refetch();
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo actualizar el estado del portal.');
      throw error;
    } finally {
      setSavingKey('');
    }
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value as PortalAccessStatusFilter);
    setPage(1);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="!flex !max-h-[92vh] w-[calc(100vw-1rem)] !max-w-[min(94vw,980px)] !flex-col overflow-hidden rounded-3xl p-0">
          <DialogHeader className="border-b border-border/40 px-5 py-5 sm:px-7">
            <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
              <ShieldCheck className="size-5 text-primary" /> Accesos de clientes portal
            </DialogTitle>
            <DialogDescription>
              Administra los accesos creados desde Editar cliente. Estos usuarios no pertenecen al equipo operativo ni reciben permisos del ERP.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5 sm:p-7">
            <div className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-muted/15 p-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Buscar por cliente, código o correo..."
                  aria-label="Buscar accesos de clientes portal"
                  className="h-10 rounded-xl pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger className="h-10 w-full rounded-xl sm:w-[11rem]" aria-label="Filtrar estado del acceso">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los estados</SelectItem>
                  <SelectItem value="ACTIVE">Activos</SelectItem>
                  <SelectItem value="INACTIVE">Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{pageSummary}</span>
              <span>Página {page} de {totalPages}</span>
            </div>

            {accessQuery.isPending ? (
              <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border p-8 text-sm text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
                Cargando accesos del portal...
              </div>
            ) : accessQuery.isError ? (
              <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-destructive/40 p-8 text-center text-sm text-destructive">
                <AlertTriangle className="size-6" aria-hidden="true" />
                No se pudieron cargar los accesos. Intenta nuevamente.
                <Button variant="outline" className="rounded-xl" onClick={() => accessQuery.refetch()}>Reintentar</Button>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                <UserRound className="size-7 opacity-40" aria-hidden="true" />
                No hay accesos que coincidan con el filtro.
              </div>
            ) : (
              <div className="grid gap-3">
                {rows.map((access) => {
                  const customerActive = String(access.customerStatus || '').toUpperCase() === 'ACTIVE';
                  const emailKey = `email:${access.customerId}`;
                  const passwordKey = `password:${access.customerId}`;
                  const statusKey = `status:${access.customerId}`;
                  return (
                    <article key={access.customerId} className="min-w-0 rounded-2xl border border-border/50 bg-card p-4 shadow-sm transition-colors hover:border-primary/30">
                      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <h3 className="min-w-0 break-words text-sm font-black text-foreground">{access.customerName}</h3>
                            <Badge variant="outline" className="shrink-0 text-[10px]">{access.customerCode}</Badge>
                          </div>
                          <p className="mt-1 flex min-w-0 items-center gap-1.5 break-all text-xs text-muted-foreground">
                            <Mail className="size-3 shrink-0" aria-hidden="true" /> {access.portalEmail}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge variant="outline" className={customerActive ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400'}>
                              {customerActive ? <Check className="mr-1 size-3" aria-hidden="true" /> : <AlertTriangle className="mr-1 size-3" aria-hidden="true" />}
                              {customerStatusLabel(access.customerStatus)}
                            </Badge>
                            <Badge variant="outline" className={access.accessIsActive ? 'border-primary/25 bg-primary/10 text-primary' : 'border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400'}>
                              {access.accessIsActive ? <ShieldCheck className="mr-1 size-3" aria-hidden="true" /> : <Ban className="mr-1 size-3" aria-hidden="true" />}
                              {accessStatusLabel(access.accessIsActive)}
                            </Badge>
                          </div>
                          {!customerActive && <p className="mt-2 text-[11px] leading-4 text-amber-600 dark:text-amber-400">El acceso se conserva, pero el cliente debe estar activo para iniciar sesión.</p>}
                        </div>

                        {canEdit && <div className="flex flex-wrap gap-2 lg:max-w-[24rem] lg:justify-end">
                            <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider" onClick={() => { setEditingAccess(access); setEditingEmail(access.portalEmail); }} disabled={Boolean(savingKey)}>
                            <Pencil className="size-3" aria-hidden="true" /> Correo
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider" onClick={() => { setPasswordAccess(access); setNewPassword(''); }} disabled={Boolean(savingKey)}>
                            <KeyRound className="size-3" aria-hidden="true" /> Contraseña
                          </Button>
                          <Button variant="ghost" size="sm" className={access.accessIsActive ? 'h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-rose-600 hover:bg-rose-500/10 hover:text-rose-600' : 'h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-primary hover:bg-primary/10'} onClick={() => setStatusTarget(access)} disabled={Boolean(savingKey)}>
                            {access.accessIsActive ? <><X className="size-3" aria-hidden="true" /> Inhabilitar</> : <><Check className="size-3" aria-hidden="true" /> Activar</>}
                          </Button>
                          {(savingKey === emailKey || savingKey === passwordKey || savingKey === statusKey) && <Loader2 className="mt-2 size-4 animate-spin text-primary" aria-label="Guardando" />}
                        </div>}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && <div className="flex flex-wrap justify-end gap-2 border-t border-border/40 pt-4">
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || accessQuery.isFetching}>Anterior</Button>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || accessQuery.isFetching}>Siguiente</Button>
            </div>}
          </div>

          <DialogFooter className="border-t border-border/40 px-5 py-4 sm:px-7">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full rounded-xl sm:w-auto">Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingAccess)} onOpenChange={(nextOpen) => { if (!nextOpen && !savingKey.startsWith('email:')) setEditingAccess(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black uppercase tracking-tight"><Mail className="size-5 text-primary" /> Cambiar correo del portal</DialogTitle>
            <DialogDescription>El correo debe ser único en todo NovaHub. No se modificará el correo comercial del cliente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground" htmlFor="portal-access-email">Correo de acceso</label>
            <Input id="portal-access-email" type="email" value={editingEmail} onChange={(event) => setEditingEmail(event.target.value)} autoFocus className="h-11 rounded-xl" />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="w-full rounded-xl sm:w-auto" onClick={() => setEditingAccess(null)} disabled={savingKey.startsWith('email:')}>Cancelar</Button>
            <Button className="w-full rounded-xl sm:w-auto" onClick={handleSaveEmail} disabled={savingKey.startsWith('email:') || !editingEmail.trim()}>{savingKey.startsWith('email:') ? <Loader2 className="size-4 animate-spin" /> : 'Guardar correo'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(passwordAccess)} onOpenChange={(nextOpen) => { if (!nextOpen && !savingKey.startsWith('password:')) { setPasswordAccess(null); setNewPassword(''); } }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black uppercase tracking-tight"><KeyRound className="size-5 text-primary" /> Restablecer contraseña</DialogTitle>
            <DialogDescription>La contraseña actual no se puede consultar. Al guardar, las sesiones existentes dejarán de ser válidas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground" htmlFor="portal-access-password">Nueva contraseña</label>
            <Input id="portal-access-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" autoFocus className="h-11 rounded-xl" placeholder="Mínimo 8 caracteres" />
            <p className="text-[10px] leading-4 text-muted-foreground">Mínimo 8 caracteres, una mayúscula, un número y un carácter especial.</p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="w-full rounded-xl sm:w-auto" onClick={() => { setPasswordAccess(null); setNewPassword(''); }} disabled={savingKey.startsWith('password:')}>Cancelar</Button>
            <Button className="w-full rounded-xl sm:w-auto" onClick={handleResetPassword} disabled={savingKey.startsWith('password:') || !newPassword}>{savingKey.startsWith('password:') ? <Loader2 className="size-4 animate-spin" /> : 'Restablecer contraseña'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onOpenChange={(nextOpen) => { if (!nextOpen && !savingKey.startsWith('status:')) setStatusTarget(null); }}
        title={statusTarget?.accessIsActive ? '¿Inhabilitar acceso?' : '¿Activar acceso?'}
        description={statusTarget?.accessIsActive
          ? `El cliente ${statusTarget?.customerName || ''} no podrá iniciar sesión en su portal hasta que vuelvas a activarlo.`
          : `El cliente ${statusTarget?.customerName || ''} podrá iniciar sesión si su ficha comercial también está activa.`}
        confirmLabel={statusTarget?.accessIsActive ? 'Inhabilitar acceso' : 'Activar acceso'}
        variant={statusTarget?.accessIsActive ? 'destructive' : 'default'}
        loading={savingKey.startsWith('status:')}
        onConfirm={handleToggleStatus}
      />
    </>
  );
}
