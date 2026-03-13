import { CustomerType, EntityStatus } from "@prisma/client";

export class Customer {
    id: string;
    clientTenantId: string;
    code: string;
    name: string;
    type: CustomerType;
    email?: string;
    phone?: string;
    status: EntityStatus;
    createdAt: Date;
    updatedAt: Date;
}
