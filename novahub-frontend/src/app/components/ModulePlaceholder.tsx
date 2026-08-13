import { Module } from '../contexts/AuthContext';

interface ModulePlaceholderProps {
  module: Module;
}

const moduleInfo: Record<Module, { title: string; description: string }> = {
  inventario: { title: 'Inventario de Mercancías', description: 'Gestiona tu inventario de productos' },
  ventas: { title: 'Ventas', description: 'Administra ventas, facturas y clientes' },
  compras: { title: 'Compras', description: 'Gestiona ordenes de compra y proveedores' },
  finanzas: { title: 'Finanzas', description: 'Control de ingresos y gastos' },
  rh: { title: 'Recursos Humanos', description: 'Gestion de empleados y planillas' },
  clientes: { title: 'Clientes', description: 'Directorio de clientes' },
  proveedores: { title: 'Proveedores', description: 'Directorio de proveedores' },
  actividades: { title: 'Actividades', description: 'Calendario de actividades y tareas' },
  tickets: { title: 'Tickets y Soporte', description: 'Sistema de soporte interno' },
  documentos: { title: 'Documentos', description: 'Gestion documental' },
  notificaciones: { title: 'Notificaciones', description: 'Centro de notificaciones' },
  transferencias: { title: 'Transferencias', description: 'Transferencias entre almacenes' },
  reportes: { title: 'Reportes', description: 'Visualiza reportes y estadisticas' },
  roles: { title: 'Roles y Permisos', description: 'Configura roles de usuario y permisos' },
  configuracion: { title: 'Configuracion', description: 'Ajustes generales del sistema' },
  schema: { title: 'Base de Datos', description: 'Schema Prisma para desarrollo' },
};

export function ModulePlaceholder({ module }: ModulePlaceholderProps) {
  const info = moduleInfo[module];

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">{info.title}</h1>
        <p className="mt-2 text-muted-foreground">{info.description}</p>
        <p className="mt-4 text-sm text-muted-foreground/80">
          Este modulo esta en desarrollo
        </p>
      </div>
    </div>
  );
}
