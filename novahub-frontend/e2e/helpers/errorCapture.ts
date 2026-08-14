import { test as base, expect } from '@playwright/test';

export interface CapturedErrors {
  all: string[];
  api: string[];
  js: string[];
  console: string[];
}

const IGNORE_PATTERNS: RegExp[] = [
  /favicon/i,
  /webpack\/hot|vite\/client/i,
  /Download the React DevTools/i,
  /\[vite\]/i,
];

export const test = base.extend<{ captureErrors: CapturedErrors }>({
  captureErrors: async ({ page }, use) => {
    const captured: CapturedErrors = { all: [], api: [], js: [], console: [] };
    const ignore = (text: string) => IGNORE_PATTERNS.some((re) => re.test(text));

    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (ignore(text)) return;
      captured.all.push(`[console] ${text}`);
      captured.console.push(text);
      console.error('[captura:console]', text);
    });
    page.on('pageerror', (error) => {
      const text = error.message;
      if (ignore(text)) return;
      captured.all.push(`[pageerror] ${text}`);
      captured.js.push(text);
      console.error('[captura:pageerror]', text);
    });
    page.on('requestfailed', (request) => {
      if (!request.url().includes('/api/')) return;
      const text = `${request.method()} ${request.url()} -> ${request.failure()?.errorText || 'falló'}`;
      captured.all.push(`[requestfailed] ${text}`);
      captured.api.push(text);
      console.error('[captura:requestfailed]', text);
    });
    page.on('response', (response) => {
      if (!response.url().includes('/api/')) return;
      if (response.status() >= 500) {
        const text = `${response.status()} ${response.request().method()} ${response.url()}`;
        captured.all.push(`[http ${response.status()}] ${text}`);
        captured.api.push(text);
        console.error('[captura:http]', text);
      }
    });

    await use(captured);

    if (captured.all.length > 0) {
      const detail = captured.all.join('\n  • ');
      expect.soft(captured.all, `Se capturaron errores durante la prueba:\n  • ${detail}`).toEqual([]);
    }
  },
});

export { expect };
