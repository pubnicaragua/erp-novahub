import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  let estimateId = process.argv[2];
  let clientTenantId = process.argv[3];

  if (!estimateId || !clientTenantId) {
    const firstEst = await prisma.estimate.findFirst();
    if (!firstEst) {
        console.error('No estimate found in DB');
        return;
    }
    estimateId = firstEst.id;
    clientTenantId = firstEst.clientTenantId;
    console.log(`Using first found estimate: ${estimateId} (Tenant: ${clientTenantId})`);
  }

  try {
    console.log(`Testing conversion for Estimate ${estimateId} and Tenant ${clientTenantId}`);
    
    const estimate = await prisma.estimate.findFirst({ 
      where: { id: estimateId, clientTenantId }, 
      include: { items: true } 
    });

    if (!estimate) {
      console.error('Estimate not found');
      return;
    }

    console.log('Estimate found:', estimate.number);
    console.log('Items found:', estimate.items.length);

    const itemsCreate = (estimate.items || []).map(item => ({
      productId: item.productId || null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      discount: item.discount,
      total: item.total,
    }));

    const orderData: any = {
      number: `TEST-ORD-${Date.now()}`,
      customerId: estimate.customerId,
      estimateId: estimate.id,
      date: new Date(),
      subtotal: estimate.subtotal,
      taxAmount: estimate.taxAmount,
      discountAmount: estimate.discountAmount,
      total: estimate.total,
      currency: estimate.currency,
      notes: `Test conversion`,
      status: 'PENDING_REVIEW',
      clientTenantId,
    };

    if (itemsCreate.length > 0) {
      orderData.items = { create: itemsCreate };
    }

    console.log('Attempting to create SalesOrder...');
    const order = await prisma.salesOrder.create({
      data: orderData,
      include: { items: true, customer: true },
    });
    console.log('SalesOrder created successfully:', order.id);

  } catch (error: any) {
    console.error('Error during conversion:');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('Meta:', JSON.stringify(error.meta, null, 2));
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

test();
