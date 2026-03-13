import { ProductType } from "@prisma/client";

export class Product {
    id: string;
    clientTenantId: string;
    code: string;
    name: string;
    description?: string;
    type: ProductType;
    price: number;
    createdAt: Date;
    updatedAt: Date;
}
