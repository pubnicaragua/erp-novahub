import { useCallback, useEffect, useRef, useState } from 'react';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { customersService } from '../../services/ventas.service';
import { Button } from '../ui/button';
import { Combobox } from '../ui/Combobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';

export interface ForceSalesCustomerOption {
  id: string;
  code?: string | null;
  name: string;
  companyName?: string | null;
}

export interface ForceSalesLinkPoint { id: string; name: string; address: string; phone: string }

interface ForceSalesCustomerLinkDialogProps {
  open: boolean;
  /** Punto del mapa que se va a amarrar; sus datos prellenan al crear un cliente nuevo. */
  point?: ForceSalesLinkPoint | null;
  /** El rol puede crear clientes en Ventas. */
  canCreate?: boolean;
  onClose: () => void;
  onSelect: (customer: ForceSalesCustomerOption) => void;
}

/** Selector de cliente de Ventas para amarrar un punto del mapa a un cliente existente, o a uno nuevo. */
export function ForceSalesCustomerLinkDialog({ open, point = null, canCreate = false, onClose, onSelect }: ForceSalesCustomerLinkDialogProps) {
  const [term, setTerm] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState('');
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
    setCreating(false);
    setCreateError('');
    onClose();
  };

  const startCreating = () => {
    setForm({ name: point?.name || '', phone: point?.phone || '', address: point?.address || '' });
    setCreateError('');
    setCreating(true);
  };

  const createCustomer = async () => {
    const name = form.name.trim();
    if (!name) { setCreateError('Escribe el nombre del cliente.'); return; }
    setSaving(true);
    setCreateError('');
    try {
      const created = await customersService.create({
        name,
        type: 'INDIVIDUAL',
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        ...(form.address.trim() ? { address: form.address.trim() } : {}),
      });
      setTerm('');
      setCreating(false);
      onSelect({ id: created.id, code: created.code, name: created.name, companyName: created.companyName });
    } catch (error) {
      setCreateError(error instanceof Error && error.message ? error.message : 'No se pudo crear el cliente. Revisa los datos e intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="!z-[121] w-[calc(100%-2rem)] !max-w-md" overlayClassName="!z-[120]">
        <DialogHeader>
          <DialogTitle>{creating ? 'Nuevo cliente de ventas' : 'Cliente de ventas'}</DialogTitle>
        </DialogHeader>
        {!creating && (
          <>
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
            {canCreate && (
              <Button type="button" variant="outline" onClick={startCreating} className="w-full">
                ¿No existe? Crear cliente nuevo
              </Button>
            )}
          </>
        )}
        {creating && (
          <form
            className="space-y-3"
            onSubmit={(event) => { event.preventDefault(); void createCustomer(); }}
          >
            <p className="text-xs text-muted-foreground">Se crea en Ventas y queda amarrado a este punto.</p>
            <label className="block space-y-1 text-xs font-semibold">
              Nombre <span className="text-destructive" aria-hidden="true">*</span>
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={180} autoFocus required />
            </label>
            <label className="block space-y-1 text-xs font-semibold">
              Teléfono
              <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} maxLength={40} inputMode="tel" />
            </label>
            <label className="block space-y-1 text-xs font-semibold">
              Dirección
              <Input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} maxLength={240} />
            </label>
            {createError && <p role="alert" className="text-sm text-destructive">{createError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setCreating(false)} disabled={saving}>Volver</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Creando…' : 'Crear y amarrar'}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
