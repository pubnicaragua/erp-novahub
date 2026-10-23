import { createDefaultTemplateDefinition, createPdfTemplateSampleData, createSystemDefaultPdfDesign } from '../../../src/app/services/pdf-template-definition';
import { renderPdfTemplateToPdf } from '../../../src/app/utils/pdf-template-renderer';

async function main() {
  const targetKey = new URLSearchParams(location.search).get('target') || 'inventario.products';
  const logo = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="84" viewBox="0 0 300 84"><rect width="300" height="84" fill="white"/><text x="4" y="62" font-family="Arial" font-size="58" font-weight="700" fill="#01422c">Nova</text><text x="154" y="62" font-family="Arial" font-size="58" font-weight="700" fill="#75b843">Hub</text></svg>');
  const company = {
    name: 'NOVA ERP', slogan: 'Soluciones claras para cada proyecto',
    fiscalInfo: 'RUC DEMO-000123', address: 'Rotonda El Güegüense, 2 cuadras al sur, Managua, Nicaragua',
    phone: '+505 2222-0101', email: 'contacto@horizonte-demo.example',
    website: 'https://horizonte-demo.example', footerText: 'Gracias por confiar en nosotros.', logo,
  };
  const settings = { ...createSystemDefaultPdfDesign(targetKey).settings, headerComposition: 'company-left-logo-right', showCompanyName: true, companyName: 'NOVA ERP', logoUrl: logo, logoSize: 34, showPageNumber: true };
  const base = createDefaultTemplateDefinition(targetKey, settings);
  // Simula el indicador heredado que se encontró en la definición guardada real.
  const definition = { ...base, nodes: base.nodes.map(node => node.id === 'company-logo' ? { ...node, firstPageOnly: true } : node) };
  const inventoryColumns = [
    { id: 'code', label: 'Código', token: 'code', width: 14, align: 'left' as const },
    { id: 'name', label: 'Nombre', token: 'name', width: 26, align: 'left' as const },
    { id: 'category', label: 'Categoría', token: 'category', width: 16, align: 'left' as const },
    { id: 'unit', label: 'Unidad', token: 'unit', width: 12, align: 'left' as const },
    { id: 'stock', label: 'Stock', token: 'stock', width: 10, align: 'right' as const },
    { id: 'price', label: 'Precio', token: 'price', width: 12, align: 'right' as const },
    { id: 'status', label: 'Estado', token: 'status', width: 10, align: 'right' as const },
  ];
  const inventoryRows = Array.from({ length: 40 }, (_, index) => ({
    code: `SKU-${String(index + 1).padStart(4, '0')}`,
    name: ['Laptop empresarial', 'Teléfono móvil', 'Impresora multifuncional', 'Monitor LED'][index % 4],
    category: ['Computación', 'Telefonía', 'Accesorios'][index % 3],
    unit: 'Unidad', stock: String(index * 3), price: `C$ ${(899 + index * 25).toFixed(2)}`, status: 'Activo',
  }));
  const sample = createPdfTemplateSampleData(targetKey);
  let data: any;
  if (targetKey === 'ventas.cash-session') {
    const section = (id: string, title: string, labels: string[], widths: number[], values: string[][]) => ({
      id, title,
      columns: labels.map((label, index) => ({ id: `column-${index}`, label, token: `column-${index}`, width: widths[index], align: index === labels.length - 1 ? 'right' as const : 'left' as const })),
      rows: values.map(row => Object.fromEntries(row.map((value, index) => [`column-${index}`, value]))),
    });
    const summaryColumns = ['Concepto', 'Monto'];
    const movementColumns = ['Referencia', 'Tipo', 'Descripción', 'Hora', 'Monto'];
    data = {
      ...sample, company, pdfCompanyProfile: company, logo,
      document: { title: 'RESUMEN DE SESIÓN DE CAJA', number: 'Caja 1', date: '19/10/2026 9:00 a. m.', status: 'Cerrada', notes: '' },
      party: { name: 'Gabriel Tinoco' },
      reportSections: [
        section('cash-summary', 'Resumen del turno', summaryColumns, [68, 32], [['Ventas', 'C$ 3,000.00'], ['Gastos', 'C$ 500.00'], ['Saldo esperado', 'C$ 2,500.00']]),
        section('cash-movements', 'Movimientos de caja', movementColumns, [19, 15, 34, 12, 20], Array.from({ length: 20 }, (_, index) => [`MOV-${String(index + 1).padStart(4, '0')}`, index % 2 ? 'Gasto' : 'Venta', index % 2 ? 'Compra de suministros para el local' : 'Venta en efectivo de productos', `10:${String(index % 60).padStart(2, '0')} a. m.`, index % 2 ? '-C$ 125.00' : 'C$ 1,250.00'])),
      ],
    };
  } else if (targetKey === 'ventas.order') {
    const items = [
      { description: 'Computadora portátil empresarial\nCódigo: CMP-001\nSKU variante: CMP-001-16G-512\nNombre variante: Gris / 16 GB / 512 GB\nAtributos: RAM: 16 GB · SSD: 512 GB', quantity: '2', unitPrice: 'C$ 28,500.00', total: 'C$ 57,000.00' },
      { description: 'Servicio de instalación', quantity: '1', unitPrice: 'C$ 1,250.00', total: 'C$ 1,250.00' },
    ];
    data = {
      ...sample, company, pdfCompanyProfile: company, logo,
      document: { ...sample.document, title: 'ORDEN DE VENTA', number: 'OV-000123', date: '19/10/2026', status: 'Pendiente', notes: '' },
      customer: { ...sample.customer, name: 'Comercial La Colonia', taxId: 'J0310000000000', address: 'Carretera Norte, Managua', phone: '+505 8888-0000', email: 'compras@lacolonia.example', contact: 'María López' },
      party: { ...sample.customer, name: 'Comercial La Colonia', taxId: 'J0310000000000', address: 'Carretera Norte, Managua', phone: '+505 8888-0000', email: 'compras@lacolonia.example', contact: 'María López' },
      items, rows: items, totals: { subtotal: 'C$ 58,250.00', tax: 'C$ 8,737.50', discount: '', total: 'C$ 66,987.50' },
    };
  } else if (targetKey === 'compras.purchase-order') {
    const items = [
      { description: 'Papel carta Premium\nCódigo: PAP-001\nSKU variante: PAP-001-BL\nNombre variante: Blanco\nAtributos: Tamaño: Carta', quantity: '12', unitPrice: 'C$ 185.00', total: 'C$ 2,220.00' },
      { description: 'Tóner compatible TN-450', quantity: '2', unitPrice: 'C$ 840.00', total: 'C$ 1,680.00' },
    ];
    data = {
      ...sample, company, pdfCompanyProfile: company, logo,
      document: { ...sample.document, title: 'ORDEN DE COMPRA', number: 'OC-000123', date: '19/10/2026', status: 'Pendiente', notes: '' },
      party: sample.supplier, supplier: sample.supplier,
      items, rows: items, totals: { subtotal: 'C$ 3,900.00', tax: 'C$ 585.00', discount: '', total: 'C$ 4,485.00' },
    };
  } else {
    data = {
      company, pdfCompanyProfile: company, logo,
      document: { title: 'Listado de productos', period: 'Período: registros filtrados: 40', generated: 'Generado: 19/10/2026 10:00 a. m.' },
      reportSections: [{ id: 'products', title: 'Listado de productos', columns: inventoryColumns, rows: inventoryRows }],
      items: inventoryRows, rows: inventoryRows, tableColumns: inventoryColumns,
    };
  }
  const result = await renderPdfTemplateToPdf({ definition, settings: settings as any, targetKey, data: data as any, fileName: 'pdf-header-continuation-check.pdf', save: false });
  const frame = document.createElement('iframe');
  frame.title = 'Vista del PDF multipágina';
  const pdfUrl = URL.createObjectURL(result.blob);
  frame.src = pdfUrl;
  document.querySelector('main')!.append(frame);
  const download = document.createElement('a');
  download.href = pdfUrl;
  download.download = `pdf-visual-${targetKey.replaceAll('.', '-')}.pdf`;
  download.click();
  document.getElementById('state')!.textContent = `${result.doc.getNumberOfPages()} páginas · ${targetKey} · prueba de logo heredado y cabecera de tabla`;
}

void main().catch(error => { document.getElementById('state')!.textContent = String(error?.stack || error); });
