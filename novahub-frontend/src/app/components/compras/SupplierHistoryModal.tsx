import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Card, CardContent } from '../ui/card';
import { purchaseOrdersService, supplierInvoicesService, expensesService, recurringExpensesService, supplierPricesService } from '../../services/compras.service';
import { useCurrency } from '../../contexts/CurrencyContext';
import { CurrencyValuationAmount } from '../ui/CurrencyValuation';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { FileDown, FileText, Loader2, Plus, Trash2 } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { generateSupplierHistoryPDF } from '../../utils/pdfGenerator';
import { exportToCsv } from '../../utils/exportUtils';
import { toast } from 'sonner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { Supplier } from '../../types';

interface SupplierHistoryModalProps {
  supplier: Supplier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupplierHistoryModal({ supplier, open, onOpenChange }: SupplierHistoryModalProps) {
  const [items, setItems] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('historial');
  const [newPrice, setNewPrice] = useState({ description: '', unitPrice: 0, currency: 'NIO', date: new Date().toISOString().slice(0, 10) });
  const [showNewPrice, setShowNewPrice] = useState(false);
  const [deletePriceId, setDeletePriceId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const { formatConvertedAmount } = useCurrency();
  const { user } = useAuth();

  useEffect(() => {
    const controller = new AbortController();
    if (open && supplier) {
      loadHistory(controller.signal);
    } else {
      setItems([]);
    }
    return () => controller.abort();
  }, [open, supplier]);

  const loadHistory = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const [ordersRes, invoicesRes, expensesRes, recurringRes] = await Promise.all([
        purchaseOrdersService.getAll({ supplierId: supplier!.id, page: 1, pageSize: 200 } as any, signal),
        supplierInvoicesService.getAll({ supplierId: supplier!.id, page: 1, pageSize: 200 } as any, signal),
        expensesService.getAll({ supplierId: supplier!.id, page: 1, pageSize: 200 } as any, signal),
        recurringExpensesService.getAll({ supplierId: supplier!.id, page: 1, pageSize: 200 } as any, signal),
      ]);
      
      const rawOrders = Array.isArray(ordersRes) ? ordersRes : ((ordersRes as any).data || []);
      const rawInvoices = Array.isArray(invoicesRes) ? invoicesRes : ((invoicesRes as any).data || []);
      const rawExpenses = Array.isArray(expensesRes) ? expensesRes : ((expensesRes as any).data || []);
      const rawRecurring = Array.isArray(recurringRes) ? recurringRes : ((recurringRes as any).data || []);

      const supplierOrders = rawOrders.filter((o: any) => o.supplierId === supplier!.id);
      const supplierInvoices = rawInvoices.filter((i: any) => i.supplierId === supplier!.id);
      const supplierExpenses = rawExpenses.filter((e: any) => e.supplierId === supplier!.id);
      const supplierRecurring = rawRecurring.filter((r: any) => r.supplierId === supplier!.id);

      const historyItems: any[] = [];

      supplierOrders.forEach((order: any) => {
        (order.items || []).forEach((item: any) => {
          historyItems.push({
            date: new Date(order.date).toLocaleDateString(),
            rawDate: new Date(order.date),
            type: 'Orden',
            docNumber: order.number,
            description: item.description || 'Producto sin nombre',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            currency: order.currency || 'NIO',
            exchangeRate: order.exchangeRate,
          });
        });
      });

      supplierInvoices.forEach((invoice: any) => {
        (invoice.items || []).forEach((item: any) => {
          historyItems.push({
            date: new Date(invoice.date).toLocaleDateString(),
            rawDate: new Date(invoice.date),
            type: 'Factura',
            docNumber: invoice.number,
            description: item.description || 'Producto sin nombre',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            currency: invoice.currency || 'NIO',
            exchangeRate: invoice.exchangeRate,
          });
        });
      });

      supplierExpenses.forEach((expense: any) => {
        historyItems.push({
          date: new Date(expense.date).toLocaleDateString(),
          rawDate: new Date(expense.date),
          type: 'Gasto',
          docNumber: expense.number || '-',
          description: expense.description || expense.category || 'Gasto',
          quantity: 1,
          unitPrice: expense.amount,
          total: expense.amount,
          currency: expense.currency || 'NIO',
          exchangeRate: expense.exchangeRate,
        });
      });

      supplierRecurring.forEach((expense: any) => {
        historyItems.push({
          date: new Date(expense.startDate).toLocaleDateString(),
          rawDate: new Date(expense.startDate),
          type: 'Gasto Recurrente',
          docNumber: 'REC-' + (expense.id ? expense.id.slice(0, 6).toUpperCase() : ''),
          description: expense.description || expense.category || 'Gasto recurrente',
          quantity: 1,
          unitPrice: expense.amount,
          total: expense.amount,
          currency: expense.currency || 'NIO',
          exchangeRate: expense.exchangeRate,
        });
      });

      historyItems.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
      setItems(historyItems);

      const priceRes = await supplierPricesService.getAll(supplier!.id, signal);
      setPrices(Array.isArray(priceRes) ? priceRes : []);
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!supplier || items.length === 0) return;
    generateSupplierHistoryPDF({
      supplier,
      items,
      tenantName: user?.tenantName || 'Nuestra Empresa',
      formatAmount: formatConvertedAmount,
    });
  };

