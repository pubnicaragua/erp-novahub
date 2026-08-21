export type ManagerInventoryView =
  | 'overview'
  | 'branchInventory'
  | 'corporateInventory'
  | 'products'
  | 'services'
  | 'warehouses'
  | 'corporateWarehouses'
  | 'transfers'
  | 'adjustments'
  | 'audits'
  | 'losses'
  | 'movements'
  | 'assets';

export const MANAGER_INVENTORY_VIEWS: Array<{ id: ManagerInventoryView; label: string }> = [
  { id: 'overview', label: 'Resumen de inventario' },
  { id: 'products', label: 'Productos' },
  { id: 'services', label: 'Servicios' },
  { id: 'warehouses', label: 'Bodegas' },
  { id: 'corporateWarehouses', label: 'Almacenes' },
  { id: 'transfers', label: 'Transferencias' },
  { id: 'adjustments', label: 'Ajustes' },
  { id: 'audits', label: 'Auditorías' },
  { id: 'losses', label: 'Pérdidas' },
  { id: 'movements', label: 'Movimientos' },
  { id: 'assets', label: 'Mobiliario y equipos' },
];
