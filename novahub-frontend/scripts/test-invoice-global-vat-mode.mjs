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
assert.match(source, /payload\.pricingMode = updatePricingMode/, 'invoice updates keep the pricing mode explicit in the API payload');
assert.match(source, /onClick=\{\(\) => changePricingMode\('global'\)\}/, 'the Global button uses the recalculating handler');
assert.match(source, /onClick=\{\(\) => changePricingMode\('individual'\)\}/, 'the per-product button uses the recalculating handler');
assert.match(source, /const taxableSubtotal = subtotal/, 'global IVA uses the complete product and service subtotal');
assert.doesNotMatch(source, /IVA del servicio en esta factura/, 'global mode does not expose a second service IVA control');
assert.match(source, /pricingMode === 'individual' && \(\s*<div className="col-span-2 mt-0 grid/, 'line-level IVA controls remain inside individual mode');

console.log('test-invoice-global-vat-mode OK');
