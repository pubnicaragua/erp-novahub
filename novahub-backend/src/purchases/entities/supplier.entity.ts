import { EntityStatus } from "@prisma/client";

export class Supplier {
    id: string;
    clientTenantId: string;
    code: string;
    name: string;
    taxId?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    contactName?: string;
    paymentTerms?: string;
    status: EntityStatus;
    createdAt: Date;
    updatedAt: Date;
}
