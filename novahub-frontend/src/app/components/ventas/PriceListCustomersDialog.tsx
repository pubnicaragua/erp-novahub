import { useState } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { priceListCustomersService, type PriceList } from '../../services/price-lists.service';

const ALL = 'all';
const NONE = 'none';
const PAGE_SIZE = 50;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists: PriceList[];
  initialListId?: string;
}

/** Busca clientes y muestra su lista de precios; filtra por lista con búsqueda y paginación en el servidor. */
export function PriceListCustomersDialog({ open, onOpenChange, lists, initialListId }: Props) {
  const [search, setSearch] = useState('');
  const [listId, setListId] = useState(initialListId || ALL);
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search, 300);


  const query = useTenantQuery(
    ['sales', 'price-lists', 'customers', debounced, listId, page],
    (signal) => priceListCustomersService.search({ search: debounced, priceListId: listId === ALL ? '' : listId, page, pageSize: PAGE_SIZE }, signal),
    { enabled: open, placeholderData: keepPreviousData },
  );
  const result = query.data;
  const totalPages = Math.max(1, Math.ceil((result?.total || 0) / PAGE_SIZE));
  const countOf = (id: string | null) => result?.counts.find((row) => row.priceListId === id)?.count ?? 0;

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-hidden p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle>Clientes por lista de precios</DialogTitle>
        <DialogDescription>Escribe el nombre o código del cliente para ver su lista, o elige una lista para ver todos los clientes que la usan.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-11 pl-9" placeholder="Buscar cliente por nombre o código" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        </div>
        <Select value={listId} onValueChange={(value) => { setListId(value); setPage(1); }}>
          <SelectTrigger className="h-11 sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las listas</SelectItem>
            {lists.map((list) => <SelectItem key={list.id} value={list.id}>{list.name} ({countOf(list.id)})</SelectItem>)}
            <SelectItem value={NONE}>Sin lista asignada ({countOf(null)})</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="max-h-[50vh] min-h-32 overflow-y-auto rounded-xl border">
        {query.isLoading ? <p className="p-6 text-center text-sm text-muted-foreground">Cargando clientes…</p>
          : query.isError ? <p className="p-6 text-center text-sm text-destructive">No se pudieron cargar los clientes. Intenta de nuevo.</p>
          : !result?.data.length ? <p className="p-6 text-center text-sm text-muted-foreground">No hay clientes con ese filtro.</p>
          : <ul className="divide-y">
            {result.data.map((customer) => <li key={customer.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{customer.name}</p>
                <p className="truncate text-xs text-muted-foreground">{customer.code}{customer.companyName && customer.companyName !== customer.name ? ` · ${customer.companyName}` : ''}</p>
              </div>
              {customer.priceList
                ? <Badge variant="outline">{customer.priceList.name}</Badge>
                : <Badge variant="outline" className="border-amber-500/40 text-amber-700">Sin lista asignada</Badge>}
            </li>)}
          </ul>}
      </div>
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{result?.total ?? 0} clientes</span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-4" /></Button>
          <span>Página {page} de {totalPages}</span>
          <Button type="button" variant="outline" size="icon" aria-label="Página siguiente" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="size-4" /></Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
