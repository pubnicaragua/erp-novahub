import type { Message } from '../../types';

export function upsertMessageThread<T extends Message>(threads: T[] | undefined, thread: T): T[] {
  return [thread, ...(threads || []).filter((item) => item.id !== thread.id)]
    .sort((left, right) => new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime());
}

export function updateMessageThread<T extends Message>(
  threads: T[] | undefined,
  threadId: string,
  update: (thread: T) => T,
): T[] {
  return (threads || []).map((thread) => thread.id === threadId ? update(thread) : thread);
}
