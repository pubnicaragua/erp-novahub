import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMessageText } from '../src/app/components/notificaciones/message-text.ts';
import { dropMessageAttachmentFiles } from '../src/app/components/notificaciones/message-attachment-input.ts';

test('converts http, https, and www links while preserving trailing punctuation', () => {
  const content = 'Docs http://legacy.example.test, https://docs.example.test/guide, and www.example.test/help!';
  const parts = parseMessageText(content);

  assert.deepEqual(parts.filter((part) => part.href), [
    { text: 'http://legacy.example.test', href: 'http://legacy.example.test' },
    { text: 'https://docs.example.test/guide', href: 'https://docs.example.test/guide' },
    { text: 'www.example.test/help', href: 'https://www.example.test/help' },
  ]);
  assert.equal(parts.map((part) => part.text).join(''), content);
});

test('keeps plain text, unsafe protocols, and malformed URLs as non-links', () => {
  const content = 'Texto normal javascript:alert(1) data:text/html,bad http://';
  const parts = parseMessageText(content);

  assert.deepEqual(parts, [{ text: content }]);
  assert.equal(parts.some((part) => part.href && !/^https?:\/\//i.test(part.href)), false);
});

test('dropping a file into the history forwards it to the draft attachment handler', () => {
  const file = { name: 'inventario.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 512 };
  const dataTransfer = { types: ['Files'], files: [file], items: [] };
  let prevented = false;
  let attached = [];

  dropMessageAttachmentFiles({ dataTransfer, preventDefault: () => { prevented = true; } }, (files) => { attached = files; });

  assert.equal(prevented, true);
  assert.deepEqual(attached, [file]);
});

test('ignores non-file drops', () => {
  let prevented = false;
  let addCalls = 0;

  dropMessageAttachmentFiles({
    dataTransfer: { types: ['text/plain'], files: [], items: [{ kind: 'string' }] },
    preventDefault: () => { prevented = true; },
  }, () => { addCalls += 1; });

  assert.equal(prevented, false);
  assert.equal(addCalls, 0);
});
