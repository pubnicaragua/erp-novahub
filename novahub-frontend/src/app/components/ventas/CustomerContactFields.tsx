import { useEffect, useState } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Combobox } from '../ui/Combobox';
import { customersService } from '../../services/ventas.service';
import {
  customerIdentifierHint, customerPhoneHint, countryName, countryOption, DEFAULT_CUSTOMER_COUNTRIES,
  formatCustomerIdentifierInput, formatCustomerPhoneForDisplay, formatCustomerPhoneInput,
} from '../../utils/customer-data';
import type { CustomerCountryOption } from '../../utils/customer-data';

export function useCustomerFormOptions() {
  const [countries, setCountries] = useState<CustomerCountryOption[]>(DEFAULT_CUSTOMER_COUNTRIES);
  const [defaultCountryCode, setDefaultCountryCode] = useState('NI');
  useEffect(() => {
    let mounted = true;
    customersService.getFormOptions().then((response) => {
      if (!mounted) return;
      if (response?.countries?.length) {
        setCountries(response.countries.map((country) => ({
          ...country,
          name: countryName(country.code, [country]),
        })));
      }
      if (response?.defaultCountryCode) setDefaultCountryCode(response.defaultCountryCode);
    }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);
  return { countries, defaultCountryCode };
}

type SharedProps = { id: string; disabled?: boolean; className?: string; labelClassName?: string };

export function CustomerCountrySelect({ value, onChange, countries, disabled, id = 'customer-country' }: { value: string; onChange: (value: string) => void; countries: CustomerCountryOption[]; disabled?: boolean; id?: string }) {
  return <div className="min-w-0 space-y-1.5">
    <Label htmlFor={id} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">País</Label>
    <Combobox
      id={id}
      value={value}
      onChange={(nextValue) => { if (nextValue) onChange(nextValue); }}
      options={countries.map((country) => ({
        value: country.code,
        label: `${country.name} (+${country.phoneCode})`,
      }))}
      placeholder="Seleccionar país"
      searchPlaceholder="Buscar país o prefijo..."
      emptyMessage="No se encontró el país."
      maxVisibleOptions={countries.length}
      disabled={disabled}
      ariaLabel="País del cliente"
      className="h-11 rounded-xl border-border bg-background px-3 text-sm"
      contentClassName="min-w-[280px] max-w-[calc(100vw-2rem)]"
    />
  </div>;
}

export function CustomerPhoneInput({ value, onChange, countryCode, label = 'Teléfono', ...props }: SharedProps & { value: string; onChange: (value: string) => void; countryCode: string; label?: string }) {
  const display = formatCustomerPhoneForDisplay(value, countryCode);
  const hint = customerPhoneHint(value, countryCode);
  const { id, disabled, className, labelClassName } = props;
  return <div className="min-w-0 space-y-1.5">
    <Label htmlFor={id} className={labelClassName || 'text-[10px] font-black uppercase tracking-widest text-muted-foreground'}>{label}</Label>
    <Input id={id} disabled={disabled} type="tel" inputMode="tel" value={display} onChange={(event) => onChange(formatCustomerPhoneInput(event.target.value, countryCode))} placeholder={countryCode === 'NI' ? '8888-8888' : `+${countryOption(countryCode).phoneCode} ...`} className={className || 'h-11 rounded-xl'} />
    {hint && <p className="text-[10px] text-muted-foreground" aria-live="polite">{hint}</p>}
  </div>;
}

export function CustomerIdentifierInput({ value, onChange, countryCode, kind, label, required, ...props }: SharedProps & { value: string; onChange: (value: string) => void; countryCode: string; kind: 'taxId' | 'ruc'; label?: string; required?: boolean }) {
  const selected = countryOption(countryCode);
  const resolvedLabel = label || (kind === 'taxId' ? selected.taxIdLabel : selected.rucLabel);
  const hint = customerIdentifierHint(value, kind, countryCode);
  const { id, disabled, className, labelClassName } = props;
  return <div className="min-w-0 space-y-1.5">
    <Label htmlFor={id} className={labelClassName || 'text-[10px] font-black uppercase tracking-widest text-muted-foreground'}>{resolvedLabel} {required && <span className="text-destructive">*</span>}</Label>
    <Input id={id} disabled={disabled} value={formatCustomerIdentifierInput(value, kind, countryCode)} onChange={(event) => onChange(formatCustomerIdentifierInput(event.target.value, kind, countryCode))} placeholder={countryCode === 'NI' ? (kind === 'taxId' ? '001-010190-1000A' : 'J0310000000000') : 'Identificación opcional'} required={required} className={className || 'h-11 rounded-xl'} />
    {hint && <p className="text-[10px] text-muted-foreground" aria-live="polite">{hint}</p>}
  </div>;
}

export function countryNameForForm(code: string, countries: CustomerCountryOption[]) {
  return countryName(code, countries);
}
