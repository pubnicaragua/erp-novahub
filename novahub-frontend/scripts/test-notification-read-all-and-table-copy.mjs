import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';

const loadModule = async (path) => import(path).catch(() => ({}));

test('marks every notification group read and resets both unread counters', async () => {
  const { markNotificationGroupsRead } = await loadModule('../src/app/utils/notification-read-state.ts');
  assert.equal(typeof markNotificationGroupsRead, 'function', 'notification read-all state helper should exist');

  const page = {
    items: [
      { id: 'group-1', read: false, unreadCount: 2 },
      { id: 'group-2', read: false, unreadCount: 1 },
      { id: 'group-3', read: true, unreadCount: 0 },
    ],
    nextCursor: 'next-page',
    unreadGroupCount: 2,
    unreadNotificationCount: 3,
  };

  assert.deepEqual(markNotificationGroupsRead(page), {
    ...page,
    items: page.items.map((item) => ({ ...item, read: true, unreadCount: 0 })),
    unreadGroupCount: 0,
    unreadNotificationCount: 0,
  });
});

test('normalizes optional copy values without changing visible formatting', async () => {
  const { normalizeCopyText } = await loadModule('../src/app/utils/table-copy.ts');
  assert.equal(typeof normalizeCopyText, 'function', 'table copy text helper should exist');

  assert.equal(normalizeCopyText('  +505 8888-9999  '), '  +505 8888-9999  ');
  assert.equal(normalizeCopyText(1204), '1204');
  assert.equal(normalizeCopyText('   '), null);
  assert.equal(normalizeCopyText(null), null);
  assert.equal(normalizeCopyText(undefined), null);
  assert.equal(normalizeCopyText('—'), null);
});

test('extracts displayed text from table cells and excludes interactive content', async () => {
  const { getCopyTextFromNode } = await loadModule('../src/app/utils/table-copy.ts');
  assert.equal(typeof getCopyTextFromNode, 'function', 'table cell text extractor should exist');

  assert.equal(getCopyTextFromNode(React.createElement('span', null, 'Factura ', React.createElement('strong', null, 'F-104'))), 'Factura F-104');
  assert.equal(getCopyTextFromNode(React.createElement('button', null, 'Abrir registro')), null);
  assert.equal(getCopyTextFromNode(React.createElement('span', { onClick: () => undefined }, 'Abrir registro')), null);
});
