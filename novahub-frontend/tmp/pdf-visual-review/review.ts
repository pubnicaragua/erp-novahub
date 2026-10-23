import { createDefaultTemplateDefinition, createPdfTemplateSampleData, createSystemDefaultPdfDesign } from '../../src/app/services/pdf-template-definition';
import { renderPdfTemplateToPdf } from '../../src/app/utils/pdf-template-renderer';

async function main() {
  const targetKey = (window as any).__PDF_TARGET__ || 'ventas.cash-session';
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
