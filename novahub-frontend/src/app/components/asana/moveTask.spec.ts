import assert from 'node:assert/strict';
import { moveAsanaTask } from './moveTask.ts';

void (async () => {
  const calls: Array<{ path: string; body: unknown }> = [];
  const api = {
    post: async (path: string, body: unknown) => {
      calls.push({ path, body });
      return { id: 'task-1', sectionId: 'doing' };
    },
  };

  await moveAsanaTask(api, 'board-1', 'task-1', 'doing', 'task-2');

  assert.deepEqual(calls, [{
    path: '/asana/boards/board-1/tasks/move',
    body: { taskId: 'task-1', sectionId: 'doing', afterTaskId: 'task-2' },
  }]);
})();
