async (page) => await page.evaluate(async () => {
  const { generateEstimatePDF } = await import('/src/app/utils/pdfGenerator.ts');
  const result = await generateEstimatePDF({
    estimate: { number: 'QA-ORDER-001', date: '2026-10-19', status: 'Pendiente', currency: 'NIO', exchangeRate: 1, customer: { name: 'Cliente de prueba', taxId: 'J0310000000000', address: 'Carretera Norte, Managua', phone: '+505 8888-0000', email: 'cliente@example.com' }, items: [{ description: 'Producto de prueba con descripción en varias líneas para comprobar el centrado vertical de cantidad y monto', quantity: 2, unitPrice: 500, total: 1000 }, { description: 'Servicio adicional', quantity: 1, unitPrice: 150, total: 150 }], subtotal: 1150, taxAmount: 0, discountAmount: 0, total: 1150, notes: '' },
    tenantName: 'NOVA ERP', formatAmount: (amount) => `C$ ${Number(amount).toFixed(2)}`, documentType: 'order', save: true, withImages: false,
  });
  return { blob: result.blob.size };
})
