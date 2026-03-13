import { Priority, TaskStatus } from "@prisma/client";

export class Task {
    id: string;
    projectId: string;
    clientTenantId: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: Priority;
    dueDate?: Date;
    assignedToId?: string;
    createdAt: Date;
    updatedAt: Date;
}