  const handleExportCSV = () => {
    if (!supplier || items.length === 0) return;
    const rows = items.map(item => [
      item.date,
      item.type,
      item.docNumber,
      item.description,
      item.quantity,
      item.unitPrice,
      item.total,
      item.currency,
    ]);
    exportToCsv(`Historial_${supplier.name.replace(/\s+/g, '_')}`, [['Fecha', 'Tipo', 'Doc', 'Descripción', 'Cant', 'Precio U.', 'Total', 'Moneda'], ...rows]);
  };

  const handleAddPrice = async () => {
    if (!supplier || !newPrice.description || newPrice.unitPrice <= 0) return toast.error('Descripción y precio requeridos');
    try {
      const res = await supplierPricesService.create({ ...newPrice, supplierId: supplier.id, date: newPrice.date || new Date().toISOString().slice(0, 10) });
      setPrices(prev => [res, ...prev]);
      setShowNewPrice(false);
      setNewPrice({ description: '', unitPrice: 0, currency: 'NIO', date: new Date().toISOString().slice(0, 10) });
      toast.success('Precio registrado');
    } catch { toast.error('Error al guardar precio'); }
  };

  const handleDeletePrice = async () => {
    if (!deletePriceId) return;
    try {
      await supplierPricesService.delete(deletePriceId);
      setPrices(prev => prev.filter(p => p.id !== deletePriceId));
      setDeletePriceId(null);
      toast.success('Precio eliminado');
    } catch { toast.error('Error al eliminar precio'); }
  };

