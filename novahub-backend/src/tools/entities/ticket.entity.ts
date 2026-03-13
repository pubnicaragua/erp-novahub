import { TicketStatus, Priority } from "@prisma/client";

export class Ticket {
    id: string;
    clientTenantId: string;
    number: string;
    subject: string;
    description: string;
    customerId: string;
    status: TicketStatus;
    priority: Priority;
    createdAt: Date;
    updatedAt: Date;
}
