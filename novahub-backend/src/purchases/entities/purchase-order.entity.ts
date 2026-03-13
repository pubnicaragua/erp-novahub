import { PurchaseOrderStatus } from "@prisma/client";

export class PurchaseOrder {
    id: string;
    clientTenantId: string;
    number: string;
    supplierId: string;
    date: Date;
    total: number;
    status: PurchaseOrderStatus;
    createdAt: Date;
    updatedAt: Date;
}
