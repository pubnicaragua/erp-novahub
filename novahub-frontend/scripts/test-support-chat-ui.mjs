import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = 5191;
const baseUrl = `http://127.0.0.1:${port}`;
const apiUrl = `${baseUrl}/api`;
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root,
  env: { ...process.env, VITE_API_URL: apiUrl, VITE_E2E_DISABLE_SENTRY: '1' },
  stdio: 'ignore',
});

let browser;

async function dragFilesOverTarget(page, target, files, dropHint, visibleWithin = null) {
  await target.evaluate((element, selectedFiles) => {
    const transfer = new DataTransfer();
    for (const selectedFile of selectedFiles) {
      const contents = selectedFile.sizeBytes ? new Uint8Array(selectedFile.sizeBytes) : selectedFile.content;
      transfer.items.add(new File([contents], selectedFile.name, { type: selectedFile.type }));
    }
    window.__supportChatTestTransfer = transfer;
    element.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, files);
  const dropStatus = page.getByRole('status').filter({ hasText: dropHint });
  await dropStatus.waitFor({ state: 'visible' });
  if (visibleWithin) {
    const overlay = await dropStatus.boundingBox();
    const bounds = await visibleWithin.boundingBox();
    assert.ok(overlay && bounds, 'el indicador de arrastre debe tener límites medibles');
    assert.ok(overlay.y >= bounds.y && overlay.y + overlay.height <= bounds.y + bounds.height, 'el indicador debe quedar visible dentro del área que recibe el archivo');
  }
  await target.evaluate((element) => {
    const transfer = window.__supportChatTestTransfer;
    element.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    delete window.__supportChatTestTransfer;
  });
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Vite terminó antes de iniciar (código ${server.exitCode}).`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      // El servidor todavía está iniciando.
    }
    await delay(500);
  }
  assert.equal(ready, true, 'Vite debe iniciar para ejecutar la comprobación de interfaz.');

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const tokenPayload = Buffer.from(JSON.stringify({ sub: 'support-agent-ui-test' })).toString('base64url');
  const token = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${tokenPayload}.ui-test`;
  const now = Date.now();
  const conversations = Array.from({ length: 30 }, (_, conversationIndex) => ({
    id: `support:conversation-${conversationIndex}`,
    supportConversationId: `conversation-${conversationIndex}`,
    title: 'Carga de archivos',
    kind: 'SUPPORT',
    participant: { id: `branch-${conversationIndex}`, name: `Sucursal soporte ${conversationIndex + 1}` },
    preview: 'Mensaje de ejemplo para revisar el panel de conversaciones.',
    lastMessageAt: new Date(now - conversationIndex * 60_000).toISOString(),
    unreadCount: 0,
    canReply: true,
    messages: Array.from({ length: conversationIndex === 0 ? 55 : 1 }, (_, messageIndex) => ({
      id: `message-${conversationIndex}-${messageIndex}`,
      content: conversationIndex === 0 && messageIndex === 0
        ? 'Abre https://example.test/docs y www.example.test/ayuda.'
        : `Mensaje de historial ${messageIndex + 1}.`,
      sender: { id: 'tenant-user', name: 'Usuario de sucursal' },
      recipient: { id: 'support-agent-ui-test', name: 'Soporte técnico' },
      createdAt: new Date(now - messageIndex * 60_000).toISOString(),
      mine: false,
      isRead: true,
      attachments: [],
    })),
  }));
  let sentMessageCount = 0;
  let preparedUploads = 0;

  await page.addInitScript((authToken) => window.localStorage.setItem('nh-auth-token', authToken), token);
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.hostname === 'storage.local') {
      const headers = {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'PUT, OPTIONS',
        'access-control-allow-headers': 'content-type, x-upsert',
      };
      await route.fulfill({ status: method === 'OPTIONS' ? 204 : 200, headers, body: '' });
      return;
    }
    if (!url.pathname.includes('/api/')) {
      await route.continue();
      return;
    }

    const json = (body, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
    if (url.pathname.endsWith('/auth/profile')) {
      await json({ id: 'support-agent-ui-test', name: 'Soporte técnico', email: 'ui-test@example.test', role: 'platform_support_agent' });
    } else if (url.pathname.endsWith('/support-conversations/conversations') && method === 'GET') {
      await json(conversations);
    } else if (url.pathname.endsWith('/support-conversations/targets')) {
      await json({ groups: [] });
    } else if (url.pathname.endsWith('/support-conversations/events')) {
      await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: ': ready\n\n' });
    } else if (url.pathname.includes('/support-conversations/attachments/uploads') && method === 'POST' && !url.pathname.endsWith('/complete')) {
      preparedUploads += 1;
      if (preparedUploads === 1) {
        await delay(500);
        await json({ message: 'Fallo de carga simulado.' }, 503);
        return;
      }
      await json({ uploadId: `upload-${preparedUploads}`, bucket: 'test', path: `file-${preparedUploads}`, token: 'test-token', signedUrl: 'http://storage.local/upload' });
    } else if (/\/support-conversations\/attachments\/uploads\/[^/]+\/complete$/.test(url.pathname)) {
      await json({ id: 'attachment-ui-test', fileName: 'captura.pdf', mimeType: 'application/pdf', byteSize: 512 });
    } else if (/\/support-conversations\/conversations\/[^/]+\/messages$/.test(url.pathname) && method === 'POST') {
      sentMessageCount += 1;
      await json(conversations[0]);
    } else if (url.pathname.endsWith('/read')) {
      await json({ success: true });
    } else {
      await json({});
    }
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Bandeja de soporte' }).waitFor({ state: 'visible', timeout: 20_000 });
  await page.getByTestId('support-chat-inbox').getByRole('button').first().click();
  await page.getByTestId('support-chat-history').waitFor({ state: 'visible' });

  const secureLink = page.getByRole('link', { name: /Abrir enlace https:\/\/example\.test\/docs/ });
  await secureLink.waitFor({ state: 'visible' });
  assert.equal(await secureLink.getAttribute('target'), '_blank');
  assert.equal(await secureLink.getAttribute('rel'), 'noopener noreferrer');
  assert.equal(await page.getByRole('link', { name: /Abrir enlace www\.example\.test\/ayuda/ }).getAttribute('href'), 'https://www.example.test/ayuda');

  const history = page.getByTestId('support-chat-history');
  const inbox = page.getByTestId('support-chat-inbox');
  const overflow = await page.evaluate(() => ({
    page: document.documentElement.scrollHeight > document.documentElement.clientHeight,
    history: document.querySelector('[data-testid="support-chat-history"]').scrollHeight > document.querySelector('[data-testid="support-chat-history"]').clientHeight,
    inbox: document.querySelector('[data-testid="support-chat-inbox"]').scrollHeight > document.querySelector('[data-testid="support-chat-inbox"]').clientHeight,
  }));
  assert.equal(overflow.page, false, 'el documento no debe tener desplazamiento vertical');
  assert.equal(overflow.history, true, 'el historial debe desplazarse de manera independiente');
  assert.equal(overflow.inbox, true, 'la bandeja debe desplazarse de manera independiente');

  await history.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const pinnedPanels = await page.evaluate(() => {
    const header = document.querySelector('[data-testid="support-chat-header"]').getBoundingClientRect();
    const composer = document.querySelector('[data-testid="support-reply-form"]').getBoundingClientRect();
    return { headerTop: header.top, composerBottom: composer.bottom, viewportHeight: window.innerHeight };
  });
  assert.ok(pinnedPanels.headerTop >= 0, 'el encabezado del chat debe permanecer visible al desplazar el historial');
  assert.ok(pinnedPanels.composerBottom <= pinnedPanels.viewportHeight, 'el compositor debe permanecer visible al desplazar el historial');

  await dragFilesOverTarget(page, history, [{ name: 'captura.pdf', type: 'application/pdf', content: 'contenido de prueba' }], 'Suelta los archivos para adjuntarlos al borrador', history);
  await page.getByRole('progressbar', { name: 'Carga de captura.pdf' }).waitFor({ state: 'visible', timeout: 3_000 });
  await page.getByRole('alert').filter({ hasText: 'Fallo de carga simulado.' }).waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: 'Reintentar carga de captura.pdf' }).click();
  await page.getByText('Listo para enviar').first().waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByRole('button', { name: 'Quitar captura.pdf antes de enviar' }).waitFor({ state: 'visible' });
  assert.equal(sentMessageCount, 0, 'soltar el archivo solo debe agregarlo al borrador');
  await page.getByRole('button', { name: 'Quitar captura.pdf antes de enviar' }).click();

  const uploadCountBeforeTextareaDrop = preparedUploads;
  const replyInput = page.getByLabel('Responder a la sucursal');
  await dragFilesOverTarget(page, replyInput, [{ name: 'campo.pdf', type: 'application/pdf', content: 'contenido de campo' }], 'Suelta los archivos para adjuntarlos');
  await page.getByText('Listo para enviar').first().waitFor({ state: 'visible', timeout: 10_000 });
  const draftAttachments = page.getByRole('list', { name: 'Archivos adjuntos' }).locator('li');
  assert.equal(await draftAttachments.count(), 1, 'soltar sobre el campo no debe agregar el mismo archivo dos veces');
  assert.equal(preparedUploads, uploadCountBeforeTextareaDrop + 1, 'soltar sobre el campo debe iniciar una sola carga');
  await page.getByRole('button', { name: 'Quitar campo.pdf antes de enviar' }).click();

  await dragFilesOverTarget(page, history, [{ name: 'archivo-grande.pdf', type: 'application/pdf', sizeBytes: 10 * 1024 * 1024 + 1 }], 'Suelta los archivos para adjuntarlos al borrador', history);
  await page.getByRole('alert').filter({ hasText: 'Cada archivo debe pesar como máximo 10 MB.' }).waitFor({ state: 'visible' });
  assert.equal(preparedUploads, uploadCountBeforeTextareaDrop + 1, 'el archivo que excede el límite no debe iniciar la carga');
  await dragFilesOverTarget(page, history, [{ name: 'archivo.exe', type: 'application/octet-stream', content: 'no permitido' }], 'Suelta los archivos para adjuntarlos al borrador', history);
  await page.getByRole('alert').filter({ hasText: 'Formato no permitido.' }).waitFor({ state: 'visible' });
  assert.equal(preparedUploads, uploadCountBeforeTextareaDrop + 1, 'un formato no admitido no debe llegar al servicio de carga');
  await page.getByRole('button', { name: 'Quitar archivo.exe antes de enviar' }).click();
  assert.equal(sentMessageCount, 0, 'retirar o soltar archivos nunca debe enviar un mensaje');

  for (const theme of ['light', 'dark']) {
    await page.evaluate((selectedTheme) => document.documentElement.classList.toggle('dark', selectedTheme === 'dark'), theme);
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: width === 768 ? 1024 : 800 });
      const dimensions = await page.evaluate(() => ({
        pageOverflow: document.documentElement.scrollHeight > document.documentElement.clientHeight,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        historyOverflow: document.querySelector('[data-testid="support-chat-history"]').scrollHeight > document.querySelector('[data-testid="support-chat-history"]').clientHeight,
      }));
      assert.equal(dimensions.pageOverflow, false, `el documento no debe desplazarse a ${width}px en tema ${theme}`);
      assert.equal(dimensions.horizontalOverflow, false, `la vista no debe desbordar horizontalmente a ${width}px en tema ${theme}`);
      assert.equal(dimensions.historyOverflow, true, `el historial debe conservar su scroll interno a ${width}px en tema ${theme}`);
      await page.getByTestId('support-chat-header').waitFor({ state: 'visible' });
      await page.getByLabel('Responder a la sucursal').waitFor({ state: 'visible' });
    }
  }

  await replyInput.focus();
  await replyInput.fill('Línea uno');
  await replyInput.press('Shift+Enter');
  assert.equal(await replyInput.inputValue(), 'Línea uno\n', 'Shift+Enter debe insertar una nueva línea');
  await replyInput.fill('');
  const composerBounds = await page.getByTestId('support-reply-form').boundingBox();
  assert.ok(composerBounds && composerBounds.height <= 60, 'el compositor vacío debe conservar la altura compacta');
  assert.equal(sentMessageCount, 0, 'la verificación no debe enviar mensajes');
  console.log('Interfaz de soporte comprobada: scroll interno, encabezado/compositor visibles, enlaces seguros y adjunto agregado al borrador sin enviar.');
} finally {
  await browser?.close();
  server.kill();
}
