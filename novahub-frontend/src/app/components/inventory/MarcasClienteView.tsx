import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Combobox } from '../ui/Combobox';
import { Input } from '../ui/input';
import { Search, RefreshCw, Tags, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { inventoryService } from '../../services/inventario.service';

type BrandMapping = {
  id: string;
  name: string;
  normalizedName: string;
  customerId?: string | null;
  customer?: { id: string; name: string; code?: string | null } | null;
  _count?: { productDetails?: number };
};

const listFrom = (value: any) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

export function MarcasClienteView() {
  const { user, canPerform } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const canEdit = canPerform('INVENTORY_PRODUCTS', 'edit');
  const query = useQuery({
    queryKey: ['inventory', 'brand-customer-mappings', user?.tenantId],
    queryFn: async ({ signal }) => {
      const mappings = await inventoryService.getBrandCustomerMappings(signal);
      return {
        brands: listFrom(mappings?.brands) as BrandMapping[],
        customers: listFrom(mappings?.customers) as Array<{ id: string; name: string; code?: string | null }>,
      };
    },
    enabled: Boolean(user),
    staleTime: 30_000,
    retry: 1,
  });
  const assignMutation = useMutation({
    mutationFn: ({ brandId, customerId }: { brandId: string; customerId: string | null }) => inventoryService.assignBrandCustomer(brandId, customerId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['inventory', 'brand-customer-mappings'] });
      toast.success('Cliente de la marca actualizado');
    },
    onError: (error: any) => toast.error(error?.message || 'No se pudo actualizar la marca'),
  });

  const filteredBrands = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return (query.data?.brands || []).filter((brand) => !term || brand.name.toLocaleLowerCase().includes(term) || String(brand.customer?.name || '').toLocaleLowerCase().includes(term));
  }, [query.data?.brands, search]);

  const customerOptions = useMemo(() => [
    { value: '', label: 'Sin cliente asignado' },
    ...(query.data?.customers || []).map((customer) => ({
      value: customer.id,
      label: customer.name,
      description: customer.code || undefined,
    })),
  ], [query.data?.customers]);

  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
      <CardHeader className="border-b border-border/40 px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Tags className="size-5" /></div>
            <div className="min-w-0">
              <CardTitle className="text-xl font-black tracking-tight">Marcas por cliente</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Consulta y asigna el cliente relacionado con cada marca del inventario.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar marca o cliente" className="h-10 pl-9" />
            </div>
            <Button type="button" variant="outline" className="h-10" onClick={() => void query.refetch()} disabled={query.isFetching}>
              <RefreshCw className={`mr-2 size-4 ${query.isFetching ? 'animate-spin' : ''}`} /> Actualizar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {query.isLoading ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Cargando marcas…</div>
        ) : query.error ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 px-5 text-center text-sm text-muted-foreground">
            <p>No se pudieron cargar las marcas del inventario.</p>
            <Button type="button" variant="outline" onClick={() => void query.refetch()}>Reintentar</Button>
          </div>
        ) : filteredBrands.length === 0 ? (
          <div className="flex h-40 items-center justify-center px-5 text-center text-sm text-muted-foreground">No hay marcas registradas para este alcance.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-muted/40 text-left">
                <tr className="border-b border-border/40">
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Marca</th>
                  <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente</th>
                  <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Productos</th>
                  <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredBrands.map((brand) => {
                  const saving = assignMutation.isPending && assignMutation.variables?.brandId === brand.id;
                  return (
                    <tr key={brand.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Tags className="size-4" /></div><div><p className="font-bold text-foreground">{brand.name}</p><p className="font-mono text-[10px] text-muted-foreground">{brand.normalizedName}</p></div></div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <UserRound className="size-4 shrink-0 text-muted-foreground" />
                          <Combobox
                            ariaLabel={`Cliente para la marca ${brand.name}`}
                            value={brand.customerId || ''}
                            disabled={!canEdit || saving}
                            onChange={(customerId) => assignMutation.mutate({ brandId: brand.id, customerId: customerId || null })}
                            options={customerOptions}
                            placeholder="Sin cliente asignado"
                            searchPlaceholder="Buscar cliente por nombre o código..."
                            emptyMessage="No se encontró ese cliente."
                            maxVisibleOptions={100}
                            className="h-10 min-w-[260px] rounded-lg text-sm font-medium"
                            contentClassName="min-w-[min(26rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)]"
                          />
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-mono tabular-nums">{brand._count?.productDetails || 0}</td>
                      <td className="px-5 py-4 text-right">{brand.customerId ? <Badge className="bg-success text-success-foreground">Asignada</Badge> : <Badge variant="outline">Sin asignar</Badge>}{saving && <span className="ml-2 text-[10px] text-muted-foreground">Guardando…</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
