import { createServer } from 'vite';
const server = await createServer({ configFile: 'tmp/pdf-visual-review/vite.long.config.ts', server: { middlewareMode: true }, appType: 'custom' });
try {
  const mod = await server.ssrLoadModule('/src/app/services/pdf-template-definition.ts');
  for (const target of ['compras.list', 'compras.supplier-history', 'ventas.customers']) {
    const design = mod.createSystemDefaultPdfDesign(target);
    const node = design.layoutZones.definition.nodes.find(item => item.id === 'items-table' || item.type === 'report-sections');
    console.log(JSON.stringify({ target, orientation: design.settings.orientation, type: node?.type, columns: node?.columns?.map(column => ({id: column.id, token: column.token, label: column.label, width: column.width})) }));
  }
} finally { await server.close(); }
