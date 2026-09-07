import { AddProductsModal } from './AddProductsModal';

interface CrearProductoViewProps {
  categories: any[];
  warehouses: any[];
  brands: string[];
  onBack: () => void;
  onRefresh: () => void;
}

/**
 * Pantalla dedicada para crear productos. Reutiliza el formulario existente,
 * pero lo presenta como una vista completa para que el formulario de variantes
 * tenga el ancho y la altura disponibles sin sumar otra sección de inventario.
 */
export function CrearProductoView({ categories, warehouses, brands, onBack, onRefresh }: CrearProductoViewProps) {
  return (
    <AddProductsModal
      open
      presentation="page"
      onOpenChange={(open) => {
        if (!open) onBack();
      }}
      categories={categories}
      warehouses={warehouses}
      brands={brands}
      onRefresh={onRefresh}
      itemType="PRODUCT"
    />
  );
}
