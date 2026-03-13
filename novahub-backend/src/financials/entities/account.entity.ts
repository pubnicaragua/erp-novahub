import { AccountType } from "@prisma/client";

export class Account {
    id: string;
    clientTenantId: string;
    code: string;
    name: string;
    type: AccountType;
    description?: string;
    balance: number;
    createdAt: Date;
    updatedAt: Date;
}
