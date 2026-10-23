async (page) => await page.evaluate(async () => {
  const { generatePurchaseOrderPDF } = await import('/src/app/utils/pdfGenerator.ts');
  const doc = await generatePurchaseOrderPDF({
    order: { number: 'QA-PO-001', date: '2026-10-19', status: 'APPROVED', currency: 'NIO', exchangeRate: 1, supplier: { name: 'Proveedor de prueba', taxId: 'J0123456789012', address: 'Carretera a Masaya, Managua' }, items: [{ code: 'PROD-001', name: 'Insumo de prueba', description: 'Descripción de compra extensa para comprobar el centrado vertical en una fila de varias líneas y la legibilidad del encabezado', category: 'Suministros de oficina', quantity: 3, unitPrice: 250, total: 750 }, { code: 'SERV-001', name: 'Servicio adicional', description: 'Servicio adicional', quantity: 1, unitPrice: 150, total: 150 }], subtotal: 900, taxAmount: 0, withholdingAmount: 0, total: 900 },
    tenantName: 'NOVA ERP', formatAmount: (amount) => `C$ ${Number(amount).toFixed(2)}`,
  });
  return { pages: doc?.getNumberOfPages?.() ?? null };
})
