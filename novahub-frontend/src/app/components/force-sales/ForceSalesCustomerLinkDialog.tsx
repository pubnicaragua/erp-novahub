import { useCallback, useEffect, useRef, useState } from 'react';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { customersService } from '../../services/ventas.service';
import { Combobox } from '../ui/Combobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

export interface ForceSalesCustomerOption {
  id: string;
  code?: string | null;
  name: string;
  companyName?: string | null;
}

interface ForceSalesCustomerLinkDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (customer: ForceSalesCustomerOption) => void;
}

/** Selector de cliente de Ventas para amarrar un punto del mapa a un cliente existente. */
export function ForceSalesCustomerLinkDialog({ open, onClose, onSelect }: ForceSalesCustomerLinkDialogProps) {
  const [term, setTerm] = useState('');
  const timerRef = useRef<number | null>(null);

  const lookup = useTenantQuery(
    ['force-sales', 'customer-link-lookup', term],
    () => customersService.getLookup({ search: term || undefined, status: 'ACTIVE', page: 1, pageSize: 25 }),
    { enabled: open, staleTime: 15_000 },
  );
  const customers: ForceSalesCustomerOption[] = lookup.data?.data || [];

  useEffect(() => () => { if (timerRef.current !== null) window.clearTimeout(timerRef.current); }, []);

  // La búsqueda se espera 250 ms después de escribir y solo consulta con 2 letras o más.
  const searchCustomers = useCallback((search: string) => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    const value = search.trim();
    const next = value.length >= 2 ? value : '';
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setTerm(next);
    }, value.length >= 2 ? 250 : 0);
  }, []);

  const close = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setTerm('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="!z-[121] w-[calc(100%-2rem)] !max-w-md" overlayClassName="!z-[120]">
        <DialogHeader>
          <DialogTitle>Cliente de ventas</DialogTitle>
        </DialogHeader>
        <Combobox
          options={customers.map((customer) => ({
            label: customer.name,
            value: customer.id,
            description: [customer.code ? `[${customer.code}]` : '', customer.companyName || ''].filter(Boolean).join(' '),
          }))}
          value=""
          onSearchChange={searchCustomers}
          onChange={(customerId) => {
            const customer = customers.find((item) => item.id === customerId);
            if (!customer) return;
            setTerm('');
            onSelect(customer);
          }}
          placeholder="Seleccionar Cliente"
          searchPlaceholder="Buscar cliente"
          emptyMessage="No se encontraron clientes activos."
          ariaLabel="Seleccionar cliente de ventas"
          contentClassName="!z-[122]"
        />
        {lookup.isFetching && <p className="text-xs text-muted-foreground">Cargando clientes activos…</p>}
        {lookup.isError && <p role="alert" className="text-sm text-destructive">No se pudieron cargar los clientes activos. Intenta de nuevo.</p>}
      </DialogContent>
    </Dialog>
  );
}
