import type { Customer } from '../types';
import { DEFAULT_CUSTOMER_COUNTRIES, countryCodeFromLegacy } from './customer-data';
import { formatCurrencyAmount } from './currency';

type CustomerPdfRow = Record<string, string>;

function customerIdentification(customer: Customer): string {
  const countryCode = String(customer.countryCode || countryCodeFromLegacy(customer.country) || '').toUpperCase();
  const country = DEFAULT_CUSTOMER_COUNTRIES.find((item) => item.code === countryCode);
  const rucLabel = countryCode === 'CL' ? 'RUT' : 'RUC';
  const identifiers = [
    customer.taxId ? `${country?.taxIdLabel || 'Identificación fiscal'}: ${customer.taxId}` : '',
    customer.ruc ? `${rucLabel}: ${customer.ruc}${customer.dv ? `-${customer.dv}` : ''}` : '',
  ].filter(Boolean);

  return identifiers.join(' · ') || '—';
}

export function buildCustomerPdfRows(customers: Customer[], includeConsumption: boolean): CustomerPdfRow[] {
  return customers.map((customer) => {
    const row: CustomerPdfRow = {
      Código: customer.code || '—',
      Cliente: customer.name || '—',
      Identificación: customerIdentification(customer),
      Teléfono: customer.phone || customer.contactPhone || '—',
      'Lista de precios': customer.priceList?.name || '—',
    };

    if (includeConsumption) {
      const totals = (customer.consumptionByCurrency || [])
        .filter((item) => Number.isFinite(Number(item.amount)))
        .sort((left, right) => left.currency.localeCompare(right.currency))
        .map((item) => formatCurrencyAmount(item.amount, item.currency, true));
      row['Total consumido'] = totals.join(' · ') || '—';
    }

    return row;
  });
}
