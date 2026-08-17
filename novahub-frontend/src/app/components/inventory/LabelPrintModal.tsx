'use client';

import { useMemo, useState, useCallback } from 'react';
import { Search, Printer, Barcode, ChevronDown, ChevronUp } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import jsPDF from 'jspdf';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

interface LabelProduct {
  id: string;
  code: string;
  sku?: string;
  name: string;
  salePrice?: number;
  barcode?: string;
  category?: { name?: string };
  brand?: string;
}

interface LabelPrintModalProps {
  open: boolean;
  onClose: () => void;
  products: LabelProduct[];
  companyName?: string;
}

interface ProductLabelConfig {
  productId: string;
  quantity: number;
  showName: boolean;
  showVariation: boolean;
  showPrice: boolean;
  showCompany: boolean;
  showDate: boolean;
  showTaxIncluded: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

const formatPrice = (value: number) =>
  new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

/**
 * Renders a JsBarcode onto an off-screen canvas and returns a data URL.
 */
function generateBarcodeDataUrl(code: string, width = 2, height = 60): string {
  const canvas = document.createElement('canvas');
  try {
    JsBarcode(canvas, code, {
      format: 'CODE128',
      width,
      height,
      displayValue: true,
      fontSize: 12,
      margin: 4,
      textMargin: 2,
      background: 'transparent',
      lineColor: '#000000',
    });
    return canvas.toDataURL('image/png');
  } catch {
    // Fallback: use SKU text instead of barcode
    return '';
  }
}

// ============================================================================
// Component
// ============================================================================

export function LabelPrintModal({ open, onClose, products, companyName = 'Nova Hub' }: LabelPrintModalProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [configs, setConfigs] = useState<Map<string, ProductLabelConfig>>(new Map());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  // Unique categories and brands
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => { if (p.category?.name) set.add(p.category.name); });
    return Array.from(set).sort();
  }, [products]);

  const brands = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => { if (p.brand) set.add(p.brand); });
    return Array.from(set).sort();
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (search) {
        const s = search.toLowerCase();
        if (!p.name?.toLowerCase().includes(s) && !p.code?.toLowerCase().includes(s) && !(p.sku?.toLowerCase().includes(s))) return false;
      }
      if (categoryFilter && p.category?.name !== categoryFilter) return false;
      if (brandFilter && p.brand !== brandFilter) return false;
      return true;
    });
  }, [products, search, categoryFilter, brandFilter]);

  // Selection state
  const selectedIds = useMemo(() => new Set(configs.keys()), [configs]);
  const allSelected = filteredProducts.length > 0 && filteredProducts.every((p) => selectedIds.has(p.id));

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setConfigs(new Map());
    } else {
      const next = new Map(configs);
      filteredProducts.forEach((p) => {
        if (!next.has(p.id)) {
          next.set(p.id, makeDefaultConfig(p.id));
        }
      });
      setConfigs(next);
    }
  }, [allSelected, filteredProducts, configs]);

  const toggleSelect = useCallback((productId: string) => {
    setConfigs((prev) => {
      const next = new Map(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.set(productId, makeDefaultConfig(productId));
      }
      return next;
    });
  }, []);

  const updateConfig = useCallback((productId: string, patch: Partial<ProductLabelConfig>) => {
    setConfigs((prev) => {
      const next = new Map(prev);
      const existing = next.get(productId) || makeDefaultConfig(productId);
      next.set(productId, { ...existing, ...patch });
      return next;
    });
  }, []);

  const makeDefaultConfig = (productId: string): ProductLabelConfig => ({
    productId,
    quantity: 1,
    showName: true,
    showVariation: false,
    showPrice: true,
    showCompany: true,
    showDate: false,
    showTaxIncluded: true,
  });

  // PDF generation
  const handlePrint = useCallback(async () => {
    if (selectedIds.size === 0) { toast.error('Selecciona al menos un producto'); return; }
    setPrinting(true);

    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [70, 38] });
      const pageWidth = 70;
      const pageHeight = 38;
      let isFirstPage = true;

      for (const product of filteredProducts) {
        const config = configs.get(product.id);
        if (!config) continue;

        for (let i = 0; i < config.quantity; i++) {
          if (!isFirstPage) {
            doc.addPage([pageWidth, pageHeight], 'landscape');
          }
          isFirstPage = false;

          let y = 4;
          const centerX = pageWidth / 2;

          // Generate barcode
          const barcodeCode = product.barcode || product.sku || product.code || product.id.slice(0, 12);
          const barcodeDataUrl = generateBarcodeDataUrl(barcodeCode);

          if (barcodeDataUrl) {
            try {
              doc.addImage(barcodeDataUrl, 'PNG', 5, y, pageWidth - 10, 16);
            } catch {
              doc.setFontSize(8);
              doc.text(barcodeCode, centerX, y + 8, { align: 'center' });
            }
            y += 17;
          } else {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text(barcodeCode, centerX, y + 6, { align: 'center' });
            y += 12;
          }

          // Product name
          if (config.showName) {
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            const name = product.name || 'Producto';
            const maxChars = Math.floor((pageWidth - 6) / 3.5);
            const truncated = name.length > maxChars ? name.slice(0, maxChars - 1) + '…' : name;
            doc.text(truncated, centerX, y, { align: 'center' });
            y += 3.5;
          }

          // Price
          if (config.showPrice && product.salePrice) {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            const priceText = `C$ ${formatPrice(product.salePrice)}`;
            doc.text(priceText, centerX, y, { align: 'center' });
            y += 3;
          }

          // Company name
          if (config.showCompany) {
            doc.setFontSize(5.5);
            doc.setFont('helvetica', 'normal');
            doc.text(companyName, centerX, y, { align: 'center' });
            y += 2.5;
          }

          // Date
          if (config.showDate) {
            doc.setFontSize(5);
            doc.setFont('helvetica', 'normal');
            const today = new Date().toLocaleDateString('es-NI');
            doc.text(today, centerX, y, { align: 'center' });
          }
        }
      }

      doc.save(`etiquetas_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success(`PDF generado con ${selectedIds.size} producto(s)`);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Error al generar el PDF');
    } finally {
      setPrinting(false);
    }
  }, [filteredProducts, configs, selectedIds, companyName, onClose]);

  // Count selected with quantities
  const totalLabels = useMemo(() => {
    let total = 0;
    configs.forEach((c) => { total += c.quantity; });
    return total;
  }, [configs]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="size-5" /> Imprimir Etiquetas
          </DialogTitle>
          <DialogDescription>
            Selecciona los productos, configura la cantidad y las opciones de cada etiqueta.
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border/50 pb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-lg border bg-background px-2 text-xs"
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {brands.length > 0 && (
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="h-9 rounded-lg border bg-background px-2 text-xs"
            >
              <option value="">Todas las marcas</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
        </div>

        {/* Select all + count */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleSelectAll}
            />
            <span className="font-medium">Seleccionar todo ({filteredProducts.length})</span>
          </div>
          {selectedIds.size > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {selectedIds.size} productos · {totalLabels} etiquetas
            </Badge>
          )}
        </div>

        {/* Product list */}
        <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
          {filteredProducts.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No se encontraron productos con los filtros seleccionados.
            </div>
          ) : filteredProducts.map((product) => {
            const config = configs.get(product.id);
            const isSelected = Boolean(config);
            const isExpanded = expandedId === product.id;

            return (
              <div
                key={product.id}
                className={`rounded-lg border p-2 transition-colors ${isSelected ? 'border-primary/40 bg-primary/5' : 'border-border/40 bg-card/50'}`}
              >
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(product.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{product.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{product.code || product.sku || '—'}</p>
                  </div>
                  {isSelected && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">Cant:</span>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={config?.quantity || 1}
                        onChange={(e) => updateConfig(product.id, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                        className="h-7 w-14 text-center text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : product.id)}
                        className="rounded p-1 hover:bg-muted/40"
                        title="Configurar opciones"
                      >
                        {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      </button>
                    </div>
                  )}
                </div>

                {isSelected && isExpanded && config && (
                  <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border/30 pt-2">
                    {[
                      { key: 'showName' as const, label: 'Nombre' },
                      { key: 'showPrice' as const, label: 'Precio' },
                      { key: 'showCompany' as const, label: 'Empresa' },
                      { key: 'showDate' as const, label: 'Fecha empaque' },
                      { key: 'showVariation' as const, label: 'Variación' },
                      { key: 'showTaxIncluded' as const, label: 'IVA incluido' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
                        <Checkbox
                          checked={config[key]}
                          onCheckedChange={(v) => updateConfig(product.id, { [key]: Boolean(v) })}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl text-xs font-bold">Cancelar</Button>
          <Button
            onClick={handlePrint}
            disabled={selectedIds.size === 0 || printing}
            className="gap-2 rounded-xl bg-primary px-5 text-xs font-black uppercase tracking-wider text-primary-foreground"
          >
            <Printer className="size-4" />
            {printing ? 'Generando…' : `Imprimir ${totalLabels} etiqueta${totalLabels !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
