async (page) => await page.evaluate(async () => {
  const { generateConfiguredReportSectionsPDF } = await import('/src/app/utils/pdfGenerator.ts');
  const result = await generateConfiguredReportSectionsPDF({
    targetKey: 'inventario.products',
    title: 'Listado de productos',
    tenantName: 'NOVA ERP',
    sections: [{ id: 'products', title: 'Productos', headers: ['Código', 'Descripción', 'Categoría', 'Unidad', 'Existencias', 'Precio', 'Estado'], rows: [['SKU001', 'Dolovitalgia', 'Medicamentos', 'Unidad', '0', 'C$ 100.00', 'Activo']] }],
    fileName: 'foreignobject-inventory-single-row.pdf',
    save: true,
  });
  return { result: !!result, canvas: !!window.__pdfAuditCanvas };
})

