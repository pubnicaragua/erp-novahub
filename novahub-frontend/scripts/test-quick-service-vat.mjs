import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/app/components/ventas/SalesProductPicker.tsx', import.meta.url), 'utf8');
assert.match(source, /const \[quickServiceTaxable, setQuickServiceTaxable\] = useState\(true\)/, 'quick services default to product-like taxable behavior and remain configurable');
assert.match(source, /taxRate: quickServiceTaxable \? 0\.15 : 0/, 'quick-service creation sends the selected VAT rate');
assert.match(source, /Aplica IVA \(15%\)/, 'quick-service form exposes an explicit VAT toggle');

console.log('test-quick-service-vat OK');
