const fs = require('fs');
const path = require('path');

const viewsDir = 'c:/Users/Probook 450 G7/BE-NH/novahub-frontend/src/app/components/ventas';
const files = fs.readdirSync(viewsDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(viewsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix 1: Add onBulkDelete to EditableDataTable
  if (content.includes('EditableDataTable') && !content.includes('onBulkDelete={')) {
    let serviceMatch = content.match(/await (\w+Service)\.delete/);
    if (!serviceMatch) {
       serviceMatch = content.match(/(\w+Service)\.create/);
    }
    const serviceName = serviceMatch ? serviceMatch[1] : null;

    if (serviceName) {
      content = content.replace(/<EditableDataTable([\s\S]*?)data=\{filtered\}/, `<EditableDataTable$1data={filtered}\n          onBulkDelete={async (ids) => {
            try {
              for (const id of ids) {
                if (String(id).startsWith('new-')) continue;
                await ${serviceName}.delete(id as string);
              }
              toast.success('Elementos eliminados');
              onRefresh();
            } catch (e) {
              toast.error('Error al eliminar');
            }
          }}`);
    }
  }

  // Fix 2: Replace onClick={() => toast.info(...)} with setEditingId
  const toastInfoRegex = /onClick=\{\(\) => toast\.info\(`[^`]+`\)\}/g;
  if (toastInfoRegex.test(content)) {
    content = content.replace(toastInfoRegex, 'onClick={() => setEditingId(row.id)}');
    if (!content.includes('const [editingId, setEditingId]')) {
      content = content.replace(/const \[searchTerm, setSearchTerm\] = useState\(''\);/, 
        `const [searchTerm, setSearchTerm] = useState('');\n  const [editingId, setEditingId] = useState<string | null>(null);`);
    }
  }
  
  // Also fix the eye button on OrdenesVentaView that doesn't use row.id properly
  content = content.replace(/onClick=\{\(\) => toast\.info\(`Orden \$\{row\.number\}[^`]+`\)\}/g, 'onClick={() => setEditingId(row.id)}');

  fs.writeFileSync(filePath, content);
}
console.log('Fixed onBulkDelete and eye icons in views');
