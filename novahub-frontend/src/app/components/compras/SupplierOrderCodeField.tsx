import { useRef, useState } from 'react';
import { Input } from '../ui/input';
import { toast } from '@/app/services/toast';
import { purchaseOrdersService } from '../../services/compras.service';

interface Props {
  /** null mientras la orden no se ha guardado: entonces el código viaja con el guardado normal. */
  orderId: string | null | undefined;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSaved?: () => void;
}

/**
 * Código de pedido que asigna el proveedor. En una orden ya guardada se guarda al salir del campo, incluso si ya está
 * aprobada: el proveedor suele darlo después y no cambia montos ni contabilidad.
 */
export function SupplierOrderCodeField({ orderId, value, disabled, onChange, onSaved }: Props) {
  const savedValue = useRef(value);
  const lastOrder = useRef(orderId);
  const [saving, setSaving] = useState(false);
  if (lastOrder.current !== orderId) {
    lastOrder.current = orderId;
    savedValue.current = value;
  }
  const persisted = Boolean(orderId) && !String(orderId).startsWith('local-') && orderId !== 'NEW';

  const save = async () => {
    const next = value.trim();
    if (!persisted || disabled || next === savedValue.current.trim()) return;
    setSaving(true);
    try {
      await purchaseOrdersService.setSupplierOrderCode(String(orderId), next);
      savedValue.current = next;
      toast.success('Código de pedido del proveedor guardado.');
      onSaved?.();
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo guardar el código del pedido al proveedor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="mb-1 text-[10px] text-foreground">Pedido del proveedor Nº</p>
      <Input value={value} maxLength={40} disabled={disabled || saving} onChange={(event) => onChange(event.target.value)} onBlur={() => void save()} placeholder="Código que da el proveedor" className="h-8 text-xs font-bold" data-testid="purchase-order-supplier-code" />
    </div>
  );
}