  const totalPages = Math.ceil(items.length / 50);
  const pageItems = items.slice((page - 1) * 50, page * 50);
  useEffect(() => { setPage(1); }, [items]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl xl:max-w-5xl w-full max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Historial del Proveedor</DialogTitle>
          <DialogDescription>
            {supplier?.name} | {supplier?.code || 'Sin código'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-fit mb-4">
            <TabsTrigger value="historial">Historial</TabsTrigger>
            <TabsTrigger value="precios">Precios ({prices.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="historial" className="mt-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">Productos y servicios adquiridos</p>
              <div className="flex gap-2">
                 <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={loading || items.length === 0}>
                   <FileDown className="size-4 mr-2" /> Excel (CSV)
                 </Button>
                 <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={loading || items.length === 0}>
                   <FileText className="size-4 mr-2" /> PDF
                 </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 -mx-6 px-6 relative border-t max-h-[60vh]">
              {loading ? (
                 <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-4">
                   <Loader2 className="size-8 animate-spin" />
                   <p>Cargando historial...</p>
                 </div>
              ) : items.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <p>No se encontraron registros de compras para este proveedor.</p>
                 </div>
              ) : (
                <div className="w-full">
                  <table className="responsive-data-table w-full text-sm text-left">
                    <thead className="text-xs uppercase bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                      <tr>
                        <th className="px-4 py-3 font-semibold w-[100px]">Fecha</th>
                        <th className="px-4 py-3 font-semibold">Tipo</th>
                        <th className="px-4 py-3 font-semibold">Doc.</th>
                        <th className="px-4 py-3 font-semibold w-1/3">Descripción</th>
                        <th className="px-4 py-3 font-semibold text-center">Cant.</th>
                        <th className="px-4 py-3 font-semibold text-right">Precio U.</th>
                        <th className="px-4 py-3 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {pageItems.map((it, idx) => (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{it.date}</td>
                          <td className="px-4 py-3">
                             <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${it.type === 'Factura' ? 'bg-primary/10 text-primary' : it.type.includes('Gasto') ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'}`}>
                               {it.type}
                             </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{it.docNumber}</td>
                          <td className="px-4 py-3">{it.description}</td>
                          <td className="px-4 py-3 text-center">{it.quantity}</td>
                          <td className="px-4 py-3 text-right"><CurrencyValuationAmount amount={it.unitPrice} sourceCurrency={it.currency} sourceExchangeRate={it.exchangeRate} className="font-medium" /></td>
                          <td className="px-4 py-3 text-right"><CurrencyValuationAmount amount={it.total} sourceCurrency={it.currency} sourceExchangeRate={it.exchangeRate} className="font-medium" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {totalPages > 1 && (
                    <div className="flex justify-center gap-2 p-4">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <button key={p} onClick={() => setPage(p)} className={`px-3 py-1 text-xs rounded ${p === page ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}>{p}</button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="precios" className="mt-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">Registro histórico de precios</p>
              <Button size="sm" onClick={() => setShowNewPrice(!showNewPrice)}>
                <Plus className="size-4 mr-1" /> {showNewPrice ? 'Cancelar' : 'Nuevo Precio'}
              </Button>
            </div>

            {showNewPrice && (
              <Card className="p-3 mb-3 border-dashed">
                <div className="grid grid-cols-4 gap-2">
                  <Input placeholder="Descripción" value={newPrice.description} onChange={e => setNewPrice(p => ({ ...p, description: e.target.value }))} className="h-8 text-xs" />
                  <Input type="number" placeholder="Precio" value={newPrice.unitPrice || ''} onChange={e => setNewPrice(p => ({ ...p, unitPrice: Number(e.target.value) }))} className="h-8 text-xs" />
                  <select value={newPrice.currency} onChange={e => setNewPrice(p => ({ ...p, currency: e.target.value }))} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                    <option value="NIO">NIO</option>
                    <option value="USD">USD</option>
                  </select>
                  <Button size="sm" onClick={handleAddPrice} className="h-8 text-xs">Guardar</Button>
                </div>
              </Card>
            )}

            <ScrollArea className="flex-1 -mx-6 px-6 relative border-t max-h-[60vh]">
              {prices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <p>Sin registros de precios</p>
                </div>
              ) : (
                <table className="responsive-data-table w-full text-sm text-left">
                  <thead className="text-xs uppercase bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Fecha</th>
                      <th className="px-4 py-3 font-semibold w-1/2">Descripción</th>
                      <th className="px-4 py-3 font-semibold text-right">Precio</th>
                      <th className="px-4 py-3 font-semibold text-center">Moneda</th>
                      <th className="px-4 py-3 font-semibold text-center w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {prices.map((p: any) => (
                      <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{new Date(p.date).toLocaleDateString()}</td>
                        <td className="px-4 py-3">{p.description}</td>
                        <td className="px-4 py-3 text-right"><CurrencyValuationAmount amount={p.unitPrice} sourceCurrency={p.currency} sourceExchangeRate={p.exchangeRate} className="font-medium" /></td>
                        <td className="px-4 py-3 text-center text-xs font-mono">{p.currency}</td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => setDeletePriceId(p.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <ConfirmDialog
          open={!!deletePriceId}
          onOpenChange={() => setDeletePriceId(null)}
          title="Eliminar precio"
          description="¿Eliminar este registro de precio?"
          onConfirm={handleDeletePrice}
        />
      </DialogContent>
    </Dialog>
  );
}
