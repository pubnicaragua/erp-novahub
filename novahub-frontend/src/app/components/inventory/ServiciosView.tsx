import { ProductosView } from './ProductosView';
import type { ProductExportOptions } from './ProductosView';
import type { SalesPaginationControls } from '../../types';

interface ServiciosViewProps {
  products: any[];
  summaryProducts?: any[];
  summaryProductsLoaded?: boolean;
  summaryAggregate?: {
    total: number;
    available: number;
    low: number;
    out: number;
    serviceCategories: number;
    serviceWeeklyAverage: number;
    serviceAveragePrice: number;
    brands: Array<{ value: string; label: string; count: number }>;
  };
  summaryLoading?: boolean;
  summaryError?: boolean;
  onLoadFullCatalog?: () => Promise<any[]>;
  onSummaryFiltersChange?: (filters: {
    unit: string;
    taxRate: string;
    availability: 'all' | 'available' | 'unavailable';
    showAllWarehouseProducts: boolean;
  }) => void;
  categories: any[];
  warehouses?: any[];
  branches?: any[];
  series?: any[];
  movements?: any[];
  onRefresh: () => void;
  onExport?: (options: ProductExportOptions) => Promise<void> | void;
  isRefreshing?: boolean;
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
