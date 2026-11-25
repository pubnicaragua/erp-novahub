import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/app/components/ventas/FacturasView.tsx', import.meta.url), 'utf8');
const handlerStart = source.indexOf('const changePricingMode =');
assert.notEqual(handlerStart, -1, 'invoice pricing-mode changes recalculate the document');

const handlerEnd = source.indexOf('const applyVoiceLinesToInvoice', handlerStart);
const handler = source.slice(handlerStart, handlerEnd);
assert.match(handler, /mode === 'global' \? \{ dRate: 0, tRate: 15 \} : \{ dRate: 0, tRate: 0 \}/, 'global mode enables the global 15% IVA rate');
assert.match(handler, /recalcTotals\(itemsForMode, nextRates\.dRate, nextRates\.tRate, mode\)/, 'totals recalculate using the selected mode, not stale React state');
assert.match(handler, /pricingMode: mode/, 'the selected pricing mode is sent when an existing invoice is updated');
assert.match(source, /const updatePricingMode = String\(\(updates as any\)\.pricingMode \|\| pricingMode\)\.toLowerCase\(\)/, 'invoice updates use the requested mode before React state settles');
assert.match(source, /resolveItemType\(item\) === 'SERVICE' && updatePricingMode === 'global'/, 'global updates include each taxable service rate in the API payload');
assert.match(source, /onClick=\{\(\) => changePricingMode\('global'\)\}/, 'the Global button uses the recalculating handler');
assert.match(source, /onClick=\{\(\) => changePricingMode\('individual'\)\}/, 'the per-product button uses the recalculating handler');
assert.match(source, /const getEffectiveServiceTaxRate =/, 'invoice rows resolve a service VAT override before falling back to its catalog setting');
assert.match(source, /const updateInvoiceItemTaxRate =/, 'service VAT can be changed on an unsaved invoice line');
assert.match(source, /IVA del servicio en esta factura/, 'the global invoice editor exposes an accessible service VAT toggle');
assert.match(source, /item\.taxRate !== undefined && item\.taxRate !== null/, 'an explicit service exemption is respected over its catalog default');

console.log('test-invoice-global-vat-mode OK');
