import { Input } from '../ui/input';

interface Props {
  idPrefix: string;
  creditDays: string;
  creditLimit: string;
  onChange: (patch: { creditDays?: string; creditLimit?: string }) => void;
}

const labelClass = 'text-[10px] font-black uppercase tracking-widest text-muted-foreground';

/** Condiciones de crédito que el proveedor nos da. Solo se muestra si el superadmin habilitó la función para la empresa. */
export function SupplierCreditTermsFields({ idPrefix, creditDays, creditLimit, onChange }: Props) {
  return (
    <div className="grid gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label className={labelClass} htmlFor={`${idPrefix}-credit-days`}>Días de plazo</label>
        <Input id={`${idPrefix}-credit-days`} inputMode="numeric" value={creditDays} onChange={(event) => onChange({ creditDays: event.target.value.replace(/[^0-9]/g, '').slice(0, 3) })} placeholder="Ej.: 15" className="h-11 rounded-xl" />
        <p className="text-[10px] text-muted-foreground">La compra a crédito calcula con esto su fecha de vencimiento.</p>
      </div>
      <div className="space-y-1.5">
        <label className={labelClass} htmlFor={`${idPrefix}-credit-limit`}>Límite de crédito (opcional)</label>
        <Input id={`${idPrefix}-credit-limit`} inputMode="decimal" value={creditLimit} onChange={(event) => onChange({ creditLimit: event.target.value.replace(/[^0-9.]/g, '') })} placeholder="Sin límite" className="h-11 rounded-xl" />
        <p className="text-[10px] text-muted-foreground">Informativo: no bloquea compras.</p>
      </div>
    </div>
  );
}
