import { ProductosView } from './ProductosView';
import type { SalesPaginationControls } from '../../types';

interface ServiciosViewProps {
  products: any[];
  summaryProducts?: any[];
  categories: any[];
  warehouses?: any[];
  series?: any[];
  movements?: any[];
  onRefresh: () => void;
  pagination?: SalesPaginationControls;
  onSearchChange?: (value: string) => void;
  onCategoryChange?: (value: string[]) => void;
  onWarehouseChange?: (value: string[]) => void;
  isSidebarCollapsed?: boolean;
}

/** Catálogo de servicios: comparte la tabla responsive, pero nunca mezcla inventario físico. */
export function ServiciosView(props: ServiciosViewProps) {
  return <ProductosView {...props} itemType="SERVICE" />;
}
