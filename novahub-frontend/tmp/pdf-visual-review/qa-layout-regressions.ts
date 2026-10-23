import { createDefaultTemplateDefinition, createPdfTemplateSampleData, createSystemDefaultPdfDesign } from '../../src/app/services/pdf-template-definition';
import { renderPdfTemplateToPdf } from '../../src/app/utils/pdf-template-renderer';

type ReviewData = Record<string, any>;

function makeLogo(tall: boolean) {
  const width = tall ? 120 : 300;
  const height = tall ? 260 : 84;
  const content = tall
    ? '<rect width="120" height="260" rx="14" fill="#f8fafc"/><circle cx="60" cy="74" r="43" fill="#01422c"/><path d="M28 75l22 22 44-48" fill="none" stroke="#80bd4d" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><text x="60" y="180" text-anchor="middle" font-family="Arial" font-size="23" font-weight="700" fill="#01422c">SINTECH</text>'
    : '<rect width="300" height="84" rx="10" fill="#f8fafc"/><text x="12" y="59" font-family="Arial" font-size="48" font-weight="700" fill="#01422c">Nova</text><text x="164" y="59" font-family="Arial" font-size="48" font-weight="700" fill="#80bd4d">Hub</text>';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${content}</svg>`)}`;
}

function buildStressRows(targetKey: string, data: ReviewData) {
  if (targetKey === 'ventas.invoice') {
    data.items = Array.from({ length: 30 }, (_, index) => ({
      description: `Producto de prueba ${index + 1}: descripción extensa para verificar la altura variable de las filas y el salto de página.`,
      quantity: (index % 4) + 1,
      unitPrice: 125 + index * 7,
      total: ((index % 4) + 1) * (125 + index * 7),
    }));
    data.rows = data.items;
    data.totals = { subtotal: 'C$ 37,845.00', tax: 'C$ 5,676.75', discount: 'C$ 0.00', total: 'C$ 43,521.75' };
  }

  if (targetKey === 'ventas.customers') {
    const section = data.reportSections?.[0];
    if (section) {
      section.rows = Array.from({ length: 42 }, (_, index) => {
        const values = [
          `CLI-${String(index + 1).padStart(5, '0')}`,
          index === 0 ? 'Comercializadora Centroamericana de Productos y Servicios Integrales' : `Cliente empresarial de prueba ${index + 1}`,
          index % 3 ? 'Empresa' : 'Particular',
          index === 0 ? 'María Fernanda López Gómez' : `Contacto ${index + 1}`,
          index === 0 ? 'contacto.comercial.departamento@sintech.example' : `cliente${index + 1}@empresa.example`,
          `+505 2222-${String(1000 + index).slice(-4)}`,
          index % 7 ? 'Activo' : 'Inactivo',
        ];
        return Object.fromEntries(values.map((value, columnIndex) => [`column-${columnIndex}`, value]));
      });
      data.items = section.rows;
      data.rows = section.rows;
    }
  }

  if (targetKey === 'ventas.customer-history') {
    const entity = {
      name: 'Distribuidora Centroamericana de Productos Farmacéuticos y Suministros Médicos, Sociedad Anónima',
      taxId: 'J0310000000000',
      address: 'Carretera Norte, kilómetro 4.5, complejo industrial, bodega principal número 12, Managua, Nicaragua',
      phone: '+505 2222-0101 / +505 8888-0202',
      email: 'administracion.comercial@distribuidoracentroamericana.example',
      contact: 'María Fernanda López Gómez, Gerencia de Compras',
      balanceDue: 'C$ 1,150.00',
      balanceFavor: 'C$ 250.00',
      balanceSummary: 'En contra: C$ 1,150.00',
    };
    data.party = entity;
    data.customer = entity;
    const sourceRows = Array.isArray(data.items) ? data.items : [];
    data.items = Array.from({ length: 28 }, (_, index) => {
      const source = sourceRows[index % Math.max(1, sourceRows.length)] || {};
      return { ...source, description: `${source.description || 'Factura FAC-000124'} · Movimiento de prueba ${index + 1}` };
    });
    data.rows = data.items;
    data.history = data.items;
  }
}

async function main() {
  const params = new URLSearchParams(location.search);
  const targetKey = params.get('target') || 'ventas.invoice';
  const stress = params.get('case') === 'stress';
  const settings = {
    ...createSystemDefaultPdfDesign(targetKey).settings,
    headerComposition: 'company-left-logo-right',
    showCompanyName: true,
    companyName: stress ? 'SINTECH SOLUCIONES TECNOLÓGICAS Y COMERCIALES DE NICARAGUA' : 'SINTECH',
    slogan: stress ? 'Soluciones integrales de tecnología, automatización y acompañamiento para empresas de toda Centroamérica' : 'Tecnología y soluciones para empresas',
    fiscalInfo: 'RUC 001-290890-1045A',
    address: stress ? 'Carretera Norte, kilómetro 4.5, complejo industrial, módulo administrativo número 12, Managua, Nicaragua' : 'Managua, Nicaragua',
    phone: '+505 2222-0101',
    email: stress ? 'contacto.ventas.empresariales@sintech-centroamerica.example' : 'contacto@sintech.example',
    website: 'https://sintech.example',
    footerText: 'SINTECH · Managua, Nicaragua',
    logoUrl: makeLogo(stress),
    logoSize: 34,
    showPageNumber: true,
  };
  const definition = createDefaultTemplateDefinition(targetKey, settings);
  const sample = createPdfTemplateSampleData(targetKey) as ReviewData;
  const company = {
    ...(sample.company || {}),
    name: settings.companyName,
    slogan: settings.slogan,
    fiscalInfo: settings.fiscalInfo,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    website: settings.website,
    footerText: settings.footerText,
    logo: settings.logoUrl,
  };
  const data: ReviewData = { ...sample, company, pdfCompanyProfile: company, logo: settings.logoUrl, renderScale: 1.5 };
  if (stress) buildStressRows(targetKey, data);

  const result = await renderPdfTemplateToPdf({
    definition,
    settings: settings as any,
    targetKey,
    data,
    fileName: `qa-${targetKey}-${stress ? 'stress' : 'base'}.pdf`,
    save: false,
  });
  const blobUrl = URL.createObjectURL(result.blob);
  const iframe = document.createElement('iframe');
  iframe.title = targetKey;
  iframe.src = blobUrl;
  document.getElementById('preview')!.append(iframe);
  const state = document.getElementById('state')!;
  state.textContent = `${targetKey} · ${stress ? 'estrés' : 'base'} · ${result.doc.getNumberOfPages()} página(s)`;
  const download = document.getElementById('download') as HTMLAnchorElement;
  download.href = blobUrl;
  download.download = `qa-${targetKey}-${stress ? 'stress' : 'base'}.pdf`;
  download.hidden = false;
}

void main().catch(error => {
  document.getElementById('state')!.textContent = String(error?.stack || error);
});
