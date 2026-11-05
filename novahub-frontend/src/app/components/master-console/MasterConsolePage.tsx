import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Clock,
  Download,
  Eye,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { toast } from '@/app/services/toast';
import { masterConsoleService, type MasterConsoleOverview } from '../../services/master-console.service';
import { useCurrency } from '../../contexts/CurrencyContext';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { cn } from '../ui/utils';
import { SalesKpiCard } from '../ventas/SalesKpiCard';
import { ClientDetailPanel } from './ClientDetailPanel';

type TenantSummary = MasterConsoleOverview['tenantsSummary'][number];
type TenantStatusFilter = 'all' | 'active' | 'mora' | 'suspended' | 'pending';
type TenantStatus = Exclude<TenantStatusFilter, 'all'>;

const PAGE_SIZE = 10;

const statusLabels: Record<TenantStatus, string> = {
  active: 'Activa',
  mora: 'En mora',
  suspended: 'Suspendida',
  pending: 'Pendiente',
};

const statusStyles: Record<TenantStatus, string> = {
  active: 'border-primary/20 bg-primary/10 text-primary',
  mora: 'border-destructive/20 bg-destructive/10 text-destructive',
  suspended: 'border-destructive/20 bg-destructive/10 text-destructive',
  pending: 'border-border bg-muted/60 text-muted-foreground',
};

function getTenantStatus(tenant: TenantSummary): TenantStatus {
  const implementationStatus = String(tenant.status || '').toUpperCase();
  if (!tenant.isActive || implementationStatus === 'SUSPENDED') return 'suspended';
  if (tenant.inMora) return 'mora';
  if (implementationStatus === 'ACTIVE') return 'active';
  return 'pending';
}

function getPlanLabel(plan: string) {
  const planLabels: Record<string, string> = {
    BASIC: 'Basic',
    PROFESSIONAL: 'Professional',
    ENTERPRISE: 'Enterprise',
    CUSTOM: 'Custom',
  };
  return planLabels[plan.toUpperCase()] || plan;
}

function formatRegistrationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-NI', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function csvCell(value: string | number) {
  const text = String(value);
  const safeText = /^[\s]*[=+\-@]/.test(text) ? "'" + text : text;
  return '"' + safeText.replace(/"/g, '""') + '"';
}

