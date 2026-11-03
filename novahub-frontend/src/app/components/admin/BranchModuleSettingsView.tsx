import { useMemo, useState } from 'react';
import { Building2, Loader2, Search } from 'lucide-react';
import { toast } from '@/app/services/toast';
import { asList, useTenantQuery } from '../../hooks/useTenantQuery';
import { subscriptionsService } from '../../services/subscriptions.service';
import { tenantsService } from '../../services/tenants.service';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';

type TenantRecord = {
  id: string;
  name: string;
  slug?: string;
  industry?: string;
  plan?: string;
  customerLoansEnabled?: boolean;
  subscriptions?: Array<{ module: string; isActive: boolean }>;
};

export function BranchModuleSettingsView() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [savingByTenant, setSavingByTenant] = useState<Record<string, boolean>>({});
  const tenantsQuery = useTenantQuery(
    ['platform-customer-loan-settings'],
    (signal) => tenantsService.getAll(undefined, signal),
    { enabled: Boolean(user?.isPlatformAdmin) },
  );
  const tenants = asList(tenantsQuery.data) as TenantRecord[];
  const filteredTenants = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase();
    if (!term) return tenants;
    return tenants.filter((tenant) => [tenant.name, tenant.slug, tenant.industry]
      .some((value) => String(value || '').toLocaleLowerCase().includes(term)));
  }, [searchTerm, tenants]);
  const salesTenantsCount = tenants.filter((tenant) => tenant.subscriptions?.some((subscription) => subscription.module === 'SALES' && subscription.isActive)).length;
  const loansEnabledCount = tenants.filter((tenant) => tenant.customerLoansEnabled).length;

  const toggleCustomerLoans = async (tenant: TenantRecord, enabled: boolean) => {
    if (!user?.isPlatformAdmin || !tenant.id) return;
    const salesIsActive = tenant.subscriptions?.some((subscription) => subscription.module === 'SALES' && subscription.isActive);
    if (!salesIsActive) {
      toast.info('Activa Ventas antes de habilitar préstamos a clientes.');
      return;
    }

    setSavingByTenant((current) => ({ ...current, [tenant.id]: true }));
    try {
      await subscriptionsService.toggleModuleStatus({
        clientTenantId: tenant.id,
        module: 'SALES',
        isActive: true,
        customerLoansEnabled: enabled,
        notes: enabled ? 'Habilitación de préstamos a clientes' : 'Desactivación de préstamos a clientes',
      });
      toast.success(enabled ? 'Préstamos a clientes habilitados.' : 'Creación de préstamos deshabilitada; se conserva el historial.');
      await tenantsQuery.refetch();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo actualizar la opción de préstamos.');
    } finally {
      setSavingByTenant((current) => ({ ...current, [tenant.id]: false }));
    }
  };

  if (!user?.isPlatformAdmin) {
    return <div className="rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">Esta configuración está disponible solo para SuperAdmin.</div>;
  }

  return (
    <section className="min-w-0 space-y-5" aria-labelledby="branch-module-settings-title">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 id="branch-module-settings-title" className="flex items-center gap-2 text-lg font-black tracking-tight">
            <Building2 className="size-5 text-primary" /> Préstamos a clientes por sucursal
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Habilita esta opción únicamente en sucursales que ya tengan Ventas activo. Al desactivarla, se conserva el historial y se permiten los cobros existentes.
          </p>
        </div>
        <Badge variant="outline" className="w-fit shrink-0 px-3 py-1">
          {loansEnabledCount} habilitadas · {salesTenantsCount} con Ventas
        </Badge>
      </div>

      <div className="relative max-w-2xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Buscar sucursal por nombre, identificador o giro…"
          aria-label="Buscar sucursal"
          className="pl-10"
        />
      </div>

      {tenantsQuery.isLoading ? (
        <div role="status" className="flex min-h-48 items-center justify-center rounded-2xl border border-border/60 bg-card/60 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin text-primary" /> Cargando sucursales…
        </div>
      ) : tenantsQuery.isError ? (
        <Card className="rounded-2xl border-border/60">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <p className="text-sm text-muted-foreground">No se pudieron cargar las sucursales.</p>
            <Button type="button" variant="outline" onClick={() => void tenantsQuery.refetch()}>Reintentar</Button>
          </CardContent>
        </Card>
      ) : filteredTenants.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {tenants.length ? 'No hay sucursales que coincidan con la búsqueda.' : 'No hay sucursales disponibles.'}
        </div>
      ) : (
        <div className="grid min-w-0 gap-3">
          {filteredTenants.map((tenant) => {
            const salesIsActive = tenant.subscriptions?.some((subscription) => subscription.module === 'SALES' && subscription.isActive) ?? false;
            const saving = Boolean(savingByTenant[tenant.id]);
            return (
              <Card key={tenant.id} className="min-w-0 rounded-2xl border-border/60 bg-card/70 shadow-sm">
                <CardContent className="flex min-w-0 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="min-w-0">
                    <p className="break-words font-bold text-foreground">{tenant.name}</p>
                    <p className="mt-1 break-words text-xs text-muted-foreground">
                      {[tenant.slug, tenant.industry, tenant.plan].filter(Boolean).join(' · ') || 'Sucursal'}
                    </p>
                  </div>
                  <div className="flex min-w-0 items-center justify-between gap-4 border-t border-border/50 pt-3 sm:shrink-0 sm:justify-end sm:border-0 sm:pt-0">
                    <div className="flex min-w-0 flex-col items-start gap-1 sm:items-end">
                      <Badge variant={salesIsActive ? 'outline' : 'secondary'}>
                        {salesIsActive ? 'Ventas activa' : 'Ventas inactiva'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">Préstamos a clientes</span>
                    </div>
                    <div className="flex min-w-8 justify-center">
                      {saving ? <Loader2 className="size-4 animate-spin text-primary" aria-label="Guardando configuración" /> : (
                        <Switch
                          checked={Boolean(tenant.customerLoansEnabled)}
                          onCheckedChange={(enabled) => void toggleCustomerLoans(tenant, enabled)}
                          disabled={!salesIsActive}
                          aria-label={`Habilitar préstamos a clientes para ${tenant.name}`}
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
