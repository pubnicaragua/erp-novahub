import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Building2, Loader2, Plus, Search, Sparkles, X } from 'lucide-react';
import { toast } from '@/app/services/toast';
import { asList, useTenantQuery } from '../../hooks/useTenantQuery';
import { canManageTenantFeatures, tenantFeaturesService, type TenantFeatureCandidate, type TenantFeatureDefinition } from '../../services/tenant-features.service';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';

const FEATURE_MODULE_LABELS: Record<string, string> = { SALES: 'Ventas' };

function getRequiredModuleLabel(moduleKey: string) {
  return FEATURE_MODULE_LABELS[moduleKey] || moduleKey.toLocaleLowerCase().replace(/_/g, ' ');
}

function FeatureSection({ feature, onChanged }: { feature: TenantFeatureDefinition; onChanged: () => Promise<unknown> }) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [savingBranchId, setSavingBranchId] = useState<string | null>(null);
  const [assignedFilter, setAssignedFilter] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const candidatesQuery = useTenantQuery(
    ['platform-tenant-feature-candidates', feature.key, debouncedSearch],
    (signal) => tenantFeaturesService.searchBranches(feature.key, debouncedSearch, signal),
    { enabled: Boolean(debouncedSearch) },
  );
  const assignedIds = new Set(feature.branches.map((branch) => branch.id));
  const candidates = (asList(candidatesQuery.data) as TenantFeatureCandidate[])
    .filter((branch) => !assignedIds.has(branch.id));
  const assignedBranches = feature.branches.filter((branch) => {
    const term = assignedFilter.trim().toLocaleLowerCase();
    return !term || `${branch.name} ${branch.slug}`.toLocaleLowerCase().includes(term);
  });

  const setAssignment = async (branchId: string, enabled: boolean) => {
    setSavingBranchId(branchId);
    try {
      await tenantFeaturesService.setAssignment(feature.key, branchId, enabled);
      toast.success(enabled
        ? `${feature.label} habilitada para la sucursal.`
        : `${feature.label} retirada de la sucursal.`);
      await Promise.all([
        onChanged(),
        queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === 'tenant-module'
            && query.queryKey.includes('platform-tenant-feature-candidates')
            && query.queryKey.includes(feature.key),
        }),
      ]);
    } catch (error: unknown) {
      const failure = error as { response?: { data?: { message?: string } }; message?: string };
      toast.error(failure?.response?.data?.message || failure?.message || 'No se pudo actualizar la función.');
    } finally {
      setSavingBranchId(null);
    }
  };

  return (
    <Card className="min-w-0 rounded-3xl border-border/60 shadow-sm">
      <CardHeader className="space-y-3 p-5 sm:p-6">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="size-5" /></span>
            <div className="min-w-0">
              <CardTitle className="break-words text-base font-black">{feature.label}</CardTitle>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </div>
          </div>
          <Badge variant="outline" className="shrink-0 px-3 py-1">{feature.enabledCount} sucursales</Badge>
        </div>
        {feature.requiredModule && (
          <p className="text-xs text-muted-foreground">Requiere el módulo {getRequiredModuleLabel(feature.requiredModule)} activo.</p>
        )}
        {feature.disabledDescription && <p className="text-xs text-muted-foreground">{feature.disabledDescription}</p>}
      </CardHeader>

      <CardContent className="grid min-w-0 gap-5 border-t border-border/50 p-5 sm:p-6 xl:grid-cols-2">
        <section className="min-w-0 space-y-3" aria-labelledby={`${feature.key}-assigned-title`}>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 id={`${feature.key}-assigned-title`} className="text-sm font-bold">Sucursales con la función</h3>
            {feature.branches.length > 0 && (
              <Input
                value={assignedFilter}
                onChange={(event) => setAssignedFilter(event.target.value)}
                placeholder="Filtrar asignadas…"
                aria-label={`Filtrar sucursales con ${feature.label}`}
                className="h-9 w-full sm:max-w-56"
              />
            )}
          </div>
          <div className="max-h-80 min-w-0 space-y-2 overflow-y-auto rounded-2xl border border-border/50 p-2">
            {assignedBranches.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 p-5 text-center text-sm text-muted-foreground">
                {feature.branches.length ? 'No hay sucursales que coincidan con el filtro.' : 'Aún no hay sucursales asignadas.'}
              </div>
            ) : assignedBranches.map((branch) => {
              const saving = savingBranchId === branch.id;
              return (
                <div key={branch.id} className="flex min-w-0 flex-col gap-3 rounded-xl bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Building2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold">{branch.name}</p>
                      <p className="break-all text-xs text-muted-foreground">{branch.slug}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge variant={branch.isActive ? 'outline' : 'secondary'}>{branch.isActive ? 'Sucursal activa' : 'Sucursal inactiva'}</Badge>
                        {feature.requiredModule && !branch.requiredModuleActive && <Badge variant="secondary">{getRequiredModuleLabel(feature.requiredModule)} inactivo</Badge>}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full shrink-0 sm:w-auto"
                    disabled={saving}
                    onClick={() => void setAssignment(branch.id, false)}
                    aria-label={`Retirar ${feature.label} de ${branch.name}`}
                  >
                    {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <X className="mr-1.5 size-4" />}
                    Retirar
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="min-w-0 space-y-3" aria-labelledby={`${feature.key}-search-title`}>
          <h3 id={`${feature.key}-search-title`} className="text-sm font-bold">Agregar sucursal</h3>
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nombre o identificador…"
              aria-label={`Buscar sucursal para ${feature.label}`}
              className="pl-10"
            />
          </div>
          <div className="max-h-80 min-w-0 space-y-2 overflow-y-auto rounded-2xl border border-border/50 p-2" aria-live="polite">
            {!debouncedSearch ? (
              <p className="rounded-xl border border-dashed border-border/70 p-5 text-center text-sm text-muted-foreground">Escribe para buscar una sucursal disponible.</p>
            ) : candidatesQuery.isLoading ? (
              <div role="status" className="flex min-h-24 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin text-primary" /> Buscando sucursales…</div>
            ) : candidatesQuery.isError ? (
              <div className="flex min-h-24 flex-col items-center justify-center gap-2 text-center text-sm text-destructive"><AlertCircle className="size-4" /> No se pudieron buscar sucursales.<Button type="button" variant="outline" size="sm" onClick={() => void candidatesQuery.refetch()}>Reintentar</Button></div>
            ) : candidates.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/70 p-5 text-center text-sm text-muted-foreground">No se encontraron sucursales disponibles.</p>
            ) : candidates.map((branch) => {
              const saving = savingBranchId === branch.id;
              return (
                <div key={branch.id} className="flex min-w-0 flex-col gap-3 rounded-xl bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold">{branch.name}</p>
                      <p className="break-all text-xs text-muted-foreground">{branch.slug}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge variant={branch.isActive ? 'outline' : 'secondary'}>{branch.isActive ? 'Sucursal activa' : 'Sucursal inactiva'}</Badge>
                        {feature.requiredModule && <Badge variant={branch.requiredModuleActive ? 'outline' : 'secondary'}>{getRequiredModuleLabel(feature.requiredModule)} {branch.requiredModuleActive ? 'activo' : 'inactivo'}</Badge>}
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full shrink-0 sm:w-auto"
                    disabled={!branch.eligible || saving}
                    onClick={() => void setAssignment(branch.id, true)}
                    aria-label={`Agregar ${feature.label} a ${branch.name}`}
                  >
                    {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Plus className="mr-1.5 size-4" />}
                    Agregar
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

export function SpecificFeaturesSettingsView() {
  const { user } = useAuth();
  const canManageFeatures = canManageTenantFeatures(user?.role);
  const catalogQuery = useTenantQuery(
    ['platform-tenant-feature-catalog'],
    (signal) => tenantFeaturesService.getCatalog(signal),
    { enabled: canManageFeatures },
  );
  const features = asList(catalogQuery.data) as TenantFeatureDefinition[];

  if (!canManageFeatures) {
    return <div className="rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">Esta configuración está disponible solo para SuperAdmin.</div>;
  }

  return (
    <section className="min-w-0 space-y-5" aria-labelledby="specific-features-title">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 id="specific-features-title" className="flex items-center gap-2 text-lg font-black tracking-tight"><Sparkles className="size-5 text-primary" /> Funciones específicas por sucursal</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Administra capacidades adicionales que algunas sucursales necesitan, separadas de sus módulos y plan.</p>
        </div>
        <Badge variant="outline" className="w-fit shrink-0 px-3 py-1">{features.length} funciones</Badge>
      </div>

      {catalogQuery.isLoading ? (
        <div role="status" className="flex min-h-48 items-center justify-center rounded-2xl border border-border/60 bg-card/60 text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin text-primary" /> Cargando funciones…</div>
      ) : catalogQuery.isError ? (
        <Card className="rounded-2xl border-border/60"><CardContent className="flex flex-col items-center gap-3 p-8 text-center"><p className="text-sm text-muted-foreground">No se pudieron cargar las funciones.</p><Button type="button" variant="outline" onClick={() => void catalogQuery.refetch()}>Reintentar</Button></CardContent></Card>
      ) : features.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Todavía no hay funciones específicas registradas.</div>
      ) : (
        <div className="grid min-w-0 gap-5">
          {features.map((feature) => <FeatureSection key={feature.key} feature={feature} onChanged={catalogQuery.refetch} />)}
        </div>
      )}
    </section>
  );
}
