
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const customerCode = 'CLI-049218';
  const customer = await prisma.customer.findFirst({
    where: { code: customerCode }
  });

  if (!customer) {
    console.log('Customer not found');
    return;
  }

  console.log('--- CUSTOMER ---');
  console.log(customer);

  const invoices = await prisma.invoice.findMany({ where: { customerId: customer.id } });
  const payments = await prisma.paymentReceived.findMany({ where: { customerId: customer.id } });
  const returns = await prisma.salesReturn.findMany({ where: { customerId: customer.id } });
  const creditNotes = await prisma.creditNote.findMany({ where: { customerId: customer.id } });

  console.log('\n--- INVOICES ---');
  invoices.forEach(i => console.log(`${i.number} | Status: ${i.status} | Total: ${i.total} | Currency: ${i.currency} | Rate: ${i.exchangeRate}`));

  console.log('\n--- PAYMENTS ---');
  payments.forEach(p => console.log(`${p.number} | Amount: ${p.amount} | BaseAmount: ${p.baseAmount} | Ref: ${p.reference}`));

  console.log('\n--- RETURNS ---');
  returns.forEach(r => console.log(`${r.number} | Status: ${r.status} | Total: ${r.total}`));

  console.log('\n--- CREDIT NOTES ---');
  creditNotes.forEach(c => console.log(`${c.number} | Status: ${c.status} | Total: ${c.total}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
