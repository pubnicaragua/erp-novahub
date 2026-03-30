import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { purchaseOrdersService, supplierInvoicesService, expensesService, recurringExpensesService } from '../../services/compras.service';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { FileDown, FileText, Loader2 } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { generateSupplierHistoryPDF } from '../../utils/pdfGenerator';
import { exportToCsv } from '../../utils/exportUtils';
import type { Supplier } from '../../types';

interface SupplierHistoryModalProps {
  supplier: Supplier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupplierHistoryModal({ supplier, open, onOpenChange }: SupplierHistoryModalProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { formatConvertedAmount } = useCurrency();
  const { user } = useAuth();

  useEffect(() => {
    if (open && supplier) {
      loadHistory();
    } else {
      setItems([]);
    }
  }, [open, supplier]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const [ordersRes, invoicesRes, expensesRes, recurringRes] = await Promise.all([
        purchaseOrdersService.getAll({ supplierId: supplier!.id } as any),
        supplierInvoicesService.getAll({ supplierId: supplier!.id } as any),
        expensesService.getAll({ supplierId: supplier!.id } as any),
        recurringExpensesService.getAll({ supplierId: supplier!.id } as any),
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
    } catch (error) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl xl:max-w-5xl w-full max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">Historial del Proveedor</DialogTitle>
          <DialogDescription>
            {supplier?.name} | {supplier?.code || 'Sin código'}
          </DialogDescription>
        </DialogHeader>

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

        <ScrollArea className="flex-1 -mx-6 px-6 relative border-t">
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
              <table className="w-full text-sm text-left">
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
                  {items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{it.date}</td>
                      <td className="px-4 py-3">
                         <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${it.type === 'Factura' ? 'bg-primary/10 text-primary' : it.type.includes('Gasto') ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>
                           {it.type}
                         </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{it.docNumber}</td>
                      <td className="px-4 py-3">{it.description}</td>
                      <td className="px-4 py-3 text-center">{it.quantity}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatConvertedAmount(it.unitPrice, it.currency, it.exchangeRate)}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{formatConvertedAmount(it.total, it.currency, it.exchangeRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
