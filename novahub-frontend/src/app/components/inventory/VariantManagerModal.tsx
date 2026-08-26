import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Tag, Package, X, Check, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { inventoryService } from '../../services/inventario.service';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { ProductVariant } from '../../types/variants';
import { useAuth } from '../../contexts/AuthContext';

interface VariantManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: { id: string; code: string; name: string; isVariable?: boolean; linkedAttributes?: any[] } | null;
  onRefresh: () => void;
}

export function VariantManagerModal({ open, onOpenChange, product, onRefresh }: VariantManagerModalProps) {
  const { canPerform } = useAuth();
  const canViewInventoryCost = canPerform('INVENTORY_PRODUCTS', 'viewCost');
  const [variants, setVariants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formPriceModifier, setFormPriceModifier] = useState('0');
  const [formCostModifier, setFormCostModifier] = useState('0');

  const loadVariants = useCallback(async () => {
    if (!product) return;
    setLoading(true);
    try {
      const data = await inventoryService.getVariants(product.id);
      setVariants(data);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error al cargar variantes');
    } finally {
      setLoading(false);
    }
  }, [product]);

  useEffect(() => {
    if (open && product) {
      loadVariants();
    } else {
      setVariants([]);
      setEditingId(null);
      setShowCreate(false);
      setPendingDeleteId(null);
    }
  }, [open, product, loadVariants]);

  const resetForm = () => {
    setFormSku('');
    setFormName('');
    setFormBarcode('');
    setFormPriceModifier('0');
    setFormCostModifier('0');
  };

  const openCreate = () => {
    resetForm();
    setFormSku(`${product?.code || ''}-`);
    setEditingId(null);
    setShowCreate(true);
  };

  const openEdit = (variant: any) => {
    setFormSku(variant.sku);
    setFormName(variant.name || '');
    setFormBarcode(variant.barcode || '');
    setFormPriceModifier(String(variant.priceModifier || 0));
    setFormCostModifier(String(variant.costModifier || 0));
    setEditingId(variant.id);
    setShowCreate(true);
  };

  const handleSave = async () => {
    if (!product) return;
    if (!formSku.trim()) {
      toast.error('El SKU es obligatorio');
      return;
    }

    setSaving(true);
    try {
      const data = {
        sku: formSku.trim().toUpperCase(),
        name: formName.trim() || formSku.trim().toUpperCase(),
        barcode: formBarcode.trim() || undefined,
        priceModifier: parseFloat(formPriceModifier) || 0,
        ...(canViewInventoryCost ? { costModifier: parseFloat(formCostModifier) || 0 } : {}),
      };

      if (editingId) {
        await inventoryService.updateVariant(editingId, data);
        toast.success('Variante actualizada');
      } else {
        await inventoryService.createVariant(product.id, data);
        toast.success('Variante creada');
      }

      setShowCreate(false);
      setEditingId(null);
      resetForm();
      loadVariants();
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error al guardar variante');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDeleteId) return;
    setSaving(true);
    try {
      await inventoryService.deleteVariant(pendingDeleteId);
      toast.success('Variante eliminada');
      setPendingDeleteId(null);
      loadVariants();
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error al eliminar variante');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!product) return;
    setRegenerating(true);
    try {
      await inventoryService.regenerateVariants(product.id);
      toast.success('Variantes regeneradas desde atributos');
      loadVariants();
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error al regenerar variantes');
    } finally {
      setRegenerating(false);
    }
  };

  const getVariantAttributes = (variant: any): string => {
    if (!variant.attributes || !Array.isArray(variant.attributes) || variant.attributes.length === 0) {
      return variant.name || '-';
    }
    return variant.attributes.map((a: any) => a.value).join(' / ');
  };

  const getTotalStock = (variant: any): number => {
    if (!variant.stockLevels) return 0;
    return variant.stockLevels.reduce((sum: number, sl: any) => sum + (Number(sl.quantity) || 0), 0);
  };

  if (!product) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[min(88vh,calc(100dvh-3rem))] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="size-5 text-primary" />
              Variantes - {product.name}
            </DialogTitle>
            <DialogDescription>
              Gestiona las variantes (tallas, colores, etc.) del producto. SKU base: {product.code}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : variants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="size-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Este producto no tiene variantes</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Crea una variante o regenera desde atributos</p>
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">SKU</TableHead>
                      <TableHead>Atributos</TableHead>
                      <TableHead className="w-20 text-right">Stock</TableHead>
                      <TableHead className="w-24 text-right">Precios</TableHead>
                      <TableHead className="w-20 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variants.map((variant) => (
                      <TableRow key={variant.id}>
                        <TableCell>
                          <span className="font-mono text-xs font-bold">{variant.sku}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {variant.attributes && Array.isArray(variant.attributes) && variant.attributes.length > 0 ? (
                              variant.attributes.map((attr: any, idx: number) => (
                                <Badge key={idx} variant="secondary" className="text-[9px]">
                                  {attr.attributeName}: {attr.value}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-xs text-muted-foreground">{variant.name}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-xs font-bold">{getTotalStock(variant)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-0.5">
                            {Number(variant.priceModifier) !== 0 && (
                              <Badge variant="outline" className="text-[8px] text-emerald-600">
                                +{variant.priceModifier}
                              </Badge>
                            )}
                            {canViewInventoryCost && Number(variant.costModifier) !== 0 && (
                              <Badge variant="outline" className="text-[8px] text-amber-600">
                                costo {variant.costModifier}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => openEdit(variant)}
                              title="Editar"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive hover:bg-destructive/10"
                              onClick={() => setPendingDeleteId(variant.id)}
                              title="Eliminar"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-wrap gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerating || !product.linkedAttributes || product.linkedAttributes.length === 0}
              className="gap-1.5"
            >
              {regenerating ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Regenerar
            </Button>
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="size-3.5" />
              Nueva Variante
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreate} onOpenChange={(v) => { if (!v) { setShowCreate(false); setEditingId(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Variante' : 'Nueva Variante'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Modifica los datos de la variante' : 'Agrega una nueva variante al producto'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">SKU *</label>
              <Input
                value={formSku}
                onChange={(e) => setFormSku(e.target.value)}
                className="h-9 text-xs font-mono uppercase"
                placeholder={`${product.code}-TALLA-S`}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Nombre / Descripción</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="h-9 text-xs"
                placeholder="Ej: Talla S / Rojo"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Código de barras</label>
              <Input
                value={formBarcode}
                onChange={(e) => setFormBarcode(e.target.value)}
                className="h-9 text-xs font-mono"
                placeholder="Opcional"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Modificador precio</label>
                <Input
                  type="number"
                  value={formPriceModifier}
                  onChange={(e) => setFormPriceModifier(e.target.value)}
                  className="h-9 text-xs"
                  step="0.01"
                />
              </div>
              {canViewInventoryCost && <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Modificador costo</label>
                <Input
                  type="number"
                  value={formCostModifier}
                  onChange={(e) => setFormCostModifier(e.target.value)}
                  className="h-9 text-xs"
                  step="0.01"
                />
              </div>}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditingId(null); resetForm(); }} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !formSku.trim()}>
              {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              {editingId ? 'Guardar cambios' : 'Crear variante'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDeleteId}
        onOpenChange={(v) => { if (!v) setPendingDeleteId(null); }}
        title="Eliminar variante"
        description="¿Estás seguro de eliminar esta variante? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={handleDelete}
        loading={saving}
      />
    </>
  );
}
