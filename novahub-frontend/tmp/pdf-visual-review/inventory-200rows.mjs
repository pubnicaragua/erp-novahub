async (page) => await page.evaluate(async () => {
  const { generateConfiguredReportSectionsPDF } = await import('/src/app/utils/pdfGenerator.ts');
  const rows = Array.from({ length: 200 }, (_, index) => [`SKU${String(index + 1).padStart(4, '0')}`, `Producto de prueba ${index + 1}`, index % 2 ? 'Medicamentos de cuidado general' : 'Limpieza', 'Unidad', String(index), `C$ ${(index + 1) * 100}.00`, 'Activo']);
  const result = await generateConfiguredReportSectionsPDF({ targetKey: 'inventario.products', title: 'Listado de productos', tenantName: 'NOVA ERP', sections: [{ id: 'products', title: 'Productos', headers: ['Código', 'Descripción', 'Categoría', 'Unidad', 'Existencias', 'Precio', 'Estado'], rows }], fileName: 'foreignobject-inventory-200rows.pdf', save: true });
  return { pages: result.doc?.getNumberOfPages?.() ?? null };
})
