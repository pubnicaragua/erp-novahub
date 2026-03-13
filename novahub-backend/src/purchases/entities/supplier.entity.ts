import { EntityStatus } from "@prisma/client";

export class Supplier {
    id: string;
    clientTenantId: string;
    code: string;
    name: string;
    email?: string;
    phone?: string;
    status: EntityStatus;
    createdAt: Date;
    updatedAt: Date;
}
