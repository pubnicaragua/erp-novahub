import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AddProductsModal } from './AddProductsModal';
import { EditProductModal } from './EditProductModal';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { inventoryService, type SimilarProductMatch } from '../../services/inventario.service';
import { toast } from '../../services/toast';

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
  const { baseCurrency, exchangeRate } = useCurrency();
  const { canPerform } = useAuth();
  const canEditExistingProduct = canPerform('INVENTORY_PRODUCTS', 'edit');
  const handoffToEditor = useRef(false);
  const editorHandoffComplete = useRef(false);
  const [createFormOpen, setCreateFormOpen] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);

  const handleSelectExistingProduct = async (match: SimilarProductMatch) => {
    if (!canEditExistingProduct) {
      toast.error('No tienes permiso para editar productos. Solicita acceso de edición.');
      return;
    }
    if (handoffToEditor.current) return;
    handoffToEditor.current = true;
    setIsLoadingProduct(true);
    try {
      const response = await inventoryService.getProduct(match.id);
      const product = (response as any)?.data || response;
      if (!product?.id) throw new Error('No se recibió el registro del producto.');
      editorHandoffComplete.current = true;
      setSelectedProduct(product);
      setCreateFormOpen(false);
    } catch {
      setCreateFormOpen(true);
      toast.error('No pudimos abrir el producto encontrado. Tus datos siguen disponibles; inténtalo nuevamente.');
    } finally {
      handoffToEditor.current = false;
      setIsLoadingProduct(false);
    }
  };

  return (
    <>
      <AddProductsModal
        open={createFormOpen}
        presentation="page"
        onOpenChange={(open) => {
          if (open) {
            editorHandoffComplete.current = false;
            setCreateFormOpen(true);
          } else if (!handoffToEditor.current && !editorHandoffComplete.current) {
            onBack();
          }
        }}
        categories={categories}
        warehouses={warehouses}
        brands={brands}
        onRefresh={onRefresh}
        onSelectExistingProduct={handleSelectExistingProduct}
        itemType="PRODUCT"
      />
      {isLoadingProduct && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/75 px-4 backdrop-blur-sm" role="status" aria-live="polite">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm font-semibold shadow-xl">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
            Abriendo el producto para editar…
          </div>
        </div>
      )}
      <EditProductModal
        product={selectedProduct}
        categories={categories}
        baseCurrency={baseCurrency}
        exchangeRate={Number(exchangeRate || 1)}
        onClose={() => {
          editorHandoffComplete.current = false;
          setSelectedProduct(null);
          onBack();
        }}
        onRefresh={onRefresh}
      />
    </>
  );
}
