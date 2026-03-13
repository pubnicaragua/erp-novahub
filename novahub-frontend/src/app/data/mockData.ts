export const nicaraguaCompanies = [
    { id: 'C001', name: 'Grupo Agrícola BAC', email: 'contacto@grupobac.com.ni', phone: '+505 2200-1111', contact: 'Edxel Vargas', status: 'Activo' },
    { id: 'C002', name: 'Distribuidora Dos Pinos Nicaragua', email: 'ventas@dospinos.com.ni', phone: '+505 2200-2222', contact: 'Jair Narvaez', status: 'Activo' },
    { id: 'C003', name: 'Claro Nicaragua', email: 'corporativo@claro.com.ni', phone: '+505 2200-3333', contact: 'Sergio Jonathan Guadamuz', status: 'Activo' },
    { id: 'C004', name: 'Tigo Nicaragua', email: 'empresas@tigo.com.ni', phone: '+505 2200-4444', contact: 'Andre Rojas', status: 'Activo' },
    { id: 'C005', name: 'Compañía Cervecera de Nicaragua', email: 'info@ccn.com.ni', phone: '+505 2200-5555', contact: 'Juan Perez', status: 'Activo' },
    { id: 'C006', name: 'Grupo Pellas', email: 'contacto@grupopellas.com', phone: '+505 2200-6666', contact: 'Carlos Sanchez', status: 'Activo' },
    { id: 'C007', name: 'Casa Pellas', email: 'ventas@casapellas.com.ni', phone: '+505 2200-7777', contact: 'Ana Garcia', status: 'Activo' },
    { id: 'C008', name: 'SINSA', email: 'proyectos@sinsa.com.ni', phone: '+505 2200-8888', contact: 'Luis Martinez', status: 'Activo' },
    { id: 'C009', name: 'Supermercados La Colonia', email: 'proveedores@lacolonia.com.ni', phone: '+505 2200-9999', contact: 'Maria Lopez', status: 'Activo' },
    { id: 'C010', name: 'Walmart Nicaragua', email: 'compras.ni@walmart.com', phone: '+505 2200-1010', contact: 'Jose Ruiz', status: 'Inactivo' },
    { id: 'C011', name: 'Café Soluble S.A.', email: 'exportaciones@cafesoluble.com', phone: '+505 2200-1212', contact: 'Laura Hernandez', status: 'Activo' },
    { id: 'C012', name: 'Cargill de Nicaragua', email: 'logistica@cargill.com.ni', phone: '+505 2200-1313', contact: 'Mario Gomez', status: 'Activo' },
    { id: 'C013', name: 'Grupo Q Nicaragua', email: 'flotas@grupoq.com.ni', phone: '+505 2200-1414', contact: 'Diana Diaz', status: 'Activo' },
    { id: 'C014', name: 'BAC Credomatic', email: 'pymes@bac.com.ni', phone: '+505 2200-1515', contact: 'Roberto Reyes', status: 'Activo' },
    { id: 'C015', name: 'Banco Lafise Bancentro', email: 'empresas@lafise.com.ni', phone: '+505 2200-1616', contact: 'Carmen Silva', status: 'Activo' },
    { id: 'C016', name: 'Banpro Grupo Promerica', email: 'creditos@banpro.com.ni', phone: '+505 2200-1717', contact: 'Pedro Castillo', status: 'Activo' },
    { id: 'C017', name: 'FICOHSA Nicaragua', email: 'banca@ficohsa.com.ni', phone: '+505 2200-1818', contact: 'Sofia Herrera', status: 'Activo' },
    { id: 'C018', name: 'Eskimo S.A. (Lala)', email: 'distribucion@eskimo.com.ni', phone: '+505 2200-1919', contact: 'Hugo Medina', status: 'Activo' },
    { id: 'C019', name: 'COMASA', email: 'ventas@comasa.com.ni', phone: '+505 2200-2020', contact: 'Rosa Mendieta', status: 'Activo' },
    { id: 'C020', name: 'Macen S.A.', email: 'info@macensa.com.ni', phone: '+505 2200-2121', contact: 'Diego Castro', status: 'Activo' }
];

// Helper to get initial data based on resource
export const getInitialDataFor = (resource: 'clientes' | 'proveedores' | string) => {
    return [...nicaraguaCompanies].map(c => ({
        ...c,
        id: `${resource === 'clientes' ? 'C' : 'P'}${c.id.slice(1)}`
    }));
};

export const nicaraguaUsers = [
    { id: 'usr_1', name: 'Edxel Vargas', email: 'edxel@erp.com', role: 'admin', status: 'Activo' },
    { id: 'usr_2', name: 'Jair Narvaez', email: 'jair@erp.com', role: 'manager', status: 'Activo' },
    { id: 'usr_3', name: 'Andre Rojas', email: 'andre@erp.com', role: 'employee', status: 'Inactivo' },
    { id: 'usr_4', name: 'Sergio Jonathan Guadamuz', email: 'sergio@erp.com', role: 'viewer', status: 'Activo' },
    { id: 'usr_5', name: 'Juan Perez', email: 'juan@erp.com', role: 'admin', status: 'Activo' }
];
