import { createDefaultTemplateDefinition, createPdfTemplateSampleData, createSystemDefaultPdfDesign, isStandardPdfLayoutTarget } from '../../src/app/services/pdf-template-definition';
import { PDF_TEMPLATE_TARGETS } from '../../src/app/services/pdf-document-catalog';
import { generateFastGlobalReportPDF } from '../../src/app/utils/pdfGenerator';
import { renderPdfTemplateToPdf } from '../../src/app/utils/pdf-template-renderer';

async function main() {
  const query = new URLSearchParams(location.search);
  if (query.get('fast') === '1') {
    const logoCanvas = document.createElement('canvas');
    logoCanvas.width = 300;
    logoCanvas.height = 84;
    const logoContext = logoCanvas.getContext('2d')!;
    logoContext.fillStyle = '#01422c';
    logoContext.font = '700 54px Arial';
    logoContext.fillText('NovaHub', 8, 62);
    const fastLogo = logoCanvas.toDataURL('image/png');
    const settings = {
      paperSize: 'LETTER', orientation: 'landscape', margins: 14,
      primaryColor: '#01422c', secondaryColor: '#0f3b65', textColor: '#334155', lineColor: '#d7dee7',
      companyName: 'NOVA ERP', slogan: 'Soluciones claras para cada proyecto', fiscalInfo: 'RUC DEMO-000123',
      address: 'Managua, Nicaragua', phone: '+505 2222-0101', email: 'contacto@horizonte-demo.example',
      website: 'https://horizonte-demo.example', logoUrl: fastLogo, footerText: '', showCompanyName: true, showPageNumber: true,
    };
    const columns = [
      { header: 'Código', width: 10, value: (row: any) => row.code },
      { header: 'Cliente', width: 18, value: (row: any) => row.name },
      { header: 'Tipo', width: 12, value: (row: any) => row.type },
      { header: 'Contacto', width: 16, value: (row: any) => row.contact },
      { header: 'Correo', width: 24, value: (row: any) => row.email },
      { header: 'Teléfono', width: 12, value: (row: any) => row.phone },
      { header: 'Estado', width: 8, value: (row: any) => row.status },
    ];
    const rows = Array.from({ length: 501 }, (_, index) => ({
      code: `CLI-${String(index + 1).padStart(5, '0')}`,
      name: `Cliente ${index + 1}`,
      type: index % 2 ? 'Empresa' : 'Particular',
      contact: `Contacto ${index + 1}`,
      email: `cliente${index + 1}@example.com`,
      phone: '+505 2222-0101',
      status: index % 4 ? 'Activo' : 'Inactivo',
    }));
    const fastReport = await generateFastGlobalReportPDF({
      targetKey: 'ventas.customers', title: 'Listado de clientes', tenantName: 'NOVA ERP', tenantLogo: fastLogo,
      settings, columns, rows, fileName: 'review-fast-customers.pdf', designOverride: { settings }, save: false,
    });
    const status = document.getElementById('state')!;
    status.textContent = `ventas.customers fast · ${fastReport.doc.getNumberOfPages()} página(s)`;
    const frame = document.createElement('iframe');
    frame.title = 'ventas.customers fast';
    frame.src = URL.createObjectURL(fastReport.blob);
    document.querySelector('main')!.append(frame);
    return;
  }
  if (query.get('batch') === 'sales-purchases') {
    const companyLogo = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="84" viewBox="0 0 300 84"><rect width="300" height="84" fill="white"/><text x="4" y="62" font-family="Arial" font-size="58" font-weight="700" fill="#01422c">Nova</text><text x="154" y="62" font-family="Arial" font-size="58" font-weight="700" fill="#75b843">Hub</text></svg>');
    const targets = PDF_TEMPLATE_TARGETS.filter(target => ['ventas', 'compras'].includes(target.module) && isStandardPdfLayoutTarget(target.key));
    const results: Array<{ target: string; pages?: number; bytes?: number; error?: string }> = [];
    for (const target of targets) {
      try {
        const settings = {
          ...createSystemDefaultPdfDesign(target.key).settings,
          headerComposition: 'company-left-logo-right',
          showCompanyName: true, companyName: 'NOVA ERP', slogan: 'Soluciones claras para cada proyecto',
          fiscalInfo: 'RUC DEMO-000123', address: 'Rotonda El Güegüense, Managua, Nicaragua',
          phone: '+505 2222-0101', email: 'contacto@horizonte-demo.example', website: 'https://horizonte-demo.example',
          footerText: '', logoUrl: companyLogo, showPageNumber: true,
        };
        const sample = createPdfTemplateSampleData(target.key);
        const company = { ...sample.company, name: 'NOVA ERP', slogan: settings.slogan, fiscalInfo: settings.fiscalInfo, address: settings.address, phone: settings.phone, email: settings.email, website: settings.website, logo: companyLogo };
        const definition = createDefaultTemplateDefinition(target.key, settings);
        const result = await renderPdfTemplateToPdf({
          definition, settings: settings as any, targetKey: target.key,
          data: { ...sample, company, pdfCompanyProfile: company, logo: companyLogo, renderScale: 1.1 },
          fileName: `batch-${target.key}.pdf`, save: false,
        });
        results.push({ target: target.key, pages: result.doc.getNumberOfPages(), bytes: result.blob.size });
      } catch (error: any) {
        results.push({ target: target.key, error: String(error?.message || error) });
      }
    }
    const failures = results.filter(result => result.error);
    const status = document.getElementById('state')!;
    status.textContent = `Ventas y compras: ${results.length - failures.length}/${results.length} PDF renderizados`;
    const output = document.createElement('pre');
    output.style.cssText = 'position:fixed;inset:40px 12px 12px;z-index:3;overflow:auto;background:#fff;padding:12px;font:12px monospace;white-space:pre-wrap';
    output.textContent = JSON.stringify(results, null, 2);
    document.body.append(output);
    return;
  }
  const targetKey = query.get('target') || (window as any).__PDF_TARGET__ || 'ventas.cash-session';
  const companyLogo = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="84" viewBox="0 0 300 84"><rect width="300" height="84" fill="white"/><text x="4" y="62" font-family="Arial" font-size="58" font-weight="700" fill="#01422c">Nova</text><text x="154" y="62" font-family="Arial" font-size="58" font-weight="700" fill="#75b843">Hub</text></svg>');
  const settings = {
    ...createSystemDefaultPdfDesign(targetKey).settings,
    headerComposition: 'company-left-logo-right',
    showCompanyName: true, companyName: 'NOVA ERP', slogan: 'Soluciones claras para cada proyecto',
    fiscalInfo: 'RUC DEMO-000123', address: 'Rotonda El Güegüense, 2 cuadras al sur, Managua, Nicaragua',
    phone: '+505 2222-0101', email: 'contacto@horizonte-demo.example', website: 'https://horizonte-demo.example',
    footerText: 'Gracias por confiar en nosotros.', logoUrl: companyLogo, logoSize: 34, showPageNumber: true,
  };
  const definition = createDefaultTemplateDefinition(targetKey, settings);
  const sample = createPdfTemplateSampleData(targetKey);
  const company = {
    ...sample.company, name: 'NOVA ERP', slogan: 'Soluciones claras para cada proyecto',
    fiscalInfo: 'RUC DEMO-000123', address: 'Rotonda El Güegüense, 2 cuadras al sur, Managua, Nicaragua',
    phone: '+505 2222-0101', email: 'contacto@horizonte-demo.example',
    website: 'https://horizonte-demo.example', footerText: 'Gracias por confiar en nosotros.', logo: companyLogo,
  };
  const data: any = { ...sample, company, pdfCompanyProfile: company, logo: companyLogo, renderScale: 1.5 };
  if (targetKey === 'compras.list') {
    data.tableColumns = [
      { id: 'column-0', token: 'column-0', label: 'Documento', width: 25, align: 'left' },
      { id: 'column-1', token: 'column-1', label: 'Proveedor', width: 35, align: 'left' },
      { id: 'column-2', token: 'column-2', label: 'Fecha', width: 18, align: 'left' },
      { id: 'column-3', token: 'column-3', label: 'Total', width: 22, align: 'right' },
    ];
    const rows = Array.from({ length: 18 }, (_, index) => ({
      'column-0': `COMP-${String(2026 - index).padStart(6, '0')}`,
      'column-1': index % 2 ? 'Distribuidora Suministros del Norte' : 'Comercial y Servicios La Colonia',
      'column-2': `${String(9 - (index % 8)).padStart(2, '0')}/09/2026`,
      'column-3': `C$ ${(1250 + index * 345.75).toLocaleString('es-NI', { minimumFractionDigits: 2 })}`,
    }));
    data.items = rows;
    data.rows = rows;
  }
  if (targetKey === 'compras.supplier-history') {
    const rows = Array.from({ length: 18 }, (_, index) => ({
      'column-0': `${String(9 - (index % 8)).padStart(2, '0')}/09/2026`,
      'column-1': index % 3 ? 'Factura' : 'Pago',
      'column-2': `PRO-${String(8800 + index).padStart(6, '0')}`,
      'column-3': index % 2 ? 'Compra de suministros de oficina y materiales de uso diario' : 'Pago parcial de factura de proveedor',
      'column-4': index % 2 ? '12' : '—',
      'column-5': 'C$ 125.00',
      'column-6': `C$ ${(1500 + index * 125).toLocaleString('es-NI', { minimumFractionDigits: 2 })}`,
    }));
    data.items = rows;
    data.rows = rows;
    data.history = rows;
  }
  if (targetKey === 'ventas.customers' && Array.isArray(data.reportSections?.[0]?.rows)) {
    const names = ['Comercializadora Centroamericana de Suministros', 'Distribuidora Nacional de Productos Industriales'];
    const rows = Array.from({ length: 16 }, (_, index) => ({
      'column-0': `CLI-${String(120 + index).padStart(5, '0')}`,
      'column-1': names[index % names.length],
      'column-2': index % 2 ? 'Empresa' : 'Particular',
      'column-3': index % 2 ? 'María Fernanda López Gutiérrez' : 'Carlos Alberto Martínez',
      'column-4': `contacto.${index}@distribuidora-centroamericana.example`,
      'column-5': `+505 2222-${String(1000 + index).padStart(4, '0')}`,
      'column-6': index % 5 ? 'Activo' : 'Inactivo',
    }));
    data.reportSections = [{ ...data.reportSections[0], rows }];
    data.items = rows;
    data.rows = rows;
    data.reportKpis = [
      { label: 'CLIENTES', value: '16', detail: 'En el listado' },
      { label: 'ACTIVOS', value: '12', detail: 'Estado activo' },
      { label: 'INACTIVOS', value: '4', detail: 'Estado inactivo' },
      { label: 'PARTICULARES', value: '8', detail: 'Personas' },
      { label: 'EMPRESAS', value: '8', detail: 'Organizaciones' },
    ];
  }
  if (targetKey === "compras.purchase-order") {
    data.items = Array.from({ length: 36 }, (_, index) => ({ description: "Artículo de prueba " + (index + 1), quantity: index + 1, unitPrice: "C$ 125.00", total: "C$ 125.00" }));
    data.rows = data.items;
  }
  if (targetKey === 'ventas.cash-session' && Array.isArray(data.reportSections)) {
    const createSection = (id: string, title: string, labels: string[], widths: number[], rows: string[][]) => ({
      id,
      title,
      columns: labels.map((label, index) => ({
        id: 'column-' + index,
        label,
        token: 'column-' + index,
        width: widths[index],
        align: index === labels.length - 1 ? 'right' : 'left',
      })),
      rows: rows.map(values => Object.fromEntries(values.map((value, index) => ['column-' + index, value]))),
    });
    data.reportSections = [
      createSection('cash-session-summary', 'Resumen del turno', ['Concepto', 'Monto'], [62, 38], [
        ['Fondo inicial', 'C$ 2,000.00'], ['Ventas', 'C$ 3,000.00'], ['Gastos', 'C$ 500.00'],
        ['Saldo esperado', 'C$ 4,500.00'], ['Efectivo contado', 'C$ 4,450.00'], ['Diferencia', 'C$ -50.00'],
      ]),
      createSection('cash-session-movements', 'Movimientos de caja', ['Referencia', 'Tipo', 'Descripción', 'Hora', 'Monto'], [19, 15, 34, 12, 20],
        Array.from({ length: 20 }, (_, index) => [
          'MOV-' + String(index + 1).padStart(4, '0'),
          index % 3 === 0 ? 'Venta' : 'Gasto',
          index % 3 === 0 ? 'Venta en efectivo de productos' : 'Compra de suministros para el local',
          '10:' + String(index % 60).padStart(2, '0') + ' a. m.',
          index % 3 === 0 ? 'C$ 1,250.00' : '-C$ 125.00',
        ])),
    ];
  }
  if (targetKey === 'ventas.customer-history' && Array.isArray(data.items)) {
    const sourceRows = data.items;
    data.items = Array.from({ length: 24 }, (_, index) => {
      const source = sourceRows[index % sourceRows.length];
      return { ...source, description: source.description + ' · Registro ' + String(index + 1).padStart(2, '0') };
    });
    data.rows = data.items;
    data.history = data.items;
  }
  const status = document.getElementById('state')!;
  const result = await renderPdfTemplateToPdf({
    definition, settings: settings as any, targetKey, data,
    fileName: 'review-' + targetKey + '.pdf', save: false,
  });
  const frame = document.createElement('iframe');
  frame.title = targetKey;
  frame.src = URL.createObjectURL(result.blob);
  document.querySelector('main')!.append(frame);
  status.textContent = targetKey + ' · ' + result.doc.getNumberOfPages() + ' página(s)';
}
void main().catch(error => { document.getElementById('state')!.textContent = String(error?.stack || error); });
