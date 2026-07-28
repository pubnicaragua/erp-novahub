import { ProductosView } from './ProductosView';

interface ServiciosViewProps {
  products: any[];
  categories: any[];
  warehouses?: any[];
  series?: any[];
  movements?: any[];
  onRefresh: () => void;
}

/** Catálogo de servicios: comparte la tabla responsive, pero nunca mezcla inventario físico. */
export function ServiciosView(props: ServiciosViewProps) {
  return <ProductosView {...props} itemType="SERVICE" />;
}
