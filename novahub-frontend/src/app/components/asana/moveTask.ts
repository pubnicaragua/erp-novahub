type ApiClient = {
  post: (path: string, body: { taskId: string; sectionId: string; afterTaskId?: string }) => Promise<unknown>;
};

export function moveAsanaTask(api: ApiClient, boardId: string, taskId: string, sectionId: string, afterTaskId?: string) {
  return api.post(`/asana/boards/${boardId}/tasks/move`, { taskId, sectionId, ...(afterTaskId ? { afterTaskId } : {}) });
}