export function MasterConsolePage() {
  const [overview, setOverview] = useState<MasterConsoleOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [clientDetail, setClientDetail] = useState<Record<string, unknown> | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TenantStatusFilter>('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [page, setPage] = useState(1);
  const { formatAmount } = useCurrency();

  const fetchOverview = useCallback(async () => {
    try {
      const data = await masterConsoleService.getOverview();
      setOverview(data);
      setLoadError(false);
    } catch (error) {
      console.error('Error loading Master Console overview:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void fetchOverview(), 0);
    const interval = window.setInterval(() => void fetchOverview(), 30000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [fetchOverview]);

  const openClientDetail = async (tenantId: string) => {
    try {
      setLoadingDetail(true);
      setSelectedClientId(tenantId);
      const data = await masterConsoleService.getClientDetail(tenantId);
      setClientDetail(data);
    } catch {
      toast.error('Error al cargar el detalle de la empresa');
      setSelectedClientId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const debtByTenant = useMemo(
    () => new Map<string, number>(
      (overview?.empresasConDeuda || []).map((tenant): [string, number] => [tenant.id, tenant.deuda]),
    ),
    [overview],
  );

  const plans = useMemo(
    () => Array.from(new Set((overview?.tenantsSummary || []).map((tenant) => tenant.plan))).sort(),
    [overview],
  );

  const filteredTenants = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase('es-NI');
    return (overview?.tenantsSummary || []).filter((tenant) => {
      const matchesSearch = !query
        || tenant.name.toLocaleLowerCase('es-NI').includes(query)
        || tenant.slug.toLocaleLowerCase('es-NI').includes(query);
      const matchesStatus = statusFilter === 'all' || getTenantStatus(tenant) === statusFilter;
      const matchesPlan = planFilter === 'all' || tenant.plan === planFilter;
      return matchesSearch && matchesStatus && matchesPlan;
    });
  }, [overview, searchTerm, statusFilter, planFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredTenants.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleTenants = filteredTenants.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstVisibleRow = filteredTenants.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastVisibleRow = Math.min(currentPage * PAGE_SIZE, filteredTenants.length);

  const exportCompanies = () => {
    const headers = [
      'Empresa',
      'Dominio',
      'Plan',
      'Estado',
      'Saldo pendiente',
      'Usuarios',
      'Módulos activos',
      'Fecha de registro',
    ];
    const rows = filteredTenants.map((tenant) => [
      tenant.name,
      tenant.slug + '.novahub.io',
      getPlanLabel(tenant.plan),
      statusLabels[getTenantStatus(tenant)],
      formatAmount(debtByTenant.get(tenant.id) || 0, 'USD'),
      String(tenant.users),
      String(tenant.modulesActive),
      formatRegistrationDate(tenant.createdAt),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => csvCell(value)).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'empresas-master-console-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('Se exportó la lista de empresas');
  };

  const retryOverview = () => {
    setLoading(true);
    void fetchOverview();
  };

  const clearDetail = () => {
    setSelectedClientId(null);
    setClientDetail(null);
  };

  if (loading && !overview) {
    return (
      <div className="master-console-module min-w-0 max-w-full overflow-x-hidden bg-background p-4 sm:p-6 lg:p-8">
        <div className="mx-auto flex min-h-72 max-w-[1700px] flex-col items-center justify-center gap-3 text-muted-foreground" role="status">
          <Clock className="size-7 animate-spin text-primary" />
          <p className="text-sm">Cargando el resumen de empresas...</p>
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="master-console-module min-w-0 max-w-full overflow-x-hidden bg-background p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-[1700px]">
          <Card className="rounded-xl border-border/70 shadow-none">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <AlertTriangle className="size-8 text-destructive" />
              <div>
                <h1 className="text-lg font-semibold text-foreground">No se pudo cargar Master Console</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {loadError ? 'Revisa tu conexión e inténtalo de nuevo.' : 'No hay datos disponibles en este momento.'}
                </p>
              </div>
              <Button type="button" onClick={retryOverview}>Reintentar</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const statusColor = (status: TenantStatus) => statusStyles[status];

  return (
    <div className="master-console-module min-w-0 max-w-full overflow-x-hidden bg-background p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-[1700px] space-y-5">
        {selectedClientId && clientDetail ? (
          <div>
            <ClientDetailPanel
              data={clientDetail}
              onBack={clearDetail}
              onRefresh={() => void openClientDetail(selectedClientId)}
            />
          </div>
        ) : (
          <>
            <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Building2 className="size-6" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Master Console</h1>
                  <p className="mt-1 text-sm text-muted-foreground">Empresas y estado de servicio</p>
                </div>
              </div>
              <Badge className="w-fit border-primary/20 bg-primary/5 px-3 py-2 text-sm font-medium text-primary">
                <Building2 className="mr-1.5 size-4" />
                {overview.totalTenants} empresas
              </Badge>
            </header>

            <section aria-label="Indicadores de empresas" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SalesKpiCard
                title="Activas"
                value={overview.activeTenants}
                icon={Building2}
                color="text-primary"
                bg="bg-primary/10"
              />
              <SalesKpiCard
                title="En mora"
                value={overview.tenantsInMora}
                icon={AlertTriangle}
                color={overview.tenantsInMora > 0 ? 'text-destructive' : 'text-primary'}
                bg={overview.tenantsInMora > 0 ? 'bg-destructive/10' : 'bg-primary/10'}
              />
              <SalesKpiCard
                title="Suspendidas"
                value={overview.suspendedTenants}
                icon={ShieldAlert}
                color={overview.suspendedTenants > 0 ? 'text-destructive' : 'text-primary'}
                bg={overview.suspendedTenants > 0 ? 'bg-destructive/10' : 'bg-primary/10'}
              />
              <SalesKpiCard
                title="Implementaciones pendientes"
                value={overview.pendingImplementations}
                icon={Clock}
                color="text-primary"
                bg="bg-primary/10"
              />
            </section>

            <Card className="min-w-0 overflow-hidden rounded-xl border-border/70 shadow-none">
              <CardHeader className="gap-1 p-4 sm:px-5 sm:pt-5">
                <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-lg font-semibold sm:text-xl">
                      <Building2 className="size-5 shrink-0 text-primary" />
                      Gestión de empresas
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Administra las empresas del ecosistema, su plan, estado y actividad.
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground" aria-live="polite">
                    {filteredTenants.length} resultados
                  </span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 p-4 pt-0 sm:px-5 sm:pb-5">
                <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.5fr)_minmax(160px,1fr)_minmax(160px,1fr)_auto]">
                  <div className="relative min-w-0">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      aria-label="Buscar empresa por nombre o dominio"
                      className="h-10 min-w-0 rounded-lg border-border/70 bg-background pl-9"
                      placeholder="Buscar empresa"
                      value={searchTerm}
                      onChange={(event) => {
                        setSearchTerm(event.target.value);
                        setPage(1);
                      }}
                    />
                  </div>

                  <Select
                    value={statusFilter}
                    onValueChange={(value) => {
                      setStatusFilter(value as TenantStatusFilter);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-lg bg-background" aria-label="Filtrar empresas por estado">
                      <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="active">Activas</SelectItem>
                      <SelectItem value="mora">En mora</SelectItem>
                      <SelectItem value="suspended">Suspendidas</SelectItem>
                      <SelectItem value="pending">Pendientes</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={planFilter}
                    onValueChange={(value) => {
                      setPlanFilter(value);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-10 rounded-lg bg-background" aria-label="Filtrar empresas por plan">
                      <SelectValue placeholder="Plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los planes</SelectItem>
                      {plans.map((plan) => (
                        <SelectItem key={plan} value={plan}>{getPlanLabel(plan)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 gap-2 rounded-lg border-primary/30 text-primary hover:bg-primary/5 sm:w-full xl:w-auto"
                    onClick={exportCompanies}
                    disabled={filteredTenants.length === 0}
                  >
                    <Download className="size-4" />
                    Exportar
                  </Button>
                </div>

                <Table
                  aria-label="Empresas de NovaHub"
                  className="w-full min-w-[900px] text-left"
                  containerClassName="rounded-lg border border-border/70"
                >
                  <TableHeader className="bg-muted/40">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="min-w-48 px-4">Empresa</TableHead>
                      <TableHead className="whitespace-nowrap px-3">Plan</TableHead>
                      <TableHead className="whitespace-nowrap px-3">Estado</TableHead>
                      <TableHead className="whitespace-nowrap px-3 text-right">Saldo pendiente</TableHead>
                      <TableHead className="whitespace-nowrap px-3 text-right">Usuarios</TableHead>
                      <TableHead className="whitespace-nowrap px-3">Registro</TableHead>
                      <TableHead className="w-20 px-3 text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleTenants.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 px-4 text-center text-sm text-muted-foreground">
                          No hay empresas que coincidan con los filtros.
                        </TableCell>
                      </TableRow>
                    ) : visibleTenants.map((tenant) => {
                      const tenantStatus = getTenantStatus(tenant);
                      const debt = debtByTenant.get(tenant.id) || 0;
                      return (
                        <TableRow key={tenant.id} className="border-border/60">
                          <TableCell className="min-w-48 px-4 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Building2 className="size-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-foreground">{tenant.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{tenant.slug}.novahub.io</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="px-3 py-3">
                            <Badge variant="outline" className="border-border/70 bg-muted/20 font-medium text-muted-foreground">
                              {getPlanLabel(tenant.plan)}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-3 py-3">
                            <Badge variant="outline" className={cn('gap-1.5 font-medium', statusColor(tenantStatus))}>
                              <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                              {statusLabels[tenantStatus]}
                            </Badge>
                          </TableCell>
                          <TableCell className={cn('whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums', debt > 0 ? 'text-destructive' : 'text-foreground')}>
                            {formatAmount(debt, 'USD')}
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-muted-foreground">
                            {tenant.users}
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                            {formatRegistrationDate(tenant.createdAt)}
                          </TableCell>
                          <TableCell data-actions-column="true" className="px-3 py-3 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-9 text-primary hover:bg-primary/10 hover:text-primary"
                              onClick={() => void openClientDetail(tenant.id)}
                              aria-label={'Ver detalle de ' + tenant.name}
                            >
                              <Eye className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    Mostrando {firstVisibleRow}–{lastVisibleRow} de {filteredTenants.length} empresas
                  </p>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-w-20"
                      onClick={() => setPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage <= 1}
                      aria-label="Página anterior"
                    >
                      Anterior
                    </Button>
                    <span className="min-w-20 text-center text-xs tabular-nums">
                      Página {currentPage} de {pageCount}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-w-20"
                      onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
                      disabled={currentPage >= pageCount}
                      aria-label="Página siguiente"
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {loadingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm" role="status">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm shadow-lg">
            <Clock className="size-5 animate-spin text-primary" />
            Cargando detalle de la empresa...
          </div>
        </div>
      )}
    </div>
  );
}
