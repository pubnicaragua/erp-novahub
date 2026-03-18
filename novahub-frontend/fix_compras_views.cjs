const fs = require('fs');
const path = require('path');

const comprasDir = path.join(__dirname, 'src/app/components/compras');

const viewFiles = [
  'OrdenesCompraView.tsx',
  'RecepcionesCompraView.tsx',
  'FacturasProveedorView.tsx',
  'PagosRealizadosView.tsx',
  'GastosView.tsx',
  'GastosRecurrentesView.tsx',
  'FacturasProveedorRecView.tsx',
  'CreditosProveedorView.tsx'
];

const serviceMap = {
  'OrdenesCompraView.tsx': 'purchaseOrdersService',
  'RecepcionesCompraView.tsx': 'purchaseReceiptsService',
  'FacturasProveedorView.tsx': 'supplierInvoicesService',
  'PagosRealizadosView.tsx': 'paymentsMadeService',
  'GastosView.tsx': 'expensesService',
  'GastosRecurrentesView.tsx': 'recurringExpensesService',
  'FacturasProveedorRecView.tsx': 'recurringSupplierInvoicesService',
  'CreditosProveedorView.tsx': 'supplierCreditsService'
};

viewFiles.forEach(fileName => {
  const filePath = path.join(comprasDir, fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipping ${fileName} - file not found`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const serviceName = serviceMap[fileName];
  
  // 1. Add editingId state if not present
  if (!content.includes('const [editingId, setEditingId]')) {
    content = content.replace(
      /const \[searchTerm, setSearchTerm\] = useState\(''\);/,
      `const [searchTerm, setSearchTerm] = useState('');\n  const [editingId, setEditingId] = useState<string | null>(null);`
    );
  }

  // 2. Fix Eye icon to use setEditingId instead of toast.info
  content = content.replace(
    /onClick=\{\(\) => toast\.info\([^}]+\)\}><Eye/g,
    `onClick={() => setEditingId(row.id)}><Eye`
  );

  // 3. Add onBulkDelete prop to EditableDataTable
  if (!content.includes('onBulkDelete=')) {
    content = content.replace(
      /<EditableDataTable data=\{filtered\} columns=\{columns\} onRowUpdate=\{handleUpdate\} isLoading=\{loading\}/,
      `<EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading}\n          onBulkDelete={async (ids) => {\n            try {\n              for (const id of ids) {\n                if (String(id).startsWith('new-')) continue;\n                await ${serviceName}.delete(id as string);\n              }\n              toast.success('Elementos eliminados');\n              onRefresh();\n            } catch (e) {\n              toast.error('Error al eliminar');\n            }\n          }}`
    );
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Fixed ${fileName}`);
});

console.log('\n🎉 All Compras views fixed!');
