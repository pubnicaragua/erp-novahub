import { formatDateOnly } from '../../utils/dateFormat';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Truck, Ban } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Combobox } from '../ui/Combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { toast } from '@/app/services/toast';
import { inventoryService } from '../../services/inventario.service';
import { invoicesService } from '../../services/ventas.service';
import { hrService } from '../../services/hr.service';
import { useAuth } from '../../contexts/AuthContext';

const TREATMENTS: Record<string, { label: string; hint: string }> = {
  DRIVER_CHARGE: { label: 'Cobrar al conductor', hint: 'Cuentas por cobrar empleados · crédito al cliente' },
  SALES_DISCOUNT: { label: 'Descuento sobre ventas', hint: 'Lo asume la empresa · crédito al cliente' },
  CONSUMPTION: { label: 'Consumo / pérdida de inventario', hint: 'Pérdidas de inventario · sin cliente' },
};

const money = (n: unknown) => Number(n || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const errorText = (e: unknown) => (e instanceof Error ? e.message : 'No se pudo completar la operación.');

export function InventoryShortfallsPanel({ active = true }: { active?: boolean }) {
  const { user, canPerform } = useAuth();
  const queryClient = useQueryClient();
  const tenantKey = user?.tenantId || user?.clientTenantId || 'current';
  const canCreate = canPerform('INVENTORY_LOSSES', 'create');
  const canEdit = canPerform('INVENTORY_LOSSES', 'edit');
  const [open, setOpen] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [form, setForm] = useState<any>({ treatment: 'DRIVER_CHARGE', quantity: '' });
  const [context, setContext] = useState<any | null>(null);

  const listQuery = useQuery({
    queryKey: ['inventory', 'shortfalls', tenantKey],
    queryFn: ({ signal }) => inventoryService.getShortfalls({ pageSize: 100 }, signal),
    enabled: Boolean(user) && active,
    staleTime: 0,
  });
  const reportQuery = useQuery({
    queryKey: ['inventory', 'shortfalls-report', tenantKey],
    queryFn: ({ signal }) => inventoryService.getShortfallReport({}, signal),
    enabled: Boolean(user) && active,
    staleTime: 0,
  });
  const invoicesQuery = useQuery({
    queryKey: ['inventory', 'shortfalls-invoices', tenantKey, invoiceSearch],
    queryFn: ({ signal }) => invoicesService.getAll({ search: invoiceSearch, pageSize: 20 } as any, signal),
    enabled: open,
  });
  const productsQuery = useQuery({
    queryKey: ['inventory', 'shortfalls-products', tenantKey, productSearch],
    queryFn: ({ signal }) => inventoryService.getProducts({ search: productSearch, pageSize: 20 } as any, signal),
    enabled: open,
  });
  const employeesQuery = useQuery({
    queryKey: ['inventory', 'shortfalls-employees', tenantKey, employeeSearch],
    queryFn: ({ signal }) => hrService.getEmployeeLookup(employeeSearch, signal),
    enabled: open,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['inventory', 'shortfalls', tenantKey] });
    queryClient.invalidateQueries({ queryKey: ['inventory', 'shortfalls-report', tenantKey] });
    queryClient.invalidateQueries({ queryKey: ['accounting'] });
  };

  const createMutation = useMutation({
    mutationFn: () => inventoryService.createShortfall({
      productId: form.productId,
      invoiceId: form.invoiceId || undefined,
      driverEmployeeId: form.driverEmployeeId || undefined,
      treatment: form.treatment,
      quantity: Number(form.quantity),
      unitPrice: form.unitPrice !== undefined && form.unitPrice !== '' ? Number(form.unitPrice) : undefined,
      notes: form.notes || undefined,
    }),
    onSuccess: () => {
      toast.success('Faltante registrado y contabilizado');
      setOpen(false);
      setForm({ treatment: 'DRIVER_CHARGE', quantity: '' });
      setContext(null);
      refresh();
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => inventoryService.cancelShortfall(id, reason),
    onSuccess: () => { toast.success('Faltante cancelado y asiento revertido'); refresh(); },
    onError: (e) => toast.error(errorText(e)),
  });

  const pickInvoice = async (invoiceId: string) => {
    setForm((f: any) => ({ ...f, invoiceId }));
    try {
      const ctx = await inventoryService.getShortfallInvoiceContext(invoiceId, form.productId);
      setContext(ctx);
      setForm((f: any) => ({ ...f, driverEmployeeId: ctx.driverEmployeeId || f.driverEmployeeId }));
    } catch (e) {
      setContext(null);
      toast.error(errorText(e));
    }
  };

  const invoiceOptions = ((invoicesQuery.data as any)?.data || []).map((inv: any) => ({
    value: inv.id, label: `${inv.number} · ${inv.customer?.name || 'Cliente'}`,
  }));
  const productOptions = ((productsQuery.data as any)?.data || []).map((p: any) => ({ value: p.id, label: `${p.code || ''} · ${p.name}` }));
  const employeeOptions = ((employeesQuery.data as any) || []).map((e: any) => ({
    value: e.id, label: `${e.firstName} ${e.lastName}`.trim(),
  }));

  const rows = (listQuery.data as any)?.data || [];
  const report = reportQuery.data;
  const needsCustomer = form.treatment !== 'CONSUMPTION';
  const canSubmit = Boolean(form.productId) && Number(form.quantity) > 0
    && (!needsCustomer || form.invoiceId)
    && (form.treatment !== 'DRIVER_CHARGE' || form.driverEmployeeId || context?.driverName);

  return (
    <div className="space-y-3" data-tour="inventory-shortfalls">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Truck className="size-4 text-destructive" />
          <h4 className="text-sm font-black">Faltantes de entrega</h4>
          <span className="text-[10px] text-muted-foreground">Producto · factura · cliente · conductor</span>
        </div>
        {canCreate && (
          <Button size="sm" className="h-8 gap-1.5 text-[10px] font-bold" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" /> Registrar faltante
          </Button>
        )}
      </div>

      {report && (report.byDriver?.length > 0 || report.byCustomer?.length > 0) && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {[{ title: 'Por conductor', data: report.byDriver }, { title: 'Por cliente', data: report.byCustomer }].map((block) => (
            <Card key={block.title} className="rounded-2xl border-border/50">
              <CardContent className="space-y-1.5 p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{block.title}</p>
                {block.data.slice(0, 8).map((row: any) => (
                  <div key={row.key} className="flex items-center justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate font-semibold">{row.label}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{row.count} · {money(row.quantity)} u</span>
                    <span className="shrink-0 font-mono font-bold text-destructive">{money(row.amount)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="rounded-2xl border-border/50">
        <CardContent className="overflow-x-auto p-0">
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow>
                {['Número', 'Fecha', 'Producto', 'Factura', 'Cliente', 'Conductor', 'Tratamiento', 'Cant.', 'Monto', ''].map((h) => (
                  <TableHead key={h} className="text-[10px] font-black uppercase tracking-widest">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="py-8 text-center text-xs text-muted-foreground">Aún no hay faltantes de entrega registrados.</TableCell></TableRow>
              ) : rows.map((row: any) => (
                <TableRow key={row.id} className={row.status === 'CANCELLED' ? 'opacity-50' : undefined}>
                  <TableCell className="font-mono text-xs font-bold">{row.number}</TableCell>
                  <TableCell className="text-xs">{formatDateOnly(row.date)}</TableCell>
                  <TableCell className="text-xs">{row.productName || '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{row.invoiceNumber || '—'}</TableCell>
                  <TableCell className="text-xs">{row.customerName || '—'}</TableCell>
                  <TableCell className="text-xs">{row.driverName || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[9px] font-bold">{row.status === 'CANCELLED' ? 'Cancelado' : TREATMENTS[row.treatment]?.label || row.treatment}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{money(row.quantity)}</TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold text-destructive">{money(row.amount)}</TableCell>
                  <TableCell>
                    {canEdit && row.status !== 'CANCELLED' && (
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-[10px]" aria-label={`Cancelar faltante ${row.number}`}
                        onClick={() => {
                          const reason = window.prompt('Motivo de la cancelación (se revertirá el asiento):');
                          if (reason && reason.trim()) cancelMutation.mutate({ id: row.id, reason: reason.trim() });
                        }}>
                        <Ban className="size-3" /> Cancelar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar faltante de entrega</DialogTitle>
            <DialogDescription>Se liga al producto, la factura, el cliente y el conductor del viaje, y genera el asiento según el tratamiento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold">Factura</Label>
              <Combobox options={invoiceOptions} value={form.invoiceId} onChange={pickInvoice} onSearchChange={setInvoiceSearch} placeholder="Buscar factura…" ariaLabel="Factura" />
              {context && (
                <p className="text-[10px] text-muted-foreground">
                  Cliente: <b>{context.customerName || '—'}</b> · Conductor: <b>{context.driverName || (context.driverEmployeeId ? 'del viaje' : 'sin viaje en Flota')}</b>
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold">Producto</Label>
              <Combobox options={productOptions} value={form.productId} onChange={(v) => setForm((f: any) => ({ ...f, productId: v }))} onSearchChange={setProductSearch} placeholder="Buscar producto…" ariaLabel="Producto" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold">Cantidad faltante</Label>
                <Input type="number" min="0" step="any" value={form.quantity} onChange={(e) => setForm((f: any) => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold">Precio unitario (opcional)</Label>
                <Input type="number" min="0" step="any" value={form.unitPrice ?? ''} placeholder="De la factura" onChange={(e) => setForm((f: any) => ({ ...f, unitPrice: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold">Tratamiento</Label>
              <Select value={form.treatment} onValueChange={(v) => setForm((f: any) => ({ ...f, treatment: v }))}>
                <SelectTrigger aria-label="Tratamiento"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TREATMENTS).map(([value, t]) => <SelectItem key={value} value={value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">{TREATMENTS[form.treatment]?.hint}</p>
            </div>
            {form.treatment === 'DRIVER_CHARGE' && (
              <div className="space-y-1">
                <Label className="text-[10px] font-bold">Conductor {context?.driverEmployeeId ? '(tomado del viaje; puedes cambiarlo)' : ''}</Label>
                <Combobox options={employeeOptions} value={form.driverEmployeeId} onChange={(v) => setForm((f: any) => ({ ...f, driverEmployeeId: v }))} onSearchChange={setEmployeeSearch} placeholder="Buscar empleado…" ariaLabel="Conductor" />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold">Notas</Label>
              <Input value={form.notes || ''} onChange={(e) => setForm((f: any) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cerrar</Button>
            <Button disabled={!canSubmit || createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? 'Registrando…' : 'Registrar y contabilizar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
