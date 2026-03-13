import { DocumentStatus } from "@prisma/client";

export class Project {
    id: string;
    clientTenantId: string;
    name: string;
    description?: string;
    startDate: Date;
    endDate?: Date;
    status: DocumentStatus;
    budget: number;
    createdAt: Date;
    updatedAt: Date;
}
