import { InventarioPage } from './InventarioPage';

/**
 * Alias histórico. La pantalla canónica de transferencias vive dentro del
 * módulo de Inventario y consume el catálogo real de ubicaciones autorizadas.
 */
export function TransferenciasPage() {
  return <InventarioPage activeSubModule="transferencias" />;
}
