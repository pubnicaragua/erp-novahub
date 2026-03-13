import { PaymentStatus } from "@prisma/client";

export class Invoice {
    id: string;
    clientTenantId: string;
    number: string;
    customerId: string;
    date: Date;
    dueDate: Date;
    total: number;
    amountPaid: number;
    balance: number;
    status: PaymentStatus;
    createdAt: Date;
    updatedAt: Date;
}
